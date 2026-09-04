import { createPublicClient, http, webSocket, type Address, type PublicClient } from "viem";
import { billingAbi } from "./abi.ts";

/**
 * Per-request subscription checks, without an RPC round trip per request.
 *
 * Two things make the cache safe rather than just fast:
 *
 *  - `accountOf` returns the exact second the prepaid balance runs out, so an entry can be cached
 *    until *the earlier of* a short TTL and that lapse time. A subscription never silently
 *    outlives its funding, because the contract told us when the funding ends.
 *  - the contract emits an event on every action that moves that date (deposit, withdraw,
 *    subscribe, cancel), so a websocket subscription can drop the entry the moment it changes.
 *
 * The TTL still matters: websockets drop, RPC providers lag, and an L2 can reorg away a top-up
 * that was already served. Keep it short (tens of seconds) and treat it as the floor of accuracy,
 * not an optimisation to tune away.
 */

export type SubscriptionStatus = {
  address: Address;
  subscribed: boolean;
  planId: number;
  /** Unused prepaid balance, in token units (6 decimals for USDC). */
  balance: bigint;
  /** Unix seconds at which the prepaid balance runs out. 0 if no plan is selected. */
  expiresAt: number;
};

export type GateOptions = {
  rpcUrl: string;
  /** Optional wss:// endpoint. Without it the gate still works, it just leans on the TTL. */
  wsRpcUrl?: string;
  billingAddress: Address;
  /** Seconds a positive answer may be reused. Default 30. */
  ttlSeconds?: number;
};

type CacheEntry = { status: SubscriptionStatus; goodUntilMs: number };

export class SubscriptionGate {
  private readonly client: PublicClient;
  private readonly billingAddress: Address;
  private readonly ttlMs: number;
  private readonly cache = new Map<Address, CacheEntry>();
  private readonly inflight = new Map<Address, Promise<SubscriptionStatus>>();
  private readonly opts: GateOptions;
  private unwatch?: () => void;

  constructor(opts: GateOptions) {
    this.opts = opts;
    this.client = createPublicClient({ transport: http(opts.rpcUrl) }) as PublicClient;
    this.billingAddress = opts.billingAddress;
    this.ttlMs = (opts.ttlSeconds ?? 30) * 1000;
  }

  /** Subscribe to contract events so balance changes invalidate the cache immediately. */
  watch(): void {
    if (!this.opts.wsRpcUrl || this.unwatch) return;
    const wsClient = createPublicClient({ transport: webSocket(this.opts.wsRpcUrl) }) as PublicClient;
    this.unwatch = wsClient.watchContractEvent({
      address: this.billingAddress,
      abi: billingAbi,
      onLogs: (logs) => {
        for (const log of logs) {
          const account = (log as { args?: { account?: Address } }).args?.account;
          if (account) this.cache.delete(account.toLowerCase() as Address);
        }
      },
      // A dropped socket must not silently freeze the cache: fall back to TTL-only and say so.
      onError: (err) => console.error("[gate] event stream error, falling back to TTL:", err.message),
    });
  }

  stop(): void {
    this.unwatch?.();
    this.unwatch = undefined;
  }

  async status(addressRaw: Address): Promise<SubscriptionStatus> {
    const address = addressRaw.toLowerCase() as Address;
    const now = Date.now();

    const hit = this.cache.get(address);
    if (hit && now < hit.goodUntilMs) return hit.status;

    // Collapse concurrent misses for the same address into one eth_call.
    const pending = this.inflight.get(address);
    if (pending) return pending;

    const promise = this.fetch(address).finally(() => this.inflight.delete(address));
    this.inflight.set(address, promise);
    return promise;
  }

  async isSubscribed(address: Address): Promise<boolean> {
    return (await this.status(address)).subscribed;
  }

  private async fetch(address: Address): Promise<SubscriptionStatus> {
    const [planId, balance, expiresAt, subscribed] = await this.client.readContract({
      address: this.billingAddress,
      abi: billingAbi,
      functionName: "accountOf",
      args: [address],
    });

    const status: SubscriptionStatus = {
      address,
      subscribed,
      planId: Number(planId),
      balance,
      expiresAt: Number(expiresAt),
    };

    // Never cache past the moment the contract says the money runs out.
    const lapseMs = status.expiresAt * 1000;
    const goodUntilMs = subscribed ? Math.min(Date.now() + this.ttlMs, lapseMs) : Date.now() + this.ttlMs;
    this.cache.set(address, { status, goodUntilMs });
    return status;
  }
}
