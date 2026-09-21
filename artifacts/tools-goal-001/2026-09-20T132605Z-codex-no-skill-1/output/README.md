# Paid Wallet Summary API

Foundation for an agent-payable HTTP API. The server protects `GET /v1/wallet/:address/summary` with x402. A client calls it once, receives `402 Payment Required`, signs the payment authorization, retries automatically, and then gets the wallet activity summary.

## Stack

- Express for the HTTP server
- `@x402/express` for the payment gate
- `@x402/fetch` for the paying client retry flow
- `@x402/evm` with the exact EIP-3009 flow
- viem for Base RPC reads

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `PAY_TO_ADDRESS`: your merchant wallet. Payments settle here.
- `AGENT_PRIVATE_KEY`: the caller wallet that pays. It needs USDC on the configured network.
- `TARGET_WALLET`: wallet to summarize.
- `X402_NETWORK`: defaults to Base mainnet, `eip155:8453`. Use `eip155:84532` for Base Sepolia testing.
- `X402_PRICE`: defaults to `$0.03` per call.

## Run

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev:client
```

Or pass the target wallet directly:

```bash
npm run dev:client -- 0xTargetWallet
```

## Where Payment Settles

By default, payment settles as USDC on Base mainnet (`eip155:8453`) to `PAY_TO_ADDRESS`. The default facilitator is OpenX402:

```text
https://facilitator.openx402.ai
```

The facilitator verifies the signed x402 payment payload and submits settlement on-chain. It does not custody your funds; the authorization moves USDC from the agent wallet to your `PAY_TO_ADDRESS`.

For Base mainnet USDC, the canonical token is:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

## Endpoint

```http
GET /v1/wallet/:address/summary
```

The summary currently scans a recent Base block window for `Transfer` events involving the wallet, reports ETH balance, total native transaction count, and a short text summary. Increase or decrease `RECENT_BLOCK_LOOKBACK` depending on your RPC limits.

## Next Steps

- Replace the simple RPC scan with an indexer when you want deeper history.
- Add caching after successful settlement if repeated calls for the same wallet are common.
- Set `TRUSTED_PAY_TO_ADDRESS` in clients so agents only sign payments to your merchant wallet.
