# Collection Marketplace — 4-Week MVP Plan & Audit Scope

Date: 2026-09-21
Scope: a first-party listing/buying site for one existing 5,000-piece ERC-721 on
Ethereum mainnet (minted 2024), with non-escrow listings, collection-wide offers,
and a 2.5% artist cut on every sale that settles through our contract.

---

## 0. Two things to settle before anyone writes Solidity

### 0.1 "2.5% of every resale" is not achievable. "2.5% of every resale on our site" is.

ERC-2981 is a *signalling* standard — it tells a marketplace what royalty the
creator wants; it does not and cannot force payment. Any holder can still
`transferFrom` peer-to-peer, or list on a marketplace with optional royalties,
and the artist gets nothing. The only contracts that can truly enforce royalties
are ones that block transfers (ERC-721C / operator filters), and that ship has
sailed: the collection was deployed in 2024 and is immutable.

What we *can* deliver, and what this plan delivers:

- 100% of sales through our marketplace pay the artist 2.5%, enforced in the
  settlement function — not a convention, not a frontend default, structurally
  impossible to skip.
- The Discord trades we're actually replacing (currently 0% royalty) become
  2.5% royalty trades. That is the real win; frame it that way to the artist so
  expectations are right.

If genuinely enforcing royalties on *all* future trades matters more than
anything else, the only path is a new wrapped collection that holders migrate
into — a different, much larger project. Out of scope here; flagging it so the
decision is explicit.

### 0.2 Build vs. integrate — worth 30 minutes before committing four weeks

We could ship our own frontend on top of **Seaport** (the audited, ubiquitous
settlement contract) via Reservoir/OpenSea APIs: zero contracts to write, zero
contracts to audit, ~1.5 weeks instead of 4, and our listings would be visible
on every other marketplace too. The cost is that royalty payment is then
best-effort per-marketplace rather than guaranteed, and we own no settlement
logic.

Recommendation: spend one session evaluating this. If "every sale on our site
pays the artist, guaranteed, in code we control" is the requirement — which is
how the brief reads — then our own contract is the right call, and the rest of
this document is that plan.

---

## 1. Architecture

**Chain: Ethereum mainnet.** Not a judgment call — the NFTs are there. No
bridging, no L2, no multi-chain for the MVP. At current gas a listing costs on
the order of ~55k gas and a purchase ~130k gas; that is a few dollars, which is
noise next to a 0.4 ETH trade.

**Contract count: 1.** `CollectionMarket.sol`. Immutable, non-upgradeable, with
the NFT address baked in as an `immutable`. One contract that only ever touches
one known collection is dramatically cheaper to audit than a generic
marketplace, and generic is a feature nobody asked for.

### On-chain vs off-chain

| Concern | Where | Why |
|---|---|---|
| Listing record (price, seller, expiry) | **On-chain** | It's a commitment that must be honoured without our server |
| Offer record | **Off-chain** (EIP-712 signature in our DB) | Free to make; buyers make and retract offers constantly |
| Settlement, royalty split, cancellation | **On-chain** | Trustless value transfer — the whole point |
| Browse/search/sort, images, traits, price history | **Off-chain indexer** | Not value transfer. Solidity is not a database |
| Activity feed, "who owns what" | **Off-chain**, from events | Derived data |

Note the asymmetry: listings on-chain, offers off-chain. It's deliberate.
Listings on-chain means the site can go down and a buyer can still fill a
listing straight from Etherscan — that's the censorship-resistance property that
justifies doing this at all, and there are maybe a few hundred live listings so
the gas is affordable. Offers are high-churn and low-value-per-item, so paying
gas to make one that probably gets ignored is bad UX; signed offers are free and
cancelled by simply not honouring them. It also keeps the signature-verification
code path to exactly one place, which the auditor will appreciate.

### The pieces

```
CollectionMarket.sol  (mainnet, immutable)
  ├─ list / cancelListing / buy           ← on-chain listings, ETH payment
  ├─ acceptOffer                          ← EIP-712 signed offer, WETH payment
  ├─ cancelOffer / incrementOfferNonce    ← on-chain invalidation of signatures
  └─ withdraw                             ← pull-payment fallback (see §2.4)

Indexer (Ponder or Graph) → Postgres      ← events, ownership, listing validity
Offer API (Next.js route + Postgres)      ← stores signed offers, serves best offer
Frontend (Next.js + wagmi/viem)           ← browse, list, buy, offer, revoke
```

Three moving parts, one of them a smart contract. That's the right size.

### No escrow — and what that costs us

The brief is right that owners should keep their piece while listed. The
mechanism is `setApprovalForAll(market, true)` plus a listing record; the NFT
never moves until someone buys. Consequences we must design around:

1. **Listings go stale.** A seller can transfer or sell the piece elsewhere, or
   revoke approval, while the listing still exists on-chain. `buy()` must
   re-check current ownership and approval at fill time and revert cleanly, and
   the indexer must hide listings that would fail so buyers don't waste gas on
   a guaranteed revert.
2. **Approval is the real attack surface.** Every seller grants our contract
   blanket authority over their entire holdings in this collection. A bug in
   `buy()`/`acceptOffer()` is not "some funds at risk" — it is *every listed
   piece in the collection drainable by anyone*. This single fact is why the
   audit matters and why the contract must be immutable with no admin transfer
   path. It is also why the frontend ships a prominent **Revoke approval**
   button from day one: it is our only user-side incident response.

### Offers must be WETH, not ETH

You cannot pull ETH from a buyer's wallet at some later moment when the owner
decides to accept — ETH has no allowance mechanism. So a "make an offer" flow is
necessarily: buyer wraps ETH → WETH, approves the market for WETH, signs an
EIP-712 offer. The frontend must present this as one guided flow (wrap →
approve → sign) or offers will have terrible conversion. This is the single
biggest UX cost of the offers feature and the reason it is sequenced second.

WETH mainnet: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` (verify at
implementation time; never paste an address from memory into a deploy script).

### Royalty: hardcode it, don't read ERC-2981

Recommendation: `ROYALTY_BPS = 250` and `ARTIST` as `immutable` constructor
args, set once at deploy.

Reading ERC-2981 from the collection at fill time sounds more "correct" but
introduces an external call into our settlement path whose return value we do
not control — if the collection's owner key is ever compromised and royalty is
set to 100%, every sale routes the full price to the attacker. Hardcoding gives
us exactly the behaviour the brief specifies, no external call, and a smaller
audit surface.

Trade-off, stated plainly: changing the artist's payout address later requires
deploying a new market contract and migrating listings. Mitigate by making
`ARTIST` a **Gnosis Safe the artist controls**, not an EOA — then the artist can
rotate signers without us redeploying.

**Pre-flight fact-find (Day 1, blocks the spec):**
- Does the collection implement ERC-2981, and what does it currently return? We
  should match it, not contradict it, even though we won't call it.
- Does it implement any operator filter / transfer restriction that would block
  our contract?
- Is `transferFrom` standard OpenZeppelin, or is there a hook (fee-on-transfer,
  staking lock, reentrancy surface)?
- Confirm the artist payout address and get the Safe deployed.

---

## 2. State-transition audit

Every function, per the discipline of "who calls this and why?":

### 2.1 `list(tokenId, price, expiry)`
- **Who:** the current owner. **Why:** to sell.
- **Requires:** `msg.sender == nft.ownerOf(tokenId)`, `nft.isApprovedForAll(msg.sender, this)`, `price > 0`, `expiry > block.timestamp`.
- **Nobody calls it:** no listings, empty marketplace. No system breakage.
- **Note:** re-listing an already-listed token overwrites the prior listing. Cheaper and less confusing than reverting.

### 2.2 `cancelListing(tokenId)`
- **Who:** the seller. **Why:** changed their mind, or sold elsewhere.
- **Requires:** caller is the recorded seller. Deletes the record.
- **Nobody calls it:** stale listings linger until expiry. This is why `expiry` is mandatory, not optional — it bounds the damage of abandoned listings and of forgotten approvals. Suggest a 90-day default in the UI.

### 2.3 `buy(tokenId)` — payable
- **Who:** any buyer. **Why:** they want the piece.
- **Requires:** listing exists, not expired, `msg.value == price`, seller *still* owns it, approval *still* granted.
- **Effects first:** delete the listing, then pay artist, then pay seller, then `nft.transferFrom(seller, msg.sender, tokenId)` last. `nonReentrant`.
- **Exact-change only:** require `msg.value == price` rather than refunding the excess. No refund path means no refund bug.

### 2.4 `acceptOffer(offer, signature)`
- **Who:** the current owner of the token. **Why:** to take a bid.
- **Requires:** EIP-712 signature recovers to `offer.maker`; `block.timestamp <= offer.deadline`; offer not already filled or cancelled; maker has WETH balance and allowance; caller owns the token.
- **Effects:** mark the offer hash consumed, pull WETH from maker via `safeTransferFrom`, pay artist 2.5%, pay seller the rest, transfer NFT last. Delete any live listing for that token. `nonReentrant`.
- **Nobody calls it:** offers simply expire. Fine.
- **Offer scope:** support both token-specific and collection-wide offers via a
  `tokenId` field where a sentinel (e.g. `type(uint256).max`) means "any token in
  the collection". Collection-wide offers are what make a 5,000-piece collection
  liquid — they're worth the small extra branch.

### 2.5 `cancelOffer(offerHash)` / `incrementOfferNonce()`
- **Who:** the offer maker. **Why:** retracting a bid that hasn't been taken.
- **Requires:** caller is the maker encoded in the offer.
- **Design warning — the textbook nonce pattern is wrong here.** A single
  incrementing `nonces[maker]` consumed on each fill means accepting *one* of a
  buyer's offers silently invalidates *all* their other outstanding offers. For
  a marketplace that is a bug, not a feature. Use instead:
  - a `mapping(bytes32 => bool) consumed` keyed on the offer hash, for per-offer fill and cancel; plus
  - a separate `incrementOfferNonce()` bulk-cancel, where the maker's current nonce is a field inside the signed struct — one cheap transaction invalidates every outstanding offer at once ("panic button").

  Both are needed. The second is the honest answer to "my wallet might be
  compromised" and to "I'm no longer good for 40 ETH of open bids."

### 2.6 `withdraw()` — pull-payment fallback
- **Who:** anyone owed a failed push payment. **Why:** to claim it.
- **Rationale:** if the artist's Safe or a seller's smart wallet reverts on ETH receipt, a pure push-payment `buy()` would brick permanently for that party. Credit the balance and let them pull instead of reverting the sale.
- **Invariant:** contract ETH balance must equal the sum of pending credits, always. Nothing else may ever sit in this contract.

### 2.7 `pause()` / `unpause()`
- **Who:** a 2-of-3 Gnosis Safe (team). **Why:** a live exploit.
- **Scope, deliberately minimal:** pausing blocks `buy` and `acceptOffer` only. It cannot move an NFT, cannot move ETH, cannot change the royalty or the artist, and cannot block `cancelListing` or `withdraw` — users must always be able to exit.
- **Justification:** with `setApprovalForAll` granted by hundreds of holders, "everyone individually revokes" is not a viable incident response. A guardian that can only stop the bleeding, never steal, is worth the small added audit surface. Document precisely this boundary for the auditor.

**No marketplace fee in v1.** Not requested, and omitting it removes a whole
class of fee-accounting findings. Adding one later means a new deployment — an
acceptable cost for a tighter audit now.

---

## 3. Four-week schedule

Owners assumed: 1 Solidity engineer, 1 frontend engineer, part-time design/PM.

### Week 1 — Spec, contract, and book the auditor
- **Day 1:** collection fact-find (§1). Confirm artist address; deploy the artist Safe and the team guardian Safe.
- **Day 1–2:** freeze the written spec: struct layouts, EIP-712 typehashes, events, error selectors, the invariant list from §5. **Send the audit scope in §6 out for quotes on Day 2** — this is the long-lead item and the reason the whole plan works or doesn't.
- **Day 3–5:** write `CollectionMarket.sol` against the spec. OpenZeppelin `ReentrancyGuard`, `EIP712`, `SignatureChecker` (ERC-1271 so Safe/smart-wallet users can make offers), `SafeERC20`, `Pausable`. Strict Checks-Effects-Interactions with the NFT transfer last in every settlement path.
- **Exit:** contract compiles, happy-path Foundry tests green, auditor engaged with a start date.

### Week 2 — Test to exhaustion, then freeze
- Unit tests for every function and every revert branch.
- **Fuzz:** price and royalty math across the full uint range; assert `sellerProceeds + royalty == price` exactly, and that royalty rounding never under- or over-pays by more than 1 wei.
- **Fork tests against mainnet** using the real collection and real WETH, impersonating actual holders. Non-negotiable — this is where assumptions about the 2024 contract's behaviour get falsified rather than assumed.
- **Adversarial cases:** seller transfers out mid-listing; approval revoked mid-listing; same offer submitted twice; offer accepted after bulk nonce increment; buy on an expired listing; collection-wide offer accepted for a token the maker already owns; reentrant buyer contract; artist address that reverts on receive; zero-price and max-uint inputs; accepting an offer on a token that also has a live listing.
- `slither .` clean, or every finding triaged in writing (the auditor will ask).
- **Day 10: tag `v1.0-audit`, freeze the contract, hand off.** Any change after this point restarts the audit clock and costs money.
- **Day 11–12** (spillover, contract-frozen): deploy to Sepolia with a mock 5k collection; stand up the indexer.

### Week 3 — Frontend and indexer, audit running in parallel
- Indexer: Ponder over `Listed / Cancelled / Sold / OfferAccepted`, joined to current ownership and approval status, so the browse page only ever shows fillable listings.
- Offer API: store signed EIP-712 offers, validate signature + WETH balance + allowance server-side before accepting into the DB, re-validate before display, expose best-offer-per-token.
- Frontend: grid + token page; **list** flow (approve → list, two clear steps); **buy** flow; **make offer** flow (wrap ETH → approve WETH → sign, with the wallet's own balance checks surfaced); **my listings / my offers** management; **revoke approval** button in settings.
- Every async action gets a pending state and a tx link. No infinite approvals for WETH — approve the offer amount.
- Full flow tested against Sepolia end to end.

### Week 4 — Audit findings, fixes, deploy
- Receive the report. Fix findings; each fix gets a regression test written *before* the fix.
- Auditor performs a fix-review pass on a second tagged commit.
- Deploy to mainnet, verify on Etherscan, confirm `ARTIST`/`ROYALTY_BPS`/`nft` immutables read back correctly on-chain, execute one real 0.01 ETH end-to-end sale with a team wallet before announcing.
- Frontend to Vercel (plus an IPFS build + ENS record as the censorship-resistant fallback — cheap to do, and the honest answer to "what if your site goes down").
- Dune dashboard on the events; Discord announcement with a short guide on what `setApprovalForAll` means and how to revoke it.

### The schedule risk, stated honestly

Four weeks is achievable **only if the auditor is booked in Week 1 and the
engagement is a 5-day slot starting Day 11.** Reputable auditors are typically
booked 2–6 weeks out. If the earliest slot lands after Week 4 — which is the
likelier outcome — the realistic shape is:

- Weeks 1–4 as above, with the mainnet contract deployed but the **site launched
  in browse-only mode**, indexer live, listing disabled.
- Trading enabled the day the fix-review passes, whenever that lands.

Do not ship a marketplace holding `setApprovalForAll` over a 5,000-piece
collection on unaudited code to hit a date. Getting the quote out on Day 2 is
the single highest-leverage action in this plan.

---

## 4. Explicitly out of scope for the MVP

Auctions. Bundles. Sweep/multi-buy. Multiple collections. ERC-20 payment other
than WETH. Trait-level offers. A marketplace fee. Any L2 or cross-chain. Any
upgradeability or proxy. Lending or renting.

Each of these is a real feature request that will arrive in week 2. All of them
are v2.

---

## 5. Invariants (give these to the auditor verbatim)

1. An NFT changes hands only via `buy` or `acceptOffer`, and only in a transaction where the full payment is distributed in the same call.
2. For every settlement: `royaltyPaid + sellerProceeds == price`, exactly, with no remainder stranded.
3. `royaltyPaid == price * 250 / 10_000`, rounded down, and never zero for any `price >= 40000 wei`.
4. The contract's ETH balance at the end of any transaction equals the sum of all unclaimed pull-payment credits. Never more, never less.
5. The contract never holds an NFT, at any point, including mid-transaction.
6. Every listing and every offer can be filled at most once.
7. A fill requires that the seller is the *current* owner and the approval is *currently* valid — never state captured at listing time.
8. Only the maker can cancel their listing or offer; cancellation is irreversible and always available, including while paused.
9. No privileged role can transfer an NFT, move ETH, change `ARTIST`, change `ROYALTY_BPS`, or prevent a user from cancelling or withdrawing.
10. A signature valid on one chain, one contract, one token, or one offer is valid nowhere else.
11. `ARTIST` and `ROYALTY_BPS` are immutable post-deployment. There is no code path that pays out at a rate other than 250 bps.

---

## 6. Audit scope — send this for quotes

### 6.1 Engagement summary

| Field | Value |
|---|---|
| Protocol | Single-collection NFT marketplace, non-custodial |
| Chain | Ethereum mainnet only |
| Contracts in scope | `src/CollectionMarket.sol` — 1 file |
| Estimated size | ~300–400 nSLOC, single contract, **no proxy, no upgradeability** |
| Language / toolchain | Solidity ^0.8.26, Foundry |
| Dependencies (out of scope, in scope for *integration correctness*) | OpenZeppelin v5: `ReentrancyGuard`, `EIP712`, `SignatureChecker`, `SafeERC20`, `Pausable` |
| External contracts integrated | The collection ERC-721 at `0x<TBD>` (immutable, deployed 2024, not modifiable by us); WETH `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| Privileged roles | One pause guardian (2-of-3 Safe) — pause/unpause of fills only, per §2.7 |
| Audit artifacts provided | Frozen commit hash, this document, the invariant list (§5), the state-transition worksheet (§2), full test suite incl. mainnet fork tests, Slither output with triage notes |
| Requested engagement | ~5 business days + a fix-review pass on a second tagged commit |
| Deliverable | Findings report with severities, plus a signed-off fix review |

### 6.2 Value at risk — read this before quoting

The marketplace holds no assets, but it holds `setApprovalForAll` over the
entire collection from every seller. **A settlement bug is equivalent to
unauthorized transfer rights over all listed tokens in a 5,000-piece mainnet
collection.** Please scope depth to that exposure rather than to the contract's
size.

### 6.3 Domains we expect to be exercised

Mapped to standard audit domains; the ask is depth on the first five:

1. **Cryptographic signatures** — EIP-712 domain separation, typehash
   correctness, malleability, ERC-1271 smart-wallet path, per-offer consumption
   vs. bulk nonce invalidation, deadline enforcement, cross-chain and
   cross-contract replay.
2. **NFT standards (ERC-721)** — approval semantics, ownership re-validation at
   fill time, transfer-vs-safeTransfer choice, behaviour against the specific
   2024 collection's implementation.
3. **Access control** — maker-only cancellation; the exact boundary of the pause
   guardian's authority; confirmation that no path grants privileged asset
   movement.
4. **General EVM / reentrancy** — CEI ordering in both settlement paths, the
   interaction between the NFT transfer, ETH sends, and WETH `transferFrom`,
   reentrancy via a malicious buyer or a malicious recipient.
5. **Denial of service** — a reverting artist or seller recipient bricking
   settlement; griefing via stale listings or unfillable offers; the
   pull-payment fallback's own failure modes.
6. **Precision math** — 250 bps rounding, dust, the exact-sum invariant (§5.2).
7. **Chain-specific** — mainnet only; ETH/WETH handling; gas-griefing on the
   `.call` payout stipend.

**Not applicable, please do not bill for:** AMM/DEX, lending, staking, ERC-4626,
ERC-4337, bridges, proxies/upgradeability, governance, oracles, flash loans,
assembly/Yul (we use none).

### 6.4 Specific questions we want answered in the report

1. Can any actor cause an NFT to transfer without the full 2.5% reaching `ARTIST` in the same transaction?
2. Can a signed offer be used more than once, used after cancellation, used after its deadline, or used on a different token/contract/chain than intended?
3. Can accepting one offer invalidate a maker's *other* outstanding offers other than through an explicit `incrementOfferNonce` call?
4. Can a seller be made to deliver an NFT for less than the listed price, or a buyer made to pay more than the offered price?
5. Can any party permanently strand ETH in the contract, or make `withdraw` unreachable?
6. Can the pause guardian, acting maliciously, do anything other than temporarily halt fills?
7. Does the specific 2024 collection contract at `0x<TBD>` contain any behaviour (hooks, operator filters, non-standard transfer semantics) that breaks our assumptions?
8. Is any listed invariant in §5 violable?

### 6.5 Conditions

- Code is **frozen at the tagged commit** before the engagement starts. Any
  scope change is a new quote.
- We will supply a written response to every finding, with a regression test
  accompanying each fix, before the fix-review pass.
- We intend to publish the report.

---

## 7. Open decisions needing a human

1. **Build vs. Seaport integration** (§0.2) — decide before Day 1.
2. **What the artist has been told about royalty enforcement** (§0.1) — align
   expectations now, not after launch when someone trades on Blur for free.
3. **Artist payout address** — must be a Safe, and it is immutable once
   deployed. Confirm before Day 5.
4. **Pause guardian membership** — who holds the 2-of-3.
5. **Are we willing to launch browse-only** if audit slots push past Week 4?
   (Recommended: yes.)
