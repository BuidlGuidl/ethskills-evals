# Four-week NFT marketplace MVP and audit scope

## 1. MVP definition and decisions

Build a single-collection, non-custodial marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. A seller signs a fixed-price listing and keeps the NFT until purchase. A buyer pays ETH to fill that listing atomically. A buyer may also sign a WETH offer; the current owner can accept it later and settlement pulls WETH from the buyer. Every successful secondary sale sends 2.5% of the gross price to the artist and 97.5% to the seller.

This plan assumes the existing collection is a conventional ERC-721 with `ownerOf`, `getApproved`, `isApprovedForAll`, and `safeTransferFrom`, and that it has no transfer restrictions, staking wrapper, or unusual callback behavior. Confirm the deployed address, chain ID, artist payout address, contract source/verification status, proxy status, and royalty behavior in week 1.

### Deliberate MVP constraints

- One immutable collection address, one immutable WETH address, one immutable artist recipient, and a fixed immutable royalty of 250 basis points. There is no admin key that can change fees, recipients, collection, or currency after deployment.
- Listings settle in native ETH. Offers settle in canonical mainnet WETH. No ERC-20 list prices, trait bids, collection bids, auctions, bundles, partial fills, private sales, platform fee, or fee-on-transfer tokens.
- Orders are EIP-712 signatures stored/indexed off chain, not escrowed on chain. The settlement contract is the source of truth for fills and cancellations.
- A listing is fillable only while the signer still owns the NFT and the marketplace is approved. An offer is fillable only while the buyer has enough WETH balance and allowance. The UI must label an order unavailable if any of these conditions changes. A signed order is not a guarantee of execution.
- Each order has a unique maker nonce, token ID (for listings and token-specific offers), price, and expiry. Orders cannot be partially filled. Expiry is required and checked on chain.
- Cancellation is an on-chain transaction marking the order hash cancelled. The MVP may also support invalidating all orders below a maker-controlled minimum nonce; if it is not implemented, remove it from both code and audit scope rather than adding it late.
- Royalty is enforced only for sales settled through this contract. It cannot force payment on direct transfers or other marketplaces. The frontend must not describe it as universal on-chain royalty enforcement.
- No upgradeable proxy, pausing, owner withdrawals, arbitrary calls, custody vault, or deployer-only operational functions.

## 2. Proposed system

### Smart contract

A compact `CollectionMarketplace` contract will:

1. Verify an EIP-712 `Listing` or `Offer` signature, including domain (`name`, `version`, Ethereum mainnet chain ID, verifying contract), maker, collection, token ID, price, nonce, expiry, and order kind.
2. Derive the order hash and reject expired, filled, or cancelled orders.
3. For `buyListing`, require the listing maker is the current owner, require exact `msg.value == price`, mark the order filled before external calls, transfer the NFT seller-to-buyer, and pay ETH royalty/seller proceeds.
4. For `acceptOffer`, require the caller is the current owner, mark the order filled before external calls, pull the gross price in WETH from the offer maker, transfer the NFT owner-to-buyer, and distribute WETH royalty/seller proceeds.
5. Let the maker cancel one signed order by its full order data/hash, and optionally invalidate older nonces if that feature survives the week-1 freeze.
6. Emit complete events for listing purchase, offer acceptance, cancellation, and nonce invalidation. Events include order hash, maker, seller, buyer, token ID, gross price, royalty amount, and currency.

Use OpenZeppelin pinned dependencies for EIP-712/signature checking, reentrancy protection, safe ERC-20 transfers, and ERC-721 interfaces. Support both 65-byte EOAs and ERC-1271 contract-wallet signatures unless the week-1 compatibility spike shows a material schedule risk; any removal must be called out before the auditor quotes.

For ETH settlement, use pull payments (`pendingWithdrawals[recipient]` plus `withdraw`) for seller and artist proceeds so a recipient that rejects ETH cannot block the NFT sale. For WETH settlement, transfer the royalty and proceeds directly with `SafeERC20`; no WETH remains intentionally custodied by the marketplace. The precise transfer order and behavior with nonstandard collection receivers must be frozen before audit.

Royalty arithmetic is `royalty = price * 250 / 10_000`, rounded down, and `sellerProceeds = price - royalty`; this preserves the gross exactly. Zero-price orders are rejected.

### Web application and indexer

- Wallet connection, mainnet network guard, collection gallery, token detail, activity, and “my items/orders” views.
- Create listing: verify ownership, request `setApprovalForAll` if needed, set price/expiry, sign EIP-712 order, then submit it to the order API. Signing is gasless; approval and cancellation are transactions.
- Buy: revalidate order status via RPC immediately before prompting, simulate the transaction, submit exact ETH, and show pending/confirmed/reverted states.
- Make offer: collect token, WETH amount, and expiry; guide the buyer through wrapping ETH and approving exact/adequate WETH as separate transactions; sign and publish the offer.
- Accept offer: revalidate ownership, marketplace approval, signature, expiry, buyer WETH balance/allowance, and order status; simulate, then submit.
- Cancel: send the on-chain cancellation, wait for confirmation, and remove the order from active results. A UI-only deletion is never presented as cancellation.
- Backend stores signed order payloads and serves only schema-valid orders. An indexer consumes marketplace events and reconciles ownership and order state after reorg-safe confirmation depth. Reads may be cached, but every transaction is validated by the contract.
- Metadata and images are treated as untrusted: sanitize URLs/content, use a controlled image proxy or strict content policy, and never render arbitrary HTML/SVG script in the app origin.

## 3. Four-week build plan

### Week 1 — specification freeze and contract skeleton

- Verify the collection and WETH contracts on mainnet; document collection edge cases and current royalty configuration.
- Freeze typed-data schemas, exact settlement sequences, event schema, cancellation semantics, expiry limits, ETH withdrawal behavior, ERC-1271 support, confirmation depth, and deployment addresses/roles.
- Produce threat model and invariants; obtain auditor acknowledgement that the scope below is quoteable.
- Set up Solidity project, pinned compiler/dependencies, linting, formatting, unit/fuzz test harness, CI, deterministic deployment script, and Sepolia configuration.
- Implement hashing/signature verification, order-state storage, cancellation, and the first listing settlement path.
- Scaffold UI wallet/network handling and read-only collection gallery.

Exit criteria: signed spec and diagrams; test vectors prove frontend and Solidity produce identical hashes; listing happy path works locally; no unresolved feature decisions affecting public/external functions.

### Week 2 — complete settlement and order service

- Complete ETH listing purchase, pull-payment withdrawal, WETH offer acceptance, royalty split, events, replay protection, reentrancy defenses, and ERC-1271 handling.
- Add unit tests for every branch plus fuzz/property tests for price splits, state transitions, nonce/hash uniqueness, expiry, replay, cancellation, ownership/approval changes, WETH balance/allowance failure, malicious ETH recipients, callbacks, and signature malleability/wrong domains.
- Implement order API validation/storage and event indexer with idempotency, checkpointing, and reorg recovery.
- Implement listing, buying, offer, acceptance, cancellation, wrapping/approval, and transaction-state UI flows.

Exit criteria: feature-complete contracts; all contract tests and static analysis pass; end-to-end happy paths work on a local fork; API never treats off-chain deletion as cancellation.

### Week 3 — integration, adversarial testing, and audit candidate

- Deploy to Sepolia and run end-to-end tests using EOA and supported smart-contract wallets.
- Test stale orders, front-running/concurrent fills, ownership changes, revoked approvals, insufficient WETH, expired orders, rejected ETH, reverted NFT callbacks, RPC failure, duplicate events, and indexer rollback/replay.
- Run Slither/static analysis, coverage, gas snapshots, dependency/license checks, frontend security checks, and a mainnet-fork test against the actual collection and canonical WETH.
- Complete NatSpec, architecture/data-flow diagram, trust assumptions, deployment/runbooks, source-to-deployment reproducibility, and auditor handoff package.
- Freeze the audit commit and tag. Only auditor-requested fixes may change in-scope Solidity thereafter.

Exit criteria: audit candidate commit with no known high/critical issues, 100% line and branch coverage targeted for the small settlement contract (document any unreachable exception), successful fork and Sepolia test report, and a deployed frontend staging build.

### Week 4 — audit support, remediation, and launch readiness

- Auditor reviews the frozen commit while the team answers questions promptly; do not develop new contract features in parallel.
- Triage findings, implement minimal fixes, add a regression test for each finding, and submit one clearly documented remediation commit for auditor verification.
- Perform deployment rehearsal: bytecode/source verification, constructor argument checks, mainnet chain/address assertions, signer hardware-wallet procedure, gas funding, rollback/abort conditions, and monitoring alerts.
- Conduct product QA, accessibility/mobile checks, analytics/privacy review, support documentation, incident response tabletop, and a limited internal/beta transaction exercise.

Exit criteria: auditor confirms remediation status; exact deploy commit and constructor arguments approved by two people; frontend/API/indexer production checks pass. Mainnet deployment is a separate go/no-go decision and occurs only after the final audit report. If material findings are unresolved, launch slips rather than compressing remediation.

## 4. Quote-ready smart-contract audit scope

The auditor should quote a manual security review plus automated analysis and remediation verification for the following frozen implementation. File names and source lines will be supplied with the week-1 specification and updated with exact non-comment/non-blank SLOC at audit-candidate freeze.

### In-scope production code

| Component | Expected size | In-scope behavior |
|---|---:|---|
| `src/CollectionMarketplace.sol` | 250–400 SLOC | EIP-712 order hashing, signature validation (EOA/ERC-1271), listing fill with ETH, offer fill with WETH, NFT transfer, 2.5% split, fill/cancel state, optional minimum-nonce invalidation, ETH credits/withdrawal, events, reentrancy protection |
| `src/interfaces/ICollectionMarketplace.sol` | 50–100 SLOC | Structs, events, errors, and external interface |
| `script/Deploy.s.sol` | 40–80 SLOC | Chain/address validation, constructor arguments, deterministic/reproducible deployment |
| Directly imported OpenZeppelin contracts | pinned version | Integration correctness only; upstream library internals are not re-audited unless modified |

Target total custom production scope: **340–580 SLOC**, one deployable contract, no proxy. If implementation exceeds 650 SLOC, introduces another deployable contract, changes dependencies, or adds a public/external function after quote, request a scope/price adjustment before proceeding.

Tests, mocks, frontend, API, indexer, CI, and documentation are supplied as review context but are not part of the smart-contract security opinion unless separately quoted. The auditor should use them to understand intended behavior and may identify inconsistencies.

### Expected external/public surface

The final names may change at specification freeze, but the capability count may not change without re-scoping:

- `buyListing(Listing, bytes signature) payable`
- `acceptOffer(Offer, bytes signature)`
- `cancelListing(Listing)` and `cancelOffer(Offer)`, or one type-tagged `cancelOrder(bytes32 orderHash)` that cryptographically binds the caller as maker
- Optional `invalidateNoncesBelow(uint256 newMinimum)` (include in quote; delete if rejected at freeze)
- `withdraw()` for accrued ETH proceeds
- Read-only order hashing/status, domain separator, pending withdrawal, constants, and nonce getters
- ERC-721 receiver support is not expected because the contract never takes NFT custody; adding it requires review

There are no privileged setters, rescue functions, arbitrary-call functions, upgrade hooks, fallback settlement behavior, or self-destruct paths.

### Security properties and attack classes to review

The audit must assess at least:

- **Authorization:** only a valid maker signature can create fill authority; only the current NFT owner can sell/accept; only an order maker can cancel or invalidate its applicable nonces; ETH credits can only be withdrawn to/by their beneficiary.
- **Domain separation/replay:** signatures cannot replay across order kind, token ID, maker, price, nonce, expiry, collection, marketplace contract, chain, or a prior fill/cancellation. Listings and offers with identical fields cannot collide. Fork/chain-ID behavior is correct.
- **Atomic settlement:** a successful fill transfers exactly one specified NFT to the intended buyer and accounts/transfers exactly the gross consideration; any failure reverts the full fill except that already-accounted ETH proceeds remain safely withdrawable. Filled/cancelled orders cannot fill again.
- **Royalty/accounting:** artist receives exactly `floor(price*250/10000)` and seller receives the remainder on both paths; no rounding overflow, trapped value, double credit, fee bypass within an in-scope fill, or unowned surplus.
- **Non-custody:** listings never transfer NFTs or payment to the marketplace. Offers never deposit funds; acceptance uses buyer WETH allowance. ETH retained after a sale is limited to accounted pending withdrawals.
- **External calls:** reentrancy through NFT callbacks, ERC-1271 signers, ETH withdrawal recipients, and token contracts cannot double-fill, alter accounting, steal assets, or bypass cancellation. Checks/effects/interactions and revert behavior are sound.
- **Order liveness/state changes:** transfer of NFT, approval revocation, WETH balance/allowance changes, expiry, cancellation, simultaneous fills, and front-running fail safely. Anyone may submit a valid fill, but proceeds and NFT destinations cannot be redirected.
- **Token integration:** correctness with the actual ERC-721 and canonical mainnet WETH, `SafeERC20` use, approval assumptions, `safeTransferFrom` behavior, and contract-wallet signatures. The contract rejects any nonconfigured collection/currency.
- **ETH safety:** exact `msg.value`, forced ETH, failed recipient withdrawals, withdrawal reentrancy, and accounting solvency. Forced/unaccounted ETH handling is documented; no admin sweep is assumed.
- **Denial of service/griefing:** malicious makers, recipients, signatures, callbacks, zero price, extreme values, expired orders, storage growth, gas griefing, and inability of the artist to receive ETH do not improperly lock sales or third-party funds.
- **Deployment/configuration:** mainnet chain assertion, exact collection/WETH/artist addresses, 250 bps constant, compiler settings, dependency pinning, constructor immutability, source verification, and deployed bytecode reproducibility.

### Explicit audit assumptions

- Ethereum mainnet consensus and canonical WETH are trusted. WETH is not fee-on-transfer, rebasing, or malicious.
- The named ERC-721 follows the behavior verified during week 1. Its own code, metadata availability, and historical mint are not re-audited; only marketplace integration is.
- The artist address is correct and can be a contract that rejects ETH, which is why ETH uses withdrawable credits.
- Makers understand signatures authorize fills until on-chain expiry, fill, or cancellation. Compromise of user wallets, phishing, malicious wallet software, and leaked keys are outside the contract's ability to prevent.
- Off-chain availability/order moderation may hide a valid order but cannot make an invalid order settle. Miner/validator transaction ordering and ordinary front-running are inherent; destination and price are signature-bound.

### Out of scope unless separately quoted

- Existing collection contract internals, WETH internals, OpenZeppelin internals, wallet/browser extensions, RPC providers, metadata hosts, image proxy, DNS/CDN, and underlying Ethereum consensus.
- Frontend, order API/database, indexer, reorg logic, cloud/IAM, monitoring, analytics, and operational key management. These receive internal security testing; a separate web/backend assessment is recommended before broad launch.
- Economic appraisal, wash trading, stolen-NFT adjudication, sanctions/tax/legal compliance, marketplace terms, royalty enforceability outside this marketplace, and MEV prevention.
- Features excluded from the MVP: auctions, bundles, collection/trait bids, multiple collections/currencies, private orders, delegated wallets, bulk fills/cancels, partial fills, platform fees, mutable royalties, upgradeability, bridging, lending, staking, and custody.
- Mainnet deployment transaction execution and post-deployment monitoring, except review of the supplied deployment script/configuration.

### Auditor deliverables requested in the quote

- Kickoff/specification review and one primary manual audit of the frozen commit.
- Finding report with severity, exploit scenario, affected code, recommendation, and acknowledgement of known/accepted risks.
- Review of test adequacy and independent adversarial tests or proof-of-concept for material findings.
- One remediation review of a single fix commit/diff, with finding statuses updated.
- Final report naming repository, exact commit hashes, compiler/settings, dependencies, in-scope files/SLOC, limitations, and unresolved findings; a public-report version if available.
- Quote assumptions: auditor headcount, review days, calendar dates, timezone/contact channel, response SLA, price/payment terms, what triggers re-scoping, and cost/timing of additional remediation rounds.

## 5. Pre-audit handoff checklist

Provide the auditor, before their start date:

- Repository access; frozen commit/tag; exact custom SLOC report; clean build/test/static-analysis commands; compiler and pinned dependency lockfiles.
- Architecture and settlement sequence diagrams; typed-data schemas and known-good hash/signature vectors; contract API/NatSpec and event definitions.
- Mainnet addresses for collection, WETH, artist recipient, intended deployer, chain ID, and links to verified collection/WETH source.
- Threat model, invariants, known issues/accepted risks, coverage report, fuzz configuration/seeds, Slither output with triage, gas report, Sepolia addresses, and mainnet-fork test results.
- Deployment and verification scripts, expected constructor arguments, compiler optimizer settings, expected bytecode/hash, operational runbook, and incident contacts.
- A written change-control rule: any in-scope code change after freeze is sent as a diff; feature additions or meaningful SLOC/dependency/interface changes require auditor approval and may be re-quoted.

## 6. Launch acceptance criteria

Launch only when the exact audited commit is deployed and verified, constructor constants match the approved addresses/250 bps, all tests and production smoke checks pass, and no unresolved critical or high-severity finding remains. Medium findings require written remediation or explicit risk acceptance by the project owner and auditor-visible status. Monitor fills, cancellations, withdrawals, reverts, indexer lag, and balance/accounting invariants from block one. Start with a clearly announced limited beta and retain a frontend kill switch that can stop new order publication and transaction prompts; it cannot and should not pretend to pause the immutable contract or invalidate already signed orders.
