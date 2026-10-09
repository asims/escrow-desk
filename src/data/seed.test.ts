import { describe, it, expect } from 'vitest';
import { createSeedStore } from './seed';
import { MOCK_FAILURE_RELEASE_IDS } from '../lib/mockCoreLedger';

describe('createSeedStore', () => {
  it('seeds all 11 scenarios', () => {
    const store = createSeedStore();
    expect(store.escrows).toHaveLength(11);
    expect(store.currentRole).toBe('officer');
  });

  it('seeds unique escrow ids ESC-001..ESC-011', () => {
    const ids = createSeedStore().escrows.map((e) => e.id);
    expect(new Set(ids).size).toBe(11);
    expect(ids).toContain('ESC-001');
    expect(ids).toContain('ESC-011');
  });

  it('ESC-011 has a prepared release in the mock failure set', () => {
    const esc011 = createSeedStore().escrows.find((e) => e.id === 'ESC-011')!;
    const release = esc011.releases[0];
    expect(release.id).toBe('escrow-11-release-1');
    expect(MOCK_FAILURE_RELEASE_IDS.has(release.id)).toBe(true);
    expect(release.status).toBe('pending-approval');
  });

  it('returns deep-fresh objects on each call (RESET safety)', () => {
    const a = createSeedStore();
    const b = createSeedStore();
    expect(a).not.toBe(b);
    expect(a.escrows[0]).not.toBe(b.escrows[0]);
    expect(a.escrows[0].ledger).not.toBe(b.escrows[0].ledger);
  });

  it('stores all monetary values as integers', () => {
    for (const e of createSeedStore().escrows) {
      expect(Number.isInteger(e.originalAmountCents)).toBe(true);
      expect(Number.isInteger(e.currentBalanceCents)).toBe(true);
      for (const entry of e.ledger) {
        expect(Number.isInteger(entry.amountCents)).toBe(true);
        expect(Number.isInteger(entry.runningBalanceCents)).toBe(true);
      }
    }
  });

  it('ESC-009 is fully closed with a zero balance', () => {
    const esc009 = createSeedStore().escrows.find((e) => e.id === 'ESC-009')!;
    expect(esc009.status).toBe('closed');
    expect(esc009.currentBalanceCents).toBe(0);
  });

  it('every ledger reconciles: final running balance equals currentBalance', () => {
    for (const e of createSeedStore().escrows) {
      let running = 0;
      for (const entry of e.ledger) {
        running += entry.amountCents;
        expect(entry.runningBalanceCents).toBe(running);
      }
      expect(e.currentBalanceCents).toBe(running);
    }
  });

  it('interest-bearing escrows accrue monthly interest credits (REQ-8.1)', () => {
    const interestBearing = createSeedStore().escrows.filter(
      (e) => e.annualInterestRate > 0,
    );
    expect(interestBearing.length).toBeGreaterThan(0);
    for (const e of interestBearing) {
      const credits = e.ledger.filter((l) => l.type === 'interest-credit');
      expect(credits.length).toBeGreaterThan(0);
      // Each monthly credit = round(prior running balance * rate / 12).
      for (const c of credits) {
        expect(c.amountCents).toBeGreaterThan(0);
        const prior = c.runningBalanceCents - c.amountCents;
        expect(c.amountCents).toBe(
          Math.round((prior * e.annualInterestRate) / 12),
        );
      }
    }
  });

  it('non-interest-bearing escrows have no interest credits (REQ-8.4)', () => {
    const zeroRate = createSeedStore().escrows.filter(
      (e) => e.annualInterestRate === 0,
    );
    expect(zeroRate.length).toBeGreaterThan(0);
    for (const e of zeroRate) {
      expect(e.ledger.some((l) => l.type === 'interest-credit')).toBe(false);
    }
  });

  it('every escrow records annual admin fee debits on anniversaries (REQ-8.2)', () => {
    for (const e of createSeedStore().escrows) {
      if (e.annualAdminFeeCents <= 0) continue;
      const fees = e.ledger.filter((l) => l.type === 'annual-fee-debit');
      expect(fees.length).toBeGreaterThan(0);
      for (const f of fees) {
        expect(f.amountCents).toBe(-e.annualAdminFeeCents);
      }
    }
  });
});
