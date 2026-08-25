Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb492-f601-7783-9f83-58873a5ceca1
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
I’m using the repo’s `ship` skill to shape a practical build and audit plan.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace
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
/bin/bash -lc "sed -n '241,520p' .agents/skills/ship/SKILL.md && rg --files .agents/skills | sed -n '1,160p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace
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
I’ll keep it to one non-custodial marketplace contract plus off-chain order discovery/indexing; first checking the workspace before writing.
exec
/bin/bash -lc "pwd && rg --files -g '"'!node_modules'"' -g '"'!*.lock'"' | sed -n '1,200p' && ls -la" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace
 succeeded in 0ms:
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace
TASK.md
total 16
drwxrwxr-x 5 matt matt 4096 Jul 30 12:49 .
drwxrwxr-x 3 matt matt 4096 Jul 30 12:49 ..
drwxrwxr-x 3 matt matt 4096 Jul 30 12:49 .agents
dr-xr-xr-x 2 matt matt   40 Jul 30 12:49 .codex
dr-xr-xr-x 2 matt matt   40 Jul 30 12:49 .git
-rw-rw-r-- 1 matt matt  764 Jul 30 12:49 TASK.md

web search: 
web search: site:docs.opensea.io Seaport fees offer item consideration item ERC721 seller royalties ...
2026-07-30T19:50:49.194795Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 111, 'dev.  It is not realistic if "our own site" means a new settlement contract,' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..287a908cb60b57bc9b207e0bd8307f182963623c
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,100 @@
+# Mainnet resale marketplace — four-week plan
+
+## Decision
+
+Build an **own-branded site on top of Seaport**, not a new marketplace contract. A seller signs a fixed-price ERC-721 listing; the signed order is stored/indexed offchain and is not an onchain listing or escrow. A buyer fulfils it on Ethereum mainnet. Settlement atomically transfers the NFT to the buyer, `2.5%` of the sale price to the artist wallet, and the remainder to the seller. Seaport supports multiple consideration recipients, including extra native-token recipients. [Seaport interface](https://docs.opensea.io/docs/seaport-interface)
+
+This is the credible four-week / one-Solidity-dev scope. Do **not** deploy a custom orderbook, escrow, upgrade proxy, fee manager, or collection contract. The site owns discovery and UX; Seaport owns signed-order validation, cancellation and atomic settlement.
+
+Important limit: `2.5%` can be guaranteed for sales settled through this site/order flow. It cannot be retroactively enforced on *every* resale of an already-minted standard ERC-721: a holder can transfer privately or use another marketplace. Confirm whether the collection has transfer hooks/restrictions before promising global enforcement. If it is ordinary ERC-721, call this a 2.5% site resale fee/artist share.
+
+## Scope and architecture
+
+### Onchain
+
+No new production Solidity contract, assuming the collection is a normal, transferable Ethereum-mainnet ERC-721. Pin the exact deployed Seaport contract/version and SDK version before implementation; do not accept a user-supplied protocol address.
+
+Each listing is a signed, full-fill-only, fixed-price order:
+
+- Offer: exactly one NFT from the fixed collection and token ID.
+- Consideration: ETH split into artist `price * 250 / 10,000` and seller `price - artistShare`.
+- Price is wei; no floating point.
+- Explicit start/end time, unique salt, mainnet chain ID and pinned protocol.
+- No criteria orders, bundles, Dutch auctions, ERC-20/WETH payments, bids, partial fills, zones, conduits, or custom hooks in v1.
+
+The seller gives only the needed NFT approval to the pinned Seaport path. Ownership stays with the seller until the buyer's fulfilment transaction. At fulfilment, Seaport requires approval and atomically transfers NFT and ETH; a transferred NFT, revoked approval, expired order, or cancelled order cannot settle.
+
+Cancellation must be an actual onchain Seaport cancellation/invalidation transaction, then immediately update the indexer. A database flag, revoked approval, or transfer-away is not a trustless cancellation: a prior signed order could still fill if it later becomes executable. Offer “cancel all listings” only when the seller is shown the Seaport counter/order invalidation blast radius.
+
+### Offchain
+
+- Web app: wallet connection; collection/token pages; list, approve, sign, cancel and buy; pending/success/error states; exact ETH, artist share and seller proceeds before signing/sending.
+- Listing service/database: accepts only validated signed orders for the collection; stores order hash, maker, token ID, full order, signature, status and timestamps. Cache/discovery only, never settlement authority.
+- Event indexer: consumes pinned Seaport fulfilment and cancellation/counter events; reconciles collection ownership/approvals; marks stale listings unavailable; handles reorgs. Re-simulate immediately before buyer submits.
+- Backend: no key that can move NFTs or funds. Authenticate/rate-limit writes; listing payloads are untrusted. A database outage may hide listings but cannot block direct onchain cancellation/settlement.
+
+### Pre-build discovery — Days 1–2, go/no-go
+
+Record and give the auditor:
+
+- NFT address, verified source, proxy/owner/admin roles, ERC-721 behavior, transfer restrictions/pauses, actual token range, and ERC-2981/creator-fee enforcement.
+- Artist payout: reviewed multisig, immutable in v1; 2.5% rounding-down rule in wei; a sane UI minimum price.
+- Seaport deployment address, version, SDK commit, ABI and supported route; fork-test all of them against mainnet.
+- Business decisions: ETH only; full-price listings; no bids; recommended duration 15 minutes–30 days; no platform fee; compliance/support/incident contacts.
+
+If the collection is nonstandard, has unresolved proxy-admin behavior, or requires all-marketplace royalty enforcement, stop and re-scope before coding/audit booking.
+
+## Build schedule
+
+| Week | Deliverable | Exit gate |
+| --- | --- | --- |
+| 1 | Discovery; threat model; pinned dependencies; minimal app/DB/indexer; mainnet-fork order-construction spike. | Holder approves, signs, cancels and fulfils a test listing on a fork with exact 2.5/97.5 split. |
+| 2 | List/cancel/buy UX; validation API; indexer/reconciliation; observability. | Sepolia rehearsal and mainnet-fork suite pass; reconciliation prevents stale listings presenting as buyable. |
+| 3 | Complete unit/property/fuzz/negative tests; security review; runbook; freeze protocol/dependency scope. | Code freeze by week end; audit package complete; no features during audit. |
+| 4 | Auditor pass; fix findings only; regression; final independent rehearsal; mainnet deploy/verification and monitored soft launch. | Critical/high findings fixed/retested, otherwise postpone. |
+
+Four weeks is realistic only with this frozen zero-custom-contract scope, an auditor booked now, and focused full-stack help besides the Solidity dev. It is not realistic if “our own site” means a new settlement contract, upgradeability, bids/offers, collection-wide listings, ERC-20s, global royalty enforcement, or an auditor first engaged in week 4.
+
+## Tests and acceptance properties
+
+- `#3312` listed at `0.4 ETH` pays artist exactly `0.01 ETH`, seller exactly `0.39 ETH`, sends NFT to buyer, and leaves no app-held funds.
+- Only current approved owner can create a fillable listing. Reject invalid chain, collection, token ID, price, recipient, expiry, order type and signature.
+- Buyer cannot redirect NFT/artist fee; seller cannot alter price/consideration after signature.
+- Cancelled, expired, filled, transferred-away and approval-revoked orders do not fill. Seller can cancel when site is down.
+- Exact wei math holds for boundary/fuzz prices; consideration sums to advertised price.
+- Test contract-wallet seller/buyer behavior (EIP-1271 where supported), replacement listing, duplicate API submission, reorg, RPC outage and concurrent buyers.
+- Mainnet-fork tests use actual collection + pinned Seaport deployment; production transaction construction matches tested route.
+
+## Audit scope — send this package
+
+Request a **targeted integration/security review**, not a re-audit of Seaport. The audited external deployment is out of scope; every custom line and every assumption used to create/cancel/fulfil orders is in scope.
+
+1. **Scope statement and threat model**
+   - Requirements/non-goals; explicitly site-only fee enforcement.
+   - Actors/assets/trust: seller, buyer, artist multisig, collection admin, web/API/indexer/RPC operator and Seaport.
+   - Invariants: no custody; atomic NFT-for-ETH; immutable 250 bps artist recipient/split; intended collection/token only; seller-controlled cancellation; backend cannot steal/create valid listings.
+
+2. **Exact source artifact**
+   - Immutable git tag/commit; lockfiles; build settings; generated ABIs; Seaport SDK/version and pinned mainnet addresses.
+   - All TypeScript that builds EIP-712/Seaport orders, validates/submits listings, creates cancellation/fulfilment calldata and parses events.
+   - Frontend transaction/signature code, wallet/network gates, all critical API/serverless code, and configuration controlling protocol address, collection allowlist, artist recipient, RPC and secrets.
+
+3. **Collection evidence**
+   - Verified collection source/bytecode; proxy implementation/admin state; fork fixture; approval/transfer semantics; actual-token settlement proof; royalty/hook interaction.
+
+4. **Test and operations evidence**
+   - Unit, property/fuzz, fork and end-to-end results; static/dependency/SBOM reports; known limitations/risk acceptances.
+   - Deployment/verification checklist; monitoring/reorg policy; incident response; disable-site plan while preserving direct seller cancellation; artist multisig policy.
+
+5. **Specific reviewer questions**
+   - Can parameter confusion change collection, token, price, fee recipient/amount, duration, conduit or settlement recipient?
+   - Test signature-domain/chain replay, malleability/EIP-1271, cancellation/counter semantics, stale UI versus onchain validity, approval/conduit blast radius, reentrancy/callback/arbitrary-calldata paths, fee rounding/value conservation, event parsing/reorg/API tampering.
+   - Confirm product copy does not overclaim enforced royalties outside this marketplace.
+
+Audit acceptance: no open critical/high findings; every medium has an owner, written risk decision and regression test; auditor reviews final release commit after fixes. Any new contract or material dependency/address change after review needs another review and pushes launch.
+
+## Launch controls
+
+- Small announced beta; monitor failed fulfilments, cancelled/stale rate, event lag and artist payouts.
+- Verify deployed config on Etherscan; publish protocol, collection, artist and fee parameters.
+- Separate artist-multisig and API credentials. Site can be disabled in an incident, but never custody assets or remove direct onchain invalidation.

diff --git a/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..287a908cb60b57bc9b207e0bd8307f182963623c
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,100 @@
+# Mainnet resale marketplace — four-week plan
+
+## Decision
+
+Build an **own-branded site on top of Seaport**, not a new marketplace contract. A seller signs a fixed-price ERC-721 listing; the signed order is stored/indexed offchain and is not an onchain listing or escrow. A buyer fulfils it on Ethereum mainnet. Settlement atomically transfers the NFT to the buyer, `2.5%` of the sale price to the artist wallet, and the remainder to the seller. Seaport supports multiple consideration recipients, including extra native-token recipients. [Seaport interface](https://docs.opensea.io/docs/seaport-interface)
+
+This is the credible four-week / one-Solidity-dev scope. Do **not** deploy a custom orderbook, escrow, upgrade proxy, fee manager, or collection contract. The site owns discovery and UX; Seaport owns signed-order validation, cancellation and atomic settlement.
+
+Important limit: `2.5%` can be guaranteed for sales settled through this site/order flow. It cannot be retroactively enforced on *every* resale of an already-minted standard ERC-721: a holder can transfer privately or use another marketplace. Confirm whether the collection has transfer hooks/restrictions before promising global enforcement. If it is ordinary ERC-721, call this a 2.5% site resale fee/artist share.
+
+## Scope and architecture
+
+### Onchain
+
+No new production Solidity contract, assuming the collection is a normal, transferable Ethereum-mainnet ERC-721. Pin the exact deployed Seaport contract/version and SDK version before implementation; do not accept a user-supplied protocol address.
+
+Each listing is a signed, full-fill-only, fixed-price order:
+
+- Offer: exactly one NFT from the fixed collection and token ID.
+- Consideration: ETH split into artist `price * 250 / 10,000` and seller `price - artistShare`.
+- Price is wei; no floating point.
+- Explicit start/end time, unique salt, mainnet chain ID and pinned protocol.
+- No criteria orders, bundles, Dutch auctions, ERC-20/WETH payments, bids, partial fills, zones, conduits, or custom hooks in v1.
+
+The seller gives only the needed NFT approval to the pinned Seaport path. Ownership stays with the seller until the buyer's fulfilment transaction. At fulfilment, Seaport requires approval and atomically transfers NFT and ETH; a transferred NFT, revoked approval, expired order, or cancelled order cannot settle.
+
+Cancellation must be an actual onchain Seaport cancellation/invalidation transaction, then immediately update the indexer. A database flag, revoked approval, or transfer-away is not a trustless cancellation: a prior signed order could still fill if it later becomes executable. Offer “cancel all listings” only when the seller is shown the Seaport counter/order invalidation blast radius.
+
+### Offchain
+
+- Web app: wallet connection; collection/token pages; list, approve, sign, cancel and buy; pending/success/error states; exact ETH, artist share and seller proceeds before signing/sending.
+- Listing service/database: accepts only validated signed orders for the collection; stores order hash, maker, token ID, full order, signature, status and timestamps. Cache/discovery only, never settlement authority.
+- Event indexer: consumes pinned Seaport fulfilment and cancellation/counter events; reconciles collection ownership/approvals; marks stale listings unavailable; handles reorgs. Re-simulate immediately before buyer submits.
+- Backend: no key that can move NFTs or funds. Authenticate/rate-limit writes; listing payloads are untrusted. A database outage may hide listings but cannot block direct onchain cancellation/settlement.
+
+### Pre-build discovery — Days 1–2, go/no-go
+
+Record and give the auditor:
+
+- NFT address, verified source, proxy/owner/admin roles, ERC-721 behavior, transfer restrictions/pauses, actual token range, and ERC-2981/creator-fee enforcement.
+- Artist payout: reviewed multisig, immutable in v1; 2.5% rounding-down rule in wei; a sane UI minimum price.
+- Seaport deployment address, version, SDK commit, ABI and supported route; fork-test all of them against mainnet.
+- Business decisions: ETH only; full-price listings; no bids; recommended duration 15 minutes–30 days; no platform fee; compliance/support/incident contacts.
+
+If the collection is nonstandard, has unresolved proxy-admin behavior, or requires all-marketplace royalty enforcement, stop and re-scope before coding/audit booking.
+
+## Build schedule
+
+| Week | Deliverable | Exit gate |
+| --- | --- | --- |
+| 1 | Discovery; threat model; pinned dependencies; minimal app/DB/indexer; mainnet-fork order-construction spike. | Holder approves, signs, cancels and fulfils a test listing on a fork with exact 2.5/97.5 split. |
+| 2 | List/cancel/buy UX; validation API; indexer/reconciliation; observability. | Sepolia rehearsal and mainnet-fork suite pass; reconciliation prevents stale listings presenting as buyable. |
+| 3 | Complete unit/property/fuzz/negative tests; security review; runbook; freeze protocol/dependency scope. | Code freeze by week end; audit package complete; no features during audit. |
+| 4 | Auditor pass; fix findings only; regression; final independent rehearsal; mainnet deploy/verification and monitored soft launch. | Critical/high findings fixed/retested, otherwise postpone. |
+
+Four weeks is realistic only with this frozen zero-custom-contract scope, an auditor booked now, and focused full-stack help besides the Solidity dev. It is not realistic if “our own site” means a new settlement contract, upgradeability, bids/offers, collection-wide listings, ERC-20s, global royalty enforcement, or an auditor first engaged in week 4.
+
+## Tests and acceptance properties
+
+- `#3312` listed at `0.4 ETH` pays artist exactly `0.01 ETH`, seller exactly `0.39 ETH`, sends NFT to buyer, and leaves no app-held funds.
+- Only current approved owner can create a fillable listing. Reject invalid chain, collection, token ID, price, recipient, expiry, order type and signature.
+- Buyer cannot redirect NFT/artist fee; seller cannot alter price/consideration after signature.
+- Cancelled, expired, filled, transferred-away and approval-revoked orders do not fill. Seller can cancel when site is down.
+- Exact wei math holds for boundary/fuzz prices; consideration sums to advertised price.
+- Test contract-wallet seller/buyer behavior (EIP-1271 where supported), replacement listing, duplicate API submission, reorg, RPC outage and concurrent buyers.
+- Mainnet-fork tests use actual collection + pinned Seaport deployment; production transaction construction matches tested route.
+
+## Audit scope — send this package
+
+Request a **targeted integration/security review**, not a re-audit of Seaport. The audited external deployment is out of scope; every custom line and every assumption used to create/cancel/fulfil orders is in scope.
+
+1. **Scope statement and threat model**
+   - Requirements/non-goals; explicitly site-only fee enforcement.
+   - Actors/assets/trust: seller, buyer, artist multisig, collection admin, web/API/indexer/RPC operator and Seaport.
+   - Invariants: no custody; atomic NFT-for-ETH; immutable 250 bps artist recipient/split; intended collection/token only; seller-controlled cancellation; backend cannot steal/create valid listings.
+
+2. **Exact source artifact**
+   - Immutable git tag/commit; lockfiles; build settings; generated ABIs; Seaport SDK/version and pinned mainnet addresses.
+   - All TypeScript that builds EIP-712/Seaport orders, validates/submits listings, creates cancellation/fulfilment calldata and parses events.
+   - Frontend transaction/signature code, wallet/network gates, all critical API/serverless code, and configuration controlling protocol address, collection allowlist, artist recipient, RPC and secrets.
+
+3. **Collection evidence**
+   - Verified collection source/bytecode; proxy implementation/admin state; fork fixture; approval/transfer semantics; actual-token settlement proof; royalty/hook interaction.
+
+4. **Test and operations evidence**
+   - Unit, property/fuzz, fork and end-to-end results; static/dependency/SBOM reports; known limitations/risk acceptances.
+   - Deployment/verification checklist; monitoring/reorg policy; incident response; disable-site plan while preserving direct seller cancellation; artist multisig policy.
+
+5. **Specific reviewer questions**
+   - Can parameter confusion change collection, token, price, fee recipient/amount, duration, conduit or settlement recipient?
+   - Test signature-domain/chain replay, malleability/EIP-1271, cancellation/counter semantics, stale UI versus onchain validity, approval/conduit blast radius, reentrancy/callback/arbitrary-calldata paths, fee rounding/value conservation, event parsing/reorg/API tampering.
+   - Confirm product copy does not overclaim enforced royalties outside this marketplace.
+
+Audit acceptance: no open critical/high findings; every medium has an owner, written risk decision and regression test; auditor reviews final release commit after fixes. Any new contract or material dependency/address change after review needs another review and pushes launch.
+
+## Launch controls
+
+- Small announced beta; monitor failed fulfilments, cancelled/stale rate, event lag and artist payouts.
+- Verify deployed config on Etherscan; publish protocol, collection, artist and fee parameters.
+- Separate artist-multisig and API credentials. Site can be disabled in an incident, but never custody assets or remove direct onchain invalidation.

exec
/bin/bash -lc "sed -n '1,260p' plan.md && git diff --check -- plan.md && git status --short" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace
 succeeded in 0ms:
# Mainnet resale marketplace — four-week plan

## Decision

Build an **own-branded site on top of Seaport**, not a new marketplace contract. A seller signs a fixed-price ERC-721 listing; the signed order is stored/indexed offchain and is not an onchain listing or escrow. A buyer fulfils it on Ethereum mainnet. Settlement atomically transfers the NFT to the buyer, `2.5%` of the sale price to the artist wallet, and the remainder to the seller. Seaport supports multiple consideration recipients, including extra native-token recipients. [Seaport interface](https://docs.opensea.io/docs/seaport-interface)

This is the credible four-week / one-Solidity-dev scope. Do **not** deploy a custom orderbook, escrow, upgrade proxy, fee manager, or collection contract. The site owns discovery and UX; Seaport owns signed-order validation, cancellation and atomic settlement.

Important limit: `2.5%` can be guaranteed for sales settled through this site/order flow. It cannot be retroactively enforced on *every* resale of an already-minted standard ERC-721: a holder can transfer privately or use another marketplace. Confirm whether the collection has transfer hooks/restrictions before promising global enforcement. If it is ordinary ERC-721, call this a 2.5% site resale fee/artist share.

## Scope and architecture

### Onchain

No new production Solidity contract, assuming the collection is a normal, transferable Ethereum-mainnet ERC-721. Pin the exact deployed Seaport contract/version and SDK version before implementation; do not accept a user-supplied protocol address.

Each listing is a signed, full-fill-only, fixed-price order:

- Offer: exactly one NFT from the fixed collection and token ID.
- Consideration: ETH split into artist `price * 250 / 10,000` and seller `price - artistShare`.
- Price is wei; no floating point.
- Explicit start/end time, unique salt, mainnet chain ID and pinned protocol.
- No criteria orders, bundles, Dutch auctions, ERC-20/WETH payments, bids, partial fills, zones, conduits, or custom hooks in v1.

The seller gives only the needed NFT approval to the pinned Seaport path. Ownership stays with the seller until the buyer's fulfilment transaction. At fulfilment, Seaport requires approval and atomically transfers NFT and ETH; a transferred NFT, revoked approval, expired order, or cancelled order cannot settle.

Cancellation must be an actual onchain Seaport cancellation/invalidation transaction, then immediately update the indexer. A database flag, revoked approval, or transfer-away is not a trustless cancellation: a prior signed order could still fill if it later becomes executable. Offer “cancel all listings” only when the seller is shown the Seaport counter/order invalidation blast radius.

### Offchain

- Web app: wallet connection; collection/token pages; list, approve, sign, cancel and buy; pending/success/error states; exact ETH, artist share and seller proceeds before signing/sending.
- Listing service/database: accepts only validated signed orders for the collection; stores order hash, maker, token ID, full order, signature, status and timestamps. Cache/discovery only, never settlement authority.
- Event indexer: consumes pinned Seaport fulfilment and cancellation/counter events; reconciles collection ownership/approvals; marks stale listings unavailable; handles reorgs. Re-simulate immediately before buyer submits.
- Backend: no key that can move NFTs or funds. Authenticate/rate-limit writes; listing payloads are untrusted. A database outage may hide listings but cannot block direct onchain cancellation/settlement.

### Pre-build discovery — Days 1–2, go/no-go

Record and give the auditor:

- NFT address, verified source, proxy/owner/admin roles, ERC-721 behavior, transfer restrictions/pauses, actual token range, and ERC-2981/creator-fee enforcement.
- Artist payout: reviewed multisig, immutable in v1; 2.5% rounding-down rule in wei; a sane UI minimum price.
- Seaport deployment address, version, SDK commit, ABI and supported route; fork-test all of them against mainnet.
- Business decisions: ETH only; full-price listings; no bids; recommended duration 15 minutes–30 days; no platform fee; compliance/support/incident contacts.

If the collection is nonstandard, has unresolved proxy-admin behavior, or requires all-marketplace royalty enforcement, stop and re-scope before coding/audit booking.

## Build schedule

| Week | Deliverable | Exit gate |
| --- | --- | --- |
| 1 | Discovery; threat model; pinned dependencies; minimal app/DB/indexer; mainnet-fork order-construction spike. | Holder approves, signs, cancels and fulfils a test listing on a fork with exact 2.5/97.5 split. |
| 2 | List/cancel/buy UX; validation API; indexer/reconciliation; observability. | Sepolia rehearsal and mainnet-fork suite pass; reconciliation prevents stale listings presenting as buyable. |
| 3 | Complete unit/property/fuzz/negative tests; security review; runbook; freeze protocol/dependency scope. | Code freeze by week end; audit package complete; no features during audit. |
| 4 | Auditor pass; fix findings only; regression; final independent rehearsal; mainnet deploy/verification and monitored soft launch. | Critical/high findings fixed/retested, otherwise postpone. |

Four weeks is realistic only with this frozen zero-custom-contract scope, an auditor booked now, and focused full-stack help besides the Solidity dev. It is not realistic if “our own site” means a new settlement contract, upgradeability, bids/offers, collection-wide listings, ERC-20s, global royalty enforcement, or an auditor first engaged in week 4.

## Tests and acceptance properties

- `#3312` listed at `0.4 ETH` pays artist exactly `0.01 ETH`, seller exactly `0.39 ETH`, sends NFT to buyer, and leaves no app-held funds.
- Only current approved owner can create a fillable listing. Reject invalid chain, collection, token ID, price, recipient, expiry, order type and signature.
- Buyer cannot redirect NFT/artist fee; seller cannot alter price/consideration after signature.
- Cancelled, expired, filled, transferred-away and approval-revoked orders do not fill. Seller can cancel when site is down.
- Exact wei math holds for boundary/fuzz prices; consideration sums to advertised price.
- Test contract-wallet seller/buyer behavior (EIP-1271 where supported), replacement listing, duplicate API submission, reorg, RPC outage and concurrent buyers.
- Mainnet-fork tests use actual collection + pinned Seaport deployment; production transaction construction matches tested route.

## Audit scope — send this package

Request a **targeted integration/security review**, not a re-audit of Seaport. The audited external deployment is out of scope; every custom line and every assumption used to create/cancel/fulfil orders is in scope.

1. **Scope statement and threat model**
   - Requirements/non-goals; explicitly site-only fee enforcement.
   - Actors/assets/trust: seller, buyer, artist multisig, collection admin, web/API/indexer/RPC operator and Seaport.
   - Invariants: no custody; atomic NFT-for-ETH; immutable 250 bps artist recipient/split; intended collection/token only; seller-controlled cancellation; backend cannot steal/create valid listings.

2. **Exact source artifact**
   - Immutable git tag/commit; lockfiles; build settings; generated ABIs; Seaport SDK/version and pinned mainnet addresses.
   - All TypeScript that builds EIP-712/Seaport orders, validates/submits listings, creates cancellation/fulfilment calldata and parses events.
   - Frontend transaction/signature code, wallet/network gates, all critical API/serverless code, and configuration controlling protocol address, collection allowlist, artist recipient, RPC and secrets.

3. **Collection evidence**
   - Verified collection source/bytecode; proxy implementation/admin state; fork fixture; approval/transfer semantics; actual-token settlement proof; royalty/hook interaction.

4. **Test and operations evidence**
   - Unit, property/fuzz, fork and end-to-end results; static/dependency/SBOM reports; known limitations/risk acceptances.
   - Deployment/verification checklist; monitoring/reorg policy; incident response; disable-site plan while preserving direct seller cancellation; artist multisig policy.

5. **Specific reviewer questions**
   - Can parameter confusion change collection, token, price, fee recipient/amount, duration, conduit or settlement recipient?
   - Test signature-domain/chain replay, malleability/EIP-1271, cancellation/counter semantics, stale UI versus onchain validity, approval/conduit blast radius, reentrancy/callback/arbitrary-calldata paths, fee rounding/value conservation, event parsing/reorg/API tampering.
   - Confirm product copy does not overclaim enforced royalties outside this marketplace.

Audit acceptance: no open critical/high findings; every medium has an owner, written risk decision and regression test; auditor reviews final release commit after fixes. Any new contract or material dependency/address change after review needs another review and pushes launch.

## Launch controls

- Small announced beta; monitor failed fulfilments, cancelled/stale rate, event lag and artist payouts.
- Verify deployed config on Etherscan; publish protocol, collection, artist and fee parameters.
- Separate artist-multisig and API credentials. Site can be disabled in an incident, but never custody assets or remove direct onchain invalidation.
?? ../../

diff --git a/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..287a908cb60b57bc9b207e0bd8307f182963623c
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,100 @@
+# Mainnet resale marketplace — four-week plan
+
+## Decision
+
+Build an **own-branded site on top of Seaport**, not a new marketplace contract. A seller signs a fixed-price ERC-721 listing; the signed order is stored/indexed offchain and is not an onchain listing or escrow. A buyer fulfils it on Ethereum mainnet. Settlement atomically transfers the NFT to the buyer, `2.5%` of the sale price to the artist wallet, and the remainder to the seller. Seaport supports multiple consideration recipients, including extra native-token recipients. [Seaport interface](https://docs.opensea.io/docs/seaport-interface)
+
+This is the credible four-week / one-Solidity-dev scope. Do **not** deploy a custom orderbook, escrow, upgrade proxy, fee manager, or collection contract. The site owns discovery and UX; Seaport owns signed-order validation, cancellation and atomic settlement.
+
+Important limit: `2.5%` can be guaranteed for sales settled through this site/order flow. It cannot be retroactively enforced on *every* resale of an already-minted standard ERC-721: a holder can transfer privately or use another marketplace. Confirm whether the collection has transfer hooks/restrictions before promising global enforcement. If it is ordinary ERC-721, call this a 2.5% site resale fee/artist share.
+
+## Scope and architecture
+
+### Onchain
+
+No new production Solidity contract, assuming the collection is a normal, transferable Ethereum-mainnet ERC-721. Pin the exact deployed Seaport contract/version and SDK version before implementation; do not accept a user-supplied protocol address.
+
+Each listing is a signed, full-fill-only, fixed-price order:
+
+- Offer: exactly one NFT from the fixed collection and token ID.
+- Consideration: ETH split into artist `price * 250 / 10,000` and seller `price - artistShare`.
+- Price is wei; no floating point.
+- Explicit start/end time, unique salt, mainnet chain ID and pinned protocol.
+- No criteria orders, bundles, Dutch auctions, ERC-20/WETH payments, bids, partial fills, zones, conduits, or custom hooks in v1.
+
+The seller gives only the needed NFT approval to the pinned Seaport path. Ownership stays with the seller until the buyer's fulfilment transaction. At fulfilment, Seaport requires approval and atomically transfers NFT and ETH; a transferred NFT, revoked approval, expired order, or cancelled order cannot settle.
+
+Cancellation must be an actual onchain Seaport cancellation/invalidation transaction, then immediately update the indexer. A database flag, revoked approval, or transfer-away is not a trustless cancellation: a prior signed order could still fill if it later becomes executable. Offer “cancel all listings” only when the seller is shown the Seaport counter/order invalidation blast radius.
+
+### Offchain
+
+- Web app: wallet connection; collection/token pages; list, approve, sign, cancel and buy; pending/success/error states; exact ETH, artist share and seller proceeds before signing/sending.
+- Listing service/database: accepts only validated signed orders for the collection; stores order hash, maker, token ID, full order, signature, status and timestamps. Cache/discovery only, never settlement authority.
+- Event indexer: consumes pinned Seaport fulfilment and cancellation/counter events; reconciles collection ownership/approvals; marks stale listings unavailable; handles reorgs. Re-simulate immediately before buyer submits.
+- Backend: no key that can move NFTs or funds. Authenticate/rate-limit writes; listing payloads are untrusted. A database outage may hide listings but cannot block direct onchain cancellation/settlement.
+
+### Pre-build discovery — Days 1–2, go/no-go
+
+Record and give the auditor:
+
+- NFT address, verified source, proxy/owner/admin roles, ERC-721 behavior, transfer restrictions/pauses, actual token range, and ERC-2981/creator-fee enforcement.
+- Artist payout: reviewed multisig, immutable in v1; 2.5% rounding-down rule in wei; a sane UI minimum price.
+- Seaport deployment address, version, SDK commit, ABI and supported route; fork-test all of them against mainnet.
+- Business decisions: ETH only; full-price listings; no bids; recommended duration 15 minutes–30 days; no platform fee; compliance/support/incident contacts.
+
+If the collection is nonstandard, has unresolved proxy-admin behavior, or requires all-marketplace royalty enforcement, stop and re-scope before coding/audit booking.
+
+## Build schedule
+
+| Week | Deliverable | Exit gate |
+| --- | --- | --- |
+| 1 | Discovery; threat model; pinned dependencies; minimal app/DB/indexer; mainnet-fork order-construction spike. | Holder approves, signs, cancels and fulfils a test listing on a fork with exact 2.5/97.5 split. |
+| 2 | List/cancel/buy UX; validation API; indexer/reconciliation; observability. | Sepolia rehearsal and mainnet-fork suite pass; reconciliation prevents stale listings presenting as buyable. |
+| 3 | Complete unit/property/fuzz/negative tests; security review; runbook; freeze protocol/dependency scope. | Code freeze by week end; audit package complete; no features during audit. |
+| 4 | Auditor pass; fix findings only; regression; final independent rehearsal; mainnet deploy/verification and monitored soft launch. | Critical/high findings fixed/retested, otherwise postpone. |
+
+Four weeks is realistic only with this frozen zero-custom-contract scope, an auditor booked now, and focused full-stack help besides the Solidity dev. It is not realistic if “our own site” means a new settlement contract, upgradeability, bids/offers, collection-wide listings, ERC-20s, global royalty enforcement, or an auditor first engaged in week 4.
+
+## Tests and acceptance properties
+
+- `#3312` listed at `0.4 ETH` pays artist exactly `0.01 ETH`, seller exactly `0.39 ETH`, sends NFT to buyer, and leaves no app-held funds.
+- Only current approved owner can create a fillable listing. Reject invalid chain, collection, token ID, price, recipient, expiry, order type and signature.
+- Buyer cannot redirect NFT/artist fee; seller cannot alter price/consideration after signature.
+- Cancelled, expired, filled, transferred-away and approval-revoked orders do not fill. Seller can cancel when site is down.
+- Exact wei math holds for boundary/fuzz prices; consideration sums to advertised price.
+- Test contract-wallet seller/buyer behavior (EIP-1271 where supported), replacement listing, duplicate API submission, reorg, RPC outage and concurrent buyers.
+- Mainnet-fork tests use actual collection + pinned Seaport deployment; production transaction construction matches tested route.
+
+## Audit scope — send this package
+
+Request a **targeted integration/security review**, not a re-audit of Seaport. The audited external deployment is out of scope; every custom line and every assumption used to create/cancel/fulfil orders is in scope.
+
+1. **Scope statement and threat model**
+   - Requirements/non-goals; explicitly site-only fee enforcement.
+   - Actors/assets/trust: seller, buyer, artist multisig, collection admin, web/API/indexer/RPC operator and Seaport.
+   - Invariants: no custody; atomic NFT-for-ETH; immutable 250 bps artist recipient/split; intended collection/token only; seller-controlled cancellation; backend cannot steal/create valid listings.
+
+2. **Exact source artifact**
+   - Immutable git tag/commit; lockfiles; build settings; generated ABIs; Seaport SDK/version and pinned mainnet addresses.
+   - All TypeScript that builds EIP-712/Seaport orders, validates/submits listings, creates cancellation/fulfilment calldata and parses events.
+   - Frontend transaction/signature code, wallet/network gates, all critical API/serverless code, and configuration controlling protocol address, collection allowlist, artist recipient, RPC and secrets.
+
+3. **Collection evidence**
+   - Verified collection source/bytecode; proxy implementation/admin state; fork fixture; approval/transfer semantics; actual-token settlement proof; royalty/hook interaction.
+
+4. **Test and operations evidence**
+   - Unit, property/fuzz, fork and end-to-end results; static/dependency/SBOM reports; known limitations/risk acceptances.
+   - Deployment/verification checklist; monitoring/reorg policy; incident response; disable-site plan while preserving direct seller cancellation; artist multisig policy.
+
+5. **Specific reviewer questions**
+   - Can parameter confusion change collection, token, price, fee recipient/amount, duration, conduit or settlement recipient?
+   - Test signature-domain/chain replay, malleability/EIP-1271, cancellation/counter semantics, stale UI versus onchain validity, approval/conduit blast radius, reentrancy/callback/arbitrary-calldata paths, fee rounding/value conservation, event parsing/reorg/API tampering.
+   - Confirm product copy does not overclaim enforced royalties outside this marketplace.
+
+Audit acceptance: no open critical/high findings; every medium has an owner, written risk decision and regression test; auditor reviews final release commit after fixes. Any new contract or material dependency/address change after review needs another review and pushes launch.
+
+## Launch controls
+
+- Small announced beta; monitor failed fulfilments, cancelled/stale rate, event lag and artist payouts.
+- Verify deployed config on Etherscan; publish protocol, collection, artist and fee parameters.
+- Separate artist-multisig and API credentials. Site can be disabled in an incident, but never custody assets or remove direct onchain invalidation.

web search: 
web search: https://ethskills.com/feedback/SKILL.md
diff --git a/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..287a908cb60b57bc9b207e0bd8307f182963623c
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,100 @@
+# Mainnet resale marketplace — four-week plan
+
+## Decision
+
+Build an **own-branded site on top of Seaport**, not a new marketplace contract. A seller signs a fixed-price ERC-721 listing; the signed order is stored/indexed offchain and is not an onchain listing or escrow. A buyer fulfils it on Ethereum mainnet. Settlement atomically transfers the NFT to the buyer, `2.5%` of the sale price to the artist wallet, and the remainder to the seller. Seaport supports multiple consideration recipients, including extra native-token recipients. [Seaport interface](https://docs.opensea.io/docs/seaport-interface)
+
+This is the credible four-week / one-Solidity-dev scope. Do **not** deploy a custom orderbook, escrow, upgrade proxy, fee manager, or collection contract. The site owns discovery and UX; Seaport owns signed-order validation, cancellation and atomic settlement.
+
+Important limit: `2.5%` can be guaranteed for sales settled through this site/order flow. It cannot be retroactively enforced on *every* resale of an already-minted standard ERC-721: a holder can transfer privately or use another marketplace. Confirm whether the collection has transfer hooks/restrictions before promising global enforcement. If it is ordinary ERC-721, call this a 2.5% site resale fee/artist share.
+
+## Scope and architecture
+
+### Onchain
+
+No new production Solidity contract, assuming the collection is a normal, transferable Ethereum-mainnet ERC-721. Pin the exact deployed Seaport contract/version and SDK version before implementation; do not accept a user-supplied protocol address.
+
+Each listing is a signed, full-fill-only, fixed-price order:
+
+- Offer: exactly one NFT from the fixed collection and token ID.
+- Consideration: ETH split into artist `price * 250 / 10,000` and seller `price - artistShare`.
+- Price is wei; no floating point.
+- Explicit start/end time, unique salt, mainnet chain ID and pinned protocol.
+- No criteria orders, bundles, Dutch auctions, ERC-20/WETH payments, bids, partial fills, zones, conduits, or custom hooks in v1.
+
+The seller gives only the needed NFT approval to the pinned Seaport path. Ownership stays with the seller until the buyer's fulfilment transaction. At fulfilment, Seaport requires approval and atomically transfers NFT and ETH; a transferred NFT, revoked approval, expired order, or cancelled order cannot settle.
+
+Cancellation must be an actual onchain Seaport cancellation/invalidation transaction, then immediately update the indexer. A database flag, revoked approval, or transfer-away is not a trustless cancellation: a prior signed order could still fill if it later becomes executable. Offer “cancel all listings” only when the seller is shown the Seaport counter/order invalidation blast radius.
+
+### Offchain
+
+- Web app: wallet connection; collection/token pages; list, approve, sign, cancel and buy; pending/success/error states; exact ETH, artist share and seller proceeds before signing/sending.
+- Listing service/database: accepts only validated signed orders for the collection; stores order hash, maker, token ID, full order, signature, status and timestamps. Cache/discovery only, never settlement authority.
+- Event indexer: consumes pinned Seaport fulfilment and cancellation/counter events; reconciles collection ownership/approvals; marks stale listings unavailable; handles reorgs. Re-simulate immediately before buyer submits.
+- Backend: no key that can move NFTs or funds. Authenticate/rate-limit writes; listing payloads are untrusted. A database outage may hide listings but cannot block direct onchain cancellation/settlement.
+
+### Pre-build discovery — Days 1–2, go/no-go
+
+Record and give the auditor:
+
+- NFT address, verified source, proxy/owner/admin roles, ERC-721 behavior, transfer restrictions/pauses, actual token range, and ERC-2981/creator-fee enforcement.
+- Artist payout: reviewed multisig, immutable in v1; 2.5% rounding-down rule in wei; a sane UI minimum price.
+- Seaport deployment address, version, SDK commit, ABI and supported route; fork-test all of them against mainnet.
+- Business decisions: ETH only; full-price listings; no bids; recommended duration 15 minutes–30 days; no platform fee; compliance/support/incident contacts.
+
+If the collection is nonstandard, has unresolved proxy-admin behavior, or requires all-marketplace royalty enforcement, stop and re-scope before coding/audit booking.
+
+## Build schedule
+
+| Week | Deliverable | Exit gate |
+| --- | --- | --- |
+| 1 | Discovery; threat model; pinned dependencies; minimal app/DB/indexer; mainnet-fork order-construction spike. | Holder approves, signs, cancels and fulfils a test listing on a fork with exact 2.5/97.5 split. |
+| 2 | List/cancel/buy UX; validation API; indexer/reconciliation; observability. | Sepolia rehearsal and mainnet-fork suite pass; reconciliation prevents stale listings presenting as buyable. |
+| 3 | Complete unit/property/fuzz/negative tests; security review; runbook; freeze protocol/dependency scope. | Code freeze by week end; audit package complete; no features during audit. |
+| 4 | Auditor pass; fix findings only; regression; final independent rehearsal; mainnet deploy/verification and monitored soft launch. | Critical/high findings fixed/retested, otherwise postpone. |
+
+Four weeks is realistic only with this frozen zero-custom-contract scope, an auditor booked now, and focused full-stack help besides the Solidity dev. It is not realistic if “our own site” means a new settlement contract, upgradeability, bids/offers, collection-wide listings, ERC-20s, global royalty enforcement, or an auditor first engaged in week 4.
+
+## Tests and acceptance properties
+
+- `#3312` listed at `0.4 ETH` pays artist exactly `0.01 ETH`, seller exactly `0.39 ETH`, sends NFT to buyer, and leaves no app-held funds.
+- Only current approved owner can create a fillable listing. Reject invalid chain, collection, token ID, price, recipient, expiry, order type and signature.
+- Buyer cannot redirect NFT/artist fee; seller cannot alter price/consideration after signature.
+- Cancelled, expired, filled, transferred-away and approval-revoked orders do not fill. Seller can cancel when site is down.
+- Exact wei math holds for boundary/fuzz prices; consideration sums to advertised price.
+- Test contract-wallet seller/buyer behavior (EIP-1271 where supported), replacement listing, duplicate API submission, reorg, RPC outage and concurrent buyers.
+- Mainnet-fork tests use actual collection + pinned Seaport deployment; production transaction construction matches tested route.
+
+## Audit scope — send this package
+
+Request a **targeted integration/security review**, not a re-audit of Seaport. The audited external deployment is out of scope; every custom line and every assumption used to create/cancel/fulfil orders is in scope.
+
+1. **Scope statement and threat model**
+   - Requirements/non-goals; explicitly site-only fee enforcement.
+   - Actors/assets/trust: seller, buyer, artist multisig, collection admin, web/API/indexer/RPC operator and Seaport.
+   - Invariants: no custody; atomic NFT-for-ETH; immutable 250 bps artist recipient/split; intended collection/token only; seller-controlled cancellation; backend cannot steal/create valid listings.
+
+2. **Exact source artifact**
+   - Immutable git tag/commit; lockfiles; build settings; generated ABIs; Seaport SDK/version and pinned mainnet addresses.
+   - All TypeScript that builds EIP-712/Seaport orders, validates/submits listings, creates cancellation/fulfilment calldata and parses events.
+   - Frontend transaction/signature code, wallet/network gates, all critical API/serverless code, and configuration controlling protocol address, collection allowlist, artist recipient, RPC and secrets.
+
+3. **Collection evidence**
+   - Verified collection source/bytecode; proxy implementation/admin state; fork fixture; approval/transfer semantics; actual-token settlement proof; royalty/hook interaction.
+
+4. **Test and operations evidence**
+   - Unit, property/fuzz, fork and end-to-end results; static/dependency/SBOM reports; known limitations/risk acceptances.
+   - Deployment/verification checklist; monitoring/reorg policy; incident response; disable-site plan while preserving direct seller cancellation; artist multisig policy.
+
+5. **Specific reviewer questions**
+   - Can parameter confusion change collection, token, price, fee recipient/amount, duration, conduit or settlement recipient?
+   - Test signature-domain/chain replay, malleability/EIP-1271, cancellation/counter semantics, stale UI versus onchain validity, approval/conduit blast radius, reentrancy/callback/arbitrary-calldata paths, fee rounding/value conservation, event parsing/reorg/API tampering.
+   - Confirm product copy does not overclaim enforced royalties outside this marketplace.
+
+Audit acceptance: no open critical/high findings; every medium has an owner, written risk decision and regression test; auditor reviews final release commit after fixes. Any new contract or material dependency/address change after review needs another review and pushes launch.
+
+## Launch controls
+
+- Small announced beta; monitor failed fulfilments, cancelled/stale rate, event lag and artist payouts.
+- Verify deployed config on Etherscan; publish protocol, collection, artist and fee parameters.
+- Separate artist-multisig and API credentials. Site can be disabled in an incident, but never custody assets or remove direct onchain invalidation.

exec
/bin/bash -lc 'curl -fsSL https://ethskills.com/feedback/SKILL.md' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace
 succeeded in 142ms:
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

diff --git a/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..287a908cb60b57bc9b207e0bd8307f182963623c
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,100 @@
+# Mainnet resale marketplace — four-week plan
+
+## Decision
+
+Build an **own-branded site on top of Seaport**, not a new marketplace contract. A seller signs a fixed-price ERC-721 listing; the signed order is stored/indexed offchain and is not an onchain listing or escrow. A buyer fulfils it on Ethereum mainnet. Settlement atomically transfers the NFT to the buyer, `2.5%` of the sale price to the artist wallet, and the remainder to the seller. Seaport supports multiple consideration recipients, including extra native-token recipients. [Seaport interface](https://docs.opensea.io/docs/seaport-interface)
+
+This is the credible four-week / one-Solidity-dev scope. Do **not** deploy a custom orderbook, escrow, upgrade proxy, fee manager, or collection contract. The site owns discovery and UX; Seaport owns signed-order validation, cancellation and atomic settlement.
+
+Important limit: `2.5%` can be guaranteed for sales settled through this site/order flow. It cannot be retroactively enforced on *every* resale of an already-minted standard ERC-721: a holder can transfer privately or use another marketplace. Confirm whether the collection has transfer hooks/restrictions before promising global enforcement. If it is ordinary ERC-721, call this a 2.5% site resale fee/artist share.
+
+## Scope and architecture
+
+### Onchain
+
+No new production Solidity contract, assuming the collection is a normal, transferable Ethereum-mainnet ERC-721. Pin the exact deployed Seaport contract/version and SDK version before implementation; do not accept a user-supplied protocol address.
+
+Each listing is a signed, full-fill-only, fixed-price order:
+
+- Offer: exactly one NFT from the fixed collection and token ID.
+- Consideration: ETH split into artist `price * 250 / 10,000` and seller `price - artistShare`.
+- Price is wei; no floating point.
+- Explicit start/end time, unique salt, mainnet chain ID and pinned protocol.
+- No criteria orders, bundles, Dutch auctions, ERC-20/WETH payments, bids, partial fills, zones, conduits, or custom hooks in v1.
+
+The seller gives only the needed NFT approval to the pinned Seaport path. Ownership stays with the seller until the buyer's fulfilment transaction. At fulfilment, Seaport requires approval and atomically transfers NFT and ETH; a transferred NFT, revoked approval, expired order, or cancelled order cannot settle.
+
+Cancellation must be an actual onchain Seaport cancellation/invalidation transaction, then immediately update the indexer. A database flag, revoked approval, or transfer-away is not a trustless cancellation: a prior signed order could still fill if it later becomes executable. Offer “cancel all listings” only when the seller is shown the Seaport counter/order invalidation blast radius.
+
+### Offchain
+
+- Web app: wallet connection; collection/token pages; list, approve, sign, cancel and buy; pending/success/error states; exact ETH, artist share and seller proceeds before signing/sending.
+- Listing service/database: accepts only validated signed orders for the collection; stores order hash, maker, token ID, full order, signature, status and timestamps. Cache/discovery only, never settlement authority.
+- Event indexer: consumes pinned Seaport fulfilment and cancellation/counter events; reconciles collection ownership/approvals; marks stale listings unavailable; handles reorgs. Re-simulate immediately before buyer submits.
+- Backend: no key that can move NFTs or funds. Authenticate/rate-limit writes; listing payloads are untrusted. A database outage may hide listings but cannot block direct onchain cancellation/settlement.
+
+### Pre-build discovery — Days 1–2, go/no-go
+
+Record and give the auditor:
+
+- NFT address, verified source, proxy/owner/admin roles, ERC-721 behavior, transfer restrictions/pauses, actual token range, and ERC-2981/creator-fee enforcement.
+- Artist payout: reviewed multisig, immutable in v1; 2.5% rounding-down rule in wei; a sane UI minimum price.
+- Seaport deployment address, version, SDK commit, ABI and supported route; fork-test all of them against mainnet.
+- Business decisions: ETH only; full-price listings; no bids; recommended duration 15 minutes–30 days; no platform fee; compliance/support/incident contacts.
+
+If the collection is nonstandard, has unresolved proxy-admin behavior, or requires all-marketplace royalty enforcement, stop and re-scope before coding/audit booking.
+
+## Build schedule
+
+| Week | Deliverable | Exit gate |
+| --- | --- | --- |
+| 1 | Discovery; threat model; pinned dependencies; minimal app/DB/indexer; mainnet-fork order-construction spike. | Holder approves, signs, cancels and fulfils a test listing on a fork with exact 2.5/97.5 split. |
+| 2 | List/cancel/buy UX; validation API; indexer/reconciliation; observability. | Sepolia rehearsal and mainnet-fork suite pass; reconciliation prevents stale listings presenting as buyable. |
+| 3 | Complete unit/property/fuzz/negative tests; security review; runbook; freeze protocol/dependency scope. | Code freeze by week end; audit package complete; no features during audit. |
+| 4 | Auditor pass; fix findings only; regression; final independent rehearsal; mainnet deploy/verification and monitored soft launch. | Critical/high findings fixed/retested, otherwise postpone. |
+
+Four weeks is realistic only with this frozen zero-custom-contract scope, an auditor booked now, and focused full-stack help besides the Solidity dev. It is not realistic if “our own site” means a new settlement contract, upgradeability, bids/offers, collection-wide listings, ERC-20s, global royalty enforcement, or an auditor first engaged in week 4.
+
+## Tests and acceptance properties
+
+- `#3312` listed at `0.4 ETH` pays artist exactly `0.01 ETH`, seller exactly `0.39 ETH`, sends NFT to buyer, and leaves no app-held funds.
+- Only current approved owner can create a fillable listing. Reject invalid chain, collection, token ID, price, recipient, expiry, order type and signature.
+- Buyer cannot redirect NFT/artist fee; seller cannot alter price/consideration after signature.
+- Cancelled, expired, filled, transferred-away and approval-revoked orders do not fill. Seller can cancel when site is down.
+- Exact wei math holds for boundary/fuzz prices; consideration sums to advertised price.
+- Test contract-wallet seller/buyer behavior (EIP-1271 where supported), replacement listing, duplicate API submission, reorg, RPC outage and concurrent buyers.
+- Mainnet-fork tests use actual collection + pinned Seaport deployment; production transaction construction matches tested route.
+
+## Audit scope — send this package
+
+Request a **targeted integration/security review**, not a re-audit of Seaport. The audited external deployment is out of scope; every custom line and every assumption used to create/cancel/fulfil orders is in scope.
+
+1. **Scope statement and threat model**
+   - Requirements/non-goals; explicitly site-only fee enforcement.
+   - Actors/assets/trust: seller, buyer, artist multisig, collection admin, web/API/indexer/RPC operator and Seaport.
+   - Invariants: no custody; atomic NFT-for-ETH; immutable 250 bps artist recipient/split; intended collection/token only; seller-controlled cancellation; backend cannot steal/create valid listings.
+
+2. **Exact source artifact**
+   - Immutable git tag/commit; lockfiles; build settings; generated ABIs; Seaport SDK/version and pinned mainnet addresses.
+   - All TypeScript that builds EIP-712/Seaport orders, validates/submits listings, creates cancellation/fulfilment calldata and parses events.
+   - Frontend transaction/signature code, wallet/network gates, all critical API/serverless code, and configuration controlling protocol address, collection allowlist, artist recipient, RPC and secrets.
+
+3. **Collection evidence**
+   - Verified collection source/bytecode; proxy implementation/admin state; fork fixture; approval/transfer semantics; actual-token settlement proof; royalty/hook interaction.
+
+4. **Test and operations evidence**
+   - Unit, property/fuzz, fork and end-to-end results; static/dependency/SBOM reports; known limitations/risk acceptances.
+   - Deployment/verification checklist; monitoring/reorg policy; incident response; disable-site plan while preserving direct seller cancellation; artist multisig policy.
+
+5. **Specific reviewer questions**
+   - Can parameter confusion change collection, token, price, fee recipient/amount, duration, conduit or settlement recipient?
+   - Test signature-domain/chain replay, malleability/EIP-1271, cancellation/counter semantics, stale UI versus onchain validity, approval/conduit blast radius, reentrancy/callback/arbitrary-calldata paths, fee rounding/value conservation, event parsing/reorg/API tampering.
+   - Confirm product copy does not overclaim enforced royalties outside this marketplace.
+
+Audit acceptance: no open critical/high findings; every medium has an owner, written risk decision and regression test; auditor reviews final release commit after fixes. Any new contract or material dependency/address change after review needs another review and pushes launch.
+
+## Launch controls
+
+- Small announced beta; monitor failed fulfilments, cancelled/stale rate, event lag and artist payouts.
+- Verify deployed config on Etherscan; publish protocol, collection, artist and fee parameters.
+- Separate artist-multisig and API credentials. Site can be disabled in an incident, but never custody assets or remove direct onchain invalidation.

codex
Wrote [plan.md](plan.md).

Conclusion: 4 weeks viable only using Seaport; no custom settlement contract. 2.5% enforceable only for sales through site.

Feedback draft approval: praise — “Ship skill’s onchain/offchain litmus test prevented unnecessary marketplace-contract scope.”
diff --git a/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..287a908cb60b57bc9b207e0bd8307f182963623c
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194917Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,100 @@
+# Mainnet resale marketplace — four-week plan
+
+## Decision
+
+Build an **own-branded site on top of Seaport**, not a new marketplace contract. A seller signs a fixed-price ERC-721 listing; the signed order is stored/indexed offchain and is not an onchain listing or escrow. A buyer fulfils it on Ethereum mainnet. Settlement atomically transfers the NFT to the buyer, `2.5%` of the sale price to the artist wallet, and the remainder to the seller. Seaport supports multiple consideration recipients, including extra native-token recipients. [Seaport interface](https://docs.opensea.io/docs/seaport-interface)
+
+This is the credible four-week / one-Solidity-dev scope. Do **not** deploy a custom orderbook, escrow, upgrade proxy, fee manager, or collection contract. The site owns discovery and UX; Seaport owns signed-order validation, cancellation and atomic settlement.
+
+Important limit: `2.5%` can be guaranteed for sales settled through this site/order flow. It cannot be retroactively enforced on *every* resale of an already-minted standard ERC-721: a holder can transfer privately or use another marketplace. Confirm whether the collection has transfer hooks/restrictions before promising global enforcement. If it is ordinary ERC-721, call this a 2.5% site resale fee/artist share.
+
+## Scope and architecture
+
+### Onchain
+
+No new production Solidity contract, assuming the collection is a normal, transferable Ethereum-mainnet ERC-721. Pin the exact deployed Seaport contract/version and SDK version before implementation; do not accept a user-supplied protocol address.
+
+Each listing is a signed, full-fill-only, fixed-price order:
+
+- Offer: exactly one NFT from the fixed collection and token ID.
+- Consideration: ETH split into artist `price * 250 / 10,000` and seller `price - artistShare`.
+- Price is wei; no floating point.
+- Explicit start/end time, unique salt, mainnet chain ID and pinned protocol.
+- No criteria orders, bundles, Dutch auctions, ERC-20/WETH payments, bids, partial fills, zones, conduits, or custom hooks in v1.
+
+The seller gives only the needed NFT approval to the pinned Seaport path. Ownership stays with the seller until the buyer's fulfilment transaction. At fulfilment, Seaport requires approval and atomically transfers NFT and ETH; a transferred NFT, revoked approval, expired order, or cancelled order cannot settle.
+
+Cancellation must be an actual onchain Seaport cancellation/invalidation transaction, then immediately update the indexer. A database flag, revoked approval, or transfer-away is not a trustless cancellation: a prior signed order could still fill if it later becomes executable. Offer “cancel all listings” only when the seller is shown the Seaport counter/order invalidation blast radius.
+
+### Offchain
+
+- Web app: wallet connection; collection/token pages; list, approve, sign, cancel and buy; pending/success/error states; exact ETH, artist share and seller proceeds before signing/sending.
+- Listing service/database: accepts only validated signed orders for the collection; stores order hash, maker, token ID, full order, signature, status and timestamps. Cache/discovery only, never settlement authority.
+- Event indexer: consumes pinned Seaport fulfilment and cancellation/counter events; reconciles collection ownership/approvals; marks stale listings unavailable; handles reorgs. Re-simulate immediately before buyer submits.
+- Backend: no key that can move NFTs or funds. Authenticate/rate-limit writes; listing payloads are untrusted. A database outage may hide listings but cannot block direct onchain cancellation/settlement.
+
+### Pre-build discovery — Days 1–2, go/no-go
+
+Record and give the auditor:
+
+- NFT address, verified source, proxy/owner/admin roles, ERC-721 behavior, transfer restrictions/pauses, actual token range, and ERC-2981/creator-fee enforcement.
+- Artist payout: reviewed multisig, immutable in v1; 2.5% rounding-down rule in wei; a sane UI minimum price.
+- Seaport deployment address, version, SDK commit, ABI and supported route; fork-test all of them against mainnet.
+- Business decisions: ETH only; full-price listings; no bids; recommended duration 15 minutes–30 days; no platform fee; compliance/support/incident contacts.
+
+If the collection is nonstandard, has unresolved proxy-admin behavior, or requires all-marketplace royalty enforcement, stop and re-scope before coding/audit booking.
+
+## Build schedule
+
+| Week | Deliverable | Exit gate |
+| --- | --- | --- |
+| 1 | Discovery; threat model; pinned dependencies; minimal app/DB/indexer; mainnet-fork order-construction spike. | Holder approves, signs, cancels and fulfils a test listing on a fork with exact 2.5/97.5 split. |
+| 2 | List/cancel/buy UX; validation API; indexer/reconciliation; observability. | Sepolia rehearsal and mainnet-fork suite pass; reconciliation prevents stale listings presenting as buyable. |
+| 3 | Complete unit/property/fuzz/negative tests; security review; runbook; freeze protocol/dependency scope. | Code freeze by week end; audit package complete; no features during audit. |
+| 4 | Auditor pass; fix findings only; regression; final independent rehearsal; mainnet deploy/verification and monitored soft launch. | Critical/high findings fixed/retested, otherwise postpone. |
+
+Four weeks is realistic only with this frozen zero-custom-contract scope, an auditor booked now, and focused full-stack help besides the Solidity dev. It is not realistic if “our own site” means a new settlement contract, upgradeability, bids/offers, collection-wide listings, ERC-20s, global royalty enforcement, or an auditor first engaged in week 4.
+
+## Tests and acceptance properties
+
+- `#3312` listed at `0.4 ETH` pays artist exactly `0.01 ETH`, seller exactly `0.39 ETH`, sends NFT to buyer, and leaves no app-held funds.
+- Only current approved owner can create a fillable listing. Reject invalid chain, collection, token ID, price, recipient, expiry, order type and signature.
+- Buyer cannot redirect NFT/artist fee; seller cannot alter price/consideration after signature.
+- Cancelled, expired, filled, transferred-away and approval-revoked orders do not fill. Seller can cancel when site is down.
+- Exact wei math holds for boundary/fuzz prices; consideration sums to advertised price.
+- Test contract-wallet seller/buyer behavior (EIP-1271 where supported), replacement listing, duplicate API submission, reorg, RPC outage and concurrent buyers.
+- Mainnet-fork tests use actual collection + pinned Seaport deployment; production transaction construction matches tested route.
+
+## Audit scope — send this package
+
+Request a **targeted integration/security review**, not a re-audit of Seaport. The audited external deployment is out of scope; every custom line and every assumption used to create/cancel/fulfil orders is in scope.
+
+1. **Scope statement and threat model**
+   - Requirements/non-goals; explicitly site-only fee enforcement.
+   - Actors/assets/trust: seller, buyer, artist multisig, collection admin, web/API/indexer/RPC operator and Seaport.
+   - Invariants: no custody; atomic NFT-for-ETH; immutable 250 bps artist recipient/split; intended collection/token only; seller-controlled cancellation; backend cannot steal/create valid listings.
+
+2. **Exact source artifact**
+   - Immutable git tag/commit; lockfiles; build settings; generated ABIs; Seaport SDK/version and pinned mainnet addresses.
+   - All TypeScript that builds EIP-712/Seaport orders, validates/submits listings, creates cancellation/fulfilment calldata and parses events.
+   - Frontend transaction/signature code, wallet/network gates, all critical API/serverless code, and configuration controlling protocol address, collection allowlist, artist recipient, RPC and secrets.
+
+3. **Collection evidence**
+   - Verified collection source/bytecode; proxy implementation/admin state; fork fixture; approval/transfer semantics; actual-token settlement proof; royalty/hook interaction.
+
+4. **Test and operations evidence**
+   - Unit, property/fuzz, fork and end-to-end results; static/dependency/SBOM reports; known limitations/risk acceptances.
+   - Deployment/verification checklist; monitoring/reorg policy; incident response; disable-site plan while preserving direct seller cancellation; artist multisig policy.
+
+5. **Specific reviewer questions**
+   - Can parameter confusion change collection, token, price, fee recipient/amount, duration, conduit or settlement recipient?
+   - Test signature-domain/chain replay, malleability/EIP-1271, cancellation/counter semantics, stale UI versus onchain validity, approval/conduit blast radius, reentrancy/callback/arbitrary-calldata paths, fee rounding/value conservation, event parsing/reorg/API tampering.
+   - Confirm product copy does not overclaim enforced royalties outside this marketplace.
+
+Audit acceptance: no open critical/high findings; every medium has an owner, written risk decision and regression test; auditor reviews final release commit after fixes. Any new contract or material dependency/address change after review needs another review and pushes launch.
+
+## Launch controls
+
+- Small announced beta; monitor failed fulfilments, cancelled/stale rate, event lag and artist payouts.
+- Verify deployed config on Etherscan; publish protocol, collection, artist and fee parameters.
+- Separate artist-multisig and API credentials. Site can be disabled in an incident, but never custody assets or remove direct onchain invalidation.

tokens used
39,860
Wrote [plan.md](plan.md).

Conclusion: 4 weeks viable only using Seaport; no custom settlement contract. 2.5% enforceable only for sales through site.

Feedback draft approval: praise — “Ship skill’s onchain/offchain litmus test prevented unnecessary marketplace-contract scope.”
