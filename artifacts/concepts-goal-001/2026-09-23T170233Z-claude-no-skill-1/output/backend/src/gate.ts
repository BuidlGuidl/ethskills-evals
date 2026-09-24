import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
  type Chain,
} from 'viem'
import { billingAbi } from './abi.js'

export type Entitlement = {
  active: boolean
  /** 0 = none, 1 = hobby, 2 = pro. Use this for tier-dependent rate limits. */
  plan: number
  /** Unix seconds. The subscription cannot lapse on its own before this. */
  expiresAt: number
}

export type GateOptions = {
  address: Address
  chain: Chain
  rpcUrl: string
  /**
   * How long a positive answer may be reused. The contract tells us the latest
   * moment an account can still be active (`expiresAt`), but a customer may
   * cancel at any time, and a cancel is effective immediately on chain. This TTL
   * is therefore the window in which we might still serve a just-cancelled
   * customer. Seconds of over-service on a $5/month plan is not worth an RPC
   * call per request; 30s is a sensible default.
   */
  positiveTtlMs?: number
  /**
   * Negative answers are cached far more briefly: someone who just topped up
   * should not be locked out for half a minute.
   */
  negativeTtlMs?: number
  /**
   * If the RPC is unreachable, keep honouring a cached positive answer for this
   * long. Losing your RPC provider should degrade into serving paying customers,
   * not into an outage for all of them.
   */
  staleIfErrorMs?: number
  maxEntries?: number
}

type Entry = { value: Entitlement; freshUntil: number; usableUntil: number }

/**
 * Per-request subscription check for the weather API.
 *
 * The contract renews subscriptions lazily, so a single `statusOf` view call is
 * always the current truth -- there is no "pending charge" state to reconcile
 * and no webhook to miss. That makes this cache a pure latency optimisation
 * rather than a correctness-critical component.
 */
export class SubscriptionGate {
  private readonly client: PublicClient
  private readonly contract: Address
  private readonly positiveTtl: number
  private readonly negativeTtl: number
  private readonly staleIfError: number
  private readonly maxEntries: number
  private readonly cache = new Map<string, Entry>()
  private readonly inflight = new Map<string, Promise<Entitlement>>()

  constructor(opts: GateOptions) {
    this.client = createPublicClient({
      chain: opts.chain,
      transport: http(opts.rpcUrl, { batch: true, retryCount: 2 }),
    })
    this.contract = opts.address
    this.positiveTtl = opts.positiveTtlMs ?? 30_000
    this.negativeTtl = opts.negativeTtlMs ?? 5_000
    this.staleIfError = opts.staleIfErrorMs ?? 10 * 60_000
    this.maxEntries = opts.maxEntries ?? 50_000
  }

  /** The call to put in front of every request handler. */
  async check(account: Address): Promise<Entitlement> {
    const key = account.toLowerCase()
    const now = Date.now()

    const hit = this.cache.get(key)
    if (hit && now < hit.freshUntil) return hit.value

    // Collapse a thundering herd on the same address into one RPC call.
    const pending = this.inflight.get(key)
    if (pending) return pending

    const task = this.fetch(account, key, hit, now).finally(() => {
      this.inflight.delete(key)
    })
    this.inflight.set(key, task)
    return task
  }

  private async fetch(
    account: Address,
    key: string,
    stale: Entry | undefined,
    now: number,
  ): Promise<Entitlement> {
    try {
      const status = await this.client.readContract({
        address: this.contract,
        abi: billingAbi,
        functionName: 'statusOf',
        args: [account],
      })

      const value: Entitlement = {
        active: status.active,
        plan: status.plan,
        expiresAt: Number(status.expiresAt),
      }

      // Never cache a positive answer past the point the contract itself says
      // the subscription runs out of money.
      const ttl = value.active ? this.positiveTtl : this.negativeTtl
      const hardStop = value.active ? value.expiresAt * 1000 : Infinity
      const freshUntil = Math.min(now + ttl, hardStop)

      this.store(key, {
        value,
        freshUntil,
        usableUntil: value.active ? Math.min(now + this.staleIfError, hardStop) : now,
      })
      return value
    } catch (err) {
      if (stale && now < stale.usableUntil) {
        // RPC is down. Serve the customer; do not turn a provider outage into
        // a billing outage. This is logged loudly so it is visible.
        console.warn(
          `[billing] RPC read failed for ${account}, serving cached entitlement`,
          err,
        )
        return stale.value
      }
      throw err
    }
  }

  private store(key: string, entry: Entry): void {
    // Crude bounded LRU: Map preserves insertion order, so the oldest key is first.
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next()
      if (!oldest.done) this.cache.delete(oldest.value)
    }
    this.cache.delete(key)
    this.cache.set(key, entry)
  }

  /** Drop a cached answer, e.g. on a Cancelled or Subscribed log. */
  invalidate(account: Address): void {
    this.cache.delete(account.toLowerCase())
  }

  /**
   * Watch billing events and invalidate immediately. Optional: without it the
   * cache TTL still bounds staleness, but this makes cancels and top-ups take
   * effect within a block instead of within `positiveTtlMs`.
   */
  watch(): () => void {
    return this.client.watchContractEvent({
      address: this.contract,
      abi: billingAbi,
      onLogs: (logs) => {
        for (const log of logs) {
          const account = (log.args as { account?: Address }).account
          if (account) this.invalidate(account)
        }
      },
      onError: (err) => console.warn('[billing] event stream error', err),
    })
  }
}
