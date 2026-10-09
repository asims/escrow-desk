import { describe, it, expect } from 'vitest';
import { computeAccruedInterest, applyMonthlyInterest } from './interest';
import type { Escrow } from '../types';

function baseEscrow(overrides: Partial<Escrow> = {}): Escrow {
  return {
    id: 'esc-test',
    name: 'Test Escrow',
    dealName: 'Test Deal',
    buyer: { name: 'Buyer', role: 'buyer', signers: [] },
    seller: { name: 'Seller', role: 'seller', signers: [] },
    openedDate: '2026-01-01',
    survivalPeriodStart: '2026-01-01',
    survivalPeriodEnd: '2027-01-01',
    originalAmountCents: 100000000,
    currentBalanceCents: 100000000,
    status: 'active',
    annualInterestRate: 0.045,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 0,
    wireFeeCents: 0,
    releaseSchedule: [],
    claims: [],
    ledger: [],
    releases: [],
    wireInstructions: {
      beneficiaryName: 'Seller',
      bankName: 'Bank',
      routingNumber: '000',
      accountNumber: '111',
      reference: 'ref',
    },
    ...overrides,
  };
}

describe('computeAccruedInterest', () => {
  it('returns 0 for a zero-rate escrow', () => {
    const escrow = baseEscrow({ annualInterestRate: 0 });
    expect(
      computeAccruedInterest(escrow, new Date('2026-06-01T00:00:00Z')),
    ).toBe(0);
  });

  it('credits $3,750 (375000 cents) on $1,000,000 at 4.5% for 1 month', () => {
    const escrow = baseEscrow();
    expect(
      computeAccruedInterest(escrow, new Date('2026-02-01T00:00:00Z')),
    ).toBe(375000);
  });

  it('rounds the monthly credit to the nearest cent', () => {
    // 123457 cents * 0.0333 / 12 = 342.59... -> rounds to 343 cents
    const escrow = baseEscrow({
      currentBalanceCents: 123457,
      annualInterestRate: 0.0333,
    });
    const monthly = Math.round((123457 * 0.0333) / 12);
    expect(monthly).toBe(343);
    expect(
      computeAccruedInterest(escrow, new Date('2026-02-01T00:00:00Z')),
    ).toBe(343);
  });

  it('applyMonthlyInterest appends exactly one entry and updates balance', () => {
    const escrow = baseEscrow();
    const next = applyMonthlyInterest(escrow, new Date('2026-02-01T00:00:00Z'));
    expect(next).not.toBe(escrow);
    expect(escrow.ledger).toHaveLength(0); // original unchanged
    expect(next.ledger).toHaveLength(1);
    expect(next.ledger[0].type).toBe('interest-credit');
    expect(next.currentBalanceCents).toBe(100000000 + 375000);
  });
});
