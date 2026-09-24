# Paid Wallet Activity API

Foundation for an HTTP API that charges agents inline with x402 before returning a short summary of a wallet's recent Base activity.

The paid route is:

```text
GET /v1/wallet-summary?wallet=0x...
```

Unpaid callers receive `402 Payment Required`. An x402-capable client signs a USDC payment authorization, retries the same HTTP request, and receives JSON after the facilitator verifies and settles the payment.

## Tooling

- `@x402/express` gates the Express route behind HTTP 402 payment requirements.
- `@x402/fetch` wraps the TypeScript client so it pays and retries automatically.
- `@x402/evm` uses the `exact` EVM scheme, which is USDC via EIP-3009 on Base.
- Blockscout provides recent transactions and ERC-20 transfers for the wallet summary.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```bash
PAY_TO=0xYourReceivingWallet
X402_PRICE=$0.02
X402_NETWORK=eip155:84532
BLOCKSCOUT_API_BASE=https://base-sepolia.blockscout.com/api/v2
```

Base Sepolia is the default so you can test with faucet USDC. For production on Base mainnet:

```bash
X402_NETWORK=eip155:8453
BLOCKSCOUT_API_BASE=https://base.blockscout.com/api/v2
```

## Run the Server

```bash
npm run server
```

Health/config:

```bash
curl http://localhost:3000/
```

Payment challenge:

```bash
curl -i "http://localhost:3000/v1/wallet-summary?wallet=0x0000000000000000000000000000000000000000"
```

## Run the Paying Client

Fund the agent wallet with USDC on the same network as `X402_NETWORK`, then set:

```bash
AGENT_PRIVATE_KEY=0xYourAgentPrivateKey
API_URL=http://localhost:3000/v1/wallet-summary
WALLET_ADDRESS=0xWalletToSummarize
MAX_PAYMENT_USD=$0.10
TRUSTED_PAY_TO=0xYourReceivingWallet
```

Then call:

```bash
npm run client
```

The client makes the request once, receives the 402 challenge, signs payment, retries automatically, and prints the JSON response.

## Where Payment Settles

Payments settle as USDC on the configured x402 network to `PAY_TO`.

- Test default: Base Sepolia, CAIP-2 `eip155:84532`.
- Production option: Base mainnet, CAIP-2 `eip155:8453`.
- Asset: native USDC on that Base network.
- Facilitator: `X402_FACILITATOR_URL`, default `https://x402.org/facilitator`.

The receiving wallet does not need an account in this app. It is simply the `payTo` address embedded in the 402 payment requirements.

## Files

- `src/server.ts` - Express server and x402 middleware.
- `src/client.ts` - TypeScript client that pays and retries automatically.
- `src/activity.ts` - Blockscout-backed wallet activity summarizer.
- `src/config.ts` - Environment parsing and defaults.
