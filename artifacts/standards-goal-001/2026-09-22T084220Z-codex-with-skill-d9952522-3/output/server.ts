import { createHash, randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

const X402_VERSION = 2;
const BASE_CHAIN = "eip155:8453";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRICE_USDC_ATOMIC = "350000";
const PAYMENT_TIMEOUT_SECONDS = 300;

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const AGENT_REGISTRY_REF = `${BASE_CHAIN}:${IDENTITY_REGISTRY}`;

type JsonRecord = Record<string, unknown>;

type ResourceInfo = {
  url: string;
  description: string;
  mimeType: string;
  serviceName: string;
  tags: string[];
  iconUrl: string;
};

type PaymentRequirements = {
  scheme: "exact";
  network: typeof BASE_CHAIN;
  amount: typeof PRICE_USDC_ATOMIC;
  asset: typeof BASE_USDC;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    name: "USD Coin";
    version: "2";
    assetTransferMethod: "eip3009";
    paymentFlow: "authorization";
  };
};

type PaymentRequired = {
  x402Version: typeof X402_VERSION;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
  extensions: JsonRecord;
};

type PaymentEnvelope = {
  x402Version: typeof X402_VERSION;
  paymentPayload: JsonRecord;
  paymentRequirements: PaymentRequirements;
};

type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
};

type SettleResponse = {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: string;
  amount?: string;
  extensions?: JsonRecord;
};

const config = {
  port: Number(process.env.PORT ?? 3000),
  baseUrl: trimTrailingSlash(process.env.BASE_URL ?? "https://forecast.example.com"),
  payTo: process.env.PAY_TO ?? "",
  facilitatorUrl: trimTrailingSlash(
    process.env.X402_FACILITATOR_URL ?? "https://api.cdp.coinbase.com/platform/v2/x402",
  ),
  agentId: process.env.ERC8004_AGENT_ID ?? "",
  weatherProviderUrl: trimTrailingSlash(
    process.env.WEATHER_PROVIDER_URL ?? "https://api.open-meteo.com/v1/forecast",
  ),
};

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function encodeHeaderJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function decodeHeaderJson(headerValue: string): JsonRecord {
  const decoded = Buffer.from(headerValue, "base64").toString("utf8");
  const parsed = JSON.parse(decoded);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("payment payload must be a JSON object");
  }

  return parsed as JsonRecord;
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body, null, 2));
}

function sendMethodNotAllowed(res: ServerResponse, allow: string): void {
  sendJson(res, 405, { error: "method_not_allowed" }, { allow });
}

function getRequestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? "/", config.baseUrl);
}

function canonicalResourceUrl(req: IncomingMessage): string {
  const url = getRequestUrl(req);
  return `${config.baseUrl}${url.pathname}${url.search}`;
}

function buildResourceInfo(req: IncomingMessage): ResourceInfo {
  return {
    url: canonicalResourceUrl(req),
    description: "Machine-readable weather forecast from forecast.example.com",
    mimeType: "application/json",
    serviceName: "Forecast Example",
    tags: ["weather", "forecast", "x402", "base"],
    iconUrl: `${config.baseUrl}/icon.png`,
  };
}

function buildPaymentRequirements(): PaymentRequirements {
  return {
    scheme: "exact",
    network: BASE_CHAIN,
    amount: PRICE_USDC_ATOMIC,
    asset: BASE_USDC,
    payTo: config.payTo,
    maxTimeoutSeconds: PAYMENT_TIMEOUT_SECONDS,
    extra: {
      name: "USD Coin",
      version: "2",
      assetTransferMethod: "eip3009",
      paymentFlow: "authorization",
    },
  };
}

function buildPaymentRequired(req: IncomingMessage, error?: string): PaymentRequired {
  return {
    x402Version: X402_VERSION,
    error,
    resource: buildResourceInfo(req),
    accepts: [buildPaymentRequirements()],
    extensions: {},
  };
}

function sendPaymentRequired(req: IncomingMessage, res: ServerResponse, error: string): void {
  const paymentRequired = buildPaymentRequired(req, error);
  const encoded = encodeHeaderJson(paymentRequired);

  sendJson(
    res,
    402,
    paymentRequired,
    {
      "PAYMENT-REQUIRED": encoded,
      "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
    },
  );
}

function getPaymentHeader(req: IncomingMessage): string | undefined {
  const paymentSignature = req.headers["payment-signature"];
  const xPayment = req.headers["x-payment"];
  const value = paymentSignature ?? xPayment;
  return Array.isArray(value) ? value[0] : value;
}

async function postToFacilitator<T>(path: "/verify" | "/settle", envelope: PaymentEnvelope): Promise<T> {
  const response = await fetch(`${config.facilitatorUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(envelope),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`facilitator ${path} returned ${response.status}: ${text}`);
  }

  return body as T;
}

async function verifyPayment(req: IncomingMessage): Promise<{
  paymentPayload?: JsonRecord;
  paymentRequirements: PaymentRequirements;
  verify?: VerifyResponse;
  error?: string;
}> {
  if (!isAddress(config.payTo)) {
    return {
      paymentRequirements: buildPaymentRequirements(),
      error: "server_missing_pay_to_address",
    };
  }

  const paymentHeader = getPaymentHeader(req);
  const paymentRequirements = buildPaymentRequirements();

  if (!paymentHeader) {
    return {
      paymentRequirements,
      error: "PAYMENT-SIGNATURE header is required",
    };
  }

  let paymentPayload: JsonRecord;
  try {
    paymentPayload = decodeHeaderJson(paymentHeader);
  } catch {
    return {
      paymentRequirements,
      error: "PAYMENT-SIGNATURE must be base64-encoded JSON",
    };
  }

  const envelope = {
    x402Version: X402_VERSION,
    paymentPayload,
    paymentRequirements,
  } satisfies PaymentEnvelope;

  const verify = await postToFacilitator<VerifyResponse>("/verify", envelope);

  if (!verify.isValid) {
    return {
      paymentPayload,
      paymentRequirements,
      verify,
      error: verify.invalidReason ?? "invalid_payment",
    };
  }

  return { paymentPayload, paymentRequirements, verify };
}

async function settlePayment(
  paymentPayload: JsonRecord,
  paymentRequirements: PaymentRequirements,
): Promise<SettleResponse> {
  return postToFacilitator<SettleResponse>("/settle", {
    x402Version: X402_VERSION,
    paymentPayload,
    paymentRequirements,
  });
}

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parseForecastRequest(url: URL): { lat: number; lon: number; days: number } | { error: string } {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const days = Number(url.searchParams.get("days") ?? 3);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { error: "lat must be a number from -90 to 90" };
  }

  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return { error: "lon must be a number from -180 to 180" };
  }

  if (!Number.isInteger(days) || days < 1 || days > 7) {
    return { error: "days must be an integer from 1 to 7" };
  }

  return { lat, lon, days };
}

async function fetchForecast(lat: number, lon: number, days: number): Promise<JsonRecord> {
  const url = new URL(config.weatherProviderUrl);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("forecast_days", String(days));
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`weather provider returned ${response.status}: ${JSON.stringify(body)}`);
  }

  return body as JsonRecord;
}

function buildFeedbackInstructions(req: IncomingMessage, payer?: string): JsonRecord {
  const endpoint = `${config.baseUrl}${getRequestUrl(req).pathname}`;
  const canonicalCall = canonicalResourceUrl(req);
  const feedbackSeed = `${payer ?? ""}:${canonicalCall}:${Date.now()}:${randomUUID()}`;
  const feedbackHash = `0x${createHash("sha256").update(feedbackSeed).digest("hex")}`;

  return {
    standard: "ERC-8004 ReputationRegistry",
    registry: REPUTATION_REGISTRY,
    agentRegistry: AGENT_REGISTRY_REF,
    agentId: config.agentId || null,
    endpoint,
    suggestedTags: {
      tag1: "forecast.quality",
      tag2: "forecast.v1",
    },
    method: "giveFeedback(agentId,value,valueDecimals,tag1,tag2,endpoint,feedbackURI,feedbackHash)",
    example: {
      value: 95,
      valueDecimals: 0,
      endpoint,
      feedbackURI: "ipfs://<caller-published-evidence-json>",
      feedbackHash,
    },
    gaslessSubmission: {
      supported: true,
      mechanism: "EIP-7702 smart EOA sponsorship",
      note: "Caller signs an operation that calls the ReputationRegistry from its own address; a sponsor can pay gas.",
    },
  };
}

async function handleForecast(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    sendMethodNotAllowed(res, "GET");
    return;
  }

  const parsed = parseForecastRequest(getRequestUrl(req));
  if ("error" in parsed) {
    sendJson(res, 400, { error: "invalid_forecast_request", message: parsed.error });
    return;
  }

  const payment = await verifyPayment(req);
  if (payment.error === "server_missing_pay_to_address") {
    sendJson(res, 503, {
      error: payment.error,
      message: "PAY_TO must be configured to a Base recipient address before paid calls are accepted.",
    });
    return;
  }

  if (payment.error || !payment.paymentPayload) {
    sendPaymentRequired(req, res, payment.error ?? "payment_required");
    return;
  }

  const forecast = await fetchForecast(parsed.lat, parsed.lon, parsed.days);
  const settlement = await settlePayment(payment.paymentPayload, payment.paymentRequirements);

  if (!settlement.success) {
    sendJson(res, 402, {
      error: "payment_settlement_failed",
      reason: settlement.errorReason ?? "unknown",
      settlement,
    });
    return;
  }

  const body = {
    service: "forecast.example.com",
    request: {
      lat: parsed.lat,
      lon: parsed.lon,
      days: parsed.days,
    },
    price: {
      amount: PRICE_USDC_ATOMIC,
      decimals: 6,
      display: "0.35 USDC",
      network: BASE_CHAIN,
      asset: BASE_USDC,
    },
    payment: settlement,
    forecast,
    feedback: buildFeedbackInstructions(req, settlement.payer ?? payment.verify?.payer),
  };

  const paymentResponse = encodeHeaderJson(settlement);
  sendJson(res, 200, body, {
    "PAYMENT-RESPONSE": paymentResponse,
    "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  });
}

function registrationDocument(): JsonRecord {
  const registrations = config.agentId
    ? [{ agentId: config.agentId, agentRegistry: AGENT_REGISTRY_REF }]
    : [];

  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "forecast.example.com",
    description: "Weather forecasts for autonomous agents, paid per call with x402 exact USDC on Base.",
    image: `${config.baseUrl}/icon.png`,
    active: true,
    services: [
      {
        type: "a2a",
        name: "Forecast Example Agent Card",
        uri: `${config.baseUrl}/.well-known/agent-card.json`,
      },
      {
        type: "https",
        name: "Paid forecast endpoint",
        uri: `${config.baseUrl}/forecast`,
        inputSchema: `${config.baseUrl}/openapi.json`,
      },
    ],
    x402Support: {
      x402Version: X402_VERSION,
      scheme: "exact",
      network: BASE_CHAIN,
      asset: BASE_USDC,
      amount: PRICE_USDC_ATOMIC,
      payTo: config.payTo || null,
      facilitator: config.facilitatorUrl,
    },
    registrations,
    supportedTrust: {
      reputationRegistry: `${BASE_CHAIN}:${REPUTATION_REGISTRY}`,
      feedbackMethod: "giveFeedback",
      suggestedTags: ["forecast.quality", "forecast.v1"],
      readMethod: "getSummary(agentId, clientAddresses, tag1, tag2)",
    },
  };
}

function agentCard(): JsonRecord {
  return {
    name: "forecast.example.com",
    description: "Paid weather forecasts for autonomous agents.",
    url: config.baseUrl,
    version: "1.0.0",
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    skills: [
      {
        id: "weather-forecast",
        name: "Weather forecast",
        description: "Return a daily forecast for latitude/longitude coordinates.",
        inputModes: ["application/json", "query"],
        outputModes: ["application/json"],
        examples: [`${config.baseUrl}/forecast?lat=37.7749&lon=-122.4194&days=3`],
      },
    ],
    payments: {
      protocol: "x402",
      x402Version: X402_VERSION,
      accepts: [buildPaymentRequirements()],
    },
    identity: {
      standard: "ERC-8004",
      agentRegistry: AGENT_REGISTRY_REF,
      agentId: config.agentId || null,
      registration: `${config.baseUrl}/.well-known/agent-registration.json`,
      reputationRegistry: `${BASE_CHAIN}:${REPUTATION_REGISTRY}`,
    },
  };
}

function openApiDocument(): JsonRecord {
  return {
    openapi: "3.1.0",
    info: {
      title: "forecast.example.com",
      version: "1.0.0",
      description: "x402-paid weather forecasts settled in USDC on Base.",
    },
    servers: [{ url: config.baseUrl }],
    paths: {
      "/forecast": {
        get: {
          summary: "Get a paid weather forecast",
          parameters: [
            { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
            { name: "lon", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 7, default: 3 } },
          ],
          responses: {
            "200": { description: "Forecast returned after x402 settlement" },
            "400": { description: "Invalid request; no payment required" },
            "402": { description: "PAYMENT-REQUIRED x402 challenge" },
          },
          "x-x402": {
            x402Version: X402_VERSION,
            accepts: [buildPaymentRequirements()],
          },
        },
      },
    },
  };
}

async function router(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = getRequestUrl(req);

    if (url.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/forecast") {
      await handleForecast(req, res);
      return;
    }

    if (req.method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return;
    }

    if (url.pathname === "/.well-known/agent-registration.json") {
      sendJson(res, 200, registrationDocument(), { "cache-control": "public, max-age=300" });
      return;
    }

    if (url.pathname === "/.well-known/agent-card.json") {
      sendJson(res, 200, agentCard(), { "cache-control": "public, max-age=300" });
      return;
    }

    if (url.pathname === "/openapi.json") {
      sendJson(res, 200, openApiDocument(), { "cache-control": "public, max-age=300" });
      return;
    }

    sendJson(res, 404, {
      error: "not_found",
      links: {
        agentRegistration: `${config.baseUrl}/.well-known/agent-registration.json`,
        agentCard: `${config.baseUrl}/.well-known/agent-card.json`,
        openapi: `${config.baseUrl}/openapi.json`,
      },
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "internal_server_error",
      message: error instanceof Error ? error.message : "unknown error",
    });
  }
}

const server = createServer((req, res) => {
  void router(req, res);
});

server.listen(config.port, () => {
  console.log(`forecast.example.com service listening on :${config.port}`);
});
