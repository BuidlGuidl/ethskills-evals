# Toolshed

Toolshed is a first-version lending library for a neighborhood association. Members list tools offchain with photos and condition notes. The contract handles the USDC deposit, late-fee settlement, and emits the facts needed to compute member reputation.

## What Ships

- `contracts/ToolshedEscrow.sol`: one custom escrow contract for requests, approvals, refunds, late fees, and expired-deposit claims.
- `src/app`: a Vite browser app for browsing listings, listing tools, connecting a wallet, and submitting the USDC approval plus loan request.
- `src/domain`: offchain catalog and reputation logic. Rankings are derived from completed loans and late returns.
- `test`: Foundry contract tests, an optional Base USDC fork smoke test, and Vitest coverage for reputation sorting.

## Architecture

Onchain:

- Member allowlist, administered by the association.
- Loan request state and immutable loan terms: tool id, listing hash, owner, borrower, due date, deposit, and daily late fee.
- USDC escrow transfers and settlement.
- Events for `LoanRequested`, `LoanApproved`, `LoanCancelled`, `LoanClosed`, and `ExpiredDepositClaimed`.
- Borrower counters for completed loans and late returns. Browse ranking still happens offchain.

Offchain:

- Member profiles and display names.
- Tool descriptions, photos, categories, and condition notes.
- Search/filtering/browse UI.
- Reputation ranking. The app currently stores demo data in `localStorage`; production should replace `src/infra/storage.ts` with a small association-controlled database or API.

Trust boundary:

- The chain cannot verify physical return of a tool. The owner calls `markReturned` when the item comes back.
- If the borrower never returns the tool and late fees consume the whole deposit, the owner can call `claimExpiredDeposit`.
- The `listingHash` lets the request point to the offchain listing snapshot without storing photos or long descriptions onchain.

## Chain Decision

Target chain: **Base mainnet**.

Why Base:

- Native USDC is available on Base at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, listed by Circle in its supported-chain documentation: <https://help.circle.com/support/en/usdc-supported-blockchains-minting-redemption-faqs?id=kb_article_view&sysparm_article=KB0010590>.
- The app is for small neighborhood deposits and frequent settlement, so low transaction cost matters. BaseScan’s gas tracker showed about `0.007 gwei` when checked for this build: <https://basescan.org/gastracker>.
- Base has broad wallet support and simple EVM deployment tooling.

USDC uses 6 decimals. The deployed contract constructor takes the USDC token address and the association admin address.

## State Transitions

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `setMember(member, allowed)` | Association admin | Maintains the neighborhood member list | New members cannot use escrow until added |
| `requestLoan(...)` | Borrower | Locks their deposit and asks for the tool | No loan exists and no deposit is moved |
| `approveLoan(loanId)` | Tool owner | Accepts a request and starts the loan | Borrower can cancel and recover the deposit |
| `cancelRequest(loanId)` | Borrower | Recovers deposit before owner approval | Deposit remains escrowed in requested state |
| `markReturned(loanId)` | Tool owner | Receives any late fee and closes the loan | Deposit remains escrowed until owner closes or expiry claim becomes available |
| `claimExpiredDeposit(loanId)` | Tool owner | Receives the full deposit once late fees consume it | Funds remain escrowed and claimable |
| `transferAdmin(newAdmin)` | Current admin | Moves control to the association multisig | Current admin remains in control |

## Run Locally

Requirements:

- Node.js 22+
- npm 10+
- Foundry (`forge`, `cast`)

Install and test:

```sh
npm install
npm test
```

Run the app:

```sh
cp .env.example .env.local
npm run dev
```

Open the Vite URL printed by the command. Without `VITE_TOOLSHED_CONTRACT`, the app still works as an offchain demo and records pending requests locally. With a deployed contract, the borrow button submits the USDC approval and escrow request.

Build:

```sh
npm run build
```

Optional Base fork integration check:

```sh
BASE_RPC_URL=https://mainnet.base.org forge test --match-contract BaseUsdcForkTest
```

## Deploy To Base

Set environment variables:

```sh
export BASE_RPC_URL=https://mainnet.base.org
export BASESCAN_API_KEY=your_basescan_key
export DEPLOYER_PRIVATE_KEY=0x...
export ASSOCIATION_ADMIN=0xYourAssociationSafeOnBase
export BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

Deploy and verify:

```sh
forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
  --chain 8453 \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args "$BASE_USDC" "$ASSOCIATION_ADMIN" \
  --verify \
  --verifier etherscan \
  --etherscan-api-key "$BASESCAN_API_KEY"
```

The production admin should be the association’s Base Safe/multisig, not a personal wallet. If you deploy with a temporary admin, transfer control immediately:

```sh
cast send "$TOOLSHED_CONTRACT" "transferAdmin(address)" "$ASSOCIATION_ADMIN" \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY"
```

Configure the frontend:

```sh
VITE_TOOLSHED_CONTRACT=0xDeployedToolshedEscrow
VITE_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

## Post-Deploy Smoke Test

Use small real USDC amounts on Base mainnet.

```sh
export TOOLSHED_CONTRACT=0xDeployedToolshedEscrow
export OWNER=0xOwnerMember
export BORROWER=0xBorrowerMember
export OWNER_PRIVATE_KEY=0x...
export BORROWER_PRIVATE_KEY=0x...

cast send "$TOOLSHED_CONTRACT" "setMember(address,bool)" "$OWNER" true \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY"

cast send "$TOOLSHED_CONTRACT" "setMember(address,bool)" "$BORROWER" true \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY"

export DEPOSIT=1000000
export DAILY_LATE_FEE=100000
export DUE_AT=$(($(date +%s) + 86400))
export TOOL_ID=$(cast format-bytes32-string smoke-drill)
export LISTING_HASH=$(cast keccak "toolshed-smoke-listing-v1")
export LOAN_ID=$(cast call "$TOOLSHED_CONTRACT" "nextLoanId()(uint256)" --rpc-url "$BASE_RPC_URL")

cast send "$BASE_USDC" "approve(address,uint256)" "$TOOLSHED_CONTRACT" "$DEPOSIT" \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$BORROWER_PRIVATE_KEY"

cast send "$TOOLSHED_CONTRACT" \
  "requestLoan(bytes32,bytes32,address,uint64,uint256,uint256)" \
  "$TOOL_ID" "$LISTING_HASH" "$OWNER" "$DUE_AT" "$DEPOSIT" "$DAILY_LATE_FEE" \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$BORROWER_PRIVATE_KEY"

cast send "$TOOLSHED_CONTRACT" "approveLoan(uint256)" "$LOAN_ID" \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$OWNER_PRIVATE_KEY"

cast send "$TOOLSHED_CONTRACT" "markReturned(uint256)" "$LOAN_ID" \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$OWNER_PRIVATE_KEY"
```

Then confirm the loan is closed:

```sh
cast call "$TOOLSHED_CONTRACT" "loanStatus(uint256)(uint8)" "$LOAN_ID" \
  --rpc-url "$BASE_RPC_URL"
```

`3` means `Closed`.

## Notes For The Next Version

- Replace `localStorage` with a server-side store for the association’s catalog and uploaded images.
- Add a dispute path before increasing deposit sizes.
- Add indexer support for contract events so reputation stays in sync across devices.
- Add a Safe transaction batch for onboarding the initial member list.
