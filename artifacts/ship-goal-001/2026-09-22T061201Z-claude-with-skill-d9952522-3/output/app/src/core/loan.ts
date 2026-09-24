/**
 * The loan's money rules, mirrored from ToolshedEscrow so the UI can show a member what a
 * settlement will pay out before they send a transaction.
 *
 * The contract is the source of truth. `ToolshedEscrow.quote()` returns the same numbers from
 * chain state; these functions exist so a page can render a live "late fees so far" counter
 * without an RPC round trip per second. `src/core/loan.test.ts` pins them to the Solidity.
 */

export const DAY_SECONDS = 86_400n;

export const USDC_DECIMALS = 6;

/** Loan status as the contract stores it. */
export type LoanStatus = "active" | "disputed" | "closed";

/** How a closed loan ended. Mirrors `ToolshedEscrow.Outcome`. */
export type LoanOutcome =
  | "owner_confirmed"
  | "borrower_receipt"
  | "forfeited"
  | "arbitrated";

export const OUTCOME_BY_INDEX: readonly LoanOutcome[] = [
  "owner_confirmed",
  "borrower_receipt",
  "forfeited",
  "arbitrated",
];

export interface LoanTerms {
  deposit: bigint;
  dailyLateFee: bigint;
  dueAt: bigint;
}

export interface Settlement {
  lateDays: bigint;
  ownerAmount: bigint;
  borrowerAmount: bigint;
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

/**
 * Late days count *started* days: one second past the due date costs a full day's fee. That is
 * the association's rule, and it is what the contract implements.
 */
export function lateDaysAt(terms: LoanTerms, returnedAt: bigint): bigint {
  if (returnedAt <= terms.dueAt) return 0n;
  return ceilDiv(returnedAt - terms.dueAt, DAY_SECONDS);
}

/** Split of the deposit if the tool comes back at `returnedAt`. Owner's cut is capped at it. */
export function settle(terms: LoanTerms, returnedAt: bigint): Settlement {
  const lateDays = lateDaysAt(terms, returnedAt);
  let ownerAmount = lateDays * terms.dailyLateFee;
  if (ownerAmount > terms.deposit) ownerAmount = terms.deposit;
  return {lateDays, ownerAmount, borrowerAmount: terms.deposit - ownerAmount};
}

/**
 * First instant the owner can take the whole deposit via `claimForfeit`. Guaranteed finite
 * because the contract rejects a zero daily fee — a deposit can never be escrowed forever.
 */
export function forfeitableAt(terms: LoanTerms): bigint {
  const daysNeeded = ceilDiv(terms.deposit, terms.dailyLateFee);
  return terms.dueAt + (daysNeeded - 1n) * DAY_SECONDS + 1n;
}

// ------------------------------------------------------------------ formatting

/** "12.50" for 12_500_000n. Trailing zeros trimmed to at most 2 decimals. */
export function formatUsdc(amount: bigint): string {
  const negative = amount < 0n;
  const value = negative ? -amount : amount;
  const whole = value / 1_000_000n;
  const cents = (value % 1_000_000n) / 10_000n;
  const body = `${whole.toLocaleString("en-US")}.${cents.toString().padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

/** "12.5" or "12" -> 12_500_000n. Throws on anything that is not a plain decimal amount. */
export function parseUsdc(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`not a USDC amount: ${input}`);
  }
  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

/** "3 days late" / "due in 4 hours". `now` and `at` are unix seconds. */
export function relativeTime(at: bigint, now: bigint): string {
  const delta = at - now;
  const abs = delta < 0n ? -delta : delta;
  const unit = (n: bigint, name: string) => `${n} ${name}${n === 1n ? "" : "s"}`;
  let text: string;
  if (abs < 3600n) text = unit(abs / 60n || 1n, "minute");
  else if (abs < DAY_SECONDS) text = unit(abs / 3600n, "hour");
  else text = unit(abs / DAY_SECONDS, "day");
  return delta >= 0n ? `in ${text}` : `${text} ago`;
}
