export type Member = {
  name: string;
  address: `0x${string}`;
  neighborhood: string;
  completedLoans: number;
  lateReturns: number;
};

export type ToolCard = {
  id: number;
  name: string;
  owner: Member;
  image: string;
  condition: string;
  deposit: number;
  lateFee: number;
  maxDays: number;
  tags: string[];
};

export type BorrowRequest = {
  id: number;
  toolName: string;
  requester: Member;
  days: number;
  deposit: number;
  note: string;
};

export const members: Member[] = [
  {
    name: "Maya R.",
    address: "0x8a8cF0E439Bc9bE43B9e77fd4De5A3ddF9bd1Bb7",
    neighborhood: "Oak Street",
    completedLoans: 17,
    lateReturns: 0,
  },
  {
    name: "Dev S.",
    address: "0x9Fa112ddcA9Dd9d92afC6C453b22c02CE4E3421F",
    neighborhood: "North Garden",
    completedLoans: 9,
    lateReturns: 1,
  },
  {
    name: "Alma K.",
    address: "0xb84E16C9B28B2bb3151412E471B901503DF476F7",
    neighborhood: "Cedar Court",
    completedLoans: 5,
    lateReturns: 2,
  },
  {
    name: "Jon P.",
    address: "0x56b47A611A3B174528B094774042E219c8E08019",
    neighborhood: "West Loop",
    completedLoans: 0,
    lateReturns: 0,
  },
];

export const tools: ToolCard[] = [
  {
    id: 1,
    name: "Cordless hammer drill",
    owner: members[0],
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80",
    condition: "Two batteries, bits included. Chuck has cosmetic wear but holds tight.",
    deposit: 75,
    lateFee: 10,
    maxDays: 7,
    tags: ["Power", "DIY"],
  },
  {
    id: 2,
    name: "Folding extension ladder",
    owner: members[1],
    image: "https://images.unsplash.com/photo-1523413363574-c30aa1c2a516?auto=format&fit=crop&w=900&q=80",
    condition: "16 ft reach. Rubber feet replaced this spring.",
    deposit: 120,
    lateFee: 15,
    maxDays: 3,
    tags: ["Outdoor", "Heavy"],
  },
  {
    id: 3,
    name: "Orbital sander",
    owner: members[2],
    image: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=900&q=80",
    condition: "Works cleanly, dust bag zipper is fussy. Comes with 120 and 220 grit discs.",
    deposit: 45,
    lateFee: 6,
    maxDays: 5,
    tags: ["Finish", "Wood"],
  },
];

export const requests: BorrowRequest[] = [
  {
    id: 101,
    toolName: "Cordless hammer drill",
    requester: members[0],
    days: 2,
    deposit: 75,
    note: "Mounting shelves before Saturday.",
  },
  {
    id: 102,
    toolName: "Folding extension ladder",
    requester: members[3],
    days: 3,
    deposit: 120,
    note: "Cleaning gutters; first time borrowing.",
  },
  {
    id: 103,
    toolName: "Orbital sander",
    requester: members[1],
    days: 4,
    deposit: 45,
    note: "Refinishing two cabinet doors.",
  },
];

export function reliability(member: Member) {
  if (member.completedLoans === 0) return 1;
  return (member.completedLoans - member.lateReturns) / member.completedLoans;
}

export function reliabilityLabel(member: Member) {
  return `${Math.round(reliability(member) * 100)}% reliable`;
}
