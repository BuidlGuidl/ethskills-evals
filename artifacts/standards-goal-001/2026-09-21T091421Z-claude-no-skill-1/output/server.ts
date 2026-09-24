// forecast.example.com — pay-per-call weather forecasts for agents.
// Payment: x402 "exact" scheme, USDC on Base via EIP-3009 transferWithAuthorization
// (payer signs offchain, we submit the tx and pay gas).
// Identity + reputation: ERC-8004 registries on Base. See design.md.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  isAddress,
  isHex,
  parseSignature,
  size,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount, nonceManager } from "viem/accounts";

// ---------- config ----------

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`missing env ${name}`);
  return v;
}

const PORT = Number(env("PORT", "8080"));
const PUBLIC_URL = env("PUBLIC_URL", "https://forecast.example.com");
const RPC_URL = env("BASE_RPC_URL", "https://mainnet.base.org");
const PAY_TO = getAddress(env("PAY_TO")); // must equal agentWallet in ERC-8004 identity
const SETTLER_KEY = env("SETTLER_PRIVATE_KEY") as Hex; // hot key holding a little ETH for gas
const AGENT_ID = process.env.AGENT_ID; // set after IdentityRegistry.register()
const IDENTITY_REGISTRY = getAddress(env("IDENTITY_REGISTRY", "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"));
const REPUTATION_REGISTRY = getAddress(env("REPUTATION_REGISTRY", "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"));
const WEATHER_API = env("WEATHER_API", "https://api.open-meteo.com/v1/forecast");

const CHAIN_ID = 8453;
const NETWORK = `eip155:${CHAIN_ID}`; // CAIP-2
const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const PRICE = 350_000n; // $0.35, USDC has 6 decimals
const MAX_TIMEOUT_S = 120;
const FORECAST_PATH = "/forecast";

const USDC_ABI = [
  {
    type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "authorizationState", stateMutability: "view",
    inputs: [{ name: "authorizer", type: "address" }, { name: "nonce", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
] as const;

const TWA_VRS_ABI = [
  {
    type: "function", name: "transferWithAuthorization", stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" }, { name: "r", type: "bytes32" }, { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

// FiatTokenV2_2 overload: accepts ERC-1271 smart-wallet signatures
const TWA_BYTES_ABI = [
  {
    type: "function", name: "transferWithAuthorization", stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const settler = createWalletClient({
  chain: base,
  transport: http(RPC_URL),
  account: privateKeyToAccount(SETTLER_KEY, { nonceManager }),
});

// ---------- published documents ----------

const paymentRequirements = {
  scheme: "exact",
  network: NETWORK,
  amount: PRICE.toString(),
  asset: USDC,
  payTo: PAY_TO,
  maxTimeoutSeconds: MAX_TIMEOUT_S,
  extra: { name: "USD Coin", version: "2" }, // USDC EIP-712 domain
};

// ERC-8004 registration file. agentURI points here; also served at the
// well-known path so the domain proves it owns the onchain agentId.
function registrationFile() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "forecast.example.com",
    description:
      "Daily weather forecasts (1-7 days) for any lat/lon. $0.35 USDC per call on Base via x402, no account or API key. " +
      `GET ${PUBLIC_URL}${FORECAST_PATH}?lat=<deg>&lon=<deg>&days=<1-7>`,
    image: `${PUBLIC_URL}/logo.png`,
    services: [
      { name: "web", endpoint: `${PUBLIC_URL}/` },
      { name: "OpenAPI", endpoint: `${PUBLIC_URL}/openapi.json`, version: "3.1.0" },
    ],
    x402Support: true,
    active: true,
    registrations: AGENT_ID
      ? [{ agentId: Number(AGENT_ID), agentRegistry: `${NETWORK}:${IDENTITY_REGISTRY}` }]
      : [],
    supportedTrust: ["reputation"],
  };
}

function openApi() {
  return {
    openapi: "3.1.0",
    info: { title: "forecast.example.com", version: "1.0.0", description: registrationFile().description },
    servers: [{ url: PUBLIC_URL }],
    paths: {
      [FORECAST_PATH]: {
        get: {
          summary: "Daily forecast",
          "x-payment": { protocol: "x402", ...paymentRequirements },
          parameters: [
            { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
            { name: "lon", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 7, default: 3 } },
          ],
          responses: {
            "200": { description: "Forecast; PAYMENT-RESPONSE header carries settlement tx" },
            "400": { description: "Bad parameters (never charged)" },
            "402": { description: "Payment required; PAYMENT-REQUIRED header (base64 JSON) lists accepted payment" },
            "502": { description: "Upstream weather source failed (never charged)" },
          },
        },
      },
    },
  };
}

// ---------- helpers ----------

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
    ...headers,
  });
  res.end(JSON.stringify(body, null, 2));
}

function paymentRequired(res: ServerResponse, error: string) {
  const body = {
    x402Version: 2,
    error,
    resource: {
      url: `${PUBLIC_URL}${FORECAST_PATH}`,
      description: "Daily weather forecast, 1-7 days",
      mimeType: "application/json",
    },
    accepts: [paymentRequirements],
    // how to judge us before paying
    trust: identityInfo(),
  };
  send(res, 402, body, { "PAYMENT-REQUIRED": b64(body) });
}

function identityInfo() {
  return {
    registrationFile: `${PUBLIC_URL}/.well-known/agent-registration.json`,
    identityRegistry: `${NETWORK}:${IDENTITY_REGISTRY}`,
    reputationRegistry: `${NETWORK}:${REPUTATION_REGISTRY}`,
    agentId: AGENT_ID ? Number(AGENT_ID) : null,
  };
}

type Authorization = {
  from: Address; to: Address; value: bigint; validAfter: bigint; validBefore: bigint; nonce: Hex;
};

// Accepts x402 v2 (PAYMENT-SIGNATURE) and v1 (X-PAYMENT) headers; both carry
// base64 JSON whose .payload is { signature, authorization }.
function parsePayment(header: string): { auth: Authorization; signature: Hex } {
  const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  if (decoded.accepted) {
    const a = decoded.accepted;
    if (a.scheme !== "exact" || a.network !== NETWORK) throw new Error("unsupported_scheme_or_network");
  } else if (decoded.scheme && (decoded.scheme !== "exact" || !["base", NETWORK].includes(decoded.network))) {
    throw new Error("unsupported_scheme_or_network");
  }
  const { signature, authorization: a } = decoded.payload ?? {};
  if (!isHex(signature) || !a) throw new Error("invalid_payload");
  for (const k of ["from", "to"]) if (!isAddress(a[k])) throw new Error("invalid_payload");
  if (!isHex(a.nonce) || size(a.nonce) !== 32) throw new Error("invalid_payload");
  return {
    signature,
    auth: {
      from: getAddress(a.from),
      to: getAddress(a.to),
      value: BigInt(a.value),
      validAfter: BigInt(a.validAfter),
      validBefore: BigInt(a.validBefore),
      nonce: a.nonce,
    },
  };
}

const inFlight = new Set<string>(); // nonces being settled right now

async function verifyPayment(auth: Authorization, signature: Hex): Promise<string | null> {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (auth.to !== PAY_TO) return "invalid_pay_to";
  if (auth.value !== PRICE) return "invalid_amount";
  if (auth.validAfter > now) return "authorization_not_yet_valid";
  if (auth.validBefore < now + 10n) return "authorization_expired"; // leave time to mine
  if (auth.validBefore > now + BigInt(MAX_TIMEOUT_S) + 60n) return "authorization_window_too_long";

  const valid = await publicClient.verifyTypedData({
    address: auth.from, // handles EOA, ERC-1271 and ERC-6492 signatures
    domain: { name: "USD Coin", version: "2", chainId: CHAIN_ID, verifyingContract: USDC },
    types: EIP3009_TYPES,
    primaryType: "TransferWithAuthorization",
    message: auth,
    signature,
  });
  if (!valid) return "invalid_signature";

  const [used, balance] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: USDC_ABI, functionName: "authorizationState", args: [auth.from, auth.nonce] }),
    publicClient.readContract({ address: USDC, abi: USDC_ABI, functionName: "balanceOf", args: [auth.from] }),
  ]);
  if (used) return "nonce_already_used";
  if (balance < auth.value) return "insufficient_funds";
  return null;
}

// Submit the payer's signed authorization. We pay the gas, so the payer needs no ETH.
async function settle(auth: Authorization, signature: Hex): Promise<Hex> {
  const args = [auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce] as const;
  const account = settler.account;
  let hash: Hex;
  if (size(signature) === 65) {
    // plain EOA signature
    const { r, s, yParity } = parseSignature(signature);
    const { request } = await publicClient.simulateContract({
      account, address: USDC, abi: TWA_VRS_ABI, functionName: "transferWithAuthorization",
      args: [...args, yParity + 27, r, s],
    });
    hash = await settler.writeContract(request);
  } else {
    const { request } = await publicClient.simulateContract({
      account, address: USDC, abi: TWA_BYTES_ABI, functionName: "transferWithAuthorization",
      args: [...args, signature],
    });
    hash = await settler.writeContract(request);
  }
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
  if (receipt.status !== "success") throw new Error(`settlement reverted: ${hash}`);
  return hash;
}

async function fetchForecast(lat: number, lon: number, days: number) {
  const url = new URL(WEATHER_API);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    forecast_days: String(days),
    timezone: "UTC",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code",
  }).toString();
  const r = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  const j: any = await r.json();
  const d = j.daily;
  return {
    location: { lat, lon },
    units: { temperature: "°C", precipitation: "mm", wind: "km/h" },
    days: d.time.map((date: string, i: number) => ({
      date,
      tempMax: d.temperature_2m_max[i],
      tempMin: d.temperature_2m_min[i],
      precipitation: d.precipitation_sum[i],
      precipitationProbability: d.precipitation_probability_max[i],
      windMax: d.wind_speed_10m_max[i],
      weatherCode: d.weather_code[i],
    })),
    source: "open-meteo.com",
  };
}

// ---------- routes ----------

async function handleForecast(req: IncomingMessage, res: ServerResponse, url: URL) {
  // 1. validate input first, so bad requests are never charged
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const days = Number(url.searchParams.get("days") ?? "3");
  if (!url.searchParams.has("lat") || !url.searchParams.has("lon") ||
      !(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180) ||
      !Number.isInteger(days) || days < 1 || days > 7) {
    return send(res, 400, { error: "need lat in [-90,90], lon in [-180,180], days integer 1-7" });
  }

  // 2. payment present?
  const header = (req.headers["payment-signature"] ?? req.headers["x-payment"]) as string | undefined;
  if (!header) return paymentRequired(res, "payment_required");

  let auth: Authorization, signature: Hex;
  try {
    ({ auth, signature } = parsePayment(header));
  } catch (e) {
    return paymentRequired(res, (e as Error).message.startsWith("unsupported") ? (e as Error).message : "invalid_payload");
  }

  const key = `${auth.from}:${auth.nonce}`;
  if (inFlight.has(key)) return paymentRequired(res, "nonce_already_used");
  inFlight.add(key);
  try {
    // 3. verify offchain (cheap, no gas)
    const err = await verifyPayment(auth, signature);
    if (err) return paymentRequired(res, err);

    // 4. do the work before charging: if upstream fails, payer keeps their money
    let forecast;
    try {
      forecast = await fetchForecast(lat, lon, days);
    } catch (e) {
      return send(res, 502, { error: "upstream_unavailable", charged: false });
    }

    // 5. settle onchain, then deliver
    let tx: Hex;
    try {
      tx = await settle(auth, signature);
    } catch (e) {
      console.error("settle failed", e);
      return paymentRequired(res, "settlement_failed");
    }

    const settlement = { success: true, transaction: tx, network: NETWORK, payer: auth.from };
    return send(
      res,
      200,
      {
        ...forecast,
        payment: settlement,
        // everything the caller needs to rate us in ERC-8004 ReputationRegistry.giveFeedback
        feedback: {
          ...identityInfo(),
          endpoint: `${PUBLIC_URL}${FORECAST_PATH}`,
          suggestedTags: { tag1: "starred", tag2: "forecast" },
          proofOfPayment: { fromAddress: auth.from, toAddress: PAY_TO, chainId: String(CHAIN_ID), txHash: tx },
        },
      },
      { "PAYMENT-RESPONSE": b64(settlement), "X-PAYMENT-RESPONSE": b64(settlement) },
    );
  } finally {
    inFlight.delete(key);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", PUBLIC_URL);
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "PAYMENT-SIGNATURE, X-PAYMENT, content-type",
        "access-control-allow-methods": "GET, OPTIONS",
      });
      return res.end();
    }
    if (req.method !== "GET") return send(res, 405, { error: "method_not_allowed" });

    switch (url.pathname) {
      case FORECAST_PATH:
        return await handleForecast(req, res, url);
      case "/.well-known/agent-registration.json":
        return send(res, 200, registrationFile());
      case "/openapi.json":
        return send(res, 200, openApi());
      case "/":
        return send(res, 200, {
          ...registrationFile(),
          price: { amount: PRICE.toString(), asset: USDC, network: NETWORK, protocol: "x402" },
          trust: identityInfo(),
        });
      case "/health":
        return send(res, 200, { ok: true });
      default:
        return send(res, 404, { error: "not_found" });
    }
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: "internal_error" });
  }
});

server.listen(PORT, () => {
  console.log(`forecast service on :${PORT}, payTo ${PAY_TO}, agentId ${AGENT_ID ?? "(not registered yet)"}`);
});
