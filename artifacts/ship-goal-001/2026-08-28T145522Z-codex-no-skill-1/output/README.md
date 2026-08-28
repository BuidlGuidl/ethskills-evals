# Toolshed

Toolshed is an onchain lending library for a small neighborhood association. Members list tools, borrowers escrow a USDC deposit, and owners settle the loan when the physical tool comes back. Late fees are paid from escrow and the remainder is returned automatically.

This repository contains a Next.js member app in `web/` and a small Foundry project in `contracts/`. It is intentionally serverless: the contract is the source of truth, wallet addresses are member identities, and tool photos are stored as HTTP or IPFS URLs.

## Architecture

The `Toolshed` contract stores listings, active loans, and borrower reputation. USDC remains in the contract only while a loan is active. Starting a loan requires an ERC-20 approval followed by `borrow`; the owner calls `confirmReturn` after the physical handoff back. The contract rounds any partial late day up, caps the total fee at the deposit, pays the owner, refunds the borrower, then updates completed/late counts. A borrower can cancel during the first hour if pickup does not happen.

The Next.js app reads listings and reputation with batched RPC calls. The browse grid ranks tool owners by `(completed loans - late returns) / completed loans`, then completed-loan count, while new members remain neutral. This is a deliberately transparent v1 ranking—not an identity or credit score. Writes go directly from the connected injected wallet to the contract.

Important v1 trust assumptions:

- Neighborhood membership and owner/borrower messaging happen offchain. Before a public deployment, add an association-managed allowlist or attestations.
- The owner is trusted to acknowledge a physical return. A production version should add borrower-initiated return claims and an association dispute resolver/time-out.
- Photo URLs are public strings. Use IPFS or another durable image host; do not put private information in listing text.
- The contract is not audited. Use a testnet until it has independent review and operational monitoring.

## Local setup

Requirements: Node.js 20+, npm 10+, [Foundry](https://book.getfoundry.sh/getting-started/installation), and a browser wallet.

1. Install JavaScript dependencies:

   ```bash
   npm install
   ```

2. Start a local chain in another terminal:

   ```bash
   anvil
   ```

3. Copy `.env.example` to `.env`, set `PRIVATE_KEY` to one of the test keys printed by Anvil, then deploy. With `USDC_ADDRESS` unset, the script deploys `MockUSDC` and Toolshed:

   ```bash
   npm run contracts:deploy:local
   ```

   The two deployed addresses are in the command output and `contracts/broadcast/` (generated and ignored). Mint test USDC with Cast:

   ```bash
   cast send <MOCK_USDC_ADDRESS> "mint(address,uint256)" <MEMBER_ADDRESS> 1000000000 --private-key <ANVIL_PRIVATE_KEY> --rpc-url http://127.0.0.1:8545
   ```

   USDC has 6 decimals, so `1000000000` is 1,000 USDC.

4. Create `web/.env.local`:

   ```dotenv
   NEXT_PUBLIC_CHAIN_ID=31337
   NEXT_PUBLIC_TOOLShed_ADDRESS=0x...
   NEXT_PUBLIC_USDC_ADDRESS=0x...
   ```

5. Add the Anvil network (`http://127.0.0.1:8545`, chain ID `31337`) and a funded Anvil account to the wallet, then run:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`. Use different Anvil accounts for owner and borrower: owners cannot borrow their own tools.

## Tests and build

```bash
npm test                 # Solidity settlement and authorization tests
npm run contracts:build  # Compile contracts
npm run build            # Production web build
```

The contract tests cover on-time returns, rounded-up late fees, deposit caps, reputation, and self-borrow prevention.

## Testnet deployment

Sepolia USDC is not canonical in the way mainnet USDC is; choose and document a specific token contract for your pilot. Fund the deployer with Sepolia ETH, then put these values in the root `.env` and export them in your shell (Foundry does not automatically load `.env` in every environment):

```dotenv
PRIVATE_KEY=                 # deployment key; never commit it
SEPOLIA_RPC_URL=https://...
ETHERSCAN_API_KEY=...
USDC_ADDRESS=0x...           # chosen 6-decimal test token
```

Deploy with:

```bash
set -a; source .env; set +a
npm run contracts:deploy:sepolia
```

Set the resulting Toolshed address, USDC address, and `NEXT_PUBLIC_CHAIN_ID=11155111` in the web host (Vercel or any Node-compatible host), run `npm run build`, and deploy the Next.js app. The default client transport uses the chain’s public RPC; for a 300-member pilot, configure a dedicated authenticated RPC before launch to avoid public endpoint throttling.

For mainnet or an L2, update `web/app/providers.tsx` with the target Wagmi chain, deploy against that chain’s official native USDC address, conduct an audit, and establish upgrade/migration and dispute procedures. The v1 contract is deliberately immutable and has no administrator withdrawal path, so escrow cannot be swept by an operator.

## Source map

- `contracts/src/Toolshed.sol` — listings, escrow, settlement, reputation
- `contracts/src/MockUSDC.sol` — local/test token only
- `contracts/test/Toolshed.t.sol` — contract behavior tests
- `contracts/script/Deploy.s.sol` — local/testnet deployment
- `web/app/page.tsx` — browse, list, and borrow UI
- `web/lib/contracts.ts` — typed contract addresses and ABI

