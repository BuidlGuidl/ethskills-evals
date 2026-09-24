# USDC Pay

Send mainnet USDC (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, 6 decimals) to any address or ENS name. Page: `/pay`.

Stack: Next.js (App Router) · wagmi 2 · viem · RainbowKit · TanStack Query · Tailwind 4.

## Setup

```sh
cp .env.example .env.local   # fill in RPC URL, WalletConnect project id, site URL
npm install
npm run dev                  # http://localhost:3000/pay
```

Production builds fail fast if `NEXT_PUBLIC_MAINNET_RPC_URL` or `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is missing.

```sh
npm test          # unit tests (amount parsing, address parsing, formatting, error mapping)
npm run typecheck
npm run build
```

## Behavior

- One primary action at a time: Connect wallet → Switch to Ethereum → Send. Direct `transfer`, no approval needed.
- Balances: USDC and ETH (for gas), refreshed every new block, with USD values from Chainlink ETH/USD and USDC/USD feeds (stale feeds hide USD rather than show wrong numbers). Warns if USDC trades below $0.98.
- Recipient: 0x address (EIP-55 checksum enforced for mixed case, `ethereum:` URIs accepted) or ENS name resolved on mainnet. Shows ENS name, copy, Etherscan link. Blocks zero address, the USDC contract itself, your own address, and Circle-blacklisted addresses; warns on smart-contract recipients.
- Amount: max 6 decimals, Max button, live USD preview, balance check.
- Pre-flight: `paused()` / `isBlacklisted()` checks, `eth_call` simulation, gas estimate × max fee compared with ETH balance.
- Sending: button locked from click until receipt (“Confirm in your wallet…” → “Sending…”); handles rejection, reverts, speed-up/cancel replacements, timeouts; errors translated to plain language with Etherscan links.
- Light/dark follows system preference. OG/Twitter images generated and served as absolute URLs from `NEXT_PUBLIC_SITE_URL`.
