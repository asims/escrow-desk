import type { LedgerEntry } from '../types';

/**
 * Append a ledger entry to an append-only ledger.
 *
 * Returns a NEW array (never mutates the input). The running balance is derived
 * from the prior tail's running balance plus this entry's amount (positive =
 * credit, negative = debit). A stable, deterministic id is generated from the
 * entry type and the new array index — no Date.now()/random, so results are
 * reproducible and testable.
 */
export function appendEntry(
  ledger: LedgerEntry[],
  entry: Omit<LedgerEntry, 'id' | 'runningBalanceCents'>,
): LedgerEntry[] {
  const priorBalance =
    ledger.length > 0 ? ledger[ledger.length - 1].runningBalanceCents : 0;
  const runningBalanceCents = priorBalance + entry.amountCents;
  const newEntry: LedgerEntry = {
    ...entry,
    id: `${entry.type}-${ledger.length}`,
    runningBalanceCents,
  };
  return [...ledger, newEntry];
}
