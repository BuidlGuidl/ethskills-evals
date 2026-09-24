export const checkInEventAbi = {
  type: "event",
  name: "CheckIn",
  anonymous: false,
  inputs: [
    { name: "member", type: "address", indexed: true },
    { name: "day", type: "uint64", indexed: true },
    { name: "totalCheckIns", type: "uint64", indexed: false },
    { name: "streakAtCheckIn", type: "uint64", indexed: false },
    { name: "note", type: "string", indexed: false }
  ]
} as const;

export const streakAbi = [
  {
    type: "function",
    name: "MAX_NOTE_BYTES",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [{ name: "note", type: "string" }],
    outputs: []
  },
  {
    type: "function",
    name: "getMember",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [
      { name: "totalCheckIns", type: "uint64" },
      { name: "currentStreak", type: "uint64" },
      { name: "lastCheckInDay", type: "uint64" }
    ]
  },
  checkInEventAbi,
  {
    type: "error",
    name: "AlreadyCheckedInToday",
    inputs: []
  },
  {
    type: "error",
    name: "NoteTooLong",
    inputs: [{ name: "maxBytes", type: "uint256" }]
  }
] as const;
