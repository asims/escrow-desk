import { ESCROW_FILTERS, type FilterKey } from '../../lib/escrowFilters';

interface EscrowFilterBarProps {
  value: FilterKey;
  onChange: (key: FilterKey) => void;
}

/**
 * Segmented control of escrow filters, shared by the dashboard and the escrow
 * list. The filter predicates themselves live in lib/escrowFilters.
 */
export function EscrowFilterBar({ value, onChange }: EscrowFilterBarProps) {
  return (
    <div className="flex border border-gray-300">
      {ESCROW_FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          className={[
            'border-r border-gray-300 px-3 py-1.5 text-sm last:border-r-0',
            value === f.key
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100',
          ].join(' ')}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
