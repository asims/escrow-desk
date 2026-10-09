import type { Escrow } from '../types';
import { computeReleasableAmount } from './balance';
import { toIsoDate } from './dates';

export interface ChecklistResult {
  id: 'date' | 'claims' | 'instructions' | 'business-day' | 'amount' | 'no-duplicate';
  label: string;
  passed: boolean;
  detail: string; // Human-readable explanation; populated whether pass or fail
}

/** USD formatting for checklist detail strings (cents -> $X,XXX.XX). */
function fmt(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function nextScheduledRelease(escrow: Escrow) {
  // The earliest schedule entry on/after today governs the "date reached" check;
  // if all are in the past, use the latest.
  const sorted = [...escrow.releaseSchedule].sort((a, b) =>
    a.releaseDate.localeCompare(b.releaseDate),
  );
  return sorted[sorted.length - 1];
}

/**
 * Pure "safe to fund" checklist. The UI renders exactly what this returns —
 * no release logic lives in the component. `isBusinessDay` is passed in (the
 * checklist never calls the holiday API itself, keeping this testable without
 * a DOM).
 */
export function evaluateChecklist(
  escrow: Escrow,
  isBusinessDay: boolean,
  asOf: Date,
): ChecklistResult[] {
  const results: ChecklistResult[] = [];

  // 1. Release date reached
  const schedule = nextScheduledRelease(escrow);
  const releaseDateReached =
    !!schedule && new Date(schedule.releaseDate) <= asOf;
  results.push({
    id: 'date',
    label: 'Scheduled release date reached',
    passed: releaseDateReached,
    detail: schedule
      ? releaseDateReached
        ? `Release date ${schedule.releaseDate} has passed.`
        : `Release date ${schedule.releaseDate} is in the future.`
      : 'No release scheduled.',
  });

  // 2. No open/disputed claims reserving funds
  const breakdown = computeReleasableAmount(escrow, asOf);
  const openClaims = escrow.claims.filter(
    (c) => c.status === 'open' || c.status === 'disputed',
  );
  const noClaims = openClaims.length === 0;
  results.push({
    id: 'claims',
    label: 'No open claims against the balance',
    passed: noClaims,
    detail: noClaims
      ? 'No open or disputed claims.'
      : `${openClaims.length} open/disputed claim(s) reserving ${fmt(
          breakdown.effectiveClaimReserveCents,
        )}.`,
  });

  // 3. Joint instructions received from both parties, each from a valid signer
  const latestRelease = escrow.releases[escrow.releases.length - 1];
  const receipts = latestRelease?.instructionReceipts ?? [];
  const buyerSignerNames = new Set(escrow.buyer.signers.map((s) => s.name));
  const sellerSignerNames = new Set(escrow.seller.signers.map((s) => s.name));
  const buyerReceipt = receipts.find(
    (r) => r.partyRole === 'buyer' && buyerSignerNames.has(r.signerName),
  );
  const sellerReceipt = receipts.find(
    (r) => r.partyRole === 'seller' && sellerSignerNames.has(r.signerName),
  );
  const bothInstructions = !!buyerReceipt && !!sellerReceipt;
  let instructionDetail: string;
  if (bothInstructions) {
    instructionDetail = 'Joint written instruction on file from both parties.';
  } else if (!buyerReceipt && !sellerReceipt) {
    instructionDetail = 'No joint instruction received from either party.';
  } else if (!buyerReceipt) {
    instructionDetail = 'Missing authorized instruction from the buyer.';
  } else {
    instructionDetail = 'Missing authorized instruction from the seller.';
  }
  results.push({
    id: 'instructions',
    label: 'Joint written instruction received',
    passed: bothInstructions,
    detail: instructionDetail,
  });

  // 4. Business day
  results.push({
    id: 'business-day',
    label: 'Today is a valid wire business day',
    passed: isBusinessDay,
    detail: isBusinessDay
      ? `${toIsoDate(asOf)} is a valid business day.`
      : `${toIsoDate(asOf)} is a federal holiday or weekend — wires cannot settle.`,
  });

  // 5. Release amount is correct / positive
  const expected = schedule?.expectedAmountCents;
  let amountPassed: boolean;
  let amountDetail: string;
  if (expected != null) {
    amountPassed = breakdown.netReleasableCents >= expected;
    amountDetail = amountPassed
      ? `Net releasable ${fmt(breakdown.netReleasableCents)} covers the expected ${fmt(expected)}.`
      : `Net releasable ${fmt(breakdown.netReleasableCents)} is below the expected ${fmt(expected)}.`;
  } else {
    amountPassed = breakdown.netReleasableCents > 0;
    amountDetail = amountPassed
      ? `Net releasable amount is ${fmt(breakdown.netReleasableCents)}.`
      : 'Net releasable amount is $0.00.';
  }
  results.push({
    id: 'amount',
    label: 'Release amount is correct',
    passed: amountPassed,
    detail: amountDetail,
  });

  // 6. No prior release pending or submitted
  const hasActiveRelease = escrow.releases.some(
    (r) => r.status === 'pending-approval' || r.status === 'wire-pending' || r.status === 'submitting',
  );
  results.push({
    id: 'no-duplicate',
    label: 'No release already in progress',
    passed: !hasActiveRelease,
    detail: hasActiveRelease
      ? 'A release is already pending approval or awaiting wire confirmation.'
      : 'No release currently in progress.',
  });

  return results;
}
