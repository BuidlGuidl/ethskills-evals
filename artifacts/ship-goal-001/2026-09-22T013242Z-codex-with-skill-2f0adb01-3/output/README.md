# Toolshed

Toolshed is a first-version lending library for a neighborhood association. Members can browse listed tools, add tool listings with photos and condition notes, request a loan for a few days, escrow a USDC deposit, and settle late fees when the owner confirms return.

## Architecture

The app keeps value movement onchain and keeps catalog data offchain.

- `contracts/ToolshedEscrow.sol` holds USDC deposits, records loan requests, calculates daily late fees, refunds the borrower, pays late fees to the tool owner, and stores member loan stats.
- `contracts/MockUSDC.sol` is a 6-decimal local test token for development.
- `src/` is a Vite React app using wagmi and viem. It renders the catalog, local add-listing form, wallet connection, exact USDC approval, and borrow request transaction flow.
- `test/ToolshedEscrow.t.sol` is a Foundry test suite covering deposit escrow, on-time return refunds, late-fee settlement, membership gating, and owner-only return confirmation.

For this MVP, photos, condition notes, search, and catalog sorting live in the frontend. Production should move those records to a small API/database or IPFS-backed metadata store and index `LoanRequested` / `ToolReturned` events for reputation. The contract is deliberately small: it is the settlement layer, not the whole neighborhood database.

## Contract Flow

1. The association steward deploys `ToolshedEscrow` with a USDC token address and steward address.
2. The steward marks association wallets as active members with `setMember(address,bool)`.
3. A borrower approves the escrow contract for the exact deposit amount.
4. The borrower calls `requestLoan(toolId, owner, dueAt, deposit, dailyLateFee)`.
5. The owner handles physical pickup and return offchain.
6. When the tool is returned, the owner calls `returnTool(loanId)`.
7. The contract sends any late fee to the owner and refunds the rest of the deposit to the borrower.

Important MVP tradeoff: the owner is the return confirmer. A production association may want an arbitration path for disputes or unresponsive owners.

## Getting Started

Requirements:

- Node.js 22+
- npm
- Foundry (`forge`, `cast`, and `anvil`)

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build the frontend:

```bash
npm run build
```

Start the frontend:

```bash
npm run dev
```

The app runs without contract addresses in read-only demo mode. To enable wallet actions, set:

```bash
VITE_CHAIN_ID=84532
VITE_TOOLSHED_ESCROW_ADDRESS=0x...
VITE_USDC_ADDRESS=0x...
```

## Local Chain Deployment

Start Anvil:

```bash
anvil
```

In another terminal, deploy mock USDC and the escrow. Use one of Anvil's printed private keys.

```bash
export RPC_URL=http://127.0.0.1:8545
export PRIVATE_KEY=0x...
export STEWARD_ADDRESS=0x...

forge create contracts/MockUSDC.sol:MockUSDC \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY

export USDC_ADDRESS=0x...

forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --constructor-args $USDC_ADDRESS $STEWARD_ADDRESS
```

Mark a borrower wallet as a member and mint mock USDC:

```bash
export ESCROW_ADDRESS=0x...
export BORROWER_ADDRESS=0x...

cast send $ESCROW_ADDRESS "setMember(address,bool)" $BORROWER_ADDRESS true \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY

cast send $USDC_ADDRESS "mint(address,uint256)" $BORROWER_ADDRESS 1000000000 \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

Then create `.env.local`:

```bash
VITE_CHAIN_ID=31337
VITE_LOCAL_RPC_URL=http://127.0.0.1:8545
VITE_TOOLSHED_ESCROW_ADDRESS=0x...
VITE_USDC_ADDRESS=0x...
```

## Testnet Deployment

Base Sepolia is a good first target for this consumer-style app because transactions are inexpensive and wallet onboarding is strong. Use the official USDC address for your target chain.

```bash
export BASE_SEPOLIA_RPC_URL=https://...
export DEPLOYER_PRIVATE_KEY=0x...
export STEWARD_ADDRESS=0x...
export USDC_ADDRESS=0x...

forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args $USDC_ADDRESS $STEWARD_ADDRESS \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

For production, use a multisig as `STEWARD_ADDRESS`, verify the source on the block explorer, and add member wallets through the multisig.

## Security Notes

- USDC uses 6 decimals; the contract and UI use 6-decimal parsing and formatting.
- `SafeERC20` handles token transfer return-value quirks.
- `ReentrancyGuard` protects deposit and settlement entry points.
- Late fees are charged in whole late days, rounded up, and capped at the deposit.
- The frontend uses exact approvals for each selected deposit rather than infinite approval.
- Catalog data is not trusted by the contract; the contract only trusts the submitted owner address and escrow terms.

Before using this with real funds, add dispute resolution, cancellation/decline flows, event indexing, production metadata storage, and an external security review.
