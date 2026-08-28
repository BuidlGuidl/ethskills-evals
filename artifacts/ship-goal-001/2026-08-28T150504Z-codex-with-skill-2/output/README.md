# Toolshed

Toolshed is a runnable first version of a neighborhood tool-lending library. Members can list tools with photos and condition notes, browse listings ranked by reliability, request dates, and escrow a USDC deposit. Returning on time refunds the deposit; each started late day pays the owner a configured fee, capped at the deposit.

## Run locally

Requirements: Node.js 20+ and [Foundry](https://getfoundry.sh/). The web demo has no npm dependencies.

```bash
npm start
# open http://localhost:3000
```

The demo starts with three listings. Listings and requests are held in memory and reset when the server restarts. Run the contract suite separately:

```bash
npm test
```

## Architecture and MVP boundary

This repository deliberately separates coordination from custody:

- `public/` is a dependency-free browse/list/request UI.
- `server/server.js` is the MVP HTTP API and offchain store. It owns member profiles, listing text, photo URLs, availability, requests, and ranking.
- `contracts/src/ToolshedEscrow.sol` is the single custom contract. It owns membership authorization, loan terms, USDC custody, late-fee calculation, refunds, cancellation, and dispute settlement.
- Reputation is derived offchain from `LoanCreated` and `LoanSettled` events. The demo reliability is `(loans - late returns) / loans`, with more completed loans breaking ties. The owner request queue puts reliable borrowers first; no score or leaderboard is stored onchain.
- A listing is joined to a loan by `bytes32 listingId` (for example `keccak256` of the database ID). Images and personal data never go onchain.

The web MVP demonstrates the product loop but intentionally does not submit wallet transactions. In the production integration, an owner accepts an offchain request, the borrower approves USDC and calls `createLoan`, and the indexer attaches the resulting `loanId` to the request. Authentication, durable storage, image uploads, notifications, wallet UI, and an event indexer are the next production tasks—not hidden dependencies of this demo.

### Contract rules

- Only association members can lend or borrow. The association admin manages the allowlist.
- The borrower creates the agreed loan and funds the deposit atomically.
- The lender confirms a physical return. Late days round up and the fee cannot exceed the deposit.
- Before the due time, the lender can cancel a failed handoff and refund the borrower.
- The association admin can resolve a return dispute with an effective return timestamp no later than the current block.
- Admin transfer is two-step. Use an association-controlled multisig, never a personal wallet, for a real launch.

### State transitions and liveness

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `setMember` | Association multisig | Onboards or removes a member | Address cannot start new loans; existing escrow remains settleable |
| `createLoan` | Borrower | Gets the agreed tool; funds their deposit | No loan is created and no USDC moves |
| `confirmReturn` | Lender | Receives any late fee and closes their loan | Deposit remains safely escrowed; admin dispute path stays available |
| `cancelLoan` | Lender, before due time | Closes a failed handoff for their listing | Loan stays active; normal return/dispute paths remain |
| `resolveReturn` | Association multisig | Resolves a participant dispute | Funds remain escrowed until lender confirmation or resolution |
| `startAdminTransfer` | Current multisig | Rotates association control | Current admin remains in control |
| `acceptAdmin` | Pending multisig | Accepts association control | Current admin remains in control |

There is no cron job and no automatic deadline transaction: EVM contracts do not wake up on a schedule. Every fund-moving path has a directly interested caller, while disputed funds remain in escrow rather than being assigned silently.

## Deploy to Base Sepolia

The first launch target is **Base Sepolia** (chain ID `84532`). It gives the association low-cost EVM transactions, standard wallet support, and Circle-issued test USDC, so the complete deposit loop can be rehearsed without real funds. Circle's canonical Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; confirm it against [Circle's current address list](https://developers.circle.com/stablecoins/usdc-contract-addresses) before every deployment.

Set these variables. `ADMIN_MULTISIG` must be the association's Safe/multisig address—even on testnet, rehearsing the final control model is preferable. Use a dedicated funded deployer key.

```bash
export BASE_SEPOLIA_RPC_URL='https://sepolia.base.org'
export BASESCAN_API_KEY='...'
export DEPLOYER_PRIVATE_KEY='0x...'
export ADMIN_MULTISIG='0x...'
export USDC='0x036CbD53842c5426634e7929541eC2318f3dCF7e'
```

Compile, test, deploy, and copy the printed deployed address into `ESCROW`:

```bash
forge test -vv
forge create contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --constructor-args "$USDC" "$ADMIN_MULTISIG"
export ESCROW='0x...'
```

Verify the exact source and constructor arguments:

```bash
forge verify-contract "$ESCROW" contracts/src/ToolshedEscrow.sol:ToolshedEscrow \
  --chain 84532 \
  --etherscan-api-key "$BASESCAN_API_KEY" \
  --constructor-args "$(cast abi-encode 'constructor(address,address)' "$USDC" "$ADMIN_MULTISIG")" \
  --watch
```

### End-to-end post-deploy check

Obtain Base Sepolia ETH and test USDC for two dedicated test wallets. Set their keys/addresses and run the following. The multisig submits the two `setMember` calls through its own UI; the equivalent calldata is shown by `cast calldata`.

```bash
export BORROWER_PRIVATE_KEY='0x...'
export LENDER_PRIVATE_KEY='0x...'
export BORROWER="$(cast wallet address --private-key "$BORROWER_PRIVATE_KEY")"
export LENDER="$(cast wallet address --private-key "$LENDER_PRIVATE_KEY")"

cast calldata 'setMember(address,bool)' "$BORROWER" true
cast calldata 'setMember(address,bool)' "$LENDER" true
# Submit both payloads from ADMIN_MULTISIG to ESCROW, then verify:
cast call "$ESCROW" 'isMember(address)(bool)' "$BORROWER" --rpc-url "$BASE_SEPOLIA_RPC_URL"

cast send "$USDC" 'approve(address,uint256)' "$ESCROW" 1000000 \
  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
export DUE_AT="$(( $(date +%s) + 86400 ))"
cast send "$ESCROW" 'createLoan(bytes32,address,uint128,uint128,uint64)' \
  "$(cast keccak 'post-deploy-check')" "$LENDER" 1000000 100000 "$DUE_AT" \
  --private-key "$BORROWER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
# On a fresh deployment this is loan 1. Confirm immediately for a full refund.
cast send "$ESCROW" 'confirmReturn(uint256)' 1 \
  --private-key "$LENDER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$ESCROW" 'loans(uint256)(bytes32,address,address,uint128,uint128,uint64,uint8)' 1 \
  --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

The final status value must be `2` (`Settled`), the escrow USDC balance should be zero, and the borrower's 1 USDC should be refunded.

## Production handoff

Before using real deposits:

1. Replace the in-memory arrays with a durable database, authenticated association accounts, private object storage, input sanitization, and authorization checks. Treat condition photos and member history as personal data.
2. Add a wallet client that checks chain ID, USDC balance/allowance, simulates calls, and records transaction hashes. Index finalized contract events and rebuild reputation deterministically.
3. Add request acceptance and make the signed/accepted terms match `createLoan` arguments. Define the association's evidence and response-time policy for admin dispute resolution.
4. Add invariant/fuzz tests (escrow solvency, fee cap, terminal states), fork-test canonical USDC, and commission an independent security review. This code has not been audited.
5. Rehearse deployment and multisig recovery, verify source, run the post-deploy loan above, monitor events/balances, and have a fresh reviewer sign off on the complete vertical slice.

For a mainnet release, make a separate chain decision based on actual member wallet distribution, current fees, USDC liquidity, and legal/association requirements. Do not reuse the test deployment or test keys.
