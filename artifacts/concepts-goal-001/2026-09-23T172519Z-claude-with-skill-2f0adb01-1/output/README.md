# Onchain subscription billing

USDC subscription billing for an API service. Customers prepay, pick a plan,
cancel whenever and get back what they have not used. Your backend checks
"is this address paid up?" with a free `eth_call`.

**Read [NOTES.md](./NOTES.md)** for how it runs once deployed and what to
monitor — including the tradeoffs versus Stripe and the privacy implications
you should pass on to your customers.

## Layout

```
src/
  SubscriptionBilling.sol   the contract — all billing logic
  IERC20.sol                minimal token interface + safe transfer helpers
script/
  Deploy.s.sol              deploy + create the $5/$20 plans
  CreatePlan.s.sol          add a plan (this is how you reprice)
  Collect.s.sol             sweep earned revenue to the treasury
  Vm.sol                    the cheatcode interface, declared locally
test/
  SubscriptionBilling.t.sol      lifecycle, edge cases, operator limits
  SubscriptionBillingFuzz.t.sol  solvency + refund properties
  TestBase.sol, MockUSDC.sol     local test harness
backend/src/
  subscriptionGate.ts       the per-request check, with caching
  auth.ts                   prove an address belongs to the caller
  middleware.ts             Express-style gate
  sweep.ts                  settle subscribers, monthly
  health.ts                 solvency monitoring
```

There are **no external Solidity dependencies** — nothing is installed under
`lib/`, and `forge build` works offline. The token interface, ownership,
assertions and cheatcode bindings are all small enough to declare directly, and
this way every line the contract relies on is in this repo and reviewable.

## Quickstart

```bash
forge test                  # 27 contract tests, including fuzz

cd backend && npm install && npm test   # 6 gate tests
```

Deploying is in [NOTES.md](./NOTES.md#deploying).

## How billing works

Balances drain continuously rather than being charged on a schedule, because
onchain there is nothing to run a schedule. $5 of balance buys one month of
hobby; topping up extends the runway; the refund on cancellation is
`balance − accrued`, prorated to the second.

```solidity
accrued = elapsed * pricePerMonth / 30 days;   // capped at balance
isActive = planId != 0 && accrued < balance;
refund   = balance - accrued;
```

That removes the renewal transaction entirely — there is no monthly job that can
fail, and no state that can drift out of sync with a payment processor.

## What the operator can't do

By construction, not by policy: touch an unspent subscriber balance, reprice a
plan someone is already on, cancel or block a subscriber, pause the contract, or
prevent a withdrawal. There is no admin pause and no upgrade path — see
[NOTES.md](./NOTES.md#known-sharp-edges) for why, and what to do if you find a
bug.
