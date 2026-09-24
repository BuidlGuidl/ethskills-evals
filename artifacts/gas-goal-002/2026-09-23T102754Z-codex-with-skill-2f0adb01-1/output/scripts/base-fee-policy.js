#!/usr/bin/env node

const DEFAULT_RPC_URL = "https://mainnet.base.org";
const DEFAULT_PRIORITY_FEE_WEI = 1_000_000n; // 0.001 gwei
const MAX_PRIORITY_FEE_WEI = BigInt(process.env.MAX_PRIORITY_FEE_WEI || 2_000_000n);
const MAX_FEE_CEILING_WEI = BigInt(process.env.MAX_FEE_CEILING_WEI || 50_000_000n); // 0.05 gwei

function hexToBigInt(value) {
  return BigInt(value || "0x0");
}

function toQuantity(value) {
  return `0x${value.toString(16)}`;
}

function weiToGwei(wei) {
  return Number(wei) / 1e9;
}

function median(values) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)];
}

async function rpc(method, params = [], rpcUrl = process.env.BASE_RPC_URL || DEFAULT_RPC_URL) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!response.ok) {
    throw new Error(`${method} failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`${method} failed: ${payload.error.message}`);
  }

  return payload.result;
}

export async function getBaseFeePolicy(options = {}) {
  const rpcUrl = options.rpcUrl || process.env.BASE_RPC_URL || DEFAULT_RPC_URL;
  const feeHistory = await rpc("eth_feeHistory", ["0x14", "latest", [50]], rpcUrl);
  const latestBaseFee = hexToBigInt(feeHistory.baseFeePerGas.at(-1));
  const sampledPriorityFees = feeHistory.reward
    .flat()
    .map(hexToBigInt)
    .filter((value) => value > 0n);
  const observedPriorityFee = median(sampledPriorityFees) || DEFAULT_PRIORITY_FEE_WEI;
  const maxPriorityFeePerGas = observedPriorityFee > MAX_PRIORITY_FEE_WEI
    ? MAX_PRIORITY_FEE_WEI
    : observedPriorityFee;
  const targetMaxFee = latestBaseFee * 2n + maxPriorityFeePerGas;
  const maxFeePerGas = targetMaxFee > MAX_FEE_CEILING_WEI
    ? MAX_FEE_CEILING_WEI
    : targetMaxFee;

  if (targetMaxFee > MAX_FEE_CEILING_WEI) {
    throw new Error(
      `Base fee spike: target maxFeePerGas ${weiToGwei(targetMaxFee).toFixed(6)} gwei exceeds ceiling ` +
      `${weiToGwei(MAX_FEE_CEILING_WEI).toFixed(6)} gwei`,
    );
  }

  return {
    maxFeePerGas: toQuantity(maxFeePerGas),
    maxPriorityFeePerGas: toQuantity(maxPriorityFeePerGas),
    latestBaseFeeWei: latestBaseFee.toString(),
    latestBaseFeeGwei: weiToGwei(latestBaseFee),
    maxFeePerGasWei: maxFeePerGas.toString(),
    maxFeePerGasGwei: weiToGwei(maxFeePerGas),
    maxPriorityFeePerGasWei: maxPriorityFeePerGas.toString(),
    maxPriorityFeePerGasGwei: weiToGwei(maxPriorityFeePerGas),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  getBaseFeePolicy()
    .then((policy) => console.log(JSON.stringify(policy, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
