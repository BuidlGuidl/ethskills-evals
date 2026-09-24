import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const WETH = "0x4200000000000000000000000000000000000006" as const;

// Aerodrome Slipstream on Base. Source: https://aerodrome-finance.app/security/
const SLIPSTREAM_POOL_FACTORY = "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A" as const;
const SLIPSTREAM_QUOTER = "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0" as const;
const SLIPSTREAM_SWAP_ROUTER = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5" as const;

const USDC_DECIMALS = 6;
const WETH_DECIMALS = 18;
const BPS_DENOMINATOR = 10_000n;
const DEFAULT_TICK_SPACINGS = [1, 50, 100, 200] as const;

const erc20Abi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const poolFactoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "tickSpacing", type: "int24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

const quoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
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
] as const;

const swapRouterAbi = [
  {
    type: "function",
    name: "factory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "WETH9",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "exactInputSingle",
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
] as const;

type Quote = {
  tickSpacing: number;
  pool: Address;
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  initializedTicksCrossed: number;
  gasEstimate: bigint;
};

const env = process.env;

function requireEnv(name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function normalizePrivateKey(value: string): `0x${string}` {
  return value.startsWith("0x") ? (value as `0x${string}`) : `0x${value}`;
}

function parseBps(value: string | undefined, fallback: number): bigint {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1_000) {
    throw new Error("MAX_SLIPPAGE_BPS must be an integer from 1 to 1000");
  }
  return BigInt(parsed);
}

function parseDeadlineSeconds(value: string | undefined): bigint {
  const parsed = value === undefined ? 120 : Number(value);
  if (!Number.isInteger(parsed) || parsed < 30 || parsed > 1_800) {
    throw new Error("DEADLINE_SECONDS must be an integer from 30 to 1800");
  }
  return BigInt(parsed);
}

function parseTickSpacings(value: string | undefined): number[] {
  if (!value) {
    return [...DEFAULT_TICK_SPACINGS];
  }

  const parsed = value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((tickSpacing) => Number.isInteger(tickSpacing));

  if (parsed.length === 0) {
    throw new Error("TICK_SPACINGS must be a comma-separated list of integers");
  }

  return [...new Set(parsed)];
}

function applySlippage(amountOut: bigint, slippageBps: bigint): bigint {
  return (amountOut * (BPS_DENOMINATOR - slippageBps)) / BPS_DENOMINATOR;
}

function sortQuotes(a: Quote, b: Quote): number {
  if (a.amountOut === b.amountOut) {
    return 0;
  }
  return a.amountOut > b.amountOut ? -1 : 1;
}

async function main() {
  const account = privateKeyToAccount(normalizePrivateKey(requireEnv("PRIVATE_KEY")));
  const rpcUrl = env.RPC_URL ?? "https://mainnet.base.org";
  const recipient = (env.RECIPIENT ?? account.address) as Address;
  const amountIn = parseUnits(requireEnv("AMOUNT_USDC"), USDC_DECIMALS);
  const slippageBps = parseBps(env.MAX_SLIPPAGE_BPS, 30);
  const deadlineSeconds = parseDeadlineSeconds(env.DEADLINE_SECONDS);
  const execute = env.EXECUTE === "1" || env.EXECUTE?.toLowerCase() === "true";
  const tickSpacings = parseTickSpacings(env.TICK_SPACINGS);

  if (!isAddress(recipient)) {
    throw new Error(`Invalid RECIPIENT address: ${recipient}`);
  }
  if (amountIn <= 0n) {
    throw new Error("AMOUNT_USDC must be greater than zero");
  }

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== base.id) {
    throw new Error(`RPC_URL is connected to chain ${chainId}, expected Base mainnet ${base.id}`);
  }

  const [usdcSymbol, usdcDecimals, wethSymbol, routerFactory, routerWeth] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({
      address: SLIPSTREAM_SWAP_ROUTER,
      abi: swapRouterAbi,
      functionName: "factory",
    }),
    publicClient.readContract({
      address: SLIPSTREAM_SWAP_ROUTER,
      abi: swapRouterAbi,
      functionName: "WETH9",
    }),
  ]);

  if (usdcSymbol !== "USDC" || usdcDecimals !== USDC_DECIMALS) {
    throw new Error(`Unexpected USDC contract identity: ${usdcSymbol}/${usdcDecimals}`);
  }
  if (wethSymbol !== "WETH") {
    throw new Error(`Unexpected WETH contract identity: ${wethSymbol}`);
  }
  if (routerFactory.toLowerCase() !== SLIPSTREAM_POOL_FACTORY.toLowerCase()) {
    throw new Error(`Unexpected Slipstream router factory: ${routerFactory}`);
  }
  if (routerWeth.toLowerCase() !== WETH.toLowerCase()) {
    throw new Error(`Unexpected Slipstream router WETH9: ${routerWeth}`);
  }

  const quotes: Quote[] = [];
  for (const tickSpacing of tickSpacings) {
    const pool = await publicClient.readContract({
      address: SLIPSTREAM_POOL_FACTORY,
      abi: poolFactoryAbi,
      functionName: "getPool",
      args: [USDC, WETH, tickSpacing],
    });

    if (pool === zeroAddress) {
      console.log(`tickSpacing ${tickSpacing}: no USDC/WETH pool`);
      continue;
    }

    try {
      const { result } = await publicClient.simulateContract({
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
        account: account.address,
      });

      const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result;
      quotes.push({
        tickSpacing,
        pool,
        amountOut,
        sqrtPriceX96After,
        initializedTicksCrossed,
        gasEstimate,
      });
    } catch (error) {
      console.warn(`tickSpacing ${tickSpacing}: quote failed`, error);
    }
  }

  quotes.sort(sortQuotes);
  const best = quotes[0];
  if (!best) {
    throw new Error("No executable Aerodrome Slipstream USDC/WETH quote found");
  }

  const amountOutMinimum = applySlippage(best.amountOut, slippageBps);
  const balance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  console.log(`wallet:       ${account.address}`);
  console.log(`recipient:    ${recipient}`);
  console.log(`amount in:    ${formatUnits(amountIn, USDC_DECIMALS)} USDC`);
  console.log(`slippage:     ${slippageBps} bps`);
  console.log("");
  console.log("Aerodrome Slipstream direct quotes:");
  for (const quote of quotes) {
    console.log(
      `  tickSpacing ${quote.tickSpacing.toString().padStart(3)} pool ${quote.pool} -> ${formatUnits(
        quote.amountOut,
        WETH_DECIMALS,
      )} WETH`,
    );
  }
  console.log("");
  console.log(`selected:     tickSpacing ${best.tickSpacing} (${best.pool})`);
  console.log(`quoted out:   ${formatUnits(best.amountOut, WETH_DECIMALS)} WETH`);
  console.log(`min out:      ${formatUnits(amountOutMinimum, WETH_DECIMALS)} WETH`);

  if (balance < amountIn) {
    const message = `Insufficient USDC balance: have ${formatUnits(
      balance,
      USDC_DECIMALS,
    )}, need ${formatUnits(amountIn, USDC_DECIMALS)}`;
    if (execute) {
      throw new Error(message);
    }
    console.warn(message);
  }

  if (!execute) {
    console.log("");
    console.log("Dry run only. Set EXECUTE=1 to approve and submit the swap.");
    return;
  }

  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SLIPSTREAM_SWAP_ROUTER],
  });

  if (allowance < amountIn) {
    if (allowance > 0n) {
      console.log("Resetting existing USDC allowance to 0...");
      const resetHash = await walletClient.writeContract({
        address: USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [SLIPSTREAM_SWAP_ROUTER, 0n],
      });
      console.log(`approve(0) tx: ${resetHash}`);
      await publicClient.waitForTransactionReceipt({ hash: resetHash });
    }

    console.log("Approving USDC for the Slipstream SwapRouter...");
    const approveHash = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [SLIPSTREAM_SWAP_ROUTER, amountIn],
    });
    console.log(`approve tx:   ${approveHash}`);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const latestBlock = await publicClient.getBlock();
  const deadline = (latestBlock.timestamp ?? BigInt(Math.floor(Date.now() / 1000))) + deadlineSeconds;
  const params = {
    tokenIn: USDC,
    tokenOut: WETH,
    tickSpacing: best.tickSpacing,
    recipient,
    deadline,
    amountIn,
    amountOutMinimum,
    sqrtPriceLimitX96: 0n,
  };

  const { request, result: simulatedAmountOut } = await publicClient.simulateContract({
    address: SLIPSTREAM_SWAP_ROUTER,
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [params],
    account,
    value: 0n,
  });

  console.log(`simulated out:${formatUnits(simulatedAmountOut, WETH_DECIMALS)} WETH`);
  const swapHash = await walletClient.writeContract(request);
  console.log(`swap tx:      ${swapHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
  console.log(`status:       ${receipt.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
