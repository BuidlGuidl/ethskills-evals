# Running this thing

Operational notes for the onchain billing setup. Written for you, the person who
has to keep it alive — not for a contract reviewer.

---

## 1. The one idea that makes this work

Stripe has a server that wakes up on the 1st of the month and charges people.
There is no equivalent onchain. Nothing here runs on a timer, because contracts
cannot run on a timer — they only do something when someone sends a transaction
and pays gas for it.

So the design splits a subscription into two halves that fail independently:

| | What it is | Who makes it happen |
|---|---|---|
| **Entitlement** | "Is this address allowed to call my API right now?" | Nobody. It's arithmetic over money already deposited. `isSubscribed()` is a read-only call that is correct whether or not anyone has touched the contract in a year. |
| **Settlement** | "Move the money I've earned into my wallet." | You. It's permissionless, and you're the one who gets paid, so the incentive needs no engineering. |

**The practical consequence: your API gateway never depends on a background job.**
If your settlement script is down for six weeks, not one customer is
over-charged, under-charged, or wrongly let in or kept out. When you finally run
it, it reconstructs every missed month in one shot and pays you. That was the
whole point of the split — the thing that must be correct every second (access
control) has no moving parts, and the thing with moving parts (getting paid) can
be late without hurting anyone.

Most onchain subscription designs get this backwards: they make access depend on
a keeper bot having renewed everyone on time, and then the bot runs out of gas on
a Sunday and paying customers get 402s.

---

## 2. How the money actually sits

Deposited USDC lives in the contract in three separate, non-overlapping buckets:

- **`totalCustomerBalance`** — topped-up funds not yet spent. Still the
  customer's. You cannot touch it. There is no function that lets you.
- **`totalEscrowed`** — the month each subscriber is currently inside, paid for
  but not yet elapsed. Refundable to them, prorated, if they cancel today.
- **`withdrawableRevenue`** — months that have actually finished. Yours.

`withdrawRevenue()` only ever draws from the third bucket. That's not a policy,
it's the only arithmetic the function can do. A customer's deposit is
structurally out of your reach, which is also what protects *you* — you can't
accidentally spend float you owe back.

The invariant to remember: **contract USDC balance ≥ the three buckets summed.**
There's a fuzz test that hammers this with 128,000 random call sequences, and the
keeper prints it on every run.

---

## 3. First deploy

```bash
forge test                                  # 37 tests, incl. 4 invariants
export OWNER=0xYourSafe                     # plan admin — use a multisig
export PAYOUT_ADDRESS=0xWhereRevenueGoes    # can be a plain wallet
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```

This deploys and creates plan 1 = $5 hobby, plan 2 = $20 pro. If `OWNER` isn't
the deploying key, the script skips plan creation — run `AddPlans` from the owner
afterwards.

**I'd deploy to Base.** Native USDC, transactions cost well under a cent, and
Coinbase onramps straight into it. On mainnet L1 a $5 subscription would spend
several dollars of gas to collect, which is not a business.

Then set these for the backend:

```
RPC_URL=...              # your own node or a paid provider, not a public endpoint
BILLING_ADDRESS=0x...
DEPLOY_BLOCK=...         # from the deploy receipt — the keeper scans from here
AUTH_SECRET=...          # 32+ random chars
KEEPER_PRIVATE_KEY=0x... # a throwaway key holding a few dollars of ETH
```

**Verify the contract on Basescan.** Customers are being asked to send you money
before receiving anything; unverified bytecode is a reasonable thing for them to
refuse.

---

## 4. Day to day

Honestly: very little.

**Weekly-ish, run the settlement job.** `cd backend && npm run keeper`. It finds
everyone who's ever subscribed, works out whose month has rolled over, settles
them in batches of 100, and sweeps anything over $1 to your payout address. Stick
it on a cron. Monthly is fine too — it costs you nothing but delayed cash flow.

The keeper key can only do two things: settle (permissionless, harmless) and
sweep revenue *to the hardcoded payout address*. Even if it's fully compromised,
the attacker's best move is paying you. **Keep the owner key completely out of
this process** — it lives in a Safe, offline, and gets used a couple of times a
year to add a plan.

**The gateway** (`backend/src/gateway.ts`) is a normal service. Customers hit
`/auth/nonce`, sign a message with their wallet, swap it for a 15-minute bearer
token, then call the API. Per request it does one cached `planOf` + `entitledUntil`
read. Positive answers are cached until the on-chain expiry or 60 seconds,
whichever is sooner; negatives are never cached, so a top-up takes effect on the
customer's very next call.

---

## 5. What to actually watch

Ordered by how likely it is to cost you something.

**Customers about to lapse.** The biggest revenue leak here isn't fraud, it's
people silently running dry. `periodsOfRunway(address)` returns how many months
of deposit they have left. When it hits 0 or 1, email them. Onchain billing has
no "retry the card" — if the balance is empty, service stops and they may not
notice for a week. **Build the dunning email before you take your first real
customer.** This is the single highest-value thing on this list.

**Gateway 503s.** `requireSubscription` fails closed when the RPC is
unreachable, which is the right default but means your node provider is now a
hard dependency of your API. Alert on the rate, and configure a fallback RPC.

**Keeper gas balance.** It's the mundane one that actually bites. Alert below
~0.005 ETH.

**The solvency line in the keeper output.** `customers + escrow + unswept` must
never exceed the contract's USDC balance. If it ever does, something is very
wrong — stop, don't sweep, and work out why before touching anything.

**`withdrawableRevenue` growing without your payout address growing.** Means the
keeper's sweep is failing silently.

**Deposits from addresses that never subscribe.** Usually someone who deposited
and didn't understand they also have to call `subscribe`. Worth a nudge — it's a
UX failure, and their money is sitting there doing nothing for either of you.

---

## 6. Decisions I made that you should know about

**A "month" is 30 days, not a calendar month.** Calendar months need an oracle to
know how long February is. Side effect: 365/30 ≈ **12.17 charges a year**, so
hobby brings in ~$60.83 rather than $60. Say "every 30 days" in your pricing
copy, not "monthly", or someone will eventually file a complaint about it.

**Customers are charged a full month up front and refunded prorated to the
second on cancel.** So cancelling on day 10 of a $5 month returns $3.33. That's
your "get back whatever they haven't used", and it's exact — the refund rounds in
the *customer's* favour to the sub-cent.

**Existing subscribers are locked into the price they signed up at.** Raising the
price of plan 1 does not touch anyone already on it; they keep their old rate
until they switch plans themselves. Partly courtesy, mostly safety: because
settlement can run months after the fact, a mutable price would let a raise get
applied retroactively to months already served. To do a real price rise: retire
the old plan (`setPlanActive(id, false)`, which only blocks new signups) and add
a new one, then email people to migrate.

**There's no pause button and no admin override.** You cannot freeze the
contract, cancel anyone, or claw anything back. The upside is that this is the
property that makes the contract trustworthy enough for strangers to prepay —
and it means if you lose the owner key or walk away tomorrow, every customer can
still cancel and withdraw in full, forever. The downside is real and you should
sit with it: **if a bug is ever found, you cannot stop it.** That trade is the
right one at this size, but it's a trade.

**The contract is immutable — no proxy.** Migrating means deploying a new one and
asking customers to withdraw and re-subscribe. At hobby scale that's a weekend
and an email. A proxy would have meant an upgrade key that can rewrite the rules
holding customer money, which is a much bigger thing to ask people to trust.

---

## 7. Things that are genuinely different from Stripe

**Your entire customer list is public.** Every address, every plan, every payment
amount and time, permanently, for anyone. Competitors can see your revenue and
churn. Customers can see each other. This is the biggest practical difference
from Stripe and it's not fixable at this layer — it's what a public chain is.
Tell customers plainly; the ones who care can use a fresh address per
subscription, which works fine here since entitlement is purely per-address.

**Customers need ETH for gas, not just USDC.** Every deposit, subscribe and
cancel is a transaction. This is the friction that will cost you the most
signups. Worth documenting a "get USDC and a little ETH on Base" path, and it's
the main thing a paymaster would fix later if volume justifies it.

**You are trusting Circle.** USDC is an upgradeable contract with a blacklist.
Circle can freeze an address, and a blacklisted customer would be unable to
withdraw their own balance from here. Nothing you can do about it — just know
it's in your stack.

**Chargebacks don't exist.** Good for you. It also means a genuine mistake — a
customer overpaying, sending to a wrong address — has no recourse path except
your goodwill. Decide your policy before it happens.

**Failed payments are silent.** No decline webhook. Lapsing is the absence of an
event, which is exactly why §5's dunning alert matters.

---

## 8. Before real money touches this

Being straight with you about what this is: a careful, well-tested
implementation that has not been audited. The tests cover the settlement
arithmetic hard (unit, fuzz, and stateful invariants over 128k random call
sequences), and it's deliberately small and non-upgradeable, which is the best
position to be in. But it's holding customer deposits and there is no pause
button.

Roughly in order:

1. Run it on Base Sepolia end to end for a couple of weeks with fake money.
2. Cap your exposure early — tell people to deposit 2–3 months, not a year.
   Runway is visible via `periodsOfRunway` so this is easy to nudge.
3. Get the owner key into a Safe before launch, not after.
4. If deposits start totalling more than you'd be comfortable personally
   refunding out of pocket, get an audit. At a few hundred dollars of float,
   that's disproportionate; at $50k it is not optional.

---

## 9. Layout

```
src/SubscriptionBilling.sol    the contract
src/ISubscriptionBilling.sol   the 3-function read interface your gateway needs
script/Deploy.s.sol            deploy + seed plans
script/Settle.s.sol            settle a batch from the CLI, no Node needed
test/                          37 tests: unit, fuzz, stateful invariants
backend/src/gateway.ts         the API, gated on isSubscribed
backend/src/auth.ts            wallet signature -> bearer token (Safes supported)
backend/src/billing.ts         cached subscription reads
backend/src/keeper.ts          the cron job that pays you
```

Run `forge test` and `cd backend && npm run typecheck` before any change.
