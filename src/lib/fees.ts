import type { Escrow, Role } from '../types';
import { appendEntry } from './ledger';
import { yearFractionBetween } from './dates';

/**
 * Accrued, unbilled annual admin fee in integer cents. Pro-rated from the last
 * annual-fee-debit entry (or the escrow opening date if none) up to `asOf`,
 * based on a 365-day year. Rounded once at the end.
 */
export function computeAccruedAnnualFee(escrow: Escrow, asOf: Date): number {
  if (escrow.annualAdminFeeCents <= 0) return 0;

  const lastFee = [...escrow.ledger]
    .reverse()
    .find((e) => e.type === 'annual-fee-debit');
  const since = lastFee
    ? new Date(lastFee.timestamp)
    : new Date(escrow.openedDate);

  const years = yearFractionBetween(since, asOf);
  if (years <= 0) return 0;

  return Math.round(escrow.annualAdminFeeCents * years);
}

/**
 * Returns a NEW escrow with a wire-fee-debit ledger entry appended (negative
 * amount) and currentBalanceCents reduced. No mutation.
 */
export function applyWireFee(escrow: Escrow, role: Role, asOf?: Date): Escrow {
  if (escrow.wireFeeCents <= 0) return escrow;

  const timestamp = (asOf ?? new Date(escrow.openedDate)).toISOString();
  const ledger = appendEntry(escrow.ledger, {
    type: 'wire-fee-debit',
    amountCents: -escrow.wireFeeCents,
    timestamp,
    actorRole: role,
    note: 'Per-disbursement wire fee',
  });

  return {
    ...escrow,
    ledger,
    currentBalanceCents: escrow.currentBalanceCents - escrow.wireFeeCents,
  };
}
