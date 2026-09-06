# Onchain subscription billing for the weather API

USDC subscriptions with no keeper, no scheduler, and no way for the operator to touch a
customer's prepaid balance. Read [NOTES.md](./NOTES.md) for how it runs once it's live, what to
watch, and what the design gives up — that's the document written for you rather than for a
reviewer.

## What's here

```
src/SubscriptionBilling.sol      the contract — the whole thing, one file
script/Deploy.s.sol              deploy + create the two launch plans
script/Ops.s.sol                 day-two ops: status, books, settle, collect, plan changes
script/LocalDev.s.sol            anvil-only: fake USDC + contract + a funded customer
test/                            35 unit and fuzz tests
test/invariant/                  7 invariants over randomised call sequences
backend/subscriptionGate.js      the per-request check, cached correctly
backend/exampleServer.js         a gated API, including the address-proof half
backend/e2e.mjs                  end-to-end run against a local chain
```

`lib/`, `out/`, `cache/` and `broadcast/` are generated.

## How it works in one paragraph

A customer prepays USDC and picks a plan. Their cost accrues per second at the plan's rate,
computed at read time from `block.timestamp` — so `isSubscribed(address)` is always current with
nobody having sent anything. A subscription ends when the prepaid balance runs out, which happens
by the clock moving and cannot fail. `cancel()` refunds the unused remainder to the second, needs
no cooperation from the operator, and cannot be blocked. `settle()` only writes down revenue that
is already earned; skipping it forever changes no balance and no access decision.

## Setup

```bash
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0
forge build
```

## Test

```bash
forge test                                  # 35 unit + fuzz tests
forge test --match-path 'test/invariant/*'  # 7 invariants, ~16k calls each
forge test --gas-report
```

## Run it end to end locally

```bash
anvil &
forge script script/LocalDev.s.sol:LocalDev --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

cd backend && npm install && cd ..
node backend/e2e.mjs
```

Walks a customer through signup, two months of billing with nobody sending a transaction,
cancellation with a refund, lapsing by running out of runway, and settlement from an unprivileged
caller. Re-runnable against a dirty chain.

## Deploy

```bash
export BASE_RPC_URL=...
export ETHERSCAN_API_KEY=...

forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --account deployer
```

Defaults to canonical USDC on Base (8453) and Base Sepolia (84532), $5 and $20 per 30 days, and
the broadcasting address as owner. Override with `USDC_ADDRESS`, `HOBBY_PRICE`, `PRO_PRICE`,
`BILLING_OWNER`. Make `BILLING_OWNER` a multisig — see the key management note in NOTES.md.

## Run the API

```bash
BILLING_ADDRESS=0x... BASE_RPC_URL=... SESSION_SECRET=... node backend/exampleServer.js
```

`exampleServer.js` is a reference for the two things that are easy to get wrong: proving a request
really comes from the address it claims, and caching the subscription check without letting a
lapsed or cancelled account through. Lift those two pieces into your real service; the weather
endpoint is a stub.
