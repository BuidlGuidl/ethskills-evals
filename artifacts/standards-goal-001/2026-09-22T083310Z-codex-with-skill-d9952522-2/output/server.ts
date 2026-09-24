import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_BASE_URL = trimTrailingSlash(process.env.PUBLIC_BASE_URL ?? "https://forecast.example.com");
const FACILITATOR_URL = trimTrailingSlash(process.env.X402_FACILITATOR_URL ?? "https://facilitator.example.com");
const PAY_TO = process.env.FORECAST_PAY_TO ?? "0x0000000000000000000000000000000000000000";
const AGENT_ID = process.env.FORECAST_AGENT_ID ?? "0";

const BASE_CHAIN_ID = 8453;
const BASE_CAIP2 = "eip155:8453";
const X402_NETWORK = "base";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const PRICE_USDC_BASE_UNITS = "350000";
const IDENTITY_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY_ADDRESS = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const AGENT_REGISTRY = `${BASE_CAIP2}:${IDENTITY_REGISTRY_ADDRESS}`;

type JsonRecord = Record<string, unknown>;

type PaymentRequirement = {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: {
    name: "USDC";
    version: "2";
    chainId: number;
    decimals: number;
    eip712: {
      primaryType: "TransferWithAuthorization";
    };
  };
};

type VerifyResponse = {
  isValid?: boolean;
  valid?: boolean;
  error?: string;
  reason?: string;
  payer?: string;
};

type SettleResponse = {
  success?: boolean;
  settled?: boolean;
  transaction?: string;
  txHash?: string;
  paymentResponse?: unknown;
  error?: string;
  reason?: string;
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", PUBLIC_BASE_URL);

    if (request.method === "GET" && url.pathname === "/") {
      return sendJson(response, 200, buildAgentCard());
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { ok: true });
    }

    if (request.method === "GET" && url.pathname === "/.well-known/agent-registration.json") {
      return sendJson(response, 200, buildRegistration());
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/.well-known/agent-card.json" || url.pathname === "/agent-card.json")
    ) {
      return sendJson(response, 200, buildAgentCard());
    }

    if (request.method === "GET" && url.pathname === "/feedback-template") {
      return sendJson(response, 200, buildFeedbackTemplate(url.searchParams.get("endpoint") ?? "/forecast"));
    }

    if (request.method === "GET" && url.pathname === "/forecast") {
      return handleForecast(request, response, url);
    }

    return sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return sendJson(response, 500, { error: "internal_error", message });
  }
});

server.listen(PORT, () => {
  console.log(`forecast.example.com service listening on http://localhost:${PORT}`);
});

async function handleForecast(request: IncomingMessage, response: ServerResponse, url: URL) {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return sendJson(response, 400, {
      error: "invalid_location",
      message: "Provide lat and lon query parameters in decimal degrees.",
    });
  }

  const paymentRequirement = buildPaymentRequirement(url);
  const paymentHeader = getPaymentHeader(request);

  if (!paymentHeader) {
    return requestPayment(response, paymentRequirement);
  }

  const verification = await verifyPayment(paymentHeader, paymentRequirement).catch((error: unknown) =>
    failedFacilitatorResponse(error),
  );
  if ("facilitatorError" in verification) {
    return sendJson(response, 502, verification.facilitatorError);
  }

  if (!isVerificationValid(verification)) {
    return requestPayment(response, paymentRequirement, verification.error ?? verification.reason ?? "payment_not_valid");
  }

  const settlement = await settlePayment(paymentHeader, paymentRequirement).catch((error: unknown) =>
    failedFacilitatorResponse(error),
  );
  if ("facilitatorError" in settlement) {
    return sendJson(response, 502, settlement.facilitatorError);
  }

  if (!isSettlementSuccessful(settlement)) {
    return sendJson(response, 502, {
      error: "payment_settlement_failed",
      reason: settlement.error ?? settlement.reason ?? "facilitator did not settle payment",
    });
  }

  const forecast = buildForecast(lat, lon);
  const endpoint = `${PUBLIC_BASE_URL}/forecast`;
  const feedbackURI = `${PUBLIC_BASE_URL}/feedback-template?endpoint=${encodeURIComponent(endpoint)}`;
  const paymentResponse = settlement.paymentResponse ?? {
    success: true,
    network: X402_NETWORK,
    asset: USDC_BASE,
    amount: PRICE_USDC_BASE_UNITS,
    transaction: settlement.transaction ?? settlement.txHash,
  };

  response.setHeader("PAYMENT-RESPONSE", encodeHeaderJson(paymentResponse));
  response.setHeader("X-PAYMENT-RESPONSE", encodeHeaderJson(paymentResponse));
  response.setHeader("Link", `<${PUBLIC_BASE_URL}/.well-known/agent-registration.json>; rel="agent-registration"`);

  return sendJson(response, 200, {
    forecast,
    paid: {
      amount: PRICE_USDC_BASE_UNITS,
      asset: USDC_BASE,
      network: X402_NETWORK,
      transaction: settlement.transaction ?? settlement.txHash ?? null,
      payer: verification.payer ?? null,
    },
    agent: {
      agentId: AGENT_ID,
      agentRegistry: AGENT_REGISTRY,
      reputationRegistry: `${BASE_CAIP2}:${REPUTATION_REGISTRY_ADDRESS}`,
    },
    feedback: {
      registry: `${BASE_CAIP2}:${REPUTATION_REGISTRY_ADDRESS}`,
      method: "giveFeedback",
      agentId: AGENT_ID,
      tag1: "weather-forecast",
      tag2: "paid-x402",
      endpoint,
      feedbackURI,
      feedbackHash: hashJson({ forecast, endpoint, payment: paymentResponse }),
    },
  });
}

function buildRegistration() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "forecast.example.com",
    description: "Autonomous-agent weather forecasts for $0.35 per call, settled in native USDC on Base through x402.",
    image: `${PUBLIC_BASE_URL}/weather-agent.png`,
    active: true,
    services: [
      {
        type: "https",
        name: "paid-weather-forecast",
        endpoint: `${PUBLIC_BASE_URL}/forecast`,
        methods: ["GET"],
        input: {
          query: {
            lat: "decimal degrees, -90 to 90",
            lon: "decimal degrees, -180 to 180",
          },
        },
        output: "application/json",
      },
      {
        type: "a2a-card",
        name: "agent-card",
        endpoint: `${PUBLIC_BASE_URL}/.well-known/agent-card.json`,
      },
    ],
    x402Support: {
      version: "1",
      schemes: ["exact"],
      network: X402_NETWORK,
      asset: USDC_BASE,
      assetDecimals: USDC_DECIMALS,
      amount: PRICE_USDC_BASE_UNITS,
      facilitator: FACILITATOR_URL,
      eip3009: true,
    },
    registrations: [
      {
        agentId: AGENT_ID,
        agentRegistry: AGENT_REGISTRY,
      },
    ],
    supportedTrust: [
      {
        type: "erc-8004-reputation",
        registry: `${BASE_CAIP2}:${REPUTATION_REGISTRY_ADDRESS}`,
        tags: [
          ["weather-forecast", "paid-x402"],
          ["availability", "paid-x402"],
        ],
      },
    ],
  };
}

function buildAgentCard() {
  return {
    name: "forecast.example.com",
    description: "Paid weather forecast API for autonomous agents.",
    url: PUBLIC_BASE_URL,
    agentRegistration: `${PUBLIC_BASE_URL}/.well-known/agent-registration.json`,
    agentId: AGENT_ID,
    agentRegistry: AGENT_REGISTRY,
    endpoints: [
      {
        name: "forecast",
        method: "GET",
        url: `${PUBLIC_BASE_URL}/forecast{?lat,lon}`,
        payment: {
          protocol: "x402",
          price: {
            amount: PRICE_USDC_BASE_UNITS,
            display: "0.35 USDC",
            asset: USDC_BASE,
            decimals: USDC_DECIMALS,
            network: X402_NETWORK,
          },
        },
      },
    ],
    reputation: {
      protocol: "erc-8004",
      registry: `${BASE_CAIP2}:${REPUTATION_REGISTRY_ADDRESS}`,
      feedbackTemplate: `${PUBLIC_BASE_URL}/feedback-template`,
      recommendedTags: {
        tag1: "weather-forecast",
        tag2: "paid-x402",
      },
    },
  };
}

function buildPaymentRequirement(url: URL): PaymentRequirement {
  const resource = `${PUBLIC_BASE_URL}${url.pathname}${url.search}`;

  return {
    scheme: "exact",
    network: X402_NETWORK,
    maxAmountRequired: PRICE_USDC_BASE_UNITS,
    resource,
    description: "One weather forecast from forecast.example.com",
    mimeType: "application/json",
    payTo: PAY_TO,
    maxTimeoutSeconds: 120,
    asset: USDC_BASE,
    extra: {
      name: "USDC",
      version: "2",
      chainId: BASE_CHAIN_ID,
      decimals: USDC_DECIMALS,
      eip712: {
        primaryType: "TransferWithAuthorization",
      },
    },
  };
}

function buildFeedbackTemplate(endpoint: string) {
  const normalizedEndpoint = endpoint.startsWith("http") ? endpoint : `${PUBLIC_BASE_URL}${endpoint}`;

  return {
    chainId: BASE_CHAIN_ID,
    registry: REPUTATION_REGISTRY_ADDRESS,
    registryCAIP10: `${BASE_CAIP2}:${REPUTATION_REGISTRY_ADDRESS}`,
    method: "giveFeedback",
    args: {
      agentId: AGENT_ID,
      value: "0-100",
      valueDecimals: 0,
      tag1: "weather-forecast",
      tag2: "paid-x402",
      endpoint: normalizedEndpoint,
      feedbackURI: "ipfs:// or https:// URI with the caller's optional detailed review",
      feedbackHash: "bytes32 hash of the detailed review, or 0x00...00 if omitted",
    },
    notes: [
      "Only the caller submits feedback; the service does not write ratings for itself.",
      "Client agents should evaluate summaries from feedback authors they trust.",
    ],
  };
}

function buildForecast(lat: number, lon: number) {
  const seed = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233));
  const temperatureC = Math.round((4 + seed * 27 + latitudeSeasonalBias(lat)) * 10) / 10;
  const precipitationChance = Math.round(((seed * 73 + Math.abs(lon) % 17) % 100) * 10) / 10;
  const windKph = Math.round((8 + seed * 34) * 10) / 10;
  const conditions = precipitationChance > 65 ? "rain likely" : seed > 0.72 ? "cloudy" : "clear";

  return {
    location: { lat, lon },
    issuedAt: new Date().toISOString(),
    validForHours: 6,
    conditions,
    temperatureC,
    precipitationChance,
    windKph,
    source: "forecast.example.com deterministic sample model",
  };
}

async function verifyPayment(payment: string, requirement: PaymentRequirement): Promise<VerifyResponse> {
  return postFacilitator<VerifyResponse>("/verify", {
    x402Version: 1,
    payment,
    paymentRequirements: [requirement],
  });
}

async function settlePayment(payment: string, requirement: PaymentRequirement): Promise<SettleResponse> {
  return postFacilitator<SettleResponse>("/settle", {
    x402Version: 1,
    payment,
    paymentRequirements: [requirement],
  });
}

async function postFacilitator<T>(path: string, body: JsonRecord): Promise<T> {
  const response = await fetch(`${FACILITATOR_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    const reason = typeof parsed === "object" && parsed !== null ? parsed : { error: text };
    throw new Error(`facilitator ${path} failed: ${JSON.stringify(reason)}`);
  }

  return parsed;
}

function requestPayment(response: ServerResponse, requirement: PaymentRequirement, reason?: string) {
  response.setHeader("PAYMENT-REQUIRED", encodeHeaderJson({ x402Version: 1, accepts: [requirement] }));
  response.setHeader("X-PAYMENT-REQUIRED", encodeHeaderJson({ x402Version: 1, accepts: [requirement] }));
  response.setHeader("Link", `<${PUBLIC_BASE_URL}/.well-known/agent-registration.json>; rel="agent-registration"`);

  return sendJson(response, 402, {
    error: "payment_required",
    reason,
    x402Version: 1,
    accepts: [requirement],
  });
}

function getPaymentHeader(request: IncomingMessage) {
  const direct = request.headers["payment-signature"] ?? request.headers["x-payment"];
  if (Array.isArray(direct)) return direct[0];
  return direct;
}

function failedFacilitatorResponse(error: unknown) {
  return {
    facilitatorError: {
      error: "payment_facilitator_unavailable",
      reason: error instanceof Error ? error.message : "unknown facilitator error",
    },
  };
}

function isVerificationValid(verification: VerifyResponse) {
  return verification.isValid === true || verification.valid === true;
}

function isSettlementSuccessful(settlement: SettleResponse) {
  return settlement.success === true || settlement.settled === true;
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body, null, 2);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("content-length", Buffer.byteLength(json));
  response.end(json);
}

function encodeHeaderJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function hashJson(value: unknown) {
  return `0x${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function latitudeSeasonalBias(lat: number) {
  return Math.cos((lat / 90) * Math.PI) * 6;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
