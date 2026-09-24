# Paid Wallet Activity API

An x402-gated Express API that charges an inline HTTP payment before returning a short Blockscout-backed summary of a wallet's recent activity. There are no accounts or API keys for callers: an agent hits the endpoint, receives `402 Payment Required`, signs the x402 payment, retries automatically, and gets JSON back.

## What It Uses

- `@x402/express`, `@x402/core`, `@x402/evm`, and `@x402/fetch` v2 for inline HTTP payments.
- Coinbase's hosted x402 facilitator through `@coinbase/x402` for payment verification and settlement.
- Blockscout API v2 for Base/Base Sepolia wallet transactions and token transfers.
- Express + TypeScript + `tsx`.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```bash
PAY_TO_ADDRESS=0xYourReceivingWallet
CLIENT_PRIVATE_KEY=0xYourAgentWalletPrivateKey
CDP_API_KEY_ID=your-cdp-key-id
CDP_API_KEY_SECRET=your-cdp-key-secret
```

The default network is Base Sepolia:

```bash
X402_NETWORK=eip155:84532
PRICE_USD=$0.02
```

Run the server:

```bash
npm run server
```

Call the paid endpoint with the TypeScript client:

```bash
npm run client -- 0xWalletToSummarize
```

The client uses `@x402/fetch` to make the first request, pay after the `402`, retry, and print the JSON result. It also prints the decoded `PAYMENT-RESPONSE` settlement header to stderr when present.

## Endpoints

- `GET /health` is free and shows the configured price, network, and receiver.
- `GET /v1/wallets/:address/activity-summary` costs `PRICE_USD` and returns a short summary plus recent transactions/token transfers.

## Where Payment Settles

By default this settles USDC on Base Sepolia to `PAY_TO_ADDRESS`.

- Base Sepolia network: `eip155:84532`
- Base Sepolia USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Production Base network: `eip155:8453`
- Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

To move to Base mainnet, set:

```bash
X402_NETWORK=eip155:8453
```

Then fund the client wallet with Base USDC and point `PAY_TO_ADDRESS` at the wallet that should receive settled payments.

## Notes

- The default Coinbase facilitator requires `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` for supported-kind discovery, verify, and settle calls. Set `FACILITATOR_URL` only when you want to use a different facilitator.
- For local development, use Base Sepolia and test USDC before switching to Base mainnet.
- `MAX_AMOUNT_PER_PAYMENT` on the client defaults to `$0.10`; raise it only if your server price is higher.
