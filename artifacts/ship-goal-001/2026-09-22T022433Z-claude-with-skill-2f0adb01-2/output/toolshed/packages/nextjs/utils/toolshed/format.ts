import { type Loan, LoanState } from "./types";
import { formatUnits, parseUnits } from "viem";

/** USDC is 6 decimals, everywhere. Never hardcode 1e18 for it. */
export const USDC_DECIMALS = 6;

/** Mirrors Toolshed.UNFLAGGED_FEE_GRACE: late fees pause here until the owner flags the tool missing. */
export const UNFLAGGED_FEE_GRACE_DAYS = 7;

export const formatUsdc = (amount: bigint | undefined, withSymbol = true) => {
  if (amount === undefined) return withSymbol ? "$—" : "—";
  const value = Number(formatUnits(amount, USDC_DECIMALS));
  const text = value.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `$${text}` : text;
};

/**
 * The same amount as an editable string: full precision, no thousands separators. Never feed
 * `formatUsdc` into an input — its grouping commas do not survive a round trip through `parseUsdc`,
 * and its 2-decimal rounding would quietly rewrite a listing's terms on save.
 */
export const usdcInputValue = (amount: bigint | undefined) =>
  amount === undefined ? "" : formatUnits(amount, USDC_DECIMALS);

/** Parses a human dollar string ("12.50", "1,200") into USDC units. Throws on garbage. */
export const parseUsdc = (input: string) => parseUnits(input.trim().replace(/,/g, "") || "0", USDC_DECIMALS);

/** Same, but for anything a user is still typing: never throws, falls back to 0. */
export const parseUsdcSafe = (input: string) => {
  try {
    return parseUsdc(input);
  } catch {
    return 0n;
  }
};

export const DAY = 24 * 60 * 60;

export const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000));

export const formatDate = (timestamp: bigint) =>
  timestamp === 0n
    ? "—"
    : new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

/**
 * "in 3 days" / "2 days ago", counted the way the late fee counts: a started day is a whole day, so
 * a card never says "4 days ago" next to a charge for 5 late days.
 */
export const formatRelativeDays = (timestamp: bigint, from = nowSeconds()) => {
  const diff = Number(timestamp - from);
  if (Math.abs(diff) < DAY) return "today";
  const days = Math.ceil(Math.abs(diff) / DAY);
  return diff > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"} ago`;
};

/**
 * Days late for a return at `at`, matching the contract exactly: a started day counts as a whole
 * day, so a tool one hour overdue already costs one day of fees. A loan with no due date yet (a
 * request nobody has approved) is not late — the contract guards this and so must we, or a pending
 * request renders as though the borrower had already lost their deposit.
 */
export const lateDaysAt = (dueAt: bigint, at: bigint) => {
  if (dueAt === 0n || at === 0n || at <= dueAt) return 0;
  return Math.ceil(Number(at - dueAt) / DAY);
};

/**
 * Late fee the contract would charge for a return at `at`: capped at the deposit, and — until the
 * owner has flagged the tool missing — frozen a week past the due date. See Toolshed._quote.
 */
export const lateFeeAt = (
  loan: Pick<Loan, "dueAt" | "dailyLateFee" | "deposit"> & { missingFlaggedAt?: bigint },
  at: bigint,
) => {
  const graceEnd = loan.dueAt + BigInt(UNFLAGGED_FEE_GRACE_DAYS * DAY);
  const chargeableUntil = !loan.missingFlaggedAt && at > graceEnd ? graceEnd : at;
  const days = BigInt(lateDaysAt(loan.dueAt, chargeableUntil));
  const fee = days * loan.dailyLateFee;
  return fee > loan.deposit ? loan.deposit : fee;
};

/** True while late fees are paused because the owner has not put the accusation on the record. */
export const feesPausedPendingFlag = (loan: Pick<Loan, "dueAt" | "missingFlaggedAt">, at: bigint) =>
  loan.missingFlaggedAt === 0n && at > loan.dueAt + BigInt(UNFLAGGED_FEE_GRACE_DAYS * DAY);

/** When an unreturned loan's fees will have eaten the whole deposit (see Toolshed.defaultTime). */
export const defaultTime = (loan: Pick<Loan, "dueAt" | "dailyLateFee" | "deposit">) => {
  if (loan.dailyLateFee === 0n) return 0n;
  const daysToCap = (loan.deposit + loan.dailyLateFee - 1n) / loan.dailyLateFee;
  return loan.dueAt + daysToCap * BigInt(DAY);
};

export const isOverdue = (loan: Loan, at = nowSeconds()) => loan.state === LoanState.Active && at > loan.dueAt;

export const shortHash = (value: string, lead = 6, tail = 4) =>
  value.length <= lead + tail ? value : `${value.slice(0, lead)}…${value.slice(-tail)}`;
