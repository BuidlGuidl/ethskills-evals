Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 019fb4c2-f55f-7333-b906-b2f8a55880a6
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
I’m using the `ship` skill because this is an end-to-end dApp build; it routes architecture, contracts, frontend, testing, and deployment guidance.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
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
/bin/bash -lc "sed -n '241,520p' .agents/skills/ship/SKILL.md && rg --files -g '"'!lib/**'"' -g '"'!dist/**'"' -g '"'!build/**'"' -g '"'!out/**'"' | sed -n '1,200p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
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
TASK.md

codex
Architecture choice: one Base Sepolia escrow contract for USDC deposits/late-fee settlement; tool photos/metadata and reputation-derived sorting remain frontend/offchain, with loan outcomes sourced from contract events. I’m loading the contract, security, testing, frontend, and QA guidance before implementation.
exec
/bin/bash -lc "sed -n '1,200p' TASK.md && for skill_name in concepts l2s gas standards building-blocks addresses security testing orchestration frontend-ux tools wallets frontend-playbook qa indexing feedback; do printf '\\n===== %s =====\\n' \""'$skill_name"; curl -fsSL "https://ethskills.com/$skill_name/SKILL.md"; done' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
 succeeded in 1355ms:
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

===== l2s =====
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

===== gas =====
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

===== standards =====
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

===== building-blocks =====
---
name: building-blocks
description: DeFi legos and protocol composability on Ethereum and L2s. Major protocols per chain — Aerodrome on Base, GMX/Pendle on Arbitrum, Velodrome on Optimism — plus mainnet primitives (Uniswap, Aave, Compound, Curve). How they work, how to build on them, and how to combine them. Use when building DeFi integrations, choosing protocols on a specific L2, designing yield strategies, or composing existing protocols into something new.
---

# Building Blocks (DeFi Legos)

## What You Probably Got Wrong

**DeFi TVL:** Check [DeFi Llama](https://defillama.com/chain/Ethereum) for current Ethereum DeFi TVL. If you're quoting numbers from 2023-2024, they're stale.

**Uniswap V4 is live.** Launched mainnet **January 31, 2025** on 10+ chains. V4 introduced a **hooks system** — custom logic attached to pools (dynamic fees, TWAMM, limit orders, custom oracles). This is the biggest composability upgrade since flash loans. PoolManager addresses are different per chain (NOT deterministic like V3).

**Costs changed everything:** A flash loan arbitrage on mainnet costs ~$0.05-0.50 in gas now (was $5-50). This opens composability patterns that were previously uneconomical.

**The dominant DEX on each L2 is NOT Uniswap.** Aerodrome and Velodrome merged into **Aero** (November 2025, Dromos Labs) — the unified DEX dominates both Base and Optimism. Camelot is a major native DEX on Arbitrum. Don't default to Uniswap on every chain.

## Key Protocol Addresses (Verified Mar 2026)

| Protocol | Contract | Mainnet Address |
|----------|----------|-----------------|
| Uniswap V2 Router | Router | `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D` |
| Uniswap V2 Factory | Factory | `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f` |
| Uniswap V3 Factory | Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| Uniswap V3 SwapRouter02 | Router | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| Uniswap V4 PoolManager | PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| Uniswap Universal Router (V4) | Router | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` |
| Aave V3 Pool | Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |

See `addresses/SKILL.md` for complete multi-chain address list including L2-native protocols (Aerodrome, GMX, Pendle, Velodrome, Camelot, SyncSwap, Morpho).

## Uniswap V4 Hooks (New)

Hooks let you add custom logic that runs before/after swaps, liquidity changes, and donations. This is the biggest composability upgrade since flash loans.

### Hook Interface (Solidity)

```solidity
import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";

contract DynamicFeeHook is BaseHook {
    constructor(IPoolManager _manager) BaseHook(_manager) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,           // ← We hook here
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // Dynamic fee: higher fee during high-volume periods
    function beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // Return dynamic fee override (e.g., 0.05% normally, 0.30% during volatility)
        uint24 fee = _isHighVolatility() ? 3000 : 500;
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | 0x800000);
    }
}
```

**Hook use cases with real code patterns:**
- **Dynamic fees** — adjust based on volatility, time-of-day, or oracle data
- **TWAMM** — split large orders over time to reduce price impact
- **Limit orders** — execute when price crosses a threshold
- **MEV protection** — auction swap ordering rights to searchers
- **Custom oracles** — TWAP updated on every swap

## Composability Patterns (Updated for 2026 Gas)

These patterns are now **economically viable** even for small amounts due to sub-dollar gas:

### Flash Loan Arbitrage
Borrow from Aave → swap on Uniswap for profit → repay Aave. All in one transaction. If unprofitable, reverts (lose only gas: ~$0.05-0.50).

### Leveraged Yield Farming
Deposit ETH on Aave → borrow stablecoin → swap for more ETH → deposit again → repeat. Gas cost per loop: ~$0.02 on mainnet, negligible on L2.

### Meta-Aggregation
Route swaps across multiple DEXs for best execution. 1inch and Paraswap check Uniswap, Curve, Sushi simultaneously.

### ERC-4626 Yield Vaults

Standard vault interface — the "ERC-20 of yield." Every vault exposes the same functions regardless of strategy.

```solidity
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SimpleYieldVault is ERC4626 {
    constructor(IERC20 asset_) 
        ERC4626(asset_) 
        ERC20("Vault Shares", "vSHARE") 
    {}

    // totalAssets() drives the share price
    // As yield accrues, totalAssets grows → shares worth more
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + _getAccruedYield();
    }
}

// Usage: deposit/withdraw are standardized
// vault.deposit(1000e6, msg.sender);  // deposit 1000 USDC, get shares
// vault.redeem(shares, msg.sender, msg.sender);  // burn shares, get USDC back
// vault.convertToAssets(shares);  // how much USDC are my shares worth?
```

**Why ERC-4626 matters:** Composability. Any protocol can integrate any vault without custom adapters. Yearn V3, Aave's wrapped tokens, Morpho vaults, Pendle yield tokens — all ERC-4626.

### Flash Loan (Aave V3 — Complete Pattern)

```solidity
import {FlashLoanSimpleReceiverBase} from 
    "@aave/v3-core/contracts/flashloan-v3/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from 
    "@aave/v3-core/contracts/interfaces/IPoolAddressesProvider.sol";

contract FlashLoanArb is FlashLoanSimpleReceiverBase {
    constructor(IPoolAddressesProvider provider) 
        FlashLoanSimpleReceiverBase(provider) {}

    function executeArb(address token, uint256 amount) external {
        // Borrow `amount` of `token` — must repay + 0.05% fee in same tx
        POOL.flashLoanSimple(address(this), token, amount, "", 0);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,  // 0.05% fee
        address,
        bytes calldata
    ) external override returns (bool) {
        // --- Your arbitrage logic here ---
        // Buy cheap on DEX A, sell expensive on DEX B
        // Must end with at least `amount + premium` of `asset`
        
        uint256 owed = amount + premium;
        IERC20(asset).approve(address(POOL), owed);
        return true;  // If unprofitable, revert here — lose only gas (~$0.05-0.50)
    }
}
```

**Aave V3 Pool (mainnet):** `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
**Flash loan fee:** 0.05% (5 basis points). Free if you repay to an Aave debt position.

## Building on Base

**Dominant DEX: Aero** (formerly Aerodrome, ~$500-600M TVL) — NOT Uniswap. In November 2025, Dromos Labs merged Aerodrome (Base) and Velodrome (Optimism) into a unified cross-chain DEX called **Aero**. Same contracts, same ve(3,3) model, new brand.

### How Aero Works (Critical Difference from Uniswap)
- **LPs deposit tokens** into pools → earn **AERO emissions** (not trading fees!)
- **veAERO voters** lock AERO → vote on which pools get emissions → earn **100% of trading fees + bribes**
- This is the opposite of Uniswap where LPs earn fees directly
- **Flywheel:** Pools generating most fees → attract most votes → get most emissions → attract more LPs → deeper liquidity → more fees

### Aerodrome Swap (Router Interface)
```solidity
// Aerodrome Router: 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43 (Base)
struct Route {
    address from;
    address to;
    bool stable;       // true = stable pair (like Curve), false = volatile (like Uni V2)
    address factory;   // 0x420DD381b31aEf6683db6B902084cB0FFECe40Da
}

// Swap via Router
function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    Route[] calldata routes,
    address to,
    uint256 deadline
) external returns (uint256[] memory amounts);
```

### Base-Specific Patterns
- **Coinbase Smart Wallet** — ERC-4337 wallet, passkey auth, gasless txs via Coinbase paymaster
- **Farcaster Frames v2** — mini-apps embedded in social posts that trigger onchain actions
- **AgentKit** — Coinbase's framework for AI agents to interact onchain

## Building on Arbitrum (Highest DeFi Liquidity)

### GMX V2 — How GM Pools Work
- **Each market has its own isolated pool** (unlike V1's single GLP pool)
- LPs deposit into GM (liquidity) pools → receive GM tokens
- **Fully Backed markets:** ETH/USD backed by ETH + USDC. Backing tokens match the traded asset.
- **Synthetic markets:** DOGE/USD backed by ETH + USDC. Uses ADL (Auto-Deleveraging) when thresholds are reached.
- LPs earn: trading fees, liquidation fees, borrowing fees, swap fees. But bear risk from trader PnL.

### Pendle — Yield Tokenization
Pendle splits yield-bearing assets into principal and yield components:

1. **SY (Standardized Yield):** Wraps any yield-bearing asset. E.g., wstETH → SY-wstETH.
2. **PT (Principal Token):** The principal. Redeemable 1:1 at maturity. Trades at a discount (discount = implied yield).
3. **YT (Yield Token):** All yield until maturity. Value decays to 0 at maturity.
4. **Core invariant:** `SY_value = PT_value + YT_value`

**Use cases:**
- Buy PT at discount = **lock in fixed yield** (like a zero-coupon bond)
- Buy YT = **leverage your yield exposure** (bet yield goes up)
- LP in Pendle pools = earn trading fees + PENDLE incentives

### Arbitrum-Specific Tech
- **Stylus:** Write smart contracts in Rust/C++/WASM alongside EVM (10-100x gas savings for compute-heavy operations)
- **Orbit:** Launch custom L3 chains (47 live on mainnet)

See `addresses/SKILL.md` for all verified protocol addresses (GMX, Pendle, Camelot, Aerodrome, Velodrome, SyncSwap, Morpho).

## Discovery Resources

- **DeFi Llama:** https://defillama.com — TVL rankings, yield rankings, all chains
- **Dune Analytics:** https://dune.com — query onchain data
- **ethereum.org/en/dapps/** — curated list

## Guardrails for Composability

- **Every protocol you compose with is a dependency.** If Aave gets hacked, your vault depending on Aave is affected.
- **Oracle manipulation = exploits.** Verify oracle sources.
- **Impermanent loss** is real for AMM LPs. Quantify it before providing liquidity.
- **The interaction between two safe contracts can create unsafe behavior.** Audit compositions.
- **Start with small amounts.** Test with minimal value before scaling.
- **Flash loan attacks** can manipulate prices within a single transaction. Design for this.

===== addresses =====
---
name: addresses
description: Verified contract addresses for major Ethereum protocols across mainnet and L2s. Use this instead of guessing or hallucinating addresses. Includes Uniswap, Aave, Compound, Aerodrome, GMX, Pendle, Velodrome, Camelot, SyncSwap, Lido, Rocket Pool, 1inch, Permit2, MakerDAO/sDAI, EigenLayer, Across, Chainlink CCIP, Yearn V3, USDC, USDT, DAI, ENS, Safe, Chainlink, and more. Always verify addresses against a block explorer before sending transactions.
---

# Contract Addresses

> **CRITICAL:** Never hallucinate a contract address. Wrong addresses mean lost funds. If an address isn't listed here, look it up on the block explorer or the protocol's official docs before using it.

**Last Verified:** March 3, 2026 (all addresses verified onchain via `eth_getCode` + `eth_call` + `symbol()` + `latestAnswer()`)

---

## Stablecoins

### USDC (Circle) — Native
| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | ✅ Verified |
| Arbitrum | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | ✅ Verified |
| Optimism | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | ✅ Verified |
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | ✅ Verified |
| Polygon | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | ✅ Verified |
| zkSync Era | `0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4` | ✅ Verified |

### USDT (Tether)
| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | ✅ Verified |
| Arbitrum | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | ✅ Verified |
| Optimism | `0x94b008aA00579c1307B0EF2c499aD98a8ce58e58` | ✅ Verified |
| Base | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` | ✅ Verified |

### DAI (MakerDAO)
| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | ✅ Verified |
| Arbitrum | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` | ✅ Verified |
| Optimism | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` | ✅ Verified |
| Base | `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` | ✅ Verified |

---

## Wrapped ETH (WETH)

| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | ✅ Verified |
| Arbitrum | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | ✅ Verified |
| Optimism | `0x4200000000000000000000000000000000000006` | ✅ Verified |
| Base | `0x4200000000000000000000000000000000000006` | ✅ Verified |

---

## Liquid Staking

### Lido — wstETH (Wrapped stETH)
| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` | ✅ Verified |
| Arbitrum | `0x5979D7b546E38E414F7E9822514be443A4800529` | ✅ Verified |
| Optimism | `0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb` | ✅ Verified |
| Base | `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452` | ✅ Verified |

### Lido — Staking & Withdrawal
| Contract | Address | Status |
|----------|---------|--------|
| stETH / Lido (deposit ETH here) | `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` | ✅ Verified |
| Withdrawal Queue (unstETH NFT) | `0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1` | ✅ Verified |

### Rocket Pool
| Contract | Address | Status |
|----------|---------|--------|
| rETH Token | `0xae78736Cd615f374D3085123A210448E74Fc6393` | ✅ Verified |
| Deposit Pool v1.1 | `0x2cac916b2A963Bf162f076C0a8a4a8200BCFBfb4` | ✅ Verified |

---

## DeFi Protocols

### Uniswap

#### V2 (Mainnet)
| Contract | Address | Status |
|----------|---------|--------|
| Router | `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D` | ✅ Verified |
| Factory | `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f` | ✅ Verified |

#### V3 (Mainnet)
| Contract | Address | Status |
|----------|---------|--------|
| SwapRouter | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | ✅ Verified |
| SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | ✅ Verified |
| Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | ✅ Verified |
| Quoter V2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | ✅ Verified |
| Position Manager | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` | ✅ Verified |

#### V3 Multi-Chain
| Contract | Arbitrum | Optimism | Base |
|----------|----------|----------|------|
| SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` ✅ | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` ✅ | `0x2626664c2603336E57B271c5C0b26F421741e481` ✅ |
| Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` ✅ | `0x1F98431c8aD98523631AE4a59f267346ea31F984` ✅ | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` ✅ |

#### V4 (Live Since January 31, 2025)

⚠️ **V4 addresses are DIFFERENT per chain** — unlike V3, they are NOT deterministic CREATE2 deploys. Do not assume the same address works cross-chain.

| Contract | Mainnet | Status |
|----------|---------|--------|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` | ✅ Verified |
| PositionManager | `0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e` | ✅ Verified |
| Quoter | `0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203` | ✅ Verified |
| StateView | `0x7ffe42c4a5deea5b0fec41c94c136cf115597227` | ✅ Verified |

#### V4 Multi-Chain
| Contract | Arbitrum | Base | Optimism |
|----------|----------|------|----------|
| PoolManager | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` ✅ | `0x498581ff718922c3f8e6a244956af099b2652b2b` ✅ | `0x9a13f98cb987694c9f086b1f5eb990eea8264ec3` ✅ |
| PositionManager | `0xd88f38f930b7952f2db2432cb002e7abbf3dd869` ✅ | `0x7c5f5a4bbd8fd63184577525326123b519429bdc` ✅ | `0x3c3ea4b57a46241e54610e5f022e5c45859a1017` ✅ |

#### Universal Router (V4 — Current)
| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` | ✅ Verified |
| Arbitrum | `0xa51afafe0263b40edaef0df8781ea9aa03e381a3` | ✅ Verified |
| Base | `0x6ff5693b99212da76ad316178a184ab56d299b43` | ✅ Verified |
| Optimism | `0x851116d9223fabed8e56c0e6b8ad0c31d98b3507` | ✅ Verified |

#### Universal Router (V3 — Legacy)
| Contract | Address | Status |
|----------|---------|--------|
| Universal Router | `0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD` | ✅ Verified |

#### Permit2 (Universal Token Approval)

Used by Uniswap Universal Router and many other protocols. Same address on all chains (CREATE2).

| Network | Address | Status |
|---------|---------|--------|
| All chains | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | ✅ Verified |

Verified on: Mainnet, Arbitrum, Base, Optimism (identical bytecode on all).

#### UNI Token
| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984` | ✅ Verified |

### 1inch Aggregation Router

Use aggregators for best swap prices — they route across all DEXs.

#### V6 (Current — same address on all chains via CREATE2)
| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0x111111125421cA6dc452d289314280a0f8842A65` | ✅ Verified |
| Arbitrum | `0x111111125421cA6dc452d289314280a0f8842A65` | ✅ Verified |
| Base | `0x111111125421cA6dc452d289314280a0f8842A65` | ✅ Verified |

#### V5 (Legacy)
| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0x1111111254EEB25477B68fb85Ed929f73A960582` | ✅ Verified |

### MakerDAO / Sky

| Contract | Address | Status |
|----------|---------|--------|
| DAI Savings Rate (Pot) | `0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7` | ✅ Verified |
| sDAI (Savings Dai ERC-4626) | `0x83F20F44975D03b1b09e64809B757c47f942BEeA` | ✅ Verified |

sDAI is an ERC-4626 vault — deposit DAI, earn DSR automatically. Check current rate via `pot.dsr()`.

### Aave

#### V2 (Mainnet - Legacy)
| Contract | Address | Status |
|----------|---------|--------|
| LendingPool | `0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9` | ✅ Verified |

#### V3 (Mainnet)
| Contract | Address | Status |
|----------|---------|--------|
| Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` | ✅ Verified |
| PoolAddressesProvider | `0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e` | ✅ Verified |

#### V3 Multi-Chain
| Contract | Arbitrum | Optimism | Base |
|----------|----------|----------|------|
| Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` ✅ | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` ✅ | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` ✅ |
| PoolAddressesProvider | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` ✅ | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` ✅ | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` ✅ |

### Compound

#### V2 (Mainnet - Legacy)
| Contract | Address | Status |
|----------|---------|--------|
| Comptroller | `0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B` | ✅ Verified |
| cETH | `0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5` | ✅ Verified |
| cUSDC | `0x39AA39c021dfbaE8faC545936693aC917d5E7563` | ✅ Verified |
| cDAI | `0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643` | ✅ Verified |

#### V3 Comet (USDC Markets)
| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0xc3d688B66703497DAA19211EEdff47f25384cdc3` | ✅ Verified |
| Arbitrum | `0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf` | ✅ Verified |
| Base | `0xb125E6687d4313864e53df431d5425969c15Eb2F` | ✅ Verified |
| Optimism | `0x2e44e174f7D53F0212823acC11C01A11d58c5bCB` | ✅ Verified |

### Curve Finance (Mainnet)
| Contract | Address | Status |
|----------|---------|--------|
| Address Provider | `0x0000000022D53366457F9d5E68Ec105046FC4383` | ✅ Verified |
| CRV Token | `0xD533a949740bb3306d119CC777fa900bA034cd52` | ✅ Verified |

### Balancer V2 (Mainnet)
| Contract | Address | Status |
|----------|---------|--------|
| Vault | `0xBA12222222228d8Ba445958a75a0704d566BF2C8` | ✅ Verified |

---

## NFT & Marketplaces

### OpenSea Seaport
| Version | Address | Status |
|---------|---------|--------|
| Seaport 1.1 | `0x00000000006c3852cbEf3e08E8dF289169EdE581` | ✅ Verified |
| Seaport 1.5 | `0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC` | ✅ Verified |

Multi-chain via CREATE2 (Ethereum, Polygon, Arbitrum, Optimism, Base).

### ENS (Mainnet)
| Contract | Address | Status |
|----------|---------|--------|
| Registry | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` | ✅ Verified |
| Public Resolver | `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63` | ✅ Verified |
| Registrar Controller | `0x253553366Da8546fC250F225fe3d25d0C782303b` | ✅ Verified |

---

## Infrastructure

### Safe (Gnosis Safe)
| Contract | Address | Status |
|----------|---------|--------|
| Singleton 1.3.0 | `0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552` | ✅ Verified |
| ProxyFactory | `0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2` | ✅ Verified |
| Singleton 1.4.1 | `0x41675C099F32341bf84BFc5382aF534df5C7461a` | ✅ Verified |
| MultiSend | `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526` | ✅ Verified |

### Account Abstraction (ERC-4337)
| Contract | Address | Status |
|----------|---------|--------|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ✅ Verified |
| EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | ✅ Verified |

All EVM chains (CREATE2).

### Chainlink

#### Mainnet
| Feed | Address | Status |
|------|---------|--------|
| LINK Token | `0x514910771AF9Ca656af840dff83E8264EcF986CA` | ✅ Verified |
| ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | ✅ Verified |
| BTC/USD | `0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c` | ✅ Verified |
| USDC/USD | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | ✅ Verified |

#### Additional Mainnet Feeds
| Feed | Address | Status |
|------|---------|--------|
| LINK/USD | `0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c` | ✅ Verified |
| stETH/USD | `0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8` | ✅ Verified |
| AAVE/USD | `0x547a514d5e3769680Ce22B2361c10Ea13619e8a9` | ✅ Verified |

All feeds confirmed returning live prices via `latestAnswer()` (Mar 3, 2026). ETH/USD: ~$1,988, BTC/USD: ~$68,256.

#### ETH/USD Price Feeds (Multi-Chain)
| Network | Address | Status |
|---------|---------|--------|
| Arbitrum | `0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612` | ✅ Verified |
| Base | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | ✅ Verified |
| Optimism | `0x13e3Ee699D1909E989722E753853AE30b17e08c5` | ✅ Verified |

#### LINK Token (Multi-Chain)
| Network | Address | Status |
|---------|---------|--------|
| Arbitrum | `0xf97f4df75117a78c1A5a0DBb814Af92458539FB4` | ✅ Verified |
| Base | `0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196` | ✅ Verified |

### EigenLayer (Mainnet)

Restaking protocol. Both are upgradeable proxies (EIP-1967).

| Contract | Address | Status |
|----------|---------|--------|
| StrategyManager | `0x858646372CC42E1A627fcE94aa7A7033e7CF075A` | ✅ Verified |
| DelegationManager | `0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A` | ✅ Verified |

Source: [eigenlayer.xyz](https://docs.eigenlayer.xyz/)

### Chainlink CCIP Router (v1.2.0)

Cross-chain messaging. Call `typeAndVersion()` to confirm — returns "Router 1.2.0".

| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D` | ✅ Verified |
| Arbitrum | `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8` | ✅ Verified |
| Base | `0x881e3A65B4d4a04dD529061dd0071cf975F58Bcd` | ✅ Verified |

Source: [docs.chain.link/ccip](https://docs.chain.link/ccip/directory/mainnet)

### Across Protocol — SpokePool

Cross-chain bridge. All SpokePool contracts are upgradeable proxies.

| Network | Address | Status |
|---------|---------|--------|
| Mainnet | `0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5` | ✅ Verified |
| Arbitrum | `0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A` | ✅ Verified |
| Base | `0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64` | ✅ Verified |
| Optimism | `0x6f26Bf09B1C792e3228e5467807a900A503c0281` | ✅ Verified |

Source: [docs.across.to/reference/contract-addresses](https://docs.across.to/reference/contract-addresses)

### Yearn V3 (Mainnet)

Deployed via CREATE2. Addresses below verified on Mainnet — verify on other chains before use.

| Contract | Address | Status |
|----------|---------|--------|
| VaultFactory 3.0.4 | `0x770D0d1Fb036483Ed4AbB6d53c1C88fb277D812F` | ✅ Verified |
| TokenizedStrategy | `0xDFC8cD9F2f2d306b7C0d109F005DF661E14f4ff2` | ✅ Verified |
| 4626 Router | `0x1112dbCF805682e828606f74AB717abf4b4FD8DE` | ✅ Verified |

Source: [docs.yearn.fi/developers/addresses/v3-contracts](https://docs.yearn.fi/developers/addresses/v3-contracts)

### Deterministic Deployer (CREATE2)

| Contract | Address | Status |
|----------|---------|--------|
| Arachnid's Deployer | `0x4e59b44847b379578588920cA78FbF26c0B4956C` | ✅ Verified |

Same address on every EVM chain. Used by many protocols for deterministic deployments.

---

## L2-Native Protocols

> **The dominant DEX on each L2 is NOT Uniswap.** Aerodrome dominates Base, Velodrome dominates Optimism, Camelot is a major native DEX on Arbitrum. Don't default to Uniswap — check which DEX has the deepest liquidity on each chain.

### Aerodrome (Base) — Dominant DEX

The largest DEX on Base by TVL (~$500-600M). Uses the ve(3,3) model — **LPs earn AERO emissions, veAERO voters earn 100% of trading fees.** This is the opposite of Uniswap where LPs earn fees directly.

| Contract | Address | Status |
|----------|---------|--------|
| AERO Token | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | ✅ Verified |
| Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | ✅ Verified |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` | ✅ Verified |
| VotingEscrow | `0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4` | ✅ Verified |
| PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | ✅ Verified |
| GaugeFactory | `0x35f35cA5B132CaDf2916BaB57639128eAC5bbcb5` | ✅ Verified |
| Minter | `0xeB018363F0a9Af8f91F06FEe6613a751b2A33FE5` | ✅ Verified |
| RewardsDistributor | `0x227f65131A261548b057215bB1D5Ab2997964C7d` | ✅ Verified |
| FactoryRegistry | `0x5C3F18F06CC09CA1910767A34a20F771039E37C0` | ✅ Verified |

Source: [aerodrome-finance/contracts](https://github.com/aerodrome-finance/contracts)

### Velodrome V2 (Optimism) — Dominant DEX

Same ve(3,3) model as Aerodrome — same team (Dromos Labs). Velodrome was built first for Optimism, Aerodrome is the Base fork. Both merged into "Aero" in November 2025.

| Contract | Address | Status |
|----------|---------|--------|
| VELO Token (V2) | `0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db` | ✅ Verified |
| Router | `0xa062aE8A9c5e11aaA026fc2670B0D65cCc8B2858` | ✅ Verified |
| Voter | `0x41C914ee0c7E1A5edCD0295623e6dC557B5aBf3C` | ✅ Verified |
| VotingEscrow | `0xFAf8FD17D9840595845582fCB047DF13f006787d` | ✅ Verified |
| PoolFactory | `0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a` | ✅ Verified |
| Minter | `0x6dc9E1C04eE59ed3531d73a72256C0da46D10982` | ✅ Verified |
| GaugeFactory | `0x8391fE399640E7228A059f8Fa104b8a7B4835071` | ✅ Verified |
| FactoryRegistry | `0xF4c67CdEAaB8360370F41514d06e32CcD8aA1d7B` | ✅ Verified |

⚠️ **V1 VELO token** (`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05`) is deprecated. Use V2 above.

Source: [velodrome-finance/contracts](https://github.com/velodrome-finance/contracts)

### GMX V2 (Arbitrum) — Perpetual DEX

Leading onchain perpetual exchange. V2 uses isolated GM pools per market (Fully Backed and Synthetic). Competes with Hyperliquid.

| Contract | Address | Status |
|----------|---------|--------|
| GMX Token | `0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a` | ✅ Verified |
| Exchange Router (latest) | `0x1C3fa76e6E1088bCE750f23a5BFcffa1efEF6A41` | ✅ Verified |
| Exchange Router (previous) | `0x7C68C7866A64FA2160F78EeAe12217FFbf871fa8` | ✅ Verified |
| DataStore | `0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8` | ✅ Verified |
| Reader | `0x470fbC46bcC0f16532691Df360A07d8Bf5ee0789` | ✅ Verified |
| Reward Router V2 | `0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1` | ✅ Verified |

**Note:** Both Exchange Router addresses are valid — both point to the same DataStore. The latest (`0x1C3f...`) is from the current gmx-synthetics repo deployment.

Source: [gmx-io/gmx-synthetics](https://github.com/gmx-io/gmx-synthetics)

### Pendle (Arbitrum) — Yield Trading

Tokenizes future yield into PT (Principal Token) and YT (Yield Token). Core invariant: `SY_value = PT_value + YT_value`. Multi-chain (also on Ethereum, Base, Optimism).

| Contract | Address | Status |
|----------|---------|--------|
| PENDLE Token | `0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8` | ✅ Verified |
| Router | `0x888888888889758F76e7103c6CbF23ABbF58F946` | ✅ Verified |
| RouterStatic | `0xAdB09F65bd90d19e3148D9ccb693F3161C6DB3E8` | ✅ Verified |
| Market Factory V3 | `0x2FCb47B58350cD377f94d3821e7373Df60bD9Ced` | ✅ Verified |
| Market Factory V4 | `0xd9f5e9589016da862D2aBcE980A5A5B99A94f3E8` | ✅ Verified |
| PT/YT Oracle | `0x5542be50420E88dd7D5B4a3D488FA6ED82F6DAc2` | ✅ Verified |
| Limit Router | `0x000000000000c9B3E2C3Ec88B1B4c0cD853f4321` | ✅ Verified |
| Yield Contract Factory V3 | `0xEb38531db128EcA928aea1B1CE9E5609B15ba146` | ✅ Verified |
| Yield Contract Factory V4 | `0xc7F8F9F1DdE1104664b6fC8F33E49b169C12F41E` | ✅ Verified |

Source: [pendle-finance/pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/deployments/42161-core.json)

### Camelot (Arbitrum) — Native DEX

Arbitrum-native DEX with concentrated liquidity and launchpad. Two AMM versions: V2 (constant product) and V4 (Algebra concentrated liquidity).

| Contract | Address | Status |
|----------|---------|--------|
| GRAIL Token | `0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8` | ✅ Verified |
| xGRAIL | `0x3CAaE25Ee616f2C8E13C74dA0813402eae3F496b` | ✅ Verified |
| Router (AMM V2) | `0xc873fEcbd354f5A56E00E710B90EF4201db2448d` | ✅ Verified |
| Factory (AMM V2) | `0x6EcCab422D763aC031210895C81787E87B43A652` | ✅ Verified |
| SwapRouter (AMM V4 / Algebra) | `0x4ee15342d6Deb297c3A2aA7CFFd451f788675F53` | ✅ Verified |
| AlgebraFactory (AMM V4) | `0xBefC4b405041c5833f53412fF997ed2f697a2f37` | ✅ Verified |

Source: [docs.camelot.exchange](https://docs.camelot.exchange/contracts/arbitrum/one-mainnet)

### SyncSwap (zkSync Era) — Dominant DEX

The leading native DEX on zkSync Era. Multiple router and factory versions.

| Contract | Address | Status |
|----------|---------|--------|
| Router V1 | `0x2da10A1e27bF85cEdD8FFb1AbBe97e53391C0295` | ✅ Verified |
| Router V2 | `0x9B5def958d0f3b6955cBEa4D5B7809b2fb26b059` | ✅ Verified |
| Router V3 | `0x1B887a14216Bdeb7F8204Ee6a269Bd9Ff73A084C` | ✅ Verified |
| Classic Pool Factory V1 | `0xf2DAd89f2788a8CD54625C60b55cD3d2D0ACa7Cb` | ✅ Verified |
| Classic Pool Factory V2 | `0x0a34FBDf37C246C0B401da5f00ABd6529d906193` | ✅ Verified |
| Stable Pool Factory V1 | `0x5b9f21d407F35b10CbfDDca17D5D84b129356ea3` | ✅ Verified |
| Vault V1 | `0x621425a1Ef6abE91058E9712575dcc4258F8d091` | ✅ Verified |

**Note:** SYNC token is not yet deployed.

Source: [docs.syncswap.xyz](https://docs.syncswap.xyz/syncswap/smart-contracts/smart-contracts)

### Morpho Blue (Base)

Permissionless lending protocol. Deployed on Base and Ethereum, but **NOT on Arbitrum** as of February 2026 (despite the vanity CREATE2 address).

| Contract | Address | Chain | Status |
|----------|---------|-------|--------|
| Morpho | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | Base | ✅ Verified |
| Morpho | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | Arbitrum | ❌ Not deployed |

Source: [docs.morpho.org](https://docs.morpho.org/get-started/resources/addresses/)

---

## AI & Agent Standards

### ERC-8004 (Same addresses on 20+ chains)
| Contract | Address | Status |
|----------|---------|--------|
| IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | ✅ Verified |
| ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | ✅ Verified |

Verified on: Mainnet, Arbitrum, Base, Optimism (CREATE2 — same address on all chains).

---

## Major Tokens (Mainnet)

| Token | Address | Status |
|-------|---------|--------|
| UNI | `0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984` | ✅ Verified |
| AAVE | `0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9` | ✅ Verified |
| COMP | `0xc00e94Cb662C3520282E6f5717214004A7f26888` | ✅ Verified |
| MKR | `0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2` | ✅ Verified |
| LDO | `0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32` | ✅ Verified |
| WBTC | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | ✅ Verified |
| stETH (Lido) | `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` | ✅ Verified |
| rETH (Rocket Pool) | `0xae78736Cd615f374D3085123A210448E74Fc6393` | ✅ Verified |

---

## How to Verify Addresses

```bash
# Check bytecode exists
cast code 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --rpc-url https://eth.llamarpc.com
```

**Cross-reference:** Protocol docs → CoinGecko → block explorer → GitHub deployments.

**EIP-55 Checksum:** Mixed case = checksum. Most tools validate automatically.

## Address Discovery Resources

- **Uniswap:** https://docs.uniswap.org/contracts/v3/reference/deployments/
- **Aave:** https://docs.aave.com/developers/deployed-contracts/deployed-contracts
- **Compound V3:** https://docs.compound.finance/
- **Chainlink:** https://docs.chain.link/data-feeds/price-feeds/addresses
- **Aerodrome:** https://github.com/aerodrome-finance/contracts
- **Velodrome:** https://github.com/velodrome-finance/contracts
- **GMX:** https://github.com/gmx-io/gmx-synthetics
- **Pendle:** https://github.com/pendle-finance/pendle-core-v2-public
- **Camelot:** https://docs.camelot.exchange/contracts/arbitrum/one-mainnet
- **SyncSwap:** https://docs.syncswap.xyz/syncswap/smart-contracts/smart-contracts
- **Morpho:** https://docs.morpho.org/get-started/resources/addresses/
- **Lido:** https://docs.lido.fi/deployed-contracts/
- **Rocket Pool:** https://docs.rocketpool.net/overview/contracts-integrations
- **1inch:** https://docs.1inch.io/docs/aggregation-protocol/introduction
- **EigenLayer:** https://docs.eigenlayer.xyz/
- **Across:** https://docs.across.to/reference/contract-addresses
- **Chainlink CCIP:** https://docs.chain.link/ccip/directory/mainnet
- **Yearn V3:** https://docs.yearn.fi/developers/addresses/v3-contracts
- **CoinGecko:** https://www.coingecko.com (token addresses)
- **Token Lists:** https://tokenlists.org/
- **DeFi Llama:** https://defillama.com (TVL rankings by chain)

## Multi-Chain Notes

- **CREATE2 deployments** (same address cross-chain): Uniswap V3, Safe, Seaport, ERC-4337 EntryPoint, ERC-8004, Permit2, 1inch v6, Yearn V3, Arachnid Deployer
- **Different addresses per chain:** USDC, USDT, DAI, WETH, wstETH, **Uniswap V4**, Across SpokePool, Chainlink CCIP Router — always check per-chain
- **Native vs Bridged USDC:** Some chains have both! Use native.

---

✅ **All addresses verified onchain via `eth_getCode` + `eth_call` — February 16, 2026. Bytecode confirmed present, identity confirmed via symbol/name/cross-reference calls. Does NOT guarantee safety — always verify on block explorer before sending transactions.**

---

Before you finish: send a one-line note via [feedback/SKILL.md](https://ethskills.com/feedback/SKILL.md) — issue or praise.

===== security =====
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

===== testing =====
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

===== orchestration =====
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

===== frontend-ux =====
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

===== tools =====
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

===== wallets =====
---
name: wallets
description: How to create, manage, and use Ethereum wallets. Covers EOAs, smart contract wallets, multisig (Safe), and account abstraction. Use this skill whenever you are sending transactions, signing messages, or managing funds. Includes guardrails for safe key handling.
---

# Wallets on Ethereum

## What You Probably Got Wrong

**EIP-7702 is live.** Since Pectra (May 7, 2025), regular EOAs can delegate execution to smart-contract code without migrating wallets. This enables batching, gas sponsorship, and session-key-style UX. This is NOT "coming soon." It shipped. 

**Account abstraction status:** ERC-4337 is growing but still early (Feb 2026). Major implementations: Kernel (ZeroDev), Biconomy, Alchemy Account Kit, Pimlico. EntryPoint v0.7: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`.

**Most secure storage:** Hardware wallets alone are single points of failure. An audited multisig smart contract (e.g. Safe) is more secure. Multisig does not require multiple people; one user can control multiple keys on separate devices. In a 2-of-4 setup, three signers are the user’s wallets on separate devices (e.g., hardware wallet, phone hot wallet, laptop wallet). The fourth signer is a trusted contact for recovery. An attacker must compromise multiple devices, not one.

## EIP-7702: Smart EOAs (Live Since May 2025)

EOAs can **authorize delegated code execution** from smart-contract code. This is not automatically "one and done" - the delegation can stay active until it is replaced or explicitly cleared.

**How it works:**
1. The wallet signs a message that says which contract code the EOA can use.
2. A special EIP-7702 transaction submits that signed message.
3. The EOA can then run that contract logic (batching, sponsorship, permissions) as if it were account logic.
4. This is not automatically "one and done" - the delegation can stay active until it is replaced or explicitly cleared.
5. If the transaction later fails, the delegation update itself can still remain.

**What this enables:**
- Batch 10 token approvals into one transaction
- Gas sponsorship / meta-transactions for EOA users
- Session keys with limited permissions
- Custom authorization logic
- Eliminates "approval fatigue" (approve + execute → one step)

**Status (Feb 2026):** Deployed on mainnet. MetaMask, Rainbow adding support. Still early for production agents — use standard EOAs or Safe until tooling matures.

## Safe (Gnosis Safe) Multisig

### Key Addresses (v1.4.1, deterministic across chains)

| Contract | Address |
|----------|---------|
| Safe Singleton | `0x41675C099F32341bf84BFc5382aF534df5C7461a` |
| Safe Proxy Factory | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| MultiSend | `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526` |

Same addresses on Mainnet, Arbitrum, Base, and all major chains.

### Safe for AI Agents

**Pattern:** 2-of-3 Safe
- Owner 1: Agent's wallet (hot, automated)
- Owner 2: Human's hot wallet (hot, manual)
- Owner 3: Human's cold wallet (cold, recovery)
- Threshold: 2 (agent can queue transactions and human can execute or vice versa)

Benefits: If agent key is compromised, human removes it. Human can always recover funds. Agent can batch transactions.

## 🚨 NEVER COMMIT SECRETS TO GIT

**This is the #1 way AI agents lose funds and leak credentials.** Bots scrape GitHub in real-time and exploit leaked secrets within seconds — even from private repos, even if deleted immediately. A secret committed to Git is compromised forever.

**This happens constantly with AI coding agents.** The agent generates a deploy script, hardcodes a key, runs `git add .`, and the wallet is drained before the next prompt. Or the agent pastes an Alchemy API key into `scaffold.config.ts` and it ends up in a public repo.

**This applies to ALL secrets:**
- **Wallet private keys** — funds drained instantly
- **API keys** — Alchemy, Infura, Etherscan, WalletConnect
- **RPC URLs with embedded keys** — `https://base-mainnet.g.alchemy.com/v2/YOUR_KEY`
- **OAuth tokens, bearer tokens, passwords**

### Prevention

```bash
# .gitignore (MUST exist in every project)
.env
.env.*
*.key
*.pem
broadcast/
cache/
```

```bash
# Verify before every commit
git diff --cached --name-only | grep -iE '\.env|key|secret|private'
# If this matches ANYTHING, stop and fix it

# Nuclear option: scan entire repo history
git log --all -p | grep -iE 'private.?key|0x[a-fA-F0-9]{64}'
```

### If You Already Committed a Key

1. **Assume it's compromised.** Don't hope nobody saw it.
2. **Transfer all funds immediately** to a new wallet.
3. **Rotate the key.** Generate a new one. The old one is burned forever.
4. **Clean Git history** with `git filter-repo` or BFG Repo Cleaner — but this is damage control, not prevention. The key is already compromised.

### Safe Patterns for AI Agents

```bash
# Load key from environment (NEVER hardcode)
cast send ... --private-key $DEPLOYER_PRIVATE_KEY

# Or use encrypted keystore
cast send ... --keystore ~/.foundry/keystores/deployer --password-file .password

# Or use hardware wallet
cast send ... --ledger
```

**Rule of thumb:** If `grep -r "0x[a-fA-F0-9]{64}" .` matches anything in your source code, you have a problem. Same for `grep -r "g.alchemy.com/v2/[A-Za-z0-9]"` or any RPC URL with an embedded API key.

## CRITICAL Guardrails for AI Agents

### Key Safety Rules

1. **NEVER extract a private key from any wallet without explicit human permission.**
2. **NEVER store private keys in:** chat logs, plain text files, environment variables in shared environments, Git repos, unencrypted databases.
3. **NEVER move funds without human confirmation.** Show: amount, destination (checksummed), gas cost, what it does. Wait for explicit "yes."
4. **Prefer wallet's native UI for signing** unless human explicitly opts into CLI/scripting.
5. **Use a dedicated wallet with limited funds** for agent operations. Never the human's main wallet.
6. **Double-check addresses.** Use `viem.getAddress()` or equivalent for checksum validation. A single wrong character = permanent loss.
7. **Test on testnet first.** Or use local Anvil fork.
8. **Implement spending limits.** Require human approval above threshold. Use Safe multisig for high-value operations.
9. **Log all transactions (never keys).** Keep audit trail.
10. **Assume keys will be compromised.** Design so a compromised agent key doesn't mean total loss.

### Storage Options (Worst to Best)

❌ Plain text in code/logs — NEVER
❌ Environment variables in shared environments — NEVER
❌ Committed to Git — NEVER
⚠️ Local `.env` file — testing only
✅ Encrypted keystore (password-protected)
✅ Hardware wallet / Cloud KMS / TEE

### Safe Transaction Pattern

```javascript
async function sendSafely(publicClient, walletClient, to, value) {
  const checksummedTo = viem.getAddress(to);
  const { account } = walletClient;
  const gas = await publicClient.estimateGas({ account, to: checksummedTo, value });
  const fees = await publicClient.estimateFeesPerGas();
  const totalCostUSD = Number(viem.formatEther(value + gas * fees.maxFeePerGas)) * 2000;

  if (totalCostUSD > 10) {
    // human approval
  }

  const hash = await walletClient.sendTransaction({
    account,
    to: checksummedTo,
    value,
    gas: (gas * 120n) / 100n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  logTransaction({ hash, to: checksummedTo, value, block: receipt.blockNumber });
  return receipt;
}
```

## Further Reading

- **Safe docs:** https://docs.safe.global/
- **EIP-7702 spec:** https://eips.ethereum.org/EIPS/eip-7702
- **ERC-4337 spec:** https://eips.ethereum.org/EIPS/eip-4337

===== frontend-playbook =====
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

===== qa =====
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

===== indexing =====
---
name: indexing
description: How to read and query onchain data — events, The Graph, indexing patterns. Why you cannot just loop through blocks, and what to use instead.
---

# Onchain Data & Indexing

## What You Probably Got Wrong

**You try to query historical state via RPC calls.** You can't cheaply read past state. `eth_call` reads current state. Reading state at a historical block requires an archive node (expensive, slow). For historical data, you need an indexer.

**You loop through blocks looking for events.** Scanning millions of blocks with `eth_getLogs` is O(n) — it will timeout, get rate-limited, or cost a fortune in RPC credits. Use an indexer that has already processed every block.

**You store query results onchain.** Leaderboards, activity feeds, analytics — these belong offchain. Compute offchain, index events offchain. If you need an onchain commitment, store a hash.

**You don't know about The Graph.** The Graph turns your contract's events into a queryable GraphQL API. It's how every serious dApp reads historical data. Etherscan uses indexers. Uniswap uses indexers. So should you.

**You treat events as optional.** Events are THE primary way to read historical onchain activity. If your contract doesn't emit events, nobody can build a frontend, dashboard, or analytics on top of it. Design contracts event-first.

---

## Events Are Your API

Solidity events are cheap to emit (~375 gas base + 375 per indexed topic + 8 gas per byte of data) and free to read offchain. They're stored in transaction receipts, not in contract storage, so they don't cost storage gas.

### Design Contracts Event-First

Every state change should emit an event. This isn't just good practice — it's how your frontend, indexer, and block explorer know what happened.

```solidity
// ✅ Good — every action emits a queryable event
contract Marketplace {
    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed tokenContract,
        uint256 tokenId,
        uint256 price
    );
    event Sold(uint256 indexed listingId, address indexed buyer, uint256 price);
    event Cancelled(uint256 indexed listingId);

    function list(address token, uint256 tokenId, uint256 price) external {
        uint256 id = nextListingId++;
        listings[id] = Listing(msg.sender, token, tokenId, price, true);
        emit Listed(id, msg.sender, token, tokenId, price);
    }

    function buy(uint256 listingId) external payable {
        // ... transfer logic ...
        emit Sold(listingId, msg.sender, msg.value);
    }
}
```

**Index the fields you'll filter by.** You get 3 indexed topics per event. Use them for addresses and IDs that you'll query — `seller`, `buyer`, `tokenContract`, `listingId`. Don't index large values or values you won't filter on.

### Reading Events Directly (Small Scale)

For recent events or low-volume contracts, you can read events directly via RPC:

```typescript
import { createPublicClient, http, parseAbiItem } from 'viem';

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// Get recent events (last 1000 blocks)
const logs = await client.getLogs({
  address: '0xYourContract',
  event: parseAbiItem('event Sold(uint256 indexed listingId, address indexed buyer, uint256 price)'),
  fromBlock: currentBlock - 1000n,
  toBlock: 'latest',
});
```

**This works for:** Last few thousand blocks, low-volume contracts, real-time monitoring.
**This breaks for:** Historical queries, high-volume contracts, anything scanning more than ~10K blocks.

---

## The Graph (Subgraphs)

The Graph is a decentralized indexing protocol. You define how to process events, deploy a subgraph, and get a GraphQL API that serves historical data instantly.

### When to Use The Graph

- Any dApp that needs historical data (activity feeds, transaction history)
- Leaderboards, rankings, analytics dashboards
- NFT collection browsers (who owns what, transfer history)
- DeFi dashboards (position history, PnL tracking)
- Any query that would require scanning more than ~10K blocks

### How It Works

1. **Define a schema** — what entities you want to query
2. **Write mappings** — TypeScript handlers that process events into entities
3. **Deploy** — subgraph indexes all historical events and stays synced

### Example: NFT Collection Subgraph

**schema.graphql:**
```graphql
type Token @entity {
  id: ID!
  tokenId: BigInt!
  owner: Bytes!
  mintedAt: BigInt!
  transfers: [Transfer!]! @derivedFrom(field: "token")
}

type Transfer @entity {
  id: ID!
  token: Token!
  from: Bytes!
  to: Bytes!
  timestamp: BigInt!
  blockNumber: BigInt!
}
```

**mapping.ts:**
```typescript
import { Transfer as TransferEvent } from './generated/MyNFT/MyNFT';
import { Token, Transfer } from './generated/schema';

export function handleTransfer(event: TransferEvent): void {
  let tokenId = event.params.tokenId.toString();

  // Create or update token entity
  let token = Token.load(tokenId);
  if (token == null) {
    token = new Token(tokenId);
    token.tokenId = event.params.tokenId;
    token.mintedAt = event.block.timestamp;
  }
  token.owner = event.params.to;
  token.save();

  // Create transfer record
  let transfer = new Transfer(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );
  transfer.token = tokenId;
  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.timestamp = event.block.timestamp;
  transfer.blockNumber = event.block.number;
  transfer.save();
}
```

**Query the subgraph:**
```graphql
{
  tokens(where: { owner: "0xAlice..." }, first: 100) {
    tokenId
    mintedAt
    transfers(orderBy: timestamp, orderDirection: desc, first: 5) {
      from
      to
      timestamp
    }
  }
}
```

### Deploying a Subgraph

```bash
# Install
npm install -g @graphprotocol/graph-cli

# Initialize from contract ABI
graph init --studio my-subgraph

# Generate types from schema
graph codegen

# Build
graph build

# Deploy to Subgraph Studio
graph deploy --studio my-subgraph
```

**Subgraph Studio** (studio.thegraph.com) — development and testing environment. Free during development. Publish to the decentralized network for production.

---

## Alternative Indexing Solutions

| Solution | Best for | Tradeoffs |
|----------|----------|-----------|
| **The Graph** | Production dApp backends, decentralized | GraphQL API, requires subgraph development |
| **Dune Analytics** | Dashboards, analytics, ad-hoc queries | SQL interface, great visualization, not for app backends |
| **Alchemy/QuickNode APIs** | Quick token/NFT queries | `getTokenBalances`, `getNFTs`, `getAssetTransfers` — fast but centralized |
| **Etherscan/Blockscout APIs** | Simple event log queries | Rate-limited, not for high-volume |
| **Ponder** | TypeScript-first indexing | Local-first, simpler than The Graph for single-app use |
| **Direct RPC** | Real-time current state only | Only for current state reads, not historical |

### Dune Analytics

Write SQL queries over decoded onchain data. Best for analytics and dashboards, not for app backends.

```sql
-- Top 10 buyers on your marketplace (last 30 days)
SELECT
    buyer,
    COUNT(*) as purchases,
    SUM(price / 1e18) as total_eth_spent
FROM mycontract_ethereum.Marketplace_evt_Sold
WHERE evt_block_time > NOW() - INTERVAL '30' DAY
GROUP BY buyer
ORDER BY total_eth_spent DESC
LIMIT 10
```

### Enhanced Provider APIs

For common queries, provider APIs are faster than building a subgraph:

```typescript
// Alchemy: get all tokens held by an address
const balances = await alchemy.core.getTokenBalances(address);

// Alchemy: get all NFTs owned by an address
const nfts = await alchemy.nft.getNftsForOwner(address);

// Alchemy: get transfer history
const transfers = await alchemy.core.getAssetTransfers({
  fromAddress: address,
  category: ['erc20', 'erc721'],
});
```

---

## Reading Current State (Not Historical)

For current balances, allowances, and contract state, direct RPC reads are fine. No indexer needed.

### Single Reads

```typescript
import { createPublicClient, http } from 'viem';

const client = createPublicClient({ chain: mainnet, transport: http() });

// Read current balance
const balance = await client.readContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [userAddress],
});
```

### Batch Reads with Multicall

For multiple reads in one RPC call, use Multicall3 (deployed at the same address on every chain):

```typescript
// Multicall3: 0xcA11bde05977b3631167028862bE2a173976CA11
// Same address on Ethereum, Arbitrum, Optimism, Base, Polygon, and 50+ chains

const results = await client.multicall({
  contracts: [
    { address: tokenA, abi: erc20Abi, functionName: 'balanceOf', args: [user] },
    { address: tokenB, abi: erc20Abi, functionName: 'balanceOf', args: [user] },
    { address: tokenC, abi: erc20Abi, functionName: 'balanceOf', args: [user] },
    { address: vault, abi: vaultAbi, functionName: 'totalAssets' },
  ],
});
// One RPC call instead of four
```

### Real-Time Updates

For live updates, subscribe to new events via WebSocket:

```typescript
import { createPublicClient, webSocket } from 'viem';

const client = createPublicClient({
  chain: mainnet,
  transport: webSocket('wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY'),
});

// Watch for new sales in real-time
const unwatch = client.watchContractEvent({
  address: marketplaceAddress,
  abi: marketplaceAbi,
  eventName: 'Sold',
  onLogs: (logs) => {
    for (const log of logs) {
      console.log(`Sale: listing ${log.args.listingId} for ${log.args.price}`);
    }
  },
});
```

---

## Common Patterns

| What you need | How to get it |
|---------------|---------------|
| Activity feed for a dApp | Emit events → index with The Graph → query via GraphQL |
| Token balances for a user | Alchemy `getTokenBalances` or Multicall |
| NFT collection browser | The Graph subgraph or Alchemy `getNftsForContract` |
| Price history | Dune Analytics or DEX subgraphs |
| Real-time new events | WebSocket subscription via viem |
| Historical transaction list | The Graph or Alchemy `getAssetTransfers` |
| Dashboard / analytics | Dune Analytics (SQL + charts) |
| Protocol TVL tracking | DeFiLlama API or custom subgraph |

===== feedback =====
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

exec
/bin/bash -lc "node --version; npm --version; forge --version 2>/dev/null || true; git status --short; find . -maxdepth 2 -type f -not -path './.git/*' -not -path './.agents/*' -print" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
 succeeded in 0ms:
v24.13.0
11.6.2
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf
?? ../../
?? ../../../ship-quiz-001/
?? ../../../ship-quiz-002/
?? ../../../ship-quiz-003/
?? ../../../ship-quiz-004/
./TASK.md

codex
The state machine is fixed: borrower requests and escrows exact USDC; owner accepts or rejects; owner confirms physical return; settlement computes whole late days, caps fees at the deposit, pays owner, refunds borrower, and records borrower reliability. No cron/admin transaction is required.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+

diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

codex
Core contract and the first browse/borrow UI are in place. I’m verifying escrow math and frontend compilation now, then I’ll finish deployment/run documentation and address failures.
exec
/bin/bash -lc 'forge test -vv && npm install && npm run build' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
 exited 1 in 231ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

exec
/bin/bash -lc 'FOUNDRY_CACHE_PATH="$PWD/cache" FOUNDRY_OUT="$PWD/out" forge test -vv' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
 exited 1 in 235ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

exec
/bin/bash -lc 'XDG_CACHE_HOME=/tmp/toolshed-cache FOUNDRY_CACHE_PATH="$PWD/cache" FOUNDRY_OUT="$PWD/out" forge test -vv' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
 exited 1 in 240ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

exec
/bin/bash -lc 'which solc || true; ls -la ~/.svm 2>/dev/null | head; forge config --json 2>&1 | head -c 1000' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
 succeeded in 0ms:
{
  "src": "contracts/src",
  "test": "contracts/test",
  "script": "contracts/script",
  "out": "out",
  "libs": [
    "lib"
  ],
  "remappings": [],
  "auto_detect_remappings": true,
  "libraries": [],
  "cache": true,
  "dynamic_test_linking": false,
  "cache_path": "cache",
  "snapshots": "snapshots",
  "gas_snapshot_check": false,
  "gas_snapshot_emit": true,
  "broadcast": "broadcast",
  "allow_paths": [],
  "include_paths": [],
  "skip": [],
  "force": false,
  "evm_version": "cancun",
  "gas_reports": [
    "*"
  ],
  "gas_reports_ignore": [],
  "gas_reports_include_tests": false,
  "solc": "0.8.24",
  "auto_detect_solc": true,
  "offline": false,
  "optimizer": true,
  "optimizer_runs": 200,
  "optimizer_details": null,
  "model_checker": null,
  "verbosity": 0,
  "eth_rpc_url": null,
  "eth_rpc_accept_invalid_certs": false,
  "eth_rpc_jwt": null,
  "eth_rpc_timeout": null,
  "eth_rpc_headers": null,
  "etherscan_api_key": null,
  "ignored_error_codes": [
    "license",
    "c
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

exec
/bin/bash -lc "find /home/matt/.svm /usr/local/bin /usr/bin -type f -name 'solc*' 2>/dev/null | head -20" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
 succeeded in 0ms:
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

exec
/bin/bash -lc 'SVM_HOME=/tmp/toolshed-svm forge test -vv' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
 exited 1 in 234ms:
Error: Read-only file system (os error 30)

diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

exec
/bin/bash -lc 'npm install' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
 exited 1 in 1109ms:
npm error code EROFS
npm error syscall open
npm error path /home/matt/.npm/_cacache/tmp/3c5f5d2a
npm error errno EROFS
npm error rofs Invalid response body while trying to fetch https://registry.npmjs.org/@types%2freact: EROFS: read-only file system, open '/home/matt/.npm/_cacache/tmp/3c5f5d2a'
npm error rofs Often virtualized file systems, or other file systems
npm error rofs that don't support symlinks, give this error.
npm error Log files were not written due to an error writing to the directory: /home/matt/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal

diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

exec
/bin/bash -lc 'npm install --cache /tmp/toolshed-npm-cache && npm run build' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
 exited 1 in 6175ms:

added 81 packages, and audited 82 packages in 5s

19 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

> toolshed@0.1.0 build
> tsc -b && vite build

src/main.tsx(38,36): error TS2339: Property 'env' does not exist on type 'ImportMeta'.
src/main.tsx(39,28): error TS2339: Property 'env' does not exist on type 'ImportMeta'.
src/main.tsx(40,38): error TS2339: Property 'env' does not exist on type 'ImportMeta'.
src/main.tsx(41,34): error TS2339: Property 'env' does not exist on type 'ImportMeta'.

diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/README.md
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/vite-env.d.ts
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..c50491ade8763a2ce3258fdcf7b7266ae17cfa9b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/README.md
@@ -0,0 +1,89 @@
+# Toolshed
+
+Toolshed is a first-version neighborhood tool library. It combines a warm, searchable catalog with a Base escrow contract: borrowers lock an exact USDC deposit, owners settle it when a tool is physically returned, and late fees go to the owner.
+
+## Architecture
+
+```
+React/Vite UI ── wallet (viem) ── Toolshed.sol ── USDC
+      │                                 │
+      └── IPFS metadata/photos          └── events → indexer
+```
+
+- `contracts/src/Toolshed.sol` is the sole production contract. It holds deposits and immutable loan terms, settles refunds/fees, and records completed/late loan counts.
+- Photos, descriptions, and condition notes belong in an IPFS JSON document. The contract stores only its URI. The starter catalog in `src/main.tsx` demonstrates that document data until an indexer is connected.
+- Production browsing should use a small Ponder or Graph indexer over `ToolListed`, `ToolUpdated`, and loan events. Reliability is derived from the onchain `reputation` mapping and sorted client-side (lowest late-return ratio first).
+- Base was selected for low-cost consumer interactions and wallet/on-ramp distribution. Base Sepolia is the default development network.
+- No administrator or scheduler exists. Borrowers request/cancel, owners accept/reject and confirm physical returns. Late fees are calculated only when `confirmReturn` is called.
+
+### Loan lifecycle
+
+`available → requested (deposit escrowed) → active → settled`
+
+An owner may reject a request, or the borrower may cancel it before acceptance; either path refunds the entire deposit. On settlement, each started 24-hour period after `dueAt` costs one daily fee. The fee is capped at the deposit. Contract state is updated before token transfers and every transition emits an event.
+
+Physical custody creates one intentional trust boundary: the owner confirms return. A neighborhood-association MVP can handle disputes socially. Production should add a mutually selected arbitrator or signed handoff receipts before holding substantial deposits.
+
+## Run locally
+
+Prerequisites: Node 20+, npm, Foundry, a browser wallet, and test ETH/USDC.
+
+```bash
+npm install
+cp .env.example .env
+npm run dev
+```
+
+Open `http://localhost:5173`. Without deployed addresses the catalog remains browsable, but wallet transactions will not work.
+
+Run the contract suite and production frontend build:
+
+```bash
+npm test
+npm run build
+```
+
+If Foundry cannot write its compiler cache in a restricted environment, run it from a normal developer shell. Generated `out/`, `cache/`, `dist/`, and dependencies are ignored; all reviewable code is under `contracts/` and `src/`.
+
+## Deploy
+
+### 1. Development token
+
+For a local Anvil chain, deploy `MockUSDC.sol`, mint balances, and use its address. Never deploy or label the mock as real USDC.
+
+### 2. Contract on Base Sepolia
+
+Set a funded deployer key in your shell using Foundry’s keystore or `--private-key`; do not commit it. Set:
+
+```bash
+export BASE_SEPOLIA_RPC_URL="https://..."
+export USDC_ADDRESS="0x..." # verify against official Circle docs
+forge script contracts/script/Deploy.s.sol:Deploy \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast
+```
+
+Record the emitted contract address, then verify the exact source:
+
+```bash
+forge verify-contract <TOOLSHED_ADDRESS> contracts/src/Toolshed.sol:Toolshed \
+  --chain 84532 --constructor-args $(cast abi-encode "constructor(address)" "$USDC_ADDRESS") \
+  --etherscan-api-key "$ETHERSCAN_API_KEY"
+```
+
+Do not copy token addresses from this README. Confirm the chain ID and current USDC address in Circle’s official address list and on Basescan before deploying.
+
+### 3. Frontend
+
+Copy `.env.example` and fill `VITE_TOOLSHED_ADDRESS`, `VITE_USDC_ADDRESS`, and a dedicated `VITE_RPC_URL`. Build with `npm run build`, then deploy `dist/` to Vercel, Netlify, or IPFS. Environment variables are embedded at build time.
+
+For production:
+
+1. Upload each tool photo and metadata JSON to a pinned IPFS provider.
+2. Replace the starter array in `src/main.tsx` with indexed `ToolListed`/`ToolUpdated` data.
+3. Add association membership gating (an offchain allowlist/sign-in or an onchain attestation), since this MVP contract is permissionless.
+4. Complete an independent security audit, verify the contract on Basescan, test a small full loan, and monitor `LoanSettled` events.
+
+## Privacy and safety
+
+Wallet addresses, loan counterparties, dates, deposits, late returns, and metadata URIs are public forever. Never put names, home addresses, access codes, or precise pickup locations in IPFS metadata. Keep contact and pickup coordination in an association-controlled private channel. The contract is immutable and has no pause/admin key; nobody can freeze a valid refund, but an owner can delay return confirmation. USDC itself remains subject to Circle’s token controls.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/vite-env.d.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/vite-env.d.ts
new file mode 100644
index 0000000000000000000000000000000000000000..ed77210660e3e0571845a2e5d18ab7d9905bf334
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/vite-env.d.ts
@@ -0,0 +1,2 @@
+/// <reference types="vite/client" />
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..c50491ade8763a2ce3258fdcf7b7266ae17cfa9b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/README.md
@@ -0,0 +1,89 @@
+# Toolshed
+
+Toolshed is a first-version neighborhood tool library. It combines a warm, searchable catalog with a Base escrow contract: borrowers lock an exact USDC deposit, owners settle it when a tool is physically returned, and late fees go to the owner.
+
+## Architecture
+
+```
+React/Vite UI ── wallet (viem) ── Toolshed.sol ── USDC
+      │                                 │
+      └── IPFS metadata/photos          └── events → indexer
+```
+
+- `contracts/src/Toolshed.sol` is the sole production contract. It holds deposits and immutable loan terms, settles refunds/fees, and records completed/late loan counts.
+- Photos, descriptions, and condition notes belong in an IPFS JSON document. The contract stores only its URI. The starter catalog in `src/main.tsx` demonstrates that document data until an indexer is connected.
+- Production browsing should use a small Ponder or Graph indexer over `ToolListed`, `ToolUpdated`, and loan events. Reliability is derived from the onchain `reputation` mapping and sorted client-side (lowest late-return ratio first).
+- Base was selected for low-cost consumer interactions and wallet/on-ramp distribution. Base Sepolia is the default development network.
+- No administrator or scheduler exists. Borrowers request/cancel, owners accept/reject and confirm physical returns. Late fees are calculated only when `confirmReturn` is called.
+
+### Loan lifecycle
+
+`available → requested (deposit escrowed) → active → settled`
+
+An owner may reject a request, or the borrower may cancel it before acceptance; either path refunds the entire deposit. On settlement, each started 24-hour period after `dueAt` costs one daily fee. The fee is capped at the deposit. Contract state is updated before token transfers and every transition emits an event.
+
+Physical custody creates one intentional trust boundary: the owner confirms return. A neighborhood-association MVP can handle disputes socially. Production should add a mutually selected arbitrator or signed handoff receipts before holding substantial deposits.
+
+## Run locally
+
+Prerequisites: Node 20+, npm, Foundry, a browser wallet, and test ETH/USDC.
+
+```bash
+npm install
+cp .env.example .env
+npm run dev
+```
+
+Open `http://localhost:5173`. Without deployed addresses the catalog remains browsable, but wallet transactions will not work.
+
+Run the contract suite and production frontend build:
+
+```bash
+npm test
+npm run build
+```
+
+If Foundry cannot write its compiler cache in a restricted environment, run it from a normal developer shell. Generated `out/`, `cache/`, `dist/`, and dependencies are ignored; all reviewable code is under `contracts/` and `src/`.
+
+## Deploy
+
+### 1. Development token
+
+For a local Anvil chain, deploy `MockUSDC.sol`, mint balances, and use its address. Never deploy or label the mock as real USDC.
+
+### 2. Contract on Base Sepolia
+
+Set a funded deployer key in your shell using Foundry’s keystore or `--private-key`; do not commit it. Set:
+
+```bash
+export BASE_SEPOLIA_RPC_URL="https://..."
+export USDC_ADDRESS="0x..." # verify against official Circle docs
+forge script contracts/script/Deploy.s.sol:Deploy \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast
+```
+
+Record the emitted contract address, then verify the exact source:
+
+```bash
+forge verify-contract <TOOLSHED_ADDRESS> contracts/src/Toolshed.sol:Toolshed \
+  --chain 84532 --constructor-args $(cast abi-encode "constructor(address)" "$USDC_ADDRESS") \
+  --etherscan-api-key "$ETHERSCAN_API_KEY"
+```
+
+Do not copy token addresses from this README. Confirm the chain ID and current USDC address in Circle’s official address list and on Basescan before deploying.
+
+### 3. Frontend
+
+Copy `.env.example` and fill `VITE_TOOLSHED_ADDRESS`, `VITE_USDC_ADDRESS`, and a dedicated `VITE_RPC_URL`. Build with `npm run build`, then deploy `dist/` to Vercel, Netlify, or IPFS. Environment variables are embedded at build time.
+
+For production:
+
+1. Upload each tool photo and metadata JSON to a pinned IPFS provider.
+2. Replace the starter array in `src/main.tsx` with indexed `ToolListed`/`ToolUpdated` data.
+3. Add association membership gating (an offchain allowlist/sign-in or an onchain attestation), since this MVP contract is permissionless.
+4. Complete an independent security audit, verify the contract on Basescan, test a small full loan, and monitor `LoanSettled` events.
+
+## Privacy and safety
+
+Wallet addresses, loan counterparties, dates, deposits, late returns, and metadata URIs are public forever. Never put names, home addresses, access codes, or precise pickup locations in IPFS metadata. Keep contact and pickup coordination in an association-controlled private channel. The contract is immutable and has no pause/admin key; nobody can freeze a valid refund, but an owner can delay return confirmation. USDC itself remains subject to Circle’s token controls.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/vite-env.d.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/vite-env.d.ts
new file mode 100644
index 0000000000000000000000000000000000000000..ed77210660e3e0571845a2e5d18ab7d9905bf334
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/vite-env.d.ts
@@ -0,0 +1,2 @@
+/// <reference types="vite/client" />
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

exec
/bin/bash -lc 'npm run build && npm install --save-dev solc@0.8.24 --cache /tmp/toolshed-npm-cache && forge test --use "$PWD/node_modules/.bin/solcjs" -vv' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace
 exited 1 in 3965ms:
vite v7.3.6 building client environment for production...
transforming...
✓ 440 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.47 kB │ gzip:   0.30 kB
dist/assets/index-C7EL49k9.css    5.77 kB │ gzip:   2.05 kB
dist/assets/ccip-F5vrf3cv.js      2.89 kB │ gzip:   1.33 kB
dist/assets/index-DEaPSp_4.js   481.87 kB │ gzip: 149.47 kB
✓ built in 1.26s

added 10 packages, and audited 92 packages in 707ms

20 packages are looking for funding
  run `npm fund` for details

2 vulnerabilities (1 low, 1 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
Compiling 3 files with Solc 0.8.24
Error: solc exited with exit status: 1
error: unknown option '--allow-paths'

diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
new file mode 100644
index 0000000000000000000000000000000000000000..c5b1d90d5873b42eefa2dc2263d44f14c0279cdb
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.env.example
@@ -0,0 +1,8 @@
+VITE_CHAIN_ID=84532
+VITE_RPC_URL=https://sepolia.base.org
+VITE_TOOLSHED_ADDRESS=0x0000000000000000000000000000000000000000
+VITE_USDC_ADDRESS=0x0000000000000000000000000000000000000000
+BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
+USDC_ADDRESS=0x0000000000000000000000000000000000000000
+ETHERSCAN_API_KEY=
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
new file mode 100644
index 0000000000000000000000000000000000000000..6050123beffe09ed6159704bda220dc228ecb796
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/.gitignore
@@ -0,0 +1,7 @@
+node_modules/
+dist/
+out/
+cache/
+.env
+broadcast/
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/README.md b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..c50491ade8763a2ce3258fdcf7b7266ae17cfa9b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/README.md
@@ -0,0 +1,89 @@
+# Toolshed
+
+Toolshed is a first-version neighborhood tool library. It combines a warm, searchable catalog with a Base escrow contract: borrowers lock an exact USDC deposit, owners settle it when a tool is physically returned, and late fees go to the owner.
+
+## Architecture
+
+```
+React/Vite UI ── wallet (viem) ── Toolshed.sol ── USDC
+      │                                 │
+      └── IPFS metadata/photos          └── events → indexer
+```
+
+- `contracts/src/Toolshed.sol` is the sole production contract. It holds deposits and immutable loan terms, settles refunds/fees, and records completed/late loan counts.
+- Photos, descriptions, and condition notes belong in an IPFS JSON document. The contract stores only its URI. The starter catalog in `src/main.tsx` demonstrates that document data until an indexer is connected.
+- Production browsing should use a small Ponder or Graph indexer over `ToolListed`, `ToolUpdated`, and loan events. Reliability is derived from the onchain `reputation` mapping and sorted client-side (lowest late-return ratio first).
+- Base was selected for low-cost consumer interactions and wallet/on-ramp distribution. Base Sepolia is the default development network.
+- No administrator or scheduler exists. Borrowers request/cancel, owners accept/reject and confirm physical returns. Late fees are calculated only when `confirmReturn` is called.
+
+### Loan lifecycle
+
+`available → requested (deposit escrowed) → active → settled`
+
+An owner may reject a request, or the borrower may cancel it before acceptance; either path refunds the entire deposit. On settlement, each started 24-hour period after `dueAt` costs one daily fee. The fee is capped at the deposit. Contract state is updated before token transfers and every transition emits an event.
+
+Physical custody creates one intentional trust boundary: the owner confirms return. A neighborhood-association MVP can handle disputes socially. Production should add a mutually selected arbitrator or signed handoff receipts before holding substantial deposits.
+
+## Run locally
+
+Prerequisites: Node 20+, npm, Foundry, a browser wallet, and test ETH/USDC.
+
+```bash
+npm install
+cp .env.example .env
+npm run dev
+```
+
+Open `http://localhost:5173`. Without deployed addresses the catalog remains browsable, but wallet transactions will not work.
+
+Run the contract suite and production frontend build:
+
+```bash
+npm test
+npm run build
+```
+
+If Foundry cannot write its compiler cache in a restricted environment, run it from a normal developer shell. Generated `out/`, `cache/`, `dist/`, and dependencies are ignored; all reviewable code is under `contracts/` and `src/`.
+
+## Deploy
+
+### 1. Development token
+
+For a local Anvil chain, deploy `MockUSDC.sol`, mint balances, and use its address. Never deploy or label the mock as real USDC.
+
+### 2. Contract on Base Sepolia
+
+Set a funded deployer key in your shell using Foundry’s keystore or `--private-key`; do not commit it. Set:
+
+```bash
+export BASE_SEPOLIA_RPC_URL="https://..."
+export USDC_ADDRESS="0x..." # verify against official Circle docs
+forge script contracts/script/Deploy.s.sol:Deploy \
+  --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast
+```
+
+Record the emitted contract address, then verify the exact source:
+
+```bash
+forge verify-contract <TOOLSHED_ADDRESS> contracts/src/Toolshed.sol:Toolshed \
+  --chain 84532 --constructor-args $(cast abi-encode "constructor(address)" "$USDC_ADDRESS") \
+  --etherscan-api-key "$ETHERSCAN_API_KEY"
+```
+
+Do not copy token addresses from this README. Confirm the chain ID and current USDC address in Circle’s official address list and on Basescan before deploying.
+
+### 3. Frontend
+
+Copy `.env.example` and fill `VITE_TOOLSHED_ADDRESS`, `VITE_USDC_ADDRESS`, and a dedicated `VITE_RPC_URL`. Build with `npm run build`, then deploy `dist/` to Vercel, Netlify, or IPFS. Environment variables are embedded at build time.
+
+For production:
+
+1. Upload each tool photo and metadata JSON to a pinned IPFS provider.
+2. Replace the starter array in `src/main.tsx` with indexed `ToolListed`/`ToolUpdated` data.
+3. Add association membership gating (an offchain allowlist/sign-in or an onchain attestation), since this MVP contract is permissionless.
+4. Complete an independent security audit, verify the contract on Basescan, test a small full loan, and monitor `LoanSettled` events.
+
+## Privacy and safety
+
+Wallet addresses, loan counterparties, dates, deposits, late returns, and metadata URIs are public forever. Never put names, home addresses, access codes, or precise pickup locations in IPFS metadata. Keep contact and pickup coordination in an association-controlled private channel. The contract is immutable and has no pause/admin key; nobody can freeze a valid refund, but an owner can delay return confirmation. USDC itself remains subject to Circle’s token controls.
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
new file mode 100644
index 0000000000000000000000000000000000000000..baf572ebd257e62c69fcc7ba6c6de15303da3641
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/script/Deploy.s.sol
@@ -0,0 +1,22 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+
+interface Vm {
+    function envAddress(string calldata name) external returns (address);
+    function startBroadcast() external;
+    function stopBroadcast() external;
+}
+
+contract Deploy {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+
+    function run() external returns (Toolshed toolshed) {
+        address usdc = vm.envAddress("USDC_ADDRESS");
+        vm.startBroadcast();
+        toolshed = new Toolshed(IERC20(usdc));
+        vm.stopBroadcast();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
new file mode 100644
index 0000000000000000000000000000000000000000..9b73d92b4f7384116fd7806927eed103c18f167a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/MockUSDC.sol
@@ -0,0 +1,34 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+contract MockUSDC {
+    string public constant name = "Mock USDC";
+    string public constant symbol = "USDC";
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
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+
+    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
+        uint256 approved = allowance[from][msg.sender];
+        if (approved != type(uint256).max) allowance[from][msg.sender] = approved - amount;
+        balanceOf[from] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
new file mode 100644
index 0000000000000000000000000000000000000000..cb40149d36ff04da5b0108fb37ad1579333b0770
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/src/Toolshed.sol
@@ -0,0 +1,172 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+interface IERC20 {
+    function transfer(address to, uint256 value) external returns (bool);
+    function transferFrom(address from, address to, uint256 value) external returns (bool);
+}
+
+/// @notice USDC escrow for physical tool loans. Metadata is stored offchain at metadataURI.
+contract Toolshed {
+    enum LoanStatus {
+        None,
+        Requested,
+        Active,
+        Settled,
+        Rejected,
+        Cancelled
+    }
+
+    struct Tool {
+        address owner;
+        string metadataURI;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        bool available;
+    }
+
+    struct Loan {
+        uint256 toolId;
+        address borrower;
+        uint64 requestedDays;
+        uint64 dueAt;
+        uint96 deposit;
+        uint96 dailyLateFee;
+        LoanStatus status;
+    }
+
+    struct Reputation {
+        uint64 completedLoans;
+        uint64 lateReturns;
+    }
+
+    IERC20 public immutable usdc;
+    uint256 public nextToolId = 1;
+    uint256 public nextLoanId = 1;
+    uint256 private unlocked = 1;
+
+    mapping(uint256 => Tool) public tools;
+    mapping(uint256 => Loan) public loans;
+    mapping(address => Reputation) public reputation;
+
+    event ToolListed(uint256 indexed toolId, address indexed owner, string metadataURI, uint256 deposit, uint256 dailyLateFee);
+    event ToolUpdated(uint256 indexed toolId, string metadataURI, uint256 deposit, uint256 dailyLateFee, bool available);
+    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint256 requestedDays);
+    event LoanAccepted(uint256 indexed loanId, uint256 dueAt);
+    event LoanRejected(uint256 indexed loanId);
+    event LoanCancelled(uint256 indexed loanId);
+    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
+
+    error Unauthorized();
+    error InvalidTerms();
+    error InvalidStatus();
+    error ToolUnavailable();
+    error TokenTransferFailed();
+
+    modifier nonReentrant() {
+        require(unlocked == 1, "REENTRANCY");
+        unlocked = 2;
+        _;
+        unlocked = 1;
+    }
+
+    constructor(IERC20 usdc_) {
+        if (address(usdc_) == address(0)) revert InvalidTerms();
+        usdc = usdc_;
+    }
+
+    function listTool(string calldata metadataURI, uint96 deposit, uint96 dailyLateFee) external returns (uint256 toolId) {
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        toolId = nextToolId++;
+        tools[toolId] = Tool(msg.sender, metadataURI, deposit, dailyLateFee, true);
+        emit ToolListed(toolId, msg.sender, metadataURI, deposit, dailyLateFee);
+    }
+
+    function updateTool(uint256 toolId, string calldata metadataURI, uint96 deposit, uint96 dailyLateFee, bool available) external {
+        Tool storage tool = tools[toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (bytes(metadataURI).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidTerms();
+        tool.metadataURI = metadataURI;
+        tool.deposit = deposit;
+        tool.dailyLateFee = dailyLateFee;
+        tool.available = available;
+        emit ToolUpdated(toolId, metadataURI, deposit, dailyLateFee, available);
+    }
+
+    function requestLoan(uint256 toolId, uint64 requestedDays) external nonReentrant returns (uint256 loanId) {
+        Tool storage tool = tools[toolId];
+        if (!tool.available) revert ToolUnavailable();
+        if (tool.owner == msg.sender || requestedDays == 0 || requestedDays > 30) revert InvalidTerms();
+
+        tool.available = false;
+        loanId = nextLoanId++;
+        loans[loanId] = Loan(toolId, msg.sender, requestedDays, 0, tool.deposit, tool.dailyLateFee, LoanStatus.Requested);
+        _transferFrom(msg.sender, address(this), tool.deposit);
+        emit LoanRequested(loanId, toolId, msg.sender, requestedDays);
+    }
+
+    function acceptLoan(uint256 loanId) external {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Active;
+        loan.dueAt = uint64(block.timestamp + loan.requestedDays * 1 days);
+        emit LoanAccepted(loanId, loan.dueAt);
+    }
+
+    function rejectLoan(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Rejected;
+        tool.available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanRejected(loanId);
+    }
+
+    function cancelRequest(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        if (loan.borrower != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Requested) revert InvalidStatus();
+        loan.status = LoanStatus.Cancelled;
+        tools[loan.toolId].available = true;
+        _transfer(loan.borrower, loan.deposit);
+        emit LoanCancelled(loanId);
+    }
+
+    /// @notice Owner calls after physically receiving the tool.
+    function confirmReturn(uint256 loanId) external nonReentrant {
+        Loan storage loan = loans[loanId];
+        Tool storage tool = tools[loan.toolId];
+        if (tool.owner != msg.sender) revert Unauthorized();
+        if (loan.status != LoanStatus.Active) revert InvalidStatus();
+
+        bool late = block.timestamp > loan.dueAt;
+        uint256 lateDays = late ? (block.timestamp - loan.dueAt + 1 days - 1) / 1 days : 0;
+        uint256 ownerFee = lateDays * loan.dailyLateFee;
+        if (ownerFee > loan.deposit) ownerFee = loan.deposit;
+        uint256 refund = loan.deposit - ownerFee;
+
+        loan.status = LoanStatus.Settled;
+        tool.available = true;
+        reputation[loan.borrower].completedLoans++;
+        if (late) reputation[loan.borrower].lateReturns++;
+
+        if (ownerFee != 0) _transfer(tool.owner, ownerFee);
+        if (refund != 0) _transfer(loan.borrower, refund);
+        emit LoanSettled(loanId, ownerFee, refund, late);
+    }
+
+    function _transfer(address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+
+    function _transferFrom(address from, address to, uint256 amount) private {
+        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
+        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..987dc6e50d4248586cbd71cf9d170c9f8506a03a
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/contracts/test/Toolshed.t.sol
@@ -0,0 +1,81 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+import "../src/Toolshed.sol";
+import "../src/MockUSDC.sol";
+
+interface TestVm {
+    function prank(address) external;
+    function warp(uint256) external;
+}
+
+contract ToolshedTest {
+    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    MockUSDC private usdc;
+    Toolshed private toolshed;
+    address private constant OWNER = address(0xA11CE);
+    address private constant BORROWER = address(0xB0B);
+
+    function setUp() public {
+        usdc = new MockUSDC();
+        toolshed = new Toolshed(IERC20(address(usdc)));
+        usdc.mint(BORROWER, 1_000e6);
+        vm.prank(BORROWER);
+        usdc.approve(address(toolshed), type(uint256).max);
+    }
+
+    function _request() private returns (uint256 loanId) {
+        vm.prank(OWNER);
+        uint256 toolId = toolshed.listTool("ipfs://tool", 100e6, 10e6);
+        vm.prank(BORROWER);
+        loanId = toolshed.requestLoan(toolId, 3);
+    }
+
+    function testOnTimeReturnRefundsDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 0, "wrong reputation");
+    }
+
+    function testLateFeeRoundsUpAndPaysOwner() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 1 days + 1);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 20e6, "wrong owner fee");
+        require(usdc.balanceOf(BORROWER) == 980e6, "wrong refund");
+        (uint64 completed, uint64 late) = toolshed.reputation(BORROWER);
+        require(completed == 1 && late == 1, "wrong reputation");
+    }
+
+    function testRejectRefundsAndReopensTool() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.rejectLoan(loanId);
+        require(usdc.balanceOf(BORROWER) == 1_000e6, "deposit not refunded");
+        (uint256 toolId, , , , , , ) = toolshed.loans(loanId);
+        (, , , , bool available) = toolshed.tools(toolId);
+        require(available, "tool unavailable");
+    }
+
+    function testFeeCannotExceedDeposit() public {
+        uint256 loanId = _request();
+        vm.prank(OWNER);
+        toolshed.acceptLoan(loanId);
+        (, , , uint64 dueAt, , , ) = toolshed.loans(loanId);
+        vm.warp(uint256(dueAt) + 100 days);
+        vm.prank(OWNER);
+        toolshed.confirmReturn(loanId);
+        require(usdc.balanceOf(OWNER) == 100e6, "fee not capped");
+        require(usdc.balanceOf(BORROWER) == 900e6, "bad balance");
+    }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..1e9b5cbbdb1a819e8c4c298c2052ed85659f994e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/foundry.toml
@@ -0,0 +1,11 @@
+[profile.default]
+src = "contracts/src"
+test = "contracts/test"
+script = "contracts/script"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
new file mode 100644
index 0000000000000000000000000000000000000000..56aa330bd7d8e57a725148c3977bf2fd2af7c79e
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/index.html
@@ -0,0 +1,14 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="theme-color" content="#f5f1e8" />
+    <title>Toolshed · Neighborhood lending</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/main.tsx"></script>
+  </body>
+</html>
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
new file mode 100644
index 0000000000000000000000000000000000000000..30238efe405074fbe3a929892918d366968b204c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/package.json
@@ -0,0 +1,25 @@
+{
+  "name": "toolshed",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "scripts": {
+    "dev": "vite",
+    "build": "tsc -b && vite build",
+    "lint": "eslint .",
+    "test": "forge test -vv"
+  },
+  "dependencies": {
+    "@vitejs/plugin-react": "^5.0.0",
+    "vite": "^7.0.0",
+    "typescript": "^5.8.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0",
+    "viem": "^2.33.0"
+  },
+  "devDependencies": {
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0"
+  }
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
new file mode 100644
index 0000000000000000000000000000000000000000..94f3b2bc19b9accb3c8bc4ab5f24b82a98f10d9c
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/abi.ts
@@ -0,0 +1,47 @@
+export const toolshedAbi = [
+  {
+    type: "function",
+    name: "listTool",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "metadataURI", type: "string" },
+      { name: "deposit", type: "uint96" },
+      { name: "dailyLateFee", type: "uint96" },
+    ],
+    outputs: [{ name: "toolId", type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "requestLoan",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "toolId", type: "uint256" },
+      { name: "requestedDays", type: "uint64" },
+    ],
+    outputs: [{ name: "loanId", type: "uint256" }],
+  },
+] as const;
+
+export const erc20Abi = [
+  {
+    type: "function",
+    name: "allowance",
+    stateMutability: "view",
+    inputs: [
+      { name: "owner", type: "address" },
+      { name: "spender", type: "address" },
+    ],
+    outputs: [{ type: "uint256" }],
+  },
+  {
+    type: "function",
+    name: "approve",
+    stateMutability: "nonpayable",
+    inputs: [
+      { name: "spender", type: "address" },
+      { name: "amount", type: "uint256" },
+    ],
+    outputs: [{ type: "bool" }],
+  },
+] as const;
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..b01f06c34ba781dac8728d30b622882954db67d5
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/main.tsx
@@ -0,0 +1,162 @@
+import { StrictMode, useMemo, useState } from "react";
+import { createRoot } from "react-dom/client";
+import {
+  createPublicClient,
+  createWalletClient,
+  custom,
+  defineChain,
+  formatUnits,
+  getAddress,
+  http,
+  parseUnits,
+  type Address,
+} from "viem";
+import { erc20Abi, toolshedAbi } from "./abi";
+import "./styles.css";
+
+type Tool = {
+  id: bigint;
+  name: string;
+  category: string;
+  condition: string;
+  image: string;
+  owner: string;
+  completed: number;
+  late: number;
+  deposit: bigint;
+  lateFee: bigint;
+  distance: string;
+};
+
+const tools: Tool[] = [
+  { id: 1n, name: "18V cordless drill", category: "Power tools", condition: "Good — new battery, chuck has cosmetic wear", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85", owner: "Maya R.", completed: 24, late: 0, deposit: 50_000_000n, lateFee: 5_000_000n, distance: "2 blocks" },
+  { id: 2n, name: "Folding extension ladder", category: "Ladders", condition: "Very good — feet replaced this spring", image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=85", owner: "Jon B.", completed: 17, late: 1, deposit: 80_000_000n, lateFee: 8_000_000n, distance: "5 blocks" },
+  { id: 3n, name: "Garden tiller", category: "Garden", condition: "Works well — return with a full tank", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", owner: "Elena S.", completed: 31, late: 2, deposit: 120_000_000n, lateFee: 12_000_000n, distance: "8 blocks" },
+  { id: 4n, name: "Orbital sander", category: "Power tools", condition: "Like new — includes dust bag and 3 discs", image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=85", owner: "Theo W.", completed: 9, late: 0, deposit: 40_000_000n, lateFee: 4_000_000n, distance: "3 blocks" },
+];
+
+const chainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);
+const rpcUrl = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
+const contractAddress = (import.meta.env.VITE_TOOLSHED_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const usdcAddress = (import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
+const chain = defineChain({ id: chainId, name: "Base Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
+const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
+
+function App() {
+  const [account, setAccount] = useState<Address>();
+  const [walletChain, setWalletChain] = useState<number>();
+  const [query, setQuery] = useState("");
+  const [category, setCategory] = useState("All tools");
+  const [selected, setSelected] = useState<Tool>();
+  const [days, setDays] = useState(3);
+  const [status, setStatus] = useState("");
+  const [busy, setBusy] = useState(false);
+  const [showList, setShowList] = useState(false);
+
+  const visibleTools = useMemo(() => tools
+    .filter(tool => category === "All tools" || tool.category === category)
+    .filter(tool => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
+    .sort((a, b) => (a.late / Math.max(a.completed, 1)) - (b.late / Math.max(b.completed, 1))), [category, query]);
+
+  async function connect() {
+    if (!window.ethereum) {
+      setStatus("Install a browser wallet to continue.");
+      return;
+    }
+    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
+    const [address] = await wallet.requestAddresses();
+    const currentChain = await wallet.getChainId();
+    setAccount(address);
+    setWalletChain(currentChain);
+  }
+
+  async function switchNetwork() {
+    await window.ethereum?.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
+    setWalletChain(chainId);
+  }
+
+  async function requestTool() {
+    if (!account || !selected || !window.ethereum) return;
+    setBusy(true);
+    try {
+      const wallet = createWalletClient({ chain, transport: custom(window.ethereum), account });
+      const allowance = await publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: "allowance", args: [account, contractAddress] });
+      if (allowance < selected.deposit) {
+        setStatus(`Approve ${formatUnits(selected.deposit, 6)} USDC…`);
+        const approval = await wallet.writeContract({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [contractAddress, selected.deposit] });
+        await publicClient.waitForTransactionReceipt({ hash: approval });
+      }
+      setStatus("Sending loan request…");
+      const hash = await wallet.writeContract({ address: contractAddress, abi: toolshedAbi, functionName: "requestLoan", args: [selected.id, BigInt(days)] });
+      await publicClient.waitForTransactionReceipt({ hash });
+      setStatus("Request sent. The owner can now accept it.");
+      setSelected(undefined);
+    } catch (error) {
+      setStatus(error instanceof Error && error.message.includes("rejected") ? "Transaction cancelled in wallet." : "Could not submit. Check your USDC balance and try again.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  const wrongNetwork = account && walletChain !== chainId;
+
+  return (
+    <div className="app">
+      <header>
+        <a className="brand" href="#"><span>⌂</span> TOOLShed</a>
+        <nav><a href="#browse">Browse</a><button className="nav-link" onClick={() => setShowList(true)}>List a tool</button><a href="#loans">My loans</a></nav>
+        <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
+      </header>
+
+      <main>
+        <section className="hero">
+          <div><p className="eyebrow">Your neighborhood has what you need</p><h1>Borrow more.<br/><em>Buy less.</em></h1><p className="intro">Toolshed helps neighbors share good tools, put them to work, and keep trust close to home.</p></div>
+          <div className="hero-note"><span>300</span><p>neighbors sharing<br/>what they already own</p></div>
+        </section>
+
+        <section className="controls" id="browse">
+          <label className="search"><span>⌕</span><input aria-label="Search tools" placeholder="What do you need?" value={query} onChange={event => setQuery(event.target.value)} /></label>
+          <div className="categories">{["All tools", "Power tools", "Garden", "Ladders"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
+        </section>
+
+        <section className="catalog">
+          <div className="section-heading"><div><p className="eyebrow">Available nearby</p><h2>Ready to borrow</h2></div><p>Sorted by owner reliability · {visibleTools.length} tools</p></div>
+          <div className="grid">{visibleTools.map((tool, index) => (
+            <article className="card" key={tool.id}>
+              <div className="image-wrap"><img src={tool.image} alt={tool.name}/><span className="number">0{index + 1}</span><span className="distance">{tool.distance}</span></div>
+              <div className="card-body"><p className="category">{tool.category}</p><h3>{tool.name}</h3><p className="condition">{tool.condition}</p>
+                <div className="owner"><div className="avatar">{tool.owner[0]}</div><div><strong>{tool.owner}</strong><small>{tool.completed} loans · {tool.late === 0 ? "always on time" : `${tool.late} late`}</small></div><span className="trust">{Math.round((1 - tool.late / Math.max(tool.completed, 1)) * 100)}%</span></div>
+                <div className="terms"><span><small>Deposit</small>${formatUnits(tool.deposit, 6)} USDC</span><span><small>Late fee</small>${formatUnits(tool.lateFee, 6)} / day</span><button onClick={() => setSelected(tool)}>Request →</button></div>
+              </div>
+            </article>
+          ))}</div>
+        </section>
+      </main>
+
+      <footer><div className="brand"><span>⌂</span> TOOLShed</div><p>Built for the block, not the landfill.</p><small>Deposits settle in USDC on Base.</small></footer>
+
+      {selected && <div className="backdrop" onClick={() => setSelected(undefined)}><div className="modal" onClick={event => event.stopPropagation()}>
+        <button className="close" onClick={() => setSelected(undefined)}>×</button><p className="eyebrow">Loan request</p><h2>{selected.name}</h2><p>{selected.condition}</p>
+        <label>How many days?<input type="number" min="1" max="30" value={days} onChange={event => setDays(Number(event.target.value))}/></label>
+        <div className="summary"><span>Refundable deposit</span><strong>${formatUnits(selected.deposit, 6)} USDC</strong><span>Late after due date</span><strong>${formatUnits(selected.lateFee, 6)} / day</strong></div>
+        {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : wrongNetwork ? <button className="primary" onClick={switchNetwork}>Switch to Base Sepolia</button> : <button className="primary" disabled={busy} onClick={requestTool}>{busy && <span className="spinner"/>}{busy ? "Working…" : "Approve & request"}</button>}
+        <small className="fine">Approval is limited to this deposit. Owner confirmation releases your refund.</small>
+      </div></div>}
+
+      {showList && <div className="backdrop" onClick={() => setShowList(false)}><form className="modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); setStatus("Listing form ready; upload metadata to IPFS, then call listTool."); setShowList(false); }}>
+        <button type="button" className="close" onClick={() => setShowList(false)}>×</button><p className="eyebrow">Share with neighbors</p><h2>List a tool</h2>
+        <label>Tool name<input required placeholder="e.g. Circular saw"/></label><label>Photo<input required type="file" accept="image/*"/></label><label>Condition notes<textarea required placeholder="Be specific about wear, included parts, and quirks"/></label>
+        <div className="row"><label>Deposit (USDC)<input required type="number" min="1"/></label><label>Late fee / day<input required type="number" min="0" step=".01"/></label></div>
+        <button className="primary">Continue to IPFS & wallet</button>
+      </form></div>}
+      {status && <button className="toast" onClick={() => setStatus("")}>{status}<span>×</span></button>}
+    </div>
+  );
+}
+
+declare global {
+  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
+}
+
+createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
new file mode 100644
index 0000000000000000000000000000000000000000..c55bb2ac9909cdb6933915381464729d34facae9
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/styles.css
@@ -0,0 +1,3 @@
+@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Caslon+Display&display=swap');
+:root{font-family:"DM Sans",sans-serif;color:#1d2a21;background:#f5f1e8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,textarea{font:inherit}button{cursor:pointer}header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;border-bottom:1px solid #d9d2c3;position:sticky;top:0;background:rgba(245,241,232,.94);backdrop-filter:blur(12px);z-index:5}.brand{display:flex;gap:10px;align-items:center;font-weight:800;letter-spacing:.03em;color:#183c2a;text-decoration:none}.brand span{display:grid;place-items:center;background:#e55532;color:#fff;width:31px;height:31px;border-radius:50%}nav{display:flex;gap:35px}nav a,.nav-link{border:0;background:none;color:#526057;text-decoration:none;font-weight:600}.wallet,.primary{border:0;background:#173f2c;color:#fff;border-radius:3px;padding:12px 20px;font-weight:700}.hero{min-height:420px;padding:80px 7vw 60px;display:grid;grid-template-columns:2fr 1fr;align-items:end;background:radial-gradient(circle at 78% 30%,#e2c69a 0 2%,transparent 2.4%),linear-gradient(120deg,#f5f1e8 65%,#e7dfcf 65%)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700;color:#d85535}.hero h1{font-family:"Libre Caslon Display",serif;font-size:clamp(56px,7vw,100px);font-weight:400;line-height:.88;margin:16px 0;color:#193d2b}.hero h1 em{color:#d95535;font-weight:400}.intro{font-family:"Libre Caslon Display",serif;font-size:21px;line-height:1.5;max-width:590px;color:#59645d}.hero-note{justify-self:end;border-left:1px solid #baa987;padding-left:30px}.hero-note span{font:64px "Libre Caslon Display";color:#183c2a}.hero-note p{line-height:1.5;color:#667169}.controls{padding:35px 7vw;border-top:1px solid #d9d2c3;border-bottom:1px solid #d9d2c3;display:flex;gap:25px;align-items:center;justify-content:space-between}.search{background:#fff;display:flex;gap:10px;padding:13px 17px;min-width:330px;border:1px solid #d8d0c0}.search input{border:0;outline:0;width:100%;background:transparent}.categories{display:flex;gap:8px;flex-wrap:wrap}.categories button{border:1px solid #cfc6b5;background:transparent;padding:9px 14px;border-radius:30px;color:#59645d}.categories button.active{background:#173f2c;color:white}.catalog{padding:70px 7vw 100px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:32px}.section-heading h2,.modal h2{font:45px "Libre Caslon Display";margin:7px 0}.section-heading>p{color:#7a817c}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}.card{background:#fff;border:1px solid #ddd5c7}.image-wrap{height:270px;position:relative;overflow:hidden;background:#d8d1c2}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:.4s}.card:hover img{transform:scale(1.03)}.number,.distance{position:absolute;top:14px;background:#f5f1e8;padding:6px 9px;font-size:12px;font-weight:700}.number{left:14px}.distance{right:14px}.card-body{padding:25px}.category{color:#d85535;text-transform:uppercase;font-size:11px;letter-spacing:.14em;font-weight:700}.card h3{font:29px "Libre Caslon Display";margin:8px 0}.condition{color:#667169;min-height:44px}.owner{display:flex;align-items:center;gap:10px;border-top:1px solid #eee8dc;padding-top:17px;margin-top:17px}.avatar{width:35px;height:35px;border-radius:50%;background:#d9b86f;display:grid;place-items:center;font-weight:700}.owner small{display:block;color:#788079}.trust{margin-left:auto;color:#28784b;font-size:13px;font-weight:700}.terms{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;margin-top:20px}.terms span{font-weight:700}.terms small{display:block;color:#8a908b;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.terms button{border:0;background:#e55635;color:white;padding:12px 15px;font-weight:700}.backdrop{position:fixed;inset:0;background:rgba(17,35,25,.7);z-index:10;display:grid;place-items:center;padding:20px}.modal{position:relative;background:#f7f3ea;width:min(520px,100%);padding:38px;max-height:92vh;overflow:auto;box-shadow:0 25px 80px #14231b66}.close{position:absolute;right:15px;top:10px;background:none;border:0;font-size:30px}.modal label{display:grid;gap:7px;margin:17px 0;font-size:13px;font-weight:700}.modal input,.modal textarea{border:1px solid #cfc5b3;background:#fff;padding:12px;border-radius:3px}.modal textarea{min-height:90px}.summary{background:#e9e3d7;padding:16px;display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14px}.primary{width:100%;margin-top:20px;padding:15px}.primary:disabled{opacity:.7}.fine{display:block;text-align:center;color:#737b75;margin-top:12px}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.spinner{display:inline-block;width:13px;height:13px;border:2px solid #ffffff66;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px}@keyframes spin{to{transform:rotate(360deg)}}.toast{position:fixed;right:25px;bottom:25px;z-index:20;background:#173f2c;color:white;border:0;padding:17px 20px;box-shadow:0 10px 30px #0004}.toast span{margin-left:20px}footer{background:#173f2c;color:white;padding:45px 7vw;display:flex;justify-content:space-between;align-items:center}footer .brand{color:white}footer small{color:#bdc9c1}@media(max-width:800px){nav{display:none}.hero{grid-template-columns:1fr;padding-top:55px}.hero-note{display:none}.controls{align-items:stretch;flex-direction:column}.search{min-width:0}.grid{grid-template-columns:1fr}.section-heading>p{display:none}.image-wrap{height:230px}.terms{grid-template-columns:1fr 1fr}.terms button{grid-column:1/-1;margin-top:15px}.row{grid-template-columns:1fr}footer{gap:20px;flex-direction:column;align-items:flex-start}}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/vite-env.d.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/vite-env.d.ts
new file mode 100644
index 0000000000000000000000000000000000000000..ed77210660e3e0571845a2e5d18ab7d9905bf334
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/src/vite-env.d.ts
@@ -0,0 +1,2 @@
+/// <reference types="vite/client" />
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
new file mode 100644
index 0000000000000000000000000000000000000000..d75e799810b1e28913953d3e5677b696bff1cc7b
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/tsconfig.json
@@ -0,0 +1,22 @@
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
+  "include": ["src"],
+  "references": []
+}
+
diff --git a/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
new file mode 100644
index 0000000000000000000000000000000000000000..dd83cd44f857a3bb5740f25accab5d88d4f05e8d
--- /dev/null
+++ b/artifacts/ship-goal-001/2026-07-30T204143Z-codex-with-skill-1/workspace/vite.config.ts
@@ -0,0 +1,7 @@
+import { defineConfig } from "vite";
+import react from "@vitejs/plugin-react";
+
+export default defineConfig({
+  plugins: [react()],
+});
+

