import "dotenv/config";

import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  maxUint256,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const BASE_CHAIN_ID = 8453;

const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH: Address = "0x4200000000000000000000000000000000000006";
const ONEINCH_AGGREGATION_ROUTER_V6: Address =
  "0x111111125421cA6dc452d289314280a0f8842A65";

const USDC_DECIMALS = 6;
const WETH_DECIMALS = 18;
const ONEINCH_BASE_URL = `https://api.1inch.com/swap/v6.1/${BASE_CHAIN_ID}`;

type OneInchTx = {
  from?: Address;
  to: Address;
  data: Hex;
  value: string;
  gas?: string | number;
  gasPrice?: string;
};

type OneInchQuoteResponse = {
  dstAmount: string;
  protocols?: unknown;
  gas?: string | number;
};

type OneInchSwapResponse = {
  dstAmount: string;
  tx: OneInchTx;
  protocols?: unknown;
  gas?: string | number;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function envFlag(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parsePrivateKey(value: string): Hex {
  const prefixed = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex private key");
  }
  return prefixed as Hex;
}

function parseBps(value: string | undefined, fallback: bigint, max: bigint, name: string): bigint {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be an integer number of basis points`);
  }
  const bps = BigInt(value);
  if (bps > max) {
    throw new Error(`Refusing ${name} above ${max} bps`);
  }
  return bps;
}

function bigintMax(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

function applySlippage(amount: bigint, slippageBps: bigint): bigint {
  return (amount * (10_000n - slippageBps)) / 10_000n;
}

function sameAddress(a: Address | string, b: Address | string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

async function oneInchGet<T>(
  path: "quote" | "swap",
  apiKey: string,
  params: Record<string, string | number | boolean>,
): Promise<T> {
  const url = new URL(`${ONEINCH_BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`1inch ${path} failed (${response.status}): ${body}`);
  }

  return JSON.parse(body) as T;
}

async function main() {
  const privateKey = parsePrivateKey(requiredEnv("PRIVATE_KEY"));
  const rpcUrl = process.env.BASE_RPC_URL ?? process.env.RPC_URL ?? "https://mainnet.base.org";
  const apiKey = process.env.ONEINCH_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: ONEINCH_API_KEY");
  }
  const amountIn = parseUnits(requiredEnv("USDC_AMOUNT"), USDC_DECIMALS);
  const slippageBps = parseBps(process.env.SLIPPAGE_BPS, 30n, 1_000n, "SLIPPAGE_BPS");
  const executeSwap = envFlag("EXECUTE_SWAP");
  const approveMax = envFlag("APPROVE_MAX");
  const gasBufferBps = parseBps(process.env.GAS_BUFFER_BPS, 2_000n, 10_000n, "GAS_BUFFER_BPS");
  const account = privateKeyToAccount(privateKey);
  const receiver = (process.env.RECEIVER ?? account.address) as Address;

  if (!isAddress(receiver)) {
    throw new Error("RECEIVER must be an EVM address when provided");
  }

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
    throw new Error(`RPC is connected to chain ${chainId}, expected Base mainnet ${BASE_CHAIN_ID}`);
  }

  const [usdcCode, wethCode, routerCode, usdcBalance, allowance] = await Promise.all([
    publicClient.getCode({ address: USDC }),
    publicClient.getCode({ address: WETH }),
    publicClient.getCode({ address: ONEINCH_AGGREGATION_ROUTER_V6 }),
    publicClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, ONEINCH_AGGREGATION_ROUTER_V6],
    }),
  ]);

  if (!usdcCode || !wethCode || !routerCode) {
    throw new Error("USDC, WETH, or 1inch router bytecode is missing on the configured RPC");
  }
  if (usdcBalance < amountIn) {
    throw new Error(
      `Insufficient USDC: balance ${formatUnits(usdcBalance, USDC_DECIMALS)}, need ${formatUnits(
        amountIn,
        USDC_DECIMALS,
      )}`,
    );
  }

  console.log(`Wallet: ${account.address}`);
  console.log(`Receiver: ${receiver}`);
  console.log(`Selling: ${formatUnits(amountIn, USDC_DECIMALS)} USDC on Base`);
  console.log(`Slippage guard: ${slippageBps} bps`);

  const needsApproval = allowance < amountIn;
  if (needsApproval) {
    const approvalAmount = approveMax ? maxUint256 : amountIn;
    console.log(
      `Approval required for ${approveMax ? "max uint256" : `${formatUnits(approvalAmount, USDC_DECIMALS)} USDC`}`,
    );

    const { request } = await publicClient.simulateContract({
      account,
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [ONEINCH_AGGREGATION_ROUTER_V6, approvalAmount],
    });

    if (executeSwap) {
      const approveHash = await walletClient.writeContract(request);
      console.log(`Approval tx: ${approveHash}`);
      const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
      if (approvalReceipt.status !== "success") {
        throw new Error(`Approval failed in tx ${approveHash}`);
      }
    } else {
      console.log("Dry run: approval simulation passed; not broadcasting approval.");
    }
  } else {
    console.log(`Existing router allowance: ${formatUnits(allowance, USDC_DECIMALS)} USDC`);
  }

  const quote = await oneInchGet<OneInchQuoteResponse>("quote", apiKey, {
    src: USDC,
    dst: WETH,
    amount: amountIn.toString(),
    includeTokensInfo: true,
    includeProtocols: true,
    includeGas: true,
  });

  const quotedOut = BigInt(quote.dstAmount);
  const minReturn = applySlippage(quotedOut, slippageBps);
  console.log(`1inch quote: ${formatUnits(quotedOut, WETH_DECIMALS)} WETH`);
  console.log(`Minimum return: ${formatUnits(minReturn, WETH_DECIMALS)} WETH`);

  const swap = await oneInchGet<OneInchSwapResponse>("swap", apiKey, {
    src: USDC,
    dst: WETH,
    amount: amountIn.toString(),
    from: account.address,
    origin: account.address,
    receiver,
    minReturn: minReturn.toString(),
    allowPartialFill: false,
    includeTokensInfo: true,
    includeProtocols: true,
    includeGas: true,
    ...(needsApproval && !executeSwap ? { disableEstimate: true, forceApprove: true } : {}),
  });

  if (!sameAddress(swap.tx.to, ONEINCH_AGGREGATION_ROUTER_V6)) {
    throw new Error(`Unexpected swap target ${swap.tx.to}; expected ${ONEINCH_AGGREGATION_ROUTER_V6}`);
  }
  if (BigInt(swap.dstAmount) < minReturn) {
    throw new Error("1inch swap response dstAmount is below the configured minReturn");
  }

  const txValue = BigInt(swap.tx.value ?? "0");
  if (txValue !== 0n) {
    throw new Error(`USDC -> WETH swap should not require native ETH value; got ${txValue}`);
  }

  console.log(`Router: ${ONEINCH_AGGREGATION_ROUTER_V6}`);

  let bufferedGas: bigint | undefined;
  if (needsApproval && !executeSwap) {
    console.log("Dry run: skipping swap eth_call/gas estimate because approval was not broadcast.");
  } else {
    await publicClient.call({
      account: account.address,
      to: swap.tx.to,
      data: swap.tx.data,
      value: txValue,
    });

    const estimatedGas = await publicClient.estimateGas({
      account: account.address,
      to: swap.tx.to,
      data: swap.tx.data,
      value: txValue,
    });
    bufferedGas = (bigintMax(estimatedGas, BigInt(swap.tx.gas ?? 0)) * (10_000n + gasBufferBps)) / 10_000n;
    console.log(`Estimated gas: ${estimatedGas}; sending gas limit: ${bufferedGas}`);
  }

  if (!executeSwap) {
    console.log("Dry run complete. Set EXECUTE_SWAP=true to broadcast approval and swap transactions.");
    return;
  }
  if (bufferedGas === undefined) {
    throw new Error("Missing gas estimate for executable swap");
  }

  const hash = await walletClient.sendTransaction({
    account,
    chain: base,
    to: swap.tx.to,
    data: swap.tx.data,
    value: txValue,
    gas: bufferedGas,
  });
  console.log(`Swap tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Receipt status: ${receipt.status}`);
  if (receipt.status !== "success") {
    throw new Error(`Swap failed in tx ${hash}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
