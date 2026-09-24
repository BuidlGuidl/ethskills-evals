/**
 * USDC -> WETH on Base mainnet (chainId 8453) for large treasury swaps.
 *
 * Strategy (see NOTES.md):
 *   1. Quote every direct USDC/WETH pool on the deep onchain venues
 *      (Uniswap V3, Aerodrome Slipstream CL, Aerodrome v2 volatile).
 *   2. Pick the venue with the best output *right now*.
 *   3. Bound the trade against an independent reference: Chainlink ETH/USD.
 *      Refuse to trade if the quote is worse than oracle by > MAX_ORACLE_DEVIATION_BPS.
 *   4. amountOutMinimum = max(quote - SLIPPAGE_BPS, oracle - MAX_ORACLE_DEVIATION_BPS).
 *   5. Optionally split the order into CLIPS sequential swaps, re-quoting each one,
 *      so arbitrageurs can refill the pools between clips.
 *
 * Dry run by default. Set EXECUTE=true to send transactions.
 *
 * Usage:
 *   RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 CLIPS=5 npx tsx swap.ts
 *   ... EXECUTE=true npx tsx swap.ts
 */
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
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
// Addresses — Base mainnet. All verified onchain (bytecode + factory()/WETH9()
// cross-checks + function selectors present) — see NOTES.md.
// ---------------------------------------------------------------------------
const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // native Circle USDC (NOT USDbC)
const WETH: Address = "0x4200000000000000000000000000000000000006"; // OP-stack predeploy WETH9

const UNI_V3_SWAP_ROUTER02: Address = "0x2626664c2603336E57B271c5C0b26F421741e481";
const UNI_V3_QUOTER_V2: Address = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";

const AERO_CL_SWAP_ROUTER: Address = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5"; // Slipstream
const AERO_CL_QUOTER: Address = "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0"; // Slipstream QuoterV2

const AERO_V2_ROUTER: Address = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
const AERO_V2_POOL_FACTORY: Address = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";

const CHAINLINK_ETH_USD: Address = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
const CHAINLINK_SEQUENCER_UPTIME: Address = "0xBCF85224fc0756B9Fa45aA7892530B47e10b6433";

const UNI_V3_FEES = [100, 500, 3000, 10000] as const;
const AERO_CL_TICK_SPACINGS = [1, 50, 100, 200, 2000] as const;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`Missing env ${name}`);
  return v;
}

const RPC_URL = env("RPC_URL");
const PRIVATE_KEY = env("PRIVATE_KEY") as Hex;
const AMOUNT_USDC = parseUnits(env("AMOUNT_USDC"), 6);
const CLIPS = BigInt(env("CLIPS", "1"));
const CLIP_DELAY_SEC = Number(env("CLIP_DELAY_SEC", "30"));
const SLIPPAGE_BPS = BigInt(env("SLIPPAGE_BPS", "20")); // vs. live quote
const MAX_ORACLE_DEVIATION_BPS = BigInt(env("MAX_ORACLE_DEVIATION_BPS", "50")); // vs. Chainlink, incl. pool fee
const MAX_ORACLE_AGE_SEC = BigInt(env("MAX_ORACLE_AGE_SEC", "1800"));
const SEQUENCER_GRACE_SEC = 3600n;
const DEADLINE_SEC = 120n;
const EXECUTE = env("EXECUTE", "false") === "true";

if (CLIPS < 1n) throw new Error("CLIPS must be >= 1");
if (SLIPPAGE_BPS > 100n || MAX_ORACLE_DEVIATION_BPS > 300n) {
  throw new Error("Refusing: slippage/deviation limits look too loose for this size");
}

// ---------------------------------------------------------------------------
// ABIs (only what we call)
// ---------------------------------------------------------------------------
const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const chainlinkAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);

const uniQuoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

// SwapRouter02: exactInputSingle has no deadline field; deadline goes via multicall(uint256 deadline, bytes[]).
const uniRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

const clQuoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, int24 tickSpacing, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const clRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, int24 tickSpacing, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

const aeroV2RouterAbi = parseAbi([
  "struct Route { address from; address to; bool stable; address factory; }",
  "function getAmountsOut(uint256 amountIn, Route[] routes) view returns (uint256[] amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, Route[] routes, address to, uint256 deadline) returns (uint256[] amounts)",
]);

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------
type SwapCall = { router: Address; data: Hex; decodeOut: (ret: Hex) => bigint };

type Venue = {
  name: string;
  router: Address;
  quote: (amountIn: bigint) => Promise<bigint>;
  buildSwap: (amountIn: bigint, minOut: bigint, recipient: Address, deadline: bigint) => SwapCall;
};

const uniV3Venues: Venue[] = UNI_V3_FEES.map((fee) => ({
  name: `UniswapV3 fee=${fee}`,
  router: UNI_V3_SWAP_ROUTER02,
  quote: async (amountIn) => {
    const { result } = await publicClient.simulateContract({
      address: UNI_V3_QUOTER_V2,
      abi: uniQuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee, sqrtPriceLimitX96: 0n }],
    });
    return result[0];
  },
  buildSwap: (amountIn, minOut, recipient, deadline) => {
    const inner = encodeFunctionData({
      abi: uniRouterAbi,
      functionName: "exactInputSingle",
      args: [{ tokenIn: USDC, tokenOut: WETH, fee, recipient, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
    });
    return {
      router: UNI_V3_SWAP_ROUTER02,
      data: encodeFunctionData({ abi: uniRouterAbi, functionName: "multicall", args: [deadline, [inner]] }),
      decodeOut: (ret) => {
        const results = decodeFunctionResult({ abi: uniRouterAbi, functionName: "multicall", data: ret });
        return decodeFunctionResult({ abi: uniRouterAbi, functionName: "exactInputSingle", data: results[0] });
      },
    };
  },
}));

const aeroClVenues: Venue[] = AERO_CL_TICK_SPACINGS.map((tickSpacing) => ({
  name: `Aerodrome Slipstream tickSpacing=${tickSpacing}`,
  router: AERO_CL_SWAP_ROUTER,
  quote: async (amountIn) => {
    const { result } = await publicClient.simulateContract({
      address: AERO_CL_QUOTER,
      abi: clQuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing, sqrtPriceLimitX96: 0n }],
    });
    return result[0];
  },
  buildSwap: (amountIn, minOut, recipient, deadline) => ({
    router: AERO_CL_SWAP_ROUTER,
    data: encodeFunctionData({
      abi: clRouterAbi,
      functionName: "exactInputSingle",
      args: [{ tokenIn: USDC, tokenOut: WETH, tickSpacing, recipient, deadline, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
    }),
    decodeOut: (ret) => decodeFunctionResult({ abi: clRouterAbi, functionName: "exactInputSingle", data: ret }),
  }),
}));

const aeroV2Route = [{ from: USDC, to: WETH, stable: false, factory: AERO_V2_POOL_FACTORY }] as const;
const aeroV2Venue: Venue = {
  name: "Aerodrome v2 volatile",
  router: AERO_V2_ROUTER,
  quote: async (amountIn) => {
    const amounts = await publicClient.readContract({
      address: AERO_V2_ROUTER,
      abi: aeroV2RouterAbi,
      functionName: "getAmountsOut",
      args: [amountIn, aeroV2Route],
    });
    return amounts[amounts.length - 1];
  },
  buildSwap: (amountIn, minOut, recipient, deadline) => ({
    router: AERO_V2_ROUTER,
    data: encodeFunctionData({
      abi: aeroV2RouterAbi,
      functionName: "swapExactTokensForTokens",
      args: [amountIn, minOut, aeroV2Route, recipient, deadline],
    }),
    decodeOut: (ret) => {
      const amounts = decodeFunctionResult({ abi: aeroV2RouterAbi, functionName: "swapExactTokensForTokens", data: ret });
      return amounts[amounts.length - 1];
    },
  }),
};

const VENUES: Venue[] = [...uniV3Venues, ...aeroClVenues, aeroV2Venue];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const BPS = 10_000n;
const fmtUsdc = (x: bigint) => formatUnits(x, 6);
const fmtWeth = (x: bigint) => formatUnits(x, 18);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** USD price paid per ETH, for logging. */
function pricePerEth(usdcIn: bigint, wethOut: bigint): string {
  if (wethOut === 0n) return "inf";
  return formatUnits((usdcIn * 10n ** 18n * 100n) / wethOut, 8); // 6dp USDC -> show 2 extra decimals
}

async function assertEnvironment() {
  const chainId = await publicClient.getChainId();
  if (chainId !== base.id) throw new Error(`Wrong chain: ${chainId}, expected Base (${base.id})`);

  const contracts = [USDC, WETH, UNI_V3_SWAP_ROUTER02, UNI_V3_QUOTER_V2, AERO_CL_SWAP_ROUTER, AERO_CL_QUOTER, AERO_V2_ROUTER, CHAINLINK_ETH_USD, CHAINLINK_SEQUENCER_UPTIME];
  const codes = await Promise.all(contracts.map((address) => publicClient.getCode({ address })));
  codes.forEach((code, i) => {
    if (!code || code === "0x") throw new Error(`No bytecode at ${contracts[i]}`);
  });
}

async function assertSequencerUp() {
  const [, answer, startedAt] = await publicClient.readContract({
    address: CHAINLINK_SEQUENCER_UPTIME,
    abi: chainlinkAbi,
    functionName: "latestRoundData",
  });
  if (answer !== 0n) throw new Error("Base sequencer reported DOWN by Chainlink uptime feed");
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now - startedAt < SEQUENCER_GRACE_SEC) throw new Error("Sequencer recently restarted; waiting out grace period");
}

/** WETH (18dp) a perfect, fee-less trade of `usdcIn` would return at the Chainlink ETH/USD price. Assumes USDC = $1. */
async function oracleFairOut(usdcIn: bigint): Promise<{ fairOut: bigint; price: bigint; decimals: number }> {
  const [[, answer, , updatedAt], decimals, block] = await Promise.all([
    publicClient.readContract({ address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "latestRoundData" }),
    publicClient.readContract({ address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "decimals" }),
    publicClient.getBlock(),
  ]);
  if (answer <= 0n) throw new Error("Chainlink ETH/USD returned non-positive price");
  if (block.timestamp - updatedAt > MAX_ORACLE_AGE_SEC) {
    throw new Error(`Chainlink ETH/USD stale: updated ${block.timestamp - updatedAt}s ago`);
  }
  // usdcIn (6dp) -> 18dp, then divide by USD/ETH price.
  const fairOut = (usdcIn * 10n ** 12n * 10n ** BigInt(decimals)) / answer;
  return { fairOut, price: answer, decimals };
}

async function bestQuote(amountIn: bigint) {
  const settled = await Promise.allSettled(VENUES.map((v) => v.quote(amountIn)));
  const quotes = settled
    .map((s, i) => ({ venue: VENUES[i], out: s.status === "fulfilled" ? s.value : 0n }))
    .filter((q) => q.out > 0n)
    .sort((a, b) => (b.out > a.out ? 1 : b.out < a.out ? -1 : 0));
  if (quotes.length === 0) throw new Error("No venue returned a quote");
  return quotes;
}

async function ensureAllowance(spender: Address, amount: bigint) {
  const current = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [account.address, spender] });
  if (current >= amount) return;
  // Exact approval per clip — no standing infinite allowance on a treasury wallet.
  const hash = await walletClient.writeContract({ address: USDC, abi: erc20Abi, functionName: "approve", args: [spender, amount] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`approve reverted: ${hash}`);
  console.log(`  approved ${fmtUsdc(amount)} USDC to ${spender} (${hash})`);
}

// ---------------------------------------------------------------------------
// One clip
// ---------------------------------------------------------------------------
async function swapClip(amountIn: bigint): Promise<bigint> {
  await assertSequencerUp();
  const [{ fairOut, price, decimals }, quotes] = await Promise.all([oracleFairOut(amountIn), bestQuote(amountIn)]);
  const best = quotes[0];

  console.log(`  Chainlink ETH/USD: ${formatUnits(price, decimals)}  -> fair out ${fmtWeth(fairOut)} WETH`);
  for (const q of quotes.slice(0, 5)) {
    const devBps = ((fairOut - q.out) * BPS) / fairOut;
    console.log(`    ${q.venue.name.padEnd(36)} ${fmtWeth(q.out).padEnd(24)} WETH  @ ${pricePerEth(amountIn, q.out)}  (${devBps} bps vs oracle)`);
  }

  const oracleFloor = (fairOut * (BPS - MAX_ORACLE_DEVIATION_BPS)) / BPS;
  if (best.out < oracleFloor) {
    throw new Error(
      `Best quote (${best.venue.name}) is ${((fairOut - best.out) * BPS) / fairOut} bps below oracle, limit ${MAX_ORACLE_DEVIATION_BPS}. ` +
        `Reduce clip size (raise CLIPS) or wait for liquidity.`,
    );
  }
  const quoteFloor = (best.out * (BPS - SLIPPAGE_BPS)) / BPS;
  const minOut = quoteFloor > oracleFloor ? quoteFloor : oracleFloor;
  console.log(`  -> ${best.venue.name}, minOut ${fmtWeth(minOut)} WETH`);

  if (!EXECUTE) return best.out;

  await ensureAllowance(best.venue.router, amountIn);

  const block = await publicClient.getBlock();
  const deadline = block.timestamp + DEADLINE_SEC;
  const call = best.venue.buildSwap(amountIn, minOut, account.address, deadline);

  // Simulate first: catches reverts and checks the router returns what we expect.
  const sim = await publicClient.call({ account: account.address, to: call.router, data: call.data });
  if (!sim.data) throw new Error("Simulation returned no data");
  const simOut = call.decodeOut(sim.data);
  if (simOut < minOut) throw new Error(`Simulation out ${simOut} < minOut ${minOut}`);

  const [usdcBefore, wethBefore] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
  ]);

  const hash = await walletClient.sendTransaction({ to: call.router, data: call.data });
  console.log(`  swap tx ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`swap reverted: ${hash}`);

  const [usdcAfter, wethAfter] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address], blockNumber: receipt.blockNumber }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [account.address], blockNumber: receipt.blockNumber }),
  ]);
  const spent = usdcBefore - usdcAfter;
  const received = wethAfter - wethBefore;
  if (spent !== amountIn) throw new Error(`Unexpected USDC spent: ${fmtUsdc(spent)} (expected ${fmtUsdc(amountIn)})`);
  if (received < minOut) throw new Error(`Received ${fmtWeth(received)} < minOut`);
  console.log(`  filled: ${fmtUsdc(spent)} USDC -> ${fmtWeth(received)} WETH @ ${pricePerEth(spent, received)} (block ${receipt.blockNumber})`);
  return received;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  await assertEnvironment();

  const [usdcBal, ethBal] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
    publicClient.getBalance({ address: account.address }),
  ]);
  console.log(`Account ${account.address}: ${fmtUsdc(usdcBal)} USDC, ${formatUnits(ethBal, 18)} ETH`);
  console.log(`Swapping ${fmtUsdc(AMOUNT_USDC)} USDC -> WETH in ${CLIPS} clip(s). ${EXECUTE ? "EXECUTING" : "DRY RUN (set EXECUTE=true to send)"}`);
  if (usdcBal < AMOUNT_USDC) throw new Error("Insufficient USDC");
  if (EXECUTE && ethBal === 0n) throw new Error("No ETH for gas");

  const clipSize = AMOUNT_USDC / CLIPS;
  let remaining = AMOUNT_USDC;
  let totalOut = 0n;
  for (let i = 1n; i <= CLIPS; i++) {
    const amountIn = i === CLIPS ? remaining : clipSize;
    console.log(`\nClip ${i}/${CLIPS}: ${fmtUsdc(amountIn)} USDC`);
    totalOut += await swapClip(amountIn);
    remaining -= amountIn;
    if (i < CLIPS && EXECUTE) await sleep(CLIP_DELAY_SEC * 1000);
  }

  console.log(`\n${EXECUTE ? "Done" : "Dry run (sum of per-clip quotes at current state)"}: ${fmtUsdc(AMOUNT_USDC)} USDC -> ${fmtWeth(totalOut)} WETH, avg ${pricePerEth(AMOUNT_USDC, totalOut)} USD/ETH`);
}

main().catch((err) => {
  console.error(`\nABORTED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
