# Paid Wallet Activity API

Foundation for an x402-paid API endpoint that returns a short Base wallet activity summary. Callers do not need accounts, API keys, or invoices: the first HTTP request receives `402 Payment Required`, the x402 client signs/pays, and the request is retried automatically.

## What It Builds

- `GET /v1/wallet/summary?address=0x...` is gated by x402 payment middleware.
- Payments use the `exact` scheme on Base by default: `eip155:8453`.
- The server summarizes recent Base activity from Blockscout.
- `src/client.ts` is a TypeScript buyer/client that pays and retries with `wrapFetchWithPayment`.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `PAY_TO_ADDRESS`: your Base wallet that receives the API revenue.
- `PRICE_USD`: per-call price, for example `$0.02`.
- `EVM_PRIVATE_KEY`: buyer wallet private key for the sample client.
- `WALLET_TO_SUMMARIZE`: wallet the client asks the API to summarize.

## Run

```bash
npm run dev
```

In another terminal:

```bash
npm run client
```

An unpaid probe should return payment instructions:

```bash
curl -i "http://localhost:4021/v1/wallet/summary?address=0x4200000000000000000000000000000000000006"
```

## Settlement

By default, payments settle as USDC on Base mainnet to `PAY_TO_ADDRESS`. The default x402 EVM asset for `eip155:8453` is Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

For mainnet, this project defaults to the production facilitator URL from the x402 docs:

```text
https://api.cdp.coinbase.com/platform/v2/x402
```

For testnet development, switch:

```text
X402_NETWORK=eip155:84532
FACILITATOR_URL=https://x402.org/facilitator
BASE_RPC_URL=https://sepolia.base.org
```

and use Base Sepolia USDC/test funds for the buyer wallet.

## Next Steps

- Put the server behind HTTPS before accepting real agent traffic.
- Add request logging around payment settlement headers.
- Replace the deterministic summary with your own enrichment or LLM summary if needed.
- Consider x402 `upto` or batch settlement if you later charge variable amounts per request.
