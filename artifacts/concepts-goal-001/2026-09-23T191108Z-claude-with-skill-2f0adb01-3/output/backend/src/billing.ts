import {
  createPublicClient,
  http,
  getAddress,
  type Address,
  type PublicClient,
} from "viem";
import { base } from "viem/chains";
import { subscriptionBillingAbi } from "./abi.js";

/**
 * Subscription gate for the weather API.
 *
 * The contract's `subscribedUntil(user)` returns the timestamp the customer's prepaid balance
 * runs out at. That lets us answer "is this address subscribed?" from cache for most requests
 * instead of hitting an RPC node on every single one.
 *
 * What can move that timestamp:
 *   - later: the customer tops up, or switches to a cheaper plan.  Harmless to miss — we'd
 *     under-serve a paying customer briefly, and a top-up is a good moment to bust the cache.
 *   - earlier: ONLY the customer themselves, by cancelling and withdrawing. That is the one
 *     case where a stale cache serves free requests, which is why `maxTtlMs` caps how long we
 *     trust a far-future expiry. Thirty seconds of free weather data is an acceptable loss;
 *     an RPC call per request is not.
 *
 * Nothing here needs a private key. The gate only ever reads.
 */

export interface GateOptions {
  contract: Address;
  rpcUrl: string;
  /** Upper bound on how long a positive answer is cached. Default 30s. */
  maxTtlMs?: number;
  /** Treat RPC failures as subscribed, to avoid an outage locking out paying users. Default true. */
  failOpen?: boolean;
  client?: PublicClient;
}

interface CacheEntry {
  /** Unix seconds the subscription lapses at; 0 = not subscribed. */
  until: number;
  /** Local ms timestamp this entry stops being trusted. */
  expiresAt: number;
}

export class SubscriptionGate {
  private readonly client: PublicClient;
  private readonly contract: Address;
  private readonly maxTtlMs: number;
  private readonly failOpen: boolean;
  private readonly cache = new Map<Address, CacheEntry>();
  private readonly inflight = new Map<Address, Promise<number>>();

  constructor(opts: GateOptions) {
    this.contract = getAddress(opts.contract);
    this.maxTtlMs = opts.maxTtlMs ?? 30_000;
    this.failOpen = opts.failOpen ?? true;
    this.client =
      opts.client ??
      (createPublicClient({
        chain: base,
        transport: http(opts.rpcUrl),
      }) as PublicClient);
  }

  /** The per-request question. Cheap: usually answered from memory. */
  async isSubscribed(user: Address): Promise<boolean> {
    const until = await this.subscribedUntil(user);
    return until * 1000 > Date.now();
  }

  /** Unix seconds at which this account's prepaid balance runs out. 0 if not subscribed. */
  async subscribedUntil(user: Address): Promise<number> {
    const key = getAddress(user);
    const now = Date.now();

    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > now) return hit.until;

    // Collapse concurrent requests for the same address into one RPC call.
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = this.fetchUntil(key)
      .then((until) => {
        this.cache.set(key, { until, expiresAt: Date.now() + this.ttlFor(until) });
        return until;
      })
      .catch((err) => {
        if (hit) return hit.until; // prefer a stale answer over an outage
        if (this.failOpen) {
          console.error(`[billing] RPC read failed for ${key}, failing open:`, err);
          return Math.floor(Date.now() / 1000) + 60;
        }
        throw err;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /** Full account detail — for a dashboard or a support query, not the hot path. */
  async accountOf(user: Address) {
    const [account, pending] = await Promise.all([
      this.client.readContract({
        address: this.contract,
        abi: subscriptionBillingAbi,
        functionName: "accountOf",
        args: [getAddress(user)],
      }),
      this.client.readContract({
        address: this.contract,
        abi: subscriptionBillingAbi,
        functionName: "pending",
        args: [getAddress(user)],
      }),
    ]);
    return {
      balance: account.balance,
      planId: Number(account.planId),
      lastTick: Number(account.lastTick),
      accruedUnsettled: pending,
      refundable: account.balance - pending,
    };
  }

  /** Drop a cached answer — call this when you see a Deposited/Subscribed/Cancelled event. */
  invalidate(user: Address): void {
    this.cache.delete(getAddress(user));
  }

  /**
   * Watch the contract and invalidate cache entries as customers change state. Optional: the
   * TTL alone is correct, this just makes top-ups take effect instantly. Returns an unwatch fn.
   */
  watch(): () => void {
    return this.client.watchContractEvent({
      address: this.contract,
      abi: subscriptionBillingAbi,
      onLogs: (logs) => {
        for (const log of logs) {
          const user = (log as { args?: { user?: Address } }).args?.user;
          if (user) this.invalidate(user);
        }
      },
      onError: (err) => console.error("[billing] event subscription error:", err),
    });
  }

  private async fetchUntil(user: Address): Promise<number> {
    const until = await this.client.readContract({
      address: this.contract,
      abi: subscriptionBillingAbi,
      functionName: "subscribedUntil",
      args: [user],
    });
    return Number(until);
  }

  private ttlFor(until: number): number {
    if (until === 0) return Math.min(this.maxTtlMs, 10_000); // re-check non-subscribers sooner
    const msUntilLapse = until * 1000 - Date.now();
    if (msUntilLapse <= 0) return 5_000;
    return Math.min(this.maxTtlMs, msUntilLapse);
  }
}
