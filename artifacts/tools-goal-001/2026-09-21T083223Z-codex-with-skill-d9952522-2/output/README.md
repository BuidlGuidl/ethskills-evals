# x402 Paid Wallet Summary API

This is a small TypeScript foundation for an agent-paid HTTP API. The server protects `GET /api/wallet/:address/summary` with x402. A client calls it normally; if the server returns `402 Payment Required`, `@x402/fetch` signs a payment with the client wallet and retries automatically.

## What Settles Where

Payments use the x402 `exact` EVM scheme. By default this repo targets Base Sepolia:

- `PAYMENT_NETWORK=eip155:84532` for Base Sepolia testing
- `PAYMENT_NETWORK=eip155:8453` for Base mainnet
- `PAY_TO_ADDRESS` is the wallet that receives the USDC payment
- `PAYMENT_PRICE=$0.02` charges two cents per successful call

Settlement is handled by the configured x402 facilitator. The default `FACILITATOR_URL=https://x402.org/facilitator` works for Base Sepolia demos. For production Base mainnet, set `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` to use Coinbase's hosted facilitator config, or point `FACILITATOR_URL` at another facilitator that supports `eip155:8453`. API consumers do not need accounts, API keys, or invoices with you; they only need a funded wallet.

## Run It

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```bash
PAY_TO_ADDRESS=0xYourReceivingWallet
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
CLIENT_PRIVATE_KEY=0xYourSpendingWalletPrivateKey
```

Start the server:

```bash
npm run server
```

Call the paid endpoint with the auto-paying client:

```bash
npm run client -- 0xWalletToSummarize
```

The endpoint returns a short JSON summary plus the most recent transactions found through Blockscout for the configured Base network.

## Useful Endpoints

```bash
curl http://localhost:3000/health
curl -i http://localhost:3000/api/wallet/0xWalletToSummarize/summary
```

The second request should return `402` without a payment header. The TypeScript client handles that challenge, pays, and retries.
