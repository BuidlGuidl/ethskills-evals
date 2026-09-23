# Onchain billing for the weather API

USDC subscriptions on Base. Customers prepay, pick a plan, and are billed by the second
at a monthly rate; they can cancel any time and get back whatever they haven't used. The
API backend checks one `eth_call` per request.

**Read [NOTES.md](NOTES.md)** — how it runs once it's live, what to watch, and what the
design gives up.

```
src/Subscriptions.sol     the billing contract
src/ISubscriptions.sol    the read interface a gatekeeper needs
script/                   deploy, add/close a plan, collect revenue
test/                     unit + fuzz tests, and stateful solvency invariants
backend/                  the per-request gate (viem + express)
```

## Quick start

```sh
cp .env.example .env      # fill in OWNER and an RPC url
make test                 # 23 tests
make test-deep            # + invariants, ~1 min
make deploy-testnet       # Base Sepolia
```

Then, in the API service:

```js
import { requireSubscription } from "./backend/gate.mjs";
app.get("/v1/forecast", requireSubscription(), handler);
```

## How it works in one paragraph

A subscription is a prepaid balance plus a rate. `expiry = lastSettledAt + balance ×
period ÷ price`, and `isSubscribed` is `now < expiry`. Nothing is scheduled and nothing
renews itself: the charge is arithmetic over `block.timestamp`, so billing stays correct
with nobody running anything, and a refund is just the balance that hasn't drained yet.
The operator's only recurring job, `collect`, moves already-consumed balance into a
withdrawable pot — it's bookkeeping, it has no deadline, and anyone can call it.
