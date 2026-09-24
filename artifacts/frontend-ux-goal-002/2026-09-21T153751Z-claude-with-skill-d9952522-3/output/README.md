# USDC Pay

Send USDC on Ethereum mainnet to any address or ENS name. Page: `/pay` (`/` redirects there).

Stack: Next.js 16 (App Router) · wagmi 2 · viem · RainbowKit · TanStack Query.

## Setup

```sh
cp .env.example .env.local   # fill in RPC URL + WalletConnect project id
npm install
npm run dev                  # http://localhost:3000/pay
npm run build && npm start   # production
```

Both `NEXT_PUBLIC_MAINNET_RPC_URL` and `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` are required; the app refuses to start without them rather than fall back to a public RPC.

## What it does

- **Token**: USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, 6 decimals. All math in base units via `parseUnits`/`formatUnits`.
- **Chain**: Ethereum mainnet only. Wrong network → "Switch to Ethereum" replaces the send button.
- **Balances**: USDC and ETH (for gas), both with USD values, polled every ~block and refetched after each transfer.
- **Prices**: Chainlink ETH/USD and USDC/USD feeds read onchain. Stale (older than heartbeat + 10 min) or unavailable prices are labelled, never hidden.
- **Recipient**: 0x address (checksum-validated) or ENS name, resolved on mainnet. Resolved address is shown before sending and is what gets submitted. Every rejection says why.
- **Pre-flight checks**: USDC paused, sender/recipient blacklisted by Circle, sending to the token contract / zero address / yourself, insufficient USDC, not enough ETH for the estimated fee, and a full `eth_call` simulation of the transfer.
- **Sending**: button holds a pending state from click → wallet → receipt → balance refetch; released in `finally`. Replaced/cancelled txs are handled. Wallet and revert errors are translated to plain text next to the button.

## Notes

`package.json` pins `@coinbase/cdp-sdk` to 1.52.0 via `overrides`: newer versions (pulled in by wagmi's Base Account connector) import optional `@x402/*` packages that break the Next.js build.
