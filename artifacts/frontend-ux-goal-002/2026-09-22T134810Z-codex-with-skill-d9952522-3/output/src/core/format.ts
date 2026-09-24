import { formatUnits } from "viem";

const compactFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
});

const fiatFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatTokenAmount(value: bigint | undefined, decimals: number, fallback = "0") {
  if (value === undefined) return fallback;
  const formatted = formatUnits(value, decimals);
  const numericValue = Number(formatted);

  if (!Number.isFinite(numericValue)) {
    return formatted;
  }

  if (numericValue > 0 && numericValue < 0.000001) {
    return "<0.000001";
  }

  return compactFormatter.format(numericValue);
}

export function formatFiat(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Price unavailable";
  }

  return fiatFormatter.format(value);
}

export function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
