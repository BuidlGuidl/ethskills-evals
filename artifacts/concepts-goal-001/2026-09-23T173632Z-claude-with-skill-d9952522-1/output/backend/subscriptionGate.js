import { createPublicClient, http, getAddress } from "viem";
import { base } from "viem/chains";
import { subscriptionBillingAbi } from "./abi.js";

/**
 * Per-request subscription checks for the weather API.
 *
 * The contract answers "is this address paid up?" as a plain view call, so there
 * is no indexer and no webhook in the path. The only thing this wrapper adds is
 * a cache, because hitting an RPC on every API request is both slow and the
 * single thing most likely to take the API down.
 *
 * The cache is safe to hold because `expiresAt` is a hard deadline that the
 * contract itself will not move later — only a withdrawal or a plan switch can
 * move it *earlier*, and both emit events (see `watchDowngrades`).
 */
export function createSubscriptionGate({
  rpcUrl,
  contractAddress,
  chain = base,
  // How long a positive answer may be trusted before re-reading the chain.
  // Cap it well under a billing period; 60s is a reasonable default.
  cacheTtlMs = 60_000,
  // How long a negative answer is cached. Short, so a customer who just topped
  // up is not locked out for a minute.
  negativeCacheTtlMs = 5_000,
  // If the RPC is unreachable, keep honouring a cached "yes" for this long
  // rather than 402-ing paying customers because of an infrastructure problem.
  staleWhileErrorMs = 10 * 60_000,
} = {}) {
  if (!rpcUrl) throw new Error("rpcUrl is required");
  if (!contractAddress) throw new Error("contractAddress is required");

  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  const address = getAddress(contractAddress);
  const cache = new Map(); // account -> { active, expiry, checkedAt }

  async function read(account) {
    const [active, planId, pricePerMonth, balance, expiry] = await client.readContract({
      address,
      abi: subscriptionBillingAbi,
      functionName: "subscriptionOf",
      args: [account],
    });
    return {
      active,
      planId: Number(planId),
      pricePerMonth,
      balance,
      expiry: Number(expiry),
      checkedAt: Date.now(),
    };
  }

  /** @returns {Promise<{active: boolean, planId: number, expiry: number, stale: boolean}>} */
  async function check(rawAccount) {
    let account;
    try {
      account = getAddress(rawAccount);
    } catch {
      return { active: false, planId: 0, expiry: 0, stale: false, reason: "bad-address" };
    }

    const now = Date.now();
    const hit = cache.get(account);

    if (hit) {
      const ttl = hit.active ? cacheTtlMs : negativeCacheTtlMs;
      const expiredOnChain = hit.expiry * 1000 <= now;
      if (now - hit.checkedAt < ttl && !expiredOnChain) {
        return { ...hit, stale: false };
      }
    }

    try {
      const fresh = await read(account);
      cache.set(account, fresh);
      return { ...fresh, stale: false };
    } catch (err) {
      // RPC is down. A cached "yes" whose onchain expiry has not yet passed is
      // still almost certainly true — serve it rather than punishing customers.
      if (hit && hit.active && hit.expiry * 1000 > now && now - hit.checkedAt < staleWhileErrorMs) {
        return { ...hit, stale: true };
      }
      throw err;
    }
  }

  /** Drop a cached answer, e.g. right after seeing the customer's deposit tx. */
  function invalidate(account) {
    cache.delete(getAddress(account));
  }

  /**
   * Optional: watch for the events that can shorten someone's runway, and drop
   * their cache entry immediately. Without this the cache TTL bounds the lag.
   */
  function watchDowngrades() {
    return client.watchContractEvent({
      address,
      abi: [
        {
          type: "event",
          name: "Withdrawn",
          inputs: [
            { name: "account", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "amount", type: "uint256" },
            { name: "newBalance", type: "uint256" },
          ],
        },
        {
          type: "event",
          name: "Cancelled",
          inputs: [
            { name: "account", type: "address", indexed: true },
            { name: "planId", type: "uint32", indexed: true },
            { name: "refundableBalance", type: "uint256" },
          ],
        },
        {
          type: "event",
          name: "Subscribed",
          inputs: [
            { name: "account", type: "address", indexed: true },
            { name: "planId", type: "uint32", indexed: true },
            { name: "expiresAt", type: "uint256" },
          ],
        },
      ],
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.args?.account) cache.delete(log.args.account);
        }
      },
      // Event watching is a nice-to-have; never let it crash the API process.
      onError: (err) => console.warn("[subscription-gate] event watch error:", err.message),
    });
  }

  return { check, invalidate, watchDowngrades, client, address };
}
