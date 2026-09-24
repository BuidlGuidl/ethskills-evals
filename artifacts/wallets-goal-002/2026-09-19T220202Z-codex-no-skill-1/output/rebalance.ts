import { closeSync, openSync, unlinkSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseEther,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const ADDRESSES = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  UNISWAP_V3_FACTORY: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  UNISWAP_V3_QUOTER_V2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  UNISWAP_SWAP_ROUTER_02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
} as const satisfies Record<string, Address>;

const TOKENS = {
  WETH: { address: ADDRESSES.WETH, decimals: 18, symbol: "WETH" },
  USDC: { address: ADDRESSES.USDC, decimals: 6, symbol: "USDC" },
} as const;

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);

const poolAbi = parseAbi(["function liquidity() view returns (uint128)"]);

const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const swapRouter02Abi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

type Side = "USDC_TO_WETH" | "WETH_TO_USDC";
type FeeTier = 100 | 500 | 3000 | 10000;

type RebalanceDecision = {
  side: Side;
  amount: string;
  feeTier?: FeeTier;
  maxSlippageBps?: number;
  maxPriceImpactBps?: number;
  id?: string;
  reason?: string;
};

type Token = (typeof TOKENS)[keyof typeof TOKENS];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

function boolEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes"].includes(raw.toLowerCase());
}

function assertBasisPoints(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`${name} must be an integer from 0 to 10000`);
  }
}

function bps(value: bigint, basisPoints: number): bigint {
  return (value * BigInt(basisPoints)) / 10_000n;
}

function parseDecision(): RebalanceDecision {
  const raw = requiredEnv("REBALANCE_DECISION_JSON");
  const decision = JSON.parse(raw) as RebalanceDecision;
  if (decision.side !== "USDC_TO_WETH" && decision.side !== "WETH_TO_USDC") {
    throw new Error("decision.side must be USDC_TO_WETH or WETH_TO_USDC");
  }
  if (!/^\d+(\.\d+)?$/.test(decision.amount)) {
    throw new Error("decision.amount must be a positive decimal string in tokenIn units");
  }
  if (Number(decision.amount) <= 0) throw new Error("decision.amount must be positive");
  if (
    decision.feeTier !== undefined &&
    ![100, 500, 3000, 10000].includes(decision.feeTier)
  ) {
    throw new Error("decision.feeTier must be one of 100, 500, 3000, 10000");
  }
  return decision;
}

function sideTokens(side: Side): { tokenIn: Token; tokenOut: Token } {
  return side === "USDC_TO_WETH"
    ? { tokenIn: TOKENS.USDC, tokenOut: TOKENS.WETH }
    : { tokenIn: TOKENS.WETH, tokenOut: TOKENS.USDC };
}

function acquireLock(): () => void {
  const lockfile = process.env.LOCKFILE ?? "/tmp/rebalance-mainnet.lock";
  let fd: number;
  try {
    fd = openSync(lockfile, "wx");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not acquire lock ${lockfile}: ${message}`);
  }
  return () => {
    closeSync(fd);
    unlinkSync(lockfile);
  };
}

const account = privateKeyToAccount(requiredEnv("PRIVATE_KEY") as Hex);
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(requiredEnv("MAINNET_RPC_URL")),
});
const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(requiredEnv("MAINNET_RPC_URL")),
});

async function assertMainnetAndTreasury(): Promise<void> {
  const chainId = await publicClient.getChainId();
  if (chainId !== 1) throw new Error(`RPC is on chainId ${chainId}, expected Ethereum mainnet`);

  const expectedTreasury = process.env.TREASURY_ADDRESS;
  if (expectedTreasury && getAddress(expectedTreasury) !== account.address) {
    throw new Error(
      `PRIVATE_KEY derives ${account.address}, not TREASURY_ADDRESS ${getAddress(expectedTreasury)}`,
    );
  }
}

async function assertTokenMetadata(): Promise<void> {
  const [wethDecimals, usdcDecimals, wethSymbol, usdcSymbol] = await Promise.all([
    publicClient.readContract({
      address: TOKENS.WETH.address,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: TOKENS.USDC.address,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: TOKENS.WETH.address,
      abi: erc20Abi,
      functionName: "symbol",
    }),
    publicClient.readContract({
      address: TOKENS.USDC.address,
      abi: erc20Abi,
      functionName: "symbol",
    }),
  ]);

  if (wethDecimals !== 18 || usdcDecimals !== 6 || wethSymbol !== "WETH" || usdcSymbol !== "USDC") {
    throw new Error(
      `Unexpected token metadata: WETH ${wethSymbol}/${wethDecimals}, USDC ${usdcSymbol}/${usdcDecimals}`,
    );
  }
}

async function assertGasBalance(): Promise<void> {
  const balance = await publicClient.getBalance({ address: account.address });
  const minimum = parseEther(process.env.MIN_ETH_BALANCE ?? "0.05");
  if (balance < minimum) {
    throw new Error(
      `Treasury has ${formatEther(balance)} ETH for gas, below MIN_ETH_BALANCE ${formatEther(minimum)}`,
    );
  }
}

async function getPoolAddress(fee: FeeTier): Promise<Address> {
  const pool = await publicClient.readContract({
    address: ADDRESSES.UNISWAP_V3_FACTORY,
    abi: factoryAbi,
    functionName: "getPool",
    args: [TOKENS.USDC.address, TOKENS.WETH.address, fee],
  });
  if (pool === zeroAddress) throw new Error(`No WETH/USDC Uniswap V3 pool for fee tier ${fee}`);

  const liquidity = await publicClient.readContract({
    address: pool,
    abi: poolAbi,
    functionName: "liquidity",
  });
  if (liquidity === 0n) throw new Error(`WETH/USDC pool ${pool} has zero active liquidity`);
  return pool;
}

async function quoteExactInput(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: bigint,
  fee: FeeTier,
): Promise<{ amountOut: bigint; gasEstimate: bigint }> {
  const { result } = await publicClient.simulateContract({
    address: ADDRESSES.UNISWAP_V3_QUOTER_V2,
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
    account,
  });

  const [amountOut, , , gasEstimate] = result;
  return { amountOut, gasEstimate };
}

async function assertTradeSize(
  side: Side,
  amountIn: bigint,
  quotedAmountOut: bigint,
): Promise<void> {
  const maxTradeUsdc = parseUnits(process.env.MAX_TRADE_USDC ?? "50000", TOKENS.USDC.decimals);
  const usdcNotional = side === "USDC_TO_WETH" ? amountIn : quotedAmountOut;
  if (usdcNotional > maxTradeUsdc) {
    throw new Error(
      `Trade notional ${formatUnits(usdcNotional, TOKENS.USDC.decimals)} USDC exceeds MAX_TRADE_USDC ${formatUnits(
        maxTradeUsdc,
        TOKENS.USDC.decimals,
      )}`,
    );
  }
}

async function assertPriceImpact(
  side: Side,
  tokenIn: Token,
  tokenOut: Token,
  amountIn: bigint,
  quotedAmountOut: bigint,
  fee: FeeTier,
  maxPriceImpactBps: number,
): Promise<void> {
  const referenceAmount =
    side === "USDC_TO_WETH"
      ? parseUnits(process.env.REFERENCE_USDC_AMOUNT ?? "1000", TOKENS.USDC.decimals)
      : parseUnits(process.env.REFERENCE_WETH_AMOUNT ?? "0.1", TOKENS.WETH.decimals);

  if (amountIn <= referenceAmount) return;

  const referenceQuote = await quoteExactInput(tokenIn, tokenOut, referenceAmount, fee);
  if (referenceQuote.amountOut === 0n) throw new Error("Reference quote returned zero output");

  const scaledExecutionBps =
    (quotedAmountOut * referenceAmount * 10_000n) / (referenceQuote.amountOut * amountIn);
  const worseThanReferenceBps =
    scaledExecutionBps >= 10_000n ? 0 : Number(10_000n - scaledExecutionBps);

  if (worseThanReferenceBps > maxPriceImpactBps) {
    throw new Error(
      `Quoted average price is ${worseThanReferenceBps} bps worse than the reference quote; max is ${maxPriceImpactBps} bps`,
    );
  }
}

async function ensureAllowance(token: Token, amountIn: bigint, execute: boolean): Promise<void> {
  const allowance = await publicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, ADDRESSES.UNISWAP_SWAP_ROUTER_02],
  });
  if (allowance >= amountIn) return;
  if (!execute) {
    console.log(
      `[dry-run] would approve ${ADDRESSES.UNISWAP_SWAP_ROUTER_02} for ${formatUnits(
        amountIn,
        token.decimals,
      )} ${token.symbol}`,
    );
    return;
  }

  if (allowance > 0n) {
    const { request } = await publicClient.simulateContract({
      account,
      address: token.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [ADDRESSES.UNISWAP_SWAP_ROUTER_02, 0n],
    });
    const hash = await walletClient.writeContract(request);
    console.log(`approve-reset ${token.symbol}: ${hash}`);
    await waitForSuccessfulReceipt(hash, `approve-reset ${token.symbol}`);
  }

  const { request } = await publicClient.simulateContract({
    account,
    address: token.address,
    abi: erc20Abi,
    functionName: "approve",
    args: [ADDRESSES.UNISWAP_SWAP_ROUTER_02, amountIn],
  });
  const hash = await walletClient.writeContract(request);
  console.log(`approve ${token.symbol}: ${hash}`);
  await waitForSuccessfulReceipt(hash, `approve ${token.symbol}`);
}

async function waitForSuccessfulReceipt(hash: Hex, label: string): Promise<void> {
  const confirmations = intEnv("TX_CONFIRMATIONS", 2);
  if (!Number.isInteger(confirmations) || confirmations < 1) {
    throw new Error("TX_CONFIRMATIONS must be a positive integer");
  }

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations,
    timeout: intEnv("TX_RECEIPT_TIMEOUT_MS", 900_000),
  });
  if (receipt.status !== "success") throw new Error(`${label} ${hash} failed`);
  console.log(`${label} confirmed in block ${receipt.blockNumber}; gas used ${receipt.gasUsed}`);
}

async function executeRebalance(decision: RebalanceDecision): Promise<void> {
  const releaseLock = acquireLock();
  try {
    await assertMainnetAndTreasury();
    await assertTokenMetadata();
    await assertGasBalance();

    const execute = boolEnv("EXECUTE", false);
    const fee = decision.feeTier ?? (intEnv("UNISWAP_FEE_TIER", 500) as FeeTier);
    if (![100, 500, 3000, 10000].includes(fee)) throw new Error("UNISWAP_FEE_TIER is invalid");

    const operatorMaxSlippageBps = intEnv("MAX_SLIPPAGE_BPS", 30);
    const operatorMaxPriceImpactBps = intEnv("MAX_PRICE_IMPACT_BPS", 100);
    const maxSlippageBps = decision.maxSlippageBps ?? operatorMaxSlippageBps;
    const maxPriceImpactBps = decision.maxPriceImpactBps ?? operatorMaxPriceImpactBps;
    assertBasisPoints("MAX_SLIPPAGE_BPS", operatorMaxSlippageBps);
    assertBasisPoints("MAX_PRICE_IMPACT_BPS", operatorMaxPriceImpactBps);
    assertBasisPoints("decision.maxSlippageBps", maxSlippageBps);
    assertBasisPoints("decision.maxPriceImpactBps", maxPriceImpactBps);
    if (maxSlippageBps > operatorMaxSlippageBps) {
      throw new Error(`decision maxSlippageBps exceeds MAX_SLIPPAGE_BPS ${operatorMaxSlippageBps}`);
    }
    if (maxPriceImpactBps > operatorMaxPriceImpactBps) {
      throw new Error(
        `decision maxPriceImpactBps exceeds MAX_PRICE_IMPACT_BPS ${operatorMaxPriceImpactBps}`,
      );
    }

    const { tokenIn, tokenOut } = sideTokens(decision.side);
    const amountIn = parseUnits(decision.amount, tokenIn.decimals);
    const pool = await getPoolAddress(fee);

    const tokenInBalance = await publicClient.readContract({
      address: tokenIn.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    if (tokenInBalance < amountIn) {
      throw new Error(
        `Insufficient ${tokenIn.symbol}: have ${formatUnits(
          tokenInBalance,
          tokenIn.decimals,
        )}, need ${formatUnits(amountIn, tokenIn.decimals)}`,
      );
    }

    const quote = await quoteExactInput(tokenIn, tokenOut, amountIn, fee);
    if (quote.amountOut === 0n) throw new Error("Quoter returned zero output");
    await assertTradeSize(decision.side, amountIn, quote.amountOut);
    await assertPriceImpact(
      decision.side,
      tokenIn,
      tokenOut,
      amountIn,
      quote.amountOut,
      fee,
      maxPriceImpactBps,
    );

    const amountOutMinimum = quote.amountOut - bps(quote.amountOut, maxSlippageBps);
    const swapParams = {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      fee,
      recipient: account.address,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    };

    console.log(
      JSON.stringify(
        {
          mode: execute ? "execute" : "dry-run",
          account: account.address,
          decisionId: decision.id,
          reason: decision.reason,
          router: ADDRESSES.UNISWAP_SWAP_ROUTER_02,
          quoter: ADDRESSES.UNISWAP_V3_QUOTER_V2,
          factory: ADDRESSES.UNISWAP_V3_FACTORY,
          pool,
          tokenIn: tokenIn.symbol,
          tokenOut: tokenOut.symbol,
          amountIn: formatUnits(amountIn, tokenIn.decimals),
          quotedAmountOut: formatUnits(quote.amountOut, tokenOut.decimals),
          amountOutMinimum: formatUnits(amountOutMinimum, tokenOut.decimals),
          slippageBps: maxSlippageBps,
          quotedGasEstimate: quote.gasEstimate.toString(),
        },
        null,
        2,
      ),
    );

    await ensureAllowance(tokenIn, amountIn, execute);

    const simulation = await publicClient.simulateContract({
      account,
      address: ADDRESSES.UNISWAP_SWAP_ROUTER_02,
      abi: swapRouter02Abi,
      functionName: "exactInputSingle",
      args: [swapParams],
      value: 0n,
    });

    console.log(
      `simulated output: ${formatUnits(simulation.result, tokenOut.decimals)} ${tokenOut.symbol}`,
    );

    if (!execute) {
      console.log("[dry-run] set EXECUTE=true to sign and submit the swap transaction");
      return;
    }

    const hash = await walletClient.writeContract(simulation.request);
    console.log(`swap submitted: ${hash}`);
    await waitForSuccessfulReceipt(hash, "swap");
  } finally {
    releaseLock();
  }
}

executeRebalance(parseDecision()).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
