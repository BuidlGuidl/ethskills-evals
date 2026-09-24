export const streakCheckInAbi = [
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [{ name: "note", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "lastCheckInDay",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "day", type: "uint64" }],
  },
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { name: "member", type: "address", indexed: true },
      { name: "day", type: "uint64", indexed: true },
      { name: "timestamp", type: "uint64", indexed: false },
      { name: "note", type: "string", indexed: false },
    ],
  },
] as const;

