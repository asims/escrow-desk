import type { Dispatch } from 'react';
import type { Action } from './EscrowContext';
import type { CoreLedgerGateway } from '../lib/coreLedger';
import type { Escrow, Release } from '../types';
import { computeReleasableAmount } from '../lib/balance';
import { nextBusinessDay } from '../lib/businessDay';
import { toIsoDate } from '../lib/dates';

/**
 * Approve a prepared release: post the double-entry to the core ledger via the
 * gateway, then dispatch success or failure.
 *
 * The reducer stays pure and synchronous — the I/O (gateway call) lives here.
 * The releaseId is used as the idempotency key, so an approval can never post
 * twice. The value date is computed by advancing the approval date to the next
 * valid business day using the holiday list already fetched by useBusinessDay.
 */
export async function approveRelease(
  dispatch: Dispatch<Action>,
  gateway: CoreLedgerGateway,
  escrow: Escrow,
  release: Release,
  approvalDate: Date,
  holidays: string[],
): Promise<void> {
  const valueDate = toIsoDate(nextBusinessDay(approvalDate, holidays));
  const approvedAt = approvalDate.toISOString();

  dispatch({
    type: 'RELEASE_WIRE_SUBMITTING',
    escrowId: escrow.id,
    releaseId: release.id,
  });

  const result = await gateway.postRelease({
    releaseId: release.id, // idempotency key — no double post
    escrowId: escrow.id,
    amountCents: release.amountCents,
    valueDate,
    debitEntry: {
      accountRef: `ESCROW-${escrow.id}`,
      description: 'Escrow disbursement debit',
    },
    creditEntry: {
      accountRef: escrow.wireInstructions.accountNumber,
      description: 'Beneficiary credit',
    },
    reference: escrow.wireInstructions.reference,
  });

  if (result.success && result.confirmationRef) {
    const breakdown = computeReleasableAmount(escrow, approvalDate);
    dispatch({
      type: 'RELEASE_WIRE_SUBMITTED',
      escrowId: escrow.id,
      releaseId: release.id,
      confirmationRef: result.confirmationRef,
      valueDate,
      approvedAt,
      snapshotBalanceCents: breakdown.grossBalanceCents,
      snapshotClaimReserveCents: breakdown.effectiveClaimReserveCents,
      snapshotFeesCents: breakdown.accruedFeesCents,
      snapshotReleasableCents: breakdown.netReleasableCents,
    });
  } else {
    dispatch({
      type: 'RELEASE_WIRE_FAILED',
      escrowId: escrow.id,
      releaseId: release.id,
      error: result.error ?? 'Core ledger post failed',
    });
  }
}
