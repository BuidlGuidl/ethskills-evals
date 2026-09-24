# Collection Marketplace — 4-Week MVP Plan & Audit Scope

Move holder-to-holder trading of the 5,000-piece 2024 mainnet collection out of
Discord DMs and onto our own site: non-custodial listings, instant buy, buyer
offers the owner can accept later, seller cancel, and a 2.5% artist cut on every
sale executed through us.

---

## 1. Headline recommendation

**Build zero custom contracts. Settle on Seaport 1.6.**

Everything the product asks for is exactly what Seaport already does, and does in
audited, battle-tested code:

| Product requirement | Seaport mechanism |
| --- | --- |
| List without escrow | Order is an offchain EIP-712 signature; NFT stays in the owner's wallet until fulfillment |
| Anyone browsing can buy | `fulfillOrder` / `fulfillAdvancedOrder` by the buyer |
| Artist takes 2.5% | A second `consideration` item in the order, signed by the seller |
| Buyer makes an offer, owner accepts later | Same order struct with the sides flipped: offer = WETH, consideration = NFT + fee |
| Seller cancels | `cancel(orders)` onchain, or `incrementCounter()` to void all of their open orders |

The 2.5% is enforced by the signature, not by trust: the seller signs a payload
that pays the artist, and Seaport reverts unless *every* consideration item is
paid in full. A seller cannot sign our order and keep the fee. They can of
course sign a *different* order elsewhere — see §6.

This decision is the single largest lever on the audit quote. Writing our own
marketplace contract turns a ~$8–15k integration review into a ~$25–45k contract
audit and consumes two of the four weeks. §7 keeps a custom-contract fallback
scoped in case the audit firm or the team rejects the Seaport path, but it is
not the recommendation.

**Contract count: 0 custom contracts deployed. 0 upgradeable proxies. 0 escrow.**

### Addresses — verify, do not copy from this document

Seaport 1.6 and its ConduitController are deployed at the same addresses on all
supported chains. Before wiring anything, pull the canonical values from
`https://github.com/ProjectOpenSea/seaport` (the `deployments` section of the
README) and confirm each one on Etherscan shows verified source matching the
tagged release. Record the confirmed addresses in `deployments/mainnet.json` and
reference that file from code — never a hardcoded literal in a component.

A wrong marketplace address means holders sign token approvals to an attacker.
This is a two-person check with a screenshot in the PR, not a solo copy-paste.

---

## 2. Onchain / offchain boundary

| Onchain (Ethereum mainnet, via Seaport) | Offchain (our API + Postgres) |
| --- | --- |
| NFT transfer at settlement | Signed order payloads (listings and offers) |
| ETH/WETH payment split, incl. the 2.5% | Browse, filter, sort, trait search |
| Approvals (seller → conduit, buyer WETH → conduit) | Price history, volume, floor price, "top offers" |
| Cancellation (`cancel`, `incrementCounter`) | Token images and metadata cache |
| The fee commitment itself (inside the signature) | Activity feed, Discord notifications |

**Rankings and stats are derived data.** Floor price, volume, and leaderboards
are computed by our indexer from Seaport's `OrderFulfilled` events plus ERC-721
`Transfer` events. Nothing about a browse screen lives in contract storage.

**A listing has two states and we must not confuse them.** "Active in our
database" is our own bookkeeping. "Valid onchain" is the truth: a signature is
live until it expires, until `cancel` is mined, or until the counter moves.
Deleting the row hides the listing from our UI; it does not revoke it. Every
cancel path in the UI must therefore offer the real onchain cancel (§4).

---

## 3. Chain decision: Ethereum mainnet. Not a choice.

The collection is an immutable 2024 ERC-721 on mainnet. Non-custodial trading of
that token settles where the token lives. Any L2 story requires a bridge or a
wrapper that takes custody — which directly contradicts the "nothing sits in
escrow" requirement — so it is out of scope for the MVP and for the audit.

Gas is a UX problem, not a chain-selection problem. Measure it rather than
guessing, during Week 1, and again the day before launch:

```bash
cast gas-price --rpc-url $MAINNET_RPC
cast block latest --rpc-url $MAINNET_RPC --field baseFeePerGas
```

Budget roughly: approval ~50k gas (one time per seller), `fulfillOrder` ~150–250k
depending on fee items and route. Feed real numbers into the UI copy so a holder
listing a 0.4 ETH piece sees the actual cost of buying before they commit. If a
buy costs a meaningful fraction of typical sale price at current base fees, that
is a product conversation to have in Week 1, not a discovery at launch.

---

## 4. State transitions

Contracts do not run on schedules. Every transition below is triggered by
someone who directly benefits from triggering it.

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `setApprovalForAll(conduit, true)` | seller | one-time, unlocks their ability to sell | they cannot list; no funds at risk |
| Sign listing (EIP-712) | seller | gasless; makes their piece purchasable | no listing exists |
| `fulfillOrder` (buy) | buyer | receives the NFT | listing sits open until it expires |
| `approve(conduit, amount)` on WETH | offer maker | one-time, unlocks offers | they cannot offer |
| Sign offer (EIP-712) | buyer | gasless; puts a bid in front of the owner | no offer exists |
| `fulfillOrder` (accept offer) | **owner** | receives the WETH | offer sits open until it expires |
| `cancel(orders)` | seller / offer maker | permanently kills a specific order | order stays fillable until expiry |
| `incrementCounter()` | seller / offer maker | kills *all* their open orders at once | as above |

Read the last three rows together, because they are where a real user gets hurt.
Notice who pays for accepting an offer: the **owner**, not the bidder. An owner
accepting a 0.3 ETH offer pays mainnet gas out of their own pocket, and the UI
must show that number *before* they click, or we generate support tickets.

Notice also what "cancel" costs. Cancelling is an onchain transaction, so a
holder who relists three times a week pays for it. Mitigation, in priority order:

1. **Every order carries an expiry.** Default 30 days, user-selectable. An
   expired order is dead without anyone paying gas — this is the main defence.
2. **Soft-cancel by default**: we delist from our UI and stop serving the
   signature. Honest in the UI: *"Removed from the site. The signed offer stays
   valid onchain until <date> — cancel onchain to kill it now."* Vague wording
   here is how a holder gets their piece bought at a stale price months later.
3. **Hard cancel on demand**: a button that sends `cancel`, and a "cancel
   everything" that sends `incrementCounter()`.
4. **Price-drop = new signature**, free. Only an actual withdrawal costs gas.

There is no keeper, no cron, no owner-only function, and no liveness path that
depends on our servers being up. If our site disappears tomorrow, every open
order is still cancellable and fulfillable directly against Seaport by anyone
holding the signature.

---

## 5. Week 0 — three checks that can invalidate this plan

Do these **before** the auditor quotes, ideally in the first two days. Each one
is a `cast` call against the live contract; total effort is under a day.

**1. Does the collection block operators?** Many 2024 ERC-721s shipped with
OpenSea's `OperatorFilterer` or a custom transfer blocklist. If the token's
`transferFrom` reverts for the Seaport conduit, the entire non-custodial design
fails on day one.

```bash
cast call $COLLECTION "isApprovedForAll(address,address)(bool)" $HOLDER $CONDUIT --rpc-url $MAINNET_RPC
# and read the verified source on Etherscan for _beforeTokenTransfer hooks,
# onlyAllowedOperator modifiers, or any pausable / blocklist logic
```
Then prove it end-to-end on a mainnet fork: approve the conduit and fulfill a
listing for a real token ID held by a real address. A green fork test is the
only acceptable answer here.

**2. Does it implement ERC-2981?**
```bash
cast call $COLLECTION "royaltyInfo(uint256,uint256)(address,uint256)" 1 10000 --rpc-url $MAINNET_RPC
```
If yes, read the on-contract recipient and bps and make our 2.5% match it exactly
— divergence between what the contract declares and what our site pays is a
reputational problem later. If it reverts, the collection has no onchain royalty
and our consideration item *is* the royalty. Either way, the 2.5% recipient
address must be confirmed in writing by the artist and stored in config, not
inferred.

**3. Is the contract pausable or does it have an owner with transfer powers?**
Affects the risk section of the audit and what we tell holders.

If check 1 fails, stop and re-plan — probably toward a custom contract that the
collection's allowlist can be updated to permit, which is a different four weeks.

---

## 6. What this design does *not* do

State these plainly on the site, and to the auditor:

- **The 2.5% is not globally enforced.** It applies to sales through our order
  builder. A holder can still sell on any other venue, or hand-to-hand in
  Discord, and pay nothing. Enforcing royalties on an already-deployed 2024
  ERC-721 with unrestricted `transferFrom` is not possible — no contract we write
  can change that. The honest pitch is that our site is the easy, safe path, not
  that it is the only path.
- **We do not detect stolen goods.** No Chainalysis-style screening in the MVP.
- **We do not prevent wash trading**, which will distort the volume stats we
  display. Accepted for a 5,000-piece community collection.
- **Offers are WETH-only.** Native ETH cannot be pulled by a later acceptance, so
  the offer flow requires a wrap. This is one extra step in the UI and needs a
  clear explanation screen.
- **No collection-wide / trait offers** in the MVP. Seaport supports them via
  criteria orders with a Merkle root; ship single-token offers first, then add
  criteria offers in a v1.1 once the order-builder is proven.
- **No auctions, no bundles, no private sales.** Deliberately cut.

---

## 7. Fallback: the custom contract, if we are forced off Seaport

Only if Week 0 check 1 fails, or the team rejects the Seaport dependency.

One contract, `Marketplace.sol`, non-upgradeable, ~250 lines: EIP-712 listing and
offer structs, `fulfillListing`, `acceptOffer`, `cancel`, `incrementNonce`, a
hardcoded-at-deploy 2.5% fee and recipient, `ReentrancyGuard`, pull-payment for
ETH to the artist, and Solady/OZ for `ECDSA` + `SafeTransferLib`. No factory, no
escrow, no router, no proxy, no fee-splitter contract — the artist address is
whatever the artist controls, including a Splits contract they deploy themselves.

Cost delta, stated up front so the tradeoff is a decision and not a surprise:
+2 weeks of implementation and +$20–30k of audit, for a system with strictly
fewer users' eyes on it than Seaport. Reach for it only when forced.

---

## 8. Four-week build plan

Frontend: Next.js + wagmi/viem + RainbowKit. Backend: Node + Postgres + a viem
log indexer. Contracts: `seaport-js` for order construction, Foundry for fork
tests. Hosting: Vercel + a managed Postgres; the indexer runs as a separate
always-on worker, not a serverless function.

### Week 1 — Prove the path, then build the order layer
- Week 0 checks (§5), fork test of a real approve → list → fulfill cycle. **Gate:
  a green fork test against a real token ID before any UI work starts.**
- Confirm Seaport + conduit addresses from official docs, two-person signoff,
  commit to `deployments/mainnet.json`.
- Order builder module: one place that constructs listing and offer payloads.
  The 2.5% consideration item is injected here and **nowhere else** — a single
  chokepoint is what makes the fee auditable in one file.
- Foundry fork suite: fee correctness across prices, ETH vs WETH, cancel,
  expiry, non-owner attempting to list, seller transferring the NFT away after
  listing.
- Indexer skeleton: ingest `OrderFulfilled` and ERC-721 `Transfer`, handle
  reorgs (N-block confirmation depth, not head-following).

### Week 2 — List, buy, cancel
- Wallet connect, ownership check, approval flow with a plain-language screen
  explaining what `setApprovalForAll` grants.
- Create listing → sign → POST to API → validated server-side (signature recovers
  to the current owner; fee item present, correct bps, correct recipient; expiry
  sane). **A listing that fails server-side validation is never stored.**
- Grid + token page, buy button, transaction status, optimistic-but-verified
  state (flip to "sold" only on confirmed logs, never on tx submission).
- Soft cancel + hard cancel + "cancel all", with the honest copy from §4.
- **End of Week 2: a real holder lists and a real buyer buys, on mainnet, with
  the artist paid.** One completed sale is the milestone; everything after it is
  broadening.

### Week 3 — Offers
- WETH wrap/unwrap UI and allowance flow.
- Make offer → sign → validate (funds and allowance actually present at signing
  time; re-check at display time so the owner never sees an unbacked offer).
- Owner's inbox: offers on my pieces, with the gas cost of accepting shown
  before the click.
- Accept offer → `fulfillOrder` by owner. Offer cancel + expiry.
- Background revalidation sweep: drop offers whose maker no longer holds the WETH
  or the allowance. A stale offer that fails on accept burns the *owner's* gas —
  this sweep exists specifically to protect them.
- Activity feed + Discord webhook on sale, so the community channel becomes a
  feed of real sales instead of a DM negotiation venue.

### Week 4 — Harden, review, launch
- Auditor engaged from start of Week 3 on a frozen order-builder module (§9).
  Code freeze on order construction at end of Week 2.
- Fix audit findings; re-run the full fork suite.
- Rate limiting, signature-validation fuzzing on the API, DB backups.
- Runbook in the README (§10), including the transition table from §4.
- **Independent pre-launch review** by someone who did not build it: a fresh
  reviewer walks the vertical slice end to end on mainnet with their own wallet
  and their own money.
- Soft launch to ~20 Discord holders for 3 days, then open up.

**Cut list if we slip** — in this order, no debate at the time: trait offers
(already cut), activity feed, Discord webhook, price history charts. **Never
cut:** the onchain hard-cancel path, the offer revalidation sweep, the fork test
suite, or the independent review.

---

## 9. Audit scope — for the quote

**Engagement type: integration and application security review. There is no
custom Solidity in scope.** Please quote on that basis; flag immediately if this
changes the nature of the engagement for you.

**Target:** commit hash of `main` at end of Week 2, order-builder module frozen.

### In scope

| # | Artifact | Approx. size | What we need reviewed |
| --- | --- | --- | --- |
| 1 | `lib/orders/build.ts` — Seaport listing + offer construction | ~300 LOC | Fee item always present, correct bps and recipient, correct item types, no path constructs an order without the fee, zone/conduit/salt/counter set correctly, expiry always set |
| 2 | `lib/orders/validate.ts` — server-side order validation | ~250 LOC | Signature recovery, signer == current owner, fee-item verification, replay and malleability, rejection of malformed or hostile payloads |
| 3 | `api/orders/*` — create/list/cancel endpoints | ~400 LOC | Authz (only the maker can cancel), injection, rate limiting, DB-vs-chain trust boundary |
| 4 | `deployments/mainnet.json` + all address usage | small | Correct canonical Seaport/conduit/WETH addresses, no hardcoded literals elsewhere |
| 5 | `app/` approval, buy, and accept-offer flows | ~600 LOC | What the user is actually signing vs. what the UI tells them; approval scope; phishing-resistance of signing screens |
| 6 | `indexer/` | ~400 LOC | Reorg handling, event mis-attribution, sale/ownership state correctness |
| 7 | `test/fork/*.t.sol` | ~500 LOC | Completeness against the invariants below |

Total ≈ 2,500 LOC of TypeScript + ~500 LOC of Solidity tests. No deployed custom
contracts.

### Invariants to verify

1. Every order our site produces pays the artist exactly 2.5% of the sale price,
   for both listings and offers, at every price point including dust and very
   large values, with rounding never favouring the seller.
2. No code path constructs a valid order missing the fee consideration item.
3. An order cannot be created by anyone other than the current owner of the token
   (listings) or an address with sufficient WETH balance and allowance (offers).
4. Only the maker can cancel their own order, in our API and onchain.
5. A cancelled or expired order cannot be fulfilled.
6. A signature cannot be replayed across tokens, prices, chains, or accounts.
7. Nothing in the system takes custody of an NFT or of funds at any point.
8. Our database being compromised cannot cause a user to lose an asset — worst
   case is display corruption and orders hidden or surfaced dishonestly. **We
   specifically want this one probed hard:** assume full DB write access and tell
   us what the attacker can extract.

### Threat model to exercise

- Malicious seller: manipulated order payload, fee stripped or redirected,
  listing a token they do not own, front-running a buy with a transfer.
- Malicious buyer: unbacked offers that burn the owner's gas on accept; offer
  withdrawn in the same block the owner accepts.
- Malicious/compromised backend: serving altered orders, hiding orders,
  substituting the fee recipient, serving a wrong contract address to the UI.
- Phishing surface: what a user sees vs. what they sign; blind-signing risks.
- The collection contract itself: pausability, owner powers, transfer hooks or
  operator filtering that could brick or be used to grief settlement.

### Explicitly out of scope

Seaport itself and its conduit (already audited upstream); the 2024 ERC-721
collection contract (immutable, not ours — we want its *behaviour* characterised
per the threat model above, not an audit of its code); wash trading; stolen-asset
screening; Vercel/Postgres infrastructure config; the Discord bot.

### Deliverables requested

Findings by severity with reproduction steps; a written statement on each of the
eight invariants; a specific opinion on whether the 2.5% can be bypassed by
anyone transacting *through our site*; remediation review of fixes within Week 4;
a short public summary we can post to the holder community.

### Timeline

Kickoff at start of Week 3 on the frozen commit. Findings by mid-Week 4. Fix
review by end of Week 4. Roughly a 6–8 working day engagement. Tell us early if
that is unrealistic for your queue — we would rather move the launch date than
compress the review.

### What we will send with the quote request

This document; the repo at the frozen commit; the collection address and its
Etherscan-verified source; the confirmed Seaport and conduit addresses with our
verification notes; the Week 0 findings from §5; fork test suite and coverage
report; the state-transition table from §4.

---

## 10. Release checklist

- [ ] Week 0 checks pass; operator-filter fork test green against a real token ID
- [ ] Seaport + conduit addresses verified by two people against official docs
- [ ] Artist fee recipient confirmed in writing by the artist; matches ERC-2981
      if the collection implements it
- [ ] Fork tests cover all eight invariants
- [ ] Audit findings resolved or accepted in writing with a reason
- [ ] README contains the transition table and the full runbook below
- [ ] Independent reviewer completes a real mainnet buy and a real accepted offer
      with their own wallet, unaided
- [ ] Indexer alerting live; runbook for indexer lag and reorgs written
- [ ] Soft launch to ~20 holders for 3 days before opening up

**Runbook that must exist in the README before we call this shippable:** required
env vars (`MAINNET_RPC`, `DATABASE_URL`, `SEAPORT_ADDRESS`, `CONDUIT_ADDRESS`,
`WETH_ADDRESS`, `COLLECTION_ADDRESS`, `ARTIST_FEE_RECIPIENT`, `ARTIST_FEE_BPS=250`);
frontend and indexer deploy commands; how to roll back; and a post-deploy
verification trade — list a team-held token at 0.001 ETH, buy it from a second
wallet, and confirm on Etherscan that the artist address received exactly 2.5%.
Do that on the production deployment, every release.

Since we deploy no contracts, there is no contract verification step and no
ownership transfer to a multisig. The only privileged production secrets are the
DB credentials and the RPC key; neither can move a user's asset. The artist fee
recipient should nonetheless be a multisig or a Splits contract the artist
controls — it receives real money and we should not be the ones holding it.
