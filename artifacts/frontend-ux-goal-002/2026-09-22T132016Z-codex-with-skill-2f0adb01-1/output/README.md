# USDC Pay

A focused Ethereum mainnet dApp for sending real USDC (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`).

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_MAINNET_RPC_URL` to a dedicated Ethereum mainnet RPC endpoint before production use. The app keeps public fallback RPCs configured for development resilience, but production should not rely on them as the primary transport.

## Checks

```bash
npm run lint
npm run build
```
