Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 019fb4b2-066f-7623-9980-48c8b9f04ef1
--------
user
We publish a newsletter about our city's restaurants — around 200,000
subscribers, almost none of whom have ever used a crypto wallet, though a
large share of them already have a Coinbase account they signed up for years
ago. We want readers to be able to tip a line cook directly: a reader taps a
tip under a dish we wrote about, the cook gets the money. Tips run $1-$5 and
we expect a few thousand a week, most of them in the two days after an issue
goes out.

Two things before we commit to a build. Write the walkthrough of a first-time
reader's first tip — every screen, and everything they have to install, sign
up for, or fund before the money reaches the cook. Then tell me what would
have to change about this product for that setup to be the wrong one.

Write your answer to plan.md in this directory.
codex
I’m using the `ship` skill because this is an end-to-end dApp product/setup decision. I’ll follow its routing, then write `plan.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace
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
/bin/bash -lc "sed -n '241,520p' .agents/skills/ship/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace
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

codex
The key fit is consumer micropayments plus existing Coinbase distribution, so I’m checking the routed wallet, Base/L2, gas, and transaction-model guidance before fixing the flow.
web search: 
web search: https://ethskills.com/concepts/SKILL.md
exec
/bin/bash -lc 'task_tmp_dir=$(mktemp -d /tmp/ship-plan.XXXXXX)
for skill_name in concepts l2s gas wallets feedback; do curl -fsSL "https://ethskills.com/${skill_name}/SKILL.md" -o "$task_tmp_dir/${skill_name}.md"; done
wc -l "$task_tmp_dir"/*.md
for skill_doc in "$task_tmp_dir"/*.md; do sed -n '"'1,800p' \""'$skill_doc"; done' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace
 succeeded in 352ms:
  232 /tmp/ship-plan.hTWrr0/concepts.md
  106 /tmp/ship-plan.hTWrr0/feedback.md
  125 /tmp/ship-plan.hTWrr0/gas.md
  187 /tmp/ship-plan.hTWrr0/l2s.md
  169 /tmp/ship-plan.hTWrr0/wallets.md
  819 total
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

web search: 
web search: site:docs.base.org Coinbase Smart Wallet passkey sign in Coinbase account Base Pay USDC merchant payments ...
web search: 
web search: site:docs.base.org/base-account "Accept payments" pay() user flow USDC ...
codex
I’ve settled the recommendation: direct USDC transfers on Base via Base Pay, gas sponsored, no custom contract, no mandatory newsletter account, no wallet app/extension or seed phrase. I’m writing the exact first-tip path plus the conditions that overturn it.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md
diff --git a/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..9cf7a188f92f1ddc86794376542fc9e063ce5293
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,119 @@
+# Recommendation
+
+Use **Base Pay to send USDC on Base directly to each cook's Base Account**.
+
+- One Base Account/address per cook, created before publication and mapped to the dishes in our CMS.
+- `pay({ amount, to: cookAddress })` sends USDC straight from reader to cook. Our company never holds the tip.
+- Sponsor gas. Do not ask readers to acquire ETH.
+- Build no payment smart contract for the MVP. Base Pay already performs the transfer; our backend only creates a tip intent, verifies the completed transaction, prevents duplicate credit, and records dish/cook attribution.
+- Keep the amount in dollars and default to $3, with $1, $3, and $5 choices.
+- Do not require a newsletter account or a separate “connect wallet” step. Base Pay can run without one.
+
+This setup matches the audience: Base Account is a passkey-backed smart wallet that needs no browser extension, app, seed phrase, or network switch; Base Pay accepts USDC from a Base Account or Coinbase account and handles gas sponsorship. Base also fits the bursty volume and Coinbase-heavy audience. The chain fee is tiny relative to a $1 tip and is not a reason to batch.
+
+## First tip: every reader-visible screen
+
+Exact Coinbase wording can change, but the product journey should be:
+
+1. **Newsletter story**
+   - Under the dish: cook's first name/photo, “Tip the cook,” and `$1`, `$3`, `$5`.
+   - Reader taps `$3`.
+   - This opens our HTTPS checkout page in the phone's browser. Nothing is installed.
+
+2. **Tip review**
+   - “Tip $3.00 to Ana, line cook at Restaurant X.”
+   - Shows: Ana receives `3.00 USDC` (a digital dollar); network fee `$0`; “Sent directly and normally cannot be reversed.”
+   - One primary button: **Pay $3 with Base**.
+   - No email, shipping address, newsletter login, or wallet address requested.
+
+3. **Base Pay sheet**
+   - A Coinbase/Base-hosted sheet or popup displays amount, USDC, and recipient.
+   - If this device already has a Base Account/passkey, the reader selects it and skips to step 5.
+   - Otherwise the reader chooses **Continue with Coinbase**. A reader without Coinbase can instead create a Base Account with a passkey, but Coinbase is the preferred path for this audience.
+
+4. **Coinbase authentication — first use only**
+   - Coinbase sign-in screen: existing Coinbase email/phone and password, then its required 2FA/device approval.
+   - Consent screen: approve using the Coinbase account with Base Pay / create or link the reader's self-custodial Base Account.
+   - Device passkey screen: Face ID, Touch ID, device PIN, or security key creates/confirms the wallet credential.
+   - There is no new password, seed phrase, extension, or Base app install. The Base Account address is created behind the scenes.
+
+5. **Payment confirmation**
+   - Sheet shows `$3.00 USDC → Ana`, the funding source, and `$0` gas.
+   - If the reader has enough USDC in their Base or Coinbase account, they authenticate with Face ID/Touch ID/device PIN and continue to step 7.
+
+6. **Add funds — only when the available balance is insufficient**
+   - Funding screen says “Add USDC” and preserves the original $3 tip.
+   - Existing Coinbase customer selects an existing USD/USDC balance or linked bank/debit-card payment method.
+   - Review screen shows the USDC purchase/onramp amount, any Coinbase/payment-method fee, destination Base Account, and total before confirmation.
+   - Because Coinbase's hosted onramp currently has a **$5 minimum**, a $1–$3 first tip may require adding at least $5; the remainder stays as USDC for later tips. State this before redirecting.
+   - Coinbase may require refreshed identity verification, payment-method confirmation, or a waiting period. Do not promise instant funding until the quote says so.
+   - After “Confirm purchase,” show “Adding USDC…” and return automatically to the saved tip confirmation. Do not make the reader reselect the cook or amount.
+
+7. **Authorize and send**
+   - Final sheet again shows amount and recipient.
+   - Reader confirms once with the device passkey. Base Pay sponsors gas and submits the USDC transfer on Base.
+   - No approval transaction, ETH purchase, chain selection, address copy/paste, or second blockchain signature is exposed.
+
+8. **Processing**
+   - Our page shows “Sending your tip…” while the backend independently checks Base Pay's payment status.
+   - The backend verifies completed status, amount, recipient, and sender; stores the unique transaction ID before marking the tip paid. A frontend success callback alone is insufficient.
+
+9. **Receipt**
+   - “Ana received $3.00.”
+   - Shows dish, restaurant, amount, timestamp, and optional block-explorer link.
+   - Offer “Tip another cook” and, only now, an optional emailed receipt. Do not force profile creation.
+
+The money reaches Ana's Base Account at step 7; step 8 is our confirmation, not a later payout. Ana can hold USDC, spend it, send it to Coinbase, or cash out through a linked bank where supported.
+
+## What each party must do before launch
+
+**Reader**
+
+- Install: nothing.
+- Sign up: nothing new if Coinbase authentication can link/create the Base Account; otherwise create a passkey-backed Base Account in the hosted flow.
+- Fund: nothing in advance if the Coinbase/Base balance covers the tip. Otherwise buy at least the onramp minimum—currently $5—even for a smaller tip.
+
+**Cook**
+
+- Create or connect a Base Account, secure its passkey/recovery method, and complete any Coinbase identity/bank setup needed to cash out.
+- Confirm ownership of the receiving address in our onboarding flow. We send a small test payment and the cook confirms receipt before a dish can be published.
+- Understand that USDC is received on Base, transfers are publicly visible, and cash-out availability/fees/tax treatment depend on jurisdiction.
+
+**Publisher**
+
+- Obtain the cook's informed consent; never accept an address supplied only by a restaurant manager.
+- Store a versioned cook-to-address mapping, with dual review for address changes and an emergency disable switch in the CMS.
+- Fund and monitor the Base Pay gas sponsor; set per-payment and daily abuse limits.
+- Reconcile verified transactions, handle support, and define what happens when a dish has no valid recipient.
+- Get payments, labor, tax, money-transmission, sanctions, and restaurant-policy review. “Direct” does not automatically remove our compliance obligations.
+
+## Changes that make this the wrong setup
+
+The recommendation is conditional on **direct, irreversible, public, one-recipient USDC tips whose recipient already has an onchain account**. Change any of these and reconsider:
+
+| Product change | Why direct Base Pay becomes wrong | Better shape |
+| --- | --- | --- |
+| The promise becomes “tap once with Apple Pay/card,” including a reader's first-ever $1 payment | A wallet/passkey plus a $5 onramp minimum is too much friction for a $1 impulse tip | Ordinary card checkout; publisher or regulated partner keeps an offchain ledger and batches payouts |
+| Cooks must receive dollars in a bank account, never USDC, with no wallet/onramp/offramp work | The cook journey violates the product promise | Stripe Connect or another marketplace-payout provider; display dollars and settle to banks |
+| The newsletter collects funds, takes a fee, holds balances, delays payout, guarantees delivery, or issues refunds/chargebacks | This is no longer a direct transfer; custody, accounting, disputes, and likely regulatory duties appear | Regulated marketplace payments/custody stack; onchain escrow only if its trust model is actually required |
+| One tip must split among several kitchen workers, a tip pool, a restaurant, and the publisher | A single direct transfer cannot enforce allocation | A carefully audited split contract or regulated offchain split/payout ledger |
+| Recipient allocation changes after payment—for example, shift rosters are resolved later | The sender does not yet know the final recipient | Offchain ledger/escrow followed by resolved payouts; do not guess an address at checkout |
+| Readers need privacy from the public or cooks must not have earnings/address linkable across articles | Base transfers expose addresses, amounts, timing, and counterparties | Conventional payments or a privacy-preserving regulated system; changing wallet labels does not solve this |
+| Refunds, fraud protection, minors, garnishment, wage/tip-pooling rules, or employer reporting are core requirements | Irreversible peer-to-peer settlement conflicts with those controls | Employer/payroll or marketplace system with reversible ledger entries and formal reporting |
+| Most readers do not have Coinbase, Base Account, or supported onramp access | The distribution advantage disappears | Re-run conversion tests against card wallets and local payment rails; possibly change provider or abandon onchain checkout |
+| Most cooks cannot legally or practically cash out USDC in their jurisdiction | Cheap settlement is irrelevant if recipients cannot use the money | Local bank/mobile-money payouts or a locally supported stablecoin/offramp |
+| Tips become recurring subscriptions or reader-authorized automatic charges | A one-time `pay()` flow no longer models consent or revocation | Base spend permissions/subscriptions with caps and cancellation UX, or card mandates |
+| Tips become large, conditional, escrowed, matched, governed, or composable with other contracts | The trustless rules—not merely transfer—now belong onchain | Design and audit one minimal purpose-built contract |
+| The product adds loyalty points, public donor badges, voting, or tradable rewards | A plain transfer cannot express the new persistent rights | Keep ordinary metadata offchain; add a contract only for rights that truly need trustless ownership/composability |
+| Reliability requires operation if Base/Coinbase onboarding or its sponsor is unavailable | The current design has platform and sequencer dependencies | Add another payment rail and explicit fallback; do not pretend a second chain alone fixes Coinbase dependency |
+
+## Commit gate
+
+Before building beyond a prototype, test the full first-funded-tip funnel with at least three cohorts: existing funded Coinbase users, existing but unfunded Coinbase users, and people with no Coinbase account. Measure completion and time at each numbered screen. The decisive metric is the unfunded cohort's conversion through the $5 funding step. If that step destroys conversion, use card checkout plus batched cook payouts; blockchain cost is not the bottleneck.
+
+## Current implementation references
+
+- [Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account)
+- [Base Pay: accept USDC payments](https://docs.base.org/base-account/guides/accept-payments)
+- [Coinbase-hosted onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)
+

diff --git a/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..9cf7a188f92f1ddc86794376542fc9e063ce5293
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,119 @@
+# Recommendation
+
+Use **Base Pay to send USDC on Base directly to each cook's Base Account**.
+
+- One Base Account/address per cook, created before publication and mapped to the dishes in our CMS.
+- `pay({ amount, to: cookAddress })` sends USDC straight from reader to cook. Our company never holds the tip.
+- Sponsor gas. Do not ask readers to acquire ETH.
+- Build no payment smart contract for the MVP. Base Pay already performs the transfer; our backend only creates a tip intent, verifies the completed transaction, prevents duplicate credit, and records dish/cook attribution.
+- Keep the amount in dollars and default to $3, with $1, $3, and $5 choices.
+- Do not require a newsletter account or a separate “connect wallet” step. Base Pay can run without one.
+
+This setup matches the audience: Base Account is a passkey-backed smart wallet that needs no browser extension, app, seed phrase, or network switch; Base Pay accepts USDC from a Base Account or Coinbase account and handles gas sponsorship. Base also fits the bursty volume and Coinbase-heavy audience. The chain fee is tiny relative to a $1 tip and is not a reason to batch.
+
+## First tip: every reader-visible screen
+
+Exact Coinbase wording can change, but the product journey should be:
+
+1. **Newsletter story**
+   - Under the dish: cook's first name/photo, “Tip the cook,” and `$1`, `$3`, `$5`.
+   - Reader taps `$3`.
+   - This opens our HTTPS checkout page in the phone's browser. Nothing is installed.
+
+2. **Tip review**
+   - “Tip $3.00 to Ana, line cook at Restaurant X.”
+   - Shows: Ana receives `3.00 USDC` (a digital dollar); network fee `$0`; “Sent directly and normally cannot be reversed.”
+   - One primary button: **Pay $3 with Base**.
+   - No email, shipping address, newsletter login, or wallet address requested.
+
+3. **Base Pay sheet**
+   - A Coinbase/Base-hosted sheet or popup displays amount, USDC, and recipient.
+   - If this device already has a Base Account/passkey, the reader selects it and skips to step 5.
+   - Otherwise the reader chooses **Continue with Coinbase**. A reader without Coinbase can instead create a Base Account with a passkey, but Coinbase is the preferred path for this audience.
+
+4. **Coinbase authentication — first use only**
+   - Coinbase sign-in screen: existing Coinbase email/phone and password, then its required 2FA/device approval.
+   - Consent screen: approve using the Coinbase account with Base Pay / create or link the reader's self-custodial Base Account.
+   - Device passkey screen: Face ID, Touch ID, device PIN, or security key creates/confirms the wallet credential.
+   - There is no new password, seed phrase, extension, or Base app install. The Base Account address is created behind the scenes.
+
+5. **Payment confirmation**
+   - Sheet shows `$3.00 USDC → Ana`, the funding source, and `$0` gas.
+   - If the reader has enough USDC in their Base or Coinbase account, they authenticate with Face ID/Touch ID/device PIN and continue to step 7.
+
+6. **Add funds — only when the available balance is insufficient**
+   - Funding screen says “Add USDC” and preserves the original $3 tip.
+   - Existing Coinbase customer selects an existing USD/USDC balance or linked bank/debit-card payment method.
+   - Review screen shows the USDC purchase/onramp amount, any Coinbase/payment-method fee, destination Base Account, and total before confirmation.
+   - Because Coinbase's hosted onramp currently has a **$5 minimum**, a $1–$3 first tip may require adding at least $5; the remainder stays as USDC for later tips. State this before redirecting.
+   - Coinbase may require refreshed identity verification, payment-method confirmation, or a waiting period. Do not promise instant funding until the quote says so.
+   - After “Confirm purchase,” show “Adding USDC…” and return automatically to the saved tip confirmation. Do not make the reader reselect the cook or amount.
+
+7. **Authorize and send**
+   - Final sheet again shows amount and recipient.
+   - Reader confirms once with the device passkey. Base Pay sponsors gas and submits the USDC transfer on Base.
+   - No approval transaction, ETH purchase, chain selection, address copy/paste, or second blockchain signature is exposed.
+
+8. **Processing**
+   - Our page shows “Sending your tip…” while the backend independently checks Base Pay's payment status.
+   - The backend verifies completed status, amount, recipient, and sender; stores the unique transaction ID before marking the tip paid. A frontend success callback alone is insufficient.
+
+9. **Receipt**
+   - “Ana received $3.00.”
+   - Shows dish, restaurant, amount, timestamp, and optional block-explorer link.
+   - Offer “Tip another cook” and, only now, an optional emailed receipt. Do not force profile creation.
+
+The money reaches Ana's Base Account at step 7; step 8 is our confirmation, not a later payout. Ana can hold USDC, spend it, send it to Coinbase, or cash out through a linked bank where supported.
+
+## What each party must do before launch
+
+**Reader**
+
+- Install: nothing.
+- Sign up: nothing new if Coinbase authentication can link/create the Base Account; otherwise create a passkey-backed Base Account in the hosted flow.
+- Fund: nothing in advance if the Coinbase/Base balance covers the tip. Otherwise buy at least the onramp minimum—currently $5—even for a smaller tip.
+
+**Cook**
+
+- Create or connect a Base Account, secure its passkey/recovery method, and complete any Coinbase identity/bank setup needed to cash out.
+- Confirm ownership of the receiving address in our onboarding flow. We send a small test payment and the cook confirms receipt before a dish can be published.
+- Understand that USDC is received on Base, transfers are publicly visible, and cash-out availability/fees/tax treatment depend on jurisdiction.
+
+**Publisher**
+
+- Obtain the cook's informed consent; never accept an address supplied only by a restaurant manager.
+- Store a versioned cook-to-address mapping, with dual review for address changes and an emergency disable switch in the CMS.
+- Fund and monitor the Base Pay gas sponsor; set per-payment and daily abuse limits.
+- Reconcile verified transactions, handle support, and define what happens when a dish has no valid recipient.
+- Get payments, labor, tax, money-transmission, sanctions, and restaurant-policy review. “Direct” does not automatically remove our compliance obligations.
+
+## Changes that make this the wrong setup
+
+The recommendation is conditional on **direct, irreversible, public, one-recipient USDC tips whose recipient already has an onchain account**. Change any of these and reconsider:
+
+| Product change | Why direct Base Pay becomes wrong | Better shape |
+| --- | --- | --- |
+| The promise becomes “tap once with Apple Pay/card,” including a reader's first-ever $1 payment | A wallet/passkey plus a $5 onramp minimum is too much friction for a $1 impulse tip | Ordinary card checkout; publisher or regulated partner keeps an offchain ledger and batches payouts |
+| Cooks must receive dollars in a bank account, never USDC, with no wallet/onramp/offramp work | The cook journey violates the product promise | Stripe Connect or another marketplace-payout provider; display dollars and settle to banks |
+| The newsletter collects funds, takes a fee, holds balances, delays payout, guarantees delivery, or issues refunds/chargebacks | This is no longer a direct transfer; custody, accounting, disputes, and likely regulatory duties appear | Regulated marketplace payments/custody stack; onchain escrow only if its trust model is actually required |
+| One tip must split among several kitchen workers, a tip pool, a restaurant, and the publisher | A single direct transfer cannot enforce allocation | A carefully audited split contract or regulated offchain split/payout ledger |
+| Recipient allocation changes after payment—for example, shift rosters are resolved later | The sender does not yet know the final recipient | Offchain ledger/escrow followed by resolved payouts; do not guess an address at checkout |
+| Readers need privacy from the public or cooks must not have earnings/address linkable across articles | Base transfers expose addresses, amounts, timing, and counterparties | Conventional payments or a privacy-preserving regulated system; changing wallet labels does not solve this |
+| Refunds, fraud protection, minors, garnishment, wage/tip-pooling rules, or employer reporting are core requirements | Irreversible peer-to-peer settlement conflicts with those controls | Employer/payroll or marketplace system with reversible ledger entries and formal reporting |
+| Most readers do not have Coinbase, Base Account, or supported onramp access | The distribution advantage disappears | Re-run conversion tests against card wallets and local payment rails; possibly change provider or abandon onchain checkout |
+| Most cooks cannot legally or practically cash out USDC in their jurisdiction | Cheap settlement is irrelevant if recipients cannot use the money | Local bank/mobile-money payouts or a locally supported stablecoin/offramp |
+| Tips become recurring subscriptions or reader-authorized automatic charges | A one-time `pay()` flow no longer models consent or revocation | Base spend permissions/subscriptions with caps and cancellation UX, or card mandates |
+| Tips become large, conditional, escrowed, matched, governed, or composable with other contracts | The trustless rules—not merely transfer—now belong onchain | Design and audit one minimal purpose-built contract |
+| The product adds loyalty points, public donor badges, voting, or tradable rewards | A plain transfer cannot express the new persistent rights | Keep ordinary metadata offchain; add a contract only for rights that truly need trustless ownership/composability |
+| Reliability requires operation if Base/Coinbase onboarding or its sponsor is unavailable | The current design has platform and sequencer dependencies | Add another payment rail and explicit fallback; do not pretend a second chain alone fixes Coinbase dependency |
+
+## Commit gate
+
+Before building beyond a prototype, test the full first-funded-tip funnel with at least three cohorts: existing funded Coinbase users, existing but unfunded Coinbase users, and people with no Coinbase account. Measure completion and time at each numbered screen. The decisive metric is the unfunded cohort's conversion through the $5 funding step. If that step destroys conversion, use card checkout plus batched cook payouts; blockchain cost is not the bottleneck.
+
+## Current implementation references
+
+- [Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account)
+- [Base Pay: accept USDC payments](https://docs.base.org/base-account/guides/accept-payments)
+- [Coinbase-hosted onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)
+

exec
/bin/bash -lc 'test -s plan.md && wc -l plan.md && rg -n "''^# Recommendation|''^## First tip|''^## Changes|''^## Commit gate" plan.md' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace
 succeeded in 0ms:
119 plan.md
1:# Recommendation
14:## First tip: every reader-visible screen
90:## Changes that make this the wrong setup
110:## Commit gate

diff --git a/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..9cf7a188f92f1ddc86794376542fc9e063ce5293
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,119 @@
+# Recommendation
+
+Use **Base Pay to send USDC on Base directly to each cook's Base Account**.
+
+- One Base Account/address per cook, created before publication and mapped to the dishes in our CMS.
+- `pay({ amount, to: cookAddress })` sends USDC straight from reader to cook. Our company never holds the tip.
+- Sponsor gas. Do not ask readers to acquire ETH.
+- Build no payment smart contract for the MVP. Base Pay already performs the transfer; our backend only creates a tip intent, verifies the completed transaction, prevents duplicate credit, and records dish/cook attribution.
+- Keep the amount in dollars and default to $3, with $1, $3, and $5 choices.
+- Do not require a newsletter account or a separate “connect wallet” step. Base Pay can run without one.
+
+This setup matches the audience: Base Account is a passkey-backed smart wallet that needs no browser extension, app, seed phrase, or network switch; Base Pay accepts USDC from a Base Account or Coinbase account and handles gas sponsorship. Base also fits the bursty volume and Coinbase-heavy audience. The chain fee is tiny relative to a $1 tip and is not a reason to batch.
+
+## First tip: every reader-visible screen
+
+Exact Coinbase wording can change, but the product journey should be:
+
+1. **Newsletter story**
+   - Under the dish: cook's first name/photo, “Tip the cook,” and `$1`, `$3`, `$5`.
+   - Reader taps `$3`.
+   - This opens our HTTPS checkout page in the phone's browser. Nothing is installed.
+
+2. **Tip review**
+   - “Tip $3.00 to Ana, line cook at Restaurant X.”
+   - Shows: Ana receives `3.00 USDC` (a digital dollar); network fee `$0`; “Sent directly and normally cannot be reversed.”
+   - One primary button: **Pay $3 with Base**.
+   - No email, shipping address, newsletter login, or wallet address requested.
+
+3. **Base Pay sheet**
+   - A Coinbase/Base-hosted sheet or popup displays amount, USDC, and recipient.
+   - If this device already has a Base Account/passkey, the reader selects it and skips to step 5.
+   - Otherwise the reader chooses **Continue with Coinbase**. A reader without Coinbase can instead create a Base Account with a passkey, but Coinbase is the preferred path for this audience.
+
+4. **Coinbase authentication — first use only**
+   - Coinbase sign-in screen: existing Coinbase email/phone and password, then its required 2FA/device approval.
+   - Consent screen: approve using the Coinbase account with Base Pay / create or link the reader's self-custodial Base Account.
+   - Device passkey screen: Face ID, Touch ID, device PIN, or security key creates/confirms the wallet credential.
+   - There is no new password, seed phrase, extension, or Base app install. The Base Account address is created behind the scenes.
+
+5. **Payment confirmation**
+   - Sheet shows `$3.00 USDC → Ana`, the funding source, and `$0` gas.
+   - If the reader has enough USDC in their Base or Coinbase account, they authenticate with Face ID/Touch ID/device PIN and continue to step 7.
+
+6. **Add funds — only when the available balance is insufficient**
+   - Funding screen says “Add USDC” and preserves the original $3 tip.
+   - Existing Coinbase customer selects an existing USD/USDC balance or linked bank/debit-card payment method.
+   - Review screen shows the USDC purchase/onramp amount, any Coinbase/payment-method fee, destination Base Account, and total before confirmation.
+   - Because Coinbase's hosted onramp currently has a **$5 minimum**, a $1–$3 first tip may require adding at least $5; the remainder stays as USDC for later tips. State this before redirecting.
+   - Coinbase may require refreshed identity verification, payment-method confirmation, or a waiting period. Do not promise instant funding until the quote says so.
+   - After “Confirm purchase,” show “Adding USDC…” and return automatically to the saved tip confirmation. Do not make the reader reselect the cook or amount.
+
+7. **Authorize and send**
+   - Final sheet again shows amount and recipient.
+   - Reader confirms once with the device passkey. Base Pay sponsors gas and submits the USDC transfer on Base.
+   - No approval transaction, ETH purchase, chain selection, address copy/paste, or second blockchain signature is exposed.
+
+8. **Processing**
+   - Our page shows “Sending your tip…” while the backend independently checks Base Pay's payment status.
+   - The backend verifies completed status, amount, recipient, and sender; stores the unique transaction ID before marking the tip paid. A frontend success callback alone is insufficient.
+
+9. **Receipt**
+   - “Ana received $3.00.”
+   - Shows dish, restaurant, amount, timestamp, and optional block-explorer link.
+   - Offer “Tip another cook” and, only now, an optional emailed receipt. Do not force profile creation.
+
+The money reaches Ana's Base Account at step 7; step 8 is our confirmation, not a later payout. Ana can hold USDC, spend it, send it to Coinbase, or cash out through a linked bank where supported.
+
+## What each party must do before launch
+
+**Reader**
+
+- Install: nothing.
+- Sign up: nothing new if Coinbase authentication can link/create the Base Account; otherwise create a passkey-backed Base Account in the hosted flow.
+- Fund: nothing in advance if the Coinbase/Base balance covers the tip. Otherwise buy at least the onramp minimum—currently $5—even for a smaller tip.
+
+**Cook**
+
+- Create or connect a Base Account, secure its passkey/recovery method, and complete any Coinbase identity/bank setup needed to cash out.
+- Confirm ownership of the receiving address in our onboarding flow. We send a small test payment and the cook confirms receipt before a dish can be published.
+- Understand that USDC is received on Base, transfers are publicly visible, and cash-out availability/fees/tax treatment depend on jurisdiction.
+
+**Publisher**
+
+- Obtain the cook's informed consent; never accept an address supplied only by a restaurant manager.
+- Store a versioned cook-to-address mapping, with dual review for address changes and an emergency disable switch in the CMS.
+- Fund and monitor the Base Pay gas sponsor; set per-payment and daily abuse limits.
+- Reconcile verified transactions, handle support, and define what happens when a dish has no valid recipient.
+- Get payments, labor, tax, money-transmission, sanctions, and restaurant-policy review. “Direct” does not automatically remove our compliance obligations.
+
+## Changes that make this the wrong setup
+
+The recommendation is conditional on **direct, irreversible, public, one-recipient USDC tips whose recipient already has an onchain account**. Change any of these and reconsider:
+
+| Product change | Why direct Base Pay becomes wrong | Better shape |
+| --- | --- | --- |
+| The promise becomes “tap once with Apple Pay/card,” including a reader's first-ever $1 payment | A wallet/passkey plus a $5 onramp minimum is too much friction for a $1 impulse tip | Ordinary card checkout; publisher or regulated partner keeps an offchain ledger and batches payouts |
+| Cooks must receive dollars in a bank account, never USDC, with no wallet/onramp/offramp work | The cook journey violates the product promise | Stripe Connect or another marketplace-payout provider; display dollars and settle to banks |
+| The newsletter collects funds, takes a fee, holds balances, delays payout, guarantees delivery, or issues refunds/chargebacks | This is no longer a direct transfer; custody, accounting, disputes, and likely regulatory duties appear | Regulated marketplace payments/custody stack; onchain escrow only if its trust model is actually required |
+| One tip must split among several kitchen workers, a tip pool, a restaurant, and the publisher | A single direct transfer cannot enforce allocation | A carefully audited split contract or regulated offchain split/payout ledger |
+| Recipient allocation changes after payment—for example, shift rosters are resolved later | The sender does not yet know the final recipient | Offchain ledger/escrow followed by resolved payouts; do not guess an address at checkout |
+| Readers need privacy from the public or cooks must not have earnings/address linkable across articles | Base transfers expose addresses, amounts, timing, and counterparties | Conventional payments or a privacy-preserving regulated system; changing wallet labels does not solve this |
+| Refunds, fraud protection, minors, garnishment, wage/tip-pooling rules, or employer reporting are core requirements | Irreversible peer-to-peer settlement conflicts with those controls | Employer/payroll or marketplace system with reversible ledger entries and formal reporting |
+| Most readers do not have Coinbase, Base Account, or supported onramp access | The distribution advantage disappears | Re-run conversion tests against card wallets and local payment rails; possibly change provider or abandon onchain checkout |
+| Most cooks cannot legally or practically cash out USDC in their jurisdiction | Cheap settlement is irrelevant if recipients cannot use the money | Local bank/mobile-money payouts or a locally supported stablecoin/offramp |
+| Tips become recurring subscriptions or reader-authorized automatic charges | A one-time `pay()` flow no longer models consent or revocation | Base spend permissions/subscriptions with caps and cancellation UX, or card mandates |
+| Tips become large, conditional, escrowed, matched, governed, or composable with other contracts | The trustless rules—not merely transfer—now belong onchain | Design and audit one minimal purpose-built contract |
+| The product adds loyalty points, public donor badges, voting, or tradable rewards | A plain transfer cannot express the new persistent rights | Keep ordinary metadata offchain; add a contract only for rights that truly need trustless ownership/composability |
+| Reliability requires operation if Base/Coinbase onboarding or its sponsor is unavailable | The current design has platform and sequencer dependencies | Add another payment rail and explicit fallback; do not pretend a second chain alone fixes Coinbase dependency |
+
+## Commit gate
+
+Before building beyond a prototype, test the full first-funded-tip funnel with at least three cohorts: existing funded Coinbase users, existing but unfunded Coinbase users, and people with no Coinbase account. Measure completion and time at each numbered screen. The decisive metric is the unfunded cohort's conversion through the $5 funding step. If that step destroys conversion, use card checkout plus batched cook payouts; blockchain cost is not the bottleneck.
+
+## Current implementation references
+
+- [Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account)
+- [Base Pay: accept USDC payments](https://docs.base.org/base-account/guides/accept-payments)
+- [Coinbase-hosted onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)
+

codex
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md).
diff --git a/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..9cf7a188f92f1ddc86794376542fc9e063ce5293
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,119 @@
+# Recommendation
+
+Use **Base Pay to send USDC on Base directly to each cook's Base Account**.
+
+- One Base Account/address per cook, created before publication and mapped to the dishes in our CMS.
+- `pay({ amount, to: cookAddress })` sends USDC straight from reader to cook. Our company never holds the tip.
+- Sponsor gas. Do not ask readers to acquire ETH.
+- Build no payment smart contract for the MVP. Base Pay already performs the transfer; our backend only creates a tip intent, verifies the completed transaction, prevents duplicate credit, and records dish/cook attribution.
+- Keep the amount in dollars and default to $3, with $1, $3, and $5 choices.
+- Do not require a newsletter account or a separate “connect wallet” step. Base Pay can run without one.
+
+This setup matches the audience: Base Account is a passkey-backed smart wallet that needs no browser extension, app, seed phrase, or network switch; Base Pay accepts USDC from a Base Account or Coinbase account and handles gas sponsorship. Base also fits the bursty volume and Coinbase-heavy audience. The chain fee is tiny relative to a $1 tip and is not a reason to batch.
+
+## First tip: every reader-visible screen
+
+Exact Coinbase wording can change, but the product journey should be:
+
+1. **Newsletter story**
+   - Under the dish: cook's first name/photo, “Tip the cook,” and `$1`, `$3`, `$5`.
+   - Reader taps `$3`.
+   - This opens our HTTPS checkout page in the phone's browser. Nothing is installed.
+
+2. **Tip review**
+   - “Tip $3.00 to Ana, line cook at Restaurant X.”
+   - Shows: Ana receives `3.00 USDC` (a digital dollar); network fee `$0`; “Sent directly and normally cannot be reversed.”
+   - One primary button: **Pay $3 with Base**.
+   - No email, shipping address, newsletter login, or wallet address requested.
+
+3. **Base Pay sheet**
+   - A Coinbase/Base-hosted sheet or popup displays amount, USDC, and recipient.
+   - If this device already has a Base Account/passkey, the reader selects it and skips to step 5.
+   - Otherwise the reader chooses **Continue with Coinbase**. A reader without Coinbase can instead create a Base Account with a passkey, but Coinbase is the preferred path for this audience.
+
+4. **Coinbase authentication — first use only**
+   - Coinbase sign-in screen: existing Coinbase email/phone and password, then its required 2FA/device approval.
+   - Consent screen: approve using the Coinbase account with Base Pay / create or link the reader's self-custodial Base Account.
+   - Device passkey screen: Face ID, Touch ID, device PIN, or security key creates/confirms the wallet credential.
+   - There is no new password, seed phrase, extension, or Base app install. The Base Account address is created behind the scenes.
+
+5. **Payment confirmation**
+   - Sheet shows `$3.00 USDC → Ana`, the funding source, and `$0` gas.
+   - If the reader has enough USDC in their Base or Coinbase account, they authenticate with Face ID/Touch ID/device PIN and continue to step 7.
+
+6. **Add funds — only when the available balance is insufficient**
+   - Funding screen says “Add USDC” and preserves the original $3 tip.
+   - Existing Coinbase customer selects an existing USD/USDC balance or linked bank/debit-card payment method.
+   - Review screen shows the USDC purchase/onramp amount, any Coinbase/payment-method fee, destination Base Account, and total before confirmation.
+   - Because Coinbase's hosted onramp currently has a **$5 minimum**, a $1–$3 first tip may require adding at least $5; the remainder stays as USDC for later tips. State this before redirecting.
+   - Coinbase may require refreshed identity verification, payment-method confirmation, or a waiting period. Do not promise instant funding until the quote says so.
+   - After “Confirm purchase,” show “Adding USDC…” and return automatically to the saved tip confirmation. Do not make the reader reselect the cook or amount.
+
+7. **Authorize and send**
+   - Final sheet again shows amount and recipient.
+   - Reader confirms once with the device passkey. Base Pay sponsors gas and submits the USDC transfer on Base.
+   - No approval transaction, ETH purchase, chain selection, address copy/paste, or second blockchain signature is exposed.
+
+8. **Processing**
+   - Our page shows “Sending your tip…” while the backend independently checks Base Pay's payment status.
+   - The backend verifies completed status, amount, recipient, and sender; stores the unique transaction ID before marking the tip paid. A frontend success callback alone is insufficient.
+
+9. **Receipt**
+   - “Ana received $3.00.”
+   - Shows dish, restaurant, amount, timestamp, and optional block-explorer link.
+   - Offer “Tip another cook” and, only now, an optional emailed receipt. Do not force profile creation.
+
+The money reaches Ana's Base Account at step 7; step 8 is our confirmation, not a later payout. Ana can hold USDC, spend it, send it to Coinbase, or cash out through a linked bank where supported.
+
+## What each party must do before launch
+
+**Reader**
+
+- Install: nothing.
+- Sign up: nothing new if Coinbase authentication can link/create the Base Account; otherwise create a passkey-backed Base Account in the hosted flow.
+- Fund: nothing in advance if the Coinbase/Base balance covers the tip. Otherwise buy at least the onramp minimum—currently $5—even for a smaller tip.
+
+**Cook**
+
+- Create or connect a Base Account, secure its passkey/recovery method, and complete any Coinbase identity/bank setup needed to cash out.
+- Confirm ownership of the receiving address in our onboarding flow. We send a small test payment and the cook confirms receipt before a dish can be published.
+- Understand that USDC is received on Base, transfers are publicly visible, and cash-out availability/fees/tax treatment depend on jurisdiction.
+
+**Publisher**
+
+- Obtain the cook's informed consent; never accept an address supplied only by a restaurant manager.
+- Store a versioned cook-to-address mapping, with dual review for address changes and an emergency disable switch in the CMS.
+- Fund and monitor the Base Pay gas sponsor; set per-payment and daily abuse limits.
+- Reconcile verified transactions, handle support, and define what happens when a dish has no valid recipient.
+- Get payments, labor, tax, money-transmission, sanctions, and restaurant-policy review. “Direct” does not automatically remove our compliance obligations.
+
+## Changes that make this the wrong setup
+
+The recommendation is conditional on **direct, irreversible, public, one-recipient USDC tips whose recipient already has an onchain account**. Change any of these and reconsider:
+
+| Product change | Why direct Base Pay becomes wrong | Better shape |
+| --- | --- | --- |
+| The promise becomes “tap once with Apple Pay/card,” including a reader's first-ever $1 payment | A wallet/passkey plus a $5 onramp minimum is too much friction for a $1 impulse tip | Ordinary card checkout; publisher or regulated partner keeps an offchain ledger and batches payouts |
+| Cooks must receive dollars in a bank account, never USDC, with no wallet/onramp/offramp work | The cook journey violates the product promise | Stripe Connect or another marketplace-payout provider; display dollars and settle to banks |
+| The newsletter collects funds, takes a fee, holds balances, delays payout, guarantees delivery, or issues refunds/chargebacks | This is no longer a direct transfer; custody, accounting, disputes, and likely regulatory duties appear | Regulated marketplace payments/custody stack; onchain escrow only if its trust model is actually required |
+| One tip must split among several kitchen workers, a tip pool, a restaurant, and the publisher | A single direct transfer cannot enforce allocation | A carefully audited split contract or regulated offchain split/payout ledger |
+| Recipient allocation changes after payment—for example, shift rosters are resolved later | The sender does not yet know the final recipient | Offchain ledger/escrow followed by resolved payouts; do not guess an address at checkout |
+| Readers need privacy from the public or cooks must not have earnings/address linkable across articles | Base transfers expose addresses, amounts, timing, and counterparties | Conventional payments or a privacy-preserving regulated system; changing wallet labels does not solve this |
+| Refunds, fraud protection, minors, garnishment, wage/tip-pooling rules, or employer reporting are core requirements | Irreversible peer-to-peer settlement conflicts with those controls | Employer/payroll or marketplace system with reversible ledger entries and formal reporting |
+| Most readers do not have Coinbase, Base Account, or supported onramp access | The distribution advantage disappears | Re-run conversion tests against card wallets and local payment rails; possibly change provider or abandon onchain checkout |
+| Most cooks cannot legally or practically cash out USDC in their jurisdiction | Cheap settlement is irrelevant if recipients cannot use the money | Local bank/mobile-money payouts or a locally supported stablecoin/offramp |
+| Tips become recurring subscriptions or reader-authorized automatic charges | A one-time `pay()` flow no longer models consent or revocation | Base spend permissions/subscriptions with caps and cancellation UX, or card mandates |
+| Tips become large, conditional, escrowed, matched, governed, or composable with other contracts | The trustless rules—not merely transfer—now belong onchain | Design and audit one minimal purpose-built contract |
+| The product adds loyalty points, public donor badges, voting, or tradable rewards | A plain transfer cannot express the new persistent rights | Keep ordinary metadata offchain; add a contract only for rights that truly need trustless ownership/composability |
+| Reliability requires operation if Base/Coinbase onboarding or its sponsor is unavailable | The current design has platform and sequencer dependencies | Add another payment rail and explicit fallback; do not pretend a second chain alone fixes Coinbase dependency |
+
+## Commit gate
+
+Before building beyond a prototype, test the full first-funded-tip funnel with at least three cohorts: existing funded Coinbase users, existing but unfunded Coinbase users, and people with no Coinbase account. Measure completion and time at each numbered screen. The decisive metric is the unfunded cohort's conversion through the $5 funding step. If that step destroys conversion, use card checkout plus batched cook payouts; blockchain cost is not the bottleneck.
+
+## Current implementation references
+
+- [Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account)
+- [Base Pay: accept USDC payments](https://docs.base.org/base-account/guides/accept-payments)
+- [Coinbase-hosted onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)
+

tokens used
63,507
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202313Z-codex-with-skill-2/workspace/plan.md).
