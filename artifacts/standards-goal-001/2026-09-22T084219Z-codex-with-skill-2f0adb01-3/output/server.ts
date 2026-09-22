import express, { type Request, type Response } from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { encodeFunctionData, getAddress, isAddress, parseAbi } from "viem";

const BASE_CHAIN_ID = 8453;
const BASE_NETWORK = `eip155:${BASE_CHAIN_ID}` as const;
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRICE_USD = "$0.35";
const PRICE_USDC_BASE_UNITS = "350000";

const reputationAbi = parseAbi([
  "function giveFeedback(uint256 agentId,int128 value,uint8 valueDecimals,string tag1,string tag2,string endpoint,string ipfsHash,bytes32 proofHash)",
]);

type ForecastDay = {
  date: string;
  highC: number;
  lowC: number;
  condition: string;
  precipitationProbability: number;
  windKph: number;
};

type FeedbackPrepareRequest = {
  value?: unknown;
  valueDecimals?: unknown;
  tag1?: unknown;
  tag2?: unknown;
  ipfsHash?: unknown;
  proofHash?: unknown;
};

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function optionalAddress(name: string, fallback: `0x${string}`): `0x${string}` {
  const raw = process.env[name] ?? fallback;
  if (!isAddress(raw)) {
    throw new Error(`${name} must be an EVM address`);
  }
  return getAddress(raw) as `0x${string}`;
}

function requiredAddress(name: string): `0x${string}` {
  const raw = env(name);
  if (!isAddress(raw)) {
    throw new Error(`${name} must be an EVM address`);
  }
  return getAddress(raw) as `0x${string}`;
}

function intFromQuery(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function coordinate(value: unknown, name: "lat" | "lon"): number {
  const parsed = Number(value);
  const min = name === "lat" ? -90 : -180;
  const max = name === "lat" ? 90 : 180;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw Object.assign(new Error(`${name} must be between ${min} and ${max}`), {
      statusCode: 400,
    });
  }
  return parsed;
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildForecast(lat: number, lon: number, days: number): ForecastDay[] {
  const conditions = ["clear", "partly_cloudy", "cloudy", "rain", "storm"];
  const seed = hashSeed(`${lat.toFixed(4)}:${lon.toFixed(4)}:${new Date().toISOString().slice(0, 10)}`);
  const baseline = 16 + Math.sin((lat / 180) * Math.PI) * 11;

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.now() + index * 86_400_000);
    const dailySeed = hashSeed(`${seed}:${index}`);
    const swing = (dailySeed % 900) / 100 - 4.5;
    const highC = Math.round((baseline + swing + 6) * 10) / 10;
    const lowC = Math.round((baseline + swing - 4) * 10) / 10;
    const condition = conditions[dailySeed % conditions.length];

    return {
      date: date.toISOString().slice(0, 10),
      highC,
      lowC,
      condition,
      precipitationProbability: Math.min(95, (dailySeed >>> 8) % 100),
      windKph: 5 + ((dailySeed >>> 16) % 45),
    };
  });
}

function assertInt128(value: unknown): bigint {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw Object.assign(new Error("value must be an integer rating"), { statusCode: 400 });
  }
  const bigintValue = BigInt(value);
  const min = -(1n << 127n);
  const max = (1n << 127n) - 1n;
  if (bigintValue < min || bigintValue > max) {
    throw Object.assign(new Error("value is outside int128 range"), { statusCode: 400 });
  }
  return bigintValue;
}

function assertUint8(value: unknown, fallback: number): number {
  const parsed = value === undefined ? fallback : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed < 0 || parsed > 18) {
    throw Object.assign(new Error("valueDecimals must be an integer from 0 to 18"), {
      statusCode: 400,
    });
  }
  return parsed;
}

function assertShortString(value: unknown, fallback: string, field: string): string {
  const parsed = value === undefined ? fallback : value;
  if (typeof parsed !== "string" || parsed.length > 160) {
    throw Object.assign(new Error(`${field} must be a string up to 160 characters`), {
      statusCode: 400,
    });
  }
  return parsed;
}

function assertBytes32(value: unknown): `0x${string}` {
  const parsed = value === undefined ? "0x0000000000000000000000000000000000000000000000000000000000000000" : value;
  if (typeof parsed !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed)) {
    throw Object.assign(new Error("proofHash must be a bytes32 hex string"), { statusCode: 400 });
  }
  return parsed as `0x${string}`;
}

const baseUrl = env("FORECAST_BASE_URL", "https://forecast.example.com").replace(/\/+$/, "");
const payTo = requiredAddress("FORECAST_USDC_RECEIVER");
const operator = optionalAddress("FORECAST_OPERATOR_ADDRESS", payTo);
const agentId = env("FORECAST_AGENT_ID", "unregistered");
const port = Number(process.env.PORT ?? 3000);
const facilitatorUrl = env("X402_FACILITATOR_URL", "https://facilitator.openx402.ai");

const forecastEndpoint = `${baseUrl}/api/forecast`;
const agentRegistry = `${BASE_NETWORK}:${IDENTITY_REGISTRY}`;
const registrationUri = process.env.FORECAST_AGENT_URI ?? `${baseUrl}/registration.json`;

const facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitator).register(
  BASE_NETWORK,
  new ExactEvmScheme(),
);

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "64kb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "forecast.example.com", network: BASE_NETWORK });
});

app.get("/registration.json", (_req: Request, res: Response) => {
  res.json({
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Forecast Example",
    description: "Autonomous-agent weather forecasts, paid per call with x402 USDC on Base.",
    image: `${baseUrl}/icon.png`,
    services: [
      {
        name: "A2A",
        endpoint: `${baseUrl}/.well-known/agent-card.json`,
        version: "0.3.0",
      },
      {
        name: "OpenAPI",
        endpoint: `${baseUrl}/.well-known/openapi.json`,
        version: "3.1.0",
      },
    ],
    endpoints: [forecastEndpoint],
    tags: ["weather", "forecast", "x402", "base", "usdc"],
    x402Support: true,
    active: agentId !== "unregistered",
    supportedTrust: ["reputation"],
  });
});

app.get("/.well-known/agent-registration.json", (_req: Request, res: Response) => {
  res.json({
    agentId,
    agentRegistry,
    owner: operator,
    agentURI: registrationUri,
    endpoint: forecastEndpoint,
  });
});

app.get("/.well-known/agent-card.json", (_req: Request, res: Response) => {
  res.json({
    name: "Forecast Example",
    description: "Machine-callable weather forecasts for autonomous agents.",
    url: baseUrl,
    version: "1.0.0",
    agent: {
      id: agentId,
      registry: agentRegistry,
      registration: `${baseUrl}/.well-known/agent-registration.json`,
      reputationRegistry: `${BASE_NETWORK}:${REPUTATION_REGISTRY}`,
    },
    capabilities: [
      {
        id: "weather.forecast",
        method: "GET",
        endpoint: forecastEndpoint,
        input: {
          query: {
            lat: "number, -90..90",
            lon: "number, -180..180",
            days: "integer, 1..10, optional",
          },
        },
        output: "application/json forecast with daily high/low, conditions, precipitation, and wind",
        payment: {
          protocol: "x402",
          scheme: "exact",
          network: BASE_NETWORK,
          asset: BASE_USDC,
          assetSymbol: "USDC",
          assetDecimals: 6,
          amount: PRICE_USDC_BASE_UNITS,
          price: PRICE_USD,
          payTo,
        },
        reputation: {
          registry: `${BASE_NETWORK}:${REPUTATION_REGISTRY}`,
          agentId,
          endpoint: forecastEndpoint,
          suggestedTags: [
            ["quality", "forecast"],
            ["accuracy", "forecast"],
            ["settlement", "x402"],
          ],
        },
      },
    ],
  });
});

app.get("/.well-known/openapi.json", (_req: Request, res: Response) => {
  res.json({
    openapi: "3.1.0",
    info: {
      title: "Forecast Example API",
      version: "1.0.0",
    },
    paths: {
      "/api/forecast": {
        get: {
          summary: "Paid weather forecast",
          parameters: [
            { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
            { name: "lon", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 10 } },
          ],
          responses: {
            "200": { description: "Forecast after x402 payment settlement" },
            "402": { description: "x402 payment required" },
          },
        },
      },
      "/api/feedback/prepare": {
        post: {
          summary: "Prepare ERC-8004 ReputationRegistry calldata",
          responses: {
            "200": { description: "Transaction target and calldata for caller-submitted feedback" },
          },
        },
      },
    },
  });
});

app.use(
  paymentMiddleware(
    {
      "GET /api/forecast": {
        accepts: {
          scheme: "exact",
          price: PRICE_USD,
          network: BASE_NETWORK,
          payTo,
          maxTimeoutSeconds: 120,
        },
        description: "Weather forecast from forecast.example.com",
      },
    },
    resourceServer,
  ),
);

app.get("/api/forecast", (req: Request, res: Response) => {
  const lat = coordinate(req.query.lat, "lat");
  const lon = coordinate(req.query.lon, "lon");
  const days = intFromQuery(req.query.days, 5, 1, 10);
  const forecast = buildForecast(lat, lon, days);

  res.json({
    service: "forecast.example.com",
    query: { lat, lon, days },
    generatedAt: new Date().toISOString(),
    source: process.env.WEATHER_PROVIDER_NAME ?? "deterministic-demo-provider",
    forecast,
    payment: {
      protocol: "x402",
      network: BASE_NETWORK,
      asset: BASE_USDC,
      amount: PRICE_USDC_BASE_UNITS,
      price: PRICE_USD,
      payTo,
    },
    reputation: {
      registry: `${BASE_NETWORK}:${REPUTATION_REGISTRY}`,
      agentId,
      endpoint: forecastEndpoint,
      feedbackPrepareEndpoint: `${baseUrl}/api/feedback/prepare`,
    },
  });
});

app.post("/api/feedback/prepare", (req: Request<object, object, FeedbackPrepareRequest>, res: Response) => {
  if (agentId === "unregistered" || !/^\d+$/.test(agentId)) {
    throw Object.assign(new Error("FORECAST_AGENT_ID must be registered before feedback can be prepared"), {
      statusCode: 503,
    });
  }

  const value = assertInt128(req.body.value);
  const valueDecimals = assertUint8(req.body.valueDecimals, 0);
  const tag1 = assertShortString(req.body.tag1, "quality", "tag1");
  const tag2 = assertShortString(req.body.tag2, "forecast", "tag2");
  const ipfsHash = assertShortString(req.body.ipfsHash, "", "ipfsHash");
  const proofHash = assertBytes32(req.body.proofHash);

  const args = [
    BigInt(agentId),
    value,
    valueDecimals,
    tag1,
    tag2,
    forecastEndpoint,
    ipfsHash,
    proofHash,
  ] as const;

  res.json({
    chainId: BASE_CHAIN_ID,
    network: BASE_NETWORK,
    to: REPUTATION_REGISTRY,
    value: "0",
    data: encodeFunctionData({
      abi: reputationAbi,
      functionName: "giveFeedback",
      args,
    }),
    decoded: {
      functionName: "giveFeedback",
      args: {
        agentId,
        value: value.toString(),
        valueDecimals,
        tag1,
        tag2,
        endpoint: forecastEndpoint,
        ipfsHash,
        proofHash,
      },
    },
  });
});

app.use((error: Error & { statusCode?: number }, _req: Request, res: Response, _next: unknown) => {
  const status = error.statusCode ?? 500;
  res.status(status).json({
    error: status >= 500 ? "internal_error" : "bad_request",
    message: error.message,
  });
});

app.listen(port, () => {
  console.log(`forecast.example.com service listening on :${port}`);
});
