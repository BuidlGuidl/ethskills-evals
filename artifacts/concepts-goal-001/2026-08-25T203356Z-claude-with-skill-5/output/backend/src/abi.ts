/**
 * The slice of SubscriptionBilling the API backend actually needs.
 *
 * Kept hand-written rather than imported from `out/` so the backend has no build-order
 * dependency on Foundry. Regenerate with:
 *   forge inspect SubscriptionBilling abi
 */
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
    name: "paidThrough",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "statusOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "active", type: "bool" },
      { name: "plan", type: "uint8" },
      { name: "balance", type: "uint256" },
      { name: "paidThroughAt", type: "uint64" },
      { name: "owed", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "AccountUpdated",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "plan", type: "uint8", indexed: false },
      { name: "balance", type: "uint128", indexed: false },
      { name: "paidThrough", type: "uint64", indexed: false },
    ],
  },
] as const;
