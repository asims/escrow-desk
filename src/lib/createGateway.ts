import type { CoreLedgerGateway } from './coreLedger';
import { MockCoreLedgerGateway } from './mockCoreLedger';

/**
 * Factory that selects the core ledger gateway implementation. The type comes
 * from the VITE_CORE_GATEWAY environment variable (default 'mock') so the mock
 * is never hardcoded in a component. A production build would set
 * VITE_CORE_GATEWAY to a real rail here.
 */
export function createGateway(type: string = 'mock'): CoreLedgerGateway {
  switch (type) {
    case 'mock':
      return new MockCoreLedgerGateway();
    // Future production seam:
    // case 'fedwire':
    //   return new FedwireGateway();
    default:
      throw new Error(`Unknown gateway type: ${type}`);
  }
}
