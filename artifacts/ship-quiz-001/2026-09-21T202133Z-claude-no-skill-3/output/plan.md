# Community Marketplace — 4-Week MVP Plan & Audit Scope

Non-custodial listings, offers, and a 2.5% artist royalty for a 5,000-piece
ERC-721 collection already deployed on Ethereum mainnet.

---

## 0. The one decision to make before Week 1

**Recommendation: don't write a matching engine. Write a ~300-line settlement
contract, or integrate Seaport.**

Two viable paths:

| | A. Minimal custom contract | B. Seaport 1.6 integration |
|---|---|---|
| Solidity you own | ~300 lines | ~0 (plus maybe a thin zone) |
| Audit cost | ~$15–30k, 1 week | ~$3–8k, integration review only |
| Time to mainnet | 4 weeks, tight | 2.5–3 weeks |
| Royalty enforcement | You enforce it in the contract | Enforced by your order builder (front-end), bypassable by hand-built orders |
| Liquidity | Your site only | Orders are visible/fillable on OpenSea, Blur, etc. |
| Failure blast radius | Your bug, your users | Battle-tested, billions settled |

Path B is objectively lower risk and faster. The reason to pick **A** — and the
reason this plan assumes A — is the royalty: with Seaport, 2.5% to the artist is
a convention your UI applies, and anyone can construct an order that skips it.
With your own contract, the fee is computed in `_settle()` and is not optional.
If the artist cut is a soft expectation rather than a hard requirement, switch to
B on day 1 and hand the auditor an integration review instead; everything in
§4 about the off-chain order book still applies.

**Do not** put listings in escrow and **do not** make the contract upgradeable.
Both are explicitly out of scope: escrow contradicts the requirement, and a proxy
turns "your admin key" into "everyone's counterparty risk" while also doubling
the audit surface (storage layout, initializer, upgrade authorization).

---

## 1. Architecture

### On-chain: one contract, `Marketplace.sol`

Immutable, non-upgradeable, no escrow, no user balances held between
transactions. It is a **settlement contract**: it verifies a signed order,
moves the NFT, splits the money, and marks the order consumed. Nothing else.

```
Order {
  address maker;         // seller (ASK) or buyer (BID)
  address collection;    // must equal the immutable COLLECTION for MVP
  uint256 tokenId;
  uint256 price;         // wei
  address currency;      // address(0) = ETH (ASK only) | WETH (BID only)
  uint256 nonce;         // maker's cancel-all counter at signing time
  uint64  startTime;
  uint64  endTime;
  uint8   side;          // 0 = ASK (listing), 1 = BID (offer)
  bytes32 salt;
}
```

External functions — the entire ABI surface:

| Function | Caller | Notes |
|---|---|---|
| `fillAsk(Order, bytes sig)` | buyer | `payable`, `msg.value == price` exactly |
| `fillBid(Order, bytes sig)` | current owner of `tokenId` | pulls WETH from the bidder |
| `cancel(Order[])` | maker | marks specific order hashes consumed |
| `incrementNonce()` | maker | invalidates every order that maker has signed |
| `royaltyInfo()` / views | anyone | `orderStatus(bytes32)`, `nonces(address)`, `hashOrder(Order)` |

Design choices and why:

- **EIP-712 signed orders, off-chain order book.** Listing and cancelling are
  free for holders; on-chain cost lands on the party who is already paying gas
  to trade. This is how every production marketplace works.
- **ETH for listings, WETH for offers.** An offer must be collateralized without
  escrow, and the only way to pull value from a passive buyer later is an ERC-20
  allowance. ETH cannot do this. The UI wraps ETH for the buyer in the same flow;
  the seller receives WETH and can unwrap. **The contract does not unwrap on the
  seller's behalf** — that reintroduces an ETH push to an arbitrary address.
- **Cancellation is on-chain and only on-chain.** A "cancel" that only deletes a
  row in your database is not a cancel: anyone who saved the signature can still
  fill it. The DB soft-cancel is a UI nicety; the button must send a transaction.
  The UI has to say so plainly, because this is the #1 user-facing surprise.
  `incrementNonce()` is the cheap escape hatch for "cancel everything."
- **Royalty is computed, not passed in.** `royaltyBps` and `royaltyReceiver` are
  set at deploy. If the 2024 collection implements ERC-2981, read it at fill time
  and **cap the result** at a hard-coded max (say 1000 bps) so a compromised or
  mutable royalty setter on the NFT contract cannot drain the sale proceeds. If
  it does not implement ERC-2981 — check this in Week 1, it decides the code —
  hard-code 250 bps to an immutable artist address. Prefer the hard-coded path;
  it is strictly simpler to audit.
- **Payouts use pull-on-failure.** `seller.call{value: x}("")` with a gas stipend;
  if it reverts (Safe with an expensive fallback, contract seller), credit
  `pendingWithdrawals[seller]` and continue. A seller whose receive hook reverts
  must not be able to brick their own sale mid-transaction or, worse, be used to
  grief the royalty transfer. Same for the artist payout.
- **No protocol fee in the MVP**, but ship a `protocolFeeBps` (default 0, hard
  capped at 500, settable by the owner Safe) if there is any chance you want one
  later — adding it post-deploy means a migration.
- **Owner powers are exactly two**: `pause()` (blocks new fills, never blocks
  `cancel` or `withdraw`) and `setProtocolFee()` under the cap. Owner is a
  2-of-3 or 3-of-5 Gnosis Safe from day 1, not an EOA. The owner cannot move
  NFTs, cannot cancel user orders, and cannot touch pending withdrawals.

### Off-chain

- **Order book API** (Node + Postgres): `POST /orders` validates the signature,
  the maker's ownership/approval, and price sanity before storing; `GET /orders`
  serves the browse page. The DB is a *discovery* layer only — if it is wiped or
  compromised, no funds move and no NFT transfers; the worst case is censorship
  of listings and a bad UI.
- **Indexer**: subscribes to `Transfer`/`Approval`/`ApprovalForAll` on the
  collection and to `OrderFilled`/`OrderCancelled`/`NonceIncremented` on the
  marketplace, and marks orders stale. Without this, your grid is full of
  listings that revert on click. Re-validate the top N orders on every block.
- **Frontend**: collection grid, token page, list / buy / offer / accept /
  cancel, "you have N pending withdrawals" banner.

---

## 2. Four-week schedule

The hard constraint is that **the auditor needs a frozen commit**. Everything is
arranged to freeze the contract at the end of Week 2 and keep the team busy on
off-chain work while the audit runs.

### Week 1 — Decide, specify, skeleton

- Read the deployed collection on mainnet: does it implement ERC-2981? Is there
  an operator filter or transfer hook? Are there any non-standard transfer
  restrictions? Are tokens held by Safes/contract wallets (→ ERC-1271 matters)?
- Write the spec: order struct, EIP-712 domain, exact event signatures, the
  invariant list from §3 below.
- Implement `Marketplace.sol` first pass, Foundry, Solidity 0.8.28, OZ v5.
- **Send the auditor the spec + this scope document and get the quote booked for
  the Week 3 slot.** Auditors are booked 3–6 weeks out; this is the single
  scheduling risk that can blow the four weeks.
- Start the indexer and DB schema in parallel.

### Week 2 — Harden and freeze

- Full Foundry suite: unit, fuzz (prices, timestamps, fee rounding), invariant
  tests, and mainnet-fork tests against the **real** collection at a pinned block
  with real holders impersonated. Fork tests are not optional — they are what
  catches "the collection does something weird."
- Slither + Aderyn clean, `forge coverage` ≥ 95% on the contract, gas snapshot.
- Internal review round: two engineers read the contract line by line against
  the invariant list.
- Deploy to Sepolia with a mock collection.
- **Friday: tag `v1.0.0-audit`, freeze, hand off.** No contract commits after
  this except audit fixes.

### Week 3 — Audit runs; build the product around it

- Auditor works the frozen tag.
- Frontend: full flow against Sepolia. Signature UX, WETH wrap + approve flow,
  `setApprovalForAll` step, cancel-costs-gas messaging, pending-withdrawal
  banner.
- Order API + indexer to feature-complete; stale-order pruning verified.
- Ops: deploy script with verified source, Safe set up and funded, incident
  runbook (who can pause, from what device, how fast).
- Closed testnet trading session with 10–15 Discord holders. Half your real bugs
  come from this, and none of them are in the contract.

### Week 4 — Fix, verify, ship

- Days 1–2: triage findings. Fix criticals/highs; document acknowledged lows.
- Day 3: auditor re-reviews **the diff only** (agree this is included in the
  original quote — otherwise it becomes a second engagement and you miss the
  date). Re-run the full test suite and fork tests on the fixed commit.
- Day 4: mainnet deploy, Etherscan verify, transfer ownership to the Safe,
  seed 5–10 real listings from the team, soft launch to Discord.
- Day 5: monitoring, buffer. Publish the audit report and the contract address
  in Discord.

**If the audit slips or returns a critical**, ship the read-only browse site and
keep trading in Discord for another week. Do not ship an unaudited settlement
contract to hold other people's NFT approvals.

### Cut list, in order, if Week 3 goes badly
1. Offers/bids (ship listings only; `fillBid` stays in the audited contract, the
   UI turns it on later — this keeps the contract frozen)
2. ERC-1271 smart-wallet support (EOAs only at launch)
3. Anything cosmetic

---

## 3. Invariants (give these to the auditor verbatim)

These double as the invariant test suite. Each is a property the auditor should
try to break.

1. The contract holds no ETH, WETH, or NFTs between transactions, except
   `pendingWithdrawals` balances, and `sum(pendingWithdrawals) <= address(this).balance`.
2. A successful fill transfers the NFT from the seller to the buyer **and**
   distributes exactly `price` — no wei retained, no wei created:
   `royalty + protocolFee + sellerProceeds == price`.
3. The royalty on every fill is exactly 2.5% of `price` (rounding direction
   specified and consistent), to the artist address, on **both** `fillAsk` and
   `fillBid`. No code path settles a trade without paying it.
4. An order hash can be consumed at most once. Two fills of the same signature,
   in the same block or across blocks, are impossible.
5. `cancel()` and `incrementNonce()` are irreversible and callable only by the
   maker; after either, no fill of the affected orders can succeed.
6. Only the maker's own orders can be cancelled by the maker; no one — including
   the owner — can cancel or fill on another user's behalf.
7. A signature valid for this contract on chain 1 is invalid on any other chain,
   for any other contract, and for any mutation of any order field.
8. Orders outside `[startTime, endTime]` cannot be filled.
9. Neither buyer nor seller can pay or receive anything other than what the
   signed order specifies. `msg.value` mismatches revert rather than partially
   fill or silently keep change.
10. A reverting or gas-griefing recipient (seller, artist, buyer) cannot cause a
    fill to (a) revert if the counterparty is honest, or (b) skip a payout.
11. No reentrant call — via ERC-721 receiver hooks, WETH, or an ETH callback —
    can fill the same order twice, fill a cancelled order, or drain
    `pendingWithdrawals`.
12. `pause()` never prevents `cancel()`, `incrementNonce()`, or `withdraw()`.
13. Loss of the owner key cannot cost any user their NFT or their funds.

---

## 4. Audit scope (hand this to the auditor for a quote)

### Engagement

- **Target**: git tag `v1.0.0-audit`, commit hash TBD (frozen end of Week 2).
- **Window requested**: Week 3, 5 business days, plus a diff re-review in Week 4
  (please include the re-review in the quote).
- **Chain**: Ethereum mainnet only. Solidity 0.8.28, EVM version `cancun`,
  optimizer 200 runs. Foundry.
- **Deliverables**: findings report with severity ratings and reproduction, a
  re-review letter on the fixed commit, and a short public summary we can post.

### In scope

| File | ~LOC | Notes |
|---|---|---|
| `src/Marketplace.sol` | ~300 | The only contract we deploy |
| `src/libraries/OrderHash.sol` | ~60 | EIP-712 struct hashing |
| `src/interfaces/*.sol` | ~40 | Interfaces only |
| **Total new Solidity** | **~400** | |

Also in scope as supporting material (review, not audit):
- Foundry test suite, including mainnet-fork tests.
- Deploy script and constructor arguments (artist address, royalty bps, WETH
  address, collection address, initial owner Safe).
- This invariant list (§3) — we want an explicit statement on each.

### Explicitly out of scope

- The 2024 ERC-721 collection itself (deployed, immutable, not ours to change).
  We do want its **interaction surface** reviewed: how its actual behavior
  affects settlement. We will provide its address and verified source.
- Canonical WETH, OpenZeppelin v5 contracts.
- Frontend, order-book API, indexer, database. The threat model assumes the
  order book is **fully compromised** — an attacker who controls it can show
  arbitrary orders to arbitrary users. We are asking you to confirm that in that
  world, users still cannot lose funds or NFTs beyond executing orders they
  themselves signed.
- Economic/market design: wash trading, price manipulation, MEV sandwiching of
  listings. We accept that listings are public and can be sniped.
- Key management and Safe configuration (we'll handle separately).

### Threat model and areas we want emphasized

1. **Signature handling** — EIP-712 domain separator correctness, replay across
   chains/contracts/orders, malleability, `ecrecover` zero-address handling,
   ERC-1271 for Safe-held tokens, signature reuse after partial state change.
2. **Approval abuse** — users grant `setApprovalForAll` to this contract. Can any
   call path move an NFT the owner did not sign an order for? This is the single
   highest-severity class: a bug here drains the collection from every user who
   ever listed.
3. **Payment splitting** — rounding, the 2.5% cut on both fill paths, exact
   `msg.value`, ETH stuck in the contract, the pull-payment fallback,
   `pendingWithdrawals` accounting.
4. **Order lifecycle** — double-fill, fill-after-cancel, nonce semantics,
   time-window handling, filling an order whose maker no longer owns the token or
   has revoked approval.
5. **Reentrancy and external-call ordering** — `onERC721Received`, WETH transfer
   hooks, ETH push callbacks; CEI adherence; cross-function reentrancy between
   `fillAsk`/`fillBid`/`cancel`/`withdraw`.
6. **Access control** — the owner's two powers and their limits; confirm the
   owner cannot rug.
7. **Griefing** — front-running a fill with a cancel or a transfer (we consider a
   wasted-gas revert acceptable; we do not consider a state-corrupting outcome
   acceptable); DoS of a seller's ability to sell or cancel.
8. **Collection-specific behavior** — anything about the deployed ERC-721 that
   breaks assumptions (non-standard transfer, hooks, mutable ERC-2981).

### What we will provide at kickoff

Frozen commit hash · this document · the spec from Week 1 · deployed collection
address and verified source · architecture diagram · the invariant list ·
`forge coverage` and Slither output · a named engineer on Slack for the duration.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| **Auditor unavailable in Week 3** — the most likely cause of a miss | Book in Week 1, before code is written. Have a second firm quoted as backup. |
| Contract keeps changing during the audit | Hard freeze at the Week 2 tag; off-chain work absorbs the team in Week 3. |
| Critical finding in Week 4 | Ship browse-only, delay trading a week. Decided in advance, not under pressure. |
| Collection does something non-standard | Discovered in Week 1 by reading it, confirmed by fork tests in Week 2. |
| Users don't understand that cancel costs gas | Explicit UI copy + `incrementNonce()` as a bulk escape hatch. |
| Users don't understand `setApprovalForAll` | One-time, explained in the UI, with a revoke link. |
| Stale listings ruin the browse experience | Indexer + re-validation of visible orders each block. |
