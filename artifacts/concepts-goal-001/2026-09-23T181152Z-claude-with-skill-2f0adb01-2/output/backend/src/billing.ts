import { createPublicClient, http, type Address, type PublicClient } from "viem";
import { billingAbi } from "./abi.js";
import { config } from "./config.js";

export const publicClient: PublicClient = createPublicClient({
  chain: config.chain,
  transport: http(config.rpcUrl),
}) as PublicClient;

type CacheEntry = { planId: number; expiresAtMs: number };

/**
 * Per-request subscription checks against a node would be slow and expensive, so
 * we cache. The contract hands us a hard expiry (`entitledUntil`) which is exact
 * for the "runs out of money" case; we clamp it with a short TTL to bound how
 * long a *cancellation* can go unnoticed.
 *
 * A cached entry is only ever a positive. Negatives are not cached, so a customer
 * who just topped up gets in on their very next request.
 */
const cache = new Map<Address, CacheEntry>();

export type Entitlement = { subscribed: boolean; planId: number };

export async function checkSubscription(account: Address): Promise<Entitlement> {
  const key = account.toLowerCase() as Address;
  const now = Date.now();

  const hit = cache.get(key);
  if (hit && hit.expiresAtMs > now) {
    return { subscribed: true, planId: hit.planId };
  }

  // One multicall round trip rather than two RPC calls.
  const [planId, until] = await publicClient.multicall({
    contracts: [
      { address: config.billingAddress, abi: billingAbi, functionName: "planOf", args: [account] },
      {
        address: config.billingAddress,
        abi: billingAbi,
        functionName: "entitledUntil",
        args: [account],
      },
    ],
    allowFailure: false,
  });

  if (planId === 0) {
    cache.delete(key);
    return { subscribed: false, planId: 0 };
  }

  const onchainExpiryMs = Number(until) * 1000;
  const cappedMs = now + config.maxCacheSeconds * 1000;
  cache.set(key, { planId, expiresAtMs: Math.min(onchainExpiryMs, cappedMs) });

  return { subscribed: true, planId };
}

/** Drop a cached decision immediately -- call this from the event watcher. */
export function invalidate(account: Address): void {
  cache.delete(account.toLowerCase() as Address);
}

/**
 * Cancellations and withdrawals are the only things that can revoke access sooner
 * than `entitledUntil` predicted, and both emit an event. Watching them turns the
 * cache staleness window from `maxCacheSeconds` into roughly one block.
 *
 * This is an optimisation, not a correctness requirement: if the watcher dies, the
 * TTL still bounds staleness. Never let auth depend on a subscription being live.
 */
export function watchRevocations(): () => void {
  return publicClient.watchContractEvent({
    address: config.billingAddress,
    abi: billingAbi,
    eventName: "Cancelled",
    onLogs: (logs) => {
      for (const log of logs) if (log.args.account) invalidate(log.args.account);
    },
    onError: (err) => console.error("[billing] revocation watcher error", err),
  });
}
