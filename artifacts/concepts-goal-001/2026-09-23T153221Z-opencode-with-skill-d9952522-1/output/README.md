# Onchain USDC billing for the weather API

Two plans (Hobby $5/mo, Pro $20/mo, 30-day months), prepaid USDC credit,
prorated refunds on cancel, and a gas-free per-request subscription check for
the backend. No admin keys, no cron, no keeper — see `NOTES.md` for how that
works and what to watch day to day.

## Layout

- `src/WeatherBilling.sol` — the billing contract
- `script/Deploy.s.sol` — mainnet/Base deploy script
- `script/LocalDemo.s.sol` — end-to-end demo on a local anvil
- `test/WeatherBilling.t.sol` — 26 tests incl. proration-conservation fuzz
- `tools/check-subscribed.mjs` — dependency-free backend subscription check
  (Node 18+)
- `NOTES.md` — **read this**: operations, incentives, and trade-offs

`lib/` (forge-std) and `out/` are generated tooling/artifacts — nothing to read there.

## Commands

```sh
forge test                                   # run the suite

# try the full flow locally
anvil &
forge script script/LocalDemo.s.sol --rpc-url http://127.0.0.1:8545 \
  --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
node tools/check-subscribed.mjs 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --billing <printed address> --rpc http://127.0.0.1:8545

# deploy for real (all constructor params are immutable — check them twice)
USDC_ADDRESS=0x... TREASURY_ADDRESS=0x... \
  forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

## Backend integration

```js
import { checkSubscribed } from "./tools/check-subscribed.mjs";
const ok = await checkSubscribed(RPC_URL, BILLING_ADDRESS, customerAddress);
```

Read-only `eth_call`, no gas; safe to cache 30–60 s per address.