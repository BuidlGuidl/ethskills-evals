Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb491-7335-77b1-84db-d695243acae9
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
I’m using the `ship` skill because this is a dApp delivery/audit-planning request; I’ll turn it into a scoped four-week plan in `plan.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md && printf '\\n--- files ---\\n' && rg --files -g '"'!*node_modules*'"' | sed -n '1,160p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace
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


--- files ---
TASK.md

exec
/bin/bash -lc "sed -n '241,520p' .agents/skills/ship/SKILL.md && find .agents/skills -maxdepth 2 -name SKILL.md -printf '%h\\n' | sort" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace
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
.agents/skills/ship

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..8718c8ef231df8e08b665b3c5b004884f3d43359
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,86 @@
+# Mainnet resale marketplace: delivery and audit plan
+
+## Recommendation
+
+Launch a deliberately narrow marketplace on Ethereum mainnet using the already-deployed Seaport protocol and **no new marketplace Solidity contract**. A listing is a seller-signed Seaport order, stored and indexed offchain; the NFT remains in the seller wallet. On purchase, Seaport atomically transfers the NFT to the buyer and sends the proceeds to the seller and artist.
+
+This is realistic in four weeks for one Solidity developer only with this scope. Building and auditing a bespoke marketplace contract in the same window is not a responsible plan. Book the audit slot now and freeze scope before it starts.
+
+This plan guarantees the 2.5% payment for fills made through our site. It cannot make royalties compulsory on transfers or sales made elsewhere on Ethereum mainnet.
+
+## Fixed product rules
+
+* Collection: the existing Ethereum-mainnet ERC-721 only; token IDs 1--5,000 as actually supported by the collection. No other collections, ERC-1155s, offers, bids, bundles, auctions, traits, or currency other than native ETH in v1.
+* A displayed listing price is the buyer's total price. For a 0.4 ETH listing, the seller receives 0.390 ETH and the immutable artist payout address receives 0.010 ETH. Compute `artist = floor(price * 250 / 10_000)` in wei and `seller = price - artist`; reject a zero or dust seller amount.
+* Listing is gasless: the owner signs an EIP-712 Seaport order. Before listing, they grant the official Seaport conduit the required collection approval (`setApprovalForAll` or token approval). The NFT is never transferred at listing time.
+* Buying is one onchain transaction by the buyer. It either transfers the NFT and both ETH payments, or reverts. The buyer supplies exactly the total listing price plus gas.
+* Individual cancellation is an onchain Seaport cancellation by the seller and takes effect only after confirmation. The UI may hide it immediately as “cancellation pending,” but must not claim it is final first. Transferring the NFT or removing approval also makes a sale fail, but is not the normal cancel path.
+* The site only indexes orders whose collection, chain ID, offer item, payment recipients, fee amount, price, expiry, and seller signature pass server-side validation. Never accept artist recipient, fee bps, Seaport address, conduit, or order type from browser input.
+
+## Architecture and state transitions
+
+There is one deployed protocol dependency, Seaport; it is already deployed and out of our control. We deploy no proxy, router, escrow, upgrade, admin, or fee-withdrawal contract.
+
+| Action | Caller / gas payer | State and safety condition |
+| --- | --- | --- |
+| Approve conduit | Seller / seller | NFT stays with seller; approval is checked before order creation and again before purchase. |
+| Create listing | Seller / no gas | Signs exact order offchain. Indexer records it after signature and field validation. |
+| Browse | Anyone / no gas | API/indexer derives active status from the order, chain ownership/approval, Seaport cancellation state, expiry, and sale events. It treats status as advisory. |
+| Buy | Buyer / buyer | Seaport verifies signature/order state and atomically transfers NFT, 97.5% to seller and 2.5% to artist. Any stale ownership or approval reverts. |
+| Cancel one listing | Seller / seller | Calls Seaport cancellation; indexer removes it after the cancellation event/confirmed state. |
+| Cancel all listings | Seller / seller | Optional explicit “cancel all” uses Seaport counter increment; it invalidates every prior listing. Keep separate from v1 if it complicates UX. |
+
+The frontend must simulate the fulfill transaction immediately before wallet submission, then report reverts plainly (“already sold, cancelled, transferred, approval removed, or expired”), rather than presenting a failed purchase as successful.
+
+## What remains offchain
+
+The frontend, listing API, indexer/database, search, listing activity, images, and notifications stay offchain. They can be unavailable or censor a listing; they must never be trusted to custody an NFT or ETH, determine ownership, alter fees, or settle a sale. Persist the signed order and its hash, but consider Seaport and the NFT contract the source of truth.
+
+Use event indexing plus periodic reconciliation for `Transfer`, `Approval`, `ApprovalForAll`, Seaport order/counter/cancellation events, and completed sales. Confirmations/reorg handling, idempotent ingestion, and an explicit degraded-data banner are required before launch. A public order-submission endpoint needs signature verification, validation, rate limits, and abuse controls; no private key is needed for normal listings or purchases.
+
+## Four-week delivery plan
+
+### Week 1 — prove compatibility and lock the design
+
+* Fork mainnet and inspect the collection: ERC-721 transfer behavior, token-ID range, pause/transfer restrictions, existing approvals, proxy behavior, and whether its code has non-standard hooks. Verify its deployed address and the official Ethereum-mainnet Seaport/conduit addresses from primary sources; pin them in one reviewed configuration module.
+* Produce the threat model, precise price/rounding rule above, UI copy for approval/cancel/failure cases, supported-wallet policy, and go/no-go requirements.
+* Implement a small, typed Seaport order builder/validator. Create fork tests for a 0.4 ETH purchase and for incorrect collection, token ID, signer, chain, recipient, fee, expiry, price, and conduit.
+
+### Week 2 — core flows and reliable listing data
+
+* Build connect-wallet, approve, sign-listing, browse-detail, buy, and cancel flows. The order builder must be shared by frontend and server validation or generated from one canonical module.
+* Build the listing API/indexer with signature verification, immutable order storage, event ingestion, reconciliation, expiry handling, and status transitions.
+* Add mainnet-fork integration tests: successful sale; seller cancellation; seller transferred token; approval revoked; buyer underpays; expired order; duplicate submission; fee recipient/amount mutation; and stale UI purchase.
+
+### Week 3 — hardening and audit readiness
+
+* Finish responsive/error/loading states; expose transaction links and clear finality states. Do not use unlimited ETH approvals (none should be needed); explain the collection approval and let holders revoke it through the normal wallet path.
+* Add unit, integration, property/fuzz tests around wei splitting and order validation; run static/dependency/security scans. Test against the live collection on a fork, not a mock alone.
+* Write deployment/runbooks: pinned dependency lockfile and contract configuration, indexer backfill/recovery, monitoring and alerts, incident communications, domain/CDN controls, RPC fallback, and a no-admin-keys statement.
+* Freeze an audit candidate commit and produce the audit package below. No new feature work once it is sent.
+
+### Week 4 — audit, remediation, launch decision
+
+* Auditor reviews the frozen commit. Team answers questions with reproductions, not silent code changes.
+* Fix accepted findings only on a tracked remediation branch; rerun the full fork suite, regression tests for every finding, and a release checklist. Auditor confirms remediation where their process permits.
+* Deploy the site, observe the indexer, and conduct one small internal production sale only after the auditor sign-off and go/no-go review. Verify no listings/order data or user funds are migrated or held by the team.
+
+## Audit scope package
+
+Send one versioned archive/repository commit plus a short architecture brief. The audit scope is the full path that can cause a user to sign a malformed order or pay/receive the wrong assets:
+
+1. **All production source at a commit hash:** frontend transaction/order code, shared Seaport encoder/decoder, backend listing API, validation rules, indexer, database schema/migrations relevant to order state, deployment/configuration code, and dependency lockfiles. Include built frontend artifact hashes if applicable.
+2. **Integration configuration:** collection address and verified ABI/implementation/proxy information; exact Seaport and conduit addresses; chain ID; artist recipient address; 2.5% bps constant; allowed currencies/order types; RPC providers. The artist address and fee must be configuration-reviewed and immutable for this release.
+3. **Protocol specification:** the product rules and state-transition table above, order-format examples for 0.4 ETH and odd-wei prices, signed EIP-712 typed-data fixture, definition of active/cancelled/expired/sold, and explicit statement that royalty enforcement is only on-site.
+4. **Threat model and trust boundaries:** compromised website/API, malicious order submission, stale/reorged indexer data, spoofed chain/configuration, approval risks, seller transferring/revoking approval after listing, buyer transaction replacement/front-running, fee redirection, dependency/supply-chain compromise, and collection-specific transfer behavior.
+5. **Evidence:** test commands and results, mainnet-fork tests, fuzz/property tests, static-analysis results, known limitations, deployment checklist, monitoring/incident runbook, and a finding-remediation log.
+
+Ask the auditor to treat Seaport's deployed core contracts as a third-party dependency rather than re-audit it, but to audit every integration assumption and exact order parameter. If any custom Solidity is added, it is automatically in scope along with bytecode, constructor args, ownership/upgrade controls, all privileged actions, and its full test suite; that change invalidates this four-week estimate until the audit window is re-planned.
+
+## Go/no-go criteria
+
+Go only if the auditor has no unresolved high/critical findings; the collection passes fork compatibility tests; buyer total and both payout amounts match the rules for boundary/odd-wei prices; cancellation and stale-order behavior are confirmed on a fork; all deployed configuration is independently checked; indexer recovery/reorg tests pass; and production monitoring/incident ownership is assigned.
+
+## Reality check
+
+Four weeks is credible for this narrowly integrated ETH-only marketplace if the audit firm is booked immediately, the existing collection is standard ERC-721, and weeks 3--4 retain remediation time. It is not credible if “one audit pass at the end” means zero time to fix findings, if a custom settlement contract is required, or if v1 expands to offers, auctions, multiple currencies, ERC-1155, arbitrary collections, cross-chain trading, or enforced royalties everywhere. In those cases, defer launch or fund a longer build/audit cycle.

diff --git a/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..8718c8ef231df8e08b665b3c5b004884f3d43359
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,86 @@
+# Mainnet resale marketplace: delivery and audit plan
+
+## Recommendation
+
+Launch a deliberately narrow marketplace on Ethereum mainnet using the already-deployed Seaport protocol and **no new marketplace Solidity contract**. A listing is a seller-signed Seaport order, stored and indexed offchain; the NFT remains in the seller wallet. On purchase, Seaport atomically transfers the NFT to the buyer and sends the proceeds to the seller and artist.
+
+This is realistic in four weeks for one Solidity developer only with this scope. Building and auditing a bespoke marketplace contract in the same window is not a responsible plan. Book the audit slot now and freeze scope before it starts.
+
+This plan guarantees the 2.5% payment for fills made through our site. It cannot make royalties compulsory on transfers or sales made elsewhere on Ethereum mainnet.
+
+## Fixed product rules
+
+* Collection: the existing Ethereum-mainnet ERC-721 only; token IDs 1--5,000 as actually supported by the collection. No other collections, ERC-1155s, offers, bids, bundles, auctions, traits, or currency other than native ETH in v1.
+* A displayed listing price is the buyer's total price. For a 0.4 ETH listing, the seller receives 0.390 ETH and the immutable artist payout address receives 0.010 ETH. Compute `artist = floor(price * 250 / 10_000)` in wei and `seller = price - artist`; reject a zero or dust seller amount.
+* Listing is gasless: the owner signs an EIP-712 Seaport order. Before listing, they grant the official Seaport conduit the required collection approval (`setApprovalForAll` or token approval). The NFT is never transferred at listing time.
+* Buying is one onchain transaction by the buyer. It either transfers the NFT and both ETH payments, or reverts. The buyer supplies exactly the total listing price plus gas.
+* Individual cancellation is an onchain Seaport cancellation by the seller and takes effect only after confirmation. The UI may hide it immediately as “cancellation pending,” but must not claim it is final first. Transferring the NFT or removing approval also makes a sale fail, but is not the normal cancel path.
+* The site only indexes orders whose collection, chain ID, offer item, payment recipients, fee amount, price, expiry, and seller signature pass server-side validation. Never accept artist recipient, fee bps, Seaport address, conduit, or order type from browser input.
+
+## Architecture and state transitions
+
+There is one deployed protocol dependency, Seaport; it is already deployed and out of our control. We deploy no proxy, router, escrow, upgrade, admin, or fee-withdrawal contract.
+
+| Action | Caller / gas payer | State and safety condition |
+| --- | --- | --- |
+| Approve conduit | Seller / seller | NFT stays with seller; approval is checked before order creation and again before purchase. |
+| Create listing | Seller / no gas | Signs exact order offchain. Indexer records it after signature and field validation. |
+| Browse | Anyone / no gas | API/indexer derives active status from the order, chain ownership/approval, Seaport cancellation state, expiry, and sale events. It treats status as advisory. |
+| Buy | Buyer / buyer | Seaport verifies signature/order state and atomically transfers NFT, 97.5% to seller and 2.5% to artist. Any stale ownership or approval reverts. |
+| Cancel one listing | Seller / seller | Calls Seaport cancellation; indexer removes it after the cancellation event/confirmed state. |
+| Cancel all listings | Seller / seller | Optional explicit “cancel all” uses Seaport counter increment; it invalidates every prior listing. Keep separate from v1 if it complicates UX. |
+
+The frontend must simulate the fulfill transaction immediately before wallet submission, then report reverts plainly (“already sold, cancelled, transferred, approval removed, or expired”), rather than presenting a failed purchase as successful.
+
+## What remains offchain
+
+The frontend, listing API, indexer/database, search, listing activity, images, and notifications stay offchain. They can be unavailable or censor a listing; they must never be trusted to custody an NFT or ETH, determine ownership, alter fees, or settle a sale. Persist the signed order and its hash, but consider Seaport and the NFT contract the source of truth.
+
+Use event indexing plus periodic reconciliation for `Transfer`, `Approval`, `ApprovalForAll`, Seaport order/counter/cancellation events, and completed sales. Confirmations/reorg handling, idempotent ingestion, and an explicit degraded-data banner are required before launch. A public order-submission endpoint needs signature verification, validation, rate limits, and abuse controls; no private key is needed for normal listings or purchases.
+
+## Four-week delivery plan
+
+### Week 1 — prove compatibility and lock the design
+
+* Fork mainnet and inspect the collection: ERC-721 transfer behavior, token-ID range, pause/transfer restrictions, existing approvals, proxy behavior, and whether its code has non-standard hooks. Verify its deployed address and the official Ethereum-mainnet Seaport/conduit addresses from primary sources; pin them in one reviewed configuration module.
+* Produce the threat model, precise price/rounding rule above, UI copy for approval/cancel/failure cases, supported-wallet policy, and go/no-go requirements.
+* Implement a small, typed Seaport order builder/validator. Create fork tests for a 0.4 ETH purchase and for incorrect collection, token ID, signer, chain, recipient, fee, expiry, price, and conduit.
+
+### Week 2 — core flows and reliable listing data
+
+* Build connect-wallet, approve, sign-listing, browse-detail, buy, and cancel flows. The order builder must be shared by frontend and server validation or generated from one canonical module.
+* Build the listing API/indexer with signature verification, immutable order storage, event ingestion, reconciliation, expiry handling, and status transitions.
+* Add mainnet-fork integration tests: successful sale; seller cancellation; seller transferred token; approval revoked; buyer underpays; expired order; duplicate submission; fee recipient/amount mutation; and stale UI purchase.
+
+### Week 3 — hardening and audit readiness
+
+* Finish responsive/error/loading states; expose transaction links and clear finality states. Do not use unlimited ETH approvals (none should be needed); explain the collection approval and let holders revoke it through the normal wallet path.
+* Add unit, integration, property/fuzz tests around wei splitting and order validation; run static/dependency/security scans. Test against the live collection on a fork, not a mock alone.
+* Write deployment/runbooks: pinned dependency lockfile and contract configuration, indexer backfill/recovery, monitoring and alerts, incident communications, domain/CDN controls, RPC fallback, and a no-admin-keys statement.
+* Freeze an audit candidate commit and produce the audit package below. No new feature work once it is sent.
+
+### Week 4 — audit, remediation, launch decision
+
+* Auditor reviews the frozen commit. Team answers questions with reproductions, not silent code changes.
+* Fix accepted findings only on a tracked remediation branch; rerun the full fork suite, regression tests for every finding, and a release checklist. Auditor confirms remediation where their process permits.
+* Deploy the site, observe the indexer, and conduct one small internal production sale only after the auditor sign-off and go/no-go review. Verify no listings/order data or user funds are migrated or held by the team.
+
+## Audit scope package
+
+Send one versioned archive/repository commit plus a short architecture brief. The audit scope is the full path that can cause a user to sign a malformed order or pay/receive the wrong assets:
+
+1. **All production source at a commit hash:** frontend transaction/order code, shared Seaport encoder/decoder, backend listing API, validation rules, indexer, database schema/migrations relevant to order state, deployment/configuration code, and dependency lockfiles. Include built frontend artifact hashes if applicable.
+2. **Integration configuration:** collection address and verified ABI/implementation/proxy information; exact Seaport and conduit addresses; chain ID; artist recipient address; 2.5% bps constant; allowed currencies/order types; RPC providers. The artist address and fee must be configuration-reviewed and immutable for this release.
+3. **Protocol specification:** the product rules and state-transition table above, order-format examples for 0.4 ETH and odd-wei prices, signed EIP-712 typed-data fixture, definition of active/cancelled/expired/sold, and explicit statement that royalty enforcement is only on-site.
+4. **Threat model and trust boundaries:** compromised website/API, malicious order submission, stale/reorged indexer data, spoofed chain/configuration, approval risks, seller transferring/revoking approval after listing, buyer transaction replacement/front-running, fee redirection, dependency/supply-chain compromise, and collection-specific transfer behavior.
+5. **Evidence:** test commands and results, mainnet-fork tests, fuzz/property tests, static-analysis results, known limitations, deployment checklist, monitoring/incident runbook, and a finding-remediation log.
+
+Ask the auditor to treat Seaport's deployed core contracts as a third-party dependency rather than re-audit it, but to audit every integration assumption and exact order parameter. If any custom Solidity is added, it is automatically in scope along with bytecode, constructor args, ownership/upgrade controls, all privileged actions, and its full test suite; that change invalidates this four-week estimate until the audit window is re-planned.
+
+## Go/no-go criteria
+
+Go only if the auditor has no unresolved high/critical findings; the collection passes fork compatibility tests; buyer total and both payout amounts match the rules for boundary/odd-wei prices; cancellation and stale-order behavior are confirmed on a fork; all deployed configuration is independently checked; indexer recovery/reorg tests pass; and production monitoring/incident ownership is assigned.
+
+## Reality check
+
+Four weeks is credible for this narrowly integrated ETH-only marketplace if the audit firm is booked immediately, the existing collection is standard ERC-721, and weeks 3--4 retain remediation time. It is not credible if “one audit pass at the end” means zero time to fix findings, if a custom settlement contract is required, or if v1 expands to offers, auctions, multiple currencies, ERC-1155, arbitrary collections, cross-chain trading, or enforced royalties everywhere. In those cases, defer launch or fund a longer build/audit cycle.

codex
The plan is scoped around signed, non-custodial Seaport listings; it makes the 2.5% payout enforceable on this site while avoiding new settlement code. I’m checking the written artifact now.
exec
/bin/bash -lc "sed -n '1,260p' plan.md && git diff --check && git status --short" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace
 succeeded in 0ms:
# Mainnet resale marketplace: delivery and audit plan

## Recommendation

Launch a deliberately narrow marketplace on Ethereum mainnet using the already-deployed Seaport protocol and **no new marketplace Solidity contract**. A listing is a seller-signed Seaport order, stored and indexed offchain; the NFT remains in the seller wallet. On purchase, Seaport atomically transfers the NFT to the buyer and sends the proceeds to the seller and artist.

This is realistic in four weeks for one Solidity developer only with this scope. Building and auditing a bespoke marketplace contract in the same window is not a responsible plan. Book the audit slot now and freeze scope before it starts.

This plan guarantees the 2.5% payment for fills made through our site. It cannot make royalties compulsory on transfers or sales made elsewhere on Ethereum mainnet.

## Fixed product rules

* Collection: the existing Ethereum-mainnet ERC-721 only; token IDs 1--5,000 as actually supported by the collection. No other collections, ERC-1155s, offers, bids, bundles, auctions, traits, or currency other than native ETH in v1.
* A displayed listing price is the buyer's total price. For a 0.4 ETH listing, the seller receives 0.390 ETH and the immutable artist payout address receives 0.010 ETH. Compute `artist = floor(price * 250 / 10_000)` in wei and `seller = price - artist`; reject a zero or dust seller amount.
* Listing is gasless: the owner signs an EIP-712 Seaport order. Before listing, they grant the official Seaport conduit the required collection approval (`setApprovalForAll` or token approval). The NFT is never transferred at listing time.
* Buying is one onchain transaction by the buyer. It either transfers the NFT and both ETH payments, or reverts. The buyer supplies exactly the total listing price plus gas.
* Individual cancellation is an onchain Seaport cancellation by the seller and takes effect only after confirmation. The UI may hide it immediately as “cancellation pending,” but must not claim it is final first. Transferring the NFT or removing approval also makes a sale fail, but is not the normal cancel path.
* The site only indexes orders whose collection, chain ID, offer item, payment recipients, fee amount, price, expiry, and seller signature pass server-side validation. Never accept artist recipient, fee bps, Seaport address, conduit, or order type from browser input.

## Architecture and state transitions

There is one deployed protocol dependency, Seaport; it is already deployed and out of our control. We deploy no proxy, router, escrow, upgrade, admin, or fee-withdrawal contract.

| Action | Caller / gas payer | State and safety condition |
| --- | --- | --- |
| Approve conduit | Seller / seller | NFT stays with seller; approval is checked before order creation and again before purchase. |
| Create listing | Seller / no gas | Signs exact order offchain. Indexer records it after signature and field validation. |
| Browse | Anyone / no gas | API/indexer derives active status from the order, chain ownership/approval, Seaport cancellation state, expiry, and sale events. It treats status as advisory. |
| Buy | Buyer / buyer | Seaport verifies signature/order state and atomically transfers NFT, 97.5% to seller and 2.5% to artist. Any stale ownership or approval reverts. |
| Cancel one listing | Seller / seller | Calls Seaport cancellation; indexer removes it after the cancellation event/confirmed state. |
| Cancel all listings | Seller / seller | Optional explicit “cancel all” uses Seaport counter increment; it invalidates every prior listing. Keep separate from v1 if it complicates UX. |

The frontend must simulate the fulfill transaction immediately before wallet submission, then report reverts plainly (“already sold, cancelled, transferred, approval removed, or expired”), rather than presenting a failed purchase as successful.

## What remains offchain

The frontend, listing API, indexer/database, search, listing activity, images, and notifications stay offchain. They can be unavailable or censor a listing; they must never be trusted to custody an NFT or ETH, determine ownership, alter fees, or settle a sale. Persist the signed order and its hash, but consider Seaport and the NFT contract the source of truth.

Use event indexing plus periodic reconciliation for `Transfer`, `Approval`, `ApprovalForAll`, Seaport order/counter/cancellation events, and completed sales. Confirmations/reorg handling, idempotent ingestion, and an explicit degraded-data banner are required before launch. A public order-submission endpoint needs signature verification, validation, rate limits, and abuse controls; no private key is needed for normal listings or purchases.

## Four-week delivery plan

### Week 1 — prove compatibility and lock the design

* Fork mainnet and inspect the collection: ERC-721 transfer behavior, token-ID range, pause/transfer restrictions, existing approvals, proxy behavior, and whether its code has non-standard hooks. Verify its deployed address and the official Ethereum-mainnet Seaport/conduit addresses from primary sources; pin them in one reviewed configuration module.
* Produce the threat model, precise price/rounding rule above, UI copy for approval/cancel/failure cases, supported-wallet policy, and go/no-go requirements.
* Implement a small, typed Seaport order builder/validator. Create fork tests for a 0.4 ETH purchase and for incorrect collection, token ID, signer, chain, recipient, fee, expiry, price, and conduit.

### Week 2 — core flows and reliable listing data

* Build connect-wallet, approve, sign-listing, browse-detail, buy, and cancel flows. The order builder must be shared by frontend and server validation or generated from one canonical module.
* Build the listing API/indexer with signature verification, immutable order storage, event ingestion, reconciliation, expiry handling, and status transitions.
* Add mainnet-fork integration tests: successful sale; seller cancellation; seller transferred token; approval revoked; buyer underpays; expired order; duplicate submission; fee recipient/amount mutation; and stale UI purchase.

### Week 3 — hardening and audit readiness

* Finish responsive/error/loading states; expose transaction links and clear finality states. Do not use unlimited ETH approvals (none should be needed); explain the collection approval and let holders revoke it through the normal wallet path.
* Add unit, integration, property/fuzz tests around wei splitting and order validation; run static/dependency/security scans. Test against the live collection on a fork, not a mock alone.
* Write deployment/runbooks: pinned dependency lockfile and contract configuration, indexer backfill/recovery, monitoring and alerts, incident communications, domain/CDN controls, RPC fallback, and a no-admin-keys statement.
* Freeze an audit candidate commit and produce the audit package below. No new feature work once it is sent.

### Week 4 — audit, remediation, launch decision

* Auditor reviews the frozen commit. Team answers questions with reproductions, not silent code changes.
* Fix accepted findings only on a tracked remediation branch; rerun the full fork suite, regression tests for every finding, and a release checklist. Auditor confirms remediation where their process permits.
* Deploy the site, observe the indexer, and conduct one small internal production sale only after the auditor sign-off and go/no-go review. Verify no listings/order data or user funds are migrated or held by the team.

## Audit scope package

Send one versioned archive/repository commit plus a short architecture brief. The audit scope is the full path that can cause a user to sign a malformed order or pay/receive the wrong assets:

1. **All production source at a commit hash:** frontend transaction/order code, shared Seaport encoder/decoder, backend listing API, validation rules, indexer, database schema/migrations relevant to order state, deployment/configuration code, and dependency lockfiles. Include built frontend artifact hashes if applicable.
2. **Integration configuration:** collection address and verified ABI/implementation/proxy information; exact Seaport and conduit addresses; chain ID; artist recipient address; 2.5% bps constant; allowed currencies/order types; RPC providers. The artist address and fee must be configuration-reviewed and immutable for this release.
3. **Protocol specification:** the product rules and state-transition table above, order-format examples for 0.4 ETH and odd-wei prices, signed EIP-712 typed-data fixture, definition of active/cancelled/expired/sold, and explicit statement that royalty enforcement is only on-site.
4. **Threat model and trust boundaries:** compromised website/API, malicious order submission, stale/reorged indexer data, spoofed chain/configuration, approval risks, seller transferring/revoking approval after listing, buyer transaction replacement/front-running, fee redirection, dependency/supply-chain compromise, and collection-specific transfer behavior.
5. **Evidence:** test commands and results, mainnet-fork tests, fuzz/property tests, static-analysis results, known limitations, deployment checklist, monitoring/incident runbook, and a finding-remediation log.

Ask the auditor to treat Seaport's deployed core contracts as a third-party dependency rather than re-audit it, but to audit every integration assumption and exact order parameter. If any custom Solidity is added, it is automatically in scope along with bytecode, constructor args, ownership/upgrade controls, all privileged actions, and its full test suite; that change invalidates this four-week estimate until the audit window is re-planned.

## Go/no-go criteria

Go only if the auditor has no unresolved high/critical findings; the collection passes fork compatibility tests; buyer total and both payout amounts match the rules for boundary/odd-wei prices; cancellation and stale-order behavior are confirmed on a fork; all deployed configuration is independently checked; indexer recovery/reorg tests pass; and production monitoring/incident ownership is assigned.

## Reality check

Four weeks is credible for this narrowly integrated ETH-only marketplace if the audit firm is booked immediately, the existing collection is standard ERC-721, and weeks 3--4 retain remediation time. It is not credible if “one audit pass at the end” means zero time to fix findings, if a custom settlement contract is required, or if v1 expands to offers, auctions, multiple currencies, ERC-1155, arbitrary collections, cross-chain trading, or enforced royalties everywhere. In those cases, defer launch or fund a longer build/audit cycle.
?? ../../

diff --git a/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..8718c8ef231df8e08b665b3c5b004884f3d43359
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,86 @@
+# Mainnet resale marketplace: delivery and audit plan
+
+## Recommendation
+
+Launch a deliberately narrow marketplace on Ethereum mainnet using the already-deployed Seaport protocol and **no new marketplace Solidity contract**. A listing is a seller-signed Seaport order, stored and indexed offchain; the NFT remains in the seller wallet. On purchase, Seaport atomically transfers the NFT to the buyer and sends the proceeds to the seller and artist.
+
+This is realistic in four weeks for one Solidity developer only with this scope. Building and auditing a bespoke marketplace contract in the same window is not a responsible plan. Book the audit slot now and freeze scope before it starts.
+
+This plan guarantees the 2.5% payment for fills made through our site. It cannot make royalties compulsory on transfers or sales made elsewhere on Ethereum mainnet.
+
+## Fixed product rules
+
+* Collection: the existing Ethereum-mainnet ERC-721 only; token IDs 1--5,000 as actually supported by the collection. No other collections, ERC-1155s, offers, bids, bundles, auctions, traits, or currency other than native ETH in v1.
+* A displayed listing price is the buyer's total price. For a 0.4 ETH listing, the seller receives 0.390 ETH and the immutable artist payout address receives 0.010 ETH. Compute `artist = floor(price * 250 / 10_000)` in wei and `seller = price - artist`; reject a zero or dust seller amount.
+* Listing is gasless: the owner signs an EIP-712 Seaport order. Before listing, they grant the official Seaport conduit the required collection approval (`setApprovalForAll` or token approval). The NFT is never transferred at listing time.
+* Buying is one onchain transaction by the buyer. It either transfers the NFT and both ETH payments, or reverts. The buyer supplies exactly the total listing price plus gas.
+* Individual cancellation is an onchain Seaport cancellation by the seller and takes effect only after confirmation. The UI may hide it immediately as “cancellation pending,” but must not claim it is final first. Transferring the NFT or removing approval also makes a sale fail, but is not the normal cancel path.
+* The site only indexes orders whose collection, chain ID, offer item, payment recipients, fee amount, price, expiry, and seller signature pass server-side validation. Never accept artist recipient, fee bps, Seaport address, conduit, or order type from browser input.
+
+## Architecture and state transitions
+
+There is one deployed protocol dependency, Seaport; it is already deployed and out of our control. We deploy no proxy, router, escrow, upgrade, admin, or fee-withdrawal contract.
+
+| Action | Caller / gas payer | State and safety condition |
+| --- | --- | --- |
+| Approve conduit | Seller / seller | NFT stays with seller; approval is checked before order creation and again before purchase. |
+| Create listing | Seller / no gas | Signs exact order offchain. Indexer records it after signature and field validation. |
+| Browse | Anyone / no gas | API/indexer derives active status from the order, chain ownership/approval, Seaport cancellation state, expiry, and sale events. It treats status as advisory. |
+| Buy | Buyer / buyer | Seaport verifies signature/order state and atomically transfers NFT, 97.5% to seller and 2.5% to artist. Any stale ownership or approval reverts. |
+| Cancel one listing | Seller / seller | Calls Seaport cancellation; indexer removes it after the cancellation event/confirmed state. |
+| Cancel all listings | Seller / seller | Optional explicit “cancel all” uses Seaport counter increment; it invalidates every prior listing. Keep separate from v1 if it complicates UX. |
+
+The frontend must simulate the fulfill transaction immediately before wallet submission, then report reverts plainly (“already sold, cancelled, transferred, approval removed, or expired”), rather than presenting a failed purchase as successful.
+
+## What remains offchain
+
+The frontend, listing API, indexer/database, search, listing activity, images, and notifications stay offchain. They can be unavailable or censor a listing; they must never be trusted to custody an NFT or ETH, determine ownership, alter fees, or settle a sale. Persist the signed order and its hash, but consider Seaport and the NFT contract the source of truth.
+
+Use event indexing plus periodic reconciliation for `Transfer`, `Approval`, `ApprovalForAll`, Seaport order/counter/cancellation events, and completed sales. Confirmations/reorg handling, idempotent ingestion, and an explicit degraded-data banner are required before launch. A public order-submission endpoint needs signature verification, validation, rate limits, and abuse controls; no private key is needed for normal listings or purchases.
+
+## Four-week delivery plan
+
+### Week 1 — prove compatibility and lock the design
+
+* Fork mainnet and inspect the collection: ERC-721 transfer behavior, token-ID range, pause/transfer restrictions, existing approvals, proxy behavior, and whether its code has non-standard hooks. Verify its deployed address and the official Ethereum-mainnet Seaport/conduit addresses from primary sources; pin them in one reviewed configuration module.
+* Produce the threat model, precise price/rounding rule above, UI copy for approval/cancel/failure cases, supported-wallet policy, and go/no-go requirements.
+* Implement a small, typed Seaport order builder/validator. Create fork tests for a 0.4 ETH purchase and for incorrect collection, token ID, signer, chain, recipient, fee, expiry, price, and conduit.
+
+### Week 2 — core flows and reliable listing data
+
+* Build connect-wallet, approve, sign-listing, browse-detail, buy, and cancel flows. The order builder must be shared by frontend and server validation or generated from one canonical module.
+* Build the listing API/indexer with signature verification, immutable order storage, event ingestion, reconciliation, expiry handling, and status transitions.
+* Add mainnet-fork integration tests: successful sale; seller cancellation; seller transferred token; approval revoked; buyer underpays; expired order; duplicate submission; fee recipient/amount mutation; and stale UI purchase.
+
+### Week 3 — hardening and audit readiness
+
+* Finish responsive/error/loading states; expose transaction links and clear finality states. Do not use unlimited ETH approvals (none should be needed); explain the collection approval and let holders revoke it through the normal wallet path.
+* Add unit, integration, property/fuzz tests around wei splitting and order validation; run static/dependency/security scans. Test against the live collection on a fork, not a mock alone.
+* Write deployment/runbooks: pinned dependency lockfile and contract configuration, indexer backfill/recovery, monitoring and alerts, incident communications, domain/CDN controls, RPC fallback, and a no-admin-keys statement.
+* Freeze an audit candidate commit and produce the audit package below. No new feature work once it is sent.
+
+### Week 4 — audit, remediation, launch decision
+
+* Auditor reviews the frozen commit. Team answers questions with reproductions, not silent code changes.
+* Fix accepted findings only on a tracked remediation branch; rerun the full fork suite, regression tests for every finding, and a release checklist. Auditor confirms remediation where their process permits.
+* Deploy the site, observe the indexer, and conduct one small internal production sale only after the auditor sign-off and go/no-go review. Verify no listings/order data or user funds are migrated or held by the team.
+
+## Audit scope package
+
+Send one versioned archive/repository commit plus a short architecture brief. The audit scope is the full path that can cause a user to sign a malformed order or pay/receive the wrong assets:
+
+1. **All production source at a commit hash:** frontend transaction/order code, shared Seaport encoder/decoder, backend listing API, validation rules, indexer, database schema/migrations relevant to order state, deployment/configuration code, and dependency lockfiles. Include built frontend artifact hashes if applicable.
+2. **Integration configuration:** collection address and verified ABI/implementation/proxy information; exact Seaport and conduit addresses; chain ID; artist recipient address; 2.5% bps constant; allowed currencies/order types; RPC providers. The artist address and fee must be configuration-reviewed and immutable for this release.
+3. **Protocol specification:** the product rules and state-transition table above, order-format examples for 0.4 ETH and odd-wei prices, signed EIP-712 typed-data fixture, definition of active/cancelled/expired/sold, and explicit statement that royalty enforcement is only on-site.
+4. **Threat model and trust boundaries:** compromised website/API, malicious order submission, stale/reorged indexer data, spoofed chain/configuration, approval risks, seller transferring/revoking approval after listing, buyer transaction replacement/front-running, fee redirection, dependency/supply-chain compromise, and collection-specific transfer behavior.
+5. **Evidence:** test commands and results, mainnet-fork tests, fuzz/property tests, static-analysis results, known limitations, deployment checklist, monitoring/incident runbook, and a finding-remediation log.
+
+Ask the auditor to treat Seaport's deployed core contracts as a third-party dependency rather than re-audit it, but to audit every integration assumption and exact order parameter. If any custom Solidity is added, it is automatically in scope along with bytecode, constructor args, ownership/upgrade controls, all privileged actions, and its full test suite; that change invalidates this four-week estimate until the audit window is re-planned.
+
+## Go/no-go criteria
+
+Go only if the auditor has no unresolved high/critical findings; the collection passes fork compatibility tests; buyer total and both payout amounts match the rules for boundary/odd-wei prices; cancellation and stale-order behavior are confirmed on a fork; all deployed configuration is independently checked; indexer recovery/reorg tests pass; and production monitoring/incident ownership is assigned.
+
+## Reality check
+
+Four weeks is credible for this narrowly integrated ETH-only marketplace if the audit firm is booked immediately, the existing collection is standard ERC-721, and weeks 3--4 retain remediation time. It is not credible if “one audit pass at the end” means zero time to fix findings, if a custom settlement contract is required, or if v1 expands to offers, auctions, multiple currencies, ERC-1155, arbitrary collections, cross-chain trading, or enforced royalties everywhere. In those cases, defer launch or fund a longer build/audit cycle.

codex
Wrote [plan.md](plan.md).

Recommendation: non-custodial Seaport integration; no custom Solidity. Four weeks viable only with fixed ETH-only scope, audit booked now, and remediation buffer.
diff --git a/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..8718c8ef231df8e08b665b3c5b004884f3d43359
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194738Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,86 @@
+# Mainnet resale marketplace: delivery and audit plan
+
+## Recommendation
+
+Launch a deliberately narrow marketplace on Ethereum mainnet using the already-deployed Seaport protocol and **no new marketplace Solidity contract**. A listing is a seller-signed Seaport order, stored and indexed offchain; the NFT remains in the seller wallet. On purchase, Seaport atomically transfers the NFT to the buyer and sends the proceeds to the seller and artist.
+
+This is realistic in four weeks for one Solidity developer only with this scope. Building and auditing a bespoke marketplace contract in the same window is not a responsible plan. Book the audit slot now and freeze scope before it starts.
+
+This plan guarantees the 2.5% payment for fills made through our site. It cannot make royalties compulsory on transfers or sales made elsewhere on Ethereum mainnet.
+
+## Fixed product rules
+
+* Collection: the existing Ethereum-mainnet ERC-721 only; token IDs 1--5,000 as actually supported by the collection. No other collections, ERC-1155s, offers, bids, bundles, auctions, traits, or currency other than native ETH in v1.
+* A displayed listing price is the buyer's total price. For a 0.4 ETH listing, the seller receives 0.390 ETH and the immutable artist payout address receives 0.010 ETH. Compute `artist = floor(price * 250 / 10_000)` in wei and `seller = price - artist`; reject a zero or dust seller amount.
+* Listing is gasless: the owner signs an EIP-712 Seaport order. Before listing, they grant the official Seaport conduit the required collection approval (`setApprovalForAll` or token approval). The NFT is never transferred at listing time.
+* Buying is one onchain transaction by the buyer. It either transfers the NFT and both ETH payments, or reverts. The buyer supplies exactly the total listing price plus gas.
+* Individual cancellation is an onchain Seaport cancellation by the seller and takes effect only after confirmation. The UI may hide it immediately as “cancellation pending,” but must not claim it is final first. Transferring the NFT or removing approval also makes a sale fail, but is not the normal cancel path.
+* The site only indexes orders whose collection, chain ID, offer item, payment recipients, fee amount, price, expiry, and seller signature pass server-side validation. Never accept artist recipient, fee bps, Seaport address, conduit, or order type from browser input.
+
+## Architecture and state transitions
+
+There is one deployed protocol dependency, Seaport; it is already deployed and out of our control. We deploy no proxy, router, escrow, upgrade, admin, or fee-withdrawal contract.
+
+| Action | Caller / gas payer | State and safety condition |
+| --- | --- | --- |
+| Approve conduit | Seller / seller | NFT stays with seller; approval is checked before order creation and again before purchase. |
+| Create listing | Seller / no gas | Signs exact order offchain. Indexer records it after signature and field validation. |
+| Browse | Anyone / no gas | API/indexer derives active status from the order, chain ownership/approval, Seaport cancellation state, expiry, and sale events. It treats status as advisory. |
+| Buy | Buyer / buyer | Seaport verifies signature/order state and atomically transfers NFT, 97.5% to seller and 2.5% to artist. Any stale ownership or approval reverts. |
+| Cancel one listing | Seller / seller | Calls Seaport cancellation; indexer removes it after the cancellation event/confirmed state. |
+| Cancel all listings | Seller / seller | Optional explicit “cancel all” uses Seaport counter increment; it invalidates every prior listing. Keep separate from v1 if it complicates UX. |
+
+The frontend must simulate the fulfill transaction immediately before wallet submission, then report reverts plainly (“already sold, cancelled, transferred, approval removed, or expired”), rather than presenting a failed purchase as successful.
+
+## What remains offchain
+
+The frontend, listing API, indexer/database, search, listing activity, images, and notifications stay offchain. They can be unavailable or censor a listing; they must never be trusted to custody an NFT or ETH, determine ownership, alter fees, or settle a sale. Persist the signed order and its hash, but consider Seaport and the NFT contract the source of truth.
+
+Use event indexing plus periodic reconciliation for `Transfer`, `Approval`, `ApprovalForAll`, Seaport order/counter/cancellation events, and completed sales. Confirmations/reorg handling, idempotent ingestion, and an explicit degraded-data banner are required before launch. A public order-submission endpoint needs signature verification, validation, rate limits, and abuse controls; no private key is needed for normal listings or purchases.
+
+## Four-week delivery plan
+
+### Week 1 — prove compatibility and lock the design
+
+* Fork mainnet and inspect the collection: ERC-721 transfer behavior, token-ID range, pause/transfer restrictions, existing approvals, proxy behavior, and whether its code has non-standard hooks. Verify its deployed address and the official Ethereum-mainnet Seaport/conduit addresses from primary sources; pin them in one reviewed configuration module.
+* Produce the threat model, precise price/rounding rule above, UI copy for approval/cancel/failure cases, supported-wallet policy, and go/no-go requirements.
+* Implement a small, typed Seaport order builder/validator. Create fork tests for a 0.4 ETH purchase and for incorrect collection, token ID, signer, chain, recipient, fee, expiry, price, and conduit.
+
+### Week 2 — core flows and reliable listing data
+
+* Build connect-wallet, approve, sign-listing, browse-detail, buy, and cancel flows. The order builder must be shared by frontend and server validation or generated from one canonical module.
+* Build the listing API/indexer with signature verification, immutable order storage, event ingestion, reconciliation, expiry handling, and status transitions.
+* Add mainnet-fork integration tests: successful sale; seller cancellation; seller transferred token; approval revoked; buyer underpays; expired order; duplicate submission; fee recipient/amount mutation; and stale UI purchase.
+
+### Week 3 — hardening and audit readiness
+
+* Finish responsive/error/loading states; expose transaction links and clear finality states. Do not use unlimited ETH approvals (none should be needed); explain the collection approval and let holders revoke it through the normal wallet path.
+* Add unit, integration, property/fuzz tests around wei splitting and order validation; run static/dependency/security scans. Test against the live collection on a fork, not a mock alone.
+* Write deployment/runbooks: pinned dependency lockfile and contract configuration, indexer backfill/recovery, monitoring and alerts, incident communications, domain/CDN controls, RPC fallback, and a no-admin-keys statement.
+* Freeze an audit candidate commit and produce the audit package below. No new feature work once it is sent.
+
+### Week 4 — audit, remediation, launch decision
+
+* Auditor reviews the frozen commit. Team answers questions with reproductions, not silent code changes.
+* Fix accepted findings only on a tracked remediation branch; rerun the full fork suite, regression tests for every finding, and a release checklist. Auditor confirms remediation where their process permits.
+* Deploy the site, observe the indexer, and conduct one small internal production sale only after the auditor sign-off and go/no-go review. Verify no listings/order data or user funds are migrated or held by the team.
+
+## Audit scope package
+
+Send one versioned archive/repository commit plus a short architecture brief. The audit scope is the full path that can cause a user to sign a malformed order or pay/receive the wrong assets:
+
+1. **All production source at a commit hash:** frontend transaction/order code, shared Seaport encoder/decoder, backend listing API, validation rules, indexer, database schema/migrations relevant to order state, deployment/configuration code, and dependency lockfiles. Include built frontend artifact hashes if applicable.
+2. **Integration configuration:** collection address and verified ABI/implementation/proxy information; exact Seaport and conduit addresses; chain ID; artist recipient address; 2.5% bps constant; allowed currencies/order types; RPC providers. The artist address and fee must be configuration-reviewed and immutable for this release.
+3. **Protocol specification:** the product rules and state-transition table above, order-format examples for 0.4 ETH and odd-wei prices, signed EIP-712 typed-data fixture, definition of active/cancelled/expired/sold, and explicit statement that royalty enforcement is only on-site.
+4. **Threat model and trust boundaries:** compromised website/API, malicious order submission, stale/reorged indexer data, spoofed chain/configuration, approval risks, seller transferring/revoking approval after listing, buyer transaction replacement/front-running, fee redirection, dependency/supply-chain compromise, and collection-specific transfer behavior.
+5. **Evidence:** test commands and results, mainnet-fork tests, fuzz/property tests, static-analysis results, known limitations, deployment checklist, monitoring/incident runbook, and a finding-remediation log.
+
+Ask the auditor to treat Seaport's deployed core contracts as a third-party dependency rather than re-audit it, but to audit every integration assumption and exact order parameter. If any custom Solidity is added, it is automatically in scope along with bytecode, constructor args, ownership/upgrade controls, all privileged actions, and its full test suite; that change invalidates this four-week estimate until the audit window is re-planned.
+
+## Go/no-go criteria
+
+Go only if the auditor has no unresolved high/critical findings; the collection passes fork compatibility tests; buyer total and both payout amounts match the rules for boundary/odd-wei prices; cancellation and stale-order behavior are confirmed on a fork; all deployed configuration is independently checked; indexer recovery/reorg tests pass; and production monitoring/incident ownership is assigned.
+
+## Reality check
+
+Four weeks is credible for this narrowly integrated ETH-only marketplace if the audit firm is booked immediately, the existing collection is standard ERC-721, and weeks 3--4 retain remediation time. It is not credible if “one audit pass at the end” means zero time to fix findings, if a custom settlement contract is required, or if v1 expands to offers, auctions, multiple currencies, ERC-1155, arbitrary collections, cross-chain trading, or enforced royalties everywhere. In those cases, defer launch or fund a longer build/audit cycle.

tokens used
23,786
Wrote [plan.md](plan.md).

Recommendation: non-custodial Seaport integration; no custom Solidity. Four weeks viable only with fixed ETH-only scope, audit booked now, and remediation buffer.
