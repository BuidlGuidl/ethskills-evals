export const streakAbi = [
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { indexed: true, name: "member", type: "address" },
      { indexed: true, name: "day", type: "uint64" },
      { indexed: false, name: "timestamp", type: "uint64" },
      { indexed: false, name: "currentStreak", type: "uint64" },
      { indexed: false, name: "totalCheckIns", type: "uint64" },
      { indexed: false, name: "note", type: "string" }
    ]
  }
] as const;
