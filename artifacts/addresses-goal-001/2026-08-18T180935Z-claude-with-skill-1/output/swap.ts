/**
 * USDC -> WETH on Base mainnet, sized for treasury clips (100k+ USDC).
 *
 * Run a quote-only pass first:   DRY_RUN=1 AMOUNT_USDC=500000 npx tsx swap.ts
 * Then execute:                  PRIVATE_KEY=0x... AMOUNT_USDC=500000 npx tsx swap.ts
 *
 * The script does not trust the addresses below at runtime: it re-verifies each
 * one against the chain before anything is signed (see `preflight`). See NOTES.md
 * for what must be re-checked by hand before this touches real funds.
 */

import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ---------------------------------------------------------------------------
// Addresses. All verified on Base mainnet (chainId 8453) at block 50143847 by
// reading code + identity from each contract; see NOTES.md for the commands.
// ---------------------------------------------------------------------------

const CHAIN_ID = 8453;

/** Circle-issued *native* USDC on Base. NOT USDbC (0xd9aA...b6CA), the bridged
 *  token, which is a different address with much thinner liquidity. */
const USDC: Address = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
/** Canonical WETH on Base (OP-stack predeploy). */
const WETH: Address = getAddress("0x4200000000000000000000000000000000000006");

/** Aerodrome Slipstream = Aerodrome's concentrated-liquidity deployment.
 *  Its pools are keyed by tickSpacing, and it is reachable ONLY through this
 *  router — the Aerodrome v2 `Router` at 0xcF77...4E43 cannot see these pools. */
const SLIPSTREAM_ROUTER: Address = getAddress("0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5");
const SLIPSTREAM_FACTORY: Address = getAddress("0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A");
const SLIPSTREAM_QUOTER: Address = getAddress("0x254cF9E1E6e233aa1AC962CB9b05b2cfeAaE15b0");

/** Uniswap v3 on Base: SwapRouter02 + QuoterV2. Kept as a live competitor so
 *  the venue decision is made from numbers on the day, not from this comment. */
const UNIV3_ROUTER: Address = getAddress("0x2626664c2603336E57B271c5C0b26F421741e481");
const UNIV3_FACTORY: Address = getAddress("0x33128a8fC17869897dcE68Ed026d694621f6FDfD");
const UNIV3_QUOTER: Address = getAddress("0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a");

/** Candidate pools. Tiers that are dead today still get quoted — a dead tier
 *  simply loses on the number, which is cheaper than maintaining a hardcode. */
const SLIPSTREAM_TICK_SPACINGS = [1, 50, 100, 200, 2000] as const;
const UNIV3_FEE_TIERS = [100, 500, 3000, 10000] as const;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC_URL = process.env.RPC_URL ?? "https://mainnet.base.org";
const AMOUNT_USDC = process.env.AMOUNT_USDC ?? "500000";
/** Slippage tolerance applied to the quote to derive amountOutMinimum. */
const SLIPPAGE_BPS = BigInt(process.env.SLIPPAGE_BPS ?? "30");
/** Hard stop: refuse to trade if the clip moves the pool more than this against
 *  the small-clip reference price. Catches "we are the only liquidity" days. */
const MAX_PRICE_IMPACT_BPS = BigInt(process.env.MAX_PRICE_IMPACT_BPS ?? "100");
/** Size of the reference clip used to establish an unimpacted mid price. */
const REFERENCE_USDC = "1000";
const DEADLINE_SECONDS = BigInt(process.env.DEADLINE_SECONDS ?? "120");
const DRY_RUN = process.env.DRY_RUN === "1";
/** Quoting a full-size clip walks a lot of ticks; 10s (viem's default) is not
 *  always enough on a busy or forked endpoint. */
const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS ?? "30000");

const BPS = 10_000n;

// ---------------------------------------------------------------------------
// ABIs (only the fragments actually used)
// ---------------------------------------------------------------------------

const erc20Abi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

/** Both quoters are `nonpayable` on-chain (they revert-and-decode internally).
 *  They are declared `view` here purely so viem will `eth_call` them; that is
 *  exactly how the on-chain contract is meant to be used off-chain. */
const slipstreamQuoterAbi = [
  {
    type: "function", name: "quoteExactInputSingle", stateMutability: "view",
    inputs: [{
      type: "tuple", name: "params", components: [
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "amountIn", type: "uint256" },
        { name: "tickSpacing", type: "int24" },
        { name: "sqrtPriceLimitX96", type: "uint160" },
      ],
    }],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const univ3QuoterAbi = [
  {
    type: "function", name: "quoteExactInputSingle", stateMutability: "view",
    inputs: [{
      type: "tuple", name: "params", components: [
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "amountIn", type: "uint256" },
        { name: "fee", type: "uint24" },
        { name: "sqrtPriceLimitX96", type: "uint160" },
      ],
    }],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

/** Slipstream's SwapRouter keeps the v3 `deadline` field and swaps `fee` for
 *  `tickSpacing`. Uniswap's SwapRouter02 dropped `deadline` from the struct.
 *  The two structs are NOT interchangeable. */
const slipstreamRouterAbi = [
  {
    type: "function", name: "exactInputSingle", stateMutability: "payable",
    inputs: [{
      type: "tuple", name: "params", components: [
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "tickSpacing", type: "int24" },
        { name: "recipient", type: "address" },
        { name: "deadline", type: "uint256" },
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMinimum", type: "uint256" },
        { name: "sqrtPriceLimitX96", type: "uint160" },
      ],
    }],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "WETH9", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const univ3RouterAbi = [
  {
    type: "function", name: "exactInputSingle", stateMutability: "payable",
    inputs: [{
      type: "tuple", name: "params", components: [
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "fee", type: "uint24" },
        { name: "recipient", type: "address" },
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMinimum", type: "uint256" },
        { name: "sqrtPriceLimitX96", type: "uint160" },
      ],
    }],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "WETH9", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const factoryAbi = [
  { type: "function", name: "getPool", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "int24" }], outputs: [{ type: "address" }] },
] as const;

const univ3FactoryAbi = [
  { type: "function", name: "getPool", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }], outputs: [{ type: "address" }] },
] as const;

// ---------------------------------------------------------------------------

// Public RPCs rate-limit hard and one run makes ~20 reads, so JSON-RPC batching
// is on. Multicall3 aggregation is deliberately NOT used: a full-size quote walks
// a lot of ticks, and nine of them in one aggregate3 blows past the node's
// eth_call gas cap and comes back as "no pool could fill", which looks like
// missing liquidity rather than a config problem.
const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL, { batch: true, retryCount: 5, retryDelay: 300, timeout: RPC_TIMEOUT_MS }),
});

type Venue = "slipstream" | "univ3";

interface Route {
  venue: Venue;
  /** tickSpacing for Slipstream, fee for Uniswap v3. */
  key: number;
  pool: Address;
  amountOut: bigint;
}

function fail(message: string): never {
  console.error(`\nABORT: ${message}\n`);
  process.exit(1);
  throw new Error(message); // unreachable; keeps the `never` return type honest
}

/**
 * Re-verify every address against the chain we are actually connected to.
 * A wrong address rarely reverts — it reads zero or fills at a terrible price —
 * so these checks run before anything is signed, every run.
 */
async function preflight() {
  const chainId = await publicClient.getChainId();
  if (chainId !== CHAIN_ID) fail(`RPC is on chain ${chainId}, expected Base (${CHAIN_ID}). Addresses in this file are Base-only.`);

  const [usdcSymbol, usdcDecimals, wethSymbol, wethDecimals] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "decimals" }),
  ]);
  if (usdcSymbol !== "USDC") fail(`token at ${USDC} reports symbol "${usdcSymbol}", expected USDC (USDbC is a different token).`);
  if (usdcDecimals !== 6) fail(`USDC decimals ${usdcDecimals}, expected 6.`);
  if (wethSymbol !== "WETH") fail(`token at ${WETH} reports symbol "${wethSymbol}", expected WETH.`);
  if (wethDecimals !== 18) fail(`WETH decimals ${wethDecimals}, expected 18.`);

  // Each router/quoter must point at the factory we think it does. This is what
  // catches "right protocol, wrong deployment" — a v2-style router or a stale
  // quoter answers happily but reaches an entirely different set of pools.
  const [slipRouterFactory, slipQuoterFactory, uniRouterFactory, uniQuoterFactory] = await Promise.all([
    publicClient.readContract({ address: SLIPSTREAM_ROUTER, abi: slipstreamRouterAbi, functionName: "factory" }),
    publicClient.readContract({ address: SLIPSTREAM_QUOTER, abi: slipstreamQuoterAbi, functionName: "factory" }),
    publicClient.readContract({ address: UNIV3_ROUTER, abi: univ3RouterAbi, functionName: "factory" }),
    publicClient.readContract({ address: UNIV3_QUOTER, abi: univ3QuoterAbi, functionName: "factory" }),
  ]);
  if (getAddress(slipRouterFactory) !== SLIPSTREAM_FACTORY) fail(`Slipstream router factory() = ${slipRouterFactory}, expected ${SLIPSTREAM_FACTORY}.`);
  if (getAddress(slipQuoterFactory) !== SLIPSTREAM_FACTORY) fail(`Slipstream quoter factory() = ${slipQuoterFactory}, expected ${SLIPSTREAM_FACTORY}.`);
  if (getAddress(uniRouterFactory) !== UNIV3_FACTORY) fail(`Uniswap router factory() = ${uniRouterFactory}, expected ${UNIV3_FACTORY}.`);
  if (getAddress(uniQuoterFactory) !== UNIV3_FACTORY) fail(`Uniswap quoter factory() = ${uniQuoterFactory}, expected ${UNIV3_FACTORY}.`);

  console.log(`preflight ok  chain=${chainId}  ${usdcSymbol}/${wethSymbol}  routers match their factories`);
}

/** Quote `amountIn` USDC across every candidate pool on both venues. */
async function quoteAll(amountIn: bigint): Promise<Route[]> {
  const slipstream = await Promise.all(
    SLIPSTREAM_TICK_SPACINGS.map(async (tickSpacing): Promise<Route | null> => {
      const pool = await publicClient.readContract({
        address: SLIPSTREAM_FACTORY, abi: factoryAbi, functionName: "getPool", args: [USDC, WETH, tickSpacing],
      });
      if (pool === "0x0000000000000000000000000000000000000000") return null;
      try {
        const [amountOut] = await publicClient.readContract({
          address: SLIPSTREAM_QUOTER, abi: slipstreamQuoterAbi, functionName: "quoteExactInputSingle",
          args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing, sqrtPriceLimitX96: 0n }],
        });
        return { venue: "slipstream", key: tickSpacing, pool, amountOut };
      } catch (err) {
        if (isPoolRevert(err)) return null; // pool exists but cannot fill this clip
        throw new Error(`quoting slipstream ts=${tickSpacing} failed (not a revert): ${err instanceof Error ? err.message : String(err)}`);
      }
    }),
  );

  const univ3 = await Promise.all(
    UNIV3_FEE_TIERS.map(async (fee): Promise<Route | null> => {
      const pool = await publicClient.readContract({
        address: UNIV3_FACTORY, abi: univ3FactoryAbi, functionName: "getPool", args: [USDC, WETH, fee],
      });
      if (pool === "0x0000000000000000000000000000000000000000") return null;
      try {
        const [amountOut] = await publicClient.readContract({
          address: UNIV3_QUOTER, abi: univ3QuoterAbi, functionName: "quoteExactInputSingle",
          args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee, sqrtPriceLimitX96: 0n }],
        });
        return { venue: "univ3", key: fee, pool, amountOut };
      } catch (err) {
        if (isPoolRevert(err)) return null;
        throw new Error(`quoting univ3 fee=${fee} failed (not a revert): ${err instanceof Error ? err.message : String(err)}`);
      }
    }),
  );

  return [...slipstream, ...univ3].filter((r): r is Route => r !== null && r.amountOut > 0n);
}

/**
 * A quoter revert means "this pool cannot fill this clip" — that is information,
 * and the route is legitimately dropped. Anything else (rate limit, timeout,
 * flaky endpoint) is NOT information: swallowing it silently drops a venue from
 * the comparison and routes the clip to a worse pool that happened to answer.
 * Observed for real on a rate-limited endpoint, where the best venue vanished
 * from the table and the trade went out 25 bps worse. So: only reverts are soft.
 */
function isPoolRevert(err: unknown): boolean {
  if (!(err instanceof BaseError)) return false;
  if (err.walk((e) => e instanceof ContractFunctionRevertedError)) return true;
  return /execution reverted/i.test(`${err.shortMessage ?? ""} ${err.details ?? ""}`);
}

function label(r: Route) {
  return r.venue === "slipstream" ? `slipstream ts=${r.key}` : `univ3 fee=${r.key}`;
}

async function main() {
  await preflight();

  const amountIn = parseUnits(AMOUNT_USDC, 6);
  const referenceIn = parseUnits(REFERENCE_USDC, 6);

  // A small clip on the best pool gives an essentially unimpacted price. It is
  // the yardstick for whether the real clip is being filled sanely.
  const referenceRoutes = await quoteAll(referenceIn);
  if (referenceRoutes.length === 0) fail("no pool could quote the reference clip — check RPC and addresses.");
  const bestReference = referenceRoutes.reduce((a, b) => (b.amountOut > a.amountOut ? b : a));

  const routes = await quoteAll(amountIn);
  if (routes.length === 0) fail(`no pool could fill ${AMOUNT_USDC} USDC.`);
  const best = routes.reduce((a, b) => (b.amountOut > a.amountOut ? b : a));

  // Scale the reference fill up to the real clip to get the zero-impact target.
  const idealOut = (bestReference.amountOut * amountIn) / referenceIn;

  console.log(`\nquotes for ${AMOUNT_USDC} USDC -> WETH  (block ${await publicClient.getBlockNumber()})`);
  for (const r of routes.sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1))) {
    const impactBps = ((idealOut - r.amountOut) * BPS) / idealOut;
    console.log(`  ${label(r).padEnd(20)} ${formatUnits(r.amountOut, 18).padStart(24)} WETH   ${impactBps >= 0n ? "-" : "+"}${(impactBps < 0n ? -impactBps : impactBps).toString().padStart(5)} bps   pool ${r.pool}`);
  }

  const impactBps = ((idealOut - best.amountOut) * BPS) / idealOut;
  console.log(`\nchosen: ${label(best)}  pool ${best.pool}`);
  console.log(`  expected out    ${formatUnits(best.amountOut, 18)} WETH`);
  console.log(`  price impact    ${impactBps} bps (limit ${MAX_PRICE_IMPACT_BPS})`);

  if (impactBps > MAX_PRICE_IMPACT_BPS) {
    fail(`price impact ${impactBps} bps exceeds MAX_PRICE_IMPACT_BPS=${MAX_PRICE_IMPACT_BPS}. Split the clip, wait, or raise the limit deliberately.`);
  }

  const amountOutMinimum = (best.amountOut * (BPS - SLIPPAGE_BPS)) / BPS;
  console.log(`  amountOutMinimum ${formatUnits(amountOutMinimum, 18)} WETH (slippage ${SLIPPAGE_BPS} bps)`);

  if (DRY_RUN) {
    console.log("\nDRY_RUN=1 — nothing signed.");
    return;
  }

  const pk = process.env.PRIVATE_KEY as Hex | undefined;
  if (!pk) fail("PRIVATE_KEY is not set (use DRY_RUN=1 to quote only).");
  const account = privateKeyToAccount(pk);
  const recipient = (process.env.RECIPIENT ? getAddress(process.env.RECIPIENT) : account.address) as Address;
  const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL, { retryCount: 3, timeout: RPC_TIMEOUT_MS }) });
  const router = best.venue === "slipstream" ? SLIPSTREAM_ROUTER : UNIV3_ROUTER;

  const usdcBalance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
  if (usdcBalance < amountIn) fail(`account ${account.address} holds ${formatUnits(usdcBalance, 6)} USDC, needs ${AMOUNT_USDC}.`);

  // Approve exactly this clip to exactly the router we are about to use. No
  // infinite approvals: a treasury key should never leave standing allowances.
  const allowance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [account.address, router] });
  if (allowance < amountIn) {
    console.log(`\napproving ${AMOUNT_USDC} USDC to ${router} ...`);
    const approveHash = await walletClient.writeContract({ address: USDC, abi: erc20Abi, functionName: "approve", args: [router, amountIn] });
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    if (approveReceipt.status !== "success") fail(`approve reverted (${approveHash}).`);
    console.log(`  approved in ${approveHash}`);
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECONDS;
  const wethBefore = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [recipient] });

  console.log(`\nswapping via ${label(best)} ...`);
  let hash: Hex;
  if (best.venue === "slipstream") {
    const { request } = await publicClient.simulateContract({
      account, address: SLIPSTREAM_ROUTER, abi: slipstreamRouterAbi, functionName: "exactInputSingle",
      args: [{
        tokenIn: USDC, tokenOut: WETH, tickSpacing: best.key, recipient,
        deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n,
      }],
    });
    hash = await walletClient.writeContract(request);
  } else {
    const { request } = await publicClient.simulateContract({
      account, address: UNIV3_ROUTER, abi: univ3RouterAbi, functionName: "exactInputSingle",
      args: [{
        tokenIn: USDC, tokenOut: WETH, fee: best.key, recipient,
        amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n,
      }],
    });
    hash = await walletClient.writeContract(request);
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") fail(`swap reverted (${hash}).`);

  const wethAfter = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [recipient] });
  const received = wethAfter - wethBefore;
  const filledBps = ((idealOut - received) * BPS) / idealOut;

  console.log(`\nfilled  tx ${hash}`);
  console.log(`  received  ${formatUnits(received, 18)} WETH to ${recipient}`);
  console.log(`  vs quote  ${formatUnits(best.amountOut, 18)} WETH`);
  console.log(`  all-in    ${filledBps} bps vs unimpacted mid`);
  if (received < amountOutMinimum) fail(`received less than amountOutMinimum — investigate before trading again.`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
