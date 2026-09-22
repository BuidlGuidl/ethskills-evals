import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";

type JsonObject = Record<string, unknown>;

type PaymentRequirements = {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  asset: string;
  payTo: string;
  resource: string;
  description: string;
  mimeType: string;
  outputSchema: JsonObject;
  maxTimeoutSeconds: number;
  extra: JsonObject;
};

type PaymentPayload = {
  x402Version: number;
  scheme: string;
  network: string;
  payload: JsonObject;
};

type FacilitatorVerifyResponse = {
  isValid?: boolean;
  invalidReason?: string;
  payer?: string;
};

type FacilitatorSettleResponse = {
  success?: boolean;
  errorReason?: string;
  transaction?: string;
  network?: string;
  payer?: string;
};

const CONFIG = {
  port: Number(process.env.PORT ?? 8080),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "https://forecast.example.com",
  serviceName: process.env.SERVICE_NAME ?? "forecast.example.com",
  serviceDescription:
    process.env.SERVICE_DESCRIPTION ??
    "Autonomous-agent weather forecast API. Each forecast call costs 0.35 USDC on Base.",
  payTo: process.env.PAY_TO ?? "0x0000000000000000000000000000000000000000",
  facilitatorUrl: stripTrailingSlash(process.env.X402_FACILITATOR_URL ?? ""),
  network: process.env.X402_NETWORK ?? "base",
  chainId: process.env.BASE_CHAIN_ID ?? "8453",
  usdcAddress:
    process.env.USDC_ADDRESS ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  priceAtomic: process.env.PRICE_USDC_ATOMIC ?? "350000",
  paymentTimeoutSeconds: Number(process.env.PAYMENT_TIMEOUT_SECONDS ?? 60),
  weatherProviderUrl:
    process.env.WEATHER_PROVIDER_URL ?? "https://api.open-meteo.com/v1/forecast",
  agentImageUrl:
    process.env.AGENT_IMAGE_URL ??
    "https://forecast.example.com/static/forecast-agent.png",
  agentRegistry:
    process.env.ERC8004_AGENT_REGISTRY ??
    "eip155:8453:0x0000000000000000000000000000000000000000",
  agentId: process.env.ERC8004_AGENT_ID ?? "0",
  reputationRegistry:
    process.env.ERC8004_REPUTATION_REGISTRY ??
    "0x0000000000000000000000000000000000000000",
  feedbackPaymasterUrl: process.env.FEEDBACK_PAYMASTER_URL ?? "",
};

const FORECAST_OUTPUT_SCHEMA = {
  type: "object",
  required: ["location", "provider", "forecast", "payment", "reputation"],
  properties: {
    location: {
      type: "object",
      required: ["latitude", "longitude", "timezone"],
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
        timezone: { type: "string" },
      },
    },
    provider: { type: "string" },
    forecast: { type: "object" },
    payment: {
      type: "object",
      required: ["network", "asset", "amount", "transaction"],
      properties: {
        network: { type: "string" },
        asset: { type: "string" },
        amount: { type: "string" },
        transaction: { type: "string" },
      },
    },
    reputation: {
      type: "object",
      required: ["rateUrl", "agentRegistry", "agentId", "reputationRegistry"],
      properties: {
        rateUrl: { type: "string" },
        agentRegistry: { type: "string" },
        agentId: { type: "string" },
        reputationRegistry: { type: "string" },
      },
    },
  },
};

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected server error";
    sendJson(res, 500, { error: message });
  }
});

server.listen(CONFIG.port, () => {
  console.log(`${CONFIG.serviceName} listening on :${CONFIG.port}`);
});

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = requestUrl(req);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true, service: CONFIG.serviceName });
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

  if (req.method === "GET" && url.pathname === "/openapi.json") {
    sendJson(res, 200, openApiDocument());
    return;
  }

  if (req.method === "GET" && url.pathname === "/discovery/resources") {
    sendJson(res, 200, discoveryResources());
    return;
  }

  if (req.method === "GET" && url.pathname === "/x402/payment-requirements") {
    sendJson(res, 200, paymentRequiredResponse("Payment requirements for the forecast endpoint", forecastResourceUrl()));
    return;
  }

  if (req.method === "GET" && url.pathname === "/forecast") {
    await handleForecast(req, res, url);
    return;
  }

  if (req.method === "POST" && url.pathname === "/ratings") {
    await handleRatingPreparation(req, res);
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

async function handleForecast(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const latitude = readCoordinate(url, ["latitude", "lat"], -90, 90);
  const longitude = readCoordinate(url, ["longitude", "lon", "lng"], -180, 180);

  if (latitude === null || longitude === null) {
    sendJson(res, 400, {
      error: "invalid_location",
      message: "Supply latitude/longitude, or lat/lon, as decimal query parameters.",
    });
    return;
  }

  const resource = forecastResourceUrl();
  const requirements = buildPaymentRequirements(resource);
  const payment = readPaymentHeader(req);

  if (!payment) {
    sendJson(res, 402, paymentRequiredResponse("X-PAYMENT header is required", resource), {
      "X-Accept-Payment": JSON.stringify([requirements]),
    });
    return;
  }

  if (!CONFIG.facilitatorUrl) {
    sendJson(res, 503, {
      error: "facilitator_not_configured",
      message: "Set X402_FACILITATOR_URL before accepting paid forecast calls.",
    });
    return;
  }

  const verified = await verifyPayment(payment, requirements);
  if (!verified.isValid) {
    sendJson(res, 402, paymentRequiredResponse(verified.invalidReason ?? "invalid_payment", resource), {
      "X-Accept-Payment": JSON.stringify([requirements]),
    });
    return;
  }

  const settled = await settlePayment(payment, requirements);
  if (!settled.success) {
    sendJson(res, 402, {
      ...paymentRequiredResponse(settled.errorReason ?? "settlement_failed", resource),
      settlement: settled,
    });
    return;
  }

  const forecast = await fetchForecast(latitude, longitude);
  const response = {
    location: {
      latitude,
      longitude,
      timezone: forecast.timezone ?? "unknown",
    },
    provider: "open-meteo",
    forecast,
    payment: {
      payer: settled.payer ?? verified.payer,
      network: settled.network ?? CONFIG.network,
      asset: CONFIG.usdcAddress,
      amount: CONFIG.priceAtomic,
      transaction: settled.transaction ?? "",
    },
    reputation: reputationPointers(),
  };

  sendJson(res, 200, response, {
    "X-Payment-Response": JSON.stringify(settled),
  });
}

async function handleRatingPreparation(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const value = Number(body.value);
  const valueDecimals = Number(body.valueDecimals ?? 0);

  if (!Number.isInteger(value) || value < 0 || value > 100) {
    sendJson(res, 400, {
      error: "invalid_rating",
      message: "value must be an integer score from 0 to 100.",
    });
    return;
  }

  if (!Number.isInteger(valueDecimals) || valueDecimals < 0 || valueDecimals > 18) {
    sendJson(res, 400, {
      error: "invalid_decimals",
      message: "valueDecimals must be an integer from 0 to 18.",
    });
    return;
  }

  const args = [
    CONFIG.agentId,
    String(value),
    valueDecimals,
    String(body.tag1 ?? "starred"),
    String(body.tag2 ?? "forecast"),
    String(body.endpoint ?? forecastResourceUrl()),
    String(body.feedbackURI ?? ""),
    String(body.feedbackHash ?? zeroBytes32()),
  ];

  sendJson(res, 200, {
    registry: {
      chainId: CONFIG.chainId,
      agentRegistry: CONFIG.agentRegistry,
      agentId: CONFIG.agentId,
      reputationRegistry: CONFIG.reputationRegistry,
    },
    transaction: {
      chainId: CONFIG.chainId,
      to: CONFIG.reputationRegistry,
      function: "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
      args,
      abi: [
        {
          type: "function",
          name: "giveFeedback",
          stateMutability: "nonpayable",
          inputs: [
            { name: "agentId", type: "uint256" },
            { name: "value", type: "int128" },
            { name: "valueDecimals", type: "uint8" },
            { name: "tag1", type: "string" },
            { name: "tag2", type: "string" },
            { name: "endpoint", type: "string" },
            { name: "feedbackURI", type: "string" },
            { name: "feedbackHash", type: "bytes32" },
          ],
          outputs: [],
        },
      ],
    },
    gasless: {
      paymasterUrl: CONFIG.feedbackPaymasterUrl || null,
      note:
        "Submit this call from the rating agent address. Use a Base paymaster/bundler if the agent has USDC but no ETH for gas.",
    },
  });
}

async function verifyPayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<FacilitatorVerifyResponse> {
  return postFacilitator<FacilitatorVerifyResponse>("/verify", {
    x402Version: 1,
    paymentPayload,
    paymentRequirements,
  });
}

async function settlePayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<FacilitatorSettleResponse> {
  return postFacilitator<FacilitatorSettleResponse>("/settle", {
    x402Version: 1,
    paymentPayload,
    paymentRequirements,
  });
}

async function postFacilitator<T>(path: string, body: JsonObject): Promise<T> {
  const response = await fetch(`${CONFIG.facilitatorUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    const reason =
      typeof json === "object" && json && "error" in json
        ? String((json as JsonObject).error)
        : `facilitator_${response.status}`;
    throw new Error(reason);
  }
  return json;
}

async function fetchForecast(latitude: number, longitude: number): Promise<JsonObject> {
  const url = new URL(CONFIG.weatherProviderUrl);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m");
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,wind_speed_10m");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");

  const response = await fetch(url, {
    headers: { "User-Agent": `${CONFIG.serviceName}/1.0` },
  });

  if (!response.ok) {
    throw new Error(`weather_provider_${response.status}`);
  }

  return (await response.json()) as JsonObject;
}

function paymentRequiredResponse(error: string, resource: string): JsonObject {
  return {
    x402Version: 1,
    error,
    accepts: [buildPaymentRequirements(resource)],
  };
}

function buildPaymentRequirements(resource: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: CONFIG.network,
    maxAmountRequired: CONFIG.priceAtomic,
    asset: CONFIG.usdcAddress,
    payTo: CONFIG.payTo,
    resource,
    description: "Three day machine-readable weather forecast",
    mimeType: "application/json",
    outputSchema: FORECAST_OUTPUT_SCHEMA,
    maxTimeoutSeconds: CONFIG.paymentTimeoutSeconds,
    extra: {
      assetTransferMethod: "eip3009",
      name: "USD Coin",
      version: "2",
      chainId: CONFIG.chainId,
      caip2: `eip155:${CONFIG.chainId}`,
      decimals: 6,
    },
  };
}

function discoveryResources(): JsonObject {
  return {
    x402Version: 1,
    items: [
      {
        resource: forecastResourceUrl(),
        type: "http",
        x402Version: 1,
        accepts: [buildPaymentRequirements(forecastResourceUrl())],
        lastUpdated: Math.floor(Date.now() / 1000),
        metadata: {
          provider: CONFIG.serviceName,
          category: "weather",
          agentRegistry: CONFIG.agentRegistry,
          agentId: CONFIG.agentId,
          reputationRegistry: CONFIG.reputationRegistry,
        },
      },
    ],
    pagination: { limit: 1, offset: 0, total: 1 },
  };
}

function agentRegistration(): JsonObject {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: CONFIG.serviceName,
    description: CONFIG.serviceDescription,
    image: CONFIG.agentImageUrl,
    services: [
      { name: "web", endpoint: CONFIG.publicBaseUrl },
      {
        name: "A2A",
        endpoint: absolutePublicUrl("/.well-known/agent-card.json"),
        version: "0.3.0",
      },
      {
        name: "OpenAPI",
        endpoint: absolutePublicUrl("/openapi.json"),
        version: "3.1.0",
      },
      {
        name: "x402",
        endpoint: absolutePublicUrl("/discovery/resources"),
        version: "1",
      },
      {
        name: "ERC-8004-Reputation",
        endpoint: CONFIG.reputationRegistry,
        version: "1",
      },
    ],
    x402Support: true,
    active: true,
    registrations: [
      {
        agentId: numberOrString(CONFIG.agentId),
        agentRegistry: CONFIG.agentRegistry,
      },
    ],
    supportedTrust: ["reputation"],
  };
}

function agentCard(): JsonObject {
  return {
    name: CONFIG.serviceName,
    description: CONFIG.serviceDescription,
    url: CONFIG.publicBaseUrl,
    version: "1.0.0",
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [
      {
        id: "weather.forecast.v1",
        name: "Paid weather forecast",
        description: "Returns a three day forecast after an x402 USDC payment on Base.",
        tags: ["weather", "forecast", "x402", "base", "usdc"],
        examples: [`GET ${forecastResourceUrl()}?latitude=40.7128&longitude=-74.0060`],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
    ],
    payments: {
      x402: discoveryResources(),
    },
    trust: reputationPointers(),
  };
}

function reputationPointers(): JsonObject {
  return {
    rateUrl: absolutePublicUrl("/ratings"),
    agentRegistry: CONFIG.agentRegistry,
    agentId: CONFIG.agentId,
    reputationRegistry: CONFIG.reputationRegistry,
    suggestedFeedback: {
      tag1: "starred",
      tag2: "forecast",
      valueDecimals: 0,
      scale: "0-100",
    },
  };
}

function openApiDocument(): JsonObject {
  return {
    openapi: "3.1.0",
    info: {
      title: CONFIG.serviceName,
      version: "1.0.0",
      description: CONFIG.serviceDescription,
    },
    servers: [{ url: CONFIG.publicBaseUrl }],
    paths: {
      "/forecast": {
        get: {
          operationId: "getForecast",
          summary: "Return a paid weather forecast",
          parameters: [
            { name: "latitude", in: "query", required: true, schema: { type: "number" } },
            { name: "longitude", in: "query", required: true, schema: { type: "number" } },
          ],
          responses: {
            "200": { description: "Forecast", content: { "application/json": { schema: FORECAST_OUTPUT_SCHEMA } } },
            "402": { description: "x402 payment required" },
          },
        },
      },
      "/ratings": {
        post: {
          operationId: "prepareRating",
          summary: "Prepare ERC-8004 reputation feedback after a call",
          responses: { "200": { description: "Transaction data for ReputationRegistry.giveFeedback" } },
        },
      },
    },
  };
}

function readPaymentHeader(req: IncomingMessage): PaymentPayload | null {
  const raw = req.headers["x-payment"] ?? req.headers["payment-signature"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return null;
  }

  try {
    const text = value.trim().startsWith("{")
      ? value
      : Buffer.from(value, "base64url").toString("utf8");
    return JSON.parse(text) as PaymentPayload;
  } catch {
    throw new Error("invalid_payment_header");
  }
}

async function readJsonBody(req: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (Buffer.concat(chunks).length > 32_768) {
      throw new Error("request_body_too_large");
    }
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonObject;
}

function requestUrl(req: IncomingMessage): URL {
  const host = req.headers.host ?? new URL(CONFIG.publicBaseUrl).host;
  return new URL(req.url ?? "/", `http://${host}`);
}

function readCoordinate(url: URL, names: string[], min: number, max: number): number | null {
  for (const name of names) {
    const raw = url.searchParams.get(name);
    if (raw === null) {
      continue;
    }
    const value = Number(raw);
    if (Number.isFinite(value) && value >= min && value <= max) {
      return value;
    }
  }
  return null;
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: JsonObject,
  headers: Record<string, string> = {},
): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": statusCode === 200 ? "public, max-age=60" : "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body, null, 2));
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-PAYMENT,PAYMENT-SIGNATURE");
  res.setHeader("Access-Control-Expose-Headers", "X-Accept-Payment,X-Payment-Response");
}

function forecastResourceUrl(): string {
  return absolutePublicUrl("/forecast");
}

function absolutePublicUrl(path: string): string {
  return `${stripTrailingSlash(CONFIG.publicBaseUrl)}${path}`;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function zeroBytes32(): string {
  return `0x${"0".repeat(64)}`;
}

function numberOrString(value: string): number | string {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : value;
}
