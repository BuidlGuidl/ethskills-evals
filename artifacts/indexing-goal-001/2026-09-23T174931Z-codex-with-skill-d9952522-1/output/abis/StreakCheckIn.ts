export const StreakCheckInAbi = [
  {
    type: "function",
    name: "MAX_NOTE_BYTES",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "checkIn",
    inputs: [{ name: "note", type: "string", internalType: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "lastCheckInDay",
    inputs: [{ name: "member", type: "address", internalType: "address" }],
    outputs: [{ name: "day", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalCheckIns",
    inputs: [{ name: "member", type: "address", internalType: "address" }],
    outputs: [{ name: "count", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "CheckIn",
    inputs: [
      { name: "member", type: "address", indexed: true, internalType: "address" },
      { name: "day", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "timestamp", type: "uint64", indexed: false, internalType: "uint64" },
      { name: "note", type: "string", indexed: false, internalType: "string" },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AlreadyCheckedIn",
    inputs: [
      { name: "member", type: "address", internalType: "address" },
      { name: "day", type: "uint256", internalType: "uint256" },
    ],
  },
  {
    type: "error",
    name: "NoteTooLong",
    inputs: [
      { name: "length", type: "uint256", internalType: "uint256" },
      { name: "maxLength", type: "uint256", internalType: "uint256" },
    ],
  },
] as const;
