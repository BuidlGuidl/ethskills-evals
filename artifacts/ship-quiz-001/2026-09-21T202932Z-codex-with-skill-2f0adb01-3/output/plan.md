# Four-Week NFT Marketplace MVP Plan

## Product Goal

Build a marketplace on the project's own site for the existing 5,000-piece Ethereum mainnet ERC-721 collection. Holders can list NFTs at fixed ETH prices without transferring custody to the marketplace. Buyers can buy listed NFTs atomically. Buyers can also make ETH offers that the current owner can accept later. Every successful resale pays the artist 2.5%.

Core MVP assumption: listings are non-custodial for the NFT; offers escrow native ETH so later acceptance is guaranteed. If the team requires non-escrow offers too, use WETH + EIP-712 signed offers as a separate implementation and audit scope expansion.

## Proposed Architecture

- Chain: Ethereum mainnet, because the collection already lives there and secondary trading should settle against the canonical NFT.
- Contracts: one new non-upgradeable marketplace contract.
- Existing NFT contract: unchanged.
- Currency: native ETH for fixed-price listings and escrowed offers.
- Royalty: marketplace-enforced 2.5% fee on every `buyListing` and `acceptOffer`, paid/credited to the artist recipient.
- Custody: marketplace never takes NFT custody during listing; transfer happens only inside the successful purchase or accepted-offer transaction.
- Frontend: own marketplace site with wallet connection, listing, cancel, buy, offer, accept offer, and withdrawal flows.
- Indexing: event-driven indexer for active listings, offers, sales, cancellations, and owner state. The contract remains the source of truth.

## Marketplace Contract Surface

Expected contract: `CollectionMarketplace.sol`

Suggested external functions:

- `createListing(uint256 tokenId, uint256 price, uint64 expiration)`  
  Called by the current owner after approving the marketplace. Stores a fixed-price listing. NFT stays in the owner's wallet.

- `cancelListing(uint256 tokenId)`  
  Called by the listing seller to remove an active listing.

- `buyListing(uint256 tokenId)` payable  
  Called by a buyer. Verifies listing, current ownership, approval, price, and expiration. Deletes the listing, transfers the NFT seller to buyer, credits 2.5% to artist, and credits the remainder to seller.

- `makeOffer(uint256 tokenId, uint64 expiration)` payable  
  Called by a buyer. Escrows ETH as an offer for one token. MVP supports one active offer per buyer per token.

- `cancelOffer(uint256 tokenId)`  
  Called by the offer maker. Cancels and refunds/credits the active offer.

- `acceptOffer(uint256 tokenId, address buyer)`  
  Called by the current owner after approving the marketplace. Verifies offer, current ownership, approval, and expiration. Deletes the offer, transfers NFT owner to buyer, credits 2.5% to artist, and credits the remainder to seller.

- `withdrawProceeds()`  
  Called by sellers, offer makers with canceled offers, or artist recipient to withdraw credited ETH.

- `setRoyaltyRecipient(address newRecipient)`  
  Admin function for the artist/multisig only. Fee stays fixed at 250 bps.

- `pause()` / `unpause()`  
  Emergency controls. Buying, listing, offer creation, and offer acceptance pause; cancellations and withdrawals remain available.

Suggested dependencies: OpenZeppelin `IERC721`, `ReentrancyGuard`, `Ownable2Step`, and `Pausable`. Avoid upgradeable proxies for MVP unless there is a strong operational reason.

## Week 1: Specification, UX, and Contract Design

Deliverables:

- Freeze the MVP behavior spec, including expiration rules, rounding rule, fee recipient, cancellation behavior, and whether offers escrow ETH.
- Confirm the deployed NFT contract address, ERC-721 behavior, royalty expectations, and whether collection approvals are acceptable for users.
- Write the state-transition worksheet for every marketplace function: caller, incentive, failure mode, and required events.
- Define events for indexer use: `ListingCreated`, `ListingCanceled`, `ListingPurchased`, `OfferCreated`, `OfferCanceled`, `OfferAccepted`, `ProceedsWithdrawn`, `RoyaltyRecipientUpdated`.
- Create UX wireframes for collection grid, token page, list modal, buy modal, offer panel, owner offer inbox, cancel listing, accept offer, and withdraw proceeds.
- Choose indexing path: lightweight backend/indexer for MVP, or The Graph if the team already uses it.
- Send this audit scope to auditors for quote and reserve an audit slot before Solidity implementation starts.

Acceptance criteria:

- Function signatures, events, storage layout, and royalty math are documented.
- All user flows have a clear wallet transaction sequence.
- Auditor has enough scope detail to quote.

## Week 2: Smart Contract Implementation and Tests

Deliverables:

- Implement `CollectionMarketplace.sol` against the frozen spec.
- Add Foundry tests for listing creation, cancellation, purchase, offer creation, cancellation, acceptance, expiration, ownership changes, approval removal, fee math, withdrawal, pausing, and unauthorized calls.
- Add fuzz tests for price, fee rounding, expirations, repeated listing/cancel cycles, and offer amounts.
- Add invariants for escrow/proceeds accounting, no stale listing settlement after ownership change, and no successful sale without NFT approval.
- Run Slither and fix actionable findings.
- Deploy to a local fork and Sepolia with a mock ERC-721.

Acceptance criteria:

- Unit, fuzz, invariant, and fork tests pass.
- Contract emits every event needed by the frontend/indexer.
- Mainnet deployment parameters are captured but not used until audit is complete.

## Week 3: Frontend, Indexing, and Staging

Deliverables:

- Build wallet connection and network guard for Ethereum mainnet.
- Build collection browsing from indexed events plus current owner/listing/offer state.
- Implement transaction flows:
  - approve marketplace
  - create listing
  - cancel listing
  - buy listing
  - make offer
  - cancel offer
  - accept offer
  - withdraw proceeds
- Show pending, confirmed, failed, expired, no-longer-owner, and approval-missing states.
- Implement event indexer and reconcile jobs so offchain active listings/offers cannot drift from contract truth.
- Deploy staging frontend against Sepolia.

Acceptance criteria:

- A non-technical holder can list, cancel, and accept an offer on staging.
- A buyer can buy and make/cancel an offer on staging.
- UI never presents a stale listing as guaranteed purchasable without rechecking contract state before transaction submission.

## Week 4: Hardening, Audit Handoff, and Launch Readiness

Deliverables:

- Freeze contract code for audit and tag the commit.
- Prepare audit package: source, dependency versions, deployment parameters, test report, coverage report, Slither output, known issues, architecture notes, and threat model.
- Run internal security review against the audit scope below.
- Run end-to-end staging QA with multiple wallets and contract-wallet buyers.
- Prepare mainnet deployment runbook:
  - deploy contract
  - verify source
  - transfer ownership to artist/team multisig
  - set artist payout recipient
  - test one low-value listing or controlled token
  - enable production frontend
- Triage auditor questions and fix issues. Do not launch mainnet trading with real volume until Critical/High findings are fixed and Medium findings are either fixed or explicitly accepted.

Acceptance criteria:

- Audit-ready code is frozen.
- Staging MVP works end to end.
- Production deployment checklist is complete.

# Audit Scope for Quote

## Scope Summary

Quote a security review for one new Ethereum mainnet marketplace contract for an existing ERC-721 collection. The marketplace supports non-custodial fixed-price listings, escrowed ETH offers, atomic NFT transfer on purchase/offer acceptance, 2.5% artist royalty accounting, seller/offer cancellation, pull-based ETH withdrawals, and limited admin controls.

Estimated custom Solidity size: 250-500 nSLOC, excluding OpenZeppelin dependencies and tests.

## In-Scope Code

- `contracts/CollectionMarketplace.sol`
- Minimal interfaces or mocks used only for compilation/tests.
- Deployment script/config for constructor parameters.
- Tests that define intended behavior.
- OpenZeppelin dependency usage and inheritance integration.

If the final implementation adds WETH, EIP-712 signatures, Permit2, ERC-20 currencies, upgradeable proxies, batch listings, collection-wide offers, private sales, or bundle purchases, those must be quoted as explicit scope additions.

## Out-of-Scope Code

- The already deployed 2024 NFT collection contract, except for integration assumptions around `ownerOf`, approvals, and `safeTransferFrom`.
- Frontend application security, wallet-drainer/phishing review, DNS, hosting, CDN, analytics, Discord operations, and backend admin panels.
- Metadata/IPFS/Arweave content.
- Legal, tax, sanctions, and marketplace compliance review.
- Gas optimization beyond security-relevant gas griefing or denial-of-service issues.

## Required Auditor Checklist Areas

Use the EVM audit routing set for this contract type:

- `evm-audit-general`
- `evm-audit-precision-math`
- `evm-audit-erc721`
- `evm-audit-dos`
- `evm-audit-access-control`

Conditional additions:

- Add `evm-audit-erc20` if WETH or other ERC-20 offer currency is added.
- Add `evm-audit-signatures` if offchain signed orders, EIP-712, Permit2, or meta-transactions are added.
- Add `evm-audit-proxies` if an upgradeable deployment is added.
- Add `evm-audit-chain-specific` only if deployment expands beyond Ethereum mainnet.

## Security Properties to Verify

- A listed NFT remains in the seller wallet until a successful sale transaction.
- A listing cannot be bought after the seller no longer owns the NFT, removed approval, changed approval, canceled, or passed expiration.
- A seller cannot receive proceeds twice for the same listing.
- A buyer cannot underpay, overpay in a way that traps funds, or bypass the 2.5% artist fee.
- Fee math is exact: artist receives `salePrice * 250 / 10_000`; any rounding remainder goes to the seller.
- `buyListing` and `acceptOffer` are atomic: either NFT transfer and accounting both succeed, or neither changes.
- Offer escrow is fully collateralized before acceptance.
- Only the offer maker can cancel an offer.
- Only the current NFT owner can accept an offer.
- An offer cannot be accepted after expiration, cancellation, or refund.
- A buyer cannot grief acceptance with callbacks, reentrancy, or changed state after offer creation.
- Marketplace ETH balance always covers active offer escrow plus credited withdrawals.
- Withdrawals cannot be stolen, reentered, blocked by another user's failing withdrawal, or credited to the wrong account.
- Artist fee recipient changes cannot redirect already accrued proceeds.
- Pausing cannot trap user funds or prevent cancellation/withdrawal.
- Admin cannot change the fee above 2.5%; ideally fee bps is immutable.
- Direct ETH sends and accidental NFT/ERC-20 sends are handled or documented.
- Event emissions are complete and cannot mislead the indexer about final state.

## Threat Model

Actors to consider:

- Honest seller/listing owner.
- Honest buyer.
- Malicious seller who lists then transfers away, revokes approval, relists, or attempts stale settlement.
- Malicious buyer who overpays, underpays, reenters through a contract receiver, or spams/cancels offers.
- Current NFT owner accepting someone else's offer after secondary ownership changes.
- Malicious contract wallet receiving NFTs.
- Royalty recipient contract that reverts on ETH receipt.
- Admin/multisig with pause and royalty-recipient powers.
- Offchain indexer or frontend with stale data.
- MEV searcher observing buy or accept transactions.

## State Transitions to Review

| Function | Caller | Main Risk |
| --- | --- | --- |
| `createListing` | current NFT owner | stale approval/ownership assumptions, invalid price/expiry |
| `cancelListing` | listing seller | unauthorized cancellation, event/indexer drift |
| `buyListing` | buyer | reentrancy, stale listing, payment/fee errors, NFT callback behavior |
| `makeOffer` | buyer | escrow accounting, zero-value offers, expiry griefing |
| `cancelOffer` | offer maker | refund safety, double refund, cancellation after accept |
| `acceptOffer` | current NFT owner | accepting stale/expired offer, transfer failure, accounting mismatch |
| `withdrawProceeds` | credited account | reentrancy, failed ETH transfer, balance mismatch |
| `setRoyaltyRecipient` | owner/multisig | access control, redirecting old/new proceeds |
| `pause` / `unpause` | owner/multisig | excessive admin power, trapped funds |

## Expected Invariants

- `contract ETH balance >= totalActiveOfferEscrow + totalWithdrawableCredits`.
- For every active listing, `listing.seller` was the owner at listing time, but purchase must revalidate current owner and approval.
- For every successful sale, exactly one NFT moves from seller/current owner to buyer.
- For every successful sale, total credited proceeds equal sale price.
- For every successful sale, artist credit equals 2.5% rounded down.
- Canceled or expired listings/offers cannot settle.
- No external call can observe state that allows duplicate settlement.
- Paused state blocks new value-changing market actions but not user exits.

## Audit Deliverables Requested

- Written report with Critical/High/Medium/Low/Info findings.
- Severity definitions based on fund loss, permanent denial of service, accounting errors, trust-model violations, and best-practice issues.
- Proof-of-concept test or step-by-step reproduction for each Medium or higher finding.
- Concrete remediation guidance.
- One remediation review pass after fixes.
- Explicit statement on whether the reviewed commit is acceptable for Ethereum mainnet deployment.

## Materials to Provide Auditor

- Frozen Git commit hash.
- Contract source and dependency lockfile.
- Test command and expected passing output.
- Coverage report.
- Slither output.
- Architecture/spec document.
- Mainnet NFT contract address.
- Intended marketplace owner/multisig address.
- Intended artist royalty recipient address.
- Deployment constructor arguments.
- Known limitations and accepted tradeoffs.
