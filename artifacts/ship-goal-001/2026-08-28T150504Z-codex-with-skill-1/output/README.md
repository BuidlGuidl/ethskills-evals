# Toolshed

Toolshed is a first, runnable vertical slice of a neighborhood tool-lending library. Members publish tool details and photos, borrowers escrow a USDC deposit, and the lender settles the loan after return. A rounded-up daily late fee goes to the lender; the remainder returns to the borrower. Settled loan facts form a portable reliability record.

## Architecture and MVP boundary

- `contracts/ToolshedEscrow.sol` is the only production contract. It gates activity to association members, escrows USDC, runs the request/accept/return/settle lifecycle, records completed/late counters, and emits canonical facts.
- `server/index.js` stores mutable listing metadata (name, photo URL, condition, price terms, owner wallet) in `data/tools.json`. This intentionally keeps photos, editing, search, and moderation offchain. For one 300-member association the JSON adapter is easy to operate; replace it with Postgres/object storage before multi-instance hosting.
- `src/` is a React/Vite client. It hashes the API's stable listing UUID into the onchain `toolId`. It reads borrower history from the contract and ranks listings by `completedLoans - lateReturns`, then completed loans. Reputation is derived in the client—not a leaderboard in contract storage.
- The association steward controls membership and can resolve a physically verified stalled return. Production ownership must be the association's 2-of-3 Safe multisig, never a developer wallet.

Important MVP limitations: API writes are not yet wallet-signed, images are URL-based, there is no calendar/availability model, and the steward is the human dispute path. Put the API behind the association login or add signed messages before public exposure. The contract has tests, but has not been independently audited.

## State transitions and liveness

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `setMember` | association Safe | admits/removes a member | wallet cannot start a loan |
| `requestLoan` | borrower | wants the tool; deposits USDC | no request exists |
| `acceptLoan` | lender | agrees to hand off their tool | deposit stays escrowed; borrower can cancel |
| `cancelRequest` | borrower | recovers an unaccepted deposit | deposit remains escrowed |
| `rejectRequest` | lender | declines and releases the deposit | borrower can cancel instead |
| `markReturned` | borrower | freezes the return timestamp and late-fee clock | loan remains active and fees keep accruing up to deposit |
| `confirmReturn` | lender | receives any late fee and closes the loan | funds stay escrowed; steward can inspect and settle |
| `stewardSettle` | association Safe | resolves a stalled physical handoff for members | funds remain safely escrowed |
| `transferOwnership` | current Safe | rotates governance | current Safe remains steward |

Late days are `ceil((returnedAt - dueAt) / 1 day)`. Fees are capped at the deposit. Lender confirmation delay cannot increase them because `markReturned` freezes `returnedAt`.

## Run locally

Prerequisites: Node 22+, npm, Foundry, and a browser wallet.

```bash
npm install
cp .env.example .env
forge test
npm run dev
```

The web app is at `http://localhost:5173`; the API is at `http://localhost:8787`. For a contract-only local sandbox, run Anvil, deploy `MockUSDC` and `ToolshedEscrow`, mint mock tokens, and put both addresses in `.env`. Generated `out/`, `dist/`, and dependency folders are intentionally ignored; all human-readable source is in ordinary folders.

## Base Sepolia deployment

The first launch target is **Base Sepolia (chain ID 84532)**: it has native Circle test USDC, browser-wallet support, and cheap transactions appropriate for many low-value neighborhood loans. Circle's Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; test tokens have no real value. Network values come from the [official Base connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base) and the address from [Circle's official USDC address list](https://developers.circle.com/stablecoins/usdc-contract-addresses).

Create a deployer keystore and define the deployment inputs:

```bash
cast wallet import toolshed-deployer --interactive
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
export ASSOCIATION_SAFE=0xYourAssociation2of3Safe
```

Fund the deployer with Base Sepolia ETH. Confirm `$ASSOCIATION_SAFE` is the intended Safe and has signers configured. Build, test, deploy, and verify using Sourcify:

```bash
forge test
forge create contracts/ToolshedEscrow.sol:ToolshedEscrow \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" --account toolshed-deployer \
  --constructor-args "$USDC_ADDRESS" "$ASSOCIATION_SAFE" \
  --broadcast --verify --verifier sourcify
export ESCROW_ADDRESS=0xAddressPrintedByForge
cast call "$ESCROW_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$ESCROW_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

The constructor assigns production control directly to the Safe, so there is no deployer ownership to forget to transfer. From a Safe transaction, admit two test members with `setMember(address,bool)`. Then perform this post-deploy smoke test:

1. Acquire test USDC for the borrower and approve `$ESCROW_ADDRESS` for a small six-decimal amount.
2. Add a tool in the UI owned by the lender.
3. Borrower requests it; note the emitted loan ID. Lender accepts it.
4. Borrower marks it returned; lender confirms. Check `completedLoans(borrower)` is `1` and the borrower balance was refunded.

Configure and build the app:

```bash
cp .env.example .env
# edit .env with ESCROW_ADDRESS; retain the official USDC_ADDRESS above
npm install
npm run build
```

Deploy the static `dist/` result to any static host and run `npm run api` on a single persistent Node host with writable `data/`, reverse-proxying `/api` to it. In production, set `VITE_ESCROW_ADDRESS` and `VITE_USDC_ADDRESS` in the build environment. Do not run multiple API replicas against the JSON file.

## Pre-launch checklist

- Have a fresh reviewer inspect the contract, rounding/cap behavior, API write authorization, and Safe addresses.
- Run `forge test` and an end-to-end loan on Base Sepolia.
- Verify source code, Safe ownership, USDC address, membership, backups, TLS, and API persistence.
- Commission an independent contract security review before using real USDC or moving to Base mainnet.
