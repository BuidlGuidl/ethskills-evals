# Running this thing

Operational notes for the onchain billing behind the weather API. Everything here assumes
the contract is deployed and customers are real.

---

## The one paragraph you need

A customer deposits USDC into a credit balance they own. Subscribing moves one month's
price out of that balance into escrow. When the month is up, the escrow becomes your
revenue and the next month is funded out of whatever credit is left — automatically, with
nobody running a cron job. When the credit runs out the subscription lapses at the end of
the last month that was actually paid for. Cancelling refunds the unused part of the month
in progress, pro-rated by the second, back to the customer's balance, from where they can
withdraw it. Your backend asks `statusOf(address)` whether to serve a request.

The important consequence: **nothing you run can break billing correctness.** If your
settle job never runs again, customers still get charged correctly, still renew correctly,
still lapse correctly, and `isSubscribed` still returns the right answer. The only thing a
missed settle run delays is *you* being able to withdraw.

---

## What "monthly" actually means here

A period is a **fixed 30 days**, not a calendar month. That means:

- A subscriber who stays a full year is charged **12.17 times**, not 12. Annual revenue per
  hobby seat is $60.83, not $60.
- Renewal dates drift earlier through the year. A customer who subscribes on 1 March renews
  on 31 March, then 30 April, and so on.

This is deliberate — calendar arithmetic onchain is expensive and full of edge cases — but
it is the thing most likely to generate a confused support email. Say "every 30 days" in
your pricing page, not "monthly".

## Prices are grandfathered

`setPlanPrice` only affects people who subscribe *after* the call. Existing subscribers
keep renewing at the price snapshotted when they subscribed, forever, until they cancel or
call `switchPlan`.

That is a real product constraint: you cannot raise prices on your existing book. If you
need to, the honest path is to announce it, let people cancel, and have them resubscribe —
or deploy a v2 (see *Migrating*, below). The upside is that no customer is ever surprised
by a charge they did not agree to, and settlement maths stays exact.

Setting a price to `0` closes a plan to *new* signups without affecting anyone already on
it. That is the switch to use if you want to retire a tier.

---

## Day to day

### Every request (automatic, no action from you)

The gateway calls `statusOf(address)` and caches the answer until `activeUntil`, the
timestamp the contract guarantees it is good until. It also watches the contract's events
and drops a cached answer the instant anything changes for that address. In practice that
is roughly **one RPC call per customer per month**, not one per request.

If the RPC provider goes down, the gate serves a recently-expired *positive* answer for up
to `maxTtlMs` (default 5 minutes) rather than cutting off paying customers over someone
else's outage. Past that it returns `503`, not `402` — do not tell a paying customer they
have not paid because you could not reach the chain.

### Once a month: settle and collect

```bash
RPC_URL=$RPC BILLING_ADDRESS=0x... node backend/settle-bot.js                 # dry run
RPC_URL=$RPC BILLING_ADDRESS=0x... PRIVATE_KEY=0x... PAYOUT_TO=0x... \
  node backend/settle-bot.js                                                  # settle + sweep
```

Dry run first; it prints active subscriber count, customer funds held, revenue already
settled, and revenue claimable after settling. The numbers should be boring. Then run it
with a key to write the settlements and sweep the proceeds.

Settling is permissionless — anyone can call it, including a customer — so you are not a
single point of failure here either. It costs about **26–64k gas per account**, batched via
`settleMany`. On Base that is fractions of a cent.

There is no deadline. Settle weekly, monthly, or annually; the money accrues either way.

### Ad hoc

```bash
# read-only health check against a live deployment
BILLING=0x... forge script script/Ops.s.sol --sig 'report(address[])' '[0xcustomer]' --rpc-url base

# change a price for new signups only
BILLING=0x... forge script script/Ops.s.sol --sig 'setPrice(uint8,uint256)' 1 6000000 \
  --rpc-url base --broadcast

# stop new deposits and signups (does NOT stop renewals, cancels or withdrawals)
BILLING=0x... forge script script/Ops.s.sol --sig 'pauseSignups(bool)' true --rpc-url base --broadcast
```

---

## What to keep an eye on

In rough order of how much it would hurt to miss.

### 1. The solvency invariant

```
token.balanceOf(billing) >= customerFunds() + accruedRevenue()
```

This should hold in **every single block**. It is the property the whole design rests on:
that the contract always holds at least everything it owes to customers plus everything it
owes you. It is enforced by an invariant test that runs 128,000 random operations against
it, but test it against the live contract too — alert immediately and loudly if it ever
fails, because it would mean funds can be stranded.

Cheap to check: two view calls and an ERC-20 balance, on a one-minute timer.

### 2. `402` rate on the API

A rising share of `402 Payment Required` responses is the signal that customers are
lapsing. Break it down by address. One customer hitting `402` a thousand times is a hobby
script that has run out of credit and does not know it; a hundred customers hitting it at
once is more likely a bug in your gate.

### 3. Customers about to run out

`subscribedUntil(address)` returns when a subscription will lapse if no more money arrives.
Anyone inside two weeks of that is worth an email. This is the single highest-value thing
you can build on top of this contract — prepaid billing fails silently by design, and a
lapsed hobbyist usually just assumed it was still working.

### 4. `503` rate and `gate.stats`

The gateway exposes `/metrics` with `{hits, misses, rpcErrors, evictions}`. Watch:

- **`rpcErrors` climbing** — your RPC provider is struggling. Customers are being served
  from stale cache, which is fine for five minutes and not fine for an hour.
- **`misses` roughly equal to `hits`** — the cache is not working. Expected steady state is
  a hit rate well above 99%. A low hit rate usually means the event watcher is stuck in a
  reconnect loop and evicting constantly, or you are running many gateway processes with
  cold caches.
- **`evictions` near zero when you know customers are subscribing** — the event stream has
  silently died. The TTL is the backstop so nothing breaks, but answers go stale by up to
  five minutes.

### 5. Revenue reconciliation

Each month, `accruedRevenue()` after a settle run should match what you expect from the
subscriber list. If it is short, some accounts were not in the list the bot settled — the
bot derives the list from `Subscribed` logs, so check `FROM_BLOCK` is at or before the
deployment block.

### 6. Gas on the settle key

It only needs a few dollars of ETH, and it only matters once a month, which is exactly why
it will be empty the one time you need it.

### 7. The owner key

It is the merchant key: it can change prices for new subscribers, pause signups, and
withdraw settled revenue. Put it in a multisig or hardware wallet, and use `transferOwnership`
+ `acceptOwnership` (two-step, so a typo cannot brick it) to move it there after deploy.

**What the owner key cannot do**, by design, and worth telling customers:

- take customer balances or escrowed periods — `rescue` explicitly excludes both
- stop anyone cancelling or withdrawing, even while paused
- change the price an existing subscriber renews at
- upgrade or change the contract's behaviour; there is no proxy

---

## Things that will eventually happen

**"I topped up but I'm still getting 402."** Depositing money is not subscribing. A top-up
credits the balance; `subscribe(planId)` starts the subscription. This separation is
deliberate — it is what stops a top-up from being silently eaten by a month of downtime
after a lapse — but it catches people out. Use `depositAndSubscribe` in your UI so the
normal path is one transaction, and check `statusOf` before blaming the cache.

**"I cancelled and got less back than I expected."** Cancelling refunds the unused portion
of the current 30-day period only. Credit they deposited but never spent is separate and is
withdrawn with `withdraw` or, together, with `cancelAndWithdrawAll`. Rounding is by the
second and always down, so the refund can be up to one micro-USDC light. Nobody will notice
but it is in your favour, not theirs.

**A customer's address gets blocklisted by Circle.** USDC transfers to that address revert,
so they cannot withdraw. Nothing you can do; their funds stay in the contract and their
subscription keeps ticking normally. It does not affect any other customer or your ability
to settle and collect.

**A reorg.** Your gate may briefly serve a wrong answer for an address whose subscription
changed in a reorged block. It self-corrects at the next TTL expiry. Nothing onchain is
affected. Not worth engineering around on Base; worth knowing when a support ticket looks
impossible.

**The RPC provider dies during your busiest hour.** Covered above: stale-positive for five
minutes, then `503`. Have a second provider URL and a way to flip to it that does not
require a deploy.

**You want to stop taking money right now.** `pauseSignups(true)` blocks new deposits and
new subscriptions immediately. Existing subscriptions keep renewing off credit already
deposited, and everyone can still cancel and withdraw. There is no lever that traps
customer funds, which is the point.

---

## Migrating

The contract is immutable on purpose — no proxy, no upgrade path, nothing that requires
customers to trust you not to rewrite the rules. The cost is that changing behaviour means
a new deployment:

1. Deploy v2.
2. `pauseSignups(true)` on v1.
3. Point the gate at both: serve a request if *either* contract says the address is
   subscribed. The `SubscriptionGate` takes one address; run two instances and OR them.
4. Ask customers to `cancelAndWithdrawAll()` on v1 — they get every unused cent back — and
   subscribe on v2.
5. Settle and sweep v1 once the last subscription has lapsed.

Budget a full billing period plus slack for step 4. Nobody loses money at any point, and
nobody's service is interrupted, but it is not instant.

---

## Before you go live

- [ ] `forge test` green, including the invariant suite
- [ ] `anvil --silent & npm run e2e` green against a local chain — it rehearses the whole
      lifecycle including lapse and refund
- [ ] `USDC` in the deploy config is the real USDC on the chain you are deploying to, and
      you have checked the address against Circle's published list, not a blog post
- [ ] prices are in 6-decimal units — `5_000_000` is $5, `5` is a rounding error
- [ ] ownership transferred to a multisig or hardware wallet, and `acceptOwnership` called
- [ ] `API_SECRET` is 32+ random bytes and is not in git
- [ ] `ApiKeyIssuer.knownPrefixes` is backed by your database, not the in-memory map it
      ships with — otherwise every restart logs all your customers out
- [ ] the solvency alarm from §1 is wired up and you have watched it fire on purpose
- [ ] a small real subscription bought with real USDC on mainnet, then cancelled, then the
      refund checked to the cent

---

## Cost reference

Measured from the gas report (`forge test --gas-report`); multiply by your chain's gas
price. On Base these are all well under a cent.

| Action | Gas | Paid by |
|---|---|---|
| `statusOf` / `isSubscribed` | ~6k (view, free over RPC) | nobody |
| `depositAndSubscribe` | ~146k | customer |
| `subscribe` (with credit already on hand) | ~31k | customer |
| `settle` | 26–64k | you (or anyone) |
| `cancelAndWithdrawAll` | ~85–97k | customer |
| `withdrawRevenue` | ~73k | you |
