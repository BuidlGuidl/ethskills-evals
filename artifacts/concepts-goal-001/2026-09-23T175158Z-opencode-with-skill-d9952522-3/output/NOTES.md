# NOTES — WeatherBilling

Onchain billing for the weather API: customers prepay USDC, pick the $5/month
hobby or $20/month pro plan, are charged for exactly the time they use, and
can cancel for an instant refund of the rest. Your backend checks subscription
status with a single free read per request.

## What's in this directory

- `src/WeatherBilling.sol` — the only contract (~180 lines, no dependencies
  beyond the USDC token itself).
- `test/WeatherBilling.t.sol` — Foundry tests, including a mock USDC.
- `script/Deploy.s.sol` — deployment script (reads `USDC` and `OPERATOR` env
  vars).
- `script/check-subscribed.sh` — what your backend shells out to (or copies).
- Setup from a clean clone: `forge install foundry-rs/forge-std --no-git
  --no-commit`, then `forge test`. Dependencies land under `lib/`, which is
  treated as generated and gitignored.

## The shape: no monthly transaction exists, because none can

Nothing onchain runs on a schedule — no cron, no keeper, no daemon. So
"charged monthly" is implemented as a rate, not a job: each plan has a monthly
price and is charged per second against prepaid credit. An account's
`paidThrough` timestamp — `lastSettled + credit × 30 days / price` — is the
exact moment its money runs out. Everything the system needs to know is
derived from that number:

- **Your backend check** (`isSubscribed(user)`) is just `now < paidThrough`.
  A free `eth_call`, correct at every instant, with no transaction needed to
  keep it current.
- **Charging** ("settling") happens lazily, inside the customer's own next
  action — `topUp`, `subscribe`, or `cancel`. No missed renewal is possible,
  because there is no renewal: while credit covers the rate, the subscription
  simply continues.
- **Refunds are exact by construction.** Cancelling settles what was consumed
  since the account's last action and returns the rest, to the second. A
  "month" is a fixed 30 days (2,592,000s); integer rounding leaves at most a
  fraction of a cent of dust, checked in tests at the boundaries.

Because settling runs inside the customer's own transactions, the contract
never holds a stale claim on money: the USDC in the contract always equals
`revenuePool` (settled, yours) plus the sum of everyone's `credit` (theirs).

## Who sends each transaction, and why they bother

| Function | Who sends it | Why they would |
|---|---|---|
| `topUp` | the customer | wants their service to keep running |
| `subscribe` | the customer | wants to start (or switch) a plan |
| `cancel` | the customer | it is the only way to get their money back |
| `isSubscribed` | your backend, as a read | free |
| `withdrawRevenue` | you | it moves out revenue that is already yours |
| (settle) | nobody by itself | runs inside the three customer actions |

Every state transition is someone acting in their own interest: the customer
to keep service or recover money, you to collect your earnings. Nothing
depends on a stranger, a bot, or you remembering to run anything. If you walk
away for a month, the worst case is your revenue pool sitting there waiting.

## Day to day, once live

**Deploying.** Base is the natural home for this (USDC is native there, gas
is cents). Verify the current native USDC address on the block explorer before
broadcasting — then:

```sh
export RPC_URL=<your Base RPC>
export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # CHECK THIS on basescan
export OPERATOR=<address that should receive your revenue>
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

The USDC and operator addresses are baked in at deploy and immutable. Use a
keystore (`--account`) or hardware wallet, never a raw private key in shell
history. On a real chain the constructor does not verify the token address —
getting it wrong means a dead contract and a redeploy, not lost funds.

**A customer onboards** with two transactions from their own wallet: `topUp`
(after a USDC approval) and `subscribe`. You never touch their keys. Keeping
a few months of credit topped up means the subscription never expires.

**Per-request check.** `WEATHER_BILLING=<addr> script/check-subscribed.sh
<customer-address>` exits 0 (subscribed) / 1 (not) / 2 (RPC garbage). At
hobby scale an `eth_call` per request is fine and free. When you outgrow
that, don't cache "true/false" — call `getAccount` and cache until
`paidThrough`: the answer is valid until that timestamp, then re-query (a
customer may have topped up in the meantime, so a passed `paidThrough` must
always be re-checked, never assumed false forever).

**Getting paid.** `withdrawRevenue()` moves the settled pool to the operator
address. Earnings enter the pool when an account is settled — that is, on
that customer's next action — so an idle subscriber's ongoing accrual stays
inside their credit for a while. That lag is deliberate and safe: the pool
can never exceed settled earnings, so customer refunds can never come up
short. Pull weekly and don't sweat it.

**A customer runs out of money.** Nothing fires, because nothing needs to:
from the runout moment, `isSubscribed` is false — the stale `plan` field just
sits inert until their next touch, when settling retroactively ends the
subscription at the runout moment. They paid for no gap they didn't get. When
they come back: `topUp` (their credit lands, still unsubscribed) then
`subscribe` (clock restarts now). Two transactions.

**Changing prices.** You can't — $5/$20 are immutable constants. This is by
design: an owner who could retune the price dial could raise it against
credit you are already holding. To change pricing, deploy a new contract;
customers `cancel` (full prepaid refund) and re-onboard. The old contract
keeps working for whoever stays.

## What to keep an eye on

1. **The balance invariant.** The contract's USDC balance must equal
   `revenuePool` + sum of all credits, exactly, always. Index the events
   (`ToppedUp`, `Subscribed`, `AccountLapsed`, `Cancelled`,
   `RevenueWithdrawn`) and alert if it ever drifts — it can't without a bug.
2. **No zero-credit subscribed accounts.** Settling clears the plan when
   credit hits zero, so a subscribed account with zero credit is impossible.
   If your indexer ever sees one, treat it as an incident.
3. **`revenuePool` growth vs your dashboard.** The pool only moves when
   customers act, so earnings lag behind usage for idle accounts. Fine — just
   know the lag exists when reconciling.
4. **The operator key.** Its only power is withdrawing settled revenue.
   Losing it strands *your* earnings in the contract forever — customers
   wouldn't notice (top-up, subscribe, cancel, refund, and your backend
   check all work without you), but your money stops coming out. Use a
   dedicated key, and consider a second signer before deploying.
5. **Backend caching.** Cache until `paidThrough`, never beyond. A stale
   "true" serves unpaid requests.
6. **Gas for the operator.** Keep a little ETH in the operator address for
   the occasional `withdrawRevenue`; customers pay their own gas (~cents on
   Base).

## What this design gives up

**Can anyone be stopped from using it?** No operator powers over customers
ship here: no pause, no blacklist, no upgradeable proxy, no admin over user
funds or access, no price changes. The one privileged function in the system
is `withdrawRevenue`, restricted to the operator address, and all it can move
is revenue already earned. A stolen operator key gets your earnings, never
customer money; a lost one strands your earnings while customers continue
unaffected.

**Could someone else run it?** Split the stack. The onchain half —
subscriptions, prepaid credit, refunds, the `isSubscribed` check — is
permissionless and needs nobody: if you vanish, customers can still prove
they paid, keep their subscriptions ticking, and pull refunds, and anyone
could build a competing weather API that bills against the same contract.
The half that dies with you is the service itself: the weather data, your
API frontend, and any indexing you built for the checks above.

**What does an observer learn?** Everything onchain is public forever:
every subscriber address, which plan they're on, how much credit each holds,
every top-up and cancellation, and every withdrawal you make. A competitor
can count your customers and their tiers from the events. The wallet ↔
API-key mapping stays offchain in your backend — that is your endpoints'
access control, a separate question from this contract.

**What does "audited" cover?** Nothing here is audited. The tests pin the
accounting to the second — exact refunds, lapse behavior, no charging for
gaps, plan switches, revenue withdrawal — but a review would be a
point-in-time look at this exact scope, not a standing guarantee about
whatever is running later.