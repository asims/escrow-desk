import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Escrow, Party } from '../../types';
import { REFERENCE_DATE } from '../../data/seed';
import { computeReleasableAmount } from '../../lib/balance';
import { governingReleaseDate, openClaimCount } from '../../lib/escrowView';
import { MoneyAmount } from '../shared/MoneyAmount';
import { StatusBadge } from '../shared/StatusBadge';
import { ClaimsList } from './ClaimsList';
import { LedgerTable } from './LedgerTable';
import { Checklist } from './Checklist';

const ASOF = REFERENCE_DATE;
const TABS = ['Summary', 'Claims', 'Ledger', 'Release'] as const;
type Tab = (typeof TABS)[number];

function SummaryStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{children}</div>
    </div>
  );
}

function PartyBlock({ party }: { party: Party }) {
  return (
    <div className="border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs capitalize text-gray-500">
        {party.role}
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-medium text-gray-900">{party.name}</div>
        <div className="mt-2 text-xs text-gray-500">Authorized signers</div>
        <ul className="mt-1 space-y-1">
          {party.signers.map((s) => (
            <li key={s.id} className="text-sm text-gray-700">
              {s.name}
              <span className="text-xs text-gray-500"> — {s.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SummaryTab({ escrow }: { escrow: Escrow }) {
  const fields: { label: string; value: string }[] = [
    { label: 'Deal', value: escrow.dealName },
    { label: 'Opened', value: escrow.openedDate },
    { label: 'Survival start', value: escrow.survivalPeriodStart },
    { label: 'Survival end', value: escrow.survivalPeriodEnd },
    {
      label: 'Interest rate',
      value:
        escrow.annualInterestRate > 0
          ? `${(escrow.annualInterestRate * 100).toFixed(2)}% to ${escrow.interestBeneficiary}`
          : 'Non-interest-bearing',
    },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-gray-200">
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Deal terms
          </div>
          <dl className="divide-y divide-gray-100 text-sm">
            {fields.map((f) => (
              <div key={f.label} className="flex justify-between px-3 py-2">
                <dt className="text-gray-600">{f.label}</dt>
                <dd className="text-gray-900">{f.value}</dd>
              </div>
            ))}
            <div className="flex justify-between px-3 py-2">
              <dt className="text-gray-600">Annual admin fee</dt>
              <dd className="text-gray-900">
                <MoneyAmount cents={escrow.annualAdminFeeCents} />
              </dd>
            </div>
            <div className="flex justify-between px-3 py-2">
              <dt className="text-gray-600">Wire fee</dt>
              <dd className="text-gray-900">
                <MoneyAmount cents={escrow.wireFeeCents} />
              </dd>
            </div>
          </dl>
        </div>
        <div className="space-y-4">
          <PartyBlock party={escrow.buyer} />
          <PartyBlock party={escrow.seller} />
        </div>
      </div>

      <div className="border border-gray-200">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Release schedule
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="px-3 py-2 font-medium">Tranche</th>
              <th className="px-3 py-2 font-medium">Release date</th>
              <th className="px-3 py-2 text-right font-medium">
                Expected amount
              </th>
            </tr>
          </thead>
          <tbody>
            {escrow.releaseSchedule.map((s) => (
              <tr key={s.label} className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-900">{s.label}</td>
                <td className="px-3 py-2 text-gray-700">{s.releaseDate}</td>
                <td className="px-3 py-2 text-right text-gray-900">
                  {s.expectedAmountCents != null ? (
                    <MoneyAmount cents={s.expectedAmountCents} />
                  ) : (
                    'Remaining balance'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EscrowDetail({ escrow }: { escrow: Escrow }) {
  const [tab, setTab] = useState<Tab>('Summary');
  const breakdown = computeReleasableAmount(escrow, ASOF);
  const releaseDate = governingReleaseDate(escrow, ASOF);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500">
          <Link to="/escrows" className="hover:underline">
            All Escrows
          </Link>{' '}
          / {escrow.id}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">{escrow.name}</h1>
          <StatusBadge status={escrow.status} />
        </div>
        <p className="text-sm text-gray-500">{escrow.dealName}</p>
      </div>

      <div className="grid grid-cols-5 divide-x divide-gray-200 border border-gray-200 bg-white">
        <SummaryStat label="Original amount">
          <MoneyAmount cents={escrow.originalAmountCents} />
        </SummaryStat>
        <SummaryStat label="Current balance">
          <MoneyAmount cents={escrow.currentBalanceCents} />
        </SummaryStat>
        <SummaryStat label="Open claims">{openClaimCount(escrow)}</SummaryStat>
        <SummaryStat label="Releasable">
          <MoneyAmount cents={breakdown.netReleasableCents} />
        </SummaryStat>
        <SummaryStat label="Release date">{releaseDate ?? '—'}</SummaryStat>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                'border-b-2 px-4 py-2 text-sm font-medium',
                tab === t
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900',
              ].join(' ')}
            >
              {t}
              {t === 'Claims' && openClaimCount(escrow) > 0 && (
                <span className="ml-1 bg-orange-100 px-1.5 text-xs text-orange-700">
                  {openClaimCount(escrow)}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {tab === 'Summary' && <SummaryTab escrow={escrow} />}
        {tab === 'Claims' && <ClaimsList escrow={escrow} />}
        {tab === 'Ledger' && <LedgerTable escrow={escrow} />}
        {tab === 'Release' && <Checklist escrow={escrow} />}
      </div>
    </div>
  );
}
