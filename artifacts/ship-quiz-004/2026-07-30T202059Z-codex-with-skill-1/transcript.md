Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 019fb4af-fcea-7933-9a81-c1eb02a4b348
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
I’m using the ship skill because this is a dApp product-path decision; it routes the wallet, payment, and onboarding analysis.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace
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
/bin/bash -lc "sed -n '241,520p' .agents/skills/ship/SKILL.md && find .agents/skills -maxdepth 2 -type f -name SKILL.md -print" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace
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
The key fork is custodial/card-like onboarding versus self-custodied onchain tipping. I’m checking current Base/Coinbase wallet behavior and fee mechanics before writing the exact first-tip screens.
exec
/bin/bash -lc 'for skill_name in wallets l2s gas frontend-ux; do curl -fsSL "https://ethskills.com/${skill_name}/SKILL.md" -o "/tmp/${skill_name}-SKILL.md"; done
wc -l /tmp/wallets-SKILL.md /tmp/l2s-SKILL.md /tmp/gas-SKILL.md /tmp/frontend-ux-SKILL.md' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace
 succeeded in 253ms:
  169 /tmp/wallets-SKILL.md
  187 /tmp/l2s-SKILL.md
  125 /tmp/gas-SKILL.md
  186 /tmp/frontend-ux-SKILL.md
  667 total

exec
/bin/bash -lc "sed -n '1,220p' /tmp/wallets-SKILL.md
sed -n '1,240p' /tmp/l2s-SKILL.md
sed -n '1,180p' /tmp/gas-SKILL.md
sed -n '1,240p' /tmp/frontend-ux-SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace
 succeeded in 0ms:
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

web search: 
web search: site:docs.base.org account smart wallet sign in Coinbase balance onramp USDC Base existing Coinbase account ...
codex
Recommendation settled: Base, native USDC, an email-authenticated embedded smart wallet, sponsored gas, and no custom contract. Existing Coinbase accounts shorten funding, but do not eliminate the one-time wallet creation or funding handoff.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md
diff --git a/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0b690f01a0674f93481604c114bf87f5e3557677
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,169 @@
+# Recommended setup
+
+Use native USDC on Base. Give each reader an email-authenticated embedded smart
+account and sponsor its gas. Send each tip directly from the reader's account to
+the cook's Base address. Use Coinbase Onramp to move an existing Coinbase
+balance, or a linked bank/card, into the reader's embedded account.
+
+Build no custom contract for the MVP. The newsletter backend should keep the
+dish-to-cook address mapping, create short-lived funding sessions, and record
+transaction hashes for receipts/support. It must never hold reader or cook
+funds.
+
+This fits the audience: no extension, wallet app, seed phrase, ETH purchase,
+network switch, token approval, bridge, or reader-paid gas. Base fits the
+Coinbase-heavy audience and bursty, low-value transfers; USDC keeps the displayed
+and received amount in dollars.
+
+## First tip, screen by screen
+
+Assume a first-time reader has an old, usable Coinbase account but no onchain
+wallet and no USDC already in the newsletter wallet.
+
+1. **Newsletter story.** Under the dish: `Tip Maria, line cook` with `$1`, `$3`,
+   `$5`, and `Other`. The reader taps `$3`.
+
+2. **Tip sheet.** Show cook name/photo, restaurant, dish, `Maria receives 3.00
+   USDC (about $3)`, `Network fee: $0`, and a brief notice that the payment is
+   final and the cook controls the receiving account. Button: `Continue`.
+
+3. **Create/restore account.** Ask for email, then show the one-time-code screen.
+   Entered code creates or restores an embedded smart account. Say plainly:
+   `This creates your tipping account.` Do not call it “Connect Wallet.”
+
+   Installation: none. Signup: email plus one-time code. No password, extension,
+   separate wallet app, passkey ceremony, or recovery phrase in the payment
+   path. Offer a second recovery/login method later, after the tip.
+
+4. **Balance check.** The account has `$0`. Show:
+   `Add $5; tip $3 now; $2 remains for later tips.` Coinbase's hosted onramp has
+   a $5 minimum, so a $1–$4 first tip cannot honestly be funded for exactly the
+   tip amount. Button: `Add with Coinbase`; secondary option: card/Apple Pay
+   where eligible.
+
+5. **Coinbase handoff.** In Coinbase's hosted flow, choose `Sign in to Coinbase`.
+   The reader signs into the old account and completes Coinbase 2FA if requested.
+   This is authentication to Coinbase, not creation of another Coinbase
+   account.
+
+6. **Funding source.** Coinbase shows eligible cash/crypto balances and saved
+   bank/debit methods. Reader chooses one, then chooses `USDC on Base`, amount
+   `$5`. If the Coinbase account is unfunded, they must fund it with a linked
+   method; holds, eligibility, limits, identity checks, and disclosed onramp
+   fees may apply.
+
+7. **Funding review.** Show debit, fees, `You receive`, destination (the
+   newsletter tipping account), asset `USDC`, network `Base`, and timing. Reader
+   confirms. Coinbase sends/buys the Base USDC. Do not promise “free” until this
+   screen returns the actual quote.
+
+8. **Return to tip sheet.** After the onramp webhook and onchain balance confirm,
+   show `Balance: $5.00` and the original `$3` tip still selected. Do not make
+   the reader find the dish again.
+
+9. **Final review.** Show `Tip Maria $3.00`, `Maria receives $3.00 USDC`,
+   `Network fee: sponsored ($0)`, remaining balance `$2.00`, shortened/copyable
+   recipient address, and `Onchain tips cannot be reversed`. Button: `Send tip`.
+
+10. **Authorization and pending state.** The embedded account authorizes the
+    USDC transfer; the app/paymaster supplies Base gas. Keep the button disabled
+    and show `Sending…` until confirmation. There is no separate USDC approval:
+    this is a direct token transfer, not a contract spend.
+
+11. **Success.** Show `Maria received $3.00`, cook/dish, time, remaining balance,
+    transaction link, receipt/support link, and `Tip again`. A failure screen
+    must preserve the balance and selection, explain whether nothing was sent,
+    and offer retry.
+
+The first tip therefore requires two distinct one-time actions: create the
+newsletter's embedded account, then move at least $5 into it. Having Coinbase
+reduces the second action to a familiar login and existing balance/payment
+method; it does not make the Coinbase custodial account itself the embedded
+wallet.
+
+## Cook side, required before launch
+
+Each cook needs a verified Base receiving address. Prefer the same embedded
+account pattern, with strong recovery and optional automatic Coinbase off-ramp.
+Before publishing a tip button, the cook must:
+
+1. accept the program terms and identity/tax disclosures;
+2. create or connect an account and prove control of it;
+3. choose to retain USDC or link Coinbase/bank withdrawal;
+4. complete any required identity verification;
+5. receive and cash out a test tip.
+
+The dish-to-address mapping needs two-person review and an emergency disable.
+Changing a cook's address must require re-verification. Clearly define whether
+the cook, restaurant, or newsletter handles refunds, mistaken attribution,
+tax reporting, sanctions screening, and lost-account support.
+
+## When this setup becomes the wrong one
+
+Change the setup when the product changes in one of these ways:
+
+- **A tip must feel like an exact $1 card charge with no prefunding or leftover
+  balance.** The $5 onramp minimum and two-step first purchase are then fatal.
+  Use conventional card/Apple Pay checkout through a licensed payment processor,
+  aggregate fiat, and pay cooks through a compliant payout product. This is no
+  longer a direct reader-to-cook onchain transfer.
+
+- **Readers will tip once, not repeatedly.** An embedded wallet and stored USDC
+  impose setup without enough future benefit. Use ordinary checkout and payouts,
+  or let Coinbase-hosted payment links handle the whole transaction.
+
+- **Most readers cease to be Coinbase users, or Coinbase/onramp coverage is weak
+  in the city.** Make wallet/onramp providers interchangeable or choose rails
+  matching the audience's existing accounts. Do not keep Base solely for brand
+  affinity.
+
+- **Cooks require dollars in a bank account immediately, with guaranteed net
+  amounts.** Add managed off-ramp/payout orchestration. If the newsletter
+  guarantees settlement, batches funds, or absorbs failures, it becomes a
+  payments/compliance product; use licensed partners and obtain counsel before
+  launch.
+
+- **The newsletter needs refunds, chargebacks, moderation, escrow, matching
+  funds, splits, delayed release, or restaurant revenue sharing.** A direct
+  irreversible transfer no longer implements the rules. Prefer an offchain
+  ledger plus regulated payouts for reversible flows. Use a narrowly scoped,
+  audited contract only if trustless onchain escrow/splitting is itself a product
+  requirement.
+
+- **Tips must be private.** Base transfers expose addresses, amounts, timing, and
+  linkage patterns. Use conventional payment rails or a deliberately designed
+  privacy system; an embedded wallet does not make a public chain private.
+
+- **Cooks cannot reliably manage or recover self-custodied accounts.** Use
+  custodial/managed payouts instead of calling the transfer “direct.” Recovery
+  support is part of the product, not an edge case.
+
+- **Tips become large, infrequent, or need Ethereum-mainnet composability.**
+  Reconsider Base, sponsorship limits, confirmation policy, and account security.
+  Base's main advantages here are consumer onboarding, speed, and micropayment
+  economics.
+
+- **Volume or abuse changes materially.** Thousands per week are operationally
+  modest, but issue-day bursts require onramp, RPC, webhook, and paymaster
+  capacity testing. Fraud, card chargebacks, bot tips, or sponsored-gas abuse
+  may force per-user limits, risk checks, prepaid balances, or conventional
+  checkout.
+
+## Commit gates
+
+Before building, validate the riskiest assumption with a clickable prototype:
+measure completion from `$3 tip` through the real Coinbase sandbox/onramp flow.
+Set explicit gates for first-tip completion, time to tip, repeat-tip rate, and
+support contacts. Test separately with funded Coinbase users, unfunded Coinbase
+users, and people without Coinbase.
+
+Also obtain payments counsel on money-transmission, consumer disclosures,
+sanctions/KYC, tax reporting, tips/wage law, and whether the newsletter's exact
+data and support practices create custody or control. Architecture can reduce
+custody; labels cannot.
+
+Current product references:
+
+- [Coinbase-hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)
+- [Embedded-wallet/onramp demo and gasless Base transfers](https://docs.cdp.coinbase.com/get-started/demo-apps/starter/onramp-demo-app)
+- [Coinbase send behavior](https://help.coinbase.com/en/coinbase/trading-and-funding/cryptocurrency-trading-pairs/steps-to-send-crypto)

diff --git a/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0b690f01a0674f93481604c114bf87f5e3557677
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,169 @@
+# Recommended setup
+
+Use native USDC on Base. Give each reader an email-authenticated embedded smart
+account and sponsor its gas. Send each tip directly from the reader's account to
+the cook's Base address. Use Coinbase Onramp to move an existing Coinbase
+balance, or a linked bank/card, into the reader's embedded account.
+
+Build no custom contract for the MVP. The newsletter backend should keep the
+dish-to-cook address mapping, create short-lived funding sessions, and record
+transaction hashes for receipts/support. It must never hold reader or cook
+funds.
+
+This fits the audience: no extension, wallet app, seed phrase, ETH purchase,
+network switch, token approval, bridge, or reader-paid gas. Base fits the
+Coinbase-heavy audience and bursty, low-value transfers; USDC keeps the displayed
+and received amount in dollars.
+
+## First tip, screen by screen
+
+Assume a first-time reader has an old, usable Coinbase account but no onchain
+wallet and no USDC already in the newsletter wallet.
+
+1. **Newsletter story.** Under the dish: `Tip Maria, line cook` with `$1`, `$3`,
+   `$5`, and `Other`. The reader taps `$3`.
+
+2. **Tip sheet.** Show cook name/photo, restaurant, dish, `Maria receives 3.00
+   USDC (about $3)`, `Network fee: $0`, and a brief notice that the payment is
+   final and the cook controls the receiving account. Button: `Continue`.
+
+3. **Create/restore account.** Ask for email, then show the one-time-code screen.
+   Entered code creates or restores an embedded smart account. Say plainly:
+   `This creates your tipping account.` Do not call it “Connect Wallet.”
+
+   Installation: none. Signup: email plus one-time code. No password, extension,
+   separate wallet app, passkey ceremony, or recovery phrase in the payment
+   path. Offer a second recovery/login method later, after the tip.
+
+4. **Balance check.** The account has `$0`. Show:
+   `Add $5; tip $3 now; $2 remains for later tips.` Coinbase's hosted onramp has
+   a $5 minimum, so a $1–$4 first tip cannot honestly be funded for exactly the
+   tip amount. Button: `Add with Coinbase`; secondary option: card/Apple Pay
+   where eligible.
+
+5. **Coinbase handoff.** In Coinbase's hosted flow, choose `Sign in to Coinbase`.
+   The reader signs into the old account and completes Coinbase 2FA if requested.
+   This is authentication to Coinbase, not creation of another Coinbase
+   account.
+
+6. **Funding source.** Coinbase shows eligible cash/crypto balances and saved
+   bank/debit methods. Reader chooses one, then chooses `USDC on Base`, amount
+   `$5`. If the Coinbase account is unfunded, they must fund it with a linked
+   method; holds, eligibility, limits, identity checks, and disclosed onramp
+   fees may apply.
+
+7. **Funding review.** Show debit, fees, `You receive`, destination (the
+   newsletter tipping account), asset `USDC`, network `Base`, and timing. Reader
+   confirms. Coinbase sends/buys the Base USDC. Do not promise “free” until this
+   screen returns the actual quote.
+
+8. **Return to tip sheet.** After the onramp webhook and onchain balance confirm,
+   show `Balance: $5.00` and the original `$3` tip still selected. Do not make
+   the reader find the dish again.
+
+9. **Final review.** Show `Tip Maria $3.00`, `Maria receives $3.00 USDC`,
+   `Network fee: sponsored ($0)`, remaining balance `$2.00`, shortened/copyable
+   recipient address, and `Onchain tips cannot be reversed`. Button: `Send tip`.
+
+10. **Authorization and pending state.** The embedded account authorizes the
+    USDC transfer; the app/paymaster supplies Base gas. Keep the button disabled
+    and show `Sending…` until confirmation. There is no separate USDC approval:
+    this is a direct token transfer, not a contract spend.
+
+11. **Success.** Show `Maria received $3.00`, cook/dish, time, remaining balance,
+    transaction link, receipt/support link, and `Tip again`. A failure screen
+    must preserve the balance and selection, explain whether nothing was sent,
+    and offer retry.
+
+The first tip therefore requires two distinct one-time actions: create the
+newsletter's embedded account, then move at least $5 into it. Having Coinbase
+reduces the second action to a familiar login and existing balance/payment
+method; it does not make the Coinbase custodial account itself the embedded
+wallet.
+
+## Cook side, required before launch
+
+Each cook needs a verified Base receiving address. Prefer the same embedded
+account pattern, with strong recovery and optional automatic Coinbase off-ramp.
+Before publishing a tip button, the cook must:
+
+1. accept the program terms and identity/tax disclosures;
+2. create or connect an account and prove control of it;
+3. choose to retain USDC or link Coinbase/bank withdrawal;
+4. complete any required identity verification;
+5. receive and cash out a test tip.
+
+The dish-to-address mapping needs two-person review and an emergency disable.
+Changing a cook's address must require re-verification. Clearly define whether
+the cook, restaurant, or newsletter handles refunds, mistaken attribution,
+tax reporting, sanctions screening, and lost-account support.
+
+## When this setup becomes the wrong one
+
+Change the setup when the product changes in one of these ways:
+
+- **A tip must feel like an exact $1 card charge with no prefunding or leftover
+  balance.** The $5 onramp minimum and two-step first purchase are then fatal.
+  Use conventional card/Apple Pay checkout through a licensed payment processor,
+  aggregate fiat, and pay cooks through a compliant payout product. This is no
+  longer a direct reader-to-cook onchain transfer.
+
+- **Readers will tip once, not repeatedly.** An embedded wallet and stored USDC
+  impose setup without enough future benefit. Use ordinary checkout and payouts,
+  or let Coinbase-hosted payment links handle the whole transaction.
+
+- **Most readers cease to be Coinbase users, or Coinbase/onramp coverage is weak
+  in the city.** Make wallet/onramp providers interchangeable or choose rails
+  matching the audience's existing accounts. Do not keep Base solely for brand
+  affinity.
+
+- **Cooks require dollars in a bank account immediately, with guaranteed net
+  amounts.** Add managed off-ramp/payout orchestration. If the newsletter
+  guarantees settlement, batches funds, or absorbs failures, it becomes a
+  payments/compliance product; use licensed partners and obtain counsel before
+  launch.
+
+- **The newsletter needs refunds, chargebacks, moderation, escrow, matching
+  funds, splits, delayed release, or restaurant revenue sharing.** A direct
+  irreversible transfer no longer implements the rules. Prefer an offchain
+  ledger plus regulated payouts for reversible flows. Use a narrowly scoped,
+  audited contract only if trustless onchain escrow/splitting is itself a product
+  requirement.
+
+- **Tips must be private.** Base transfers expose addresses, amounts, timing, and
+  linkage patterns. Use conventional payment rails or a deliberately designed
+  privacy system; an embedded wallet does not make a public chain private.
+
+- **Cooks cannot reliably manage or recover self-custodied accounts.** Use
+  custodial/managed payouts instead of calling the transfer “direct.” Recovery
+  support is part of the product, not an edge case.
+
+- **Tips become large, infrequent, or need Ethereum-mainnet composability.**
+  Reconsider Base, sponsorship limits, confirmation policy, and account security.
+  Base's main advantages here are consumer onboarding, speed, and micropayment
+  economics.
+
+- **Volume or abuse changes materially.** Thousands per week are operationally
+  modest, but issue-day bursts require onramp, RPC, webhook, and paymaster
+  capacity testing. Fraud, card chargebacks, bot tips, or sponsored-gas abuse
+  may force per-user limits, risk checks, prepaid balances, or conventional
+  checkout.
+
+## Commit gates
+
+Before building, validate the riskiest assumption with a clickable prototype:
+measure completion from `$3 tip` through the real Coinbase sandbox/onramp flow.
+Set explicit gates for first-tip completion, time to tip, repeat-tip rate, and
+support contacts. Test separately with funded Coinbase users, unfunded Coinbase
+users, and people without Coinbase.
+
+Also obtain payments counsel on money-transmission, consumer disclosures,
+sanctions/KYC, tax reporting, tips/wage law, and whether the newsletter's exact
+data and support practices create custody or control. Architecture can reduce
+custody; labels cannot.
+
+Current product references:
+
+- [Coinbase-hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)
+- [Embedded-wallet/onramp demo and gasless Base transfers](https://docs.cdp.coinbase.com/get-started/demo-apps/starter/onramp-demo-app)
+- [Coinbase send behavior](https://help.coinbase.com/en/coinbase/trading-and-funding/cryptocurrency-trading-pairs/steps-to-send-crypto)

codex
The ship skill requires a brief feedback step before finishing; I’m doing that now, then I’ll hand off the file.
exec
/bin/bash -lc "curl -fsSL https://ethskills.com/feedback/SKILL.md -o /tmp/feedback-SKILL.md && sed -n '1,240p' /tmp/feedback-SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace
 succeeded in 10ms:
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

diff --git a/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0b690f01a0674f93481604c114bf87f5e3557677
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,169 @@
+# Recommended setup
+
+Use native USDC on Base. Give each reader an email-authenticated embedded smart
+account and sponsor its gas. Send each tip directly from the reader's account to
+the cook's Base address. Use Coinbase Onramp to move an existing Coinbase
+balance, or a linked bank/card, into the reader's embedded account.
+
+Build no custom contract for the MVP. The newsletter backend should keep the
+dish-to-cook address mapping, create short-lived funding sessions, and record
+transaction hashes for receipts/support. It must never hold reader or cook
+funds.
+
+This fits the audience: no extension, wallet app, seed phrase, ETH purchase,
+network switch, token approval, bridge, or reader-paid gas. Base fits the
+Coinbase-heavy audience and bursty, low-value transfers; USDC keeps the displayed
+and received amount in dollars.
+
+## First tip, screen by screen
+
+Assume a first-time reader has an old, usable Coinbase account but no onchain
+wallet and no USDC already in the newsletter wallet.
+
+1. **Newsletter story.** Under the dish: `Tip Maria, line cook` with `$1`, `$3`,
+   `$5`, and `Other`. The reader taps `$3`.
+
+2. **Tip sheet.** Show cook name/photo, restaurant, dish, `Maria receives 3.00
+   USDC (about $3)`, `Network fee: $0`, and a brief notice that the payment is
+   final and the cook controls the receiving account. Button: `Continue`.
+
+3. **Create/restore account.** Ask for email, then show the one-time-code screen.
+   Entered code creates or restores an embedded smart account. Say plainly:
+   `This creates your tipping account.` Do not call it “Connect Wallet.”
+
+   Installation: none. Signup: email plus one-time code. No password, extension,
+   separate wallet app, passkey ceremony, or recovery phrase in the payment
+   path. Offer a second recovery/login method later, after the tip.
+
+4. **Balance check.** The account has `$0`. Show:
+   `Add $5; tip $3 now; $2 remains for later tips.` Coinbase's hosted onramp has
+   a $5 minimum, so a $1–$4 first tip cannot honestly be funded for exactly the
+   tip amount. Button: `Add with Coinbase`; secondary option: card/Apple Pay
+   where eligible.
+
+5. **Coinbase handoff.** In Coinbase's hosted flow, choose `Sign in to Coinbase`.
+   The reader signs into the old account and completes Coinbase 2FA if requested.
+   This is authentication to Coinbase, not creation of another Coinbase
+   account.
+
+6. **Funding source.** Coinbase shows eligible cash/crypto balances and saved
+   bank/debit methods. Reader chooses one, then chooses `USDC on Base`, amount
+   `$5`. If the Coinbase account is unfunded, they must fund it with a linked
+   method; holds, eligibility, limits, identity checks, and disclosed onramp
+   fees may apply.
+
+7. **Funding review.** Show debit, fees, `You receive`, destination (the
+   newsletter tipping account), asset `USDC`, network `Base`, and timing. Reader
+   confirms. Coinbase sends/buys the Base USDC. Do not promise “free” until this
+   screen returns the actual quote.
+
+8. **Return to tip sheet.** After the onramp webhook and onchain balance confirm,
+   show `Balance: $5.00` and the original `$3` tip still selected. Do not make
+   the reader find the dish again.
+
+9. **Final review.** Show `Tip Maria $3.00`, `Maria receives $3.00 USDC`,
+   `Network fee: sponsored ($0)`, remaining balance `$2.00`, shortened/copyable
+   recipient address, and `Onchain tips cannot be reversed`. Button: `Send tip`.
+
+10. **Authorization and pending state.** The embedded account authorizes the
+    USDC transfer; the app/paymaster supplies Base gas. Keep the button disabled
+    and show `Sending…` until confirmation. There is no separate USDC approval:
+    this is a direct token transfer, not a contract spend.
+
+11. **Success.** Show `Maria received $3.00`, cook/dish, time, remaining balance,
+    transaction link, receipt/support link, and `Tip again`. A failure screen
+    must preserve the balance and selection, explain whether nothing was sent,
+    and offer retry.
+
+The first tip therefore requires two distinct one-time actions: create the
+newsletter's embedded account, then move at least $5 into it. Having Coinbase
+reduces the second action to a familiar login and existing balance/payment
+method; it does not make the Coinbase custodial account itself the embedded
+wallet.
+
+## Cook side, required before launch
+
+Each cook needs a verified Base receiving address. Prefer the same embedded
+account pattern, with strong recovery and optional automatic Coinbase off-ramp.
+Before publishing a tip button, the cook must:
+
+1. accept the program terms and identity/tax disclosures;
+2. create or connect an account and prove control of it;
+3. choose to retain USDC or link Coinbase/bank withdrawal;
+4. complete any required identity verification;
+5. receive and cash out a test tip.
+
+The dish-to-address mapping needs two-person review and an emergency disable.
+Changing a cook's address must require re-verification. Clearly define whether
+the cook, restaurant, or newsletter handles refunds, mistaken attribution,
+tax reporting, sanctions screening, and lost-account support.
+
+## When this setup becomes the wrong one
+
+Change the setup when the product changes in one of these ways:
+
+- **A tip must feel like an exact $1 card charge with no prefunding or leftover
+  balance.** The $5 onramp minimum and two-step first purchase are then fatal.
+  Use conventional card/Apple Pay checkout through a licensed payment processor,
+  aggregate fiat, and pay cooks through a compliant payout product. This is no
+  longer a direct reader-to-cook onchain transfer.
+
+- **Readers will tip once, not repeatedly.** An embedded wallet and stored USDC
+  impose setup without enough future benefit. Use ordinary checkout and payouts,
+  or let Coinbase-hosted payment links handle the whole transaction.
+
+- **Most readers cease to be Coinbase users, or Coinbase/onramp coverage is weak
+  in the city.** Make wallet/onramp providers interchangeable or choose rails
+  matching the audience's existing accounts. Do not keep Base solely for brand
+  affinity.
+
+- **Cooks require dollars in a bank account immediately, with guaranteed net
+  amounts.** Add managed off-ramp/payout orchestration. If the newsletter
+  guarantees settlement, batches funds, or absorbs failures, it becomes a
+  payments/compliance product; use licensed partners and obtain counsel before
+  launch.
+
+- **The newsletter needs refunds, chargebacks, moderation, escrow, matching
+  funds, splits, delayed release, or restaurant revenue sharing.** A direct
+  irreversible transfer no longer implements the rules. Prefer an offchain
+  ledger plus regulated payouts for reversible flows. Use a narrowly scoped,
+  audited contract only if trustless onchain escrow/splitting is itself a product
+  requirement.
+
+- **Tips must be private.** Base transfers expose addresses, amounts, timing, and
+  linkage patterns. Use conventional payment rails or a deliberately designed
+  privacy system; an embedded wallet does not make a public chain private.
+
+- **Cooks cannot reliably manage or recover self-custodied accounts.** Use
+  custodial/managed payouts instead of calling the transfer “direct.” Recovery
+  support is part of the product, not an edge case.
+
+- **Tips become large, infrequent, or need Ethereum-mainnet composability.**
+  Reconsider Base, sponsorship limits, confirmation policy, and account security.
+  Base's main advantages here are consumer onboarding, speed, and micropayment
+  economics.
+
+- **Volume or abuse changes materially.** Thousands per week are operationally
+  modest, but issue-day bursts require onramp, RPC, webhook, and paymaster
+  capacity testing. Fraud, card chargebacks, bot tips, or sponsored-gas abuse
+  may force per-user limits, risk checks, prepaid balances, or conventional
+  checkout.
+
+## Commit gates
+
+Before building, validate the riskiest assumption with a clickable prototype:
+measure completion from `$3 tip` through the real Coinbase sandbox/onramp flow.
+Set explicit gates for first-tip completion, time to tip, repeat-tip rate, and
+support contacts. Test separately with funded Coinbase users, unfunded Coinbase
+users, and people without Coinbase.
+
+Also obtain payments counsel on money-transmission, consumer disclosures,
+sanctions/KYC, tax reporting, tips/wage law, and whether the newsletter's exact
+data and support practices create custody or control. Architecture can reduce
+custody; labels cannot.
+
+Current product references:
+
+- [Coinbase-hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)
+- [Embedded-wallet/onramp demo and gasless Base transfers](https://docs.cdp.coinbase.com/get-started/demo-apps/starter/onramp-demo-app)
+- [Coinbase send behavior](https://help.coinbase.com/en/coinbase/trading-and-funding/cryptocurrency-trading-pairs/steps-to-send-crypto)

codex
Completed [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md).

May I send this skill feedback?

- kind: praise
- message: “Ship’s Base/Coinbase onboarding guidance clarified the right architecture for consumer micropayments.”
- skill: `ship/SKILL.md`
- agent: Codex
diff --git a/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0b690f01a0674f93481604c114bf87f5e3557677
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,169 @@
+# Recommended setup
+
+Use native USDC on Base. Give each reader an email-authenticated embedded smart
+account and sponsor its gas. Send each tip directly from the reader's account to
+the cook's Base address. Use Coinbase Onramp to move an existing Coinbase
+balance, or a linked bank/card, into the reader's embedded account.
+
+Build no custom contract for the MVP. The newsletter backend should keep the
+dish-to-cook address mapping, create short-lived funding sessions, and record
+transaction hashes for receipts/support. It must never hold reader or cook
+funds.
+
+This fits the audience: no extension, wallet app, seed phrase, ETH purchase,
+network switch, token approval, bridge, or reader-paid gas. Base fits the
+Coinbase-heavy audience and bursty, low-value transfers; USDC keeps the displayed
+and received amount in dollars.
+
+## First tip, screen by screen
+
+Assume a first-time reader has an old, usable Coinbase account but no onchain
+wallet and no USDC already in the newsletter wallet.
+
+1. **Newsletter story.** Under the dish: `Tip Maria, line cook` with `$1`, `$3`,
+   `$5`, and `Other`. The reader taps `$3`.
+
+2. **Tip sheet.** Show cook name/photo, restaurant, dish, `Maria receives 3.00
+   USDC (about $3)`, `Network fee: $0`, and a brief notice that the payment is
+   final and the cook controls the receiving account. Button: `Continue`.
+
+3. **Create/restore account.** Ask for email, then show the one-time-code screen.
+   Entered code creates or restores an embedded smart account. Say plainly:
+   `This creates your tipping account.` Do not call it “Connect Wallet.”
+
+   Installation: none. Signup: email plus one-time code. No password, extension,
+   separate wallet app, passkey ceremony, or recovery phrase in the payment
+   path. Offer a second recovery/login method later, after the tip.
+
+4. **Balance check.** The account has `$0`. Show:
+   `Add $5; tip $3 now; $2 remains for later tips.` Coinbase's hosted onramp has
+   a $5 minimum, so a $1–$4 first tip cannot honestly be funded for exactly the
+   tip amount. Button: `Add with Coinbase`; secondary option: card/Apple Pay
+   where eligible.
+
+5. **Coinbase handoff.** In Coinbase's hosted flow, choose `Sign in to Coinbase`.
+   The reader signs into the old account and completes Coinbase 2FA if requested.
+   This is authentication to Coinbase, not creation of another Coinbase
+   account.
+
+6. **Funding source.** Coinbase shows eligible cash/crypto balances and saved
+   bank/debit methods. Reader chooses one, then chooses `USDC on Base`, amount
+   `$5`. If the Coinbase account is unfunded, they must fund it with a linked
+   method; holds, eligibility, limits, identity checks, and disclosed onramp
+   fees may apply.
+
+7. **Funding review.** Show debit, fees, `You receive`, destination (the
+   newsletter tipping account), asset `USDC`, network `Base`, and timing. Reader
+   confirms. Coinbase sends/buys the Base USDC. Do not promise “free” until this
+   screen returns the actual quote.
+
+8. **Return to tip sheet.** After the onramp webhook and onchain balance confirm,
+   show `Balance: $5.00` and the original `$3` tip still selected. Do not make
+   the reader find the dish again.
+
+9. **Final review.** Show `Tip Maria $3.00`, `Maria receives $3.00 USDC`,
+   `Network fee: sponsored ($0)`, remaining balance `$2.00`, shortened/copyable
+   recipient address, and `Onchain tips cannot be reversed`. Button: `Send tip`.
+
+10. **Authorization and pending state.** The embedded account authorizes the
+    USDC transfer; the app/paymaster supplies Base gas. Keep the button disabled
+    and show `Sending…` until confirmation. There is no separate USDC approval:
+    this is a direct token transfer, not a contract spend.
+
+11. **Success.** Show `Maria received $3.00`, cook/dish, time, remaining balance,
+    transaction link, receipt/support link, and `Tip again`. A failure screen
+    must preserve the balance and selection, explain whether nothing was sent,
+    and offer retry.
+
+The first tip therefore requires two distinct one-time actions: create the
+newsletter's embedded account, then move at least $5 into it. Having Coinbase
+reduces the second action to a familiar login and existing balance/payment
+method; it does not make the Coinbase custodial account itself the embedded
+wallet.
+
+## Cook side, required before launch
+
+Each cook needs a verified Base receiving address. Prefer the same embedded
+account pattern, with strong recovery and optional automatic Coinbase off-ramp.
+Before publishing a tip button, the cook must:
+
+1. accept the program terms and identity/tax disclosures;
+2. create or connect an account and prove control of it;
+3. choose to retain USDC or link Coinbase/bank withdrawal;
+4. complete any required identity verification;
+5. receive and cash out a test tip.
+
+The dish-to-address mapping needs two-person review and an emergency disable.
+Changing a cook's address must require re-verification. Clearly define whether
+the cook, restaurant, or newsletter handles refunds, mistaken attribution,
+tax reporting, sanctions screening, and lost-account support.
+
+## When this setup becomes the wrong one
+
+Change the setup when the product changes in one of these ways:
+
+- **A tip must feel like an exact $1 card charge with no prefunding or leftover
+  balance.** The $5 onramp minimum and two-step first purchase are then fatal.
+  Use conventional card/Apple Pay checkout through a licensed payment processor,
+  aggregate fiat, and pay cooks through a compliant payout product. This is no
+  longer a direct reader-to-cook onchain transfer.
+
+- **Readers will tip once, not repeatedly.** An embedded wallet and stored USDC
+  impose setup without enough future benefit. Use ordinary checkout and payouts,
+  or let Coinbase-hosted payment links handle the whole transaction.
+
+- **Most readers cease to be Coinbase users, or Coinbase/onramp coverage is weak
+  in the city.** Make wallet/onramp providers interchangeable or choose rails
+  matching the audience's existing accounts. Do not keep Base solely for brand
+  affinity.
+
+- **Cooks require dollars in a bank account immediately, with guaranteed net
+  amounts.** Add managed off-ramp/payout orchestration. If the newsletter
+  guarantees settlement, batches funds, or absorbs failures, it becomes a
+  payments/compliance product; use licensed partners and obtain counsel before
+  launch.
+
+- **The newsletter needs refunds, chargebacks, moderation, escrow, matching
+  funds, splits, delayed release, or restaurant revenue sharing.** A direct
+  irreversible transfer no longer implements the rules. Prefer an offchain
+  ledger plus regulated payouts for reversible flows. Use a narrowly scoped,
+  audited contract only if trustless onchain escrow/splitting is itself a product
+  requirement.
+
+- **Tips must be private.** Base transfers expose addresses, amounts, timing, and
+  linkage patterns. Use conventional payment rails or a deliberately designed
+  privacy system; an embedded wallet does not make a public chain private.
+
+- **Cooks cannot reliably manage or recover self-custodied accounts.** Use
+  custodial/managed payouts instead of calling the transfer “direct.” Recovery
+  support is part of the product, not an edge case.
+
+- **Tips become large, infrequent, or need Ethereum-mainnet composability.**
+  Reconsider Base, sponsorship limits, confirmation policy, and account security.
+  Base's main advantages here are consumer onboarding, speed, and micropayment
+  economics.
+
+- **Volume or abuse changes materially.** Thousands per week are operationally
+  modest, but issue-day bursts require onramp, RPC, webhook, and paymaster
+  capacity testing. Fraud, card chargebacks, bot tips, or sponsored-gas abuse
+  may force per-user limits, risk checks, prepaid balances, or conventional
+  checkout.
+
+## Commit gates
+
+Before building, validate the riskiest assumption with a clickable prototype:
+measure completion from `$3 tip` through the real Coinbase sandbox/onramp flow.
+Set explicit gates for first-tip completion, time to tip, repeat-tip rate, and
+support contacts. Test separately with funded Coinbase users, unfunded Coinbase
+users, and people without Coinbase.
+
+Also obtain payments counsel on money-transmission, consumer disclosures,
+sanctions/KYC, tax reporting, tips/wage law, and whether the newsletter's exact
+data and support practices create custody or control. Architecture can reduce
+custody; labels cannot.
+
+Current product references:
+
+- [Coinbase-hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)
+- [Embedded-wallet/onramp demo and gasless Base transfers](https://docs.cdp.coinbase.com/get-started/demo-apps/starter/onramp-demo-app)
+- [Coinbase send behavior](https://help.coinbase.com/en/coinbase/trading-and-funding/cryptocurrency-trading-pairs/steps-to-send-crypto)

tokens used
53,348
Completed [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T202059Z-codex-with-skill-1/workspace/plan.md).

May I send this skill feedback?

- kind: praise
- message: “Ship’s Base/Coinbase onboarding guidance clarified the right architecture for consumer micropayments.”
- skill: `ship/SKILL.md`
- agent: Codex
