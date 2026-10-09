import type { ClaimStatus, EscrowStatus } from '../../types';

const ESCROW_STYLES: Record<EscrowStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-green-50 text-green-700 border-green-200' },
  'pending-approval': {
    label: 'Pending Approval',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  'wire-pending': {
    label: 'Wire Pending',
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  closed: { label: 'Closed', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
};

const CLAIM_STYLES: Record<ClaimStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  disputed: {
    label: 'Disputed',
    cls: 'bg-red-50 text-red-700 border-red-200',
  },
  resolved: {
    label: 'Resolved',
    cls: 'bg-gray-100 text-gray-600 border-gray-300',
  },
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: EscrowStatus }) {
  const s = ESCROW_STYLES[status];
  return <Badge label={s.label} cls={s.cls} />;
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const s = CLAIM_STYLES[status];
  return <Badge label={s.label} cls={s.cls} />;
}
