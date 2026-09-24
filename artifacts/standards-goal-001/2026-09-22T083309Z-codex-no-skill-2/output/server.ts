import { createHash } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_ORIGIN = trimTrailingSlash(process.env.PUBLIC_ORIGIN ?? "https://forecast.example.com");
const RECEIVING_WALLET = process.env.RECEIVING_WALLET ?? "0x0000000000000000000000000000000000000000";
const AGENT_ID = process.env.AGENT_ID ?? "0";
const FACILITATOR_URL = trimTrailingSlash(process.env.FACILITATOR_URL ?? "https://facilitator.openx402.ai");
const WEATHER_API_URL = process.env.WEATHER_API_URL ?? "https://api.open-meteo.com/v1/forecast";
const RATING_RELAY_URL = process.env.RATING_RELAY_URL;

const X402_VERSION = 2;
const PRICE_USDC_ATOMS = "350000";
const BASE_NETWORK = "eip155:8453";
const BASE_CHAIN_ID = 8453;
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bDa3";
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const AGENT_REGISTRY = `${BASE_NETWORK}:${IDENTITY_REGISTRY}`;
const FORECAST_PATH = "/forecast";

type PaymentRequirements = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    assetName: string;
    assetDecimals: number;
    assetTransferMethod: "eip3009";
    paymentFlow: "authorization";
    eip712: {
      name: string;
      version: string;
    };
  };
};

type PaymentRequired = {
  x402Version: number;
  error?: string;
  resource: {
    url: string;
    description: string;
    mimeType: string;
    serviceName: string;
    tags: string[];
  };
  accepts: PaymentRequirements[];
};

const settledPayments = new Map<string, any>();

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const clientError =
      message.startsWith("Query parameter ") ||
      message.startsWith("feedbackHash ") ||
      message.includes("JSON");
    sendJson(res, clientError ? 400 : 500, {
      error: clientError ? "bad_request" : "internal_error",
      message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`forecast.example.com service listening on http://localhost:${PORT}`);
});

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", PUBLIC_ORIGIN);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "forecast.example.com",
      x402Version: X402_VERSION,
      network: BASE_NETWORK,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/.well-known/agent-registration.json") {
    sendJson(res, 200, agentRegistration());
    return;
  }

  if (req.method === "GET" && url.pathname === "/.well-known/agent-card.json") {
    sendJson(res, 200, agentCard());
    return;
  }

  if (req.method === "GET" && url.pathname === "/.well-known/x402.json") {
    sendJson(res, 200, x402Discovery());
    return;
  }

  if (req.method === "GET" && url.pathname === "/openapi.json") {
    sendJson(res, 200, openApi());
    return;
  }

  if (req.method === "GET" && url.pathname === FORECAST_PATH) {
    await handleForecast(req, res, url);
    return;
  }

  if (req.method === "POST" && url.pathname === "/ratings/calldata") {
    const body = await readJson(req);
    sendJson(res, 200, buildRatingTransaction(body));
    return;
  }

  if (req.method === "POST" && url.pathname === "/ratings/relay") {
    await relayRating(req, res);
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

async function handleForecast(req: IncomingMessage, res: ServerResponse, url: URL) {
  const requirements = paymentRequirements(url);
  const paymentRequired = paymentRequiredResponse(url, requirements);
  const paymentHeader = header(req, "payment-signature") ?? header(req, "x-payment");

  if (!paymentHeader) {
    sendPaymentRequired(res, paymentRequired, "Payment required: 0.35 USDC on Base.");
    return;
  }

  const paymentPayload = parseBase64Json(paymentHeader);
  if (!paymentPayload) {
    sendPaymentRequired(res, paymentRequired, "Invalid PAYMENT-SIGNATURE header.");
    return;
  }

  const paymentKey = sha256(`${paymentHeader}:${JSON.stringify(requirements)}`);
  let settlement = settledPayments.get(paymentKey);

  if (!settlement) {
    const verification = await facilitatorPost("/verify", {
      x402Version: X402_VERSION,
      paymentPayload,
      paymentRequirements: requirements,
    });

    if (!verification || verification.isValid !== true) {
      sendPaymentRequired(res, paymentRequired, String(verification?.invalidReason ?? "Payment verification failed."));
      return;
    }

    const forecast = await getForecast(url);
    settlement = await facilitatorPost("/settle", {
      x402Version: X402_VERSION,
      paymentPayload,
      paymentRequirements: requirements,
    });

    if (!settlement || settlement.success === false || settlement.isValid === false) {
      sendJson(res, 502, {
        error: "settlement_failed",
        settlement,
      });
      return;
    }

    settledPayments.set(paymentKey, settlement);
    sendJson(
      res,
      200,
      {
        service: "forecast.example.com",
        pricePaid: {
          asset: "USDC",
          network: BASE_NETWORK,
          amountAtomic: PRICE_USDC_ATOMS,
          amount: "0.35",
        },
        forecast,
        rating: {
          calldataEndpoint: `${PUBLIC_ORIGIN}/ratings/calldata`,
          reputationRegistry: REPUTATION_REGISTRY,
          agentRegistry: AGENT_REGISTRY,
          agentId: AGENT_ID,
        },
      },
      paymentResponseHeaders(settlement),
    );
    return;
  }

  const forecast = await getForecast(url);
  sendJson(
    res,
    200,
    {
      service: "forecast.example.com",
      cachedSettlement: true,
      forecast,
      rating: {
        calldataEndpoint: `${PUBLIC_ORIGIN}/ratings/calldata`,
        reputationRegistry: REPUTATION_REGISTRY,
        agentRegistry: AGENT_REGISTRY,
        agentId: AGENT_ID,
      },
    },
    paymentResponseHeaders(settlement),
  );
}

function paymentRequirements(url: URL): PaymentRequirements {
  return {
    scheme: "exact",
    network: BASE_NETWORK,
    amount: PRICE_USDC_ATOMS,
    asset: USDC_BASE,
    payTo: RECEIVING_WALLET,
    maxTimeoutSeconds: 90,
    extra: {
      assetName: "USDC",
      assetDecimals: 6,
      assetTransferMethod: "eip3009",
      paymentFlow: "authorization",
      eip712: {
        name: "USD Coin",
        version: "2",
      },
    },
  };
}

function paymentRequiredResponse(url: URL, requirements: PaymentRequirements): PaymentRequired {
  return {
    x402Version: X402_VERSION,
    resource: {
      url: `${PUBLIC_ORIGIN}${url.pathname}${url.search}`,
      description: "Weather forecast for one latitude/longitude request.",
      mimeType: "application/json",
      serviceName: "Forecast Example",
      tags: ["weather", "forecast", "base", "usdc", "agents"],
    },
    accepts: [requirements],
  };
}

function sendPaymentRequired(res: ServerResponse, challenge: PaymentRequired, message: string) {
  const body = { ...challenge, error: message };
  const encoded = base64Json(body);
  sendJson(res, 402, body, {
    "PAYMENT-REQUIRED": encoded,
    "X-PAYMENT-REQUIRED": encoded,
  });
}

async function getForecast(url: URL) {
  const lat = numberParam(url, "lat", -90, 90);
  const lon = numberParam(url, "lon", -180, 180);
  const days = integerParam(url, "days", 1, 7, 3);

  const providerUrl = new URL(WEATHER_API_URL);
  providerUrl.searchParams.set("latitude", String(lat));
  providerUrl.searchParams.set("longitude", String(lon));
  providerUrl.searchParams.set("forecast_days", String(days));
  providerUrl.searchParams.set("timezone", "UTC");
  providerUrl.searchParams.set("current", "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation");
  providerUrl.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max");

  const response = await fetch(providerUrl, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`weather provider returned ${response.status}`);
  }

  const provider = await response.json();
  return {
    location: { latitude: lat, longitude: lon },
    days,
    provider: "open-meteo",
    providerUrl: providerUrl.toString(),
    issuedAt: new Date().toISOString(),
    data: provider,
  };
}

function buildRatingTransaction(body: unknown) {
  const input = isRecord(body) ? body : {};
  const value = clampInteger(Number(input.value ?? input.rating ?? 100), 0, 100);
  const tag2 = String(input.tag2 ?? "forecast").slice(0, 64);
  const endpoint = String(input.endpoint ?? `${PUBLIC_ORIGIN}${FORECAST_PATH}`).slice(0, 2048);
  const feedbackURI = String(input.feedbackURI ?? "").slice(0, 2048);
  const feedbackHash = normalizeBytes32(String(input.feedbackHash ?? "0x"));

  const args = [
    encodeUint(BigInt(AGENT_ID)),
    encodeInt(BigInt(value), 128),
    encodeUint(0n, 8),
    encodeString("starred"),
    encodeString(tag2),
    encodeString(endpoint),
    encodeString(feedbackURI),
    encodeBytes32(feedbackHash),
  ];
  const data = encodeFunctionCall("giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)", args);

  return {
    standard: "ERC-8004",
    network: BASE_NETWORK,
    chainId: BASE_CHAIN_ID,
    to: REPUTATION_REGISTRY,
    data,
    value: "0x0",
    function: "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
    decoded: {
      agentRegistry: AGENT_REGISTRY,
      agentId: AGENT_ID,
      value,
      valueDecimals: 0,
      tag1: "starred",
      tag2,
      endpoint,
      feedbackURI,
      feedbackHash,
    },
    gasless: {
      requirement: "Submit this transaction through an ERC-4337 or EIP-7702 Base relay/paymaster if the reviewer has no ETH.",
      relayEndpoint: RATING_RELAY_URL ? `${PUBLIC_ORIGIN}/ratings/relay` : null,
    },
  };
}

async function relayRating(req: IncomingMessage, res: ServerResponse) {
  if (!RATING_RELAY_URL) {
    sendJson(res, 503, {
      error: "rating_relay_not_configured",
      fallback: `${PUBLIC_ORIGIN}/ratings/calldata`,
    });
    return;
  }

  const body = await readJson(req);
  const response = await fetch(RATING_RELAY_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });

  const relayBody = await safeJson(response);
  sendJson(res, response.status, {
    relay: RATING_RELAY_URL,
    response: relayBody,
  });
}

async function facilitatorPost(path: "/verify" | "/settle", body: unknown): Promise<any> {
  const response = await fetch(`${FACILITATOR_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  return safeJson(response);
}

function agentRegistration() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Forecast Example",
    description: "Autonomous-agent weather forecast API. Each forecast call costs 0.35 USDC on Base and is paid with x402.",
    image: `${PUBLIC_ORIGIN}/icon.png`,
    x402Support: true,
    active: true,
    registrations: [
      {
        agentId: Number(AGENT_ID),
        agentRegistry: AGENT_REGISTRY,
      },
    ],
    supportedTrust: ["reputation"],
    payments: {
      protocol: "x402",
      version: X402_VERSION,
      network: BASE_NETWORK,
      asset: USDC_BASE,
      amount: PRICE_USDC_ATOMS,
      displayAmount: "0.35 USDC",
      payTo: RECEIVING_WALLET,
      facilitator: FACILITATOR_URL,
    },
    reputation: {
      standard: "ERC-8004",
      registry: REPUTATION_REGISTRY,
      preferredTags: {
        tag1: "starred",
        tag2: "forecast",
      },
      calldataEndpoint: `${PUBLIC_ORIGIN}/ratings/calldata`,
      relayEndpoint: RATING_RELAY_URL ? `${PUBLIC_ORIGIN}/ratings/relay` : null,
    },
    services: [
      {
        name: "web",
        endpoint: PUBLIC_ORIGIN,
      },
      {
        name: "OpenAPI",
        endpoint: `${PUBLIC_ORIGIN}/openapi.json`,
        version: "3.1.0",
      },
      {
        name: "A2A",
        endpoint: `${PUBLIC_ORIGIN}/.well-known/agent-card.json`,
        version: "0.3.0",
      },
      {
        name: "x402",
        endpoint: `${PUBLIC_ORIGIN}/.well-known/x402.json`,
        version: "2",
      },
    ],
  };
}

function agentCard() {
  return {
    name: "Forecast Example",
    description: "Machine-payable weather forecasts for autonomous agents.",
    url: PUBLIC_ORIGIN,
    version: "1.0.0",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [
      {
        id: "weather.forecast.v1",
        name: "Weather forecast",
        description: "Returns current and daily forecast data for a latitude/longitude.",
        tags: ["weather", "forecast"],
        examples: [`GET ${PUBLIC_ORIGIN}/forecast?lat=40.7128&lon=-74.0060&days=3`],
        inputModes: ["application/json", "query"],
        outputModes: ["application/json"],
        payment: paymentRequirements(new URL(`${PUBLIC_ORIGIN}${FORECAST_PATH}`)),
      },
    ],
    trust: {
      erc8004: {
        agentRegistry: AGENT_REGISTRY,
        agentId: Number(AGENT_ID),
        reputationRegistry: REPUTATION_REGISTRY,
      },
    },
  };
}

function x402Discovery() {
  return {
    x402Version: X402_VERSION,
    resources: [
      {
        method: "GET",
        path: FORECAST_PATH,
        url: `${PUBLIC_ORIGIN}${FORECAST_PATH}`,
        description: "One weather forecast call.",
        accepts: [paymentRequirements(new URL(`${PUBLIC_ORIGIN}${FORECAST_PATH}`))],
      },
    ],
  };
}

function openApi() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Forecast Example",
      version: "1.0.0",
    },
    servers: [{ url: PUBLIC_ORIGIN }],
    paths: {
      "/forecast": {
        get: {
          summary: "Buy one weather forecast with x402",
          parameters: [
            { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
            { name: "lon", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 7, default: 3 } },
          ],
          responses: {
            "200": { description: "Forecast response" },
            "402": { description: "x402 payment required" },
          },
        },
      },
      "/ratings/calldata": {
        post: {
          summary: "Build ERC-8004 feedback calldata",
          responses: { "200": { description: "Transaction request" } },
        },
      },
      "/health": {
        get: {
          responses: { "200": { description: "Service health" } },
        },
      },
    },
  };
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": status === 200 ? "public, max-age=30" : "no-store",
    ...headers,
  });
  res.end(`${JSON.stringify(body, null, 2)}\n`);
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function safeJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { status: response.status, body: text };
  }
}

function parseBase64Json(value: string): any | null {
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function base64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function paymentResponseHeaders(settlement: unknown): Record<string, string> {
  const encoded = base64Json(settlement);
  return {
    "PAYMENT-RESPONSE": encoded,
    "X-PAYMENT-RESPONSE": encoded,
  };
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function numberParam(url: URL, name: string, min: number, max: number): number {
  const raw = url.searchParams.get(name);
  const value = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Query parameter ${name} must be a number from ${min} to ${max}.`);
  }
  return value;
}

function integerParam(url: URL, name: string, min: number, max: number, fallback: number): number {
  const raw = url.searchParams.get(name);
  const value = raw === null ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Query parameter ${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return max;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeBytes32(value: string): string {
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) {
    return value;
  }
  if (value === "0x" || value === "") {
    return `0x${"0".repeat(64)}`;
  }
  throw new Error("feedbackHash must be bytes32 hex or omitted");
}

function encodeFunctionCall(signature: string, args: EncodedArg[]): string {
  const selectors: Record<string, string> = {
    "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)": "3c036a7e",
  };
  const selector = selectors[signature];
  if (!selector) {
    throw new Error(`No function selector configured for ${signature}`);
  }
  const head: string[] = [];
  const tail: string[] = [];
  let dynamicOffset = 32 * args.length;

  for (const arg of args) {
    if (arg.dynamic) {
      head.push(word(BigInt(dynamicOffset)));
      tail.push(arg.data);
      dynamicOffset += arg.data.length / 2;
    } else {
      head.push(arg.data);
    }
  }

  return `0x${selector}${head.join("")}${tail.join("")}`;
}

type EncodedArg = { dynamic: false; data: string } | { dynamic: true; data: string };

function encodeUint(value: bigint, bits = 256): EncodedArg {
  if (value < 0n || value >= 1n << BigInt(bits)) {
    throw new Error(`uint${bits} out of range`);
  }
  return { dynamic: false, data: word(value) };
}

function encodeInt(value: bigint, bits = 256): EncodedArg {
  const min = -(1n << BigInt(bits - 1));
  const max = (1n << BigInt(bits - 1)) - 1n;
  if (value < min || value > max) {
    throw new Error(`int${bits} out of range`);
  }
  return { dynamic: false, data: word(value < 0 ? (1n << 256n) + value : value) };
}

function encodeBytes32(value: string): EncodedArg {
  return { dynamic: false, data: normalizeBytes32(value).slice(2).toLowerCase() };
}

function encodeString(value: string): EncodedArg {
  const bytes = Buffer.from(value, "utf8");
  const length = word(BigInt(bytes.length));
  const padded = bytes.toString("hex").padEnd(Math.ceil(bytes.length / 32) * 64, "0");
  return { dynamic: true, data: `${length}${padded}` };
}

function word(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}
