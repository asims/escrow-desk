import { useNavigate } from 'react-router-dom';
import { useEscrow } from '../../store/EscrowContext';
import { REFERENCE_DATE } from '../../data/seed';
import type { Escrow } from '../../types';
import { computeReleasableAmount } from '../../lib/balance';
import {
  daysUntil,
  governingReleaseDate,
  openClaimCount,
} from '../../lib/escrowView';
import { MoneyAmount } from '../shared/MoneyAmount';
import { StatusBadge } from '../shared/StatusBadge';

const ASOF = REFERENCE_DATE;

interface Bucket {
  key: string;
  title: string;
  description: string;
  escrows: Escrow[];
}

function buildBuckets(escrows: Escrow[]): Bucket[] {
  const dueTodayOrOverdue: Escrow[] = [];
  const dueWithin7: Escrow[] = [];
  const dueWithin30: Escrow[] = [];
  const openClaims: Escrow[] = [];
  const pendingApproval: Escrow[] = [];

  for (const e of escrows) {
    if (e.status === 'pending-approval') pendingApproval.push(e);
    if (openClaimCount(e) > 0) openClaims.push(e);

    if (e.status === 'closed') continue;
    const rd = governingReleaseDate(e, ASOF);
    if (!rd) continue;
    const days = daysUntil(rd, ASOF);
    if (days <= 0) dueTodayOrOverdue.push(e);
    else if (days <= 7) dueWithin7.push(e);
    else if (days <= 30) dueWithin30.push(e);
  }

  return [
    {
      key: 'overdue',
      title: 'Due Today or Overdue',
      description: 'Release date reached — ready to work',
      escrows: dueTodayOrOverdue,
    },
    {
      key: 'pending',
      title: 'Pending Supervisor Approval',
      description: 'Prepared releases awaiting a second approver',
      escrows: pendingApproval,
    },
    {
      key: 'claims',
      title: 'Open Claims',
      description: 'Funds reserved against open or disputed claims',
      escrows: openClaims,
    },
    {
      key: 'within7',
      title: 'Due Within 7 Days',
      description: 'Upcoming releases this week',
      escrows: dueWithin7,
    },
    {
      key: 'within30',
      title: 'Due Within 30 Days',
      description: 'On the horizon this month',
      escrows: dueWithin30,
    },
  ];
}

function EscrowRows({ escrows }: { escrows: Escrow[] }) {
  const navigate = useNavigate();
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
          <th className="px-3 py-2 font-medium">Escrow</th>
          <th className="px-3 py-2 font-medium">Parties</th>
          <th className="px-3 py-2 text-right font-medium">Balance</th>
          <th className="px-3 py-2 text-right font-medium">Releasable</th>
          <th className="px-3 py-2 font-medium">Release Date</th>
          <th className="px-3 py-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {escrows.map((e) => {
          const breakdown = computeReleasableAmount(e, ASOF);
          const rd = governingReleaseDate(e, ASOF);
          return (
            <tr
              key={e.id}
              onClick={() => navigate(`/escrows/${e.id}`)}
              className="cursor-pointer border-b border-gray-100 hover:bg-blue-50/40"
            >
              <td className="px-3 py-2">
                <div className="font-medium text-gray-900">{e.name}</div>
                <div className="text-xs text-gray-500">{e.id}</div>
              </td>
              <td className="px-3 py-2 text-gray-700">
                <div>{e.buyer.name}</div>
                <div className="text-xs text-gray-500">{e.seller.name}</div>
              </td>
              <td className="px-3 py-2 text-right text-gray-900">
                <MoneyAmount cents={e.currentBalanceCents} />
              </td>
              <td className="px-3 py-2 text-right text-gray-900">
                <MoneyAmount cents={breakdown.netReleasableCents} />
              </td>
              <td className="px-3 py-2 text-gray-700">{rd ?? '—'}</td>
              <td className="px-3 py-2">
                <StatusBadge status={e.status} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Dashboard() {
  const { store } = useEscrow();
  const buckets = buildBuckets(store.escrows).filter(
    (b) => b.escrows.length > 0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Morning Dashboard</h1>
        <p className="text-sm text-gray-500">
          Escrows needing attention, grouped by urgency.
        </p>
      </div>

      {buckets.map((bucket) => (
        <section
          key={bucket.key}
          className="border border-gray-200 bg-white"
        >
          <div className="flex items-baseline justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
            <h2 className="text-sm font-semibold text-gray-900">
              {bucket.title}
              <span className="ml-2 text-xs font-normal text-gray-500">
                {bucket.escrows.length}
              </span>
            </h2>
            <span className="text-xs text-gray-500">{bucket.description}</span>
          </div>
          <EscrowRows escrows={bucket.escrows} />
        </section>
      ))}
    </div>
  );
}
