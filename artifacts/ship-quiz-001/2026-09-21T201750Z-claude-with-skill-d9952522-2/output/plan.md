# Marketplace MVP — Build Plan & Audit Scope

Move Discord hand-trading of our 5,000-piece ERC-721 onto our own site: holders
list, browsers buy, buyers make offers owners accept later, sellers cancel,
nothing escrowed, artist takes 2.5% of every resale.

---

## 1. The headline decision: zero custom contracts

**We do not write a marketplace contract. We build on Seaport.**

Every requirement in the brief is a Seaport 1.6 feature that already exists,
is already deployed on mainnet, and has been audited repeatedly while securing
a very large amount of NFT volume:

| Our requirement | Seaport mechanism |
| --- | --- |
| Holder lists at a price | Seller signs an offchain order: offer = the token, consideration = [seller payout, artist payout] |
| Anyone can buy | Buyer calls `fulfillBasicOrder` with ETH; Seaport atomically pulls the NFT from the seller and splits the ETH |
| Artist takes 2.5% | A second consideration item paid to the artist address, inside the same atomic fill |
| Nothing in escrow | Seller keeps the token and only grants an approval; Seaport moves it at the moment of sale |
| Seller can cancel | Offchain soft-cancel (free) plus onchain `cancel()` / `incrementCounter()` (hard) |
| Offers accepted later | Buyer signs the mirror order: offer = WETH, consideration = [NFT to buyer, artist payout]; owner fulfills it |

The custom-contract budget for an MVP is zero to two, three at the outside.
We are spending **zero**. A hand-rolled listings/offers contract would be
~250 lines holding live approvals to 5,000 NFTs — the single highest-risk
thing we could possibly ship — and it would buy us nothing Seaport does not
already do. It also would not fit in four weeks once a real audit is priced in
(see §8, Option B).

The consequence worth internalising: **our risk is almost entirely offchain.**
The dangerous artifact in this project is the TypeScript that constructs and
validates order structs, not Solidity. The audit scope in §7 is shaped
accordingly.

### Contracts we depend on (addresses must be verified, not trusted to this doc)

| Contract | Role | Address |
| --- | --- | --- |
| Seaport 1.6 | Settlement | `0x0000000000000068F116a894984e2DB1123eB395` — **VERIFY** |
| OpenSea Conduit | Approval target | conduit key + address — **VERIFY** |
| WETH | Offer currency | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` — **VERIFY** |
| Our collection | The asset | our 2024 ERC-721, mainnet |
| Artist payout | 2.5% recipient | new Gnosis Safe, artist-controlled |

Every address above is confirmed in Week 1 against the official ProjectOpenSea
deployment docs **and** read back from Etherscan before it enters config. A
wrong address here sends approvals or funds to an attacker; nothing is copied
from memory or from a blog post. Addresses live in one checked-in config file,
never inline.

---

## 2. Chain: Ethereum mainnet. This is not a choice.

The collection was minted on mainnet in 2024 and is immutable. The NFTs cannot
move. An L2 would require bridging or a wrapper, which fragments the 5,000
pieces into two incompatible sets and breaks every existing holder's wallet
view. We deploy where the asset is.

Cost implication, stated honestly: **listing and cancelling are free**
(offchain signatures), and buying costs the buyer one mainnet transaction.
Measure it before launch rather than guessing:

```bash
cast gas-price --rpc-url $MAINNET_RPC_URL
# and simulate the real path on a fork:
cast estimate $SEAPORT "fulfillBasicOrder(...)" ... --rpc-url $FORK_RPC_URL
```

A Seaport basic fill is well under the cost of the manual Discord flow it
replaces, and it replaces a flow where one party currently sends first and
hopes. Atomicity is the product.

---

## 3. Onchain / offchain boundary

**Onchain (Seaport, settlement only):** the atomic swap of token for ETH/WETH,
the 2.5% split, order cancellation state, counters, approvals. That is all.

**Offchain (our stack):** the entire order book. Signed orders live in
Postgres. Browse, search, filter, sort by price, rarity, trait, and recent
sales are all computed offchain from indexed events. Metadata and images are
cached and served from our CDN.

We do not put rankings, price history, or a "cheapest listing" pointer into
contract storage — those are derived data, computed from `OrderFulfilled` and
`Transfer` events by our indexer. There is no contract for us to maintain,
which is exactly the point.

**The order book is a cache, not the truth.** Seaport is the truth. Our API
can serve a stale listing; the fill will simply revert. The frontend must treat
revert-on-fill as a normal, expected outcome and refresh, not as an error state.

---

## 4. State transitions

Every state change, who pays for it, why they are willing to, and what happens
if nobody ever calls it.

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `setApprovalForAll(conduit, true)` | seller, once ever | unlocks listing their whole collection | they cannot list; nothing else breaks |
| Sign listing (EIP-712, offchain) | seller | free, no gas | no listing exists |
| `fulfillBasicOrder` (buy) | buyer | receives the NFT | listing sits until its expiry, then dies harmlessly |
| `approve(conduit, WETH)` | offerer, once | unlocks making offers | they cannot offer |
| Sign offer (offchain) | buyer | free, no gas | no offer exists |
| `fulfillOrder` (accept offer) | current owner | receives the WETH | offer expires unaccepted; buyer's WETH was never taken |
| `cancel(orders)` | seller | hard-kills a specific order onchain | soft-cancel only: hidden on our site, but a saved signature stays fillable until expiry |
| `incrementCounter()` | seller | kills *all* their open orders in one tx | prior orders remain fillable until expiry |
| Artist 2.5% payout | **nobody** | — | — |

The last row is the most important property of this design. The royalty is not
a claim, a pull, a drip, or a keeper job. It is a consideration item inside the
buyer's transaction: the ETH splits to seller and artist in the same call that
moves the NFT, or the whole thing reverts. **No contract we control ever holds
a balance. There is no treasury to drain, no payout to babysit, and no
liveness dependency on us.** If our website goes offline permanently, every
holder still owns their NFT and can cancel their orders directly against
Seaport.

Note the asymmetry in the cancel rows — it is a real product decision, not an
oversight. Free soft-cancel is the default because charging gas to unlist is
hostile. We bound the exposure three ways: default listing expiry of 30 days,
a prominent "cancel onchain" button for sellers who want certainty, and clear
copy explaining that unlisting hides an order rather than destroying it. The
window in which a soft-cancelled order can be filled by someone who archived
the signature is narrow, but it is non-zero and holders are told so.

---

## 5. Blocking compatibility checks — do these in the first three days

These can invalidate the whole plan. They are cheap. Do them before anything
else is built.

1. **Operator filtering.** Many 2022–2024 collections shipped an
   `OperatorFilterRegistry` hook that blocks transfers via non-allowlisted
   marketplaces. If our contract has one and Seaport's conduit is not
   allowlisted, *no listing can ever fill*. Check for
   `onlyAllowedOperator` / `operatorFilterRegistry` in the verified source,
   and confirm by simulating a real fill on a fork.
2. **ERC-2981.** Does the contract implement `royaltyInfo`? If yes, read the
   onchain value and use it as the source of truth for the 2.5% and the
   recipient rather than hardcoding a number in our backend. Onchain-declared
   royalty is more defensible and survives our site.
3. **Proxy / upgradeability / pause.** Is the contract upgradeable? Does it
   have a pause or transfer-restriction hook that could freeze fills?
4. **Interface conformance.** Plain ERC-721 `transferFrom` semantics, no
   rebasing/rental/soulbound weirdness, `supportsInterface` correct.

```bash
cast call $NFT "supportsInterface(bytes4)(bool)" 0x2a55205a --rpc-url $RPC   # ERC-2981
cast call $NFT "royaltyInfo(uint256,uint256)(address,uint256)" 1 10000 --rpc-url $RPC
cast call $NFT "isApprovedForAll(address,address)(bool)" $HOLDER $CONDUIT --rpc-url $RPC
```

Then the definitive test: fork mainnet, impersonate a real current holder,
sign a listing, fill it from a second account, and assert the artist Safe
balance increased by exactly 2.5%. Until that passes on a fork, we have not
proven the product works.

---

## 6. Four-week build plan

### Week 1 — Prove the path
- Run every §5 compatibility check. Escalate immediately if the operator
  filter blocks us.
- Verify all addresses in §1 against official docs and Etherscan; commit them
  to `config/addresses.ts`.
- Artist Safe created; signers and threshold confirmed with the artist in
  writing.
- **Fork test: full list → buy, artist receives exactly 2.5%.** This is the
  week's only real deliverable and it gates everything after it.
- Metadata backfill: all 5,000 tokens + traits indexed into Postgres, images
  pinned and CDN-cached.
- Measure real fill gas cost (§2).
- **Send the auditor the scope in §7 and get the quote.** Book the slot now;
  good firms are booked weeks out.

### Week 2 — Order construction and the order book
- `buildListing()` / `buildOffer()` — the order-struct construction library.
  Treat this as the crown jewels: it decides where money goes.
- EIP-712 signing in the browser via wagmi/viem, correct domain (chainId 1,
  verifying contract = Seaport, conduit key).
- Order validation service enforcing the royalty invariant on ingest (§7.3).
  **Our API refuses to store or serve any order that does not pay the artist.**
- REST API: submit order, list orders, order detail.
- Revalidation worker: re-check `ownerOf` and `isApprovedForAll` and Seaport
  `getOrderStatus` on a schedule and on every `Transfer` event; mark stale
  orders dead so we do not show listings that cannot fill.
- Indexer for `OrderFulfilled` and `Transfer` → sales history, "sold" state.

### Week 3 — The product
- Browse/grid over 5,000 pieces: filter by trait, sort by price, sale history.
  All offchain queries.
- List flow: approve (once) → sign → live. Clear "you keep your NFT" copy.
- Buy flow, including graceful handling of the revert-on-stale case.
- Offer flow: WETH wrap helper, approve, sign, offer appears on the token page
  and in the owner's dashboard.
- Accept-offer flow for owners.
- Cancel: soft (free) and hard (onchain), with honest copy about the difference.
- **Code freeze end of Week 3.** Auditor receives the exact commit hash.

### Week 4 — Harden, audit response, ship
- Audit report lands early in the week; triage and fix.
- Fix-review round with the auditor.
- Full fork-based regression suite green (§9).
- Deploy frontend + API + indexer (§10).
- Post-deploy verification transaction on mainnet (§10) before announcing.
- Monitoring and alerts live; then announce in Discord.

Reserve Week 4 for audit response. If we spend it building features, we have
no room to fix what the auditor finds, and the audit becomes decorative.

---

## 7. Audit scope — for quoting

**Engagement type: offchain / integration security review. This is not a
Solidity audit, because we are deploying no Solidity.** Firms should quote a
senior reviewer with real Seaport experience, not a generic smart-contract
auditor. Typical shape: 1–2 reviewers, 5–8 working days, two rounds.

**Artifacts provided:** repo + frozen commit hash (end of Week 3), threat
model doc, address config, fork test suite, this document.

### In scope

**7.1 Order construction library** *(highest risk, ~300–500 LOC TypeScript)*
The code that builds Seaport `OrderComponents`. A reviewer should assume a
bug here sends funds to the wrong address and check accordingly:
- Consideration array correctness: recipients, amounts, `itemType`, `token`,
  `identifierOrCriteria` for both listings and offers.
- Arithmetic of the split: does seller + artist equal the price exactly, with
  no rounding dust or truncation exploitable at small prices? Who eats the
  remainder wei?
- `offerer`, `zone`, `zoneHash`, `conduitKey`, `orderType`, `salt`, `counter`,
  `startTime` / `endTime`.
- Offer (WETH) orders as a distinct path — confirm the artist cut is
  identical, and that it is taken from the buyer's WETH and not silently from
  the seller's proceeds.

**7.2 EIP-712 signing and domain separation**
Domain (name, version, chainId=1, verifyingContract=Seaport), type hashes,
struct hashing, signature encoding. Any mismatch between what the user's
wallet displays and what will actually execute. Cross-chain / cross-contract
replay.

**7.3 The royalty invariant (backend validation)**
Our commercial model rests on one rule: *no order without the artist's 2.5%
is ever accepted, stored, or served.* Review the validator that enforces it,
specifically for bypasses — extra or duplicated consideration items, an
attacker-supplied recipient, zero-amount items, unit confusion, tampering
between signature and storage, direct API submission that skips the frontend.

**7.4 Cancellation semantics**
Soft-cancel replay exposure, correctness of hard cancel and
`incrementCounter`, counter desync between our DB and Seaport, whether a
cancelled order can be resurrected in our UI.

**7.5 Approval surface**
Conduit vs. direct Seaport approval, blast radius of `setApprovalForAll`
(it covers a holder's entire collection, forever, until revoked), revocation
UX, and whether we ever request a broader approval than needed.

**7.6 Stale-order and front-running behaviour**
Owner transfers or revokes mid-fill; two buyers race the same listing; an
owner accepts an offer while a buy is in flight. Confirm every bad outcome is
a clean revert and never a partial fill or a lost asset.

**7.7 Signature-phishing surface** *(explicitly requested)*
Signed-order phishing is the dominant real-world NFT loss vector — this is
where holders actually lose pieces. Review our signing UX: what the wallet
prompt renders, whether the price and recipients are legible before signing,
order-preview accuracy, and whether our patterns train holders into habits
that a cloned site could exploit.

**7.8 API and infrastructure**
Order tampering in transit, authn/authz, rate limiting, DB as an attack
surface for order mutation, and confirmation of a hard invariant we want
verified rather than asserted: **the backend holds no private keys and can
never sign or move a user's asset.**

**7.9 Collection compatibility**
Confirm the §5 findings independently: operator filter, ERC-2981, pause,
upgradeability.

### Explicitly out of scope
- **Seaport itself** — already audited by multiple firms, immutable, and
  securing far more value than we will. We review our *use* of it, not it.
- **WETH.**
- **Internals of our 2024 ERC-721** — immutable and already deployed; we
  assess compatibility only (7.9), not its security.
- Frontend issues with no asset-loss path (styling, accessibility, SEO).

### Deliverables requested from the auditor
Findings with severity and reproduction; a specific verdict on 7.1 and 7.3;
one fix-review round; a short public summary we can post to Discord. Holders
being asked to approve their collection deserve to see that something was
reviewed.

### Timeline for the quote
Engage Week 1 · code freeze end of Week 3 · report early Week 4 · fix review
mid Week 4. Please flag immediately if the freeze date cannot be met — we will
move the launch, not the audit.

---

## 8. Option B, priced for comparison — if we insist on our own contract

Only if there is a product reason the brief does not currently contain.

Scope: one non-custodial contract (~200–300 LOC) holding listings and offers
keyed by (collection, tokenId), EIP-712 orders, ETH/WETH settlement, a
hardcoded 2.5% split, and pull-payment withdrawals.

Audit scope becomes a real Solidity engagement: reentrancy on payout,
signature replay and malleability, royalty bypass, approval-drain via a
malicious token, `ownerOf`/approval race on fill, ETH-send failure handling,
access control, upgradeability, gas griefing. Plus a fuzz/invariant suite.

Realistic cost: **$30k–60k, 3–5 weeks, not including fix-review.** It does not
fit the four-week window, and it ships a contract with live approvals to 5,000
NFTs that has been reviewed once, competing against one reviewed continuously
for years. Recommendation: do not do this.

---

## 9. Testing

- **Mainnet fork is the primary harness**, not mocks. Impersonate real holders
  of real token IDs.
- Golden path: list → buy → assert NFT moved, seller paid, artist Safe +2.5%
  exactly.
- Offer path: WETH offer → accept → same royalty assertion.
- Adversarial: fill a soft-cancelled order; fill after owner transferred; fill
  after approval revoked; double-fill; expired order; tampered consideration;
  an order submitted straight to the API with the artist item stripped
  (**must be rejected**).
- Property test: for any price 1 wei → 1000 ETH, seller + artist == price, and
  artist share is never rounded to zero.
- Order-construction unit tests with fixed vectors, so a refactor cannot
  silently change where money goes.

---

## 10. Deployment runbook

No contract deployment. The "deploy" is frontend + API + indexer, and the
critical step is verifying the onchain path with real value.

**Required environment variables**
```
MAINNET_RPC_URL=
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_SEAPORT_ADDRESS=        # verified Week 1
NEXT_PUBLIC_CONDUIT_ADDRESS=
NEXT_PUBLIC_CONDUIT_KEY=
NEXT_PUBLIC_NFT_ADDRESS=
NEXT_PUBLIC_WETH_ADDRESS=
ARTIST_PAYOUT_ADDRESS=              # artist Safe
ROYALTY_BPS=250
DATABASE_URL=
```

**Deploy**
```bash
pnpm test && pnpm test:fork        # must be green
pnpm build
vercel deploy --prod               # frontend + API
pnpm indexer:deploy                # event indexer
```

**Post-deploy verification — do this before announcing**
```bash
# 1. Team wallet lists a team-owned token at 0.001 ETH through the live site.
# 2. Second team wallet buys it through the live site.
# 3. Assert the artist Safe received exactly 0.000025 ETH:
cast balance $ARTIST_PAYOUT_ADDRESS --rpc-url $MAINNET_RPC_URL
# 4. Confirm the NFT moved:
cast call $NFT "ownerOf(uint256)(address)" $TOKEN_ID --rpc-url $MAINNET_RPC_URL
# 5. Repeat once for the offer path (offer → accept).
```

If step 3 does not show exactly 2.5%, we do not announce.

**Ownership:** we own no contract, so there is no admin key to hand over —
a meaningful security property. The only privileged destination is the artist
Safe, which the artist controls. Our infrastructure holds no keys that can
move user assets.

**Monitoring:** alert on fill failure rate (a spike means stale-order handling
or an operator filter is biting), indexer lag, and any accepted order whose
artist consideration is missing — that last one should be impossible and is
therefore worth paging on.

---

## 11. Risks stated plainly

**The 2.5% is our policy, not a protocol guarantee.** Unless the collection
implements ERC-2981 *and* a given marketplace chooses to honour it, royalties
on Ethereum are not enforceable. We enforce ours on our own site, by refusing
to construct or serve an order that omits it. A holder who wants to avoid it
can trade elsewhere — as they can today. This plan moves Discord trading to a
surface where the artist gets paid by default; it does not and cannot make
royalties mandatory, and we should not tell the artist otherwise.

**Soft-cancel is not deletion.** Bounded by 30-day expiry and an onchain
cancel button, disclosed to holders in plain language.

**`setApprovalForAll` is a broad grant.** It is the standard non-custodial
tradeoff and the reason 7.5 and 7.7 are in the audit scope.

**Stale listings are normal, not a bug.** Nothing is escrowed, so an owner can
always move their token out from under a listing. The frontend is designed
around this rather than against it.

---

## Ship checklist

- [x] Onchain/offchain boundary explicit; rankings and browse computed offchain
- [x] Custom contract list concrete: **zero**
- [x] Every transition has a caller, an incentive, and a safe no-caller outcome
- [x] One chain chosen for a product-specific reason (the asset lives there)
- [ ] Addresses verified against official docs — Week 1
- [ ] Collection compatibility confirmed on a fork — Week 1
- [ ] Tests cover order construction; integrations fork-tested — Weeks 2–4
- [x] README/plan contains the transition table and an executable runbook
- [x] Production "ownership": no admin key exists; artist Safe is artist-held
- [ ] Independent reviewer checks the finished slice before launch — Week 4
