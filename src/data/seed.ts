import type {
  Claim,
  Escrow,
  EscrowStore,
  InstructionReceipt,
  LedgerEntry,
  Release,
  Signer,
  WireInstructions,
} from '../types';

/**
 * Fixed reference date — "today" in the PoC. All scenario-relative dates are
 * derived from this so the seed stays stable regardless of when the app runs.
 */
export const REFERENCE_DATE = new Date('2026-10-08T12:00:00Z');

const REF_ISO = '2026-10-08';

// ---------------------------------------------------------------------------
// Small helpers (pure, deterministic — no Date.now())
// ---------------------------------------------------------------------------

/** Build a ledger with correct running balances from a list of amounts. */
function buildLedger(
  entries: Omit<LedgerEntry, 'id' | 'runningBalanceCents'>[],
): LedgerEntry[] {
  let running = 0;
  return entries.map((e, i) => {
    running += e.amountCents;
    return { ...e, id: `${e.type}-${i}`, runningBalanceCents: running };
  });
}

function signer(id: string, name: string, title: string): Signer {
  return { id, name, title };
}

function wire(
  beneficiaryName: string,
  accountNumber: string,
  reference: string,
): WireInstructions {
  return {
    beneficiaryName,
    bankName: 'First Commercial Bank, N.A.',
    routingNumber: '021000021',
    accountNumber,
    reference,
  };
}

// ---------------------------------------------------------------------------
// Scenario factories. Each returns a fresh deep object (no shared references),
// so RESET can rebuild the entire store cleanly.
// ---------------------------------------------------------------------------

function esc001(): Escrow {
  // Ready to fund: survival expired, no claims, both instructions on file.
  const w = wire('Beta Corp', '****4821', 'ACME-BETA-INDEM-2024');
  const release: Release = {
    id: 'escrow-01-release-1',
    escrowId: 'ESC-001',
    status: 'none',
    preparedByRole: 'officer',
    amountCents: 50000000,
    wireInstructions: w,
    instructionReceipts: [
      {
        partyRole: 'buyer',
        signerName: 'Alan Reeves',
        receivedDate: '2026-10-02',
        channel: 'secure-portal',
      },
      {
        partyRole: 'seller',
        signerName: 'Maria Chen',
        receivedDate: '2026-10-03',
        channel: 'secure-portal',
      },
    ],
  };
  return {
    id: 'ESC-001',
    name: 'Acme / Beta Corp Indemnity Holdback',
    dealName: 'Acme acquisition of Beta Corp',
    buyer: {
      name: 'Acme Acquisition Corp',
      role: 'buyer',
      signers: [
        signer('b1', 'Alan Reeves', 'VP, Corporate Development'),
        signer('b2', 'Dana Pryor', 'Assistant General Counsel'),
      ],
    },
    seller: {
      name: 'Beta Corp',
      role: 'seller',
      signers: [signer('s1', 'Maria Chen', 'Chief Executive Officer')],
    },
    openedDate: '2024-10-01',
    survivalPeriodStart: '2024-10-01',
    survivalPeriodEnd: '2026-10-01',
    originalAmountCents: 50000000,
    currentBalanceCents: 50000000,
    status: 'active',
    annualInterestRate: 0.045,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 120000,
    wireFeeCents: 3500,
    releaseSchedule: [{ releaseDate: '2026-10-01', label: 'Final Release' }],
    claims: [],
    ledger: buildLedger([
      {
        type: 'initial-deposit',
        amountCents: 50000000,
        timestamp: '2024-10-01T15:00:00Z',
        actorRole: 'officer',
        note: 'Initial escrow deposit at closing',
      },
      {
        type: 'annual-fee-debit',
        amountCents: -120000,
        timestamp: '2025-10-01T09:00:00Z',
        actorRole: 'officer',
        note: 'Year 1 administration fee',
      },
    ]),
    releases: [release],
    wireInstructions: w,
  };
}

function esc002(): Escrow {
  // Partial claim: one open claim reduces releasable balance.
  const w = wire('Nimbus Holdings', '****7730', 'ORION-NIMBUS-2024');
  const claim: Claim = {
    id: 'ESC-002-claim-1',
    description: 'Breach of IP representation — pending patent dispute',
    filedDate: '2026-08-14',
    claimedAmountCents: 5000000,
    status: 'open',
  };
  const release: Release = {
    id: 'escrow-02-release-1',
    escrowId: 'ESC-002',
    status: 'none',
    preparedByRole: 'officer',
    amountCents: 50000000,
    wireInstructions: w,
    instructionReceipts: [
      {
        partyRole: 'buyer',
        signerName: 'Grace Okafor',
        receivedDate: '2026-10-04',
        channel: 'email',
      },
      {
        partyRole: 'seller',
        signerName: 'Peter Lund',
        receivedDate: '2026-10-04',
        channel: 'email',
      },
    ],
  };
  return {
    id: 'ESC-002',
    name: 'Orion / Nimbus Indemnity Holdback',
    dealName: 'Orion Systems acquisition of Nimbus Holdings',
    buyer: {
      name: 'Orion Systems Inc',
      role: 'buyer',
      signers: [signer('b1', 'Grace Okafor', 'General Counsel')],
    },
    seller: {
      name: 'Nimbus Holdings LLC',
      role: 'seller',
      signers: [signer('s1', 'Peter Lund', 'Managing Member')],
    },
    openedDate: '2024-09-15',
    survivalPeriodStart: '2024-09-15',
    survivalPeriodEnd: '2026-09-15',
    originalAmountCents: 50000000,
    currentBalanceCents: 50000000,
    status: 'active',
    annualInterestRate: 0.04,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 100000,
    wireFeeCents: 3500,
    releaseSchedule: [{ releaseDate: '2026-09-15', label: 'Final Release' }],
    claims: [claim],
    ledger: buildLedger([
      {
        type: 'initial-deposit',
        amountCents: 50000000,
        timestamp: '2024-09-15T15:00:00Z',
        actorRole: 'officer',
        note: 'Initial escrow deposit at closing',
      },
      {
        type: 'claim-reserve',
        amountCents: 0,
        timestamp: '2026-08-14T10:00:00Z',
        actorRole: 'officer',
        note: 'Claim filed: IP representation breach — $50,000 reserved',
      },
    ]),
    releases: [release],
    wireInstructions: w,
  };
}

function esc003(): Escrow {
  // Fully blocked: open claim equals full balance.
  const w = wire('Delta Logistics', '****1198', 'VERTEX-DELTA-2024');
  const claim: Claim = {
    id: 'ESC-003-claim-1',
    description: 'Undisclosed environmental liability at primary facility',
    filedDate: '2026-07-20',
    claimedAmountCents: 25000000,
    status: 'open',
  };
  return {
    id: 'ESC-003',
    name: 'Vertex / Delta Logistics Indemnity Holdback',
    dealName: 'Vertex acquisition of Delta Logistics',
    buyer: {
      name: 'Vertex Industrial Corp',
      role: 'buyer',
      signers: [signer('b1', 'Henry Voss', 'CFO')],
    },
    seller: {
      name: 'Delta Logistics LP',
      role: 'seller',
      signers: [signer('s1', 'Rosa Marin', 'General Partner')],
    },
    openedDate: '2024-08-01',
    survivalPeriodStart: '2024-08-01',
    survivalPeriodEnd: '2026-08-01',
    originalAmountCents: 25000000,
    currentBalanceCents: 25000000,
    status: 'active',
    annualInterestRate: 0.045,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 90000,
    wireFeeCents: 3500,
    releaseSchedule: [{ releaseDate: '2026-08-01', label: 'Final Release' }],
    claims: [claim],
    ledger: buildLedger([
      {
        type: 'initial-deposit',
        amountCents: 25000000,
        timestamp: '2024-08-01T15:00:00Z',
        actorRole: 'officer',
        note: 'Initial escrow deposit at closing',
      },
      {
        type: 'claim-reserve',
        amountCents: 0,
        timestamp: '2026-07-20T11:00:00Z',
        actorRole: 'officer',
        note: 'Claim filed: environmental liability — $250,000 reserved (full balance)',
      },
    ]),
    releases: [],
    wireInstructions: w,
  };
}

function esc004(): Escrow {
  // Non-business day: release date is US Thanksgiving (a federal holiday).
  const w = wire('Summit Media', '****5540', 'POLARIS-SUMMIT-2022');
  const release: Release = {
    id: 'escrow-04-release-1',
    escrowId: 'ESC-004',
    status: 'none',
    preparedByRole: 'officer',
    amountCents: 30000000,
    wireInstructions: w,
    instructionReceipts: [
      {
        partyRole: 'buyer',
        signerName: 'Ivan Petrov',
        receivedDate: '2024-11-25',
        channel: 'secure-portal',
      },
      {
        partyRole: 'seller',
        signerName: 'Nadia Haddad',
        receivedDate: '2024-11-25',
        channel: 'secure-portal',
      },
    ],
  };
  return {
    id: 'ESC-004',
    name: 'Polaris / Summit Media Indemnity Holdback',
    dealName: 'Polaris acquisition of Summit Media',
    buyer: {
      name: 'Polaris Capital Corp',
      role: 'buyer',
      signers: [signer('b1', 'Ivan Petrov', 'Director of M&A')],
    },
    seller: {
      name: 'Summit Media Group',
      role: 'seller',
      signers: [signer('s1', 'Nadia Haddad', 'President')],
    },
    openedDate: '2022-11-28',
    survivalPeriodStart: '2022-11-28',
    survivalPeriodEnd: '2024-11-28',
    originalAmountCents: 30000000,
    currentBalanceCents: 30000000,
    status: 'active',
    annualInterestRate: 0.03,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 95000,
    wireFeeCents: 3500,
    // 2024-11-28 is US Thanksgiving — the Fed holiday API blocks funding.
    releaseSchedule: [{ releaseDate: '2024-11-28', label: 'Final Release' }],
    claims: [],
    ledger: buildLedger([
      {
        type: 'initial-deposit',
        amountCents: 30000000,
        timestamp: '2022-11-28T15:00:00Z',
        actorRole: 'officer',
        note: 'Initial escrow deposit at closing',
      },
    ]),
    releases: [release],
    wireInstructions: w,
  };
}

function esc005(): Escrow {
  // Not yet due: survival period ends 6 months out.
  const w = wire('Cedar Pharma', '****9014', 'ATLAS-CEDAR-2025');
  return {
    id: 'ESC-005',
    name: 'Atlas / Cedar Pharma Indemnity Holdback',
    dealName: 'Atlas acquisition of Cedar Pharma',
    buyer: {
      name: 'Atlas Life Sciences Inc',
      role: 'buyer',
      signers: [signer('b1', 'Olivia Grant', 'SVP, Legal')],
    },
    seller: {
      name: 'Cedar Pharma Inc',
      role: 'seller',
      signers: [signer('s1', 'Thomas Reid', 'Chief Executive Officer')],
    },
    openedDate: '2025-04-08',
    survivalPeriodStart: '2025-04-08',
    survivalPeriodEnd: '2027-04-08',
    originalAmountCents: 75000000,
    currentBalanceCents: 75000000,
    status: 'active',
    annualInterestRate: 0.045,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 150000,
    wireFeeCents: 3500,
    // Release date is 6 months after the reference date.
    releaseSchedule: [{ releaseDate: '2027-04-08', label: 'Final Release' }],
    claims: [],
    ledger: buildLedger([
      {
        type: 'initial-deposit',
        amountCents: 75000000,
        timestamp: '2025-04-08T15:00:00Z',
        actorRole: 'officer',
        note: 'Initial escrow deposit at closing',
      },
    ]),
    releases: [],
    wireInstructions: w,
  };
}

function esc006(): Escrow {
  // Missing instruction: buyer receipt on file, seller not received.
  const w = wire('Harbor Foods', '****2267', 'MERIDIAN-HARBOR-2024');
  const receipts: InstructionReceipt[] = [
    {
      partyRole: 'buyer',
      signerName: 'Sofia Ramos',
      receivedDate: '2026-10-05',
      channel: 'secure-portal',
    },
    // Seller instruction intentionally missing.
  ];
  const release: Release = {
    id: 'escrow-06-release-1',
    escrowId: 'ESC-006',
    status: 'none',
    preparedByRole: 'officer',
    amountCents: 40000000,
    wireInstructions: w,
    instructionReceipts: receipts,
  };
  return {
    id: 'ESC-006',
    name: 'Meridian / Harbor Foods Indemnity Holdback',
    dealName: 'Meridian acquisition of Harbor Foods',
    buyer: {
      name: 'Meridian Brands Corp',
      role: 'buyer',
      signers: [signer('b1', 'Sofia Ramos', 'General Counsel')],
    },
    seller: {
      name: 'Harbor Foods Co',
      role: 'seller',
      signers: [signer('s1', 'Daniel Pak', 'Owner')],
    },
    openedDate: '2024-10-01',
    survivalPeriodStart: '2024-10-01',
    survivalPeriodEnd: '2026-10-01',
    originalAmountCents: 40000000,
    currentBalanceCents: 40000000,
    status: 'active',
    annualInterestRate: 0.04,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 110000,
    wireFeeCents: 3500,
    releaseSchedule: [{ releaseDate: '2026-10-01', label: 'Final Release' }],
    claims: [],
    ledger: buildLedger([
      {
        type: 'initial-deposit',
        amountCents: 40000000,
        timestamp: '2024-10-01T15:00:00Z',
        actorRole: 'officer',
        note: 'Initial escrow deposit at closing',
      },
    ]),
    releases: [release],
    wireInstructions: w,
  };
}

function esc007(): Escrow {
  // Pending supervisor approval: release already prepared.
  const w = wire('Lumen Analytics', '****3312', 'QUANTA-LUMEN-2024');
  const release: Release = {
    id: 'escrow-07-release-1',
    escrowId: 'ESC-007',
    status: 'pending-approval',
    preparedAt: '2026-10-07T16:30:00Z',
    preparedByRole: 'officer',
    amountCents: 60000000,
    wireInstructions: w,
    instructionReceipts: [
      {
        partyRole: 'buyer',
        signerName: 'Elena Marsh',
        receivedDate: '2026-10-06',
        channel: 'secure-portal',
      },
      {
        partyRole: 'seller',
        signerName: 'Victor Shaw',
        receivedDate: '2026-10-06',
        channel: 'secure-portal',
      },
    ],
  };
  return {
    id: 'ESC-007',
    name: 'Quanta / Lumen Analytics Indemnity Holdback',
    dealName: 'Quanta acquisition of Lumen Analytics',
    buyer: {
      name: 'Quanta Software Inc',
      role: 'buyer',
      signers: [signer('b1', 'Elena Marsh', 'VP, Legal')],
    },
    seller: {
      name: 'Lumen Analytics LLC',
      role: 'seller',
      signers: [signer('s1', 'Victor Shaw', 'Managing Director')],
    },
    openedDate: '2024-09-01',
    survivalPeriodStart: '2024-09-01',
    survivalPeriodEnd: '2026-09-01',
    originalAmountCents: 60000000,
    currentBalanceCents: 60000000,
    status: 'pending-approval',
    annualInterestRate: 0.045,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 130000,
    wireFeeCents: 3500,
    releaseSchedule: [{ releaseDate: '2026-09-01', label: 'Final Release' }],
    claims: [],
    ledger: buildLedger([
      {
        type: 'initial-deposit',
        amountCents: 60000000,
        timestamp: '2024-09-01T15:00:00Z',
        actorRole: 'officer',
        note: 'Initial escrow deposit at closing',
      },
      {
        type: 'release-prepared',
        amountCents: 0,
        timestamp: '2026-10-07T16:30:00Z',
        actorRole: 'officer',
        note: 'Release prepared and submitted for supervisor approval',
      },
    ]),
    releases: [release],
    wireInstructions: w,
  };
}

function esc008(): Escrow {
  // Wire pending: release approved, posted to core, awaiting confirmation.
  const w = wire('Terra Minerals', '****8820', 'GRANITE-TERRA-2024');
  const release: Release = {
    id: 'escrow-08-release-1',
    escrowId: 'ESC-008',
    status: 'wire-pending',
    preparedAt: '2026-10-06T14:00:00Z',
    approvedAt: '2026-10-07T10:15:00Z',
    valueDate: '2026-10-08',
    preparedByRole: 'officer',
    approvedByRole: 'supervisor',
    amountCents: 45000000,
    confirmationRef: 'MOCK-escrow-08-release-1',
    wireInstructions: w,
    instructionReceipts: [
      {
        partyRole: 'buyer',
        signerName: 'Carl Jensen',
        receivedDate: '2026-10-05',
        channel: 'secure-portal',
      },
      {
        partyRole: 'seller',
        signerName: 'Amina Diallo',
        receivedDate: '2026-10-05',
        channel: 'physical',
      },
    ],
    snapshot: {
      takenAt: '2026-10-07T10:15:00Z',
      balanceCents: 45000000,
      openClaimsTotalCents: 0,
      effectiveClaimReserveCents: 0,
      accruedFeesCents: 3500,
      releasableAmountCents: 44996500,
    },
  };
  return {
    id: 'ESC-008',
    name: 'Granite / Terra Minerals Indemnity Holdback',
    dealName: 'Granite acquisition of Terra Minerals',
    buyer: {
      name: 'Granite Resources Corp',
      role: 'buyer',
      signers: [signer('b1', 'Carl Jensen', 'Director, Legal')],
    },
    seller: {
      name: 'Terra Minerals Inc',
      role: 'seller',
      signers: [signer('s1', 'Amina Diallo', 'Chief Executive Officer')],
    },
    openedDate: '2024-10-02',
    survivalPeriodStart: '2024-10-02',
    survivalPeriodEnd: '2026-10-02',
    originalAmountCents: 45000000,
    currentBalanceCents: 45000000,
    status: 'wire-pending',
    annualInterestRate: 0.045,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 120000,
    wireFeeCents: 3500,
    releaseSchedule: [{ releaseDate: '2026-10-02', label: 'Final Release' }],
    claims: [],
    ledger: buildLedger([
      {
        type: 'initial-deposit',
        amountCents: 45000000,
        timestamp: '2024-10-02T15:00:00Z',
        actorRole: 'officer',
        note: 'Initial escrow deposit at closing',
      },
      {
        type: 'release-prepared',
        amountCents: 0,
        timestamp: '2026-10-06T14:00:00Z',
        actorRole: 'officer',
        note: 'Release prepared and submitted for supervisor approval',
      },
      {
        type: 'release-approved',
        amountCents: 0,
        timestamp: '2026-10-07T10:15:00Z',
        actorRole: 'supervisor',
        note: 'Release approved; posted to core ledger (ref MOCK-escrow-08-release-1), value date 2026-10-08',
      },
    ]),
    releases: [release],
    wireInstructions: w,
  };
}

function esc009(): Escrow {
  // Fully closed: balance 0, status closed, full ledger history.
  const w = wire('Willow Textiles', '****6655', 'FOUNTAIN-WILLOW-2022');
  const release: Release = {
    id: 'escrow-09-release-1',
    escrowId: 'ESC-009',
    status: 'confirmed',
    preparedAt: '2024-10-02T14:00:00Z',
    approvedAt: '2024-10-03T10:00:00Z',
    confirmedAt: '2024-10-04T09:30:00Z',
    valueDate: '2024-10-04',
    preparedByRole: 'officer',
    approvedByRole: 'supervisor',
    amountCents: 20000000,
    confirmationRef: 'MOCK-escrow-09-release-1',
    wireInstructions: w,
    instructionReceipts: [
      {
        partyRole: 'buyer',
        signerName: 'Ruth Alvarez',
        receivedDate: '2024-10-01',
        channel: 'secure-portal',
      },
      {
        partyRole: 'seller',
        signerName: 'George Tan',
        receivedDate: '2024-10-01',
        channel: 'secure-portal',
      },
    ],
    snapshot: {
      takenAt: '2024-10-03T10:00:00Z',
      balanceCents: 20000000,
      openClaimsTotalCents: 0,
      effectiveClaimReserveCents: 0,
      accruedFeesCents: 3500,
      releasableAmountCents: 19996500,
    },
  };
  return {
    id: 'ESC-009',
    name: 'Fountain / Willow Textiles Indemnity Holdback',
    dealName: 'Fountain acquisition of Willow Textiles',
    buyer: {
      name: 'Fountain Consumer Corp',
      role: 'buyer',
      signers: [signer('b1', 'Ruth Alvarez', 'General Counsel')],
    },
    seller: {
      name: 'Willow Textiles Ltd',
      role: 'seller',
      signers: [signer('s1', 'George Tan', 'Director')],
    },
    openedDate: '2022-10-02',
    survivalPeriodStart: '2022-10-02',
    survivalPeriodEnd: '2024-10-02',
    originalAmountCents: 20000000,
    currentBalanceCents: 0,
    status: 'closed',
    annualInterestRate: 0,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 80000,
    wireFeeCents: 3500,
    releaseSchedule: [{ releaseDate: '2024-10-02', label: 'Final Release' }],
    claims: [],
    ledger: buildLedger([
      {
        type: 'initial-deposit',
        amountCents: 20000000,
        timestamp: '2022-10-02T15:00:00Z',
        actorRole: 'officer',
        note: 'Initial escrow deposit at closing',
      },
      {
        type: 'annual-fee-debit',
        amountCents: -80000,
        timestamp: '2023-10-02T09:00:00Z',
        actorRole: 'officer',
        note: 'Year 1 administration fee',
      },
      {
        type: 'release-prepared',
        amountCents: 0,
        timestamp: '2024-10-02T14:00:00Z',
        actorRole: 'officer',
        note: 'Release prepared and submitted for supervisor approval',
      },
      {
        type: 'release-approved',
        amountCents: 0,
        timestamp: '2024-10-03T10:00:00Z',
        actorRole: 'supervisor',
        note: 'Release approved; posted to core ledger (ref MOCK-escrow-09-release-1)',
      },
      {
        type: 'wire-fee-debit',
        amountCents: -3500,
        timestamp: '2024-10-04T09:30:00Z',
        actorRole: 'supervisor',
        note: 'Per-disbursement wire fee',
      },
      {
        type: 'final-disbursement',
        amountCents: -19996500,
        timestamp: '2024-10-04T09:30:00Z',
        actorRole: 'supervisor',
        note: 'Final disbursement to seller; wire confirmed, escrow closed',
      },
    ]),
    releases: [release],
    wireInstructions: w,
  };
}

function esc010(): Escrow {
  // Two-tranche: 12-month partial disbursed, 18-month final upcoming.
  const w = wire('Aspen Robotics', '****4409', 'KESTREL-ASPEN-2025');
  const firstRelease: Release = {
    id: 'escrow-10-release-1',
    escrowId: 'ESC-010',
    status: 'confirmed',
    preparedAt: '2026-04-02T14:00:00Z',
    approvedAt: '2026-04-03T10:00:00Z',
    confirmedAt: '2026-04-06T09:30:00Z',
    valueDate: '2026-04-06',
    preparedByRole: 'officer',
    approvedByRole: 'supervisor',
    amountCents: 40000000,
    confirmationRef: 'MOCK-escrow-10-release-1',
    wireInstructions: w,
    instructionReceipts: [
      {
        partyRole: 'buyer',
        signerName: 'Leo Fischer',
        receivedDate: '2026-04-01',
        channel: 'secure-portal',
      },
      {
        partyRole: 'seller',
        signerName: 'Hana Suzuki',
        receivedDate: '2026-04-01',
        channel: 'secure-portal',
      },
    ],
    snapshot: {
      takenAt: '2026-04-03T10:00:00Z',
      balanceCents: 80000000,
      openClaimsTotalCents: 0,
      effectiveClaimReserveCents: 0,
      accruedFeesCents: 3500,
      releasableAmountCents: 39996500,
    },
  };
  return {
    id: 'ESC-010',
    name: 'Kestrel / Aspen Robotics Indemnity Holdback',
    dealName: 'Kestrel acquisition of Aspen Robotics',
    buyer: {
      name: 'Kestrel Automation Corp',
      role: 'buyer',
      signers: [signer('b1', 'Leo Fischer', 'VP, Corporate Development')],
    },
    seller: {
      name: 'Aspen Robotics Inc',
      role: 'seller',
      signers: [signer('s1', 'Hana Suzuki', 'Chief Executive Officer')],
    },
    openedDate: '2025-04-06',
    survivalPeriodStart: '2025-04-06',
    survivalPeriodEnd: '2026-10-06',
    originalAmountCents: 80000000,
    currentBalanceCents: 40000000,
    status: 'active',
    annualInterestRate: 0.045,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 160000,
    wireFeeCents: 3500,
    releaseSchedule: [
      {
        releaseDate: '2026-04-06',
        expectedAmountCents: 40000000,
        label: '12-Month Release',
      },
      {
        releaseDate: '2026-10-06',
        expectedAmountCents: 40000000,
        label: '18-Month Final Release',
      },
    ],
    claims: [],
    ledger: buildLedger([
      {
        type: 'initial-deposit',
        amountCents: 80000000,
        timestamp: '2025-04-06T15:00:00Z',
        actorRole: 'officer',
        note: 'Initial escrow deposit at closing',
      },
      {
        type: 'release-prepared',
        amountCents: 0,
        timestamp: '2026-04-02T14:00:00Z',
        actorRole: 'officer',
        note: '12-Month Release prepared for approval',
      },
      {
        type: 'release-approved',
        amountCents: 0,
        timestamp: '2026-04-03T10:00:00Z',
        actorRole: 'supervisor',
        note: '12-Month Release approved; posted to core ledger',
      },
      {
        type: 'wire-fee-debit',
        amountCents: -3500,
        timestamp: '2026-04-06T09:30:00Z',
        actorRole: 'supervisor',
        note: 'Per-disbursement wire fee',
      },
      {
        type: 'partial-disbursement',
        amountCents: -39996500,
        timestamp: '2026-04-06T09:30:00Z',
        actorRole: 'supervisor',
        note: '12-Month partial disbursement to seller; wire confirmed',
      },
    ]),
    releases: [firstRelease],
    wireInstructions: w,
  };
}

function esc011(): Escrow {
  // Gateway failure: prepared release whose id is in MOCK_FAILURE_RELEASE_IDS.
  const w = wire('Juniper Energy', '****0077', 'EVEREST-JUNIPER-2024');
  const release: Release = {
    id: 'escrow-11-release-1', // Intentionally in MOCK_FAILURE_RELEASE_IDS
    escrowId: 'ESC-011',
    status: 'pending-approval',
    preparedAt: '2026-10-07T15:45:00Z',
    preparedByRole: 'officer',
    amountCents: 35000000,
    wireInstructions: w,
    instructionReceipts: [
      {
        partyRole: 'buyer',
        signerName: 'Priya Nair',
        receivedDate: '2026-10-06',
        channel: 'secure-portal',
      },
      {
        partyRole: 'seller',
        signerName: 'Marcus Boll',
        receivedDate: '2026-10-06',
        channel: 'secure-portal',
      },
    ],
  };
  return {
    id: 'ESC-011',
    name: 'Everest / Juniper Energy Indemnity Holdback',
    dealName: 'Everest acquisition of Juniper Energy',
    buyer: {
      name: 'Everest Power Corp',
      role: 'buyer',
      signers: [signer('b1', 'Priya Nair', 'General Counsel')],
    },
    seller: {
      name: 'Juniper Energy LLC',
      role: 'seller',
      signers: [signer('s1', 'Marcus Boll', 'Managing Member')],
    },
    openedDate: '2024-09-20',
    survivalPeriodStart: '2024-09-20',
    survivalPeriodEnd: '2026-09-20',
    originalAmountCents: 35000000,
    currentBalanceCents: 35000000,
    status: 'pending-approval',
    annualInterestRate: 0.045,
    interestBeneficiary: 'seller',
    annualAdminFeeCents: 100000,
    wireFeeCents: 3500,
    releaseSchedule: [{ releaseDate: '2026-09-20', label: 'Final Release' }],
    claims: [],
    ledger: buildLedger([
      {
        type: 'initial-deposit',
        amountCents: 35000000,
        timestamp: '2024-09-20T15:00:00Z',
        actorRole: 'officer',
        note: 'Initial escrow deposit at closing',
      },
      {
        type: 'release-prepared',
        amountCents: 0,
        timestamp: '2026-10-07T15:45:00Z',
        actorRole: 'officer',
        note: 'Release prepared and submitted for supervisor approval',
      },
    ]),
    releases: [release],
    wireInstructions: w,
  };
}

/**
 * Build a fresh in-memory store. Each call returns deep-fresh objects, so the
 * RESET action restores the original seed state cleanly.
 */
export function createSeedStore(): EscrowStore {
  return {
    escrows: [
      esc001(),
      esc002(),
      esc003(),
      esc004(),
      esc005(),
      esc006(),
      esc007(),
      esc008(),
      esc009(),
      esc010(),
      esc011(),
    ],
    currentRole: 'officer',
  };
}

export { REF_ISO };
