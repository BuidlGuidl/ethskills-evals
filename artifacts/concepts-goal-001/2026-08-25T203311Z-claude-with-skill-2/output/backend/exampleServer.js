import {createServer} from "node:http";
import {randomBytes, createHmac, timingSafeEqual} from "node:crypto";
import {base} from "viem/chains";
import {SubscriptionGate} from "./subscriptionGate.js";

/**
 * A minimal weather API that gates on the onchain subscription.
 *
 * Two separate questions, and conflating them is the classic way to get robbed:
 *
 *   1. WHICH address is this request from?   <- signature auth, below. Not onchain.
 *   2. Is THAT address subscribed?           <- SubscriptionGate, onchain.
 *
 * The contract answers (2) for anybody who asks. It says nothing about (1). If you let a caller
 * simply *name* an address in a header, anyone can name your biggest customer's address and read
 * your API for free. So: the customer signs a one-time challenge, we verify it, and we hand back
 * a short-lived bearer token bound to the address they proved.
 *
 * `verifyMessage` on a public client also validates ERC-1271 signatures, so Safes and other smart
 * accounts work without a special case — worth keeping, since a business paying you in USDC is
 * quite likely to be doing it from a multisig.
 */

const PORT = Number(process.env.PORT ?? 8787);
const SESSION_SECRET = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex");
const SESSION_TTL_SEC = 15 * 60;

const gate = new SubscriptionGate({
  address: process.env.BILLING_ADDRESS,
  chain: base,
  rpcUrl: process.env.BASE_RPC_URL,
  wsRpcUrl: process.env.BASE_WS_RPC_URL,
});
gate.watch();

const challenges = new Map(); // nonce -> expiry. Use Redis if you run more than one process.

function issueChallenge() {
  const nonce = randomBytes(16).toString("hex");
  challenges.set(nonce, Date.now() + 5 * 60_000);
  return {
    nonce,
    message: `weatherapi.example wants you to sign in.\n\nAddress proof for API access.\nNonce: ${nonce}`,
  };
}

function mintSession(address) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const payload = `${address.toLowerCase()}.${expires}`;
  const mac = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

function readSession(token) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;
  const [address, expires, mac] = parts;
  const expected = createHmac("sha256", SESSION_SECRET).update(`${address}.${expires}`).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return null;
  return address;
}

async function handle(req, res, url) {
  if (url.pathname === "/auth/challenge") {
    return json(res, 200, issueChallenge());
  }

  if (url.pathname === "/auth/verify" && req.method === "POST") {
    const {address, signature, nonce} = await readJson(req);
    const expiry = challenges.get(nonce);
    if (!expiry || expiry < Date.now()) return json(res, 400, {error: "unknown or expired nonce"});
    challenges.delete(nonce); // single use

    const message = `weatherapi.example wants you to sign in.\n\nAddress proof for API access.\nNonce: ${nonce}`;
    const valid = await gate.client.verifyMessage({address, message, signature});
    if (!valid) return json(res, 401, {error: "bad signature"});

    return json(res, 200, {token: mintSession(address), expiresIn: SESSION_TTL_SEC});
  }

  if (url.pathname === "/v1/forecast") {
    const address = readSession(req.headers.authorization?.replace(/^Bearer /, ""));
    if (!address) return json(res, 401, {error: "sign in at /auth/challenge"});

    let subscribed;
    try {
      subscribed = await gate.isSubscribed(address);
    } catch {
      // Can't reach the chain and no usable cached answer. Do not guess.
      return json(res, 503, {error: "billing check unavailable, retry shortly"});
    }
    if (!subscribed) {
      return json(res, 402, {
        error: "no active subscription",
        // 402 Payment Required is the honest status code, and here it can actually be acted on.
        topUp: `https://basescan.org/address/${gate.address}#writeContract`,
      });
    }

    return json(res, 200, {location: "Berlin", tempC: 17, conditions: "overcast"});
  }

  if (url.pathname === "/healthz") return json(res, 200, {ok: true, gate: gate.stats});

  return json(res, 404, {error: "not found"});
}

function json(res, status, body) {
  const payload = JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  res.writeHead(status, {"content-type": "application/json"});
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  handle(req, res, url).catch(() => json(res, 500, {error: "internal"}));
}).listen(PORT, () => console.log(`weather api on :${PORT}, billing at ${gate.address}`));
