# Paid Wallet Activity API

Foundation for an accountless paid API that uses x402 HTTP payments. A caller requests
`GET /api/wallet-summary?address=0x...`; if no payment is attached, the server returns
HTTP `402 Payment Required`. The TypeScript client signs the payment, retries the same
request automatically, and prints the wallet activity summary.

## Stack

- Server: Express + `@x402/express`
- Client: `@x402/fetch` + `@x402/evm`
- Settlement: x402 exact payments on Base by default, paid to your `PAY_TO` wallet
- Activity data: Base Blockscout public API

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```bash
PAY_TO=0xYourSellerWalletAddress
PAYMENT_PRICE=$0.03
X402_NETWORK=eip155:8453
FACILITATOR_URL=https://facilitator.openx402.ai
```

For the client, set:

```bash
AGENT_PRIVATE_KEY=0xYourAgentPrivateKey
API_URL=http://localhost:3000/api/wallet-summary
MAX_USD_PER_CALL=0.05
```

The agent wallet needs USDC on Base. The default `PAYMENT_PRICE=$0.03` is converted by
the x402 EVM scheme into the default Base payment asset amount.

## Run

Start the paid API:

```bash
npm run dev:server
```

Call the endpoint with the paying client:

```bash
npm run client -- 0xWalletToSummarize
```

You can also see the raw unpaid challenge:

```bash
curl -i "http://localhost:3000/api/wallet-summary?address=0xWalletToSummarize"
```

## Where Payment Settles

By default, payments settle on Base mainnet (`eip155:8453`) to the seller address in
`PAY_TO`. The server itself does not hold a private key. It advertises payment terms,
asks the x402 facilitator to verify and settle, then returns the protected JSON only
after a valid paid request.

For testnet experiments, switch `X402_NETWORK` to a facilitator-supported test network
such as Base Sepolia (`eip155:84532`) and fund the client wallet with the matching test
asset.

Facilitator support is deployment-specific. Check `GET $FACILITATOR_URL/supported` before
changing `FACILITATOR_URL` or `X402_NETWORK`.

## API Response

`GET /api/wallet-summary?address=0x...` returns:

- `summary`: short natural-language summary
- `highlights`: counts, top decoded methods, ETH/token flow, latest transactions
- `source`: the Base Blockscout address URL used for the summary

Run a type check with:

```bash
npm run typecheck
```
