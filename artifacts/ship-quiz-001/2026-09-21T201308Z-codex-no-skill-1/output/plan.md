# NFT Marketplace MVP Plan and Audit Scope

## MVP Assumptions

- The NFT collection is an existing 5,000-token ERC-721 contract on Ethereum mainnet.
- The marketplace is for this collection only in the MVP.
- NFTs are never escrowed for listings. A seller keeps custody until a purchase or accepted offer executes.
- Fixed-price purchases use native ETH.
- Offers use escrowed native ETH so an owner can accept later without relying on a buyer's future wallet balance or token allowance.
- All outgoing ETH uses pull-based withdrawals. Sales, accepted offers, offer cancellations, and expired-offer refunds credit withdrawable balances instead of pushing ETH during the state-changing marketplace action.
- The artist resale fee is 2.5% of every completed fixed-price sale and accepted offer.
- Listing prices and offer amounts must be greater than zero.
- Offers must include an expiry between 15 minutes and 30 days after creation.
- The artist fee recipient can be updated only by the admin/multisig.
- There is no platform fee, pause switch, emergency seizure function, or upgradeability in the MVP.
- Primary minting, collection metadata, trait refreshes, auctions, bundles, ERC-1155 support, cross-chain support, private sales, and creator royalty registry integrations are out of scope for the MVP.

## Target Architecture

The MVP should have one marketplace smart contract, one collection-aware backend/indexer, and one web app.

Smart contract responsibilities:

- Store fixed-price listings by `tokenId`.
- Let the current owner list a token without transferring it to the marketplace.
- Require marketplace approval at purchase time, not necessarily at list time.
- Let a seller cancel their own listing.
- Let a buyer purchase a valid listing with ETH.
- Split every sale into 97.5% seller proceeds and 2.5% artist fee.
- Let a buyer create an ETH-backed offer for a specific `tokenId`.
- Let the buyer cancel an active offer.
- Let the token owner accept an active offer.
- Credit refunds/proceeds for stale, invalid, canceled, expired, or completed states safely.
- Let users withdraw credited ETH.
- Emit complete events for listing, cancellation, purchase, offer creation, offer cancellation, offer acceptance, withdrawal crediting, withdrawal, and admin changes.

Backend/indexer responsibilities:

- Read marketplace events and current ERC-721 ownership/approval state.
- Serve listing, offer, collection, and token-detail APIs to the web app.
- Hide stale listings where the lister no longer owns the token or has revoked approval.
- Track sale and offer history for each token.
- Provide reconciliation jobs against Ethereum RPC so the UI can recover from missed events.

Frontend responsibilities:

- Connect wallet.
- Browse the 5,000-token collection.
- Show token owner, current listing, offer state, recent sales, and ownership status.
- Let connected owners list, update by cancel-and-relist, cancel, and accept offers.
- Let buyers purchase listed tokens and make/cancel offers.
- Show clear transaction states, expected artist fee, seller proceeds, gas/network errors, and final settlement results.

## Four-Week Build Plan

### Week 1: Product Decisions, Contract Design, and Project Skeleton

Deliverables:

- Confirm the deployed ERC-721 contract address, ABI, token ID range, artist payout address, admin/multisig address, and RPC/provider choices.
- Confirm marketplace rules:
  - Listing prices and offer amounts must be greater than zero.
  - Offers expire between 15 minutes and 30 days after creation.
  - Sellers cannot buy their own listings.
  - Owners cannot make offers on their own tokens.
  - Artist fee recipient can be updated only by admin/multisig.
  - No platform fee.
- Create the Solidity marketplace contract with:
  - Collection allowlist fixed to the known ERC-721 contract.
  - Fixed 250 bps artist fee.
  - Non-custodial listing storage.
  - Escrowed ETH offers.
  - Pull-based ETH withdrawals.
  - Reentrancy protection.
  - Admin controls for fee recipient only.
- Set up Foundry or Hardhat tests, deployment scripts, linting, formatting, and CI.
- Start frontend app and backend/indexer skeleton.

Acceptance criteria:

- Contract compiles.
- Unit tests cover the main happy paths for listing, buying, canceling, making offers, canceling offers, and accepting offers.
- Deployment script works against a local chain.
- UI can connect a wallet and display placeholder collection data.

### Week 2: Smart Contract Completion and Indexing

Deliverables:

- Complete contract edge-case handling:
  - Purchase fails if listing is missing, price changed, seller no longer owns token, approval is missing, buyer is seller, ETH amount is wrong, or token transfer fails.
  - Accepting an offer fails if offer is missing, expired, canceled, already accepted, owner lacks approval, acceptor is not current owner, or token transfer fails.
  - Listings are removed after purchase.
  - Conflicting offers/listings do not corrupt state.
  - Royalty and seller payments are exact and dust handling is deterministic.
  - Withdrawals cannot be used to reenter listing, purchase, offer, cancellation, or acceptance flows.
- Add fuzz and invariant tests for accounting, custody, cancellation, and stale ownership/approval.
- Implement event indexer for marketplace and ERC-721 transfer/approval events.
- Implement APIs for:
  - Collection grid.
  - Token detail.
  - Active listings.
  - Active offers.
  - Activity history.
- Add backend reconciliation for stale listing and offer display state.

Acceptance criteria:

- Contract branch coverage is high enough for audit handoff, especially on failure paths.
- Local indexer can rebuild state from genesis or deployment block.
- API correctly marks stale listings as unavailable without requiring an on-chain cancel.
- API exposes pending withdrawal balances for connected wallets.

### Week 3: Marketplace UI and End-to-End Flows

Deliverables:

- Build collection browsing and token detail pages.
- Add owner listing flow:
  - Approval prompt if marketplace is not approved.
  - Price entry.
  - Fee/proceeds preview.
  - List transaction.
  - Cancel listing transaction.
- Add buyer purchase flow:
  - Buy button for active listings.
  - ETH total and artist fee preview.
  - Transaction progress and receipt handling.
- Add offer flow:
  - Buyer enters offer amount and expiry.
  - ETH escrow transaction.
  - Buyer cancels offer.
  - Owner accepts offer.
  - UI displays seller proceeds and artist fee before acceptance.
- Add withdrawal flow for seller proceeds, artist fees, and refunded offers.
- Add error states for wrong network, rejected wallet transaction, stale listing, missing approval, changed owner, and insufficient ETH.
- Add analytics/logging for failed transactions and indexer lag.

Acceptance criteria:

- Full listing-to-purchase flow works on a public Ethereum testnet or mainnet fork.
- Full offer-to-acceptance flow works on a public Ethereum testnet or mainnet fork.
- UI never presents stale listings/offers as guaranteed executable; it checks current on-chain state before transaction submission.

### Week 4: Hardening, Audit Handoff, and Launch Readiness

Deliverables:

- Freeze smart contract scope for audit.
- Complete test suite:
  - Unit tests.
  - Integration tests against a fork.
  - Fuzz tests.
  - Invariant tests.
  - Deployment dry run.
- Produce audit package:
  - Commit hash.
  - Contract source.
  - Deployment scripts.
  - Test commands.
  - Architecture notes.
  - Known limitations.
  - Threat model.
- Complete frontend/backend QA.
- Prepare production runbooks:
  - Deployment checklist.
  - Contract verification checklist.
  - Fee recipient rotation procedure.
  - Incident response steps.
  - Indexer rebuild procedure.
- Run an internal pre-audit review and fix obvious issues before auditor starts.

Acceptance criteria:

- Contract code is frozen except for audit fixes.
- Auditor can run the full test suite from a clean checkout.
- Marketplace can be exercised end to end on testnet or mainnet fork.
- Launch decision has explicit signoff from engineering, artist/admin, and product.

## Smart Contract Design Notes

Listings:

- `list(tokenId, price)` stores seller and price.
- `cancelListing(tokenId)` removes the listing.
- `buy(tokenId)` validates current ownership, approval, listing price, and `msg.value`.
- On purchase, the contract deletes the listing, transfers the NFT from seller to buyer with `safeTransferFrom`, credits artist fee and seller proceeds to withdrawable balances, and emits events.
- Listing a token should not transfer the NFT into escrow.

Offers:

- `makeOffer(tokenId, expiry)` is payable and stores the buyer, amount, and expiry.
- There is at most one active offer per buyer per token. A buyer must cancel before creating a different offer for the same token.
- `cancelOffer(tokenId)` marks the offer canceled and credits the buyer's withdrawable balance.
- `acceptOffer(tokenId, buyer)` validates current owner, approval, offer amount, and expiry.
- On acceptance, the contract clears the offer, transfers the NFT from owner to buyer with `safeTransferFrom`, credits artist fee and seller proceeds to withdrawable balances, and emits events.
- Expired offers can be canceled by the buyer to credit their refund. Anyone may be allowed to clear expired offers only if the ETH is still credited to the buyer.

Payment handling:

- Use basis points for the artist fee: `250`.
- Calculate `artistFee = price * 250 / 10_000`.
- Seller receives `price - artistFee`.
- Purchases require exact `msg.value`.
- Offer creation requires `msg.value` equal to the offer amount.
- All proceeds, artist fees, and refunds are stored in `pendingWithdrawals[address]`.
- `withdraw()` sends the caller's full pending balance and sets the balance to zero before the external call.
- Failed withdrawals revert and leave the pending balance intact.
- Use checks-effects-interactions and `nonReentrant`.

Admin controls:

- Admin can update the artist fee recipient.
- Admin cannot take user NFTs.
- Admin cannot change existing sale prices.
- Admin cannot seize, cancel, or redirect offers.
- Admin cannot pause the marketplace.

## Precise Audit Scope

The audit should cover the non-upgradeable MVP smart contract system at the frozen pre-audit commit.

In scope:

- Marketplace Solidity contract for one existing ERC-721 collection.
- Any inherited contracts or local libraries used by the marketplace.
- Deployment and initialization scripts.
- Constructor arguments and deployment configuration:
  - NFT collection address.
  - Artist fee recipient.
  - Admin/owner address.
  - Fee basis points.
- Fixed-price listing flow:
  - Create listing.
  - Cancel listing.
  - Purchase listing.
  - Listing invalidation when ownership or approval changes.
- Offer flow:
  - Create ETH-backed offer.
  - Cancel offer.
  - Accept offer.
  - Offer expiry.
  - Offer invalidation when ownership or approval changes.
- Settlement logic:
  - 2.5% artist fee calculation.
  - Seller proceeds calculation.
  - Refund behavior.
  - Pending withdrawal accounting.
  - Withdrawal behavior.
  - Rounding and dust handling.
- ERC-721 interactions:
  - `ownerOf`.
  - `getApproved`.
  - `isApprovedForAll`.
  - `safeTransferFrom`.
  - Receiver/reentrancy implications.
- Access control and admin functions.
- Event correctness and completeness for off-chain indexing.
- Reentrancy, denial of service, stale state, griefing, front-running, replay, self-trading, and stuck-funds risks.
- Solvency of the escrowed-offer and pending-withdrawal accounting.
- Test suite quality as it relates to the contract security claims.

Out of scope unless added before the freeze:

- The already deployed ERC-721 collection contract, except for interface assumptions needed by the marketplace.
- Frontend application code.
- Backend/indexer implementation.
- RPC provider reliability.
- Wallet provider behavior.
- Discord or community operations.
- Tax, securities, sanctions, consumer protection, and other legal analysis.
- Marketplace SEO, analytics, emails, and customer support tooling.
- Cross-chain or L2 deployments.
- ERC-1155, ERC-20 payment tokens, WETH/Permit2 offers, auctions, bundles, trait bidding, collection-wide offers, private listings, allowlists, and primary sales.
- Upgradeability.

Auditor should explicitly answer:

- Can a buyer receive an NFT without paying the correct total amount?
- Can a seller lose an NFT without receiving the correct proceeds?
- Can the artist fee be bypassed on marketplace-settled sales or offers?
- Can funds become permanently stuck?
- Can pending withdrawal balances become insolvent or be withdrawn by the wrong account?
- Can a malicious seller, buyer, artist fee recipient, or ERC-721 receiver reenter settlement or withdrawal flows?
- Can stale listings or stale offers execute incorrectly after transfer, approval revocation, cancellation, expiry, or prior fill?
- Can an unauthorized account cancel, accept, modify, or drain another user's listing, offer, NFT, or proceeds?
- Can rounding, exact-payment checks, or refund logic create accounting drift?
- Can event emissions mislead the backend into showing a sale, listing, cancellation, or offer state that did not actually happen?
- Are admin powers limited to the documented controls?

Recommended audit artifacts:

- Repository URL and frozen commit hash.
- Solidity compiler version and optimizer settings.
- Full dependency lockfile.
- Contract architecture document.
- Threat model.
- Function-by-function behavior spec.
- Deployment script and intended constructor arguments.
- Existing collection contract address and ABI.
- Test instructions and expected passing output.
- Coverage report.
- Known issues and accepted risks.
- Gas report, if available.

## Pre-Audit Test Matrix

Core listing tests:

- Owner can list an owned token.
- Non-owner cannot list.
- Owner can cancel.
- Non-owner cannot cancel.
- Buyer can buy an active listing with exact ETH.
- Purchase deletes listing.
- Purchase fails with wrong ETH amount.
- Purchase fails after seller transfers token away.
- Purchase fails after seller revokes approval.
- Purchase fails if buyer is seller, if that rule is adopted.

Core offer tests:

- Buyer can create an ETH-backed offer.
- Buyer can cancel and receive a withdrawable refund credit.
- Owner can accept an active offer.
- Non-owner cannot accept.
- Expired offer cannot be accepted.
- Canceled offer cannot be accepted.
- Accepted offer cannot be accepted again.
- Offer acceptance fails after owner transfers token away.
- Offer acceptance fails after owner revokes approval.
- Offer acceptance transfers artist fee and seller proceeds correctly.
- Seller, buyer, and artist can withdraw credited balances.
- Failed withdrawal leaves the pending balance intact.

Security tests:

- Reentrancy attempt during NFT receive hook.
- Reentrancy attempt through withdrawal.
- Fuzzed sale prices and offer amounts.
- Fuzzed listing/transfer/cancel/buy orderings.
- Invariant that marketplace never owns listed NFTs.
- Invariant that escrowed offers plus pending withdrawals are solvent.
- Invariant that completed settlements conserve ETH with no hidden fees.
- Invariant that artist fee is always 250 bps of settled price, with documented rounding.
- Stuck-funds tests for failed payment recipients.

## Launch Readiness After Audit

- Triage all audit findings by severity.
- Fix critical, high, and medium findings before launch unless formally accepted in writing.
- Ask the auditor to review fixes.
- Re-run the full test suite, fork tests, and deployment dry run.
- Verify contract source on Etherscan.
- Transfer admin ownership to the intended multisig before public launch.
- Start with a limited public beta and monitor failed transactions, stale listings, offer refunds, and indexer lag.
