# Onchain subscription billing

USDC subscriptions for a small API service. Customers prepay, pick a tier, are metered by the
second, and can walk away with the unused remainder at any time. Your backend checks whether an
address is paid up with a free `eth_call`.

Built for Base (any EVM chain and any ERC-20 works). **[NOTES.md](./NOTES.md) is the one to read**
— how it runs day to day, what to monitor, and what the design gives up.

## The idea in four lines

```
owed(user)      = min(rate × (now − startedAt) / 30 days,  deposited)
expiresAt(user) = startedAt + deposited × 30 days / rate
isSubscribed    = now < expiresAt
refund on exit  = deposited − owed
```

No billing cycle, no keeper, no cron. A contract only moves when someone pays gas to move it, so
"charge everyone monthly" would mean N transactions a month that nobody is paid to send. Here the
meter is arithmetic over a timestamp, evaluated when someone reads it. A customer's access ends
the moment their prepaid balance runs out, with no transaction from anyone.

The one recurring transaction is your own payday — `settleAndCollect()` — and skipping it harms
nobody. See NOTES.md §2.

## Layout

```
src/SubscriptionBilling.sol   the contract
script/Deploy.s.sol           deploy + seed plans, hands ownership over in two steps
script/Sweep.s.sol            the payday transaction
script/LocalDemo.s.sol        fake USDC + contract + funded customer on anvil
test/                         37 unit tests, gas benchmarks
test/invariant/               5 fuzzed invariants: solvency, no money printing, accounting
backend/src/                  the API gate: cached chain reads, wallet sign-in, per-plan quotas
backend/scripts/              subscriber list from logs, single-address chain lookup
tools/e2e-local.sh            the whole stack against a throwaway anvil
```

## Try it

```bash
forge test                # contracts
cd backend && npm install && npm test && cd ..
./tools/e2e-local.sh      # deploy, subscribe, sign in, get data, expire, sweep, refund
```

`e2e-local.sh` is the one worth running — it catches the things unit tests do not, like an ABI
that drifted from the contract or a cache that never invalidates.

## Contract surface

**Customers**

| function | |
|---|---|
| `subscribe(planId, amount)` | start and fund; needs an ERC-20 approval first |
| `topUp(amount)` / `topUpFor(account, amount)` | add time; anyone can fund anyone |
| `changePlan(newPlanId)` | settle at the old rate, restart at the new one |
| `withdraw(amount, to)` | take some back, stay subscribed |
| `cancel(to)` | refund every unspent cent, prorated to the second |

**Anyone** — `settle(address[])`, `collect()`, `settleAndCollect(address[])`. Permissionless
because they can only move money the way the accrual formula already says it went.

**Reads** — `isSubscribed(a)`, `expiresAt(a)`, `owedOf(a)`, `refundableOf(a)`, `pendingOf(a)`,
`pendingOfMany(a[])`, `statusOf(a)`.

**Owner** — `setPlan`, `setRevenueRecipient`, `sweepSurplus`, `rescueToken`, two-step ownership
transfer. No pause, no blacklist, no proxy, and nothing that can touch a user's deposit. The full
accounting of what the operator can and cannot do is in NOTES.md §5.

## API

| | |
|---|---|
| `GET /v1/auth/nonce?address=` | a human-readable message to sign |
| `POST /v1/auth/token` | `{address, signature}` → bearer token (EOA or ERC-1271) |
| `GET /v1/subscription` | what the gate sees for you |
| `GET /v1/forecast?lat=&lon=` | the product; 402 if unsubscribed, 429 over plan quota |
| `GET /health` | cache stats, watcher liveness, RPC error counts |

Not audited. See NOTES.md §5 before it holds real money.
