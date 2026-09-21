# USDC Pay

Send [USDC](https://etherscan.io/token/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) on Ethereum mainnet to any address or ENS name. The app lives at `/pay` (`/` redirects there).

Stack: Next.js (App Router) · wagmi v2 · viem · RainbowKit · TanStack Query.

## Setup

```sh
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000/pay
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | yes | Dedicated mainnet RPC. The public RPC is only a last-resort fallback. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | yes | Reown / WalletConnect project id. The build fails without it. |
| `NEXT_PUBLIC_SITE_URL` | prod | Public origin; makes Open Graph / Twitter image URLs absolute. |

## Behavior

- **One primary action at a time:** Connect wallet → Switch to Ethereum → Send. The send button explains what's missing (recipient, amount, balance, gas).
- **Balances:** USDC and ETH (for gas) read from mainnet every ~12s, with USD values from Chainlink (ETH/USD, USDC/USD). Stale feeds show `~$ —` instead of a wrong number. Warns on USDC depeg and zero ETH.
- **Recipient checks:** 0x addresses (checksum-validated) or ENS names (resolved and shown before sending). Blocks the zero address, the USDC contract itself, your own address, and addresses blacklisted by Circle. Warns when the recipient is a smart contract.
- **Amount:** decimals read from the USDC contract (6); rejects extra precision; Max fills the exact balance.
- **Preflight:** the transfer is simulated and gas-estimated on mainnet before the wallet opens; the max network fee is shown in ETH and USD and compared against the ETH balance. USDC paused / blacklist / balance reverts are translated to plain messages.
- **Sending:** the button locks from click until the transaction is mined ("Confirm in your wallet…" → "Sending…"). Wallet rejection, cancelled/replaced transactions and onchain reverts are reported inline; success links to Etherscan.

## Notes

- `package.json` overrides `@coinbase/cdp-sdk` to `1.52.0`: newer versions (pulled in by wagmi's Base Account connector) import optional `@x402/*` packages that break the Next.js build.
- Light/dark theme follows the system preference.
