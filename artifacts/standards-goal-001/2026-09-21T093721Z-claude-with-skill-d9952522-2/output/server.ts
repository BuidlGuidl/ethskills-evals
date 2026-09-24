// forecast.example.com — weather forecasts for agents, $0.35/call in USDC on Base via x402 v2.
// Discovery + reputation: ERC-8004 on Base. Gasless payment: EIP-3009 (settled by facilitator).
// Run: node server.ts  (Node >= 22.18 strips types natively)

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { generateJwt } from "@coinbase/cdp-sdk/auth";

// ---------- config ----------

const env = (k: string, d?: string): string => {
  const v = process.env[k] ?? d;
  if (v === undefined || v === "") throw new Error(`missing env ${k}`);
  return v;
};

const PORT = Number(env("PORT", "8080"));
const PUBLIC_URL = env("PUBLIC_URL", "https://forecast.example.com").replace(/\/$/, "");
const PAY_TO = env("PAY_TO"); // service's receiving address on Base
const AGENT_ID = Number(env("AGENT_ID")); // tokenId assigned by IdentityRegistry.register()
const FACILITATOR_URL = env("FACILITATOR_URL", "https://api.cdp.coinbase.com/platform/v2/x402").replace(/\/$/, "");
const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID; // required for CDP facilitator, omit for self-hosted
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;

if (!/^0x[0-9a-fA-F]{40}$/.test(PAY_TO)) throw new Error("PAY_TO must be an address");
if (!Number.isInteger(AGENT_ID) || AGENT_ID < 0) throw new Error("AGENT_ID must be the onchain tokenId");

// ---------- onchain constants (Base mainnet, chainId 8453) ----------

const NETWORK = "eip155:8453";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // native USDC, 6 decimals, EIP-3009
const PRICE = "350000"; // $0.35 in USDC base units
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const AGENT_REGISTRY = `${NETWORK}:${IDENTITY_REGISTRY}`;

// ---------- x402 v2 wire types ----------

type ResourceInfo = { url: string; description?: string; mimeType?: string };
type PaymentRequirements = {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
};
type PaymentRequired = { x402Version: 2; error?: string; resource: ResourceInfo; accepts: PaymentRequirements[] };
type PaymentPayload = { x402Version: number; resource?: ResourceInfo; accepted: PaymentRequirements; payload: Record<string, unknown> };
type VerifyResponse = { isValid: boolean; invalidReason?: string; payer?: string };
type SettleResponse = { success: boolean; errorReason?: string; payer?: string; transaction: string; network: string };

const FORECAST_RESOURCE: ResourceInfo = {
  url: `${PUBLIC_URL}/forecast`,
  description: "Daily weather forecast (1-16 days) for a lat/lon",
  mimeType: "application/json",
};

const REQUIREMENTS: PaymentRequirements = {
  scheme: "exact",
  network: NETWORK,
  asset: USDC_BASE,
  amount: PRICE,
  payTo: PAY_TO,
  maxTimeoutSeconds: 60,
  extra: { name: "USD Coin", version: "2" }, // EIP-712 domain of Base USDC, needed to sign EIP-3009
};

// ---------- published documents ----------

// ERC-8004 registration file. It is also the agentURI (tokenURI) set onchain, served from the
// same domain as the endpoints, so this one URL binds the domain to the onchain agent.
const registrationFile = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "forecast.example.com",
  description: `Weather forecasts for autonomous agents. GET ${PUBLIC_URL}/forecast?lat=..&lon=..&days=.. ; $0.35 per call in USDC on Base via x402 (gasless, EIP-3009). No accounts or keys.`,
  image: `${PUBLIC_URL}/logo.png`,
  services: [
    { name: "web", endpoint: `${PUBLIC_URL}/` },
    { name: "OpenAPI", endpoint: `${PUBLIC_URL}/openapi.json` },
  ],
  x402Support: true,
  active: true,
  registrations: [{ agentId: AGENT_ID, agentRegistry: AGENT_REGISTRY }],
  supportedTrust: ["reputation"],
};

const openapi = {
  openapi: "3.1.0",
  info: { title: "forecast.example.com", version: "1.0.0" },
  servers: [{ url: PUBLIC_URL }],
  paths: {
    "/forecast": {
      get: {
        summary: "Daily forecast. Paid: x402 exact scheme, 350000 USDC base units on eip155:8453.",
        parameters: [
          { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
          { name: "lon", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
          { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 16, default: 3 } },
        ],
        responses: {
          "200": { description: "Forecast; PAYMENT-RESPONSE header carries settlement tx" },
          "400": { description: "Bad parameters (never charged)" },
          "402": { description: "Payment required; PAYMENT-REQUIRED header (base64 JSON)" },
        },
      },
    },
  },
};

// ---------- helpers ----------

const b64encode = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
const b64decode = <T>(s: string): T => JSON.parse(Buffer.from(s, "base64").toString("utf8")) as T;

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function paymentRequired(res: ServerResponse, error: string) {
  const pr: PaymentRequired = { x402Version: 2, error, resource: FORECAST_RESOURCE, accepts: [REQUIREMENTS] };
  send(res, 402, pr, { "PAYMENT-REQUIRED": b64encode(pr) });
}

async function facilitator<T>(op: "verify" | "settle", paymentPayload: PaymentPayload): Promise<T> {
  const url = new URL(`${FACILITATOR_URL}/${op}`);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (CDP_API_KEY_ID && CDP_API_KEY_SECRET) {
    const jwt = await generateJwt({
      apiKeyId: CDP_API_KEY_ID,
      apiKeySecret: CDP_API_KEY_SECRET,
      requestMethod: "POST",
      requestHost: url.host,
      requestPath: url.pathname,
    });
    headers.Authorization = `Bearer ${jwt}`;
  }
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements: REQUIREMENTS }),
  });
  if (!r.ok && r.status !== 400) throw new Error(`facilitator ${op} HTTP ${r.status}`);
  return (await r.json()) as T;
}

// Accepted payload must match our requirements exactly; don't trust the client's copy.
function matchesRequirements(a: PaymentRequirements | undefined): boolean {
  return (
    !!a &&
    a.scheme === REQUIREMENTS.scheme &&
    a.network === REQUIREMENTS.network &&
    a.asset.toLowerCase() === REQUIREMENTS.asset.toLowerCase() &&
    a.payTo.toLowerCase() === REQUIREMENTS.payTo.toLowerCase() &&
    a.amount === REQUIREMENTS.amount
  );
}

type Query = { lat: number; lon: number; days: number };

function parseQuery(u: URL): Query | string {
  const lat = Number(u.searchParams.get("lat"));
  const lon = Number(u.searchParams.get("lon"));
  const days = Number(u.searchParams.get("days") ?? "3");
  if (!u.searchParams.has("lat") || !Number.isFinite(lat) || lat < -90 || lat > 90) return "lat must be -90..90";
  if (!u.searchParams.has("lon") || !Number.isFinite(lon) || lon < -180 || lon > 180) return "lon must be -180..180";
  if (!Number.isInteger(days) || days < 1 || days > 16) return "days must be integer 1..16";
  return { lat, lon, days };
}

// Upstream data source: Open-Meteo (no key). Swap for a licensed provider in production.
async function fetchForecast(q: Query) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(q.lat));
  u.searchParams.set("longitude", String(q.lon));
  u.searchParams.set("forecast_days", String(q.days));
  u.searchParams.set("timezone", "auto");
  u.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code");
  const r = await fetch(u, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`upstream HTTP ${r.status}`);
  return r.json();
}

// ---------- paid route ----------

async function handleForecast(req: IncomingMessage, res: ServerResponse, u: URL) {
  // 1. Validate first: bad input is never charged.
  const q = parseQuery(u);
  if (typeof q === "string") return send(res, 400, { error: q });

  // 2. No payment → 402 with requirements.
  const header = req.headers["payment-signature"];
  if (typeof header !== "string") return paymentRequired(res, "PAYMENT-SIGNATURE header is required");

  let payload: PaymentPayload;
  try {
    payload = b64decode<PaymentPayload>(header);
  } catch {
    return paymentRequired(res, "PAYMENT-SIGNATURE is not base64 JSON");
  }
  if (payload.x402Version !== 2 || !matchesRequirements(payload.accepted)) {
    return paymentRequired(res, "payment does not match requirements");
  }

  // 3. Verify signature, balance, amount, validity window (no funds move yet).
  const v = await facilitator<VerifyResponse>("verify", payload);
  if (!v.isValid) return paymentRequired(res, `invalid payment: ${v.invalidReason ?? "unknown"}`);

  // 4. Do the work before settling, so an upstream failure costs the caller nothing.
  let forecast: unknown;
  try {
    forecast = await fetchForecast(q);
  } catch (e) {
    return send(res, 502, { error: "forecast source unavailable, not charged", detail: String(e) });
  }

  // 5. Settle: facilitator submits transferWithAuthorization and pays gas. Response only after success.
  const s = await facilitator<SettleResponse>("settle", payload);
  if (!s.success) return paymentRequired(res, `settlement failed: ${s.errorReason ?? "unknown"}`);

  const payer = s.payer ?? v.payer;
  send(
    res,
    200,
    {
      query: q,
      forecast,
      // Everything the caller needs to rate this call on the ERC-8004 Reputation Registry.
      feedback: {
        reputationRegistry: `${NETWORK}:${REPUTATION_REGISTRY}`,
        agentRegistry: AGENT_REGISTRY,
        agentId: AGENT_ID,
        endpoint: FORECAST_RESOURCE.url,
        suggestedTags: { tag1: "forecast", tag2: "accuracy" },
        proofOfPayment: { fromAddress: payer, toAddress: PAY_TO, chainId: "8453", txHash: s.transaction },
      },
    },
    { "PAYMENT-RESPONSE": b64encode(s) },
  );
}

// ---------- router ----------

const server = createServer(async (req, res) => {
  const u = new URL(req.url ?? "/", PUBLIC_URL);
  try {
    if (req.method !== "GET") return send(res, 405, { error: "GET only" });
    switch (u.pathname) {
      case "/.well-known/agent-registration.json":
        return send(res, 200, registrationFile, { "Cache-Control": "max-age=300" });
      case "/openapi.json":
        return send(res, 200, openapi);
      case "/":
        return send(res, 200, {
          name: registrationFile.name,
          description: registrationFile.description,
          registration: `${PUBLIC_URL}/.well-known/agent-registration.json`,
          openapi: `${PUBLIC_URL}/openapi.json`,
          price: { amount: PRICE, asset: USDC_BASE, network: NETWORK, scheme: "exact" },
        });
      case "/health":
        return send(res, 200, { ok: true });
      case "/forecast":
        return await handleForecast(req, res, u);
      default:
        return send(res, 404, { error: "not found" });
    }
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: "internal error" });
  }
});

server.listen(PORT, () => console.log(`forecast service on :${PORT}, agent ${AGENT_REGISTRY}#${AGENT_ID}`));
