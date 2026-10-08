# Escrow Desk — Requirements

## Overview

A proof-of-concept single-page application for a bank escrow officer managing indemnity holdback escrows on commercial M&A deals. The app covers the post-opening lifecycle: monitoring, release authorization, claims management, and ledger visibility. No backend, no auth, no new escrow setup.

---

## 1. Role Switcher

**REQ-1.1** The app provides a role dropdown in the header with two options: **Escrow Officer** and **Supervisor**. Switching roles changes what actions are available without reloading or losing state.

**REQ-1.2** The Escrow Officer role can: view all escrows, view release checklists, resolve claims, and prepare (submit for approval) a release.

**REQ-1.3** The Supervisor role can: do everything the Escrow Officer can, plus approve a release that has been prepared and is pending approval.

---

## 2. Dashboard (Morning View)

**REQ-2.1** The default view is a dashboard showing all escrows that need attention today, grouped by urgency:
- Releases due today or overdue
- Releases due within 7 days
- Releases due within 30 days
- Escrows with open claims
- Releases pending supervisor approval

**REQ-2.2** Each escrow in the dashboard shows: escrow name/ID, parties (buyer and seller), total held balance, releasable amount, release date, and a status badge.

**REQ-2.3** The dashboard shows a today's date indicator and whether today is a valid wire business day (per the Fed holiday API). If today is not a business day, a banner alerts the officer.

---

## 3. Escrow List & Detail

**REQ-3.1** A full escrow list view shows all escrows regardless of status, with filtering by status (Active, Pending Wire, Closed).

**REQ-3.2** Each escrow detail view shows:
- Deal summary: parties (buyer and seller), deal name, original escrow amount, current balance, survival period start and end dates
- Authorized signers: per-party list of individuals authorized to sign release instructions, each with name and title
- Claims: list of all claims against this escrow with amount, status, and filed date
- Ledger: append-only list of all entries (initial deposit, claim reserves, partial releases, disbursements, interest credits)
- Release section: current release checklist and action buttons

---

## 4. Release Checklist ("Safe to Fund")

**REQ-4.1** Before a release can be prepared, the system evaluates a checklist. All items must pass. The checklist contains:

| # | Check | Blocks release if |
|---|---|---|
| 1 | Survival period has expired (or scheduled release date reached) | Release date is in the future |
| 2 | No open claims against the release amount | Open claim(s) exist reserving funds |
| 3 | Joint written instruction received from authorized signers on both sides | One or both instructions missing or not from an authorized signer |
| 4 | Today is a valid wire business day | Today is a federal holiday or weekend (Fed API) |
| 5 | Release amount is correct | Computed balance ≠ expected release amount |
| 6 | No prior release pending or submitted for this escrow | A release is already in Approved or Wire Pending state |

**REQ-4.2** Each checklist item displays its pass/fail state with a short explanation of why it failed.

**REQ-4.3** The releasable amount is computed as: total balance − sum of open claim amounts − accrued fees. This is shown clearly on the release screen.

---

## 5. Release Workflow

**REQ-5.1** When all checklist items pass and the role is Escrow Officer, a **Prepare Release** button is available. Clicking it moves the release to **Pending Approval** state.

**REQ-5.2** When a release is in Pending Approval state and the role is Supervisor, an **Approve Release** button is available. Clicking it moves the release to **Approved / Wire Pending** state and creates a ledger entry.

**REQ-5.3** Once a release is in Approved / Wire Pending state, no further approval actions are available. The UI displays "Wire submitted to core banking system — awaiting confirmation" to make the production seam visible. In a production system, confirmation would arrive automatically via a callback from the core banking workflow; the manual option below exists as a fallback for outages or failed automation.

**REQ-5.4** The release detail view for a Wire Pending release shows the wire instructions (beneficiary name, account number, routing number, amount, reference/memo) so an officer can manually resubmit to the core system if automation fails.

**REQ-5.5** A release in Wire Pending state can be marked **Confirmed** manually by the Supervisor (simulating receipt of wire confirmation). This closes the release and, if the balance reaches zero, marks the escrow as Closed. Each state transition is recorded as an append-only ledger entry with: timestamp, action, actor role, and amount.

**REQ-5.6** Each state transition is recorded as an append-only ledger entry with: timestamp, action, actor role, and amount.

---

## 6. Claims Management

**REQ-6.1** Each escrow detail view lists all claims with: description, filed date, claimed amount, effective reserve, and status.

**REQ-6.2** Claim status follows this progression: **Open → Disputed → Resolved**.
- **Open:** Filed by buyer, seller has not yet responded. Funds reserved.
- **Disputed:** Seller has objected. Funds remain reserved. Resolution requires joint instruction from both parties; the officer cannot unilaterally resolve a disputed claim.
- **Resolved:** Settled. The resolved amount (which may be less than the claimed amount) is recorded. Freed funds recalculate the releasable balance.

**REQ-6.3** The effective reserve for a claim is `min(claimed amount, available balance)`. The full claimed amount is always shown alongside the effective reserve so the officer can see when a claim exceeds the balance.

**REQ-6.4** When a claim's effective reserve equals the full available balance, the releasable amount is $0 and the detail view flags: "Claim of $X exceeds available balance of $Y — full balance reserved."

**REQ-6.5** The Escrow Officer can mark an **Open** claim as Disputed (recording that the seller has objected) or as Resolved (recording the settled amount and a resolution note).

**REQ-6.6** A **Disputed** claim can only be marked Resolved by recording a joint instruction reference from both parties, plus the settled amount and a note.

**REQ-6.7** All claim status changes are recorded in the escrow ledger as append-only entries.

---

## 7. Ledger

**REQ-7.1** The ledger is append-only. No entries can be edited or deleted.

**REQ-7.2** Each ledger entry records: entry type, amount (debit or credit), running balance, timestamp, and actor.

**REQ-7.3** Entry types include: Initial Deposit, Claim Reserve, Claim Release (when resolved), Partial Disbursement, Final Disbursement, Interest Credit, Fee Debit.

---

## 8. Interest and Fees

**REQ-8.1** Each escrow record stores an annual interest rate and an interest beneficiary (defaulting to the seller). Interest is credited monthly to the escrow balance and recorded as an Interest Credit ledger entry. The monthly credit is calculated as `balance × annualRate / 12`.

**REQ-8.2** Each escrow record stores an annual administration fee (flat dollar amount) and a per-disbursement wire fee. The annual fee is recorded as a Fee Debit ledger entry on each anniversary of the escrow's opening date. The wire fee is debited as a Fee Debit ledger entry when a disbursement is confirmed.

**REQ-8.3** The releasable amount calculation (REQ-4.3) subtracts any accrued, unbilled fees from the balance. The release screen itemizes the deduction so the officer can see the gross balance, fee deductions, claim reserves, and net releasable amount.

**REQ-8.4** Seed data includes escrows with varying interest rates (including zero) and fee schedules to demonstrate both interest-bearing and non-interest-bearing accounts.

---

## 9. Approval Snapshot & Instruction Receipt

**REQ-9.1** When a release is approved (moves to Approved / Wire Pending), the system captures a point-in-time snapshot of the escrow state: balance, open claims, releasable amount, and fee deductions at the moment of approval. This snapshot is stored with the release record and displayed on the release detail view.

**REQ-9.2** The joint instruction checklist item (REQ-4.1 item 3) requires recording, per party: the received date, the name of the authorized signer who provided the instruction, and the channel (e.g., Secure Portal, Email, Physical). This is stored in the release record and visible on the release detail.

---

## 10. Federal Holiday / Business Day API

**REQ-10.1** On app load and on the dashboard, the app calls a public Federal Reserve or equivalent holiday API to determine whether today is a valid ACH/wire business day (US banking days only).

**REQ-10.2** If the API call fails, the app defaults to assuming today is a valid business day and displays a warning that the holiday check could not be completed.

**REQ-10.3** The business-day check is one item on the release checklist (REQ-4.1 item 4). If today is not a business day, the checklist item fails with a message identifying the holiday or weekend.

---

## 11. Seed Data

**REQ-11.1** The app ships with seeded in-memory data covering the following named scenarios (see steering for full list):
1. Ready to fund
2. Partial claim blocking full release
3. Fully blocked by claim
4. Non-business day (release date on a holiday — simulated via a past date known to be a holiday)
5. Not yet due
6. Missing joint instruction
7. Pending supervisor approval
8. Wire pending (double-release lock)
9. Fully disbursed / closed
10. Partial + upcoming (two-tranche release schedule)

**REQ-11.2** A **Reset Data** button in the app header restores all in-memory data to the original seed state.

---

## 12. Out of Scope

- New escrow setup / onboarding
- User authentication or session management
- Persistent storage or backend
- Multi-currency or non-USD amounts
- Actual wire transmission
- Notifications / email
- Document upload or storage
- Representation & warranty insurance workflows

---

## 13. Assumptions and Known Limitations

The following auditor concerns are acknowledged but not implemented in this PoC:

**A. Named actor in audit trail.** The ledger records the role (Escrow Officer / Supervisor) but not a named user, since there is no authentication. In production, each entry would record the authenticated user's ID and name.

**B. Wire instruction provenance.** Wire destinations are pre-seeded and display-only. In production, account setup would be independently verified (callback, voided check, or bank letter), and any change-of-instructions event would trigger a separate fraud-review workflow. Changes to wire instructions are a primary BEC fraud vector.

**C. Interest allocation and tax reporting.** Interest is credited to the escrow balance and attributed to the seller for display purposes. The PoC does not model the tax complexity (buyer 1099-INT during the period, seller 1099-B at distribution, IRS imputed interest rules under IRC §483). A production system would integrate with the bank's tax reporting module.

**D. Fee authorization.** Fee amounts are stored per-escrow in seed data, representing what was agreed in the escrow agreement. The PoC does not model fee negotiation, fee schedule versioning, or dispute of fees.

**E. Escheatment / unclaimed property.** The PoC does not handle escrows that are never released or abandoned. In production, US state unclaimed property laws require banks to report and eventually remit dormant escrow funds to the state. This would require a separate dormancy monitoring workflow.

**F. Interest-only escrows and non-cash assets.** This PoC covers cash-only USD escrows. Stock escrows, earn-out arrangements, and escrows denominated in other assets are out of scope.
