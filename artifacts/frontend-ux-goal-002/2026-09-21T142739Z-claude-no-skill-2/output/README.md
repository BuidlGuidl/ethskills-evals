# USDC Pay

Small dApp for sending USDC on Ethereum mainnet. Page: `/pay`.

Stack: Next.js (App Router) · wagmi v2 · viem · RainbowKit · TanStack Query · TypeScript.

## Setup

```sh
cp .env.example .env.local   # fill in both values
npm install
npm run dev                  # http://localhost:3000/pay
```

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect / Reown project id (mobile + WC wallets) |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | Mainnet RPC (Alchemy, Infura, …). Public RPCs rate-limit real traffic. |

Both are required; the app fails fast at startup if either is missing.

## Behavior

- Token: Circle USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, **6 decimals**. Amounts parsed with `parseUnits` (no float math), max 6 decimal places.
- Balances (USDC + ETH) always read from mainnet, polled every ~12s and refreshed after each transfer. Displayed values are truncated, never rounded up.
- Mainnet only. Wallet on another chain → "Switch to Ethereum" prompt; sending disabled.
- Recipient: checksummed `0x` address or ENS name. Rejects bad checksums, zero address, the USDC contract itself, and your own address. Warns if recipient is a smart contract.
- Before signing: `transfer` is simulated (surfaces USDC reverts such as blacklisted accounts or paused contract) and gas is estimated; sending blocked if ETH can't cover the max network fee.
- After signing: waits for receipt, links to Etherscan, distinguishes success / on-chain revert / unknown status (never says "failed" when it just lost track).

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm run typecheck`
