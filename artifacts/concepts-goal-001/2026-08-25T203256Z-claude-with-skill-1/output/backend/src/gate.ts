import {
  createPublicClient,
  http,
  webSocket,
  getAddress,
  type Address,
  type PublicClient,
  type Chain,
} from "viem";
import { subscriptionBillingAbi } from "./abi.js";

/**
 * Per-request subscription check for the API.
 *
 * The contract answers "is this address subscribed?" for free — `isActive` is a view, so it
 * costs no gas and needs no signer. But it is still a network round trip, and a weather API
 * serving a few hundred requests a second cannot make one of those per request.
 *
 * What makes caching safe here is that the contract does not just say yes or no. It says
 * `activeUntil` — the exact second the subscription lapses if nothing else happens. That is a
 * promise about the future, so a single read authorises every request until that timestamp.
 * The cache is not a guess; it is the contract's own answer with its own expiry attached.
 *
 * Only three things can move that timestamp, and all three emit an event:
 *   - a top-up or a plan change  -> later  (a caching mistake here locks out a paying customer)
 *   - a withdrawal or a cancel   -> earlier (a caching mistake here serves a few free requests)
 * So we watch those events and drop the entry when one lands. Between events, we re-read
 * periodically anyway, because a dropped websocket must not be able to serve stale answers
 * forever.
 */

export type FailureMode = "allow" | "deny";

export interface GateConfig {
  /** Deployed SubscriptionBilling address. */
  contract: Address;
  /** viem chain (e.g. `base` from viem/chains). */
  chain: Chain;
  /** HTTP RPC. Used for all reads. */
  rpcUrl: string;
  /**
   * Optional WebSocket RPC. Without it the gate still works, but reacts to top-ups only at the
   * next revalidation instead of within a block. Worth having: it is the difference between a
   * customer who just paid waiting 60s and waiting 2s.
   */
  wsRpcUrl?: string;

  /**
   * Keep serving for this long after a subscription lapses.
   *
   * Not sloppiness — insurance against the customer being unable to pay. If the L2 sequencer
   * is down, or their wallet is on a laptop that is closed, they cannot top up even if they
   * want to. An hour of grace on a $5/month plan is about $0.007 of service. Set to 0 if you
   * would rather cut people off exactly on time.
   */
  gracePeriodSeconds?: number;

  /** Max age of a cached "active" answer before we re-read. Default 60s. */
  revalidateAfterSeconds?: number;

  /**
   * Max age of a cached "not active" answer. Short on purpose: this is the window in which a
   * customer who just topped up still gets a 402. Default 10s.
   */
  negativeCacheSeconds?: number;

  /**
   * If the RPC is unreachable, how long to keep answering from an expired cache entry before
   * falling back to `onRpcFailure`. Default 15 minutes.
   */
  serveStaleForSeconds?: number;

  /**
   * What to do when the RPC is down and there is no usable cache entry.
   *
   * "allow" means an RPC outage degrades into free service; "deny" means it degrades into an
   * outage for your paying customers. For a hobby weather API "allow" is almost certainly the
   * right call — you lose pennies, not customers. Default "allow".
   */
  onRpcFailure?: FailureMode;

  /** Addresses that always pass — your own monitoring, a demo key, a free tier. */
  allowlist?: Address[];

  /** Called on every RPC failure, so it lands in your logs instead of vanishing. */
  onError?: (err: unknown, context: string) => void;
}

interface Entry {
  activeUntil: number; // unix seconds; 0 == not subscribed
  planId: number;
  checkedAt: number;
}

const MAX_BATCH = 200;
const BATCH_WINDOW_MS = 8;

export class SubscriptionGate {
  private readonly reader: PublicClient;
  private readonly cache = new Map<Address, Entry>();
  private readonly inflight = new Map<Address, Pending>();
  private queue: Address[] = [];
  private queueTimer: NodeJS.Timeout | null = null;
  private unwatch: (() => void) | null = null;
  private readonly allowlist: Set<Address>;

  private readonly grace: number;
  private readonly revalidate: number;
  private readonly negative: number;
  private readonly stale: number;
  private readonly onRpcFailure: FailureMode;
  private readonly onError: (err: unknown, ctx: string) => void;

  /** Cheap counters for /metrics — see NOTES.md on what to watch. */
  readonly stats = { hits: 0, misses: 0, rpcCalls: 0, rpcErrors: 0, staleServed: 0, failOpen: 0 };

  constructor(private readonly cfg: GateConfig) {
    this.reader = createPublicClient({
      chain: cfg.chain,
      transport: http(cfg.rpcUrl, { batch: true }),
    });
    this.grace = cfg.gracePeriodSeconds ?? 3600;
    this.revalidate = cfg.revalidateAfterSeconds ?? 60;
    this.negative = cfg.negativeCacheSeconds ?? 10;
    this.stale = cfg.serveStaleForSeconds ?? 900;
    this.onRpcFailure = cfg.onRpcFailure ?? "allow";
    this.onError = cfg.onError ?? (() => {});
    this.allowlist = new Set((cfg.allowlist ?? []).map((a) => getAddress(a)));
  }

  /** The call your request handler makes. */
  async isActive(address: Address): Promise<boolean> {
    const a = getAddress(address);
    if (this.allowlist.has(a)) return true;

    const now = nowSec();
    const cached = this.cache.get(a);

    if (cached && now < cached.checkedAt + this.ttlFor(cached, now)) {
      this.stats.hits++;
      return this.decide(cached, now);
    }
    this.stats.misses++;

    let fresh: Entry | null = null;
    try {
      fresh = await this.load(a);
    } catch (err) {
      this.onError(err, `isActive(${a})`);
      this.stats.rpcErrors++;
    }

    if (fresh) return this.decide(fresh, now);

    if (cached && now < cached.checkedAt + this.stale) {
      this.stats.staleServed++;
      return this.decide(cached, now);
    }
    this.stats.failOpen++;
    return this.onRpcFailure === "allow";
  }

  /** Full status, for a /account endpoint your customers can look at. */
  async statusOf(address: Address) {
    const a = getAddress(address);
    const e = await this.load(a);
    if (!e) throw new Error(`could not read status for ${a}: RPC unavailable`);
    return {
      address: a,
      active: this.decide(e, nowSec()),
      planId: e.planId,
      activeUntil: e.activeUntil,
      activeUntilISO: e.activeUntil ? new Date(e.activeUntil * 1000).toISOString() : null,
      gracePeriodSeconds: this.grace,
    };
  }

  private decide(e: Entry, now: number): boolean {
    return e.activeUntil !== 0 && now < e.activeUntil + this.grace;
  }

  private ttlFor(e: Entry, now: number): number {
    if (e.activeUntil === 0) return this.negative;
    // Never cache past the moment the answer changes on its own.
    const untilLapse = Math.max(0, e.activeUntil + this.grace - now);
    return Math.min(this.revalidate, Math.max(1, untilLapse));
  }

  /**
   * Coalesces concurrent misses into one batched `statusOfMany` call. A thundering herd of
   * requests from a hundred different addresses becomes one RPC read, not a hundred.
   */
  private load(a: Address): Promise<Entry | null> {
    const existing = this.inflight.get(a);
    if (existing) return existing.promise;

    const pending = newPending();
    this.inflight.set(a, pending);
    this.queue.push(a);

    if (this.queue.length >= MAX_BATCH) {
      if (this.queueTimer) clearTimeout(this.queueTimer);
      this.queueTimer = null;
      void this.flush();
    } else if (!this.queueTimer) {
      this.queueTimer = setTimeout(() => void this.flush(), BATCH_WINDOW_MS);
    }
    return pending.promise;
  }

  private async flush(): Promise<void> {
    this.queueTimer = null;
    const batch = this.queue.splice(0, MAX_BATCH);
    if (batch.length === 0) return;
    if (this.queue.length > 0) {
      this.queueTimer = setTimeout(() => void this.flush(), BATCH_WINDOW_MS);
    }
    const pending = batch.map((a) => this.inflight.get(a)!);

    try {
      this.stats.rpcCalls++;
      const rows = (await this.reader.readContract({
        address: this.cfg.contract,
        abi: subscriptionBillingAbi,
        functionName: "statusOfMany",
        args: [batch],
      })) as ReadonlyArray<{ planId: number; activeUntil: bigint }>;

      const at = nowSec();
      rows.forEach((row, i) => {
        const entry: Entry = {
          activeUntil: Number(row.activeUntil),
          planId: Number(row.planId),
          checkedAt: at,
        };
        this.cache.set(batch[i], entry);
        pending[i].resolve(entry);
      });
    } catch (err) {
      this.stats.rpcErrors++;
      this.onError(err, "statusOfMany");
      // Resolve with null rather than rejecting: callers decide the fallback policy, and an
      // unhandled rejection here would take down the request handler instead of degrading.
      pending.forEach((pd) => pd.resolve(null));
    } finally {
      batch.forEach((a) => this.inflight.delete(a));
    }
  }

  /**
   * Watch the four events that can move `activeUntil` and drop those cache entries.
   * Safe to skip — the gate is correct without it, just slower to notice a top-up.
   */
  start(): void {
    if (this.unwatch) return;

    // Deposited and Subscribed extend access; Withdrawn and Cancelled shorten it. Watching all
    // of the contract's events and dropping the named account is simpler than filtering, and
    // over-invalidating only costs one extra read.
    const onLogs = (logs: readonly unknown[]) => {
      for (const log of logs) {
        const account = (log as { args?: { account?: Address } }).args?.account;
        if (account) this.cache.delete(getAddress(account));
      }
    };
    const onError = (err: unknown) => this.onError(err, "watchContractEvent");

    if (this.cfg.wsRpcUrl) {
      const watcher = createPublicClient({
        chain: this.cfg.chain,
        transport: webSocket(this.cfg.wsRpcUrl),
      });
      this.unwatch = watcher.watchContractEvent({
        address: this.cfg.contract,
        abi: subscriptionBillingAbi,
        onLogs,
        onError,
      });
    } else {
      const watcher = createPublicClient({
        chain: this.cfg.chain,
        transport: http(this.cfg.rpcUrl),
      });
      this.unwatch = watcher.watchContractEvent({
        address: this.cfg.contract,
        abi: subscriptionBillingAbi,
        onLogs,
        onError,
        poll: true,
        pollingInterval: 4000,
      });
    }
  }

  stop(): void {
    this.unwatch?.();
    this.unwatch = null;
    if (this.queueTimer) clearTimeout(this.queueTimer);
  }

  /** Force a re-read on the next request. Useful right after your frontend sends a top-up. */
  invalidate(address: Address): void {
    this.cache.delete(getAddress(address));
  }

  /**
   * Pre-load the cache for your known subscribers at boot, so the first request after a deploy
   * is not a cache miss. Feed it addresses from your own database or from `Subscribed` logs.
   */
  async warm(addresses: Address[]): Promise<void> {
    await Promise.all(addresses.map((a) => this.load(getAddress(a)).catch(() => null)));
  }
}

interface Pending {
  promise: Promise<Entry | null>;
  resolve: (v: Entry | null) => void;
}

function newPending(): Pending {
  let resolve!: (v: Entry | null) => void;
  const promise = new Promise<Entry | null>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}
