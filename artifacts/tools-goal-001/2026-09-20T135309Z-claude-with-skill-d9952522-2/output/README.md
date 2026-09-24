# wallet-activity — a pay-per-call API for agents (x402 on Base)

An agent calls `GET /activity/:address`, gets a `402 Payment Required` with the
exact terms, signs a USDC payment inline, retries with an `X-PAYMENT` header, and
gets the summary. No accounts, no API keys, no invoices.

- **Server:** Express + `@x402/express` payment middleware.
- **Client:** `@x402/fetch` — `wrapFetchWithPayment` handles the 402 + retry.
- **Data:** the Blockscout REST API for Base (indexed transactions and token
  transfers; the server is the consumer, so REST fits better than MCP here).

## Run it

```bash
npm install
cp .env.example .env     # set PAY_TO (server) and AGENT_PRIVATE_KEY (client)

npm run server                                   # terminal 1
npm run client -- 0x4200000000000000000000000000000000000006   # terminal 2
```

Defaults to **Base Sepolia**, so you can exercise the full flow with testnet
USDC. Fund the agent wallet from the [Circle faucet](https://faucet.circle.com)
(Base Sepolia USDC). Payers need USDC only — the facilitator pays the gas.

Check the gate without a wallet:

```bash
curl -i localhost:4021/activity/0x4200000000000000000000000000000000000006
# HTTP/1.1 402 Payment Required + a PAYMENT-REQUIRED header with the terms
```

## Where the payment settles

Payment is an **EIP-3009 `transferWithAuthorization` signature over USDC**, not a
transaction the agent broadcasts. The agent signs; a **facilitator** verifies the
signature and broadcasts the transfer on Base. USDC moves directly from the
agent's wallet to your `PAY_TO` address — funds never pass through this server or
the facilitator.

| `CHAIN` | Network | USDC | Facilitator |
| --- | --- | --- | --- |
| `base-sepolia` (default) | `eip155:84532` | `0x036CbD…CF7e` | public `https://x402.org/facilitator`, no credentials |
| `base` | `eip155:8453` | `0x833589…2913` | Coinbase CDP, needs `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` |

The settlement tx hash comes back on the `X-PAYMENT-RESPONSE` header of the paid
response; `src/client.ts` decodes it and prints the explorer link.

## Going to mainnet

1. Get CDP API keys at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
   and put them in `.env`.
2. Set `CHAIN=base` and `PAY_TO` to an address you control (a safe, not the key
   sitting on the server — the server never holds funds, so nothing else changes).
3. Deploy behind HTTPS and set `SERVER_URL` to the public origin; the URL is
   embedded in the 402 challenge that clients sign over.

## Layout

| File | What it does |
| --- | --- |
| `src/config.ts` | One `CHAIN` switch drives network, Blockscout host, explorer, price |
| `src/server.ts` | Express app; `paymentMiddlewareFromConfig` gates `GET /activity/*` |
| `src/activity.ts` | Builds the summary from Blockscout REST |
| `src/client.ts` | `x402Client` + `wrapFetchWithPayment`; also exports helpers to embed in an agent |

## Next steps worth taking

- **Price per route.** `price` accepts a function of the request, so a deeper
  lookup can cost more than a shallow one.
- **Multiple networks.** Register more schemes/networks in the `accepts` array
  and agents pick whichever they hold funds on.
- **Discovery.** `GET /` advertises the price in plain JSON so an agent can
  decide before spending; keep it accurate as the price changes.
- **Caching.** Repeated lookups of the same wallet cost you Blockscout calls but
  earn a fee each time — cache briefly if you'd rather serve them cheaply.

## Package note

This uses the maintained scoped `@x402/*` family (v2). The unscoped `x402`,
`x402-fetch`, and `x402-express` packages are frozen at 1.2.0 with a different
API shape — don't mix them in.
