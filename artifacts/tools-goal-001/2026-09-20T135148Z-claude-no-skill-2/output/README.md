# wallet-activity-x402

A pay-per-call HTTP API for AI agents. An agent asks for a wallet summary, gets
back `402 Payment Required`, pays a few cents of USDC inline in the retry, and
receives the data. No accounts, no API keys, no invoices.

Payment uses [x402](https://x402.org) — an open HTTP-402 scheme where the price
and payment terms travel in the response, and the payment itself travels in an
`X-PAYMENT` request header as a signed
[EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) USDC authorization.

```
agent ──GET /wallet/0xabc/summary──────────────▶ server
agent ◀──402 + {price, payTo, asset, network}── server
agent ──GET again + X-PAYMENT (signed USDC)────▶ server ──verify+settle──▶ facilitator ──▶ Base
agent ◀──200 {summary...} + X-PAYMENT-RESPONSE─ server
```

## Where the payment settles

On **Base**, in **USDC**, directly to `PAY_TO_ADDRESS` — there is no escrow and
no custodian holding your funds. A *facilitator* verifies the signature and
broadcasts the `transferWithAuthorization` call (it pays the gas; the agent
needs no ETH, only USDC). The settlement tx hash comes back to the caller in the
`X-PAYMENT-RESPONSE` header.

| `NETWORK` | USDC | Facilitator | Credentials |
|---|---|---|---|
| `base-sepolia` (default) | `0x036CbD…DCF7e` (testnet) | `https://x402.org/facilitator` | none |
| `base` (mainnet, real money) | `0x833589…2913` | Coinbase CDP | `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` |

## Run it

```bash
npm install
cp .env.example .env     # set PAY_TO_ADDRESS at minimum
npm run server           # http://localhost:4021
```

Free discovery endpoints: `GET /` (price + terms) and `GET /healthz`.
The paid endpoint is `GET /wallet/:address/summary`. Hit it unpaid to see the
challenge:

```bash
curl -i localhost:4021/wallet/0x4200000000000000000000000000000000000006/summary
```

Then pay for it with the bundled client. Put a funded key in
`CLIENT_PRIVATE_KEY` (testnet USDC: <https://faucet.circle.com>, pick Base
Sepolia) and run:

```bash
npm run client -- 0x4200000000000000000000000000000000000006
```

It prints the summary and the settlement receipt. The paying and retrying is
handled by `wrapFetchWithPayment`, so in your own agent code it stays a plain
`fetch`:

```ts
import { createPayingFetch } from "./src/client.js";

const fetchWithPay = await createPayingFetch();
const res = await fetchWithPay("http://localhost:4021/wallet/0xabc.../summary");
```

`MAX_PAYMENT_BASE_UNITS` caps what the client will auto-pay (default $0.10) —
above that it throws instead of paying.

## What the endpoint returns

A one-paragraph `summary` string plus the structured numbers behind it: ETH
balance, EOA-vs-contract, all-time outbound tx count, and — over the last 50
transfers — the date range, gas spent, most-touched counterparties, and
per-asset transfer counts with net amounts.

Balance / nonce / code come straight from the Base RPC and always work. Transfer
history needs an indexer, picked automatically:

1. **Alchemy** — used when `BASE_RPC_URL` is an Alchemy URL
   (`alchemy_getAssetTransfers`). Free tier covers Base mainnet; recommended.
2. **Etherscan V2** — used when `ETHERSCAN_API_KEY` is set. Free tier covers
   Base *Sepolia* but **not** Base mainnet, which needs a paid plan.
3. Neither → the summary still returns, with a note saying history was omitted.

## Layout

| File | |
|---|---|
| `src/server.ts` | Express app; `paymentMiddleware` gates every route registered after it |
| `src/activity.ts` | Builds the wallet summary; RPC + pluggable history provider |
| `src/client.ts` | Paying `fetch` wrapper, usable as a module or a CLI |
| `src/config.ts` | Env parsing, network/chain selection |

## Where to go next

- **Ship on mainnet**: set `NETWORK=base`, add CDP keys, use a real
  `PAY_TO_ADDRESS`. Sanity-check `PRICE` against your indexer costs first.
- **Price per route**: the `routes` map in `src/server.ts` takes one entry per
  path pattern (`[address]` matches a path segment), so a cheap summary and an
  expensive full-history endpoint can coexist.
- **Get discovered**: x402 has a public resource index
  ([x402.org/ecosystem](https://x402.org/ecosystem)); the `outputSchema` in
  `src/server.ts` is what agents read to learn the response shape.
- **Cache**: repeat lookups of the same wallet within a block cost you nothing
  to serve but still earn a fee — a short TTL cache keeps indexer costs flat if
  an agent polls.
- **Order of operations**: the facilitator rejects replayed authorizations, but
  if you add expensive work, keep it after payment verification, not before.

## Verified / not verified

The full loop — 402 → sign → retry with `X-PAYMENT` → facilitator verification —
was exercised against the live x402.org facilitator; it rejected the payment
only because the test wallet held no USDC. **A funded settlement has not been
run**, nor has the mainnet CDP facilitator path or either history provider (no
API keys here). Those are the first things to confirm with your own keys.
