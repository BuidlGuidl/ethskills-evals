# USDC Pay

A small Ethereum mainnet dApp for sending real USDC from a connected wallet.

## Stack

- Vite, React, and TypeScript for the frontend
- Viem for Ethereum reads, ENS resolution, wallet writes, and unit conversion
- Ethereum mainnet only
- Official USDC contract: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- USDC uses 6 decimals

## Local Setup

```bash
npm install
npm run dev
```

Open `/pay`.

For production, set a dedicated Ethereum mainnet RPC provider:

```bash
VITE_MAINNET_RPC_URL=https://your-dedicated-mainnet-rpc.example
```

The app has an intentional public fallback transport for local evaluation, but production should use a dedicated RPC URL to avoid rate limits.
