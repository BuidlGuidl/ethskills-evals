# On-site Marketplace for the Collection — 4-Week MVP Plan + Audit Scope

Status: pre-implementation. Written to be handed to (a) the build team and (b) an
auditor for a fixed-price quote.

---

## 0. TL;DR for the decision-maker

- **Build one small, non-upgradeable, single-collection marketplace contract.**
  Off-chain signed orders (EIP-712), on-chain fill and cancel. No escrow, no
  custody, no admin access to funds or NFTs. Target ~400 lines of Solidity.
- **Listings settle in ETH. Offers settle in WETH.** This is not a style choice —
  an offer that can be accepted later *cannot* be paid in native ETH without
  escrow, and you asked for no escrow. WETH + allowance is the only non-custodial
  way to do "make an offer now, owner accepts later."
- **2.5% to the artist is enforced in the contract's single settlement path**, so
  listings and offers cannot diverge. It is not read from ERC-2981 at fill time
  (see §2.4).
- **Four weeks gets you code-complete, tested, and on a public testnet with the
  audit in progress. It does not get you audited-and-live on mainnet.** Contracts
  freeze end of week 2; audit runs weeks 3–4 in parallel with frontend work;
  mainnet launch lands in week 5–6 after fix + review. §1 and §5 lay out the
  honest calendar. If you need a hard mainnet date inside 4 weeks, the only
  lever is §6 Option B (no custom contract at all).
- **Three things must be verified in the first two days, before anyone writes the
  contract.** Any of them can change the design: the operator filter, ERC-2981
  presence, and whether a meaningful share of holders use smart-contract wallets.
  See §1 Week 1, Day 1–2.

---

## 1. Build plan

Roles assumed: 1 Solidity dev, 1 full-stack dev, 1 designer/PM part-time. Adjust
durations, not the ordering — the ordering is what makes the audit start on time.

### Week 1 — De-risk the existing collection, then write the contract

**Day 1–2: blocking investigation of the deployed 2024 contract.** Nothing about
the marketplace design is safe to fix until these answers are in. Deliverable is
a one-page findings note.

1. **Operator filter / transfer restrictions.** Many 2024-era ERC-721s shipped
   with OpenSea's `DefaultOperatorFilterer` or a similar allowlist on
   `transferFrom`/`setApprovalForAll`. If yours does, **your own marketplace
   contract will be blocked from moving tokens** and every buy will revert.
   Check: read the deployed source, look for `onlyAllowedOperator`,
   `OperatorFilterer`, `_beforeTokenTransfer` hooks, any `blocklist`/`allowlist`
   mapping. Then empirically fork mainnet and try an approval + transfer from a
   fresh contract address. If it is filtered, determine whether an admin key can
   disable it. *If it is filtered and cannot be disabled, stop and re-plan — this
   is a project-level blocker, not a detail.*
2. **ERC-2981.** Call `supportsInterface(0x2a55205a)` and `royaltyInfo(1, 1e18)`
   on the deployed contract. Record the recipient and bps it returns, if any.
3. **Interface conformance.** Confirm plain ERC-721: standard `ownerOf`,
   `getApproved`, `isApprovedForAll`, `transferFrom` semantics; no rebasing,
   no soulbinding, no staking lock, no non-standard approval clearing. Confirm
   token ID range (expected 1–5000 or 0–4999 — write it down, the indexer needs it).
4. **Admin surface.** Is there an owner key? Can it pause transfers, change
   royalties, or upgrade? Auditors will ask, and a pausable collection is a
   liveness dependency worth disclosing to users.
5. **Holder wallet mix.** Sample current holders from Transfer logs and check how
   many are contracts (Safe, Argent, smart accounts). If it is more than a couple
   of percent, **EIP-1271 signature support is MVP-mandatory, not optional** —
   without it those holders cannot sign a listing at all.

**Day 3–5: contract, first draft.** `CollectionMarket.sol`, single file, no
inheritance beyond OpenZeppelin `ECDSA`, `ReentrancyGuard`, `IERC721`, `IERC20`.

- Immutable constructor args: `nft` (the one collection address),
  `weth`, `royaltyReceiver`, `royaltyBps` (set 250, hard-capped at e.g. 1000 in
  the constructor so a bad deploy can't set 100%).
- Two EIP-712 structs, one settlement path:
  - `Listing { address seller; uint256 tokenId; uint256 price; uint256 expiry; uint256 salt; }`
  - `Offer   { address buyer;  uint256 tokenId; uint256 price; uint256 expiry; uint256 salt; }`
- Entry points: `buy(Listing, signature)` payable, `acceptOffer(Offer, signature)`,
  `cancel(bytes32 orderHash)`, `incrementNonce()` (bulk-invalidate all of a
  user's orders in one tx), plus views `hashListing`, `hashOffer`, `orderStatus`.
- Deliberately **not** in the contract: order storage (orders live off-chain as
  signatures), escrow, auctions, bundles, collection-wide offers, multi-collection
  support, ERC-1155, upgradeability, admin withdraw.

### Week 2 — Tests, invariants, freeze

- **Day 6–8: Foundry test suite.** Unit tests for every revert path; fork tests
  against mainnet state with real holders and real token IDs; fuzz tests on price
  and bps arithmetic; invariant tests (see the invariant list in §3.3 — it is
  the same list the auditor gets).
- **Day 8–9: adversarial tests written from the threat model** in §3.4:
  replay across chains, replay of a cancelled order, reentrancy via
  `onERC721Received`, reverting royalty receiver, reverting seller (contract
  seller that rejects ETH), stale approval, double-fill of one signature,
  accept-offer racing buy of the same token.
- **Day 10: FREEZE.** Tag the commit. Deploy to Sepolia. Hand the audit package
  (§3) to the auditor. Contracts do not change after this point except for audit
  findings — this is the single most important scheduling constraint in the plan.

### Week 3 — Backend order book + indexer (audit running in parallel)

- Postgres schema: `orders` (hash PK, type, maker, token_id, price, expiry, salt,
  signature, status, invalidated_reason), `tokens` (id, owner, approved_for_market),
  `events` cursor.
- `POST /orders` — verify EIP-712 signature server-side, verify maker currently
  owns the token (listings) or has WETH balance + allowance (offers), verify
  expiry and nonce, then store. **The API is a convenience index, not a security
  boundary** — the contract re-verifies everything. Say this out loud to the team
  so nobody puts a check only in the API.
- `GET /orders?tokenId=` / `?collection=` with best-listing and best-offer views.
- `DELETE /orders/:hash` — off-chain soft cancel (signature-authenticated). Fast
  and free; the UI must label it "hidden" and offer the on-chain `cancel` for
  users who want a hard guarantee. Document the difference in the UI copy, because
  an off-chain cancel does not stop someone who already captured the signature.
- Indexer (Ponder or plain viem log subscription) watching the NFT's `Transfer`
  and `ApprovalForAll`, and the market's fill/cancel/nonce events. On transfer or
  approval revocation, mark that maker's affected orders `invalidated`. Reorg
  handling: track block hashes, rewind on mismatch, treat 5 confirmations as final
  for UI purposes.

### Week 4 — Frontend, then launch prep

- Next.js + wagmi/viem + a wallet connector. Pages: collection grid with prices,
  token detail (list / buy / make offer / accept / cancel), "my items", "my
  offers", activity feed.
- Flows to get right:
  - **List:** if `isApprovedForAll(user, market)` is false, prompt one approval tx,
    then sign the listing (gasless). Explain plainly that approval lets the market
    move the piece *only* when a valid signed order is filled.
  - **Offer:** wrap ETH → WETH if needed, approve WETH, then sign the offer.
    Show the buyer that their WETH stays theirs and one offer can be outbid by
    their own spending elsewhere.
  - **Buy:** show price, 2.5% artist cut, seller proceeds explicitly.
  - **Accept offer:** warn if the buyer's WETH balance no longer covers it (the
    indexer already knows) rather than letting them burn gas on a revert.
- Launch prep: deployment runbook, verified Etherscan source, a `docs/` page for
  holders explaining non-custodial listings and approvals, Discord announcement,
  and a monitoring alert on unexpected reverts and on fill volume.

### What lands when

| End of | State |
|---|---|
| Week 1 | Collection risks known; contract drafted |
| Week 2 | Contract frozen, tested, on Sepolia; **audit starts** |
| Week 3 | Order book + indexer live against Sepolia |
| Week 4 | Full app usable on Sepolia; audit report expected |
| Week 5 | Fix findings, auditor reviews the diff, deploy mainnet, soft launch to Discord |

---

## 2. Design decisions worth arguing about now, not in week 3

### 2.1 Off-chain orders, not on-chain listings
Storing listings on-chain costs the seller a transaction to list and another to
cancel. Off-chain EIP-712 signatures make listing and cancelling free, and the
contract only ever stores a small `bytes32 => bool` for consumed/cancelled order
hashes plus a per-user nonce. This is the Seaport/Blur model and it shrinks the
audit surface. Trade-off: your API becomes the availability dependency for
discovery — if it goes down, nobody can find orders, though existing signatures
remain fillable by anyone holding them.

### 2.2 No escrow means orders are *offers to trade*, not guarantees
A listed piece can be sold elsewhere, transferred away, or have its approval
revoked at any moment. The contract must therefore validate ownership and
approval **at fill time**, and the UI must treat "listing exists" as "probably
fillable." Failed fills are expected, not bugs; they should revert cleanly with a
named error so the frontend can say why.

### 2.3 Offers require WETH — this is the one UX cost of "no escrow"
Native ETH cannot sit in a buyer's wallet and be pullable later. So offers are
WETH orders: buyer approves the market once, signs an offer, and
`acceptOffer` does `weth.transferFrom(buyer, ...)`. Consequences to accept:
- An offer silently becomes unfillable if the buyer spends their WETH. That's
  fine and intended, but the indexer must surface it or owners waste gas.
- One WETH balance can back several offers; only the first accepted ones succeed.
  Show this honestly ("this buyer has 3 open offers totalling more than their
  balance").
- The wrap step costs a transaction. Bundle wrap+approve in the UI.

### 2.4 The 2.5% is enforced by *your* contract, not read from ERC-2981
Since your site is the only venue this contract serves, hardcoding
`royaltyBps = 250` to an immutable `royaltyReceiver` set at deploy is simpler,
cheaper, and unavoidable-by-construction. Reading `royaltyInfo()` at fill time
adds an external call to a contract you don't control, which is both a gas cost
and a liveness/reentrancy consideration for zero benefit here.
- If §1 Day 1–2 finds the collection *does* implement ERC-2981, set your
  immutable values to match it so on-chain metadata and actual behavior agree.
- Arithmetic: `royalty = price * 250 / 10_000`, `sellerProceeds = price - royalty`.
  Subtract, never compute the seller's share independently — that guarantees the
  two always sum to exactly `price` with no dust stranded. Enforce a minimum
  price (e.g. 1e15 wei) so rounding can't make the royalty zero.
- Decide now whether the *platform* also takes a fee. Default in this plan: no
  platform fee, and no fee parameter at all. Adding one later is a new deploy.

### 2.5 Paying out ETH safely
`buy()` receives ETH and must forward to the seller and the artist. A seller or
royalty receiver that is a contract can revert on receipt and brick fills.
Options, pick one and tell the auditor which: (a) `call` with full gas + revert on
failure, accepting that such sellers simply cannot sell; (b) on failed send,
wrap to WETH and transfer; (c) credit an internal balance the recipient pulls
later. **Recommendation: (b) for the royalty receiver** (it must never be a
liveness risk) **and (a) for the seller** (their own problem, loudly). Avoid (c)
in MVP — it adds stored balances and a withdraw path to the audit.

### 2.6 Non-upgradeable, on purpose
No proxy, no admin. Fixing a bug means deploying v2 and migrating the order book;
users' NFTs are never at risk because the contract never holds them, and
revoking `setApprovalForAll` fully exits a user. A proxy would add an admin key
that can, in effect, authorize arbitrary transfers of every approving holder's
NFTs. That is a much worse risk than redeploying. **One concession:** include a
`pause()` guarded by an owner key that can only block *new fills* and can never
move assets or change fees, so you can stop the bleeding while you redeploy.
State this in the scope so the auditor reviews the pause authority explicitly.

### 2.7 Explicitly out of MVP scope
Auctions, Dutch auctions, bundles, collection-wide/trait offers, ERC-1155,
multiple collections, ERC-20 payment other than WETH, private/reserved listings,
batch buy, fiat on-ramp, L2. Each is a contract change and a re-audit. Note for
planning: collection-wide offers are the most likely first follow-up ask and they
change the `Offer` struct (criteria instead of a fixed `tokenId`), so budget a
scope delta rather than assuming it's free.

---

## 3. Audit scope (the document you send for a quote)

### 3.1 Engagement summary
Review of a single, non-upgradeable Solidity contract implementing a
non-custodial, signature-based marketplace for one existing ERC-721 collection on
Ethereum mainnet, with fixed 2.5% royalty enforcement on every sale.

- Chain: Ethereum mainnet only.
- Solidity: 0.8.2x, no assembly except OpenZeppelin internals.
- Dependencies (out of scope, in scope as integration assumptions):
  OpenZeppelin `ECDSA`, `ReentrancyGuard`; canonical WETH9; the already-deployed
  collection contract at `<ADDRESS — fill in>`.
- Not upgradeable. No admin access to funds or NFTs. One owner-held `pause()`
  limited to blocking new fills.

### 3.2 In scope — exact artifacts
Provide the auditor with a frozen commit hash and this list:

| Artifact | Est. SLOC |
|---|---|
| `src/CollectionMarket.sol` | ~380–450 |
| `src/interfaces/*.sol` | ~40 |
| `script/Deploy.s.sol` (constructor args, deploy correctness) | ~50 |
| `test/**` (for review of coverage adequacy, not correctness of tests) | ~1,200 |

Total reviewable Solidity: **~500 lines**, one contract, no inheritance tree, no
storage layout constraints. Also supplied: this document, the §1 Day 1–2 findings
note on the deployed collection, the invariant list below, and the threat model.

Functions to review, each explicitly named in the quote:
`buy`, `acceptOffer`, `cancel`, `incrementNonce`, `pause`/`unpause`,
`hashListing`, `hashOffer`, `orderStatus`, `_settle` (shared payout path),
`_verifySignature` (incl. EIP-1271 branch), constructor.

### 3.3 Invariants the auditor should try to break
1. For any fill: `royaltyPaid + sellerReceived == price` exactly, and
   `royaltyPaid == price * 250 / 10_000`.
2. Royalty is paid on **every** successful transfer of the NFT caused by this
   contract — no path (listing fill, offer acceptance, any future branch) settles
   without it.
3. No signature can be filled twice. A cancelled or nonce-invalidated order can
   never be filled.
4. An order signed for one chain, one contract deployment, or one token ID cannot
   be filled for another.
5. The contract's ETH and WETH balance is zero at the end of every transaction.
   It never holds an NFT.
6. Only the order's maker (or an EIP-1271-authorizing signer) can cause that
   order to be fillable; no third party can create, modify, or reprice an order.
7. `cancel` succeeds only for the caller's own order hash.
8. A fill transfers exactly the token named in the order, from the maker who
   signed it, to the counterparty who filled it — nothing else moves.
9. Expired orders (`expiry < block.timestamp`) are unfillable.
10. No admin action can move a user's NFT or funds, change `royaltyBps`, change
    `royaltyReceiver`, or make a fill pay out differently. `pause` can only
    prevent fills.
11. A user who calls `setApprovalForAll(market, false)` cannot have any token
    taken by this contract thereafter.

### 3.4 Threat model to cover
- **Signatures:** EIP-712 domain correctness (chainId, verifying contract, no
  cross-type hash collisions between `Listing` and `Offer`), malleability,
  zero-address recovery, EIP-1271 handling including a 1271 verifier that changes
  its answer between check and settle.
- **Replay and lifecycle:** double-fill, fill after cancel, fill after nonce bump,
  salt reuse, expiry boundary, cancel of a never-existent hash, front-running a
  cancel with a fill (acknowledged, want it analyzed and documented).
- **Reentrancy:** `onERC721Received` on the buyer/seller side, WETH transfer to a
  hostile token address (n/a if WETH is immutable — confirm it is), reentrancy via
  the ETH payout, and cross-function reentrancy between `buy` and `acceptOffer`.
  Verify state is written before external calls, not just that a guard exists.
- **Value accounting:** `msg.value != price`, overpay/underpay, rounding to zero
  royalty at tiny prices, overflow (0.8.x, but check any unchecked blocks),
  stranded ETH, forwarding ETH to a contract that consumes all gas.
- **Griefing / DoS:** reverting royalty receiver, reverting seller, gas-bomb
  fallback, order spam, a seller who cancels to grief buyers' gas.
- **Integration with the deployed collection:** operator-filter interaction,
  non-standard approval semantics, the collection being paused mid-fill, admin of
  the collection changing behavior under us.
- **Deployment:** constructor arg correctness (wrong `royaltyReceiver` or a
  `royaltyBps` above the cap is unrecoverable given immutability), verification.
- **Economic:** whether a buyer or seller can obtain the NFT or the payment
  without the other side's consideration, under any ordering of transactions in a
  block.

### 3.5 Out of scope (state it, so it isn't quoted or assumed)
The already-deployed ERC-721 collection's own code; WETH9; OpenZeppelin library
internals; the backend API, database, and indexer; the frontend; key management
and the owner EOA/multisig for `pause`; off-chain order availability and
censorship by our own API; gas optimization beyond correctness; economic
soundness of the 2.5% rate. **Requested explicitly even though off-chain code is
out of scope:** a short review of whether any security check exists *only* in the
API and not in the contract — that's the classic failure mode of this
architecture, and it's cheap for an auditor to sanity-check against §3.3.

### 3.6 Known and accepted risks (disclose up front, don't make them find them)
- Listings and offers are unfillable-by-design when ownership changes, approval
  is revoked, or WETH balance drops. Failed fills are expected behavior.
- Off-chain cancellation via the API is not cryptographically binding; only
  on-chain `cancel`/`incrementNonce` is. Documented in UI copy.
- A holder who approves the market is trusting this contract's code for as long
  as the approval stands. This is inherent to non-escrow and is the main reason
  the contract is non-upgradeable.
- Cancel/fill ordering within a block is not controllable by us.
- If the collection has an admin that can pause transfers, the marketplace
  inherits that liveness dependency.

### 3.7 Deliverables and logistics expected from the auditor
Findings report with severity ratings and reproductions; review of the frozen
commit; **one round of fix review on the diff included in the quote** (this is
the item most often missing from a quote and most often needed); a short public
summary we can link for holders. Requested window: kickoff at end of our week 2,
report by end of week 4, fix review within 3 business days of our patch. Expected
effort for a ~500-SLOC single contract in a well-trodden pattern: roughly
3–5 auditor-days / 1–2 auditors for one week. Ask for the quote to break out fix
review and any re-audit separately so the follow-up scope in §2.7 is priced.

---

## 4. Testing and launch gates

Gate to mainnet deploy — all must be true:
1. Audit report received, all high/medium findings fixed, fix review signed off.
2. Foundry coverage ≥ 95% lines/branches on `CollectionMarket.sol`; every custom
   error has a test that triggers it.
3. Mainnet-fork test: a real listing and a real offer fill end-to-end against
   real holders and real token IDs, with the 2.5% arriving at the artist address.
4. Invariant suite (§3.3) green.
5. Deploy script dry-run reviewed by two people, constructor args diffed against
   the intended values character by character. `royaltyReceiver` confirmed by the
   artist from the receiving wallet.
6. Indexer replays the full collection history and reconciles ownership for all
   5,000 tokens against `ownerOf`.
7. Runbook exists for: pausing, redeploying, migrating the order book, and telling
   holders how to revoke approval.

Soft launch: announce to Discord with a low-key cap (e.g. ask holders to start
with lower-value pieces for the first week), watch fills and reverts, then open up.

---

## 5. Where the four weeks is tight, and what to cut

The plan is honest about one thing: **four weeks covers build, not
build-plus-audit-plus-launch.** Audits for even a small contract need calendar
time you don't control, and scheduling one usually needs 1–3 weeks of lead time —
send the scope in §3 out *this week*, before implementation starts, which is
exactly what you asked for.

If the deadline is immovable, cut in this order:
1. Cut the activity feed, the "my offers" page, and analytics. Pure frontend.
2. Cut on-chain `cancel` from the UI (keep it in the contract) and ship
   API-side hiding plus `incrementNonce` for "cancel everything."
3. Cut **offers entirely** and ship listings-only. This is the biggest saving:
   it removes WETH, allowances, `acceptOffer`, and a meaningful slice of the
   threat model — maybe 35% of the contract and a third of the audit. Offers
   become v1.1 with a scope delta.
4. Do **not** cut: the audit, the mainnet-fork tests, the ownership/approval
   check at fill time, or the Day 1–2 collection investigation. Each of those is
   load-bearing for either correctness or the go/no-go decision.

---

## 6. The alternative you should price against this

**Option B: don't write a contract at all.** Build your site's UI and order book
on Seaport (already audited, battle-tested, and what the rest of the market
already uses), or on a hosted order-book API that wraps it. You get listings,
offers, non-custodial orders, and fee/royalty enforcement on your own orders. Your
audit scope collapses to roughly nothing, and four weeks becomes a comfortable
mainnet timeline instead of a tight testnet one. Costs: less control over the
order format, a dependency on Seaport's conduit approvals (holders approve
Seaport's conduit rather than your contract), and — importantly — orders created
elsewhere for your collection can be filled without your 2.5% unless you also
lean on the collection's ERC-2981 metadata, which not every venue honors.

**Option A (this plan) is the right pick if** the 2.5% must be enforced by code
you control and you want the order format to be yours. **Option B is the right
pick if** shipping inside four weeks with an audit already done matters more than
owning the settlement layer. Worth a 30-minute decision with the artist before
week 1 starts, because it determines whether you send the §3 scope at all.
