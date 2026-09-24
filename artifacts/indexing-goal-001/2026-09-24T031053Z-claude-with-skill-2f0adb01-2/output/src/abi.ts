/** The parts of the Streak ABI the read side uses. */
export const streakAbi = [
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { name: "member", type: "address", indexed: true },
      { name: "day", type: "uint32", indexed: true },
      { name: "timestamp", type: "uint64", indexed: false },
      { name: "streak", type: "uint32", indexed: false },
      { name: "total", type: "uint32", indexed: false },
      { name: "note", type: "string", indexed: false },
    ],
  },
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [{ name: "note", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "recordOf",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [
      { name: "lastDay", type: "uint32" },
      { name: "currentStreak", type: "uint32" },
      { name: "longestStreak", type: "uint32" },
      { name: "total", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "liveStreak",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "hasCheckedInToday",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "today",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint32" }],
  },
] as const;
