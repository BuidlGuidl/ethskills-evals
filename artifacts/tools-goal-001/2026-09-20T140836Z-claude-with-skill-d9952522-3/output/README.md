# wallet-activity-x402

A pay-per-call HTTP API: an agent asks for a wallet's recent on-chain activity,
pays a couple of cents inline in the same request, and gets the summary back.
No accounts, no API keys, no invoices.

Payment uses **x402**, the HTTP 402 payment protocol. The endpoint answers `402
Payment Required` with machine-readable terms; the client signs a USDC transfer
authorization, retries with an `X-PAYMENT` header, and the server settles it.

## What's here

| File | Role |
| --- | --- |
| `src/server.ts` | Express API, gated by `@x402/express` payment middleware |
| `src/activity.ts` | Wallet summary, read from Blockscout's indexed REST API |
| `src/client.ts` | TypeScript client that pays and retries automatically |

## Run it

```bash
npm install
cp .env.example .env    # set PAY_TO (your address) and PRIVATE_KEY (agent wallet)
npm run server          # terminal 1
npm run client -- 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045   # terminal 2
```

Defaults are **Base Sepolia** (`eip155:84532`) at `$0.02` per call. To see the
raw protocol handshake, ask without paying:

```bash
curl -i localhost:4021/activity/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
# 402 Payment Required + PAYMENT-REQUIRED header with amount, asset, payTo
```

`GET /health` is unpriced, so you can check the process is up for free.

## Where the payment settles

Each paid call moves **USDC on Base** from the agent's wallet to `PAY_TO`,
one on-chain transfer per call.

- Base Sepolia — USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Base mainnet — USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

The agent never sends a transaction itself. It signs an **EIP-3009
`transferWithAuthorization`** message, and a *facilitator* verifies that
signature, broadcasts it, and pays the gas. So a paying agent needs USDC but no
ETH. Your server never holds a key or touches the chain — it only talks to the
facilitator over HTTP.

On success the response carries an `X-PAYMENT-RESPONSE` header with the
settlement receipt, including the transaction hash. `npm run client` prints it.

### Which facilitator

- **Testnet (default).** No config needed — the public facilitator at
  `https://x402.org/facilitator` handles Base Sepolia for free.
- **Mainnet.** That public facilitator is testnet-only. Set `NETWORK=eip155:8453`
  plus `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` from the
  [Coinbase Developer Platform](https://portal.cdp.coinbase.com) and the server
  switches to the CDP facilitator automatically. It refuses to start on mainnet
  without them, rather than silently pointing at a testnet service.

## Data source

Summaries come from Blockscout's REST API (`base.blockscout.com`), which serves
indexed transactions, balances, and token holdings — no log decoding, no
explorer scraping. Add networks in `BLOCKSCOUT_BY_NETWORK` in `src/activity.ts`.

If you later want an agent to browse chain data directly rather than through
this endpoint, Blockscout also runs an MCP server at
`https://mcp.blockscout.com/mcp` that exposes the same data as agent tools.

## Verified so far

- Unpaid call returns 402 with correct amount (`20000` = $0.02 at 6 decimals),
  asset, and `payTo`.
- The client signs and retries automatically; with an unfunded wallet the
  facilitator rejects it as `invalid_exact_evm_insufficient_balance`, which
  confirms the whole path end to end.
- Settlement itself is untested here — it needs a wallet holding Base Sepolia
  USDC. Fund one from a faucet and `npm run client` will complete the loop.

## Where to go next

- **Price per route.** `accepts` takes an array, so one endpoint can quote
  several networks or tokens, and different routes can carry different prices.
- **Per-call spend cap.** The client calls `setSpendControls({ maxAmountPerPayment: "$0.10" })`
  so a hostile or misconfigured 402 can't drain the agent's wallet. Tune it.
- **Discovery.** x402 has a "bazaar" extension that lists your endpoint so
  agents can find and price it without hardcoding the URL.
- **Caching.** You pay Blockscout nothing, but you still pay latency; caching
  summaries for a few blocks cuts response time without changing the price.

## Pinned versions

The scoped `@x402/*` packages (`2.26.0` here) are the maintained line; the
unscoped `x402` / `x402-fetch` / `x402-express` packages are frozen at 1.2.0 and
use an incompatible API. Keep all `@x402/*` packages on the same major.
