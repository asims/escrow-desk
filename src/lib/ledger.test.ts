import { describe, it, expect } from 'vitest';
import { appendEntry } from './ledger';
import type { LedgerEntry } from '../types';

describe('appendEntry', () => {
  it('first entry on an empty ledger has runningBalance equal to its amount', () => {
    const result = appendEntry([], {
      type: 'initial-deposit',
      amountCents: 100000,
      timestamp: '2026-01-01T00:00:00Z',
      actorRole: 'officer',
    });
    expect(result).toHaveLength(1);
    expect(result[0].runningBalanceCents).toBe(100000);
    expect(result[0].id).toBe('initial-deposit-0');
  });

  it('accumulates running balance across multiple entries', () => {
    let ledger: LedgerEntry[] = [];
    ledger = appendEntry(ledger, {
      type: 'initial-deposit',
      amountCents: 100000,
      timestamp: '2026-01-01T00:00:00Z',
      actorRole: 'officer',
    });
    ledger = appendEntry(ledger, {
      type: 'interest-credit',
      amountCents: 500,
      timestamp: '2026-02-01T00:00:00Z',
      actorRole: 'officer',
    });
    ledger = appendEntry(ledger, {
      type: 'wire-fee-debit',
      amountCents: -2500,
      timestamp: '2026-03-01T00:00:00Z',
      actorRole: 'officer',
    });
    expect(ledger.map((e) => e.runningBalanceCents)).toEqual([
      100000, 100500, 98000,
    ]);
  });

  it('does not mutate the original array', () => {
    const original: LedgerEntry[] = [];
    const result = appendEntry(original, {
      type: 'initial-deposit',
      amountCents: 100000,
      timestamp: '2026-01-01T00:00:00Z',
      actorRole: 'officer',
    });
    expect(original).toHaveLength(0);
    expect(result).not.toBe(original);
  });
});
