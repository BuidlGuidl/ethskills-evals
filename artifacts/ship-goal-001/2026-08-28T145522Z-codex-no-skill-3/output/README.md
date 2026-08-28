# Toolshed

Toolshed is a member-only neighborhood tool library. Owners publish listings, borrowers escrow a USDC deposit, and the contract returns that deposit on return minus any daily late fee. Completed and late loan counts form a simple, portable borrower record.

## Architecture

- `contracts/Toolshed.sol` is the source of truth for membership, listings, loan state, escrow, settlement, and reputation. Only the association admin can add or remove members.
- `src/` is a React/Vite client that reads directly from an RPC endpoint and writes through the member's injected browser wallet. There is no server or database in v1.
- `script/Deploy.s.sol` deploys the contract with an existing USDC address and association admin.
- `test/Toolshed.t.sol` covers on-time settlement, rounded-up late fees, reputation, and rejection refunds. `MockUSDC` is local/test-only.

The loan lifecycle is `Requested → Active → Returned → Completed`. A borrower's deposit moves into escrow at request time. The owner may accept or reject; rejection and borrower cancellation refund it. Acceptance starts the due-date clock. The borrower marks physical return, freezing its timestamp, and the owner confirms it. Each started late day is charged; the fee is capped at the deposit and paid to the owner, while the remainder returns to the borrower.

The loan board sorts requests by late-return ratio (lowest first), then completed loans (highest first). This is a client-side sort over contract state and is appropriate for roughly 300 members. For materially larger usage, index events rather than scanning all records.

## Run locally

Requirements: Node 20+, npm, Foundry, and a browser wallet.

```sh
npm install
forge test
cp .env.example .env
```

For an entirely local chain, start `anvil`, deploy `MockUSDC` with `forge create`, then deploy Toolshed as described below using the mock token address. Mint test USDC by calling `mint(member, amount)` and add each wallet using `setMember(member, true)` from the admin wallet. Point `.env` at chain ID `31337`, `http://127.0.0.1:8545`, and both deployed addresses.

```sh
npm run dev
```

The app opens at `http://localhost:5173`. Contract amounts use USDC's six decimals; the UI performs that conversion. Listing photos are URLs, so use IPFS/Arweave or another durable HTTPS host.

## Deploy

Base Sepolia is the recommended staging network. Use the official USDC contract for the chosen network, and verify its address from Circle before deployment. Fund the deployer with native gas, then:

```sh
export USDC_ADDRESS=0x...
export ADMIN_ADDRESS=0x...
export RPC_URL=https://...
export PRIVATE_KEY=...
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
```

Copy `.env.example` to `.env`, set `VITE_CHAIN_ID`, `VITE_RPC_URL`, `VITE_TOOLSHED_ADDRESS`, and `VITE_USDC_ADDRESS`, then build:

```sh
npm install
npm run build
```

Deploy the generated static `dist/` directory to any static host. Source and documentation remain in ordinary folders; `artifacts/`, `cache/`, and `dist/` are generated and should not be reviewed as source.

After deployment the admin must call `setMember(address, true)` for each association wallet. A multisig should be the production admin. Removing a member blocks new listings and requests but intentionally does not strand existing escrow: current loan participants can still finish or reject their loans.

## Operational notes and v1 boundaries

- USDC approval and the loan request are two wallet transactions.
- The contract cannot determine whether a physical tool was actually returned; owner confirmation is the settlement authority. Disputes remain an association governance process in v1.
- Image URLs and free text are public on-chain. Do not put addresses, phone numbers, or private data in listings.
- The contract is not upgradeable and has not been independently audited. Test on a testnet before using real funds.
- There is no owner-initiated timeout seizure in v1. That avoids unilateral deposit confiscation, but unresolved returns require off-chain mediation.

## Commands

```sh
forge test          # contract tests
npm run dev         # development client
npm run build       # type-check and production build
npm run lint        # frontend lint
```

