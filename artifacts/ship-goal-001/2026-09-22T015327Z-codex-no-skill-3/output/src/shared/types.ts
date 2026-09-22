export type ToolStatus = "available" | "requested" | "borrowed";

export type LoanStatus = "requested" | "active" | "returned" | "declined";

export type Member = {
  id: string;
  name: string;
  block: string;
  joinedAt: string;
  completedLoans: number;
  lateReturns: number;
};

export type MemberReputation = Member & {
  onTimeReturns: number;
  reliabilityScore: number;
  lateRate: number;
};

export type Tool = {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  photoUrl: string;
  conditionNotes: string;
  depositMicroUsdc: number;
  dailyLateFeeMicroUsdc: number;
  status: ToolStatus;
  createdAt: string;
};

export type ToolWithOwner = Tool & {
  owner: MemberReputation;
};

export type Loan = {
  id: string;
  toolId: string;
  ownerId: string;
  borrowerId: string;
  requestedAt: string;
  startDate: string;
  dueDate: string;
  returnedAt?: string;
  depositMicroUsdc: number;
  dailyLateFeeMicroUsdc: number;
  lateDays: number;
  lateFeeChargedMicroUsdc: number;
  status: LoanStatus;
};

export type LoanWithDetails = Loan & {
  tool: Tool;
  owner: MemberReputation;
  borrower: MemberReputation;
};

export type Wallet = {
  memberId: string;
  availableMicroUsdc: number;
  escrowedMicroUsdc: number;
  earnedFeesMicroUsdc: number;
};

export type ToolshedState = {
  members: MemberReputation[];
  tools: ToolWithOwner[];
  loans: LoanWithDetails[];
  wallets: Wallet[];
  now: string;
};

export type CreateToolInput = {
  ownerId: string;
  name: string;
  category: string;
  photoUrl: string;
  conditionNotes: string;
  depositUsdc: string;
  dailyLateFeeUsdc: string;
};

export type RequestLoanInput = {
  toolId: string;
  borrowerId: string;
  startDate: string;
  dueDate: string;
};

export type ApproveLoanInput = {
  ownerId: string;
};

export type DeclineLoanInput = {
  ownerId: string;
};

export type ReturnLoanInput = {
  returnedAt: string;
};
