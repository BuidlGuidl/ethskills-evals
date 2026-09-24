# wallet-activity-x402

A paid HTTP API for AI agents. An agent calls `GET /activity?address=0x…`, pays a
few cents of USDC inline in the request, and gets back a short summary of that
wallet's recent on-chain activity on Base.

No accounts, no API keys, no invoicing — payment rides in an HTTP header using
[x402](https://x402.org), the HTTP `402 Payment Required` payment standard.

## How the payment works

1. The agent calls the endpoint with no payment.
2. The server answers **402** with a machine-readable price quote (amount, asset,
   recipient, network).
3. The client signs an **EIP-3009 `transferWithAuthorization`** for exactly that
   amount of USDC. This is a signature, not a transaction — the agent spends no gas.
4. The client replays the same request with an `X-PAYMENT` header.
5. A **facilitator** verifies the signature, lets the request through, and broadcasts
   the USDC transfer on-chain. The settlement tx hash comes back in `X-PAYMENT-RESPONSE`.

Steps 2–4 are fully automatic in the client — your agent code just awaits one call.

## Where the payment settles

USDC lands **directly in `ADDRESS_TO_PAY`, on-chain, per call**. There is no escrow,
no balance to withdraw, and no platform holding your funds.

| | Testnet (default) | Mainnet |
|---|---|---|
| `NETWORK` | `base-sepolia` | `base` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Facilitator | `https://x402.org/facilitator` (free, no credentials) | Coinbase CDP (**API keys required**) |
| Gas | Paid by the facilitator, not by you or the agent | Same |

Payments are settled individually, so revenue arrives as many small USDC transfers
rather than one invoice.

## Run it

```bash
npm install
cp .env.example .env     # set ADDRESS_TO_PAY to your address
npm run server
```

In a second terminal, point the client at a wallet you want summarized:

```bash
# PRIVATE_KEY in .env must hold USDC on base-sepolia
npm run client -- 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

Get test USDC from the [Circle faucet](https://faucet.circle.com) (pick Base Sepolia).
The agent wallet needs **USDC only** — no ETH, since the facilitator pays the gas.

To watch the protocol without paying, hit the endpoint raw and read the quote:

```bash
curl -s "http://localhost:4021/activity?address=0x4200000000000000000000000000000000000006" | jq
```

## Endpoints

| Route | Price | Description |
|---|---|---|
| `GET /activity?address=0x…` | `$0.02` | The product. Optional `limit` (1–50) and `windowDays`. |
| `GET /` | free | Service and price discovery. |
| `GET /health` | free | Liveness. |

`/activity` returns a `summary` string written for an agent to read directly, plus
structured `account` and `activity` fields. It distinguishes EOAs, contracts, and
EIP-7702 delegated smart wallets, and flags inbound-only token flow as likely airdrop spam.

Balances come from an RPC node; history comes from Blockscout's public Base instance,
which needs no API key. If Blockscout is slow or down, the response degrades to the
RPC-derived facts (`activity.source` becomes `"rpc-only"`) instead of failing.

**You are not charged for failures.** The payment middleware skips settlement whenever
the handler returns ≥ 400, so a bad address or an upstream outage costs the agent nothing.

## Using the client as a library

```ts
import { createPaidClient } from "./src/client/index.js";

const client = await createPaidClient({
  baseUrl: "https://your-api.example.com",
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  maxPriceUsdc: 0.10, // hard cap per call; the client refuses to overpay
});

const { data, payment } = await client.getActivity("0xd8dA…6045");
console.log(data.summary, payment?.transaction);
```

## Going to mainnet

1. Get CDP API keys at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) —
   Base mainnet has no free public facilitator.
2. Set `NETWORK=base`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`.
3. Point `ADDRESS_TO_PAY` at an address you control the keys for and can monitor.
4. Deploy behind TLS. x402 quotes embed the request URL, so the server must know its
   public origin — set `resource` in the route config if you terminate TLS at a proxy.

## What to do next

- **Tune the price.** `PRICE` in `.env`. Priced per call, so cost scales with usage.
- **Rate-limit by payer.** The payer address is in the verified payment payload; it's
  the natural key for abuse controls, since there are no accounts.
- **Richer summaries.** `src/server/activity.ts` builds the narrative deterministically
  (fast and cheap). Swapping in an LLM there is a contained change.
- **Get discovered.** The route is already marked `discoverable` with an input schema,
  so it can be listed in the x402 Bazaar for agents to find.

## Layout

```
src/config.ts           env parsing, network + facilitator selection
src/server/index.ts     Express app, payment gate, route definitions
src/server/activity.ts  the product: wallet activity summarizer
src/client/index.ts     paying client (library + CLI)
```
