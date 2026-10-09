import type {
  CoreLedgerGateway,
  LedgerPostRequest,
  LedgerPostResult,
} from './coreLedger';

// Release IDs in this set always fail — used to exercise the demo error path.
export const MOCK_FAILURE_RELEASE_IDS = new Set<string>([
  'escrow-11-release-1',
]);

/**
 * Deterministic, idempotent mock of the core ledger gateway.
 *
 * The releaseId is the idempotency key: a release can never post twice. The
 * first call caches its result; replaying the same releaseId returns the
 * identical result (success OR failure) rather than posting again. The
 * confirmation ref is derived from the releaseId (no Date.now()/random) so it
 * is stable across replays.
 */
export class MockCoreLedgerGateway implements CoreLedgerGateway {
  private readonly results = new Map<string, LedgerPostResult>();

  async postRelease(req: LedgerPostRequest): Promise<LedgerPostResult> {
    // Idempotency: same releaseId -> same cached outcome.
    const cached = this.results.get(req.releaseId);
    if (cached) return cached;

    await new Promise((r) => setTimeout(r, 500)); // Simulate async core call

    const result: LedgerPostResult = MOCK_FAILURE_RELEASE_IDS.has(req.releaseId)
      ? {
          success: false,
          error: 'Core system rejected post: duplicate reference detected',
        }
      : { success: true, confirmationRef: `MOCK-${req.releaseId}` };

    this.results.set(req.releaseId, result);
    return result;
  }
}
