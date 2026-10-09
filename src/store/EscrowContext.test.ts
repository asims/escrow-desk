import { describe, it, expect } from 'vitest';
import { reducer } from './EscrowContext';
import { createSeedStore } from '../data/seed';
import type { EscrowStore } from '../types';

function freshStore(): EscrowStore {
  return createSeedStore();
}

describe('reducer', () => {
  it('SET_ROLE updates the current role', () => {
    const next = reducer(freshStore(), { type: 'SET_ROLE', role: 'supervisor' });
    expect(next.currentRole).toBe('supervisor');
  });

  it('RESET restores a fresh seed store', () => {
    const store = reducer(freshStore(), { type: 'SET_ROLE', role: 'supervisor' });
    const reset = reducer(store, { type: 'RESET' });
    expect(reset.currentRole).toBe('officer');
    expect(reset.escrows).toHaveLength(11);
  });

  it('PREPARE_RELEASE moves ESC-001 to pending-approval and appends a ledger entry', () => {
    const store = freshStore();
    const before = store.escrows.find((e) => e.id === 'ESC-001')!;
    const beforeLen = before.ledger.length;
    const next = reducer(store, {
      type: 'PREPARE_RELEASE',
      escrowId: 'ESC-001',
      preparedAt: '2026-10-08T12:00:00Z',
    });
    const escrow = next.escrows.find((e) => e.id === 'ESC-001')!;
    expect(escrow.status).toBe('pending-approval');
    expect(escrow.releases[0].status).toBe('pending-approval');
    expect(escrow.ledger.length).toBe(beforeLen + 1);
    expect(escrow.ledger[escrow.ledger.length - 1].type).toBe('release-prepared');
  });

  it('rejects a second release while one is wire-pending (double-release lock)', () => {
    const store = freshStore();
    // ESC-008 is already wire-pending in the seed.
    const next = reducer(store, {
      type: 'PREPARE_RELEASE',
      escrowId: 'ESC-008',
      preparedAt: '2026-10-08T12:00:00Z',
    });
    const escrow = next.escrows.find((e) => e.id === 'ESC-008')!;
    // No new release should have been added or re-prepared.
    expect(escrow.releases).toHaveLength(1);
    expect(escrow.releases[0].status).toBe('wire-pending');
  });

  it('CONFIRM_RELEASE on ESC-008 closes the escrow and appends disbursement entries', () => {
    const store = freshStore();
    const next = reducer(store, {
      type: 'CONFIRM_RELEASE',
      escrowId: 'ESC-008',
      releaseId: 'escrow-08-release-1',
      confirmedAt: '2026-10-08T12:00:00Z',
    });
    const escrow = next.escrows.find((e) => e.id === 'ESC-008')!;
    expect(escrow.releases[0].status).toBe('confirmed');
    expect(escrow.currentBalanceCents).toBe(0);
    expect(escrow.status).toBe('closed');
    const types = escrow.ledger.map((l) => l.type);
    expect(types).toContain('wire-fee-debit');
    expect(types).toContain('final-disbursement');
  });

  it('RELEASE_WIRE_FAILED keeps the release at pending-approval with an error', () => {
    const store = freshStore();
    const next = reducer(store, {
      type: 'RELEASE_WIRE_FAILED',
      escrowId: 'ESC-011',
      releaseId: 'escrow-11-release-1',
      error: 'Core system rejected post',
    });
    const escrow = next.escrows.find((e) => e.id === 'ESC-011')!;
    expect(escrow.releases[0].status).toBe('pending-approval');
    expect(escrow.releases[0].postError).toMatch(/rejected/i);
  });

  it('does not mutate the input store', () => {
    const store = freshStore();
    const snapshot = JSON.stringify(store);
    reducer(store, { type: 'SET_ROLE', role: 'supervisor' });
    expect(JSON.stringify(store)).toBe(snapshot);
  });
});
