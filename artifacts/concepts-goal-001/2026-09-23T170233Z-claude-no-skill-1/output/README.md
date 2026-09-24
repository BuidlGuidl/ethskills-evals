# Onchain subscription billing for the weather API

USDC subscriptions on Base, replacing Stripe. Customers top up, pick a plan,
and are charged monthly until they cancel; cancelling refunds the unused time.
The API gateway answers "is this address subscribed?" with a single view call.

```
src/         SubscriptionBilling.sol + the read interface the backend uses
script/      deploy and day-to-day ops (forge script)
test/        unit, fuzz and invariant tests
backend/     the gateway: address binding, entitlement cache, example server
deployments/ one committed JSON record per chain
NOTES.md     how this runs once it is live, and what to watch
```

## How it works in one paragraph

Subscribing moves one period's price out of the account's `credit` into escrow
and starts a paid period. Renewals are **computed, not pushed**: when someone
reads or writes the account, the contract replays every 30-day boundary that has
passed since the last touch, in closed form. There is no keeper, no cron, and no
"payment pending" state to reconcile. When `credit` can no longer fund a
renewal, the subscription lapses at that boundary and the remainder stays the
customer's. Cancelling ends access immediately and returns the unused part of
the current period, pro rata to the second.

## Quick start

```bash
forge build && forge test          # or: make test

anvil &                            # local chain
make deploy-local                  # deploys a MockUSDC + the billing contract

cd backend && npm install
BILLING_ADDRESS=<addr> USDC_ADDRESS=<addr> npm run demo   # end-to-end smoke test
BILLING_ADDRESS=<addr> CHAIN=anvil npm run serve          # the gated API
```

## Deploying

```bash
cp .env.example .env               # fill in BILLING_OWNER and RPC URLs
make deploy-testnet                # Base Sepolia
make deploy-mainnet                # Base, via Ledger
```

The deploy script writes `deployments/<chain>.json`; the ops scripts and the
backend read the address from there, so it is never copy-pasted.

## Day two

See [NOTES.md](./NOTES.md) — running it, the monthly revenue sweep, what can go
wrong, and what to alert on.
