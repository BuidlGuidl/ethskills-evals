/// Minimal ABI: only what the gateway reads. Keeping this narrow means a
/// contract upgrade that does not touch these signatures needs no backend change.
export const billingAbi = [
  {
    type: 'function',
    name: 'isSubscribed',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'entitlementOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'active', type: 'bool' },
      { name: 'plan', type: 'uint8' },
    ],
  },
  {
    type: 'function',
    name: 'statusOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'active', type: 'bool' },
          { name: 'plan', type: 'uint8' },
          { name: 'rate', type: 'uint128' },
          { name: 'periodEnd', type: 'uint64' },
          { name: 'expiresAt', type: 'uint64' },
          { name: 'credit', type: 'uint256' },
          { name: 'refundable', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'event',
    name: 'Cancelled',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'plan', type: 'uint8', indexed: true },
      { name: 'refunded', type: 'uint256', indexed: false },
      { name: 'forfeited', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Subscribed',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'plan', type: 'uint8', indexed: true },
      { name: 'rate', type: 'uint128', indexed: false },
      { name: 'periodStart', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Lapsed',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'plan', type: 'uint8', indexed: true },
      { name: 'at', type: 'uint64', indexed: false },
      { name: 'creditLeft', type: 'uint256', indexed: false },
    ],
  },
] as const
