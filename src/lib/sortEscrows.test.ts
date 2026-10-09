import { describe, it, expect } from 'vitest';
import { sortEscrows } from './sortEscrows';
import type { Escrow, EscrowStatus, ReleaseSchedule } from '../types';

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

function schedule(releaseDate: string): ReleaseSchedule[] {
  return [{ releaseDate, label: 'Release' }];
}

const AS_OF = new Date('2026-10-08T00:00:00Z');

const names = (escrows: Escrow[]) => escrows.map((e) => e.id);

describe('sortEscrows', () => {
  describe('name', () => {
    const a = baseEscrow({ id: 'a', name: 'Alpha' });
    const b = baseEscrow({ id: 'b', name: 'Bravo' });
    const c = baseEscrow({ id: 'c', name: 'Charlie' });

    it('sorts ascending alphabetically', () => {
      expect(names(sortEscrows([c, a, b], 'name', 'asc', AS_OF))).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it('sorts descending alphabetically', () => {
      expect(names(sortEscrows([a, c, b], 'name', 'desc', AS_OF))).toEqual([
        'c',
        'b',
        'a',
      ]);
    });
  });

  describe('balance', () => {
    // Values chosen so lexical ordering would differ from numeric ordering.
    const small = baseEscrow({ id: 'small', currentBalanceCents: 9000 });
    const mid = baseEscrow({ id: 'mid', currentBalanceCents: 100000 });
    const big = baseEscrow({ id: 'big', currentBalanceCents: 2500000 });

    it('sorts ascending numerically (not lexically)', () => {
      expect(names(sortEscrows([big, small, mid], 'balance', 'asc', AS_OF))).toEqual([
        'small',
        'mid',
        'big',
      ]);
    });

    it('sorts descending numerically', () => {
      expect(names(sortEscrows([small, mid, big], 'balance', 'desc', AS_OF))).toEqual([
        'big',
        'mid',
        'small',
      ]);
    });
  });

  describe('releasable', () => {
    // netReleasable = balance here (no claims/fees). Numeric, not lexical.
    const low = baseEscrow({ id: 'low', currentBalanceCents: 9000 });
    const high = baseEscrow({ id: 'high', currentBalanceCents: 1000000 });

    it('sorts ascending numerically', () => {
      expect(names(sortEscrows([high, low], 'releasable', 'asc', AS_OF))).toEqual([
        'low',
        'high',
      ]);
    });

    it('sorts descending numerically', () => {
      expect(names(sortEscrows([low, high], 'releasable', 'desc', AS_OF))).toEqual([
        'high',
        'low',
      ]);
    });
  });

  describe('releaseDate', () => {
    const early = baseEscrow({ id: 'early', releaseSchedule: schedule('2026-11-01') });
    const late = baseEscrow({ id: 'late', releaseSchedule: schedule('2026-12-01') });
    const none = baseEscrow({ id: 'none', releaseSchedule: [] });

    it('sorts ascending chronologically', () => {
      expect(names(sortEscrows([late, early], 'releaseDate', 'asc', AS_OF))).toEqual([
        'early',
        'late',
      ]);
    });

    it('sorts descending chronologically', () => {
      expect(names(sortEscrows([early, late], 'releaseDate', 'desc', AS_OF))).toEqual([
        'late',
        'early',
      ]);
    });

    it('sorts null release dates last when ascending', () => {
      expect(
        names(sortEscrows([none, late, early], 'releaseDate', 'asc', AS_OF)),
      ).toEqual(['early', 'late', 'none']);
    });

    it('sorts null release dates last when descending', () => {
      expect(
        names(sortEscrows([none, early, late], 'releaseDate', 'desc', AS_OF)),
      ).toEqual(['late', 'early', 'none']);
    });
  });

  describe('status', () => {
    const statuses: EscrowStatus[] = [
      'closed',
      'active',
      'wire-pending',
      'pending-approval',
    ];
    const items = statuses.map((s) => baseEscrow({ id: s, status: s }));

    it('sorts ascending by operational urgency', () => {
      expect(names(sortEscrows(items, 'status', 'asc', AS_OF))).toEqual([
        'pending-approval',
        'wire-pending',
        'active',
        'closed',
      ]);
    });

    it('sorts descending by operational urgency', () => {
      expect(names(sortEscrows(items, 'status', 'desc', AS_OF))).toEqual([
        'closed',
        'active',
        'wire-pending',
        'pending-approval',
      ]);
    });
  });

  it('returns a new array and does not mutate the input', () => {
    const a = baseEscrow({ id: 'a', name: 'Alpha' });
    const b = baseEscrow({ id: 'b', name: 'Bravo' });
    const input = [b, a];
    const result = sortEscrows(input, 'name', 'asc', AS_OF);

    expect(result).not.toBe(input);
    expect(names(input)).toEqual(['b', 'a']); // input order unchanged
    expect(names(result)).toEqual(['a', 'b']);
  });
});
