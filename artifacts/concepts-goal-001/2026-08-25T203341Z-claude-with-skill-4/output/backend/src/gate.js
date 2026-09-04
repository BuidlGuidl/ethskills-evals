import {createPublicClient, http, getAddress} from "viem";
import {billingAbi, ACCOUNT_EVENTS} from "./abi.js";
import {config} from "./config.js";

/**
 * The subscription gate.
 *
 * The contract answers "is this address paid up?" with a free `eth_call` — no transaction, no
 * gas, no signature. The only real problem is doing it on every inbound API request, which would
 * put an RPC round trip in front of a weather lookup. So this caches.
 *
 * The cache is safe to hold because `statusOf` returns the *expiry timestamp*, not just a
 * boolean. Between reads the answer can only change in two ways:
 *
 *   - time passes and the prepaid balance runs out. Already known: it is the expiry we cached.
 *   - the customer sends a transaction (top up, withdraw, cancel, change plan). That emits an
 *     event, and the watcher below drops the entry.
 *
 * That is the whole invalidation story. If the watcher goes quiet, the gate downgrades itself to
 * a few-second TTL rather than serving confidently stale answers — a cancelled customer keeping
 * access for a minute is a rounding error, but a paying customer being locked out is an outage.
 */
export class SubscriptionGate {
  constructor({onLog = () => {}} = {}) {
    this.address = getAddress(config.billingAddress);
    this.onLog = onLog;
    this.cache = new Map(); // address -> {subscribed, planId, expiry, fetchedAt, until}
    this.unwatch = null;
    this.watcherLastAlive = 0;
    this.stats = {hits: 0, misses: 0, rpcErrors: 0, invalidations: 0};

    this.client = createPublicClient({chain: config.chain, transport: http(config.rpcUrl)});
    this.fallbackClient = config.fallbackRpcUrl
      ? createPublicClient({chain: config.chain, transport: http(config.fallbackRpcUrl)})
      : null;
  }

  get watcherHealthy() {
    return Date.now() - this.watcherLastAlive < config.watcherStaleMs;
  }

  /** Subscribe to the events that can invalidate a cached answer. */
  async start() {
    this.watcherLastAlive = Date.now();
    this.unwatch = this.client.watchContractEvent({
      address: this.address,
      abi: billingAbi,
      eventName: undefined, // all of them; we filter below
      poll: true,
      pollingInterval: 4_000,
      onLogs: (logs) => {
        this.watcherLastAlive = Date.now();
        for (const log of logs) {
          if (!ACCOUNT_EVENTS.includes(log.eventName)) continue;
          const account = log.args?.account;
          if (!account) continue;
          this.cache.delete(getAddress(account));
          this.stats.invalidations++;
          this.onLog({type: "invalidate", account, event: log.eventName});
        }
      },
      onError: (err) => {
        // Deliberately do NOT refresh watcherLastAlive here: an erroring watcher is a dead
        // watcher as far as cache trust goes.
        this.onLog({type: "watcher_error", error: err.shortMessage ?? err.message});
      },
    });

    // watchContractEvent's poller is silent when there is nothing to report, so prove liveness
    // separately by asking for the head block.
    this.heartbeat = setInterval(async () => {
      try {
        await this.client.getBlockNumber();
        this.watcherLastAlive = Date.now();
      } catch (err) {
        this.onLog({type: "heartbeat_failed", error: err.shortMessage ?? err.message});
      }
    }, 20_000);
    if (this.heartbeat.unref) this.heartbeat.unref();
  }

  async stop() {
    if (this.unwatch) this.unwatch();
    if (this.heartbeat) clearInterval(this.heartbeat);
  }

  /**
   * @returns {Promise<{subscribed: boolean, planId: number, expiry: number, source: string}>}
   */
  async status(rawAddress) {
    const account = getAddress(rawAddress);
    const now = Date.now();
    const cached = this.cache.get(account);

    if (cached && now < cached.until) {
      // The cached expiry is authoritative for the "ran out of money" case even inside the TTL,
      // because that transition needs no transaction and therefore emits no event.
      if (cached.subscribed && now / 1000 >= cached.expiry) {
        this.cache.delete(account);
      } else {
        this.stats.hits++;
        return {...cached, source: "cache"};
      }
    }

    this.stats.misses++;
    const fresh = await this.#read(account);

    const ttl = this.watcherHealthy ? config.cacheTtlMs : config.degradedCacheTtlMs;
    // Never cache past the expiry we were just told about.
    const untilExpiry = fresh.subscribed ? fresh.expiry * 1000 : Infinity;
    const entry = {...fresh, fetchedAt: now, until: Math.min(now + ttl, untilExpiry)};
    this.cache.set(account, entry);
    return {...entry, source: "chain"};
  }

  async #read(account) {
    try {
      return await this.#statusOf(this.client, account);
    } catch (err) {
      this.stats.rpcErrors++;
      this.onLog({type: "rpc_error", account, error: err.shortMessage ?? err.message});
      if (!this.fallbackClient) throw err;
      return await this.#statusOf(this.fallbackClient, account);
    }
  }

  async #statusOf(client, account) {
    const [subscribed, planId, expiry] = await client.readContract({
      address: this.address,
      abi: billingAbi,
      functionName: "statusOf",
      args: [account],
    });
    return {address: account, subscribed, planId: Number(planId), expiry: Number(expiry)};
  }

  health() {
    return {
      contract: this.address,
      chainId: config.chainId,
      watcherHealthy: this.watcherHealthy,
      cacheTtlMs: this.watcherHealthy ? config.cacheTtlMs : config.degradedCacheTtlMs,
      cachedAccounts: this.cache.size,
      ...this.stats,
    };
  }
}
