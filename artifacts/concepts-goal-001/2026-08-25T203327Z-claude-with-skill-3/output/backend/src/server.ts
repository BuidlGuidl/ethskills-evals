import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Address, Hex } from "viem";
import { Auth } from "./auth.ts";
import { SubscriptionGate } from "./subscription.ts";

/**
 * The weather API, with billing checks in front of it.
 *
 *   GET  /nonce?address=0x...      -> the message to sign
 *   POST /session {address, signature} -> bearer token
 *   GET  /v1/forecast?city=...     -> 402 unless that address is paid up right now
 *   GET  /v1/account               -> what the contract says about the caller
 *
 * Env: BILLING_ADDRESS, RPC_URL, (optional) WS_RPC_URL, SESSION_SECRET, CHAIN_ID, PORT.
 */

const env = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) throw new Error(`missing env ${key}`);
  return value;
};

const rpcUrl = env("RPC_URL", "http://127.0.0.1:8545");
const billingAddress = env("BILLING_ADDRESS") as Address;
const chainId = Number(env("CHAIN_ID", "31337"));
const domain = env("API_DOMAIN", "weather.local");

const gate = new SubscriptionGate({
  rpcUrl,
  wsRpcUrl: process.env.WS_RPC_URL,
  billingAddress,
  ttlSeconds: Number(env("GATE_TTL_SECONDS", "30")),
});
gate.watch();

const auth = new Auth(env("SESSION_SECRET"), rpcUrl, domain, chainId);

const json = (res: ServerResponse, code: number, body: unknown) => {
  const payload = JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  res.writeHead(code, { "content-type": "application/json" });
  res.end(payload);
};

const readBody = async (req: IncomingMessage): Promise<Record<string, string>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/nonce") {
      const address = url.searchParams.get("address") as Address | null;
      if (!address) return json(res, 400, { error: "address required" });
      return json(res, 200, { message: auth.challenge(address) });
    }

    if (req.method === "POST" && url.pathname === "/session") {
      const body = await readBody(req);
      try {
        const session = await auth.verify(body.address as Address, body.signature as Hex);
        return json(res, 200, session);
      } catch (err) {
        return json(res, 401, { error: (err as Error).message });
      }
    }

    // Everything below needs a proven address.
    const address = auth.authenticate(req.headers.authorization);
    if (!address) return json(res, 401, { error: "sign in at /nonce then /session" });

    if (req.method === "GET" && url.pathname === "/v1/account") {
      return json(res, 200, await gate.status(address));
    }

    if (req.method === "GET" && url.pathname === "/v1/forecast") {
      const status = await gate.status(address);
      if (!status.subscribed) {
        // 402 is the honest status code here, and the client can act on it without support tickets.
        return json(res, 402, {
          error: "no active subscription",
          address,
          planId: status.planId,
          balance: status.balance.toString(),
          expiredAt: status.expiresAt || null,
          topUp: { contract: billingAddress, chainId },
        });
      }
      const city = url.searchParams.get("city") ?? "London";
      return json(res, 200, { city, forecast: "sunny, 21C", planId: status.planId, paidThrough: status.expiresAt });
    }

    return json(res, 404, { error: "not found" });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: "internal error" });
  }
});

const port = Number(env("PORT", "8787"));
server.listen(port, () => {
  console.log(`weather api listening on :${port}`);
  console.log(`  billing ${billingAddress} via ${rpcUrl}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    gate.stop();
    server.close(() => process.exit(0));
  });
}
