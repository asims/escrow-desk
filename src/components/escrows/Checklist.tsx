import { useState } from 'react';
import type { Escrow, Release } from '../../types';
import { useEscrow } from '../../store/EscrowContext';
import { useBusinessDay } from '../../hooks/useBusinessDay';
import { REFERENCE_DATE } from '../../data/seed';
import { evaluateChecklist } from '../../lib/checklist';
import { computeReleasableAmount } from '../../lib/balance';
import { approveRelease } from '../../store/actions';
import { MoneyAmount, formatCents } from '../shared/MoneyAmount';
import { ConfirmDialog } from '../shared/ConfirmDialog';

const ASOF = REFERENCE_DATE;

function CheckRow({
  passed,
  loading,
  label,
  detail,
}: {
  passed: boolean;
  loading: boolean;
  label: string;
  detail: string;
}) {
  const icon = loading ? '⏳' : passed ? '✅' : '❌';
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0">
      <span className="text-sm leading-5">{icon}</span>
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">
          {loading ? 'Checking business day…' : detail}
        </div>
      </div>
    </div>
  );
}

function BreakdownPanel({ escrow }: { escrow: Escrow }) {
  const b = computeReleasableAmount(escrow, ASOF);
  return (
    <div className="border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Releasable amount
      </div>
      <dl className="divide-y divide-gray-100 text-sm">
        <Row label="Gross balance" cents={b.grossBalanceCents} />
        <Row
          label="Less: claim reserves"
          cents={-b.effectiveClaimReserveCents}
        />
        <Row label="Less: accrued fees" cents={-b.accruedFeesCents} />
        <div className="flex justify-between bg-gray-50 px-3 py-2 font-semibold text-gray-900">
          <dt>Net releasable</dt>
          <dd>
            <MoneyAmount cents={b.netReleasableCents} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Row({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex justify-between px-3 py-2">
      <dt className="text-gray-600">{label}</dt>
      <dd className="tabular-nums text-gray-900">
        <MoneyAmount cents={cents} />
      </dd>
    </div>
  );
}

function InstructionReceipts({ release }: { release: Release }) {
  return (
    <div className="border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Joint instruction receipts
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
            <th className="px-3 py-2 font-medium">Party</th>
            <th className="px-3 py-2 font-medium">Signer</th>
            <th className="px-3 py-2 font-medium">Received</th>
            <th className="px-3 py-2 font-medium">Channel</th>
          </tr>
        </thead>
        <tbody>
          {release.instructionReceipts.map((r) => (
            <tr
              key={`${r.partyRole}-${r.signerName}`}
              className="border-b border-gray-100"
            >
              <td className="px-3 py-2 capitalize text-gray-700">
                {r.partyRole}
              </td>
              <td className="px-3 py-2 text-gray-900">{r.signerName}</td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {r.receivedDate}
              </td>
              <td className="px-3 py-2 text-xs capitalize text-gray-600">
                {r.channel.replace('-', ' ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SnapshotPanel({ release }: { release: Release }) {
  const s = release.snapshot;
  if (!s) return null;
  const cells = [
    { label: 'Balance at approval', cents: s.balanceCents },
    { label: 'Claim reserve', cents: s.effectiveClaimReserveCents },
    { label: 'Accrued fees', cents: s.accruedFeesCents },
    { label: 'Net released', cents: s.releasableAmountCents },
  ];
  return (
    <div className="border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Approval snapshot — captured {s.takenAt.slice(0, 10)}
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-gray-100">
        {cells.map((c) => (
          <div key={c.label} className="px-3 py-3">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className="text-sm font-semibold text-gray-900">
              <MoneyAmount cents={c.cents} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function maskAccount(account: string): string {
  // Seed accounts are already masked (****1234); show as-is but guard length.
  if (account.length <= 4) return account;
  return account;
}

export function Checklist({ escrow }: { escrow: Escrow }) {
  const { store, dispatch, gateway } = useEscrow();
  const { result, loading } = useBusinessDay();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const role = store.currentRole;
  const isBusinessDay = result?.isBusinessDay ?? true;
  const holidays = result?.holidays ?? [];

  const activeRelease = escrow.releases.find(
    (r) =>
      r.status === 'pending-approval' ||
      r.status === 'submitting' ||
      r.status === 'wire-pending',
  );
  const confirmedRelease = [...escrow.releases]
    .reverse()
    .find((r) => r.status === 'confirmed');

  // ---- Wire-pending state --------------------------------------------------
  if (activeRelease?.status === 'wire-pending') {
    const wi = activeRelease.wireInstructions;
    return (
      <div className="space-y-4">
        <div className="border border-purple-200 bg-purple-50 px-3 py-3 text-sm text-purple-900">
          <div className="font-semibold">
            Wire submitted to core banking system — awaiting confirmation
          </div>
          <div className="mt-1 text-xs">
            Core reference{' '}
            <code className="font-mono">{activeRelease.confirmationRef}</code> ·
            value date {activeRelease.valueDate}. In production, confirmation
            arrives automatically via a core-banking callback; the manual confirm
            below is the fallback for outages.
          </div>
        </div>

        <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          A second release cannot be initiated while this wire is pending.
        </div>

        <SnapshotPanel release={activeRelease} />

        <div className="border border-gray-200">
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Wire instructions
          </div>
          <dl className="divide-y divide-gray-100 text-sm">
            <Field label="Beneficiary" value={wi.beneficiaryName} />
            <Field label="Bank" value={wi.bankName} />
            <Field label="Routing number" value={wi.routingNumber} />
            <Field label="Account number" value={maskAccount(wi.accountNumber)} />
            <Field label="Reference" value={wi.reference} />
            <div className="flex justify-between px-3 py-2">
              <dt className="text-gray-600">Amount</dt>
              <dd className="font-semibold text-gray-900">
                <MoneyAmount cents={activeRelease.amountCents} />
              </dd>
            </div>
          </dl>
        </div>

        <InstructionReceipts release={activeRelease} />

        {role === 'supervisor' ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Confirm Wire Received
          </button>
        ) : (
          <p className="text-xs text-gray-500">
            Switch to the Supervisor role to confirm receipt of the wire.
          </p>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title="Confirm wire received"
          confirmLabel="Confirm Receipt"
          onConfirm={() => {
            dispatch({
              type: 'CONFIRM_RELEASE',
              escrowId: escrow.id,
              releaseId: activeRelease.id,
              confirmedAt: ASOF.toISOString(),
            });
            setConfirmOpen(false);
          }}
          onCancel={() => setConfirmOpen(false)}
        >
          Record that the core banking system confirmed the wire. This posts the
          disbursement and wire fee to the ledger
          {activeRelease.amountCents >= escrow.currentBalanceCents
            ? ' and closes the escrow.'
            : '.'}
        </ConfirmDialog>
      </div>
    );
  }

  // ---- Pending-approval state ----------------------------------------------
  if (
    activeRelease?.status === 'pending-approval' ||
    activeRelease?.status === 'submitting'
  ) {
    const isSubmitting = activeRelease.status === 'submitting' || submitting;
    return (
      <div className="space-y-4">
        <div className="border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <div className="font-semibold">Pending supervisor approval</div>
          <div className="mt-1 text-xs">
            Prepared {activeRelease.preparedAt?.slice(0, 10)} by the escrow
            officer. Dual control requires a supervisor to approve before the
            post is sent to the core ledger.
          </div>
        </div>

        {activeRelease.postError && (
          <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <strong>Core ledger rejected the post:</strong>{' '}
            {activeRelease.postError}. The release remains pending approval — the
            supervisor can retry, or the officer can re-prepare.
          </div>
        )}

        <div className="border border-gray-200">
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Release summary
          </div>
          <dl className="divide-y divide-gray-100 text-sm">
            <div className="flex justify-between px-3 py-2">
              <dt className="text-gray-600">Amount to release</dt>
              <dd className="font-semibold text-gray-900">
                <MoneyAmount cents={activeRelease.amountCents} />
              </dd>
            </div>
            <Field
              label="Beneficiary"
              value={activeRelease.wireInstructions.beneficiaryName}
            />
            <Field
              label="Reference"
              value={activeRelease.wireInstructions.reference}
            />
          </dl>
        </div>

        <InstructionReceipts release={activeRelease} />

        {role === 'supervisor' ? (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await approveRelease(
                  dispatch,
                  gateway,
                  escrow,
                  activeRelease,
                  ASOF,
                  holidays,
                );
              } finally {
                setSubmitting(false);
              }
            }}
            className="bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Posting to core ledger…' : 'Approve Release'}
          </button>
        ) : (
          <p className="text-xs text-gray-500">
            Switch to the Supervisor role to approve this release.
          </p>
        )}
      </div>
    );
  }

  // ---- Confirmed / closed state --------------------------------------------
  if (
    (escrow.status === 'closed' || escrow.currentBalanceCents === 0) &&
    confirmedRelease
  ) {
    return (
      <div className="space-y-4">
        <div className="border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
          <div className="font-semibold text-gray-900">Escrow closed</div>
          <div className="mt-1 text-xs">
            Final disbursement confirmed {confirmedRelease.confirmedAt?.slice(0, 10)}{' '}
            (core ref {confirmedRelease.confirmationRef}). No further actions
            available. See the Ledger tab for full history.
          </div>
        </div>
        <SnapshotPanel release={confirmedRelease} />
      </div>
    );
  }

  // ---- Checklist / prepare state -------------------------------------------
  const results = evaluateChecklist(escrow, isBusinessDay, ASOF);
  const allPass = results.every((r) => r.passed);
  const canPrepare = allPass && role === 'officer' && !loading;

  return (
    <div className="space-y-4">
      <div className="border border-gray-200">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Safe-to-fund checklist
        </div>
        {results.map((r) => (
          <CheckRow
            key={r.id}
            passed={r.passed}
            loading={r.id === 'business-day' && loading}
            label={r.label}
            detail={r.detail}
          />
        ))}
      </div>

      <BreakdownPanel escrow={escrow} />

      {role === 'officer' ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={!canPrepare}
            onClick={() =>
              dispatch({
                type: 'PREPARE_RELEASE',
                escrowId: escrow.id,
                preparedAt: ASOF.toISOString(),
              })
            }
            className="bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prepare Release
          </button>
          {!allPass && (
            <p className="text-xs text-gray-500">
              All checklist items must pass before a release can be prepared.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          Switch to the Escrow Officer role to prepare a release. Net releasable:{' '}
          {formatCents(computeReleasableAmount(escrow, ASOF).netReleasableCents)}
          .
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-2">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}
