# Onchain billing for the weather API

USDC subscriptions that replace Stripe: customers prepay, pick a plan, get charged every 30
days while they stay, and get the unused remainder back the moment they cancel. The API
backend answers "is this address subscribed?" with one cached view call.

See **[NOTES.md](NOTES.md)** for how it runs once it is live and what to watch.

## Layout

```
src/SubscriptionBilling.sol   the contract; everything else is scaffolding around it
script/Deploy.s.sol           deployment, writes deployments/<chainid>.json
script/Ops.s.sol              settle / collect / set price / pause / report
test/                         unit + fuzz + stateful invariant suites
backend/gate.js               per-request subscription check, cached and event-invalidated
backend/auth.js               sign-in-with-wallet, issues an API key bound to an address
backend/server.js             the weather API with the gate in front of it
backend/settle-bot.js         monthly settle + revenue sweep
backend/e2e.local.js          full lifecycle rehearsal against a local anvil
```

## The design in four sentences

Deposits go into a credit balance the customer owns. Subscribing moves one period's price
into escrow; when the period ends the escrow becomes merchant revenue and the next period is
funded from the remaining credit, automatically, until the credit runs out. All of that is
computed in closed form by a `view` function, so `isSubscribed` is correct whether or not
anyone has run a settlement transaction — settlement only decides when the merchant can
*withdraw*, never whether a customer is *subscribed*. Cancelling refunds the unused part of
the period in progress, pro-rated by the second.

The invariant that holds it together, enforced by the stateful test suite:

```
token.balanceOf(contract) >= customerFunds + accruedRevenue
```

## Build and test

```bash
forge test                  # 29 unit + fuzz tests
forge test --match-path 'test/Solvency*'   # 128k-operation stateful invariant run
```

## Rehearse the whole lifecycle locally

```bash
anvil --silent &
npm install
npm run e2e
```

Deploys a mock USDC and the contract, signs in, subscribes, gets served, jumps a month
forward to watch it renew unattended, runs the credit dry, confirms service is cut off,
confirms a late top-up is *not* eaten by the downtime, resubscribes, cancels halfway through
a month, and checks the refund to the cent.

## Deploy

```bash
export BASE_SEPOLIA_RPC_URL=...
export ETHERSCAN_API_KEY=...
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
```

Reads `USDC` (defaults to the canonical USDC on Base and Base Sepolia), `BILLING_OWNER`
(defaults to the deploying key), `HOBBY_PRICE` and `PRO_PRICE` (default $5 and $20, in
6-decimal units). Writes the result to `deployments/<chainid>.json`.

Transfer ownership to a multisig afterwards — `transferOwnership` then `acceptOwnership`.

## Run the API

```bash
RPC_URL=https://mainnet.base.org \
BILLING_ADDRESS=0x... \
API_SECRET=$(openssl rand -hex 32) \
npm run gateway
```

A customer signs a message once to get an API key bound to their address:

```bash
curl -sX POST localhost:8787/v1/auth/challenge -d '{"address":"0x..."}'
# sign the returned `message` with the wallet, then
curl -sX POST localhost:8787/v1/auth/key -d '{"address":"0x...","nonce":"...","signature":"0x..."}'
curl -s localhost:8787/v1/weather?city=lisbon -H "Authorization: Bearer wk_..."
```

Unsubscribed addresses get `402 Payment Required`. Over-quota keys get `429`. If the chain
cannot be reached and there is no usable cached answer, `503` — never `402`.

## Collect revenue

```bash
RPC_URL=... BILLING_ADDRESS=0x... node backend/settle-bot.js                 # report only
RPC_URL=... BILLING_ADDRESS=0x... PRIVATE_KEY=0x... PAYOUT_TO=0x... \
  node backend/settle-bot.js                                                # settle + sweep
```
