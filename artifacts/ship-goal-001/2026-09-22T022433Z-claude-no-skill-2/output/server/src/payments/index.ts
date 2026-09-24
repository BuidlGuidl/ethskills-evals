import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { newId } from '../lib/ids.js';

/**
 * Everything on-chain sits behind this interface. The app's ledger is the
 * source of truth for who owns what inside Toolshed; a provider's job is only
 * to get real USDC in and out of the association's custody wallet.
 */
export interface PaymentProvider {
  readonly name: string;
  /** Address a member should send USDC to in order to fund their balance. */
  depositInstructions(memberId: string): Promise<DepositInstructions>;
  /**
   * Credit a member (mock: instant; on-chain: called by the chain watcher once
   * a transfer has enough confirmations). `reference` is the idempotency key.
   */
  confirmTopUp(memberId: string, micros: number): Promise<{ reference: string }>;
  /** Send USDC out to the member's payout address. */
  payout(memberId: string, micros: number, toAddress: string): Promise<{ reference: string }>;
}

export interface DepositInstructions {
  provider: string;
  chain: string;
  asset: 'USDC';
  address: string | null;
  note: string;
}

/**
 * Dev/staging provider: no chain, no custody, balances are credited on request
 * so the loan and late-fee flows can be exercised end to end.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async depositInstructions(memberId: string): Promise<DepositInstructions> {
    return {
      provider: this.name,
      chain: 'none (mock)',
      asset: 'USDC',
      address: null,
      note: `Test mode: top-ups are credited instantly, no USDC moves. Member ${memberId}.`,
    };
  }

  async confirmTopUp(_memberId: string, micros: number) {
    if (micros <= 0 || micros > config.mockMaxTopUpMicros) {
      throw ApiError.badRequest('invalid_amount', 'Top-up amount is out of range');
    }
    return { reference: newId('mocktop') };
  }

  async payout(_memberId: string, micros: number, _toAddress: string) {
    if (micros <= 0) throw ApiError.badRequest('invalid_amount', 'Withdrawal must be positive');
    return { reference: newId('mockout') };
  }
}

export function createPaymentProvider(): PaymentProvider {
  switch (config.paymentProvider) {
    case 'mock':
      return new MockPaymentProvider();
    default:
      // Deliberately loud: shipping to production with a provider name we do
      // not implement should fail at boot, not at the first withdrawal.
      throw new Error(
        `PAYMENT_PROVIDER=${config.paymentProvider} is not implemented. ` +
          `Only 'mock' ships in this version - see README "Wiring up real USDC".`,
      );
  }
}
