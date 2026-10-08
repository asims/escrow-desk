# Escrow Desk

A proof-of-concept workflow tool for a bank escrow officer managing indemnity holdback escrows on commercial M&A deals.

---

## What It Is and Why

When a bank acts as escrow agent on a commercial acquisition, it holds a portion of the purchase price — typically 10–15% — for 12–24 months after closing. During that window, the buyer can file indemnity claims if representations made by the seller turn out to be false. Whatever isn't claimed gets released to the seller at the end.

Most community banks still run this process with spreadsheets, calendar reminders, and email. Someone tracks release dates by hand, collects signatures over email, and keys the payment into a separate system. That's slow, error-prone, and — because escrow disbursements are high-value wire transfers — a meaningful fraud target.

Escrow Desk is a purpose-built tool for the escrow officer's daily job: knowing which escrows need attention, verifying that a release is safe to fund, and walking a release through the approval and posting process with a clear audit trail.

**The user is the escrow officer** (and their supervisor, for dual-control approval). The app covers the post-opening lifecycle only — monitoring, release authorization, claims management, and ledger visibility. Opening new escrows is out of scope.

---

## The Problem This Solves

A well-designed escrow release system needs to answer one question reliably: **is it safe to fund this release right now?**

That means checking:
- Has the survival period actually expired?
- Are there any open or disputed claims reserving funds?
- Have authorized signers on both sides submitted joint written instructions?
- Is today a valid banking business day?
- Is the release amount mathematically correct after claims and fees?
- Is there already a pending or in-flight release for this escrow?

If any of those checks fail, the release must be blocked — clearly, with an explanation. If all pass, the officer prepares it, a supervisor approves it (dual control), and the system posts to the core ledger. Every step is recorded in an append-only audit trail.

---

## API Integration

**[Nager.Date US Federal Holiday API](https://date.nager.at)** — a publicly accessible API (no key required) that returns the US federal holiday calendar for a given year. The app calls this on load to determine whether today is a valid ACH/wire business day. This gates the release checklist: a release cannot be approved on a federal holiday or weekend. The call uses a 3-second `AbortController` timeout; on failure the app defaults to assuming a valid business day and displays a warning.

This was chosen because it's realistic — banks actually check the Fed calendar before initiating wires — and because it's a clean, verifiable external integration with no credentials required for a demo.

---

## How to Run Locally

### Prerequisites
- Node.js 20+
- pnpm (or npm)

### Install and run

```bash
git clone https://github.com/asims/escrow-desk.git
cd escrow-desk
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

### Run tests

```bash
pnpm test
```

### Build for production

```bash
pnpm build
```

### Deploy to Cloudflare Workers

```bash
pnpm run deploy
```

Requires `wrangler` and a Cloudflare account. The app deploys as a static site — no server-side logic.

---

## Product Decisions and Reasoning

**In-memory data with a reset button.** There's no backend. All data is seeded at startup from a factory function that creates 11 named scenarios covering the interesting edge cases: a clean release, a partial claim, a fully blocked escrow, a non-business day, a missing instruction, a pending approval, a wire in flight, a closed escrow, a two-tranche schedule, and an intentional gateway failure. A reset button restores the original state. This makes the demo self-contained and reproducible.

**All money stored as integer cents.** Floating-point arithmetic is wrong for money. Every monetary value in the data model is an integer number of cents. Interest and fee calculations use `Math.round()` at the boundary. Display formatting converts to dollars only in the UI layer.

**Business logic separated from UI.** The release checklist, balance calculation, interest accrual, fee computation, and ledger append are all pure TypeScript functions in `src/lib/` with no React dependencies. They have unit tests. The UI renders what the functions return — it contains no financial logic.

**A `CoreLedgerGateway` interface with a swappable mock.** The escrow posting step (debit escrow account, credit beneficiary) is behind an interface. The PoC ships a mock that simulates latency, enforces idempotency via a `releaseId` key, and fails deterministically on one seeded scenario to show the error path. In production, a concrete adapter for the bank's core system replaces the mock via an environment variable (`VITE_CORE_GATEWAY`). The reducer never calls the gateway directly — an async action function calls it and dispatches success or failure, keeping the reducer pure.

**Dual-control approval modeled with a role switcher.** The app has two roles — Escrow Officer and Supervisor — selectable via a header dropdown. The officer prepares a release; only the supervisor can approve it. This is a direct model of the segregation of duties that a real bank IAM system would enforce. A production version would replace the dropdown with authenticated sessions and role-based access control.

**Value date computed at approval time.** The wire value date (the date funds actually settle) is the next valid banking business day on or after the approval date. This is computed using the holiday list already fetched from the Fed calendar API. It's stored on the release record, shown on the release detail, and included in the core ledger post request.

**Claims have three states.** Open (filed, seller hasn't responded), Disputed (seller objects — requires joint instruction to resolve), and Resolved (settled, with recorded amount and note). A disputed claim cannot be unilaterally resolved by the officer. The effective reserve for any claim is capped at the available balance — a claim larger than the escrow is valid but can only recover what's there.

---

## Production Architecture

This PoC demonstrates the decision logic for a release. A production system would run each escrow as a **durable workflow** (Temporal, AWS Step Functions) — a long-running process that sleeps for months between activities, survives restarts, retries failed steps with backoff, and enforces exactly-once posting via idempotency keys.

See **[docs/production-architecture.md](docs/production-architecture.md)** for the full workflow diagram, activity breakdown, idempotency design, and mapping from PoC components to production equivalents.

---

## What I'd Change or Add With More Time

**Notifications.** An escrow officer shouldn't have to check the dashboard every morning. Upcoming release dates and new claim notices should push to them — email, a portal notification, or both. The event fan-out architecture is already designed; notifications would be one subscriber.

**Document references.** Joint instructions are currently a checkbox with a signer name and channel. A production system would store a document reference — a scanned PDF, a portal submission ID — so the audit trail can be verified, not just asserted.

**Interest calculation precision.** The current design uses a simple monthly credit (`balance × rate / 12`). A real system would use daily accrual on the actual balance, which changes as claims are reserved and released. For the PoC the approximation is fine; for production it would matter at scale.

**Claim submission workflow.** Claims are pre-seeded. In production, the buyer would file a claim through a portal or email-to-case system, triggering a notification to the seller and starting the objection period. Building that intake flow would make the escrow lifecycle end-to-end.

**Escheatment monitoring.** Escrows that are never released don't just sit forever — most US states require banks to report and remit dormant escrow funds to the state after a defined period. A production system needs a dormancy monitor separate from the release workflow.

**Routing number validation.** Wire destinations are pre-seeded and display-only. A production system would validate the routing number against the Fed's routing directory before any disbursement, and independently verify account changes (callback, bank letter) as a BEC fraud control.

---

## AI Collaboration

This project was built with [Kiro](https://kiro.dev), an AI-powered development environment. Before scoping this specific exercise, I used Claude to explore several potential application ideas and evaluate which one would be both differentiated and within scope for a two-hour PoC. Escrow desk management stood out because it's a real gap — most back-office core systems don't handle the post-closing lifecycle of commercial escrows well — and because I had enough domain familiarity to drive the product decisions.

The full collaboration history — requirements iterations, design decisions, and the reasoning behind each choice — is captured in real time in [`docs/AI-log/session-log.md`](docs/AI-log/session-log.md) via automated Kiro hooks that log every prompt and agent turn as they happen. The spec artifacts in [`.kiro/specs/escrow-desk/`](.kiro/specs/escrow-desk/) were produced through Kiro's spec workflow: requirements first, design second, then implementation tasks.

The product decisions are mine. The domain research, the architectural trade-offs, the "safe to fund" checklist design, the durable workflow framing, the integer-cents decision, the gateway interface — all came out of conversation with the AI, but were shaped, pushed back on, and refined throughout. The session log shows where I agreed, where I pushed back, and where I added things the AI didn't suggest.
