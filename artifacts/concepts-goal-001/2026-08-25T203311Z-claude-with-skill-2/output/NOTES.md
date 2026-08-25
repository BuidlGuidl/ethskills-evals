# Running this thing

Notes for the person who has to live with this after it ships. Written for the operator of the
weather API, not for a smart contract auditor.

---

## 1. The one idea the whole design rests on

Nothing onchain runs on a schedule. There is no cron, no timer, no background process, and no
"charge everyone on the 1st". A contract is a state machine that only moves when somebody sends a
transaction and pays for it. So "charged monthly" is not a feature you can just write down — it is
a transaction, and somebody specific has to send it and want to.

The usual way people build this is a keeper: a script you run that loops over your subscribers
once a month and charges each one. That works right up until your server is down, your hot wallet
runs out of ETH, gas spikes, or you go on holiday — and then your customers are silently unbilled
or silently cut off, and the failure is invisible until it isn't.

So this contract does not have that. Instead:

- A subscriber prepays USDC into their own balance.
- Their cost accrues **continuously**, at their plan's rate, from a timestamp.
- Every read — `isSubscribed`, `paidThrough`, `previewRefund` — computes the current answer from
  `block.timestamp` at the moment you ask. Nobody has to have poked anything for it to be right.
- A subscription ends by **running out of prepaid balance**. That happens by the clock moving,
  which costs nobody a transaction and cannot fail.

`settle` exists only to write down a number that is already true: it moves accrued usage out of
the subscriber's balance and into your withdrawable pot. **If you never call it, nothing breaks.**
No subscriber is over- or under-charged, nobody's access changes, and you lose no money — the
funds cannot leave the contract by any path that does not settle first. `cancel` settles on the
way out, so a customer leaving pays you automatically.

That is the property to hold onto: **there is no transaction in this system that has to happen and
that nobody is paid to send.** Every state change is sent by the person who directly wants it.

| Transaction | Who sends it | Why they would | If it never happens |
|---|---|---|---|
| `subscribe` | the customer | they want API access | they have no access; nothing else is affected |
| `topUp` | the customer | keep access past their runway | they lapse at `paidThrough`, accrue **no debt**, can return any time |
| `cancel` | the customer | get their unused USDC back | their balance keeps draining at the plan rate until empty; nothing is seized |
| `settle` | anyone — in practice you | it makes your revenue withdrawable | nothing. The numbers are already true and the money is already yours |
| `collect` / `withdrawEarnings` | you | it is your money | your revenue sits in the contract |
| `createPlan` / `setPlanOpen` | you | you want to change pricing | prices stay as they are |

No liquidation bonus, no caller fee, no keeper subsidy — because there is no chore to bribe a
stranger into doing.

---

## 2. Day to day

### Getting a customer on

Two transactions, both sent by them, both from any wallet:

1. `USDC.approve(billing, amount)`
2. `billing.subscribe(planId, amount)` — plan 1 is hobby ($5/30d), plan 2 is pro ($20/30d)

`subscribe` requires at least one full period up front (so $5 or $20 minimum). Whatever they
deposit beyond that is runway: $15 on hobby is three months.

They do not need you for any of this, and there is no account to create. Your signup page can be a
Basescan link if you want it to be.

### Checking a subscription on every request

`backend/subscriptionGate.js`. The naive version — one `eth_call` per incoming request — is
correct but puts your RPC provider in the hot path of your whole API. The gate wraps it:

- A "yes" is cached until `min(paidThrough, now + 60s)`. `paidThrough` floors its division, so it
  is never *later* than the real lapse moment; caching against it can only ever cut someone off a
  second early, never let a lapsed account through.
- The 60-second TTL is what bounds the other two ways a "yes" can go stale early: the customer
  upgrading to a pricier plan, or cancelling. Both emit events, and the gate watches for them and
  drops the cache entry immediately — the TTL is the fallback for when the log subscription drops.
- A "no" is cached for 5 seconds, so someone spamming your API unsubscribed doesn't cost you an
  RPC call per request, but a new signup goes live almost immediately.
- Concurrent requests for the same address collapse into one RPC call.

**Two questions, and conflating them is how you get robbed.** The contract answers *"is address X
subscribed"* for anybody who asks. It says nothing about *"is this request actually from X"*. If
your API lets a caller name an address in a header, anyone can name your biggest customer and read
your API for free. `backend/exampleServer.js` shows the binding: the customer signs a single-use
challenge, you verify it (`verifyMessage` also handles ERC-1271, so Safes and smart accounts work
— worth keeping, a business paying in USDC often pays from a multisig), and you hand back a
short-lived bearer token bound to the address they proved.

Failure policy is fail-closed with grace: if the RPC is unreachable, anyone whose cached
`paidThrough` has not yet passed keeps being served for up to 10 minutes; anyone you've never seen
gets a 503. Serving a cancelled customer for ten minutes costs cents. Refusing every paying
customer because your RPC provider hiccuped costs a lot more.

### Getting paid

Whenever you feel like it:

```
BILLING_ADDRESS=0x... SUBSCRIBERS="0xa,0xb,0xc" \
  forge script script/Ops.s.sol --sig "collect()" --rpc-url base --broadcast --account deployer
```

That settles those subscribers and sweeps everything withdrawable to you in one transaction. You
get the subscriber list by indexing `Subscribed` events — there is deliberately no onchain array
of subscribers, because iterating one is a gas bomb waiting for the day you succeed.

There is no deadline on this and no penalty for skipping it. Monthly is fine. Quarterly is fine.
The only thing you lose by waiting is the time value of money.

`forge script script/Ops.s.sol --sig "books()"` prints the three numbers that matter:

- **subscriber float** — USDC you are holding that is not yours. It is theirs until it accrues.
- **withdrawable** — settled revenue, yours right now.
- **unsettled usage** (`pendingCharge` per subscriber) — earned, yours, just not written down yet.

### Changing prices

You can't reprice an existing subscriber. That is deliberate, and it is the single most important
promise this contract makes to the people paying you: `Plan.pricePerPeriod` is immutable once
created, and there is no function that changes it.

To raise prices: `createPlan(newPrice)`, then `setPlanOpen(oldPlanId, false)`. New signups get the
new price. Existing subscribers keep the old one, keep topping up at it, and switch only if they
choose to. Closing a plan does not touch anyone on it — same price, same balance, still able to
top up, still able to cancel for a refund.

If that rigidity is a problem for you later, the fix is a new deployment, not an upgrade — there
is no proxy here.

### Shutting the service down

Close every plan so nobody new joins, then tell your customers to `cancel()`. They get their
unused USDC back without needing anything from you. Anyone who doesn't cancel keeps being billed
until their balance runs out, so give real notice — a month of silence costs a pro subscriber $20.

---

## 3. What to keep an eye on

**Runway, and telling people about it.** Nothing onchain will remind a customer that they're about
to lapse. Not the contract, not their wallet, nobody. If you want renewals you need a job that
reads `paidThrough` for every active subscriber and emails them at, say, 7 days out. This is the
piece most likely to quietly cost you money, and it is entirely your problem — the contract's
"lapse silently, accrue no debt" behaviour is the right default for the *customer* and a churn
risk for *you*.

**Solvency, as an alarm.** `USDC.balanceOf(billing)` should always equal
`totalUserBalance() + operatorAccrued()`. The test suite proves this holds across ~16k randomised
call sequences. Alarm on any divergence anyway: downward should be impossible and would mean
something is badly wrong; upward just means someone sent USDC directly to the contract, which is
unrecoverable — there is no sweep function, on purpose, because a sweep function is also a way to
take money that isn't yours.

**Gas, and whether batching is worth it.** Measured on this code:

| | gas |
|---|---|
| `subscribe` | ~106k |
| `topUp` | ~81k |
| `cancel` | ~72k |
| `settle` (one) | ~42k |
| `settleMany` | ~25k marginal per extra subscriber |
| `isSubscribed` / `paidThrough` | ~5k, and it's an `eth_call` — free |

Cost = gas × gas price × ETH price. At **0.05 gwei and ETH at $3,000** (check Basescan, don't
trust this figure — it's an assumption, not a quote), `subscribe` is about **1.5¢** and settling
100 subscribers in one batch is about **38¢** to unlock up to **$500**. The incentive is not close
— but re-run that arithmetic before you deploy to a chain that isn't Base, because on L1 mainnet
`subscribe` at 20 gwei is roughly $6 and the whole hobby tier stops making sense.

**Burst-then-cancel.** Per-second refunds mean somebody can subscribe, hammer your API for an
hour, cancel, and pay about half a cent. The contract cannot fix this and shouldn't try — it's a
rate-limiting problem, and you need per-address quotas in the API anyway. Just don't assume "they
paid for a month" means "they'll only use a month's worth".

**USDC is not neutral money.** It is an upgradeable contract with a blacklist that Circle controls
and has used. If Circle blacklists this contract, refunds and withdrawals both stop dead and there
is nothing in this code that can help. If they blacklist a *customer*, that customer can't cancel
or get refunded. You picked USDC for good reasons and I'd pick it too, but it means the honest
answer to "can my money get frozen" is yes, by a third party neither of us controls.

**A "month" is exactly 30 days.** So a calendar year holds 12.17 of them, and the $5/month plan
bills $60.83 a year, not $60. Say "30 days" on your pricing page rather than "month" and nobody
will ever email you about it.

**Rounding always favours the subscriber.** Integer division floors, so each settlement drops a
fraction of a base unit — under $0.000001 each time — in the customer's direction. This direction
is load-bearing: if it went the other way, anyone could spam `settle` on your customers to drain
them. There's a fuzz test pinning it.

**Reorgs.** A signup can be reorged out after your gate has cached the "yes". On Base this is a
sub-second concern and a $5 subscription is not worth engineering around; just know it's why the
gate's positive TTL exists at all. Don't reduce the TTL to zero thinking it makes you safer.

**Your RPC provider is a hard dependency of your API.** Watch `gate.stats` — `rpcErrors` and
`servedStale` climbing means your billing check is degraded even while requests still succeed.
Have a second provider configured.

**Key management.** The owner key can create plans, close plans, and withdraw settled revenue —
that's all. But if you lose it, settled revenue is stranded in the contract permanently, with no
recovery path. Use a multisig from day one; `Ownable2Step` means handing over requires the new
owner to accept, so you can't fat-finger it into a dead address.

---

## 4. What this design gives up

Answering this honestly matters more than the code, and nobody asked, so here it is.

### Can anyone be stopped from using it?

**Onchain: barely.** The powers I actually shipped are `createPlan`, `setPlanOpen`,
`withdrawEarnings`/`collect`, and `transferOwnership`. There is no pause, no blacklist, no
upgradeable proxy, no admin path to a subscriber's prepaid balance, and no way to reprice someone
who is already paying you. A subscriber can always cancel and always get their unused USDC back,
with no cooperation from you — there's a test that asserts exactly this, in a scenario where the
operator has vanished. If the owner key is lost, subscribers carry on entirely unaffected; only
*your* revenue is stranded.

**Off-chain: completely.** This is the part that would be dishonest to leave out. Your API can
refuse any address for any reason, and the contract will keep billing that person while you do
it. A customer can be fully paid up and locked out, and their only remedy is to notice and cancel.
The contract does not make your service censorship-resistant. It makes your *billing*
censorship-resistant, which is a much smaller claim.

And a step below that: USDC's blacklist is a censorship power neither of us holds, sitting under
the whole thing (see above).

### Could someone else run it?

Split it in half.

**Survives you disappearing:** the contract, plan definitions, every subscriber's balance and
plan, all the read functions, and `cancel`. Anyone can query those from any RPC or their own node,
forever, without your permission. Anyone can fork the contract and run a competing service on it.
Every customer can get their unused money out.

**Dies with you:** the weather API itself, the subscription gate process, the signature auth, the
RPC endpoint, the renewal emails — and therefore the entire point of the subscription. Someone
holding an active subscription to a dead API has a verifiable receipt and no weather data.

Verifying the source on Basescan is worth doing, but it is not this. It makes the code *readable*;
it doesn't make the service *runnable by someone else*. Nothing here changes that the useful half
of this product is a server you own.

### What does an observer learn?

Everything onchain is public forever, and this design publishes more than people expect:

- **Every customer's address**, their tier, and therefore who your pro customers are.
- **Exact amounts and timestamps** — when each signed up, how much they deposited, when they
  cancelled, how long they lasted.
- **Your revenue**. Anyone can sum the events and compute your MRR, customer count, and churn to
  the day. A competitor can watch you grow in real time. So can an acquirer.
- **Linkage.** A customer paying from an address they use elsewhere ties their weather-API
  subscription to their whole onchain history, permanently, whether or not they thought about it.

What is *not* published: which endpoints they call, how often, and what the responses were. That
lives on your servers and is governed by your privacy policy — a different question entirely from
this one, and answering that one does not answer this one.

If a customer cares, the mitigation available today is to pay from a fresh address used for
nothing else. Anything better (stealth addresses, offchain vouchers) is real work that isn't built
here.

### What does "audited" cover?

Nothing — this has not been audited. It has 35 unit and fuzz tests and 7 invariants exercised over
~16k randomised call sequences, plus an end-to-end run against a local chain. That is evidence,
not assurance.

And when you do get an audit: an audit is a point-in-time review of a fixed commit by people who
had a fixed number of days. It is not a standing guarantee about whatever code is deployed later,
and it never transfers risk to the auditor. Given this contract will hold customer float, get one
before you hold real money — but the honest version of "audited" is "somebody competent looked at
this exact commit and told us what they found".

---

## 5. Deliberately not built

- **Automatic renewal from an external balance.** Would need either a keeper (see §1) or an
  unlimited USDC approval you could drain. Prepaid runway does the same job without either.
- **EIP-2612 `permit`**, which would fold approve+subscribe into one transaction. Nice UX win,
  small extra surface area; worth adding if signup friction turns out to matter.
- **Free tiers / trials / discount codes.** All cheap to add as plans; none of them were asked for.
- **An onchain subscriber list.** Iterating it would be a gas bomb precisely on the day you get
  popular. Index the events instead.
- **A sweep for accidentally-donated USDC.** A function that moves tokens the contract doesn't owe
  anyone is also a function that can be pointed at tokens it does.

---

If any of this is unfamiliar and you'd rather learn it by building than by reading:
<https://speedrunethereum.com>.
