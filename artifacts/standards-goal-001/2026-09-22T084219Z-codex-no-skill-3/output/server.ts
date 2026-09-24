import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { Buffer } from "node:buffer";

type JsonObject = Record<string, unknown>;

type PaymentRequirements = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    name: string;
    version: string;
    assetTransferMethod: "eip3009";
    paymentFlow: "authorization";
  };
};

type PaymentPayload = {
  x402Version: number;
  resource?: JsonObject;
  accepted?: PaymentRequirements;
  payload?: JsonObject;
  extensions?: JsonObject;
};

type ForecastRequest = {
  latitude?: number;
  longitude?: number;
  location?: string;
  days?: number;
  units?: "metric" | "imperial";
};

const X402_VERSION = 2;
const BASE_NETWORK = "eip155:8453";
const BASE_CHAIN_ID = 8453;
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRICE_ATOMIC_USDC = "350000";
const DEFAULT_PAY_TO = "0xf0eeca57f0eeca57f0eeca57f0eeca57f0eeca57";
const GIVE_FEEDBACK_SELECTOR = "3c036a7e";

const config = {
  port: Number(process.env.PORT ?? 3000),
  publicBaseUrl: normalizeBaseUrl(process.env.PUBLIC_BASE_URL ?? "https://forecast.example.com"),
  payTo: process.env.PAY_TO ?? DEFAULT_PAY_TO,
  facilitatorUrl: normalizeBaseUrl(process.env.FACILITATOR_URL ?? "http://127.0.0.1:4022"),
  facilitatorApiKey: process.env.FACILITATOR_API_KEY,
  agentId: BigInt(process.env.ERC8004_AGENT_ID ?? "0"),
  identityRegistry: process.env.ERC8004_IDENTITY_REGISTRY ?? "0x0000000000000000000000000000000000000000",
  reputationRegistry: process.env.ERC8004_REPUTATION_REGISTRY ?? "0x0000000000000000000000000000000000000000",
  feedbackPaymasterUrl: process.env.FEEDBACK_PAYMASTER_URL ?? "https://paymaster.example.com/base",
  weatherApiUrl: normalizeBaseUrl(process.env.WEATHER_API_URL ?? "https://api.open-meteo.com/v1/forecast"),
  geocodingApiUrl: normalizeBaseUrl(process.env.GEOCODING_API_URL ?? "https://geocoding-api.open-meteo.com/v1/search"),
};

const app = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    json(res, 500, {
      error: "server_error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(config.port, () => {
  console.log(`forecast service listening on http://localhost:${config.port}`);
});

async function route(req: IncomingMessage, res: ServerResponse) {
  setCommonHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", config.publicBaseUrl);

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true, service: "forecast.example.com" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    json(res, 200, serviceIndex());
    return;
  }

  if (req.method === "GET" && url.pathname === "/.well-known/agent-registration.json") {
    json(res, 200, agentRegistration());
    return;
  }

  if (req.method === "GET" && url.pathname === "/.well-known/agent-card.json") {
    json(res, 200, agentCard());
    return;
  }

  if (req.method === "GET" && url.pathname === "/openapi.json") {
    json(res, 200, openApiDocument());
    return;
  }

  if (req.method === "GET" && url.pathname === "/discovery/resources") {
    json(res, 200, x402DiscoveryResources());
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/feedback") {
    const body = await readJson(req);
    handleFeedbackPreparation(res, body);
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/forecast") {
    const body = await readJson(req);
    const request = parseForecastRequest(body);

    if (!request.ok) {
      json(res, 400, { error: "invalid_forecast_request", detail: request.error });
      return;
    }

    await handlePaidForecast(req, res, request.value);
    return;
  }

  json(res, 404, { error: "not_found" });
}

async function handlePaidForecast(req: IncomingMessage, res: ServerResponse, request: ForecastRequest) {
  const resource = forecastResource();
  const requirements = forecastPaymentRequirements();
  const paymentHeader = getHeader(req, "payment-signature") ?? getHeader(req, "x-payment");

  if (!paymentHeader) {
    sendPaymentRequired(res, "PAYMENT-SIGNATURE header is required");
    return;
  }

  const paymentPayload = parseBase64Json<PaymentPayload>(paymentHeader);
  if (!paymentPayload.ok) {
    json(res, 400, { error: "invalid_payload", detail: paymentPayload.error });
    return;
  }

  const localValidation = validatePaymentPayload(paymentPayload.value, requirements, resource);
  if (!localValidation.ok) {
    sendPaymentRequired(res, localValidation.error);
    return;
  }

  const envelope = {
    x402Version: X402_VERSION,
    paymentPayload: paymentPayload.value,
    paymentRequirements: requirements,
  };

  const verify = await facilitatorPost("/verify", envelope);
  if (verify.isValid !== true) {
    sendPaymentRequired(res, String(verify.invalidReason ?? "payment_not_valid"), {
      success: false,
      errorReason: verify.invalidReason ?? "payment_not_valid",
      transaction: "",
      network: BASE_NETWORK,
      payer: verify.payer,
    });
    return;
  }

  const forecast = await fetchForecast(request);
  const settlement = await facilitatorPost("/settle", envelope);

  res.setHeader("PAYMENT-RESPONSE", toBase64Json(settlement));

  if (settlement.success !== true) {
    json(res, 402, {
      error: "settlement_failed",
      reason: settlement.errorReason ?? "unknown",
      transaction: settlement.transaction ?? "",
      network: settlement.network ?? BASE_NETWORK,
    });
    return;
  }

  json(res, 200, {
    service: "forecast.example.com",
    price: { amount: "0.35", asset: "USDC", network: BASE_NETWORK },
    payment: {
      transaction: settlement.transaction,
      payer: settlement.payer ?? verify.payer,
      network: settlement.network ?? BASE_NETWORK,
    },
    forecast,
    feedback: feedbackInstructions(settlement.transaction, settlement.payer ?? verify.payer),
  });
}

function sendPaymentRequired(res: ServerResponse, error: string, paymentResponse?: JsonObject) {
  const required = {
    x402Version: X402_VERSION,
    error,
    resource: forecastResource(),
    accepts: [forecastPaymentRequirements()],
    extensions: {
      erc8004: {
        info: {
          agentRegistry: agentRegistryId(),
          agentId: config.agentId.toString(),
          reputationRegistry: `${BASE_NETWORK}:${config.reputationRegistry}`,
          feedbackEndpoint: `${config.publicBaseUrl}/v1/feedback`,
        },
        schema: {
          type: "object",
          required: ["agentRegistry", "agentId", "reputationRegistry", "feedbackEndpoint"],
        },
      },
    },
  };

  res.setHeader("PAYMENT-REQUIRED", toBase64Json(required));
  if (paymentResponse) {
    res.setHeader("PAYMENT-RESPONSE", toBase64Json(paymentResponse));
  }
  json(res, 402, required);
}

function validatePaymentPayload(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  resource: JsonObject,
): { ok: true } | { ok: false; error: string } {
  if (payload.x402Version !== X402_VERSION) {
    return { ok: false, error: "invalid_x402_version" };
  }

  if (!payload.accepted || stableJson(payload.accepted) !== stableJson(requirements)) {
    return { ok: false, error: "payment_requirements_mismatch" };
  }

  if (payload.resource?.url !== resource.url) {
    return { ok: false, error: "resource_url_mismatch" };
  }

  const authorization = payload.payload?.authorization as JsonObject | undefined;
  if (authorization) {
    if (!sameAddress(String(authorization.to ?? ""), requirements.payTo)) {
      return { ok: false, error: "authorization_recipient_mismatch" };
    }

    if (String(authorization.value ?? "") !== requirements.amount) {
      return { ok: false, error: "authorization_value_mismatch" };
    }
  }

  return { ok: true };
}

async function facilitatorPost(path: "/verify" | "/settle", body: JsonObject): Promise<JsonObject> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.facilitatorApiKey) {
    headers.authorization = `Bearer ${config.facilitatorApiKey}`;
  }

  const response = await fetch(`${config.facilitatorUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`facilitator ${path} failed: ${response.status} ${JSON.stringify(responseBody)}`);
  }

  return responseBody;
}

async function fetchForecast(request: ForecastRequest) {
  const coordinates = await resolveCoordinates(request);
  const days = request.days ?? 3;
  const units = request.units ?? "metric";
  const temperatureUnit = units === "imperial" ? "fahrenheit" : "celsius";
  const windSpeedUnit = units === "imperial" ? "mph" : "kmh";
  const forecastUrl = new URL(config.weatherApiUrl);

  forecastUrl.searchParams.set("latitude", String(coordinates.latitude));
  forecastUrl.searchParams.set("longitude", String(coordinates.longitude));
  forecastUrl.searchParams.set("forecast_days", String(days));
  forecastUrl.searchParams.set("timezone", "auto");
  forecastUrl.searchParams.set("temperature_unit", temperatureUnit);
  forecastUrl.searchParams.set("wind_speed_unit", windSpeedUnit);
  forecastUrl.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
  );

  const response = await fetchWithTimeout(forecastUrl, 8_000);
  if (!response.ok) {
    throw new Error(`weather provider failed with ${response.status}`);
  }

  const data = (await response.json()) as JsonObject;
  const daily = data.daily as Record<string, unknown[]> | undefined;
  if (!daily?.time) {
    throw new Error("weather provider returned an unexpected payload");
  }

  const rows = daily.time.map((date, index) => ({
    date,
    weatherCode: daily.weather_code?.[index],
    temperatureMax: daily.temperature_2m_max?.[index],
    temperatureMin: daily.temperature_2m_min?.[index],
    precipitationProbability: daily.precipitation_probability_max?.[index],
    windSpeedMax: daily.wind_speed_10m_max?.[index],
  }));

  return {
    provider: "open-meteo",
    location: coordinates,
    units,
    generatedAt: new Date().toISOString(),
    days: rows,
  };
}

async function resolveCoordinates(request: ForecastRequest) {
  if (typeof request.latitude === "number" && typeof request.longitude === "number") {
    return {
      latitude: request.latitude,
      longitude: request.longitude,
      label: request.location ?? `${request.latitude},${request.longitude}`,
    };
  }

  if (!request.location) {
    throw new Error("location or latitude/longitude is required");
  }

  const url = new URL(config.geocodingApiUrl);
  url.searchParams.set("name", request.location);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetchWithTimeout(url, 8_000);
  if (!response.ok) {
    throw new Error(`geocoding provider failed with ${response.status}`);
  }

  const data = (await response.json()) as { results?: Array<Record<string, unknown>> };
  const first = data.results?.[0];
  if (typeof first?.latitude !== "number" || typeof first.longitude !== "number") {
    throw new Error("location could not be geocoded");
  }

  return {
    latitude: first.latitude,
    longitude: first.longitude,
    label: [first.name, first.admin1, first.country].filter(Boolean).join(", "),
  };
}

async function fetchWithTimeout(url: URL, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function handleFeedbackPreparation(res: ServerResponse, body: unknown) {
  const rating = parseFeedbackRequest(body);
  if (!rating.ok) {
    json(res, 400, { error: "invalid_feedback_request", detail: rating.error });
    return;
  }

  const endpoint = rating.value.endpoint ?? `${config.publicBaseUrl}/v1/forecast`;
  const feedbackHash = rating.value.feedbackHash ?? zeroBytes32();
  const args = [
    config.agentId,
    BigInt(rating.value.value),
    BigInt(rating.value.valueDecimals),
    rating.value.tag1 ?? "starred",
    rating.value.tag2 ?? "",
    endpoint,
    rating.value.feedbackURI ?? "",
    feedbackHash,
  ] as const;

  json(res, 200, {
    type: "erc8004.feedback.prepare",
    agentRegistry: agentRegistryId(),
    agentId: config.agentId.toString(),
    reputationRegistry: `${BASE_NETWORK}:${config.reputationRegistry}`,
    transaction: {
      chainId: BASE_CHAIN_ID,
      to: config.reputationRegistry,
      value: "0",
      function: "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
      args: args.map((arg) => (typeof arg === "bigint" ? arg.toString() : arg)),
      data: encodeGiveFeedback(...args),
    },
    gas: {
      ethRequiredFromCaller: false,
      submitWith: "EIP-7702 or ERC-4337 smart account using a Base paymaster/bundler",
      paymasterUrl: config.feedbackPaymasterUrl,
    },
  });
}

function parseForecastRequest(body: unknown): { ok: true; value: ForecastRequest } | { ok: false; error: string } {
  if (!isObject(body)) {
    return { ok: false, error: "body must be a JSON object" };
  }

  const days = body.days === undefined ? 3 : Number(body.days);
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    return { ok: false, error: "days must be an integer from 1 to 7" };
  }

  const units = body.units === undefined ? "metric" : body.units;
  if (units !== "metric" && units !== "imperial") {
    return { ok: false, error: "units must be metric or imperial" };
  }

  const hasLatitude = body.latitude !== undefined;
  const hasLongitude = body.longitude !== undefined;
  const latitude = hasLatitude ? Number(body.latitude) : undefined;
  const longitude = hasLongitude ? Number(body.longitude) : undefined;

  if (hasLatitude !== hasLongitude) {
    return { ok: false, error: "latitude and longitude must be provided together" };
  }

  if (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    return { ok: false, error: "latitude must be between -90 and 90" };
  }

  if (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    return { ok: false, error: "longitude must be between -180 and 180" };
  }

  const location = typeof body.location === "string" ? body.location.trim() : undefined;
  if (latitude === undefined && !location) {
    return { ok: false, error: "provide either location or latitude/longitude" };
  }

  return { ok: true, value: { latitude, longitude, location, days, units } };
}

function parseFeedbackRequest(body: unknown) {
  if (!isObject(body)) {
    return { ok: false as const, error: "body must be a JSON object" };
  }

  const value = Number(body.value);
  const valueDecimals = body.valueDecimals === undefined ? 0 : Number(body.valueDecimals);

  if (!Number.isInteger(value) || value < 0 || value > 100) {
    return { ok: false as const, error: "value must be an integer from 0 to 100" };
  }

  if (!Number.isInteger(valueDecimals) || valueDecimals < 0 || valueDecimals > 18) {
    return { ok: false as const, error: "valueDecimals must be an integer from 0 to 18" };
  }

  const feedbackHash = body.feedbackHash === undefined ? undefined : String(body.feedbackHash);
  if (feedbackHash !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(feedbackHash)) {
    return { ok: false as const, error: "feedbackHash must be bytes32 hex" };
  }

  return {
    ok: true as const,
    value: {
      value,
      valueDecimals,
      tag1: optionalString(body.tag1),
      tag2: optionalString(body.tag2),
      endpoint: optionalString(body.endpoint),
      feedbackURI: optionalString(body.feedbackURI),
      feedbackHash,
    },
  };
}

function forecastResource() {
  return {
    url: `${config.publicBaseUrl}/v1/forecast`,
    description: "Weather forecast for a requested place or latitude/longitude.",
    mimeType: "application/json",
    serviceName: "Forecast Example",
    tags: ["weather", "forecast", "x402"],
    iconUrl: `${config.publicBaseUrl}/icon.png`,
  };
}

function forecastPaymentRequirements(): PaymentRequirements {
  return {
    scheme: "exact",
    network: BASE_NETWORK,
    amount: PRICE_ATOMIC_USDC,
    asset: USDC_BASE,
    payTo: config.payTo,
    maxTimeoutSeconds: 60,
    extra: {
      name: "USDC",
      version: "2",
      assetTransferMethod: "eip3009",
      paymentFlow: "authorization",
    },
  };
}

function serviceIndex() {
  return {
    service: "forecast.example.com",
    description: "Machine-native weather forecasts, paid per request with x402 USDC on Base.",
    price: { amount: "0.35", atomicAmount: PRICE_ATOMIC_USDC, asset: USDC_BASE, network: BASE_NETWORK },
    links: {
      agentRegistration: `${config.publicBaseUrl}/.well-known/agent-registration.json`,
      agentCard: `${config.publicBaseUrl}/.well-known/agent-card.json`,
      openapi: `${config.publicBaseUrl}/openapi.json`,
      x402Resources: `${config.publicBaseUrl}/discovery/resources`,
      feedback: `${config.publicBaseUrl}/v1/feedback`,
    },
    erc8004: {
      agentRegistry: agentRegistryId(),
      agentId: config.agentId.toString(),
      reputationRegistry: `${BASE_NETWORK}:${config.reputationRegistry}`,
    },
  };
}

function agentRegistration() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "forecast.example.com",
    description:
      "Weather forecast service for autonomous agents. Each forecast call costs 0.35 USDC on Base through x402 exact/EIP-3009. No accounts, API keys, subscriptions, invoices, or custodial balances.",
    image: `${config.publicBaseUrl}/icon.png`,
    services: [
      { name: "web", endpoint: config.publicBaseUrl },
      { name: "A2A", endpoint: `${config.publicBaseUrl}/.well-known/agent-card.json`, version: "0.3.0" },
      { name: "OpenAPI", endpoint: `${config.publicBaseUrl}/openapi.json`, version: "3.1.0" },
      { name: "x402", endpoint: `${config.publicBaseUrl}/discovery/resources`, version: "2" },
      { name: "HTTP", endpoint: `${config.publicBaseUrl}/v1/forecast`, version: "1" },
      { name: "ERC8004Feedback", endpoint: `${config.publicBaseUrl}/v1/feedback`, version: "1" },
    ],
    x402Support: true,
    active: true,
    registrations: [{ agentId: jsonAgentId(), agentRegistry: agentRegistryId() }],
    supportedTrust: ["reputation"],
  };
}

function agentCard() {
  return {
    protocolVersion: "0.3.0",
    name: "forecast.example.com",
    description: "Paid weather forecast tool for autonomous agents.",
    url: config.publicBaseUrl,
    version: "1.0.0",
    provider: { organization: "forecast.example.com", url: config.publicBaseUrl },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    skills: [
      {
        id: "weather.forecast.x402",
        name: "Weather forecast",
        description: "Return a 1-7 day forecast for a location or coordinates after x402 payment.",
        tags: ["weather", "forecast", "x402", "USDC", "Base"],
        examples: ["POST /v1/forecast {\"location\":\"Tbilisi\",\"days\":3,\"units\":\"metric\"}"],
      },
    ],
    payments: {
      protocol: "x402",
      version: 2,
      accepts: [forecastPaymentRequirements()],
    },
    trust: {
      protocol: "ERC-8004",
      agentRegistry: agentRegistryId(),
      agentId: config.agentId.toString(),
      reputationRegistry: `${BASE_NETWORK}:${config.reputationRegistry}`,
    },
  };
}

function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: { title: "forecast.example.com", version: "1.0.0" },
    servers: [{ url: config.publicBaseUrl }],
    paths: {
      "/v1/forecast": {
        post: {
          summary: "Buy one weather forecast",
          description: "Requires x402 v2 payment of 0.35 USDC on Base.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    location: { type: "string" },
                    latitude: { type: "number", minimum: -90, maximum: 90 },
                    longitude: { type: "number", minimum: -180, maximum: 180 },
                    days: { type: "integer", minimum: 1, maximum: 7, default: 3 },
                    units: { enum: ["metric", "imperial"], default: "metric" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Forecast returned. PAYMENT-RESPONSE header contains settlement proof." },
            "402": { description: "PAYMENT-REQUIRED header contains x402 payment requirements." },
          },
        },
      },
      "/v1/feedback": {
        post: {
          summary: "Prepare an ERC-8004 feedback transaction",
          responses: { "200": { description: "Unsigned giveFeedback transaction data." } },
        },
      },
    },
  };
}

function x402DiscoveryResources() {
  return {
    x402Version: X402_VERSION,
    items: [
      {
        resource: `${config.publicBaseUrl}/v1/forecast`,
        type: "http",
        x402Version: X402_VERSION,
        accepts: [forecastPaymentRequirements()],
        lastUpdated: new Date().toISOString(),
        extensions: {
          erc8004: {
            agentRegistry: agentRegistryId(),
            agentId: config.agentId.toString(),
            reputationRegistry: `${BASE_NETWORK}:${config.reputationRegistry}`,
          },
        },
      },
    ],
    pagination: { limit: 20, offset: 0, total: 1 },
  };
}

function feedbackInstructions(transaction?: unknown, payer?: unknown) {
  return {
    endpoint: `${config.publicBaseUrl}/v1/feedback`,
    onchainRegistry: `${BASE_NETWORK}:${config.reputationRegistry}`,
    method: "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
    suggestedBody: {
      value: 100,
      valueDecimals: 0,
      tag1: "starred",
      tag2: "forecast",
      endpoint: `${config.publicBaseUrl}/v1/forecast`,
      feedbackURI: "",
      feedbackHash: zeroBytes32(),
      proofOfPayment: { transaction, payer, network: BASE_NETWORK },
    },
  };
}

function encodeGiveFeedback(
  agentId: bigint,
  value: bigint,
  valueDecimals: bigint,
  tag1: string,
  tag2: string,
  endpoint: string,
  feedbackURI: string,
  feedbackHash: string,
) {
  return (
    "0x" +
    GIVE_FEEDBACK_SELECTOR +
    abiEncode([
      { type: "uint256", value: agentId },
      { type: "int128", value },
      { type: "uint8", value: valueDecimals },
      { type: "string", value: tag1 },
      { type: "string", value: tag2 },
      { type: "string", value: endpoint },
      { type: "string", value: feedbackURI },
      { type: "bytes32", value: feedbackHash },
    ])
  );
}

function abiEncode(args: Array<{ type: string; value: bigint | string }>) {
  const head: string[] = [];
  const tail: string[] = [];
  let dynamicOffset = BigInt(args.length * 32);

  for (const arg of args) {
    if (arg.type === "string") {
      const encoded = encodeString(String(arg.value));
      head.push(uint256(dynamicOffset));
      tail.push(encoded);
      dynamicOffset += BigInt(encoded.length / 2);
    } else if (arg.type === "uint256" || arg.type === "uint8") {
      head.push(uint256(BigInt(arg.value)));
    } else if (arg.type === "int128") {
      head.push(int256(BigInt(arg.value)));
    } else if (arg.type === "bytes32") {
      const value = String(arg.value).replace(/^0x/, "");
      if (!/^[0-9a-fA-F]{64}$/.test(value)) {
        throw new Error("invalid bytes32 value");
      }
      head.push(value.toLowerCase());
    } else {
      throw new Error(`unsupported abi type ${arg.type}`);
    }
  }

  return [...head, ...tail].join("");
}

function encodeString(value: string) {
  const bytes = Buffer.from(value, "utf8");
  const padding = (32 - (bytes.length % 32)) % 32;
  return uint256(BigInt(bytes.length)) + bytes.toString("hex") + "00".repeat(padding);
}

function uint256(value: bigint) {
  if (value < 0n) {
    throw new Error("uint cannot be negative");
  }
  return value.toString(16).padStart(64, "0");
}

function int256(value: bigint) {
  const encoded = value < 0n ? (1n << 256n) + value : value;
  return encoded.toString(16).padStart(64, "0");
}

function agentRegistryId() {
  return `${BASE_NETWORK}:${config.identityRegistry}`;
}

function jsonAgentId() {
  return config.agentId <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(config.agentId) : config.agentId.toString();
}

function zeroBytes32() {
  return `0x${"00".repeat(32)}`;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) {
      throw new Error("request body too large");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(body, bigintReplacer, 2)}\n`);
}

function setCommonHeaders(res: ServerResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,payment-signature,x-payment");
}

function getHeader(req: IncomingMessage, name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function toBase64Json(value: unknown) {
  return Buffer.from(JSON.stringify(value, bigintReplacer), "utf8").toString("base64");
}

function parseBase64Json<T>(value: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}
