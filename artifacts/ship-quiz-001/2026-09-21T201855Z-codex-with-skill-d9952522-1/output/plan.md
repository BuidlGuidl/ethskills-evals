# NFT Marketplace MVP Plan and Audit Scope

## Product Goal

Build a first-party resale marketplace for the existing 5,000-piece Ethereum
mainnet NFT collection. Holders can list tokens for sale without escrow, buyers
can purchase listed tokens atomically, buyers can make later-accepted offers, and
the artist receives 2.5% of every successful resale.

The MVP should replace manual Discord coordination with trust-minimized
settlement on the project site. The site can index, search, and display market
data, but settlement rules and fee enforcement must live onchain.

## MVP Architecture

### Target Chain

Launch on Ethereum mainnet because the collection already lives there and
owners, approvals, liquidity, and provenance are on mainnet. The MVP should not
bridge or wrap the collection for launch.

### Custom Contracts

Use one custom contract:

1. `CollectionMarketplace`
   - Settles fixed-price listings paid in ETH.
   - Settles buyer offers paid in WETH.
   - Enforces the 2.5% artist fee on every resale.
   - Verifies EIP-712 signed orders.
   - Tracks cancelled and filled order nonces.
   - Supports pausing and owner/admin configuration only for emergency and fee
     recipient updates.

Do not add an escrow contract, router, factory, or separate fee splitter for the
MVP. The seller keeps the NFT until a purchase or accepted offer settles
atomically.

### Existing External Contracts

The marketplace integrates with:

- Existing ERC-721 collection contract deployed on Ethereum mainnet.
- Canonical WETH contract on Ethereum mainnet.

Before implementation, record the exact verified collection address, canonical
WETH address, artist fee recipient, and marketplace owner multisig in the
repository configuration and deployment runbook.

### Onchain vs Offchain Boundary

Onchain:

- Order validation.
- Listing purchase settlement.
- Offer acceptance settlement.
- Artist fee calculation and payment.
- NFT transfer from current owner to buyer.
- Order fill and cancellation invalidation.
- Emergency pause and administrative recipient updates.
- Events needed for indexing listings, offers, fills, cancellations, and fee
  payments.

Offchain:

- Website UI.
- Wallet connection.
- Listing and offer forms.
- Collection metadata rendering.
- Search, filtering, sorting, rarity display, floor stats, and activity feeds.
- Order discovery and indexing.
- Optional backend orderbook storage for signed listing and offer payloads.
- Discord migration messaging and support tooling.

Rankings, floor price, activity, owner pages, and search results are derived
from emitted events, the collection contract, metadata, and the offchain
orderbook. They should not be maintained as contract storage.

## Order Model

### Fixed-Price Listings

The seller signs an EIP-712 listing containing:

- Collection address.
- Token ID.
- Seller address.
- ETH price.
- Listing nonce.
- Expiration timestamp.
- Chain ID.
- Marketplace verifying contract.

The NFT remains in the seller wallet. To be fillable, the seller must still own
the token and must have approved the marketplace through `approve` or
`setApprovalForAll`.

The buyer calls `buyListing(listing, sellerSignature)` and sends exactly the
required ETH. The marketplace verifies the signature, ownership, approval,
expiry, nonce status, and price, then atomically:

1. Marks the listing nonce filled.
2. Pays 2.5% to the artist fee recipient.
3. Pays 97.5% to the seller.
4. Transfers the NFT from seller to buyer.
5. Emits a sale event.

### Buyer Offers

Use WETH for offers. A native ETH offer cannot be accepted later without holding
funds in escrow, which conflicts with the MVP's non-escrow requirement.

The buyer signs an EIP-712 offer containing:

- Collection address.
- Token ID.
- Buyer address.
- WETH price.
- Offer nonce.
- Expiration timestamp.
- Chain ID.
- Marketplace verifying contract.

To be fillable, the buyer must still have enough WETH balance and allowance.
The owner calls `acceptOffer(offer, buyerSignature)`. The marketplace verifies
the signature, current ownership, approval, expiry, nonce status, WETH balance,
and allowance, then atomically:

1. Marks the offer nonce filled.
2. Pulls WETH from the buyer.
3. Pays 2.5% WETH to the artist fee recipient.
4. Pays 97.5% WETH to the seller.
5. Transfers the NFT from seller to buyer.
6. Emits a sale event.

If the buyer removes WETH approval or spends the WETH before acceptance, the
offer simply becomes unfillable.

### Cancellation

Cancellations must be enforceable onchain. Hiding an order only in the website
is not enough, because an old signed order could still be filled elsewhere.

MVP cancellation options:

- Cancel a single order nonce.
- Increment a maker-wide minimum nonce to bulk-cancel older signed orders.

The website should also remove cancelled orders from the offchain orderbook once
the cancellation event is indexed.

## Required State Transitions

| Transition | Caller | Why They Pay Gas | If Nobody Calls |
| --- | --- | --- | --- |
| `buyListing(listing, signature)` | Buyer | Receives the NFT at the listed price | Listing remains fillable until cancelled, expired, ownership changes, approval is revoked, or price/order is superseded |
| `acceptOffer(offer, signature)` | Current NFT owner | Receives WETH proceeds | Offer remains fillable until cancelled, expired, buyer balance/allowance changes, or token ownership changes |
| `cancelNonce(nonce)` | Order maker | Prevents a signed order from being filled | Order remains fillable if otherwise valid |
| `incrementMinNonce(newMinNonce)` | Order maker | Bulk-cancels old signed orders | Old signed orders remain individually fillable if otherwise valid |
| `setApprovalForAll(marketplace, true)` on NFT | Token owner | Makes listings or offer acceptances fillable | Orders depending on approval fail |
| `approve(marketplace, amount)` on WETH | Offer maker | Makes WETH offers fillable | Offers depending on approval fail |
| `pause()` | Marketplace owner multisig | Stops settlement during an emergency | Trading continues |
| `unpause()` | Marketplace owner multisig | Restores settlement after mitigation | Trading remains paused |
| `setFeeRecipient(address)` | Marketplace owner multisig | Updates artist payment destination | Existing recipient continues receiving fees |

## Four-Week MVP Plan

### Week 1: Specification, Contract Skeleton, and UX Flows

- Freeze MVP scope: fixed-price listings, token-specific WETH offers, single NFT
  collection, 2.5% artist fee, onchain cancellation, and no escrow.
- Confirm deployment constants: collection address, WETH address, artist fee
  recipient, owner multisig, fee basis points, and target chain.
- Write the marketplace contract interface and EIP-712 typed data schema.
- Decide final nonce strategy: per-maker nonce bitmap, per-order nonce mapping,
  maker minimum nonce, or a combination.
- Create buyer, seller, and owner flow diagrams for:
  - List token.
  - Buy listing.
  - Make offer.
  - Accept offer.
  - Cancel listing or offer.
  - Revoke approvals.
- Start the frontend order creation forms and wallet connection.
- Add local tests for basic listing fill, offer acceptance, cancellation, expiry,
  wrong signer, wrong chain, wrong verifying contract, and fee splitting.

Week 1 exit criteria:

- Contract API frozen enough for audit quoting.
- Typed data examples committed.
- Main user flows visible in a local UI.
- Core happy-path tests passing.

### Week 2: Settlement Hardening and Orderbook

- Complete contract implementation with reentrancy protection, pausing,
  signature validation, nonce invalidation, and event emissions.
- Add WETH offer handling and native ETH listing handling.
- Add validation for current owner, approval, payment amount, expiry, and filled
  or cancelled status.
- Build the offchain orderbook API or storage layer for signed listings and
  offers.
- Build indexer jobs or event listeners for fills, cancellations, and sales.
- Add frontend states for expired orders, unapproved NFTs, insufficient WETH,
  revoked WETH allowance, and already-filled orders.
- Add fork tests against Ethereum mainnet for the actual collection contract and
  WETH.

Week 2 exit criteria:

- Users can create signed orders in the UI.
- Buyers can fill listings in a local/fork environment.
- Owners can accept WETH offers in a local/fork environment.
- Offchain orderbook removes stale orders after indexed events.

### Week 3: Integration, Edge Cases, and Testnet Rehearsal

- Deploy to an Ethereum test environment or local mainnet fork rehearsal using
  the exact deployment scripts intended for production.
- Run end-to-end tests for listing, buying, offering, accepting, cancelling,
  approval revocation, insufficient funds, and expired orders.
- Add admin runbook steps for pause, unpause, fee recipient update, and ownership
  transfer to the multisig.
- Add analytics/events needed for activity feeds and artist fee reporting.
- Prepare audit package: spec, diagrams, tests, deployment configuration, threat
  model, and exact commit hash.
- Freeze contract code at the audit candidate commit by the end of the week.

Week 3 exit criteria:

- Audit candidate commit is tagged.
- Deployment and verification commands work in rehearsal.
- Frontend and orderbook can operate against the deployed rehearsal contract.
- Known limitations are documented.

### Week 4: Audit Support, Fixes, and Launch Preparation

- Auditor reviews the frozen contract scope.
- Engineering team remains available for questions and reproduction steps.
- Triage findings into critical, high, medium, low, and informational.
- Patch accepted findings and add regression tests.
- Ask auditor to review fixes if findings touch settlement, signature validation,
  nonce invalidation, fee payment, or external calls.
- Perform a final fresh review of the vertical slice.
- Execute production deployment on Ethereum mainnet only after audit fixes are
  merged and verified.
- Run post-deploy smoke tests with low-value assets or controlled wallets:
  - Create and cancel a listing.
  - Create and cancel an offer.
  - Execute one listing purchase.
  - Execute one accepted WETH offer.
  - Confirm artist fee receipt.

Week 4 exit criteria:

- Final audit report received or all launch-blocking findings resolved.
- Contract verified on Etherscan.
- Ownership transferred to the intended multisig.
- Frontend points at the verified mainnet marketplace.
- Team has a documented emergency pause procedure.

## Precise Audit Scope

### In Scope

Audit one Solidity marketplace contract and its tests at a frozen commit:

- `CollectionMarketplace.sol`
- Contract interfaces used by the marketplace, such as ERC-721 and WETH/ERC-20
  interfaces.
- Any local libraries used for EIP-712 hashing, signature recovery, nonce
  management, fee math, and safe transfer helpers.
- Deployment script only as it relates to constructor arguments, initialization,
  ownership transfer, and verification of immutable addresses.
- Test suite covering settlement, cancellation, replay protection, external
  token integrations, and administrative controls.

If the implementation uses OpenZeppelin contracts, inherited OpenZeppelin code
is not being re-audited line by line, but the integration and selected versions
are in scope.

### Required Auditor Review Areas

1. Asset custody and settlement
   - NFT never sits in marketplace escrow before sale.
   - Listing purchase transfers ETH and NFT atomically.
   - Offer acceptance transfers WETH and NFT atomically.
   - No stuck-fund paths are introduced by failed fee or seller payments.
   - Reentrancy cannot create double fills, stolen assets, or incorrect payouts.

2. Signature correctness
   - EIP-712 domain includes chain ID and verifying contract.
   - Listing and offer hashes include all fields required to prevent replay or
     cross-market reuse.
   - Signer recovered from listing is the seller.
   - Signer recovered from offer is the buyer.
   - Signatures cannot be replayed after fill, cancellation, expiry, nonce
     invalidation, chain fork/domain change, or marketplace redeploy.

3. Nonce and cancellation logic
   - Single-order cancellation works.
   - Bulk cancellation works if implemented.
   - Filled orders cannot be filled again.
   - Cancellation events contain enough information for the offchain orderbook.
   - Nonce storage cannot be griefed or bypassed through malformed orders.

4. Fee math and artist payment
   - Artist receives exactly 2.5% of every successful resale, rounded according
     to documented basis-point math.
   - Seller receives the remaining 97.5%.
   - Fee cannot be bypassed by listings, offers, partial fills, zero-price
     orders, or alternate payment paths.
   - Fee recipient update permissions are restricted and events are emitted.

5. Ownership, approvals, and token behavior
   - Seller must be current token owner at settlement.
   - Marketplace requires valid ERC-721 approval at settlement.
   - Offer acceptance fails if seller no longer owns the token.
   - Listing fill fails if listed seller no longer owns the token.
   - Safe handling of ERC-721 transfer callbacks and nonstandard token behavior
     is considered.

6. WETH and ETH payment handling
   - ETH listing purchase rejects underpayment and handles overpayment according
     to the spec.
   - WETH offer acceptance checks allowance and balance through transfer result
     handling.
   - ERC-20 return values are handled safely.
   - Native ETH cannot be trapped unintentionally.

7. Administrative controls
   - Pause only affects intended settlement functions.
   - Owner/admin cannot steal NFTs or buyer funds.
   - Fee recipient cannot be set to an invalid address unless explicitly allowed
     by the spec.
   - Ownership transfer to multisig is correctly supported.

8. Event completeness
   - Fill, cancellation, fee recipient update, pause, and unpause events are
     emitted with indexed fields needed by the website and orderbook.
   - Event data matches the actual settlement amounts and participants.

9. Fork and integration behavior
   - Mainnet fork tests use the real NFT collection address and canonical WETH
     address.
   - Deployment constants match Ethereum mainnet.
   - Contract does not assume collection behavior that the deployed collection
     does not provide.

### Out of Scope

- The existing NFT collection contract, except for integration assumptions used
  by the marketplace.
- NFT art, metadata hosting, token URI correctness, and rarity calculations.
- Website UI security except transaction construction and typed-data correctness.
- Offchain orderbook availability, search, ranking, and moderation.
- Discord workflows and customer support processes.
- Tax, securities, consumer protection, sanctions, and royalty compliance legal
  analysis.
- Any future auction, bundle, trait offer, collection-wide offer, private sale,
  allowlist, delegated wallet, credit card, bridge, L2, or custodial feature not
  present in the frozen MVP contract.

### Audit Deliverables Requested

Ask the auditor to quote and deliver:

- Manual review of the in-scope Solidity code.
- Review of EIP-712 typed data and replay/cancellation model.
- Review of mainnet fork tests and suggested missing test cases.
- Severity-ranked findings with proof-of-concept steps where applicable.
- Fix review for all critical, high, and medium findings.
- Final report naming the reviewed commit hash and any residual risks.

### Materials to Provide the Auditor

- Frozen repository commit hash.
- Marketplace spec and this plan.
- Contract architecture diagram.
- EIP-712 typed data examples for one listing and one offer.
- Deployment constants for Ethereum mainnet.
- Test command list and expected results.
- Mainnet fork setup instructions.
- Known limitations and intentionally excluded features.
- Admin key and multisig plan, without sharing private keys.

## Deployment Runbook Requirements

Before mainnet deployment, add a repository README section with:

- Required environment variables.
- Exact deploy command.
- Exact Etherscan verification command.
- Constructor arguments.
- Expected collection address.
- Expected WETH address.
- Artist fee recipient.
- Marketplace owner multisig.
- Post-deploy ownership transfer command.
- Post-deploy smoke test steps.
- Emergency pause and unpause commands.

Production ownership must be transferred to the intended multisig before public
launch. The deployer wallet should not remain the long-term marketplace owner.

## Key MVP Decisions

- One custom marketplace contract.
- Ethereum mainnet launch.
- ETH for fixed-price listing purchases.
- WETH for later-accepted buyer offers.
- No NFT escrow for listings or offers.
- Signed offchain orders with onchain fill and cancellation.
- 2.5% artist fee enforced by the settlement contract.
- Offchain orderbook and indexing for browsing, search, sorting, and activity.
