// Per-request subscription check for the weather API.
//
// Two separate questions, and it is worth keeping them separate in your head:
//
//   1. Is this HTTP request really from address X?   <- signature, below. Not onchain.
//   2. Is address X subscribed right now?            <- the contract. This file.
//
// Getting (1) wrong is the classic way to give the whole API away: an `X-Address`
// header is a claim, not a proof, and anyone can copy a paying customer's address off
// the block explorer. So the client signs once, gets a bearer token bound to their
// address, and the gate checks (2) on every request using that bound address.

import { createPublicClient, http, verifyMessage, isAddress, getAddress } from "viem";
import { base } from "viem/chains";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { subscriptionsAbi } from "./abi.mjs";

const CONTRACT = getAddress(process.env.SUBSCRIPTIONS_ADDRESS);
const TOKEN_SECRET = process.env.TOKEN_SECRET; // 32+ random bytes, not in git
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Two RPC endpoints: a paid primary and a fallback. If your only provider is down and
// you fail closed, every paying customer is locked out; if you fail open, the API is
// free. Neither is a good look, so make the read unlikely to fail in the first place.
const client = createPublicClient({
  chain: base,
  transport: http(process.env.RPC_URL, {
    retryCount: 2,
    timeout: 3_000,
    onFetchError: () => {},
  }),
});
const fallbackClient = process.env.RPC_URL_FALLBACK
  ? createPublicClient({ chain: base, transport: http(process.env.RPC_URL_FALLBACK, { timeout: 3_000 }) })
  : null;

// ---------------------------------------------------------------------------
// 1. Binding an HTTP caller to an address
// ---------------------------------------------------------------------------

const nonces = new Map(); // nonce -> expiry. Swap for Redis if you run more than one box.

export function issueNonce() {
  const nonce = randomBytes(16).toString("hex");
  nonces.set(nonce, Date.now() + 5 * 60 * 1000);
  return nonce;
}

export function loginMessage(address, nonce) {
  return `weatherapi.example wants you to sign in.\n\nAddress: ${address}\nNonce: ${nonce}\n\nSigning proves you control this address. It does not move any funds.`;
}

/// Verify a signature over the nonce and hand back a bearer token bound to the address.
export async function login({ address, nonce, signature }) {
  if (!isAddress(address)) throw new Error("bad address");
  const expiry = nonces.get(nonce);
  if (!expiry || expiry < Date.now()) throw new Error("unknown or expired nonce");
  nonces.delete(nonce); // single use

  const ok = await verifyMessage({ address, message: loginMessage(address, nonce), signature });
  if (!ok) throw new Error("bad signature");

  return mintToken(getAddress(address));
}

function mintToken(address) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const body = `${address}.${expiresAt}`;
  const mac = createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  return `${Buffer.from(body).toString("base64url")}.${mac}`;
}

function readToken(token) {
  const [encoded, mac] = String(token).split(".");
  if (!encoded || !mac) return null;
  const body = Buffer.from(encoded, "base64url").toString();
  const expected = createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [address, expiresAt] = body.split(".");
  if (Number(expiresAt) < Date.now()) return null;
  return getAddress(address);
}

// ---------------------------------------------------------------------------
// 2. Is that address subscribed?
// ---------------------------------------------------------------------------

// A positive answer is safe to cache until the account's expiry, because the only
// things that can end a subscription sooner are the customer's own cancel or withdraw
// — so the cache is capped, and those two are also picked up by the event watcher below.
const CACHE_CAP_MS = 60_000;
const NEGATIVE_CACHE_MS = 5_000;
const cache = new Map(); // address -> { active, planId, expiry, until }

export function invalidate(address) {
  cache.delete(getAddress(address));
}

async function readStatus(address) {
  const args = { address: CONTRACT, abi: subscriptionsAbi, functionName: "statusOf", args: [address] };
  try {
    return await client.readContract(args);
  } catch (err) {
    if (!fallbackClient) throw err;
    return await fallbackClient.readContract(args);
  }
}

export async function subscriptionStatus(address) {
  address = getAddress(address);
  const hit = cache.get(address);
  if (hit && hit.until > Date.now()) return hit;

  const [active, planId, expiry] = await readStatus(address);
  const expiryMs = Number(expiry) * 1000;
  const until = active
    ? Date.now() + Math.min(CACHE_CAP_MS, Math.max(0, expiryMs - Date.now()))
    : Date.now() + NEGATIVE_CACHE_MS;

  const status = { active, planId: Number(planId), expiry: Number(expiry), until };
  cache.set(address, status);
  return status;
}

// Cancels and withdrawals shorten expiry, so drop the cached row when one lands.
// This is a latency optimisation, not a correctness requirement: the cache cap above
// already bounds how long a stale "active" can survive without it.
export function watchForChanges() {
  return client.watchContractEvent({
    address: CONTRACT,
    abi: subscriptionsAbi,
    onLogs: (logs) => logs.forEach((log) => log.args?.account && invalidate(log.args.account)),
    onError: (err) => console.warn("[gate] event stream dropped, cache cap still applies:", err.message),
  });
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

/// Rate limits per plan. The contract knows the tier; your API decides what a tier buys.
export const PLAN_LIMITS = {
  1: { name: "hobby", requestsPerDay: 10_000 },
  2: { name: "pro", requestsPerDay: 100_000 },
};

export function requireSubscription() {
  return async (req, res, next) => {
    const header = req.get("authorization") || "";
    const address = readToken(header.replace(/^Bearer /i, ""));
    if (!address) return res.status(401).json({ error: "sign in at POST /auth/login to get a token" });

    let status;
    try {
      status = await subscriptionStatus(address);
    } catch (err) {
      // Chain unreachable and nothing cached. Failing closed locks out paying
      // customers for a problem that is yours, so this is the one place worth an alert.
      console.error("[gate] chain read failed:", err.message);
      return res.status(503).json({ error: "billing check unavailable, try again shortly" });
    }

    if (!status.active) {
      return res.status(402).json({
        error: "no active subscription",
        address,
        // Expiry in the past tells them they ran out rather than never subscribed.
        expiredAt: status.expiry || null,
        topUpAt: `https://basescan.org/address/${CONTRACT}#writeContract`,
      });
    }

    req.subscriber = { address, ...PLAN_LIMITS[status.planId], planId: status.planId, expiry: status.expiry };

    // Let customers see the cliff coming. Nothing renews itself: if they do not top up,
    // they lapse at `expiry`, and a header is the cheapest way to tell them.
    res.set("X-Subscription-Expires", String(status.expiry));
    const daysLeft = (status.expiry * 1000 - Date.now()) / 86_400_000;
    if (daysLeft < 7) res.set("X-Subscription-Warning", `balance runs out in ${daysLeft.toFixed(1)} days`);

    next();
  };
}
