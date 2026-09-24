// forecast.example.com — pay-per-call weather forecasts for agents.
// x402 v2 (USDC on Base, EIP-3009) + ERC-8004 identity/reputation discovery.
// Zero npm deps. Run: node --experimental-strip-types server.ts  (Node >= 22.6)

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

// ---------- config ----------

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

const PORT = Number(process.env.PORT ?? 8080);
const PUBLIC_URL = process.env.PUBLIC_URL ?? "https://forecast.example.com";

// Base mainnet
const CHAIN_ID = 8453;
const NETWORK = `eip155:${CHAIN_ID}`;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // native USDC on Base, EIP-3009
const PRICE_ATOMIC = "350000"; // $0.35, USDC has 6 decimals

// ERC-8004 (same address on every supported chain)
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const AGENT_REGISTRY = `eip155:${CHAIN_ID}:${IDENTITY_REGISTRY}`;

const PAY_TO = required("PAY_TO"); // must equal the agentWallet set onchain for AGENT_ID
const AGENT_ID = Number(required("AGENT_ID")); // tokenId returned by IdentityRegistry.register
const OWNER = required("AGENT_OWNER"); // address holding the agent NFT
const FACILITATOR_URL = required("FACILITATOR_URL"); // x402 facilitator exposing /verify and /settle
const FACILITATOR_AUTH = process.env.FACILITATOR_AUTH; // optional "Authorization" header value

const UPSTREAM_URL = process.env.UPSTREAM_URL ?? "https://api.open-meteo.com/v1/forecast";
const UPSTREAM_API_KEY = process.env.UPSTREAM_API_KEY; // required for commercial Open-Meteo use

const FORECAST_PATH = "/v1/forecast";
const FORECAST_URL = `${PUBLIC_URL}${FORECAST_PATH}`;

// ---------- published documents ----------

// ERC-8004 registration file. Same JSON is pinned to IPFS and set as agentURI onchain;
// serving it here under /.well-known also proves we control this domain.
const registration = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "forecast.example.com",
  description:
    "Hourly + daily weather forecasts for any lat/lon, up to 16 days. " +
    "$0.35 USDC per call on Base via x402 (gasless EIP-3009). No account or API key.",
  image: `${PUBLIC_URL}/logo.png`,
  services: [
    { name: "web", endpoint: FORECAST_URL },
    { name: "A2A", endpoint: `${PUBLIC_URL}/.well-known/agent-card.json`, version: "0.3.0" },
  ],
  x402Support: true,
  active: true,
  registrations: [{ agentId: AGENT_ID, agentRegistry: AGENT_REGISTRY }],
  supportedTrust: ["reputation"],
};

const paymentRequirements = {
  scheme: "exact",
  network: NETWORK,
  amount: PRICE_ATOMIC,
  asset: USDC,
  payTo: PAY_TO,
  maxTimeoutSeconds: 60,
  extra: { name: "USD Coin", version: "2" }, // USDC EIP-712 domain, needed by client to sign
};

const forecastInputSchema = {
  type: "object",
  required: ["lat", "lon"],
  properties: {
    lat: { type: "number", minimum: -90, maximum: 90 },
    lon: { type: "number", minimum: -180, maximum: 180 },
    days: { type: "integer", minimum: 1, maximum: 16, default: 7 },
  },
};

const feedbackHint = {
  reputationRegistry: `eip155:${CHAIN_ID}:${REPUTATION_REGISTRY}`,
  agentRegistry: AGENT_REGISTRY,
  agentId: AGENT_ID,
  function:
    "giveFeedback(uint256 agentId,int128 value,uint8 valueDecimals,string tag1,string tag2,string endpoint,string feedbackURI,bytes32 feedbackHash)",
  suggested: { valueDecimals: 0, scale: "0-100", tag1: "forecast", tag2: "quality", endpoint: FORECAST_URL },
  proofOfPayment: "put {fromAddress,toAddress,chainId,txHash} from PAYMENT-RESPONSE in the feedbackURI file",
};

// A2A agent card: machine-readable description of the skill and how to pay.
const agentCard = {
  protocolVersion: "0.3.0",
  name: registration.name,
  description: registration.description,
  url: FORECAST_URL,
  version: "1.0.0",
  capabilities: {},
  defaultInputModes: ["application/json"],
  defaultOutputModes: ["application/json"],
  skills: [
    {
      id: "forecast",
      name: "Weather forecast",
      description: `GET ${FORECAST_URL}?lat=<num>&lon=<num>&days=<1-16>. Pay with x402 (see payment).`,
      tags: ["weather", "forecast", "x402"],
      inputSchema: forecastInputSchema,
    },
  ],
  payment: { protocol: "x402", x402Version: 2, accepts: [paymentRequirements] },
  erc8004: { ...registration.registrations[0], owner: OWNER, feedback: feedbackHint },
};

// ---------- helpers ----------

const b64encode = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
const b64decode = (s: string) => JSON.parse(Buffer.from(s, "base64").toString("utf8"));

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function paymentRequired(res: ServerResponse, error: string) {
  const body = {
    x402Version: 2,
    error,
    resource: { url: FORECAST_URL, description: "Weather forecast, one call", mimeType: "application/json" },
    accepts: [paymentRequirements],
  };
  send(res, 402, body, { "PAYMENT-REQUIRED": b64encode(body) });
}

async function facilitator(path: "verify" | "settle", paymentPayload: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (FACILITATOR_AUTH) headers.authorization = FACILITATOR_AUTH;
  const r = await fetch(`${FACILITATOR_URL}/${path}`, {
    method: "POST",
    headers,
    // always send OUR requirements, never trust the client's copy
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`facilitator ${path} http ${r.status}`);
  return r.json();
}

type Query = { lat: number; lon: number; days: number };

function parseQuery(url: URL): Query | string {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const days = Number(url.searchParams.get("days") ?? 7);
  if (!url.searchParams.has("lat") || !Number.isFinite(lat) || lat < -90 || lat > 90) return "lat must be -90..90";
  if (!url.searchParams.has("lon") || !Number.isFinite(lon) || lon < -180 || lon > 180) return "lon must be -180..180";
  if (!Number.isInteger(days) || days < 1 || days > 16) return "days must be integer 1..16";
  return { lat, lon, days };
}

async function fetchForecast(q: Query) {
  const u = new URL(UPSTREAM_URL);
  u.searchParams.set("latitude", String(q.lat));
  u.searchParams.set("longitude", String(q.lon));
  u.searchParams.set("forecast_days", String(q.days));
  u.searchParams.set("hourly", "temperature_2m,precipitation_probability,precipitation,wind_speed_10m");
  u.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code");
  u.searchParams.set("timezone", "UTC");
  if (UPSTREAM_API_KEY) u.searchParams.set("apikey", UPSTREAM_API_KEY);
  const r = await fetch(u, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`upstream http ${r.status}`);
  return r.json();
}

// ---------- paid route ----------

async function handleForecast(req: IncomingMessage, res: ServerResponse, url: URL) {
  // validate first: never charge for a request we can't serve
  const q = parseQuery(url);
  if (typeof q === "string") return send(res, 400, { error: q, inputSchema: forecastInputSchema });

  const header = req.headers["payment-signature"];
  if (typeof header !== "string") return paymentRequired(res, "PAYMENT-SIGNATURE header required");

  let payload: any;
  try {
    payload = b64decode(header);
  } catch {
    return paymentRequired(res, "PAYMENT-SIGNATURE is not base64 JSON");
  }

  // 1. verify signature, amount, payTo, balance, validity window (no funds move yet)
  const verified = await facilitator("verify", payload);
  if (!verified.isValid) return paymentRequired(res, `payment invalid: ${verified.invalidReason ?? "unknown"}`);

  // 2. do the work before settling, so an upstream failure costs the caller nothing
  let forecast: unknown;
  try {
    forecast = await fetchForecast(q);
  } catch (e) {
    return send(res, 503, { error: "forecast upstream unavailable, you were not charged" });
  }

  // 3. settle: facilitator submits transferWithAuthorization and pays the gas.
  //    EIP-3009 nonce makes replays of the same payload fail here.
  const settled = await facilitator("settle", payload);
  if (!settled.success) return paymentRequired(res, `settlement failed: ${settled.errorReason ?? "unknown"}`);

  send(
    res,
    200,
    {
      forecast,
      receipt: { network: settled.network ?? NETWORK, txHash: settled.transaction, payer: settled.payer },
      feedback: feedbackHint,
    },
    { "PAYMENT-RESPONSE": b64encode(settled) },
  );
}

// ---------- router ----------

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", PUBLIC_URL);
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

    switch (url.pathname) {
      case "/.well-known/agent-registration.json":
        return send(res, 200, registration, { "cache-control": "public, max-age=300" });
      case "/.well-known/agent-card.json":
        return send(res, 200, agentCard, { "cache-control": "public, max-age=300" });
      case FORECAST_PATH:
        return await handleForecast(req, res, url);
      case "/health":
        return send(res, 200, { ok: true });
      default:
        return send(res, 404, { error: "not found", see: "/.well-known/agent-card.json" });
    }
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 502, { error: "internal error" });
  }
});

server.listen(PORT, () => console.log(`forecast server on :${PORT}, agentId ${AGENT_ID}, payTo ${PAY_TO}`));
