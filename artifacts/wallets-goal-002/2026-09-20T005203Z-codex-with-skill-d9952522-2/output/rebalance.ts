import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatGwei,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  publicActions,
  type Address,
  type Hex,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MAINNET_CONTRACTS = {
  WETH: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  USDC: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  UNISWAP_V3_FACTORY: getAddress("0x1F98431c8aD98523631AE4a59f267346ea31F984"),
  UNISWAP_V3_SWAP_ROUTER: getAddress("0xE592427A0AEce92De3Edee1F18E0157C05861564"),
  UNISWAP_V3_QUOTER_V2: getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),
} as const;

const TOKEN_META = {
  [MAINNET_CONTRACTS.WETH]: { symbol: "WETH", decimals: 18 },
  [MAINNET_CONTRACTS.USDC]: { symbol: "USDC", decimals: 6 },
} as const;

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
          { name: "fee", type: "uint24" },
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

const quoterV2Abi = [
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
] as const;

const factoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

type Direction = "USDC_TO_WETH" | "WETH_TO_USDC";
type PoolFee = 500 | 3000 | 10000;

type RebalanceDecision = {
  id: string;
  direction: Direction;
  amountIn: string;
  poolFee?: PoolFee;
  maxSlippageBps?: number;
  deadlineSeconds?: number;
};

type BotState = {
  day: string;
  usedUsd6: string;
  executedDecisionIds: string[];
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const STATE_FILE = process.env.REBALANCE_STATE_FILE ?? "rebalance-state.json";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function parsePrivateKey(value: string): Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("AGENT_PRIVATE_KEY must be a 32-byte 0x-prefixed private key");
  }
  return value as Hex;
}

function bpsDiscount(value: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 1 || bps > 1_000) {
    throw new Error("maxSlippageBps must be an integer from 1 to 1000");
  }
  return (value * BigInt(10_000 - bps)) / 10_000n;
}

function getPair(direction: Direction): { tokenIn: Address; tokenOut: Address } {
  if (direction === "USDC_TO_WETH") {
    return { tokenIn: MAINNET_CONTRACTS.USDC, tokenOut: MAINNET_CONTRACTS.WETH };
  }
  if (direction === "WETH_TO_USDC") {
    return { tokenIn: MAINNET_CONTRACTS.WETH, tokenOut: MAINNET_CONTRACTS.USDC };
  }
  throw new Error(`Unsupported direction: ${direction}`);
}

function tokenLabel(token: Address, amount: bigint): string {
  const meta = TOKEN_META[token];
  return `${formatUnits(amount, meta.decimals)} ${meta.symbol}`;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadState(): Promise<BotState> {
  if (!existsSync(STATE_FILE)) {
    return { day: todayUtc(), usedUsd6: "0", executedDecisionIds: [] };
  }

  const parsed = JSON.parse(await readFile(STATE_FILE, "utf8")) as BotState;
  if (parsed.day !== todayUtc()) {
    return { day: todayUtc(), usedUsd6: "0", executedDecisionIds: [] };
  }
  return parsed;
}

async function saveState(state: BotState): Promise<void> {
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function validateDecision(decision: RebalanceDecision): Required<RebalanceDecision> {
  if (!decision.id || !/^[a-zA-Z0-9._:-]{6,120}$/.test(decision.id)) {
    throw new Error("decision.id must be a stable 6-120 char idempotency key");
  }
  return {
    id: decision.id,
    direction: decision.direction,
    amountIn: decision.amountIn,
    poolFee: decision.poolFee ?? 500,
    maxSlippageBps: decision.maxSlippageBps ?? 50,
    deadlineSeconds: decision.deadlineSeconds ?? 120,
  };
}

function assertUsdNotional(usd6: bigint): void {
  const min = parseUnits(process.env.MIN_TRADE_USD ?? "10000", 6);
  const max = parseUnits(process.env.MAX_TRADE_USD ?? "50000", 6);
  if (usd6 < min || usd6 > max) {
    throw new Error(
      `Trade notional ${formatUnits(usd6, 6)} USDC is outside ` +
        `[${formatUnits(min, 6)}, ${formatUnits(max, 6)}] USDC`,
    );
  }
}

async function assertDailyCap(nextUsd6: bigint, decisionId: string): Promise<BotState> {
  const state = await loadState();
  if (state.executedDecisionIds.includes(decisionId)) {
    throw new Error(`Decision ${decisionId} was already executed today`);
  }

  const dailyCap = parseUnits(process.env.MAX_DAILY_USD_NOTIONAL ?? "150000", 6);
  const used = BigInt(state.usedUsd6);
  if (used + nextUsd6 > dailyCap) {
    throw new Error(
      `Daily cap exceeded: ${formatUnits(used + nextUsd6, 6)} USDC > ${formatUnits(dailyCap, 6)} USDC`,
    );
  }
  return state;
}

async function main(): Promise<void> {
  const decisionArg = process.argv[2] ?? process.env.REBALANCE_DECISION_JSON;
  if (!decisionArg) {
    throw new Error("Pass a decision JSON file path or set REBALANCE_DECISION_JSON");
  }

  const rawDecision = decisionArg.trim().startsWith("{")
    ? decisionArg
    : await readFile(decisionArg, "utf8");
  const decision = validateDecision(JSON.parse(rawDecision) as RebalanceDecision);

  const rpcUrl = requireEnv("RPC_URL");
  const account = privateKeyToAccount(parsePrivateKey(requireEnv("AGENT_PRIVATE_KEY")));
  const live = process.env.LIVE_TRADING === "1";

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(rpcUrl),
  }).extend(publicActions);

  const chainId = await publicClient.getChainId();
  if (chainId !== 1) throw new Error(`Refusing to run on chain ${chainId}; expected Ethereum mainnet chain 1`);

  const { tokenIn, tokenOut } = getPair(decision.direction);
  const tokenInMeta = TOKEN_META[tokenIn];
  const tokenOutMeta = TOKEN_META[tokenOut];
  const amountIn = parseUnits(decision.amountIn, tokenInMeta.decimals);
  if (amountIn <= 0n) throw new Error("amountIn must be positive");

  const pool = await publicClient.readContract({
    address: MAINNET_CONTRACTS.UNISWAP_V3_FACTORY,
    abi: factoryAbi,
    functionName: "getPool",
    args: [tokenIn, tokenOut, decision.poolFee],
  });
  if (pool === ZERO_ADDRESS) {
    throw new Error(`No Uniswap v3 pool for ${tokenInMeta.symbol}/${tokenOutMeta.symbol} fee ${decision.poolFee}`);
  }

  const [balanceIn, allowance, ethBalance, fees] = await Promise.all([
    publicClient.readContract({
      address: tokenIn,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.readContract({
      address: tokenIn,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, MAINNET_CONTRACTS.UNISWAP_V3_SWAP_ROUTER],
    }),
    publicClient.getBalance({ address: account.address }),
    publicClient.estimateFeesPerGas(),
  ]);

  if (balanceIn < amountIn) {
    throw new Error(`Insufficient ${tokenInMeta.symbol}: have ${tokenLabel(tokenIn, balanceIn)}, need ${tokenLabel(tokenIn, amountIn)}`);
  }

  const maxFeeGwei = Number(formatGwei(fees.maxFeePerGas ?? 0n));
  const maxAllowedFeeGwei = Number(process.env.MAX_FEE_PER_GAS_GWEI ?? "80");
  if (maxFeeGwei > maxAllowedFeeGwei) {
    throw new Error(`Gas too expensive: maxFeePerGas ${maxFeeGwei} gwei > ${maxAllowedFeeGwei} gwei`);
  }

  const { result: quote } = await publicClient.simulateContract({
    account: account.address,
    address: MAINNET_CONTRACTS.UNISWAP_V3_QUOTER_V2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        amountIn,
        fee: decision.poolFee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const [quotedAmountOut, sqrtPriceX96After, initializedTicksCrossed, quoteGasEstimate] = quote;
  const amountOutMinimum = bpsDiscount(quotedAmountOut, decision.maxSlippageBps);
  const usdNotional6 = tokenIn === MAINNET_CONTRACTS.USDC ? amountIn : quotedAmountOut;
  assertUsdNotional(usdNotional6);
  const state = await assertDailyCap(usdNotional6, decision.id);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + decision.deadlineSeconds);
  const swapArgs = [
    {
      tokenIn,
      tokenOut,
      fee: decision.poolFee,
      recipient: account.address,
      deadline,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    },
  ] as const;

  console.log("mainnet rebalance preflight");
  console.log(`  signer/owner:              ${account.address}`);
  console.log(`  tokenIn:                   ${tokenInMeta.symbol} ${tokenIn}`);
  console.log(`  tokenOut:                  ${tokenOutMeta.symbol} ${tokenOut}`);
  console.log(`  UniswapV3Factory:          ${MAINNET_CONTRACTS.UNISWAP_V3_FACTORY}`);
  console.log(`  UniswapV3Pool:             ${pool}`);
  console.log(`  UniswapV3QuoterV2:         ${MAINNET_CONTRACTS.UNISWAP_V3_QUOTER_V2}`);
  console.log(`  UniswapV3SwapRouter:       ${MAINNET_CONTRACTS.UNISWAP_V3_SWAP_ROUTER}`);
  console.log(`  amountIn:                  ${tokenLabel(tokenIn, amountIn)}`);
  console.log(`  quotedAmountOut:           ${tokenLabel(tokenOut, quotedAmountOut)}`);
  console.log(`  amountOutMinimum:          ${tokenLabel(tokenOut, amountOutMinimum)}`);
  console.log(`  usdNotional:               ${formatUnits(usdNotional6, 6)} USDC`);
  console.log(`  current allowance:         ${tokenLabel(tokenIn, allowance)}`);
  console.log(`  signer ETH for gas:        ${formatUnits(ethBalance, 18)} ETH`);
  console.log(`  maxFeePerGas:              ${maxFeeGwei} gwei`);
  console.log(`  quoter gas estimate:       ${quoteGasEstimate.toString()}`);
  console.log(`  sqrtPriceX96After quote:   ${sqrtPriceX96After.toString()}`);
  console.log(`  initialized ticks crossed: ${initializedTicksCrossed.toString()}`);
  console.log(`  mode:                      ${live ? "LIVE_TRADING=1, will sign" : "dry run, no signatures"}`);

  if (!live) return;

  if (allowance < amountIn) {
    if (allowance > 0n) {
      const { request } = await publicClient.simulateContract({
        account,
        address: tokenIn,
        abi: erc20Abi,
        functionName: "approve",
        args: [MAINNET_CONTRACTS.UNISWAP_V3_SWAP_ROUTER, 0n],
      });
      const hash = await walletClient.writeContract(request);
      console.log(`approve reset submitted:     ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
    }

    const { request } = await publicClient.simulateContract({
      account,
      address: tokenIn,
      abi: erc20Abi,
      functionName: "approve",
      args: [MAINNET_CONTRACTS.UNISWAP_V3_SWAP_ROUTER, amountIn],
    });
    const hash = await walletClient.writeContract(request);
    console.log(`approve amount submitted:    ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
  }

  const gas = await publicClient.estimateContractGas({
    account,
    address: MAINNET_CONTRACTS.UNISWAP_V3_SWAP_ROUTER,
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: swapArgs,
    value: 0n,
  });
  const maxSwapGas = BigInt(process.env.MAX_SWAP_GAS_UNITS ?? "350000");
  if (gas > maxSwapGas) {
    throw new Error(`Swap gas estimate ${gas.toString()} exceeds MAX_SWAP_GAS_UNITS ${maxSwapGas.toString()}`);
  }

  const { request, result: simulatedAmountOut } = await publicClient.simulateContract({
    account,
    address: MAINNET_CONTRACTS.UNISWAP_V3_SWAP_ROUTER,
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: swapArgs,
    value: 0n,
  });
  console.log(`simulated swap output:       ${tokenLabel(tokenOut, simulatedAmountOut)}`);
  console.log(`estimated swap gas:          ${gas.toString()}`);

  const swapHash = await walletClient.writeContract(request);
  console.log(`swap submitted:              ${swapHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
  if (receipt.status !== "success") {
    throw new Error(`Swap reverted in transaction ${swapHash}`);
  }

  state.usedUsd6 = (BigInt(state.usedUsd6) + usdNotional6).toString();
  state.executedDecisionIds.push(decision.id);
  await saveState(state);

  console.log(`swap confirmed in block:     ${receipt.blockNumber.toString()}`);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
