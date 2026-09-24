/**
 * Hand-written minimal ABI. Only the pieces the backend actually touches, so the
 * gateway does not carry the full artifact around.
 *
 * Keep in sync with src/SubscriptionBilling.sol. `forge inspect SubscriptionBilling abi`
 * prints the full one if you need more.
 */
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
    name: "planOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "planId", type: "uint32" }],
  },
  {
    type: "function",
    name: "entitledUntil",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "periodsOfRunway",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "accountOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "balance", type: "uint128" },
          { name: "periodPrice", type: "uint128" },
          { name: "periodStart", type: "uint64" },
          { name: "paidThrough", type: "uint64" },
          { name: "planId", type: "uint32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "settleMany",
    stateMutability: "nonpayable",
    inputs: [{ name: "accounts", type: "address[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawRevenue",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawableRevenue",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalCustomerBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalEscrowed",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Subscribed",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "planId", type: "uint32", indexed: true },
      { name: "price", type: "uint128", indexed: false },
      { name: "paidThrough", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Cancelled",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "planId", type: "uint32", indexed: true },
      { name: "refunded", type: "uint256", indexed: false },
      { name: "earned", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Lapsed",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "planId", type: "uint32", indexed: true },
      { name: "endedAt", type: "uint64", indexed: false },
    ],
  },
] as const;
