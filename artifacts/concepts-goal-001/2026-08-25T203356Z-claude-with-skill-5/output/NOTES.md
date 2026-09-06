# Running onchain billing for the weather API

Operator notes. Written 2026-08-25; gas and price figures were measured on that date
and are marked where they appear.

---

## 1. The one thing to understand before anything else

There is no monthly charge job in this system, and there is no place to put one.

A contract is a state machine that moves only when somebody sends it a transaction and
pays for that transaction. It has no cron, no scheduler, no timer, nothing running in
the background. "Charge every subscriber on the 1st" is not a setting — it is a
transaction that somebody has to send, every month, forever, and it stops the month you
are in hospital or the month the key that sends it expires.

So the meter is time itself. A subscriber's prepaid balance is treated as draining
continuously at `price ÷ 30 days` per second, and who owns what is a pure function of
`block.timestamp`:

```
                       deposit $15 on hobby
   balance $15 ├────────────────────────────────────────┐
               │  yours (refundable)      ╲             │
               │                            ╲           │
               │                              ╲         │
               │        already earned by you   ╲       │
   balance  $0 └──────────────────────────────────╲─────┘
               day 0                              day 90
                                                  paidThrough
```

Nobody sends anything, and the customer is still billed. The customer stops being
subscribed at `paidThrough` whether or not any transaction is ever sent again. `settle()`
does not *cause* billing — it only writes down what already happened, moving units that
the stream already earned out of the customer's column and into yours.

Two consequences worth internalising:

- **You cannot miss revenue by not running something.** `withdrawable()` is always net of
  everything accrued to this second, so a customer can never withdraw money the stream
  already earned. Settle monthly, quarterly, or once a year — the total is identical.
  `test_lateSettlementCollectsTheSameTotal` in the test suite is exactly this claim.
- **You cannot over-charge a customer who ran out.** Accrual is capped at the balance, so
  an account that ran dry eleven months ago owes for the one month it was actually
  served, not for twelve. It reads as unsubscribed from the instant the money ran out.

If you only remember one line from this document: *the passage of time is the billing,
and everything else is bookkeeping.*

---

## 2. What you deploy, once

Pick an L2. This matters more than it sounds. Measured on 2026-08-25, ETH at $2,446:

| Action | Gas | Base @ 0.006 gwei | L1 @ 0.19 gwei (that day) | L1 @ 30 gwei (a busy day) |
|---|---|---|---|---|
| Deploy the contract | 3,176,351 | $0.05 | $1.47 | $233 |
| Customer signs up (`depositAndSubscribe`) | 104,752 | $0.0015 | $0.05 | **$7.69** |
| Customer cancels + refunds | 84,370 | $0.0012 | $0.04 | $6.19 |
| You settle 100 accounts and sweep | ~4.06M | $0.06 | $1.88 | $298 |

The right-hand column is the whole argument. A $5/month product where signing up can
cost $7.69 in gas is not a product. On Base, signup costs about a sixth of a cent in
execution gas, so the fee is invisible against the subscription. Deploy to Base,
Optimism or Arbitrum; treat L1 mainnet as off the table for this price point. (Add the
L1 data fee to the L2 numbers — a few hundredths of a cent per transaction post-4844,
which does not change the picture.)

```bash
export TREASURY=0xYourTreasurySafe
export RPC=https://mainnet.base.org
forge script script/Deploy.s.sol --rpc-url $RPC --broadcast --verify
```

Deploy checklist, in the order these bite:

1. **Check the USDC address.** `script/Deploy.s.sol` has Circle's native USDC per chain,
   but re-check it against Circle's docs before you broadcast. Several chains have both
   a native USDC and a bridged `USDC.e`, and you will not find out you picked the wrong
   one until customers have money in the contract. The token is immutable — there is no
   fixing this afterwards, only redeploying and migrating everyone by hand.
2. **Make the treasury a multisig**, not a hot key. See §6 for exactly what it can and
   cannot do; the ceiling on the damage is low, but the revenue lands there.
3. **Verify on the explorer.** Not because verification is decentralisation (it isn't,
   see §7), but because a customer who wants to check what they are signing needs source.
4. **Sanity-run against a fork or a testnet first.** Subscribe, warp, cancel, check the
   refund is the number you expect.

Prices are set at deploy: plan 1 = 5,000,000 (that's $5.00 — USDC has 6 decimals),
plan 2 = 20,000,000. **A plan's price can never be changed afterwards.** There is no
setter, deliberately: a subscriber's price is fixed at the moment they subscribe and you
cannot raise it under them. To change pricing you `addPlan` a new tier and `closePlan`
the old one; existing subscribers keep streaming at their locked price until they cancel
or run dry, and new customers get the new price.

---

## 3. What actually happens day to day

**Your job: nothing, most days.** The list of things that break if you go on holiday for
a month is empty. Billing accrues, subscriptions expire on time, the API keeps checking.

**Collecting the money.** Whenever you want the cash:

```bash
export BILLING=0xYourContract
export ACCOUNTS=0xalice,0xbob,0xcarol      # from the AccountUpdated logs
forge script script/Sweep.s.sol --rpc-url $RPC --broadcast
```

That settles the listed accounts and pushes `revenueAccrued` to the treasury. Monthly is
a sensible rhythm because it matches how you probably think about revenue, not because
the contract needs it. Two details:

- The account list comes from your own indexing of `AccountUpdated` logs. Sweeping an
  incomplete list is not an error — you just collect less this round and the rest next
  round. There is nothing to reconcile.
- `withdrawRevenue()` is permissionless, because the destination is hardcoded to the
  treasury. A stranger calling it only does you a favour. `settleMany` is likewise
  permissionless and economically neutral — it cannot change anyone's position, only
  write down accrual that already happened.

**The customer's side**, for your docs page:

```bash
# approve once
cast send $USDC "approve(address,uint256)" $BILLING \
  115792089237316195423570985008687907853269984665640564039457584007913129639935 \
  --rpc-url $RPC --account me

# $15 of hobby — three months of runway
cast send $BILLING "depositAndSubscribe(uint256,uint8)" 15000000 1 --rpc-url $RPC --account me

# top up later, any amount, any time
cast send $BILLING "deposit(uint256)" 5000000 --rpc-url $RPC --account me

# cancel and take back everything unused, in one transaction
cast send $BILLING "cancelAndWithdraw()" --rpc-url $RPC --account me

# check yourself, free
cast call $BILLING "statusOf(address)" $ME --rpc-url $RPC
```

Customers control their own runway: deposit three months and they are good for three
months; deposit $5 and they lapse in thirty days. There is no auto-renew because
auto-renew is a pull on someone's wallet and this design never pulls — it can only spend
what they already handed over. Tell them plainly in your docs: **if you don't top up,
your access ends on this date**, and surface `paidThrough` in your dashboard as that
date. This is the single largest support-load difference from Stripe and it is worth a
paragraph on your pricing page.

**Support cases you will actually get:**

| "…" | What's true | What you do |
|---|---|---|
| "My API key stopped working" | They lapsed; `paidThrough` is in the past | Point at `statusOf`; they top up; access returns the moment the transaction lands |
| "I cancelled, where's my refund?" | `cancelAndWithdraw` already sent it, same transaction | Give them the tx hash from the `Withdrawn` log |
| "I want a refund for last month" | Not possible onchain — that time was served and swept | Send USDC manually if you want to; the contract has no clawback |
| "I paid but it says unsubscribed" | They deposited without calling `subscribe` | `subscribe(1)`; their balance was never lost |
| "I sent USDC straight to the contract" | It's stranded — a raw transfer credits no account | There is no rescue function. Tell people to use `deposit`. See §5 |

---

## 4. What to keep an eye on

Ranked by how likely it is to actually cost you something.

**1. Your RPC provider.** This is the real single point of failure, and it is not the
chain. Every API request funnels into a subscription check that ultimately reads chain
state through one provider. If they go down, your paying customers get errors from *your*
service.

The gate in `backend/src/gate.ts` is built around that: it caches on `paidThrough` (so a
subscribed customer costs zero RPC calls until either their subscription expires or the
60-second safety TTL lapses), invalidates instantly from `AccountUpdated` logs, and on an
RPC failure keeps serving anyone it recently confirmed as paying for up to ten minutes
while refusing addresses it has never seen. That last asymmetry is deliberate: an outage
at your provider should not read as "everybody's subscription ended", and it should also
not read as "free API access for anyone who asks".

- Alert on `gate.stats.rpcErrors` rising and on `servedStale > 0` — the second means you
  are flying on cache and the grace window is counting down.
- Have a second provider configured. Failing over is a config change; realising you need
  one at 3am is not.
- Alert on **`eventInvalidations` staying at zero while you have active customers**. A
  websocket that dies silently looks exactly like "nothing changed", and the failure mode
  is serving cancelled customers for up to the TTL. `onError` logs it; make it page you.

**2. Your own clock.** The gate compares `paidThrough` against the server's wall clock.
A machine with a badly drifting clock will cut people off early or late by the drift.
Run NTP. This sounds trivial until it is a support ticket you cannot reproduce.

**3. Revenue accrued but unswept.** Watch `revenueIncluding(accounts)`. It should track
roughly `active subscribers × price × time`. If it flatlines while signups continue,
either your account list is stale or something upstream broke. It is also just the number
you want for a revenue dashboard.

**4. Lapses.** Every `Lapsed` event is churn you might have prevented. This is your
highest-value business metric: unlike Stripe there is no failed-payment retry, so a
customer who forgets to top up is gone silently. Email them at `paidThrough - 7 days`.
Wire the reminder to the event stream, not to a database, so it is always right.

**5. USDC itself.** USDC is an upgradeable contract with a blacklist, run by Circle. They
can freeze an address — including this contract's, which would strand every deposit — and
they can change the token's behaviour by upgrade. Nothing you can do about it beyond
knowing it is there and holding treasury balances somewhere you can move quickly. This is
a real dependency you are taking on and it is worth naming out loud rather than treating
"stablecoin" as a synonym for "safe".

**6. Stranded raw transfers.** Someone will `transfer` USDC directly to the contract
instead of calling `deposit`, because someone always does. That money is credited to no
account and there is no sweep function to recover it — I left one out on purpose, since
"operator can move tokens out of the billing contract" is a much worse power to hold than
the occasional stranded $5 is a problem to have. Make the deposit flow in your frontend
obvious enough that it doesn't come up.

**7. Reorgs, briefly.** On an L2 a fresh deposit could in principle be reorged out and a
customer gets a few seconds of service they didn't pay for. At $5/month this is not worth
engineering against. It matters for the treasury, not the gate: wait for finality before
you treat swept revenue as final in your accounting.

**8. Dust and rounding.** Accrual truncates, always in the customer's favour, by under
one millionth of a dollar per settlement. It is in the fuzz tests
(`testFuzz_refundPlusRevenueEqualsDeposit`) and it will never be visible to you.

---

## 5. Where the offchain half sits

The backend does two separate jobs and it is worth keeping them straight.

**Proving the caller is the address** (`backend/src/auth.ts`). `isSubscribed(0xAlice)`
answers a question about Alice, not about whoever is holding the HTTP connection.
Everything onchain is public: anyone can read the logs, find a funded subscriber, and
send you their address. Without a signature step, your billing contract is a public list
of addresses that get free weather data. So: sign a nonce once, get a one-hour bearer
token, present the token per request. Verification goes through `verifyMessage`, which
handles both EOAs and — via ERC-1271 — smart accounts, which will be a good chunk of your
customers.

Note the seam: a bearer token outlives a cancellation by up to its TTL. Shorten the
session TTL if that bothers you; an hour of free weather data does not bother me.

**Checking the subscription** (`backend/src/gate.ts`), covered in §4.

Both stores are in-memory. The moment you run two API processes, move the challenge
nonces and the session records to Redis, or customers will get "unknown nonce" errors
whenever the load balancer sends them to the other box.

Run the end-to-end tests — they spin up anvil, deploy, subscribe, time-travel past
expiry, cancel, and simulate an RPC outage:

```bash
forge test                       # 41 contract tests, including solvency fuzzing
cd backend && npm test           # 12 tests against a live local chain
```

---

## 6. What this design gives up

Every onchain system trades something away. Here is this one's, in plain terms.

### Can anyone be stopped from using it?

**Onchain, mostly no — with one exception I shipped on purpose.**

The powers that exist, in full:

| Power | Who | What it does to a paying customer |
|---|---|---|
| `endSubscriptions(accounts)` | treasury | **Ends their subscription immediately.** Cuts off access. Does *not* take their money: they keep every unit not yet streamed and can withdraw it whenever, with no cooperation from you |
| `closePlan(id)` | treasury | Blocks *new* signups on that tier. Existing subscribers are untouched and keep their locked price |
| `addPlan(price)` | treasury | Adds a tier. Cannot alter an existing one |
| `transferTreasury` | treasury | Two-step handover of where revenue lands |

`endSubscriptions` is the honest asterisk on this section. It exists because winding the
API down otherwise means subscribers keep being metered for a service that no longer
answers — closing the plans stops signups but does nothing for people already streaming.
It is nevertheless a power over a paying customer's access, usable against any address, at
any time, for any reason. It is bounded: it can cancel you, it cannot charge you for time
you weren't served, and it cannot move your remaining balance anywhere except back to you.

What does not exist, deliberately: no pause, no upgrade proxy, no blacklist, no admin
withdrawal of user deposits, no price setter, no clawback of a refund. The contract is
immutable — what is deployed is what runs, forever. Nobody, including you, can raise a
subscriber's price or take a deposit that the stream has not earned. The solvency fuzz
tests assert this: every unit deposited is either revenue for time actually served or
refundable to the depositor, in every sequence they try.

**If the treasury key is lost:** customers are entirely unaffected. They keep subscribing,
keep being billed, keep cancelling, keep getting refunds — none of that touches the
treasury. What breaks is you: `withdrawRevenue` still works (it is permissionless) but it
pays out to an address you can no longer spend from, so your revenue accumulates
somewhere unreachable, and you can never add or close a plan again. Losing this key costs
you your income, not your customers' money.

### Could someone else run it?

Split it in half honestly.

**Survives you disappearing:** the contract and everything in it. Balances, plans,
`paidThrough` for every account, the entire billing history in the logs. Anyone can read
it from any node. Every customer can call `cancelAndWithdraw()` and get their unused money
back with no involvement from you or anyone else — that is the part that genuinely does
not depend on you being alive. Anyone can deploy this same code and run their own billing
for their own API; it is a couple of hundred lines with no dependency on any service of
mine.

**Dies with you:** the weather API. Which is to say, the product. The data, the servers,
the RPC connection, the auth service, the gate cache, the dashboard — all of it runs on
infrastructure only you control, and none of it is reproducible from what is onchain.
Someone forking the contract gets a billing system with nothing behind it.

So: a customer whose provider vanishes gets their money back automatically and correctly,
which is a real and unusual guarantee, and gets no weather data, which is the whole point
of the service. Verifying the contract on the block explorer does not change this and it
is worth not confusing the two — verified source means people can read what they are
paying into, not that anyone else could serve the forecasts.

### What does an observer learn?

Everything, permanently, including your competitors.

Anyone can read off the chain, forever, with no special access:

- **Your full customer list.** Every address that ever subscribed.
- **Your revenue, live.** Subscriber count × tier is right there. Anyone can compute your
  MRR more accurately than you can, and watch it move week to week.
- **Who is on which tier**, when they signed up, when they cancelled, how long they
  lasted. Your churn curve is public.
- **Each customer's linkable wallet history.** The address paying you for weather data is
  usually the same address doing everything else onchain — their token holdings, their
  other subscriptions, their NFTs. Your customers are exposing more about themselves to
  you and to everyone else than they would by typing a card number into Stripe. Some of
  them will not have thought about that.

This is a genuine downgrade from Stripe on privacy, in both directions, and it is not
fixable with configuration — it is what putting billing on a public ledger means. If it
matters for your market, the mitigations are real but structural (pay via a fresh address
per customer, or move to a system where subscription proofs are zero-knowledge), and both
are considerably more work than this.

Note this is a different question from access control on your endpoints. Your API keys,
your logs and your request data are yours and are not published by any of this. What is
published is the billing relationship.

### What does "audited" cover?

Nothing here, because none of this has been audited. What it has is 41 contract tests
including fuzzed solvency invariants, and 12 end-to-end backend tests against a live
chain. That is not the same thing and should not be presented to customers as though it
were.

If you get an audit, be precise about what you would be buying: a point-in-time review of
a fixed scope by specific people. It says something about the exact bytes reviewed on the
day they were reviewed. It is not a standing guarantee about the code running now, it does
not cover your backend, your RPC provider, or USDC, and it does not transfer when you
redeploy with a change. "Audited" on a landing page usually implies far more than the
document behind it says.

Given the amounts — a few hundred dollars of float at hobby scale — my honest read is that
a full audit is disproportionate here and the money is better spent on a bug bounty and on
keeping the float small by sweeping revenue regularly. Revisit that if this ever holds
five figures.

---

## 7. Things I'd flag for later

- **No auto-renew, by design, and it will cost you churn.** Nothing in this system can
  pull from a customer's wallet; it can only spend what they pushed. That is the property
  that makes it safe to hand your address to, and it is also why customers will lapse.
  Invest in the reminder email; it is the highest-leverage thing you can build on top of
  this.
- **The plan list is append-only.** Fine for two tiers. If you expect to iterate on
  pricing a lot, you will accumulate closed plans; that is cosmetic, not a problem.
- **Usage-based billing is not in here.** If you later want per-request pricing rather
  than flat monthly, that is a different contract — metering usage onchain means somebody
  pays gas to record usage, and at fractions of a cent per API call the gas exceeds the
  charge. The usual answer is to keep the meter offchain and settle periodically against
  a deposit, which is a bigger change than it sounds.
- **One contract per chain.** Customers on Arbitrum cannot pay a contract on Base. Pick
  one chain and say so loudly in your docs.
