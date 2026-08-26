Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 019fb4a6-f481-7512-8ff2-726a5b069b96
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
I’m using the `ship` skill because this is an end-to-end dApp design question; it routes the relevant contract and liveness guidance.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace
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
/bin/bash -lc "rg --files .agents/skills | sort | sed -n '1,200p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace
 succeeded in 0ms:
.agents/skills/ship/SKILL.md

codex
Core finding: the stated default rule is not solvent by itself. Earlier USDC has already left in prior pots, and a member who already took their turn has nothing left to forfeit. I’m making that failure mode—and the caller/automation requirements—the center of the plan.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md
diff --git a/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..37392703bc673fe8e62e71bd63fb5e678cc5d9bc
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,109 @@
+# Onchain susu plan
+
+## Bottom line
+
+Running circles keep working for six weeks **only if every required transition is permissionless and somebody still sends the transactions**. A contract does not wake up when a deadline passes. If the current design relies on either founder to open a month, mark a missed payment, select the recipient, or send the pot, it stalls at that step while both founders are away.
+
+Even perfect automation does not fix the larger economic problem in the proposed rule: earlier contributions cannot cover a later missed payment if those contributions were already paid out in earlier $1,200 pots. The contract no longer holds them. Also, somebody who receives an early pot can then stop paying; forfeiting a turn they already took recovers nothing. The circle is unsecured unless members prefund or post collateral.
+
+Do not describe existing circles as guaranteed until both the liveness and solvency checks below pass.
+
+## Contract design
+
+Use one non-upgradeable `SusuCircle` contract per circle, or a small factory plus minimal-proxy circles. For an MVP, one implementation/factory system is enough. USDC is the only asset; amounts are raw 6-decimal units (`100e6`, not `100e18`). Use OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and checks-effects-interactions.
+
+Immutable circle terms:
+
+- USDC token address
+- exactly 12 unique member addresses
+- fixed recipient order, committed at creation
+- $100 installment, 12 rounds, $1,200 scheduled pot
+- start time and unambiguous payment/settlement deadlines
+- collateral policy
+
+State per member:
+
+- installments credited
+- collateral locked
+- whether their turn was paid or forfeited
+- amount claimed
+
+State per round:
+
+- due recipient
+- deadline
+- payer bitmap or equivalent
+- collected amount
+- settled flag
+
+Main functions:
+
+1. `fundCollateral()` / enrollment finalization  
+   Each member supplies enough escrow before activation. The safest simple design is full prefunding: $1,200 each, so the contract starts with $14,400 and every scheduled payout is guaranteed. A more capital-efficient design may require collateral equal to that member's maximum remaining obligation after their payout—position `k` (1–12) needs at least `(12 - k) * $100` immediately after receiving—but it is harder to explain and audit. Do not activate until the chosen collateral invariant holds for all members.
+
+2. `payInstallment(round)`  
+   A member transfers exactly $100 USDC before the round deadline. Never use infinite approval. Credit only the actual received amount; reject fee-on-transfer or otherwise nonconforming assets. If using full prefunding, this can instead replenish/release the member's escrow while the guarantee remains locked.
+
+3. `settleRound(round)`  
+   Callable by **any address** after the deadline (and optionally earlier once all 12 payments are present). It determines defaults from onchain deadlines, updates all state first, uses locked collateral for missing installments, and makes the scheduled $1,200 available to the recipient. It must not depend on a founder, backend, oracle, or manually supplied default list.
+
+4. `claim()`  
+   Pull-payment pattern: a recipient withdraws credited USDC themselves. If direct transfer during settlement fails, the circle must still advance and the credit must remain claimable. This prevents one blocked/faulty recipient from freezing everyone.
+
+5. `closeCircle()`  
+   After round 12, anyone can finalize; each member withdraws remaining collateral/refunds. No admin sweep of member funds.
+
+Emit events for activation, installment, default, collateral slash, round settlement, claim credit, claim, and closure. Prevent duplicate payment/settlement, wrong-round accounting, reentrancy, address duplication, order mutation, early withdrawal, and insolvency after every transition. Specify what happens if USDC freezes an address; pull claims isolate that account but cannot override USDC itself.
+
+### Correct default semantics
+
+“Forfeit their turn” alone is insufficient:
+
+- If their turn is still ahead, mark it forfeited, but that future forfeiture does not create cash for today's recipient unless funds are already escrowed.
+- If their turn already happened, slash their remaining collateral.
+- In either case, today's $1,200 must come from installments plus collateral already controlled by the contract.
+
+Define where a forfeited future pot goes (for example, pro-rata collateral refund to non-defaulting members at closure). Do not silently give it to founders or double-pay another member.
+
+## Six-week founder-absence audit
+
+For every deployed version and every active circle, answer from contract code and current onchain state:
+
+| Transition | Required caller | If nobody calls |
+| --- | --- | --- |
+| Member installment | each member or their approved smart account | that member defaults |
+| Deadline settlement | anyone / automation keeper | round remains unsettled; time passing changes no storage |
+| Recipient withdrawal | recipient | funds remain safely claimable |
+| Final close/refund | anyone, then each member | collateral remains locked |
+
+Existing circles survive founder absence only if:
+
+- no upcoming operation is `onlyOwner`, multisig-only, backend-only, or dependent on a founder-held key;
+- deadlines and recipient order are already stored onchain;
+- `settleRound` and finalization are permissionless, idempotent, and cannot be blocked by one member;
+- enough USDC/collateral is currently held to cover every promised payout;
+- members can still submit their monthly payments;
+- at least one independent caller will settle each due round.
+
+Automation (Gelato/Chainlink Automation/a bot) improves reliability but is still an offchain transaction sender. Fund it, monitor it, and have a permissionless manual fallback. Prefer two independent operators, one not controlled by the founders. Automation should call the same public function; it must not possess special correctness authority.
+
+## What exactly breaks if those conditions are absent
+
+- **Founder-only rollover/settlement:** first deadline during the trip passes, but state never advances; recipient cannot claim and later rounds may be blocked.
+- **Backend computes defaults/order:** backend outage or expired credentials prevents settlement, or lets its signer choose dishonest inputs.
+- **Push payout in the state-transition path:** a frozen/reverting recipient can revert settlement and freeze the circle.
+- **No collateral/prefund:** a missed $100 produces an $1,100 pot. “Earlier contributions” are already in recipients' wallets and cannot be clawed back.
+- **Early recipient defaults later:** their turn is already consumed, so forfeiture has zero recovery; remaining recipients bear the loss.
+- **Automation is the sole authorized caller:** an unfunded job, RPC failure, or paused subscription is the same liveness failure under a different owner.
+- **Admin pause/upgrade needed:** safety response and ordinary operation depend on keys the traveling team cannot use.
+
+## Before leaving
+
+1. Inventory every active circle: contract address/version, current round, next deadline, USDC balance, total claim liabilities, locked collateral, and required admin/caller.
+2. Simulate six weeks on a fork: missed payment before a member's turn, missed payment after their turn, all payments present, recipient USDC transfer failure, no settlement caller for several weeks, and late catch-up settlement.
+3. Prove after each scenario: `USDC balance >= claimable payouts + refundable collateral` under the contract's accounting.
+4. If existing immutable contracts have founder-only transitions, they cannot be repaired in place. Either keep the required signer/automation operational, or—with explicit member consent—pause before departure and migrate funds to an audited replacement. Do not claim migration is automatic.
+5. If existing circles lack collateral, disclose that payouts are not guaranteed. Options are member-approved top-up collateral, a separately funded loss reserve/guarantor, or accepting pro-rata short payouts. Code cannot manufacture the missing USDC.
+6. Configure funded independent automation plus alerts, publish manual settlement instructions, verify multisig/key access, and perform a live rehearsal before departure.
+
+The desirable invariant is simple: founders may disappear permanently and members can still pay, permissionlessly settle, claim, and close—while the contract already controls enough USDC to honor every credit it creates.

diff --git a/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..37392703bc673fe8e62e71bd63fb5e678cc5d9bc
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,109 @@
+# Onchain susu plan
+
+## Bottom line
+
+Running circles keep working for six weeks **only if every required transition is permissionless and somebody still sends the transactions**. A contract does not wake up when a deadline passes. If the current design relies on either founder to open a month, mark a missed payment, select the recipient, or send the pot, it stalls at that step while both founders are away.
+
+Even perfect automation does not fix the larger economic problem in the proposed rule: earlier contributions cannot cover a later missed payment if those contributions were already paid out in earlier $1,200 pots. The contract no longer holds them. Also, somebody who receives an early pot can then stop paying; forfeiting a turn they already took recovers nothing. The circle is unsecured unless members prefund or post collateral.
+
+Do not describe existing circles as guaranteed until both the liveness and solvency checks below pass.
+
+## Contract design
+
+Use one non-upgradeable `SusuCircle` contract per circle, or a small factory plus minimal-proxy circles. For an MVP, one implementation/factory system is enough. USDC is the only asset; amounts are raw 6-decimal units (`100e6`, not `100e18`). Use OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and checks-effects-interactions.
+
+Immutable circle terms:
+
+- USDC token address
+- exactly 12 unique member addresses
+- fixed recipient order, committed at creation
+- $100 installment, 12 rounds, $1,200 scheduled pot
+- start time and unambiguous payment/settlement deadlines
+- collateral policy
+
+State per member:
+
+- installments credited
+- collateral locked
+- whether their turn was paid or forfeited
+- amount claimed
+
+State per round:
+
+- due recipient
+- deadline
+- payer bitmap or equivalent
+- collected amount
+- settled flag
+
+Main functions:
+
+1. `fundCollateral()` / enrollment finalization  
+   Each member supplies enough escrow before activation. The safest simple design is full prefunding: $1,200 each, so the contract starts with $14,400 and every scheduled payout is guaranteed. A more capital-efficient design may require collateral equal to that member's maximum remaining obligation after their payout—position `k` (1–12) needs at least `(12 - k) * $100` immediately after receiving—but it is harder to explain and audit. Do not activate until the chosen collateral invariant holds for all members.
+
+2. `payInstallment(round)`  
+   A member transfers exactly $100 USDC before the round deadline. Never use infinite approval. Credit only the actual received amount; reject fee-on-transfer or otherwise nonconforming assets. If using full prefunding, this can instead replenish/release the member's escrow while the guarantee remains locked.
+
+3. `settleRound(round)`  
+   Callable by **any address** after the deadline (and optionally earlier once all 12 payments are present). It determines defaults from onchain deadlines, updates all state first, uses locked collateral for missing installments, and makes the scheduled $1,200 available to the recipient. It must not depend on a founder, backend, oracle, or manually supplied default list.
+
+4. `claim()`  
+   Pull-payment pattern: a recipient withdraws credited USDC themselves. If direct transfer during settlement fails, the circle must still advance and the credit must remain claimable. This prevents one blocked/faulty recipient from freezing everyone.
+
+5. `closeCircle()`  
+   After round 12, anyone can finalize; each member withdraws remaining collateral/refunds. No admin sweep of member funds.
+
+Emit events for activation, installment, default, collateral slash, round settlement, claim credit, claim, and closure. Prevent duplicate payment/settlement, wrong-round accounting, reentrancy, address duplication, order mutation, early withdrawal, and insolvency after every transition. Specify what happens if USDC freezes an address; pull claims isolate that account but cannot override USDC itself.
+
+### Correct default semantics
+
+“Forfeit their turn” alone is insufficient:
+
+- If their turn is still ahead, mark it forfeited, but that future forfeiture does not create cash for today's recipient unless funds are already escrowed.
+- If their turn already happened, slash their remaining collateral.
+- In either case, today's $1,200 must come from installments plus collateral already controlled by the contract.
+
+Define where a forfeited future pot goes (for example, pro-rata collateral refund to non-defaulting members at closure). Do not silently give it to founders or double-pay another member.
+
+## Six-week founder-absence audit
+
+For every deployed version and every active circle, answer from contract code and current onchain state:
+
+| Transition | Required caller | If nobody calls |
+| --- | --- | --- |
+| Member installment | each member or their approved smart account | that member defaults |
+| Deadline settlement | anyone / automation keeper | round remains unsettled; time passing changes no storage |
+| Recipient withdrawal | recipient | funds remain safely claimable |
+| Final close/refund | anyone, then each member | collateral remains locked |
+
+Existing circles survive founder absence only if:
+
+- no upcoming operation is `onlyOwner`, multisig-only, backend-only, or dependent on a founder-held key;
+- deadlines and recipient order are already stored onchain;
+- `settleRound` and finalization are permissionless, idempotent, and cannot be blocked by one member;
+- enough USDC/collateral is currently held to cover every promised payout;
+- members can still submit their monthly payments;
+- at least one independent caller will settle each due round.
+
+Automation (Gelato/Chainlink Automation/a bot) improves reliability but is still an offchain transaction sender. Fund it, monitor it, and have a permissionless manual fallback. Prefer two independent operators, one not controlled by the founders. Automation should call the same public function; it must not possess special correctness authority.
+
+## What exactly breaks if those conditions are absent
+
+- **Founder-only rollover/settlement:** first deadline during the trip passes, but state never advances; recipient cannot claim and later rounds may be blocked.
+- **Backend computes defaults/order:** backend outage or expired credentials prevents settlement, or lets its signer choose dishonest inputs.
+- **Push payout in the state-transition path:** a frozen/reverting recipient can revert settlement and freeze the circle.
+- **No collateral/prefund:** a missed $100 produces an $1,100 pot. “Earlier contributions” are already in recipients' wallets and cannot be clawed back.
+- **Early recipient defaults later:** their turn is already consumed, so forfeiture has zero recovery; remaining recipients bear the loss.
+- **Automation is the sole authorized caller:** an unfunded job, RPC failure, or paused subscription is the same liveness failure under a different owner.
+- **Admin pause/upgrade needed:** safety response and ordinary operation depend on keys the traveling team cannot use.
+
+## Before leaving
+
+1. Inventory every active circle: contract address/version, current round, next deadline, USDC balance, total claim liabilities, locked collateral, and required admin/caller.
+2. Simulate six weeks on a fork: missed payment before a member's turn, missed payment after their turn, all payments present, recipient USDC transfer failure, no settlement caller for several weeks, and late catch-up settlement.
+3. Prove after each scenario: `USDC balance >= claimable payouts + refundable collateral` under the contract's accounting.
+4. If existing immutable contracts have founder-only transitions, they cannot be repaired in place. Either keep the required signer/automation operational, or—with explicit member consent—pause before departure and migrate funds to an audited replacement. Do not claim migration is automatic.
+5. If existing circles lack collateral, disclose that payouts are not guaranteed. Options are member-approved top-up collateral, a separately funded loss reserve/guarantor, or accepting pro-rata short payouts. Code cannot manufacture the missing USDC.
+6. Configure funded independent automation plus alerts, publish manual settlement instructions, verify multisig/key access, and perform a live rehearsal before departure.
+
+The desirable invariant is simple: founders may disappear permanently and members can still pay, permissionlessly settle, claim, and close—while the contract already controls enough USDC to honor every credit it creates.

codex
Created [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md).

Key finding: founder absence is safe only with permissionless settlement and independent callers. Current default concept is insolvent without prefunding/collateral because earlier contributions have already been paid out.
diff --git a/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..37392703bc673fe8e62e71bd63fb5e678cc5d9bc
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,109 @@
+# Onchain susu plan
+
+## Bottom line
+
+Running circles keep working for six weeks **only if every required transition is permissionless and somebody still sends the transactions**. A contract does not wake up when a deadline passes. If the current design relies on either founder to open a month, mark a missed payment, select the recipient, or send the pot, it stalls at that step while both founders are away.
+
+Even perfect automation does not fix the larger economic problem in the proposed rule: earlier contributions cannot cover a later missed payment if those contributions were already paid out in earlier $1,200 pots. The contract no longer holds them. Also, somebody who receives an early pot can then stop paying; forfeiting a turn they already took recovers nothing. The circle is unsecured unless members prefund or post collateral.
+
+Do not describe existing circles as guaranteed until both the liveness and solvency checks below pass.
+
+## Contract design
+
+Use one non-upgradeable `SusuCircle` contract per circle, or a small factory plus minimal-proxy circles. For an MVP, one implementation/factory system is enough. USDC is the only asset; amounts are raw 6-decimal units (`100e6`, not `100e18`). Use OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and checks-effects-interactions.
+
+Immutable circle terms:
+
+- USDC token address
+- exactly 12 unique member addresses
+- fixed recipient order, committed at creation
+- $100 installment, 12 rounds, $1,200 scheduled pot
+- start time and unambiguous payment/settlement deadlines
+- collateral policy
+
+State per member:
+
+- installments credited
+- collateral locked
+- whether their turn was paid or forfeited
+- amount claimed
+
+State per round:
+
+- due recipient
+- deadline
+- payer bitmap or equivalent
+- collected amount
+- settled flag
+
+Main functions:
+
+1. `fundCollateral()` / enrollment finalization  
+   Each member supplies enough escrow before activation. The safest simple design is full prefunding: $1,200 each, so the contract starts with $14,400 and every scheduled payout is guaranteed. A more capital-efficient design may require collateral equal to that member's maximum remaining obligation after their payout—position `k` (1–12) needs at least `(12 - k) * $100` immediately after receiving—but it is harder to explain and audit. Do not activate until the chosen collateral invariant holds for all members.
+
+2. `payInstallment(round)`  
+   A member transfers exactly $100 USDC before the round deadline. Never use infinite approval. Credit only the actual received amount; reject fee-on-transfer or otherwise nonconforming assets. If using full prefunding, this can instead replenish/release the member's escrow while the guarantee remains locked.
+
+3. `settleRound(round)`  
+   Callable by **any address** after the deadline (and optionally earlier once all 12 payments are present). It determines defaults from onchain deadlines, updates all state first, uses locked collateral for missing installments, and makes the scheduled $1,200 available to the recipient. It must not depend on a founder, backend, oracle, or manually supplied default list.
+
+4. `claim()`  
+   Pull-payment pattern: a recipient withdraws credited USDC themselves. If direct transfer during settlement fails, the circle must still advance and the credit must remain claimable. This prevents one blocked/faulty recipient from freezing everyone.
+
+5. `closeCircle()`  
+   After round 12, anyone can finalize; each member withdraws remaining collateral/refunds. No admin sweep of member funds.
+
+Emit events for activation, installment, default, collateral slash, round settlement, claim credit, claim, and closure. Prevent duplicate payment/settlement, wrong-round accounting, reentrancy, address duplication, order mutation, early withdrawal, and insolvency after every transition. Specify what happens if USDC freezes an address; pull claims isolate that account but cannot override USDC itself.
+
+### Correct default semantics
+
+“Forfeit their turn” alone is insufficient:
+
+- If their turn is still ahead, mark it forfeited, but that future forfeiture does not create cash for today's recipient unless funds are already escrowed.
+- If their turn already happened, slash their remaining collateral.
+- In either case, today's $1,200 must come from installments plus collateral already controlled by the contract.
+
+Define where a forfeited future pot goes (for example, pro-rata collateral refund to non-defaulting members at closure). Do not silently give it to founders or double-pay another member.
+
+## Six-week founder-absence audit
+
+For every deployed version and every active circle, answer from contract code and current onchain state:
+
+| Transition | Required caller | If nobody calls |
+| --- | --- | --- |
+| Member installment | each member or their approved smart account | that member defaults |
+| Deadline settlement | anyone / automation keeper | round remains unsettled; time passing changes no storage |
+| Recipient withdrawal | recipient | funds remain safely claimable |
+| Final close/refund | anyone, then each member | collateral remains locked |
+
+Existing circles survive founder absence only if:
+
+- no upcoming operation is `onlyOwner`, multisig-only, backend-only, or dependent on a founder-held key;
+- deadlines and recipient order are already stored onchain;
+- `settleRound` and finalization are permissionless, idempotent, and cannot be blocked by one member;
+- enough USDC/collateral is currently held to cover every promised payout;
+- members can still submit their monthly payments;
+- at least one independent caller will settle each due round.
+
+Automation (Gelato/Chainlink Automation/a bot) improves reliability but is still an offchain transaction sender. Fund it, monitor it, and have a permissionless manual fallback. Prefer two independent operators, one not controlled by the founders. Automation should call the same public function; it must not possess special correctness authority.
+
+## What exactly breaks if those conditions are absent
+
+- **Founder-only rollover/settlement:** first deadline during the trip passes, but state never advances; recipient cannot claim and later rounds may be blocked.
+- **Backend computes defaults/order:** backend outage or expired credentials prevents settlement, or lets its signer choose dishonest inputs.
+- **Push payout in the state-transition path:** a frozen/reverting recipient can revert settlement and freeze the circle.
+- **No collateral/prefund:** a missed $100 produces an $1,100 pot. “Earlier contributions” are already in recipients' wallets and cannot be clawed back.
+- **Early recipient defaults later:** their turn is already consumed, so forfeiture has zero recovery; remaining recipients bear the loss.
+- **Automation is the sole authorized caller:** an unfunded job, RPC failure, or paused subscription is the same liveness failure under a different owner.
+- **Admin pause/upgrade needed:** safety response and ordinary operation depend on keys the traveling team cannot use.
+
+## Before leaving
+
+1. Inventory every active circle: contract address/version, current round, next deadline, USDC balance, total claim liabilities, locked collateral, and required admin/caller.
+2. Simulate six weeks on a fork: missed payment before a member's turn, missed payment after their turn, all payments present, recipient USDC transfer failure, no settlement caller for several weeks, and late catch-up settlement.
+3. Prove after each scenario: `USDC balance >= claimable payouts + refundable collateral` under the contract's accounting.
+4. If existing immutable contracts have founder-only transitions, they cannot be repaired in place. Either keep the required signer/automation operational, or—with explicit member consent—pause before departure and migrate funds to an audited replacement. Do not claim migration is automatic.
+5. If existing circles lack collateral, disclose that payouts are not guaranteed. Options are member-approved top-up collateral, a separately funded loss reserve/guarantor, or accepting pro-rata short payouts. Code cannot manufacture the missing USDC.
+6. Configure funded independent automation plus alerts, publish manual settlement instructions, verify multisig/key access, and perform a live rehearsal before departure.
+
+The desirable invariant is simple: founders may disappear permanently and members can still pay, permissionlessly settle, claim, and close—while the contract already controls enough USDC to honor every credit it creates.

tokens used
29,062
Created [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T201108Z-codex-with-skill-2/workspace/plan.md).

Key finding: founder absence is safe only with permissionless settlement and independent callers. Current default concept is insolvent without prefunding/collateral because earlier contributions have already been paid out.
