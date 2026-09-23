# NOTES.md — running onchain billing for the weather API

## The mental model in one paragraph

Every customer has a prepaid USDC balance (`credit`) and, if they've picked one, a
plan (`Hobby` $5/month or `Pro` $20/month, 30-day months). Buying months converts
credit into paid time, tracked as a single timestamp: `paidUntil`. While
`paidUntil` is in the future the customer is subscribed; the instant it passes,
they are not — no transaction is required for a subscription to lapse, because
**a contract is a state machine: it moves only when someone sends a transaction,
and time in Ethereum is just `block.timestamp`**. All the "charged monthly"
behavior comes out of that: there is no cron, no keeper, no owner key that has
to show up on any schedule, and nothing stops if you disappear. Charging,
refunding and revenue collection are all lazy — they settle whenever someone
next touches the contract, driven by that person's own incentive.

## Who sends every transaction, and why they bother

| Transaction | Who sends it | Why they would |
|---|---|---|
| `topUp(amount)` | the customer | wants credit; also auto-buys any due months |
| `subscribe(plan)` | the customer | wants service; switching plans credits back unused time |
| `settle(customer)` | **anyone** — usually the customer, optionally your backend | keeps a paying customer subscribed; can only spend the customer's own credit on the customer's own subscription, so there is nothing to abuse |
| `cancel()` | the customer | wants their unused money back (prorated current month + all credit) |
| `collect()` | **anyone** — typically you | sweeps earned revenue to the fixed `treasury`; it's your money, so you'll show up for it, but users are not affected if you don't |

The important property: **every transaction above is sent by someone who
profits from sending it**. Nothing needs a schedule, and nothing in the contract
is `onlyOwner`. If you take a month off, subscriptions still renew (customers
top up), still lapse (time passes), and refunds still work.

## Day to day, once it's live

**Per incoming API request — the check.** One read-only `eth_call`:

```js
import { checkSubscribed } from "./tools/check-subscribed.mjs";
const ok = await checkSubscribed(RPC_URL, BILLING_ADDRESS, customerAddr);
```

`isSubscribed` is a pure view: it costs no gas, changes no state, and can't
fail closed silently — it returns exactly `paidUntil > now && plan != None`.
Caching is safe with a short TTL (30–60 s) because a customer's status only
changes when *they* send a transaction. The CLI form is
`node tools/check-subscribed.mjs <address> --billing 0x... [--rpc URL]`
(exit 0 = subscribed). For richer logging use `getAccount` (also in the tool):
plan, paid-until, remaining credit, monthly price.

**Weekly-ish — collect revenue.** `earnedPot` grows as customers' paid time is
consumed, but it only *moves into the pot* when that customer's account is
touched (their own top-up, or anyone's `settle`). So before collecting, sweep
your customers: your backend already knows every address that has called the
API — loop over them and send one `settle(address)` each (a bot or a multisig
batcher can do this; permissionless), then `collect()`. If you skip a customer,
you're only delaying your own payout, never risking user funds. `collect()`
pays out **only earned revenue** — it mathematically cannot touch user credit
or prepaid-but-unconsumed time, so users can always cancel and be made whole.

**Never needed:** renewals, expiry sweeps, refund jobs, pause/unpause, price
updates (there is no admin to do any of this — see below).

## Customer-facing behavior (what to tell your users)

- **Top up**: approve the billing contract for USDC once, then `topUp`. Their
  USDC sits in the contract tagged with their address; it is refundable at any
  time via `cancel`.
- **"Monthly" = fixed 30-day periods**, not calendar months.
- **Auto-renewal from balance**: any interaction that adds credit buys due
  months, up to **12 months ahead** (the cap). Prepaying ahead is riskless for
  the customer — all unused prepaid time is prorated back on cancel.
- **No surprise bills**: if a subscription lapses for lack of funds, it
  **restarts from the moment it's next funded**. Elapsed idle time is never
  back-billed. This is deliberate: back-billing a returning customer is how you
  get chargebacks and rage-quits, and Stripe wouldn't do it either.
- **Cancel**: one transaction returns the unused fraction of the current month
  (per-second proration, floored in the customer's disfavor by at most one
  millionth of a cent) plus their entire remaining credit.
- **Plan changes** take effect immediately: unused time on the old plan is
  credited, the first month of the new plan is charged from now.
- Choosing a plan before funding anything is fine — `plan` is remembered, the
  subscription starts when credit arrives.

## What to keep an eye on

1. **The treasury key.** `treasury` is *immutable*. If the key is lost, future
   revenue is stranded — user funds never are (cancels are self-serve and
   permissionless). Use a 2-of-3 multisig (e.g. Safe), not an EOA.
2. **Deploy-time parameters are forever.** `USDC_ADDRESS`, `TREASURY_ADDRESS`
   and the two prices are set in the constructor and can never be changed.
   Verify the USDC contract address from the issuer (Circle) — a typo'd token
   or a fake USDC is not recoverable. On Base: USDC is
   `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
3. **Contract balance vs obligations.** Sanity-check occasionally:
   `usdc.balanceOf(billing) >= Σ user credit + refundable prepaid + earnedPot`.
   The invariant is enforced by construction (each `collect`-ible dollar was
   first deposited by a customer), and a slow drift of at most one wei-USDC per
   settled span (rounding dust, see tests) accumulates *in the customers'
   favor* — the contract is always slightly over-collateralized. If the token
   balance ever drops *below* `earnedPot + what users should be owed`, something
   is deeply wrong; stop trusting it and investigate.
4. **Circle can blacklist addresses.** Native USDC is centrally issued: if
   Circle blacklists a customer, USDC transfers to them revert — including the
   refund from `cancel()`. There is no contract-level workaround; this is
   USDC, not this code. It should be rare for hobby weather usage.
5. **Lapsed subscriptions are normal churn, not an outage.** A customer with no
   credit simply stops being subscribed at `paidUntil`. Don't build alerting
   that treats lapses as failures; do watch your own `collect()` flow (if
   `earnedPot` climbs while `collectedTotal` stays flat for weeks, your sweep
   bot is down — only your payout is delayed).
6. **RPC health.** Your per-request check is only as available as your RPC.
   Use a paid RPC with a fallback; on failure, decide explicitly whether to
   fail open or closed. (For a hobby API, failing closed for unknown addresses
   and open for recently-verified ones is a reasonable middle ground.)
7. **Chain choice.** Deploy where your customers are and fees are near-zero —
   Base is the natural fit for USDC billing. A customer's top-up costs them a
   cent or less there.
8. **Rounding dust** (≤ 1 USDC-base-unit, i.e. $0.000001, per settled span)
   stays in the contract forever, owned by no one. Ignore it.

## Changing prices, adding plans

Prices are **immutable on purpose** — no operator can quietly raise the price
on prepaid customers, and "the $5 plan costs $5" is verifiable forever. To
change prices: deploy a new contract, point the backend at it, and let
customers migrate by cancelling (full refund, self-serve) and re-subscribing.
The old contract keeps working for whoever stays. This is the honest cost of
having no admin key; for a two-plan product it is cheap.

## What this design gives up (read this once before launch)

**Can anyone be stopped from using it?** On the billing side, no: there is no
`Pausable`, no `onlyOwner`, no upgrade proxy, no blacklist in the contract.
You cannot stop a *paying* customer from being subscribed, and you cannot
touch their credit. But two honest caveats. First, your API itself is a
service you run — you can (and should) 403 anyone at the HTTP layer for abuse
regardless of their onchain status; billing being unstoppable doesn't mean
service is unconditional. Second, the token is USDC: Circle can freeze any
address's USDC, which would block that customer's refund until unfrozen. That
power is Circle's, not yours, and it exists in every USDC-based system.

**Could someone else run it?** Half of it, yes. The contracts, the onchain
state, refunds and revenue collection are self-sustaining: if you vanish,
customers can still top up, stay subscribed, and cancel for full refunds
until the chain stops. What dies with you is everything offchain: the weather
API itself, the frontend you presumably build, and your `settle`/`collect`
sweep routine (though *anyone* can send those — a motivated user could keep
even revenue collection going). Verified source on a block explorer plus this
repo is everything a stranger needs to read the state and interact with it.

**What does an observer learn?** Everything onchain is public forever: every
customer address, which plan they're on, how much they topped up, when they
cancelled, and your total collected revenue (`collectedTotal` is a public
variable). A competitor could enumerate your customers and their tiers with a
day of indexing. If that matters, the mitigation is at the edge (let customers
pay from fresh addresses), not onchain — there is no privacy in this design,
and API-access logs are a separate question that this doesn't touch.

**What does "tested" cover?** The test suite (26 tests incl. a proration
conservation fuzz) covers the behaviors described here against a mock USDC,
at a point in time. It is not an audit, it wasn't reviewed by a third party,
and it guarantees nothing about code that changes after this commit. Treat it
as you'd treat your own code before handling real money: run it, then get a
second pair of eyes if the revenue ever grows beyond hobby money.