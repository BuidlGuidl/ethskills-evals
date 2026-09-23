# Onchain billing for the weather API

Prepaid USDC subscriptions. Customers top up, pick a plan, and are charged
per-second for as long as they stay subscribed. Cancel anytime, unused balance
refunded immediately. The backend checks `isSubscribed(address)` per request —
a free `eth_call`, no transaction needed.

## Layout

- `src/PrepaidBilling.sol` — the whole system, one contract, no dependencies
- `script/Deploy.s.sol` — deploy script (Foundry)
- `test/` — Forge tests, including `test/mocks/MockUSDC.sol`
- `backend/check-subscription.mjs` — reference per-request check (viem)
- `NOTES.md` — how this runs day to day once live, and what to watch

## Quick start

```sh
forge install foundry-rs/forge-std --no-commit   # once
forge test                                        # run the test suite
```

Deploy (Base mainnet USDC address is prefilled in `.env.example`):

```sh
cp .env.example .env    # fill in PRIVATE_KEY, USDC_ADDRESS, RPC_URL
source .env
forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

Backend check:

```sh
npm install viem
RPC_URL=... BILLING_ADDRESS=0x... node backend/check-subscription.mjs 0xCustomerAddress
```

or with cast alone:

```sh
cast call $BILLING_ADDRESS "isSubscribed(address)(bool)" 0xCustomerAddress --rpc-url $RPC_URL
```
