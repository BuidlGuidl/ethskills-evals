import "dotenv/config";

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const BASE_CHAIN_ID = 8453;

const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH: Address = "0x4200000000000000000000000000000000000006";
const UNISWAP_V3_QUOTER_V2: Address = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const UNISWAP_SWAP_ROUTER_02: Address = "0x2626664c2603336E57B271c5C0b26F421741e481";

const USDC_DECIMALS = 6;
const WETH_DECIMALS = 18;
const DEFAULT_FEE_TIERS = [100, 500, 3000] as const;
const MAX_UINT256 = (1n << 256n) - 1n;

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
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [
      { name: "deadline", type: "uint256" },
      { name: "data", type: "bytes[]" },
    ],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const;

type FeeTier = (typeof DEFAULT_FEE_TIERS)[number] | number;

type Quote = {
  fee: FeeTier;
  amountIn: bigint;
  amountOut: bigint;
  gasEstimate: bigint;
};

type SwapLeg = Quote & {
  amountOutMinimum: bigint;
};

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function parseBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseBps(name: string, fallback: number): number {
  const raw = process.env[name] ?? String(fallback);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
    throw new Error(`${name} must be an integer from 0 to 10000 bps`);
  }
  return parsed;
}

function parsePositiveInteger(name: string, fallback: number, max: number): number {
  const parsed = Number(process.env[name] ?? String(fallback));
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${name} must be an integer from 1 to ${max}`);
  }
  return parsed;
}

function parseFeeTiers(): FeeTier[] {
  const raw = process.env.FEE_TIERS;
  if (!raw) return [...DEFAULT_FEE_TIERS];

  const tiers = raw.split(",").map((part) => Number(part.trim()));
  if (tiers.length === 0 || tiers.some((tier) => !Number.isInteger(tier) || tier <= 0 || tier > 1_000_000)) {
    throw new Error("FEE_TIERS must be comma-separated Uniswap V3 fee units, e.g. 100,500,3000");
  }
  return [...new Set(tiers)];
}

function parsePrivateKey(raw: string): Hex {
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex private key");
  }
  return key as Hex;
}

function parseRecipient(defaultRecipient: Address): Address {
  const raw = process.env.RECIPIENT ?? defaultRecipient;
  if (!isAddress(raw)) throw new Error("RECIPIENT must be a valid EVM address");
  return raw;
}

function minAmount(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}

function formatUsdc(amount: bigint): string {
  return `${formatUnits(amount, USDC_DECIMALS)} USDC`;
}

function formatWeth(amount: bigint): string {
  return `${formatUnits(amount, WETH_DECIMALS)} WETH`;
}

function deadlineSeconds(ttlSeconds: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + ttlSeconds);
}

const publicClient = createPublicClient({
  chain: base,
  transport: http(env("BASE_RPC_URL")),
});

async function quoteExactInputSingle(fee: FeeTier, amountIn: bigint): Promise<Quote | null> {
  if (amountIn <= 0n) return null;

  try {
    const { result } = await publicClient.simulateContract({
      address: UNISWAP_V3_QUOTER_V2,
      abi: quoterV2Abi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: USDC,
          tokenOut: WETH,
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

async function buildSplitPlan(amountIn: bigint, feeTiers: FeeTier[], requestedChunks: number): Promise<SwapLeg[]> {
  let chunks = requestedChunks;
  while (chunks > 1 && amountIn / BigInt(chunks) === 0n) chunks -= 1;

  const chunkSize = amountIn / BigInt(chunks);
  const remainder = amountIn % BigInt(chunks);
  const cumulativeQuotes = new Map<FeeTier, Array<Quote | null>>();

  await Promise.all(
    feeTiers.map(async (fee) => {
      const quotes = await Promise.all(
        Array.from({ length: chunks }, (_, i) => quoteExactInputSingle(fee, chunkSize * BigInt(i + 1))),
      );
      if (quotes.some((quote) => quote !== null)) cumulativeQuotes.set(fee, quotes);
    }),
  );

  const allocations = new Map<FeeTier, number>(feeTiers.map((fee) => [fee, 0]));

  for (let step = 0; step < chunks; step += 1) {
    let bestFee: FeeTier | undefined;
    let bestMarginalOut = -1n;

    for (const fee of feeTiers) {
      const currentChunks = allocations.get(fee) ?? 0;
      const quotes = cumulativeQuotes.get(fee);
      const nextQuote = quotes?.[currentChunks];
      if (!nextQuote) continue;

      const previousQuote = currentChunks === 0 ? undefined : quotes?.[currentChunks - 1];
      if (currentChunks > 0 && !previousQuote) continue;

      const previousOut = previousQuote?.amountOut ?? 0n;
      const marginalOut = nextQuote.amountOut - previousOut;
      if (marginalOut > bestMarginalOut) {
        bestMarginalOut = marginalOut;
        bestFee = fee;
      }
    }

    if (bestFee === undefined) throw new Error("No viable Uniswap V3 USDC/WETH route found");
    allocations.set(bestFee, (allocations.get(bestFee) ?? 0) + 1);
  }

  const remainderByFee = new Map<FeeTier, bigint>();

  if (remainder > 0n) {
    let bestFee: FeeTier | undefined;
    let bestMarginalOut = -1n;

    await Promise.all(
      feeTiers.map(async (fee) => {
        const currentAmount = chunkSize * BigInt(allocations.get(fee) ?? 0);
        const [before, after] = await Promise.all([
          quoteExactInputSingle(fee, currentAmount),
          quoteExactInputSingle(fee, currentAmount + remainder),
        ]);
        const marginalOut = (after?.amountOut ?? 0n) - (before?.amountOut ?? 0n);
        if (marginalOut > bestMarginalOut) {
          bestMarginalOut = marginalOut;
          bestFee = fee;
        }
      }),
    );

    if (bestFee === undefined) throw new Error("No viable pool for remainder allocation");
    remainderByFee.set(bestFee, remainder);
  }

  const legQuotes = await Promise.all(
    [...allocations.entries()]
      .map(([fee, allocatedChunks]) => {
        const amount = chunkSize * BigInt(allocatedChunks) + (remainderByFee.get(fee) ?? 0n);
        return { fee, amount };
      })
      .filter(({ amount }) => amount > 0n)
      .map(async ({ fee, amount }) => {
        const quote = await quoteExactInputSingle(fee, amount);
        if (!quote) throw new Error(`No final quote for fee tier ${fee}`);
        return quote;
      }),
  );

  return legQuotes
    .sort((a, b) => b.amountOut > a.amountOut ? 1 : -1)
    .map((quote) => ({
      ...quote,
      amountOutMinimum: 0n,
    }));
}

async function quoteSpotReference(amountIn: bigint, feeTiers: FeeTier[]): Promise<Quote> {
  const oneUsdc = parseUnits("1", USDC_DECIMALS);
  const preferredSample =
    amountIn >= parseUnits("1000", USDC_DECIMALS)
      ? parseUnits("1000", USDC_DECIMALS)
      : amountIn / 100n > oneUsdc
        ? amountIn / 100n
        : oneUsdc;
  const sampleAmount = preferredSample > amountIn ? amountIn : preferredSample;

  const quotes = (await Promise.all(feeTiers.map((fee) => quoteExactInputSingle(fee, sampleAmount)))).filter(
    (quote): quote is Quote => quote !== null,
  );
  if (quotes.length === 0) throw new Error("Could not get a spot reference quote from any configured fee tier");

  return quotes.reduce((best, quote) => (quote.amountOut > best.amountOut ? quote : best));
}

async function ensureAllowance(account: Address, amountIn: bigint, approveMax: boolean) {
  const currentAllowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, UNISWAP_SWAP_ROUTER_02],
  });

  if (currentAllowance >= amountIn) {
    console.log(`USDC allowance OK: ${formatUsdc(currentAllowance)}`);
    return;
  }

  const walletClient = createWalletClient({
    chain: base,
    account: privateKeyToAccount(parsePrivateKey(env("PRIVATE_KEY"))),
    transport: http(env("BASE_RPC_URL")),
  });

  if (currentAllowance > 0n) {
    console.log("Resetting existing USDC allowance to 0...");
    const resetHash = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [UNISWAP_SWAP_ROUTER_02, 0n],
    });
    await publicClient.waitForTransactionReceipt({ hash: resetHash });
  }

  const approvalAmount = approveMax ? MAX_UINT256 : amountIn;
  console.log(`Approving ${approveMax ? "max USDC" : formatUsdc(approvalAmount)} for SwapRouter02...`);
  const approveHash = await walletClient.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [UNISWAP_SWAP_ROUTER_02, approvalAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
}

async function main() {
  const privateKey = parsePrivateKey(env("PRIVATE_KEY"));
  const account = privateKeyToAccount(privateKey);
  const recipient = parseRecipient(account.address);
  const amountIn = parseUnits(env("USDC_AMOUNT"), USDC_DECIMALS);
  if (amountIn <= 0n) throw new Error("USDC_AMOUNT must be greater than zero");
  const slippageBps = parseBps("SLIPPAGE_BPS", 30);
  const maxPriceImpactBps = parseBps("MAX_PRICE_IMPACT_BPS", 100);
  const splitChunks = parsePositiveInteger("SPLIT_CHUNKS", 24, 80);
  const ttlSeconds = parsePositiveInteger("DEADLINE_SECONDS", 300, 3600);
  const feeTiers = parseFeeTiers();
  const execute = parseBoolean("EXECUTE", false);
  const approveMax = parseBoolean("APPROVE_MAX", false);

  const chainId = await publicClient.getChainId();
  if (chainId !== BASE_CHAIN_ID) throw new Error(`RPC is on chain ${chainId}, expected Base mainnet ${BASE_CHAIN_ID}`);

  const walletClient = createWalletClient({
    chain: base,
    account,
    transport: http(env("BASE_RPC_URL")),
  });

  const [nativeBalance, usdcBalance] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);

  if (usdcBalance < amountIn) {
    throw new Error(`Insufficient USDC: have ${formatUsdc(usdcBalance)}, need ${formatUsdc(amountIn)}`);
  }
  if (nativeBalance === 0n) throw new Error("Account has no Base ETH for gas");

  console.log(`Account:   ${account.address}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Amount in: ${formatUsdc(amountIn)}`);
  console.log(`Fees:      ${feeTiers.join(", ")} Uniswap V3 fee units`);
  console.log(`Mode:      ${execute ? "EXECUTE" : "DRY RUN"}`);

  const rawLegs = await buildSplitPlan(amountIn, feeTiers, splitChunks);
  const totalQuoteOut = rawLegs.reduce((sum, leg) => sum + leg.amountOut, 0n);
  const legs: SwapLeg[] = rawLegs.map((leg) => ({
    ...leg,
    amountOutMinimum: minAmount(leg.amountOut, slippageBps),
  }));
  const totalMinOut = legs.reduce((sum, leg) => sum + leg.amountOutMinimum, 0n);

  const spot = await quoteSpotReference(amountIn, feeTiers);
  const spotScaledOut = (spot.amountOut * amountIn) / spot.amountIn;
  const priceImpactBps =
    spotScaledOut > totalQuoteOut ? Number(((spotScaledOut - totalQuoteOut) * 10_000n) / spotScaledOut) : 0;

  console.log("\nQuote plan:");
  for (const leg of legs) {
    console.log(
      `- fee ${leg.fee}: ${formatUsdc(leg.amountIn)} -> ${formatWeth(leg.amountOut)} ` +
        `(min ${formatWeth(leg.amountOutMinimum)})`,
    );
  }
  console.log(`Total quoted out: ${formatWeth(totalQuoteOut)}`);
  console.log(`Total min out:    ${formatWeth(totalMinOut)} (${slippageBps} bps slippage)`);
  console.log(`Spot reference:   fee ${spot.fee}, ${formatUsdc(spot.amountIn)} -> ${formatWeth(spot.amountOut)}`);
  console.log(`Est. impact:      ${priceImpactBps} bps`);

  if (priceImpactBps > maxPriceImpactBps) {
    throw new Error(`Price impact ${priceImpactBps} bps exceeds MAX_PRICE_IMPACT_BPS=${maxPriceImpactBps}`);
  }

  if (!execute) {
    console.log("\nDry run only. Set EXECUTE=true to approve and submit the swap.");
    return;
  }

  await ensureAllowance(account.address, amountIn, approveMax);

  const deadline = deadlineSeconds(ttlSeconds);
  const swapParams = legs.map((leg) => ({
    tokenIn: USDC,
    tokenOut: WETH,
    fee: leg.fee,
    recipient,
    amountIn: leg.amountIn,
    amountOutMinimum: leg.amountOutMinimum,
    sqrtPriceLimitX96: 0n,
  }));

  console.log("\nSimulating final swap transaction...");

  const hash =
    swapParams.length === 1
      ? await (async () => {
          const { request } = await publicClient.simulateContract({
            account,
            address: UNISWAP_SWAP_ROUTER_02,
            abi: swapRouter02Abi,
            functionName: "exactInputSingle",
            args: [swapParams[0]],
            value: 0n,
          });
          console.log("Submitting swap...");
          return walletClient.writeContract(request);
        })()
      : await (async () => {
          const calls = swapParams.map((params) =>
            encodeFunctionData({
              abi: swapRouter02Abi,
              functionName: "exactInputSingle",
              args: [params],
            }),
          );
          const { request } = await publicClient.simulateContract({
            account,
            address: UNISWAP_SWAP_ROUTER_02,
            abi: swapRouter02Abi,
            functionName: "multicall",
            args: [deadline, calls],
            value: 0n,
          });
          console.log("Submitting swap...");
          return walletClient.writeContract(request);
        })();

  console.log(`Tx hash: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber} with status ${receipt.status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
