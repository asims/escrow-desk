import { useState } from 'react';
import type { SortDirection, SortKey } from './sortEscrows';

/**
 * Local sort state for an escrow grid. Clicking the active column toggles
 * direction; clicking a new column sorts it ascending.
 */
export function useSortState(initialKey: SortKey, initialDirection: SortDirection = 'asc') {
  const [key, setKey] = useState<SortKey>(initialKey);
  const [direction, setDirection] = useState<SortDirection>(initialDirection);

  function onSort(nextKey: SortKey) {
    if (nextKey === key) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setKey(nextKey);
      setDirection('asc');
    }
  }

  return { key, direction, onSort };
}
