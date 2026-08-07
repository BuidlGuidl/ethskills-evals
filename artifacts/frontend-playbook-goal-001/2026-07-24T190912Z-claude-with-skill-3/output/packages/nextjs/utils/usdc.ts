import { formatUnits } from "viem";

// USDC uses 6 decimals on Base (and everywhere Circle issues it).
export const USDC_DECIMALS = 6;

/** Format a USDC base-unit amount as a human string, e.g. 2500000n -> "2.5". */
export const formatUsdc = (amount: bigint) => {
  const asNumber = Number(formatUnits(amount, USDC_DECIMALS));
  return asNumber.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
