// forecast.example.com — pay-per-call weather forecasts for agents.
// x402 v2 ("exact" scheme, EIP-3009 USDC on Base), self-settled, ERC-8004 identity + reputation.
// See design.md.
//
//   npx tsx server.ts                       run the server
//   npx tsx server.ts --print-registration  print the ERC-8004 registration JSON (to pin on IPFS)

import http from "node:http";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http as rpc,
  isAddress,
  isHex,
  nonceManager,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ---------- constants ----------

const CHAIN_ID = 8453;
const NETWORK = `eip155:${CHAIN_ID}`; // CAIP-2 id used by x402 v2
const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // native USDC on Base (FiatTokenV2_2)
const USDC_DOMAIN = { name: "USD Coin", version: "2", chainId: CHAIN_ID, verifyingContract: USDC } as const;
const PRICE = 350_000n; // $0.35, USDC has 6 decimals
const IDENTITY_REGISTRY: Address = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY: Address = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const AGENT_REGISTRY = `eip155:${CHAIN_ID}:${IDENTITY_REGISTRY}`;
const MAX_TIMEOUT_S = 120; // how long a signed authorization may be valid for
const MIN_VALIDITY_LEFT_S = 30; // must still be valid while we settle
const MAX_DAYS = 7;

// ---------- config ----------

function env(name: string, fallback?: string): string {
  const v = process.env[name] || fallback;
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

const PUBLIC_URL = env("PUBLIC_URL", "https://forecast.example.com").replace(/\/$/, "");
const AGENT_ID = process.env.AGENT_ID ? BigInt(process.env.AGENT_ID) : undefined; // set after register()
const WEATHER_API_BASE = env("WEATHER_API_BASE", "https://api.open-meteo.com");
const WEATHER_API_KEY = process.env.WEATHER_API_KEY; // Open-Meteo commercial key (customer-api host)

// ---------- ERC-8004 registration file ----------

function registrationFile() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "forecast.example.com",
    description:
      "Weather forecasts (daily, up to 7 days, any lat/lon) for $0.35 USDC per call on Base via x402. " +
      `GET ${PUBLIC_URL}/forecast?lat=<deg>&lon=<deg>&days=<1-${MAX_DAYS}>. No account or API key.`,
    image: `${PUBLIC_URL}/logo.png`,
    services: [
      { name: "web", endpoint: `${PUBLIC_URL}/forecast` },
      { name: "OpenAPI", endpoint: `${PUBLIC_URL}/openapi.json`, version: "3.1.0" },
    ],
    x402Support: true,
    active: true,
    registrations: AGENT_ID === undefined ? [] : [{ agentId: Number(AGENT_ID), agentRegistry: AGENT_REGISTRY }],
    supportedTrust: ["reputation"],
  };
}

if (process.argv.includes("--print-registration")) {
  console.log(JSON.stringify(registrationFile(), null, 2));
  process.exit(0);
}

// ---------- chain clients ----------

const PAY_TO = getAddress(env("PAY_TO")); // must equal the agentWallet set on the IdentityRegistry
const settler = privateKeyToAccount(env("SETTLER_PRIVATE_KEY") as Hex, { nonceManager }); // holds ETH for gas only
const transport = rpc(env("BASE_RPC_URL", "https://mainnet.base.org"));
const publicClient = createPublicClient({ chain: base, transport });
const walletClient = createWalletClient({ chain: base, transport, account: settler });

const usdcAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  // bytes-signature overload (FiatTokenV2_2): works for EOAs and ERC-1271 smart wallets
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature)",
]);
const identityAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
]);

const authTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

// ---------- x402 ----------

type Requirements = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: Address;
  payTo: Address;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
};

const requirements: Requirements = {
  scheme: "exact",
  network: NETWORK,
  amount: PRICE.toString(),
  asset: USDC,
  payTo: PAY_TO,
  maxTimeoutSeconds: MAX_TIMEOUT_S,
  extra: { name: USDC_DOMAIN.name, version: USDC_DOMAIN.version },
};

function paymentRequired(resourceUrl: string, error?: string) {
  return {
    x402Version: 2,
    ...(error ? { error } : {}),
    resource: { url: resourceUrl, description: "Daily weather forecast", mimeType: "application/json" },
    accepts: [requirements],
    // lets a client that found us by URL jump straight to our onchain identity
    extensions: AGENT_ID === undefined ? {} : { erc8004: { agentRegistry: AGENT_REGISTRY, agentId: AGENT_ID.toString() } },
  };
}

type Authorization = { from: Address; to: Address; value: bigint; validAfter: bigint; validBefore: bigint; nonce: Hex };
type Payment = { authorization: Authorization; signature: Hex };

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

class PaymentError extends Error {}

// Cheap structural checks only — no RPC calls here.
function parsePayment(header: string): Payment {
  let p: any;
  try {
    p = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    throw new PaymentError("payment header is not base64 JSON");
  }
  if (p?.x402Version !== 2) throw new PaymentError("only x402Version 2 is supported");
  const acc = p.accepted ?? {};
  if (acc.scheme !== "exact" || acc.network !== NETWORK) throw new PaymentError(`expected scheme exact on ${NETWORK}`);
  if (typeof acc.asset !== "string" || !isAddress(acc.asset) || getAddress(acc.asset) !== USDC) throw new PaymentError("wrong asset");

  const a = p.payload?.authorization ?? {};
  const sig = p.payload?.signature;
  if (!isHex(sig)) throw new PaymentError("missing signature");
  if (!isAddress(a.from) || !isAddress(a.to)) throw new PaymentError("bad from/to");
  if (!isHex(a.nonce) || a.nonce.length !== 66) throw new PaymentError("bad nonce");

  let auth: Authorization;
  try {
    auth = {
      from: getAddress(a.from),
      to: getAddress(a.to),
      value: BigInt(a.value),
      validAfter: BigInt(a.validAfter),
      validBefore: BigInt(a.validBefore),
      nonce: a.nonce,
    };
  } catch {
    throw new PaymentError("bad numeric field");
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (auth.to !== PAY_TO) throw new PaymentError("payTo mismatch");
  if (auth.value !== PRICE) throw new PaymentError(`value must be exactly ${PRICE}`);
  if (auth.validAfter > now) throw new PaymentError("authorization not yet valid");
  if (auth.validBefore < now + BigInt(MIN_VALIDITY_LEFT_S)) throw new PaymentError("authorization expires too soon");
  if (auth.validBefore > now + BigInt(MAX_TIMEOUT_S) + 60n) throw new PaymentError("authorization valid for too long");
  return { authorization: auth, signature: sig };
}

// Onchain checks: signature (EOA, ERC-1271, ERC-6492), unused nonce, balance.
async function verifyPayment({ authorization: a, signature }: Payment) {
  const [sigOk, used, balance] = await Promise.all([
    publicClient.verifyTypedData({
      address: a.from,
      domain: USDC_DOMAIN,
      types: authTypes,
      primaryType: "TransferWithAuthorization",
      message: a,
      signature,
    }),
    publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: "authorizationState", args: [a.from, a.nonce] }),
    publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: "balanceOf", args: [a.from] }),
  ]);
  if (!sigOk) throw new PaymentError("invalid signature");
  if (used) throw new PaymentError("authorization nonce already used");
  if (balance < a.value) throw new PaymentError("insufficient USDC balance");
}

// We pay the gas (ETH) from the settler key; the caller only signed.
async function settlePayment({ authorization: a, signature }: Payment): Promise<Hex> {
  const args = [a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce, signature] as const;
  const { request } = await publicClient.simulateContract({
    account: settler,
    address: USDC,
    abi: usdcAbi,
    functionName: "transferWithAuthorization",
    args,
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status !== "success") throw new PaymentError(`settlement reverted: ${hash}`);
  return hash;
}

// ---------- forecast upstream ----------

async function fetchForecast(lat: number, lon: number, days: number) {
  const host = WEATHER_API_KEY ? WEATHER_API_BASE.replace("://api.", "://customer-api.") : WEATHER_API_BASE;
  const u = new URL("/v1/forecast", host);
  u.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    forecast_days: String(days),
    timezone: "auto",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
    ...(WEATHER_API_KEY ? { apikey: WEATHER_API_KEY } : {}),
  }).toString();
  const r = await fetch(u, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  const j: any = await r.json();
  if (!j?.daily?.time) throw new Error("upstream returned no daily data");
  const d = j.daily;
  return {
    location: { lat, lon, timezone: j.timezone },
    units: j.daily_units,
    daily: d.time.map((date: string, i: number) => ({
      date,
      weatherCode: d.weather_code[i],
      tempMaxC: d.temperature_2m_max[i],
      tempMinC: d.temperature_2m_min[i],
      precipitationMm: d.precipitation_sum[i],
      precipitationProbabilityPct: d.precipitation_probability_max[i],
      windSpeedMaxKmh: d.wind_speed_10m_max[i],
    })),
    source: "open-meteo.com",
  };
}

// ---------- replay / double-spend guard ----------

type Cached = { headers: Record<string, string>; body: string; expiresAt: number };
const inFlight = new Set<string>();
const settled = new Map<string, Cached>(); // lets a caller that lost the response re-fetch it with the same payment
const CACHE_MS = 10 * 60_000;

function remember(key: string, c: Omit<Cached, "expiresAt">) {
  const now = Date.now();
  for (const [k, v] of settled) if (v.expiresAt < now) settled.delete(k);
  settled.set(key, { ...c, expiresAt: now + CACHE_MS });
}

// ---------- HTTP ----------

function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", ...headers });
  res.end(text);
}

const discoveryLink = `<${PUBLIC_URL}/.well-known/agent-registration.json>; rel="describedby"`;

async function handleForecast(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  // Validate input before asking for money, so nobody pays for a bad request.
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const days = Number(url.searchParams.get("days") ?? "3");
  if (!url.searchParams.has("lat") || !url.searchParams.has("lon") || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180))
    return send(res, 400, { error: "lat in [-90,90] and lon in [-180,180] are required" });
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS)
    return send(res, 400, { error: `days must be an integer 1-${MAX_DAYS}` });

  const resourceUrl = `${PUBLIC_URL}${url.pathname}${url.search}`;
  const ask = (error?: string) => {
    const pr = paymentRequired(resourceUrl, error);
    send(res, 402, pr, { "payment-required": b64(pr), link: discoveryLink });
  };

  const header = req.headers["payment-signature"];
  if (typeof header !== "string") return ask();

  let payment: Payment;
  try {
    payment = parsePayment(header);
  } catch (e) {
    return ask((e as Error).message);
  }

  const key = `${payment.authorization.from}:${payment.authorization.nonce}`;
  const cached = settled.get(key);
  if (cached && cached.expiresAt > Date.now()) return send(res, 200, cached.body, cached.headers);
  if (inFlight.has(key)) return send(res, 409, { error: "this payment is already being processed" });
  inFlight.add(key);

  try {
    try {
      await verifyPayment(payment);
    } catch (e) {
      if (e instanceof PaymentError) return ask(e.message);
      throw e;
    }

    // Produce the result before charging: if upstream fails, the caller is not charged.
    let forecast;
    try {
      forecast = await fetchForecast(lat, lon, days);
    } catch (e) {
      console.error("upstream error", e);
      return send(res, 502, { error: "forecast upstream unavailable; you were not charged" });
    }

    let tx: Hex;
    try {
      tx = await settlePayment(payment);
    } catch (e) {
      console.error("settlement failed", e);
      return ask("settlement failed");
    }

    const body = JSON.stringify({
      ...forecast,
      payment: { network: NETWORK, transaction: tx, payer: payment.authorization.from, amount: PRICE.toString() },
      // Everything the caller needs to rate this call on the ERC-8004 ReputationRegistry.
      rating:
        AGENT_ID === undefined
          ? null
          : {
              reputationRegistry: `eip155:${CHAIN_ID}:${REPUTATION_REGISTRY}`,
              agentId: AGENT_ID.toString(),
              endpoint: `${PUBLIC_URL}/forecast`,
              suggestedTags: [["quality", "forecast"], ["latency", "forecast"]],
              note: "call giveFeedback from the payer address so readers can match it to this payment",
            },
    });
    const headers = {
      "payment-response": b64({ success: true, transaction: tx, network: NETWORK, payer: payment.authorization.from }),
      link: discoveryLink,
    };
    remember(key, { headers, body });
    return send(res, 200, body, headers);
  } finally {
    inFlight.delete(key);
  }
}

const openapi = {
  openapi: "3.1.0",
  info: { title: "forecast.example.com", version: "1.0.0", description: "Pay-per-call weather forecasts via x402 (USDC on Base)." },
  servers: [{ url: PUBLIC_URL }],
  paths: {
    "/forecast": {
      get: {
        summary: "Daily forecast for a coordinate",
        parameters: [
          { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
          { name: "lon", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
          { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: MAX_DAYS, default: 3 } },
        ],
        "x-x402": requirements,
        responses: {
          "200": { description: "Forecast; PAYMENT-RESPONSE header carries the settlement tx" },
          "400": { description: "Invalid parameters (no payment requested)" },
          "402": { description: "Payment required; PAYMENT-REQUIRED header (base64 JSON, x402 v2)" },
          "502": { description: "Upstream failure; not charged" },
        },
      },
    },
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", PUBLIC_URL);
  try {
    if (req.method === "OPTIONS")
      return send(res, 204, "", {
        "access-control-allow-headers": "payment-signature",
        "access-control-expose-headers": "payment-required, payment-response, link",
      });
    if (req.method !== "GET") return send(res, 405, { error: "GET only" });
    switch (url.pathname) {
      case "/forecast":
        return await handleForecast(req, res, url);
      case "/.well-known/agent-registration.json":
        return send(res, 200, registrationFile());
      case "/openapi.json":
        return send(res, 200, openapi);
      case "/health":
        return send(res, 200, { ok: true });
      default:
        return send(res, 404, { error: "not found" }, { link: discoveryLink });
    }
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: "internal error" });
  }
});

// Refuse to start if our onchain identity doesn't match config — clients will check the same thing.
async function checkIdentity() {
  if (AGENT_ID === undefined) {
    console.warn("AGENT_ID not set: service is not discoverable/trustable until registered (see design.md)");
    return;
  }
  const [owner, uri] = await Promise.all([
    publicClient.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "ownerOf", args: [AGENT_ID] }),
    publicClient.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "tokenURI", args: [AGENT_ID] }),
  ]);
  const wallet = await publicClient
    .readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: "getAgentWallet", args: [AGENT_ID] })
    .catch(() => undefined);
  if (wallet && getAddress(wallet) !== PAY_TO) throw new Error(`onchain agentWallet ${wallet} != PAY_TO ${PAY_TO}`);
  if (settler.address === owner) console.warn("settler key is the agent owner — use a separate gas-only key");
  console.log(`agent ${AGENT_REGISTRY}#${AGENT_ID} owner=${owner} uri=${uri} agentWallet=${wallet ?? "unknown"}`);
}

const PORT = Number(process.env.PORT ?? 8080);
checkIdentity()
  .then(() => server.listen(PORT, () => console.log(`listening on :${PORT}, payTo=${PAY_TO}, settler=${settler.address}`)))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
