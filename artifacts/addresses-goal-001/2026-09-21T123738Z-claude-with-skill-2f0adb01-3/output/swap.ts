/**
 * USDC -> WETH on Base mainnet, split across the deepest on-chain pools.
 *
 * Flow:
 *   1. Safety checks: chain id, Chainlink sequencer-uptime feed, ETH/USD staleness.
 *   2. Quote every venue on-chain (Uniswap V3 QuoterV2, Aerodrome Slipstream QuoterV2).
 *   3. Greedy split: hand the order out in SLICES chunks, each to the venue with the best
 *      marginal output. Deep pools absorb more, so price impact is spread out.
 *   4. Abort if blended price is worse than Chainlink ETH/USD by > MAX_ORACLE_DEVIATION_BPS.
 *   5. Dry run by default. With EXECUTE=1: approve exact amounts, then one swap tx per leg,
 *      each re-quoted right before sending and protected by amountOutMinimum + deadline.
 *
 * Env:
 *   RPC_URL                    Base mainnet RPC (use a private/paid endpoint)
 *   PRIVATE_KEY                0x... key of the funded account (only needed with EXECUTE=1)
 *   AMOUNT_USDC                human units, e.g. "250000"
 *   SLIPPAGE_BPS               per-leg tolerance vs fresh quote (default 30 = 0.30%)
 *   MAX_ORACLE_DEVIATION_BPS   max blended shortfall vs Chainlink (default 75 = 0.75%)
 *   SLICES                     split granularity (default 20)
 *   RECIPIENT                  WETH receiver (default: sender)
 *   EXECUTE                    "1" to send transactions; anything else = dry run
 *
 * Run: npx tsx swap.ts
 */
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ── Addresses (Base mainnet, chain id 8453) — all checked on-chain via eth_getCode + calls ──
const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // native Circle USDC (NOT USDbC)
const WETH: Address = "0x4200000000000000000000000000000000000006";

const UNI_V3_ROUTER: Address = "0x2626664c2603336E57B271c5C0b26F421741e481"; // SwapRouter02
const UNI_V3_QUOTER: Address = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"; // QuoterV2
const UNI_V3_FACTORY: Address = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";

const AERO_CL_ROUTER: Address = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5"; // Slipstream SwapRouter
const AERO_CL_QUOTER: Address = "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0"; // Slipstream QuoterV2
const AERO_CL_FACTORY: Address = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";

const CL_ETH_USD: Address = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"; // Chainlink ETH/USD, 8 dec
const CL_SEQUENCER_UPTIME: Address = "0xBCF85224fc0756B9Fa45aA7892530B47e10b6433"; // 0 = up

// ── Venues: WETH/USDC pools with real depth on Base ──
type Venue =
  | { name: string; kind: "uni"; fee: number }
  | { name: string; kind: "aero"; tickSpacing: number };

const VENUES: Venue[] = [
  { name: "UniV3 0.05%", kind: "uni", fee: 500 },
  { name: "UniV3 0.30%", kind: "uni", fee: 3000 },
  { name: "UniV3 0.01%", kind: "uni", fee: 100 },
  { name: "Aero CL-100", kind: "aero", tickSpacing: 100 },
  { name: "Aero CL-1", kind: "aero", tickSpacing: 1 },
];

// ── ABIs (only what we call) ──
const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const feedAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);
const uniFactoryAbi = parseAbi(["function getPool(address,address,uint24) view returns (address)"]);
const aeroFactoryAbi = parseAbi(["function getPool(address,address,int24) view returns (address)"]);
const uniQuoterAbi = parseAbi([
  "struct P { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(P params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);
const aeroQuoterAbi = parseAbi([
  "struct P { address tokenIn; address tokenOut; uint256 amountIn; int24 tickSpacing; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(P params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);
const uniRouterAbi = parseAbi([
  "struct P { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(P params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[])",
]);
const aeroRouterAbi = parseAbi([
  "struct P { address tokenIn; address tokenOut; int24 tickSpacing; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(P params) payable returns (uint256 amountOut)",
]);

// ── Config ──
const env = (k: string, d?: string) => {
  const v = process.env[k] ?? d;
  if (v === undefined) throw new Error(`missing env ${k}`);
  return v;
};
const RPC_URL = env("RPC_URL");
const AMOUNT_IN = parseUnits(env("AMOUNT_USDC"), 6);
const SLIPPAGE_BPS = BigInt(env("SLIPPAGE_BPS", "30"));
const MAX_ORACLE_DEV_BPS = BigInt(env("MAX_ORACLE_DEVIATION_BPS", "75"));
const SLICES = BigInt(env("SLICES", "20"));
const EXECUTE = process.env.EXECUTE === "1";
const DEADLINE_SECS = 120n;
const MAX_ORACLE_AGE_SECS = 3600n;
const SEQUENCER_GRACE_SECS = 3600n;

if (AMOUNT_IN <= 0n) throw new Error("AMOUNT_USDC must be > 0");
if (SLIPPAGE_BPS > 200n) throw new Error("SLIPPAGE_BPS > 2% refused — check your config");
if (SLICES < 1n) throw new Error("SLICES must be >= 1");

const pub = createPublicClient({ chain: base, transport: http(RPC_URL, { retryCount: 5, retryDelay: 500 }) });

const bps = (x: bigint, b: bigint) => (x * (10_000n - b)) / 10_000n;
const fmtW = (x: bigint) => formatUnits(x, 18);
const fmtU = (x: bigint) => formatUnits(x, 6);

// ── Quoting ──
async function quote(v: Venue, amountIn: bigint): Promise<bigint> {
  if (amountIn === 0n) return 0n;
  try {
    if (v.kind === "uni") {
      const { result } = await pub.simulateContract({
        address: UNI_V3_QUOTER,
        abi: uniQuoterAbi,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee: v.fee, sqrtPriceLimitX96: 0n }],
      });
      return result[0];
    }
    const { result } = await pub.simulateContract({
      address: AERO_CL_QUOTER,
      abi: aeroQuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing: v.tickSpacing, sqrtPriceLimitX96: 0n }],
    });
    return result[0];
  } catch (e) {
    // Quoter revert = pool can't fill this size -> venue gets nothing.
    // Anything else (RPC down, rate limit) must abort, not silently skew routing.
    if (e instanceof BaseError && e.walk((x) => x instanceof ContractFunctionRevertedError)) return 0n;
    throw e;
  }
}

async function poolExists(v: Venue): Promise<boolean> {
  const pool =
    v.kind === "uni"
      ? await pub.readContract({ address: UNI_V3_FACTORY, abi: uniFactoryAbi, functionName: "getPool", args: [USDC, WETH, v.fee] })
      : await pub.readContract({ address: AERO_CL_FACTORY, abi: aeroFactoryAbi, functionName: "getPool", args: [USDC, WETH, v.tickSpacing] });
  return pool !== "0x0000000000000000000000000000000000000000";
}

/** Greedy split: each slice goes to the venue with the best marginal WETH out. */
async function planSplit(venues: Venue[], total: bigint) {
  const slice = total / SLICES;
  const alloc = venues.map(() => 0n);
  const out = venues.map(() => 0n);
  // candidate output if venue i received its next slice
  const next = await Promise.all(venues.map((v) => quote(v, slice)));

  for (let s = 0n; s < SLICES; s++) {
    const size = s === SLICES - 1n ? total - slice * (SLICES - 1n) : slice; // last slice takes dust
    let best = -1;
    let bestGain = 0n;
    for (let i = 0; i < venues.length; i++) {
      const gain = next[i] - out[i];
      if (gain > bestGain) [best, bestGain] = [i, gain];
    }
    if (best < 0) throw new Error("no venue can fill the next slice — order too large for on-chain liquidity");
    alloc[best] += size;
    out[best] = size === slice ? next[best] : await quote(venues[best], alloc[best]);
    next[best] = await quote(venues[best], alloc[best] + slice);
  }
  // re-quote final sizes exactly (last-slice remainder may differ from `slice`)
  const finalOut = await Promise.all(venues.map((v, i) => quote(v, alloc[i])));
  return venues
    .map((v, i) => ({ venue: v, amountIn: alloc[i], quotedOut: finalOut[i] }))
    .filter((l) => l.amountIn > 0n);
}

// ── Oracle / sequencer checks ──
async function safetyChecks() {
  const chainId = await pub.getChainId();
  if (chainId !== base.id) throw new Error(`wrong chain ${chainId}, expected Base ${base.id}`);

  const now = (await pub.getBlock()).timestamp;
  const [, seqAnswer, seqStartedAt] = await pub.readContract({ address: CL_SEQUENCER_UPTIME, abi: feedAbi, functionName: "latestRoundData" });
  if (seqAnswer !== 0n) throw new Error("Base sequencer reported DOWN by Chainlink uptime feed");
  if (now - seqStartedAt < SEQUENCER_GRACE_SECS) throw new Error("sequencer recently restarted — wait out grace period");

  const [, answer, , updatedAt] = await pub.readContract({ address: CL_ETH_USD, abi: feedAbi, functionName: "latestRoundData" });
  if (answer <= 0n) throw new Error("bad ETH/USD answer");
  if (now - updatedAt > MAX_ORACLE_AGE_SECS) throw new Error(`ETH/USD stale (${now - updatedAt}s old)`);
  return answer; // 8 decimals
}

/** WETH (18 dec) that `usdc` (6 dec) buys at oracle price, assuming USDC = $1. */
const oracleOut = (usdc: bigint, ethUsd8: bigint) => (usdc * 10n ** 20n) / ethUsd8;

// ── Execution ──
async function main() {
  const ethUsd = await safetyChecks();
  const live: Venue[] = [];
  for (const v of VENUES) if (await poolExists(v)) live.push(v);

  const legs = await planSplit(live, AMOUNT_IN);
  const totalOut = legs.reduce((a, l) => a + l.quotedOut, 0n);
  const fair = oracleOut(AMOUNT_IN, ethUsd);
  const shortfallBps = fair > totalOut ? ((fair - totalOut) * 10_000n) / fair : 0n;

  console.log(`ETH/USD (Chainlink): ${formatUnits(ethUsd, 8)}`);
  console.log(`Selling ${fmtU(AMOUNT_IN)} USDC; oracle-fair ${fmtW(fair)} WETH`);
  for (const l of legs)
    console.log(`  ${l.venue.name.padEnd(12)} ${fmtU(l.amountIn).padStart(14)} USDC -> ${fmtW(l.quotedOut)} WETH`);
  console.log(`Total quoted ${fmtW(totalOut)} WETH, ${shortfallBps} bps below oracle (limit ${MAX_ORACLE_DEV_BPS})`);

  if (shortfallBps > MAX_ORACLE_DEV_BPS)
    throw new Error("blended price too far below oracle — reduce size, wait, or use an RFQ/OTC desk");

  if (!EXECUTE) {
    console.log("Dry run. Set EXECUTE=1 to send transactions.");
    return;
  }

  const account = privateKeyToAccount(env("PRIVATE_KEY") as Hex);
  const wallet = createWalletClient({ account, chain: base, transport: http(RPC_URL, { retryCount: 5, retryDelay: 500 }) });
  const recipient = (process.env.RECIPIENT ?? account.address) as Address;

  const bal = await pub.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
  if (bal < AMOUNT_IN) throw new Error(`insufficient USDC: have ${fmtU(bal)}, need ${fmtU(AMOUNT_IN)}`);

  // Exact approvals per router — never unlimited.
  const needs = new Map<Address, bigint>();
  for (const l of legs) {
    const r = l.venue.kind === "uni" ? UNI_V3_ROUTER : AERO_CL_ROUTER;
    needs.set(r, (needs.get(r) ?? 0n) + l.amountIn);
  }
  for (const [router, amt] of needs) {
    const cur = await pub.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [account.address, router] });
    if (cur >= amt) continue;
    const { request } = await pub.simulateContract({ account, address: USDC, abi: erc20Abi, functionName: "approve", args: [router, amt] });
    const hash = await wallet.writeContract(request);
    const rc = await pub.waitForTransactionReceipt({ hash });
    if (rc.status !== "success") throw new Error(`approve failed ${hash}`);
    console.log(`approved ${fmtU(amt)} USDC to ${router}: ${hash}`);
  }

  const wethBefore = await pub.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [recipient] });

  for (const l of legs) {
    // Fresh quote right before sending; floor by both quote-slippage and the oracle bound.
    const fresh = await quote(l.venue, l.amountIn);
    const minOut = [bps(fresh, SLIPPAGE_BPS), bps(oracleOut(l.amountIn, ethUsd), MAX_ORACLE_DEV_BPS)].reduce((a, b) => (a > b ? a : b));
    const deadline = (await pub.getBlock()).timestamp + DEADLINE_SECS;

    let hash: Hex;
    if (l.venue.kind === "uni") {
      const call = encodeFunctionData({
        abi: uniRouterAbi,
        functionName: "exactInputSingle",
        args: [{ tokenIn: USDC, tokenOut: WETH, fee: l.venue.fee, recipient, amountIn: l.amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
      });
      // SwapRouter02's exactInputSingle has no deadline; multicall(deadline, ...) enforces one.
      const { request } = await pub.simulateContract({ account, address: UNI_V3_ROUTER, abi: uniRouterAbi, functionName: "multicall", args: [deadline, [call]] });
      hash = await wallet.writeContract(request);
    } else {
      const { request } = await pub.simulateContract({
        account,
        address: AERO_CL_ROUTER,
        abi: aeroRouterAbi,
        functionName: "exactInputSingle",
        args: [{ tokenIn: USDC, tokenOut: WETH, tickSpacing: l.venue.tickSpacing, recipient, deadline, amountIn: l.amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
      });
      hash = await wallet.writeContract(request);
    }
    const rc = await pub.waitForTransactionReceipt({ hash });
    if (rc.status !== "success") throw new Error(`${l.venue.name} swap reverted: ${hash}`);
    console.log(`${l.venue.name}: ${fmtU(l.amountIn)} USDC, minOut ${fmtW(minOut)} WETH, tx ${hash}`);
  }

  const wethAfter = await pub.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [recipient] });
  const got = wethAfter - wethBefore;
  console.log(`Received ${fmtW(got)} WETH (quoted ${fmtW(totalOut)}); avg price ${(Number(fmtU(AMOUNT_IN)) / Number(fmtW(got))).toFixed(2)} USDC/WETH`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
