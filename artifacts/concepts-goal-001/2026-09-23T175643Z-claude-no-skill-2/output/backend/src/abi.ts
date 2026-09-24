import {parseAbi} from 'viem'

/**
 * Hand-maintained read surface of SubscriptionBilling. Deliberately a small human-readable ABI
 * rather than an import from forge's `out/` directory: the backend deploys independently of the
 * contract build, and these signatures are the part that must stay stable.
 */
export const billingAbi = parseAbi([
  'function isSubscribed(address user) view returns (bool)',
  'function isSubscribedTo(address user, uint32 planId) view returns (bool)',
  'function areSubscribed(address[] users) view returns (bool[])',
  'function statusOf(address user) view returns ((bool subscribed, uint32 planId, uint64 expiresAt, uint256 balance, uint256 accrued))',
  'function expiresAt(address user) view returns (uint64)',
  'function balanceOf(address user) view returns (uint256)',
  'function accruedOf(address user) view returns (uint256)',
  'function earned() view returns (uint256)',
  'function totalCustomerBalance() view returns (uint256)',
  'function surplus() view returns (uint256)',
  'function paused() view returns (bool)',
  'function owner() view returns (address)',
  'function plans() view returns ((uint128 price, bool active)[])',
  'function settleMany(address[] users)',
  'function withdrawEarnings(address to, uint256 amount)',
  'event Subscribed(address indexed user, uint32 indexed planId, uint256 ratePerSecond, uint64 expiresAt)',
  'event Cancelled(address indexed user, uint32 indexed planId, uint256 refundableBalance)',
  'event Deposited(address indexed user, address indexed payer, uint256 amount, uint256 balance)',
  'event Withdrawn(address indexed user, address indexed to, uint256 amount, uint256 balance)',
  'event Settled(address indexed user, uint256 amount, uint256 balance)',
  'event Lapsed(address indexed user, uint32 indexed planId)',
])

export const PLAN = {hobby: 0, pro: 1} as const
export type PlanName = keyof typeof PLAN
