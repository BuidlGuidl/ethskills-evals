# Weather API — on-chain subscription billing

USDC subscription billing to replace Stripe for a small API service. Customers prepay, pick a
plan, and the backend asks the chain whether an address may make a request.

- **$5/month hobby, $20/month pro**, paid in USDC.
- **Prepaid.** A customer deposits, then subscribes. No allowances to keep topped up, no pull
  payments that fail silently when a wallet runs dry.
- **Cancel any time, instant refund.** Unused credit is theirs, withdrawable in the same
  transaction as the cancellation.
- **No keeper, no cron, no scheduler.** Whether someone is subscribed is a pure function of
  on-chain state. Billing does not stop working because a job did not run.

`NOTES.md` covers running this once it is live. Read it before deploying to mainnet.

## How the billing works

Prices are quoted per month, but the charge accrues **per second** out of the prepaid balance.
Thirty days of hobby costs exactly $5; ten days costs exactly $1.667. The subscription stays live
for as long as the balance can fund it, month after month, until the customer cancels or runs out.

That one decision is what makes the rest fall out:

| Requirement | How it is met |
|---|---|
| Top up with USDC up front | `deposit` credits an in-contract balance |
| Pick a plan | `subscribe(planId)` — 0 hobby, 1 pro |
| Charged monthly while subscribed | The meter runs at plan price ÷ 30 days, indefinitely |
| Cancel and get unused funds back | `cancelAndWithdraw` settles the seconds used, returns the rest |
| Backend checks per request | `isSubscribed(address)` — one `eth_call`, cached |

The alternative — charging a lump sum on a monthly boundary — needs a keeper to fire the renewal,
and leaves you owing a pro-rata refund anyway the moment someone cancels mid-month. Accruing by
the second removes both problems.

## Layout

```
src/SubscriptionBilling.sol       the contract
src/interfaces/                   read surface for integrators
script/Deploy.s.sol               production deploy, writes deployments/<chainId>.json
script/DeployLocal.s.sol          mock USDC + contract on anvil
script/Ops.s.sol                  Settle / WithdrawEarnings / Report
test/                             unit, fuzz and invariant tests
backend/src/billing.ts            the gate: cached subscription lookup
backend/src/auth.ts               resolving a request to an address
backend/src/server.ts             worked example API
backend/src/monitor.ts            the thing you put on a cron
```

## Try it locally

```bash
make anvil                 # terminal 1
make deploy-local          # terminal 2 — prints the addresses, writes deployments/31337.json

cd backend && npm install
BILLING_CONTRACT=0x... RPC_URL=http://127.0.0.1:8545 npm start
```

Subscribe as anvil account #1 and call the API:

```bash
BILLING=0x...   # from make deploy-local
USDC=0x...
KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

cast send $USDC "approve(address,uint256)" $BILLING 100000000 --private-key $KEY --rpc-url http://127.0.0.1:8545
cast send $BILLING "depositAndSubscribe(uint256,uint32)" 20000000 0 --private-key $KEY --rpc-url http://127.0.0.1:8545

ADDR=$(cast wallet address --private-key $KEY)
TS=$(date +%s)
MSG=$(printf 'api.example-weather.com wants you to authenticate.\nAddress-bound API access.\nTimestamp: %s' $TS)
curl -s -H "X-Address: $ADDR" -H "X-Timestamp: $TS" \
     -H "X-Signature: $(cast wallet sign --private-key $KEY "$MSG")" \
     http://localhost:3000/v1/forecast
```

## Deploy

```bash
cp .env.example .env     # set OWNER and NETWORK
make test
NETWORK=base_sepolia make deploy
```

Base is the sensible default: native Circle USDC, and a subscribe transaction costs a fraction of
a cent, which matters when the product itself is $5/month. The deploy script refuses to run against
a payment token that is not 6-decimal, and defaults USDC to the canonical address for the chain.

Sign with a hardware wallet or a keystore account (`--ledger`, `--account`), not a raw private key
in an environment variable.

## Contract reference

**Customer**

| Function | Notes |
|---|---|
| `deposit(amount)` | Requires an ERC-20 approval first |
| `depositWithPermit(amount, deadline, v, r, s)` | One transaction, no prior approval |
| `depositFor(user, amount)` | Sponsor someone else's account |
| `subscribe(planId)` | Also switches plans, pro-rata. Needs one period of credit |
| `depositAndSubscribe(amount, planId)` | The first-time path |
| `cancel()` / `cancelAndWithdraw()` | Stops the meter at that second |
| `withdraw(amount, to)` | Unused credit only. Works even while paused |

**Backend**

| Function | Notes |
|---|---|
| `isSubscribed(user)` | The per-request gate |
| `isSubscribedTo(user, planId)` | Tier-aware variant |
| `areSubscribed(users[])` | Batch, one round trip |
| `statusOf(user)` | Plan, expiry, balance, accrued |
| `expiresAt(user)` | When the balance runs out at the current rate |

**Operator**

| Function | Notes |
|---|---|
| `settle(user)` / `settleMany(users[])` | Permissionless. Moves used credit into revenue |
| `withdrawEarnings(to, amount)` | Settled revenue only |
| `addPlan(price)` / `setPlanActive(id, bool)` | Prices are immutable; reprice by adding a plan |
| `pause()` / `unpause()` | Blocks new spending. Never blocks withdrawal or cancellation |
| `sweepSurplus(to)` | Recovers tokens sent in directly rather than deposited |

## Tests

```
forge test          # 42 unit + fuzz tests, 4 invariants
```

The invariant suite drives random customer and operator traffic and asserts the contract stays
solvent, that its internal accounting matches the sum of individual balances, that nobody goes into
debt, and that a live subscription always has funds behind it.
