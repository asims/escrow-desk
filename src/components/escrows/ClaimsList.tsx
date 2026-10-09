import { useState } from 'react';
import type { Claim, Escrow } from '../../types';
import { useEscrow } from '../../store/EscrowContext';
import { REFERENCE_DATE } from '../../data/seed';
import { computeReleasableAmount } from '../../lib/balance';
import { formatCents, MoneyAmount } from '../shared/MoneyAmount';
import { ClaimStatusBadge } from '../shared/StatusBadge';
import { ConfirmDialog } from '../shared/ConfirmDialog';

const ASOF = REFERENCE_DATE;

/**
 * Compute the effective reserve for each claim using the same sequential logic
 * as computeReleasableAmount (open/disputed claims reserve min(claim, remaining)).
 */
function effectiveReserves(escrow: Escrow): Map<string, number> {
  const map = new Map<string, number>();
  let remaining = escrow.currentBalanceCents;
  for (const c of escrow.claims) {
    if (c.status !== 'open' && c.status !== 'disputed') {
      map.set(c.id, 0);
      continue;
    }
    const reserve = Math.min(c.claimedAmountCents, Math.max(0, remaining));
    map.set(c.id, reserve);
    remaining -= reserve;
  }
  return map;
}

interface DialogState {
  claim: Claim;
  mode: 'dispute' | 'resolve';
}

export function ClaimsList({ escrow }: { escrow: Escrow }) {
  const { store, dispatch } = useEscrow();
  const isOfficer = store.currentRole === 'officer';
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [settledInput, setSettledInput] = useState('');
  const [note, setNote] = useState('');
  const [jointRef, setJointRef] = useState('');

  const reserves = effectiveReserves(escrow);
  const breakdown = computeReleasableAmount(escrow, ASOF);
  const active = escrow.claims.filter((c) => c.status !== 'resolved');
  const resolved = escrow.claims.filter((c) => c.status === 'resolved');

  const fullyBlocked =
    breakdown.effectiveClaimReserveCents >= escrow.currentBalanceCents &&
    escrow.currentBalanceCents > 0 &&
    active.length > 0;
  const blockingClaim = active[0];

  function openDialog(claim: Claim, mode: DialogState['mode']) {
    setDialog({ claim, mode });
    setSettledInput((claim.claimedAmountCents / 100).toString());
    setNote('');
    setJointRef('');
  }

  function closeDialog() {
    setDialog(null);
  }

  function confirmDisputed() {
    if (!dialog) return;
    const updated: Claim = { ...dialog.claim, status: 'disputed' };
    dispatch({
      type: 'UPDATE_CLAIM',
      escrowId: escrow.id,
      claim: updated,
      note: `Claim "${dialog.claim.description}" marked Disputed — seller objected`,
    });
    closeDialog();
  }

  function confirmResolved() {
    if (!dialog) return;
    const settledCents = Math.round(Number(settledInput) * 100);
    const updated: Claim = {
      ...dialog.claim,
      status: 'resolved',
      resolvedAmountCents: Number.isFinite(settledCents) ? settledCents : 0,
      resolutionNote: note,
      resolutionDate: ASOF.toISOString(),
      jointInstructionRef:
        dialog.claim.status === 'disputed' ? jointRef : dialog.claim.jointInstructionRef,
    };
    dispatch({
      type: 'UPDATE_CLAIM',
      escrowId: escrow.id,
      claim: updated,
      note: `Claim "${dialog.claim.description}" resolved at ${formatCents(
        updated.resolvedAmountCents ?? 0,
      )}${note ? ` — ${note}` : ''}`,
    });
    closeDialog();
  }

  const settledValid =
    settledInput !== '' && Number.isFinite(Number(settledInput)) && Number(settledInput) >= 0;
  const resolveDisabled =
    !settledValid ||
    (dialog?.mode === 'resolve' &&
      dialog.claim.status === 'disputed' &&
      jointRef.trim() === '');

  return (
    <div className="space-y-4">
      {fullyBlocked && blockingClaim && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Claim of {formatCents(blockingClaim.claimedAmountCents)} exceeds (or
          equals) the available balance of{' '}
          {formatCents(escrow.currentBalanceCents)} — full balance reserved,
          release blocked.
        </div>
      )}

      <div className="border border-gray-200">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Active claims
        </div>
        {active.length === 0 ? (
          <div className="px-3 py-4 text-sm text-gray-500">
            No open or disputed claims.
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Filed</th>
                <th className="px-3 py-2 text-right font-medium">Claimed</th>
                <th className="px-3 py-2 text-right font-medium">
                  Effective Reserve
                </th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 align-top">
                  <td className="px-3 py-2 text-gray-900">{c.description}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {c.filedDate}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MoneyAmount cents={c.claimedAmountCents} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MoneyAmount cents={reserves.get(c.id) ?? 0} />
                  </td>
                  <td className="px-3 py-2">
                    <ClaimStatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-2">
                    {isOfficer ? (
                      <div className="flex gap-2">
                        {c.status === 'open' && (
                          <button
                            type="button"
                            onClick={() => openDialog(c, 'dispute')}
                            className="border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            Mark Disputed
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openDialog(c, 'resolve')}
                          className="bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Resolve
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Officer only
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="border border-gray-200">
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Resolved history
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Claimed</th>
                <th className="px-3 py-2 text-right font-medium">Settled</th>
                <th className="px-3 py-2 font-medium">Resolution Note</th>
              </tr>
            </thead>
            <tbody>
              {resolved.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 align-top">
                  <td className="px-3 py-2 text-gray-700">{c.description}</td>
                  <td className="px-3 py-2 text-right">
                    <MoneyAmount cents={c.claimedAmountCents} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MoneyAmount cents={c.resolvedAmountCents ?? 0} />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {c.resolutionNote}
                    {c.jointInstructionRef && (
                      <span className="ml-1 text-gray-400">
                        (ref {c.jointInstructionRef})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={dialog?.mode === 'dispute'}
        title="Mark claim as Disputed"
        confirmLabel="Mark Disputed"
        onConfirm={confirmDisputed}
        onCancel={closeDialog}
      >
        Record that the seller has objected to this claim. Funds remain
        reserved. A disputed claim can only be resolved with a joint instruction
        from both parties.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.mode === 'resolve'}
        title="Resolve claim"
        confirmLabel="Resolve Claim"
        confirmDisabled={resolveDisabled}
        onConfirm={confirmResolved}
        onCancel={closeDialog}
      >
        <div className="space-y-3">
          {dialog?.claim.status === 'disputed' && (
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500">
                Joint instruction reference (required for disputed claims)
              </span>
              <input
                type="text"
                value={jointRef}
                onChange={(e) => setJointRef(e.target.value)}
                placeholder="e.g. JI-2026-0142"
                className="w-full border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">
              Settled amount (USD)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={settledInput}
              onChange={(e) => setSettledInput(e.target.value)}
              className="w-full border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">
              Resolution note
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
}
