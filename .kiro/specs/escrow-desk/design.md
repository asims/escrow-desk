# Escrow Desk — Technical Design

## Overview

Single-page React application. No backend. All state lives in a React context backed by in-memory data initialized from a seed module. Business logic (checklist evaluation, balance calculations, ledger posting) lives in pure TypeScript functions, tested with Vitest, imported by UI components. The Fed holiday API is the only external HTTP call.

---

## Project Structure

```
src/
├── data/
│   └── seed.ts              # Seed data factory; returns a fresh EscrowStore
├── store/
│   ├── EscrowContext.tsx    # React context + reducer; exposes useEscrow()
│   └── actions.ts           # Async action functions (gateway calls → dispatch)
├── lib/
│   ├── checklist.ts         # Pure fn: evaluateChecklist(escrow, release, isBusinessDay)
│   ├── balance.ts           # Pure fn: computeReleasableAmount(escrow)
│   ├── ledger.ts            # Pure fn: appendEntry(ledger, entry) → new ledger
│   ├── interest.ts          # Pure fn: computeAccruedInterest(escrow, asOf)
│   ├── fees.ts              # Pure fn: computeAccruedFees(escrow, asOf)
│   ├── businessDay.ts       # Fetches Fed holiday API; returns { isBusinessDay, holidayName }
│   ├── coreLedger.ts        # CoreLedgerGateway interface + types
│   ├── mockCoreLedger.ts    # MockCoreLedgerGateway; idempotent; intentional failure set
│   └── createGateway.ts     # Factory: reads VITE_CORE_GATEWAY, returns gateway instance
├── hooks/
│   └── useBusinessDay.ts    # React hook wrapping businessDay.ts; exposes { result, loading }
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx     # Header (role switcher, reset, date/holiday banner), nav sidebar
│   │   └── Nav.tsx
│   ├── dashboard/
│   │   └── Dashboard.tsx    # Morning view: grouped urgency sections
│   ├── escrows/
│   │   ├── EscrowList.tsx   # Filterable list of all escrows
│   │   ├── EscrowDetail.tsx # Tabbed detail: Summary | Claims | Ledger | Release
│   │   ├── ReleaseSummary.tsx
│   │   ├── Checklist.tsx
│   │   ├── ClaimsList.tsx
│   │   └── LedgerTable.tsx
│   └── shared/
│       ├── StatusBadge.tsx
│       ├── MoneyAmount.tsx
│       └── ConfirmDialog.tsx
├── pages/
│   ├── DashboardPage.tsx
│   ├── EscrowListPage.tsx
│   └── EscrowDetailPage.tsx
├── types/
│   └── index.ts             # All TypeScript types/interfaces
└── main.tsx
```

Tests live alongside source:
```
src/lib/checklist.test.ts
src/lib/balance.test.ts
src/lib/interest.test.ts
src/lib/fees.test.ts
src/lib/mockCoreLedger.test.ts   # Covers idempotency and intentional failure path
```

---

## Data Models

```typescript
// types/index.ts

// All monetary values are stored as integer cents (e.g., $1,000.00 = 100000).
// Never use floating point for money calculations. Use Math.round() when
// computing interest or fee fractions.

export type Role = 'officer' | 'supervisor';

export type EscrowStatus =
  | 'active'          // Normal operating state
  | 'pending-approval'// Release prepared, awaiting supervisor
  | 'wire-pending'    // Approved, post submitted to core ledger
  | 'closed';         // All funds disbursed

export type ReleaseStatus =
  | 'none'            // No release in progress
  | 'pending-approval'
  | 'submitting'      // Gateway call in flight
  | 'wire-pending'    // Post accepted by core ledger
  | 'failed'          // Gateway rejected the post
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
  name: string;                // e.g., "Acme Acquisition Corp"
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
  reference: string;          // Wire memo / deal reference
}

export interface Claim {
  id: string;
  description: string;
  filedDate: string;           // ISO date string
  claimedAmountCents: number;  // Integer cents
  resolvedAmountCents?: number;// Integer cents; may be less than claimedAmountCents
  status: ClaimStatus;
  resolutionNote?: string;
  resolutionDate?: string;
  jointInstructionRef?: string;// Required to resolve Disputed claims
}

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  amountCents: number;         // Positive = credit, negative = debit; integer cents
  runningBalanceCents: number; // Integer cents
  timestamp: string;           // ISO datetime string
  actorRole: Role;
  note?: string;
}

export interface InstructionReceipt {
  partyRole: 'buyer' | 'seller';
  signerName: string;          // Must match a Signer in the party
  receivedDate: string;        // ISO date string
  channel: 'secure-portal' | 'email' | 'physical';
}

export interface ReleaseSnapshot {
  takenAt: string;             // ISO datetime; moment of supervisor approval
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
  valueDate?: string;          // ISO date — next valid business day on/after approval date
  preparedByRole: Role;
  approvedByRole?: Role;
  amountCents: number;         // Integer cents
  wireInstructions: WireInstructions;
  instructionReceipts: InstructionReceipt[]; // One per party
  snapshot?: ReleaseSnapshot;
  confirmationRef?: string;    // Set by core ledger on success
  postError?: string;          // Set on gateway failure
}

export interface ReleaseSchedule {
  releaseDate: string;         // ISO date string
  expectedAmountCents?: number;// Integer cents; if null, release full remaining balance
  label: string;               // e.g., "12-Month Release", "Final Release"
}

export interface Escrow {
  id: string;
  name: string;                // e.g., "Acme / Beta Corp Indemnity Holdback"
  dealName: string;
  buyer: Party;
  seller: Party;
  openedDate: string;          // ISO date string
  survivalPeriodStart: string;
  survivalPeriodEnd: string;
  originalAmountCents: number; // Integer cents
  currentBalanceCents: number; // Integer cents
  status: EscrowStatus;
  // Interest
  annualInterestRate: number;  // 0.045 = 4.5%; 0 = non-interest-bearing
  interestBeneficiary: 'buyer' | 'seller';
  // Fees
  annualAdminFeeCents: number; // Integer cents, flat per year
  wireFeeCents: number;        // Integer cents, per disbursement
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
```

---

## Release State Machine

```
          [Officer: Prepare Release]
                     │
                     ▼
              pending-approval
                     │
          [Supervisor: Approve]
                     │
                     ▼
              wire-pending  ──── locked; no second approval possible
                     │
       [Auto callback OR Supervisor: Confirm]
                     │
                     ▼
               confirmed
                     │
          [if balance = 0]
                     │
                     ▼
            escrow → closed
```

State is stored on the `Release` object. The `Escrow.status` reflects the active release status when one exists:
- `active` — no release in progress, or all prior releases confirmed
- `pending-approval` — mirrors the active release
- `wire-pending` — mirrors the active release
- `closed` — all disbursements confirmed and balance is zero

Guard: a new release cannot be prepared if any release on the escrow has status `pending-approval` or `wire-pending`.

---

## Business Logic Layer (`src/lib/`)

All functions are pure (no side effects, no React imports). Each has a corresponding test file.

### `balance.ts`

```typescript
export function computeReleasableAmount(escrow: Escrow, asOf: Date): ReleasableAmountBreakdown

interface ReleasableAmountBreakdown {
  grossBalanceCents: number;
  effectiveClaimReserveCents: number; // sum of min(claim.amountCents, remaining) for open/disputed
  accruedFeesCents: number;           // unbilled annual fee portion + wire fee if applicable
  netReleasableCents: number;
}
```

### `checklist.ts`

```typescript
export function evaluateChecklist(
  escrow: Escrow,
  isBusinessDay: boolean,
  asOf: Date
): ChecklistResult[]

interface ChecklistResult {
  id: string;          // 'date' | 'claims' | 'instructions' | 'business-day' | 'amount' | 'no-duplicate'
  label: string;
  passed: boolean;
  detail: string;      // Human-readable explanation; populated whether pass or fail
}
```

The checklist is a pure function — the UI just renders what it returns. Tests cover every named scenario from the seed data.

### `ledger.ts`

```typescript
export function appendEntry(
  ledger: LedgerEntry[],
  entry: Omit<LedgerEntry, 'id' | 'runningBalance'>
): LedgerEntry[]
// Returns a new array (never mutates); calculates runningBalance from prior tail.
```

### `interest.ts`

```typescript
export function computeAccruedInterest(escrow: Escrow, asOf: Date): number
// Returns integer cents. Months since last interest credit × Math.round(balanceCents × annualRate / 12)

export function applyMonthlyInterest(escrow: Escrow, asOf: Date): Escrow
// Returns new Escrow with ledger entry appended and currentBalanceCents updated
```

### `fees.ts`

```typescript
export function computeAccruedAnnualFee(escrow: Escrow, asOf: Date): number
// Returns integer cents. Pro-rated portion of annualAdminFeeCents since last anniversary debit

export function applyWireFee(escrow: Escrow, role: Role): Escrow
// Returns new Escrow with wire fee debit ledger entry appended and currentBalanceCents updated
```

### `businessDay.ts`

```typescript
export async function checkBusinessDay(date: Date): Promise<BusinessDayResult>

interface BusinessDayResult {
  isBusinessDay: boolean;
  holidayName?: string;    // Set when isBusinessDay is false due to a holiday
  source: 'api' | 'fallback';
  error?: string;
}
```

**Fed holiday API:** Uses the publicly-accessible [Nager.Date API](https://date.nager.at/api/v3/PublicHolidays/{year}/US) — no API key required. We call `GET https://date.nager.at/api/v3/PublicHolidays/{year}/US`, filter for the current date, and also check if the day is a Saturday or Sunday.

**Timeout and failure handling:** The fetch uses an `AbortController` with a 3-second timeout. Both network errors and timeouts resolve to the same fallback: `{ isBusinessDay: true, source: 'fallback', error: '...' }`. Failing open (assuming a business day) is the right default — failing closed would block all releases whenever the third-party API is unavailable.

```typescript
const TIMEOUT_MS = 3000;

export async function checkBusinessDay(date: Date): Promise<BusinessDayResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const year = date.getFullYear();
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/US`,
      { signal: controller.signal }
    );
    const holidays: { date: string; name: string }[] = await res.json();
    const today = date.toISOString().slice(0, 10);
    const holiday = holidays.find(h => h.date === today);
    const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (holiday) return { isBusinessDay: false, holidayName: holiday.name, source: 'api' };
    if (isWeekend) return { isBusinessDay: false, holidayName: 'Weekend', source: 'api' };
    return { isBusinessDay: true, source: 'api' };
  } catch (err) {
    return { isBusinessDay: true, source: 'fallback', error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
```

**Note for production:** Nager.Date is a free public API with no SLA. A production system would cache the holiday list server-side (it changes once a year) rather than calling a third-party on every page load.

`businessDay.ts` also exports a pure helper used when computing value dates:

```typescript
export function nextBusinessDay(from: Date, holidays: string[]): Date
// Advances from `from` until it lands on a weekday that is not in `holidays` (ISO date strings).
// Used to compute Release.valueDate at approval time.
```

---

## Core Ledger Gateway

The gateway abstracts the connection to the bank's core system. The PoC ships a mock; a real integration swaps in a concrete implementation without touching the reducer or UI.

```typescript
// src/lib/coreLedger.ts

export interface CoreLedgerGateway {
  postRelease(request: LedgerPostRequest): Promise<LedgerPostResult>;
}

export interface LedgerPostRequest {
  releaseId: string;           // Idempotency key — same ID always returns same result
  escrowId: string;
  amountCents: number;         // Integer cents
  valueDate: string;           // ISO date — next valid business day on/after approval date
  debitEntry: LedgerPostEntry;
  creditEntry: LedgerPostEntry;
  reference: string;           // Deal/wire memo reference
}

export interface LedgerPostEntry {
  accountRef: string;          // GL account or wire destination reference
  description: string;
}

export interface LedgerPostResult {
  success: boolean;
  confirmationRef?: string;    // Core system reference; stable for a given releaseId
  error?: string;
}
```

### Mock Implementation

```typescript
// src/lib/mockCoreLedger.ts

// Release IDs in this set will always fail — used for the demo error path
export const MOCK_FAILURE_RELEASE_IDS = new Set<string>(['escrow-11-release-1']);

export class MockCoreLedgerGateway implements CoreLedgerGateway {
  private readonly results = new Map<string, LedgerPostResult>();

  async postRelease(req: LedgerPostRequest): Promise<LedgerPostResult> {
    // Return cached result for idempotency — same releaseId, same outcome
    if (this.results.has(req.releaseId)) {
      return this.results.get(req.releaseId)!;
    }
    await new Promise(r => setTimeout(r, 500)); // Simulate async
    const result: LedgerPostResult = MOCK_FAILURE_RELEASE_IDS.has(req.releaseId)
      ? { success: false, error: 'Core system rejected post: duplicate reference detected' }
      : { success: true, confirmationRef: `MOCK-${req.releaseId}` };
    this.results.set(req.releaseId, result);
    return result;
  }
}
```

### Gateway Selection

Selected via `VITE_CORE_GATEWAY` environment variable. Default is `mock`.

```typescript
// src/lib/createGateway.ts
export function createGateway(type = 'mock'): CoreLedgerGateway {
  if (type === 'mock') return new MockCoreLedgerGateway();
  // Future: if (type === 'fedwire') return new FedwireGateway();
  throw new Error(`Unknown gateway type: ${type}`);
}
```

```typescript
// main.tsx
const gateway = createGateway(import.meta.env.VITE_CORE_GATEWAY);
<EscrowProvider gateway={gateway}>...</EscrowProvider>
```

### Async Action Pattern (pure reducer)

The reducer stays pure and synchronous. The gateway call happens in an async action function that dispatches success or failure:

```typescript
// store/actions.ts
export async function approveRelease(
  dispatch: Dispatch<Action>,
  gateway: CoreLedgerGateway,
  escrow: Escrow,
  release: Release,
  valueDate: string
) {
  dispatch({ type: 'RELEASE_WIRE_SUBMITTING', escrowId: escrow.id, releaseId: release.id });
  const result = await gateway.postRelease({
    releaseId: release.id,
    escrowId: escrow.id,
    amountCents: release.amountCents,
    valueDate,
    debitEntry: { accountRef: `ESCROW-${escrow.id}`, description: 'Escrow disbursement debit' },
    creditEntry: { accountRef: escrow.wireInstructions.accountNumber, description: 'Beneficiary credit' },
    reference: escrow.wireInstructions.reference,
  });
  if (result.success) {
    dispatch({ type: 'RELEASE_WIRE_SUBMITTED', escrowId: escrow.id, releaseId: release.id, confirmationRef: result.confirmationRef! });
  } else {
    dispatch({ type: 'RELEASE_WIRE_FAILED', escrowId: escrow.id, releaseId: release.id, error: result.error! });
  }
}
```

The reducer handles `RELEASE_WIRE_SUBMITTING` (sets a `submitting` flag), `RELEASE_WIRE_SUBMITTED` (advances to `wire-pending`, stores `confirmationRef`), and `RELEASE_WIRE_FAILED` (resets to `pending-approval`, stores error for display).

### Value Date

`valueDate` is computed before calling `approveRelease` by advancing from the approval date to the next valid business day using the holiday list already fetched by `useBusinessDay`. A `nextBusinessDay(date, holidays)` helper in `businessDay.ts` handles this. The value date is stored on the `Release` object and shown on the release detail and wire instructions panel.

---

## State Management

A single React context (`EscrowContext`) holds the full `EscrowStore` and the `CoreLedgerGateway` instance. Synchronous mutations go through a pure reducer:

```typescript
type Action =
  | { type: 'SET_ROLE'; role: Role }
  | { type: 'RESET' }
  | { type: 'PREPARE_RELEASE'; escrowId: string }
  | { type: 'RELEASE_WIRE_SUBMITTING'; escrowId: string; releaseId: string }
  | { type: 'RELEASE_WIRE_SUBMITTED'; escrowId: string; releaseId: string; confirmationRef: string }
  | { type: 'RELEASE_WIRE_FAILED'; escrowId: string; releaseId: string; error: string }
  | { type: 'CONFIRM_RELEASE'; escrowId: string; releaseId: string }
  | { type: 'UPDATE_CLAIM'; escrowId: string; claim: Claim }
  | { type: 'APPLY_INTEREST'; escrowId: string }
  | { type: 'APPLY_ANNUAL_FEE'; escrowId: string };
```

Async operations (gateway calls) are handled in action functions in `store/actions.ts`, not in the reducer. `RESET` replaces the store with a fresh call to `seed()`. All reducer cases produce new objects via immutable update.

---

## Routing

Client-side routing with `react-router-dom` (hash router for Cloudflare Workers static compatibility):

| Route | Component |
|---|---|
| `/` | `DashboardPage` |
| `/escrows` | `EscrowListPage` |
| `/escrows/:id` | `EscrowDetailPage` |

---

## Component Responsibilities

**`AppShell`** — renders header with role dropdown, reset button, today's date, and business day status banner. Wraps all pages.

**`Dashboard`** — calls `useBusinessDay()`, reads from `useEscrow()`, groups escrows into urgency buckets using `computeReleasableAmount` and release dates. Renders `EscrowCard` rows per bucket.

**`EscrowDetail`** — tabbed layout: Summary tab shows deal info and authorized signers; Claims tab renders `ClaimsList`; Ledger tab renders `LedgerTable`; Release tab renders `Checklist` and action buttons.

**`Checklist`** — calls `evaluateChecklist()` and renders each result as a pass/fail row. Does not contain logic itself. While `useBusinessDay` is loading, the business-day checklist item renders a spinner and the Prepare Release button is disabled. Once resolved, the item shows pass/fail normally.

**`ClaimsList`** — renders claims with status badges and action buttons (Mark Disputed, Mark Resolved). Opens `ConfirmDialog` with form for resolution details.

**`LedgerTable`** — read-only table of ledger entries, newest first, with running balance column.

---

## Fed Holiday API Integration

```
useBusinessDay hook
  └── calls businessDay.ts on mount
       └── GET https://date.nager.at/api/v3/PublicHolidays/{year}/US
            ├── success → filter for today, check weekend → BusinessDayResult
            └── failure → { isBusinessDay: true, source: 'fallback', error }
```

The result flows down:
1. `AppShell` shows a banner if `!isBusinessDay`
2. `Dashboard` shows the status indicator
3. `evaluateChecklist()` receives `isBusinessDay` as a parameter — it does not call the API itself

---

## Seed Data Shape

`seed.ts` exports a `createSeedStore(): EscrowStore` function. Each of the 10 named scenarios is a named constant used to build the escrows array. All monetary values are integer cents. Dates are computed relative to a fixed reference date (e.g., `2024-10-01`) so scenarios remain stable regardless of when the app is run. Scenario 4 (non-business day) uses a known US federal holiday date (e.g., `2024-11-28` — Thanksgiving). Scenario 11 (gateway failure) seeds a release whose ID is in `MOCK_FAILURE_RELEASE_IDS`, so the demo and tests can exercise the error path and verify the UI shows the error and the release does not advance to `wire-pending`.

---

## Cloudflare Workers Deployment

`wrangler.toml` configures a static assets worker. Build output is `dist/`. No server-side logic — the worker serves the Vite build as static files. Hash router avoids server-side route handling requirements.

---

## Key Constraints

- No mutations to seed data — all reducer actions return new objects
- `src/lib/` functions have no React dependencies — importable in tests without a DOM
- Ledger entries are never removed from the array — append-only enforced by type (no delete action in the reducer)
- The `Release` object is immutable once in `wire-pending` — the reducer rejects any action that would create a second pending release for the same escrow
