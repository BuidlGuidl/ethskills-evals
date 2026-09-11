import { formatUnits, parseUnits } from "viem";

/** USDC uses 6 decimals, on Base and everywhere else. */
export const USDC_DECIMALS = 6;

/** Amounts offered as one-click buttons in the tip form. */
export const QUICK_AMOUNTS = ["1", "5", "25"];

/** Longest tip message the contract accepts, in bytes (keep in sync with TipJar.MAX_MESSAGE_LENGTH). */
export const MAX_MESSAGE_LENGTH = 140;

/** Format a raw USDC amount for display, e.g. 1500000n -> "1.50". */
export const formatUsdc = (amount: bigint | undefined, maximumFractionDigits = 2) => {
  if (amount === undefined) return "-";

  return Number(formatUnits(amount, USDC_DECIMALS)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
};

/**
 * Parse a user-typed amount into raw USDC units.
 * Returns undefined for anything that is not a positive number with at most 6 decimals.
 */
export const parseUsdc = (value: string): bigint | undefined => {
  const trimmed = value.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return undefined;

  const [, fraction = ""] = trimmed.split(".");
  if (fraction.length > USDC_DECIMALS) return undefined;

  try {
    const parsed = parseUnits(trimmed, USDC_DECIMALS);
    return parsed > 0n ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/** Turn a block timestamp into "12s ago" / "4m ago" / a date for anything older than a week. */
export const timeAgo = (timestamp: bigint, nowMs: number) => {
  const seconds = Math.max(0, Math.floor(nowMs / 1000 - Number(timestamp)));

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(Number(timestamp) * 1000).toLocaleDateString();
};
