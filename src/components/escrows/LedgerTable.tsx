import type { Escrow, LedgerEntryType } from '../../types';
import { MoneyAmount } from '../shared/MoneyAmount';

const TYPE_LABELS: Record<LedgerEntryType, string> = {
  'initial-deposit': 'Initial Deposit',
  'claim-reserve': 'Claim Reserve',
  'claim-release': 'Claim Release',
  'partial-disbursement': 'Partial Disbursement',
  'final-disbursement': 'Final Disbursement',
  'interest-credit': 'Interest Credit',
  'annual-fee-debit': 'Annual Fee',
  'wire-fee-debit': 'Wire Fee',
  'release-prepared': 'Release Prepared',
  'release-approved': 'Release Approved',
  'release-confirmed': 'Release Confirmed',
};

function formatTimestamp(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z').replace('Z', ' UTC');
}

/**
 * Read-only, append-only ledger. Newest entries first; no edit/delete controls.
 */
export function LedgerTable({ escrow }: { escrow: Escrow }) {
  const rows = [...escrow.ledger].reverse();

  return (
    <div className="border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Append-only ledger — entries are never edited or removed.
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
            <th className="px-3 py-2 font-medium">Timestamp</th>
            <th className="px-3 py-2 font-medium">Entry Type</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
            <th className="px-3 py-2 text-right font-medium">Running Balance</th>
            <th className="px-3 py-2 font-medium">Actor</th>
            <th className="px-3 py-2 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => {
            const isDebit = entry.amountCents < 0;
            const isCredit = entry.amountCents > 0;
            return (
              <tr key={entry.id} className="border-b border-gray-100">
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                  {formatTimestamp(entry.timestamp)}
                </td>
                <td className="px-3 py-2 text-gray-900">
                  {TYPE_LABELS[entry.type]}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    isDebit
                      ? 'text-red-600'
                      : isCredit
                        ? 'text-green-700'
                        : 'text-gray-400'
                  }`}
                >
                  {entry.amountCents === 0 ? (
                    '—'
                  ) : (
                    <MoneyAmount cents={entry.amountCents} />
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                  <MoneyAmount cents={entry.runningBalanceCents} />
                </td>
                <td className="px-3 py-2 text-xs capitalize text-gray-600">
                  {entry.actorRole}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {entry.note ?? ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
