import { useNavigate } from 'react-router-dom';
import type { Escrow } from '../../types';
import { computeReleasableAmount } from '../../lib/balance';
import { governingReleaseDate } from '../../lib/escrowView';
import { sortEscrows } from '../../lib/sortEscrows';
import { useSortState } from '../../lib/useSortState';
import { MoneyAmount } from './MoneyAmount';
import { StatusBadge } from './StatusBadge';
import { SortableHeader } from './SortableHeader';

interface EscrowTableProps {
  escrows: Escrow[];
  asOf: Date;
  emptyMessage?: string;
}

/**
 * Sortable escrow grid shared by the escrow list and the dashboard's flat
 * (filtered) view. Owns its own sort state, defaulting to soonest/overdue
 * release date first. Clicking a row navigates to the escrow detail.
 */
export function EscrowTable({
  escrows,
  asOf,
  emptyMessage = 'No escrows match this filter.',
}: EscrowTableProps) {
  const navigate = useNavigate();
  // Default sort: soonest/overdue release date first.
  const sort = useSortState('releaseDate', 'asc');
  const rows = sortEscrows(escrows, sort.key, sort.direction, asOf);

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
          <SortableHeader
            label="Escrow"
            sortKey="name"
            activeKey={sort.key}
            direction={sort.direction}
            onSort={sort.onSort}
          />
          <th className="px-3 py-2 font-medium">Parties</th>
          <SortableHeader
            label="Balance"
            sortKey="balance"
            activeKey={sort.key}
            direction={sort.direction}
            onSort={sort.onSort}
            align="right"
          />
          <SortableHeader
            label="Releasable"
            sortKey="releasable"
            activeKey={sort.key}
            direction={sort.direction}
            onSort={sort.onSort}
            align="right"
          />
          <SortableHeader
            label="Release Date"
            sortKey="releaseDate"
            activeKey={sort.key}
            direction={sort.direction}
            onSort={sort.onSort}
          />
          <SortableHeader
            label="Status"
            sortKey="status"
            activeKey={sort.key}
            direction={sort.direction}
            onSort={sort.onSort}
          />
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => {
          const breakdown = computeReleasableAmount(e, asOf);
          const rd = governingReleaseDate(e, asOf);
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
              {emptyMessage}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
