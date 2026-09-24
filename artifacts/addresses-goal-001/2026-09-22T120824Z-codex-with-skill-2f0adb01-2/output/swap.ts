import "dotenv/config";

import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const BASE_CHAIN_ID = 8453;
const DEFAULT_RPC_URL = "https://base-rpc.publicnode.com";
const BPS_DENOMINATOR = 10_000n;

const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const WETH = getAddress("0x4200000000000000000000000000000000000006");

const AERODROME_SLIPSTREAM_FACTORY = getAddress("0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A");
const AERODROME_SLIPSTREAM_QUOTER = getAddress("0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0");
const AERODROME_SLIPSTREAM_SWAP_ROUTER = getAddress("0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5");

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, int24 tickSpacing) view returns (address pool)",
  "function getSwapFee(address pool) view returns (uint24 fee)",
  "function tickSpacings() view returns (int24[] tickSpacings)",
]);

const poolAbi = parseAbi([
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
]);

const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, int24 tickSpacing, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const swapRouterAbi = parseAbi([
  "function WETH9() view returns (address)",
  "function factory() view returns (address)",
  "function exactInputSingle((address tokenIn, address tokenOut, int24 tickSpacing, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

type QuoteCandidate = {
  tickSpacing: number;
  pool: Address;
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  initializedTicksCrossed: number;
  gasEstimate: bigint;
  liquidity: bigint;
  feePips: number;
};

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function envOrArg(argName: string, envName: string): string | undefined {
  return argValue(argName) ?? process.env[envName];
}

function requiredAmount(): string {
  const value = envOrArg("amount-usdc", "AMOUNT_USDC");
  if (!value) {
    throw new Error("Missing amount. Pass --amount-usdc 250000 or set AMOUNT_USDC=250000.");
  }
  return value;
}

function parseBps(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`Invalid bps value: ${value}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 2_000) {
    throw new Error(`Bps must be an integer from 0 to 2000. Received ${value}.`);
  }
  return parsed;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`Invalid integer value: ${value}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer. Received ${value}.`);
  }
  return parsed;
}

function normalizeAddress(value: string | undefined, label: string): Address | undefined {
  if (!value) return undefined;
  if (!isAddress(value)) throw new Error(`${label} is not a valid EVM address: ${value}`);
  return getAddress(value);
}

function normalizePrivateKey(value: string | undefined): Hex | undefined {
  if (!value) return undefined;
  const prefixed = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex private key.");
  }
  return prefixed as Hex;
}

function applySlippage(amount: bigint, slippageBps: number): bigint {
  return (amount * (BPS_DENOMINATOR - BigInt(slippageBps))) / BPS_DENOMINATOR;
}

function fmt(amount: bigint, decimals: number, symbol: string): string {
  return `${formatUnits(amount, decimals)} ${symbol}`;
}

function formatFee(feePips: number): string {
  return `${feePips / 10_000}%`;
}

async function main() {
  const execute = hasFlag("execute");
  const rpcUrl = envOrArg("rpc-url", "BASE_RPC_URL") ?? DEFAULT_RPC_URL;
  const amountUsdc = requiredAmount();
  const slippageBps = parseBps(envOrArg("slippage-bps", "SLIPPAGE_BPS"), 30);
  const deadlineSeconds = parsePositiveInt(envOrArg("deadline-seconds", "DEADLINE_SECONDS"), 120);

  const privateKey = normalizePrivateKey(process.env.PRIVATE_KEY);
  const account = privateKey ? privateKeyToAccount(privateKey) : undefined;
  if (execute && !account) throw new Error("Execution requires PRIVATE_KEY.");

  const from = normalizeAddress(envOrArg("from", "ACCOUNT_ADDRESS"), "from") ?? account?.address;
  const recipient =
    normalizeAddress(envOrArg("recipient", "RECIPIENT"), "recipient") ?? account?.address ?? from;
  if (execute && !recipient) throw new Error("Execution requires a recipient address.");

  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const chainId = await publicClient.getChainId();
  if (chainId !== BASE_CHAIN_ID) {
    throw new Error(`RPC is connected to chain ${chainId}, expected Base mainnet (${BASE_CHAIN_ID}).`);
  }

  const [routerCode, quoterCode, factoryCode] = await Promise.all([
    publicClient.getBytecode({ address: AERODROME_SLIPSTREAM_SWAP_ROUTER }),
    publicClient.getBytecode({ address: AERODROME_SLIPSTREAM_QUOTER }),
    publicClient.getBytecode({ address: AERODROME_SLIPSTREAM_FACTORY }),
  ]);
  if (!routerCode || !quoterCode || !factoryCode) throw new Error("A configured Aerodrome contract has no bytecode.");

  const [routerFactory, routerWeth] = await Promise.all([
    publicClient.readContract({
      address: AERODROME_SLIPSTREAM_SWAP_ROUTER,
      abi: swapRouterAbi,
      functionName: "factory",
    }),
    publicClient.readContract({
      address: AERODROME_SLIPSTREAM_SWAP_ROUTER,
      abi: swapRouterAbi,
      functionName: "WETH9",
    }),
  ]);
  if (getAddress(routerFactory) !== AERODROME_SLIPSTREAM_FACTORY) {
    throw new Error(`Unexpected router factory: ${routerFactory}`);
  }
  if (getAddress(routerWeth) !== WETH) {
    throw new Error(`Unexpected router WETH9: ${routerWeth}`);
  }

  const [usdcDecimals, wethDecimals, usdcSymbol, wethSymbol] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "symbol" }),
  ]);

  const amountIn = parseUnits(amountUsdc, usdcDecimals);
  const tickSpacings = await publicClient.readContract({
    address: AERODROME_SLIPSTREAM_FACTORY,
    abi: factoryAbi,
    functionName: "tickSpacings",
  });

  const quoteCaller = from ?? getAddress("0x0000000000000000000000000000000000000001");
  const candidates: QuoteCandidate[] = [];
  for (const tickSpacing of tickSpacings) {
    const pool = getAddress(
      await publicClient.readContract({
        address: AERODROME_SLIPSTREAM_FACTORY,
        abi: factoryAbi,
        functionName: "getPool",
        args: [USDC, WETH, tickSpacing],
      }),
    );
    if (pool === zeroAddress) continue;

    try {
      const [[amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate], liquidity, feePips] =
        await Promise.all([
          publicClient
            .simulateContract({
              account: quoteCaller,
              address: AERODROME_SLIPSTREAM_QUOTER,
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
            })
            .then(({ result }) => result),
          publicClient.readContract({ address: pool, abi: poolAbi, functionName: "liquidity" }),
          publicClient.readContract({
            address: AERODROME_SLIPSTREAM_FACTORY,
            abi: factoryAbi,
            functionName: "getSwapFee",
            args: [pool],
          }),
        ]);

      if (amountOut > 0n) {
        candidates.push({
          tickSpacing,
          pool,
          amountOut,
          sqrtPriceX96After,
          initializedTicksCrossed,
          gasEstimate,
          liquidity,
          feePips,
        });
      }
    } catch (error) {
      console.warn(`Skipping tickSpacing ${tickSpacing}: ${(error as Error).message}`);
    }
  }

  if (candidates.length === 0) {
    throw new Error("No live Aerodrome Slipstream USDC/WETH pool returned a quote.");
  }

  candidates.sort((a, b) => (a.amountOut === b.amountOut ? 0 : a.amountOut > b.amountOut ? -1 : 1));
  const best = candidates[0];
  const amountOutMinimum = applySlippage(best.amountOut, slippageBps);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  console.log("Aerodrome Slipstream USDC -> WETH quote on Base");
  console.log(`  amountIn:       ${fmt(amountIn, usdcDecimals, usdcSymbol)}`);
  console.log(`  bestPool:       ${best.pool}`);
  console.log(`  tickSpacing:    ${best.tickSpacing}`);
  console.log(`  swapFee:        ${formatFee(best.feePips)} (${best.feePips} pips)`);
  console.log(`  quotedOut:      ${fmt(best.amountOut, wethDecimals, wethSymbol)}`);
  console.log(`  minOut:         ${fmt(amountOutMinimum, wethDecimals, wethSymbol)} (${slippageBps} bps slippage)`);
  console.log(`  gasEstimate:    ${best.gasEstimate.toString()} from quoter`);
  console.log(`  ticksCrossed:   ${best.initializedTicksCrossed}`);
  console.log(`  sqrtAfter:      ${best.sqrtPriceX96After.toString()}`);
  console.log("");
  console.log("Other live direct pools:");
  for (const candidate of candidates.slice(0, 8)) {
    console.log(
      `  tick=${candidate.tickSpacing} fee=${formatFee(candidate.feePips)} pool=${candidate.pool} out=${fmt(
        candidate.amountOut,
        wethDecimals,
        wethSymbol,
      )}`,
    );
  }

  if (from) {
    const [balance, allowance] = await Promise.all([
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [from] }),
      publicClient.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: "allowance",
        args: [from, AERODROME_SLIPSTREAM_SWAP_ROUTER],
      }),
    ]);
    console.log("");
    console.log(`Account:          ${from}`);
    console.log(`USDC balance:     ${fmt(balance, usdcDecimals, usdcSymbol)}`);
    console.log(`Router allowance: ${fmt(allowance, usdcDecimals, usdcSymbol)}`);
    if (balance < amountIn) throw new Error("USDC balance is below the requested swap amount.");
  }

  if (!execute) {
    console.log("");
    console.log("Quote-only mode. Add --execute with PRIVATE_KEY set to approve and swap.");
    return;
  }

  if (!account || !recipient) throw new Error("Missing signer or recipient.");
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) });

  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, AERODROME_SLIPSTREAM_SWAP_ROUTER],
  });

  if (allowance < amountIn) {
    console.log("");
    console.log(`Approving exactly ${fmt(amountIn, usdcDecimals, usdcSymbol)} for the Aerodrome Slipstream router...`);
    const approveHash = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [AERODROME_SLIPSTREAM_SWAP_ROUTER, amountIn],
    });
    console.log(`Approval tx: ${approveHash}`);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const params = {
    tokenIn: USDC,
    tokenOut: WETH,
    tickSpacing: best.tickSpacing,
    recipient,
    deadline,
    amountIn,
    amountOutMinimum,
    sqrtPriceLimitX96: 0n,
  } as const;
  const simulation = await publicClient.simulateContract({
    account,
    address: AERODROME_SLIPSTREAM_SWAP_ROUTER,
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [params],
  });
  console.log("");
  console.log(`Swap simulation output: ${fmt(simulation.result, wethDecimals, wethSymbol)}`);

  const swapHash = await walletClient.writeContract(simulation.request);
  console.log(`Swap tx: ${swapHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
  console.log(`Swap confirmed in block ${receipt.blockNumber} with status ${receipt.status}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
