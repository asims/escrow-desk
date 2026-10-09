/**
 * CoreLedgerGateway abstracts the connection to the bank's core system.
 *
 * The release is modeled as POSTING a double-entry (debit + credit) to the core
 * ledger — posting is the core job. A wire is just one rail money can leave on;
 * other rails (ACH, book transfer) could be added later. The PoC ships a mock;
 * a real integration swaps in a concrete implementation without touching the
 * reducer or UI (selected via VITE_CORE_GATEWAY).
 */
export interface CoreLedgerGateway {
  postRelease(request: LedgerPostRequest): Promise<LedgerPostResult>;
}

export interface LedgerPostRequest {
  releaseId: string; // Idempotency key — same ID always returns the same result
  escrowId: string;
  amountCents: number; // Integer cents
  valueDate: string; // ISO date — next valid business day on/after approval date
  debitEntry: LedgerPostEntry;
  creditEntry: LedgerPostEntry;
  reference: string; // Deal/wire memo reference
}

export interface LedgerPostEntry {
  accountRef: string; // GL account or wire destination reference
  description: string;
}

export interface LedgerPostResult {
  success: boolean;
  confirmationRef?: string; // Core system reference; stable for a given releaseId
  error?: string;
}
