import {createPublicClient, getAddress, http, webSocket} from "viem";
import {subscriptionBillingAbi} from "./abi.js";

/**
 * Per-request subscription check for the weather API.
 *
 * The naive version — one `eth_call` per incoming request — works and is correct, but it puts
 * your RPC provider in the hot path of every request you serve. This wraps it in the cache the
 * contract is designed for:
 *
 *   `paidThrough(addr)` is the timestamp the subscription is guaranteed to survive to if the
 *   subscriber does nothing. It floors, so it is never later than the truth. That makes it a
 *   safe upper bound on how long a positive answer may be cached.
 *
 * The only things that can invalidate a positive answer early are the subscriber upgrading to a
 * pricier plan or cancelling. Both emit events, so we watch for them; the TTL is the belt to
 * that pair of braces, for when the log subscription drops.
 *
 * Failure policy is deliberately fail-closed-with-grace: if the RPC is down we keep serving
 * anyone whose cached `paidThrough` has not yet passed, and reject anyone we have never seen.
 * Serving a cancelled customer for a few minutes costs cents; refusing every paying customer
 * because Alchemy hiccuped costs a lot more.
 */
export class SubscriptionGate {
  /**
   * @param {object} opts
   * @param {`0x${string}`} opts.address        Deployed SubscriptionBilling address.
   * @param {import("viem").Chain} opts.chain
   * @param {string} opts.rpcUrl                HTTP RPC for reads.
   * @param {string} [opts.wsRpcUrl]            Optional WS RPC for live event invalidation.
   * @param {number} [opts.positiveTtlMs=60000] Max staleness for a "yes" (bounds upgrade/cancel lag).
   * @param {number} [opts.negativeTtlMs=5000]  Max staleness for a "no" (bounds signup lag).
   * @param {number} [opts.staleGraceMs=600000] How long a stale "yes" is honoured when RPC fails.
   */
  constructor(opts) {
    this.address = getAddress(opts.address);
    this.positiveTtlMs = opts.positiveTtlMs ?? 60_000;
    this.negativeTtlMs = opts.negativeTtlMs ?? 5_000;
    this.staleGraceMs = opts.staleGraceMs ?? 600_000;

    this.client = createPublicClient({chain: opts.chain, transport: http(opts.rpcUrl)});
    this.wsClient = opts.wsRpcUrl
      ? createPublicClient({chain: opts.chain, transport: webSocket(opts.wsRpcUrl)})
      : null;

    /** @type {Map<string, {activeUntil: bigint, fetchedAt: number, active: boolean}>} */
    this.cache = new Map();
    /** @type {Map<string, Promise<any>>} in-flight dedupe, so a burst on one address is one call */
    this.inFlight = new Map();
    this.unwatch = null;
    this.stats = {hits: 0, misses: 0, rpcErrors: 0, servedStale: 0, invalidations: 0};
  }

  /** Start live cache invalidation. Optional: the TTL alone is correct, just laggier. */
  watch() {
    const client = this.wsClient ?? this.client;
    this.unwatch = client.watchContractEvent({
      address: this.address,
      abi: subscriptionBillingAbi,
      eventName: ["Subscribed", "ToppedUp", "Cancelled"],
      onLogs: (logs) => {
        for (const log of logs) {
          const who = log.args?.subscriber;
          if (who) {
            this.cache.delete(who.toLowerCase());
            this.stats.invalidations++;
          }
        }
      },
      onError: () => {
        // A dropped subscription degrades to TTL-only freshness. Never fatal.
        this.stats.rpcErrors++;
      },
    });
    return this.unwatch;
  }

  stop() {
    this.unwatch?.();
    this.unwatch = null;
  }

  /**
   * The question the API asks on every request.
   * @param {`0x${string}`} subscriber
   * @returns {Promise<boolean>}
   */
  async isSubscribed(subscriber) {
    // Normalise first: sessions and logs hand us lowercased addresses, and viem rejects an
    // address whose casing does not match its EIP-55 checksum.
    subscriber = getAddress(subscriber);
    const key = subscriber.toLowerCase();
    const now = Date.now();
    const nowSec = BigInt(Math.floor(now / 1000));
    const entry = this.cache.get(key);

    if (entry && this.#fresh(entry, now, nowSec)) {
      this.stats.hits++;
      return entry.active;
    }

    this.stats.misses++;
    try {
      return (await this.#refresh(key, subscriber)).active;
    } catch (err) {
      this.stats.rpcErrors++;
      // Honour a stale "yes" within the grace window rather than dropping paying customers.
      if (entry && entry.active && nowSec < entry.activeUntil && now - entry.fetchedAt < this.staleGraceMs) {
        this.stats.servedStale++;
        return true;
      }
      throw err;
    }
  }

  /** Full account state, uncached — for a dashboard or a support query, not the request path. */
  async accountOf(subscriber) {
    const [planId, pricePerPeriod, balance, unusedBalance, activeUntil, active] =
      await this.client.readContract({
        address: this.address,
        abi: subscriptionBillingAbi,
        functionName: "accountOf",
        args: [getAddress(subscriber)],
      });
    return {planId, pricePerPeriod, balance, unusedBalance, activeUntil, active};
  }

  #fresh(entry, now, nowSec) {
    const ttl = entry.active ? this.positiveTtlMs : this.negativeTtlMs;
    if (now - entry.fetchedAt >= ttl) return false;
    // A "yes" also expires the instant the prepaid balance runs out, with no transaction and no
    // event to tell us — the subscription lapses purely by the clock moving.
    if (entry.active && nowSec >= entry.activeUntil) return false;
    return true;
  }

  #refresh(key, subscriber) {
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const p = this.accountOf(subscriber)
      .then(({activeUntil, active}) => {
        const entry = {activeUntil, active, fetchedAt: Date.now()};
        this.cache.set(key, entry);
        return entry;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, p);
    return p;
  }
}
