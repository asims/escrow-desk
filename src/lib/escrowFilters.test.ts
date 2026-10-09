import { describe, it, expect } from 'vitest';
import { ESCROW_FILTERS, getFilter } from './escrowFilters';
import type { Claim, Escrow, EscrowStatus } from '../types';

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

function claim(status: Claim['status']): Claim {
  return {
    id: `claim-${status}`,
    description: 'Test claim',
    filedDate: '2026-05-01',
    claimedAmountCents: 100000,
    status,
  };
}

describe('ESCROW_FILTERS', () => {
  it('All matches every escrow', () => {
    const match = getFilter('all').match;
    expect(match(baseEscrow({ status: 'closed' }))).toBe(true);
    expect(match(baseEscrow({ status: 'active' }))).toBe(true);
  });

  it('Active matches active and pending-approval only', () => {
    const match = getFilter('active').match;
    expect(match(baseEscrow({ status: 'active' }))).toBe(true);
    expect(match(baseEscrow({ status: 'pending-approval' }))).toBe(true);
    expect(match(baseEscrow({ status: 'wire-pending' }))).toBe(false);
    expect(match(baseEscrow({ status: 'closed' }))).toBe(false);
  });

  it('Pending Approval matches pending-approval status only', () => {
    const match = getFilter('pending-approval').match;
    expect(match(baseEscrow({ status: 'pending-approval' }))).toBe(true);
    expect(match(baseEscrow({ status: 'active' }))).toBe(false);
  });

  it('Pending Wire matches wire-pending status only', () => {
    const match = getFilter('wire-pending').match;
    expect(match(baseEscrow({ status: 'wire-pending' }))).toBe(true);
    expect(match(baseEscrow({ status: 'active' }))).toBe(false);
  });

  it('Closed matches closed status only', () => {
    const match = getFilter('closed').match;
    expect(match(baseEscrow({ status: 'closed' }))).toBe(true);
    expect(match(baseEscrow({ status: 'active' }))).toBe(false);
  });

  describe('Open Claims (derived condition)', () => {
    const match = getFilter('open-claims').match;

    it('matches escrows with an open claim', () => {
      expect(match(baseEscrow({ claims: [claim('open')] }))).toBe(true);
    });

    it('matches escrows with a disputed claim', () => {
      expect(match(baseEscrow({ claims: [claim('disputed')] }))).toBe(true);
    });

    it('excludes escrows with only resolved claims', () => {
      expect(match(baseEscrow({ claims: [claim('resolved')] }))).toBe(false);
    });

    it('excludes escrows with no claims', () => {
      expect(match(baseEscrow({ claims: [] }))).toBe(false);
    });

    it('is independent of lifecycle status (e.g. closed with an open claim still matches)', () => {
      expect(
        match(baseEscrow({ status: 'closed', claims: [claim('open')] })),
      ).toBe(true);
    });
  });

  it('exposes exactly the six expected filter keys in order', () => {
    expect(ESCROW_FILTERS.map((f) => f.key)).toEqual([
      'all',
      'active',
      'pending-approval',
      'open-claims',
      'wire-pending',
      'closed',
    ]);
  });

  it('does not treat open-claim as an EscrowStatus value', () => {
    // The lifecycle status union must never gain a claim value. If someone adds
    // 'open-claim' (or similar) to EscrowStatus, this exhaustive check breaks.
    const statuses: EscrowStatus[] = [
      'active',
      'pending-approval',
      'wire-pending',
      'closed',
    ];
    const assertNever = (s: never): never => {
      throw new Error(`Unexpected EscrowStatus: ${String(s)}`);
    };
    for (const s of statuses) {
      switch (s) {
        case 'active':
        case 'pending-approval':
        case 'wire-pending':
        case 'closed':
          break;
        default:
          assertNever(s);
      }
    }
    expect((statuses as string[]).includes('open-claim')).toBe(false);
  });
});
