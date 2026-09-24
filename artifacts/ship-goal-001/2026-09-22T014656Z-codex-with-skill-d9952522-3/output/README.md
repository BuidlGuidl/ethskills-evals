# Toolshed

Toolshed is a first-version lending library for a neighborhood association of about 300 members. Members list tools offchain with photos and condition notes. Borrowers escrow a USDC deposit onchain, owners accept the loan, and late fees are paid from the deposit when the tool is returned.

## Architecture

The MVP has one custom contract:

- `ToolshedEscrow`: member-gated USDC escrow for loan requests, owner acceptance, return confirmation, late-fee settlement, overdue deposit claims, and minimal member counters.

The onchain boundary is intentionally small:

- Onchain: membership allowlist, USDC deposit custody, loan state, settlement, late-fee accounting, and events needed to reconstruct loan history.
- Offchain: member profiles, tool names, photos, condition notes, search, browse filters, and the reliability ranking shown in the app.
- Derived data: reputation is computed offchain from contract events plus the small settlement counters. The contract does not store a leaderboard.

The frontend in `src/` is a Vite React app. It ships with sample neighborhood data, sorts tools by owner reliability, and includes wallet calls for `approve()` and `createRequest()` once contract addresses are configured.

## Loan Flow

1. Association owner adds members with `setMember(address,bool)`.
2. A member lists a tool in the offchain app or database.
3. A borrower approves USDC and calls `createRequest(...)`, escrowing the deposit.
4. The tool owner calls `acceptRequest(...)` or `declineRequest(...)`.
5. The borrower calls `markReturned(...)` when the physical tool is returned.
6. The tool owner calls `confirmReturn(...)`; the contract refunds the borrower and pays any daily late fee to the owner.
7. If the owner does not confirm within `REVIEW_PERIOD`, the borrower can call `claimRefundAfterReview(...)`.
8. If the borrower never marks the tool returned and accrued late fees consume the deposit, the owner can call `claimOverdueDeposit(...)`.

## State Transitions

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `setMember(member, enabled)` | Association owner multisig | Maintains the neighborhood member list | New members cannot borrow or lend onchain |
| `transferOwnership(newOwner)` | Current owner | Hands control to the association multisig | Existing owner remains in control |
| `createRequest(...)` | Borrower | Starts a loan request and locks their USDC deposit | No request exists and no funds move |
| `acceptRequest(loanId)` | Tool owner | Makes the request active so the lending handoff can happen | Deposit remains escrowed until owner declines or borrower cancels |
| `declineRequest(loanId)` | Tool owner | Rejects a request and returns the deposit | Borrower can still cancel before acceptance |
| `cancelRequest(loanId)` | Borrower | Recovers deposit before the owner accepts | Deposit remains escrowed until owner accepts or declines |
| `markReturned(loanId)` | Borrower | Starts the refund path and freezes the return timestamp used for late fees | Loan remains active; owner can later claim deposit only if late fees consume it |
| `confirmReturn(loanId)` | Tool owner | Receives any late fee and settles the loan | Borrower can self-settle after review period |
| `claimRefundAfterReview(loanId)` | Borrower | Gets deposit back if owner does not confirm return | Funds remain escrowed |
| `claimOverdueDeposit(loanId)` | Tool owner | Claims deposit after unreturned lateness consumes it | Funds remain escrowed and owner can call later |

## Target Chain

First deploy target: Base Sepolia (`chainId` `84532`).

Why Base Sepolia:

- It supports Circle test USDC, matching the product requirement to escrow USDC.
- It is cheap enough for small, repeated neighborhood-loan interactions.
- It uses the same wallet UX and EVM tooling expected for a later Base mainnet deployment.

Use Circle's Base Sepolia USDC address for test deployments:

```text
0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

Before mainnet, replace this with the canonical USDC address for the selected production chain and re-run a fork/integration test against that token.

Address references used for this MVP:

- Circle-maintained USDC skill reference: <https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-usdc/SKILL.md>
- Circle supported chains and currencies: <https://developers.circle.com/circle-mint/supported-chains-and-currencies>
- Base Sepolia block explorer: <https://sepolia.basescan.org>

## Getting Started

Install dependencies:

```bash
npm install
```

Run contract tests and TypeScript checks:

```bash
npm test
```

Run the app:

```bash
npm run dev
```

The app reads these environment variables:

```bash
VITE_CHAIN_ID=84532
VITE_TOOLSHED_ESCROW_ADDRESS=0xYourDeployedEscrow
VITE_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

## Deployment

Required environment variables:

```bash
export BASE_SEPOLIA_RPC_URL=https://your.base-sepolia.rpc
export BASESCAN_API_KEY=your_basescan_api_key
export PRIVATE_KEY=0xyour_deployer_private_key
export ASSOCIATION_OWNER=0xAssociationMultisigOrAdmin
export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

Deploy and verify:

```bash
npm run deploy:base-sepolia
```

Equivalent raw Foundry command:

```bash
forge script script/DeployToolshed.s.sol:DeployToolshed \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

The deploy script reads `USDC_ADDRESS` and `ASSOCIATION_OWNER`. Contract ownership should be the association's Safe or other multisig, not a developer wallet.

Post-deploy smoke test:

1. Fund two member wallets with Base Sepolia ETH and test USDC.
2. From `ASSOCIATION_OWNER`, call `setMember(ownerWallet, true)` and `setMember(borrowerWallet, true)`.
3. From the borrower wallet, approve the escrow for the deposit amount on the USDC contract.
4. From the borrower wallet, call `createRequest(...)` with a `toolId`, owner address, start timestamp, due timestamp, deposit, daily fee, and listing URI.
5. From the owner wallet, call `acceptRequest(loanId)`.
6. From the borrower wallet, call `markReturned(loanId)`.
7. From the owner wallet, call `confirmReturn(loanId)` and verify the borrower received the refund minus any late fee.

## Production Notes

- Add a real offchain store for members, listings, photos, and condition notes. IPFS, S3, or a neighborhood-run database all work; only stable listing URIs or hashes need to be referenced onchain.
- Index contract events with a small worker or hosted indexer. Use those events to compute loan counts, late-return rates, and browse sorting.
- Review the dispute model before holding meaningful value. This MVP intentionally avoids arbitration and gives the borrower a self-refund path after they mark a return.
- Run an external security review before production mainnet. The contract is compact, but it controls escrowed funds.
