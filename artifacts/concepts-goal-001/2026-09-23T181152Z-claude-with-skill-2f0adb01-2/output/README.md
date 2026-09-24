# Onchain subscription billing

USDC subscription billing for an API service. Customers prepay, pick a plan, and
are billed per 30-day period until they cancel; cancelling refunds the unused
remainder prorated to the second. The API backend checks entitlement with a
single read-only call.

**[NOTES.md](./NOTES.md) is the document to read** — how this runs day to day,
what to monitor, and the trade-offs baked into the design.

## Quick start

```bash
forge test                      # 37 tests: unit, fuzz, stateful invariants
cd backend && npm install && npm run typecheck
```

Deploy (Base):

```bash
export OWNER=0xYourSafe PAYOUT_ADDRESS=0xYourWallet
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```

## The design in one paragraph

Contracts can't run on a timer, so "charge them every month" needs someone to
send a transaction. This splits entitlement from settlement: **entitlement is
computed** — `isSubscribed()` is a pure view over funds already deposited, and is
correct even if nobody has touched the contract in a year — while **settlement is
poked** by anyone via `settle()`, which converts elapsed periods into withdrawable
revenue. Your API gateway therefore never depends on a keeper being alive, and a
settlement job that's weeks late costs you nothing but delayed cash flow.

The owner can add and retire plans and change the payout address. The owner
cannot pause the contract, cancel a customer, or reach a customer's deposit —
there is no code path to it. Customers can always cancel and withdraw, including
if the owner key is lost.

## Layout

| Path | What |
|---|---|
| `src/SubscriptionBilling.sol` | The contract |
| `src/ISubscriptionBilling.sol` | Three-function read interface for the gateway |
| `script/Deploy.s.sol` | Deploy + seed the $5 / $20 plans |
| `script/Settle.s.sol` | Settle a batch and sweep revenue from the CLI |
| `test/` | Unit, fuzz and stateful invariant tests |
| `backend/src/gateway.ts` | Example API gated on `isSubscribed` |
| `backend/src/auth.ts` | Wallet signature → bearer token (EOA + Safe) |
| `backend/src/keeper.ts` | The settlement cron job |

## Core interface

| Call | Who | Does |
|---|---|---|
| `deposit(amount)` | customer | Top up (needs USDC approval first) |
| `subscribe(planId)` | customer | Start; buys the first period up front |
| `changePlan(id)` | customer | Prorated refund, then a fresh period |
| `cancel()` / `cancelAndWithdrawAll()` | customer | Refund unused time, exit |
| `withdraw(amount)` | customer | Always available, no admin gate |
| `isSubscribed(addr)` | backend | The per-request check |
| `periodsOfRunway(addr)` | backend | Months of deposit left — use for dunning |
| `settle(addr)` / `settleMany(addrs)` | anyone | Recognise elapsed revenue |
| `withdrawRevenue(amount)` | anyone | Sweeps to the fixed payout address |

Not audited. See NOTES.md §8 before it holds real money.
