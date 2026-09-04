import type { Address, PublicClient } from "viem";
import { getAddress } from "viem";
import { subscriptionBillingAbi } from "./abi.ts";

/**
 * Per-request subscription check.
 *
 * The naive version — one `eth_call` to `isSubscribed` per incoming API request —
 * is correct but puts your RPC provider in the hot path of every weather lookup.
 * This wraps it in the cache the contract is designed for.
 *
 * The contract exposes `paidThrough`: the exact second an account stops being
 * subscribed if nothing else happens. That makes a positive answer cacheable until
 * that timestamp, with no polling — the only things that can move it earlier (cancel,
 * withdraw, plan switch) are transactions, and every one of them emits `AccountUpdated`.
 * So: cache until `paidThrough`, and let the event stream invalidate early.
 *
 * `maxPositiveTtlMs` is the belt to that braces. If the event subscription silently
 * dies — a dropped websocket, a provider hiccup — the cache would otherwise happily
 * serve a cancelled customer until their original expiry. The TTL bounds that window
 * to something you choose, at the cost of one `eth_call` per address per TTL.
 */
export interface SubscriptionGateOptions {
  client: PublicClient;
  /** Deployed SubscriptionBilling address. */
  address: Address;
  /** Upper bound on how long a cached "subscribed" is trusted. Default 60s. */
  maxPositiveTtlMs?: number;
  /** How long a cached "not subscribed" is trusted. Default 15s. */
  negativeTtlMs?: number;
  /**
   * If the RPC is unreachable, keep serving an expired-but-previously-active entry
   * for this long. An outage at your RPC provider should not read as "everybody's
   * subscription ended". Default 10 minutes.
   */
  staleGraceMs?: number;
  /** Subscribe to AccountUpdated for immediate invalidation. Default true. */
  watchEvents?: boolean;
  /** Injectable clock, in seconds. Exists so tests can time-travel with the chain. */
  nowSeconds?: () => number;
}

export interface SubscriptionStatus {
  address: Address;
  active: boolean;
  plan: number;
  /** Unix seconds at which this account stops being subscribed. 0 if not subscribed. */
  paidThrough: number;
  /** Where the answer came from — useful to log while you tune the TTLs. */
  source: "cache" | "rpc" | "stale";
}

interface CacheEntry {
  plan: number;
  paidThrough: number;
  /** Wall-clock ms after which this entry must be refetched. */
  expiresAt: number;
  fetchedAt: number;
}

export class SubscriptionGate {
  private readonly opts: Required<SubscriptionGateOptions>;
  private readonly cache = new Map<Address, CacheEntry>();
  private unwatch?: () => void;

  /** Counters worth exporting to whatever you use for dashboards. */
  readonly stats = {
    cacheHits: 0,
    rpcCalls: 0,
    rpcErrors: 0,
    servedStale: 0,
    eventInvalidations: 0,
    /** Requests refused because the caller was not subscribed. */
    denied: 0,
  };

  constructor(options: SubscriptionGateOptions) {
    this.opts = {
      maxPositiveTtlMs: 60_000,
      negativeTtlMs: 15_000,
      staleGraceMs: 600_000,
      watchEvents: true,
      nowSeconds: () => Math.floor(Date.now() / 1000),
      ...options,
    };
    if (this.opts.watchEvents) this.start();
  }

  /** Begin invalidating the cache from AccountUpdated logs. */
  start(): void {
    if (this.unwatch) return;
    this.unwatch = this.opts.client.watchContractEvent({
      address: this.opts.address,
      abi: subscriptionBillingAbi,
      eventName: "AccountUpdated",
      onLogs: (logs) => {
        for (const log of logs) {
          const account = log.args?.account;
          if (!account) continue;
          this.cache.delete(getAddress(account));
          this.stats.eventInvalidations++;
        }
      },
      // A dead subscription must not look like "no accounts changed". Surface it.
      onError: (error) => {
        this.stats.rpcErrors++;
        console.error("[gate] AccountUpdated subscription error:", error.message);
      },
    });
  }

  stop(): void {
    this.unwatch?.();
    this.unwatch = undefined;
  }

  /** Drop a cached entry, e.g. right after your frontend reports a successful top-up. */
  invalidate(address: Address): void {
    this.cache.delete(getAddress(address));
  }

  async check(rawAddress: Address): Promise<SubscriptionStatus> {
    const address = getAddress(rawAddress);
    const nowMs = Date.now();
    const nowSec = this.opts.nowSeconds();

    const cached = this.cache.get(address);
    if (cached && nowMs < cached.expiresAt) {
      this.stats.cacheHits++;
      return this.toStatus(address, cached, nowSec, "cache");
    }

    try {
      this.stats.rpcCalls++;
      const [, plan, , paidThroughAt] = await this.opts.client.readContract({
        address: this.opts.address,
        abi: subscriptionBillingAbi,
        functionName: "statusOf",
        args: [address],
      });

      const paidThrough = Number(paidThroughAt);
      const entry: CacheEntry = {
        plan,
        paidThrough,
        fetchedAt: nowMs,
        expiresAt: this.expiryFor(paidThrough, nowSec, nowMs),
      };
      this.cache.set(address, entry);
      return this.toStatus(address, entry, nowSec, "rpc");
    } catch (error) {
      this.stats.rpcErrors++;

      // Fail *open* for someone we recently saw paying, and only for a bounded time.
      // Fail closed for everyone else — an RPC outage is not a reason to hand out
      // free API access to addresses we have never verified.
      if (cached && cached.paidThrough > nowSec && nowMs - cached.fetchedAt < this.opts.staleGraceMs) {
        this.stats.servedStale++;
        return this.toStatus(address, cached, nowSec, "stale");
      }
      throw error;
    }
  }

  /** Convenience wrapper for the request path. */
  async isSubscribed(address: Address): Promise<boolean> {
    const status = await this.check(address);
    if (!status.active) this.stats.denied++;
    return status.active;
  }

  private expiryFor(paidThrough: number, nowSec: number, nowMs: number): number {
    if (paidThrough <= nowSec) return nowMs + this.opts.negativeTtlMs;
    // Trust it until it actually expires, but never longer than the safety TTL.
    const untilExpiry = (paidThrough - nowSec) * 1000;
    return nowMs + Math.min(untilExpiry, this.opts.maxPositiveTtlMs);
  }

  private toStatus(
    address: Address,
    entry: CacheEntry,
    nowSec: number,
    source: SubscriptionStatus["source"],
  ): SubscriptionStatus {
    const active = entry.paidThrough > nowSec;
    return { address, active, plan: active ? entry.plan : 0, paidThrough: entry.paidThrough, source };
  }
}
