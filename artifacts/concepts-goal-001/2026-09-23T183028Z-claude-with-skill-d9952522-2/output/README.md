# Onchain subscription billing

USDC subscription billing for an API service. Customers prepay, pick a plan, and are
metered per second until they cancel or run out. The backend gates each request on a
single view call.

**[NOTES.md](./NOTES.md) is the document to read** — how it runs day to day, what to
watch, and what this design gives up. This file is just the commands.

## Layout

```
src/SubscriptionBilling.sol      the contract
script/Deploy.s.sol              deploy + open the plans
script/Ops.s.sol                 accept ownership, change plans
test/                            forge tests (32, incl. fuzz) + a gas report
backend/subscription-gate.mjs    per-request gate for your API
ops/collect.mjs                  status report and revenue sweep
ops/e2e-local.mjs                full lifecycle rehearsal on local anvil
```

## Setup

```bash
forge install          # only if lib/ is missing
npm install
cp .env.example .env   # then fill it in
```

## Test

```bash
forge test                              # contract
forge test --match-contract GasTest -vv # gas numbers quoted in NOTES.md
forge build && npm run e2e              # contract + gate + ops ABI together, on anvil
```

## Deploy

```bash
# rehearse on testnet first
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
BILLING_CONTRACT=0x... forge script script/Ops.s.sol --tc AcceptOwnership --rpc-url base --broadcast
```

`BILLING_TOKEN` is immutable and `BILLING_OWNER` should be a Safe. See NOTES.md.

## Operate

```bash
npm run status    # subscribers, float, claimable revenue, who's about to lapse
npm run collect   # settle accrued revenue and withdraw it
```

## Gate an API request

```js
import { createSubscriptionGate } from './backend/subscription-gate.mjs'

const gate = createSubscriptionGate({
  rpcUrl: process.env.RPC_URL,
  contract: process.env.BILLING_CONTRACT,
})

app.get('/v1/forecast', async (req, res) => {
  if (!(await gate.isSubscribed(req.session.address))) {
    return res.status(402).json({ error: 'no active subscription' })
  }
  res.json(await forecast(req.query))
})
```

The address must come from an authenticated session (SIWE), not a header — the contract
answers "is 0xabc subscribed", not "is this caller 0xabc", and subscriber addresses are
public. See the authentication note in NOTES.md.

## Customer flow

```solidity
usdc.approve(billing, 60e6);
billing.depositAndSubscribe(60e6, 1);  // $60 buys 12 months of the $5 hobby plan
// ...later, any time:
billing.cancelAndWithdraw(msg.sender); // unused portion comes straight back
```
