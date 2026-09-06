// The slice of the SubscriptionBilling ABI a backend needs. Read-only except for nothing —
// your API server never sends a transaction and should never hold a key.
export const subscriptionBillingAbi = [
  {
    type: "function",
    name: "isSubscribed",
    stateMutability: "view",
    inputs: [{name: "subscriber", type: "address"}],
    outputs: [{type: "bool"}],
  },
  {
    type: "function",
    name: "paidThrough",
    stateMutability: "view",
    inputs: [{name: "subscriber", type: "address"}],
    outputs: [{type: "uint256"}],
  },
  {
    type: "function",
    name: "accountOf",
    stateMutability: "view",
    inputs: [{name: "subscriber", type: "address"}],
    outputs: [
      {name: "planId", type: "uint256"},
      {name: "pricePerPeriod", type: "uint256"},
      {name: "balance", type: "uint256"},
      {name: "unusedBalance", type: "uint256"},
      {name: "activeUntil", type: "uint256"},
      {name: "active", type: "bool"},
    ],
  },
  {
    type: "event",
    name: "Subscribed",
    inputs: [
      {name: "subscriber", type: "address", indexed: true},
      {name: "planId", type: "uint256", indexed: true},
      {name: "deposited", type: "uint256", indexed: false},
      {name: "balance", type: "uint256", indexed: false},
    ],
  },
  {
    type: "event",
    name: "ToppedUp",
    inputs: [
      {name: "subscriber", type: "address", indexed: true},
      {name: "amount", type: "uint256", indexed: false},
      {name: "balance", type: "uint256", indexed: false},
    ],
  },
  {
    type: "event",
    name: "Cancelled",
    inputs: [
      {name: "subscriber", type: "address", indexed: true},
      {name: "planId", type: "uint256", indexed: true},
      {name: "refunded", type: "uint256", indexed: false},
    ],
  },
];
