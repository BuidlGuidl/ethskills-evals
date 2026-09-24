# Onchain subscription billing

USDC subscription billing for an API service, on Base. Customers prepay, pick a plan, and are
metered by the second; the backend checks entitlement with one contract read.

```
src/SubscriptionBilling.sol   the contract (single file, no proxy, no pause)
script/Deploy.s.sol           deployment
script/Ops.s.sol              settle / sweep / manage plans
test/                         25 tests incl. solvency fuzzing
backend/src/billing.ts        the per-request subscription gate (viem)
NOTES.md                      how this runs day to day, and what to watch
```

## Quick start

```bash
forge build && forge test          # contracts
cd backend && npm install && npm run typecheck

cp .env.example .env               # fill in TREASURY, RPC urls
make deploy-testnet
```

Read **NOTES.md** before going live — the operational model differs from Stripe in ways that
matter (there is no monthly charge job, and there is no chargeback).
