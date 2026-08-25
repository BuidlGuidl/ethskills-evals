# Onchain billing for the weather API

USDC subscriptions for an HTTP API. Customers prepay, pick a plan, and are metered by the second;
the backend asks one `view` function whether an address is paid up before serving a request.

- `src/SubscriptionBilling.sol` — the whole billing system, one contract, no proxy.
- `script/` — Foundry deploy + operations scripts, and `local-demo.sh` which runs the entire
  lifecycle against a local anvil.
- `backend/` — the API gate: prove address ownership, then check the subscription (cached).
- `NOTES.md` — **read this one.** How it runs day to day, what to watch, and what the design
  gives up.

## How it works in one paragraph

A contract has no clock. "Charge every subscriber monthly" would be a transaction somebody has to
send for every subscriber forever — and the day that somebody stops, billing stops. So nothing is
pushed here. A plan has a price per 30 days, the prepaid balance drains against it per second, and
every read computes the current position from a stored timestamp. `isSubscribed(address)` goes
false by itself at the exact second the money runs out, with no transaction from anyone. Cancelling
is one user transaction that stops the meter and leaves the unused remainder immediately
withdrawable — refunds are exact to the second because the charge was never rounded to a month.

## Try it

```bash
forge test                 # 35 tests: unit, fuzz, and four invariants
./script/local-demo.sh     # anvil + deploy + subscribe + lapse + refund + collect, end to end
```

## Deploy

```bash
cp .env.example .env       # fill in RPC + the USDC address for your chain
source .env
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify --account deployer
```

The deploy seeds plan 1 at $5/30d and plan 2 at $20/30d, and refuses to run against a token that
does not have 6 decimals. It writes `deployments/<chainId>.json`, which the backend reads.

## Run the gate

```bash
cd backend && npm install
BILLING_ADDRESS=0x... RPC_URL=https://... WS_RPC_URL=wss://... \
  SESSION_SECRET=$(openssl rand -hex 32) CHAIN_ID=8453 npm start
```

```
GET  /nonce?address=0x…            → message to sign
POST /session {address, signature} → bearer token (1 h)
GET  /v1/forecast?city=…           → 200, or 402 with the top-up details
GET  /v1/account                   → plan, balance, paid-through timestamp
```

## Customer's side

```bash
cast send $USDC "approve(address,uint256)" $BILLING 15000000 --account me   # $15
cast send $BILLING "subscribe(uint32,uint256)" 1 15000000 --account me      # hobby, 3 months
cast call $BILLING "expiresAt(address)(uint256)" $ME                        # paid through
cast send $BILLING "cancelAndWithdraw(address)" $ME --account me            # leave, get the rest
```
