import "dotenv/config";

import {
  type Address,
  BaseError,
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  maxUint256,
  parseUnits,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const WETH = getAddress("0x4200000000000000000000000000000000000006");

const AERODROME_SLIPSTREAM_FACTORY = getAddress("0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A");
const AERODROME_SLIPSTREAM_QUOTER = getAddress("0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0");
const AERODROME_SLIPSTREAM_SWAP_ROUTER = getAddress("0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5");

const TICK_SPACINGS = [1, 50, 100, 200, 2000] as const;
const DEFAULT_SLIPPAGE_BPS = 30n;
const DEFAULT_DEADLINE_SECONDS = 120n;

const factoryAbi = [
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

type TickSpacing = (typeof TICK_SPACINGS)[number];

type Quote = {
  tickSpacing: TickSpacing;
  pool: Address;
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  initializedTicksCrossed: number;
  gasEstimate: bigint;
};

const rpcUrl = env("BASE_RPC_URL", "https://base-rpc.publicnode.com");
const publicClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl),
});

async function main() {
  const chainId = await publicClient.getChainId();
  if (chainId !== base.id) {
    throw new Error(`BASE_RPC_URL must point to Base mainnet chainId ${base.id}; got ${chainId}`);
  }

  const amountIn = parseUnits(env("USDC_AMOUNT"), 6);
  const slippageBps = parseBigIntEnv("SLIPPAGE_BPS", DEFAULT_SLIPPAGE_BPS);
  const deadlineSeconds = parseBigIntEnv("DEADLINE_SECONDS", DEFAULT_DEADLINE_SECONDS);
  const execute = env("EXECUTE", "false").toLowerCase() === "true";
  const approveMax = env("APPROVE_MAX", "false").toLowerCase() === "true";

  if (slippageBps < 0n || slippageBps >= 10_000n) {
    throw new Error("SLIPPAGE_BPS must be between 0 and 9999");
  }

  const account = privateKeyToAccount(asPrivateKey(env("PRIVATE_KEY")));
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });
  const recipient = getAddress(env("RECIPIENT", account.address));

  await assertToken("USDC", USDC, 6);
  await assertToken("WETH", WETH, 18);
  await assertHasCode("Slipstream factory", AERODROME_SLIPSTREAM_FACTORY);
  await assertHasCode("Slipstream quoter", AERODROME_SLIPSTREAM_QUOTER);
  await assertHasCode("Slipstream swap router", AERODROME_SLIPSTREAM_SWAP_ROUTER);

  let selected = await selectBestQuote(amountIn, account.address);
  let amountOutMinimum = applySlippage(selected.amountOut, slippageBps);

  printQuote("Initial quote", selected, amountIn, amountOutMinimum, slippageBps, recipient);

  if (!execute) {
    console.log("Dry run only. Set EXECUTE=true to approve and swap on Base mainnet.");
    return;
  }

  const balance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance < amountIn) {
    throw new Error(`Insufficient USDC balance: have ${formatUnits(balance, 6)}, need ${formatUnits(amountIn, 6)}`);
  }

  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, AERODROME_SLIPSTREAM_SWAP_ROUTER],
  });

  if (allowance < amountIn) {
    const approvalAmount = approveMax ? maxUint256 : amountIn;
    console.log(`Approving ${approveMax ? "max USDC" : `${formatUnits(approvalAmount, 6)} USDC`}...`);
    const approveHash = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [AERODROME_SLIPSTREAM_SWAP_ROUTER, approvalAmount],
    });
    console.log(`Approval tx: ${approveHash}`);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  selected = await selectBestQuote(amountIn, account.address);
  amountOutMinimum = applySlippage(selected.amountOut, slippageBps);
  printQuote("Execution quote", selected, amountIn, amountOutMinimum, slippageBps, recipient);

  const deadline = BigInt(Math.floor(Date.now() / 1000)) + deadlineSeconds;
  const params = {
    tokenIn: USDC,
    tokenOut: WETH,
    tickSpacing: selected.tickSpacing,
    recipient,
    deadline,
    amountIn,
    amountOutMinimum,
    sqrtPriceLimitX96: 0n,
  };

  const simulation = await publicClient.simulateContract({
    account,
    address: AERODROME_SLIPSTREAM_SWAP_ROUTER,
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [params],
    value: 0n,
  });

  console.log(`Simulated output: ${formatUnits(simulation.result, 18)} WETH`);
  const hash = await walletClient.writeContract(simulation.request);
  console.log(`Swap tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Swap confirmed in block ${receipt.blockNumber} with status ${receipt.status}`);
}

async function selectBestQuote(amountIn: bigint, account: Address): Promise<Quote> {
  const quotes: Quote[] = [];
  for (const tickSpacing of TICK_SPACINGS) {
    const quote = await quotePool(tickSpacing, amountIn, account);
    if (quote) {
      quotes.push(quote);
    }
  }
  quotes.sort((a, b) => (a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0));

  if (quotes.length === 0) {
    throw new Error("No usable Aerodrome Slipstream USDC/WETH quote found");
  }

  console.table(
    quotes.map((quote) => ({
      tickSpacing: quote.tickSpacing,
      pool: quote.pool,
      amountOutWeth: formatUnits(quote.amountOut, 18),
      ticksCrossed: quote.initializedTicksCrossed,
      quoteGas: quote.gasEstimate.toString(),
    })),
  );

  return quotes[0];
}

async function quotePool(tickSpacing: TickSpacing, amountIn: bigint, account: Address): Promise<Quote | null> {
  const forced = process.env.TICK_SPACING;
  if (forced !== undefined && BigInt(forced) !== BigInt(tickSpacing)) {
    return null;
  }

  const pool = await publicClient.readContract({
    address: AERODROME_SLIPSTREAM_FACTORY,
    abi: factoryAbi,
    functionName: "getPool",
    args: [USDC, WETH, tickSpacing],
  });
  if (pool === zeroAddress) {
    return null;
  }

  const data = encodeFunctionData({
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
  });

  try {
    const result = await publicClient.call({
      account,
      to: AERODROME_SLIPSTREAM_QUOTER,
      data,
      gas: 30_000_000n,
    });
    if (!result.data) {
      return null;
    }
    const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = decodeFunctionResult({
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      data: result.data,
    });
    if (amountOut === 0n) {
      return null;
    }
    return {
      tickSpacing,
      pool,
      amountOut,
      sqrtPriceX96After,
      initializedTicksCrossed,
      gasEstimate,
    };
  } catch (error) {
    console.warn(`Skipping tick spacing ${tickSpacing}: ${shortError(error)}`);
    return null;
  }
}

function applySlippage(amountOut: bigint, slippageBps: bigint): bigint {
  return (amountOut * (10_000n - slippageBps)) / 10_000n;
}

function printQuote(
  label: string,
  selected: Quote,
  amountIn: bigint,
  amountOutMinimum: bigint,
  slippageBps: bigint,
  recipient: Address,
) {
  console.log(label);
  console.log(`Selected tick spacing: ${selected.tickSpacing}`);
  console.log(`Pool: ${selected.pool}`);
  console.log(`Input: ${formatUnits(amountIn, 6)} USDC`);
  console.log(`Quoted output: ${formatUnits(selected.amountOut, 18)} WETH`);
  console.log(`Minimum output (${slippageBps} bps slippage): ${formatUnits(amountOutMinimum, 18)} WETH`);
  console.log(`Recipient: ${recipient}`);
}

async function assertToken(expectedSymbol: string, token: Address, expectedDecimals: number) {
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
  ]);
  if (symbol !== expectedSymbol || decimals !== expectedDecimals) {
    throw new Error(
      `${token} identity mismatch: expected ${expectedSymbol}/${expectedDecimals}, got ${symbol}/${decimals}`,
    );
  }
}

async function assertHasCode(name: string, address: Address) {
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x") {
    throw new Error(`${name} has no code at ${address} on Base mainnet`);
  }
}

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

function parseBigIntEnv(name: string, fallback: bigint): bigint {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : BigInt(raw);
}

function asPrivateKey(value: string): `0x${string}` {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex private key");
  }
  return normalized as `0x${string}`;
}

function shortError(error: unknown): string {
  if (error instanceof BaseError) {
    return [error.shortMessage, error.details, error.cause instanceof BaseError ? error.cause.shortMessage : undefined]
      .filter(Boolean)
      .join("\n");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

main().catch((error) => {
  console.error(shortError(error));
  process.exit(1);
});
