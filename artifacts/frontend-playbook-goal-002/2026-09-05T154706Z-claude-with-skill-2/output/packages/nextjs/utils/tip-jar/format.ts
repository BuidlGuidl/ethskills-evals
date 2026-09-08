import { formatUnits } from "viem";

/** Render a token amount with thousands separators, trimming pointless decimals. */
export const formatTokenAmount = (amount: bigint, decimals: number, maximumFractionDigits = 2) =>
  Number(formatUnits(amount, decimals)).toLocaleString("en-US", { maximumFractionDigits });

/**
 * Compact "3 minutes ago" style timestamp.
 *
 * Note for local dev: anvil only mines when a transaction arrives unless it is
 * started with `--block-time`, so on a frozen chain these will appear stuck.
 * `yarn fork` sets `--block-time 1` for exactly this reason.
 */
export const formatTimeAgo = (timestamp: bigint, now: number = Date.now()) => {
  const seconds = Math.floor(now / 1000 - Number(timestamp));

  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(Number(timestamp) * 1000).toLocaleDateString();
};
