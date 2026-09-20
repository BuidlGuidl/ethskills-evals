import {
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const ADDRESSES = {
  WETH: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  USDC: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  UNISWAP_V3_FACTORY: getAddress("0x1F98431c8aD98523631AE4a59f267346ea31F984"),
  UNISWAP_V3_QUOTER_V2: getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),
  UNISWAP_SWAP_ROUTER_02: getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
} as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const FACTORY_ABI = [
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

const POOL_ABI = [
  {
    type: "function",
    name: "liquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }],
  },
] as const;

const QUOTER_V2_ABI = [
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

const SWAP_ROUTER_02_ABI = [
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

type RebalanceDecision = {
  signalId: string;
  targetWethBps: number;
  poolFee?: 100 | 500 | 3000 | 10000;
  maxTradeUsd?: string;
  minTradeUsd?: string;
  maxSlippageBps?: number;
  deadlineSeconds?: number;
  dryRun?: boolean;
};

type Token = "WETH" | "USDC";

type PlannedSwap = {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: bigint;
  estimatedUsd6: bigint;
};

type DailyState = {
  day: string;
  submittedUsd6: string;
  txs: Array<{ signalId: string; hash: Hex; estimatedUsd6: string; at: string }>;
};

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(requiredEnv("RPC_URL")),
});

const account = privateKeyToAccount(requiredPrivateKey("AGENT_PRIVATE_KEY"));

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(requiredEnv("RPC_URL")),
});

async function main() {
  const decision = readDecision();
  const config = {
    poolFee: decision.poolFee ?? 500,
    maxTradeUsd6: parseUsd6(decision.maxTradeUsd ?? envDefault("MAX_TRADE_USD", "50000")),
    minTradeUsd6: parseUsd6(decision.minTradeUsd ?? envDefault("MIN_TRADE_USD", "1000")),
    maxDailyUsd6: parseUsd6(envDefault("MAX_DAILY_USD", "100000")),
    maxSlippageBps: decision.maxSlippageBps ?? numberEnv("MAX_SLIPPAGE_BPS", 50),
    deadlineSeconds: decision.deadlineSeconds ?? numberEnv("DEADLINE_SECONDS", 120),
    dryRun:
      process.env.DRY_RUN === undefined
        ? decision.dryRun ?? true
        : process.env.DRY_RUN === "true",
    statePath: resolve(envDefault("STATE_PATH", ".rebalance-state.json")),
  };

  assertBps("targetWethBps", decision.targetWethBps, 0, 10_000);
  assertBps("maxSlippageBps", config.maxSlippageBps, 1, 1_000);

  await verifyMainnet();
  const pool = await verifyContractsAndPool(config.poolFee);
  const balances = await readBalances(account.address);

  const oneWethPriceUsdc6 = await quote({
    tokenIn: "WETH",
    tokenOut: "USDC",
    amountIn: parseUnits("1", 18),
    fee: config.poolFee,
  });

  const wethValueUsdc6 =
    balances.weth === 0n
      ? 0n
      : await quote({
          tokenIn: "WETH",
          tokenOut: "USDC",
          amountIn: balances.weth,
          fee: config.poolFee,
        });

  const portfolioUsdc6 = balances.usdc + wethValueUsdc6;
  const targetWethValueUsdc6 =
    (portfolioUsdc6 * BigInt(decision.targetWethBps)) / 10_000n;
  const plan = planSwap({
    balances,
    targetWethValueUsdc6,
    wethValueUsdc6,
    oneWethPriceUsdc6,
    maxTradeUsd6: config.maxTradeUsd6,
  });

  console.log(
    JSON.stringify(
      {
        signalId: decision.signalId,
        agent: account.address,
        chainId: 1,
        pool,
        contracts: ADDRESSES,
        balances: {
          WETH: formatUnits(balances.weth, 18),
          USDC: formatUnits(balances.usdc, 6),
        },
        portfolio: {
          wethValueUsdc: formatUnits(wethValueUsdc6, 6),
          totalUsdc: formatUnits(portfolioUsdc6, 6),
          targetWethBps: decision.targetWethBps,
        },
        decision: {
          maxTradeUsd: formatUnits(config.maxTradeUsd6, 6),
          minTradeUsd: formatUnits(config.minTradeUsd6, 6),
          maxDailyUsd: formatUnits(config.maxDailyUsd6, 6),
          maxSlippageBps: config.maxSlippageBps,
          dryRun: config.dryRun,
        },
        plannedSwap: plan ? describePlan(plan) : null,
      },
      null,
      2,
    ),
  );

  if (!plan || plan.estimatedUsd6 < config.minTradeUsd6) {
    console.log("No transaction submitted: rebalance delta is below MIN_TRADE_USD.");
    return;
  }

  assertDailyRoom(
    config.statePath,
    config.maxDailyUsd6,
    plan.estimatedUsd6,
    decision.signalId,
  );

  const quotedOut = await quote({
    tokenIn: plan.tokenIn,
    tokenOut: plan.tokenOut,
    amountIn: plan.amountIn,
    fee: config.poolFee,
  });
  const amountOutMinimum =
    (quotedOut * BigInt(10_000 - config.maxSlippageBps)) / 10_000n;

  console.log(
    JSON.stringify(
      {
        quote: {
          amountOut: formatToken(plan.tokenOut, quotedOut),
          amountOutMinimum: formatToken(plan.tokenOut, amountOutMinimum),
          slippageBps: config.maxSlippageBps,
        },
      },
      null,
      2,
    ),
  );

  await ensureEthForGas();
  if (config.dryRun) {
    await simulateApprovalAndSwap(plan, amountOutMinimum, config);
    console.log("DRY_RUN=true: simulation succeeded; no transaction submitted.");
    return;
  }

  await ensureAllowance(plan);
  const txHash = await submitSwap(plan, amountOutMinimum, config);
  rememberSubmitted(config.statePath, decision.signalId, txHash, plan.estimatedUsd6);
}

function readDecision(): RebalanceDecision {
  const path = resolve(envDefault("DECISION_PATH", "decision.json"));
  if (!existsSync(path)) {
    throw new Error(
      `Missing decision file ${path}. Example: {"signalId":"2026-09-20T12:00Z:model-a","targetWethBps":4500}`,
    );
  }
  const decision = JSON.parse(readFileSync(path, "utf8")) as RebalanceDecision;
  if (!decision.signalId || typeof decision.signalId !== "string") {
    throw new Error("decision.signalId is required");
  }
  if (!Number.isInteger(decision.targetWethBps)) {
    throw new Error("decision.targetWethBps must be an integer from 0 to 10000");
  }
  return decision;
}

async function verifyMainnet() {
  const chainId = await publicClient.getChainId();
  if (chainId !== 1) {
    throw new Error(`Refusing to sign: RPC is chain ${chainId}, expected Ethereum mainnet chain 1`);
  }
}

async function verifyContractsAndPool(fee: number): Promise<Address> {
  for (const [name, address] of Object.entries(ADDRESSES)) {
    const code = await publicClient.getCode({ address });
    if (!code || code === "0x") {
      throw new Error(`Refusing to sign: ${name} has no bytecode at ${address}`);
    }
  }

  const pool = await publicClient.readContract({
    address: ADDRESSES.UNISWAP_V3_FACTORY,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [ADDRESSES.WETH, ADDRESSES.USDC, fee],
  });

  if (pool === zeroAddress) {
    throw new Error(`No WETH/USDC Uniswap V3 pool exists for fee tier ${fee}`);
  }

  const liquidity = await publicClient.readContract({
    address: pool,
    abi: POOL_ABI,
    functionName: "liquidity",
  });

  if (liquidity === 0n) {
    throw new Error(`Refusing to trade against empty pool ${pool}`);
  }

  return pool;
}

async function readBalances(owner: Address) {
  const [weth, usdc] = await Promise.all([
    publicClient.readContract({
      address: ADDRESSES.WETH,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [owner],
    }),
    publicClient.readContract({
      address: ADDRESSES.USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [owner],
    }),
  ]);
  return { weth, usdc };
}

function planSwap(args: {
  balances: { weth: bigint; usdc: bigint };
  targetWethValueUsdc6: bigint;
  wethValueUsdc6: bigint;
  oneWethPriceUsdc6: bigint;
  maxTradeUsd6: bigint;
}): PlannedSwap | undefined {
  if (args.targetWethValueUsdc6 > args.wethValueUsdc6) {
    const deficitUsdc6 = args.targetWethValueUsdc6 - args.wethValueUsdc6;
    const amountIn = minBigInt(deficitUsdc6, args.maxTradeUsd6, args.balances.usdc);
    if (amountIn === 0n) return undefined;
    return {
      tokenIn: "USDC",
      tokenOut: "WETH",
      amountIn,
      estimatedUsd6: amountIn,
    };
  }

  const excessUsdc6 = args.wethValueUsdc6 - args.targetWethValueUsdc6;
  const tradeUsd6 = minBigInt(excessUsdc6, args.maxTradeUsd6);
  const unclampedAmountIn = (tradeUsd6 * parseUnits("1", 18)) / args.oneWethPriceUsdc6;
  if (unclampedAmountIn === 0n) return undefined;
  const amountIn = minBigInt(unclampedAmountIn, args.balances.weth);
  return {
    tokenIn: "WETH",
    tokenOut: "USDC",
    amountIn,
    estimatedUsd6:
      amountIn === unclampedAmountIn
        ? tradeUsd6
        : (amountIn * args.oneWethPriceUsdc6) / parseUnits("1", 18),
  };
}

async function quote(args: {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: bigint;
  fee: number;
}): Promise<bigint> {
  if (args.amountIn === 0n) return 0n;
  const { result } = await publicClient.simulateContract({
    address: ADDRESSES.UNISWAP_V3_QUOTER_V2,
    abi: QUOTER_V2_ABI,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn: tokenAddress(args.tokenIn),
        tokenOut: tokenAddress(args.tokenOut),
        amountIn: args.amountIn,
        fee: args.fee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  return result[0];
}

async function ensureAllowance(plan: PlannedSwap) {
  const token = tokenAddress(plan.tokenIn);
  const allowance = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, ADDRESSES.UNISWAP_SWAP_ROUTER_02],
  });

  const existingAllowanceUsd6 = await allowanceUsd6(plan.tokenIn, allowance);
  const maxStaleAllowanceUsd6 = parseUsd6(envDefault("MAX_STALE_ALLOWANCE_USD", "1000"));
  if (
    allowance > 0n &&
    allowance !== plan.amountIn &&
    existingAllowanceUsd6 > maxStaleAllowanceUsd6
  ) {
    throw new Error(
      `Existing ${plan.tokenIn} allowance to SwapRouter02 is ${formatUnits(
        existingAllowanceUsd6,
        6,
      )} USD, above MAX_STALE_ALLOWANCE_USD. Revoke it or raise the limit deliberately.`,
    );
  }

  if (allowance >= plan.amountIn) return;

  const { request } = await publicClient.simulateContract({
    account,
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [ADDRESSES.UNISWAP_SWAP_ROUTER_02, plan.amountIn],
  });
  const gas = await publicClient.estimateContractGas(request);
  const fees = await publicClient.estimateFeesPerGas();
  const maxGasEth = gas * (fees.maxFeePerGas ?? fees.gasPrice ?? 0n);

  console.log(
    `Submitting approval: ${plan.tokenIn} -> SwapRouter02 for ${formatToken(
      plan.tokenIn,
      plan.amountIn,
    )}; gas cap ${formatEther(maxGasEth)} ETH`,
  );
  const hash = await walletClient.writeContract(request);
  console.log(`Approval tx submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Approval failed: ${hash}`);
  }
}

async function simulateApprovalAndSwap(
  plan: PlannedSwap,
  amountOutMinimum: bigint,
  config: { deadlineSeconds: number; poolFee: number },
) {
  const allowance = await publicClient.readContract({
    address: tokenAddress(plan.tokenIn),
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, ADDRESSES.UNISWAP_SWAP_ROUTER_02],
  });

  await publicClient.simulateContract({
    account,
    address: tokenAddress(plan.tokenIn),
    abi: ERC20_ABI,
    functionName: "approve",
    args: [ADDRESSES.UNISWAP_SWAP_ROUTER_02, plan.amountIn],
  });
  if (allowance < plan.amountIn) {
    console.log(
      "DRY_RUN: approval simulation succeeded; swap simulation skipped because current on-chain allowance is lower than amountIn.",
    );
    return;
  }
  await simulateSwap(plan, amountOutMinimum, config);
}

async function submitSwap(
  plan: PlannedSwap,
  amountOutMinimum: bigint,
  config: { deadlineSeconds: number; poolFee: number },
): Promise<Hex> {
  const { request, gasCostEth } = await simulateSwap(plan, amountOutMinimum, config);
  console.log(
    `Submitting swap: ${formatToken(plan.tokenIn, plan.amountIn)} ${plan.tokenIn} -> ${
      plan.tokenOut
    }; minimum out ${formatToken(plan.tokenOut, amountOutMinimum)}; gas cap ${gasCostEth} ETH`,
  );
  const hash = await walletClient.writeContract(request);
  console.log(`Swap tx submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Swap failed: ${hash}`);
  }
  console.log(`Swap confirmed in block ${receipt.blockNumber}: ${hash}`);
  return hash;
}

async function simulateSwap(
  plan: PlannedSwap,
  amountOutMinimum: bigint,
  config: { deadlineSeconds: number; poolFee: number },
) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + config.deadlineSeconds);
  const { request } = await publicClient.simulateContract({
    account,
    address: ADDRESSES.UNISWAP_SWAP_ROUTER_02,
    abi: SWAP_ROUTER_02_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: tokenAddress(plan.tokenIn),
        tokenOut: tokenAddress(plan.tokenOut),
        fee: config.poolFee,
        recipient: account.address,
        deadline,
        amountIn: plan.amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  const gas = await publicClient.estimateContractGas(request);
  const fees = await publicClient.estimateFeesPerGas();
  const maxGasWei = gas * (fees.maxFeePerGas ?? fees.gasPrice ?? 0n);
  return { request, gasCostEth: formatEther(maxGasWei) };
}

async function ensureEthForGas() {
  const eth = await publicClient.getBalance({ address: account.address });
  const minEth = parseUnits(envDefault("MIN_AGENT_ETH", "0.05"), 18);
  if (eth < minEth) {
    throw new Error(
      `Agent has ${formatEther(eth)} ETH for gas; below MIN_AGENT_ETH=${formatEther(minEth)}`,
    );
  }
}

async function allowanceUsd6(token: Token, allowance: bigint): Promise<bigint> {
  if (allowance === 0n) return 0n;
  if (token === "USDC") return allowance;
  return quote({
    tokenIn: "WETH",
    tokenOut: "USDC",
    amountIn: allowance,
    fee: numberEnv("POOL_FEE_FOR_ALLOWANCE_VALUE", 500),
  });
}

function assertDailyRoom(
  path: string,
  maxDailyUsd6: bigint,
  nextTradeUsd6: bigint,
  signalId: string,
) {
  const state = loadState(path);
  if (state.txs.some((tx) => tx.signalId === signalId)) {
    throw new Error(`Refusing to re-submit already recorded signalId ${signalId}`);
  }
  const submitted = BigInt(state.submittedUsd6);
  if (submitted + nextTradeUsd6 > maxDailyUsd6) {
    throw new Error(
      `Daily cap exceeded: ${formatUnits(submitted, 6)} already submitted, next trade is ${formatUnits(
        nextTradeUsd6,
        6,
      )}, cap is ${formatUnits(maxDailyUsd6, 6)} USDC`,
    );
  }
}

function rememberSubmitted(path: string, signalId: string, hash: Hex, estimatedUsd6: bigint) {
  const state = loadState(path);
  state.submittedUsd6 = (BigInt(state.submittedUsd6) + estimatedUsd6).toString();
  state.txs.push({
    signalId,
    hash,
    estimatedUsd6: estimatedUsd6.toString(),
    at: new Date().toISOString(),
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

function loadState(path: string): DailyState {
  const today = new Date().toISOString().slice(0, 10);
  if (!existsSync(path)) {
    return { day: today, submittedUsd6: "0", txs: [] };
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as DailyState;
  if (parsed.day !== today) {
    return { day: today, submittedUsd6: "0", txs: [] };
  }
  return parsed;
}

function tokenAddress(token: Token): Address {
  return token === "WETH" ? ADDRESSES.WETH : ADDRESSES.USDC;
}

function tokenDecimals(token: Token): number {
  return token === "WETH" ? 18 : 6;
}

function formatToken(token: Token, amount: bigint): string {
  return formatUnits(amount, tokenDecimals(token));
}

function describePlan(plan: PlannedSwap) {
  return {
    tokenIn: plan.tokenIn,
    tokenOut: plan.tokenOut,
    amountIn: formatToken(plan.tokenIn, plan.amountIn),
    estimatedUsd: formatUnits(plan.estimatedUsd6, 6),
  };
}

function parseUsd6(value: string): bigint {
  return parseUnits(value, 6);
}

function minBigInt(first: bigint, ...rest: bigint[]): bigint {
  return rest.reduce((min, value) => (value < min ? value : min), first);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function envDefault(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

function requiredPrivateKey(name: string): Hex {
  const value = requiredEnv(name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed 32-byte private key`);
  }
  return value as Hex;
}

function assertBps(name: string, value: number, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
