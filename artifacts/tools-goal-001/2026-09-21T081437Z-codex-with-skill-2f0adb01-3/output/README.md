# x402 Wallet Activity API

Paid, accountless HTTP API foundation for agents. The server gates a wallet activity summary endpoint behind an inline x402 payment, and the TypeScript client automatically handles the `402 -> pay -> retry -> 200` flow.

## What It Does

- `GET /v1/wallets/:address/activity-summary` costs `X402_PRICE` per call.
- Payment is settled in USDC through the x402 `exact` EVM scheme.
- The default network is Base Sepolia, `eip155:84532`, so you can test safely.
- To settle on Base mainnet, set `X402_NETWORK=eip155:8453`.
- The server never receives a private key. It only advertises `PAY_TO_ADDRESS`, verifies payment with the facilitator, then serves the response.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```bash
PAY_TO_ADDRESS=0xYourReceivingWallet
AGENT_PRIVATE_KEY=0xYourAgentWalletPrivateKey
WALLET_ADDRESS=0xWalletToSummarize
```

For local testing, fund the agent wallet with USDC on Base Sepolia. For production, switch to Base mainnet:

```bash
X402_NETWORK=eip155:8453
```

## Run

Start the paid API:

```bash
npm run dev:server
```

In another terminal, call it with the paying client:

```bash
npm run client -- 0xWalletToSummarize
```

The client uses `@x402/fetch` to retry automatically with an `X-PAYMENT` header after the server returns `402 Payment Required`.

## Configuration

Server:

- `PAY_TO_ADDRESS`: receiving wallet. USDC settles here.
- `X402_PRICE`: default `$0.03`.
- `X402_NETWORK`: default `eip155:84532` for Base Sepolia. Use `eip155:8453` for Base mainnet.
- `X402_FACILITATOR_URL`: default `https://x402.org/facilitator`.
- `BLOCKSCOUT_BASE_URL`: default `https://base.blockscout.com/api/v2`.
- `BLOCKSCOUT_API_KEY`: optional. If you use Blockscout Pro, set `BLOCKSCOUT_BASE_URL=https://api.blockscout.com/8453/api/v2` and provide this key.

Client:

- `AGENT_PRIVATE_KEY`: payer wallet private key.
- `API_BASE_URL`: default `http://localhost:3000`.
- `X402_MAX_PAYMENT`: client-side spend cap, default `$0.10`.

## Where Payment Settles

Settlement goes to `PAY_TO_ADDRESS` as USDC on the configured x402 EVM network:

- Base Sepolia testing: `eip155:84532`
- Base mainnet production: `eip155:8453`

After a successful paid response, the server includes a `PAYMENT-RESPONSE` header. The client decodes and prints it, including the settlement transaction details returned by the facilitator.

## Useful References

- x402 Foundation packages: `@x402/express`, `@x402/fetch`, `@x402/evm`
- x402 protocol docs: https://github.com/x402-foundation/x402
- Blockscout Base API docs: https://base.blockscout.com/api-docs
