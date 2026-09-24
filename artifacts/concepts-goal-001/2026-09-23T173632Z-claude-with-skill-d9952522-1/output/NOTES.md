# Onchain billing for the weather API — running notes

## The one idea worth holding onto

There is no charge day.

Stripe has a cron job that wakes up on the 1st and charges everybody. A contract
has nothing like that. It is a state machine that moves only when someone sends
a transaction and pays gas for it; between transactions it does nothing at all.
So "charge them monthly" cannot be a scheduled job here — it has to be something
someone has a reason to do, or it silently never happens.

The way out is to not have a charge event at all. Plans are priced per 30 days,
but the debit is derived, not performed: the contract stores when an account was
last settled, and anyone reading it computes what's owed from the clock. A
subscription is active exactly while the prepaid balance still covers the current
second. Nobody has to poke anything for that to be true, and the answer is
identical whether the last transaction was a minute ago or eight months ago.

Three things follow, and they're the reason the design is shaped this way:

- **Your backend's check is a free view call.** `isSubscribed(address)` reads
  state and does arithmetic. No indexer, no webhook, no cron, no gas.
- **Cancellation is exact, not generous.** A subscriber has already been debited
  for precisely the time they used, so "refund the unused part" is just "give
  back the remaining balance." There's no proration logic to get wrong.
- **Your revenue accrues whether or not anyone touches the contract.** The money
  is already in the contract. `settle()` only moves it from a subscriber's
  balance into a pot you can withdraw from — bookkeeping, not a deadline. If you
  went on holiday for three months and settled nothing, you'd lose nothing.

The tradeoff, stated plainly: a subscriber is billed continuously rather than in
monthly lumps. Someone who cancels on day 40 pays for 40 days, not two months.
That is what makes refunds exact; if you'd rather bill non-refundable whole
months, that's a different contract and a worse answer to "give back what they
haven't used."

## What's here

```
src/SubscriptionBilling.sol     the contract — the whole system, ~410 lines
test/SubscriptionBilling.t.sol  28 unit + fuzz tests
test/SubscriptionBilling.invariants.t.sol   stateful invariants (solvency, accounting)
script/Deploy.s.sol             deploy + seed the two plans
script/Ops.s.sol                Settle / WithdrawRevenue / AddPlan
script/e2e.sh                   full local rehearsal on anvil
backend/subscriptionGate.js     the per-request check, with caching
backend/server.js               example API: sign-in, gating, 402s
backend/checkOnce.js            one-shot "is this customer paid up?" for support
```

Foundry + viem. Target chain is Base — the per-transaction cost has to be small
next to a $5/month subscription, and on Ethereum mainnet a subscribe transaction
can cost more than a month of hobby. Base's USDC is Circle's native issuance, not
a bridged wrapper, which matters for getting paid out.

## First deploy

```bash
forge test                                     # unit + fuzz + invariants
./script/e2e.sh                                # full rehearsal on a local chain
forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify
# ...exercise it on testnet with a real wallet, then:
OWNER=0xYourSafe forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --verify
```

Set `OWNER` to a multisig (a Safe), not a hot key. The owner can't touch customer
money — see below — but it can create plans and move your revenue, and it's the
address customers will see as "the company."

Note the deploy script only seeds the hobby and pro plans when the owner is the
deployer. If you deploy to a Safe owner (you should), call `addPlan("hobby",
5000000)` and `addPlan("pro", 20000000)` from the Safe afterwards. **Nobody can
subscribe until a plan exists**, and plan ids start at 1 — id 0 means "not
subscribed."

## Day to day

### Things that happen without you

Subscribing, topping up, switching plans, cancelling and withdrawing are all
customer-initiated. You are not in the path. A customer who wants to leave at 3am
on a Sunday leaves at 3am on a Sunday.

### Things you actually do

**Collect revenue.** Two steps, because accrued revenue lives inside subscriber
balances until it's settled:

```bash
BILLING=0x... ACCOUNTS=0xaaa,0xbbb,0xccc \
  forge script script/Ops.s.sol:Settle --rpc-url base --broadcast

BILLING=0x... TO=0xYourTreasury \
  forge script script/Ops.s.sol:WithdrawRevenue --rpc-url base --broadcast
```

Monthly is a sensible cadence; quarterly is fine too. The accrual doesn't stop or
expire if you skip it. Get the account list from `Subscribed` events — that's what
an indexer or a plain `getLogs` sweep is for; the contract deliberately does not
keep an onchain array of subscribers, because iterating one is how contracts run
out of gas at exactly the moment you have enough customers to care.

Cost: settling is ~23k gas per account on top of a ~21k base transaction, so a
batch of 100 is ~2.3M gas. On Base at the fees I'd expect that's well under a
dollar for the whole batch — call it fractions of a cent per subscriber against
$5/month of revenue. Check current Base gas before a large batch anyway; the
point is the margin is ~1000x, not that any specific number is durable.

`settle` is permissionless on purpose. Anyone can call it for anyone, including
a customer settling themselves, and it can't move money in the caller's favour —
it only crystallises an amount that was already owed. That means collection
never depends on your key being available.

**Change prices.** You can't. Not for existing subscribers — there is no setter
for a plan's price, deliberately. Someone who subscribed at $5 is at $5 until
they choose otherwise. To reprice, add a new plan and close the old one:

```bash
BILLING=0x... PLAN_NAME="hobby-v2" PLAN_PRICE=7000000 \
  forge script script/Ops.s.sol:AddPlan --rpc-url base --broadcast
# then setPlanOpen(oldPlanId, false) from the owner
```

Closing a plan only stops *new* signups. Existing subscribers keep running at
their agreed price until they cancel or switch. Migrating them is an email, not a
transaction — a nice property to have when the alternative is "we can silently
raise your rate."

### Support situations you'll actually get

- *"I deposited but the API still 402s."* They funded but never called
  `subscribe(planId)`. Depositing is not subscribing. Check with
  `BILLING_ADDRESS=... CUSTOMER=... node backend/checkOnce.js`.
- *"I was subscribed and now I'm not."* They ran out of balance. `expiresAt`
  tells you the exact second, and the `Lapsed` event fires when settlement
  notices. They top up and they're instantly back — the lapsed gap isn't billed,
  since they got no service during it.
- *"I want to cancel."* They call `cancelAndWithdraw(theirAddress)`. Don't do it
  for them; you can't, and that's the point.
- *"Can you refund me?"* Their unused balance is already theirs to withdraw.
  Anything beyond that — goodwill credit for an outage — you send by calling
  `depositFor(customer, amount)` with your own USDC.

## What to keep an eye on

**Your RPC endpoint.** This is the real operational risk and it isn't onchain at
all. Every API request depends on reading the chain. `subscriptionGate.js`
mitigates it with a 60s cache plus a 10-minute stale-while-error window, so a
short RPC outage doesn't 402 paying customers. But if your provider is down for
an hour, your API is degraded. Use a paid endpoint, have a fallback URL, and
alert on `/health` returning 503 — that endpoint exists specifically because RPC
reachability is the dependency that decides whether anyone can be served.

**`collectedRevenue` vs. the contract's USDC balance.** These should only ever
diverge by customer balances. `invariant_solvent` asserts it in the test suite;
worth a weekly script against mainnet too. If the contract's balance is ever less
than `totalCustomerBalance() + collectedRevenue()`, something is very wrong and
you should say so publicly rather than quietly.

**Lapse rate.** Count `Lapsed` events. A customer who lapsed silently is churn
you could have prevented with an email — nothing in the contract will warn them,
because a contract can't send email. `expiresAt` per subscriber is exactly the
"your balance runs out on the 14th" notice you should be sending. This is
probably the highest-value thing to build next.

**USDC itself.** It's a centralised, upgradeable, freezable token. Circle can
blacklist an address, including yours or the contract's. If your treasury address
were blacklisted, `withdrawRevenue` would revert — withdraw to a fresh address in
that case, since the ceiling is enforced in the contract, not by the destination.
Circle can also upgrade the token contract underneath you. This is an accepted
risk of billing in dollars onchain, not something this design fixes.

**Stray tokens.** People will send USDC directly to the contract address instead
of calling `deposit`. That money is *not* credited to them — `sweepSurplus` lets
you recover it (it can only take the excess over what's owed) so you can credit
them manually with `depositFor`. Watch for `Transfer` events into the contract
with no matching `Deposited`.

## What this design gives up

Worth writing down while it's fresh, because these are the questions that get
asked after something goes wrong.

**Can anyone be stopped from using it?** Not by you, in the ways that matter.
There is no pause, no blacklist, no upgradeable proxy, and no owner function that
can reach a customer's balance. The owner can do exactly three things: add a
plan, close a plan to new signups, and withdraw revenue that subscribers have
already consumed. Closing a plan can stop *new* people joining it — that's the
one lever over access, and it can't evict anyone already on it.

If the owner key is lost tomorrow: every customer can still subscribe to existing
open plans, top up, cancel and withdraw everything unused, and your backend's
check keeps working. What stops is you being able to add plans or collect
revenue — the accrued money would sit in the contract, unreachable, forever.
That's the failure mode, and it's the reason the owner should be a multisig.

You can, of course, still refuse to serve someone from your API. That's your
server, not the chain, and no contract design constrains it.

**Could someone else run it?** Half of it, honestly. The contract and all its
state are public: anyone can read who's subscribed, fork the contract, or build a
rival frontend for topping up. Verifying the source on Basescan is worth doing
but it is not the same thing as this — it makes the code readable, not the
service reproducible.

What only you run: the weather API itself, the RPC connection, the API-key store,
and the sign-in flow. If you disappear, a customer can still get their unused
USDC back without your help — genuinely, with no cooperation from you — but they
cannot get weather data, and their API key is meaningless. The billing survives
you; the service does not. That's the honest split.

**What does an observer learn?** Everything, permanently. Every subscriber's
address, plan tier, top-up amounts, exact subscribe and cancel timestamps, and
your total revenue are public forever and trivially queryable. A competitor can
compute your MRR, see your churn the day it happens, and get a list of your
customers' addresses — which, given those addresses do other things onchain, is
often enough to identify the customer. Your customers should know this before
they sign up; put it in the docs. If that's unacceptable for a given customer,
the answer is an offchain invoice, not a clever contract.

Separately: the API key issued by `server.js` is a normal bearer token and is not
public. Access control on your endpoints and privacy onchain are different
questions — don't let anyone conflate them.

**What about "audited"?** This isn't audited. It has 28 unit and fuzz tests plus
stateful invariants covering solvency, accounting and refund correctness, and
`./script/e2e.sh` rehearses the whole flow on a local chain. That's a decent
floor, not a guarantee. If real money at meaningful scale is going to sit here,
get a review — and know that an audit is a point-in-time review of a fixed
scope, not a standing promise about whatever's deployed later.

## Details that will bite if you forget them

- **A "month" is 30 days**, fixed. Not a calendar month. A year is 12.17 billing
  months, so annual revenue per hobby subscriber is ~$60.83, not $60.
- **USDC has 6 decimals.** `$5` is `5000000`. Getting this wrong by 10^12 is the
  classic way to accidentally price a plan at five millionths of a cent.
- **The chain decides who you are, but not that it's them.** Anyone can claim any
  address. `server.js` makes the customer sign a nonce once and exchanges it for
  an API key; without that step your billing is an honour system. Don't skip it.
- **A new subscription needs at least a day of runway** (`MIN_RUNWAY_ON_SUBSCRIBE`).
  Otherwise someone deposits $0.02, sees "subscribed" in their wallet, and every
  API call fails anyway.
- **`subscribe` while already subscribed switches plans**, billing the old plan up
  to that second first. Switching is never retroactive in either direction.
- **`block.timestamp` is what all of this runs on.** A block producer can nudge it
  by a few seconds. At $5/month that's worth roughly 0.0002 cents, so it doesn't
  matter here — but it's why the `e2e.sh` assertions carry a tolerance, and it's
  worth knowing before you ever build something where seconds are worth money.

## If you want to extend this

In the order I'd do them:

1. **Expiry emails.** Sweep `expiresAt` for all known subscribers daily, email
   anyone under seven days. Pure offchain work, biggest revenue impact.
2. **A top-up page.** Right now a customer needs a block explorer or cast to
   subscribe. A small wagmi/viem frontend with a permit-based deposit
   (`depositWithPermit` is already there, so it's one signature and one
   transaction) removes most of the drop-off.
3. **An indexer.** Even a small script writing `Subscribed` / `Deposited` /
   `Cancelled` / `Lapsed` events into Postgres gives you the customer list
   settlement needs, plus every metric you'd want.

If you want to understand the moving parts by building one yourself rather than
reading someone else's contract, https://speedrunethereum.com is the good path.
