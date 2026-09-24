import { formatUnits, parseUnits } from "viem";

export const USDC_DECIMALS = 6;

/** "12.5 USDC" style display. Trailing zeros trimmed, because nobody says 12.500000. */
export const formatUsdc = (amount: bigint | undefined, withSymbol = true): string => {
  if (amount === undefined) return withSymbol ? "— USDC" : "—";
  const raw = formatUnits(amount, USDC_DECIMALS);
  const trimmed = raw.includes(".") ? raw.replace(/0+$/, "").replace(/\.$/, "") : raw;
  return withSymbol ? `${trimmed} USDC` : trimmed;
};

/**
 * Parse a free-text amount. Returns undefined rather than throwing: these come from inputs a
 * member is still typing into, and viem's parseUnits rejects "1," / "1.5.2" / "" mid-keystroke.
 */
export const parseUsdc = (value: string): bigint | undefined => {
  const trimmed = value.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return undefined;
  try {
    return parseUnits(trimmed, USDC_DECIMALS);
  } catch {
    return undefined;
  }
};

export const DAY = 24 * 60 * 60;

/** Late days, matching the contract exactly: any started day counts. */
export const lateDays = (dueAt: number, endAt: number): number =>
  endAt <= dueAt ? 0 : Math.ceil((endAt - dueAt) / DAY);

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export const formatDate = (timestamp: number): string =>
  timestamp === 0 ? "—" : new Date(timestamp * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** "in 3 days" / "2 days ago", for due dates and deadlines. */
export const relativeDays = (timestamp: number, from = nowSeconds()): string => {
  const delta = timestamp - from;
  const days = Math.round(Math.abs(delta) / DAY);
  if (Math.abs(delta) < DAY) return "today";
  return delta > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"} ago`;
};

/** Same, but for a deadline that may already have passed: "in 2 days" / "now". */
export const deadlineIn = (timestamp: number, from = nowSeconds()): string =>
  timestamp <= from ? "now" : relativeDays(timestamp, from);
