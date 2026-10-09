import type { Escrow } from '../types';
import { openClaimCount } from './escrowView';

export type FilterKey =
  | 'all'
  | 'active'
  | 'pending-approval'
  | 'open-claims'
  | 'wire-pending'
  | 'closed';

export interface EscrowFilter {
  key: FilterKey;
  label: string;
  /** Predicate deciding whether an escrow belongs to this filter. */
  match: (escrow: Escrow) => boolean;
}

/**
 * Shared filter definitions used by both the dashboard and the escrow list so
 * each predicate is defined exactly once.
 *
 * Note: 'open-claims' is a derived CONDITION (an escrow has one or more open or
 * disputed claims), not a lifecycle status. Lifecycle status lives on
 * EscrowStatus; this condition is orthogonal to it.
 */
export const ESCROW_FILTERS: EscrowFilter[] = [
  { key: 'all', label: 'All', match: () => true },
  {
    key: 'active',
    label: 'Active',
    match: (e) => e.status === 'active' || e.status === 'pending-approval',
  },
  {
    key: 'pending-approval',
    label: 'Pending Approval',
    match: (e) => e.status === 'pending-approval',
  },
  {
    key: 'open-claims',
    label: 'Open Claims',
    match: (e) => openClaimCount(e) > 0,
  },
  {
    key: 'wire-pending',
    label: 'Pending Wire',
    match: (e) => e.status === 'wire-pending',
  },
  { key: 'closed', label: 'Closed', match: (e) => e.status === 'closed' },
];

export function getFilter(key: FilterKey): EscrowFilter {
  return ESCROW_FILTERS.find((f) => f.key === key)!;
}
