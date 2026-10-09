# Implementation Plan — Escrow Desk PoC

This plan implements the approved spec in `.kiro/specs/escrow-desk/` (requirements, design, tasks). It does not re-decide architecture; it sequences the 21 tasks into independently verifiable steps ordered by dependency. The coding loop follows this file top to bottom.

## Global invariants (apply to every item)

- **Money is integer cents, never floats.** Every monetary field is named `*Cents` and holds an integer. Use `Math.round()` only when deriving a cent value from a rate/fraction (interest, pro-rated fees), and round once at the end.
- **Seed reference date is `2026-10-08`** — treat this as "today" in the PoC. Define it as an exported constant (e.g. `REFERENCE_DATE = new Date('2026-10-08T12:00:00Z')` or an ISO string helper) in `src/data/seed.ts` and derive all scenario-relative dates from it so scenarios stay stable. Note: `design.md` and `tasks.md` mention an older `2024-xx` reference in prose — the authoritative reference date for this build is **2026-10-08**. Scenario 4 (non-business day) still uses a concrete known holiday date (US Thanksgiving) regardless of reference date.
- **`MOCK_FAILURE_RELEASE_IDS` must contain `'escrow-11-release-1'`** and ESC-011's prepared release must use exactly that release `id`, so the demo and tests hit the real failure path.
- **Gateway is selected at runtime from `import.meta.env.VITE_CORE_GATEWAY`** (default `'mock'`) via `createGateway()` in `main.tsx` — never hardcode the mock in a component.
- **Hash router, not BrowserRouter** — use `HashRouter` from `react-router-dom` for Cloudflare Workers static compatibility.
- **Do NOT run `git init`** — a git repo already exists in the workspace. Also do not touch git config.
- **`src/lib/` is pure** — no React imports, no `Date.now()` in business logic or the gateway (determinism). Callers pass `asOf`/dates in. Reducer stays pure and synchronous; gateway calls live in `store/actions.ts`.
- **Append-only ledger** — `appendEntry` returns a new array and never mutates; there is no delete/edit action in the reducer.
- After any task that touches `src/lib/`, run `pnpm test` and confirm green before moving on.

---

# Phase 1 — Scaffold

- [ ] 1. Scaffold the Vite React-TS project in place and install dependencies.
      Run in the workspace root (the repo already has files, so scaffold into the current dir): `pnpm create vite@latest . --template react-ts` (if the CLI refuses because the dir is non-empty, accept its "ignore existing files / continue" prompt; it must not delete `.kiro/`, `docs/`, `README.md`, or `.git/`). Then install runtime dep `react-router-dom` and dev deps `tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom @types/node`.
      Files: `package.json`, `pnpm-lock.yaml`, `index.html`, `tsconfig*.json`, `src/main.tsx`, `src/App.tsx` (scaffold defaults — will be replaced later).
      Verify: `pnpm install` completes; `pnpm dev` starts a dev server without error (then stop it).

- [ ] 2. Configure Tailwind v4, Vitest, and the CSS entrypoint.
      Add the `@tailwindcss/vite` plugin to `vite.config.ts` alongside the React plugin. Add Vitest config in the same file: top of file `/// <reference types="vitest" />`, import `defineConfig` from `vite` (or from `vitest/config` to avoid the `test` typing error), and set `test: { globals: true, environment: 'jsdom', setupFiles: './src/test/setup.ts', css: true }`. Create `src/test/setup.ts` importing `@testing-library/jest-dom`. Replace `src/index.css` contents with a single `@import "tailwindcss";` line (plus any `@theme` tokens if needed later). Add scripts to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`, keep `dev`/`build`/`preview`. Confirm `main.tsx` imports `./index.css`.
      Files: `vite.config.ts`, `src/test/setup.ts`, `src/index.css`, `package.json`.
      Verify: `pnpm test` runs and reports "no test files" (or passes) without a config error; `pnpm build` produces `dist/`; `pnpm dev` renders a Tailwind-styled element (add a temporary `className="text-blue-600"` check, then remove).

- [ ] 3. Add Cloudflare Workers deploy config and env example.
      Create `wrangler.toml` (or `wrangler.jsonc`) for a static-assets Worker: a `name`, `compatibility_date`, and an assets block pointing at the build output `./dist` (modern shape: `[assets]` with `directory = "./dist"`). Because the app uses a hash router, SPA `not_found_handling` is not required, but setting `not_found_handling = "single-page-application"` is harmless and future-proofs deep links — include it. Add a `"deploy": "pnpm build && wrangler deploy"` script to `package.json`. Create `.env.example` containing `VITE_CORE_GATEWAY=mock`. Ensure `.gitignore` (from the Vite template) ignores `node_modules`, `dist`, and local `.env` (keep `.env.example` tracked).
      Files: `wrangler.toml`, `.env.example`, `package.json`, `.gitignore`.
      Verify: `pnpm build` succeeds and `dist/` exists; `wrangler.toml` parses (optional: `pnpm wrangler deploy --dry-run` if wrangler is installed/available — do not require network).

---

# Phase 2 — Types (foundation for everything)

- [ ] 4. Define all TypeScript types from the design doc.
      Create `src/types/index.ts` with every type/interface in design.md §Data Models exactly: `Role`, `EscrowStatus`, `ReleaseStatus`, `ClaimStatus`, `LedgerEntryType`, `Party`, `Signer`, `WireInstructions`, `Claim`, `LedgerEntry`, `InstructionReceipt`, `ReleaseSnapshot`, `Release`, `ReleaseSchedule`, `Escrow`, `EscrowStore`. All monetary fields are integer-cents and named `*Cents`. Keep field names and union members verbatim (downstream code and the reducer `Action` union depend on them).
      Files: `src/types/index.ts`.
      Verify: `pnpm build` (tsc) compiles with no type errors.

---

# Phase 3 — Business logic (pure, tested). Run `pnpm test` after each.

- [ ] 5. Implement the append-only ledger utility with tests.
      Create `src/lib/ledger.ts` exporting `appendEntry(ledger, entry: Omit<LedgerEntry,'id'|'runningBalanceCents'>): LedgerEntry[]`. It returns a new array (never mutates the input), computes `runningBalanceCents` from the prior tail's running balance plus `entry.amountCents` (positive = credit, negative = debit), and generates a stable deterministic `id` (e.g. `` `${type}-${index}` `` based on array length, or a passed-in id — no `Date.now()`/random). Timestamp comes from the caller via the entry object.
      Create `src/lib/ledger.test.ts`: empty ledger → first entry's runningBalance equals its amount; multiple entries accumulate; original array is not mutated (reference and length unchanged).
      Files: `src/lib/ledger.ts`, `src/lib/ledger.test.ts`.
      Verify: `pnpm test` — ledger tests pass.

- [ ] 6. Implement interest calculation with tests.
      Create `src/lib/interest.ts`: `computeAccruedInterest(escrow, asOf: Date): number` returns integer cents = (whole months since last interest-credit entry, or since opened) × `Math.round(balanceCents × annualInterestRate / 12)`; zero rate → 0. `applyMonthlyInterest(escrow, asOf): Escrow` returns a NEW escrow with an `interest-credit` ledger entry appended (via `appendEntry`) and `currentBalanceCents` increased; no mutation.
      Create `src/lib/interest.test.ts`: zero rate → no credit; 4.5% annual on $1,000,000 (100000000 cents) for 1 month → 375000 cents ($3,750); rounds to nearest cent; `applyMonthlyInterest` appends exactly one entry and updates balance.
      Files: `src/lib/interest.ts`, `src/lib/interest.test.ts`.
      Verify: `pnpm test` — interest tests pass.
      Depends on item 5 (uses `appendEntry`).

- [ ] 7. Implement fee calculation with tests.
      Create `src/lib/fees.ts`: `computeAccruedAnnualFee(escrow, asOf: Date): number` returns integer cents — pro-rated portion of `annualAdminFeeCents` since the last `annual-fee-debit` (or `openedDate`) anniversary, `Math.round`ed. `applyWireFee(escrow, role): Escrow` returns a NEW escrow with a `wire-fee-debit` entry (negative `wireFeeCents`) appended and balance reduced; no mutation.
      Create `src/lib/fees.test.ts`: annual fee pro-rated correctly at 6 months (≈ half of annual, rounded); wire fee debited and ledger entry appended; no mutation of input.
      Files: `src/lib/fees.ts`, `src/lib/fees.test.ts`.
      Verify: `pnpm test` — fees tests pass.
      Depends on item 5.

- [ ] 8. Implement releasable-balance calculation with tests.
      Create `src/lib/balance.ts`: `computeReleasableAmount(escrow, asOf: Date): ReleasableAmountBreakdown` with fields `grossBalanceCents`, `effectiveClaimReserveCents`, `accruedFeesCents`, `netReleasableCents`. Compute `effectiveClaimReserveCents` by iterating open+disputed claims sequentially, each reserving `min(claim.claimedAmountCents, remainingBalance)` and decrementing `remainingBalance`. `accruedFeesCents` = `computeAccruedAnnualFee(escrow, asOf)` + `wireFeeCents` (the fee applied on disbursement). `netReleasableCents` = `max(0, gross − reserve − fees)`.
      Create `src/lib/balance.test.ts`: no claims/no fees → releasable = full balance; partial claim reduces releasable; claim > balance → releasable 0 and effective reserve = balance; multiple claims capped correctly; fee deduction reduces releasable.
      Files: `src/lib/balance.ts`, `src/lib/balance.test.ts`.
      Verify: `pnpm test` — balance tests pass.
      Depends on item 7 (uses `computeAccruedAnnualFee`).

- [ ] 9. Implement the business-day checker and `nextBusinessDay` helper.
      Create `src/lib/businessDay.ts` exactly per design.md: `checkBusinessDay(date): Promise<BusinessDayResult>` using `fetch('https://date.nager.at/api/v3/PublicHolidays/' + year + '/US', { signal })` with an `AbortController` 3000ms timeout; parses the holiday array, matches `date.toISOString().slice(0,10)`, checks Sat/Sun; on any error/timeout returns `{ isBusinessDay: true, source: 'fallback', error }` (fail open). Also export the pure `nextBusinessDay(from: Date, holidays: string[]): Date` that advances to the next weekday whose ISO date is not in `holidays`.
      Create `src/lib/businessDay.test.ts` for the PURE part only: `nextBusinessDay` skips weekends; skips a supplied holiday ISO date; returns `from` when it is already a valid business day. (Do not unit-test the live fetch; it is verified manually in the UI.)
      Files: `src/lib/businessDay.ts`, `src/lib/businessDay.test.ts`.
      Verify: `pnpm test` — `nextBusinessDay` tests pass.

- [ ] 10. Implement the release checklist with tests.
      Create `src/lib/checklist.ts`: `evaluateChecklist(escrow, isBusinessDay: boolean, asOf: Date): ChecklistResult[]` returning six results with ids `'date' | 'claims' | 'instructions' | 'business-day' | 'amount' | 'no-duplicate'`, each `{ id, label, passed, detail }` with detail populated on pass and fail. Logic per REQ-4.1: (1) scheduled release date reached vs `asOf`; (2) no open/disputed claims reserving funds (reuse `computeReleasableAmount`); (3) instruction receipts present from both buyer and seller, each `signerName` matching a party signer; (4) `isBusinessDay`; (5) net releasable > 0 / matches expected schedule amount; (6) no existing release in `pending-approval` or `wire-pending`.
      Create `src/lib/checklist.test.ts`: build a minimal escrow fixture; all pass → 6 passed; future release date → date fails; open claim → claims fails; missing seller instruction → instructions fails; `isBusinessDay=false` → business-day fails; existing wire-pending release → no-duplicate fails.
      Files: `src/lib/checklist.ts`, `src/lib/checklist.test.ts`.
      Verify: `pnpm test` — checklist tests pass.
      Depends on items 8 and 9.

- [ ] 11. Implement the CoreLedgerGateway interface, deterministic mock, and factory, with tests.
      Create `src/lib/coreLedger.ts` with `CoreLedgerGateway`, `LedgerPostRequest`, `LedgerPostEntry`, `LedgerPostResult` exactly per design.md. Create `src/lib/mockCoreLedger.ts`: `export const MOCK_FAILURE_RELEASE_IDS = new Set(['escrow-11-release-1'])` and `class MockCoreLedgerGateway` keyed by `releaseId` for idempotency (same id → cached identical result, including cached failures), 500ms simulated delay, deterministic `confirmationRef = ` `` `MOCK-${releaseId}` `` (no `Date.now()`), failure ids return `{ success:false, error:'Core system rejected post: duplicate reference detected' }`. Create `src/lib/createGateway.ts`: `createGateway(type = 'mock')` returns `MockCoreLedgerGateway` for `'mock'`, throws on unknown type (leave a commented `fedwire` seam).
      Create `src/lib/mockCoreLedger.test.ts`: success returns `confirmationRef: 'MOCK-test-release-1'`; same releaseId twice returns identical object (idempotency); a failure id returns `success:false` with the error; failure id twice returns the same failure.
      Files: `src/lib/coreLedger.ts`, `src/lib/mockCoreLedger.ts`, `src/lib/createGateway.ts`, `src/lib/mockCoreLedger.test.ts`.
      Verify: `pnpm test` — gateway tests pass.
      Depends on item 4.

---

# Phase 4 — State & seed data

- [ ] 12. Implement seed data for all 11 scenarios.
      Create `src/data/seed.ts` exporting `REFERENCE_DATE` (2026-10-08) and `createSeedStore(): EscrowStore`. Build all 11 escrows (ESC-001…ESC-011) matching tasks.md Task 9 with realistic parties, signers, wire instructions, interest rates (include a zero-rate escrow per REQ-8.4), fees, append-only ledger history, claims, and release schedules — all amounts in integer cents, all dates derived from `REFERENCE_DATE` except Scenario 4 which uses a concrete US Thanksgiving date. Key scenario specifics: ESC-003 claim == full balance; ESC-006 buyer receipt present, seller missing; ESC-007 release `status: 'pending-approval'`; ESC-008 release `status: 'wire-pending'` (locked); ESC-009 balance 0 / `status:'closed'` with full ledger; ESC-010 two-tranche schedule, first disbursed; **ESC-011 a prepared release with `id: 'escrow-11-release-1'`** so approval hits the mock failure path. Default `currentRole: 'officer'`. `createSeedStore()` must return deep-fresh objects each call (used by `RESET`), so build from literals/factory, not shared mutable references.
      Files: `src/data/seed.ts`.
      Verify: `pnpm build` compiles with no type errors; add a temporary throwaway test (or a `vitest` sanity test) asserting `createSeedStore().escrows.length === 11` and that the ESC-011 release id is in `MOCK_FAILURE_RELEASE_IDS`, run `pnpm test`, then keep it as `src/data/seed.test.ts`.
      Depends on items 4 and 11.

- [ ] 13. Implement EscrowContext, the pure reducer, and the async action.
      Create `src/store/EscrowContext.tsx`: `EscrowProvider` taking a `gateway: CoreLedgerGateway` prop, initializing state from `createSeedStore()` via `useReducer`; a pure synchronous `reducer` handling `SET_ROLE`, `RESET` (replaces store with fresh `createSeedStore()`), `PREPARE_RELEASE`, `RELEASE_WIRE_SUBMITTING`, `RELEASE_WIRE_SUBMITTED`, `RELEASE_WIRE_FAILED`, `CONFIRM_RELEASE`, `UPDATE_CLAIM`, `APPLY_INTEREST`, `APPLY_ANNUAL_FEE` — every case returns new objects (immutable update), appends ledger entries via `appendEntry` where a transition occurs, and rejects creating a second pending/wire-pending release on the same escrow. `useEscrow()` returns `{ store, dispatch, gateway }`. Define the `Action` union here (or in `store/actions.ts`) matching design.md.
      Create `src/store/actions.ts`: `approveRelease(dispatch, gateway, escrow, release, valueDate)` — dispatches `RELEASE_WIRE_SUBMITTING`, awaits `gateway.postRelease({...})` (debit `ESCROW-${escrow.id}`, credit `escrow.wireInstructions.accountNumber`, `reference` from wire instructions, `releaseId: release.id` as idempotency key), then dispatches `RELEASE_WIRE_SUBMITTED` with `confirmationRef` or `RELEASE_WIRE_FAILED` with error. Keep the reducer out of the gateway call.
      Files: `src/store/EscrowContext.tsx`, `src/store/actions.ts`.
      Verify: `pnpm build` compiles cleanly.
      Depends on items 5, 11, 12.

---

# Phase 5 — Routing, shell, shared UI

- [ ] 14. Wire the app entry: HashRouter, provider, gateway from env.
      Rewrite `src/main.tsx` to render `<HashRouter><EscrowProvider gateway={createGateway(import.meta.env.VITE_CORE_GATEWAY)}>…routes…</EscrowProvider></HashRouter>`. Define routes `/` → `DashboardPage`, `/escrows` → `EscrowListPage`, `/escrows/:id` → `EscrowDetailPage`, all inside `AppShell`. Delete the default `App.tsx`/`App.css` boilerplate.
      Create `src/hooks/useBusinessDay.ts` wrapping `checkBusinessDay(new Date())` on mount, exposing `{ result, loading }`.
      Create `src/components/layout/AppShell.tsx` (header: logo, Dashboard / All Escrows nav links, role dropdown bound to `SET_ROLE`, Reset Data button dispatching `RESET`; amber banner when `!result.isBusinessDay` or `result.source === 'fallback'`) and `src/components/layout/Nav.tsx` if split out.
      Create placeholder `src/pages/DashboardPage.tsx`, `src/pages/EscrowListPage.tsx`, `src/pages/EscrowDetailPage.tsx` as thin shells rendering their components.
      Files: `src/main.tsx`, `src/hooks/useBusinessDay.ts`, `src/components/layout/AppShell.tsx`, `src/components/layout/Nav.tsx`, `src/pages/*.tsx`; delete `src/App.tsx`, `src/App.css`.
      Verify: `pnpm dev` — app loads at `#/`, role switcher updates state, nav links route, Reset reloads seed data (no console errors). `pnpm build` succeeds.
      Depends on items 9, 11, 13.

- [ ] 15. Implement shared presentational components.
      Create `src/components/shared/MoneyAmount.tsx` formatting integer cents to `$X,XXX.XX` (divide by 100 only at render, `Intl.NumberFormat` USD). Create `src/components/shared/StatusBadge.tsx` mapping `EscrowStatus` + release state to Nymbus-style badge colors (blue primary, amber warnings, gray/green neutral). Create `src/components/shared/ConfirmDialog.tsx` (modal with title, body/form slot, confirm/cancel) for claim resolution and release confirmations.
      Files: `src/components/shared/MoneyAmount.tsx`, `src/components/shared/StatusBadge.tsx`, `src/components/shared/ConfirmDialog.tsx`.
      Verify: `pnpm build` compiles; render `MoneyAmount` with `100000` and confirm it shows `$1,000.00` in the dev UI.
      Depends on item 4.

---

# Phase 6 — Dashboard

- [ ] 16. Implement the Dashboard.
      Create `src/components/dashboard/Dashboard.tsx`: reads escrows from `useEscrow()` and `useBusinessDay()`, groups into urgency buckets (Overdue/Due Today, Due Within 7 Days, Due Within 30 Days, Open Claims, Pending Approval) using next scheduled release date vs `REFERENCE_DATE` and `computeReleasableAmount`. Each row: escrow name, parties, balance (`MoneyAmount`), releasable (`MoneyAmount`), release date, `StatusBadge`; clicking routes to `/escrows/:id`. Hide empty buckets. Follow Nymbus style: dense tables, `border-gray-200`, no rounded corners on data tables, `text-xs text-gray-500` labels.
      Files: `src/components/dashboard/Dashboard.tsx`, `src/pages/DashboardPage.tsx` (wire in).
      Verify: `pnpm dev` — all 11 scenarios appear in correct buckets; releasable amounts correct (ESC-002 reduced, ESC-003 $0). `pnpm build` succeeds.
      Depends on items 8, 14, 15.

---

# Phase 7 — Escrow detail (tabs)

- [ ] 17. Implement EscrowDetail shell + Summary tab.
      Create `src/components/escrows/EscrowDetail.tsx`: title bar (breadcrumb back to list, escrow name, subtitle, `StatusBadge`), summary strip (original amount, current balance, open claims count, releasable, next release date), tab bar Summary | Claims | Ledger | Release (local tab state). Summary tab: deal fields (buyer/seller parties, dealName, opened/survival dates, interest rate, admin & wire fees) and authorized signers per party (name, title).
      Files: `src/components/escrows/EscrowDetail.tsx`, `src/pages/EscrowDetailPage.tsx` (resolve `:id` from route, 404-ish fallback if not found).
      Verify: `pnpm dev` — clicking an escrow from the dashboard shows correct Summary. `pnpm build` succeeds.
      Depends on items 8, 15, 16.

- [ ] 18. Implement the Claims tab.
      Create `src/components/escrows/ClaimsList.tsx`: table of claims (description, filed date, claimed amount, effective reserve from `computeReleasableAmount`'s sequential logic, status badge). Alert banner when a claim's effective reserve equals the full balance (REQ-6.4 message with amounts). Officer-only "Mark Disputed" on Open claims; "Resolve Claim" on Open (settled amount + note) and Disputed (requires `jointInstructionRef` + settled amount + note) via `ConfirmDialog`. Resolved claims in a history section below active. Every change dispatches `UPDATE_CLAIM` and appends a `claim-release`/reserve ledger entry.
      Files: `src/components/escrows/ClaimsList.tsx`, wire into `EscrowDetail`.
      Verify: `pnpm dev` — ESC-002 shows partial claim with correct effective reserve; ESC-003 shows the blocked alert; resolving a claim updates releasable immediately. `pnpm build` succeeds.
      Depends on items 8, 13, 15, 17.

- [ ] 19. Implement the Ledger tab.
      Create `src/components/escrows/LedgerTable.tsx`: read-only table (timestamp, entry type, amount via `MoneyAmount` color-coded debit red / credit green, running balance, actor role, note), newest first, no edit/delete controls (visually append-only).
      Files: `src/components/escrows/LedgerTable.tsx`, wire into `EscrowDetail`.
      Verify: `pnpm dev` — ESC-009 (closed) shows full ledger history with correct running balances. `pnpm build` succeeds.
      Depends on items 15, 17.

- [ ] 20. Implement the Release tab — checklist + prepare flow.
      Create `src/components/escrows/Checklist.tsx`: calls `evaluateChecklist(escrow, useBusinessDay().result.isBusinessDay, REFERENCE_DATE)`; renders each check as pass/fail/loading row with label + detail (business-day row shows a spinner while `useBusinessDay` loading). Shows the `ReleasableAmountBreakdown` (gross balance, claim deductions, fee deductions, net releasable). "Prepare Release" enabled only when all 6 checks pass AND role is officer AND no release in progress AND `!loading`; click dispatches `PREPARE_RELEASE`. Create `src/components/escrows/ReleaseSummary.tsx` if the release panel is split out.
      Files: `src/components/escrows/Checklist.tsx`, `src/components/escrows/ReleaseSummary.tsx`, wire into `EscrowDetail`.
      Verify: `pnpm dev` — ESC-001 all-clear with enabled button; ESC-002 claims check failed; ESC-004 business-day failed (Thanksgiving); ESC-005 date check failed. `pnpm build` succeeds.
      Depends on items 10, 13, 14, 17.

- [ ] 21. Implement the Release tab — pending-approval + approve flow.
      Extend the Release panel to handle `pending-approval`: show a summary panel; "Approve Release" visible only to Supervisor. On click, compute `valueDate` with `nextBusinessDay(approvalDate, holidays)` using holidays from `useBusinessDay`, then call `approveRelease(dispatch, gateway, escrow, release, valueDate)`. While submitting, show button loading and disable actions. On `RELEASE_WIRE_FAILED`, show an error alert with the message and leave the release at `pending-approval` (officer may retry Prepare).
      Files: `src/components/escrows/Checklist.tsx`/`ReleaseSummary.tsx` (extend), `EscrowDetail`.
      Verify: `pnpm dev` — ESC-007: Officer sees pending state, Supervisor sees Approve; ESC-011: approve as Supervisor → gateway fails → error shown, release stays `pending-approval` and does NOT advance to wire-pending. `pnpm build` succeeds.
      Depends on items 9, 13, 20.

- [ ] 22. Implement the Release tab — wire-pending + confirm flow.
      Extend the Release panel for `wire-pending`: purple wire-pending banner with core `confirmationRef` and `valueDate`; wire instructions panel (account number masked, show routing, amount, reference); instruction-receipts panel (signer, date, channel per party); approval snapshot panel (4-cell grid: balance, claims, fees, net from `ReleaseSnapshot`); lock notice that no second release can start while this wire is pending; "Confirm Wire Received" (Supervisor only) dispatching `CONFIRM_RELEASE`. On confirm: balance updates, `release-confirmed`/disbursement + `wire-fee-debit` ledger entries appended, escrow → `closed` when balance hits 0.
      Files: `src/components/escrows/*` (extend Release panel), `EscrowDetail`.
      Verify: `pnpm dev` — ESC-008 shows wire-pending + lock; Supervisor sees Confirm; confirming appends ledger entries and closes the escrow when balance reaches 0. `pnpm build` succeeds.
      Depends on items 7, 13, 21.

---

# Phase 8 — List page, full verification, deploy

- [ ] 23. Implement the EscrowList page.
      Create `src/components/escrows/EscrowList.tsx`: table of all escrows with a status filter (All / Active / Pending Wire / Closed), same columns as dashboard rows, each row links to `/escrows/:id`.
      Files: `src/components/escrows/EscrowList.tsx`, `src/pages/EscrowListPage.tsx` (wire in).
      Verify: `pnpm dev` — All Escrows lists all 11; each filter narrows correctly. `pnpm build` succeeds.
      Depends on items 15, 16.

- [ ] 24. Full build/test gate + end-to-end scenario walkthrough.
      Run the whole suite and build, then walk every seed scenario (tasks.md Task 20 list, ESC-001…ESC-011) in the dev app confirming each matches its expected state (checklist pass/fail, releasable amounts, pending/wire-pending/closed states, two-tranche schedule, and the ESC-011 failure path). Fix any regressions. Remove any temporary debug code and throwaway files.
      Files: whole `src/` as needed for fixes.
      Verify: `pnpm test` all green; `pnpm build` clean (`dist/` produced); manual walkthrough of all 11 scenarios matches expectations with no console errors.
      Depends on all prior items.

- [ ] 25. Commit, deploy, and finalize README.
      Commit the source (do NOT run `git init`; the repo already exists — stage specific new files, not `git add -A`; flag any `.env` before committing and keep it ignored). Build and deploy to Cloudflare Workers via `pnpm run deploy` (requires wrangler auth — if unavailable in this environment, note it and skip the live deploy, leaving the build verified). Update `README.md` with the live demo URL if deployed. Final commit; push to a new branch (not `main`/`master`) unless the user directs otherwise.
      Files: `README.md`, git history.
      Verify: `pnpm build` clean; `git status` shows the intended files committed; if deployed, the live URL loads the dashboard.
      Depends on item 24.

---

## Non-obvious implementation notes (from the design/requirements)

- **Fail open on the holiday API.** `checkBusinessDay` must resolve to `{ isBusinessDay: true, source: 'fallback' }` on timeout/error (3s AbortController). Blocking releases when a third-party API is down would be the wrong default. Surface the fallback as a warning banner, not a hard block.
- **`isBusinessDay` is passed into `evaluateChecklist`** — the checklist function never calls the API itself (keeps `src/lib/` pure and testable without a DOM).
- **Idempotency key is the release id.** The mock caches by `releaseId` and returns the identical result (success or failure) on replay — this is the double-post guard the user asked for; no `Date.now()` anywhere in the gateway or its refs.
- **Posting to the core ledger, not "submitting a wire."** Model the gateway as posting debit+credit ledger entries (`debitEntry`/`creditEntry`); the wire is one rail. UI copy should say the post was submitted to core banking, not pretend the money moved.
- **Value date includes weekend/holiday adjustment** via `nextBusinessDay`, computed at approval time from the already-fetched holiday list, stored on the `Release`, and shown on the wire panel.
- **Reducer stays pure/sync; gateway calls live in `store/actions.ts`** and dispatch success/failure — the reducer never performs I/O.
- **Append-only everywhere.** No reducer action edits or deletes a ledger entry; `appendEntry` returns new arrays. `RESET` replaces the store with a fresh `createSeedStore()`.
- **Double-release lock.** Once any release on an escrow is `pending-approval` or `wire-pending`, the reducer rejects preparing another and the UI shows the lock notice (REQ, no-duplicate checklist item).

## Known gaps / assumptions

- The scaffold step assumes `pnpm create vite` can initialize into a non-empty directory (it offers an "ignore/continue" option). If it refuses outright, scaffold in a temp subdir and move `src/`, `index.html`, `package.json`, config files up — without disturbing `.kiro/`, `docs/`, `README.md`, `.git/`.
- `design.md`/`tasks.md` reference an older `2024` seed reference date in prose; this plan uses **2026-10-08** per the task instruction. Scenario 4 keeps a concrete Thanksgiving date so the holiday branch is exercised regardless.
- Live Cloudflare deploy requires wrangler authentication, which may not be available in the implementation environment; the build is the hard gate and deploy is best-effort.
