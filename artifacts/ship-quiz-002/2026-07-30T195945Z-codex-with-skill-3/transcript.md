Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb49c-8a14-7fe0-bf13-f813bf8844b7
--------
user
We're building a directory for our city's live music scene. Bands get a
profile — photo, bio, links — and fans follow them. There's a feed of upcoming
gigs, fans rate gigs they went to out of 5, and the home screen ranks the
best-rated bands this month. Fans can also buy a "supporter badge" for a band:
it costs 0.01 ETH, goes straight to the band, and stays as proof they backed
that band early.

Two things will decide how we build this, so I need them answered before we
start: what does the app have to load when a fan opens the home screen, and
what does it cost us to change the leaderboard formula — we'll be tweaking
that most weeks until it feels fair.

Write your answer to plan.md in this directory: the architecture, plus the
answer to both questions.
codex
I’m using the `ship` skill to choose the appropriate architecture and write `plan.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace
 succeeded in 0ms:
---
name: ship
description: End-to-end guide for AI agents — from a dApp idea to deployed production app. Fetch this FIRST, it routes you through all other skills.
---

# Ship a dApp

## What You Probably Got Wrong

**You jump to code without a plan.** Before writing a single line of Solidity, you need to know: what goes onchain, what stays offchain, which chain, how many contracts, and who calls every function. Skip this and you'll rewrite everything.

**You over-engineer.** Most dApps need 0-2 contracts. A token launch is 1 contract. An NFT collection is 1 contract. A marketplace that uses existing DEX liquidity needs 0 contracts. Three contracts is the upper bound for an MVP. If you're writing more, you're building too much.

**You put too much onchain.** Solidity is for ownership, transfers, and commitments. It's not a database. It's not an API. It's not a backend. If it doesn't involve trustless value transfer or a permanent commitment, it doesn't belong in a smart contract.

**You skip chain selection.** Mainnet is cheaper than you think — an ETH transfer costs ~$0.004, a swap ~$0.04. The "Ethereum is expensive" narrative is outdated. But that doesn't mean everything belongs on mainnet. L2s aren't just "cheaper Ethereum" — each one has a unique superpower (Base has Coinbase distribution + smart wallets, Arbitrum has the deepest DeFi liquidity, Optimism has retroPGF + the Superchain). If your app needs high-frequency interactions or fits what makes an L2 special, build there. If you just need cheap and secure, mainnet works. Choose deliberately. Fetch `l2s/SKILL.md` and `gas/SKILL.md` for the full picture. Not sure Ethereum is the right chain at all? Fetch `why/SKILL.md`.

**You forget nothing is automatic.** Smart contracts don't run themselves. Every state transition needs a caller who pays gas and a reason to do it. If you can't answer "who calls this and why?" for every function, your contract has dead code. Fetch `concepts/SKILL.md` for the full mental model.

---

## Phase 0 — Plan the Architecture

Do this BEFORE writing any code. Every hour spent here saves ten hours of rewrites.

### The Onchain Litmus Test

Put it onchain if it involves:
- **Trustless ownership** — who owns this token/NFT/position?
- **Trustless exchange** — swapping, trading, lending, borrowing
- **Composability** — other contracts need to call it
- **Censorship resistance** — must work even if your team disappears
- **Permanent commitments** — votes, attestations, proofs

Keep it offchain if it involves:
- User profiles, preferences, settings
- Search, filtering, sorting
- Images, videos, metadata (store on IPFS, reference onchain)
- Business logic that changes frequently
- Anything that doesn't involve value transfer or trust

**Judgment calls:**
- Reputation scores → offchain compute, onchain commitments (hashes or attestations)
- Activity feeds → offchain indexing of onchain events (fetch `indexing/SKILL.md`)
- Price data → offchain oracles writing onchain (Chainlink)
- Game state → depends on stakes. Poker with real money? Onchain. Leaderboard? Offchain.

### MVP Contract Count

| What you're building | Contracts | Pattern |
|---------------------|-----------|---------|
| Token launch | 1 | ERC-20 with custom logic |
| NFT collection | 1 | ERC-721 with mint/metadata |
| Simple marketplace | 0-1 | Use existing DEX; maybe a listing contract |
| Vault / yield | 1 | ERC-4626 vault |
| Lending protocol | 1-2 | Pool + oracle integration |
| DAO / governance | 1-3 | Governor + token + timelock |
| AI agent service | 0-1 | Maybe an ERC-8004 registration |
| Prediction market | 1-2 | Market + resolution oracle |

**If you need more than 3 contracts for an MVP, you're over-building.** Ship the simplest version that works, then iterate.

### State Transition Audit

For EVERY function in your contract, fill in this worksheet:

```
Function: ____________
Who calls it? ____________
Why would they? ____________
What if nobody calls it? ____________
Does it need gas incentives? ____________
```

If "what if nobody calls it?" breaks your system, you have a design problem. Fix it before writing code. See `concepts/SKILL.md` for incentive design patterns.

### Chain Selection

**Mainnet is back on the table.** Most AIs still think mainnet is expensive — it's not (~$0.004/transfer, ~$0.04/swap at current gas). Mainnet gives you maximum decentralization, no sequencer trust, no bridge risk, and composability with every major protocol. But L2s aren't a fallback — each one has a unique superpower. Pick the chain whose superpower matches your app:

| Chain | Superpower | Build here if… |
|-------|-----------|----------------|
| **Ethereum mainnet** | Maximum decentralization, composability with all major protocols | DeFi, governance, identity, high-value transfers, or you just need "cheap + secure" |
| **Base** | Coinbase distribution, smart wallets, account abstraction | Consumer apps, social, onboarding non-crypto users, high-frequency micro-payments |
| **Arbitrum** | Deepest L2 DeFi liquidity, Stylus (Rust contracts) | DeFi protocols that need to compose with existing Arbitrum liquidity |
| **Optimism** | RetroPGF, Superchain ecosystem | Public goods, OP Stack ecosystem plays |
| **zkSync / Scroll** | ZK proofs, native account abstraction | Privacy features, ZK-native applications |

**Don't pick an L2 because "mainnet is expensive." Pick an L2 because its superpower fits your app.**

Fetch `l2s/SKILL.md` and `gas/SKILL.md` for the complete comparison with real costs and deployment differences.

---

## dApp Archetype Templates

Find your archetype below. Each tells you exactly how many contracts you need, what they do, common mistakes, and which skills to fetch.

### 1. Token Launch (1-2 contracts)

**Architecture:** One ERC-20 contract. Add a vesting contract if you have team/investor allocations.

**Contracts:**
- `MyToken.sol` — ERC-20 with initial supply, maybe mint/burn
- `TokenVesting.sol` (optional) — time-locked releases for team tokens

**Common mistakes:**
- Infinite supply with no burn mechanism (what gives it value?)
- No initial liquidity plan (deploying a token nobody can buy)
- Fee-on-transfer mechanics that break DEX integrations

**Fetch sequence:** `standards/SKILL.md` → `security/SKILL.md` → `testing/SKILL.md` → `gas/SKILL.md`

### 2. NFT Collection (1 contract)

**Architecture:** One ERC-721 contract. Metadata on IPFS. Frontend for minting.

**Contracts:**
- `MyNFT.sol` — ERC-721 with mint, max supply, metadata URI

**Common mistakes:**
- Storing images onchain (use IPFS or Arweave, store the hash onchain)
- No max supply cap (unlimited minting destroys value)
- Complex whitelist logic when a simple Merkle root works

**Fetch sequence:** `standards/SKILL.md` → `security/SKILL.md` → `testing/SKILL.md` → `frontend-ux/SKILL.md`

### 3. Marketplace / Exchange (0-2 contracts)

**Architecture:** If trading existing tokens, you likely need 0 contracts — integrate with Uniswap/Aerodrome. If building custom order matching, 1-2 contracts.

**Contracts:**
- (often none — use existing DEX liquidity via router)
- `OrderBook.sol` (if custom) — listing, matching, settlement
- `Escrow.sol` (if needed) — holds assets during trades

**Common mistakes:**
- Building a DEX from scratch when Uniswap V4 hooks can do it
- Ignoring MEV (fetch `security/SKILL.md` for sandwich attack protection)
- Centralized order matching (defeats the purpose)

**Fetch sequence:** `building-blocks/SKILL.md` → `addresses/SKILL.md` → `security/SKILL.md` → `testing/SKILL.md`

### 4. Lending / Vault / Yield (0-1 contracts)

**Architecture:** If using existing protocol (Aave, Compound), 0 contracts — just integrate. If building a vault, 1 ERC-4626 contract.

**Contracts:**
- `MyVault.sol` — ERC-4626 vault wrapping a yield source

**Common mistakes:**
- Ignoring vault inflation attack (fetch `security/SKILL.md`)
- Not using ERC-4626 standard (breaks composability)
- Hardcoding token decimals (USDC is 6, not 18)

**Fetch sequence:** `building-blocks/SKILL.md` → `standards/SKILL.md` → `security/SKILL.md` → `testing/SKILL.md`

### 5. DAO / Governance (1-3 contracts)

**Architecture:** Governor contract + governance token + timelock. Use OpenZeppelin's Governor — don't build from scratch.

**Contracts:**
- `GovernanceToken.sol` — ERC-20Votes
- `MyGovernor.sol` — OpenZeppelin Governor with voting parameters
- `TimelockController.sol` — delays execution for safety

**Common mistakes:**
- No timelock (governance decisions execute instantly = rug vector)
- Low quorum that allows minority takeover
- Token distribution so concentrated that one whale controls everything

**Fetch sequence:** `standards/SKILL.md` → `building-blocks/SKILL.md` → `security/SKILL.md` → `testing/SKILL.md`

### 6. AI Agent Service (0-1 contracts)

**Architecture:** Agent logic is offchain. Onchain component is optional — ERC-8004 identity registration, or a payment contract for x402.

**Contracts:**
- (often none — agent runs offchain, uses existing payment infra)
- `AgentRegistry.sol` (optional) — ERC-8004 identity + service endpoints

**Common mistakes:**
- Putting agent logic onchain (Solidity is not for AI inference)
- Overcomplicating payments (x402 handles HTTP-native payments)
- Ignoring key management (fetch `wallets/SKILL.md`)

**Fetch sequence:** `standards/SKILL.md` → `wallets/SKILL.md` → `tools/SKILL.md` → `orchestration/SKILL.md`

---

## Phase 1 — Build Contracts

**Fetch:** `standards/SKILL.md`, `building-blocks/SKILL.md`, `addresses/SKILL.md`, `security/SKILL.md`

Key guidance:
- Use OpenZeppelin contracts as your base — don't reinvent ERC-20, ERC-721, or AccessControl
- Use verified addresses from `addresses/SKILL.md` for any protocol integration — never fabricate addresses
- Follow the Checks-Effects-Interactions pattern for every external call
- Emit events for every state change (your frontend and indexer need them)
- Use `SafeERC20` for all token operations
- Run through the security checklist in `security/SKILL.md` before moving to Phase 2

For SE2 projects, follow `orchestration/SKILL.md` Phase 1 for the exact build sequence.

---

## Phase 2 — Test

**Fetch:** `testing/SKILL.md`

Don't skip this. Don't "test later." Test before deploy.

Key guidance:
- Unit test every custom function (not OpenZeppelin internals)
- Fuzz test all math operations — fuzzing finds the bugs you didn't think of
- Fork test any integration with external protocols (Uniswap, Aave, etc.)
- Run `slither .` for static analysis before deploying
- Target edge cases: zero amounts, max uint, empty arrays, self-transfers, unauthorized callers

### Security Review

After testing, run a security audit — especially if your contracts handle real value. Fetch `audit/SKILL.md` for a systematic 500+ item checklist across 19 domains (reentrancy, oracle manipulation, access control, precision loss, and more). Best practice: give `audit/SKILL.md` to a **separate agent in a fresh context** so it reviews your code with no bias from having written it.

---

## Phase 3 — Build Frontend

**Fetch:** `orchestration/SKILL.md`, `frontend-ux/SKILL.md`, `tools/SKILL.md`, `qa/SKILL.md`

Key guidance:
- Use Scaffold-ETH 2 hooks, not raw wagmi — `useScaffoldReadContract`, `useScaffoldWriteContract`
- Implement the three-button flow: Switch Network → Approve → Execute
- Show loading states on every async operation (blockchains take 5-12 seconds)
- Display token amounts in human-readable form with `formatEther`/`formatUnits`
- Never use infinite approvals

---

## Phase 4 — Ship to Production


exec
/bin/bash -lc "rg --files -g '"'!*node_modules*'"' | sed -n '1,160p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace
 succeeded in 0ms:
TASK.md

codex
The monthly ranking is volatile product logic, so I’ll keep it in the database/API—not in a contract. The only onchain piece is payment plus durable backing proof.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md
diff --git a/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..40250d6ab0b10e9d2a4b4c20212fdf75b9d8a24f
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,46 @@
+# Live music directory — architecture
+
+Use a normal web app and database for the directory. Deploy one small contract on **Base** for supporter badges. Base fits a consumer/social app and avoids making a $0.01 support action impractical because of gas.
+
+## Offchain application
+
+- **Frontend:** web/mobile UI; wallet connection only for buying/viewing badges.
+- **API + PostgreSQL:** canonical app data: `bands`, `fan_profiles`, `follows`, `gigs`, `gig_ratings`, and cached `monthly_band_scores`.
+- **Object storage/CDN:** band photos; store the URL and image metadata in Postgres. Bios and ordinary links stay in Postgres.
+- **Indexer/worker:** consumes badge contract events and records badge ownership/transaction links for fast profile display. It also recomputes rankings when a valid rating changes, and on a small scheduled job for month rollover.
+
+Gigs, follows, ratings, search, and ranking must remain offchain: they are high-churn application data and product policy. Ratings should be one per fan per gig; only allow ratings after the gig, with an attendance/ticket check if the product can supply one. This limits a leaderboard that is easy to game.
+
+## Onchain: one `SupporterBadge` contract
+
+One ERC-1155-style, non-transferable receipt contract is enough. Each band has a token id and a registered payout wallet. `buyBadge(bandId)`:
+
+1. requires exactly `0.01 ether`;
+2. forwards that value to the registered band wallet in the same transaction;
+3. mints one non-transferable badge/receipt to the buyer; and
+4. emits `BadgePurchased(bandId, supporter, bandWallet, amount)`.
+
+The mint/event is permanent proof tied to the supporter wallet. Store display metadata offchain/IPFS; do not put photos, bios, gigs, or leaderboard scores onchain. Use pull-payment credit only as a fallback if a band wallet rejects ETH; otherwise the successful purchase forwards ETH directly. Band-wallet registration/changes need a clear authorized signer (initially app-admin approval plus the band wallet’s confirmation).
+
+No contract function requires a cron caller: buyers call `buyBadge` because they want the badge; the indexer reacts to its event. Monthly scoring has no onchain state transition.
+
+## What the home screen loads
+
+The home screen should make **one API request** for its view model, for example `GET /home?city=…`:
+
+- current-month ranked bands: band id, name, photo CDN URL, score, rating count, and rank;
+- nearby/upcoming gigs: gig id, time, venue, linked band summary; and
+- for a signed-in fan, follow state (and optionally badge state) for the displayed bands.
+
+The API reads the materialized/cached `monthly_band_scores` table joined to bands and gigs. Images then load directly from the CDN. It should **not** scan gig ratings in the browser, enumerate contract storage, or make an RPC call per band. If badge ownership is shown, return the indexer cache and verify/refresh against chain only for the current wallet when needed. Paginate the feed and leaderboard; cache anonymous responses briefly and personalize only the small fan-specific overlay.
+
+So, opening home loads a compact database-backed ranking/feed payload plus image assets—not the blockchain or every historical rating. This keeps it fast and makes the page available even if an RPC provider is slow.
+
+## Cost to change the leaderboard formula
+
+**No blockchain deployment or gas cost.** The formula lives in versioned backend SQL/application code, such as a weighted average with a minimum-rating threshold and recency decay. A change is a normal backend deploy/config update, then a recompute of `monthly_band_scores` and cache invalidation.
+
+Operational cost is proportional only to the ratings/gigs in the scoring window. For a city directory this is ordinarily seconds-to-minutes of database work and can be run in a background job; the old score table remains live until the new version is ready. Keep `formula_version`, calculation time, inputs, and resulting score with each snapshot so rankings can be explained and compared after weekly tuning.
+
+Changing it weekly is therefore cheap, reversible, and does not alter badge ownership or payment history. Putting the formula in a contract would instead require a redeploy/upgrade governance decision and make every rating and recomputation gas-bearing—wrong fit for this product.
+

diff --git a/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..40250d6ab0b10e9d2a4b4c20212fdf75b9d8a24f
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,46 @@
+# Live music directory — architecture
+
+Use a normal web app and database for the directory. Deploy one small contract on **Base** for supporter badges. Base fits a consumer/social app and avoids making a $0.01 support action impractical because of gas.
+
+## Offchain application
+
+- **Frontend:** web/mobile UI; wallet connection only for buying/viewing badges.
+- **API + PostgreSQL:** canonical app data: `bands`, `fan_profiles`, `follows`, `gigs`, `gig_ratings`, and cached `monthly_band_scores`.
+- **Object storage/CDN:** band photos; store the URL and image metadata in Postgres. Bios and ordinary links stay in Postgres.
+- **Indexer/worker:** consumes badge contract events and records badge ownership/transaction links for fast profile display. It also recomputes rankings when a valid rating changes, and on a small scheduled job for month rollover.
+
+Gigs, follows, ratings, search, and ranking must remain offchain: they are high-churn application data and product policy. Ratings should be one per fan per gig; only allow ratings after the gig, with an attendance/ticket check if the product can supply one. This limits a leaderboard that is easy to game.
+
+## Onchain: one `SupporterBadge` contract
+
+One ERC-1155-style, non-transferable receipt contract is enough. Each band has a token id and a registered payout wallet. `buyBadge(bandId)`:
+
+1. requires exactly `0.01 ether`;
+2. forwards that value to the registered band wallet in the same transaction;
+3. mints one non-transferable badge/receipt to the buyer; and
+4. emits `BadgePurchased(bandId, supporter, bandWallet, amount)`.
+
+The mint/event is permanent proof tied to the supporter wallet. Store display metadata offchain/IPFS; do not put photos, bios, gigs, or leaderboard scores onchain. Use pull-payment credit only as a fallback if a band wallet rejects ETH; otherwise the successful purchase forwards ETH directly. Band-wallet registration/changes need a clear authorized signer (initially app-admin approval plus the band wallet’s confirmation).
+
+No contract function requires a cron caller: buyers call `buyBadge` because they want the badge; the indexer reacts to its event. Monthly scoring has no onchain state transition.
+
+## What the home screen loads
+
+The home screen should make **one API request** for its view model, for example `GET /home?city=…`:
+
+- current-month ranked bands: band id, name, photo CDN URL, score, rating count, and rank;
+- nearby/upcoming gigs: gig id, time, venue, linked band summary; and
+- for a signed-in fan, follow state (and optionally badge state) for the displayed bands.
+
+The API reads the materialized/cached `monthly_band_scores` table joined to bands and gigs. Images then load directly from the CDN. It should **not** scan gig ratings in the browser, enumerate contract storage, or make an RPC call per band. If badge ownership is shown, return the indexer cache and verify/refresh against chain only for the current wallet when needed. Paginate the feed and leaderboard; cache anonymous responses briefly and personalize only the small fan-specific overlay.
+
+So, opening home loads a compact database-backed ranking/feed payload plus image assets—not the blockchain or every historical rating. This keeps it fast and makes the page available even if an RPC provider is slow.
+
+## Cost to change the leaderboard formula
+
+**No blockchain deployment or gas cost.** The formula lives in versioned backend SQL/application code, such as a weighted average with a minimum-rating threshold and recency decay. A change is a normal backend deploy/config update, then a recompute of `monthly_band_scores` and cache invalidation.
+
+Operational cost is proportional only to the ratings/gigs in the scoring window. For a city directory this is ordinarily seconds-to-minutes of database work and can be run in a background job; the old score table remains live until the new version is ready. Keep `formula_version`, calculation time, inputs, and resulting score with each snapshot so rankings can be explained and compared after weekly tuning.
+
+Changing it weekly is therefore cheap, reversible, and does not alter badge ownership or payment history. Putting the formula in a contract would instead require a redeploy/upgrade governance decision and make every rating and recomputation gas-bearing—wrong fit for this product.
+

exec
/bin/bash -lc "sed -n '1,240p' plan.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace
 succeeded in 0ms:
# Live music directory — architecture

Use a normal web app and database for the directory. Deploy one small contract on **Base** for supporter badges. Base fits a consumer/social app and avoids making a $0.01 support action impractical because of gas.

## Offchain application

- **Frontend:** web/mobile UI; wallet connection only for buying/viewing badges.
- **API + PostgreSQL:** canonical app data: `bands`, `fan_profiles`, `follows`, `gigs`, `gig_ratings`, and cached `monthly_band_scores`.
- **Object storage/CDN:** band photos; store the URL and image metadata in Postgres. Bios and ordinary links stay in Postgres.
- **Indexer/worker:** consumes badge contract events and records badge ownership/transaction links for fast profile display. It also recomputes rankings when a valid rating changes, and on a small scheduled job for month rollover.

Gigs, follows, ratings, search, and ranking must remain offchain: they are high-churn application data and product policy. Ratings should be one per fan per gig; only allow ratings after the gig, with an attendance/ticket check if the product can supply one. This limits a leaderboard that is easy to game.

## Onchain: one `SupporterBadge` contract

One ERC-1155-style, non-transferable receipt contract is enough. Each band has a token id and a registered payout wallet. `buyBadge(bandId)`:

1. requires exactly `0.01 ether`;
2. forwards that value to the registered band wallet in the same transaction;
3. mints one non-transferable badge/receipt to the buyer; and
4. emits `BadgePurchased(bandId, supporter, bandWallet, amount)`.

The mint/event is permanent proof tied to the supporter wallet. Store display metadata offchain/IPFS; do not put photos, bios, gigs, or leaderboard scores onchain. Use pull-payment credit only as a fallback if a band wallet rejects ETH; otherwise the successful purchase forwards ETH directly. Band-wallet registration/changes need a clear authorized signer (initially app-admin approval plus the band wallet’s confirmation).

No contract function requires a cron caller: buyers call `buyBadge` because they want the badge; the indexer reacts to its event. Monthly scoring has no onchain state transition.

## What the home screen loads

The home screen should make **one API request** for its view model, for example `GET /home?city=…`:

- current-month ranked bands: band id, name, photo CDN URL, score, rating count, and rank;
- nearby/upcoming gigs: gig id, time, venue, linked band summary; and
- for a signed-in fan, follow state (and optionally badge state) for the displayed bands.

The API reads the materialized/cached `monthly_band_scores` table joined to bands and gigs. Images then load directly from the CDN. It should **not** scan gig ratings in the browser, enumerate contract storage, or make an RPC call per band. If badge ownership is shown, return the indexer cache and verify/refresh against chain only for the current wallet when needed. Paginate the feed and leaderboard; cache anonymous responses briefly and personalize only the small fan-specific overlay.

So, opening home loads a compact database-backed ranking/feed payload plus image assets—not the blockchain or every historical rating. This keeps it fast and makes the page available even if an RPC provider is slow.

## Cost to change the leaderboard formula

**No blockchain deployment or gas cost.** The formula lives in versioned backend SQL/application code, such as a weighted average with a minimum-rating threshold and recency decay. A change is a normal backend deploy/config update, then a recompute of `monthly_band_scores` and cache invalidation.

Operational cost is proportional only to the ratings/gigs in the scoring window. For a city directory this is ordinarily seconds-to-minutes of database work and can be run in a background job; the old score table remains live until the new version is ready. Keep `formula_version`, calculation time, inputs, and resulting score with each snapshot so rankings can be explained and compared after weekly tuning.

Changing it weekly is therefore cheap, reversible, and does not alter badge ownership or payment history. Putting the formula in a contract would instead require a redeploy/upgrade governance decision and make every rating and recomputation gas-bearing—wrong fit for this product.


diff --git a/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..40250d6ab0b10e9d2a4b4c20212fdf75b9d8a24f
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,46 @@
+# Live music directory — architecture
+
+Use a normal web app and database for the directory. Deploy one small contract on **Base** for supporter badges. Base fits a consumer/social app and avoids making a $0.01 support action impractical because of gas.
+
+## Offchain application
+
+- **Frontend:** web/mobile UI; wallet connection only for buying/viewing badges.
+- **API + PostgreSQL:** canonical app data: `bands`, `fan_profiles`, `follows`, `gigs`, `gig_ratings`, and cached `monthly_band_scores`.
+- **Object storage/CDN:** band photos; store the URL and image metadata in Postgres. Bios and ordinary links stay in Postgres.
+- **Indexer/worker:** consumes badge contract events and records badge ownership/transaction links for fast profile display. It also recomputes rankings when a valid rating changes, and on a small scheduled job for month rollover.
+
+Gigs, follows, ratings, search, and ranking must remain offchain: they are high-churn application data and product policy. Ratings should be one per fan per gig; only allow ratings after the gig, with an attendance/ticket check if the product can supply one. This limits a leaderboard that is easy to game.
+
+## Onchain: one `SupporterBadge` contract
+
+One ERC-1155-style, non-transferable receipt contract is enough. Each band has a token id and a registered payout wallet. `buyBadge(bandId)`:
+
+1. requires exactly `0.01 ether`;
+2. forwards that value to the registered band wallet in the same transaction;
+3. mints one non-transferable badge/receipt to the buyer; and
+4. emits `BadgePurchased(bandId, supporter, bandWallet, amount)`.
+
+The mint/event is permanent proof tied to the supporter wallet. Store display metadata offchain/IPFS; do not put photos, bios, gigs, or leaderboard scores onchain. Use pull-payment credit only as a fallback if a band wallet rejects ETH; otherwise the successful purchase forwards ETH directly. Band-wallet registration/changes need a clear authorized signer (initially app-admin approval plus the band wallet’s confirmation).
+
+No contract function requires a cron caller: buyers call `buyBadge` because they want the badge; the indexer reacts to its event. Monthly scoring has no onchain state transition.
+
+## What the home screen loads
+
+The home screen should make **one API request** for its view model, for example `GET /home?city=…`:
+
+- current-month ranked bands: band id, name, photo CDN URL, score, rating count, and rank;
+- nearby/upcoming gigs: gig id, time, venue, linked band summary; and
+- for a signed-in fan, follow state (and optionally badge state) for the displayed bands.
+
+The API reads the materialized/cached `monthly_band_scores` table joined to bands and gigs. Images then load directly from the CDN. It should **not** scan gig ratings in the browser, enumerate contract storage, or make an RPC call per band. If badge ownership is shown, return the indexer cache and verify/refresh against chain only for the current wallet when needed. Paginate the feed and leaderboard; cache anonymous responses briefly and personalize only the small fan-specific overlay.
+
+So, opening home loads a compact database-backed ranking/feed payload plus image assets—not the blockchain or every historical rating. This keeps it fast and makes the page available even if an RPC provider is slow.
+
+## Cost to change the leaderboard formula
+
+**No blockchain deployment or gas cost.** The formula lives in versioned backend SQL/application code, such as a weighted average with a minimum-rating threshold and recency decay. A change is a normal backend deploy/config update, then a recompute of `monthly_band_scores` and cache invalidation.
+
+Operational cost is proportional only to the ratings/gigs in the scoring window. For a city directory this is ordinarily seconds-to-minutes of database work and can be run in a background job; the old score table remains live until the new version is ready. Keep `formula_version`, calculation time, inputs, and resulting score with each snapshot so rankings can be explained and compared after weekly tuning.
+
+Changing it weekly is therefore cheap, reversible, and does not alter badge ownership or payment history. Putting the formula in a contract would instead require a redeploy/upgrade governance decision and make every rating and recomputation gas-bearing—wrong fit for this product.
+

codex
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md).

Answers: home loads one cached API view-model + CDN images, not chain data; leaderboard changes cost no gas/deploy—just backend recomputation/cache refresh.
diff --git a/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..40250d6ab0b10e9d2a4b4c20212fdf75b9d8a24f
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,46 @@
+# Live music directory — architecture
+
+Use a normal web app and database for the directory. Deploy one small contract on **Base** for supporter badges. Base fits a consumer/social app and avoids making a $0.01 support action impractical because of gas.
+
+## Offchain application
+
+- **Frontend:** web/mobile UI; wallet connection only for buying/viewing badges.
+- **API + PostgreSQL:** canonical app data: `bands`, `fan_profiles`, `follows`, `gigs`, `gig_ratings`, and cached `monthly_band_scores`.
+- **Object storage/CDN:** band photos; store the URL and image metadata in Postgres. Bios and ordinary links stay in Postgres.
+- **Indexer/worker:** consumes badge contract events and records badge ownership/transaction links for fast profile display. It also recomputes rankings when a valid rating changes, and on a small scheduled job for month rollover.
+
+Gigs, follows, ratings, search, and ranking must remain offchain: they are high-churn application data and product policy. Ratings should be one per fan per gig; only allow ratings after the gig, with an attendance/ticket check if the product can supply one. This limits a leaderboard that is easy to game.
+
+## Onchain: one `SupporterBadge` contract
+
+One ERC-1155-style, non-transferable receipt contract is enough. Each band has a token id and a registered payout wallet. `buyBadge(bandId)`:
+
+1. requires exactly `0.01 ether`;
+2. forwards that value to the registered band wallet in the same transaction;
+3. mints one non-transferable badge/receipt to the buyer; and
+4. emits `BadgePurchased(bandId, supporter, bandWallet, amount)`.
+
+The mint/event is permanent proof tied to the supporter wallet. Store display metadata offchain/IPFS; do not put photos, bios, gigs, or leaderboard scores onchain. Use pull-payment credit only as a fallback if a band wallet rejects ETH; otherwise the successful purchase forwards ETH directly. Band-wallet registration/changes need a clear authorized signer (initially app-admin approval plus the band wallet’s confirmation).
+
+No contract function requires a cron caller: buyers call `buyBadge` because they want the badge; the indexer reacts to its event. Monthly scoring has no onchain state transition.
+
+## What the home screen loads
+
+The home screen should make **one API request** for its view model, for example `GET /home?city=…`:
+
+- current-month ranked bands: band id, name, photo CDN URL, score, rating count, and rank;
+- nearby/upcoming gigs: gig id, time, venue, linked band summary; and
+- for a signed-in fan, follow state (and optionally badge state) for the displayed bands.
+
+The API reads the materialized/cached `monthly_band_scores` table joined to bands and gigs. Images then load directly from the CDN. It should **not** scan gig ratings in the browser, enumerate contract storage, or make an RPC call per band. If badge ownership is shown, return the indexer cache and verify/refresh against chain only for the current wallet when needed. Paginate the feed and leaderboard; cache anonymous responses briefly and personalize only the small fan-specific overlay.
+
+So, opening home loads a compact database-backed ranking/feed payload plus image assets—not the blockchain or every historical rating. This keeps it fast and makes the page available even if an RPC provider is slow.
+
+## Cost to change the leaderboard formula
+
+**No blockchain deployment or gas cost.** The formula lives in versioned backend SQL/application code, such as a weighted average with a minimum-rating threshold and recency decay. A change is a normal backend deploy/config update, then a recompute of `monthly_band_scores` and cache invalidation.
+
+Operational cost is proportional only to the ratings/gigs in the scoring window. For a city directory this is ordinarily seconds-to-minutes of database work and can be run in a background job; the old score table remains live until the new version is ready. Keep `formula_version`, calculation time, inputs, and resulting score with each snapshot so rankings can be explained and compared after weekly tuning.
+
+Changing it weekly is therefore cheap, reversible, and does not alter badge ownership or payment history. Putting the formula in a contract would instead require a redeploy/upgrade governance decision and make every rating and recomputation gas-bearing—wrong fit for this product.
+

tokens used
16,423
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195945Z-codex-with-skill-3/workspace/plan.md).

Answers: home loads one cached API view-model + CDN images, not chain data; leaderboard changes cost no gas/deploy—just backend recomputation/cache refresh.
