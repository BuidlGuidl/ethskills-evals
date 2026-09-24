# Toolshed

Toolshed is a first-version lending library for a neighborhood association. Members list tools with a photo and condition notes, borrowers request tools for a few days, owners approve reliable borrowers first, and USDC deposits are escrowed until the tool comes back.

## Architecture

The app is split into a small offchain service, a React operations UI, and one Solidity escrow contract.

- `server/src/` exposes an Express JSON API for members, tool listings, requests, active loans, and returned loan history. It persists to `data/toolshed.local.json` by default and seeds from `data/seed.json`.
- `app/src/` is a Vite React app for browsing tools, uploading listing photos, registering members, approving requests, opening USDC-backed escrow loans, and marking returns.
- `contracts/ToolshedEscrow.sol` holds only the borrower deposit and the settlement facts needed to distribute funds.
- Reputation is derived offchain from loan records and contract events: completed loans, late returns, active loans, and a simple score. The browse/request queue sorts with this derived score instead of storing rankings onchain.

Onchain data is intentionally minimal: borrower, owner, tool id hash, due date, deposit, daily late fee, return timestamp, and status. Profiles, photos, descriptions, search, condition notes, and ranking rules stay offchain because they change often and do not need trustless storage.

## Contract Surface

There is one custom contract:

- `ToolshedEscrow`: receives native Circle USDC from the borrower, stores loan terms, and settles the deposit between borrower and owner.

The contract uses USDC as a 6-decimal ERC-20. For the first deploy target, use Base Sepolia native Circle USDC:

```text
0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

That address is from Circle's published USDC address list.

## State Transitions

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `openLoan(toolId, toolOwner, dueAt, deposit, dailyLateFee)` | Borrower | Locks their deposit so the owner can lend the tool | No escrow opens; the request remains offchain |
| `settleReturn(loanId)` | Tool owner | Receives any late fee and releases the remaining deposit | Funds remain escrowed until owner or association settles |
| `associationSettle(loanId, returnedAt)` | Association owner multisig | Resolves an owner/borrower dispute or unresponsive owner | Funds remain escrowed; participants can keep escalating offchain |
| `escalate(loanId)` | Borrower or owner | Emits a dispute/escalation event for the association | No onchain change; loan remains active |

Late days are rounded up by partial days after `dueAt`. Owner late fees are capped at the deposit, so settlement can never require extra funds from the borrower.

## Target Chain

The first release targets **Base Sepolia** (`84532`). It is a low-cost EVM testnet with native Circle test USDC, which lets the association test the deposit and late-fee flow without real funds before choosing a production chain.

For a real launch, deploy to Base mainnet only after reviewing the contract and replacing the testnet address with Base native USDC:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

Do not use bridged USDC variants.

## Local Development

Install dependencies:

```bash
npm install
```

Create local environment values:

```bash
cp .env.example .env
```

Run the API and UI together:

```bash
npm run dev
```

The API runs on `http://localhost:4317` and the app runs on the Vite port printed in the terminal, normally `http://localhost:5173`.

Useful checks:

```bash
npm test
npm run build
```

If your npm cache is read-only in a sandboxed environment, use:

```bash
npm install --cache /tmp/npm-cache-toolshed
```

## Environment Variables

Frontend/API:

- `PORT`: API port, default `4317`.
- `TOOLSHED_DATA_PATH`: optional path for the API JSON store.
- `VITE_API_URL`: API origin for the frontend, default same-origin/proxy in dev.
- `VITE_TOOLSHED_ESCROW_ADDRESS`: deployed `ToolshedEscrow` address.
- `VITE_USDC_ADDRESS`: USDC token address.
- `VITE_EXPECTED_CHAIN_ID`: wallet chain guard, `84532` for Base Sepolia.

Deployment:

- `BASE_SEPOLIA_RPC_URL`: Base Sepolia RPC URL.
- `DEPLOYER_PRIVATE_KEY`: deployer wallet private key. Do not commit it.
- `USDC_ADDRESS`: native Circle USDC token address.
- `ASSOCIATION_MULTISIG`: contract owner for dispute settlement. For production, use the association multisig, not an individual wallet.
- `BASESCAN_API_KEY`: optional, used for verification.

## Deploy To Base Sepolia

Set environment values:

```bash
export BASE_SEPOLIA_RPC_URL="https://..."
export DEPLOYER_PRIVATE_KEY="0x..."
export USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
export ASSOCIATION_MULTISIG="0xYourAssociationMultisig"
export BASESCAN_API_KEY="..."
```

Compile and deploy:

```bash
npm run compile
npm run deploy:base-sepolia
```

If automatic verification is skipped, verify manually:

```bash
npx hardhat verify \
  --network baseSepolia \
  <TOOLSHED_ESCROW_ADDRESS> \
  0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  <ASSOCIATION_MULTISIG>
```

Then set the frontend env:

```bash
export VITE_TOOLSHED_ESCROW_ADDRESS="<TOOLSHED_ESCROW_ADDRESS>"
export VITE_USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
export VITE_EXPECTED_CHAIN_ID="84532"
```

## Post-Deploy Smoke Test

Get Base Sepolia ETH for gas and Base Sepolia USDC from Circle's testnet faucet.

Open a tiny loan. The deployer wallet acts as the borrower and must already hold test USDC:

```bash
export TOOLSHED_ESCROW_ADDRESS="<TOOLSHED_ESCROW_ADDRESS>"
export SMOKE_TOOL_OWNER="0xDifferentWalletAddress"
export SMOKE_DEPOSIT_USDC="1"
export SMOKE_DAILY_LATE_FEE_USDC="0.10"
npm run smoke:open-loan
```

The script prints a `Loan id`. If the deployer is also the association owner for this test deployment, settle it through the association path:

```bash
export SMOKE_LOAN_ID="<LOAN_ID>"
npm run smoke:settle-loan
```

For a production-style deployment where `ASSOCIATION_MULTISIG` is a multisig, submit the same `associationSettle(loanId, returnedAt)` call from that multisig after confirming the tool return.

## Developer Notes

- The local API has no wallet-signature authentication yet. Treat it as an MVP service boundary; production should require signed requests and replace the JSON store with Postgres or another durable store.
- Photos are stored as data URLs in the JSON store for a simple first version. Move them to object storage before inviting all 300 members.
- The UI disables escrow actions unless the connected wallet is on `VITE_EXPECTED_CHAIN_ID`.
- Contract events are enough to rebuild escrow loan history; the API stores matching records for fast UI sorting.

## Source Reference

- Circle native USDC addresses: https://developers.circle.com/stablecoins/usdc-contract-addresses
