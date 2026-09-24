# Paid Wallet Summary API

Foundation for an x402-paid HTTP API. The server gates `GET /v1/wallet/:address/summary` behind an inline payment, then returns a short summary of that wallet's recent Base activity using Blockscout.

## What It Uses

- `@x402/express` on the server to return `402 Payment Required`, verify payment, and settle after the handler succeeds.
- `@x402/fetch` on the client to make the request, pay the x402 challenge, and retry automatically.
- OpenX402's hosted x402 facilitator by default. Override `FACILITATOR_URL` to use another facilitator.
- Base mainnet by default: `NETWORK=eip155:8453`.
- Blockscout's Base API for indexed wallet transactions.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `PAY_TO_ADDRESS`: your merchant wallet. Settled funds arrive here.
- `PRICE`: per-call price, for example `$0.02`.
- `FACILITATOR_URL`: defaults to `https://facilitator.openx402.ai`, which supports Base and Base Sepolia x402 exact payments.
- `EVM_PRIVATE_KEY`: client payer key. It must hold the default x402 payment token for the configured network.

## Run

Start the server:

```bash
npm run dev
```

Call the paid endpoint from the TypeScript client:

```bash
npm run client -- 0x4200000000000000000000000000000000000006 8
```

The client first receives the server's `402` challenge, signs the x402 payment payload, retries the request with the payment header, then prints the JSON summary. If settlement succeeds, it also prints the settlement transaction hash from the `PAYMENT-RESPONSE` header.

## Where Payment Settles

By default this settles on Base mainnet (`eip155:8453`) to `PAY_TO_ADDRESS`, using the x402 EVM exact scheme's default USD asset for that network. The server never creates accounts or API keys for callers; possession of a funded wallet is the client's credential.

For testnet, change:

```env
NETWORK=eip155:84532
BLOCKSCOUT_BASE_URL=https://base-sepolia.blockscout.com
RPC_URL=https://sepolia.base.org
```

Use a payer wallet funded with the corresponding x402 default payment token on that network, and set `PAY_TO_ADDRESS` to the recipient you control.

## Free Health Check

```bash
curl http://localhost:3000/health
```

The paid route remains:

```text
GET /v1/wallet/:address/summary?limit=8
```
