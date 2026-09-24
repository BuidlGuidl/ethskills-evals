/**
 * rebalance.ts — execution path for the WETH/USDC treasury rebalancer.
 *
 * A rebalance *decision* (side + size, produced by your signal code) goes in; a signed,
 * privately-submitted Ethereum mainnet transaction and a confirmed receipt come out.
 *
 * ─── Who holds what ────────────────────────────────────────────────────────────────────
 *
 *   Treasury Safe (SAFE_ADDRESS)        Holds ALL of the WETH + USDC. Owned by your hardware
 *                                       wallets (e.g. 2-of-3). The agent can't sign for it.
 *   Zodiac Roles Modifier v2            Module enabled on the Safe. The agent key is a member
 *     (ROLES_MODIFIER_ADDRESS)          of one role (ROLE_KEY) that can ONLY call
 *                                       SwapRouter.exactInputSingle with WETH<->USDC, fee 500,
 *                                       recipient == the Safe, and amountIn inside a daily
 *                                       on-chain allowance. See scripts/roles-permissions.ts.
 *   Agent EOA (key in AWS KMS)          Signs and pays gas for execTransactionWithRole(). Holds
 *                                       only gas ETH. Never holds treasury funds.
 *
 * ─── Mainnet contracts touched (verified on-chain 2026-09-19) ─────────────────────────
 *
 *   WETH9                  0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 *   USDC (FiatTokenProxy)  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *   Uniswap V3 SwapRouter  0xE592427A0AEce92De3Edee1F18E0157C05861564  (v1 router: its
 *                          exactInputSingle struct has a `deadline`, SwapRouter02's does not)
 *   Uniswap V3 QuoterV2    0x61fFE014bA17989E743c5F6cB21bF9697530B21e  (eth_call only)
 *   WETH/USDC 0.05% pool   0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640  (reached via fee=500)
 *   Chainlink ETH/USD      0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419  (8 dp, 1h heartbeat)
 *   Chainlink USDC/USD     0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6  (8 dp, 24h heartbeat)
 *
 * ─── Flow of one rebalance ─────────────────────────────────────────────────────────────
 *
 *   1. kill switch / lock / idempotency / reconcile any in-flight tx from a previous run
 *   2. pre-flight reads: oracles (fresh? USDC pegged?), Safe balances + router allowance,
 *      agent gas balance, off-chain limits (per-trade, per-day, trades/day)
 *   3. quote on QuoterV2, cross-check against Chainlink, derive amountOutMinimum
 *   4. build SwapRouter.exactInputSingle(recipient = Safe, deadline), wrap it in
 *      Roles.execTransactionWithRole(..., shouldRevert = true), simulate, estimate gas
 *   5. sign (KMS), persist the signed tx + hash BEFORE broadcasting, send via a private
 *      MEV-protected RPC (not the public mempool)
 *   6. wait for receipt, verify realized fill against the oracle, update the daily ledger
 *
 * Usage:
 *   import { executeRebalance } from "./rebalance";                  // from your signal loop
 *   npx tsx rebalance.ts --side SELL_WETH --amount 5 --id manual-1 [--dry-run]
 *   npx tsx rebalance.ts --whoami                                     // print the agent address
 */

import { KMSClient, GetPublicKeyCommand, SignCommand } from "@aws-sdk/client-kms";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  type Address,
  BaseError,
  type Hex,
  type LocalAccount,
  type PublicClient,
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  hashMessage,
  hashTypedData,
  http,
  isAddressEqual,
  keccak256,
  numberToHex,
  parseAbi,
  parseUnits,
  recoverAddress,
  serializeTransaction,
  stringToHex,
  toHex,
} from "viem";
import { privateKeyToAccount, publicKeyToAddress, toAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// ─── Contracts ─────────────────────────────────────────────────────────────────────────

export const CONTRACTS = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  SWAP_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  QUOTER_V2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  POOL_WETH_USDC_500: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
  CHAINLINK_ETH_USD: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  CHAINLINK_USDC_USD: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
} as const satisfies Record<string, Address>;

export const POOL_FEE = 500; // 0.05% tier. The Roles permission pins this, so it pins the pool.

export const swapRouterAbi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
]);

const quoterV2Abi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const chainlinkAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

export const rolesAbi = parseAbi([
  "function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool success)",
  "function allowances(bytes32 key) view returns (uint128 refill, uint128 maxRefill, uint64 period, uint128 balance, uint64 timestamp)",
]);

/** On-chain daily allowance keys in the Roles modifier, one per input token (see scripts/roles-permissions.ts). */
export const ALLOWANCE_KEYS = {
  SELL_WETH: stringToHex("weth-daily", { size: 32 }),
  BUY_WETH: stringToHex("usdc-daily", { size: 32 }),
} as const;

/** Mirrors Roles v2 allowance accrual, so an exhausted allowance is a routine "not today" instead of an opaque revert. */
function accruedAllowance([refill, maxRefill, period, balance, timestamp]: readonly [bigint, bigint, bigint, bigint, bigint], now: bigint): bigint {
  if (period === 0n || now < timestamp + period) return balance;
  if (balance >= maxRefill) return balance;
  const accrued = balance + refill * ((now - timestamp) / period);
  return accrued < maxRefill ? accrued : maxRefill;
}

// ─── Config (env) ──────────────────────────────────────────────────────────────────────

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`missing env ${name}`);
  return v;
}
const envNum = (name: string, fallback: number) => Number(env(name, String(fallback)));

// Read lazily so this module can be imported (for CONTRACTS / ABIs) without a full env.
function loadConfig() {
  return {
    // Reads (quotes, receipts, nonces): a paid provider. Writes: a private MEV-protected relay.
    readRpcUrl: env("RPC_URL"),
    sendRpcUrl: env("SEND_RPC_URL", "https://rpc.flashbots.net/fast"),

    safe: env("SAFE_ADDRESS") as Address,
    roles: env("ROLES_MODIFIER_ADDRESS") as Address,
    roleKey: stringToHex(env("ROLE_KEY", "treasury-rebalancer"), { size: 32 }),

    signer: env("SIGNER", "kms") as "kms" | "local",

    stateDir: env("STATE_DIR", "./state"),
    alertWebhook: process.env.ALERT_WEBHOOK_URL, // non-urgent channel (Slack/Discord/Telegram)
    pageWebhook: process.env.PAGE_WEBHOOK_URL, // wakes you up. Only used for anomalies.

    // Off-chain policy. The on-chain Roles allowance is the hard backstop; these are tighter.
    maxTradeUsd: envNum("MAX_TRADE_USD", 55_000),
    maxDailyUsd: envNum("MAX_DAILY_USD", 150_000),
    maxTradesPerDay: envNum("MAX_TRADES_PER_DAY", 12),
    slippageBps: BigInt(envNum("SLIPPAGE_BPS", 30)),
    maxOracleDevBps: BigInt(envNum("MAX_ORACLE_DEVIATION_BPS", 100)),
    usdcDepegBps: BigInt(envNum("USDC_DEPEG_BPS", 100)),
    deadlineSeconds: BigInt(envNum("DEADLINE_SECONDS", 180)),
    maxBaseFeeGwei: envNum("MAX_BASE_FEE_GWEI", 60),
    maxPriorityFeeGwei: envNum("MAX_PRIORITY_FEE_GWEI", 2),
    minAgentEth: envNum("MIN_AGENT_ETH", 0.05),
    ethUsdMaxAgeSec: envNum("ETH_USD_MAX_AGE_SEC", 3600 + 300),
    usdcUsdMaxAgeSec: envNum("USDC_USD_MAX_AGE_SEC", 86400 + 1800),
    receiptTimeoutMs: envNum("RECEIPT_TIMEOUT_MS", 240_000),
  };
}

let CFG: ReturnType<typeof loadConfig>;
let pub: PublicClient;
let relay: PublicClient;
function init() {
  if (CFG) return;
  CFG = loadConfig();
  pub = createPublicClient({ chain: mainnet, transport: http(CFG.readRpcUrl, { retryCount: 3 }) });
  relay = createPublicClient({ chain: mainnet, transport: http(CFG.sendRpcUrl, { retryCount: 0 }) });
}

// ─── Types ─────────────────────────────────────────────────────────────────────────────

export type Side = "SELL_WETH" | "BUY_WETH";

export interface RebalanceDecision {
  /** Unique per decision. Re-submitting the same id never trades twice. */
  id: string;
  side: Side;
  /** Exact input in tokenIn base units (wei for SELL_WETH, 1e-6 USDC for BUY_WETH). */
  amountIn: bigint;
}

export type RebalanceResult =
  | { status: "filled"; hash: Hex; amountIn: bigint; amountOut: bigint; notionalUsd: number }
  | { status: "reverted" | "dropped"; hash: Hex }
  | { status: "deferred" | "rejected" | "halted" | "dry-run" | "duplicate" | "busy"; reason: string; hash?: Hex };

class Deferred extends Error {} // fine to retry later (gas spike, etc.)
class Rejected extends Error {} // this decision violates policy; tell the operator, don't page
class Halt extends Error {} // something is wrong enough that a human must look; stops all trading

/** RPC hiccups and "price moved between quote and simulation" are retryable, not incidents. */
function isTransient(e: unknown): boolean {
  if (!(e instanceof BaseError)) return false;
  const names = ["HttpRequestError", "TimeoutError", "LimitExceededRpcError", "InternalRpcError", "ResourceUnavailableRpcError"];
  return !!e.walk((err) => names.includes((err as Error).name)) || e.message.includes("Too little received") || e.message.includes("Transaction too old");
}

// ─── Signer ────────────────────────────────────────────────────────────────────────────

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

/** Minimal DER ECDSA-Sig-Value parser: SEQUENCE { INTEGER r, INTEGER s }. */
function parseDerSignature(der: Uint8Array): { r: bigint; s: bigint } {
  let i = 0;
  const readLen = () => {
    let len = der[i++];
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let k = 0; k < n; k++) len = (len << 8) | der[i++];
    }
    return len;
  };
  const readInt = () => {
    if (der[i++] !== 0x02) throw new Error("DER: expected INTEGER");
    const len = readLen();
    const v = BigInt(toHex(der.slice(i, i + len)));
    i += len;
    return v;
  };
  if (der[i++] !== 0x30) throw new Error("DER: expected SEQUENCE");
  readLen();
  return { r: readInt(), s: readInt() };
}

/**
 * viem account backed by an AWS KMS asymmetric key (KeySpec ECC_SECG_P256K1, SIGN_VERIFY).
 * The private key never leaves KMS; the VM's IAM role may only call kms:Sign / kms:GetPublicKey.
 */
export async function kmsAccount(keyId: string, region?: string): Promise<LocalAccount> {
  const kms = new KMSClient({ region });
  const { PublicKey } = await kms.send(new GetPublicKeyCommand({ KeyId: keyId }));
  if (!PublicKey) throw new Error("KMS returned no public key");
  const uncompressed = PublicKey.slice(-65); // SPKI DER ends with the 0x04||X||Y point
  if (uncompressed[0] !== 0x04) throw new Error("unexpected KMS public key encoding (need secp256k1)");
  const address = publicKeyToAddress(toHex(uncompressed));

  async function signHash(hash: Hex) {
    const { Signature } = await kms.send(
      new SignCommand({ KeyId: keyId, Message: Buffer.from(hash.slice(2), "hex"), MessageType: "DIGEST", SigningAlgorithm: "ECDSA_SHA_256" }),
    );
    if (!Signature) throw new Error("KMS returned no signature");
    let { r, s } = parseDerSignature(Signature);
    if (s > SECP256K1_N / 2n) s = SECP256K1_N - s; // EIP-2: low-s only
    const sig = { r: numberToHex(r, { size: 32 }), s: numberToHex(s, { size: 32 }) };
    for (const yParity of [0, 1]) {
      const recovered = await recoverAddress({ hash, signature: { ...sig, yParity } });
      if (isAddressEqual(recovered, address)) return { ...sig, yParity };
    }
    throw new Error("KMS signature does not recover to the KMS key's address");
  }

  return toAccount({
    address,
    async signTransaction(tx, opts) {
      const serializer = opts?.serializer ?? serializeTransaction;
      const sig = await signHash(keccak256(await serializer(tx)));
      return serializer(tx, sig);
    },
    async signMessage({ message }) {
      const { r, s, yParity } = await signHash(hashMessage(message));
      return `${r}${s.slice(2)}${yParity ? "1c" : "1b"}` as Hex;
    },
    async signTypedData(typedData) {
      const { r, s, yParity } = await signHash(hashTypedData(typedData));
      return `${r}${s.slice(2)}${yParity ? "1c" : "1b"}` as Hex;
    },
  });
}

let _account: LocalAccount | undefined;
async function agentAccount(): Promise<LocalAccount> {
  if (_account) return _account;
  if (CFG.signer === "kms") {
    _account = await kmsAccount(env("KMS_KEY_ID"), process.env.AWS_REGION);
  } else {
    // Plaintext keys are for anvil fork tests only. Never set SIGNER=local on the production VM.
    if (process.env.I_UNDERSTAND_LOCAL_KEY_IS_FOR_TESTING !== "yes") throw new Error("SIGNER=local requires I_UNDERSTAND_LOCAL_KEY_IS_FOR_TESTING=yes");
    _account = privateKeyToAccount(env("AGENT_PRIVATE_KEY") as Hex);
  }
  return _account;
}

// ─── State: lock, idempotency, in-flight tx, daily ledger ──────────────────────────────

interface InFlight {
  decisionId: string;
  hash: Hex;
  nonce: number;
  deadline: number; // unix seconds; after this the swap reverts on-chain
  notionalUsd: number;
  raw: Hex; // signed tx, kept so it can be re-broadcast or inspected
}
interface State {
  inFlight?: InFlight;
  decisions: Record<string, { status: string; hash?: Hex; at: string }>;
  days: Record<string, { usd: number; trades: number }>; // UTC date -> committed volume
}

const statePath = () => join(CFG.stateDir, "state.json");
const haltPath = () => join(CFG.stateDir, "HALT");
const lockPath = () => join(CFG.stateDir, "lock");

function loadState(): State {
  if (!existsSync(statePath())) return { decisions: {}, days: {} };
  return JSON.parse(readFileSync(statePath(), "utf8"));
}
function saveState(s: State) {
  const tmp = `${statePath()}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2));
  renameSync(tmp, statePath()); // atomic replace
}
const today = () => new Date().toISOString().slice(0, 10);

function acquireLock() {
  mkdirSync(CFG.stateDir, { recursive: true });
  try {
    closeSync(openSync(lockPath(), "wx"));
  } catch {
    const pid = Number(readFileSync(lockPath(), "utf8") || 0);
    let alive = false;
    try {
      if (pid) (process.kill(pid, 0), (alive = true));
    } catch {}
    if (alive) throw new Deferred(`another rebalance is running (pid ${pid})`);
    rmSync(lockPath(), { force: true });
    closeSync(openSync(lockPath(), "wx"));
  }
  writeFileSync(lockPath(), String(process.pid));
}
const releaseLock = () => rmSync(lockPath(), { force: true });

// ─── Logging / alerting ────────────────────────────────────────────────────────────────

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...data }, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

async function notify(level: "warn" | "page", text: string) {
  log(`alert.${level}`, { text });
  const url = level === "page" ? (CFG.pageWebhook ?? CFG.alertWebhook) : CFG.alertWebhook;
  if (!url) return;
  try {
    await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: `[rebalancer:${level}] ${text}` }) });
  } catch (e) {
    log("alert.failed", { error: String(e) });
  }
}

async function halt(reason: string) {
  mkdirSync(CFG.stateDir, { recursive: true });
  writeFileSync(haltPath(), `${new Date().toISOString()} ${reason}\n`);
  await notify("page", `HALTED: ${reason}. Trading stopped until ${haltPath()} is removed.`);
}

// ─── Market data ───────────────────────────────────────────────────────────────────────

async function readFeed(feed: Address, maxAgeSec: number, name: string) {
  const [, answer, , updatedAt] = await pub.readContract({ address: feed, abi: chainlinkAbi, functionName: "latestRoundData" });
  const age = Math.floor(Date.now() / 1000) - Number(updatedAt);
  if (answer <= 0n) throw new Halt(`${name} feed returned non-positive answer ${answer}`);
  if (age > maxAgeSec) throw new Deferred(`${name} feed stale (${age}s old)`);
  return answer; // 8 decimals
}

const tokens = (side: Side) =>
  side === "SELL_WETH"
    ? { tokenIn: CONTRACTS.WETH, tokenOut: CONTRACTS.USDC, inDec: 18, outDec: 6 }
    : { tokenIn: CONTRACTS.USDC, tokenOut: CONTRACTS.WETH, inDec: 6, outDec: 18 };

/** Oracle-implied output for amountIn, and the USD notional (both from Chainlink). */
function oracleView(side: Side, amountIn: bigint, ethUsd: bigint, usdcUsd: bigint) {
  if (side === "SELL_WETH") {
    // wei * (USD/ETH) / (USD/USDC) -> USDC base units: 1e18 wei -> 1e6 => / 1e12
    return { expectedOut: (amountIn * ethUsd) / (usdcUsd * 10n ** 12n), notionalUsd: Number((amountIn * ethUsd) / 10n ** 18n) / 1e8 };
  }
  return { expectedOut: (amountIn * usdcUsd * 10n ** 12n) / ethUsd, notionalUsd: Number((amountIn * usdcUsd) / 10n ** 6n) / 1e8 };
}

// ─── Reconcile a tx left in flight by a previous run ───────────────────────────────────

async function reconcile(state: State, agent: Address): Promise<RebalanceResult | undefined> {
  const f = state.inFlight;
  if (!f) return;
  const receipt = await pub.getTransactionReceipt({ hash: f.hash }).catch(() => undefined);
  if (receipt) {
    const status = receipt.status === "success" ? "filled" : "reverted";
    if (status === "reverted") refund(state, f.notionalUsd);
    state.decisions[f.decisionId] = { status, hash: f.hash, at: new Date().toISOString() };
    state.inFlight = undefined;
    saveState(state);
    log("reconcile.mined", { hash: f.hash, status });
    return;
  }
  const latestNonce = await pub.getTransactionCount({ address: agent, blockTag: "latest" });
  if (latestNonce > f.nonce) {
    // Our nonce was consumed by a transaction we don't know about. Someone else is signing
    // with the agent key, or state was lost. Either way: stop.
    throw new Halt(`agent nonce ${f.nonce} consumed by unknown tx (expected ${f.hash})`);
  }
  const now = Math.floor(Date.now() / 1000);
  if (now > f.deadline + 60) {
    // Past its deadline it can only revert, and the private relay won't include reverts.
    // The next tx reuses this nonce, which permanently invalidates it.
    refund(state, f.notionalUsd);
    state.decisions[f.decisionId] = { status: "dropped", hash: f.hash, at: new Date().toISOString() };
    state.inFlight = undefined;
    saveState(state);
    log("reconcile.dropped", { hash: f.hash });
    return;
  }
  return { status: "busy", reason: `tx ${f.hash} still in flight until ${f.deadline}`, hash: f.hash };
}

function refund(state: State, usd: number) {
  const d = state.days[today()];
  if (d) ((d.usd = Math.max(0, d.usd - usd)), (d.trades = Math.max(0, d.trades - 1)));
}

// ─── Main entry point ──────────────────────────────────────────────────────────────────

export async function executeRebalance(decision: RebalanceDecision, opts: { dryRun?: boolean } = {}): Promise<RebalanceResult> {
  init();
  if (existsSync(haltPath())) return { status: "halted", reason: readFileSync(haltPath(), "utf8").trim() };
  try {
    acquireLock();
  } catch (e) {
    return { status: "busy", reason: (e as Error).message };
  }
  try {
    return await run(decision, !!opts.dryRun);
  } catch (e) {
    const msg = (e as Error).message;
    if (e instanceof Deferred) return (log("deferred", { id: decision.id, msg }), { status: "deferred", reason: msg });
    if (e instanceof Rejected) return (await notify("warn", `rejected ${decision.id}: ${msg}`), { status: "rejected", reason: msg });
    if (isTransient(e)) return (log("deferred.transient", { id: decision.id, msg }), { status: "deferred", reason: msg });
    // Halt, or anything unexpected (Roles rejected the call, RPC returned garbage, a bug): fail closed.
    await halt(e instanceof Halt ? msg : `unexpected error on ${decision.id}: ${msg}`);
    return { status: "halted", reason: msg };
  } finally {
    releaseLock();
  }
}

async function run(decision: RebalanceDecision, dryRun: boolean): Promise<RebalanceResult> {
  const { id, side, amountIn } = decision;
  const account = await agentAccount();
  const agent = account.address;
  const state = loadState();

  // 1. Idempotency + in-flight reconciliation ─────────────────────────────────────────
  if (state.decisions[id]) return { status: "duplicate", reason: `decision ${id} already ${state.decisions[id].status}`, hash: state.decisions[id].hash };
  const busy = await reconcile(state, agent);
  if (busy) return busy;
  if (amountIn <= 0n) throw new Rejected("amountIn must be positive");

  const chainId = await pub.getChainId();
  if (chainId !== mainnet.id) throw new Halt(`RPC is on chain ${chainId}, expected 1`);

  // 2. Pre-flight reads ────────────────────────────────────────────────────────────────
  const { tokenIn, tokenOut, inDec, outDec } = tokens(side);
  const [ethUsd, usdcUsd, safeBalIn, allowance, rolesAllowance, agentEth, block] = await Promise.all([
    readFeed(CONTRACTS.CHAINLINK_ETH_USD, CFG.ethUsdMaxAgeSec, "ETH/USD"),
    readFeed(CONTRACTS.CHAINLINK_USDC_USD, CFG.usdcUsdMaxAgeSec, "USDC/USD"),
    pub.readContract({ address: tokenIn, abi: erc20Abi, functionName: "balanceOf", args: [CFG.safe] }),
    pub.readContract({ address: tokenIn, abi: erc20Abi, functionName: "allowance", args: [CFG.safe, CONTRACTS.SWAP_ROUTER] }),
    pub.readContract({ address: CFG.roles, abi: rolesAbi, functionName: "allowances", args: [ALLOWANCE_KEYS[side]] }),
    pub.getBalance({ address: agent }),
    pub.getBlock({ blockTag: "latest" }),
  ]);

  const pegDevBps = ((usdcUsd - 10n ** 8n) * 10_000n) / 10n ** 8n;
  if (pegDevBps > CFG.usdcDepegBps || -pegDevBps > CFG.usdcDepegBps) throw new Halt(`USDC off peg: ${formatUnits(usdcUsd, 8)} USD`);

  const { expectedOut, notionalUsd } = oracleView(side, amountIn, ethUsd, usdcUsd);
  const day = (state.days[today()] ??= { usd: 0, trades: 0 });
  if (notionalUsd > CFG.maxTradeUsd) throw new Rejected(`trade $${notionalUsd.toFixed(0)} > MAX_TRADE_USD ${CFG.maxTradeUsd}`);
  if (day.usd + notionalUsd > CFG.maxDailyUsd)
    throw new Rejected(`daily volume would be $${(day.usd + notionalUsd).toFixed(0)} > MAX_DAILY_USD ${CFG.maxDailyUsd}`);
  if (day.trades + 1 > CFG.maxTradesPerDay) throw new Rejected(`trade count would exceed MAX_TRADES_PER_DAY ${CFG.maxTradesPerDay}`);
  const onchainLeft = accruedAllowance(rolesAllowance, block.timestamp);
  if (onchainLeft < amountIn)
    throw new Rejected(`on-chain daily allowance has ${formatUnits(onchainLeft, inDec)} left, trade needs ${formatUnits(amountIn, inDec)}`);
  if (safeBalIn < amountIn) throw new Rejected(`Safe has ${formatUnits(safeBalIn, inDec)} of tokenIn, needs ${formatUnits(amountIn, inDec)}`);
  if (allowance < amountIn) throw new Halt(`Safe allowance to SwapRouter is ${formatUnits(allowance, inDec)}; owners must re-approve (see DEPLOY.md)`);
  if (agentEth < parseUnits(String(CFG.minAgentEth), 18)) await notify("page", `agent gas balance low: ${formatUnits(agentEth, 18)} ETH at ${agent}`);

  const baseFee = block.baseFeePerGas ?? 0n;
  const maxBase = parseUnits(String(CFG.maxBaseFeeGwei), 9);
  if (baseFee > maxBase) throw new Deferred(`base fee ${formatUnits(baseFee, 9)} gwei > cap ${CFG.maxBaseFeeGwei}`);

  // 3. Quote + oracle cross-check ──────────────────────────────────────────────────────
  const { result: quote } = await pub.simulateContract({
    address: CONTRACTS.QUOTER_V2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [{ tokenIn, tokenOut, amountIn, fee: POOL_FEE, sqrtPriceLimitX96: 0n }],
  });
  const quotedOut = quote[0];
  // Positive = pool gives less than the oracle says it should.
  const devBps = ((expectedOut - quotedOut) * 10_000n) / expectedOut;
  log("quote", { id, side, amountIn, quotedOut, expectedOut, devBps, notionalUsd, ethUsd: formatUnits(ethUsd, 8) });
  if (devBps > CFG.maxOracleDevBps || -devBps > CFG.maxOracleDevBps) {
    // Pool and Chainlink disagree: fast market (oracle lags up to its 0.5% deviation
    // threshold), or the pool is being manipulated. Either way, not a good time to trade.
    throw new Deferred(`pool vs oracle deviation ${devBps} bps exceeds ${CFG.maxOracleDevBps}`);
  }
  // Floor the fill at both the quote minus slippage AND the oracle minus the max deviation.
  const fromQuote = (quotedOut * (10_000n - CFG.slippageBps)) / 10_000n;
  const fromOracle = (expectedOut * (10_000n - CFG.maxOracleDevBps)) / 10_000n;
  const amountOutMinimum = fromQuote > fromOracle ? fromQuote : fromOracle;

  // 4. Build + simulate ────────────────────────────────────────────────────────────────
  const deadline = block.timestamp + CFG.deadlineSeconds;
  const swapData = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [{ tokenIn, tokenOut, fee: POOL_FEE, recipient: CFG.safe, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n }],
  });
  const rolesArgs = [CONTRACTS.SWAP_ROUTER, 0n, swapData, 0 /* Call, never DelegateCall */, CFG.roleKey, true] as const;
  const txData = encodeFunctionData({ abi: rolesAbi, functionName: "execTransactionWithRole", args: rolesArgs });

  // Reverts here if the Roles permission rejects the call, the allowance is exhausted, or the swap fails.
  await pub.simulateContract({ account: agent, address: CFG.roles, abi: rolesAbi, functionName: "execTransactionWithRole", args: rolesArgs });
  const gasEstimate = await pub.estimateGas({ account: agent, to: CFG.roles, data: txData });
  const gas = (gasEstimate * 13n) / 10n;

  const priority = await pub.estimateMaxPriorityFeePerGas().catch(() => parseUnits("0.5", 9));
  const maxPriorityFeePerGas = priority < parseUnits(String(CFG.maxPriorityFeeGwei), 9) ? priority : parseUnits(String(CFG.maxPriorityFeeGwei), 9);
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas; // survives ~6 full blocks of base fee increases
  if (agentEth < gas * maxFeePerGas) throw new Halt(`agent ${agent} cannot pay gas: has ${formatUnits(agentEth, 18)} ETH`);

  if (dryRun) {
    log("dry-run", { id, to: CFG.roles, data: txData, gas, maxFeePerGas, amountOutMinimum: formatUnits(amountOutMinimum, outDec) });
    return { status: "dry-run", reason: `would swap ${formatUnits(amountIn, inDec)} for >= ${formatUnits(amountOutMinimum, outDec)}` };
  }

  // 5. Sign, persist, send ─────────────────────────────────────────────────────────────
  const nonce = await pub.getTransactionCount({ address: agent, blockTag: "latest" });
  const raw = await account.signTransaction({
    chainId: mainnet.id,
    type: "eip1559",
    to: CFG.roles,
    data: txData,
    value: 0n,
    nonce,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  const hash = keccak256(raw);

  // Commit intent + volume BEFORE broadcasting: if we crash after sending, the next run
  // finds the tx via reconcile() instead of trading again.
  day.usd += notionalUsd;
  day.trades += 1;
  state.inFlight = { decisionId: id, hash, nonce, deadline: Number(deadline), notionalUsd, raw };
  saveState(state);

  log("send", { id, hash, nonce, gas, maxFeePerGas, amountOutMinimum });
  try {
    await relay.sendRawTransaction({ serializedTransaction: raw });
  } catch (e) {
    // Ambiguous: the relay may or may not have accepted it. Leave it in flight; reconcile()
    // resolves it on the next run (mined, or dropped after the deadline).
    await notify("warn", `send of ${hash} errored (${(e as Error).message}); left in flight for reconciliation`);
    return { status: "busy", reason: "send errored; reconciling next run", hash };
  }

  // 6. Confirm ─────────────────────────────────────────────────────────────────────────
  let receipt;
  try {
    receipt = await pub.waitForTransactionReceipt({ hash, timeout: CFG.receiptTimeoutMs, confirmations: 1 });
  } catch {
    return { status: "busy", reason: "no receipt yet; reconciling next run", hash };
  }

  state.inFlight = undefined;
  if (receipt.status !== "success") {
    refund(state, notionalUsd);
    state.decisions[id] = { status: "reverted", hash, at: new Date().toISOString() };
    saveState(state);
    await notify("warn", `swap ${hash} reverted on-chain (gas spent, no funds moved)`);
    return { status: "reverted", hash };
  }

  // Realized output = tokenOut transferred into the Safe in this tx.
  let amountOut = 0n;
  for (const l of receipt.logs) {
    if (!isAddressEqual(l.address, tokenOut)) continue;
    try {
      const ev = decodeEventLog({ abi: erc20Abi, eventName: "Transfer", data: l.data, topics: l.topics });
      if (isAddressEqual(ev.args.to, CFG.safe)) amountOut += ev.args.value;
    } catch {}
  }
  state.decisions[id] = { status: "filled", hash, at: new Date().toISOString() };
  saveState(state);

  const realizedDevBps = ((expectedOut - amountOut) * 10_000n) / expectedOut;
  log("filled", {
    id,
    hash,
    amountIn: formatUnits(amountIn, inDec),
    amountOut: formatUnits(amountOut, outDec),
    realizedDevBps,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
  });
  if (amountOut < amountOutMinimum) throw new Halt(`fill ${amountOut} below amountOutMinimum ${amountOutMinimum} in ${hash} — should be impossible`);

  return { status: "filled", hash, amountIn, amountOut, notionalUsd };
}

// ─── CLI ───────────────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      side: { type: "string" },
      amount: { type: "string" },
      id: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      whoami: { type: "boolean", default: false },
    },
  });
  if (values.whoami) {
    // Prints the agent address (derived from the KMS public key) without touching the chain.
    init();
    console.log((await agentAccount()).address);
    process.exit(0);
  }
  const side = values.side as Side;
  if (side !== "SELL_WETH" && side !== "BUY_WETH") throw new Error("--side SELL_WETH|BUY_WETH");
  if (!values.amount || !values.id) throw new Error("--amount <tokenIn units, e.g. 5 or 15000> --id <unique id>");
  const amountIn = parseUnits(values.amount, tokens(side).inDec);
  executeRebalance({ id: values.id, side, amountIn }, { dryRun: values["dry-run"] }).then(
    (r) => {
      log("result", r as unknown as Record<string, unknown>);
      process.exit(r.status === "filled" || r.status === "dry-run" || r.status === "duplicate" ? 0 : 1);
    },
    (e) => {
      log("fatal", { error: String(e) });
      process.exit(2);
    },
  );
}
