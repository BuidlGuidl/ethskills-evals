# NOTES — running onchain billing day to day

A Foundry project that replaces Stripe for the weather API. Everything
authored by hand lives in `src/`, `script/`, and `test/`. `lib/` (forge-std
test dependency), `out/`, `cache/`, and `broadcast/` are generated and
git-ignored — don't read or edit anything there.

```
src/Billing.sol          the contract (no external dependencies in the contract itself)
script/Deploy.s.sol      deployment script (reads env vars)
test/Billing.t.sol       test suite — 35 tests incl. fuzz tests, all passing
test/MockUSDC.sol        6-decimal test token; MockUSDC18 proves non-6-dec tokens are rejected
foundry.toml, Makefile, .env.example
```

## How the money works

One contract, `Billing`, holds every customer's prepaid balance ("credit")
in USDC and bills continuously:

- **Top up** — customer approves USDC and calls `topUp(amount)`. Their
  credit balance lives inside the contract. Minimum viable top-up is one
  month of their plan (`subscribe` enforces it), which keeps "subscribed"
  meaningful.
- **Billing is accrual, not a monthly pull.** A subscription accrues debt at
  `price / 30 days` per second. Nothing needs to happen on a schedule: the
  debt is settled lazily — whenever *anyone* touches the account (`topUp`,
  `subscribe`, `cancel`, `withdraw`, or a public `settle(addr)` anyone can
  call). Economically identical to monthly charges, but with two big wins:
  - **no renewal bot, no cron, no failed-payment dunning loop** — a
    subscription stays live as long as credit covers elapsed time, then
    simply stops (`Lapsed` event);
  - **refunds prorate to the second** — `cancel()` settles what's owed for
    elapsed time and returns the rest in the same transaction.
- **`isSubscribed(addr)` is the source of truth** for your backend. It is a
  pure view: re-computes live from current time and never mutates or
  reverts. State on-chain can lag (a lapsed account might still show
  `plan != 0` until the next settlement) — always gate on `isSubscribed`,
  never on raw storage.
- **Nobody can go into debt.** If accrued charges exceed remaining credit,
  the charge is clamped to the credit, the rest is written off, and the
  subscription deactivates. Worst case for a customer is "service stops";
  there is never a negative balance to chase.
- **A "month" is 30 days** (12 billing months/year). Keep this in price
  copy — calendar-month billing would need leap-year and per-month-length
  logic for no real benefit.
- Amounts are in USDC base units (6 decimals): $5 = `5000000`.

### Properties worth knowing

- Customer credit is **not** touchable by the owner key. `collectRevenue`
  can only move `pendingRevenue` (money already settled as yours). Verify
  this invariant whenever you look at the contract:

  ```
  USDC balance of the Billing contract == Σ all customer credits + pendingRevenue
  ```

  This holds *exactly* (settlement only ever moves `floor(due)` out of
  credit, so rounding stays inside the customer's credit — always in their
  favor by sub-cent amounts).
- The contract accepts no ETH, has no admin pause, no upgrade path, and no
  custodial escape hatch. See "risk profile" below for why that's deliberate.

## The per-request check (your backend)

Per incoming API request:

1. Map the request's API key (or wallet signature) to an address.
2. `eth_call` `isSubscribed(addr)` on the Billing contract.
3. Serve if `true`, 402/403 otherwise.

```bash
# ad-hoc, from a shell:
cast call $BILLING "isSubscribed(address)(bool)" 0xCustomer... --rpc-url $RPC
```

From code it's a single `eth_call` on an ABI-encoded
`isSubscribed(address)` — use viem/ethers, `readContract` style, ~1 ms
locally. Practical guidance:

- **Fail closed.** If the RPC errors or times out, deny (or hold) the
  request. A billing check that fails open is a free-API hole.
- **Run your own RPC or use two providers** (e.g. a public one + a paid
  one as fallback). The check is a read; it's free beyond RPC quota, but
  it is now your critical path — a dead RPC means "everyone is
  unsubscribed".
- You may cache `true` for a few seconds if you like (rate-limit relief),
  but keep the TTL short and the expiry conservative. Negative answers
  should not be cached — customers top up at arbitrary moments. When in
  doubt, don't cache at all; it's a cheap view call.
- `getAccount(addr)` returns `(plan, credit, lastCharged, pricePerMonth,
  paidUntil)`. Use `paidUntil` to warn customers who are about to lapse
  (e.g. an email at 3 days remaining) and for a dashboard.

## Customer lifecycle

A customer needs a wallet with USDC on your chain. Today that means they
interact via your own little frontend (recommended: viem + wallet
connector, five buttons: approve, topUp, subscribe, cancel, withdraw) or
via Etherscan's "Write Contract" tab on the verified contract. The
transactions:

| Step | Call | Note |
|---|---|---|
| 1 | USDC `approve(Billing, amt)` | one-time or per top-up |
| 2 | `Billing.topUp(amt)` | ≥ one month of the chosen plan |
| 3 | `Billing.subscribe(planId)` | `1` = hobby ($5), `2` = pro ($20) |
| — | `Billing.cancel()` | stops service, refunds all unused credit to their wallet in the same tx |
| — | `Billing.withdraw(amt)` | pull credit out without cancelling (withdrawing *all* of it effectively ends service) |

Plan switches settle the old plan's accrued time first, then switch —
prorated fairly on both legs, no double-charging.

Local end-to-end walkthrough (all free): `make anvil`, then mimic
`test/Billing.t.sol`, or from a shell after deploying a 6-decimal test
token to anvil: mint → approve → topUp → subscribe, then
`cast rpc evm_setTime <now+N>` + `cast rpc evm_mine` to see `isSubscribed`
flip to `false` as credit runs out.

## Your money

- Settled charges accumulate in `pendingRevenue`. Sweep to your treasury
  with `collectRevenue(to, amt)` — owner key only. Weekly is a sane
  cadence; there's no urgency, the funds sit in the contract (which holds
  nothing but credits + revenue).
- Watch the balance invariant above. Small reconciliation differences
  mean a manual `settle` hasn't happened for someone yet; big differences
  mean investigate.
- `settle(addr)` is permissionless — useful for you (batch-settle before a
  price change, see below), for monitoring, and for forcing a stale
  lapsed account into its final state.

## Changing prices

`setPlanPrice(planId, price)` (owner) changes the monthly rate. Two things
to know:

1. **It applies to accrued-but-unsettled time of existing subscribers.**
   A price hike charges slightly more for time a subscriber has already
   used but not paid for. Before raising a price, batch-call
   `settle(addr)` for active accounts (you have the list from
   `Subscribed`/`ToppedUp` events; on an L2 this costs cents per account)
   and give customers notice in advance — they can `cancel` and keep their
   old rate's proration.
2. Subscribers are **not** re-checked against the new minimum — an active
   $20/mo customer who topped up $25 keeps running; when they lapse and
   re-subscribe, the new price applies.

Cheaper on a single plan than repricing often — but the mechanism is
there.

## Deploying

```bash
cp .env.example .env       # fill in RPC_URL, USDC_ADDRESS, OWNER_ADDRESS, PRIVATE_KEY
source .env
make deploy                # forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

- Deploy to an **L2 (Base or Arbitrum)**, not mainnet: customers pay gas
  on topUp/subscribe/cancel. At L2 prices a top-up costs fractions of a
  cent; on mainnet a cancel could cost more than the refund.
- Circle-native USDC addresses are in `.env.example` (Base, Ethereum,
  Arbitrum). The constructor reverts if given a token that doesn't report
  6 decimals, so a wrong-token deploy fails loudly instead of pricing in
  wei-dollars.
- Verify the contract right after deploying (`forge verify-contract`, or
  the `--verify` flag on the script) so customers can poke it on Etherscan
  and you can point support questions there.
- `OWNER_ADDRESS` is the operational key: it sets prices and sweeps
  revenue. Use a dedicated key (not your main bag); its worst-case damage
  is limited to uncollected revenue and mispriced plans — customer
  balances are out of reach.

## What to keep an eye on

**Daily / continuous**

- **RPC health.** Your whole authorization path hangs on it. Alert on
  check latency and error rate; keep a second provider configured; fail
  closed on errors (see above).
- **Invariant check**: `usdc.balanceOf(Billing) == Σ credits +
  pendingRevenue`. A drift means either an unsettled old account (fine —
  run `settle`) or something genuinely wrong (stop and investigate).
  Worth scripting: `Σ credits` comes from the `ToppedUp`/`Cancelled`/
  `Withdrew`/`Lapsed` events or a lazy full scan of `getAccount` for known
  subscribers.
- **Chain liveness.** If the chain halts or reorgs deeply, checks go
  stale. On Base/Arbitrum this is rare; a 5-minute circuit breaker check
  (compare block.timestamp of latest block vs wall clock) is cheap
  insurance.

**Weekly**

- Sweep revenue (`collectRevenue`) and record the amount against what
  events predict — this is your MRR/usage reporting.
- Review `Lapsed` and `Cancelled` events: that's churn, at $5 and $20
  each it's also a direct revenue signal.

**Monthly / as needed**

- **USDC-specific risk: Circle can blacklist addresses.** If a customer
  address is blacklisted, USDC transfers to/from it revert — meaning
  `cancel`/`withdraw` will revert and their credit is stranded until
  unfrozen. Nothing the contract can do about it; just know that a
  "stuck refund" ticket is usually this, not a bug. Also keep an eye on
  Circle contract upgrades (USDC is a proxy).
- **Price changes** — follow the settle-first, announce-first procedure
  above.
- **Owner key hygiene**: confirm it's the dedicated key, consider rotating
  (`transferOwnership`) if you suspect anything.

**Risk profile (read this once, then sleep on it)**

- The contract is deliberately **immutable and unpausable**. If a bug is
  ever found there's no rescue path — the response is deploy `BillingV2`,
  stop accepting new subscriptions on v1, and let customers
  `withdraw`/`cancel` their own funds out. That's also the mitigation:
  **the contract can only hold prepaid credit**, so your worst-case loss
  per customer is their unspent balance, not an open-ended liability.
  Encourage modest top-ups (cap at 3–6 months in your UI, e.g.) and the
  theoretical exposure stays tiny.
- The one thing the owner key *can* do is set prices — including badly
  (a typo of `500000` instead of `5000000` would overcharge by 10x).
  Double-check values with `cast call $BILLING "planPrice(uint8)" 1` right
  after any change; there's no second confirmation.
- Tests and lint: `make test`, `forge build` (three `block.timestamp`
  lint warnings in `src/Billing.sol` are inherent to time-based billing —
  a validator can nudge timestamps by a second, which shifts billing by
  a second; harmless).
