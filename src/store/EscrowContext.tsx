import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { Claim, Escrow, EscrowStore, Release, Role } from '../types';
import { createSeedStore } from '../data/seed';
import { appendEntry } from '../lib/ledger';
import type { CoreLedgerGateway } from '../lib/coreLedger';

export type Action =
  | { type: 'SET_ROLE'; role: Role }
  | { type: 'RESET' }
  | { type: 'PREPARE_RELEASE'; escrowId: string; preparedAt: string }
  | { type: 'RELEASE_WIRE_SUBMITTING'; escrowId: string; releaseId: string }
  | {
      type: 'RELEASE_WIRE_SUBMITTED';
      escrowId: string;
      releaseId: string;
      confirmationRef: string;
      valueDate: string;
      approvedAt: string;
      snapshotBalanceCents: number;
      snapshotClaimReserveCents: number;
      snapshotFeesCents: number;
      snapshotReleasableCents: number;
    }
  | {
      type: 'RELEASE_WIRE_FAILED';
      escrowId: string;
      releaseId: string;
      error: string;
    }
  | {
      type: 'CONFIRM_RELEASE';
      escrowId: string;
      releaseId: string;
      confirmedAt: string;
    }
  | { type: 'UPDATE_CLAIM'; escrowId: string; claim: Claim; note: string }
  | { type: 'APPLY_INTEREST'; escrowId: string; asOf: string }
  | { type: 'APPLY_ANNUAL_FEE'; escrowId: string; asOf: string };

/** Map an escrow's active release status onto the escrow's own status. */
function deriveEscrowStatus(escrow: Escrow): Escrow['status'] {
  if (escrow.currentBalanceCents <= 0) return 'closed';
  const active = escrow.releases.find(
    (r) =>
      r.status === 'pending-approval' ||
      r.status === 'submitting' ||
      r.status === 'wire-pending',
  );
  if (active?.status === 'wire-pending' || active?.status === 'submitting') {
    return 'wire-pending';
  }
  if (active?.status === 'pending-approval') return 'pending-approval';
  return 'active';
}

/** Apply a transform to one escrow by id, returning a new escrows array. */
function updateEscrow(
  store: EscrowStore,
  escrowId: string,
  fn: (escrow: Escrow) => Escrow,
): EscrowStore {
  return {
    ...store,
    escrows: store.escrows.map((e) => (e.id === escrowId ? fn(e) : e)),
  };
}

export function reducer(store: EscrowStore, action: Action): EscrowStore {
  switch (action.type) {
    case 'SET_ROLE':
      return { ...store, currentRole: action.role };

    case 'RESET':
      return createSeedStore();

    case 'PREPARE_RELEASE':
      return updateEscrow(store, action.escrowId, (escrow) => {
        // Double-release guard: refuse if a release is already in progress.
        const alreadyActive = escrow.releases.some(
          (r) =>
            r.status === 'pending-approval' ||
            r.status === 'submitting' ||
            r.status === 'wire-pending',
        );
        if (alreadyActive) return escrow;

        const target =
          escrow.releases.find((r) => r.status === 'none') ??
          escrow.releases[escrow.releases.length - 1];
        if (!target) return escrow;

        const releases = escrow.releases.map((r) =>
          r.id === target.id
            ? {
                ...r,
                status: 'pending-approval' as const,
                preparedAt: action.preparedAt,
                preparedByRole: 'officer' as const,
              }
            : r,
        );
        const ledger = appendEntry(escrow.ledger, {
          type: 'release-prepared',
          amountCents: 0,
          timestamp: action.preparedAt,
          actorRole: 'officer',
          note: 'Release prepared and submitted for supervisor approval',
        });
        const next = { ...escrow, releases, ledger };
        return { ...next, status: deriveEscrowStatus(next) };
      });

    case 'RELEASE_WIRE_SUBMITTING':
      return updateEscrow(store, action.escrowId, (escrow) => {
        const releases = escrow.releases.map((r) =>
          r.id === action.releaseId
            ? { ...r, status: 'submitting' as const, postError: undefined }
            : r,
        );
        const next = { ...escrow, releases };
        return { ...next, status: deriveEscrowStatus(next) };
      });

    case 'RELEASE_WIRE_SUBMITTED':
      return updateEscrow(store, action.escrowId, (escrow) => {
        const releases: Release[] = escrow.releases.map((r) =>
          r.id === action.releaseId
            ? {
                ...r,
                status: 'wire-pending' as const,
                approvedByRole: 'supervisor' as const,
                approvedAt: action.approvedAt,
                valueDate: action.valueDate,
                confirmationRef: action.confirmationRef,
                postError: undefined,
                snapshot: {
                  takenAt: action.approvedAt,
                  balanceCents: action.snapshotBalanceCents,
                  openClaimsTotalCents: action.snapshotClaimReserveCents,
                  effectiveClaimReserveCents: action.snapshotClaimReserveCents,
                  accruedFeesCents: action.snapshotFeesCents,
                  releasableAmountCents: action.snapshotReleasableCents,
                },
              }
            : r,
        );
        const ledger = appendEntry(escrow.ledger, {
          type: 'release-approved',
          amountCents: 0,
          timestamp: action.approvedAt,
          actorRole: 'supervisor',
          note: `Release approved; posted to core ledger (ref ${action.confirmationRef}), value date ${action.valueDate}`,
        });
        const next = { ...escrow, releases, ledger };
        return { ...next, status: deriveEscrowStatus(next) };
      });

    case 'RELEASE_WIRE_FAILED':
      return updateEscrow(store, action.escrowId, (escrow) => {
        const releases = escrow.releases.map((r) =>
          r.id === action.releaseId
            ? {
                ...r,
                status: 'pending-approval' as const,
                postError: action.error,
              }
            : r,
        );
        const next = { ...escrow, releases };
        return { ...next, status: deriveEscrowStatus(next) };
      });

    case 'CONFIRM_RELEASE':
      return updateEscrow(store, action.escrowId, (escrow) => {
        const release = escrow.releases.find((r) => r.id === action.releaseId);
        if (!release || release.status !== 'wire-pending') return escrow;

        // Wire fee debit, then the disbursement, both appended (append-only).
        let ledger = appendEntry(escrow.ledger, {
          type: 'wire-fee-debit',
          amountCents: -escrow.wireFeeCents,
          timestamp: action.confirmedAt,
          actorRole: 'supervisor',
          note: 'Per-disbursement wire fee',
        });

        const balanceAfterFee = escrow.currentBalanceCents - escrow.wireFeeCents;
        const disbursement = Math.min(release.amountCents, balanceAfterFee);
        const newBalance = balanceAfterFee - disbursement;
        const isFinal = newBalance <= 0;

        ledger = appendEntry(ledger, {
          type: isFinal ? 'final-disbursement' : 'partial-disbursement',
          amountCents: -disbursement,
          timestamp: action.confirmedAt,
          actorRole: 'supervisor',
          note: isFinal
            ? 'Final disbursement to seller; wire confirmed, escrow closed'
            : 'Partial disbursement to seller; wire confirmed',
        });

        const releases: Release[] = escrow.releases.map((r) =>
          r.id === action.releaseId
            ? { ...r, status: 'confirmed' as const, confirmedAt: action.confirmedAt }
            : r,
        );

        const next: Escrow = {
          ...escrow,
          releases,
          ledger,
          currentBalanceCents: newBalance,
        };
        return { ...next, status: deriveEscrowStatus(next) };
      });

    case 'UPDATE_CLAIM':
      return updateEscrow(store, action.escrowId, (escrow) => {
        const claims = escrow.claims.map((c) =>
          c.id === action.claim.id ? action.claim : c,
        );
        const ledger = appendEntry(escrow.ledger, {
          type: 'claim-release',
          amountCents: 0,
          timestamp: action.claim.resolutionDate ?? new Date().toISOString(),
          actorRole: store.currentRole,
          note: action.note,
        });
        const next = { ...escrow, claims, ledger };
        return { ...next, status: deriveEscrowStatus(next) };
      });

    case 'APPLY_INTEREST':
      // Reserved for future demo use; the seed covers accrual history.
      return store;

    case 'APPLY_ANNUAL_FEE':
      return store;

    default:
      return store;
  }
}

interface EscrowContextValue {
  store: EscrowStore;
  dispatch: Dispatch<Action>;
  gateway: CoreLedgerGateway;
}

const EscrowContext = createContext<EscrowContextValue | null>(null);

export function EscrowProvider({
  gateway,
  children,
}: {
  gateway: CoreLedgerGateway;
  children: ReactNode;
}) {
  const [store, dispatch] = useReducer(reducer, undefined, createSeedStore);
  return (
    <EscrowContext.Provider value={{ store, dispatch, gateway }}>
      {children}
    </EscrowContext.Provider>
  );
}

export function useEscrow(): EscrowContextValue {
  const ctx = useContext(EscrowContext);
  if (!ctx) {
    throw new Error('useEscrow must be used within an EscrowProvider');
  }
  return ctx;
}
