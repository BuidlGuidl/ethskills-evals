import http from "node:http";
import {createPublicClient, http as httpTransport} from "viem";
import {config} from "./config.js";
import {SubscriptionGate} from "./gate.js";
import {QuotaMeter} from "./quota.js";
import {issueNonce, redeemNonce, verifyToken, pruneNonces, AuthError} from "./auth.js";
import {getForecast} from "./weather.js";

const log = (event) => console.log(JSON.stringify({t: new Date().toISOString(), ...event}));

const gate = new SubscriptionGate({onLog: log});
const quota = new QuotaMeter(config.quotaPerMinute);
const verifyClient = createPublicClient({chain: config.chain, transport: httpTransport(config.rpcUrl)});

const routes = [
  ["GET", "/health", handleHealth],
  ["GET", "/v1/auth/nonce", handleNonce],
  ["POST", "/v1/auth/token", handleToken],
  ["GET", "/v1/subscription", handleSubscription],
  ["GET", "/v1/forecast", handleForecast],
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const route = routes.find(([method, path]) => method === req.method && path === url.pathname);
  if (!route) return send(res, 404, {error: "not found"});

  try {
    await route[2](req, res, url);
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) log({type: "unhandled", path: url.pathname, error: err.stack});
    send(res, status, {error: status >= 500 ? "internal error" : err.message});
  }
});

// ---------------------------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------------------------

function handleHealth(req, res) {
  send(res, 200, {ok: true, gate: gate.health()});
}

function handleNonce(req, res, url) {
  const address = url.searchParams.get("address");
  if (!address) throw badRequest("address query parameter required");
  send(res, 200, issueNonce(address));
}

async function handleToken(req, res) {
  const {address, signature} = await readJson(req);
  if (!address || !signature) throw badRequest("address and signature required");
  const {token, expiresAt} = await redeemNonce(verifyClient, address, signature);

  // Tell them where they stand, so a client can react to "you are not subscribed" at login
  // rather than on the first data request.
  const status = await gate.status(address);
  send(res, 200, {token, expiresAt, subscription: publicStatus(status)});
}

/** Lets a customer see exactly what the gate sees. No surprises about why they were cut off. */
async function handleSubscription(req, res) {
  const address = requireAuth(req);
  send(res, 200, publicStatus(await gate.status(address)));
}

async function handleForecast(req, res, url) {
  const address = requireAuth(req);

  const status = await gate.status(address);
  if (!status.subscribed) {
    return send(res, 402, {
      error: "no active subscription",
      address,
      expiredAt: status.expiry || null,
      // The remedy is a transaction to the contract, not an email to me.
      topUp: {contract: gate.address, chainId: config.chainId, method: "topUp(uint256)"},
    });
  }

  const q = quota.check(address, status.planId);
  if (q.limit !== null) {
    res.setHeader("X-RateLimit-Limit", String(q.limit));
    res.setHeader("X-RateLimit-Remaining", String(q.remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.floor(q.resetsAt / 1000)));
  }
  if (!q.allowed) return send(res, 429, {error: "rate limit exceeded for plan", plan: status.planId});

  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw badRequest("lat and lon required");

  res.setHeader("X-Subscription-Expires", String(status.expiry));
  send(res, 200, await getForecast(lat, lon));
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function requireAuth(req) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) throw new AuthError("Authorization: Bearer <token> required");
  return verifyToken(header.slice(7));
}

function publicStatus(status) {
  return {
    address: status.address,
    subscribed: status.subscribed,
    planId: status.planId,
    expiresAt: status.expiry,
    secondsRemaining: Math.max(0, status.expiry - Math.floor(Date.now() / 1000)),
    source: status.source,
  };
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {"content-type": "application/json", "content-length": Buffer.byteLength(payload)});
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16_384) throw badRequest("body too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw badRequest("invalid JSON body");
  }
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// ---------------------------------------------------------------------------------------------

const housekeeping = setInterval(() => {
  pruneNonces();
  quota.prune();
}, 60_000);
housekeeping.unref();

await gate.start();
server.listen(config.port, () => {
  log({type: "listening", port: config.port, contract: gate.address, chainId: config.chainId});
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await gate.stop();
    server.close(() => process.exit(0));
  });
}
