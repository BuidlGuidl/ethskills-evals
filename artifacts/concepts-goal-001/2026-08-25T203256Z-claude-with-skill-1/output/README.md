# Onchain billing for the weather API

USDC subscriptions with no payment processor: customers prepay, pick a plan, and the API checks
the chain to decide whether to serve them. Cancelling is instant and refunds the unused part.

**[NOTES.md](./NOTES.md) is the one to read** — how this runs once it is live, what to watch,
and what the design gives up compared to Stripe.

## The one idea

There is no cron job charging people monthly, because a contract cannot run one. Nothing onchain
moves unless somebody sends a transaction and pays for it.

So nobody is ever *charged*. A subscription is a **rate running against a prepaid balance from a
timestamp**, and what a customer owes at any instant is arithmetic on `block.timestamp`:

```
owed = ratePerPeriod × (now − lastSettled) / 30 days     (capped at balance)
```

Everything the product needs falls out of that line, with no scheduled transaction anywhere:

| Requirement | How it works | Who sends a transaction |
| --- | --- | --- |
| Top up with USDC | `deposit` / `subscribeWithDeposit` | the customer |
| Pick a plan | `subscribe(planId)` | the customer |
| Charged monthly | the balance drains at the monthly rate | **nobody** |
| Cancel any time, refund the unused part | it was never spent — `closeAccount` | the customer |
| Lapse when the money runs out | the accrual is capped at the balance | **nobody** |
| Is this address subscribed? | `isActive(address)`, a free view call | **nobody** |

The operator's only recurring action is `settleAndCollect`, which moves already-earned revenue
into their wallet. Skipping it for a year changes nothing about who is owed what.

## Layout

```
src/SubscriptionBilling.sol   the contract — accounting, plans, escrow
src/SafeTransfer.sol          ERC-20 calls that fail loudly (no external dependencies)
test/                         unit tests, fuzz tests, stateful invariants, gas measurements
script/Deploy.s.sol           deployment, with per-chain USDC addresses baked in
script/Ops.s.sol              collect revenue, change a plan, check solvency
backend/src/gate.ts           the per-request subscription check, cached and batched
backend/src/auth.ts           proving an API caller controls an address
backend/src/subscribers.ts    rebuilding the subscriber list from the event log
backend/src/server.ts         a runnable sketch of the gated API
```

## Quickstart

```bash
forge install foundry-rs/forge-std   # only external dependency, and only for tests
make test                            # 44 contract tests incl. 5 stateful invariants
make gas                             # what a signup costs your customers

anvil &
forge script script/LocalDev.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

cd backend && npm install && npm test # gate tested against a real contract on anvil
```

Deploying: fill in `.env` from `.env.example`, then `make deploy-testnet`, then
`make deploy-mainnet`. The mainnet checklist is at the top of NOTES.md.

## Plans

Seeded at deploy time and changeable afterwards with `make setPlan`:

| id | plan | price |
| --- | --- | --- |
| 1 | hobby | $5 per 30 days |
| 2 | pro | $20 per 30 days |

"Monthly" is a fixed 30 days, not a calendar month — 12.17 charges a year, not 12. Repricing a
plan only affects people who subscribe *after* the change; existing subscribers keep the rate
they signed up at.
