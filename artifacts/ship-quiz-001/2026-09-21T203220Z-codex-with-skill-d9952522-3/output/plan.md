# Four-Week MVP Plan and Audit Scope

## Product Goal

Move resale activity for the existing 5,000-piece Ethereum mainnet ERC-721 collection from manual Discord coordination into a first-party marketplace where:

- Owners list NFTs at fixed ETH prices without transferring them into escrow.
- Buyers purchase listed NFTs directly from the site.
- Buyers make funded ETH offers that owners can accept later.
- Sellers cancel active listings.
- Buyers cancel active offers.
- The artist receives 2.5% of every completed resale.

The MVP should ship a narrow, trust-minimized marketplace for this one existing collection only. It should not attempt to become a general NFT marketplace.

## Core Architecture

### Target Chain

Launch on Ethereum mainnet because the collection already lives there and holder liquidity is already denominated in mainnet ETH. Moving resale settlement to another chain would require bridging, wrapped or mirrored assets, or a new ownership representation, which is outside the MVP and would weaken the holder expectation that sales settle against the canonical NFT.

Before deployment, measure current mainnet gas costs for `list`, `buy`, `makeOffer`, `acceptOffer`, and `cancel` on a fork. If the gas cost makes low-price sales uneconomic, keep the contract mainnet-only but make the UI show an estimated network fee before users submit transactions.

### Onchain

One custom contract: `CollectionMarketplace`.

Responsibilities:

- Store fixed-price listings for the existing collection.
- Store funded ETH offers for specific token IDs.
- Settle buys and accepted offers atomically.
- Calculate a 2.5% artist fee on every sale.
- Accrue seller and artist proceeds as pull payments.
- Emit events for indexing listings, offers, cancellations, sales, and withdrawals.
- Allow owner/admin to pause settlement in emergencies.

External contracts:

- Existing ERC-721 collection contract.
- OpenZeppelin primitives for `IERC721`, `IERC721Receiver` only if needed, `Ownable2Step`, `Pausable`, `ReentrancyGuard`, and `SafeCast`/math helpers as appropriate.

No custom escrow contract, router, factory, fee splitter, token wrapper, or upgrade proxy for the MVP.

### Offchain

The website and backend/indexer handle:

- Browsing, search, filtering, token metadata, images, traits, and collection stats.
- Showing active listings and offers from marketplace events plus direct contract reads.
- User profiles, Discord links, notifications, and activity feeds.
- Gas estimates and transaction status.
- Any ranking, floor, volume, or analytics calculations.

No rankings, browsing pagination, metadata, or activity feeds should be stored in contract state.

## Marketplace Behavior

### Listings

- Owner calls `createListing(tokenId, priceWei, expiry)` while still holding the NFT.
- Contract verifies current ownership and nonzero price.
- The NFT remains in the owner's wallet.
- Owner must approve the marketplace for the token or set approval for all before a sale can settle.
- Owner can call `cancelListing(tokenId)`.
- If the owner transfers the NFT away, revokes approval, or the listing expires, the listing remains visible in historical events but becomes unbuyable. The UI should hide or mark it invalid after checking ownership, approval, and expiry.
- Buyer calls `buy(tokenId)` with exact ETH. Settlement verifies listing validity, transfers the NFT from seller to buyer, accrues 97.5% to seller and 2.5% to artist, and clears the listing.

### Offers

Offers should be funded with ETH in the marketplace contract. This is different from listings: listed NFTs are not escrowed, but offer funds must be escrowed so the owner can accept later with guaranteed payment.

- Buyer calls `makeOffer(tokenId, expiry)` with ETH.
- Contract stores the offer amount, bidder, token ID, and expiry.
- Buyer can call `cancelOffer(offerId)` and recover escrowed ETH.
- Token owner can call `acceptOffer(offerId)` before expiry.
- Settlement verifies the caller owns the token and the marketplace is approved to transfer it, transfers the NFT to the bidder, accrues 97.5% to seller and 2.5% to artist, clears the offer, and clears any seller listing for that token.
- Expired offers can be cancelled by the bidder. Optionally, anyone may call `sweepExpiredOffer(offerId)` only if funds are returned to the bidder and the caller receives no fee.

### Proceeds

Use pull payments:

- Seller proceeds and artist fees accrue in `pendingProceeds[address]`.
- Recipients call `withdrawProceeds()` to receive ETH.
- This avoids making sales fail because a seller or artist address rejects ETH.

## Minimal Contract Surface

Expected public/external functions:

- `constructor(address collection, address artistRecipient, uint16 artistFeeBps)`
- `createListing(uint256 tokenId, uint128 priceWei, uint64 expiry)`
- `cancelListing(uint256 tokenId)`
- `buy(uint256 tokenId)`
- `makeOffer(uint256 tokenId, uint64 expiry) payable returns (uint256 offerId)`
- `cancelOffer(uint256 offerId)`
- `acceptOffer(uint256 offerId)`
- `withdrawProceeds()`
- `pause()`
- `unpause()`
- `setArtistRecipient(address newRecipient)` if the artist payout wallet can rotate

Expected views:

- `getListing(uint256 tokenId)`
- `getOffer(uint256 offerId)`
- `pendingProceeds(address account)`
- `collection()`
- `artistRecipient()`
- `artistFeeBps()`

Recommended constants and constraints:

- `artistFeeBps = 250`
- `MAX_FEE_BPS = 250`, or make the fee immutable at 250 bps
- `BPS_DENOMINATOR = 10_000`
- Reject zero prices, zero-value offers, expired listing/offer creation, zero payout recipient, and listings/offers for non-existent tokens if the collection exposes existence safely.

## State Transition Table

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `createListing(tokenId, price, expiry)` | Current NFT owner | They want to advertise a sellable fixed price | No listing exists |
| `cancelListing(tokenId)` | Listed seller | They want to remove their ask | Listing remains until expiry or invalidated by ownership/approval changes |
| `buy(tokenId)` | Buyer | They receive the NFT | Listing stays active until cancelled, expired, bought, or invalidated |
| `makeOffer(tokenId, expiry)` | Bidder | They want the owner to accept their funded bid | No offer exists |
| `cancelOffer(offerId)` | Bidder | They recover escrowed ETH | Offer remains acceptable until expiry |
| `acceptOffer(offerId)` | Current NFT owner | They receive sale proceeds | Offer remains until accepted, cancelled, or expired |
| `withdrawProceeds()` | Seller or artist recipient | They receive accrued ETH | Funds remain claimable in the contract |
| `pause()` | Contract owner multisig | Emergency response | Marketplace remains live |
| `unpause()` | Contract owner multisig | Resume after incident | Marketplace remains paused |
| `setArtistRecipient(newRecipient)` | Contract owner multisig | Rotate compromised or outdated payout wallet | Existing recipient keeps receiving future fees |

## Four-Week Build Plan

### Week 1: Specification and Contract Skeleton

Deliverables:

- Final marketplace specification with confirmed collection address, artist payout wallet, admin multisig address, and fee immutability decision.
- Solidity project scaffold using Foundry.
- `CollectionMarketplace` skeleton with listings, offers, proceeds accounting, events, and custom errors.
- Fork test setup against Ethereum mainnet using the real collection contract.
- UI wireframes for browse, token detail, list, buy, offer, accept offer, cancel, and withdraw flows.

Engineering tasks:

- Confirm whether the existing collection implements standard `ownerOf`, `getApproved`, `isApprovedForAll`, and `transferFrom` behavior.
- Decide whether listing and offer expiries are required in the UI. The contract should support them even if the UI defaults to 30 days.
- Decide whether multiple offers per token are allowed. MVP recommendation: yes, one offer ID per bidder action, because it avoids complex replacement rules.
- Define event schema for the indexer.

Exit criteria:

- Written spec reviewed by engineering, product, and artist/business owner.
- Contract API frozen enough for auditor quoting.
- Mainnet fork can read ownership and approvals for real token IDs.

### Week 2: Contract Implementation and Tests

Deliverables:

- Complete Solidity implementation.
- Unit tests for every state transition.
- Mainnet fork tests against the real collection.
- Gas snapshots for core actions.
- Deployment script for Sepolia or local fork dry run.

Engineering tasks:

- Implement listing lifecycle.
- Implement funded offers and cancellation.
- Implement sale settlement, royalty calculation, listing/offer cleanup, and proceeds withdrawal.
- Implement pause/unpause and owner handoff to multisig.
- Add reentrancy protection around ETH and NFT transfer flows.
- Add event assertions and fuzz tests for fee math and invalid state transitions.

Exit criteria:

- All tests pass locally.
- Fork tests prove the marketplace can transfer a real collection token when approval is granted.
- Gas report is available for auditor context.

### Week 3: Website, Indexing, and Testnet Rehearsal

Deliverables:

- First-party marketplace UI connected to wallet.
- Event indexer or hosted indexing service for active listings, offers, sales, and cancellations.
- Token detail page with buy, list, cancel listing, make offer, accept offer, cancel offer, and withdraw actions.
- Testnet or local-fork demo environment.
- Draft README deployment runbook.

Engineering tasks:

- Build UI around direct contract writes and indexed reads.
- Display listing validity from current owner, approval, expiry, and listing state.
- Display offer validity from expiry, escrow state, and current token owner.
- Add transaction simulations where available.
- Add clear ETH value previews: buyer total, artist fee, seller proceeds.
- Run an end-to-end rehearsal: list, buy, withdraw; make offer, accept, withdraw; cancel listing; cancel offer.

Exit criteria:

- Non-engineering stakeholders can complete all MVP flows in a rehearsal.
- Indexer recovers cleanly from a fresh event replay.
- README has executable deploy and verification commands in draft form.

### Week 4: Audit Prep, Fixes, and Mainnet Launch Readiness

Deliverables:

- Audit package sent to auditor.
- Auditor Q&A and fix window.
- Final deployment runbook.
- Mainnet deployment dry run on a fork.
- Launch checklist and rollback/emergency procedure.

Engineering tasks:

- Freeze audited commit before review begins.
- Prepare scope document, architecture notes, invariants, known risks, and test instructions.
- Triage audit findings and patch only scoped issues.
- Re-run all tests, fork tests, gas snapshots, static analysis, and end-to-end UI rehearsals.
- Deploy to Ethereum mainnet, verify source, transfer ownership to multisig, and execute a small live transaction path.

Exit criteria:

- Auditor signs off or all accepted risks are documented.
- Contract is verified on Etherscan.
- Ownership is held by the intended multisig.
- Website points to the verified mainnet contract.
- A real low-risk listing or offer path has been tested post-deploy.

## Deployment Runbook Requirements

The implementation README should include exact commands and values for:

- Required environment variables: `MAINNET_RPC_URL`, `SEPOLIA_RPC_URL` if used, `PRIVATE_KEY` or hardware-wallet signer config, `ETHERSCAN_API_KEY`, `COLLECTION_ADDRESS`, `ARTIST_RECIPIENT`, `OWNER_MULTISIG`.
- Build command.
- Test command.
- Mainnet fork test command.
- Static analysis command.
- Deploy command.
- Etherscan verification command.
- Ownership transfer command.
- Post-deploy checks:
  - Verify `collection`.
  - Verify `artistRecipient`.
  - Verify `artistFeeBps == 250`.
  - Verify owner is the multisig.
  - Create and cancel a small listing from a holder-controlled wallet.
  - Make and cancel a small offer.
  - Confirm events are indexed by the site.

## Audit Scope

### Code in Scope

Smart contracts:

- `src/CollectionMarketplace.sol`
- Any local interfaces used by the marketplace, such as `src/interfaces/IERC721.sol` if not imported directly from OpenZeppelin.
- Any local libraries used for fee math or storage helpers.

Deployment and configuration:

- `script/DeployCollectionMarketplace.s.sol`
- Constructor arguments and mainnet deployment configuration.
- Ownership transfer to the production multisig.
- Etherscan verification procedure.

Tests and specs for auditor context:

- Unit tests under `test/CollectionMarketplace.t.sol`.
- Mainnet fork tests under `test/fork/CollectionMarketplaceFork.t.sol`.
- Gas report for core actions.
- README deployment runbook.
- This plan and the final product spec.

Estimated contract footprint for quote:

- One non-upgradeable Solidity contract.
- Approximately 300-600 lines of custom Solidity, excluding imported OpenZeppelin code and tests.
- No custom ERC-721 implementation.
- No proxy.
- No signature-based orders in MVP.
- No ERC-20 or WETH offer path in MVP.

### Code Out of Scope

- The already deployed 2024 ERC-721 collection contract, except for interface assumptions needed by marketplace integration.
- Token metadata, image hosting, and collection website content.
- Offchain indexer correctness beyond whether contract events are sufficient and unambiguous.
- Frontend rendering, wallet UX, and search/filter logic, except for transaction construction examples if the auditor offers integration review.
- Discord workflows.
- Tax, legal, sanctions, and marketplace regulatory review.

### Security Properties to Review

The audit should determine whether:

- A listed NFT can only be sold by its current owner.
- A sale cannot settle after listing expiry.
- A sale cannot settle if the owner has transferred the NFT or revoked marketplace approval.
- A seller can cancel their listing.
- A buyer cannot buy without paying the exact required ETH.
- Artist fee is exactly 2.5% of sale price, subject only to integer rounding rules documented in code.
- Seller proceeds plus artist fee never exceed sale price.
- ETH cannot become permanently stuck except by a recipient not calling `withdrawProceeds`.
- Proceeds are credited to the correct seller and artist recipient.
- Reentrancy cannot duplicate proceeds, steal escrow, or corrupt listing/offer state.
- Failed ETH withdrawals do not corrupt accounting.
- Offers are fully funded before creation.
- Only the bidder can cancel an active offer.
- Only the current NFT owner can accept an active offer.
- Expired or cancelled offers cannot be accepted.
- Accepting an offer transfers the NFT to the correct bidder.
- Accepting an offer clears any active listing for the token.
- Cancelling an offer returns the escrowed ETH to the bidder or credits it for withdrawal in a failure-safe way.
- Pausing blocks sale settlement, offer acceptance, new listings, and new offers, while still allowing cancellations and withdrawals.
- Admin functions cannot change the artist fee above 2.5%; ideally the fee is immutable.
- Artist recipient rotation cannot redirect already accrued proceeds unless explicitly intended and documented.
- Events contain enough information for the site to reconstruct active listings, active offers, sales, cancellations, and withdrawals.

### Invariants to Provide to Auditor

- For every completed sale: `artistFee + sellerProceeds == salePrice`.
- For every completed sale: `artistFee == floor(salePrice * 250 / 10_000)` unless a different rounding rule is documented.
- Marketplace ETH balance equals total outstanding offer escrow plus total pending proceeds, excluding forced ETH transfers.
- A listing is buyable only when stored listing exists, price is nonzero, not expired, seller is current owner, and marketplace is approved.
- An offer is acceptable only when stored offer exists, amount is nonzero, not expired, bidder has not cancelled, caller is current owner, and marketplace is approved.
- A cancelled listing cannot be bought.
- A cancelled or expired offer cannot be accepted.
- Withdrawals reduce pending proceeds before making the external call.

### Threat Model

Actors:

- Honest seller.
- Honest buyer.
- Malicious seller who lists then transfers away, revokes approval, tries to sell twice, or uses a reverting contract wallet.
- Malicious buyer who creates, cancels, expires, or attempts to reuse offers.
- Malicious NFT receiver contract attempting reentrancy.
- Compromised frontend or stale indexer showing invalid listings.
- Compromised admin key before ownership is transferred to multisig.
- Artist recipient wallet rotation scenario.

Primary assets:

- NFTs held by collection owners.
- Buyer ETH used for purchases and offers.
- Seller proceeds.
- Artist resale fees.
- Correct marketplace event history.

### Audit Questions

Ask the auditor to specifically answer:

- Is the no-NFT-escrow listing model implemented safely against stale ownership and approval state?
- Is the funded-offer escrow accounting sound?
- Are sale and offer settlement flows safe under ERC-721 receiver hooks and ETH recipient behavior?
- Are fee rounding and proceeds accounting correct for all sale prices?
- Can any party grief another by creating unfulfillable listings or offers beyond expected stale UI cases?
- Are pause and admin powers minimal and clearly bounded?
- Are emitted events sufficient for an offchain indexer to reconstruct marketplace state without trusting the frontend?
- Are there any integration risks with the existing collection contract's actual mainnet behavior?

### Audit Deliverables Requested

- Findings with severity, exploit scenario, affected code, and recommended fix.
- Review of patched commit after fixes.
- Confirmation of exact commit hash reviewed.
- Confirmation of Solidity compiler version and optimizer settings reviewed.
- Confirmation of deployment constructor arguments reviewed.
- Explicit list of accepted risks or unresolved informational findings.

## Pre-Launch Checklist

- Contract implementation matches this scope; any signature orders, WETH offers, auctions, bundles, collection bids, private listings, upgradeability, or fee changes are deferred until after MVP.
- Test suite passes, including mainnet fork integration with the real collection.
- Static analysis has no unresolved high or medium findings.
- Audit complete and fixes merged.
- Deployment commit tagged.
- Contract verified on Etherscan.
- Owner is production multisig.
- Artist recipient is correct.
- Site reads from verified mainnet contract.
- Emergency pause procedure tested by multisig signers.
- Support team has a short runbook for stale listings, revoked approvals, cancelled offers, failed withdrawals, and transaction troubleshooting.
