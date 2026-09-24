import type { AppState, Member, Tool } from "../domain/types";

export const seedMembers: Member[] = [
  {
    id: "m-aria",
    name: "Aria Chen",
    neighborhood: "Maple Street",
    wallet: "0x7a2c...41f0",
    stats: {
      completedLoans: 18,
      lateReturns: 1,
      totalLateDays: 1,
      depositsForfeitedUsdc: 5,
    },
  },
  {
    id: "m-ben",
    name: "Ben Ortiz",
    neighborhood: "Cedar Court",
    wallet: "0x9c10...3d8b",
    stats: {
      completedLoans: 6,
      lateReturns: 3,
      totalLateDays: 8,
      depositsForfeitedUsdc: 40,
    },
  },
  {
    id: "m-devon",
    name: "Devon Price",
    neighborhood: "Hilltop",
    wallet: "0x412d...c029",
    stats: {
      completedLoans: 11,
      lateReturns: 0,
      totalLateDays: 0,
      depositsForfeitedUsdc: 0,
    },
  },
  {
    id: "m-gita",
    name: "Gita Shah",
    neighborhood: "River Row",
    wallet: "0x0f91...8ac2",
    stats: {
      completedLoans: 2,
      lateReturns: 0,
      totalLateDays: 0,
      depositsForfeitedUsdc: 0,
    },
  },
];

export const seedTools: Tool[] = [
  {
    id: "t-compound-miter",
    ownerId: "m-aria",
    name: "Compound miter saw",
    category: "Woodworking",
    photoUrl:
      "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=80",
    condition: "Good",
    conditionNotes: "Cuts square. Blade was replaced this spring; return with dust bag emptied.",
    depositUsdc: 120,
    lateFeeUsdcPerDay: 12,
    availability: "available",
  },
  {
    id: "t-pressure-washer",
    ownerId: "m-devon",
    name: "Electric pressure washer",
    category: "Outdoor",
    photoUrl:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80",
    condition: "Working",
    conditionNotes: "Includes two nozzles and a 25 ft hose. GFCI plug is a little stiff.",
    depositUsdc: 80,
    lateFeeUsdcPerDay: 8,
    availability: "available",
  },
  {
    id: "t-tile-saw",
    ownerId: "m-ben",
    name: "Wet tile saw",
    category: "Renovation",
    photoUrl:
      "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=900&q=80",
    condition: "Needs care",
    conditionNotes: "Reservoir works, but the tray needs gentle handling. Best for small bathroom jobs.",
    depositUsdc: 95,
    lateFeeUsdcPerDay: 10,
    availability: "loaned",
  },
  {
    id: "t-drain-auger",
    ownerId: "m-gita",
    name: "Hand-crank drain auger",
    category: "Plumbing",
    photoUrl:
      "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=900&q=80",
    condition: "Excellent",
    conditionNotes: "25 ft cable, cleaned and oiled after each use.",
    depositUsdc: 45,
    lateFeeUsdcPerDay: 6,
    availability: "available",
  },
];

export const seedState: AppState = {
  members: seedMembers,
  tools: seedTools,
  requests: [
    {
      id: "r-existing",
      toolId: "t-tile-saw",
      borrowerId: "m-aria",
      status: "active",
      requestedDays: 3,
      depositUsdc: 95,
      lateFeeUsdcPerDay: 10,
      requestedAt: "2026-09-16T14:00:00.000Z",
      approvedAt: "2026-09-16T16:00:00.000Z",
      dueAt: "2026-09-19T16:00:00.000Z",
    },
  ],
  ledger: [
    {
      id: "r-existing-escrow",
      at: "2026-09-16T14:00:00.000Z",
      type: "escrow",
      requestId: "r-existing",
      fromMemberId: "m-aria",
      amountUsdc: 95,
      memo: "USDC deposit escrowed for Wet tile saw.",
    },
  ],
};
