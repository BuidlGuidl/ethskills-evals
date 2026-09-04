/**
 * Small, provider-agnostic fee policy for Base (chain id 8453).
 *
 * Call this immediately before signing.  Values are wei and deliberately use
 * BigInt: using JS Number for wei silently loses precision.
 */
export const BASE_RPC_URL = "https://mainnet.base.org";

export async function rpc(url, method, params = []) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

const fromHex = value => BigInt(value);

/** Return EIP-1559 fields based on the pending Base block, not a constant. */
export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
  const [block, suggestedPriority] = await Promise.all([
    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
  ]);
  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");

  const maxPriorityFeePerGas = fromHex(suggestedPriority);
  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
}

/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
  return (estimate * numerator + denominator - 1n) / denominator;
}

/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
export function receiptCostWei(receipt) {
  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
}
