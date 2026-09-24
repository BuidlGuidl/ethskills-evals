# wallet-summary — a pay-per-call API for agents

An HTTP endpoint that returns a short summary of a wallet's recent on-chain
activity, gated behind an inline **x402** payment. No accounts, no API keys, no
invoicing: the caller signs a stablecoin payment inside the HTTP exchange and
gets the data back on the retry.

```
GET /v1/wallet/:address/summary     $0.01 per call, paid in USDC
```

## The flow

1. Agent calls the endpoint with no payment.
2. Server answers **402 Payment Required** with a `PAYMENT-REQUIRED` header
   describing price, asset, network and recipient.
3. Client signs an **EIP-3009 `transferWithAuthorization`** for that exact
   amount. This is an off-chain signature — no transaction, no gas for the agent.
4. Client retries with the signature in the `X-PAYMENT` header.
5. Server hands the signature to a **facilitator**, which verifies it and
   broadcasts the USDC transfer to your `PAY_TO` address.
6. Server runs the handler and returns the summary, plus a `PAYMENT-RESPONSE`
   header containing the settlement transaction hash.

Your server never touches the agent's key and never custodies funds — the USDC
moves directly from the agent's wallet to yours.

## Where the payment settles

| `X402_NETWORK` | Chain | Asset | Facilitator |
|---|---|---|---|
| `base-sepolia` (default) | Base Sepolia (84532) | USDC `0x036C…CF7e` | `https://x402.org/facilitator` — free, no credentials |
| `base` | Base mainnet (8453) | USDC `0x8335…2913` | Coinbase CDP — needs `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` |

Funds land as a plain ERC-20 transfer to `PAY_TO`. `$0.01` becomes `10000` atomic
units (USDC has 6 decimals). The facilitator pays the gas and never takes
custody. You can watch revenue arrive on Basescan at your `PAY_TO` address.

## Run it

```bash
npm install
cp .env.example .env    # set PAY_TO, and AGENT_PRIVATE_KEY for the demo client
npm run server          # terminal 1
npm run client          # terminal 2 — pays and prints the summary
```

`npm run client` takes an optional wallet argument:

```bash
npm run client -- 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

The paying wallet needs **USDC on the chosen network** — but no ETH, since it
never sends a transaction. Base Sepolia USDC comes from
<https://faucet.circle.com>.

Unpaid and malformed requests are cheap to check by hand:

```bash
curl -i localhost:4021/                                 # free discovery: price + network
curl -i localhost:4021/v1/wallet/0xd8dA...6045/summary   # 402 + payment requirements
curl -i localhost:4021/v1/wallet/nonsense/summary        # 403, rejected before charging
```

## Layout

| File | Role |
|---|---|
| `src/server.ts` | Express app; x402 middleware gates the paid route |
| `src/facilitator.ts` | Picks the facilitator for the configured network |
| `src/summary.ts` | The product: wallet digest built from public Blockscout data |
| `src/client.ts` | `createPaidFetch()` — a `fetch` that pays and retries; also a runnable demo |
| `src/config.ts` | Network table, price, ports |

## Notes on the design

- **Bad input is rejected before payment.** An `onProtectedRequest` hook 403s a
  malformed address up front, so nobody is ever charged for a request that was
  always going to fail.
- **The client caps its own spend.** `createPaidFetch` sets a `$0.05` per-call
  ceiling and only spends the network's default asset, so a misconfigured or
  hostile server can't quote an agent into a large payment.
- **Reads need no API key.** The summary comes from the chain's public Blockscout
  instance. If you outgrow its rate limits, swap `src/summary.ts` for an
  Alchemy- or Etherscan-backed implementation — nothing else changes.

## What to do next

1. **Point `PAY_TO` at a wallet you control**, and keep `.env` out of git.
2. **Go to mainnet** when ready: set `X402_NETWORK=base`, get CDP API keys from
   <https://portal.cdp.coinbase.com>, and put them in `.env`. Everything else is
   identical; prices stay dollar-denominated.
3. **Tune the price** via `PRICE`. Per-route pricing is just another entry in the
   `routes` object in `src/server.ts`.
4. **Make yourself discoverable** — x402 has a "bazaar" extension for listing
   paid endpoints so agents can find them without being told the URL.
5. **Deploy behind TLS.** The payment signature is bound to amount, recipient and
   a deadline, so replay isn't the risk — but an agent that can't verify your
   host has no idea who it's paying.

Verified end to end on Base Sepolia: a `$0.01` call settled as a USDC
`transferWithAuthorization` to `PAY_TO` and returned the summary in the same
exchange.
