import { describe, it, expect } from 'vitest';
import { computeReleasableAmount } from './balance';
import type { Claim, Escrow } from '../types';

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
    originalAmountCents: 50000000,
    currentBalanceCents: 50000000,
    status: 'active',
    annualInterestRate: 0,
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

function claim(amountCents: number, status: Claim['status'] = 'open'): Claim {
  return {
    id: `claim-${amountCents}-${status}`,
    description: 'Test claim',
    filedDate: '2026-02-01',
    claimedAmountCents: amountCents,
    status,
  };
}

const AS_OF = new Date('2026-10-08T00:00:00Z');

describe('computeReleasableAmount', () => {
  it('with no claims and no fees, releasable equals full balance', () => {
    const result = computeReleasableAmount(baseEscrow(), AS_OF);
    expect(result.grossBalanceCents).toBe(50000000);
    expect(result.effectiveClaimReserveCents).toBe(0);
    expect(result.accruedFeesCents).toBe(0);
    expect(result.netReleasableCents).toBe(50000000);
  });

  it('a partial claim reduces the releasable amount', () => {
    const result = computeReleasableAmount(
      baseEscrow({ claims: [claim(5000000)] }),
      AS_OF,
    );
    expect(result.effectiveClaimReserveCents).toBe(5000000);
    expect(result.netReleasableCents).toBe(45000000);
  });

  it('a claim larger than the balance reserves the full balance, releasable 0', () => {
    const result = computeReleasableAmount(
      baseEscrow({
        currentBalanceCents: 25000000,
        claims: [claim(30000000)],
      }),
      AS_OF,
    );
    expect(result.effectiveClaimReserveCents).toBe(25000000);
    expect(result.netReleasableCents).toBe(0);
  });

  it('caps the combined reserve of multiple claims at the balance', () => {
    const result = computeReleasableAmount(
      baseEscrow({
        currentBalanceCents: 50000000,
        claims: [claim(40000000), claim(30000000, 'disputed')],
      }),
      AS_OF,
    );
    // First claim reserves 40M, second can only reserve the remaining 10M.
    expect(result.effectiveClaimReserveCents).toBe(50000000);
    expect(result.netReleasableCents).toBe(0);
  });

  it('fee deductions reduce the releasable amount', () => {
    const result = computeReleasableAmount(
      baseEscrow({ wireFeeCents: 2500 }),
      AS_OF,
    );
    expect(result.accruedFeesCents).toBe(2500);
    expect(result.netReleasableCents).toBe(50000000 - 2500);
  });
});
