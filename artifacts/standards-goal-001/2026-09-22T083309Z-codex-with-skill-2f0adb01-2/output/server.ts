import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_ORIGIN = stripTrailingSlash(process.env.PUBLIC_ORIGIN ?? "https://forecast.example.com");
const PAY_TO = process.env.PAY_TO_ADDRESS ?? "0x0000000000000000000000000000000000000F35";
const FACILITATOR_URL = stripTrailingSlash(process.env.X402_FACILITATOR_URL ?? "");
const WEATHER_UPSTREAM_URL = process.env.WEATHER_UPSTREAM_URL
  ? stripTrailingSlash(process.env.WEATHER_UPSTREAM_URL)
  : "";

const BASE_CHAIN_ID = 8453;
const NETWORK = `eip155:${BASE_CHAIN_ID}`;
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const FORECAST_PRICE_USDC_ATOMS = "350000";
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const AGENT_ID = process.env.ERC8004_AGENT_ID ?? "0";
const AGENT_REGISTRY = `${NETWORK}:${IDENTITY_REGISTRY}`;
const FORECAST_ENDPOINT = `${PUBLIC_ORIGIN}/v1/forecast`;

type Json = Record<string, unknown>;

type PaymentRequirements = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, string>;
};

type PaymentPayload = {
  x402Version?: number;
  accepted?: Partial<PaymentRequirements>;
  payload?: {
    signature?: string;
    authorization?: {
      from?: string;
      to?: string;
      value?: string;
      validAfter?: string;
      validBefore?: string;
      nonce?: string;
    };
  };
};

const server = createServer(async (req, res) => {
  try {
    setCommonHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", PUBLIC_ORIGIN);

    if (req.method === "GET" && url.pathname === "/") {
      sendJson(res, 200, serviceIndex());
      return;
    }

    if (req.method === "GET" && url.pathname === "/healthz") {
      sendJson(res, 200, {
        ok: true,
        service: "forecast.example.com",
        facilitatorConfigured: Boolean(FACILITATOR_URL),
        payToConfigured: PAY_TO !== "0x0000000000000000000000000000000000000F35",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/.well-known/agent-card.json") {
      sendJson(res, 200, agentCard());
      return;
    }

    if (req.method === "GET" && url.pathname === "/.well-known/agent-registration.json") {
      sendJson(res, 200, domainRegistration());
      return;
    }

    if (req.method === "GET" && url.pathname === "/agent-registration.json") {
      sendJson(res, 200, erc8004Registration());
      return;
    }

    if (req.method === "GET" && url.pathname === "/openapi.json") {
      sendJson(res, 200, openApiDocument());
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/payment-requirements") {
      sendJson(res, 200, paymentRequired(url, "PAYMENT-SIGNATURE header is required"));
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/reputation") {
      sendJson(res, 200, reputationInstructions());
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/forecast") {
      await handleForecast(req, res, url);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    sendJson(res, 500, { error: "internal_error", message });
  }
});

server.listen(PORT, () => {
  console.log(`forecast service listening on http://127.0.0.1:${PORT}`);
});

async function handleForecast(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const parsed = parseForecastQuery(url);
  if ("error" in parsed) {
    sendJson(res, 400, parsed);
    return;
  }

  const requirements = forecastPaymentRequirements(url);
  const payment = getPaymentPayload(req);

  if (!payment) {
    sendPaymentRequired(res, url, "PAYMENT-SIGNATURE header is required");
    return;
  }

  const mismatch = paymentMismatch(payment, requirements);
  if (mismatch) {
    sendPaymentRequired(res, url, mismatch);
    return;
  }

  if (!FACILITATOR_URL) {
    sendJson(res, 503, {
      error: "facilitator_not_configured",
      message: "Set X402_FACILITATOR_URL before accepting paid forecast calls.",
    });
    return;
  }

  const verify = await facilitatorPost("/verify", payment, requirements);
  if (!verify.body.isValid) {
    sendPaymentRequired(
      res,
      url,
      String(verify.body.invalidReason ?? verify.body.error ?? "payment_not_valid"),
    );
    return;
  }

  const forecast = await getForecast(parsed.lat, parsed.lon, parsed.days);
  const settle = await facilitatorPost("/settle", payment, requirements);

  if (!settle.body.success) {
    sendJson(res, 402, {
      error: "payment_settlement_failed",
      reason: settle.body.errorReason ?? settle.body.error ?? "settlement_failed",
      transaction: settle.body.transaction ?? "",
    });
    return;
  }

  res.setHeader("PAYMENT-RESPONSE", encodeBase64Json(settle.body));
  sendJson(res, 200, {
    service: "forecast.example.com",
    agent: {
      agentRegistry: AGENT_REGISTRY,
      agentId: AGENT_ID,
    },
    request: parsed,
    forecast,
    payment: settle.body,
    feedback: {
      registry: REPUTATION_REGISTRY,
      method: "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
      agentId: AGENT_ID,
      endpoint: FORECAST_ENDPOINT,
      suggestedTags: [
        { tag1: "quality", tag2: "forecast" },
        { tag1: "latency", tag2: "forecast" },
        { tag1: "settlement", tag2: "x402" },
      ],
      proofHash: hashJson({
        network: NETWORK,
        paymentTransaction: settle.body.transaction ?? "",
        endpoint: FORECAST_ENDPOINT,
      }),
    },
  });
}

function parseForecastQuery(url: URL): { lat: number; lon: number; days: number } | { error: string; message: string } {
  const rawLat = url.searchParams.get("lat");
  const rawLon = url.searchParams.get("lon");
  const lat = Number(rawLat);
  const lon = Number(rawLon);
  const days = Number(url.searchParams.get("days") ?? 7);

  if (rawLat === null || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { error: "invalid_lat", message: "lat is required and must be a number between -90 and 90" };
  }

  if (rawLon === null || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    return { error: "invalid_lon", message: "lon is required and must be a number between -180 and 180" };
  }

  if (!Number.isInteger(days) || days < 1 || days > 10) {
    return { error: "invalid_days", message: "days must be an integer from 1 through 10" };
  }

  return { lat, lon, days };
}

function getPaymentPayload(req: IncomingMessage): PaymentPayload | undefined {
  const header = firstHeader(req.headers["payment-signature"] ?? req.headers["x-payment"]);
  if (!header) return undefined;

  const attempts = [
    () => JSON.parse(Buffer.from(header, "base64").toString("utf8")),
    () => JSON.parse(Buffer.from(header, "base64url").toString("utf8")),
    () => JSON.parse(header),
  ];

  for (const attempt of attempts) {
    try {
      return attempt();
    } catch {
      continue;
    }
  }

  return undefined;
}

function paymentMismatch(payment: PaymentPayload, requirements: PaymentRequirements): string | undefined {
  if (payment.x402Version !== 2) return "x402Version must be 2";
  if (!payment.accepted) return "accepted payment requirements are missing";
  if (!payment.payload?.signature) return "payload.signature is missing";
  if (!payment.payload.authorization) return "payload.authorization is missing";

  const accepted = payment.accepted;
  const authorization = payment.payload.authorization;
  const comparisons: Array<[unknown, unknown, string]> = [
    [accepted.scheme, requirements.scheme, "scheme"],
    [accepted.network, requirements.network, "network"],
    [accepted.amount, requirements.amount, "amount"],
    [lower(accepted.asset), lower(requirements.asset), "asset"],
    [lower(accepted.payTo), lower(requirements.payTo), "payTo"],
    [authorization.value, requirements.amount, "authorization.value"],
    [lower(authorization.to), lower(requirements.payTo), "authorization.to"],
  ];

  for (const [actual, expected, label] of comparisons) {
    if (actual !== expected) return `${label} does not match this resource`;
  }

  if (!authorization.from || !authorization.nonce || !authorization.validAfter || !authorization.validBefore) {
    return "authorization is incomplete";
  }

  return undefined;
}

async function facilitatorPost(
  path: "/verify" | "/settle",
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<{ body: Json; headers: Headers }> {
  const response = await fetch(`${FACILITATOR_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      x402Version: 2,
      paymentPayload,
      paymentRequirements,
    }),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    return {
      body: {
        success: false,
        isValid: false,
        error: body.error ?? body.errorReason ?? `facilitator_${response.status}`,
      },
      headers: response.headers,
    };
  }

  return { body, headers: response.headers };
}

async function getForecast(lat: number, lon: number, days: number): Promise<Json> {
  if (WEATHER_UPSTREAM_URL) {
    const upstream = new URL(WEATHER_UPSTREAM_URL);
    upstream.searchParams.set("lat", String(lat));
    upstream.searchParams.set("lon", String(lon));
    upstream.searchParams.set("days", String(days));

    const response = await fetch(upstream, { headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`weather_upstream_${response.status}`);
    }

    return {
      source: upstream.origin,
      retrievedAt: new Date().toISOString(),
      data: await response.json(),
    };
  }

  const seed = createHash("sha256").update(`${lat}:${lon}:${days}`).digest();
  const today = new Date();
  const daily = Array.from({ length: days }, (_, index) => {
    const highC = 12 + ((seed[index % seed.length] + Math.round(lat)) % 22);
    const lowC = highC - 5 - (seed[(index + 7) % seed.length] % 6);
    const precipitationChance = seed[(index + 11) % seed.length] % 91;
    const conditions = ["clear", "partly_cloudy", "cloudy", "rain", "wind"][seed[(index + 17) % seed.length] % 5];
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + index));

    return {
      date: date.toISOString().slice(0, 10),
      highC,
      lowC,
      precipitationChance,
      conditions,
    };
  });

  return {
    source: "deterministic-local-demo",
    retrievedAt: new Date().toISOString(),
    daily,
  };
}

function sendPaymentRequired(res: ServerResponse, url: URL, error: string): void {
  const body = paymentRequired(url, error);
  res.setHeader("PAYMENT-REQUIRED", encodeBase64Json(body));
  sendJson(res, 402, body);
}

function paymentRequired(url: URL, error: string): Json {
  return {
    x402Version: 2,
    error,
    resource: {
      url: `${PUBLIC_ORIGIN}${url.pathname}${url.search}`,
      description: "Machine-readable weather forecast for autonomous agents",
      mimeType: "application/json",
      serviceName: "Forecast Example",
      tags: ["weather", "forecast", "x402", "usdc", "base"],
      iconUrl: `${PUBLIC_ORIGIN}/icon.png`,
    },
    accepts: [forecastPaymentRequirements(url)],
    extensions: {
      erc8004: {
        agentRegistry: AGENT_REGISTRY,
        agentId: AGENT_ID,
        reputationRegistry: `${NETWORK}:${REPUTATION_REGISTRY}`,
      },
    },
  };
}

function forecastPaymentRequirements(_url: URL): PaymentRequirements {
  return {
    scheme: "exact",
    network: NETWORK,
    amount: FORECAST_PRICE_USDC_ATOMS,
    asset: BASE_USDC,
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    extra: {
      assetTransferMethod: "eip3009",
      paymentFlow: "authorization",
      name: "USDC",
      version: "2",
    },
  };
}

function serviceIndex(): Json {
  return {
    service: "forecast.example.com",
    description: "Paid weather forecasts for autonomous agents",
    forecastEndpoint: FORECAST_ENDPOINT,
    price: {
      amount: FORECAST_PRICE_USDC_ATOMS,
      asset: BASE_USDC,
      network: NETWORK,
      display: "0.35 USDC",
    },
    discovery: {
      erc8004Registration: `${PUBLIC_ORIGIN}/agent-registration.json`,
      domainProof: `${PUBLIC_ORIGIN}/.well-known/agent-registration.json`,
      agentCard: `${PUBLIC_ORIGIN}/.well-known/agent-card.json`,
      openapi: `${PUBLIC_ORIGIN}/openapi.json`,
    },
  };
}

function erc8004Registration(): Json {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Forecast Example",
    description:
      "Weather forecast API for autonomous agents. Each forecast call costs 0.35 USDC on Base using x402 exact payments with EIP-3009.",
    image: `${PUBLIC_ORIGIN}/icon.png`,
    services: [
      { name: "web", endpoint: PUBLIC_ORIGIN },
      { name: "A2A", endpoint: `${PUBLIC_ORIGIN}/.well-known/agent-card.json`, version: "0.3.0" },
      { name: "OpenAPI", endpoint: `${PUBLIC_ORIGIN}/openapi.json`, version: "3.1.0" },
      { name: "x402", endpoint: FORECAST_ENDPOINT, version: "2" },
    ],
    x402Support: true,
    active: true,
    registrations: [{ agentId: Number(AGENT_ID), agentRegistry: AGENT_REGISTRY }],
    supportedTrust: ["reputation"],
    payments: {
      network: NETWORK,
      asset: BASE_USDC,
      assetSymbol: "USDC",
      amount: FORECAST_PRICE_USDC_ATOMS,
      decimals: 6,
      payTo: PAY_TO,
      scheme: "exact",
      assetTransferMethod: "eip3009",
    },
    reputation: {
      registry: `${NETWORK}:${REPUTATION_REGISTRY}`,
      endpoint: FORECAST_ENDPOINT,
      tags: ["quality:forecast", "latency:forecast", "settlement:x402"],
    },
  };
}

function domainRegistration(): Json {
  return {
    registrations: [{ agentId: Number(AGENT_ID), agentRegistry: AGENT_REGISTRY }],
    owner: process.env.ERC8004_OWNER_ADDRESS ?? "",
    agentURI: `${PUBLIC_ORIGIN}/agent-registration.json`,
  };
}

function agentCard(): Json {
  return {
    name: "Forecast Example",
    description: "Autonomous-agent weather forecasts paid per call with USDC on Base.",
    url: PUBLIC_ORIGIN,
    version: "1.0.0",
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    capabilities: { streaming: false, pushNotifications: false },
    skills: [
      {
        id: "weather.forecast",
        name: "Weather Forecast",
        description: "Returns a 1-10 day forecast for latitude and longitude.",
        tags: ["weather", "forecast"],
        examples: [`${FORECAST_ENDPOINT}?lat=40.7128&lon=-74.0060&days=5`],
        payment: paymentRequired(new URL(`${FORECAST_ENDPOINT}?lat=40.7128&lon=-74.0060&days=5`), "payment required"),
      },
    ],
    trust: {
      erc8004: {
        agentRegistry: AGENT_REGISTRY,
        agentId: AGENT_ID,
        reputationRegistry: `${NETWORK}:${REPUTATION_REGISTRY}`,
      },
    },
  };
}

function reputationInstructions(): Json {
  return {
    agentRegistry: AGENT_REGISTRY,
    agentId: AGENT_ID,
    reputationRegistry: `${NETWORK}:${REPUTATION_REGISTRY}`,
    contract: REPUTATION_REGISTRY,
    writeMethod: "giveFeedback(uint256 agentId,int128 value,uint8 valueDecimals,string tag1,string tag2,string endpoint,string feedbackURI,bytes32 feedbackHash)",
    endpoint: FORECAST_ENDPOINT,
    suggestedValues: {
      quality: { valueRange: "0-100", valueDecimals: 0, tag1: "quality", tag2: "forecast" },
      latencyMs: { valueDecimals: 0, tag1: "latency", tag2: "forecast" },
      settlement: { valueRange: "0-100", valueDecimals: 0, tag1: "settlement", tag2: "x402" },
    },
    gaslessOptions: [
      "Submit the ReputationRegistry transaction through an ERC-4337 or EIP-7702 wallet using a USDC paymaster.",
      "Use an independent feedback relayer that accepts a signed transaction or user operation and is not operated by forecast.example.com.",
    ],
  };
}

function openApiDocument(): Json {
  return {
    openapi: "3.1.0",
    info: { title: "Forecast Example", version: "1.0.0" },
    servers: [{ url: PUBLIC_ORIGIN }],
    paths: {
      "/v1/forecast": {
        get: {
          summary: "Paid weather forecast",
          parameters: [
            { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
            { name: "lon", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 10, default: 7 } },
          ],
          responses: {
            "200": {
              description: "Forecast after successful x402 settlement",
              headers: { "PAYMENT-RESPONSE": { schema: { type: "string" } } },
            },
            "402": {
              description: "x402 payment challenge",
              headers: { "PAYMENT-REQUIRED": { schema: { type: "string" } } },
            },
          },
        },
      },
    },
  };
}

function setCommonHeaders(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, payment-signature, x-payment");
  res.setHeader("access-control-expose-headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  res.setHeader("cache-control", "no-store");
}

function sendJson(res: ServerResponse, status: number, body: Json): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(body, null, 2)}\n`);
}

function encodeBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

function hashJson(value: unknown): string {
  return `0x${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function lower(value: unknown): unknown {
  return typeof value === "string" ? value.toLowerCase() : value;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
