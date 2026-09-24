# Running this thing

Operational notes for the onchain billing contract. Written for the person who has to keep the
weather API running, not for an auditor.

---

## The one design decision you should understand

You asked for customers to be "charged monthly." What got built charges them **every second**,
at a rate of `plan price ÷ 30 days`. The economics are identical — a customer on the $5 plan
pays $5 per 30 days — but the mechanism is different, and the difference is the whole reason
this works without you babysitting it.

Here is why it isn't a monthly charge. **A smart contract cannot do anything on its own.** There
is no cron, no scheduler, nothing inside Ethereum that wakes up on the 1st of the month and
debits your customers. Every state change needs a human or a bot to send a transaction and pay
gas for it. So a literal "charge on the 1st" design means *you* run a job that sends one
transaction per customer per month, and you need an answer for what happens when that job is
down, out of gas, or you are on holiday. Miss the run and customers get free service. Run it
twice by accident and you double-bill.

Instead, the amount owed is a formula over time:

```
owed(customer) = plan_price × (now − last_settled) ÷ 30 days     (capped at their balance)
```

Nobody has to poke anything for that number to be right. It is right at every instant, for
free, because it is just arithmetic on the clock. Concretely, that buys you three things:

- **Lapsing is automatic in the only sense that word is ever true onchain.** A customer who runs
  out of funds stops being subscribed with *zero* transactions from anyone — `isSubscribed`
  just starts returning false. There is no "dunning" job to run and nothing to go wrong.
- **Refunds are exact by construction.** "Get back whatever they haven't used" is not a
  calculation anyone performs; cancelling stops the clock, and what hasn't accrued was never
  yours. There's no refund approval path for you to be on the hook for.
- **The only transaction you ever *need* to send is `sweep`,** which moves money you've already
  earned into your treasury. If you forget for six months, you lose nothing — the claim is
  recorded onchain the whole time. Your incentive to run it is simply that it's your money.

That last point is the test worth applying to any onchain design: for every state change, ask
who sends the transaction and why they'd bother. Here, the customer pays gas for the things
they want (subscribing, cancelling, topping up), and you pay gas for the thing you want
(collecting). No step depends on someone acting against their own interest, and no step depends
on a background job existing.

## Daily reality

Most days you do nothing. There is no billing run.

**What happens without you:** customers deposit, subscribe, cancel, and lapse on their own
transactions. Revenue accrues continuously. Your API keeps answering the entitlement question
from a contract read.

**What you actually do:**

| How often | What | Why |
|---|---|---|
| Weekly or monthly | `make sweep` | Moves earned revenue to your treasury. Batch it — no reason to do this often. |
| Rarely | `AddPlan` / `ClosePlan` script | New price points. |
| Never, ideally | Nothing else | There is no admin action required for billing to be correct. |

`sweep` costs roughly 25k gas per account settled plus one transfer. On Base that is fractions
of a cent per customer at normal gas prices. Batch ~100 accounts per transaction to stay well
inside the block gas limit; the `Sweep` script takes a comma-separated `SUBSCRIBERS` list.

You need the list of subscriber addresses to settle, which you get from `Subscribed` events —
index those, or just keep the addresses in your existing database when customers link a key.

## The backend check

`backend/src/billing.ts` is the per-request gate. The important part is that it does **not** hit
an RPC node on every request. The contract exposes `subscribedUntil(address)` — the timestamp
their prepaid balance runs out — so one read answers the question for days at a time.

What can move that timestamp:

- **Later** (top-up, cheaper plan): missing this briefly under-serves a paying customer. The
  gate watches contract events and busts the cache immediately, so in practice it's instant.
- **Earlier**: only the customer can do this, by cancelling and withdrawing. This is the one
  case where a stale cache serves free requests, which is why positive answers are capped at a
  30s TTL. Worst case you give away 30 seconds of weather data. Tune `maxTtlMs` if you care.

Measured: ~4µs per cached check, so the gate is not in your latency budget.

**It fails open by default.** If your RPC provider has an outage, everyone is treated as
subscribed rather than everyone being locked out. For a $5/mo hobby API that is the right
trade — a wrongly-rejected paying customer costs you more than a few free requests. Flip
`failOpen: false` if you disagree. Either way, **use a real RPC provider with a fallback**
(Alchemy/QuickNode plus `https://mainnet.base.org` as backup); your API's availability now
depends on being able to read a chain.

Authentication is still your problem and is separate from billing. The contract knows what an
*address* has paid for; you need to know that an HTTP request belongs to that address. Simplest
path: the customer signs a "link this API key to my address" message once, you store
key → address, and the contract stays the source of truth for entitlement. See the comment in
`backend/src/middleware.ts`.

## What to keep an eye on

**Solvency invariant.** At all times the contract's USDC balance should equal the sum of all
customer balances plus `collected`. This is fuzz-tested, but monitor it in production anyway —
if it ever drifts, stop and investigate. Cheap alert: compare `usdc.balanceOf(billing)` against
`collected() + Σ accountOf(user).balance` nightly.

**Revenue actually landing.** Alert if `collected()` is growing but your treasury balance isn't
— that means sweeps have stopped running.

**Customers about to lapse.** You have something Stripe can't give you: you can see exactly
when every customer runs out, in advance. Query `subscribedUntil` and email people a week out.
This is your main churn lever, because unlike a card on file, **nothing auto-renews.** A happy
customer who forgets to top up simply stops working. Expect this to be your biggest source of
involuntary churn and build the reminder early.

**Gas balance on your ops wallet.** Keep ETH on Base in whatever key runs `sweep`. If it empties
you can't collect — not urgent, since the claim is safe onchain, but annoying.

**The treasury key.** It receives real money. Use a Safe multisig, not an EOA on your laptop.

## Things that will bite you

**USDC can freeze addresses.** Circle can blacklist an address, and a blacklisted customer's
`withdraw` will revert — their funds are stuck until Circle unfreezes them. This is not
something the contract can fix; it's a property of USDC. Worth knowing before a support ticket
surprises you.

**Nothing is private.** Every customer address, every payment, every plan choice, and your total
revenue are public forever on a block explorer. Anyone can compute your MRR. If a customer's
address is linked to their identity elsewhere (an ENS name, a public donation), their
subscription to your service is publicly linked to them too. Tell customers this; some will care.

**No chargebacks, and no undo.** There is no support desk to reverse a mistake. If a customer
sends USDC directly to the contract address instead of calling `deposit`, it is not credited to
them — it just sits there, and it will make your solvency check read high. You'd have to handle
that case manually and off-chain.

**Wrong-chain deposits.** Customers will send USDC on Ethereum mainnet or Arbitrum to a Base
address. Make the chain extremely loud in your docs.

**The contract is immutable.** No proxy, no upgrade, no pause — deliberately. Nobody can freeze
a customer's funds, including you, and including an attacker who steals your owner key. The
flip side is that a bug cannot be patched. Fixing anything means deploying a new contract and
asking customers to cancel, withdraw, and re-subscribe. **Test on Base Sepolia first, and get
the contract reviewed before it holds meaningful money.** The tests here are thorough but they
are my tests of my own code, which is not the same as a review.

**Rounding is in the customer's favour** by a few millionths of a dollar per settlement
(integer division truncates). Irrelevant at these amounts, but don't be alarmed if revenue is a
hair under a naive projection.

**30-day "months".** A plan is priced per 30 days, so customers pay ~12.17 times a year, not 12.
Say "$5 per 30 days" in your pricing page and nobody will be surprised.

## Owner powers, precisely

Worth being able to state this to a customer who asks what you can do to them.

You **can**: add new plans, close a plan to *new* signups, change where revenue is sent, and
transfer ownership (two-step).

You **cannot**: touch a customer's unearned balance, change the price of a plan anyone is
already on, stop anyone from cancelling, stop anyone from withdrawing, or pause the contract.

Repricing is deliberately opt-in: prices are immutable once a plan exists, so raising prices
means adding a new plan and asking customers to switch. Nobody gets repriced under their feet
while they sleep. If you ever want an automatic-repricing system, that is a genuinely different
trust model and it should be a conscious decision, not a config change.

The owner key being stolen is bad but bounded: the thief redirects *future swept revenue* and
can close plans to new signups. They cannot take customer deposits, and every existing customer
can still cancel and withdraw in full.

## If you walk away

If you stop operating the service entirely, customers are not stranded. Every customer can call
`cancelAndWithdrawAll()` and recover their unused balance without your cooperation, without a
frontend, and without the owner key existing. They'd need to interact with the contract
directly (Etherscan's write tab works), so leaving the address and ABI published somewhere
durable is the decent thing to do.

## Deploying

```bash
cp .env.example .env         # TREASURY (a Safe), OWNER, RPC urls, Etherscan key
make deploy-testnet          # Base Sepolia — run a full subscribe/cancel cycle here first
make deploy-mainnet
```

Plan 1 is hobby ($5/30d), plan 2 is pro ($20/30d). Plan 0 means "not subscribed" and is not a
real plan. After deploying, verify on Basescan (the `--verify` flag does this) so customers can
read the code that governs their money.

Then point the backend at it:

```ts
const gate = new SubscriptionGate({ contract: "0x...", rpcUrl: process.env.BASE_RPC_URL! });
gate.watch();  // keeps the cache honest
app.use("/v1", requireSubscription(gate, resolveAddressFromApiKey));
```

## Honest trade-offs

Compared to Stripe, you are giving up: auto-renewal from a card on file (the big one — expect
more involuntary churn), customer privacy, chargeback protection for the customer, the ability
to fix bugs in place, and a support team. You are also asking hobby-project developers to hold
USDC on Base, which is real friction and will cost you signups.

You are getting: no payment processor fees or account freezes, instant global settlement, no
minimum payout thresholds, exact prorated refunds with no manual work, and a billing system
that keeps working correctly whether or not you or your servers are around.

For a $5/month hobby API, the honest summary is that this is a better fit for customers who
already hold crypto and worse for everyone else. Running it alongside Stripe rather than
instead of it is a reasonable call.
