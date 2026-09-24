import {createPublicClient, http, type Address, type PublicClient} from 'viem'
import {billingAbi} from './abi.ts'

export type Status = {
  subscribed: boolean
  planId: number
  expiresAt: number // unix seconds
  balance: bigint // USDC base units, 6dp
  accrued: bigint
}

export type GateConfig = {
  rpcUrl: string
  contract: Address
  /** How long a cached answer may be trusted. Bounds how stale a cancellation can be. */
  cacheTtlMs?: number
  /** Fail open if the RPC is down, rather than 503-ing every customer. See NOTES.md. */
  failOpen?: boolean
}

type Entry = {status: Status; goodUntil: number}

/**
 * Wraps the contract's read surface in the cache you need to put an RPC call on a hot request path.
 *
 * Two things make caching safe here. A subscription can only be *ended* early by the customer
 * themselves (cancel or withdraw), so a stale positive costs at most `cacheTtlMs` of free service.
 * And `expiresAt` is a hard bound the chain has already committed to, so an entry is never trusted
 * past it — a lapse from running out of money is always caught on time.
 */
export class SubscriptionGate {
  private readonly client: PublicClient
  private readonly contract: Address
  private readonly ttl: number
  private readonly failOpen: boolean
  private readonly cache = new Map<Address, Entry>()
  private readonly inflight = new Map<Address, Promise<Status>>()

  /** Counters worth scraping into whatever you use for metrics. */
  readonly stats = {hits: 0, misses: 0, rpcErrors: 0, failedOpen: 0}

  constructor(cfg: GateConfig) {
    this.client = createPublicClient({transport: http(cfg.rpcUrl)}) as PublicClient
    this.contract = cfg.contract
    this.ttl = cfg.cacheTtlMs ?? 15_000
    this.failOpen = cfg.failOpen ?? false
  }

  /** The per-request question: may this address use the API right now? */
  async isSubscribed(user: Address): Promise<boolean> {
    return (await this.statusOf(user)).subscribed
  }

  /** Tier-aware variant, for pro-only endpoints or per-plan rate limits. */
  async isOnPlan(user: Address, planId: number): Promise<boolean> {
    const s = await this.statusOf(user)
    return s.subscribed && s.planId === planId
  }

  async statusOf(user: Address): Promise<Status> {
    const key = user.toLowerCase() as Address
    const now = Date.now()

    const hit = this.cache.get(key)
    if (hit && now < hit.goodUntil) {
      this.stats.hits++
      return hit.status
    }
    this.stats.misses++

    // Collapse a thundering herd on the same address into one RPC call.
    const pending = this.inflight.get(key)
    if (pending) return pending

    const p = this.fetch(user, key, hit)
      .finally(() => this.inflight.delete(key))
    this.inflight.set(key, p)
    return p
  }

  private async fetch(user: Address, key: Address, stale: Entry | undefined): Promise<Status> {
    try {
      const raw = await this.client.readContract({
        address: this.contract,
        abi: billingAbi,
        functionName: 'statusOf',
        args: [user],
      })
      const status: Status = {
        subscribed: raw.subscribed,
        planId: Number(raw.planId),
        expiresAt: Number(raw.expiresAt),
        balance: raw.balance,
        accrued: raw.accrued,
      }

      // Never cache past the on-chain expiry: that is the one transition the chain makes on its
      // own, with no transaction to observe.
      const expiryMs = status.expiresAt * 1000
      const goodUntil = status.subscribed
        ? Math.min(Date.now() + this.ttl, expiryMs)
        : Date.now() + this.ttl
      this.cache.set(key, {status, goodUntil})
      return status
    } catch (err) {
      this.stats.rpcErrors++
      // A stale-but-recent entry beats guessing. Only past that do we apply the fail policy.
      if (stale && Date.now() < stale.goodUntil + 60_000) return stale.status
      if (this.failOpen) {
        this.stats.failedOpen++
        return {subscribed: true, planId: -1, expiresAt: 0, balance: 0n, accrued: 0n}
      }
      throw err
    }
  }

  /** Batch check — one RPC round trip for many addresses. Useful for dashboards and the monitor. */
  async areSubscribed(users: Address[]): Promise<boolean[]> {
    if (users.length === 0) return []
    const out = await this.client.readContract({
      address: this.contract,
      abi: billingAbi,
      functionName: 'areSubscribed',
      args: [users],
    })
    return [...out]
  }

  /**
   * Drop a cached entry. Call this from a webhook or an event listener when you see a Cancelled /
   * Withdrawn / Deposited event, so the gate reacts immediately instead of waiting out the TTL.
   */
  invalidate(user: Address): void {
    this.cache.delete(user.toLowerCase() as Address)
  }

  /**
   * Watch the events that change entitlement and invalidate on the spot. Optional — the TTL alone
   * is correct, this just tightens the window. Returns an unwatch function.
   */
  watch(): () => void {
    return this.client.watchContractEvent({
      address: this.contract,
      abi: billingAbi,
      eventName: 'Cancelled',
      onLogs: (logs) => {
        for (const log of logs) if (log.args.user) this.invalidate(log.args.user)
      },
      onError: () => this.stats.rpcErrors++,
    })
  }
}
