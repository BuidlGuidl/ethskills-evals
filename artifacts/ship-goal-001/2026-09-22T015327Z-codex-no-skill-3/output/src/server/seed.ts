import { parseUsdc } from "../shared/money.js";
import type { Loan, Member, Tool, Wallet } from "../shared/types.js";

export type Database = {
  members: Member[];
  tools: Tool[];
  loans: Loan[];
  wallets: Wallet[];
};

const now = "2026-09-21T12:00:00.000Z";

export function createSeedDatabase(): Database {
  const members: Member[] = [
    {
      id: "m-ana",
      name: "Ana Rivera",
      block: "Maple 1400",
      joinedAt: "2024-03-02T00:00:00.000Z",
      completedLoans: 22,
      lateReturns: 1
    },
    {
      id: "m-ben",
      name: "Ben Carter",
      block: "Oak 900",
      joinedAt: "2023-11-14T00:00:00.000Z",
      completedLoans: 17,
      lateReturns: 0
    },
    {
      id: "m-camila",
      name: "Camila Shah",
      block: "Pine 200",
      joinedAt: "2024-05-19T00:00:00.000Z",
      completedLoans: 9,
      lateReturns: 2
    },
    {
      id: "m-devon",
      name: "Devon Lee",
      block: "Elm 700",
      joinedAt: "2025-01-08T00:00:00.000Z",
      completedLoans: 3,
      lateReturns: 0
    },
    {
      id: "m-eli",
      name: "Eli Morgan",
      block: "Cedar 300",
      joinedAt: "2024-08-27T00:00:00.000Z",
      completedLoans: 12,
      lateReturns: 5
    },
    {
      id: "m-faye",
      name: "Faye Thomas",
      block: "Birch 1100",
      joinedAt: "2025-02-12T00:00:00.000Z",
      completedLoans: 6,
      lateReturns: 0
    }
  ];

  const tools: Tool[] = [
    {
      id: "t-miter-saw",
      ownerId: "m-ben",
      name: "DeWalt 12 in. compound miter saw",
      category: "Woodworking",
      photoUrl:
        "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80",
      conditionNotes: "Sharp blade, dust bag patched, clamp works.",
      depositMicroUsdc: parseUsdc("75"),
      dailyLateFeeMicroUsdc: parseUsdc("8"),
      status: "available",
      createdAt: "2026-08-01T10:00:00.000Z"
    },
    {
      id: "t-pressure-washer",
      ownerId: "m-ana",
      name: "Ryobi 1900 PSI electric pressure washer",
      category: "Outdoor",
      photoUrl:
        "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80",
      conditionNotes: "Includes patio nozzle and extension hose.",
      depositMicroUsdc: parseUsdc("60"),
      dailyLateFeeMicroUsdc: parseUsdc("6"),
      status: "available",
      createdAt: "2026-07-15T09:00:00.000Z"
    },
    {
      id: "t-tile-saw",
      ownerId: "m-camila",
      name: "Wet tile saw with folding stand",
      category: "Renovation",
      photoUrl:
        "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80",
      conditionNotes: "Reservoir has a slow drip; blade is nearly new.",
      depositMicroUsdc: parseUsdc("90"),
      dailyLateFeeMicroUsdc: parseUsdc("10"),
      status: "requested",
      createdAt: "2026-07-28T09:00:00.000Z"
    },
    {
      id: "t-ladder",
      ownerId: "m-faye",
      name: "24 ft. aluminum extension ladder",
      category: "Access",
      photoUrl:
        "https://images.unsplash.com/photo-1575734004913-72917d5e6433?auto=format&fit=crop&w=1200&q=80",
      conditionNotes: "Lightweight, clean feet, rope replaced this summer.",
      depositMicroUsdc: parseUsdc("50"),
      dailyLateFeeMicroUsdc: parseUsdc("5"),
      status: "available",
      createdAt: "2026-08-19T11:30:00.000Z"
    },
    {
      id: "t-drain-auger",
      ownerId: "m-devon",
      name: "50 ft. electric drain auger",
      category: "Plumbing",
      photoUrl:
        "https://images.unsplash.com/photo-1626863905121-3b0c0ed7b94c?auto=format&fit=crop&w=1200&q=80",
      conditionNotes: "Gloves and disinfectant included; return rinsed.",
      depositMicroUsdc: parseUsdc("45"),
      dailyLateFeeMicroUsdc: parseUsdc("7"),
      status: "borrowed",
      createdAt: "2026-06-22T13:45:00.000Z"
    },
    {
      id: "t-post-hole",
      ownerId: "m-eli",
      name: "Manual post-hole digger",
      category: "Garden",
      photoUrl:
        "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=1200&q=80",
      conditionNotes: "Handles are solid, blades have surface rust.",
      depositMicroUsdc: parseUsdc("25"),
      dailyLateFeeMicroUsdc: parseUsdc("4"),
      status: "available",
      createdAt: "2026-08-30T16:00:00.000Z"
    }
  ];

  const loans: Loan[] = [
    {
      id: "l-requested-tile",
      toolId: "t-tile-saw",
      ownerId: "m-camila",
      borrowerId: "m-ben",
      requestedAt: now,
      startDate: "2026-09-23",
      dueDate: "2026-09-26",
      depositMicroUsdc: parseUsdc("90"),
      dailyLateFeeMicroUsdc: parseUsdc("10"),
      lateDays: 0,
      lateFeeChargedMicroUsdc: 0,
      status: "requested"
    },
    {
      id: "l-active-auger",
      toolId: "t-drain-auger",
      ownerId: "m-devon",
      borrowerId: "m-eli",
      requestedAt: "2026-09-16T12:00:00.000Z",
      startDate: "2026-09-17",
      dueDate: "2026-09-20",
      depositMicroUsdc: parseUsdc("45"),
      dailyLateFeeMicroUsdc: parseUsdc("7"),
      lateDays: 0,
      lateFeeChargedMicroUsdc: 0,
      status: "active"
    }
  ];

  const wallets: Wallet[] = members.map((member, index) => ({
    memberId: member.id,
    availableMicroUsdc: parseUsdc(String([220, 180, 145, 130, 95, 160][index])),
    escrowedMicroUsdc: 0,
    earnedFeesMicroUsdc: parseUsdc(String([12, 32, 8, 0, 6, 14][index]))
  }));

  walletFor(wallets, "m-ben").availableMicroUsdc -= parseUsdc("90");
  walletFor(wallets, "m-ben").escrowedMicroUsdc += parseUsdc("90");
  walletFor(wallets, "m-eli").availableMicroUsdc -= parseUsdc("45");
  walletFor(wallets, "m-eli").escrowedMicroUsdc += parseUsdc("45");

  return { members, tools, loans, wallets };
}

function walletFor(wallets: Wallet[], memberId: string): Wallet {
  const wallet = wallets.find((candidate) => candidate.memberId === memberId);
  if (!wallet) {
    throw new Error(`Missing seeded wallet for ${memberId}`);
  }
  return wallet;
}
