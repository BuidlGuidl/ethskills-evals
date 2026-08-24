Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb4a3-6849-7651-8bcc-132aa13124e4
--------
user
We're building an onchain version of a savings circle — the thing my family
calls a susu. Twelve people put in $100 of USDC each month, and each month one
member takes the whole $1,200 pot; the order is fixed when the circle starts,
and everyone gets exactly one turn over the year. If someone misses a payment
they forfeit their turn, and their earlier contributions cover the shortfall
for that month's recipient.

There are two of us building this and we're both away for the next six weeks.
I want to know whether the circles that are already running keep working while
we're gone — and if not, exactly what breaks and what we'd have to do about
it.

Write your answer to plan.md in this directory: the contract design, plus the
answer to that.
codex
I’m using the `ship` skill to structure the onchain design and assess unattended operation.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md && pwd && rg --files -g 'AGENTS.md' -g '"'!node_modules'"'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace
 exited 1 in 0ms:
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

/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace

exec
/bin/bash -lc "sed -n '241,480p' .agents/skills/ship/SKILL.md
rg --files .agents/skills | sed -n '1,160p'
find . -maxdepth 2 -name AGENTS.md -print" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace
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
The key design question is liveness: contracts cannot collect or advance months by themselves. I’m checking the relevant execution patterns before writing the plan.
web search: 
web search: https://ethskills.com/concepts/SKILL.md
web search: 
web search: https://ethskills.com/concepts/SKILL.md
web search: 
web search: site:ethskills.com/concepts/SKILL.md "Smart contracts don't run themselves"
exec
/bin/bash -lc 'curl -fsSL --max-time 20 https://ethskills.com/concepts/SKILL.md' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace
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

codex
I found the critical constraint: paid-in earlier installments cannot cover a later missed installment once those funds were already paid out. The design therefore needs escrowed collateral or it cannot guarantee every $1,200 payout.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
diff --git a/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..22cb0b3ffaa50c849256e43334ffc218b441802a
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,157 @@
+# Susu circle: unattended-operation plan
+
+## Bottom line
+
+The circle can run while both builders are away **only if every monthly state
+transition is permissionless and the circle is collateralized**. A deployed
+contract does not wake up, collect USDC, detect a default, or send a payout on
+its own. Someone must submit each transaction and pay gas.
+
+I cannot certify that circles already running have those properties from this
+directory; no deployed-contract address, source, or operations configuration is
+present. Treat an existing circle as **not six-week-safe** until the checks
+below pass. A design where an owner/admin calls `advanceMonth`, or where a
+missed $100 is expected to be covered by installments already paid to prior
+recipients, will break.
+
+## Recommended MVP: one immutable Circle contract per group
+
+Use one non-upgradeable `SusuCircle` instance for a 12-member circle. It holds
+the canonical USDC for the chosen chain (USDC has 6 decimals: `100e6` per
+installment and `1200e6` per period), the ordered member list, the start time,
+the 30-day periods, payment deadline, and accounting. No factory is needed for
+the first circle; deploy another instance when another group is created.
+
+Onchain:
+
+- fixed, unique list of 12 member addresses and their payout addresses;
+- the fixed order, period number, due/deadline timestamps, payment/default
+  status, remaining collateral, and whether each member has received;
+- USDC escrow, collection, default coverage, and payout;
+- events for join/fund/default/settle/payout/collateral withdrawal.
+
+Offchain:
+
+- member identity, invitations, reminders, support, and the event-indexed UI;
+- optional monitoring/keeper service. It may submit transactions, but must not
+  be required for the protocol to work.
+
+Use OpenZeppelin `SafeERC20` and `ReentrancyGuard`; make the USDC address,
+member set, amounts, order, and timing immutable. Reject duplicate/zero
+members, wrong amounts, late/duplicate payments, and non-canonical tokens.
+There must be no owner-only withdrawal, no admin-only settlement, and no
+upgrade key controlling member funds. An emergency pause is a trade-off: it can
+protect against a discovered exploit, but makes the circle dependent on the
+signers. For this MVP, prefer audited immutable code over an admin pause. If a
+pause is required, put it behind a 2-of-3 multisig, publish the signers, and
+accept that a pause can halt six-week operation.
+
+## Solvency rule: the requested default behavior needs collateral
+
+At the beginning of a normal month, the twelve $100 payments make the $1,200
+pot. But a member's earlier payments have already been transferred to earlier
+recipients; they are not still in the contract. So they cannot fill a later
+shortfall. This is a balance-sheet impossibility, not a Solidity problem.
+
+Require every member to lock a security deposit of `12 * $100 = $1,200` USDC
+at activation. They still make the normal monthly $100 payment. After each
+timely payment, $100 of that member's collateral becomes withdrawable (or is
+returned in the same transaction). Thus a compliant member's net contribution
+is still $1,200, but they must have $1,200 of temporary capital available at
+the start.
+
+If a member misses a period, the contract takes that period's $100 from their
+still-locked collateral and marks them defaulted. It retains the rest to cover
+every future $100 they owe. That makes every remaining $1,200 monthly pot
+solvent even if the defaulter has already received their payout. The defaulter
+loses any unpaid turn; if they were due in the defaulted period, their slot is
+skipped and the next eligible member in the original order receives that
+period's pot. Record this rule explicitly in the member agreement: later
+eligible members can receive earlier when a defaulted slot is skipped.
+
+If the group will not accept $1,200 collateral, the honest alternative is not a
+guaranteed susu: a default can reduce/delay payouts and needs an agreed
+shortfall allocation. Do not promise the stated guarantee in that version.
+
+## State machine and callers
+
+`activate()` — each proposed member deposits their $1,200 collateral; the
+circle begins only after all 12 have funded. Any member calls it. If not fully
+funded by a setup deadline, each depositor can withdraw and the circle never
+starts.
+
+`payCurrentPeriod()` — an active member transfers exactly $100 USDC before the
+deadline. The caller is the paying member; they do it to remain eligible and
+unlock $100 of collateral. A UX may first request a limited approval for this
+circle, never an infinite approval.
+
+`settleCurrentPeriod()` — **any address** may call once all payments arrive or
+the deadline passes. On deadline, it marks non-payers defaulted and transfers
+$100 per non-payer from their locked collateral into the pot. It then pays
+exactly $1,200 to the next active unpaid member in the fixed order and advances
+one period. This must be atomic: either default accounting and payout both
+happen, or neither does. With only 12 members, bounded iteration over the list
+is acceptable.
+
+`withdrawReleasedCollateral()` — a compliant member withdraws only collateral
+made available by their timely payment; after the final settlement, remaining
+released amounts are claimable. A defaulted member cannot withdraw collateral
+reserved for their missed/future installments.
+
+`close()` — after 12 settlements and all payouts, permit final claims and make
+the contract inert. There is no discretionary treasury sweep.
+
+The normal recipient is already motivated to call `settleCurrentPeriod`, as are
+later recipients who need the circle to progress. Add a small fixed keeper
+reward only if testing shows this is insufficient; fund it explicitly rather
+than silently reducing the $1,200 payout. A public bot/automation service can
+be a backup, but any account must always be able to settle directly.
+
+## What six weeks away does and does not require
+
+It does **not** require either builder to be online when the deployed code has
+the rules above. A member, recipient, friend, or bot can settle the month;
+members must still ensure their wallets have USDC and submit their own payment
+transactions. Even a token approval cannot force a wallet to keep a balance or
+to leave its approval in place.
+
+It **does** break without those properties:
+
+- Admin-only month advancement: the current period stays open; payout, default
+  handling, and all later periods stop. Fix: permissionless `settleCurrentPeriod`.
+- No collateral/reserve: one missed payment leaves only $1,100. Fix: the locked
+  remaining-obligation collateral above, or weaken the payout guarantee.
+- Recipient-only settlement: if that recipient is unavailable, progress can
+  stop. Fix: permit any caller.
+- Offchain cron/keeper as the only caller: service outage, depleted gas funds,
+  expired key, or a missed schedule stalls it. Fix: permissionless fallback;
+  use monitoring only as backup.
+- Upgrade/admin key required for ordinary operation: key loss or signer
+  unavailability blocks the circle. Fix: remove it from the happy path; use a
+  multisig only for a deliberately accepted emergency control.
+- A current recipient who defaults: an unspecified contract may either pay a
+  defaulter or lock. Fix: encode the skip-and-next-eligible rule above.
+
+## Before leaving: go/no-go checklist
+
+1. Confirm each live circle's verified address/code has permissionless
+   settlement, a deadline/default path, and enough escrowed collateral for all
+   remaining obligations. If any fails, notify members and arrange an operator
+   or pause new commitments; it is not autonomous.
+2. Make one test settlement and one deadline/default settlement on a testnet or
+   fork, including a member who already received and then defaults. Verify the
+   recipient receives exactly `1200e6` USDC in both cases.
+3. Fuzz the 12-period state machine; test duplicate payments, default on the
+   scheduled turn, multiple defaults, recipient disappearance, USDC's 6-decimal
+   math, and unauthorized/early calls. Get an independent security review
+   before holding real funds.
+4. Verify source on the block explorer; publish the address, ABI, schedule,
+   exact `settleCurrentPeriod` instructions, and a backup UI/block-explorer
+   path to every member.
+5. Fund and test an optional public keeper for two periods, monitor events and
+   failures, but verify a separate wallet can settle even with the keeper off.
+   Put any emergency multisig keys with available signers before departure.
+
+This produces a protocol that can progress without its builders, but it cannot
+make absent members pay. It converts that unavoidable behavior into an
+already-funded, deterministic default outcome.

diff --git a/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..22cb0b3ffaa50c849256e43334ffc218b441802a
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,157 @@
+# Susu circle: unattended-operation plan
+
+## Bottom line
+
+The circle can run while both builders are away **only if every monthly state
+transition is permissionless and the circle is collateralized**. A deployed
+contract does not wake up, collect USDC, detect a default, or send a payout on
+its own. Someone must submit each transaction and pay gas.
+
+I cannot certify that circles already running have those properties from this
+directory; no deployed-contract address, source, or operations configuration is
+present. Treat an existing circle as **not six-week-safe** until the checks
+below pass. A design where an owner/admin calls `advanceMonth`, or where a
+missed $100 is expected to be covered by installments already paid to prior
+recipients, will break.
+
+## Recommended MVP: one immutable Circle contract per group
+
+Use one non-upgradeable `SusuCircle` instance for a 12-member circle. It holds
+the canonical USDC for the chosen chain (USDC has 6 decimals: `100e6` per
+installment and `1200e6` per period), the ordered member list, the start time,
+the 30-day periods, payment deadline, and accounting. No factory is needed for
+the first circle; deploy another instance when another group is created.
+
+Onchain:
+
+- fixed, unique list of 12 member addresses and their payout addresses;
+- the fixed order, period number, due/deadline timestamps, payment/default
+  status, remaining collateral, and whether each member has received;
+- USDC escrow, collection, default coverage, and payout;
+- events for join/fund/default/settle/payout/collateral withdrawal.
+
+Offchain:
+
+- member identity, invitations, reminders, support, and the event-indexed UI;
+- optional monitoring/keeper service. It may submit transactions, but must not
+  be required for the protocol to work.
+
+Use OpenZeppelin `SafeERC20` and `ReentrancyGuard`; make the USDC address,
+member set, amounts, order, and timing immutable. Reject duplicate/zero
+members, wrong amounts, late/duplicate payments, and non-canonical tokens.
+There must be no owner-only withdrawal, no admin-only settlement, and no
+upgrade key controlling member funds. An emergency pause is a trade-off: it can
+protect against a discovered exploit, but makes the circle dependent on the
+signers. For this MVP, prefer audited immutable code over an admin pause. If a
+pause is required, put it behind a 2-of-3 multisig, publish the signers, and
+accept that a pause can halt six-week operation.
+
+## Solvency rule: the requested default behavior needs collateral
+
+At the beginning of a normal month, the twelve $100 payments make the $1,200
+pot. But a member's earlier payments have already been transferred to earlier
+recipients; they are not still in the contract. So they cannot fill a later
+shortfall. This is a balance-sheet impossibility, not a Solidity problem.
+
+Require every member to lock a security deposit of `12 * $100 = $1,200` USDC
+at activation. They still make the normal monthly $100 payment. After each
+timely payment, $100 of that member's collateral becomes withdrawable (or is
+returned in the same transaction). Thus a compliant member's net contribution
+is still $1,200, but they must have $1,200 of temporary capital available at
+the start.
+
+If a member misses a period, the contract takes that period's $100 from their
+still-locked collateral and marks them defaulted. It retains the rest to cover
+every future $100 they owe. That makes every remaining $1,200 monthly pot
+solvent even if the defaulter has already received their payout. The defaulter
+loses any unpaid turn; if they were due in the defaulted period, their slot is
+skipped and the next eligible member in the original order receives that
+period's pot. Record this rule explicitly in the member agreement: later
+eligible members can receive earlier when a defaulted slot is skipped.
+
+If the group will not accept $1,200 collateral, the honest alternative is not a
+guaranteed susu: a default can reduce/delay payouts and needs an agreed
+shortfall allocation. Do not promise the stated guarantee in that version.
+
+## State machine and callers
+
+`activate()` — each proposed member deposits their $1,200 collateral; the
+circle begins only after all 12 have funded. Any member calls it. If not fully
+funded by a setup deadline, each depositor can withdraw and the circle never
+starts.
+
+`payCurrentPeriod()` — an active member transfers exactly $100 USDC before the
+deadline. The caller is the paying member; they do it to remain eligible and
+unlock $100 of collateral. A UX may first request a limited approval for this
+circle, never an infinite approval.
+
+`settleCurrentPeriod()` — **any address** may call once all payments arrive or
+the deadline passes. On deadline, it marks non-payers defaulted and transfers
+$100 per non-payer from their locked collateral into the pot. It then pays
+exactly $1,200 to the next active unpaid member in the fixed order and advances
+one period. This must be atomic: either default accounting and payout both
+happen, or neither does. With only 12 members, bounded iteration over the list
+is acceptable.
+
+`withdrawReleasedCollateral()` — a compliant member withdraws only collateral
+made available by their timely payment; after the final settlement, remaining
+released amounts are claimable. A defaulted member cannot withdraw collateral
+reserved for their missed/future installments.
+
+`close()` — after 12 settlements and all payouts, permit final claims and make
+the contract inert. There is no discretionary treasury sweep.
+
+The normal recipient is already motivated to call `settleCurrentPeriod`, as are
+later recipients who need the circle to progress. Add a small fixed keeper
+reward only if testing shows this is insufficient; fund it explicitly rather
+than silently reducing the $1,200 payout. A public bot/automation service can
+be a backup, but any account must always be able to settle directly.
+
+## What six weeks away does and does not require
+
+It does **not** require either builder to be online when the deployed code has
+the rules above. A member, recipient, friend, or bot can settle the month;
+members must still ensure their wallets have USDC and submit their own payment
+transactions. Even a token approval cannot force a wallet to keep a balance or
+to leave its approval in place.
+
+It **does** break without those properties:
+
+- Admin-only month advancement: the current period stays open; payout, default
+  handling, and all later periods stop. Fix: permissionless `settleCurrentPeriod`.
+- No collateral/reserve: one missed payment leaves only $1,100. Fix: the locked
+  remaining-obligation collateral above, or weaken the payout guarantee.
+- Recipient-only settlement: if that recipient is unavailable, progress can
+  stop. Fix: permit any caller.
+- Offchain cron/keeper as the only caller: service outage, depleted gas funds,
+  expired key, or a missed schedule stalls it. Fix: permissionless fallback;
+  use monitoring only as backup.
+- Upgrade/admin key required for ordinary operation: key loss or signer
+  unavailability blocks the circle. Fix: remove it from the happy path; use a
+  multisig only for a deliberately accepted emergency control.
+- A current recipient who defaults: an unspecified contract may either pay a
+  defaulter or lock. Fix: encode the skip-and-next-eligible rule above.
+
+## Before leaving: go/no-go checklist
+
+1. Confirm each live circle's verified address/code has permissionless
+   settlement, a deadline/default path, and enough escrowed collateral for all
+   remaining obligations. If any fails, notify members and arrange an operator
+   or pause new commitments; it is not autonomous.
+2. Make one test settlement and one deadline/default settlement on a testnet or
+   fork, including a member who already received and then defaults. Verify the
+   recipient receives exactly `1200e6` USDC in both cases.
+3. Fuzz the 12-period state machine; test duplicate payments, default on the
+   scheduled turn, multiple defaults, recipient disappearance, USDC's 6-decimal
+   math, and unauthorized/early calls. Get an independent security review
+   before holding real funds.
+4. Verify source on the block explorer; publish the address, ABI, schedule,
+   exact `settleCurrentPeriod` instructions, and a backup UI/block-explorer
+   path to every member.
+5. Fund and test an optional public keeper for two periods, monitor events and
+   failures, but verify a separate wallet can settle even with the keeper off.
+   Put any emergency multisig keys with available signers before departure.
+
+This produces a protocol that can progress without its builders, but it cannot
+make absent members pay. It converts that unavoidable behavior into an
+already-funded, deterministic default outcome.

codex
The plan is written. I’m doing a final consistency check on the state transitions and unattended-operation claims.
exec
/bin/bash -lc "sed -n '1,320p' plan.md
curl -fsSL --max-time 20 https://ethskills.com/feedback/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace
 succeeded in 0ms:
# Susu circle: unattended-operation plan

## Bottom line

The circle can run while both builders are away **only if every monthly state
transition is permissionless and the circle is collateralized**. A deployed
contract does not wake up, collect USDC, detect a default, or send a payout on
its own. Someone must submit each transaction and pay gas.

I cannot certify that circles already running have those properties from this
directory; no deployed-contract address, source, or operations configuration is
present. Treat an existing circle as **not six-week-safe** until the checks
below pass. A design where an owner/admin calls `advanceMonth`, or where a
missed $100 is expected to be covered by installments already paid to prior
recipients, will break.

## Recommended MVP: one immutable Circle contract per group

Use one non-upgradeable `SusuCircle` instance for a 12-member circle. It holds
the canonical USDC for the chosen chain (USDC has 6 decimals: `100e6` per
installment and `1200e6` per period), the ordered member list, the start time,
the 30-day periods, payment deadline, and accounting. No factory is needed for
the first circle; deploy another instance when another group is created.

Onchain:

- fixed, unique list of 12 member addresses and their payout addresses;
- the fixed order, period number, due/deadline timestamps, payment/default
  status, remaining collateral, and whether each member has received;
- USDC escrow, collection, default coverage, and payout;
- events for join/fund/default/settle/payout/collateral withdrawal.

Offchain:

- member identity, invitations, reminders, support, and the event-indexed UI;
- optional monitoring/keeper service. It may submit transactions, but must not
  be required for the protocol to work.

Use OpenZeppelin `SafeERC20` and `ReentrancyGuard`; make the USDC address,
member set, amounts, order, and timing immutable. Reject duplicate/zero
members, wrong amounts, late/duplicate payments, and non-canonical tokens.
There must be no owner-only withdrawal, no admin-only settlement, and no
upgrade key controlling member funds. An emergency pause is a trade-off: it can
protect against a discovered exploit, but makes the circle dependent on the
signers. For this MVP, prefer audited immutable code over an admin pause. If a
pause is required, put it behind a 2-of-3 multisig, publish the signers, and
accept that a pause can halt six-week operation.

## Solvency rule: the requested default behavior needs collateral

At the beginning of a normal month, the twelve $100 payments make the $1,200
pot. But a member's earlier payments have already been transferred to earlier
recipients; they are not still in the contract. So they cannot fill a later
shortfall. This is a balance-sheet impossibility, not a Solidity problem.

Require every member to lock a security deposit of `12 * $100 = $1,200` USDC
at activation. They still make the normal monthly $100 payment. After each
timely payment, $100 of that member's collateral becomes withdrawable (or is
returned in the same transaction). Thus a compliant member's net contribution
is still $1,200, but they must have $1,200 of temporary capital available at
the start.

If a member misses a period, the contract takes that period's $100 from their
still-locked collateral and marks them defaulted. It retains the rest to cover
every future $100 they owe. That makes every remaining $1,200 monthly pot
solvent even if the defaulter has already received their payout. The defaulter
loses any unpaid turn; if they were due in the defaulted period, their slot is
skipped and the next eligible member in the original order receives that
period's pot. Record this rule explicitly in the member agreement: later
eligible members can receive earlier when a defaulted slot is skipped.

If the group will not accept $1,200 collateral, the honest alternative is not a
guaranteed susu: a default can reduce/delay payouts and needs an agreed
shortfall allocation. Do not promise the stated guarantee in that version.

## State machine and callers

`activate()` — each proposed member deposits their $1,200 collateral; the
circle begins only after all 12 have funded. Any member calls it. If not fully
funded by a setup deadline, each depositor can withdraw and the circle never
starts.

`payCurrentPeriod()` — an active member transfers exactly $100 USDC before the
deadline. The caller is the paying member; they do it to remain eligible and
unlock $100 of collateral. A UX may first request a limited approval for this
circle, never an infinite approval.

`settleCurrentPeriod()` — **any address** may call once all payments arrive or
the deadline passes. On deadline, it marks non-payers defaulted and transfers
$100 per non-payer from their locked collateral into the pot. It then pays
exactly $1,200 to the next active unpaid member in the fixed order and advances
one period. This must be atomic: either default accounting and payout both
happen, or neither does. With only 12 members, bounded iteration over the list
is acceptable.

`withdrawReleasedCollateral()` — a compliant member withdraws only collateral
made available by their timely payment; after the final settlement, remaining
released amounts are claimable. A defaulted member cannot withdraw collateral
reserved for their missed/future installments.

`close()` — after 12 settlements and all payouts, permit final claims and make
the contract inert. There is no discretionary treasury sweep.

The normal recipient is already motivated to call `settleCurrentPeriod`, as are
later recipients who need the circle to progress. Add a small fixed keeper
reward only if testing shows this is insufficient; fund it explicitly rather
than silently reducing the $1,200 payout. A public bot/automation service can
be a backup, but any account must always be able to settle directly.

## What six weeks away does and does not require

It does **not** require either builder to be online when the deployed code has
the rules above. A member, recipient, friend, or bot can settle the month;
members must still ensure their wallets have USDC and submit their own payment
transactions. Even a token approval cannot force a wallet to keep a balance or
to leave its approval in place.

It **does** break without those properties:

- Admin-only month advancement: the current period stays open; payout, default
  handling, and all later periods stop. Fix: permissionless `settleCurrentPeriod`.
- No collateral/reserve: one missed payment leaves only $1,100. Fix: the locked
  remaining-obligation collateral above, or weaken the payout guarantee.
- Recipient-only settlement: if that recipient is unavailable, progress can
  stop. Fix: permit any caller.
- Offchain cron/keeper as the only caller: service outage, depleted gas funds,
  expired key, or a missed schedule stalls it. Fix: permissionless fallback;
  use monitoring only as backup.
- Upgrade/admin key required for ordinary operation: key loss or signer
  unavailability blocks the circle. Fix: remove it from the happy path; use a
  multisig only for a deliberately accepted emergency control.
- A current recipient who defaults: an unspecified contract may either pay a
  defaulter or lock. Fix: encode the skip-and-next-eligible rule above.

## Before leaving: go/no-go checklist

1. Confirm each live circle's verified address/code has permissionless
   settlement, a deadline/default path, and enough escrowed collateral for all
   remaining obligations. If any fails, notify members and arrange an operator
   or pause new commitments; it is not autonomous.
2. Make one test settlement and one deadline/default settlement on a testnet or
   fork, including a member who already received and then defaults. Verify the
   recipient receives exactly `1200e6` USDC in both cases.
3. Fuzz the 12-period state machine; test duplicate payments, default on the
   scheduled turn, multiple defaults, recipient disappearance, USDC's 6-decimal
   math, and unauthorized/early calls. Get an independent security review
   before holding real funds.
4. Verify source on the block explorer; publish the address, ABI, schedule,
   exact `settleCurrentPeriod` instructions, and a backup UI/block-explorer
   path to every member.
5. Fund and test an optional public keeper for two periods, monitor events and
   failures, but verify a separate wallet can settle even with the keeper off.
   Put any emergency multisig keys with available signers before departure.

This produces a protocol that can progress without its builders, but it cannot
make absent members pay. It converts that unavoidable behavior into an
already-funded, deterministic default outcome.
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

diff --git a/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..22cb0b3ffaa50c849256e43334ffc218b441802a
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,157 @@
+# Susu circle: unattended-operation plan
+
+## Bottom line
+
+The circle can run while both builders are away **only if every monthly state
+transition is permissionless and the circle is collateralized**. A deployed
+contract does not wake up, collect USDC, detect a default, or send a payout on
+its own. Someone must submit each transaction and pay gas.
+
+I cannot certify that circles already running have those properties from this
+directory; no deployed-contract address, source, or operations configuration is
+present. Treat an existing circle as **not six-week-safe** until the checks
+below pass. A design where an owner/admin calls `advanceMonth`, or where a
+missed $100 is expected to be covered by installments already paid to prior
+recipients, will break.
+
+## Recommended MVP: one immutable Circle contract per group
+
+Use one non-upgradeable `SusuCircle` instance for a 12-member circle. It holds
+the canonical USDC for the chosen chain (USDC has 6 decimals: `100e6` per
+installment and `1200e6` per period), the ordered member list, the start time,
+the 30-day periods, payment deadline, and accounting. No factory is needed for
+the first circle; deploy another instance when another group is created.
+
+Onchain:
+
+- fixed, unique list of 12 member addresses and their payout addresses;
+- the fixed order, period number, due/deadline timestamps, payment/default
+  status, remaining collateral, and whether each member has received;
+- USDC escrow, collection, default coverage, and payout;
+- events for join/fund/default/settle/payout/collateral withdrawal.
+
+Offchain:
+
+- member identity, invitations, reminders, support, and the event-indexed UI;
+- optional monitoring/keeper service. It may submit transactions, but must not
+  be required for the protocol to work.
+
+Use OpenZeppelin `SafeERC20` and `ReentrancyGuard`; make the USDC address,
+member set, amounts, order, and timing immutable. Reject duplicate/zero
+members, wrong amounts, late/duplicate payments, and non-canonical tokens.
+There must be no owner-only withdrawal, no admin-only settlement, and no
+upgrade key controlling member funds. An emergency pause is a trade-off: it can
+protect against a discovered exploit, but makes the circle dependent on the
+signers. For this MVP, prefer audited immutable code over an admin pause. If a
+pause is required, put it behind a 2-of-3 multisig, publish the signers, and
+accept that a pause can halt six-week operation.
+
+## Solvency rule: the requested default behavior needs collateral
+
+At the beginning of a normal month, the twelve $100 payments make the $1,200
+pot. But a member's earlier payments have already been transferred to earlier
+recipients; they are not still in the contract. So they cannot fill a later
+shortfall. This is a balance-sheet impossibility, not a Solidity problem.
+
+Require every member to lock a security deposit of `12 * $100 = $1,200` USDC
+at activation. They still make the normal monthly $100 payment. After each
+timely payment, $100 of that member's collateral becomes withdrawable (or is
+returned in the same transaction). Thus a compliant member's net contribution
+is still $1,200, but they must have $1,200 of temporary capital available at
+the start.
+
+If a member misses a period, the contract takes that period's $100 from their
+still-locked collateral and marks them defaulted. It retains the rest to cover
+every future $100 they owe. That makes every remaining $1,200 monthly pot
+solvent even if the defaulter has already received their payout. The defaulter
+loses any unpaid turn; if they were due in the defaulted period, their slot is
+skipped and the next eligible member in the original order receives that
+period's pot. Record this rule explicitly in the member agreement: later
+eligible members can receive earlier when a defaulted slot is skipped.
+
+If the group will not accept $1,200 collateral, the honest alternative is not a
+guaranteed susu: a default can reduce/delay payouts and needs an agreed
+shortfall allocation. Do not promise the stated guarantee in that version.
+
+## State machine and callers
+
+`activate()` — each proposed member deposits their $1,200 collateral; the
+circle begins only after all 12 have funded. Any member calls it. If not fully
+funded by a setup deadline, each depositor can withdraw and the circle never
+starts.
+
+`payCurrentPeriod()` — an active member transfers exactly $100 USDC before the
+deadline. The caller is the paying member; they do it to remain eligible and
+unlock $100 of collateral. A UX may first request a limited approval for this
+circle, never an infinite approval.
+
+`settleCurrentPeriod()` — **any address** may call once all payments arrive or
+the deadline passes. On deadline, it marks non-payers defaulted and transfers
+$100 per non-payer from their locked collateral into the pot. It then pays
+exactly $1,200 to the next active unpaid member in the fixed order and advances
+one period. This must be atomic: either default accounting and payout both
+happen, or neither does. With only 12 members, bounded iteration over the list
+is acceptable.
+
+`withdrawReleasedCollateral()` — a compliant member withdraws only collateral
+made available by their timely payment; after the final settlement, remaining
+released amounts are claimable. A defaulted member cannot withdraw collateral
+reserved for their missed/future installments.
+
+`close()` — after 12 settlements and all payouts, permit final claims and make
+the contract inert. There is no discretionary treasury sweep.
+
+The normal recipient is already motivated to call `settleCurrentPeriod`, as are
+later recipients who need the circle to progress. Add a small fixed keeper
+reward only if testing shows this is insufficient; fund it explicitly rather
+than silently reducing the $1,200 payout. A public bot/automation service can
+be a backup, but any account must always be able to settle directly.
+
+## What six weeks away does and does not require
+
+It does **not** require either builder to be online when the deployed code has
+the rules above. A member, recipient, friend, or bot can settle the month;
+members must still ensure their wallets have USDC and submit their own payment
+transactions. Even a token approval cannot force a wallet to keep a balance or
+to leave its approval in place.
+
+It **does** break without those properties:
+
+- Admin-only month advancement: the current period stays open; payout, default
+  handling, and all later periods stop. Fix: permissionless `settleCurrentPeriod`.
+- No collateral/reserve: one missed payment leaves only $1,100. Fix: the locked
+  remaining-obligation collateral above, or weaken the payout guarantee.
+- Recipient-only settlement: if that recipient is unavailable, progress can
+  stop. Fix: permit any caller.
+- Offchain cron/keeper as the only caller: service outage, depleted gas funds,
+  expired key, or a missed schedule stalls it. Fix: permissionless fallback;
+  use monitoring only as backup.
+- Upgrade/admin key required for ordinary operation: key loss or signer
+  unavailability blocks the circle. Fix: remove it from the happy path; use a
+  multisig only for a deliberately accepted emergency control.
+- A current recipient who defaults: an unspecified contract may either pay a
+  defaulter or lock. Fix: encode the skip-and-next-eligible rule above.
+
+## Before leaving: go/no-go checklist
+
+1. Confirm each live circle's verified address/code has permissionless
+   settlement, a deadline/default path, and enough escrowed collateral for all
+   remaining obligations. If any fails, notify members and arrange an operator
+   or pause new commitments; it is not autonomous.
+2. Make one test settlement and one deadline/default settlement on a testnet or
+   fork, including a member who already received and then defaults. Verify the
+   recipient receives exactly `1200e6` USDC in both cases.
+3. Fuzz the 12-period state machine; test duplicate payments, default on the
+   scheduled turn, multiple defaults, recipient disappearance, USDC's 6-decimal
+   math, and unauthorized/early calls. Get an independent security review
+   before holding real funds.
+4. Verify source on the block explorer; publish the address, ABI, schedule,
+   exact `settleCurrentPeriod` instructions, and a backup UI/block-explorer
+   path to every member.
+5. Fund and test an optional public keeper for two periods, monitor events and
+   failures, but verify a separate wallet can settle even with the keeper off.
+   Put any emergency multisig keys with available signers before departure.
+
+This produces a protocol that can progress without its builders, but it cannot
+make absent members pay. It converts that unavoidable behavior into an
+already-funded, deterministic default outcome.

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
diff --git a/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..503bc9984efa1b12b91c9007a1a4bdbcd2903ab0
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,168 @@
+# Susu circle: unattended-operation plan
+
+## Bottom line
+
+The circle can run while both builders are away **only if every monthly state
+transition is permissionless and the circle is collateralized**. A deployed
+contract does not wake up, collect USDC, detect a default, or send a payout on
+its own. Someone must submit each transaction and pay gas.
+
+I cannot certify that circles already running have those properties from this
+directory; no deployed-contract address, source, or operations configuration is
+present. Treat an existing circle as **not six-week-safe** until the checks
+below pass. A design where an owner/admin calls `advanceMonth`, or where a
+missed $100 is expected to be covered by installments already paid to prior
+recipients, will break.
+
+## Recommended MVP: one immutable Circle contract per group
+
+Use one non-upgradeable `SusuCircle` instance for a 12-member circle. It holds
+the canonical USDC for the chosen chain (USDC has 6 decimals: `100e6` per
+installment and `1200e6` per period), the ordered member list, the start time,
+the 30-day periods, payment deadline, and accounting. No factory is needed for
+the first circle; deploy another instance when another group is created.
+
+Onchain:
+
+- fixed, unique list of 12 member addresses and their payout addresses;
+- the fixed order, period number, due/deadline timestamps, payment/default
+  status, remaining collateral, and whether each member has received;
+- USDC escrow, collection, default coverage, and payout;
+- events for join/fund/default/settle/payout/collateral withdrawal.
+
+Offchain:
+
+- member identity, invitations, reminders, support, and the event-indexed UI;
+- optional monitoring/keeper service. It may submit transactions, but must not
+  be required for the protocol to work.
+
+Use OpenZeppelin `SafeERC20` and `ReentrancyGuard`; make the USDC address,
+member set, amounts, order, and timing immutable. Reject duplicate/zero
+members, wrong amounts, late/duplicate payments, and non-canonical tokens.
+There must be no owner-only withdrawal, no admin-only settlement, and no
+upgrade key controlling member funds. An emergency pause is a trade-off: it can
+protect against a discovered exploit, but makes the circle dependent on the
+signers. For this MVP, prefer audited immutable code over an admin pause. If a
+pause is required, put it behind a 2-of-3 multisig, publish the signers, and
+accept that a pause can halt six-week operation.
+
+## Solvency rule: the requested default behavior needs collateral
+
+At the beginning of a normal month, the twelve $100 payments make the $1,200
+pot. But a member's earlier payments have already been transferred to earlier
+recipients; they are not still in the contract. So they cannot fill a later
+shortfall. This is a balance-sheet impossibility, not a Solidity problem.
+
+Require every member to lock a security deposit of `12 * $100 = $1,200` USDC
+at activation. They still make the normal monthly $100 payment. After each
+timely payment, $100 of that member's collateral becomes withdrawable (or is
+returned in the same transaction). Thus a compliant member's net contribution
+is still $1,200, but they must have $1,200 of temporary capital available at
+the start.
+
+If a member misses a period, the contract takes that period's $100 from their
+still-locked collateral and marks them defaulted. It retains the rest to cover
+every future $100 they owe. That makes every remaining $1,200 monthly pot
+solvent even if the defaulter has already received their payout. A member who
+has already been paid cannot lose that past payout; defaulting instead consumes
+their collateral for their remaining obligations.
+
+For a member who has not yet been paid, define the exception to the fixed order
+precisely: skip their slot and pay the next eligible, unpaid member in the
+original order. When every eligible member has had one payout, close the circle
+early; do not manufacture a final twelfth recipient or ask for an unnecessary
+twelfth payment. Return normal released collateral, then distribute residual
+seized collateral from unpaid/defaulted members equally (or by a stated formula)
+among timely members. This is the cleanest treatment of the forfeited turn.
+Without this explicit close-and-surplus rule, skipping a recipient creates an
+unallocated final $1,200 pot. It is a product decision that must be agreed in
+the member terms before deployment.
+
+If the group will not accept $1,200 collateral, the honest alternative is not a
+guaranteed susu: a default can reduce/delay payouts and needs an agreed
+shortfall allocation. Do not promise the stated guarantee in that version.
+
+## State machine and callers
+
+`activate()` — each proposed member deposits their $1,200 collateral; the
+circle begins only after all 12 have funded. Any member calls it. If not fully
+funded by a setup deadline, each depositor can withdraw and the circle never
+starts.
+
+`payCurrentPeriod()` — an active member transfers exactly $100 USDC before the
+deadline. The caller is the paying member; they do it to remain eligible and
+unlock $100 of collateral. A UX may first request a limited approval for this
+circle, never an infinite approval.
+
+`settleCurrentPeriod()` — **any address** may call once all payments arrive or
+the deadline passes. On deadline, it marks non-payers defaulted and transfers
+$100 per non-payer from their locked collateral into the pot. It then pays
+exactly $1,200 to the next active unpaid member in the fixed order and advances
+one period. This must be atomic: either default accounting and payout both
+happen, or neither does. With only 12 members, bounded iteration over the list
+is acceptable.
+
+`withdrawReleasedCollateral()` — a compliant member withdraws only collateral
+made available by their timely payment; after the final settlement, remaining
+released amounts are claimable. A defaulted member cannot withdraw collateral
+reserved for their missed/future installments.
+
+`close()` — after all eligible members have received one payout (normally 12
+settlements; fewer only when an unpaid member forfeits a future turn), release
+normal collateral and distribute any forfeited residual by the stated formula,
+then make the contract inert. There is no discretionary treasury sweep.
+
+The normal recipient is already motivated to call `settleCurrentPeriod`, as are
+later recipients who need the circle to progress. Add a small fixed keeper
+reward only if testing shows this is insufficient; fund it explicitly rather
+than silently reducing the $1,200 payout. A public bot/automation service can
+be a backup, but any account must always be able to settle directly.
+
+## What six weeks away does and does not require
+
+It does **not** require either builder to be online when the deployed code has
+the rules above. A member, recipient, friend, or bot can settle the month;
+members must still ensure their wallets have USDC and submit their own payment
+transactions. Even a token approval cannot force a wallet to keep a balance or
+to leave its approval in place.
+
+It **does** break without those properties:
+
+- Admin-only month advancement: the current period stays open; payout, default
+  handling, and all later periods stop. Fix: permissionless `settleCurrentPeriod`.
+- No collateral/reserve: one missed payment leaves only $1,100. Fix: the locked
+  remaining-obligation collateral above, or weaken the payout guarantee.
+- Recipient-only settlement: if that recipient is unavailable, progress can
+  stop. Fix: permit any caller.
+- Offchain cron/keeper as the only caller: service outage, depleted gas funds,
+  expired key, or a missed schedule stalls it. Fix: permissionless fallback;
+  use monitoring only as backup.
+- Upgrade/admin key required for ordinary operation: key loss or signer
+  unavailability blocks the circle. Fix: remove it from the happy path; use a
+  multisig only for a deliberately accepted emergency control.
+- A current recipient who defaults: an unspecified contract may either pay a
+  defaulter or lock. Fix: encode the skip-and-next-eligible rule above.
+
+## Before leaving: go/no-go checklist
+
+1. Confirm each live circle's verified address/code has permissionless
+   settlement, a deadline/default path, and enough escrowed collateral for all
+   remaining obligations. If any fails, notify members and arrange an operator
+   or pause new commitments; it is not autonomous.
+2. Make one test settlement and one deadline/default settlement on a testnet or
+   fork, including a member who already received and then defaults. Verify the
+   recipient receives exactly `1200e6` USDC in both cases.
+3. Fuzz the 12-period state machine; test duplicate payments, default on the
+   scheduled turn, multiple defaults, recipient disappearance, USDC's 6-decimal
+   math, and unauthorized/early calls. Get an independent security review
+   before holding real funds.
+4. Verify source on the block explorer; publish the address, ABI, schedule,
+   exact `settleCurrentPeriod` instructions, and a backup UI/block-explorer
+   path to every member.
+5. Fund and test an optional public keeper for two periods, monitor events and
+   failures, but verify a separate wallet can settle even with the keeper off.
+   Put any emergency multisig keys with available signers before departure.
+
+This produces a protocol that can progress without its builders, but it cannot
+make absent members pay. It converts that unavoidable behavior into an
+already-funded, deterministic default outcome.

diff --git a/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..503bc9984efa1b12b91c9007a1a4bdbcd2903ab0
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,168 @@
+# Susu circle: unattended-operation plan
+
+## Bottom line
+
+The circle can run while both builders are away **only if every monthly state
+transition is permissionless and the circle is collateralized**. A deployed
+contract does not wake up, collect USDC, detect a default, or send a payout on
+its own. Someone must submit each transaction and pay gas.
+
+I cannot certify that circles already running have those properties from this
+directory; no deployed-contract address, source, or operations configuration is
+present. Treat an existing circle as **not six-week-safe** until the checks
+below pass. A design where an owner/admin calls `advanceMonth`, or where a
+missed $100 is expected to be covered by installments already paid to prior
+recipients, will break.
+
+## Recommended MVP: one immutable Circle contract per group
+
+Use one non-upgradeable `SusuCircle` instance for a 12-member circle. It holds
+the canonical USDC for the chosen chain (USDC has 6 decimals: `100e6` per
+installment and `1200e6` per period), the ordered member list, the start time,
+the 30-day periods, payment deadline, and accounting. No factory is needed for
+the first circle; deploy another instance when another group is created.
+
+Onchain:
+
+- fixed, unique list of 12 member addresses and their payout addresses;
+- the fixed order, period number, due/deadline timestamps, payment/default
+  status, remaining collateral, and whether each member has received;
+- USDC escrow, collection, default coverage, and payout;
+- events for join/fund/default/settle/payout/collateral withdrawal.
+
+Offchain:
+
+- member identity, invitations, reminders, support, and the event-indexed UI;
+- optional monitoring/keeper service. It may submit transactions, but must not
+  be required for the protocol to work.
+
+Use OpenZeppelin `SafeERC20` and `ReentrancyGuard`; make the USDC address,
+member set, amounts, order, and timing immutable. Reject duplicate/zero
+members, wrong amounts, late/duplicate payments, and non-canonical tokens.
+There must be no owner-only withdrawal, no admin-only settlement, and no
+upgrade key controlling member funds. An emergency pause is a trade-off: it can
+protect against a discovered exploit, but makes the circle dependent on the
+signers. For this MVP, prefer audited immutable code over an admin pause. If a
+pause is required, put it behind a 2-of-3 multisig, publish the signers, and
+accept that a pause can halt six-week operation.
+
+## Solvency rule: the requested default behavior needs collateral
+
+At the beginning of a normal month, the twelve $100 payments make the $1,200
+pot. But a member's earlier payments have already been transferred to earlier
+recipients; they are not still in the contract. So they cannot fill a later
+shortfall. This is a balance-sheet impossibility, not a Solidity problem.
+
+Require every member to lock a security deposit of `12 * $100 = $1,200` USDC
+at activation. They still make the normal monthly $100 payment. After each
+timely payment, $100 of that member's collateral becomes withdrawable (or is
+returned in the same transaction). Thus a compliant member's net contribution
+is still $1,200, but they must have $1,200 of temporary capital available at
+the start.
+
+If a member misses a period, the contract takes that period's $100 from their
+still-locked collateral and marks them defaulted. It retains the rest to cover
+every future $100 they owe. That makes every remaining $1,200 monthly pot
+solvent even if the defaulter has already received their payout. A member who
+has already been paid cannot lose that past payout; defaulting instead consumes
+their collateral for their remaining obligations.
+
+For a member who has not yet been paid, define the exception to the fixed order
+precisely: skip their slot and pay the next eligible, unpaid member in the
+original order. When every eligible member has had one payout, close the circle
+early; do not manufacture a final twelfth recipient or ask for an unnecessary
+twelfth payment. Return normal released collateral, then distribute residual
+seized collateral from unpaid/defaulted members equally (or by a stated formula)
+among timely members. This is the cleanest treatment of the forfeited turn.
+Without this explicit close-and-surplus rule, skipping a recipient creates an
+unallocated final $1,200 pot. It is a product decision that must be agreed in
+the member terms before deployment.
+
+If the group will not accept $1,200 collateral, the honest alternative is not a
+guaranteed susu: a default can reduce/delay payouts and needs an agreed
+shortfall allocation. Do not promise the stated guarantee in that version.
+
+## State machine and callers
+
+`activate()` — each proposed member deposits their $1,200 collateral; the
+circle begins only after all 12 have funded. Any member calls it. If not fully
+funded by a setup deadline, each depositor can withdraw and the circle never
+starts.
+
+`payCurrentPeriod()` — an active member transfers exactly $100 USDC before the
+deadline. The caller is the paying member; they do it to remain eligible and
+unlock $100 of collateral. A UX may first request a limited approval for this
+circle, never an infinite approval.
+
+`settleCurrentPeriod()` — **any address** may call once all payments arrive or
+the deadline passes. On deadline, it marks non-payers defaulted and transfers
+$100 per non-payer from their locked collateral into the pot. It then pays
+exactly $1,200 to the next active unpaid member in the fixed order and advances
+one period. This must be atomic: either default accounting and payout both
+happen, or neither does. With only 12 members, bounded iteration over the list
+is acceptable.
+
+`withdrawReleasedCollateral()` — a compliant member withdraws only collateral
+made available by their timely payment; after the final settlement, remaining
+released amounts are claimable. A defaulted member cannot withdraw collateral
+reserved for their missed/future installments.
+
+`close()` — after all eligible members have received one payout (normally 12
+settlements; fewer only when an unpaid member forfeits a future turn), release
+normal collateral and distribute any forfeited residual by the stated formula,
+then make the contract inert. There is no discretionary treasury sweep.
+
+The normal recipient is already motivated to call `settleCurrentPeriod`, as are
+later recipients who need the circle to progress. Add a small fixed keeper
+reward only if testing shows this is insufficient; fund it explicitly rather
+than silently reducing the $1,200 payout. A public bot/automation service can
+be a backup, but any account must always be able to settle directly.
+
+## What six weeks away does and does not require
+
+It does **not** require either builder to be online when the deployed code has
+the rules above. A member, recipient, friend, or bot can settle the month;
+members must still ensure their wallets have USDC and submit their own payment
+transactions. Even a token approval cannot force a wallet to keep a balance or
+to leave its approval in place.
+
+It **does** break without those properties:
+
+- Admin-only month advancement: the current period stays open; payout, default
+  handling, and all later periods stop. Fix: permissionless `settleCurrentPeriod`.
+- No collateral/reserve: one missed payment leaves only $1,100. Fix: the locked
+  remaining-obligation collateral above, or weaken the payout guarantee.
+- Recipient-only settlement: if that recipient is unavailable, progress can
+  stop. Fix: permit any caller.
+- Offchain cron/keeper as the only caller: service outage, depleted gas funds,
+  expired key, or a missed schedule stalls it. Fix: permissionless fallback;
+  use monitoring only as backup.
+- Upgrade/admin key required for ordinary operation: key loss or signer
+  unavailability blocks the circle. Fix: remove it from the happy path; use a
+  multisig only for a deliberately accepted emergency control.
+- A current recipient who defaults: an unspecified contract may either pay a
+  defaulter or lock. Fix: encode the skip-and-next-eligible rule above.
+
+## Before leaving: go/no-go checklist
+
+1. Confirm each live circle's verified address/code has permissionless
+   settlement, a deadline/default path, and enough escrowed collateral for all
+   remaining obligations. If any fails, notify members and arrange an operator
+   or pause new commitments; it is not autonomous.
+2. Make one test settlement and one deadline/default settlement on a testnet or
+   fork, including a member who already received and then defaults. Verify the
+   recipient receives exactly `1200e6` USDC in both cases.
+3. Fuzz the 12-period state machine; test duplicate payments, default on the
+   scheduled turn, multiple defaults, recipient disappearance, USDC's 6-decimal
+   math, and unauthorized/early calls. Get an independent security review
+   before holding real funds.
+4. Verify source on the block explorer; publish the address, ABI, schedule,
+   exact `settleCurrentPeriod` instructions, and a backup UI/block-explorer
+   path to every member.
+5. Fund and test an optional public keeper for two periods, monitor events and
+   failures, but verify a separate wallet can settle even with the keeper off.
+   Put any emergency multisig keys with available signers before departure.
+
+This produces a protocol that can progress without its builders, but it cannot
+make absent members pay. It converts that unavoidable behavior into an
+already-funded, deterministic default outcome.

exec
/bin/bash -lc 'git diff --check && git diff -- plan.md' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace
 succeeded in 0ms:
diff --git a/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..503bc9984efa1b12b91c9007a1a4bdbcd2903ab0
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,168 @@
+# Susu circle: unattended-operation plan
+
+## Bottom line
+
+The circle can run while both builders are away **only if every monthly state
+transition is permissionless and the circle is collateralized**. A deployed
+contract does not wake up, collect USDC, detect a default, or send a payout on
+its own. Someone must submit each transaction and pay gas.
+
+I cannot certify that circles already running have those properties from this
+directory; no deployed-contract address, source, or operations configuration is
+present. Treat an existing circle as **not six-week-safe** until the checks
+below pass. A design where an owner/admin calls `advanceMonth`, or where a
+missed $100 is expected to be covered by installments already paid to prior
+recipients, will break.
+
+## Recommended MVP: one immutable Circle contract per group
+
+Use one non-upgradeable `SusuCircle` instance for a 12-member circle. It holds
+the canonical USDC for the chosen chain (USDC has 6 decimals: `100e6` per
+installment and `1200e6` per period), the ordered member list, the start time,
+the 30-day periods, payment deadline, and accounting. No factory is needed for
+the first circle; deploy another instance when another group is created.
+
+Onchain:
+
+- fixed, unique list of 12 member addresses and their payout addresses;
+- the fixed order, period number, due/deadline timestamps, payment/default
+  status, remaining collateral, and whether each member has received;
+- USDC escrow, collection, default coverage, and payout;
+- events for join/fund/default/settle/payout/collateral withdrawal.
+
+Offchain:
+
+- member identity, invitations, reminders, support, and the event-indexed UI;
+- optional monitoring/keeper service. It may submit transactions, but must not
+  be required for the protocol to work.
+
+Use OpenZeppelin `SafeERC20` and `ReentrancyGuard`; make the USDC address,
+member set, amounts, order, and timing immutable. Reject duplicate/zero
+members, wrong amounts, late/duplicate payments, and non-canonical tokens.
+There must be no owner-only withdrawal, no admin-only settlement, and no
+upgrade key controlling member funds. An emergency pause is a trade-off: it can
+protect against a discovered exploit, but makes the circle dependent on the
+signers. For this MVP, prefer audited immutable code over an admin pause. If a
+pause is required, put it behind a 2-of-3 multisig, publish the signers, and
+accept that a pause can halt six-week operation.
+
+## Solvency rule: the requested default behavior needs collateral
+
+At the beginning of a normal month, the twelve $100 payments make the $1,200
+pot. But a member's earlier payments have already been transferred to earlier
+recipients; they are not still in the contract. So they cannot fill a later
+shortfall. This is a balance-sheet impossibility, not a Solidity problem.
+
+Require every member to lock a security deposit of `12 * $100 = $1,200` USDC
+at activation. They still make the normal monthly $100 payment. After each
+timely payment, $100 of that member's collateral becomes withdrawable (or is
+returned in the same transaction). Thus a compliant member's net contribution
+is still $1,200, but they must have $1,200 of temporary capital available at
+the start.
+
+If a member misses a period, the contract takes that period's $100 from their
+still-locked collateral and marks them defaulted. It retains the rest to cover
+every future $100 they owe. That makes every remaining $1,200 monthly pot
+solvent even if the defaulter has already received their payout. A member who
+has already been paid cannot lose that past payout; defaulting instead consumes
+their collateral for their remaining obligations.
+
+For a member who has not yet been paid, define the exception to the fixed order
+precisely: skip their slot and pay the next eligible, unpaid member in the
+original order. When every eligible member has had one payout, close the circle
+early; do not manufacture a final twelfth recipient or ask for an unnecessary
+twelfth payment. Return normal released collateral, then distribute residual
+seized collateral from unpaid/defaulted members equally (or by a stated formula)
+among timely members. This is the cleanest treatment of the forfeited turn.
+Without this explicit close-and-surplus rule, skipping a recipient creates an
+unallocated final $1,200 pot. It is a product decision that must be agreed in
+the member terms before deployment.
+
+If the group will not accept $1,200 collateral, the honest alternative is not a
+guaranteed susu: a default can reduce/delay payouts and needs an agreed
+shortfall allocation. Do not promise the stated guarantee in that version.
+
+## State machine and callers
+
+`activate()` — each proposed member deposits their $1,200 collateral; the
+circle begins only after all 12 have funded. Any member calls it. If not fully
+funded by a setup deadline, each depositor can withdraw and the circle never
+starts.
+
+`payCurrentPeriod()` — an active member transfers exactly $100 USDC before the
+deadline. The caller is the paying member; they do it to remain eligible and
+unlock $100 of collateral. A UX may first request a limited approval for this
+circle, never an infinite approval.
+
+`settleCurrentPeriod()` — **any address** may call once all payments arrive or
+the deadline passes. On deadline, it marks non-payers defaulted and transfers
+$100 per non-payer from their locked collateral into the pot. It then pays
+exactly $1,200 to the next active unpaid member in the fixed order and advances
+one period. This must be atomic: either default accounting and payout both
+happen, or neither does. With only 12 members, bounded iteration over the list
+is acceptable.
+
+`withdrawReleasedCollateral()` — a compliant member withdraws only collateral
+made available by their timely payment; after the final settlement, remaining
+released amounts are claimable. A defaulted member cannot withdraw collateral
+reserved for their missed/future installments.
+
+`close()` — after all eligible members have received one payout (normally 12
+settlements; fewer only when an unpaid member forfeits a future turn), release
+normal collateral and distribute any forfeited residual by the stated formula,
+then make the contract inert. There is no discretionary treasury sweep.
+
+The normal recipient is already motivated to call `settleCurrentPeriod`, as are
+later recipients who need the circle to progress. Add a small fixed keeper
+reward only if testing shows this is insufficient; fund it explicitly rather
+than silently reducing the $1,200 payout. A public bot/automation service can
+be a backup, but any account must always be able to settle directly.
+
+## What six weeks away does and does not require
+
+It does **not** require either builder to be online when the deployed code has
+the rules above. A member, recipient, friend, or bot can settle the month;
+members must still ensure their wallets have USDC and submit their own payment
+transactions. Even a token approval cannot force a wallet to keep a balance or
+to leave its approval in place.
+
+It **does** break without those properties:
+
+- Admin-only month advancement: the current period stays open; payout, default
+  handling, and all later periods stop. Fix: permissionless `settleCurrentPeriod`.
+- No collateral/reserve: one missed payment leaves only $1,100. Fix: the locked
+  remaining-obligation collateral above, or weaken the payout guarantee.
+- Recipient-only settlement: if that recipient is unavailable, progress can
+  stop. Fix: permit any caller.
+- Offchain cron/keeper as the only caller: service outage, depleted gas funds,
+  expired key, or a missed schedule stalls it. Fix: permissionless fallback;
+  use monitoring only as backup.
+- Upgrade/admin key required for ordinary operation: key loss or signer
+  unavailability blocks the circle. Fix: remove it from the happy path; use a
+  multisig only for a deliberately accepted emergency control.
+- A current recipient who defaults: an unspecified contract may either pay a
+  defaulter or lock. Fix: encode the skip-and-next-eligible rule above.
+
+## Before leaving: go/no-go checklist
+
+1. Confirm each live circle's verified address/code has permissionless
+   settlement, a deadline/default path, and enough escrowed collateral for all
+   remaining obligations. If any fails, notify members and arrange an operator
+   or pause new commitments; it is not autonomous.
+2. Make one test settlement and one deadline/default settlement on a testnet or
+   fork, including a member who already received and then defaults. Verify the
+   recipient receives exactly `1200e6` USDC in both cases.
+3. Fuzz the 12-period state machine; test duplicate payments, default on the
+   scheduled turn, multiple defaults, recipient disappearance, USDC's 6-decimal
+   math, and unauthorized/early calls. Get an independent security review
+   before holding real funds.
+4. Verify source on the block explorer; publish the address, ABI, schedule,
+   exact `settleCurrentPeriod` instructions, and a backup UI/block-explorer
+   path to every member.
+5. Fund and test an optional public keeper for two periods, monitor events and
+   failures, but verify a separate wallet can settle even with the keeper off.
+   Put any emergency multisig keys with available signers before departure.
+
+This produces a protocol that can progress without its builders, but it cannot
+make absent members pay. It converts that unavoidable behavior into an
+already-funded, deterministic default outcome.

codex
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md).

Key answer: unattended works only with permissionless settlement + default collateral. Existing circles can’t be certified from this workspace.

May I send this skill feedback?

`praise: concepts/SKILL.md’s no-cron state-transition audit exposed the decisive unattended-operation risk in an onchain savings-circle design.`
diff --git a/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..503bc9984efa1b12b91c9007a1a4bdbcd2903ab0
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,168 @@
+# Susu circle: unattended-operation plan
+
+## Bottom line
+
+The circle can run while both builders are away **only if every monthly state
+transition is permissionless and the circle is collateralized**. A deployed
+contract does not wake up, collect USDC, detect a default, or send a payout on
+its own. Someone must submit each transaction and pay gas.
+
+I cannot certify that circles already running have those properties from this
+directory; no deployed-contract address, source, or operations configuration is
+present. Treat an existing circle as **not six-week-safe** until the checks
+below pass. A design where an owner/admin calls `advanceMonth`, or where a
+missed $100 is expected to be covered by installments already paid to prior
+recipients, will break.
+
+## Recommended MVP: one immutable Circle contract per group
+
+Use one non-upgradeable `SusuCircle` instance for a 12-member circle. It holds
+the canonical USDC for the chosen chain (USDC has 6 decimals: `100e6` per
+installment and `1200e6` per period), the ordered member list, the start time,
+the 30-day periods, payment deadline, and accounting. No factory is needed for
+the first circle; deploy another instance when another group is created.
+
+Onchain:
+
+- fixed, unique list of 12 member addresses and their payout addresses;
+- the fixed order, period number, due/deadline timestamps, payment/default
+  status, remaining collateral, and whether each member has received;
+- USDC escrow, collection, default coverage, and payout;
+- events for join/fund/default/settle/payout/collateral withdrawal.
+
+Offchain:
+
+- member identity, invitations, reminders, support, and the event-indexed UI;
+- optional monitoring/keeper service. It may submit transactions, but must not
+  be required for the protocol to work.
+
+Use OpenZeppelin `SafeERC20` and `ReentrancyGuard`; make the USDC address,
+member set, amounts, order, and timing immutable. Reject duplicate/zero
+members, wrong amounts, late/duplicate payments, and non-canonical tokens.
+There must be no owner-only withdrawal, no admin-only settlement, and no
+upgrade key controlling member funds. An emergency pause is a trade-off: it can
+protect against a discovered exploit, but makes the circle dependent on the
+signers. For this MVP, prefer audited immutable code over an admin pause. If a
+pause is required, put it behind a 2-of-3 multisig, publish the signers, and
+accept that a pause can halt six-week operation.
+
+## Solvency rule: the requested default behavior needs collateral
+
+At the beginning of a normal month, the twelve $100 payments make the $1,200
+pot. But a member's earlier payments have already been transferred to earlier
+recipients; they are not still in the contract. So they cannot fill a later
+shortfall. This is a balance-sheet impossibility, not a Solidity problem.
+
+Require every member to lock a security deposit of `12 * $100 = $1,200` USDC
+at activation. They still make the normal monthly $100 payment. After each
+timely payment, $100 of that member's collateral becomes withdrawable (or is
+returned in the same transaction). Thus a compliant member's net contribution
+is still $1,200, but they must have $1,200 of temporary capital available at
+the start.
+
+If a member misses a period, the contract takes that period's $100 from their
+still-locked collateral and marks them defaulted. It retains the rest to cover
+every future $100 they owe. That makes every remaining $1,200 monthly pot
+solvent even if the defaulter has already received their payout. A member who
+has already been paid cannot lose that past payout; defaulting instead consumes
+their collateral for their remaining obligations.
+
+For a member who has not yet been paid, define the exception to the fixed order
+precisely: skip their slot and pay the next eligible, unpaid member in the
+original order. When every eligible member has had one payout, close the circle
+early; do not manufacture a final twelfth recipient or ask for an unnecessary
+twelfth payment. Return normal released collateral, then distribute residual
+seized collateral from unpaid/defaulted members equally (or by a stated formula)
+among timely members. This is the cleanest treatment of the forfeited turn.
+Without this explicit close-and-surplus rule, skipping a recipient creates an
+unallocated final $1,200 pot. It is a product decision that must be agreed in
+the member terms before deployment.
+
+If the group will not accept $1,200 collateral, the honest alternative is not a
+guaranteed susu: a default can reduce/delay payouts and needs an agreed
+shortfall allocation. Do not promise the stated guarantee in that version.
+
+## State machine and callers
+
+`activate()` — each proposed member deposits their $1,200 collateral; the
+circle begins only after all 12 have funded. Any member calls it. If not fully
+funded by a setup deadline, each depositor can withdraw and the circle never
+starts.
+
+`payCurrentPeriod()` — an active member transfers exactly $100 USDC before the
+deadline. The caller is the paying member; they do it to remain eligible and
+unlock $100 of collateral. A UX may first request a limited approval for this
+circle, never an infinite approval.
+
+`settleCurrentPeriod()` — **any address** may call once all payments arrive or
+the deadline passes. On deadline, it marks non-payers defaulted and transfers
+$100 per non-payer from their locked collateral into the pot. It then pays
+exactly $1,200 to the next active unpaid member in the fixed order and advances
+one period. This must be atomic: either default accounting and payout both
+happen, or neither does. With only 12 members, bounded iteration over the list
+is acceptable.
+
+`withdrawReleasedCollateral()` — a compliant member withdraws only collateral
+made available by their timely payment; after the final settlement, remaining
+released amounts are claimable. A defaulted member cannot withdraw collateral
+reserved for their missed/future installments.
+
+`close()` — after all eligible members have received one payout (normally 12
+settlements; fewer only when an unpaid member forfeits a future turn), release
+normal collateral and distribute any forfeited residual by the stated formula,
+then make the contract inert. There is no discretionary treasury sweep.
+
+The normal recipient is already motivated to call `settleCurrentPeriod`, as are
+later recipients who need the circle to progress. Add a small fixed keeper
+reward only if testing shows this is insufficient; fund it explicitly rather
+than silently reducing the $1,200 payout. A public bot/automation service can
+be a backup, but any account must always be able to settle directly.
+
+## What six weeks away does and does not require
+
+It does **not** require either builder to be online when the deployed code has
+the rules above. A member, recipient, friend, or bot can settle the month;
+members must still ensure their wallets have USDC and submit their own payment
+transactions. Even a token approval cannot force a wallet to keep a balance or
+to leave its approval in place.
+
+It **does** break without those properties:
+
+- Admin-only month advancement: the current period stays open; payout, default
+  handling, and all later periods stop. Fix: permissionless `settleCurrentPeriod`.
+- No collateral/reserve: one missed payment leaves only $1,100. Fix: the locked
+  remaining-obligation collateral above, or weaken the payout guarantee.
+- Recipient-only settlement: if that recipient is unavailable, progress can
+  stop. Fix: permit any caller.
+- Offchain cron/keeper as the only caller: service outage, depleted gas funds,
+  expired key, or a missed schedule stalls it. Fix: permissionless fallback;
+  use monitoring only as backup.
+- Upgrade/admin key required for ordinary operation: key loss or signer
+  unavailability blocks the circle. Fix: remove it from the happy path; use a
+  multisig only for a deliberately accepted emergency control.
+- A current recipient who defaults: an unspecified contract may either pay a
+  defaulter or lock. Fix: encode the skip-and-next-eligible rule above.
+
+## Before leaving: go/no-go checklist
+
+1. Confirm each live circle's verified address/code has permissionless
+   settlement, a deadline/default path, and enough escrowed collateral for all
+   remaining obligations. If any fails, notify members and arrange an operator
+   or pause new commitments; it is not autonomous.
+2. Make one test settlement and one deadline/default settlement on a testnet or
+   fork, including a member who already received and then defaults. Verify the
+   recipient receives exactly `1200e6` USDC in both cases.
+3. Fuzz the 12-period state machine; test duplicate payments, default on the
+   scheduled turn, multiple defaults, recipient disappearance, USDC's 6-decimal
+   math, and unauthorized/early calls. Get an independent security review
+   before holding real funds.
+4. Verify source on the block explorer; publish the address, ABI, schedule,
+   exact `settleCurrentPeriod` instructions, and a backup UI/block-explorer
+   path to every member.
+5. Fund and test an optional public keeper for two periods, monitor events and
+   failures, but verify a separate wallet can settle even with the keeper off.
+   Put any emergency multisig keys with available signers before departure.
+
+This produces a protocol that can progress without its builders, but it cannot
+make absent members pay. It converts that unavoidable behavior into an
+already-funded, deterministic default outcome.

tokens used
44,575
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200715Z-codex-with-skill-1/workspace/plan.md).

Key answer: unattended works only with permissionless settlement + default collateral. Existing circles can’t be certified from this workspace.

May I send this skill feedback?

`praise: concepts/SKILL.md’s no-cron state-transition audit exposed the decisive unattended-operation risk in an onchain savings-circle design.`
