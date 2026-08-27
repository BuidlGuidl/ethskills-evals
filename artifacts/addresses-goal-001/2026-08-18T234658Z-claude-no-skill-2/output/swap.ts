#!/usr/bin/env tsx
/**
 * swap.ts — USDC -> WETH on Base mainnet (chainId 8453), sized for a treasury desk.
 *
 * What it does, in order:
 *   1. Preflight: chain id, token metadata, balances, gas, Chainlink ETH/USD freshness.
 *   2. Quote the trade on every liquid USDC/WETH venue on Base (Uniswap v3 fee tiers +
 *      Aerodrome Slipstream tick spacings) and pick the best single venue or the best
 *      two-venue split.
 *   3. Sanity-check the quote against the Chainlink oracle so a manipulated or thin pool
 *      can never be routed into silently.
 *   4. Approve exactly what each leg needs, simulate, then send, one leg at a time.
 *   5. Optionally slice the parent order over time, re-quoting before every slice.
 *
 * Run:
 *   DRY_RUN=true  RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 npx tsx swap.ts
 *   DRY_RUN=false RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 npx tsx swap.ts
 *
 * Read NOTES.md before running this with real funds.
 */
import {
  BaseError,
  ContractFunctionExecutionError,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  HttpRequestError,
  keccak256,
  pad,
  parseAbi,
  parseUnits,
  TimeoutError,
  toHex,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ---------------------------------------------------------------------------
// Base mainnet addresses.
//
// Each one was verified by reading the contract on Base mainnet rather than
// copied from a docs page (see NOTES.md "Address provenance"): tokens answer
// symbol()/decimals(), routers and quoters point back at their own
// factory()/poolManager(), the feed answers description() == "ETH / USD".
// The token facts are re-asserted at runtime in preflight() below.
// ---------------------------------------------------------------------------

/** Circle-issued native USDC on Base, 6 decimals. NOT bridged USDbC. */
const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
/** Bridged USDbC. Listed only so nobody "corrects" USDC above into this. */
const USDbC_DO_NOT_USE: Address = "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA";
/** Canonical WETH9 predeploy on Base, 18 decimals. */
const WETH: Address = "0x4200000000000000000000000000000000000006";

/** Uniswap v3: SwapRouter02 / QuoterV2 / factory. */
const UNIV3_SWAP_ROUTER_02: Address = "0x2626664c2603336E57B271c5C0b26F421741e481";
const UNIV3_QUOTER_V2: Address = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const UNIV3_FACTORY: Address = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";

/** Aerodrome Slipstream (concentrated liquidity): router / quoter / factory. */
const SLIPSTREAM_SWAP_ROUTER: Address = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
const SLIPSTREAM_QUOTER_V2: Address = "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0";
const SLIPSTREAM_CL_FACTORY: Address = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";

/** Chainlink ETH/USD on Base, 8 decimals. Independent price reference. */
const CHAINLINK_ETH_USD: Address = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";

const BASE_CHAIN_ID = 8453;
const USDC_DECIMALS = 6;
const WETH_DECIMALS = 18;
const BPS = 10_000n;

// ---------------------------------------------------------------------------
// ABIs (minimal, hand-written — no artifacts to drift out of date)
// ---------------------------------------------------------------------------

const univ3QuoterAbi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const univ3RouterAbi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

const slipstreamQuoterAbi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; int24 tickSpacing; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const slipstreamRouterAbi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; int24 tickSpacing; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
]);

const univ3FactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);

const slipstreamFactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, int24 tickSpacing) view returns (address pool)",
]);

const chainlinkAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

// ---------------------------------------------------------------------------
// Venues. Every USDC/WETH pool on Base worth quoting for institutional size.
// The script quotes all of them each time; it never assumes which one is deepest.
// ---------------------------------------------------------------------------

type Venue =
  | { kind: "univ3"; label: string; fee: number }
  | { kind: "slipstream"; label: string; tickSpacing: number };

const VENUES: Venue[] = [
  { kind: "univ3", label: "UniV3 0.01%", fee: 100 },
  { kind: "univ3", label: "UniV3 0.05%", fee: 500 },
  { kind: "univ3", label: "UniV3 0.30%", fee: 3000 },
  { kind: "slipstream", label: "Slipstream ts=1", tickSpacing: 1 },
  { kind: "slipstream", label: "Slipstream ts=50", tickSpacing: 50 },
  { kind: "slipstream", label: "Slipstream ts=100", tickSpacing: 100 },
  { kind: "slipstream", label: "Slipstream ts=200", tickSpacing: 200 },
];

/**
 * Optional desk override: ONLY_VENUES="UniV3 0.05,Slipstream ts=100" restricts
 * routing to matching labels. Empty/unset means "quote everything".
 */
const venueFilter = (process.env.ONLY_VENUES ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ACTIVE_VENUES = venueFilter.length
  ? VENUES.filter((v) => venueFilter.some((f) => v.label.toLowerCase().includes(f)))
  : VENUES;

const routerFor = (v: Venue): Address =>
  v.kind === "univ3" ? UNIV3_SWAP_ROUTER_02 : SLIPSTREAM_SWAP_ROUTER;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`missing required env var ${name}`);
  return v;
}

const CONFIG = {
  rpcUrl: env("RPC_URL"),
  privateKey: env("PRIVATE_KEY") as Hex,
  /** Total USDC to sell, in human units, e.g. "500000". */
  amountUsdc: env("AMOUNT_USDC"),
  /** Where the WETH lands. Defaults to the signer. */
  recipient: process.env.RECIPIENT as Address | undefined,
  /** Anything other than "false" keeps the script read-only. */
  dryRun: env("DRY_RUN", "true") !== "false",
  /** Slippage tolerance per leg, applied to that leg's own fresh quote. */
  maxSlippageBps: BigInt(env("MAX_SLIPPAGE_BPS", "30")),
  /** Reject the whole plan if the pools price the trade this far below Chainlink. */
  maxOracleDeviationBps: BigInt(env("MAX_ORACLE_DEVIATION_BPS", "100")),
  /** Reject if the Chainlink answer is older than this (feed heartbeat is ~20 min). */
  maxOracleAgeSeconds: BigInt(env("MAX_ORACLE_AGE_SECONDS", "3600")),
  /** Split the parent order into this many child orders sent over time. */
  slices: Number(env("SLICES", "1")),
  /** Wait between slices so arbitrage can refill the pools. */
  sliceDelaySeconds: Number(env("SLICE_DELAY_SECONDS", "60")),
  /** Granularity of the two-venue split search: 10 => try 10/90, 20/80, ... */
  splitSteps: Number(env("SPLIT_STEPS", "10")),
  /** Only split across two venues if it beats the best single venue by this much. */
  splitMinGainBps: BigInt(env("SPLIT_MIN_GAIN_BPS", "2")),
  /** Deadline stamped into every swap. */
  deadlineSeconds: BigInt(env("DEADLINE_SECONDS", "180")),
  /** Refuse to start with less gas than this in the signer. */
  minGasEth: env("MIN_GAS_ETH", "0.003"),
  /** Confirmations to wait for before treating a leg as filled. */
  confirmations: Number(env("CONFIRMATIONS", "1")),
  /** Deep concentrated-liquidity quotes are slow; give the RPC room. */
  rpcTimeoutMs: Number(env("RPC_TIMEOUT_MS", "60000")),
  /** How long to wait for a sent transaction to confirm. */
  receiptTimeoutMs: Number(env("RECEIPT_TIMEOUT_MS", "300000")),
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const usdc = (n: bigint) => `${formatUnits(n, USDC_DECIMALS)} USDC`;
const weth = (n: bigint) => `${formatUnits(n, WETH_DECIMALS)} WETH`;
const bps = (n: bigint) => `${(Number(n) / 100).toFixed(2)}%`;

/** USDC per WETH implied by an (amountIn, amountOut) pair, as a display string. */
function impliedPrice(amountIn: bigint, amountOut: bigint): string {
  if (amountOut === 0n) return "n/a";
  const price = (amountIn * 10n ** BigInt(WETH_DECIMALS) * 10n ** 4n) / amountOut;
  return formatUnits(price, USDC_DECIMALS + 4);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const describeError = (err: unknown): string =>
  err instanceof BaseError
    ? err.shortMessage
    : err instanceof Error
      ? err.message
      : String(err);

// ---------------------------------------------------------------------------
// Quoting
// ---------------------------------------------------------------------------

type Quote = { venue: Venue; amountIn: bigint; amountOut: bigint; gasEstimate: bigint };

/**
 * A reverted quote means "no such pool" or "not enough liquidity" — that venue
 * is simply out of the running. Anything else (RPC timeout, transport error) is
 * fatal: a silently dropped venue can route the order into a worse pool, which
 * on this size is real money. Deep tick-crossing quotes are slow enough that
 * viem's default 10s HTTP timeout would otherwise mask the deepest pool.
 */
function isQuoteRevert(err: unknown): boolean {
  if (!(err instanceof BaseError)) return false;
  if (err.walk((e) => e instanceof TimeoutError || e instanceof HttpRequestError)) return false;
  return err instanceof ContractFunctionExecutionError;
}

/**
 * Quoter calls are non-view (they mutate then revert), so they must be
 * eth_call'd via simulate rather than read. A revert means "no such pool" or
 * "not enough liquidity for this size" — both are just a skipped venue.
 */
async function quote(
  client: PublicClient,
  venue: Venue,
  amountIn: bigint,
): Promise<Quote | null> {
  try {
    if (venue.kind === "univ3") {
      const { result } = await client.simulateContract({
        address: UNIV3_QUOTER_V2,
        abi: univ3QuoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: USDC,
            tokenOut: WETH,
            amountIn,
            fee: venue.fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      return { venue, amountIn, amountOut: result[0], gasEstimate: result[3] };
    }
    const { result } = await client.simulateContract({
      address: SLIPSTREAM_QUOTER_V2,
      abi: slipstreamQuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: USDC,
          tokenOut: WETH,
          amountIn,
          tickSpacing: venue.tickSpacing,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    return { venue, amountIn, amountOut: result[0], gasEstimate: result[3] };
  } catch (err) {
    if (!isQuoteRevert(err)) {
      throw new Error(
        `could not quote ${venue.label}: ${describeError(err)}\n  This is an RPC failure, not a thin pool. Refusing to route without a full picture.`,
      );
    }
    return null;
  }
}

/** Confirm every configured venue actually has a deployed pool for USDC/WETH. */
async function resolvePools(client: PublicClient): Promise<void> {
  for (const venue of ACTIVE_VENUES) {
    const pool =
      venue.kind === "univ3"
        ? await client.readContract({
            address: UNIV3_FACTORY,
            abi: univ3FactoryAbi,
            functionName: "getPool",
            args: [USDC, WETH, venue.fee],
          })
        : await client.readContract({
            address: SLIPSTREAM_CL_FACTORY,
            abi: slipstreamFactoryAbi,
            functionName: "getPool",
            args: [USDC, WETH, venue.tickSpacing],
          });
    console.log(`  ${venue.label.padEnd(18)} pool ${pool}`);
  }
}

type Leg = { venue: Venue; amountIn: bigint; quotedOut: bigint };

/**
 * Route one slice. Quotes every venue at full size, then grid-searches a split
 * between the best two. Splitting is only worth the second transaction if it
 * measurably beats the single-venue fill, hence splitMinGainBps.
 */
async function planRoute(client: PublicClient, amountIn: bigint): Promise<Leg[]> {
  const quotes: Quote[] = [];
  for (const venue of ACTIVE_VENUES) {
    const q = await quote(client, venue, amountIn);
    if (q && q.amountOut > 0n) quotes.push(q);
    console.log(
      `  ${venue.label.padEnd(18)} ${
        q && q.amountOut > 0n
          ? `${weth(q.amountOut)}  @ ${impliedPrice(amountIn, q.amountOut)} USDC/WETH`
          : "no quote (pool missing or too thin)"
      }`,
    );
  }
  if (quotes.length === 0) throw new Error("no venue could quote this size");

  quotes.sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1));
  const [best, second] = quotes;
  if (!second || CONFIG.splitSteps < 2) {
    return [{ venue: best.venue, amountIn, quotedOut: best.amountOut }];
  }

  let bestPlan: Leg[] = [{ venue: best.venue, amountIn, quotedOut: best.amountOut }];
  let bestOut = best.amountOut;
  const steps = BigInt(CONFIG.splitSteps);
  for (let i = 1n; i < steps; i++) {
    const a = (amountIn * i) / steps;
    const b = amountIn - a;
    const [qa, qb] = [
      await quote(client, best.venue, a),
      await quote(client, second.venue, b),
    ];
    if (!qa || !qb) continue;
    const total = qa.amountOut + qb.amountOut;
    if (total > bestOut) {
      bestOut = total;
      bestPlan = [
        { venue: best.venue, amountIn: a, quotedOut: qa.amountOut },
        { venue: second.venue, amountIn: b, quotedOut: qb.amountOut },
      ];
    }
  }

  const gain = bestOut - best.amountOut;
  if (bestPlan.length > 1 && gain * BPS < best.amountOut * CONFIG.splitMinGainBps) {
    console.log(
      `  split would add only ${weth(gain)}; below SPLIT_MIN_GAIN_BPS, using single venue`,
    );
    return [{ venue: best.venue, amountIn, quotedOut: best.amountOut }];
  }
  return bestPlan;
}

// ---------------------------------------------------------------------------
// Oracle guard
// ---------------------------------------------------------------------------

/** WETH the trade *should* return at the Chainlink mid, ignoring fees/impact. */
async function oracleFairOut(client: PublicClient, amountIn: bigint): Promise<bigint> {
  const [description, feedDecimals, round] = await Promise.all([
    client.readContract({ address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "description" }),
    client.readContract({ address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "decimals" }),
    client.readContract({ address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "latestRoundData" }),
  ]);
  if (description !== "ETH / USD") {
    throw new Error(`unexpected Chainlink feed at ${CHAINLINK_ETH_USD}: "${description}"`);
  }
  const [, answer, , updatedAt] = round;
  if (answer <= 0n) throw new Error("Chainlink returned a non-positive price");

  const now = BigInt(Math.floor(Date.now() / 1000));
  const age = now > updatedAt ? now - updatedAt : 0n;
  if (age > CONFIG.maxOracleAgeSeconds) {
    throw new Error(
      `Chainlink ETH/USD is ${age}s old (limit ${CONFIG.maxOracleAgeSeconds}s) — refusing to trade blind`,
    );
  }
  const price = Number(formatUnits(answer, feedDecimals));
  console.log(`  Chainlink ETH/USD: ${price.toFixed(2)} (age ${age}s)`);

  // amountIn is 6dp USD; answer is `feedDecimals`dp USD/ETH; result is 18dp ETH.
  return (amountIn * 10n ** BigInt(feedDecimals) * 10n ** BigInt(WETH_DECIMALS)) /
    (answer * 10n ** BigInt(USDC_DECIMALS));
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

async function preflight(client: PublicClient, account: Address, amountIn: bigint) {
  const chainId = await client.getChainId();
  if (chainId !== BASE_CHAIN_ID) {
    throw new Error(`RPC_URL points at chain ${chainId}, expected Base ${BASE_CHAIN_ID}`);
  }

  // Assert the hardcoded token addresses really are the tokens we think they
  // are. Cheap, and it catches a wrong-chain RPC or a typo'd constant.
  const [usdcSymbol, usdcDecimals, wethSymbol, wethDecimals] = await Promise.all([
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: WETH, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: WETH, abi: erc20Abi, functionName: "decimals" }),
  ]);
  if (usdcSymbol !== "USDC" || usdcDecimals !== USDC_DECIMALS) {
    throw new Error(`${USDC} is not 6-decimal USDC (got ${usdcSymbol}/${usdcDecimals})`);
  }
  if (wethSymbol !== "WETH" || wethDecimals !== WETH_DECIMALS) {
    throw new Error(`${WETH} is not 18-decimal WETH (got ${wethSymbol}/${wethDecimals})`);
  }
  if ((USDC as string).toLowerCase() === USDbC_DO_NOT_USE.toLowerCase()) {
    throw new Error("USDC constant was replaced with bridged USDbC");
  }

  const [usdcBalance, ethBalance] = await Promise.all([
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
    client.getBalance({ address: account }),
  ]);
  console.log(`  signer:   ${account}`);
  console.log(`  balances: ${usdc(usdcBalance)} / ${formatUnits(ethBalance, 18)} ETH`);
  if (usdcBalance < amountIn) {
    throw new Error(`need ${usdc(amountIn)}, signer holds ${usdc(usdcBalance)}`);
  }
  const minGas = parseUnits(CONFIG.minGasEth, 18);
  if (ethBalance < minGas) {
    throw new Error(`signer has ${formatUnits(ethBalance, 18)} ETH, needs at least ${CONFIG.minGasEth} for gas`);
  }
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/**
 * Wait for a receipt, and if the wait times out say so in terms an operator can
 * act on: the transaction may still be in flight, so re-running the script
 * blind would double-spend the slice.
 */
async function awaitReceipt(client: PublicClient, hash: Hex, what: string) {
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      confirmations: CONFIG.confirmations,
      timeout: CONFIG.receiptTimeoutMs,
    });
    if (receipt.status !== "success") throw new Error(`${what} reverted: ${hash}`);
    return receipt;
  } catch (err) {
    if (err instanceof Error && err.message.includes("reverted")) throw err;
    throw new Error(
      `${what} ${hash} was sent but not confirmed within ${
        CONFIG.receiptTimeoutMs / 1000
      }s (${describeError(err)}).\n  It may still land. Check the hash on chain before re-running — ` +
        `re-running now could sell this slice twice.`,
    );
  }
}

/** Set the router's USDC allowance to exactly what this leg needs, if short. */
async function ensureAllowance(
  publicClient: PublicClient,
  wallet: WalletClient,
  account: Address,
  spender: Address,
  amount: bigint,
): Promise<boolean> {
  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, spender],
  });
  if (allowance >= amount) return true;

  console.log(`  approving ${usdc(amount)} to ${spender}`);
  if (CONFIG.dryRun) {
    // Without the allowance in place the swap itself cannot be simulated, so a
    // dry run on a fresh account validates the route but not the swap calldata.
    console.log("  [dry run] skipping approval");
    return false;
  }
  const { request } = await publicClient.simulateContract({
    account,
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
  const hash = await wallet.writeContract(request);
  await awaitReceipt(publicClient, hash, "approval");
  console.log(`  approved in ${hash}`);
  return true;
}

/**
 * USDC (FiatTokenV2_2) keeps allowances in `mapping(owner => mapping(spender =>
 * uint256))` at storage slot 10. Used only to fabricate an allowance inside a
 * dry-run eth_call, and only after the layout is confirmed against the real
 * allowance() value — an implementation upgrade could move it.
 */
async function syntheticAllowanceOverride(
  client: PublicClient,
  owner: Address,
  spender: Address,
  amount: bigint,
) {
  const inner = keccak256(
    encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [owner, 10n]),
  );
  const slot = keccak256(
    encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [spender, inner]),
  );
  const [raw, actual] = await Promise.all([
    client.getStorageAt({ address: USDC, slot }),
    client.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, spender],
    }),
  ]);
  if (raw === undefined || BigInt(raw) !== actual) return undefined;
  return [
    { address: USDC, stateDiff: [{ slot, value: pad(toHex(amount)) }] },
  ] as const;
}

/**
 * A dry run should still push the exact swap calldata through eth_call — that is
 * what catches a bad router argument before it costs anything. If the router has
 * no allowance yet (the normal case on a first run) the allowance is faked in the
 * call's state override so the simulation is still meaningful.
 */
async function dryRunSimulate(
  client: PublicClient,
  call: Parameters<PublicClient["simulateContract"]>[0],
  ctx: { owner: Address; spender: Address; amountIn: bigint; approved: boolean },
) {
  let stateOverride;
  if (!ctx.approved) {
    stateOverride = await syntheticAllowanceOverride(
      client,
      ctx.owner,
      ctx.spender,
      ctx.amountIn,
    );
    if (!stateOverride) {
      console.log(
        "  [dry run] swap not simulated: no allowance, and USDC storage layout did not match",
      );
      return;
    }
    console.log("  [dry run] simulating against a synthetic USDC allowance");
  }
  const { result } = await client.simulateContract({ ...call, stateOverride } as never);
  // exactInputSingle returns amountOut; multicall returns raw bytes[].
  console.log(
    `  [dry run] swap simulated ok${typeof result === "bigint" ? `, would receive ${weth(result)}` : ""}`,
  );
}

/** Send one leg and return the WETH actually received, measured by balance diff. */
async function executeLeg(
  publicClient: PublicClient,
  wallet: WalletClient,
  account: Address,
  recipient: Address,
  leg: Leg,
  minOut: bigint,
): Promise<bigint> {
  const router = routerFor(leg.venue);
  const approved = await ensureAllowance(publicClient, wallet, account, router, leg.amountIn);

  const deadline = BigInt(Math.floor(Date.now() / 1000)) + CONFIG.deadlineSeconds;

  const before = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [recipient],
  });

  let hash: Hex;
  if (leg.venue.kind === "univ3") {
    // SwapRouter02's exactInputSingle has no deadline field; wrapping it in
    // multicall(deadline, data) is how Uniswap applies one.
    const call = {
      account,
      address: UNIV3_SWAP_ROUTER_02,
      abi: univ3RouterAbi,
      functionName: "multicall",
      args: [
        deadline,
        [
          encodeExactInputSingleUniV3({
            fee: leg.venue.fee,
            recipient,
            amountIn: leg.amountIn,
            amountOutMinimum: minOut,
          }),
        ],
      ],
    } as const;
    if (CONFIG.dryRun) {
      await dryRunSimulate(publicClient, call, {
        owner: account,
        spender: router,
        amountIn: leg.amountIn,
        approved,
      });
      return 0n;
    }
    const { request } = await publicClient.simulateContract(call);
    hash = await wallet.writeContract(request);
  } else {
    const call = {
      account,
      address: SLIPSTREAM_SWAP_ROUTER,
      abi: slipstreamRouterAbi,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: USDC,
          tokenOut: WETH,
          tickSpacing: leg.venue.tickSpacing,
          recipient,
          deadline,
          amountIn: leg.amountIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
    } as const;
    if (CONFIG.dryRun) {
      await dryRunSimulate(publicClient, call, {
        owner: account,
        spender: router,
        amountIn: leg.amountIn,
        approved,
      });
      return 0n;
    }
    const { request } = await publicClient.simulateContract(call);
    hash = await wallet.writeContract(request);
  }

  console.log(`  sent ${hash}`);
  const receipt = await awaitReceipt(publicClient, hash, "swap");

  const after = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [recipient],
  });
  const received = after - before;
  console.log(
    `  filled ${usdc(leg.amountIn)} -> ${weth(received)} @ ${impliedPrice(leg.amountIn, received)} USDC/WETH` +
      ` (gas ${receipt.gasUsed})`,
  );
  return received;
}

function encodeExactInputSingleUniV3(args: {
  fee: number;
  recipient: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
}): Hex {
  return encodeFunctionData({
    abi: univ3RouterAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: USDC,
        tokenOut: WETH,
        fee: args.fee,
        recipient: args.recipient,
        amountIn: args.amountIn,
        amountOutMinimum: args.amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const account = privateKeyToAccount(CONFIG.privateKey);
  const transport = http(CONFIG.rpcUrl, {
    timeout: CONFIG.rpcTimeoutMs,
    retryCount: 3,
  });
  const publicClient = createPublicClient({ chain: base, transport }) as PublicClient;
  const wallet = createWalletClient({ account, chain: base, transport });
  const recipient = CONFIG.recipient ?? account.address;

  if (ACTIVE_VENUES.length === 0) {
    throw new Error(`ONLY_VENUES="${process.env.ONLY_VENUES}" matched no venue`);
  }

  const total = parseUnits(CONFIG.amountUsdc, USDC_DECIMALS);
  if (total <= 0n) throw new Error("AMOUNT_USDC must be positive");
  if (!Number.isInteger(CONFIG.slices) || CONFIG.slices < 1) {
    throw new Error("SLICES must be a positive integer");
  }

  console.log(`\nUSDC -> WETH on Base | ${usdc(total)} | ${CONFIG.slices} slice(s) | ${
    CONFIG.dryRun ? "DRY RUN" : "LIVE"
  }`);
  console.log(`  recipient: ${recipient}`);

  console.log("\nPreflight");
  await preflight(publicClient, account.address, total);

  console.log("\nPools");
  await resolvePools(publicClient);

  let sold = 0n;
  let bought = 0n;
  let quotedTotal = 0n;

  for (let i = 0; i < CONFIG.slices; i++) {
    const sliceIn =
      i === CONFIG.slices - 1
        ? total - sold
        : total / BigInt(CONFIG.slices);

    console.log(`\nSlice ${i + 1}/${CONFIG.slices} — ${usdc(sliceIn)}`);
    console.log("Quotes");
    const plan = await planRoute(publicClient, sliceIn);
    const quoted = plan.reduce((acc, l) => acc + l.quotedOut, 0n);
    quotedTotal += quoted;

    console.log("Oracle check");
    const fair = await oracleFairOut(publicClient, sliceIn);
    const deviationBps = fair > quoted ? ((fair - quoted) * BPS) / fair : 0n;
    console.log(
      `  route quotes ${weth(quoted)} vs oracle mid ${weth(fair)} — ${bps(deviationBps)} below mid`,
    );
    if (deviationBps > CONFIG.maxOracleDeviationBps) {
      throw new Error(
        `route is ${bps(deviationBps)} below the Chainlink mid, limit is ${bps(
          CONFIG.maxOracleDeviationBps,
        )} — aborting before any funds move`,
      );
    }

    console.log("Execution");
    for (const leg of plan) {
      const minOut = (leg.quotedOut * (BPS - CONFIG.maxSlippageBps)) / BPS;
      console.log(
        `  ${leg.venue.label}: ${usdc(leg.amountIn)} -> quote ${weth(leg.quotedOut)}, min ${weth(minOut)}`,
      );
      bought += await executeLeg(publicClient, wallet, account.address, recipient, leg, minOut);
      sold += leg.amountIn;
    }

    if (i < CONFIG.slices - 1 && CONFIG.sliceDelaySeconds > 0) {
      console.log(`  waiting ${CONFIG.sliceDelaySeconds}s before the next slice`);
      await sleep(CONFIG.sliceDelaySeconds * 1000);
    }
  }

  if (CONFIG.dryRun) {
    console.log(
      `\nDry run complete: ${usdc(sold)} would route for ~${weth(quotedTotal)} ` +
        `(${impliedPrice(sold, quotedTotal)} USDC/WETH) at current quotes.`,
    );
    console.log("Nothing was sent. Set DRY_RUN=false to trade.");
    return;
  }
  console.log(`\nDone: sold ${usdc(sold)}, received ${weth(bought)}`);
  if (bought > 0n) {
    console.log(`Average fill: ${impliedPrice(sold, bought)} USDC/WETH`);
    const shortfall = quotedTotal > bought ? ((quotedTotal - bought) * BPS) / quotedTotal : 0n;
    console.log(`Realized vs quoted: ${bps(shortfall)} shortfall`);
  }
}

main().catch((err) => {
  console.error(`\nAborted: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
