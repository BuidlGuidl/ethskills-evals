# Four-Week MVP Plan and Audit Scope

## Product Goal

Move secondary trading for the existing 5,000-piece Ethereum mainnet NFT collection out of Discord and onto our own site.

The MVP supports:

- Non-custodial fixed-price listings: owners keep NFTs in their wallets while listed.
- Direct buys in ETH.
- Seller cancellation.
- Buyer offers in ETH that an owner can accept later.
- A 2.5% artist resale fee on every sale settled through this marketplace.

The MVP does not attempt to enforce royalties on sales that happen outside this marketplace.

## Launch Chain

Target chain: Ethereum mainnet.

Reason: the collection already exists on Ethereum mainnet, so the MVP should meet holders where their NFTs already live. Moving to an L2 would require bridging, wrapping, or a second collection representation and would add scope that does not solve the immediate Discord-trading problem.

## Onchain and Offchain Boundary

Onchain:

- Listing creation, cancellation, and purchase settlement.
- Offer creation, cancellation/refund, expiration handling, and owner acceptance.
- NFT ownership and approval checks against the existing ERC-721 collection.
- ETH accounting for sellers, buyers, and the artist fee.
- Events needed by the site/indexer to reconstruct listings, offers, and sales.

Offchain:

- Website UI.
- Token images, metadata display, trait filters, search, sorting, activity feeds, and profiles.
- Listing and offer discovery/indexing from contract events.
- Discord announcements, email notifications, analytics, and admin dashboards.
- Any ranking, trending, or floor-price calculations.

## Contract Architecture

Use one custom contract: `CollectionMarketplace`.

Use OpenZeppelin primitives where applicable:

- `IERC721`
- `ReentrancyGuard`
- `Address` or safe ETH-send helper if needed

No escrow contract, factory, router, fee-splitter, upgrade proxy, or custom NFT contract is needed for the MVP.

Core constants/configuration:

- `collection`: immutable address of the existing ERC-721 collection.
- `artistRecipient`: immutable payout address controlled by the artist or artist multisig.
- `artistFeeBps`: immutable `250`.
- `BPS_DENOMINATOR`: `10_000`.

Recommended payout model:

- Use pull payments.
- On a sale, record claimable ETH balances for the seller and artist.
- Recipients withdraw their balances with `withdraw()`.
- This avoids sale settlement depending on whether a recipient address can receive ETH.

## Marketplace Behavior

### Listings

A seller can list a token only if they currently own it and have approved the marketplace for that token or for all tokens in the collection.

Listing fields:

- `seller`
- `price`
- `expiration`

Rules:

- `price > 0`.
- `expiration` must be in the future.
- The NFT remains in the seller's wallet.
- A listing becomes unbuyable if the seller no longer owns the NFT or approval is removed.
- The seller can cancel the listing.
- The current owner may overwrite an existing stale listing by creating a new listing.

Buying:

- Buyer sends exactly the listing price in ETH.
- Contract verifies listing is active, not expired, seller still owns the NFT, and marketplace is approved.
- Contract deletes the listing before external calls.
- Contract transfers the NFT from seller to buyer.
- Contract credits 97.5% of the price to the seller and 2.5% to the artist.
- Contract emits a sale event.

### Offers

Because an owner accepts an offer later, the MVP should escrow the buyer's ETH offer amount in the marketplace contract. NFTs are never escrowed.

Offer fields:

- `offerer`
- `tokenId`
- `amount`
- `expiration`

Rules:

- `amount > 0`.
- `expiration` must be in the future.
- One active offer per `tokenId` and offerer.
- The offerer can cancel before acceptance.
- The offerer can reclaim an expired offer.
- The current NFT owner can accept an active, unexpired offer if the marketplace is approved to transfer the NFT.

Accepting:

- Contract verifies the offer exists, is unexpired, and the caller is the current owner.
- Contract verifies the marketplace is approved for the NFT.
- Contract deletes the offer before external calls.
- Contract transfers the NFT from owner to offerer.
- Contract credits 97.5% of the offer amount to the owner and 2.5% to the artist.
- Contract emits a sale event.

## State Transition Table

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `createListing(tokenId, price, expiration)` | NFT owner | They want to advertise a sellable price on the site | No listing exists |
| `cancelListing(tokenId)` | Listing seller, or current owner for stale listing cleanup | They want to remove the listed sale path | Listing remains visible until expired or invalidated by ownership/approval checks |
| `buy(tokenId)` | Buyer | They receive the NFT at the listed price | Listing remains active until canceled, expired, or invalidated |
| `placeOffer(tokenId, expiration)` payable | Buyer/offerer | They want the owner to be able to accept their funded offer | No offer exists |
| `cancelOffer(tokenId)` | Offerer | They recover escrowed ETH before acceptance | Offer remains acceptable until expiration |
| `reclaimExpiredOffer(tokenId)` | Offerer | They recover escrowed ETH after expiration | ETH remains claimable in the contract |
| `acceptOffer(tokenId, offerer)` | Current NFT owner | They receive the sale proceeds for accepting the offer | Offer remains until canceled, reclaimed after expiration, or accepted |
| `withdraw()` | Seller, artist, or refunded account | They receive claimable ETH | Funds remain safely claimable |

## Four-Week MVP Plan

### Week 1: Protocol Design and Contract Skeleton

Deliverables:

- Finalize contract interface and storage layout.
- Confirm the existing ERC-721 collection address and artist payout address.
- Confirm whether the artist payout address is a multisig; use a multisig before mainnet launch.
- Implement `CollectionMarketplace` with immutable collection, artist recipient, and 250 bps fee.
- Implement listing functions, offer functions, pull-payment withdrawals, and events.
- Add input validation and custom errors.

Engineering notes:

- Do not add upgradeability for the MVP.
- Do not support ERC-20, WETH, bundles, auctions, private listings, partial fills, criteria offers, or collection-wide offers.
- Keep all prices denominated in native ETH.

### Week 2: Tests, Fork Checks, and Indexing

Deliverables:

- Unit tests for listings, buys, cancellations, offers, acceptances, expirations, withdrawals, and fee splits.
- Invariant/property tests for ETH accounting and sale fee correctness.
- Ethereum mainnet fork tests against the deployed NFT collection.
- Event schema for the site/indexer.
- Basic indexer or backend job that reconstructs active listings and offers from events plus live ownership/approval checks.

Required test cases:

- Seller cannot list a token they do not own.
- Buyer cannot buy an expired listing.
- Buyer cannot buy if seller transferred the NFT away.
- Buyer cannot buy if marketplace approval was revoked.
- Sale credits exactly 2.5% to artist and 97.5% to seller, including rounding behavior.
- Offerer can cancel and recover ETH.
- Expired offer cannot be accepted.
- Owner cannot accept an offer after transferring the NFT away.
- Reentrancy attempts cannot drain funds or double-fill a listing/offer.
- Pull-payment withdrawals cannot lose funds if a recipient reverts.

### Week 3: Website MVP and Wallet Flow

Deliverables:

- Browse page for collection tokens with active listing and offer state.
- Token detail page with buy, list, cancel listing, make offer, cancel offer, accept offer, and withdraw actions.
- Wallet connection and network guard for Ethereum mainnet.
- Approval flow for sellers before listing or accepting an offer.
- Clear transaction states: awaiting wallet, pending, confirmed, failed.
- Display artist fee and seller proceeds before listing acceptance or offer acceptance.
- Basic operational monitoring for failed indexing, contract events, and stuck withdrawals.

UX constraints:

- The site must not imply a listing is guaranteed buyable without checking current owner, approval, price, and expiration.
- Offer balances must be shown as escrowed ETH with cancellation/reclaim paths.
- The site should hide or label stale listings and expired offers after indexer reconciliation.

### Week 4: Audit Prep, Audit, Fixes, and Mainnet Launch

Deliverables:

- Freeze contract code before sending to audit.
- Prepare audit packet with commit hash, deployment target, addresses, tests, and this scope.
- Auditor review of the contract and tests.
- Fix audit findings.
- Re-run full unit, invariant, and mainnet fork test suite.
- Deploy to Ethereum mainnet.
- Verify contract source.
- Run post-deploy smoke test with one low-value listing or internal test token if available.
- Transfer any contract ownership only if an ownership mechanism is added; otherwise document that the contract has no admin owner.

Launch runbook to include before deployment:

- Exact deploy command.
- Exact verification command.
- Required environment variables.
- Collection address.
- Artist recipient address.
- Deployer address.
- Expected constructor arguments.
- Post-deploy smoke-test transaction sequence.

## Precise Audit Scope

### In Scope

One Solidity contract:

- `CollectionMarketplace.sol`

Expected external/public functions:

- `createListing(uint256 tokenId, uint256 price, uint64 expiration)`
- `cancelListing(uint256 tokenId)`
- `buy(uint256 tokenId)` payable
- `placeOffer(uint256 tokenId, uint64 expiration)` payable
- `cancelOffer(uint256 tokenId)`
- `reclaimExpiredOffer(uint256 tokenId)`
- `acceptOffer(uint256 tokenId, address offerer)`
- `withdraw()`
- Public getters for listings, offers, pending balances, collection address, artist recipient, and artist fee bps.

Expected events:

- `ListingCreated`
- `ListingCanceled`
- `ListingFilled`
- `OfferCreated`
- `OfferCanceled`
- `OfferReclaimed`
- `OfferAccepted`
- `Withdrawal`

External dependencies:

- OpenZeppelin contracts used by `CollectionMarketplace`.
- Existing deployed ERC-721 collection interface assumptions: `ownerOf`, `getApproved`, `isApprovedForAll`, and `safeTransferFrom` or `transferFrom`.

Audit review should cover:

- Correct enforcement of NFT ownership and marketplace approval.
- Non-custodial listing behavior: NFTs remain in owner wallets until sale settlement.
- Offer escrow accounting and refund paths.
- Artist fee calculation at exactly 250 bps.
- Rounding behavior and whether any dust remains.
- Pull-payment accounting and withdrawal safety.
- Reentrancy safety around NFT transfers and ETH withdrawals.
- Checks-effects-interactions ordering.
- Stale listing handling when ownership or approvals change.
- Expiration handling for listings and offers.
- Double-fill prevention for listings and offers.
- Event correctness for offchain indexing.
- Denial-of-service risks from recipients that cannot receive ETH.
- Behavior with malicious or non-standard ERC-721 receivers, while assuming the collection address itself is the real existing collection.
- Constructor validation for collection and artist recipient addresses.
- Gas griefing or storage growth issues within the MVP surface.

### Security Properties the Auditor Should Verify

- A sale cannot settle unless the seller/current owner owns the NFT at settlement time.
- A sale cannot settle unless the marketplace is approved to transfer the NFT at settlement time.
- A listing cannot be bought more than once.
- An offer cannot be accepted more than once.
- An offerer can always recover an unaccepted offer after canceling or after expiration.
- The contract never pays more ETH than it has received.
- For every completed sale, seller credit plus artist credit equals the sale price.
- For every completed sale, artist credit equals `salePrice * 250 / 10_000`.
- No user can withdraw another user's pending balance.
- Reentrancy cannot create duplicate payouts, duplicate NFT transfers, or stolen refunds.
- Revoking approval or transferring the NFT outside the marketplace safely invalidates settlement.

### Out of Scope

The audit quote should exclude:

- The existing NFT collection contract, except for interface assumptions needed by the marketplace.
- Website frontend code, wallet UI, and styling.
- Backend/indexer implementation, except for event assumptions documented in the contract.
- Token metadata, image hosting, search, filters, sorting, and activity feed calculations.
- Discord workflows and manual moderation.
- Sales outside this marketplace.
- ERC-20, WETH, credit card, fiat, cross-chain, or L2 payments.
- Auctions, bundles, collection-wide offers, private offers, trait offers, allowlists, royalties via EIP-2981, and creator-fee enforcement outside this contract.
- Upgradeability, governance, protocol fee switches, and admin rescue functions unless added later.

### Materials to Give the Auditor

- Repository URL and exact commit hash to audit.
- Solidity compiler version and optimizer settings.
- Full dependency lockfile.
- Contract deployment constructor arguments.
- Existing NFT collection address on Ethereum mainnet.
- Artist recipient address.
- Test suite instructions.
- Mainnet fork test instructions and RPC requirements.
- Gas report.
- This `plan.md`.

### Quote Assumptions

Auditor should quote for one custom, non-upgradeable Solidity marketplace contract with native ETH settlement, one existing ERC-721 integration, and no more than the public functions listed above.

Any later addition of ERC-20/WETH offers, Seaport integration, collection-wide offers, bundles, auctions, upgradeability, admin rescue powers, or a separate escrow/splitter contract should be treated as a scope change requiring a new quote.
