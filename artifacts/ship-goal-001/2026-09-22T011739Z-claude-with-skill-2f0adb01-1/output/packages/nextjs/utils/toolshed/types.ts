import { Address } from "viem";

/** Mirrors Toolshed.LoanStatus. */
export enum LoanStatus {
  None,
  Requested,
  Active,
  ReturnDeclared,
  Completed,
  Cancelled,
  Declined,
  Expired,
  Defaulted,
}

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  [LoanStatus.None]: "—",
  [LoanStatus.Requested]: "Awaiting owner",
  [LoanStatus.Active]: "Out on loan",
  [LoanStatus.ReturnDeclared]: "Return declared",
  [LoanStatus.Completed]: "Returned",
  [LoanStatus.Cancelled]: "Cancelled",
  [LoanStatus.Declined]: "Declined",
  [LoanStatus.Expired]: "Expired",
  [LoanStatus.Defaulted]: "Never returned",
};

/** Mirrors Toolshed.Tool, with the array index carried along as `id`. */
export type Tool = {
  id: number;
  owner: Address;
  deposit: bigint;
  feePerDay: bigint;
  maxDays: number;
  activeLoanId: bigint;
  available: boolean;
  retired: boolean;
  metadataURI: string;
};

/** Mirrors Toolshed.Loan, with the array index carried along as `id`. */
export type Loan = {
  id: number;
  borrower: Address;
  toolId: number;
  status: LoanStatus;
  disputed: boolean;
  deposit: bigint;
  feePerDay: bigint;
  durationDays: number;
  requestedAt: number;
  startedAt: number;
  dueAt: number;
  returnedAt: number;
};

/** Mirrors Toolshed.Member. */
export type MemberStats = {
  active: boolean;
  joinedAt: number;
  loansBorrowed: number;
  lateReturns: number;
  totalLateDays: number;
  defaults: number;
  loansLent: number;
  openBorrows: number;
};

/** The JSON document a tool's metadataURI points at. */
export type ToolMetadata = {
  name: string;
  photo: string;
  condition: string;
};

export const EMPTY_STATS: MemberStats = {
  active: false,
  joinedAt: 0,
  loansBorrowed: 0,
  lateReturns: 0,
  totalLateDays: 0,
  defaults: 0,
  loansLent: 0,
  openBorrows: 0,
};
