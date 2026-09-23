/**
 * Per-request subscription check for the API backend.
 *
 * The whole integration is one view call: `isActive(address)`.
 * It is safe to hit this on every request; add a short cache (shown below)
 * if request volume makes that worthwhile. State relevant to one request can
 * only change when a transaction lands, so a few seconds of staleness is fine
 * in practice — pick a TTL you are comfortable with.
 *
 *   npm install viem
 *   BILLING_ADDRESS=0x... RPC_URL=https://mainnet.base.org node checkSubscription.js
 */
import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";

const BILLING_ADDRESS = process.env.BILLING_ADDRESS; // deployed contract
const client = createPublicClient({
  chain: base,
  transport: http(process.env.RPC_URL),
});

const abi = parseAbi([
  "function isActive(address user) view returns (bool)",
  "function effectivePaidThrough(address user) view returns (uint256)",
  "function getAccount(address user) view returns (uint256 balance, uint256 planId, uint256 paidThrough, bool subscribed)",
]);

// --- tiny TTL cache: 10s, plenty for billing state ------------------------
const cache = new Map(); // address (lowercased) -> { active, expires }
const TTL_MS = 10_000;

/** The only function your request handler needs. */
export async function isSubscribed(address) {
  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.active;

  const active = await client.readContract({
    address: BILLING_ADDRESS,
    abi,
    functionName: "isActive",
    args: [address],
  });
  cache.set(key, { active, expires: Date.now() + TTL_MS });
  return active;
}

// --- example middleware ----------------------------------------------------
export function requireSubscription() {
  return async (req, res, next) => {
    const address = req.headers["x-wallet-address"]; // however you auth users
    if (!address || !(await isSubscribed(address))) {
      return res.status(402).json({ error: "active subscription required" });
    }
    next();
  };
}
