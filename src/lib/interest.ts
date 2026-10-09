import type { Escrow } from '../types';
import { appendEntry } from './ledger';
import { wholeMonthsBetween } from './dates';

/**
 * Accrued interest in integer cents since the last interest credit (or the
 * escrow opening date if none). Monthly credit = round(balance * rate / 12),
 * multiplied by the number of whole months elapsed. A zero rate yields 0.
 */
export function computeAccruedInterest(escrow: Escrow, asOf: Date): number {
  if (escrow.annualInterestRate <= 0) return 0;

  const lastCredit = [...escrow.ledger]
    .reverse()
    .find((e) => e.type === 'interest-credit');
  const since = lastCredit
    ? new Date(lastCredit.timestamp)
    : new Date(escrow.openedDate);

  const months = wholeMonthsBetween(since, asOf);
  if (months <= 0) return 0;

  const monthlyCents = Math.round(
    (escrow.currentBalanceCents * escrow.annualInterestRate) / 12,
  );
  return monthlyCents * months;
}

/**
 * Returns a NEW escrow with an interest-credit ledger entry appended and
 * currentBalanceCents increased. No mutation. If no interest is accrued, the
 * escrow is returned unchanged.
 */
export function applyMonthlyInterest(escrow: Escrow, asOf: Date): Escrow {
  const interestCents = computeAccruedInterest(escrow, asOf);
  if (interestCents <= 0) return escrow;

  const ledger = appendEntry(escrow.ledger, {
    type: 'interest-credit',
    amountCents: interestCents,
    timestamp: asOf.toISOString(),
    actorRole: 'officer',
    note: `Interest credit (${(escrow.annualInterestRate * 100).toFixed(2)}% annual) to ${escrow.interestBeneficiary}`,
  });

  return {
    ...escrow,
    ledger,
    currentBalanceCents: escrow.currentBalanceCents + interestCents,
  };
}
