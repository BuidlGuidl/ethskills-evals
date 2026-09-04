Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb495-717d-7743-83fd-0a7c7fda9733
--------
user
We minted a 5,000-piece NFT collection on Ethereum mainnet in 2024, and
holders keep trading it by hand in our Discord — someone posts "selling #3312
for 0.4 ETH", they DM, they send. We want listing and buying to happen on our
own site instead: a holder lists a piece at a price, anyone browsing can buy
it, and the artist takes 2.5% of every resale. Sellers can cancel a listing,
and nothing sits in escrow while it's listed — owners keep the piece until it
actually sells.

We have one Solidity dev, four weeks, and budget for exactly one audit pass at
the end. I need to know what we're sending to the auditor and whether four
weeks is realistic.

Write your answer to plan.md in this directory, covering the build plan and
what goes into the audit scope.
codex
I’ll use the `ship` skill to structure a lean marketplace plan and audit scope for the four-week constraint.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md && rg --files -g 'AGENTS.md' -g 'package.json' -g 'README*' | sed -n '1,160p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace
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
/bin/bash -lc "sed -n '241,520p' .agents/skills/ship/SKILL.md; rg --files -g 'AGENTS.md' -g 'plan.md' -g 'README*' -g 'package.json' | sed -n '1,160p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace
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

exec
/bin/bash -lc 'ls -la; find . -maxdepth 2 -name AGENTS.md -print' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace
 succeeded in 0ms:
total 16
drwxrwxr-x 5 matt matt 4096 Jul 30 12:52 .
drwxrwxr-x 3 matt matt 4096 Jul 30 12:52 ..
drwxrwxr-x 3 matt matt 4096 Jul 30 12:52 .agents
dr-xr-xr-x 2 matt matt   40 Jul 30 12:52 .codex
dr-xr-xr-x 2 matt matt   40 Jul 30 12:52 .git
-rw-rw-r-- 1 matt matt  764 Jul 30 12:52 TASK.md

codex
The MVP can stay to one new immutable marketplace contract; listings are on-chain records while the NFT remains with its owner. I’m capturing the key limitation too: a 2.5% fee is enforceable only for sales settled through this marketplace, not Discord transfers or other venues.
2026-07-30T19:53:17.287881Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 52, 'or fee setter in v1. This minimizes both trust and audit surface.' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..1d54abbbc0e0622401d4f0461ba99d96056f9545
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,104 @@
+# Mainnet NFT resale marketplace — four-week MVP
+
+## Decision
+
+Build one new, non-upgradeable Ethereum-mainnet marketplace contract for this specific ERC-721 collection, plus a web app and event indexer. Do not modify the 2024 collection unless discovery finds non-standard transfer behavior.
+
+The artist's 2.5% fee (250 basis points) is enforceable only for sales settled through this contract. It cannot be collected from a wallet-to-wallet Discord sale or another marketplace. ERC-2981, if present, is metadata; it does not globally enforce royalties.
+
+Four weeks is realistic for this frozen MVP and one experienced Solidity dev if audit remediation is included in week 4. It is not realistic if scope expands to offers, auctions, ERC-20 payments, bundles, rentals, multiple collections, proxy upgrades, or a bespoke backend/mobile app. If the booked audit cannot confirm fixes during week 4, use a five-week launch plan.
+
+## Architecture
+
+### On-chain: one `CollectionMarketplace` contract
+
+Immutable constructor configuration:
+
+- `collection`: existing ERC-721 address.
+- `royaltyRecipient`: artist wallet, preferably a Safe.
+- `ROYALTY_BPS = 250`; `BPS_DENOMINATOR = 10_000`.
+
+Listing state, keyed by `tokenId`: seller address and ETH price in wei.
+
+| Function | Caller / purpose | Checks and effects |
+| --- | --- | --- |
+| `list(tokenId, price)` | Owner advertises a fixed-price sale | `price > 0`; `ownerOf(tokenId) == msg.sender`; marketplace has token/operator approval; store seller/price; emit `Listed`. |
+| `cancel(tokenId)` | Listed seller withdraws intent | Require recorded seller; delete listing; emit `Cancelled`. No NFT transfer. |
+| `buy(tokenId)` payable | Buyer settles an active listing | Listing exists; buyer differs from seller; exact `msg.value`; listed seller still owns token and approval remains. Delete listing before external calls; calculate royalty and seller proceeds; transfer NFT; credit proceeds; emit `Sale`. |
+| `withdraw()` | Seller or artist collects credited ETH | Non-reentrant pull payment; update credit before transfer; emit `Withdrawal`. |
+
+Use pinned OpenZeppelin `IERC721`, `ReentrancyGuard`, and a safe ETH-transfer utility. Do not hand-roll ERC-721, access control, arithmetic, or payment helpers. V1 has no admin, pause switch, fee setter, arbitrary collection, or upgrade proxy; this minimizes trust and audit surface.
+
+At listing, the NFT stays with its owner. On purchase the marketplace calls `safeTransferFrom(seller, buyer, tokenId)` using the seller's approval. A seller can transfer/burn the token or revoke approval after listing; that listing then cannot execute and must be relisted. The UI must handle this stale-listing revert.
+
+Use pull payments rather than immediate ETH forwarding: a seller or royalty wallet that rejects ETH must not block a valid sale. This temporarily custodians sale proceeds, never NFTs, and makes accounting/withdrawal central audit scope.
+
+### Off-chain: website and indexer
+
+- Ethereum-mainnet-only wallet flow; explicit network switch.
+- Index `Listed`, `Cancelled`, and `Sale` events for the collection grid, filters, and listing history; contract remains source of truth.
+- Before enabling Buy, recheck `ownerOf` and approval; show total price, 2.5% artist fee, seller proceeds, pending/reverted transaction states, and stale-listing explanation.
+- Listing flow prefers single-token approval, then `list`; make clear approval is required but listing is non-custodial.
+- Provide Cancel and Withdraw screens. No server signer, private key, or off-chain order matcher.
+
+Before code, verify on a pinned mainnet fork: collection address, verified source/ABI, `ownerOf`, approval, transfer hooks/restrictions, and intended `safeTransferFrom` behavior. Stop and redesign if it is non-standard.
+
+## State transitions
+
+| Transition | Caller / incentive | If nobody calls it |
+| --- | --- | --- |
+| List | Holder wants visibility | Token stays unlisted; no value at risk. |
+| Cancel | Listed holder changes mind | Listing stays, but seller can invalidate it by transfer/revoking approval. |
+| Buy | Buyer wants NFT | Listing remains active; no automatic action needed. |
+| Withdraw | Seller/artist wants proceeds | ETH remains credited until withdrawn. |
+
+## Delivery plan
+
+### Week 1 — specification and skeleton
+
+- Confirm collection compatibility on a mainnet fork and record assumptions.
+- Write storage, events, custom errors, exact fee rounding (floor royalty in wei; remainder to seller), transaction flows, and invariants.
+- Implement contract in Foundry with pinned OpenZeppelin versions.
+- Unit-test list, replacement, cancellation, purchase, event emission, and fee accounting.
+
+### Week 2 — adversarial testing and basic UI
+
+- Add fuzz/invariant tests: listing never custodians an NFT; a sale transfers exactly one token; price equals seller credit plus artist credit; no double withdrawal; only listed seller cancels.
+- Test stale ownership, revoked approvals, zero/wrong value, unauthorized cancellation, self-buy, rounding, rejecting ETH recipients, malicious buyer/seller contracts, and reentrancy.
+- Build list/cancel/buy/withdraw flows and event indexer; run end-to-end scenarios on a mainnet fork with real token IDs.
+
+### Week 3 — hardening and audit package
+
+- Run Foundry suite, coverage, Slither, formatter, and CI. Test indexer restart/reorg recovery and wallet rejected/replacement transactions.
+- Do a public test environment or fork walkthrough. Freeze contract ABI and source by week end; cut features rather than take them into audit.
+- Assemble audit materials below and confirm the auditor's remediation/confirmation window.
+
+### Week 4 — audit, remediation, launch decision
+
+- Audit the frozen commit; findings are release-gating.
+- Fix valid findings, add regression tests, rerun all tests/Slither, and submit exact fix diff for auditor confirmation.
+- Any material settlement, accounting, permission, or call-order change requires re-review.
+- Deploy only reviewed code; verify it on Etherscan, execute post-deployment checks, publish contract/audit details and royalty limitation.
+
+## Audit scope: send this package
+
+The auditor reviews a frozen commit; deployed bytecode must match it. Include:
+
+1. `CollectionMarketplace.sol`, all imports and exact OpenZeppelin versions, compiler settings/lockfiles, deployment script, constructor arguments, and the exact collection address/interface assumptions.
+2. Every path: list/replace, cancel, buy, fee calculation/rounding, NFT transfer, credit accounting, withdrawal, ETH receive/fallback behavior, and events.
+3. Adversarial cases: stale/burned/transferred token; revoked approval; reentrancy from ERC-721 receiver or ETH recipient; reverting recipients; duplicate/replayed actions; forced ETH/unexpected balance; integer boundaries; griefing and denial of service.
+4. Trust review: prove no hidden admin, fee mutation, arbitrary collection, upgrade path, withdrawal bypass, or NFT-seizure path. Verify immutable artist recipient and 250-bps fee.
+5. Full test suite, coverage, fuzz/invariant tests, Slither output, fork-test output, written spec/invariants, state transitions, and sample traces of each website transaction.
+6. Deployment/runbook: deployer Safe/signers, chain ID, constructor values, bytecode-verification steps, monitoring, incident communication, and the fact that non-upgradeable code cannot be patched in place.
+
+Out of scope unless separately purchased: old collection internals beyond documented interface/transfer behavior; metadata hosting; indexer uptime; visual UI defects; wallet-provider security; Discord operations; and external sales. Give the auditor frontend contract-call code for integration sanity checking: it must not silently substitute collection, recipient, price, chain, or marketplace address.
+
+## Launch criteria
+
+- No unresolved critical/high audit finding; lower findings have disposition.
+- Reviewed commit, constructor args, and deployed/verified bytecode match.
+- CI passes unit, fuzz, invariant, fork, and static-analysis suites.
+- Controlled list, cancel, sale, seller withdrawal, and artist withdrawal succeed in production configuration with a low-value token or equivalent fork rehearsal.
+- Terms say listings are non-custodial, approvals can be revoked, listings can become stale, and 2.5% applies only to sales settled here.
+
+Do not ship unaudited resale settlement merely to meet the four-week date.

diff --git a/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..1d54abbbc0e0622401d4f0461ba99d96056f9545
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,104 @@
+# Mainnet NFT resale marketplace — four-week MVP
+
+## Decision
+
+Build one new, non-upgradeable Ethereum-mainnet marketplace contract for this specific ERC-721 collection, plus a web app and event indexer. Do not modify the 2024 collection unless discovery finds non-standard transfer behavior.
+
+The artist's 2.5% fee (250 basis points) is enforceable only for sales settled through this contract. It cannot be collected from a wallet-to-wallet Discord sale or another marketplace. ERC-2981, if present, is metadata; it does not globally enforce royalties.
+
+Four weeks is realistic for this frozen MVP and one experienced Solidity dev if audit remediation is included in week 4. It is not realistic if scope expands to offers, auctions, ERC-20 payments, bundles, rentals, multiple collections, proxy upgrades, or a bespoke backend/mobile app. If the booked audit cannot confirm fixes during week 4, use a five-week launch plan.
+
+## Architecture
+
+### On-chain: one `CollectionMarketplace` contract
+
+Immutable constructor configuration:
+
+- `collection`: existing ERC-721 address.
+- `royaltyRecipient`: artist wallet, preferably a Safe.
+- `ROYALTY_BPS = 250`; `BPS_DENOMINATOR = 10_000`.
+
+Listing state, keyed by `tokenId`: seller address and ETH price in wei.
+
+| Function | Caller / purpose | Checks and effects |
+| --- | --- | --- |
+| `list(tokenId, price)` | Owner advertises a fixed-price sale | `price > 0`; `ownerOf(tokenId) == msg.sender`; marketplace has token/operator approval; store seller/price; emit `Listed`. |
+| `cancel(tokenId)` | Listed seller withdraws intent | Require recorded seller; delete listing; emit `Cancelled`. No NFT transfer. |
+| `buy(tokenId)` payable | Buyer settles an active listing | Listing exists; buyer differs from seller; exact `msg.value`; listed seller still owns token and approval remains. Delete listing before external calls; calculate royalty and seller proceeds; transfer NFT; credit proceeds; emit `Sale`. |
+| `withdraw()` | Seller or artist collects credited ETH | Non-reentrant pull payment; update credit before transfer; emit `Withdrawal`. |
+
+Use pinned OpenZeppelin `IERC721`, `ReentrancyGuard`, and a safe ETH-transfer utility. Do not hand-roll ERC-721, access control, arithmetic, or payment helpers. V1 has no admin, pause switch, fee setter, arbitrary collection, or upgrade proxy; this minimizes trust and audit surface.
+
+At listing, the NFT stays with its owner. On purchase the marketplace calls `safeTransferFrom(seller, buyer, tokenId)` using the seller's approval. A seller can transfer/burn the token or revoke approval after listing; that listing then cannot execute and must be relisted. The UI must handle this stale-listing revert.
+
+Use pull payments rather than immediate ETH forwarding: a seller or royalty wallet that rejects ETH must not block a valid sale. This temporarily custodians sale proceeds, never NFTs, and makes accounting/withdrawal central audit scope.
+
+### Off-chain: website and indexer
+
+- Ethereum-mainnet-only wallet flow; explicit network switch.
+- Index `Listed`, `Cancelled`, and `Sale` events for the collection grid, filters, and listing history; contract remains source of truth.
+- Before enabling Buy, recheck `ownerOf` and approval; show total price, 2.5% artist fee, seller proceeds, pending/reverted transaction states, and stale-listing explanation.
+- Listing flow prefers single-token approval, then `list`; make clear approval is required but listing is non-custodial.
+- Provide Cancel and Withdraw screens. No server signer, private key, or off-chain order matcher.
+
+Before code, verify on a pinned mainnet fork: collection address, verified source/ABI, `ownerOf`, approval, transfer hooks/restrictions, and intended `safeTransferFrom` behavior. Stop and redesign if it is non-standard.
+
+## State transitions
+
+| Transition | Caller / incentive | If nobody calls it |
+| --- | --- | --- |
+| List | Holder wants visibility | Token stays unlisted; no value at risk. |
+| Cancel | Listed holder changes mind | Listing stays, but seller can invalidate it by transfer/revoking approval. |
+| Buy | Buyer wants NFT | Listing remains active; no automatic action needed. |
+| Withdraw | Seller/artist wants proceeds | ETH remains credited until withdrawn. |
+
+## Delivery plan
+
+### Week 1 — specification and skeleton
+
+- Confirm collection compatibility on a mainnet fork and record assumptions.
+- Write storage, events, custom errors, exact fee rounding (floor royalty in wei; remainder to seller), transaction flows, and invariants.
+- Implement contract in Foundry with pinned OpenZeppelin versions.
+- Unit-test list, replacement, cancellation, purchase, event emission, and fee accounting.
+
+### Week 2 — adversarial testing and basic UI
+
+- Add fuzz/invariant tests: listing never custodians an NFT; a sale transfers exactly one token; price equals seller credit plus artist credit; no double withdrawal; only listed seller cancels.
+- Test stale ownership, revoked approvals, zero/wrong value, unauthorized cancellation, self-buy, rounding, rejecting ETH recipients, malicious buyer/seller contracts, and reentrancy.
+- Build list/cancel/buy/withdraw flows and event indexer; run end-to-end scenarios on a mainnet fork with real token IDs.
+
+### Week 3 — hardening and audit package
+
+- Run Foundry suite, coverage, Slither, formatter, and CI. Test indexer restart/reorg recovery and wallet rejected/replacement transactions.
+- Do a public test environment or fork walkthrough. Freeze contract ABI and source by week end; cut features rather than take them into audit.
+- Assemble audit materials below and confirm the auditor's remediation/confirmation window.
+
+### Week 4 — audit, remediation, launch decision
+
+- Audit the frozen commit; findings are release-gating.
+- Fix valid findings, add regression tests, rerun all tests/Slither, and submit exact fix diff for auditor confirmation.
+- Any material settlement, accounting, permission, or call-order change requires re-review.
+- Deploy only reviewed code; verify it on Etherscan, execute post-deployment checks, publish contract/audit details and royalty limitation.
+
+## Audit scope: send this package
+
+The auditor reviews a frozen commit; deployed bytecode must match it. Include:
+
+1. `CollectionMarketplace.sol`, all imports and exact OpenZeppelin versions, compiler settings/lockfiles, deployment script, constructor arguments, and the exact collection address/interface assumptions.
+2. Every path: list/replace, cancel, buy, fee calculation/rounding, NFT transfer, credit accounting, withdrawal, ETH receive/fallback behavior, and events.
+3. Adversarial cases: stale/burned/transferred token; revoked approval; reentrancy from ERC-721 receiver or ETH recipient; reverting recipients; duplicate/replayed actions; forced ETH/unexpected balance; integer boundaries; griefing and denial of service.
+4. Trust review: prove no hidden admin, fee mutation, arbitrary collection, upgrade path, withdrawal bypass, or NFT-seizure path. Verify immutable artist recipient and 250-bps fee.
+5. Full test suite, coverage, fuzz/invariant tests, Slither output, fork-test output, written spec/invariants, state transitions, and sample traces of each website transaction.
+6. Deployment/runbook: deployer Safe/signers, chain ID, constructor values, bytecode-verification steps, monitoring, incident communication, and the fact that non-upgradeable code cannot be patched in place.
+
+Out of scope unless separately purchased: old collection internals beyond documented interface/transfer behavior; metadata hosting; indexer uptime; visual UI defects; wallet-provider security; Discord operations; and external sales. Give the auditor frontend contract-call code for integration sanity checking: it must not silently substitute collection, recipient, price, chain, or marketplace address.
+
+## Launch criteria
+
+- No unresolved critical/high audit finding; lower findings have disposition.
+- Reviewed commit, constructor args, and deployed/verified bytecode match.
+- CI passes unit, fuzz, invariant, fork, and static-analysis suites.
+- Controlled list, cancel, sale, seller withdrawal, and artist withdrawal succeed in production configuration with a low-value token or equivalent fork rehearsal.
+- Terms say listings are non-custodial, approvals can be revoked, listings can become stale, and 2.5% applies only to sales settled here.
+
+Do not ship unaudited resale settlement merely to meet the four-week date.

exec
/bin/bash -lc "sed -n '1,260p' plan.md && git diff --check && git status --short" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace
 succeeded in 0ms:
# Mainnet NFT resale marketplace — four-week MVP

## Decision

Build one new, non-upgradeable Ethereum-mainnet marketplace contract for this specific ERC-721 collection, plus a web app and event indexer. Do not modify the 2024 collection unless discovery finds non-standard transfer behavior.

The artist's 2.5% fee (250 basis points) is enforceable only for sales settled through this contract. It cannot be collected from a wallet-to-wallet Discord sale or another marketplace. ERC-2981, if present, is metadata; it does not globally enforce royalties.

Four weeks is realistic for this frozen MVP and one experienced Solidity dev if audit remediation is included in week 4. It is not realistic if scope expands to offers, auctions, ERC-20 payments, bundles, rentals, multiple collections, proxy upgrades, or a bespoke backend/mobile app. If the booked audit cannot confirm fixes during week 4, use a five-week launch plan.

## Architecture

### On-chain: one `CollectionMarketplace` contract

Immutable constructor configuration:

- `collection`: existing ERC-721 address.
- `royaltyRecipient`: artist wallet, preferably a Safe.
- `ROYALTY_BPS = 250`; `BPS_DENOMINATOR = 10_000`.

Listing state, keyed by `tokenId`: seller address and ETH price in wei.

| Function | Caller / purpose | Checks and effects |
| --- | --- | --- |
| `list(tokenId, price)` | Owner advertises a fixed-price sale | `price > 0`; `ownerOf(tokenId) == msg.sender`; marketplace has token/operator approval; store seller/price; emit `Listed`. |
| `cancel(tokenId)` | Listed seller withdraws intent | Require recorded seller; delete listing; emit `Cancelled`. No NFT transfer. |
| `buy(tokenId)` payable | Buyer settles an active listing | Listing exists; buyer differs from seller; exact `msg.value`; listed seller still owns token and approval remains. Delete listing before external calls; calculate royalty and seller proceeds; transfer NFT; credit proceeds; emit `Sale`. |
| `withdraw()` | Seller or artist collects credited ETH | Non-reentrant pull payment; update credit before transfer; emit `Withdrawal`. |

Use pinned OpenZeppelin `IERC721`, `ReentrancyGuard`, and a safe ETH-transfer utility. Do not hand-roll ERC-721, access control, arithmetic, or payment helpers. V1 has no admin, pause switch, fee setter, arbitrary collection, or upgrade proxy; this minimizes trust and audit surface.

At listing, the NFT stays with its owner. On purchase the marketplace calls `safeTransferFrom(seller, buyer, tokenId)` using the seller's approval. A seller can transfer/burn the token or revoke approval after listing; that listing then cannot execute and must be relisted. The UI must handle this stale-listing revert.

Use pull payments rather than immediate ETH forwarding: a seller or royalty wallet that rejects ETH must not block a valid sale. This temporarily custodians sale proceeds, never NFTs, and makes accounting/withdrawal central audit scope.

### Off-chain: website and indexer

- Ethereum-mainnet-only wallet flow; explicit network switch.
- Index `Listed`, `Cancelled`, and `Sale` events for the collection grid, filters, and listing history; contract remains source of truth.
- Before enabling Buy, recheck `ownerOf` and approval; show total price, 2.5% artist fee, seller proceeds, pending/reverted transaction states, and stale-listing explanation.
- Listing flow prefers single-token approval, then `list`; make clear approval is required but listing is non-custodial.
- Provide Cancel and Withdraw screens. No server signer, private key, or off-chain order matcher.

Before code, verify on a pinned mainnet fork: collection address, verified source/ABI, `ownerOf`, approval, transfer hooks/restrictions, and intended `safeTransferFrom` behavior. Stop and redesign if it is non-standard.

## State transitions

| Transition | Caller / incentive | If nobody calls it |
| --- | --- | --- |
| List | Holder wants visibility | Token stays unlisted; no value at risk. |
| Cancel | Listed holder changes mind | Listing stays, but seller can invalidate it by transfer/revoking approval. |
| Buy | Buyer wants NFT | Listing remains active; no automatic action needed. |
| Withdraw | Seller/artist wants proceeds | ETH remains credited until withdrawn. |

## Delivery plan

### Week 1 — specification and skeleton

- Confirm collection compatibility on a mainnet fork and record assumptions.
- Write storage, events, custom errors, exact fee rounding (floor royalty in wei; remainder to seller), transaction flows, and invariants.
- Implement contract in Foundry with pinned OpenZeppelin versions.
- Unit-test list, replacement, cancellation, purchase, event emission, and fee accounting.

### Week 2 — adversarial testing and basic UI

- Add fuzz/invariant tests: listing never custodians an NFT; a sale transfers exactly one token; price equals seller credit plus artist credit; no double withdrawal; only listed seller cancels.
- Test stale ownership, revoked approvals, zero/wrong value, unauthorized cancellation, self-buy, rounding, rejecting ETH recipients, malicious buyer/seller contracts, and reentrancy.
- Build list/cancel/buy/withdraw flows and event indexer; run end-to-end scenarios on a mainnet fork with real token IDs.

### Week 3 — hardening and audit package

- Run Foundry suite, coverage, Slither, formatter, and CI. Test indexer restart/reorg recovery and wallet rejected/replacement transactions.
- Do a public test environment or fork walkthrough. Freeze contract ABI and source by week end; cut features rather than take them into audit.
- Assemble audit materials below and confirm the auditor's remediation/confirmation window.

### Week 4 — audit, remediation, launch decision

- Audit the frozen commit; findings are release-gating.
- Fix valid findings, add regression tests, rerun all tests/Slither, and submit exact fix diff for auditor confirmation.
- Any material settlement, accounting, permission, or call-order change requires re-review.
- Deploy only reviewed code; verify it on Etherscan, execute post-deployment checks, publish contract/audit details and royalty limitation.

## Audit scope: send this package

The auditor reviews a frozen commit; deployed bytecode must match it. Include:

1. `CollectionMarketplace.sol`, all imports and exact OpenZeppelin versions, compiler settings/lockfiles, deployment script, constructor arguments, and the exact collection address/interface assumptions.
2. Every path: list/replace, cancel, buy, fee calculation/rounding, NFT transfer, credit accounting, withdrawal, ETH receive/fallback behavior, and events.
3. Adversarial cases: stale/burned/transferred token; revoked approval; reentrancy from ERC-721 receiver or ETH recipient; reverting recipients; duplicate/replayed actions; forced ETH/unexpected balance; integer boundaries; griefing and denial of service.
4. Trust review: prove no hidden admin, fee mutation, arbitrary collection, upgrade path, withdrawal bypass, or NFT-seizure path. Verify immutable artist recipient and 250-bps fee.
5. Full test suite, coverage, fuzz/invariant tests, Slither output, fork-test output, written spec/invariants, state transitions, and sample traces of each website transaction.
6. Deployment/runbook: deployer Safe/signers, chain ID, constructor values, bytecode-verification steps, monitoring, incident communication, and the fact that non-upgradeable code cannot be patched in place.

Out of scope unless separately purchased: old collection internals beyond documented interface/transfer behavior; metadata hosting; indexer uptime; visual UI defects; wallet-provider security; Discord operations; and external sales. Give the auditor frontend contract-call code for integration sanity checking: it must not silently substitute collection, recipient, price, chain, or marketplace address.

## Launch criteria

- No unresolved critical/high audit finding; lower findings have disposition.
- Reviewed commit, constructor args, and deployed/verified bytecode match.
- CI passes unit, fuzz, invariant, fork, and static-analysis suites.
- Controlled list, cancel, sale, seller withdrawal, and artist withdrawal succeed in production configuration with a low-value token or equivalent fork rehearsal.
- Terms say listings are non-custodial, approvals can be revoked, listings can become stale, and 2.5% applies only to sales settled here.

Do not ship unaudited resale settlement merely to meet the four-week date.
?? ../../

diff --git a/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..1d54abbbc0e0622401d4f0461ba99d96056f9545
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,104 @@
+# Mainnet NFT resale marketplace — four-week MVP
+
+## Decision
+
+Build one new, non-upgradeable Ethereum-mainnet marketplace contract for this specific ERC-721 collection, plus a web app and event indexer. Do not modify the 2024 collection unless discovery finds non-standard transfer behavior.
+
+The artist's 2.5% fee (250 basis points) is enforceable only for sales settled through this contract. It cannot be collected from a wallet-to-wallet Discord sale or another marketplace. ERC-2981, if present, is metadata; it does not globally enforce royalties.
+
+Four weeks is realistic for this frozen MVP and one experienced Solidity dev if audit remediation is included in week 4. It is not realistic if scope expands to offers, auctions, ERC-20 payments, bundles, rentals, multiple collections, proxy upgrades, or a bespoke backend/mobile app. If the booked audit cannot confirm fixes during week 4, use a five-week launch plan.
+
+## Architecture
+
+### On-chain: one `CollectionMarketplace` contract
+
+Immutable constructor configuration:
+
+- `collection`: existing ERC-721 address.
+- `royaltyRecipient`: artist wallet, preferably a Safe.
+- `ROYALTY_BPS = 250`; `BPS_DENOMINATOR = 10_000`.
+
+Listing state, keyed by `tokenId`: seller address and ETH price in wei.
+
+| Function | Caller / purpose | Checks and effects |
+| --- | --- | --- |
+| `list(tokenId, price)` | Owner advertises a fixed-price sale | `price > 0`; `ownerOf(tokenId) == msg.sender`; marketplace has token/operator approval; store seller/price; emit `Listed`. |
+| `cancel(tokenId)` | Listed seller withdraws intent | Require recorded seller; delete listing; emit `Cancelled`. No NFT transfer. |
+| `buy(tokenId)` payable | Buyer settles an active listing | Listing exists; buyer differs from seller; exact `msg.value`; listed seller still owns token and approval remains. Delete listing before external calls; calculate royalty and seller proceeds; transfer NFT; credit proceeds; emit `Sale`. |
+| `withdraw()` | Seller or artist collects credited ETH | Non-reentrant pull payment; update credit before transfer; emit `Withdrawal`. |
+
+Use pinned OpenZeppelin `IERC721`, `ReentrancyGuard`, and a safe ETH-transfer utility. Do not hand-roll ERC-721, access control, arithmetic, or payment helpers. V1 has no admin, pause switch, fee setter, arbitrary collection, or upgrade proxy; this minimizes trust and audit surface.
+
+At listing, the NFT stays with its owner. On purchase the marketplace calls `safeTransferFrom(seller, buyer, tokenId)` using the seller's approval. A seller can transfer/burn the token or revoke approval after listing; that listing then cannot execute and must be relisted. The UI must handle this stale-listing revert.
+
+Use pull payments rather than immediate ETH forwarding: a seller or royalty wallet that rejects ETH must not block a valid sale. This temporarily custodians sale proceeds, never NFTs, and makes accounting/withdrawal central audit scope.
+
+### Off-chain: website and indexer
+
+- Ethereum-mainnet-only wallet flow; explicit network switch.
+- Index `Listed`, `Cancelled`, and `Sale` events for the collection grid, filters, and listing history; contract remains source of truth.
+- Before enabling Buy, recheck `ownerOf` and approval; show total price, 2.5% artist fee, seller proceeds, pending/reverted transaction states, and stale-listing explanation.
+- Listing flow prefers single-token approval, then `list`; make clear approval is required but listing is non-custodial.
+- Provide Cancel and Withdraw screens. No server signer, private key, or off-chain order matcher.
+
+Before code, verify on a pinned mainnet fork: collection address, verified source/ABI, `ownerOf`, approval, transfer hooks/restrictions, and intended `safeTransferFrom` behavior. Stop and redesign if it is non-standard.
+
+## State transitions
+
+| Transition | Caller / incentive | If nobody calls it |
+| --- | --- | --- |
+| List | Holder wants visibility | Token stays unlisted; no value at risk. |
+| Cancel | Listed holder changes mind | Listing stays, but seller can invalidate it by transfer/revoking approval. |
+| Buy | Buyer wants NFT | Listing remains active; no automatic action needed. |
+| Withdraw | Seller/artist wants proceeds | ETH remains credited until withdrawn. |
+
+## Delivery plan
+
+### Week 1 — specification and skeleton
+
+- Confirm collection compatibility on a mainnet fork and record assumptions.
+- Write storage, events, custom errors, exact fee rounding (floor royalty in wei; remainder to seller), transaction flows, and invariants.
+- Implement contract in Foundry with pinned OpenZeppelin versions.
+- Unit-test list, replacement, cancellation, purchase, event emission, and fee accounting.
+
+### Week 2 — adversarial testing and basic UI
+
+- Add fuzz/invariant tests: listing never custodians an NFT; a sale transfers exactly one token; price equals seller credit plus artist credit; no double withdrawal; only listed seller cancels.
+- Test stale ownership, revoked approvals, zero/wrong value, unauthorized cancellation, self-buy, rounding, rejecting ETH recipients, malicious buyer/seller contracts, and reentrancy.
+- Build list/cancel/buy/withdraw flows and event indexer; run end-to-end scenarios on a mainnet fork with real token IDs.
+
+### Week 3 — hardening and audit package
+
+- Run Foundry suite, coverage, Slither, formatter, and CI. Test indexer restart/reorg recovery and wallet rejected/replacement transactions.
+- Do a public test environment or fork walkthrough. Freeze contract ABI and source by week end; cut features rather than take them into audit.
+- Assemble audit materials below and confirm the auditor's remediation/confirmation window.
+
+### Week 4 — audit, remediation, launch decision
+
+- Audit the frozen commit; findings are release-gating.
+- Fix valid findings, add regression tests, rerun all tests/Slither, and submit exact fix diff for auditor confirmation.
+- Any material settlement, accounting, permission, or call-order change requires re-review.
+- Deploy only reviewed code; verify it on Etherscan, execute post-deployment checks, publish contract/audit details and royalty limitation.
+
+## Audit scope: send this package
+
+The auditor reviews a frozen commit; deployed bytecode must match it. Include:
+
+1. `CollectionMarketplace.sol`, all imports and exact OpenZeppelin versions, compiler settings/lockfiles, deployment script, constructor arguments, and the exact collection address/interface assumptions.
+2. Every path: list/replace, cancel, buy, fee calculation/rounding, NFT transfer, credit accounting, withdrawal, ETH receive/fallback behavior, and events.
+3. Adversarial cases: stale/burned/transferred token; revoked approval; reentrancy from ERC-721 receiver or ETH recipient; reverting recipients; duplicate/replayed actions; forced ETH/unexpected balance; integer boundaries; griefing and denial of service.
+4. Trust review: prove no hidden admin, fee mutation, arbitrary collection, upgrade path, withdrawal bypass, or NFT-seizure path. Verify immutable artist recipient and 250-bps fee.
+5. Full test suite, coverage, fuzz/invariant tests, Slither output, fork-test output, written spec/invariants, state transitions, and sample traces of each website transaction.
+6. Deployment/runbook: deployer Safe/signers, chain ID, constructor values, bytecode-verification steps, monitoring, incident communication, and the fact that non-upgradeable code cannot be patched in place.
+
+Out of scope unless separately purchased: old collection internals beyond documented interface/transfer behavior; metadata hosting; indexer uptime; visual UI defects; wallet-provider security; Discord operations; and external sales. Give the auditor frontend contract-call code for integration sanity checking: it must not silently substitute collection, recipient, price, chain, or marketplace address.
+
+## Launch criteria
+
+- No unresolved critical/high audit finding; lower findings have disposition.
+- Reviewed commit, constructor args, and deployed/verified bytecode match.
+- CI passes unit, fuzz, invariant, fork, and static-analysis suites.
+- Controlled list, cancel, sale, seller withdrawal, and artist withdrawal succeed in production configuration with a low-value token or equivalent fork rehearsal.
+- Terms say listings are non-custodial, approvals can be revoked, listings can become stale, and 2.5% applies only to sales settled here.
+
+Do not ship unaudited resale settlement merely to meet the four-week date.

codex
Wrote [plan.md](plan.md).

Includes one-contract non-custodial marketplace, 2.5% fee mechanics/limitation, week-by-week plan, exhaustive audit package, and realistic launch gates. Four weeks viable only with frozen MVP scope and audit-fix confirmation.
diff --git a/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..1d54abbbc0e0622401d4f0461ba99d96056f9545
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T195200Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,104 @@
+# Mainnet NFT resale marketplace — four-week MVP
+
+## Decision
+
+Build one new, non-upgradeable Ethereum-mainnet marketplace contract for this specific ERC-721 collection, plus a web app and event indexer. Do not modify the 2024 collection unless discovery finds non-standard transfer behavior.
+
+The artist's 2.5% fee (250 basis points) is enforceable only for sales settled through this contract. It cannot be collected from a wallet-to-wallet Discord sale or another marketplace. ERC-2981, if present, is metadata; it does not globally enforce royalties.
+
+Four weeks is realistic for this frozen MVP and one experienced Solidity dev if audit remediation is included in week 4. It is not realistic if scope expands to offers, auctions, ERC-20 payments, bundles, rentals, multiple collections, proxy upgrades, or a bespoke backend/mobile app. If the booked audit cannot confirm fixes during week 4, use a five-week launch plan.
+
+## Architecture
+
+### On-chain: one `CollectionMarketplace` contract
+
+Immutable constructor configuration:
+
+- `collection`: existing ERC-721 address.
+- `royaltyRecipient`: artist wallet, preferably a Safe.
+- `ROYALTY_BPS = 250`; `BPS_DENOMINATOR = 10_000`.
+
+Listing state, keyed by `tokenId`: seller address and ETH price in wei.
+
+| Function | Caller / purpose | Checks and effects |
+| --- | --- | --- |
+| `list(tokenId, price)` | Owner advertises a fixed-price sale | `price > 0`; `ownerOf(tokenId) == msg.sender`; marketplace has token/operator approval; store seller/price; emit `Listed`. |
+| `cancel(tokenId)` | Listed seller withdraws intent | Require recorded seller; delete listing; emit `Cancelled`. No NFT transfer. |
+| `buy(tokenId)` payable | Buyer settles an active listing | Listing exists; buyer differs from seller; exact `msg.value`; listed seller still owns token and approval remains. Delete listing before external calls; calculate royalty and seller proceeds; transfer NFT; credit proceeds; emit `Sale`. |
+| `withdraw()` | Seller or artist collects credited ETH | Non-reentrant pull payment; update credit before transfer; emit `Withdrawal`. |
+
+Use pinned OpenZeppelin `IERC721`, `ReentrancyGuard`, and a safe ETH-transfer utility. Do not hand-roll ERC-721, access control, arithmetic, or payment helpers. V1 has no admin, pause switch, fee setter, arbitrary collection, or upgrade proxy; this minimizes trust and audit surface.
+
+At listing, the NFT stays with its owner. On purchase the marketplace calls `safeTransferFrom(seller, buyer, tokenId)` using the seller's approval. A seller can transfer/burn the token or revoke approval after listing; that listing then cannot execute and must be relisted. The UI must handle this stale-listing revert.
+
+Use pull payments rather than immediate ETH forwarding: a seller or royalty wallet that rejects ETH must not block a valid sale. This temporarily custodians sale proceeds, never NFTs, and makes accounting/withdrawal central audit scope.
+
+### Off-chain: website and indexer
+
+- Ethereum-mainnet-only wallet flow; explicit network switch.
+- Index `Listed`, `Cancelled`, and `Sale` events for the collection grid, filters, and listing history; contract remains source of truth.
+- Before enabling Buy, recheck `ownerOf` and approval; show total price, 2.5% artist fee, seller proceeds, pending/reverted transaction states, and stale-listing explanation.
+- Listing flow prefers single-token approval, then `list`; make clear approval is required but listing is non-custodial.
+- Provide Cancel and Withdraw screens. No server signer, private key, or off-chain order matcher.
+
+Before code, verify on a pinned mainnet fork: collection address, verified source/ABI, `ownerOf`, approval, transfer hooks/restrictions, and intended `safeTransferFrom` behavior. Stop and redesign if it is non-standard.
+
+## State transitions
+
+| Transition | Caller / incentive | If nobody calls it |
+| --- | --- | --- |
+| List | Holder wants visibility | Token stays unlisted; no value at risk. |
+| Cancel | Listed holder changes mind | Listing stays, but seller can invalidate it by transfer/revoking approval. |
+| Buy | Buyer wants NFT | Listing remains active; no automatic action needed. |
+| Withdraw | Seller/artist wants proceeds | ETH remains credited until withdrawn. |
+
+## Delivery plan
+
+### Week 1 — specification and skeleton
+
+- Confirm collection compatibility on a mainnet fork and record assumptions.
+- Write storage, events, custom errors, exact fee rounding (floor royalty in wei; remainder to seller), transaction flows, and invariants.
+- Implement contract in Foundry with pinned OpenZeppelin versions.
+- Unit-test list, replacement, cancellation, purchase, event emission, and fee accounting.
+
+### Week 2 — adversarial testing and basic UI
+
+- Add fuzz/invariant tests: listing never custodians an NFT; a sale transfers exactly one token; price equals seller credit plus artist credit; no double withdrawal; only listed seller cancels.
+- Test stale ownership, revoked approvals, zero/wrong value, unauthorized cancellation, self-buy, rounding, rejecting ETH recipients, malicious buyer/seller contracts, and reentrancy.
+- Build list/cancel/buy/withdraw flows and event indexer; run end-to-end scenarios on a mainnet fork with real token IDs.
+
+### Week 3 — hardening and audit package
+
+- Run Foundry suite, coverage, Slither, formatter, and CI. Test indexer restart/reorg recovery and wallet rejected/replacement transactions.
+- Do a public test environment or fork walkthrough. Freeze contract ABI and source by week end; cut features rather than take them into audit.
+- Assemble audit materials below and confirm the auditor's remediation/confirmation window.
+
+### Week 4 — audit, remediation, launch decision
+
+- Audit the frozen commit; findings are release-gating.
+- Fix valid findings, add regression tests, rerun all tests/Slither, and submit exact fix diff for auditor confirmation.
+- Any material settlement, accounting, permission, or call-order change requires re-review.
+- Deploy only reviewed code; verify it on Etherscan, execute post-deployment checks, publish contract/audit details and royalty limitation.
+
+## Audit scope: send this package
+
+The auditor reviews a frozen commit; deployed bytecode must match it. Include:
+
+1. `CollectionMarketplace.sol`, all imports and exact OpenZeppelin versions, compiler settings/lockfiles, deployment script, constructor arguments, and the exact collection address/interface assumptions.
+2. Every path: list/replace, cancel, buy, fee calculation/rounding, NFT transfer, credit accounting, withdrawal, ETH receive/fallback behavior, and events.
+3. Adversarial cases: stale/burned/transferred token; revoked approval; reentrancy from ERC-721 receiver or ETH recipient; reverting recipients; duplicate/replayed actions; forced ETH/unexpected balance; integer boundaries; griefing and denial of service.
+4. Trust review: prove no hidden admin, fee mutation, arbitrary collection, upgrade path, withdrawal bypass, or NFT-seizure path. Verify immutable artist recipient and 250-bps fee.
+5. Full test suite, coverage, fuzz/invariant tests, Slither output, fork-test output, written spec/invariants, state transitions, and sample traces of each website transaction.
+6. Deployment/runbook: deployer Safe/signers, chain ID, constructor values, bytecode-verification steps, monitoring, incident communication, and the fact that non-upgradeable code cannot be patched in place.
+
+Out of scope unless separately purchased: old collection internals beyond documented interface/transfer behavior; metadata hosting; indexer uptime; visual UI defects; wallet-provider security; Discord operations; and external sales. Give the auditor frontend contract-call code for integration sanity checking: it must not silently substitute collection, recipient, price, chain, or marketplace address.
+
+## Launch criteria
+
+- No unresolved critical/high audit finding; lower findings have disposition.
+- Reviewed commit, constructor args, and deployed/verified bytecode match.
+- CI passes unit, fuzz, invariant, fork, and static-analysis suites.
+- Controlled list, cancel, sale, seller withdrawal, and artist withdrawal succeed in production configuration with a low-value token or equivalent fork rehearsal.
+- Terms say listings are non-custodial, approvals can be revoked, listings can become stale, and 2.5% applies only to sales settled here.
+
+Do not ship unaudited resale settlement merely to meet the four-week date.

tokens used
29,026
Wrote [plan.md](plan.md).

Includes one-contract non-custodial marketplace, 2.5% fee mechanics/limitation, week-by-week plan, exhaustive audit package, and realistic launch gates. Four weeks viable only with frozen MVP scope and audit-fix confirmation.
