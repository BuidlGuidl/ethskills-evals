# USDC Pay

Minimal dApp to send USDC on Ethereum mainnet. Page: `/pay`.

Stack: Next.js (App Router) · wagmi v2 · viem · RainbowKit · TanStack Query · TypeScript.

## Setup

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000/pay
```

| Var | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | yes | from https://cloud.reown.com |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | recommended | Alchemy/Infura/etc. Falls back to public RPC (rate-limited). |

## Behaviour

- Mainnet only. USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, 6 decimals.
- Balances (USDC + ETH) always read from mainnet, refreshed every ~12s and after each transfer.
- Recipient: checksummed 0x address or ENS name. Blocks zero address, the USDC contract, own address. Warns if recipient is a contract.
- Amount: exact bigint math (no floats), max 6 decimals, must be ≤ balance. "Max" fills exact balance.
- Before enabling Send: simulates `transfer` on mainnet (catches blacklisted/paused/etc. reverts) and checks ETH covers the max network fee.
- Wrong network → "Switch to Ethereum". Waits for receipt, checks `status`, handles sped-up / cancelled txs, links to Etherscan.
