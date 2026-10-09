import { useState } from 'react';
import { useEscrow } from '../../store/EscrowContext';
import { REFERENCE_DATE } from '../../data/seed';
import { getFilter, type FilterKey } from '../../lib/escrowFilters';
import { EscrowFilterBar } from '../shared/EscrowFilterBar';
import { EscrowTable } from '../shared/EscrowTable';

const ASOF = REFERENCE_DATE;

export function EscrowList() {
  const { store } = useEscrow();
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = store.escrows.filter(getFilter(filter).match);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">All Escrows</h1>
          <p className="text-sm text-gray-500">
            Every escrow on the desk, regardless of status.
          </p>
        </div>
        <EscrowFilterBar value={filter} onChange={setFilter} />
      </div>

      <div className="border border-gray-200 bg-white">
        <EscrowTable escrows={filtered} asOf={ASOF} />
      </div>
    </div>
  );
}
