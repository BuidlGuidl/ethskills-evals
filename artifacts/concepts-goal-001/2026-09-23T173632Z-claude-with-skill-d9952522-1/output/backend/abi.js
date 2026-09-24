// Minimal ABI: only what the API backend actually calls.
export const subscriptionBillingAbi = [
  {
    type: "function",
    name: "isSubscribed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "expiresAt",
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
      { name: "active", type: "bool" },
      { name: "planId", type: "uint32" },
      { name: "pricePerMonth", type: "uint256" },
      { name: "balance", type: "uint256" },
      { name: "expiry", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "areSubscribed",
    stateMutability: "view",
    inputs: [{ name: "accounts", type: "address[]" }],
    outputs: [{ type: "bool[]" }],
  },
];
