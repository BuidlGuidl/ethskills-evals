/**
 * Base fee policy and receipt accounting.  Uses bigint throughout so that wei
 * amounts are never rounded.  Pass the output of suggestFees directly to an
 * EIP-1559 transaction; fetch it immediately before signing/submitting.
 */
export const BASE_RPC_URL = "https://mainnet.base.org";

const hex = (value) => BigInt(value);
const toHex = (value) => `0x${value.toString(16)}`;

export async function rpc(method, params = [], rpcUrl = BASE_RPC_URL, fetchFn = fetch) {
  const response = await fetchFn(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`Base RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`Base RPC ${method}: ${body.error.message}`);
  return body.result;
}

/** A small inclusion cushion; EIP-1559 refunds the unused part of maxFeePerGas. */
export async function suggestFees({ rpcUrl = BASE_RPC_URL, fetchFn = fetch, cushionBps = 1_250 } = {}) {
  if (!Number.isInteger(cushionBps) || cushionBps < 0) throw new Error("cushionBps must be a non-negative integer");
  const [block, gasPrice] = await Promise.all([
    rpc("eth_getBlockByNumber", ["latest", false], rpcUrl, fetchFn),
    rpc("eth_gasPrice", [], rpcUrl, fetchFn),
  ]);
  const baseFeePerGas = hex(block.baseFeePerGas);
  const recommendedGasPrice = hex(gasPrice);
  const maxPriorityFeePerGas = recommendedGasPrice > baseFeePerGas ? recommendedGasPrice - baseFeePerGas : 0n;
  const maxFeePerGas = (recommendedGasPrice * BigInt(10_000 + cushionBps) + 9_999n) / 10_000n;
  return {
    baseFeePerGas: toHex(baseFeePerGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    maxFeePerGas: toHex(maxFeePerGas),
  };
}

/** Returns the complete OP-stack fee charged to the relayer, including L1 data fee. */
export function receiptCost(receipt) {
  const executionWei = hex(receipt.gasUsed) * hex(receipt.effectiveGasPrice);
  const l1Wei = receipt.l1Fee == null ? 0n : hex(receipt.l1Fee);
  return { executionWei, l1Wei, totalWei: executionWei + l1Wei };
}

export function formatEth(wei, decimals = 9) {
  const scale = 10n ** BigInt(decimals);
  return (Number((wei * scale) / 1_000_000_000_000_000_000n) / Number(scale)).toFixed(decimals);
}
