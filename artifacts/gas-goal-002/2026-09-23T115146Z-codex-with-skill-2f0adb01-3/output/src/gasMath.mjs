export const WEI_PER_ETH = 1_000_000_000_000_000_000n;
export const DEFAULT_TRANSFERS_PER_DAY = 40_000;
export const DEFAULT_ERC20_TRANSFER_GAS = 65_000n;
export const DEFAULT_BATCH_FIXED_GAS = 35_000n;
export const DEFAULT_BATCH_MARGINAL_GAS = 48_000n;

export function toBigInt(value, name = "value") {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && value.trim() !== "") return BigInt(value);
  throw new TypeError(`${name} must be an integer-like bigint, number, or string`);
}

export function weiToEth(wei) {
  return Number(toBigInt(wei, "wei")) / Number(WEI_PER_ETH);
}

export function usdFromWei(wei, ethUsd) {
  return weiToEth(wei) * ethUsd;
}

export function transactionCostWei({ gasUsed, gasPriceWei, l1FeeWei = 0n }) {
  return toBigInt(gasUsed, "gasUsed") * toBigInt(gasPriceWei, "gasPriceWei") + toBigInt(l1FeeWei, "l1FeeWei");
}

export function transferCostUsd({ gasUsed, gasPriceWei, l1FeeWei = 0n, ethUsd }) {
  return usdFromWei(transactionCostWei({ gasUsed, gasPriceWei, l1FeeWei }), ethUsd);
}

export function volumeCostUsd({ transfersPerDay, gasUsed, gasPriceWei, l1FeeWei = 0n, ethUsd, days = 1 }) {
  return transferCostUsd({ gasUsed, gasPriceWei, l1FeeWei, ethUsd }) * transfersPerDay * days;
}

export function ceilDiv(a, b) {
  const left = toBigInt(a, "a");
  const right = toBigInt(b, "b");
  if (right <= 0n) throw new RangeError("divisor must be positive");
  return (left + right - 1n) / right;
}

export function estimateBatchSavings({
  transfersPerDay = DEFAULT_TRANSFERS_PER_DAY,
  gasPriceWei,
  ethUsd,
  currentGasPerTransfer = DEFAULT_ERC20_TRANSFER_GAS,
  l1FeeWeiPerTransfer = 0n,
  batchSize = 100,
  batchFixedGas = DEFAULT_BATCH_FIXED_GAS,
  batchMarginalGas = DEFAULT_BATCH_MARGINAL_GAS,
}) {
  const transfers = BigInt(transfersPerDay);
  const batches = ceilDiv(transfers, BigInt(batchSize));
  const currentGas = transfers * toBigInt(currentGasPerTransfer, "currentGasPerTransfer");
  const batchedGas = batches * toBigInt(batchFixedGas, "batchFixedGas") + transfers * toBigInt(batchMarginalGas, "batchMarginalGas");

  const currentWei = currentGas * toBigInt(gasPriceWei, "gasPriceWei") + transfers * toBigInt(l1FeeWeiPerTransfer, "l1FeeWeiPerTransfer");
  const batchedWei = batchedGas * toBigInt(gasPriceWei, "gasPriceWei") + transfers * toBigInt(l1FeeWeiPerTransfer, "l1FeeWeiPerTransfer");
  const savingsWei = currentWei - batchedWei;

  return {
    batchesPerDay: Number(batches),
    currentGas: currentGas.toString(),
    batchedGas: batchedGas.toString(),
    currentUsdPerDay: usdFromWei(currentWei, ethUsd),
    batchedUsdPerDay: usdFromWei(batchedWei, ethUsd),
    savingsUsdPerDay: usdFromWei(savingsWei, ethUsd),
    savingsUsdPer30Days: usdFromWei(savingsWei * 30n, ethUsd),
    savingsPct: Number(savingsWei) / Number(currentWei),
  };
}

export function estimateCoalescingSavings({ originalCount, coalescedCount, costPerTransferUsd }) {
  if (coalescedCount > originalCount) throw new RangeError("coalescedCount cannot exceed originalCount");
  const avoidedTransfers = originalCount - coalescedCount;
  const savingsUsd = avoidedTransfers * costPerTransferUsd;

  return {
    avoidedTransfers,
    savingsUsd,
    savingsPct: originalCount === 0 ? 0 : avoidedTransfers / originalCount,
  };
}
