/**
 * rebalance.ts — WETH/USDC treasury rebalancer, Uniswap V3, Ethereum mainnet.
 *
 * Scope: this file is the EXECUTION PATH. It takes a rebalance decision that
 * your signal engine already made and turns it into a signed, submitted,
 * confirmed mainnet transaction — with the guards that a $400k unattended
 * position needs.
 *
 * It deliberately does NOT contain the signal. Feed it a Decision.
 *
 * Read DEPLOY.md before pointing this at a funded key.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseAbi,
  encodeFunctionData,
  formatUnits,
  parseUnits,
  getAddress,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
  type TransactionReceipt,
} from 'viem';
import { WaitForTransactionReceiptTimeoutError } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import {
  appendFileSync, openSync, closeSync, fsyncSync, existsSync, readFileSync, unlinkSync,
} from 'node:fs';

// ───────────────────────────────────────────────────────────────────────────
// 1. ADDRESSES — every contract this process can touch. Nothing else is ever
//    called. Cross-check each of these against Etherscan before first run.
// ───────────────────────────────────────────────────────────────────────────

export const ADDR = {
  // Tokens
  WETH: getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
  USDC: getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),

  // Uniswap V3 SwapRouter02. This is the ONLY address we ever grant an
  // ERC20 allowance to, and only ever for the exact amount of one trade.
  SWAP_ROUTER_02: getAddress('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'),

  // Uniswap V3 QuoterV2 — read-only simulation, never in a signed tx.
  QUOTER_V2: getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e'),

  // Chainlink ETH/USD aggregator (8 decimals). Independent price reference so
  // our slippage floor does not come from the same pool an attacker can move.
  CHAINLINK_ETH_USD: getAddress('0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'),

  // The two WETH/USDC V3 pools we consider. Not called directly — listed so
  // that "which pools does this touch" has a written answer.
  POOL_WETH_USDC_005: getAddress('0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'),
  POOL_WETH_USDC_030: getAddress('0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8'),
} as const;

const DECIMALS = { WETH: 18, USDC: 6 } as const;
const FEE_TIERS = [500, 3000] as const; // 0.05%, 0.30%
type FeeTier = (typeof FEE_TIERS)[number];

// ───────────────────────────────────────────────────────────────────────────
// 2. CONFIG — risk limits. These are the difference between a bad trade and a
//    drained treasury. Every one of them is enforced before signing.
// ───────────────────────────────────────────────────────────────────────────

const env = (k: string, d?: string): string => {
  const v = process.env[k] ?? d;
  if (v === undefined) throw new Error(`missing required env var ${k}`);
  return v;
};
const envNum = (k: string, d: number): number => Number(process.env[k] ?? d);

export const CONFIG = {
  // --- transport ---
  // Public reads. Your own node or a paid provider. Never a free public RPC.
  rpcUrl: env('RPC_URL'),
  // Private submission. Flashbots Protect keeps $10-50k swaps out of the
  // public mempool so they cannot be sandwiched. See DEPLOY.md §5.
  submitRpcUrl: env('SUBMIT_RPC_URL', 'https://rpc.flashbots.net/fast'),

  // --- size limits ---
  maxTradeNotionalUsd: envNum('MAX_TRADE_NOTIONAL_USD', 60_000),
  maxDailyNotionalUsd: envNum('MAX_DAILY_NOTIONAL_USD', 250_000),
  maxTradesPerDay: envNum('MAX_TRADES_PER_DAY', 12),
  minTradeNotionalUsd: envNum('MIN_TRADE_NOTIONAL_USD', 2_000), // dust guard

  // --- price safety ---
  // Abort entirely if the pool price and Chainlink disagree by more than this.
  // Catches manipulated pools, depegs, and our own unit-conversion bugs.
  maxPoolOracleDeviationBps: envNum('MAX_POOL_ORACLE_DEVIATION_BPS', 100), // 1%
  // Slippage tolerance applied to the live quote to produce amountOutMinimum.
  maxSlippageBps: envNum('MAX_SLIPPAGE_BPS', 30), // 0.30%
  // Extra band on the oracle-derived floor: oracle deviation threshold (50bps)
  // + pool fee + our slippage. Keeps the floor binding but not self-reverting.
  // Calibrated so that at the edge of tolerable drift the oracle floor and the
  // quote floor converge. Looser than this and the oracle floor never binds.
  oracleFloorBandBps: envNum('ORACLE_FLOOR_BAND_BPS', 90), // 0.90%
  // Chainlink ETH/USD heartbeat is 3600s. Refuse to trade on a stale answer.
  maxOracleAgeSec: envNum('MAX_ORACLE_AGE_SEC', 4_200),

  // --- gas ---
  maxBaseFeeGwei: envNum('MAX_BASE_FEE_GWEI', 80),
  priorityFeeGwei: envNum('PRIORITY_FEE_GWEI', 2),
  gasLimitBufferPct: envNum('GAS_LIMIT_BUFFER_PCT', 25),
  // Hard floor of native ETH on the hot key. Below this we halt rather than
  // discover mid-week that we cannot pay for a de-risking trade.
  minEthBalanceWei: parseUnits(env('MIN_ETH_BALANCE', '0.15'), 18),

  // --- timing ---
  // Max age of a quote at the moment we sign. Both price floors are derived
  // from a single instant; if we stall (GC pause, RPC retry, slow KMS round
  // trip) they are anchored to a price that no longer exists.
  maxPlanAgeSec: envNum('MAX_PLAN_AGE_SEC', 45),
  // Max oracle move between quoting and signing before we abandon the plan.
  maxPlanDriftBps: envNum('MAX_PLAN_DRIFT_BPS', 25),
  deadlineSec: envNum('DEADLINE_SEC', 240),
  inclusionTimeoutSec: envNum('INCLUSION_TIMEOUT_SEC', 300),
  confirmations: envNum('CONFIRMATIONS', 3),

  // --- circuit breaker ---
  // Rolling window of execution quality. If we are systematically losing more
  // than this to slippage vs the oracle, something is wrong (bad routing, a
  // toxic pool, an adversary) — stop and page a human.
  slippageWindowTrades: envNum('SLIPPAGE_WINDOW_TRADES', 10),
  maxAvgSlippageBps: envNum('MAX_AVG_SLIPPAGE_BPS', 60),

  // --- files ---
  journalPath: env('JOURNAL_PATH', './state/journal.jsonl'),
  haltFilePath: env('HALT_FILE', './state/HALT'),
  lockFilePath: env('LOCK_FILE', './state/rebalance.lock'),
} as const;

// ───────────────────────────────────────────────────────────────────────────
// 3. ABIs — narrow on purpose. We only encode the four functions we use.
// ───────────────────────────────────────────────────────────────────────────

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]);

const quoterV2Abi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);

const swapRouter02Abi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)',
]);

const chainlinkAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
]);

// ───────────────────────────────────────────────────────────────────────────
// 4. TYPES
// ───────────────────────────────────────────────────────────────────────────

/** What your signal engine hands us. Direction + size, nothing else. */
export type Decision = {
  direction: 'WETH_TO_USDC' | 'USDC_TO_WETH';
  /** Human units of the input token, e.g. "12.5" WETH or "40000" USDC. */
  amountIn: string;
  /** Opaque id from the signal engine; used for idempotency in the journal. */
  intentId: string;
};

type Journal =
  | { kind: 'intent'; ts: number; intentId: string; decision: Decision }
  | { kind: 'rejected'; ts: number; intentId: string; reason: string }
  | { kind: 'broadcast'; ts: number; intentId: string; hash: Hex; nonce: number;
      step: 'approve' | 'swap'; amountIn: string; minOut: string; notionalUsd: number }
  | { kind: 'mined'; ts: number; intentId: string; hash: Hex; step: 'approve' | 'swap';
      status: 'success' | 'reverted'; block: string; gasUsedWei: string;
      amountOut?: string; slippageBps?: number }
  | { kind: 'cancelled'; ts: number; intentId: string; replacedHash: Hex; cancelHash: Hex }
  | { kind: 'halt'; ts: number; reason: string };

// ───────────────────────────────────────────────────────────────────────────
// 5. JOURNAL — append-only, fsync'd before every broadcast. This is the only
//    thing standing between a crash-at-the-wrong-moment and a double trade.
// ───────────────────────────────────────────────────────────────────────────

function journalWrite(entry: Journal): void {
  const line = JSON.stringify(entry) + '\n';
  appendFileSync(CONFIG.journalPath, line);
  // fsync: the durability guarantee. Without this a VM hard-stop can lose the
  // record of a transaction that is already on-chain.
  const fd = openSync(CONFIG.journalPath, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
  console.log('[journal]', line.trimEnd());
}

function journalRead(): Journal[] {
  if (!existsSync(CONFIG.journalPath)) return [];
  return readFileSync(CONFIG.journalPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Journal);
}

// ───────────────────────────────────────────────────────────────────────────
// 6. CLIENTS
// ───────────────────────────────────────────────────────────────────────────

export function makeClients(account: Account) {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(CONFIG.rpcUrl, { retryCount: 3, timeout: 15_000 }),
  });
  // Reads and simulation go through our own node. Signed transactions go out
  // through the private relay. Two transports, on purpose.
  const submitClient = createPublicClient({
    chain: mainnet,
    transport: http(CONFIG.submitRpcUrl, { retryCount: 2, timeout: 20_000 }),
  });
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(CONFIG.rpcUrl),
  });
  return { publicClient, submitClient, walletClient };
}

// ───────────────────────────────────────────────────────────────────────────
// 7. PREFLIGHT — the checks that must pass before we are willing to sign.
//    Every one of these has a specific failure it is preventing.
// ───────────────────────────────────────────────────────────────────────────

class Halt extends Error {}
class Reject extends Error {}

/** Assert the token contracts really have the decimals we hardcoded. A silent
 *  decimals mismatch is a 10^12x sizing error, i.e. the whole treasury. */
async function assertTokenInvariants(pc: PublicClient): Promise<void> {
  const [weth, usdc] = await Promise.all([
    pc.readContract({ address: ADDR.WETH, abi: erc20Abi, functionName: 'decimals' }),
    pc.readContract({ address: ADDR.USDC, abi: erc20Abi, functionName: 'decimals' }),
  ]);
  if (weth !== DECIMALS.WETH) throw new Halt(`WETH decimals ${weth} != ${DECIMALS.WETH}`);
  if (usdc !== DECIMALS.USDC) throw new Halt(`USDC decimals ${usdc} != ${DECIMALS.USDC}`);
}

/** Operator kill switch: `touch state/HALT` stops trading at the next cycle
 *  without needing to kill the process or race a pending transaction. */
function assertNotHalted(): void {
  if (existsSync(CONFIG.haltFilePath)) {
    throw new Halt(`HALT file present: ${readFileSync(CONFIG.haltFilePath, 'utf8').trim()}`);
  }
}

/** Rolling execution-quality breaker. Real market moves do not trip this;
 *  systematically bad fills do. */
function assertExecutionQuality(): void {
  const fills = journalRead()
    .filter((e): e is Extract<Journal, { kind: 'mined' }> =>
      e.kind === 'mined' && e.step === 'swap' && e.status === 'success' && e.slippageBps !== undefined)
    .slice(-CONFIG.slippageWindowTrades);
  if (fills.length < CONFIG.slippageWindowTrades) return;
  const avg = fills.reduce((a, f) => a + (f.slippageBps ?? 0), 0) / fills.length;
  if (avg > CONFIG.maxAvgSlippageBps) {
    throw new Halt(`avg slippage ${avg.toFixed(1)}bps over last ${fills.length} fills ` +
      `exceeds ${CONFIG.maxAvgSlippageBps}bps — likely adversarial flow or bad routing`);
  }
}

/** Daily notional and trade-count caps, reconstructed from the journal. */
function assertDailyCaps(notionalUsd: number): void {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const today = journalRead().filter(
    (e): e is Extract<Journal, { kind: 'broadcast' }> =>
      e.kind === 'broadcast' && e.step === 'swap' && e.ts >= cutoff);
  const used = today.reduce((a, e) => a + e.notionalUsd, 0);
  if (today.length + 1 > CONFIG.maxTradesPerDay) {
    throw new Reject(`daily trade count cap: ${today.length}/${CONFIG.maxTradesPerDay}`);
  }
  if (used + notionalUsd > CONFIG.maxDailyNotionalUsd) {
    throw new Reject(`daily notional cap: $${Math.round(used)} + $${Math.round(notionalUsd)} ` +
      `> $${CONFIG.maxDailyNotionalUsd}`);
  }
}

/** Gas is paid in native ETH, which is NOT part of the WETH/USDC treasury.
 *  Running out of it strands the position. */
async function assertGasBudget(pc: PublicClient, account: Address): Promise<void> {
  const bal = await pc.getBalance({ address: account });
  if (bal < CONFIG.minEthBalanceWei) {
    throw new Halt(`native ETH ${formatUnits(bal, 18)} below floor ` +
      `${formatUnits(CONFIG.minEthBalanceWei, 18)} — top up the hot key`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 8. PRICING — two independent sources, and we take the stricter floor.
// ───────────────────────────────────────────────────────────────────────────

type OraclePrice = { ethUsd: number; updatedAt: number };

async function readOracle(pc: PublicClient): Promise<OraclePrice> {
  const [, answer, , updatedAt] = await pc.readContract({
    address: ADDR.CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: 'latestRoundData',
  });
  if (answer <= 0n) throw new Halt('Chainlink ETH/USD returned non-positive answer');
  const age = Math.floor(Date.now() / 1000) - Number(updatedAt);
  if (age > CONFIG.maxOracleAgeSec) {
    throw new Halt(`Chainlink ETH/USD stale by ${age}s (max ${CONFIG.maxOracleAgeSec}s)`);
  }
  return { ethUsd: Number(formatUnits(answer, 8)), updatedAt: Number(updatedAt) };
}

type Quote = { fee: FeeTier; amountOut: bigint; gasEstimate: bigint };

/** QuoterV2 is state-mutating by design (it reverts to return data), so it must
 *  be simulated, never signed. */
async function quoteBestTier(
  pc: PublicClient, tokenIn: Address, tokenOut: Address, amountIn: bigint,
): Promise<Quote> {
  const results = await Promise.allSettled(
    FEE_TIERS.map(async (fee): Promise<Quote> => {
      const { result } = await pc.simulateContract({
        address: ADDR.QUOTER_V2,
        abi: quoterV2Abi,
        functionName: 'quoteExactInputSingle',
        args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      return { fee, amountOut: result[0], gasEstimate: result[3] };
    }),
  );
  const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  if (ok.length === 0) throw new Reject('no WETH/USDC V3 tier returned a quote');
  return ok.reduce((best, q) => (q.amountOut > best.amountOut ? q : best));
}

/**
 * Turn a quote into an amountOutMinimum we are willing to sign.
 *
 * Two floors:
 *   quoteFloor  — live quote minus slippage tolerance. Defends against a
 *                 sandwich that moves the pool between our read and our fill.
 *   oracleFloor — Chainlink price minus a wider band. Defends against the pool
 *                 itself being wrong: a manipulated tick, a thin tier, a stale
 *                 pool nobody has arbitraged.
 *
 * We take the MAX (stricter). In normal conditions the quote floor binds and
 * the oracle floor is a backstop; it takes over once the pool has drifted far
 * enough from fair value that the quote is no longer a price worth trusting.
 *
 * Both are computed from one instant, which is why the caller must also check
 * plan freshness before signing — see assertPlanFresh().
 */
export function computeMinOut(args: {
  direction: Decision['direction']; amountIn: bigint; quote: Quote; oracle: OraclePrice;
}): { minOut: bigint; poolPriceUsd: number; deviationBps: number } {
  const { direction, amountIn, quote, oracle } = args;

  let poolPriceUsd: number; // pool-implied ETH price in USD
  let oracleFloorRaw: bigint;

  if (direction === 'WETH_TO_USDC') {
    const wethIn = Number(formatUnits(amountIn, DECIMALS.WETH));
    const usdcOut = Number(formatUnits(quote.amountOut, DECIMALS.USDC));
    poolPriceUsd = usdcOut / wethIn;
    const fairUsdc = wethIn * oracle.ethUsd;
    oracleFloorRaw = parseUnits(
      (fairUsdc * (1 - CONFIG.oracleFloorBandBps / 10_000)).toFixed(DECIMALS.USDC),
      DECIMALS.USDC,
    );
  } else {
    const usdcIn = Number(formatUnits(amountIn, DECIMALS.USDC));
    const wethOut = Number(formatUnits(quote.amountOut, DECIMALS.WETH));
    poolPriceUsd = usdcIn / wethOut;
    const fairWeth = usdcIn / oracle.ethUsd;
    oracleFloorRaw = parseUnits(
      (fairWeth * (1 - CONFIG.oracleFloorBandBps / 10_000)).toFixed(DECIMALS.WETH),
      DECIMALS.WETH,
    );
  }

  const deviationBps = Math.abs(poolPriceUsd - oracle.ethUsd) / oracle.ethUsd * 10_000;
  if (deviationBps > CONFIG.maxPoolOracleDeviationBps) {
    // Do not trade *at all*. Something is wrong with the pool, the oracle, or
    // our arithmetic, and we cannot tell which from in here.
    throw new Halt(
      `pool/oracle deviation ${deviationBps.toFixed(0)}bps > ${CONFIG.maxPoolOracleDeviationBps}bps ` +
      `(pool $${poolPriceUsd.toFixed(2)} vs oracle $${oracle.ethUsd.toFixed(2)})`);
  }

  const quoteFloor = (quote.amountOut * BigInt(10_000 - CONFIG.maxSlippageBps)) / 10_000n;
  const minOut = quoteFloor > oracleFloorRaw ? quoteFloor : oracleFloorRaw;
  return { minOut, poolPriceUsd, deviationBps };
}

/**
 * Re-read the oracle immediately before signing. A quote is a claim about a
 * price at a moment; by the time we sign, that moment may be gone. Cheap check,
 * and it is the only thing covering the window between planning and signing.
 */
async function assertPlanFresh(
  pc: PublicClient, planAt: number, planEthUsd: number,
): Promise<void> {
  const ageSec = (Date.now() - planAt) / 1000;
  if (ageSec > CONFIG.maxPlanAgeSec) {
    throw new Reject(`plan is ${ageSec.toFixed(0)}s old (max ${CONFIG.maxPlanAgeSec}s) — requote`);
  }
  const now = await readOracle(pc);
  const driftBps = Math.abs(now.ethUsd - planEthUsd) / planEthUsd * 10_000;
  if (driftBps > CONFIG.maxPlanDriftBps) {
    throw new Reject(
      `ETH moved ${driftBps.toFixed(0)}bps between quote and signing ` +
      `($${planEthUsd.toFixed(2)} -> $${now.ethUsd.toFixed(2)}) — requote`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 9. FEES
// ───────────────────────────────────────────────────────────────────────────

async function feeParams(pc: PublicClient) {
  const block = await pc.getBlock({ blockTag: 'latest' });
  const baseFee = block.baseFeePerGas ?? 0n;
  const cap = parseUnits(String(CONFIG.maxBaseFeeGwei), 9);
  if (baseFee > cap) {
    // Routine rebalancing is not worth paying any price for. De-risking trades
    // are — raise MAX_BASE_FEE_GWEI deliberately if you need one through.
    throw new Reject(`base fee ${formatUnits(baseFee, 9)} gwei > cap ${CONFIG.maxBaseFeeGwei} gwei`);
  }
  const maxPriorityFeePerGas = parseUnits(String(CONFIG.priorityFeeGwei), 9);
  // 2x headroom on base fee absorbs ~6 blocks of consecutive full blocks.
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
  return { maxFeePerGas, maxPriorityFeePerGas, baseFee };
}

// ───────────────────────────────────────────────────────────────────────────
// 10. SIGN AND BROADCAST
//
// We deliberately split sign / persist / broadcast. viem's sendTransaction
// would collapse these into one call, and then a crash between "the node has
// it" and "we wrote it down" leaves an untracked transaction moving $50k.
// Signing first gives us the hash before anyone else has seen the payload.
// ───────────────────────────────────────────────────────────────────────────

type SignedTx = { hash: Hex; raw: Hex; nonce: number };

async function signCall(args: {
  pc: PublicClient; wc: WalletClient; account: Account;
  to: Address; data: Hex; nonce: number; gasLimit: bigint;
}): Promise<SignedTx> {
  const { pc, wc, account, to, data, nonce, gasLimit } = args;
  const { maxFeePerGas, maxPriorityFeePerGas } = await feeParams(pc);
  const raw = await wc.signTransaction({
    account, chain: mainnet, to, data, value: 0n, nonce,
    gas: gasLimit, maxFeePerGas, maxPriorityFeePerGas, type: 'eip1559',
  });
  return { hash: keccak256(raw), raw, nonce };
}

async function estimateWithBuffer(
  pc: PublicClient, account: Address, to: Address, data: Hex,
): Promise<bigint> {
  // This is also our last correctness check: if the call would revert, it
  // reverts here, for free, instead of on-chain for $30 of gas.
  const gas = await pc.estimateGas({ account, to, data, value: 0n });
  return (gas * BigInt(100 + CONFIG.gasLimitBufferPct)) / 100n;
}

/**
 * Broadcast, then wait. If the private relay does not include us within the
 * timeout we cancel by replacing our own nonce, so the next cycle starts from
 * a known-clean state instead of inheriting a zombie transaction.
 */
async function broadcastAndConfirm(args: {
  pc: PublicClient; submit: PublicClient; wc: WalletClient; account: Account;
  signed: SignedTx; intentId: string; step: 'approve' | 'swap';
  amountIn: string; minOut: string; notionalUsd: number;
}) {
  const { pc, submit, wc, account, signed, intentId, step } = args;

  // Durable record BEFORE the transaction exists anywhere else.
  journalWrite({
    kind: 'broadcast', ts: Date.now(), intentId, hash: signed.hash,
    nonce: signed.nonce, step, amountIn: args.amountIn, minOut: args.minOut,
    notionalUsd: args.notionalUsd,
  });

  await submit.sendRawTransaction({ serializedTransaction: signed.raw });
  console.log(`[submit] ${step} ${signed.hash} via ${new URL(CONFIG.submitRpcUrl).host}`);

  try {
    const receipt = await pc.waitForTransactionReceipt({
      hash: signed.hash,
      confirmations: CONFIG.confirmations,
      timeout: CONFIG.inclusionTimeoutSec * 1000,
    });
    return receipt;
  } catch (err) {
    if (!(err instanceof WaitForTransactionReceiptTimeoutError)) {
      // An RPC error is NOT evidence the transaction failed. Cancelling here
      // could replace a perfectly good in-flight swap, or race it. Halt and
      // let reconcile() resolve the hash on the next run.
      throw new Halt(`lost visibility on in-flight ${step} ${signed.hash}: ${String(err)}`);
    }
    console.error(`[timeout] ${signed.hash} not included in ${CONFIG.inclusionTimeoutSec}s`);
    const landed = await cancelNonce({
      pc, wc, account, nonce: signed.nonce, intentId, replaced: signed.hash,
    });
    if (landed) return landed;
    throw new Reject('not included before timeout; nonce cancelled');
  }
}

/** Replace a stuck nonce with a 0-value self-send at a fee the public mempool
 *  will not ignore. Goes out over the PUBLIC RPC on purpose — we want this one
 *  to be seen and mined immediately. */
async function cancelNonce(args: {
  pc: PublicClient; wc: WalletClient; account: Account;
  nonce: number; intentId: string; replaced: Hex;
}): Promise<TransactionReceipt | null> {
  const { pc, wc, account, nonce } = args;
  const { baseFee } = await feeParams(pc).catch(() => ({ baseFee: parseUnits('50', 9) }));
  // Must beat the original by >=10% to be accepted as a replacement; go well over.
  const maxPriorityFeePerGas = parseUnits(String(CONFIG.priorityFeeGwei * 3), 9);
  const raw = await wc.signTransaction({
    account, chain: mainnet, to: account.address, data: '0x', value: 0n, nonce,
    gas: 21_000n, maxFeePerGas: baseFee * 3n + maxPriorityFeePerGas,
    maxPriorityFeePerGas, type: 'eip1559',
  });
  const cancelHash = keccak256(raw);
  journalWrite({
    kind: 'cancelled', ts: Date.now(), intentId: args.intentId,
    replacedHash: args.replaced, cancelHash,
  });
  await pc.sendRawTransaction({ serializedTransaction: raw });
  await pc.waitForTransactionReceipt({ hash: cancelHash, timeout: 180_000 }).catch(() => {});

  // The cancel and the original both wanted nonce N. Exactly one of them is
  // on-chain now. Find out which before telling the caller the trade did not
  // happen — getting this backwards means trading the same $50k twice.
  const original = await pc.getTransactionReceipt({ hash: args.replaced }).catch(() => null);
  if (original) {
    console.warn(`[cancel-lost] original ${args.replaced} landed despite cancellation`);
    return original;
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// 11. CRASH RECOVERY — run before anything else. Any 'broadcast' with no
//     terminal record is a transaction we may or may not have landed. We are
//     not allowed to trade again until we know which.
// ───────────────────────────────────────────────────────────────────────────

async function reconcile(pc: PublicClient, account: Address): Promise<void> {
  const entries = journalRead();
  const terminal = new Set(
    entries.flatMap((e) =>
      e.kind === 'mined' ? [e.hash] : e.kind === 'cancelled' ? [e.replacedHash] : []),
  );
  const pending = entries.filter(
    (e): e is Extract<Journal, { kind: 'broadcast' }> =>
      e.kind === 'broadcast' && !terminal.has(e.hash));

  for (const p of pending) {
    console.log(`[reconcile] resolving orphaned ${p.step} ${p.hash}`);
    const receipt = await pc.getTransactionReceipt({ hash: p.hash }).catch(() => null);
    if (receipt) {
      journalWrite({
        kind: 'mined', ts: Date.now(), intentId: p.intentId, hash: p.hash, step: p.step,
        status: receipt.status, block: receipt.blockNumber.toString(),
        gasUsedWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
      });
      continue;
    }
    // Not mined. Is the nonce still open? If the account's confirmed nonce has
    // moved past it, some other transaction took that slot and this one is dead.
    const current = await pc.getTransactionCount({ address: account, blockTag: 'latest' });
    if (current > p.nonce) {
      journalWrite({ kind: 'cancelled', ts: Date.now(), intentId: p.intentId,
        replacedHash: p.hash, cancelHash: p.hash });
      continue;
    }
    throw new Halt(
      `orphaned transaction ${p.hash} (nonce ${p.nonce}) is neither mined nor superseded. ` +
      `It may still land. Resolve manually before restarting — see DEPLOY.md §7.`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 12. THE EXECUTION PATH
// ───────────────────────────────────────────────────────────────────────────

export async function executeRebalance(decision: Decision): Promise<void> {
  const pk = env('HOT_KEY_PRIVATE_KEY') as Hex; // see DEPLOY.md §2 — prefer KMS
  const account = privateKeyToAccount(pk);
  const { publicClient: pc, submitClient: submit, walletClient: wc } = makeClients(account);

  console.log(`[start] hot key ${account.address}`);
  journalWrite({ kind: 'intent', ts: Date.now(), intentId: decision.intentId, decision });

  // --- preflight -----------------------------------------------------------
  assertNotHalted();
  await reconcile(pc, account.address);
  await assertTokenInvariants(pc);
  await assertGasBudget(pc, account.address);
  assertExecutionQuality();

  // Idempotency: a decision id executes at most once, ever.
  if (journalRead().some((e) => e.kind === 'broadcast' &&
      e.step === 'swap' && e.intentId === decision.intentId)) {
    throw new Reject(`intent ${decision.intentId} already executed`);
  }

  const toUsdc = decision.direction === 'WETH_TO_USDC';
  const tokenIn = toUsdc ? ADDR.WETH : ADDR.USDC;
  const tokenOut = toUsdc ? ADDR.USDC : ADDR.WETH;
  const decIn = toUsdc ? DECIMALS.WETH : DECIMALS.USDC;
  const decOut = toUsdc ? DECIMALS.USDC : DECIMALS.WETH;
  const amountIn = parseUnits(decision.amountIn, decIn);
  if (amountIn <= 0n) throw new Reject('non-positive amountIn');

  // --- price + sizing ------------------------------------------------------
  const oracle = await readOracle(pc);
  const notionalUsd = toUsdc
    ? Number(decision.amountIn) * oracle.ethUsd
    : Number(decision.amountIn);

  if (notionalUsd < CONFIG.minTradeNotionalUsd) {
    throw new Reject(`$${Math.round(notionalUsd)} below dust floor $${CONFIG.minTradeNotionalUsd}`);
  }
  if (notionalUsd > CONFIG.maxTradeNotionalUsd) {
    throw new Reject(`$${Math.round(notionalUsd)} exceeds per-trade cap $${CONFIG.maxTradeNotionalUsd}`);
  }
  assertDailyCaps(notionalUsd);

  const balance = await pc.readContract({
    address: tokenIn, abi: erc20Abi, functionName: 'balanceOf', args: [account.address],
  });
  if (balance < amountIn) {
    throw new Reject(`insufficient ${toUsdc ? 'WETH' : 'USDC'}: have ` +
      `${formatUnits(balance, decIn)}, need ${decision.amountIn}`);
  }

  const quote = await quoteBestTier(pc, tokenIn, tokenOut, amountIn);
  const { minOut, poolPriceUsd, deviationBps } = computeMinOut({
    direction: decision.direction, amountIn, quote, oracle,
  });

  const planAt = Date.now();
  console.log(
    `[plan] ${decision.direction} ${decision.amountIn} -> >=${formatUnits(minOut, decOut)} ` +
    `| tier ${quote.fee / 10_000}% | pool $${poolPriceUsd.toFixed(2)} ` +
    `oracle $${oracle.ethUsd.toFixed(2)} (${deviationBps.toFixed(0)}bps) | $${Math.round(notionalUsd)}`);

  let nonce = await pc.getTransactionCount({ address: account.address, blockTag: 'pending' });

  // --- step 1: exact-amount approval --------------------------------------
  // We never leave a standing allowance. Approve exactly amountIn; the swap
  // consumes exactly amountIn; allowance returns to zero. If SwapRouter02 is
  // ever compromised, it can take at most one in-flight trade, not the treasury.
  const allowance = await pc.readContract({
    address: tokenIn, abi: erc20Abi, functionName: 'allowance',
    args: [account.address, ADDR.SWAP_ROUTER_02],
  });

  if (allowance < amountIn) {
    const approveData = encodeFunctionData({
      abi: erc20Abi, functionName: 'approve', args: [ADDR.SWAP_ROUTER_02, amountIn],
    });
    const gasLimit = await estimateWithBuffer(pc, account.address, tokenIn, approveData);
    const signed = await signCall({ pc, wc, account, to: tokenIn, data: approveData, nonce, gasLimit });
    const receipt = await broadcastAndConfirm({
      pc, submit, wc, account, signed, intentId: decision.intentId, step: 'approve',
      amountIn: decision.amountIn, minOut: '0', notionalUsd: 0,
    });
    journalWrite({
      kind: 'mined', ts: Date.now(), intentId: decision.intentId, hash: signed.hash,
      step: 'approve', status: receipt.status, block: receipt.blockNumber.toString(),
      gasUsedWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
    });
    if (receipt.status !== 'success') throw new Reject('approval reverted');
    nonce += 1;
  }

  // --- step 2: the swap ----------------------------------------------------
  // SwapRouter02's ExactInputSingleParams has no deadline field; the deadline
  // lives on multicall(). Wrapping the swap in multicall is how you get one.
  // Without it a transaction can sit unmined for an hour and then fill at a
  // price from an hour ago.
  const swapCalldata = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn, tokenOut, fee: quote.fee,
      recipient: account.address,      // proceeds return to the hot key
      amountIn,
      amountOutMinimum: minOut,        // the only thing enforcing our price
      sqrtPriceLimitX96: 0n,
    }],
  });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + CONFIG.deadlineSec);
  const data = encodeFunctionData({
    abi: swapRouter02Abi, functionName: 'multicall', args: [deadline, [swapCalldata]],
  });

  // The approval above may have cost us a block or more. Everything downstream
  // of here is priced off `minOut`, so re-validate before committing to it.
  await assertPlanFresh(pc, planAt, oracle.ethUsd);

  const gasLimit = await estimateWithBuffer(pc, account.address, ADDR.SWAP_ROUTER_02, data);
  const signed = await signCall({
    pc, wc, account, to: ADDR.SWAP_ROUTER_02, data, nonce, gasLimit,
  });

  const balBefore = await pc.readContract({
    address: tokenOut, abi: erc20Abi, functionName: 'balanceOf', args: [account.address],
  });

  const receipt = await broadcastAndConfirm({
    pc, submit, wc, account, signed, intentId: decision.intentId, step: 'swap',
    amountIn: decision.amountIn, minOut: minOut.toString(), notionalUsd,
  });

  // --- settle --------------------------------------------------------------
  const balAfter = await pc.readContract({
    address: tokenOut, abi: erc20Abi, functionName: 'balanceOf', args: [account.address],
    blockNumber: receipt.blockNumber,
  });
  const amountOut = balAfter - balBefore;

  // Realized slippage measured against the oracle, not against our own quote —
  // this is the number that feeds the circuit breaker, so it has to come from
  // a source an adversary does not control.
  const realizedPrice = toUsdc
    ? Number(formatUnits(amountOut, DECIMALS.USDC)) / Number(decision.amountIn)
    : Number(decision.amountIn) / Number(formatUnits(amountOut, DECIMALS.WETH));
  const slippageBps = Math.max(0,
    (toUsdc ? (oracle.ethUsd - realizedPrice) : (realizedPrice - oracle.ethUsd))
    / oracle.ethUsd * 10_000);

  journalWrite({
    kind: 'mined', ts: Date.now(), intentId: decision.intentId, hash: signed.hash, step: 'swap',
    status: receipt.status, block: receipt.blockNumber.toString(),
    gasUsedWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
    amountOut: amountOut.toString(), slippageBps: Math.round(slippageBps),
  });

  if (receipt.status !== 'success') throw new Reject('swap reverted on-chain');

  console.log(
    `[done] ${signed.hash} block ${receipt.blockNumber} | ` +
    `out ${formatUnits(amountOut, decOut)} | slippage ${slippageBps.toFixed(0)}bps | ` +
    `gas ${formatUnits(receipt.gasUsed * receipt.effectiveGasPrice, 18)} ETH`);
}

// ───────────────────────────────────────────────────────────────────────────
// 13. ENTRYPOINT
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  // Single-writer lock. Two concurrent runs share a nonce and produce one
  // trade plus one confusing failure — or two trades.
  if (existsSync(CONFIG.lockFilePath)) {
    console.error(`[lock] ${CONFIG.lockFilePath} held; another run is in flight`);
    process.exit(75); // EX_TEMPFAIL
  }
  appendFileSync(CONFIG.lockFilePath, String(process.pid));
  const release = () => { try { unlinkSync(CONFIG.lockFilePath); } catch {} };
  process.on('exit', release);
  process.on('SIGINT', () => { release(); process.exit(130); });
  process.on('SIGTERM', () => { release(); process.exit(143); });

  const [direction, amountIn] = process.argv.slice(2);
  if (direction !== 'WETH_TO_USDC' && direction !== 'USDC_TO_WETH') {
    console.error('usage: tsx rebalance.ts <WETH_TO_USDC|USDC_TO_WETH> <amountIn>');
    process.exit(2);
  }
  if (!amountIn) { console.error('missing amountIn'); process.exit(2); }

  try {
    await executeRebalance({
      direction, amountIn,
      intentId: `${direction}:${amountIn}:${Math.floor(Date.now() / 60_000)}`,
    });
  } catch (err) {
    if (err instanceof Halt) {
      // A Halt means the next cycle must not run until a human has looked.
      journalWrite({ kind: 'halt', ts: Date.now(), reason: err.message });
      appendFileSync(CONFIG.haltFilePath, `${new Date().toISOString()} ${err.message}\n`);
      console.error(`[HALT] ${err.message}`);
      process.exit(1); // page on this
    }
    if (err instanceof Reject) {
      journalWrite({ kind: 'rejected', ts: Date.now(),
        intentId: `${direction}:${amountIn}`, reason: err.message });
      console.error(`[reject] ${err.message}`);
      process.exit(0); // normal: skip this cycle, do not page
    }
    console.error('[error]', err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
