# Escrow Desk — Implementation Tasks

Work through these in order. Each task should pass its own verification before moving to the next. All monetary values are integer cents. Run `pnpm test` after any task that touches `src/lib/`.

---

## Phase 1 — Project Scaffold

### Task 1: Initialize Vite + React + TypeScript project
- Run `pnpm create vite@latest . -- --template react-ts` in the workspace root
- Install dependencies: `tailwindcss`, `@tailwindcss/vite`, `react-router-dom`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- Configure Tailwind in `vite.config.ts` using `@tailwindcss/vite` plugin
- Configure Vitest in `vite.config.ts` with `environment: 'jsdom'` and `setupFiles`
- Add `wrangler.toml` for Cloudflare Workers static site deployment (build output: `dist/`)
- Add `.env.example` with `VITE_CORE_GATEWAY=mock`
- Verify: `pnpm dev` starts, `pnpm test` runs (no tests yet, just confirms config), `pnpm build` produces `dist/`

### Task 2: Define TypeScript types
- Create `src/types/index.ts` with all types from the design doc:
  - `Role`, `EscrowStatus`, `ReleaseStatus`, `ClaimStatus`, `LedgerEntryType`
  - `Party`, `Signer`, `WireInstructions`, `Claim`, `LedgerEntry`
  - `InstructionReceipt`, `ReleaseSnapshot`, `Release`, `ReleaseSchedule`, `Escrow`
  - `EscrowStore`
  - All monetary fields as integer cents (named `*Cents`)
- Verify: `pnpm build` compiles with no type errors

---

## Phase 2 — Business Logic

### Task 3: Implement ledger utility
- Create `src/lib/ledger.ts`
  - `appendEntry(ledger, entry): LedgerEntry[]` — returns new array, calculates `runningBalanceCents` from prior tail, generates a stable `id`
- Create `src/lib/ledger.test.ts`
  - Test: empty ledger → first entry has correct runningBalance
  - Test: multiple entries accumulate correctly
  - Test: original array is not mutated
- Verify: `pnpm test` passes

### Task 4: Implement balance calculation
- Create `src/lib/balance.ts`
  - `computeReleasableAmount(escrow, asOf): ReleasableAmountBreakdown`
  - `effectiveClaimReserveCents`: sum of `min(claim.claimedAmountCents, remainingBalance)` for open/disputed claims, computed sequentially
  - `accruedFeesCents`: pro-rated annual fee since last anniversary debit + wire fee
  - `netReleasableCents`: grossBalance − claimReserve − fees (floor at 0)
- Create `src/lib/balance.test.ts`
  - Test: no claims, no fees → releasable = full balance
  - Test: partial claim → reduces releasable
  - Test: claim > balance → releasable = 0, effectiveReserve = balance
  - Test: multiple claims → capped correctly
  - Test: fee deduction reduces releasable
- Verify: `pnpm test` passes

### Task 5: Implement interest and fee calculations
- Create `src/lib/interest.ts`
  - `computeAccruedInterest(escrow, asOf): number` — integer cents, `Math.round`
  - `applyMonthlyInterest(escrow, asOf): Escrow` — returns new Escrow with ledger entry and updated balance
- Create `src/lib/fees.ts`
  - `computeAccruedAnnualFee(escrow, asOf): number` — integer cents, pro-rated
  - `applyWireFee(escrow, role): Escrow` — returns new Escrow with fee debit ledger entry and updated balance
- Create `src/lib/interest.test.ts` and `src/lib/fees.test.ts`
  - Test: zero rate → no interest credit
  - Test: 4.5% annual on $1,000,000 for 1 month → $3,750 (375000 cents)
  - Test: interest rounds to nearest cent
  - Test: annual fee pro-rated correctly at 6 months
  - Test: wire fee deducted and ledger entry appended
- Verify: `pnpm test` passes

### Task 6: Implement business day checker
- Create `src/lib/businessDay.ts`
  - `checkBusinessDay(date): Promise<BusinessDayResult>` — fetches Nager.Date API with 3-second AbortController timeout; falls back to `{ isBusinessDay: true, source: 'fallback' }` on error
  - `nextBusinessDay(from, holidays): Date` — pure function, advances to next weekday not in the holidays list
- Verify: manual test — call `checkBusinessDay(new Date())` in browser console and confirm API response

### Task 7: Implement release checklist
- Create `src/lib/checklist.ts`
  - `evaluateChecklist(escrow, isBusinessDay, asOf): ChecklistResult[]`
  - Six checks as per requirements: date, claims, instructions, business-day, amount, no-duplicate
  - Each result includes `id`, `label`, `passed`, `detail`
- Create `src/lib/checklist.test.ts`
  - Test each check independently against a minimal escrow fixture
  - Test: all pass → 6 passed results
  - Test: release date in future → date check fails
  - Test: open claim → claims check fails
  - Test: missing buyer instruction → instructions check fails
  - Test: `isBusinessDay = false` → business-day check fails
  - Test: existing wire-pending release → no-duplicate check fails
- Verify: `pnpm test` passes

### Task 8: Implement CoreLedgerGateway and mock
- Create `src/lib/coreLedger.ts` — `CoreLedgerGateway` interface, `LedgerPostRequest`, `LedgerPostResult`
- Create `src/lib/mockCoreLedger.ts` — `MockCoreLedgerGateway`
  - Idempotency map keyed by `releaseId`
  - `MOCK_FAILURE_RELEASE_IDS` set containing `'escrow-11-release-1'`
  - 500ms simulated delay
  - Deterministic ref: `MOCK-${releaseId}`
- Create `src/lib/createGateway.ts` — factory reading `import.meta.env.VITE_CORE_GATEWAY`
- Create `src/lib/mockCoreLedger.test.ts`
  - Test: success path returns `confirmationRef: 'MOCK-test-release-1'`
  - Test: same releaseId called twice returns identical result (idempotency)
  - Test: failure releaseId returns `success: false` with error message
  - Test: failure releaseId called twice returns same failure (idempotent failure)
- Verify: `pnpm test` passes

---

## Phase 3 — State Management

### Task 9: Implement seed data
- Create `src/data/seed.ts` — `createSeedStore(): EscrowStore`
- All 11 named scenarios (all monetary values in integer cents):
  1. **Ready to fund** — ESC-001: survival expired, 0 claims, both instructions on file
  2. **Partial claim** — ESC-002: survival expired, 1 open claim for partial amount
  3. **Fully blocked** — ESC-003: survival expired, 1 open claim = full balance
  4. **Non-business day** — ESC-004: release date 2024-11-28 (Thanksgiving)
  5. **Not yet due** — ESC-005: survival period ends 6 months from reference date
  6. **Missing instruction** — ESC-006: buyer instruction on file, seller not received
  7. **Pending approval** — ESC-007: release already prepared, status `pending-approval`
  8. **Wire pending** — ESC-008: release in `wire-pending` state, locked
  9. **Fully closed** — ESC-009: balance = 0, status `closed`, full ledger history
  10. **Two-tranche** — ESC-010: 12-month partial release disbursed, 18-month final upcoming
  11. **Gateway failure** — ESC-011: release prepared, releaseId = `'escrow-11-release-1'` (in MOCK_FAILURE_RELEASE_IDS)
- Each escrow has realistic: parties, signers, wire instructions, ledger history, interest rate, fees, release schedule
- Reference date: `2026-10-08` (today in the PoC)
- Verify: `createSeedStore()` returns valid `EscrowStore` with no TypeScript errors

### Task 10: Implement EscrowContext and reducer
- Create `src/store/EscrowContext.tsx`
  - `EscrowProvider` — accepts `gateway: CoreLedgerGateway` prop; initializes from `createSeedStore()`
  - Pure reducer handling all sync actions: `SET_ROLE`, `RESET`, `PREPARE_RELEASE`, `RELEASE_WIRE_SUBMITTING`, `RELEASE_WIRE_SUBMITTED`, `RELEASE_WIRE_FAILED`, `CONFIRM_RELEASE`, `UPDATE_CLAIM`, `APPLY_INTEREST`, `APPLY_ANNUAL_FEE`
  - `useEscrow()` hook exposing `{ store, dispatch, gateway }`
- Create `src/store/actions.ts`
  - `approveRelease(dispatch, gateway, escrow, release, holidays)` — async; computes valueDate via `nextBusinessDay`; calls gateway; dispatches success or failure
- Verify: `pnpm build` compiles cleanly

### Task 11: Implement routing and AppShell
- Create `src/main.tsx` — wraps app in `HashRouter` and `EscrowProvider` with `createGateway()`
- Create `src/components/layout/AppShell.tsx`
  - Header: logo, Dashboard / All Escrows nav links, role dropdown, Reset Data button
  - Business day status: calls `useBusinessDay()`; shows amber banner if not a business day or API fallback warning
- Create `src/hooks/useBusinessDay.ts` — wraps `checkBusinessDay` with `{ result, loading }` state
- Create `src/pages/DashboardPage.tsx`, `EscrowListPage.tsx`, `EscrowDetailPage.tsx` as empty shells
- Verify: `pnpm dev` — app loads, role switcher works, nav links route correctly, reset button reloads seed data

---

## Phase 4 — UI: Dashboard

### Task 12: Implement Dashboard
- Create `src/components/dashboard/Dashboard.tsx`
  - Reads escrows from `useEscrow()`
  - Groups into urgency buckets: Overdue/Due Today, Due Within 7 Days, Due Within 30 Days, Open Claims, Pending Approval
  - Each row shows: escrow name, parties, balance, releasable amount, release date, status badge
  - Clicking a row navigates to `/escrows/:id`
  - Empty buckets are hidden
- Create `src/components/shared/StatusBadge.tsx` — maps `EscrowStatus` + release state to badge color/label
- Create `src/components/shared/MoneyAmount.tsx` — formats integer cents to `$X,XXX.XX`
- Verify: `pnpm dev` — dashboard shows all 11 scenarios in correct buckets; releasable amounts are correct

---

## Phase 5 — UI: Escrow Detail

### Task 13: Implement EscrowDetail shell and Summary tab
- Create `src/components/escrows/EscrowDetail.tsx`
  - Title bar: breadcrumb, escrow name, subtitle, status badge
  - Summary strip: original amount, current balance, open claims count, releasable, release date
  - Tab bar: Summary | Claims | Ledger | Release
  - Summary tab: deal fields (parties, dates, interest rate, fees) + authorized signers per party
- Verify: `pnpm dev` — clicking an escrow from dashboard shows correct detail

### Task 14: Implement Claims tab
- Create `src/components/escrows/ClaimsList.tsx`
  - Claims table: description, filed date, claimed amount, effective reserve, status badge
  - Alert when any claim's effective reserve = full balance
  - "Mark Disputed" button on Open claims (officer role)
  - "Resolve Claim" button on Open and Disputed claims
    - Open: officer can resolve with settled amount + note
    - Disputed: requires joint instruction reference + settled amount + note
  - Resolved claims shown in history section below active claims
  - All status changes dispatch `UPDATE_CLAIM` and append ledger entry
- Verify: `pnpm dev` — ESC-002 shows partial claim with correct effective reserve; ESC-003 shows blocked alert; resolving a claim updates releasable amount immediately

### Task 15: Implement Ledger tab
- Create `src/components/escrows/LedgerTable.tsx`
  - Read-only table: timestamp, entry type, amount (formatted, color-coded debit/credit), running balance, actor role, note
  - Newest entries first
  - No edit/delete controls — visually append-only
- Verify: `pnpm dev` — ESC-009 (closed) shows full ledger history; amounts display correctly

### Task 16: Implement Release tab — checklist and prepare flow
- Create `src/components/escrows/Checklist.tsx`
  - Calls `evaluateChecklist()` with current escrow state and `useBusinessDay()` result
  - Renders each check as pass ✅ / fail ❌ / loading ⏳ row with label and detail text
  - Shows `ReleasableAmountBreakdown` (gross balance, claim deductions, fee deductions, net releasable)
  - "Prepare Release" button: enabled only when all 6 checks pass AND role is Officer AND no release in progress AND `!loading`
  - Clicking dispatches `PREPARE_RELEASE`
- Verify: `pnpm dev` — ESC-001 shows all-clear checklist with enabled button; ESC-002 shows claims check failed; ESC-004 shows business-day check failed (date is Thanksgiving); ESC-005 shows date check failed

### Task 17: Implement Release tab — pending approval and approve flow
- Extend Release tab to handle `pending-approval` state
  - Shows "Pending Supervisor Approval" state panel with release summary
  - "Approve Release" button: visible only when role is Supervisor
  - Clicking calls `approveRelease()` action (which calls gateway, dispatches to reducer)
  - While submitting: show loading state on button, disable all actions
  - On `RELEASE_WIRE_FAILED`: show error alert with message; release reverts to `pending-approval`; officer can retry Prepare if needed
- Verify: `pnpm dev` — ESC-007: switch to Officer → see pending state; switch to Supervisor → see Approve button; ESC-011: approve → gateway fails → error shown, release stays at pending-approval

### Task 18: Implement Release tab — wire pending and confirm flow
- Extend Release tab to handle `wire-pending` state (matching wire-pending wireframe)
  - Purple wire-pending banner with core ref and value date
  - Wire instructions panel (account number masked)
  - Instruction receipts panel (signer, date, channel per party)
  - Approval snapshot panel (4-cell grid: balance, claims, fees, net)
  - Lock notice: "A second release cannot be initiated while this wire is pending"
  - "Confirm Wire Received" button: Supervisor only; dispatches `CONFIRM_RELEASE`
  - On confirm: escrow balance updates, ledger entry appended, status → closed if balance = 0
- Verify: `pnpm dev` — ESC-008 shows wire-pending state correctly; switching to Supervisor shows confirm button; confirming closes the escrow and shows closed state in ledger

---

## Phase 6 — Polish and Verification

### Task 19: Implement EscrowList page
- Create `src/components/escrows/EscrowList.tsx`
  - Table of all escrows with status filter (All / Active / Pending Wire / Closed)
  - Same columns as dashboard rows
  - Each row links to `/escrows/:id`
- Verify: `pnpm dev` — All Escrows shows all 11 scenarios; filter works correctly

### Task 20: End-to-end scenario verification
Walk through each of the 11 seed scenarios and verify the UI matches the expected state:
1. ESC-001: All checklist items pass; "Prepare Release" enabled as Officer
2. ESC-002: Claims check fails; releasable shows reduced amount
3. ESC-003: Claims check fails; releasable = $0; alert shown
4. ESC-004: Business day check fails (Thanksgiving)
5. ESC-005: Date check fails; days remaining shown
6. ESC-006: Instructions check fails; missing seller instruction called out
7. ESC-007: Pending approval state; Supervisor sees Approve button
8. ESC-008: Wire pending state; locked; Supervisor sees Confirm button
9. ESC-009: Closed state; full ledger history visible; no actions
10. ESC-010: Two-tranche; first disbursement in ledger; second upcoming in release schedule
11. ESC-011: Approve as Supervisor → gateway fails → error shown → release stays at pending-approval

### Task 21: Commit, push, and deploy
- Commit all source files
- `pnpm build` — verify dist/ is clean
- Deploy to Cloudflare Workers: `pnpm run deploy`
- Update README.md with live demo URL
- Final commit and push
