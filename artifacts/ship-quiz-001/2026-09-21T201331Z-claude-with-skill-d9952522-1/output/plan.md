# Collection Marketplace — 4-Week MVP Plan & Audit Scope

Single-collection, non-custodial marketplace for our 5,000-piece ERC-721 on
Ethereum mainnet. Holders list at a price, browsers buy, buyers make offers that
owners accept later, the artist takes 2.5% of every fill. Nothing is escrowed:
the owner keeps the token until a sale settles.

---

## 0. One decision to make before the audit clock starts

Seaport 1.6 already does everything in this brief — non-custodial listings,
collection/token offers funded in WETH, on-fill fee splits, off-chain order
signing (free listing and cancelling), and it is the most-audited exchange
contract in the ecosystem. Building our own means paying for an audit of code
that already exists in audited form.

| | Track A — Seaport orders | Track B — our own `CollectionMarket` |
| --- | --- | --- |
| Custom contracts | 0 | 1 |
| Audit cost | $0 (frontend/indexer review only) | $15k–$35k, 1–2 week engagement |
| Listing/cancel gas for holders | 0 (signatures, off-chain cancel via counter bump) | ~50k gas to list, ~30k to cancel |
| Royalty enforcement | Fee item baked into the order the site builds; a seller who hand-builds an order can omit it | Enforced in the contract; unavoidable on our contract |
| Liquidity | Orders are visible to OpenSea/Blur/Reservoir | Isolated to our site |
| Time to ship | ~2 weeks | 4 weeks |
| Ongoing risk | Someone else's audited bytecode | Ours |

**Recommendation: Track A.** It is cheaper, faster, and gives holders free
listings. The one thing it does not give is *unavoidable* royalties — but the
same is true of Track B the moment someone sells on any other venue, which they
already can. 2.5% on our own site is what we get either way.

The rest of this document specs **Track B in full**, because the ask was a
four-week plan and an audit scope, and Track B is what needs auditing. If we pick
Track A, Week 1's on-chain recon and Week 3's indexer/frontend work carry over
unchanged, the contract weeks disappear, and the audit scope shrinks to §8.

---

## 1. On-chain / off-chain boundary

On-chain (only what needs trustlessness or value movement):

- Listing terms: seller, price, expiry — because a buyer must be able to fill
  them without trusting our server.
- Offer terms: buyer, amount (WETH), expiry — same reason, in reverse.
- Settlement: token transfer, seller payment, 2.5% artist payment, atomically.
- Cancellation, including a per-user "cancel everything" nonce.

Off-chain (Postgres + an indexer reading our events and the collection's
`Transfer` events):

- The browse grid, images, traits, filters, sort-by-price, "recently listed".
- Floor price, volume, per-holder activity, any leaderboard. These are **derived
  data** — computed from events, never stored in contract storage. No ranking,
  no paginated enumeration, no counters on-chain beyond what settlement needs.
- Listing/offer *display* state. The contract is the source of truth; the index
  is a cache that can be rebuilt from logs at any time.

We store no NFT metadata on-chain — it already exists on the 2024 contract.

## 2. Contracts

**One custom contract. No factory, no escrow, no router, no fee-splitter, no
proxy.**

`CollectionMarket.sol` — immutable, non-upgradeable, hardcoded to our collection.

Constructor immutables:

| Immutable | Value |
| --- | --- |
| `NFT` | our 2024 ERC-721 address |
| `WETH` | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` (mainnet WETH, verified from the canonical deployment) |
| `ARTIST` | artist payout address (a Safe, not an EOA) |
| `ROYALTY_BPS` | `250` |

Royalty is a constructor immutable rather than an ERC-2981 lookup. Reason: the
2024 contract's ERC-2981 support (and whether its receiver is owner-settable) is
a Week-1 recon item; reading a mutable external receiver would let whoever
controls the collection redirect every sale's fee. If recon shows ERC-2981 with
a hard-coded receiver, we can switch to reading it — decided by end of Week 1,
frozen before audit either way.

Storage:

```solidity
struct Listing { address seller; uint96 price;  uint64 expiry; }   // 1 slot + 1
struct Offer   { uint96  amount; uint64 expiry; }                  // 1 slot

mapping(uint256 tokenId => Listing) listings;
mapping(uint256 tokenId => mapping(address buyer => Offer)) offers;
mapping(address user => uint64 nonce) cancelNonce;   // bump = kill all my orders
mapping(address payee => uint256) pendingETH;        // pull fallback
```

External surface — 8 functions:

`list`, `cancelListing`, `buy` (payable), `makeOffer`, `cancelOffer`,
`acceptOffer`, `bumpNonce`, `withdrawETH`. Plus `pause`/`unpause` (see §6).

Design rules, fixed before implementation:

- **Approval-based, no escrow.** Seller keeps the token and grants
  `approve`/`setApprovalForAll` to the market. Revoking approval is a valid,
  gas-cheap cancel; `buy` re-checks `ownerOf` and approval at fill time and
  reverts if either changed.
- **Offers are WETH, not ETH.** A contract cannot pull ETH from a wallet later,
  and holding offer ETH in escrow contradicts the non-custodial requirement. The
  frontend wraps ETH → WETH and approves in one flow so it feels like ETH.
- **Mandatory expiry**, capped at 90 days, on every listing and offer. This is
  the mitigation for stale-order revival (see §7).
- **Exact payment.** `buy` requires `msg.value == price`; no partial fills, no
  change-making.
- **CEI + `ReentrancyGuard` everywhere.** `safeTransferFrom` hands control to the
  buyer's `onERC721Received`; listing/offer state is deleted before any transfer
  or payment.
- **Push ETH with a bounded-gas `call`, fall back to `pendingETH`.** A seller or
  artist on a reverting contract must not be able to brick sales.
- Solidity 0.8.26, Foundry, OpenZeppelin `IERC721`/`IERC20`/`ReentrancyGuard`/
  `SafeERC20` unmodified from the pinned release.
- Target: ~300–400 SLoC, single file.

## 3. State transition table

Every state-changing function, its caller, why that caller pays gas, and what
happens if nobody calls. This table goes in the README verbatim.

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `list(tokenId, price, expiry)` | token owner | wants their piece sold at a price | no listing exists; token stays untradeable on our site |
| `cancelListing(tokenId)` | seller | stops an unwanted fill | listing stands until `expiry`; seller can also revoke approval, which neutralises it for free |
| `buy(tokenId)` — payable | any buyer | receives the NFT | listing sits until expiry, then is dead; nothing is stuck (no escrow) |
| `makeOffer(tokenId, amount, expiry)` | buyer (WETH approved) | wants the piece at their price | no offer exists |
| `cancelOffer(tokenId)` | the offerer | stops an unwanted acceptance | offer stands until expiry; revoking WETH approval or spending the WETH makes it unfillable |
| `acceptOffer(tokenId, buyer, amount)` | token owner | receives the WETH | offer expires unaccepted; buyer's WETH never left their wallet |
| `bumpNonce()` | any user | one tx invalidates all of their live listings and offers | their individual orders still stand until expiry |
| `withdrawETH()` | the owed payee | receives their ETH | funds remain claimable forever; no time limit, no sweep |
| `pause()` / `unpause()` | guardian Safe (2-of-3) | incident response | market keeps operating normally |

No function requires us to run a cron, a keeper, or a bot. There is no
owner-only liveness path: every user can always exit without our cooperation,
and even if our servers are gone, cancelling and filling work directly against
the contract.

## 4. Chain

**Ethereum mainnet.** Not a judgement call — the 5,000 tokens live there. A
non-custodial market must settle where the asset is; moving to an L2 would mean
bridging 5,000 pieces, splitting the collection across two chains, and orphaning
the 2024 provenance. Fee sensitivity is acceptable here: these are 0.4 ETH
trades, so a ~$3–8 fill is single-digit basis points of the trade, and listing
costs the seller one small tx. We measure actual mainnet gas during Week 4
rehearsal and publish real numbers rather than estimates; we do not need an L2's
cheap blockspace, account abstraction, or alternative liquidity for this product.

Testnet for rehearsal: Sepolia, with a throwaway ERC-721 mirroring our
collection's interface, plus mainnet-fork tests against the real contract.

## 5. Four-week plan

### Week 1 — Recon, spec freeze, contract v1

On-chain recon against the real 2024 contract (fork tests, not assumptions).
Each of these can change the contract design, so all of it lands before freeze:

1. Does it implement ERC-2981 (`supportsInterface(0x2a55205a)`)? Who is the
   receiver, and is it owner-settable?
2. **Does it enforce an operator filter / blocklist?** Many 2024 collections
   inherit OpenSea's `DefaultOperatorFilterer`, which reverts transfers by
   non-allowlisted operators. If so, our market cannot move tokens at all until
   the collection owner allowlists it — a launch blocker that must surface in
   Week 1, not Week 4.
3. Is the collection pausable, upgradeable, or does it have transfer hooks,
   soulbound logic, or a non-standard `approve`?
4. Does `ownerOf` revert or return zero for burned tokens? Any burned tokens?
5. Confirm the artist payout Safe address, signers, and threshold.

Then: freeze the spec (this document's §2/§3 become the audit's spec document),
write `CollectionMarket.sol` v1, unit tests alongside.

Deliverable: recon memo, frozen spec, contract compiling with ~70% test coverage.

### Week 2 — Test to freeze, hand to auditor

- Unit tests: every function, every revert path, both payout paths (push and
  `pendingETH` fallback).
- Mainnet-fork tests: real collection, real WETH, real holders via
  `vm.prank`; full list→buy and offer→accept flows end to end.
- Adversarial tests: reentrancy via a malicious `onERC721Received`; a seller
  whose payout address reverts; fill after approval revoked; fill after the
  token moved; double-fill; fill an expired order; fee-math rounding on odd wei
  amounts; `bumpNonce` invalidating in-flight orders.
- Invariant/fuzz run: the contract never holds an NFT between transactions; ETH
  balance always equals the sum of `pendingETH`; `seller + artist` always equals
  `price` exactly (no wei created or lost).
- Gas snapshot, NatSpec on every external function, README with §3's table and
  the §9 runbook.

**End of Week 2: tag the commit and start the audit.** The contract is frozen
from here; anything found later is a fix against the audited commit.

### Week 3 — Indexer and frontend, in parallel with the audit

- Indexer: subscribe to `Listed`/`Cancelled`/`Sold`/`OfferMade`/`OfferCancelled`/
  `OfferAccepted` plus the collection's `Transfer`; write to Postgres; full
  replay-from-genesis path so the index can be rebuilt from chain data alone.
- The index must *hide* orders that are no longer fillable — seller no longer
  owns the token, approval revoked, WETH balance or allowance below the offer,
  nonce bumped, expired — so buyers never click a button that reverts.
- Frontend: browse grid with price filter/sort, token page, list flow (approve →
  list), buy flow, offer flow (wrap ETH → approve WETH → offer), "my listings /
  my offers" with cancel, and a visible revoke-approval control.
- Copy that says plainly: your piece stays in your wallet; we never take custody;
  the artist receives 2.5%.

### Week 4 — Remediate, rehearse, deploy

- Days 1–2: triage audit findings, fix, re-test, send diffs back for review sign-off.
- Day 3: deploy to Sepolia against the mock collection; run the full flow from the
  real frontend. Then a mainnet-fork rehearsal of the exact deploy script.
- Day 4: mainnet deploy, Etherscan verify, ownership of `pause` to the guardian
  Safe, and the §9 smoke transaction — a real listing from a team-held token,
  bought by a second team wallet, confirming the artist Safe received 2.5%.
- Day 5: fresh-reviewer pass over the finished slice (someone who did not build
  it clicks through every flow on mainnet with real ETH), then open to holders.
  Announce in Discord with the contract address and the "you keep your NFT" note.

**Timeline risk to accept up front:** a good auditor is usually booked 2–4 weeks
out. Book the slot in Week 1 off this scope document, not in Week 2 when the code
is ready. If the earliest slot is after Week 4, ship the frontend against the
audited contract on Sepolia and hold the mainnet deploy — do not launch on an
unaudited contract holding approvals to 5,000 pieces.

---

## 6. Ownership, keys, and the pause

- The contract is **immutable and non-upgradeable**. No proxy, no admin key over
  funds, no ability to change the royalty, the artist address, or any order.
- The only privileged function is `pause()`, held by a 2-of-3 Safe (two team
  members + the artist). Pause blocks `buy` and `acceptOffer` only. It **cannot**
  block `cancelListing`, `cancelOffer`, `bumpNonce`, or `withdrawETH` — users can
  always exit while paused. That asymmetry is an explicit audit check.
- `ARTIST` is a Safe, not an EOA. Confirmed in Week 1.
- Deployer key is a hardware wallet, used once, retains no powers afterward.
- If the contract is ever compromised or deprecated, the recovery story is:
  pause, then tell holders to revoke approval. No funds are at rest to rescue —
  that is the main safety benefit of the non-custodial design.

## 7. Known issues to hand the auditor up front

Stating these in the scope document saves the auditor discovery time and keeps
them focused on what we have not already thought about.

1. **Stale-order revival.** Alice lists #3312 at 0.4 ETH, sells it elsewhere,
   later buys it back. The old listing is still in storage and becomes fillable
   again at the old price. Our mitigations: mandatory expiry (≤90 days),
   `bumpNonce`, and a frontend that prompts to cancel on any detected transfer
   out. We want the auditor's opinion on whether that is sufficient or whether we
   need an ownership-epoch check. Same class of issue applies to offers when a
   buyer re-acquires WETH after spending it.
2. **Approval blast radius.** `setApprovalForAll` lets the market move *all* of a
   holder's pieces. We accept this (it is standard) but want the code audited on
   the assumption that a bug here drains a holder's whole wallet of this
   collection. The frontend offers per-token `approve` for cautious users.
3. **Royalty is enforced only on our contract.** Not a bug; stated so the auditor
   does not report it.
4. **Rounding.** 2.5% of a price that is not divisible by 400 rounds down to the
   artist, remainder to the seller. Confirm no path creates or destroys wei.
5. **Griefing via reverting payout addresses** — the `pendingETH` fallback is the
   intended answer; confirm it cannot be used to strand funds or to make a fill
   fail.
6. **The collection contract is out of our control** and may be pausable or
   upgradeable. We need to know which failure modes of the 2024 contract can
   break or be leveraged against the market.

---

## 8. Audit scope — the package the auditor quotes against

### In scope

| Item | Detail |
| --- | --- |
| Repository | `<org>/collection-market`, commit tag `audit-v1` (frozen end of Week 2) |
| Contract | `src/CollectionMarket.sol` — **one file, ~300–400 SLoC**, Solidity 0.8.26 |
| Dependencies | OpenZeppelin Contracts v5.x — `IERC721`, `IERC20`, `SafeERC20`, `ReentrancyGuard`, pinned commit. **Unmodified; review integration only, not OZ internals.** |
| External integrations | Our ERC-721 at `<address>` (mainnet, unmodifiable by us); canonical WETH |
| Tests | `test/` — unit, fork, invariant. Auditor may rely on them but should not assume coverage |
| Docs | This document's §2, §3, §6, §7, plus README |

### Explicitly out of scope

Frontend, indexer, Postgres, API, deployment infra, the 2024 ERC-721 itself
(we can neither change nor upgrade it — but we do want failure modes of *its*
behaviour that affect the market, per §7.6), OpenZeppelin library internals,
economic/market-design questions, and metadata/IPFS.

### Threat model to review against

| Actor | Must not be able to |
| --- | --- |
| Anyone | Take an NFT without paying the full listed price to the seller and 2.5% to the artist |
| Anyone | Make the contract hold an NFT or ETH across transactions, beyond `pendingETH` owed |
| Buyer | Pay less than `price`, pay in a way that skips the artist, or reenter `buy`/`acceptOffer` via `onERC721Received` to double-fill or re-use funds |
| Seller | Take a buyer's ETH/WETH without delivering the token; front-run a `buy` by raising the price in the same block |
| Seller/buyer | Fill an order that was cancelled, expired, or nonce-invalidated |
| Griefer | Make a legitimate fill revert, or strand another party's payout |
| Guardian Safe (compromised) | Block cancels or withdrawals; touch funds; alter orders or the royalty |
| Collection owner | Redirect the 2.5% royalty, or extract value via a transfer hook |

### Specific questions we want answered

1. Is expiry + `bumpNonce` sufficient against stale-order revival, or do we need
   an ownership-epoch/nonce per token? (§7.1)
2. Is the push-ETH-then-`pendingETH` pattern correct and non-grief-able?
3. Is the pause asymmetry (blocks fills, never blocks exits) actually watertight
   in the code?
4. Is the WETH offer flow safe against allowance/balance races and
   non-standard ERC-20 behaviour, given WETH's specific implementation?
5. Any MEV/ordering issue that harms a buyer who submits `buy` in good faith?
6. Given our collection's specific behaviour (recon memo attached), any
   integration hazard we missed?

### Deliverables requested from the auditor

- Findings report with severity, PoC for High/Critical, and concrete remediation.
- One remediation review round on our fix diffs (Week 4, days 1–2), included.
- Sign-off letter naming the final commit hash, publishable to holders.

### Engagement shape for quoting

- Size: 1 contract, ~350 SLoC, no proxies, no upgradability, no assembly, no
  novel math, 2 external integrations (one ERC-721, one WETH).
- Expected effort: **1–2 auditor-weeks**.
- Window: **starts end of Week 2, report by end of Week 3, fix review Week 4
  days 1–2.** We need the slot booked in Week 1.
- We will supply: frozen spec (§2/§3), recon memo on the 2024 collection, known
  issues (§7), full test suite, gas snapshot, and a 45-minute walkthrough call on
  day one.

---

## 9. Deployment runbook

Lives in the README; reproduced here so the plan is complete.

Required environment:

```bash
export RPC_URL="https://eth-mainnet.<provider>/v2/$KEY"
export ETHERSCAN_API_KEY="..."
export NFT_ADDRESS="0x<our 2024 collection>"
export WETH_ADDRESS="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
export ARTIST_SAFE="0x<artist Safe>"
export GUARDIAN_SAFE="0x<2-of-3 guardian Safe>"
# deployer is a hardware wallet: --ledger --hd-paths "m/44'/60'/0'/0/0"
```

Rehearse on a fork, then Sepolia, then mainnet — same script all three times:

```bash
# 1. fork rehearsal
anvil --fork-url $RPC_URL --port 8545 &
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# 2. sepolia
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC --broadcast --verify

# 3. mainnet
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL --ledger --hd-paths "m/44'/60'/0'/0/0" \
  --broadcast --verify --slow

# 4. verification (if --verify did not resolve)
forge verify-contract $MARKET src/CollectionMarket.sol:CollectionMarket \
  --chain mainnet --watch \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" \
      $NFT_ADDRESS $WETH_ADDRESS $ARTIST_SAFE)
```

Post-deploy, in order:

```bash
# guardian is set in the constructor; confirm it, do not trust the script output
cast call $MARKET "guardian()(address)"        --rpc-url $RPC_URL  # == GUARDIAN_SAFE
cast call $MARKET "ARTIST()(address)"          --rpc-url $RPC_URL  # == ARTIST_SAFE
cast call $MARKET "ROYALTY_BPS()(uint256)"     --rpc-url $RPC_URL  # == 250
```

End-to-end smoke transaction on mainnet before announcing (this is the gate):

```bash
# team wallet A owns token $ID
cast send $NFT_ADDRESS "approve(address,uint256)" $MARKET $ID --rpc-url $RPC_URL --ledger
cast send $MARKET "list(uint256,uint96,uint64)" $ID 10000000000000000 $EXPIRY \
  --rpc-url $RPC_URL --ledger                       # 0.01 ETH, 7-day expiry

# team wallet B buys it
cast send $MARKET "buy(uint256)" $ID --value 0.01ether --rpc-url $RPC_URL --account teamB

# assert: B owns the token, artist Safe balance rose by exactly 0.00025 ETH
cast call $NFT_ADDRESS "ownerOf(uint256)(address)" $ID --rpc-url $RPC_URL
cast balance $ARTIST_SAFE --rpc-url $RPC_URL
```

Then run the same smoke path for `makeOffer` → `acceptOffer` in WETH. Only after
both settle correctly do we point the site at mainnet and post in Discord.

## 10. Ship checklist

- [ ] On-chain/off-chain boundary explicit; all rankings and browse data derived off-chain
- [ ] Exactly one custom contract, immutable, no factory/escrow/router/splitter
- [ ] Every transition has a caller, an incentive, and a safe no-caller outcome (§3)
- [ ] One chain chosen for a product-specific reason (§4)
- [ ] Tests cover all custom logic; external integrations tested on a mainnet fork
- [ ] README contains the transition table and this runbook
- [ ] Contract verified on Etherscan; `pause` owned by the guardian Safe
- [ ] Audit report received, findings remediated, fix review signed off
- [ ] Fresh reviewer clicks the whole flow on mainnet before holders are invited
