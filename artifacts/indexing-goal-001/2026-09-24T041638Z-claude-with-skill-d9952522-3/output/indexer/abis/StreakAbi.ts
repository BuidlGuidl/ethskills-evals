/// ABI of contracts/src/Streak.sol. Regenerate with:
///   forge inspect Streak abi --json
/// Only the pieces the read side uses are kept.
export const StreakAbi = [
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { name: "member", type: "address", indexed: true, internalType: "address" },
      { name: "day", type: "uint32", indexed: true, internalType: "uint32" },
      { name: "streak", type: "uint32", indexed: false, internalType: "uint32" },
      { name: "total", type: "uint32", indexed: false, internalType: "uint32" },
      { name: "isNewMember", type: "bool", indexed: false, internalType: "bool" },
      { name: "note", type: "string", indexed: false, internalType: "string" },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [{ name: "note", type: "string", internalType: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "currentDay",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint32", internalType: "uint32" }],
  },
  {
    type: "function",
    name: "hasCheckedInToday",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
  {
    type: "function",
    name: "profileOf",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address", internalType: "address" }],
    outputs: [
      { name: "currentStreak", type: "uint32", internalType: "uint32" },
      { name: "longestStreak", type: "uint32", internalType: "uint32" },
      { name: "total", type: "uint32", internalType: "uint32" },
      { name: "firstDay", type: "uint32", internalType: "uint32" },
      { name: "lastDay", type: "uint32", internalType: "uint32" },
      { name: "checkedInToday", type: "bool", internalType: "bool" },
    ],
  },
  {
    type: "function",
    name: "totalCheckIns",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
  },
  {
    type: "function",
    name: "totalMembers",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
  },
  { type: "error", name: "AlreadyCheckedInToday", inputs: [{ name: "day", type: "uint32", internalType: "uint32" }] },
  {
    type: "error",
    name: "NoteTooLong",
    inputs: [
      { name: "length", type: "uint256", internalType: "uint256" },
      { name: "max", type: "uint256", internalType: "uint256" },
    ],
  },
] as const;
