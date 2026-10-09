import { describe, it, expect } from 'vitest';
import { MockCoreLedgerGateway } from './mockCoreLedger';
import type { LedgerPostRequest } from './coreLedger';

function request(releaseId: string): LedgerPostRequest {
  return {
    releaseId,
    escrowId: 'esc-test',
    amountCents: 50000000,
    valueDate: '2026-10-08',
    debitEntry: { accountRef: 'ESCROW-esc-test', description: 'debit' },
    creditEntry: { accountRef: '111', description: 'credit' },
    reference: 'ref',
  };
}

describe('MockCoreLedgerGateway', () => {
  it('returns a deterministic confirmationRef on success', async () => {
    const gateway = new MockCoreLedgerGateway();
    const result = await gateway.postRelease(request('test-release-1'));
    expect(result.success).toBe(true);
    expect(result.confirmationRef).toBe('MOCK-test-release-1');
  });

  it('is idempotent: same releaseId returns the identical result', async () => {
    const gateway = new MockCoreLedgerGateway();
    const first = await gateway.postRelease(request('test-release-1'));
    const second = await gateway.postRelease(request('test-release-1'));
    expect(second).toBe(first); // same cached object reference
    expect(second.confirmationRef).toBe('MOCK-test-release-1');
  });

  it('fails for a release id in the failure set', async () => {
    const gateway = new MockCoreLedgerGateway();
    const result = await gateway.postRelease(request('escrow-11-release-1'));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/rejected/i);
  });

  it('returns the same failure on replay (idempotent failure)', async () => {
    const gateway = new MockCoreLedgerGateway();
    const first = await gateway.postRelease(request('escrow-11-release-1'));
    const second = await gateway.postRelease(request('escrow-11-release-1'));
    expect(second).toBe(first);
    expect(second.success).toBe(false);
  });
});
