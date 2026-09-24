export const StreakAbi = [
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
    outputs: [{ name: "checkInId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "checkInCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "currentDay",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasCheckedIn",
    inputs: [{ name: "member", type: "address", internalType: "address" }],
    outputs: [{ name: "checkedInBefore", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastCheckInDay",
    inputs: [{ name: "member", type: "address", internalType: "address" }],
    outputs: [{ name: "day", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalCheckIns",
    inputs: [{ name: "member", type: "address", internalType: "address" }],
    outputs: [{ name: "total", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { name: "member", type: "address", indexed: true, internalType: "address" },
      { name: "day", type: "uint64", indexed: true, internalType: "uint64" },
      { name: "checkInId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "note", type: "string", indexed: false, internalType: "string" },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AlreadyCheckedIn",
    inputs: [
      { name: "member", type: "address", internalType: "address" },
      { name: "day", type: "uint64", internalType: "uint64" },
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
