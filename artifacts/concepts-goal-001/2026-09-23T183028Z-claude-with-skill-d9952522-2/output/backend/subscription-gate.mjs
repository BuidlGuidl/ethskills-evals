/**
 * Per-request subscription gate for the weather API.
 *
 * The contract exposes `activeUntil(address)` — the timestamp an account's prepaid
 * balance runs out at. That is what makes this cheap: you do not need an RPC call per
 * API request, you need one RPC call per address per cache window, and the answer
 * carries its own expiry.
 *
 * Two things stop a naive "cache until activeUntil" from being correct:
 *
 *   - activeUntil can move *earlier* — the subscriber withdraws, or switches to a
 *     pricier plan. So a positive cache entry is also capped at MAX_TTL_MS.
 *   - activeUntil can move *later* — the subscriber tops up. So a negative answer is
 *     cached only briefly (NEGATIVE_TTL_MS), or a customer who just paid waits.
 *
 * Usage:
 *   import { createSubscriptionGate } from './subscription-gate.mjs'
 *   const gate = createSubscriptionGate({ rpcUrl, contract })
 *   if (await gate.isSubscribed(addr)) { ...serve... }
 */

import { createPublicClient, http, getAddress } from 'viem'
import { base } from 'viem/chains'

export const SUBSCRIPTION_ABI = [
  {
    type: 'function',
    name: 'activeUntil',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'accountOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'planId', type: 'uint16' },
      { name: 'remaining', type: 'uint256' },
      { name: 'accrued', type: 'uint256' },
      { name: 'until', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'ratePerSecond', type: 'uint64' },
    ],
  },
]

const DEFAULTS = {
  // Longest we will trust a positive answer without re-reading. Bounds how long a
  // cancelled-and-drained subscriber can keep getting served. 60s is ~1 RPC read per
  // address per minute; raise it if read volume hurts, it only costs you free requests.
  maxTtlMs: 60_000,
  // How long a "not subscribed" answer sticks. Keep short: this is the delay a paying
  // customer feels between their top-up landing and the API letting them in.
  negativeTtlMs: 10_000,
  // What to do when the RPC is unreachable. 'last-known' keeps serving whoever was
  // already known-good until their cached activeUntil genuinely passes, and denies
  // everyone else. 'closed' denies everyone. 'open' serves everyone — an outage at
  // your RPC provider then becomes free unlimited API access, so it is not the default.
  onRpcError: 'last-known',
  maxCacheEntries: 50_000,
}

export function createSubscriptionGate({ rpcUrl, contract, chain = base, ...opts } = {}) {
  if (!rpcUrl) throw new Error('subscription gate: rpcUrl is required')
  if (!contract) throw new Error('subscription gate: contract address is required')

  const cfg = { ...DEFAULTS, ...opts }
  const address = getAddress(contract)
  const client = createPublicClient({ chain, transport: http(rpcUrl) })

  /** @type {Map<string, {until: number, checkedAt: number, trustUntil: number}>} */
  const cache = new Map()
  /** @type {Map<string, Promise<any>>} in-flight reads, so a burst of requests for one
   * address produces one RPC call rather than one per request. */
  const inflight = new Map()

  const stats = { hits: 0, misses: 0, rpcCalls: 0, rpcErrors: 0 }

  async function read(key) {
    const existing = inflight.get(key)
    if (existing) return existing

    const p = (async () => {
      stats.rpcCalls++
      const until = Number(
        await client.readContract({ address, abi: SUBSCRIPTION_ABI, functionName: 'activeUntil', args: [key] }),
      )
      const now = Date.now()
      const active = until * 1000 > now
      const entry = {
        until,
        checkedAt: now,
        trustUntil: active
          ? Math.min(until * 1000, now + cfg.maxTtlMs)
          : now + cfg.negativeTtlMs,
      }
      if (cache.size >= cfg.maxCacheEntries) cache.delete(cache.keys().next().value)
      cache.set(key, entry)
      return entry
    })().finally(() => inflight.delete(key))

    inflight.set(key, p)
    return p
  }

  async function isSubscribed(rawAddress) {
    let key
    try {
      key = getAddress(rawAddress)
    } catch {
      return false // not an address at all
    }

    const cached = cache.get(key)
    if (cached && Date.now() < cached.trustUntil) {
      stats.hits++
      return cached.until * 1000 > Date.now()
    }
    stats.misses++

    try {
      const entry = await read(key)
      return entry.until * 1000 > Date.now()
    } catch (err) {
      stats.rpcErrors++
      if (cfg.onRpcError === 'open') return true
      if (cfg.onRpcError === 'closed') return false
      // 'last-known': honour a stale entry only while its real onchain expiry holds.
      return Boolean(cached && cached.until * 1000 > Date.now())
    }
  }

  /** Full account detail, for a "your subscription" dashboard endpoint. Not cached. */
  async function accountOf(rawAddress) {
    const [planId, remaining, accrued, until, active, ratePerSecond] = await client.readContract({
      address,
      abi: SUBSCRIPTION_ABI,
      functionName: 'accountOf',
      args: [getAddress(rawAddress)],
    })
    return {
      planId,
      remainingUsdc: Number(remaining) / 1e6,
      accruedUsdc: Number(accrued) / 1e6,
      activeUntil: until === 0n ? null : new Date(Number(until) * 1000),
      active,
      // rate is a truncated per-second value; round back to the cent it came from
      monthlyUsdc: Math.round((Number(ratePerSecond) * 2_592_000) / 1e12 / 1e4) / 100,
    }
  }

  return {
    isSubscribed,
    accountOf,
    stats: () => ({ ...stats, cached: cache.size }),
    invalidate: (a) => cache.delete(getAddress(a)),
    clear: () => cache.clear(),
  }
}

/**
 * Express/Connect middleware. Expects the caller's address on the request — swap
 * `addressFrom` for however you authenticate (a signed SIWE session is the honest
 * option; a bare header is trivially spoofed and lets anyone borrow a subscription).
 */
export function subscriptionMiddleware(gate, { addressFrom = (req) => req.session?.address } = {}) {
  return async (req, res, next) => {
    const addr = addressFrom(req)
    if (!addr) return res.status(401).json({ error: 'no authenticated address' })
    if (!(await gate.isSubscribed(addr))) {
      return res.status(402).json({
        error: 'no active subscription',
        hint: 'top up USDC and call subscribe(planId) on the billing contract',
      })
    }
    req.subscriber = addr
    next()
  }
}
