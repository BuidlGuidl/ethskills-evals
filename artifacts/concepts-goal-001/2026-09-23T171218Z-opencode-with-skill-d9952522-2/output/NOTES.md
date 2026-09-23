# NOTES — onchain billing for the weather API

## What's here

- `src/SubscriptionBilling.sol` — the whole billing system, one contract, no dependencies
  beyond USDC itself.
- `test/SubscriptionBilling.t.sol` — forge tests (`forge test`).
- `script/Deploy.s.sol` — deployment (`USDC_ADDRESS=... forge script script/Deploy.s.sol
  --rpc-url <chain> --broadcast --verify`). Well-known USDC addresses are in the file.
- `scripts/check-subscription.mjs` — the per-request check your backend runs. Zero
  dependencies, plain JSON-RPC.

## How it actually works

A customer sends two transactions: `deposit(usdcAmount)` (after a USDC `approve`) and
`subscribe(plan)`. From that second, their prepaid balance drains continuously at the
plan's rate — $5 or $20 per 30 days, charged per-second. `cancel()` refunds whatever
hasn't drained yet. `isSubscribed(address)` is a view function: your backend calls it
with `eth_call`, which costs no gas and writes nothing.

The most important thing to understand: **"charged monthly" is a rate, not a job.**
Nothing onchain runs on a schedule — there is no cron, no monthly billing transaction,
no keeper bot to host, pay, or monitor. The contract computes fees from timestamps
whenever someone touches an account, and `isSubscribed` does the same math at read
time. A customer whose balance runs out simply starts reading as unsubscribed from the
moment their money ran out; nobody has to notice or flip a switch. This is why the
system keeps working if you go on vacation, and it's the property you'd lose the
moment someone "simplifies" it by adding a monthly charge transaction.

Consequences of that design, all deliberate:

- A lapsed customer who comes back owes **no back-debt**. Lapsing zeroes the plan, so
  topping up a year later and resubscribing starts fresh (there's a test for this).
- Subscribing requires at least one full period prepaid, so nobody is "subscribed" for
  eleven seconds.
- Refunds are exact to the second: cancel halfway through a month, get half back.
- Fee math rounds down, fractionally in the customer's favour. Dust, by design.

## Day to day

**Your only revenue task is `collect(amount, to)`.** Fees customers have already
consumed pile up in `accruedFees`; call `collect` whenever you feel like sweeping them
to your own address. Weekly, monthly, never-until-tax-time — it changes nothing for
anyone else. That call is the only maintenance the system needs, and you're the one
paid to do it, so it doesn't depend on your discipline the way a cron job would.

**The backend check** is `scripts/check-subscription.mjs`, or inline the same two-line
`eth_call` into your auth middleware:

- `isSubscribed(address)` → boolean gate for the request.
- `timeUntilLapse(address)` → seconds of runway left; use it to email "top up soon"
  warnings, because a customer who runs dry **lapses silently** — there is no failed
  payment email to send, the money just runs out.

Cache the result per address for a few seconds. A customer can only become *less*
subscribed as time passes, so a short cache can delay a cancellation taking effect by
seconds but can never grant access to someone whose balance is gone.

**Customers interact directly with the contract** — your own little UI, a block
explorer's "Write Contract" tab, or `cast`. You are not in the loop for deposits,
cancellations, or refunds, and you can't be forced to be.

## What to keep an eye on

- **Chain choice is a pricing decision.** Customers pay gas on `deposit`/`subscribe`/
  `cancel`. On mainnet that can exceed a month of hobby tier; on an L2 like Base it's
  cents. For $5/month plans, deploy on an L2. USDC addresses per chain are in
  `script/Deploy.s.sol` — use native USDC, not a bridged "USDC.e".
- **Your RPC is now in the request path.** If your RPC provider is down, every API
  request fails its billing check. Run two providers and fail over, and decide your
  failure mode explicitly: fail-closed (paying customers get errors during an RPC
  outage) or fail-open with a short cache (a lapsed customer gets a few more minutes).
  For a hobby API, fail-open-with-cache is usually right.
- **Prices are immutable.** $5/$20 are constants in the contract. Changing prices means
  deploying a new contract and asking customers to cancel (they get refunded) and
  resubscribe there. There is no way to reprice an existing subscriber under them —
  that's a feature for them and a constraint for you. Plan grandfathering accordingly.
- **USDC itself is the trust assumption you can't remove.** Circle can freeze USDC in
  any contract, including this one. If that ever happened, balances would be stuck but
  the accounting would keep working. This is inherent to billing in USDC; just know
  it's there.
- **The owner key protects only revenue, not customers.** It can `collect` accrued fees
  and transfer ownership — nothing else. Keep it in a hardware wallet or a multisig
  anyway, because whoever holds it collects your income. If you *lose* it: accrued fees
  are stuck forever, but every customer can still deposit, subscribe, cancel, and be
  refunded. You'd deploy a fresh contract and point the backend at it.

## What this design gives up (plain words)

- **Can anyone be stopped from using it?** Not by you. The contract has no pause, no
  blacklist, no upgradeability, and no owner power over customer balances — you cannot
  freeze, kick, or reprice a paying customer, and neither can anyone who steals your
  key. The one lever that exists above you is Circle's freeze on USDC itself (above).
  If you ever need the ability to refuse service to a specific address, that has to
  live in your API layer, not in this contract.
- **Could someone else run it?** The billing half, yes: verified contract, public
  state, customers can read their balance and cancel from a block explorer without you.
  If you disappear tomorrow, billing keeps working and every customer can still get
  their unused money back — but the weather API itself is yours and dies with you, so
  what they'd be paying for is gone. The honest split: the money layer survives you,
  the service layer doesn't.
- **What does an observer learn?** Everything, forever: which addresses subscribed, on
  which plan, what they deposited, when they cancelled. Your entire customer list and
  revenue are scrapeable by competitors from day one. That's the price of putting
  billing onchain; access control on your API endpoints is a separate question and
  doesn't change it.
- **What does "audited" cover?** Nothing — this code has not been audited. It's ~150
  lines with a test suite (`forge test`), which is a starting point, not a guarantee.
  Before real money accumulates, get an external review; an audit is a point-in-time
  opinion about a fixed scope, not a standing warranty.
