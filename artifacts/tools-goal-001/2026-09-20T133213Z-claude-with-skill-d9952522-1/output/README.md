# wallet-activity-x402

A pay-per-call API: an agent asks for a wallet's recent on-chain activity, pays a few
cents inline in the same HTTP request, and gets the summary back. No accounts, no API
keys, no invoicing — payment rides on the [x402](https://x402.org) protocol.

- **Server** — Express + `@x402/express`, gating `GET /activity/:address`.
- **Client** — `@x402/fetch` wrapper that signs the payment and retries the call automatically.
- **Data** — Blockscout's REST API for Base (indexed transactions + token transfers).

## How the payment works

1. Agent calls `GET /activity/0xabc…` with no payment.
2. Server replies **402 Payment Required** with a `PAYMENT-REQUIRED` header describing
   price, asset (USDC), chain and your receiving address.
3. Client signs an EIP-3009 transfer authorization for that exact amount and retries the
   request with an `X-PAYMENT` header.
4. Server hands the signed payment to a **facilitator**, which verifies it and submits the
   USDC transfer on-chain, then runs the handler and returns the summary plus an
   `X-PAYMENT-RESPONSE` header containing the settlement transaction hash.

The agent's wallet needs USDC on the chain you configure — nothing else. It never needs
ETH for gas: the facilitator submits and pays for the transfer transaction.

## Where the payment settles

USDC on Base, transferred directly to the address in `PAY_TO`. There is no escrow and no
platform account in the middle — settled funds land in that wallet in the same request.

| `NETWORK` | Chain | USDC | Facilitator |
| --- | --- | --- | --- |
| `base-sepolia` (default) | Base Sepolia testnet | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `https://x402.org/facilitator` — public, no credentials |
| `base` | Base mainnet (real money) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Coinbase CDP, needs `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` |

## Run it

```bash
npm install
cp .env.example .env     # set PAY_TO, and CLIENT_PRIVATE_KEY for the demo client
npm run server           # http://localhost:4021
```

In another shell, pay for a call:

```bash
npm run client -- 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

The client prints the settlement tx hash and the summary JSON. To see the raw 402 instead:

```bash
curl -i localhost:4021/activity/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
curl -s localhost:4021/          # free discovery: price, network, payTo
```

For the testnet run, fund the client wallet with Base Sepolia USDC from
[Circle's faucet](https://faucet.circle.com). An unfunded wallet gets a clean
`invalid_exact_evm_insufficient_balance` rejection.

## Layout

```
src/config.ts              network table (chain ids, Blockscout hosts, facilitators)
src/server/index.ts        Express app + x402 payment middleware
src/server/activity.ts     Blockscout REST → activity summary
src/client/pay-and-fetch.ts  paying client
```

## Configuration

Server: `NETWORK`, `PAY_TO` (required), `PRICE` (default `$0.01`), `PORT` (default `4021`),
`FACILITATOR_URL`, `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` (mainnet only).
Client: `CLIENT_PRIVATE_KEY` (required), `NETWORK`, `API_URL`, `RPC_URL`.

## What to do next

- **Go to mainnet**: set `NETWORK=base`, add CDP API keys from
  [CDP Portal](https://portal.cdp.coinbase.com), point `PAY_TO` at a wallet you control.
  Test with a small `PRICE` first — mainnet payments are irreversible.
- **Price per call**: `PRICE` accepts `"$0.01"` style strings; a route can also take a
  function of the request if you want per-address or per-depth pricing.
- **Richer summaries**: `src/server/activity.ts` pulls two Blockscout endpoints. If you want
  the *agent* to explore chain data itself rather than consume a fixed summary, point it at
  the Blockscout MCP server (`https://mcp.blockscout.com/mcp`) instead of widening this API.
- **Discovery**: agents can find x402 endpoints through the Bazaar; routes accept an
  `extensions.bazaar` config to be listed.
- **Operational**: the payment settles before your handler runs, so a handler failure means
  the caller paid for nothing — add a refund path or `setSettlementOverrides` for partial
  settlement if upstream data can be missing. Malformed addresses are already rejected
  before the payment middleware charges.

## Package notes

This uses the maintained scoped x402 packages (`@x402/core`, `@x402/evm`, `@x402/express`,
`@x402/fetch`, all on v2). The unscoped `x402` / `x402-fetch` / `x402-express` packages are
frozen at 1.2.0 and use a different, incompatible call shape — don't mix them in.
