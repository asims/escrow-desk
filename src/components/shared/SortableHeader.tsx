import type { SortDirection, SortKey } from '../../lib/sortEscrows';

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}

/**
 * A clickable table header cell that drives escrow sorting. Shows a caret on
 * the currently active column (▲ ascending / ▼ descending).
 */
export function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'left',
}: SortableHeaderProps) {
  const isActive = activeKey === sortKey;
  const caret = isActive ? (direction === 'asc' ? '▲' : '▼') : '';
  return (
    <th
      className={[
        'px-3 py-2 font-medium',
        align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={[
          'inline-flex items-center gap-1 hover:text-gray-900',
          align === 'right' ? 'flex-row-reverse' : '',
          isActive ? 'text-gray-900' : '',
        ].join(' ')}
      >
        <span>{label}</span>
        {caret && <span className="text-[10px] leading-none">{caret}</span>}
      </button>
    </th>
  );
}
