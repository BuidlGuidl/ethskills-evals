import { formatUnits, parseUnits } from "viem";

/** USDC uses 6 decimals on every chain Circle deploys it to. */
export const USDC_DECIMALS = 6;

/** Amounts offered as one-click presets in the tip form, in whole USDC. */
export const QUICK_AMOUNTS = ["1", "5", "25"];

/** Keep in sync with `TipJar.MAX_MESSAGE_LENGTH`. */
export const MAX_MESSAGE_BYTES = 200;

export const formatUsdc = (amount: bigint | undefined, maximumFractionDigits = 2) => {
  if (amount === undefined) return "—";
  return Number(formatUnits(amount, USDC_DECIMALS)).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
};

/** Parses user input into USDC units, returning 0n for anything unusable. */
export const parseUsdc = (value: string): bigint => {
  const trimmed = value.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return 0n;
  try {
    return parseUnits(trimmed, USDC_DECIMALS);
  } catch {
    return 0n;
  }
};

/** Byte length of a message, which is what the contract limits. */
export const messageByteLength = (message: string) => new TextEncoder().encode(message).length;

/**
 * Human readable age of a tip.
 * `now` comes from the chain's latest block so the feed stays honest on a fork,
 * whose clock can differ from the browser's.
 */
export const timeAgo = (timestamp: bigint, now: bigint | undefined) => {
  const reference = now ?? BigInt(Math.floor(Date.now() / 1000));
  const seconds = Number(reference - timestamp);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
