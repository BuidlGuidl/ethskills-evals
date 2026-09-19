/**
 * rebalance.ts — execution path for the WETH/USDC treasury rebalancer.
 *
 * Turns a rebalance decision ("sell X WETH for USDC" / "sell Y USDC for WETH")
 * into a signed, privately-submitted Ethereum mainnet transaction.
 *
 * ── Custody model (read DEPLOY.md before running) ─────────────────────────────
 *
 *   TREASURY SAFE  (Safe v1.4.1, 2-of-3 hardware-wallet owners)
 *     Holds all WETH + USDC. The agent is NOT an owner.
 *        ▲
 *        │ execTransactionFromModule (Call only)
 *   ZODIAC ROLES MODIFIER v2  (module enabled on the Safe, owner = the Safe)
 *     Role "rebalancer" may ONLY call SwapRouter02.exactInputSingle with
 *       tokenIn/tokenOut ∈ {WETH→USDC, USDC→WETH}, fee = 500,
 *       recipient == the Safe, amountIn within an on-chain daily allowance.
 *        ▲
 *        │ execTransactionWithRole(...)
 *   AGENT EOA  (secp256k1 key in AWS KMS, non-exportable; holds only gas ETH)
 *     This process. Signs via KMS, submits through a private RPC.
 *
 * A stolen agent key (or a compromised VM) can therefore only swap WETH<->USDC
 * back into the Safe, up to the on-chain allowance. It cannot transfer, approve,
 * delegatecall, or change permissions. Everything below is defense in depth on
 * top of that on-chain boundary.
 *
 * ── Contracts touched (Ethereum mainnet, chainId 1) ───────────────────────────
 *   WETH                    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 *   USDC                    0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *   Uniswap SwapRouter02    0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45  (the swap)
 *   Uniswap QuoterV2        0x61fFE014bA17989E743c5F6cB21bF9697530B21e  (eth_call only)
 *   USDC/WETH 0.05% pool    0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640  (sanity check only)
 *   Chainlink ETH/USD       0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419  (price guard)
 *   Chainlink USDC/USD      0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6  (depeg guard)
 *   Treasury Safe           $SAFE_ADDRESS
 *   Roles Modifier          $ROLES_MODIFIER_ADDRESS
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *   npx tsx rebalance.ts --check                              # config + on-chain wiring, no tx
 *   npx tsx rebalance.ts --selftest                           # prove forbidden calls revert
 *   npx tsx rebalance.ts --sell WETH --amount 5 --id <uuid> [--dry-run]
 *   npx tsx rebalance.ts --sell USDC --amount 20000 --id <uuid> [--dry-run]
 *
 * Or import { executeRebalance } from your signal loop.
 */

import {
  bytesToBigInt,
  createPublicClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  hashMessage,
  hashTypedData,
  hexToBytes,
  http,
  keccak256,
  parseAbi,
  parseEventLogs,
  parseGwei,
  parseUnits,
  recoverAddress,
  serializeSignature,
  serializeTransaction,
  stringToHex,
  toHex,
  type Address,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type TransactionSerializable,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount, toAccount } from "viem/accounts";
import { GetPublicKeyCommand, KMSClient, SignCommand } from "@aws-sdk/client-kms";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// getAddress() throws on a bad checksum, so a typo here fails at startup.
export const CONTRACTS = {
  WETH: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  USDC: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  SWAP_ROUTER_02: getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
  QUOTER_V2: getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),
  POOL_USDC_WETH_500: getAddress("0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640"),
  CHAINLINK_ETH_USD: getAddress("0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"),
  CHAINLINK_USDC_USD: getAddress("0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6"),
} as const;

const POOL_FEE = 500; // 0.05% tier — must match the Roles permission
const OPERATION_CALL = 0; // Safe Enum.Operation.Call. Never DelegateCall.
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

const TOKENS = {
  WETH: { address: CONTRACTS.WETH, decimals: 18 },
  USDC: { address: CONTRACTS.USDC, decimals: 6 },
} as const;
type TokenSymbol = keyof typeof TOKENS;

// ─────────────────────────────────────────────────────────────────────────────
// ABIs (minimal)
// ─────────────────────────────────────────────────────────────────────────────

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const swapRouter02Abi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
]);

// NB: QuoterV2's struct field order differs from the router's.
const quoterV2Abi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const poolAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
]);

const chainlinkAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);

const safeAbi = parseAbi([
  "function isModuleEnabled(address module) view returns (bool)",
  "function isOwner(address owner) view returns (bool)",
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
]);

// Zodiac Roles Modifier v2
const rolesAbi = parseAbi([
  "function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool success)",
  "function avatar() view returns (address)",
  "function target() view returns (address)",
  "function owner() view returns (address)",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Config (env only — no secrets in this file, ever)
// ─────────────────────────────────────────────────────────────────────────────

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`missing env ${name}`);
  return v;
}
const envNum = (name: string, fallback: number) => {
  const n = Number(env(name, String(fallback)));
  if (!Number.isFinite(n)) throw new Error(`env ${name} is not a number`);
  return n;
};

export function loadConfig() {
  const stateDir = env("STATE_DIR", "/var/lib/rebalancer");
  return {
    rpcUrl: env("ETH_RPC_URL"), // reads, simulation, receipts
    privateTxRpcUrl: env("PRIVATE_TX_RPC_URL", "https://rpc.flashbots.net/fast"), // submission only
    safe: getAddress(env("SAFE_ADDRESS")),
    roles: getAddress(env("ROLES_MODIFIER_ADDRESS")),
    roleKey: stringToHex(env("ROLE_KEY", "rebalancer"), { size: 32 }),
    agent: getAddress(env("AGENT_ADDRESS")), // expected signer address; startup fails on mismatch
    signer: env("SIGNER", "kms") as "kms" | "dev",
    kmsKeyId: process.env.KMS_KEY_ID,
    awsRegion: process.env.AWS_REGION,

    // Off-chain limits. The on-chain Roles allowance is the real ceiling; keep
    // these at or below it so the bot stops itself before the chain has to.
    maxTradeUsd: envNum("MAX_TRADE_USD", 50_000),
    maxDailyUsd: envNum("MAX_DAILY_USD", 100_000), // rolling 24h
    maxTradesPerDay: envNum("MAX_TRADES_PER_DAY", 10),
    minSecondsBetweenTrades: envNum("MIN_SECONDS_BETWEEN_TRADES", 300),
    slippageBps: BigInt(envNum("SLIPPAGE_BPS", 30)), // vs. fresh quote
    maxOracleDeviationBps: BigInt(envNum("MAX_ORACLE_DEVIATION_BPS", 100)), // quote vs. Chainlink
    maxEthUsdAgeSec: envNum("MAX_ETH_USD_AGE_SEC", 3600 + 600), // feed heartbeat 1h
    maxUsdcUsdAgeSec: envNum("MAX_USDC_USD_AGE_SEC", 86400 + 3600), // feed heartbeat 24h
    maxUsdcDepegBps: BigInt(envNum("MAX_USDC_DEPEG_BPS", 100)),
    maxFeePerGas: parseGwei(env("MAX_FEE_GWEI", "40")),
    maxGasCostUsd: envNum("MAX_GAS_COST_USD", 40),
    minAgentGasEth: env("MIN_AGENT_GAS_ETH", "0.03"),
    receiptTimeoutMs: envNum("RECEIPT_TIMEOUT_SEC", 300) * 1000,
    stuckAfterSec: envNum("STUCK_AFTER_SEC", 900),

    stateDir,
    pauseFile: path.join(stateDir, "PAUSED"),
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
  };
}
export type Config = ReturnType<typeof loadConfig>;

// ─────────────────────────────────────────────────────────────────────────────
// Logging, alerting, errors
// ─────────────────────────────────────────────────────────────────────────────

/** Soft failure: skip this trade, try again next signal. */
export class SkipTrade extends Error {}
/** Hard failure: something is wrong with the world. Write PAUSED, alert, stop. */
export class Halt extends Error {}

function log(cfg: Config, level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify(
    { ts: new Date().toISOString(), level, event, ...data },
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
  );
  console.log(line);
  try {
    fs.appendFileSync(path.join(cfg.stateDir, "audit.jsonl"), line + "\n");
  } catch {
    /* state dir may not exist in --check mode */
  }
}

async function alert(cfg: Config, severity: "warn" | "page", message: string, data: Record<string, unknown> = {}) {
  log(cfg, severity === "page" ? "error" : "warn", "alert", { severity, message, ...data });
  if (!cfg.alertWebhookUrl) return;
  try {
    await fetch(cfg.alertWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ severity, message, data }, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error("alert webhook failed", e);
  }
}

async function haltAndPause(cfg: Config, reason: string, data: Record<string, unknown> = {}): Promise<never> {
  fs.mkdirSync(cfg.stateDir, { recursive: true });
  fs.writeFileSync(cfg.pauseFile, `${new Date().toISOString()} ${reason}\n`);
  await alert(cfg, "page", `REBALANCER HALTED: ${reason}`, data);
  throw new Halt(reason);
}

// ─────────────────────────────────────────────────────────────────────────────
// Signer: AWS KMS secp256k1 key as a viem account
// ─────────────────────────────────────────────────────────────────────────────

function parseDerSignature(der: Uint8Array): { r: bigint; s: bigint } {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error("KMS sig: expected DER SEQUENCE");
  const seqLen = der[i++];
  if (seqLen & 0x80) i += seqLen & 0x7f;
  const readInt = () => {
    if (der[i++] !== 0x02) throw new Error("KMS sig: expected DER INTEGER");
    const len = der[i++];
    const v = bytesToBigInt(der.slice(i, i + len));
    i += len;
    return v;
  };
  return { r: readInt(), s: readInt() };
}

/**
 * The private key is generated inside KMS (key spec ECC_SECG_P256K1) and can
 * never be exported. The VM's IAM role may call kms:Sign on this one key only.
 */
export async function kmsAccount(keyId: string, region: string): Promise<LocalAccount> {
  const kms = new KMSClient({ region });
  const pub = await kms.send(new GetPublicKeyCommand({ KeyId: keyId }));
  if (pub.KeySpec !== "ECC_SECG_P256K1" || !pub.PublicKey) throw new Error("KMS key is not ECC_SECG_P256K1");
  // SubjectPublicKeyInfo DER ends with the 65-byte uncompressed point 0x04||X||Y.
  const point = pub.PublicKey.slice(pub.PublicKey.length - 65);
  if (point[0] !== 0x04) throw new Error("unexpected KMS public key encoding");
  const address = getAddress(`0x${keccak256(point.slice(1)).slice(-40)}`);

  const signHash = async (hash: Hex) => {
    const res = await kms.send(
      new SignCommand({ KeyId: keyId, Message: hexToBytes(hash), MessageType: "DIGEST", SigningAlgorithm: "ECDSA_SHA_256" }),
    );
    if (!res.Signature) throw new Error("KMS returned no signature");
    const { r, s: rawS } = parseDerSignature(res.Signature);
    const s = rawS > SECP256K1_N / 2n ? SECP256K1_N - rawS : rawS; // EIP-2 low-s
    const sig = { r: toHex(r, { size: 32 }), s: toHex(s, { size: 32 }) };
    for (const yParity of [0, 1] as const) {
      if ((await recoverAddress({ hash, signature: { ...sig, yParity } })) === address) return { ...sig, yParity };
    }
    throw new Error("KMS signature did not recover to the KMS key's address");
  };

  return toAccount({
    address,
    async signMessage({ message }) {
      return serializeSignature(await signHash(hashMessage(message)));
    },
    async signTypedData(typedData) {
      return serializeSignature(await signHash(hashTypedData(typedData as any)));
    },
    async signTransaction(tx, opts) {
      const serializer = opts?.serializer ?? serializeTransaction;
      const sig = await signHash(keccak256(await serializer(tx)));
      return serializer(tx, sig);
    },
  });
}

/** Fork rehearsal only. Refuses to run against anything that isn't localhost. */
function devAccount(cfg: Config): LocalAccount {
  const host = new URL(cfg.rpcUrl).hostname;
  if (!["127.0.0.1", "localhost"].includes(host)) throw new Error("SIGNER=dev is only allowed against a local anvil fork");
  return privateKeyToAccount(env("DEV_PRIVATE_KEY") as Hex);
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistent state (nonce tracking, pending tx, rolling volume, idempotency)
// ─────────────────────────────────────────────────────────────────────────────

type State = {
  expectedNonce?: number;
  pending?: { hash: Hex; nonce: number; decisionId: string; submittedAt: number; usd: number };
  trades: { at: number; usd: number; decisionId: string; hash: Hex }[];
  seenDecisionIds: string[];
};

function loadState(cfg: Config): State {
  const p = path.join(cfg.stateDir, "state.json");
  if (!fs.existsSync(p)) return { trades: [], seenDecisionIds: [] };
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function saveState(cfg: Config, s: State) {
  const now = Date.now();
  s.trades = s.trades.filter((t) => now - t.at < 7 * 86400_000);
  s.seenDecisionIds = s.seenDecisionIds.slice(-1000);
  const p = path.join(cfg.stateDir, "state.json");
  fs.writeFileSync(p + ".tmp", JSON.stringify(s, null, 2));
  fs.renameSync(p + ".tmp", p); // atomic
}

/** One rebalance at a time, across processes. Stale locks from dead pids are reclaimed. */
function acquireLock(cfg: Config): () => void {
  const lockPath = path.join(cfg.stateDir, "lock");
  const take = () => fs.writeFileSync(lockPath, String(process.pid), { flag: "wx" });
  try {
    take();
  } catch {
    const pid = Number(fs.readFileSync(lockPath, "utf8"));
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
    }
    if (alive) throw new SkipTrade(`another rebalance is running (pid ${pid})`);
    fs.unlinkSync(lockPath);
    take();
  }
  return () => fs.rmSync(lockPath, { force: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Clients + on-chain wiring checks
// ─────────────────────────────────────────────────────────────────────────────

export async function setup(cfg: Config) {
  const pub = createPublicClient({ chain: mainnet, transport: http(cfg.rpcUrl), batch: { multicall: true } });
  // Separate client used ONLY for eth_sendRawTransaction (private mempool).
  const priv = createPublicClient({
    chain: mainnet,
    transport: http(cfg.signer === "dev" ? cfg.rpcUrl : cfg.privateTxRpcUrl),
  });
  const account =
    cfg.signer === "kms" ? await kmsAccount(env("KMS_KEY_ID"), env("AWS_REGION")) : devAccount(cfg);
  return { pub: pub as PublicClient, priv: priv as PublicClient, account };
}

/** Verifies the custody wiring. Any mismatch means "do not trade". */
export async function verifyWiring(cfg: Config, pub: PublicClient, account: LocalAccount) {
  const problems: string[] = [];
  const chainId = await pub.getChainId();
  if (chainId !== 1) problems.push(`chainId ${chainId} != 1`);
  if (account.address !== cfg.agent) problems.push(`signer ${account.address} != AGENT_ADDRESS ${cfg.agent}`);

  const [token0, token1, fee, moduleEnabled, agentIsOwner, threshold, owners, rolesAvatar, rolesTarget, rolesOwner, agentEth] =
    await Promise.all([
      pub.readContract({ address: CONTRACTS.POOL_USDC_WETH_500, abi: poolAbi, functionName: "token0" }),
      pub.readContract({ address: CONTRACTS.POOL_USDC_WETH_500, abi: poolAbi, functionName: "token1" }),
      pub.readContract({ address: CONTRACTS.POOL_USDC_WETH_500, abi: poolAbi, functionName: "fee" }),
      pub.readContract({ address: cfg.safe, abi: safeAbi, functionName: "isModuleEnabled", args: [cfg.roles] }),
      pub.readContract({ address: cfg.safe, abi: safeAbi, functionName: "isOwner", args: [cfg.agent] }),
      pub.readContract({ address: cfg.safe, abi: safeAbi, functionName: "getThreshold" }),
      pub.readContract({ address: cfg.safe, abi: safeAbi, functionName: "getOwners" }),
      pub.readContract({ address: cfg.roles, abi: rolesAbi, functionName: "avatar" }),
      pub.readContract({ address: cfg.roles, abi: rolesAbi, functionName: "target" }),
      pub.readContract({ address: cfg.roles, abi: rolesAbi, functionName: "owner" }),
      pub.getBalance({ address: cfg.agent }),
    ]);

  if (token0 !== CONTRACTS.USDC || token1 !== CONTRACTS.WETH || fee !== POOL_FEE) problems.push("pool sanity check failed");
  if (!moduleEnabled) problems.push("Roles modifier is not an enabled module on the Safe");
  if (agentIsOwner) problems.push("agent EOA is a Safe OWNER — it must only be a Roles member");
  if (threshold < 2n) problems.push(`Safe threshold is ${threshold}; must be >= 2`);
  if (getAddress(rolesAvatar) !== cfg.safe || getAddress(rolesTarget) !== cfg.safe) problems.push("Roles avatar/target != Safe");
  // If anyone other than the Safe owns the Roles modifier, they can rewrite the agent's permissions.
  if (getAddress(rolesOwner) !== cfg.safe) problems.push(`Roles owner is ${rolesOwner}, must be the Safe`);

  return { problems, owners, threshold, agentEth };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prices
// ─────────────────────────────────────────────────────────────────────────────

async function readFeed(pub: PublicClient, feed: Address, maxAgeSec: number, nowSec: bigint, name: string) {
  const [roundId, answer, , updatedAt, answeredInRound] = await pub.readContract({
    address: feed,
    abi: chainlinkAbi,
    functionName: "latestRoundData",
  });
  if (answer <= 0n) throw new SkipTrade(`${name}: non-positive answer`);
  if (answeredInRound < roundId) throw new SkipTrade(`${name}: incomplete round`);
  const age = Number(nowSec - updatedAt);
  if (age > maxAgeSec) throw new SkipTrade(`${name}: stale (${age}s old)`);
  return answer; // 8 decimals for both feeds used here
}

/** Expected output at oracle price, in raw units of tokenOut. */
function oracleExpectedOut(sell: TokenSymbol, amountIn: bigint, ethUsd8: bigint, usdcUsd8: bigint): bigint {
  return sell === "WETH"
    ? (amountIn * ethUsd8) / usdcUsd8 / 10n ** 12n // 18 dec -> 6 dec
    : (amountIn * usdcUsd8 * 10n ** 12n) / ethUsd8; // 6 dec -> 18 dec
}

function notionalUsd(sell: TokenSymbol, amountIn: bigint, ethUsd8: bigint, usdcUsd8: bigint): number {
  const cents =
    sell === "WETH" ? (amountIn * ethUsd8) / 10n ** 24n : (amountIn * usdcUsd8) / 10n ** 12n; // -> 2 decimals
  return Number(cents) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calldata builders
// ─────────────────────────────────────────────────────────────────────────────

function swapCalldata(tokenIn: Address, tokenOut: Address, recipient: Address, amountIn: bigint, amountOutMinimum: bigint, fee = POOL_FEE) {
  return encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [{ tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n }],
  });
}

function rolesCall(cfg: Config, to: Address, data: Hex, operation = OPERATION_CALL) {
  return {
    address: cfg.roles,
    abi: rolesAbi,
    functionName: "execTransactionWithRole" as const,
    // shouldRevert=true: a failing inner call reverts the whole tx instead of returning false.
    args: [to, 0n, data, operation, cfg.roleKey, true] as const,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The execution path
// ─────────────────────────────────────────────────────────────────────────────

export type RebalanceDecision = {
  /** Unique per decision. Replays of the same id are ignored. */
  id: string;
  sell: TokenSymbol;
  /** Raw units of the sell token (wei for WETH, 1e-6 for USDC). */
  amountIn: bigint;
};

export type RebalanceResult =
  | { status: "executed"; hash: Hex; amountIn: bigint; amountOut: bigint; usd: number }
  | { status: "submitted-pending"; hash: Hex }
  | { status: "dry-run"; minOut: bigint; quote: bigint; usd: number; gas: bigint }
  | { status: "skipped"; reason: string }
  | { status: "duplicate" };

export async function executeRebalance(
  cfg: Config,
  ctx: { pub: PublicClient; priv: PublicClient; account: LocalAccount },
  decision: RebalanceDecision,
  opts: { dryRun?: boolean } = {},
): Promise<RebalanceResult> {
  const { pub, priv, account } = ctx;

  // 0. Kill switch. Removing the file is a deliberate human act.
  if (fs.existsSync(cfg.pauseFile)) {
    return { status: "skipped", reason: `paused: ${fs.readFileSync(cfg.pauseFile, "utf8").trim()}` };
  }
  fs.mkdirSync(cfg.stateDir, { recursive: true });

  let release: (() => void) | undefined;
  try {
    release = acquireLock(cfg);
    const state = loadState(cfg);
    if (state.seenDecisionIds.includes(decision.id)) return { status: "duplicate" };

    // 1. Wiring: if the custody setup isn't what we think it is, stop everything.
    const wiring = await verifyWiring(cfg, pub, account);
    if (wiring.problems.length) await haltAndPause(cfg, "wiring check failed", { problems: wiring.problems });
    if (wiring.agentEth < parseUnits(cfg.minAgentGasEth, 18)) {
      await alert(cfg, "warn", "agent gas balance low", { eth: formatEther(wiring.agentEth), agent: cfg.agent });
    }

    // 2. Nonce accounting: detect foreign use of the agent key, resolve our last tx.
    const chainNonce = await pub.getTransactionCount({ address: cfg.agent, blockTag: "latest" });
    if (state.pending) {
      const p = state.pending;
      const receipt = await pub.getTransactionReceipt({ hash: p.hash }).catch(() => null);
      if (receipt) {
        log(cfg, "info", "previous tx resolved", { hash: p.hash, status: receipt.status });
        if (receipt.status !== "success") {
          state.trades = state.trades.filter((t) => t.hash !== p.hash);
          await alert(cfg, "warn", "previous rebalance tx reverted on-chain", { hash: p.hash });
        }
        state.expectedNonce = p.nonce + 1;
        state.pending = undefined;
      } else if (chainNonce > p.nonce) {
        await haltAndPause(cfg, "agent nonce consumed by a tx we did not send", { pending: p, chainNonce });
      } else if (Date.now() - p.submittedAt < cfg.stuckAfterSec * 1000) {
        throw new SkipTrade(`previous tx ${p.hash} still pending`);
      } else {
        // Private RPC dropped it (e.g. minOut no longer satisfiable). Its nonce will be
        // reused below, which permanently invalidates the old signed tx.
        log(cfg, "warn", "previous tx dropped; reusing nonce", { pending: p });
        state.trades = state.trades.filter((t) => t.hash !== p.hash);
        state.expectedNonce = p.nonce;
        state.pending = undefined;
      }
      saveState(cfg, state);
    }
    if (state.expectedNonce !== undefined && chainNonce !== state.expectedNonce) {
      await haltAndPause(cfg, "agent nonce moved unexpectedly — key may be in use elsewhere", {
        expected: state.expectedNonce,
        chainNonce,
      });
    }
    const nonce = chainNonce;

    // 3. Off-chain rate limits.
    const now = Date.now();
    const last24h = state.trades.filter((t) => now - t.at < 86400_000);
    const lastTrade = state.trades.at(-1);
    if (lastTrade && now - lastTrade.at < cfg.minSecondsBetweenTrades * 1000) throw new SkipTrade("min interval not elapsed");
    if (last24h.length >= cfg.maxTradesPerDay) throw new SkipTrade("daily trade count reached");

    // 4. Balances + prices, all against the same block.
    const block = await pub.getBlock({ blockTag: "latest" });
    const tokenIn = TOKENS[decision.sell];
    const tokenOut = decision.sell === "WETH" ? TOKENS.USDC : TOKENS.WETH;
    const [safeBal, routerAllowance, ethUsd8, usdcUsd8] = await Promise.all([
      pub.readContract({ address: tokenIn.address, abi: erc20Abi, functionName: "balanceOf", args: [cfg.safe], blockNumber: block.number }),
      pub.readContract({ address: tokenIn.address, abi: erc20Abi, functionName: "allowance", args: [cfg.safe, CONTRACTS.SWAP_ROUTER_02], blockNumber: block.number }),
      readFeed(pub, CONTRACTS.CHAINLINK_ETH_USD, cfg.maxEthUsdAgeSec, block.timestamp, "ETH/USD"),
      readFeed(pub, CONTRACTS.CHAINLINK_USDC_USD, cfg.maxUsdcUsdAgeSec, block.timestamp, "USDC/USD"),
    ]);
    if (decision.amountIn <= 0n) throw new SkipTrade("amountIn must be > 0");
    if (safeBal < decision.amountIn) throw new SkipTrade(`Safe has ${safeBal} < amountIn ${decision.amountIn}`);
    if (routerAllowance < decision.amountIn) {
      await haltAndPause(cfg, "Safe's router allowance too low — owners must re-approve", { token: tokenIn.address, routerAllowance });
    }
    const depegBps = ((usdcUsd8 > 100_000_000n ? usdcUsd8 - 100_000_000n : 100_000_000n - usdcUsd8) * 10_000n) / 100_000_000n;
    if (depegBps > cfg.maxUsdcDepegBps) {
      await haltAndPause(cfg, `USDC off peg by ${depegBps} bps`, { usdcUsd8 });
    }

    const usd = notionalUsd(decision.sell, decision.amountIn, ethUsd8, usdcUsd8);
    const volume24h = last24h.reduce((a, t) => a + t.usd, 0);
    if (usd > cfg.maxTradeUsd) throw new SkipTrade(`trade $${usd} > MAX_TRADE_USD`);
    if (volume24h + usd > cfg.maxDailyUsd) throw new SkipTrade(`24h volume would be $${volume24h + usd} > MAX_DAILY_USD`);

    // 5. Quote (eth_call against QuoterV2) and compare to Chainlink.
    const { result: quoteResult } = await pub.simulateContract({
      address: CONTRACTS.QUOTER_V2,
      abi: quoterV2Abi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: tokenIn.address, tokenOut: tokenOut.address, amountIn: decision.amountIn, fee: POOL_FEE, sqrtPriceLimitX96: 0n }],
      blockNumber: block.number,
    });
    const quote = quoteResult[0];
    const expected = oracleExpectedOut(decision.sell, decision.amountIn, ethUsd8, usdcUsd8);
    const lo = (expected * (10_000n - cfg.maxOracleDeviationBps)) / 10_000n;
    const hi = (expected * (10_000n + cfg.maxOracleDeviationBps)) / 10_000n;
    if (quote < lo || quote > hi) {
      // Either the pool is being manipulated / is thin, or the oracle is off. Either way: don't trade.
      await alert(cfg, "warn", "quote outside oracle band; skipping", { quote, expected, decision: decision.id });
      throw new SkipTrade("quote outside oracle band");
    }
    const minOut = (quote * (10_000n - cfg.slippageBps)) / 10_000n;

    // 6. Build: SwapRouter02.exactInputSingle wrapped in Roles.execTransactionWithRole.
    //    recipient MUST be the Safe; Roles enforces it on-chain regardless.
    const swapData = swapCalldata(tokenIn.address, tokenOut.address, cfg.safe, decision.amountIn, minOut);
    const call = rolesCall(cfg, CONTRACTS.SWAP_ROUTER_02, swapData);

    // 7. Simulate exactly what we'll send, from the agent address. Catches permission
    //    misconfig, exhausted on-chain allowance, and price moves before we sign anything.
    try {
      await pub.simulateContract({ ...call, account: cfg.agent });
    } catch (e) {
      await alert(cfg, "warn", "simulation reverted; skipping", { decision: decision.id, err: String(e).slice(0, 500) });
      throw new SkipTrade("simulation reverted");
    }
    const gasEstimate = await pub.estimateContractGas({ ...call, account: cfg.agent });
    const gas = (gasEstimate * 125n) / 100n;

    // 8. Fees.
    const fees = await pub.estimateFeesPerGas();
    if (fees.maxFeePerGas > cfg.maxFeePerGas) throw new SkipTrade(`maxFeePerGas ${fees.maxFeePerGas} over cap`);
    const gasCostUsd = Number((gas * fees.maxFeePerGas * ethUsd8) / 10n ** 24n) / 100;
    if (gasCostUsd > cfg.maxGasCostUsd) throw new SkipTrade(`worst-case gas $${gasCostUsd} over cap`);
    if (wiring.agentEth < gas * fees.maxFeePerGas) {
      await haltAndPause(cfg, "agent cannot pay gas — top up AGENT_ADDRESS", { eth: formatEther(wiring.agentEth) });
    }

    const plan = {
      decision: decision.id,
      sell: `${formatUnits(decision.amountIn, tokenIn.decimals)} ${decision.sell}`,
      quote: formatUnits(quote, tokenOut.decimals),
      minOut: formatUnits(minOut, tokenOut.decimals),
      oracleExpected: formatUnits(expected, tokenOut.decimals),
      usd,
      volume24h,
      gas,
      maxFeeGwei: formatUnits(fees.maxFeePerGas, 9),
      gasCostUsd,
      nonce,
      block: block.number,
    };
    log(cfg, "info", "rebalance plan", plan);
    if (opts.dryRun) return { status: "dry-run", minOut, quote, usd, gas };

    // 9. Sign (KMS). Persist BEFORE broadcasting so a crash can't lose track of it.
    const tx: TransactionSerializable = {
      type: "eip1559",
      chainId: 1,
      nonce,
      to: cfg.roles,
      value: 0n,
      data: encodeFunctionData(call),
      gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    };
    const signed = await account.signTransaction(tx);
    const hash = keccak256(signed);
    state.pending = { hash, nonce, decisionId: decision.id, submittedAt: Date.now(), usd };
    state.trades.push({ at: Date.now(), usd, decisionId: decision.id, hash }); // counted conservatively at submission
    state.seenDecisionIds.push(decision.id);
    saveState(cfg, state);

    // 10. Submit privately (not the public mempool → no sandwich).
    try {
      await priv.sendRawTransaction({ serializedTransaction: signed });
    } catch (e) {
      // It may or may not have been accepted; pending-resolution handles both on the next run.
      await alert(cfg, "warn", "private RPC submission error", { hash, err: String(e).slice(0, 500) });
      return { status: "submitted-pending", hash };
    }
    log(cfg, "info", "submitted", { hash, nonce });

    // 11. Wait and verify what actually happened, from the logs.
    let receipt;
    try {
      receipt = await pub.waitForTransactionReceipt({ hash, timeout: cfg.receiptTimeoutMs });
    } catch {
      log(cfg, "warn", "no receipt yet; will resolve next run", { hash });
      return { status: "submitted-pending", hash };
    }
    state.pending = undefined;
    state.expectedNonce = nonce + 1;
    if (receipt.status !== "success") {
      state.trades = state.trades.filter((t) => t.hash !== hash);
      saveState(cfg, state);
      await haltAndPause(cfg, "rebalance tx reverted on-chain after passing simulation", { hash });
    }
    saveState(cfg, state);

    const transfers = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: "Transfer" });
    const received = transfers
      .filter((l) => getAddress(l.address) === tokenOut.address && getAddress(l.args.to) === cfg.safe)
      .reduce((a, l) => a + l.args.value, 0n);
    const sent = transfers
      .filter((l) => getAddress(l.address) === tokenIn.address && getAddress(l.args.from) === cfg.safe)
      .reduce((a, l) => a + l.args.value, 0n);
    if (received < minOut || sent !== decision.amountIn) {
      await haltAndPause(cfg, "post-trade transfer check failed", { hash, received, minOut, sent });
    }

    log(cfg, "info", "executed", {
      hash,
      block: receipt.blockNumber,
      sent: formatUnits(sent, tokenIn.decimals),
      received: formatUnits(received, tokenOut.decimals),
      vsOracleBps: Number(((received - expected) * 10_000n) / expected),
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
    });
    return { status: "executed", hash, amountIn: sent, amountOut: received, usd };
  } catch (e) {
    if (e instanceof SkipTrade) {
      log(cfg, "info", "skipped", { decision: decision.id, reason: e.message });
      return { status: "skipped", reason: e.message };
    }
    if (!(e instanceof Halt)) await alert(cfg, "page", "unexpected error in rebalance", { err: String(e).slice(0, 1000) });
    throw e;
  } finally {
    release?.();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission self-test: every one of these MUST revert. Run before funding and
// after any change to the Roles config.
// ─────────────────────────────────────────────────────────────────────────────

export async function permissionSelfTest(cfg: Config, pub: PublicClient) {
  const one = { WETH: 10n ** 15n, USDC: 10n ** 6n };
  const cases: { name: string; call: ReturnType<typeof rolesCall> }[] = [
    { name: "swap with recipient = agent", call: rolesCall(cfg, CONTRACTS.SWAP_ROUTER_02, swapCalldata(CONTRACTS.WETH, CONTRACTS.USDC, cfg.agent, one.WETH, 0n)) },
    { name: "swap via 0.3% pool", call: rolesCall(cfg, CONTRACTS.SWAP_ROUTER_02, swapCalldata(CONTRACTS.WETH, CONTRACTS.USDC, cfg.safe, one.WETH, 0n, 3000)) },
    { name: "swap 10M USDC (above allowance; also above balance)", call: rolesCall(cfg, CONTRACTS.SWAP_ROUTER_02, swapCalldata(CONTRACTS.USDC, CONTRACTS.WETH, cfg.safe, 10n ** 13n, 0n)) },
    { name: "USDC.transfer to agent", call: rolesCall(cfg, CONTRACTS.USDC, encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [cfg.agent, one.USDC] })) },
    { name: "WETH.transfer to agent", call: rolesCall(cfg, CONTRACTS.WETH, encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [cfg.agent, one.WETH] })) },
    { name: "WETH.approve agent", call: rolesCall(cfg, CONTRACTS.WETH, encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [cfg.agent, 2n ** 256n - 1n] })) },
    { name: "delegatecall to router", call: rolesCall(cfg, CONTRACTS.SWAP_ROUTER_02, swapCalldata(CONTRACTS.WETH, CONTRACTS.USDC, cfg.safe, one.WETH, 0n), 1) },
  ];
  let failures = 0;
  for (const c of cases) {
    const reverted = await pub.simulateContract({ ...c.call, account: cfg.agent }).then(() => false, () => true);
    console.log(`${reverted ? "PASS (reverted)" : "FAIL (ALLOWED!)"}  ${c.name}`);
    if (!reverted) failures++;
  }
  // Positive case: a small legitimate swap should simulate (requires the Safe to hold WETH + approvals).
  const ok = await pub
    .simulateContract({ ...rolesCall(cfg, CONTRACTS.SWAP_ROUTER_02, swapCalldata(CONTRACTS.WETH, CONTRACTS.USDC, cfg.safe, one.WETH, 1n)), account: cfg.agent })
    .then(() => true, (e) => (console.log(String(e).slice(0, 300)), false));
  console.log(`${ok ? "PASS" : "WARN"}  legitimate 0.001 WETH -> USDC swap simulates`);
  return failures;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flag = (n: string) => args.includes(n);
  const opt = (n: string) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const cfg = loadConfig();
  const ctx = await setup(cfg);

  if (flag("--check")) {
    const w = await verifyWiring(cfg, ctx.pub, ctx.account);
    console.log(JSON.stringify({ agent: ctx.account.address, safe: cfg.safe, roles: cfg.roles, owners: w.owners, threshold: String(w.threshold), agentEth: formatEther(w.agentEth), paused: fs.existsSync(cfg.pauseFile), problems: w.problems }, null, 2));
    process.exit(w.problems.length ? 1 : 0);
  }
  if (flag("--selftest")) {
    process.exit((await permissionSelfTest(cfg, ctx.pub)) ? 1 : 0);
  }

  const sell = opt("--sell")?.toUpperCase();
  const amount = opt("--amount");
  const id = opt("--id");
  if ((sell !== "WETH" && sell !== "USDC") || !amount || !id) {
    console.error("usage: rebalance.ts --sell WETH|USDC --amount <human units> --id <unique id> [--dry-run] | --check | --selftest");
    process.exit(2);
  }
  const result = await executeRebalance(
    cfg,
    ctx,
    { id, sell, amountIn: parseUnits(amount, TOKENS[sell].decimals) },
    { dryRun: flag("--dry-run") },
  );
  console.log(JSON.stringify(result, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
