# On-site Marketplace for the Collection — 4-Week MVP Plan + Audit Scope

Goal: move holder-to-holder trading out of Discord DMs and onto our site. Non-escrow
listings, instant buys, buyer offers accepted later, 2.5% to the artist on every resale,
seller-cancellable listings.

---

## 0. Decisions made up front

| Decision | Choice | Why |
|---|---|---|
| Chain | **Ethereum mainnet** | The collection is already there. This is not a chain choice — moving it would mean bridging/wrapping 5,000 NFTs, which is a bigger project than the marketplace. |
| Contract count | **1** (`CollectionMarket.sol`) | Listings, offers, settlement and royalty split all live in one ~350-line contract. No factory, no escrow contract, no proxy. |
| Escrow | **None.** Approval-based | Required by the brief, and it is the industry-standard model (OpenSea/Blur). Owner keeps the piece; market only moves it at fill time. |
| Order storage | **Onchain**, not offchain signed orders | Post-Fusaka mainnet gas is ~0.1 gwei: a listing write costs roughly **$0.02–$0.05**. Paying a few cents to list removes EIP-712 signing, an order-relay backend, signature replay/cancellation logic, and a whole audit domain. This is the single biggest cost and risk reduction in the plan. |
| Offer currency | **WETH** (`0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`) | An offer that isn't escrowed can't be made in native ETH — the contract has no way to pull ETH from a buyer later. Buyer wraps ETH → approves WETH → offer is a claim backed by balance + allowance. Frontend wraps in one click. |
| Upgradeability | **None** | Immutable contract, redeploy if we ever need to change it. A proxy adds an admin key that can steal every approved NFT in the collection. Not worth it. |
| Admin powers | Pause only, held by a Gnosis Safe | Pause blocks new fills during an incident. It cannot touch NFTs or funds. |

**Considered and rejected:** listing through Seaport/Reservoir with zero contracts of our own.
That is genuinely the cheapest path (no contract, no audit, ~1 week) and the listings would
also show up on OpenSea. We are not taking it because it puts the artist's 2.5% at the mercy
of a third-party marketplace's royalty policy — the thing this project exists to guarantee.
Worth one explicit "no" from you before week 1 starts, because it saves the entire audit budget.

### What is onchain vs offchain

- **Onchain:** listing (seller, price, expiry), offer (buyer, amount, expiry), cancellation, settlement, royalty split.
- **Offchain:** browse/search/sort, images and metadata (already on IPFS), activity feed, price history, notifications. All of it reads from indexed events — never from a contract call in a loop.

---

## 1. Contract surface (freeze this in week 1; the auditor quotes from it)

`CollectionMarket.sol` — immutable `nft` address (our collection, hardcoded), immutable `weth`,
immutable `royaltyReceiver`, constant `ROYALTY_BPS = 250`.

| Function | Caller | Effect |
|---|---|---|
| `list(tokenId, price, expiry)` | current owner | Records listing. Requires market is approved for that token. |
| `updatePrice(tokenId, newPrice)` | seller | Rewrites price in place. |
| `cancelListing(tokenId)` | seller | Deletes listing. |
| `buy(tokenId, maxPrice)` payable | anyone | Validates owner + approval + expiry + `price <= maxPrice`, deletes listing, pulls NFT seller→buyer, splits ETH. |
| `makeOffer(tokenId, amount, expiry)` | anyone but the owner | Records offer in WETH. No escrow; backed by balance + allowance. |
| `cancelOffer(tokenId)` | offerer | Deletes offer. |
| `acceptOffer(tokenId, buyer, minAmount)` | current owner | Validates offer + expiry + `amount >= minAmount`, deletes offer **and any listing**, pulls WETH buyer→split, pushes NFT owner→buyer. |
| `withdraw()` | anyone with credit | Pull-payment fallback (see below). |
| `pause()` / `unpause()` | Safe | Blocks `buy`/`acceptOffer` only. |

`maxPrice` / `minAmount` are the anti-front-run guards: a seller cannot raise the price into
your pending buy, and an offerer cannot lower the offer into your pending accept.

**Payout rule (both fill paths, identical):** `royalty = price * 250 / 10_000`,
`sellerProceeds = price - royalty`. Seller is paid first; if the royalty send fails (artist
address is a contract that reverts), the amount is credited to `withdrawable[artist]` instead
of reverting the sale. Same for a seller that can't receive ETH. No sale ever fails because a
recipient misbehaves, and no wei is ever stranded.

**Stale-listing rule:** listings are not invalidated by an ERC-721 transfer — there's no hook
for that. So every fill re-checks `ownerOf(tokenId) == listing.seller` and that the market is
still approved. If a piece moved or approval was revoked, the fill reverts cleanly rather than
executing a ghost order. The indexer marks such listings dead in the UI.

### State-transition audit (the "who calls this and why" pass)

Every function above is user-initiated and self-interested. Nothing depends on a keeper, a cron,
or an admin: if nobody calls anything, listings simply expire and owners keep their pieces. The
only state that can go stale without a caller is a dead listing, handled by the fill-time recheck.

---

## 2. Four-week schedule

### Week 1 — Recon, spec freeze, audit quote

The recon is not optional; three facts about the 2024 contract change the design:

1. **Does it implement ERC-2981 (`royaltyInfo`)?** If yes we read the royalty from the token
   contract and only fall back to the hardcoded 250 bps. If no, 250 bps to a fixed artist
   address is the whole mechanism.
2. **Does it use an operator filter / ERC-721C transfer hook?** Many 2024 collections shipped
   OpenSea's `OperatorFilterRegistry`. If ours did, our marketplace address may be **blocked
   from transferring** and every buy reverts. Find out in week 1, not week 4. Fix is either
   registering the market or (if the owner key allows) disabling the filter.
3. **Who controls the collection contract owner key, and is there a `setApprovalForAll` quirk?**

Deliverables: recon memo, frozen `CollectionMarket.sol` interface + NatSpec, invariant list,
the audit scope in §3 sent to 2–3 firms for quotes.

### Week 2 — Contract + tests

- Implement against OpenZeppelin v5 (`IERC721`, `SafeERC20`, `ReentrancyGuard`, `Pausable`, `Ownable2Step`). Nothing hand-rolled.
- Foundry: unit tests per function; **fuzz** the royalty split across the full price range (assert `royalty + proceeds == price` exactly, and `royalty == price*250/10000` with no rounding drift); **fork tests against the real collection at a pinned mainnet block**, using real holder addresses via `vm.prank` — this is what catches the operator-filter problem for real.
- Invariant tests: market holds no NFT and no ETH beyond `sum(withdrawable)`; a filled or cancelled order can never fill again.
- Adversarial tests: reentrant buyer via a malicious receiver; seller who transfers the piece away mid-flight; offerer who drains their WETH before accept; royalty recipient that reverts.
- `slither .` clean, coverage ≥95% on custom lines. **Tag the commit — this exact hash goes to the auditor.**

### Week 3 — Frontend + indexer, audit runs in parallel

- Scaffold-ETH 2 / wagmi. Flows: connect → switch to mainnet → **approve this token** → list; browse → buy; wrap ETH → approve WETH → offer; owner inbox → accept.
- Default to **per-token `approve(market, tokenId)`**, not `setApprovalForAll`. It's one extra transaction at a few cents and it caps the blast radius of a marketplace bug to the pieces actually listed. Offer `setApprovalForAll` only to holders listing several pieces at once, with a plain-language warning.
- Never infinite-approve WETH: approve exactly the offer amount.
- Indexer (Ponder or a Graph subgraph) over `Listed / PriceUpdated / Cancelled / Sold / OfferMade / OfferCancelled / OfferAccepted / RoyaltyPaid / RoyaltyCredited`, plus the collection's own `Transfer` events so dead listings get flagged immediately.
- Loading and pending states on every write (12s blocks), human-readable ETH via `formatEther`.
- Sepolia deploy with a mock 5,000-piece collection; run the Discord regulars through it.

### Week 4 — Fixes, re-review, ship

- Days 1–3: fix audit findings, add a regression test per finding, auditor fix-review round on the new hash.
- Day 4: deploy to mainnet, verify on Etherscan, transfer ownership to the Safe, smoke-test with one real 0.001 ETH sale and one real offer between two team wallets.
- Day 5: frontend to Vercel + IPFS behind an ENS subdomain, Discord announcement with a "how to list" walkthrough, monitoring dashboard, and a written incident plan (who holds Safe keys, what pausing does and doesn't do, how we tell holders to revoke approvals).

**Risks to the four weeks:** an operator filter on the collection (week 1 finding, could cost days), auditor availability (book in week 1 for a week-3 slot — this is the most likely slip), and ERC-2981 absence forcing a hardcoded artist address that can never change.

---

## 3. Audit scope — the document you send for a quote

**Target:** `CollectionMarket.sol`, single file, ~350 SLOC, commit hash `<frozen end of week 2>`,
Solidity 0.8.28, Foundry, OpenZeppelin Contracts v5.x. No proxy, no assembly, no upgradeability,
no admin ability to move user assets.

**System description:** Non-escrow ERC-721 marketplace for one hardcoded 5,000-piece mainnet
collection. Onchain listings in native ETH, onchain offers in WETH. Fixed 2.5% royalty to a
fixed artist address on every fill. No protocol fee. Sellers retain custody and grant per-token
(or, at their option, collection-wide) approval.

**In scope**
- `CollectionMarket.sol` in full, every function in §1.
- Its interaction assumptions with the collection contract at `<address>` (approval semantics, transfer hooks / operator filter, ERC-2981 if present) and with canonical WETH.
- The deployment script and the post-deploy ownership-transfer procedure.
- The Foundry test suite, reviewed for coverage gaps rather than audited as product.

**Out of scope**
- The 2024 collection contract itself (deployed, immutable, not ours to change) — but please flag any assumption we make about it that does not hold.
- Frontend, indexer, subgraph.
- Canonical WETH and OpenZeppelin library internals.
- Economic/market design (price discovery, wash trading).

**Trust assumptions to validate, not accept**
- Owner is a 3-of-5 Gnosis Safe whose only powers are `pause`/`unpause`. Confirm no admin path can move an NFT, redirect a payout, or change the royalty destination.
- `royaltyReceiver` and `ROYALTY_BPS` are immutable/constant. Confirm no fill path can route around them.
- Contract is not upgradeable and holds no assets at rest.

**Threat model / actors:** malicious buyer, malicious seller, malicious offerer, malicious
royalty recipient, malicious NFT holder contract, MEV searcher watching the mempool, compromised
Safe signer (should be able to cause at most a denial of service).

**Invariants to break** (please treat these as the deliverable's spine)
1. `royalty == price * 250 / 10000` and `royalty + sellerProceeds == price` exactly, on both the buy path and the accept-offer path, for every price including 1 wei and `type(uint96).max`.
2. The artist is paid or credited on **every** completed transfer of ownership through this contract. There is no fill path that skips the cut.
3. A listing or offer, once filled or cancelled, can never be filled again.
4. A fill only succeeds if `listing.seller` is the current `ownerOf(tokenId)` at execution time.
5. A buyer never pays more than `maxPrice`; a seller never receives less than `minAmount`.
6. `address(this).balance >= sum(withdrawable)` at the end of every transaction; the contract never holds an NFT across transactions.
7. Pausing blocks fills and cannot trap a seller's ability to cancel or a creditor's ability to withdraw.

**Checklist domains we believe apply** (7, deliberately narrow — see the exclusions, which should be reflected in the quote)
1. General EVM security — reentrancy across the ETH, WETH and NFT callbacks; CEI ordering.
2. Precision / math — the 250 bps split, rounding, dust, `uint96` price packing and overflow at cast boundaries.
3. ERC-721 integration — non-escrow approval semantics, stale-listing and re-listing edge cases, transfer hooks, `safeTransferFrom` receiver callbacks.
4. ERC-20 integration — WETH allowance/balance races, `SafeERC20` usage, offer backed by funds that vanish before accept.
5. Access control — `Ownable2Step`, pause scope, per-function caller checks.
6. DoS vectors — reverting royalty or seller recipient, gas-griefing receivers, unbounded loops (there should be none), pause abuse.
7. MEV / ordering — price-change front-running, the `maxPrice`/`minAmount` guards, sandwiching an accept, expiry handling.

**Explicitly excluded domains** (drivers of a lower quote): no signatures/EIP-712 (orders are onchain, so no replay, no offchain cancellation), no proxies or upgradeability, no oracles, no AMM/lending/staking math, no flash loans, no governance, no bridges, no account abstraction, no assembly.

**What we hand over:** tagged repo + commit hash, this scope document, the §1 function table with
NatSpec, the invariant list, the week-1 recon memo on the collection contract, test suite with
coverage report, Slither output with any suppressions justified, deployment script, and a
one-page diagram of the two fill paths.

**Deliverables we want back:** findings report with severity ratings and concrete exploit paths,
an explicit verdict on each of the seven invariants above, a note on any assumption about the
collection contract that we got wrong, and **one fix-review round** on the post-remediation
commit inside week 4. Please quote the fix-review round separately if it isn't included.

**Timeline:** scope frozen and quote requested end of week 1; code frozen and handed over end of
week 2; audit window week 3; remediation and fix review week 4; mainnet deploy day 4 of week 4.
