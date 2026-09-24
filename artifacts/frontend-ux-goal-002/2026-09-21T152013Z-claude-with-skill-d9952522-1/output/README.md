# Settle — send USDC on Ethereum

Small dApp with a `/pay` page: connect a wallet, enter a recipient (0x address or ENS name) and an amount, send USDC.
Shows your USDC balance and ETH balance (for gas), each with a USD value.

- Chain: **Ethereum mainnet only**
- Token: Circle USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` (6 decimals)
- Stack: Next.js (App Router) · wagmi v2 · viem · RainbowKit · TanStack Query · Tailwind CSS v4

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000/pay
```

| Var | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | prod | Dedicated mainnet RPC. Production build fails without it; dev falls back to public RPC with a warning. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | prod | From https://cloud.reown.com |
| `NEXT_PUBLIC_SITE_URL` | recommended | Public origin for OG/Twitter image URLs |

## Behavior notes

- **Recipient**: accepts checksummed/lowercase addresses and ENS names (resolved onchain, resolved address shown before send and used for the transfer). Rejects bad checksums, zero address, and the USDC contract itself, with a reason. Warns on own address and contract recipients.
- **Amount**: parsed with `parseUnits(…, 6)`; max 6 decimals; checked against balance; "Max" fills the exact balance.
- **Gas**: estimates the network fee and blocks sending when ETH is insufficient.
- **Prices**: Chainlink ETH/USD and USDC/USD feeds read onchain; stale prices are labeled, missing prices say "unavailable".
- **Sending**: simulate → wallet → receipt (handles speed-up/cancel replacement) → balance refetch; button stays busy throughout and always releases. Wallet rejections and USDC reverts (blacklist, paused, balance) are shown in plain words.
- **Theme**: follows system light/dark.

## Dependency note

`@x402/*` are installed only because `@coinbase/cdp-sdk` (pulled in by RainbowKit's Base Account connector) imports them statically during SSR; the app never uses them. Drop them if a future RainbowKit/Base Account release stops requiring them.
