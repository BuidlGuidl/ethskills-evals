# Toolshed

Toolshed is a first-release lending library for a roughly 300-member neighborhood association. Members publish tools with photos and condition notes, request short loans, escrow a USDC deposit, and build a return history. The repository contains a dependency-free Node web app and one Solidity escrow contract.

## Run locally

Requirements: Node.js 22.5+ and Foundry. No npm packages or install step are required.

```bash
cp .env.example .env
set -a && source .env && set +a
npm test
forge test
npm run dev
```

Open `http://localhost:3000`. The default development invite code is `change-me`; set a real `INVITE_CODE` before sharing the server. Data is written to `data/toolshed.json`. To exercise wallet actions locally, deploy the contract to an Anvil chain with a mock six-decimal ERC-20 and set `CHAIN_ID`, `USDC_ADDRESS`, and `TOOLSHED_ADDRESS` accordingly.

This MVP uses photo URLs rather than uploads. Production should place images in an association-controlled object-storage bucket and pass its public URL to the listing form.

## Architecture and trust boundary

The web server in `src/server.js` serves the browser app and a small JSON API. It keeps association membership, listings, photo URLs, condition notes, and loan coordination in an offchain JSON store. That is intentionally adequate for 300 members and keeps searchable, editable personal data offchain. Run one server process only; migrate `Store` to Postgres before horizontal scaling.

`ToolshedEscrow.sol` is the only custom contract. It holds USDC, records agreed financial terms and deadlines, and atomically splits a deposit at return. A started late day is charged as a full day, and fees can never exceed the deposit. The association admin can resolve a disputed return using documented handoff evidence. Use a 2-of-3 association Safe for `ADMIN_ADDRESS`, never a developer wallet.

Reputation is not a contract score or leaderboard. `LoanSettled` emits the borrower, deadline outcome (via `lateDays`), and payout facts needed by an indexer; the app derives completed-loan and late-return counts and sorts requests by reliability, then experience, then recency. The included server stores the same facts after confirmed wallet transactions for immediate UX. Before production, run an event indexer that reconciles server records against `LoanFunded`, `LoanActivated`, `LoanCancelled`, and `LoanSettled`; the chain is authoritative for financial/reputation outcomes. New members show “New borrower” rather than an invented perfect score.

The invite code is lightweight association gating, not strong identity. A production deployment should replace it with one-time invitations and wallet-signature sessions; the current session tokens are in memory and expire on restart. Owners still make the lending decision, and their incoming requests are ordered so borrowers with reliable histories appear first.

### State transitions and liveness

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `fundLoan` | Borrower, after USDC approval | Requests the loan and locks their deposit | No loan starts and no funds move |
| `activateLoan` | Tool owner at physical handoff | Confirms they released the tool under these terms | Borrower or owner can cancel and the full deposit is refunded |
| `cancelLoan` | Borrower or owner, before handoff | Ends an abandoned request; borrower receives refund | Deposit stays safely escrowed until either party cancels |
| `confirmReturn` | Tool owner | Closes their active loan; any late fee is paid to them | Deposit stays escrowed; borrower can ask the association to arbitrate |
| `resolveReturn` | Association 2-of-3 Safe | Resolves a dispute and restores member funds | Active loan remains escrowed; there is no owner-only seizure path |

Contracts cannot observe a physical return. The owner confirmation is the happy path and multisig arbitration is the necessary real-world oracle. There is deliberately no unattended cron or keeper pretending to know whether a tool was returned.

## Base Sepolia deployment

The single launch target is **Base Sepolia** (`84532`). It has Circle test USDC and lets the association test familiar USDC-denominated deposits with cheap, fast wallet transactions before handling real member money. The configured official Circle test USDC address is `0x036CbD53842c5426634e7929541eC2318f3dCF7c`; verify it again against Circle's supported-chain documentation before every deployment.

Create a 2-of-3 association Safe on Base Sepolia, fund the deployer with test ETH, copy `.env.example` to `.env`, and fill in:

```bash
export BASE_SEPOLIA_RPC_URL='https://…'
export BASESCAN_API_KEY='…'
export PRIVATE_KEY='0x…'                 # deployer only
export USDC_ADDRESS='0x036CbD53842c5426634e7929541eC2318f3dCF7c'
export ADMIN_ADDRESS='0x…'               # association 2-of-3 Safe
```

Build, test, deploy, and verify in one command:

```bash
forge test
npm run deploy:sepolia
```

The command uses `script/Deploy.s.sol`, broadcasts to the `base_sepolia` endpoint, and requests Basescan verification. Copy the printed deployed address into `TOOLSHED_ADDRESS`. If automatic verification is delayed, run:

```bash
npm run verify:sepolia
```

Set the runtime web environment (`INVITE_CODE`, `CHAIN_ID=84532`, `USDC_ADDRESS`, `TOOLSHED_ADDRESS`, `ADMIN_ADDRESS`, and a persistent `DATA_FILE`), then run `npm start` behind HTTPS. The server itself never receives a private key.

### Post-deploy smoke transaction

Use two test wallets (borrower and owner), obtain Circle test USDC, and perform one end-to-end loan through the UI: join both members, list a tool as owner, request it as borrower, approve and fund 1 USDC with a 0.10 USDC/day fee, activate as owner, then confirm the return. Check that contract USDC balance returns to zero and the UI shows one completed, on-time loan. Also inspect the verified `LoanSettled` log on Basescan. For a late-path check on a fresh deployment, use a one-day term and Foundry/Anvil time travel; do not wait or falsify production return times.

## Production checklist

- Replace shared invite codes and memory sessions with one-time membership invitations plus signed wallet authentication.
- Add an RPC event indexer/reconciler and only award reputation after confirmed `LoanSettled` logs.
- Move the JSON store to backed-up Postgres and photos to malware-scanned object storage.
- Have an independent reviewer audit token handling, rounding, arbitration, and the complete vertical slice.
- Verify the Circle USDC address, contract source, Safe owners/threshold, and environment on the selected chain.
- Test with USDC behavior on a Base Sepolia fork, then set monitoring for active escrow balances and unresolved loans.

This is MVP software, not an audited custody system. Do not deploy with member funds until the review, indexer reconciliation, authentication upgrade, and operational controls above are complete.
