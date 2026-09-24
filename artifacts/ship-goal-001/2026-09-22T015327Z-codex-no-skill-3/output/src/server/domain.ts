import crypto from "node:crypto";
import { parseUsdc } from "../shared/money.js";
import type {
  ApproveLoanInput,
  CreateToolInput,
  DeclineLoanInput,
  Loan,
  LoanWithDetails,
  Member,
  MemberReputation,
  RequestLoanInput,
  ReturnLoanInput,
  Tool,
  ToolWithOwner,
  ToolshedState,
  Wallet
} from "../shared/types.js";
import { DomainError } from "./errors.js";
import type { Database } from "./seed.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getToolshedState(database: Database, now = new Date()): ToolshedState {
  const members = database.members.map(toReputation).sort((a, b) => b.reliabilityScore - a.reliabilityScore);

  const tools = database.tools
    .map((tool) => attachOwner(tool, database.members))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return statusRank(a.status) - statusRank(b.status);
      }
      return b.owner.reliabilityScore - a.owner.reliabilityScore;
    });

  const loans = database.loans
    .map((loan) => attachLoanDetails(loan, database))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return loanStatusRank(a.status) - loanStatusRank(b.status);
      }
      return b.borrower.reliabilityScore - a.borrower.reliabilityScore;
    });

  return {
    members,
    tools,
    loans,
    wallets: database.wallets,
    now: now.toISOString()
  };
}

export function createTool(database: Database, input: CreateToolInput): ToolWithOwner {
  const owner = mustFindMember(database, input.ownerId);
  const tool: Tool = {
    id: `t-${crypto.randomUUID()}`,
    ownerId: owner.id,
    name: required(input.name, "Tool name"),
    category: required(input.category, "Category"),
    photoUrl: required(input.photoUrl, "Photo URL"),
    conditionNotes: required(input.conditionNotes, "Condition notes"),
    depositMicroUsdc: parseUsdc(input.depositUsdc),
    dailyLateFeeMicroUsdc: parseUsdc(input.dailyLateFeeUsdc),
    status: "available",
    createdAt: new Date().toISOString()
  };

  if (tool.depositMicroUsdc <= 0 || tool.dailyLateFeeMicroUsdc <= 0) {
    throw new DomainError("Deposit and late fee must be greater than zero.");
  }

  database.tools.push(tool);
  return attachOwner(tool, database.members);
}

export function requestLoan(database: Database, input: RequestLoanInput): LoanWithDetails {
  const tool = mustFindTool(database, input.toolId);
  const borrower = mustFindMember(database, input.borrowerId);
  const owner = mustFindMember(database, tool.ownerId);

  if (tool.status !== "available") {
    throw new DomainError("That tool is not available to borrow.");
  }
  if (borrower.id === owner.id) {
    throw new DomainError("Owners cannot borrow their own tools.");
  }

  const start = parseDateOnly(input.startDate, "startDate");
  const due = parseDateOnly(input.dueDate, "dueDate");
  if (due.getTime() < start.getTime()) {
    throw new DomainError("Due date must be on or after the start date.");
  }

  const borrowerWallet = mustFindWallet(database, borrower.id);
  if (borrowerWallet.availableMicroUsdc < tool.depositMicroUsdc) {
    throw new DomainError("Borrower does not have enough available USDC for the deposit.");
  }

  borrowerWallet.availableMicroUsdc -= tool.depositMicroUsdc;
  borrowerWallet.escrowedMicroUsdc += tool.depositMicroUsdc;
  tool.status = "requested";

  const loan: Loan = {
    id: `l-${crypto.randomUUID()}`,
    toolId: tool.id,
    ownerId: owner.id,
    borrowerId: borrower.id,
    requestedAt: new Date().toISOString(),
    startDate: input.startDate,
    dueDate: input.dueDate,
    depositMicroUsdc: tool.depositMicroUsdc,
    dailyLateFeeMicroUsdc: tool.dailyLateFeeMicroUsdc,
    lateDays: 0,
    lateFeeChargedMicroUsdc: 0,
    status: "requested"
  };

  database.loans.push(loan);
  return attachLoanDetails(loan, database);
}

export function approveLoan(database: Database, loanId: string, input: ApproveLoanInput): LoanWithDetails {
  const loan = mustFindLoan(database, loanId);
  const tool = mustFindTool(database, loan.toolId);

  if (loan.status !== "requested") {
    throw new DomainError("Only requested loans can be approved.");
  }
  if (loan.ownerId !== input.ownerId) {
    throw new DomainError("Only the tool owner can approve this request.", 403);
  }

  loan.status = "active";
  tool.status = "borrowed";
  return attachLoanDetails(loan, database);
}

export function declineLoan(database: Database, loanId: string, input: DeclineLoanInput): LoanWithDetails {
  const loan = mustFindLoan(database, loanId);
  const tool = mustFindTool(database, loan.toolId);

  if (loan.status !== "requested") {
    throw new DomainError("Only requested loans can be declined.");
  }
  if (loan.ownerId !== input.ownerId) {
    throw new DomainError("Only the tool owner can decline this request.", 403);
  }

  const borrowerWallet = mustFindWallet(database, loan.borrowerId);
  borrowerWallet.escrowedMicroUsdc -= loan.depositMicroUsdc;
  borrowerWallet.availableMicroUsdc += loan.depositMicroUsdc;
  loan.status = "declined";
  tool.status = "available";
  return attachLoanDetails(loan, database);
}

export function returnLoan(database: Database, loanId: string, input: ReturnLoanInput): LoanWithDetails {
  const loan = mustFindLoan(database, loanId);
  const tool = mustFindTool(database, loan.toolId);

  if (loan.status !== "active") {
    throw new DomainError("Only active loans can be returned.");
  }

  const returnedAt = new Date(input.returnedAt);
  if (Number.isNaN(returnedAt.getTime())) {
    throw new DomainError("Return timestamp is invalid.");
  }

  const lateDays = calculateLateDays(loan.dueDate, returnedAt);
  const lateFee = Math.min(loan.depositMicroUsdc, lateDays * loan.dailyLateFeeMicroUsdc);
  const refund = loan.depositMicroUsdc - lateFee;
  const borrowerWallet = mustFindWallet(database, loan.borrowerId);
  const ownerWallet = mustFindWallet(database, loan.ownerId);
  const borrower = mustFindMember(database, loan.borrowerId);

  borrowerWallet.escrowedMicroUsdc -= loan.depositMicroUsdc;
  borrowerWallet.availableMicroUsdc += refund;
  ownerWallet.availableMicroUsdc += lateFee;
  ownerWallet.earnedFeesMicroUsdc += lateFee;

  borrower.completedLoans += 1;
  if (lateDays > 0) {
    borrower.lateReturns += 1;
  }

  loan.status = "returned";
  loan.returnedAt = returnedAt.toISOString();
  loan.lateDays = lateDays;
  loan.lateFeeChargedMicroUsdc = lateFee;
  tool.status = "available";

  return attachLoanDetails(loan, database);
}

export function calculateLateDays(dueDate: string, returnedAt: Date): number {
  const dueEnd = new Date(`${dueDate}T23:59:59.999Z`);
  const lateMs = returnedAt.getTime() - dueEnd.getTime();
  return lateMs > 0 ? Math.ceil(lateMs / DAY_MS) : 0;
}

export function toReputation(member: Member): MemberReputation {
  const onTimeReturns = Math.max(member.completedLoans - member.lateReturns, 0);
  const lateRate = member.completedLoans === 0 ? 0 : member.lateReturns / member.completedLoans;
  const reliabilityScore = onTimeReturns * 10 + Math.min(member.completedLoans, 20) - member.lateReturns * 15;

  return {
    ...member,
    onTimeReturns,
    lateRate,
    reliabilityScore
  };
}

function attachOwner(tool: Tool, members: Member[]): ToolWithOwner {
  const owner = members.find((member) => member.id === tool.ownerId);
  if (!owner) {
    throw new DomainError(`Tool ${tool.id} has no owner.`, 500);
  }
  return {
    ...tool,
    owner: toReputation(owner)
  };
}

function attachLoanDetails(loan: Loan, database: Database): LoanWithDetails {
  return {
    ...loan,
    tool: mustFindTool(database, loan.toolId),
    owner: toReputation(mustFindMember(database, loan.ownerId)),
    borrower: toReputation(mustFindMember(database, loan.borrowerId))
  };
}

function mustFindMember(database: Database, memberId: string): Member {
  const member = database.members.find((candidate) => candidate.id === memberId);
  if (!member) {
    throw new DomainError("Member was not found.", 404);
  }
  return member;
}

function mustFindTool(database: Database, toolId: string): Tool {
  const tool = database.tools.find((candidate) => candidate.id === toolId);
  if (!tool) {
    throw new DomainError("Tool was not found.", 404);
  }
  return tool;
}

function mustFindLoan(database: Database, loanId: string): Loan {
  const loan = database.loans.find((candidate) => candidate.id === loanId);
  if (!loan) {
    throw new DomainError("Loan was not found.", 404);
  }
  return loan;
}

function mustFindWallet(database: Database, memberId: string): Wallet {
  const wallet = database.wallets.find((candidate) => candidate.memberId === memberId);
  if (!wallet) {
    throw new DomainError("Wallet was not found.", 404);
  }
  return wallet;
}

function required(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new DomainError(`${label} is required.`);
  }
  return trimmed;
}

function parseDateOnly(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainError(`${field} must be a YYYY-MM-DD date.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainError(`${field} is invalid.`);
  }
  return parsed;
}

function statusRank(status: Tool["status"]): number {
  return { available: 0, requested: 1, borrowed: 2 }[status];
}

function loanStatusRank(status: Loan["status"]): number {
  return { requested: 0, active: 1, returned: 2, declined: 3 }[status];
}
