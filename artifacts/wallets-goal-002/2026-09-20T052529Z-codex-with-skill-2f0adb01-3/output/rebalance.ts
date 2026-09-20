import {
  type Address,
  type Hash,
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Ethereum mainnet contracts touched by this execution path.
const CONTRACTS = {
  WETH: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  USDC: getAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
  UNISWAP_V3_FACTORY: getAddress("0x1F98431c8aD98523631AE4a59f267346ea31F984"),
  UNISWAP_V3_QUOTER_V2: getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),
  UNISWAP_SWAP_ROUTER_02: getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
} as const satisfies Record<string, Address>;

const WETH_DECIMALS = 18;
const USDC_DECIMALS = 6;
const BPS_DENOMINATOR = 10_000n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);

const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

const swapRouter02Abi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

type Direction = "WETH_TO_USDC" | "USDC_TO_WETH";

export type RebalanceDecision = {
  direction: Direction;
  amountIn: bigint;
  maxSlippageBps?: number;
  reason: string;
  signalId?: string;
};

type RuntimeConfig = {
  rpcUrl: string;
  submitTransactions: boolean;
  privateKey: `0x${string}`;
  recipient: Address;
  uniswapV3Fee: number;
  defaultMaxSlippageBps: number;
  maxTradeUsdc: bigint;
  dailyVolumeLimitUsdc: bigint;
  minAgentEth: bigint;
  stateFile: string;
  auditFile: string;
  lockFile: string;
};

type DailyState = {
  day: string;
  volumeUsdc: string;
};

type ExecutionResult = {
  signalId: string;
  direction: Direction;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  quotedAmountOut: string;
  amountOutMinimum: string;
  notionalUsdc: string;
  approvalHash?: Hash;
  approvalNeeded?: boolean;
  swapSimulationSkipped?: boolean;
  swapHash?: Hash;
  swapBlockNumber?: string;
  submitTransactions: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function optionalAddress(value: string | undefined, fallback: Address): Address {
  return value ? getAddress(value) : fallback;
}

function readConfig(accountAddress: Address): RuntimeConfig {
  const privateKey = requireEnv("AGENT_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("AGENT_PRIVATE_KEY must be a 32-byte hex private key with 0x prefix");
  }

  const defaultMaxSlippageBps = Number(process.env.MAX_SLIPPAGE_BPS ?? "30");
  const uniswapV3Fee = Number(process.env.UNISWAP_V3_FEE ?? "500");
  const maxTradeUsdc = parseUnits(process.env.MAX_TRADE_USDC ?? "50000", USDC_DECIMALS);
  const dailyVolumeLimitUsdc = parseUnits(
    process.env.DAILY_VOLUME_LIMIT_USDC ?? "150000",
    USDC_DECIMALS,
  );
  const minAgentEth = parseUnits(process.env.MIN_AGENT_ETH ?? "0.05", WETH_DECIMALS);

  if (!Number.isInteger(defaultMaxSlippageBps) || defaultMaxSlippageBps < 1 || defaultMaxSlippageBps > 500) {
    throw new Error("MAX_SLIPPAGE_BPS must be an integer between 1 and 500");
  }
  if (![100, 500, 3000, 10000].includes(uniswapV3Fee)) {
    throw new Error("UNISWAP_V3_FEE must be one of 100, 500, 3000, 10000");
  }

  return {
    rpcUrl: requireEnv("MAINNET_RPC_URL"),
    submitTransactions: process.env.SUBMIT_TXS === "true",
    privateKey: privateKey as `0x${string}`,
    recipient: optionalAddress(process.env.RECIPIENT_ADDRESS, accountAddress),
    uniswapV3Fee,
    defaultMaxSlippageBps,
    maxTradeUsdc,
    dailyVolumeLimitUsdc,
    minAgentEth,
    stateFile: resolve(process.env.REBALANCE_STATE_FILE ?? "./runtime/rebalance-state.json"),
    auditFile: resolve(process.env.REBALANCE_AUDIT_FILE ?? "./runtime/rebalance-audit.ndjson"),
    lockFile: resolve(process.env.REBALANCE_LOCK_FILE ?? "./runtime/rebalance.lock"),
  };
}

function acquireLock(lockFile: string): () => void {
  mkdirSync(dirname(lockFile), { recursive: true });
  const fd = openSync(lockFile, "wx");
  closeSync(fd);
  return () => {
    if (existsSync(lockFile)) rmSync(lockFile);
  };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadDailyState(path: string): DailyState {
  if (!existsSync(path)) return { day: todayUtc(), volumeUsdc: "0" };
  const parsed = JSON.parse(readFileSync(path, "utf8")) as DailyState;
  if (parsed.day !== todayUtc()) return { day: todayUtc(), volumeUsdc: "0" };
  return parsed;
}

function saveDailyState(path: string, state: DailyState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function appendAudit(path: string, event: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`, {
    mode: 0o600,
  });
}

function tokenPair(direction: Direction): { tokenIn: Address; tokenOut: Address; decimalsIn: number; decimalsOut: number } {
  if (direction === "WETH_TO_USDC") {
    return {
      tokenIn: CONTRACTS.WETH,
      tokenOut: CONTRACTS.USDC,
      decimalsIn: WETH_DECIMALS,
      decimalsOut: USDC_DECIMALS,
    };
  }
  return {
    tokenIn: CONTRACTS.USDC,
    tokenOut: CONTRACTS.WETH,
    decimalsIn: USDC_DECIMALS,
    decimalsOut: WETH_DECIMALS,
  };
}

function minAmountOut(quotedAmountOut: bigint, slippageBps: number): bigint {
  return (quotedAmountOut * (BPS_DENOMINATOR - BigInt(slippageBps))) / BPS_DENOMINATOR;
}

async function assertMainnet(publicClient: ReturnType<typeof createPublicClient>): Promise<void> {
  const chainId = await publicClient.getChainId();
  if (chainId !== mainnet.id) throw new Error(`RPC is not Ethereum mainnet: chainId=${chainId}`);
}

async function assertContractCode(
  publicClient: ReturnType<typeof createPublicClient>,
  name: string,
  address: Address,
): Promise<void> {
  const bytecode = await publicClient.getBytecode({ address });
  if (!bytecode || bytecode === "0x") throw new Error(`${name} has no code at ${address}`);
}

async function quoteExactInput(
  publicClient: ReturnType<typeof createPublicClient>,
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  amountIn: bigint,
): Promise<bigint> {
  const { result } = await publicClient.simulateContract({
    address: CONTRACTS.UNISWAP_V3_QUOTER_V2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  return result[0];
}

async function ensureApproval(params: {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  account: ReturnType<typeof privateKeyToAccount>;
  tokenIn: Address;
  amountIn: bigint;
  submitTransactions: boolean;
}): Promise<{ approvalHash?: Hash; approvalNeeded: boolean }> {
  const allowance = await params.publicClient.readContract({
    address: params.tokenIn,
    abi: erc20Abi,
    functionName: "allowance",
    args: [params.account.address, CONTRACTS.UNISWAP_SWAP_ROUTER_02],
  });

  if (allowance >= params.amountIn) return { approvalNeeded: false };

  const { request } = await params.publicClient.simulateContract({
    account: params.account,
    address: params.tokenIn,
    abi: erc20Abi,
    functionName: "approve",
    args: [CONTRACTS.UNISWAP_SWAP_ROUTER_02, params.amountIn],
  });

  if (!params.submitTransactions) return { approvalNeeded: true };

  const hash = await params.walletClient.writeContract(request);
  const receipt = await params.publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 2,
  });
  if (receipt.status !== "success") throw new Error(`Approval failed: ${hash}`);
  return { approvalHash: hash, approvalNeeded: true };
}

export async function executeRebalance(decision: RebalanceDecision): Promise<ExecutionResult> {
  const account = privateKeyToAccount(requireEnv("AGENT_PRIVATE_KEY") as `0x${string}`);
  const config = readConfig(account.address);
  const releaseLock = acquireLock(config.lockFile);

  try {
    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http(config.rpcUrl),
    });
    const walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(config.rpcUrl),
    });

    await assertMainnet(publicClient);
    await Promise.all([
      assertContractCode(publicClient, "WETH", CONTRACTS.WETH),
      assertContractCode(publicClient, "USDC", CONTRACTS.USDC),
      assertContractCode(publicClient, "UniswapV3Factory", CONTRACTS.UNISWAP_V3_FACTORY),
      assertContractCode(publicClient, "QuoterV2", CONTRACTS.UNISWAP_V3_QUOTER_V2),
      assertContractCode(publicClient, "SwapRouter02", CONTRACTS.UNISWAP_SWAP_ROUTER_02),
    ]);

    const signalId = decision.signalId ?? `${Date.now()}-${decision.direction}`;
    const slippageBps = decision.maxSlippageBps ?? config.defaultMaxSlippageBps;
    if (decision.amountIn <= 0n) throw new Error("amountIn must be positive");
    if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 500) {
      throw new Error("decision.maxSlippageBps must be an integer between 1 and 500");
    }

    const { tokenIn, tokenOut, decimalsIn } = tokenPair(decision.direction);
    const pool = await publicClient.readContract({
      address: CONTRACTS.UNISWAP_V3_FACTORY,
      abi: factoryAbi,
      functionName: "getPool",
      args: [tokenIn, tokenOut, config.uniswapV3Fee],
    });
    if (pool === ZERO_ADDRESS) {
      throw new Error(`No Uniswap v3 pool for configured fee tier ${config.uniswapV3Fee}`);
    }

    const ethBalance = await publicClient.getBalance({ address: account.address });
    if (ethBalance < config.minAgentEth) {
      throw new Error(
        `Agent ETH balance ${formatUnits(ethBalance, 18)} is below MIN_AGENT_ETH ${formatUnits(
          config.minAgentEth,
          18,
        )}`,
      );
    }

    const tokenInBalance = await publicClient.readContract({
      address: tokenIn,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    if (tokenInBalance < decision.amountIn) {
      throw new Error(
        `Insufficient tokenIn balance: have ${formatUnits(tokenInBalance, decimalsIn)}, need ${formatUnits(
          decision.amountIn,
          decimalsIn,
        )}`,
      );
    }

    const quotedAmountOut = await quoteExactInput(
      publicClient,
      tokenIn,
      tokenOut,
      config.uniswapV3Fee,
      decision.amountIn,
    );
    const amountOutMinimum = minAmountOut(quotedAmountOut, slippageBps);
    const notionalUsdc =
      decision.direction === "USDC_TO_WETH"
        ? decision.amountIn
        : await quoteExactInput(
            publicClient,
            CONTRACTS.WETH,
            CONTRACTS.USDC,
            config.uniswapV3Fee,
            decision.amountIn,
          );

    if (notionalUsdc > config.maxTradeUsdc) {
      throw new Error(
        `Trade notional ${formatUnits(notionalUsdc, USDC_DECIMALS)} USDC exceeds MAX_TRADE_USDC ${formatUnits(
          config.maxTradeUsdc,
          USDC_DECIMALS,
        )}`,
      );
    }

    const state = loadDailyState(config.stateFile);
    const nextDailyVolume = BigInt(state.volumeUsdc) + notionalUsdc;
    if (nextDailyVolume > config.dailyVolumeLimitUsdc) {
      throw new Error(
        `Daily volume ${formatUnits(nextDailyVolume, USDC_DECIMALS)} USDC exceeds DAILY_VOLUME_LIMIT_USDC ${formatUnits(
          config.dailyVolumeLimitUsdc,
          USDC_DECIMALS,
        )}`,
      );
    }

    const approval = await ensureApproval({
      publicClient,
      walletClient,
      account,
      tokenIn,
      amountIn: decision.amountIn,
      submitTransactions: config.submitTransactions,
    });

    const swapParams = {
      tokenIn,
      tokenOut,
      fee: config.uniswapV3Fee,
      recipient: config.recipient,
      amountIn: decision.amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    };

    const auditWithoutSimulation = {
      signalId,
      reason: decision.reason,
      direction: decision.direction,
      account: account.address,
      recipient: config.recipient,
      contracts: CONTRACTS,
      fee: config.uniswapV3Fee,
      tokenIn,
      tokenOut,
      amountIn: decision.amountIn.toString(),
      quotedAmountOut: quotedAmountOut.toString(),
      amountOutMinimum: amountOutMinimum.toString(),
      notionalUsdc: notionalUsdc.toString(),
      slippageBps,
      approvalNeeded: approval.approvalNeeded,
      submitTransactions: config.submitTransactions,
    };

    if (approval.approvalNeeded && !config.submitTransactions) {
      appendAudit(config.auditFile, {
        type: "rebalance_prepared",
        ...auditWithoutSimulation,
        swapSimulationSkipped: true,
        skipReason: "approval_needed_and_submit_txs_false",
      });
      return {
        signalId,
        direction: decision.direction,
        tokenIn,
        tokenOut,
        amountIn: decision.amountIn.toString(),
        quotedAmountOut: quotedAmountOut.toString(),
        amountOutMinimum: amountOutMinimum.toString(),
        notionalUsdc: notionalUsdc.toString(),
        approvalNeeded: true,
        swapSimulationSkipped: true,
        submitTransactions: false,
      };
    }

    const { request, result: simulatedAmountOut } = await publicClient.simulateContract({
      account,
      address: CONTRACTS.UNISWAP_SWAP_ROUTER_02,
      abi: swapRouter02Abi,
      functionName: "exactInputSingle",
      args: [swapParams],
      value: 0n,
    });

    const auditBase = {
      ...auditWithoutSimulation,
      simulatedAmountOut: simulatedAmountOut.toString(),
    };

    appendAudit(config.auditFile, { type: "rebalance_prepared", ...auditBase });

    if (!config.submitTransactions) {
      return {
        signalId,
        direction: decision.direction,
        tokenIn,
        tokenOut,
        amountIn: decision.amountIn.toString(),
        quotedAmountOut: quotedAmountOut.toString(),
        amountOutMinimum: amountOutMinimum.toString(),
        notionalUsdc: notionalUsdc.toString(),
        approvalHash: approval.approvalHash,
        approvalNeeded: approval.approvalNeeded,
        submitTransactions: false,
      };
    }

    const swapHash = await walletClient.writeContract(request);
    const swapReceipt = await publicClient.waitForTransactionReceipt({
      hash: swapHash,
      confirmations: 2,
    });
    if (swapReceipt.status !== "success") throw new Error(`Swap failed: ${swapHash}`);

    saveDailyState(config.stateFile, {
      day: todayUtc(),
      volumeUsdc: nextDailyVolume.toString(),
    });

    appendAudit(config.auditFile, {
      type: "rebalance_submitted",
      ...auditBase,
      approvalHash: approval.approvalHash,
      swapHash,
      swapBlockNumber: swapReceipt.blockNumber.toString(),
      gasUsed: swapReceipt.gasUsed.toString(),
    });

    return {
      signalId,
      direction: decision.direction,
      tokenIn,
      tokenOut,
      amountIn: decision.amountIn.toString(),
      quotedAmountOut: quotedAmountOut.toString(),
      amountOutMinimum: amountOutMinimum.toString(),
      notionalUsdc: notionalUsdc.toString(),
      approvalHash: approval.approvalHash,
      approvalNeeded: approval.approvalNeeded,
      swapHash,
      swapBlockNumber: swapReceipt.blockNumber.toString(),
      submitTransactions: true,
    };
  } finally {
    releaseLock();
  }
}

function cliDecision(): RebalanceDecision {
  const [, , directionRaw, amountRaw, ...reasonParts] = process.argv;
  const direction = directionRaw as Direction | undefined;
  if (direction !== "WETH_TO_USDC" && direction !== "USDC_TO_WETH") {
    throw new Error(
      "Usage: tsx rebalance.ts WETH_TO_USDC <wethAmount> <reason...>\n" +
        "   or: tsx rebalance.ts USDC_TO_WETH <usdcAmount> <reason...>",
    );
  }
  if (!amountRaw) throw new Error("Missing amount");
  const decimals = direction === "WETH_TO_USDC" ? WETH_DECIMALS : USDC_DECIMALS;
  return {
    direction,
    amountIn: parseUnits(amountRaw, decimals),
    maxSlippageBps: process.env.MAX_SLIPPAGE_BPS ? Number(process.env.MAX_SLIPPAGE_BPS) : undefined,
    reason: reasonParts.join(" ") || "automated rebalance",
    signalId: process.env.SIGNAL_ID,
  };
}

async function main(): Promise<void> {
  const result = await executeRebalance(cliDecision());
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
