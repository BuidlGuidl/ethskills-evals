# WeatherBilling — Running It

Prepaid USDC subscriptions for the weather API: customers deposit, pick the
$5 hobby or $20 pro plan, time is charged at the plan rate, cancel refunds
every unspent cent, and your backend checks access per request with a free
contract read.

## The one idea that matters

**Contracts cannot run themselves.** There is no cron, no scheduler, no
background process — every state change needs a human (or bot) to pay gas
for a transaction. A naive onchain copy of Stripe would have a "monthly
charge" function and immediately raise the question: *who calls it every
month, forever, and why?* Miss a month and you either bill nobody or keep
serving expired customers.

This design dissolves the question instead of answering it. A subscription
is a **stream, not a calendar event**: the customer's USDC sits in the
contract and is consumed at their plan's rate, and the amount consumed at
any moment is a *pure function of time*:

```
coveredUntil  = lastSettle + balance * period / price
isSubscribed  = coveredUntil > now
```

The ledger only moves when someone touches the account (topUp / subscribe /
cancel / poke). Nobody has to touch it. The "monthly charge" costs zero gas
and works during your vacation, after your company dissolves, and for every
customer at once — because it's computed, not executed. When the balance
runs dry the subscription lapses silently; a later topUp restarts coverage
from that moment and never charges for the lapsed gap.

### Who pokes what, and why

Every state transition, with its caller and their incentive:

| Transition          | Who calls            | Why they bother                             |
|---------------------|----------------------|---------------------------------------------|
| `topUp`             | customer             | wants to keep API access                    |
| `subscribe(planId)` | customer             | wants the plan                              |
| `cancel`            | customer             | wants the refund of unspent funds           |
| settle (internal)   | piggybacked on the above | no dedicated caller needed             |
| `poke(addr)`        | you, occasionally    | realizes stale consumption into `revenue`   |
| `collectRevenue`    | you                  | profit                                      |
| `isSubscribed`      | your backend         | read-only, free                             |

Nothing here requires a keeper, a bot, or an operator on a schedule. The
only routine call *you* make is collecting your own money.

## Deploying

Tooling is [Foundry](https://book.getfoundry.sh). One-time setup:

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge install                      # already done: forge-std is the only dependency
```

Recommended home: **Base** (native Circle USDC, transactions cost cents,
which matters since customers pay their own gas). Mainnet works too, just
pricier.

1. `cp .env.example .env` and fill it in. **Verify the USDC address** against
   Circle's official list — a typo sends customers' money to an arbitrary
   token contract: https://developers.circle.com/stablecoins/usdc-contract-addresses
2. Deploy:

   ```bash
   make deploy    # = forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
   ```

   This deploys `WeatherBilling`, adds plan 1 (hobby, $5/30d) and plan 2
   (pro, $20/30d), and — if `OWNER_ADDRESS` is set — hands ownership to it
   (use a Safe, see below). On Base the whole thing costs a few cents of gas.

3. Save the deployed address; it goes in your backend's `BILLING_ADDRESS`.
4. If `--verify` fails, verify manually on basescan.org with
   `forge verify-contract`, or just leave it — but verification is what lets
   customers confirm the contract before approving it, so do it.

A "month" onchain is exactly 30 days (2,592,000 seconds) — there are no
calendar months in a block timestamp.

## Day to day

**Routine operations: none.** There is nothing to renew, nothing to bill,
nothing to babysit. The two things you'll actually do:

- **Collect revenue** whenever you feel like it: `collectRevenue(treasury)`
  from the owner address (Etherscan → "Write Contract", or
  `cast send $BILLING "collectRevenue(address)" $TREASURY --private-key ...`).
  Note the revenue counter only realizes consumption when accounts are
  touched — most customers touch theirs constantly by topping up, but a
  customer who lapsed and vanished keeps their already-consumed-but-unsettled
  amount out of the counter until anyone calls `poke(theirAddress)` (a few
  cents of gas). Worst case is a delay in *your* ability to collect money
  that's already spent; customer funds and access are never affected.
- **Add a plan**: `addPlan(price, period)` — e.g. `addPlan(50000000, 2592000)`
  for a $50/30d enterprise tier. To change pricing, **add a new plan; never
  try to edit an old one** — plans are append-only by design, because
  coverage is derived from price/period and editing either would retroactively
  shrink or inflate existing subscribers' paid time. Old subscribers are
  grandfathered automatically; new customers pick the new plan.
  `setPlanEnabled(id, false)` stops offering a plan to *new* subscribers and
  never touches existing coverage.

**Customer support** is mostly pointing people at Etherscan (or building a
tiny frontend later): the flow is `approve` the billing contract for an
exact amount (like signing a single check — no blank checks needed, the
contract pulls exactly the `topUp` argument and nothing more), then
`topUp`, then `subscribe(1 or 2)`. All three are on the "Write Contract" tab
of the verified contract.

Useful facts for tickets:

- "Refund me" → they call `cancel()` themselves and get every unspent cent,
  instantly, trustlessly. **You cannot do it for them** — the contract has no
  function that moves a customer's balance anywhere but back to them. That's
  a feature: you can never be accused of withholding refunds, and a
  compromised owner key can't touch deposits either.
- "My subscription lapsed, don't charge me for the gap" → it never does.
  Re-topping up restarts coverage from that moment.
- "I switched plans mid-month" → time so far was charged at the old rate,
  the rest at the new rate. No proration tickets, ever.

**Backend wiring** (the per-request check): `isSubscribed(address)` is a
pure view call — `backend/check_subscribed.py` is a zero-dependency module
that calls it over JSON-RPC, with a 10-second TTL cache so hot customers
don't hammer the RPC. Wire it as:

```python
from check_subscribed import is_subscribed

if not is_subscribed(customer_address):
    return 402  # or your "payment required" response
```

Keep your API-key → address mapping in your own database (the contract only
knows addresses). Equivalent curl, if you ever need it raw:

```bash
cast call $BILLING "isSubscribed(address)" $CUSTOMER
```

Decide your failure policy explicitly: if the RPC is down, `is_subscribed`
raises — fail **closed** (deny the request) for a paid API. Failing open
gives away service during outages. If you'd rather not care, set
`CACHE_TTL = 60` and accept the staleness.

## What to keep an eye on

**The balance invariant.** At all times, the contract's USDC balance should
equal the sum of customer balances plus `revenue` (which reads the
uncollected part). Quick check:

```bash
cast call $USDC "balanceOf(address)" $BILLING      # should reconcile
cast call $BILLING "revenue()"
```

If you want it automated, poll those two plus per-customer `account()`
values daily and alert on drift. Drift can only mean a bug or a direct
token transfer to the contract (someone donating USDC — harmless).

**Lapses are silent.** No transaction occurs when a customer runs dry, so
there is *no event to listen for*. If you want to warn customers ("your
coverage ends in 3 days"), you must poll `coveredUntil(addr)` — e.g. daily,
for addresses from your API-key database — or watch `ToppedUp`/`Subscribed`
events to build your customer list and check each one. This is the one
place a small offchain job genuinely helps.

**The owner key.** Its entire blast radius: collecting `revenue`, adding
plans, toggling plan availability, transferring ownership. It cannot touch
deposits, pause the contract, or change anyone's coverage. Even so, put a
Safe (safe.global) or at least a dedicated key there — a stolen key loses
you the uncollected revenue and lets someone add silly plans, nothing
more, but that's still worth avoiding. There is deliberately **no pause
switch and no admin rescue**: nobody can stop a paying customer from being
served, including you.

**Everything is public.** Every customer address, balance, plan, top-up and
cancel is visible on the block explorer to anyone. For a weather API that's
almost certainly fine, but know it: your customer list and revenue are
effectively open books (CROPS — this is the privacy trade-off you accepted
by putting billing onchain).

**Rounding.** Charges are floored per settle: each settle undercharges by
less than one micro-cent of USDC, in the customer's favor, and it does not
compound. Ignore it.

**USDC specifics.** The token address is baked in at deploy — triple-check
it (bridged USDbC on Base is a common wrong answer; you want native
`0x833589fCD6eDb6E08f4c7C32D4f71B54bdA02913`). USDC is also your unit of
account: a depeg makes your $5 plan worth whatever USDC is worth — that's a
market risk, not a contract bug.

**Immutability is the upgrade path.** The contract is intentionally not
upgradeable — customer funds should never sit behind a key that can rewrite
the rules. If you ever need to change billing logic, deploy a new contract
and let customers migrate by cancelling (instant refund) and re-subscribing.
The old one keeps working for whoever stays, which is the point.

**Gas.** Customers pay cents on Base for topUp/subscribe/cancel; your
`collectRevenue` is cents; the backend check is free.

## Where things live

```
src/WeatherBilling.sol     the contract (no dependencies beyond a 3-line ERC-20 interface)
src/IERC20Minimal.sol
script/Deploy.s.sol         deploy + seed the two plans
test/WeatherBilling.t.sol   20 tests: accrual, lapse, gap-free re-up, proration, refunds, access control
test/MockUSDC.sol           6-decimal test token
backend/check_subscribed.py per-request access check for your API
Makefile                   make build | test | deploy
foundry.toml, .env.example
```

Run `forge test` before any deploy. The tests encode the semantics described
above (e.g. "lapsed gap is never charged", "cancel refunds unspent exactly")
— if a future change turns one red, you've changed billing behavior, not
just code.
