import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const ADDRESSES = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  WETH: "0x4200000000000000000000000000000000000006",
  UNISWAP_V3_FACTORY: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
  UNISWAP_V3_QUOTER_V2: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
  UNISWAP_SWAP_ROUTER_02: "0x2626664c2603336E57B271c5C0b26F421741e481",
  CHAINLINK_ETH_USD: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
} as const satisfies Record<string, Address>;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const DEFAULT_FEE_TIERS = [100, 500, 3_000, 10_000] as const;
const USDC_DECIMALS = 6;
const WETH_DECIMALS = 18;
const CHAINLINK_USD_DECIMALS = 8;

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
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

const chainlinkFeedAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);

type FeeTier = (typeof DEFAULT_FEE_TIERS)[number] | number;

type Quote = {
  fee: FeeTier;
  amountIn: bigint;
  amountOut: bigint;
  gasEstimate: bigint;
};

type Pool = {
  fee: FeeTier;
  address: Address;
  liquidity: bigint;
};

type Leg = Quote & {
  amountOutMinimum: bigint;
  calldata: Hex;
};

const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
const transport = http(rpcUrl);

const publicClient = createPublicClient({
  chain: base,
  transport,
});

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function envInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a non-negative integer`);
  return Number(value);
}

function envBool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function formatBps(bps: bigint): string {
  const whole = bps / 100n;
  const fractional = (bps % 100n).toString().padStart(2, "0");
  return `${whole}.${fractional}%`;
}

function applyBps(value: bigint, bps: number): bigint {
  return (value * BigInt(bps)) / 10_000n;
}

function assertPrivateKey(value: string): Hex {
  const prefixed = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex private key");
  }
  return prefixed as Hex;
}

function parseFeeTiers(): FeeTier[] {
  const value = process.env.FEE_TIERS;
  if (!value) return [...DEFAULT_FEE_TIERS];

  const tiers = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  if (tiers.length === 0) throw new Error("FEE_TIERS did not contain any valid fee tiers");
  return [...new Set(tiers)];
}

async function getLivePools(feeTiers: FeeTier[]): Promise<Pool[]> {
  const pools: Pool[] = [];

  for (const fee of feeTiers) {
    const pool = await publicClient.readContract({
      address: ADDRESSES.UNISWAP_V3_FACTORY,
      abi: factoryAbi,
      functionName: "getPool",
      args: [ADDRESSES.USDC, ADDRESSES.WETH, fee],
    });

    if (pool === ZERO_ADDRESS) continue;

    const liquidity = await publicClient.readContract({
      address: pool,
      abi: poolAbi,
      functionName: "liquidity",
    });

    if (liquidity > 0n) {
      pools.push({ fee, address: pool, liquidity });
    }
  }

  return pools;
}

async function quoteFee(fee: FeeTier, amountIn: bigint): Promise<Quote | null> {
  if (amountIn === 0n) return null;

  try {
    const { result } = await publicClient.simulateContract({
      address: ADDRESSES.UNISWAP_V3_QUOTER_V2,
      abi: quoterV2Abi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: ADDRESSES.USDC,
          tokenOut: ADDRESSES.WETH,
          amountIn,
          fee,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });

    const [amountOut, , , gasEstimate] = result;
    return { fee, amountIn, amountOut, gasEstimate };
  } catch {
    return null;
  }
}

async function planSplit(pools: Pool[], amountIn: bigint, chunks: number): Promise<Quote[]> {
  if (pools.length === 0) throw new Error("No live Uniswap v3 USDC/WETH pools found");

  const forcedFee = process.env.FORCE_FEE ? Number(process.env.FORCE_FEE) : undefined;
  if (forcedFee !== undefined) {
    const quote = await quoteFee(forcedFee, amountIn);
    if (!quote) throw new Error(`Could not quote FORCE_FEE=${forcedFee}`);
    return [quote];
  }

  const actualChunks = Number(amountIn < BigInt(chunks) ? amountIn : BigInt(chunks));
  if (actualChunks < 1) throw new Error("USDC_AMOUNT is too small");

  const allocations = new Map<FeeTier, bigint>();
  const outputs = new Map<FeeTier, bigint>();
  for (const pool of pools) {
    allocations.set(pool.fee, 0n);
    outputs.set(pool.fee, 0n);
  }

  const baseChunk = amountIn / BigInt(actualChunks);
  const remainder = Number(amountIn % BigInt(actualChunks));

  for (let i = 0; i < actualChunks; i++) {
    const chunk = baseChunk + (i < remainder ? 1n : 0n);
    let best: Quote | null = null;
    let bestMarginal = -1n;

    for (const pool of pools) {
      const nextInput = (allocations.get(pool.fee) ?? 0n) + chunk;
      const nextQuote = await quoteFee(pool.fee, nextInput);
      if (!nextQuote) continue;

      const marginal = nextQuote.amountOut - (outputs.get(pool.fee) ?? 0n);
      if (marginal > bestMarginal) {
        best = nextQuote;
        bestMarginal = marginal;
      }
    }

    if (!best) throw new Error(`Could not quote chunk ${i + 1}/${actualChunks}`);
    allocations.set(best.fee, best.amountIn);
    outputs.set(best.fee, best.amountOut);
  }

  const planned: Quote[] = [];
  for (const [fee, allocated] of allocations.entries()) {
    if (allocated === 0n) continue;
    const finalQuote = await quoteFee(fee, allocated);
    if (!finalQuote) throw new Error(`Final quote failed for fee tier ${fee}`);
    planned.push(finalQuote);
  }

  return planned.sort((a, b) => b.amountOut > a.amountOut ? 1 : -1);
}

async function getOracleFairWeth(amountIn: bigint): Promise<{ fairOut: bigint; updatedAt: bigint }> {
  const feedDecimals = await publicClient.readContract({
    address: ADDRESSES.CHAINLINK_ETH_USD,
    abi: chainlinkFeedAbi,
    functionName: "decimals",
  });

  if (feedDecimals !== CHAINLINK_USD_DECIMALS) {
    throw new Error(`Unexpected Chainlink ETH/USD decimals: ${feedDecimals}`);
  }

  const [, answer, , updatedAt] = await publicClient.readContract({
    address: ADDRESSES.CHAINLINK_ETH_USD,
    abi: chainlinkFeedAbi,
    functionName: "latestRoundData",
  });

  if (answer <= 0n) throw new Error("Chainlink ETH/USD answer is not positive");

  const fairOut = (amountIn * 10n ** BigInt(WETH_DECIMALS + CHAINLINK_USD_DECIMALS - USDC_DECIMALS)) / answer;
  return { fairOut, updatedAt };
}

async function ensureAllowance(
  account: ReturnType<typeof privateKeyToAccount>,
  walletClient: ReturnType<typeof createWalletClient>,
  amountIn: bigint,
): Promise<void> {
  const allowance = await publicClient.readContract({
    address: ADDRESSES.USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, ADDRESSES.UNISWAP_SWAP_ROUTER_02],
  });

  if (allowance >= amountIn) {
    console.log(`Router allowance: ${formatUnits(allowance, USDC_DECIMALS)} USDC`);
    return;
  }

  const approvalAmount = envBool("APPROVE_MAX")
    ? (2n ** 256n) - 1n
    : amountIn;

  if (allowance > 0n) {
    console.log("Resetting existing USDC allowance to 0 before setting the new allowance...");
    const reset = await walletClient.writeContract({
      address: ADDRESSES.USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [ADDRESSES.UNISWAP_SWAP_ROUTER_02, 0n],
      account,
      chain: base,
    });
    await publicClient.waitForTransactionReceipt({ hash: reset });
  }

  console.log(
    `Approving router for ${envBool("APPROVE_MAX") ? "max uint256" : `${formatUnits(approvalAmount, USDC_DECIMALS)} USDC`}...`,
  );

  const approval = await walletClient.writeContract({
    address: ADDRESSES.USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [ADDRESSES.UNISWAP_SWAP_ROUTER_02, approvalAmount],
    account,
    chain: base,
  });
  console.log(`Approval tx: ${approval}`);
  await publicClient.waitForTransactionReceipt({ hash: approval });
}

function buildLegs(quotes: Quote[], recipient: Address, slippageBps: number): Leg[] {
  return quotes.map((quote) => {
    const amountOutMinimum = applyBps(quote.amountOut, 10_000 - slippageBps);
    const calldata = encodeFunctionData({
      abi: swapRouter02Abi,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: ADDRESSES.USDC,
          tokenOut: ADDRESSES.WETH,
          fee: quote.fee,
          recipient,
          amountIn: quote.amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });

    return { ...quote, amountOutMinimum, calldata };
  });
}

async function main(): Promise<void> {
  const privateKey = assertPrivateKey(env("PRIVATE_KEY"));
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport,
  });

  const amountIn = parseUnits(env("USDC_AMOUNT"), USDC_DECIMALS);
  const recipient = getAddress(process.env.RECIPIENT ?? account.address);
  const slippageBps = envInt("SLIPPAGE_BPS", 30);
  const maxOracleShortfallBps = envInt("MAX_ORACLE_SHORTFALL_BPS", 150);
  const quoteChunks = envInt("QUOTE_CHUNKS", 24);
  const deadlineSeconds = envInt("DEADLINE_SECONDS", 120);
  const oracleMaxAgeSeconds = envInt("ORACLE_MAX_AGE_SECONDS", 3_600);
  const execute = envBool("EXECUTE");

  if (slippageBps >= 10_000) throw new Error("SLIPPAGE_BPS must be below 10000");
  if (quoteChunks < 1 || quoteChunks > 100) throw new Error("QUOTE_CHUNKS must be between 1 and 100");

  const chainId = await publicClient.getChainId();
  if (chainId !== base.id) throw new Error(`RPC is not Base mainnet; got chain ${chainId}`);

  const [usdcDecimals, wethDecimals, balance, nativeBalance] = await Promise.all([
    publicClient.readContract({ address: ADDRESSES.USDC, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: ADDRESSES.WETH, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({
      address: ADDRESSES.USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.getBalance({ address: account.address }),
  ]);

  if (usdcDecimals !== USDC_DECIMALS) throw new Error(`Unexpected USDC decimals: ${usdcDecimals}`);
  if (wethDecimals !== WETH_DECIMALS) throw new Error(`Unexpected WETH decimals: ${wethDecimals}`);
  if (balance < amountIn) {
    throw new Error(`Insufficient USDC: have ${formatUnits(balance, USDC_DECIMALS)}, need ${formatUnits(amountIn, USDC_DECIMALS)}`);
  }
  if (nativeBalance === 0n) throw new Error("Account has no ETH on Base to pay gas");

  console.log(`Account: ${account.address}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Input: ${formatUnits(amountIn, USDC_DECIMALS)} USDC`);
  console.log(`Router: ${ADDRESSES.UNISWAP_SWAP_ROUTER_02}`);

  const pools = await getLivePools(parseFeeTiers());
  console.log("Live USDC/WETH pools:");
  for (const pool of pools) {
    console.log(`  fee ${pool.fee}: ${pool.address}, liquidity ${pool.liquidity.toString()}`);
  }

  const quotes = await planSplit(pools, amountIn, quoteChunks);
  const totalQuoted = quotes.reduce((sum, quote) => sum + quote.amountOut, 0n);
  const legs = buildLegs(quotes, recipient, slippageBps);
  const totalMinOut = legs.reduce((sum, leg) => sum + leg.amountOutMinimum, 0n);

  console.log("Planned swap legs:");
  for (const leg of legs) {
    console.log(
      `  fee ${leg.fee}: ${formatUnits(leg.amountIn, USDC_DECIMALS)} USDC -> quote ${formatUnits(leg.amountOut, WETH_DECIMALS)} WETH, min ${formatUnits(leg.amountOutMinimum, WETH_DECIMALS)} WETH`,
    );
  }
  console.log(`Total quoted out: ${formatUnits(totalQuoted, WETH_DECIMALS)} WETH`);
  console.log(`Total min out: ${formatUnits(totalMinOut, WETH_DECIMALS)} WETH (${formatBps(BigInt(slippageBps))} slippage tolerance)`);

  const { fairOut, updatedAt } = await getOracleFairWeth(amountIn);
  const now = BigInt(Math.floor(Date.now() / 1_000));
  if (updatedAt + BigInt(oracleMaxAgeSeconds) < now) {
    throw new Error(`Chainlink ETH/USD feed is stale; updatedAt=${updatedAt}`);
  }

  if (totalQuoted < fairOut) {
    const shortfallBps = ((fairOut - totalQuoted) * 10_000n) / fairOut;
    console.log(`Oracle fair WETH: ${formatUnits(fairOut, WETH_DECIMALS)}; quoted shortfall: ${formatBps(shortfallBps)}`);
    if (shortfallBps > BigInt(maxOracleShortfallBps)) {
      throw new Error(`Quote is worse than oracle guard: ${formatBps(shortfallBps)} > ${formatBps(BigInt(maxOracleShortfallBps))}`);
    }
  } else {
    const improvementBps = ((totalQuoted - fairOut) * 10_000n) / fairOut;
    console.log(`Oracle fair WETH: ${formatUnits(fairOut, WETH_DECIMALS)}; quoted improvement: ${formatBps(improvementBps)}`);
  }

  const deadline = BigInt(Math.floor(Date.now() / 1_000) + deadlineSeconds);

  if (!execute) {
    const allowance = await publicClient.readContract({
      address: ADDRESSES.USDC,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, ADDRESSES.UNISWAP_SWAP_ROUTER_02],
    });

    console.log("DRY RUN: set EXECUTE=true to approve and submit the swap.");
    if (allowance >= amountIn) {
      const simulation = await publicClient.simulateContract({
        address: ADDRESSES.UNISWAP_SWAP_ROUTER_02,
        abi: swapRouter02Abi,
        functionName: "multicall",
        args: [deadline, legs.map((leg) => leg.calldata)],
        account,
      });
      console.log(`Router multicall simulation returned ${simulation.result.length} result item(s).`);
    } else {
      console.log("Router simulation skipped because current USDC allowance is below the input amount.");
    }
    return;
  }

  await ensureAllowance(account, walletClient, amountIn);

  const simulation = await publicClient.simulateContract({
    address: ADDRESSES.UNISWAP_SWAP_ROUTER_02,
    abi: swapRouter02Abi,
    functionName: "multicall",
    args: [deadline, legs.map((leg) => leg.calldata)],
    account,
  });
  console.log(`Router multicall simulation returned ${simulation.result.length} result item(s).`);

  const hash = await walletClient.writeContract({
    address: ADDRESSES.UNISWAP_SWAP_ROUTER_02,
    abi: swapRouter02Abi,
    functionName: "multicall",
    args: [deadline, legs.map((leg) => leg.calldata)],
    account,
    chain: base,
  });

  console.log(`Swap tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Status: ${receipt.status}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
