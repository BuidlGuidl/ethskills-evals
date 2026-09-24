// forecast.example.com — pay-per-call weather forecasts for agents.
// x402 v2 (exact scheme, USDC on Base via EIP-3009) + ERC-8004 identity binding.
// Zero deps: node:http + fetch. Run: node server.ts (Node >= 22.18 strips types).
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

// ---- config ---------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 8080);
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN ?? "https://forecast.example.com";

// Base mainnet (CAIP-2) and native USDC on Base. 6 decimals: $0.35 = 350000.
const NETWORK = "eip155:8453";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRICE_BASE_UNITS = "350000";

// ERC-8004 IdentityRegistry on Base (mainnet address set). agentId is the tokenId
// the registry assigned at register() — set it after minting, never invent it.
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const AGENT_ID = requireEnv("AGENT_ID");
// Receives USDC. Should equal the agentWallet set on the ERC-8004 identity.
const PAY_TO = requireEnv("PAY_TO");
// Registration file location (tokenURI of the agent NFT), e.g. ipfs://bafy...
const AGENT_URI = process.env.AGENT_URI ?? "";

// Facilitator does verify/settle and pays gas. Mainnet CDP facilitator needs a
// bearer token (server-side credential only; callers never need one).
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "https://api.cdp.coinbase.com/platform/v2/x402";
const FACILITATOR_AUTH = process.env.FACILITATOR_AUTH; // e.g. "Bearer <jwt>"

// Upstream weather source (Open-Meteo: free, no key).
const UPSTREAM = process.env.UPSTREAM_URL ?? "https://api.open-meteo.com/v1/forecast";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

// ---- x402 wire types (subset) ---------------------------------------------

type PaymentRequirements = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
};

type PaymentPayload = {
  x402Version: number;
  resource?: unknown;
  accepted: PaymentRequirements;
  payload: {
    signature: string;
    authorization: { from: string; to: string; value: string; validAfter: string; validBefore: string; nonce: string };
  };
};

const REQUIREMENTS: PaymentRequirements = {
  scheme: "exact",
  network: NETWORK,
  amount: PRICE_BASE_UNITS,
  asset: USDC_BASE,
  payTo: PAY_TO,
  maxTimeoutSeconds: 60,
  // EIP-712 domain of USDC on Base, needed by the client to sign transferWithAuthorization.
  extra: { name: "USD Coin", version: "2" },
};

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
const unb64 = (s: string) => JSON.parse(Buffer.from(s, "base64").toString("utf8"));

// ---- published documents --------------------------------------------------

const AGENT_REGISTRY_CAIP10 = `${NETWORK}:${IDENTITY_REGISTRY}`;

// Served at /.well-known/agent-registration.json. Binds this domain to the
// onchain agent (ERC-8004 endpoint domain verification) and mirrors the agentURI file.
function registrationFile() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "forecast.example.com",
    description:
      "Weather forecasts for autonomous agents. GET /forecast?lat&lon&days, $0.35 USDC per call on Base via x402. " +
      "Machine-readable API: /openapi.json.",
    image: `${PUBLIC_ORIGIN}/logo.png`,
    services: [
      { name: "web", endpoint: `${PUBLIC_ORIGIN}/` },
      { name: "OpenAPI", endpoint: `${PUBLIC_ORIGIN}/openapi.json`, version: "3.1.0" },
    ],
    x402Support: true,
    active: true,
    registrations: [{ agentId: Number(AGENT_ID), agentRegistry: AGENT_REGISTRY_CAIP10 }],
    supportedTrust: ["reputation"],
  };
}

function openapi() {
  return {
    openapi: "3.1.0",
    info: { title: "forecast.example.com", version: "1.0.0" },
    servers: [{ url: PUBLIC_ORIGIN }],
    paths: {
      "/forecast": {
        get: {
          summary: "Daily forecast. Paid: x402 exact, 350000 USDC base units (=$0.35) on eip155:8453.",
          parameters: [
            { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
            { name: "lon", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 16, default: 3 } },
          ],
          responses: {
            "200": { description: "Forecast. PAYMENT-RESPONSE header carries settlement tx." },
            "400": { description: "Bad query. Never charged." },
            "402": { description: "Payment required. PAYMENT-REQUIRED header (base64 JSON)." },
          },
        },
      },
    },
  };
}

// ---- facilitator ----------------------------------------------------------

async function facilitator(path: "verify" | "settle", paymentPayload: PaymentPayload) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (FACILITATOR_AUTH) headers.authorization = FACILITATOR_AUTH;
  const r = await fetch(`${FACILITATOR_URL}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements: REQUIREMENTS }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`facilitator ${path} ${r.status}: ${JSON.stringify(body)}`);
  return body as Record<string, any>;
}

// ---- handlers -------------------------------------------------------------

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function paymentRequired(res: ServerResponse, resourceUrl: string, error: string) {
  const pr = {
    x402Version: 2,
    error,
    resource: { url: resourceUrl, description: "Weather forecast, one call", mimeType: "application/json" },
    accepts: [REQUIREMENTS],
  };
  send(res, 402, pr, { "PAYMENT-REQUIRED": b64(pr) });
}

function parseQuery(u: URL): { lat: number; lon: number; days: number } | string {
  const lat = Number(u.searchParams.get("lat"));
  const lon = Number(u.searchParams.get("lon"));
  const days = Number(u.searchParams.get("days") ?? 3);
  if (!u.searchParams.has("lat") || !Number.isFinite(lat) || lat < -90 || lat > 90) return "lat must be in [-90, 90]";
  if (!u.searchParams.has("lon") || !Number.isFinite(lon) || lon < -180 || lon > 180) return "lon must be in [-180, 180]";
  if (!Number.isInteger(days) || days < 1 || days > 16) return "days must be integer in [1, 16]";
  return { lat, lon, days };
}

// Cheap local check before spending a facilitator round trip. The facilitator
// re-checks signature, balance, validity window and nonce.
function matchesRequirements(p: PaymentPayload): string | null {
  const a = p?.accepted;
  const auth = p?.payload?.authorization;
  if (p?.x402Version !== 2) return "unsupported x402Version";
  if (!a || !auth) return "malformed payload";
  if (a.scheme !== "exact" || a.network !== NETWORK) return "wrong scheme/network";
  if (a.asset.toLowerCase() !== USDC_BASE.toLowerCase()) return "wrong asset";
  if (a.payTo.toLowerCase() !== PAY_TO.toLowerCase() || auth.to.toLowerCase() !== PAY_TO.toLowerCase()) return "wrong payTo";
  if (a.amount !== PRICE_BASE_UNITS || BigInt(auth.value) !== BigInt(PRICE_BASE_UNITS)) return "wrong amount";
  return null;
}

async function fetchForecast(q: { lat: number; lon: number; days: number }) {
  const u = new URL(UPSTREAM);
  u.searchParams.set("latitude", String(q.lat));
  u.searchParams.set("longitude", String(q.lon));
  u.searchParams.set("forecast_days", String(q.days));
  u.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max");
  u.searchParams.set("timezone", "auto");
  const r = await fetch(u, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  return r.json();
}

async function handleForecast(req: IncomingMessage, res: ServerResponse, u: URL) {
  // Validate input first so nobody pays for a request we'd reject.
  const q = parseQuery(u);
  if (typeof q === "string") return send(res, 400, { error: q });

  const resourceUrl = `${PUBLIC_ORIGIN}${u.pathname}${u.search}`;
  const header = req.headers["payment-signature"];
  if (typeof header !== "string") return paymentRequired(res, resourceUrl, "PAYMENT-SIGNATURE header required");

  let payload: PaymentPayload;
  let mismatch: string | null;
  try {
    payload = unb64(header);
    mismatch = matchesRequirements(payload);
  } catch {
    return paymentRequired(res, resourceUrl, "malformed PAYMENT-SIGNATURE");
  }
  if (mismatch) return paymentRequired(res, resourceUrl, mismatch);

  // 1. verify (no funds move)
  let v: Record<string, any>;
  try {
    v = await facilitator("verify", payload);
  } catch (e) {
    return send(res, 502, { error: "facilitator unavailable", detail: String(e) });
  }
  if (!v.isValid) return paymentRequired(res, resourceUrl, v.invalidReason ?? "payment invalid");

  // 2. produce the goods; if upstream fails we never settle, caller is not charged
  let forecast: unknown;
  try {
    forecast = await fetchForecast(q);
  } catch (e) {
    return send(res, 502, { error: "forecast upstream failed, not charged", detail: String(e) });
  }

  // 3. settle: facilitator submits transferWithAuthorization (EIP-3009) and pays gas
  let s: Record<string, any>;
  try {
    s = await facilitator("settle", payload);
  } catch (e) {
    return send(res, 502, { error: "settlement failed, not charged", detail: String(e) });
  }
  if (!s.success) return paymentRequired(res, resourceUrl, s.errorReason ?? "settlement failed");

  const payer: string = s.payer ?? v.payer ?? payload.payload.authorization.from;
  send(
    res,
    200,
    {
      forecast,
      // Everything the caller needs to rate this call on ERC-8004 without asking anyone.
      feedback: {
        reputationRegistry: `${NETWORK}:${REPUTATION_REGISTRY}`,
        agentRegistry: AGENT_REGISTRY_CAIP10,
        agentId: AGENT_ID,
        endpoint: `${PUBLIC_ORIGIN}/forecast`,
        suggestedTags: ["forecast", "quality"],
        proofOfPayment: { fromAddress: payer, toAddress: PAY_TO, chainId: "8453", txHash: s.transaction },
      },
    },
    { "PAYMENT-RESPONSE": b64(s) },
  );
}

// ---- router ---------------------------------------------------------------

const server = createServer(async (req, res) => {
  const u = new URL(req.url ?? "/", PUBLIC_ORIGIN);
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "PAYMENT-SIGNATURE, content-type",
        "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
      });
      return res.end();
    }
    if (req.method !== "GET") return send(res, 405, { error: "GET only" });

    switch (u.pathname) {
      case "/forecast":
        return await handleForecast(req, res, u);
      case "/.well-known/agent-registration.json":
        return send(res, 200, registrationFile());
      case "/openapi.json":
        return send(res, 200, openapi());
      case "/":
        return send(res, 200, {
          name: "forecast.example.com",
          agentRegistry: AGENT_REGISTRY_CAIP10,
          agentId: AGENT_ID,
          agentURI: AGENT_URI || null,
          registration: `${PUBLIC_ORIGIN}/.well-known/agent-registration.json`,
          openapi: `${PUBLIC_ORIGIN}/openapi.json`,
          price: { amount: PRICE_BASE_UNITS, asset: USDC_BASE, network: NETWORK },
        });
      case "/health":
        return send(res, 200, { ok: true });
      default:
        return send(res, 404, { error: "not found" });
    }
  } catch (e) {
    send(res, 500, { error: "internal", detail: String(e) });
  }
});

server.listen(PORT, () => console.log(`forecast listening on :${PORT}`));
