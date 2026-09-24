# Payline

Send USDC on Ethereum mainnet to any address or ENS name. Page: `/pay` (`/` redirects there).

Stack: Next.js 16 (App Router) · wagmi 2 · viem 2 · RainbowKit 2 · TanStack Query · Tailwind 4.

## Setup

```sh
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000/pay
npm run build                # production build (fails if required env is missing)
```

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | prod | Dedicated mainnet RPC. Public fallback allowed in dev only. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | yes | From https://cloud.reown.com |
| `NEXT_PUBLIC_SITE_URL` | recommended | Absolute URL for OG/Twitter images. |

## Behavior

- **Token**: Circle USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, 6 decimals. All math via `parseUnits`/`formatUnits`.
- **Balances**: USDC + ETH (for gas), always read from mainnet, even if the wallet is on another network.
- **USD values**: Chainlink ETH/USD and USDC/USD feeds read onchain; flagged "stale" past heartbeat, "unavailable" on failure.
- **Recipient**: 0x address (checksum-validated) or ENS name, resolved onchain and shown before sending. Rejects zero address, the USDC contract, your own address, and Circle-blocklisted addresses, with a reason. Warns if the recipient is a contract.
- **Amount**: max 6 decimals, ≤ balance, "Max" button.
- **Gas**: fee estimated before sending; blocks with an explanation if ETH is short.
- **Flow**: connect → switch to Ethereum → send. Button stays pending from wallet prompt through receipt and balance refresh. Wallet/revert errors shown as plain text under the button. Handles sped-up/cancelled txs.
- **Theme**: follows system light/dark.
