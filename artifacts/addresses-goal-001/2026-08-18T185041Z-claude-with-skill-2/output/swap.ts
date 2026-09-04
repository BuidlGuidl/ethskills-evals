/**
 * USDC -> WETH on Base mainnet, routed through the Aerodrome Slipstream
 * (concentrated-liquidity) USDC/WETH pool at tickSpacing 100.
 *
 * See NOTES.md for the venue selection, the measurements behind it, and the
 * pre-flight checklist. Every address below was verified on Base mainnet
 * (chainId 8453) on 2026-08-18 and is RE-VERIFIED AT RUNTIME by `verifyAddresses()`
 * before any approval or swap is sent. Do not trust this table on its own.
 *
 *   tsx swap.ts verify     identity-check every address against the chain
 *   tsx swap.ts quote      quote the configured size across all candidate venues
 *   tsx swap.ts swap       run the trade (needs DRY_RUN=false to broadcast)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  getAddress,
  erc20Abi,
  type Address,
  type Hex,
  type PublicClient,
  type Transport,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ---------------------------------------------------------------------------
// Addresses (Base mainnet, chainId 8453)
// ---------------------------------------------------------------------------
// Sources, per address:
//   USDC   - Circle-issued native USDC on Base (NOT the bridged USDbC below).
//   WETH   - Base predeploy.
//   Slipstream PoolFactory / Quoter - aerodrome-finance/slipstream,
//            script/constants/output/DeployCL-Base.json
//   Slipstream SwapRouter / v2 Router - aerodrome-finance/docs, content/security.mdx
//   Uniswap v3 SwapRouter02 / QuoterV2 / factory - Uniswap deployment docs.

const USDC: Address = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const WETH: Address = getAddress("0x4200000000000000000000000000000000000006");

/** Bridged USDbC. NOT used. Kept here so nobody "fixes" the USDC address into it. */
const USDbC_DO_NOT_USE: Address = getAddress("0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA");

// Aerodrome Slipstream (concentrated liquidity) — the route we trade.
const CL_FACTORY: Address = getAddress("0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A");
const CL_SWAP_ROUTER: Address = getAddress("0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5");
const CL_QUOTER: Address = getAddress("0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0");
/** USDC/WETH CL pool, tickSpacing 100. Resolved from CL_FACTORY at runtime; this is the expected value. */
const CL_POOL_EXPECTED: Address = getAddress("0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59");
const CL_TICK_SPACING = 100;

/**
 * Aerodrome's v2-style (vAMM/sAMM) Router. NOT the venue we use, and NOT
 * interchangeable with the Slipstream router above: it cannot reach CL pools.
 * Listed only so the cross-venue check can price it and prove the gap.
 * Measured 2026-08-18 on 500k USDC: 230.20 WETH here vs 260.59 via Slipstream.
 */
const AERO_V2_ROUTER: Address = getAddress("0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43");
const AERO_V2_FACTORY: Address = getAddress("0x420DD381b31aEf6683db6B902084cB0FFECe40Da");

// Uniswap v3 on Base — priced every run as a cross-check on the route choice,
// and the documented fallback venue if that check says depth has moved.
const UNIV3_FACTORY: Address = getAddress("0x33128a8fC17869897dcE68Ed026d694621f6FDfD");
const UNIV3_QUOTER_V2: Address = getAddress("0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a");
/** SwapRouter02. Not called here — the fallback is a deliberate, human decision. See NOTES.md. */
const UNIV3_SWAP_ROUTER_02: Address = getAddress("0x2626664c2603336E57B271c5C0b26F421741e481");
const UNIV3_FEE_TIERS = [3000, 500] as const;

// ---------------------------------------------------------------------------
// ABIs (only the fragments we call)
// ---------------------------------------------------------------------------

const clQuoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable", // simulate, never eth_call as view
    inputs: [
      {
        type: "tuple",
        name: "params",
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

const clRouterAbi = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        type: "tuple",
        name: "params",
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

const clFactoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }, { type: "int24" }],
    outputs: [{ type: "address" }],
  },
] as const;

const clPoolAbi = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "tickSpacing", stateMutability: "view", inputs: [], outputs: [{ type: "int24" }] },
  { type: "function", name: "fee", stateMutability: "view", inputs: [], outputs: [{ type: "uint24" }] },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
] as const;

const univ3QuoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        type: "tuple",
        name: "params",
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
] as const;

const aeroV2RouterAbi = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" },
        ],
      },
    ],
    outputs: [{ type: "uint256[]" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BPS = 10_000n;

function env(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var ${key}`);
  }
  return v;
}

const CONFIG = {
  rpcUrl: env("RPC_URL", "https://mainnet.base.org"),
  amountUsdc: env("AMOUNT_USDC", "500000"),
  clips: Number(env("CLIPS", "1")),
  maxSlippageBps: BigInt(env("MAX_SLIPPAGE_BPS", "30")),
  maxImpactBps: BigInt(env("MAX_IMPACT_BPS", "60")),
  crossVenueToleranceBps: BigInt(env("CROSS_VENUE_TOLERANCE_BPS", "10")),
  deadlineSeconds: BigInt(env("DEADLINE_SECONDS", "120")),
  dryRun: env("DRY_RUN", "true").toLowerCase() !== "false",
};

/** Clip used to read the (near) marginal price, for the impact calculation. */
const PROBE_AMOUNT = parseUnits("1000", 6);

/**
 * Public Base RPCs signal rate limiting as a JSON-RPC *error*, not an HTTP 429,
 * so viem's built-in retry does not fire and the call surfaces as a plain
 * failure. A throttled verification read must never be mistaken for a failed
 * check, so retry that class explicitly. Use a dedicated RPC for real trading.
 */
function resilientTransport(url: string): Transport {
  const inner = http(url, { retryCount: 5, retryDelay: 400, timeout: 30_000 });
  const wrapped: Transport = (opts) => {
    const transport = inner(opts);
    const request = transport.request as (...a: unknown[]) => Promise<unknown>;
    return {
      ...transport,
      request: (async (...args: unknown[]) => {
        let lastError: unknown;
        for (let attempt = 0; attempt < 6; attempt++) {
          try {
            return await request(...args);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!/rate limit|too many requests|429|limit exceeded|capacity/i.test(msg)) throw err;
            lastError = err;
            await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
          }
        }
        throw lastError;
      }) as typeof transport.request,
    };
  };
  return wrapped;
}

// Reads are batched through Multicall3 to cut request count on shared endpoints.
const publicClient = createPublicClient({
  chain: base,
  transport: resilientTransport(CONFIG.rpcUrl),
  batch: { multicall: { wait: 20 } },
}) as PublicClient;

const fmtUsdc = (v: bigint) => `${formatUnits(v, 6)} USDC`;
const fmtWeth = (v: bigint) => `${formatUnits(v, 18)} WETH`;
/** WETH out per USDC in, expressed as USDC per WETH. */
const priceUsdcPerWeth = (inUsdc: bigint, outWeth: bigint) =>
  Number(formatUnits(inUsdc, 6)) / Number(formatUnits(outWeth, 18));

// ---------------------------------------------------------------------------
// Address verification — runs before anything that can move funds
// ---------------------------------------------------------------------------

async function assertHasCode(label: string, address: Address) {
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x") {
    throw new Error(`${label} ${address} has no code on chainId ${base.id}. Wrong chain or wrong address.`);
  }
}

async function verifyAddresses(verbose = true) {
  const log = (s: string) => verbose && console.log(s);

  const chainId = await publicClient.getChainId();
  if (chainId !== base.id) {
    throw new Error(`RPC_URL points at chainId ${chainId}, expected ${base.id} (Base mainnet).`);
  }
  log(`chainId ${chainId} (Base mainnet) via ${CONFIG.rpcUrl}`);

  for (const [label, address] of [
    ["USDC", USDC],
    ["WETH", WETH],
    ["Slipstream PoolFactory", CL_FACTORY],
    ["Slipstream SwapRouter", CL_SWAP_ROUTER],
    ["Slipstream Quoter", CL_QUOTER],
    ["Uniswap v3 QuoterV2", UNIV3_QUOTER_V2],
    ["Aerodrome v2 Router", AERO_V2_ROUTER],
  ] as const) {
    await assertHasCode(label, address);
  }

  // Token identity: symbol AND decimals. A wrong-but-live token answers symbol()
  // happily, so also assert USDC is not the bridged USDbC.
  const [usdcSymbol, usdcDecimals, wethSymbol, wethDecimals] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "decimals" }),
  ]);
  if (usdcSymbol !== "USDC" || usdcDecimals !== 6) {
    throw new Error(`USDC ${USDC} reports ${usdcSymbol}/${usdcDecimals}dp, expected USDC/6.`);
  }
  if (USDC.toLowerCase() === USDbC_DO_NOT_USE.toLowerCase()) {
    throw new Error("USDC constant is the bridged USDbC address. Use native USDC.");
  }
  if (wethSymbol !== "WETH" || wethDecimals !== 18) {
    throw new Error(`WETH ${WETH} reports ${wethSymbol}/${wethDecimals}dp, expected WETH/18.`);
  }
  log(`tokens   USDC ${USDC} (${usdcSymbol}, ${usdcDecimals}dp, native — not USDbC)`);
  log(`         WETH ${WETH} (${wethSymbol}, ${wethDecimals}dp)`);

  // Router/quoter must belong to the Slipstream factory we think they do.
  const [routerFactory, routerWeth, quoterFactory] = await Promise.all([
    publicClient.readContract({ address: CL_SWAP_ROUTER, abi: clRouterAbi, functionName: "factory" }),
    publicClient.readContract({ address: CL_SWAP_ROUTER, abi: clRouterAbi, functionName: "WETH9" }),
    publicClient.readContract({ address: CL_QUOTER, abi: clQuoterAbi, functionName: "factory" }),
  ]);
  if (getAddress(routerFactory) !== CL_FACTORY) {
    throw new Error(`SwapRouter.factory() = ${routerFactory}, expected ${CL_FACTORY}. Wrong router deployment.`);
  }
  if (getAddress(quoterFactory) !== CL_FACTORY) {
    throw new Error(`Quoter.factory() = ${quoterFactory}, expected ${CL_FACTORY}. Quoter and router disagree.`);
  }
  if (getAddress(routerWeth) !== WETH) {
    throw new Error(`SwapRouter.WETH9() = ${routerWeth}, expected ${WETH}.`);
  }
  log(`router   ${CL_SWAP_ROUTER} -> factory ${routerFactory} (matches quoter)`);

  // The cross-venue guard can block or wave through a large trade, so the
  // quoter it relies on gets the same identity check as the routing venue.
  const uniQuoterFactory = await publicClient.readContract({
    address: UNIV3_QUOTER_V2,
    abi: univ3QuoterAbi,
    functionName: "factory",
  });
  if (getAddress(uniQuoterFactory) !== UNIV3_FACTORY) {
    throw new Error(
      `Uniswap QuoterV2.factory() = ${uniQuoterFactory}, expected ${UNIV3_FACTORY}. Cross-venue check is unreliable.`,
    );
  }
  log(`xcheck   Uniswap v3 QuoterV2 ${UNIV3_QUOTER_V2} -> factory ${uniQuoterFactory}`);

  // The pool must be the factory's own, not a lookalike.
  const pool = await publicClient.readContract({
    address: CL_FACTORY,
    abi: clFactoryAbi,
    functionName: "getPool",
    args: [WETH, USDC, CL_TICK_SPACING],
  });
  if (getAddress(pool) === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Slipstream factory has no USDC/WETH pool at tickSpacing ${CL_TICK_SPACING}.`);
  }
  if (getAddress(pool) !== CL_POOL_EXPECTED) {
    throw new Error(
      `Slipstream USDC/WETH ts=${CL_TICK_SPACING} pool is ${pool}, expected ${CL_POOL_EXPECTED}. ` +
        `Re-check the deployment before trading.`,
    );
  }
  const [t0, t1, ts, fee, liquidity] = await Promise.all([
    publicClient.readContract({ address: pool, abi: clPoolAbi, functionName: "token0" }),
    publicClient.readContract({ address: pool, abi: clPoolAbi, functionName: "token1" }),
    publicClient.readContract({ address: pool, abi: clPoolAbi, functionName: "tickSpacing" }),
    publicClient.readContract({ address: pool, abi: clPoolAbi, functionName: "fee" }),
    publicClient.readContract({ address: pool, abi: clPoolAbi, functionName: "liquidity" }),
  ]);
  const pair = new Set([getAddress(t0), getAddress(t1)]);
  if (!pair.has(USDC) || !pair.has(WETH) || ts !== CL_TICK_SPACING) {
    throw new Error(`Pool ${pool} is not the USDC/WETH ts=${CL_TICK_SPACING} pool (${t0}/${t1}, ts=${ts}).`);
  }
  if (liquidity === 0n) throw new Error(`Pool ${pool} has zero in-range liquidity.`);
  log(`pool     ${pool} USDC/WETH ts=${ts} fee=${Number(fee) / 100}bps (dynamic) liquidity=${liquidity}`);

  return { pool, fee };
}

// ---------------------------------------------------------------------------
// Quoting
// ---------------------------------------------------------------------------

/** Slipstream quoter is state-mutating by design — simulate it, never eth_call it as a view. */
async function quoteSlipstream(amountIn: bigint): Promise<bigint> {
  const { result } = await publicClient.simulateContract({
    address: CL_QUOTER,
    abi: clQuoterAbi,
    functionName: "quoteExactInputSingle",
    args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing: CL_TICK_SPACING, sqrtPriceLimitX96: 0n }],
  });
  return result[0];
}

async function quoteUniV3(amountIn: bigint, fee: number): Promise<bigint> {
  try {
    const { result } = await publicClient.simulateContract({
      address: UNIV3_QUOTER_V2,
      abi: univ3QuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee, sqrtPriceLimitX96: 0n }],
    });
    return result[0];
  } catch {
    return 0n; // no pool / no liquidity at this size
  }
}

async function quoteAeroV2(amountIn: bigint, stable: boolean): Promise<bigint> {
  try {
    const amounts = await publicClient.readContract({
      address: AERO_V2_ROUTER,
      abi: aeroV2RouterAbi,
      functionName: "getAmountsOut",
      args: [amountIn, [{ from: USDC, to: WETH, stable, factory: AERO_V2_FACTORY }]],
    });
    return amounts[amounts.length - 1];
  } catch {
    return 0n;
  }
}

type VenueQuote = { venue: string; out: bigint; tradable: boolean };

/**
 * Price the configured size on every candidate venue. The route is only
 * defensible if it still wins at the actual clip size, today — depth moves.
 */
async function quoteAllVenues(amountIn: bigint): Promise<VenueQuote[]> {
  const [slip, uniQuotes, aeroVolatile, aeroStable] = await Promise.all([
    quoteSlipstream(amountIn),
    Promise.all(UNIV3_FEE_TIERS.map((fee) => quoteUniV3(amountIn, fee))),
    quoteAeroV2(amountIn, false),
    quoteAeroV2(amountIn, true),
  ]);
  return [
    { venue: `Aerodrome Slipstream ts=${CL_TICK_SPACING} [ROUTE]`, out: slip, tradable: true },
    ...UNIV3_FEE_TIERS.map((fee, i) => ({
      venue: `Uniswap v3 fee=${fee}`,
      out: uniQuotes[i],
      tradable: true,
    })),
    // Priced to prove the gap, never routed: the v2 Router cannot reach CL pools.
    { venue: "Aerodrome v2 Router (vAMM)", out: aeroVolatile, tradable: false },
    { venue: "Aerodrome v2 Router (sAMM)", out: aeroStable, tradable: false },
  ];
}

/**
 * Impact of the full clip against the near-marginal price, in bps (negative = worse).
 * This is the number that matters at desk size, and it is why the venue was chosen.
 */
async function priceImpactBps(amountIn: bigint, amountOut: bigint): Promise<bigint> {
  const probeOut = await quoteSlipstream(PROBE_AMOUNT);
  const noImpactOut = (probeOut * amountIn) / PROBE_AMOUNT;
  if (noImpactOut === 0n) throw new Error("Probe quote returned zero.");
  return ((amountOut - noImpactOut) * BPS) / noImpactOut;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdQuote() {
  await verifyAddresses();
  const amountIn = parseUnits(CONFIG.amountUsdc, 6);
  console.log(`\nquoting ${fmtUsdc(amountIn)} -> WETH at block ${await publicClient.getBlockNumber()}\n`);

  const quotes = await quoteAllVenues(amountIn);
  const best = quotes.filter((q) => q.out > 0n).sort((a, b) => (b.out > a.out ? 1 : -1))[0];
  for (const q of quotes) {
    const rel = q.out === 0n || best.out === 0n ? 0n : ((q.out - best.out) * BPS) / best.out;
    const px = q.out === 0n ? "n/a" : priceUsdcPerWeth(amountIn, q.out).toFixed(2);
    console.log(
      `  ${q.venue.padEnd(38)} ${(q.out === 0n ? "revert/none" : formatUnits(q.out, 18)).padEnd(24)}` +
        ` ${String(px).padStart(10)} USDC/WETH  ${q.out === 0n ? "" : `${rel === 0n ? "best" : `${rel} bps`}`}` +
        `${q.tradable ? "" : "   (not routable by this script)"}`,
    );
  }

  const route = quotes[0];
  const impact = await priceImpactBps(amountIn, route.out);
  console.log(`\n  route price impact vs marginal: ${impact} bps`);
  if (best.out > route.out) {
    const gap = ((best.out - route.out) * BPS) / route.out;
    console.log(`  NOTE: "${best.venue}" is ${gap} bps better at this size.`);
  }
}

async function cmdSwap() {
  const account = privateKeyToAccount(env("PRIVATE_KEY") as Hex);
  const walletClient = createWalletClient({ account, chain: base, transport: http(CONFIG.rpcUrl) });
  const recipient = getAddress(env("RECIPIENT", account.address));

  await verifyAddresses();

  const total = parseUnits(CONFIG.amountUsdc, 6);
  if (!Number.isInteger(CONFIG.clips) || CONFIG.clips < 1) throw new Error("CLIPS must be a positive integer.");

  const balance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`\nsigner   ${account.address}`);
  console.log(`balance  ${fmtUsdc(balance)}`);
  console.log(`order    ${fmtUsdc(total)} in ${CONFIG.clips} clip(s) -> ${recipient}`);
  if (balance < total) throw new Error(`Insufficient USDC: have ${fmtUsdc(balance)}, need ${fmtUsdc(total)}.`);

  // --- route sanity at the real size, before any approval -------------------
  const quotes = await quoteAllVenues(total);
  const route = quotes[0];
  if (route.out === 0n) throw new Error("Route quote is zero — do not trade.");
  const alternatives = quotes.filter((q) => q.tradable && q.venue !== route.venue);
  for (const alt of alternatives) {
    if (alt.out > route.out) {
      const gap = ((alt.out - route.out) * BPS) / route.out;
      console.log(`  cross-venue: ${alt.venue} better by ${gap} bps`);
      if (gap > CONFIG.crossVenueToleranceBps) {
        throw new Error(
          `${alt.venue} beats the configured route by ${gap} bps (tolerance ${CONFIG.crossVenueToleranceBps}). ` +
            `Depth has moved — re-run the venue comparison before trading. Raise CROSS_VENUE_TOLERANCE_BPS to override.`,
        );
      }
    }
  }

  const impact = await priceImpactBps(total, route.out);
  console.log(`quote    ${fmtWeth(route.out)} @ ${priceUsdcPerWeth(total, route.out).toFixed(2)} USDC/WETH`);
  console.log(`impact   ${impact} bps (full size, vs marginal price)`);
  if (impact < -CONFIG.maxImpactBps) {
    throw new Error(
      `Price impact ${impact} bps exceeds MAX_IMPACT_BPS ${CONFIG.maxImpactBps}. ` +
        `Increase CLIPS, cut size, or work the order across venues.`,
    );
  }

  if (CONFIG.dryRun) {
    console.log(`\nDRY_RUN=true — nothing sent. Set DRY_RUN=false to broadcast.`);
    return;
  }

  // --- approval -------------------------------------------------------------
  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, CL_SWAP_ROUTER],
  });
  if (allowance < total) {
    console.log(`\napprove  ${fmtUsdc(total)} to Slipstream SwapRouter ${CL_SWAP_ROUTER}`);
    const hash = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [CL_SWAP_ROUTER, total], // exact amount, not unlimited
    });
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    if (rcpt.status !== "success") throw new Error(`Approval reverted: ${hash}`);
    console.log(`         ok ${hash}`);
  }

  // --- execute clips --------------------------------------------------------
  const clipSize = total / BigInt(CONFIG.clips);
  const wethBefore = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [recipient],
  });

  for (let i = 0; i < CONFIG.clips; i++) {
    // Last clip absorbs the integer-division remainder.
    const amountIn = i === CONFIG.clips - 1 ? total - clipSize * BigInt(CONFIG.clips - 1) : clipSize;

    // Re-quote per clip: the pool has moved since the previous clip landed.
    const clipQuote = await quoteSlipstream(amountIn);
    const minOut = (clipQuote * (BPS - CONFIG.maxSlippageBps)) / BPS;
    const deadline = BigInt(Math.floor(Date.now() / 1000)) + CONFIG.deadlineSeconds;

    const params = {
      tokenIn: USDC,
      tokenOut: WETH,
      tickSpacing: CL_TICK_SPACING,
      recipient,
      deadline,
      amountIn,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: 0n,
    } as const;

    // Simulate first: catches a bad minOut, a stale deadline, or a router that
    // is not what we think it is, without spending gas on a revert.
    const { request } = await publicClient.simulateContract({
      address: CL_SWAP_ROUTER,
      abi: clRouterAbi,
      functionName: "exactInputSingle",
      args: [params],
      account,
    });

    console.log(
      `\nclip ${i + 1}/${CONFIG.clips}  ${fmtUsdc(amountIn)} -> quote ${fmtWeth(clipQuote)}, min ${fmtWeth(minOut)}`,
    );
    const hash = await walletClient.writeContract(request);
    console.log(`         sent ${hash}`);
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    if (rcpt.status !== "success") throw new Error(`Clip ${i + 1} reverted: ${hash}`);
    console.log(`         mined block ${rcpt.blockNumber}, gas ${rcpt.gasUsed}`);
  }

  const wethAfter = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [recipient],
  });
  const received = wethAfter - wethBefore;
  console.log(`\nfilled   ${fmtUsdc(total)} -> ${fmtWeth(received)}`);
  console.log(`average  ${priceUsdcPerWeth(total, received).toFixed(2)} USDC/WETH`);

  // Leave no standing allowance.
  const residual = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, CL_SWAP_ROUTER],
  });
  if (residual > 0n) {
    const hash = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [CL_SWAP_ROUTER, 0n],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`revoked  residual allowance ${fmtUsdc(residual)} (${hash})`);
  }
}

async function main() {
  const cmd = process.argv[2] ?? "quote";
  switch (cmd) {
    case "verify":
      await verifyAddresses();
      console.log("\nall addresses verified against Base mainnet.");
      break;
    case "quote":
      await cmdQuote();
      break;
    case "swap":
      await cmdSwap();
      break;
    default:
      console.error(`unknown command "${cmd}". use: verify | quote | swap`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

export {
  verifyAddresses,
  quoteSlipstream,
  quoteAllVenues,
  USDC,
  WETH,
  CL_SWAP_ROUTER,
  CL_QUOTER,
  CL_POOL_EXPECTED,
  UNIV3_SWAP_ROUTER_02,
};
