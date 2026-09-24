# Running this

Operational notes for the USDC subscription billing. `README.md` covers what it is and how to
deploy it; this is about what happens after that.

---

## 1. What actually runs

Almost nothing, and that is the point.

**Billing needs no process of yours to be running.** Whether someone is subscribed is a pure
function of on-chain state — a balance, a rate, and a timestamp. If your server is down for a
week, customers are billed correctly for that week and nobody's subscription silently stops
renewing. Compare with a "charge everyone on the 1st" cron, where a job that fails on the 1st
either misses a month of revenue or double-charges when you retry it.

Two things do run:

| What | Cadence | Consequence if it stops |
|---|---|---|
| The API gate (`backend/src/billing.ts`) | Every request | You cannot check subscriptions — see §5 |
| `backend/src/monitor.ts` | Daily cron | You stop noticing problems; billing is unaffected |

And one thing you do by hand:

| What | Cadence | Consequence if you skip it |
|---|---|---|
| `settle` + `withdrawEarnings` | Monthly, or whenever | Revenue sits in the contract. Nothing is lost |

**Settling late costs you nothing.** Accrued revenue cannot be withdrawn by the customer, because
every function that touches a balance settles first. Sweeping is purely about moving money you
have already earned into your own wallet. Settle when the gas is worth it, not on a schedule.

---

## 2. The monthly rhythm

Once a month, roughly:

```bash
# Who to settle. The list is every address that ever subscribed.
SUBSCRIBERS=$(...)   # from your own records, or reconcile() in backend/src/monitor.ts

SUBSCRIBERS=$SUBSCRIBERS NETWORK=base make report    # read-only, check before you sign
SUBSCRIBERS=$SUBSCRIBERS NETWORK=base make settle    # sweep accrued into `earned`
TO=0xYourTreasury     NETWORK=base make withdraw     # move it out
```

`settleMany` is a loop, so batch size is bounded by the block gas limit. A few hundred addresses
per transaction is comfortable on Base; split the list if you grow past that.

You do not have to settle everyone. Settling only the accounts with meaningful accrued balances is
fine — the rest keep accruing, and you collect later.

---

## 3. What to keep an eye on

`make monitor` checks all of these and exits non-zero when something needs you, so pointing a cron
at it and alerting on failure covers the list. In rough order of how much it would hurt:

### Your RPC endpoint
**This is the single point of failure, and it is not the chain — it is your provider.** Every
gated request depends on being able to reach it. A public endpoint will rate-limit you the moment
you get real traffic.

- Use a paid provider with a real SLA, and configure a fallback URL.
- Watch `gate.stats.rpcErrors` from `/healthz`. A rising count means customers are about to be
  affected even though nothing on-chain is wrong.
- The cache (§5) absorbs short outages. Long ones need the fallback.

### Customers about to lapse
A prepaid model fails quietly: the customer does not get a declined-card email, their API calls
just start returning 402. This is the difference between churn you can prevent and churn you
cannot.

- The monitor warns at `EXPIRY_WARNING_DAYS` (default 5) before a balance runs out.
- The gate sets `X-Subscription-Expires` on every successful response, and adds
  `X-Subscription-Warning` inside 3 days, so a well-behaved client can warn its own user.
- Email them if you have an email. This is the highest-value thing on this list.

### Unswept revenue
Money you have earned but not moved. Safe where it is, but it is your money sitting in a contract.
The monitor flags it past `SWEEP_THRESHOLD_USDC` (default $50).

### Solvency
The contract should always hold at least `totalCustomerBalance + earned`. The monitor checks this
from the outside every run. It should never fail — if it does, stop taking signups
(`pause()`) and work out why before anything else. This is the check that catches a class of bug
nothing else would.

### Stray transfers
Someone will eventually transfer USDC straight to the contract address instead of calling
`deposit`. It does not break anything — `surplus()` reports it and `sweepSurplus(to)` recovers it
— but you should refund that person, because from their point of view they paid and got nothing.
The monitor flags a non-zero surplus.

### Your owner key
The only key that matters. See §7.

### Gas and USDC depeg
Minor on Base, but worth a glance. If a subscribe transaction ever costs a meaningful fraction of
$5, the product economics stop working. And every price here is denominated in USDC, so a
sustained depeg is a real revenue change, not a rounding error.

---

## 4. Things customers will ask

**"I cancelled — where is my money?"** `cancel()` stops the meter and leaves the balance in their
account; they still need `withdraw` to move it to their wallet. `cancelAndWithdraw()` does both,
and is what any UI you build should call. Expect this question if they use a block explorer
directly.

**"Why was I charged for 11 days when I only used it for 3?"** The meter runs on wall-clock time,
not on API calls. This is a subscription, not metered usage — same as Stripe — but say so on the
pricing page, because the on-chain receipt makes it visible in a way a card statement does not.

**"I topped up but I'm still getting 402s."** Either they deposited without calling `subscribe`
(a balance alone does not subscribe you), or they are inside the gate's cache TTL. `/account`
returns their raw status and is not gated, so it works even when they are locked out.

**"My month was 30 days, not 31."** A "month" here is a fixed 30 days. February is a good deal,
July slightly less so. Over a year a customer pays for 12.17 months, about 1.4% more than a
calendar-month subscription. Put "per 30 days" on the pricing page and it is a non-issue; leave
"per month" and someone will eventually do the arithmetic.

**"Can I get an invoice?"** Not from the contract. The `Settled` and `Deposited` events are a
complete, timestamped record you can render into one, but you have to build that.

---

## 5. The gate, and the failure you have to choose

`SubscriptionGate` caches for `GATE_CACHE_TTL_MS` (default 15s). Caching is safe here for two
specific reasons, and it is worth knowing them before you change the TTL:

1. A subscription can only be **ended early** by the customer themselves. A stale positive costs
   you at most one TTL of free service to someone who just cancelled.
2. `expiresAt` is a bound the chain has already committed to, so the cache never trusts an entry
   past it. A lapse from running out of money is always caught on time, whatever the TTL.

The gate also watches `Cancelled` events and invalidates immediately, so the TTL is a backstop
rather than the normal path.

**Fail open or fail closed?** When the RPC is unreachable and there is no usable cached answer,
you either serve everyone or serve nobody. `GATE_FAIL_OPEN=false` (the default) fails closed:
paying customers get 503s during an RPC outage. `true` gives free access to anyone who asks for
the duration.

For a $5/month weather API, **fail open is probably the right call** — an outage that takes down
paying customers costs more in goodwill than a few hours of free forecasts costs in revenue. It is
left off by default because it is a decision you should make deliberately rather than inherit.
Either way the gate first falls back to a recently-expired cache entry, which covers most blips
without either failure mode being reached.

At real volume, replace the per-request `eth_call` with an event-driven cache: subscribe to
`Subscribed`/`Cancelled`/`Deposited`/`Withdrawn`, keep status in memory, and recompute expiry
locally. The contract's read surface is designed to support that — `statusOf` gives you everything
needed to rebuild state, and `reconcile()` in `monitor.ts` shows how to replay from logs.

---

## 6. Changing things

**Repricing.** Plan prices are immutable on purpose. A subscriber's rate is snapshotted when they
subscribe, so there is no mechanism by which you can quietly raise what an existing customer pays
— it is not that you should not, it is that you cannot. To reprice:

```bash
cast send $BILLING "addPlan(uint128)" 7000000   --rpc-url $RPC   # new $7 hobby, gets id 2
cast send $BILLING "setPlanActive(uint32,bool)" 0 false --rpc-url $RPC  # close the old one
```

Existing subscribers keep running at $5 until they cancel or switch. Point new signups at the new
id and tell the old cohort they are grandfathered — which is a nicer story than a price-rise email
anyway.

**Pausing.** `pause()` blocks new deposits and new subscriptions. It does **not** block
`withdraw`, `cancel` or `settle` — a pause must never trap customer funds, and the tests assert
this. Live subscriptions keep running and keep being billed. Use it if you find a problem and want
to stop taking new money while you think.

**Upgrading.** The contract is not upgradeable. That is deliberate for something holding customer
deposits — no proxy means no admin key that can rewrite the accounting. The cost is that changing
behaviour means a migration: deploy the new contract, `pause()` the old one, ask customers to
`cancelAndWithdraw()` and re-subscribe on the new address. Plan for that being a real, if
infrequent, piece of work. Keep the customer list current; you will need it.

---

## 7. Keys and trust

What the owner key **can** do: add plans, close plans to new signups, pause new spending, withdraw
revenue that has actually accrued, and sweep stray transfers.

What it **cannot** do: touch an unspent customer balance, charge anyone more than their plan rate,
charge for time that has not elapsed, change a live subscriber's price, or stop anyone withdrawing
or cancelling. A compromised owner key is bad — the attacker takes the accrued revenue, which is
at most one settlement cycle's worth — but it does not put customer deposits at risk.

Given that, the practical advice:

- **Use a multisig as `OWNER`.** Ownership transfer is two-step (`transferOwnership` then
  `acceptOwnership` from the new owner), so a typo cannot brick the contract.
- Settling more often shrinks the blast radius of a key compromise, since less revenue is sitting
  in `earned` at any moment.
- `withdrawEarnings` takes an explicit destination, so revenue is still recoverable if your owner
  address ends up on Circle's USDC blocklist. Which brings us to:

**USDC is a centralised token.** Circle can freeze an address, and the contract is upgradeable by
Circle, not by you. If the contract address were ever blocklisted, deposits and withdrawals would
both stop. There is nothing to do about this beyond knowing it is the trust assumption you took on
by pricing in USDC, and it is the same assumption Stripe carries.

---

## 8. Known limits

Deliberate trade-offs, listed so they are not surprises:

- **A month is 30 days.** See §4.
- **Rounding favours the customer.** Per-second accrual truncates down, costing you well under a
  cent per settlement. Not worth fixing.
- **Subscribing costs the customer gas.** On Base this is a fraction of a cent. On Ethereum
  mainnet it would be a significant fraction of a $5 plan — do not deploy this to L1 at these
  prices.
- **Billing is public.** Anyone can see who subscribes, on which plan, and when they cancel.
  Addresses are pseudonymous, but if you also know a customer's identity, the link is permanent
  and public. Worth a line in your privacy policy.
- **An address is not a person.** Lose the key, lose the subscription and the remaining balance;
  there is no password reset. `depositFor` lets you top someone up as a goodwill gesture, but you
  cannot move a subscription between addresses.
- **No usage metering, no overages, no annual discount, no free trial.** All of these are
  straightforward to add on top — a trial is a plan with `price` near zero — but none are built.
- **No dispute or chargeback mechanism.** This is a feature relative to card payments, until the
  one time you want to refund someone who cannot withdraw for themselves. You can always
  `depositFor` them.
- **The contract has not been audited.** It is small, tested (42 unit and fuzz tests, 4
  invariants) and deliberately boring, but if it is going to hold more than you would be relaxed
  about losing, get someone to read it first.
- **Monitor timestamps use wall-clock time** to compute "days left", while the contract uses block
  timestamps. On a real network these agree to within seconds. On a test chain where you have
  warped time, the monitor's numbers will look wrong — that is the test chain, not a bug.
