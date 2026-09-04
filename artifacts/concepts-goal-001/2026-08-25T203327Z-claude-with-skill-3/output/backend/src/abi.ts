// Hand-written slice of the SubscriptionBilling ABI: only what the backend actually calls.
// Kept here rather than imported from out/ so this folder stands alone and stays readable.
export const billingAbi = [
  {
    type: "function",
    name: "isSubscribed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "accountOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "planId", type: "uint32" },
      { name: "balance", type: "uint256" },
      { name: "expiresAt", type: "uint256" },
      { name: "subscribed", type: "bool" },
    ],
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "balance", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "balance", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Subscribed",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "planId", type: "uint32", indexed: true },
      { name: "previousPlanId", type: "uint32", indexed: false },
      { name: "expiresAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Canceled",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "planId", type: "uint32", indexed: true },
      { name: "refundable", type: "uint256", indexed: false },
    ],
  },
] as const;
