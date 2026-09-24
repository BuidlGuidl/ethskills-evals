# Collection Marketplace — 4-Week MVP Plan & Audit Scope

Non-custodial listings + offers for an existing 5,000-piece ERC-721 on Ethereum
mainnet, with a 2.5% artist royalty on every sale made through our site.

---

## 1. Architecture decisions (settle these before any code)

### Chain

**Ethereum mainnet.** Not a choice — the collection is already there and an
ERC-721 can't be moved. No bridging, no L2 mirror, no wrapped version. That
idea adds a trust assumption and splits liquidity for zero benefit at this
volume.

Cost sanity check at ~5 gwei: listing ≈ 60k gas (~$1), buy ≈ 120–150k gas
(~$2–3), cancel ≈ 30k gas (~$0.50). At Discord-level volume (tens of trades a
week) mainnet gas is a non-issue. Nobody needs to pay for an L2 deployment.

### Contract count: **one**

`CollectionMarket.sol` — listings, offers, settlement, royalty split. One
contract, ~250–350 lines. Everything else is offchain.

No escrow contract (nothing is ever held — see below). No factory (there is
exactly one collection, hardcoded as an immutable). No registry, no proxy, no
upgradeability. If we need v2, we deploy v2 and point the site at it; users
cancel-and-relist. Upgradeability would roughly double the audit scope to
protect against a problem we can solve with a redeploy.

### Onchain vs offchain

| Onchain | Offchain |
|---|---|
| Listing (seller, tokenId, price, expiry) | Browsing, search, sort, filter |
| Offer (buyer, tokenId, amount, expiry) | Images / metadata (already on IPFS) |
| Settlement + 2.5% royalty split | Trade history & activity feed (from events) |
| Cancellation / invalidation | Price charts, "recently sold", rarity |
| | Discord notifications |

The frontend never reads listings by scanning the chain. An indexer consumes
events and serves a JSON API; the contract is read only to re-verify a listing
at the moment of purchase.

### The two decisions that actually shape the audit

**1. Nothing is ever escrowed — including offers.**

- *Listings*: seller keeps the NFT and grants `setApprovalForAll` to the
  market. On `buy`, the market pulls the NFT from seller to buyer in the same
  transaction. This is what you asked for and it's also the industry-standard
  design.
- *Offers*: offers are denominated in **WETH, not ETH**. The buyer keeps their
  WETH and approves the market; on `acceptOffer` the market pulls WETH from the
  buyer. The alternative — buyers sending ETH into the contract to sit until
  accepted — makes the contract a custodian of pooled user funds, which is the
  single largest driver of both audit cost and blast radius.

Consequence worth stating plainly to the auditor: **the contract's ETH and
token balance is zero at the end of every transaction, and it never holds an
NFT.** The worst-case loss from a bug is bounded by what one user has approved,
not by a pooled balance. The one exception is the failed-payout escape hatch in
§3, which can hold dust for a seller with a reverting `receive()`.

Trade-off accepted: WETH offers mean buyers do a one-time wrap + approve. It's
one extra step, it's what OpenSea does, and it's worth it.

**2. Listings are onchain, not offchain signed orders.**

Seaport-style offchain signed orders cost the lister nothing in gas, but
require an order-book backend, EIP-712 signature verification, and onchain
nonce/cancellation machinery anyway. At ~$1 per listing and this volume, the
gas saving isn't worth the extra moving parts or the extra audit surface.
Onchain listings, revisit if volume grows.

### The alternative we are not taking (and why you should know it exists)

We could ship **zero contracts** by putting a Reservoir/Seaport-backed UI on
our own domain: same site, same branding, listings and offers work on day one,
no audit, maybe a week of frontend work. The catch is royalties — on a shared
order-book, the 2.5% is only as enforceable as each frontend chooses to make
it, and our own order flow would be mixed in with everyone else's.

Our own contract makes the 2.5% **unconditional for every sale that goes
through our site**: it's taken in the settlement function, not requested. That
is the reason to spend four weeks and an audit fee.

Either way, be clear-eyed about the limit: **we cannot stop holders from
selling on Blur or OpenSea at 0% royalty.** Our contract enforces the cut on
our marketplace only. The 2.5% is a function of where trades happen, so the
plan has to include making our site the path of least resistance (Discord bot
posting our listings, holder-only perks, the artist promoting it) — that's a
product problem, not a Solidity one.

---

## 2. State-transition audit (every function: who calls it, why)

Also serves as the auditor's function inventory.

| Function | Caller | Why they'd call | If nobody calls |
|---|---|---|---|
| `list(tokenId, price, expiry)` | NFT owner | Wants to sell at a set price | No listings; market is empty but safe |
| `updatePrice(tokenId, newPrice)` | Listing seller | Re-price without cancel+relist | Seller cancels and relists instead |
| `cancelListing(tokenId)` | Listing seller | Changed their mind | Listing expires on its own (expiry is mandatory) |
| `buy(tokenId, expectedPrice)` payable | Any buyer | Wants the piece at the listed price | Nothing happens; no funds at risk |
| `makeOffer(tokenId, amount, expiry)` | Any buyer w/ WETH | Bid below ask, or bid on an unlisted piece | No offers exist |
| `cancelOffer(tokenId)` | Offer maker | Withdraw bid | Offer expires; buyer can also just revoke WETH approval |
| `acceptOffer(tokenId, buyer, minAmount)` | NFT owner | Take a standing bid | Offer expires harmlessly |
| `withdrawFailedPayout()` | Seller/artist w/ stuck funds | Claim a payout that couldn't be pushed | Funds sit claimable forever; no one else can take them |
| `setRoyaltyRecipient(addr)` | Owner (Safe) | Artist rotates their wallet | Old address keeps receiving |
| `setPaused(bool)` | Owner (Safe) | Incident response | No kill switch during an incident |

**No function requires a keeper, bot, or cron.** Nothing degrades if the team
disappears: every listing and offer carries a mandatory expiry, and anyone can
always cancel their own or simply revoke their approval. There is no admin
function that can move a user's NFT or funds.

Note the two guard params: `buy(..., expectedPrice)` and
`acceptOffer(..., minAmount)`. They stop the seller front-running a purchase
with a price bump and the buyer front-running an accept with a lowered offer.
Cheap to add, and they close a whole class of griefing.

### Royalty handling

Hardcode it. `ROYALTY_BPS = 250` as an immutable constant; only the *recipient*
is settable, and only by the owner multisig. We deliberately do **not** read
`royaltyInfo()` from the 2024 collection contract — day one of week 1 we verify
on Etherscan whether it even implements ERC-2981, but either way a hardcoded
immutable 250 bps is one line the auditor can verify in a second, versus an
external call into a contract we can't change that could return anything.

Math: `royalty = price * 250 / 10_000`, `sellerProceeds = price - royalty`.
Computing the seller's side by subtraction rather than `price * 9750 / 10_000`
guarantees the two sides sum exactly to `price` with no dust stranded in the
contract. Flag to auditor: at prices below 0.0000000000000004 ETH the royalty
rounds to zero — economically irrelevant, but it should be a conscious
acceptance, not an oversight.

### Platform fee

MVP takes **0%**. Adding our own fee on top means another recipient, another
rounding path, another admin control, and a governance conversation with
holders. Ship the artist royalty, add a platform fee later if we ever want one.

---

## 3. Known attack surface we design against up front

These are the issues we expect to be the substance of the audit. Listing them
now means the auditor is confirming our reasoning rather than discovering the
problem class.

1. **Reentrancy via `onERC721Received` / `onERC1155Received`.** `buy` transfers
   the NFT to the buyer, who may be a contract that re-enters. Strict
   checks-effects-interactions (delete the listing *before* any transfer) plus
   `nonReentrant` on every state-changing entrypoint.

2. **Reentrancy via ETH payout.** `buy` pushes ETH to the seller with `call`,
   which hands control to a seller contract. Same defence; also means the
   royalty and seller payouts must happen after all storage is settled.

3. **Stale listings — the important one.** The collection is already deployed
   and has no transfer hook, so the market cannot be notified when a token
   moves. Every settlement path must re-derive validity at execution time:
   `ownerOf(tokenId) == listing.seller` **and** the market is still approved
   **and** `block.timestamp < listing.expiry`. The nasty case: Alice lists at
   0.4 ETH, sells on Blur for 2 ETH, later buys it back — her old 0.4 listing
   would go live again. Mitigations: mandatory expiry with a hard cap (90 days)
   enforced in `list`, a per-token listing nonce so a resurrected listing can't
   be matched, and an indexer that proactively marks listings dead on any
   `Transfer` event.

4. **Failed payouts.** A seller or the artist whose address reverts on receive
   would brick `buy` for that token. Payout uses `call` with a bounded gas
   forward; on failure the amount is credited to a `pendingWithdrawals` mapping
   and claimed via `withdrawFailedPayout()`. This is the only path that lets
   the contract hold a balance, so it gets explicit attention.

5. **Offer settlement.** WETH `transferFrom` must be checked (SafeERC20), and
   `acceptOffer` must verify the buyer's live balance and allowance rather than
   trusting the amount recorded at offer time. Offer must be deleted before
   transfers.

6. **Approval revocation races.** Seller revokes `setApprovalForAll` while a buy
   is in the mempool → the transaction reverts. Correct behaviour, but the
   frontend must surface it as "listing no longer available," not a raw revert.

7. **Access control.** Only `setRoyaltyRecipient` and `setPaused` are
   privileged. No admin function may touch a user's NFT or funds — this is an
   invariant the auditor should be asked to confirm holds, not just a claim.

8. **Pause semantics.** Pausing blocks new listings/offers/purchases, but
   `cancelListing`, `cancelOffer`, and `withdrawFailedPayout` must stay live.
   Users must always be able to exit.

---

## 4. Four-week build plan

Assumes one Solidity dev and one frontend dev working in parallel.

**Book the audit slot in week 1, not week 3.** Good auditors are 2–4 weeks out.
That's the single biggest schedule risk here, and it's the reason this document
finalises the scope before implementation starts.

### Week 1 — Spec freeze + contract

- Day 1: pull the 2024 collection on Etherscan — confirm it's a standard
  ERC-721, check for ERC-2981, transfer hooks, pause, or anything nonstandard
  that changes our assumptions. **Everything below depends on this.**
- Write the full function spec and invariant list (§2, §3 above), send to
  auditors for quoting, book the slot.
- Foundry project. Write `CollectionMarket.sol` against OpenZeppelin
  `Ownable2Step`, `ReentrancyGuard`, `Pausable`, `SafeERC20`, `IERC721`.
  Immutable collection address, immutable 250 bps.
- Deploy to Sepolia with a mock ERC-721 so the frontend isn't blocked.

Exit: contract compiles, deployed to testnet, auditor has the scope and a date.

### Week 2 — Tests and internal review, then freeze

- Unit tests for every function, happy path and every revert.
- Fuzz tests on the royalty split: assert `royalty + sellerProceeds == price`
  and `address(market).balance == 0` after every operation, for all prices.
- Adversarial tests, each mapped to an item in §3: malicious `onERC721Received`
  re-entering `buy`; reverting-receive seller; sell-elsewhere-then-buy-back
  stale listing; accept an offer whose buyer has drained their WETH; buy with a
  stale `expectedPrice`.
- Invariant/stateful fuzzing: contract never holds an NFT; contract ETH balance
  equals total `pendingWithdrawals` and nothing more.
- Mainnet **fork tests** against the real collection with real holder addresses
  via `vm.prank` — this is what catches a nonstandard collection.
- `slither .`, resolve or document every finding.
- Internal review by a second person, fresh eyes, against a security checklist.

Exit: **code freeze, tag the commit, hand to auditor.** Any change after this
point re-opens scope and the quote.

### Week 3 — Frontend and indexer (audit runs in parallel)

- Indexer over `Listed / ListingCancelled / ListingUpdated / Sale /
  OfferMade / OfferCancelled / OfferAccepted`, plus the collection's own
  `Transfer` events to kill stale listings. Ponder or a subgraph; a small
  Postgres-backed worker is fine too. Must handle reorgs.
- UI: grid view, token page, list flow (approve → list, two transactions, first
  one only ever once), buy flow, offer flow (wrap ETH → approve WETH → offer),
  cancel, and "offers on your pieces" for owners.
- Every async step gets a loading state and a real block-explorer link.
  **No infinite ERC-20 approvals** — approve the exact offer amount.
- Handle the revert cases as product states: listing gone, price changed,
  buyer's WETH no longer covers the offer.
- Wallet support: injected + WalletConnect + Coinbase Smart Wallet.

### Week 4 — Remediate, verify, ship

- Fix audit findings. Every fix gets a regression test naming the finding.
- Auditor re-reviews the diff (confirm this is in the engagement — fix review
  is usually included, don't assume).
- Deploy to mainnet, verify source on Etherscan.
- **Transfer ownership to a Gnosis Safe** (artist + 2 team, 2-of-3). Never an
  EOA. Use `Ownable2Step` so a typo'd address can't orphan the contract.
- Post-deploy smoke test with real funds and a real token: list at a token
  price, buy, confirm on Etherscan that the artist received exactly 2.5%.
- Frontend to Vercel behind our domain; ENS + IPFS as a fallback path.
- Dune dashboard for volume and royalties accrued; Discord bot posting new
  listings and sales.
- Incident runbook: who holds Safe keys, who can pause, what we post where.

### What's explicitly out of scope for the MVP

Auctions, bundles, collection-wide offers, WETH-denominated listings, a
platform fee, trait-filtered offers, multi-collection support, ERC-1155,
upgradeability. Each is a real feature; each also expands the audit. Ship the
loop the Discord already runs on.

---

## 5. Audit scope (send this to the auditor for a quote)

**Engagement:** security review of a single non-custodial NFT marketplace
contract for a fixed, already-deployed ERC-721 collection on Ethereum mainnet.

### In scope

| Item | Detail |
|---|---|
| Contract | `src/CollectionMarket.sol`, single file, **~250–350 lines** excluding imports and comments |
| Language / toolchain | Solidity 0.8.2x, Foundry |
| Dependencies (review integration, not internals) | OpenZeppelin `Ownable2Step`, `ReentrancyGuard`, `Pausable`, `SafeERC20`, `IERC721`; canonical WETH9 |
| External contracts it touches | The 2024 collection at `0x…` (immutable, not modifiable, **not in scope for review** but its behaviour is an assumption to validate), WETH9 |
| Commit | Frozen tag at end of week 2 — single commit, no moving target |
| Deliverable requested | Findings by severity, with remediation guidance, plus a re-review of the fix diff |

### Out of scope

Frontend, indexer, subgraph, Discord bot, backend infra; the already-deployed
2024 ERC-721 itself; economic/royalty-policy design (whether 2.5% is the right
number); anything in §4's out-of-scope list.

### Specific questions we want answered

1. Can any sequence of calls move an NFT or ETH/WETH to an address other than
   the intended buyer, seller, or royalty recipient?
2. **Is the 2.5% royalty unavoidable on every settlement path** — `buy` and
   `acceptOffer` — for all prices, including rounding edges?
3. Can a stale or resurrected listing be executed after the token has changed
   hands? (Expiry cap + per-token nonce + `ownerOf` recheck — is that
   sufficient?)
4. Is CEI ordering correct on both settlement paths against a malicious
   `onERC721Received` and a malicious seller `receive()`?
5. Can `buy` or `acceptOffer` be permanently bricked for a given token by any
   party (reverting receiver, approval games, gas griefing)?
6. Does `pendingWithdrawals` correctly account for all funds, and can one user
   claim another's?
7. Can the owner multisig, if fully compromised, steal or freeze user assets?
   We assert it cannot — confirm.
8. Do the `expectedPrice` / `minAmount` guards actually close the
   front-running windows we think they do?
9. Does the pause state still let every user exit (cancel and withdraw)?
10. Any assumption we've made about the 2024 collection that would break if it
    turns out to be nonstandard?

### Invariants the auditor should check we hold

- `address(market).balance == sum(pendingWithdrawals)` after every transaction.
- The market never holds an NFT or a WETH balance, at any point mid-transaction.
- `royaltyPaid + sellerProceeds == price` exactly, for every sale.
- `royaltyPaid == price * 250 / 10_000` for every sale.
- Only the current `ownerOf(tokenId)` can create or accept against that token.
- No admin function transfers or freezes a user's NFT or funds.

### What we provide at kickoff

Frozen tagged commit; this document as the spec; full Foundry test suite
including the adversarial and fork tests; `slither` output with our notes on
each finding; the collection's mainnet address and deployed source; a named
technical contact available same-day for the duration.

### Scoping note for the quote

Small, single-file, no upgradeability, no proxy, no oracle, no custody of
pooled funds, no external protocol integration beyond WETH `transferFrom` and
ERC-721 `transferFrom`. Comparable engagements are typically **2–4 auditor-days**.
We'd like the review to run during our week 3 with fix re-review in week 4;
if your lead time doesn't fit that, tell us now and we'll move the freeze date
rather than compress testing.

---

## 6. Risks to the four-week timeline

1. **Audit lead time.** The plan only works if the slot is booked in week 1.
   If the earliest availability is week 5, we ship the frontend against the
   testnet deployment and delay mainnet launch — we do **not** launch unaudited
   and we do **not** cut week 2's testing to compensate.
2. **The 2024 contract turns out to be nonstandard.** Day-1 investigation. A
   nonstandard `transferFrom`, a transfer hook, or a pause switch we don't
   control changes the design. Worth knowing on day 1, not week 3.
3. **High-severity finding late in week 3.** Week 4 has room for fixes and a
   re-review, but not for a redesign. That's what §3 is for — we design against
   the known classes so the audit confirms rather than discovers.
4. **Royalty leakage to other marketplaces.** Not a timeline risk, a business
   one. Stated in §1 so it isn't a surprise post-launch.
