// forecast.example.com — pay-per-call weather forecasts for agents.
// Payment: x402 v2, "exact" scheme, USDC on Base (EIP-3009 transferWithAuthorization,
// so the caller needs no ETH). Identity + reputation: ERC-8004 on Base.
// No dependencies: node:http + fetch. Run: node server.ts (Node >= 22.18 strips types).

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

// ---------- config ----------

const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN ?? "https://forecast.example.com";
const PORT = Number(process.env.PORT ?? 8080);

// Address that receives USDC. Needs no ETH: the facilitator submits the transfer.
const PAY_TO = mustEnv("PAY_TO");
// tokenId minted by IdentityRegistry.register() on Base. Assigned by the registry, not chosen.
const AGENT_ID = mustEnv("AGENT_ID");
// ipfs:// URI of the registration file, as set onchain via setAgentURI().
const AGENT_URI = process.env.AGENT_URI ?? "";

// x402 facilitator (verify + settle). Must support eip155:8453 mainnet.
const FACILITATOR_URL = mustEnv("FACILITATOR_URL").replace(/\/$/, "");
// Optional auth header for the facilitator (e.g. CDP-hosted). This is OUR credential, never the caller's.
const FACILITATOR_AUTH = process.env.FACILITATOR_AUTH;

// Upstream weather source (commercial plan; key is ours, never the caller's).
const WEATHER_URL = process.env.WEATHER_URL ?? "https://customer-api.open-meteo.com/v1/forecast";
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// ---------- constants ----------

const NETWORK = "eip155:8453"; // Base mainnet, CAIP-2
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // native USDC on Base, 6 decimals
const PRICE_BASE_UNITS = "350000"; // $0.35 * 10^6
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const AGENT_REGISTRY = `${NETWORK}:${IDENTITY_REGISTRY}`;

const FORECAST_PATH = "/forecast";
const FORECAST_DESCRIPTION = "Hourly weather forecast (temperature, precipitation probability, wind) for up to 7 days at a lat/lon.";

// ---------- published documents ----------

// ERC-8004 registration file. Same content is pinned to IPFS as the agentURI, and served
// here at /.well-known/agent-registration.json to bind this endpoint domain to the onchain agent.
function registrationFile() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "forecast.example.com",
    description: `${FORECAST_DESCRIPTION} Pay per call: $0.35 in USDC on Base via x402. No account or API key.`,
    image: `${PUBLIC_ORIGIN}/logo.png`,
    services: [
      { name: "web", endpoint: `${PUBLIC_ORIGIN}${FORECAST_PATH}` },
      { name: "OpenAPI", endpoint: `${PUBLIC_ORIGIN}/openapi.json`, version: "3.1.0" },
    ],
    x402Support: true,
    active: true,
    registrations: [{ agentId: Number(AGENT_ID), agentRegistry: AGENT_REGISTRY }],
    supportedTrust: ["reputation"],
  };
}

function openApi() {
  return {
    openapi: "3.1.0",
    info: { title: "forecast.example.com", version: "1.0.0", description: FORECAST_DESCRIPTION },
    servers: [{ url: PUBLIC_ORIGIN }],
    paths: {
      [FORECAST_PATH]: {
        get: {
          summary: "Weather forecast. Paid: x402, 350000 base units of USDC (6 dp) on eip155:8453.",
          parameters: [
            { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
            { name: "lon", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 7, default: 3 } },
          ],
          responses: {
            "200": { description: "Forecast. PAYMENT-RESPONSE header carries the settlement receipt." },
            "400": { description: "Bad parameters. Nothing charged." },
            "402": { description: "Payment required. PAYMENT-REQUIRED header (base64 JSON) lists accepted payment." },
            "502": { description: "Upstream failed. Payment was verified but NOT settled; nothing charged." },
          },
        },
      },
    },
  };
}

// ---------- x402 ----------

type PaymentRequirements = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
};

// EIP-712 domain of Base USDC goes in `extra` so the client can sign transferWithAuthorization.
const REQUIREMENTS: PaymentRequirements = {
  scheme: "exact",
  network: NETWORK,
  amount: PRICE_BASE_UNITS,
  asset: USDC_BASE,
  payTo: PAY_TO,
  maxTimeoutSeconds: 60,
  extra: { name: "USD Coin", version: "2" },
};

function paymentRequired(url: string, error?: string) {
  return {
    x402Version: 2,
    ...(error ? { error } : {}),
    resource: { url, description: FORECAST_DESCRIPTION, mimeType: "application/json" },
    accepts: [REQUIREMENTS],
  };
}

async function facilitator(path: "verify" | "settle", paymentPayload: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (FACILITATOR_AUTH) headers.authorization = FACILITATOR_AUTH;
  const res = await fetch(`${FACILITATOR_URL}/${path}`, {
    method: "POST",
    headers,
    // Always our requirements, never the ones echoed by the client.
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements: REQUIREMENTS }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`facilitator ${path} HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<Record<string, any>>;
}

// ---------- forecast ----------

async function fetchForecast(lat: number, lon: number, days: number) {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    forecast_days: String(days),
    hourly: "temperature_2m,precipitation_probability,wind_speed_10m",
    timezone: "UTC",
  });
  if (WEATHER_API_KEY) q.set("apikey", WEATHER_API_KEY);
  const res = await fetch(`${WEATHER_URL}?${q}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`weather upstream HTTP ${res.status}`);
  const data = (await res.json()) as any;
  return { lat, lon, days, units: data.hourly_units, hourly: data.hourly };
}

function parseQuery(url: URL): { lat: number; lon: number; days: number } | string {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const days = Number(url.searchParams.get("days") ?? 3);
  if (!url.searchParams.has("lat") || !Number.isFinite(lat) || lat < -90 || lat > 90) return "lat must be in [-90, 90]";
  if (!url.searchParams.has("lon") || !Number.isFinite(lon) || lon < -180 || lon > 180) return "lon must be in [-180, 180]";
  if (!Number.isInteger(days) || days < 1 || days > 7) return "days must be an integer in [1, 7]";
  return { lat, lon, days };
}

// ---------- handlers ----------

async function handleForecast(req: IncomingMessage, res: ServerResponse, url: URL) {
  // Validate before asking for money: bad input is never charged.
  const q = parseQuery(url);
  if (typeof q === "string") return json(res, 400, { error: q });

  const resourceUrl = `${PUBLIC_ORIGIN}${url.pathname}${url.search}`;
  const header = req.headers["payment-signature"];
  if (typeof header !== "string") return send402(res, resourceUrl);

  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return send402(res, resourceUrl, "malformed PAYMENT-SIGNATURE");
  }
  if (payload?.x402Version !== 2) return send402(res, resourceUrl, "unsupported x402Version");

  // 1. verify (signature, amount, payTo, asset, balance, validity window) — no chain write yet
  let verify;
  try {
    verify = await facilitator("verify", payload);
  } catch (e) {
    console.error(e);
    return json(res, 503, { error: "payment facilitator unavailable; nothing charged" });
  }
  if (!verify.isValid) return send402(res, resourceUrl, verify.invalidReason ?? "payment invalid");

  // 2. do the work. If it fails we never settle, so the caller pays nothing.
  let forecast;
  try {
    forecast = await fetchForecast(q.lat, q.lon, q.days);
  } catch (e) {
    console.error(e);
    return json(res, 502, { error: "forecast upstream failed; payment not settled" });
  }

  // 3. settle onchain (facilitator submits transferWithAuthorization and pays gas).
  //    A replayed authorization fails here: EIP-3009 nonces are single-use in the USDC contract.
  let settle;
  try {
    settle = await facilitator("settle", payload);
  } catch (e) {
    console.error(e);
    return json(res, 503, { error: "settlement failed; nothing charged" });
  }
  if (!settle.success) return send402(res, resourceUrl, settle.errorReason ?? "settlement failed");

  res.setHeader("PAYMENT-RESPONSE", b64(settle));
  json(res, 200, {
    ...forecast,
    // Everything the caller needs to rate this call on the ERC-8004 Reputation Registry.
    feedback: {
      reputationRegistry: `${NETWORK}:${REPUTATION_REGISTRY}`,
      agentRegistry: AGENT_REGISTRY,
      agentId: AGENT_ID,
      endpoint: `${PUBLIC_ORIGIN}${FORECAST_PATH}`,
      proofOfPayment: {
        fromAddress: settle.payer ?? verify.payer,
        toAddress: PAY_TO,
        chainId: "8453",
        txHash: settle.transaction,
      },
    },
  });
}

function send402(res: ServerResponse, resourceUrl: string, error?: string) {
  const body = paymentRequired(resourceUrl, error);
  res.setHeader("PAYMENT-REQUIRED", b64(body));
  json(res, 402, body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", PUBLIC_ORIGIN);
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "method not allowed" });

    switch (url.pathname) {
      case FORECAST_PATH:
        return await handleForecast(req, res, url);
      case "/.well-known/agent-registration.json":
        return json(res, 200, registrationFile());
      case "/openapi.json":
        return json(res, 200, openApi());
      case "/":
        return json(res, 200, {
          name: "forecast.example.com",
          price: { amount: PRICE_BASE_UNITS, asset: USDC_BASE, network: NETWORK, protocol: "x402" },
          erc8004: { agentRegistry: AGENT_REGISTRY, agentId: AGENT_ID, agentURI: AGENT_URI || undefined },
          openapi: `${PUBLIC_ORIGIN}/openapi.json`,
        });
      default:
        return json(res, 404, { error: "not found" });
    }
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: "internal error" });
  }
});

// ---------- utils ----------

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-expose-headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  res.end(JSON.stringify(body));
}

function b64(v: unknown) {
  return Buffer.from(JSON.stringify(v)).toString("base64");
}

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

server.listen(PORT, () => console.log(`forecast listening on :${PORT} (agent ${AGENT_REGISTRY}#${AGENT_ID})`));
