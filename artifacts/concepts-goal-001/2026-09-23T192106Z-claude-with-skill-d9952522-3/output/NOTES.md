# Running this thing

## What you actually deployed

A prepaid meter, not a recurring charge.

A customer deposits USDC into `Subscriptions` and picks a plan. The plan is quoted the
way you wanted it — $5 per 30 days, $20 per 30 days — but the contract drains their
balance continuously rather than in monthly bites. At any instant it can say exactly how
much they have used and how much is still theirs. Their subscription is alive as long as
there is balance left; it lapses the second the balance hits zero.

That single change is what makes the rest of your list work:

- **"charged monthly"** — they are, at the monthly rate. Thirty days of balance buys
  thirty days of service.
- **"cancel whenever, get back what they haven't used"** — the refund is just the
  remaining balance, accurate to the second. No proration logic, no end-of-cycle wait,
  no request to you.
- **"my backend can check per request"** — one `eth_call` to `statusOf(address)`.

## The thing to internalise: nothing renews itself

There is no cron on Ethereum. A contract only moves when someone sends it a transaction
and pays gas for it, and does nothing whatsoever in between. So there is no monthly
charge transaction in this system, because a monthly charge transaction would need
somebody to send it, every month, for every customer, forever — and the month it doesn't
get sent, you don't get paid.

Instead the charge is arithmetic over `block.timestamp`, evaluated whenever anyone reads
or writes the account. Nobody has to do anything for billing to be correct. If your
servers went dark for a year, every subscriber would still have been billed to the
second, and could still cancel and walk away with their unused balance.

The flip side, and it is the biggest practical difference from Stripe: **there is no
auto-renew.** Stripe pulls the card again on day 30. Nothing here pulls anything. A
customer who deposits $5 and forgets gets exactly 30 days and then stops working. Plan
for that under "churn by accident" below.

## Day to day: who sends what, and why they bother

Every state change is a transaction someone chose to send. Here is the whole list.

| Transaction | Sent by | Why they'd send it | Gas |
|---|---|---|---|
| `subscribe(planId, amount)` | customer | to start being served | ~118k |
| `topUp(account, amount)` | customer, or anyone | to not lapse | ~88k |
| `cancel(to)` | customer | to get their money back | ~73k |
| `withdraw(amount, to)` | customer | to take back part of the balance, staying subscribed | ~70k |
| `collect(accounts[])` | **you** | it moves your revenue somewhere you can withdraw it | ~61k for one, ~40k per extra account |
| `withdrawRevenue(to, amount)` | you | to get paid | ~40k |
| `addPlan` / `setPlanOpen` | you | pricing changes | ~50k / ~28k |

Customers send their own transactions for their own reasons, which is the only kind of
incentive that reliably holds. Note that `topUp` lets *anyone* fund *any* account — a
team lead can keep a shared key funded, and you can comp a customer a month by topping
up their address yourself.

### `collect` is the only recurring job, and it is not a deadline

`collect` moves balance that subscribers have already consumed into `earned`, where you
can withdraw it. It is **bookkeeping only**. Consumed balance is already unreachable by
the customer — `withdraw` and `cancel` both settle first, so they can never take back
money they've spent. Settling late loses you nothing. Settling early gains you nothing.
Expiry doesn't move. Service isn't interrupted. The only thing `collect` changes is
whether the money is in the "customer deposits" bucket or the "yours" bucket.

So run it when you actually want the money:

```sh
ACCOUNTS=0xaaa,0xbbb PAYOUT=0x... make collect
```

At ~40k gas per account, settling 100 accounts is about 4M gas. On Base at 0.03 gwei and
ETH around $3,000 that is roughly **$0.35 for the batch** — check `cast gas-price
--rpc-url base` before you size a run, but the shape is: the gas is rounding error
against $5–20 per subscriber per month, and you are free to batch it monthly or
quarterly. It is also permissionless, so if you ever want a keeper or a customer to
settle for you, they can.

What you must *not* do is build anything that depends on `collect` being run on time.
Nothing does, today. Keep it that way.

### Your backend

`backend/gate.mjs` is the per-request check. Two things in there are worth reading before
you ship:

1. **The address in a request is a claim, not a proof.** Your customers' addresses are
   public on Basescan the moment they subscribe. If the gate trusted an `X-Address`
   header, anyone could paste a paying customer's address in and get a free API. So the
   client signs a nonce once, and gets a bearer token bound to that address; the gate
   checks the chain using the bound address. The signature is a plain `personal_sign`,
   costs nothing, and moves no funds.

2. **Caching.** A positive answer is safe to cache until that account's `expiry`, because
   the only things that end a subscription sooner are the customer's own `cancel` or
   `withdraw`. The gate caps the cache at 60s anyway and also invalidates on events, so
   worst case you serve a cancelled customer for under a minute. That is a fine trade
   against an RPC round trip on every request.

## What to keep an eye on

**Solvency — the one that matters.** The contract must always hold at least
`totalDeposits + earned`. `make solvency` prints all three. If `balanceOf` ever drops
below the sum, something is very wrong and you should say so publicly before customers
find out. This is enforced by construction and covered by a stateful invariant test over
128k random call sequences, so it should never move — which is exactly why an alert on it
is cheap and worth having.

**Your RPC provider.** Right now your entire API's availability depends on being able to
read the chain. If the read fails and nothing is cached, `gate.mjs` returns 503 — it
fails *closed*, so an RPC outage locks out paying customers. Set `RPC_URL_FALLBACK` to a
second, unrelated provider. Alert on the `[gate] chain read failed` log line; it should
be silent.

**Customers about to lapse.** This is your churn. Query `statusOfMany` over your customer
list on a schedule and email anyone under ~7 days of runway. The gate already sends
`X-Subscription-Expires` and an `X-Subscription-Warning` header inside that window, but
a header only helps a customer who is looking. Assume most are not.

**Deposits versus revenue.** `totalDeposits` is float you are holding for customers, not
income. `earned` plus what you've already withdrawn is income. Do not mix them up when
you do your books, and do not spend the float — it is all refundable on demand, any
second, with no notice, and the contract will hand it over whether or not you have it
elsewhere.

**Gas balance on your operator key.** Small, but if it hits zero you can't collect or
withdraw. A few dollars of ETH on Base lasts a long time here.

**USDC sent directly to the contract.** People will do this instead of calling
`subscribe`, and it does nothing for them. `sweep` recovers the surplus — strictly the
amount above `totalDeposits + earned`, so it can't reach anyone's balance — but you'll
have to refund them by hand and you should expect the support ticket.

## What this design gives up

Worth writing down now, while it is still a choice rather than an incident.

**Can anyone be stopped from using it?** Almost, but not quite.

The powers you shipped are deliberately narrow. As owner you can (a) create new plans,
(b) open or close a plan to *new* signups, (c) withdraw revenue that subscribers have
already consumed. That is the complete list. There is no pause, no blacklist, no
upgradeable proxy, no admin function that touches a customer's balance or ends their
subscription. You cannot cut off a customer you dislike; you can only stop selling new
subscriptions and let existing ones run out. Plan prices are immutable once created, so
you cannot raise the rate on someone already subscribed — a price change is a *new plan
id* that a customer has to opt into.

If the owner key is lost or you walk away, subscribers are fine: billing keeps working,
existing plans keep working, and everyone can still cancel and collect their unused
balance forever. The only casualty is revenue — `earned` becomes unwithdrawable and
accrues in the contract, stranded. Given that, put the owner on a multisig rather than a
hot key, and treat `withdrawRevenue` as the one thing you must never lose access to.

The gap is the token. USDC is a centralised, upgradeable, freezable asset: Circle can
blacklist an address, including this contract's, and has. That would break deposits and
refunds, and nothing in this design prevents it. You are accepting that dependency in
exchange for a stable unit of account, which is almost certainly the right call for a
billing contract — but it means "nobody can stop a customer paying you" is not literally
true, and you should not claim it.

Separately, the service itself is yours and you can refuse to serve any request for any
reason. The contract says whether someone paid. It does not say you have to answer.

**Could someone else run it?** Half of it.

The contract and all its state are public, verified and forkable. Anyone can read who is
subscribed, compute their balance and expiry, and build a different frontend, a dashboard
or a competing gate against it. If you disappear, a customer can still call `cancel` from
Basescan's own UI and get their money back — no website of yours required. That half
survives you.

The other half does not. The weather data, the API, the RPC endpoint the gate depends on,
the sign-in flow and the token secret are all yours alone. If your servers go away, the
billing contract keeps billing correctly for a subscription to a service that no longer
answers — which is worse than useless. If you wind down, close both plans first so nobody
new pays in, and tell existing subscribers to cancel. They can, without you, but they
have to know to.

**What does an observer learn?** More than Stripe leaks, permanently.

Every deposit, plan choice, top-up, cancellation and refund is public forever, with
addresses attached. A competitor can read your entire customer list, count your
subscribers, see the hobby/pro split, watch your revenue accrue, see exactly when someone
churns, and follow a customer's address to whatever else it does onchain. Your customers
can see each other. None of this is hidden by a private RPC or a closed frontend; it is a
property of the ledger.

For hobby weather data that is probably fine, and arguably good — public books are a real
selling point for some buyers. But say it plainly in your docs so nobody is surprised,
and expect that customers who care will use a fresh address per service. The gate's
sign-in flow works fine with a burner.

This is a different question from access control on your own endpoints, which is entirely
in your hands and says nothing about what the chain publishes.

**What "audited" would cover.** Nothing here has been audited. What it has is a focused
test suite: 23 unit and fuzz tests plus three stateful invariants exercised over ~128,000
random call sequences, including solvency and conservation of funds. That is evidence,
not a guarantee, and it only covers the contract — not your backend, not your key
management, not USDC. If you ever do commission an audit, remember it is a point-in-time
review of a fixed scope, not a standing promise about whatever is deployed later.

## Things that will surprise you

- **Customers need ETH on Base for gas, and USDC on Base.** Not mainnet USDC — bridged or
  natively-minted Base USDC. This is real onboarding friction that Stripe does not have,
  and it will be your main support burden. Link to a bridge and an onramp in your docs.
- **Accidental churn is the default.** No auto-renew, remember. Nudge early.
- **Refunds are instant and unilateral.** A customer can cancel and pull their float out
  thirty seconds after subscribing, having used one API call. You keep thirty seconds'
  worth, which is nothing. If that is exploitable in your economics — it probably isn't at
  these prices, but check — the fix is a minimum term in a new plan, not a lever in this
  contract.
- **Timestamps are miner/sequencer-influenced by a few seconds.** Irrelevant at $5 per 30
  days; mentioning it so you don't rediscover it as a bug.
- **Rounding always favours the customer,** by at most one micro-USDC per settlement.
  Deliberate. Settlement carries the leftover fraction of a second, so settling a hundred
  times collects the same total as settling once.

## Changing prices later

Add a plan, then close the old one:

```sh
PRICE=7500000 make add-plan      # $7.50 / 30 days -> new plan id
PLAN_ID=1 OPEN=false make close-plan
```

New customers get the new plan. Existing customers keep the price they signed up at until
they choose to switch (`subscribe(newPlanId, 0)` settles the old rate and moves them
over). This is a feature, not a limitation — it means you can never accidentally reprice
your existing base, and customers can rely on that without trusting you.

## Before mainnet

1. `make test-deep` — unit, fuzz and invariants.
2. `make deploy-testnet` and run a full lifecycle against Base Sepolia: subscribe, wait,
   check `statusOf`, top up, cancel, confirm the refund maths by hand.
3. Set `OWNER` to a multisig you control, not the deploy key.
4. Verify on Basescan (`--verify` does this) so customers can read the code they are
   trusting.
5. Read `Deploy.s.sol`'s prices one more time. They are immutable.
6. Point `RPC_URL` and `RPC_URL_FALLBACK` at two different providers.
7. Generate `TOKEN_SECRET` fresh (`openssl rand -hex 32`) and keep it out of git.
