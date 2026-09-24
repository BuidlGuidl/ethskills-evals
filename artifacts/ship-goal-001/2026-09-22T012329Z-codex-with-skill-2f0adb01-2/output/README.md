# Toolshed

Toolshed is a first-version lending library for a neighborhood association. Members can list tools, request to borrow tools for a few days, escrow a USDC deposit, and settle late fees automatically when the owner confirms return.

## What Is In This Version

- A Solidity escrow contract for member-gated tool lending.
- USDC deposit custody with exact borrower refunds and owner late-fee payouts.
- Daily late fees rounded up by partial late days and capped at the deposit.
- Borrower reputation counters: completed loans and late returns.
- A React/Vite frontend with a tool catalog, reliability-sorted request queue, member onboarding, and direct wallet actions.
- Foundry tests covering escrow math, authorization, membership gating, cancellation, returns, and fuzzed late-fee caps.

## Architecture

The split is deliberate:

- Onchain: member allowlist, tool listing commitments, loan request/approval state, USDC escrow, late-fee settlement, and reputation counters.
- Offchain/UI: photos, condition notes, search, filtering, richer profiles, and the request queue presentation.

The contract stores a `metadataURI` for each tool. For production, make that URI point to JSON on IPFS, Arweave, or an association-controlled object store:

```json
{
  "name": "Cordless hammer drill",
  "image": "ipfs://...",
  "condition": "Two batteries, bits included. Chuck has cosmetic wear."
}
```

The frontend currently includes sample catalog and request data in `src/sampleData.ts`. For a real deployment, index `ToolListed`, `LoanRequested`, `LoanApproved`, `ToolReturned`, and `MemberUpdated` events with a small backend, The Graph, or a database worker, then replace the sample data with indexed rows.

## Contract Flow

1. Association admin deploys `contracts/ToolshedEscrow.sol` and adds member wallets.
2. A member lists a tool with metadata, deposit amount, late fee per day, and max loan days.
3. Another member approves exact USDC and calls `requestLoan`.
4. The tool owner accepts one pending request with `approveLoan`.
5. When the physical tool comes back, the owner calls `confirmReturn`.
6. The contract pays the owner any late fee and returns the remainder of the deposit to the borrower.

Only members can list or request. Only the tool owner can approve a request or confirm return. Pending requests can be cancelled by the borrower or tool owner.

## Local Setup

Requirements:

- Node.js 20+
- npm
- Foundry (`forge`, `anvil`, `cast`)

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run typecheck
npm run build
npm run test:contracts
npm audit
```

Start the frontend:

```bash
npm run dev
```

## Running With A Local Chain

Start Anvil:

```bash
anvil
```

In another terminal, deploy mock USDC and the escrow:

```bash
npm run deploy:local
```

Copy the deployed `MockUSDC` and `ToolshedEscrow` addresses from the script output into `.env.local`:

```bash
VITE_CHAIN_ID=31337
VITE_CHAIN_NAME=Anvil
VITE_RPC_URL=http://127.0.0.1:8545
VITE_BLOCK_EXPLORER=
VITE_USDC_ADDRESS=0x...
VITE_ESCROW_ADDRESS=0x...
```

Then start the app:

```bash
npm run dev
```

For local testing with multiple wallets, use the admin wallet to add member addresses in the app's **Onchain Actions** tab before those wallets list or borrow.

## Testnet Deployment

This repo is set up for Base Sepolia by default because Toolshed is a consumer association app and benefits from low fees and common wallet support.

Create `.env` or export these variables:

```bash
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
USDC_ADDRESS=0x...          # USDC token for the target chain
ETHERSCAN_API_KEY=...
```

Deploy:

```bash
npm run deploy:base-sepolia
```

Then set frontend variables in `.env.local`:

```bash
VITE_CHAIN_ID=84532
VITE_CHAIN_NAME=Base Sepolia
VITE_RPC_URL=https://sepolia.base.org
VITE_BLOCK_EXPLORER=https://sepolia.basescan.org
VITE_USDC_ADDRESS=0x...
VITE_ESCROW_ADDRESS=0x...
```

Run `npm run build` and deploy the generated `dist/` folder to Vercel, Netlify, IPFS, or another static host.

## Production Notes

- Use the canonical native USDC address for the target chain and verify it from the issuer or chain documentation before deploying.
- Transfer contract ownership to the association multisig after deployment; the owner only manages membership.
- Store tool metadata offchain and keep only the URI onchain.
- Add an event indexer before launch so the catalog, pending request queue, and reputation sorting come from chain history instead of sample data.
- Consider adding a dispute workflow for damaged tools. This v1 assumes the owner truthfully confirms returns and lets the contract settle late fees only.
- Do not use infinite approvals in the UI; the current request path approves the exact deposit when allowance is insufficient.

## Source Map

- `contracts/ToolshedEscrow.sol`: escrow, membership, late-fee, and reputation logic.
- `contracts/mocks/MockUSDC.sol`: 6-decimal token for local tests.
- `test/ToolshedEscrow.t.sol`: Foundry unit and fuzz tests.
- `script/Deploy.s.sol`: deployment against a real USDC address.
- `script/DeployLocal.s.sol`: local mock USDC plus escrow deployment.
- `src/`: React frontend.
