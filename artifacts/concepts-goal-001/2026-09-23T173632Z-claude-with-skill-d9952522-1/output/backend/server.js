import { createServer } from "node:http";
import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { verifyMessage, getAddress } from "viem";
import { baseSepolia, base } from "viem/chains";
import { createSubscriptionGate } from "./subscriptionGate.js";

/**
 * Example weather API with onchain billing.
 *
 * Two separate questions, deliberately kept apart:
 *   1. Which address is this request from?  -> a signature, exchanged once for
 *      an API key. The chain cannot tell you this; anyone can name any address.
 *   2. Is that address paid up?             -> a view call, cached.
 *
 * The API key store here is an in-memory Map so the file runs standalone.
 * Swap it for your real database before this sees traffic.
 */

const PORT = Number(process.env.PORT ?? 8787);
const CHAIN = process.env.CHAIN === "base" ? base : baseSepolia;

const gate = createSubscriptionGate({
  rpcUrl: process.env.RPC_URL,
  contractAddress: process.env.BILLING_ADDRESS,
  chain: CHAIN,
});

/** apiKeyHash -> { address, createdAt } */
const apiKeys = new Map();
/** address -> { nonce, issuedAt } */
const nonces = new Map();

const NONCE_TTL_MS = 5 * 60_000;
const hashKey = (k) => createHash("sha256").update(k).digest("hex");

function json(res, status, body) {
  const payload = JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

function loginMessage(address, nonce) {
  return [
    `${CHAIN.name} weather API`,
    "",
    "Sign in to issue an API key for this address.",
    "This signature costs nothing and sends no transaction.",
    "",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}

function apiKeyFrom(req) {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

/** Look up the address behind an API key, in constant time w.r.t. the key. */
function addressForKey(key) {
  if (!key) return null;
  const digest = hashKey(key);
  for (const [storedHash, record] of apiKeys) {
    const a = Buffer.from(storedHash, "hex");
    const b = Buffer.from(digest, "hex");
    if (a.length === b.length && timingSafeEqual(a, b)) return record.address;
  }
  return null;
}

const routes = {
  // 1. Prove control of an address.
  "POST /auth/nonce": async (req, res) => {
    const { address } = await readJson(req);
    const account = getAddress(address);
    const nonce = randomBytes(16).toString("hex");
    nonces.set(account, { nonce, issuedAt: Date.now() });
    json(res, 200, { message: loginMessage(account, nonce) });
  },

  "POST /auth/verify": async (req, res) => {
    const { address, signature } = await readJson(req);
    const account = getAddress(address);
    const entry = nonces.get(account);

    if (!entry || Date.now() - entry.issuedAt > NONCE_TTL_MS) {
      return json(res, 400, { error: "no valid nonce; request one first" });
    }
    const valid = await verifyMessage({
      address: account,
      message: loginMessage(account, entry.nonce),
      signature,
    });
    if (!valid) return json(res, 401, { error: "bad signature" });

    nonces.delete(account); // single use
    const apiKey = `wk_${randomBytes(24).toString("hex")}`;
    apiKeys.set(hashKey(apiKey), { address: account, createdAt: Date.now() });

    json(res, 200, { apiKey, address: account });
  },

  // 2. The billing check, on every request.
  "GET /v1/weather": async (req, res) => {
    const address = addressForKey(apiKeyFrom(req));
    if (!address) return json(res, 401, { error: "unknown API key" });

    let status;
    try {
      status = await gate.check(address);
    } catch {
      // Cannot reach the chain and no usable cached answer. This is our outage,
      // not the customer's — fail loudly rather than silently billing or barring.
      return json(res, 503, { error: "billing check unavailable, try again shortly" });
    }

    if (!status.active) {
      return json(res, 402, {
        error: "no active subscription",
        address,
        topUpAt: gate.address,
        hint: "deposit USDC and call subscribe(planId) on the billing contract",
      });
    }

    json(res, 200, {
      address,
      plan: status.planId,
      // Surfacing the deadline lets customers automate their own top-ups.
      subscriptionExpiresAt: new Date(status.expiry * 1000).toISOString(),
      billingCheckStale: status.stale === true,
      data: { location: "Berlin", tempC: 14, conditions: "overcast" },
    });
  },

  // Handy for a customer dashboard, and for your own support requests.
  "GET /v1/account": async (req, res) => {
    const address = addressForKey(apiKeyFrom(req));
    if (!address) return json(res, 401, { error: "unknown API key" });
    const status = await gate.check(address);
    json(res, 200, {
      address,
      active: status.active,
      planId: status.planId,
      balanceUsdc: Number(status.balance ?? 0n) / 1e6,
      expiresAt: status.expiry ? new Date(status.expiry * 1000).toISOString() : null,
    });
  },

  "GET /health": async (_req, res) => {
    try {
      const block = await gate.client.getBlockNumber();
      json(res, 200, { ok: true, chain: CHAIN.name, block: Number(block) });
    } catch (err) {
      // RPC reachability is a first-class health signal here: it is the
      // dependency that decides whether anyone can be billed.
      json(res, 503, { ok: false, error: err.message });
    }
  },
};

const server = createServer(async (req, res) => {
  const route = routes[`${req.method} ${req.url.split("?")[0]}`];
  if (!route) return json(res, 404, { error: "not found" });
  try {
    await route(req, res);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

if (process.env.BILLING_ADDRESS && process.env.RPC_URL) {
  gate.watchDowngrades();
  server.listen(PORT, () => {
    console.log(`weather API on :${PORT}`);
    console.log(`billing contract ${gate.address} on ${CHAIN.name}`);
  });
} else {
  console.error("set RPC_URL and BILLING_ADDRESS to start the server");
  process.exit(1);
}
