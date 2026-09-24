// forecast.example.com — pay-per-call weather forecasts for agents.
// Payment: x402 v2, "exact" scheme, USDC on Base via EIP-3009 (payer needs no ETH).
// Identity + reputation: ERC-8004 registries on Base.
// See design.md for the full architecture.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
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
const PAY_TO = getAddress(env("PAY_TO")); // must equal the agentWallet set in ERC-8004
const SETTLER_KEY = env("SETTLER_PRIVATE_KEY") as Hex; // hot key holding a little ETH on Base for settlement gas
const AGENT_ID = env("AGENT_ID"); // ERC-8004 agentId returned by register()
const OPEN_METEO_KEY = process.env.OPEN_METEO_API_KEY; // commercial use needs a key

const CHAIN_ID = 8453;
const NETWORK = `eip155:${CHAIN_ID}`; // CAIP-2
const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRICE = 350_000n; // $0.35, USDC has 6 decimals
const MAX_TIMEOUT_SECONDS = 120;

// ERC-8004 singletons (verify against the deployed addresses before launch)
const IDENTITY_REGISTRY: Address = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY: Address = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";

const RESOURCE_URL = `${PUBLIC_URL}/forecast`;
const REGISTRATION_URL = `${PUBLIC_URL}/.well-known/agent-registration.json`;

// ---------- chain clients ----------

const settler = privateKeyToAccount(SETTLER_KEY);
const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account: settler, chain: base, transport: http(RPC_URL) });

const usdcAbi = [
  {
    // FiatToken v2.2 overload: accepts EOA sigs and ERC-1271 smart-account sigs
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

// ---------- x402 ----------

const paymentRequirements = {
  scheme: "exact",
  network: NETWORK,
  amount: PRICE.toString(),
  asset: USDC,
  payTo: PAY_TO,
  maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
  extra: { name: usdcDomain.name, version: usdcDomain.version },
};

// Pointers a first-time client uses to check who it is paying before it signs anything.
const agentRef = {
  agentRegistry: `${NETWORK}:${IDENTITY_REGISTRY}`,
  agentId: AGENT_ID,
  registration: REGISTRATION_URL,
  reputationRegistry: `${NETWORK}:${REPUTATION_REGISTRY}`,
};

function paymentRequired(error?: string) {
  return {
    x402Version: 2,
    ...(error ? { error } : {}),
    resource: {
      url: RESOURCE_URL,
      description: "Daily weather forecast (1-16 days) for a lat/lon. One call = one payment.",
      mimeType: "application/json",
    },
    accepts: [paymentRequirements],
    extensions: { erc8004: agentRef },
  };
}

type Authorization = {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
};

class PaymentError extends Error {}

function decodePayment(header: string): { auth: Authorization; signature: Hex } {
  let p: any;
  try {
    p = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    throw new PaymentError("invalid_payload: not base64 JSON");
  }
  if (p?.x402Version !== 2) throw new PaymentError("unsupported_x402_version");
  const acc = p.accepted ?? {};
  if (acc.scheme !== "exact" || acc.network !== NETWORK) throw new PaymentError("unsupported_scheme_or_network");
  if (typeof acc.asset !== "string" || getAddress(acc.asset) !== USDC) throw new PaymentError("wrong_asset");

  const a = p.payload?.authorization;
  const signature = p.payload?.signature;
  if (!a || !isHex(signature)) throw new PaymentError("invalid_payload");
  if (!isAddress(a.from) || !isAddress(a.to) || !isHex(a.nonce) || a.nonce.length !== 66) {
    throw new PaymentError("invalid_payload");
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
      signature,
    };
  } catch {
    throw new PaymentError("invalid_payload");
  }
}

// Checks everything without spending gas. simulateContract runs the real USDC
// code, so balance, used nonce, time window and signature are all enforced by the token itself.
async function verifyPayment(auth: Authorization, signature: Hex) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (auth.to !== PAY_TO) throw new PaymentError("invalid_recipient");
  if (auth.value !== PRICE) throw new PaymentError("invalid_amount");
  if (auth.validAfter > now) throw new PaymentError("authorization_not_yet_valid");
  if (auth.validBefore < now + 10n) throw new PaymentError("authorization_expired");
  if (auth.validBefore > now + BigInt(MAX_TIMEOUT_SECONDS) + 600n) throw new PaymentError("authorization_window_too_long");

  const sigOk = await publicClient.verifyTypedData({
    address: auth.from,
    domain: usdcDomain,
    types: transferAuthTypes,
    primaryType: "TransferWithAuthorization",
    message: auth,
    signature,
  });
  if (!sigOk) throw new PaymentError("invalid_signature");

  try {
    const { request } = await publicClient.simulateContract({
      account: settler,
      address: USDC,
      abi: usdcAbi,
      functionName: "transferWithAuthorization",
      args: [auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce, signature],
    });
    return request;
  } catch (e: any) {
    throw new PaymentError(`settlement_would_fail: ${e?.shortMessage ?? "revert"}`);
  }
}

// Sends are serialized so concurrent settlements don't race on the settler's tx nonce.
let sendQueue: Promise<unknown> = Promise.resolve();
function sendSerialized(request: Awaited<ReturnType<typeof verifyPayment>>): Promise<Hex> {
  const next = sendQueue.then(() => walletClient.writeContract(request));
  sendQueue = next.catch(() => undefined);
  return next;
}

async function settle(request: Awaited<ReturnType<typeof verifyPayment>>): Promise<Hex> {
  const hash = await sendSerialized(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new PaymentError("settlement_reverted");
  return hash;
}

// Same authorization presented twice at once: only the first gets in.
const inFlight = new Set<string>();

// ---------- forecast upstream ----------

type ForecastQuery = { lat: number; lon: number; days: number };

function parseQuery(url: URL): ForecastQuery | string {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const days = Number(url.searchParams.get("days") ?? "3");
  if (!url.searchParams.has("lat") || !Number.isFinite(lat) || lat < -90 || lat > 90) return "lat must be in [-90, 90]";
  if (!url.searchParams.has("lon") || !Number.isFinite(lon) || lon < -180 || lon > 180) return "lon must be in [-180, 180]";
  if (!Number.isInteger(days) || days < 1 || days > 16) return "days must be an integer in [1, 16]";
  return { lat, lon, days };
}

async function fetchForecast(q: ForecastQuery) {
  const host = OPEN_METEO_KEY ? "https://customer-api.open-meteo.com" : "https://api.open-meteo.com";
  const u = new URL("/v1/forecast", host);
  u.searchParams.set("latitude", String(q.lat));
  u.searchParams.set("longitude", String(q.lon));
  u.searchParams.set("forecast_days", String(q.days));
  u.searchParams.set("timezone", "UTC");
  u.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
  );
  if (OPEN_METEO_KEY) u.searchParams.set("apikey", OPEN_METEO_KEY);

  const res = await fetch(u, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const data: any = await res.json();
  return {
    location: { lat: data.latitude, lon: data.longitude, elevationM: data.elevation },
    units: data.daily_units,
    daily: data.daily,
    source: "open-meteo.com",
    generatedAt: new Date().toISOString(),
  };
}

// ---------- discovery documents ----------

// ERC-8004 registration file. Same JSON the onchain agentURI points to.
const registrationFile = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "forecast.example.com",
  description:
    "Daily weather forecasts for any lat/lon, 1-16 days. $0.35 USDC per call on Base via x402 (gasless for the payer). " +
    `GET ${RESOURCE_URL}?lat=<deg>&lon=<deg>&days=<1-16>. Machine-readable spec: ${PUBLIC_URL}/openapi.json`,
  image: `${PUBLIC_URL}/logo.png`,
  services: [
    { name: "web", endpoint: RESOURCE_URL },
    { name: "OpenAPI", endpoint: `${PUBLIC_URL}/openapi.json` },
    { name: "agentWallet", endpoint: `${NETWORK}:${PAY_TO}` },
  ],
  x402Support: true,
  active: true,
  registrations: [{ agentId: Number(AGENT_ID), agentRegistry: `${NETWORK}:${IDENTITY_REGISTRY}` }],
  supportedTrust: ["reputation"],
};

const openapi = {
  openapi: "3.1.0",
  info: { title: "forecast.example.com", version: "1.0.0", description: registrationFile.description },
  servers: [{ url: PUBLIC_URL }],
  paths: {
    "/forecast": {
      get: {
        summary: "Daily forecast. Requires x402 payment of 0.35 USDC on Base.",
        "x-x402": paymentRequirements,
        "x-erc8004": agentRef,
        parameters: [
          { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
          { name: "lon", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
          { name: "days", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 16, default: 3 } },
          { name: "PAYMENT-SIGNATURE", in: "header", required: false, description: "base64 x402 v2 PaymentPayload", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Forecast. PAYMENT-RESPONSE header carries the settlement tx." },
          "400": { description: "Bad query. Nothing charged." },
          "402": { description: "Payment required or rejected. PAYMENT-REQUIRED header + body carry x402 requirements." },
          "502": { description: "Upstream failed. Nothing charged." },
        },
      },
    },
  },
};

// ---------- http ----------

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, Link",
    link: `<${REGISTRATION_URL}>; rel="describedby"`,
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function send402(res: ServerResponse, error?: string) {
  const body = paymentRequired(error);
  send(res, 402, body, { "PAYMENT-REQUIRED": b64(body) });
}

async function handleForecast(req: IncomingMessage, res: ServerResponse, url: URL) {
  // Validate input before asking for money, so a bad query is never charged.
  const q = parseQuery(url);
  if (typeof q === "string") return send(res, 400, { error: q });

  const header = req.headers["payment-signature"];
  if (typeof header !== "string") return send402(res);

  let auth: Authorization, signature: Hex;
  try {
    ({ auth, signature } = decodePayment(header));
  } catch (e) {
    return send402(res, (e as Error).message);
  }

  const key = `${auth.from}:${auth.nonce}`;
  if (inFlight.has(key)) return send402(res, "authorization_in_use");
  inFlight.add(key);
  try {
    const request = await verifyPayment(auth, signature);

    // Fetch before settling: if upstream is down the caller pays nothing.
    let forecast;
    try {
      forecast = await fetchForecast(q);
    } catch (e) {
      return send(res, 502, { error: "forecast upstream unavailable, not charged" });
    }

    const txHash = await settle(request);
    const settlement = { success: true, transaction: txHash, network: NETWORK, payer: auth.from };

    return send(
      res,
      200,
      {
        forecast,
        payment: settlement,
        // Everything the caller needs to rate this call in the ERC-8004 Reputation Registry.
        feedback: {
          reputationRegistry: `${NETWORK}:${REPUTATION_REGISTRY}`,
          function:
            "giveFeedback(uint256 agentId,int128 value,uint8 valueDecimals,string tag1,string tag2,string endpoint,string feedbackURI,bytes32 feedbackHash)",
          agentId: AGENT_ID,
          suggested: { value: "0-100", valueDecimals: 0, tag1: "starred", tag2: "forecast", endpoint: RESOURCE_URL },
          proofOfPayment: { fromAddress: auth.from, toAddress: PAY_TO, chainId: String(CHAIN_ID), txHash },
          gas: "caller needs no ETH: send as ERC-4337 UserOperation (EIP-7702 or smart account) with a USDC paymaster",
        },
      },
      { "PAYMENT-RESPONSE": b64(settlement) },
    );
  } catch (e) {
    if (e instanceof PaymentError) return send402(res, e.message);
    console.error(e);
    return send(res, 500, { error: "internal error" });
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
        "access-control-allow-headers": "PAYMENT-SIGNATURE, content-type",
        "access-control-allow-methods": "GET, OPTIONS",
      });
      return res.end();
    }
    if (req.method !== "GET") return send(res, 405, { error: "method not allowed" });

    switch (url.pathname) {
      case "/forecast":
        return await handleForecast(req, res, url);
      case "/.well-known/agent-registration.json":
        return send(res, 200, registrationFile);
      case "/openapi.json":
        return send(res, 200, openapi);
      case "/health":
        return send(res, 200, { ok: true });
      case "/":
        return send(res, 200, {
          service: registrationFile.name,
          description: registrationFile.description,
          registration: REGISTRATION_URL,
          openapi: `${PUBLIC_URL}/openapi.json`,
          erc8004: agentRef,
        });
      default:
        return send(res, 404, { error: "not found" });
    }
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: "internal error" });
  }
});

server.listen(PORT, () => {
  console.log(`forecast server on :${PORT}, payTo ${PAY_TO}, settler ${settler.address}, agentId ${AGENT_ID}`);
});
