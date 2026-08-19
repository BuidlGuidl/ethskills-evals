/**
 * ABI of contracts/src/Streak.sol. Only the events are needed for indexing;
 * the view functions are kept so the same ABI can be reused by a frontend.
 * Regenerate with:  pnpm --dir ../contracts run abi   (see contracts/README notes)
 */
export const streakAbi = [
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { name: "member", type: "address", indexed: true, internalType: "address" },
      { name: "day", type: "uint32", indexed: true, internalType: "uint32" },
      { name: "month", type: "uint32", indexed: true, internalType: "uint32" },
      { name: "timestamp", type: "uint64", indexed: false, internalType: "uint64" },
      { name: "streak", type: "uint32", indexed: false, internalType: "uint32" },
      { name: "total", type: "uint32", indexed: false, internalType: "uint32" },
      { name: "note", type: "string", indexed: false, internalType: "string" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MemberJoined",
    inputs: [
      { name: "member", type: "address", indexed: true, internalType: "address" },
      { name: "timestamp", type: "uint64", indexed: false, internalType: "uint64" },
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
    name: "canCheckIn",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
  {
    type: "function",
    name: "currentStreak",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint32", internalType: "uint32" }],
  },
  {
    type: "function",
    name: "profileOf",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address", internalType: "address" }],
    outputs: [
      { name: "streak", type: "uint32", internalType: "uint32" },
      { name: "longestStreak", type: "uint32", internalType: "uint32" },
      { name: "total", type: "uint32", internalType: "uint32" },
      { name: "lastCheckInDay", type: "uint32", internalType: "uint32" },
      { name: "checkedInToday", type: "bool", internalType: "bool" },
    ],
  },
  {
    type: "function",
    name: "currentMonth",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint32", internalType: "uint32" }],
  },
  {
    type: "function",
    name: "members",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address", internalType: "address" }],
    outputs: [
      { name: "lastCheckInDay", type: "uint32", internalType: "uint32" },
      { name: "streakAtLastCheckIn", type: "uint32", internalType: "uint32" },
      { name: "longestStreak", type: "uint32", internalType: "uint32" },
      { name: "totalCheckIns", type: "uint32", internalType: "uint32" },
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
    outputs: [{ name: "", type: "uint32", internalType: "uint32" }],
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
