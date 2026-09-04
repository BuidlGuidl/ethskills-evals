# Onchain subscription billing

USDC-denominated subscriptions for a small API service. Customers prepay, pick a tier,
stream it down second by second, and can walk away with the unused remainder at any time.
The API backend checks whether an address is currently subscribed on every request.

**[NOTES.md](./NOTES.md) is the document to read** — how this runs day to day, what to
watch, and what the design gives up. This file is just the map.

## Layout

```
src/SubscriptionBilling.sol   the contract: plans, deposits, streaming accrual, refunds
src/SafeTransfer.sol          USDC-tolerant transfer helpers
test/                         41 tests, including fuzzed solvency invariants
script/Deploy.s.sol           deploy with the $5 / $20 tiers
script/Sweep.s.sol            settle a batch and pull revenue to the treasury
backend/src/gate.ts           the per-request subscription check, cached on paidThrough
backend/src/auth.ts           proving the caller controls the address (sign-in + token)
backend/src/server.ts         worked example of the request path
backend/test/                 12 end-to-end tests against a live anvil chain
```

## How it works, in one paragraph

There is no monthly billing job, because a contract cannot run one — it only moves when
someone sends it a transaction. So the price streams: a balance drains at `price ÷ 30 days`
per second, and `isSubscribed(addr)` is a pure function of `block.timestamp` that turns
false the instant the money runs out, with no transaction from anyone. `settle()` just
writes down accrual that already happened, so the operator can collect on whatever
schedule suits them without ever risking missed revenue. Cancelling is a refund of exactly
the unconsumed remainder, to the second.

## Try it

```bash
forge test                    # contracts
cd backend && npm install && npm test    # backend against a local chain (needs anvil)
```

Deploy:

```bash
export TREASURY=0xYourTreasurySafe
forge script script/Deploy.s.sol --rpc-url https://mainnet.base.org --broadcast --verify
```

Deploy to an L2. At L1 mainnet gas prices a $5/month subscription can cost more in gas to
start than it does to buy — the numbers are in [NOTES.md §2](./NOTES.md).

## Contract surface

**Customers:** `deposit`, `depositFor`, `subscribe`, `depositAndSubscribe`, `cancel`,
`withdraw`, `cancelAndWithdraw`

**Anyone:** `settle`, `settleMany`, `withdrawRevenue` (always pays the treasury),
`isSubscribed`, `paidThrough`, `statusOf`, `withdrawable`, `revenueIncluding`

**Treasury:** `addPlan`, `closePlan`, `endSubscriptions`, `transferTreasury`

Plan prices are immutable once set — no one, including the operator, can raise the price
on an existing subscriber, and no one can withdraw a deposit the stream has not earned.
`endSubscriptions` can cut off access but never keeps the money; see
[NOTES.md §6](./NOTES.md).
