# Four-Week NFT Marketplace MVP Plan and Audit Scope

## Product Goal

Move the collection's resale activity from Discord DMs to the project site:

- A current holder can list an NFT at a fixed ETH price.
- The NFT stays in the seller's wallet while listed.
- A buyer can purchase a valid listing from the site.
- A seller can cancel a listing.
- A buyer can make an offer that the current owner can accept later.
- The artist receives 2.5% of every marketplace sale or accepted offer.

The MVP should support the existing 5,000-piece Ethereum mainnet ERC-721 collection minted in 2024. It should not try to become a generalized marketplace for arbitrary collections in the first release.

## Recommended MVP Architecture

Use a minimal custom settlement contract plus an off-chain order service.

### Smart Contract

Deploy one marketplace contract for the existing collection:

- Accepts fixed-price listings signed by the NFT owner using EIP-712.
- Allows any buyer to fulfill a valid listing by paying ETH.
- Transfers 2.5% of the sale price to the artist payout address.
- Transfers the remaining 97.5% to the seller.
- Transfers the NFT from seller to buyer at settlement time.
- Rejects fulfillment if the seller no longer owns the token or has not approved the marketplace.
- Supports seller cancellation through an on-chain cancellation mapping or nonce.
- Accepts buyer offers signed using EIP-712 and denominated in WETH.
- Allows the current owner to accept a valid WETH offer.
- Splits accepted-offer proceeds 2.5% to the artist and 97.5% to the seller.
- Rejects expired, cancelled, reused, underfunded, or insufficiently approved offers.

Use WETH for offers because the owner accepts later. Native ETH cannot be pulled from a buyer's wallet later unless the ETH is escrowed first. WETH offers let buyers sign an offer, approve WETH, and keep funds in their wallet unless the offer is accepted.

### Off-Chain Services

The off-chain service is an indexer and orderbook, not a trusted settlement layer:

- Stores signed listings and signed offers.
- Indexes collection ownership, approvals where available, marketplace fills, and cancellations.
- Removes stale listings and offers when ownership changes, expiry passes, cancellation is detected, or fulfillment succeeds.
- Serves collection, token, listing, offer, and activity APIs to the frontend.
- Relays no funds and never has custody of NFTs.

### Frontend

The site should support:

- Wallet connect.
- Collection grid with listed/unlisted state, floor price, and filters.
- Token detail page with owner, traits, listing status, offer list, and activity.
- List flow: price input, marketplace approval check, EIP-712 listing signature.
- Buy flow: transaction preview, royalty/seller split display, `buy` transaction.
- Cancel flow: on-chain cancellation transaction.
- Make offer flow: WETH balance check, WETH approval check, EIP-712 offer signature.
- Accept offer flow: ownership check, marketplace approval check, `acceptOffer` transaction.
- Clear states for expired, cancelled, transferred, already sold, insufficient approval, insufficient WETH, and failed transactions.

## Four-Week MVP Plan

### Week 1: Requirements, Contract Design, and Prototype

Finalize the protocol shape and remove ambiguity before implementation hardens:

- Confirm existing NFT contract address, standard support, metadata source, and whether it behaves like standard ERC-721.
- Confirm artist payout address, royalty basis points, and who can update the payout address if needed.
- Decide whether marketplace ownership/admin powers are allowed. MVP recommendation: owner may update artist payout address, pause settlement, and rescue unrelated ERC-20/ETH sent by mistake, but cannot change the royalty percentage after deployment unless the team intentionally wants upgrade risk.
- Define EIP-712 typed data for listings and offers.
- Define listing fields: seller, tokenId, price, currency ETH marker, expiry, salt or nonce.
- Define offer fields: buyer, tokenId or collection-wide flag, WETH amount, expiry, salt or nonce.
- Define cancellation model: per-order hash cancellation plus optional bulk nonce for "cancel all listings/offers".
- Implement first Solidity draft with OpenZeppelin dependencies.
- Write unit tests for successful buy, successful offer acceptance, cancellations, expiry, ownership changes, approvals, replay prevention, and royalty split.
- Build a simple local script to sign listings/offers and fulfill them on a local fork.

Deliverables:

- Marketplace contract draft.
- Typed-data schema.
- Initial test suite.
- Integration notes for frontend/backend.

### Week 2: Frontend, Orderbook, and Indexing

Build the user-facing marketplace flows against testnet or a mainnet fork:

- Implement backend storage for signed listings and offers.
- Add validation before accepting an order into the backend: signature validity, token existence, current owner, current approval, expiry, price/amount format, and correct collection/chain/marketplace address.
- Add event indexer for fills and cancellations.
- Add ownership refresh jobs using chain reads or an index provider.
- Build collection and token detail APIs.
- Implement wallet connection and collection browsing UI.
- Implement listing creation, listing cancellation, and buy flows.
- Implement WETH offer creation and offer acceptance flows.
- Add UI copy that explains approvals, WETH offers, expiry, and the 2.5% artist share.

Deliverables:

- Working end-to-end marketplace on local fork/testnet.
- Backend orderbook and indexer.
- Frontend listing, buy, offer, accept, and cancel flows.

### Week 3: Hardening, Edge Cases, and Audit Prep

Stabilize the implementation so the audit starts from a clean target:

- Complete unit and integration tests for all expected settlement paths.
- Add fuzz/property tests for fee calculation, payment conservation, nonce/cancellation behavior, and replay prevention.
- Test against a mainnet fork using real collection ownership and approval behavior.
- Verify behavior when:
  - Seller transfers NFT after listing.
  - Seller revokes approval after listing.
  - Buyer lacks enough ETH at purchase.
  - Buyer lacks enough WETH or allowance at offer acceptance.
  - Artist payout address reverts on ETH receive.
  - Seller payout address reverts on ETH receive.
  - Listing or offer expires in the same block.
  - Duplicate order fulfillment is attempted.
- Decide payout implementation. MVP recommendation: push payments during settlement with explicit revert handling, or pull-payment accounting if the team wants stronger protection against recipient revert risk.
- Freeze contract API for audit.
- Prepare audit package with commit hash, architecture notes, threat model, tests, deployment assumptions, and known limitations.

Deliverables:

- Audit-ready contract commit.
- Full test suite.
- Audit README.
- Deployment runbook draft.

### Week 4: Audit, Fixes, Launch Readiness

Use the audit window to finish operational readiness without changing contract scope:

- Auditor reviews frozen contract commit.
- Engineering answers auditor questions and reproduces reported issues.
- Fix accepted findings in a dedicated branch.
- Add regression tests for every fixed finding.
- Auditor reviews fixes.
- Run final mainnet-fork test suite.
- Dry-run deployment and verification scripts.
- Configure production backend, RPC provider, monitoring, error alerts, and indexer backfill.
- Prepare launch checklist and rollback/pausing procedure.
- Deploy marketplace contract.
- Verify source on Etherscan.
- Enable production frontend after successful smoke tests.

Deliverables:

- Final audited marketplace contract.
- Audit report and fix review.
- Verified mainnet deployment.
- Production marketplace MVP.

## Audit Scope

The audit should focus on the settlement contract and its exact integration assumptions. The backend and frontend should be reviewed only to the extent needed to confirm they pass correct data to the contract; they should not be treated as trusted components.

### In Scope

Smart contract files:

- `Marketplace.sol`
- Any local EIP-712/order hashing library used by `Marketplace.sol`
- Any local signature verification, nonce, cancellation, fee, or payment helper library
- Deployment script only for constructor arguments and initial configuration review
- Interface files for the existing ERC-721 collection and WETH, if locally defined

External dependencies:

- OpenZeppelin `IERC721`, `IERC20`, `ECDSA`, `EIP712`, `Ownable` or `AccessControl`, `Pausable`, and `ReentrancyGuard`, if used
- Canonical WETH9 interface for Ethereum mainnet WETH

Core behaviors to audit:

- EIP-712 domain separation, chain ID handling, verifying contract binding, and replay resistance.
- Listing signature validation.
- Offer signature validation.
- Order hash construction and collision resistance.
- Cancellation by order hash.
- Optional bulk nonce cancellation, if implemented.
- Expiry checks.
- Prevention of double fills.
- Correct current-owner checks at settlement.
- Correct ERC-721 approval checks at settlement.
- Safe NFT transfer behavior.
- ETH payment accounting for listing purchases.
- WETH payment accounting for accepted offers.
- Artist royalty calculation at exactly 250 basis points.
- Seller proceeds calculation.
- Handling of rounding on royalty calculation.
- Conservation of funds: buyer payment equals artist payment plus seller payment.
- Reentrancy resistance around ETH, WETH, and NFT transfers.
- Behavior when seller, buyer, artist payout, or token contract is a smart contract.
- Failure modes for reverting ETH recipients.
- Fee-on-transfer or non-standard ERC-20 assumptions. MVP should only support canonical WETH for offers.
- Admin functions, including payout address updates, pausing, ownership transfer, and rescue functions.
- Event correctness for off-chain indexing.
- Mainnet deployment configuration.

### Explicit Security Questions

The auditor should answer:

- Can a listing be filled after it is cancelled?
- Can a listing be filled after the seller no longer owns the NFT?
- Can a listing be filled after the seller revokes approval?
- Can a listing or offer be replayed across chains, contracts, or collections?
- Can a listing or offer be filled more than once?
- Can a buyer pay less than the signed listing price?
- Can a seller receive less than 97.5% or the artist receive less than 2.5% because of rounding, ordering, or transfer behavior?
- Can anyone bypass the artist payment?
- Can a malicious recipient block all marketplace sales?
- Can a malicious NFT receiver, seller contract, buyer contract, WETH contract, or artist payout contract reenter settlement?
- Can stale backend data cause an unsafe settlement, or does the contract independently reject invalid orders?
- Can admin privileges be abused beyond the documented powers?
- Are emitted events sufficient and accurate for indexing filled and cancelled orders?

### Out of Scope

Unless separately quoted, exclude:

- The original 2024 NFT collection contract, except for interface compatibility and mainnet behavior assumptions.
- Metadata hosting, token images, reveal mechanics, and trait correctness.
- Generalized support for other NFT collections.
- Auctions, bundles, shopping carts, ERC-1155, ERC-20 currencies other than WETH, private listings, collection-wide offers, trait offers, partial fills, royalties above/below 2.5%, and upgradeable marketplace architecture.
- Backend infrastructure security, database security, API rate limiting, wallet-drainer/phishing review, and frontend dependency supply-chain review.
- Legal, tax, sanctions, securities, consumer-protection, or royalty-enforceability advice.

### Audit Inputs to Provide

Give the auditor:

- Frozen git commit hash.
- Solidity compiler version and optimizer settings.
- Target chain: Ethereum mainnet.
- Existing NFT collection contract address.
- WETH contract address.
- Marketplace constructor arguments.
- Artist payout address.
- Admin owner or multisig address.
- Full contract source and dependency lockfile.
- Test command and expected passing output.
- Current unit, integration, fuzz, and mainnet-fork tests.
- Typed-data examples for one listing and one offer.
- Example frontend/backend payloads for listing, buying, offer creation, offer cancellation, and offer acceptance.
- Deployment and verification scripts.
- Known limitations and intentionally excluded features.

### Recommended Audit Size

Ask for a quote assuming:

- One custom settlement contract.
- One to three small local helper/interface files.
- No upgradeability.
- No escrowed NFT custody.
- ETH fixed-price listing purchases.
- WETH buyer offers.
- Approximately 500-900 lines of custom Solidity, depending on helper structure.
- One fix-review pass after initial findings.

The quote should separately price any change that expands scope to native-ETH escrowed offers, collection-wide offers, trait offers, multiple collections, multiple payment currencies, upgradeability, or private listings.

## Launch Checklist

Before mainnet launch:

- Audit findings are fixed or explicitly accepted.
- Fix review is complete.
- All tests pass on a mainnet fork.
- Contract is deployed from the expected deployer.
- Constructor arguments match the audit package.
- Source is verified on Etherscan.
- Artist payout address is tested with a small transaction or known to receive ETH/WETH safely.
- Admin owner is a multisig or otherwise approved operational wallet.
- Pause procedure is documented.
- Backend has indexed the full collection and deployment block.
- Frontend points at the verified marketplace address.
- The first production listing, cancellation, purchase, offer, and offer acceptance are smoke-tested with low-value tokens or controlled wallets.

## Key MVP Limitations

- Royalties are enforced only for trades settled through this marketplace. Direct wallet transfers or trades through other marketplaces cannot be forced to pay the artist by this contract.
- A signed listing can become unfillable if the seller transfers the NFT or revokes approval.
- A signed WETH offer can become unfillable if the buyer spends WETH or revokes allowance.
- Cancellations require an on-chain transaction so the contract can reject the order forever.
- The backend may hide stale orders, but the contract must be the final source of truth for settlement safety.
