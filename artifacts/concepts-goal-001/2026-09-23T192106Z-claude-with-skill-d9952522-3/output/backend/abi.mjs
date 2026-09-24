// The slice of the contract ABI the API backend needs. Kept inline on purpose: the
// backend should not depend on Foundry's out/ directory being present at runtime.
export const subscriptionsAbi = [
  {
    type: "function",
    name: "isSubscribed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "statusOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "active", type: "bool" },
      { name: "planId", type: "uint32" },
      { name: "expiry", type: "uint64" },
      { name: "balance", type: "uint256" },
      { name: "owed", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "statusOfMany",
    stateMutability: "view",
    inputs: [{ name: "accountList", type: "address[]" }],
    outputs: [
      { name: "active", type: "bool[]" },
      { name: "planIds", type: "uint32[]" },
      { name: "expiries", type: "uint64[]" },
    ],
  },
  {
    type: "function",
    name: "pendingRevenue",
    stateMutability: "view",
    inputs: [{ name: "accountList", type: "address[]" }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "earned", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalDeposits", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "event",
    name: "Subscribed",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "planId", type: "uint32", indexed: true },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Canceled",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "refund", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ToppedUp",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
];
