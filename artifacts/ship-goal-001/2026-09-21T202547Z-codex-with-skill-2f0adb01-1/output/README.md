# Toolshed

Toolshed is a first-version lending library for a neighborhood association. Members list tools with photos, condition notes, deposits, and late fees. Borrowers escrow a USDC deposit when they request a loan. When the owner confirms the return, the borrower gets the deposit back minus any late fees, and late fees go to the tool owner.

## Architecture

- `contracts/ToolshedEscrow.sol` is the onchain escrow. It stores member allowlist status, loan state, deposits, late-fee settlement, defaults, and borrower stats.
- `contracts/MockUSDC.sol` is only for local development and tests.
- `src/` is a Vite React app. It keeps catalog data, photos, condition notes, and queue sorting offchain for the MVP, while using the contract for value movement.
- `test/ToolshedEscrow.ts` covers escrow deposits, owner acceptance, cancellation, on-time returns, late returns, non-member checks, and default claims.
- `scripts/deploy.ts` deploys the escrow. If `USDC_ADDRESS` is missing it deploys `MockUSDC` for local development.

The contract deliberately keeps images and descriptions offchain. In production, put those in a normal database or IPFS metadata, then index contract events for loan history and reputation.

## Contract Flow

1. The association admin adds member wallet addresses with `setMember` or `setMembers`.
2. A borrower calls `requestLoan`, which transfers the USDC deposit into escrow.
3. The tool owner calls `acceptLoan`.
4. When the tool comes back, the owner calls `confirmReturn`.
5. Late days are rounded up. The late fee is capped at the deposit, paid to the owner, and the remainder is refunded to the borrower.
6. If the tool is not returned after the 30 day grace period, the owner can call `claimDefault`.

## Local Setup

Install dependencies:

```bash
npm install
```

Run contract tests:

```bash
npm test
```

Run the frontend:

```bash
npm run dev
```

By default the UI runs with seeded demo data. To send real transactions, deploy the contract and set frontend environment variables.

## Local Deployment

Start a local Hardhat node:

```bash
npx hardhat node
```

In another terminal, deploy the escrow and mock USDC:

```bash
npm run deploy:local
```

Create `.env.local` with the deployed addresses:

```bash
VITE_TOOLSHED_ESCROW_ADDRESS=0xYourEscrow
VITE_USDC_ADDRESS=0xYourMockUSDC
VITE_LOCAL_RPC_URL=http://127.0.0.1:8545
```

For a realistic local demo, mint mock USDC to the borrower wallet, approve the escrow through the UI, and add seeded owner/borrower addresses as members with `setMembers`.

## Testnet Deployment

Set deployment variables:

```bash
SEPOLIA_RPC_URL=https://...
DEPLOYER_PRIVATE_KEY=0x...
USDC_ADDRESS=0xYourSixDecimalUSDCToken
```

Deploy:

```bash
npm run deploy:sepolia
```

Then set the Vite variables for the frontend:

```bash
VITE_TOOLSHED_ESCROW_ADDRESS=0xYourEscrow
VITE_USDC_ADDRESS=0xYourUSDC
VITE_SEPOLIA_RPC_URL=https://...
```

Build the frontend:

```bash
npm run build
```

The static site output is generated in `dist/`, which is ignored as generated output.

## Production Notes

- Use a real 6-decimal USDC token address for the target chain.
- Transfer contract ownership to a multisig before accepting real deposits.
- Store member profile and tool listing metadata offchain, and use `LoanRequested`, `LoanReturned`, and `LoanDefaulted` events to update the app index.
- Do not use unlimited USDC approvals. The frontend approves only the selected deposit amount.
- Add a real member management screen before launch; this first version exposes the contract methods and ships seeded UI data.
