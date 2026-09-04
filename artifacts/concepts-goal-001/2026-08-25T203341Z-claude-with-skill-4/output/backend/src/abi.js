// Hand-maintained subset of SubscriptionBilling's ABI: the reads the gate needs and the events
// that tell it a cached answer just went stale. Regenerate the full thing with:
//   forge inspect SubscriptionBilling abi
export const billingAbi = [
  {
    type: "function",
    name: "statusOf",
    stateMutability: "view",
    inputs: [{name: "account", type: "address"}],
    outputs: [
      {name: "subscribed", type: "bool"},
      {name: "planId", type: "uint8"},
      {name: "expiry", type: "uint256"},
      {name: "refundable", type: "uint256"},
      {name: "ratePerPeriod", type: "uint64"},
    ],
  },
  {
    type: "function",
    name: "isSubscribed",
    stateMutability: "view",
    inputs: [{name: "account", type: "address"}],
    outputs: [{type: "bool"}],
  },
  {
    type: "function",
    name: "pendingOfMany",
    stateMutability: "view",
    inputs: [{name: "accounts", type: "address[]"}],
    outputs: [{name: "total", type: "uint256"}],
  },
  {type: "function", name: "claimable", stateMutability: "view", inputs: [], outputs: [{type: "uint256"}]},
  {
    type: "event",
    name: "Subscribed",
    inputs: [
      {name: "account", type: "address", indexed: true},
      {name: "planId", type: "uint8", indexed: true},
      {name: "ratePerPeriod", type: "uint64", indexed: false},
    ],
  },
  {
    type: "event",
    name: "ToppedUp",
    inputs: [
      {name: "account", type: "address", indexed: true},
      {name: "payer", type: "address", indexed: true},
      {name: "amount", type: "uint256", indexed: false},
      {name: "expiresAt", type: "uint40", indexed: false},
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      {name: "account", type: "address", indexed: true},
      {name: "to", type: "address", indexed: true},
      {name: "amount", type: "uint256", indexed: false},
    ],
  },
  {
    type: "event",
    name: "Cancelled",
    inputs: [
      {name: "account", type: "address", indexed: true},
      {name: "planId", type: "uint8", indexed: true},
      {name: "refunded", type: "uint256", indexed: false},
    ],
  },
  {
    type: "event",
    name: "PlanChanged",
    inputs: [
      {name: "account", type: "address", indexed: true},
      {name: "fromPlanId", type: "uint8", indexed: true},
      {name: "toPlanId", type: "uint8", indexed: true},
      {name: "ratePerPeriod", type: "uint64", indexed: false},
    ],
  },
];

// Events that can change whether a given address is subscribed, or until when.
export const ACCOUNT_EVENTS = ["Subscribed", "ToppedUp", "Withdrawn", "Cancelled", "PlanChanged"];
