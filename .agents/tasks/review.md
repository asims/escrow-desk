# Escrow Desk PoC — implementation review

The implementation delivers all 21 tasks from the spec: a Vite/React/TS single-page app with pure-TypeScript business logic, 11 seeded escrow scenarios, a dual-control release flow, and a swappable core-ledger gateway selected by env var. Money is handled as integer cents end to end, the reducer stays pure, and the gateway call lives in an async action rather than the reducer — matching the architecture the user asked for during design. The Fed holiday API is called with a 3-second AbortController timeout and fails open. Per instructions I did not re-run the build or tests; verification.md records a clean `pnpm build` and 60 passing tests across 12 files, and I spot-checked the architecture-critical source directly.

Watch for: the `UPDATE_CLAIM` reducer case uses `new Date().toISOString()` as a timestamp fallback (confirmed) — a small deviation from strict reducer purity, non-blocking for a PoC. No float money, no React imports in `src/lib/`, double-release lock enforced in both reducer and UI.

**Verdict**: APPROVED

## High-level view

The gateway seam is clean. `createGateway.ts` reads `VITE_CORE_GATEWAY` (default `mock`) and `main.tsx` passes the resulting instance into `EscrowProvider` as a prop — the mock is never hardcoded in a component. The mock keys idempotency on `releaseId`, caches the first result, and derives its confirmation ref as `MOCK-${releaseId}` with no `Date.now()`/random, so replaying the same release returns an identical outcome. `MOCK_FAILURE_RELEASE_IDS` contains `escrow-11-release-1`, wired to ESC-011 so the demo and tests exercise the real error path.

Reducer purity holds. `approveRelease` in `store/actions.ts` performs the gateway I/O and dispatches `RELEASE_WIRE_SUBMITTING` → `SUBMITTED`/`FAILED`; the reducer only applies synchronous immutable updates. The one exception is the `UPDATE_CLAIM` timestamp fallback, which reaches for `new Date()` when `resolutionDate` is absent — the callers always pass a date, so it is a defensive fallback rather than a live impurity.

Money is integer cents throughout. Storage, seed data, balance math, interest, and fees all operate on cents with `Math.round` at fractional boundaries. The only `/ 100` and `* 100` conversions are display formatting (`MoneyAmount`, checklist) and claim-resolution input parsing (`Math.round(Number(x) * 100)`), which is the correct place to cross the boundary.

The holiday integration fails open. `checkBusinessDay` wraps `fetch` in a 3-second AbortController timeout and returns `{ isBusinessDay: true, source: 'fallback' }` on any error or non-OK response, surfacing the fallback as an amber banner instead of blocking releases. The pure `nextBusinessDay` helper computes value dates from the fetched holiday list.

The release flow renders four distinct states and locks against double submission. The `Checklist` component branches on the active release status (wire-pending, pending-approval/submitting, confirmed/closed, else checklist) and the reducer's `PREPARE_RELEASE` guard refuses a second release while one is pending or wire-pending.

<details>
<summary>Issues (1)</summary>

1. **Reducer timestamp fallback** — `UPDATE_CLAIM` falls back to `new Date().toISOString()` when `resolutionDate` is missing, a minor break from strict reducer purity. Non-blocking; could take the timestamp from the action payload instead.

</details>

<details>
<summary>Details</summary>

## Gateway seam and idempotency

The swap point the user asked for in design is implemented as specified. `createGateway(type)` switches on the string and returns `MockCoreLedgerGateway`, with a commented `fedwire` case marking where a real rail plugs in. `main.tsx` reads `import.meta.env.VITE_CORE_GATEWAY ?? 'mock'` and injects the gateway as a provider prop, so no component constructs a concrete gateway.

The mock treats `releaseId` as the idempotency key: the first call caches its `LedgerPostResult` and every replay returns the cached object, so an approval can never post twice even if the action fires again. The confirmation ref is `MOCK-${releaseId}` — deterministic, no `Date.now()` or randomness — matching the user's explicit requirement that re-posting the same key return the same confirmation. `MOCK_FAILURE_RELEASE_IDS` holds `escrow-11-release-1`; ESC-011's prepared release carries exactly that id, so approving it as supervisor hits the failure branch, and verification.md confirms the release stays `pending-approval` with `postError` set rather than advancing.

## Pure reducer, async action

`approveRelease` computes the value date via `nextBusinessDay`, dispatches `RELEASE_WIRE_SUBMITTING`, awaits `gateway.postRelease`, then dispatches `RELEASE_WIRE_SUBMITTED` (with the snapshot breakdown) or `RELEASE_WIRE_FAILED`. All I/O is outside the reducer. The reducer cases produce new objects via `map`/spread and never mutate the input store.

The one deviation: `UPDATE_CLAIM` uses `action.claim.resolutionDate ?? new Date().toISOString()` for the ledger timestamp. That is a non-deterministic read inside the reducer. In practice the claims UI always sets `resolutionDate`, so the fallback never fires, but strictly a reducer should take the timestamp from the action. Non-blocking for a PoC; worth tightening if this grows.

## Money as integer cents

Every monetary field is `*Cents` and every calculation stays in integer space. `balance.ts` reserves `min(claimedAmountCents, remaining)` sequentially and floors the net at 0 with `Math.max`. `interest.ts` and `fees.ts` apply `Math.round` only when converting a rate (a decimal, not money) into a cent amount. The float operations that exist are all at display or input boundaries: `formatCents(cents / 100)`, the checklist formatter, the interest-rate label (`rate * 100`), and the claim settle input which parses back with `Math.round(Number(settledInput) * 100)`. No float ever reaches stored state.

## Holiday API: timeout and fail-open

`checkBusinessDay` sets a 3-second AbortController timer, treats a non-OK response as an error, and in the catch returns `{ isBusinessDay: true, source: 'fallback', error }`. The design rationale is explicit: failing closed would block all releases whenever a third-party with no SLA is down. The UI honors this — `AppShell` shows an amber "Holiday check unavailable … assuming business day (fail-open). Verify before releasing" banner when `source === 'fallback'`, so the degraded state is visible rather than silent. The checklist receives `isBusinessDay` as a parameter and does not call the API itself, keeping the pure function pure.

## Release tab states and double-release lock

`Checklist` is the Release tab and resolves to one of four renders based on the active release:

```
active release wire-pending      -> purple "wire submitted" banner + amber lock
                                     notice + snapshot + wire instructions +
                                     Supervisor-only "Confirm Wire Received"
active release pending/submitting -> amber pending panel, postError alert if any,
                                     Supervisor-only "Approve Release" (disabled
                                     while submitting)
balance 0 / closed + confirmed    -> "Escrow closed", snapshot, no actions
otherwise                         -> safe-to-fund checklist + breakdown +
                                     Officer-only "Prepare Release"
                                     (enabled only when all 6 checks pass
                                      and !loading)
```

Double-release prevention is enforced twice. The reducer's `PREPARE_RELEASE` returns the escrow unchanged if any release is `pending-approval`, `submitting`, or `wire-pending`. The UI never shows a Prepare button in those states — the wire-pending branch renders the explicit "A second release cannot be initiated while this wire is pending" notice instead. Role gating is correct: Officer prepares, Supervisor approves and confirms.

## Seed scenarios

All 11 scenarios exist in `seed.ts` with IDs ESC-001…ESC-011 and the states the spec names: ready-to-fund, partial claim, fully blocked, non-business-day (release date 2024-11-28 Thanksgiving), not-yet-due (2027-04-08), missing seller instruction, pending-approval, wire-pending (locked, with snapshot and confirmation ref), closed (balance 0, full ledger), two-tranche (first confirmed, second upcoming), and gateway-failure (release id in the failure set). Reference date is 2026-10-08. `createSeedStore()` rebuilds deep-fresh objects per call so RESET restores cleanly, and verification.md's seed tests assert unique ids, integer cents, and the failure-set membership.

## Routing and deployment shape

`main.tsx` uses `HashRouter` (not `BrowserRouter`), which is what the Cloudflare Workers static deploy needs to avoid server-side route handling. The UI matches the dense banking aesthetic from steering: white/gray backgrounds, blue primary actions, amber warnings, square-cornered bordered tables, compact padding. No cards, no rounded corners on data tables (the only `shadow` is on the modal dialog, which is appropriate).

## Test coverage

verification.md records 60 tests across 12 files: ledger append/no-mutation, interest (including the $3,750 on $1M at 4.5%/month case and rounding), fees pro-ration, balance with partial/over-balance/multi-claim, `nextBusinessDay` weekend/holiday, all six checklist checks, mock gateway success/idempotency/failure/idempotent-failure, seed invariants, reducer actions including the double-release lock and FAILED-stays-pending, and an end-to-end walk of all 11 scenarios plus the happy-path approve flow.

Not tested: the live Nager.Date fetch is not exercised against the network (by design — the pure `nextBusinessDay` is unit-tested and render tests stub `fetch` to reject, confirming the fail-open path). No live dev-server walkthrough and no Cloudflare deploy ran in the build environment; the production build is the hard gate and passed. Reasonable boundaries for a PoC.

</details>

<details>
<summary>File map</summary>

- `src/lib/createGateway.ts` — env-driven gateway factory (`VITE_CORE_GATEWAY`)
- `src/lib/mockCoreLedger.ts` — idempotent mock, `MOCK_FAILURE_RELEASE_IDS` = `{escrow-11-release-1}`
- `src/lib/coreLedger.ts` — gateway interface + request/result types
- `src/lib/businessDay.ts` — 3s AbortController fetch, fail-open; pure `nextBusinessDay`
- `src/lib/balance.ts`, `interest.ts`, `fees.ts`, `checklist.ts`, `ledger.ts` — pure integer-cents logic
- `src/store/EscrowContext.tsx` — pure reducer + provider (gateway injected as prop)
- `src/store/actions.ts` — `approveRelease` async action (gateway call → dispatch)
- `src/data/seed.ts` — 11 scenarios, reference date 2026-10-08, deep-fresh factory
- `src/main.tsx` — HashRouter + EscrowProvider with `createGateway()`
- `src/components/escrows/Checklist.tsx` — Release tab: four states + double-release lock
- `src/components/layout/AppShell.tsx` — header, role switcher, fail-open holiday banner
- `src/components/{dashboard,escrows,shared}/*` — dense tabular UI
- Full diff: `git diff` against the base branch

</details>
