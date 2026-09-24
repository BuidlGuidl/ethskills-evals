# Four-Week MVP Plan and Audit Scope

## Product Goal

Build a first-party, non-custodial marketplace for the existing 5,000-piece Ethereum mainnet NFT collection.

The MVP must support:

- Owners listing tokens at fixed ETH prices without transferring NFTs into escrow.
- Buyers purchasing active listings from the site.
- Sellers cancelling listings.
- Buyers making offers that owners can accept later.
- A 2.5% artist resale fee on every completed listing sale and accepted offer.
- Atomic settlement: payment, artist fee, seller proceeds, and NFT transfer happen in one transaction.

## Recommended MVP Design

Use a small custom marketplace settlement contract plus an off-chain orderbook.

### Core Assumptions

- The NFT collection is an ERC-721 contract already deployed on Ethereum mainnet.
- Sellers keep custody of their NFTs while listed.
- Sellers must approve the marketplace contract for the listed token or via `setApprovalForAll`.
- Fixed-price listings are signed EIP-712 sell orders stored by the application backend.
- Listing buys are paid in native ETH.
- Offers are signed EIP-712 buy orders denominated in WETH. This avoids marketplace custody of buyer ETH while still letting an owner accept later.
- Offer makers must hold enough WETH and approve the marketplace contract when the offer is accepted.
- The artist royalty recipient and 2.5% fee are enforced by the marketplace settlement contract.
- The marketplace supports only this collection for MVP, not arbitrary ERC-721 collections.

### Main Components

- `Marketplace.sol`: verifies signed listings and offers, enforces expiration/nonces/cancellations, performs atomic settlement, and splits proceeds.
- Web app: browsing, listing, buying, offer creation, offer acceptance, cancellation, wallet connection, token ownership state, and transaction status.
- Backend/API: stores signed listings/offers, indexes marketplace events, filters stale orders, and serves the public marketplace views.
- Indexer job: watches collection transfers, marketplace fills, cancellations, approvals where practical, and order expirations.
- Admin configuration: artist fee recipient, supported collection address, WETH address, deployment metadata, and feature flags for launch controls.

## Four-Week Build Plan

### Week 1: Specification, Architecture, and Contract Skeleton

Define and lock the marketplace behavior before implementation gets too far.

- Confirm collection contract address, chain ID, royalty recipient, artist treasury wallet, and current token metadata source.
- Confirm whether the existing NFT contract supports `ERC721`, `ownerOf`, `safeTransferFrom`, and any custom transfer restrictions.
- Write the marketplace protocol specification:
  - Listing order fields.
  - Offer order fields.
  - EIP-712 domain and typed data.
  - Fee math and rounding.
  - Nonce and cancellation model.
  - Expiration behavior.
  - Invalid-order behavior when ownership, approval, WETH balance, or WETH allowance changes.
- Implement first version of `Marketplace.sol`.
- Implement unit tests for:
  - Buying a valid listing.
  - Accepting a valid offer.
  - Seller cancellation.
  - Nonce invalidation.
  - Expired orders.
  - Incorrect signer.
  - Token no longer owned by signer.
  - Missing ERC-721 approval.
  - Insufficient ETH or WETH.
  - Artist fee split.
- Decide whether cancellations are per-order hash, per-token nonce, per-signer nonce, or a combination. For MVP, use order-hash cancellation plus per-signer bulk nonce invalidation.
- Produce an audit-ready protocol README alongside the tests.

Exit criteria:

- Contract API and order structs are frozen for MVP unless a critical issue appears.
- Local tests cover the happy paths and obvious invalid paths.
- Frontend and backend can build against stable typed data definitions.

### Week 2: Backend Orderbook and Frontend Trading Flows

Build the product surface against testnet or a local fork.

- Implement backend storage for signed listings and offers.
- Add validation before accepting an order into the backend:
  - Correct chain ID and verifying contract.
  - Correct collection address.
  - Correct token ID range for the 5,000-piece collection.
  - Valid signature.
  - Future expiration.
  - Price above zero.
  - Royalty terms matching the contract rules.
- Add stale-order filtering:
  - Token ownership changed.
  - Listing seller lacks approval.
  - Offer maker lacks WETH balance or allowance.
  - Order expired, cancelled, or filled.
- Implement marketplace pages:
  - Collection grid with listed price and offer count.
  - Token detail page.
  - Create listing.
  - Cancel listing.
  - Buy listing.
  - Make offer.
  - Accept offer.
  - User inventory and user offers.
- Add wallet flows for:
  - ERC-721 approval.
  - WETH approval for offers.
  - Optional ETH-to-WETH wrapping helper for offer makers.
- Emit and index contract events for fills, cancellations, and nonce invalidations.

Exit criteria:

- A holder can list from the site, another wallet can buy, and settlement is reflected in the UI.
- A buyer can make a WETH offer, the owner can accept it, and settlement is reflected in the UI.
- Stale listings and offers are hidden or marked unavailable without requiring manual cleanup.

### Week 3: Hardening, Test Coverage, and Testnet Rehearsal

Turn the working MVP into something safe enough to audit.

- Expand contract test coverage:
  - Fuzz fee math and payment conservation.
  - Reentrancy attempts from malicious ERC-721 receiver or WETH-like mocks where applicable.
  - Replay attempts across orders, users, tokens, chains, and verifying contracts.
  - Partial payment, overpayment, refund behavior, and zero-value edge cases.
  - Cancelled order cannot be filled.
  - Filled order cannot be filled again.
  - Bulk nonce invalidation invalidates old orders.
  - Royalty recipient cannot break settlement.
- Add integration tests on a mainnet fork using the real collection contract address.
- Add frontend transaction-state QA:
  - Pending, confirmed, rejected, reverted, dropped/replaced.
  - Wrong network.
  - Missing approvals.
  - Wallet signature rejection.
- Add backend/indexer resilience:
  - Chain reorg handling target.
  - Idempotent event processing.
  - Reconciliation job for stale orders.
  - Rate limiting and abuse protection for order submission.
- Deploy to Ethereum testnet or a mainnet fork environment with production-like config.
- Run an internal test sale and accepted offer with at least three wallets.

Exit criteria:

- Test suite is stable in CI.
- Testnet/fork deployment has matching addresses and typed data config.
- Known issues are documented with severity and planned treatment.
- Code freeze candidate is ready for auditor handoff.

### Week 4: Audit Handoff, Fix Window, and Launch Preparation

Prepare the auditor package, support audit questions, and finish launch readiness.

- Freeze contracts for audit.
- Tag the audit commit.
- Deliver the audit package listed below.
- Keep one engineer available for auditor questions and reproduction support.
- Fix audit findings in a separate branch with clear commit references.
- Re-run full contract, integration, frontend, and backend test suites after every contract change.
- Prepare deployment runbook:
  - Deployment account and signer policy.
  - Constructor/config arguments.
  - Verification commands.
  - Post-deploy smoke tests.
  - Emergency pause or disable plan, if included.
- Prepare launch monitoring:
  - Filled sale events.
  - Failed fills.
  - High cancellation or stale-order rates.
  - Royalty recipient balance checks.
  - Backend/indexer health.
- Final mainnet go/no-go review.

Exit criteria:

- Audit report received or audit window complete.
- Critical and high findings are fixed and re-reviewed.
- Medium findings are fixed or explicitly accepted.
- Deployment runbook has been rehearsed.
- Marketplace is ready for a limited public launch.

## Smart Contract Audit Scope

The audit quote should cover the complete on-chain settlement system for the MVP marketplace.

### In Scope

The auditor should review:

- Marketplace settlement contract source.
- Interfaces used by the marketplace:
  - ERC-721 collection interface.
  - WETH/ERC-20 interface.
  - EIP-1271 interface if smart contract wallet signatures are supported.
- Signature verification code.
- EIP-712 domain separator and typed data hashing.
- Listing fulfillment path.
- Offer acceptance path.
- Order cancellation path.
- Bulk nonce invalidation path.
- Royalty/artist fee calculation and distribution.
- ETH payment handling, refunds, and seller payout.
- WETH transfer handling for offers.
- Reentrancy protection.
- Access control for admin-only settings.
- Event emission correctness.
- Deployment constructor/configuration validation.
- Tests and protocol documentation sufficient to evaluate intended behavior.

### Expected Contract Entry Points

The final names may change, but the audit should quote against this functional surface:

- `buyListing(Listing order, bytes sellerSignature) payable`
- `acceptOffer(Offer order, bytes buyerSignature)`
- `cancelOrder(bytes32 orderHash)`
- `incrementNonce()` or equivalent bulk invalidation function
- View/helper functions for order hash calculation, nonce state, cancelled order state, filled order state, fee settings, collection address, WETH address, and artist recipient.
- Admin function only if needed to update artist recipient or pause trading. If mutability is not strictly required, prefer immutable deployment parameters.

### Required Security Properties

The auditor should specifically assess whether:

- A listing can only be filled if it was signed by the current token owner or an authorized signer if explicitly supported.
- An offer can only be accepted by the current token owner.
- Every fill transfers exactly one intended token to the buyer.
- Every fill pays exactly 2.5% of the sale price to the artist recipient.
- Seller proceeds equal sale price minus artist fee.
- ETH listing buys cannot underpay, trap excess funds, or misroute refunds.
- WETH offers cannot be filled unless transfer of buyer payment succeeds.
- Orders cannot be replayed after fill, cancellation, nonce invalidation, or expiration.
- Signatures cannot be replayed across chains, contracts, collections, order types, or materially different order terms.
- Malicious recipients cannot reenter settlement to steal NFTs or funds.
- Malicious or non-standard ERC-20 behavior is handled within the declared WETH-only assumption.
- Fee rounding is deterministic and cannot reduce the artist fee below the intended policy except for unavoidable integer rounding.
- Admin controls cannot be abused to redirect already-signed orders unless that risk is intentionally accepted and disclosed.
- The contract cannot custody NFTs during listing and cannot accidentally leave NFTs in escrow.
- Contract-held ETH or WETH cannot become permanently stuck except through explicitly documented accidental transfers.

### Out of Scope for Smart Contract Audit

These areas should be excluded from the core smart contract quote unless the auditor offers separate app/security review services:

- Frontend implementation details.
- Backend API implementation.
- Database schema and orderbook availability.
- Indexer uptime and data freshness.
- Wallet UX.
- DNS, hosting, CDN, and web application security.
- Discord migration and community operations.
- Metadata correctness and image hosting.
- Tax, securities, money transmission, sanctions, and legal compliance.

The auditor should still receive frontend/backend flow descriptions because they explain how users reach the contract, but the quoted smart contract audit should focus on the settlement contract and its tests.

## App and Backend Review Scope

If commissioning a separate application security review, include:

- Order submission API validation.
- Signature payload generation.
- Prevention of forged or mutated order display.
- Correct display of price, token ID, expiration, fees, and counterparty.
- Stale listing/offer detection.
- Indexer correctness and idempotency.
- Protection against spam order submission.
- Wallet connection and network switching behavior.
- Handling of failed, replaced, reverted, or pending transactions.
- Backend admin access and environment secret handling.

## Auditor Handoff Package

Provide the auditor:

- Repository URL and frozen commit hash.
- Marketplace protocol specification.
- Contract source and dependency lockfile.
- Deployment configuration for the target chain.
- Existing NFT collection address.
- WETH address for Ethereum mainnet.
- Artist royalty recipient address.
- Fee value: 250 basis points.
- EIP-712 typed data examples for listings and offers.
- Example signed listing and offer fixtures.
- Test commands and expected passing output.
- Gas report, if available.
- Coverage report, if available.
- Known issues list.
- Explicit list of out-of-scope items.

## Key MVP Risks and Mitigations

- Stale listings: because NFTs are not escrowed, a listed token may transfer or lose approval before purchase. Mitigate with contract checks, backend filtering, and clear UI states.
- Stale offers: a buyer may spend WETH or revoke allowance after making an offer. Mitigate with contract checks and backend revalidation.
- Signature replay: use strict EIP-712 domains, order type separation, nonces, expirations, cancellation state, and filled state.
- Royalty expectations: enforce the 2.5% artist fee in the settlement contract rather than relying only on UI or metadata.
- Upgrade/admin risk: prefer immutable config for collection, WETH, fee bps, and marketplace domain. If admin updates are needed, document them and consider a multisig plus timelock after launch.
- Marketplace liquidity fragmentation: listings/offers exist only on the first-party site unless intentionally integrated elsewhere. This is acceptable for MVP but should be communicated to the community.

