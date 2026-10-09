import type { Escrow } from '../types';
import { computeAccruedAnnualFee } from './fees';

export interface ReleasableAmountBreakdown {
  grossBalanceCents: number;
  effectiveClaimReserveCents: number; // sum of min(claim, remaining) for open/disputed
  accruedFeesCents: number; // unbilled annual fee portion + wire fee
  netReleasableCents: number;
}

/**
 * Compute what can be released right now, itemized so the UI can show the
 * officer exactly how the net was derived.
 *
 * - effectiveClaimReserveCents: open and disputed claims each reserve
 *   min(claimedAmount, remainingBalance), applied sequentially so total
 *   reserves never exceed the balance.
 * - accruedFeesCents: pro-rated unbilled annual fee + the per-disbursement
 *   wire fee that will be charged on release.
 * - netReleasableCents: max(0, gross - reserve - fees).
 */
export function computeReleasableAmount(
  escrow: Escrow,
  asOf: Date,
): ReleasableAmountBreakdown {
  const grossBalanceCents = escrow.currentBalanceCents;

  let remaining = grossBalanceCents;
  let effectiveClaimReserveCents = 0;
  for (const claim of escrow.claims) {
    if (claim.status !== 'open' && claim.status !== 'disputed') continue;
    const reserve = Math.min(claim.claimedAmountCents, remaining);
    effectiveClaimReserveCents += reserve;
    remaining -= reserve;
    if (remaining <= 0) break;
  }

  const accruedFeesCents =
    computeAccruedAnnualFee(escrow, asOf) + escrow.wireFeeCents;

  const netReleasableCents = Math.max(
    0,
    grossBalanceCents - effectiveClaimReserveCents - accruedFeesCents,
  );

  return {
    grossBalanceCents,
    effectiveClaimReserveCents,
    accruedFeesCents,
    netReleasableCents,
  };
}
