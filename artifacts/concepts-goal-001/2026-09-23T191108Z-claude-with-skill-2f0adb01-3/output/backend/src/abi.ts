/** Minimal ABI — only what the API backend reads. */
export const subscriptionBillingAbi = [
  {
    type: "function",
    name: "isSubscribed",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "subscribedUntil",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "accountOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "balance", type: "uint128" },
          { name: "planId", type: "uint64" },
          { name: "lastTick", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "pending",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "collected",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Subscribed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "planId", type: "uint256", indexed: true },
      { name: "subscribedUntil", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Cancelled",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "planId", type: "uint256", indexed: true },
      { name: "refundable", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "balance", type: "uint128", indexed: false },
    ],
  },
] as const;
