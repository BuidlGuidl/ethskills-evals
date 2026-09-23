# NOTES — running the onchain billing

## What this is

`src/SubscriptionManager.sol` — a prepaid USDC subscription contract:

- Customers **top up** a USDC balance (`deposit`), then **subscribe** to a plan
  (`HOBBY` = $5/30 days, `PRO` = $20/30 days).
- The first period is charged immediately at subscribe. Each further period is
  charged from the prepaid balance by `processPayment(user)` — **permissionless**,
  so anyone can trigger it; you run it as a keeper (see below).
- `cancel()` stops the subscription and refunds the **entire unused balance**.
  Periods already paid are not refunded (no proration — that's the policy;
  tell your users).
- If a balance can't cover a due charge, the subscription **lapses**. Leftover
  balance stays in the contract and remains withdrawable (`withdraw`/`cancel`).
- `isSubscribed(address)` is the backend check. It is a pure function of
  `paidThrough >= now`, so it is **accurate even if the keeper never runs**.

Solvency invariant (tested): contract USDC balance == sum(user balances) +
`collectedFees`. `sweepFees` can only ever touch `collectedFees`.

## Deploy

```bash
cp .env.example .env   # fill in PRIVATE_KEY, RPC_URL, USDC_ADDRESS
forge test             # 24 tests
source .env
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

Recommended chain: an L2 (Base) — deposits/charges are a few cents. USDC
addresses for Base and Base Sepolia are in `.env.example`. Deploy to Sepolia
first and run one full lifecycle before mainnet. If `USDC_ADDRESS` is empty the
script deploys a `MockUSDC` — **local Anvil only, never on a real network.**

## Day to day

### Backend: gating API requests

Per incoming request, `eth_call` `isSubscribed(customerAddress)` against your
RPC provider (Alchemy/QuickNode/self-hosted). It's a free read. Practical
setup:

- Cache the result for ~60s per address, or cache `paidThrough` and compare
  locally — invalidate on `Subscribed`/`Cancelled`/`SubscriptionLapsed` events.
- If you need plan tier (hobby vs pro rate limits), use
  `getAccount(address) → (planId, balance, paidThrough, subscribed)` in one call.
- Customers must tell you which address they paid from (sign a message with it
  once at signup to prove ownership — don't trust a bare address in a request).

### Keeper: collecting the monthly charges

`processPayment` / `processPayments(address[])` move money from user balances
to `collectedFees` when a period elapses. Run it on a cron (hourly or daily):

- Enumerate subscribers from `Subscribed` events (index them, e.g. a small DB
  or a subgraph), minus `Cancelled`/`SubscriptionLapsed`.
- **If the keeper goes down, nothing breaks for access control** —
  `isSubscribed` stays correct. What degrades: fees aren't collected into
  `collectedFees`, lapsed users aren't marked (their `planId` stays set until
  someone settles), and overdue charges pile up until the next settle. A user
  calling `withdraw` settles themselves first, so they can't dodge owed periods.
- Anyone can call it, so even a motivated user or a public keeper network
  (Gelato/Chainlink Automation) can be the fallback.

### Money out

`sweepFees(amount, to)` — owner only, bounded by `collectedFees`. User balances
are untouchable by design. Sweep to a dedicated treasury address, not the
deployer EOA, ideally a multisig (see "Keys" below).

### Plan changes

`setPlan(planId, price, period, active)` — owner only. Caveats:

- **A price change applies to existing subscribers at their next charge.**
  There is no grandfathering. Announce changes a full period ahead.
- `active=false` stops *new* subscriptions; existing ones keep renewing.
- Customers switch tiers by `cancel()` (refund) + `subscribe(newPlan)`.
  Their renewal anchor resets to the resubscribe time.
- Billing anchor: `paidThrough` advances in fixed `period` steps from the
  original subscribe time, so renewals don't drift with keeper timing.

## What to keep an eye on

- **`SubscriptionLapsed` events** = failed renewals (balance ran out). This is
  your churn/dunning signal — email the user to top up + resubscribe.
- **Keeper health**: alert if `processPayments` hasn't succeeded in >24h, and
  on the keeper wallet's gas balance.
- **USDC is a centralized, upgradeable, freezable token.** Circle can freeze
  addresses, and the token contract can be upgraded. If the contract or a user
  were frozen, funds would be stuck (not stealable, but immovable). That's the
  price of denominating in USDC; keep it in mind before scaling.
- **Owner key = the money key.** It controls plan prices and fee sweeps. Put
  ownership on a multisig (Safe) before real volume; `transferOwnership` is
  one step and irreversible if you fat-finger the address — double-check it.
- **No proration, by design.** Cancelling mid-month forfeits the current
  period. If users complain, that's a policy decision to revisit, not a bug.
- **Deposit UX is two transactions** (`approve` + `deposit`) the first time.
  Frontends usually hide this; account abstraction (smart wallets / paymasters)
  can make it one click and even sponsor gas.
- **Contract USDC balance vs. obligations**: the invariant above should always
  hold. Worth an occasional automated check (compare `usdc.balanceOf(contract)`
  against sum of balances + `collectedFees` from your indexer).
- **This code is unaudited.** Tests cover the lifecycle (24 cases, incl.
  lapse, resubscribe, solvency), but get an audit before holding meaningful
  customer funds. Reentrancy is guarded; external calls are only to USDC.

## Repo layout

```
src/SubscriptionManager.sol   the contract
script/Deploy.s.sol           deployment (reads PRIVATE_KEY, USDC_ADDRESS)
test/SubscriptionManager.t.sol  lifecycle tests
test/mocks/MockUSDC.sol       6-decimal test token (tests/local only)
.env.example                  config template
```
