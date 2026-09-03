/**
 * EIP-1559 fee policy for Base relayers.
 *
 * Fee caps are refreshed immediately before each submission.  The default
 * priority fee is zero because the Base sequencer has no need for an
 * Ethereum-mainnet-style tip; make it non-zero only when your inclusion SLO
 * demonstrates that it is necessary.
 */
export const BASE_RPC_URL = "https://mainnet.base.org";

const toQuantity = value => `0x${BigInt(value).toString(16)}`;
const fromQuantity = value => BigInt(value);

export async function rpc(method, params = [], { rpcUrl = BASE_RPC_URL, fetchFn = fetch } = {}) {
  const response = await fetchFn(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`Base RPC ${method} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`Base RPC ${method}: ${payload.error.message}`);
  return payload.result;
}

/**
 * Return ethers/viem-compatible overrides. multiplierBps is headroom only:
 * it does not increase the charged price of an EIP-1559 transaction.
 */
export async function baseFeeOverrides({
  rpcUrl = BASE_RPC_URL,
  fetchFn = fetch,
  priorityFeePerGas = 0n,
  multiplierBps = 20_000n, // 2x latest base fee: survives one full block rise
} = {}) {
  if (multiplierBps < 10_000n) throw new RangeError("multiplierBps must be at least 10,000");
  if (priorityFeePerGas < 0n) throw new RangeError("priorityFeePerGas cannot be negative");

  const block = await rpc("eth_getBlockByNumber", ["latest", false], { rpcUrl, fetchFn });
  if (!block?.baseFeePerGas) throw new Error("Base RPC response did not include baseFeePerGas");
  const baseFeePerGas = fromQuantity(block.baseFeePerGas);
  const maxFeePerGas = (baseFeePerGas * multiplierBps) / 10_000n + priorityFeePerGas;

  return {
    type: "0x2",
    maxFeePerGas: toQuantity(maxFeePerGas),
    maxPriorityFeePerGas: toQuantity(priorityFeePerGas),
    // Expose the observed value for structured logs; do not submit this field.
    observedBaseFeePerGas: baseFeePerGas.toString(),
  };
}

/**
 * Extract the all-in fee from an OP Stack receipt. l1Fee is absent on some
 * RPC providers, so preserve that fact instead of silently treating it as 0.
 */
export function receiptCost(receipt) {
  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) {
    throw new TypeError("receipt must include gasUsed and effectiveGasPrice");
  }
  const executionWei = fromQuantity(receipt.gasUsed) * fromQuantity(receipt.effectiveGasPrice);
  const hasL1Fee = receipt.l1Fee !== undefined && receipt.l1Fee !== null;
  const l1Wei = hasL1Fee ? fromQuantity(receipt.l1Fee) : null;
  return {
    executionWei: executionWei.toString(),
    l1Wei: l1Wei?.toString() ?? null,
    totalWei: l1Wei === null ? null : (executionWei + l1Wei).toString(),
    gasUsed: fromQuantity(receipt.gasUsed).toString(),
    effectiveGasPrice: fromQuantity(receipt.effectiveGasPrice).toString(),
  };
}
