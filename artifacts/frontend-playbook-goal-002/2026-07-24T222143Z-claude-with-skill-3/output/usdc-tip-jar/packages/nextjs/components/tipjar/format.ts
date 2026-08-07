import { formatUnits } from "viem";

export const USDC_DECIMALS = 6;

/** Format a raw USDC amount (6 decimals) as a human string, e.g. 1500000n -> "1.5". */
export const formatUSDC = (raw?: bigint) => {
  if (raw === undefined) return "0";
  const asNumber = Number(formatUnits(raw, USDC_DECIMALS));
  return asNumber.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

/** Turn a unix-seconds timestamp into a short relative string, e.g. "3m ago". */
export const timeAgo = (timestampSeconds: bigint) => {
  const seconds = Math.floor(Date.now() / 1000) - Number(timestampSeconds);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};
