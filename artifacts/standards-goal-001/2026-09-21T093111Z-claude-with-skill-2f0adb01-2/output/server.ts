// forecast.example.com — pay-per-call weather forecasts for autonomous agents.
//
// Payment: x402 v2, "exact" scheme, USDC on Base via EIP-3009 transferWithAuthorization.
//          The caller only signs; this server submits the tx and pays the ETH gas.
// Identity/reputation: ERC-8004 registries on Base. See design.md.
//
// Run:  npm start                  (serves HTTP)
//       npm run registration-uri   (prints the data: URI to pass to setAgentURI)

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  isAddress,
  isHex,
  parseEther,
  size,
  sliceHex,
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
const BASE_RPC_URL = env("BASE_RPC_URL", "https://mainnet.base.org");
const AGENT_ID = BigInt(env("AGENT_ID")); // ERC-721 tokenId from IdentityRegistry.register()
const PAY_TO = getAddress(env("PAY_TO")); // cold wallet; must equal onchain agentWallet
const SETTLER_KEY = env("SETTLER_PRIVATE_KEY") as Hex; // hot key, holds only ETH for gas
const WEATHER_API_URL = env("WEATHER_API_URL", "https://api.open-meteo.com/v1/forecast");
const WEATHER_API_KEY = process.env.WEATHER_API_KEY; // Open-Meteo commercial key, optional
const FEEDBACK_PAYMASTER_URL = process.env.FEEDBACK_PAYMASTER_URL; // optional ERC-4337 sponsor

const CHAIN_ID = 8453;
const NETWORK = `eip155:${CHAIN_ID}`;
const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const IDENTITY_REGISTRY: Address = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY: Address = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const AGENT_REGISTRY_ID = `${NETWORK}:${IDENTITY_REGISTRY}`;

const PRICE = 350_000n; // $0.35, USDC has 6 decimals
const MAX_TIMEOUT_SECONDS = 120;
const FORECAST_PATH = "/v1/forecast";

// ---------- chain clients ----------

const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC_URL) });
const settler = createWalletClient({
  account: privateKeyToAccount(SETTLER_KEY),
  chain: base,
  transport: http(BASE_RPC_URL),
});

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
      { name: "signature", type: "bytes" },
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
] as const;

const identityAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "getMetadata",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
    ],
    outputs: [{ type: "bytes" }],
  },
] as const;

// EIP-3009 typed data. USDC on Base: name "USD Coin", version "2".
const USDC_DOMAIN = { name: "USD Coin", version: "2", chainId: CHAIN_ID, verifyingContract: USDC } as const;
const AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

// ---------- published documents ----------

const forecastUrl = `${PUBLIC_URL}${FORECAST_PATH}`;

// ERC-8004 registration file. The same JSON is the onchain agentURI (as a data: URI)
// and is served at /.well-known/agent-registration.json to bind this domain to the agentId.
function registrationFile() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "forecast.example.com",
    description:
      "Weather forecasts (1-7 days, daily) for any lat/lon. $0.35 USDC per call on Base via x402 " +
      "(exact scheme, EIP-3009; payer needs no ETH). Rate us in the ERC-8004 ReputationRegistry " +
      "with tag1=starred, tag2=forecast.",
    image: `${PUBLIC_URL}/logo.png`,
    services: [
      { name: "web", endpoint: `${PUBLIC_URL}/` },
      { name: "OpenAPI", endpoint: `${PUBLIC_URL}/openapi.json`, version: "3.1.0" },
    ],
    x402Support: true,
    active: true,
    registrations: [{ agentId: Number(AGENT_ID), agentRegistry: AGENT_REGISTRY_ID }],
    supportedTrust: ["reputation"],
    // Non-standard but harmless extra fields; clients cross-check them against the 402 response.
    pricing: [{ endpoint: forecastUrl, scheme: "exact", network: NETWORK, asset: USDC, amount: PRICE.toString(), payTo: PAY_TO }],
  };
}

function registrationDataUri(): string {
  const json = JSON.stringify(registrationFile());
  return `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
}

function openApi() {
  return {
    openapi: "3.1.0",
    info: { title: "forecast.example.com", version: "1.0.0", description: "Pay-per-call weather forecasts. x402 v2 on Base." },
    servers: [{ url: PUBLIC_URL }],
    paths: {
      [FORECAST_PATH]: {
        get: {
          summary: "Daily forecast for a coordinate",
          "x-x402": { scheme: "exact", network: NETWORK, asset: USDC, amount: PRICE.toString(), payTo: PAY_TO },
          parameters: [
            { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
            { name: "lon", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
            { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 7, default: 3 } },
          ],
          responses: {
            "200": { description: "Forecast. PAYMENT-RESPONSE header carries the settlement tx." },
            "400": { description: "Invalid parameters (never charged)." },
            "402": { description: "Payment required. PAYMENT-REQUIRED header (base64 JSON) lists accepted payments." },
            "503": { description: "Upstream unavailable (not charged)." },
          },
        },
      },
    },
  };
}

// ---------- x402 ----------

type PaymentRequirements = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: Address;
  payTo: Address;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
};

const requirements: PaymentRequirements = {
  scheme: "exact",
  network: NETWORK,
  amount: PRICE.toString(),
  asset: USDC,
  payTo: PAY_TO,
  maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
  extra: { name: USDC_DOMAIN.name, version: USDC_DOMAIN.version },
};

type Authorization = { from: Address; to: Address; value: bigint; validAfter: bigint; validBefore: bigint; nonce: Hex };
type VerifiedPayment = { auth: Authorization; signature: Hex };

const b64json = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");

function send402(res: ServerResponse, resourceUrl: string, error?: string) {
  const body = {
    x402Version: 2,
    error,
    resource: { url: resourceUrl, description: "Weather forecast, $0.35 per call", mimeType: "application/json" },
    accepts: [requirements],
    // Lets a first-time caller tie this price/payTo to the onchain identity before paying.
    extensions: { erc8004: { agentRegistry: AGENT_REGISTRY_ID, agentId: AGENT_ID.toString() } },
  };
  res.writeHead(402, { "Content-Type": "application/json", "PAYMENT-REQUIRED": b64json(body) });
  res.end(JSON.stringify(body));
}

// Authorization nonces currently being verified/settled, to stop the same signed
// payment buying two responses when requests race.
const inFlight = new Set<string>();

// Decodes and checks a PAYMENT-SIGNATURE header. Returns an error string or the payment.
async function verifyPayment(header: string): Promise<VerifiedPayment | string> {
  let p: any;
  try {
    p = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return "invalid_payload";
  }
  if (p?.x402Version !== 2) return "unsupported_x402_version";
  const a = p.accepted;
  if (a?.scheme !== "exact" || a?.network !== NETWORK) return "unsupported_scheme_or_network";
  if (!isAddress(a?.asset ?? "") || getAddress(a.asset) !== USDC) return "wrong_asset";

  const raw = p.payload?.authorization;
  const signature = p.payload?.signature;
  if (!raw || !isHex(signature)) return "invalid_payload";
  if (!isAddress(raw.from ?? "") || !isAddress(raw.to ?? "") || !isHex(raw.nonce) || size(raw.nonce) !== 32) {
    return "invalid_payload";
  }
  let auth: Authorization;
  try {
    auth = {
      from: getAddress(raw.from),
      to: getAddress(raw.to),
      value: BigInt(raw.value),
      validAfter: BigInt(raw.validAfter),
      validBefore: BigInt(raw.validBefore),
      nonce: raw.nonce,
    };
  } catch {
    return "invalid_payload";
  }

  if (auth.to !== PAY_TO) return "wrong_recipient";
  if (auth.value !== PRICE) return "wrong_amount";
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (auth.validAfter > now) return "authorization_not_yet_valid";
  // Need headroom to get the settlement mined before it expires.
  if (auth.validBefore < now + 10n) return "authorization_expired";

  // Handles EOAs and ERC-1271 smart wallets.
  const sigOk = await publicClient
    .verifyTypedData({
      address: auth.from,
      domain: USDC_DOMAIN,
      types: AUTH_TYPES,
      primaryType: "TransferWithAuthorization",
      message: auth,
      signature,
    })
    .catch(() => false);
  if (!sigOk) return "invalid_signature";

  const used = await publicClient.readContract({
    address: USDC,
    abi: usdcAbi,
    functionName: "authorizationState",
    args: [auth.from, auth.nonce],
  });
  if (used) return "nonce_already_used";

  // Dry-run before doing any work, so unfunded or blacklisted payers cost us nothing.
  const transferOk = await publicClient
    .simulateContract({
      account: settler.account,
      address: USDC,
      abi: usdcAbi,
      functionName: "transferWithAuthorization",
      args: [auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce, signature],
    })
    .then(() => true)
    .catch(() => false);
  if (!transferOk) return "insufficient_funds_or_transfer_blocked";

  return { auth, signature };
}

// Submits transferWithAuthorization and waits for inclusion.
// USDC moves payer -> PAY_TO directly; the settler only spends ETH gas.
async function settle({ auth, signature }: VerifiedPayment): Promise<Hex> {
  const args = [auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce, signature] as const;
  // Re-simulated: balance may have moved since verification.
  const { request } = await publicClient.simulateContract({
    account: settler.account,
    address: USDC,
    abi: usdcAbi,
    functionName: "transferWithAuthorization",
    args,
  });
  const hash = await settler.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
  if (receipt.status !== "success") throw new Error(`settlement reverted: ${hash}`);
  return hash;
}

// ---------- forecast ----------

type ForecastQuery = { lat: number; lon: number; days: number };

function parseQuery(url: URL): ForecastQuery | string {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const days = Number(url.searchParams.get("days") ?? "3");
  if (!url.searchParams.has("lat") || !Number.isFinite(lat) || lat < -90 || lat > 90) return "lat must be -90..90";
  if (!url.searchParams.has("lon") || !Number.isFinite(lon) || lon < -180 || lon > 180) return "lon must be -180..180";
  if (!Number.isInteger(days) || days < 1 || days > 7) return "days must be integer 1..7";
  return { lat, lon, days };
}

async function fetchForecast(q: ForecastQuery) {
  const u = new URL(WEATHER_API_URL);
  u.searchParams.set("latitude", String(q.lat));
  u.searchParams.set("longitude", String(q.lon));
  u.searchParams.set("forecast_days", String(q.days));
  u.searchParams.set("timezone", "UTC");
  u.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
  );
  if (WEATHER_API_KEY) u.searchParams.set("apikey", WEATHER_API_KEY);
  const r = await fetch(u, { signal: AbortSignal.timeout(8_000) });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  const d: any = await r.json();
  return { latitude: d.latitude, longitude: d.longitude, units: d.daily_units, daily: d.daily };
}

// ---------- handlers ----------

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

async function handleForecast(req: IncomingMessage, res: ServerResponse, url: URL) {
  // Bad input is rejected before any payment is requested or taken.
  const q = parseQuery(url);
  if (typeof q === "string") return sendJson(res, 400, { error: q });

  const resourceUrl = `${PUBLIC_URL}${url.pathname}${url.search}`;
  const header = req.headers["payment-signature"];
  if (typeof header !== "string") return send402(res, resourceUrl);

  const verified = await verifyPayment(header);
  if (typeof verified === "string") return send402(res, resourceUrl, verified);

  const key = `${verified.auth.from}:${verified.auth.nonce}`;
  if (inFlight.has(key)) return send402(res, resourceUrl, "payment_in_progress");
  inFlight.add(key);
  try {
    // Fetch first: if upstream is down the caller is not charged.
    let forecast;
    try {
      forecast = await fetchForecast(q);
    } catch (e) {
      console.error("upstream", e);
      return sendJson(res, 503, { error: "forecast_unavailable", charged: false }, { "Retry-After": "30" });
    }

    let txHash: Hex;
    try {
      txHash = await settle(verified);
    } catch (e) {
      console.error("settle", (e as Error).message.split("\n")[0]);
      return send402(res, resourceUrl, "settlement_failed");
    }

    const paymentResponse = { success: true, transaction: txHash, network: NETWORK, payer: verified.auth.from };
    sendJson(
      res,
      200,
      {
        forecast,
        source: "open-meteo",
        generatedAt: new Date().toISOString(),
        payment: { ...paymentResponse, amount: PRICE.toString(), asset: USDC, payTo: PAY_TO },
        feedback: feedbackHint(verified.auth.from, txHash),
      },
      { "PAYMENT-RESPONSE": b64json(paymentResponse) },
    );
  } finally {
    inFlight.delete(key);
  }
}

// Everything the caller needs to rate us in the ERC-8004 ReputationRegistry, including
// the proofOfPayment that lets other agents count this rating as coming from a real customer.
function feedbackHint(payer: Address, txHash: Hex) {
  return {
    reputationRegistry: `${NETWORK}:${REPUTATION_REGISTRY}`,
    call: "giveFeedback(uint256 agentId,int128 value,uint8 valueDecimals,string tag1,string tag2,string endpoint,string feedbackURI,bytes32 feedbackHash)",
    agentId: AGENT_ID.toString(),
    suggested: { tag1: "starred", tag2: "forecast", valueDecimals: 0, valueRange: [0, 100], endpoint: forecastUrl },
    feedbackFile: {
      agentRegistry: AGENT_REGISTRY_ID,
      agentId: Number(AGENT_ID),
      clientAddress: `${NETWORK}:${payer}`,
      endpoint: forecastUrl,
      proofOfPayment: { fromAddress: payer, toAddress: PAY_TO, chainId: String(CHAIN_ID), txHash },
    },
    gas: FEEDBACK_PAYMASTER_URL
      ? { erc4337Paymaster: FEEDBACK_PAYMASTER_URL, sponsors: "any giveFeedback to this agentId from a paying address, any value" }
      : { note: "no ETH? send as an ERC-4337 UserOperation with a USDC-accepting paymaster" },
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", PUBLIC_URL);
  try {
    if (req.method !== "GET") return sendJson(res, 405, { error: "method_not_allowed" }, { Allow: "GET" });
    switch (url.pathname) {
      case FORECAST_PATH:
        return await handleForecast(req, res, url);
      case "/.well-known/agent-registration.json":
        return sendJson(res, 200, registrationFile(), { "Cache-Control": "max-age=300" });
      case "/openapi.json":
        return sendJson(res, 200, openApi(), { "Cache-Control": "max-age=300" });
      case "/health":
        return sendJson(res, 200, { ok: true });
      case "/":
        return sendJson(res, 200, {
          name: "forecast.example.com",
          forecast: forecastUrl,
          openapi: `${PUBLIC_URL}/openapi.json`,
          registration: `${PUBLIC_URL}/.well-known/agent-registration.json`,
          erc8004: { agentRegistry: AGENT_REGISTRY_ID, agentId: AGENT_ID.toString() },
        });
      default:
        return sendJson(res, 404, { error: "not_found" });
    }
  } catch (e) {
    console.error(e);
    if (!res.headersSent) sendJson(res, 500, { error: "internal_error" });
  }
});

// Startup self-check: warn if onchain identity disagrees with what this server advertises.
async function checkOnchainIdentity() {
  try {
    const [owner, uri, walletBytes] = await Promise.all([
      publicClient.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "ownerOf", args: [AGENT_ID] }),
      publicClient.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "tokenURI", args: [AGENT_ID] }),
      publicClient.readContract({
        address: IDENTITY_REGISTRY,
        abi: identityAbi,
        functionName: "getMetadata",
        args: [AGENT_ID, "agentWallet"],
      }),
    ]);
    console.log(`agent ${AGENT_ID} owner ${owner}`);
    if (uri !== registrationDataUri()) console.warn("WARN onchain agentURI != current registration file; run setAgentURI");
    // agentWallet may be stored packed (20 bytes) or abi-encoded (32 bytes).
    const n = size(walletBytes);
    const wallet = n === 20 ? getAddress(walletBytes) : n === 32 ? getAddress(sliceHex(walletBytes, 12)) : undefined;
    if (wallet !== PAY_TO) console.warn(`WARN onchain agentWallet ${wallet ?? "unset"} != PAY_TO ${PAY_TO}`);
    const ethBal = await publicClient.getBalance({ address: settler.account.address });
    if (ethBal < parseEther("0.01")) console.warn(`WARN settler ${settler.account.address} has < 0.01 ETH`);
  } catch (e) {
    console.warn("WARN onchain identity check failed:", (e as Error).message);
  }
}

if (process.argv.includes("--registration-uri")) {
  console.log(registrationDataUri());
} else {
  server.listen(PORT, () => {
    console.log(`listening on :${PORT}, selling ${forecastUrl} for ${PRICE} USDC units`);
    void checkOnchainIdentity();
  });
}
