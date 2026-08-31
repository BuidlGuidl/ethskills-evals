/**
 * swap.ts — USDC -> WETH on Base mainnet (chain id 8453) with viem.
 *
 * Built for treasury-sized clips (10^5 USDC and up), so the script is a small
 * execution engine rather than a one-shot router call:
 *
 *   1. discovers every Uniswap v3 and Aerodrome Slipstream USDC/WETH pool from
 *      the on-chain factories (no hardcoded pool addresses),
 *   2. quotes each pool with its official quoter,
 *   3. splits the order across pools with a greedy marginal-price allocator,
 *   4. sanity-checks the resulting price against the Chainlink ETH/USD feed and
 *      against a small "probe" quote (price-impact guard),
 *   5. only then approves and executes, leg by leg, with a fresh quote, an
 *      amountOutMinimum and a deadline on every leg.
 *
 * Dry run (no key needed):
 *   RPC_URL=https://mainnet.base.org AMOUNT_USDC=250000 npx tsx swap.ts
 * Live:
 *   RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 npx tsx swap.ts --execute
 *
 * Read NOTES.md before running this with real funds.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  decodeFunctionResult,
  formatUnits,
  parseUnits,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

/* ------------------------------------------------------------------ *
 * Base mainnet addresses. Every one of these is checked on-chain by
 * verifyAddresses() before a single dollar moves — see NOTES.md.
 * ------------------------------------------------------------------ */
const USDC: Address = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"); // native Circle USDC, 6 dec
const WETH: Address = getAddress("0x4200000000000000000000000000000000000006"); // canonical OP-stack WETH9

// Uniswap v3
const UNI_V3_FACTORY: Address = getAddress("0x33128a8fC17869897dcE68Ed026d694621f6FDfD");
const UNI_SWAP_ROUTER_02: Address = getAddress("0x2626664c2603336E57B271c5C0b26F421741e481");
const UNI_QUOTER_V2: Address = getAddress("0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a");
const UNI_FEE_TIERS = [100, 500, 3000, 10000] as const;

// Aerodrome Slipstream (Aerodrome's concentrated-liquidity AMM)
const AERO_CL_FACTORY: Address = getAddress("0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A");
const AERO_CL_ROUTER: Address = getAddress("0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5");
const AERO_CL_QUOTER: Address = getAddress("0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0");
const AERO_TICK_SPACINGS = [1, 50, 100, 200, 2000] as const;

// Chainlink ETH/USD on Base (8 decimals) — used only as an independent price check.
const CHAINLINK_ETH_USD: Address = getAddress("0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70");

/* ------------------------------------------------------------------ *
 * Minimal ABIs
 * ------------------------------------------------------------------ */
const erc20Abi = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

const uniFactoryAbi = [
  { name: "getPool", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }], outputs: [{ type: "address" }] },
] as const;

const aeroFactoryAbi = [
  { name: "getPool", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "int24" }], outputs: [{ type: "address" }] },
] as const;

const poolAbi = [
  { name: "liquidity", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
] as const;

// QuoterV2 (Uniswap): non-view; must be eth_call'd / simulated, never sent as a tx.
const uniQuoterAbi = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
  { name: "factory", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

// Slipstream quoter: same shape but keyed by tickSpacing instead of fee.
const aeroQuoterAbi = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "tickSpacing", type: "int24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
  { name: "factory", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

// Uniswap SwapRouter02: ExactInputSingleParams has NO deadline field (that is what
// the payable multicall(deadline, data[]) wrapper is for).
const uniRouterAbi = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "multicall",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "deadline", type: "uint256" },
      { name: "data", type: "bytes[]" },
    ],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  { name: "factory", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "WETH9", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

// Slipstream SwapRouter: Uniswap v3 SwapRouter (v1) shape, so deadline is in the struct.
const aeroRouterAbi = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "tickSpacing", type: "int24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  { name: "factory", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "WETH9", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const chainlinkAbi = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "description", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const arg = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const num = (v: string | undefined, fallback: number) => (v === undefined ? fallback : Number(v));

const CFG = {
  rpcUrl: process.env.RPC_URL ?? "https://mainnet.base.org",
  privateKey: process.env.PRIVATE_KEY as Hex | undefined,
  amountUsdc: arg("amount") ?? process.env.AMOUNT_USDC ?? "1000",
  execute: flag("execute") || process.env.EXECUTE === "true",
  recipient: (process.env.RECIPIENT ?? "") as Address | "",
  /** Per-leg slippage tolerance against the quote taken immediately before sending. */
  slippageBps: num(process.env.SLIPPAGE_BPS, 30),
  /** Abort if the routed price is worse than the small-probe price by more than this. */
  maxPriceImpactBps: num(process.env.MAX_PRICE_IMPACT_BPS, 100),
  /** Abort if the routed price disagrees with Chainlink ETH/USD by more than this. */
  maxOracleDeviationBps: num(process.env.MAX_ORACLE_DEVIATION_BPS, 200),
  /** Abort if the Chainlink round is older than this (feed heartbeat is 20 min). */
  maxOracleAgeSec: num(process.env.MAX_ORACLE_AGE_SEC, 3600),
  /** Granularity of the split allocator. */
  slices: num(process.env.SPLIT_SLICES, 10),
  /** Only split when it beats the best single pool by at least this much. */
  minSplitGainBps: num(process.env.MIN_SPLIT_GAIN_BPS, 2),
  /** Drop pools priced worse than this vs the best pool at one slice of size. */
  shortlistToleranceBps: num(process.env.SHORTLIST_TOLERANCE_BPS, 500),
  /** Hard cap on how many pools the allocator considers (each costs quotes). */
  maxVenues: num(process.env.MAX_VENUES, 5),
  /** Abort a leg if the market moved this much against us between plan and send. */
  maxRequoteDriftBps: num(process.env.MAX_REQUOTE_DRIFT_BPS, 50),
  deadlineSec: num(process.env.DEADLINE_SEC, 180),
  /** Optional venue whitelist, e.g. "aero-100,uni-500" — restricts routing to these pools. */
  onlyVenues: (process.env.ONLY_VENUES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  /** Approve exactly what each leg needs (true) or the full order once per router (false). */
  exactApprovals: process.env.EXACT_APPROVALS !== "false",
} as const;

const BPS = 10_000n;
const WAD = 10n ** 18n;

type Venue = {
  key: string;
  dex: "uniswap-v3" | "aerodrome-slipstream";
  pool: Address;
  /** fee tier (uniswap) or tick spacing (slipstream) */
  param: number;
};

/* ------------------------------------------------------------------ *
 * Clients
 * ------------------------------------------------------------------ */
const publicClient = createPublicClient({ chain: base, transport: http(CFG.rpcUrl, { timeout: 60_000 }) });
const account = CFG.privateKey ? privateKeyToAccount(CFG.privateKey) : undefined;
const walletClient = account
  ? createWalletClient({ account, chain: base, transport: http(CFG.rpcUrl, { timeout: 60_000 }) })
  : undefined;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
/** USDC (6dec) per ETH, scaled by 1e6. */
const priceE6 = (amountInUsdc: bigint, amountOutWeth: bigint) =>
  amountOutWeth === 0n ? 0n : (amountInUsdc * WAD) / amountOutWeth;
const fmtPrice = (p: bigint) => `${formatUnits(p, 6)} USDC/ETH`;
const bpsDiff = (a: bigint, b: bigint) => (b === 0n ? 0n : ((a - b) * BPS) / b);
const bigMin = (a: bigint, b: bigint) => (a < b ? a : b);
const bigMax = (a: bigint, b: bigint) => (a > b ? a : b);

async function quoteUniswap(amountIn: bigint, fee: number): Promise<bigint> {
  const { result } = await publicClient.simulateContract({
    address: UNI_QUOTER_V2,
    abi: uniQuoterAbi,
    functionName: "quoteExactInputSingle",
    args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee, sqrtPriceLimitX96: 0n }],
  });
  return result[0];
}

async function quoteAerodrome(amountIn: bigint, tickSpacing: number): Promise<bigint> {
  const { result } = await publicClient.simulateContract({
    address: AERO_CL_QUOTER,
    abi: aeroQuoterAbi,
    functionName: "quoteExactInputSingle",
    args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing, sqrtPriceLimitX96: 0n }],
  });
  return result[0];
}

/** Base produces a block every ~2s; be generous so a slow RPC never orphans a sent tx. */
const waitForReceipt = (hash: Hex) =>
  publicClient.waitForTransactionReceipt({ hash, pollingInterval: 2_000, timeout: 300_000, retryCount: 10 });

const quoteCache = new Map<string, bigint>();
async function quote(venue: Venue, amountIn: bigint): Promise<bigint> {
  if (amountIn === 0n) return 0n;
  const cacheKey = `${venue.key}:${amountIn}`;
  const hit = quoteCache.get(cacheKey);
  if (hit !== undefined) return hit;
  let out = 0n;
  try {
    out =
      venue.dex === "uniswap-v3"
        ? await quoteUniswap(amountIn, venue.param)
        : await quoteAerodrome(amountIn, venue.param);
  } catch {
    out = 0n; // unquotable pool (no liquidity in range, etc.) — treated as unusable
  }
  quoteCache.set(cacheKey, out);
  return out;
}

/**
 * Refuses to run against anything that is not the Base mainnet deployment we
 * think it is: chain id, token metadata, and every router/quoter cross-checked
 * against the factory it claims to belong to.
 */
async function verifyAddresses() {
  const chainId = await publicClient.getChainId();
  if (chainId !== 8453) throw new Error(`RPC is chain ${chainId}, expected Base mainnet (8453)`);

  const [usdcSymbol, usdcDecimals, wethSymbol, uniRouterFactory, uniRouterWeth, uniQuoterFactory, aeroRouterFactory, aeroQuoterFactory, feedDescription] =
    await Promise.all([
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" }),
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
      publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "symbol" }),
      publicClient.readContract({ address: UNI_SWAP_ROUTER_02, abi: uniRouterAbi, functionName: "factory" }),
      publicClient.readContract({ address: UNI_SWAP_ROUTER_02, abi: uniRouterAbi, functionName: "WETH9" }),
      publicClient.readContract({ address: UNI_QUOTER_V2, abi: uniQuoterAbi, functionName: "factory" }),
      publicClient.readContract({ address: AERO_CL_ROUTER, abi: aeroRouterAbi, functionName: "factory" }),
      publicClient.readContract({ address: AERO_CL_QUOTER, abi: aeroQuoterAbi, functionName: "factory" }),
      publicClient.readContract({ address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "description" }),
    ]);

  const checks: [string, boolean][] = [
    [`USDC symbol is ${usdcSymbol}`, usdcSymbol === "USDC"],
    [`USDC has ${usdcDecimals} decimals`, usdcDecimals === 6],
    [`WETH symbol is ${wethSymbol}`, wethSymbol === "WETH"],
    ["SwapRouter02.factory() == Uniswap v3 factory", getAddress(uniRouterFactory) === UNI_V3_FACTORY],
    ["SwapRouter02.WETH9() == WETH", getAddress(uniRouterWeth) === WETH],
    ["QuoterV2.factory() == Uniswap v3 factory", getAddress(uniQuoterFactory) === UNI_V3_FACTORY],
    ["Slipstream router.factory() == CL factory", getAddress(aeroRouterFactory) === AERO_CL_FACTORY],
    ["Slipstream quoter.factory() == CL factory", getAddress(aeroQuoterFactory) === AERO_CL_FACTORY],
    ["Chainlink feed is ETH / USD", feedDescription === "ETH / USD"],
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([label]) => label);
  if (failed.length) throw new Error(`address verification failed:\n  - ${failed.join("\n  - ")}`);
  console.log(`✓ address checks passed (${checks.length}) on Base mainnet`);
}

async function discoverVenues(): Promise<Venue[]> {
  const uniPools = await Promise.all(
    UNI_FEE_TIERS.map((fee) =>
      publicClient.readContract({ address: UNI_V3_FACTORY, abi: uniFactoryAbi, functionName: "getPool", args: [USDC, WETH, fee] }),
    ),
  );
  const aeroPools = await Promise.all(
    AERO_TICK_SPACINGS.map((ts) =>
      publicClient.readContract({ address: AERO_CL_FACTORY, abi: aeroFactoryAbi, functionName: "getPool", args: [USDC, WETH, ts] }),
    ),
  );

  const candidates: Venue[] = [
    ...UNI_FEE_TIERS.map((fee, i) => ({ key: `uni-${fee}`, dex: "uniswap-v3" as const, pool: uniPools[i], param: fee })),
    ...AERO_TICK_SPACINGS.map((ts, i) => ({ key: `aero-${ts}`, dex: "aerodrome-slipstream" as const, pool: aeroPools[i], param: ts })),
  ].filter((v) => v.pool !== "0x0000000000000000000000000000000000000000");

  const live = await Promise.all(
    candidates.map(async (v) => {
      const liquidity = await publicClient.readContract({ address: v.pool, abi: poolAbi, functionName: "liquidity" });
      return liquidity > 0n ? v : undefined;
    }),
  );
  const withLiquidity = live.filter((v): v is Venue => v !== undefined);
  return CFG.onlyVenues.length ? withLiquidity.filter((v) => CFG.onlyVenues.includes(v.key)) : withLiquidity;
}

/**
 * Greedy marginal allocator. Because each pool's output is concave in its input,
 * handing each slice to whichever pool currently offers the best marginal price
 * converges on the optimal split for that slice size.
 */
async function planSplit(venues: Venue[], amountIn: bigint) {
  const slices = BigInt(Math.max(1, CFG.slices));
  const slice = amountIn / slices;
  const alloc = new Map<string, bigint>(venues.map((v) => [v.key, 0n]));
  const outAt = new Map<string, bigint>(venues.map((v) => [v.key, 0n]));

  let allocated = 0n;
  for (let i = 0n; i < slices; i++) {
    // last slice absorbs the integer-division remainder
    const step = i === slices - 1n ? amountIn - allocated : slice;
    let best: { venue: Venue; out: bigint; gain: bigint } | undefined;
    for (const v of venues) {
      const nextAmount = alloc.get(v.key)! + step;
      const out = await quote(v, nextAmount);
      if (out === 0n) continue;
      const gain = out - outAt.get(v.key)!;
      if (!best || gain > best.gain) best = { venue: v, out, gain };
    }
    if (!best) throw new Error("no venue could quote the next slice");
    alloc.set(best.venue.key, alloc.get(best.venue.key)! + step);
    outAt.set(best.venue.key, best.out);
    allocated += step;
  }

  const legs = venues
    .map((v) => ({ venue: v, amountIn: alloc.get(v.key)!, quotedOut: outAt.get(v.key)! }))
    .filter((l) => l.amountIn > 0n)
    .sort((a, b) => (b.amountIn > a.amountIn ? 1 : -1));
  const totalOut = legs.reduce((acc, l) => acc + l.quotedOut, 0n);
  return { legs, totalOut };
}

async function main() {
  console.log(`RPC: ${CFG.rpcUrl}`);
  await verifyAddresses();

  const amountIn = parseUnits(CFG.amountUsdc, 6);
  if (amountIn <= 0n) throw new Error("AMOUNT_USDC must be > 0");
  const recipient = (CFG.recipient || account?.address) as Address | undefined;
  console.log(`Order: ${formatUnits(amountIn, 6)} USDC -> WETH${recipient ? ` for ${recipient}` : ""}`);

  /* --- venues & quotes ------------------------------------------- */
  const venues = await discoverVenues();
  if (!venues.length) throw new Error("no USDC/WETH pool with liquidity matched the configuration");
  const slice = amountIn / BigInt(Math.max(1, CFG.slices));

  // Price every live pool at one slice first: that is the granularity the
  // allocator works at, and it is far cheaper than quoting thin pools full size.
  const sliceQuotes = await Promise.all(venues.map(async (v) => ({ v, out: await quote(v, slice) })));
  const bestSlice = sliceQuotes.reduce((a, b) => (b.out > a.out ? b : a));
  if (bestSlice.out === 0n) throw new Error("no pool could quote this order");
  const bestSlicePrice = priceE6(slice, bestSlice.out);

  // Anything more than SHORTLIST_TOLERANCE_BPS worse at slice size cannot win a
  // slice from a deeper pool, so drop it instead of re-quoting it ten times.
  const shortlist = sliceQuotes
    .filter(({ out }) => out > 0n && bpsDiff(priceE6(slice, out), bestSlicePrice) <= BigInt(CFG.shortlistToleranceBps))
    .sort((a, b) => (b.out > a.out ? 1 : -1))
    .slice(0, CFG.maxVenues)
    .map(({ v }) => v);
  const dropped = venues.filter((v) => !shortlist.some((s) => s.key === v.key));

  console.log(`\nCandidate pools: ${venues.length} live, ${shortlist.length} shortlisted (dropped ${dropped.map((v) => v.key).join(", ") || "none"})`);
  const fullQuotes = await Promise.all(shortlist.map(async (v) => ({ v, out: await quote(v, amountIn) })));
  for (const { v, out } of fullQuotes) {
    console.log(
      `  ${v.key.padEnd(10)} ${v.pool}  full-size ${out === 0n ? "n/a" : `${formatUnits(out, 18)} WETH @ ${fmtPrice(priceE6(amountIn, out))}`}`,
    );
  }
  const bestSingle = fullQuotes.reduce((a, b) => (b.out > a.out ? b : a));
  if (bestSingle.out === 0n) throw new Error("no shortlisted pool could quote the full size");

  /* --- reference price (small probe) ------------------------------ */
  const probeIn = bigMin(bigMax(amountIn / 1000n, 1_000_000n), 1_000_000_000n);
  const probeOut = await quote(bestSlice.v, probeIn);
  if (probeOut === 0n) throw new Error("probe quote failed; refusing to trade without a reference price");
  const probePrice = priceE6(probeIn, probeOut);
  console.log(`\nReference (probe ${formatUnits(probeIn, 6)} USDC on ${bestSlice.v.key}): ${fmtPrice(probePrice)}`);

  /* --- split routing ---------------------------------------------- */
  const plan = await planSplit(shortlist, amountIn);
  const splitGainBps = bpsDiff(plan.totalOut, bestSingle.out);
  const useSplit = plan.totalOut > bestSingle.out && splitGainBps >= BigInt(CFG.minSplitGainBps);
  const legs = useSplit ? plan.legs : [{ venue: bestSingle.v, amountIn, quotedOut: bestSingle.out }];
  const expectedOut = useSplit ? plan.totalOut : bestSingle.out;

  console.log(`\nRoute (${useSplit ? `split across ${legs.length} pools` : `single venue ${bestSingle.v.key}`}):`);
  for (const leg of legs) {
    console.log(
      `  ${leg.venue.key.padEnd(10)} ${formatUnits(leg.amountIn, 6).padStart(14)} USDC -> ${formatUnits(leg.quotedOut, 18)} WETH @ ${fmtPrice(priceE6(leg.amountIn, leg.quotedOut))}`,
    );
  }
  const execPrice = priceE6(amountIn, expectedOut);
  console.log(`  expected total: ${formatUnits(expectedOut, 18)} WETH @ ${fmtPrice(execPrice)}`);
  console.log(
    useSplit
      ? `  split beats best single venue (${bestSingle.v.key}) by ${formatUnits(expectedOut - bestSingle.out, 18)} WETH (${splitGainBps} bps)`
      : `  split would gain only ${splitGainBps} bps (< MIN_SPLIT_GAIN_BPS=${CFG.minSplitGainBps}); routing to one pool`,
  );

  /* --- guards ------------------------------------------------------ */
  const impactBps = bpsDiff(execPrice, probePrice);
  console.log(`\nPrice impact vs probe: ${impactBps} bps (limit ${CFG.maxPriceImpactBps})`);
  if (impactBps > BigInt(CFG.maxPriceImpactBps)) {
    throw new Error(`price impact ${impactBps} bps exceeds MAX_PRICE_IMPACT_BPS=${CFG.maxPriceImpactBps}; split the order over time or raise the limit deliberately`);
  }

  const [, answer, , updatedAt] = await publicClient.readContract({
    address: CHAINLINK_ETH_USD,
    abi: chainlinkAbi,
    functionName: "latestRoundData",
  });
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const age = nowSec - updatedAt;
  if (answer <= 0n) throw new Error("Chainlink ETH/USD returned a non-positive answer");
  if (age > BigInt(CFG.maxOracleAgeSec)) throw new Error(`Chainlink ETH/USD is stale (${age}s old)`);
  const oraclePrice = answer / 100n; // 8 decimals -> 1e6 scale
  const oracleDevBps = bpsDiff(execPrice, oraclePrice);
  console.log(`Chainlink ETH/USD: ${fmtPrice(oraclePrice)} (${age}s old) — route deviates ${oracleDevBps} bps (limit ±${CFG.maxOracleDeviationBps})`);
  if (oracleDevBps > BigInt(CFG.maxOracleDeviationBps) || -oracleDevBps > BigInt(CFG.maxOracleDeviationBps)) {
    throw new Error(`route price deviates ${oracleDevBps} bps from the oracle; refusing to trade`);
  }

  const minOutTotal = (expectedOut * (BPS - BigInt(CFG.slippageBps))) / BPS;
  console.log(`Slippage: ${CFG.slippageBps} bps -> worst acceptable total ${formatUnits(minOutTotal, 18)} WETH`);

  if (!CFG.execute) {
    console.log("\nDry run only. Re-run with --execute (and PRIVATE_KEY set) to send transactions.");
    return;
  }
  if (!walletClient || !account || !recipient) throw new Error("PRIVATE_KEY is required to execute");

  /* --- balance & pre-flight --------------------------------------- */
  const balance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
  if (balance < amountIn) {
    throw new Error(`insufficient USDC: have ${formatUnits(balance, 6)}, need ${formatUnits(amountIn, 6)}`);
  }
  const wethBefore = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [recipient] });

  /* --- execute leg by leg ------------------------------------------ */
  let spent = 0n;
  for (const [i, leg] of legs.entries()) {
    const router = leg.venue.dex === "uniswap-v3" ? UNI_SWAP_ROUTER_02 : AERO_CL_ROUTER;
    console.log(`\nLeg ${i + 1}/${legs.length}: ${formatUnits(leg.amountIn, 6)} USDC on ${leg.venue.key} via ${router}`);

    // Approve. USDC on Base is a standard ERC20 (no approve-race quirk), but we
    // still only ever approve what this leg needs by default.
    const allowance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [account.address, router] });
    const approvalTarget = CFG.exactApprovals ? leg.amountIn : amountIn;
    if (allowance < leg.amountIn) {
      const { request } = await publicClient.simulateContract({
        account,
        address: USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [router, approvalTarget],
      });
      const hash = await walletClient.writeContract(request);
      const receipt = await waitForReceipt(hash);
      if (receipt.status !== "success") throw new Error(`approval reverted: ${hash}`);
      console.log(`  approved ${formatUnits(approvalTarget, 6)} USDC (${hash})`);
    }

    // Re-quote immediately before sending: the plan above may be several blocks old.
    quoteCache.clear();
    const freshOut = await quote(leg.venue, leg.amountIn);
    if (freshOut === 0n) throw new Error(`venue ${leg.venue.key} stopped quoting`);
    // The plan was built a few blocks ago. minOut alone would happily follow the
    // market down, so refuse the leg outright if it drifted too far against us.
    const driftBps = -bpsDiff(freshOut, leg.quotedOut);
    if (driftBps > BigInt(CFG.maxRequoteDriftBps)) {
      throw new Error(
        `${leg.venue.key} re-quote is ${driftBps} bps worse than the plan (limit MAX_REQUOTE_DRIFT_BPS=${CFG.maxRequoteDriftBps}); ` +
          `${formatUnits(spent, 6)} USDC of ${formatUnits(amountIn, 6)} already filled — re-run for the remainder`,
      );
    }
    const minOut = (freshOut * (BPS - BigInt(CFG.slippageBps))) / BPS;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + CFG.deadlineSec);
    console.log(`  fresh quote ${formatUnits(freshOut, 18)} WETH, minOut ${formatUnits(minOut, 18)} WETH, deadline +${CFG.deadlineSec}s`);

    let hash: Hex;
    if (leg.venue.dex === "uniswap-v3") {
      // SwapRouter02 has no deadline in the params struct; wrap in multicall(deadline, [...]).
      const inner = encodeFunctionData({
        abi: uniRouterAbi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: USDC,
            tokenOut: WETH,
            fee: leg.venue.param,
            recipient,
            amountIn: leg.amountIn,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      const { request, result } = await publicClient.simulateContract({
        account,
        address: router,
        abi: uniRouterAbi,
        functionName: "multicall",
        args: [deadline, [inner]],
      });
      const simulated = decodeFunctionResult({ abi: uniRouterAbi, functionName: "exactInputSingle", data: result[0] }) as bigint;
      console.log(`  simulated out ${formatUnits(simulated, 18)} WETH`);
      hash = await walletClient.writeContract(request);
    } else {
      const { request, result } = await publicClient.simulateContract({
        account,
        address: router,
        abi: aeroRouterAbi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: USDC,
            tokenOut: WETH,
            tickSpacing: leg.venue.param,
            recipient,
            deadline,
            amountIn: leg.amountIn,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      console.log(`  simulated out ${formatUnits(result, 18)} WETH`);
      hash = await walletClient.writeContract(request);
    }

    const receipt = await waitForReceipt(hash);
    if (receipt.status !== "success") throw new Error(`swap reverted: ${hash}`);
    console.log(`  mined in block ${receipt.blockNumber} (${hash}), gas ${receipt.gasUsed}`);
    spent += leg.amountIn;
  }

  const wethAfter = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [recipient] });
  const received = wethAfter - wethBefore;
  console.log(`\nDone. Spent ${formatUnits(spent, 6)} USDC, received ${formatUnits(received, 18)} WETH`);
  console.log(`Realized price ${fmtPrice(priceE6(spent, received))} vs expected ${fmtPrice(execPrice)} (${bpsDiff(priceE6(spent, received), execPrice)} bps)`);
  if (received < minOutTotal) console.warn(`WARNING: total received is below the pre-trade worst case (${formatUnits(minOutTotal, 18)} WETH)`);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
