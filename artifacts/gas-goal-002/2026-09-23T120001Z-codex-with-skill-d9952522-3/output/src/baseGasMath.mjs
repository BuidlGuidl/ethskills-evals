export const WEI_PER_ETH = 10n ** 18n;
export const GWEI = 10n ** 9n;

export function weiToEthNumber(wei) {
  return Number(wei) / Number(WEI_PER_ETH);
}

export function weiToGweiNumber(wei) {
  return Number(wei) / Number(GWEI);
}

export function percentile(values, pct) {
  if (values.length === 0) {
    throw new Error("cannot take percentile of an empty list");
  }

  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

export function calculateTransferCost({
  gasUsed,
  gasPriceWei,
  l1FeeWei = 0n,
  ethUsd,
  transfersPerDay = 40000n
}) {
  const executionWei = gasUsed * gasPriceWei;
  const totalWeiPerTransfer = executionWei + l1FeeWei;
  const ethPerTransfer = weiToEthNumber(totalWeiPerTransfer);
  const usdPerTransfer = ethPerTransfer * ethUsd;
  const dailyUsd = usdPerTransfer * Number(transfersPerDay);

  return {
    executionWei,
    totalWeiPerTransfer,
    ethPerTransfer,
    usdPerTransfer,
    dailyUsd,
    monthlyUsd: dailyUsd * 30,
    annualUsd: dailyUsd * 365
  };
}

export function calculateBatchSavings({
  directGasUsed,
  batchedGasPerTransfer,
  gasPriceWei,
  directL1FeeWei,
  batchedL1FeePerTransferWei,
  ethUsd,
  transfersPerDay = 40000n
}) {
  const direct = calculateTransferCost({
    gasUsed: directGasUsed,
    gasPriceWei,
    l1FeeWei: directL1FeeWei,
    ethUsd,
    transfersPerDay
  });
  const batched = calculateTransferCost({
    gasUsed: batchedGasPerTransfer,
    gasPriceWei,
    l1FeeWei: batchedL1FeePerTransferWei,
    ethUsd,
    transfersPerDay
  });

  return {
    direct,
    batched,
    savedUsdPerDay: direct.dailyUsd - batched.dailyUsd,
    savedUsdPerMonth: direct.monthlyUsd - batched.monthlyUsd,
    savedUsdPerYear: direct.annualUsd - batched.annualUsd,
    savedPct: ((direct.dailyUsd - batched.dailyUsd) / direct.dailyUsd) * 100
  };
}

export function buildBaseFeePolicy({ baseFeeWei, gasPriceWei, maxPriorityFeeWei = 1_000_000n }) {
  if (gasPriceWei < baseFeeWei) {
    throw new Error("gasPriceWei must be greater than or equal to baseFeeWei");
  }

  const suggestedPriorityFeeWei = gasPriceWei - baseFeeWei;
  const maxPriorityFeePerGas = suggestedPriorityFeeWei < maxPriorityFeeWei
    ? suggestedPriorityFeeWei
    : maxPriorityFeeWei;

  return {
    maxPriorityFeePerGas,
    maxFeePerGas: baseFeeWei * 2n + maxPriorityFeePerGas,
    suggestedPriorityFeeWei
  };
}

export function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 10 ? 4 : 2
  }).format(value);
}
