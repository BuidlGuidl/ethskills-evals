/**
 * Derive Base EIP-1559 fields immediately before signing.  Values are bigint
 * wei, suitable for viem/ethers transaction requests.  No fee is hard-coded.
 */
export async function baseFeeFields(provider) {
  const [block, quotedGasPrice] = await Promise.all([
    provider.getBlock("latest"),
    provider.getGasPrice(),
  ]);

  const baseFeePerGas = BigInt(block.baseFeePerGas ?? 0n);
  const gasPrice = BigInt(quotedGasPrice);
  if (gasPrice < baseFeePerGas) {
    throw new Error("RPC returned gas price below Base fee");
  }

  // The quote's excess above base fee is the live priority fee.  Doubling the
  // current base fee only caps a possible next-block rise; it is not paid unless
  // Base charges it.
  const maxPriorityFeePerGas = gasPrice - baseFeePerGas;
  return {
    maxPriorityFeePerGas,
    maxFeePerGas: baseFeePerGas * 2n + maxPriorityFeePerGas,
  };
}

/** Convert an OP-stack receipt into the amount actually charged in wei. */
export function receiptFeeWei(receipt) {
  const execution = BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
  return execution + BigInt(receipt.l1Fee ?? 0n);
}

/** Aggregate a relayer's receipts for finance reporting. */
export function summarizeReceipts(receipts, ethUsd) {
  const totalWei = receipts.reduce((total, receipt) => total + receiptFeeWei(receipt), 0n);
  const transfers = receipts.length;
  const eth = Number(totalWei) / 1e18;
  return {
    transfers,
    totalWei,
    totalEth: eth,
    totalUsd: eth * ethUsd,
    usdPerTransfer: transfers === 0 ? 0 : (eth * ethUsd) / transfers,
  };
}
