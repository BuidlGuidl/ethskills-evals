# Running this thing

Operational notes for the onchain billing setup: what happens day to day, what
you have to do yourself, and what to watch.

---

## The one idea you need

There is no monthly billing job, because onchain there is no such thing as a
job. A contract cannot wake itself up — every change of state needs somebody to
send a transaction and pay gas for it. Any design where "on the 1st, charge
everyone" is a scheduled task is a design that silently stops billing the first
month that task fails.

So nothing here is pushed on a schedule. A subscriber's balance **drains
continuously** at their plan's rate, and everything anyone needs to know is
arithmetic on three numbers already stored onchain:

```
accrued = time_elapsed × price_per_month ÷ 30 days   (never more than balance)
active  = on a plan AND accrued < balance
refund  = balance − accrued
```

Everything you asked for falls out of that:

| You wanted | How it works | Who pays gas |
| --- | --- | --- |
| Top up with USDC up front | `deposit()` | the customer |
| Pick a $5 or $20 plan | `subscribe(planId, amount)` | the customer |
| Charged monthly while subscribed | $5 of balance = one month of runway; topping up extends it | nobody — it's time passing |
| Cancel anytime, refund the unused part | `cancel()` pays out `balance − accrued` | the customer |
| Per-request "is this address subscribed?" | `isActive(address)` — a `view` | nobody, it's a free `eth_call` |

The only transition that needs poking is moving earned money out of subscriber
balances into your pot. That one is fine, because **you** are the poker and
**getting paid** is the reason. If you are late, you lose nothing: the money has
already accrued to you in the accounting, it just has not moved yet.

---

## Day to day

**Nothing.** That is the honest answer for most days. No cron, no worker, no
webhook handler, no dunning emails, no failed-card retries. Customers subscribe,
top up, and cancel without you being involved at all, and your API gate is a
cached `eth_call`.

What you actually do:

### Every month or so — take your money (~2 transactions)

```bash
export BILLING=0x...            # the deployed contract
export RPC_URL=https://mainnet.base.org
export TREASURY=0x...           # where revenue lands
export DEPLOY_BLOCK=...         # block the contract was deployed at

# 1. Settle subscribers: moves consumed funds into the operator pot.
#    Permissionless — this does not need the owner key.
node backend/dist/src/sweep.js

# 2. Sweep the pot to your treasury. This one needs the owner key.
forge script script/Collect.s.sol --rpc-url $RPC_URL --broadcast --account billing-owner
```

On Base this costs cents. Doing it more often does not earn you more — the
amount charged is a function of elapsed time, not of how often you settle, and
that is enforced in the contract (see `remainder` in `_settle`, and the test
`test_RevenueIsIndependentOfHowOftenCollectIsCalled`). Settling every second and
settling once a year produce the same total to within one micro-dollar.

### When you change prices

There is no `setPrice`, deliberately. Repricing is: create a new plan, close the
old one to new signups.

```bash
PRICE=7000000 forge script script/CreatePlan.s.sol --rpc-url $RPC_URL --broadcast
```

Existing subscribers keep their old rate until they choose to switch. That is
not politeness, it is the point: if you could reprice a live plan you could
drain everyone's prepaid balance by setting the price to $10,000/month, and your
customers would have to *trust* you not to. Now they don't have to.

### When a customer emails you

- *"Am I subscribed?"* — `cast call $BILLING "activeUntil(address)(uint256)" 0xTHEM`
- *"How much do I get back?"* — `cast call $BILLING "refundableOf(address)(uint256)" 0xTHEM`
- *"I want a refund"* — they call `cancel()` themselves. You cannot do it for
  them, and you cannot withhold it. Point them at your frontend.
- *"I sent USDC straight to the contract"* — it is stuck. There is no rescue
  function. See "Known sharp edges".

---

## Deploying

```bash
forge test                                   # 27 tests, all should pass

export RPC_URL=https://mainnet.base.org
export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # Base mainnet USDC
export OWNER=0xYourDeployerAddress
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify \
  --account billing-owner
```

Then hand ownership to a Safe:

```bash
cast send $BILLING "transferOwnership(address)" $SAFE --account billing-owner
# then acceptOwnership() from the Safe
```

Two-step on purpose — a typo in the address cannot lock you out, because the new
owner has to actively accept.

Deploy to a testnet first (Base Sepolia) and run a full cycle against it:
subscribe, wait, collect, cancel. The `token` address is immutable, so getting
USDC wrong means redeploying; `Deploy.s.sol` checks `decimals() == 6` to catch
the most likely version of that mistake.

**Why Base:** cheap gas matters a lot here, because your customers pay gas to
subscribe and cancel. A $5/month subscription where signing up costs $8 in gas
is not a product. On Base each of these calls is well under a cent. Any L2 with
native USDC works the same way.

---

## What to keep an eye on

### 1. Solvency — the alarm that matters

`backend/src/health.ts` checks it. The invariant:

```
USDC held by contract == totalSubscriberBalance + revenueAccrued
```

Every test asserts this after every operation, and the fuzz tests assert it for
random amounts and random elapsed times. If it is ever false in production,
something is very wrong — stop and investigate before sending any transaction.

`surplus()` should read `0`. Anything else means USDC arrived without going
through `deposit()`, which in practice means a customer transferred straight to
the contract address. Alert on it so you can spot it and help them.

### 2. Your RPC provider

This is the one genuinely new dependency in your request path. If your RPC is
down and an address is not in the gate's cache, you cannot tell whether they are
paid up.

The gate already softens this: active customers are cached until their credit
actually expires, so a short outage is invisible to anyone already using the
API. The exposure is first-request-from-a-cold-address during an outage.

**Decide this deliberately** (`onRpcFailure` in `GateOptions`):
- `"closed"` (default) — reject with 503. Protects revenue, hurts uptime.
- `"open"` — serve it. Protects uptime, gives away some free calls.

For a hobby weather API, honestly, `"open"` is probably the right call — the
downside is a handful of free requests. Use a paid RPC endpoint with a fallback
URL and alert on `gate.stats().rpcFailures`.

### 3. Lapse rate

Prepaid means customers go inactive silently when their balance runs out. There
is no card to retry and no email from Stripe. If you do nothing, you will lose
people who simply forgot.

Watch `activeUntil` across your subscriber list and email them a few days out.
`findSubscribers()` in `backend/src/sweep.ts` gives you the list from
`Subscribed` events. This is the main piece of customer-facing work the onchain
model moves onto you — worth building early rather than after the churn.

### 4. Revenue actually arriving

Alert if `revenueAccrued` grows but your treasury balance does not — that means
the sweep has stopped running. Also alert if it stays flat while you have active
subscribers, which would mean settlement is not happening at all.

### 5. USDC itself

USDC is a centralised token with a blacklist. Circle can freeze an address,
including this contract's. That is very unlikely for a legitimate billing
contract, but it is a real dependency and you should know it exists. If it
happened, deposits and refunds would both stop.

---

## Privacy — tell your customers

This is the part that differs most from Stripe, and it is easy to skip past.

**Everything is public and permanent.** Every subscriber's address, every
deposit amount, every plan choice, every cancellation, with timestamps, readable
by anyone on a block explorer forever. Anyone can enumerate your entire customer
list and calculate your revenue. Competitors can. So can your customers.

It gets sharper when combined with your side: if you map API keys to addresses
(and you do — that is how the gate works), then your request logs link a public
onchain identity to usage patterns and IP addresses. An address is often
linkable to a real identity through exchange deposits or ENS names.

Practical steps:
- Say so plainly in your docs. People signing up with their main wallet should
  know their subscription is public.
- Suggest a fresh address per subscription. Nothing in the contract requires
  customers to use their main wallet, and `depositFor()` means someone else can
  fund it.
- Do not log more than you need next to addresses.

Not a bug, not fixable at this layer — but your customers deserve to know
before they sign the first transaction, not after.

---

## Known sharp edges

**No pause button, no upgrade hook.** Deliberate. A key that can freeze the
contract is a key that can freeze your customers' money, and it becomes a target
and a thing you can be compelled to use. The tradeoff is real: if a bug is found,
you cannot stop it. What you *can* do is deploy a fixed contract and tell people
to cancel from the old one and subscribe to the new one — which works precisely
because cancellation needs no cooperation from you.

Have that migration plan written down before you need it.

**No rescue function for stray tokens.** USDC sent directly to the contract,
bypassing `deposit()`, is stuck forever. A rescue function would need the
ability to move tokens out, which is exactly the power the contract is designed
not to have. Make the deposit flow in your frontend clear enough that nobody
tries to pay by plain transfer.

**"Month" is 30 days, not a calendar month.** A year is 12.17 billing months.
Say "30 days" in your pricing page rather than "monthly" if you want to be
precise about it.

**Billing is continuous, not monthly charges.** Cancel 10 days into a month and
you get 20 days back, prorated to the second. This is more generous than typical
SaaS (which usually keeps the rest of the period). If you would rather keep the
month, that is a contract change, not a config change — say so and I'll do it.

**Rounding is one micro-dollar.** Integer division at 6 decimals means totals
can be off by up to 1 unit ($0.000001) in the customer's favour. Irrelevant, but
it is why the tests assert with a tolerance of 1.

**Your customers need a wallet, USDC on Base, and gas.** This is the big product
tradeoff versus Stripe and it is not a technical problem you can code away. For
an API aimed at hobbyist developers it is plausible, maybe even a draw. For a
general audience it would be a wall. You know your users.

**Authentication is separate from billing.** `isActive(address)` says whether an
address is paid up, not whether the person calling your API *is* that address.
Since every subscriber address is public, without auth anyone could copy a
paying customer's address and use their subscription. `backend/src/auth.ts`
handles this: sign once with your wallet, get a normal bearer API key bound to
that address. Do not skip it.

---

## The honest summary of what you're trading

**You gain:** no Stripe fees, no chargebacks, no payment processor that can
deplatform you, customers who can verify your billing rules instead of trusting
them, and genuinely less operational software than a Stripe integration —
there is no webhook endpoint to keep up, no subscription state to reconcile,
no dunning logic.

**You give up:** cards, a customer base that does not need a wallet, private
revenue figures, the ability to fix a bug in place, and refund discretion (you
*cannot* make an exception for someone — the contract decides).

**Could this run without you?** Nearly. Subscribing, cancelling, refunds, and
settlement all work with you gone — the only thing that stops is your API
actually serving weather data, and revenue piling up uncollected. Customers
would still get every unused dollar back. That is a much better failure mode
than a Stripe account with a frozen balance, and it is worth understanding that
you got it for free by not adding an admin key.
