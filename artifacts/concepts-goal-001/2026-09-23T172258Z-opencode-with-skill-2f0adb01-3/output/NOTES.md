# NOTES — running the onchain billing

## What was built

- `src/SubscriptionBilling.sol` — the whole billing system in one contract.
- `script/Deploy.s.sol` — Foundry deploy script (config via `.env`, see `.env.example`).
- `scripts/is-subscribed.mjs` — zero-dependency per-request check for your API backend.
- `test/` — 18 tests covering the full lifecycle (`forge test`).

## The one mental model that matters

**Nothing onchain runs by itself.** There is no cron, no monthly timer, no
background job inside the contract. Every state change happens because someone
sent a transaction and paid gas. So instead of "the contract charges $5 every
month" (which would require someone to poke it monthly, per customer), the
contract uses **continuous accrual**:

- Fees accrue per second against each customer's prepaid balance
  (`plan price / 30 days` per second).
- The *view* functions (`isActive`, `getAccount`) compute "balance minus
  accrued fees" on the fly, so they are always correct with zero maintenance.
- Actual bookkeeping (`settle`) is folded into every interaction the customer
  or you make. Nothing needs to happen on a schedule for the numbers to be right.

Consequence for your customers: billing is prorated to the second. Someone who
cancels halfway through the month gets exactly half their month back. That's
strictly fairer than Stripe's all-or-nothing month — mention it as a feature.

## Day to day

### Per-request check (your hot path)

```bash
RPC_URL=https://mainnet.base.org BILLING_CONTRACT=0xYourContract \
  node scripts/is-subscribed.mjs 0xCustomerAddress   # prints true / false
```

It's a plain `eth_call` — no gas, one RPC round trip. Any web3 library can do
the same: call `isActive(address)` on the contract. Cache the result for a few
seconds per address if RPC load matters; don't cache for minutes, because a
balance can lapse at any moment.

**Decide your failure mode now:** if your RPC provider is down, do you serve
the request (fail open) or reject it (fail closed)? For a hobby weather API,
fail open with a short-lived cache is probably fine.

### Collecting your revenue (your only recurring chore)

Accrued fees only become withdrawable once an account is *settled*. You are the
one incentivized to do this — it's your money. Run this on your own infra on
whatever cadence you like (weekly is plenty):

```bash
# 1. settle your subscriber list (from your DB of customer addresses)
cast send $BILLING_CONTRACT "settleMany(address[])" "[0xabc...,0xdef...]" \
  --rpc-url $RPC_URL --private-key $OWNER_KEY

# 2. sweep settled fees to the owner address
cast send $BILLING_CONTRACT "withdrawEarned()" \
  --rpc-url $RPC_URL --private-key $OWNER_KEY
```

Settling is permissionless and idempotent — anyone can call it, calling it
twice changes nothing, and skipping it for a month loses nothing (the money
sits safely in the contract either way).

### Customer lifecycle

1. Customer gets USDC, calls `usdc.approve(billing, amount)` — the classic
   "sign a check" pattern; they control the amount.
2. `topUp(amount)` — funds their prepaid balance.
3. `subscribe(1)` for hobby ($5/30d) or `subscribe(2)` for pro ($20/30d).
4. `cancel()` — stops billing, refunds unused balance in the same transaction.
5. `withdrawBalance()` — pulls out funds if they topped up but aren't subscribed.

There is no plan-switch function: switching plans = `cancel()` (refund) +
`topUp` + `subscribe(newPlan)`. Add a `changePlan` later if users ask.

### Changing prices

`setPlan(planId, newPrice)` from the owner account. **It applies to existing
subscribers from their next settlement**, not just new signups. That's a trust
point: you *can* raise prices on current customers (they can always cancel and
get refunded), but tell them before you do.

## What to keep an eye on

- **The owner key is the whole business.** It receives all revenue and can
  change prices. It's a plain EOA set immutably at deploy time — if it leaks,
  your revenue is gone; if you lose it, revenue is locked forever. For real
  money, deploy with a multisig (e.g. Safe) as the owner, or accept the risk
  consciously. There is deliberately no pause/freeze switch: you can't be
  tricked into bricking your customers, but you also can't stop the contract
  in an emergency.
- **Lapsed customers.** When a balance hits zero the subscription lapses:
  `isActive` goes false and the remainder (dust) is credited to you at the next
  settle. There is no automatic revival — the customer must `topUp` +
  `subscribe` again. If you want "your subscription is about to lapse" emails,
  that's an offchain job: poll `getAccount(address)` (returns live `balance`
  and `owed`) for your customer list and mail them. The contract will never
  notify anyone by itself.
- **USDC specifics.** 6 decimals, not 18 — all prices/amounts in the contract
  are in millionths of a dollar. USDC is centrally issued: Circle can freeze
  addresses, including this contract's. That's the trade-off for a stable
  dollar unit; it's the same trade-off Stripe makes for you today, just more
  visible.
- **Privacy.** Every customer's address, plan, balance, and top-up history is
  publicly visible on a block explorer. Don't put anything identifying onchain;
  keep the address↔customer mapping in your own DB.
- **RPC dependency.** Your per-request check is only as reliable as your RPC
  endpoint. Use a paid tier or run a light node; have a fallback URL.
- **Gas costs.** Customer actions (approve, topUp, subscribe, cancel) each cost
  a transaction. On Ethereum mainnet that's dollars; on an L2 like Base it's
  cents. Deploy on an L2. Real USDC addresses:
  Base `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`,
  mainnet `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`.
- **Bookkeeping.** Every meaningful action emits an event (`Subscribed`,
  `ToppedUp`, `Settled`, `Lapsed`, `Cancelled`, `EarnedWithdrawn`). Point an
  indexer or a simple log scraper at the contract for your revenue records.
- **Rounding.** Per-second accrual rounds down (in the customer's favor) by
  less than a millionth of a dollar per settlement. Irrelevant economically,
  but don't expect the numbers to match a spreadsheet to the last digit.
- **This contract is not audited.** The test suite covers the lifecycle
  (subscribe, accrue, cancel, lapse, settle, withdraw, solvency), but an audit
  is a point-in-time review, not a guarantee — and this hasn't even had that.
  Try it on a testnet or with small real amounts first.

## Deploying

```bash
cp .env.example .env   # fill in PRIVATE_KEY, USDC_ADDRESS, RPC_URL
source .env
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

Write the deployed address into `.env` as `BILLING_CONTRACT` and you're live.
