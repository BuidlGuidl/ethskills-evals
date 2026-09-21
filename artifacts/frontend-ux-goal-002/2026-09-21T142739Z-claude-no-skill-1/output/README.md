# USDC Pay

Small dApp to send [USDC](https://etherscan.io/token/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) on Ethereum mainnet.
The `/pay` page lets a user connect a wallet, see their USDC and ETH balances, and send USDC to an address or ENS name.

Stack: Next.js (App Router) · TypeScript · wagmi v2 · viem · RainbowKit · TanStack Query.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000/pay
```

| Variable | |
| --- | --- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Required. From https://cloud.reown.com |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | Mainnet RPC (Alchemy/Infura/…). Use a dedicated one in production — the public fallback is rate-limited. |

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Behavior notes

- Mainnet only. Wallets on another network get a "Switch to Ethereum mainnet" button.
- USDC has **6 decimals**. Amounts are parsed as exact decimal strings (no floats); more than 6 decimals is rejected, not rounded.
- Recipient: checksummed or lowercase `0x` address, or ENS name. Bad EIP-55 checksums, the zero address, the USDC contract itself, and the sender's own address are rejected. Contract recipients get a warning.
- Before sending, the transfer is simulated (`eth_call`) so USDC-specific failures — blacklisted address, paused contract, insufficient balance — show up before the wallet prompt. The network fee (gas × max fee) is estimated and checked against the ETH balance.
- After sending, the page waits for the receipt, checks `status` (reverted txs are reported as failed), detects cancelled/replaced txs, links to Etherscan, and refreshes balances.
