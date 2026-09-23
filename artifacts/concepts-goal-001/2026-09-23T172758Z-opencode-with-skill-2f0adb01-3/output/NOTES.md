# WeatherBilling — running it day to day

Onchain subscription billing for the weather API: customers prepay USDC, pick a
plan ($5/mo hobby, $20/mo pro), and are metered per second. Cancelling at any
moment returns every unspent cent. Your backend checks one view function per
incoming request.

## What's in this repo

| Path | What it is |
|---|---|
| `src/WeatherBilling.sol` | The contract. Everything lives here (~300 lines, no dependencies) |
| `test/WeatherBilling.t.sol` | 34 tests incl. fuzz tests — `forge test` |
| `test/mocks/MockUSDC.sol` | Test-only USDC stand-in |
| `script/Deploy.s.sol` | Deploy script (`make deploy` / `forge script`) |
| `script/keeper.sh` | The revenue-collection cron job (see below) |
| `foundry.toml`, `Makefile`, `.env.example` | Tooling |

Stack: Foundry (`forge`, `cast`, `anvil` — https://getfoundry.sh). Zero external
Solidity dependencies, so the repo builds anywhere forge is installed. Nothing
hand-written lives under `lib/`, `out/`, or `build/` — those are generated.

## The model in one minute

**Prepaid metered billing.** The customer's "account" is a USDC credit balance
held by the contract. A subscription drains that balance at a fixed rate
(`price ÷ 30 days` per second). Money only leaves their balance for time they
actually had access to.

| Your requirement | Mechanism |
|---|---|
| Top up up front with USDC | `deposit()` — customer approves + transfers USDC in |
| Pick $5 / $20 plan | `subscribe(0)` / `subscribe(1)` (one combined tx: `depositAndSubscribe`) |
| Charged monthly | Credit accrues cost per second; a keeper calls `settle` to move earned money to you |
| Cancel & get unused money back | `cancel()` — refunds the entire remaining balance to the second |
| Per-request subscribed check | `isSubscribed(address)` — pure view, no wallet needed |

State machine: `None → Active → (Cancelled | Lapsed)`, and back to `Active` on
resubscribe. A subscription **lapses** when the credit hits zero; that happens
by arithmetic, not by a transaction.

Details worth knowing:

- **Months are 30 days** (2,592,000 s), not calendar months. A year is 12.17
  billing periods. If you ever want calendar months, that's a contract change.
- **USDC has 6 decimals**: $5 = `5000000`, $20 = `2000000`.
- **Rounding favors the customer**, at most 1 base unit ($0.000001) per settle.
  A $5 plan actually meters at ~1.93 units/second, truncated down.
- **Plan prices are snapshotted at subscribe time.** If you change a price,
  existing subscribers keep their old rate until they lapse, cancel, or switch.
- Subscribe/switch require **at least one full period of credit** — this
  prevents dust subscriptions.
- While subscribed, credit is committed to the meter; the way to get it out is
  `cancel()`. When not subscribed (never/lapsed/cancelled), `withdraw(amount)`
  moves credit out freely.

## Nothing is automatic — your two standing jobs

A contract cannot wake up on its own. Every state change needs a caller paying
gas. Design the ops around these two facts:

### Job 1: the keeper (moving earned revenue to your wallet)

Cost accrues into a customer's credit by arithmetic, but **the accrued money
does not move to you until someone calls `settle(customer)` or
`settleMany([...])`**. Nobody else has an incentive to do it, so this is yours.
The function is permissionless — anyone can call it, but it can only ever pay
the owner the formula-fixed amount, so strangers calling it are harmless (and
impossible to weaponize).

Run it **daily** (not monthly) so your revenue lands in your wallet promptly
and the contract never holds more than a day of your earned money. On an L2
this costs effectively nothing — `settleMany` settles one customer for ~63k gas
(roughly $0.001 on Base at current prices). A cron line does it:

```
0 6 * * * cd /srv/weather-billing && BILLING_ADDRESS=0x... RPC_URL=... KEEPER_PRIVATE_KEY=0x... ./script/keeper.sh customers.txt >> keeper.log 2>&1
```

`keeper.sh` reads one address per line from the file, filters junk, and sends
`settleMany` in chunks (default 150). Where does the address list come from?

- Your signup database (you already know which wallet belongs to which
  customer), or
- chain events: every `Subscribed`/`Deposited` event from the deployment block
  onward. Example:
  `cast logs --from-block <deploy-block> "Subscribed(address,uint256,uint256)" --rpc-url $RPC_URL`

If the keeper dies, nothing catches fire: **access control does not depend on
it** (see job 2). Earned revenue just waits in the contract, and the next
keeper run collects it correctly, because `settle` charges at most what credit
exists. Still, alert on keeper failures — it is your income.

### Job 2: the per-request gate (checking subscription status)

```
cast call $BILLING "isSubscribed(address)(bool)" $CUSTOMER
```

This is a pure view: `status == Active && accruedCost(now) < credit`. It
recomputes time-based expiry from block timestamps on every read, so it is
always current — it does not need the keeper, an indexer, or any poke. This is
the one source of truth for gating. Wire it into your auth middleware:

```ts
// per request, before serving:
const ok = await rpc.ethCall(billingAddress, encode("isSubscribed(address)(bool)", req.wallet));
if (!ok) return res.status(402).send("subscribe at ...");
```

Practical options, cheapest first:

1. **Direct `eth_call` per request.** Simplest, always correct. Needs a solid
   RPC provider; it is now part of your request path, so monitor its latency.
2. **Short-TTL cache** (30–60 s). A customer who cancels onchain can keep using
   the API until the cache expires — bounded, small exposure, usually fine.
3. **Index events + compute locally** (fastest, no per-request RPC): replay
   `Deposited`, `Subscribed`, `PlanSwitched`, `Settled`, `Cancelled`,
   `Withdrawn`, `Lapsed` into a table, then per request compute
   `remaining = credit − (now − lastSettle) × price ÷ 2592000` and serve if
   `> 0`. Use chain block timestamps, not your server clock.

**One trap, whichever you pick: do not gate on events alone.** Lapsing is
silent — a customer whose credit runs out generates *no event until someone
settles*. Time-based expiry only exists in the arithmetic. Options 1/2 are safe
by construction; with option 3 you must do the formula.

Your existing API-key auth doesn't change: keep mapping API key → wallet
address in your DB; the onchain check just replaces the Stripe webhook.

## Day-to-day runbook

### First deploy

```bash
cp .env.example .env      # fill it in
make deploy               # or: forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

Required env: `DEPLOYER_PRIVATE_KEY`, `OWNER_ADDRESS`, `USDC_ADDRESS`,
`RPC_URL`; optional `HOBBY_PRICE`, `PRO_PRICE` (defaults $5 / $20). Then:

1. Verify the source on a block explorer (add `--verify --etherscan-api-key $ETHERSCAN_API_KEY`).
2. Record the deployed address as `BILLING_ADDRESS` (used by keeper + backend).
3. Smoke-test: `make check ADDR=<your-own-test-wallet>` should say `false`.

Which chain? Any EVM chain with USDC. For a $5/mo product you want an L2 —
**Base** is the sensible default (native USDC at
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`; Ethereum mainnet USDC is
`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`). **Do not trust addresses from a
README — verify against Circle's official docs** (https://circle.com) before
deploying. A wrong token address means wrong prices and stranded funds.

`OWNER_ADDRESS` should be a dedicated wallet, ideally a hardware wallet or a
multisig — it receives all revenue and controls prices. Ownership moves are
two-step (`transferOwnership` then `acceptOwnership`), so a typo can't strand
the contract.

### How customers use it

Two transactions from their wallet, usually driven by a small page on your site:

1. `usdc.approve(BILLING, amount)` — this grants the contract permission to
   pull that many USDC, like signing a check for a specific amount. Tell
   customers why they're signing it; they approve a specific amount, never a
   blank check.
2. `billing.depositAndSubscribe(amount, 0 or 1)`.

Command-line equivalents (support/debugging):

```bash
cast send $USDC "approve(address,uint256)" $BILLING 10000000 --private-key $K
cast send $BILLING "depositAndSubscribe(uint256,uint256)" 10000000 0 --private-key $K
```

Top-ups while active just call `deposit(amount)` — accrued cost is settled to
you first, so a fresh top-up can never be eaten by old accruals.

### Changing prices / plans

```bash
cast send $BILLING "setPlan(uint256,uint256)" 0 6000000 --private-key $OWNER_KEY   # hobby → $6
cast send $BILLING "setPlan(uint256,uint256)" 2 15000000 --private-key $OWNER_KEY  # add a $15 tier
cast send $BILLING "setPlan(uint256,uint256)" 2 0 --private-key $OWNER_KEY        # price 0 = disabled
```

Plan ids 0 and 1 are hobby/pro; any other id up to ~4 billion works for new
tiers. Price changes affect only **new** subscriptions and plan switches —
existing subscribers are grandfathered at their snapshotted rate until they
resubscribe. Announce changes accordingly.

### Customer support recipes

```bash
# why is my API 402ing?
make check ADDR=0xCUST                     # subscribed right now?
cast call $BILLING "remainingCredit(address)(uint256)" 0xCUST   # seconds of runway left
cast call $BILLING "accruedCost(address)(uint256)" 0xCUST

# customer says "where's my refund?"
# the Cancelled event carries the refund amount; find it in their history:
cast logs "Cancelled(address,uint256)" --from-block <deploy-block> --rpc-url $RPC_URL

# customer's subscription lapsed (credit hit zero); they topped up but API still 402s
# → topping up does not resubscribe; they must pick a plan again:
cast send $BILLING "subscribe(uint256)" 0 --private-key $CUST_KEY
```

### Mistaken transfers

If anyone sends USDC **directly** to the contract (not via `deposit`), it isn't
credited to anyone and is recoverable:

```bash
cast send $BILLING "sweepExcess()" --private-key $OWNER_KEY
```

`sweepExcess` can only take `balance − totalCredits` — customer credit is
mathematically untouchable by it. Never deposit by direct transfer.

## What to keep an eye on

| Watch | How | Why |
|---|---|---|
| Keeper heartbeat | cron success log / `Settled` events appearing daily | Dead keeper = revenue waits in contract. Not a security issue, an income issue |
| RPC health | your usual uptime checks | `isSubscribed` is on your request path — RPC down ≈ API down (fail closed: deny on RPC error, never fail open) |
| `totalSettled` growth | `cast call $BILLING "totalSettled()(uint256)"` | Compare against expected MRR × days. A stalled counter means the keeper isn't running |
| Contract balance vs `totalCredits` | `cast call $USDC "balanceOf(address)(uint256)" $BILLING` | Balance **>** totalCredits → someone sent tokens directly (sweep them). Balance **<** totalCredits would indicate an accounting bug — take it seriously and get help; nothing in the design can cause it |
| `Lapsed` events | `cast logs "Lapsed(address)"` | That's your churn signal, per customer |
| Large deposits | `Deposited` events | The contract is custodial: customer credit is money you hold. Big balances = big custody responsibility. You can't steal it, but you are part of its security story |
| Owner key hygiene | it's your revenue address + price admin | Hardware wallet or multisig; `transferOwnership` + `acceptOwnership` is two-step, use it deliberately |
| Token & chain config | re-verify `usdc()` on the explorer after deploy | Wrong USDC address = wrong prices (6-decimal assumption is baked in) |

## Security posture — what the owner can and cannot do

**Can:** receive settled revenue; set prices for future subscribers; sweep
mistaken transfers; hand over ownership (two-step).

**Cannot:** touch customer credit (sweep only reaches funds not owed to
anyone); change an active subscriber's rate; pause the contract; unsubscribe
anyone; upgrade the code.

There is **no pause switch and no admin freeze** — that's deliberate. Nobody,
including you, can stop a customer from subscribing, using the API, or
withdrawing their money. Worth knowing: the contract is not upgradeable. If a
bug ever surfaces, the fix is a new contract and an orderly migration (customers
`cancel()` to self-refund, then move). Keep the code small — that's the
insurance.

**Privacy:** this is a public blockchain. Every customer's deposit size, plan,
balance, and cancellation is visible to anyone forever, and their address links
to whatever else that wallet does. For a hobby weather API that's usually
acceptable — but say so on your pricing page, and consider letting customers
use a dedicated wallet.

**Custody:** the contract holds prepaid customer credit. It can't be moved by
anyone but the customer (cancel/withdraw) or consumed by their own metering —
but the money does sit on your contract, so treat its security seriously.

## Design notes (why it works this way)

- **Why per-second metering instead of "bill $5 on the 1st":** contracts have
  no scheduler, so a monthly charge always needs a keeper anyway. Metering
  makes refunds exact with zero special cases (the unspent balance *is* the
  refund), lets customers self-manage top-ups, and never bills anyone for time
  they were locked out — when a subscription's gap between credit exhaustion
  and resubscription is settled, that gap is free, because `isSubscribed` was
  false during it and no access was served.
- **Why the contract holds credit (escrow) instead of pulling from the
  customer's wallet monthly:** monthly wallet pulls need recurring approvals
  and force you to chase customers for allowance; prepaid credit makes your
  revenue guaranteed, keeps `settle` possible without customer cooperation,
  and lets the keeper be a dumb, cheap cron. The tradeoff is custody, which
  you mitigate by keeping prepaid amounts small (plans are cheap — nobody
  should ever need a $500 balance).
- **Why `settle` is permissionless:** it can only ever pay `owner` the exact
  formula-fixed amount, so nobody can weaponize it. It also means the system
  never depends on your specific cron identity.
- **`isSubscribed` is self-updating:** the expensive-sounding part of this
  design (access expiring on time) costs nothing onchain, because the expiry
  is computed at read time from `block.timestamp` — no keeper, no indexer, no
  poke required. The keeper exists purely to move money.

## Test coverage

`forge test` runs 34 tests, including fuzz tests asserting the core invariants:
settle and cancel can never overcharge, always conserve funds (owner gain +
customer remainder == deposit), the view never disagrees with the post-settle
state, and the contract's USDC balance always equals `totalCredits`. All passed
against solc 0.8.28 at the time of writing.
