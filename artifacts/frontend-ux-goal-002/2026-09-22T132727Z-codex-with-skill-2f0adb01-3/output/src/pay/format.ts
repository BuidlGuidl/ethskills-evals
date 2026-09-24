import { formatEther, formatUnits } from "viem";
import { USDC_DECIMALS } from "./usdc";

const amountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

const fiatFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsdc(value?: bigint) {
  if (value === undefined) return "--";
  return amountFormatter.format(Number(formatUnits(value, USDC_DECIMALS)));
}

export function formatEth(value?: bigint) {
  if (value === undefined) return "--";
  return amountFormatter.format(Number(formatEther(value)));
}

export function formatUsd(value?: number | null) {
  if (value === undefined || value === null || !Number.isFinite(value)) return "~$--";
  return `~${fiatFormatter.format(value)}`;
}

export function shortenAddress(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function normalizeAmountInput(value: string) {
  const stripped = value.replace(/[^\d.]/g, "");
  const [whole, ...fractions] = stripped.split(".");
  const fraction = fractions.join("").slice(0, USDC_DECIMALS);
  return fractions.length > 0 ? `${whole}.${fraction}` : whole;
}

export function parsedUsdcNumber(value: string) {
  if (!value || value === ".") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
