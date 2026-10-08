# Project Overview

Proof of concept for a bank escrow officer managing releases on commercial escrows.

**Stack:** Vite · React · TypeScript · Tailwind · Vitest  
**Deployment:** Static site on Cloudflare Workers — no backend, no API calls.

## Data
All data is seeded in-memory with a reset mechanism. No persistence layer.

## Architecture rule
Business logic (release checks, ledger postings, balance calculations) lives in plain TypeScript functions, separate from UI components. These functions must have unit tests.

## Scope
This is a proof of concept. Favor simplicity and clarity over production-readiness.

## UI Style

Inspired by Nymbus's banking UI aesthetic — clean, dense, and functional.

- White and light gray backgrounds (`bg-white`, `bg-gray-50`, `bg-gray-100`)
- Blue primary actions (`bg-blue-600` / `#2563eb` or similar)
- Amber/yellow for warnings and alerts
- Small, muted label text (`text-xs text-gray-500`), prominent values in dark gray/black
- Tabular layouts for data — prefer tables and structured grids over cards
- Compact padding — this is a data-dense UI, not a marketing page
- No rounded corners on data tables; subtle borders (`border-gray-200`)

## External API

Use the Federal Reserve bank holiday calendar API to determine whether today is a valid wire business day. This is the only real external API call in the PoC. The wire disbursement itself is mocked — a clearly labeled seam where a production system would invoke a durable workflow (e.g., Temporal or Step Functions) against the core banking system.

## Seed Data Scenarios

The in-memory seed data must cover these named scenarios so a reviewer can exercise each branch of the release logic:

1. **Ready to fund** — release date reached, no claims, joint instruction on file, valid business day
2. **Partial claim** — release date reached, one open claim reduces releasable balance
3. **Fully blocked by claim** — open claim covers full balance, release completely blocked
4. **Non-business day** — release date falls on a weekend or federal holiday, Fed API blocks funding
5. **Not yet due** — release date in the future, release action disabled
6. **Missing instruction** — release date reached but joint instruction not received from one party
7. **Pending supervisor approval** — officer has prepared release, supervisor has not yet approved
8. **Wire pending** — release approved and submitted to core banking, confirmation not yet received; locked against double-submission
9. **Fully disbursed** — escrow closed, full history visible, no actions available
10. **Partial + upcoming** — one scheduled partial release already disbursed, second release upcoming

## Role Switcher

The app has a role dropdown (no auth) with two options:
- **Escrow Officer** — can view escrows, prepare releases, resolve claims
- **Supervisor** — can approve prepared releases (second approver / dual control)

## Claims (light)

Claims have: description, amount, status (Open / Resolved), filed date. An open claim reserves its amount from the releasable balance. The officer can mark a claim Resolved with a note. Claims are pre-seeded; no submission workflow needed.

## Production Seams

The PoC should make handoff points visible in the UI and code:
- "Wire submitted to core banking" (not pretending it happened)
- Append-only ledger entries (no edits)
- Double-release prevention: once a release is Approved/Pending Wire, the UI locks it
