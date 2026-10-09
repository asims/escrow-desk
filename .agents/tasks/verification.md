# Verification Note — Escrow Desk PoC

Reference date for all scenarios: **2026-10-08** (`REFERENCE_DATE` in `src/data/seed.ts`).

## Commands run

| Command | Result |
|---|---|
| `pnpm install` | Dependencies installed (pnpm 12.10.1 via corepack). esbuild build approved via `pnpm-workspace.yaml` `onlyBuiltDependencies`. |
| `pnpm build` (`tsc -b && vite build`) | Clean — 0 TypeScript errors, `dist/` produced. |
| `pnpm test` (`vitest run`) | **60 tests across 12 files, all passing.** |

## Test coverage by area

- `src/lib/ledger.test.ts` (3) — append-only, running balance, no mutation.
- `src/lib/interest.test.ts` (4) — zero rate, 4.5% on $1M/month = $3,750, rounding, apply.
- `src/lib/fees.test.ts` (2) — pro-rated annual fee at 6 months, wire fee debit.
- `src/lib/balance.test.ts` (5) — no claims, partial claim, claim > balance, multi-claim cap, fee deduction.
- `src/lib/businessDay.test.ts` (3) — `nextBusinessDay` weekday/weekend/holiday (pure part only; live fetch not unit-tested).
- `src/lib/checklist.test.ts` (7) — one per check plus all-pass.
- `src/lib/mockCoreLedger.test.ts` (4) — success ref, idempotency, failure, idempotent failure.
- `src/data/seed.test.ts` (6) — 11 scenarios, unique ids, ESC-011 in failure set, deep-fresh RESET, integer cents, ESC-009 closed.
- `src/store/EscrowContext.test.ts` (7) — SET_ROLE, RESET, PREPARE, double-release lock, CONFIRM→closed, FAILED stays pending, no input mutation.
- `src/components/dashboard/Dashboard.test.tsx` (2) — buckets render, ready escrow listed.
- `src/components/escrows/EscrowDetail.test.tsx` (5) — ESC-001 prepare enabled, ESC-003 prepare disabled + blocked alert, ESC-007 approve button (supervisor), ESC-008 wire-pending lock + confirm button.
- `src/data/scenarios.test.ts` (12) — end-to-end walk of all 11 seed scenarios (Task 20) plus the happy-path approve → wire-pending flow.

## Scenario walkthrough (Task 20) — automated

Each scenario is asserted in `src/data/scenarios.test.ts`:

1. ESC-001 Ready to fund — all 6 checklist items pass.
2. ESC-002 Partial claim — claims check fails; releasable reduced by $50,000 reserve.
3. ESC-003 Fully blocked — releasable = $0; claims + amount checks fail; UI shows full-balance alert.
4. ESC-004 Non-business day — business-day check fails when `isBusinessDay=false` (release date is 2024-11-28 Thanksgiving).
5. ESC-005 Not yet due — date check fails (release 2027-04-08).
6. ESC-006 Missing instruction — instructions check fails, detail names the seller.
7. ESC-007 Pending approval — status `pending-approval`; supervisor sees Approve.
8. ESC-008 Wire pending — status `wire-pending`; no-duplicate check fails; lock notice + confirm.
9. ESC-009 Fully closed — balance 0, status closed, final-disbursement in ledger.
10. ESC-010 Two-tranche — first partial disbursed (balance $400k), second upcoming.
11. ESC-011 Gateway failure — `approveRelease` hits mock failure; release stays `pending-approval` with `postError`, does NOT advance to wire-pending.

## Notes / limitations

- The live Fed holiday API (`date.nager.at`) is not called in tests; the pure `nextBusinessDay` helper is unit-tested and `checkBusinessDay` fails open by design. UI render tests stub `fetch` to reject, confirming the fail-open path.
- A live interactive dev-server walkthrough was not performed in this environment (the dev-server command is guarded). Runtime behavior is instead covered by jsdom render tests that mount the real provider, router, and components.
- Cloudflare deploy (`pnpm run deploy`) requires wrangler auth not available here; the production build is the hard gate and passes. See README for deploy instructions.

Content was rephrased for compliance with licensing restrictions where external tooling behavior is described.
