import { describe, it, expect } from 'vitest';
import { evaluateChecklist } from './checklist';
import type { Escrow, Release } from '../types';

const AS_OF = new Date('2026-10-08T00:00:00Z');

function readyEscrow(overrides: Partial<Escrow> = {}): Escrow {
  return {
    id: 'esc-ready',
    name: 'Ready Escrow',
    dealName: 'Ready Deal',
    buyer: {
      name: 'Buyer Corp',
      role: 'buyer',
      signers: [{ id: 'b1', name: 'Bob Buyer', title: 'CFO' }],
    },
    seller: {
      name: 'Seller Inc',
      role: 'seller',
      signers: [{ id: 's1', name: 'Sam Seller', title: 'CEO' }],
    },
    openedDate: '2025-01-01',
    survivalPeriodStart: '2025-01-01',
    survivalPeriodEnd: '2026-01-01',
    originalAmountCents: 50000000,
    currentBalanceCents: 50000000,
    status: 'active',
    annualInterestRate: 0,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 0,
    wireFeeCents: 0,
    releaseSchedule: [
      { releaseDate: '2026-01-01', label: 'Final Release' },
    ],
    claims: [],
    ledger: [],
    releases: [
      {
        id: 'esc-ready-release-1',
        escrowId: 'esc-ready',
        status: 'none',
        preparedByRole: 'officer',
        amountCents: 50000000,
        wireInstructions: {
          beneficiaryName: 'Seller Inc',
          bankName: 'Bank',
          routingNumber: '000',
          accountNumber: '111',
          reference: 'ref',
        },
        instructionReceipts: [
          {
            partyRole: 'buyer',
            signerName: 'Bob Buyer',
            receivedDate: '2026-01-02',
            channel: 'secure-portal',
          },
          {
            partyRole: 'seller',
            signerName: 'Sam Seller',
            receivedDate: '2026-01-02',
            channel: 'secure-portal',
          },
        ],
      },
    ],
    wireInstructions: {
      beneficiaryName: 'Seller Inc',
      bankName: 'Bank',
      routingNumber: '000',
      accountNumber: '111',
      reference: 'ref',
    },
    ...overrides,
  };
}

function pass(results: ReturnType<typeof evaluateChecklist>, id: string) {
  return results.find((r) => r.id === id)!.passed;
}

describe('evaluateChecklist', () => {
  it('all six checks pass for a ready-to-fund escrow', () => {
    const results = evaluateChecklist(readyEscrow(), true, AS_OF);
    expect(results).toHaveLength(6);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it('date check fails when the release date is in the future', () => {
    const escrow = readyEscrow({
      releaseSchedule: [{ releaseDate: '2027-04-08', label: 'Final Release' }],
    });
    const results = evaluateChecklist(escrow, true, AS_OF);
    expect(pass(results, 'date')).toBe(false);
  });

  it('claims check fails when an open claim exists', () => {
    const escrow = readyEscrow({
      claims: [
        {
          id: 'c1',
          description: 'Indemnity claim',
          filedDate: '2026-02-01',
          claimedAmountCents: 5000000,
          status: 'open',
        },
      ],
    });
    const results = evaluateChecklist(escrow, true, AS_OF);
    expect(pass(results, 'claims')).toBe(false);
  });

  it('instructions check fails when the seller instruction is missing', () => {
    const base = readyEscrow();
    const release: Release = {
      ...base.releases[0],
      instructionReceipts: base.releases[0].instructionReceipts.filter(
        (r) => r.partyRole !== 'seller',
      ),
    };
    const escrow = readyEscrow({ releases: [release] });
    const results = evaluateChecklist(escrow, true, AS_OF);
    expect(pass(results, 'instructions')).toBe(false);
    expect(results.find((r) => r.id === 'instructions')!.detail).toMatch(
      /seller/i,
    );
  });

  it('business-day check fails when isBusinessDay is false', () => {
    const results = evaluateChecklist(readyEscrow(), false, AS_OF);
    expect(pass(results, 'business-day')).toBe(false);
  });

  it('amount check fails when the balance is fully reserved', () => {
    const escrow = readyEscrow({
      currentBalanceCents: 50000000,
      claims: [
        {
          id: 'c1',
          description: 'Full claim',
          filedDate: '2026-02-01',
          claimedAmountCents: 50000000,
          status: 'open',
        },
      ],
    });
    const results = evaluateChecklist(escrow, true, AS_OF);
    expect(pass(results, 'amount')).toBe(false);
  });

  it('no-duplicate check fails when a wire-pending release exists', () => {
    const base = readyEscrow();
    const release: Release = { ...base.releases[0], status: 'wire-pending' };
    const escrow = readyEscrow({ releases: [release] });
    const results = evaluateChecklist(escrow, true, AS_OF);
    expect(pass(results, 'no-duplicate')).toBe(false);
  });
});
