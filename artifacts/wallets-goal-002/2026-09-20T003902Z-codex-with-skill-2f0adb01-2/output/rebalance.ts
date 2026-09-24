import {
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

/**
 * Mainnet contracts and accounts touched by this execution path:
 *
 * - Executor / treasury EOA: EXECUTOR_PRIVATE_KEY-derived account. This account
 *   pays gas and owns the WETH/USDC being rebalanced.
 * - WETH9:  0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 * - USDC:   0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 * - Uniswap V3 Factory: 0x1F98431c8aD98523631AE4a59f267346ea31F984
 * - Uniswap QuoterV2:   0x61fFE014bA17989E743c5F6cB21bF9697530B21e
 * - Uniswap SwapRouter02: 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45
 *
 * A normal rebalance is one approval transaction when allowance is insufficient,
 * followed by one SwapRouter02.exactInputSingle transaction. If allowance is
 * already sufficient, only the swap transaction is signed and submitted.
 */

const CHAIN_ID = 1;
const WETH = getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
const USDC = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const UNISWAP_V3_FACTORY = getAddress("0x1F98431c8aD98523631AE4a59f267346ea31F984");
const QUOTER_V2 = getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e");
const SWAP_ROUTER_02 = getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

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
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

type Side = "weth-to-usdc" | "usdc-to-weth";

export type RebalanceDecision = {
  side: Side;
  amountIn: string;
  maxSlippageBps: number;
  reason?: string;
};

type Token = {
  address: Address;
  symbol: "WETH" | "USDC";
  decimals: 18 | 6;
};

type RuntimeState = {
  utcDate: string;
  usedUsd6: string;
  trades: Array<{
    at: string;
    side: Side;
    amountIn: string;
    usdNotional: string;
    swapHash: Hex;
    blockNumber: string;
    reason?: string;
  }>;
};

const TOKENS = {
  WETH: { address: WETH, symbol: "WETH", decimals: 18 },
  USDC: { address: USDC, symbol: "USDC", decimals: 6 },
} as const satisfies Record<string, Token>;

const LOCK_FILE = process.env.REBALANCE_LOCK_FILE ?? ".rebalance.lock";
const STATE_FILE = process.env.REBALANCE_STATE_FILE ?? ".rebalance-state.json";

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function tokenPair(side: Side): { tokenIn: Token; tokenOut: Token } {
  if (side === "weth-to-usdc") return { tokenIn: TOKENS.WETH, tokenOut: TOKENS.USDC };
  if (side === "usdc-to-weth") return { tokenIn: TOKENS.USDC, tokenOut: TOKENS.WETH };
  throw new Error(`Unsupported side: ${side}`);
}

function applySlippage(amount: bigint, bps: number): bigint {
  if (bps < 0 || bps > envInt("MAX_ALLOWED_SLIPPAGE_BPS", 100)) {
    throw new Error(`maxSlippageBps ${bps} outside allowed range`);
  }
  return (amount * BigInt(10_000 - bps)) / 10_000n;
}

function addGasBuffer(gas: bigint): bigint {
  const bufferBps = BigInt(envInt("GAS_BUFFER_BPS", 2_000));
  return (gas * (10_000n + bufferBps)) / 10_000n;
}

function usd6FromDecimal(value: string): bigint {
  return parseUnits(value, 6);
}

function acquireLock(): () => void {
  try {
    writeFileSync(LOCK_FILE, `${process.pid}\n`, { flag: "wx", mode: 0o600 });
  } catch {
    throw new Error(`Another rebalance appears to be running: ${LOCK_FILE}`);
  }
  return () => {
    if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
  };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function readState(): RuntimeState {
  const empty: RuntimeState = { utcDate: todayUtc(), usedUsd6: "0", trades: [] };
  if (!existsSync(STATE_FILE)) return empty;
  const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as RuntimeState;
  if (parsed.utcDate !== todayUtc()) return empty;
  return parsed;
}

function writeState(state: RuntimeState): void {
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function parseDecisionFromCli(): RebalanceDecision {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    const value = process.argv[i + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error(
        "Usage: npx tsx rebalance.ts --side weth-to-usdc --amount 10.5 --slippage-bps 30 --reason signal-42",
      );
    }
    args.set(key.slice(2), value);
  }

  const side = args.get("side") as Side | undefined;
  if (side !== "weth-to-usdc" && side !== "usdc-to-weth") {
    throw new Error("--side must be weth-to-usdc or usdc-to-weth");
  }

  return {
    side,
    amountIn: args.get("amount") ?? env("REBALANCE_AMOUNT_IN"),
    maxSlippageBps: Number.parseInt(args.get("slippage-bps") ?? env("MAX_SLIPPAGE_BPS", "30"), 10),
    reason: args.get("reason"),
  };
}

function asPrivateKey(raw: string): Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("EXECUTOR_PRIVATE_KEY must be a 32-byte 0x-prefixed private key");
  }
  return raw as Hex;
}

function logJson(label: string, value: unknown): void {
  console.log(
    `${label} ${JSON.stringify(
      value,
      (_, item) => (typeof item === "bigint" ? item.toString() : item),
      2,
    )}`,
  );
}

async function assertMainnetAndContracts(publicClient: ReturnType<typeof createPublicClient>) {
  const chainId = await publicClient.getChainId();
  if (chainId !== CHAIN_ID) throw new Error(`RPC is chain ${chainId}, expected Ethereum mainnet`);

  for (const [name, address] of Object.entries({
    WETH,
    USDC,
    UNISWAP_V3_FACTORY,
    QUOTER_V2,
    SWAP_ROUTER_02,
  })) {
    const code = await publicClient.getCode({ address });
    if (!code || code === "0x") throw new Error(`${name} has no code at ${address}`);
  }
}

async function quoteExactInput(
  publicClient: ReturnType<typeof createPublicClient>,
  tokenIn: Token,
  tokenOut: Token,
  amountIn: bigint,
  fee: number,
): Promise<{ amountOut: bigint; pool: Address }> {
  const pool = (await publicClient.readContract({
    address: UNISWAP_V3_FACTORY,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [tokenIn.address, tokenOut.address, fee],
  })) as Address;
  if (pool === ZERO_ADDRESS) throw new Error(`No Uniswap V3 pool for fee tier ${fee}`);

  const { result } = await publicClient.simulateContract({
    address: QUOTER_V2,
    abi: QUOTER_V2_ABI,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  const [amountOut] = result as readonly [bigint, bigint, number, bigint];
  return { amountOut, pool };
}

async function ensureAllowance(params: {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  account: Address;
  token: Token;
  spender: Address;
  amount: bigint;
  dryRun: boolean;
  confirmations: number;
}): Promise<boolean> {
  const { publicClient, walletClient, account, token, spender, amount, dryRun, confirmations } =
    params;
  const allowance = (await publicClient.readContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account, spender],
  })) as bigint;

  if (allowance >= amount) return true;

  if (dryRun) {
    logJson("approval_required", {
      token: token.symbol,
      spender,
      currentAllowance: formatUnits(allowance, token.decimals),
      approveAmount: formatUnits(amount, token.decimals),
    });
    return false;
  }

  if (allowance > 0n) {
    await submitApproval({
      publicClient,
      walletClient,
      token,
      spender,
      amount: 0n,
      confirmations,
      label: "approval_reset",
    });
  }

  await submitApproval({
    publicClient,
    walletClient,
    token,
    spender,
    amount,
    confirmations,
    label: "approval",
  });
  return true;
}

async function submitApproval(params: {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  token: Token;
  spender: Address;
  amount: bigint;
  confirmations: number;
  label: string;
}) {
  const { publicClient, walletClient, token, spender, amount, confirmations, label } = params;
  const fees = await publicClient.estimateFeesPerGas();
  const gas = await publicClient.estimateContractGas({
    account: walletClient.account!,
    address: token.address,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, amount],
  });
  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    chain: mainnet,
    address: token.address,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, amount],
    gas: addGasBuffer(gas),
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations });
  if (receipt.status !== "success") throw new Error(`${label} failed: ${hash}`);
  logJson(label, { hash, blockNumber: receipt.blockNumber, token: token.symbol });
}

export async function executeRebalance(decision: RebalanceDecision) {
  const releaseLock = acquireLock();
  try {
    const rpcUrl = env("RPC_URL");
    const privateKey = asPrivateKey(env("EXECUTOR_PRIVATE_KEY"));
    const poolFee = envInt("POOL_FEE", 500);
    const minTradeUsd6 = usd6FromDecimal(env("MIN_TRADE_USD", "10000"));
    const maxTradeUsd6 = usd6FromDecimal(env("MAX_TRADE_USD", "50000"));
    const maxDailyUsd6 = usd6FromDecimal(env("MAX_DAILY_NOTIONAL_USD", "150000"));
    const confirmations = envInt("RECEIPT_CONFIRMATIONS", 2);
    const dryRun = env("DRY_RUN", "true").toLowerCase() !== "false";

    const account = privateKeyToAccount(privateKey);
    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
    const walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(rpcUrl),
    });

    const { tokenIn, tokenOut } = tokenPair(decision.side);
    const amountIn = parseUnits(decision.amountIn, tokenIn.decimals);
    if (amountIn <= 0n) throw new Error("amountIn must be positive");

    await assertMainnetAndContracts(publicClient);

    const balance = (await publicClient.readContract({
      address: tokenIn.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    })) as bigint;
    if (balance < amountIn) {
      throw new Error(
        `Insufficient ${tokenIn.symbol}: have ${formatUnits(balance, tokenIn.decimals)}, need ${decision.amountIn}`,
      );
    }

    const quote = await quoteExactInput(publicClient, tokenIn, tokenOut, amountIn, poolFee);
    const amountOutMinimum = applySlippage(quote.amountOut, decision.maxSlippageBps);

    const usdNotional6 =
      tokenIn.symbol === "USDC"
        ? amountIn
        : tokenOut.symbol === "USDC"
          ? quote.amountOut
          : 0n;

    if (usdNotional6 < minTradeUsd6 || usdNotional6 > maxTradeUsd6) {
      throw new Error(
        `Trade notional ${formatUnits(usdNotional6, 6)} USDC outside bounds ${formatUnits(
          minTradeUsd6,
          6,
        )}-${formatUnits(maxTradeUsd6, 6)} USDC`,
      );
    }

    const state = readState();
    const nextDailyUsd6 = BigInt(state.usedUsd6) + usdNotional6;
    if (nextDailyUsd6 > maxDailyUsd6) {
      throw new Error(
        `Daily notional cap exceeded: next ${formatUnits(nextDailyUsd6, 6)} USDC > ${formatUnits(
          maxDailyUsd6,
          6,
        )} USDC`,
      );
    }

    const swapParams = {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      fee: poolFee,
      recipient: account.address,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    };

    const fees = await publicClient.estimateFeesPerGas();
    const allowanceReady = await ensureAllowance({
      publicClient,
      walletClient,
      account: account.address,
      token: tokenIn,
      spender: SWAP_ROUTER_02,
      amount: amountIn,
      dryRun,
      confirmations,
    });

    const basePlan = {
      dryRun,
      executor: account.address,
      pool: quote.pool,
      router: SWAP_ROUTER_02,
      quoter: QUOTER_V2,
      side: decision.side,
      tokenIn: tokenIn.symbol,
      tokenOut: tokenOut.symbol,
      amountIn: formatUnits(amountIn, tokenIn.decimals),
      quotedAmountOut: formatUnits(quote.amountOut, tokenOut.decimals),
      amountOutMinimum: formatUnits(amountOutMinimum, tokenOut.decimals),
      slippageBps: decision.maxSlippageBps,
      usdNotional: formatUnits(usdNotional6, 6),
      dailyUsedAfter: formatUnits(nextDailyUsd6, 6),
      maxFeePerGasGwei: formatUnits(fees.maxFeePerGas ?? 0n, 9),
      maxPriorityFeePerGasGwei: formatUnits(fees.maxPriorityFeePerGas ?? 0n, 9),
      reason: decision.reason,
    };

    if (!allowanceReady) {
      logJson("rebalance_plan", {
        ...basePlan,
        swapSimulation: "skipped until approval exists",
      });
      return { dryRun: true as const, approvalRequired: true as const };
    }

    const { result: simulatedAmountOut } = await publicClient.simulateContract({
      account,
      address: SWAP_ROUTER_02,
      abi: SWAP_ROUTER_02_ABI,
      functionName: "exactInputSingle",
      args: [swapParams],
      value: 0n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });

    const gas = await publicClient.estimateContractGas({
      account,
      address: SWAP_ROUTER_02,
      abi: SWAP_ROUTER_02_ABI,
      functionName: "exactInputSingle",
      args: [swapParams],
      value: 0n,
    });

    logJson("rebalance_plan", {
      ...basePlan,
      simulatedAmountOut: formatUnits(simulatedAmountOut as bigint, tokenOut.decimals),
      estimatedGas: gas.toString(),
      estimatedMaxGasEth: formatEther(addGasBuffer(gas) * (fees.maxFeePerGas ?? 0n)),
    });

    if (dryRun) return { dryRun: true as const };

    const hash = await walletClient.writeContract({
      account,
      chain: mainnet,
      address: SWAP_ROUTER_02,
      abi: SWAP_ROUTER_02_ABI,
      functionName: "exactInputSingle",
      args: [swapParams],
      value: 0n,
      gas: addGasBuffer(gas),
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations });
    if (receipt.status !== "success") throw new Error(`Swap failed: ${hash}`);

    state.usedUsd6 = nextDailyUsd6.toString();
    state.trades.push({
      at: new Date().toISOString(),
      side: decision.side,
      amountIn: decision.amountIn,
      usdNotional: formatUnits(usdNotional6, 6),
      swapHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      reason: decision.reason,
    });
    writeState(state);

    logJson("rebalance_submitted", {
      hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      effectiveGasPriceGwei: formatUnits(receipt.effectiveGasPrice, 9),
    });
    return { dryRun: false as const, hash, receipt };
  } finally {
    releaseLock();
  }
}

const invokedAsCli = process.argv[1]?.endsWith("rebalance.ts") || process.argv[1]?.endsWith("rebalance.js");

if (invokedAsCli) {
  executeRebalance(parseDecisionFromCli()).catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
