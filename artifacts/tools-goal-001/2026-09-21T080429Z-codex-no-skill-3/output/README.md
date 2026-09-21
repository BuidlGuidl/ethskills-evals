# Paid Wallet Activity API

Foundation for an x402-paid API endpoint. An agent calls your HTTP endpoint, receives `402 Payment Required`, signs an inline USDC payment authorization, retries automatically, and gets a short Base wallet activity summary. No accounts, API keys, or invoices.

## What is included

- Express server with one paid endpoint: `GET /v1/wallet/:address/summary?limit=10`
- x402 v2 payment middleware using the `exact` EVM scheme
- TypeScript client that pays and retries with `@x402/fetch`
- Blockscout-backed Base wallet activity summarizer

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```bash
PAY_TO_ADDRESS=0xYourReceivingWalletAddress
PRICE_PER_CALL=$0.01
PAYMENT_NETWORK=eip155:84532
FACILITATOR_URL=https://facilitator.openx402.ai
```

`eip155:84532` is Base Sepolia and is the safest default while developing. For real USDC settlement on Base mainnet, change:

```bash
PAYMENT_NETWORK=eip155:8453
```

The agent wallet used by the client needs USDC on the selected network. Set:

```bash
AGENT_PRIVATE_KEY=0xYourAgentWalletPrivateKey
MAX_PAYMENT_PER_CALL=$0.05
```

## Run the server

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Unpaid call, which should return `402` plus a `PAYMENT-REQUIRED` header:

```bash
curl -i "http://localhost:3000/v1/wallet/0x0000000000000000000000000000000000000000/summary"
```

## Run the paying client

In another terminal:

```bash
npm run client -- 0x0000000000000000000000000000000000000000 10
```

The client wraps `fetch`, handles the first `402`, signs the x402 payment, retries the original request with `PAYMENT-SIGNATURE`, and prints the API response. If the facilitator settles successfully, the response includes a `PAYMENT-RESPONSE` header, which the client decodes to stderr.

## Where payment settles

Payments settle as USDC directly from the agent wallet to `PAY_TO_ADDRESS`.

- Base Sepolia: `PAYMENT_NETWORK=eip155:84532`, USDC asset `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Base mainnet: `PAYMENT_NETWORK=eip155:8453`, USDC asset `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

The server does not hold private keys or submit transactions. It sends the signed payment payload to `FACILITATOR_URL` for verification and settlement after the protected handler succeeds.

## Useful scripts

```bash
npm run typecheck
npm run dev
npm run client -- 0xWalletAddress
```

## Next steps

- Put this behind HTTPS; Express proxy trust is enabled so x402 can build the public resource URL from forwarded headers.
- Use Base Sepolia first, then switch `PAYMENT_NETWORK` to `eip155:8453` for real settlement.
- Add rate limits and logging around the paid route.
- Replace the Blockscout data source with your preferred indexer if you need richer summaries or stricter SLAs.
