# Running this thing

Written for you, the person who has to live with it. Contract is `src/SubscriptionBilling.sol`.

---

## 1. The one idea

There is no cron onchain. A contract does nothing between transactions — no scheduler, no timer,
no background process. So "charge every subscriber on the 1st" is not a feature you enable, it is a
transaction somebody has to send, per subscriber, every month, forever, paying gas each time. If
that somebody is you, billing stops the week you are on holiday. If it is a bot you pay, the fee
for pushing a $5 charge eats a real slice of the $5.

So nothing is pushed. The plan has a price per 30 days, the prepaid balance drains against it per
second, and **every read recomputes the position from a stored timestamp**. Between actions the
stored state is stale and that is fine, because nobody ever trusts the stored number directly.

The consequence you will feel day to day: **`isSubscribed` goes false on its own.** A customer who
runs out of money at 4am on a Sunday is refused at 4am on a Sunday, and no transaction was sent by
anyone to make that happen. Same for refunds — the meter was never rounded to a month, so "give
back what they have not used" is just `balance − accrued`, exact to the second.

### One thing this changes about your pricing

You asked for "charged monthly". What is actually implemented is **$5 per 30 days, metered per
second**. Practically identical for the customer, and it is what makes cancel-anytime refunds
honest, but two consequences to know:

- A year has 12.17 thirty-day periods, so the hobby plan bills **$60.83/year, not $60**. Calendar
  months would need a calendar onchain, which is not worth the code.
- A customer who signs up and quits after two days pays about 33¢, not $5. If you wanted a
  minimum charge, that would be a deliberate addition — there is none today.

---

## 2. Every transaction in the system

This is the whole list. If a state change is not here, it does not happen.

| What | Who sends it | Why they would | If it never happens |
|---|---|---|---|
| `subscribe(planId, topUp)` | customer | they want the API | no subscription |
| `deposit(account, amount)` | customer (or anyone, for them) | keep working past their paid-through date | they lapse and get 402s |
| `cancel()` / `cancelAndWithdraw(to)` | customer | stop paying, take the remainder | meter keeps running until the money is gone |
| `withdraw(to, amount)` | customer | take money back out | nothing; funds stay theirs |
| `settle(account)` / `settleMany(accounts)` | **you**, before collecting | it books money you have already earned | accrual keeps counting; you just have not banked it yet |
| `withdrawRevenue(to, amount)` | **you** | it is your revenue | it sits in the contract, safe, unspendable |
| `createPlan` / `setPlanOpen` | you | pricing changes | prices stay as they are |

**There is exactly one recurring job — collecting — and it pays for itself.** Skipping it costs you
nothing but delay: the accrual keeps running from the stored timestamp whether or not anyone calls
`settle`, and `claimableRevenue()` always tells you the true number. Nothing in this system needs a
stranger to be paid to keep it alive, and nothing breaks if you disappear for a month.

`settle` is permissionless — anyone may call it for anyone — but it deliberately pays no caller
reward, because nothing depends on it being called. It moves no money in or out and changes nobody's
refundable balance; it only moves the earned portion from the "customer float" bucket to the
"revenue" bucket so you can withdraw it. There is no keeper to fund and no bounty to get wrong.

---

## 3. Day to day

### Collecting (monthly, or whenever)

```bash
BILLING_ADDRESS=0x… forge script script/Ops.s.sol:Collect --rpc-url base --broadcast --account ops
```

Settles everyone in batches of 100, then withdraws everything booked. At roughly 30k gas per
subscriber, 100 subscribers costs a few cents on Base. Do it monthly. Do it quarterly if you like —
you are only delaying your own payout.

At a few thousand subscribers, stop settling everyone: settle only accounts with meaningful accrual
and let the dust wait. It is your money either way and it does not evaporate.

### Watching the money

```bash
BILLING_ADDRESS=0x… forge script script/Ops.s.sol:Status --rpc-url base
```

Prints subscriber count, booked revenue, revenue including unsettled accrual, customer float, and
how many people are holding a plan but have run out of money — that last number is your dunning
list.

### Changing prices

There is deliberately **no way to reprice a live plan**. `setPrice` does not exist; the test suite
asserts it. Repricing would silently re-rate the balance someone already paid in, which is the kind
of thing that ends up on Hacker News.

To raise the hobby plan to $8: `Ops.s.sol:Reprice` creates plan 3 at $8 and closes plan 1 to new
signups. Existing plan-1 subscribers keep paying $5 for as long as they stay. They move only by
calling `subscribe(3, …)` themselves, which settles their old rate to the second and starts the new
one. Old plans never need deleting; closed just means "no new signups".

### When a customer says "I paid but I'm locked out"

```bash
cast call $BILLING "accountOf(address)(uint32,uint256,uint256,bool)" $THEIR_ADDRESS --rpc-url base
```

Returns plan id, refundable balance, paid-through timestamp, and whether they are live right now.
That is the same call the API gate makes, so if this says `true` and your API says no, the problem
is your cache or your RPC, not the contract.

Common causes, in order: they topped up a *different* address than the one they signed in with; they
are on the wrong chain; they are within the gate's 30-second cache window; your websocket dropped.

### Goodwill credits

`deposit(account, amount)` lets *anyone* fund *anyone*. If the sequencer was down for six hours and
customers were metered for time they could not use, you can credit them directly — no coupon system,
no support ticket. It is also how a company funds an employee's key.

---

## 4. The API gate

`backend/` is a working example, not a framework. Two things it does that are easy to get wrong:

**It authenticates the address.** Addresses are public. An unauthenticated "is this address
subscribed?" check is not authentication — anyone could paste a paying customer's address into a
header and use their subscription. So: nonce → signature → short-lived bearer token. Verification
goes through the RPC (`publicClient.verifyMessage`), so smart-contract wallets work via ERC-1271,
not just plain keys.

**It caches, but never past the money.** `accountOf` returns the exact second the balance runs out,
so an entry is cached until *the earlier of* a 30-second TTL and that lapse timestamp. A
subscription can never silently outlive its funding, because the contract told the cache when the
funding ends. Contract events (deposit, withdraw, subscribe, cancel) invalidate entries immediately
over a websocket.

**Decide your RPC-outage policy before it happens.** The example fails closed: no answer from the
chain, no service. For a hobby-project API that is probably the wrong call — your customers prepaid,
and punishing them because your RPC provider is having a bad afternoon converts your outage into
their outage. A better policy, which you should write in deliberately: keep serving from the last
known-good status for up to N minutes past its TTL when the RPC is unreachable, log loudly, and only
then start refusing. Either way it should be a decision, not an accident.

Two smaller things: use two RPC providers, because a single free-tier endpoint is a single point of
failure for your entire revenue check; and remember an L2 can reorg a very recent top-up, so a
customer served on a two-second-old deposit might briefly not have paid. At these amounts, ignore it
— just do not build anything expensive on a single unconfirmed block.

---

## 5. What to watch

**Alarm on these:**

- `token.balanceOf(billing) < totalPrepaid() + accruedRevenue()`. This should be impossible; the
  invariant tests hammer it. If it ever trips, stop and investigate — it means the accounting and
  the actual tokens have diverged.
- Gate error rate / RPC failures. This is the path between a paying customer and your service.
- Gas balance on the ops key. It is the only key that needs ETH, and only for collecting.

**Watch weekly:**

- `claimableRevenue()` — your real MRR signal, unsettled accrual included. It loops over every
  subscriber, so somewhere in the thousands it will start bumping an RPC's `eth_call` gas cap; at
  that point page through `subscribers()` and sum offchain.
- Count of "holds a plan, out of money" (in `Status`) — people who intended to keep paying and did
  not notice. Every one of them is a 402 loop that a single email would fix.
- `totalPrepaid()` — this is **customer money, not yours**. In accounting terms it is deferred
  revenue: a liability you owe back on demand. The contract enforces this (you cannot withdraw it),
  but your books should say the same thing. Only `accruedRevenue` is earned.
- Chain status page for your L2, and the gas price on it. If a top-up ever costs a noticeable
  fraction of $5, the economics have changed and you should reconsider the chain.

**Watch when it changes:** Circle's USDC contract addresses, and any announcement about the token
itself. Your entire billing system is denominated in a token another company controls.

---

## 6. What this design gives up

Nobody asked, but this is the part that matters later.

### Can anyone be stopped from using it?

**By you: almost nothing.** This is not scaffolding I forgot to flag; it is the deliberate shape of
the thing, and you should know exactly what you traded away.

There is no pause, no upgrade proxy, no blacklist, and no owner path to customer funds. Your owner
key can do exactly four things: add a plan, open or close a plan to new signups, withdraw revenue
that has already been earned, and hand ownership to someone else (two-step, so a typo cannot lose
it). It cannot stop a specific customer from subscribing, cannot take a prepayment before the
service time behind it has elapsed, and cannot stop anyone from cancelling and walking away with
their remainder.

The flip side, and it is a real cost: **there is no emergency stop.** If a bug turns up in this
contract, you cannot freeze it. Your only move is to deploy a fixed contract, point the API at it,
and ask customers to cancel and re-subscribe — during which the old contract keeps running exactly
as written. I think that is the right trade for billing at this size, where the money at risk is a
few months of prepaid hobby subscriptions and the alternative is a pause button that is itself the
most attractive thing to attack. It would be the wrong trade at a hundred times the float.

**If your owner key is lost:** customers are entirely unaffected. They keep subscribing, cancelling
and withdrawing forever. What dies is your ability to withdraw revenue — it accumulates in the
contract, permanently unreachable. Use a multisig, or at minimum know where the backup is.

**By others, and this is the one to actually worry about: Circle can.** USDC has a blacklist and an
upgradeable implementation. Circle can freeze a specific customer's address, and Circle can freeze
*this contract's* address — at which point refunds stop, revenue withdrawal stops, and everyone's
prepaid balance is stuck. Nothing in this design mitigates that. You chose a dollar-denominated
token issued by a company, and that is the price of the dollar peg.

**And you can still stop people the ordinary way.** The contract will happily tell your backend that
an address is subscribed while your backend refuses to serve it. Onchain billing removes the payment
processor from the loop; it does not turn your API into a public utility.

### Could someone else run it?

Split it in half honestly.

*Survives you disappearing:* the contract and everything in it. Anyone can read `isSubscribed`,
anyone can subscribe, and — the part that matters — **every customer can get their unused money out
without your cooperation**, because `cancelAndWithdraw` needs nothing from you. Verify the source on
the block explorer so people can check that for themselves; a verified contract is table stakes, not
the answer to this question.

*Dies with you:* the weather data, the API, the gate, the frontend, the RPC endpoint. Someone could
fork the billing contract in an afternoon. They could not fork your service. If you shut down
tomorrow, a customer with $12 of prepaid balance can recover the $12 and gets no more forecasts —
which, honestly, is a much better outcome than they get with Stripe, where the money is gone into a
dispute process. Worth saying out loud on your pricing page.

There is one dependency worth removing that most designs leave in: the contract keeps its own
subscriber list, so `Ops.s.sol:Collect` works from onchain state alone. You do not need an indexer,
a database, or a subgraph to get paid. If your entire offchain stack is on fire, you can still
collect revenue with `forge` and an RPC URL.

### What does an observer learn?

Everything, forever. Specifically:

- Every customer address, and every plan tier each one is on. Anyone can page through
  `subscribers()` and read your customer list off the chain.
- **Your revenue, live.** `claimableRevenue()` is your MRR. A competitor can watch it grow, watch
  churn, and time an announcement against your bad month. There is no version of this that is
  private-by-default; that is what a public ledger is.
- Every top-up amount and every cancellation, timestamped, permanently.
- Anything else those addresses do. If a customer pays from the address that holds their NFTs, you
  now know things about them you did not ask for and cannot un-know. Say in your docs that a fresh
  address is fine — because it is, and some of them will want that.

What *stays* private is what your API is asked for. The chain sees that address 0xabc is on the pro
plan; it does not see that they pull Berlin's forecast every ten minutes. That log is yours, with
all the ordinary obligations that carries.

Access control on your own endpoints is a separate question from this one, and worth not confusing:
locking down your admin API does nothing about the fact that your customer list is public.

### What does "audited" cover?

Nothing here has been audited. What exists is 35 tests — unit, fuzz, and four invariants driven by
a random-action handler — asserting that tokens are always fully accounted for, that nobody can go
into debt, and that `isSubscribed` agrees with the funding math at every instant.

If you do commission an audit later: an audit is a point-in-time review of a fixed scope, not a
standing guarantee about the code running now. It says "these people looked at this commit for this
long". Every line you change afterwards is unaudited again, and "audited" on a landing page has
talked more people into more losses than almost anything else in this industry. Given the amounts
here, my honest advice is to skip the audit, keep the float small, and spend the money on a bug
bounty instead.

---

## 7. Failure drills

**Sequencer / L2 down for hours.** Nobody can top up, subscribe or cancel. Accrual keeps running,
so customers are metered for time they could not use, and some will lapse while unable to do
anything about it. Accepted risk. Afterwards, credit affected accounts with `deposit(their, amount)`
— you do not need their signature to give them money.

**Your RPC provider dies.** Gate can't check subscriptions. See the outage policy above; have a
second provider configured before you need it.

**Owner key compromised.** The attacker can withdraw earned revenue and add plans. They cannot touch
prepaid balances, cannot stop customers withdrawing, and cannot upgrade anything. Move ownership
(two-step) and collect more often in the meantime so less sits booked.

**A customer disputes a charge.** There is no chargeback. Refund them by sending USDC directly, or
credit their account with `deposit`. Your call, entirely offchain, as it should be.

**A bug in the contract.** No pause exists. Deploy a fix, migrate customers, communicate. Because
`cancelAndWithdraw` never needs your cooperation, customers can exit while you sort it out — that
property is what makes "no pause" survivable.

---

## 8. Deliberately not built

- **Auto-renew from a card, or a signed permit that lets you pull.** Both reintroduce a scheduled
  push transaction and someone who has to send it. Prepaid float avoids the whole category.
- **`permit`-based deposits** (top up in one transaction instead of approve-then-deposit). USDC
  supports it and it is a real UX win; it is just extra surface I did not want in v1.
- **A minimum charge, trial periods, annual discounts, usage-based tiers.** All doable; none asked
  for. Usage-based in particular would drag per-request metering onchain, which is a different and
  much more expensive design.
- **An indexer, a dashboard, a frontend.** `Status` and `cast` cover the operator side. Customers
  need *something* to top up with — a page with two buttons is the smallest version.
- **Multi-token or multi-chain.** The token is immutable per deployment, on purpose. Want ETH
  billing or another chain? Deploy a second instance; they are independent.
