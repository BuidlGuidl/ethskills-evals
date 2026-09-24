# Running this thing

Onchain billing for the weather API. Customers prepay USDC, pick a plan, and your
backend asks the contract one question per request: is this address subscribed.

This document is about what happens after it's deployed — what you have to run, what
you don't, what to watch, and what this design costs you compared to Stripe.

---

## The one idea to hold on to

**There is no monthly charge transaction.** Nothing onchain runs itself — no cron, no
scheduler, no background process. A contract only moves when someone pays gas to move
it. So "charged monthly" can't be a job that fires on the 1st; somebody would have to
send that transaction, for every customer, every month, forever, and the day that
somebody stops, billing stops.

Instead the subscription is a meter. When a customer subscribes, the contract records
their rate ($5/month = 1.929 token units per second) and the timestamp. Cost is then
*computed* whenever anyone reads it:

```
owed  = rate x (now - lastSettled)          capped at their balance
until = lastSettled + balance / rate        when they run dry
```

Everything falls out of those two lines:

- **Your gate is always right.** `isSubscribed(addr)` is a view call comparing `now`
  against `until`. The moment a customer's balance is exhausted, the answer is `false`
  — with nobody having sent a transaction, on a weekend, while you're asleep.
- **Refunds are exact and automatic.** Cancelling is "stop the meter"; the unused
  remainder was never taken in the first place, so there's nothing to compute or
  approve. They call `cancelAndWithdraw` and it's back in their wallet in one tx.
- **You can't fall behind.** There's no backlog of uncharged months to catch up on.

The only recurring transaction in the whole system is you moving your own already-earned
revenue out. More on that below, including why it's safe to forget about it.

### What "monthly" actually means here

Two honest consequences of metering rather than invoicing:

- **A month is a fixed 30 days**, not a calendar month. A year is 365/30 = 12.17 of
  them, so a hobby subscriber who stays a full year pays **$60.83, not $60**. If you
  advertise "$5/month" that's fine; if you ever advertise "$60/year" it isn't.
- **Revenue arrives continuously**, not on billing days. There is no MRR spike on the
  1st, and no failed-payment retry queue, because there is no payment attempt — the
  money was already in the contract.

---

## What's here

| Path | What it is |
|---|---|
| `src/SubscriptionBilling.sol` | The whole thing. One contract, no proxy, no upgrade path. |
| `script/Deploy.s.sol` | Deploys and opens the two plans. |
| `script/Ops.s.sol` | `AcceptOwnership`, `SetPlan`. |
| `test/SubscriptionBilling.t.sol` | 32 tests including fuzz. `forge test` |
| `test/Gas.t.sol` | Prints the gas numbers quoted below. Re-run after any change. |
| `backend/subscription-gate.mjs` | The per-request gate. Drop into your API. |
| `ops/collect.mjs` | Status report + the revenue sweep. |
| `ops/e2e-local.mjs` | Full lifecycle rehearsal on a local anvil. |

```bash
forge test                  # contract
forge build && npm run e2e  # contract + gate + ops ABI, against a real chain
```

---

## Deploying

Base mainnet. It's an L2, so a customer subscribing pays cents in gas instead of dollars
— on Ethereum mainnet, a $5/month subscription could cost more in gas to start than the
first month of service, which kills the hobby tier outright.

```bash
cp .env.example .env     # fill in BILLING_TOKEN, BILLING_OWNER
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify   # rehearse
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify           # for real
BILLING_CONTRACT=0x... forge script script/Ops.s.sol --tc AcceptOwnership --rpc-url base --broadcast
```

Two things to get right the first time, because neither can be changed afterwards:

- **`BILLING_TOKEN` must be real Base USDC** (`0x8335...2913`), not bridged USDbC and
  not a testnet address you pasted by habit. It's immutable. Wrong token means redeploy
  and migrate every customer by hand. The deploy script at least checks it's a contract.
- **`BILLING_OWNER` should be a Safe**, not the key on your laptop. It's the key that
  collects your revenue. Ownership is two-step (`Ownable2Step`), so a typo'd address
  can't silently take it — the new owner has to call `acceptOwnership()`.

Record the deploy block number into `DEPLOY_BLOCK` in `.env`. `ops/collect.mjs` scans
logs from there; without it you'll scan from genesis every run.

---

## Day to day

### What you have to run: nothing, most days

Say that out loud, because it's the unusual part. If you go on holiday for six weeks:
customers keep subscribing, keep being served, keep being metered, keep cancelling and
getting refunded. None of it touches you. The gate is a view call against a contract
that doesn't need you.

### The one recurring job: collecting your money

```bash
node ops/collect.mjs                       # report only, sends nothing
node ops/collect.mjs --settle              # sweep accrued -> collectedRevenue
node ops/collect.mjs --settle --withdraw   # ...and move it to PAYOUT_ADDRESS
```

`settle` walks the accounts and converts what's accrued out of each customer's bucket
into your revenue bucket. Then `withdrawRevenue` pays you.

**Why it's safe to forget:** deferring it costs nothing and nobody. The money is already
in the contract; accrual is computed from timestamps, so a month you didn't sweep is
still owed to you at the same number. It changes no customer's `activeUntil`. It cannot
fail in a way that loses you revenue — only in a way that delays it. Run it monthly, run
it quarterly, run it when you want the cash.

`settle` is deliberately **permissionless** — anyone can call it for any account. That's
safe because all it does is move money from a bucket the caller doesn't own into a bucket
the caller doesn't own either. It's permissionless so a settle-only cron can use a
throwaway hot key with $20 of ETH on it, and your actual owner key (the Safe) only ever
comes out for the withdraw.

Gas, measured (`forge test --match-contract GasTest -vv`):

| Action | Gas |
|---|---|
| `depositAndSubscribe` | ~85,000 (customer pays) |
| `settle`, per account | ~9,900 |
| `settle`, 200 accounts in one tx | ~1,970,000 |
| `cancelAndWithdraw` | ~88,500 (customer pays) |
| `isSubscribed` | view call, free |

On Base, sweeping a couple of hundred accounts is well under a dollar at typical gas.
Check it anyway before scaling the batch: `MIN_SWEEP_USDC` in `.env` exists so you don't
spend gas sweeping $3. The script batches 200 at a time (`SETTLE_BATCH`) to stay clear
of the block gas limit — don't raise it much past that.

### The gate, in your API

```js
import { createSubscriptionGate } from './backend/subscription-gate.mjs'
const gate = createSubscriptionGate({ rpcUrl: process.env.RPC_URL, contract: process.env.BILLING_CONTRACT })

if (!(await gate.isSubscribed(req.session.address))) return res.status(402).json({ error: 'no active subscription' })
```

It's an RPC call per address per minute, not per request — because `activeUntil` tells
you how long the answer is good for, a hot customer is served entirely from memory.
The three settings that matter are at the top of the file:

- `maxTtlMs` (60s) — how long a *yes* is trusted. This is the window in which somebody
  who just cancelled and withdrew still gets served. Sixty seconds of free weather data
  is not worth optimising.
- `negativeTtlMs` (10s) — how long a *no* sticks. This is the lag a customer feels
  between their top-up confirming and the API letting them in. Keep it short; this is
  the number that generates support emails.
- `onRpcError` — defaults to `last-known`: during an RPC outage, keep serving customers
  you already verified (until their real onchain expiry passes) and refuse everyone
  else. Don't set this to `open` — an outage at your RPC provider would become free
  unlimited API access, and RPC outages are not rare.

**The contract cannot tell you the request came from that address.** It answers "is
0xabc subscribed", not "is this caller 0xabc". If you take the address from a header,
anyone who reads a subscriber's address off the block explorer — they're all public,
see below — can use your API for free. Authenticate with a signed session (SIWE) or an
API key you issue after a signature. This is the single most likely way to get this
wrong, and it's entirely on your side of the line.

### Support scenarios

| They say | What's actually true | What you do |
|---|---|---|
| "I want to cancel and get my money back" | Already handled. | Point them at `cancelAndWithdraw`. You are not involved and cannot be. |
| "My API calls started 402'ing" | They ran out of prepaid balance. | `node ops/collect.mjs` lists everyone within 7 days of running dry. Top-up + `subscribe` again. |
| "I topped up but it's still refusing me" | Either <10s of gate cache, or they topped up a *lapsed* account and didn't re-subscribe. | Deposits don't auto-resume a lapsed plan — they must call `subscribe(planId)` again. `depositAndSubscribe` does both in one tx. |
| "I want to upgrade to pro" | `subscribe(2)` settles the hobby time at the hobby rate first, then switches. | Nothing. They need ≥ $20 balance. |
| "I lost the wallet that holds the subscription" | The balance is stuck. | Nothing you can do. There is no admin override — that's the deal, and it's worth saying on the pricing page. |
| "Can I pay with a card" | No. | Out of scope; they need USDC on Base. |

### Money: two buckets, don't mix them

`totalSubscriberBalance` is **customer float — not your money.** It's prepaid time they
haven't used and can withdraw at any moment. `collectedRevenue` is yours. The contract
keeps these strictly separate and `withdrawRevenue` cannot exceed the second one, so
the owner key can't touch customer funds even by accident.

That separation is enforced onchain but not in your bookkeeping. If $4,000 sits in the
contract and $600 of it is earned, your revenue for the period is $600. Treat the rest
as deferred revenue, the same as you would a prepaid Stripe balance.

---

## What to watch

Roughly in order of how much it would hurt.

1. **`solvencySurplus()` reverting.** It computes `token.balanceOf(this) - (float +
   revenue)`. It should always be ≥ 0; a revert means the contract holds less than it
   owes, which under this code should be impossible. If it ever reverts, stop and
   investigate before sweeping anything. `ops/collect.mjs` prints it every run.
2. **Customers about to run dry.** `ops/collect.mjs` lists everyone with <7 days of
   runway. This is your entire retention loop — a subscriber who lapses gets a 402 with
   no warning otherwise. Worth wiring to an email; it's the one place a little
   offchain effort buys real revenue.
3. **RPC health and gate stats.** `gate.stats()` gives `rpcErrors` and cache hit rate.
   Rising `rpcErrors` means you're leaning on `last-known` and drifting toward serving
   stale answers. Rising `misses` relative to `hits` means your traffic is spread over
   more addresses than the cache holds (`maxCacheEntries`, 50k).
4. **`collectedRevenue` vs what you expect.** Compare the sweep against active
   subscriber count x plan price x elapsed. A large gap usually means subscribers
   lapsed mid-period, which is a churn signal, not a bug.
5. **The `Lapsed` event.** Emitted whenever an account is settled to zero. Cheapest
   possible churn feed — index it and you get a dated list of who stopped paying.
6. **USDC itself.** Circle can freeze an address, and USDC is an upgradeable contract.
   If Circle blacklists the contract address, deposits and refunds both stop. There is
   nothing you can do about this and it has never happened to a contract like this, but
   it is a real dependency you don't control and you should know it's there.
7. **Base.** If the sequencer halts, nobody can subscribe, cancel, or withdraw. Your
   *gate* keeps working (reads still serve from the last state, and cached answers hold),
   so the API stays up for existing subscribers. Signups stop.

---

## What this design gives up

The honest version, because the differences from Stripe are not all in your favour.

### Can anyone be stopped from using it?

Mostly no, and that's deliberate. What the owner key actually has:

- `setPlan` — change a price, or close a plan to new signups. **It cannot reprice an
  existing subscriber.** The per-second rate is snapshotted when they subscribe and
  lives in their account, so money already deposited is charged at the rate they agreed
  to, forever, until they cancel or switch plans themselves.
- `withdrawRevenue` — take earned revenue, and only earned revenue.
- `rescueToken` — recover some other token sent here by mistake. Explicitly reverts on
  USDC, so it isn't a back door.

What the owner key does **not** have: no pause, no blacklist, no upgrade proxy, no
ability to cancel someone, no ability to touch a customer balance, no way to extract the
float. There is no admin function that takes an arbitrary address. I didn't ship those
on purpose — a pause switch on a billing contract means you can strand customer money,
and the test suite asserts the absence (`test_ownerCannotTouchSubscriberBalances`,
`test_subscribersSurviveAnAbsentOperator`).

**If the owner key is lost:** customers are unaffected. They keep being metered, keep
being served, and can still cancel and withdraw everything unused. What dies is your
ability to collect — `settle` still works (it's permissionless), so revenue keeps
accumulating in `collectedRevenue`, but nobody can ever withdraw it. Losing the key
costs you your revenue and costs your customers nothing. That's the right way round,
and it's also a strong argument for the Safe.

### Could someone else run it?

Split it honestly:

**Survives you disappearing.** The contract, every balance, every subscription, the
plan prices, the full history. Anyone can read `isSubscribed` and `accountOf` from any
RPC endpoint or block explorer. Customers can cancel and get their money back with no
cooperation from you or anyone else — no frontend needed, Etherscan's write tab is
enough. Nobody can be locked out of their own money by you going quiet.

**Does not survive you disappearing.** The actual weather API — the data, the servers,
the gate that decides who gets served. That's the product, and it's entirely yours.

So: onchain billing here means customers can't lose their prepaid money if you vanish.
It does not mean they keep getting weather. Don't let "it's onchain" imply more than it
does — verifying the contract on Basescan makes it *auditable*, not *runnable by
someone else*. If continuity of service matters to a customer, that's a conversation
about your servers, not about this contract.

### What does an observer learn?

**Everything. This is the biggest real difference from Stripe and it goes the wrong way.**

Public forever, to anyone, including competitors:

- your complete customer list, as addresses
- which tier each one is on, and what they pay
- when each signed up, topped up, upgraded, and churned
- your total float and your total revenue, live
- enough to compute your MRR and growth rate more accurately than you can

Anyone can write a script that alerts them when you gain or lose a customer. A
competitor can watch your churn in real time. If a customer's address is linked to their
identity anywhere else — an ENS name, an NFT, a donation — their subscription to your
service is linked to them too, permanently, with no way to delete it.

Nothing here is fixable with access control on your endpoints; that's a different
question about your API, not about this. If it matters, the mitigations are things like
telling customers to use a fresh address per subscription, or moving to a design where
subscriptions are held by a contract the customer controls rather than an EOA. Neither
is free. Mostly the answer for a hobby-project weather API is "this is fine" — but
decide it, don't discover it.

### What "audited" would cover

Nothing here has been audited. If you do get one, know what you'd be buying: a
point-in-time review of a fixed scope. It says "these people looked at this exact code
on this date and reported what they found." It is not a guarantee, it doesn't cover the
code after you change a line, and it doesn't cover `backend/` or `ops/` unless you pay
for those too. For a contract holding hobby-tier float, the test suite plus a small cap
on how much you encourage customers to prepay is a more proportionate answer than a
$30k audit.

---

## Changing things later

**Raising a price** (`script/Ops.s.sol --tc SetPlan`): applies to new subscriptions only.
Existing subscribers keep their old rate until they cancel or switch. If you need the
increase to reach everyone you have to ask them to re-subscribe — you can't force it,
which is a feature.

**Adding a plan:** any unused `planId` (1 and 2 are taken; `0` means "not subscribed" and
is rejected). Add it to the frontend and the gate needs no change at all — it only asks
whether someone's subscribed, not which tier. If you want tier-specific rate limits,
read `planId` from `accountOf`.

**Retiring a plan:** `setPlan(id, price, false)`. Closes it to new signups; current
subscribers on it run out their balance untouched.

**Changing the billing token, or the meaning of a month, or anything else in the
contract:** redeploy. There's no upgrade path by design. Migration would mean asking
every customer to withdraw from the old contract and deposit into the new one. Which is
the cost of not having an upgrade proxy — and the reason nobody can rewrite the billing
rules under your customers' feet.

## Deliberately not built

- **Annual plans / prepay discounts.** Easy to add as another `planId` with a lower
  monthly rate, but there's nothing binding a customer to stay a year, so the discount
  would just be a price cut.
- **Free trials.** No onchain identity means a trial is per-address, and addresses are
  free. Gate trials in your API, not here.
- **Usage-based billing.** Per-request metering needs a transaction per request, or an
  offchain accounting system with an onchain settlement — a much bigger build.
- **A frontend.** Customers currently need a wallet and the contract on Basescan.
  A small subscribe/top-up/cancel page is the obvious next thing, and it's the piece
  that most determines whether hobby-tier customers actually convert.
