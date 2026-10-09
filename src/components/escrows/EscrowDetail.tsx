import type { Escrow } from '../../types';

export function EscrowDetail({ escrow }: { escrow: Escrow }) {
  return (
    <div className="text-sm text-gray-500">
      Detail for {escrow.name} — coming in Phase 5.
    </div>
  );
}
