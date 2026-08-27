Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb499-d88b-7ec3-afc3-b7ae1a215377
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
I’m using the `ship` skill because this is a dApp architecture decision; I’ll write the requested plan after following its routing guidance.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace
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
/bin/bash -lc "sed -n '241,520p' .agents/skills/ship/SKILL.md && find .agents/skills/ship -maxdepth 2 -name SKILL.md -print | sort" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace
 succeeded in 0ms:
**Fetch:** `wallets/SKILL.md`, `frontend-playbook/SKILL.md`, `gas/SKILL.md`, `qa/SKILL.md`

### Pre-Ship QA

Before going live, run the QA checklist. Fetch `qa/SKILL.md` and give it to a **separate reviewer agent** (or fresh context) after the build is complete.

### Contract Deployment
1. Set gas settings appropriate for the target chain (fetch `gas/SKILL.md`)
2. Deploy and verify contracts on block explorer
3. Transfer ownership to a multisig (Gnosis Safe) — never leave a single EOA as owner in production
4. Post-deploy checks: call every read function, verify state, test one small transaction

### Frontend Deployment
Fetch `frontend-playbook/SKILL.md` for the full pipeline:
- **IPFS** — decentralized, censorship-resistant, permanent
- **Vercel** — fast, easy, but centralized
- **ENS subdomain** — human-readable URL pointing to IPFS

### Post-Launch
- Set up event monitoring with The Graph or Dune (fetch `indexing/SKILL.md`)
- Monitor contract activity on block explorer
- Have an incident response plan (pause mechanism if applicable, communication channel)

---

## Anti-Patterns

**Kitchen sink contract.** One contract doing everything — swap, lend, stake, govern. Split responsibilities. Each contract should do one thing well.

**Factory nobody asked for.** Building a factory contract that deploys new contracts when you only need one instance. Factories are for protocols that serve many users creating their own instances (like Uniswap creating pools). Most dApps don't need them.

**Onchain everything.** Storing user profiles, activity logs, images, or computed analytics in a smart contract. Use onchain for ownership and value transfer, offchain for everything else.

**Admin crutch.** Relying on an admin account to call maintenance functions. What happens when the admin loses their key? Design permissionless alternatives with proper incentives.

**Premature multi-chain.** Deploying to 5 chains on day one. Launch on one chain, prove product-market fit, then expand. Multi-chain adds complexity in bridging, state sync, and liquidity fragmentation.

**Reinventing audited primitives.** Writing your own ERC-20, your own access control, your own math library. Use OpenZeppelin. They're audited, battle-tested, and free. Your custom version has bugs.

**Ignoring the frontend.** A working contract with a broken UI is useless. Most users interact through the frontend, not Etherscan. Budget 40% of your time for frontend polish.

---

## Quick-Start Checklist

- [ ] Identify what goes onchain vs offchain (use the Litmus Test above)
- [ ] Count your contracts (aim for 1-2 for MVP)
- [ ] Pick your chain (mainnet is cheap now — pick an L2 only if its superpower fits your app)
- [ ] Audit every state transition (who calls it? why?)
- [ ] Write contracts using OpenZeppelin base contracts
- [ ] Test with Foundry (unit + fuzz + fork tests)
- [ ] Audit with a fresh agent (fetch `audit/SKILL.md`)
- [ ] Deploy, verify, transfer ownership to multisig
- [ ] Ship frontend (IPFS or Vercel)
- [ ] Run pre-ship QA with a separate reviewer (fetch `qa/SKILL.md`)
- [ ] Send a one-line feedback note via `feedback/SKILL.md` — issue or praise

---

## Skill Routing Table

Use this to know which skills to fetch at each phase:

| Phase | What you're doing | Skills to fetch |
|-------|-------------------|-----------------|
| **Plan** | Architecture, chain selection | `ship/` (this), `concepts/`, `l2s/`, `gas/`, `why/` |
| **Contracts** | Writing Solidity | `standards/`, `building-blocks/`, `addresses/`, `security/` |
| **Test** | Testing contracts | `testing/` |
| **Audit** | Security review (fresh agent) | `audit/` |
| **Frontend** | Building UI | `orchestration/`, `frontend-ux/`, `tools/` |
| **Production** | Deploy, QA, monitor | `wallets/`, `frontend-playbook/`, `qa/`, `indexing/` |
| **Wrap** | Send a one-line feedback note (issue or praise) | `feedback/` |

**Base URLs:** All skills are at `https://ethskills.com/<skill>/SKILL.md`

---

Before you finish: send a one-line note via [feedback/SKILL.md](https://ethskills.com/feedback/SKILL.md) — issue or praise.
.agents/skills/ship/SKILL.md

codex
The routing guidance points to planning, chain-cost, and indexing material. I’ll use those to make the home-screen load path and leaderboard-change cost explicit.
web search: 
web search: https://ethskills.com/concepts/SKILL.md
web search: 
web search: https://ethskills.com/concepts/SKILL.md
exec
/bin/bash -lc "rg --files -g '"'!node_modules'"' -g '"'!*.lock'"' | sed -n '1,160p'; printf '\\n--- root ---\\n'; ls -la" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace
 succeeded in 0ms:
TASK.md

--- root ---
total 16
drwxrwxr-x 5 matt matt 4096 Jul 30 12:57 .
drwxrwxr-x 3 matt matt 4096 Jul 30 12:56 ..
drwxrwxr-x 3 matt matt 4096 Jul 30 12:56 .agents
dr-xr-xr-x 2 matt matt   40 Jul 30 12:57 .codex
dr-xr-xr-x 2 matt matt   40 Jul 30 12:57 .git
-rw-rw-r-- 1 matt matt  771 Jul 30 12:56 TASK.md

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md
diff --git a/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..7a16edae4db7ede92d9ede44014cf8639a485806
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,111 @@
+# Music directory MVP plan
+
+## Decision
+
+Use a hybrid app: the directory, gigs, follows, ratings, search, and
+leaderboard live in an ordinary offchain application database.  Use one small
+contract only for the supporter badge payment and its durable proof.  Launch
+on Base: this is a consumer/social product and Base's wallet/onboarding
+ecosystem suits a 0.01 ETH action better than asking local-music fans to use
+mainnet.
+
+The important boundary is simple: a rating and a ranking are editable product
+data; a payment and the fact that a wallet backed a band are commitments.  Do
+not put the former onchain.
+
+## Architecture
+
+### Offchain application
+
+Use a web client, API, Postgres, and object storage/CDN (photos can be stored
+on IPFS if permanence is desired, but only their URL/CID belongs in the app
+data).  The database owns:
+
+- `bands`: display name, bio, photo reference, social links, verified payment
+  address, moderation status.
+- `fans` and `follows`.
+- `gigs`: band, venue, scheduled time, and status.
+- `gig_ratings`: fan, gig, score 1--5, submitted time, and moderation state.
+- `leaderboard_definitions` (versioned formula/configuration) and a generated
+  `monthly_band_rankings` read model.
+
+Rate-limit and authenticate ratings, enforce one rating per fan per gig, and
+retain raw ratings plus a moderation/audit trail.  A self-reported attendance
+check is useful UX/abuse friction, but is not trustless proof of attendance.
+
+Compute a monthly rating projection in a worker or SQL materialized view.  It
+uses the active, versioned formula and source ratings, then writes rank,
+score, rating count, and formula version.  Cache the resulting response at the
+API/CDN; invalidate/rebuild after a rating, gig/moderation change, or formula
+change.  This also leaves room for a better confidence-weighted score later
+without changing the client or contract.
+
+### Onchain supporter proof (one contract)
+
+Deploy one audited, minimal `SupporterBadge` contract on Base.  It exposes
+`buyBadge(bandId)` payable with an exact `0.01 ether` value.  The contract
+looks up the pre-registered immutable (or explicitly governed) payout address
+for `bandId`, mints a badge/attestation carrying that band ID to `msg.sender`,
+emits `BadgePurchased`, and transfers the full payment to the band in the same
+transaction.  If either mint or payment fails, the transaction reverts, so a
+fan never pays without the proof.
+
+Use a non-transferable ERC-1155-style band badge (one token type per band) if
+"proof *they* backed the band early" must remain tied to the buying wallet.
+The event should include band ID, fan, amount, and token ID.  A background
+indexer consumes these events into the application database for profile pages;
+the app need not query an RPC node on ordinary page loads.  Bands must verify
+and set their payout address before registration; changing it needs a clear
+signed/administrative recovery process.
+
+State-transition audit:
+
+| Transition | Caller / incentive | If absent |
+| --- | --- | --- |
+| Register or change a band payout address | Verified band (or narrowly scoped directory admin) / receive support payments | That band cannot sell badges |
+| Buy a badge | Fan / backing proof and direct support | No payment or badge; no system failure |
+| Index purchase event | Our worker / keeps UI current | Chain proof remains valid; UI badge counts lag |
+
+There is deliberately no contract function for profiles, gigs, ratings,
+follows, or rank calculation.
+
+## What the home screen loads
+
+On open, load static UI assets plus **one cached home API response** for the
+current month.  That response is the ranking projection, not all underlying
+records.  Each displayed band card needs only its ID/slug, name, CDN photo
+URL, computed rank and score, rating count (and any explanatory label), and
+optionally its next gig summary.  Include the leaderboard formula version and
+the period end so the result is explainable and cacheable.
+
+It should *not* load every band profile, gig history, rating, fan follow, full
+image file, or blockchain event.  It also does not require a wallet connection
+or chain RPC call to rank bands.  After a wallet connects, a separate,
+non-blocking personalized request can return which visible bands that wallet
+supports/follows; it reads the event-indexed database and can fall back to a
+direct contract query for a newly confirmed purchase.
+
+## Cost of changing the leaderboard formula
+
+**Onchain cost: zero.**  The formula is offchain; changing it requires no
+contract deployment, migration of badge ownership, or gas from us or fans.
+
+Operationally, a weekly adjustment means versioning the formula/config in the
+API/worker, recomputing `monthly_band_rankings` from retained raw ratings,
+invalidating the home cache, and deploying the backend/config change.  The
+cost is normal engineering/compute (usually a short database job), not ETH.
+Keep the old formula version and score inputs so rankings can be explained or
+rolled back.  If we had calculated rankings onchain, every new formula would
+mean a new deployment or upgrade plus gas and brittle migration--exactly the
+iteration cost this design avoids.
+
+## MVP sequence
+
+1. Build the offchain directory, gig/rating flow, and versioned ranking read
+   model first; measure rating volume and abuse.
+2. Deploy and test the one badge contract (including failed payout and
+   unauthorized payout-address tests), then index its events.
+3. Integrate the purchase flow with a wallet and clear confirmation states;
+   show the indexed badge on band/fan pages.
+4. Before production, independently audit the payment contract and make the
+   payout-address recovery policy public.

diff --git a/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..7a16edae4db7ede92d9ede44014cf8639a485806
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,111 @@
+# Music directory MVP plan
+
+## Decision
+
+Use a hybrid app: the directory, gigs, follows, ratings, search, and
+leaderboard live in an ordinary offchain application database.  Use one small
+contract only for the supporter badge payment and its durable proof.  Launch
+on Base: this is a consumer/social product and Base's wallet/onboarding
+ecosystem suits a 0.01 ETH action better than asking local-music fans to use
+mainnet.
+
+The important boundary is simple: a rating and a ranking are editable product
+data; a payment and the fact that a wallet backed a band are commitments.  Do
+not put the former onchain.
+
+## Architecture
+
+### Offchain application
+
+Use a web client, API, Postgres, and object storage/CDN (photos can be stored
+on IPFS if permanence is desired, but only their URL/CID belongs in the app
+data).  The database owns:
+
+- `bands`: display name, bio, photo reference, social links, verified payment
+  address, moderation status.
+- `fans` and `follows`.
+- `gigs`: band, venue, scheduled time, and status.
+- `gig_ratings`: fan, gig, score 1--5, submitted time, and moderation state.
+- `leaderboard_definitions` (versioned formula/configuration) and a generated
+  `monthly_band_rankings` read model.
+
+Rate-limit and authenticate ratings, enforce one rating per fan per gig, and
+retain raw ratings plus a moderation/audit trail.  A self-reported attendance
+check is useful UX/abuse friction, but is not trustless proof of attendance.
+
+Compute a monthly rating projection in a worker or SQL materialized view.  It
+uses the active, versioned formula and source ratings, then writes rank,
+score, rating count, and formula version.  Cache the resulting response at the
+API/CDN; invalidate/rebuild after a rating, gig/moderation change, or formula
+change.  This also leaves room for a better confidence-weighted score later
+without changing the client or contract.
+
+### Onchain supporter proof (one contract)
+
+Deploy one audited, minimal `SupporterBadge` contract on Base.  It exposes
+`buyBadge(bandId)` payable with an exact `0.01 ether` value.  The contract
+looks up the pre-registered immutable (or explicitly governed) payout address
+for `bandId`, mints a badge/attestation carrying that band ID to `msg.sender`,
+emits `BadgePurchased`, and transfers the full payment to the band in the same
+transaction.  If either mint or payment fails, the transaction reverts, so a
+fan never pays without the proof.
+
+Use a non-transferable ERC-1155-style band badge (one token type per band) if
+"proof *they* backed the band early" must remain tied to the buying wallet.
+The event should include band ID, fan, amount, and token ID.  A background
+indexer consumes these events into the application database for profile pages;
+the app need not query an RPC node on ordinary page loads.  Bands must verify
+and set their payout address before registration; changing it needs a clear
+signed/administrative recovery process.
+
+State-transition audit:
+
+| Transition | Caller / incentive | If absent |
+| --- | --- | --- |
+| Register or change a band payout address | Verified band (or narrowly scoped directory admin) / receive support payments | That band cannot sell badges |
+| Buy a badge | Fan / backing proof and direct support | No payment or badge; no system failure |
+| Index purchase event | Our worker / keeps UI current | Chain proof remains valid; UI badge counts lag |
+
+There is deliberately no contract function for profiles, gigs, ratings,
+follows, or rank calculation.
+
+## What the home screen loads
+
+On open, load static UI assets plus **one cached home API response** for the
+current month.  That response is the ranking projection, not all underlying
+records.  Each displayed band card needs only its ID/slug, name, CDN photo
+URL, computed rank and score, rating count (and any explanatory label), and
+optionally its next gig summary.  Include the leaderboard formula version and
+the period end so the result is explainable and cacheable.
+
+It should *not* load every band profile, gig history, rating, fan follow, full
+image file, or blockchain event.  It also does not require a wallet connection
+or chain RPC call to rank bands.  After a wallet connects, a separate,
+non-blocking personalized request can return which visible bands that wallet
+supports/follows; it reads the event-indexed database and can fall back to a
+direct contract query for a newly confirmed purchase.
+
+## Cost of changing the leaderboard formula
+
+**Onchain cost: zero.**  The formula is offchain; changing it requires no
+contract deployment, migration of badge ownership, or gas from us or fans.
+
+Operationally, a weekly adjustment means versioning the formula/config in the
+API/worker, recomputing `monthly_band_rankings` from retained raw ratings,
+invalidating the home cache, and deploying the backend/config change.  The
+cost is normal engineering/compute (usually a short database job), not ETH.
+Keep the old formula version and score inputs so rankings can be explained or
+rolled back.  If we had calculated rankings onchain, every new formula would
+mean a new deployment or upgrade plus gas and brittle migration--exactly the
+iteration cost this design avoids.
+
+## MVP sequence
+
+1. Build the offchain directory, gig/rating flow, and versioned ranking read
+   model first; measure rating volume and abuse.
+2. Deploy and test the one badge contract (including failed payout and
+   unauthorized payout-address tests), then index its events.
+3. Integrate the purchase flow with a wallet and clear confirmation states;
+   show the indexed badge on band/fan pages.
+4. Before production, independently audit the payment contract and make the
+   payout-address recovery policy public.

exec
/bin/bash -lc "sed -n '1,260p' plan.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace
 succeeded in 0ms:
# Music directory MVP plan

## Decision

Use a hybrid app: the directory, gigs, follows, ratings, search, and
leaderboard live in an ordinary offchain application database.  Use one small
contract only for the supporter badge payment and its durable proof.  Launch
on Base: this is a consumer/social product and Base's wallet/onboarding
ecosystem suits a 0.01 ETH action better than asking local-music fans to use
mainnet.

The important boundary is simple: a rating and a ranking are editable product
data; a payment and the fact that a wallet backed a band are commitments.  Do
not put the former onchain.

## Architecture

### Offchain application

Use a web client, API, Postgres, and object storage/CDN (photos can be stored
on IPFS if permanence is desired, but only their URL/CID belongs in the app
data).  The database owns:

- `bands`: display name, bio, photo reference, social links, verified payment
  address, moderation status.
- `fans` and `follows`.
- `gigs`: band, venue, scheduled time, and status.
- `gig_ratings`: fan, gig, score 1--5, submitted time, and moderation state.
- `leaderboard_definitions` (versioned formula/configuration) and a generated
  `monthly_band_rankings` read model.

Rate-limit and authenticate ratings, enforce one rating per fan per gig, and
retain raw ratings plus a moderation/audit trail.  A self-reported attendance
check is useful UX/abuse friction, but is not trustless proof of attendance.

Compute a monthly rating projection in a worker or SQL materialized view.  It
uses the active, versioned formula and source ratings, then writes rank,
score, rating count, and formula version.  Cache the resulting response at the
API/CDN; invalidate/rebuild after a rating, gig/moderation change, or formula
change.  This also leaves room for a better confidence-weighted score later
without changing the client or contract.

### Onchain supporter proof (one contract)

Deploy one audited, minimal `SupporterBadge` contract on Base.  It exposes
`buyBadge(bandId)` payable with an exact `0.01 ether` value.  The contract
looks up the pre-registered immutable (or explicitly governed) payout address
for `bandId`, mints a badge/attestation carrying that band ID to `msg.sender`,
emits `BadgePurchased`, and transfers the full payment to the band in the same
transaction.  If either mint or payment fails, the transaction reverts, so a
fan never pays without the proof.

Use a non-transferable ERC-1155-style band badge (one token type per band) if
"proof *they* backed the band early" must remain tied to the buying wallet.
The event should include band ID, fan, amount, and token ID.  A background
indexer consumes these events into the application database for profile pages;
the app need not query an RPC node on ordinary page loads.  Bands must verify
and set their payout address before registration; changing it needs a clear
signed/administrative recovery process.

State-transition audit:

| Transition | Caller / incentive | If absent |
| --- | --- | --- |
| Register or change a band payout address | Verified band (or narrowly scoped directory admin) / receive support payments | That band cannot sell badges |
| Buy a badge | Fan / backing proof and direct support | No payment or badge; no system failure |
| Index purchase event | Our worker / keeps UI current | Chain proof remains valid; UI badge counts lag |

There is deliberately no contract function for profiles, gigs, ratings,
follows, or rank calculation.

## What the home screen loads

On open, load static UI assets plus **one cached home API response** for the
current month.  That response is the ranking projection, not all underlying
records.  Each displayed band card needs only its ID/slug, name, CDN photo
URL, computed rank and score, rating count (and any explanatory label), and
optionally its next gig summary.  Include the leaderboard formula version and
the period end so the result is explainable and cacheable.

It should *not* load every band profile, gig history, rating, fan follow, full
image file, or blockchain event.  It also does not require a wallet connection
or chain RPC call to rank bands.  After a wallet connects, a separate,
non-blocking personalized request can return which visible bands that wallet
supports/follows; it reads the event-indexed database and can fall back to a
direct contract query for a newly confirmed purchase.

## Cost of changing the leaderboard formula

**Onchain cost: zero.**  The formula is offchain; changing it requires no
contract deployment, migration of badge ownership, or gas from us or fans.

Operationally, a weekly adjustment means versioning the formula/config in the
API/worker, recomputing `monthly_band_rankings` from retained raw ratings,
invalidating the home cache, and deploying the backend/config change.  The
cost is normal engineering/compute (usually a short database job), not ETH.
Keep the old formula version and score inputs so rankings can be explained or
rolled back.  If we had calculated rankings onchain, every new formula would
mean a new deployment or upgrade plus gas and brittle migration--exactly the
iteration cost this design avoids.

## MVP sequence

1. Build the offchain directory, gig/rating flow, and versioned ranking read
   model first; measure rating volume and abuse.
2. Deploy and test the one badge contract (including failed payout and
   unauthorized payout-address tests), then index its events.
3. Integrate the purchase flow with a wallet and clear confirmation states;
   show the indexed badge on band/fan pages.
4. Before production, independently audit the payment contract and make the
   payout-address recovery policy public.

diff --git a/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..7a16edae4db7ede92d9ede44014cf8639a485806
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,111 @@
+# Music directory MVP plan
+
+## Decision
+
+Use a hybrid app: the directory, gigs, follows, ratings, search, and
+leaderboard live in an ordinary offchain application database.  Use one small
+contract only for the supporter badge payment and its durable proof.  Launch
+on Base: this is a consumer/social product and Base's wallet/onboarding
+ecosystem suits a 0.01 ETH action better than asking local-music fans to use
+mainnet.
+
+The important boundary is simple: a rating and a ranking are editable product
+data; a payment and the fact that a wallet backed a band are commitments.  Do
+not put the former onchain.
+
+## Architecture
+
+### Offchain application
+
+Use a web client, API, Postgres, and object storage/CDN (photos can be stored
+on IPFS if permanence is desired, but only their URL/CID belongs in the app
+data).  The database owns:
+
+- `bands`: display name, bio, photo reference, social links, verified payment
+  address, moderation status.
+- `fans` and `follows`.
+- `gigs`: band, venue, scheduled time, and status.
+- `gig_ratings`: fan, gig, score 1--5, submitted time, and moderation state.
+- `leaderboard_definitions` (versioned formula/configuration) and a generated
+  `monthly_band_rankings` read model.
+
+Rate-limit and authenticate ratings, enforce one rating per fan per gig, and
+retain raw ratings plus a moderation/audit trail.  A self-reported attendance
+check is useful UX/abuse friction, but is not trustless proof of attendance.
+
+Compute a monthly rating projection in a worker or SQL materialized view.  It
+uses the active, versioned formula and source ratings, then writes rank,
+score, rating count, and formula version.  Cache the resulting response at the
+API/CDN; invalidate/rebuild after a rating, gig/moderation change, or formula
+change.  This also leaves room for a better confidence-weighted score later
+without changing the client or contract.
+
+### Onchain supporter proof (one contract)
+
+Deploy one audited, minimal `SupporterBadge` contract on Base.  It exposes
+`buyBadge(bandId)` payable with an exact `0.01 ether` value.  The contract
+looks up the pre-registered immutable (or explicitly governed) payout address
+for `bandId`, mints a badge/attestation carrying that band ID to `msg.sender`,
+emits `BadgePurchased`, and transfers the full payment to the band in the same
+transaction.  If either mint or payment fails, the transaction reverts, so a
+fan never pays without the proof.
+
+Use a non-transferable ERC-1155-style band badge (one token type per band) if
+"proof *they* backed the band early" must remain tied to the buying wallet.
+The event should include band ID, fan, amount, and token ID.  A background
+indexer consumes these events into the application database for profile pages;
+the app need not query an RPC node on ordinary page loads.  Bands must verify
+and set their payout address before registration; changing it needs a clear
+signed/administrative recovery process.
+
+State-transition audit:
+
+| Transition | Caller / incentive | If absent |
+| --- | --- | --- |
+| Register or change a band payout address | Verified band (or narrowly scoped directory admin) / receive support payments | That band cannot sell badges |
+| Buy a badge | Fan / backing proof and direct support | No payment or badge; no system failure |
+| Index purchase event | Our worker / keeps UI current | Chain proof remains valid; UI badge counts lag |
+
+There is deliberately no contract function for profiles, gigs, ratings,
+follows, or rank calculation.
+
+## What the home screen loads
+
+On open, load static UI assets plus **one cached home API response** for the
+current month.  That response is the ranking projection, not all underlying
+records.  Each displayed band card needs only its ID/slug, name, CDN photo
+URL, computed rank and score, rating count (and any explanatory label), and
+optionally its next gig summary.  Include the leaderboard formula version and
+the period end so the result is explainable and cacheable.
+
+It should *not* load every band profile, gig history, rating, fan follow, full
+image file, or blockchain event.  It also does not require a wallet connection
+or chain RPC call to rank bands.  After a wallet connects, a separate,
+non-blocking personalized request can return which visible bands that wallet
+supports/follows; it reads the event-indexed database and can fall back to a
+direct contract query for a newly confirmed purchase.
+
+## Cost of changing the leaderboard formula
+
+**Onchain cost: zero.**  The formula is offchain; changing it requires no
+contract deployment, migration of badge ownership, or gas from us or fans.
+
+Operationally, a weekly adjustment means versioning the formula/config in the
+API/worker, recomputing `monthly_band_rankings` from retained raw ratings,
+invalidating the home cache, and deploying the backend/config change.  The
+cost is normal engineering/compute (usually a short database job), not ETH.
+Keep the old formula version and score inputs so rankings can be explained or
+rolled back.  If we had calculated rankings onchain, every new formula would
+mean a new deployment or upgrade plus gas and brittle migration--exactly the
+iteration cost this design avoids.
+
+## MVP sequence
+
+1. Build the offchain directory, gig/rating flow, and versioned ranking read
+   model first; measure rating volume and abuse.
+2. Deploy and test the one badge contract (including failed payout and
+   unauthorized payout-address tests), then index its events.
+3. Integrate the purchase flow with a wallet and clear confirmation states;
+   show the indexed badge on band/fan pages.
+4. Before production, independently audit the payment contract and make the
+   payout-address recovery policy public.

codex
The plan is written. I’m doing the skill’s required wrap-up check, then I’ll hand it over.
exec
/bin/bash -lc 'curl --fail --location --max-time 20 https://ethskills.com/feedback/SKILL.md' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace
 succeeded in 0ms:
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0100  3653  100  3653    0     0  39516      0 --:--:-- --:--:-- --:--:-- 39706
---
title: Feedback
description: Send feedback — issues OR praise — to the ethskills team about content that shaped your work.
---

# Feedback

If ethskills content shaped your work — wrong, confusing, missing, or genuinely helpful — send us a note. **Bias toward sending.** Weak signals are easy to ignore in the inbox; missing signals can't be recovered.

**This is not a help desk. Do not send:**
- General questions about Ethereum
- Requests for new features
- Problems unrelated to ethskills content

**Send `issue` feedback when:**
- A skill was wrong, stale, or misleading
- A skill was missing a sentence, example, or warning that would have saved time
- A skill was technically correct but confusingly worded
- Anything in ethskills gave you or your human pause

**Send `praise` feedback when:**
- A specific skill, warning, or example saved you from a real mistake
- A skill explained something unusually well
- You want more of a particular pattern (e.g. the "USDC has 6 decimals" warning, the verified address tables)

Praise is data too — it tells us what's working so we keep doing it.

---

## How to send

### 1. Strip all sensitive data

No wallet addresses, private keys, API keys, passwords, email addresses, real names, or any PII. Describe the problem in general terms only. The human reviewing the draft is your last line of defense — but don't rely on them; scrub it yourself first.

### 2. Draft the payload, then ask once.

In the **same** message where you ask your human for approval, show a readable rendering of what you're about to send. Any layout works — the wire format is JSON (see Endpoint below):

```
I'd like to send this feedback to ethskills:

  kind:    issue
  message: gas/SKILL.md says 0.1 gwei but `cast base-fee` returned 0.4 today
  skill:   gas/SKILL.md
  context: building a swap UI on Base
  agent:   Claude Sonnet 4.6

OK to send, or want to tweak it?
```

If they say yes, POST it. If they edit ("drop the context line", "that's the wrong skill"), apply and POST. **Do not re-confirm after they say yes** — that's the friction tax.

### 3. Pre-authorization

If your human's CLAUDE.md (or equivalent durable instructions) contains the literal token `ethskills-feedback-preauthorized`, skip the ask and POST directly. Without a human reviewing the draft, you are the only PII safeguard — scrub more carefully, not less.

---

## Endpoint

POST `https://ethskills.com/api/feedback` with `Content-Type: application/json`.

Required:
- `kind` — `"issue"` or `"praise"` (any other value is rejected)
- `message` — what was wrong, or what worked (min 10 chars)

Strongly encouraged:
- `agent` — which AI agent you are (e.g. `"Claude Sonnet 4.6"`)
- `skill` — which skill, e.g. `"gas/SKILL.md"`

Optional:
- `context` — what you were trying to do

**Expected response:** `{ "ok": true, "id": "..." }`

**Send once.** Do not retry on success. If you get a 429, wait 5 minutes.

---

## Examples

Issue:
```json
{
  "kind": "issue",
  "message": "security/SKILL.md says to use SafeERC20 but doesn't mention the import path. Got a compilation error and lost 20 minutes.",
  "skill": "security/SKILL.md",
  "context": "Building an ERC-20 vault on Base",
  "agent": "Claude Sonnet 4.6"
}
```

Praise:
```json
{
  "kind": "praise",
  "message": "The USDC has 6 decimals warning is the first thing I now check on every token contract. Saved us from shipping a bug.",
  "skill": "security/SKILL.md",
  "agent": "Claude Opus 4.7"
}
```

---

Every piece of feedback is read by a human. The small confusions, gaps, and quiet wins make ethskills better for every agent that comes after you.

diff --git a/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..7a16edae4db7ede92d9ede44014cf8639a485806
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,111 @@
+# Music directory MVP plan
+
+## Decision
+
+Use a hybrid app: the directory, gigs, follows, ratings, search, and
+leaderboard live in an ordinary offchain application database.  Use one small
+contract only for the supporter badge payment and its durable proof.  Launch
+on Base: this is a consumer/social product and Base's wallet/onboarding
+ecosystem suits a 0.01 ETH action better than asking local-music fans to use
+mainnet.
+
+The important boundary is simple: a rating and a ranking are editable product
+data; a payment and the fact that a wallet backed a band are commitments.  Do
+not put the former onchain.
+
+## Architecture
+
+### Offchain application
+
+Use a web client, API, Postgres, and object storage/CDN (photos can be stored
+on IPFS if permanence is desired, but only their URL/CID belongs in the app
+data).  The database owns:
+
+- `bands`: display name, bio, photo reference, social links, verified payment
+  address, moderation status.
+- `fans` and `follows`.
+- `gigs`: band, venue, scheduled time, and status.
+- `gig_ratings`: fan, gig, score 1--5, submitted time, and moderation state.
+- `leaderboard_definitions` (versioned formula/configuration) and a generated
+  `monthly_band_rankings` read model.
+
+Rate-limit and authenticate ratings, enforce one rating per fan per gig, and
+retain raw ratings plus a moderation/audit trail.  A self-reported attendance
+check is useful UX/abuse friction, but is not trustless proof of attendance.
+
+Compute a monthly rating projection in a worker or SQL materialized view.  It
+uses the active, versioned formula and source ratings, then writes rank,
+score, rating count, and formula version.  Cache the resulting response at the
+API/CDN; invalidate/rebuild after a rating, gig/moderation change, or formula
+change.  This also leaves room for a better confidence-weighted score later
+without changing the client or contract.
+
+### Onchain supporter proof (one contract)
+
+Deploy one audited, minimal `SupporterBadge` contract on Base.  It exposes
+`buyBadge(bandId)` payable with an exact `0.01 ether` value.  The contract
+looks up the pre-registered immutable (or explicitly governed) payout address
+for `bandId`, mints a badge/attestation carrying that band ID to `msg.sender`,
+emits `BadgePurchased`, and transfers the full payment to the band in the same
+transaction.  If either mint or payment fails, the transaction reverts, so a
+fan never pays without the proof.
+
+Use a non-transferable ERC-1155-style band badge (one token type per band) if
+"proof *they* backed the band early" must remain tied to the buying wallet.
+The event should include band ID, fan, amount, and token ID.  A background
+indexer consumes these events into the application database for profile pages;
+the app need not query an RPC node on ordinary page loads.  Bands must verify
+and set their payout address before registration; changing it needs a clear
+signed/administrative recovery process.
+
+State-transition audit:
+
+| Transition | Caller / incentive | If absent |
+| --- | --- | --- |
+| Register or change a band payout address | Verified band (or narrowly scoped directory admin) / receive support payments | That band cannot sell badges |
+| Buy a badge | Fan / backing proof and direct support | No payment or badge; no system failure |
+| Index purchase event | Our worker / keeps UI current | Chain proof remains valid; UI badge counts lag |
+
+There is deliberately no contract function for profiles, gigs, ratings,
+follows, or rank calculation.
+
+## What the home screen loads
+
+On open, load static UI assets plus **one cached home API response** for the
+current month.  That response is the ranking projection, not all underlying
+records.  Each displayed band card needs only its ID/slug, name, CDN photo
+URL, computed rank and score, rating count (and any explanatory label), and
+optionally its next gig summary.  Include the leaderboard formula version and
+the period end so the result is explainable and cacheable.
+
+It should *not* load every band profile, gig history, rating, fan follow, full
+image file, or blockchain event.  It also does not require a wallet connection
+or chain RPC call to rank bands.  After a wallet connects, a separate,
+non-blocking personalized request can return which visible bands that wallet
+supports/follows; it reads the event-indexed database and can fall back to a
+direct contract query for a newly confirmed purchase.
+
+## Cost of changing the leaderboard formula
+
+**Onchain cost: zero.**  The formula is offchain; changing it requires no
+contract deployment, migration of badge ownership, or gas from us or fans.
+
+Operationally, a weekly adjustment means versioning the formula/config in the
+API/worker, recomputing `monthly_band_rankings` from retained raw ratings,
+invalidating the home cache, and deploying the backend/config change.  The
+cost is normal engineering/compute (usually a short database job), not ETH.
+Keep the old formula version and score inputs so rankings can be explained or
+rolled back.  If we had calculated rankings onchain, every new formula would
+mean a new deployment or upgrade plus gas and brittle migration--exactly the
+iteration cost this design avoids.
+
+## MVP sequence
+
+1. Build the offchain directory, gig/rating flow, and versioned ranking read
+   model first; measure rating volume and abuse.
+2. Deploy and test the one badge contract (including failed payout and
+   unauthorized payout-address tests), then index its events.
+3. Integrate the purchase flow with a wallet and clear confirmation states;
+   show the indexed badge on band/fan pages.
+4. Before production, independently audit the payment contract and make the
+   payout-address recovery policy public.

codex
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md).

Key answer: home loads one cached offchain ranking projection; formula changes cost zero onchain gas—just recompute/cache offchain.

Ethskills feedback draft: praise — “The onchain litmus test clearly separated durable supporter payments from frequently changing leaderboard logic.” OK to send?
diff --git a/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..7a16edae4db7ede92d9ede44014cf8639a485806
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,111 @@
+# Music directory MVP plan
+
+## Decision
+
+Use a hybrid app: the directory, gigs, follows, ratings, search, and
+leaderboard live in an ordinary offchain application database.  Use one small
+contract only for the supporter badge payment and its durable proof.  Launch
+on Base: this is a consumer/social product and Base's wallet/onboarding
+ecosystem suits a 0.01 ETH action better than asking local-music fans to use
+mainnet.
+
+The important boundary is simple: a rating and a ranking are editable product
+data; a payment and the fact that a wallet backed a band are commitments.  Do
+not put the former onchain.
+
+## Architecture
+
+### Offchain application
+
+Use a web client, API, Postgres, and object storage/CDN (photos can be stored
+on IPFS if permanence is desired, but only their URL/CID belongs in the app
+data).  The database owns:
+
+- `bands`: display name, bio, photo reference, social links, verified payment
+  address, moderation status.
+- `fans` and `follows`.
+- `gigs`: band, venue, scheduled time, and status.
+- `gig_ratings`: fan, gig, score 1--5, submitted time, and moderation state.
+- `leaderboard_definitions` (versioned formula/configuration) and a generated
+  `monthly_band_rankings` read model.
+
+Rate-limit and authenticate ratings, enforce one rating per fan per gig, and
+retain raw ratings plus a moderation/audit trail.  A self-reported attendance
+check is useful UX/abuse friction, but is not trustless proof of attendance.
+
+Compute a monthly rating projection in a worker or SQL materialized view.  It
+uses the active, versioned formula and source ratings, then writes rank,
+score, rating count, and formula version.  Cache the resulting response at the
+API/CDN; invalidate/rebuild after a rating, gig/moderation change, or formula
+change.  This also leaves room for a better confidence-weighted score later
+without changing the client or contract.
+
+### Onchain supporter proof (one contract)
+
+Deploy one audited, minimal `SupporterBadge` contract on Base.  It exposes
+`buyBadge(bandId)` payable with an exact `0.01 ether` value.  The contract
+looks up the pre-registered immutable (or explicitly governed) payout address
+for `bandId`, mints a badge/attestation carrying that band ID to `msg.sender`,
+emits `BadgePurchased`, and transfers the full payment to the band in the same
+transaction.  If either mint or payment fails, the transaction reverts, so a
+fan never pays without the proof.
+
+Use a non-transferable ERC-1155-style band badge (one token type per band) if
+"proof *they* backed the band early" must remain tied to the buying wallet.
+The event should include band ID, fan, amount, and token ID.  A background
+indexer consumes these events into the application database for profile pages;
+the app need not query an RPC node on ordinary page loads.  Bands must verify
+and set their payout address before registration; changing it needs a clear
+signed/administrative recovery process.
+
+State-transition audit:
+
+| Transition | Caller / incentive | If absent |
+| --- | --- | --- |
+| Register or change a band payout address | Verified band (or narrowly scoped directory admin) / receive support payments | That band cannot sell badges |
+| Buy a badge | Fan / backing proof and direct support | No payment or badge; no system failure |
+| Index purchase event | Our worker / keeps UI current | Chain proof remains valid; UI badge counts lag |
+
+There is deliberately no contract function for profiles, gigs, ratings,
+follows, or rank calculation.
+
+## What the home screen loads
+
+On open, load static UI assets plus **one cached home API response** for the
+current month.  That response is the ranking projection, not all underlying
+records.  Each displayed band card needs only its ID/slug, name, CDN photo
+URL, computed rank and score, rating count (and any explanatory label), and
+optionally its next gig summary.  Include the leaderboard formula version and
+the period end so the result is explainable and cacheable.
+
+It should *not* load every band profile, gig history, rating, fan follow, full
+image file, or blockchain event.  It also does not require a wallet connection
+or chain RPC call to rank bands.  After a wallet connects, a separate,
+non-blocking personalized request can return which visible bands that wallet
+supports/follows; it reads the event-indexed database and can fall back to a
+direct contract query for a newly confirmed purchase.
+
+## Cost of changing the leaderboard formula
+
+**Onchain cost: zero.**  The formula is offchain; changing it requires no
+contract deployment, migration of badge ownership, or gas from us or fans.
+
+Operationally, a weekly adjustment means versioning the formula/config in the
+API/worker, recomputing `monthly_band_rankings` from retained raw ratings,
+invalidating the home cache, and deploying the backend/config change.  The
+cost is normal engineering/compute (usually a short database job), not ETH.
+Keep the old formula version and score inputs so rankings can be explained or
+rolled back.  If we had calculated rankings onchain, every new formula would
+mean a new deployment or upgrade plus gas and brittle migration--exactly the
+iteration cost this design avoids.
+
+## MVP sequence
+
+1. Build the offchain directory, gig/rating flow, and versioned ranking read
+   model first; measure rating volume and abuse.
+2. Deploy and test the one badge contract (including failed payout and
+   unauthorized payout-address tests), then index its events.
+3. Integrate the purchase flow with a wallet and clear confirmation states;
+   show the indexed badge on band/fan pages.
+4. Before production, independently audit the payment contract and make the
+   payout-address recovery policy public.

tokens used
34,586
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195648Z-codex-with-skill-1/workspace/plan.md).

Key answer: home loads one cached offchain ranking projection; formula changes cost zero onchain gas—just recompute/cache offchain.

Ethskills feedback draft: praise — “The onchain litmus test clearly separated durable supporter payments from frequently changing leaderboard logic.” OK to send?
