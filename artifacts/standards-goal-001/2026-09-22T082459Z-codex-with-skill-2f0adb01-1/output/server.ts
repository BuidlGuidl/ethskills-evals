import express, { type Request, type Response } from "express";
import { HTTPFacilitatorClient, type RoutesConfig } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = stripTrailingSlash(process.env.BASE_URL ?? "https://forecast.example.com");
const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ?? "https://facilitator.monexprotocol.org";
const PAY_TO = process.env.FORECAST_PAY_TO;
const AGENT_ID = process.env.ERC8004_AGENT_ID ?? "0";
const AGENT_OWNER = process.env.ERC8004_OWNER ?? PAY_TO;
const AGENT_URI = process.env.ERC8004_AGENT_URI ?? `${BASE_URL}/registration.json`;

const BASE_NETWORK = "eip155:8453";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const FORECAST_PRICE_USD = "$0.35";
const FORECAST_PRICE_USDC_ATOMIC = "350000";

if (!PAY_TO || !isAddress(PAY_TO)) {
  throw new Error("FORECAST_PAY_TO must be set to the Base address that receives USDC payments.");
}

if (!AGENT_OWNER || !isAddress(AGENT_OWNER)) {
  throw new Error("ERC8004_OWNER must be an EVM address, or FORECAST_PAY_TO must be the agent owner.");
}

type ForecastPoint = {
  date: string;
  temperatureMinC: number;
  temperatureMaxC: number;
  precipitationProbabilityMax: number;
  windSpeedMaxKph: number;
};

type ForecastResponse = {
  service: string;
  generatedAt: string;
  location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  units: {
    temperature: "celsius";
    windSpeed: "km/h";
  };
  daily: ForecastPoint[];
  payment: {
    protocol: "x402";
    scheme: "exact";
    network: typeof BASE_NETWORK;
    asset: typeof USDC_BASE;
    amount: typeof FORECAST_PRICE_USDC_ATOMIC;
    displayPrice: typeof FORECAST_PRICE_USD;
  };
  rating: {
    registry: string;
    agentId: string;
    endpoint: string;
    suggestedTags: string[];
  };
};

const protectedRoutes: RoutesConfig = {
  "GET /api/forecast": {
    accepts: {
      scheme: "exact",
      price: FORECAST_PRICE_USD,
      network: BASE_NETWORK,
      payTo: PAY_TO,
      maxTimeoutSeconds: 90,
    },
    resource: `${BASE_URL}/api/forecast`,
    description: "Seven day weather forecast for a latitude and longitude.",
    mimeType: "application/json",
    serviceName: "forecast.example.com weather forecast",
    tags: ["weather", "forecast", "base", "usdc", "x402", "erc-8004"],
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "payment_required",
        service: "forecast.example.com",
        price: FORECAST_PRICE_USD,
        network: BASE_NETWORK,
        asset: USDC_BASE,
        assetDecimals: 6,
        amount: FORECAST_PRICE_USDC_ATOMIC,
      },
    }),
  },
};

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  BASE_NETWORK,
  new ExactEvmScheme(),
);

const app = express();
app.set("trust proxy", true);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "forecast.example.com",
    network: BASE_NETWORK,
    price: FORECAST_PRICE_USD,
  });
});

app.get("/.well-known/agent-card.json", (_req, res) => {
  res.json(agentCard());
});

app.get("/.well-known/agent-registration.json", (_req, res) => {
  res.json({
    agentId: AGENT_ID,
    agentRegistry: `${BASE_NETWORK}:${IDENTITY_REGISTRY}`,
    owner: AGENT_OWNER,
    agentURI: AGENT_URI,
  });
});

app.get("/.well-known/x402.json", (_req, res) => {
  res.json(x402Manifest());
});

app.get("/registration.json", (_req, res) => {
  res.json(registrationDocument());
});

app.use(paymentMiddleware(protectedRoutes, resourceServer));

app.get("/api/forecast", async (req: Request, res: Response) => {
  const latitude = parseCoordinate(req.query.lat, "lat", -90, 90);
  const longitude = parseCoordinate(req.query.lon, "lon", -180, 180);
  const timezone = parseTimezone(req.query.timezone);

  if (!latitude.ok) {
    res.status(400).json({ error: latitude.error });
    return;
  }

  if (!longitude.ok) {
    res.status(400).json({ error: longitude.error });
    return;
  }

  const forecast = await fetchForecast(latitude.value, longitude.value, timezone);
  res.setHeader("Cache-Control", "private, no-store");
  res.json(forecast);
});

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.listen(PORT, () => {
  console.log(`forecast.example.com service listening on :${PORT}`);
});

function agentCard() {
  return {
    name: "forecast.example.com",
    description: "Autonomous-agent weather forecasts paid per call with x402 USDC on Base.",
    url: BASE_URL,
    version: "1.0.0",
    protocols: ["x402", "ERC-8004"],
    services: [
      {
        name: "weather.forecast.v1",
        method: "GET",
        endpoint: `${BASE_URL}/api/forecast`,
        inputSchema: {
          type: "object",
          required: ["lat", "lon"],
          properties: {
            lat: { type: "number", minimum: -90, maximum: 90 },
            lon: { type: "number", minimum: -180, maximum: 180 },
            timezone: { type: "string", default: "UTC" },
          },
        },
        outputMimeType: "application/json",
        price: {
          protocol: "x402",
          scheme: "exact",
          network: BASE_NETWORK,
          asset: USDC_BASE,
          amount: FORECAST_PRICE_USDC_ATOMIC,
          displayPrice: FORECAST_PRICE_USD,
        },
      },
    ],
    trust: trustBlock(),
  };
}

function x402Manifest() {
  return {
    x402Version: 2,
    service: "forecast.example.com",
    routes: {
      "GET /api/forecast": {
        resource: `${BASE_URL}/api/forecast`,
        description: "Seven day weather forecast for a latitude and longitude.",
        accepts: [
          {
            scheme: "exact",
            network: BASE_NETWORK,
            payTo: PAY_TO,
            asset: USDC_BASE,
            amount: FORECAST_PRICE_USDC_ATOMIC,
            assetDecimals: 6,
            displayPrice: FORECAST_PRICE_USD,
          },
        ],
      },
    },
    facilitator: FACILITATOR_URL,
    trust: trustBlock(),
  };
}

function registrationDocument() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "forecast.example.com",
    description: "Machine-callable weather forecast API paid per call with x402 USDC on Base.",
    services: [
      {
        name: "A2A",
        endpoint: `${BASE_URL}/.well-known/agent-card.json`,
        version: "0.3.0",
      },
      {
        name: "x402",
        endpoint: `${BASE_URL}/.well-known/x402.json`,
        version: "2",
      },
      {
        name: "HTTPS",
        endpoint: `${BASE_URL}/api/forecast`,
        version: "1.0.0",
      },
    ],
    x402Support: true,
    active: true,
    supportedTrust: ["reputation"],
    payment: {
      scheme: "exact",
      network: BASE_NETWORK,
      asset: USDC_BASE,
      amount: FORECAST_PRICE_USDC_ATOMIC,
      displayPrice: FORECAST_PRICE_USD,
    },
  };
}

function trustBlock() {
  return {
    agentRegistry: `${BASE_NETWORK}:${IDENTITY_REGISTRY}`,
    agentId: AGENT_ID,
    reputationRegistry: `${BASE_NETWORK}:${REPUTATION_REGISTRY}`,
    feedback: {
      endpoint: `${BASE_URL}/api/forecast`,
      suggestedTags: ["quality:forecast", "uptime:30days", "settlement:x402"],
    },
  };
}

async function fetchForecast(
  latitude: number,
  longitude: number,
  timezone: string,
): Promise<ForecastResponse> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("daily", [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
    "wind_speed_10m_max",
  ].join(","));
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", timezone);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather provider failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    timezone?: string;
    daily?: {
      time?: string[];
      temperature_2m_min?: number[];
      temperature_2m_max?: number[];
      precipitation_probability_max?: number[];
      wind_speed_10m_max?: number[];
    };
  };

  const daily = payload.daily;
  if (!daily?.time?.length) {
    throw new Error("Weather provider returned no daily forecast data.");
  }

  return {
    service: "forecast.example.com",
    generatedAt: new Date().toISOString(),
    location: {
      latitude,
      longitude,
      timezone: payload.timezone ?? timezone,
    },
    units: {
      temperature: "celsius",
      windSpeed: "km/h",
    },
    daily: daily.time.map((date, index) => ({
      date,
      temperatureMinC: valueAt(daily.temperature_2m_min, index),
      temperatureMaxC: valueAt(daily.temperature_2m_max, index),
      precipitationProbabilityMax: valueAt(daily.precipitation_probability_max, index),
      windSpeedMaxKph: valueAt(daily.wind_speed_10m_max, index),
    })),
    payment: {
      protocol: "x402",
      scheme: "exact",
      network: BASE_NETWORK,
      asset: USDC_BASE,
      amount: FORECAST_PRICE_USDC_ATOMIC,
      displayPrice: FORECAST_PRICE_USD,
    },
    rating: {
      registry: `${BASE_NETWORK}:${REPUTATION_REGISTRY}`,
      agentId: AGENT_ID,
      endpoint: `${BASE_URL}/api/forecast`,
      suggestedTags: ["quality:forecast", "uptime:30days", "settlement:x402"],
    },
  };
}

function parseCoordinate(
  value: unknown,
  name: string,
  min: number,
  max: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (Array.isArray(value)) {
    return { ok: false, error: `${name} must be a single numeric query parameter.` };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { ok: false, error: `${name} must be a number between ${min} and ${max}.` };
  }

  return { ok: true, value: parsed };
}

function parseTimezone(value: unknown): string {
  if (Array.isArray(value) || typeof value !== "string" || value.trim() === "") {
    return "UTC";
  }

  return value.trim();
}

function valueAt(values: number[] | undefined, index: number): number {
  const value = values?.[index];
  return Number.isFinite(value) ? Number(value) : 0;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
