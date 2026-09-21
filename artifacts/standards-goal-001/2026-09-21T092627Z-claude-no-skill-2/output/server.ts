// forecast.example.com — pay-per-call weather forecasts for agents.
// Payment: x402 "exact" scheme, USDC on Base, EIP-3009 transferWithAuthorization
// (payer only signs; this server submits the tx and pays the gas).
// Identity + reputation: ERC-8004 registries on Base. See design.md.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  isAddress,
  isHex,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ---------- config ----------

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`missing env ${name}`);
  return v;
}

const PORT = Number(env("PORT", "8080"));
const PUBLIC_URL = env("PUBLIC_URL", "https://forecast.example.com");
const RPC_URL = env("BASE_RPC_URL", "https://mainnet.base.org");
const PAY_TO = getAddress(env("PAY_TO")); // receives USDC; must equal ERC-8004 agentWallet
const SETTLER = privateKeyToAccount(env("SETTLER_PRIVATE_KEY") as Hex); // hot wallet holding a little ETH for gas
const AGENT_ID = process.env.AGENT_ID ?? ""; // ERC-8004 agentId, set after registration (design.md §6)

const CHAIN_ID = 8453;
const NETWORK = `eip155:${CHAIN_ID}`; // CAIP-2
const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRICE = 350_000n; // $0.35, USDC has 6 decimals
const MAX_TIMEOUT_S = 120;
// ERC-8004 v1 singletons (same address on every mainnet). Verify against the ERC before deploying.
const IDENTITY_REGISTRY: Address = getAddress(env("IDENTITY_REGISTRY", "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"));
const REPUTATION_REGISTRY: Address = getAddress(env("REPUTATION_REGISTRY", "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"));
const AGENT_REGISTRY = `${NETWORK}:${IDENTITY_REGISTRY}`;

const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const walletClient = createWalletClient({ chain: base, transport: http(RPC_URL), account: SETTLER });

const usdcAbi = [
  {
    type: "function",
    name: "transferWithAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" }, // FiatToken v2.2: EOA or ERC-1271 signature
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "authorizationState",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const transferAuthTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;
const usdcDomain = { name: "USD Coin", version: "2", chainId: CHAIN_ID, verifyingContract: USDC } as const;

// ---------- x402 messages ----------

const FORECAST_PATH = "/forecast";

const inputSchema = {
  type: "object",
  properties: {
    lat: { type: "number", minimum: -90, maximum: 90 },
    lon: { type: "number", minimum: -180, maximum: 180 },
    days: { type: "integer", minimum: 1, maximum: 7, default: 3 },
  },
  required: ["lat", "lon"],
};

const outputSchema = {
  type: "object",
  properties: {
    location: { type: "object" },
    daily: { type: "array", items: { type: "object" } },
    source: { type: "string" },
    payment: { type: "object" },
    rating: { type: "object" },
  },
};

function paymentRequirements() {
  return {
    scheme: "exact",
    network: NETWORK,
    amount: PRICE.toString(),
    asset: USDC,
    payTo: PAY_TO,
    maxTimeoutSeconds: MAX_TIMEOUT_S,
    extra: { name: usdcDomain.name, version: usdcDomain.version },
  };
}

function paymentRequired(error: string) {
  return {
    x402Version: 2,
    error,
    resource: {
      url: PUBLIC_URL + FORECAST_PATH,
      description: "Daily weather forecast (temp min/max, precipitation, wind) for a lat/lon, up to 7 days.",
      mimeType: "application/json",
    },
    accepts: [paymentRequirements()],
    extensions: {
      // Lets an agent learn the call shape from the 402 itself.
      bazaar: { info: { input: { type: "http", method: "GET", queryParams: inputSchema }, output: outputSchema } },
      // Lets an agent jump from the 402 to our onchain identity.
      erc8004: { agentRegistry: AGENT_REGISTRY, agentId: AGENT_ID || null, registration: `${PUBLIC_URL}/.well-known/agent-registration.json` },
    },
  };
}

type Authorization = { from: Address; to: Address; value: bigint; validAfter: bigint; validBefore: bigint; nonce: Hex };

// Accepts x402 v2 (PAYMENT-SIGNATURE) and v1 (X-PAYMENT) headers.
function parsePayment(req: IncomingMessage): { auth: Authorization; signature: Hex } | string {
  const raw = (req.headers["payment-signature"] ?? req.headers["x-payment"]) as string | undefined;
  if (!raw) return "payment required";
  let p: any;
  try {
    p = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return "payment header is not base64 JSON";
  }
  const scheme = p.accepted?.scheme ?? p.scheme;
  const network = p.accepted?.network ?? p.network;
  if (scheme !== "exact") return "unsupported scheme";
  if (network !== NETWORK && network !== "base") return "unsupported network";
  if (p.x402Version === 2 && p.accepted?.asset && getAddress(p.accepted.asset) !== USDC) return "unsupported asset";

  const a = p.payload?.authorization;
  const sig = p.payload?.signature;
  if (!a || !isHex(sig) || !isAddress(a.from) || !isAddress(a.to) || !isHex(a.nonce) || a.nonce.length !== 66) {
    return "malformed payload";
  }
  try {
    return {
      auth: {
        from: getAddress(a.from),
        to: getAddress(a.to),
        value: BigInt(a.value),
        validAfter: BigInt(a.validAfter),
        validBefore: BigInt(a.validBefore),
        nonce: a.nonce,
      },
      signature: sig,
    };
  } catch {
    return "malformed payload";
  }
}

// ---------- verify + settle ----------

const inFlight = new Set<string>(); // guards against the same authorization being raced through twice

async function verify(auth: Authorization, signature: Hex): Promise<string | null> {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (auth.to !== PAY_TO) return "wrong payTo";
  if (auth.value !== PRICE) return "wrong amount";
  if (auth.validAfter > now) return "authorization not yet valid";
  if (auth.validBefore < now + 10n) return "authorization expires too soon";
  if (auth.validBefore > now + BigInt(MAX_TIMEOUT_S) + 60n) return "authorization window too long";

  // publicClient.verifyTypedData handles EOA, ERC-1271 and ERC-6492 signers.
  const ok = await publicClient.verifyTypedData({
    address: auth.from,
    domain: usdcDomain,
    types: transferAuthTypes,
    primaryType: "TransferWithAuthorization",
    message: auth,
    signature,
  });
  if (!ok) return "invalid signature";

  const [used, balance] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: "authorizationState", args: [auth.from, auth.nonce] }),
    publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: "balanceOf", args: [auth.from] }),
  ]);
  if (used) return "authorization already used";
  if (balance < auth.value) return "insufficient USDC balance";
  return null;
}

async function settle(auth: Authorization, signature: Hex): Promise<Hex> {
  const { request } = await publicClient.simulateContract({
    account: SETTLER,
    address: USDC,
    abi: usdcAbi,
    functionName: "transferWithAuthorization",
    args: [auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce, signature],
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
  if (receipt.status !== "success") throw new Error(`settlement reverted: ${hash}`);
  return hash;
}

// ---------- forecast (upstream: Open-Meteo) ----------

type Query = { lat: number; lon: number; days: number };

function parseQuery(url: URL): Query | string {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const days = Number(url.searchParams.get("days") ?? 3);
  if (!url.searchParams.has("lat") || !Number.isFinite(lat) || lat < -90 || lat > 90) return "lat must be in [-90, 90]";
  if (!url.searchParams.has("lon") || !Number.isFinite(lon) || lon < -180 || lon > 180) return "lon must be in [-180, 180]";
  if (!Number.isInteger(days) || days < 1 || days > 7) return "days must be an integer in [1, 7]";
  return { lat, lon, days };
}

async function fetchForecast(q: Query) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(q.lat));
  u.searchParams.set("longitude", String(q.lon));
  u.searchParams.set("forecast_days", String(q.days));
  u.searchParams.set("timezone", "UTC");
  u.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max");
  const r = await fetch(u, { signal: AbortSignal.timeout(8_000) });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  const d: any = await r.json();
  const daily = (d.daily.time as string[]).map((date, i) => ({
    date,
    tempMaxC: d.daily.temperature_2m_max[i],
    tempMinC: d.daily.temperature_2m_min[i],
    precipitationMm: d.daily.precipitation_sum[i],
    precipitationProbabilityPct: d.daily.precipitation_probability_max[i],
    windMaxKmh: d.daily.wind_speed_10m_max[i],
  }));
  return { location: { lat: d.latitude, lon: d.longitude }, daily, source: "open-meteo.com" };
}

// ---------- discovery documents ----------

// ERC-8004 registration file. Same document is the onchain agentURI and the
// domain-verification file at /.well-known/agent-registration.json.
function registrationFile() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "forecast.example.com",
    description:
      "Daily weather forecasts for any lat/lon, up to 7 days. $0.35 USDC per call on Base via x402 (gasless EIP-3009). " +
      "GET /forecast?lat=..&lon=..&days=.. — unpaid requests get HTTP 402 with payment requirements.",
    image: `${PUBLIC_URL}/logo.png`,
    services: [
      { name: "web", endpoint: PUBLIC_URL },
      { name: "x402", endpoint: PUBLIC_URL + FORECAST_PATH },
      { name: "OpenAPI", endpoint: `${PUBLIC_URL}/openapi.json` },
    ],
    x402Support: true,
    active: true,
    registrations: AGENT_ID ? [{ agentId: Number(AGENT_ID), agentRegistry: AGENT_REGISTRY }] : [],
    supportedTrust: ["reputation"],
  };
}

function openApi() {
  return {
    openapi: "3.1.0",
    info: { title: "forecast.example.com", version: "1.0.0", description: "Pay-per-call weather forecasts (x402, USDC on Base)." },
    servers: [{ url: PUBLIC_URL }],
    paths: {
      [FORECAST_PATH]: {
        get: {
          parameters: Object.entries(inputSchema.properties).map(([name, schema]) => ({
            name,
            in: "query",
            required: inputSchema.required.includes(name),
            schema,
          })),
          responses: {
            "200": { description: "Forecast. PAYMENT-RESPONSE header carries the settlement.", content: { "application/json": { schema: outputSchema } } },
            "400": { description: "Bad query (checked before any payment is taken)." },
            "402": { description: "Payment required. PAYMENT-REQUIRED header (base64 JSON, x402 v2); same JSON in body." },
          },
          "x-x402": paymentRequirements(),
        },
      },
    },
  };
}

// ---------- http ----------

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", ...headers });
  res.end(JSON.stringify(body));
}

function send402(res: ServerResponse, error: string) {
  const pr = paymentRequired(error);
  send(res, 402, pr, { "payment-required": b64(pr) });
}

async function handleForecast(req: IncomingMessage, res: ServerResponse, url: URL) {
  // Validate input before touching money, so a bad query never costs the caller.
  const q = parseQuery(url);
  if (typeof q === "string") return send(res, 400, { error: q });

  const parsed = parsePayment(req);
  if (typeof parsed === "string") return send402(res, parsed);
  const { auth, signature } = parsed;

  const key = `${auth.from}:${auth.nonce}`;
  if (inFlight.has(key)) return send402(res, "authorization already in flight");
  inFlight.add(key);
  try {
    const bad = await verify(auth, signature);
    if (bad) return send402(res, bad);

    // Produce the result first; only charge if we can deliver it.
    let forecast;
    try {
      forecast = await fetchForecast(q);
    } catch {
      return send(res, 503, { error: "forecast upstream unavailable, you were not charged" });
    }

    let txHash: Hex;
    try {
      txHash = await settle(auth, signature);
    } catch (e) {
      return send402(res, `settlement failed: ${(e as Error).message.split("\n")[0]}`);
    }

    const settlement = { success: true, transaction: txHash, network: NETWORK, payer: auth.from };
    send(
      res,
      200,
      {
        ...forecast,
        payment: settlement,
        // Everything the caller needs to rate us in the ERC-8004 Reputation Registry.
        rating: {
          reputationRegistry: `${NETWORK}:${REPUTATION_REGISTRY}`,
          agentRegistry: AGENT_REGISTRY,
          agentId: AGENT_ID || null,
          endpoint: PUBLIC_URL + FORECAST_PATH,
          suggestedTags: ["forecast", "accuracy"],
          proofOfPayment: { fromAddress: auth.from, toAddress: PAY_TO, chainId: String(CHAIN_ID), txHash },
        },
      },
      { "payment-response": b64(settlement), "x-payment-response": b64(settlement) },
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
        "access-control-allow-headers": "payment-signature, x-payment, content-type",
        "access-control-expose-headers": "payment-required, payment-response, x-payment-response",
      });
      return res.end();
    }
    if (req.method !== "GET") return send(res, 405, { error: "method not allowed" });

    switch (url.pathname) {
      case FORECAST_PATH:
        return await handleForecast(req, res, url);
      case "/.well-known/agent-registration.json":
        return send(res, 200, registrationFile(), { "cache-control": "public, max-age=300" });
      case "/openapi.json":
        return send(res, 200, openApi(), { "cache-control": "public, max-age=300" });
      case "/":
        return send(res, 200, {
          name: "forecast.example.com",
          price: { amount: PRICE.toString(), asset: USDC, network: NETWORK, usd: "0.35" },
          forecast: PUBLIC_URL + FORECAST_PATH,
          registration: `${PUBLIC_URL}/.well-known/agent-registration.json`,
          openapi: `${PUBLIC_URL}/openapi.json`,
        });
      case "/health":
        return send(res, 200, { ok: true });
      default:
        return send(res, 404, { error: "not found" });
    }
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: "internal error" });
  }
});

server.listen(PORT, () => console.log(`forecast service on :${PORT} (settler ${SETTLER.address}, payTo ${PAY_TO})`));
