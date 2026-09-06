import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createPublicClient, http, webSocket, getAddress, type Address, type Hex } from "viem";
import { SubscriptionGate } from "./gate.ts";
import { SubscriptionAuth } from "./auth.ts";

/**
 * A worked example of the request path, not a production server: the weather handler
 * is a stub and the challenge/session stores are in-memory (fine for one process,
 * replace with Redis the moment you run two).
 *
 * The shape is the point:
 *   POST /auth/challenge  -> nonce to sign
 *   POST /auth/verify     -> bearer token, once per hour per customer
 *   GET  /v1/forecast     -> token -> cached gate check -> data, or 402
 */

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const BILLING_ADDRESS = getAddress(
  process.env.BILLING_ADDRESS ?? "0x0000000000000000000000000000000000000000",
);
const PORT = Number(process.env.PORT ?? 8787);
const DOMAIN = process.env.DOMAIN ?? "weather.example";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required (32+ bytes of hex or base64)");
}

// A websocket keeps AccountUpdated invalidation instant. Over plain HTTP viem falls
// back to polling, which is fine — it just means the cache can lag by a poll interval.
const client = createPublicClient({
  transport: RPC_URL.startsWith("ws") ? webSocket(RPC_URL) : http(RPC_URL),
});

const gate = new SubscriptionGate({ client, address: BILLING_ADDRESS });
const auth = new SubscriptionAuth(client, Buffer.from(process.env.SESSION_SECRET, "utf8"), DOMAIN);

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<Record<string, string>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  try {
    if (req.method === "POST" && url.pathname === "/auth/challenge") {
      const { address } = await readJson(req);
      const { message, nonce, expiresAt } = auth.issueChallenge(address as Address);
      return send(res, 200, { message, nonce, expiresAt });
    }

    if (req.method === "POST" && url.pathname === "/auth/verify") {
      const { address, nonce, signature } = await readJson(req);
      const session = await auth.verifyChallenge(address as Address, nonce, signature as Hex);
      return send(res, 200, session);
    }

    if (req.method === "GET" && url.pathname === "/v1/forecast") {
      const header = req.headers.authorization ?? "";
      if (!header.startsWith("Bearer ")) {
        return send(res, 401, { error: "missing bearer token; POST /auth/challenge first" });
      }

      let address: Address;
      try {
        address = auth.verifyToken(header.slice(7));
      } catch {
        return send(res, 401, { error: "invalid or expired token" });
      }

      let status;
      try {
        status = await gate.check(address);
      } catch {
        // The chain, or our view of it, is unavailable and we have nothing cached for
        // this address. 503 rather than 402: this is our outage, not their unpaid bill.
        return send(res, 503, { error: "subscription status temporarily unavailable" });
      }

      if (!status.active) {
        return send(res, 402, {
          error: "no active subscription",
          address,
          contract: BILLING_ADDRESS,
          hint: "deposit USDC and call subscribe(1) for hobby or subscribe(2) for pro",
        });
      }

      res.setHeader("x-subscription-plan", String(status.plan));
      res.setHeader("x-subscription-paid-through", String(status.paidThrough));
      return send(res, 200, {
        location: url.searchParams.get("q") ?? "unknown",
        forecast: "sunny, 22C", // your actual weather data goes here
      });
    }

    if (req.method === "GET" && url.pathname === "/internal/stats") {
      return send(res, 200, gate.stats);
    }

    send(res, 404, { error: "not found" });
  } catch (error) {
    send(res, 400, { error: (error as Error).message });
  }
});

server.listen(PORT, () => {
  console.log(`weather api on :${PORT}, billing ${BILLING_ADDRESS} via ${RPC_URL}`);
});

process.on("SIGINT", () => {
  gate.stop();
  server.close(() => process.exit(0));
});
