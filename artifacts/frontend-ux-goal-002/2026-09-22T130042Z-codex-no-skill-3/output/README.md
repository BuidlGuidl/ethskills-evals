# USDC Pay

A focused Ethereum mainnet dApp for sending real USDC from a connected wallet.

## Stack

- Vite, React, TypeScript
- viem for typed Ethereum RPC, balances, and contract interactions
- Injected wallet discovery for MetaMask, Coinbase Wallet, and other EIP-1193 browser wallets

## Run

```bash
npm install
npm run dev
```

Open `/pay`.

## Configuration

The app is mainnet-only and uses the canonical USDC token contract:

```text
0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

Optional environment variables:

```bash
VITE_ETHEREUM_RPC_URL=https://...
```

Without `VITE_ETHEREUM_RPC_URL`, viem uses its default public Ethereum RPC transport.
