import type { Address } from "viem";

/** Mirrors Toolshed.LoanState. */
export enum LoanState {
  None = 0,
  Requested = 1,
  Active = 2,
  ReturnClaimed = 3,
  Disputed = 4,
  Closed = 5,
}

/** Mirrors Toolshed.Outcome. */
export enum Outcome {
  Pending = 0,
  Cancelled = 1,
  Declined = 2,
  OnTime = 3,
  Late = 4,
  Defaulted = 5,
  Unresolved = 6,
}

export type Tool = {
  owner: Address;
  deposit: bigint;
  dailyLateFee: bigint;
  maxDurationDays: number;
  listed: boolean;
  activeLoanId: bigint;
  metadataURI: string;
};

export type Loan = {
  toolId: bigint;
  borrower: Address;
  deposit: bigint;
  dailyLateFee: bigint;
  durationDays: number;
  requestedAt: bigint;
  startedAt: bigint;
  dueAt: bigint;
  returnedAt: bigint;
  missingFlaggedAt: bigint;
  state: number;
  outcome: number;
  feeToOwner: bigint;
  refundToBorrower: bigint;
};

export type Record = {
  loansBorrowed: number;
  lateReturns: number;
  defaults: number;
  loansLent: number;
  lateFeesPaid: bigint;
  lateFeesEarned: bigint;
};

/** A tool plus its id and the offchain metadata the frontend resolved from IPFS. */
export type ToolWithId = Tool & {
  id: bigint;
  metadata?: ToolMetadata;
};

export type ToolMetadata = {
  name: string;
  description?: string;
  condition?: string;
  image?: string;
};

export const EMPTY_RECORD: Record = {
  loansBorrowed: 0,
  lateReturns: 0,
  defaults: 0,
  loansLent: 0,
  lateFeesPaid: 0n,
  lateFeesEarned: 0n,
};

export const LOAN_STATE_LABEL: { [key in LoanState]: string } = {
  [LoanState.None]: "Unknown",
  [LoanState.Requested]: "Awaiting the owner",
  [LoanState.Active]: "Out on loan",
  [LoanState.ReturnClaimed]: "Return reported",
  [LoanState.Disputed]: "Disputed",
  [LoanState.Closed]: "Closed",
};

export const OUTCOME_LABEL: { [key in Outcome]: string } = {
  [Outcome.Pending]: "In progress",
  [Outcome.Cancelled]: "Request withdrawn",
  [Outcome.Declined]: "Request declined",
  [Outcome.OnTime]: "Returned on time",
  [Outcome.Late]: "Returned late",
  [Outcome.Defaulted]: "Never came back",
  [Outcome.Unresolved]: "Settled down the middle",
};
