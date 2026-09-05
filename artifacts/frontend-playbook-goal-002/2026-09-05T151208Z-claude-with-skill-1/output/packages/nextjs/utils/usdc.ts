import { formatUnits, parseUnits } from "viem";

/**
 * USDC has 6 decimals on every chain Circle deploys it to, and `TipJar.tokenDecimals`
 * mirrors that onchain. Kept as a constant so amount rendering never has to wait on an
 * RPC round trip.
 */
export const USDC_DECIMALS = 6;

/** Format a raw USDC amount (6-decimal base units) for display, without the symbol. */
export const formatUsdc = (amount: bigint | undefined): string => {
  if (amount === undefined) return "—";

  const asNumber = Number(formatUnits(amount, USDC_DECIMALS));
  // Sub-cent tips would otherwise all render as "0.00".
  const maximumFractionDigits = asNumber > 0 && asNumber < 0.01 ? USDC_DECIMALS : 2;

  return asNumber.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits });
};

/** Parse a user-typed amount into raw USDC base units. Returns undefined if it is not usable. */
export const parseUsdc = (value: string): bigint | undefined => {
  const trimmed = value.trim();
  if (!trimmed || !/^\d*\.?\d*$/.test(trimmed)) return undefined;

  try {
    const parsed = parseUnits(trimmed, USDC_DECIMALS);
    return parsed > 0n ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/** "just now" / "5m ago" / "3d ago" for a unix timestamp in seconds. */
export const formatRelativeTime = (timestamp: bigint | number): string => {
  const seconds = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
