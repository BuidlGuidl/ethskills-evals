import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseGwei,
  parseUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { readFileSync } from "node:fs";

type TokenSymbol = "USDC" | "WETH";

type RebalanceDecision = {
  id: string;
  tokenIn: TokenSymbol;
  tokenOut?: TokenSymbol;
  amountIn: string;
  maxSlippageBps: number;
  fee?: 100 | 500 | 3000 | 10000;
  recipient?: Address;
  reason?: string;
};

const SUPPORTED_V3_FEES = [100, 500, 3000, 10000] as const;
type SupportedV3Fee = (typeof SUPPORTED_V3_FEES)[number];

const MAINNET_CONTRACTS = {
  USDC: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  WETH: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  UNISWAP_V3_FACTORY: getAddress("0x1F98431c8aD98523631AE4a59f267346ea31F984"),
  UNISWAP_V3_QUOTER_V2: getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),
  UNISWAP_SWAP_ROUTER_02: getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
  PERMIT2: getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3"),
  UNIVERSAL_ROUTER: getAddress("0x66a9893cc07d91d95644aedd05d03f95e1dba8af"),
} as const;

const TOKENS = {
  USDC: { address: MAINNET_CONTRACTS.USDC, decimals: 6 },
  WETH: { address: MAINNET_CONTRACTS.WETH, decimals: 18 },
} as const satisfies Record<TokenSymbol, { address: Address; decimals: number }>;

const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

const v3FactoryAbi = parseAbi([
  "function getPool(address tokenA,address tokenB,uint24 fee) view returns (address pool)",
]);

const swapRouter02Abi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const BASIS_POINTS = 10_000n;

const rpcUrl = requireEnv("MAINNET_RPC_URL");
const privateKey = requireEnv("EXECUTOR_PRIVATE_KEY") as `0x${string}`;
const account = privateKeyToAccount(privateKey);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(rpcUrl),
});

export async function executeRebalance(rawDecision: RebalanceDecision) {
  requireLiveMainnetFlag();

  const decision = normalizeDecision(rawDecision);
  const tokenIn = TOKENS[decision.tokenIn];
  const tokenOut = TOKENS[decision.tokenOut];
  const amountIn = parseUnits(decision.amountIn, tokenIn.decimals);

  if (amountIn <= 0n) {
    throw new Error("amountIn must be greater than zero");
  }

  const chainId = await publicClient.getChainId();
  if (chainId !== 1) {
    throw new Error(`Refusing to trade: RPC chainId is ${chainId}, expected Ethereum mainnet chainId 1`);
  }

  const pool = await publicClient.readContract({
    address: MAINNET_CONTRACTS.UNISWAP_V3_FACTORY,
    abi: v3FactoryAbi,
    functionName: "getPool",
    args: [tokenIn.address, tokenOut.address, decision.fee],
  });

  if (pool === ZERO_ADDRESS) {
    throw new Error(`No Uniswap V3 pool for ${decision.tokenIn}/${decision.tokenOut} fee ${decision.fee}`);
  }

  const [balance, allowance, quote] = await Promise.all([
    publicClient.readContract({
      address: tokenIn.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.readContract({
      address: tokenIn.address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, MAINNET_CONTRACTS.UNISWAP_SWAP_ROUTER_02],
    }),
    quoteExactInput(tokenIn.address, tokenOut.address, decision.fee, amountIn),
  ]);

  if (balance < amountIn) {
    throw new Error(
      `Insufficient ${decision.tokenIn}: have ${formatUnits(balance, tokenIn.decimals)}, need ${decision.amountIn}`,
    );
  }

  await enforceNotionalCap(decision, amountIn, quote.amountOut);

  const amountOutMinimum = applySlippage(quote.amountOut, decision.maxSlippageBps);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + envInt("TX_DEADLINE_SECONDS", 120));
  const fees = await checkedEip1559Fees();

  console.log(
    JSON.stringify(
      {
        decisionId: decision.id,
        executor: account.address,
        router: MAINNET_CONTRACTS.UNISWAP_SWAP_ROUTER_02,
        quoter: MAINNET_CONTRACTS.UNISWAP_V3_QUOTER_V2,
        factory: MAINNET_CONTRACTS.UNISWAP_V3_FACTORY,
        pool,
        tokenIn: decision.tokenIn,
        tokenOut: decision.tokenOut,
        fee: decision.fee,
        amountIn: decision.amountIn,
        quotedAmountOut: formatUnits(quote.amountOut, tokenOut.decimals),
        amountOutMinimum: formatUnits(amountOutMinimum, tokenOut.decimals),
        maxSlippageBps: decision.maxSlippageBps,
        deadline: deadline.toString(),
      },
      null,
      2,
    ),
  );

  if (allowance < amountIn) {
    const approveHash = await walletClient.writeContract({
      address: tokenIn.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [MAINNET_CONTRACTS.UNISWAP_SWAP_ROUTER_02, amountIn],
      ...fees,
    });

    console.log(`approval submitted: ${approveHash}`);
    const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    if (approvalReceipt.status !== "success") {
      throw new Error(`approval failed: ${approveHash}`);
    }
  }

  const exactInputSingleData = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        fee: decision.fee,
        recipient: decision.recipient,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const simulation = await publicClient.simulateContract({
    address: MAINNET_CONTRACTS.UNISWAP_SWAP_ROUTER_02,
    abi: swapRouter02Abi,
    functionName: "multicall",
    args: [deadline, [exactInputSingleData]],
    account: account.address,
    value: 0n,
    ...fees,
  });

  const swapHash = await walletClient.writeContract(simulation.request);
  console.log(`swap submitted: ${swapHash}`);

  const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
  if (swapReceipt.status !== "success") {
    throw new Error(`swap failed: ${swapHash}`);
  }

  console.log(
    JSON.stringify(
      {
        decisionId: decision.id,
        swapHash,
        blockNumber: swapReceipt.blockNumber.toString(),
        gasUsed: swapReceipt.gasUsed.toString(),
      },
      null,
      2,
    ),
  );

  return { swapHash, receipt: swapReceipt };
}

async function quoteExactInput(
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  amountIn: bigint,
) {
  const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] =
    await publicClient.simulateContract({
      address: MAINNET_CONTRACTS.UNISWAP_V3_QUOTER_V2,
      abi: quoterV2Abi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
    }).then((result) => result.result);

  return { amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate };
}

async function enforceNotionalCap(
  decision: NormalizedDecision,
  amountIn: bigint,
  quotedAmountOut: bigint,
) {
  const maxTradeUsdc = parseUnits(envString("MAX_TRADE_USDC", "50000"), TOKENS.USDC.decimals);
  const notionalUsdc = decision.tokenIn === "USDC" ? amountIn : quotedAmountOut;

  if (notionalUsdc > maxTradeUsdc) {
    throw new Error(
      `Trade notional ${formatUnits(notionalUsdc, TOKENS.USDC.decimals)} USDC exceeds MAX_TRADE_USDC=${formatUnits(
        maxTradeUsdc,
        TOKENS.USDC.decimals,
      )}`,
    );
  }
}

async function checkedEip1559Fees() {
  const estimated = await publicClient.estimateFeesPerGas();
  const maxFeeCap = parseGwei(envString("MAX_FEE_PER_GAS_GWEI", "80"));
  const priorityCap = parseGwei(envString("MAX_PRIORITY_FEE_PER_GAS_GWEI", "3"));

  const maxFeePerGas = estimated.maxFeePerGas ?? maxFeeCap;
  const maxPriorityFeePerGas = estimated.maxPriorityFeePerGas ?? priorityCap;

  if (maxFeePerGas > maxFeeCap) {
    throw new Error(
      `Estimated maxFeePerGas ${formatUnits(maxFeePerGas, 9)} gwei exceeds MAX_FEE_PER_GAS_GWEI`,
    );
  }

  if (maxPriorityFeePerGas > priorityCap) {
    throw new Error(
      `Estimated priority fee ${formatUnits(maxPriorityFeePerGas, 9)} gwei exceeds MAX_PRIORITY_FEE_PER_GAS_GWEI`,
    );
  }

  return { maxFeePerGas, maxPriorityFeePerGas };
}

function applySlippage(amount: bigint, slippageBps: number) {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > envInt("MAX_SLIPPAGE_BPS", 75)) {
    throw new Error(`maxSlippageBps must be an integer between 0 and MAX_SLIPPAGE_BPS`);
  }

  return (amount * (BASIS_POINTS - BigInt(slippageBps))) / BASIS_POINTS;
}

type NormalizedDecision = Required<Pick<RebalanceDecision, "id" | "tokenIn" | "tokenOut" | "amountIn" | "maxSlippageBps" | "fee" | "recipient">> & {
  reason?: string;
};

function normalizeDecision(decision: RebalanceDecision): NormalizedDecision {
  if (!decision.id) {
    throw new Error("decision.id is required for logs and idempotency tracking");
  }

  if (decision.tokenIn !== "USDC" && decision.tokenIn !== "WETH") {
    throw new Error("tokenIn must be USDC or WETH");
  }

  const tokenOut = decision.tokenOut ?? (decision.tokenIn === "USDC" ? "WETH" : "USDC");
  if (tokenOut !== "USDC" && tokenOut !== "WETH") {
    throw new Error("tokenOut must be USDC or WETH");
  }

  if (decision.tokenIn === tokenOut) {
    throw new Error("tokenIn and tokenOut must differ");
  }

  return {
    id: decision.id,
    tokenIn: decision.tokenIn,
    tokenOut,
    amountIn: decision.amountIn,
    maxSlippageBps: decision.maxSlippageBps,
  fee: normalizeFee(decision.fee ?? envInt("UNISWAP_V3_FEE", 500)),
    recipient: getAddress(decision.recipient ?? account.address),
    reason: decision.reason,
  };
}

function normalizeFee(fee: number): SupportedV3Fee {
  if (SUPPORTED_V3_FEES.includes(fee as SupportedV3Fee)) {
    return fee as SupportedV3Fee;
  }
  throw new Error(`fee must be one of ${SUPPORTED_V3_FEES.join(", ")}`);
}

function requireLiveMainnetFlag() {
  if (process.env.LIVE_MAINNET !== "true") {
    throw new Error("Set LIVE_MAINNET=true to enable signing and broadcasting Ethereum mainnet transactions");
  }
}

function readDecisionFromCli() {
  const decisionArg = process.argv.find((arg) => arg.startsWith("--decision="));
  if (decisionArg) {
    return JSON.parse(decisionArg.slice("--decision=".length)) as RebalanceDecision;
  }

  const fileArg = process.argv.find((arg) => arg.startsWith("--decision-file="));
  if (fileArg) {
    return JSON.parse(readFileSync(fileArg.slice("--decision-file=".length), "utf8")) as RebalanceDecision;
  }

  const decisionJson = process.env.REBALANCE_DECISION_JSON;
  if (decisionJson) {
    return JSON.parse(decisionJson) as RebalanceDecision;
  }

  throw new Error(
    'Provide --decision=\'{"id":"...","tokenIn":"USDC","amountIn":"25000","maxSlippageBps":35}\' or REBALANCE_DECISION_JSON',
  );
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function envString(name: string, fallback: string) {
  return process.env[name] ?? fallback;
}

function envInt(name: string, fallback: number) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

if (process.argv[1]?.endsWith("rebalance.ts") || process.argv[1]?.endsWith("rebalance.js")) {
  executeRebalance(readDecisionFromCli()).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
