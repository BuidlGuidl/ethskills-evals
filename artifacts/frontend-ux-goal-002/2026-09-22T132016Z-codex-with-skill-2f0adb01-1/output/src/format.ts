import { formatEther, formatUnits } from "viem";
import { USDC_DECIMALS } from "./usdc";

const compactNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatUsdc(value?: bigint) {
  if (value === undefined) return "0.00 USDC";
  const amount = Number(formatUnits(value, USDC_DECIMALS));
  return `${compactNumber.format(amount)} USDC`;
}

export function formatEth(value?: bigint) {
  if (value === undefined) return "0 ETH";
  const amount = Number(formatEther(value));
  return `${compactNumber.format(amount)} ETH`;
}

export function formatUsd(value?: number | null) {
  if (!Number.isFinite(value ?? Number.NaN)) return "~$--";
  return `~${usdFormatter.format(value ?? 0)}`;
}

export function shortenAddress(value: string, visible = 6) {
  if (value.length <= visible * 2 + 2) return value;
  return `${value.slice(0, visible)}...${value.slice(-4)}`;
}

export function decimalPlaces(value: string) {
  return value.includes(".") ? value.split(".")[1]?.length ?? 0 : 0;
}
