import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseGwei,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Mainnet execution path for an unattended WETH/USDC treasury rebalance.
 *
 * Accounts touched:
 * - Executor EOA: derived from EXECUTOR_PRIVATE_KEY. It holds WETH, USDC, and
 *   enough ETH for gas. Swap proceeds return to this same account.
 *
 * Contracts touched on Ethereum mainnet:
 * - WETH:              0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 * - USDC:              0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 * - Uniswap V3Factory: 0x1F98431c8aD98523631AE4a59f267346ea31F984
 * - Uniswap QuoterV2:  0x61fFE014bA17989E743c5F6cB21bF9697530B21e
 * - Uniswap V3 Router: 0xE592427A0AEce92De3Edee1F18E0157C05861564
 *
 * Example:
 *   RPC_URL=https://eth-mainnet.g.alchemy.com/v2/... \
 *   EXECUTOR_PRIVATE_KEY=0x... \
 *   EXPECTED_EXECUTOR=0xYourExecutor \
 *   tsx rebalance.ts --id sig-2026-09-19-001 --side USDC_TO_WETH --amount 25000 --execute
 */

const ADDRESSES = {
  WETH: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  USDC: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  UNISWAP_V3_FACTORY: getAddress("0x1F98431c8aD98523631AE4a59f267346ea31F984"),
  UNISWAP_QUOTER_V2: getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),
  UNISWAP_V3_SWAP_ROUTER: getAddress("0xE592427A0AEce92De3Edee1F18E0157C05861564"),
} as const satisfies Record<string, Address>;

const TOKENS = {
  WETH: { address: ADDRESSES.WETH, decimals: 18, symbol: "WETH" },
  USDC: { address: ADDRESSES.USDC, decimals: 6, symbol: "USDC" },
} as const;

const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);

const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

type Side = "USDC_TO_WETH" | "WETH_TO_USDC";
type Token = (typeof TOKENS)[keyof typeof TOKENS];

type RebalanceDecision = {
  id: string;
  side: Side;
  amountHuman: string;
  fee: 500 | 3000;
  maxSlippageBps: number;
};

type RuntimeConfig = {
  rpcUrl: string;
  privateKey: `0x${string}`;
  expectedExecutor?: Address;
  execute: boolean;
  allowApprovals: boolean;
  maxTradeUsdBase6: bigint;
  dailyCapUsdBase6: bigint;
  ledgerPath: string;
  maxSlippageBpsCap: number;
  maxFeePerGas: bigint;
  minEthBalance: bigint;
  confirmations: number;
  receiptTimeoutMs: number;
  deadlineSeconds: number;
};

type Ledger = {
  date: string;
  tradedUsdBase6: string;
  decisionIds: string[];
};

function usage(exitCode = 2): never {
  console.error(`
Usage:
  tsx rebalance.ts --id <signal-id> --side USDC_TO_WETH|WETH_TO_USDC --amount <human amount> [--fee 500|3000] [--slippage-bps 20] [--execute]

Examples:
  tsx rebalance.ts --id dry-001 --side USDC_TO_WETH --amount 25000
  tsx rebalance.ts --id sig-002 --side WETH_TO_USDC --amount 8.5 --slippage-bps 15 --execute

Environment:
  RPC_URL                  Ethereum mainnet RPC URL
  EXECUTOR_PRIVATE_KEY     Executor EOA private key, injected by your secret manager
  EXPECTED_EXECUTOR        Optional checksum guard for the executor EOA
  MAX_TRADE_USD            Default: 50000
  DAILY_CAP_USD            Default: 150000
  LEDGER_PATH              Default: ./rebalance-ledger.json
  ALLOW_APPROVALS          Default: false. Set true only if this process may approve the V3 router.
  MAX_FEE_PER_GAS_GWEI     Default: 80
  MIN_ETH_BALANCE          Default: 0.10
  CONFIRMATIONS            Default: 2
  TX_DEADLINE_SECONDS      Default: 120
`);
  process.exit(exitCode);
}

function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) usage();
    const key = arg.slice(2);
    if (key === "execute" || key === "help") {
      out[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) usage();
    out[key] = value;
    i += 1;
  }
  return out;
}

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function boolEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "y"].includes(raw.toLowerCase());
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

function requirePrivateKey(raw: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("EXECUTOR_PRIVATE_KEY must be a 32-byte hex private key");
  }
  return raw as `0x${string}`;
}

function parseSide(raw: string | true | undefined): Side {
  if (raw === "USDC_TO_WETH" || raw === "WETH_TO_USDC") return raw;
  throw new Error("--side must be USDC_TO_WETH or WETH_TO_USDC");
}

function parseFee(raw: string | true | undefined): 500 | 3000 {
  const fee = Number(raw ?? process.env.UNISWAP_V3_FEE ?? "500");
  if (fee === 500 || fee === 3000) return fee;
  throw new Error("--fee must be 500 or 3000 for this production allowlist");
}

function parseBps(raw: string | true | undefined): number {
  const bps = Number(raw ?? process.env.MAX_SLIPPAGE_BPS ?? "20");
  if (!Number.isInteger(bps) || bps < 1) {
    throw new Error("--slippage-bps must be a positive integer");
  }
  return bps;
}

function parseDecision(args: Record<string, string | true>, execute: boolean): RebalanceDecision {
  if (args.help) usage(0);
  const id = args.id;
  const amount = args.amount;
  if (typeof id !== "string" || id.length < 3) {
    throw new Error("--id is required and must be stable for duplicate protection");
  }
  if (typeof amount !== "string" || !/^[0-9]+(\.[0-9]+)?$/.test(amount)) {
    throw new Error("--amount is required as a positive human-unit decimal");
  }
  if (execute && id.startsWith("dry")) {
    throw new Error("Refusing to execute a decision id that looks like a dry run");
  }
  return {
    id,
    side: parseSide(args.side),
    amountHuman: amount,
    fee: parseFee(args.fee),
    maxSlippageBps: parseBps(args["slippage-bps"]),
  };
}

function loadConfig(args: Record<string, string | true>): RuntimeConfig {
  const execute = args.execute === true;
  return {
    rpcUrl: env("RPC_URL"),
    privateKey: requirePrivateKey(env("EXECUTOR_PRIVATE_KEY")),
    expectedExecutor: process.env.EXPECTED_EXECUTOR
      ? getAddress(process.env.EXPECTED_EXECUTOR)
      : undefined,
    execute,
    allowApprovals: boolEnv("ALLOW_APPROVALS", false),
    maxTradeUsdBase6: parseUnits(env("MAX_TRADE_USD", "50000"), 6),
    dailyCapUsdBase6: parseUnits(env("DAILY_CAP_USD", "150000"), 6),
    ledgerPath: env("LEDGER_PATH", "./rebalance-ledger.json"),
    maxSlippageBpsCap: numberEnv("MAX_SLIPPAGE_BPS_CAP", 100),
    maxFeePerGas: parseGwei(env("MAX_FEE_PER_GAS_GWEI", "80")),
    minEthBalance: parseUnits(env("MIN_ETH_BALANCE", "0.10"), 18),
    confirmations: numberEnv("CONFIRMATIONS", 2),
    receiptTimeoutMs: numberEnv("RECEIPT_TIMEOUT_MS", 10 * 60 * 1000),
    deadlineSeconds: numberEnv("TX_DEADLINE_SECONDS", 120),
  };
}

function tokenPair(side: Side): { tokenIn: Token; tokenOut: Token } {
  return side === "USDC_TO_WETH"
    ? { tokenIn: TOKENS.USDC, tokenOut: TOKENS.WETH }
    : { tokenIn: TOKENS.WETH, tokenOut: TOKENS.USDC };
}

function applySlippage(amount: bigint, maxSlippageBps: number): bigint {
  return (amount * BigInt(10_000 - maxSlippageBps)) / 10_000n;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyLedger(): Ledger {
  return { date: todayUtc(), tradedUsdBase6: "0", decisionIds: [] };
}

function loadLedger(path: string): Ledger {
  if (!existsSync(path)) return emptyLedger();
  const ledger = JSON.parse(readFileSync(path, "utf8")) as Ledger;
  if (ledger.date !== todayUtc()) return emptyLedger();
  return ledger;
}

function saveLedger(path: string, ledger: Ledger): void {
  const dir = dirname(path);
  if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
  writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
}

function printJson(value: unknown): void {
  console.log(
    JSON.stringify(
      value,
      (_key, inner) => (typeof inner === "bigint" ? inner.toString() : inner),
      2,
    ),
  );
}

async function assertMainnet(publicClient: ReturnType<typeof createPublicClient>): Promise<void> {
  const chainId = await publicClient.getChainId();
  if (chainId !== 1) {
    throw new Error(`RPC is connected to chain ${chainId}; expected Ethereum mainnet chain 1`);
  }
}

async function currentFeeEnvelope(
  publicClient: ReturnType<typeof createPublicClient>,
  config: RuntimeConfig,
) {
  const fees = await publicClient.estimateFeesPerGas();
  if (!fees.maxFeePerGas || !fees.maxPriorityFeePerGas) {
    throw new Error("RPC did not return EIP-1559 fee estimates");
  }
  if (fees.maxFeePerGas > config.maxFeePerGas) {
    throw new Error(
      `Estimated maxFeePerGas ${formatUnits(fees.maxFeePerGas, 9)} gwei exceeds cap ${formatUnits(
        config.maxFeePerGas,
        9,
      )} gwei`,
    );
  }
  return fees;
}

async function waitForSuccess(
  publicClient: ReturnType<typeof createPublicClient>,
  hash: Hex,
  label: string,
  config: RuntimeConfig,
) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: config.confirmations,
    timeout: config.receiptTimeoutMs,
  });
  if (receipt.status !== "success") {
    throw new Error(`${label} transaction reverted: ${hash}`);
  }
  return receipt;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usage(0);
  const config = loadConfig(args);
  const decision = parseDecision(args, config.execute);
  if (decision.maxSlippageBps > config.maxSlippageBpsCap) {
    throw new Error(
      `Slippage ${decision.maxSlippageBps} bps exceeds cap ${config.maxSlippageBpsCap} bps`,
    );
  }

  const account = privateKeyToAccount(config.privateKey);
  if (config.expectedExecutor && getAddress(account.address) !== config.expectedExecutor) {
    throw new Error(
      `Executor mismatch: private key is ${account.address}, EXPECTED_EXECUTOR is ${config.expectedExecutor}`,
    );
  }

  const publicClient = createPublicClient({ chain: mainnet, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(config.rpcUrl),
  });

  await assertMainnet(publicClient);

  const { tokenIn, tokenOut } = tokenPair(decision.side);
  const amountIn = parseUnits(decision.amountHuman, tokenIn.decimals);
  const pool = await publicClient.readContract({
    address: ADDRESSES.UNISWAP_V3_FACTORY,
    abi: factoryAbi,
    functionName: "getPool",
    args: [tokenIn.address, tokenOut.address, decision.fee],
  });
  if (pool === "0x0000000000000000000000000000000000000000") {
    throw new Error(`No Uniswap V3 ${tokenIn.symbol}/${tokenOut.symbol} pool for fee ${decision.fee}`);
  }

  const ethBalance = await publicClient.getBalance({ address: account.address });
  if (ethBalance < config.minEthBalance) {
    throw new Error(
      `Executor ETH balance ${formatEther(ethBalance)} is below MIN_ETH_BALANCE ${formatEther(
        config.minEthBalance,
      )}`,
    );
  }

  const tokenBalance = await publicClient.readContract({
    address: tokenIn.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (tokenBalance < amountIn) {
    throw new Error(
      `Insufficient ${tokenIn.symbol}: have ${formatUnits(tokenBalance, tokenIn.decimals)}, need ${
        decision.amountHuman
      }`,
    );
  }

  const quote = await publicClient.simulateContract({
    address: ADDRESSES.UNISWAP_QUOTER_V2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn,
        fee: decision.fee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  const [quotedAmountOut] = quote.result;
  const amountOutMinimum = applySlippage(quotedAmountOut, decision.maxSlippageBps);
  const usdNotionalBase6 =
    decision.side === "USDC_TO_WETH" ? amountIn : quotedAmountOut;

  if (usdNotionalBase6 > config.maxTradeUsdBase6) {
    throw new Error(
      `Trade notional ${formatUnits(usdNotionalBase6, 6)} USDC exceeds MAX_TRADE_USD ${formatUnits(
        config.maxTradeUsdBase6,
        6,
      )}`,
    );
  }

  const ledger = loadLedger(config.ledgerPath);
  if (ledger.decisionIds.includes(decision.id)) {
    throw new Error(`Decision ${decision.id} has already been executed today`);
  }
  const nextDailyTotal = BigInt(ledger.tradedUsdBase6) + usdNotionalBase6;
  if (nextDailyTotal > config.dailyCapUsdBase6) {
    throw new Error(
      `Daily notional would be ${formatUnits(nextDailyTotal, 6)} USDC, above DAILY_CAP_USD ${formatUnits(
        config.dailyCapUsdBase6,
        6,
      )}`,
    );
  }

  const allowance = await publicClient.readContract({
    address: tokenIn.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, ADDRESSES.UNISWAP_V3_SWAP_ROUTER],
  });

  const buildSwapArgs = (deadline: bigint) =>
    [
      {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        fee: decision.fee,
        recipient: account.address,
        deadline,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ] as const;
  const dryRunDeadline = BigInt(Math.floor(Date.now() / 1000) + config.deadlineSeconds);
  const swapArgs = buildSwapArgs(dryRunDeadline);

  const estimatedSwapGas =
    allowance >= amountIn
      ? await publicClient.estimateContractGas({
          account,
          address: ADDRESSES.UNISWAP_V3_SWAP_ROUTER,
          abi: swapRouterAbi,
          functionName: "exactInputSingle",
          args: swapArgs,
          value: 0n,
        })
      : undefined;

  const plan = {
    mode: config.execute ? "EXECUTE" : "DRY_RUN",
    decision,
    executor: account.address,
    contracts: ADDRESSES,
    pool,
    tokenIn: tokenIn.symbol,
    tokenOut: tokenOut.symbol,
    amountIn: formatUnits(amountIn, tokenIn.decimals),
    quotedAmountOut: formatUnits(quotedAmountOut, tokenOut.decimals),
    amountOutMinimum: formatUnits(amountOutMinimum, tokenOut.decimals),
    deadlineUnixSeconds: dryRunDeadline.toString(),
    estimatedSwapGas: estimatedSwapGas?.toString() ?? "requires approval first",
    allowance: formatUnits(allowance, tokenIn.decimals),
    approvalNeeded: allowance < amountIn,
    ethBalance: formatEther(ethBalance),
    dailyNotionalAfterTradeUsdc: formatUnits(nextDailyTotal, 6),
  };
  printJson(plan);

  if (!config.execute) return;

  if (allowance < amountIn) {
    if (!config.allowApprovals) {
      throw new Error("Allowance is insufficient and ALLOW_APPROVALS is not true");
    }
    const approvalAmount = amountIn;
    const fees = await currentFeeEnvelope(publicClient, config);
    const approveGas = await publicClient.estimateContractGas({
      account,
      address: tokenIn.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [ADDRESSES.UNISWAP_V3_SWAP_ROUTER, approvalAmount],
    });
    const approveHash = await walletClient.writeContract({
      account,
      address: tokenIn.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [ADDRESSES.UNISWAP_V3_SWAP_ROUTER, approvalAmount],
      gas: (approveGas * 120n) / 100n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      nonce: await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }),
    });
    console.log(`approval_tx=${approveHash}`);
    await waitForSuccess(publicClient, approveHash, "approval", config);
  }

  const executionDeadline = BigInt(Math.floor(Date.now() / 1000) + config.deadlineSeconds);
  const executionSwapArgs = buildSwapArgs(executionDeadline);
  const fees = await currentFeeEnvelope(publicClient, config);
  await publicClient.simulateContract({
    account,
    address: ADDRESSES.UNISWAP_V3_SWAP_ROUTER,
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: executionSwapArgs,
    value: 0n,
  });
  const swapGas = await publicClient.estimateContractGas({
    account,
    address: ADDRESSES.UNISWAP_V3_SWAP_ROUTER,
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: executionSwapArgs,
    value: 0n,
  });

  const swapHash = await walletClient.writeContract({
    account,
    address: ADDRESSES.UNISWAP_V3_SWAP_ROUTER,
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: executionSwapArgs,
    value: 0n,
    gas: (swapGas * 120n) / 100n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    nonce: await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }),
  });
  console.log(`swap_tx=${swapHash}`);
  const receipt = await waitForSuccess(publicClient, swapHash, "swap", config);

  ledger.tradedUsdBase6 = nextDailyTotal.toString();
  ledger.decisionIds.push(decision.id);
  saveLedger(config.ledgerPath, ledger);

  printJson({
    status: "confirmed",
    hash: swapHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
