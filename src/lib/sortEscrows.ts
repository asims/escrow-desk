import type { Escrow, EscrowStatus } from '../types';
import { computeReleasableAmount } from './balance';
import { governingReleaseDate } from './escrowView';

export type SortKey = 'name' | 'balance' | 'releasable' | 'releaseDate' | 'status';
export type SortDirection = 'asc' | 'desc';

// Order statuses by operational urgency so a status sort is meaningful.
const STATUS_ORDER: Record<EscrowStatus, number> = {
  'pending-approval': 0,
  'wire-pending': 1,
  active: 2,
  closed: 3,
};

/**
 * Return a new array of escrows sorted by the given key and direction.
 * Never mutates the input array.
 *
 * Release dates are compared chronologically; escrows with no governing
 * release date (null) always sort to the bottom, regardless of direction.
 */
export function sortEscrows(
  escrows: Escrow[],
  key: SortKey,
  direction: SortDirection,
  asOf: Date,
): Escrow[] {
  const factor = direction === 'asc' ? 1 : -1;

  return [...escrows].sort((a, b) => {
    if (key === 'releaseDate') {
      const ra = governingReleaseDate(a, asOf);
      const rb = governingReleaseDate(b, asOf);
      // Null release dates always sort last in both directions.
      if (ra === null && rb === null) return 0;
      if (ra === null) return 1;
      if (rb === null) return -1;
      return factor * ra.localeCompare(rb);
    }

    if (key === 'name') {
      return factor * a.name.localeCompare(b.name);
    }

    if (key === 'balance') {
      return factor * (a.currentBalanceCents - b.currentBalanceCents);
    }

    if (key === 'releasable') {
      const na = computeReleasableAmount(a, asOf).netReleasableCents;
      const nb = computeReleasableAmount(b, asOf).netReleasableCents;
      return factor * (na - nb);
    }

    // status
    return factor * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  });
}
