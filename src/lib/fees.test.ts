import { describe, it, expect } from 'vitest';
import { computeAccruedAnnualFee, applyWireFee } from './fees';
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
    annualInterestRate: 0,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 120000, // $1,200/year
    wireFeeCents: 2500, // $25 wire fee
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

describe('computeAccruedAnnualFee', () => {
  it('pro-rates the annual fee to roughly half at 6 months', () => {
    const escrow = baseEscrow();
    // 2026-01-01 -> 2026-07-02 is 182 days; 120000 * 182/365 = 59835.6 -> 59836
    const fee = computeAccruedAnnualFee(
      escrow,
      new Date('2026-07-02T00:00:00Z'),
    );
    expect(fee).toBe(Math.round((120000 * 182) / 365));
    expect(fee).toBeGreaterThan(55000);
    expect(fee).toBeLessThan(65000);
  });
});

describe('applyWireFee', () => {
  it('debits the wire fee and appends a ledger entry without mutating input', () => {
    const escrow = baseEscrow();
    const next = applyWireFee(escrow, 'supervisor');
    expect(next).not.toBe(escrow);
    expect(escrow.ledger).toHaveLength(0);
    expect(next.ledger).toHaveLength(1);
    expect(next.ledger[0].type).toBe('wire-fee-debit');
    expect(next.ledger[0].amountCents).toBe(-2500);
    expect(next.currentBalanceCents).toBe(100000000 - 2500);
  });
});
