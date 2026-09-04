export const streakAbi = [
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { indexed: true, name: "member", type: "address" },
      { indexed: true, name: "day", type: "uint256" },
      { indexed: false, name: "note", type: "string" }
    ]
  }
] as const;
