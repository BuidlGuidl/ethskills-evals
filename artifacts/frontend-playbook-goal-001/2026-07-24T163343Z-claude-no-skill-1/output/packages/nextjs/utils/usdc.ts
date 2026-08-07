import { formatUnits, parseUnits } from "viem";

/** USDC uses 6 decimals on Base. */
export const USDC_DECIMALS = 6;

/** Format a USDC base-unit amount (bigint) as a human string, e.g. 1500000n -> "1.5". */
export const formatUsdc = (amount: bigint) => formatUnits(amount, USDC_DECIMALS);

/** Parse a human USDC string (e.g. "1.5") into base units. Throws on invalid input. */
export const parseUsdc = (amount: string) => parseUnits(amount, USDC_DECIMALS);
