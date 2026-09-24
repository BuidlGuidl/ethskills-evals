export type Member = {
  address: `0x${string}`;
  name: string;
  neighborhood: string;
  loansBorrowed: number;
  lateReturns: number;
};

export type Tool = {
  id: string;
  name: string;
  owner: `0x${string}`;
  condition: string;
  photo: string;
  depositUsdc: number;
  dailyLateFeeUsdc: number;
  availableFrom: string;
};

export const members: Member[] = [
  {
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    name: "Maya Chen",
    neighborhood: "Juniper Ave",
    loansBorrowed: 21,
    lateReturns: 1,
  },
  {
    address: "0x1111111111111111111111111111111111111111",
    name: "Luis Ortega",
    neighborhood: "Maple Court",
    loansBorrowed: 17,
    lateReturns: 0,
  },
  {
    address: "0x2222222222222222222222222222222222222222",
    name: "Priya Shah",
    neighborhood: "Cedar Loop",
    loansBorrowed: 12,
    lateReturns: 3,
  },
  {
    address: "0x3333333333333333333333333333333333333333",
    name: "Noah Williams",
    neighborhood: "Elm Street",
    loansBorrowed: 7,
    lateReturns: 0,
  },
];

export const tools: Tool[] = [
  {
    id: "cordless-drill-kit",
    name: "Cordless drill kit",
    owner: members[0].address,
    condition: "Two batteries, charger, bit set. Chuck sticks if over-tightened.",
    photo:
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
    depositUsdc: 75,
    dailyLateFeeUsdc: 8,
    availableFrom: "Today",
  },
  {
    id: "pressure-washer",
    name: "Electric pressure washer",
    owner: members[1].address,
    condition: "Works well for patios and siding. Wand has a fresh nozzle.",
    photo:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80",
    depositUsdc: 120,
    dailyLateFeeUsdc: 15,
    availableFrom: "Tomorrow",
  },
  {
    id: "tile-saw",
    name: "Wet tile saw",
    owner: members[2].address,
    condition: "Blade is serviceable; bring your own ear protection.",
    photo:
      "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=1200&q=80",
    depositUsdc: 150,
    dailyLateFeeUsdc: 20,
    availableFrom: "Friday",
  },
  {
    id: "folding-ladder",
    name: "Multi-position ladder",
    owner: members[3].address,
    condition: "Clean, stable, rated 300 lb. Paint marks on one rail.",
    photo:
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
    depositUsdc: 90,
    dailyLateFeeUsdc: 10,
    availableFrom: "Today",
  },
];

export function reliabilityScore(member: Member) {
  const latePenalty = member.lateReturns * 14;
  const experienceBonus = Math.min(member.loansBorrowed * 2, 30);
  return Math.max(0, 70 + experienceBonus - latePenalty);
}

export function memberByAddress(address: string) {
  return members.find((member) => member.address.toLowerCase() === address.toLowerCase());
}
