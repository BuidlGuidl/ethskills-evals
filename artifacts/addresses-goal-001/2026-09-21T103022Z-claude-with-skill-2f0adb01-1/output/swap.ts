/**
 * USDC -> WETH on Base mainnet, built for large (6-figure) treasury swaps.
 *
 * Strategy (see NOTES.md):
 *  1. Sanity-check Chainlink: sequencer up, ETH/USD + USDC/USD fresh.
 *  2. Split the order into tranches. For each tranche:
 *     - quote every venue onchain (Uniswap V3 0.05% / 0.3%, Aerodrome Slipstream ts=100 / ts=1)
 *     - pick the best quote, reject it if it is worse than the oracle by > MAX_ORACLE_DEVIATION_BPS
 *     - amountOutMinimum = max(quote * (1 - SLIPPAGE_BPS), oracle floor)
 *     - simulate, then send; verify WETH actually received
 *     - wait TRANCHE_DELAY_MS so arbitrageurs re-align pools before the next tranche
 *
 * Dry run by default (quotes + simulation only). Set EXECUTE=1 to send transactions.
 *
 *   RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 npx tsx swap.ts
 *   RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 EXECUTE=1 npx tsx swap.ts
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
// Addresses — Base mainnet (chainId 8453). All verified onchain (bytecode +
// factory()/description() cross-checks), see NOTES.md.
// ---------------------------------------------------------------------------
const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // native Circle USDC (NOT USDbC)
const WETH: Address = "0x4200000000000000000000000000000000000006";

// Uniswap V3
const UNI_V3_SWAP_ROUTER_02: Address = "0x2626664c2603336E57B271c5C0b26F421741e481";
const UNI_V3_QUOTER_V2: Address = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";

// Aerodrome Slipstream (concentrated liquidity), CLFactory 0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A
const SLIPSTREAM_SWAP_ROUTER: Address = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
const SLIPSTREAM_QUOTER_V2: Address = "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0";

// Chainlink
const CL_ETH_USD: Address = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
const CL_USDC_USD: Address = "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B";
const CL_SEQUENCER_UPTIME: Address = "0xBCF85224fc0756B9Fa45aA7892530B47e10b6433";

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
]);

const uniQuoterAbi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

// SwapRouter02 on Base: struct has no deadline; deadline enforced via multicall(uint256,bytes[]).
const uniRouterAbi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

const slipQuoterAbi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; int24 tickSpacing; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const slipRouterAbi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; int24 tickSpacing; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
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
const AMOUNT = parseUnits(env("AMOUNT_USDC"), 6);
const TRANCHE = parseUnits(env("TRANCHE_USDC", "50000"), 6);
const SLIPPAGE_BPS = BigInt(env("SLIPPAGE_BPS", "15")); // tolerance vs. fresh quote
const MAX_ORACLE_DEVIATION_BPS = BigInt(env("MAX_ORACLE_DEVIATION_BPS", "60")); // total cost vs. Chainlink incl. fees
const TRANCHE_DELAY_MS = Number(env("TRANCHE_DELAY_MS", "6000"));
const DEADLINE_SECS = BigInt(env("DEADLINE_SECS", "60"));
const EXECUTE = process.env.EXECUTE === "1";

const ETH_FEED_MAX_AGE = 3600n; // Base ETH/USD heartbeat is 1200s; allow slack
const USDC_FEED_MAX_AGE = 90_000n; // Base USDC/USD heartbeat is 86400s
const SEQUENCER_GRACE = 3600n;
const RECEIPT_TIMEOUT_MS = 180_000;

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------
type Venue = {
  name: string;
  router: Address;
  quote: (amountIn: bigint) => Promise<bigint>;
  swapCall: (amountIn: bigint, minOut: bigint, deadline: bigint) => { data: Hex };
};

function uniV3(fee: number): Venue {
  return {
    name: `UniswapV3 fee=${fee / 10_000}%`,
    router: UNI_V3_SWAP_ROUTER_02,
    quote: async (amountIn) => {
      const { result } = await publicClient.simulateContract({
        address: UNI_V3_QUOTER_V2,
        abi: uniQuoterAbi,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      return result[0];
    },
    swapCall: (amountIn, minOut, deadline) => {
      const inner = encodeFunctionData({
        abi: uniRouterAbi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: USDC,
            tokenOut: WETH,
            fee,
            recipient: account.address,
            amountIn,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      return {
        data: encodeFunctionData({ abi: uniRouterAbi, functionName: "multicall", args: [deadline, [inner]] }),
      };
    },
  };
}

function slipstream(tickSpacing: number): Venue {
  return {
    name: `Aerodrome Slipstream ts=${tickSpacing}`,
    router: SLIPSTREAM_SWAP_ROUTER,
    quote: async (amountIn) => {
      const { result } = await publicClient.simulateContract({
        address: SLIPSTREAM_QUOTER_V2,
        abi: slipQuoterAbi,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing, sqrtPriceLimitX96: 0n }],
      });
      return result[0];
    },
    swapCall: (amountIn, minOut, deadline) => ({
      data: encodeFunctionData({
        abi: slipRouterAbi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: USDC,
            tokenOut: WETH,
            tickSpacing,
            recipient: account.address,
            deadline,
            amountIn,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0n,
          },
        ],
      }),
    }),
  };
}

const VENUES: Venue[] = [uniV3(500), uniV3(3000), slipstream(100), slipstream(1)];

// ---------------------------------------------------------------------------
// Oracle: fair WETH out for a USDC amount, with sequencer + staleness checks
// ---------------------------------------------------------------------------
async function readFeed(feed: Address, maxAge: bigint, now: bigint): Promise<bigint> {
  const [, answer, , updatedAt] = await publicClient.readContract({
    address: feed,
    abi: chainlinkAbi,
    functionName: "latestRoundData",
  });
  if (answer <= 0n) throw new Error(`feed ${feed}: bad answer ${answer}`);
  if (now - updatedAt > maxAge) throw new Error(`feed ${feed}: stale (${now - updatedAt}s old)`);
  return answer; // 8 decimals for both feeds
}

async function oracleWethOut(amountUsdc: bigint): Promise<bigint> {
  const now = (await publicClient.getBlock()).timestamp;

  const [, seqAnswer, seqStartedAt] = await publicClient.readContract({
    address: CL_SEQUENCER_UPTIME,
    abi: chainlinkAbi,
    functionName: "latestRoundData",
  });
  if (seqAnswer !== 0n) throw new Error("Base sequencer reported DOWN");
  if (now - seqStartedAt < SEQUENCER_GRACE) throw new Error("sequencer recently restarted; wait out grace period");

  const ethUsd = await readFeed(CL_ETH_USD, ETH_FEED_MAX_AGE, now);
  const usdcUsd = await readFeed(CL_USDC_USD, USDC_FEED_MAX_AGE, now);
  // usdc(6dp) * usdcUsd / ethUsd -> eth(6dp); * 1e12 -> 18dp
  return (amountUsdc * usdcUsd * 10n ** 12n) / ethUsd;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const bpsBelow = (actual: bigint, ref: bigint) => ((ref - actual) * 10_000n) / ref; // positive = worse than ref
const fmtWeth = (x: bigint) => formatUnits(x, 18);
const fmtUsdc = (x: bigint) => formatUnits(x, 6);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function bestQuote(amountIn: bigint) {
  const results = await Promise.all(
    VENUES.map(async (v) => {
      try {
        return { venue: v, out: await v.quote(amountIn) };
      } catch {
        return { venue: v, out: 0n }; // pool missing / not enough liquidity
      }
    }),
  );
  results.sort((a, b) => (b.out > a.out ? 1 : b.out < a.out ? -1 : 0));
  return results;
}

async function ensureAllowance(spender: Address, amount: bigint) {
  const current = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, spender],
  });
  if (current >= amount) return;
  // Exact-amount approval, never infinite.
  const { request } = await publicClient.simulateContract({
    account,
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
  const hash = await walletClient.writeContract(request);
  const rcpt = await publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
  if (rcpt.status !== "success") throw new Error(`approve reverted: ${hash}`);
  console.log(`  approved ${fmtUsdc(amount)} USDC to ${spender} (${hash})`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const chainId = await publicClient.getChainId();
  if (chainId !== base.id) throw new Error(`RPC is chainId ${chainId}, expected Base (${base.id})`);

  const usdcBal = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (usdcBal < AMOUNT) throw new Error(`insufficient USDC: have ${fmtUsdc(usdcBal)}, need ${fmtUsdc(AMOUNT)}`);
  if (TRANCHE <= 0n) throw new Error("TRANCHE_USDC must be > 0");

  console.log(`account  ${account.address}`);
  console.log(`swap     ${fmtUsdc(AMOUNT)} USDC -> WETH in tranches of ${fmtUsdc(TRANCHE)}`);
  console.log(`mode     ${EXECUTE ? "EXECUTE (real transactions)" : "DRY RUN (set EXECUTE=1 to send)"}\n`);

  // Full-size reference quote: shows what a single-shot swap would cost.
  const fullOracle = await oracleWethOut(AMOUNT);
  const full = await bestQuote(AMOUNT);
  console.log(`oracle fair value for full size: ${fmtWeth(fullOracle)} WETH`);
  for (const r of full) {
    const cost = r.out > 0n ? `${bpsBelow(r.out, fullOracle)} bps vs oracle` : "no quote";
    console.log(`  single-shot ${r.venue.name.padEnd(28)} ${fmtWeth(r.out)} WETH (${cost})`);
  }
  console.log();

  let remaining = AMOUNT;
  let totalIn = 0n;
  let totalOut = 0n;
  let i = 0;

  while (remaining > 0n) {
    i++;
    const amountIn = remaining < TRANCHE ? remaining : TRANCHE;
    const fair = await oracleWethOut(amountIn);
    const [best] = await bestQuote(amountIn);
    if (!best || best.out === 0n) throw new Error("no venue returned a quote");

    const deviation = bpsBelow(best.out, fair);
    console.log(
      `tranche ${i}: ${fmtUsdc(amountIn)} USDC via ${best.venue.name} -> ${fmtWeth(best.out)} WETH (${deviation} bps vs oracle)`,
    );
    if (deviation > MAX_ORACLE_DEVIATION_BPS) {
      throw new Error(
        `best quote is ${deviation} bps below oracle (limit ${MAX_ORACLE_DEVIATION_BPS}); aborting. ` +
          `Filled so far: ${fmtUsdc(totalIn)} USDC -> ${fmtWeth(totalOut)} WETH`,
      );
    }

    const quoteFloor = (best.out * (10_000n - SLIPPAGE_BPS)) / 10_000n;
    const oracleFloor = (fair * (10_000n - MAX_ORACLE_DEVIATION_BPS)) / 10_000n;
    const minOut = quoteFloor > oracleFloor ? quoteFloor : oracleFloor;
    const deadline = (await publicClient.getBlock()).timestamp + DEADLINE_SECS;
    const { data } = best.venue.swapCall(amountIn, minOut, deadline);
    console.log(`  minOut ${fmtWeth(minOut)} WETH, deadline ${deadline}`);

    if (!EXECUTE) {
      // Simulation needs allowance; only possible in dry run if it already exists.
      const allowance = await publicClient.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account.address, best.venue.router],
      });
      if (allowance >= amountIn) {
        await publicClient.call({ account, to: best.venue.router, data });
        console.log("  simulation OK");
      } else {
        console.log("  (skipping simulation: no allowance yet)");
      }
      remaining -= amountIn;
      continue;
    }

    await ensureAllowance(best.venue.router, amountIn);
    await publicClient.call({ account, to: best.venue.router, data }); // throws with revert reason if it would fail

    const wethBefore = await publicClient.readContract({
      address: WETH,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    // Tight estimates can OOG at the pool's final reentrancy-lock SSTORE; add 25% headroom.
    const gas = await publicClient.estimateGas({ account, to: best.venue.router, data });
    const hash = await walletClient.sendTransaction({ to: best.venue.router, data, gas: (gas * 125n) / 100n });
    const rcpt = await publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
    if (rcpt.status !== "success") throw new Error(`swap reverted: ${hash}`);
    const wethAfter = await publicClient.readContract({
      address: WETH,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
      blockNumber: rcpt.blockNumber,
    });
    const received = wethAfter - wethBefore;
    if (received < minOut) throw new Error(`received ${fmtWeth(received)} < minOut ${fmtWeth(minOut)} (${hash})`);

    totalIn += amountIn;
    totalOut += received;
    remaining -= amountIn;
    console.log(`  filled: ${fmtWeth(received)} WETH, tx ${hash}`);

    if (remaining > 0n) await sleep(TRANCHE_DELAY_MS);
  }

  if (EXECUTE && totalIn > 0n) {
    const avgPrice = (totalIn * 10n ** 18n) / totalOut; // USDC(6dp) per 1 WETH
    console.log(`\ndone: ${fmtUsdc(totalIn)} USDC -> ${fmtWeth(totalOut)} WETH, avg ${fmtUsdc(avgPrice)} USDC/WETH`);
    console.log(`vs. oracle at start: ${bpsBelow(totalOut, fullOracle)} bps`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
