# USDC Pay

Send mainnet USDC ([`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`](https://etherscan.io/token/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)) to any address or ENS name. Page: `/pay`.

Stack: Next.js 16 (App Router) · wagmi 2 · viem · RainbowKit · TanStack Query · Tailwind 4.

## Setup

```sh
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000/pay
```

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | Dedicated mainnet RPC. Without it the app falls back to a rate-limited public RPC. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect / Reown project id (mobile + QR wallets). |
| `NEXT_PUBLIC_SITE_URL` | Public origin, used for absolute OG/Twitter image URLs. |

## Behaviour

- Ethereum mainnet only; wrong network shows a single "Switch to Ethereum" action.
- Balances: USDC + ETH with USD values from Chainlink feeds (ETH/USD, USDC/USD); stale feeds are hidden, not shown.
- Recipient: 0x address (EIP-55 checksum enforced for mixed case) or ENS name; blocks zero address, the USDC contract and your own address; warns if the recipient is a contract.
- Amount: 6 decimals max, Max button, balance check, USD preview.
- Before signing: `transfer` is simulated (surfaces USDC blacklist / pause reverts) and gas is estimated against your ETH balance.
- Send button stays locked from click until the receipt is mined and balances are refreshed; rejection/errors are mapped to readable messages.

## Notes

- `@x402/*` deps are optional peers of `@coinbase/cdp-sdk` (pulled in by wagmi's Base Account connector); they're installed only so the bundler can resolve them.
