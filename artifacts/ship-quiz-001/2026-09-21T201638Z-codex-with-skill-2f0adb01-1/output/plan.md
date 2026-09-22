# Four-Week MVP Plan and Audit Scope

## Product Goal

Move the collection's informal Discord resale flow onto the project's own site:

- Holders list an NFT at a fixed ETH price.
- Buyers purchase listed NFTs directly from the site.
- Owners keep custody of listed NFTs until a sale settles.
- Sellers can cancel listings.
- Buyers can make offers that owners accept later.
- The artist receives 2.5% of every sale completed through the marketplace.

Assumptions for the MVP:

- The NFT collection already exists as an ERC-721 contract on Ethereum mainnet.
- MVP supports only this one 5,000-piece collection.
- Prices and offers are denominated in ETH.
- Listings are non-custodial: the NFT remains in the seller's wallet until purchase.
- Offers escrow ETH in the marketplace contract until the offer is accepted, canceled, or expires.
- The artist payout address is controlled by a multisig before launch.
- The site is an interface to the marketplace, not the source of truth. Onchain events are the canonical marketplace record.

## MVP Architecture

### Onchain

Deploy one marketplace contract, tentatively `CollectionMarketplace.sol`.

The contract should:

- Store active fixed-price listings for the existing collection.
- Allow a token owner to create, update, and cancel a listing.
- Allow a buyer to purchase an active listing atomically.
- Re-check token ownership and marketplace approval at purchase time.
- Store escrowed ETH offers.
- Allow offer makers to cancel offers before acceptance.
- Allow the current token owner to accept a valid offer.
- Pay 2.5% of each sale to the artist recipient and the remaining 97.5% to the seller.
- Emit events for listing creation, listing cancellation, listing purchase, offer creation, offer cancellation, offer acceptance, and artist recipient updates.

The contract should not:

- Custody listed NFTs before purchase.
- Support multiple collections in the first version.
- Support ERC-20 bids, bundles, auctions, private sales, trait offers, floor offers, royalties beyond the fixed artist fee, or protocol fees.
- Depend on an offchain matching service for settlement.

Recommended core functions:

```solidity
list(uint256 tokenId, uint256 price, uint64 expiry)
updateListing(uint256 tokenId, uint256 newPrice, uint64 newExpiry)
cancelListing(uint256 tokenId)
buy(uint256 tokenId) payable
makeOffer(uint256 tokenId, uint64 expiry) payable returns (uint256 offerId)
cancelOffer(uint256 offerId)
acceptOffer(uint256 offerId)
setArtistRecipient(address newRecipient)
pause()
unpause()
```

The final function names can change, but these behaviors should be the audit boundary.

### Offchain

The frontend and indexing layer should:

- Read active listings and offers from marketplace events.
- Verify current ownership and approval status before showing an NFT as immediately buyable.
- Show clear states for unapproved listings, expired listings, stale offers, canceled offers, and ownership changes.
- Guide sellers through approval, listing, updating, and cancellation.
- Guide buyers through purchase, offer creation, and offer cancellation.
- Guide owners through accepting an offer.
- Display gross price, artist fee, and seller net proceeds before each transaction.

Use an indexer or event ingestion service for fast browsing, but treat the contract as canonical during execution. The UI must tolerate stale indexed data because ownership, approvals, and listings can change outside the site.

## Four-Week Build Plan

### Before Week 1: Auditor Quote Request

Send the "Precise Audit Scope" section of this document to auditors before implementation starts. The auditor can quote from the intended contract count, feature set, threat model, expected line count, and excluded work. The final audit commit and full evidence package will be delivered in Week 4, but the commercial quote should not wait for implementation.

### Week 1: Product, Contract Design, and Local Skeleton

Deliverables:

- Finalize MVP requirements and explicitly defer non-MVP marketplace features.
- Confirm the existing ERC-721 contract address, ABI behavior, and whether it uses standard `ownerOf`, `getApproved`, `isApprovedForAll`, and `safeTransferFrom`.
- Confirm the artist recipient multisig and whether the recipient can be changed after launch.
- Write the contract specification, including state variables, events, revert conditions, and fee math.
- Create the Solidity project using Foundry or the repo's chosen contract toolchain.
- Implement the first version of `CollectionMarketplace.sol`.
- Add unit tests for listing, buying, offer creation, offer cancellation, and offer acceptance.

Key decisions:

- Use a single immutable collection address.
- Use a fixed `250` basis point artist fee.
- Store listing seller, price, and expiry.
- Store offer maker, token ID, amount, and expiry.
- Delete listing or offer state before external calls where possible.
- Use OpenZeppelin `ReentrancyGuard`, `Pausable`, `Ownable2Step`, and standard ERC-721 interfaces.

Exit criteria:

- Local tests cover the happy path for listings and offers.
- Fee distribution is tested for at least one listing purchase and one accepted offer.
- Ownership and approval are checked at settlement, not only at listing time.

### Week 2: Contract Hardening and Indexable Events

Deliverables:

- Add negative-path tests for unauthorized listing, unauthorized cancellation, revoked approval, ownership transfer after listing, expired listings, underpayment, overpayment policy, zero price, zero recipient, and expired offers.
- Add reentrancy-focused tests using a malicious receiver or payout recipient where practical.
- Add fuzz tests for fee math and sale amounts.
- Add fork tests against Ethereum mainnet using the real collection contract.
- Run static analysis, at minimum Slither.
- Freeze the first audit-candidate contract interface.
- Define event schemas for the indexer and frontend.

Key decisions:

- Decide whether `buy` requires exact `msg.value == price` or refunds overpayment. Exact payment is simpler and preferred for MVP.
- Decide whether expired listings and offers remain in storage until canceled/overwritten or can be cleaned by anyone.
- Decide whether failed ETH payments revert the whole transaction. For MVP, reverting is acceptable, but the audit should review denial-of-service risk from recipients that cannot receive ETH.

Exit criteria:

- Contract behavior is stable enough for frontend integration.
- Tests document all expected revert cases.
- Mainnet fork tests prove compatibility with the live collection.

### Week 3: Frontend, Indexing, and Testnet Deployment

Deliverables:

- Build the marketplace UI for browsing, listing, buying, making offers, accepting offers, and canceling listings/offers.
- Implement wallet connection, network switching to Ethereum mainnet or testnet, transaction status, and error states.
- Build or configure event indexing for listing and offer activity.
- Deploy the marketplace to a public testnet or mainnet fork environment.
- Verify the test deployment on a block explorer.
- Run end-to-end tests through the UI against the deployed test contract.
- Prepare deployment runbook and environment configuration.

UI requirements:

- Token page shows owner, listing price if active, current approval state, active offers, artist fee, seller proceeds, and buyer total.
- Seller flow shows approval first if needed, then listing.
- Buyer flow shows exact ETH required and final confirmation before `buy`.
- Offer flow shows escrowed ETH amount, expiry, and cancellation path.
- Owner accept-offer flow shows artist fee and seller net proceeds.

Exit criteria:

- A non-developer can list, cancel, buy, make an offer, cancel an offer, and accept an offer on the test deployment.
- Frontend does not claim a stale listing or offer is guaranteed; execution failures are handled cleanly.
- Indexer can be rebuilt from events alone.

### Week 4: Audit Package, Remediation Buffer, and Launch Prep

Deliverables:

- Freeze the audit commit.
- Produce the audit package listed below.
- Hand the frozen commit and audit package to the already-selected auditor.
- Leave at least several days for audit questions and early fixes.
- Complete deployment checklist for Ethereum mainnet.
- Prepare owner multisig handoff and post-deploy verification steps.
- Prepare launch monitoring and incident response notes.

Launch checklist:

- All tests pass.
- Static analysis findings are resolved or documented.
- Audit scope and commit hash are locked.
- Deployment account and multisig roles are confirmed.
- Artist recipient is the intended multisig.
- Contract is deployed and verified.
- Ownership/admin role is transferred to the multisig.
- A small end-to-end listing and sale is tested after deployment.
- Site configuration uses the verified production contract address.

## Precise Audit Scope

### Audit Objective

Review the marketplace contract for correctness and safety before it handles real mainnet trades for the existing NFT collection. The main security goals are:

- NFTs cannot be stolen from owners.
- ETH cannot be stolen or permanently trapped except by explicit user cancellation/expiry flows.
- Sellers receive the correct net proceeds.
- The artist receives exactly 2.5% of every completed marketplace sale.
- Listings cannot be bought after cancellation, expiry, seller ownership loss, or approval revocation.
- Offers cannot be accepted after cancellation, expiry, or insufficient escrow.
- Reentrancy cannot corrupt listings, offers, ownership assumptions, or payments.
- Admin powers are limited, understandable, and safe under multisig control.

### In-Scope Code

The audit quote should cover these files once implementation starts:

- `src/CollectionMarketplace.sol`
- Any marketplace-specific interfaces, errors, structs, and libraries.
- Deployment configuration that sets constructor parameters for:
  - existing collection address
  - artist recipient
  - 2.5% fee in basis points
  - contract owner/admin
- Tests that define expected behavior, including unit, fuzz, and fork tests.

Expected size:

- One custom Solidity contract.
- Approximately 300-600 lines of custom Solidity, excluding OpenZeppelin imports.
- No custom ERC-721 implementation.
- No upgradeable proxy for MVP unless explicitly added before audit quoting.

### Out-of-Scope Code

Unless separately quoted, the following are out of scope:

- The already deployed NFT collection contract.
- NFT metadata, images, and token URI correctness.
- Frontend application security beyond confirming it calls the intended contract methods.
- Indexer correctness beyond event compatibility.
- Discord migration, moderation, and operational process.
- Tax, legal, securities, consumer protection, or marketplace licensing analysis.
- External marketplace royalty enforcement.
- User wallet compromise, phishing, malicious browser extensions, and seed phrase loss.

### Contract Behaviors To Audit

Listings:

- Only the current NFT owner can create or update a listing.
- Listing creation rejects zero price and invalid expiry.
- Listing creation can require current marketplace approval, but purchase must always re-check approval.
- Seller can cancel their own listing.
- A listing becomes unbuyable if the seller no longer owns the token.
- A listing becomes unbuyable if marketplace approval is revoked.
- Expired listings cannot be purchased.
- A purchase deletes or invalidates the listing before external interactions where appropriate.
- A purchase transfers the NFT from seller to buyer atomically with ETH settlement.

Offers:

- `makeOffer` escrows `msg.value` in ETH.
- Offer amount must be nonzero and expiry must be valid.
- Offer maker can cancel an active offer and recover escrowed ETH.
- Current token owner can accept an active offer.
- Expired or canceled offers cannot be accepted.
- Accepted offers are deleted or invalidated before external interactions where appropriate.
- Offer acceptance transfers the NFT from owner to offer maker atomically with ETH settlement.
- Offers remain safe if the NFT changes owners before acceptance.

Payments and fees:

- Artist fee is exactly 2.5%, calculated as `salePrice * 250 / 10_000`.
- Seller receives `salePrice - artistFee`.
- Rounding behavior is deterministic and tested.
- ETH accounting cannot be broken by forced ETH sent with `selfdestruct` or direct transfers.
- Overpayment behavior for purchases is explicit, tested, and safe.
- Failed ETH sends do not leave contract state inconsistent.
- Reentrancy during NFT transfer callbacks or ETH receipt cannot double-spend, double-accept, double-cancel, or bypass authorization.

Access control and administration:

- Owner/admin can update the artist recipient only if this is part of the final design.
- Artist recipient cannot be set to the zero address.
- Pausing, if included, blocks purchase, listing, offer creation, offer acceptance, and cancellation only as intended.
- Admin cannot confiscate user NFTs.
- Admin cannot withdraw user escrowed offers except through the intended offer lifecycle.
- Ownership transfer should use a two-step flow and end at the production multisig.

Compatibility:

- Contract works with the existing collection's live ERC-721 behavior.
- Contract handles `safeTransferFrom` callbacks correctly.
- Contract does not assume token IDs are sequential beyond UI convenience.
- Contract does not depend on metadata availability.
- Contract uses the intended Solidity compiler version and OpenZeppelin versions.

Event and indexing integrity:

- Every state-changing action emits enough data to reconstruct listings, purchases, offers, cancellations, and acceptances.
- Event ordering matches state changes.
- Events cannot misrepresent payment amount, buyer, seller, token ID, or artist fee.

### Threat Model

The auditor should assume:

- Buyers, sellers, offer makers, and token recipients can be malicious contracts.
- Users can transfer NFTs or revoke approvals after listing.
- Users can create stale listings or stale offers intentionally.
- Multiple users can race to buy, cancel, accept, or update.
- ETH can be forcibly sent to the contract.
- The frontend or indexer can be stale or unavailable.
- The admin is a multisig after launch, but admin key misuse and compromised admin scenarios should still be considered for blast radius.

The auditor should not assume:

- The frontend is always honest.
- The indexer is always current.
- Sellers keep approval after listing.
- Offer makers remain engaged after making an offer.
- The existing NFT contract implements royalties or marketplace hooks.

### Required Audit Package

Provide the auditor:

- Repository URL or archive.
- Exact commit hash for the audit.
- Solidity compiler version and optimizer settings.
- Dependency lockfile.
- Contract architecture note.
- Function-level specification.
- Known assumptions and explicitly deferred features.
- Existing collection contract address.
- Artist recipient address or placeholder if not final.
- Test instructions.
- Current test coverage summary.
- Slither output and any acknowledged findings.
- Mainnet fork test instructions.
- Deployment plan and constructor arguments.
- Admin/multisig plan.

### Auditor Quote Request

Ask the auditor to quote:

- Manual review of one custom marketplace contract.
- Review of tests and deployment configuration.
- Verification of listing, purchase, offer, cancellation, fee, and admin behavior.
- Review of ETH accounting and reentrancy resistance.
- Review of compatibility with the existing ERC-721 collection.
- Optional lightweight frontend transaction-construction review as a separate line item.
- One remediation review pass after fixes.

The quote should exclude a full audit of the existing NFT contract unless the auditor recommends including it after checking compatibility assumptions.

## Non-MVP Backlog

Defer these until after launch:

- WETH offers without escrow.
- ERC-20 offers.
- Collection-wide offers.
- Trait offers.
- Auctions.
- Bundled listings.
- Private listings.
- Multi-collection support.
- Protocol fees.
- Royalties configurable per token.
- Offchain signed orders.
- Upgradeable marketplace.
- Cross-chain support.
- Native mobile app.
