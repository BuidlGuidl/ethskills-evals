/**
 * USDC -> WETH on Base mainnet, split across the deepest concentrated-liquidity pools
 * (Uniswap v3 + Aerodrome Slipstream), with oracle + sequencer sanity checks.
 *
 * Dry run (default, sends nothing):
 *   RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 npx tsx swap.ts
 * Execute:
 *   EXECUTE=1 RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 npx tsx swap.ts
 *
 * See NOTES.md before running with real funds.
 */
import {
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

// ---------------------------------------------------------------------------
// Addresses (Base mainnet, chainId 8453) — all verified on-chain, see NOTES.md
// ---------------------------------------------------------------------------
const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // native Circle USDC (6 dp) — NOT USDbC
const WETH: Address = "0x4200000000000000000000000000000000000006"; // OP-stack WETH predeploy (18 dp)

const UNI_SWAP_ROUTER02: Address = "0x2626664c2603336E57B271c5C0b26F421741e481";
const UNI_QUOTER_V2: Address = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";

const AERO_CL_SWAP_ROUTER: Address = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5"; // Slipstream
const AERO_CL_QUOTER: Address = "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0";

const CHAINLINK_ETH_USD: Address = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
const CHAINLINK_SEQUENCER_UPTIME: Address = "0xBCF85224fc0756B9Fa45aA7892530B47e10b6433";

// Every USDC/WETH pool on both venues. Thin ones are included on purpose: the
// splitter will simply never allocate to them because their marginal output is ~0.
type Pool =
  | { venue: "uniswap-v3"; fee: number }
  | { venue: "aerodrome-cl"; tickSpacing: number };
const POOLS: Pool[] = [
  { venue: "uniswap-v3", fee: 100 },
  { venue: "uniswap-v3", fee: 500 },
  { venue: "uniswap-v3", fee: 3000 },
  { venue: "uniswap-v3", fee: 10000 },
  { venue: "aerodrome-cl", tickSpacing: 1 },
  { venue: "aerodrome-cl", tickSpacing: 50 },
  { venue: "aerodrome-cl", tickSpacing: 100 },
  { venue: "aerodrome-cl", tickSpacing: 200 },
  { venue: "aerodrome-cl", tickSpacing: 2000 },
];

// ---------------------------------------------------------------------------
// ABIs (only what we call)
// ---------------------------------------------------------------------------
const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const uniQuoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);
const aeroQuoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, int24 tickSpacing, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

// SwapRouter02: exactInputSingle has no deadline; deadline comes from multicall(uint256, bytes[]).
const uniRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);
// Slipstream router: v3-periphery style, deadline lives in the struct.
const aeroRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, int24 tickSpacing, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function multicall(bytes[] data) payable returns (bytes[] results)",
]);

const aggregatorAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`missing env ${name}`);
  return v;
}

const RPC_URL = env("RPC_URL");
const PRIVATE_KEY = env("PRIVATE_KEY") as Hex;
const AMOUNT_IN = parseUnits(env("AMOUNT_USDC"), 6);
const SLIPPAGE_BPS = BigInt(env("SLIPPAGE_BPS", "30")); // min-out tolerance vs fresh quote
const MAX_ORACLE_DEVIATION_BPS = Number(env("MAX_ORACLE_DEVIATION_BPS", "100")); // exec price vs Chainlink
const MAX_ORACLE_AGE_S = Number(env("MAX_ORACLE_AGE_S", "3600"));
const SEQUENCER_GRACE_S = Number(env("SEQUENCER_GRACE_S", "3600"));
const SLICES = BigInt(env("SLICES", "20")); // split granularity
const DEADLINE_S = BigInt(env("DEADLINE_S", "120"));
const EXECUTE = process.env.EXECUTE === "1";

const account = privateKeyToAccount(PRIVATE_KEY);
const RECIPIENT = (process.env.RECIPIENT as Address | undefined) ?? account.address;

const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL, { batch: true }) });
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

// ---------------------------------------------------------------------------
// Quoting
// ---------------------------------------------------------------------------
const label = (p: Pool) => (p.venue === "uniswap-v3" ? `uniswap-v3 fee=${p.fee}` : `aerodrome-cl ts=${p.tickSpacing}`);

/** Output for swapping `amountIn` USDC through a single pool. Returns 0 on revert (e.g. pool missing). */
async function quote(pool: Pool, amountIn: bigint): Promise<bigint> {
  if (amountIn === 0n) return 0n;
  try {
    if (pool.venue === "uniswap-v3") {
      const { result } = await publicClient.simulateContract({
        address: UNI_QUOTER_V2,
        abi: uniQuoterAbi,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee: pool.fee, sqrtPriceLimitX96: 0n }],
      });
      return result[0];
    }
    const { result } = await publicClient.simulateContract({
      address: AERO_CL_QUOTER,
      abi: aeroQuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing: pool.tickSpacing, sqrtPriceLimitX96: 0n }],
    });
    return result[0];
  } catch {
    return 0n;
  }
}

type Leg = { pool: Pool; amountIn: bigint; quotedOut: bigint };

/**
 * Greedy split: hand out the order in SLICES equal chunks, each to the pool whose
 * *marginal* output for the next chunk is highest. Output curves of CL pools are
 * concave, so this converges to (near-)optimal allocation across independent pools.
 */
async function planSplit(total: bigint): Promise<Leg[]> {
  const slice = total / SLICES;
  const alloc = POOLS.map(() => 0n);
  const outAt = POOLS.map(() => 0n);
  const nextOut = await Promise.all(POOLS.map((p) => quote(p, slice)));

  for (let s = 0n; s < SLICES; s++) {
    let best = -1;
    let bestGain = 0n;
    POOLS.forEach((_, i) => {
      const gain = nextOut[i] - outAt[i];
      if (gain > bestGain) [best, bestGain] = [i, gain];
    });
    if (best < 0) throw new Error("no pool can absorb the order");
    alloc[best] += slice;
    outAt[best] = nextOut[best];
    nextOut[best] = await quote(POOLS[best], alloc[best] + slice);
  }

  // Integer-division dust goes to the largest leg.
  const biggest = alloc.indexOf(alloc.reduce((a, b) => (b > a ? b : a)));
  alloc[biggest] += total - slice * SLICES;

  return POOLS.map((pool, i) => ({ pool, amountIn: alloc[i], quotedOut: 0n })).filter((l) => l.amountIn > 0n);
}

async function requote(legs: Leg[]): Promise<Leg[]> {
  const outs = await Promise.all(legs.map((l) => quote(l.pool, l.amountIn)));
  outs.forEach((o, i) => {
    if (o === 0n) throw new Error(`fresh quote failed for ${label(legs[i].pool)}`);
  });
  return legs.map((l, i) => ({ ...l, quotedOut: outs[i] }));
}

// ---------------------------------------------------------------------------
// Safety checks
// ---------------------------------------------------------------------------
/** Chainlink ETH/USD as a USDC-per-WETH float, after sequencer + staleness checks. */
async function oraclePrice(): Promise<number> {
  const now = Number((await publicClient.getBlock()).timestamp);

  const [, seqAnswer, seqStartedAt] = await publicClient.readContract({
    address: CHAINLINK_SEQUENCER_UPTIME,
    abi: aggregatorAbi,
    functionName: "latestRoundData",
  });
  if (seqAnswer !== 0n) throw new Error("Base sequencer reported DOWN — aborting");
  if (now - Number(seqStartedAt) < SEQUENCER_GRACE_S) throw new Error("sequencer recently restarted — aborting");

  const [decimals, [, answer, , updatedAt]] = await Promise.all([
    publicClient.readContract({ address: CHAINLINK_ETH_USD, abi: aggregatorAbi, functionName: "decimals" }),
    publicClient.readContract({ address: CHAINLINK_ETH_USD, abi: aggregatorAbi, functionName: "latestRoundData" }),
  ]);
  if (answer <= 0n) throw new Error("bad oracle answer");
  if (now - Number(updatedAt) > MAX_ORACLE_AGE_S) throw new Error(`oracle stale (${now - Number(updatedAt)}s)`);
  return Number(formatUnits(answer, decimals));
}

/** USDC paid per WETH received. */
const execPrice = (usdcIn: bigint, wethOut: bigint) => Number(formatUnits(usdcIn, 6)) / Number(formatUnits(wethOut, 18));

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
type Call = { router: Address; data: Hex; legs: Leg[] };

function buildCalls(legs: Leg[], deadline: bigint): Call[] {
  const minOut = (l: Leg) => (l.quotedOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;
  const calls: Call[] = [];

  const uniLegs = legs.filter((l) => l.pool.venue === "uniswap-v3");
  if (uniLegs.length) {
    const inner = uniLegs.map((l) =>
      encodeFunctionData({
        abi: uniRouterAbi,
        functionName: "exactInputSingle",
        args: [{
          tokenIn: USDC, tokenOut: WETH, fee: (l.pool as { fee: number }).fee, recipient: RECIPIENT,
          amountIn: l.amountIn, amountOutMinimum: minOut(l), sqrtPriceLimitX96: 0n,
        }],
      }),
    );
    calls.push({
      router: UNI_SWAP_ROUTER02,
      data: encodeFunctionData({ abi: uniRouterAbi, functionName: "multicall", args: [deadline, inner] }),
      legs: uniLegs,
    });
  }

  const aeroLegs = legs.filter((l) => l.pool.venue === "aerodrome-cl");
  if (aeroLegs.length) {
    const inner = aeroLegs.map((l) =>
      encodeFunctionData({
        abi: aeroRouterAbi,
        functionName: "exactInputSingle",
        args: [{
          tokenIn: USDC, tokenOut: WETH, tickSpacing: (l.pool as { tickSpacing: number }).tickSpacing,
          recipient: RECIPIENT, deadline, amountIn: l.amountIn, amountOutMinimum: minOut(l), sqrtPriceLimitX96: 0n,
        }],
      }),
    );
    calls.push({
      router: AERO_CL_SWAP_ROUTER,
      data: encodeFunctionData({ abi: aeroRouterAbi, functionName: "multicall", args: [inner] }),
      legs: aeroLegs,
    });
  }
  return calls;
}

/** Approve exactly what each router needs (no infinite approvals on a treasury wallet). */
async function ensureAllowances(calls: Call[]) {
  for (const c of calls) {
    const need = c.legs.reduce((s, l) => s + l.amountIn, 0n);
    const have = await publicClient.readContract({
      address: USDC, abi: erc20Abi, functionName: "allowance", args: [account.address, c.router],
    });
    if (have >= need) continue;
    console.log(`approve ${formatUnits(need, 6)} USDC -> ${c.router}`);
    const hash = await walletClient.writeContract({
      address: USDC, abi: erc20Abi, functionName: "approve", args: [c.router, need],
    });
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`approve failed: ${hash}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function printPlan(title: string, legs: Leg[], oracle: number) {
  const totalOut = legs.reduce((s, l) => s + l.quotedOut, 0n);
  console.log(`\n${title}`);
  for (const l of legs) {
    console.log(
      `  ${label(l.pool).padEnd(24)} in ${formatUnits(l.amountIn, 6).padStart(14)} USDC` +
        `  out ${formatUnits(l.quotedOut, 18).padStart(24)} WETH  @ ${execPrice(l.amountIn, l.quotedOut).toFixed(2)}`,
    );
  }
  const px = execPrice(AMOUNT_IN, totalOut);
  const devBps = (px / oracle - 1) * 10_000;
  console.log(`  total out ${formatUnits(totalOut, 18)} WETH, avg ${px.toFixed(2)} USDC/WETH, oracle ${oracle.toFixed(2)}, deviation ${devBps.toFixed(1)} bps`);
  return devBps;
}

async function main() {
  const chainId = await publicClient.getChainId();
  if (chainId !== base.id) throw new Error(`wrong chain ${chainId}, expected Base (${base.id})`);
  if (SLIPPAGE_BPS <= 0n || SLIPPAGE_BPS > 500n) throw new Error("SLIPPAGE_BPS must be in (0, 500]");

  const balance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
  console.log(`account ${account.address}  USDC balance ${formatUnits(balance, 6)}  swapping ${formatUnits(AMOUNT_IN, 6)}`);
  if (balance < AMOUNT_IN) throw new Error("insufficient USDC");

  // 1. Plan the split and sanity-check it against Chainlink.
  let legs = await requote(await planSplit(AMOUNT_IN));
  let oracle = await oraclePrice();
  const planDev = printPlan("plan:", legs, oracle);
  if (planDev > MAX_ORACLE_DEVIATION_BPS) {
    throw new Error(`price ${planDev.toFixed(1)} bps worse than oracle (max ${MAX_ORACLE_DEVIATION_BPS}) — reduce size / split over time`);
  }
  if (!EXECUTE) {
    console.log("\ndry run — set EXECUTE=1 to send");
    return;
  }

  // 2. Approvals (may take a few blocks), then re-quote so min-outs are fresh.
  await ensureAllowances(buildCalls(legs, 0n));
  legs = await requote(legs);
  oracle = await oraclePrice();
  const dev = printPlan("fresh quote:", legs, oracle);
  if (dev > MAX_ORACLE_DEVIATION_BPS) throw new Error(`fresh price ${dev.toFixed(1)} bps worse than oracle — aborting`);

  const now = (await publicClient.getBlock()).timestamp;
  const calls = buildCalls(legs, now + DEADLINE_S);

  // 3. Simulate (estimateGas reverts on failure) every router call before sending any of them.
  const gas: bigint[] = [];
  for (const c of calls) {
    gas.push(((await publicClient.estimateGas({ account, to: c.router, data: c.data })) * 12n) / 10n);
  }

  // 4. Send back-to-back with explicit nonces so they land as close together as possible.
  const wethBefore = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [RECIPIENT] });
  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
  const hashes: Hex[] = [];
  for (const [i, c] of calls.entries()) {
    hashes.push(await walletClient.sendTransaction({ to: c.router, data: c.data, gas: gas[i], nonce: nonce++ }));
    console.log(`sent ${c.router} ${hashes[i]}`);
  }
  const receipts = await Promise.all(hashes.map((hash) => publicClient.waitForTransactionReceipt({ hash })));
  receipts.forEach((r, i) => console.log(`  ${r.status.padEnd(8)} block ${r.blockNumber} ${hashes[i]}`));

  // 5. Report what actually happened (a reverted leg leaves its USDC untouched).
  const wethAfter = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [RECIPIENT] });
  const filledIn = calls
    .filter((_, i) => receipts[i].status === "success")
    .flatMap((c) => c.legs)
    .reduce((s, l) => s + l.amountIn, 0n);
  const got = wethAfter - wethBefore;
  console.log(`\nfilled ${formatUnits(filledIn, 6)} / ${formatUnits(AMOUNT_IN, 6)} USDC -> ${formatUnits(got, 18)} WETH` +
    (got > 0n ? ` @ ${execPrice(filledIn, got).toFixed(2)}` : ""));
  if (receipts.some((r) => r.status !== "success")) {
    console.error("WARNING: partial fill — at least one router call reverted (slippage/deadline). Re-run for the remainder.");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
