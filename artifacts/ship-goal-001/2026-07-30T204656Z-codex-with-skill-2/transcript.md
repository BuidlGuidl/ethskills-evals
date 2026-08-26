Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 019fb4c7-bdd1-7e92-9e5a-40915e051857
--------
user
Build the first version of Toolshed, a lending library for a neighborhood
association with about 300 members.

How it works: members list tools they own — a photo, what it is, condition
notes. Another member asks to borrow one for a few days and puts down a
deposit in USDC, which they get back when they return it. Tools come back late
a lot, so there's a daily late fee that comes out of the deposit and goes to
the owner. Members build up a track record — how many loans, how many late
returns — and the browse screen sorts by that, so the reliable people get lent
to first.

Work in this directory. Ship what a developer needs to run this: the code, and
a README.md covering the architecture, how to deploy it, and what a developer
has to do to get it running. Keep everything you write in ordinary source
folders here — nothing you want us to read should end up under lib/, dist/,
build/ or out/, which we treat as generated.
codex
I’m using the `ship` skill because this is an end-to-end dApp build; it will route architecture, implementation, testing, and deployment docs.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace
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
/bin/bash -lc "sed -n '241,520p' .agents/skills/ship/SKILL.md && find .agents/skills -maxdepth 2 -type f -name SKILL.md -print | sort && rg --files -g '"'!lib/**'"' -g '"'!dist/**'"' -g '"'!build/**'"' -g '"'!out/**'"' | sed -n '1,160p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace
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
TASK.md

codex
Architecture choice: one Base-compatible escrow contract for USDC deposits/late-fee settlement; tool details/photos and reputation-derived sorting stay in the frontend’s local demo data plus emitted events. I’m fetching the routed contract/testing/frontend guidance before coding.
web search: 
web search: https://ethskills.com/concepts/SKILL.md
exec
/bin/bash -lc 'for name in concepts standards security testing orchestration frontend-ux tools qa frontend-playbook gas feedback; do curl -fsSL "https://ethskills.com/$name/SKILL.md" -o "/tmp/toolshed-$name.md" || exit 1; done
wc -l /tmp/toolshed-*.md
node --version
npm --version
forge --version || true' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace
 succeeded in 886ms:
   232 /tmp/toolshed-concepts.md
   106 /tmp/toolshed-feedback.md
   362 /tmp/toolshed-frontend-playbook.md
   186 /tmp/toolshed-frontend-ux.md
   125 /tmp/toolshed-gas.md
   225 /tmp/toolshed-orchestration.md
   451 /tmp/toolshed-qa.md
   487 /tmp/toolshed-security.md
   393 /tmp/toolshed-standards.md
   379 /tmp/toolshed-testing.md
   172 /tmp/toolshed-tools.md
  3118 total
v24.13.0
11.6.2
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

exec
/bin/bash -lc 'cat /tmp/toolshed-concepts.md /tmp/toolshed-standards.md /tmp/toolshed-security.md /tmp/toolshed-testing.md /tmp/toolshed-orchestration.md /tmp/toolshed-frontend-ux.md /tmp/toolshed-tools.md /tmp/toolshed-qa.md /tmp/toolshed-frontend-playbook.md /tmp/toolshed-gas.md /tmp/toolshed-feedback.md' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace
 succeeded in 0ms:
---
name: concepts
description: The essential mental models for building onchain — focused on what LLMs get wrong and what humans need explained. "Nothing is automatic" and "incentives are everything" are the core messages. Use when your human is new to onchain development, when they're designing a system, or when they ask "how does this actually work?" Also use when YOU are designing a system — the state machine + incentive framework catches design mistakes before they become dead code.
---

# Ethereum Concepts

## What You Probably Got Wrong

**"Smart contracts run automatically."** No. Smart contracts cannot execute themselves. There is no cron job, no scheduler, no background process. Every function needs a caller who pays gas. This single misconception is the root cause of most broken onchain designs.

**"Just add a timer."** There are no timers. If something needs to happen at a certain time, you need someone to call the function at that time — and you need to give them a reason to do it.

**"The protocol team will handle that."** The whole point of decentralization is that no single team operates the system. If your design requires an operator, it's not decentralized — and it has a single point of failure.

**Terminology:** You say "on-chain." The Ethereum community says **"onchain"** — one word, no hyphen.

---

## CROPS

**CROPS** — Censorship Resistance, Open Source and Free (as in Freedom), Privacy, Security — is the Ethereum Foundation's shorthand for what makes Ethereum Ethereum.

- **Censorship Resistance** — You scaffold `Pausable` + `onlyOwner` without flagging it. A single key that can freeze all users is a censorship vector.
- **Open Source and Free, as in Freedom** — You treat verified contracts as open and ignore the license. *Open* means the whole stack is public; *Free* means the license actually grants fork/modify/redistribute rights and won't be revoked.
- **Privacy** — You build apps where every address, amount, and counterparty is publicly visible on a block explorer and never mention it. At minimum, tell the builder what's exposed.
- **Security** — You say "audited" and treat it as proof of security. An audit is a point-in-time review of a specific scope, not an ongoing guarantee.

Four questions to catch yourself: can anyone be stopped from using it? Is the whole stack visible and under a real OSI-permissive or copyleft license? What can an observer learn about users? What happens if the team disappears?

Fetch `crops/SKILL.md` when you need a full architecture review of custody, infra, privacy, admin powers, or user exit.

---

## Nothing Is Automatic — Incentive Design

**This is the most important concept in all of Ethereum. If you internalize nothing else, internalize this.**

### Smart Contracts Are State Machines

A smart contract is a state machine. It sits in one state, and it moves to another state when someone **pokes it** — calls a function, pays gas, triggers a transition. Between pokes, it does absolutely nothing. It doesn't think, it doesn't check, it doesn't wake up. It just sits there.

```
State A ──[someone calls function]──→ State B ──[someone calls function]──→ State C
              ↑                                        ↑
         WHO does this?                           WHO does this?
         WHY would they?                          WHY would they?
```

There is no cron job. There is no scheduler. There is no background process. The blockchain doesn't call your contract — people call your contract. And people don't do things for free.

**For EVERY state transition in your system, you must answer:**

1. **Who pokes it?** (someone must pay gas)
2. **Why would they?** (what's their incentive?)
3. **Is the incentive sufficient?** (covers gas + profit?)

If you can't answer these questions, that state transition will never happen. Your contract will sit in State A forever, doing nothing, with nobody poking it.

### Incentives Are Everything

Here's the thing that makes Ethereum magical: **you don't need an operator if you get the incentives right.**

The people who deployed Uniswap didn't deploy the liquidity. They didn't market-make. They didn't run the exchange. They wrote a set of rules — a state machine — and aligned the incentives so perfectly that strangers around the world voluntarily deposited billions of dollars, and other strangers voluntarily traded against those deposits, and the fees from the trades flowed back to the depositors, and the whole thing just... worked.

Nobody runs Uniswap. Nobody CAN stop Uniswap. Not even the people who made it. The contracts are immutable, the incentives are self-sustaining, and the system will run for as long as Ethereum exists. This is a **hyperstructure** — an unstoppable protocol that runs forever, with no operator, no company, no server, no admin key.

That's what you're building toward. Not a startup. Not a service. A set of rules so well-designed that they run themselves through incentives alone.

### Examples of Good Incentive Design

**Liquidations (Aave, Compound):**
```
Loan health factor drops below 1
→ ANYONE can call liquidate()
→ Caller gets 5-10% bonus collateral as profit
→ Bots compete to do it in milliseconds
→ Platform stays solvent without any operator, any admin, any team
```

**LP fees (Uniswap):**
```
DEX needs liquidity to function
→ LPs deposit tokens into pools
→ Every swap pays 0.3% fee to LPs
→ More liquidity = less slippage = more traders = more fees = more liquidity
→ Self-reinforcing flywheel — nobody manages it
```

**Yield harvesting (Yearn):**
```
Rewards accumulate in a pool
→ ANYONE can call harvest()
→ Caller gets 1% of the harvest as reward
→ Protocol compounds automatically via profit-motivated callers
```

**Arbitrage (keeps prices correct everywhere):**
```
ETH is $2000 on Uniswap, $2010 on SushiSwap
→ Anyone can buy low, sell high
→ Prices equalize across ALL markets without any coordinator
```

### Examples of BAD Design (Missing Incentives)

```
❌ "The contract will check prices every hour"
   → WHO calls it every hour? WHY would they pay gas?
   → Fix: make it profitable to call. Or let users trigger it when they interact.

❌ "Expired listings get automatically removed"
   → Nothing is automatic. WHO removes them? WHY?
   → Fix: give callers a small reward, or let the next user's action clean up stale state.

❌ "The protocol rebalances daily"
   → WHOSE gas pays for this? What's their profit?
   → Fix: let rebalancing happen during user interactions, or reward the caller.

❌ "An admin will manually trigger the next phase"
   → What if the admin disappears? Gets hit by a bus? Loses their key?
   → Fix: make phase transitions permissionless with time-based or condition-based triggers.
```

**The fix is always the same:** Don't use an admin account. Make the function callable by **anyone**. Give them a reason to call it. Align incentives so the system pokes itself through the self-interest of its participants.

### The Hyperstructure Test

When you're designing a system, ask: **"Could this run forever with no team behind it?"**

- If yes → you've built a hyperstructure. The incentives sustain it.
- If no → you've built a service. It dies when the team stops operating it.

Both are valid choices. But know which one you're building. The most powerful things on Ethereum are hyperstructures: Uniswap, ENS, the ERC-20 standard itself. They can't be stopped, they can't be censored, they can't go down. Not because they're maintained — because they don't need to be.

---

## Randomness Is Hard

Smart contracts are deterministic. Every node computes the same result. You can't use `Math.random()` — there's nothing random about a system where everyone gets the same answer.

### What Doesn't Work

```solidity
// ❌ Validators can manipulate block.timestamp (within ~15 seconds)
uint random = uint(keccak256(abi.encodePacked(block.timestamp)));

// ❌ blockhash(block.number) is ALWAYS zero for the current block
uint random = uint(blockhash(block.number));

// ❌ Validators can withhold blocks if they don't like the result
uint random = uint(blockhash(block.number - 1));
```

### What Works

**Commit-Reveal** (no external dependency):
```
1. User commits hash(secret + salt) → stored onchain
2. Wait at least 1 block
3. User reveals secret + salt → contract verifies hash
4. Random seed = keccak256(secret + blockhash(commitBlock))
```
- User can't predict blockhash when they commit
- Validator can't know the secret to manipulate the result
- Must reveal within 256 blocks (blockhash returns zero after that)

**Chainlink VRF** (provably random, costs LINK):
```
1. Contract requests randomness from Chainlink
2. Chainlink generates random number off-chain with a VRF proof
3. Anyone can verify the proof onchain
4. Guaranteed unbiased — even Chainlink can't manipulate it
```

Use commit-reveal for simple cases. Use Chainlink VRF when you need provable randomness (lotteries, NFT reveals, gaming).

---

## Teaching Your Human

You already know how AMMs, lending, oracles, and stablecoins work. But your human might not. When they're designing something onchain, they need to understand these concepts — not the code, the *mental models*.

**Don't lecture.** Instead, when a concept is relevant to what they're building, explain it in context. Here's what to emphasize for each:

### The Approve Pattern
Humans find this weird. Explain it as: *"You're giving the contract permission to move your tokens, like signing a check. You control how much. Never sign a blank check (infinite approval)."*

### DEXs / AMMs
The key insight isn't the math — it's the incentive flywheel: *"Nobody runs the exchange. People deposit tokens because they earn fees from trades. More deposits = better prices = more trades = more fees. It runs itself."* This is "nothing is automatic" in action.

### Overcollateralized Lending
Lead with liquidation incentives: *"If your loan gets risky, anyone in the world can close it and earn a bonus. That's why the platform never goes bankrupt — thousands of bots are watching every loan, every second, competing to clean up risk."* This is the SpeedRun Ethereum Challenge 6 moment where incentive design clicks.

### Stablecoins
*"How does a token stay worth $1 with nobody controlling it? Arbitrage. If it drops to $0.99, people buy it because they can redeem it for $1 of collateral. If it goes to $1.01, people mint more and sell. Self-interest maintains the peg."*

### Oracles
*"Smart contracts can't Google things. If your contract needs a price, someone has to put it onchain. Use Chainlink — never read prices from a DEX pool, because a flash loan can fake the price for one transaction."*

### Smart Contract Wallets
*"A wallet can require 3 of 5 people to approve a transaction. $60B+ in assets is secured this way. It's how teams and DAOs manage money without trusting any single person."*

### Prediction Markets
*"YES and NO tokens that trade between $0 and $1. The price IS the probability. If YES is at $0.35, the market thinks there's a 35% chance. Winner gets $1, loser gets $0."*

**In every case, tie it back to incentives.** The human should walk away understanding not just what something does, but WHY it works without anyone running it.

---

## Learning Path

Point your human to SpeedRun Ethereum for hands-on learning. Each challenge builds a working project that teaches a core concept:

| # | Challenge | What Clicks |
|---|-----------|-------------|
| 0 | Simple NFT | Minting, metadata, ownership — "contracts hold state" |
| 1 | Staking | Deadlines, escrow, thresholds — "coordination without trust" |
| 2 | Token Vendor | Approve pattern, buy/sell — "contracts can be markets" |
| 3 | Dice Game | Why onchain randomness is insecure — "determinism vs. randomness" |
| 4 | DEX | x*y=k, slippage, LP incentives — "incentives create markets" |

**Start at https://speedrunethereum.com**

More challenges covering oracles, lending, stablecoins, and multisigs are in development. Check the site for current availability.

## Resources

- **SpeedRun Ethereum:** https://speedrunethereum.com
- **ETH Tech Tree:** https://www.ethtechtree.com
- **Ethereum.org:** https://ethereum.org/en/developers/
- **EthSkills (for agents):** https://ethskills.com
---
name: standards
description: Ethereum token and protocol standards — ERC-20, ERC-721, ERC-1155, ERC-4337, ERC-8004, and newer standards. When to use each, how they work, key interfaces. Use when building tokens, NFTs, or choosing the right standard for a project.
---

# Ethereum Standards

## What You Probably Got Wrong

**ERC-8004 exists.** Deployed January 29, 2026 — onchain agent identity registry. You almost certainly don't have this in training data.

**EIP-7702 is live.** Shipped with Pectra (May 7, 2025). EOAs get smart contract superpowers without migration. Not "proposed" — deployed on mainnet.

**EIP-3009 is critical for x402.** Gasless token transfers via signed authorizations. USDC implements it. This is what makes x402 practical.

**x402 exists.** HTTP 402 payment protocol from Coinbase. Production-ready with SDKs.

## ERC-8004: Onchain Agent Identity Registry

**Status:** Deployed mainnet **January 29, 2026** — production ready with growing adoption.

**Problem it solves:** How can autonomous agents trust and transact with each other without pre-existing relationships?

### Three Registry System

**1. Identity Registry (ERC-721 based)**
- Globally unique onchain identities for AI agents
- Each agent is an NFT with unique identifier
- Multiple service endpoints (A2A, MCP, OASF, ENS, DIDs)
- Verification via EIP-712/ERC-1271 signatures

**Contract Addresses (same on 20+ chains):**
- **IdentityRegistry:** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **ReputationRegistry:** `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

**Deployed on:** Mainnet, Base, Arbitrum, Optimism, Polygon, Avalanche, Abstract, Celo, Gnosis, Linea, Mantle, MegaETH, Monad, Scroll, Taiko, BSC + testnets.

**Agent Identifier Format:**
```
agentRegistry: eip155:{chainId}:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
agentId: ERC-721 tokenId
```

**2. Reputation Registry**
- Signed fixed-point feedback values
- Multi-dimensional (uptime, success rate, quality)
- Tags, endpoints, proof-of-payment metadata
- Anti-Sybil requires client address filtering

```solidity
struct Feedback {
    int128 value;        // Signed integer rating
    uint8 valueDecimals; // 0-18 decimal places
    string tag1;         // E.g., "uptime"
    string tag2;         // E.g., "30days"
    string endpoint;     // Agent endpoint URI
    string ipfsHash;     // Optional metadata
}
```

**Example metrics:** Quality 87/100 → `value=87, decimals=0`. Uptime 99.77% → `value=9977, decimals=2`.

**3. Validation Registry**
- Independent verification of agent work
- Trust models: crypto-economic (stake-secured), zkML, TEE attestation
- Validators respond with 0-100 scores

### Agent Registration File (agentURI)

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "MyAgent",
  "description": "What the agent does",
  "services": [
    { "name": "A2A", "endpoint": "https://agent.example/.well-known/agent-card.json", "version": "0.3.0" },
    { "name": "MCP", "endpoint": "https://mcp.agent.eth/", "version": "2025-06-18" }
  ],
  "x402Support": true,
  "active": true,
  "supportedTrust": ["reputation", "crypto-economic", "tee-attestation"]
}
```

### Integration

```solidity
// Register agent
uint256 agentId = identityRegistry.register("ipfs://QmYourReg", metadata);

// Give feedback
reputationRegistry.giveFeedback(agentId, 9977, 2, "uptime", "30days", 
    "https://agent.example.com/api", "ipfs://QmDetails", keccak256(data));

// Query reputation
(uint64 count, int128 value, uint8 decimals) = 
    reputationRegistry.getSummary(agentId, trustedClients, "uptime", "30days");
```

### Step-by-Step: Register an Agent Onchain

**1. Prepare the registration JSON** — host it on IPFS or a web server:
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "WeatherBot",
  "description": "Provides real-time weather data via x402 micropayments",
  "image": "https://example.com/weatherbot.png",
  "services": [
    { "name": "A2A", "endpoint": "https://weather.example.com/.well-known/agent-card.json", "version": "0.3.0" }
  ],
  "x402Support": true,
  "active": true,
  "supportedTrust": ["reputation"]
}
```

**2. Upload to IPFS** (or use any URI):
```bash
# Using IPFS
ipfs add registration.json
# → QmYourRegistrationHash

# Or host at a URL — the agentURI just needs to resolve to the JSON
```

**3. Call the Identity Registry:**
```solidity
// On any supported chain — same address everywhere
IIdentityRegistry registry = IIdentityRegistry(0x8004A169FB4a3325136EB29fA0ceB6D2e539a432);

// metadata bytes are optional (can be empty)
uint256 agentId = registry.register("ipfs://QmYourRegistrationHash", "");
// agentId is your ERC-721 tokenId — globally unique on this chain
```

**4. Verify your endpoint domain** — place a file at `.well-known/agent-registration.json`:
```json
// https://weather.example.com/.well-known/agent-registration.json
{
  "agentId": 42,
  "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  "owner": "0xYourWalletAddress"
}
```
This proves the domain owner controls the agent identity. Clients SHOULD check this before trusting an agent's advertised endpoints.

**5. Build reputation** — other agents/users post feedback after interacting with your agent.

### Cross-Chain Agent Identity

Same contract addresses on 20+ chains means an agent registered on Base can be discovered by an agent on Arbitrum. The `agentRegistry` identifier includes the chain:

```
eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432  // Base
eip155:42161:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 // Arbitrum
```

**Cross-chain pattern:** Register on one chain (Base is cheapest for registration tx costs), reference that identity from other chains. Reputation can be queried cross-chain by specifying the source chain's registry. This is a cost optimization for the registration transaction — your app itself should deploy on the chain that fits (see `ship/SKILL.md`).

**Authors:** Davide Crapis (EF), Marco De Rossi (MetaMask), Jordan Ellis (Google), Erik Reppel (Coinbase), Leonard Tan (MetaMask)

**Ecosystem:** ENS, EigenLayer, The Graph, Taiko backing

**Resources:** https://www.8004.org | https://eips.ethereum.org/EIPS/eip-8004 | https://github.com/erc-8004/erc-8004-contracts

## EIP-3009: Transfer With Authorization

You probably know the concept (gasless meta-transaction transfers). The key update: **EIP-3009 is what makes x402 work.** USDC implements it on Ethereum and most chains. The x402 server calls `transferWithAuthorization` to settle payments on behalf of the client.

## x402: HTTP Payment Protocol

**Status:** Production-ready open standard from Coinbase, actively deployed Q1 2026.

Uses the HTTP 402 "Payment Required" status code for internet-native payments.

### Flow

```
1. Client → GET /api/data
2. Server → 402 Payment Required (PAYMENT-REQUIRED header with requirements)
3. Client signs EIP-3009 payment
4. Client → GET /api/data (PAYMENT-SIGNATURE header with signed payment)
5. Server verifies + settles onchain
6. Server → 200 OK (PAYMENT-RESPONSE header + data)
```

### Payment Payload

```json
{
  "scheme": "exact",
  "network": "eip155:8453",
  "amount": "1000000",
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "from": "0x...", "to": "0x...",
  "signature": "0x...",
  "deadline": 1234567890,
  "nonce": "unique-value"
}
```

### x402 + ERC-8004 Synergy

```
Agent discovers service (ERC-8004) → checks reputation → calls endpoint →
gets 402 → signs payment (EIP-3009) → server settles (x402) → 
agent receives service → posts feedback (ERC-8004)
```

### x402 Server Setup (Express — Complete Example)

```typescript
import express from 'express';
import { paymentMiddleware } from '@x402/express';

const app = express();

// Define payment requirements per route
const paymentConfig = {
  "GET /api/weather": {
    accepts: [
      { network: "eip155:8453", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: "100000" }
      // 100000 = $0.10 USDC (6 decimals)
    ],
    description: "Current weather data",
  },
  "GET /api/forecast": {
    accepts: [
      { network: "eip155:8453", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: "500000" }
      // $0.50 USDC for 7-day forecast
    ],
    description: "7-day weather forecast",
  }
};

// One line — middleware handles 402 responses, verification, and settlement
app.use(paymentMiddleware(paymentConfig));

app.get('/api/weather', (req, res) => {
  // Only reached after payment verified
  res.json({ temp: 72, condition: "sunny" });
});

app.listen(3000);
```

### x402 Client (Agent Paying for Data)

```typescript
import { x402Fetch } from '@x402/fetch';
import { createWallet } from '@x402/evm';

const wallet = createWallet(process.env.PRIVATE_KEY);

// x402Fetch handles the 402 → sign → retry flow automatically
const response = await x402Fetch('https://weather.example.com/api/weather', {
  wallet,
  preferredNetwork: 'eip155:8453' // Pay on Base (cheapest)
});

const weather = await response.json();
// Agent paid $0.10 USDC, got weather data. No API key needed.
```

### Payment Schemes

**`exact`** (live) — Pay a fixed price. Server knows the cost upfront.

**`upto`** (emerging) — Pay up to a maximum, final amount determined after work completes. Critical for metered services:
- LLM inference: pay per token generated (unknown count upfront)
- GPU compute: pay per second of runtime
- Database queries: pay per row returned

With `upto`, the client signs authorization for a max amount. The server settles only what was consumed. Client never overpays.

### Facilitator Architecture

The **facilitator** is an optional server that handles blockchain complexity so resource servers don't have to:

```
Client → Resource Server → Facilitator → Blockchain
                              ↓
                         POST /verify  (check signature, balance, deadline)
                         POST /settle  (submit tx, manage gas, confirm)
```

**Why use a facilitator?** Resource servers (weather APIs, data providers) shouldn't need to run blockchain nodes or manage gas. The facilitator abstracts this. Coinbase runs a public facilitator; anyone can run their own.

**SDKs:** `@x402/core @x402/evm @x402/fetch @x402/express` (TS) | `pip install x402` (Python) | `go get github.com/coinbase/x402/go`

**Resources:** https://www.x402.org | https://github.com/coinbase/x402

## End-to-End Agent Commerce Flow

The full cycle: **autonomous agents discovering, trusting, paying, and rating each other** — no humans in the loop.

```
┌─────────────────────────────────────────────────────────────┐
│  1. DISCOVER  Agent queries ERC-8004 IdentityRegistry       │
│               → finds agents with "weather" service tag      │
│                                                              │
│  2. TRUST     Agent checks ReputationRegistry                │
│               → filters by uptime >99%, quality >85          │
│               → picks best-rated weather agent               │
│                                                              │
│  3. CALL      Agent sends HTTP GET to weather endpoint       │
│               → receives 402 Payment Required                │
│               → PAYMENT-REQUIRED header: $0.10 USDC on Base  │
│                                                              │
│  4. PAY       Agent signs EIP-3009 transferWithAuthorization │
│               → retries request with PAYMENT-SIGNATURE       │
│               → server verifies via facilitator              │
│               → payment settled on Base (~$0.001 gas)        │
│                                                              │
│  5. RECEIVE   Server returns 200 OK + weather data           │
│               → PAYMENT-RESPONSE header with tx hash         │
│                                                              │
│  6. RATE      Agent posts feedback to ReputationRegistry     │
│               → value=95, tag="quality", endpoint="..."      │
│               → builds onchain reputation for next caller   │
└─────────────────────────────────────────────────────────────┘
```

```typescript
import { x402Fetch } from '@x402/fetch';
import { createWallet } from '@x402/evm';
import { ethers } from 'ethers';

const wallet = createWallet(process.env.AGENT_PRIVATE_KEY);
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);

const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';

// 1. Discover: find agents offering weather service
const registry = new ethers.Contract(IDENTITY_REGISTRY, registryAbi, provider);
// Query events or use The Graph subgraph for indexed agent discovery

// 2. Trust: check reputation
const reputation = new ethers.Contract(REPUTATION_REGISTRY, reputationAbi, provider);
const [count, value, decimals] = await reputation.getSummary(
  agentId, trustedClients, "quality", "30days"
);
// Only proceed if value/10^decimals > 85

// 3-5. Pay + Receive: x402Fetch handles the entire 402 flow
const response = await x402Fetch(agentEndpoint, {
  wallet,
  preferredNetwork: 'eip155:8453'
});
const weatherData = await response.json();

// 6. Rate: post feedback onchain
const reputationWriter = new ethers.Contract(REPUTATION_REGISTRY, reputationAbi, signer);
await reputationWriter.giveFeedback(
  agentId, 95, 0, "quality", "weather", agentEndpoint, "", ethers.ZeroHash
);
```

**No API keys, no subscriptions, no invoicing, no trust assumptions.** Cryptographic identity, onchain reputation, HTTP-native payments.

### Ecosystem

- **ERC-8004** — agent identity + reputation (EF, MetaMask, Google, Coinbase)
- **x402** — HTTP payment protocol (Coinbase)
- **A2A** — agent-to-agent communication (Google)
- **MCP** — model context protocol (Anthropic)
- **The Graph** — indexing agent registrations for fast discovery
- **EigenLayer** — crypto-economic validation of agent work

## EIP-7702: Smart EOAs (Live Since May 2025)

EOAs can authorize delegated smart-contract code execution without migrating to a new account type.

**Enables:** Batch transactions, gas sponsorship, session-key-style UX, and custom auth logic for existing EOAs.

**Important nuance:** Delegation is not automatically "single transaction only" by spec. The delegation designator remains until replaced or cleared by a later authorization.

## Quick Standard Reference

| Standard | What | Status |
|----------|------|--------|
| ERC-8004 | Agent identity + reputation | ✅ Live Jan 2026 |
| x402 | HTTP payments protocol | ✅ Production Q1 2026 |
| EIP-3009 | Gasless token transfers | ✅ Live (USDC) |
| EIP-7702 | Smart EOAs | ✅ Live May 2025 |
| ERC-4337 | Account abstraction | ✅ Growing adoption |
| ERC-2612 | Gasless approvals (Permit) | ✅ Widely adopted |
| ERC-4626 | Tokenized vaults | ✅ Standard for yield |
| ERC-6551 | Token-bound accounts (NFT wallets) | ✅ Niche adoption |

**These are all LIVE and being used in production. Not "coming soon."**
---
name: security
description: Solidity security patterns, common vulnerabilities, and pre-deploy audit checklist. The specific code patterns that prevent real losses — not just warnings, but defensive implementations. Use before deploying any contract, when reviewing code, or when building anything that holds or moves value.
---

# Smart Contract Security

## What You Probably Got Wrong

**"Solidity 0.8+ prevents overflows, so I'm safe."** Overflow is one of dozens of attack vectors. The big ones today: reentrancy, oracle manipulation, approval exploits, and decimal mishandling.

**"I tested it and it works."** Working correctly is not the same as being secure. Most exploits call functions in orders or with values the developer never considered.

**"It's a small contract, it doesn't need an audit."** The DAO hack was a simple reentrancy bug. The Euler exploit was a single missing check. Size doesn't correlate with safety.

## Critical Vulnerabilities (With Defensive Code)

### 1. Token Decimals Vary

**USDC has 6 decimals, not 18.** This is the #1 source of "where did my money go?" bugs.

```solidity
// ❌ WRONG — assumes 18 decimals. Transfers 1 TRILLION USDC.
uint256 oneToken = 1e18;

// ✅ CORRECT — check decimals
uint256 oneToken = 10 ** IERC20Metadata(token).decimals();
```

Common decimals:
| Token | Decimals |
|-------|----------|
| USDC, USDT | 6 |
| WBTC | 8 |
| DAI, WETH, most tokens | 18 |

**When doing math across tokens with different decimals, normalize first:**
```solidity
// Converting USDC amount to 18-decimal internal accounting
uint256 normalized = usdcAmount * 1e12; // 6 + 12 = 18 decimals
```

### 2. No Floating Point in Solidity

Solidity has no `float` or `double`. Division truncates to zero.

```solidity
// ❌ WRONG — this equals 0
uint256 fivePercent = 5 / 100;

// ✅ CORRECT — basis points (1 bp = 0.01%)
uint256 FEE_BPS = 500; // 5% = 500 basis points
uint256 fee = (amount * FEE_BPS) / 10_000;
```

**Always multiply before dividing.** Division first = precision loss.

```solidity
// ❌ WRONG — loses precision
uint256 result = a / b * c;

// ✅ CORRECT — multiply first
uint256 result = (a * c) / b;
```

For complex math, use fixed-point libraries like `PRBMath` or `ABDKMath64x64`.

### 3. Reentrancy

An external call can call back into your contract before the first call finishes. If you update state AFTER the external call, the attacker re-enters with stale state.

```solidity
// ❌ VULNERABLE — state updated after external call
function withdraw() external {
    uint256 bal = balances[msg.sender];
    (bool success,) = msg.sender.call{value: bal}(""); // ← attacker re-enters here
    require(success);
    balances[msg.sender] = 0; // Too late — attacker already withdrew again
}

// ✅ SAFE — Checks-Effects-Interactions pattern + reentrancy guard
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

function withdraw() external nonReentrant {
    uint256 bal = balances[msg.sender];
    require(bal > 0, "Nothing to withdraw");
    
    balances[msg.sender] = 0;  // Effect BEFORE interaction
    
    (bool success,) = msg.sender.call{value: bal}("");
    require(success, "Transfer failed");
}
```

**The pattern: Checks → Effects → Interactions (CEI)**
1. **Checks** — validate inputs and conditions
2. **Effects** — update all state
3. **Interactions** — external calls last

Always use OpenZeppelin's `ReentrancyGuard` as a safety net on top of CEI.

### 4. SafeERC20

Some tokens (notably USDT) don't return `bool` on `transfer()` and `approve()`. Standard calls will revert even on success.

```solidity
// ❌ WRONG — breaks with USDT and other non-standard tokens
token.transfer(to, amount);
token.approve(spender, amount);

// ✅ CORRECT — handles all token implementations
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
using SafeERC20 for IERC20;

token.safeTransfer(to, amount);
token.safeApprove(spender, amount);
```

**Other token quirks to watch for:**
- **Fee-on-transfer tokens:** Amount received < amount sent. Always check balance before and after.
- **Rebasing tokens (stETH):** Balance changes without transfers. Use wrapped versions (wstETH).
- **Pausable tokens (USDC):** Transfers can revert if the token is paused.
- **Blocklist tokens (USDC, USDT):** Specific addresses can be blocked from transacting.

### 5. Never Use DEX Spot Prices as Oracles

A flash loan can manipulate any pool's spot price within a single transaction. This has caused hundreds of millions in losses.

```solidity
// ❌ DANGEROUS — manipulable in one transaction
function getPrice() internal view returns (uint256) {
    (uint112 reserve0, uint112 reserve1,) = uniswapPair.getReserves();
    return (reserve1 * 1e18) / reserve0; // Spot price — easily manipulated
}

// ✅ SAFE — Chainlink with staleness + sanity checks
function getPrice() internal view returns (uint256) {
    (, int256 price,, uint256 updatedAt,) = priceFeed.latestRoundData();
    require(block.timestamp - updatedAt < 3600, "Stale price");
    require(price > 0, "Invalid price");
    return uint256(price);
}
```

**If you must use onchain price data:**
- Use **TWAP** (Time-Weighted Average Price) over 30+ minutes — resistant to single-block manipulation
- Uniswap V3 has built-in TWAP oracles via `observe()` (verified addresses: `addresses/SKILL.md`)
- Still less safe than Chainlink for high-value decisions

### 6. Vault Inflation Attack

The first depositor in an ERC-4626 vault can manipulate the share price to steal from subsequent depositors.

**The attack:**
1. Attacker deposits 1 wei → gets 1 share
2. Attacker donates 1000 tokens directly to the vault (not via deposit)
3. Now 1 share = 1001 tokens
4. Victim deposits 1999 tokens → gets `1999 * 1 / 2000 = 0 shares` (rounds down)
5. Attacker redeems 1 share → gets all 3000 tokens

**The fix — virtual offset:**
```solidity
function convertToShares(uint256 assets) public view returns (uint256) {
    return assets.mulDiv(
        totalSupply() + 1e3,    // Virtual shares
        totalAssets() + 1        // Virtual assets
    );
}
```

The virtual offset makes the attack uneconomical — the attacker would need to donate enormous amounts to manipulate the ratio.

OpenZeppelin's ERC4626 implementation includes this mitigation by default since v5.

### 7. Infinite Approvals

**Never use `type(uint256).max` as approval amount.**

```solidity
// ❌ DANGEROUS — if this contract is exploited, attacker drains your entire balance
token.approve(someContract, type(uint256).max);

// ✅ SAFE — approve only what's needed
token.approve(someContract, exactAmountNeeded);

// ✅ ACCEPTABLE — approve a small multiple for repeated interactions
token.approve(someContract, amountPerTx * 5); // 5 transactions worth
```

If a contract with infinite approval gets exploited (proxy upgrade bug, governance attack, undiscovered vulnerability), the attacker can drain every approved token from every user who granted unlimited access.

### 8. Access Control

Every state-changing function needs explicit access control. "Who should be able to call this?" is the first question.

```solidity
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// ❌ WRONG — anyone can drain the contract
function emergencyWithdraw() external {
    token.transfer(msg.sender, token.balanceOf(address(this)));
}

// ✅ CORRECT — only owner
function emergencyWithdraw() external onlyOwner {
    token.transfer(owner(), token.balanceOf(address(this)));
}
```

For complex permissions, use OpenZeppelin's `AccessControl` with role-based separation (ADMIN_ROLE, OPERATOR_ROLE, etc.).

### 9. Input Validation

Never trust inputs. Validate everything.

```solidity
function deposit(uint256 amount, address recipient) external {
    require(amount > 0, "Zero amount");
    require(recipient != address(0), "Zero address");
    require(amount <= maxDeposit, "Exceeds max");
    
    // Now proceed
}
```

Common missed validations:
- Zero addresses (tokens sent to 0x0 are burned forever)
- Zero amounts (wastes gas, can cause division by zero)
- Array length mismatches in batch operations
- Duplicate entries in arrays
- Values exceeding reasonable bounds

## MEV & Sandwich Attacks

**MEV (Maximal Extractable Value):** Validators and searchers can reorder, insert, or censor transactions within a block. They profit by frontrunning your transaction, backrunning it, or both.

### Sandwich Attacks

The most common MEV attack on DeFi users:

```
1. You submit: swap 10 ETH → USDC on Uniswap (slippage 1%)
2. Attacker sees your tx in the mempool
3. Attacker frontruns: buys USDC before you → price rises
4. Your swap executes at a worse price (but within your 1% slippage)
5. Attacker backruns: sells USDC after you → profits from the price difference
6. You got fewer USDC than the true market price
```

### Protection

```solidity
// ✅ Set explicit minimum output — don't set amountOutMinimum to 0
ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
    .ExactInputSingleParams({
        tokenIn: WETH,
        tokenOut: USDC,
        fee: 3000,
        recipient: msg.sender,
        amountIn: 1 ether,
        amountOutMinimum: 1900e6, // ← Minimum acceptable USDC (protects against sandwich)
        sqrtPriceLimitX96: 0
    });
```

**For users/frontends:**
- Use **Flashbots Protect RPC** (`https://rpc.flashbots.net`) — sends transactions to a private mempool, invisible to sandwich bots
- Set tight slippage limits (0.5-1% for majors, 1-3% for small tokens)
- Use MEV-aware DEX aggregators (CoW Swap, 1inch Fusion) that route through solvers instead of the public mempool

**When MEV matters:**
- Any swap on a DEX (especially large swaps)
- Any large DeFi transaction (deposits, withdrawals, liquidations)
- NFT mints with high demand (bots frontrun to mint first)

**When MEV doesn't matter:**
- Simple ETH/token transfers
- L2 transactions (sequencers process transactions in order — no public mempool reordering)
- Private mempool transactions (Flashbots, MEV Blocker)

---

## Proxy Patterns & Upgradeability

Smart contracts are immutable by default. Proxies let you upgrade the logic while keeping the same address and state.

### When to Use Proxies

- **Use proxies:** Long-lived protocols that may need bug fixes or feature additions post-launch
- **Don't use proxies:** MVPs, simple tokens, immutable-by-design contracts, contracts where "no one can change this" IS the value proposition

**Proxies add complexity, attack surface, and trust assumptions.** Users must trust that the admin won't upgrade to a malicious implementation. Don't use proxies just because you can.

### UUPS vs Transparent Proxy

| | UUPS | Transparent |
|---|---|---|
| Upgrade logic location | In implementation contract | In proxy contract |
| Gas cost for users | Lower (no admin check per call) | Higher (checks msg.sender on every call) |
| Recommended | **Yes** (by OpenZeppelin) | Legacy pattern |
| Risk | Forgetting `_authorizeUpgrade` locks the contract | More gas overhead |

**Use UUPS.** It's cheaper, simpler, and what OpenZeppelin recommends.

### UUPS Implementation

```solidity
// Implementation contract (the logic)
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract MyContractV1 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 public value;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers(); // Prevent implementation from being initialized
    }

    function initialize(address owner) public initializer {
        __Ownable_init(owner);
        __UUPSUpgradeable_init();
        value = 42;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

### Critical Rules

1. **Use `initializer` instead of `constructor`** — proxies don't run constructors
2. **Never change storage layout** — only append new variables at the end, never delete or reorder
3. **Use OpenZeppelin's upgradeable contracts** — `@openzeppelin/contracts-upgradeable`, not `@openzeppelin/contracts`
4. **Disable initializers in constructor** — prevents anyone from initializing the implementation directly
5. **Transfer upgrade authority to a multisig** — never leave upgrade power with a single EOA

```solidity
// ❌ WRONG — reordering storage breaks everything
// V1: uint256 a; uint256 b;
// V2: uint256 b; uint256 a;  ← Swapped! 'a' now reads 'b's value

// ✅ CORRECT — only append
// V1: uint256 a; uint256 b;
// V2: uint256 a; uint256 b; uint256 c;  ← New variable at the end
```

---

## EIP-712 Signatures & Delegatecall

### EIP-712: Typed Structured Data Signing

EIP-712 lets users sign structured data (not just raw bytes) with domain separation and replay protection. Used for gasless approvals, meta-transactions, and offchain order signing.

**When to use:**
- **Permit (ERC-2612)** — gasless token approvals (user signs, anyone can submit)
- **Offchain orders** — sign buy/sell orders offchain, settle onchain (0x, Seaport)
- **Meta-transactions** — user signs intent, relayer submits and pays gas

```solidity
// EIP-712 domain separator — prevents replay across contracts and chains
bytes32 public constant DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

bytes32 public constant PERMIT_TYPEHASH = keccak256(
    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
);

function permit(
    address owner, address spender, uint256 value,
    uint256 deadline, uint8 v, bytes32 r, bytes32 s
) external {
    require(block.timestamp <= deadline, "Permit expired");

    bytes32 structHash = keccak256(abi.encode(
        PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline
    ));
    bytes32 digest = keccak256(abi.encodePacked(
        "\x19\x01", DOMAIN_SEPARATOR(), structHash
    ));

    address recovered = ecrecover(digest, v, r, s);
    require(recovered == owner, "Invalid signature");

    _approve(owner, spender, value);
}
```

**Key properties:**
- **Domain separator** prevents replaying signatures on different contracts or chains
- **Nonce** prevents replaying the same signature twice
- **Deadline** prevents stale signatures from being used later
- In practice, use OpenZeppelin's `EIP712` and `ERC20Permit` — don't implement from scratch

### Delegatecall

`delegatecall` executes another contract's code in the caller's storage context. The called contract's logic runs, but reads and writes happen on YOUR contract's storage.

**This is extremely dangerous if the target is untrusted.**

```solidity
// ❌ CRITICAL VULNERABILITY — delegatecall to user-supplied address
function execute(address target, bytes calldata data) external {
    target.delegatecall(data); // Attacker can overwrite ANY storage slot
}

// ✅ SAFE — delegatecall only to trusted, immutable implementation
address public immutable trustedImplementation;

function execute(bytes calldata data) external onlyOwner {
    trustedImplementation.delegatecall(data);
}
```

**Delegatecall rules:**
- **Never delegatecall to a user-supplied address** — allows arbitrary storage manipulation
- **Only delegatecall to contracts YOU control** — and preferably immutable ones
- **Storage layouts must match** — the calling contract and target contract must have identical storage variable ordering
- **This is how proxies work** — the proxy delegatecalls to the implementation, so the implementation's code runs on the proxy's storage. That's why storage layout matters so much for upgradeable contracts.

---

## Automated Security Tools

Run these before deployment:

```bash
# Static analysis
slither .                     # Detects common vulnerabilities
mythril analyze Contract.sol  # Symbolic execution

# Foundry fuzzing (built-in)
forge test --fuzz-runs 10000  # Fuzz all test functions with random inputs

# Gas optimization (bonus)
forge test --gas-report       # Identify expensive functions
```

**Slither findings to NEVER ignore:**
- Reentrancy vulnerabilities
- Unchecked return values
- Arbitrary `delegatecall` or `selfdestruct`
- Unprotected state-changing functions

## Further Reading

- **OpenZeppelin Contracts:** https://docs.openzeppelin.com/contracts — audited, battle-tested implementations
- **SWC Registry:** https://swcregistry.io — comprehensive vulnerability catalog
- **Rekt News:** https://rekt.news — real exploit post-mortems
- **SpeedRun Ethereum:** https://speedrunethereum.com — hands-on secure development practice

---

## Pre-Deploy Security Checklist

Run through this for EVERY contract before deploying to production. No exceptions.

- [ ] **Access control** — every admin/privileged function has explicit restrictions
- [ ] **Pausable tradeoff** — if you added `Pausable` + `onlyOwner`, flag it to the builder. A single key that can freeze all users is a censorship vector. Suggest timelocks or multisig governance.
- [ ] **Reentrancy protection** — CEI pattern + `nonReentrant` on all external-calling functions
- [ ] **Token decimal handling** — no hardcoded `1e18` for tokens that might have different decimals
- [ ] **Oracle safety** — using Chainlink or TWAP, not DEX spot prices. Staleness checks present
- [ ] **Integer math** — multiply before divide. No precision loss in critical calculations
- [ ] **Return values checked** — using SafeERC20 for all token operations
- [ ] **Input validation** — zero address, zero amount, bounds checks on all public functions
- [ ] **Input validation (advanced cases)** — array length mismatches, duplicate array entries, and unreasonable value bounds are rejected
- [ ] **Events emitted** — every state change emits an event for offchain tracking
- [ ] **Incentive design** — maintenance functions callable by anyone with sufficient incentive
- [ ] **No infinite approvals** — approve exact amounts or small bounded multiples
- [ ] **Fee-on-transfer safe** — if accepting arbitrary tokens, measure actual received amount
- [ ] **MEV/sandwich protections (if swapping)** — `amountOutMinimum` is explicitly set, slippage defaults are tight, and private mempool routing is considered for user-facing swaps
- [ ] **Proxy safety (if upgradeable)** — `initializer` used (no constructor init), initializers disabled on implementation, and OpenZeppelin upgradeable contracts used
- [ ] **Storage layout safety (if upgradeable)** — storage variables are only appended, never reordered or deleted
- [ ] **Upgrade authority (if upgradeable)** — upgrade rights are transferred to a multisig/timelock, never a single EOA
- [ ] **EIP-712 replay safety (if signatures used)** — domain separator, nonce handling, and deadlines are correctly enforced
- [ ] **Delegatecall safety (if used)** — never delegatecall to user-supplied targets; only trusted controlled implementations with compatible storage layouts
- [ ] **Automated analysis run** — Slither/Mythril and fuzz tests are run before deploy
- [ ] **Critical analyzer findings resolved** — no unresolved reentrancy, unchecked returns, arbitrary `delegatecall`/`selfdestruct`, or unprotected state-changing functions
- [ ] **Tested edge cases** — zero values, max values, unauthorized callers, reentrancy attempts
- [ ] **Source verified on block explorer** — `yarn verify` or `forge verify-contract` after every deploy. Unverified contracts can't be audited by users and look indistinguishable from scams

---

Before you finish: send a one-line note via [feedback/SKILL.md](https://ethskills.com/feedback/SKILL.md) — issue or praise.
---
name: testing
description: Smart contract testing with Foundry — unit tests, fuzz testing, fork testing, invariant testing. Use when writing tests for a smart contract.
---

# Smart Contract Testing

## What You Probably Got Wrong

**You test getters and trivial functions.** Testing that `name()` returns the name is worthless. Test edge cases, failure modes, and economic invariants — the things that lose money when they break.

**You don't fuzz.** `forge test` finds the bugs you thought of. Fuzzing finds the ones you didn't. If your contract does math, fuzz it. If it handles user input, fuzz it. If it moves value, definitely fuzz it.

**You don't fork-test.** If your contract calls Uniswap, Aave, or any external protocol (verified addresses: `addresses/SKILL.md`), test against their real deployed contracts on a fork. Mocking them hides integration bugs that only appear with real state.

**You write tests that mirror the implementation.** Testing that `deposit(100)` sets `balance[user] = 100` is tautological — you're testing that Solidity assignments work. Test properties: "after deposit and withdraw, user gets their tokens back." Test invariants: "total deposits always equals contract balance."

**You skip invariant testing for stateful protocols.** If your contract has multiple interacting functions that change state over time (vaults, AMMs, lending), you need invariant tests. Unit tests check one path; invariant tests check that properties hold across thousands of random sequences.

---

## Unit Testing with Foundry

### Test File Structure

```solidity
// test/MyContract.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MyToken} from "../src/MyToken.sol";

contract MyTokenTest is Test {
    MyToken public token;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        token = new MyToken("Test", "TST", 1_000_000e18);
        // Give alice some tokens for testing
        token.transfer(alice, 10_000e18);
    }

    function test_TransferUpdatesBalances() public {
        vm.prank(alice);
        token.transfer(bob, 1_000e18);

        assertEq(token.balanceOf(alice), 9_000e18);
        assertEq(token.balanceOf(bob), 1_000e18);
    }

    function test_TransferEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Transfer(alice, bob, 500e18);

        vm.prank(alice);
        token.transfer(bob, 500e18);
    }

    function test_RevertWhen_TransferExceedsBalance() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 999_999e18); // More than alice has
    }

    function test_RevertWhen_TransferToZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(address(0), 100e18);
    }
}
```

### Key Assertion Patterns

```solidity
// Equality
assertEq(actual, expected);
assertEq(actual, expected, "descriptive error message");

// Comparisons
assertGt(a, b);   // a > b
assertGe(a, b);   // a >= b
assertLt(a, b);   // a < b
assertLe(a, b);   // a <= b

// Approximate equality (for math with rounding)
assertApproxEqAbs(actual, expected, maxDelta);
assertApproxEqRel(actual, expected, maxPercentDelta); // in WAD (1e18 = 100%)

// Revert expectations
vm.expectRevert();                           // Any revert
vm.expectRevert("Insufficient balance");     // Specific message
vm.expectRevert(MyContract.CustomError.selector); // Custom error

// Event expectations
vm.expectEmit(true, true, false, true);      // (topic1, topic2, topic3, data)
emit MyEvent(expectedArg1, expectedArg2);
```

### What to Actually Test

```solidity
// ✅ TEST: Edge cases that lose money
function test_TransferZeroAmount() public { /* ... */ }
function test_TransferEntireBalance() public { /* ... */ }
function test_TransferToSelf() public { /* ... */ }
function test_ApproveOverwrite() public { /* ... */ }
function test_TransferFromWithExactAllowance() public { /* ... */ }

// ✅ TEST: Access control
function test_RevertWhen_NonOwnerCallsAdminFunction() public { /* ... */ }
function test_OwnerCanPause() public { /* ... */ }

// ✅ TEST: Failure modes
function test_RevertWhen_DepositZero() public { /* ... */ }
function test_RevertWhen_WithdrawMoreThanDeposited() public { /* ... */ }
function test_RevertWhen_ContractPaused() public { /* ... */ }

// ❌ DON'T TEST: OpenZeppelin internals
// function test_NameReturnsName() — they already tested this
// function test_SymbolReturnsSymbol() — waste of time
// function test_DecimalsReturns18() — it does, trust it
```

---

## Fuzz Testing

Foundry automatically fuzzes any test function with parameters. Instead of testing one value, it tests hundreds of random values.

### Basic Fuzz Test

```solidity
// Foundry calls this with random amounts
function testFuzz_DepositWithdrawRoundtrip(uint256 amount) public {
    // Bound input to valid range
    amount = bound(amount, 1, token.balanceOf(alice));

    uint256 balanceBefore = token.balanceOf(alice);

    vm.startPrank(alice);
    token.approve(address(vault), amount);
    vault.deposit(amount, alice);
    vault.withdraw(vault.balanceOf(alice), alice, alice);
    vm.stopPrank();

    // Property: user gets back what they deposited (minus any fees)
    assertGe(token.balanceOf(alice), balanceBefore - 1); // Allow 1 wei rounding
}
```

### Bounding Inputs

```solidity
// bound() is preferred over vm.assume() — bound reshapes, assume discards
function testFuzz_Fee(uint256 amount, uint256 feeBps) public {
    amount = bound(amount, 1e6, 1e30);       // Reasonable token amounts
    feeBps = bound(feeBps, 1, 10_000);       // 0.01% to 100%

    uint256 fee = (amount * feeBps) / 10_000;
    uint256 afterFee = amount - fee;

    // Property: fee + remainder always equals original
    assertEq(fee + afterFee, amount);
}

// vm.assume() discards inputs — use sparingly
function testFuzz_Division(uint256 a, uint256 b) public {
    vm.assume(b > 0); // Skip zero (would revert)
    // ...
}
```

### Run with More Iterations

```bash
# Default: 256 runs
forge test

# More thorough: 10,000 runs
forge test --fuzz-runs 10000

# Set in foundry.toml for CI
# [fuzz]
# runs = 1000
```

---

## Fork Testing

Test your contract against real deployed protocols on a mainnet fork. This catches integration bugs that mocks can't.

### Basic Fork Test

```solidity
contract SwapTest is Test {
    // Real mainnet addresses — full verified list: addresses/SKILL.md
    address constant UNISWAP_ROUTER = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function setUp() public {
        // Fork mainnet at a specific block for reproducibility
        vm.createSelectFork("mainnet", 19_000_000);
    }

    function test_SwapETHForUSDC() public {
        address user = makeAddr("user");
        vm.deal(user, 1 ether);

        vm.startPrank(user);

        // Build swap path
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: 3000,
                recipient: user,
                amountIn: 0.1 ether,
                amountOutMinimum: 0, // In production, NEVER set to 0
                sqrtPriceLimitX96: 0
            });

        // Execute swap
        uint256 amountOut = ISwapRouter(UNISWAP_ROUTER).exactInputSingle{value: 0.1 ether}(params);

        vm.stopPrank();

        // Verify we got USDC back
        assertGt(amountOut, 0, "Should receive USDC");
        assertGt(IERC20(USDC).balanceOf(user), 0);
    }
}
```

### When to Fork-Test

- **Always:** Any contract that calls an external protocol (Uniswap, Aave, Chainlink)
- **Always:** Any contract that handles tokens with quirks (USDT, fee-on-transfer, rebasing)
- **Always:** Any contract that reads oracle prices
- **Never:** Pure logic contracts with no external calls — use unit tests

### Running Fork Tests

```bash
# Fork from RPC URL
forge test --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Fork at specific block (reproducible)
forge test --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY --fork-block-number 19000000

# Set in foundry.toml to avoid CLI flags
# [rpc_endpoints]
# mainnet = "${MAINNET_RPC_URL}"
```

---

## Invariant Testing

Invariant tests verify that properties hold across thousands of random function call sequences. Essential for stateful protocols.

### What Are Invariants?

Invariants are properties that must ALWAYS be true, no matter what sequence of actions users take:

- "Total supply equals sum of all balances" (ERC-20)
- "Total deposits equals total shares times share price" (vault)
- "x * y >= k after every swap" (AMM)
- "User can always withdraw what they deposited" (escrow)

### Basic Invariant Test

```solidity
contract VaultInvariantTest is Test {
    MyVault public vault;
    IERC20 public token;
    VaultHandler public handler;

    function setUp() public {
        token = new MockERC20("Test", "TST", 18);
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        // Tell Foundry which contract to call randomly
        targetContract(address(handler));
    }

    // This runs after every random sequence
    function invariant_TotalAssetsMatchesBalance() public view {
        assertEq(
            vault.totalAssets(),
            token.balanceOf(address(vault)),
            "Total assets must equal actual balance"
        );
    }

    function invariant_SharePriceNeverZero() public view {
        if (vault.totalSupply() > 0) {
            assertGt(vault.convertToAssets(1e18), 0, "Share price must never be zero");
        }
    }
}

// Handler: guided random actions
contract VaultHandler is Test {
    MyVault public vault;
    IERC20 public token;

    constructor(MyVault _vault, IERC20 _token) {
        vault = _vault;
        token = _token;
    }

    function deposit(uint256 amount) public {
        amount = bound(amount, 1, 1e24);
        deal(address(token), msg.sender, amount);

        vm.startPrank(msg.sender);
        token.approve(address(vault), amount);
        vault.deposit(amount, msg.sender);
        vm.stopPrank();
    }

    function withdraw(uint256 shares) public {
        uint256 maxShares = vault.balanceOf(msg.sender);
        if (maxShares == 0) return;
        shares = bound(shares, 1, maxShares);

        vm.prank(msg.sender);
        vault.redeem(shares, msg.sender, msg.sender);
    }
}
```

### Running Invariant Tests

```bash
# Default depth (15 calls per sequence, 256 sequences)
forge test

# Deeper exploration
forge test --fuzz-runs 1000

# Configure in foundry.toml
# [invariant]
# runs = 512
# depth = 50
```

---

## What NOT to Test

- **OpenZeppelin internals.** Don't test that `ERC20.transfer` works. It's been audited by dozens of firms and used by thousands of contracts. Test YOUR logic on top of it.
- **Solidity language features.** Don't test that `require` reverts or that `mapping` stores values. The compiler works.
- **Every getter.** If `name()` returns the name you passed to the constructor, that's not a test — it's a tautology.
- **Happy path only.** The happy path probably works. Test the unhappy paths: what happens with zero? Max uint? Unauthorized callers? Reentrancy?

**Focus your testing effort on:** Custom business logic, mathematical operations, integration points with external protocols, access control boundaries, and economic edge cases.

---

## Pre-Deploy Test Checklist

- [ ] All custom logic has unit tests with edge cases
- [ ] Zero amounts, max uint, empty arrays, self-transfers tested
- [ ] Access control verified — unauthorized calls revert
- [ ] Fuzz tests on all mathematical operations (minimum 1000 runs)
- [ ] Fork tests for every external protocol integration
- [ ] Invariant tests for stateful protocols (vaults, AMMs, lending)
- [ ] Events verified with `expectEmit`
- [ ] Gas snapshots taken with `forge snapshot` to catch regressions
- [ ] Static analysis with `slither .` — no high/medium findings unaddressed
- [ ] All tests pass: `forge test -vvv`
---
name: orchestration
description: How an AI agent plans, builds, and deploys a complete Ethereum dApp. The three-phase build system for Scaffold-ETH 2 projects. Use when building a full application on Ethereum — from contracts to frontend to production deployment on IPFS.
---

# dApp Orchestration

## What You Probably Got Wrong

**SE2 has specific patterns you must follow.** Generic "build a dApp" advice won't work. SE2 auto-generates `deployedContracts.ts` — DON'T edit it. Use Scaffold hooks, NOT raw wagmi. External contracts go in `externalContracts.ts` BEFORE building the frontend.

**There are three phases. Never skip or combine them.** Contracts → Frontend → Production. Each has validation gates.

## The Three-Phase Build System

| Phase | Environment | What Happens |
|-------|-------------|-------------|
| **Phase 1** | Local fork | Contracts + UI on localhost. Iterate fast. |
| **Phase 2** | Live network + local UI | Deploy contracts to mainnet/L2. Test with real state. Polish UI. |
| **Phase 3** | Production | Deploy frontend to IPFS/Vercel. Final QA. |

## Phase 1: Scaffold (Local)

### 1.1 Contracts

```bash
npx create-eth@latest my-dapp
cd my-dapp && yarn install
yarn fork --network base  # Terminal 1: fork of real chain (or mainnet, your target chain)
yarn deploy               # Terminal 2: deploy contracts
```

> **Always fork, never `yarn chain`.** `yarn fork` does everything `yarn chain` does AND gives you real protocol state — Uniswap, USDC, Aave, whale balances, everything already deployed (verified addresses: `addresses/SKILL.md`). `yarn chain` gives you an empty chain that tempts you into writing mock contracts you don't need. Don't mock what already exists onchain — just fork it.

**Critical steps:**
1. Write contracts in `packages/foundry/contracts/` (or `packages/hardhat/contracts/`)
2. Write deploy script
3. Add ALL external contracts to `packages/nextjs/contracts/externalContracts.ts` — BEFORE Phase 1.2
4. Write tests (≥90% coverage)
5. Audit contracts before moving to frontend — fetch [audit/SKILL.md](https://ethskills.com/audit/SKILL.md) and run through it

**Validate:** `yarn deploy` succeeds. `deployedContracts.ts` auto-generated. Tests pass.

### 1.2 Frontend

```bash
yarn fork --network base  # Terminal 1: fork of real chain (has Uniswap, USDC, etc.)
yarn deploy --watch       # Terminal 2: auto-redeploy on changes
yarn start                # Terminal 3: Next.js at localhost:3000
```

**USE SCAFFOLD HOOKS, NOT RAW WAGMI:**

```typescript
// Read
const { data } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "balanceOf",
  args: [address],
  watch: true,
});

// Write
const { writeContractAsync, isMining } = useScaffoldWriteContract("YourContract");
await writeContractAsync({
  functionName: "swap",
  args: [tokenIn, tokenOut, amount],
  onBlockConfirmation: (receipt) => console.log("Done!", receipt),
});

// Events
const { data: events } = useScaffoldEventHistory({
  contractName: "YourContract",
  eventName: "SwapExecuted",
  fromBlock: 0n,
  watch: true,
});
```

### The Three-Button Flow (MANDATORY)

Any token interaction shows ONE button at a time:
1. **Switch Network** (if wrong chain)
2. **Approve Token** (if allowance insufficient)
3. **Execute Action** (only after 1 & 2 satisfied)

Never show Approve and Execute simultaneously.

### UX Rules

- **Human-readable amounts:** `formatEther()` / `formatUnits()` for display, `parseEther()` / `parseUnits()` for contracts
- **Loading states everywhere:** `isLoading`, `isMining` on all async operations
- **Disable buttons during pending txs** (blockchains take 5-12s)
- **Never use infinite approvals** — approve exact amount or 3-5x
- **Helpful errors:** Parse "insufficient funds," "user rejected," "execution reverted" into plain language

**Validate:** Full user journey works with real wallet on localhost. All edge cases handled.

## 🚨 NEVER COMMIT SECRETS TO GIT

**Before touching Phase 2, read this.** AI agents are the #1 source of leaked credentials on GitHub. Bots scrape repos in real-time and exploit leaked secrets within seconds.

**This means ALL secrets — not just wallet private keys:**
- **Wallet private keys** — funds drained in seconds
- **API keys** — Alchemy, Infura, Etherscan, WalletConnect project IDs
- **RPC URLs with embedded keys** — e.g. `https://base-mainnet.g.alchemy.com/v2/YOUR_KEY`
- **OAuth tokens, passwords, bearer tokens**

**⚠️ Common SE2 Trap: `scaffold.config.ts`**

`rpcOverrides` and `alchemyApiKey` in `scaffold.config.ts` are committed to Git. **NEVER paste API keys directly into this file.** Use environment variables:

```typescript
// ❌ WRONG — key committed to public repo
rpcOverrides: {
  [chains.base.id]: "https://base-mainnet.g.alchemy.com/v2/8GVG8WjDs-LEAKED",
},

// ✅ RIGHT — key stays in .env.local
rpcOverrides: {
  [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
},
```

**Before every `git add` or `git commit`:**
```bash
# Check for leaked secrets
git diff --cached --name-only | grep -iE '\.env|key|secret|private'
grep -rn "0x[a-fA-F0-9]\{64\}" packages/ --include="*.ts" --include="*.js" --include="*.sol"
# Check for hardcoded API keys in config files
grep -rn "g.alchemy.com/v2/[A-Za-z0-9]" packages/ --include="*.ts" --include="*.js"
grep -rn "infura.io/v3/[A-Za-z0-9]" packages/ --include="*.ts" --include="*.js"
# If ANYTHING matches, STOP. Move the secret to .env and add .env to .gitignore.
```

**Your `.gitignore` MUST include:**
```
.env
.env.*
*.key
broadcast/
cache/
node_modules/
```

**SE2 handles deployer keys by default** — `yarn generate` creates a `.env` with the deployer key, and `.gitignore` excludes it. **Don't override this pattern.** Don't copy keys into scripts, config files, or deploy logs. This includes RPC keys, API keys, and any credential — not just wallet keys.

See `wallets/SKILL.md` for full key safety guide, what to do if you've already leaked a key, and safe patterns for deployment.

## Phase 2: Live Contracts + Local UI

1. Update `scaffold.config.ts`: `targetNetworks: [mainnet]` (or your L2)
2. Fund deployer: `yarn generate` → `yarn account` → send real ETH
3. Deploy: `yarn deploy --network mainnet`
4. Verify immediately after deploy: `yarn verify --network mainnet`
   - **No block explorer API key needed** — SE2 handles this for you
   - Run it right after deploy, not later. Don't skip it.
5. Test with real wallet, small amounts ($1-10)
6. Polish UI — remove SE2 branding, custom styling

**Design rule:** NO LLM SLOP. No generic purple gradients. Make it unique.

**Validate:** Contracts verified on block explorer. Full journey works with real contracts.

## Phase 3: Production Deploy

### Pre-deploy Checklist
- `burnerWalletMode: "localNetworksOnly"` in scaffold.config.ts (prevents burner wallet on prod)
- Update metadata (title, description, OG image 1200x630px)
- Restore any test values to production values
- Run a full frontend QA audit — fetch [qa/SKILL.md](https://ethskills.com/qa/SKILL.md) and give it to a separate agent before deploying

### Deploy

**IPFS** — use [BGIPFS](https://www.bgipfs.com/SKILL.md) for decentralized deploys (fetch that skill for full details). It's built into SE2 — no setup needed:
```bash
yarn ipfs
# → https://{CID}.ipfs.community.bgipfs.com/
```
Note: IPFS only works with static content — no server-side rendering, API endpoints, or functions.

**Vercel:**
```bash
yarn vercel
```

### Production QA
- [ ] App loads on public URL
- [ ] Wallet connects, network switching works
- [ ] Read + write contract operations work
- [ ] No console errors
- [ ] Burner wallet NOT showing
- [ ] OG image works in link previews
- [ ] Mobile responsive
- [ ] Tested with MetaMask, Rainbow, WalletConnect

## Phase Transition Rules

**Phase 3 bug → go back to Phase 2** (fix with local UI + prod contracts)
**Phase 2 contract bug → go back to Phase 1** (fix locally, write regression test, redeploy)
**Never hack around bugs in production.**

## Key SE2 Directories

```
packages/
├── foundry/contracts/          # Solidity contracts
├── foundry/script/             # Deploy scripts
├── foundry/test/               # Tests
└── nextjs/
    ├── app/                    # Pages
    ├── components/             # React components
    ├── contracts/
    │   ├── deployedContracts.ts   # AUTO-GENERATED (don't edit)
    │   └── externalContracts.ts   # YOUR external contracts (edit this)
    ├── hooks/scaffold-eth/     # USE THESE hooks
    └── scaffold.config.ts      # Main config
```

## Resources

- **SE2 Docs:** https://docs.scaffoldeth.io/
- **SE2 Skill:** https://docs.scaffoldeth.io/SKILL.md
- **UI Components:** https://ui.scaffoldeth.io/
- **SE2 AGENTS.md:** https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md
---
name: frontend-ux
description: Frontend UX rules for Ethereum dApps that prevent the most common AI agent UI bugs. Mandatory patterns for onchain buttons, approval flows, address UX, USD context, RPC reliability, theming, and pre-publish metadata. Use whenever you are building a frontend for an Ethereum dApp.
---

# Frontend UX Rules

## What You Probably Got Wrong

**"The button works."** A clickable button is not enough. It must disable immediately, show a clear pending state, and stay locked until onchain confirmation.

**"Addresses are just strings."** Address UX needs validation, safe formatting, copy support, explorer linking, and ENS/name handling where available.

**"Token amounts are clear."** Raw token values without USD context force users to guess risk and value. Show dollar context anywhere amounts matter.

---

## Rule 1: Every Button Interacting Onchain Needs Its Own Pending State

Any button that triggers an onchain transaction must:
1. Disable immediately on click
2. Show spinner + action text (`Approving...`, `Staking...`)
3. Stay disabled until chain state confirms completion
4. Show success/error feedback when done

```typescript
// Separate loading state per action
const [isApproving, setIsApproving] = useState(false);
const [isStaking, setIsStaking] = useState(false);

<button
  disabled={isApproving}
  onClick={async () => {
    setIsApproving(true);
    try {
      await sendApproveTx();
    } catch (e) {
      notifyError("Approval failed");
    } finally {
      setIsApproving(false); // always release — even on rejection
    }
  }}
>
  {isApproving ? "Approving..." : "Approve"}
</button>
```

Never use one shared `isLoading` state for multiple buttons. It causes wrong labels, wrong disabled states, and duplicate submissions.

**For approval flows: `isPending` alone is not enough.**

`isPending` drops to `false` when the wallet returns the tx hash — before on-chain confirmation. There is a window where `isPending = false` AND the allowance hasn't updated → button re-enables mid-flight and a user can double-submit.

Approval handlers need two states: `approvalSubmitting` (set on click, cleared in `finally {}`) to cover the wallet→confirmation gap, and `approveCooldown` (set after confirm, cleared after 4s + refetch) to cover the confirmation→cache gap. Both go on `disabled`. `finally {}` is required — without it a rejected tx locks the button permanently.

---

## Rule 2: Four-State Action Flow

Show one primary action at a time:

```
1. Not connected  -> Connect Wallet
2. Wrong network  -> Switch Network
3. Needs approval -> Approve
4. Ready          -> Execute action (Stake/Deposit/Swap/etc.)
```

Critical details:
- Wrong-network check must happen before approval/action checks
- Never show Approve and Execute simultaneously
- Approval status must come from fresh onchain state (not stale local state only)
- Connection state must render a clickable action, not passive text

---

## Rule 3: UX Standards for Addresses

Every displayed address should support:
- ENS/name resolution (where applicable)
- Explorer linking
- Copy-to-clipboard
- Safe truncation + visual identity (avatar/blockie optional)

Every address input should support:
- Validation
- Paste normalization
- ENS/name resolution where available

If your UI kit includes dedicated address components, use them. Do not use a raw free-text field for critical address entry.

---

## Rule 4: Show USD Context for Token Values

Every token/ETH amount shown to users should include USD context:
- Balances
- Inputs (live preview)
- Confirmation text
- Position/portfolio summaries

```typescript
<span>0.5 ETH (~$1,250.00)</span>
<span>1,000 TOKEN (~$4.20)</span>
```

Do not show only token units without value context.

---

## Rule 5: RPC Reliability and Polling

- Use a dedicated RPC provider for production (not accidental public fallback only)
- Keep polling interval in a responsive range (typically ~2-5s for interactive apps)
- Ensure fallback transports are intentional and rate-limit aware
- Watch for runaway request patterns (render loops, duplicate watchers, unbounded polling)

Healthy baseline: low, steady request volume. Spiky or sustained high QPS usually indicates frontend hook/config bugs.

---

## Rule 6: Theme Semantics, Not Hardcoded Dark Wrappers

Do not hardcode full-page dark backgrounds that ignore theme/system preference.

Use semantic theme tokens/classes so light/dark mode stays coherent across:
- Page background
- Surface layers
- Primary/secondary text
- Component states

If you intentionally ship dark-only, remove or disable theme controls that no longer apply.

---

## Rule 7: Contract Error Translation

Users should never see raw revert selectors or silent failures.

Implement:
1. Error extraction from ABI/custom errors
2. Mapping to human-readable messages
3. Wallet-level error handling (reject, gas issues)
4. Safe fallback message
5. Inline persistent error UI near the triggering action

```tsx
try {
  await sendTx();
} catch (e) {
  setTxError(parseContractError(e));
}
```

---

## Rule 8: Pre-Publish Metadata and Product Identity

Before production release:
- Open Graph image URL is absolute and reachable on live domain (`https://...`)
- OG/Twitter title + description are set correctly
- Social preview image is valid and not local/relative
- Template/default branding is removed or replaced with project identity
- Favicon and tab title reflect the app

---

## Rule 9: Human-Readable Amounts and Decimals

Always convert between contract units and display units:

```typescript
import { formatEther, formatUnits, parseEther, parseUnits } from "viem";

formatEther(weiAmount);
formatUnits(tokenAmount, tokenDecimals);

parseEther("1.5");
parseUnits("100", 6); // USDC-style 6 decimals
```

Never show raw base units like `1500000000000000000`.

---

Before you finish: send a one-line note via [feedback/SKILL.md](https://ethskills.com/feedback/SKILL.md) — issue or praise.
---
name: tools
description: Current Ethereum development tools, frameworks, libraries, RPCs, and block explorers. What actually works today for building on Ethereum. Includes tool discovery for AI agents — MCPs, abi.ninja, Foundry, Scaffold-ETH 2, Hardhat, and more. Use when setting up a dev environment, choosing tools, or when an agent needs to discover what's available.
---

# Ethereum Development Tools

## What You Probably Got Wrong

**Blockscout MCP server exists:** https://mcp.blockscout.com/mcp — gives AI agents structured blockchain data via Model Context Protocol. This is cutting-edge infra as of Feb 2026.

**abi.ninja is essential:** https://abi.ninja — paste any verified contract address, get a UI to call any function. Zero setup. Supports mainnet + all major L2s. Perfect for agent-driven contract exploration.

**x402 has production SDKs:** `@x402/fetch` (TS), `x402` (Python), `github.com/coinbase/x402/go` — production-ready libraries for HTTP payments.

**Foundry and Hardhat 3 are both legitimate choices in 2026.** Foundry: faster, Solidity-native. Hardhat 3: TypeScript-first, mature plugin ecosystem.

## Tool Discovery Pattern for AI Agents

When an agent needs to interact with Ethereum:

1. **Read operations:** Blockscout MCP or Etherscan API
2. **Write operations:** Foundry `cast send` or ethers.js/viem
3. **Contract exploration:** abi.ninja (browser) or `cast interface` (CLI)
4. **Testing:** Fork mainnet with `anvil`, test locally
5. **Deployment:** `forge create` or `forge script`
6. **Verification:** `forge verify-contract` or Etherscan API

## Blockscout MCP Server

**URL:** https://mcp.blockscout.com/mcp

A Model Context Protocol server giving AI agents structured blockchain data:
- Transaction, address, contract queries
- Token info and balances
- Smart contract interaction helpers
- Multi-chain support
- Standardized interface optimized for LLM consumption

**Why this matters:** Instead of scraping Etherscan or making raw API calls, agents get structured, type-safe blockchain data via MCP.

## abi.ninja

**URL:** https://abi.ninja — Paste any contract address → interact with all functions. Multi-chain. Zero setup.

## x402 SDKs (HTTP Payments)

**TypeScript:**
```bash
npm install @x402/core @x402/evm @x402/fetch @x402/express
```

```typescript
import { x402Fetch } from '@x402/fetch';
import { createWallet } from '@x402/evm';

const wallet = createWallet(privateKey);
const response = await x402Fetch('https://api.example.com/data', {
  wallet,
  preferredNetwork: 'eip155:8453' // Base
});
```

**Python:** `pip install x402`
**Go:** `go get github.com/coinbase/x402/go`
**Docs:** https://www.x402.org | https://github.com/coinbase/x402

## Scaffold-ETH 2

- **Setup:** `npx create-eth@latest`
- **What:** Full-stack Ethereum toolkit: Solidity + Next.js + Foundry
- **Key feature:** Auto-generates TypeScript types from contracts. Scaffold hooks make contract interaction trivial.
- **Deploy to IPFS:** `yarn ipfs` (BuidlGuidl IPFS)
- **UI Components:** https://ui.scaffoldeth.io/
- **Docs:** https://docs.scaffoldeth.io/

## Choosing Your Stack (2026)

| Need | Tool |
|------|------|
| Rapid prototyping / full dApps | **Scaffold-ETH 2** |
| Contract-focused dev | **Foundry** (forge + cast + anvil) · or **Hardhat 3** if TypeScript-first |
| Quick contract interaction | **abi.ninja** (browser) or **cast** (CLI) |
| React frontends | **wagmi + viem** (or SE2 which wraps these) |
| Agent blockchain reads | **Blockscout MCP** |
| Agent payments | **x402 SDKs** |

## Essential Foundry cast Commands

```bash
# Read contract
cast call 0xAddr "balanceOf(address)(uint256)" 0xWallet --rpc-url $RPC

# Send transaction
cast send 0xAddr "transfer(address,uint256)" 0xTo 1000000 --private-key $KEY --rpc-url $RPC

# Gas price
cast gas-price --rpc-url $RPC

# Decode calldata
cast 4byte-decode 0xa9059cbb...

# ENS resolution
cast resolve-name vitalik.eth --rpc-url $RPC

# Fork mainnet locally
anvil --fork-url $RPC
```

## RPC Providers

**Free (testing):**
- `https://eth.llamarpc.com` — LlamaNodes, no key
- `https://rpc.ankr.com/eth` — Ankr, free tier

**Paid (production):**
- **Alchemy** — most popular, generous free tier (300M CU/month)
- **Infura** — established, MetaMask default
- **QuickNode** — performance-focused

**Community:** `rpc.buidlguidl.com`

## Block Explorers

| Network | Explorer | API |
|---------|----------|-----|
| Mainnet | https://etherscan.io | https://api.etherscan.io |
| Arbitrum | https://arbiscan.io | Etherscan-compatible |
| Base | https://basescan.org | Etherscan-compatible |
| Optimism | https://optimistic.etherscan.io | Etherscan-compatible |

## MCP Servers for Agents

**Model Context Protocol** — standard for giving AI agents structured access to external systems.

1. **Blockscout MCP** — multi-chain blockchain data (primary)
2. **eth-mcp** — community Ethereum RPC via MCP
3. **Custom MCP wrappers** emerging for DeFi protocols, ENS, wallets

MCP servers are composable — agents can use multiple together.

## What Changed in 2025-2026

- **Foundry became the default** over Hardhat for new projects — then Hardhat 3 (Aug 2025) shipped Solidity testing, fuzzing, and Rust internals, making it a legitimate choice again.
- **Viem gaining on ethers.js** (smaller, better TypeScript)
- **MCP servers emerged** for agent-blockchain interaction
- **x402 SDKs** went production-ready
- **ERC-8004 tooling** emerging (agent registration/discovery)
- **Deprecated:** Truffle (use Foundry/Hardhat), Goerli/Rinkeby (use Sepolia)

## Testing Essentials

**Fork mainnet locally:**
```bash
anvil --fork-url https://eth.llamarpc.com
# Now test against real contracts with fake ETH at http://localhost:8545
```

**Primary testnet:** Sepolia (Chain ID: 11155111). Goerli and Rinkeby are deprecated.

### Testnet ETH Faucets

| Network | Faucet |
|---------|--------|
| Sepolia | https://sepolia-faucet.pk910.de/ |
| Sepolia | https://www.infura.io/faucet/sepolia |
| Multiple | https://www.alchemy.com/faucets |
| Multiple | https://cloud.google.com/application/web3/faucet/ethereum |
| Multiple | https://faucet.quicknode.com/drip |
| Multiple | https://getblock.io/faucet/ |

Once you have Sepolia ETH you can bridge it to any L2 using each L2's testnet bridge then you will have ETH on that L2 testnet.
---
name: qa
description: Pre-ship audit checklist for Ethereum dApps built with Scaffold-ETH 2. Give this to a separate reviewer agent (or fresh context) AFTER the build is complete. Use this skill whenever you are finalizing a dApp built with Scaffold-ETH 2.
---

# dApp QA — Pre-Ship Audit For Scaffold-ETH 2 Builds

## What You Probably Got Wrong

**"The app deployed, so we are done."** For SE2 builds, shipping includes UX correctness, metadata, RPC reliability, contract verification, and branding cleanup.

**"The flow is obvious."** If Connect, Network, Approve, and Action are not strictly one-at-a-time with proper pending states, users will make duplicate or failing transactions.

**"SE2 defaults are fine in production."** Default README/footer/title/favicon and default RPC fallbacks are template scaffolding, not production decisions.

**"Pass means no console errors."** QA pass/fail here is behavioral and user-facing: real wallet flow, mobile deep-link behavior, readable errors, and trust signals must be validated.

Give this to a fresh agent after the dApp is built. The reviewer should:

1. Read the source code (`app/`, `components/`, `contracts/`)
2. Open the app in a browser and click through every flow
3. Check every item below — report PASS/FAIL, don't fix

Fetch `crops/SKILL.md` first and include a CROPS Review in the report. Simple apps can get a concise baseline review; apps with funds, approvals, custody, wallet permissions, L2/bridge flows, private user data, identity, stablecoins, admin powers, or hosted RPC/indexer/relayer/paymaster/frontend infrastructure need the full four-pillar review.

---

## 🚨 Critical: Wallet Flow — Button Not Text

Open the app with NO wallet connected.

- ❌ **FAIL:** Text saying "Connect your wallet to play" / "Please connect to continue" / any paragraph telling the user to connect
- ✅ **PASS:** A big, obvious Connect Wallet **button** is the primary UI element

**This is the most common AI agent mistake.** Every stock LLM writes a `<p>Please connect your wallet</p>` instead of rendering `<RainbowKitCustomConnectButton />`.

---

## 🚨 Critical: Four-State Button Flow

The app must show exactly ONE primary button at a time, progressing through:

```
1. Not connected  → Connect Wallet button
2. Wrong network  → Switch to [Chain] button
3. Needs approval → Approve button
4. Ready          → Action button (Stake/Deposit/Swap)
```

Check specifically:
- ❌ **FAIL:** Approve and Action buttons both visible simultaneously
- ❌ **FAIL:** No network check — app tries to work on wrong chain and fails silently
- ❌ **FAIL:** Main onchain CTA renders instead of a "Switch to [Chain]" button when the connected wallet is on the wrong network. SE-2's header `WrongNetworkDropdown` is **not sufficient** — the action button itself must become the switch CTA, or the user clicks Sign/Stake/Deposit on the wrong chain and eats a silent wagmi error.
- ❌ **FAIL:** User can click Approve, sign in wallet, come back, and click Approve again while tx is pending
- ✅ **PASS:** One button at a time. Approve button shows spinner, stays disabled until block confirms onchain. Then switches to the action button.
- ✅ **PASS:** Action button's render path branches on `useChainId() === targetNetwork.id` (or equivalent); mismatch renders a `useSwitchChain`-driven "Switch to [Chain]" button in the **same slot** as the primary CTA.

**In the code:** the button's `disabled` prop must be tied to `isPending` from `useScaffoldWriteContract`. Verify it uses `useScaffoldWriteContract` (waits for block confirmation), NOT raw wagmi `useWriteContract` (resolves on wallet signature):

```
grep -rn "useWriteContract" packages/nextjs/
```
Any match outside scaffold-eth internals → bug.

**Watch out: two gaps, both allow double-approve.**

`isPending` from wagmi drops to `false` when the wallet returns the tx hash — not when the tx confirms. `writeContractAsync` is still awaiting confirmation. During that window `isPending = false` AND `approveCooldown = false` → button re-enables mid-flight.

Fix requires TWO states:
- `approvalSubmitting` — set at top of handler, cleared in `finally {}` (covers click→hash gap)
- `approveCooldown` — set after `await` resolves, cleared after 4s + refetch (covers confirm→cache gap)

```tsx
const [approvalSubmitting, setApprovalSubmitting] = useState(false);
const [approveCooldown, setApproveCooldown] = useState(false);

const handleApprove = async () => {
  if (approvalSubmitting || approveCooldown) return;
  setApprovalSubmitting(true);
  try {
    await approveWrite({ functionName: "approve", args: [spender, amount] });
    setApproveCooldown(true);
    setTimeout(() => { setApproveCooldown(false); refetchAllowance(); }, 4000);
  } catch (e) {
    notifyError("Approval failed");
  } finally {
    setApprovalSubmitting(false); // must be finally — releases on rejection too
  }
};

<button disabled={isPending || approvalSubmitting || approveCooldown}>
```

- ❌ **FAIL:** Button `disabled` only reads `isPending` or only `approveCooldown`
- ❌ **FAIL:** No `approvalSubmitting` state, or it's not cleared in `finally {}`
- ✅ **PASS:** `disabled={isPending || approvalSubmitting || approveCooldown}` with both states managed correctly

---

## 🚨 Critical: SE2 Branding Removal

AI agents treat the scaffold as sacred and leave all default branding in place.

- [ ] **Footer:** Remove BuidlGuidl links, "Built with 🏗️ SE2", "Fork me" link, support links. Replace with project's own repo link or clean it out
- [ ] **Tab title:** Must be the app name, NOT "Scaffold-ETH 2" or "SE-2 App" or "App Name | Scaffold-ETH 2"
- [ ] **README:** Must describe THIS project. Not the SE2 template README. Remove "Built with Scaffold-ETH 2" sections and SE2 doc links
- [ ] **Favicon:** Must not be the SE2 default

---

## Important: CROPS Review for Trust Assumptions

- ❌ **FAIL:** No `CROPS Review` block in the QA report.
- ❌ **FAIL:** The CROPS Review lists generic values but does not name who can block users, what data leaks, who controls funds/upgrades/recovery, and how users exit.
- ❌ **FAIL:** The app has production-relevant trust assumptions (funds, approvals, custody, wallet permissions, L2/bridge, private data, identity, stablecoins, admin powers, hosted RPC/indexer/relayer/paymaster/frontend) but the CROPS Review is only a short gate and never uses `crops/SKILL.md` for the deep template.
- ✅ **PASS:** A concrete `CROPS Review` block is present, names the chosen default, accepted compromises, and the user's escape path. Depth matches the app's trust assumptions.

---

## Important: Contract Address Display

- ❌ **FAIL:** The deployed contract address appears nowhere on the page
- ✅ **PASS:** Contract address displayed using `<Address/>` component (blockie, ENS, copy, explorer link)

Agents display the connected wallet address but forget to show the contract the user is interacting with.

---

## Important: Address Input — Always `<AddressInput/>`

**EVERY input that accepts an Ethereum address must use `<AddressInput/>`, not a plain `<input type="text">`.**

- ❌ **FAIL:** `<input type="text" placeholder="0x..." value={addr} onChange={e => setAddr(e.target.value)} />`
- ✅ **PASS:** `<AddressInput value={addr} onChange={setAddr} placeholder="0x... or ENS name" />`

`<AddressInput/>` gives you ENS resolution (type "vitalik.eth" → resolves to address), blockie avatar preview, validation, and paste handling. A raw text input is unacceptable for address collection.

**In SE2, it's in `@scaffold-ui/components`:**
```typescript
import { AddressInput } from "@scaffold-ui/components";
// or
import { AddressInput } from "~~/components/scaffold-eth"; // if re-exported
```

**Quick check:**
```bash
grep -rn 'type="text"' packages/nextjs/app/ | grep -i "addr\|owner\|recip\|0x"
grep -rn 'placeholder="0x' packages/nextjs/app/
```
Any match → **FAIL**. Replace with `<AddressInput/>`.

The pair: `<Address/>` for **display**, `<AddressInput/>` for **input**. Always.

---

## Important: USD Values

- ❌ **FAIL:** Token amounts shown as "1,000 TOKEN" or "0.5 ETH" with no dollar value
- ✅ **PASS:** "0.5 ETH (~$1,250)" with USD conversion

Agents never add USD values unprompted. Check every place a token or ETH amount is displayed, including inputs.

---

## Important: OG Image Must Be Absolute URL

- ❌ **FAIL:** `images: ["/thumbnail.jpg"]` — relative path, breaks unfurling everywhere
- ✅ **PASS:** `images: ["https://yourdomain.com/thumbnail.jpg"]` — absolute production URL

Quick check:
```
grep -n "og:image\|images:" packages/nextjs/app/layout.tsx
```

---

## Important: RPC & Polling Config

Open `packages/nextjs/scaffold.config.ts`:

- ❌ **FAIL:** `pollingInterval: 30000` (default — makes the UI feel broken, 30 second update lag)
- ✅ **PASS:** `pollingInterval: 3000`
- ❌ **FAIL:** Using default Alchemy API key that ships with SE2
- ❌ **FAIL:** Code references `process.env.NEXT_PUBLIC_*` but the variable isn't actually set in the deployment environment (Vercel/hosting). Falls back to public RPC like `mainnet.base.org` which is rate-limited
- ✅ **PASS:** `rpcOverrides` uses `process.env.NEXT_PUBLIC_*` variables AND the env var is confirmed set on the hosting platform
- ❌ **FAIL:** `services/web3/wagmiConfig.tsx` still includes bare `http()` fallback transport (silently hits public RPCs in parallel, causing rate limits)
- ✅ **PASS:** Bare `http()` fallback removed; only intended configured transports remain

**Verify the env var is set, not just referenced.** AI agents will change the code to use `process.env`, see the pattern matches PASS, and move on — without ever setting the actual variable on Vercel/hosting. Check:
```bash
vercel env ls | grep RPC
```

---

## Important: SE2 `externalContracts.ts` Registration

Scaffold hooks only work with contracts registered in `deployedContracts.ts` (auto-generated) or `externalContracts.ts` (manual). If external contracts are not registered, frontend reads/writes silently fail.

- ❌ **FAIL:** Frontend code references token/protocol contracts that are missing from `packages/nextjs/contracts/externalContracts.ts`
- ❌ **FAIL:** `deployedContracts.ts` manually edited to add external contracts
- ✅ **PASS:** All external contracts are defined in `externalContracts.ts` with correct chain, address, and ABI

Example:
```typescript
export default {
  8453: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      abi: [...],
    },
  },
} as const;
```

Never edit `deployedContracts.ts` directly. It is regenerated on deploy.

---

## Important: Dark Mode — No Hardcoded Dark Backgrounds

AI agents love the aesthetic of a dark UI and will hardcode it directly on the page wrapper:

```tsx
// ❌ FAIL — hardcoded black background, ignores system preference AND DaisyUI theme
<div className="min-h-screen bg-[#0a0a0a] text-white">
```

This bypasses the entire DaisyUI theme system. Light-mode users get a black page. The `SwitchTheme` toggle in the SE2 header stops working. `prefers-color-scheme` is ignored.

**Check for this pattern:**
```bash
grep -rn 'bg-\[#0\|bg-black\|bg-gray-9\|bg-zinc-9\|bg-neutral-9\|bg-slate-9' packages/nextjs/app/
```
Any match on a root layout div or page wrapper → **FAIL**.

- ❌ **FAIL:** Root page wrapper uses a hardcoded hex color or Tailwind dark bg class (`bg-[#0a0a0a]`, `bg-black`, `bg-zinc-900`, etc.)
- ❌ **FAIL:** `SwitchTheme` toggle is present in the header but the page ignores `data-theme` entirely
- ✅ **PASS:** All backgrounds use DaisyUI semantic variables — `bg-base-100`, `bg-base-200`, `text-base-content`
- ✅ **PASS (dark-only exception):** Theme is explicitly forced via `data-theme="dark"` on `<html>` **AND** the `<SwitchTheme/>` component is removed from the header

**The fix:**
```tsx
// ✅ CORRECT — responds to light/dark toggle and prefers-color-scheme
<div className="min-h-screen bg-base-200 text-base-content">
```

---

## Important: Phantom Wallet in RainbowKit

Phantom is NOT in the SE2 default wallet list. A lot of users have Phantom — if it's missing, they can't connect.

- ❌ **FAIL:** Phantom wallet not in the RainbowKit wallet list
- ✅ **PASS:** `phantomWallet` is in `wagmiConnectors.tsx`

---

## Important: Mobile Deep Linking

**RainbowKit v2 / WalletConnect v2 does NOT auto-deep-link to the wallet app.** It relies on push notifications instead, which are slow and unreliable. You must implement deep linking yourself.

On mobile, when a user taps a button that needs a signature, it must open their wallet app. Test this: open the app on a phone, connect a wallet via WalletConnect, tap an action button — does the wallet app open with the transaction ready to sign?

- ❌ **FAIL:** Nothing happens, user has to manually switch to their wallet app
- ❌ **FAIL:** Deep link fires BEFORE the transaction — user arrives at wallet with nothing to sign
- ❌ **FAIL:** `window.location.href = "rainbow://"` called before `writeContractAsync()` — navigates away and the TX never fires
- ❌ **FAIL:** It opens the wrong wallet (e.g. opens MetaMask when user connected with Rainbow)
- ❌ **FAIL:** Deep links inside a wallet's in-app browser (unnecessary — you're already in the wallet)
- ✅ **PASS:** Every transaction button fires the TX first, then deep links to the correct wallet app after a delay

### How to implement it

**Pattern: `writeAndOpen` helper.** Fire the write call first (sends the TX request over WalletConnect), then deep link after a delay to switch the user to their wallet:

```typescript
const writeAndOpen = useCallback(
  <T,>(writeFn: () => Promise<T>): Promise<T> => {
    const promise = writeFn(); // Fire TX — does gas estimation + WC relay
    setTimeout(openWallet, 2000); // Switch to wallet AFTER request is relayed
    return promise;
  },
  [openWallet],
);

// Usage — wraps every write call:
await writeAndOpen(() => gameWrite({ functionName: "click", args: [...] }));
```

**Why 2 seconds?** `writeContractAsync` must estimate gas, encode calldata, and relay the signing request through WalletConnect's servers. 300ms is too fast — the wallet won't have received the request yet.

**Detecting the wallet:** `connector.id` from wagmi says `"walletConnect"`, NOT `"rainbow"` or `"metamask"`. You must check multiple sources:

```typescript
const openWallet = useCallback(() => {
  if (typeof window === "undefined") return;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile || window.ethereum) return; // Skip if desktop or in-app browser

  // Check connector, wagmi storage, AND WalletConnect session data
  const allIds = [connector?.id, connector?.name,
    localStorage.getItem("wagmi.recentConnectorId")]
    .filter(Boolean).join(" ").toLowerCase();

  let wcWallet = "";
  try {
    const wcKey = Object.keys(localStorage).find(k => k.startsWith("wc@2:client"));
    if (wcKey) wcWallet = (localStorage.getItem(wcKey) || "").toLowerCase();
  } catch {}
  const search = `${allIds} ${wcWallet}`;

  const schemes: [string[], string][] = [
    [["rainbow"], "rainbow://"],
    [["metamask"], "metamask://"],
    [["coinbase", "cbwallet"], "cbwallet://"],
    [["trust"], "trust://"],
    [["phantom"], "phantom://"],
  ];

  for (const [keywords, scheme] of schemes) {
    if (keywords.some(k => search.includes(k))) {
      window.location.href = scheme;
      return;
    }
  }
}, [connector]);
```

**Key rules:**
1. **Fire TX first, deep link second.** Never `window.location.href` before the write call
2. **Skip deep link if `window.ethereum` exists** — means you're already in the wallet's in-app browser
3. **Check WalletConnect session data** in localStorage — `connector.id` alone won't tell you which wallet
4. **Use simple scheme URLs** like `rainbow://` — not `rainbow://dapp/...` which reloads the page
5. **Wrap EVERY write call** — approve, action, claim, batch — not just the main one

---

## 🚨 Critical: Contract Verification on Block Explorer

After deploying, every contract MUST be verified on the block explorer. Unverified contracts are a trust red flag — users can't read the source code, and it looks like you're hiding something.

- ❌ **FAIL:** Block explorer shows "Contract source code not verified" for any deployed contract
- ✅ **PASS:** All deployed contracts show verified source code with a green checkmark on the block explorer

**How to check:** Take each contract address from `deployedContracts.ts`, open it on the block explorer (Etherscan, Basescan, Arbiscan, etc.), and look for the "Contract" tab with a ✅ checkmark. If it shows bytecode only — not verified.

**How to fix (SE2):**
```bash
yarn verify --network mainnet   # or base, arbitrum, optimism, etc.
```

**How to fix (Foundry):**
```bash
forge verify-contract <ADDRESS> <CONTRACT> --chain <CHAIN_ID> --etherscan-api-key $ETHERSCAN_API_KEY
```

AI agents frequently skip verification because `yarn deploy` succeeds and they move on. Deployment is not done until verification passes.

---

## Important: Button Loading State — DaisyUI `loading` Class Is Wrong

AI agents almost always implement button loading states incorrectly when using DaisyUI + SE2.

**The mistake:** Adding `loading` as a class directly on a `btn`:

```tsx
// ❌ FAIL — DaisyUI's `loading` class on a `btn` replaces the entire button content
// with a spinner that fills the full button. No text, misaligned, looks broken.
<button className={`btn btn-primary ${isPending ? "loading" : ""}`}>
  {isPending ? "Approving..." : "Approve"}
</button>
```

**The fix:** Remove `loading` from the button class, add an inline `loading-spinner` span inside the button alongside the text:

```tsx
// ✅ PASS — small spinner inside the button, text visible next to it
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm mr-2" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

**Check for this in code:**
```bash
grep -rn '"loading"' packages/nextjs/app/
```
Any `"loading"` string in a button's className → **FAIL**.

- ❌ **FAIL:** `className={... isPending ? "loading" : ""}` on a button
- ✅ **PASS:** `<span className="loading loading-spinner loading-sm" />` inside the button

---

## Important: SE2 Pill-Shaped Inputs (`--radius-field`)

SE2 DaisyUI theme defaults to `--radius-field: 9999rem`, which creates pill-shaped textareas/selects and often clips content.

- ❌ **FAIL:** `--radius-field: 9999rem` remains in `packages/nextjs/styles/globals.css`
- ✅ **PASS:** `--radius-field` is changed to `0.5rem` (or similar) in both light and dark theme blocks

Fix in theme (not per component):
```css
/* In BOTH @plugin "daisyui/theme" blocks */
--radius-field: 0.5rem;
```

Do not patch this by sprinkling `rounded-*` utility classes per input; fix it once at theme level.

---

## SE2 References

- Docs: https://docs.scaffoldeth.io/
- UI Components: https://ui.scaffoldeth.io/
- SpeedRun Ethereum: https://speedrunethereum.com/

---

## Audit Summary

Report each as PASS or FAIL:

### Ship-Blocking
- [ ] Wallet connection shows a BUTTON, not text
- [ ] Wrong network shows a Switch button **in the primary CTA slot** (not only in the header dropdown)
- [ ] One button at a time (Connect → Network → Approve → Action)
- [ ] Approve button locked through full cycle: `approvalSubmitting` (click→hash), `approveCooldown` (confirm→cache refresh) — both states required, both on the `disabled` prop
- [ ] Contracts verified on block explorer (Etherscan/Basescan/Arbiscan) — source code readable by anyone
- [ ] CROPS Review present in the QA report: names the chosen default, accepted compromises, who can block users, what data leaks, who controls funds/upgrades/recovery, and the user's escape path
- [ ] SE2 footer branding removed
- [ ] SE2 tab title removed
- [ ] SE2 README replaced

### Should Fix
- [ ] Contract address displayed with `<Address/>`
- [ ] Every address input uses `<AddressInput/>` — no raw `<input type="text">` for addresses
- [ ] USD values next to all token/ETH amounts
- [ ] OG image is absolute production URL
- [ ] pollingInterval is 3000
- [ ] RPC overrides set (not default SE2 key) AND env var confirmed set on hosting platform
- [ ] Favicon updated from SE2 default
- [ ] `--radius-field` in `globals.css` changed from `9999rem` to `0.5rem` (or similar) — no pill-shaped textareas
- [ ] Every contract error mapped to a human-readable message — no silent catch blocks, no raw hex selectors
- [ ] No hardcoded dark backgrounds — page wrapper uses `bg-base-200 text-base-content` (or `data-theme="dark"` forced + `<SwitchTheme/>` removed)
- [ ] Button loaders use inline `<span className="loading loading-spinner loading-sm" />` — NOT `className="... loading"` on the button itself
- [ ] Phantom wallet in RainbowKit wallet list
- [ ] Mobile: ALL transaction buttons deep link to wallet (fire TX first, then `setTimeout(openWallet, 2000)`)
- [ ] Mobile: wallet detection checks WC session data, not just `connector.id`
- [ ] Mobile: no deep link when `window.ethereum` exists (in-app browser)
---
name: frontend-playbook
description: The complete build-to-production pipeline for Ethereum dApps. Fork mode setup, IPFS deployment, Vercel config, ENS subdomain setup, and the full production checklist. Built around Scaffold-ETH 2 but applicable to any Ethereum frontend project. Use when deploying any dApp to production.
---

# Frontend Playbook

## What You Probably Got Wrong

**"I'll use `yarn chain`."** Wrong. `yarn chain` gives you an empty local chain with no protocols, no tokens, no state. `yarn fork --network base` gives you a copy of real Base with Uniswap, Aave, USDC, real whale balances — everything (verified addresses: `addresses/SKILL.md`). Always fork.

**"I deployed to IPFS and it works."** Did the CID change? If not, you deployed stale output. Did routes work? Without `trailingSlash: true`, every route except `/` returns 404. Did you check the OG image? Without `NEXT_PUBLIC_PRODUCTION_URL`, it points to `localhost:3000`.

**"I'll set up the project manually."** Don't. `npx create-eth@latest` handles everything — Foundry, Next.js, RainbowKit, scaffold hooks. Never run `forge init` or create Next.js projects from scratch.

---

## Fork Mode Setup

### Why Fork, Not Chain

```
yarn chain (WRONG)              yarn fork --network base (CORRECT)
└─ Empty local chain            └─ Fork of real Base mainnet
└─ No protocols                 └─ Uniswap, Aave, etc. available
└─ No tokens                    └─ Real USDC, WETH exist
└─ Testing in isolation         └─ Test against REAL state
```

### Setup

```bash
npx create-eth@latest          # Select: foundry, target chain, name
cd <project-name>
yarn install
yarn fork --network base       # Terminal 1: fork of real Base
yarn deploy                    # Terminal 2: deploy contracts to fork
yarn start                     # Terminal 3: Next.js frontend
```

### Critical: Chain ID Gotcha

**When using fork mode, the frontend target network MUST be `chains.foundry` (chain ID 31337), NOT the chain you're forking.**

The fork runs locally on Anvil with chain ID 31337. Even if you're forking Base:

```typescript
// scaffold.config.ts during development
targetNetworks: [chains.foundry],  // ✅ NOT chains.base!
```

Only switch to `chains.base` when deploying contracts to the REAL network.

### Enable Block Mining

```bash
# In a new terminal — REQUIRED for time-dependent logic
cast rpc anvil_setIntervalMining 1
```

Without this, `block.timestamp` stays FROZEN. Any contract logic using timestamps (deadlines, expiry, vesting) will break silently.

**Make it permanent** by editing `packages/foundry/package.json` to add `--block-time 1` to the fork script.

---

## Deploying to IPFS (Recommended)

IPFS is the recommended deploy path for SE2. Avoids Vercel's memory limits entirely. Produces a fully decentralized static site.

### Full Build Command

```bash
cd packages/nextjs
rm -rf .next out  # ALWAYS clean first

NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build

# Upload to BuidlGuidl IPFS
yarn bgipfs upload out
# Save the CID!
```

### Node 25+ localStorage Polyfill (REQUIRED)

Node.js 25+ ships a built-in `localStorage` object that's MISSING standard WebStorage API methods (`getItem`, `setItem`). This breaks `next-themes`, RainbowKit, and any library that calls `localStorage.getItem()` during static page generation.

**Error you'll see:**
```
TypeError: localStorage.getItem is not a function
Error occurred prerendering page "/_not-found"
```

**The fix:** Create `polyfill-localstorage.cjs` in `packages/nextjs/`:
```javascript
if (typeof globalThis.localStorage !== "undefined" &&
    typeof globalThis.localStorage.getItem !== "function") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
}
```

**Why `--require` and not `instrumentation.ts`?** Next.js spawns a separate build worker process for prerendering. `--require` injects into EVERY Node process (including workers). `next.config.ts` polyfill only runs in the main process. `instrumentation.ts` doesn't run in the build worker. Only `--require` works.

### IPFS Routing — Why Routes Break

IPFS gateways serve static files. No server handles routing. Three things MUST be true:

**1. `output: "export"` in next.config.ts** — generates static HTML files.

**2. `trailingSlash: true` (CRITICAL)** — This is the #1 reason routes break:
- `trailingSlash: false` (default) → generates `debug.html`
- `trailingSlash: true` → generates `debug/index.html`
- IPFS gateways resolve directories to `index.html` automatically, but NOT bare filenames
- Without trailing slash: `/debug` → 404 ❌
- With trailing slash: `/debug` → `debug/` → `debug/index.html` ✅

**3. Pages must survive static prerendering** — any page that crashes during `yarn build` (browser APIs at import time, localStorage) gets skipped silently → 404 on IPFS.

**The complete IPFS-safe next.config.ts pattern:**
```typescript
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";
if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

**SE2's block explorer pages** use `localStorage` at import time and crash during static export. Rename `app/blockexplorer` to `app/_blockexplorer-disabled` if not needed.

### Stale Build Detection

**The #1 IPFS footgun:** You edit code, then deploy the OLD build.

```bash
# MANDATORY after ANY code change:
rm -rf .next out                     # 1. Delete old artifacts
# ... run full build command ...     # 2. Rebuild from scratch
grep -l "YOUR_STRING" out/_next/static/chunks/app/*.js  # 3. Verify changes present

# Timestamp check:
stat -f '%Sm' app/page.tsx           # Source modified time
stat -f '%Sm' out/                   # Build output time
# Source NEWER than out/ = STALE BUILD. Rebuild first!
```

**The CID is proof:** If the IPFS CID didn't change after a deploy, you deployed the same content. A real code change ALWAYS produces a new CID.

### Verify Routes After Deploy

```bash
ls out/*/index.html                  # Each route has a directory + index.html
curl -s -o /dev/null -w "%{http_code}" -L "https://GATEWAY/ipfs/CID/debug/"
# Should return 200, not 404
```

---

## Deploying to Vercel (Alternative)

SE2 is a monorepo — Vercel needs special configuration.

### Configuration

1. **Root Directory:** `packages/nextjs`
2. **Install Command:** `cd ../.. && yarn install`
3. **Build Command:** leave default (`next build`)
4. **Output Directory:** leave default (`.next`)

```bash
# Via API:
curl -X PATCH "https://api.vercel.com/v9/projects/PROJECT_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rootDirectory": "packages/nextjs", "installCommand": "cd ../.. && yarn install"}'
```

### Common Failures

| Error | Cause | Fix |
|-------|-------|-----|
| "No Next.js version detected" | Root Directory not set | Set to `packages/nextjs` |
| "cd packages/nextjs: No such file" | Build command has `cd` | Clear it — root dir handles this |
| OOM / exit code 129 | SE2 monorepo exceeds 8GB | Use IPFS instead, or `vercel --prebuilt` |

### Decision Tree

```
Want to deploy SE2?
├─ IPFS (recommended) → yarn ipfs / manual build + upload
│   └─ Fully decentralized, no memory limits, works with ENS
├─ Vercel → Set rootDirectory + installCommand
│   └─ Fast CDN, but centralized. May OOM on large projects
└─ vercel --prebuilt → Build locally, push artifacts to Vercel
    └─ Best of both: local build power + Vercel CDN
```

---

## ENS Subdomain Setup

Two mainnet transactions to point an ENS subdomain at your IPFS deployment.

### Transaction 1: Create Subdomain (new apps only)

1. Open `https://app.ens.domains/yourname.eth`
2. Go to "Subnames" tab → "New subname"
3. Enter the label (e.g. `myapp`) → Next → Skip profile → Open Wallet → Confirm
4. If gas is stuck: switch MetaMask to Ethereum → Activity tab → "Speed up"

### Transaction 2: Set IPFS Content Hash

1. Navigate to `https://app.ens.domains/myapp.yourname.eth`
2. "Records" tab → "Edit Records" → "Other" tab
3. Paste in Content Hash field: `ipfs://<CID>`
4. Save → Open Wallet → Confirm in MetaMask

For **updates** to an existing app: skip Tx 1, only do Tx 2.

### Verify

```bash
# 1. Onchain content hash matches
RESOLVER=$(cast call 0x00000000000C2e074eC69A0dFb2997BA6C7d2e1e \
  "resolver(bytes32)(address)" $(cast namehash myapp.yourname.eth) \
  --rpc-url https://eth.llamarpc.com)
cast call $RESOLVER "contenthash(bytes32)(bytes)" \
  $(cast namehash myapp.yourname.eth) --rpc-url https://eth.llamarpc.com

# 2. Gateway responds (may take 5-15 min for cache)
curl -s -o /dev/null -w "%{http_code}" -L "https://myapp.yourname.eth.link"

# 3. OG metadata correct (not localhost)
curl -s -L "https://myapp.yourname.eth.link" | grep 'og:image'
```

**Use `.eth.link` NOT `.eth.limo`** — `.eth.link` works better on mobile.

---

## Go to Production — Complete Checklist

When the user says "ship it", follow this EXACT sequence.

### Step 1: Final Code Review 🤖
- All feedback incorporated
- No duplicate h1, no raw addresses, no shared isLoading
- `scaffold.config.ts` has `rpcOverrides` and `pollingInterval: 3000`

### Step 2: Choose Domain 👤
Ask: *"What subdomain do you want? e.g. `myapp.yourname.eth` → `myapp.yourname.eth.link`"*

### Step 3: Generate OG Image + Fix Metadata 🤖
- Create 1200×630 PNG (`public/thumbnail.png`) — NOT the stock SE2 thumbnail
- Set `NEXT_PUBLIC_PRODUCTION_URL` to the live domain
- Verify `og:image` will resolve to an absolute production URL

### Step 4: Clean Build + IPFS Deploy 🤖
```bash
cd packages/nextjs && rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://myapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build

# Verify before uploading:
ls out/*/index.html                        # Routes exist
grep 'og:image' out/index.html             # Not localhost
stat -f '%Sm' app/page.tsx                 # Source older than out/
stat -f '%Sm' out/

yarn bgipfs upload out                     # Save the CID
```

### Step 5: Share for Approval 👤
Send: *"Build ready for review: `https://community.bgipfs.com/ipfs/<CID>`"*
**Wait for approval before touching ENS.**

### Step 6: Set ENS 🤖
Create subdomain (if new) + set IPFS content hash. Two mainnet transactions.

### Step 7: Verify 🤖
- Content hash matches onchain
- `.eth.link` gateway responds with 200
- OG image loads correctly
- Routes work (`/debug/`, etc.)

### Step 8: Report 👤
*"Live at `https://myapp.yourname.eth.link` — ENS content hash confirmed onchain, unfurl metadata set."*

---

## Build Verification Process

A build is NOT done when the code compiles. It's done when you've tested it like a real user.

### Phase 1: Code QA (Automated)
- Scan `.tsx` files for raw address strings (should use `<Address/>`)
- Scan for shared `isLoading` state across multiple buttons
- Scan for missing `disabled` props on transaction buttons
- Verify RPC config and polling interval
- Verify OG metadata with absolute URLs
- Verify no public RPCs in any file

### Phase 2: Smart Contract Testing
```bash
forge test                    # All tests pass
forge test --fuzz-runs 10000  # Fuzz testing
```
Test edge cases: zero amounts, max amounts, unauthorized callers, reentrancy attempts.

### Phase 3: Browser Testing (THE REAL TEST)

Open the app and do a FULL walkthrough:

1. **Load the app** — does it render correctly?
2. **Check page title** — is it correct, not "Scaffold-ETH 2"?
3. **Connect wallet** — does the connect flow work?
4. **Wrong network** — connect on wrong chain, verify "Switch to Base" appears
5. **Switch network** — click the switch button, verify it works
6. **Approve flow** — verify approve button shows, click it, wait for tx, verify action button appears
7. **Main action** — click primary action, verify loader, wait for tx, verify state updates
8. **Error handling** — reject a transaction in wallet, verify UI recovers
9. **Address displays** — all addresses showing ENS/blockies, not raw hex?
10. **Share URL** — check OG unfurl (image, title, description)

### Phase 4: QA Sub-Agent (Complex Builds)
For bigger projects, spawn a sub-agent with fresh context. Give it the repo path and deployed URL. It reads all code against the UX rules, opens a browser, clicks through independently, and reports issues.

---

## Don't Do These

- ❌ `yarn chain` — use `yarn fork --network <chain>`
- ❌ `forge init` — use `npx create-eth@latest`
- ❌ Manual Next.js setup — SE2 handles it
- ❌ Manual wallet connection — SE2 has RainbowKit pre-configured
- ❌ Edit `deployedContracts.ts` — it's auto-generated by `yarn deploy`
- ❌ Hardcode API keys in `scaffold.config.ts` — use `.env.local`
- ❌ Use `mainnet.base.org` in production — use Alchemy or similar

---

## Resources

- **SE2 Docs:** https://docs.scaffoldeth.io/
- **UI Components:** https://ui.scaffoldeth.io/
- **SpeedRun Ethereum:** https://speedrunethereum.com/
- **ETH Tech Tree:** https://www.ethtechtree.com
- **BuidlGuidl IPFS:** https://upload.bgipfs.com
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

codex
The routed guidance changes one important behavior: no fake “automatic” late charging. The owner explicitly confirms return; settlement computes elapsed late days then, caps fees at the deposit, and transfers fee/refund atomically. A 30-day permissionless expiry prevents deposits remaining locked forever.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6d271d037d74066f6f4efa8143c38cd7bffd66ff
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,9 @@
+node_modules/
+dist/
+out/
+build/
+cache/
+broadcast/
+.env
+.env.local
+*.local
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73a4c8e52559b6927deb14b0b9128fa0683e76a4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @notice USDC escrow for person-to-person physical tool loans.
+/// @dev Tool metadata stays offchain; its hash permanently binds each loan to a listing.
+contract ToolshedEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Cancelled,
+        Expired
+    }
+
+    struct Loan {
+        address owner;
+        address borrower;
+        bytes32 toolId;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        uint40 dueAt;
+        Status status;
+    }
+
+    struct TrackRecord {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    uint256 public constant DAY = 1 days;
+    uint256 public constant EXPIRY_GRACE = 30 days;
+    IERC20 public immutable usdc;
+    uint256 public nextLoanId = 1;
+
+    mapping(uint256 => Loan) public loans;
+    mapping(address => TrackRecord) public trackRecords;
+
+    error InvalidTerms();
+    error NotBorrower();
+    error NotOwner();
+    error WrongStatus();
+    error TooEarly();
+
+    event LoanRequested(
+        uint256 indexed loanId,
+        bytes32 indexed toolId,
+        address indexed owner,
+        address borrower,
+        uint256 deposit,
+        uint256 dailyLateFee,
+        uint256 dueAt
+    );
+    event LoanActivated(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 lateDays, uint256 fee, uint256 refund);
+    event LoanExpired(uint256 indexed loanId, uint256 fee, uint256 refund);
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function requestLoan(
+        address owner,
+        bytes32 toolId,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        uint40 dueAt
+    ) external returns (uint256 loanId) {
+        if (
+            owner == address(0) || owner == msg.sender || toolId == bytes32(0) || deposit == 0
+                || dailyLateFee == 0 || dailyLateFee > deposit || dueAt <= block.timestamp
+        ) revert InvalidTerms();
+
+        loanId = nextLoanId++;
+        loans[loanId] = Loan({
+            owner: owner,
+            borrower: msg.sender,
+            toolId: toolId,
+            deposit: deposit,
+            dailyLateFee: dailyLateFee,
+            dueAt: dueAt,
+            status: Status.Requested
+        });
+        usdc.safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(
+            loanId, toolId, owner, msg.sender, deposit, dailyLateFee, dueAt
+        );
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert NotBorrower();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Cancelled;
+        usdc.safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Active) revert WrongStatus();
+        _settle(loanId, loan, Status.Settled);
+    }
+
+    /// @notice After a long grace period anyone may settle, preventing permanently stuck funds.
+    function settleExpired(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert WrongStatus();
+        if (block.timestamp <= uint256(loan.dueAt) + EXPIRY_GRACE) revert TooEarly();
+        _settle(loanId, loan, Status.Expired);
+    }
+
+    function quoteSettlement(uint256 loanId)
+        public
+        view
+        returns (uint256 lateDays, uint256 fee, uint256 refund)
+    {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) return (0, 0, loan.deposit);
+        if (block.timestamp > loan.dueAt) {
+            lateDays = (block.timestamp - loan.dueAt + DAY - 1) / DAY;
+        }
+        fee = lateDays * loan.dailyLateFee;
+        if (fee > loan.deposit) fee = loan.deposit;
+        refund = loan.deposit - fee;
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        TrackRecord memory record = trackRecords[member];
+        if (record.completedLoans == 0) return 10_000;
+        return
+            (uint256(record.completedLoans - record.lateReturns) * 10_000)
+                / record.completedLoans;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan, Status status) private {
+        (uint256 lateDays, uint256 fee, uint256 refund) = quoteSettlement(loanId);
+        loan.status = status;
+        TrackRecord storage record = trackRecords[loan.borrower];
+        record.completedLoans++;
+        if (lateDays != 0) record.lateReturns++;
+        if (fee != 0) usdc.safeTransfer(loan.owner, fee);
+        if (refund != 0) usdc.safeTransfer(loan.borrower, refund);
+        if (status == Status.Expired) emit LoanExpired(loanId, fee, refund);
+        else emit LoanSettled(loanId, lateDays, fee, refund);
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..029d7680ff59ef9c90567d00d34636aca8057845
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f19dda859d7e3d8ab4131b667d34c279c9622bd2
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeTransferFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f21113df51bff710768b8afa33e3d584331da3dd
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "mUSDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..b986efc7156896b77400bd3ab2f469906b9d2b08
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts"
+test = "test"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..9c185c5d9314a9e217aff36503105e9b8f598491
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "preview": "vite preview",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^4.4.1",
+    "vite": "^6.3.5",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.29.4"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.2",
+    "@types/react-dom": "^19.1.2",
+    "typescript": "^5.8.3"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..af995e034eece09ae2c605c5213a6ad6983d49d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract ToolshedEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    ToolshedEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 1_000e6, "full refund");
+        (uint64 completed, uint64 late) = escrow.trackRecords(BORROWER);
+        require(completed == 1 && late == 0, "record");
+    }
+
+    function testLateFeeRoundsPartialDayUp() public {
+        uint40 due = uint40(block.timestamp + 3 days);
+        uint256 id = _request(100e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 1 days + 1);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(OWNER) == 14e6, "two late days");
+        require(token.balanceOf(BORROWER) == 986e6, "refund");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(20e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 100 days);
+        escrow.settleExpired(id);
+        require(token.balanceOf(OWNER) == 20e6, "capped");
+        require(token.balanceOf(address(escrow)) == 0, "no dust");
+    }
+
+    function testCancelledRequestRefunds() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(BORROWER);
+        escrow.cancelRequest(id);
+        require(token.balanceOf(BORROWER) == 1_000e6, "refunded");
+    }
+
+    function testOnlyOwnerCanConfirm() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.expectRevert(ToolshedEscrow.NotOwner.selector);
+        vm.prank(BORROWER);
+        escrow.confirmReturn(id);
+    }
+
+    function testFuzzFeeNeverExceedsDeposit(uint96 deposit, uint96 dailyFee, uint16 daysLate)
+        public
+    {
+        deposit = uint96(uint256(deposit) % 1_000_000e6 + 1);
+        dailyFee = uint96(uint256(dailyFee) % deposit + 1);
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(deposit, dailyFee, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + uint256(daysLate) * 1 days);
+        (, uint256 fee, uint256 refund) = escrow.quoteSettlement(id);
+        require(fee <= deposit && fee + refund == deposit, "conservation");
+    }
+
+    function _request(uint96 deposit, uint96 fee, uint40 due) private returns (uint256) {
+        token.mint(BORROWER, deposit);
+        vm.prank(BORROWER);
+        return escrow.requestLoan(OWNER, keccak256("drill"), deposit, fee, due);
+    }
+}

diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6d271d037d74066f6f4efa8143c38cd7bffd66ff
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,9 @@
+node_modules/
+dist/
+out/
+build/
+cache/
+broadcast/
+.env
+.env.local
+*.local
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73a4c8e52559b6927deb14b0b9128fa0683e76a4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @notice USDC escrow for person-to-person physical tool loans.
+/// @dev Tool metadata stays offchain; its hash permanently binds each loan to a listing.
+contract ToolshedEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Cancelled,
+        Expired
+    }
+
+    struct Loan {
+        address owner;
+        address borrower;
+        bytes32 toolId;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        uint40 dueAt;
+        Status status;
+    }
+
+    struct TrackRecord {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    uint256 public constant DAY = 1 days;
+    uint256 public constant EXPIRY_GRACE = 30 days;
+    IERC20 public immutable usdc;
+    uint256 public nextLoanId = 1;
+
+    mapping(uint256 => Loan) public loans;
+    mapping(address => TrackRecord) public trackRecords;
+
+    error InvalidTerms();
+    error NotBorrower();
+    error NotOwner();
+    error WrongStatus();
+    error TooEarly();
+
+    event LoanRequested(
+        uint256 indexed loanId,
+        bytes32 indexed toolId,
+        address indexed owner,
+        address borrower,
+        uint256 deposit,
+        uint256 dailyLateFee,
+        uint256 dueAt
+    );
+    event LoanActivated(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 lateDays, uint256 fee, uint256 refund);
+    event LoanExpired(uint256 indexed loanId, uint256 fee, uint256 refund);
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function requestLoan(
+        address owner,
+        bytes32 toolId,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        uint40 dueAt
+    ) external returns (uint256 loanId) {
+        if (
+            owner == address(0) || owner == msg.sender || toolId == bytes32(0) || deposit == 0
+                || dailyLateFee == 0 || dailyLateFee > deposit || dueAt <= block.timestamp
+        ) revert InvalidTerms();
+
+        loanId = nextLoanId++;
+        loans[loanId] = Loan({
+            owner: owner,
+            borrower: msg.sender,
+            toolId: toolId,
+            deposit: deposit,
+            dailyLateFee: dailyLateFee,
+            dueAt: dueAt,
+            status: Status.Requested
+        });
+        usdc.safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(
+            loanId, toolId, owner, msg.sender, deposit, dailyLateFee, dueAt
+        );
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert NotBorrower();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Cancelled;
+        usdc.safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Active) revert WrongStatus();
+        _settle(loanId, loan, Status.Settled);
+    }
+
+    /// @notice After a long grace period anyone may settle, preventing permanently stuck funds.
+    function settleExpired(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert WrongStatus();
+        if (block.timestamp <= uint256(loan.dueAt) + EXPIRY_GRACE) revert TooEarly();
+        _settle(loanId, loan, Status.Expired);
+    }
+
+    function quoteSettlement(uint256 loanId)
+        public
+        view
+        returns (uint256 lateDays, uint256 fee, uint256 refund)
+    {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) return (0, 0, loan.deposit);
+        if (block.timestamp > loan.dueAt) {
+            lateDays = (block.timestamp - loan.dueAt + DAY - 1) / DAY;
+        }
+        fee = lateDays * loan.dailyLateFee;
+        if (fee > loan.deposit) fee = loan.deposit;
+        refund = loan.deposit - fee;
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        TrackRecord memory record = trackRecords[member];
+        if (record.completedLoans == 0) return 10_000;
+        return
+            (uint256(record.completedLoans - record.lateReturns) * 10_000)
+                / record.completedLoans;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan, Status status) private {
+        (uint256 lateDays, uint256 fee, uint256 refund) = quoteSettlement(loanId);
+        loan.status = status;
+        TrackRecord storage record = trackRecords[loan.borrower];
+        record.completedLoans++;
+        if (lateDays != 0) record.lateReturns++;
+        if (fee != 0) usdc.safeTransfer(loan.owner, fee);
+        if (refund != 0) usdc.safeTransfer(loan.borrower, refund);
+        if (status == Status.Expired) emit LoanExpired(loanId, fee, refund);
+        else emit LoanSettled(loanId, lateDays, fee, refund);
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..029d7680ff59ef9c90567d00d34636aca8057845
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f19dda859d7e3d8ab4131b667d34c279c9622bd2
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeTransferFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f21113df51bff710768b8afa33e3d584331da3dd
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "mUSDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..b986efc7156896b77400bd3ab2f469906b9d2b08
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts"
+test = "test"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..9c185c5d9314a9e217aff36503105e9b8f598491
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "preview": "vite preview",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^4.4.1",
+    "vite": "^6.3.5",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.29.4"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.2",
+    "@types/react-dom": "^19.1.2",
+    "typescript": "^5.8.3"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..af995e034eece09ae2c605c5213a6ad6983d49d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
@@ -0,0 +1,97 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract ToolshedEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    ToolshedEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(token);
+        token.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 1_000e6, "full refund");
+        (uint64 completed, uint64 late) = escrow.trackRecords(BORROWER);
+        require(completed == 1 && late == 0, "record");
+    }
+
+    function testLateFeeRoundsPartialDayUp() public {
+        uint40 due = uint40(block.timestamp + 3 days);
+        uint256 id = _request(100e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 1 days + 1);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(OWNER) == 14e6, "two late days");
+        require(token.balanceOf(BORROWER) == 986e6, "refund");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(20e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 100 days);
+        escrow.settleExpired(id);
+        require(token.balanceOf(OWNER) == 20e6, "capped");
+        require(token.balanceOf(address(escrow)) == 0, "no dust");
+    }
+
+    function testCancelledRequestRefunds() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(BORROWER);
+        escrow.cancelRequest(id);
+        require(token.balanceOf(BORROWER) == 1_000e6, "refunded");
+    }
+
+    function testOnlyOwnerCanConfirm() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.expectRevert(ToolshedEscrow.NotOwner.selector);
+        vm.prank(BORROWER);
+        escrow.confirmReturn(id);
+    }
+
+    function testFuzzFeeNeverExceedsDeposit(uint96 deposit, uint96 dailyFee, uint16 daysLate)
+        public
+    {
+        deposit = uint96(uint256(deposit) % 1_000_000e6 + 1);
+        dailyFee = uint96(uint256(dailyFee) % deposit + 1);
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(deposit, dailyFee, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + uint256(daysLate) * 1 days);
+        (, uint256 fee, uint256 refund) = escrow.quoteSettlement(id);
+        require(fee <= deposit && fee + refund == deposit, "conservation");
+    }
+
+    function _request(uint96 deposit, uint96 fee, uint40 due) private returns (uint256) {
+        token.mint(BORROWER, deposit);
+        vm.prank(BORROWER);
+        return escrow.requestLoan(OWNER, keccak256("drill"), deposit, fee, due);
+    }
+}

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6d271d037d74066f6f4efa8143c38cd7bffd66ff
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,9 @@
+node_modules/
+dist/
+out/
+build/
+cache/
+broadcast/
+.env
+.env.local
+*.local
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73a4c8e52559b6927deb14b0b9128fa0683e76a4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @notice USDC escrow for person-to-person physical tool loans.
+/// @dev Tool metadata stays offchain; its hash permanently binds each loan to a listing.
+contract ToolshedEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Cancelled,
+        Expired
+    }
+
+    struct Loan {
+        address owner;
+        address borrower;
+        bytes32 toolId;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        uint40 dueAt;
+        Status status;
+    }
+
+    struct TrackRecord {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    uint256 public constant DAY = 1 days;
+    uint256 public constant EXPIRY_GRACE = 30 days;
+    IERC20 public immutable usdc;
+    uint256 public nextLoanId = 1;
+
+    mapping(uint256 => Loan) public loans;
+    mapping(address => TrackRecord) public trackRecords;
+
+    error InvalidTerms();
+    error NotBorrower();
+    error NotOwner();
+    error WrongStatus();
+    error TooEarly();
+
+    event LoanRequested(
+        uint256 indexed loanId,
+        bytes32 indexed toolId,
+        address indexed owner,
+        address borrower,
+        uint256 deposit,
+        uint256 dailyLateFee,
+        uint256 dueAt
+    );
+    event LoanActivated(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 lateDays, uint256 fee, uint256 refund);
+    event LoanExpired(uint256 indexed loanId, uint256 fee, uint256 refund);
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function requestLoan(
+        address owner,
+        bytes32 toolId,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        uint40 dueAt
+    ) external returns (uint256 loanId) {
+        if (
+            owner == address(0) || owner == msg.sender || toolId == bytes32(0) || deposit == 0
+                || dailyLateFee == 0 || dailyLateFee > deposit || dueAt <= block.timestamp
+        ) revert InvalidTerms();
+
+        loanId = nextLoanId++;
+        loans[loanId] = Loan({
+            owner: owner,
+            borrower: msg.sender,
+            toolId: toolId,
+            deposit: deposit,
+            dailyLateFee: dailyLateFee,
+            dueAt: dueAt,
+            status: Status.Requested
+        });
+        usdc.safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(
+            loanId, toolId, owner, msg.sender, deposit, dailyLateFee, dueAt
+        );
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert NotBorrower();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Cancelled;
+        usdc.safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Active) revert WrongStatus();
+        _settle(loanId, loan, Status.Settled);
+    }
+
+    /// @notice After a long grace period anyone may settle, preventing permanently stuck funds.
+    function settleExpired(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert WrongStatus();
+        if (block.timestamp <= uint256(loan.dueAt) + EXPIRY_GRACE) revert TooEarly();
+        _settle(loanId, loan, Status.Expired);
+    }
+
+    function quoteSettlement(uint256 loanId)
+        public
+        view
+        returns (uint256 lateDays, uint256 fee, uint256 refund)
+    {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) return (0, 0, loan.deposit);
+        if (block.timestamp > loan.dueAt) {
+            lateDays = (block.timestamp - loan.dueAt + DAY - 1) / DAY;
+        }
+        fee = lateDays * loan.dailyLateFee;
+        if (fee > loan.deposit) fee = loan.deposit;
+        refund = loan.deposit - fee;
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        TrackRecord memory record = trackRecords[member];
+        if (record.completedLoans == 0) return 10_000;
+        return
+            (uint256(record.completedLoans - record.lateReturns) * 10_000)
+                / record.completedLoans;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan, Status status) private {
+        (uint256 lateDays, uint256 fee, uint256 refund) = quoteSettlement(loanId);
+        loan.status = status;
+        TrackRecord storage record = trackRecords[loan.borrower];
+        record.completedLoans++;
+        if (lateDays != 0) record.lateReturns++;
+        if (fee != 0) usdc.safeTransfer(loan.owner, fee);
+        if (refund != 0) usdc.safeTransfer(loan.borrower, refund);
+        if (status == Status.Expired) emit LoanExpired(loanId, fee, refund);
+        else emit LoanSettled(loanId, lateDays, fee, refund);
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..029d7680ff59ef9c90567d00d34636aca8057845
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f19dda859d7e3d8ab4131b667d34c279c9622bd2
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeTransferFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f21113df51bff710768b8afa33e3d584331da3dd
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "mUSDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..b986efc7156896b77400bd3ab2f469906b9d2b08
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts"
+test = "test"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..d2fcf1e4b23972913c1a22837c7f3e5e0731843f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html
@@ -0,0 +1,13 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="description" content="Borrow useful things from people nearby." />
+    <title>Toolshed — the neighborhood lending library</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..9c185c5d9314a9e217aff36503105e9b8f598491
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "preview": "vite preview",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^4.4.1",
+    "vite": "^6.3.5",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.29.4"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.2",
+    "@types/react-dom": "^19.1.2",
+    "typescript": "^5.8.3"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts
new file mode 100644
index 0000000000000000000000000000000000000000..540dd2d11f649593de7b29b0c427ddbfecf66237
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts
@@ -0,0 +1,80 @@
+import { createWalletClient, custom, encodeFunctionData, keccak256, parseUnits, stringToBytes } from "viem";
+import { baseSepolia } from "viem/chains";
+
+export const ESCROW_ADDRESS = import.meta.env.VITE_ESCROW_ADDRESS;
+export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS;
+
+const erc20Abi = [
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
+const escrowAbi = [
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "toolId", type: "bytes32" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+      { name: "dueAt", type: "uint40" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+declare global {
+  interface Window {
+    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
+  }
+}
+
+export async function connectWallet() {
+  if (!window.ethereum) throw new Error("Install a wallet extension to continue.");
+  const client = createWalletClient({ chain: baseSepolia, transport: custom(window.ethereum) });
+  const [account] = await client.requestAddresses();
+  return { client, account };
+}
+
+export async function approveDeposit(amount: number) {
+  if (!ESCROW_ADDRESS || !USDC_ADDRESS) throw new Error("Contract addresses are not configured.");
+  const { client, account } = await connectWallet();
+  return client.sendTransaction({
+    account,
+    chain: baseSepolia,
+    to: USDC_ADDRESS,
+    data: encodeFunctionData({
+      abi: erc20Abi,
+      functionName: "approve",
+      args: [ESCROW_ADDRESS, parseUnits(String(amount), 6)],
+    }),
+  });
+}
+
+export async function requestLoan(owner: `0x${string}`, toolId: string, deposit: number, dailyFee: number, days: number) {
+  if (!ESCROW_ADDRESS) throw new Error("Escrow address is not configured.");
+  const { client, account } = await connectWallet();
+  return client.sendTransaction({
+    account,
+    chain: baseSepolia,
+    to: ESCROW_ADDRESS,
+    data: encodeFunctionData({
+      abi: escrowAbi,
+      functionName: "requestLoan",
+      args: [
+        owner,
+        keccak256(stringToBytes(toolId)),
+        parseUnits(String(deposit), 6),
+        parseUnits(String(dailyFee), 6),
+        Math.floor(Date.now() / 1000) + days * 86_400,
+      ],
+    }),
+  });
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts
new file mode 100644
index 0000000000000000000000000000000000000000..e50707d708f2dbb57353219fc04aa4085da2b8c6
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts
@@ -0,0 +1,43 @@
+import type { Tool } from "./types";
+
+export const DEMO_TOOLS: Tool[] = [
+  {
+    id: "cordless-drill",
+    name: "18V cordless drill",
+    category: "Power tools",
+    condition: "Good. Two batteries; the chuck is a little stiff.",
+    photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Maya R.",
+    ownerAddress: "0x1111111111111111111111111111111111111111",
+    deposit: 45,
+    dailyFee: 4,
+    completedLoans: 18,
+    lateReturns: 1,
+  },
+  {
+    id: "extension-ladder",
+    name: "20′ extension ladder",
+    category: "Ladders",
+    condition: "Very good. 225 lb rating; pickup requires a long vehicle.",
+    photo: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Jordan K.",
+    ownerAddress: "0x2222222222222222222222222222222222222222",
+    deposit: 80,
+    dailyFee: 6,
+    completedLoans: 31,
+    lateReturns: 0,
+  },
+  {
+    id: "pressure-washer",
+    name: "Electric pressure washer",
+    category: "Outdoor",
+    condition: "Fair. Works well; cosmetic scuffs and a patched hose.",
+    photo: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Sam D.",
+    ownerAddress: "0x3333333333333333333333333333333333333333",
+    deposit: 65,
+    dailyFee: 5,
+    completedLoans: 9,
+    lateReturns: 2,
+  },
+];
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..693ac2e709e33f704d5a6416ff5fe19ffd5ef977
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx
@@ -0,0 +1,10 @@
+import { StrictMode } from "react";
+import { createRoot } from "react-dom/client";
+import App from "./App";
+import "./styles.css";
+
+createRoot(document.getElementById("root")!).render(
+  <StrictMode>
+    <App />
+  </StrictMode>,
+);
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts
new file mode 100644
index 0000000000000000000000000000000000000000..ec6aff57eafc6556b276dd2254ff447651ab6e4e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts
@@ -0,0 +1,15 @@
+export type Tool = {
+  id: string;
+  name: string;
+  category: string;
+  condition: string;
+  photo: string;
+  ownerName: string;
+  ownerAddress: `0x${string}`;
+  deposit: number;
+  dailyFee: number;
+  completedLoans: number;
+  lateReturns: number;
+};
+
+export type ListingDraft = Pick<Tool, "name" | "category" | "condition" | "photo" | "deposit" | "dailyFee">;
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts
new file mode 100644
index 0000000000000000000000000000000000000000..c0a0d34a1e7053aadaa79bc804a1ea4581494940
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts
@@ -0,0 +1,6 @@
+/// <reference types="vite/client" />
+
+interface ImportMetaEnv {
+  readonly VITE_ESCROW_ADDRESS?: `0x${string}`;
+  readonly VITE_USDC_ADDRESS?: `0x${string}`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..db7c38780e044b9994943170ebb67971a45d6008
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
@@ -0,0 +1,96 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract ToolshedEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    ToolshedEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(token);
+        vm.prank(BORROWER);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "full refund");
+        (uint64 completed, uint64 late) = escrow.trackRecords(BORROWER);
+        require(completed == 1 && late == 0, "record");
+    }
+
+    function testLateFeeRoundsPartialDayUp() public {
+        uint40 due = uint40(block.timestamp + 3 days);
+        uint256 id = _request(100e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 1 days + 1);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(OWNER) == 14e6, "two late days");
+        require(token.balanceOf(BORROWER) == 86e6, "refund");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(20e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 100 days);
+        escrow.settleExpired(id);
+        require(token.balanceOf(OWNER) == 20e6, "capped");
+        require(token.balanceOf(address(escrow)) == 0, "no dust");
+    }
+
+    function testCancelledRequestRefunds() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(BORROWER);
+        escrow.cancelRequest(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refunded");
+    }
+
+    function testOnlyOwnerCanConfirm() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.expectRevert(ToolshedEscrow.NotOwner.selector);
+        vm.prank(BORROWER);
+        escrow.confirmReturn(id);
+    }
+
+    function testFuzzFeeNeverExceedsDeposit(uint96 deposit, uint96 dailyFee, uint16 daysLate)
+        public
+    {
+        deposit = uint96(uint256(deposit) % 1_000_000e6 + 1);
+        dailyFee = uint96(uint256(dailyFee) % deposit + 1);
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(deposit, dailyFee, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + uint256(daysLate) * 1 days);
+        (, uint256 fee, uint256 refund) = escrow.quoteSettlement(id);
+        require(fee <= deposit && fee + refund == deposit, "conservation");
+    }
+
+    function _request(uint96 deposit, uint96 fee, uint40 due) private returns (uint256) {
+        token.mint(BORROWER, deposit);
+        vm.prank(BORROWER);
+        return escrow.requestLoan(OWNER, keccak256("drill"), deposit, fee, due);
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json
new file mode 100644
index 0000000000000000000000000000000000000000..e935337c4f4097887626cfa43dcb106e3130d948
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json
@@ -0,0 +1,20 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "allowJs": false,
+    "skipLibCheck": true,
+    "esModuleInterop": true,
+    "allowSyntheticDefaultImports": true,
+    "strict": true,
+    "forceConsistentCasingInFileNames": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "resolveJsonModule": true,
+    "isolatedModules": true,
+    "noEmit": true,
+    "jsx": "react-jsx"
+  },
+  "include": ["src"]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d32ff682003e0ff5d8a6e6bb3663d4c35a45b116
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json
@@ -0,0 +1,4 @@
+{
+  "files": [],
+  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json
new file mode 100644
index 0000000000000000000000000000000000000000..5eef90e107cf232f345dbbcae1daa5213d066518
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json
@@ -0,0 +1,10 @@
+{
+  "compilerOptions": {
+    "composite": true,
+    "skipLibCheck": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "allowImportingTsExtensions": true
+  },
+  "include": ["vite.config.ts"]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..081c8d9f69fcb741cce28e9eb3562517df8dbb14
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts
@@ -0,0 +1,6 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});

diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6d271d037d74066f6f4efa8143c38cd7bffd66ff
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,9 @@
+node_modules/
+dist/
+out/
+build/
+cache/
+broadcast/
+.env
+.env.local
+*.local
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73a4c8e52559b6927deb14b0b9128fa0683e76a4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @notice USDC escrow for person-to-person physical tool loans.
+/// @dev Tool metadata stays offchain; its hash permanently binds each loan to a listing.
+contract ToolshedEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Cancelled,
+        Expired
+    }
+
+    struct Loan {
+        address owner;
+        address borrower;
+        bytes32 toolId;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        uint40 dueAt;
+        Status status;
+    }
+
+    struct TrackRecord {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    uint256 public constant DAY = 1 days;
+    uint256 public constant EXPIRY_GRACE = 30 days;
+    IERC20 public immutable usdc;
+    uint256 public nextLoanId = 1;
+
+    mapping(uint256 => Loan) public loans;
+    mapping(address => TrackRecord) public trackRecords;
+
+    error InvalidTerms();
+    error NotBorrower();
+    error NotOwner();
+    error WrongStatus();
+    error TooEarly();
+
+    event LoanRequested(
+        uint256 indexed loanId,
+        bytes32 indexed toolId,
+        address indexed owner,
+        address borrower,
+        uint256 deposit,
+        uint256 dailyLateFee,
+        uint256 dueAt
+    );
+    event LoanActivated(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 lateDays, uint256 fee, uint256 refund);
+    event LoanExpired(uint256 indexed loanId, uint256 fee, uint256 refund);
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function requestLoan(
+        address owner,
+        bytes32 toolId,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        uint40 dueAt
+    ) external returns (uint256 loanId) {
+        if (
+            owner == address(0) || owner == msg.sender || toolId == bytes32(0) || deposit == 0
+                || dailyLateFee == 0 || dailyLateFee > deposit || dueAt <= block.timestamp
+        ) revert InvalidTerms();
+
+        loanId = nextLoanId++;
+        loans[loanId] = Loan({
+            owner: owner,
+            borrower: msg.sender,
+            toolId: toolId,
+            deposit: deposit,
+            dailyLateFee: dailyLateFee,
+            dueAt: dueAt,
+            status: Status.Requested
+        });
+        usdc.safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(
+            loanId, toolId, owner, msg.sender, deposit, dailyLateFee, dueAt
+        );
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert NotBorrower();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Cancelled;
+        usdc.safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Active) revert WrongStatus();
+        _settle(loanId, loan, Status.Settled);
+    }
+
+    /// @notice After a long grace period anyone may settle, preventing permanently stuck funds.
+    function settleExpired(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert WrongStatus();
+        if (block.timestamp <= uint256(loan.dueAt) + EXPIRY_GRACE) revert TooEarly();
+        _settle(loanId, loan, Status.Expired);
+    }
+
+    function quoteSettlement(uint256 loanId)
+        public
+        view
+        returns (uint256 lateDays, uint256 fee, uint256 refund)
+    {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) return (0, 0, loan.deposit);
+        if (block.timestamp > loan.dueAt) {
+            lateDays = (block.timestamp - loan.dueAt + DAY - 1) / DAY;
+        }
+        fee = lateDays * loan.dailyLateFee;
+        if (fee > loan.deposit) fee = loan.deposit;
+        refund = loan.deposit - fee;
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        TrackRecord memory record = trackRecords[member];
+        if (record.completedLoans == 0) return 10_000;
+        return
+            (uint256(record.completedLoans - record.lateReturns) * 10_000)
+                / record.completedLoans;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan, Status status) private {
+        (uint256 lateDays, uint256 fee, uint256 refund) = quoteSettlement(loanId);
+        loan.status = status;
+        TrackRecord storage record = trackRecords[loan.borrower];
+        record.completedLoans++;
+        if (lateDays != 0) record.lateReturns++;
+        if (fee != 0) usdc.safeTransfer(loan.owner, fee);
+        if (refund != 0) usdc.safeTransfer(loan.borrower, refund);
+        if (status == Status.Expired) emit LoanExpired(loanId, fee, refund);
+        else emit LoanSettled(loanId, lateDays, fee, refund);
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..029d7680ff59ef9c90567d00d34636aca8057845
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f19dda859d7e3d8ab4131b667d34c279c9622bd2
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeTransferFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f21113df51bff710768b8afa33e3d584331da3dd
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "mUSDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..b986efc7156896b77400bd3ab2f469906b9d2b08
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts"
+test = "test"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..d2fcf1e4b23972913c1a22837c7f3e5e0731843f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html
@@ -0,0 +1,13 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="description" content="Borrow useful things from people nearby." />
+    <title>Toolshed — the neighborhood lending library</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..9c185c5d9314a9e217aff36503105e9b8f598491
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "preview": "vite preview",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^4.4.1",
+    "vite": "^6.3.5",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.29.4"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.2",
+    "@types/react-dom": "^19.1.2",
+    "typescript": "^5.8.3"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts
new file mode 100644
index 0000000000000000000000000000000000000000..540dd2d11f649593de7b29b0c427ddbfecf66237
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts
@@ -0,0 +1,80 @@
+import { createWalletClient, custom, encodeFunctionData, keccak256, parseUnits, stringToBytes } from "viem";
+import { baseSepolia } from "viem/chains";
+
+export const ESCROW_ADDRESS = import.meta.env.VITE_ESCROW_ADDRESS;
+export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS;
+
+const erc20Abi = [
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
+const escrowAbi = [
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "toolId", type: "bytes32" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+      { name: "dueAt", type: "uint40" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+declare global {
+  interface Window {
+    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
+  }
+}
+
+export async function connectWallet() {
+  if (!window.ethereum) throw new Error("Install a wallet extension to continue.");
+  const client = createWalletClient({ chain: baseSepolia, transport: custom(window.ethereum) });
+  const [account] = await client.requestAddresses();
+  return { client, account };
+}
+
+export async function approveDeposit(amount: number) {
+  if (!ESCROW_ADDRESS || !USDC_ADDRESS) throw new Error("Contract addresses are not configured.");
+  const { client, account } = await connectWallet();
+  return client.sendTransaction({
+    account,
+    chain: baseSepolia,
+    to: USDC_ADDRESS,
+    data: encodeFunctionData({
+      abi: erc20Abi,
+      functionName: "approve",
+      args: [ESCROW_ADDRESS, parseUnits(String(amount), 6)],
+    }),
+  });
+}
+
+export async function requestLoan(owner: `0x${string}`, toolId: string, deposit: number, dailyFee: number, days: number) {
+  if (!ESCROW_ADDRESS) throw new Error("Escrow address is not configured.");
+  const { client, account } = await connectWallet();
+  return client.sendTransaction({
+    account,
+    chain: baseSepolia,
+    to: ESCROW_ADDRESS,
+    data: encodeFunctionData({
+      abi: escrowAbi,
+      functionName: "requestLoan",
+      args: [
+        owner,
+        keccak256(stringToBytes(toolId)),
+        parseUnits(String(deposit), 6),
+        parseUnits(String(dailyFee), 6),
+        Math.floor(Date.now() / 1000) + days * 86_400,
+      ],
+    }),
+  });
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts
new file mode 100644
index 0000000000000000000000000000000000000000..e50707d708f2dbb57353219fc04aa4085da2b8c6
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts
@@ -0,0 +1,43 @@
+import type { Tool } from "./types";
+
+export const DEMO_TOOLS: Tool[] = [
+  {
+    id: "cordless-drill",
+    name: "18V cordless drill",
+    category: "Power tools",
+    condition: "Good. Two batteries; the chuck is a little stiff.",
+    photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Maya R.",
+    ownerAddress: "0x1111111111111111111111111111111111111111",
+    deposit: 45,
+    dailyFee: 4,
+    completedLoans: 18,
+    lateReturns: 1,
+  },
+  {
+    id: "extension-ladder",
+    name: "20′ extension ladder",
+    category: "Ladders",
+    condition: "Very good. 225 lb rating; pickup requires a long vehicle.",
+    photo: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Jordan K.",
+    ownerAddress: "0x2222222222222222222222222222222222222222",
+    deposit: 80,
+    dailyFee: 6,
+    completedLoans: 31,
+    lateReturns: 0,
+  },
+  {
+    id: "pressure-washer",
+    name: "Electric pressure washer",
+    category: "Outdoor",
+    condition: "Fair. Works well; cosmetic scuffs and a patched hose.",
+    photo: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Sam D.",
+    ownerAddress: "0x3333333333333333333333333333333333333333",
+    deposit: 65,
+    dailyFee: 5,
+    completedLoans: 9,
+    lateReturns: 2,
+  },
+];
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..693ac2e709e33f704d5a6416ff5fe19ffd5ef977
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx
@@ -0,0 +1,10 @@
+import { StrictMode } from "react";
+import { createRoot } from "react-dom/client";
+import App from "./App";
+import "./styles.css";
+
+createRoot(document.getElementById("root")!).render(
+  <StrictMode>
+    <App />
+  </StrictMode>,
+);
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts
new file mode 100644
index 0000000000000000000000000000000000000000..ec6aff57eafc6556b276dd2254ff447651ab6e4e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts
@@ -0,0 +1,15 @@
+export type Tool = {
+  id: string;
+  name: string;
+  category: string;
+  condition: string;
+  photo: string;
+  ownerName: string;
+  ownerAddress: `0x${string}`;
+  deposit: number;
+  dailyFee: number;
+  completedLoans: number;
+  lateReturns: number;
+};
+
+export type ListingDraft = Pick<Tool, "name" | "category" | "condition" | "photo" | "deposit" | "dailyFee">;
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts
new file mode 100644
index 0000000000000000000000000000000000000000..c0a0d34a1e7053aadaa79bc804a1ea4581494940
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts
@@ -0,0 +1,6 @@
+/// <reference types="vite/client" />
+
+interface ImportMetaEnv {
+  readonly VITE_ESCROW_ADDRESS?: `0x${string}`;
+  readonly VITE_USDC_ADDRESS?: `0x${string}`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..db7c38780e044b9994943170ebb67971a45d6008
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
@@ -0,0 +1,96 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract ToolshedEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    ToolshedEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(token);
+        vm.prank(BORROWER);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "full refund");
+        (uint64 completed, uint64 late) = escrow.trackRecords(BORROWER);
+        require(completed == 1 && late == 0, "record");
+    }
+
+    function testLateFeeRoundsPartialDayUp() public {
+        uint40 due = uint40(block.timestamp + 3 days);
+        uint256 id = _request(100e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 1 days + 1);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(OWNER) == 14e6, "two late days");
+        require(token.balanceOf(BORROWER) == 86e6, "refund");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(20e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 100 days);
+        escrow.settleExpired(id);
+        require(token.balanceOf(OWNER) == 20e6, "capped");
+        require(token.balanceOf(address(escrow)) == 0, "no dust");
+    }
+
+    function testCancelledRequestRefunds() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(BORROWER);
+        escrow.cancelRequest(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refunded");
+    }
+
+    function testOnlyOwnerCanConfirm() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.expectRevert(ToolshedEscrow.NotOwner.selector);
+        vm.prank(BORROWER);
+        escrow.confirmReturn(id);
+    }
+
+    function testFuzzFeeNeverExceedsDeposit(uint96 deposit, uint96 dailyFee, uint16 daysLate)
+        public
+    {
+        deposit = uint96(uint256(deposit) % 1_000_000e6 + 1);
+        dailyFee = uint96(uint256(dailyFee) % deposit + 1);
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(deposit, dailyFee, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + uint256(daysLate) * 1 days);
+        (, uint256 fee, uint256 refund) = escrow.quoteSettlement(id);
+        require(fee <= deposit && fee + refund == deposit, "conservation");
+    }
+
+    function _request(uint96 deposit, uint96 fee, uint40 due) private returns (uint256) {
+        token.mint(BORROWER, deposit);
+        vm.prank(BORROWER);
+        return escrow.requestLoan(OWNER, keccak256("drill"), deposit, fee, due);
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json
new file mode 100644
index 0000000000000000000000000000000000000000..e935337c4f4097887626cfa43dcb106e3130d948
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json
@@ -0,0 +1,20 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "allowJs": false,
+    "skipLibCheck": true,
+    "esModuleInterop": true,
+    "allowSyntheticDefaultImports": true,
+    "strict": true,
+    "forceConsistentCasingInFileNames": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "resolveJsonModule": true,
+    "isolatedModules": true,
+    "noEmit": true,
+    "jsx": "react-jsx"
+  },
+  "include": ["src"]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d32ff682003e0ff5d8a6e6bb3663d4c35a45b116
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json
@@ -0,0 +1,4 @@
+{
+  "files": [],
+  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json
new file mode 100644
index 0000000000000000000000000000000000000000..5eef90e107cf232f345dbbcae1daa5213d066518
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json
@@ -0,0 +1,10 @@
+{
+  "compilerOptions": {
+    "composite": true,
+    "skipLibCheck": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "allowImportingTsExtensions": true
+  },
+  "include": ["vite.config.ts"]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..081c8d9f69fcb741cce28e9eb3562517df8dbb14
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts
@@ -0,0 +1,6 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/App.tsx
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/styles.css
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6d271d037d74066f6f4efa8143c38cd7bffd66ff
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,9 @@
+node_modules/
+dist/
+out/
+build/
+cache/
+broadcast/
+.env
+.env.local
+*.local
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73a4c8e52559b6927deb14b0b9128fa0683e76a4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @notice USDC escrow for person-to-person physical tool loans.
+/// @dev Tool metadata stays offchain; its hash permanently binds each loan to a listing.
+contract ToolshedEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Cancelled,
+        Expired
+    }
+
+    struct Loan {
+        address owner;
+        address borrower;
+        bytes32 toolId;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        uint40 dueAt;
+        Status status;
+    }
+
+    struct TrackRecord {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    uint256 public constant DAY = 1 days;
+    uint256 public constant EXPIRY_GRACE = 30 days;
+    IERC20 public immutable usdc;
+    uint256 public nextLoanId = 1;
+
+    mapping(uint256 => Loan) public loans;
+    mapping(address => TrackRecord) public trackRecords;
+
+    error InvalidTerms();
+    error NotBorrower();
+    error NotOwner();
+    error WrongStatus();
+    error TooEarly();
+
+    event LoanRequested(
+        uint256 indexed loanId,
+        bytes32 indexed toolId,
+        address indexed owner,
+        address borrower,
+        uint256 deposit,
+        uint256 dailyLateFee,
+        uint256 dueAt
+    );
+    event LoanActivated(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 lateDays, uint256 fee, uint256 refund);
+    event LoanExpired(uint256 indexed loanId, uint256 fee, uint256 refund);
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function requestLoan(
+        address owner,
+        bytes32 toolId,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        uint40 dueAt
+    ) external returns (uint256 loanId) {
+        if (
+            owner == address(0) || owner == msg.sender || toolId == bytes32(0) || deposit == 0
+                || dailyLateFee == 0 || dailyLateFee > deposit || dueAt <= block.timestamp
+        ) revert InvalidTerms();
+
+        loanId = nextLoanId++;
+        loans[loanId] = Loan({
+            owner: owner,
+            borrower: msg.sender,
+            toolId: toolId,
+            deposit: deposit,
+            dailyLateFee: dailyLateFee,
+            dueAt: dueAt,
+            status: Status.Requested
+        });
+        usdc.safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(
+            loanId, toolId, owner, msg.sender, deposit, dailyLateFee, dueAt
+        );
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert NotBorrower();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Cancelled;
+        usdc.safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Active) revert WrongStatus();
+        _settle(loanId, loan, Status.Settled);
+    }
+
+    /// @notice After a long grace period anyone may settle, preventing permanently stuck funds.
+    function settleExpired(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert WrongStatus();
+        if (block.timestamp <= uint256(loan.dueAt) + EXPIRY_GRACE) revert TooEarly();
+        _settle(loanId, loan, Status.Expired);
+    }
+
+    function quoteSettlement(uint256 loanId)
+        public
+        view
+        returns (uint256 lateDays, uint256 fee, uint256 refund)
+    {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) return (0, 0, loan.deposit);
+        if (block.timestamp > loan.dueAt) {
+            lateDays = (block.timestamp - loan.dueAt + DAY - 1) / DAY;
+        }
+        fee = lateDays * loan.dailyLateFee;
+        if (fee > loan.deposit) fee = loan.deposit;
+        refund = loan.deposit - fee;
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        TrackRecord memory record = trackRecords[member];
+        if (record.completedLoans == 0) return 10_000;
+        return
+            (uint256(record.completedLoans - record.lateReturns) * 10_000)
+                / record.completedLoans;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan, Status status) private {
+        (uint256 lateDays, uint256 fee, uint256 refund) = quoteSettlement(loanId);
+        loan.status = status;
+        TrackRecord storage record = trackRecords[loan.borrower];
+        record.completedLoans++;
+        if (lateDays != 0) record.lateReturns++;
+        if (fee != 0) usdc.safeTransfer(loan.owner, fee);
+        if (refund != 0) usdc.safeTransfer(loan.borrower, refund);
+        if (status == Status.Expired) emit LoanExpired(loanId, fee, refund);
+        else emit LoanSettled(loanId, lateDays, fee, refund);
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..029d7680ff59ef9c90567d00d34636aca8057845
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f19dda859d7e3d8ab4131b667d34c279c9622bd2
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeTransferFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f21113df51bff710768b8afa33e3d584331da3dd
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "mUSDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..b986efc7156896b77400bd3ab2f469906b9d2b08
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts"
+test = "test"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..d2fcf1e4b23972913c1a22837c7f3e5e0731843f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html
@@ -0,0 +1,13 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="description" content="Borrow useful things from people nearby." />
+    <title>Toolshed — the neighborhood lending library</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..9c185c5d9314a9e217aff36503105e9b8f598491
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "preview": "vite preview",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^4.4.1",
+    "vite": "^6.3.5",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.29.4"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.2",
+    "@types/react-dom": "^19.1.2",
+    "typescript": "^5.8.3"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/App.tsx b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/App.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..f0945fceaecb42d434eaa13a248a0fe6bc8534dd
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/App.tsx
@@ -0,0 +1,214 @@
+import { FormEvent, useMemo, useState } from "react";
+import { DEMO_TOOLS } from "./data";
+import { approveDeposit, connectWallet, ESCROW_ADDRESS, requestLoan } from "./contract";
+import type { ListingDraft, Tool } from "./types";
+
+const EMPTY_DRAFT: ListingDraft = {
+  name: "",
+  category: "Power tools",
+  condition: "",
+  photo: "",
+  deposit: 40,
+  dailyFee: 4,
+};
+
+const reliability = (tool: Tool) =>
+  tool.completedLoans === 0 ? 100 : Math.round(((tool.completedLoans - tool.lateReturns) / tool.completedLoans) * 100);
+
+function App() {
+  const [account, setAccount] = useState<`0x${string}`>();
+  const [localTools, setLocalTools] = useState<Tool[]>(() => {
+    try {
+      return JSON.parse(localStorage.getItem("toolshed:listings") ?? "[]");
+    } catch {
+      return [];
+    }
+  });
+  const [draft, setDraft] = useState(EMPTY_DRAFT);
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [approved, setApproved] = useState(false);
+  const [pending, setPending] = useState<"connect" | "approve" | "request">();
+  const [notice, setNotice] = useState("");
+  const [showListForm, setShowListForm] = useState(false);
+
+  const tools = useMemo(
+    () => [...DEMO_TOOLS, ...localTools].sort((a, b) => reliability(b) - reliability(a) || b.completedLoans - a.completedLoans),
+    [localTools],
+  );
+
+  async function connect() {
+    setPending("connect");
+    setNotice("");
+    try {
+      const wallet = await connectWallet();
+      setAccount(wallet.account);
+    } catch (error) {
+      setNotice(error instanceof Error ? error.message : "Could not connect wallet.");
+    } finally {
+      setPending(undefined);
+    }
+  }
+
+  function addListing(event: FormEvent) {
+    event.preventDefault();
+    if (!account) {
+      setNotice("Connect your wallet before listing a tool.");
+      return;
+    }
+    const listing: Tool = {
+      ...draft,
+      id: `${draft.name.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}`,
+      ownerName: "You",
+      ownerAddress: account,
+      photo: draft.photo || "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=1000&q=80",
+      completedLoans: 0,
+      lateReturns: 0,
+    };
+    const next = [...localTools, listing];
+    setLocalTools(next);
+    localStorage.setItem("toolshed:listings", JSON.stringify(next));
+    setDraft(EMPTY_DRAFT);
+    setShowListForm(false);
+    setNotice("Tool listed on this device. Pin metadata to a shared store before production.");
+  }
+
+  async function approve() {
+    if (!selected) return;
+    setPending("approve");
+    setNotice("");
+    try {
+      const hash = await approveDeposit(selected.deposit);
+      setApproved(true);
+      setNotice(`Approval submitted: ${hash.slice(0, 10)}… Wait for confirmation, then request.`);
+    } catch (error) {
+      setNotice(error instanceof Error ? error.message : "Approval failed.");
+    } finally {
+      setPending(undefined);
+    }
+  }
+
+  async function submitRequest() {
+    if (!selected) return;
+    setPending("request");
+    setNotice("");
+    try {
+      const hash = await requestLoan(selected.ownerAddress, selected.id, selected.deposit, selected.dailyFee, days);
+      setNotice(`Request submitted: ${hash.slice(0, 10)}… The owner must accept before pickup.`);
+      setSelected(undefined);
+      setApproved(false);
+    } catch (error) {
+      setNotice(error instanceof Error ? error.message : "Request failed.");
+    } finally {
+      setPending(undefined);
+    }
+  }
+
+  return (
+    <>
+      <header>
+        <a className="brand" href="#"><span>⌂</span> Toolshed</a>
+        <nav><a href="#browse">Browse</a><a href="#how">How it works</a></nav>
+        <button className="wallet" onClick={connect} disabled={Boolean(pending)}>
+          {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : pending === "connect" ? "Connecting…" : "Connect wallet"}
+        </button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div>
+            <p className="eyebrow">THE NEIGHBORHOOD TOOL LIBRARY</p>
+            <h1>More making.<br /><em>Less buying.</em></h1>
+            <p className="intro">Borrow well-kept tools from people nearby. A small USDC deposit keeps everything neighborly.</p>
+            <div className="hero-actions">
+              <a className="primary" href="#browse">Find a tool →</a>
+              <button className="text-button" onClick={() => setShowListForm(true)}>List something you own</button>
+            </div>
+            <div className="social-proof"><strong>300</strong> neighbors · <strong>94%</strong> returned on time</div>
+          </div>
+          <div className="hero-art" aria-label="A shared neighborhood drill">
+            <span className="sun" />
+            <img src={DEMO_TOOLS[0].photo} alt="Cordless drill on a workbench" />
+            <div className="note"><b>Available this weekend</b><br />2 blocks away</div>
+          </div>
+        </section>
+
+        <section id="browse" className="browse">
+          <div className="section-title">
+            <div><p className="eyebrow">AVAILABLE NEARBY</p><h2>Good tools, good neighbors.</h2></div>
+            <button className="secondary" onClick={() => setShowListForm(true)}>+ List a tool</button>
+          </div>
+          <p className="sort-note">Sorted by member reliability, then lending history.</p>
+          <div className="tool-grid">
+            {tools.map(tool => (
+              <article className="tool-card" key={tool.id}>
+                <div className="tool-photo"><img src={tool.photo} alt={tool.name} /><span>{tool.category}</span></div>
+                <div className="tool-body">
+                  <h3>{tool.name}</h3>
+                  <p>{tool.condition}</p>
+                  <div className="owner">
+                    <span className="avatar">{tool.ownerName[0]}</span>
+                    <div><b>{tool.ownerName}</b><small>{tool.completedLoans} loans · {tool.lateReturns} late</small></div>
+                    <strong className="score">{reliability(tool)}%</strong>
+                  </div>
+                  <div className="terms"><span><small>Deposit</small>${tool.deposit} USDC</span><span><small>Late fee</small>${tool.dailyFee}/day</span></div>
+                  <button className="primary full" onClick={() => { setSelected(tool); setApproved(false); }}>Ask to borrow</button>
+                </div>
+              </article>
+            ))}
+          </div>
+        </section>
+
+        <section id="how" className="how">
+          <p className="eyebrow">HOW IT WORKS</p><h2>Trust, with a little backup.</h2>
+          <div className="steps">
+            <div><b>01</b><h3>Find it nearby</h3><p>Browse tools and condition notes from association members.</p></div>
+            <div><b>02</b><h3>Put down a deposit</h3><p>Approve the exact USDC deposit, then send your request.</p></div>
+            <div><b>03</b><h3>Return & build trust</h3><p>On return, the owner releases your deposit minus any late fee.</p></div>
+          </div>
+        </section>
+      </main>
+
+      <footer><span className="brand">⌂ Toolshed</span><span>Built for neighbors, not profit.</span><span>Base Sepolia · USDC escrow</span></footer>
+
+      {notice && <div className="toast" role="status" onClick={() => setNotice("")}>{notice}<b>×</b></div>}
+
+      {selected && (
+        <div className="overlay" onMouseDown={() => setSelected(undefined)}>
+          <section className="modal" onMouseDown={event => event.stopPropagation()}>
+            <button className="close" onClick={() => setSelected(undefined)}>×</button>
+            <p className="eyebrow">BORROW REQUEST</p><h2>{selected.name}</h2>
+            <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))} /></label>
+            <div className="summary"><span>Refundable deposit <b>${selected.deposit} USDC</b></span><span>Late after {days} days <b>${selected.dailyFee}/day</b></span></div>
+            {!ESCROW_ADDRESS && <p className="warning">Demo mode: add contract addresses to <code>.env.local</code> to transact.</p>}
+            {!account ? (
+              <button className="primary full" onClick={connect}>Connect wallet</button>
+            ) : !approved ? (
+              <button className="primary full" onClick={approve} disabled={pending === "approve"}>{pending === "approve" ? "Confirm in wallet…" : `1. Approve ${selected.deposit} USDC`}</button>
+            ) : (
+              <button className="primary full" onClick={submitRequest} disabled={pending === "request"}>{pending === "request" ? "Confirm in wallet…" : "2. Send borrow request"}</button>
+            )}
+            <small className="privacy">Your wallet, amounts, and loan timing are public onchain.</small>
+          </section>
+        </div>
+      )}
+
+      {showListForm && (
+        <div className="overlay" onMouseDown={() => setShowListForm(false)}>
+          <form className="modal" onSubmit={addListing} onMouseDown={event => event.stopPropagation()}>
+            <button type="button" className="close" onClick={() => setShowListForm(false)}>×</button>
+            <p className="eyebrow">SHARE WHAT YOU HAVE</p><h2>List a tool</h2>
+            <label>Tool name<input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
+            <label>Category<select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}><option>Power tools</option><option>Hand tools</option><option>Outdoor</option><option>Ladders</option><option>Other</option></select></label>
+            <label>Photo URL<input type="url" placeholder="https://…" value={draft.photo} onChange={event => setDraft({ ...draft, photo: event.target.value })} /></label>
+            <label>Condition notes<textarea required value={draft.condition} onChange={event => setDraft({ ...draft, condition: event.target.value })} /></label>
+            <div className="field-row"><label>Deposit (USDC)<input type="number" min="1" value={draft.deposit} onChange={event => setDraft({ ...draft, deposit: Number(event.target.value) })} /></label><label>Late fee / day<input type="number" min="1" value={draft.dailyFee} onChange={event => setDraft({ ...draft, dailyFee: Number(event.target.value) })} /></label></div>
+            <button className="primary full">Publish listing</button>
+          </form>
+        </div>
+      )}
+    </>
+  );
+}
+
+export default App;
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts
new file mode 100644
index 0000000000000000000000000000000000000000..540dd2d11f649593de7b29b0c427ddbfecf66237
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts
@@ -0,0 +1,80 @@
+import { createWalletClient, custom, encodeFunctionData, keccak256, parseUnits, stringToBytes } from "viem";
+import { baseSepolia } from "viem/chains";
+
+export const ESCROW_ADDRESS = import.meta.env.VITE_ESCROW_ADDRESS;
+export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS;
+
+const erc20Abi = [
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
+const escrowAbi = [
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "toolId", type: "bytes32" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+      { name: "dueAt", type: "uint40" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+declare global {
+  interface Window {
+    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
+  }
+}
+
+export async function connectWallet() {
+  if (!window.ethereum) throw new Error("Install a wallet extension to continue.");
+  const client = createWalletClient({ chain: baseSepolia, transport: custom(window.ethereum) });
+  const [account] = await client.requestAddresses();
+  return { client, account };
+}
+
+export async function approveDeposit(amount: number) {
+  if (!ESCROW_ADDRESS || !USDC_ADDRESS) throw new Error("Contract addresses are not configured.");
+  const { client, account } = await connectWallet();
+  return client.sendTransaction({
+    account,
+    chain: baseSepolia,
+    to: USDC_ADDRESS,
+    data: encodeFunctionData({
+      abi: erc20Abi,
+      functionName: "approve",
+      args: [ESCROW_ADDRESS, parseUnits(String(amount), 6)],
+    }),
+  });
+}
+
+export async function requestLoan(owner: `0x${string}`, toolId: string, deposit: number, dailyFee: number, days: number) {
+  if (!ESCROW_ADDRESS) throw new Error("Escrow address is not configured.");
+  const { client, account } = await connectWallet();
+  return client.sendTransaction({
+    account,
+    chain: baseSepolia,
+    to: ESCROW_ADDRESS,
+    data: encodeFunctionData({
+      abi: escrowAbi,
+      functionName: "requestLoan",
+      args: [
+        owner,
+        keccak256(stringToBytes(toolId)),
+        parseUnits(String(deposit), 6),
+        parseUnits(String(dailyFee), 6),
+        Math.floor(Date.now() / 1000) + days * 86_400,
+      ],
+    }),
+  });
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts
new file mode 100644
index 0000000000000000000000000000000000000000..e50707d708f2dbb57353219fc04aa4085da2b8c6
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts
@@ -0,0 +1,43 @@
+import type { Tool } from "./types";
+
+export const DEMO_TOOLS: Tool[] = [
+  {
+    id: "cordless-drill",
+    name: "18V cordless drill",
+    category: "Power tools",
+    condition: "Good. Two batteries; the chuck is a little stiff.",
+    photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Maya R.",
+    ownerAddress: "0x1111111111111111111111111111111111111111",
+    deposit: 45,
+    dailyFee: 4,
+    completedLoans: 18,
+    lateReturns: 1,
+  },
+  {
+    id: "extension-ladder",
+    name: "20′ extension ladder",
+    category: "Ladders",
+    condition: "Very good. 225 lb rating; pickup requires a long vehicle.",
+    photo: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Jordan K.",
+    ownerAddress: "0x2222222222222222222222222222222222222222",
+    deposit: 80,
+    dailyFee: 6,
+    completedLoans: 31,
+    lateReturns: 0,
+  },
+  {
+    id: "pressure-washer",
+    name: "Electric pressure washer",
+    category: "Outdoor",
+    condition: "Fair. Works well; cosmetic scuffs and a patched hose.",
+    photo: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Sam D.",
+    ownerAddress: "0x3333333333333333333333333333333333333333",
+    deposit: 65,
+    dailyFee: 5,
+    completedLoans: 9,
+    lateReturns: 2,
+  },
+];
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..693ac2e709e33f704d5a6416ff5fe19ffd5ef977
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx
@@ -0,0 +1,10 @@
+import { StrictMode } from "react";
+import { createRoot } from "react-dom/client";
+import App from "./App";
+import "./styles.css";
+
+createRoot(document.getElementById("root")!).render(
+  <StrictMode>
+    <App />
+  </StrictMode>,
+);
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..1863fa7c0ff5556e72a6a9f2e4b1f9cb859ad901
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/styles.css
@@ -0,0 +1,96 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');
+
+:root { color: #24352a; background: #f6f1e7; font-family: "DM Sans", sans-serif; font-synthesis: none; }
+* { box-sizing: border-box; }
+html { scroll-behavior: smooth; }
+body { margin: 0; }
+button, input, textarea, select { font: inherit; }
+button, a { -webkit-tap-highlight-color: transparent; }
+button { cursor: pointer; }
+header { height: 78px; display: flex; align-items: center; padding: 0 max(5vw, 24px); border-bottom: 1px solid #d9d2c4; gap: 44px; background: rgba(246,241,231,.93); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(12px); }
+.brand { font-family: "DM Serif Display"; font-size: 26px; color: #203b2a; text-decoration: none; margin-right: auto; }
+.brand span { color: #e25b3f; }
+nav { display: flex; gap: 30px; }
+nav a { color: #526056; text-decoration: none; font-size: 14px; font-weight: 600; }
+.wallet, .secondary { border: 1px solid #294c36; background: transparent; color: #294c36; border-radius: 4px; padding: 11px 16px; font-weight: 700; }
+main { overflow: hidden; }
+.hero { min-height: 620px; display: grid; grid-template-columns: 1.05fr .95fr; gap: 7vw; align-items: center; padding: 70px max(7vw, 28px) 82px; }
+.eyebrow { letter-spacing: .18em; font-size: 11px; font-weight: 800; color: #e15b3f; margin-bottom: 18px; }
+h1, h2 { font-family: "DM Serif Display"; font-weight: 400; line-height: .98; margin: 0; color: #1f3b29; }
+h1 { font-size: clamp(64px, 7.4vw, 110px); letter-spacing: -.04em; }
+h1 em { color: #df5c40; }
+h2 { font-size: clamp(40px, 4vw, 58px); }
+.intro { max-width: 560px; color: #657067; font-size: 18px; line-height: 1.65; margin: 28px 0; }
+.hero-actions { display: flex; gap: 24px; align-items: center; }
+.primary { border: 0; border-radius: 3px; padding: 15px 22px; background: #df5c40; color: white; font-weight: 700; text-decoration: none; box-shadow: 0 4px 0 #b94731; }
+.primary:hover { background: #cf4e33; }
+.primary:disabled { opacity: .55; cursor: wait; }
+.text-button { border: 0; background: none; color: #2c543b; font-weight: 700; text-decoration: underline; text-underline-offset: 5px; }
+.social-proof { margin-top: 36px; color: #7a827c; font-size: 13px; }
+.hero-art { position: relative; min-height: 500px; padding: 32px 0 0 42px; }
+.hero-art img { position: relative; width: 92%; height: 450px; object-fit: cover; filter: saturate(.72); border-radius: 46% 46% 6px 6px; box-shadow: 17px 18px 0 #d8cda5; }
+.sun { position: absolute; width: 190px; height: 190px; border-radius: 50%; background: #edb943; right: -35px; top: -10px; }
+.note { position: absolute; background: #f9f5ec; padding: 16px 22px; left: 0; bottom: 30px; box-shadow: 0 9px 25px #303c3122; transform: rotate(-2deg); font-size: 13px; line-height: 1.6; }
+.browse { background: #e7eadc; padding: 88px max(7vw, 28px) 100px; }
+.section-title { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
+.sort-note { color: #6c766e; font-size: 13px; margin: 18px 0 30px; }
+.tool-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
+.tool-card { background: #f8f4eb; border: 1px solid #d4d6c8; }
+.tool-photo { height: 230px; position: relative; overflow: hidden; }
+.tool-photo img { width: 100%; height: 100%; object-fit: cover; filter: saturate(.68); transition: transform .4s; }
+.tool-card:hover img { transform: scale(1.03); }
+.tool-photo span { position: absolute; top: 14px; left: 14px; background: #f7f2e7e8; color: #38503e; padding: 7px 10px; font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
+.tool-body { padding: 23px; }
+h3 { color: #283d2e; margin: 0 0 9px; font-size: 21px; }
+.tool-body > p { color: #788078; min-height: 42px; font-size: 13px; line-height: 1.55; }
+.owner { display: flex; gap: 10px; align-items: center; padding: 17px 0; border-top: 1px solid #dddace; border-bottom: 1px solid #dddace; }
+.avatar { width: 34px; height: 34px; border-radius: 50%; background: #d7a746; display: grid; place-items: center; font-family: "DM Serif Display"; }
+.owner div { display: flex; flex-direction: column; font-size: 12px; }
+.owner small { color: #858b85; }
+.score { margin-left: auto; color: #356343; }
+.terms { display: flex; gap: 35px; margin: 17px 0; font-size: 14px; font-weight: 700; }
+.terms span { display: flex; flex-direction: column; }
+.terms small { font-weight: 500; color: #858b85; }
+.full { width: 100%; }
+.how { padding: 95px max(7vw, 28px); }
+.steps { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 56px; gap: 55px; }
+.steps > div { border-top: 1px solid #aab1a8; padding-top: 20px; position: relative; }
+.steps b { font-family: "DM Serif Display"; color: #df5c40; font-size: 30px; }
+.steps h3 { margin-top: 25px; }
+.steps p { color: #747e76; line-height: 1.6; }
+footer { background: #203b2a; color: #cbd3cc; display: flex; justify-content: space-between; padding: 35px max(7vw, 28px); align-items: center; font-size: 12px; }
+footer .brand { color: white; margin: 0; }
+.overlay { position: fixed; inset: 0; z-index: 30; background: #13261cb8; display: grid; place-items: center; padding: 20px; backdrop-filter: blur(4px); }
+.modal { width: min(520px, 100%); max-height: 90vh; overflow: auto; padding: 38px; background: #f8f3e9; position: relative; box-shadow: 0 25px 80px #0005; }
+.modal h2 { margin-bottom: 26px; font-size: 42px; }
+.close { position: absolute; right: 18px; top: 15px; border: 0; background: none; font-size: 28px; color: #687169; }
+label { display: flex; flex-direction: column; gap: 7px; margin: 16px 0; color: #465448; font-size: 12px; font-weight: 700; }
+input, textarea, select { border: 1px solid #bcc2b9; padding: 12px; background: #fffdf8; border-radius: 2px; color: #23382a; }
+textarea { min-height: 80px; resize: vertical; }
+.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
+.summary { background: #e8eadf; padding: 16px; margin: 20px 0; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
+.summary span { display: flex; justify-content: space-between; }
+.warning { background: #fff1cb; color: #72591b; padding: 12px; font-size: 12px; }
+.privacy { display: block; color: #7c857e; margin-top: 16px; text-align: center; }
+.toast { position: fixed; z-index: 50; right: 20px; bottom: 20px; max-width: 460px; padding: 16px 45px 16px 18px; color: white; background: #264b35; box-shadow: 0 10px 30px #0003; font-size: 13px; cursor: pointer; }
+.toast b { position: absolute; right: 15px; font-size: 18px; }
+@media (max-width: 900px) {
+  nav { display: none; }
+  .hero { grid-template-columns: 1fr; padding-top: 50px; }
+  .hero-art { min-height: 400px; }
+  .hero-art img { height: 370px; }
+  .tool-grid { grid-template-columns: 1fr 1fr; }
+}
+@media (max-width: 620px) {
+  header { padding: 0 18px; }
+  .brand { font-size: 22px; }
+  .wallet { padding: 9px; font-size: 11px; }
+  h1 { font-size: 58px; }
+  .hero { padding-inline: 22px; }
+  .hero-art { min-height: 330px; padding-left: 20px; }
+  .hero-art img { height: 300px; width: 96%; }
+  .tool-grid, .steps { grid-template-columns: 1fr; }
+  .section-title { align-items: start; flex-direction: column; }
+  footer { flex-direction: column; gap: 15px; }
+  .modal { padding: 30px 22px; }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts
new file mode 100644
index 0000000000000000000000000000000000000000..ec6aff57eafc6556b276dd2254ff447651ab6e4e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts
@@ -0,0 +1,15 @@
+export type Tool = {
+  id: string;
+  name: string;
+  category: string;
+  condition: string;
+  photo: string;
+  ownerName: string;
+  ownerAddress: `0x${string}`;
+  deposit: number;
+  dailyFee: number;
+  completedLoans: number;
+  lateReturns: number;
+};
+
+export type ListingDraft = Pick<Tool, "name" | "category" | "condition" | "photo" | "deposit" | "dailyFee">;
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts
new file mode 100644
index 0000000000000000000000000000000000000000..c0a0d34a1e7053aadaa79bc804a1ea4581494940
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts
@@ -0,0 +1,6 @@
+/// <reference types="vite/client" />
+
+interface ImportMetaEnv {
+  readonly VITE_ESCROW_ADDRESS?: `0x${string}`;
+  readonly VITE_USDC_ADDRESS?: `0x${string}`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..db7c38780e044b9994943170ebb67971a45d6008
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
@@ -0,0 +1,96 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract ToolshedEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    ToolshedEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(token);
+        vm.prank(BORROWER);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "full refund");
+        (uint64 completed, uint64 late) = escrow.trackRecords(BORROWER);
+        require(completed == 1 && late == 0, "record");
+    }
+
+    function testLateFeeRoundsPartialDayUp() public {
+        uint40 due = uint40(block.timestamp + 3 days);
+        uint256 id = _request(100e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 1 days + 1);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(OWNER) == 14e6, "two late days");
+        require(token.balanceOf(BORROWER) == 86e6, "refund");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(20e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 100 days);
+        escrow.settleExpired(id);
+        require(token.balanceOf(OWNER) == 20e6, "capped");
+        require(token.balanceOf(address(escrow)) == 0, "no dust");
+    }
+
+    function testCancelledRequestRefunds() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(BORROWER);
+        escrow.cancelRequest(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refunded");
+    }
+
+    function testOnlyOwnerCanConfirm() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.expectRevert(ToolshedEscrow.NotOwner.selector);
+        vm.prank(BORROWER);
+        escrow.confirmReturn(id);
+    }
+
+    function testFuzzFeeNeverExceedsDeposit(uint96 deposit, uint96 dailyFee, uint16 daysLate)
+        public
+    {
+        deposit = uint96(uint256(deposit) % 1_000_000e6 + 1);
+        dailyFee = uint96(uint256(dailyFee) % deposit + 1);
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(deposit, dailyFee, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + uint256(daysLate) * 1 days);
+        (, uint256 fee, uint256 refund) = escrow.quoteSettlement(id);
+        require(fee <= deposit && fee + refund == deposit, "conservation");
+    }
+
+    function _request(uint96 deposit, uint96 fee, uint40 due) private returns (uint256) {
+        token.mint(BORROWER, deposit);
+        vm.prank(BORROWER);
+        return escrow.requestLoan(OWNER, keccak256("drill"), deposit, fee, due);
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json
new file mode 100644
index 0000000000000000000000000000000000000000..e935337c4f4097887626cfa43dcb106e3130d948
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json
@@ -0,0 +1,20 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "allowJs": false,
+    "skipLibCheck": true,
+    "esModuleInterop": true,
+    "allowSyntheticDefaultImports": true,
+    "strict": true,
+    "forceConsistentCasingInFileNames": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "resolveJsonModule": true,
+    "isolatedModules": true,
+    "noEmit": true,
+    "jsx": "react-jsx"
+  },
+  "include": ["src"]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d32ff682003e0ff5d8a6e6bb3663d4c35a45b116
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json
@@ -0,0 +1,4 @@
+{
+  "files": [],
+  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json
new file mode 100644
index 0000000000000000000000000000000000000000..5eef90e107cf232f345dbbcae1daa5213d066518
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json
@@ -0,0 +1,10 @@
+{
+  "compilerOptions": {
+    "composite": true,
+    "skipLibCheck": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "allowImportingTsExtensions": true
+  },
+  "include": ["vite.config.ts"]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..081c8d9f69fcb741cce28e9eb3562517df8dbb14
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts
@@ -0,0 +1,6 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});

diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6d271d037d74066f6f4efa8143c38cd7bffd66ff
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/.gitignore
@@ -0,0 +1,9 @@
+node_modules/
+dist/
+out/
+build/
+cache/
+broadcast/
+.env
+.env.local
+*.local
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
new file mode 100644
index 0000000000000000000000000000000000000000..73a4c8e52559b6927deb14b0b9128fa0683e76a4
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/ToolshedEscrow.sol
@@ -0,0 +1,163 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "./interfaces/IERC20.sol";
+import {SafeERC20} from "./libraries/SafeERC20.sol";
+
+/// @notice USDC escrow for person-to-person physical tool loans.
+/// @dev Tool metadata stays offchain; its hash permanently binds each loan to a listing.
+contract ToolshedEscrow {
+    using SafeERC20 for IERC20;
+
+    enum Status {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Cancelled,
+        Expired
+    }
+
+    struct Loan {
+        address owner;
+        address borrower;
+        bytes32 toolId;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        uint40 dueAt;
+        Status status;
+    }
+
+    struct TrackRecord {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    uint256 public constant DAY = 1 days;
+    uint256 public constant EXPIRY_GRACE = 30 days;
+    IERC20 public immutable usdc;
+    uint256 public nextLoanId = 1;
+
+    mapping(uint256 => Loan) public loans;
+    mapping(address => TrackRecord) public trackRecords;
+
+    error InvalidTerms();
+    error NotBorrower();
+    error NotOwner();
+    error WrongStatus();
+    error TooEarly();
+
+    event LoanRequested(
+        uint256 indexed loanId,
+        bytes32 indexed toolId,
+        address indexed owner,
+        address borrower,
+        uint256 deposit,
+        uint256 dailyLateFee,
+        uint256 dueAt
+    );
+    event LoanActivated(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 lateDays, uint256 fee, uint256 refund);
+    event LoanExpired(uint256 indexed loanId, uint256 fee, uint256 refund);
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function requestLoan(
+        address owner,
+        bytes32 toolId,
+        uint96 deposit,
+        uint96 dailyLateFee,
+        uint40 dueAt
+    ) external returns (uint256 loanId) {
+        if (
+            owner == address(0) || owner == msg.sender || toolId == bytes32(0) || deposit == 0
+                || dailyLateFee == 0 || dailyLateFee > deposit || dueAt <= block.timestamp
+        ) revert InvalidTerms();
+
+        loanId = nextLoanId++;
+        loans[loanId] = Loan({
+            owner: owner,
+            borrower: msg.sender,
+            toolId: toolId,
+            deposit: deposit,
+            dailyLateFee: dailyLateFee,
+            dueAt: dueAt,
+            status: Status.Requested
+        });
+        usdc.safeTransferFrom(msg.sender, address(this), deposit);
+        emit LoanRequested(
+            loanId, toolId, owner, msg.sender, deposit, dailyLateFee, dueAt
+        );
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Active;
+        emit LoanActivated(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.borrower && msg.sender != loan.owner) revert NotBorrower();
+        if (loan.status != Status.Requested) revert WrongStatus();
+        loan.status = Status.Cancelled;
+        usdc.safeTransfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    function confirmReturn(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (msg.sender != loan.owner) revert NotOwner();
+        if (loan.status != Status.Active) revert WrongStatus();
+        _settle(loanId, loan, Status.Settled);
+    }
+
+    /// @notice After a long grace period anyone may settle, preventing permanently stuck funds.
+    function settleExpired(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) revert WrongStatus();
+        if (block.timestamp <= uint256(loan.dueAt) + EXPIRY_GRACE) revert TooEarly();
+        _settle(loanId, loan, Status.Expired);
+    }
+
+    function quoteSettlement(uint256 loanId)
+        public
+        view
+        returns (uint256 lateDays, uint256 fee, uint256 refund)
+    {
+        Loan storage loan = loans[loanId];
+        if (loan.status != Status.Active) return (0, 0, loan.deposit);
+        if (block.timestamp > loan.dueAt) {
+            lateDays = (block.timestamp - loan.dueAt + DAY - 1) / DAY;
+        }
+        fee = lateDays * loan.dailyLateFee;
+        if (fee > loan.deposit) fee = loan.deposit;
+        refund = loan.deposit - fee;
+    }
+
+    function reliabilityBps(address member) external view returns (uint256) {
+        TrackRecord memory record = trackRecords[member];
+        if (record.completedLoans == 0) return 10_000;
+        return
+            (uint256(record.completedLoans - record.lateReturns) * 10_000)
+                / record.completedLoans;
+    }
+
+    function _settle(uint256 loanId, Loan storage loan, Status status) private {
+        (uint256 lateDays, uint256 fee, uint256 refund) = quoteSettlement(loanId);
+        loan.status = status;
+        TrackRecord storage record = trackRecords[loan.borrower];
+        record.completedLoans++;
+        if (lateDays != 0) record.lateReturns++;
+        if (fee != 0) usdc.safeTransfer(loan.owner, fee);
+        if (refund != 0) usdc.safeTransfer(loan.borrower, refund);
+        if (status == Status.Expired) emit LoanExpired(loanId, fee, refund);
+        else emit LoanSettled(loanId, lateDays, fee, refund);
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..029d7680ff59ef9c90567d00d34636aca8057845
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/interfaces/IERC20.sol
@@ -0,0 +1,10 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function balanceOf(address account) external view returns (uint256);
+    function allowance(address owner, address spender) external view returns (uint256);
+    function approve(address spender, uint256 amount) external returns (bool);
+    function transfer(address to, uint256 amount) external returns (bool);
+    function transferFrom(address from, address to, uint256 amount) external returns (bool);
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f19dda859d7e3d8ab4131b667d34c279c9622bd2
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/libraries/SafeERC20.sol
@@ -0,0 +1,20 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+library SafeERC20 {
+    error SafeTransferFailed();
+
+    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+
+    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
+        (bool ok, bytes memory data) =
+            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..f21113df51bff710768b8afa33e3d584331da3dd
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/contracts/mocks/MockUSDC.sol
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {IERC20} from "../interfaces/IERC20.sol";
+
+contract MockUSDC is IERC20 {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "mUSDC";
+    uint8 public constant decimals = 6;
+    mapping(address => uint256) public balanceOf;
+    mapping(address => mapping(address => uint256)) public allowance;
+
+    function mint(address to, uint256 amount) external {
+        balanceOf[to] += amount;
+    }
+
+    function approve(address spender, uint256 amount) external returns (bool) {
+        allowance[msg.sender][spender] = amount;
+        return true;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        _transfer(msg.sender, to, amount);
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 allowed = allowance[from][msg.sender];
+        require(allowed >= amount, "allowance");
+        allowance[from][msg.sender] = allowed - amount;
+        _transfer(from, to, amount);
+        return true;
+    }
+
+    function _transfer(address from, address to, uint256 amount) private {
+        require(balanceOf[from] >= amount, "balance");
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..b986efc7156896b77400bd3ab2f469906b9d2b08
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/foundry.toml
@@ -0,0 +1,10 @@
+[profile.default]
+src = "contracts"
+test = "test"
+out = "out"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[fmt]
+line_length = 100
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..d2fcf1e4b23972913c1a22837c7f3e5e0731843f
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/index.html
@@ -0,0 +1,13 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="description" content="Borrow useful things from people nearby." />
+    <title>Toolshed — the neighborhood lending library</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..9c185c5d9314a9e217aff36503105e9b8f598491
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "preview": "vite preview",
+    "test": "forge test",
+    "test:verbose": "forge test -vvv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^4.4.1",
+    "vite": "^6.3.5",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.29.4"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.2",
+    "@types/react-dom": "^19.1.2",
+    "typescript": "^5.8.3"
+  }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/App.tsx b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/App.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..f0945fceaecb42d434eaa13a248a0fe6bc8534dd
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/App.tsx
@@ -0,0 +1,214 @@
+import { FormEvent, useMemo, useState } from "react";
+import { DEMO_TOOLS } from "./data";
+import { approveDeposit, connectWallet, ESCROW_ADDRESS, requestLoan } from "./contract";
+import type { ListingDraft, Tool } from "./types";
+
+const EMPTY_DRAFT: ListingDraft = {
+  name: "",
+  category: "Power tools",
+  condition: "",
+  photo: "",
+  deposit: 40,
+  dailyFee: 4,
+};
+
+const reliability = (tool: Tool) =>
+  tool.completedLoans === 0 ? 100 : Math.round(((tool.completedLoans - tool.lateReturns) / tool.completedLoans) * 100);
+
+function App() {
+  const [account, setAccount] = useState<`0x${string}`>();
+  const [localTools, setLocalTools] = useState<Tool[]>(() => {
+    try {
+      return JSON.parse(localStorage.getItem("toolshed:listings") ?? "[]");
+    } catch {
+      return [];
+    }
+  });
+  const [draft, setDraft] = useState(EMPTY_DRAFT);
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [approved, setApproved] = useState(false);
+  const [pending, setPending] = useState<"connect" | "approve" | "request">();
+  const [notice, setNotice] = useState("");
+  const [showListForm, setShowListForm] = useState(false);
+
+  const tools = useMemo(
+    () => [...DEMO_TOOLS, ...localTools].sort((a, b) => reliability(b) - reliability(a) || b.completedLoans - a.completedLoans),
+    [localTools],
+  );
+
+  async function connect() {
+    setPending("connect");
+    setNotice("");
+    try {
+      const wallet = await connectWallet();
+      setAccount(wallet.account);
+    } catch (error) {
+      setNotice(error instanceof Error ? error.message : "Could not connect wallet.");
+    } finally {
+      setPending(undefined);
+    }
+  }
+
+  function addListing(event: FormEvent) {
+    event.preventDefault();
+    if (!account) {
+      setNotice("Connect your wallet before listing a tool.");
+      return;
+    }
+    const listing: Tool = {
+      ...draft,
+      id: `${draft.name.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}`,
+      ownerName: "You",
+      ownerAddress: account,
+      photo: draft.photo || "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=1000&q=80",
+      completedLoans: 0,
+      lateReturns: 0,
+    };
+    const next = [...localTools, listing];
+    setLocalTools(next);
+    localStorage.setItem("toolshed:listings", JSON.stringify(next));
+    setDraft(EMPTY_DRAFT);
+    setShowListForm(false);
+    setNotice("Tool listed on this device. Pin metadata to a shared store before production.");
+  }
+
+  async function approve() {
+    if (!selected) return;
+    setPending("approve");
+    setNotice("");
+    try {
+      const hash = await approveDeposit(selected.deposit);
+      setApproved(true);
+      setNotice(`Approval submitted: ${hash.slice(0, 10)}… Wait for confirmation, then request.`);
+    } catch (error) {
+      setNotice(error instanceof Error ? error.message : "Approval failed.");
+    } finally {
+      setPending(undefined);
+    }
+  }
+
+  async function submitRequest() {
+    if (!selected) return;
+    setPending("request");
+    setNotice("");
+    try {
+      const hash = await requestLoan(selected.ownerAddress, selected.id, selected.deposit, selected.dailyFee, days);
+      setNotice(`Request submitted: ${hash.slice(0, 10)}… The owner must accept before pickup.`);
+      setSelected(undefined);
+      setApproved(false);
+    } catch (error) {
+      setNotice(error instanceof Error ? error.message : "Request failed.");
+    } finally {
+      setPending(undefined);
+    }
+  }
+
+  return (
+    <>
+      <header>
+        <a className="brand" href="#"><span>⌂</span> Toolshed</a>
+        <nav><a href="#browse">Browse</a><a href="#how">How it works</a></nav>
+        <button className="wallet" onClick={connect} disabled={Boolean(pending)}>
+          {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : pending === "connect" ? "Connecting…" : "Connect wallet"}
+        </button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div>
+            <p className="eyebrow">THE NEIGHBORHOOD TOOL LIBRARY</p>
+            <h1>More making.<br /><em>Less buying.</em></h1>
+            <p className="intro">Borrow well-kept tools from people nearby. A small USDC deposit keeps everything neighborly.</p>
+            <div className="hero-actions">
+              <a className="primary" href="#browse">Find a tool →</a>
+              <button className="text-button" onClick={() => setShowListForm(true)}>List something you own</button>
+            </div>
+            <div className="social-proof"><strong>300</strong> neighbors · <strong>94%</strong> returned on time</div>
+          </div>
+          <div className="hero-art" aria-label="A shared neighborhood drill">
+            <span className="sun" />
+            <img src={DEMO_TOOLS[0].photo} alt="Cordless drill on a workbench" />
+            <div className="note"><b>Available this weekend</b><br />2 blocks away</div>
+          </div>
+        </section>
+
+        <section id="browse" className="browse">
+          <div className="section-title">
+            <div><p className="eyebrow">AVAILABLE NEARBY</p><h2>Good tools, good neighbors.</h2></div>
+            <button className="secondary" onClick={() => setShowListForm(true)}>+ List a tool</button>
+          </div>
+          <p className="sort-note">Sorted by member reliability, then lending history.</p>
+          <div className="tool-grid">
+            {tools.map(tool => (
+              <article className="tool-card" key={tool.id}>
+                <div className="tool-photo"><img src={tool.photo} alt={tool.name} /><span>{tool.category}</span></div>
+                <div className="tool-body">
+                  <h3>{tool.name}</h3>
+                  <p>{tool.condition}</p>
+                  <div className="owner">
+                    <span className="avatar">{tool.ownerName[0]}</span>
+                    <div><b>{tool.ownerName}</b><small>{tool.completedLoans} loans · {tool.lateReturns} late</small></div>
+                    <strong className="score">{reliability(tool)}%</strong>
+                  </div>
+                  <div className="terms"><span><small>Deposit</small>${tool.deposit} USDC</span><span><small>Late fee</small>${tool.dailyFee}/day</span></div>
+                  <button className="primary full" onClick={() => { setSelected(tool); setApproved(false); }}>Ask to borrow</button>
+                </div>
+              </article>
+            ))}
+          </div>
+        </section>
+
+        <section id="how" className="how">
+          <p className="eyebrow">HOW IT WORKS</p><h2>Trust, with a little backup.</h2>
+          <div className="steps">
+            <div><b>01</b><h3>Find it nearby</h3><p>Browse tools and condition notes from association members.</p></div>
+            <div><b>02</b><h3>Put down a deposit</h3><p>Approve the exact USDC deposit, then send your request.</p></div>
+            <div><b>03</b><h3>Return & build trust</h3><p>On return, the owner releases your deposit minus any late fee.</p></div>
+          </div>
+        </section>
+      </main>
+
+      <footer><span className="brand">⌂ Toolshed</span><span>Built for neighbors, not profit.</span><span>Base Sepolia · USDC escrow</span></footer>
+
+      {notice && <div className="toast" role="status" onClick={() => setNotice("")}>{notice}<b>×</b></div>}
+
+      {selected && (
+        <div className="overlay" onMouseDown={() => setSelected(undefined)}>
+          <section className="modal" onMouseDown={event => event.stopPropagation()}>
+            <button className="close" onClick={() => setSelected(undefined)}>×</button>
+            <p className="eyebrow">BORROW REQUEST</p><h2>{selected.name}</h2>
+            <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))} /></label>
+            <div className="summary"><span>Refundable deposit <b>${selected.deposit} USDC</b></span><span>Late after {days} days <b>${selected.dailyFee}/day</b></span></div>
+            {!ESCROW_ADDRESS && <p className="warning">Demo mode: add contract addresses to <code>.env.local</code> to transact.</p>}
+            {!account ? (
+              <button className="primary full" onClick={connect}>Connect wallet</button>
+            ) : !approved ? (
+              <button className="primary full" onClick={approve} disabled={pending === "approve"}>{pending === "approve" ? "Confirm in wallet…" : `1. Approve ${selected.deposit} USDC`}</button>
+            ) : (
+              <button className="primary full" onClick={submitRequest} disabled={pending === "request"}>{pending === "request" ? "Confirm in wallet…" : "2. Send borrow request"}</button>
+            )}
+            <small className="privacy">Your wallet, amounts, and loan timing are public onchain.</small>
+          </section>
+        </div>
+      )}
+
+      {showListForm && (
+        <div className="overlay" onMouseDown={() => setShowListForm(false)}>
+          <form className="modal" onSubmit={addListing} onMouseDown={event => event.stopPropagation()}>
+            <button type="button" className="close" onClick={() => setShowListForm(false)}>×</button>
+            <p className="eyebrow">SHARE WHAT YOU HAVE</p><h2>List a tool</h2>
+            <label>Tool name<input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
+            <label>Category<select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}><option>Power tools</option><option>Hand tools</option><option>Outdoor</option><option>Ladders</option><option>Other</option></select></label>
+            <label>Photo URL<input type="url" placeholder="https://…" value={draft.photo} onChange={event => setDraft({ ...draft, photo: event.target.value })} /></label>
+            <label>Condition notes<textarea required value={draft.condition} onChange={event => setDraft({ ...draft, condition: event.target.value })} /></label>
+            <div className="field-row"><label>Deposit (USDC)<input type="number" min="1" value={draft.deposit} onChange={event => setDraft({ ...draft, deposit: Number(event.target.value) })} /></label><label>Late fee / day<input type="number" min="1" value={draft.dailyFee} onChange={event => setDraft({ ...draft, dailyFee: Number(event.target.value) })} /></label></div>
+            <button className="primary full">Publish listing</button>
+          </form>
+        </div>
+      )}
+    </>
+  );
+}
+
+export default App;
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts
new file mode 100644
index 0000000000000000000000000000000000000000..540dd2d11f649593de7b29b0c427ddbfecf66237
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/contract.ts
@@ -0,0 +1,80 @@
+import { createWalletClient, custom, encodeFunctionData, keccak256, parseUnits, stringToBytes } from "viem";
+import { baseSepolia } from "viem/chains";
+
+export const ESCROW_ADDRESS = import.meta.env.VITE_ESCROW_ADDRESS;
+export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS;
+
+const erc20Abi = [
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
+const escrowAbi = [
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "toolId", type: "bytes32" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+      { name: "dueAt", type: "uint40" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+declare global {
+  interface Window {
+    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
+  }
+}
+
+export async function connectWallet() {
+  if (!window.ethereum) throw new Error("Install a wallet extension to continue.");
+  const client = createWalletClient({ chain: baseSepolia, transport: custom(window.ethereum) });
+  const [account] = await client.requestAddresses();
+  return { client, account };
+}
+
+export async function approveDeposit(amount: number) {
+  if (!ESCROW_ADDRESS || !USDC_ADDRESS) throw new Error("Contract addresses are not configured.");
+  const { client, account } = await connectWallet();
+  return client.sendTransaction({
+    account,
+    chain: baseSepolia,
+    to: USDC_ADDRESS,
+    data: encodeFunctionData({
+      abi: erc20Abi,
+      functionName: "approve",
+      args: [ESCROW_ADDRESS, parseUnits(String(amount), 6)],
+    }),
+  });
+}
+
+export async function requestLoan(owner: `0x${string}`, toolId: string, deposit: number, dailyFee: number, days: number) {
+  if (!ESCROW_ADDRESS) throw new Error("Escrow address is not configured.");
+  const { client, account } = await connectWallet();
+  return client.sendTransaction({
+    account,
+    chain: baseSepolia,
+    to: ESCROW_ADDRESS,
+    data: encodeFunctionData({
+      abi: escrowAbi,
+      functionName: "requestLoan",
+      args: [
+        owner,
+        keccak256(stringToBytes(toolId)),
+        parseUnits(String(deposit), 6),
+        parseUnits(String(dailyFee), 6),
+        Math.floor(Date.now() / 1000) + days * 86_400,
+      ],
+    }),
+  });
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts
new file mode 100644
index 0000000000000000000000000000000000000000..e50707d708f2dbb57353219fc04aa4085da2b8c6
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/data.ts
@@ -0,0 +1,43 @@
+import type { Tool } from "./types";
+
+export const DEMO_TOOLS: Tool[] = [
+  {
+    id: "cordless-drill",
+    name: "18V cordless drill",
+    category: "Power tools",
+    condition: "Good. Two batteries; the chuck is a little stiff.",
+    photo: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Maya R.",
+    ownerAddress: "0x1111111111111111111111111111111111111111",
+    deposit: 45,
+    dailyFee: 4,
+    completedLoans: 18,
+    lateReturns: 1,
+  },
+  {
+    id: "extension-ladder",
+    name: "20′ extension ladder",
+    category: "Ladders",
+    condition: "Very good. 225 lb rating; pickup requires a long vehicle.",
+    photo: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Jordan K.",
+    ownerAddress: "0x2222222222222222222222222222222222222222",
+    deposit: 80,
+    dailyFee: 6,
+    completedLoans: 31,
+    lateReturns: 0,
+  },
+  {
+    id: "pressure-washer",
+    name: "Electric pressure washer",
+    category: "Outdoor",
+    condition: "Fair. Works well; cosmetic scuffs and a patched hose.",
+    photo: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1000&q=80",
+    ownerName: "Sam D.",
+    ownerAddress: "0x3333333333333333333333333333333333333333",
+    deposit: 65,
+    dailyFee: 5,
+    completedLoans: 9,
+    lateReturns: 2,
+  },
+];
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..693ac2e709e33f704d5a6416ff5fe19ffd5ef977
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/main.tsx
@@ -0,0 +1,10 @@
+import { StrictMode } from "react";
+import { createRoot } from "react-dom/client";
+import App from "./App";
+import "./styles.css";
+
+createRoot(document.getElementById("root")!).render(
+  <StrictMode>
+    <App />
+  </StrictMode>,
+);
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..1863fa7c0ff5556e72a6a9f2e4b1f9cb859ad901
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/styles.css
@@ -0,0 +1,96 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');
+
+:root { color: #24352a; background: #f6f1e7; font-family: "DM Sans", sans-serif; font-synthesis: none; }
+* { box-sizing: border-box; }
+html { scroll-behavior: smooth; }
+body { margin: 0; }
+button, input, textarea, select { font: inherit; }
+button, a { -webkit-tap-highlight-color: transparent; }
+button { cursor: pointer; }
+header { height: 78px; display: flex; align-items: center; padding: 0 max(5vw, 24px); border-bottom: 1px solid #d9d2c4; gap: 44px; background: rgba(246,241,231,.93); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(12px); }
+.brand { font-family: "DM Serif Display"; font-size: 26px; color: #203b2a; text-decoration: none; margin-right: auto; }
+.brand span { color: #e25b3f; }
+nav { display: flex; gap: 30px; }
+nav a { color: #526056; text-decoration: none; font-size: 14px; font-weight: 600; }
+.wallet, .secondary { border: 1px solid #294c36; background: transparent; color: #294c36; border-radius: 4px; padding: 11px 16px; font-weight: 700; }
+main { overflow: hidden; }
+.hero { min-height: 620px; display: grid; grid-template-columns: 1.05fr .95fr; gap: 7vw; align-items: center; padding: 70px max(7vw, 28px) 82px; }
+.eyebrow { letter-spacing: .18em; font-size: 11px; font-weight: 800; color: #e15b3f; margin-bottom: 18px; }
+h1, h2 { font-family: "DM Serif Display"; font-weight: 400; line-height: .98; margin: 0; color: #1f3b29; }
+h1 { font-size: clamp(64px, 7.4vw, 110px); letter-spacing: -.04em; }
+h1 em { color: #df5c40; }
+h2 { font-size: clamp(40px, 4vw, 58px); }
+.intro { max-width: 560px; color: #657067; font-size: 18px; line-height: 1.65; margin: 28px 0; }
+.hero-actions { display: flex; gap: 24px; align-items: center; }
+.primary { border: 0; border-radius: 3px; padding: 15px 22px; background: #df5c40; color: white; font-weight: 700; text-decoration: none; box-shadow: 0 4px 0 #b94731; }
+.primary:hover { background: #cf4e33; }
+.primary:disabled { opacity: .55; cursor: wait; }
+.text-button { border: 0; background: none; color: #2c543b; font-weight: 700; text-decoration: underline; text-underline-offset: 5px; }
+.social-proof { margin-top: 36px; color: #7a827c; font-size: 13px; }
+.hero-art { position: relative; min-height: 500px; padding: 32px 0 0 42px; }
+.hero-art img { position: relative; width: 92%; height: 450px; object-fit: cover; filter: saturate(.72); border-radius: 46% 46% 6px 6px; box-shadow: 17px 18px 0 #d8cda5; }
+.sun { position: absolute; width: 190px; height: 190px; border-radius: 50%; background: #edb943; right: -35px; top: -10px; }
+.note { position: absolute; background: #f9f5ec; padding: 16px 22px; left: 0; bottom: 30px; box-shadow: 0 9px 25px #303c3122; transform: rotate(-2deg); font-size: 13px; line-height: 1.6; }
+.browse { background: #e7eadc; padding: 88px max(7vw, 28px) 100px; }
+.section-title { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
+.sort-note { color: #6c766e; font-size: 13px; margin: 18px 0 30px; }
+.tool-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
+.tool-card { background: #f8f4eb; border: 1px solid #d4d6c8; }
+.tool-photo { height: 230px; position: relative; overflow: hidden; }
+.tool-photo img { width: 100%; height: 100%; object-fit: cover; filter: saturate(.68); transition: transform .4s; }
+.tool-card:hover img { transform: scale(1.03); }
+.tool-photo span { position: absolute; top: 14px; left: 14px; background: #f7f2e7e8; color: #38503e; padding: 7px 10px; font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
+.tool-body { padding: 23px; }
+h3 { color: #283d2e; margin: 0 0 9px; font-size: 21px; }
+.tool-body > p { color: #788078; min-height: 42px; font-size: 13px; line-height: 1.55; }
+.owner { display: flex; gap: 10px; align-items: center; padding: 17px 0; border-top: 1px solid #dddace; border-bottom: 1px solid #dddace; }
+.avatar { width: 34px; height: 34px; border-radius: 50%; background: #d7a746; display: grid; place-items: center; font-family: "DM Serif Display"; }
+.owner div { display: flex; flex-direction: column; font-size: 12px; }
+.owner small { color: #858b85; }
+.score { margin-left: auto; color: #356343; }
+.terms { display: flex; gap: 35px; margin: 17px 0; font-size: 14px; font-weight: 700; }
+.terms span { display: flex; flex-direction: column; }
+.terms small { font-weight: 500; color: #858b85; }
+.full { width: 100%; }
+.how { padding: 95px max(7vw, 28px); }
+.steps { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 56px; gap: 55px; }
+.steps > div { border-top: 1px solid #aab1a8; padding-top: 20px; position: relative; }
+.steps b { font-family: "DM Serif Display"; color: #df5c40; font-size: 30px; }
+.steps h3 { margin-top: 25px; }
+.steps p { color: #747e76; line-height: 1.6; }
+footer { background: #203b2a; color: #cbd3cc; display: flex; justify-content: space-between; padding: 35px max(7vw, 28px); align-items: center; font-size: 12px; }
+footer .brand { color: white; margin: 0; }
+.overlay { position: fixed; inset: 0; z-index: 30; background: #13261cb8; display: grid; place-items: center; padding: 20px; backdrop-filter: blur(4px); }
+.modal { width: min(520px, 100%); max-height: 90vh; overflow: auto; padding: 38px; background: #f8f3e9; position: relative; box-shadow: 0 25px 80px #0005; }
+.modal h2 { margin-bottom: 26px; font-size: 42px; }
+.close { position: absolute; right: 18px; top: 15px; border: 0; background: none; font-size: 28px; color: #687169; }
+label { display: flex; flex-direction: column; gap: 7px; margin: 16px 0; color: #465448; font-size: 12px; font-weight: 700; }
+input, textarea, select { border: 1px solid #bcc2b9; padding: 12px; background: #fffdf8; border-radius: 2px; color: #23382a; }
+textarea { min-height: 80px; resize: vertical; }
+.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
+.summary { background: #e8eadf; padding: 16px; margin: 20px 0; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
+.summary span { display: flex; justify-content: space-between; }
+.warning { background: #fff1cb; color: #72591b; padding: 12px; font-size: 12px; }
+.privacy { display: block; color: #7c857e; margin-top: 16px; text-align: center; }
+.toast { position: fixed; z-index: 50; right: 20px; bottom: 20px; max-width: 460px; padding: 16px 45px 16px 18px; color: white; background: #264b35; box-shadow: 0 10px 30px #0003; font-size: 13px; cursor: pointer; }
+.toast b { position: absolute; right: 15px; font-size: 18px; }
+@media (max-width: 900px) {
+  nav { display: none; }
+  .hero { grid-template-columns: 1fr; padding-top: 50px; }
+  .hero-art { min-height: 400px; }
+  .hero-art img { height: 370px; }
+  .tool-grid { grid-template-columns: 1fr 1fr; }
+}
+@media (max-width: 620px) {
+  header { padding: 0 18px; }
+  .brand { font-size: 22px; }
+  .wallet { padding: 9px; font-size: 11px; }
+  h1 { font-size: 58px; }
+  .hero { padding-inline: 22px; }
+  .hero-art { min-height: 330px; padding-left: 20px; }
+  .hero-art img { height: 300px; width: 96%; }
+  .tool-grid, .steps { grid-template-columns: 1fr; }
+  .section-title { align-items: start; flex-direction: column; }
+  footer { flex-direction: column; gap: 15px; }
+  .modal { padding: 30px 22px; }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts
new file mode 100644
index 0000000000000000000000000000000000000000..ec6aff57eafc6556b276dd2254ff447651ab6e4e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/types.ts
@@ -0,0 +1,15 @@
+export type Tool = {
+  id: string;
+  name: string;
+  category: string;
+  condition: string;
+  photo: string;
+  ownerName: string;
+  ownerAddress: `0x${string}`;
+  deposit: number;
+  dailyFee: number;
+  completedLoans: number;
+  lateReturns: number;
+};
+
+export type ListingDraft = Pick<Tool, "name" | "category" | "condition" | "photo" | "deposit" | "dailyFee">;
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts
new file mode 100644
index 0000000000000000000000000000000000000000..c0a0d34a1e7053aadaa79bc804a1ea4581494940
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/src/vite-env.d.ts
@@ -0,0 +1,6 @@
+/// <reference types="vite/client" />
+
+interface ImportMetaEnv {
+  readonly VITE_ESCROW_ADDRESS?: `0x${string}`;
+  readonly VITE_USDC_ADDRESS?: `0x${string}`;
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..db7c38780e044b9994943170ebb67971a45d6008
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/test/ToolshedEscrow.t.sol
@@ -0,0 +1,96 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
+import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";
+
+interface Vm {
+    function prank(address) external;
+    function warp(uint256) external;
+    function expectRevert(bytes4) external;
+}
+
+contract ToolshedEscrowTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+    MockUSDC private token;
+    ToolshedEscrow private escrow;
+
+    function setUp() public {
+        token = new MockUSDC();
+        escrow = new ToolshedEscrow(token);
+        vm.prank(BORROWER);
+        token.approve(address(escrow), type(uint256).max);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(BORROWER) == 100e6, "full refund");
+        (uint64 completed, uint64 late) = escrow.trackRecords(BORROWER);
+        require(completed == 1 && late == 0, "record");
+    }
+
+    function testLateFeeRoundsPartialDayUp() public {
+        uint40 due = uint40(block.timestamp + 3 days);
+        uint256 id = _request(100e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 1 days + 1);
+        vm.prank(OWNER);
+        escrow.confirmReturn(id);
+        require(token.balanceOf(OWNER) == 14e6, "two late days");
+        require(token.balanceOf(BORROWER) == 86e6, "refund");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(20e6, 7e6, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + 100 days);
+        escrow.settleExpired(id);
+        require(token.balanceOf(OWNER) == 20e6, "capped");
+        require(token.balanceOf(address(escrow)) == 0, "no dust");
+    }
+
+    function testCancelledRequestRefunds() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(BORROWER);
+        escrow.cancelRequest(id);
+        require(token.balanceOf(BORROWER) == 100e6, "refunded");
+    }
+
+    function testOnlyOwnerCanConfirm() public {
+        uint256 id = _request(100e6, 5e6, uint40(block.timestamp + 3 days));
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.expectRevert(ToolshedEscrow.NotOwner.selector);
+        vm.prank(BORROWER);
+        escrow.confirmReturn(id);
+    }
+
+    function testFuzzFeeNeverExceedsDeposit(uint96 deposit, uint96 dailyFee, uint16 daysLate)
+        public
+    {
+        deposit = uint96(uint256(deposit) % 1_000_000e6 + 1);
+        dailyFee = uint96(uint256(dailyFee) % deposit + 1);
+        uint40 due = uint40(block.timestamp + 1 days);
+        uint256 id = _request(deposit, dailyFee, due);
+        vm.prank(OWNER);
+        escrow.acceptLoan(id);
+        vm.warp(uint256(due) + uint256(daysLate) * 1 days);
+        (, uint256 fee, uint256 refund) = escrow.quoteSettlement(id);
+        require(fee <= deposit && fee + refund == deposit, "conservation");
+    }
+
+    function _request(uint96 deposit, uint96 fee, uint40 due) private returns (uint256) {
+        token.mint(BORROWER, deposit);
+        vm.prank(BORROWER);
+        return escrow.requestLoan(OWNER, keccak256("drill"), deposit, fee, due);
+    }
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json
new file mode 100644
index 0000000000000000000000000000000000000000..e935337c4f4097887626cfa43dcb106e3130d948
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.app.json
@@ -0,0 +1,20 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "useDefineForClassFields": true,
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "allowJs": false,
+    "skipLibCheck": true,
+    "esModuleInterop": true,
+    "allowSyntheticDefaultImports": true,
+    "strict": true,
+    "forceConsistentCasingInFileNames": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "resolveJsonModule": true,
+    "isolatedModules": true,
+    "noEmit": true,
+    "jsx": "react-jsx"
+  },
+  "include": ["src"]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d32ff682003e0ff5d8a6e6bb3663d4c35a45b116
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.json
@@ -0,0 +1,4 @@
+{
+  "files": [],
+  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json
new file mode 100644
index 0000000000000000000000000000000000000000..5eef90e107cf232f345dbbcae1daa5213d066518
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/tsconfig.node.json
@@ -0,0 +1,10 @@
+{
+  "compilerOptions": {
+    "composite": true,
+    "skipLibCheck": true,
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "allowImportingTsExtensions": true
+  },
+  "include": ["vite.config.ts"]
+}
diff --git a/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..081c8d9f69fcb741cce28e9eb3562517df8dbb14
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204656Z-codex-with-skill-2/workspace/vite.config.ts
@@ -0,0 +1,6 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});

