import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEscrow } from '../../store/EscrowContext';
import { REFERENCE_DATE } from '../../data/seed';
import type { Escrow } from '../../types';
import { computeReleasableAmount } from '../../lib/balance';
import { governingReleaseDate } from '../../lib/escrowView';
import { MoneyAmount } from '../shared/MoneyAmount';
import { StatusBadge } from '../shared/StatusBadge';

const ASOF = REFERENCE_DATE;

type Filter = 'all' | 'active' | 'wire-pending' | 'closed';

const FILTERS: { key: Filter; label: string; match: (e: Escrow) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  {
    key: 'active',
    label: 'Active',
    match: (e) => e.status === 'active' || e.status === 'pending-approval',
  },
  {
    key: 'wire-pending',
    label: 'Pending Wire',
    match: (e) => e.status === 'wire-pending',
  },
  { key: 'closed', label: 'Closed', match: (e) => e.status === 'closed' },
];

export function EscrowList() {
  const { store } = useEscrow();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');

  const active = FILTERS.find((f) => f.key === filter)!;
  const rows = store.escrows.filter(active.match);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">All Escrows</h1>
          <p className="text-sm text-gray-500">
            Every escrow on the desk, regardless of status.
          </p>
        </div>
        <div className="flex border border-gray-300">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={[
                'border-r border-gray-300 px-3 py-1.5 text-sm last:border-r-0',
                filter === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-gray-200 bg-white">
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
            {rows.map((e) => {
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                  No escrows match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
