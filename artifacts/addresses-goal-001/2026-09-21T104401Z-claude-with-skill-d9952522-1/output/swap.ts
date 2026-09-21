/**
 * USDC -> WETH on Base mainnet (chainId 8453).
 *
 * Quotes every candidate pool at the real clip size, picks the best output,
 * checks it against Chainlink ETH/USD, then swaps with a hard amountOutMinimum.
 *
 * Usage:
 *   RPC_URL=... AMOUNT_USDC=500000 npx tsx swap.ts                 # quote only (no key)
 *   RPC_URL=... AMOUNT_USDC=500000 PRIVATE_KEY=0x... EXECUTE=1 npx tsx swap.ts
 *
 * Env:
 *   RPC_URL             Base mainnet RPC (default https://mainnet.base.org — use a private one)
 *   AMOUNT_USDC         human units, e.g. "250000" or "250000.5"
 *   PRIVATE_KEY         signer holding the USDC; WETH is sent back to it (or RECIPIENT)
 *   RECIPIENT           optional WETH recipient
 *   EXECUTE=1           actually send approve + swap; otherwise quote only
 *   SLIPPAGE_BPS        tolerance vs the fresh on-chain quote (default 20 = 0.20%)
 *   MAX_ORACLE_DEV_BPS  max shortfall vs Chainlink fair value, fees included (default 75)
 *   DEADLINE_SEC        tx deadline from now (default 120)
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
// Addresses — all checked on Base mainnet 2026-09-21 (code present, identity
// calls answered as expected). Re-check before real funds: see NOTES.md.
// ---------------------------------------------------------------------------
const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // native Circle USDC (NOT USDbC 0xd9aA…)
const WETH: Address = "0x4200000000000000000000000000000000000006"; // OP-stack predeploy WETH

// Aerodrome Slipstream (concentrated liquidity; pools keyed by tickSpacing)
const SLIP_FACTORY: Address = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A";
const SLIP_ROUTER: Address = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
const SLIP_QUOTER: Address = "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0";

// Uniswap v3 on Base (NOT the Ethereum mainnet addresses)
const UNI_FACTORY: Address = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
const UNI_ROUTER: Address = "0x2626664c2603336E57B271c5C0b26F421741e481"; // SwapRouter02
const UNI_QUOTER: Address = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"; // QuoterV2

// Chainlink ETH/USD on Base (8 decimals) — independent sanity reference
const CL_ETH_USD: Address = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";

// ---------------------------------------------------------------------------
// ABIs — only the functions actually called
// ---------------------------------------------------------------------------
const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const factoryAbi = parseAbi(["function factory() view returns (address)"]);
const slipQuoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,int24 tickSpacing,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);
const slipRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,int24 tickSpacing,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);
const uniQuoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);
const uniRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[])",
]);
const feedAbi = parseAbi([
  "function description() view returns (string)",
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
]);

// ---------------------------------------------------------------------------
// Candidate pools. Depth moves; the script re-quotes all of them every run.
// ---------------------------------------------------------------------------
type Venue =
  | { kind: "slipstream"; tickSpacing: number; label: string }
  | { kind: "univ3"; fee: number; label: string };

const VENUES: Venue[] = [
  { kind: "slipstream", tickSpacing: 100, label: "Aerodrome Slipstream USDC/WETH ts=100" },
  { kind: "slipstream", tickSpacing: 1, label: "Aerodrome Slipstream USDC/WETH ts=1" },
  { kind: "univ3", fee: 500, label: "Uniswap v3 USDC/WETH 0.05%" },
  { kind: "univ3", fee: 3000, label: "Uniswap v3 USDC/WETH 0.30%" },
];

// ---------------------------------------------------------------------------
const env = (k: string, d?: string) => {
  const v = process.env[k] ?? d;
  if (v === undefined) throw new Error(`missing env ${k}`);
  return v;
};

const RPC_URL = env("RPC_URL", "https://mainnet.base.org");
const AMOUNT_IN = parseUnits(env("AMOUNT_USDC"), 6);
const SLIPPAGE_BPS = BigInt(env("SLIPPAGE_BPS", "20"));
const MAX_ORACLE_DEV_BPS = BigInt(env("MAX_ORACLE_DEV_BPS", "75"));
const DEADLINE_SEC = BigInt(env("DEADLINE_SEC", "120"));
const EXECUTE = process.env.EXECUTE === "1";
const ORACLE_MAX_AGE_SEC = 3600n; // ETH/USD heartbeat on Base is 20 min; allow slack

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL, { retryCount: 5 }),
  batch: { multicall: true }, // parallel reads collapse into one Multicall3 call
});

async function sanityCheck() {
  const chainId = await publicClient.getChainId();
  if (chainId !== 8453) throw new Error(`wrong chain ${chainId}, expected Base 8453`);

  const [uSym, uDec, wSym, wDec, slipRF, slipQF, uniRF, uniQF, feedDesc, feedDec] =
    await Promise.all([
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" }),
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
      publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "symbol" }),
      publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "decimals" }),
      publicClient.readContract({ address: SLIP_ROUTER, abi: factoryAbi, functionName: "factory" }),
      publicClient.readContract({ address: SLIP_QUOTER, abi: factoryAbi, functionName: "factory" }),
      publicClient.readContract({ address: UNI_ROUTER, abi: factoryAbi, functionName: "factory" }),
      publicClient.readContract({ address: UNI_QUOTER, abi: factoryAbi, functionName: "factory" }),
      publicClient.readContract({ address: CL_ETH_USD, abi: feedAbi, functionName: "description" }),
      publicClient.readContract({ address: CL_ETH_USD, abi: feedAbi, functionName: "decimals" }),
    ]);

  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (uSym !== "USDC" || uDec !== 6) throw new Error(`USDC identity mismatch: ${uSym}/${uDec}`);
  if (wSym !== "WETH" || wDec !== 18) throw new Error(`WETH identity mismatch: ${wSym}/${wDec}`);
  if (!eq(slipRF, SLIP_FACTORY) || !eq(slipQF, SLIP_FACTORY))
    throw new Error("Slipstream router/quoter not bound to expected factory");
  if (!eq(uniRF, UNI_FACTORY) || !eq(uniQF, UNI_FACTORY))
    throw new Error("Uniswap router/quoter not bound to expected factory");
  if (feedDesc !== "ETH / USD" || feedDec !== 8) throw new Error(`unexpected feed ${feedDesc}`);
}

async function quote(v: Venue, amountIn: bigint): Promise<bigint> {
  // Quoters revert internally to return data, so they must be eth_call'd (simulate), not read as view.
  if (v.kind === "slipstream") {
    const { result } = await publicClient.simulateContract({
      address: SLIP_QUOTER,
      abi: slipQuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing: v.tickSpacing, sqrtPriceLimitX96: 0n }],
    });
    return result[0];
  }
  const { result } = await publicClient.simulateContract({
    address: UNI_QUOTER,
    abi: uniQuoterAbi,
    functionName: "quoteExactInputSingle",
    args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee: v.fee, sqrtPriceLimitX96: 0n }],
  });
  return result[0];
}

/** Fair WETH out for amountIn USDC at Chainlink ETH/USD (assumes USDC = $1). */
async function oracleFairOut(amountIn: bigint): Promise<bigint> {
  const [, answer, , updatedAt] = await publicClient.readContract({
    address: CL_ETH_USD,
    abi: feedAbi,
    functionName: "latestRoundData",
  });
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (answer <= 0n) throw new Error("bad oracle answer");
  if (now - updatedAt > ORACLE_MAX_AGE_SEC) throw new Error(`oracle stale: ${now - updatedAt}s old`);
  // USDC 6 dec, price 8 dec, WETH 18 dec: out = amountIn * 1e12 * 1e8 / price
  return (amountIn * 10n ** 20n) / answer;
}

function buildSwap(v: Venue, recipient: Address, amountIn: bigint, minOut: bigint, deadline: bigint) {
  if (v.kind === "slipstream") {
    return {
      to: SLIP_ROUTER,
      data: encodeFunctionData({
        abi: slipRouterAbi,
        functionName: "exactInputSingle",
        args: [{
          tokenIn: USDC, tokenOut: WETH, tickSpacing: v.tickSpacing, recipient, deadline,
          amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n,
        }],
      }),
    };
  }
  // SwapRouter02's exactInputSingle has no deadline field; wrap in multicall(deadline, ...)
  const inner = encodeFunctionData({
    abi: uniRouterAbi,
    functionName: "exactInputSingle",
    args: [{
      tokenIn: USDC, tokenOut: WETH, fee: v.fee, recipient,
      amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n,
    }],
  });
  return {
    to: UNI_ROUTER,
    data: encodeFunctionData({ abi: uniRouterAbi, functionName: "multicall", args: [deadline, [inner]] }),
  };
}

const bps = (got: bigint, ref: bigint) => Number(((got - ref) * 100_000n) / ref) / 10;
const fmtW = (x: bigint) => formatUnits(x, 18);

async function main() {
  if (AMOUNT_IN <= 0n) throw new Error("AMOUNT_USDC must be > 0");
  await sanityCheck();

  // 1. Quote every candidate at the full clip size and pick the best.
  const fair = await oracleFairOut(AMOUNT_IN);
  console.log(`clip ${formatUnits(AMOUNT_IN, 6)} USDC | Chainlink fair ≈ ${fmtW(fair)} WETH`);
  // Sequential on purpose: public RPCs rate-limit bursts of eth_call.
  const ok: { v: Venue; out: bigint }[] = [];
  for (const v of VENUES) {
    try {
      ok.push({ v, out: await quote(v, AMOUNT_IN) });
    } catch (e) {
      console.log(`  ${v.label}: quote failed (${(e as Error).message.split("\n")[0]})`);
    }
  }
  if (ok.length === 0) throw new Error("no venue could quote");
  ok.sort((a, b) => (b.out > a.out ? 1 : b.out < a.out ? -1 : 0));
  for (const q of ok) console.log(`  ${q.v.label}: ${fmtW(q.out)} WETH (${bps(q.out, fair)} bps vs oracle)`);
  const best = ok[0];

  // 2. Refuse to trade if the best quote is too far below fair value (thin book, manipulated pool, bad oracle).
  const shortfall = ((fair - best.out) * 10_000n) / fair;
  if (shortfall > MAX_ORACLE_DEV_BPS)
    throw new Error(`best quote ${shortfall} bps below oracle > limit ${MAX_ORACLE_DEV_BPS}. Split the clip or wait.`);

  const minOut = (best.out * (10_000n - SLIPPAGE_BPS)) / 10_000n;
  console.log(`chosen: ${best.v.label}\n  minOut ${fmtW(minOut)} WETH (slippage ${SLIPPAGE_BPS} bps)`);

  if (!EXECUTE) {
    console.log("quote only. Set EXECUTE=1 and PRIVATE_KEY to send.");
    return;
  }

  // 3. Execute.
  const account = privateKeyToAccount(env("PRIVATE_KEY") as Hex);
  const wallet = createWalletClient({ account, chain: base, transport: http(RPC_URL) });
  const recipient = (process.env.RECIPIENT as Address | undefined) ?? account.address;

  const bal = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
  if (bal < AMOUNT_IN) throw new Error(`insufficient USDC: have ${formatUnits(bal, 6)}`);

  const router = best.v.kind === "slipstream" ? SLIP_ROUTER : UNI_ROUTER;
  const allowance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: "allowance", args: [account.address, router],
  });
  if (allowance < AMOUNT_IN) {
    // Exact-amount approval: no standing unlimited allowance left on a router.
    const { request } = await publicClient.simulateContract({
      account, address: USDC, abi: erc20Abi, functionName: "approve", args: [router, AMOUNT_IN],
    });
    const h = await wallet.writeContract(request);
    const r = await publicClient.waitForTransactionReceipt({ hash: h });
    if (r.status !== "success") throw new Error(`approve failed ${h}`);
    console.log(`approved ${formatUnits(AMOUNT_IN, 6)} USDC to ${router}: ${h}`);
  }

  // Re-quote right before sending: the approve took a block or two.
  const fresh = await quote(best.v, AMOUNT_IN);
  const freshMin = (fresh * (10_000n - SLIPPAGE_BPS)) / 10_000n;
  if (fresh < minOut) throw new Error(`price moved: fresh quote ${fmtW(fresh)} < minOut ${fmtW(minOut)}`);
  const finalMin = freshMin > minOut ? freshMin : minOut; // take the tighter bound

  const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SEC;
  const tx = buildSwap(best.v, recipient, AMOUNT_IN, finalMin, deadline);

  const wethBefore = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [recipient] });
  await publicClient.call({ account: account.address, ...tx }); // dry-run; throws on revert
  const gas = await publicClient.estimateGas({ account, ...tx });
  const hash = await wallet.sendTransaction({ ...tx, gas: (gas * 12n) / 10n });
  console.log(`swap sent: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`swap reverted ${hash}`);

  const wethAfter = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [recipient] });
  const got = wethAfter - wethBefore;
  console.log(`received ${fmtW(got)} WETH (${bps(got, fair)} bps vs oracle) block ${receipt.blockNumber}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
