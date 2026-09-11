import { formatUnits, parseUnits } from "viem";

/** USDC uses 6 decimals, not 18. */
export const USDC_DECIMALS = 6;

/** What the tip form accepts: digits with at most 6 decimal places. */
export const USDC_AMOUNT_PATTERN = /^\d*\.?\d{0,6}$/;

export const parseUsdc = (value: string) => parseUnits(value, USDC_DECIMALS);

export const formatUsdc = (value: bigint | undefined, maximumFractionDigits = 2) =>
  value === undefined
    ? "—"
    : Number(formatUnits(value, USDC_DECIMALS)).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits,
      });

/** Full precision, for tooltips and inputs where rounding would be misleading. */
export const formatUsdcExact = (value: bigint) => formatUnits(value, USDC_DECIMALS);

export const timeAgo = (timestampSeconds: bigint, now: number) => {
  const seconds = Math.max(0, Math.floor(now / 1000) - Number(timestampSeconds));

  if (seconds < 60) return "just now";

  const units: [label: string, seconds: number][] = [
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];
  for (const [label, size] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label} ago`;
  }
  return "just now";
};
