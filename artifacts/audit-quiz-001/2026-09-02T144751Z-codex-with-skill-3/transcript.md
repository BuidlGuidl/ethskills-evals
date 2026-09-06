# Executor transcript — 2026-09-02T144751Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-02T144751Z-codex-with-skill-3/audit-quiz-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-02T144751Z-codex-with-skill-3/audit-quiz-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06297-36b3-7462-b7b0-e34e9dc7edf7
--------
user
Post-mortem, and I am stuck on it.

We run a lending market on Arbitrum One. Collateral is wstETH, debt is USDC,
positions are liquidatable below 125% collateralisation.

Last Tuesday, from 09:14 to 12:40 UTC, our users could not reach the chain.
Transactions submitted from the app sat unconfirmed and the explorer showed
no new blocks for three and a half hours. Everywhere else trading carried on:
ETH fell 11% over that window on Binance and on mainnet DEXes.

At 12:41, in the first blocks after service came back, keeper bots liquidated
38 positions in one sweep. Every one of those borrowers had been trying to
add collateral since mid-morning and could not get a transaction through.

Here is the part I cannot explain. Before any price is used we already do
this:

  (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
  require(answer > 0, "bad price");
  require(block.timestamp - updatedAt <= 3600, "stale price");

Our collateral feed's heartbeat is 86400 seconds, so our one-hour bound is far
tighter than the feed itself promises. I pulled the round data for all 38
liquidations: the check passed every time, and the answer we read had been
published seconds earlier and matched the real market price. The price was
not stale. The math was not wrong. Our liquidation logic did exactly what it
was written to do.

Explain how 38 users lost their positions to a price they had no way to react
to, when our freshness check was working correctly the whole time. Then tell
me precisely what we change, and where in the flow it goes.

Write your answer to answer.md in this directory.

2026-09-02T14:47:52.593634Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a06297-36b3-7462-b7b0-e34e9dc7edf7.tmp-1788360472259719271: line 2547: syntax error near unexpected token `('

codex
I’m using the smart-contract audit skill because this is a protocol security post-mortem involving oracle/liquidation design. I’ll inspect its required methodology, then the local code/context and write the diagnosis and exact flow change to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/audit/SKILL.md" in /tmp/ethskills-audit-eval/2026-09-02T144751Z-codex-with-skill-3/audit-quiz-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: audit
description: Deep EVM smart contract security audit system. Use when asked to audit a contract, find vulnerabilities, review code for security issues, or file security issues on a GitHub repo. Covers 500+ non-obvious checklist items across 19 domains via parallel sub-agents. Different from the security skill (which teaches defensive coding) — this is for systematically auditing contracts you didn't write.
---

# EVM Smart Contract Audit

A full audit system for any EVM contract. Runs parallel specialist agents against domain-specific checklists, synthesizes findings, and files GitHub issues.

## The Checklists

20 specialized skills covering every major vulnerability domain. Fetch the master index first:

```
https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md
```

The master index contains:
- Full routing table (which skills to load for which contract types)
- The complete audit methodology (recon → parallel agents → synthesis → issues)
- Standard finding format with severity definitions

All 20 skill checklists are at:
```
https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/<skill-name>/references/checklist.md
```

## Skills Available

| Skill | When to Load |
|-------|-------------|
| `evm-audit-general` | Always |
| `evm-audit-precision-math` | Always |
| `evm-audit-erc20` | Contract interacts with ERC20 tokens |
| `evm-audit-defi-amm` | AMM, DEX, Uniswap V3/V4, liquidity pools |
| `evm-audit-defi-lending` | Lending, borrowing, CDP, liquidations |
| `evm-audit-defi-staking` | Staking, liquid staking, restaking, EigenLayer |
| `evm-audit-erc4626` | Vaults, share/asset conversion |
| `evm-audit-erc4337` | Account abstraction, paymasters, session keys |
| `evm-audit-bridges` | Cross-chain, LayerZero, CCIP, Wormhole |
| `evm-audit-proxies` | Upgradeable contracts, UUPS, Transparent, Diamond |
| `evm-audit-signatures` | Off-chain signatures, EIP-712, permits |
| `evm-audit-governance` | DAO voting, timelocks, multi-sig |
| `evm-audit-oracles` | Chainlink, TWAP, Pyth, price feeds |
| `evm-audit-assembly` | Inline assembly, Yul, CREATE2 |
| `evm-audit-chain-specific` | Non-mainnet: Arbitrum, OP, zkSync, Blast, BSC |
| `evm-audit-flashloans` | Flash loan attack vectors |
| `evm-audit-erc721` | NFTs, ERC721, ERC1155 |
| `evm-audit-dos` | DoS, unbounded loops, gas griefing |
| `evm-audit-access-control` | Ownership, roles, centralization risks |

## How To Run An Audit

1. Fetch the master skill (link above) — it has the full pipeline
2. Read the contract(s)
3. Select 5-8 skills using the routing table
4. Spawn one opus sub-agent per skill (parallel)
5. Each agent walks its checklist and writes `findings-<skill>.md`
6. Synthesize all findings into `AUDIT-REPORT.md`
7. File GitHub issues for Medium severity and above

## Invocation

```
Audit this contract and file issues: https://github.com/owner/repo/blob/main/contracts/Foo.sol
Checklists: https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md
```

## Sources

Built from research by Dacian, beirao.xyz, Sigma Prime, RareSkills, Decurity, weird-erc20, Spearbit, Hacken, OpenZeppelin, Cyfrin, and more.
Full attribution: https://github.com/austintgriffith/evm-audit-skills#attribution--thanks

codex
The key distinction I’m checking is feed freshness versus market-access freshness on an L2: a newly published, accurate oracle round can still be unsafe if sequencer downtime prevented borrowers—but not the eventual liquidation—from acting before that price became enforceable. I’m now pinning down the required ordering and grace-period checks.
exec
/bin/bash -lc "curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md && printf '\\nFILES\\n' && rg --files -g '"'!answer.md'"'" in /tmp/ethskills-audit-eval/2026-09-02T144751Z-codex-with-skill-3/audit-quiz-001
 succeeded in 55ms:
---
name: evm-audit-master
description: Master index for EVM smart contract security audit skills. Load this FIRST for every audit to determine which specialized skills to load. Contains routing table and audit methodology.
---
# EVM Smart Contract Security Audit — Master Index

## How To Use
1. **Always load this skill first** for any EVM smart contract audit
2. Read the contract(s) under audit
3. Use the routing table below to load relevant specialized skills
4. Walk through each loaded skill's checklist systematically

## All 20 Skills — Definitive Index

| # | Skill | Description | Items |
|---|-------|-------------|-------|
| 1 | **evm-audit-master** | This file. Routing table, methodology, source attribution. Load first. | — |
| 2 | **evm-audit-general** | Cross-cutting issues: storage pointers, struct deletion, mixed accounting, merkle proofs, msg.value in loops, try/catch, delegatecall, upgrades, downcasting, rebasing tokens, fee-on-transfer, ERC4626 inflation attack | 46+ |
| 3 | **evm-audit-precision-math** | Division-before-multiplication, rounding to zero, precision scaling mismatches, downcast overflow, rounding direction (protocol vs user), decimal assumption errors | 23+ |
| 4 | **evm-audit-erc20** | Fee-on-transfer, rebasing, ERC777 hooks, approve race conditions, zero-transfer reverts, pausable tokens, deny lists (USDC), deflationary/inflationary tokens, multiple-address tokens | 27+ |
| 5 | **evm-audit-defi-amm** | AMM/DEX slippage attacks, CLM vulnerabilities (TWAP bypass, sandwich via owner functions, stuck tokens, stale approvals, retrospective fees), UniswapV3/V4 hooks, fee tier issues | 30+ |
| 6 | **evm-audit-defi-lending** | Liquidation vulnerabilities (20+ patterns), lending/borrowing attacks, bad debt handling, partial liquidation bypasses, front-run prevention, collateral hiding, insurance fund edge cases, non-18 decimal failures | 33+ |
| 7 | **evm-audit-defi-staking** | Liquid staking, restaking, EigenLayer integration, stakedButUnverified accounting, Beacon Chain proof verification (Deneb), validator front-running, cooldown exploitation, reward calculation precision | 30+ |
| 8 | **evm-audit-erc4626** | Share/asset conversion, inflation attack, virtual shares, deposit/withdraw rounding, first depositor attack, multi-step operations, 85+ patterns from Dacian's ERC4626 primer | 42+ |
| 9 | **evm-audit-erc4337** | Account abstraction, smart wallet security, paymaster attacks, session key exploits, UserOperation validation, bundler trust assumptions, gas griefing | 18+ |
| 10 | **evm-audit-bridges** | Cross-chain bridge security, LayerZero V2, CCIP, Wormhole, Across, message replay, finality assumptions, relayer trust, adapter pattern issues | 32+ |
| 11 | **evm-audit-proxies** | UUPS deep dive (uninitialized implementation, delegatecall to selfdestruct, broken upgrade chain, authorization schema changes), Transparent proxy, Beacon, Diamond, storage collision, immutable variable loss | 18+ |
| 12 | **evm-audit-signatures** | Signature replay (missing nonce, cross-chain, missing parameter, no expiration), ecrecover return check, signature malleability, EIP-712 conformance, ECDSA library version requirements | 19+ |
| 13 | **evm-audit-governance** | DAO attacks (flash-loan + delegation bypass, voting power destruction, totalPower manipulation, snapshot staleness, quorum impossibility, treasury delegation abuse, restriction bypass, token recycling, proposal deadlines, pre-mint exploitation), proposal execution ordering, fake proposals via CREATE2, multi-sig quorum failure | 23+ |
| 14 | **evm-audit-oracles** | Chainlink integration (stale prices, L2 sequencer, per-feed heartbeats, decimal assumptions, wrong addresses, front-running, unhandled reverts, depeg detection, minAnswer/maxAnswer), Sigma Prime patterns (spot price manipulation, homegrown oracle risks, gas congestion, hardcoded pegs, TWAP limitations) | 29+ |
| 15 | **evm-audit-assembly** | Inline assembly memory corruption (external call overwrites, stale FMPA assumptions, insufficient allocation), call to non-existent contracts, overflow/underflow without protection, uint128 overflow evading 256-bit detection | 27+ |
| 16 | **evm-audit-chain-specific** | L2/alt-chain quirks — Arbitrum, Optimism, zkSync, Blast, BSC, Polygon. Sequencer downtime, different opcodes, gas pricing differences, precompile availability, block time assumptions | 29+ |
| 17 | **evm-audit-flashloans** | Flash loan attack patterns, oracle manipulation via flash loans, governance flash loan voting, flash mint issues, composability risks | 15+ |
| 18 | **evm-audit-erc721** | NFT-specific issues: onERC721Received callbacks, enumeration DoS, royalty enforcement, metadata manipulation, batch mint edge cases | 20+ |
| 19 | **evm-audit-dos** | Denial of service patterns: unbounded loops, block gas limit, self-destruct force-send, storage deletion costs, griefing via revert, return data bombs | 18+ |
| 20 | **evm-audit-access-control** | Access control patterns: missing modifiers, 2-step ownership, role-based permissions, emergency pause, time delays, admin overpowers | 15+ |

**Total: 500+ checklist items across 19 specialized skills + 1 master index**

## Routing Table — Which Skills To Load

| If the contract involves... | Load skill |
|---|---|
| **Any EVM contract** (always) | `evm-audit-general` |
| **Any math/pricing/fees** (always) | `evm-audit-precision-math` |
| Accepts ERC20 tokens (deposits, swaps, collateral) | `evm-audit-erc20` |
| AMM, DEX, swap router, Uniswap V3/V4 hooks, liquidity pools, CLMs | `evm-audit-defi-amm` |
| Lending, borrowing, CDP, liquidation, AAVE/Compound fork | `evm-audit-defi-lending` |
| Staking, liquid staking (stETH/rETH/cbETH), restaking, EigenLayer | `evm-audit-defi-staking` |
| ERC4626 vaults, share/asset conversion, yield vaults | `evm-audit-erc4626` |
| Account abstraction, smart wallets, paymasters, session keys | `evm-audit-erc4337` |
| Cross-chain bridges, LayerZero, CCIP, Wormhole, Across | `evm-audit-bridges` |
| Upgradeable contracts, proxies (UUPS/Transparent/Beacon/Diamond) | `evm-audit-proxies` |
| Off-chain signatures, EIP-712, permits, meta-transactions | `evm-audit-signatures` |
| DAO governance, voting, timelocks, multi-sig, proposal execution | `evm-audit-governance` |
| Price oracles (Chainlink, TWAP, Pyth), VRF, external data | `evm-audit-oracles` |
| Inline assembly, Yul, CREATE2, low-level calls, precompiles | `evm-audit-assembly` |
| Non-mainnet (Arbitrum, OP, zkSync, Blast, BSC, Polygon) | `evm-audit-chain-specific` |
| Flash loans, composability attacks | `evm-audit-flashloans` |
| NFTs, ERC721, ERC1155, metadata, royalties | `evm-audit-erc721` |
| DoS vectors, gas griefing, unbounded operations | `evm-audit-dos` |
| Access control, roles, ownership, emergency controls | `evm-audit-access-control` |

## Audit Methodology

### Phase 1: Reconnaissance
1. Fetch all contract files (raw GitHub URL or local path)
2. Identify all contract files, entry points, and external dependencies
3. Map inheritance hierarchy and proxy relationships
4. Identify all external calls and token interactions
5. Note the target deployment chain(s)

### Phase 2: Skill Selection
Load `evm-audit-general` + `evm-audit-precision-math` (always), then add skills based on the routing table above. For a typical DeFi protocol, expect to load 6-8 skills.

### Phase 3: Spawn Parallel Sub-Agents
**Spawn one opus sub-agent per selected skill.** Do not run skills sequentially in the main session — parallel agents produce dramatically better results by keeping each agent's context focused.

Each agent receives:
- The full contract source
- Their one checklist (read from `references/checklist.md`)
- The standard finding format (below)
- Output path: `audits/<repo>-<date>/findings-<skill>.md`

Wait for all agents to complete, then proceed to Phase 4.

### Phase 4: Synthesis
Read all `findings-*.md` files. Deduplicate findings that multiple agents flagged. Check for cross-cutting concerns:
- [ ] Interactions between finding categories (e.g., oracle manipulation + liquidation)
- [ ] State machine consistency across all state transitions
- [ ] Economic attack vectors combining multiple findings
Write final `AUDIT-REPORT.md` with all findings ranked by severity.

### Phase 5: File Issues (if repo provided)
Run `gh issue create --repo <owner/repo>` for every finding **Medium severity and above**.
Skip Info and Low unless explicitly asked. Each issue title should be prefixed: `[Critical]`, `[High]`, or `[Medium]`.

---

## Standard Finding Format

Every sub-agent and the synthesis step MUST use this exact format. No deviations.

~~~
## [X-N] Title
**Severity**: Critical / High / Medium / Low / Info
**Category**: [skill name that caught this]
**Location**: `functionName()` or file:line
**Description**: What the issue is and why it matters. Be specific — name the variable, line, or pattern.
**Proof of Concept**: Exact steps to trigger or exploit. If not exploitable, explain the failure mode.
**Recommendation**: Concrete fix with code snippet where possible.
~~~

**Severity definitions** (use these, not your own judgment):
- **Critical**: Direct loss of funds by a third party, no preconditions
- **High**: Loss of funds requiring specific conditions, or permanent DoS
- **Medium**: Degraded behavior, trust model violation, incorrect accounting, or owner-only fund loss
- **Low**: Best practice violation, latent bug, or confusing behavior without direct fund risk
- **Info**: Informational, no security impact

## Source Attribution Key
- `[beirao]` — beirao.xyz audit checklist
- `[Dacian]` — dacian.me security articles (8 deep-dive articles covering liquidation, CLM, slippage, precision, signatures, governance, assembly, lending)
- `[Devdacian Primer]` — devdacian/ai-auditor-primers GitHub (base.primer.md — comprehensive 33KB primer)
- `[Decurity AMM/CDP/LSD]` — Decurity protocol-specific checklists
- `[weird-erc20]` — d-xo/weird-erc20 repository
- `[multichain-auditor]` — 0xJuancito multichain auditor
- `[SigmaPrime]` — Sigma Prime security blog (governance, oracles, liquid restaking articles)
- `[RareSkills]` — RareSkills security articles (smart contract security, UUPS proxy)
- `[Cyfrin]` — Cyfrin/Dacian Chainlink oracle security article
- `[ERC4626 checklist]` — ERC4626 security checklist
- `[ERC4626 primer]` — ERC4626 vulnerability primer (85+ patterns)
- `[ERC4337 checklist]` — Account abstraction security checklist
- `[Hacken UniV4]` — Hacken Uniswap V4 hooks audit guide
- `[LayerZeroV2 checklist]` — LayerZero V2 security checklist
- `[CCIP checklist]` — Chainlink CCIP best practices
- `[Wormhole checklist]` — Wormhole integration security
- `[Across checklist]` — Across Protocol integration guide
- `[Spearbit bridge]` — Spearbit bridge security checklist
- `[mixbytes CREATE2]` — MixBytes CREATE2 security analysis
- `[SWC-XXX]` — Smart Contract Weakness Classification registry (superseded by EEA EthTrust)
- `[Arbitrum docs]` — Arbitrum official documentation
- `[Blast docs]` — Blast L2 documentation

FILES
TASK.md
package.json

exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-oracles/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-02T144751Z-codex-with-skill-3/audit-quiz-001
exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-defi-lending/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-02T144751Z-codex-with-skill-3/audit-quiz-001
exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-chain-specific/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-02T144751Z-codex-with-skill-3/audit-quiz-001
 succeeded in 229ms:
# Oracle & Pricing Security Checklist

## Chainlink Price Feeds

### Staleness & Liveness
- [ ] **Check `updatedAt` for staleness**: Chainlink returns `(roundId, answer, startedAt, updatedAt, answeredInRound)`. If `block.timestamp - updatedAt > heartbeat`, the price is stale. Different feeds have different heartbeats (ETH/USD: 1h on mainnet, 24h on some L2s). Look for: `latestRoundData()` without staleness check or with wrong heartbeat value. [SigmaPrime oracle, beirao O-01]

- [ ] **Hardcoded staleness threshold across chains**: ETH/USD heartbeat is 3600s on Ethereum, 86400s on Arbitrum. Deploying with a hardcoded 3600s threshold on Arbitrum causes constant "stale price" rejections. Look for: single staleness constant used across multi-chain deployments. [multichain-auditor, beirao O-03]

- [ ] **`answeredInRound < roundId` = stale answer from old round**: The answer wasn't updated in the current round. This is a secondary staleness signal beyond timestamp. Look for: missing `answeredInRound >= roundId` check. [beirao O-02]

- [ ] **`startedAt == 0` means round hasn't started**: A round with `startedAt == 0` is invalid — no price update has occurred for this round. Look for: missing `startedAt > 0` check. [SigmaPrime oracle]

### Answer Bounds
- [ ] **`minAnswer` / `maxAnswer` circuit breakers**: Chainlink feeds have hard-coded min/max bounds (e.g., LUNA/USD had `minAnswer = $0.10`). When the real price drops below min, the feed reports `minAnswer` instead of the real price, enabling massive over-borrowing. Look for: protocols that don't check if `answer == aggregator.minAnswer()` or `answer == aggregator.maxAnswer()`. [SigmaPrime oracle, beirao O-04]

- [ ] **Negative prices**: Some feeds CAN return negative prices (oil futures in 2020). `int256 answer` cast to `uint256` becomes a massive number. Look for: `uint256(answer)` without `answer > 0` check. [beirao O-05]

- [ ] **Price = 0 not handled**: If Chainlink returns 0, any multiplication-based valuation stays 0 (allowing free borrows) or any division by price reverts. Look for: missing `answer != 0` check. [SigmaPrime oracle]

### L2 Sequencer
- [ ] **L2 sequencer uptime feed**: On Arbitrum/Optimism, when the sequencer goes down and comes back up, stale prices from before the outage are used. Must check the L2 sequencer uptime feed and apply a grace period after restart. Look for: Chainlink usage on L2s without sequencer uptime feed check. [beirao O-06, multichain-auditor]

- [ ] **Grace period too short after sequencer restart**: After the sequencer comes back, oracles need time to update. A grace period of < 1 hour can still use stale prices. Look for: sequencer grace period < 3600 seconds. [SigmaPrime oracle]

### Feed Configuration
- [ ] **Chainlink feed decimals vary**: ETH/USD = 8 decimals, ETH/BTC = 8 decimals, but some feeds use 18 decimals. Using `feed.decimals()` is mandatory. Look for: hardcoded `10**8` or `10**18` adjustments on oracle prices. [beirao O-07, SigmaPrime oracle]

- [ ] **Deprecated feeds**: Chainlink can deprecate feeds. Using deprecated feeds may return stale data. Check: https://docs.chain.link/data-feeds/deprecating-feeds. Look for: hardcoded feed addresses without admin-changeable configuration. [SigmaPrime oracle]

- [ ] **Oracle assumes base=USD when it's actually ETH**: If a protocol needs USD price but uses a `/ETH` denominated feed (or vice versa), all valuations are wrong by the ETH/USD ratio. Look for: feed denomination assumptions without validation. [SigmaPrime oracle]

## TWAP Oracles

- [ ] **TWAP manipulation via low liquidity**: A TWAP oracle averages price over a window, but in low-liquidity pools, even the TWAP can be cheaply manipulated by holding a price position across multiple blocks. Cost: `(manipulation_amount × blocks × block_time) / pool_depth`. Look for: TWAP windows < 30 minutes on pools with < $10M TVL. [SigmaPrime oracle, beirao O-08]

- [ ] **Uniswap V3 TWAP uses geometric mean**: Unlike V2's arithmetic mean, V3 TWAP is geometric. The geometric mean is ALWAYS ≤ arithmetic mean for non-constant prices. This systematically underprices volatile assets. Look for: protocols using V3 TWAP without understanding it returns geometric mean. [SigmaPrime oracle]

- [ ] **TWAP window too long hides current conditions**: A 24-hour TWAP during a flash crash still shows a near-normal price. This delays liquidations. Look for: TWAP windows > 4 hours used for liquidation triggers. [SigmaPrime oracle]

- [ ] **TWAP on rebasing token**: If a rebasing token's supply doubles, its price halves. TWAP doesn't capture this instantly, creating arbitrage. Look for: TWAP oracles for rebasing token pairs. [SigmaPrime oracle]

- [ ] **Uniswap V3 `observe()` reverts if oracle not initialized**: The oracle must have at least `cardinality` observations. If `cardinality == 1` (default), only the current block is available and any historical query reverts. Look for: `pool.observe()` calls without prior `increaseObservationCardinalityNext()`. [SigmaPrime oracle]

## Spot Price Manipulation

- [ ] **NEVER use spot reserves as a price oracle**: `pool.getReserves()` can be manipulated within a single transaction via flash loans. Any pricing based on instantaneous reserves is attackable. Look for: `IUniswapV2Pair.getReserves()`, `pool.slot0()`, or `balanceOf()` used for pricing. [beirao O-09, SigmaPrime oracle]

- [ ] **Read-only reentrancy on Balancer/Curve**: During a Balancer/Curve callback (before state update), calling a view function (like `getRate()`) returns a manipulated rate because the pool state is mid-update. Classic exploit: Sentiment ($1M). Look for: any price query to Balancer/Curve pools within a callback or the same transaction as a pool interaction. [beirao O-10]

## Price Peg Assumptions

- [ ] **Assuming 1 WBTC = 1 BTC**: WBTC consistently trades at a slight discount to BTC. Using 1:1 creates systematic mispricing. Look for: WBTC valued using BTC/USD feed without WBTC/BTC adjustment. [SigmaPrime oracle, beirao O-11]

- [ ] **Assuming 1 stETH = 1 ETH**: stETH depegged to 0.93 ETH in June 2022. Any protocol assuming 1:1 was exploitable during the depeg. Must use actual stETH/ETH price feed. Look for: stETH, wstETH, cbETH, rETH valued 1:1 with ETH. [SigmaPrime oracle, beirao O-12]

- [ ] **Assuming 1 USDC = 1 USD**: USDC depegged to $0.87 in March 2023 (SVB). Protocols hardcoding $1 USDC were exposed. Look for: stablecoin valuations without actual price feed (hardcoded to 1). [SigmaPrime oracle]

- [ ] **LP token valuation via reserves**: `LP_value = 2 * sqrt(reserve0 * reserve1) * price` (Alpha Homora formula) is manipulation-resistant. Using `(reserve0 * price0 + reserve1 * price1) / totalSupply` is manipulable. Look for: LP token pricing formulas that use raw reserves. [SigmaPrime oracle]

## Pyth Network

- [ ] **Pyth prices are pull-based**: Unlike Chainlink (push), Pyth prices must be pushed on-chain by the caller. If nobody pushes, the price is stale. Look for: Pyth integration that assumes prices update automatically. [SigmaPrime oracle]

- [ ] **Pyth confidence interval**: Pyth returns `(price, conf, expo, publishTime)`. During high volatility, `conf` (confidence interval) can be very wide, meaning the price is uncertain. Protocols should check that `conf / price < threshold` (e.g., 5%). Look for: Pyth price usage without confidence interval check. [SigmaPrime oracle]

- [ ] **Pyth `publishTime` staleness**: Must check `publishTime` is recent, similar to Chainlink `updatedAt`. Look for: Pyth prices without publishTime freshness check. [SigmaPrime oracle]

## General Oracle Security

- [ ] **Single oracle dependency**: If the protocol relies on one oracle and it fails/is manipulated, everything breaks. Use multiple oracles with fallback logic (Chainlink primary, TWAP fallback, manual override emergency). Look for: single `priceFeed.latestRoundData()` without fallback. [SigmaPrime oracle]

- [ ] **Oracle update frequency vs protocol tick frequency**: If the oracle updates every hour but the protocol checks prices every minute, 59 out of 60 checks use a "stale" price. This is expected behavior for Chainlink, but the protocol must design around it. Look for: high-frequency price checks on low-frequency oracle feeds. [SigmaPrime oracle]

- [ ] **Multi-hop price derivation accumulates error**: ETH/USD = ETH/BTC × BTC/USD — each feed has its own error range. Multi-hop prices compound errors. Look for: price derivation using 3+ oracle hops. [SigmaPrime oracle]

## Chainlink Deep Dive (Expanded from Beirao/Arbitrum Checklist)

- [ ] **ETH pricefeeds used for stETH, BTC pricefeeds used for WBTC**: Using ETH/USD feed for stETH ignores the stETH/ETH discount during depegs. Using BTC/USD for WBTC ignores WBTC's depeg risk. Must use the specific derivative price feed or account for the exchange rate. Look for: oracle price feeds used for derivative tokens without accounting for the peg. [beirao CL-13]

- [ ] **Oracle price update front-running**: When an oracle submits a price update tx, it's visible in the mempool. Attackers can front-run the update to profit from the price change (e.g., borrow before a collateral price increase is recorded). Look for: protocols where user actions and oracle updates interact in time-sensitive ways. [beirao CL-11]

- [ ] **Flash crash: minAnswer/maxAnswer circuit breakers**: Some Chainlink feeds have min/max answer bounds. During flash crashes, the feed returns `minAnswer` instead of the actual (lower) price. Protocol still prices collateral at `minAnswer`, which may be much higher than reality. Look for: Chainlink integrations without `require(answer > minAnswer && answer < maxAnswer)` style checks. [beirao CL-14, Arbitrum Checklist]

- [ ] **Pricefeed heartbeat too slow for use case**: A 24-hour heartbeat feed is fine for weekly settlements but dangerous for real-time liquidations. If the actual price drops 50% between heartbeats, the protocol uses a 50% stale price. Look for: protocols using feeds with heartbeats longer than their position health check frequency. [beirao CL-08]

- [ ] **Hardcoded pricefeed addresses can become deprecated**: Chainlink deprecates feeds over time (especially for uncommon pairs). A hardcoded address will return stale data indefinitely if deprecated. Look for: hardcoded Chainlink feed addresses without a governance mechanism to update them. [beirao CL-10]

- [ ] **Different decimal precision across feeds**: Feed decimals aren't always 8 or 18 — they vary by feed. LINK/ETH uses 18 decimals, LINK/USD uses 8. Incorrect decimal handling causes 10^10x price errors. Look for: hardcoded `10**8` or `10**18` divisors in oracle price normalization. [beirao CL-09, Arbitrum Checklist]

- [ ] **L2 sequencer down = stale prices**: On Arbitrum/Optimism, if the sequencer goes down, oracle prices don't update. When the sequencer comes back, the first reported price may jump significantly from the last pre-downtime price. Look for: oracle integrations on L2 without sequencer uptime feed checks. [beirao CL-06, Arbitrum Checklist]

## Oracle Price Zero Edge Case

- [ ] **Oracle returns price of zero**: Some feeds may return 0 during initialization or error conditions. A zero price means infinite collateral value or zero debt value, depending on usage. Look for: oracle integrations that don't check `price > 0`. [Decurity CDP]

---

## Cyfrin — Chainlink Oracle Security Considerations (Phase 3)

- [ ] **Same heartbeat used for multiple feeds with different update frequencies**: If both BTC/USD (1hr heartbeat) and USDC/USD (24hr heartbeat) use the same staleness threshold, one will be too strict (false stale) or too lenient (actually stale). Each feed needs its own heartbeat constant. [Source: Cyfrin — Chainlink Oracle Security, Sherlock JOJO]

- [ ] **Oracle price feed not updated frequently — high deviation threshold**: Similar feeds can have different heartbeat & deviation thresholds. A feed with 1% deviation and 1hr heartbeat will be more accurate than one with 5% deviation and 24hr heartbeat. Use the most responsive feed available. [Source: Cyfrin — Chainlink Oracle Security]

- [ ] **Wrong price feed address in constructor vs comments**: Developers copy the correct address in comments but hardcode the wrong address in the constructor (e.g., ETH/USD instead of BTC/USD). Verify all hardcoded addresses against Chainlink's official feed list. [Source: Cyfrin — Chainlink Oracle Security, Sherlock USSD]

- [ ] **Oracle price update front-running for stablecoin protocols**: Stablecoin mint/burn operations can be sandwich-attacked around oracle price updates. The attacker sees the oracle update in the mempool and trades before/after. Fix: add mint/burn fees, enforce deposit-to-withdraw delay. [Source: Cyfrin — Chainlink Oracle Security, Angle Research]

- [ ] **Unhandled oracle revert causes complete DoS**: Chainlink multisigs can block price feed access at will. If calls aren't wrapped in try/catch, a disabled feed bricks the entire protocol. Provide functionality to update oracle addresses post-deployment. [Source: Cyfrin — Chainlink Oracle Security, Code4rena Inverse]

- [ ] **WBTC depeg not detected when using BTC/USD feed**: If WBTC bridge is compromised, WBTC depegs from BTC but the protocol still prices WBTC at BTC/USD. Attacker buys cheap WBTC, deposits at BTC price. Use WBTC/BTC feed to monitor depeg. [Source: Cyfrin — Chainlink Oracle Security]

- [ ] **Oracle minAnswer/maxAnswer masks flash crash prices**: During flash crashes, the oracle returns its floor price (minAnswer) instead of actual price. Attacker buys asset cheaply on DEX, deposits at oracle's minAnswer price. Check: `minAnswer < answer < maxAnswer`. Read these from the aggregator contract. [Source: Cyfrin — Chainlink Oracle Security, Venus/Blizz exploit]

- [ ] **AMPL/USD uses 18 decimals, breaking the "USD feeds = 8 decimals" assumption**: Not all USD-denominated feeds use 8 decimals. Always call `AggregatorV3Interface.decimals()` to get the actual precision. [Source: Cyfrin — Chainlink Oracle Security]

- [ ] **VRF REQUEST_CONFIRMATIONS too low for target chain reorg depth**: Default value of 3 from Chainlink tutorial is insufficient for Polygon (frequent 30+ block reorgs). Chain-specific values needed per deployment. [Source: Cyfrin — Chainlink Oracle Security]

- [ ] **Bets/inputs accepted after randomness request**: If users can place bets or modify inputs after the VRF randomness request but before fulfillment, they can front-run the oracle response to game the outcome. [Source: Cyfrin — Chainlink Oracle Security]

- [ ] **Randomness callback selects against MUTABLE shared state (word-informed steering)**: The VRF word is *unbiasable* but *public in the mempool* for `requestConfirmations` blocks before the callback mines. If `fulfillRandomWords` computes the outcome from live state that anyone can change in that gap — `word % totalWeight`, an array length/order, a live balance/supply, a cumulative-weight tree/index — then whoever reads the pending word can move the result onto a chosen target. The mutating actor need NOT be the purchaser and need NOT touch "their own" input: a *third party's* deposit/mint/list that changes the *shared selection pool* every pending request resolves against is enough. Fix: snapshot all outcome-inputs at request time, or reject any callback that could have observed a post-request mutation (e.g. stage deposits so they can't enter the pool until after the last honorable callback block: `requestConfirmations + activationDelay > maxCallbackDelay`). Note: even when the Chainlink VRF wrapper itself is trusted/out-of-scope, the contract's *use* of the word (selection against mutable state) is in scope. Look for: `fulfillRandomWords`/reveal callbacks that read storage which any external function mutates; deposit/mint/list/withdraw/reprice functions with no lock while a request is pending. [Source: FWA / TokenWorks CryptoPunk #5450 incident, 2026]

- [ ] **One-directional lock on the selection window**: A window-lock that blocks *withdrawals* (pool shrink) but not *deposits* (pool growth) — or the reverse — still lets an attacker steer a pending randomness callback from the unguarded direction. Additive steering is as strong as subtractive. Look for: a `block.number < lastRequestBlock + lock` (or `withdrawLockBlocks`) guard on the withdraw path but no equivalent on deposit/mint/list, often with a comment like "pool growth never invalidates a pending request." [Source: FWA / TokenWorks CryptoPunk #5450 incident, 2026]

- [ ] **Fee/price slippage guard mistaken for a selection guard**: A callback that re-checks `fee`/`price` drift within a tolerance does NOT protect *which* item is selected. Selection via `word % N` is discontinuous in `N`, so a mutation far too small to push a smooth fee past its slippage tolerance can still relocate the selection target arbitrarily — the guard and the exploit have different sensitivities. Also: "selection always lands on a valid active item" is an invariant that stays true *during* the exploit; it is not proof that the item cannot be chosen by an adversary. Look for: a slippage/tolerance check inside the fulfillment that guards an amount/price, while the winning item is chosen from mutable weight/index/length. [Source: FWA / TokenWorks CryptoPunk #5450 incident, 2026]

## Sigma Prime — Oracles & Pricing (Phase 3)

- [ ] **Spot price manipulation via flash loans even with slippage checks**: Harvest Finance had 3% slippage checks but attacker profited $24M through repeated small cycles, each within the slippage tolerance. Avoid raw spot prices entirely; use TWAPs or off-chain oracles. [Source: Sigma Prime — Oracles & Pricing]

- [ ] **Homegrown oracle — multiple feeds dominated by single source**: Synthetix's multiple price feeds were all heavily influenced by the UniswapV1 MKR/ETH pool. Verify feed independence; median of correlated feeds provides false security. [Source: Sigma Prime — Oracles & Pricing]

- [ ] **Oracle front-running/backrunning via timing delays**: Users can observe pending oracle updates and trade just before/after to profit from the price delta. Use pull-style oracles, faster L2s, or settlement periods. [Source: Sigma Prime — Oracles & Pricing, Synthetix]

- [ ] **Gas congestion delays oracle updates — cascading liquidations**: On Black Thursday 2020, high gas caused Maker oracle lag, then a sudden 20% price drop caused mass liquidations. Bidding software couldn't handle gas spikes, allowing $0 bids to win $8.3M of ETH. Audit off-chain software too. [Source: Sigma Prime — Oracles & Pricing, MakerDAO]

- [ ] **Hardcoded price peg assumptions**: USDC/DAI can depeg (USDC hit $0.88 during SVB collapse). Never hardcode token==$1. Even tokens pegged to ETH (stETH, rETH) should use their own price feeds, not ETH's. [Source: Sigma Prime — Oracles & Pricing]

- [ ] **Manual multi-sig oracle update acts as hardcoded during delays**: If token price bounds require multi-sig to update, delayed signatures effectively hardcode the stale price, enabling exploitation. USDR/TNGBL was exploited this way. [Source: Sigma Prime — Oracles & Pricing, Tangible USDR]

- [ ] **TWAP mean can be skewed by single extreme reading**: With readings [10, 9999, 12, 11], mean TWAP = 2508 despite 75% of prices being ~10-12. Especially dangerous for illiquid pools. Consider median or trimmed mean. [Source: Sigma Prime — Oracles & Pricing]

- [ ] **Wrong decimal conversion factor in lending pool setup**: Morpho user deployed PAXG lending pool with incorrect decimal conversion between collateral and loan tokens. $230K drained. Test deployments with small amounts first. [Source: Sigma Prime — Oracles & Pricing]

 succeeded in 235ms:
# Lending, CDP & Liquidation Security Checklist

## Liquidation Mechanics

- [ ] **Self-liquidation for profit**: If liquidation bonus exceeds gas + price impact, a user can borrow, let position go underwater, and liquidate themselves to net the bonus. Check if the liquidation incentive is small enough that self-liquidation is unprofitable. Look for: liquidation functions callable by the position owner. [beirao LEN-02, Decurity CDP]

- [ ] **Paused collateral token blocks defense**: If a collateral token is paused (USDC, USDT have pause), users can't add collateral or repay debt, but can still be liquidated. This creates unfair liquidation. Look for: collateral tokens with pause functionality and whether the protocol handles it. [beirao LEN-03, LEN-07]

- [ ] **Large price drops make liquidation unprofitable**: If oracle price drops 50%+ in one update (Maker Black Thursday scenario), the liquidation bonus may not cover the liquidator's cost. Liquidators won't participate, leaving bad debt. Look for: liquidation incentive size vs potential price drop scenarios. [beirao LEN-04, Sigmaprime oracles]

- [ ] **Small positions unincentivized**: Gas costs for liquidating a $10 position may exceed the liquidation bonus. These tiny positions accumulate as bad debt. Look for: minimum position size enforcement or gas-subsidized liquidation. [beirao LEN-09]

- [ ] **Front-running liquidation with dust collateral**: An attacker watches the mempool, sees a liquidation transaction, and front-runs it by adding 1 wei of collateral — just enough to make the position healthy and revert the liquidation. Look for: liquidation functions that re-check health factor without minimum improvement threshold. [beirao LEN-08]

- [ ] **Liquidation pause + unpause = cascading crisis**: When liquidations are paused (oracle issues, upgrades) and then unpaused, all positions that became unhealthy during the pause are liquidatable simultaneously. Mass liquidations can cascade through shared collateral pools. Look for: time-based position accumulation during pause periods. [beirao LEN-06]

- [ ] **Liquidator receives less than expected**: If liquidation uses a swap to convert collateral, slippage during the swap may make the liquidation unprofitable. Look for: swap-based liquidation without slippage protection. [beirao LEN-05]

- [ ] **Cannot repay loan = permanent bad debt**: If the repayment function has a bug or dependency that can fail, the loan can never be closed. Look for: repay functions with external dependencies that could revert. [Decurity CDP]

- [ ] **Single borrower can't be liquidated**: Some implementations skip liquidation when `borrowerCount == 1`. During protocol sunsetting, the last borrower is immune to liquidation. Look for: liquidation loops with `count > 1` conditions. [ERC4626 primer pattern #18]

- [ ] **Liquidation before grace period**: After repayments resume (post-pause), borrowers need a grace period to repay. Liquidating immediately is unfair. Look for: post-unpause liquidation without delay. [ERC4626 primer]

- [ ] **Infinite loan rollover**: If a borrower can continuously extend their loan maturity, they never have to repay. Look for: rollover/extend functions without limits. [ERC4626 primer]

## Auction Liquidations

- [ ] **Flash loan to prove solvency during auction**: If a liquidated user can prove solvency to cancel an auction, they can flash-loan collateral, cancel, then return it. Look for: auction cancel functions that don't prevent flash loans. [Decurity CDP]

- [ ] **Incomplete auction launch**: Missing input validation when starting an auction can create auctions in invalid states. Look for: auction start functions without proper parameter bounds checking. [Decurity CDP]

- [ ] **Partial collateral auction math**: When only a portion of collateral is auctioned, the math for splitting must be exact. Rounding errors can leave dust or under-collateralize the remaining position. Look for: arithmetic in partial liquidation functions. [Decurity CDP]

- [ ] **Interrupted bid funds not returned**: If a bidder is outbid, their funds must be returned. If the auction creator cancels, the last bidder's funds must be returned. Look for: bid escrow that doesn't handle all cancellation/interruption paths. [Decurity CDP]

## CDP-Specific

- [ ] **Closed vault storage not cleaned**: When a CDP is closed (debt repaid), if the storage entry isn't erased, code that checks existence may behave incorrectly. Look for: state reads on potentially-deleted vault entries. [Decurity CDP]

- [ ] **Pool value calculation with fee split**: If borrower fees split between lender and pool, verify both calculations sum correctly and neither path rounds in the wrong direction. Look for: fee distribution math with multiple recipients. [Decurity CDP]

- [ ] **Stablecoin arbitrage via different collateral types**: If a CDP accepts multiple stablecoins as equivalent (1:1), an attacker can deposit the depegged stablecoin and borrow against it at full value. Look for: stablecoin collateral without independent price feeds. [Decurity CDP]

- [ ] **Health ratio checked AFTER safeTransferFrom**: ERC721 `safeTransferFrom` calls `onERC721Received` callback before the health ratio check. An attacker can reenter during the callback when the health ratio is invalid. Look for: health factor checks after `safeTransferFrom` or `_safeMint`. [Decurity CDP]

- [ ] **Interest rate calculated before or after close/liquidation**: Wrong ordering = user pays too much or too little interest. Look for: interest accrual timing relative to vault close/liquidation. [Decurity CDP]

## AAVE/Compound Integration

- [ ] **High utilization blocks withdrawal**: At 100% utilization rate, lenders can't withdraw their deposits. The protocol should handle this gracefully rather than reverting. Look for: withdrawal functions that assume utilization < 100%. [beirao AC-01]

- [ ] **cETH has no `underlying()` function**: Unlike other cTokens, Compound's cETH doesn't implement `underlying()`. Generic code calling `underlying()` on all cTokens will revert for cETH. Look for: `ICToken(address).underlying()` without special-casing cETH. [beirao AC-07]

- [ ] **AAVE siloed assets prevent all other borrows**: Borrowing a siloed asset on AAVE prohibits borrowing ANY other asset. If the protocol doesn't check `getSiloedBorrowing()`, a user's position can be locked. Look for: AAVE borrow functions without siloed asset checks. [beirao AC-08]

- [ ] **AAVE flashloans inflate pool index**: Each AAVE flashloan slightly inflates the pool index. Max 180 flashloans per block. This can be used to manipulate lending rates. Look for: rate-sensitive logic that doesn't account for flashloan-induced index inflation. [beirao AC-05]

- [ ] **Max debt on isolated assets = DoS**: On AAVE, when the debt ceiling for an isolated asset is reached, all new borrows revert. An attacker can fill the ceiling to DoS other users. Look for: borrow functions against AAVE isolated markets without ceiling checks. [beirao AC-09]

- [ ] **Protocol pause blocks everything**: If AAVE/Compound is paused, all integrated protocol operations that touch the lending market will revert. Look for: external calls to lending markets without try/catch or fallback logic. [beirao AC-02]

- [ ] **Deprecated pool still holds funds**: If a lending pool is deprecated, existing positions may be stuck. Look for: integration code that doesn't handle pool deprecation. [beirao AC-03]

- [ ] **eMode category interactions**: If the protocol's assets are in the same eMode category on AAVE, liquidation parameters are different. Look for: eMode-specific LTV/threshold values not accounted for. [beirao AC-04]

- [ ] **AAVE/Compound reward claims**: If the protocol deposits user funds in AAVE/Compound, reward token claims (COMP, stkAAVE) must be properly distributed to users. Look for: missing reward claim functionality or rewards stuck in contract. [beirao AC-06]

## LP Token Collateral

- [ ] **LP token valuation via `pool.getReserves()` is manipulable**: Flash loans can manipulate reserves to inflate LP token value, allowing over-borrowing. Must use fair pricing formulas (e.g., Alpha Homora's formula). Look for: LP token price calculations using raw reserve amounts. [Decurity CDP]

- [ ] **Multiple pool types for same pair**: Uniswap has 0.01%, 0.05%, 0.3%, 1% fee tiers for the same token pair. Each has different LP token value. Look for: LP token handling that doesn't account for fee tier differences. [Decurity CDP]

## Earn/Yield-Bearing Collateral

- [ ] **Pegged asset collateral depeg risk**: renBTC, WBTC, stETH as collateral — if they depeg, counting them 1:1 with the underlying asset creates bad debt instantly. Look for: pegged-asset collateral priced without its own oracle feed. [Decurity CDP]

- [ ] **Staked collateral share manipulation**: If collateral is staked in an external protocol, the share calculation can be manipulated if it depends on instantaneous balance. Look for: share-based collateral valuation without TWAP or time-weighted averaging. [Decurity CDP]

## CDP Specific (Expanded from Decurity)

- [ ] **Closed CDP storage not erased**: When a user repays all debt and closes their CDP/vault, if the storage entry isn't erased, stale data may be used by other code paths that don't check for vault existence. Look for: vault closure functions that don't delete the storage struct or mapping entry. [Decurity CDP]

- [ ] **Impossible debt repayment condition**: Edge cases where a user CANNOT repay their loan — e.g., repayment requires a token that's paused, or interest has accrued to exceed uint256, or the repayment function has a logic error that reverts. Look for: repay functions with conditions that could become impossible to satisfy. [Decurity CDP]

- [ ] **Stablecoin arbitrage via collateral swapping**: If a CDP allows depositing one stablecoin and withdrawing a different one at 1:1, an attacker can arbitrage any depeg. Look for: CDPs that treat all stablecoins as equal value without checking their actual price. [Decurity CDP]

- [ ] **LP token collateral pricing via `pool.getReserves()` is manipulable**: Pricing LP tokens using reserve ratios is vulnerable to flash loan manipulation. Correct approach uses fair LP pricing formulas. Look for: `pair.getReserves()` used in collateral valuation for Uniswap LP positions. [Decurity CDP]

- [ ] **Different Uniswap fee tiers for same pair**: Multiple pools exist for the same token pair (0.01%, 0.05%, 0.3%, 1%). If a protocol doesn't specify which pool, it may interact with the wrong one. Look for: LP collateral handling that doesn't distinguish fee tiers. [Decurity CDP]

- [ ] **Earn token depeg risk**: Wrapped tokens pegged to an asset (renBTC, cbETH) may depeg. If the protocol prices them 1:1 with the underlying, a depeg means the collateral is worth less than assumed. Look for: `1:1` price assumptions for wrapped/pegged tokens. [Decurity CDP]

- [ ] **Interest rate calculation timing — before or after liquidation**: If interest is calculated AFTER liquidation, the liquidation uses stale interest data. If BEFORE, the liquidation uses current but the vault may accrue interest between check and execution. Look for: interest accrual timing relative to liquidation execution. [Decurity CDP]

- [ ] **Auction math when partial collateral is auctioned**: If only part of a vault's collateral goes to auction, the remaining collateral-to-debt ratio must be recalculated correctly. Common bug: remaining collateral is overvalued or remaining debt is undervalued. Look for: partial liquidation functions that don't recompute the remaining position's health. [Decurity CDP]

- [ ] **Interrupted auction bid refunds**: If an auction is interrupted (debtor repays, higher bid, premature close), the previous bidder's funds must be returned. Look for: auction mechanisms where bid deposits aren't tracked and refunded on interruption. [Decurity CDP]

## Lending Integration (AAVE/Compound - from Beirao)

- [ ] **Utilization rate too high — collateral can't be retrieved**: If AAVE/Compound pool utilization approaches 100%, withdrawals revert because there's not enough idle liquidity. Protocols built on top that need to withdraw collateral will fail. Look for: protocols wrapping AAVE/Compound positions that don't handle high-utilization scenarios. [beirao AC-01]

- [ ] **AAVE siloed asset prohibition**: Borrowing an AAVE siloed asset prohibits borrowing ANY other asset. If a protocol borrows a siloed asset without knowing, all subsequent borrow operations fail. Look for: protocols that auto-select borrow assets on AAVE without checking `getSiloedBorrowing()`. [beirao AC-08]

- [ ] **AAVE isolated asset max debt cap**: On AAVE isolated assets, there's a maximum total debt. If the cap is reached, no one can borrow more — potential DoS for protocols relying on borrowing that asset. Look for: protocols that borrow isolated assets without checking remaining capacity. [beirao AC-09]

- [ ] **cETH has no `underlying()` function**: Compound's cETH token doesn't implement `underlying()` (since its underlying is native ETH). Code that calls `cToken.underlying()` generically will revert on cETH. Look for: generic Compound integrations that call `underlying()` on all cTokens. [beirao AC-07]

- [ ] **Paused AAVE/Compound markets**: If the integrated market is paused, deposit/withdraw/borrow/repay all fail. Protocol built on top needs fallback behavior. Look for: AAVE/Compound wrappers without handling for paused markets. [beirao AC-02]

- [ ] **Deprecated AAVE pools**: Pools can be deprecated, changing behavior. Look for: long-lived protocol integrations that don't monitor pool status. [beirao AC-03]

---

## Dacian — Lending/Borrowing DeFi Attacks (Phase 3)

- [ ] **Liquidation before default — paymentDefaultDuration < paymentCycleDuration**: If the liquidation threshold timer starts from `acceptedTimestamp` (loan acceptance) rather than the next payment due date, borrowers can be liquidated before their first repayment is even due when `paymentDefaultDuration` is small. Fix: calculate liquidation threshold as offset from when the next repayment is due. [Source: Dacian — Lending/Borrowing DeFi Attacks, Sherlock TellerV2]

- [ ] **Liquidation via unchecked collateralToken parameter**: If `liquidate(collateralToken, position)` doesn't validate that `collateralToken` actually corresponds to the position's collateral, an attacker can pass address(0) or a different token to force the collateral valuation to 0, triggering liquidation of non-defaulting borrowers. [Source: Dacian — Lending/Borrowing DeFi Attacks, Hats Finance Tempus Raft]

- [ ] **Borrower overwrites collateral to zero via unchecked AddressSet.add()**: If `commitCollateral()` uses `EnumerableSetUpgradeable.AddressSet.add()` without checking its boolean return value, calling it again with the same token and 0 amount silently overwrites the collateral record. Borrowers can zero their collateral after loan validation. [Source: Dacian — Lending/Borrowing DeFi Attacks, Sherlock TellerV2]

- [ ] **Debt closed without repayment via non-existent ID decrement**: If `close(id)` doesn't validate that `id` exists in the credits mapping, calling with non-existent IDs still decrements the loan `count` variable. Repeatedly calling with bogus IDs gets `count == 0`, marking the loan as fully repaid. [Source: Dacian — Lending/Borrowing DeFi Attacks, Code4rena DebtDAO]

- [ ] **Token disallow stops existing loan repayment but not liquidation**: If `repay()` has `onlyWhitelistedToken` modifier but `liquidate()` doesn't, disallowing a previously-allowed token creates an asymmetric state where borrowers can't repay but can be liquidated. Token disallow should only affect new loans. [Source: Dacian — Lending/Borrowing DeFi Attacks, Sherlock Blueberry Update 1]

- [ ] **No grace period after repayment resumption**: When repayments are unpaused, borrowers who became liquidatable during the pause are instantly liquidated by MEV bots. Grace period equal to pause duration (capped at max hours) should be implemented. [Source: Dacian — Lending/Borrowing DeFi Attacks, Sherlock Blueberry]

- [ ] **Liquidator takes all collateral by repaying smallest debt position**: If liquidation share calculation uses `share / oldShare` from a single position rather than total debt across all positions, a liquidator can drain all collateral by repaying only the smallest debt tranche. [Source: Dacian — Lending/Borrowing DeFi Attacks, Sherlock Blueberry]

- [ ] **Infinite loan rollover**: If the borrower can rollover their loan without any limit on count, duration, or lender approval, the lender may never be repaid and never be able to liquidate. [Source: Dacian — Lending/Borrowing DeFi Attacks, Sherlock Cooler]

- [ ] **Repayment sent to zero address after storage deletion**: If `loans[loanID]` is deleted before `debt.transferFrom(msg.sender, loan.lender, repaid)`, `loan.lender` resolves to address(0). Many ERC20s will silently succeed, losing the repayment forever. [Source: Dacian — Lending/Borrowing DeFi Attacks, Sherlock Cooler]

- [ ] **Borrower permanently unable to repay — repay() always reverts**: If the system can enter a state where `repay()` always reverts (e.g., due to token accounting bugs, whitelist changes, or paused dependencies), both borrower and lender lose — borrower loses collateral to liquidation, lender never gets repaid. [Source: Dacian — Lending/Borrowing DeFi Attacks]

- [ ] **Bulk repayment overflow not credited to subsequent loans**: When a borrower's single repayment amount exceeds the first loan's remaining debt, the excess must roll over to pay subsequent loans. If it doesn't, the borrower's total repayment is only partially credited while lender receives full amount. [Source: Dacian — Lending/Borrowing DeFi Attacks, Sherlock Astaria]

- [ ] **Liquidation leaves traders with unhealthier collateral basket**: If multi-collateral liquidation uses the more stable collaterals first instead of the riskiest, post-liquidation positions have worse risk profiles. Liquidation should prioritize less stable, riskier collateral. [Source: Dacian — Lending/Borrowing DeFi Attacks, Cyfrin Zaros]

## Dacian — DeFi Liquidation Vulnerabilities (Phase 3)

- [ ] **Profitable user withdraws all collateral, removing liquidation incentive**: In perpetuals, users with large positive PNL can withdraw all deposited collateral while remaining solvent. If PNL reverses, there's nothing to seize for liquidation reward. Fix: enforce minimum collateral deposit regardless of PNL. [Source: Dacian — DeFi Liquidation Vulnerabilities]

- [ ] **Partial liquidation bypasses bad debt accounting**: If bad debt coverage check only triggers on full position closure (`if (!hasPosition)`), a partial liquidator can strategically avoid closing the position entirely, bypassing the requirement to cover bad debt. [Source: Dacian — DeFi Liquidation Vulnerabilities, Code4rena Predy]

- [ ] **EnumerableSet ordering corruption prevents multi-position liquidation**: When liquidating accounts with multiple active markets, iterating over `EnumerableSet` while removing elements causes swap-and-pop ordering corruption, resulting in `panic: array out-of-bounds`. Fix: iterate over `values()` memory copy. [Source: Dacian — DeFi Liquidation Vulnerabilities, Cyfrin Zaros]

- [ ] **Front-running liquidation via nonce increment or micro self-liquidation**: If user-controlled variables (nonce, cooldown timer) are checked during liquidation, a liquidatable user can front-run the liquidation tx to change these variables, forcing the liquidation to revert. [Source: Dacian — DeFi Liquidation Vulnerabilities]

- [ ] **Pending withdrawal blocks liquidation**: If liquidation checks `require(balance - pendingWithdrawals > 0)`, a user can create a pending withdrawal equal to balance, making all subsequent liquidation attempts revert. [Source: Dacian — DeFi Liquidation Vulnerabilities, Dolomite]

- [ ] **ERC721 onReceived callback reverts liquidation**: If an NFT is "pushed" to a user-controlled address during liquidation, the attacker can revert in `onERC721Received`, making liquidation impossible. Same applies to ERC20 tokens with transfer hooks. Fix: use pull-based claims. [Source: Dacian — DeFi Liquidation Vulnerabilities, Code4rena Revert Lend]

- [ ] **Yield vault collateral not seized during liquidation**: If the protocol allows depositing collateral into external yield vaults but the liquidation code doesn't account for vault-deposited collateral, attackers can take loans, get liquidated, then withdraw collateral from the vault. [Source: Dacian — DeFi Liquidation Vulnerabilities, Cyfrin The Standard]

- [ ] **Insurance fund exhaustion blocks liquidation permanently**: If `liquidation reverts when badDebt > insuranceFund`, the protocol enters a permanent state where large insolvent positions cannot be liquidated until the fund accrues enough fees. [Source: Dacian — DeFi Liquidation Vulnerabilities]

- [ ] **Fixed liquidation bonus causes revert below bonus threshold**: A fixed 10% bonus causes liquidation to revert when user has <110% collateral ratio, even though they're under-collateralized. Fix: cap bonus to maximum available amount. [Source: Dacian — DeFi Liquidation Vulnerabilities]

- [ ] **Liquidation fails for non-18 decimal collateral tokens**: Multi-collateral protocols using mixed 18-decimal internal math and native-decimal transfers can have inconsistencies slip in that cause liquidation to revert for non-standard decimal tokens. [Source: Dacian — DeFi Liquidation Vulnerabilities, Pashov GainsNetwork]

- [ ] **Two nonReentrant modifiers in liquidation path**: Complex liquidation code that optionally calls multiple contracts can hit two `nonReentrant` modifiers on the same contract, causing liquidation to revert. [Source: Dacian — DeFi Liquidation Vulnerabilities, SigmaPrime August]

- [ ] **Zero-value transfer reverts block liquidation**: If liquidation code calculates small fee/reward amounts that round to zero, and the token reverts on zero-value transfers, liquidation is blocked. [Source: Dacian — DeFi Liquidation Vulnerabilities]

- [ ] **Token deny list (USDC blacklist) blocks liquidation via push mechanism**: If liquidation sends tokens to addresses on a deny list (e.g., USDC blacklist), the transfer reverts, making liquidation impossible. Fix: use pull-based claims. [Source: Dacian — DeFi Liquidation Vulnerabilities]

- [ ] **Single-borrower liquidation edge case**: Some protocols have `while (troveCount > 1)` in liquidation logic, preventing the last remaining borrower from ever being liquidated. [Source: Dacian — DeFi Liquidation Vulnerabilities, Cyfrin Bima]

- [ ] **Liquidation reward calculated using wrong token decimals**: If reward is paid in 18-decimal collateral but calculated using 6-decimal debt position value, the reward shrinks by 12 orders of magnitude, removing all liquidation incentive. [Source: Dacian — DeFi Liquidation Vulnerabilities, Code4rena Size]

- [ ] **Liquidation fee as % of seized collateral makes liquidation unprofitable**: A 30% protocol fee on total seized collateral (rather than on liquidator profit) removes incentive to liquidate many positions. Fee should be % of profit, not raw collateral. [Source: Dacian — DeFi Liquidation Vulnerabilities, Sherlock Sentiment V2]

- [ ] **Liquidation fees not included in minimum collateral requirement**: If min collateral to avoid liquidation doesn't account for liquidation fees, insufficient collateral exists at liquidation time, causing reverts or bad debt. [Source: Dacian — DeFi Liquidation Vulnerabilities, CodeHawks Zaros]

- [ ] **Earned yield not factored into collateral value — unfair liquidation**: If deposited collateral earns yield but yield isn't included in collateral valuation, users can be unfairly liquidated while their actual collateral value is sufficient. [Source: Dacian — DeFi Liquidation Vulnerabilities]

- [ ] **Borrow interest accumulates while protocol is paused**: If users can't repay during pause but interest keeps accruing, they can be instantly liquidated when unpaused due to interest buildup. [Source: Dacian — DeFi Liquidation Vulnerabilities, Code4rena BendDAO]

- [ ] **isLiquidatable doesn't refresh interest/funding fees before check**: View functions checking liquidation eligibility must first calculate latest accrued fees. Stale fee data means positions appear healthier than they are. [Source: Dacian — DeFi Liquidation Vulnerabilities]

 succeeded in 233ms:
# Chain-Specific EVM Security Checklist

## Arbitrum

### Block Number & Timing
- [ ] **`block.number` returns L1 block number**: On Arbitrum, `block.number` returns the approximate L1 block number, NOT the L2 block number. Use `ArbSys(0x64).arbBlockNumber()` for L2 block number. Time-based logic using `block.number` will have ~1000x lower resolution than expected. Look for: `block.number` used for timing, deadlines, or block-frequency calculations on Arbitrum. [multichain-auditor, beirao ARB-01]

- [ ] **Multiple L2 transactions per L1 block**: Unlike mainnet (1 tx can change `block.number`), many Arbitrum transactions share the same `block.number`. This breaks assumptions like "different block = different transaction". Look for: `require(block.number > lastBlock)` for uniqueness checks. [multichain-auditor]

- [ ] **`block.basefee` returns L1 basefee on Arbitrum**: Use `ArbGasInfo.getL1BaseFeeEstimate()` for L1 fees, and `ArbGasInfo` precompile methods for L2 gas prices. Look for: `block.basefee` used for gas calculations on Arbitrum. [multichain-auditor]

### Sequencer & Retryable Tickets
- [ ] **Sequencer downtime = stale oracle prices + delayed liquidations**: When the sequencer is down, no new transactions execute. When it resumes, oracle prices are stale and positions may have gone deeply underwater. Check the Chainlink sequencer uptime feed and apply grace periods. Look for: Chainlink usage on Arbitrum without sequencer uptime check. [multichain-auditor, beirao ARB-02]

- [ ] **Retryable ticket auto-redeem failure**: If a retryable ticket's auto-redeem fails (insufficient gas), it must be manually redeemed within 7 days or funds are permanently lost. Look for: L1→L2 message passing that assumes auto-redemption always succeeds. [Arbitrum docs]

- [ ] **L2→L1 message delay is 7+ days**: Withdrawals and messages from Arbitrum to L1 are subject to the challenge period (~7 days). Protocols that need faster finality should use a bridge/liquidity network. Look for: UX flows that assume fast L2→L1 message delivery. [Arbitrum docs]

### Address Aliasing
- [ ] **L1→L2 msg.sender is aliased**: When an L1 contract sends a message to L2, the `msg.sender` on L2 is `L1_address + 0x1111000000000000000000000000000000001111`. If access control on L2 checks the raw L1 address, it will ALWAYS fail. Must un-alias the sender. Look for: L1→L2 access control that compares `msg.sender` directly with an L1 contract address. [multichain-auditor, beirao ARB-03]

## Optimism / Base / OP Stack

- [ ] **`block.number` is L2 block number**: Unlike Arbitrum, Optimism returns the L2 block number from `block.number`. But L2 blocks on OP stack are produced every 2 seconds, not 12. Code calibrated for mainnet block times will run 6x faster. Look for: block-number-based timing with mainnet assumptions on OP Stack chains. [multichain-auditor]

- [ ] **L1 data fees**: Transactions on OP Stack pay both L2 execution gas AND L1 data posting gas. The L1 portion can be 90%+ of total cost. Protocols must account for this in gas estimation. Look for: gas estimation using only `gasleft()` without L1 data fee component. [multichain-auditor]

- [ ] **No `prevrandao` / `difficulty`**: On OP Stack L2s, `block.prevrandao` (formerly `block.difficulty`) returns a fixed value. It's NOT random. Look for: `block.prevrandao` or `block.difficulty` used as randomness source. [multichain-auditor]

## zkSync Era

- [ ] **`msg.sender == tx.origin` is true for smart contracts**: In zkSync Era, account abstraction is native — ALL accounts (including smart contracts) have `tx.origin == msg.sender` when they initiate transactions. This breaks the common "is EOA" check. Look for: `require(msg.sender == tx.origin)` as a contract-blocking mechanism. [multichain-auditor]

- [ ] **`EXTCODESIZE` returns 0 for non-EVM contracts**: zkSync has system contracts and native AA accounts that are contracts but return 0 for `extcodesize`. Look for: `extcodesize`-based contract detection. [multichain-auditor]

- [ ] **Different CREATE/CREATE2 address derivation**: zkSync uses a different formula for CREATE/CREATE2 addresses than EVM. Counterfactual addresses computed using the EVM formula will be wrong. Look for: off-chain address pre-computation using standard EVM CREATE2 formula. [multichain-auditor]

- [ ] **Missing opcodes**: `SELFDESTRUCT` is a no-op. `CALLCODE` is not supported. `EXTCODECOPY` may behave differently. Look for: usage of these opcodes on zkSync. [multichain-auditor]

- [ ] **No `receive()` / `fallback()` for ETH transfers**: On zkSync, receiving ETH may require explicit function handling. The default receive/fallback may not work as expected for system-level transfers. Look for: contracts expecting ETH via `receive()` on zkSync. [multichain-auditor]

## Blast

- [ ] **Native yield accrual on ETH balances**: On Blast, ETH held by contracts automatically earns yield. If a contract's logic depends on `address(this).balance` being stable, the balance will drift upward. Look for: precise balance checks like `require(address(this).balance == expectedAmount)`. [Blast docs]

- [ ] **USDB/WETH rebasing**: Blast-native tokens (USDB, WETH) are rebasing by default. Protocols that assume stable balances will have accounting errors. Opt for non-rebasing mode via `IERC20Rebasing(token).configure(YieldMode.CLAIMABLE)` or `YieldMode.VOID`. Look for: Blast deployments using USDB/WETH without configuring yield mode. [Blast docs]

- [ ] **Gas refund claim**: Blast refunds gas fees to contracts. If the contract doesn't implement yield/gas claiming, the refund is stuck. Look for: Blast contracts without `IBlast.claimAllGas()` functionality. [Blast docs]

## BNB Chain (BSC)

- [ ] **BNB token quirks**: BNB reverts on `approve(addr, 0)` but requires approval reset for USDT pattern. There's no universal approve pattern that works for both BNB and USDT. Look for: generic approve-to-zero patterns on BSC. [weird-erc20]

- [ ] **3-second block times**: BSC produces blocks every 3 seconds. Block-number-based timing runs 4x faster than Ethereum mainnet. Look for: block-count timing calibrated for 12-second blocks. [multichain-auditor]

- [ ] **Different precompiles**: BSC has custom precompiles for BLS signature verification and other functions at non-standard addresses. Look for: precompile address assumptions. [multichain-auditor]

## Polygon

- [ ] **MATIC → POL migration**: MATIC is being replaced by POL as the native gas token. Protocols hardcoding WMATIC addresses or assuming MATIC will need updates. Look for: hardcoded MATIC/WMATIC addresses. [multichain-auditor]

- [ ] **Reorgs are more common**: Polygon has more frequent chain reorganizations than Ethereum mainnet. Protocols that rely on block finality with fewer confirmations are at risk. Look for: single-block confirmation assumptions. [multichain-auditor]

- [ ] **USDT on Polygon returns bool (unlike Ethereum)**: Ethereum USDT has no return value; Polygon USDT returns bool. SafeERC20 handles both, but custom transfer wrappers may not. Look for: custom token interaction code that assumes no return value. [multichain-auditor]

## General L2 Considerations

- [ ] **PUSH0 support**: Solidity ≥0.8.20 defaults to Shanghai EVM which uses `PUSH0`. Chains that haven't adopted Shanghai (older L2s, app-chains) reject this opcode. Must compile with `--evm-version paris` or earlier. Look for: Solidity ≥0.8.20 deployed to chains without PUSH0 support. [multichain-auditor]

- [ ] **EIP-1559 parameters differ**: Each chain has its own base fee calculation, fee markets, and priority fee handling. Hardcoded gas parameters from mainnet will be wrong. Look for: hardcoded gas prices, base fee assumptions, or priority fee calculations. [multichain-auditor]

- [ ] **Bridged token addresses differ**: USDC on Ethereum ≠ USDC on Arbitrum ≠ USDC on Optimism. Each is a different contract address. Native USDC vs bridged USDC.e are completely different contracts. Look for: hardcoded token addresses in multi-chain config. [multichain-auditor]

- [ ] **Pre-deployed contract addresses may differ**: OpenZeppelin's `Create2` library, Gnosis Safe singleton, Uniswap factories — their addresses may vary across chains. Look for: hardcoded infrastructure contract addresses. [multichain-auditor]

- [ ] **`block.chainid` must be checked dynamically**: After hard forks, `block.chainid` changes. If cached at deploy time and used for signatures, the cached value is wrong on one fork. Look for: `immutable CHAIN_ID` set in constructor vs runtime `block.chainid` check. [multichain-auditor]

## Arbitrum Deep Dive (Expanded from Arbitrum Checklist)

- [ ] **`block.number` on Arbitrum returns L1 block number, not L2**: The L1 block number updates approximately every minute (~5 block jumps). Short-term timing based on `block.number` is unreliable. For L2 block numbers, use `ArbSys(100).arbBlockNumber()`. Look for: `block.number` used for short-term timing on Arbitrum. [Arbitrum Checklist]

- [ ] **Chainlink price feed staleness thresholds differ on Arbitrum**: LINK/ETH feed has 24h heartbeat with 18 decimals, while LINK/USD has 1h heartbeat with 8 decimals. Wrong threshold = stale prices accepted. Look for: hardcoded staleness thresholds or decimal values that don't match the specific Arbitrum feed. [Arbitrum Checklist]

- [ ] **Chainlink minAnswer/maxAnswer on Arbitrum feeds**: ETH/USD limited to [$10, $1M], USDC/USD limited to [$0.01, $1000], USDT/USD limited to [$0.01, $1000]. During flash crashes or extreme events, the feed returns min/max instead of real price. Look for: Chainlink integrations without checking `answer > minAnswer && answer < maxAnswer`. [Arbitrum Checklist]

- [ ] **Orbit chains with custom fee tokens**: Orbit chains (L3s built on Arbitrum) can use any ERC20 as the fee token instead of ETH. If the fee token has non-18 decimals (e.g., USDC = 6), amounts are scaled between L1 decimals and L2 native currency (18 decimals). Rounding losses occur during conversion. Look for: Orbit chain integrations assuming ETH-denominated fees. [Arbitrum Checklist]

- [ ] **Retryable ticket parameters use mixed denominations on Orbit**: `tokenTotalFeeAmount` uses the fee token's decimals (e.g., 6 for USDC), but `l2CallValue`, `maxSubmissionCost`, and `maxFeePerGas` use 18-decimal native currency denomination. Mixing these causes incorrect fee calculations. Look for: retryable ticket creation on Orbit chains where parameters aren't properly denominated. [Arbitrum Checklist]

## Multichain Deployment Gotchas (Expanded from Multichain-Auditor)

- [ ] **PUSH0 opcode not supported on all chains**: Solidity >=0.8.20 generates PUSH0. Arbitrum added support in ArbOS 11, Optimism in Canyon upgrade, but many chains still don't support it. Deploying 0.8.20+ compiled code to unsupported chains causes deployment failure. Look for: Solidity version >=0.8.20 in multichain deployments. [multichain-auditor, beirao MC-03]

- [ ] **`tx.origin == msg.sender` is not always true for EOAs on L2**: On Optimism, L1→L2 messages can have `tx.origin == msg.sender` even when the sender is a smart contract on L1. EOA-only checks using `tx.origin == msg.sender` are bypassable. Look for: `require(tx.origin == msg.sender)` as an EOA check on L2s. [multichain-auditor]

- [ ] **`transfer()` and `send()` fail on chains with different gas costs**: These forward 2300 gas, which may not be enough on chains with different gas pricing (zkSync Era). Use `.call{value: amount}("")` instead. Look for: `.transfer()` or `.send()` in multichain contracts. [multichain-auditor, beirao MC-04]

- [ ] **Frontrunning impossible on some L2s but trivial on others**: Optimism has a private mempool making frontrunning very difficult. Polygon has a public mempool making it cheap. Threat models must be chain-specific. Look for: frontrunning protections assumed unnecessary based on single-chain behavior. [multichain-auditor]

- [ ] **Hardcoded WETH/token addresses invalid across chains**: WETH is 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 on Ethereum but 0x7ceb23fd6bc0add59e62ac25578270cff1b9f619 on Polygon. Look for: any hardcoded contract address that's assumed same across chains. [multichain-auditor]

- [ ] **zkSync ERA has fundamentally different opcode behavior**: CREATE, CREATE2, CALL, STATICCALL, DELEGATECALL, MSTORE, MLOAD, CALLDATALOAD, CALLDATACOPY all behave differently on zkSync. Direct EVM contract deployment often fails. Look for: contracts deployed to zkSync without ERA-specific adaptation. [multichain-auditor, beirao MC-11]

- [ ] **Precompile addresses differ across chains**: Precompiled contracts exist at different addresses on Arbitrum, Optimism, and other L2s. Using a precompile address from one chain on another may call empty addresses or different contracts. Look for: hardcoded precompile addresses in multichain deployments. [multichain-auditor]

- [ ] **XDai/Gnosis chain token contracts have callbacks**: On Gnosis chain, USDC/WBTC/WETH had post-transfer callbacks unlike their Ethereum counterparts. This enabled reentrancy attacks and led to a chain hard fork. Look for: same-name tokens assumed to behave identically across chains. [multichain-auditor]

web search: 
web search: site:docs.chain.link data feeds l2 sequencer feeds grace period Arbitrum startedAt answer 0 1
web search: 
web search: https://docs.chain.link/data-feeds/l2-sequencer-feeds
collab: Wait
collab: Wait
collab: Wait
codex
The diagnosis is confirmed: the missing invariant was “borrowers have had a usable recovery window,” which price `updatedAt` cannot encode. I’m writing the answer with separate gates for forced/risk-increasing actions and borrower cure actions, so the fix does not accidentally recreate the same problem during the grace period.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-02T144751Z-codex-with-skill-3/audit-quiz-001/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..996b274cc27bd06aac1e40cda3acb06123ed1e82
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,94 @@
+# Post-mortem: fresh price, no opportunity to act
+
+The freshness check was working, but it checked the wrong kind of liveness for this failure.
+
+`updatedAt` answers **“how recently did the oracle publish this value?”** It does not answer **“have users had a functioning chain, and a reasonable inclusion window, since this value became actionable?”** Those are independent properties.
+
+During the outage, ordinary users could not get Arbitrum transactions executed while the off-chain wstETH/ETH market continued moving. When the sequencer recovered, the oracle correctly published the accumulated price move. That round was both accurate and only seconds old, so
+
+```solidity
+block.timestamp - updatedAt <= 3600
+```
+
+correctly evaluated to true. But that same recovery also re-enabled liquidation. The newly executable price and the ability to liquidate arrived without an intervening period in which borrowers could get rescue transactions included. Their previously submitted transactions had no ordering guarantee; the keepers won the first-block ordering race.
+
+Thus the protocol enforced market liveness immediately after restoring keeper access, without first restoring borrower access for long enough to cure positions. This was a sequencer-recovery/fair-access failure, not a stale-price or arithmetic failure.
+
+The feed heartbeat does not change that conclusion. A heartbeat of 86,400 seconds describes the feed's update policy in the absence of a deviation-triggered update. A locally imposed one-hour maximum age can reject older rounds, but it cannot make users able to transact. In fact, on a quiet market that tighter bound can cause an unrelated availability failure when a valid round is more than an hour old.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed and impose a recovery grace period. The Arbitrum One uptime-feed proxy currently documented by Chainlink is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; deployment configuration should still verify the address rather than silently reusing it across chains.
+
+For the uptime feed:
+
+- `answer == 0` means the sequencer is up.
+- `answer == 1` means it is down.
+- `startedAt` is when the current status began. Once the status is up again, `block.timestamp - startedAt` is the recovery age.
+
+Use a fail-closed guard such as:
+
+```solidity
+uint256 internal constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error InvalidSequencerRound();
+error SequencerGracePeriodNotOver();
+
+function _requireSequencerSafeForRiskAction() internal view {
+    (
+        ,
+        int256 status,
+        uint256 startedAt,
+        ,
+
+    ) = sequencerUptimeFeed.latestRoundData();
+
+    if (status != 0) revert SequencerDown();
+    // startedAt == 0 is an uninitialized-state possibility on Arbitrum.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert InvalidSequencerRound();
+    }
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodNotOver();
+    }
+}
+```
+
+An uptime-feed revert or malformed result must also fail closed for the guarded actions. One hour is the common baseline; the production value should be explicitly chosen from expected RPC recovery, transaction inclusion, borrower response, and protocol solvency constraints. It must be long enough to be a real cure window, not merely enough time for an oracle update.
+
+## Exact placement and ordering
+
+Put the guard at the **start of every liquidation entry path**, before reading a collateral price, checking health, changing state, or transferring collateral:
+
+```solidity
+function liquidate(/* ... */) external {
+    _requireSequencerSafeForRiskAction();
+
+    uint256 price = _readValidatedCollateralPrice();
+    // Accrue debt as required, calculate collateralisation, and liquidate.
+}
+```
+
+The resulting order is:
+
+1. Verify that the sequencer is up.
+2. Verify that the post-recovery grace period has elapsed.
+3. Read and validate the collateral price (`answer > 0`, valid/nonfuture `updatedAt`, and the configured feed-specific maximum age).
+4. Accrue debt and calculate the position's current collateralisation.
+5. If it is below 125%, execute liquidation.
+
+Enforce the guard in the shared internal liquidation primitive, or in every externally reachable single, batch, keeper, and callback liquidation path. A protected public wrapper is insufficient if an alternate entry point can reach an unguarded internal implementation.
+
+Apply the same downtime-and-grace guard to actions that create or increase risk, including new borrowing, increasing debt, withdrawing collateral, and equivalent leverage/refinance paths. This prevents users from exploiting an unreliable or discontinuously updated price during recovery.
+
+Do **not** attach this guard indiscriminately to the whole protocol or to a generic price modifier used by cure operations. As soon as blocks resume, borrowers must be able to:
+
+- add collateral; and
+- repay or close debt.
+
+Those risk-reducing paths should not need an oracle price or a sequencer-grace check. If `addCollateral` or `repay` currently calls the price adapter merely to re-check health, refactor it so the transfer and accounting can complete without that unnecessary read. During the grace period, cure transactions are allowed while liquidation and risk-increasing transactions remain blocked.
+
+This is the missing invariant: after sequencer recovery, borrowers receive an explicit executable cure window before a fresh post-outage price may be used against them. Keep the existing price-freshness validation as a separate defense; it protects oracle-data age, while the uptime feed and grace period protect chain access and recovery ordering.
+
+Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..996b274cc27bd06aac1e40cda3acb06123ed1e82
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,94 @@
+# Post-mortem: fresh price, no opportunity to act
+
+The freshness check was working, but it checked the wrong kind of liveness for this failure.
+
+`updatedAt` answers **“how recently did the oracle publish this value?”** It does not answer **“have users had a functioning chain, and a reasonable inclusion window, since this value became actionable?”** Those are independent properties.
+
+During the outage, ordinary users could not get Arbitrum transactions executed while the off-chain wstETH/ETH market continued moving. When the sequencer recovered, the oracle correctly published the accumulated price move. That round was both accurate and only seconds old, so
+
+```solidity
+block.timestamp - updatedAt <= 3600
+```
+
+correctly evaluated to true. But that same recovery also re-enabled liquidation. The newly executable price and the ability to liquidate arrived without an intervening period in which borrowers could get rescue transactions included. Their previously submitted transactions had no ordering guarantee; the keepers won the first-block ordering race.
+
+Thus the protocol enforced market liveness immediately after restoring keeper access, without first restoring borrower access for long enough to cure positions. This was a sequencer-recovery/fair-access failure, not a stale-price or arithmetic failure.
+
+The feed heartbeat does not change that conclusion. A heartbeat of 86,400 seconds describes the feed's update policy in the absence of a deviation-triggered update. A locally imposed one-hour maximum age can reject older rounds, but it cannot make users able to transact. In fact, on a quiet market that tighter bound can cause an unrelated availability failure when a valid round is more than an hour old.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed and impose a recovery grace period. The Arbitrum One uptime-feed proxy currently documented by Chainlink is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; deployment configuration should still verify the address rather than silently reusing it across chains.
+
+For the uptime feed:
+
+- `answer == 0` means the sequencer is up.
+- `answer == 1` means it is down.
+- `startedAt` is when the current status began. Once the status is up again, `block.timestamp - startedAt` is the recovery age.
+
+Use a fail-closed guard such as:
+
+```solidity
+uint256 internal constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error InvalidSequencerRound();
+error SequencerGracePeriodNotOver();
+
+function _requireSequencerSafeForRiskAction() internal view {
+    (
+        ,
+        int256 status,
+        uint256 startedAt,
+        ,
+
+    ) = sequencerUptimeFeed.latestRoundData();
+
+    if (status != 0) revert SequencerDown();
+    // startedAt == 0 is an uninitialized-state possibility on Arbitrum.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert InvalidSequencerRound();
+    }
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodNotOver();
+    }
+}
+```
+
+An uptime-feed revert or malformed result must also fail closed for the guarded actions. One hour is the common baseline; the production value should be explicitly chosen from expected RPC recovery, transaction inclusion, borrower response, and protocol solvency constraints. It must be long enough to be a real cure window, not merely enough time for an oracle update.
+
+## Exact placement and ordering
+
+Put the guard at the **start of every liquidation entry path**, before reading a collateral price, checking health, changing state, or transferring collateral:
+
+```solidity
+function liquidate(/* ... */) external {
+    _requireSequencerSafeForRiskAction();
+
+    uint256 price = _readValidatedCollateralPrice();
+    // Accrue debt as required, calculate collateralisation, and liquidate.
+}
+```
+
+The resulting order is:
+
+1. Verify that the sequencer is up.
+2. Verify that the post-recovery grace period has elapsed.
+3. Read and validate the collateral price (`answer > 0`, valid/nonfuture `updatedAt`, and the configured feed-specific maximum age).
+4. Accrue debt and calculate the position's current collateralisation.
+5. If it is below 125%, execute liquidation.
+
+Enforce the guard in the shared internal liquidation primitive, or in every externally reachable single, batch, keeper, and callback liquidation path. A protected public wrapper is insufficient if an alternate entry point can reach an unguarded internal implementation.
+
+Apply the same downtime-and-grace guard to actions that create or increase risk, including new borrowing, increasing debt, withdrawing collateral, and equivalent leverage/refinance paths. This prevents users from exploiting an unreliable or discontinuously updated price during recovery.
+
+Do **not** attach this guard indiscriminately to the whole protocol or to a generic price modifier used by cure operations. As soon as blocks resume, borrowers must be able to:
+
+- add collateral; and
+- repay or close debt.
+
+Those risk-reducing paths should not need an oracle price or a sequencer-grace check. If `addCollateral` or `repay` currently calls the price adapter merely to re-check health, refactor it so the transfer and accounting can complete without that unnecessary read. During the grace period, cure transactions are allowed while liquidation and risk-increasing transactions remain blocked.
+
+This is the missing invariant: after sequencer recovery, borrowers receive an explicit executable cure window before a fresh post-outage price may be used against them. Keep the existing price-freshness validation as a separate defense; it protects oracle-data age, while the uptime feed and grace period protect chain access and recovery ordering.
+
+Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git diff --check -- answer.md" in /tmp/ethskills-audit-eval/2026-09-02T144751Z-codex-with-skill-3/audit-quiz-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Post-mortem: fresh price, no opportunity to act

The freshness check was working, but it checked the wrong kind of liveness for this failure.

`updatedAt` answers **“how recently did the oracle publish this value?”** It does not answer **“have users had a functioning chain, and a reasonable inclusion window, since this value became actionable?”** Those are independent properties.

During the outage, ordinary users could not get Arbitrum transactions executed while the off-chain wstETH/ETH market continued moving. When the sequencer recovered, the oracle correctly published the accumulated price move. That round was both accurate and only seconds old, so

```solidity
block.timestamp - updatedAt <= 3600
```

correctly evaluated to true. But that same recovery also re-enabled liquidation. The newly executable price and the ability to liquidate arrived without an intervening period in which borrowers could get rescue transactions included. Their previously submitted transactions had no ordering guarantee; the keepers won the first-block ordering race.

Thus the protocol enforced market liveness immediately after restoring keeper access, without first restoring borrower access for long enough to cure positions. This was a sequencer-recovery/fair-access failure, not a stale-price or arithmetic failure.

The feed heartbeat does not change that conclusion. A heartbeat of 86,400 seconds describes the feed's update policy in the absence of a deviation-triggered update. A locally imposed one-hour maximum age can reject older rounds, but it cannot make users able to transact. In fact, on a quiet market that tighter bound can cause an unrelated availability failure when a valid round is more than an hour old.

## Required change

Integrate Chainlink's Arbitrum Sequencer Uptime Feed and impose a recovery grace period. The Arbitrum One uptime-feed proxy currently documented by Chainlink is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; deployment configuration should still verify the address rather than silently reusing it across chains.

For the uptime feed:

- `answer == 0` means the sequencer is up.
- `answer == 1` means it is down.
- `startedAt` is when the current status began. Once the status is up again, `block.timestamp - startedAt` is the recovery age.

Use a fail-closed guard such as:

```solidity
uint256 internal constant SEQUENCER_GRACE_PERIOD = 1 hours;

error SequencerDown();
error InvalidSequencerRound();
error SequencerGracePeriodNotOver();

function _requireSequencerSafeForRiskAction() internal view {
    (
        ,
        int256 status,
        uint256 startedAt,
        ,

    ) = sequencerUptimeFeed.latestRoundData();

    if (status != 0) revert SequencerDown();
    // startedAt == 0 is an uninitialized-state possibility on Arbitrum.
    if (startedAt == 0 || startedAt > block.timestamp) {
        revert InvalidSequencerRound();
    }
    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerGracePeriodNotOver();
    }
}
```

An uptime-feed revert or malformed result must also fail closed for the guarded actions. One hour is the common baseline; the production value should be explicitly chosen from expected RPC recovery, transaction inclusion, borrower response, and protocol solvency constraints. It must be long enough to be a real cure window, not merely enough time for an oracle update.

## Exact placement and ordering

Put the guard at the **start of every liquidation entry path**, before reading a collateral price, checking health, changing state, or transferring collateral:

```solidity
function liquidate(/* ... */) external {
    _requireSequencerSafeForRiskAction();

    uint256 price = _readValidatedCollateralPrice();
    // Accrue debt as required, calculate collateralisation, and liquidate.
}
```

The resulting order is:

1. Verify that the sequencer is up.
2. Verify that the post-recovery grace period has elapsed.
3. Read and validate the collateral price (`answer > 0`, valid/nonfuture `updatedAt`, and the configured feed-specific maximum age).
4. Accrue debt and calculate the position's current collateralisation.
5. If it is below 125%, execute liquidation.

Enforce the guard in the shared internal liquidation primitive, or in every externally reachable single, batch, keeper, and callback liquidation path. A protected public wrapper is insufficient if an alternate entry point can reach an unguarded internal implementation.

Apply the same downtime-and-grace guard to actions that create or increase risk, including new borrowing, increasing debt, withdrawing collateral, and equivalent leverage/refinance paths. This prevents users from exploiting an unreliable or discontinuously updated price during recovery.

Do **not** attach this guard indiscriminately to the whole protocol or to a generic price modifier used by cure operations. As soon as blocks resume, borrowers must be able to:

- add collateral; and
- repay or close debt.

Those risk-reducing paths should not need an oracle price or a sequencer-grace check. If `addCollateral` or `repay` currently calls the price adapter merely to re-check health, refactor it so the transfer and accounting can complete without that unnecessary read. During the grace period, cure transactions are allowed while liquidation and risk-increasing transactions remain blocked.

This is the missing invariant: after sequencer recovery, borrowers receive an explicit executable cure window before a fresh post-outage price may be used against them. Keep the existing price-freshness validation as a separate defense; it protects oracle-data age, while the uptime feed and grace period protect chain access and recovery ordering.

Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..996b274cc27bd06aac1e40cda3acb06123ed1e82
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,94 @@
+# Post-mortem: fresh price, no opportunity to act
+
+The freshness check was working, but it checked the wrong kind of liveness for this failure.
+
+`updatedAt` answers **“how recently did the oracle publish this value?”** It does not answer **“have users had a functioning chain, and a reasonable inclusion window, since this value became actionable?”** Those are independent properties.
+
+During the outage, ordinary users could not get Arbitrum transactions executed while the off-chain wstETH/ETH market continued moving. When the sequencer recovered, the oracle correctly published the accumulated price move. That round was both accurate and only seconds old, so
+
+```solidity
+block.timestamp - updatedAt <= 3600
+```
+
+correctly evaluated to true. But that same recovery also re-enabled liquidation. The newly executable price and the ability to liquidate arrived without an intervening period in which borrowers could get rescue transactions included. Their previously submitted transactions had no ordering guarantee; the keepers won the first-block ordering race.
+
+Thus the protocol enforced market liveness immediately after restoring keeper access, without first restoring borrower access for long enough to cure positions. This was a sequencer-recovery/fair-access failure, not a stale-price or arithmetic failure.
+
+The feed heartbeat does not change that conclusion. A heartbeat of 86,400 seconds describes the feed's update policy in the absence of a deviation-triggered update. A locally imposed one-hour maximum age can reject older rounds, but it cannot make users able to transact. In fact, on a quiet market that tighter bound can cause an unrelated availability failure when a valid round is more than an hour old.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed and impose a recovery grace period. The Arbitrum One uptime-feed proxy currently documented by Chainlink is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; deployment configuration should still verify the address rather than silently reusing it across chains.
+
+For the uptime feed:
+
+- `answer == 0` means the sequencer is up.
+- `answer == 1` means it is down.
+- `startedAt` is when the current status began. Once the status is up again, `block.timestamp - startedAt` is the recovery age.
+
+Use a fail-closed guard such as:
+
+```solidity
+uint256 internal constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error InvalidSequencerRound();
+error SequencerGracePeriodNotOver();
+
+function _requireSequencerSafeForRiskAction() internal view {
+    (
+        ,
+        int256 status,
+        uint256 startedAt,
+        ,
+
+    ) = sequencerUptimeFeed.latestRoundData();
+
+    if (status != 0) revert SequencerDown();
+    // startedAt == 0 is an uninitialized-state possibility on Arbitrum.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert InvalidSequencerRound();
+    }
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodNotOver();
+    }
+}
+```
+
+An uptime-feed revert or malformed result must also fail closed for the guarded actions. One hour is the common baseline; the production value should be explicitly chosen from expected RPC recovery, transaction inclusion, borrower response, and protocol solvency constraints. It must be long enough to be a real cure window, not merely enough time for an oracle update.
+
+## Exact placement and ordering
+
+Put the guard at the **start of every liquidation entry path**, before reading a collateral price, checking health, changing state, or transferring collateral:
+
+```solidity
+function liquidate(/* ... */) external {
+    _requireSequencerSafeForRiskAction();
+
+    uint256 price = _readValidatedCollateralPrice();
+    // Accrue debt as required, calculate collateralisation, and liquidate.
+}
+```
+
+The resulting order is:
+
+1. Verify that the sequencer is up.
+2. Verify that the post-recovery grace period has elapsed.
+3. Read and validate the collateral price (`answer > 0`, valid/nonfuture `updatedAt`, and the configured feed-specific maximum age).
+4. Accrue debt and calculate the position's current collateralisation.
+5. If it is below 125%, execute liquidation.
+
+Enforce the guard in the shared internal liquidation primitive, or in every externally reachable single, batch, keeper, and callback liquidation path. A protected public wrapper is insufficient if an alternate entry point can reach an unguarded internal implementation.
+
+Apply the same downtime-and-grace guard to actions that create or increase risk, including new borrowing, increasing debt, withdrawing collateral, and equivalent leverage/refinance paths. This prevents users from exploiting an unreliable or discontinuously updated price during recovery.
+
+Do **not** attach this guard indiscriminately to the whole protocol or to a generic price modifier used by cure operations. As soon as blocks resume, borrowers must be able to:
+
+- add collateral; and
+- repay or close debt.
+
+Those risk-reducing paths should not need an oracle price or a sequencer-grace check. If `addCollateral` or `repay` currently calls the price adapter merely to re-check health, refactor it so the transfer and accounting can complete without that unnecessary read. During the grace period, cure transactions are allowed while liquidation and risk-increasing transactions remain blocked.
+
+This is the missing invariant: after sequencer recovery, borrowers receive an explicit executable cure window before a fresh post-outage price may be used against them. Keep the existing price-freshness validation as a separate defense; it protects oracle-data age, while the uptime feed and grace period protect chain access and recovery ordering.
+
+Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

codex
Completed the post-mortem and remediation guidance in [answer.md](/tmp/ethskills-audit-eval/2026-09-02T144751Z-codex-with-skill-3/audit-quiz-001/answer.md).

It identifies the missing sequencer-recovery grace period and specifies exactly which protocol paths must be blocked or remain available.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..996b274cc27bd06aac1e40cda3acb06123ed1e82
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,94 @@
+# Post-mortem: fresh price, no opportunity to act
+
+The freshness check was working, but it checked the wrong kind of liveness for this failure.
+
+`updatedAt` answers **“how recently did the oracle publish this value?”** It does not answer **“have users had a functioning chain, and a reasonable inclusion window, since this value became actionable?”** Those are independent properties.
+
+During the outage, ordinary users could not get Arbitrum transactions executed while the off-chain wstETH/ETH market continued moving. When the sequencer recovered, the oracle correctly published the accumulated price move. That round was both accurate and only seconds old, so
+
+```solidity
+block.timestamp - updatedAt <= 3600
+```
+
+correctly evaluated to true. But that same recovery also re-enabled liquidation. The newly executable price and the ability to liquidate arrived without an intervening period in which borrowers could get rescue transactions included. Their previously submitted transactions had no ordering guarantee; the keepers won the first-block ordering race.
+
+Thus the protocol enforced market liveness immediately after restoring keeper access, without first restoring borrower access for long enough to cure positions. This was a sequencer-recovery/fair-access failure, not a stale-price or arithmetic failure.
+
+The feed heartbeat does not change that conclusion. A heartbeat of 86,400 seconds describes the feed's update policy in the absence of a deviation-triggered update. A locally imposed one-hour maximum age can reject older rounds, but it cannot make users able to transact. In fact, on a quiet market that tighter bound can cause an unrelated availability failure when a valid round is more than an hour old.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed and impose a recovery grace period. The Arbitrum One uptime-feed proxy currently documented by Chainlink is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; deployment configuration should still verify the address rather than silently reusing it across chains.
+
+For the uptime feed:
+
+- `answer == 0` means the sequencer is up.
+- `answer == 1` means it is down.
+- `startedAt` is when the current status began. Once the status is up again, `block.timestamp - startedAt` is the recovery age.
+
+Use a fail-closed guard such as:
+
+```solidity
+uint256 internal constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error InvalidSequencerRound();
+error SequencerGracePeriodNotOver();
+
+function _requireSequencerSafeForRiskAction() internal view {
+    (
+        ,
+        int256 status,
+        uint256 startedAt,
+        ,
+
+    ) = sequencerUptimeFeed.latestRoundData();
+
+    if (status != 0) revert SequencerDown();
+    // startedAt == 0 is an uninitialized-state possibility on Arbitrum.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert InvalidSequencerRound();
+    }
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodNotOver();
+    }
+}
+```
+
+An uptime-feed revert or malformed result must also fail closed for the guarded actions. One hour is the common baseline; the production value should be explicitly chosen from expected RPC recovery, transaction inclusion, borrower response, and protocol solvency constraints. It must be long enough to be a real cure window, not merely enough time for an oracle update.
+
+## Exact placement and ordering
+
+Put the guard at the **start of every liquidation entry path**, before reading a collateral price, checking health, changing state, or transferring collateral:
+
+```solidity
+function liquidate(/* ... */) external {
+    _requireSequencerSafeForRiskAction();
+
+    uint256 price = _readValidatedCollateralPrice();
+    // Accrue debt as required, calculate collateralisation, and liquidate.
+}
+```
+
+The resulting order is:
+
+1. Verify that the sequencer is up.
+2. Verify that the post-recovery grace period has elapsed.
+3. Read and validate the collateral price (`answer > 0`, valid/nonfuture `updatedAt`, and the configured feed-specific maximum age).
+4. Accrue debt and calculate the position's current collateralisation.
+5. If it is below 125%, execute liquidation.
+
+Enforce the guard in the shared internal liquidation primitive, or in every externally reachable single, batch, keeper, and callback liquidation path. A protected public wrapper is insufficient if an alternate entry point can reach an unguarded internal implementation.
+
+Apply the same downtime-and-grace guard to actions that create or increase risk, including new borrowing, increasing debt, withdrawing collateral, and equivalent leverage/refinance paths. This prevents users from exploiting an unreliable or discontinuously updated price during recovery.
+
+Do **not** attach this guard indiscriminately to the whole protocol or to a generic price modifier used by cure operations. As soon as blocks resume, borrowers must be able to:
+
+- add collateral; and
+- repay or close debt.
+
+Those risk-reducing paths should not need an oracle price or a sequencer-grace check. If `addCollateral` or `repay` currently calls the price adapter merely to re-check health, refactor it so the transfer and accounting can complete without that unnecessary read. During the grace period, cure transactions are allowed while liquidation and risk-increasing transactions remain blocked.
+
+This is the missing invariant: after sequencer recovery, borrowers receive an explicit executable cure window before a fresh post-outage price may be used against them. Keep the existing price-freshness validation as a separate defense; it protects oracle-data age, while the uptime feed and grace period protect chain access and recovery ordering.
+
+Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

tokens used
43,756
````

## final message

Completed the post-mortem and remediation guidance in [answer.md](/tmp/ethskills-audit-eval/2026-09-02T144751Z-codex-with-skill-3/audit-quiz-001/answer.md).

It identifies the missing sequencer-recovery grace period and specifies exactly which protocol paths must be blocked or remain available.
