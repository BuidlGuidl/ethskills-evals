import { createPublicClient, http, getAddress } from 'viem'
import { billingAbi, PLANS } from './abi.js'

/**
 * Per-request subscription check for the API.
 *
 * The naive version — one eth_call per incoming request — would put your RPC provider in
 * the critical path of every weather lookup. It doesn't have to be: `statusOf` returns
 * `activeUntil`, the timestamp the answer is guaranteed good until, so an answer can be
 * cached until then. The only things that can invalidate it earlier are onchain events
 * (a cancel, a plan switch, a fresh signup), so we watch those and evict on the spot.
 *
 * Net effect: roughly one RPC call per customer per billing period, plus a log
 * subscription, instead of one per request. If the log stream dies the cache still
 * expires on its own, so the worst case is staleness bounded by `maxTtlMs`, never a
 * permanently wrong answer.
 */
export class SubscriptionGate {
  /**
   * @param {object} opts
   * @param {string} opts.rpcUrl                  JSON-RPC endpoint
   * @param {`0x${string}`} opts.billingAddress   deployed SubscriptionBilling
   * @param {import('viem').Chain} [opts.chain]
   * @param {number} [opts.maxTtlMs]      cap on how long a positive answer is trusted (default 5 min)
   * @param {number} [opts.negativeTtlMs] how long a "not subscribed" answer is cached (default 15 s)
   * @param {boolean} [opts.watch]        subscribe to events for instant invalidation (default true)
   */
  constructor({
    rpcUrl,
    billingAddress,
    chain,
    maxTtlMs = 5 * 60_000,
    negativeTtlMs = 15_000,
    watch = true,
  }) {
    if (!rpcUrl) throw new Error('SubscriptionGate: rpcUrl is required')
    if (!billingAddress) throw new Error('SubscriptionGate: billingAddress is required')

    this.client = createPublicClient({ chain, transport: http(rpcUrl) })
    this.address = getAddress(billingAddress)
    this.maxTtlMs = maxTtlMs
    this.negativeTtlMs = negativeTtlMs

    /** @type {Map<string, {active: boolean, planId: number, activeUntil: number, expiresAt: number}>} */
    this.cache = new Map()
    /** @type {Map<string, Promise<any>>} in-flight lookups, so a burst of requests for a
     *  cold address produces one RPC call rather than one per request. */
    this.inflight = new Map()
    this.stats = { hits: 0, misses: 0, rpcErrors: 0, evictions: 0 }

    this._unwatch = watch ? this._watchEvents() : null
  }

  /**
   * @param {string} address
   * @returns {Promise<{active: boolean, planId: number, plan: string|null, activeUntil: number}>}
   */
  async check(address) {
    const key = getAddress(address)
    const now = Date.now()

    const hit = this.cache.get(key)
    if (hit && hit.expiresAt > now) {
      this.stats.hits++
      return this._shape(hit)
    }

    const pending = this.inflight.get(key)
    if (pending) return pending

    const lookup = this._fetch(key)
      .finally(() => this.inflight.delete(key))
    this.inflight.set(key, lookup)
    return lookup
  }

  /** Warm the cache for a batch of addresses in a single RPC round trip. */
  async warm(addresses) {
    const keys = addresses.map(getAddress)
    const results = await this.client.readContract({
      address: this.address,
      abi: billingAbi,
      functionName: 'areSubscribed',
      args: [keys],
    })
    // areSubscribed omits activeUntil, so warmed entries get the short TTL. They are a
    // latency optimisation, not a source of truth about when the answer expires.
    const expiresAt = Date.now() + this.negativeTtlMs
    keys.forEach((key, i) => {
      const prev = this.cache.get(key)
      if (prev && prev.expiresAt > expiresAt) return
      this.cache.set(key, { active: results[i], planId: 0, activeUntil: 0, expiresAt })
    })
    return results
  }

  /** Drop a cached answer, e.g. after your frontend tells you a customer just subscribed. */
  invalidate(address) {
    this.stats.evictions++
    this.cache.delete(getAddress(address))
  }

  close() {
    if (this._unwatch) this._unwatch()
  }

  async _fetch(key) {
    this.stats.misses++
    let active, planId, activeUntil
    try {
      ;[active, planId, activeUntil] = await this.client.readContract({
        address: this.address,
        abi: billingAbi,
        functionName: 'statusOf',
        args: [key],
      })
    } catch (err) {
      this.stats.rpcErrors++
      const stale = this.cache.get(key)
      // Serving a recently-expired positive answer beats 500ing every customer because
      // the RPC provider is having a bad minute. Bounded by maxTtlMs of extra grace.
      if (stale && stale.active && stale.expiresAt > Date.now() - this.maxTtlMs) {
        return this._shape(stale)
      }
      throw err
    }

    const untilMs = Number(activeUntil) * 1000
    const ttl = active
      ? Math.max(0, Math.min(this.maxTtlMs, untilMs - Date.now()))
      : this.negativeTtlMs

    const entry = {
      active,
      planId: Number(planId),
      activeUntil: Number(activeUntil),
      expiresAt: Date.now() + ttl,
    }
    this.cache.set(key, entry)
    return this._shape(entry)
  }

  _shape(entry) {
    return {
      active: entry.active,
      planId: entry.planId,
      plan: PLANS[entry.planId]?.name ?? null,
      activeUntil: entry.activeUntil,
    }
  }

  _watchEvents() {
    return this.client.watchContractEvent({
      address: this.address,
      abi: billingAbi,
      // Every subscription-changing event carries `account` as its first indexed arg;
      // admin events (price changes, payouts) simply have none and are ignored.
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.args?.account) this.invalidate(log.args.account)
        }
      },
      onError: (err) => {
        // Log and carry on: TTL expiry is the backstop.
        console.error('[gate] event stream error, falling back to TTL expiry:', err.message)
      },
    })
  }
}
