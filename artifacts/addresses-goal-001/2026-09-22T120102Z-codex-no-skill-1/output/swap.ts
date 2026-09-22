import {
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
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

const BASE_CHAIN_ID = 8453;

const ADDRESSES = {
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  weth: "0x4200000000000000000000000000000000000006",
  uniswapV3SwapRouter02: "0x2626664c2603336E57B271c5C0b26F421741e481",
  uniswapV3QuoterV2: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
} as const satisfies Record<string, Address>;

const USDC_DECIMALS = 6;
const WETH_DECIMALS = 18;
const BPS_DENOMINATOR = 10_000n;

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const swapRouter02Abi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

type Quote = {
  fee: number;
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  initializedTicksCrossed: number;
  gasEstimate: bigint;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function normalizePrivateKey(value: string): Hex {
  const privateKey = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex string");
  }
  return privateKey as Hex;
}

function envBool(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function envInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return defaultValue;
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function parsePoolFees(): number[] {
  const raw = process.env.POOL_FEES ?? "100,500,3000,10000";
  const fees = raw
    .split(",")
    .map((fee) => Number(fee.trim()))
    .filter((fee) => Number.isSafeInteger(fee) && fee > 0 && fee <= 1_000_000);

  if (fees.length === 0) {
    throw new Error("POOL_FEES must contain at least one uint24 Uniswap V3 fee");
  }

  return [...new Set(fees)];
}

function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  return (amountOut * (BPS_DENOMINATOR - BigInt(slippageBps))) / BPS_DENOMINATOR;
}

function feeToPercent(fee: number): string {
  return `${fee / 10_000}%`;
}

function formatUsdc(amount: bigint): string {
  return `${formatUnits(amount, USDC_DECIMALS)} USDC`;
}

function formatWeth(amount: bigint): string {
  return `${formatUnits(amount, WETH_DECIMALS)} WETH`;
}

function explainContractError(error: unknown): string {
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
}

async function main() {
  const rpcUrl = process.env.RPC_URL ?? "https://mainnet.base.org";
  const execute = envBool("EXECUTE", false);
  const amountIn = parseUnits(requiredEnv("AMOUNT_USDC"), USDC_DECIMALS);
  const maxSlippageBps = envInt("MAX_SLIPPAGE_BPS", 50);
  const deadlineSeconds = envInt("DEADLINE_SECONDS", 180);
  const poolFees = parsePoolFees();

  if (maxSlippageBps >= Number(BPS_DENOMINATOR)) {
    throw new Error("MAX_SLIPPAGE_BPS must be less than 10000");
  }
  if (amountIn <= 0n) {
    throw new Error("AMOUNT_USDC must be greater than zero");
  }

  const account = privateKeyToAccount(normalizePrivateKey(requiredEnv("PRIVATE_KEY")));
  const recipient = process.env.RECIPIENT
    ? getAddress(process.env.RECIPIENT)
    : account.address;

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== BASE_CHAIN_ID) {
    throw new Error(`RPC_URL is connected to chain ${chainId}, expected Base mainnet ${BASE_CHAIN_ID}`);
  }

  const [usdcBalance, currentAllowance] = await Promise.all([
    publicClient.readContract({
      address: ADDRESSES.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.readContract({
      address: ADDRESSES.usdc,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, ADDRESSES.uniswapV3SwapRouter02],
    }),
  ]);

  if (usdcBalance < amountIn) {
    throw new Error(`Insufficient USDC: have ${formatUsdc(usdcBalance)}, need ${formatUsdc(amountIn)}`);
  }

  const quoteAttempts = await Promise.all(
    poolFees.map(async (fee): Promise<Quote | null> => {
      const callData = encodeFunctionData({
        abi: quoterV2Abi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: ADDRESSES.usdc,
            tokenOut: ADDRESSES.weth,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      try {
        const { data } = await publicClient.call({
          to: ADDRESSES.uniswapV3QuoterV2,
          data: callData,
          account: account.address,
        });
        if (!data) {
          throw new Error("empty response");
        }

        const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] =
          decodeFunctionResult({
            abi: quoterV2Abi,
            functionName: "quoteExactInputSingle",
            data,
          });

        return {
          fee,
          amountOut,
          sqrtPriceX96After,
          initializedTicksCrossed,
          gasEstimate,
        };
      } catch (error) {
        console.warn(`Quote failed for ${feeToPercent(fee)} fee tier: ${explainContractError(error)}`);
        return null;
      }
    }),
  );

  const quotes = quoteAttempts
    .filter((quote): quote is Quote => quote !== null)
    .sort((a, b) => (a.amountOut === b.amountOut ? 0 : a.amountOut > b.amountOut ? -1 : 1));

  if (quotes.length === 0) {
    throw new Error("No quoted USDC/WETH Uniswap V3 fee tier was available");
  }

  const bestQuote = quotes[0];
  const amountOutMinimum = applySlippage(bestQuote.amountOut, maxSlippageBps);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  console.log(`Account:   ${account.address}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Input:     ${formatUsdc(amountIn)}`);
  console.log(`Best pool: Uniswap V3 ${feeToPercent(bestQuote.fee)} fee tier`);
  console.log(`Quote:     ${formatWeth(bestQuote.amountOut)}`);
  console.log(`Min out:   ${formatWeth(amountOutMinimum)} (${maxSlippageBps} bps max slippage)`);
  console.log(`Allowance: ${formatUsdc(currentAllowance)}`);

  for (const quote of quotes) {
    console.log(
      `  fee ${feeToPercent(quote.fee)} -> ${formatWeth(quote.amountOut)}; ticks crossed ${quote.initializedTicksCrossed}; quote gas ${quote.gasEstimate}`,
    );
  }

  if (!execute) {
    console.log("Dry run only. Set EXECUTE=true to approve and broadcast the swap.");
    if (currentAllowance < amountIn) {
      console.log("Swap simulation skipped because current router allowance is below the input amount.");
    }
  }

  if (execute && currentAllowance < amountIn) {
    console.log(`Approving ${formatUsdc(amountIn)} to SwapRouter02...`);
    const approveHash = await walletClient.writeContract({
      address: ADDRESSES.usdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [ADDRESSES.uniswapV3SwapRouter02, amountIn],
    });
    console.log(`Approval tx: ${approveHash}`);
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    if (approveReceipt.status !== "success") {
      throw new Error(`Approval reverted: ${approveHash}`);
    }
  }

  if (!execute && currentAllowance < amountIn) {
    return;
  }

  const exactInputSingleCall = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: ADDRESSES.usdc,
        tokenOut: ADDRESSES.weth,
        fee: bestQuote.fee,
        recipient,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const simulation = await publicClient.simulateContract({
    address: ADDRESSES.uniswapV3SwapRouter02,
    abi: swapRouter02Abi,
    functionName: "multicall",
    args: [deadline, [exactInputSingleCall]],
    account,
  });

  const [encodedAmountOut] = simulation.result;
  const simulatedAmountOut = decodeFunctionResult({
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    data: encodedAmountOut,
  });

  console.log(`Simulation out: ${formatWeth(simulatedAmountOut)}`);

  if (!execute) {
    return;
  }

  console.log("Broadcasting swap...");
  const swapHash = await walletClient.writeContract(simulation.request);
  console.log(`Swap tx: ${swapHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
  console.log(`Status: ${receipt.status}`);
  console.log(`Gas used: ${receipt.gasUsed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
