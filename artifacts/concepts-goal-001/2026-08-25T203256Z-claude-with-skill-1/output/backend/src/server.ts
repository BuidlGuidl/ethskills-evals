import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { base, baseSepolia } from "viem/chains";
import type { Address, Chain, Hex } from "viem";
import { SubscriptionGate } from "./gate.js";
import { Authenticator, AuthError, type Challenge } from "./auth.js";

/**
 * A runnable sketch of the weather API with onchain billing wired in.
 *
 * The only thing that matters here is `requireSubscription`: one await, cached, on the hot path.
 * Everything else is the plumbing that gets an address out of the request.
 *
 *   POST /auth/challenge  {address}                      -> a message to sign
 *   POST /auth/verify     {challenge, signature}          -> a bearer token
 *   GET  /v1/account      Authorization: Bearer <token>   -> your subscription status
 *   GET  /v1/weather?q=   Authorization: Bearer <token>   -> the actual product (gated)
 *   GET  /healthz                                         -> gate stats, for monitoring
 */

const chains: Record<string, Chain> = { base, baseSepolia };
const chain = chains[process.env.CHAIN ?? "base"] ?? base;

const gate = new SubscriptionGate({
  contract: requireEnv("BILLING_ADDRESS") as Address,
  chain,
  rpcUrl: requireEnv("RPC_URL"),
  wsRpcUrl: process.env.WS_RPC_URL,
  gracePeriodSeconds: Number(process.env.GRACE_SECONDS ?? 3600),
  onRpcFailure: (process.env.RPC_FAILURE_MODE as "allow" | "deny") ?? "allow",
  onError: (err, ctx) => console.error(`[gate] ${ctx}:`, err),
});

const auth = new Authenticator({
  secret: requireEnv("AUTH_SECRET"),
  chain,
  rpcUrl: requireEnv("RPC_URL"),
});

gate.start();

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (err) {
    if (err instanceof AuthError) return json(res, 401, { error: err.message });
    console.error("[api]", err);
    json(res, 500, { error: "internal error" });
  }
});

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "POST" && url.pathname === "/auth/challenge") {
    const { address } = await body<{ address: Address }>(req);
    return json(res, 200, auth.challenge(address));
  }

  if (req.method === "POST" && url.pathname === "/auth/verify") {
    const { challenge, signature } = await body<{ challenge: Challenge; signature: Hex }>(req);
    return json(res, 200, await auth.verify(challenge, signature));
  }

  if (url.pathname === "/healthz") {
    return json(res, 200, { ok: true, gate: gate.stats });
  }

  if (url.pathname === "/v1/account") {
    const address = auth.addressFromToken(bearer(req));
    return json(res, 200, await gate.statusOf(address));
  }

  if (url.pathname === "/v1/weather") {
    const address = await requireSubscription(req, res);
    if (!address) return; // requireSubscription already answered
    return json(res, 200, {
      query: url.searchParams.get("q") ?? "london",
      tempC: 14,
      servedFor: address,
    });
  }

  json(res, 404, { error: "not found" });
}

/**
 * The gate, on the hot path. Two lookups, both usually in memory:
 * an HMAC check on the token, then the cached `activeUntil` from the contract.
 */
async function requireSubscription(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<Address | null> {
  const address = auth.addressFromToken(bearer(req));

  if (!(await gate.isActive(address))) {
    // 402 Payment Required is the honest status code, and it is finally useful for something.
    const status = await gate.statusOf(address).catch(() => null);
    json(res, 402, {
      error: "no active subscription",
      address,
      activeUntil: status?.activeUntilISO ?? null,
      topUp: `Send USDC to the billing contract: ${process.env.BILLING_ADDRESS}`,
    });
    return null;
  }
  return address;
}

function bearer(req: IncomingMessage): string {
  const h = req.headers.authorization ?? "";
  if (!h.startsWith("Bearer ")) throw new AuthError("missing bearer token");
  return h.slice(7);
}

async function body<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 64 * 1024) throw new Error("request body too large");
    chunks.push(c as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function json(res: ServerResponse, status: number, payload: unknown) {
  const out = JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  res.writeHead(status, { "content-type": "application/json" });
  res.end(out);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env var ${name}`);
  return v;
}

const port = Number(process.env.PORT ?? 8080);
server.listen(port, () => console.log(`weather api on :${port} (chain ${chain.name})`));

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    gate.stop();
    server.close(() => process.exit(0));
  });
}
