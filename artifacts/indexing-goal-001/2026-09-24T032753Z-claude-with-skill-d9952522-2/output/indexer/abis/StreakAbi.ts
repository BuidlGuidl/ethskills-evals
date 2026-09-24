/// ABI fragment for the read side. Only the `CheckedIn` event is needed to rebuild
/// the complete history; the view functions are here for optional live reads.
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
    name: "currentStreak",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint32", internalType: "uint32" }],
  },
  {
    type: "function",
    name: "hasCheckedInToday",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
] as const;
