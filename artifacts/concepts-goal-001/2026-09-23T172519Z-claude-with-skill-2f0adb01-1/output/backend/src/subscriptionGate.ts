import { createPublicClient, http, type Address, type PublicClient } from "viem";
import { base } from "viem/chains";
import { billingAbi } from "./abi.js";

/**
 * Per-request subscription check for the API.
 *
 * The important property: `activeUntil` returns the exact timestamp at which an
 * address runs out of credit, and nothing except an action by that address can
 * move it *earlier*. So once we have read it, we can trust it until it passes —
 * no RPC call per request, no webhooks, no database to keep in sync.
 *
 * Deposits move it later, which the cache would miss; we bound that with a
 * refresh interval so a top-up takes effect within `refreshAfterMs` at worst.
 * Cancellation is the one case that must be exact, and it is: cancelling
 * settles to the current second, so `activeUntil` becomes "now" and the cached
 * value expires immediately on its own.
 */
export interface GateOptions {
  contract: Address;
  rpcUrl: string;
  /** Re-read an address at least this often even while it is known-active. Default 60s. */
  refreshAfterMs?: number;
  /** How long to trust a negative result before re-checking. Default 15s. */
  negativeTtlMs?: number;
  /**
   * What to do when the RPC is unreachable and we have no usable cache entry.
   * "closed" rejects the request (safe for revenue, bad for uptime).
   * "open" serves it (good for uptime, gives away some free calls).
   * Default "closed" — see NOTES.md for why this is the decision to make
   * deliberately rather than inherit.
   */
  onRpcFailure?: "open" | "closed";
  client?: PublicClient;
}

interface Entry {
  activeUntilMs: number;
  checkedAtMs: number;
}

export class SubscriptionGate {
  private readonly cache = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<Entry>>();
  private readonly client: PublicClient;
  private readonly contract: Address;
  private readonly refreshAfterMs: number;
  private readonly negativeTtlMs: number;
  private readonly onRpcFailure: "open" | "closed";

  /** Incremented so you can alarm on it — see NOTES.md. */
  public rpcFailures = 0;
  public rpcCalls = 0;
  public cacheHits = 0;

  constructor(opts: GateOptions) {
    this.contract = opts.contract;
    this.refreshAfterMs = opts.refreshAfterMs ?? 60_000;
    this.negativeTtlMs = opts.negativeTtlMs ?? 15_000;
    this.onRpcFailure = opts.onRpcFailure ?? "closed";
    this.client =
      opts.client ??
      (createPublicClient({ chain: base, transport: http(opts.rpcUrl) }) as PublicClient);
  }

  /** The call to make per incoming API request. */
  async isActive(account: Address): Promise<boolean> {
    const key = account.toLowerCase();
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && this.usable(cached, now)) {
      this.cacheHits++;
      return cached.activeUntilMs > now;
    }

    // Collapse concurrent misses for the same address into one RPC call, so a
    // burst from one customer cannot fan out into a burst at the provider.
    let pending = this.inflight.get(key);
    if (!pending) {
      pending = this.fetch(account, key).finally(() => this.inflight.delete(key));
      this.inflight.set(key, pending);
    }

    try {
      const entry = await pending;
      return entry.activeUntilMs > Date.now();
    } catch (err) {
      this.rpcFailures++;
      // A stale entry beats guessing. Only fall back to the policy if we have nothing.
      if (cached) return cached.activeUntilMs > now;
      if (this.onRpcFailure === "open") return true;
      throw err;
    }
  }

  private usable(entry: Entry, now: number): boolean {
    const active = entry.activeUntilMs > now;
    if (active) {
      // Trustworthy until it expires, but refresh periodically to notice top-ups
      // and plan upgrades.
      return now - entry.checkedAtMs < this.refreshAfterMs;
    }
    return now - entry.checkedAtMs < this.negativeTtlMs;
  }

  private async fetch(account: Address, key: string): Promise<Entry> {
    this.rpcCalls++;
    const activeUntil = await this.client.readContract({
      address: this.contract,
      abi: billingAbi,
      functionName: "activeUntil",
      args: [account],
    });
    const entry: Entry = {
      activeUntilMs: Number(activeUntil) * 1000,
      checkedAtMs: Date.now(),
    };
    this.cache.set(key, entry);
    return entry;
  }

  /** Drop a cached entry, e.g. on a `Subscribed` or `Deposited` event. */
  invalidate(account: Address): void {
    this.cache.delete(account.toLowerCase());
  }

  stats() {
    return {
      rpcCalls: this.rpcCalls,
      cacheHits: this.cacheHits,
      rpcFailures: this.rpcFailures,
      cachedAddresses: this.cache.size,
    };
  }
}
