import { parseAbi } from 'viem'

/**
 * The slice of SubscriptionBilling the backend actually uses. Hand-written rather than
 * imported from out/ so the service has no build-order dependency on Foundry artifacts.
 */
export const billingAbi = parseAbi([
  'function isSubscribed(address account) view returns (bool)',
  'function statusOf(address account) view returns (bool active, uint8 planId, uint64 activeUntil, uint256 balance, uint256 escrow)',
  'function areSubscribed(address[] accounts) view returns (bool[])',
  'function subscribedUntil(address account) view returns (uint64)',
  'function accruedRevenue() view returns (uint256)',
  'function customerFunds() view returns (uint256)',
  'function previewRevenue(address[] accounts) view returns (uint256)',
  'function settleMany(address[] accounts)',
  'function withdrawRevenue(address to, uint256 amount)',
  'event Subscribed(address indexed account, uint8 indexed planId, uint256 price, uint64 renewsAt)',
  'event Cancelled(address indexed account, uint8 indexed planId, uint256 refund, uint256 charged)',
  'event Lapsed(address indexed account, uint8 indexed planId, uint64 endedAt)',
  'event Renewed(address indexed account, uint8 indexed planId, uint32 periods, uint64 renewsAt)',
  'event Deposited(address indexed account, address indexed payer, uint256 amount, uint256 balance)',
])

/** Plan ids as deployed, and the service tier each one buys. */
export const PLANS = {
  1: { name: 'hobby', requestsPerDay: 10_000 },
  2: { name: 'pro', requestsPerDay: 250_000 },
}
