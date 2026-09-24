# USDC Pay

A focused Ethereum mainnet dApp for sending real USDC from a connected wallet.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure a dedicated Ethereum mainnet RPC:

```bash
cp .env.example .env.local
```

Then replace `VITE_MAINNET_RPC_URL` with your provider URL.

3. Start the app:

```bash
npm run dev
```

Open `/pay`.

## Production Checks

- Target chain: Ethereum mainnet.
- USDC contract: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`.
- USDC decimals: `6`.
- Recipient input accepts Ethereum addresses and ENS names resolved on mainnet.
- The send button stays pending through wallet signing, receipt confirmation, and balance refresh.
- Fiat context is loaded from CoinGecko and is labeled when stale or unavailable.
