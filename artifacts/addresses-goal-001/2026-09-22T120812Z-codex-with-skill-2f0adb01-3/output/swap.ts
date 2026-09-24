import "dotenv/config";
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeFunctionResult,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  http,
  maxUint256,
  parseAbi,
  parseUnits,
  createPublicClient,
  createWalletClient,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const ADDRESSES = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  WETH: "0x4200000000000000000000000000000000000006",
  UNISWAP_V3_QUOTER_V2: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
  UNISWAP_SWAP_ROUTER_02: "0x2626664c2603336E57B271c5C0b26F421741e481",
} as const satisfies Record<string, Address>;

const FEE_TIERS = [100, 500, 3000, 10000] as const;
const BPS_DENOMINATOR = 10_000n;
const RPC_SPACING_MS = Number(process.env.RPC_SPACING_MS ?? "250");
let lastRpcAt = 0;

const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

type Quote = {
  fee: (typeof FEE_TIERS)[number];
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  initializedTicksCrossed: number;
  gasEstimate: bigint;
};

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function optionalAddress(name: string): Address | undefined {
  const value = process.env[name];
  return value ? getAddress(value) : undefined;
}

function parseBps(name: string, fallback: number): number {
  const raw = env(name, String(fallback));
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`${name} must be an integer between 0 and 10000`);
  }
  return value;
}

function asPrivateKey(value: string): `0x${string}` {
  return value.startsWith("0x") ? (value as `0x${string}`) : `0x${value}`;
}

function requireAmount(): bigint {
  const raw = env("AMOUNT_USDC");
  if (!/^\d+(\.\d{1,6})?$/.test(raw)) {
    throw new Error("AMOUNT_USDC must be a positive decimal with up to 6 decimals");
  }
  const parsed = parseUnits(raw, 6);
  if (parsed <= 0n) throw new Error("AMOUNT_USDC must be greater than zero");
  return parsed;
}

function minOutFromSlippage(amountOut: bigint, slippageBps: number): bigint {
  return (amountOut * (BPS_DENOMINATOR - BigInt(slippageBps))) / BPS_DENOMINATOR;
}

function formatBps(bps: bigint | number): string {
  const value = typeof bps === "bigint" ? Number(bps) : bps;
  return `${(value / 100).toFixed(2)}%`;
}

function unwrapError(error: unknown): string {
  if (error instanceof BaseError) {
    const revert = error.walk((err) => err instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) return revert.shortMessage;
    return [error.shortMessage, error.details].filter(Boolean).join(": ");
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paceRpc() {
  if (RPC_SPACING_MS <= 0) return;
  const elapsed = Date.now() - lastRpcAt;
  if (elapsed < RPC_SPACING_MS) await sleep(RPC_SPACING_MS - elapsed);
  lastRpcAt = Date.now();
}

async function rpc<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await paceRpc();
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < 5) await sleep(750 * attempt);
    }
  }
  throw new Error(`${label} failed: ${unwrapError(lastError)}`);
}

async function main() {
  const rpcUrl = env("BASE_RPC_URL", "https://mainnet.base.org");
  const account = privateKeyToAccount(asPrivateKey(env("PRIVATE_KEY")));
  const recipient = optionalAddress("RECIPIENT") ?? account.address;
  const amountIn = requireAmount();
  const slippageBps = parseBps("SLIPPAGE_BPS", 30);
  const maxPriceImpactBps = parseBps("MAX_PRICE_IMPACT_BPS", 100);
  const deadlineSeconds = Number(env("DEADLINE_SECONDS", "180"));
  const execute = process.env.EXECUTE === "1";
  const forceFeeTier = process.env.FEE_TIER ? Number(process.env.FEE_TIER) : undefined;

  if (forceFeeTier !== undefined && !FEE_TIERS.includes(forceFeeTier as never)) {
    throw new Error(`FEE_TIER must be one of ${FEE_TIERS.join(", ")}`);
  }
  if (!Number.isInteger(deadlineSeconds) || deadlineSeconds <= 0 || deadlineSeconds > 3600) {
    throw new Error("DEADLINE_SECONDS must be an integer between 1 and 3600");
  }

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { retryCount: 5, retryDelay: 750 }),
  });
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl, { retryCount: 5, retryDelay: 750 }),
  });

  const chainId = await rpc("chain id", () => publicClient.getChainId());
  if (chainId !== base.id) throw new Error(`RPC is on chain ${chainId}, expected Base mainnet ${base.id}`);

  const usdcSymbol = await rpc("USDC symbol", () =>
    publicClient.readContract({ address: ADDRESSES.USDC, abi: erc20Abi, functionName: "symbol" }),
  );
  const wethSymbol = await rpc("WETH symbol", () =>
    publicClient.readContract({ address: ADDRESSES.WETH, abi: erc20Abi, functionName: "symbol" }),
  );
  const usdcDecimals = await rpc("USDC decimals", () =>
    publicClient.readContract({ address: ADDRESSES.USDC, abi: erc20Abi, functionName: "decimals" }),
  );
  const wethDecimals = await rpc("WETH decimals", () =>
    publicClient.readContract({ address: ADDRESSES.WETH, abi: erc20Abi, functionName: "decimals" }),
  );
  const ethBalance = await rpc("ETH balance", () => publicClient.getBalance({ address: account.address }));
  const usdcBalance = await rpc("USDC balance", () =>
    publicClient.readContract({
      address: ADDRESSES.USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }),
  );
  const wethBefore = await rpc("WETH starting balance", () =>
    publicClient.readContract({
      address: ADDRESSES.WETH,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [recipient],
    }),
  );

  if (usdcDecimals !== 6) throw new Error(`Unexpected USDC decimals: ${usdcDecimals}`);
  if (wethDecimals !== 18) throw new Error(`Unexpected WETH decimals: ${wethDecimals}`);
  if (usdcBalance < amountIn) {
    throw new Error(
      `Insufficient ${usdcSymbol}: have ${formatUnits(usdcBalance, usdcDecimals)}, need ${formatUnits(amountIn, usdcDecimals)}`,
    );
  }

  console.log(`Base account: ${account.address}`);
  console.log(`Recipient:    ${recipient}`);
  console.log(`ETH gas bal:  ${formatEther(ethBalance)} ETH`);
  console.log(`Swap amount:  ${formatUnits(amountIn, usdcDecimals)} ${usdcSymbol}`);
  console.log(`Mode:         ${execute ? "EXECUTE" : "DRY RUN"}\n`);

  const tiersToQuote = forceFeeTier ? [forceFeeTier as (typeof FEE_TIERS)[number]] : [...FEE_TIERS];

  async function chooseBestQuote(): Promise<{ bestQuote: Quote; priceImpactBps: bigint }> {
    const quotes: Quote[] = [];
    for (const fee of tiersToQuote) {
      try {
        const { result } = await rpc(`quote ${fee} bps pool`, () =>
          publicClient.simulateContract({
            address: ADDRESSES.UNISWAP_V3_QUOTER_V2,
            abi: quoterAbi,
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
          }),
        );
        const quote = {
          fee,
          amountOut: result[0],
          sqrtPriceX96After: result[1],
          initializedTicksCrossed: result[2],
          gasEstimate: result[3],
        };
        quotes.push(quote);
        console.log(
          `Quoted ${fee} bps pool: ${formatUnits(quote.amountOut, wethDecimals)} ${wethSymbol} ` +
            `(ticks crossed ${quote.initializedTicksCrossed}, quoter gas ${quote.gasEstimate})`,
        );
      } catch (error) {
        console.log(`Quoted ${fee} bps pool: unavailable (${unwrapError(error)})`);
      }
    }

    const bestQuote = quotes.sort((a, b) => (a.amountOut > b.amountOut ? -1 : 1))[0];
    if (!bestQuote) throw new Error("No executable Uniswap V3 USDC/WETH pool quote found");

    const probeIn = amountIn > parseUnits("1000", usdcDecimals) ? parseUnits("1000", usdcDecimals) : amountIn;
    let priceImpactBps = 0n;
    if (probeIn < amountIn) {
      const { result: probeResult } = await rpc("probe quote", () =>
        publicClient.simulateContract({
          address: ADDRESSES.UNISWAP_V3_QUOTER_V2,
          abi: quoterAbi,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: ADDRESSES.USDC,
              tokenOut: ADDRESSES.WETH,
              amountIn: probeIn,
              fee: bestQuote.fee,
              sqrtPriceLimitX96: 0n,
            },
          ],
        }),
      );
      const probeOut = probeResult[0];
      const executionQualityBps = (bestQuote.amountOut * probeIn * BPS_DENOMINATOR) / (probeOut * amountIn);
      priceImpactBps = executionQualityBps >= BPS_DENOMINATOR ? 0n : BPS_DENOMINATOR - executionQualityBps;
    }

    if (priceImpactBps > BigInt(maxPriceImpactBps)) {
      throw new Error(
        `Estimated price impact ${formatBps(priceImpactBps)} exceeds MAX_PRICE_IMPACT_BPS=${maxPriceImpactBps}`,
      );
    }

    return { bestQuote, priceImpactBps };
  }

  let { bestQuote, priceImpactBps } = await chooseBestQuote();
  let amountOutMinimum = minOutFromSlippage(bestQuote.amountOut, slippageBps);

  console.log(`\nSelected fee: ${bestQuote.fee} bps`);
  console.log(`Expected out: ${formatUnits(bestQuote.amountOut, wethDecimals)} ${wethSymbol}`);
  console.log(`Min out:      ${formatUnits(amountOutMinimum, wethDecimals)} ${wethSymbol} (${formatBps(slippageBps)} slippage)`);
  console.log(`Impact guard: ${formatBps(priceImpactBps)} estimated, max ${formatBps(maxPriceImpactBps)}\n`);

  const allowance = await rpc("USDC allowance", () =>
    publicClient.readContract({
      address: ADDRESSES.USDC,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, ADDRESSES.UNISWAP_SWAP_ROUTER_02],
    }),
  );

  if (allowance < amountIn) {
    console.log(
      `Allowance:    ${formatUnits(allowance, usdcDecimals)} ${usdcSymbol}; ` +
        `needs ${formatUnits(amountIn, usdcDecimals)} ${usdcSymbol}`,
    );
    if (!execute) {
      console.log("Dry run stops before swap simulation because approval is currently insufficient.");
      console.log("Set EXECUTE=1 to approve the router and submit the swap.");
      return;
    }

    const approvalAmount = process.env.APPROVE_MAX === "1" ? maxUint256 : amountIn;
    const { request: approveRequest } = await rpc("approve simulation", () =>
      publicClient.simulateContract({
        address: ADDRESSES.USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [ADDRESSES.UNISWAP_SWAP_ROUTER_02, approvalAmount],
        account,
      }),
    );
    const approveHash = await walletClient.writeContract(approveRequest);
    console.log(`Approve tx:   ${approveHash}`);
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    if (approveReceipt.status !== "success") throw new Error(`Approval failed: ${approveHash}`);
    console.log("Approval confirmed; refreshing quote before swap.");
    ({ bestQuote, priceImpactBps } = await chooseBestQuote());
    amountOutMinimum = minOutFromSlippage(bestQuote.amountOut, slippageBps);
    console.log(`\nSelected fee: ${bestQuote.fee} bps`);
    console.log(`Expected out: ${formatUnits(bestQuote.amountOut, wethDecimals)} ${wethSymbol}`);
    console.log(`Min out:      ${formatUnits(amountOutMinimum, wethDecimals)} ${wethSymbol} (${formatBps(slippageBps)} slippage)`);
    console.log(`Impact guard: ${formatBps(priceImpactBps)} estimated, max ${formatBps(maxPriceImpactBps)}\n`);
  } else {
    console.log(`Allowance:    ${formatUnits(allowance, usdcDecimals)} ${usdcSymbol}`);
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);
  const exactInputSingleData = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: ADDRESSES.USDC,
        tokenOut: ADDRESSES.WETH,
        fee: bestQuote.fee,
        recipient,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  console.log(`Deadline:     ${deadlineSeconds}s`);

  const { request: swapRequest, result: simulatedResults } = await rpc("swap simulation", () =>
    publicClient.simulateContract({
      address: ADDRESSES.UNISWAP_SWAP_ROUTER_02,
      abi: swapRouterAbi,
      functionName: "multicall",
      args: [deadline, [exactInputSingleData]],
      account,
      value: 0n,
    }),
  );
  const simulatedAmountOut = decodeFunctionResult({
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    data: simulatedResults[0],
  });
  console.log(`Simulated:    ${formatUnits(simulatedAmountOut, wethDecimals)} ${wethSymbol}`);

  if (!execute) {
    console.log("Dry run complete. Set EXECUTE=1 to send the approval/swap transactions.");
    return;
  }

  const swapHash = await walletClient.writeContract(swapRequest);
  console.log(`Swap tx:      ${swapHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
  if (receipt.status !== "success") throw new Error(`Swap failed: ${swapHash}`);

  const wethAfter = await rpc("WETH ending balance", () =>
    publicClient.readContract({
      address: ADDRESSES.WETH,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [recipient],
    }),
  );
  console.log(`Received:     ${formatUnits(wethAfter - wethBefore, wethDecimals)} ${wethSymbol}`);
  console.log(`Confirmed in block ${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(`\n${unwrapError(error)}`);
  process.exitCode = 1;
});
