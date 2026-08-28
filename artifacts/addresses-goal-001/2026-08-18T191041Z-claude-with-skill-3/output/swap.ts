/**
 * USDC -> WETH on Base mainnet (chain id 8453).
 *
 * The script does not trust the venue table below. On every run it:
 *   1. asserts the chain id is Base and that each token/router/quoter is the
 *      contract it claims to be (symbol/decimals, router.factory(), WETH9()),
 *   2. derives pool addresses from the verified factories instead of hardcoding
 *      them, and asserts each pool's token0/token1 and fee/tickSpacing,
 *   3. quotes every candidate pool at the *real* clip size and routes to the
 *      numbers, optionally splitting across the best two pools,
 *   4. re-quotes immediately before each transaction and bounds it with minOut.
 *
 * Addresses were verified on Base mainnet on 2026-08-18 (see NOTES.md).
 * Re-check them before moving real funds -- see "Before you run this" in NOTES.md.
 */
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC_URL = process.env.RPC_URL ?? "https://mainnet.base.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex | undefined;
const AMOUNT_USDC = process.env.AMOUNT_USDC ?? "250000";
const SLIPPAGE_BPS = BigInt(process.env.SLIPPAGE_BPS ?? "20");
const MAX_IMPACT_BPS = Number(process.env.MAX_IMPACT_BPS ?? "50");
const DEADLINE_SECONDS = BigInt(process.env.DEADLINE_SECONDS ?? "120");
const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const ALLOW_SPLIT = (process.env.ALLOW_SPLIT ?? "true").toLowerCase() !== "false";
const MIN_SPLIT_GAIN_BPS = Number(process.env.MIN_SPLIT_GAIN_BPS ?? "3");
const RECIPIENT = process.env.RECIPIENT as Address | undefined;
/** Optional desk override, e.g. FORCE_ROUTE="uniswap-v3 fee=3000". Substring match on the route label. */
const FORCE_ROUTE = process.env.FORCE_ROUTE;

const BASE_CHAIN_ID = 8453;
const BPS = 10_000n;

// ---------------------------------------------------------------------------
// Addresses (Base mainnet). Every one of these is re-checked at runtime.
// ---------------------------------------------------------------------------

/** Circle-native USDC, 6 decimals. NOT USDbC (bridged) 0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA. */
const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
/** Canonical Base WETH, 18 decimals. */
const WETH = getAddress("0x4200000000000000000000000000000000000006");

type CLVenue = {
  kind: "univ3" | "slipstream";
  name: string;
  router: Address;
  quoter: Address;
  factory: Address;
  /** fee tiers (univ3) or tick spacings (slipstream) */
  keys: number[];
};

/**
 * Aerodrome ships Slipstream (its concentrated-liquidity AMM) as three separate
 * deployments; older pools stay live and keep trading, so all three are quoted.
 * The v2-style Router below reaches only the vAMM/sAMM pools -- it cannot touch
 * Slipstream, and at desk size it prices ~12% worse. It is quoted as a control.
 */
const CL_VENUES: CLVenue[] = [
  {
    kind: "univ3",
    name: "uniswap-v3",
    router: getAddress("0x2626664c2603336E57B271c5C0b26F421741e481"), // SwapRouter02
    quoter: getAddress("0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"), // QuoterV2
    factory: getAddress("0x33128a8fC17869897dcE68Ed026d694621f6FDfD"),
    keys: [100, 500, 3000, 10000],
  },
  {
    kind: "slipstream",
    name: "aerodrome-slipstream-initial",
    router: getAddress("0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5"),
    quoter: getAddress("0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0"),
    factory: getAddress("0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A"),
    keys: [1, 10, 50, 100, 200, 2000],
  },
  {
    kind: "slipstream",
    name: "aerodrome-slipstream-gauge-caps",
    router: getAddress("0xcbBb8035cAc7D4B3Ca7aBb74cF7BdF900215Ce0D"),
    quoter: getAddress("0x3d4C22254F86f64B7eC90ab8F7aeC1FBFD271c6C"),
    factory: getAddress("0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a"),
    keys: [1, 10, 50, 100, 200, 500, 2000],
  },
  {
    kind: "slipstream",
    name: "aerodrome-slipstream-gauges-v3", // current deployment per Aerodrome's repo
    router: getAddress("0x698Cb2b6dd822994581fEa6eA4Fc755d1363A92F"),
    quoter: getAddress("0x514c8B5f54112481E28028F1166Bd78501089259"),
    factory: getAddress("0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef"),
    keys: [1, 10, 50, 100, 200, 500, 2000],
  },
];

const AERO_V2_ROUTER = getAddress("0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43");
const AERO_V2_FACTORY = getAddress("0x420DD381b31aEf6683db6B902084cB0FFECe40Da");

// ---------------------------------------------------------------------------
// ABIs (only what is called)
// ---------------------------------------------------------------------------

const uniFactoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }],
    outputs: [{ type: "address" }],
  },
] as const;

const clFactoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }, { type: "int24" }],
    outputs: [{ type: "address" }],
  },
] as const;

const poolAbi = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "fee", stateMutability: "view", inputs: [], outputs: [{ type: "uint24" }] },
  { type: "function", name: "tickSpacing", stateMutability: "view", inputs: [], outputs: [{ type: "int24" }] },
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
] as const;

const uniQuoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
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
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "WETH9", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const slipQuoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
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
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "WETH9", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

/** Uniswap SwapRouter02: no deadline arg -- it is supplied via multicall(deadline, data[]). */
const uniRouterAbi = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
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
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [{ name: "deadline", type: "uint256" }, { name: "data", type: "bytes[]" }],
    outputs: [{ type: "bytes[]" }],
  },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "WETH9", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

/** Slipstream SwapRouter: like Uniswap v3's, keyed by tickSpacing, deadline in the struct. */
const slipRouterAbi = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
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
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "WETH9", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const aeroRouteTuple = {
  type: "tuple[]",
  components: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "stable", type: "bool" },
    { name: "factory", type: "address" },
  ],
} as const;

const aeroRouterAbi = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "routes", ...aeroRouteTuple }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactTokensForTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "routes", ...aeroRouteTuple },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ type: "uint256[]" }],
  },
  { type: "function", name: "defaultFactory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const aeroFactoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }, { type: "bool" }],
    outputs: [{ type: "address" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const transport = http(RPC_URL, { retryCount: 5, retryDelay: 400, timeout: 30_000 });

const publicClient = createPublicClient({ chain: base, transport });

const account = PRIVATE_KEY ? privateKeyToAccount(PRIVATE_KEY) : undefined;
const walletClient = account
  ? createWalletClient({ account, chain: base, transport })
  : undefined;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Route =
  | { kind: "univ3" | "slipstream"; venue: CLVenue; key: number; pool: Address; label: string }
  | { kind: "aero-v2"; pool: Address; stable: boolean; label: string };

type Quote = { route: Route; amountIn: bigint; amountOut: bigint };

const ZERO = "0x0000000000000000000000000000000000000000";
const fail = (msg: string): never => {
  throw new Error(msg);
};
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const bps = (a: bigint, b: bigint) => (Number(a) / Number(b) - 1) * 10_000;

// ---------------------------------------------------------------------------
// 1. Identity checks -- a wrong address usually does not revert, so ask
// ---------------------------------------------------------------------------

async function verifyIdentities() {
  const chainId = await publicClient.getChainId();
  if (chainId !== BASE_CHAIN_ID) fail(`RPC_URL is chain ${chainId}, expected Base (${BASE_CHAIN_ID})`);

  const [usdcSymbol, usdcDecimals, wethSymbol, wethDecimals] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "decimals" }),
  ]);
  if (usdcSymbol !== "USDC" || usdcDecimals !== 6) fail(`${USDC} is not 6-decimal USDC (${usdcSymbol}/${usdcDecimals})`);
  if (wethSymbol !== "WETH" || wethDecimals !== 18) fail(`${WETH} is not 18-decimal WETH (${wethSymbol}/${wethDecimals})`);

  for (const v of CL_VENUES) {
    const routerAbi = v.kind === "univ3" ? uniRouterAbi : slipRouterAbi;
    const quoterAbi = v.kind === "univ3" ? uniQuoterAbi : slipQuoterAbi;
    const [routerFactory, routerWeth, quoterFactory] = await Promise.all([
      publicClient.readContract({ address: v.router, abi: routerAbi, functionName: "factory" }),
      publicClient.readContract({ address: v.router, abi: routerAbi, functionName: "WETH9" }),
      publicClient.readContract({ address: v.quoter, abi: quoterAbi, functionName: "factory" }),
    ]);
    if (!eq(routerFactory, v.factory)) fail(`${v.name}: router.factory() = ${routerFactory}, expected ${v.factory}`);
    if (!eq(quoterFactory, v.factory)) fail(`${v.name}: quoter.factory() = ${quoterFactory}, expected ${v.factory}`);
    if (!eq(routerWeth, WETH)) fail(`${v.name}: router.WETH9() = ${routerWeth}, expected ${WETH}`);
  }

  const aeroFactory = await publicClient.readContract({
    address: AERO_V2_ROUTER,
    abi: aeroRouterAbi,
    functionName: "defaultFactory",
  });
  if (!eq(aeroFactory, AERO_V2_FACTORY)) fail(`aerodrome-v2: router.defaultFactory() = ${aeroFactory}`);

  console.log(`identity checks passed on chain ${chainId} (USDC ${usdcSymbol}/${usdcDecimals}, WETH ${wethSymbol}/${wethDecimals})`);
}

// ---------------------------------------------------------------------------
// 2. Pool discovery -- pools come from the verified factories, never hardcoded
// ---------------------------------------------------------------------------

async function discoverRoutes(): Promise<Route[]> {
  const routes: Route[] = [];

  for (const v of CL_VENUES) {
    const factoryAbi = v.kind === "univ3" ? uniFactoryAbi : clFactoryAbi;
    const pools = await Promise.all(
      v.keys.map((key) =>
        publicClient
          .readContract({ address: v.factory, abi: factoryAbi, functionName: "getPool", args: [USDC, WETH, key] })
          .catch(() => ZERO as Address),
      ),
    );
    for (const [i, pool] of pools.entries()) {
      if (eq(pool, ZERO)) continue;
      const key = v.keys[i];
      const [token0, token1, onchainKey] = await Promise.all([
        publicClient.readContract({ address: pool, abi: poolAbi, functionName: "token0" }),
        publicClient.readContract({ address: pool, abi: poolAbi, functionName: "token1" }),
        publicClient.readContract({
          address: pool,
          abi: poolAbi,
          functionName: v.kind === "univ3" ? "fee" : "tickSpacing",
        }),
      ]);
      const pair = [token0, token1].map((t) => t.toLowerCase()).sort();
      const want = [USDC, WETH].map((t) => t.toLowerCase()).sort();
      if (pair[0] !== want[0] || pair[1] !== want[1]) fail(`${v.name} pool ${pool} is not USDC/WETH`);
      if (Number(onchainKey) !== key) fail(`${v.name} pool ${pool} reports ${onchainKey}, expected ${key}`);
      routes.push({
        kind: v.kind,
        venue: v,
        key,
        pool,
        label: `${v.name} ${v.kind === "univ3" ? `fee=${key}` : `ts=${key}`}`,
      });
    }
  }

  const aeroPool = await publicClient.readContract({
    address: AERO_V2_FACTORY,
    abi: aeroFactoryAbi,
    functionName: "getPool",
    args: [USDC, WETH, false],
  });
  if (!eq(aeroPool, ZERO)) {
    routes.push({ kind: "aero-v2", pool: aeroPool, stable: false, label: "aerodrome-v2 vAMM" });
  }

  return routes;
}

// ---------------------------------------------------------------------------
// 3. Quoting
// ---------------------------------------------------------------------------

async function quote(route: Route, amountIn: bigint): Promise<bigint | null> {
  if (amountIn === 0n) return 0n;
  try {
    if (route.kind === "aero-v2") {
      const amounts = await publicClient.readContract({
        address: AERO_V2_ROUTER,
        abi: aeroRouterAbi,
        functionName: "getAmountsOut",
        args: [amountIn, [{ from: USDC, to: WETH, stable: route.stable, factory: AERO_V2_FACTORY }]],
      });
      return amounts[amounts.length - 1];
    }
    if (route.kind === "univ3") {
      const { result } = await publicClient.simulateContract({
        address: route.venue.quoter,
        abi: uniQuoterAbi,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee: route.key, sqrtPriceLimitX96: 0n }],
      });
      return result[0];
    }
    const { result } = await publicClient.simulateContract({
      address: route.venue.quoter,
      abi: slipQuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing: route.key, sqrtPriceLimitX96: 0n }],
    });
    return result[0];
  } catch (err) {
    // A revert means the pool cannot fill this size; an RPC failure means we are
    // quoting blind. Either way the route drops out, so say so loudly rather
    // than silently routing around a pool that might have been the best one.
    const reason = err instanceof Error ? err.message.split("\n")[0] : String(err);
    console.warn(`  ! ${route.label} did not quote ${formatUnits(amountIn, 6)} USDC: ${reason}`);
    return null;
  }
}

async function quoteAll(routes: Route[], amountIn: bigint): Promise<Quote[]> {
  const results = await Promise.all(routes.map(async (route) => ({ route, out: await quote(route, amountIn) })));
  return results
    .filter((r): r is { route: Route; out: bigint } => r.out !== null && r.out > 0n)
    .map(({ route, out }) => ({ route, amountIn, amountOut: out }))
    .sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1));
}

/**
 * Best two-way split across the top two pools. Output as a function of the split
 * fraction is concave, so a ternary search on a 1%-granular grid finds the max
 * in ~12 quote pairs. Returns null when splitting does not beat the single route.
 */
async function bestSplit(a: Route, b: Route, amountIn: bigint, singleBest: bigint) {
  const memo = new Map<number, bigint>();
  const total = async (pct: number) => {
    const cached = memo.get(pct);
    if (cached !== undefined) return cached;
    const inA = (amountIn * BigInt(pct)) / 100n;
    const inB = amountIn - inA;
    const [outA, outB] = await Promise.all([quote(a, inA), quote(b, inB)]);
    const sum = outA === null || outB === null ? 0n : outA + outB;
    memo.set(pct, sum);
    return sum;
  };

  let lo = 0;
  let hi = 100;
  while (hi - lo > 3) {
    const m1 = lo + Math.floor((hi - lo) / 3);
    const m2 = hi - Math.floor((hi - lo) / 3);
    if ((await total(m1)) < (await total(m2))) lo = m1 + 1;
    else hi = m2;
  }
  let bestPct = lo;
  let bestOut = 0n;
  for (let pct = lo; pct <= hi; pct++) {
    const out = await total(pct);
    if (out > bestOut) {
      bestOut = out;
      bestPct = pct;
    }
  }
  if (bestPct === 0 || bestPct === 100 || bestOut <= singleBest) return null;
  return { pct: bestPct, amountOut: bestOut, gainBps: bps(bestOut, singleBest) };
}

// ---------------------------------------------------------------------------
// 4. Execution
// ---------------------------------------------------------------------------

async function ensureAllowance(spender: Address, amount: bigint) {
  const owner = account!.address;
  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
  if (allowance >= amount) return;
  console.log(`  approving ${formatUnits(amount, 6)} USDC to ${spender}`);
  const hash = await walletClient!.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    chain: base,
    account: account!,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") fail(`approve reverted: ${hash}`);
  console.log(`  approve ok ${hash}`);
}

async function executeLeg(route: Route, amountIn: bigint, plannedOut: bigint, recipient: Address) {
  // Re-quote at send time: the plan may be several blocks old by now.
  const fresh = await quote(route, amountIn);
  if (fresh === null) fail(`${route.label}: re-quote failed, aborting before sending`);
  const drift = bps(fresh!, plannedOut);
  if (drift < -Number(SLIPPAGE_BPS)) {
    fail(`${route.label}: price moved ${drift.toFixed(1)} bps against us since planning, aborting`);
  }
  const minOut = (fresh! * (BPS - SLIPPAGE_BPS)) / BPS;
  const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECONDS;
  const spender = route.kind === "aero-v2" ? AERO_V2_ROUTER : route.venue.router;

  console.log(
    `  leg ${route.label}: in ${formatUnits(amountIn, 6)} USDC, quote ${formatUnits(fresh!, 18)} WETH, ` +
      `minOut ${formatUnits(minOut, 18)} WETH`,
  );
  await ensureAllowance(spender, amountIn);

  let hash: Hex;
  if (route.kind === "aero-v2") {
    const { request } = await publicClient.simulateContract({
      address: AERO_V2_ROUTER,
      abi: aeroRouterAbi,
      functionName: "swapExactTokensForTokens",
      args: [
        amountIn,
        minOut,
        [{ from: USDC, to: WETH, stable: route.stable, factory: AERO_V2_FACTORY }],
        recipient,
        deadline,
      ],
      account: account!,
    });
    hash = await walletClient!.writeContract(request);
  } else if (route.kind === "slipstream") {
    const { request } = await publicClient.simulateContract({
      address: route.venue.router,
      abi: slipRouterAbi,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: USDC,
          tokenOut: WETH,
          tickSpacing: route.key,
          recipient,
          deadline,
          amountIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
      account: account!,
    });
    hash = await walletClient!.writeContract(request);
  } else {
    const inner = encodeFunctionData({
      abi: uniRouterAbi,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: USDC,
          tokenOut: WETH,
          fee: route.key,
          recipient,
          amountIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    const { request } = await publicClient.simulateContract({
      address: route.venue.router,
      abi: uniRouterAbi,
      functionName: "multicall", // SwapRouter02 takes the deadline here
      args: [deadline, [inner]],
      account: account!,
    });
    hash = await walletClient!.writeContract(request);
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") fail(`swap reverted: ${hash}`);
  console.log(`  swap ok ${hash} (gas ${receipt.gasUsed})`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const amountIn = parseUnits(AMOUNT_USDC, 6);
  console.log(`\nUSDC -> WETH on Base, clip = ${AMOUNT_USDC} USDC, dry run = ${DRY_RUN}\n`);

  await verifyIdentities();
  const routes = await discoverRoutes();
  console.log(`discovered ${routes.length} USDC/WETH pools from verified factories\n`);

  // Small probe on the same pools gives the fee-inclusive reference rate that
  // full-size quotes are measured against.
  const probeIn = parseUnits("1000", 6);
  const [allQuotes, probes] = await Promise.all([quoteAll(routes, amountIn), quoteAll(routes, probeIn)]);
  if (allQuotes.length === 0) fail("no pool could quote this size");

  const full = FORCE_ROUTE ? allQuotes.filter((q) => q.route.label.includes(FORCE_ROUTE)) : allQuotes;
  if (full.length === 0) fail(`FORCE_ROUTE="${FORCE_ROUTE}" matched no quotable pool`);
  if (FORCE_ROUTE) console.log(`FORCE_ROUTE="${FORCE_ROUTE}": ${full.length} of ${allQuotes.length} pools kept\n`);

  const bestProbeRate = probes.reduce((max, q) => (q.amountOut > max ? q.amountOut : max), 0n);
  const reference = (bestProbeRate * amountIn) / probeIn; // WETH at the small-clip rate

  console.log("full-size quotes (best first):");
  for (const q of allQuotes) {
    const slip = bps(q.amountOut, reference);
    console.log(
      `  ${q.route.label.padEnd(40)} ${formatUnits(q.amountOut, 18).padStart(22)} WETH  ` +
        `${slip.toFixed(1).padStart(9)} bps  pool ${q.route.pool}`,
    );
  }

  const best = full[0];
  const impactBps = -bps(best.amountOut, reference);
  console.log(
    `\nreference rate from a ${formatUnits(probeIn, 6)} USDC probe: ${formatUnits(reference, 18)} WETH equivalent`,
  );
  console.log(`best single route: ${best.route.label} at ${impactBps.toFixed(1)} bps of impact`);

  type Leg = { route: Route; amountIn: bigint; plannedOut: bigint };
  let legs: Leg[] = [{ route: best.route, amountIn, plannedOut: best.amountOut }];
  let plannedTotal = best.amountOut;

  if (ALLOW_SPLIT && full.length > 1) {
    const split = await bestSplit(best.route, full[1].route, amountIn, best.amountOut);
    if (split && split.gainBps >= MIN_SPLIT_GAIN_BPS) {
      const inA = (amountIn * BigInt(split.pct)) / 100n;
      const inB = amountIn - inA;
      const [outA, outB] = await Promise.all([quote(best.route, inA), quote(full[1].route, inB)]);
      legs = [
        { route: best.route, amountIn: inA, plannedOut: outA! },
        { route: full[1].route, amountIn: inB, plannedOut: outB! },
      ];
      plannedTotal = split.amountOut;
      console.log(
        `split beats it by ${split.gainBps.toFixed(1)} bps: ${split.pct}% ${best.route.label} / ` +
          `${100 - split.pct}% ${full[1].route.label} -> ${formatUnits(split.amountOut, 18)} WETH`,
      );
    } else {
      console.log(`split search: no split beats the single route by >= ${MIN_SPLIT_GAIN_BPS} bps`);
    }
  }

  const plannedImpactBps = -bps(plannedTotal, reference);
  if (plannedImpactBps > MAX_IMPACT_BPS) {
    fail(
      `planned execution costs ${plannedImpactBps.toFixed(1)} bps vs the probe rate, over MAX_IMPACT_BPS=${MAX_IMPACT_BPS}. ` +
        `Cut the clip size or wait for liquidity.`,
    );
  }

  console.log(`\nplan (${legs.length} leg(s)), expected ${formatUnits(plannedTotal, 18)} WETH, ` +
    `${plannedImpactBps.toFixed(1)} bps impact, ${Number(SLIPPAGE_BPS)} bps slippage bound per leg`);

  if (DRY_RUN) {
    console.log("\nDRY_RUN=true -- nothing sent. Set DRY_RUN=false to execute.");
    return;
  }
  if (!account || !walletClient) fail("PRIVATE_KEY is required to execute");

  const recipient = RECIPIENT ? getAddress(RECIPIENT) : account!.address;
  const [usdcBalance, ethBalance, wethBefore] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account!.address] }),
    publicClient.getBalance({ address: account!.address }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [recipient] }),
  ]);
  if (usdcBalance < amountIn) {
    fail(`USDC balance ${formatUnits(usdcBalance, 6)} < clip ${formatUnits(amountIn, 6)}`);
  }
  if (ethBalance === 0n) fail("account has no ETH for gas on Base");
  console.log(`sender ${account!.address}, recipient ${recipient}\n`);

  for (const leg of legs) await executeLeg(leg.route, leg.amountIn, leg.plannedOut, recipient);

  const wethAfter = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [recipient],
  });
  const received = wethAfter - wethBefore;
  console.log(
    `\nreceived ${formatUnits(received, 18)} WETH for ${formatUnits(amountIn, 6)} USDC ` +
      `(${(Number(formatUnits(amountIn, 6)) / Number(formatUnits(received, 18))).toFixed(2)} USDC/WETH, ` +
      `${bps(received, reference).toFixed(1)} bps vs the probe rate)`,
  );
}

main().catch((err) => {
  console.error(`\nABORTED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
