import { DAY, lateDays } from "./format";
import { Loan, LoanStatus } from "./types";

// These mirror the constants in Toolshed.sol. They're `public constant` on an immutable
// contract, so they can't drift underneath us — but if you change them there, change them here.
export const REQUEST_EXPIRY = 3 * DAY;
export const RETURN_CONFIRM_WINDOW = 3 * DAY;
export const DEFAULT_GRACE = 30 * DAY;

export type Settlement = {
  lateDays: number;
  feeToOwner: bigint;
  refundToBorrower: bigint;
};

/**
 * What this loan pays out if it settles now — the same arithmetic as Toolshed._settle, so the
 * UI can show a live figure without a contract call per loan. Once the borrower has declared
 * the return, the clock is frozen at that moment.
 */
export const settlementNow = (loan: Loan, at: number): Settlement => {
  // Mirrors quoteSettlement: a closed loan has nothing left to split, and its dueAt may be 0.
  if (loan.status !== LoanStatus.Active && loan.status !== LoanStatus.ReturnDeclared) {
    return { lateDays: 0, feeToOwner: 0n, refundToBorrower: 0n };
  }
  const endAt = loan.returnedAt === 0 ? at : loan.returnedAt;
  const days = lateDays(loan.dueAt, endAt);
  const uncapped = BigInt(days) * loan.feePerDay;
  const feeToOwner = uncapped > loan.deposit ? loan.deposit : uncapped;
  return { lateDays: days, feeToOwner, refundToBorrower: loan.deposit - feeToOwner };
};

export const isOpen = (loan: Loan) =>
  loan.status === LoanStatus.Requested ||
  loan.status === LoanStatus.Active ||
  loan.status === LoanStatus.ReturnDeclared;

export const canExpireRequest = (loan: Loan, at: number) =>
  loan.status === LoanStatus.Requested && at >= loan.requestedAt + REQUEST_EXPIRY;

/** Mirrors finalizeReturn: the confirm window *and* the due date both have to have passed. */
export const canFinalizeReturn = (loan: Loan, at: number) =>
  loan.status === LoanStatus.ReturnDeclared && at >= Math.max(loan.returnedAt + RETURN_CONFIRM_WINDOW, loan.dueAt);

/** The owner's way out when a tool simply never comes back. */
export const canClaimDefault = (loan: Loan, at: number) => {
  // A disputed loan is the steward's to settle, not the disputing owner's to write off.
  if (loan.status !== LoanStatus.Active || loan.disputed) return false;
  const days = lateDays(loan.dueAt, at);
  const feesAtCap = BigInt(days) * loan.feePerDay >= loan.deposit;
  return feesAtCap || at >= loan.dueAt + DEFAULT_GRACE;
};
