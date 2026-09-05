import { formatUnits, parseUnits } from "viem";

export const USDC_DECIMALS = 6;

/** Formats a USDC base-unit amount for display, e.g. 1500000n -> "1.50" */
export const formatUsdc = (amount?: bigint, maximumFractionDigits = 2) =>
  amount === undefined
    ? "—"
    : Number(formatUnits(amount, USDC_DECIMALS)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits,
      });

/** Parses a user-typed amount into USDC base units. Returns undefined if unparseable. */
export const parseUsdc = (value: string): bigint | undefined => {
  const trimmed = value.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return undefined;
  try {
    return parseUnits(trimmed, USDC_DECIMALS);
  } catch {
    return undefined;
  }
};

/** "just now", "3m ago", ... from a unix timestamp in seconds. */
export const timeAgo = (timestamp: bigint | number) => {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(timestamp));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
