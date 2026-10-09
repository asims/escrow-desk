import { describe, it, expect } from 'vitest';
import { createSeedStore, REFERENCE_DATE } from './seed';
import { evaluateChecklist } from '../lib/checklist';
import { computeReleasableAmount } from '../lib/balance';
import { reducer } from '../store/EscrowContext';
import { approveRelease } from '../store/actions';
import { createGateway } from '../lib/createGateway';
import type { EscrowStore } from '../types';

const ASOF = REFERENCE_DATE;

function get(store: EscrowStore, id: string) {
  return store.escrows.find((e) => e.id === id)!;
}

function checkPass(store: EscrowStore, id: string, checkId: string, isBiz = true) {
  const results = evaluateChecklist(get(store, id), isBiz, ASOF);
  return results.find((r) => r.id === checkId)!.passed;
}

describe('End-to-end seed scenarios (Task 20)', () => {
  it('ESC-001 Ready to fund — all six checks pass', () => {
    const store = createSeedStore();
    const results = evaluateChecklist(get(store, 'ESC-001'), true, ASOF);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it('ESC-002 Partial claim — claims check fails, releasable reduced', () => {
    const store = createSeedStore();
    expect(checkPass(store, 'ESC-002', 'claims')).toBe(false);
    const b = computeReleasableAmount(get(store, 'ESC-002'), ASOF);
    expect(b.effectiveClaimReserveCents).toBe(5000000);
    expect(b.netReleasableCents).toBeLessThan(b.grossBalanceCents);
  });

  it('ESC-003 Fully blocked — releasable is 0 and claims check fails', () => {
    const store = createSeedStore();
    const b = computeReleasableAmount(get(store, 'ESC-003'), ASOF);
    expect(b.netReleasableCents).toBe(0);
    expect(checkPass(store, 'ESC-003', 'claims')).toBe(false);
    expect(checkPass(store, 'ESC-003', 'amount')).toBe(false);
  });

  it('ESC-004 Non-business day — business-day check fails when not a business day', () => {
    const store = createSeedStore();
    expect(checkPass(store, 'ESC-004', 'business-day', false)).toBe(false);
  });

  it('ESC-005 Not yet due — date check fails', () => {
    const store = createSeedStore();
    expect(checkPass(store, 'ESC-005', 'date')).toBe(false);
  });

  it('ESC-006 Missing instruction — instructions check fails (seller missing)', () => {
    const store = createSeedStore();
    const results = evaluateChecklist(get(store, 'ESC-006'), true, ASOF);
    const instr = results.find((r) => r.id === 'instructions')!;
    expect(instr.passed).toBe(false);
    expect(instr.detail).toMatch(/seller/i);
  });

  it('ESC-007 Pending approval — status is pending-approval', () => {
    const store = createSeedStore();
    expect(get(store, 'ESC-007').status).toBe('pending-approval');
    expect(get(store, 'ESC-007').releases[0].status).toBe('pending-approval');
  });

  it('ESC-008 Wire pending — status wire-pending and no-duplicate check fails', () => {
    const store = createSeedStore();
    expect(get(store, 'ESC-008').status).toBe('wire-pending');
    expect(checkPass(store, 'ESC-008', 'no-duplicate')).toBe(false);
  });

  it('ESC-009 Fully closed — balance 0, status closed, has disbursement history', () => {
    const store = createSeedStore();
    const e = get(store, 'ESC-009');
    expect(e.currentBalanceCents).toBe(0);
    expect(e.status).toBe('closed');
    expect(e.ledger.some((l) => l.type === 'final-disbursement')).toBe(true);
  });

  it('ESC-010 Two-tranche — first disbursed, second upcoming', () => {
    const store = createSeedStore();
    const e = get(store, 'ESC-010');
    expect(e.releaseSchedule).toHaveLength(2);
    expect(e.ledger.some((l) => l.type === 'partial-disbursement')).toBe(true);
    // $40M remained after the first tranche; monthly 4.5% interest has since
    // compounded the balance above that base. The ledger reconciles exactly.
    expect(e.currentBalanceCents).toBe(44503503);
    expect(e.currentBalanceCents).toBeGreaterThan(40000000);
    const last = e.ledger[e.ledger.length - 1];
    expect(last.runningBalanceCents).toBe(e.currentBalanceCents);
  });

  it('ESC-011 Gateway failure — approve path fails and release stays pending-approval', async () => {
    let store = createSeedStore();
    const gateway = createGateway('mock');
    const escrow = get(store, 'ESC-011');
    const release = escrow.releases[0];
    expect(release.id).toBe('escrow-11-release-1');

    await approveRelease(
      (action) => {
        store = reducer(store, action);
      },
      gateway,
      escrow,
      release,
      ASOF,
      [],
    );

    const after = get(store, 'ESC-011');
    expect(after.releases[0].status).toBe('pending-approval');
    expect(after.releases[0].postError).toMatch(/rejected/i);
    expect(after.status).toBe('pending-approval');
  });

  it('happy-path approve (ESC-001-style id) advances to wire-pending', async () => {
    let store = createSeedStore();
    const gateway = createGateway('mock');
    // Prepare ESC-001 first.
    store = reducer(store, {
      type: 'PREPARE_RELEASE',
      escrowId: 'ESC-001',
      preparedAt: ASOF.toISOString(),
    });
    const escrow = get(store, 'ESC-001');
    const release = escrow.releases[0];

    await approveRelease(
      (action) => {
        store = reducer(store, action);
      },
      gateway,
      escrow,
      release,
      ASOF,
      [],
    );

    const after = get(store, 'ESC-001');
    expect(after.releases[0].status).toBe('wire-pending');
    expect(after.status).toBe('wire-pending');
    expect(after.releases[0].confirmationRef).toBe('MOCK-escrow-01-release-1');
    expect(after.releases[0].valueDate).toBeDefined();
  });
});
