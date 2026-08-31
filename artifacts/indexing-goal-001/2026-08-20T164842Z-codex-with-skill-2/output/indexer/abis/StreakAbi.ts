export const StreakAbi = [
  {
    type: "event",
    name: "CheckIn",
    anonymous: false,
    inputs: [
      { indexed: true, name: "member", type: "address" },
      { indexed: true, name: "day", type: "uint64" },
      { indexed: false, name: "note", type: "string" },
      { indexed: false, name: "timestamp", type: "uint64" },
    ],
  },
] as const;
