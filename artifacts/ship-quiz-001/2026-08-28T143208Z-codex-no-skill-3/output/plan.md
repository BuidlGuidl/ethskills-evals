# NFT Marketplace MVP: Four-Week Build Plan and Audit Scope

## 1. MVP outcome

Ship a collection-specific, non-custodial marketplace for the existing 5,000-token Ethereum mainnet ERC-721 collection. A connected wallet can:

- create a fixed-price listing;
- cancel its listing;
- buy a valid listing with ETH;
- create or cancel an offer funded with WETH approval;
- accept a valid offer as the current token owner; and
- see the artist receive 2.5% of every sale executed by this marketplace.

The NFT never enters marketplace escrow. A listing or offer is an EIP-712 signed order stored and indexed off chain; settlement is atomic on chain. At settlement, the contract transfers the NFT, pays the artist fee, and pays the seller. If any leg fails, the entire transaction reverts.

This MVP enforces the 2.5% artist payment only on trades routed through this marketplace. It cannot force payment on direct wallet transfers or other marketplaces unless the existing NFT contract already implements a compatible enforced-transfer mechanism. That limitation must be stated in the UI and launch documentation.

## 2. Decisions to freeze before implementation

These inputs are required by the end of Day 2 and become audit assumptions:

| Item | MVP decision |
|---|---|
| Network | Ethereum mainnet; Sepolia for staging |
| Collection | One immutable, allowlisted ERC-721 contract address; confirm standard `ownerOf` and `safeTransferFrom` behavior |
| Currency | ETH for listings; canonical WETH for standing offers |
| Price type | Exact fixed price only; no auctions, bundles, partial fills, or collection-wide bids |
| Royalty | Exactly 250 basis points of gross sale price, paid to one configured artist recipient |
| Platform fee | None in MVP |
| Order format | EIP-712 signed order, bound to chain ID and settlement contract |
| Listing approval | Seller approves the settlement contract for the token or collection |
| Offer funding | Buyer retains WETH and grants allowance; no marketplace deposit or custody |
| Expiry | Required timestamp on every listing and offer; UI defaults to a short, explicit duration |
| Cancellation | On-chain per-order cancellation plus account nonce invalidation for bulk cancellation |
| Upgrades/admin | Prefer immutable, non-upgradeable deployment; no emergency asset custody or arbitrary trade controls |

For standing offers, native ETH cannot be pulled from a wallet later. WETH plus ERC-20 allowance preserves non-custodial funds, but an offer can become unfillable if the buyer spends the WETH or revokes allowance. The UI and indexer must display such offers as unfunded, and acceptance will revert safely.

## 3. Proposed settlement design

### Signed orders

Use one typed order structure with:

- `maker`;
- `side` (`LISTING` or `OFFER`);
- `tokenId`;
- `paymentToken` (zero address for ETH listing, canonical WETH for offer);
- `price`;
- `expiry`;
- unique `salt`; and
- maker `nonce`.

The EIP-712 domain includes contract name/version, current chain ID, and verifying settlement contract. Orders with zero price, unsupported payment tokens, expired timestamps, wrong side, reused salts/order hashes, or invalid signatures are rejected. Support ordinary EOA signatures and ERC-1271 contract-wallet signatures if confirmed within the audit quote; otherwise contract wallets are explicitly unsupported in MVP.

### Settlement paths

`buy(listing, signature)` is payable. It validates the signature and exact `msg.value`, verifies the seller still owns and has approved the NFT, marks the order filled before external calls, transfers the NFT to the buyer, pays 2.5% to the artist, and pays the remainder to the seller.

`acceptOffer(offer, signature)` validates the buyer's signature, WETH balance and allowance, verifies the caller currently owns and has approved the NFT, marks the order filled before external calls, transfers the NFT to the offer maker, and pulls WETH directly from the buyer to the artist and seller. The owner accepting the offer is the seller and receives 97.5%.

Both paths use checks-effects-interactions, a reentrancy guard, safe token transfer behavior, exact integer fee calculation (`price * 250 / 10_000`), and emit canonical fill events. Failed payout or transfer reverts the complete sale; there are no marketplace-held balances and no withdrawal function.

### Cancellation and stale orders

- `cancel(order)` may be called only by its maker and permanently marks its hash cancelled.
- `incrementNonce()` invalidates all of the caller's orders using an older nonce.
- A filled or cancelled order cannot be replayed.
- A listing also becomes unfillable if ownership or approval changes.
- An offer also becomes unfillable if WETH balance or allowance falls below price.
- The indexer listens to marketplace cancellation/fill events plus ERC-721 and WETH state and labels stale orders; the contract remains the authority at execution.

### Payout behavior

The artist recipient is fixed at deployment if operationally possible. If recipient rotation is required, scope a narrowly controlled two-step change (`proposeRecipient` / `acceptRecipient`) with events, no fee-rate change, and a documented multisig owner. The settlement contract must not retain ETH, WETH, or NFTs during normal execution. Accidental direct transfers and rescue behavior must be decided before code freeze; the lowest-risk MVP rejects ERC-721 safe transfers and has no generic arbitrary-call rescue.

## 4. Four-week build plan

### Week 1 — specification, threat model, and contract skeleton

Deliverables:

- confirm collection address, artist recipient, canonical WETH, wallet support, and immutable/admin choices;
- inspect the deployed collection contract for ERC-721 compliance, transfer restrictions, operator filters, pause/freeze behavior, royalties, proxies, and unusual hooks;
- write the signed-order schema, domain separator rules, state machine, fee math, revert conditions, and event schema;
- produce sequence diagrams for list/buy, offer/accept, cancel, and nonce invalidation;
- document trust assumptions and threats: replay, stale ownership/approval, signature malleability, reentrancy, malicious recipients, fee-on-transfer/nonstandard tokens, front-running, and griefing;
- implement the settlement contract interfaces and core Foundry unit-test harness;
- define indexer/API schema and clickable frontend flows.

Exit criteria: signed technical specification approved; auditor confirms scope is quotable; no unresolved behavior affecting storage layout or external interfaces.

### Week 2 — contract implementation and full local tests

Deliverables:

- implement EIP-712 validation, fill tracking, cancellation, bulk nonce invalidation, ETH listing settlement, WETH offer settlement, artist payout, events, and reentrancy protection;
- implement deployment script with explicit chain/address assertions;
- add unit, fuzz, and invariant tests, including adversarial receiver and token mocks;
- build signing helpers shared by frontend/backend tests;
- begin indexer for signed orders and on-chain events;
- build wallet flows for approval, sign listing/offer, cancel, buy, and accept.

Exit criteria: all contract tests pass; statement/branch coverage target at least 95% for in-scope contracts; every externally callable path has success, authorization, replay, expiry, and failure tests.

### Week 3 — integration, staging, and audit handoff

Deliverables:

- deploy the frozen release candidate to Sepolia using a representative test collection;
- complete API/indexer persistence, order validation, deduplication, pagination, and stale/funded status;
- complete UI transaction previews showing price, 2.5% artist payment, seller proceeds, approvals, expiry, and failure reasons;
- add monitoring for fill/cancel events, RPC/indexer lag, failed transactions, and unexpected contract balances;
- run end-to-end tests with EOAs and, if scoped, ERC-1271 wallets;
- freeze contract commit, compiler/configuration, dependency lockfile, deployment parameters, NatSpec, architecture notes, and test instructions for the auditor.

Exit criteria: release candidate is feature-frozen and reproducibly builds from the tagged commit; audit package and deployed staging addresses are delivered. Only auditor-requested contract changes enter after freeze.

### Week 4 — audit response, hardening, and launch readiness

Deliverables:

- answer auditor questions and triage findings by severity;
- fix accepted findings in isolated commits and add a regression test for every contract change;
- return the exact diff to the auditor for remediation review;
- run final fuzz/invariant suite and end-to-end staging regression;
- rehearse mainnet deployment and source verification; independently verify constructor arguments, bytecode, addresses, and EIP-712 domain;
- complete incident runbook, support FAQ, monitoring dashboard, and go/no-go checklist.

Exit criteria: auditor signs off on remediation or explicitly records accepted risks; tagged bytecode matches reviewed source; mainnet deployment requires a two-person parameter check. If audit or remediation is incomplete, launch slips—Week 4 is not a guaranteed audit turnaround window.

## 5. Precise smart-contract audit scope

The audit quote should cover one Solidity repository at a frozen commit, compiled with a pinned Solidity 0.8.x compiler and optimizer settings, using pinned OpenZeppelin dependencies. Final file names and SLOC are supplied at code freeze; quote against the following maximum scope:

| Component | Responsibility | Estimated executable SLOC |
|---|---|---:|
| `CollectionMarketplace.sol` | Entry points, validation, fill/cancel state, settlement, fee split, events | 220–300 |
| `OrderHash.sol` | Order structs, constants, EIP-712 hashing | 50–80 |
| `ICollectionMarketplace.sol` | External structs, errors, events, interface | 50–80 |
| Deployment/config code | Network assertions and constructor arguments | 30–60 |
| **Maximum production scope** | Excludes tests and third-party libraries | **520 SLOC** |

If two-step artist-recipient rotation or ERC-1271 support is retained, it is included within the 520-SLOC cap and must be specifically tested. Any proxy, upgrade mechanism, additional currency, permit flow, auction, bundle, collection offer, fee change, or rescue function is a scope change requiring a revised quote.

### External contracts and dependencies to analyze at integration boundaries

- the exact deployed collection address and its implementation if proxied;
- canonical mainnet WETH and the exact Sepolia test equivalent;
- pinned OpenZeppelin `EIP712`, `ECDSA`, `ReentrancyGuard`, ERC-721, ERC-20, `SafeERC20`, and optionally `SignatureChecker` implementations;
- ERC-721 receiver behavior of buyer contracts and ERC-1271 behavior if supported.

Vendored OpenZeppelin and canonical WETH internals are not re-audited line by line, but their correct selection, configuration, inheritance, and use are in scope. The collection's full historical code is an integration dependency, not a fresh full audit, unless separately quoted.

### Required security properties and invariants

The auditor should explicitly assess and report on:

1. **Authorization:** only a valid maker signature can authorize an order; only the current NFT owner can accept an offer; only a maker can cancel its order or invalidate its nonce.
2. **Replay isolation:** an order cannot fill twice or after cancellation, nonce invalidation, or expiry; signatures cannot replay on another chain, deployment, side, token ID, price, or currency.
3. **Atomic consideration:** a successful sale transfers exactly one intended NFT, pays the artist `floor(price * 250 / 10_000)`, and pays the seller the exact remainder; otherwise all state and transfers revert.
4. **No custody:** the marketplace has no intended end-of-transaction NFT, ETH, or WETH balance and offers do not reserve buyer funds.
5. **Correct counterparties:** listing proceeds go to the signed listing maker; offer proceeds go to the current owner accepting; the NFT goes to the purchaser/offer maker; the fee goes only to the configured artist recipient.
6. **Order validity:** listings require current ownership and approval; offers require supported WETH, sufficient balance, and sufficient allowance at execution.
7. **Reentrancy safety:** ERC-721 receiver hooks, ETH recipient fallback code, ERC-1271 calls, and token callbacks cannot duplicate fills, alter payouts, or corrupt cancellation/nonces.
8. **Front-running resistance:** copying a signature cannot redirect the NFT or proceeds; public acceptance/buy transactions cannot change signed economics or recipients.
9. **Denial-of-service behavior:** reverting seller/artist/buyer contracts, revoked approvals, transferred NFTs, and insufficient funds fail safely; document any unavoidable order-specific liveness failure.
10. **Arithmetic and edge cases:** zero/very small prices, maximum values, rounding, timestamp boundaries, zero addresses, nonce behavior, salt collisions, malformed signatures, and ETH over/underpayment behave as specified.
11. **Admin safety:** if any admin path remains, it cannot seize assets, alter signed trade terms, retroactively invalidate fills, or bypass fee/payment rules; access control and two-step recipient rotation are correct.
12. **Event correctness:** fill, cancel, nonce, and recipient events uniquely and accurately describe state for indexers without being the source of settlement truth.

### Minimum tests included in the audit package

- unit tests for every external/public function, custom error, state transition, and event;
- fuzz tests for order fields, prices, deadlines, nonces, signatures, and payment amounts;
- stateful invariants for single fill, cancellation permanence, nonce monotonicity, conservation of sale proceeds, fixed fee rate, and zero marketplace balances after successful calls;
- adversarial tests using reentrant ETH recipients, rejecting recipients, ERC-721 receiver hooks, malformed ERC-1271 wallets if applicable, and nonstandard ERC-20 mocks;
- fork tests against the exact mainnet collection and WETH contracts, including ownership, approvals, transfers, and any operator restrictions;
- cross-chain/domain replay tests and front-running simulations;
- end-to-end tests for sign/list/buy, sign/offer/accept, individual cancel, bulk cancel, stale ownership, revoked approval, expired order, depleted WETH, and reused order.

### Auditor deliverables requested

- review of specification, production contracts, deployment/configuration, and relevant tests;
- manual review plus static analysis, fuzzing, and invariant testing at the auditor's discretion;
- findings with severity, exploit scenario, affected code, and recommended remediation;
- review of fixes against the frozen commit and a final report identifying resolved, acknowledged, and outstanding findings;
- confirmation of the exact commit hash, compiler/settings, in-scope files/SLOC, dependencies, and known limitations in the final report.

## 6. Explicitly out of audit scope

Unless separately quoted, exclude:

- frontend, visual design, wallet SDKs, API, database, indexer availability, search, analytics, and Discord migration;
- private-key security, multisig signer operations, RPC/provider compromise, DNS/CDN/hosting, and user-device compromise;
- the security of wallets, OpenSea or other marketplaces, bridges, L2s, and tokens other than canonical WETH;
- the full existing NFT collection implementation beyond marketplace integration review;
- token metadata, provenance, minting, rarity, and the original 2024 sale;
- universal/on-chain royalty enforcement outside trades settled by this contract;
- economic guarantees that signed offers remain funded or listings remain owned/approved;
- legal, tax, sanctions, consumer-protection, and securities analysis;
- post-audit changes or deployment parameters that differ from the reviewed artifact.

Frontend signature construction and indexer validation are not part of the smart-contract security audit, but they should receive an internal security review and end-to-end test because incorrect typed data can make orders unusable or misleading.

## 7. Audit package and quote assumptions

Send the auditor, before implementation, this plan plus the proposed interfaces/order schema and request a quote based on the 520-production-SLOC cap, one collection, two settlement paths, one ERC-20, no proxy, and one remediation review. At audit handoff provide:

- repository URL and frozen commit/tag;
- exact in-scope file list and `cloc` output;
- compiler, optimizer, EVM target, dependency versions, and lockfile;
- architecture/specification, threat model, trust/admin model, and known issues;
- test commands, coverage report, fuzz/invariant configuration, and fork RPC instructions;
- collection, WETH, artist recipient, deployer/multisig, staging, and proposed mainnet addresses;
- deployment and source-verification scripts plus expected constructor arguments;
- a list of deliberate exclusions and unresolved risks.

Assume one audit pass and one bounded remediation review. New features, architectural changes, dependency upgrades, or more than 520 production SLOC after quoting require written re-scoping. Reserve the mainnet launch date until the auditor confirms availability and remediation turnaround.

## 8. Product and operational acceptance checklist

Before mainnet launch:

- verify the existing collection permits marketplace operator transfers and decide whether users approve one token or the collection;
- show users that listings can go stale and WETH offers are not reserved funds;
- show an exact confirmation breakdown: gross price, 2.5% artist payment, seller proceeds, currency, gas, token ID, counterparty, and expiry;
- obtain explicit signatures only for displayed EIP-712 data—never blind messages or transactions;
- prevent the API from presenting expired, filled, cancelled, wrong-chain, wrong-contract, unowned, unapproved, or visibly unfunded orders as executable;
- independently reproduce and verify deployed bytecode and Etherscan source;
- monitor fills, cancellations, nonce changes, contract balances, and artist payments;
- publish contract addresses, supported collection/currency, audit report, known limitations, and verified links;
- retain a rollback plan for the website/indexer. Because the proposed immutable contract has no pause switch, a discovered contract issue is handled by removing the UI/API route, warning users, and deploying a separately audited replacement—not by pretending signed orders can be safely upgraded in place.
