import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Buffer } from "node:buffer";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_ORIGIN = trimTrailingSlash(process.env.PUBLIC_ORIGIN ?? "https://forecast.example.com");
const FACILITATOR_URL = trimTrailingSlash(process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator");

const BASE_NETWORK = "eip155:8453";
const BASE_CHAIN_ID = 8453;
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const FORECAST_PRICE_USDC_ATOMS = "350000";
const FORECAST_PRICE_USD = "0.35";
const MAX_PAYMENT_TIMEOUT_SECONDS = 120;

const ERC8004_IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const ERC8004_REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";

const AGENT_ID = process.env.ERC8004_AGENT_ID ?? "REGISTER_AGENT_AND_SET_ERC8004_AGENT_ID";
const PAY_TO = process.env.USDC_RECEIVER_ADDRESS ?? "0x0000000000000000000000000000000000000000";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type PaymentRequirements = {
  scheme: "exact";
  network: typeof BASE_NETWORK;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    name: "USD Coin";
    version: "2";
  };
};

type ResourceInfo = {
  url: string;
  description: string;
  mimeType: "application/json";
  serviceName: "forecast.example.com";
  tags: string[];
  iconUrl: string;
};

type PaymentRequired = {
  x402Version: 2;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
  extensions: Record<string, Json>;
};

type PaymentPayload = {
  x402Version: number;
  resource?: ResourceInfo;
  accepted: PaymentRequirements;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown>;
};

type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: string;
};

type SettleResponse = {
  success: boolean;
  errorReason?: string;
  errorMessage?: string;
  payer?: string;
  transaction: string;
  network: string;
  amount?: string;
};

type ForecastPoint = {
  latitude: number;
  longitude: number;
  current?: {
    time?: string;
    temperature_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
  daily?: Record<string, unknown>;
  hourly?: Record<string, unknown>;
};

const server = createServer(async (request, response) => {
  try {
    const url = requestUrl(request);

    if (request.method === "OPTIONS") {
      sendJson(response, 204, null, corsHeaders());
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true, service: "forecast.example.com" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/.well-known/agent-registration.json") {
      sendJson(response, 200, agentRegistration());
      return;
    }

    if (request.method === "GET" && url.pathname === "/.well-known/agent-card.json") {
      sendJson(response, 200, agentCard());
      return;
    }

    if (request.method === "GET" && url.pathname === "/forecast") {
      await handleForecast(url, request, response);
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal_server_error";
    sendJson(response, 500, { error: "internal_server_error", message });
  }
});

server.listen(PORT, () => {
  console.log(`forecast.example.com service listening on http://localhost:${PORT}`);
});

async function handleForecast(url: URL, request: IncomingMessage, response: ServerResponse) {
  const paymentRequired = buildPaymentRequired(url);
  const paymentPayload = readPaymentPayload(request);

  if (!paymentPayload) {
    sendPaymentRequired(response, paymentRequired);
    return;
  }

  if (!paymentPayloadMatches(paymentPayload, paymentRequired.accepts[0])) {
    sendPaymentRequired(response, {
      ...paymentRequired,
      error: "The X-PAYMENT payload does not match this resource's USDC/Base payment requirements.",
    });
    return;
  }

  const verification = await facilitatorPost<VerifyResponse>("verify", {
    x402Version: 2,
    paymentPayload,
    paymentRequirements: paymentRequired.accepts[0],
  });

  if (!verification.isValid) {
    sendPaymentRequired(response, {
      ...paymentRequired,
      error: verification.invalidMessage ?? verification.invalidReason ?? "Payment was not valid.",
    });
    return;
  }

  const forecast = await fetchForecastForResponse(url, response);
  if (!forecast) return;

  const settlement = await facilitatorPost<SettleResponse>("settle", {
    x402Version: 2,
    paymentPayload,
    paymentRequirements: paymentRequired.accepts[0],
  });

  if (!settlement.success) {
    sendJson(response, 402, {
      error: "payment_settlement_failed",
      reason: settlement.errorReason,
      message: settlement.errorMessage,
    });
    return;
  }

  sendJson(
    response,
    200,
    {
      service: "forecast.example.com",
      price: {
        amount: FORECAST_PRICE_USDC_ATOMS,
        decimals: 6,
        display: `${FORECAST_PRICE_USD} USDC`,
        asset: BASE_USDC,
        network: BASE_NETWORK,
      },
      payment: {
        payer: settlement.payer ?? verification.payer,
        transaction: settlement.transaction,
        network: settlement.network,
        amount: settlement.amount ?? FORECAST_PRICE_USDC_ATOMS,
      },
      forecast,
      feedback: feedbackInstructions(url, settlement.transaction),
    },
    {
      "X-PAYMENT-RESPONSE": encodeHeaderJson(settlement),
      "PAYMENT-RESPONSE": encodeHeaderJson(settlement),
    },
  );
}

function buildPaymentRequired(url: URL): PaymentRequired {
  const resource: ResourceInfo = {
    url: `${PUBLIC_ORIGIN}${url.pathname}${url.search}`,
    description: "Machine-readable weather forecast from forecast.example.com.",
    mimeType: "application/json",
    serviceName: "forecast.example.com",
    tags: ["weather", "forecast", "x402", "erc-8004"],
    iconUrl: `${PUBLIC_ORIGIN}/icon.png`,
  };

  return {
    x402Version: 2,
    resource,
    accepts: [
      {
        scheme: "exact",
        network: BASE_NETWORK,
        amount: FORECAST_PRICE_USDC_ATOMS,
        asset: BASE_USDC,
        payTo: PAY_TO,
        maxTimeoutSeconds: MAX_PAYMENT_TIMEOUT_SECONDS,
        extra: {
          name: "USD Coin",
          version: "2",
        },
      },
    ],
    extensions: {
      erc8004: {
        agentId: AGENT_ID,
        identityRegistry: `${BASE_NETWORK}:${ERC8004_IDENTITY_REGISTRY}`,
        reputationRegistry: `${BASE_NETWORK}:${ERC8004_REPUTATION_REGISTRY}`,
      },
      feedback: feedbackInstructions(url),
    },
  };
}

function agentRegistration(): Json {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "forecast.example.com",
    description: "An autonomous-agent weather forecast service charging 0.35 USDC per forecast on Base using x402.",
    image: `${PUBLIC_ORIGIN}/icon.png`,
    active: true,
    services: [
      {
        type: "https://google.github.io/A2A/specification/#agent-card",
        uri: `${PUBLIC_ORIGIN}/.well-known/agent-card.json`,
      },
      {
        type: "https://x402.org/resource",
        uri: `${PUBLIC_ORIGIN}/forecast`,
        method: "GET",
        accepts: "application/json",
      },
    ],
    x402Support: {
      versions: [2],
      schemes: ["exact"],
      network: BASE_NETWORK,
      asset: BASE_USDC,
      assetSymbol: "USDC",
      assetDecimals: 6,
      price: FORECAST_PRICE_USDC_ATOMS,
      payTo: PAY_TO,
      noEthRequired: "USDC on Base supports EIP-3009 transferWithAuthorization; the facilitator submits settlement gas.",
    },
    registrations: [
      {
        agentId: AGENT_ID,
        agentRegistry: `${BASE_NETWORK}:${ERC8004_IDENTITY_REGISTRY}`,
      },
    ],
    supportedTrust: {
      reputation: [
        {
          registry: `${BASE_NETWORK}:${ERC8004_REPUTATION_REGISTRY}`,
          tags: ["weather-forecast", "quality"],
          feedbackMethod: "giveFeedback(agentId,value,valueDecimals,tag1,tag2,endpoint,feedbackURI,feedbackHash)",
        },
      ],
    },
  };
}

function agentCard(): Json {
  return {
    name: "forecast.example.com",
    description: "Paid weather forecasts for autonomous agents.",
    url: PUBLIC_ORIGIN,
    version: "1.0.0",
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "weather-forecast",
        name: "Weather forecast",
        description: "Returns current and short-range forecast data for latitude/longitude requests.",
        tags: ["weather", "forecast"],
        examples: [`${PUBLIC_ORIGIN}/forecast?lat=40.7128&lon=-74.0060&days=3`],
      },
    ],
    provider: {
      organization: "forecast.example.com",
      url: PUBLIC_ORIGIN,
    },
    extensions: {
      x402: buildPaymentRequired(new URL(`${PUBLIC_ORIGIN}/forecast`)),
      erc8004: {
        agentId: AGENT_ID,
        identityRegistry: `${BASE_NETWORK}:${ERC8004_IDENTITY_REGISTRY}`,
        reputationRegistry: `${BASE_NETWORK}:${ERC8004_REPUTATION_REGISTRY}`,
      },
    },
  };
}

function feedbackInstructions(url: URL, transaction?: string): Json {
  return {
    standard: "ERC-8004 ReputationRegistry",
    registry: `${BASE_NETWORK}:${ERC8004_REPUTATION_REGISTRY}`,
    method: "giveFeedback",
    agentId: AGENT_ID,
    endpoint: `${PUBLIC_ORIGIN}${url.pathname}`,
    suggestedTags: {
      tag1: "weather-forecast",
      tag2: "quality",
    },
    value: {
      description: "Caller-chosen quality score from 0 to 100.",
      decimals: 0,
    },
    feedbackURI: "Caller may publish details to ipfs://, https://, or data: and pass that URI.",
    feedbackHash: "Hash of the published feedback body, or 0x0 when no body is published.",
    ...(transaction ? { settlementTransaction: transaction } : {}),
  };
}

async function fetchForecast(url: URL): Promise<ForecastPoint> {
  const latitude = parseCoordinate(url.searchParams.get("lat"), "lat", -90, 90);
  const longitude = parseCoordinate(url.searchParams.get("lon"), "lon", -180, 180);
  const days = parseInteger(url.searchParams.get("days") ?? "3", "days", 1, 7);

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", String(latitude));
  weatherUrl.searchParams.set("longitude", String(longitude));
  weatherUrl.searchParams.set("forecast_days", String(days));
  weatherUrl.searchParams.set("current", "temperature_2m,wind_speed_10m,weather_code");
  weatherUrl.searchParams.set("hourly", "temperature_2m,precipitation_probability");
  weatherUrl.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  weatherUrl.searchParams.set("timezone", "auto");

  const upstream = await fetch(weatherUrl, {
    headers: { "User-Agent": "forecast.example.com autonomous-agent-service" },
  });

  if (!upstream.ok) {
    throw new Error(`weather_upstream_failed:${upstream.status}`);
  }

  return (await upstream.json()) as ForecastPoint;
}

async function fetchForecastForResponse(url: URL, response: ServerResponse): Promise<ForecastPoint | null> {
  try {
    return await fetchForecast(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "forecast_failed";
    if (message.startsWith("missing_") || message.startsWith("invalid_")) {
      sendJson(response, 400, { error: message });
      return null;
    }

    if (message.startsWith("weather_upstream_failed:")) {
      sendJson(response, 502, { error: "weather_upstream_failed" });
      return null;
    }

    throw error;
  }
}

async function facilitatorPost<T>(path: "verify" | "settle", body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${FACILITATOR_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`x402_facilitator_${path}_failed:${response.status}:${JSON.stringify(payload)}`);
  }
  return payload as T;
}

function readPaymentPayload(request: IncomingMessage): PaymentPayload | null {
  const value = headerValue(request, "x-payment") ?? headerValue(request, "payment-signature");
  if (!value) return null;

  const decoded = decodeHeaderJson(value);
  if (!isPaymentPayload(decoded)) {
    throw new Error("invalid_x_payment_header");
  }
  return decoded;
}

function paymentPayloadMatches(payment: PaymentPayload, requirements: PaymentRequirements): boolean {
  return (
    payment.x402Version === 2 &&
    payment.accepted.scheme === requirements.scheme &&
    payment.accepted.network === requirements.network &&
    payment.accepted.amount === requirements.amount &&
    payment.accepted.asset.toLowerCase() === requirements.asset.toLowerCase() &&
    payment.accepted.payTo.toLowerCase() === requirements.payTo.toLowerCase()
  );
}

function isPaymentPayload(value: unknown): value is PaymentPayload {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Partial<PaymentPayload>;
  return (
    typeof maybe.x402Version === "number" &&
    typeof maybe.payload === "object" &&
    !!maybe.accepted &&
    typeof maybe.accepted === "object"
  );
}

function sendPaymentRequired(response: ServerResponse, body: PaymentRequired) {
  sendJson(response, 402, body, {
    "Cache-Control": "private, no-store",
    "PAYMENT-REQUIRED": encodeHeaderJson(body),
    "WWW-Authenticate": "x402",
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(),
    ...headers,
  });
  response.end(status === 204 ? undefined : JSON.stringify(body, null, 2));
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-PAYMENT, PAYMENT-SIGNATURE",
    "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, X-PAYMENT-RESPONSE, PAYMENT-RESPONSE",
  };
}

function requestUrl(request: IncomingMessage): URL {
  const host = request.headers.host ?? new URL(PUBLIC_ORIGIN).host;
  return new URL(request.url ?? "/", `${PUBLIC_ORIGIN.startsWith("https://") ? "https" : "http"}://${host}`);
}

function headerValue(request: IncomingMessage, name: string): string | null {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function decodeHeaderJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  }
}

function encodeHeaderJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseCoordinate(raw: string | null, name: string, min: number, max: number): number {
  if (raw == null) throw new Error(`missing_${name}`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`invalid_${name}`);
  }
  return value;
}

function parseInteger(raw: string, name: string, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`invalid_${name}`);
  }
  return value;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
