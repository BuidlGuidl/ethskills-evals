/** Hand-maintained subset of the SubscriptionBilling ABI used by the ops scripts.
 * Kept here rather than read from out/ so these scripts work without a build. */
export const BILLING_ABI = [
  { type: 'function', name: 'activeUntil', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'refundableOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'collectedRevenue', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalSubscriberBalance', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'solvencySurplus', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function', name: 'revenueIncluding', stateMutability: 'view',
    inputs: [{ name: 'accounts', type: 'address[]' }], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'accountOf', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'planId', type: 'uint16' }, { name: 'remaining', type: 'uint256' },
      { name: 'accrued', type: 'uint256' }, { name: 'until', type: 'uint256' },
      { name: 'active', type: 'bool' }, { name: 'ratePerSecond', type: 'uint64' },
    ],
  },
  { type: 'function', name: 'settle', stateMutability: 'nonpayable', inputs: [{ name: 'accounts', type: 'address[]' }], outputs: [] },
  {
    type: 'function', name: 'withdrawRevenue', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [],
  },
  {
    type: 'event', name: 'Subscribed',
    inputs: [
      { name: 'account', type: 'address', indexed: true }, { name: 'planId', type: 'uint16', indexed: true },
      { name: 'ratePerSecond', type: 'uint64', indexed: false }, { name: 'activeUntil', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'Deposited',
    inputs: [
      { name: 'account', type: 'address', indexed: true }, { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false }, { name: 'balance', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'Lapsed',
    inputs: [{ name: 'account', type: 'address', indexed: true }, { name: 'planId', type: 'uint16', indexed: true }],
  },
]
