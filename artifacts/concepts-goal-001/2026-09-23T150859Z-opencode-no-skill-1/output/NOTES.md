# NOTES — WeatherBilling, day to day

## How the billing model works (read this first)

One contract, `src/WeatherBilling.sol`, holds prepaid USDC and meters
subscriptions per second. There is no Stripe-style monthly invoice; instead:

- A customer deposits USDC with `topUp(amount)` (they `approve` the billing
  contract first) and picks a plan with `setPlan(Hobby)` or `setPlan(Pro)`.
- Their balance drains continuously at `price / 30 days` per second. A "month"
  is a fixed 30-day billing period, and prices are stored in USDC's native
  6-decimal units ($5 = `5000000`).
- As long as `balance > 0`, `isSubscribed(user)` is true. The moment their
  balance runs out, they're unsubscribed — never charged a cent more than they
  deposited, and never charged for time after the money ran out.
- `cancel()` refunds the entire remaining balance, which **is** the prorated
  refund by construction: money they haven't used is still sitting in their
  balance. No operator involvement, no support tickets.
- If they top up again after running dry, the clock restarts at the new
  deposit — downtime between exhaustion and top-up is never billed.

Settlement is **lazy**: charges are only written to storage when someone calls
`settle(user)` (or the user acts — `topUp`/`setPlan`/`cancel` all settle
first). But `isSubscribed` computes the answer live from timestamps, so the
backend can always trust it even if nobody has settled for weeks. This is why
there is no mandatory keeper and no cron dependency for correctness.

Money accounting is strict:

- `totalEarned` = fees recognized so far, withdrawable by you.
- Customers' prepaid balances are *their* money. `withdrawEarned` can never
  touch them, and there is no other exit for funds. The invariant
  `usdc.balanceOf(billing) == totalEarned + sum(customer balances)` holds at
  all times and is asserted in the test suite.
- The contract is deliberately not upgradeable and has no admin path to
  customer funds. The owner key controls three things only: withdrawing earned
  fees, changing prices for new plan selections, and transferring ownership.

## The per-request backend check

`isSubscribed(address)` is a `view` function — call it with `eth_call`, which
costs no gas and doesn't need a signature. Plan IDs: `1` = Hobby, `2` = Pro.

```
cast call $BILLING "isSubscribed(address)(bool)" $USER --rpc-url $RPC
```

From your API (any ethers/viem-style library):

```js
const subscribed = await billing.isSubscribed(userAddress)
if (!subscribed) return respond(402, "top up at <billing portal>")
```

- At $5/month, a customer's balance drains at ~$0.0000019 per second, so
  caching the result for 30–60 seconds is completely safe and cuts RPC load
  massively. Use the request's sender address (or whatever address you bind
  to API keys) as the cache key.
- `getAccount(user)` returns the full picture (plan, locked-in price, balance,
  live amount owed, subscribed flag) if you want richer 402 bodies.
- `secondsRemaining(user)` is handy for a `X-Billing-Seconds-Remaining`
  response header or "top up soon" emails — churn here is otherwise silent
  (their balance just hits zero and requests start failing).

## Deploying

Foundry stack. Env vars for `script/DeployWeatherBilling.s.sol`:

| Variable         | Required | Meaning                                              |
|------------------|----------|------------------------------------------------------|
| `PRIVATE_KEY`    | yes      | deployer key (pays gas)                              |
| `USDC_ADDRESS`   | mainnet  | USDC contract; if unset, a `MockUSDC` is deployed instead (local/testnet only!) |
| `OWNER_ADDRESS`  | no       | defaults to deployer; set to your ops/treasury wallet |
| `HOBBY_PRICE`    | no       | default 5000000 ($5 per 30d, 6 dp)                    |
| `PRO_PRICE`      | no       | default 20000000 ($20 per 30d, 6 dp)                 |

```bash
# Local dry run (fresh anvil, auto-deploys mock USDC):
anvil &
PRIVATE_KEY=<anvil key 0> forge script script/DeployWeatherBilling.s.sol \
  --rpc-url http://127.0.0.1:8545 --broadcast

# Testnet (Base Sepolia):
PRIVATE_KEY=... forge script script/DeployWeatherBilling.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC --broadcast --verify

# Mainnet — Base is the sensible chain for this (cheap customer txs,
# native USDC). ALWAYS pass the real USDC address:
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
OWNER_ADDRESS=<treasury> PRIVATE_KEY=... \
forge script script/DeployWeatherBilling.s.sol \
  --rpc-url $BASE_RPC --broadcast --verify
```

(If you'd rather bill on Ethereum mainnet, USDC is
`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` — but per-request `eth_call`s
and customer top-ups are far cheaper on Base.)

After deploying, record both addresses (billing + USDC) in your config and
**verify them against the deployment logs** — the billing contract pins the
USDC address immutably; deploying pointed at the wrong token means redeploy.

Use a dedicated owner wallet (hardware wallet or Safe). It can only move
earned fees and edit prices, but treat it well anyway.

## Day-to-day running

**Collecting revenue.** Fees only move into `totalEarned` when someone
settles. Run a small keeper (a cron job with `cast` is enough) once a day or
once a week:

```bash
# users = addresses seen in TopUp/PlanSet events, e.g.
#   cast logs "TopUp(address,uint256)" --address $BILLING --from-block <n>
cast send $BILLING "settleMany(address[])" "[<addr1>,<addr2>,...]" \
  --private-key $KEEPER_PK --rpc-url $RPC

# then sweep revenue:
cast send $BILLING "withdrawEarned(uint256)" <amount> \
  --private-key $OWNER_PK --rpc-url $RPC
```

`settle`/`settleMany` are permissionless — anyone can call them for anyone,
which also makes Gelato/Chainlink Automation a drop-in replacement for your
cron if you'd rather not run infra. Keep the address list from your event
indexer; settling is idempotent and costs a little gas per stale account, so
prune addresses that have already exhausted/cancelled.

**Refunds.** Fully self-serve (`cancel()`), no action from you.

**Price changes.** `setPrices` only affects *new* plan selections: existing
subscribers keep the price they locked in until they next call `setPlan`
(re-selecting re-snapshots to current prices) or cancel and re-subscribe.
To migrate everyone to a new price: announce, have users re-call
`setPlan(...)`, and reconcile expectations — you cannot force a
mid-subscription price change, which is exactly what your customers would
want to hear.

**Upgrades / incidents.** The contract is immutable by design. If you ever
need v2: deploy the new contract, point new signups there, stop sending
traffic to the old one, and let customers `cancel()` for full refunds (the
old contract stays solvent through the drain-down).

## What to keep an eye on

1. **Solvency invariant.** `usdc.balanceOf($BILLING)` should always equal
   `totalEarned()` plus the sum of live customer balances (your keeper's
   settle output gives you the pieces). The tests assert this; a dashboard
   comparing the contract's USDC balance against your indexed sum of
   (earned + balances) is a cheap canary for "something is deeply wrong".
2. **Revenue reconciliation.** `totalEarned` growth per week vs. expected
   MRR (active subscribers × price). A shrinking gap between expected and
   settled revenue usually means your keeper died — check its heartbeat
   (last `Settled` event block age). If you *don't* run a keeper, revenue
   recognition just lags; that's fine, but know which mode you're in.
3. **Churn.** `TopUp` event rate is your growth signal; subscriptions dying
   show up as `Settled` events that zero a balance (or a `secondsRemaining`
   histogram trending toward 0). Nothing in the contract notifies anyone —
   consider a "low balance" email from `secondsRemaining`.
4. **Failed cancels.** A `cancel()` can revert if USDC itself refuses the
   transfer (e.g., the customer is on Circle's blacklist). Watch reverted
   `Cancelled` transactions — those customers' funds are stuck until USDC
   lets the transfer through; nothing you can do contract-side, but they
   will email you.
5. **USDC address pinning.** Double-check `usdc()` on the deployed contract
   against the canonical USDC for your chain before announcing the billing
   address to customers. It's immutable after deploy.
6. **Owner key hygiene.** Rotate with `transferOwnership` if you ever
   suspect the key; the blast radius is limited to earned fees + price
   config, but rotation is one cheap transaction.
7. **Gas/UX of customer transactions.** `topUp` + `setPlan` are two
   transactions (~two approvals for the customer: USDC approve + topUp).
   If onboarding friction shows up, a tiny façade contract bundling
   `approve`-via-permit + `topUp` + `setPlan` is a compatible, optional v1.1.

## Rounding & edge-case policy (for support answers)

- A "month" is 30 days, always. Calendar months aren't billed.
- Charging is per-second, floor-rounded to 1 wei of USDC (i.e. 1e-6 of a
  cent). Sub-cent accrued time carries forward — never forgiven, never
  double-billed.
- If a balance can't cover the full elapsed period, service stops at the
  exact second the money ran out; the entire remaining balance (including
  any sub-second dust) is recognized as earned, and nothing further is owed.
- Money deposited without picking a plan sits idle (not subscribed, no
  accrual) until `setPlan` is called; `cancel()` returns it in full.
- Plan switches settle at the old price up to that moment and the new price
  after — no double-charging across the boundary.

## Testing

```bash
forge build && forge test -vvv
```

24 tests cover: constructor validation, full lifecycle, exhaustion
semantics (no charging past zero, no charging for gaps), prorated cancel
refunds, plan switches mid-cycle, price grandfathering, keeper batch
settlement, live `isSubscribed` under stale state, withdrawal limits
(earned only, owner only), a reentrancy attack on `topUp`, and the
contract-solvency invariant. `forge fmt` is the formatter; run it before
committing.
