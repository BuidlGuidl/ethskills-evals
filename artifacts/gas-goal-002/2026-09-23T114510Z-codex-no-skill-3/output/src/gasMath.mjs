export const WEI_PER_ETH = 10n ** 18n;
export const WEI_PER_GWEI = 10n ** 9n;

export function decimalToWei(value, decimals = 18) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid decimal number");
    value = String(value);
  }
  if (typeof value !== "string") throw new Error("Decimal value must be a string or number");

  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const [whole, fraction = ""] = normalized.split(".");
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

export function gweiToWei(gwei) {
  return decimalToWei(gwei, 9);
}

export function ethToWei(eth) {
  return decimalToWei(eth, 18);
}

export function weiToEthNumber(wei) {
  return Number(wei) / Number(WEI_PER_ETH);
}

export function formatEth(wei, decimals = 6) {
  return weiToEthNumber(wei).toFixed(decimals);
}

export function formatUsd(amount, decimals = 2) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function executionCostWei(gasUsed, gasPriceWei) {
  return BigInt(gasUsed) * BigInt(gasPriceWei);
}

export function dailyTransferCost({
  transfersPerDay,
  gasUsedPerTransfer,
  gasPriceGwei,
  ethUsd,
  l1FeeEthPerTransfer = "0",
}) {
  const txCount = BigInt(transfersPerDay);
  const executionWei = executionCostWei(
    BigInt(transfersPerDay) * BigInt(gasUsedPerTransfer),
    gweiToWei(String(gasPriceGwei)),
  );
  const l1Wei = ethToWei(String(l1FeeEthPerTransfer)) * txCount;
  const totalWei = executionWei + l1Wei;
  const eth = weiToEthNumber(totalWei);

  return {
    executionWei,
    l1Wei,
    totalWei,
    eth,
    usd: eth * Number(ethUsd),
  };
}

export function annualize(day) {
  return {
    wei: day.totalWei * 365n,
    eth: day.eth * 365,
    usd: day.usd * 365,
  };
}

export function gasSavings({
  transfersPerDay,
  gasSavedPerTransfer,
  gasPriceGwei,
  ethUsd,
  savedTransfersPerDay = 0,
  baselineGasUsedPerTransfer = 0,
}) {
  const gasSaved =
    BigInt(transfersPerDay) * BigInt(gasSavedPerTransfer) +
    BigInt(savedTransfersPerDay) * BigInt(baselineGasUsedPerTransfer);
  const totalWei = executionCostWei(gasSaved, gweiToWei(String(gasPriceGwei)));
  const eth = weiToEthNumber(totalWei);

  return {
    gasSaved,
    totalWei,
    eth,
    usd: eth * Number(ethUsd),
  };
}

export function tipSavings({
  transfersPerDay,
  gasUsedPerTransfer,
  currentPriorityGwei,
  targetPriorityGwei,
  ethUsd,
}) {
  const current = gweiToWei(String(currentPriorityGwei));
  const target = gweiToWei(String(targetPriorityGwei));
  if (target > current) throw new Error("Target priority fee is above current priority fee");

  const gasPerDay = BigInt(transfersPerDay) * BigInt(gasUsedPerTransfer);
  const totalWei = gasPerDay * (current - target);
  const eth = weiToEthNumber(totalWei);

  return {
    gasSaved: 0n,
    totalWei,
    eth,
    usd: eth * Number(ethUsd),
  };
}
