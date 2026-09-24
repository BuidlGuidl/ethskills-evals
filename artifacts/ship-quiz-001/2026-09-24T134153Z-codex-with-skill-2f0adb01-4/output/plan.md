# Four-week MVP plan and audit scope

## Product and architecture assumptions

- Chain: Ethereum mainnet, because the collection already exists there.
- Collection: existing 5,000-piece ERC-721 contract minted in 2024. The marketplace will not change the NFT contract.
- Marketplace: one new Solidity contract for non-custodial fixed-price listings and buyer offers.
- Currency for MVP: ETH only. ERC-20/WETH support can follow later.
- Royalty: 2.5% of every successful resale paid to the artist recipient.
- Custody model:
  - Listed NFTs stay in the seller's wallet until purchase.
  - A seller must approve the marketplace before a purchase can settle.
  - Buyer offers escrow ETH in the marketplace until accepted, canceled, expired, or withdrawn.
- Stale listing policy: if a listed NFT leaves the seller's wallet, purchase must fail while the seller is not the owner. If the same seller later receives the NFT back before listing expiry, the MVP should either intentionally keep that listing valid or require an explicit relist nonce that invalidates old listings. Choose and document this before audit.
- Frontend/backend split:
  - Onchain: listing state, offer state, sale settlement, royalty accounting, cancellation, withdrawals.
  - Offchain: browsing, search, Discord migration messaging, indexing events, token metadata display, analytics.

Recommended contract shape: `CollectionMarketplace.sol`, using OpenZeppelin `IERC721`, `ReentrancyGuard`, `Ownable2Step` or `AccessControl`, and `Pausable` if the team wants an emergency stop. Avoid upgradeability for the MVP unless there is a strong operational reason; an immutable contract is easier to audit and quote.

## Core flows

1. Seller lists an NFT.
   - Seller calls `createListing(tokenId, price, expiry)`.
   - Contract verifies `msg.sender` currently owns `tokenId`.
   - NFT remains in seller wallet.
   - Frontend guides seller through `approve(tokenId)` or `setApprovalForAll(marketplace, true)` if needed.

2. Seller cancels a listing.
   - Seller calls `cancelListing(tokenId)` or `cancelListing(listingId)`.
   - Listing becomes unbuyable.

3. Buyer purchases a listed NFT.
   - Buyer calls `buy(tokenId)` with exact ETH.
   - Contract rechecks seller still owns the NFT and marketplace is still approved.
   - Contract calculates 2.5% artist royalty and 97.5% seller proceeds.
   - Contract transfers the NFT from seller to buyer.
   - Contract credits ETH balances for artist and seller, then they withdraw. Pull payments reduce failed-transfer and reentrancy risk.
   - Contract emits a sale event.

4. Buyer makes an offer.
   - Buyer calls `createOffer(tokenId, expiry)` with ETH.
   - ETH is escrowed by the marketplace.
   - Buyer can cancel before acceptance.
   - Expired offers cannot be accepted and can be withdrawn/canceled.

5. Owner accepts an offer.
   - Current owner calls `acceptOffer(offerId)` after approving the marketplace.
   - Contract verifies ownership, approval, offer amount, and expiry.
   - Contract transfers NFT to offer maker.
   - Contract credits 2.5% to artist and 97.5% to seller.
   - Contract emits a sale event.

## Four-week MVP plan

### Week 1: architecture, contract implementation, and local tests

- Freeze MVP decisions: ETH-only, one existing ERC-721 collection address, one artist royalty recipient, 250 bps royalty, no upgrade proxy unless explicitly required.
- Freeze stale listing behavior for NFTs transferred outside the marketplace, including whether returning to the original seller revives the old listing or requires a fresh listing.
- Define final contract API:
  - `createListing(uint256 tokenId, uint256 price, uint64 expiry)`
  - `cancelListing(uint256 tokenId)` or `cancelListing(bytes32 listingId)`
  - `buy(uint256 tokenId)`
  - `createOffer(uint256 tokenId, uint64 expiry) payable`
  - `cancelOffer(bytes32 offerId)`
  - `acceptOffer(bytes32 offerId)`
  - `withdrawProceeds()`
  - read helpers for listing, offer, proceeds, royalty recipient, royalty bps
- Implement events for every user-visible state transition:
  - `ListingCreated`
  - `ListingCanceled`
  - `Sale`
  - `OfferCreated`
  - `OfferCanceled`
  - `OfferAccepted`
  - `ProceedsWithdrawn`
- Implement Foundry or Hardhat unit tests for happy paths and basic failures.
- Add a mainnet-fork test against the deployed 2024 collection address.
- Decide indexing approach: marketplace events consumed by The Graph, Reservoir-style indexer, or a small custom backend.

### Week 2: edge cases, frontend, and indexing

- Expand contract tests:
  - seller no longer owns NFT at purchase time
  - approval revoked before purchase or offer acceptance
  - stale listing after transfer
  - expired listing or offer
  - zero price, zero expiry, malformed values
  - self-purchase and seller accepting own offer, either blocked or intentionally allowed and tested
  - multiple offers on same token
  - overpayment and underpayment behavior
  - withdrawal failures and reentrancy attempts
- Add fuzz tests for price, royalty calculation, expiry, listing overwrite/cancel/relist, and offer lifecycle.
- Build frontend pages:
  - collection grid with listed/unlisted status
  - token detail page with current owner, listing, offers, buy/list/cancel/offer/accept actions
  - wallet activity and withdrawable proceeds
- Implement transaction UX:
  - network check for Ethereum mainnet
  - approval step before list/sell acceptance
  - execute transaction step
  - pending, confirmed, failed, and user-rejected states
- Start offchain event indexer and metadata ingestion.

### Week 3: testnet/mainnet-fork QA, audit package, and operational readiness

- Run full local test suite, fuzz suite, static analysis, and gas snapshots.
- Run mainnet-fork scenario tests with real collection ownership/approval behavior.
- Deploy to Sepolia only if a representative test NFT exists there; otherwise rely on local/fork testing for the actual collection integration.
- Prepare audit package:
  - contract source
  - exact commit hash
  - deployment assumptions
  - invariants
  - test instructions
  - known tradeoffs and excluded features
- Perform an internal security review before sending to auditor.
- Prepare production operations:
  - artist royalty recipient wallet, preferably multisig or artist-controlled safe
  - owner/admin wallet, preferably multisig
  - pause policy if `Pausable` is included
  - incident communication plan
  - contract verification script

### Week 4: audit response, launch polish, and production deployment

- Reserve this week for auditor questions and fixes. Do not plan major feature work during audit response.
- Triage findings:
  - critical/high: fix and retest before launch
  - medium: fix or document explicit acceptance
  - low/informational: batch where low risk
- Re-run full test suite, fuzz suite, static analysis, and mainnet-fork scenarios after every security-relevant change.
- Deploy marketplace to Ethereum mainnet.
- Verify source on Etherscan.
- Transfer admin ownership to multisig if the contract has admin controls.
- Run post-deploy checks:
  - read configuration
  - create/cancel a small listing with a team-held NFT if available
  - create/cancel a small offer
  - verify events index into the frontend
  - verify withdrawals
- Launch site with clear Discord migration instructions.

## Precise audit scope

### In scope

The auditor should quote review for one Solidity marketplace contract and its tests:

- `CollectionMarketplace.sol`
  - Non-custodial ETH fixed-price listings for one existing ERC-721 collection.
  - ETH offers escrowed in the marketplace.
  - Offer acceptance by current token owner.
  - 2.5% artist royalty calculation and accounting.
  - Seller proceeds accounting.
  - Withdrawal logic.
  - Listing/offer cancellation and expiry.
  - Admin configuration, if any.
  - Emergency pause behavior, if included.
- Deployment scripts and constructor arguments.
- Test suite, including unit, fuzz, and mainnet-fork tests.
- Frontend contract interaction assumptions only where they affect security, such as approval flow, payable value, chain ID, and displayed recipient/price.

### Expected contract state

- Immutable or constructor-set NFT collection address.
- Artist royalty recipient address.
- Royalty basis points fixed at `250`, or admin-set with a hard cap if configurability is required.
- Listing records keyed by `tokenId` or listing id, containing seller, price, expiry, and active/canceled state.
- Offer records keyed by offer id, containing buyer, tokenId, amount, expiry, and active/canceled/accepted state.
- Pull-payment balances for sellers, artist, and offer refunds where applicable.

### Functions to review

- Constructor and configuration functions.
- `createListing`
- `cancelListing`
- `buy`
- `createOffer`
- `cancelOffer`
- `acceptOffer`
- `withdrawProceeds`
- `pause` and `unpause`, if included.
- Any read helpers used by the frontend.
- `receive`/`fallback`, if present.

### Security properties and invariants

The auditor should verify at minimum:

- A sale cannot complete unless the seller/current owner owns the NFT at settlement time.
- A sale cannot complete unless the marketplace is approved to transfer the NFT at settlement time.
- NFTs are never escrowed by listing logic.
- A canceled or expired listing cannot be purchased.
- A canceled, accepted, refunded, or expired offer cannot be accepted.
- Offer ETH cannot be withdrawn twice.
- Offer ETH cannot be trapped permanently except by an explicit, documented user choice.
- Buyer payment is conserved: sale price equals artist credit plus seller credit, with defined rounding behavior.
- Artist receives exactly 250 bps of every successful resale, subject only to documented integer rounding.
- Seller receives the remaining proceeds.
- No user can redirect another user's proceeds or refund.
- A buyer cannot force purchase at an old price after seller cancels, relists, loses ownership, or revokes approval. If a seller regains ownership before expiry, the chosen stale listing policy is enforced exactly as documented.
- A seller cannot accept an offer without transferring the NFT to the offer maker.
- Reentrancy cannot drain ETH, reuse an offer/listing, or corrupt accounting.
- External calls to the ERC-721 collection cannot leave funds or state inconsistent.
- Admin powers cannot seize user funds, redirect historical proceeds, or change sale economics beyond documented limits.
- Pausing, if included, stops new buys and offer acceptances while preserving cancellation and withdrawal paths.
- Events accurately represent state changes for the indexer.

### Edge cases to include in audit review

- Royalty rounding on very small prices.
- Exact payment vs overpayment behavior in `buy`.
- Listing replacement or relisting behavior.
- Transfer of listed NFT outside the marketplace.
- Approval revocation after listing or before accepting an offer.
- Owner changes between offer creation and acceptance.
- Multiple offers for the same token.
- Seller accepting an offer after also creating a listing.
- Buyer canceling offer near the same block as owner acceptance.
- Expiry timestamp boundaries.
- Contract wallet sellers, buyers, and royalty recipient.
- ERC-721 receiver behavior if buyer is a contract.
- Failed ETH withdrawal recipient behavior.
- Self-listing, self-buying, and self-offers.
- Forced ETH sent to the contract via `selfdestruct` or direct transfer if `receive` exists.

### Out of scope

- Changes to the existing 2024 NFT collection contract.
- ERC-20, WETH, USDC, credit card, or cross-chain payments.
- Auctions, bundles, collection-wide offers, trait offers, floor sweeping, royalties beyond the fixed 2.5% artist cut, and protocol fees.
- Upgradeable proxy review, unless the implementation chooses upgradeability.
- Custodial NFT escrow listings.
- Offchain metadata correctness, image hosting, CDN behavior, Discord moderation, and user identity.
- Frontend styling and general UX, except where UI assumptions could cause unsafe transactions.
- Backend/indexer availability, except event completeness and consistency needed for indexing.

### Audit deliverables requested

- Findings with severity, affected file/function, exploit scenario, and recommended fix.
- Confirmation of whether listed invariants hold.
- Review of tests with missing test recommendations.
- Gas or DoS concerns that could make common flows unusable on Ethereum mainnet.
- Review of deployment parameters and post-deploy ownership/admin state.
- Final fixed-commit review after remediation.

## Pre-audit materials to give the auditor

- Repository URL and frozen commit hash.
- Existing NFT collection mainnet address.
- Marketplace deployment chain: Ethereum mainnet.
- Artist royalty recipient address.
- Admin/multisig address.
- Solidity compiler version and optimizer settings.
- Dependency versions, especially OpenZeppelin.
- Test command, fuzz command, static analysis command, and mainnet-fork setup.
- Known limitations and all out-of-scope features from this document.
