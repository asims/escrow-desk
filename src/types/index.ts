// types/index.ts

// All monetary values are stored as integer cents (e.g., $1,000.00 = 100000).
// Never use floating point for money calculations. Use Math.round() when
// computing interest or fee fractions.

export type Role = 'officer' | 'supervisor';

export type EscrowStatus =
  | 'active' // Normal operating state
  | 'pending-approval' // Release prepared, awaiting supervisor
  | 'wire-pending' // Approved, post submitted to core ledger
  | 'closed'; // All funds disbursed

export type ReleaseStatus =
  | 'none' // No release in progress
  | 'pending-approval'
  | 'submitting' // Gateway call in flight
  | 'wire-pending' // Post accepted by core ledger
  | 'failed' // Gateway rejected the post
  | 'confirmed';

export type ClaimStatus = 'open' | 'disputed' | 'resolved';

export type LedgerEntryType =
  | 'initial-deposit'
  | 'claim-reserve'
  | 'claim-release'
  | 'partial-disbursement'
  | 'final-disbursement'
  | 'interest-credit'
  | 'annual-fee-debit'
  | 'wire-fee-debit'
  | 'release-prepared'
  | 'release-approved'
  | 'release-confirmed';

export interface Party {
  name: string; // e.g., "Acme Acquisition Corp"
  role: 'buyer' | 'seller';
  signers: Signer[];
}

export interface Signer {
  id: string;
  name: string;
  title: string;
}

export interface WireInstructions {
  beneficiaryName: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  reference: string; // Wire memo / deal reference
}

export interface Claim {
  id: string;
  description: string;
  filedDate: string; // ISO date string
  claimedAmountCents: number; // Integer cents
  resolvedAmountCents?: number; // Integer cents; may be less than claimedAmountCents
  status: ClaimStatus;
  resolutionNote?: string;
  resolutionDate?: string;
  jointInstructionRef?: string; // Required to resolve Disputed claims
}

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  amountCents: number; // Positive = credit, negative = debit; integer cents
  runningBalanceCents: number; // Integer cents
  timestamp: string; // ISO datetime string
  actorRole: Role;
  note?: string;
}

export interface InstructionReceipt {
  partyRole: 'buyer' | 'seller';
  signerName: string; // Must match a Signer in the party
  receivedDate: string; // ISO date string
  channel: 'secure-portal' | 'email' | 'physical';
}

export interface ReleaseSnapshot {
  takenAt: string; // ISO datetime; moment of supervisor approval
  balanceCents: number;
  openClaimsTotalCents: number;
  effectiveClaimReserveCents: number;
  accruedFeesCents: number;
  releasableAmountCents: number;
}

export interface Release {
  id: string;
  escrowId: string;
  status: ReleaseStatus;
  preparedAt?: string;
  approvedAt?: string;
  confirmedAt?: string;
  valueDate?: string; // ISO date — next valid business day on/after approval date
  preparedByRole: Role;
  approvedByRole?: Role;
  amountCents: number; // Integer cents
  wireInstructions: WireInstructions;
  instructionReceipts: InstructionReceipt[]; // One per party
  snapshot?: ReleaseSnapshot;
  confirmationRef?: string; // Set by core ledger on success
  postError?: string; // Set on gateway failure
}

export interface ReleaseSchedule {
  releaseDate: string; // ISO date string
  expectedAmountCents?: number; // Integer cents; if null, release full remaining balance
  label: string; // e.g., "12-Month Release", "Final Release"
}

export interface Escrow {
  id: string;
  name: string; // e.g., "Acme / Beta Corp Indemnity Holdback"
  dealName: string;
  buyer: Party;
  seller: Party;
  openedDate: string; // ISO date string
  survivalPeriodStart: string;
  survivalPeriodEnd: string;
  originalAmountCents: number; // Integer cents
  currentBalanceCents: number; // Integer cents
  status: EscrowStatus;
  // Interest
  annualInterestRate: number; // 0.045 = 4.5%; 0 = non-interest-bearing
  interestBeneficiary: 'buyer' | 'seller';
  // Fees
  annualAdminFeeCents: number; // Integer cents, flat per year
  wireFeeCents: number; // Integer cents, per disbursement
  // Schedule
  releaseSchedule: ReleaseSchedule[];
  // Sub-collections
  claims: Claim[];
  ledger: LedgerEntry[];
  releases: Release[];
  wireInstructions: WireInstructions; // Beneficiary (seller) wire destination
}

export interface EscrowStore {
  escrows: Escrow[];
  currentRole: Role;
}
