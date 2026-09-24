export type MemberId = string;
export type ToolId = string;
export type RequestId = string;

export type Member = {
  id: MemberId;
  name: string;
  neighborhood: string;
  wallet: string;
  stats: MemberStats;
};

export type MemberStats = {
  completedLoans: number;
  lateReturns: number;
  totalLateDays: number;
  depositsForfeitedUsdc: number;
};

export type ToolCondition = "Excellent" | "Good" | "Working" | "Needs care";

export type Tool = {
  id: ToolId;
  ownerId: MemberId;
  name: string;
  category: string;
  photoUrl: string;
  condition: ToolCondition;
  conditionNotes: string;
  depositUsdc: number;
  lateFeeUsdcPerDay: number;
  availability: "available" | "loaned";
};

export type LoanStatus = "requested" | "approved" | "active" | "returned" | "declined";

export type LoanRequest = {
  id: RequestId;
  toolId: ToolId;
  borrowerId: MemberId;
  status: LoanStatus;
  requestedDays: number;
  depositUsdc: number;
  lateFeeUsdcPerDay: number;
  requestedAt: string;
  approvedAt?: string;
  dueAt?: string;
  returnedAt?: string;
  lateDays?: number;
  feePaidUsdc?: number;
  refundUsdc?: number;
};

export type LedgerEntry = {
  id: string;
  at: string;
  type: "escrow" | "refund" | "late_fee";
  requestId: RequestId;
  fromMemberId?: MemberId;
  toMemberId?: MemberId;
  amountUsdc: number;
  memo: string;
};

export type AppState = {
  members: Member[];
  tools: Tool[];
  requests: LoanRequest[];
  ledger: LedgerEntry[];
};
