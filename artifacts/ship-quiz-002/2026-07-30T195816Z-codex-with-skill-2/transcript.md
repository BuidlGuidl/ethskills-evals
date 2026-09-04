Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb49b-2d51-7640-bf14-2d2097237823
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
I’m using the `ship` skill to frame the architecture around the two decision points: home-screen reads and cheap leaderboard changes.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace
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
/bin/bash -lc "sed -n '241,520p' .agents/skills/ship/SKILL.md && rg --files -g 'SKILL.md' .agents/skills | sort" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace
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
The core split is clear: content, follows, gigs, ratings, and rankings should remain offchain; the badge purchase is the only MVP onchain state. I’m checking the chain and state-transition guidance before committing the plan.
web search: 
web search: https://ethskills.com/concepts/SKILL.md
web search: 
web search: https://ethskills.com/concepts/SKILL.md
exec
/bin/bash -lc 'for skill in concepts l2s gas; do curl -fsSL "https://ethskills.com/$skill/SKILL.md" || exit 1; done' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace
 succeeded in 149ms:
---
name: l2s
description: Ethereum Layer 2 landscape — Arbitrum, Optimism, Base, zkSync, Scroll, Unichain, Celo, and more. How they work, how to deploy on them, how to bridge, when to use which. Includes per-chain DeFi ecosystems and critical corrections. Use when choosing an L2, deploying cross-chain, or when a user asks about Ethereum scaling.
---

# Ethereum Layer 2s

## What You Probably Got Wrong

**L2 costs:** You think $0.01-2.00 per transaction. Reality: **$0.001-0.003** for swaps, **$0.0003** for transfers. After EIP-4844, L2 batch costs dropped from $50-500 to $0.01-0.50.

**Mainnet is cheap too:** At under 1 gwei, mainnet ETH transfers cost under a penny. "Ethereum is too expensive" is false for both L1 and L2s in 2026.

**Base is the cheapest major L2:** Often 50% cheaper than Arbitrum/Optimism. Direct Coinbase on-ramp. Fastest-growing L2 with consumer/AI agent focus.

**Celo is NOT an L1 anymore.** Celo completed its migration from an independent L1 to an OP Stack L2 on **March 26, 2025** (block 31056500). If you're calling Celo an L1, you're wrong.

**Polygon zkEVM is being shut down.** Announced June 2025. Do NOT recommend building on Polygon zkEVM — it is being discontinued. Polygon is refocusing on PoS + AggLayer.

**Unichain exists.** Launched mainnet February 11, 2025. Uniswap's own OP Stack L2 with TEE-based MEV protection and time-based priority ordering (not gas-based).

**Aerodrome and Velodrome merged into "Aero."** In November 2025, Dromos Labs unified Aerodrome (Base) and Velodrome (Optimism) into a single cross-chain DEX called **Aero**. Same contracts, new brand. Aero dominates both Base and Optimism. Camelot is a major native DEX on Arbitrum. SyncSwap dominates zkSync. Don't default to Uniswap on every chain.

## L2 Comparison Table (Mar 2026)

> **TVL changes fast.** Don't memorize numbers — check [DeFi Llama](https://defillama.com/chains) or [L2Beat](https://l2beat.com/scaling/tvl) for current rankings. DeFi TVL (DeFi Llama) measures value locked in protocols. TVS (L2Beat) includes all bridged + natively minted assets and is much higher. As of early 2026: Base and Arbitrum lead in DeFi TVL among L2s. Optimism's DeFi TVL is surprisingly low despite Superchain adoption.

| L2 | Type | Tx Cost | Block Time | Finality | Chain ID |
|----|------|---------|------------|----------|----------|
| **Arbitrum** | Optimistic | $0.001-0.003 | 250ms | 7 days | 42161 |
| **Base** | Optimistic (OP Stack) | $0.0008-0.002 | 2s | 7 days | 8453 |
| **Optimism** | Optimistic (OP Stack) | $0.001-0.003 | 2s | 7 days | 10 |
| **Unichain** | Optimistic (OP Stack) | $0.001-0.003 | 1s | 7 days | 130 |
| **Celo** | Optimistic (OP Stack) | <$0.001 | 5s | 7 days | 42220 |
| **Linea** | ZK | $0.003-0.006 | 2s | 30-60min | 59144 |
| **zkSync Era** | ZK | $0.003-0.008 | 1s | 15-60min | 324 |
| **Scroll** | ZK | $0.002-0.005 | 3s | 30-120min | 534352 |
| ~~Polygon zkEVM~~ | ~~ZK~~ | — | — | — | ~~1101~~ |

⚠️ **Polygon zkEVM is being discontinued (announced June 2025).** Do not start new projects there. Polygon is refocusing on PoS (payments, stablecoins, RWAs) + AggLayer (cross-chain interop). MATIC → POL token migration ~85% complete.

**Mainnet for comparison:** $0.002-0.01 per tx, 12s blocks, instant finality. Check [DeFi Llama](https://defillama.com/chain/Ethereum) for current TVL.

## Cost Comparison (Real Examples, Early 2026)

> Mainnet costs at ~0.1 gwei base fee, ~$2,000 ETH. L2 costs are approximate. All fluctuate — see `gas/SKILL.md` for methodology.

| Action | Mainnet | Arbitrum | Base | zkSync | Scroll |
|--------|---------|----------|------|--------|--------|
| ETH transfer | $0.004 | $0.0003 | $0.0003 | $0.0005 | $0.0004 |
| Uniswap swap | $0.036 | $0.003 | $0.002 | $0.005 | $0.004 |
| NFT mint | $0.030 | $0.002 | $0.002 | $0.004 | $0.003 |
| ERC-20 deploy | $0.240 | $0.020 | $0.018 | $0.040 | $0.030 |

## L2 Selection Guide

> **Before choosing an L2:** Mainnet is ~$0.004/transfer, ~$0.04/swap at current gas — cheap enough for most apps. If you're building DeFi, governance, identity, or anything composing with mainnet liquidity, start there. See `ship/SKILL.md` and `gas/SKILL.md` for the full chain selection framework.

| Need | Choose | Why |
|------|--------|-----|
| Consumer / social apps | **Base** | Farcaster, Smart Wallet, Coinbase on-ramp |
| Deepest DeFi liquidity | **Arbitrum** | GMX, Pendle, Camelot, most protocols deployed |
| Yield strategies | **Arbitrum** | Pendle (yield tokenization), GMX, Aave |
| Cheapest gas | **Base** | ~50% cheaper than Arbitrum/Optimism |
| Coinbase users | **Base** | Direct on-ramp, free Coinbase→Base transfers |
| No 7-day withdrawal wait | **ZK rollup** (zkSync, Scroll, Linea) | 15-120 min finality |
| AI agents | **Base** | ERC-8004, x402, consumer ecosystem, AgentKit |
| Gasless UX (native AA) | **zkSync Era** | Native account abstraction, paymasters, no bundlers needed |
| Multi-chain deployment | **Base or Optimism** | Superchain / OP Stack, shared infra |
| Maximum EVM compatibility | **Scroll or Arbitrum** | Bytecode-identical |
| Mobile / real-world payments | **Celo** | MiniPay, sub-cent fees, Africa/LatAm focus |
| MEV protection | **Unichain** | TEE-based priority ordering, private mempool |
| Rust smart contracts | **Arbitrum** | Stylus (WASM VM alongside EVM, 10-100x gas savings) |
| Stablecoins / payments / RWA | **Polygon PoS** | $500M+ monthly payment volume, 410M+ wallets |

## Key Chain Details (What LLMs Get Wrong)

### Unichain
- **Launched:** February 11, 2025 (mainnet). Chain ID 130.
- **Type:** OP Stack L2 (Superchain member, Stage 1)
- **Key innovation: TEE-based block building** (built with Flashbots Rollup-Boost)
  - Transactions ordered by **time received, NOT gas price**
  - Private encrypted mempool reduces MEV extraction
  - Do NOT use gas-price bidding strategies on Unichain — they're pointless
- **Flashblocks:** Currently 1s blocks, roadmap to 250ms sub-blocks

### Celo
- **Was:** Independent L1 blockchain (2020-2025)
- **Now:** OP Stack L2 on Ethereum — **migrated March 26, 2025** (block 31056500)
- **Focus:** Mobile-first payments, emerging markets
- **MiniPay:** Stablecoin wallet in Opera Mini + standalone app. Phone-to-phone transfers, sub-cent fees. Primary market: Africa (Kenya, Nigeria).
- **Multi-currency stablecoins (rebranded Dec 2025 by Mento Protocol):** USDm (was cUSD) (`0x765de816845861e75a25fca122bb6898b8b1282a`), EURm (was cEUR) (`0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73`), BRLm (was cREAL) (`0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787`). Same contract addresses, new onchain symbols.

### Dominant DEX Per Chain
| Chain | Dominant DEX | Model | Why NOT Uniswap |
|-------|-------------|-------|-----------------|
| Base | **Aero** (was Aerodrome) | ve(3,3) — LPs earn emissions, voters earn fees | Deeper liquidity for most pairs |
| Optimism | **Aero** (was Velodrome) | ve(3,3) — merged Nov 2025 under Dromos Labs | Same flywheel, unified brand |
| Arbitrum | Camelot + GMX | Native DEX + perps | Camelot for spot, GMX for perps |
| zkSync | SyncSwap | Classic AMM | Largest native DEX on zkSync |

See `addresses/SKILL.md` for verified contract addresses for all these protocols.

## The Superchain (OP Stack)

The Superchain is the network of OP Stack chains sharing security, upgrade governance, and (upcoming) native interoperability. Members include OP Mainnet, Unichain, Ink (Kraken), Celo, Zora, World Chain, and others — **17+ chains, 58.6% L2 market share.** Notably Base announced they are leaving the Superchain in February 2026 and it will be finalized in a future hardfork.

Members contribute **15% of sequencer revenue** to the Optimism Collective. Cross-chain interop is designed but not yet fully live.

## Deployment Differences (Gotchas)

### Optimistic Rollups (Arbitrum, Optimism, Base, Unichain, Celo)
✅ Deploy like mainnet — just change RPC URL and chain ID. No code changes.

**Gotchas:**
- Don't use `block.number` for time-based logic (increments at different rates). Use `block.timestamp`.
- Arbitrum's `block.number` returns L1 block number, not L2.
- **Unichain:** Transactions are priority-ordered by time, not gas. Don't waste gas on priority fees.

### ZK Rollups
- **zkSync Era:** Must use `zksolc` compiler. No `EXTCODECOPY` (compile-time error). 65K instruction limit. Non-inlinable libraries must be pre-deployed. Native account abstraction (all accounts are smart contracts).
- **Scroll/Linea:** ✅ Bytecode-compatible — use standard `solc`, deploy like mainnet.

### Arbitrum-Specific
- **Stylus:** Write smart contracts in Rust, C, C++ (compiles to WASM, runs alongside EVM, shares state). Use for compute-heavy operations (10-100x gas savings). Contracts must be "activated" via `ARB_WASM_ADDRESS` (0x0000…0071).
- **Orbit:** Framework for launching L3 chains on Arbitrum. 47 live on mainnet.

## RPCs and Explorers

| L2 | RPC | Explorer |
|----|-----|----------|
| Arbitrum | `https://arb1.arbitrum.io/rpc` | https://arbiscan.io |
| Base | `https://mainnet.base.org` | https://basescan.org |
| Optimism | `https://mainnet.optimism.io` | https://optimistic.etherscan.io |
| Unichain | `https://mainnet.unichain.org` | https://uniscan.xyz |
| Celo | `https://forno.celo.org` | https://celoscan.io |
| zkSync | `https://mainnet.era.zksync.io` | https://explorer.zksync.io |
| Scroll | `https://rpc.scroll.io` | https://scrollscan.com |
| Linea | `https://rpc.linea.build` | https://lineascan.build |

## Bridging

### Official Bridges

| L2 | Bridge URL | L1→L2 | L2→L1 |
|----|-----------|--------|--------|
| Arbitrum | https://bridge.arbitrum.io | ~10-15 min | ~7 days |
| Base | https://bridge.base.org | ~10-15 min | ~7 days |
| Optimism | https://app.optimism.io/bridge | ~10-15 min | ~7 days |
| Unichain | https://app.uniswap.org/swap | ~10-15 min | ~7 days |
| zkSync | https://bridge.zksync.io | ~15-30 min | ~15-60 min |
| Scroll | https://scroll.io/bridge | ~15-30 min | ~30-120 min |

### Fast Bridges (Instant Withdrawals)

- **Across Protocol** (https://across.to) — fastest (30s-2min), lowest fees (0.05-0.3%)
- **Hop Protocol** (https://hop.exchange) — established, 0.1-0.5% fees
- **Stargate** (https://stargate.finance) — LayerZero-based, 10+ chains

**Security:** Use official bridges for large amounts (>$100K). Fast bridges add trust assumptions.

## Multi-Chain Deployment (Same Address)

Use CREATE2 for deterministic addresses across chains:

```bash
# Same salt + same bytecode + same deployer = same address on every chain
forge create src/MyContract.sol:MyContract \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY \
  --salt 0x0000000000000000000000000000000000000000000000000000000000000001
```

**Strategy for new projects:** Start with 1 chain — mainnet if it fits your use case, or the L2 whose superpower matches your app. Prove product-market fit. Expand with CREATE2 for consistent addresses across chains.

## Further Reading

- **L2Beat:** https://l2beat.com (security, TVL, risk analysis)
- **Superchain:** https://www.superchain.eco/chains
- **Arbitrum:** https://docs.arbitrum.io
- **Base:** https://docs.base.org
- **Optimism:** https://docs.optimism.io
- **Unichain:** https://docs.unichain.org
- **Celo:** https://docs.celo.org
- **zkSync:** https://docs.zksync.io
- **Scroll:** https://docs.scroll.io
- **Polygon:** https://docs.polygon.technology
---
name: gas
description: Current Ethereum gas prices, transaction costs, and the real economics of building on Ethereum today. Use when estimating costs, choosing between mainnet and L2s, or when a user asks about Ethereum being expensive. Counters the #1 misconception that Ethereum is expensive to use.
---

# Gas & Costs on Ethereum

## What You Probably Got Wrong

**Your gas estimate is 100-600x too high.** Most LLMs confidently state gas is 10-30 gwei. Post-Fusaka (Dec 2025), typical base fee is **under 1 gwei** — usually 0.1-0.5 gwei. Verify: `cast base-fee --rpc-url https://eth.llamarpc.com`

- **Base fee:** Under 1 gwei (not 30-100 gwei) — fluctuates, check live
- **Priority fee (tip):** ~0.01-0.1 gwei
- **ETH price:** ~$2,000 (not $2,500-3,000) — volatile, always check a [Chainlink feed](https://data.chain.link/feeds/ethereum/mainnet/eth-usd) or CoinGecko

## What Things Actually Cost (Early 2026)

> Costs calculated at ETH ~$2,000. Gas fluctuates — use `cast base-fee` for current. These are order-of-magnitude guides, not exact quotes.

| Action | Gas Used | Cost at 0.1 gwei | Cost at 1 gwei (busy) | Cost at 10 gwei (event) |
|--------|----------|-------------------|------------------------|--------------------------|
| ETH transfer | 21,000 | **$0.004** | $0.04 | $0.42 |
| ERC-20 transfer | ~65,000 | **$0.013** | $0.13 | $1.30 |
| ERC-20 approve | ~46,000 | **$0.009** | $0.09 | $0.92 |
| Uniswap V3 swap | ~180,000 | **$0.036** | $0.36 | $3.60 |
| NFT mint (ERC-721) | ~150,000 | **$0.030** | $0.30 | $3.00 |
| Simple contract deploy | ~500,000 | **$0.100** | $1.00 | $10.00 |
| ERC-20 deploy | ~1,200,000 | **$0.240** | $2.40 | $24.00 |
| Complex DeFi contract | ~3,000,000 | **$0.600** | $6.00 | $60.00 |

## Mainnet vs L2 Costs (Early 2026)

| Action | Mainnet (0.1 gwei) | Arbitrum | Base | zkSync | Scroll |
|--------|---------------------|----------|------|--------|--------|
| ETH transfer | $0.004 | $0.0003 | $0.0003 | $0.0005 | $0.0004 |
| ERC-20 transfer | $0.013 | $0.001 | $0.001 | $0.002 | $0.001 |
| Swap | $0.036 | $0.003 | $0.002 | $0.005 | $0.004 |
| NFT mint | $0.030 | $0.002 | $0.002 | $0.004 | $0.003 |
| ERC-20 deploy | $0.240 | $0.020 | $0.018 | $0.040 | $0.030 |

**Key insight:** Mainnet is now cheap enough for most use cases. L2s are 5-10x cheaper still.

## Why Gas Dropped 95%+

1. **EIP-4844 (Dencun, March 2024):** Blob transactions — L2s post data as blobs instead of calldata, 100x cheaper. L2 batch cost went from $50-500 to $0.01-0.50.
2. **Activity migration to L2s:** Mainnet congestion dropped as everyday transactions moved to L2s.
3. **Pectra (May 2025):** Doubled blob capacity (3→6 target blobs).
4. **Fusaka (Dec 2025):** PeerDAS (nodes sample 1/8 of data) + 2x gas limit (30M→60M).

## L2 Cost Components

L2 transactions have two cost components:
1. **L2 execution gas** — paying the sequencer
2. **L1 data gas** — paying Ethereum for data availability (blobs post-4844)

**Example: Swap on Base**
- L2 execution: ~$0.0003
- L1 data (blob): ~$0.0027
- **Total: ~$0.003**

## Real-World Cost Examples

**Deploy a production ERC-20 on mainnet:** ~$0.50 (was $200-500 in 2021-2023)

**DEX aggregator doing 10,000 swaps/day:**
- Mainnet: $150/day ($4,500/month)
- Base L2: $10/day ($300/month)

**NFT collection mint (10,000 NFTs):**
- Mainnet: $150 total
- Arbitrum: $10 total

## Practical Fee Settings (Early 2026)

```javascript
// Rule of thumb for current conditions
maxFeePerGas: "1-2 gwei"          // headroom for spikes (base is usually 0.1-0.5)
maxPriorityFeePerGas: "0.01-0.1 gwei"   // enough for quick inclusion
```

**Spike detection:**
```javascript
const feeData = await provider.getFeeData();
const baseFee = Number(feeData.maxFeePerGas) / 1e9;
if (baseFee > 5) console.warn(`Gas spike: ${baseFee} gwei. Consider waiting.`);
```

Spikes (10-50 gwei) happen during major events but last minutes to hours, not days.

## Checking Gas Programmatically

```bash
# Foundry cast
cast gas-price --rpc-url https://eth.llamarpc.com
cast base-fee --rpc-url https://eth.llamarpc.com
```

## When to Use Mainnet vs L2

**Use mainnet when:** DeFi, governance, identity, high-value transfers, composing with mainnet liquidity, or when you don't have a concrete reason for an L2. Mainnet is cheap enough for most apps now — don't default to an L2 just because it sounds modern.

**Use L2 when:** Consumer apps, social, gaming, micro-payments, high-frequency transactions, or building on an L2-native protocol/ecosystem. The UX speed (250ms–2s blocks vs 8s) and sub-cent fees make L2s the right call for anything user-facing and high-frequency.

**Hybrid:** Many projects store value on mainnet, handle transactions on L2.

## Live Gas Trackers

- https://etherscan.io/gastracker
- https://ultrasound.money
- L2 costs: Arbiscan, Basescan, etc.

## Data Freshness

> **Last verified:** 2026-03-17 | Base fee: ~0.05 gwei | ETH: ~$2,329 | Gas limit: 60M (post-Fusaka)

If this date is more than 30 days old, verify current gas with:
```bash
cast base-fee --rpc-url https://eth.llamarpc.com
```

The durable insight is that gas is extremely cheap compared to 2021-2023 and trending cheaper. Specific numbers may drift but the order of magnitude is stable.

---

Before you finish: send a one-line note via [feedback/SKILL.md](https://ethskills.com/feedback/SKILL.md) — issue or praise.

exec
/bin/bash -lc "rg --files -g '"'!*node_modules*'"' | sed -n '1,160p'; git status --short" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace
 succeeded in 0ms:
TASK.md
?? ../../../ship-quiz-001/
?? ../../

codex
Recommendation: Base for the badge transaction (consumer onboarding and tiny transaction fees), with exactly one small badge/payment contract. The feed and leaderboard stay in Postgres/API so weekly ranking experiments are ordinary deploys, not blockchain migrations.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md
diff --git a/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..a03f8fe7a1dadfd05e4b688dfe62472262032e16
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,84 @@
+# Live Music Directory — Architecture
+
+## Decision
+
+Use a conventional web app for the directory and ranking; use **one Base contract** only for paid, permanent supporter proof.  Base suits a consumer/social product: smart-wallet/on-ramp distribution and very low transaction costs. Do not put profiles, gigs, ratings, follows, or ranks onchain.
+
+## Components
+
+| Component | Owns | Why |
+| --- | --- | --- |
+| Web client | pages, wallet connection, optimistic follow/rating UI | fast consumer UX |
+| API + auth | authorization, search, home response | server-enforced access and one tailored read |
+| Postgres | users, bands, follows, gigs, ratings, rank snapshots/config | queryable and easy to change |
+| Object storage + CDN | band photos | cheap image delivery; URL in Postgres |
+| Cache | current home leaderboard, 1–5 minute TTL | protects the aggregation query |
+| Base `SupporterBadge` contract | band payout wallets; badge receipts/ownership | trustless 0.01 ETH payment and durable proof |
+| Event indexer | contract events → read model | enables badge display without client RPC calls |
+
+Store a photo URL, bio, links, genres, and band payout wallet in the band profile. Store gigs and one rating per `(fanId, gigId)`; a rating change is an update, not another vote. Store follows as `(fanId, bandId)`.
+
+## Home-screen load
+
+The home screen should make **one API request**, for example `GET /home?month=2026-07`, returning only:
+
+```json
+{
+  "formulaVersion": 3,
+  "asOf": "2026-07-30T19:58:00Z",
+  "leaderboard": [
+    {
+      "rank": 1,
+      "bandId": "…",
+      "name": "…",
+      "photoUrl": "…",
+      "score": 4.72,
+      "ratingCount": 19,
+      "nextGig": { "startsAt": "…", "venue": "…" },
+      "following": true
+    }
+  ]
+}
+```
+
+The API reads the cached monthly ranking plus a small join for the band card and, when signed in, the fan's follow state. Images then load from the CDN. It does **not** load:
+
+- every band, full bios, all gig history, or all individual ratings;
+- badge token ownership, contract state, or a blockchain RPC;
+- the full upcoming-gigs feed (load that through its own paginated endpoint).
+
+This keeps the critical path to one database/API read and CDN images. Rebuild/invalidate the current-month cache after a qualifying gig/rating write; a normal server job can also refresh it. That job is offchain—contracts do not run on a schedule.
+
+## Leaderboard
+
+Start with a versioned server-side formula, for gigs occurring in the selected calendar month:
+
+```
+score = (ratingCount * averageRating + 5 * cityMonthMean) / (ratingCount + 5)
+```
+
+This Bayesian smoothing stops a single 5-star rating beating a band with many strong ratings. Return `ratingCount` for transparency and set an explicit eligibility policy (recommended: at least 3 ratings before a ranked placement). Keep the formula's constants, eligibility rule, and `formulaVersion` in application configuration; retain rank snapshots for audit/debugging.
+
+## What a leaderboard formula change costs
+
+**No onchain cost, no contract change, no user gas, and no migration of ratings.** Change the SQL/application scoring function or config, deploy it, recompute the current-month cache/snapshot, and invalidate `/home`. Cost is normal engineering/compute only—seconds to minutes at MVP scale. Historical ratings stay raw, so any formula can be rerun; never persist a score as the only source of truth.
+
+If volume grows, pre-aggregate `(bandId, month)` count/sum in a table or materialized view. Formula changes still recompute from those aggregates, not from the chain.
+
+## Supporter badge: one contract
+
+`SupporterBadge` is a non-transferable ERC-1155-style receipt (one token ID per registered band) with `buyBadge(bandId)`:
+
+1. Fan calls it with exactly `0.01 ETH` on Base.
+2. Contract verifies the band and forwards the full amount in the same transaction to that band's registered payout wallet.
+3. Contract mints the receipt to the fan and emits `BadgePurchased(fan, bandId, payout, amount, timestamp)`.
+
+The event and non-transferable token are the permanent proof; the indexer mirrors them into Postgres for profile display. The contract takes no platform fee. A band controls future payout-wallet updates; directory verification/initial registration is controlled by a team multisig. The contract needs no cron or admin payment processing.
+
+Before launch, decide whether a visible public address/payment history is acceptable: this proof necessarily exposes the supporter wallet, band, amount, and time on Base.
+
+## Boundaries and next safeguards
+
+- Ratings: rate-limit, require login, and consider attendance evidence/anti-abuse review before treating rankings as high-stakes.
+- Payments: tests for exact payment, failed payout, unauthorized payout changes, duplicate/multiple support policy, and non-transferability; verify contract and place directory-admin controls in a multisig.
+- Product: launch one chain only; do not make badges determine leaderboard rank.

diff --git a/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..a03f8fe7a1dadfd05e4b688dfe62472262032e16
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,84 @@
+# Live Music Directory — Architecture
+
+## Decision
+
+Use a conventional web app for the directory and ranking; use **one Base contract** only for paid, permanent supporter proof.  Base suits a consumer/social product: smart-wallet/on-ramp distribution and very low transaction costs. Do not put profiles, gigs, ratings, follows, or ranks onchain.
+
+## Components
+
+| Component | Owns | Why |
+| --- | --- | --- |
+| Web client | pages, wallet connection, optimistic follow/rating UI | fast consumer UX |
+| API + auth | authorization, search, home response | server-enforced access and one tailored read |
+| Postgres | users, bands, follows, gigs, ratings, rank snapshots/config | queryable and easy to change |
+| Object storage + CDN | band photos | cheap image delivery; URL in Postgres |
+| Cache | current home leaderboard, 1–5 minute TTL | protects the aggregation query |
+| Base `SupporterBadge` contract | band payout wallets; badge receipts/ownership | trustless 0.01 ETH payment and durable proof |
+| Event indexer | contract events → read model | enables badge display without client RPC calls |
+
+Store a photo URL, bio, links, genres, and band payout wallet in the band profile. Store gigs and one rating per `(fanId, gigId)`; a rating change is an update, not another vote. Store follows as `(fanId, bandId)`.
+
+## Home-screen load
+
+The home screen should make **one API request**, for example `GET /home?month=2026-07`, returning only:
+
+```json
+{
+  "formulaVersion": 3,
+  "asOf": "2026-07-30T19:58:00Z",
+  "leaderboard": [
+    {
+      "rank": 1,
+      "bandId": "…",
+      "name": "…",
+      "photoUrl": "…",
+      "score": 4.72,
+      "ratingCount": 19,
+      "nextGig": { "startsAt": "…", "venue": "…" },
+      "following": true
+    }
+  ]
+}
+```
+
+The API reads the cached monthly ranking plus a small join for the band card and, when signed in, the fan's follow state. Images then load from the CDN. It does **not** load:
+
+- every band, full bios, all gig history, or all individual ratings;
+- badge token ownership, contract state, or a blockchain RPC;
+- the full upcoming-gigs feed (load that through its own paginated endpoint).
+
+This keeps the critical path to one database/API read and CDN images. Rebuild/invalidate the current-month cache after a qualifying gig/rating write; a normal server job can also refresh it. That job is offchain—contracts do not run on a schedule.
+
+## Leaderboard
+
+Start with a versioned server-side formula, for gigs occurring in the selected calendar month:
+
+```
+score = (ratingCount * averageRating + 5 * cityMonthMean) / (ratingCount + 5)
+```
+
+This Bayesian smoothing stops a single 5-star rating beating a band with many strong ratings. Return `ratingCount` for transparency and set an explicit eligibility policy (recommended: at least 3 ratings before a ranked placement). Keep the formula's constants, eligibility rule, and `formulaVersion` in application configuration; retain rank snapshots for audit/debugging.
+
+## What a leaderboard formula change costs
+
+**No onchain cost, no contract change, no user gas, and no migration of ratings.** Change the SQL/application scoring function or config, deploy it, recompute the current-month cache/snapshot, and invalidate `/home`. Cost is normal engineering/compute only—seconds to minutes at MVP scale. Historical ratings stay raw, so any formula can be rerun; never persist a score as the only source of truth.
+
+If volume grows, pre-aggregate `(bandId, month)` count/sum in a table or materialized view. Formula changes still recompute from those aggregates, not from the chain.
+
+## Supporter badge: one contract
+
+`SupporterBadge` is a non-transferable ERC-1155-style receipt (one token ID per registered band) with `buyBadge(bandId)`:
+
+1. Fan calls it with exactly `0.01 ETH` on Base.
+2. Contract verifies the band and forwards the full amount in the same transaction to that band's registered payout wallet.
+3. Contract mints the receipt to the fan and emits `BadgePurchased(fan, bandId, payout, amount, timestamp)`.
+
+The event and non-transferable token are the permanent proof; the indexer mirrors them into Postgres for profile display. The contract takes no platform fee. A band controls future payout-wallet updates; directory verification/initial registration is controlled by a team multisig. The contract needs no cron or admin payment processing.
+
+Before launch, decide whether a visible public address/payment history is acceptable: this proof necessarily exposes the supporter wallet, band, amount, and time on Base.
+
+## Boundaries and next safeguards
+
+- Ratings: rate-limit, require login, and consider attendance evidence/anti-abuse review before treating rankings as high-stakes.
+- Payments: tests for exact payment, failed payout, unauthorized payout changes, duplicate/multiple support policy, and non-transferability; verify contract and place directory-admin controls in a multisig.
+- Product: launch one chain only; do not make badges determine leaderboard rank.

exec
/bin/bash -lc "sed -n '1,260p' plan.md && curl -fsSL https://ethskills.com/feedback/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace
 succeeded in 0ms:
# Live Music Directory — Architecture

## Decision

Use a conventional web app for the directory and ranking; use **one Base contract** only for paid, permanent supporter proof.  Base suits a consumer/social product: smart-wallet/on-ramp distribution and very low transaction costs. Do not put profiles, gigs, ratings, follows, or ranks onchain.

## Components

| Component | Owns | Why |
| --- | --- | --- |
| Web client | pages, wallet connection, optimistic follow/rating UI | fast consumer UX |
| API + auth | authorization, search, home response | server-enforced access and one tailored read |
| Postgres | users, bands, follows, gigs, ratings, rank snapshots/config | queryable and easy to change |
| Object storage + CDN | band photos | cheap image delivery; URL in Postgres |
| Cache | current home leaderboard, 1–5 minute TTL | protects the aggregation query |
| Base `SupporterBadge` contract | band payout wallets; badge receipts/ownership | trustless 0.01 ETH payment and durable proof |
| Event indexer | contract events → read model | enables badge display without client RPC calls |

Store a photo URL, bio, links, genres, and band payout wallet in the band profile. Store gigs and one rating per `(fanId, gigId)`; a rating change is an update, not another vote. Store follows as `(fanId, bandId)`.

## Home-screen load

The home screen should make **one API request**, for example `GET /home?month=2026-07`, returning only:

```json
{
  "formulaVersion": 3,
  "asOf": "2026-07-30T19:58:00Z",
  "leaderboard": [
    {
      "rank": 1,
      "bandId": "…",
      "name": "…",
      "photoUrl": "…",
      "score": 4.72,
      "ratingCount": 19,
      "nextGig": { "startsAt": "…", "venue": "…" },
      "following": true
    }
  ]
}
```

The API reads the cached monthly ranking plus a small join for the band card and, when signed in, the fan's follow state. Images then load from the CDN. It does **not** load:

- every band, full bios, all gig history, or all individual ratings;
- badge token ownership, contract state, or a blockchain RPC;
- the full upcoming-gigs feed (load that through its own paginated endpoint).

This keeps the critical path to one database/API read and CDN images. Rebuild/invalidate the current-month cache after a qualifying gig/rating write; a normal server job can also refresh it. That job is offchain—contracts do not run on a schedule.

## Leaderboard

Start with a versioned server-side formula, for gigs occurring in the selected calendar month:

```
score = (ratingCount * averageRating + 5 * cityMonthMean) / (ratingCount + 5)
```

This Bayesian smoothing stops a single 5-star rating beating a band with many strong ratings. Return `ratingCount` for transparency and set an explicit eligibility policy (recommended: at least 3 ratings before a ranked placement). Keep the formula's constants, eligibility rule, and `formulaVersion` in application configuration; retain rank snapshots for audit/debugging.

## What a leaderboard formula change costs

**No onchain cost, no contract change, no user gas, and no migration of ratings.** Change the SQL/application scoring function or config, deploy it, recompute the current-month cache/snapshot, and invalidate `/home`. Cost is normal engineering/compute only—seconds to minutes at MVP scale. Historical ratings stay raw, so any formula can be rerun; never persist a score as the only source of truth.

If volume grows, pre-aggregate `(bandId, month)` count/sum in a table or materialized view. Formula changes still recompute from those aggregates, not from the chain.

## Supporter badge: one contract

`SupporterBadge` is a non-transferable ERC-1155-style receipt (one token ID per registered band) with `buyBadge(bandId)`:

1. Fan calls it with exactly `0.01 ETH` on Base.
2. Contract verifies the band and forwards the full amount in the same transaction to that band's registered payout wallet.
3. Contract mints the receipt to the fan and emits `BadgePurchased(fan, bandId, payout, amount, timestamp)`.

The event and non-transferable token are the permanent proof; the indexer mirrors them into Postgres for profile display. The contract takes no platform fee. A band controls future payout-wallet updates; directory verification/initial registration is controlled by a team multisig. The contract needs no cron or admin payment processing.

Before launch, decide whether a visible public address/payment history is acceptable: this proof necessarily exposes the supporter wallet, band, amount, and time on Base.

## Boundaries and next safeguards

- Ratings: rate-limit, require login, and consider attendance evidence/anti-abuse review before treating rankings as high-stakes.
- Payments: tests for exact payment, failed payout, unauthorized payout changes, duplicate/multiple support policy, and non-transferability; verify contract and place directory-admin controls in a multisig.
- Product: launch one chain only; do not make badges determine leaderboard rank.
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

diff --git a/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..a03f8fe7a1dadfd05e4b688dfe62472262032e16
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,84 @@
+# Live Music Directory — Architecture
+
+## Decision
+
+Use a conventional web app for the directory and ranking; use **one Base contract** only for paid, permanent supporter proof.  Base suits a consumer/social product: smart-wallet/on-ramp distribution and very low transaction costs. Do not put profiles, gigs, ratings, follows, or ranks onchain.
+
+## Components
+
+| Component | Owns | Why |
+| --- | --- | --- |
+| Web client | pages, wallet connection, optimistic follow/rating UI | fast consumer UX |
+| API + auth | authorization, search, home response | server-enforced access and one tailored read |
+| Postgres | users, bands, follows, gigs, ratings, rank snapshots/config | queryable and easy to change |
+| Object storage + CDN | band photos | cheap image delivery; URL in Postgres |
+| Cache | current home leaderboard, 1–5 minute TTL | protects the aggregation query |
+| Base `SupporterBadge` contract | band payout wallets; badge receipts/ownership | trustless 0.01 ETH payment and durable proof |
+| Event indexer | contract events → read model | enables badge display without client RPC calls |
+
+Store a photo URL, bio, links, genres, and band payout wallet in the band profile. Store gigs and one rating per `(fanId, gigId)`; a rating change is an update, not another vote. Store follows as `(fanId, bandId)`.
+
+## Home-screen load
+
+The home screen should make **one API request**, for example `GET /home?month=2026-07`, returning only:
+
+```json
+{
+  "formulaVersion": 3,
+  "asOf": "2026-07-30T19:58:00Z",
+  "leaderboard": [
+    {
+      "rank": 1,
+      "bandId": "…",
+      "name": "…",
+      "photoUrl": "…",
+      "score": 4.72,
+      "ratingCount": 19,
+      "nextGig": { "startsAt": "…", "venue": "…" },
+      "following": true
+    }
+  ]
+}
+```
+
+The API reads the cached monthly ranking plus a small join for the band card and, when signed in, the fan's follow state. Images then load from the CDN. It does **not** load:
+
+- every band, full bios, all gig history, or all individual ratings;
+- badge token ownership, contract state, or a blockchain RPC;
+- the full upcoming-gigs feed (load that through its own paginated endpoint).
+
+This keeps the critical path to one database/API read and CDN images. Rebuild/invalidate the current-month cache after a qualifying gig/rating write; a normal server job can also refresh it. That job is offchain—contracts do not run on a schedule.
+
+## Leaderboard
+
+Start with a versioned server-side formula, for gigs occurring in the selected calendar month:
+
+```
+score = (ratingCount * averageRating + 5 * cityMonthMean) / (ratingCount + 5)
+```
+
+This Bayesian smoothing stops a single 5-star rating beating a band with many strong ratings. Return `ratingCount` for transparency and set an explicit eligibility policy (recommended: at least 3 ratings before a ranked placement). Keep the formula's constants, eligibility rule, and `formulaVersion` in application configuration; retain rank snapshots for audit/debugging.
+
+## What a leaderboard formula change costs
+
+**No onchain cost, no contract change, no user gas, and no migration of ratings.** Change the SQL/application scoring function or config, deploy it, recompute the current-month cache/snapshot, and invalidate `/home`. Cost is normal engineering/compute only—seconds to minutes at MVP scale. Historical ratings stay raw, so any formula can be rerun; never persist a score as the only source of truth.
+
+If volume grows, pre-aggregate `(bandId, month)` count/sum in a table or materialized view. Formula changes still recompute from those aggregates, not from the chain.
+
+## Supporter badge: one contract
+
+`SupporterBadge` is a non-transferable ERC-1155-style receipt (one token ID per registered band) with `buyBadge(bandId)`:
+
+1. Fan calls it with exactly `0.01 ETH` on Base.
+2. Contract verifies the band and forwards the full amount in the same transaction to that band's registered payout wallet.
+3. Contract mints the receipt to the fan and emits `BadgePurchased(fan, bandId, payout, amount, timestamp)`.
+
+The event and non-transferable token are the permanent proof; the indexer mirrors them into Postgres for profile display. The contract takes no platform fee. A band controls future payout-wallet updates; directory verification/initial registration is controlled by a team multisig. The contract needs no cron or admin payment processing.
+
+Before launch, decide whether a visible public address/payment history is acceptable: this proof necessarily exposes the supporter wallet, band, amount, and time on Base.
+
+## Boundaries and next safeguards
+
+- Ratings: rate-limit, require login, and consider attendance evidence/anti-abuse review before treating rankings as high-stakes.
+- Payments: tests for exact payment, failed payout, unauthorized payout changes, duplicate/multiple support policy, and non-transferability; verify contract and place directory-admin controls in a multisig.
+- Product: launch one chain only; do not make badges determine leaderboard rank.

codex
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md).

Answers: home loads one compact API leaderboard response + CDN images; leaderboard changes are offchain, zero gas/contract cost.
diff --git a/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..a03f8fe7a1dadfd05e4b688dfe62472262032e16
--- /dev/null
+++ b/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,84 @@
+# Live Music Directory — Architecture
+
+## Decision
+
+Use a conventional web app for the directory and ranking; use **one Base contract** only for paid, permanent supporter proof.  Base suits a consumer/social product: smart-wallet/on-ramp distribution and very low transaction costs. Do not put profiles, gigs, ratings, follows, or ranks onchain.
+
+## Components
+
+| Component | Owns | Why |
+| --- | --- | --- |
+| Web client | pages, wallet connection, optimistic follow/rating UI | fast consumer UX |
+| API + auth | authorization, search, home response | server-enforced access and one tailored read |
+| Postgres | users, bands, follows, gigs, ratings, rank snapshots/config | queryable and easy to change |
+| Object storage + CDN | band photos | cheap image delivery; URL in Postgres |
+| Cache | current home leaderboard, 1–5 minute TTL | protects the aggregation query |
+| Base `SupporterBadge` contract | band payout wallets; badge receipts/ownership | trustless 0.01 ETH payment and durable proof |
+| Event indexer | contract events → read model | enables badge display without client RPC calls |
+
+Store a photo URL, bio, links, genres, and band payout wallet in the band profile. Store gigs and one rating per `(fanId, gigId)`; a rating change is an update, not another vote. Store follows as `(fanId, bandId)`.
+
+## Home-screen load
+
+The home screen should make **one API request**, for example `GET /home?month=2026-07`, returning only:
+
+```json
+{
+  "formulaVersion": 3,
+  "asOf": "2026-07-30T19:58:00Z",
+  "leaderboard": [
+    {
+      "rank": 1,
+      "bandId": "…",
+      "name": "…",
+      "photoUrl": "…",
+      "score": 4.72,
+      "ratingCount": 19,
+      "nextGig": { "startsAt": "…", "venue": "…" },
+      "following": true
+    }
+  ]
+}
+```
+
+The API reads the cached monthly ranking plus a small join for the band card and, when signed in, the fan's follow state. Images then load from the CDN. It does **not** load:
+
+- every band, full bios, all gig history, or all individual ratings;
+- badge token ownership, contract state, or a blockchain RPC;
+- the full upcoming-gigs feed (load that through its own paginated endpoint).
+
+This keeps the critical path to one database/API read and CDN images. Rebuild/invalidate the current-month cache after a qualifying gig/rating write; a normal server job can also refresh it. That job is offchain—contracts do not run on a schedule.
+
+## Leaderboard
+
+Start with a versioned server-side formula, for gigs occurring in the selected calendar month:
+
+```
+score = (ratingCount * averageRating + 5 * cityMonthMean) / (ratingCount + 5)
+```
+
+This Bayesian smoothing stops a single 5-star rating beating a band with many strong ratings. Return `ratingCount` for transparency and set an explicit eligibility policy (recommended: at least 3 ratings before a ranked placement). Keep the formula's constants, eligibility rule, and `formulaVersion` in application configuration; retain rank snapshots for audit/debugging.
+
+## What a leaderboard formula change costs
+
+**No onchain cost, no contract change, no user gas, and no migration of ratings.** Change the SQL/application scoring function or config, deploy it, recompute the current-month cache/snapshot, and invalidate `/home`. Cost is normal engineering/compute only—seconds to minutes at MVP scale. Historical ratings stay raw, so any formula can be rerun; never persist a score as the only source of truth.
+
+If volume grows, pre-aggregate `(bandId, month)` count/sum in a table or materialized view. Formula changes still recompute from those aggregates, not from the chain.
+
+## Supporter badge: one contract
+
+`SupporterBadge` is a non-transferable ERC-1155-style receipt (one token ID per registered band) with `buyBadge(bandId)`:
+
+1. Fan calls it with exactly `0.01 ETH` on Base.
+2. Contract verifies the band and forwards the full amount in the same transaction to that band's registered payout wallet.
+3. Contract mints the receipt to the fan and emits `BadgePurchased(fan, bandId, payout, amount, timestamp)`.
+
+The event and non-transferable token are the permanent proof; the indexer mirrors them into Postgres for profile display. The contract takes no platform fee. A band controls future payout-wallet updates; directory verification/initial registration is controlled by a team multisig. The contract needs no cron or admin payment processing.
+
+Before launch, decide whether a visible public address/payment history is acceptable: this proof necessarily exposes the supporter wallet, band, amount, and time on Base.
+
+## Boundaries and next safeguards
+
+- Ratings: rate-limit, require login, and consider attendance evidence/anti-abuse review before treating rankings as high-stakes.
+- Payments: tests for exact payment, failed payout, unauthorized payout changes, duplicate/multiple support policy, and non-transferability; verify contract and place directory-admin controls in a multisig.
+- Product: launch one chain only; do not make badges determine leaderboard rank.

tokens used
32,210
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-002/2026-07-30T195816Z-codex-with-skill-2/workspace/plan.md).

Answers: home loads one compact API leaderboard response + CDN images; leaderboard changes are offchain, zero gas/contract cost.
