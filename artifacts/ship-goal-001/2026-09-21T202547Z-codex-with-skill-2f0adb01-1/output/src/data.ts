export type Member = {
  id: string;
  name: string;
  address: `0x${string}`;
  neighborhood: string;
  completedLoans: number;
  lateReturns: number;
};

export type Tool = {
  id: string;
  name: string;
  category: string;
  ownerId: string;
  condition: string;
  deposit: number;
  lateFee: number;
  image: string;
  availability: "Available" | "Pending" | "Borrowed";
};

export type LoanRequest = {
  id: string;
  toolId: string;
  borrowerId: string;
  days: number;
  status: "Pending" | "Accepted" | "Returned";
};

export const members: Member[] = [
  {
    id: "mara",
    name: "Mara Santos",
    address: "0x1111111111111111111111111111111111111111",
    neighborhood: "Oak & 5th",
    completedLoans: 18,
    lateReturns: 1
  },
  {
    id: "devon",
    name: "Devon Lee",
    address: "0x2222222222222222222222222222222222222222",
    neighborhood: "Cedar Court",
    completedLoans: 9,
    lateReturns: 0
  },
  {
    id: "anika",
    name: "Anika Rao",
    address: "0x3333333333333333333333333333333333333333",
    neighborhood: "Maple Walk",
    completedLoans: 14,
    lateReturns: 4
  },
  {
    id: "sam",
    name: "Sam Rivera",
    address: "0x4444444444444444444444444444444444444444",
    neighborhood: "West Garden",
    completedLoans: 4,
    lateReturns: 0
  }
];

export const tools: Tool[] = [
  {
    id: "ladder-24ft",
    name: "24 ft extension ladder",
    category: "Ladders",
    ownerId: "mara",
    condition: "Aluminum frame, rubber feet replaced this spring.",
    deposit: 120,
    lateFee: 12,
    image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
    availability: "Available"
  },
  {
    id: "tile-saw",
    name: "Wet tile saw",
    category: "Cutting",
    ownerId: "devon",
    condition: "Good blade, tray has cosmetic rust.",
    deposit: 180,
    lateFee: 18,
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80",
    availability: "Available"
  },
  {
    id: "pressure-washer",
    name: "Electric pressure washer",
    category: "Outdoor",
    ownerId: "anika",
    condition: "Includes 25 ft hose and two nozzles.",
    deposit: 150,
    lateFee: 15,
    image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80",
    availability: "Pending"
  },
  {
    id: "post-hole-digger",
    name: "Post hole digger",
    category: "Yard",
    ownerId: "sam",
    condition: "Handles are solid, blades sharpened.",
    deposit: 65,
    lateFee: 6,
    image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80",
    availability: "Available"
  }
];

export const requests: LoanRequest[] = [
  { id: "r1", toolId: "pressure-washer", borrowerId: "devon", days: 3, status: "Pending" },
  { id: "r2", toolId: "pressure-washer", borrowerId: "mara", days: 2, status: "Pending" },
  { id: "r3", toolId: "tile-saw", borrowerId: "anika", days: 4, status: "Returned" }
];

export function reliability(member: Member) {
  if (member.completedLoans === 0) {
    return 80;
  }
  const lateRate = member.lateReturns / member.completedLoans;
  const experienceBonus = Math.min(10, member.completedLoans / 2);
  return Math.round(Math.max(10, 95 - lateRate * 70 + experienceBonus));
}

export function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
