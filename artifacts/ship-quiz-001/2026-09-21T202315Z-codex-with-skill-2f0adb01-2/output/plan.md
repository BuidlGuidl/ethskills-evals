# Four-Week MVP Plan and Audit Scope

## Product Goal

Ship a first-party Ethereum mainnet marketplace for the existing 5,000-piece NFT collection. Holders can list tokens at fixed ETH prices without escrowing the NFT, buyers can purchase directly from the listing, buyers can make ETH offers that owners accept later, sellers can cancel listings, and the artist receives 2.5% of every completed resale.

## MVP Architecture

### Onchain

Build one non-upgradeable marketplace contract for the existing ERC-721 collection.

The NFT collection contract already exists and should not be replaced. The marketplace stores listings and offers, verifies ownership and approvals at execution time, transfers the NFT atomically during a sale or accepted offer, and accounts for a 2.5% artist royalty.

Recommended contract assumptions:

- `collection`: immutable address of the existing ERC-721 contract.
- `artistRecipient`: payable address controlled by an artist/team multisig.
- `royaltyBps`: immutable `250`, representing 2.5%.
- `feeDenominator`: `10000`.
- Sales currency: native ETH only for MVP.
- Listings: non-custodial. The NFT stays in the seller wallet until purchase.
- Offers: ETH is escrowed in the marketplace until accepted, canceled, replaced, or expired.
- Admin: only the minimal ability to update `artistRecipient`, if needed, controlled by a multisig. No admin ability to move NFTs, cancel user listings, seize offer funds, or change the royalty rate after deployment.

Expected external functions:

- `createListing(uint256 tokenId, uint256 price, uint64 expiry)`
- `cancelListing(uint256 tokenId)`
- `buy(uint256 tokenId)` payable
- `makeOffer(uint256 tokenId, uint64 expiry)` payable
- `cancelOffer(uint256 tokenId)`
- `acceptOffer(uint256 tokenId, address buyer)`
- `withdrawProceeds()`
- `setArtistRecipient(address payable newRecipient)`, if mutable recipient is required

Expected events:

- `ListingCreated(seller, tokenId, price, expiry)`
- `ListingCanceled(seller, tokenId)`
- `ListingFilled(seller, buyer, tokenId, price, royalty)`
- `OfferCreated(buyer, tokenId, amount, expiry)`
- `OfferCanceled(buyer, tokenId)`
- `OfferAccepted(seller, buyer, tokenId, amount, royalty)`
- `ProceedsWithdrawn(account, amount)`
- `ArtistRecipientUpdated(oldRecipient, newRecipient)`

Use pull payments for seller and artist proceeds. Settlement should update internal balances, transfer the NFT atomically, and allow each party to withdraw ETH separately. This reduces failed settlement risk when a seller or artist recipient is a contract wallet that cannot receive ETH directly.

### Offchain

Keep discovery and user experience offchain:

- Index marketplace events and collection ownership with a backend indexer, The Graph, or a lightweight event listener.
- Store no listing metadata offchain as the source of truth; read active listing and offer state from contract/indexed events.
- Cache NFT metadata and images from the existing collection metadata source.
- Frontend supports browsing, filtering, listing, canceling, buying, making offers, canceling offers, accepting offers, wallet connection, network switching, and transaction status.

### User Flows

Seller listing flow:

1. Holder connects wallet on Ethereum mainnet.
2. Site checks ownership and whether the marketplace is approved for that token or all tokens.
3. If not approved, holder approves the marketplace.
4. Holder creates a listing with price and optional expiry.
5. NFT remains in holder wallet.

Buyer purchase flow:

1. Buyer opens an active listing.
2. Contract verifies listing exists, not expired, seller still owns the NFT, marketplace is still approved, and `msg.value` equals the listed price.
3. Contract cancels/fills the listing, transfers the NFT from seller to buyer, credits 97.5% to seller proceeds, and credits 2.5% to artist proceeds.

Offer flow:

1. Buyer makes a token-specific ETH offer with amount and expiry.
2. ETH remains escrowed in the marketplace.
3. Buyer can cancel before acceptance.
4. Current owner accepts while they own the token and have approved the marketplace.
5. Contract transfers the NFT to the offer maker, credits 97.5% to seller proceeds, and credits 2.5% to artist proceeds.

## Four-Week MVP Build Plan

### Week 1: Architecture, Contract Spec, and Project Setup

Deliverables:

- Final marketplace spec covering listings, offers, expiry behavior, proceeds accounting, royalty math, admin constraints, and event schema.
- State transition worksheet for every external function: caller, incentive, state changes, failure behavior, and emitted events.
- Contract project scaffold with Foundry or Hardhat, OpenZeppelin dependencies, deployment scripts, and mainnet fork configuration.
- Frontend scaffold with wallet connection, Ethereum mainnet detection, collection config, and read-only collection browsing.
- Indexing approach selected: The Graph subgraph or backend event listener.

Acceptance criteria:

- Contract interface and event names are frozen for audit.
- Product team signs off on ETH-only settlement, token-specific offers, and escrowed offer funds.
- Artist recipient is confirmed as a multisig address before deployment.

### Week 2: Marketplace Contract and Tests

Deliverables:

- Marketplace contract implemented using OpenZeppelin `IERC721`, `ReentrancyGuard`, and `Ownable` or `AccessControl` only if needed.
- Listing lifecycle: create, update or replace, cancel, fill, expire.
- Offer lifecycle: create or replace, cancel, accept, expire.
- Pull-payment proceeds ledger and withdrawals.
- Deployment script and constructor config checks.
- Unit tests for every external function.
- Fuzz tests for royalty split math, listing/offer replacement, expiry, and invalid caller/value cases.
- Mainnet fork tests against the real 2024 collection contract address.

Acceptance criteria:

- `buy` and `acceptOffer` are atomic: either NFT transfer and proceeds accounting both happen, or everything reverts.
- Stale listings fail safely if the seller no longer owns the NFT or revoked approval.
- Expired listings/offers cannot be filled.
- No single EOA has privileged production ownership.

### Week 3: Frontend, Indexing, and Integration

Deliverables:

- Marketplace UI for browse, token detail, active listing, offer panel, owner actions, and buyer actions.
- Wallet transaction flow: switch network, approve NFT if needed, execute action, wait for confirmation, refresh state.
- Listing creation/cancel screens.
- Buy flow with exact ETH value handling and clear transaction states.
- Offer creation/cancel/accept screens.
- Event indexer or subgraph for listings, sales, offers, and proceeds.
- Error handling for revoked approvals, ownership changes, expired orders, insufficient funds, rejected transactions, and wrong network.

Acceptance criteria:

- A user can complete listing, buying, offer, cancel, and accept-offer flows on a test deployment.
- UI never shows an offchain listing as fillable unless the contract/indexer says it is active.
- Token ownership, approval state, and offer/listing state refresh after every transaction.

### Week 4: Hardening, Audit Prep, Deployment Rehearsal, and Handoff

Deliverables:

- Full test pass, coverage report, fuzz run, static analysis with Slither, and mainnet fork regression suite.
- Internal security review fixes completed before external audit.
- Audit package prepared with commit hash, deployment parameters, architecture notes, invariants, known limitations, and test instructions.
- Testnet deployment and verified contract.
- Production deployment runbook: deploy, verify, transfer owner/admin to multisig, configure frontend, smoke test, monitor.
- Monitoring dashboard for sales, failed transactions, offer volume, proceeds balances, and withdrawals.
- Incident response notes: contact path, frontend disable switch, public comms template, and multisig signers.

Acceptance criteria:

- Auditor receives a frozen commit and no code churn during review except agreed fixes.
- Production launch is rehearsed end to end on testnet.
- Frontend can be deployed independently from the contract and can hide marketplace actions if an incident occurs.

## Precise Audit Scope

### Scope Summary

The audit should cover one new marketplace contract, its deployment script/configuration, and the tests that define intended behavior. The existing NFT collection contract is in dependency scope only: auditors should review how the marketplace calls it, but not audit the old collection implementation unless a separate quote is requested.

### In-Scope Contracts

- `Marketplace.sol`: listing, buying, offer escrow, offer acceptance, royalty split, proceeds accounting, withdrawals, events, admin recipient update.
- Any small supporting library written by the team for percentage math or order structs.
- Deployment script and constructor arguments for Ethereum mainnet.
- Ownership/admin transfer script to the production multisig.

If the implementation adds any of the following, include them in scope explicitly and update the quote:

- Upgradeable proxy contracts.
- ERC-20 or WETH support.
- Collection-wide offers.
- Offchain signed orders using EIP-712.
- Batch listing, batch buying, or batch offer acceptance.
- Marketplace fees in addition to artist royalty.
- Admin pause, emergency cancellation, or migration logic.

### Dependency Scope

Auditors should inspect integration assumptions for:

- The existing ERC-721 collection contract address and interface behavior.
- OpenZeppelin contracts used by the marketplace.
- The artist recipient multisig address.
- Ethereum mainnet deployment chain ID and constructor configuration.

Auditors do not need to re-audit OpenZeppelin internals or the pre-existing NFT collection unless the marketplace relies on non-standard collection behavior.

### Out of Scope

- The existing NFT minting contract's original mint logic, metadata, royalties, provenance, or owner permissions, except where those affect marketplace settlement.
- Frontend rendering bugs that do not affect transaction construction or user signing safety.
- Backend/indexer uptime, search quality, analytics, and metadata caching correctness.
- Discord moderation, private DM trades, and off-platform enforcement.
- Tax, securities, consumer protection, sanctions, or royalty enforceability legal review.
- Custody or security review of artist/team wallets beyond confirming multisig use and correct deployment ownership.

### Core Security Properties to Verify

The auditor should verify these invariants:

- A listed NFT never leaves the seller wallet until a successful `buy`.
- A buyer cannot buy an unlisted, canceled, expired, transferred, or unapproved token.
- A seller cannot receive proceeds unless the NFT transfer to the buyer succeeds.
- The artist receives exactly 2.5% of every completed listing sale and accepted offer, subject only to integer rounding rules documented in tests.
- Royalty rounding cannot overpay beyond the sale amount.
- No ETH can become permanently stuck except dust caused by explicit rounding behavior.
- Offer escrow can only be withdrawn by the offer maker through cancellation/replacement or spent through owner acceptance.
- An owner cannot accept an expired, canceled, replaced, or underfunded offer.
- A previous owner cannot accept offers after transferring the NFT away.
- A buyer cannot force-purchase an NFT after seller approval or ownership has changed in a way that invalidates the listing.
- Reentrancy cannot double-spend offers, double-withdraw proceeds, reuse listings, or corrupt accounting.
- Admin privileges cannot seize user NFTs, seize offer escrow, drain proceeds, change royalty rate, or redirect existing user proceeds.
- Events accurately represent state transitions for indexers.

### Function-Level Review Areas

`createListing`:

- Requires caller to own `tokenId`.
- Requires positive price.
- Handles replacement of an existing listing by the current owner.
- Defines expiry rules clearly, including whether `0` means no expiry.
- Does not require NFT transfer into escrow.
- Emits correct event.

`cancelListing`:

- Only current listing seller can cancel.
- Safe behavior if ownership changed after listing.
- Deletes listing state and emits correct event.

`buy`:

- Requires exact payment, active listing, valid expiry, current seller ownership, and marketplace approval.
- Deletes listing before external calls or otherwise prevents reentrancy.
- Transfers NFT atomically.
- Computes seller and artist shares correctly.
- Credits proceeds safely.
- Handles stale listing state and failed NFT transfer safely.

`makeOffer`:

- Requires positive ETH amount.
- Stores offer maker, amount, and expiry.
- Handles replacing an existing offer by the same buyer without trapping funds.
- Defines whether one buyer can have one active offer per token and how multiple buyers' offers coexist.
- Emits correct event.

`cancelOffer`:

- Only offer maker can cancel.
- Returns or credits escrow safely.
- Cannot be used to reenter and cancel/withdraw twice.
- Emits correct event.

`acceptOffer`:

- Requires caller to currently own `tokenId`.
- Requires active, unexpired offer.
- Requires marketplace approval for the NFT.
- Deletes or marks offer spent before external calls.
- Transfers NFT atomically to buyer.
- Credits seller and artist shares correctly.
- Handles simultaneous listing state consistently, such as canceling active listing on accepted offer.

`withdrawProceeds`:

- Uses checks-effects-interactions.
- Cannot withdraw more than credited balance.
- Handles failed ETH sends safely.
- Emits correct event.

`setArtistRecipient`, if present:

- Restricted to multisig-controlled owner/admin.
- Rejects zero address.
- Does not alter already accrued balances for the previous recipient unless intentionally specified and tested.
- Emits correct event.

### Economic and UX Risk Review

Auditors should evaluate:

- Royalty bypass risk: users can still transfer NFTs peer-to-peer outside the marketplace, so the 2.5% cut is guaranteed only for marketplace-settled resales.
- Stale approval risk: listings can appear active offchain while approval has been revoked; contract must reject safely and frontend/indexer should mark them stale.
- Offer escrow risk: buyers lock ETH until cancel, replacement, expiry withdrawal, or acceptance. Expiry must not trap funds.
- Gas griefing and denial-of-service scenarios involving many offers per token, if the design stores iterable offer arrays.
- Contract-wallet compatibility for sellers, buyers, and artist recipient.
- MEV/front-running risk around public offers and purchases, including whether this matters for fixed-price NFT sales.

### Required Audit Inputs

Provide the auditor:

- Frozen repository commit hash.
- Exact Solidity compiler version and optimizer settings.
- Complete list of in-scope files.
- Existing collection contract address on Ethereum mainnet.
- Artist recipient multisig address.
- Deployment chain ID: Ethereum mainnet, `1`.
- Constructor arguments.
- Test commands and expected passing output.
- Coverage report.
- Slither output.
- Mainnet fork test instructions and required RPC environment variables.
- Design notes for listing invalidation, offer escrow, expiry behavior, royalty rounding, and proceeds withdrawals.
- Known limitations and intentionally excluded features.

### Suggested Auditor Quote Format

Ask the auditor to quote separately for:

- Base review: one marketplace contract, deployment scripts, and tests.
- Optional frontend transaction-safety review: wallet actions, displayed price, recipient addresses, chain switching, and calldata construction.
- Optional existing collection compatibility review: confirm ERC-721 behavior, approval behavior, and any non-standard hooks.
- Optional post-fix review window after the team addresses findings.

### Audit Exit Criteria

The MVP is ready for production only when:

- All critical and high findings are fixed and re-reviewed.
- Medium findings are fixed or explicitly accepted with written rationale.
- Deployment bytecode matches the audited commit and compiler settings.
- Contract is verified on Etherscan.
- Admin ownership is transferred to the multisig.
- A small mainnet smoke test succeeds after deployment.
