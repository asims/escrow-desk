import { useState } from 'react';
import { useEscrow } from '../../store/EscrowContext';
import { REFERENCE_DATE } from '../../data/seed';
import type { Escrow } from '../../types';
import { daysUntil, governingReleaseDate } from '../../lib/escrowView';
import { getFilter, type FilterKey } from '../../lib/escrowFilters';
import { EscrowFilterBar } from '../shared/EscrowFilterBar';
import { EscrowTable } from '../shared/EscrowTable';

const ASOF = REFERENCE_DATE;

interface Bucket {
  key: string;
  title: string;
  description: string;
  escrows: Escrow[];
}

function buildUrgencyBuckets(escrows: Escrow[]): {
  overdue: Bucket;
  within7: Bucket;
  within30: Bucket;
} {
  const dueTodayOrOverdue: Escrow[] = [];
  const dueWithin7: Escrow[] = [];
  const dueWithin30: Escrow[] = [];

  for (const e of escrows) {
    if (e.status === 'closed') continue;
    const rd = governingReleaseDate(e, ASOF);
    if (!rd) continue;
    const days = daysUntil(rd, ASOF);
    if (days <= 0) dueTodayOrOverdue.push(e);
    else if (days <= 7) dueWithin7.push(e);
    else if (days <= 30) dueWithin30.push(e);
  }

  return {
    overdue: {
      key: 'overdue',
      title: 'Due Today or Overdue',
      description: 'Release date reached — ready to work',
      escrows: dueTodayOrOverdue,
    },
    within7: {
      key: 'within7',
      title: 'Due Within 7 Days',
      description: 'Upcoming releases this week (1–7 days)',
      escrows: dueWithin7,
    },
    within30: {
      key: 'within30',
      title: 'Due Within 30 Days',
      description: 'On the horizon this month (8–30 days)',
      escrows: dueWithin30,
    },
  };
}

function BucketSection({ bucket }: { bucket: Bucket }) {
  return (
    <section className="border border-gray-200 bg-white">
      <div className="flex items-baseline justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-900">
          {bucket.title}
          <span className="ml-2 text-xs font-normal text-gray-500">
            {bucket.escrows.length}
          </span>
        </h2>
        <span className="text-xs text-gray-500">{bucket.description}</span>
      </div>
      <EscrowTable escrows={bucket.escrows} asOf={ASOF} />
    </section>
  );
}

export function Dashboard() {
  const { store } = useEscrow();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [show30, setShow30] = useState(false);

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Morning Dashboard</h1>
        <p className="text-sm text-gray-500">
          Escrows needing attention, grouped by urgency.
        </p>
      </div>
      <EscrowFilterBar value={filter} onChange={setFilter} />
    </div>
  );

  // Any non-'All' filter collapses to a flat sorted table of matches.
  if (filter !== 'all') {
    const matched = store.escrows.filter(getFilter(filter).match);
    return (
      <div className="space-y-4">
        {header}
        <div className="border border-gray-200 bg-white">
          <EscrowTable escrows={matched} asOf={ASOF} />
        </div>
      </div>
    );
  }

  // Default ('All'): urgency grouping.
  const buckets = buildUrgencyBuckets(store.escrows);
  const defaultBuckets = [buckets.overdue, buckets.within7].filter(
    (b) => b.escrows.length > 0,
  );
  const horizonCount = buckets.within30.escrows.length;

  return (
    <div className="space-y-6">
      {header}

      {defaultBuckets.map((bucket) => (
        <BucketSection key={bucket.key} bucket={bucket} />
      ))}

      <div className="space-y-6">
        <button
          type="button"
          disabled={horizonCount === 0}
          onClick={() => setShow30((v) => !v)}
          className={[
            'border px-3 py-1.5 text-sm',
            horizonCount === 0
              ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100',
          ].join(' ')}
        >
          {horizonCount === 0
            ? 'No releases in the 30-day horizon'
            : show30
              ? 'Hide 30-day horizon'
              : `Show 30-day horizon (${horizonCount})`}
        </button>

        {show30 && horizonCount > 0 && (
          <BucketSection bucket={buckets.within30} />
        )}
      </div>
    </div>
  );
}
