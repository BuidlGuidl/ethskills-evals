/// Minimal ABI — only the pieces the backend actually calls.
export const billingAbi = [
  {
    type: "function",
    name: "isActive",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "activeUntil",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "subscriptionOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "balance", type: "uint96" },
          { name: "lastSettledAt", type: "uint64" },
          { name: "remainder", type: "uint64" },
          { name: "planId", type: "uint16" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "revenueAccrued",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSubscriberBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "surplus",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "collectMany",
    stateMutability: "nonpayable",
    inputs: [{ name: "accounts", type: "address[]" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Subscribed",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "planId", type: "uint16", indexed: true },
      { name: "activeUntil", type: "uint256", indexed: false },
    ],
  },
] as const;
