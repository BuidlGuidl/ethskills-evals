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
    name: "hasCheckedIn",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "checkedInBefore", type: "bool" }],
  },
  {
    type: "function",
    name: "lastCheckInDay",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "day", type: "uint256" }],
  },
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { indexed: true, name: "member", type: "address" },
      { indexed: true, name: "day", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
      { indexed: false, name: "note", type: "string" },
    ],
  },
] as const;
