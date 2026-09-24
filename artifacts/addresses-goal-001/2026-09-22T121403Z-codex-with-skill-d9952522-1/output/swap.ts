import { config } from "dotenv";

import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseUnits,
  zeroAddress,
  type Address,
  type PublicClient,
  type Transport,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

config({ quiet: true });

const RPC_URL = process.env.RPC_URL ?? "https://base-rpc.publicnode.com";
const AMOUNT_USDC = process.env.AMOUNT_USDC;
const SLIPPAGE_BPS = BigInt(process.env.SLIPPAGE_BPS ?? "30");
const DEADLINE_SECONDS = BigInt(process.env.DEADLINE_SECONDS ?? "120");
const EXECUTE = process.env.EXECUTE === "true";

const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const WETH = getAddress("0x4200000000000000000000000000000000000006");

const SLIPSTREAM_QUOTER = getAddress("0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0");
const SLIPSTREAM_SWAP_ROUTER = getAddress("0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5");
const SLIPSTREAM_POOL_FACTORY = getAddress("0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A");

const TICK_SPACINGS = [1, 50, 100, 200, 2000] as const;
const BASIS_POINTS = 10_000n;

const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,int24 tickSpacing,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

const swapRouterAbi = parseAbi([
  "function factory() view returns (address)",
  "function WETH9() view returns (address)",
  "function exactInputSingle((address tokenIn,address tokenOut,int24 tickSpacing,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

const poolFactoryAbi = parseAbi([
  "function getPool(address tokenA,address tokenB,int24 tickSpacing) view returns (address pool)",
]);

const poolAbi = parseAbi([
  "function liquidity() view returns (uint128)",
]);

type Quote = {
  tickSpacing: (typeof TICK_SPACINGS)[number];
  pool: Address;
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  initializedTicksCrossed: number;
  gasEstimate: bigint;
  liquidity: bigint;
};

type BasePublicClient = PublicClient<Transport, typeof base>;

function envPrivateKey() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey?.match(/^0x[0-9a-fA-F]{64}$/)) {
    throw new Error("Set PRIVATE_KEY to the funded Base account's 0x-prefixed private key.");
  }
  return privateKey as `0x${string}`;
}

function requireAmount() {
  if (!AMOUNT_USDC) {
    throw new Error("Set AMOUNT_USDC, for example AMOUNT_USDC=500000.");
  }
  if (!AMOUNT_USDC.match(/^\d+(\.\d{1,6})?$/)) {
    throw new Error("AMOUNT_USDC must be a positive decimal with at most 6 decimal places.");
  }
  const parsed = parseUnits(AMOUNT_USDC, 6);
  if (parsed <= 0n) throw new Error("AMOUNT_USDC must be greater than zero.");
  return parsed;
}

function amountOutMinimum(amountOut: bigint) {
  if (SLIPPAGE_BPS < 0n || SLIPPAGE_BPS >= BASIS_POINTS) {
    throw new Error("SLIPPAGE_BPS must be between 0 and 9999.");
  }
  return (amountOut * (BASIS_POINTS - SLIPPAGE_BPS)) / BASIS_POINTS;
}

function formatBps(bps: bigint) {
  return `${Number(bps) / 100}%`;
}

async function assertBaseContracts(publicClient: BasePublicClient) {
  const chainId = await publicClient.getChainId();
  if (chainId !== base.id) throw new Error(`RPC_URL is chain ${chainId}; expected Base mainnet ${base.id}.`);

  const [usdcSymbol, usdcDecimals, wethSymbol, wethDecimals, routerFactory, routerWeth] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: SLIPSTREAM_SWAP_ROUTER, abi: swapRouterAbi, functionName: "factory" }),
    publicClient.readContract({ address: SLIPSTREAM_SWAP_ROUTER, abi: swapRouterAbi, functionName: "WETH9" }),
  ]);

  if (usdcSymbol !== "USDC" || usdcDecimals !== 6) throw new Error(`Unexpected USDC contract identity.`);
  if (wethSymbol !== "WETH" || wethDecimals !== 18) throw new Error(`Unexpected WETH contract identity.`);
  if (getAddress(routerFactory) !== SLIPSTREAM_POOL_FACTORY) throw new Error(`SwapRouter factory mismatch.`);
  if (getAddress(routerWeth) !== WETH) throw new Error(`SwapRouter WETH9 mismatch.`);
}

async function quoteTickSpacing(
  publicClient: BasePublicClient,
  amountIn: bigint,
  tickSpacing: (typeof TICK_SPACINGS)[number],
): Promise<Quote | undefined> {
  const pool = getAddress(
    await publicClient.readContract({
      address: SLIPSTREAM_POOL_FACTORY,
      abi: poolFactoryAbi,
      functionName: "getPool",
      args: [USDC, WETH, tickSpacing],
    }),
  );

  if (pool === zeroAddress) return undefined;

  const [liquidity, quote] = await Promise.all([
    publicClient.readContract({ address: pool, abi: poolAbi, functionName: "liquidity" }),
    publicClient.simulateContract({
      address: SLIPSTREAM_QUOTER,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: USDC,
          tokenOut: WETH,
          amountIn,
          tickSpacing,
          sqrtPriceLimitX96: 0n,
        },
      ],
    }),
  ]);

  const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = quote.result;
  if (amountOut === 0n) return undefined;

  return {
    tickSpacing,
    pool,
    amountOut,
    sqrtPriceX96After,
    initializedTicksCrossed,
    gasEstimate,
    liquidity,
  };
}

async function main() {
  const amountIn = requireAmount();
  const account = privateKeyToAccount(envPrivateKey());

  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(RPC_URL),
  });

  await assertBaseContracts(publicClient);

  const [ethBalance, usdcBalance] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
  ]);

  const quotes = (
    await Promise.all(TICK_SPACINGS.map((tickSpacing) => quoteTickSpacing(publicClient, amountIn, tickSpacing)))
  ).filter((quote): quote is Quote => quote !== undefined);

  if (quotes.length === 0) throw new Error("No direct Aerodrome Slipstream USDC/WETH quote returned non-zero output.");

  quotes.sort((a, b) => (a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0));
  const best = quotes[0];
  const minOut = amountOutMinimum(best.amountOut);

  console.log(`Account: ${account.address}`);
  console.log(`Balances: ${formatUnits(usdcBalance, 6)} USDC, ${formatUnits(ethBalance, 18)} ETH`);
  console.log(`Input: ${formatUnits(amountIn, 6)} USDC`);
  console.log("Aerodrome Slipstream direct quotes:");
  for (const quote of quotes) {
    console.log(
      `  tickSpacing ${quote.tickSpacing}: ${formatUnits(quote.amountOut, 18)} WETH ` +
        `(pool ${quote.pool}, liquidity ${quote.liquidity.toString()}, ticks crossed ${quote.initializedTicksCrossed})`,
    );
  }
  console.log(`Selected tickSpacing: ${best.tickSpacing}`);
  console.log(`Quoted output: ${formatUnits(best.amountOut, 18)} WETH`);
  console.log(`Minimum output (${formatBps(SLIPPAGE_BPS)} slippage): ${formatUnits(minOut, 18)} WETH`);

  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SLIPSTREAM_SWAP_ROUTER],
  });

  const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECONDS;
  const swapParams = {
    tokenIn: USDC,
    tokenOut: WETH,
    tickSpacing: best.tickSpacing,
    recipient: account.address,
    deadline,
    amountIn,
    amountOutMinimum: minOut,
    sqrtPriceLimitX96: 0n,
  };

  if (!EXECUTE) {
    console.log("EXECUTE is not true, so no transactions were sent.");
    console.log(`Current USDC allowance to router: ${formatUnits(allowance, 6)} USDC`);
    return;
  }

  if (usdcBalance < amountIn) {
    throw new Error(
      `Insufficient USDC: need ${formatUnits(amountIn, 6)}, have ${formatUnits(usdcBalance, 6)}.`,
    );
  }
  if (ethBalance === 0n) throw new Error("Account has no ETH for Base gas.");

  if (allowance < amountIn) {
    const { request } = await publicClient.simulateContract({
      account,
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [SLIPSTREAM_SWAP_ROUTER, amountIn],
    });
    const approveHash = await walletClient.writeContract(request);
    console.log(`Approve tx: ${approveHash}`);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const { request, result: simulatedAmountOut } = await publicClient.simulateContract({
    account,
    address: SLIPSTREAM_SWAP_ROUTER,
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [swapParams],
    value: 0n,
  });
  console.log(`Simulated router output: ${formatUnits(simulatedAmountOut, 18)} WETH`);

  const swapHash = await walletClient.writeContract(request);
  console.log(`Swap tx: ${swapHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
  console.log(`Swap included in block ${receipt.blockNumber} with status ${receipt.status}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
