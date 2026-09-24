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
  parseEther,
  parseGwei,
  parseUnits,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

type Side = "weth_to_usdc" | "usdc_to_weth";

type RebalanceDecision = {
  id?: string;
  side: Side;
  amount: string;
  maxSlippageBps?: number;
  reason?: string;
};

type Token = {
  symbol: "WETH" | "USDC";
  address: Address;
  decimals: number;
};

type RouteQuote = {
  fee: 500 | 3_000 | 10_000;
  amountOut: bigint;
  pool: Address;
  gasEstimate: bigint;
};

const CHAIN_ID = 1;

const WETH: Token = {
  symbol: "WETH",
  address: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  decimals: 18,
};

const USDC: Token = {
  symbol: "USDC",
  address: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  decimals: 6,
};

const CONTRACTS = {
  uniswapV3Factory: getAddress("0x1F98431c8aD98523631AE4a59f267346ea31F984"),
  uniswapV3SwapRouter02: getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
  uniswapV3QuoterV2: getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),
} as const;

const UNISWAP_V3_FEES = [500, 3_000, 10_000] as const;

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

const poolAbi = [
  {
    type: "function",
    name: "liquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }],
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

const swapRouter02Abi = [
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

const rpcUrl = requiredEnv("MAINNET_RPC_URL");
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(rpcUrl),
});

const execute = envFlag("EXECUTE_MAINNET");
const dryRun = !execute;
const privateKey = execute ? requiredEnv("PRIVATE_KEY") : optionalEnv("PRIVATE_KEY");
const account = privateKey
  ? privateKeyToAccount(normalizePrivateKey(privateKey))
  : undefined;

const walletClient = account
  ? createWalletClient({
      account,
      chain: mainnet,
      transport: http(rpcUrl),
    })
  : undefined;

async function main() {
  const decision = loadDecision();
  const { tokenIn, tokenOut } = tokensFor(decision.side);
  const amountIn = parseUnits(decision.amount, tokenIn.decimals);
  const slippageBps = normalizeSlippage(decision.maxSlippageBps);

  if (amountIn <= 0n) {
    throw new Error("Decision amount must be greater than zero.");
  }

  const chainId = await publicClient.getChainId();
  if (chainId !== CHAIN_ID) {
    throw new Error(`Refusing to run on chain ${chainId}; expected Ethereum mainnet chain ${CHAIN_ID}.`);
  }

  if (!account) {
    console.log("No PRIVATE_KEY present. Running route/quote validation only.");
  } else {
    const expectedSigner = optionalEnv("EXPECTED_SIGNER");
    if (expectedSigner && getAddress(expectedSigner) !== account.address) {
      throw new Error(`PRIVATE_KEY resolves to ${account.address}, not EXPECTED_SIGNER ${getAddress(expectedSigner)}.`);
    }
  }

  const signer = account?.address ?? getAddress(optionalEnv("QUOTE_ONLY_ADDRESS") ?? zeroAddress);
  const quote = await bestQuote(tokenIn, tokenOut, amountIn);
  const amountOutMinimum = applySlippage(quote.amountOut, slippageBps);
  const tradeUsdNotional = await tradeNotionalInUsdc(tokenIn, tokenOut, amountIn, quote.amountOut);

  await enforcePolicy({
    signer,
    tokenIn,
    amountIn,
    tradeUsdNotional,
  });

  const feeState = await publicClient.estimateFeesPerGas();
  const maxFeePerGas = feeState.maxFeePerGas ?? feeState.gasPrice;
  const configuredMaxFee = parseGwei(optionalEnv("MAX_FEE_PER_GAS_GWEI") ?? "80");
  if (maxFeePerGas && maxFeePerGas > configuredMaxFee) {
    throw new Error(
      `Refusing to trade: current max fee ${formatUnits(maxFeePerGas, 9)} gwei exceeds MAX_FEE_PER_GAS_GWEI ${formatUnits(configuredMaxFee, 9)}.`,
    );
  }

  console.log("Rebalance decision");
  console.log({
    id: decision.id ?? null,
    reason: decision.reason ?? null,
    signer,
    dryRun,
    side: decision.side,
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    amountIn: `${formatUnits(amountIn, tokenIn.decimals)} ${tokenIn.symbol}`,
    selectedPool: quote.pool,
    selectedFeeTier: quote.fee,
    quotedAmountOut: `${formatUnits(quote.amountOut, tokenOut.decimals)} ${tokenOut.symbol}`,
    amountOutMinimum: `${formatUnits(amountOutMinimum, tokenOut.decimals)} ${tokenOut.symbol}`,
    slippageBps,
    router: CONTRACTS.uniswapV3SwapRouter02,
    quoter: CONTRACTS.uniswapV3QuoterV2,
    factory: CONTRACTS.uniswapV3Factory,
    maxFeePerGasGwei: maxFeePerGas ? formatUnits(maxFeePerGas, 9) : null,
  });

  if (dryRun) {
    console.log("Dry run complete. Set EXECUTE_MAINNET=true to approve/sign/submit.");
    return;
  }

  if (!account || !walletClient) {
    throw new Error("EXECUTE_MAINNET=true requires PRIVATE_KEY.");
  }

  if (optionalEnv("AUTONOMOUS_MAINNET_ACK") !== "I_ACCEPT_LOSS_OF_HOT_WALLET_FUNDS") {
    throw new Error(
      "Set AUTONOMOUS_MAINNET_ACK=I_ACCEPT_LOSS_OF_HOT_WALLET_FUNDS after funding only a bounded hot wallet.",
    );
  }

  const gasBalance = await publicClient.getBalance({ address: account.address });
  const minGasBalance = parseEther(optionalEnv("MIN_ETH_FOR_GAS") ?? "0.05");
  if (gasBalance < minGasBalance) {
    throw new Error(`Signer has ${formatEther(gasBalance)} ETH for gas; minimum is ${formatEther(minGasBalance)}.`);
  }

  await ensureExactAllowance(account.address, tokenIn, amountIn);

  const swapParams = {
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    fee: quote.fee,
    recipient: account.address,
    amountIn,
    amountOutMinimum,
    sqrtPriceLimitX96: 0n,
  };

  const swapSimulation = await publicClient.simulateContract({
    account,
    address: CONTRACTS.uniswapV3SwapRouter02,
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [swapParams],
    value: 0n,
  });

  const gas = await publicClient.estimateContractGas(swapSimulation.request);
  console.log("About to sign swap", {
    to: CONTRACTS.uniswapV3SwapRouter02,
    estimatedGas: gas.toString(),
    estimatedGasCostEth:
      maxFeePerGas === undefined ? null : formatEther(gas * maxFeePerGas),
  });

  const hash = await walletClient.writeContract(swapSimulation.request);
  console.log(`Submitted swap tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: Number(optionalEnv("REQUIRED_CONFIRMATIONS") ?? "2"),
  });
  console.log("Swap confirmed", {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    status: receipt.status,
  });
}

async function ensureExactAllowance(owner: Address, token: Token, amount: bigint) {
  const allowance = await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, CONTRACTS.uniswapV3SwapRouter02],
  });

  if (allowance === amount) {
    return;
  }

  if (allowance > 0n) {
    await approveAndWait(token, 0n, "clear existing allowance");
  }

  await approveAndWait(token, amount, `set exact ${token.symbol} allowance`);
}

async function approveAndWait(token: Token, value: bigint, label: string) {
  if (!account || !walletClient) {
    throw new Error("approveAndWait called without a signer.");
  }

  const simulation = await publicClient.simulateContract({
    account,
    address: token.address,
    abi: erc20Abi,
    functionName: "approve",
    args: [CONTRACTS.uniswapV3SwapRouter02, value],
  });
  const gas = await publicClient.estimateContractGas(simulation.request);
  console.log(`About to sign approval: ${label}`, {
    token: token.address,
    spender: CONTRACTS.uniswapV3SwapRouter02,
    value: formatUnits(value, token.decimals),
    estimatedGas: gas.toString(),
  });

  const hash = await walletClient.writeContract(simulation.request);
  console.log(`Submitted approval tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: Number(optionalEnv("REQUIRED_CONFIRMATIONS") ?? "2"),
  });
  if (receipt.status !== "success") {
    throw new Error(`Approval ${hash} failed.`);
  }
}

async function bestQuote(tokenIn: Token, tokenOut: Token, amountIn: bigint): Promise<RouteQuote> {
  const quotes = await Promise.all(
    UNISWAP_V3_FEES.map(async (fee) => {
      const pool = await publicClient.readContract({
        address: CONTRACTS.uniswapV3Factory,
        abi: factoryAbi,
        functionName: "getPool",
        args: [tokenIn.address, tokenOut.address, fee],
      });
      if (pool === zeroAddress) {
        return undefined;
      }

      const liquidity = await publicClient.readContract({
        address: pool,
        abi: poolAbi,
        functionName: "liquidity",
      });
      if (liquidity === 0n) {
        return undefined;
      }

      const quote = await publicClient.simulateContract({
        address: CONTRACTS.uniswapV3QuoterV2,
        abi: quoterV2Abi,
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
      const [amountOut, , , gasEstimate] = quote.result;
      return { fee, amountOut, pool, gasEstimate };
    }),
  );

  const liveQuotes: RouteQuote[] = [];
  for (const quote of quotes) {
    if (quote !== undefined) {
      liveQuotes.push(quote);
    }
  }
  if (liveQuotes.length === 0) {
    throw new Error(`No live Uniswap V3 WETH/USDC pool found for amount ${amountIn}.`);
  }

  return liveQuotes.sort((a, b) => (a.amountOut > b.amountOut ? -1 : 1))[0];
}

async function enforcePolicy(input: {
  signer: Address;
  tokenIn: Token;
  amountIn: bigint;
  tradeUsdNotional: bigint;
}) {
  const maxTradeUsdc = parseUnits(optionalEnv("MAX_TRADE_USDC") ?? "50000", USDC.decimals);
  if (input.tradeUsdNotional > maxTradeUsdc) {
    throw new Error(
      `Trade notional ${formatUnits(input.tradeUsdNotional, USDC.decimals)} USDC exceeds MAX_TRADE_USDC ${formatUnits(maxTradeUsdc, USDC.decimals)}.`,
    );
  }

  if (input.signer === zeroAddress) {
    return;
  }

  const tokenInBalance = await publicClient.readContract({
    address: input.tokenIn.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [input.signer],
  });
  if (tokenInBalance < input.amountIn) {
    throw new Error(
      `Signer has ${formatUnits(tokenInBalance, input.tokenIn.decimals)} ${input.tokenIn.symbol}; needs ${formatUnits(input.amountIn, input.tokenIn.decimals)}.`,
    );
  }

  const maxHotWalletUsdc = parseUnits(optionalEnv("MAX_HOT_WALLET_USDC") ?? "75000", USDC.decimals);
  const hotWalletUsdc = await hotWalletExposureUsdc(input.signer);
  if (hotWalletUsdc > maxHotWalletUsdc) {
    throw new Error(
      `Hot wallet exposure is ${formatUnits(hotWalletUsdc, USDC.decimals)} USDC; cap is MAX_HOT_WALLET_USDC ${formatUnits(maxHotWalletUsdc, USDC.decimals)}.`,
    );
  }
}

async function hotWalletExposureUsdc(owner: Address) {
  const [usdcBalance, wethBalance] = await Promise.all([
    publicClient.readContract({
      address: USDC.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    }),
    publicClient.readContract({
      address: WETH.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    }),
  ]);

  if (wethBalance === 0n) {
    return usdcBalance;
  }

  const wethQuote = await bestQuote(WETH, USDC, wethBalance);
  return usdcBalance + wethQuote.amountOut;
}

async function tradeNotionalInUsdc(tokenIn: Token, tokenOut: Token, amountIn: bigint, amountOut: bigint) {
  if (tokenIn.symbol === "USDC") {
    return amountIn;
  }
  if (tokenOut.symbol === "USDC") {
    return amountOut;
  }
  throw new Error("Unsupported pair for notional check.");
}

function tokensFor(side: Side) {
  if (side === "weth_to_usdc") {
    return { tokenIn: WETH, tokenOut: USDC };
  }
  return { tokenIn: USDC, tokenOut: WETH };
}

function applySlippage(amount: bigint, bps: number) {
  return (amount * BigInt(10_000 - bps)) / 10_000n;
}

function normalizeSlippage(input?: number) {
  const value = input ?? Number(optionalEnv("MAX_SLIPPAGE_BPS") ?? "30");
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("maxSlippageBps must be an integer from 1 to 100.");
  }
  return value;
}

function loadDecision(): RebalanceDecision {
  const rawJson = optionalEnv("REBALANCE_DECISION");
  if (rawJson) {
    return validateDecision(JSON.parse(rawJson));
  }

  return validateDecision({
    id: optionalEnv("DECISION_ID"),
    side: requiredEnv("REBALANCE_SIDE"),
    amount: requiredEnv("REBALANCE_AMOUNT"),
    reason: optionalEnv("REBALANCE_REASON"),
    maxSlippageBps: optionalEnv("MAX_SLIPPAGE_BPS")
      ? Number(optionalEnv("MAX_SLIPPAGE_BPS"))
      : undefined,
  });
}

function validateDecision(value: unknown): RebalanceDecision {
  if (!value || typeof value !== "object") {
    throw new Error("Rebalance decision must be an object.");
  }
  const candidate = value as Partial<RebalanceDecision>;
  if (candidate.side !== "weth_to_usdc" && candidate.side !== "usdc_to_weth") {
    throw new Error("Decision side must be weth_to_usdc or usdc_to_weth.");
  }
  if (!candidate.amount || !/^\d+(\.\d+)?$/.test(candidate.amount)) {
    throw new Error("Decision amount must be a positive decimal string in token units.");
  }
  return candidate as RebalanceDecision;
}

function normalizePrivateKey(value: string): Hex {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex string. Do not commit it.");
  }
  return normalized as Hex;
}

function envFlag(name: string) {
  return optionalEnv(name)?.toLowerCase() === "true";
}

function requiredEnv(name: string) {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
