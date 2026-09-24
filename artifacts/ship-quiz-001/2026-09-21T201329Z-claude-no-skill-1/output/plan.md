# On-site Marketplace for the Collection — 4-Week MVP Plan + Audit Scope

Scope: a self-hosted, non-custodial secondary market for one existing ERC-721
collection on Ethereum mainnet (5,000 pieces, minted 2024). Fixed-price listings,
buyer offers, seller cancellation, no NFT escrow, 2.5% to the artist on every
sale settled through our contract.

---

## 0. One honest caveat about the four weeks

Four weeks buys **code-complete + tested + testnet-live + frozen for audit**. It
does not buy a mainnet launch, because an external audit of a fresh settlement
contract is 5–10 working days plus a remediation round. Realistic calendar:

| Week | Outcome |
|---|---|
| 1 | Chain due diligence done, spec frozen, audit scope sent → quote |
| 2–3 | Contract + tests + frontend + indexer; testnet live |
| End of 3 | **Commit freeze, audit starts** |
| 4 | Frontend polish, ops runbook, fix findings as they land |
| 5–6 | Remediation, re-review, mainnet deploy, staged launch |

If a hard four-week public launch is required, the only safe way to compress is
to launch listings-only (drop offers from v1) — that removes the WETH path and
roughly a third of the audit surface. Recommendation: don't compress; run the
Discord channel in parallel for two more weeks.

Second caveat worth stating up front: the 2.5% is enforceable **only on sales
that go through our contract**. Hand trades in Discord and sales on venues that
ignore ERC-2981 will still pay the artist nothing. This project reduces
royalty leakage by being the nicest place to trade, not by making it impossible.

---

## 1. Pre-flight: facts we must confirm before writing a line of Solidity

These are properties of an already-deployed, immutable token contract. Each one
can invalidate the design, so all of them are Week 1, Day 1–2 work (a few
`cast call`s plus reading the verified source on Etherscan).

1. **Is it a plain ERC-721?** Confirm `supportsInterface(0x80ac58cd)`. Check
   whether `transferFrom` / `safeTransferFrom` are standard or overridden.
2. **Operator filtering.** Many 2024-era collections shipped OpenSea's
   `OperatorFilterRegistry` / `DefaultOperatorFilterer` or a custom transfer
   allowlist. If present, our marketplace contract **cannot move tokens until it
   is allowlisted or the filter is disabled** — and if the collection has no
   owner function to do that, the whole approval-based design is dead and we need
   a different route. This is the single highest-risk unknown.
3. **ERC-2981.** Does `royaltyInfo()` exist, and what does it return? If yes, we
   read the receiver/bps from the token and treat 2.5% as the expected value
   (with a sanity cap); if no, the artist address and 250 bps live in our
   contract.
4. **Pausable / blocklist / soulbound quirks** in the token that can make
   transfers revert mid-settlement.
5. **Holder wallet mix.** Pull current holders and check how many are contracts
   (Safe, Argent, smart accounts). If it's non-trivial, EIP-1271 signature
   support is a v1 requirement, not a nice-to-have.
6. **Artist payout address.** Is it an EOA, a Safe, or a splitter contract? A
   contract receiver means the ETH push path must tolerate higher gas and cannot
   assume 2300 gas.

Deliverable: a one-page `PREFLIGHT.md` with the answers and the token address,
attached to the audit scope. The auditor will ask for exactly this.

---

## 2. Architecture decision

**Recommended: off-chain signed orders (EIP-712), on-chain settlement, single
immutable contract.**

- Seller signs a `Listing` (no gas, no escrow — the token stays in their wallet,
  they have only granted an ERC-721 approval to the marketplace).
- Buyer signs an `Offer`, backed by a **WETH allowance** to the marketplace (no
  ETH escrow, so an offer costs nothing to make and the buyer keeps their funds
  liquid). Owner accepts on-chain later.
- Our backend stores and serves the signed orders; it is a convenience index,
  not a custodian. Anyone holding a signature can settle directly against the
  contract.
- Cancellation is on-chain: `cancel(orderHash)` for one order, `incrementNonce()`
  to nuke all of a user's outstanding orders at once. Cheap, and a cancelled
  order can never be resurrected.

Why this over storing listings on-chain: listing and re-pricing are free, which
matters for a 5,000-piece collection where people re-price constantly, and the
offer flow needs signatures anyway — one order type instead of two halves the
settlement surface. The cost is that we must run a database and an indexer, and
that the "listing exists" state is only as available as our API.

Rejected alternatives, recorded so the auditor knows we considered them:

- **On-chain listing storage.** Simpler mental model and censorship-resistant,
  but two settlement paths (stored listing + signed offer), gas on every
  list/cancel/re-price. Viable fallback if pre-flight turns up something that
  makes signatures awkward.
- **ETH-escrowed offers.** Guarantees an offer is funded, but locks buyer
  capital, adds a withdrawal/refund surface and a reentrancy-prone pull path.
- **Fork Seaport / route through an existing protocol.** Cheapest security
  story by far, and worth revisiting if the audit quote comes back above
  ~$40k — but it gives up control of the UX and the fee path, which is the
  stated point of the project.

### Contract surface (target: one file, ~300 lines of logic)

```
CollectionMarket.sol            // immutable, non-upgradeable, Ownable2Step + Pausable
  immutable NFT      = <collection address>   // hardcoded: no arbitrary-token risk
  immutable WETH     = 0xC02a...6Cc2
  constant  ROYALTY_BPS = 250                 // 2.5%, not settable
  address   artist                            // 2-step transfer, owner-gated

  struct Order { enum side; address maker; uint256 tokenId; uint256 price;
                 uint64 expiry; uint256 nonce; uint256 salt; }

  fulfillListing(Order, sig) payable          // buyer pays ETH
  acceptOffer(Order, sig)                     // owner accepts, paid in WETH
  cancel(Order[] )                            // maker only
  incrementNonce()                            // bulk cancel
  hashOrder(Order) view                       // for the frontend + tooling
  setArtist / pause / unpause                 // owner (Safe) only
```

Deliberately **out** of v1: collection-wide offers, auctions, bundles, ERC-20
payment other than WETH, a platform fee, any upgrade proxy, any other
collection. Each of those is a real increase in audit cost.

Stack: Solidity 0.8.28, Foundry, OpenZeppelin 5.x (`EIP712`, `SignatureChecker`,
`ReentrancyGuard`, `Ownable2Step`, `Pausable`, `SafeERC20`). Frontend Next.js +
wagmi/viem. Order API: small TypeScript service + Postgres. Indexer: Ponder or a
viem log watcher with reorg handling.

---

## 3. Four-week build plan

### Week 1 — Decide and freeze
- Pre-flight chain due diligence (§1); write `PREFLIGHT.md`.
- Write the spec: EIP-712 type definitions, state machine for an order
  (signed → fillable → filled | cancelled | expired | unfillable), payment math
  with rounding rules, admin powers and who holds the keys.
- Write the threat model and the **known-issues / accepted-risks** list (§4.3) —
  this is what makes an audit quote precise instead of padded.
- Send the audit scope (§4) to 2–3 firms. Ask for a slot starting end of Week 3.
- Skeleton contract + EIP-712 hashing + happy-path tests, so the scope document
  can cite a real commit and a real LOC count.

### Week 2 — Contracts
- Full implementation of both settlement paths, cancellation, nonces, pause.
- Unit tests: every revert path, buyer == seller, price 0, expiry boundary,
  wrong signer, replayed signature, approval revoked, token moved after signing.
- Fuzz + invariant tests:
  - proceeds + royalty == price, exactly, for all prices ≥ 1 wei;
  - contract ETH/WETH balance is 0 after every successful settlement;
  - a cancelled or filled order hash can never settle again;
  - no order can settle for a maker who is not the current owner.
- Fork tests against mainnet state at a pinned block: real token, real holders
  (including a Safe holder and a contract-receiver buyer), real WETH.
- Gas snapshot; Slither + `forge coverage` (target >95% line, 100% on branches).
- Deploy to Sepolia with a mock collection; publish addresses.

### Week 3 — Product surface, then freeze
- Frontend: grid + item page, "list" (sign), "buy" (one tx), "make offer"
  (approve WETH once, then sign), "accept offer", "cancel". Clear, human-readable
  signing prompts — the signature payload must be legible in the wallet, since
  "sign this blob" is how NFT holders get drained.
- Order API: store, validate (signature, expiry, current owner, live approval),
  serve; re-validate on read so dead orders disappear from the UI instead of
  failing in the wallet.
- Indexer: watch `Filled` / `Cancelled` / ERC-721 `Transfer`; mark orders dead
  on transfer; handle reorgs by re-scanning N blocks.
- Internal testnet bug bash with 5–10 holders from Discord.
- **End of Week 3: tag `v1.0.0-audit`, hand the commit hash to the auditor.**
  Contracts are frozen from here; only test/frontend changes continue.

### Week 4 — Harden while the audit runs
- Ops: pause runbook, Safe signers and threshold, monitoring/alerts on
  `Filled` volume, failed-tx rate, and any call to `setArtist`/`pause`.
- Deploy script + verification, mainnet dry run on a fork.
- Docs for holders: what an approval is, how to revoke it, why nothing is
  escrowed.
- Triage findings as they arrive; fix, add a regression test per finding.
- Mainnet deploy behind a soft launch (announce to Discord only) once the audit
  report is clean and remediations are re-reviewed.

Team assumption: one Solidity engineer, one full-stack engineer, part-time
design/PM. With a single generalist engineer, drop offers from v1.

---

## 4. Audit scope (send this to the auditor)

### 4.1 Engagement summary

| Field | Value |
|---|---|
| System | Non-custodial fixed-price + offer marketplace for one ERC-721 collection |
| Chains | Ethereum mainnet only |
| In-scope code | `src/CollectionMarket.sol` (single contract, ~300 SLoC), `src/libraries/OrderHash.sol` (~40 SLoC), deploy script |
| Total SLoC | ~350 first-party, excluding tests and OpenZeppelin |
| Language / toolchain | Solidity 0.8.28, Foundry, OpenZeppelin Contracts 5.x (unmodified, assumed correct) |
| Upgradeability | None. Immutable deployment, no proxy, no delegatecall |
| External integrations | The collection at `<TOKEN_ADDRESS>` (deployed 2024, immutable, not in scope but its behavior is a required assumption), canonical WETH |
| Privileged roles | `owner` = 3-of-5 Safe: can pause/unpause and set the artist payout address. Cannot touch orders, funds, or the royalty rate |
| Freeze commit | `<hash>` at tag `v1.0.0-audit`, available end of Week 3 |
| Requested window | 5–10 working days + one remediation re-review |
| Deliverables wanted | Findings report with severity and PoC per issue, remediation review of fixes, sign-off on the final deployed bytecode |

### 4.2 What we want reviewed, by area

**A. Signature and order authenticity**
- EIP-712 domain separator correctness: name, version, `chainId`, `verifyingContract`; no cross-chain or cross-deployment replay.
- Struct hash and type-string correctness; no field omitted from the hash (especially `side`, `expiry`, `nonce`, `salt`) — an unhashed field is a free re-trade at the wrong terms.
- ECDSA malleability, `s`-value and `v` handling, zero-address recovery.
- EIP-1271 path for Safe/smart-account makers: correct use of `SignatureChecker`, and the consequences of a maker whose `isValidSignature` result can change over time.
- Listing/offer type confusion: a signed listing must never be fillable as an offer or vice versa.

**B. Order lifecycle and cancellation**
- `cancel` and `incrementNonce` authorization (maker only) and completeness.
- No path where a filled hash settles twice.
- Expiry inclusivity and reliance on `block.timestamp`.
- **Stale-order resurrection:** maker signs a listing, sells or transfers the token elsewhere, later reacquires it. Does the old signature become fillable again at the old (possibly now-cheap) price? We believe mandatory expiries plus a current-owner check reduce but do not eliminate this, since we cannot hook the immutable token's transfers. **We want the auditor's explicit opinion on our chosen mitigation.**
- Approval scope: `setApprovalForAll` to the marketplace, combined with orders signed long ago, is the main way a holder can lose value. Review the blast radius and whether per-token approval is materially safer given our UX.

**C. Settlement authorization**
- At fill time: is the maker still the owner? Is the marketplace still approved? Is the caller allowed to be the taker?
- Buyer == seller / maker == taker cases.
- `transferFrom` vs `safeTransferFrom` choice, and reentrancy via `onERC721Received` in a contract buyer.
- Behavior if the token contract reverts, is paused, or filters our operator address mid-settlement.

**D. Payment math and the 2.5% royalty**
- `royalty = price * 250 / 10_000`, `proceeds = price - royalty`; confirm the two always sum to `price` for every price including 1 wei and `type(uint256).max`-adjacent values, and that rounding favors the seller rather than leaving dust in the contract.
- Dust prices where the royalty rounds to 0 — is that acceptable or should there be a minimum price?
- ETH path: exact `msg.value == price` check vs refunding excess; where excess refunds could be griefed.
- WETH path: `SafeERC20` usage, allowance-vs-balance failure modes, whether the seller is paid in WETH or unwrapped ETH (we propose keeping WETH to avoid a push-ETH path).
- Push-payment risk on the ETH path: reverting or gas-hungry receivers (artist Safe, seller contract) causing DoS; whether a pull/credit fallback is warranted.
- Reentrancy across both paths; guard placement; checks-effects-interactions ordering.
- Confirm no path leaves ETH or WETH in the contract, and that there is no ability for the owner to take user funds.

**E. Admin surface**
- `Ownable2Step` correctness; `setArtist` cannot be used to steal in-flight proceeds or front-run a settlement to redirect the artist's cut.
- `Pausable`: which functions it covers (settlement yes; `cancel` must stay open so a pause cannot trap users) and whether pausing can grief anyone.
- Confirm the royalty rate is genuinely immutable at 250 bps.

**F. Economic / MEV review (lighter touch, but we want it noted)**
- Cancel-vs-fill races and whether a seller can be forced to sell after intending to cancel.
- Front-running an `acceptOffer` by cancelling or moving the token.
- Whether anything here creates a sandwich or griefing opportunity worth exploiting.

### 4.3 Known issues / accepted risks (please confirm severity, don't re-report as new)

1. Royalties only apply to sales settled by this contract; no enforcement on other venues or direct transfers.
2. Orders are only as discoverable as our API. API downtime means no visible listings, though existing signatures remain settleable directly.
3. A seller's `cancel` transaction can be front-run by a fill of the same order. Accepted.
4. `block.timestamp` granularity on expiries. Accepted.
5. The owner Safe can pause settlement indefinitely (liveness risk); it cannot move funds or NFTs.
6. Holders who grant `setApprovalForAll` and later interact with a phishing site are exposed by that approval; mitigated by docs and a revoke button, not by the contract.

### 4.4 Explicitly out of scope
The 2024 collection contract itself (immutable, not ours to change — but flag
anything in it that breaks our assumptions), canonical WETH, OpenZeppelin
libraries, the Next.js frontend, the order-book API and database, the indexer,
and infrastructure/key custody. We are separately interested in a short
frontend/API review (signature-prompt legibility, order validation, price
display integrity) — please quote it as an optional add-on line item.

### 4.5 What we will hand over at freeze
Frozen commit hash and tag; `PREFLIGHT.md` with the on-chain facts about the
collection; this scope document; the spec with EIP-712 type definitions and the
order state machine; the test suite with coverage report and invariant list;
Slither output with triaged findings; deploy script and constructor arguments;
a named engineer available on Slack/Telegram for the duration.

---

## 5. Definition of done for the MVP

- A holder can list #3312 at 0.4 ETH from our site, paying gas only for a
  one-time approval.
- A browser can buy it in a single transaction; the seller receives 0.39 ETH and
  the artist 0.01 ETH in the same transaction.
- The seller can cancel, and the listing disappears from the site within one
  block.
- A buyer can offer 0.35 ETH in WETH, the owner can accept days later, and the
  artist still gets 2.5%.
- No NFT and no ETH is ever held by the contract between transactions.
- Audit report is clean or all High/Medium findings are fixed and re-reviewed.
