export type Address = `0x${string}`;

export type Member = {
  address: Address;
  displayName: string;
  joinedAt: string;
  completedLoans: number;
  lateReturns: number;
};

export type ToolCondition = "excellent" | "good" | "worn" | "repair-needed";

export type ToolListing = {
  id: string;
  owner: Address;
  name: string;
  category: string;
  condition: ToolCondition;
  conditionNotes: string;
  photoUrl: string;
  depositUsdc: number;
  dailyLateFeeUsdc: number;
  available: boolean;
  listingHash: `0x${string}`;
};

export type BorrowRequest = {
  id: string;
  toolId: string;
  borrower: Address;
  startDate: string;
  dueDate: string;
  status: "pending" | "approved" | "declined" | "onchain-requested";
  chainLoanId?: string;
};

export type ToolshedState = {
  members: Member[];
  listings: ToolListing[];
  requests: BorrowRequest[];
};
