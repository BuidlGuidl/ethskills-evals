# wallet-activity-api

A pay-per-call HTTP API for AI agents. The caller pays a few cents of USDC
inline in the request; the endpoint returns a short summary of a wallet's
recent on-chain activity. No accounts, no API keys, no invoices.

Payment uses **[x402](https://www.x402.org)** — the HTTP 402 status code turned
into a real protocol. The exchange is:

1. Agent calls `GET /summary/:address`.
2. Server replies `402 Payment Required` with a `payment-required` header
   describing price, asset, network and recipient.
3. The client signs an EIP-3009 `transferWithAuthorization` for exactly that
   amount and retries with a `payment-signature` header.
4. Server verifies the signature with a facilitator, runs the handler, and
   returns `200` plus a `payment-response` header containing the settlement tx
   hash.

Steps 2–4 are automatic — the agent's code just calls `fetch`.

## Where the payment settles

| | |
|---|---|
| **Asset** | USDC (6 decimals) |
| **Network** | Base Sepolia by default (`eip155:84532`), Base mainnet (`eip155:8453`) when `CHAIN=base` |
| **Recipient** | `PAY_TO_ADDRESS` — your wallet, set in `.env` |
| **Mechanism** | EIP-3009 `transferWithAuthorization` on the USDC contract |
| **Custody** | None. The transfer is payer → `PAY_TO_ADDRESS` directly. The facilitator only broadcasts it and pays the gas; it never holds your funds. |

The payer never needs ETH for gas — they sign an authorization, the facilitator
submits it. That is what makes per-call micropayments practical for agents.

**Facilitators:**
- `CHAIN=base-sepolia` → `https://x402.org/facilitator`, free, no signup.
- `CHAIN=base` → Coinbase CDP (`@coinbase/x402`), needs `CDP_API_KEY_ID` /
  `CDP_API_KEY_SECRET` from [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com).

## Run it

```bash
npm install
cp .env.example .env    # set PAY_TO_ADDRESS at minimum
npm run server
```

In another terminal:

```bash
npm run client -- 0xSomeWalletAddress
```

The client needs `CLIENT_PRIVATE_KEY` set to a wallet holding testnet USDC on
Base Sepolia (get some from the [Circle faucet](https://faucet.circle.com)).
It prints the summary and a link to the settlement transaction.

### Verify the paywall without paying

```bash
curl -i http://localhost:4021/summary/0x4200000000000000000000000000000000000006
# HTTP/1.1 402 Payment Required
# payment-required: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3I...
```

`GET /` is free and advertises price, network, asset and `payTo`, so an agent
can decide whether to call before spending anything.

## Layout

| File | Role |
|---|---|
| `src/server.ts` | Express app; x402 middleware gates `GET /summary/:address` |
| `src/client.ts` | `getWalletSummary()` — a fetch that pays and retries automatically |
| `src/activity.ts` | The product: wallet summary built from Blockscout's free API |
| `src/config.ts` | Chain/price/env wiring, Base and Base Sepolia |

Malformed addresses are rejected **before** the paywall, so a caller is never
charged for a 400.

## Verified working

Run end to end against Base Sepolia:

```
unpaid       -> 402 with payment-required header
bad address  -> 400 (free, never reaches the paywall)
paid         -> 200, 25 txs analyzed
settlement   -> 0x21d709b0…0051b
```

That [settlement transaction](https://base-sepolia.blockscout.com/tx/0x21d709b0fd5fa24435ea15791dc16c9beb59ea1a4c759c51ccc760d65290051b)
is a `transferWithAuthorization` moving 20000 USDC units (= $0.02) from the
payer to `payTo`, in the same HTTP exchange that returned the summary.

If the handler fails (Blockscout down, so a 502), the middleware cancels
settlement — a failed call is not charged.

## Where to take it next

- **Go to mainnet:** set `CHAIN=base`, add CDP keys, point `PAY_TO_ADDRESS` at a
  wallet you control. Nothing else changes.
- **Price per caller or per query:** `price` and `payTo` in the route config
  both accept a function of the request, so you can do volume pricing or
  route revenue to different wallets.
- **Make it discoverable:** x402 has a "bazaar" extension that lists your
  endpoint so agents can find it without being told the URL.
- **Deepen the data:** `src/activity.ts` currently reads the last 25 txs from
  Blockscout. Token transfers, approvals and a risk score are the obvious
  upsells, and justify a higher price.
