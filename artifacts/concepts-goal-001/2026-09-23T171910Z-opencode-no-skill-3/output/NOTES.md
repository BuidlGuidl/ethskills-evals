# NOTES — onchain subscription billing, day to day

This repo is a complete replacement for the Stripe part of your API service:

- `src/ApiBilling.sol` — the billing contract. Customers escrow USDC, pick the
  $5/month (hobby) or $20/month (pro) plan, are charged monthly out of their
  escrow, can cancel any time for a per-second prorated refund, and your
  backend can ask the chain "is address X subscribed right now?" with a single
  read-only call.
- `test/ApiBilling.t.sol` — 29 tests covering the money math, refund
  prorating, lapse handling, prepay caps, and the invariant that customer
  escrow can never be paid out as revenue.
- `script/Deploy.s.sol` — production deploy (reads `.env`).
- `script/Local.s.sol` — deploys the contract plus a mock USDC on a local
  anvil chain so you can rehearse everything for free.
- `scripts/check.sh` — CLI: "is this address subscribed?"
- `scripts/keeper.sh` — CLI: settles lapsed subscriptions so revenue becomes
  withdrawable.

Stack: [Foundry](https://getfoundry.sh) (forge/cast/anvil), no Solidity
dependencies, so `lib/` stays empty. Build and test with `make build` /
`make test`.

## How the model works

- A customer **tops up**: they `approve()` USDC to the contract once, then
  call `topUp(amount)`. The USDC sits in the contract as that customer's
  **credit**. Credit is always withdrawable by the customer (`withdraw`).
- A customer **subscribes** to plan 1 (hobby, $5/30 days) or plan 2 (pro,
  $20/30 days). The contract immediately pulls whole 30-day periods out of
  their credit and sets `subscribedUntil`. One big top-up prepays several
  months at once, capped at 12 months of runway (`MAX_PREPAID_MONTHS`) —
  the rest stays as withdrawable credit. A "month" is a fixed 30 days
  (12 periods = 360 days, not a calendar year).
- **Renewal is automatic**: any `topUp` or `settle` while the subscription is
  active extends the runway from credit. If credit runs out, the subscription
  simply ends when `subscribedUntil` passes (a `Lapsed` event fires once
  settled). No card, no retry loop, no dunning.
- **`isSubscribed(addr)` is `subscribedUntil > block.timestamp`** — a pure
  timestamp comparison. It is correct without any keeper or pending
  transaction; the chain itself is the source of truth for "is this customer
  paid up".
- **Cancel** refunds the unused portion of paid time, prorated to the second
  (`fee * (subscribedUntil - now) / 30 days`), plus all remaining credit. If
  they subscribed and cancel in the same block they get 100% back. A lapse
  is just a cancel nobody showed up for; the money the customer is owed
  (credit + prepaid-but-unconsumed) is tracked in `totalUserFunds`.
- **Revenue** for you is everything in the contract that is not customer
  funds: `revenueAvailable() = USDC balance − totalUserFunds`. It becomes
  withdrawable lazily, when the lapsed period is settled (by the customer
  interacting, or by your keeper calling `settle`). `settle` is permissionless
  — anyone can run it, it only ever does what the schedule says.
- Prices are **fixed at deploy**. There is deliberately no admin function to
  change fees, pause subscriptions, or touch customer credit — the only
  owner powers are withdrawing earned revenue and transferring ownership.
  To change prices, deploy a new contract (see "Price changes" below).

## Deploy runbook

1. Pick a chain with cheap gas — this is a many-small-transactions product.
   Base, Arbitrum One, Optimism, or Polygon all work. Use **native Circle
   USDC** (6 decimals), not a bridged clone: on Polygon, `USDC.e` is a
   different token than native USDC. Well-known native USDC addresses are
   `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` (Ethereum) and
   `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base) — re-verify against
   Circle's official docs before you deploy; a wrong token address is the one
   mistake here that is annoying to undo.
2. `cp .env.example .env` and fill in: `RPC_URL` (an L2 endpoint),
   `PRIVATE_KEY` (the deploy key), `OWNER_ADDRESS` (holds revenue + admin),
   `USDC_ADDRESS` (verified above), fees (defaults: `5000000`,
   `20000000` = $5 / $20 in 6-decimal USDC).
3. `make deploy` — this runs `forge script script/Deploy.s.sol --broadcast`.
   Copy the printed contract address into `.env` as `BILLING_ADDRESS`.
4. Verify the source on the block explorer
   (`forge verify-contract --help` for your chain's verifier flags) — do
   this before onboarding customers; a verified contract is your storefront.
5. Rehearse locally first if you like: `anvil` in one shell, then
   `make RPC_URL=http://127.0.0.1:8545 local`, then mint yourself mock USDC
   with `cast send $USDC 'mint(address,uint256)' $YOU 50000000`.

## Customer flows (what you'll paste into docs or a wallet UI)

For a customer `$C` with key `$K`, billing at `$BILLING`, USDC at `$USDC`:

```bash
# once: allow the billing contract to pull USDC (say $500 worth)
cast send $USDC "approve(address,uint256)" $BILLING 500000000 \
  --rpc-url $RPC_URL --private-key $K

# top up $10 of credit
cast send $BILLING "topUp(uint256)" 10000000 \
  --rpc-url $RPC_URL --private-key $K

# subscribe: 1 = $5 hobby, 2 = $20 pro
cast send $BILLING "subscribe(uint8)" 1 \
  --rpc-url $RPC_URL --private-key $K

# check status (plan, paid-through timestamp, prepaid periods, credit)
cast call $BILLING "getSubscription(address)(uint8,uint64,uint16,uint256)" $C
cast call $BILLING "isSubscribed(address)(bool)" $C

# cancel: prorated refund of unused time + all credit, in one call
cast send $BILLING "cancel()" --rpc-url $RPC_URL --private-key $K

# withdraw credit without cancelling
cast send $BILLING "withdraw(uint256)" 1000000 \
  --rpc-url $RPC_URL --private-key $K
```

Notes for support docs:

- `subscribe` requires at least one month of credit already escrowed —
  top up first, then subscribe. If a subscription **lapsed** (credit ran
  out), topping up does **not** auto-resubscribe; the customer calls
  `subscribe(planId)` again. That's deliberate — nobody is ever charged
  again without an explicit act.
- To switch plans: `cancel()` then `subscribe(newPlan)`. Cancel refunds
  everything unused, so there is no proration headache.
- Money can sit in three states: credit (theirs, withdrawable any time),
  prepaid time (theirs until the second it's consumed), and revenue (yours,
  after it's consumed). Every state is a public view function.

## Backend: per-request subscription check

`isSubscribed(address)` returns a bool, costs no gas, and is a plain
`eth_call`. Function selector: `0xb92ae87c`. Raw call for address
`0x7099...e0d17dc79c8`:
`data = 0xb92ae87c00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8`.

curl, no libraries:

```bash
curl -s $RPC_URL -X POST -H 'Content-Type: application/json' -d '{
  "jsonrpc":"2.0","id":1,"method":"eth_call",
  "params":[{"to":"<BILLING_ADDRESS>",
             "data":"0xb92ae87c000000000000000000000000<ADDRESS_NO_0X_PADDED_TO_64>"},
            "latest"]
}'
# result "0x0000000000000000000000000000000000000000000000000000000000000001" = subscribed
```

Node (zero dependencies), for an auth middleware:

```js
async function isSubscribed(rpc, billing, customer) {
  const data =
    "0xb92ae87c" + customer.slice(2).toLowerCase().padStart(64, "0");
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "eth_call",
      params: [{ to: billing, data }, "latest"],
    }),
  });
  const { result } = await res.json();
  return BigInt(result) === 1n;
}
```

Operational advice for the check itself:

- A read per request is fine at hobby scale (public L2 RPCs or a free
  Alchemy/QuickNode tier handle thousands of these per minute), but cache
  the answer for 5–30 seconds per address — subscription changes are rare
  and always downgrade-to-unsubscribed-safe.
- **Fail closed**: if the RPC errors or times out, treat the caller as
  unsubscribed (503/403), never as subscribed. You don't lose money by
  being strict for a minute; you can by being generous.
- The returned bool reflects chain state at the `latest` block. There is no
  "processing" state — `topUp`/`subscribe` are confirmed synchronously in the
  wallet, so "I just paid, why 403" almost always means the tx isn't mined
  yet (a few seconds).

For dashboards and the keeper list, index these events:
`Subscribed(user, planId, startsAt)`, `Charged(user, planId, months, fee,
subscribedUntil)`, `Lapsed(user, subscribedUntil)`, `Cancelled(user,
refund)`, `TopUp(user, amount, credited, credit)`, `Withdrawn(user,
amount)`. Anyone who has ever emitted `Subscribed` and hasn't emitted
`Cancelled` afterwards belongs in your settle list (settling an
already-lapsed-and-settled address is a cheap no-op, so a slightly stale
list is harmless).

## The keeper (only job: make revenue withdrawable)

Revenue is recognized lazily. When a subscription lapses, that final
month's fee stays counted as customer funds until someone calls `settle` on
that address. A daily cron fixes that:

```cron
0 6 * * * cd /srv/billing && bash scripts/keeper.sh subscribers.txt >> keeper.log 2>&1
```

- `subscribers.txt` = one address per line (from your event index, see
  above). `KEEPER_BATCH_SIZE` (default 50) controls how many addresses go
  into one `settleMany` transaction.
- Run it from any wallet with gas — a burner is fine, since `settle` is
  permissionless and moves nothing but bookkeeping. It cannot spend, mint,
  or misroute anything.
- If the keeper stops running, nothing breaks for customers: refunds,
  withdrawals, and `isSubscribed` all still work, because each customer's
  own transactions settle themselves. What stops is your *revenue becoming
  withdrawable*. That's what the cron is for.

## Owner and money ops

- `revenueAvailable()` — how much you can withdraw right now.
- `cast send $BILLING "withdrawRevenue(address,uint256)" <sink> <amount>` —
  sweeps to an address of your choosing (use a treasury wallet, not the
  deployer key, if you can). Withdrawals are capped at `balance −
  totalUserFunds` by the contract's arithmetic; you mathematically cannot
  take customer escrow.
- `transferOwnership(newOwner)` — rotate the admin key.
- Reconcile weekly: `USDC balance of contract` minus `totalUserFunds` should
  equal `revenueAvailable()`. It always will (the view computes it that
  way); the reconciliation is really checking that *the numbers match your
  own books* from the events.
- **Price changes**: prices are immutable. To charge $7/$25, deploy
  `ApiBilling` v2 with new constructor fees, let v1 wind down (customers
  lapse/cancel when their prepaid time ends — no forced migration), and
  point the backend's `isSubscribed` check at v2 (or OR the two answers
  during the overlap).

## A normal day / week / month

- **Every request** (automatic): `eth_call isSubscribed` (cached 5–30 s,
  fail closed).
- **Daily** (cron): keeper settles lapses; check `keeper.log` for failures.
- **Weekly**: sweep `revenueAvailable()` to treasury; glance at the
  reconciliation above; confirm the keeper wallet still has gas ETH.
- **Monthly**: churn review — count `Lapsed` + `Cancelled` vs `Subscribed`;
  send a top-up reminder to anyone whose `subscribedUntil` is under ~3 days
  away (you already have the data from `getSubscription`).

## What to keep an eye on

- **Keeper liveness.** Last successful `settleMany` should be < 25 h old.
  Symptom if it dies: `revenueAvailable()` stalls while `Lapsed` events keep
  appearing.
- **Unsettled backlog.** If `balance − totalUserFunds` keeps growing even
  after the keeper runs, your `subscribers.txt` is missing people — rebuild
  it from `Subscribed` events.
- **Churn spikes.** `Lapsed` events are customers who *wanted* the service but
  their credit ran out — these are your win-back/dunning emails.
  `Cancelled` are deliberate exits.
- **Escrow concentration.** `totalUserFunds` is customer money sitting in
  your contract. It is theirs (withdrawable, refundable), but it is also
  your smart-contract risk if the contract were ever buggy. The 12-month
  prepay cap bounds per-customer exposure ($60 hobby / $240 pro).
- **Invariants** (assert these in any monitoring you build):
  `usdc.balanceOf(billing) ≥ totalUserFunds`, always; `totalUserFunds`
  equals the sum of everyone's credit + unconsumed prepaid fees.
- **USDC-specific behavior.** Circle can blacklist addresses; transfers
  touching a blacklisted address revert. A blacklisted customer's `cancel()`
  will revert (their escrow stays put until/unless unblocked) — don't build
  support flows that promise instant refunds in that case. Fees are in
  6-decimal units; if you ever point at a token with different decimals,
  the dollar amounts change silently.
- **Key hygiene.** The owner key can drain revenue and rotate ownership —
  keep it in a hardware wallet or at least a dedicated hot wallet with a
  withdrawal allowlist. The deploy key should be single-use. The keeper
  wallet can be a low-value burner.
- **Gas environment.** Keeper cost is trivial on an L2, but a gas spike
  during a big batch looks scary in the log — batch size is the knob.
- **Contract upgrades.** There are none — this contract is deliberately not
  upgradeable. Treat any upgrade as a v2 deployment + a communicated
  migration, not a hot patch. That also means an audit (even a cheap one)
  before this holds real money is worth it; the test suite covers the
  accounting, but a second pair of eyes on `cancel()`/`_processLapse` math
  is the kind of thing that pays for itself.

## Known trade-offs (decisions, not bugs)

- "Monthly" = fixed 30-day periods; 12 periods = 360 days, so a "year" of
  subscription costs 12.17 periods over 365 days.
- Prepay: a top-up while subscribed immediately buys runway (up to the
  12-month cap). This is what makes renewal gasless and un-forgeable, and
  cancel still refunds every unconsumed second.
- Refund rounding floors to the micro-dollar in the customer's disfavor
  (dust, under $0.000001 per cancel, accrues to revenue).
- No pause, no admin rescue, no fee changes — the design goal is that you
  never have to trust the operator, only the code.

## Quick troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `topUp` reverts `TokenTransferFailed` | Customer didn't `approve` USDC to the billing contract, or is out of USDC (on mainnet: address blacklisted). |
| `subscribe` reverts `InsufficientCredit` | They need ≥ one month's fee in escrow: topUp first, then subscribe. |
| Customer paid but `isSubscribed` is false | They topped up while lapsed and never re-called `subscribe` — or their tx isn't mined yet. |
| `cancel`/`withdraw` reverts | Address is blacklisted by USDC (transfers to it revert). Funds stay escrowed; wait for unblock or compliance path. |
| `revenueAvailable` not growing | Keeper hasn't settled recent lapses — check the cron, the subscribers list, and keeper wallet gas. |
| `settleMany` out of gas | Lower `KEEPER_BATCH_SIZE`. |

## Security notes

- Transfers out are checks-effects-interactions plus a reentrancy guard;
  token pulls measure received balances rather than trusting the argument.
- `revenueAvailable` uses live balance minus tracked customer funds, so
  over-withdrawal of escrow is arithmetically impossible, not just
  forbidden.
- The 29-test suite (`forge test`) pins down: exact prorated refunds at all
  boundaries, multi-month prepay and the 12-month cap, lapse-without-settle
  behavior, permissionless settling, owner-power limits, and the
  balance-covers-escrow invariant across a composite scenario.
