# Executor transcript — 2026-09-03T133206Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06778-3eaf-7293-bead-df1f303a75c9
--------
user
This workspace is ArbiLend, our overcollateralised USDC lending market. It is
code-complete and we deploy to Arbitrum One in two weeks. Nothing is live yet
and the code is not hosted anywhere — this directory is the whole codebase.

I need a security review before we put real money behind it. Start with
README.md: it says what we are shipping, where it runs, and what we plan to
list next.

Write AUDIT-REPORT.md in this directory. For every issue: a severity, the
contract and function it lives in, what an attacker or an unlucky user
actually gets out of it, and the fix you would make. Rank it so I can hand
the top of the list to the team on Monday.

Report only — leave everything under src/ exactly as it is. AUDIT-REPORT.md
should be the only file you leave behind: if you take working notes on the
way, clear them out before you finish.

2026-09-03T13:32:08.988282Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a06778-3eaf-7293-bead-df1f303a75c9.tmp-1788442328760724029: line 2547: syntax error near unexpected token `('

codex
I’m using the audit skill because this is a pre-deployment EVM security review. Its workflow explicitly uses parallel audit agents; I’ll keep all code untouched and leave only the requested report.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/audit/SKILL.md" in /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
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

exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md' in /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
 succeeded in 249ms:
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

exec
/bin/bash -lc "pwd && rg --files -g '"'!AUDIT-REPORT.md'"' -g '"'!node_modules/**'"' | sort && sed -n '1,260p' README.md && find src -type f -maxdepth 5 -print" in /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
 succeeded in 36ms:
/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
README.md
TASK.md
foundry.toml
package.json
src/CollateralVault.sol
src/LendingMarket.sol
src/MarketProxy.sol
src/PriceOracle.sol
src/interfaces/IAggregatorV3.sol
src/interfaces/IERC20.sol
src/interfaces/ILendingMarket.sol
# ArbiLend

Overcollateralised USDC lending market. Users deposit collateral into
`CollateralVault`, borrow USDC from `LendingMarket` against it, and are
liquidated when their position falls below the liquidation threshold.

Deployment target: **Arbitrum One**. Mainnet is not in scope for this release.

| Piece | Address / value |
| --- | --- |
| Debt asset | USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| First listed collateral | wstETH `0x5979D7b546E38E414F7E9822514be443A4800529` |
| Feed set for wstETH | stETH / USD `0x07C5b924399cc23c24a95c8743DE4006a32b7f2a` |
| Feed set for USDC | USDC / USD `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3` |
| Liquidation threshold | 8000 bps |
| Liquidation bonus | 500 bps |
| Borrow rate | 400 bps / year |

## Contracts

- `LendingMarket` — borrow / repay / liquidate, interest accrual, health
  factor. Sits behind `MarketProxy` so we can ship fixes without migrating
  positions. Storage layout is append-only; do not reorder.
- `CollateralVault` — custody and per-user accounting for collateral. Only the
  market can seize.
- `PriceOracle` — Chainlink price source, one feed per token, prices returned
  scaled to 1e18 USD.
- `MarketProxy` — ERC-1967 proxy the market is deployed behind.

## Collateral listing

wstETH is the only collateral at launch. Governance lists further tokens with
`LendingMarket.listCollateral`; the shortlist for the next round is weETH,
ezETH and USDT, and the DAO has asked for a path to yield-bearing and
rebasing collateral after that.

## Liquidity

There is no supply side in this release. The treasury seeds the market's USDC
balance with a direct transfer and takes the interest; lender deposits land in
v2.

## Interest

Debt is tracked with a global borrow index. `accrueInterest()` runs at the top
of every state-changing entry point and advances the index by the elapsed
time since the last accrual.

## Development

```bash
forge build
```

No dependencies and no test suite yet — the suite lands with the audit fixes.
src/LendingMarket.sol
src/MarketProxy.sol
src/CollateralVault.sol
src/interfaces/IAggregatorV3.sol
src/interfaces/ILendingMarket.sol
src/interfaces/IERC20.sol
src/PriceOracle.sol

exec
/bin/bash -lc "for f in src/*.sol src/interfaces/*.sol; do sed -n '1,280p' \""'$f"; done' in /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
 succeeded in 10ms:
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @notice Chainlink price source for the market. One feed per token, prices returned scaled to 1e18 USD.
contract PriceOracle {
    address public owner;

    mapping(address => IAggregatorV3) public feeds;

    error NotOwner();
    error FeedNotSet(address token);

    event FeedUpdated(address indexed token, address feed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setFeed(address token, IAggregatorV3 feed) external onlyOwner {
        feeds[token] = feed;
        emit FeedUpdated(token, address(feed));
    }

    /// @notice Price of one whole unit of `token` in USD, scaled to 1e18.
    function getPrice(address token) external view returns (uint256) {
        IAggregatorV3 feed = feeds[token];
        if (address(feed) == address(0)) revert FeedNotSet(token);

        int256 answer = feed.latestAnswer();
        return uint256(answer) * 10 ** (18 - feed.decimals());
    }
}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function latestAnswer() external view returns (int256);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function allowance(address owner, address spender) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    function decimals() external view returns (uint8);
}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ILendingMarket {
    function requireHealthy(address user) external view;
}

exec
/bin/bash -lc 'git status --short && forge build' in /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
 succeeded in 308ms:
Compiling 7 files with Solc 0.8.28
Solc 0.8.28 finished in 231.07ms
Compiler run successful!
2026-09-03T13:33:07.927104Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
note[screaming-snake-case-immutable]: immutables should use SCREAMING_SNAKE_CASE
 --> src/CollateralVault.sol:9:30
  |
9 |     address public immutable market;
  |                              ^^^^^^ help: consider using: `MARKET`
  |
  = help: https://book.getfoundry.sh/reference/forge/forge-lint#screaming-snake-case-immutable

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/PriceOracle.sol:18:5
   |
18 | /     modifier onlyOwner() {
19 | |         if (msg.sender != owner) revert NotOwner();
20 | |         _;
21 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
18 ~     modifier onlyOwner() {
19 +         _onlyOwner();
20 +         _;
21 +     }
22 + 
23 +     function _onlyOwner() internal {
24 +         if (msg.sender != owner) revert NotOwner();
25 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[divide-before-multiply]: multiplication should occur before division to avoid loss of precision
   --> src/LendingMarket.sol:150:16
    |
150 |         return (collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS;
    |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#divide-before-multiply

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/CollateralVault.sol:22:5
   |
22 | /     modifier onlyMarket() {
23 | |         if (msg.sender != market) revert NotMarket();
24 | |         _;
25 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
22 ~     modifier onlyMarket() {
23 +         _onlyMarket();
24 +         _;
25 +     }
26 + 
27 +     function _onlyMarket() internal {
28 +         if (msg.sender != market) revert NotMarket();
29 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[unsafe-typecast]: typecasts that can truncate values should be checked
  --> src/PriceOracle.sol:44:16
   |
44 |         return uint256(answer) * 10 ** (18 - feed.decimals());
   |                ^^^^^^^^^^^^^^^
   |
   = note: consider disabling this lint if you're certain the cast is safe
           
           // casting to 'uint256' is safe because [explain why]
           // forge-lint: disable-next-line(unsafe-typecast)
           
           
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unsafe-typecast

note[unwrapped-modifier-logic]: wrap modifier logic to reduce code size
  --> src/LendingMarket.sol:51:5
   |
51 | /     modifier onlyOwner() {
52 | |         if (msg.sender != owner) revert NotOwner();
53 | |         _;
54 | |     }
   | |_____^
   |
help: wrap modifier logic to reduce code size
   |
51 ~     modifier onlyOwner() {
52 +         _onlyOwner();
53 +         _;
54 +     }
55 + 
56 +     function _onlyOwner() internal {
57 +         if (msg.sender != owner) revert NotOwner();
58 +     }
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#unwrapped-modifier-logic

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> src/CollateralVault.sol:38:9
   |
38 |         IERC20(token).transferFrom(msg.sender, address(this), amount);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> src/CollateralVault.sol:48:9
   |
48 |         IERC20(token).transfer(msg.sender, amount);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
  --> src/CollateralVault.sol:57:9
   |
57 |         IERC20(token).transfer(to, amount);
   |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

note[asm-keccak256]: use of inefficient hashing mechanism; consider using inline assembly
   --> src/LendingMarket.sol:163:30
    |
163 |         bytes32 structHash = keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount));
    |                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#asm-keccak256

note[asm-keccak256]: use of inefficient hashing mechanism; consider using inline assembly
   --> src/LendingMarket.sol:164:26
    |
164 |         bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    |                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#asm-keccak256

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
   --> src/LendingMarket.sol:177:9
    |
177 |         debtAsset.transferFrom(msg.sender, address(this), amount);
    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
   --> src/LendingMarket.sol:204:9
    |
204 |         debtAsset.transfer(borrower, amount);
    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer

warning[erc20-unchecked-transfer]: ERC20 'transfer' and 'transferFrom' calls should check the return value
   --> src/LendingMarket.sol:213:9
    |
213 |         debtAsset.transferFrom(msg.sender, address(this), debt);
    |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: https://book.getfoundry.sh/reference/forge/forge-lint#erc20-unchecked-transfer


codex
The first pass confirms the code compiles. I’m now validating economic paths and deployment-specific assumptions; the initial hotspots are authorization, health-factor arithmetic, oracle handling, signatures, and liquidation/interest accounting.
collab: Wait
collab: Wait
exec
/bin/bash -lc "nl -ba src/LendingMarket.sol | sed -n '1,280p'; nl -ba src/CollateralVault.sol; nl -ba src/PriceOracle.sol; nl -ba src/MarketProxy.sol; git status --short" in /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
 succeeded in 8ms:
     1	// SPDX-License-Identifier: MIT
     2	pragma solidity 0.8.28;
     3	
     4	/// @notice ERC-1967 proxy the market is deployed behind. The implementation owns the upgrade entry point.
     5	contract MarketProxy {
     6	    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
     7	
     8	    event Upgraded(address indexed implementation);
     9	
    10	    constructor(address implementation, bytes memory initData) {
    11	        assembly {
    12	            sstore(IMPLEMENTATION_SLOT, implementation)
    13	        }
    14	        emit Upgraded(implementation);
    15	
    16	        if (initData.length > 0) {
    17	            (bool ok, bytes memory ret) = implementation.delegatecall(initData);
    18	            if (!ok) {
    19	                assembly {
    20	                    revert(add(ret, 0x20), mload(ret))
    21	                }
    22	            }
    23	        }
    24	    }
    25	
    26	    fallback() external payable {
    27	        assembly {
    28	            let impl := sload(IMPLEMENTATION_SLOT)
    29	            calldatacopy(0, 0, calldatasize())
    30	            let ok := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
    31	            returndatacopy(0, 0, returndatasize())
    32	            switch ok
    33	            case 0 { revert(0, returndatasize()) }
    34	            default { return(0, returndatasize()) }
    35	        }
    36	    }
    37	
    38	    receive() external payable {}
    39	}

collab: Wait
exec
/bin/bash -lc 'ls -la findings-*.md 2>/dev/null || true' in /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
 succeeded in 2ms:
collab: Wait
collab: Wait
exec
/bin/bash -lc "for f in findings-general.md findings-precision.md findings-lending.md; do sed -n '1,320p' \""'$f"; done' in /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
 succeeded in 2ms:
collab: Wait
collab: Wait
collab: Wait
collab: Wait
collab: Wait
collab: Wait
exec
/bin/bash -lc "for f in findings-erc20.md findings-oracles.md findings-proxies.md; do sed -n '1,360p' \""'$f"; done' in /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
 succeeded in 7ms:
# Oracle and Pricing Findings

## [CRITICAL] Anyone can replace the market oracle and drain all seeded USDC

- **Contract / function:** `LendingMarket.setOracle()` (`src/LendingMarket.sol:91-94`)
- **What happens:** `setOracle` has no access control. An attacker can deploy an oracle that reports an arbitrarily large collateral price (and a normal or tiny USDC price), call `setOracle`, deposit a trivial amount of wstETH, and borrow the market's entire seeded USDC balance. The same primitive can make every existing account appear underwater and let the attacker liquidate users at attacker-chosen prices. The attacker receives the treasury's USDC and/or users' collateral; the protocol is left with bad debt.
- **Recommended fix:** Add `onlyOwner` (preferably a timelocked governance role) to `setOracle`. Validate that the new address is nonzero and contains code. Use a two-step/timelocked oracle change with an emergency pause, and test the candidate oracle for every listed collateral and the debt asset before activation.

## [HIGH] wstETH is priced as one stETH, overpaying liquidators in wstETH

- **Contract / function:** Launch feed configuration consumed by `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `LendingMarket._liquidate()` (`src/PriceOracle.sol:39-45`, `src/LendingMarket.sol:132-138, 209-230`)
- **What happens:** The README maps wstETH (`0x5979...0529`) directly to the stETH/USD feed (`0x07C5...f2a`). One wstETH represents more than one stETH because staking rewards accumulate in its conversion rate. The market therefore treats `1 wstETH == 1 stETH`. This understates users' collateral value, makes them borrow less than intended and become liquidatable prematurely. More importantly, liquidation computes the number of wstETH to seize by dividing a USD claim by the stETH price. A liquidator receives `(1 + bonus)` worth of **stETH units** as wstETH units, whose real value is higher by the wstETH/stETH exchange rate. Thus a liquidator extracts more than the configured 5% bonus from the unlucky borrower; the excess grows as staking rewards accumulate.
- **Recommended fix:** Price wstETH itself. Compose a manipulation-resistant wstETH/stETH conversion rate with the stETH/USD feed (with independent freshness and validity checks), or use an appropriate dedicated wstETH/USD route. Unit-test both collateral valuation and seized-token amounts against the live conversion rate; never map wstETH directly to stETH/USD at 1:1.

## [HIGH] Prices have no round-validity or freshness checks

- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:39-45`)
- **What happens:** The oracle calls deprecated `latestAnswer()` and cannot inspect `updatedAt`, `roundId`, `answeredInRound`, or `startedAt`. If either feed stops updating, all borrowing and liquidation continue indefinitely at the last price. An attacker can borrow excessive USDC against collateral whose market value has already fallen, leaving bad debt; in the reverse direction, users can be liquidated using an obsolete low collateral price or high USDC price. A deprecated/disabled feed can also brick every price-dependent operation.
- **Recommended fix:** Use `latestRoundData()` and require `answer > 0`, `startedAt != 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Store a per-feed maximum age based on that feed's Arbitrum heartbeat/deviation policy, rather than one global threshold. Add a controlled pause/fallback process for an unavailable or deprecated feed.

## [MEDIUM] Arbitrum sequencer outages are not checked and no recovery grace period is enforced

- **Contract / function:** `PriceOracle.getPrice()` and all price-dependent borrow/liquidation paths (`src/PriceOracle.sol:39-45`)
- **What happens:** The deployment target is Arbitrum One, but the oracle never checks Chainlink's Arbitrum sequencer uptime feed. After the sequencer recovers, market transactions may execute before asset feeds have caught up. A borrower can exploit a pre-outage high collateral price to take USDC that is no longer adequately collateralized; a liquidator can exploit a pre-outage low price to seize collateral from a position that is healthy at current prices. Users or the treasury bear the difference.
- **Recommended fix:** Before accepting any asset price, query the Arbitrum sequencer uptime feed, require the sequencer status to be up, validate its round data, and require at least a one-hour grace period since recovery. Apply this check consistently to borrow, withdraw-health checks, and liquidation.

## [MEDIUM] Feed answers are not protected against zero, negative, or circuit-breaker values

- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:39-45`), consumed by `LendingMarket.healthFactor()` and `_liquidate()`
- **What happens:** A zero USDC/USD answer makes every debt position appear to have zero USD debt, so `healthFactor` returns the maximum value and an attacker with minimal collateral can borrow all available USDC. A zero collateral answer makes liquidation revert when `_liquidate` divides by `price`, preventing bad-debt containment. A negative answer is cast to `uint256` and generally causes arithmetic overflow/reverts for the configured 8-decimal feeds, globally denying borrow, withdraw, and liquidation. Finally, no check rejects a Chainlink aggregator's `minAnswer`/`maxAnswer`; in an extreme crash a floored collateral price can remain above the true market price and permit undercollateralized borrowing.
- **Recommended fix:** Explicitly reject `answer <= 0`. For each feed, evaluate the underlying aggregator's configured bounds and reject boundary answers, or install independent conservative price/deviation circuit breakers and pause affected actions. Handle invalid values by pausing new borrowing while preserving safe repayment/emergency-resolution paths.

## [LOW] Feeds with more than 18 decimals permanently revert price queries

- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:44`)
- **What happens:** Normalization evaluates `18 - feed.decimals()`. Any future feed with more than 18 decimals underflows and reverts. Because governance plans to list more assets, a mistaken feed selection can make valuation, withdrawals, borrowing, and liquidation revert for users exposed to that asset. Users gain nothing and can have positions stuck until governance repairs the feed.
- **Recommended fix:** Normalize in both directions: multiply when decimals are below 18 and divide when above 18. Reject unreasonable decimal values during `setFeed`, and perform a successful validated price read before a collateral can be listed.

## Oracle-specific notes

- The configured addresses currently identify themselves on Arbitrum as `STETH / USD` and `USDC / USD`, both with 8 decimals. Dynamic decimal reads are therefore correct for the two launch feeds, but the wstETH denomination mismatch remains.
- USDC is not hardcoded to USD parity; using USDC/USD is the correct direction. No TWAP, Pyth, LP-token pricing, or VRF path exists in the reviewed code.
## [P-1] Anyone can replace the market implementation and steal all treasury liquidity
**Severity**: Critical
**Category**: evm-audit-proxies
**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
**Description**: `upgradeTo()` writes an arbitrary address directly to the ERC-1967 implementation slot without `onlyOwner` (or any other authorization). Because calls execute through `MarketProxy` by `delegatecall`, any account can replace all market logic while retaining the proxy's storage and token balances. An attacker can install logic that transfers the proxy's entire USDC balance to themselves, rewrite every position, or permanently disable the market. The attacker directly receives all treasury-seeded USDC held by the proxy; borrowers and the treasury lose access to the legitimate market state.
**Proof of Concept**: (1) Deploy a contract with a function such as `drain(IERC20 token)` that calls `token.transfer(msg.sender, token.balanceOf(address(this)))`. (2) Call `LendingMarket(proxy).upgradeTo(address(maliciousImplementation))`; the call succeeds for any sender and overwrites the proxy's implementation slot. (3) Call `drain(USDC)` through the proxy. The malicious implementation executes in proxy context and transfers the proxy's full USDC balance to the attacker.
**Recommendation**: Restrict upgrades to a deliberately secured authority (`onlyOwner`, preferably a timelocked multisig) and use a reviewed UUPS implementation such as OpenZeppelin `UUPSUpgradeable`, including `_authorizeUpgrade`. Add upgrade-event monitoring and operational upgrade tests.

## [P-2] Optional initialization lets the first caller seize an uninitialized deployment
**Severity**: High
**Category**: evm-audit-proxies
**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`) and `LendingMarket.initialize()` (`src/LendingMarket.sol:56`)
**Description**: The proxy accepts empty `initData`, while `initialize()` is externally callable by anyone exactly once and accepts an attacker-selected owner, oracle, vault, and debt asset. No deployment script exists in the repository to establish that deployment and initialization will be atomic. If the proxy is deployed with empty data (or initialization is otherwise deferred), a mempool observer can initialize it first. The attacker becomes owner and permanently installs attacker-controlled dependencies. Once the treasury seeds the advertised proxy—or if seeding and setup are bundled later—the attacker can control listings and use the malicious dependencies to compromise or deny the market. This requires the specific deployment mistake of non-atomic initialization, but then permanently compromises the deployment.
**Proof of Concept**: (1) Deploy `MarketProxy(implementation, "")`. (2) Before the deployer initializes it, an attacker calls `initialize(attacker, attackerOracle, attackerVault, USDC)` through the proxy. (3) The intended initializer now reverts with `AlreadyInitialized()`. The proxy is permanently configured with attacker-selected ownership and core dependencies unless it is abandoned or upgraded; in the current code the attacker can also exploit the unrestricted upgrade path in P-1 immediately.
**Recommendation**: Require non-empty initialization calldata in the proxy constructor and atomically delegatecall `initialize` as part of deployment. Validate every initialization address as nonzero and, where appropriate, verify deployed code. Make the deployment script pass the exact encoded initializer and assert all resulting state before funding the proxy. Also lock the standalone implementation against direct initialization (for example with OpenZeppelin `Initializable` and `_disableInitializers()`), although direct initialization alone does not control this custom proxy.

## [P-3] Upgrades do not verify that the replacement is code-compatible, so one bad upgrade can be irreversible
**Severity**: Medium
**Category**: evm-audit-proxies
**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`) and `MarketProxy.fallback()` (`src/MarketProxy.sol:26`)
**Description**: `upgradeTo()` accepts zero addresses, EOAs, and arbitrary contracts without checking code presence or ERC-1967/UUPS compatibility. All upgrade logic lives in the current implementation and the proxy has no independent admin recovery function. Consequently, setting the slot to an address without a working compatible `upgradeTo()` removes the only route to another implementation. Calls to an EOA can misleadingly return success with empty returndata, while the market is permanently unusable. After P-1 is fixed, an authorized operator typo or an incompatible release can still permanently strand the market and its state; users may be unable to borrow, repay, or liquidate, and treasury USDC may be stuck.
**Proof of Concept**: Call `upgradeTo(address(0x1234))`, where `0x1234` has no code. The slot update succeeds. Subsequent proxy calls delegatecall an address with no code and return empty data. Because that address exposes no upgrade function and `MarketProxy` exposes no admin upgrade path, another implementation cannot be installed through the proxy.
**Recommendation**: Adopt a standard UUPS implementation that checks `proxiableUUID()` against the ERC-1967 slot before changing implementations, reject `address(0)` and addresses with `code.length == 0`, and test upgrade compatibility/storage layout before execution. Alternatively, move a tightly controlled recovery/upgrade path into a standard transparent proxy. These checks supplement, not replace, the authorization required by P-1.

2026-09-03T13:40:50.420775Z  WARN codex_core::responses_retry: stream disconnected - retrying sampling request (1/5 in 211ms)... turn_id=01a0677e-d388-7762-a94e-db6b702fefa0 retries=1 max_retries=5 sampling_error=stream disconnected before completion: An error occurred while processing your request. You can retry your request, or contact us through our help center at help.openai.com if the error persists. Please include the request ID 3511cba1-dd4a-4251-898e-7c3b23a4912e in your message.
codex
The review has confirmed multiple deployment blockers, including three permissionless control-plane functions and two independent ways solvent borrowers can be liquidated unfairly. I’m deduplicating overlapping checklist results and separating launch blockers from risks that apply only to planned collateral types.
collab: Wait
collab: Wait
collab: Wait
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001/AUDIT-REPORT.md
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..66627d77d88afa76bc10573ba7dd2b9d0f5f0042
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,208 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-03  
+**Scope:** `README.md`, `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Target:** Arbitrum One; native USDC debt; wstETH launch collateral  
+**Result:** **Do not deploy in the current state.**
+
+## Executive summary
+
+The review found **2 Critical, 8 High, 7 Medium, and 4 Low** issues. The two Critical issues independently let any caller take control of pricing or implementation logic and steal the treasury-funded USDC and deposited collateral. The public liquidation-threshold setter is another immediate launch blocker. Even after access control is repaired, the health-factor formula incorrectly liquidates solvent borrowers, the proposed wstETH feed values the wrong unit, and stale oracle data is accepted.
+
+Fix order for Monday:
+
+1. Lock down upgrades, oracle replacement, and risk parameters; require atomic initialization.
+2. Correct health, wstETH pricing, oracle validation, interest realization on withdrawal, and full-repayment rounding.
+3. Add adversarial tests for borrowing, repayment, withdrawal, liquidation, oracle outages, and upgrades before funding the proxy.
+4. Address the Medium issues before launch. Do not list weETH, ezETH, USDT, fee-on-transfer, callback-capable, or rebasing assets until asset-specific adapters and accounting are implemented.
+
+This was a source review plus successful `forge build`; the repository has no test suite. No deployment scripts were present, so initialization safety and on-chain configuration could not be verified.
+
+## Findings
+
+## [C-01] Anyone can replace the implementation and drain the market and vault
+**Severity**: Critical  
+**Category**: Access control / proxy  
+**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)  
+**Description**: `upgradeTo()` has no authorization and writes an arbitrary address to the ERC-1967 implementation slot. Malicious logic then executes in the proxy context. Because the proxy holds seeded USDC and is the immutable `market` trusted by `CollateralVault`, the replacement can transfer all USDC and call `vault.seize()` for every depositor. The attacker receives all funded liquidity and deposited collateral.  
+**Proof of Concept**: Deploy logic with a drain function, call `upgradeTo(malicious)` through the proxy, then call the drain through the proxy. The new logic can transfer the proxy's USDC and invoke the vault as its trusted market.  
+**Recommendation**: Use a reviewed UUPS or transparent proxy implementation. Restrict upgrades to a timelocked multisig, validate code and `proxiableUUID`, and test storage compatibility and rollback/recovery procedures.
+
+## [C-02] Anyone can replace the oracle and steal all seeded USDC
+**Severity**: Critical  
+**Category**: Access control / oracle  
+**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)  
+**Description**: `setOracle()` has no `onlyOwner`. An attacker can report an enormous collateral price and a tiny positive USDC price, borrow the complete USDC balance against dust, and leave unrecoverable debt. The same control can fabricate unhealthy positions and extract users' collateral as liquidator.  
+**Proof of Concept**: Deposit dust wstETH, install an attacker oracle, return a huge wstETH price and small USDC price, then borrow the proxy's entire USDC balance.  
+**Recommendation**: Add access control, validate that the new oracle is a contract supporting every active asset, and place oracle changes behind a timelock/multisig with a pause and two-step activation process.
+
+## [H-01] Anyone can force liquidations by changing the liquidation threshold
+**Severity**: High  
+**Category**: Access control / risk parameters  
+**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)  
+**Description**: Any caller can set the threshold to any value. Setting it to zero makes every debtor unhealthy. The caller can then repay selected debts and receive borrowers' collateral plus the 5% bonus; unlucky borrowers lose the bonus and their positions are forcibly closed. Unbounded high values also allow governance parameters to be bypassed and can cause arithmetic reverts.  
+**Proof of Concept**: Call `setLiquidationThreshold(0)`, then call `liquidate(user)` for an otherwise healthy borrower after approving USDC.  
+**Recommendation**: Add `onlyOwner`, require `0 < bps && bps <= BPS`, use a timelocked risk role, and pause borrowing around material parameter changes.
+
+## [H-02] Division before multiplication makes solvent positions liquidatable
+**Severity**: High  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:146`)  
+**Description**: `collateralValueUsd / debtUsd` truncates before applying WAD precision. At the configured 80% threshold, every collateral ratio from 100% to just under 200% produces a health factor of `0.8e18`. A borrower with $1,500 collateral and $1,000 debt should have a 1.2 health factor but is liquidatable. A liquidator receives $1,050 of collateral; the solvent borrower loses $50 and is forcibly closed.  
+**Proof of Concept**: For `$1,500e18 / $1,000e18`, the contract first obtains `1`, then returns `1 * 8000 * 1e18 / 10000 = 0.8e18`.  
+**Recommendation**: Use full-precision multiplication before division, e.g. `mulDiv(collateralUsd, liquidationThreshold * WAD, debtUsd * BPS)`, with explicit rounding. Test immediately below, at, and above 125% collateralization.
+
+## [H-03] The stETH/USD feed prices wstETH as if it were one stETH
+**Severity**: High  
+**Category**: Oracle / asset integration  
+**Location**: launch configuration in `README.md`; `LendingMarket.collateralValueUsd()` and `_liquidate()` (`src/LendingMarket.sol:132`, `src/LendingMarket.sol:209`)  
+**Description**: One wstETH represents a changing amount greater than one stETH. Applying the stETH/USD feed directly to raw wstETH units undervalues collateral and transfers too many wstETH during liquidation. If one wstETH represents 1.20 stETH, a nominal 5% liquidation premium becomes approximately 26% in underlying-value terms. The liquidator receives the excess from the borrower.  
+**Proof of Concept**: At a $1,900 stETH price, a $1,050 seizure transfers about 0.5526 wstETH. At 1.20 stETH per wstETH, that collateral is actually worth about $1,260.  
+**Recommendation**: Use a maintained wstETH/USD feed or compose stETH/USD with the canonical `stEthPerToken()` conversion. Validate freshness and units at both legs. Require equivalent asset-specific adapters for weETH and ezETH.
+
+## [H-04] Stale or incomplete Chainlink rounds are accepted indefinitely
+**Severity**: High  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Deprecated `latestAnswer()` exposes no timestamp or round metadata. After a feed stops updating, borrowers can take too much USDC against a fallen collateral price, leaving treasury bad debt, or liquidators can seize collateral using an obsolete adverse price.  
+**Proof of Concept**: If wstETH falls while its feed remains at the old high value, deposit/retain collateral and borrow against the stale value before updates resume.  
+**Recommendation**: Use `latestRoundData()` and require positive answers, nonzero timestamps, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Configure maximum age per feed and define a safe pause/fallback response.
+
+## [H-05] Withdrawals check debt before realizing accrued interest
+**Severity**: High  
+**Category**: Lending accounting  
+**Location**: `CollateralVault.withdraw()` and `LendingMarket.requireHealthy()` (`src/CollateralVault.sol:44`, `src/LendingMarket.sol:153`)  
+**Description**: Withdrawal calls a view-only health check without first calling `accrueInterest()`. After inactivity, a borrower can withdraw collateral based on the old index; the next accrual makes the remaining position undercollateralized. The user receives collateral that should secure the debt, while the treasury can be left with bad debt.  
+**Proof of Concept**: Borrow at the maximum permitted boundary, wait without any market state-changing call, then withdraw collateral while `borrowIndex` is stale. Call `accrueInterest()` afterward; the updated debt exceeds the remaining collateral limit.  
+**Recommendation**: Route withdrawals through the market or expose an authenticated market hook that accrues before the vault changes balances. Check health using a preview index that includes elapsed interest, and test long idle periods.
+
+## [H-06] A displayed full repayment can leave permanent debt dust and lock collateral
+**Severity**: High  
+**Category**: Precision / debt accounting  
+**Location**: `LendingMarket.repay()` and `debtOf()` (`src/LendingMarket.sol:128`, `src/LendingMarket.sol:170`)  
+**Description**: Debt and repayment conversions both round down. Paying the full displayed debt can leave one scaled-principal unit. Once `amount * WAD / borrowIndex` rounds to zero, further payments transfer USDC but reduce no principal, and the amount cap prevents overpayment. The borrower loses every attempted payment and cannot withdraw all collateral.  
+**Proof of Concept**: With principal `1,000,000` and index `1.0000001e18`, displayed debt is `1,000,000`; repayment subtracts only `999,999`, leaving principal `1`. Paying the remaining displayed unit subtracts zero forever.  
+**Recommendation**: If `amount >= debt`, collect exactly `debt` and set principal to zero. For partial repayments, compute the principal reduction first with documented rounding and reject a positive payment that reduces zero principal.
+
+## [H-07] Reusable borrow signatures can force a signer into repeated debt and liquidation
+**Severity**: High  
+**Category**: Signatures  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)  
+**Description**: The signed message has no nonce or deadline and is never consumed. Anyone observing one signature can replay it until the account reaches its borrowing limit, and can replay it again after repayment. Funds go to the signer, but an unaware signer can be pushed to the liquidation boundary; the replayer can later liquidate and receive the 5% collateral bonus.  
+**Proof of Concept**: Submit the same `(borrower, amount, v, r, s)` repeatedly. Every digest is identical and accepted. After the borrower repays, submit it again.  
+**Recommendation**: Sign and validate a per-borrower nonce, deadline, receiver/intended relayer, and amount; increment the nonce before borrowing. Use a standard EIP-712/ECDSA implementation that enforces low-`s` and valid `v`.
+
+## [H-08] Non-atomic proxy initialization permits deployment takeover
+**Severity**: High  
+**Category**: Proxy / deployment  
+**Location**: `MarketProxy.constructor()` and `LendingMarket.initialize()` (`src/MarketProxy.sol:10`, `src/LendingMarket.sol:56`)  
+**Description**: The proxy allows empty `initData`, and anyone may call `initialize()` once. If initialization is deferred, a mempool observer selects the owner, oracle, vault, and debt token. The legitimate initializer is permanently locked out and any later funding is exposed. No deployment script demonstrates atomic initialization.  
+**Proof of Concept**: Deploy the proxy with empty init data; before the deployer initializes, call `initialize(attacker, attackerOracle, attackerVault, token)`.  
+**Recommendation**: Require nonempty init data and atomically initialize in the proxy constructor. Validate all addresses, assert state before funding, and disable initializers on the standalone implementation.
+
+## [M-01] Arbitrum sequencer recovery is not checked
+**Severity**: Medium  
+**Category**: Oracle / Arbitrum  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: The oracle does not consult the Arbitrum sequencer uptime feed. Immediately after recovery, asset feeds may not yet be current. A borrower can receive excess USDC or a liquidator can receive collateral based on pre-outage prices.  
+**Proof of Concept**: Submit a borrow or liquidation immediately after sequencer recovery while the relevant asset round still predates the outage.  
+**Recommendation**: Validate the Arbitrum sequencer uptime feed and enforce a recovery grace period (commonly one hour) before using prices, in addition to per-feed freshness checks.
+
+## [M-02] Invalid oracle answers can bypass health checks or halt liquidation
+**Severity**: Medium  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Zero and negative answers are not rejected. A zero USDC price makes debt value zero and the health factor maximal, allowing treasury USDC to be borrowed with inadequate backing. A zero collateral price makes liquidation divide by zero; a negative answer casts to a huge unsigned integer and generally reverts downstream. Users or the treasury lose funds if an invalid answer is consumed; otherwise risk-reducing actions are blocked.  
+**Proof of Concept**: Return zero for USDC/USD and borrow while `debtValueUsd()` is zero, or return zero for collateral and observe `_liquidate()` revert at division by `price`.  
+**Recommendation**: Require `answer > 0`, valid round metadata, and reject/circuit-break implausible or aggregator-bound values. Pause new risk while preserving repayment and recovery paths.
+
+## [M-03] Nominal and unchecked token transfers can create unbacked collateral
+**Severity**: Medium  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()`, `withdraw()`, `seize()`; `LendingMarket.repay()`, `_borrow()`, `_liquidate()`  
+**Description**: Return values from every transfer are ignored, and deposits credit the requested amount rather than the received balance delta. The launch assets normally revert or return true, but a future fee-on-transfer or false-returning listed token lets an attacker receive inflated collateral credit and borrow real USDC. False-returning debt transfers can also cancel debt without payment after a future debt-asset change.  
+**Proof of Concept**: List a token whose `transferFrom` returns false or transfers 90%. Calling `deposit(100)` records 100 although the vault receives zero or 90; the caller borrows against the fictitious difference.  
+**Recommendation**: Use safe-transfer helpers. Credit the observed balance delta and, unless explicitly supported by an adapter, require it to equal the requested amount.
+
+## [M-04] Transfer-before-effects permits reentrant withdrawals for callback-capable collateral
+**Severity**: Medium  
+**Category**: Reentrancy / future listings  
+**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)  
+**Description**: The vault transfers before decrementing `balanceOf`. A callback-capable future token can reenter and make nested withdrawals observe the same old balance, withdrawing more assets than are charged and potentially leaving fictitious collateral for a USDC borrow. Launch wstETH does not expose such transfer callbacks, so this becomes exploitable when an unsafe token is listed.  
+**Proof of Concept**: Deposit a listed callback token, call `withdraw(X)`, and reenter `withdraw(X)` during its transfer hook. Both frames read the original balance and transfer `X`.  
+**Recommendation**: Apply checks-effects-interactions, decrement before the external call, and add a reentrancy guard. Explicitly prohibit callback tokens unless an adapter has been reviewed.
+
+## [M-05] The borrower array can permanently disable batch liquidation
+**Severity**: Medium  
+**Category**: Denial of service  
+**Location**: `LendingMarket._borrow()` and `liquidateAll()` (`src/LendingMarket.sol:190`, `src/LendingMarket.sol:197`)  
+**Description**: `borrow(0)` appends the caller whenever principal is zero; entries are never removed or deduplicated. An attacker spends gas but no assets to grow the array until `liquidateAll()` cannot fit in a block. During a price shock, keepers lose the documented sweep function and bad debt risk rises, although individual liquidation remains available.  
+**Proof of Concept**: Repeatedly call `borrow(0)`, then call `liquidateAll()` after enough entries exist; it runs out of gas.  
+**Recommendation**: Reject zero/dust borrowing, maintain unique membership, remove closed accounts, and replace the unbounded sweep with cursor-based bounded batches or off-chain discovery.
+
+## [M-06] Deeply underwater debt has no economically viable liquidation path
+**Severity**: Medium  
+**Category**: Liquidation design  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)  
+**Description**: A liquidator must pay 100% of debt before receiving at most the remaining collateral. If collateral value falls below debt, liquidation guarantees a loss, so rational liquidators leave the position open and the treasury retains bad debt. Large positions also require unnecessary up-front capital.  
+**Proof of Concept**: For $1,000 debt backed by collateral now worth $700, liquidation takes $1,000 USDC and can return only $700 of collateral.  
+**Recommendation**: Support caller-selected partial liquidation and minimum collateral output, cap seizure to available collateral, explicitly recognize residual bad debt, and define a reserve/insurance loss mechanism.
+
+## [M-07] Upgrades can accidentally and irreversibly brick the proxy
+**Severity**: Medium  
+**Category**: Proxy safety  
+**Location**: `LendingMarket.upgradeTo()` and `MarketProxy.fallback()` (`src/LendingMarket.sol:84`, `src/MarketProxy.sol:26`)  
+**Description**: No check rejects zero, an EOA, or an incompatible implementation. Because upgrade logic lives only in the implementation, one bad authorized upgrade can remove the only upgrade path and permanently strand positions and treasury USDC.  
+**Proof of Concept**: Upgrade to an EOA. Subsequent delegatecalls return empty data, and that address exposes no function that can restore the implementation.  
+**Recommendation**: Validate code and UUPS UUID, use a standard proxy design, run storage-layout and fork upgrade tests, and retain a deliberately governed recovery process.
+
+## [L-01] Debt shares are rounded down when borrowing
+**Severity**: Low  
+**Category**: Precision  
+**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`)  
+**Description**: `amount * WAD / borrowIndex` rounds debt shares down while transferring the full amount. Once the index exceeds WAD, a one-base-unit borrow records zero debt and passes without collateral. Repetition undercharges debt, but for six-decimal USDC the extractable amount per call is below one micro-USDC and is not economically profitable at normal gas costs.  
+**Proof of Concept**: After interest accrues, call `borrow(1)` with no collateral; the principal increment is zero while one base unit transfers.  
+**Recommendation**: Round debt shares up on borrowing and require a nonzero share delta and a sensible minimum borrow.
+
+## [L-02] Interest uses an imprecise Arbitrum block-to-time conversion
+**Severity**: Low  
+**Category**: Arbitrum / accounting  
+**Location**: `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:117`)  
+**Description**: Arbitrum's Solidity `block.number` approximates the L1 block number and advances in steps; multiplying it by a fixed 12 seconds is not reliable elapsed wall time. Borrowers or the treasury receive slightly incorrect interest, and accrual can jump after periods where the reported number does not advance.  
+**Proof of Concept**: Compare `blocksElapsed * 12` with `block.timestamp - lastAccrualTimestamp` across Arbitrum blocks; the values can differ and update at different cadence.  
+**Recommendation**: Store a timestamp and accrue from `block.timestamp - lastAccrualTimestamp`, with a reasonable maximum interval and tests for sequencer outages.
+
+## [L-03] Liquidation discards value lost to token-unit rounding
+**Severity**: Low  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:224`)  
+**Description**: Collateral units round down, but `seizeUsd` is reduced by the full unrounded value. The liquidator can receive slightly less than paid for; for a future low-decimal, high-price token, a nontrivial requested seizure can round to zero.  
+**Proof of Concept**: If `takeUsd * unit < price`, the seized token amount is zero although `takeUsd` is fully subtracted.  
+**Recommendation**: Reduce remaining seizure value by the actual value transferred, or round units up subject to the user's balance and a documented policy.
+
+## [L-04] Feed and token decimal assumptions can freeze an asset
+**Severity**: Low  
+**Category**: Configuration validation  
+**Location**: `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `_liquidate()`  
+**Description**: A feed with more than 18 decimals underflows `18 - decimals`; a token with sufficiently large decimals overflows `10 ** decimals`. Price-dependent borrow, withdrawal, and liquidation then revert, potentially trapping users after a bad future listing.  
+**Proof of Concept**: Configure a feed reporting 19 decimals or list a token reporting 78 decimals and call the relevant valuation function.  
+**Recommendation**: Validate and cache code presence and decimal ranges before listing. Normalize multiplication and division in both directions with full-precision math and provide a safe delisting/migration path.
+
+## Planned-collateral constraints
+
+- The current fixed-balance vault is unsafe for rebasing tokens: a negative rebase leaves fictitious balances and bad-debt capacity, while a positive rebase becomes unallocated. Use non-rebasing wrappers or share-based adapters.
+- weETH and ezETH require wrapper-specific exchange-rate and market-price handling; do not map either 1:1 to ETH/USD.
+- USDT and USDC can be paused or blocklisted. Define an emergency mode that stops new borrowing, handles interest fairly, and provides a post-recovery repayment grace period. Consider isolated markets so one frozen custody address does not affect unrelated assets.
+
+These are listing gates rather than separate launch findings because only wstETH collateral and USDC debt are currently intended to be enabled.
+
+## Verification priorities
+
+Before deployment, add unit, fuzz, invariant, and Arbitrum-fork tests covering:
+
+- only authorized upgrades and configuration; atomic initialization; incompatible upgrade rejection;
+- debt conservation across every borrow/repay sequence and exact full closure;
+- health-factor boundaries and withdrawal after long idle periods;
+- wstETH conversion, stale/invalid rounds, sequencer outage and recovery;
+- liquidation solvency, rounding, partial liquidation, slippage, and bad-debt handling;
+- zero values, unusual token behavior, callbacks, pauses, and all planned asset adapters.

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..66627d77d88afa76bc10573ba7dd2b9d0f5f0042
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,208 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-03  
+**Scope:** `README.md`, `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Target:** Arbitrum One; native USDC debt; wstETH launch collateral  
+**Result:** **Do not deploy in the current state.**
+
+## Executive summary
+
+The review found **2 Critical, 8 High, 7 Medium, and 4 Low** issues. The two Critical issues independently let any caller take control of pricing or implementation logic and steal the treasury-funded USDC and deposited collateral. The public liquidation-threshold setter is another immediate launch blocker. Even after access control is repaired, the health-factor formula incorrectly liquidates solvent borrowers, the proposed wstETH feed values the wrong unit, and stale oracle data is accepted.
+
+Fix order for Monday:
+
+1. Lock down upgrades, oracle replacement, and risk parameters; require atomic initialization.
+2. Correct health, wstETH pricing, oracle validation, interest realization on withdrawal, and full-repayment rounding.
+3. Add adversarial tests for borrowing, repayment, withdrawal, liquidation, oracle outages, and upgrades before funding the proxy.
+4. Address the Medium issues before launch. Do not list weETH, ezETH, USDT, fee-on-transfer, callback-capable, or rebasing assets until asset-specific adapters and accounting are implemented.
+
+This was a source review plus successful `forge build`; the repository has no test suite. No deployment scripts were present, so initialization safety and on-chain configuration could not be verified.
+
+## Findings
+
+## [C-01] Anyone can replace the implementation and drain the market and vault
+**Severity**: Critical  
+**Category**: Access control / proxy  
+**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)  
+**Description**: `upgradeTo()` has no authorization and writes an arbitrary address to the ERC-1967 implementation slot. Malicious logic then executes in the proxy context. Because the proxy holds seeded USDC and is the immutable `market` trusted by `CollateralVault`, the replacement can transfer all USDC and call `vault.seize()` for every depositor. The attacker receives all funded liquidity and deposited collateral.  
+**Proof of Concept**: Deploy logic with a drain function, call `upgradeTo(malicious)` through the proxy, then call the drain through the proxy. The new logic can transfer the proxy's USDC and invoke the vault as its trusted market.  
+**Recommendation**: Use a reviewed UUPS or transparent proxy implementation. Restrict upgrades to a timelocked multisig, validate code and `proxiableUUID`, and test storage compatibility and rollback/recovery procedures.
+
+## [C-02] Anyone can replace the oracle and steal all seeded USDC
+**Severity**: Critical  
+**Category**: Access control / oracle  
+**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)  
+**Description**: `setOracle()` has no `onlyOwner`. An attacker can report an enormous collateral price and a tiny positive USDC price, borrow the complete USDC balance against dust, and leave unrecoverable debt. The same control can fabricate unhealthy positions and extract users' collateral as liquidator.  
+**Proof of Concept**: Deposit dust wstETH, install an attacker oracle, return a huge wstETH price and small USDC price, then borrow the proxy's entire USDC balance.  
+**Recommendation**: Add access control, validate that the new oracle is a contract supporting every active asset, and place oracle changes behind a timelock/multisig with a pause and two-step activation process.
+
+## [H-01] Anyone can force liquidations by changing the liquidation threshold
+**Severity**: High  
+**Category**: Access control / risk parameters  
+**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)  
+**Description**: Any caller can set the threshold to any value. Setting it to zero makes every debtor unhealthy. The caller can then repay selected debts and receive borrowers' collateral plus the 5% bonus; unlucky borrowers lose the bonus and their positions are forcibly closed. Unbounded high values also allow governance parameters to be bypassed and can cause arithmetic reverts.  
+**Proof of Concept**: Call `setLiquidationThreshold(0)`, then call `liquidate(user)` for an otherwise healthy borrower after approving USDC.  
+**Recommendation**: Add `onlyOwner`, require `0 < bps && bps <= BPS`, use a timelocked risk role, and pause borrowing around material parameter changes.
+
+## [H-02] Division before multiplication makes solvent positions liquidatable
+**Severity**: High  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:146`)  
+**Description**: `collateralValueUsd / debtUsd` truncates before applying WAD precision. At the configured 80% threshold, every collateral ratio from 100% to just under 200% produces a health factor of `0.8e18`. A borrower with $1,500 collateral and $1,000 debt should have a 1.2 health factor but is liquidatable. A liquidator receives $1,050 of collateral; the solvent borrower loses $50 and is forcibly closed.  
+**Proof of Concept**: For `$1,500e18 / $1,000e18`, the contract first obtains `1`, then returns `1 * 8000 * 1e18 / 10000 = 0.8e18`.  
+**Recommendation**: Use full-precision multiplication before division, e.g. `mulDiv(collateralUsd, liquidationThreshold * WAD, debtUsd * BPS)`, with explicit rounding. Test immediately below, at, and above 125% collateralization.
+
+## [H-03] The stETH/USD feed prices wstETH as if it were one stETH
+**Severity**: High  
+**Category**: Oracle / asset integration  
+**Location**: launch configuration in `README.md`; `LendingMarket.collateralValueUsd()` and `_liquidate()` (`src/LendingMarket.sol:132`, `src/LendingMarket.sol:209`)  
+**Description**: One wstETH represents a changing amount greater than one stETH. Applying the stETH/USD feed directly to raw wstETH units undervalues collateral and transfers too many wstETH during liquidation. If one wstETH represents 1.20 stETH, a nominal 5% liquidation premium becomes approximately 26% in underlying-value terms. The liquidator receives the excess from the borrower.  
+**Proof of Concept**: At a $1,900 stETH price, a $1,050 seizure transfers about 0.5526 wstETH. At 1.20 stETH per wstETH, that collateral is actually worth about $1,260.  
+**Recommendation**: Use a maintained wstETH/USD feed or compose stETH/USD with the canonical `stEthPerToken()` conversion. Validate freshness and units at both legs. Require equivalent asset-specific adapters for weETH and ezETH.
+
+## [H-04] Stale or incomplete Chainlink rounds are accepted indefinitely
+**Severity**: High  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Deprecated `latestAnswer()` exposes no timestamp or round metadata. After a feed stops updating, borrowers can take too much USDC against a fallen collateral price, leaving treasury bad debt, or liquidators can seize collateral using an obsolete adverse price.  
+**Proof of Concept**: If wstETH falls while its feed remains at the old high value, deposit/retain collateral and borrow against the stale value before updates resume.  
+**Recommendation**: Use `latestRoundData()` and require positive answers, nonzero timestamps, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Configure maximum age per feed and define a safe pause/fallback response.
+
+## [H-05] Withdrawals check debt before realizing accrued interest
+**Severity**: High  
+**Category**: Lending accounting  
+**Location**: `CollateralVault.withdraw()` and `LendingMarket.requireHealthy()` (`src/CollateralVault.sol:44`, `src/LendingMarket.sol:153`)  
+**Description**: Withdrawal calls a view-only health check without first calling `accrueInterest()`. After inactivity, a borrower can withdraw collateral based on the old index; the next accrual makes the remaining position undercollateralized. The user receives collateral that should secure the debt, while the treasury can be left with bad debt.  
+**Proof of Concept**: Borrow at the maximum permitted boundary, wait without any market state-changing call, then withdraw collateral while `borrowIndex` is stale. Call `accrueInterest()` afterward; the updated debt exceeds the remaining collateral limit.  
+**Recommendation**: Route withdrawals through the market or expose an authenticated market hook that accrues before the vault changes balances. Check health using a preview index that includes elapsed interest, and test long idle periods.
+
+## [H-06] A displayed full repayment can leave permanent debt dust and lock collateral
+**Severity**: High  
+**Category**: Precision / debt accounting  
+**Location**: `LendingMarket.repay()` and `debtOf()` (`src/LendingMarket.sol:128`, `src/LendingMarket.sol:170`)  
+**Description**: Debt and repayment conversions both round down. Paying the full displayed debt can leave one scaled-principal unit. Once `amount * WAD / borrowIndex` rounds to zero, further payments transfer USDC but reduce no principal, and the amount cap prevents overpayment. The borrower loses every attempted payment and cannot withdraw all collateral.  
+**Proof of Concept**: With principal `1,000,000` and index `1.0000001e18`, displayed debt is `1,000,000`; repayment subtracts only `999,999`, leaving principal `1`. Paying the remaining displayed unit subtracts zero forever.  
+**Recommendation**: If `amount >= debt`, collect exactly `debt` and set principal to zero. For partial repayments, compute the principal reduction first with documented rounding and reject a positive payment that reduces zero principal.
+
+## [H-07] Reusable borrow signatures can force a signer into repeated debt and liquidation
+**Severity**: High  
+**Category**: Signatures  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)  
+**Description**: The signed message has no nonce or deadline and is never consumed. Anyone observing one signature can replay it until the account reaches its borrowing limit, and can replay it again after repayment. Funds go to the signer, but an unaware signer can be pushed to the liquidation boundary; the replayer can later liquidate and receive the 5% collateral bonus.  
+**Proof of Concept**: Submit the same `(borrower, amount, v, r, s)` repeatedly. Every digest is identical and accepted. After the borrower repays, submit it again.  
+**Recommendation**: Sign and validate a per-borrower nonce, deadline, receiver/intended relayer, and amount; increment the nonce before borrowing. Use a standard EIP-712/ECDSA implementation that enforces low-`s` and valid `v`.
+
+## [H-08] Non-atomic proxy initialization permits deployment takeover
+**Severity**: High  
+**Category**: Proxy / deployment  
+**Location**: `MarketProxy.constructor()` and `LendingMarket.initialize()` (`src/MarketProxy.sol:10`, `src/LendingMarket.sol:56`)  
+**Description**: The proxy allows empty `initData`, and anyone may call `initialize()` once. If initialization is deferred, a mempool observer selects the owner, oracle, vault, and debt token. The legitimate initializer is permanently locked out and any later funding is exposed. No deployment script demonstrates atomic initialization.  
+**Proof of Concept**: Deploy the proxy with empty init data; before the deployer initializes, call `initialize(attacker, attackerOracle, attackerVault, token)`.  
+**Recommendation**: Require nonempty init data and atomically initialize in the proxy constructor. Validate all addresses, assert state before funding, and disable initializers on the standalone implementation.
+
+## [M-01] Arbitrum sequencer recovery is not checked
+**Severity**: Medium  
+**Category**: Oracle / Arbitrum  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: The oracle does not consult the Arbitrum sequencer uptime feed. Immediately after recovery, asset feeds may not yet be current. A borrower can receive excess USDC or a liquidator can receive collateral based on pre-outage prices.  
+**Proof of Concept**: Submit a borrow or liquidation immediately after sequencer recovery while the relevant asset round still predates the outage.  
+**Recommendation**: Validate the Arbitrum sequencer uptime feed and enforce a recovery grace period (commonly one hour) before using prices, in addition to per-feed freshness checks.
+
+## [M-02] Invalid oracle answers can bypass health checks or halt liquidation
+**Severity**: Medium  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Zero and negative answers are not rejected. A zero USDC price makes debt value zero and the health factor maximal, allowing treasury USDC to be borrowed with inadequate backing. A zero collateral price makes liquidation divide by zero; a negative answer casts to a huge unsigned integer and generally reverts downstream. Users or the treasury lose funds if an invalid answer is consumed; otherwise risk-reducing actions are blocked.  
+**Proof of Concept**: Return zero for USDC/USD and borrow while `debtValueUsd()` is zero, or return zero for collateral and observe `_liquidate()` revert at division by `price`.  
+**Recommendation**: Require `answer > 0`, valid round metadata, and reject/circuit-break implausible or aggregator-bound values. Pause new risk while preserving repayment and recovery paths.
+
+## [M-03] Nominal and unchecked token transfers can create unbacked collateral
+**Severity**: Medium  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()`, `withdraw()`, `seize()`; `LendingMarket.repay()`, `_borrow()`, `_liquidate()`  
+**Description**: Return values from every transfer are ignored, and deposits credit the requested amount rather than the received balance delta. The launch assets normally revert or return true, but a future fee-on-transfer or false-returning listed token lets an attacker receive inflated collateral credit and borrow real USDC. False-returning debt transfers can also cancel debt without payment after a future debt-asset change.  
+**Proof of Concept**: List a token whose `transferFrom` returns false or transfers 90%. Calling `deposit(100)` records 100 although the vault receives zero or 90; the caller borrows against the fictitious difference.  
+**Recommendation**: Use safe-transfer helpers. Credit the observed balance delta and, unless explicitly supported by an adapter, require it to equal the requested amount.
+
+## [M-04] Transfer-before-effects permits reentrant withdrawals for callback-capable collateral
+**Severity**: Medium  
+**Category**: Reentrancy / future listings  
+**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)  
+**Description**: The vault transfers before decrementing `balanceOf`. A callback-capable future token can reenter and make nested withdrawals observe the same old balance, withdrawing more assets than are charged and potentially leaving fictitious collateral for a USDC borrow. Launch wstETH does not expose such transfer callbacks, so this becomes exploitable when an unsafe token is listed.  
+**Proof of Concept**: Deposit a listed callback token, call `withdraw(X)`, and reenter `withdraw(X)` during its transfer hook. Both frames read the original balance and transfer `X`.  
+**Recommendation**: Apply checks-effects-interactions, decrement before the external call, and add a reentrancy guard. Explicitly prohibit callback tokens unless an adapter has been reviewed.
+
+## [M-05] The borrower array can permanently disable batch liquidation
+**Severity**: Medium  
+**Category**: Denial of service  
+**Location**: `LendingMarket._borrow()` and `liquidateAll()` (`src/LendingMarket.sol:190`, `src/LendingMarket.sol:197`)  
+**Description**: `borrow(0)` appends the caller whenever principal is zero; entries are never removed or deduplicated. An attacker spends gas but no assets to grow the array until `liquidateAll()` cannot fit in a block. During a price shock, keepers lose the documented sweep function and bad debt risk rises, although individual liquidation remains available.  
+**Proof of Concept**: Repeatedly call `borrow(0)`, then call `liquidateAll()` after enough entries exist; it runs out of gas.  
+**Recommendation**: Reject zero/dust borrowing, maintain unique membership, remove closed accounts, and replace the unbounded sweep with cursor-based bounded batches or off-chain discovery.
+
+## [M-06] Deeply underwater debt has no economically viable liquidation path
+**Severity**: Medium  
+**Category**: Liquidation design  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)  
+**Description**: A liquidator must pay 100% of debt before receiving at most the remaining collateral. If collateral value falls below debt, liquidation guarantees a loss, so rational liquidators leave the position open and the treasury retains bad debt. Large positions also require unnecessary up-front capital.  
+**Proof of Concept**: For $1,000 debt backed by collateral now worth $700, liquidation takes $1,000 USDC and can return only $700 of collateral.  
+**Recommendation**: Support caller-selected partial liquidation and minimum collateral output, cap seizure to available collateral, explicitly recognize residual bad debt, and define a reserve/insurance loss mechanism.
+
+## [M-07] Upgrades can accidentally and irreversibly brick the proxy
+**Severity**: Medium  
+**Category**: Proxy safety  
+**Location**: `LendingMarket.upgradeTo()` and `MarketProxy.fallback()` (`src/LendingMarket.sol:84`, `src/MarketProxy.sol:26`)  
+**Description**: No check rejects zero, an EOA, or an incompatible implementation. Because upgrade logic lives only in the implementation, one bad authorized upgrade can remove the only upgrade path and permanently strand positions and treasury USDC.  
+**Proof of Concept**: Upgrade to an EOA. Subsequent delegatecalls return empty data, and that address exposes no function that can restore the implementation.  
+**Recommendation**: Validate code and UUPS UUID, use a standard proxy design, run storage-layout and fork upgrade tests, and retain a deliberately governed recovery process.
+
+## [L-01] Debt shares are rounded down when borrowing
+**Severity**: Low  
+**Category**: Precision  
+**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`)  
+**Description**: `amount * WAD / borrowIndex` rounds debt shares down while transferring the full amount. Once the index exceeds WAD, a one-base-unit borrow records zero debt and passes without collateral. Repetition undercharges debt, but for six-decimal USDC the extractable amount per call is below one micro-USDC and is not economically profitable at normal gas costs.  
+**Proof of Concept**: After interest accrues, call `borrow(1)` with no collateral; the principal increment is zero while one base unit transfers.  
+**Recommendation**: Round debt shares up on borrowing and require a nonzero share delta and a sensible minimum borrow.
+
+## [L-02] Interest uses an imprecise Arbitrum block-to-time conversion
+**Severity**: Low  
+**Category**: Arbitrum / accounting  
+**Location**: `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:117`)  
+**Description**: Arbitrum's Solidity `block.number` approximates the L1 block number and advances in steps; multiplying it by a fixed 12 seconds is not reliable elapsed wall time. Borrowers or the treasury receive slightly incorrect interest, and accrual can jump after periods where the reported number does not advance.  
+**Proof of Concept**: Compare `blocksElapsed * 12` with `block.timestamp - lastAccrualTimestamp` across Arbitrum blocks; the values can differ and update at different cadence.  
+**Recommendation**: Store a timestamp and accrue from `block.timestamp - lastAccrualTimestamp`, with a reasonable maximum interval and tests for sequencer outages.
+
+## [L-03] Liquidation discards value lost to token-unit rounding
+**Severity**: Low  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:224`)  
+**Description**: Collateral units round down, but `seizeUsd` is reduced by the full unrounded value. The liquidator can receive slightly less than paid for; for a future low-decimal, high-price token, a nontrivial requested seizure can round to zero.  
+**Proof of Concept**: If `takeUsd * unit < price`, the seized token amount is zero although `takeUsd` is fully subtracted.  
+**Recommendation**: Reduce remaining seizure value by the actual value transferred, or round units up subject to the user's balance and a documented policy.
+
+## [L-04] Feed and token decimal assumptions can freeze an asset
+**Severity**: Low  
+**Category**: Configuration validation  
+**Location**: `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `_liquidate()`  
+**Description**: A feed with more than 18 decimals underflows `18 - decimals`; a token with sufficiently large decimals overflows `10 ** decimals`. Price-dependent borrow, withdrawal, and liquidation then revert, potentially trapping users after a bad future listing.  
+**Proof of Concept**: Configure a feed reporting 19 decimals or list a token reporting 78 decimals and call the relevant valuation function.  
+**Recommendation**: Validate and cache code presence and decimal ranges before listing. Normalize multiplication and division in both directions with full-precision math and provide a safe delisting/migration path.
+
+## Planned-collateral constraints
+
+- The current fixed-balance vault is unsafe for rebasing tokens: a negative rebase leaves fictitious balances and bad-debt capacity, while a positive rebase becomes unallocated. Use non-rebasing wrappers or share-based adapters.
+- weETH and ezETH require wrapper-specific exchange-rate and market-price handling; do not map either 1:1 to ETH/USD.
+- USDT and USDC can be paused or blocklisted. Define an emergency mode that stops new borrowing, handles interest fairly, and provides a post-recovery repayment grace period. Consider isolated markets so one frozen custody address does not affect unrelated assets.
+
+These are listing gates rather than separate launch findings because only wstETH collateral and USDC debt are currently intended to be enabled.
+
+## Verification priorities
+
+Before deployment, add unit, fuzz, invariant, and Arbitrum-fork tests covering:
+
+- only authorized upgrades and configuration; atomic initialization; incompatible upgrade rejection;
+- debt conservation across every borrow/repay sequence and exact full closure;
+- health-factor boundaries and withdrawal after long idle periods;
+- wstETH conversion, stale/invalid rounds, sequencer outage and recovery;
+- liquidation solvency, rounding, partial liquidation, slippage, and bad-debt handling;
+- zero values, unusual token behavior, callbacks, pauses, and all planned asset adapters.

exec
/bin/bash -lc 'git status --short --untracked-files=all && ls findings-*.md 2>/dev/null || true' in /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
?? AUDIT-REPORT.md
?? findings-chain.md
?? findings-erc20.md
?? findings-general.md
?? findings-lending.md
?? findings-oracles.md
?? findings-precision.md
?? findings-proxies.md
?? findings-signatures.md
findings-chain.md
findings-erc20.md
findings-general.md
findings-lending.md
findings-oracles.md
findings-precision.md
findings-proxies.md
findings-signatures.md

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..66627d77d88afa76bc10573ba7dd2b9d0f5f0042
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,208 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-03  
+**Scope:** `README.md`, `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Target:** Arbitrum One; native USDC debt; wstETH launch collateral  
+**Result:** **Do not deploy in the current state.**
+
+## Executive summary
+
+The review found **2 Critical, 8 High, 7 Medium, and 4 Low** issues. The two Critical issues independently let any caller take control of pricing or implementation logic and steal the treasury-funded USDC and deposited collateral. The public liquidation-threshold setter is another immediate launch blocker. Even after access control is repaired, the health-factor formula incorrectly liquidates solvent borrowers, the proposed wstETH feed values the wrong unit, and stale oracle data is accepted.
+
+Fix order for Monday:
+
+1. Lock down upgrades, oracle replacement, and risk parameters; require atomic initialization.
+2. Correct health, wstETH pricing, oracle validation, interest realization on withdrawal, and full-repayment rounding.
+3. Add adversarial tests for borrowing, repayment, withdrawal, liquidation, oracle outages, and upgrades before funding the proxy.
+4. Address the Medium issues before launch. Do not list weETH, ezETH, USDT, fee-on-transfer, callback-capable, or rebasing assets until asset-specific adapters and accounting are implemented.
+
+This was a source review plus successful `forge build`; the repository has no test suite. No deployment scripts were present, so initialization safety and on-chain configuration could not be verified.
+
+## Findings
+
+## [C-01] Anyone can replace the implementation and drain the market and vault
+**Severity**: Critical  
+**Category**: Access control / proxy  
+**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)  
+**Description**: `upgradeTo()` has no authorization and writes an arbitrary address to the ERC-1967 implementation slot. Malicious logic then executes in the proxy context. Because the proxy holds seeded USDC and is the immutable `market` trusted by `CollateralVault`, the replacement can transfer all USDC and call `vault.seize()` for every depositor. The attacker receives all funded liquidity and deposited collateral.  
+**Proof of Concept**: Deploy logic with a drain function, call `upgradeTo(malicious)` through the proxy, then call the drain through the proxy. The new logic can transfer the proxy's USDC and invoke the vault as its trusted market.  
+**Recommendation**: Use a reviewed UUPS or transparent proxy implementation. Restrict upgrades to a timelocked multisig, validate code and `proxiableUUID`, and test storage compatibility and rollback/recovery procedures.
+
+## [C-02] Anyone can replace the oracle and steal all seeded USDC
+**Severity**: Critical  
+**Category**: Access control / oracle  
+**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)  
+**Description**: `setOracle()` has no `onlyOwner`. An attacker can report an enormous collateral price and a tiny positive USDC price, borrow the complete USDC balance against dust, and leave unrecoverable debt. The same control can fabricate unhealthy positions and extract users' collateral as liquidator.  
+**Proof of Concept**: Deposit dust wstETH, install an attacker oracle, return a huge wstETH price and small USDC price, then borrow the proxy's entire USDC balance.  
+**Recommendation**: Add access control, validate that the new oracle is a contract supporting every active asset, and place oracle changes behind a timelock/multisig with a pause and two-step activation process.
+
+## [H-01] Anyone can force liquidations by changing the liquidation threshold
+**Severity**: High  
+**Category**: Access control / risk parameters  
+**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)  
+**Description**: Any caller can set the threshold to any value. Setting it to zero makes every debtor unhealthy. The caller can then repay selected debts and receive borrowers' collateral plus the 5% bonus; unlucky borrowers lose the bonus and their positions are forcibly closed. Unbounded high values also allow governance parameters to be bypassed and can cause arithmetic reverts.  
+**Proof of Concept**: Call `setLiquidationThreshold(0)`, then call `liquidate(user)` for an otherwise healthy borrower after approving USDC.  
+**Recommendation**: Add `onlyOwner`, require `0 < bps && bps <= BPS`, use a timelocked risk role, and pause borrowing around material parameter changes.
+
+## [H-02] Division before multiplication makes solvent positions liquidatable
+**Severity**: High  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:146`)  
+**Description**: `collateralValueUsd / debtUsd` truncates before applying WAD precision. At the configured 80% threshold, every collateral ratio from 100% to just under 200% produces a health factor of `0.8e18`. A borrower with $1,500 collateral and $1,000 debt should have a 1.2 health factor but is liquidatable. A liquidator receives $1,050 of collateral; the solvent borrower loses $50 and is forcibly closed.  
+**Proof of Concept**: For `$1,500e18 / $1,000e18`, the contract first obtains `1`, then returns `1 * 8000 * 1e18 / 10000 = 0.8e18`.  
+**Recommendation**: Use full-precision multiplication before division, e.g. `mulDiv(collateralUsd, liquidationThreshold * WAD, debtUsd * BPS)`, with explicit rounding. Test immediately below, at, and above 125% collateralization.
+
+## [H-03] The stETH/USD feed prices wstETH as if it were one stETH
+**Severity**: High  
+**Category**: Oracle / asset integration  
+**Location**: launch configuration in `README.md`; `LendingMarket.collateralValueUsd()` and `_liquidate()` (`src/LendingMarket.sol:132`, `src/LendingMarket.sol:209`)  
+**Description**: One wstETH represents a changing amount greater than one stETH. Applying the stETH/USD feed directly to raw wstETH units undervalues collateral and transfers too many wstETH during liquidation. If one wstETH represents 1.20 stETH, a nominal 5% liquidation premium becomes approximately 26% in underlying-value terms. The liquidator receives the excess from the borrower.  
+**Proof of Concept**: At a $1,900 stETH price, a $1,050 seizure transfers about 0.5526 wstETH. At 1.20 stETH per wstETH, that collateral is actually worth about $1,260.  
+**Recommendation**: Use a maintained wstETH/USD feed or compose stETH/USD with the canonical `stEthPerToken()` conversion. Validate freshness and units at both legs. Require equivalent asset-specific adapters for weETH and ezETH.
+
+## [H-04] Stale or incomplete Chainlink rounds are accepted indefinitely
+**Severity**: High  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Deprecated `latestAnswer()` exposes no timestamp or round metadata. After a feed stops updating, borrowers can take too much USDC against a fallen collateral price, leaving treasury bad debt, or liquidators can seize collateral using an obsolete adverse price.  
+**Proof of Concept**: If wstETH falls while its feed remains at the old high value, deposit/retain collateral and borrow against the stale value before updates resume.  
+**Recommendation**: Use `latestRoundData()` and require positive answers, nonzero timestamps, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Configure maximum age per feed and define a safe pause/fallback response.
+
+## [H-05] Withdrawals check debt before realizing accrued interest
+**Severity**: High  
+**Category**: Lending accounting  
+**Location**: `CollateralVault.withdraw()` and `LendingMarket.requireHealthy()` (`src/CollateralVault.sol:44`, `src/LendingMarket.sol:153`)  
+**Description**: Withdrawal calls a view-only health check without first calling `accrueInterest()`. After inactivity, a borrower can withdraw collateral based on the old index; the next accrual makes the remaining position undercollateralized. The user receives collateral that should secure the debt, while the treasury can be left with bad debt.  
+**Proof of Concept**: Borrow at the maximum permitted boundary, wait without any market state-changing call, then withdraw collateral while `borrowIndex` is stale. Call `accrueInterest()` afterward; the updated debt exceeds the remaining collateral limit.  
+**Recommendation**: Route withdrawals through the market or expose an authenticated market hook that accrues before the vault changes balances. Check health using a preview index that includes elapsed interest, and test long idle periods.
+
+## [H-06] A displayed full repayment can leave permanent debt dust and lock collateral
+**Severity**: High  
+**Category**: Precision / debt accounting  
+**Location**: `LendingMarket.repay()` and `debtOf()` (`src/LendingMarket.sol:128`, `src/LendingMarket.sol:170`)  
+**Description**: Debt and repayment conversions both round down. Paying the full displayed debt can leave one scaled-principal unit. Once `amount * WAD / borrowIndex` rounds to zero, further payments transfer USDC but reduce no principal, and the amount cap prevents overpayment. The borrower loses every attempted payment and cannot withdraw all collateral.  
+**Proof of Concept**: With principal `1,000,000` and index `1.0000001e18`, displayed debt is `1,000,000`; repayment subtracts only `999,999`, leaving principal `1`. Paying the remaining displayed unit subtracts zero forever.  
+**Recommendation**: If `amount >= debt`, collect exactly `debt` and set principal to zero. For partial repayments, compute the principal reduction first with documented rounding and reject a positive payment that reduces zero principal.
+
+## [H-07] Reusable borrow signatures can force a signer into repeated debt and liquidation
+**Severity**: High  
+**Category**: Signatures  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)  
+**Description**: The signed message has no nonce or deadline and is never consumed. Anyone observing one signature can replay it until the account reaches its borrowing limit, and can replay it again after repayment. Funds go to the signer, but an unaware signer can be pushed to the liquidation boundary; the replayer can later liquidate and receive the 5% collateral bonus.  
+**Proof of Concept**: Submit the same `(borrower, amount, v, r, s)` repeatedly. Every digest is identical and accepted. After the borrower repays, submit it again.  
+**Recommendation**: Sign and validate a per-borrower nonce, deadline, receiver/intended relayer, and amount; increment the nonce before borrowing. Use a standard EIP-712/ECDSA implementation that enforces low-`s` and valid `v`.
+
+## [H-08] Non-atomic proxy initialization permits deployment takeover
+**Severity**: High  
+**Category**: Proxy / deployment  
+**Location**: `MarketProxy.constructor()` and `LendingMarket.initialize()` (`src/MarketProxy.sol:10`, `src/LendingMarket.sol:56`)  
+**Description**: The proxy allows empty `initData`, and anyone may call `initialize()` once. If initialization is deferred, a mempool observer selects the owner, oracle, vault, and debt token. The legitimate initializer is permanently locked out and any later funding is exposed. No deployment script demonstrates atomic initialization.  
+**Proof of Concept**: Deploy the proxy with empty init data; before the deployer initializes, call `initialize(attacker, attackerOracle, attackerVault, token)`.  
+**Recommendation**: Require nonempty init data and atomically initialize in the proxy constructor. Validate all addresses, assert state before funding, and disable initializers on the standalone implementation.
+
+## [M-01] Arbitrum sequencer recovery is not checked
+**Severity**: Medium  
+**Category**: Oracle / Arbitrum  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: The oracle does not consult the Arbitrum sequencer uptime feed. Immediately after recovery, asset feeds may not yet be current. A borrower can receive excess USDC or a liquidator can receive collateral based on pre-outage prices.  
+**Proof of Concept**: Submit a borrow or liquidation immediately after sequencer recovery while the relevant asset round still predates the outage.  
+**Recommendation**: Validate the Arbitrum sequencer uptime feed and enforce a recovery grace period (commonly one hour) before using prices, in addition to per-feed freshness checks.
+
+## [M-02] Invalid oracle answers can bypass health checks or halt liquidation
+**Severity**: Medium  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Zero and negative answers are not rejected. A zero USDC price makes debt value zero and the health factor maximal, allowing treasury USDC to be borrowed with inadequate backing. A zero collateral price makes liquidation divide by zero; a negative answer casts to a huge unsigned integer and generally reverts downstream. Users or the treasury lose funds if an invalid answer is consumed; otherwise risk-reducing actions are blocked.  
+**Proof of Concept**: Return zero for USDC/USD and borrow while `debtValueUsd()` is zero, or return zero for collateral and observe `_liquidate()` revert at division by `price`.  
+**Recommendation**: Require `answer > 0`, valid round metadata, and reject/circuit-break implausible or aggregator-bound values. Pause new risk while preserving repayment and recovery paths.
+
+## [M-03] Nominal and unchecked token transfers can create unbacked collateral
+**Severity**: Medium  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()`, `withdraw()`, `seize()`; `LendingMarket.repay()`, `_borrow()`, `_liquidate()`  
+**Description**: Return values from every transfer are ignored, and deposits credit the requested amount rather than the received balance delta. The launch assets normally revert or return true, but a future fee-on-transfer or false-returning listed token lets an attacker receive inflated collateral credit and borrow real USDC. False-returning debt transfers can also cancel debt without payment after a future debt-asset change.  
+**Proof of Concept**: List a token whose `transferFrom` returns false or transfers 90%. Calling `deposit(100)` records 100 although the vault receives zero or 90; the caller borrows against the fictitious difference.  
+**Recommendation**: Use safe-transfer helpers. Credit the observed balance delta and, unless explicitly supported by an adapter, require it to equal the requested amount.
+
+## [M-04] Transfer-before-effects permits reentrant withdrawals for callback-capable collateral
+**Severity**: Medium  
+**Category**: Reentrancy / future listings  
+**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)  
+**Description**: The vault transfers before decrementing `balanceOf`. A callback-capable future token can reenter and make nested withdrawals observe the same old balance, withdrawing more assets than are charged and potentially leaving fictitious collateral for a USDC borrow. Launch wstETH does not expose such transfer callbacks, so this becomes exploitable when an unsafe token is listed.  
+**Proof of Concept**: Deposit a listed callback token, call `withdraw(X)`, and reenter `withdraw(X)` during its transfer hook. Both frames read the original balance and transfer `X`.  
+**Recommendation**: Apply checks-effects-interactions, decrement before the external call, and add a reentrancy guard. Explicitly prohibit callback tokens unless an adapter has been reviewed.
+
+## [M-05] The borrower array can permanently disable batch liquidation
+**Severity**: Medium  
+**Category**: Denial of service  
+**Location**: `LendingMarket._borrow()` and `liquidateAll()` (`src/LendingMarket.sol:190`, `src/LendingMarket.sol:197`)  
+**Description**: `borrow(0)` appends the caller whenever principal is zero; entries are never removed or deduplicated. An attacker spends gas but no assets to grow the array until `liquidateAll()` cannot fit in a block. During a price shock, keepers lose the documented sweep function and bad debt risk rises, although individual liquidation remains available.  
+**Proof of Concept**: Repeatedly call `borrow(0)`, then call `liquidateAll()` after enough entries exist; it runs out of gas.  
+**Recommendation**: Reject zero/dust borrowing, maintain unique membership, remove closed accounts, and replace the unbounded sweep with cursor-based bounded batches or off-chain discovery.
+
+## [M-06] Deeply underwater debt has no economically viable liquidation path
+**Severity**: Medium  
+**Category**: Liquidation design  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)  
+**Description**: A liquidator must pay 100% of debt before receiving at most the remaining collateral. If collateral value falls below debt, liquidation guarantees a loss, so rational liquidators leave the position open and the treasury retains bad debt. Large positions also require unnecessary up-front capital.  
+**Proof of Concept**: For $1,000 debt backed by collateral now worth $700, liquidation takes $1,000 USDC and can return only $700 of collateral.  
+**Recommendation**: Support caller-selected partial liquidation and minimum collateral output, cap seizure to available collateral, explicitly recognize residual bad debt, and define a reserve/insurance loss mechanism.
+
+## [M-07] Upgrades can accidentally and irreversibly brick the proxy
+**Severity**: Medium  
+**Category**: Proxy safety  
+**Location**: `LendingMarket.upgradeTo()` and `MarketProxy.fallback()` (`src/LendingMarket.sol:84`, `src/MarketProxy.sol:26`)  
+**Description**: No check rejects zero, an EOA, or an incompatible implementation. Because upgrade logic lives only in the implementation, one bad authorized upgrade can remove the only upgrade path and permanently strand positions and treasury USDC.  
+**Proof of Concept**: Upgrade to an EOA. Subsequent delegatecalls return empty data, and that address exposes no function that can restore the implementation.  
+**Recommendation**: Validate code and UUPS UUID, use a standard proxy design, run storage-layout and fork upgrade tests, and retain a deliberately governed recovery process.
+
+## [L-01] Debt shares are rounded down when borrowing
+**Severity**: Low  
+**Category**: Precision  
+**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`)  
+**Description**: `amount * WAD / borrowIndex` rounds debt shares down while transferring the full amount. Once the index exceeds WAD, a one-base-unit borrow records zero debt and passes without collateral. Repetition undercharges debt, but for six-decimal USDC the extractable amount per call is below one micro-USDC and is not economically profitable at normal gas costs.  
+**Proof of Concept**: After interest accrues, call `borrow(1)` with no collateral; the principal increment is zero while one base unit transfers.  
+**Recommendation**: Round debt shares up on borrowing and require a nonzero share delta and a sensible minimum borrow.
+
+## [L-02] Interest uses an imprecise Arbitrum block-to-time conversion
+**Severity**: Low  
+**Category**: Arbitrum / accounting  
+**Location**: `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:117`)  
+**Description**: Arbitrum's Solidity `block.number` approximates the L1 block number and advances in steps; multiplying it by a fixed 12 seconds is not reliable elapsed wall time. Borrowers or the treasury receive slightly incorrect interest, and accrual can jump after periods where the reported number does not advance.  
+**Proof of Concept**: Compare `blocksElapsed * 12` with `block.timestamp - lastAccrualTimestamp` across Arbitrum blocks; the values can differ and update at different cadence.  
+**Recommendation**: Store a timestamp and accrue from `block.timestamp - lastAccrualTimestamp`, with a reasonable maximum interval and tests for sequencer outages.
+
+## [L-03] Liquidation discards value lost to token-unit rounding
+**Severity**: Low  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:224`)  
+**Description**: Collateral units round down, but `seizeUsd` is reduced by the full unrounded value. The liquidator can receive slightly less than paid for; for a future low-decimal, high-price token, a nontrivial requested seizure can round to zero.  
+**Proof of Concept**: If `takeUsd * unit < price`, the seized token amount is zero although `takeUsd` is fully subtracted.  
+**Recommendation**: Reduce remaining seizure value by the actual value transferred, or round units up subject to the user's balance and a documented policy.
+
+## [L-04] Feed and token decimal assumptions can freeze an asset
+**Severity**: Low  
+**Category**: Configuration validation  
+**Location**: `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `_liquidate()`  
+**Description**: A feed with more than 18 decimals underflows `18 - decimals`; a token with sufficiently large decimals overflows `10 ** decimals`. Price-dependent borrow, withdrawal, and liquidation then revert, potentially trapping users after a bad future listing.  
+**Proof of Concept**: Configure a feed reporting 19 decimals or list a token reporting 78 decimals and call the relevant valuation function.  
+**Recommendation**: Validate and cache code presence and decimal ranges before listing. Normalize multiplication and division in both directions with full-precision math and provide a safe delisting/migration path.
+
+## Planned-collateral constraints
+
+- The current fixed-balance vault is unsafe for rebasing tokens: a negative rebase leaves fictitious balances and bad-debt capacity, while a positive rebase becomes unallocated. Use non-rebasing wrappers or share-based adapters.
+- weETH and ezETH require wrapper-specific exchange-rate and market-price handling; do not map either 1:1 to ETH/USD.
+- USDT and USDC can be paused or blocklisted. Define an emergency mode that stops new borrowing, handles interest fairly, and provides a post-recovery repayment grace period. Consider isolated markets so one frozen custody address does not affect unrelated assets.
+
+These are listing gates rather than separate launch findings because only wstETH collateral and USDC debt are currently intended to be enabled.
+
+## Verification priorities
+
+Before deployment, add unit, fuzz, invariant, and Arbitrum-fork tests covering:
+
+- only authorized upgrades and configuration; atomic initialization; incompatible upgrade rejection;
+- debt conservation across every borrow/repay sequence and exact full closure;
+- health-factor boundaries and withdrawal after long idle periods;
+- wstETH conversion, stale/invalid rounds, sequencer outage and recovery;
+- liquidation solvency, rounding, partial liquidation, slippage, and bad-debt handling;
+- zero values, unusual token behavior, callbacks, pauses, and all planned asset adapters.

apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001/findings-chain.md
/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001/findings-erc20.md
/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001/findings-general.md
/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001/findings-lending.md
/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001/findings-oracles.md
/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001/findings-precision.md
/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001/findings-proxies.md
/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001/findings-signatures.md
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..66627d77d88afa76bc10573ba7dd2b9d0f5f0042
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,208 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-03  
+**Scope:** `README.md`, `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Target:** Arbitrum One; native USDC debt; wstETH launch collateral  
+**Result:** **Do not deploy in the current state.**
+
+## Executive summary
+
+The review found **2 Critical, 8 High, 7 Medium, and 4 Low** issues. The two Critical issues independently let any caller take control of pricing or implementation logic and steal the treasury-funded USDC and deposited collateral. The public liquidation-threshold setter is another immediate launch blocker. Even after access control is repaired, the health-factor formula incorrectly liquidates solvent borrowers, the proposed wstETH feed values the wrong unit, and stale oracle data is accepted.
+
+Fix order for Monday:
+
+1. Lock down upgrades, oracle replacement, and risk parameters; require atomic initialization.
+2. Correct health, wstETH pricing, oracle validation, interest realization on withdrawal, and full-repayment rounding.
+3. Add adversarial tests for borrowing, repayment, withdrawal, liquidation, oracle outages, and upgrades before funding the proxy.
+4. Address the Medium issues before launch. Do not list weETH, ezETH, USDT, fee-on-transfer, callback-capable, or rebasing assets until asset-specific adapters and accounting are implemented.
+
+This was a source review plus successful `forge build`; the repository has no test suite. No deployment scripts were present, so initialization safety and on-chain configuration could not be verified.
+
+## Findings
+
+## [C-01] Anyone can replace the implementation and drain the market and vault
+**Severity**: Critical  
+**Category**: Access control / proxy  
+**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)  
+**Description**: `upgradeTo()` has no authorization and writes an arbitrary address to the ERC-1967 implementation slot. Malicious logic then executes in the proxy context. Because the proxy holds seeded USDC and is the immutable `market` trusted by `CollateralVault`, the replacement can transfer all USDC and call `vault.seize()` for every depositor. The attacker receives all funded liquidity and deposited collateral.  
+**Proof of Concept**: Deploy logic with a drain function, call `upgradeTo(malicious)` through the proxy, then call the drain through the proxy. The new logic can transfer the proxy's USDC and invoke the vault as its trusted market.  
+**Recommendation**: Use a reviewed UUPS or transparent proxy implementation. Restrict upgrades to a timelocked multisig, validate code and `proxiableUUID`, and test storage compatibility and rollback/recovery procedures.
+
+## [C-02] Anyone can replace the oracle and steal all seeded USDC
+**Severity**: Critical  
+**Category**: Access control / oracle  
+**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)  
+**Description**: `setOracle()` has no `onlyOwner`. An attacker can report an enormous collateral price and a tiny positive USDC price, borrow the complete USDC balance against dust, and leave unrecoverable debt. The same control can fabricate unhealthy positions and extract users' collateral as liquidator.  
+**Proof of Concept**: Deposit dust wstETH, install an attacker oracle, return a huge wstETH price and small USDC price, then borrow the proxy's entire USDC balance.  
+**Recommendation**: Add access control, validate that the new oracle is a contract supporting every active asset, and place oracle changes behind a timelock/multisig with a pause and two-step activation process.
+
+## [H-01] Anyone can force liquidations by changing the liquidation threshold
+**Severity**: High  
+**Category**: Access control / risk parameters  
+**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)  
+**Description**: Any caller can set the threshold to any value. Setting it to zero makes every debtor unhealthy. The caller can then repay selected debts and receive borrowers' collateral plus the 5% bonus; unlucky borrowers lose the bonus and their positions are forcibly closed. Unbounded high values also allow governance parameters to be bypassed and can cause arithmetic reverts.  
+**Proof of Concept**: Call `setLiquidationThreshold(0)`, then call `liquidate(user)` for an otherwise healthy borrower after approving USDC.  
+**Recommendation**: Add `onlyOwner`, require `0 < bps && bps <= BPS`, use a timelocked risk role, and pause borrowing around material parameter changes.
+
+## [H-02] Division before multiplication makes solvent positions liquidatable
+**Severity**: High  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:146`)  
+**Description**: `collateralValueUsd / debtUsd` truncates before applying WAD precision. At the configured 80% threshold, every collateral ratio from 100% to just under 200% produces a health factor of `0.8e18`. A borrower with $1,500 collateral and $1,000 debt should have a 1.2 health factor but is liquidatable. A liquidator receives $1,050 of collateral; the solvent borrower loses $50 and is forcibly closed.  
+**Proof of Concept**: For `$1,500e18 / $1,000e18`, the contract first obtains `1`, then returns `1 * 8000 * 1e18 / 10000 = 0.8e18`.  
+**Recommendation**: Use full-precision multiplication before division, e.g. `mulDiv(collateralUsd, liquidationThreshold * WAD, debtUsd * BPS)`, with explicit rounding. Test immediately below, at, and above 125% collateralization.
+
+## [H-03] The stETH/USD feed prices wstETH as if it were one stETH
+**Severity**: High  
+**Category**: Oracle / asset integration  
+**Location**: launch configuration in `README.md`; `LendingMarket.collateralValueUsd()` and `_liquidate()` (`src/LendingMarket.sol:132`, `src/LendingMarket.sol:209`)  
+**Description**: One wstETH represents a changing amount greater than one stETH. Applying the stETH/USD feed directly to raw wstETH units undervalues collateral and transfers too many wstETH during liquidation. If one wstETH represents 1.20 stETH, a nominal 5% liquidation premium becomes approximately 26% in underlying-value terms. The liquidator receives the excess from the borrower.  
+**Proof of Concept**: At a $1,900 stETH price, a $1,050 seizure transfers about 0.5526 wstETH. At 1.20 stETH per wstETH, that collateral is actually worth about $1,260.  
+**Recommendation**: Use a maintained wstETH/USD feed or compose stETH/USD with the canonical `stEthPerToken()` conversion. Validate freshness and units at both legs. Require equivalent asset-specific adapters for weETH and ezETH.
+
+## [H-04] Stale or incomplete Chainlink rounds are accepted indefinitely
+**Severity**: High  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Deprecated `latestAnswer()` exposes no timestamp or round metadata. After a feed stops updating, borrowers can take too much USDC against a fallen collateral price, leaving treasury bad debt, or liquidators can seize collateral using an obsolete adverse price.  
+**Proof of Concept**: If wstETH falls while its feed remains at the old high value, deposit/retain collateral and borrow against the stale value before updates resume.  
+**Recommendation**: Use `latestRoundData()` and require positive answers, nonzero timestamps, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Configure maximum age per feed and define a safe pause/fallback response.
+
+## [H-05] Withdrawals check debt before realizing accrued interest
+**Severity**: High  
+**Category**: Lending accounting  
+**Location**: `CollateralVault.withdraw()` and `LendingMarket.requireHealthy()` (`src/CollateralVault.sol:44`, `src/LendingMarket.sol:153`)  
+**Description**: Withdrawal calls a view-only health check without first calling `accrueInterest()`. After inactivity, a borrower can withdraw collateral based on the old index; the next accrual makes the remaining position undercollateralized. The user receives collateral that should secure the debt, while the treasury can be left with bad debt.  
+**Proof of Concept**: Borrow at the maximum permitted boundary, wait without any market state-changing call, then withdraw collateral while `borrowIndex` is stale. Call `accrueInterest()` afterward; the updated debt exceeds the remaining collateral limit.  
+**Recommendation**: Route withdrawals through the market or expose an authenticated market hook that accrues before the vault changes balances. Check health using a preview index that includes elapsed interest, and test long idle periods.
+
+## [H-06] A displayed full repayment can leave permanent debt dust and lock collateral
+**Severity**: High  
+**Category**: Precision / debt accounting  
+**Location**: `LendingMarket.repay()` and `debtOf()` (`src/LendingMarket.sol:128`, `src/LendingMarket.sol:170`)  
+**Description**: Debt and repayment conversions both round down. Paying the full displayed debt can leave one scaled-principal unit. Once `amount * WAD / borrowIndex` rounds to zero, further payments transfer USDC but reduce no principal, and the amount cap prevents overpayment. The borrower loses every attempted payment and cannot withdraw all collateral.  
+**Proof of Concept**: With principal `1,000,000` and index `1.0000001e18`, displayed debt is `1,000,000`; repayment subtracts only `999,999`, leaving principal `1`. Paying the remaining displayed unit subtracts zero forever.  
+**Recommendation**: If `amount >= debt`, collect exactly `debt` and set principal to zero. For partial repayments, compute the principal reduction first with documented rounding and reject a positive payment that reduces zero principal.
+
+## [H-07] Reusable borrow signatures can force a signer into repeated debt and liquidation
+**Severity**: High  
+**Category**: Signatures  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)  
+**Description**: The signed message has no nonce or deadline and is never consumed. Anyone observing one signature can replay it until the account reaches its borrowing limit, and can replay it again after repayment. Funds go to the signer, but an unaware signer can be pushed to the liquidation boundary; the replayer can later liquidate and receive the 5% collateral bonus.  
+**Proof of Concept**: Submit the same `(borrower, amount, v, r, s)` repeatedly. Every digest is identical and accepted. After the borrower repays, submit it again.  
+**Recommendation**: Sign and validate a per-borrower nonce, deadline, receiver/intended relayer, and amount; increment the nonce before borrowing. Use a standard EIP-712/ECDSA implementation that enforces low-`s` and valid `v`.
+
+## [H-08] Non-atomic proxy initialization permits deployment takeover
+**Severity**: High  
+**Category**: Proxy / deployment  
+**Location**: `MarketProxy.constructor()` and `LendingMarket.initialize()` (`src/MarketProxy.sol:10`, `src/LendingMarket.sol:56`)  
+**Description**: The proxy allows empty `initData`, and anyone may call `initialize()` once. If initialization is deferred, a mempool observer selects the owner, oracle, vault, and debt token. The legitimate initializer is permanently locked out and any later funding is exposed. No deployment script demonstrates atomic initialization.  
+**Proof of Concept**: Deploy the proxy with empty init data; before the deployer initializes, call `initialize(attacker, attackerOracle, attackerVault, token)`.  
+**Recommendation**: Require nonempty init data and atomically initialize in the proxy constructor. Validate all addresses, assert state before funding, and disable initializers on the standalone implementation.
+
+## [M-01] Arbitrum sequencer recovery is not checked
+**Severity**: Medium  
+**Category**: Oracle / Arbitrum  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: The oracle does not consult the Arbitrum sequencer uptime feed. Immediately after recovery, asset feeds may not yet be current. A borrower can receive excess USDC or a liquidator can receive collateral based on pre-outage prices.  
+**Proof of Concept**: Submit a borrow or liquidation immediately after sequencer recovery while the relevant asset round still predates the outage.  
+**Recommendation**: Validate the Arbitrum sequencer uptime feed and enforce a recovery grace period (commonly one hour) before using prices, in addition to per-feed freshness checks.
+
+## [M-02] Invalid oracle answers can bypass health checks or halt liquidation
+**Severity**: Medium  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Zero and negative answers are not rejected. A zero USDC price makes debt value zero and the health factor maximal, allowing treasury USDC to be borrowed with inadequate backing. A zero collateral price makes liquidation divide by zero; a negative answer casts to a huge unsigned integer and generally reverts downstream. Users or the treasury lose funds if an invalid answer is consumed; otherwise risk-reducing actions are blocked.  
+**Proof of Concept**: Return zero for USDC/USD and borrow while `debtValueUsd()` is zero, or return zero for collateral and observe `_liquidate()` revert at division by `price`.  
+**Recommendation**: Require `answer > 0`, valid round metadata, and reject/circuit-break implausible or aggregator-bound values. Pause new risk while preserving repayment and recovery paths.
+
+## [M-03] Nominal and unchecked token transfers can create unbacked collateral
+**Severity**: Medium  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()`, `withdraw()`, `seize()`; `LendingMarket.repay()`, `_borrow()`, `_liquidate()`  
+**Description**: Return values from every transfer are ignored, and deposits credit the requested amount rather than the received balance delta. The launch assets normally revert or return true, but a future fee-on-transfer or false-returning listed token lets an attacker receive inflated collateral credit and borrow real USDC. False-returning debt transfers can also cancel debt without payment after a future debt-asset change.  
+**Proof of Concept**: List a token whose `transferFrom` returns false or transfers 90%. Calling `deposit(100)` records 100 although the vault receives zero or 90; the caller borrows against the fictitious difference.  
+**Recommendation**: Use safe-transfer helpers. Credit the observed balance delta and, unless explicitly supported by an adapter, require it to equal the requested amount.
+
+## [M-04] Transfer-before-effects permits reentrant withdrawals for callback-capable collateral
+**Severity**: Medium  
+**Category**: Reentrancy / future listings  
+**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)  
+**Description**: The vault transfers before decrementing `balanceOf`. A callback-capable future token can reenter and make nested withdrawals observe the same old balance, withdrawing more assets than are charged and potentially leaving fictitious collateral for a USDC borrow. Launch wstETH does not expose such transfer callbacks, so this becomes exploitable when an unsafe token is listed.  
+**Proof of Concept**: Deposit a listed callback token, call `withdraw(X)`, and reenter `withdraw(X)` during its transfer hook. Both frames read the original balance and transfer `X`.  
+**Recommendation**: Apply checks-effects-interactions, decrement before the external call, and add a reentrancy guard. Explicitly prohibit callback tokens unless an adapter has been reviewed.
+
+## [M-05] The borrower array can permanently disable batch liquidation
+**Severity**: Medium  
+**Category**: Denial of service  
+**Location**: `LendingMarket._borrow()` and `liquidateAll()` (`src/LendingMarket.sol:190`, `src/LendingMarket.sol:197`)  
+**Description**: `borrow(0)` appends the caller whenever principal is zero; entries are never removed or deduplicated. An attacker spends gas but no assets to grow the array until `liquidateAll()` cannot fit in a block. During a price shock, keepers lose the documented sweep function and bad debt risk rises, although individual liquidation remains available.  
+**Proof of Concept**: Repeatedly call `borrow(0)`, then call `liquidateAll()` after enough entries exist; it runs out of gas.  
+**Recommendation**: Reject zero/dust borrowing, maintain unique membership, remove closed accounts, and replace the unbounded sweep with cursor-based bounded batches or off-chain discovery.
+
+## [M-06] Deeply underwater debt has no economically viable liquidation path
+**Severity**: Medium  
+**Category**: Liquidation design  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)  
+**Description**: A liquidator must pay 100% of debt before receiving at most the remaining collateral. If collateral value falls below debt, liquidation guarantees a loss, so rational liquidators leave the position open and the treasury retains bad debt. Large positions also require unnecessary up-front capital.  
+**Proof of Concept**: For $1,000 debt backed by collateral now worth $700, liquidation takes $1,000 USDC and can return only $700 of collateral.  
+**Recommendation**: Support caller-selected partial liquidation and minimum collateral output, cap seizure to available collateral, explicitly recognize residual bad debt, and define a reserve/insurance loss mechanism.
+
+## [M-07] Upgrades can accidentally and irreversibly brick the proxy
+**Severity**: Medium  
+**Category**: Proxy safety  
+**Location**: `LendingMarket.upgradeTo()` and `MarketProxy.fallback()` (`src/LendingMarket.sol:84`, `src/MarketProxy.sol:26`)  
+**Description**: No check rejects zero, an EOA, or an incompatible implementation. Because upgrade logic lives only in the implementation, one bad authorized upgrade can remove the only upgrade path and permanently strand positions and treasury USDC.  
+**Proof of Concept**: Upgrade to an EOA. Subsequent delegatecalls return empty data, and that address exposes no function that can restore the implementation.  
+**Recommendation**: Validate code and UUPS UUID, use a standard proxy design, run storage-layout and fork upgrade tests, and retain a deliberately governed recovery process.
+
+## [L-01] Debt shares are rounded down when borrowing
+**Severity**: Low  
+**Category**: Precision  
+**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`)  
+**Description**: `amount * WAD / borrowIndex` rounds debt shares down while transferring the full amount. Once the index exceeds WAD, a one-base-unit borrow records zero debt and passes without collateral. Repetition undercharges debt, but for six-decimal USDC the extractable amount per call is below one micro-USDC and is not economically profitable at normal gas costs.  
+**Proof of Concept**: After interest accrues, call `borrow(1)` with no collateral; the principal increment is zero while one base unit transfers.  
+**Recommendation**: Round debt shares up on borrowing and require a nonzero share delta and a sensible minimum borrow.
+
+## [L-02] Interest uses an imprecise Arbitrum block-to-time conversion
+**Severity**: Low  
+**Category**: Arbitrum / accounting  
+**Location**: `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:117`)  
+**Description**: Arbitrum's Solidity `block.number` approximates the L1 block number and advances in steps; multiplying it by a fixed 12 seconds is not reliable elapsed wall time. Borrowers or the treasury receive slightly incorrect interest, and accrual can jump after periods where the reported number does not advance.  
+**Proof of Concept**: Compare `blocksElapsed * 12` with `block.timestamp - lastAccrualTimestamp` across Arbitrum blocks; the values can differ and update at different cadence.  
+**Recommendation**: Store a timestamp and accrue from `block.timestamp - lastAccrualTimestamp`, with a reasonable maximum interval and tests for sequencer outages.
+
+## [L-03] Liquidation discards value lost to token-unit rounding
+**Severity**: Low  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:224`)  
+**Description**: Collateral units round down, but `seizeUsd` is reduced by the full unrounded value. The liquidator can receive slightly less than paid for; for a future low-decimal, high-price token, a nontrivial requested seizure can round to zero.  
+**Proof of Concept**: If `takeUsd * unit < price`, the seized token amount is zero although `takeUsd` is fully subtracted.  
+**Recommendation**: Reduce remaining seizure value by the actual value transferred, or round units up subject to the user's balance and a documented policy.
+
+## [L-04] Feed and token decimal assumptions can freeze an asset
+**Severity**: Low  
+**Category**: Configuration validation  
+**Location**: `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `_liquidate()`  
+**Description**: A feed with more than 18 decimals underflows `18 - decimals`; a token with sufficiently large decimals overflows `10 ** decimals`. Price-dependent borrow, withdrawal, and liquidation then revert, potentially trapping users after a bad future listing.  
+**Proof of Concept**: Configure a feed reporting 19 decimals or list a token reporting 78 decimals and call the relevant valuation function.  
+**Recommendation**: Validate and cache code presence and decimal ranges before listing. Normalize multiplication and division in both directions with full-precision math and provide a safe delisting/migration path.
+
+## Planned-collateral constraints
+
+- The current fixed-balance vault is unsafe for rebasing tokens: a negative rebase leaves fictitious balances and bad-debt capacity, while a positive rebase becomes unallocated. Use non-rebasing wrappers or share-based adapters.
+- weETH and ezETH require wrapper-specific exchange-rate and market-price handling; do not map either 1:1 to ETH/USD.
+- USDT and USDC can be paused or blocklisted. Define an emergency mode that stops new borrowing, handles interest fairly, and provides a post-recovery repayment grace period. Consider isolated markets so one frozen custody address does not affect unrelated assets.
+
+These are listing gates rather than separate launch findings because only wstETH collateral and USDC debt are currently intended to be enabled.
+
+## Verification priorities
+
+Before deployment, add unit, fuzz, invariant, and Arbitrum-fork tests covering:
+
+- only authorized upgrades and configuration; atomic initialization; incompatible upgrade rejection;
+- debt conservation across every borrow/repay sequence and exact full closure;
+- health-factor boundaries and withdrawal after long idle periods;
+- wstETH conversion, stale/invalid rounds, sequencer outage and recovery;
+- liquidation solvency, rounding, partial liquidation, slippage, and bad-debt handling;
+- zero values, unusual token behavior, callbacks, pauses, and all planned asset adapters.
diff --git a/findings-chain.md b/findings-chain.md
deleted file mode 100644
index 3082a2a277646a7d034774743452e922dab69f32..0000000000000000000000000000000000000000
--- a/findings-chain.md
+++ /dev/null
@@ -1,21 +0,0 @@
-## [CHAIN-1] Sequencer recovery permits borrowing and liquidation against stale prices
-**Severity**: High
-**Category**: evm-audit-chain-specific
-**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:34-41`), consumed by `LendingMarket._borrow()`, `LendingMarket.liquidate()`, and `LendingMarket._liquidate()`
-**Description**: The market is explicitly targeting Arbitrum One, but its Chainlink adapter calls `latestAnswer()` and performs no Arbitrum sequencer-uptime check, recovery grace period, or `updatedAt` freshness check. During a sequencer outage users cannot repay, add collateral, or liquidate. On recovery, the last published answer may predate a large off-chain price movement, while transactions can resume before a trustworthy post-recovery price has propagated. An attacker can deposit collateral whose stale answer is too high and borrow real USDC that the collateral no longer covers. Conversely, a stale-low answer can make an otherwise solvent borrower liquidatable; a liquidator receives that user's collateral and bonus before the price catches up. This is an Arbitrum-specific amplification of the missing freshness validation because the sequencer outage simultaneously prevents users and keepers from taking protective actions.
-**Proof of Concept**: (1) The Arbitrum sequencer becomes unavailable while wstETH falls materially in external markets. (2) The on-chain feed remains at its pre-outage value and users cannot transact. (3) Immediately after sequencing resumes, before the collateral feed publishes a fresh round, an attacker deposits wstETH and calls `borrow()`. `getPrice()` returns the old high answer, the health check passes, and the attacker receives more native USDC than their collateral can support at the current market price. The treasury is left with bad debt after the feed catches up. The reverse price movement permits premature liquidation of an existing borrower.
-**Recommendation**: Integrate Chainlink's Arbitrum sequencer uptime feed. Reject prices while the sequencer reports down and for a deliberately chosen grace period after it comes back up. Replace `latestAnswer()` with `latestRoundData()` and require a positive answer, a nonzero `updatedAt`, a completed round, and per-feed maximum age calibrated to that feed's Arbitrum heartbeat. During the outage and grace period, disable borrowing and liquidation while preserving risk-reducing actions where dependencies permit. Test outage, recovery, stale-round, and delayed-feed-update scenarios before launch.
-
-## [CHAIN-2] L1 block-number approximation makes interest timing coarse and chain-dependent
-**Severity**: Low
-**Category**: evm-audit-chain-specific
-**Location**: `LendingMarket.initialize()` and `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:70`, `src/LendingMarket.sol:116-128`)
-**Description**: Arbitrum exposes an approximate L1 block number through Solidity's `block.number`, not the Arbitrum L2 block number. Many L2 transactions therefore share one value, and its progress is not a protocol guarantee that exactly 12 seconds elapsed per increment. The market nevertheless converts the difference to time using the Ethereum-specific `SECONDS_PER_BLOCK = 12`. Interest does not accrue between any transactions sharing an L1 block, then accrues in steps, and long sequencer or L1 timing irregularities translate directly into debt-accounting error. Rapid same-block borrowing and repayment avoids the small amount of interest that wall-clock time would charge; more importantly, borrowers or the treasury can gain or lose whenever actual elapsed time diverges from `blocksElapsed * 12`. This is unlikely to create a large standalone extraction at a 4% annual rate, but it is avoidable financial-accounting drift in a production lending market.
-**Proof of Concept**: Execute `accrueInterest()` and then multiple borrow/repay operations in different Arbitrum L2 blocks that all report the same L1 `block.number`. Every call computes `blocksElapsed == 0`, so no interest is recorded even though time and L2 blocks elapsed. Conversely, if the exposed L1 block number advances several steps between calls, all estimated time is charged at once according to the hardcoded 12-second multiplier rather than actual elapsed seconds.
-**Recommendation**: Store `lastAccrualTimestamp` and compute interest from `block.timestamp - lastAccrualTimestamp`, with an explicit maximum accrual interval or administrative recovery procedure if desired. Do not use `ArbSys.arbBlockNumber()` as a substitute for elapsed time; it has L2-block rather than time semantics. Add tests covering many calls at the same `block.number`, sequencer downtime, and irregular block-number jumps.
-
-## Chain-specific checks with no additional finding
-
-- The README's native USDC address (`0xaf88...5831`) and wstETH address (`0x5979...0529`) are Arbitrum One addresses rather than Ethereum-mainnet or USDC.e addresses. The separate semantic error of assigning a stETH/USD feed directly to wstETH is reported by the ERC-20/oracle review and is not duplicated here.
-- No retryable-ticket, L2-to-L1 messaging, address-aliasing, `block.basefee`, hardcoded gas-price, `prevrandao`, native-ETH `transfer`/`send`, or chain-specific precompile logic exists in `src/`.
-- Solidity 0.8.28 may emit `PUSH0`, which is supported on current Arbitrum One; this is a deployment-compatibility concern only if the same bytecode is later deployed to a chain without Shanghai/PUSH0 support.
diff --git a/findings-erc20.md b/findings-erc20.md
deleted file mode 100644
index fe11693bdc9d4c7a7e1efe27382c440339639b26..0000000000000000000000000000000000000000
--- a/findings-erc20.md
+++ /dev/null
@@ -1,39 +0,0 @@
-## [ERC20-1] wstETH is priced as one stETH, overstating liquidation severity and collateral seized
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `LendingMarket.collateralValueUsd()` and `LendingMarket._liquidate()` (`src/LendingMarket.sol:132-138`, `src/LendingMarket.sol:219-230`); launch feed configuration in `README.md`
-**Description**: The launch configuration maps wstETH to a stETH/USD feed, while both valuation paths multiply the user's raw wstETH units directly by that feed price. One wstETH is a yield-bearing wrapper representing a changing quantity of stETH; it is not one stETH. The omitted `stEthPerToken()` conversion systematically undervalues wstETH and makes the effective loan-to-value and liquidation bonus differ from the configured 80% threshold and 5% bonus. The same integration error will recur if weETH or ezETH is listed against an ETH/USD feed without composing in its exchange rate. A borrower can be liquidated while economically above the advertised collateral threshold, and the liquidator receives more underlying value than the configured bonus at the borrower's expense.
-**Proof of Concept**: Suppose one wstETH represents 1.20 stETH. A user deposits 1 wstETH when the stETH feed is $2,400 and borrows $1,000; the account passes the current health check. The stETH feed later falls to $1,900. The market reports $1,900 of collateral while the wrapper is economically worth $2,280, and the position is liquidatable under the current implementation. `_liquidate()` calculates a nominal $1,050 seizure and transfers about 0.5526 wstETH. At the actual wrapper rate that is $1,260 of value: an effective 26% premium over repaid debt rather than 5%. The extra $210 comes from the borrower. (The separate loss-of-precision defect in `healthFactor()` makes the liquidation boundary even harsher; correcting it does not correct this wrapper price or seizure error.)
-**Recommendation**: Price the collateral token itself. For wstETH, either configure a maintained wstETH/USD feed or compose stETH/USD with wstETH's `stEthPerToken()` rate using explicit decimal normalization. Use asset-specific adapters for weETH and ezETH rather than assuming every wrapped LST/LRT is 1:1 with ETH. Test valuation and seizure against live wrapper conversion rates and define conservative handling for rate decreases/slashing.
-
-## [ERC20-2] Nominal deposit accounting lets non-standard collateral create unbacked borrowing power
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.deposit()` (`src/CollateralVault.sol:35-41`)
-**Description**: `deposit()` credits the caller-supplied `amount` without checking the vault's balance delta and ignores the return value of `transferFrom`. For a fee-on-transfer token the vault receives less than the credited amount. For a token that returns `false` without reverting, it may receive nothing and still credit the full amount. `LendingMarket.listCollateral()` provides no token-behavior validation, so a future listing can turn the discrepancy into borrowable collateral. An attacker deposits repeatedly, receives inflated accounting, borrows real USDC from the treasury, and leaves bad debt that the vault cannot cover. Raw transfers elsewhere also ignore a returned `false`, but this deposit path is the direct accounting exploit.
-**Proof of Concept**: Governance lists a token with a valid price feed that charges a 10% transfer fee. The attacker calls `deposit(token, 1_000e18)`; the vault receives 900 tokens but records 1,000. Health checks value 1,000 tokens and permit borrowing against them. With a token returning `false` and moving no funds, the same call records 1,000 tokens backed by zero. The attacker borrows USDC; liquidation or withdrawal later fails once actual vault inventory is exhausted.
-**Recommendation**: Use a checked transfer helper and derive the credited amount from `balanceAfter - balanceBefore`. If only exact-transfer collateral is supported, require the delta to equal `amount` and revert otherwise. Document and enforce an explicit token-adapter/allowlist policy before listing weETH, ezETH, USDT, or any future asset; never infer ERC-20 compatibility solely from the interface.
-
-## [ERC20-3] Cached balances are incompatible with the planned rebasing-collateral path
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.balanceOf`, `CollateralVault.deposit()`, `CollateralVault.withdraw()`, and `LendingMarket.collateralValueUsd()` (`src/CollateralVault.sol:12`, `src/CollateralVault.sol:35-52`, `src/LendingMarket.sol:132-138`)
-**Description**: User collateral is stored as a fixed token amount and never reconciled to the vault's actual balance. If a listed token negatively rebases, recorded balances and borrowing power remain unchanged even though backing has disappeared. Borrowers can retain or take USDC loans against nonexistent collateral, while withdrawals and liquidations eventually revert or become first-come-first-served. A positive rebase creates unallocated assets that depositors cannot claim. This does not affect non-rebasing wstETH itself, but it makes the README's planned path to rebasing collateral unsafe without a different accounting model.
-**Proof of Concept**: Two users each deposit 100 units of a listed rebasing token, so total internal balances and vault inventory are 200. After a 20% negative rebase the vault owns 160, while each user's recorded balance remains 100 and health calculations still value 200 total. Both can continue borrowing based on the stale amounts. The first user may withdraw or be seized for 100, leaving only 60 backing the second user's recorded 100; attempts to transfer the remaining nominal amount revert and USDC debt can become bad debt.
-**Recommendation**: Do not list rebasing tokens in the current vault. Prefer their non-rebasing wrapper, priced with its conversion rate. If direct rebasing support is required, implement share-based accounting (`userShares / totalShares`) against actual assets, specify who receives positive rebases and absorbs negative rebases, and validate every deposit, withdrawal, health check, and liquidation under both directions of rebase before governance can enable the asset.
-
-## [ERC20-4] USDC/USDT issuer controls can freeze shared custody and block risk reduction
-**Severity**: Medium
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.deposit()`, `CollateralVault.withdraw()`, `CollateralVault.seize()`, `LendingMarket.repay()`, `LendingMarket._borrow()`, and `LendingMarket._liquidate()`
-**Description**: USDC (the debt asset) and shortlisted USDT have issuer pause and address-blocklist controls. All debt liquidity is held by `LendingMarket`, and all collateral of a given token is pooled in `CollateralVault`. If the market is blocked, seeded USDC and repayments can be frozen for every user. If the vault is blocked after USDT is listed, every depositor's USDT is frozen. A global token pause can prevent repayment and liquidation during a price move; after transfers resume, borrowers may face immediate liquidation because the protocol has no emergency mode or grace period. A single user's blocklisting can also prevent that user's repayment or collateral withdrawal even when they are trying to reduce risk.
-**Proof of Concept**: A borrower has USDC debt and USDT collateral. Tether pauses transfers or blocks the vault address, making `withdraw()` and `seize()` revert for all USDT positions. Alternatively Circle pauses USDC, making `repay()` and `_liquidate()` revert. Prices and interest continue to move while users cannot repay and keepers cannot liquidate. When transfers resume, accounts may be underwater and liquidated despite having had no on-chain path to cure them during the outage.
-**Recommendation**: Treat issuer controls as an explicit listing risk. Add a protocol emergency state that stops new borrows and interest accrual/liquidations when the debt asset or a major collateral cannot transfer, followed by a governance-controlled recovery/grace period. Isolate centrally controlled collateral in separate vaults/markets where practical so one blocklisted custody address does not freeze unrelated assets. Publish this dependency and rehearse pause/blocklist incident procedures before launch and before listing USDT.
-
-## [ERC20-5] Unbounded token decimals can permanently disable account health operations
-**Severity**: Medium
-**Category**: evm-audit-erc20
-**Location**: `LendingMarket.listCollateral()`, `LendingMarket.collateralValueUsd()`, `LendingMarket.debtValueUsd()`, and `LendingMarket._liquidate()` (`src/LendingMarket.sol:107-114`, `src/LendingMarket.sol:132-143`, `src/LendingMarket.sol:219-230`)
-**Description**: Collateral listing validates neither that `token` is a contract nor that its `decimals()` is within a safe supported range. Valuation computes `10 ** decimals`; a listed token returning a sufficiently large value (78 or above) causes checked exponentiation to revert. Because `collateralValueUsd()` iterates the global token list, any user with a nonzero recorded amount of that asset can no longer borrow, pass the post-withdraw health check, or be liquidated. Tokens with unusual but smaller decimals can also create unsupported rounding behavior. This is a governance-triggered integration failure, but it can strand positions after a mistaken or compromised listing.
-**Proof of Concept**: Governance lists a token whose `decimals()` returns 78 and configures a feed. A user deposits one unit. Every call to `collateralValueUsd(user)` reaches `10 ** 78` and reverts from overflow. Consequently `healthFactor`, borrowing, collateral withdrawal (which calls `requireHealthy`), and liquidation for that account revert.
-**Recommendation**: Validate token code and cache normalized decimal metadata at listing time. Restrict decimals to a deliberately supported range (normally no more than 18 unless higher-decimal assets are explicitly tested), reject zero addresses/EOAs, and use a full-precision normalization library or asset adapter rather than unchecked generic exponentiation. Add a safe delisting/migration mechanism for a token whose metadata or implementation changes.
diff --git a/findings-general.md b/findings-general.md
deleted file mode 100644
index 85203bca72def126fa013964b28da77eed39b9d7..0000000000000000000000000000000000000000
--- a/findings-general.md
+++ /dev/null
@@ -1,63 +0,0 @@
-## [G-1] Anyone can replace the market implementation and seize all protocol assets
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo` has no authorization check and writes an arbitrary address directly to the ERC-1967 implementation slot. Because calls reach this function through `MarketProxy`, any account can replace the live implementation. The replacement executes in the proxy's storage context and the proxy is also the immutable `market` trusted by `CollateralVault`, so malicious implementation code can transfer the market's USDC and invoke `vault.seize` against every depositor. The attacker receives all treasury liquidity and all deposited collateral.
-**Proof of Concept**: (1) Deploy an implementation with a function that transfers the proxy's full USDC balance to the attacker and calls `CollateralVault.seize(user, token, attacker, amount)`. (2) Call `upgradeTo(maliciousImplementation)` through `MarketProxy`; the unguarded function stores the attacker's address. (3) Call the malicious function through the proxy. It executes as the trusted market and drains both contracts.
-**Recommendation**: Add `onlyOwner` to `upgradeTo`, reject `address(0)` and implementations with no code, and use a battle-tested UUPS implementation that verifies `proxiableUUID`. Put upgrade authority behind a timelock/multisig. Also disable initialization of the implementation contract itself.
-
-## [G-2] Anyone can install a malicious oracle and borrow the entire USDC treasury against dust
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)
-**Description**: `setOracle` lacks `onlyOwner`, so an arbitrary caller can replace the oracle. An attacker-controlled oracle can report an enormous collateral price and a minimal debt-asset price, making a dust-backed account appear healthy. The attacker can then borrow the market's directly seeded USDC balance and keep it; the recorded collateral cannot cover the debt.
-**Proof of Concept**: (1) Deposit a small amount of a listed collateral. (2) Deploy a contract implementing `getPrice` that returns an attacker-chosen high price for the collateral and a low positive price for USDC. (3) Call `setOracle` with that contract. (4) Call `borrow` for the market's full USDC balance. The manipulated health check passes and the real USDC is transferred to the attacker.
-**Recommendation**: Add `onlyOwner` to `setOracle`, reject zero/non-contract addresses, and preferably use a two-step, timelocked oracle update controlled by a multisig. Validate the new oracle against expected feeds and bounds before activating it.
-
-## [G-3] Anyone can weaken the liquidation threshold and drain treasury liquidity
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)
-**Description**: `setLiquidationThreshold` is publicly callable and accepts an unbounded value. A caller can set it far above `BPS`, causing nearly uncollateralized positions to pass `healthFactor`. The attacker receives real USDC while the protocol is left with bad debt backed by negligible collateral.
-**Proof of Concept**: (1) Deposit a minimal amount of listed collateral. (2) Call `setLiquidationThreshold(type(uint256).max / 1e18)` or another very large value that does not overflow the particular health-factor calculation. (3) Borrow up to the market's USDC liquidity. The inflated threshold makes the health factor exceed `1e18` despite insufficient collateral.
-**Recommendation**: Add `onlyOwner` and enforce a conservative bound such as `0 < bps && bps <= BPS`. Apply governance delay/multisig controls to risk-parameter changes and add invariant tests proving that increasing the threshold cannot permit undercollateralized borrowing.
-
-## [G-4] Callback-capable collateral can be withdrawn multiple times while leaving fictitious collateral recorded
-**Severity**: High
-**Category**: evm-audit-general
-**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)
-**Description**: `withdraw` transfers tokens before reducing `balanceOf` and before checking account health. A listed ERC777-like or otherwise callback-capable token can reenter `withdraw` during `transfer`. Every nested call reads the same pre-withdraw balance, transfers again, and then writes the same final balance. The account can therefore remove more collateral than it is charged for, retain an overstated vault balance, and borrow USDC that is no longer backed. The README explicitly plans to broaden collateral support, including yield-bearing and rebasing assets, making the token-behavior assumption security-critical.
-**Proof of Concept**: (1) A callback-capable token is listed and an attacker deposits `X`. (2) The attacker calls `withdraw(token, X)`. (3) During the token transfer callback, the attacker reenters `withdraw(token, X)`. Both invocations observe `balanceOf == X`, both transfer `X`, and both finally store zero. With a partial amount, the same technique can leave a positive fictitious balance that supports a USDC borrow.
-**Recommendation**: Follow checks-effects-interactions: decrement `balanceOf` before calling the token, then perform the health check and transfer (a revert rolls all changes back). Add a reentrancy guard as defense in depth and explicitly vet or reject callback/rebasing collateral types until accounting supports them.
-
-## [G-5] Unchecked ERC20 return values allow unbacked balances or debt cancellation
-**Severity**: High
-**Category**: evm-audit-general
-**Location**: `CollateralVault.deposit()`, `CollateralVault.withdraw()`, `CollateralVault.seize()`, `LendingMarket.repay()`, `LendingMarket._borrow()`, and `LendingMarket._liquidate()`
-**Description**: Every ERC20 `transfer`/`transferFrom` return value is ignored. A token that returns `false` instead of reverting can cause state transitions to complete without the corresponding asset movement. Most critically, a false-returning listed collateral creates credited collateral without a deposit, and a false-returning debt asset lets `repay` reduce debt or `_liquidate` clear a borrower's entire debt without receiving payment. The immediate launch assets may revert on failure, but the implementation presents the same unchecked generic interface for planned future listings and upgrades.
-**Proof of Concept**: For a listed token whose `transferFrom` returns `false`, call `deposit(token, amount)`. No tokens arrive, but `balanceOf[msg.sender][token]` increases by `amount`; the attacker then borrows real USDC against the fictitious balance. Alternatively, if a configured debt token returns `false`, calling `repay` reduces principal even though the market receives nothing.
-**Recommendation**: Use a safe-transfer library that accepts either `true` or empty returndata and reverts on `false` or malformed returndata. For collateral deposits, additionally measure the vault's balance before and after transfer and credit only the amount actually received; define explicit policy for fee-on-transfer and rebasing assets.
-
-## [G-6] Borrow authorizations have no nonce or deadline and can be replayed indefinitely
-**Severity**: Medium
-**Category**: evm-audit-general
-**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)
-**Description**: The signed struct contains only `borrower` and `amount`; it has neither a nonce nor expiry, and no digest is marked consumed. Anyone who sees one authorization can submit it repeatedly for as long as the account remains healthy. The recipient is the borrower, so a relayer does not directly steal the proceeds, but they can force the signer to take repeated unwanted debt, consume their borrowing capacity, and push the position to the liquidation boundary. A signature also remains valid indefinitely and after repayment.
-**Proof of Concept**: Obtain one valid signature authorizing a borrow of `A`. Call `borrowWithSig(borrower, A, ...)` repeatedly. Every call recovers the same borrower and succeeds until the health check or market liquidity stops it. After the borrower repays, the same old signature can be replayed again.
-**Recommendation**: Include a per-borrower nonce, deadline, and preferably the intended relayer/receiver in `BORROW_TYPEHASH`; check the deadline and increment the nonce before borrowing. Use a standard EIP-712/ECDSA implementation that rejects malleable signatures and invalid `v` values.
-
-## [G-7] The borrower array can be grown without bound until batch liquidation is unusable
-**Severity**: Medium
-**Category**: evm-audit-general
-**Location**: `LendingMarket._borrow()` and `LendingMarket.liquidateAll()` (`src/LendingMarket.sol:197`, `src/LendingMarket.sol:190`)
-**Description**: `_borrow` appends whenever `principalOf[borrower] == 0` but entries are never removed or marked as already known. Any account can repeatedly call `borrow(0)`, for which the principal remains zero and the zero-debt health factor is maximal, adding another entry each time. Normal users can also be added repeatedly after repaying. `liquidateAll` scans the entire attacker-growable array and performs oracle/vault calls per live entry; eventually it exceeds the Arbitrum transaction gas limit. Keepers lose the documented ability to sweep underwater positions during a sharp price move, increasing the chance of bad debt, although individual `liquidate` remains available.
-**Proof of Concept**: From one address, call `borrow(0)` thousands of times. Each call pushes that address into `borrowers` because its principal remains zero. Calling `liquidateAll` must iterate across all duplicate entries and eventually runs out of gas before completing.
-**Recommendation**: Reject zero and dust borrows, maintain an `isBorrower` membership flag, and remove users with an indexed set when debt reaches zero. Replace all-at-once liquidation with a bounded, cursor-based batch function accepting a maximum number of positions.
-
-## [G-8] Proxy construction permits an EOA implementation and an uninitialized deployment
-**Severity**: Low
-**Category**: evm-audit-general
-**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`)
-**Description**: The constructor does not verify that `implementation` contains code, and it allows empty `initData`. A delegatecall to a non-contract address reports success, so deployment tooling can silently create a proxy with no executable implementation. If initialization is omitted, `LendingMarket.initialize` remains publicly callable and an observer can become `owner`. The currently unprotected setters/upgrader make ownership less consequential, but once those Critical issues are fixed this deployment footgun becomes an ownership takeover or permanent deployment failure.
-**Proof of Concept**: Deploy `MarketProxy` with an EOA as `implementation` and non-empty encoded initialize data; `delegatecall` succeeds with empty returndata and the proxy deploys unusably. Or deploy a valid implementation with empty `initData`, then have another account call `initialize` through the proxy first and set itself as owner.
-**Recommendation**: Require `implementation.code.length > 0`, require non-empty initialization data for this deployment, and atomically delegatecall `initialize` in the constructor. Make the deployment script assert initialized owner, oracle, vault, and debt asset immediately after deployment.
diff --git a/findings-lending.md b/findings-lending.md
deleted file mode 100644
index 78375b3dfc090d2af7464faf1597867d0a74098c..0000000000000000000000000000000000000000
--- a/findings-lending.md
+++ /dev/null
@@ -1,47 +0,0 @@
-# Lending and Liquidation Findings
-
-## [HIGH] LEND-01 — Divide-before-multiply makes healthy positions liquidatable
-
-- **Contract / function:** `LendingMarket.sol`, `healthFactor()`
-- **Impact:** The market does not enforce the documented 80% liquidation threshold. Because the collateral/debt ratio is truncated to a whole integer first, every position with a collateral ratio from 100% through just under 200% receives the same health factor of `0.8e18` and is liquidatable. For example, a user with $150 of collateral and $100 of debt should have a health factor of 1.2, but the contract reports 0.8. A liquidator can repay the $100 debt and take $105 of collateral from this solvent user. The same error prevents users from borrowing to the advertised 80% LTV; they need at least 200% collateralization to pass the check.
-- **Cause:** `return (collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS;` performs integer division before applying the fixed-point scale.
-- **Fix:** Multiply before dividing, using overflow-safe full-precision math: `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Add boundary tests immediately below, at, and above 125% collateralization, plus fuzz tests against a high-precision reference implementation.
-
-## [HIGH] LEND-02 — The configured stETH/USD feed materially underprices wstETH collateral
-
-- **Contract / function:** Deployment configuration described in `README.md`; consumed by `LendingMarket.collateralValueUsd()` and `LendingMarket._liquidate()` through `PriceOracle.getPrice()`
-- **Impact:** wstETH is not redeemable 1:1 for stETH; one wstETH represents an increasing amount of stETH. Feeding the stETH/USD price directly as the price of one wstETH therefore undervalues every user's collateral by the wstETH/stETH exchange rate. Users can be liquidated before the intended threshold. During liquidation, the same underpricing makes the market transfer more wstETH than the stated 5% bonus, so a liquidator extracts the exchange-rate difference from the borrower in addition to the bonus.
-- **Cause:** The planned wstETH listing maps wstETH to the stETH/USD feed without converting through `wstETH.stEthPerToken()` (or using a purpose-built wstETH/USD feed).
-- **Fix:** Use Chainlink's Arbitrum wstETH/USD feed if supported and validate its heartbeat, or compose stETH/USD with the canonical wstETH-to-stETH conversion rate using carefully normalized fixed-point math. Test valuation and seizure using the live non-1:1 exchange rate before deployment.
-
-## [MEDIUM] LEND-03 — Full repayment can leave an unrepayable scaled-debt remainder
-
-- **Contract / function:** `LendingMarket.sol`, `repay()` and `debtOf()`
-- **Impact:** After interest makes `borrowIndex > 1e18`, repaying the displayed full debt can leave one or more units of scaled principal because both conversions round down. Once the displayed debt is very small, `amount * WAD / borrowIndex` can be zero, so further repayments transfer USDC without reducing principal. The borrower cannot close the position normally and cannot withdraw all collateral; their only escape is liquidation or a contract upgrade.
-- **Cause:** `debtOf()` rounds scaled principal down to debt units, then `repay()` independently rounds the debt payment down when converting it back to scaled principal. The full-repayment branch is not distinguished from partial repayment.
-- **Fix:** When `amount >= debt`, collect exactly `debt` and set `principalOf[onBehalfOf] = 0`. For partial repayments, define explicit rounding direction and reject a payment whose scaled reduction is zero. Add invariant tests that a full repayment always clears principal and that every accepted partial repayment reduces debt.
-
-## [MEDIUM] LEND-04 — Anyone can permanently gas-grief the keeper's bulk liquidation path for free
-
-- **Contract / function:** `LendingMarket.sol`, `_borrow()` and `liquidateAll()`
-- **Impact:** An attacker can call `borrow(0)` from arbitrarily many addresses. Each call appends the address to `borrowers` because its principal remains zero. Entries are never removed, and addresses can also be appended again after repayment or liquidation. The attacker pays no USDC and posts no collateral, yet can grow the array until `liquidateAll()` cannot fit in a block. Following a sharp price move, the documented keeper sweep becomes unusable, increasing the chance that positions remain underwater and turn into bad debt. Individual liquidations remain possible, but the intended crisis-response mechanism is lost.
-- **Cause:** `_borrow()` accepts zero and appends whenever current principal is zero; `liquidateAll()` performs an unbounded iteration over an append-only array.
-- **Fix:** Reject zero-value borrows, track membership separately, remove borrowers on closure, and replace the all-at-once sweep with bounded pagination (`start`, `maxCount`) or off-chain discovery plus individual liquidations. Set a meaningful minimum debt size so liquidation rewards cover Arbitrum execution costs.
-
-## [MEDIUM] LEND-05 — Deeply underwater positions have no economically viable liquidation path
-
-- **Contract / function:** `LendingMarket.sol`, `_liquidate()`
-- **Impact:** A liquidator must repay 100% of a user's debt before receiving collateral. If a fast oracle update or accrued interest makes the remaining collateral worth less than the debt, liquidation guarantees a loss: the liquidator pays the full debt and receives at most all collateral. Rational liquidators will leave the position untouched, so the treasury retains uncollectible debt and the account remains open indefinitely. Requiring the full debt also makes large liquidations unnecessarily capital-intensive.
-- **Cause:** Liquidation has no close factor, partial-repayment parameter, bad-debt settlement, or reserve/insurance backstop. The nominal 5% bonus cannot help once collateral value is below debt value.
-- **Fix:** Implement partial liquidation with a caller-specified repay amount and minimum collateral-out protection. Cap the bonus to available collateral, explicitly recognize residual bad debt, and fund a reserve/insurance mechanism able to settle it. Add simulations for abrupt 50%+ collateral moves and define who absorbs insolvency.
-
-## [MEDIUM] LEND-06 — USDC downtime accrues debt while repayment and liquidation are impossible
-
-- **Contract / function:** `LendingMarket.sol`, `accrueInterest()`, `repay()`, and `liquidate()`
-- **Impact:** Native USDC on Arbitrum is centrally pausable. While it is paused, borrowers cannot transfer USDC into the market to repay and liquidators cannot fund liquidations, but interest continues to advance by elapsed blocks. When transfers resume, borrowers that crossed the threshold during the outage can be liquidated immediately by bots before they have a practical chance to repay. Users lose collateral because of an external pause they could not defend against.
-- **Cause:** There is no market pause/emergency accounting mode and no post-resumption grace period; interest is calculated purely from elapsed blocks at the next state change.
-- **Fix:** Add a narrowly scoped emergency mode that freezes borrowing and interest/liquidation eligibility while the debt token is unavailable, while preserving safe collateral additions where possible. On resumption, provide a bounded repayment grace period before liquidation. Document governance controls and test pause/resume scenarios against a pausable USDC mock.
-
-## Notes on prospective collateral
-
-The README proposes weETH, ezETH, USDT, and later rebasing/yield-bearing assets. Do not treat wrappers as 1:1 with their underlying assets: each listing needs an independent market-price path or an explicitly validated wrapper conversion plus underlying feed. The current vault's nominal-balance accounting is also not suitable for rebasing tokens without an adapter/share-accounting layer. These are listing requirements rather than launch findings because those assets are not yet enabled.
diff --git a/findings-oracles.md b/findings-oracles.md
deleted file mode 100644
index b0fe4017335ba20b5f607c148aa9772be1ee7121..0000000000000000000000000000000000000000
--- a/findings-oracles.md
+++ /dev/null
@@ -1,42 +0,0 @@
-# Oracle and Pricing Findings
-
-## [CRITICAL] Anyone can replace the market oracle and drain all seeded USDC
-
-- **Contract / function:** `LendingMarket.setOracle()` (`src/LendingMarket.sol:91-94`)
-- **What happens:** `setOracle` has no access control. An attacker can deploy an oracle that reports an arbitrarily large collateral price (and a normal or tiny USDC price), call `setOracle`, deposit a trivial amount of wstETH, and borrow the market's entire seeded USDC balance. The same primitive can make every existing account appear underwater and let the attacker liquidate users at attacker-chosen prices. The attacker receives the treasury's USDC and/or users' collateral; the protocol is left with bad debt.
-- **Recommended fix:** Add `onlyOwner` (preferably a timelocked governance role) to `setOracle`. Validate that the new address is nonzero and contains code. Use a two-step/timelocked oracle change with an emergency pause, and test the candidate oracle for every listed collateral and the debt asset before activation.
-
-## [HIGH] wstETH is priced as one stETH, overpaying liquidators in wstETH
-
-- **Contract / function:** Launch feed configuration consumed by `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `LendingMarket._liquidate()` (`src/PriceOracle.sol:39-45`, `src/LendingMarket.sol:132-138, 209-230`)
-- **What happens:** The README maps wstETH (`0x5979...0529`) directly to the stETH/USD feed (`0x07C5...f2a`). One wstETH represents more than one stETH because staking rewards accumulate in its conversion rate. The market therefore treats `1 wstETH == 1 stETH`. This understates users' collateral value, makes them borrow less than intended and become liquidatable prematurely. More importantly, liquidation computes the number of wstETH to seize by dividing a USD claim by the stETH price. A liquidator receives `(1 + bonus)` worth of **stETH units** as wstETH units, whose real value is higher by the wstETH/stETH exchange rate. Thus a liquidator extracts more than the configured 5% bonus from the unlucky borrower; the excess grows as staking rewards accumulate.
-- **Recommended fix:** Price wstETH itself. Compose a manipulation-resistant wstETH/stETH conversion rate with the stETH/USD feed (with independent freshness and validity checks), or use an appropriate dedicated wstETH/USD route. Unit-test both collateral valuation and seized-token amounts against the live conversion rate; never map wstETH directly to stETH/USD at 1:1.
-
-## [HIGH] Prices have no round-validity or freshness checks
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:39-45`)
-- **What happens:** The oracle calls deprecated `latestAnswer()` and cannot inspect `updatedAt`, `roundId`, `answeredInRound`, or `startedAt`. If either feed stops updating, all borrowing and liquidation continue indefinitely at the last price. An attacker can borrow excessive USDC against collateral whose market value has already fallen, leaving bad debt; in the reverse direction, users can be liquidated using an obsolete low collateral price or high USDC price. A deprecated/disabled feed can also brick every price-dependent operation.
-- **Recommended fix:** Use `latestRoundData()` and require `answer > 0`, `startedAt != 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Store a per-feed maximum age based on that feed's Arbitrum heartbeat/deviation policy, rather than one global threshold. Add a controlled pause/fallback process for an unavailable or deprecated feed.
-
-## [MEDIUM] Arbitrum sequencer outages are not checked and no recovery grace period is enforced
-
-- **Contract / function:** `PriceOracle.getPrice()` and all price-dependent borrow/liquidation paths (`src/PriceOracle.sol:39-45`)
-- **What happens:** The deployment target is Arbitrum One, but the oracle never checks Chainlink's Arbitrum sequencer uptime feed. After the sequencer recovers, market transactions may execute before asset feeds have caught up. A borrower can exploit a pre-outage high collateral price to take USDC that is no longer adequately collateralized; a liquidator can exploit a pre-outage low price to seize collateral from a position that is healthy at current prices. Users or the treasury bear the difference.
-- **Recommended fix:** Before accepting any asset price, query the Arbitrum sequencer uptime feed, require the sequencer status to be up, validate its round data, and require at least a one-hour grace period since recovery. Apply this check consistently to borrow, withdraw-health checks, and liquidation.
-
-## [MEDIUM] Feed answers are not protected against zero, negative, or circuit-breaker values
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:39-45`), consumed by `LendingMarket.healthFactor()` and `_liquidate()`
-- **What happens:** A zero USDC/USD answer makes every debt position appear to have zero USD debt, so `healthFactor` returns the maximum value and an attacker with minimal collateral can borrow all available USDC. A zero collateral answer makes liquidation revert when `_liquidate` divides by `price`, preventing bad-debt containment. A negative answer is cast to `uint256` and generally causes arithmetic overflow/reverts for the configured 8-decimal feeds, globally denying borrow, withdraw, and liquidation. Finally, no check rejects a Chainlink aggregator's `minAnswer`/`maxAnswer`; in an extreme crash a floored collateral price can remain above the true market price and permit undercollateralized borrowing.
-- **Recommended fix:** Explicitly reject `answer <= 0`. For each feed, evaluate the underlying aggregator's configured bounds and reject boundary answers, or install independent conservative price/deviation circuit breakers and pause affected actions. Handle invalid values by pausing new borrowing while preserving safe repayment/emergency-resolution paths.
-
-## [LOW] Feeds with more than 18 decimals permanently revert price queries
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:44`)
-- **What happens:** Normalization evaluates `18 - feed.decimals()`. Any future feed with more than 18 decimals underflows and reverts. Because governance plans to list more assets, a mistaken feed selection can make valuation, withdrawals, borrowing, and liquidation revert for users exposed to that asset. Users gain nothing and can have positions stuck until governance repairs the feed.
-- **Recommended fix:** Normalize in both directions: multiply when decimals are below 18 and divide when above 18. Reject unreasonable decimal values during `setFeed`, and perform a successful validated price read before a collateral can be listed.
-
-## Oracle-specific notes
-
-- The configured addresses currently identify themselves on Arbitrum as `STETH / USD` and `USDC / USD`, both with 8 decimals. Dynamic decimal reads are therefore correct for the two launch feeds, but the wstETH denomination mismatch remains.
-- USDC is not hardcoded to USD parity; using USDC/USD is the correct direction. No TWAP, Pyth, LP-token pricing, or VRF path exists in the reviewed code.
diff --git a/findings-precision.md b/findings-precision.md
deleted file mode 100644
index de4c727d49c86b2c4e9bc1655e88fc66475df5c0..0000000000000000000000000000000000000000
--- a/findings-precision.md
+++ /dev/null
@@ -1,39 +0,0 @@
-## [P-1] Division before multiplication makes healthy positions liquidatable below 200% collateralization
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:145`)
-**Description**: The expression `(collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS` divides the two 18-decimal USD values before applying the WAD scale. This truncates every collateral-to-debt ratio between 1.0 and 1.999... to exactly 1. With the configured 80% threshold, such a position is reported at a health factor of 0.8 even when its intended health factor is as high as almost 1.6. Consequently, the implementation effectively requires 200% collateralization rather than 125% and allows liquidation of positions that are solvent under the documented parameters. A liquidator can pay the borrower's debt and receive collateral plus the 5% bonus; the borrower loses that bonus and is forcibly closed solely because of the precision error.
-**Proof of Concept**: A user has $1,500 of collateral and $1,000 of debt. The intended health factor is `1500e18 * 8000 * 1e18 / (1000e18 * 10000) = 1.2e18`, so the position is healthy. The implementation first evaluates `1500e18 / 1000e18` as `1`, then returns `1 * 8000 * 1e18 / 10000 = 0.8e18`. Any account can therefore call `liquidate(user)` and collect the configured liquidation bonus from this healthy borrower.
-**Recommendation**: Multiply before dividing, ideally with a full-precision `mulDiv`: `return Math.mulDiv(collateralValueUsd(user), liquidationThreshold * WAD, debtUsd * BPS);`. If bounds make the combined denominator unsafe, perform two full-precision operations while preserving the WAD scale and document the chosen rounding direction. Add boundary tests at exactly 125%, immediately above it, and immediately below it.
-
-## [P-2] Rounding borrow principal down permits uncollateralized micro-borrows that drain treasury liquidity
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`)
-**Description**: `_borrow()` credits principal with `amount * WAD / borrowIndex`, rounding down, but transfers the full requested USDC amount. As soon as interest has accrued and `borrowIndex > WAD`, borrowing one base unit of USDC records zero principal. Since `debtOf()` is then zero, `healthFactor()` returns `type(uint256).max`; the borrower needs no collateral. The attacker can repeat or batch this call, receiving treasury USDC each time while accruing no debt. The same rounding loss also undercharges larger repeated borrows by up to one principal unit per call.
-**Proof of Concept**: Wait until at least one block after initialization and call `accrueInterest()`, which makes `borrowIndex` greater than `1e18` at the nonzero configured rate. From an address with no collateral, call `borrow(1)` (one micro-USDC). The principal increment is `1 * 1e18 / borrowIndex = 0`; the health check sees no debt and passes; one USDC base unit is transferred. An attacker contract can loop this operation until the market's prefunded balance is exhausted (subject only to transaction gas and available liquidity).
-**Recommendation**: Round debt shares/principal up when borrowing, for example `principalDelta = Math.mulDiv(amount, WAD, borrowIndex, Math.Rounding.Ceil)`, and require `principalDelta != 0`. Use the exact rounded-up delta consistently for accounting. Add invariant tests asserting that every successful positive borrow increases `debtOf(borrower)` by at least the transferred amount and that an uncollateralized account can never receive debt assets.
-
-## [P-3] Full repayment rounds principal reduction down and leaves an irreducible debt residue
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket.repay()` (`src/LendingMarket.sol:170`)
-**Description**: Repayment reduces principal by `amount * WAD / borrowIndex`, rounded down. Even when `amount` equals the entire value returned by `debtOf()`, the inverse conversion commonly leaves one principal unit. Once the residue is small enough that `amount * WAD / borrowIndex == 0`, later repayments transfer USDC but do not reduce principal at all. Because `amount` is capped to the rounded-down `debt`, the user cannot overpay by one unit to clear it. A nonzero debt prevents the borrower from withdrawing all collateral, leaving collateral locked until an upgrade or a very long period of additional index growth; repeated attempts also directly lose the transferred USDC.
-**Proof of Concept**: Let `principalOf[user] = 1,000,000` and `borrowIndex = 1.0000001e18`. `debtOf(user)` rounds to `1,000,000`. Calling `repay(user, 1,000,000)` transfers that full amount but subtracts only `floor(1,000,000e18 / 1.0000001e18) = 999,999`, leaving principal `1`. `debtOf(user)` remains `1`, but another repayment of `1` subtracts `floor(1e18 / 1.0000001e18) = 0`; the residue cannot be cleared through `repay()` and a complete collateral withdrawal fails the health check.
-**Recommendation**: Special-case full repayment: after collecting `debt`, set `principalOf[onBehalfOf] = 0`. For partial repayments, choose and document protocol-favoring rounding and reject any positive payment whose calculated principal reduction is zero. A robust pattern is to calculate the principal reduction first, cap it to stored principal, derive the exact asset amount from that reduction with consistent rounding, and only then transfer funds.
-
-## [P-4] Liquidation charges for value that rounding does not seize
-**Severity**: Low
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)
-**Description**: The collateral amount `takeUsd * unit / price` rounds down, but `seizeUsd` is reduced by the full unrounded `takeUsd`. Thus the liquidator can receive slightly less collateral value than the accounting treats as seized. The shortfall is less than one smallest unit of each collateral token, which is negligible for launch wstETH but becomes material for a future low-decimal, high-price collateral. If `takeUsd < price / unit`, the seizure rounds to zero while the entire `takeUsd` is still discarded. This rounding favors the borrower at the liquidator's expense and can make marginal liquidations unattractive.
-**Proof of Concept**: For a listed token with `unit = 1e6`, `price = 3e18`, and `takeUsd = 2e12`, the calculated collateral amount is `2e12 * 1e6 / 3e18 = 0`. The vault transfers no collateral, yet `_liquidate()` subtracts the full `2e12` from `seizeUsd`; the liquidator has paid debt corresponding to that value without compensation.
-**Recommendation**: Choose a liquidation rounding policy explicitly. To deliver at least the promised seizure value, calculate token units with full-precision rounding up, capped by the user's balance, and reduce `seizeUsd` by the actual USD value of the units seized. Alternatively, round down but carry the unfilled remainder into the next collateral instead of discarding it. Enforce decimal and minimum-unit constraints when listing collateral.
-
-## [P-5] Feeds with more than 18 decimals permanently revert price conversion
-**Severity**: Low
-**Category**: evm-audit-precision-math
-**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)
-**Description**: Price normalization computes `10 ** (18 - feed.decimals())`. If governance configures a feed whose decimals exceed 18, the subtraction underflows and every price-dependent borrow, withdrawal-health check, and liquidation reverts for that token. The launch feeds are expected to use at most 18 decimals, so this is a latent listing/configuration hazard rather than a current exploit.
-**Proof of Concept**: Set a token's feed to an aggregator returning `decimals() == 19`, then call `getPrice(token)`. Evaluation of `18 - 19` reverts under Solidity 0.8 arithmetic. Any market path that values the token consequently reverts.
-**Recommendation**: Validate feed decimals in `setFeed()` and either reject values above a supported bound or normalize both directions: multiply when `feedDecimals <= 18` and divide when `feedDecimals > 18`, with explicit rounding and overflow bounds. Cache validated feed metadata at configuration time.
diff --git a/findings-proxies.md b/findings-proxies.md
deleted file mode 100644
index 9f6fa308ce2549c4d5250aee9af3037ccf598234..0000000000000000000000000000000000000000
--- a/findings-proxies.md
+++ /dev/null
@@ -1,23 +0,0 @@
-## [P-1] Anyone can replace the market implementation and steal all treasury liquidity
-**Severity**: Critical
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo()` writes an arbitrary address directly to the ERC-1967 implementation slot without `onlyOwner` (or any other authorization). Because calls execute through `MarketProxy` by `delegatecall`, any account can replace all market logic while retaining the proxy's storage and token balances. An attacker can install logic that transfers the proxy's entire USDC balance to themselves, rewrite every position, or permanently disable the market. The attacker directly receives all treasury-seeded USDC held by the proxy; borrowers and the treasury lose access to the legitimate market state.
-**Proof of Concept**: (1) Deploy a contract with a function such as `drain(IERC20 token)` that calls `token.transfer(msg.sender, token.balanceOf(address(this)))`. (2) Call `LendingMarket(proxy).upgradeTo(address(maliciousImplementation))`; the call succeeds for any sender and overwrites the proxy's implementation slot. (3) Call `drain(USDC)` through the proxy. The malicious implementation executes in proxy context and transfers the proxy's full USDC balance to the attacker.
-**Recommendation**: Restrict upgrades to a deliberately secured authority (`onlyOwner`, preferably a timelocked multisig) and use a reviewed UUPS implementation such as OpenZeppelin `UUPSUpgradeable`, including `_authorizeUpgrade`. Add upgrade-event monitoring and operational upgrade tests.
-
-## [P-2] Optional initialization lets the first caller seize an uninitialized deployment
-**Severity**: High
-**Category**: evm-audit-proxies
-**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`) and `LendingMarket.initialize()` (`src/LendingMarket.sol:56`)
-**Description**: The proxy accepts empty `initData`, while `initialize()` is externally callable by anyone exactly once and accepts an attacker-selected owner, oracle, vault, and debt asset. No deployment script exists in the repository to establish that deployment and initialization will be atomic. If the proxy is deployed with empty data (or initialization is otherwise deferred), a mempool observer can initialize it first. The attacker becomes owner and permanently installs attacker-controlled dependencies. Once the treasury seeds the advertised proxy—or if seeding and setup are bundled later—the attacker can control listings and use the malicious dependencies to compromise or deny the market. This requires the specific deployment mistake of non-atomic initialization, but then permanently compromises the deployment.
-**Proof of Concept**: (1) Deploy `MarketProxy(implementation, "")`. (2) Before the deployer initializes it, an attacker calls `initialize(attacker, attackerOracle, attackerVault, USDC)` through the proxy. (3) The intended initializer now reverts with `AlreadyInitialized()`. The proxy is permanently configured with attacker-selected ownership and core dependencies unless it is abandoned or upgraded; in the current code the attacker can also exploit the unrestricted upgrade path in P-1 immediately.
-**Recommendation**: Require non-empty initialization calldata in the proxy constructor and atomically delegatecall `initialize` as part of deployment. Validate every initialization address as nonzero and, where appropriate, verify deployed code. Make the deployment script pass the exact encoded initializer and assert all resulting state before funding the proxy. Also lock the standalone implementation against direct initialization (for example with OpenZeppelin `Initializable` and `_disableInitializers()`), although direct initialization alone does not control this custom proxy.
-
-## [P-3] Upgrades do not verify that the replacement is code-compatible, so one bad upgrade can be irreversible
-**Severity**: Medium
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`) and `MarketProxy.fallback()` (`src/MarketProxy.sol:26`)
-**Description**: `upgradeTo()` accepts zero addresses, EOAs, and arbitrary contracts without checking code presence or ERC-1967/UUPS compatibility. All upgrade logic lives in the current implementation and the proxy has no independent admin recovery function. Consequently, setting the slot to an address without a working compatible `upgradeTo()` removes the only route to another implementation. Calls to an EOA can misleadingly return success with empty returndata, while the market is permanently unusable. After P-1 is fixed, an authorized operator typo or an incompatible release can still permanently strand the market and its state; users may be unable to borrow, repay, or liquidate, and treasury USDC may be stuck.
-**Proof of Concept**: Call `upgradeTo(address(0x1234))`, where `0x1234` has no code. The slot update succeeds. Subsequent proxy calls delegatecall an address with no code and return empty data. Because that address exposes no upgrade function and `MarketProxy` exposes no admin upgrade path, another implementation cannot be installed through the proxy.
-**Recommendation**: Adopt a standard UUPS implementation that checks `proxiableUUID()` against the ERC-1967 slot before changing implementations, reject `address(0)` and addresses with `code.length == 0`, and test upgrade compatibility/storage layout before execution. Alternatively, move a tightly controlled recovery/upgrade path into a standard transparent proxy. These checks supplement, not replace, the authorization required by P-1.
diff --git a/findings-signatures.md b/findings-signatures.md
deleted file mode 100644
index bec634a866bc1de191f358960f56ce19dd89353c..0000000000000000000000000000000000000000
--- a/findings-signatures.md
+++ /dev/null
@@ -1,31 +0,0 @@
-## [SIG-1] Anyone can replace the market implementation and take all protocol assets
-**Severity**: Critical
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo` has no `onlyOwner` (or other authorization) check and writes an arbitrary address directly to the ERC-1967 implementation slot. Because calls arrive through `MarketProxy`, any account can make the proxy delegate all future calls to attacker-controlled code. The replacement code executes in the proxy's context, which is also the immutable `market` authorized by `CollateralVault`. An attacker can therefore transfer the market's seeded USDC and invoke `CollateralVault.seize()` for every depositor. There is also no code-size or UUPS compatibility check, so even an accidental call can permanently brick the market.
-**Proof of Concept**: (1) Deploy an implementation exposing a function that transfers the proxy's full USDC balance to the attacker and calls `vault.seize(victim, token, attacker, amount)`. (2) Call `MarketProxy.upgradeTo(attackerImplementation)` from any EOA; the fallback delegates to the current `LendingMarket`, which stores the supplied address without checking the caller. (3) Call the malicious drain function through the proxy. The attacker receives the treasury's USDC and all collateral held for users.
-**Recommendation**: Add `onlyOwner` to the upgrade entry point, validate `newImplementation.code.length != 0`, and use a reviewed UUPS implementation (including `onlyProxy`, `proxiableUUID`, and `_authorizeUpgrade`) or a standard transparent proxy. Put upgrade authority behind a multisig/timelock and test that direct implementation calls and incompatible implementations revert.
-
-## [SIG-2] Reusable borrow signatures let any holder repeatedly increase a user's debt
-**Severity**: High
-**Category**: evm-audit-signatures
-**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)
-**Description**: The signed `Borrow(address borrower,uint256 amount)` struct contains neither a nonce nor a deadline, and the contract does not mark a digest as consumed. A signature is therefore valid forever and can be submitted repeatedly by anyone. Each submission adds `amount` to `principalOf[borrower]` until the health check reaches its limit. Although borrowed USDC is sent to the signer rather than the submitter, a leaked or previously relayed signature lets a griefer force the signer into unintended leverage and liquidation exposure. The unlucky signer receives additional USDC, but also incurs matching debt and can lose collateral plus the 5% liquidation bonus after a price move; the attacker can later act as liquidator and collect that bonus.
-**Proof of Concept**: (1) Alice deposits enough wstETH and signs one request to borrow 1,000 USDC. (2) A relayer submits that exact `(borrower, amount, v, r, s)` multiple times. (3) Every call recovers Alice and `_borrow` increases her principal again; nothing consumes the authorization. (4) Once Alice is close to the threshold, an adverse price move makes her liquidatable and a liquidator takes collateral including the configured bonus.
-**Recommendation**: Sign and consume a per-borrower nonce and include an expiration, for example `Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)`. Require `block.timestamp <= deadline`, increment `nonces[borrower]` before `_borrow`, and use OpenZeppelin `EIP712` plus `ECDSA.recover`. If arbitrary relayers are not a product requirement, additionally bind the intended submitter or require `msg.sender == borrower`.
-
-## [SIG-3] Cached EIP-712 domain remains tied to the initialization chain ID
-**Severity**: Low
-**Category**: evm-audit-signatures
-**Location**: `LendingMarket.initialize()` and `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:56`, `src/LendingMarket.sol:162`)
-**Description**: `domainSeparator` is computed once during initialization and never recomputed if `block.chainid` changes. Following a chain-ID-changing fork or migration, the contract continues accepting signatures made for the old domain while wallets correctly produce signatures for the new chain ID that the contract rejects. Coupled with the absence of nonces, old signed borrows remain usable on the forked deployment. This is a latent fork/migration failure rather than a current Arbitrum One theft path.
-**Proof of Concept**: Initialize when `block.chainid == A`, then execute the same state on a chain whose ID is `B`. `domainSeparator` still embeds `A`. A digest signed against domain `A` continues to recover, while a standards-compliant signature created against `B` fails with `BadSignature`.
-**Recommendation**: Use OpenZeppelin's upgradeable `EIP712` implementation and `_hashTypedDataV4`, which derives the separator for the active chain and proxy address. Alternatively cache both the initial chain ID and separator and recompute the separator whenever `block.chainid` differs.
-
-## [SIG-4] Two sensitive risk controls are callable by anyone
-**Severity**: Critical
-**Category**: evm-audit-access-control
-**Location**: `LendingMarket.setOracle()` and `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:91`, `src/LendingMarket.sol:96`)
-**Description**: Both setters omit `onlyOwner`. Any account can replace the trusted oracle or arbitrarily change the collateral threshold. An attacker can install a malicious `PriceOracle`-compatible contract that reports enormous collateral prices, deposit a negligible amount of a listed token, and borrow the entire USDC treasury. Alternatively, manipulating the threshold/oracle can make healthy users liquidatable; the caller can liquidate them and receive their collateral plus the bonus.
-**Proof of Concept**: (1) Deploy a contract whose `getPrice(collateral)` returns an enormous value and whose `getPrice(debtAsset)` returns a small positive value. (2) Call `setOracle` through the proxy from any EOA. (3) Deposit a trivial amount of listed collateral and call `borrow` for the proxy's full USDC balance. The forged health factor passes and the attacker receives all seeded USDC. No owner key or prior protocol state is required.
-**Recommendation**: Add `onlyOwner` to both setters. Validate nonzero contract addresses and sensible threshold bounds (at minimum `bps <= BPS`, with governance-approved lower/upper limits). Prefer a multisig plus timelock for oracle and risk changes, with an emergency pause mechanism for compromised feeds.

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..66627d77d88afa76bc10573ba7dd2b9d0f5f0042
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,208 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-03  
+**Scope:** `README.md`, `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Target:** Arbitrum One; native USDC debt; wstETH launch collateral  
+**Result:** **Do not deploy in the current state.**
+
+## Executive summary
+
+The review found **2 Critical, 8 High, 7 Medium, and 4 Low** issues. The two Critical issues independently let any caller take control of pricing or implementation logic and steal the treasury-funded USDC and deposited collateral. The public liquidation-threshold setter is another immediate launch blocker. Even after access control is repaired, the health-factor formula incorrectly liquidates solvent borrowers, the proposed wstETH feed values the wrong unit, and stale oracle data is accepted.
+
+Fix order for Monday:
+
+1. Lock down upgrades, oracle replacement, and risk parameters; require atomic initialization.
+2. Correct health, wstETH pricing, oracle validation, interest realization on withdrawal, and full-repayment rounding.
+3. Add adversarial tests for borrowing, repayment, withdrawal, liquidation, oracle outages, and upgrades before funding the proxy.
+4. Address the Medium issues before launch. Do not list weETH, ezETH, USDT, fee-on-transfer, callback-capable, or rebasing assets until asset-specific adapters and accounting are implemented.
+
+This was a source review plus successful `forge build`; the repository has no test suite. No deployment scripts were present, so initialization safety and on-chain configuration could not be verified.
+
+## Findings
+
+## [C-01] Anyone can replace the implementation and drain the market and vault
+**Severity**: Critical  
+**Category**: Access control / proxy  
+**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)  
+**Description**: `upgradeTo()` has no authorization and writes an arbitrary address to the ERC-1967 implementation slot. Malicious logic then executes in the proxy context. Because the proxy holds seeded USDC and is the immutable `market` trusted by `CollateralVault`, the replacement can transfer all USDC and call `vault.seize()` for every depositor. The attacker receives all funded liquidity and deposited collateral.  
+**Proof of Concept**: Deploy logic with a drain function, call `upgradeTo(malicious)` through the proxy, then call the drain through the proxy. The new logic can transfer the proxy's USDC and invoke the vault as its trusted market.  
+**Recommendation**: Use a reviewed UUPS or transparent proxy implementation. Restrict upgrades to a timelocked multisig, validate code and `proxiableUUID`, and test storage compatibility and rollback/recovery procedures.
+
+## [C-02] Anyone can replace the oracle and steal all seeded USDC
+**Severity**: Critical  
+**Category**: Access control / oracle  
+**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)  
+**Description**: `setOracle()` has no `onlyOwner`. An attacker can report an enormous collateral price and a tiny positive USDC price, borrow the complete USDC balance against dust, and leave unrecoverable debt. The same control can fabricate unhealthy positions and extract users' collateral as liquidator.  
+**Proof of Concept**: Deposit dust wstETH, install an attacker oracle, return a huge wstETH price and small USDC price, then borrow the proxy's entire USDC balance.  
+**Recommendation**: Add access control, validate that the new oracle is a contract supporting every active asset, and place oracle changes behind a timelock/multisig with a pause and two-step activation process.
+
+## [H-01] Anyone can force liquidations by changing the liquidation threshold
+**Severity**: High  
+**Category**: Access control / risk parameters  
+**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)  
+**Description**: Any caller can set the threshold to any value. Setting it to zero makes every debtor unhealthy. The caller can then repay selected debts and receive borrowers' collateral plus the 5% bonus; unlucky borrowers lose the bonus and their positions are forcibly closed. Unbounded high values also allow governance parameters to be bypassed and can cause arithmetic reverts.  
+**Proof of Concept**: Call `setLiquidationThreshold(0)`, then call `liquidate(user)` for an otherwise healthy borrower after approving USDC.  
+**Recommendation**: Add `onlyOwner`, require `0 < bps && bps <= BPS`, use a timelocked risk role, and pause borrowing around material parameter changes.
+
+## [H-02] Division before multiplication makes solvent positions liquidatable
+**Severity**: High  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:146`)  
+**Description**: `collateralValueUsd / debtUsd` truncates before applying WAD precision. At the configured 80% threshold, every collateral ratio from 100% to just under 200% produces a health factor of `0.8e18`. A borrower with $1,500 collateral and $1,000 debt should have a 1.2 health factor but is liquidatable. A liquidator receives $1,050 of collateral; the solvent borrower loses $50 and is forcibly closed.  
+**Proof of Concept**: For `$1,500e18 / $1,000e18`, the contract first obtains `1`, then returns `1 * 8000 * 1e18 / 10000 = 0.8e18`.  
+**Recommendation**: Use full-precision multiplication before division, e.g. `mulDiv(collateralUsd, liquidationThreshold * WAD, debtUsd * BPS)`, with explicit rounding. Test immediately below, at, and above 125% collateralization.
+
+## [H-03] The stETH/USD feed prices wstETH as if it were one stETH
+**Severity**: High  
+**Category**: Oracle / asset integration  
+**Location**: launch configuration in `README.md`; `LendingMarket.collateralValueUsd()` and `_liquidate()` (`src/LendingMarket.sol:132`, `src/LendingMarket.sol:209`)  
+**Description**: One wstETH represents a changing amount greater than one stETH. Applying the stETH/USD feed directly to raw wstETH units undervalues collateral and transfers too many wstETH during liquidation. If one wstETH represents 1.20 stETH, a nominal 5% liquidation premium becomes approximately 26% in underlying-value terms. The liquidator receives the excess from the borrower.  
+**Proof of Concept**: At a $1,900 stETH price, a $1,050 seizure transfers about 0.5526 wstETH. At 1.20 stETH per wstETH, that collateral is actually worth about $1,260.  
+**Recommendation**: Use a maintained wstETH/USD feed or compose stETH/USD with the canonical `stEthPerToken()` conversion. Validate freshness and units at both legs. Require equivalent asset-specific adapters for weETH and ezETH.
+
+## [H-04] Stale or incomplete Chainlink rounds are accepted indefinitely
+**Severity**: High  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Deprecated `latestAnswer()` exposes no timestamp or round metadata. After a feed stops updating, borrowers can take too much USDC against a fallen collateral price, leaving treasury bad debt, or liquidators can seize collateral using an obsolete adverse price.  
+**Proof of Concept**: If wstETH falls while its feed remains at the old high value, deposit/retain collateral and borrow against the stale value before updates resume.  
+**Recommendation**: Use `latestRoundData()` and require positive answers, nonzero timestamps, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Configure maximum age per feed and define a safe pause/fallback response.
+
+## [H-05] Withdrawals check debt before realizing accrued interest
+**Severity**: High  
+**Category**: Lending accounting  
+**Location**: `CollateralVault.withdraw()` and `LendingMarket.requireHealthy()` (`src/CollateralVault.sol:44`, `src/LendingMarket.sol:153`)  
+**Description**: Withdrawal calls a view-only health check without first calling `accrueInterest()`. After inactivity, a borrower can withdraw collateral based on the old index; the next accrual makes the remaining position undercollateralized. The user receives collateral that should secure the debt, while the treasury can be left with bad debt.  
+**Proof of Concept**: Borrow at the maximum permitted boundary, wait without any market state-changing call, then withdraw collateral while `borrowIndex` is stale. Call `accrueInterest()` afterward; the updated debt exceeds the remaining collateral limit.  
+**Recommendation**: Route withdrawals through the market or expose an authenticated market hook that accrues before the vault changes balances. Check health using a preview index that includes elapsed interest, and test long idle periods.
+
+## [H-06] A displayed full repayment can leave permanent debt dust and lock collateral
+**Severity**: High  
+**Category**: Precision / debt accounting  
+**Location**: `LendingMarket.repay()` and `debtOf()` (`src/LendingMarket.sol:128`, `src/LendingMarket.sol:170`)  
+**Description**: Debt and repayment conversions both round down. Paying the full displayed debt can leave one scaled-principal unit. Once `amount * WAD / borrowIndex` rounds to zero, further payments transfer USDC but reduce no principal, and the amount cap prevents overpayment. The borrower loses every attempted payment and cannot withdraw all collateral.  
+**Proof of Concept**: With principal `1,000,000` and index `1.0000001e18`, displayed debt is `1,000,000`; repayment subtracts only `999,999`, leaving principal `1`. Paying the remaining displayed unit subtracts zero forever.  
+**Recommendation**: If `amount >= debt`, collect exactly `debt` and set principal to zero. For partial repayments, compute the principal reduction first with documented rounding and reject a positive payment that reduces zero principal.
+
+## [H-07] Reusable borrow signatures can force a signer into repeated debt and liquidation
+**Severity**: High  
+**Category**: Signatures  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)  
+**Description**: The signed message has no nonce or deadline and is never consumed. Anyone observing one signature can replay it until the account reaches its borrowing limit, and can replay it again after repayment. Funds go to the signer, but an unaware signer can be pushed to the liquidation boundary; the replayer can later liquidate and receive the 5% collateral bonus.  
+**Proof of Concept**: Submit the same `(borrower, amount, v, r, s)` repeatedly. Every digest is identical and accepted. After the borrower repays, submit it again.  
+**Recommendation**: Sign and validate a per-borrower nonce, deadline, receiver/intended relayer, and amount; increment the nonce before borrowing. Use a standard EIP-712/ECDSA implementation that enforces low-`s` and valid `v`.
+
+## [H-08] Non-atomic proxy initialization permits deployment takeover
+**Severity**: High  
+**Category**: Proxy / deployment  
+**Location**: `MarketProxy.constructor()` and `LendingMarket.initialize()` (`src/MarketProxy.sol:10`, `src/LendingMarket.sol:56`)  
+**Description**: The proxy allows empty `initData`, and anyone may call `initialize()` once. If initialization is deferred, a mempool observer selects the owner, oracle, vault, and debt token. The legitimate initializer is permanently locked out and any later funding is exposed. No deployment script demonstrates atomic initialization.  
+**Proof of Concept**: Deploy the proxy with empty init data; before the deployer initializes, call `initialize(attacker, attackerOracle, attackerVault, token)`.  
+**Recommendation**: Require nonempty init data and atomically initialize in the proxy constructor. Validate all addresses, assert state before funding, and disable initializers on the standalone implementation.
+
+## [M-01] Arbitrum sequencer recovery is not checked
+**Severity**: Medium  
+**Category**: Oracle / Arbitrum  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: The oracle does not consult the Arbitrum sequencer uptime feed. Immediately after recovery, asset feeds may not yet be current. A borrower can receive excess USDC or a liquidator can receive collateral based on pre-outage prices.  
+**Proof of Concept**: Submit a borrow or liquidation immediately after sequencer recovery while the relevant asset round still predates the outage.  
+**Recommendation**: Validate the Arbitrum sequencer uptime feed and enforce a recovery grace period (commonly one hour) before using prices, in addition to per-feed freshness checks.
+
+## [M-02] Invalid oracle answers can bypass health checks or halt liquidation
+**Severity**: Medium  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Zero and negative answers are not rejected. A zero USDC price makes debt value zero and the health factor maximal, allowing treasury USDC to be borrowed with inadequate backing. A zero collateral price makes liquidation divide by zero; a negative answer casts to a huge unsigned integer and generally reverts downstream. Users or the treasury lose funds if an invalid answer is consumed; otherwise risk-reducing actions are blocked.  
+**Proof of Concept**: Return zero for USDC/USD and borrow while `debtValueUsd()` is zero, or return zero for collateral and observe `_liquidate()` revert at division by `price`.  
+**Recommendation**: Require `answer > 0`, valid round metadata, and reject/circuit-break implausible or aggregator-bound values. Pause new risk while preserving repayment and recovery paths.
+
+## [M-03] Nominal and unchecked token transfers can create unbacked collateral
+**Severity**: Medium  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()`, `withdraw()`, `seize()`; `LendingMarket.repay()`, `_borrow()`, `_liquidate()`  
+**Description**: Return values from every transfer are ignored, and deposits credit the requested amount rather than the received balance delta. The launch assets normally revert or return true, but a future fee-on-transfer or false-returning listed token lets an attacker receive inflated collateral credit and borrow real USDC. False-returning debt transfers can also cancel debt without payment after a future debt-asset change.  
+**Proof of Concept**: List a token whose `transferFrom` returns false or transfers 90%. Calling `deposit(100)` records 100 although the vault receives zero or 90; the caller borrows against the fictitious difference.  
+**Recommendation**: Use safe-transfer helpers. Credit the observed balance delta and, unless explicitly supported by an adapter, require it to equal the requested amount.
+
+## [M-04] Transfer-before-effects permits reentrant withdrawals for callback-capable collateral
+**Severity**: Medium  
+**Category**: Reentrancy / future listings  
+**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)  
+**Description**: The vault transfers before decrementing `balanceOf`. A callback-capable future token can reenter and make nested withdrawals observe the same old balance, withdrawing more assets than are charged and potentially leaving fictitious collateral for a USDC borrow. Launch wstETH does not expose such transfer callbacks, so this becomes exploitable when an unsafe token is listed.  
+**Proof of Concept**: Deposit a listed callback token, call `withdraw(X)`, and reenter `withdraw(X)` during its transfer hook. Both frames read the original balance and transfer `X`.  
+**Recommendation**: Apply checks-effects-interactions, decrement before the external call, and add a reentrancy guard. Explicitly prohibit callback tokens unless an adapter has been reviewed.
+
+## [M-05] The borrower array can permanently disable batch liquidation
+**Severity**: Medium  
+**Category**: Denial of service  
+**Location**: `LendingMarket._borrow()` and `liquidateAll()` (`src/LendingMarket.sol:190`, `src/LendingMarket.sol:197`)  
+**Description**: `borrow(0)` appends the caller whenever principal is zero; entries are never removed or deduplicated. An attacker spends gas but no assets to grow the array until `liquidateAll()` cannot fit in a block. During a price shock, keepers lose the documented sweep function and bad debt risk rises, although individual liquidation remains available.  
+**Proof of Concept**: Repeatedly call `borrow(0)`, then call `liquidateAll()` after enough entries exist; it runs out of gas.  
+**Recommendation**: Reject zero/dust borrowing, maintain unique membership, remove closed accounts, and replace the unbounded sweep with cursor-based bounded batches or off-chain discovery.
+
+## [M-06] Deeply underwater debt has no economically viable liquidation path
+**Severity**: Medium  
+**Category**: Liquidation design  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)  
+**Description**: A liquidator must pay 100% of debt before receiving at most the remaining collateral. If collateral value falls below debt, liquidation guarantees a loss, so rational liquidators leave the position open and the treasury retains bad debt. Large positions also require unnecessary up-front capital.  
+**Proof of Concept**: For $1,000 debt backed by collateral now worth $700, liquidation takes $1,000 USDC and can return only $700 of collateral.  
+**Recommendation**: Support caller-selected partial liquidation and minimum collateral output, cap seizure to available collateral, explicitly recognize residual bad debt, and define a reserve/insurance loss mechanism.
+
+## [M-07] Upgrades can accidentally and irreversibly brick the proxy
+**Severity**: Medium  
+**Category**: Proxy safety  
+**Location**: `LendingMarket.upgradeTo()` and `MarketProxy.fallback()` (`src/LendingMarket.sol:84`, `src/MarketProxy.sol:26`)  
+**Description**: No check rejects zero, an EOA, or an incompatible implementation. Because upgrade logic lives only in the implementation, one bad authorized upgrade can remove the only upgrade path and permanently strand positions and treasury USDC.  
+**Proof of Concept**: Upgrade to an EOA. Subsequent delegatecalls return empty data, and that address exposes no function that can restore the implementation.  
+**Recommendation**: Validate code and UUPS UUID, use a standard proxy design, run storage-layout and fork upgrade tests, and retain a deliberately governed recovery process.
+
+## [L-01] Debt shares are rounded down when borrowing
+**Severity**: Low  
+**Category**: Precision  
+**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`)  
+**Description**: `amount * WAD / borrowIndex` rounds debt shares down while transferring the full amount. Once the index exceeds WAD, a one-base-unit borrow records zero debt and passes without collateral. Repetition undercharges debt, but for six-decimal USDC the extractable amount per call is below one micro-USDC and is not economically profitable at normal gas costs.  
+**Proof of Concept**: After interest accrues, call `borrow(1)` with no collateral; the principal increment is zero while one base unit transfers.  
+**Recommendation**: Round debt shares up on borrowing and require a nonzero share delta and a sensible minimum borrow.
+
+## [L-02] Interest uses an imprecise Arbitrum block-to-time conversion
+**Severity**: Low  
+**Category**: Arbitrum / accounting  
+**Location**: `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:117`)  
+**Description**: Arbitrum's Solidity `block.number` approximates the L1 block number and advances in steps; multiplying it by a fixed 12 seconds is not reliable elapsed wall time. Borrowers or the treasury receive slightly incorrect interest, and accrual can jump after periods where the reported number does not advance.  
+**Proof of Concept**: Compare `blocksElapsed * 12` with `block.timestamp - lastAccrualTimestamp` across Arbitrum blocks; the values can differ and update at different cadence.  
+**Recommendation**: Store a timestamp and accrue from `block.timestamp - lastAccrualTimestamp`, with a reasonable maximum interval and tests for sequencer outages.
+
+## [L-03] Liquidation discards value lost to token-unit rounding
+**Severity**: Low  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:224`)  
+**Description**: Collateral units round down, but `seizeUsd` is reduced by the full unrounded value. The liquidator can receive slightly less than paid for; for a future low-decimal, high-price token, a nontrivial requested seizure can round to zero.  
+**Proof of Concept**: If `takeUsd * unit < price`, the seized token amount is zero although `takeUsd` is fully subtracted.  
+**Recommendation**: Reduce remaining seizure value by the actual value transferred, or round units up subject to the user's balance and a documented policy.
+
+## [L-04] Feed and token decimal assumptions can freeze an asset
+**Severity**: Low  
+**Category**: Configuration validation  
+**Location**: `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `_liquidate()`  
+**Description**: A feed with more than 18 decimals underflows `18 - decimals`; a token with sufficiently large decimals overflows `10 ** decimals`. Price-dependent borrow, withdrawal, and liquidation then revert, potentially trapping users after a bad future listing.  
+**Proof of Concept**: Configure a feed reporting 19 decimals or list a token reporting 78 decimals and call the relevant valuation function.  
+**Recommendation**: Validate and cache code presence and decimal ranges before listing. Normalize multiplication and division in both directions with full-precision math and provide a safe delisting/migration path.
+
+## Planned-collateral constraints
+
+- The current fixed-balance vault is unsafe for rebasing tokens: a negative rebase leaves fictitious balances and bad-debt capacity, while a positive rebase becomes unallocated. Use non-rebasing wrappers or share-based adapters.
+- weETH and ezETH require wrapper-specific exchange-rate and market-price handling; do not map either 1:1 to ETH/USD.
+- USDT and USDC can be paused or blocklisted. Define an emergency mode that stops new borrowing, handles interest fairly, and provides a post-recovery repayment grace period. Consider isolated markets so one frozen custody address does not affect unrelated assets.
+
+These are listing gates rather than separate launch findings because only wstETH collateral and USDC debt are currently intended to be enabled.
+
+## Verification priorities
+
+Before deployment, add unit, fuzz, invariant, and Arbitrum-fork tests covering:
+
+- only authorized upgrades and configuration; atomic initialization; incompatible upgrade rejection;
+- debt conservation across every borrow/repay sequence and exact full closure;
+- health-factor boundaries and withdrawal after long idle periods;
+- wstETH conversion, stale/invalid rounds, sequencer outage and recovery;
+- liquidation solvency, rounding, partial liquidation, slippage, and bad-debt handling;
+- zero values, unusual token behavior, callbacks, pauses, and all planned asset adapters.
diff --git a/findings-chain.md b/findings-chain.md
deleted file mode 100644
index 3082a2a277646a7d034774743452e922dab69f32..0000000000000000000000000000000000000000
--- a/findings-chain.md
+++ /dev/null
@@ -1,21 +0,0 @@
-## [CHAIN-1] Sequencer recovery permits borrowing and liquidation against stale prices
-**Severity**: High
-**Category**: evm-audit-chain-specific
-**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:34-41`), consumed by `LendingMarket._borrow()`, `LendingMarket.liquidate()`, and `LendingMarket._liquidate()`
-**Description**: The market is explicitly targeting Arbitrum One, but its Chainlink adapter calls `latestAnswer()` and performs no Arbitrum sequencer-uptime check, recovery grace period, or `updatedAt` freshness check. During a sequencer outage users cannot repay, add collateral, or liquidate. On recovery, the last published answer may predate a large off-chain price movement, while transactions can resume before a trustworthy post-recovery price has propagated. An attacker can deposit collateral whose stale answer is too high and borrow real USDC that the collateral no longer covers. Conversely, a stale-low answer can make an otherwise solvent borrower liquidatable; a liquidator receives that user's collateral and bonus before the price catches up. This is an Arbitrum-specific amplification of the missing freshness validation because the sequencer outage simultaneously prevents users and keepers from taking protective actions.
-**Proof of Concept**: (1) The Arbitrum sequencer becomes unavailable while wstETH falls materially in external markets. (2) The on-chain feed remains at its pre-outage value and users cannot transact. (3) Immediately after sequencing resumes, before the collateral feed publishes a fresh round, an attacker deposits wstETH and calls `borrow()`. `getPrice()` returns the old high answer, the health check passes, and the attacker receives more native USDC than their collateral can support at the current market price. The treasury is left with bad debt after the feed catches up. The reverse price movement permits premature liquidation of an existing borrower.
-**Recommendation**: Integrate Chainlink's Arbitrum sequencer uptime feed. Reject prices while the sequencer reports down and for a deliberately chosen grace period after it comes back up. Replace `latestAnswer()` with `latestRoundData()` and require a positive answer, a nonzero `updatedAt`, a completed round, and per-feed maximum age calibrated to that feed's Arbitrum heartbeat. During the outage and grace period, disable borrowing and liquidation while preserving risk-reducing actions where dependencies permit. Test outage, recovery, stale-round, and delayed-feed-update scenarios before launch.
-
-## [CHAIN-2] L1 block-number approximation makes interest timing coarse and chain-dependent
-**Severity**: Low
-**Category**: evm-audit-chain-specific
-**Location**: `LendingMarket.initialize()` and `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:70`, `src/LendingMarket.sol:116-128`)
-**Description**: Arbitrum exposes an approximate L1 block number through Solidity's `block.number`, not the Arbitrum L2 block number. Many L2 transactions therefore share one value, and its progress is not a protocol guarantee that exactly 12 seconds elapsed per increment. The market nevertheless converts the difference to time using the Ethereum-specific `SECONDS_PER_BLOCK = 12`. Interest does not accrue between any transactions sharing an L1 block, then accrues in steps, and long sequencer or L1 timing irregularities translate directly into debt-accounting error. Rapid same-block borrowing and repayment avoids the small amount of interest that wall-clock time would charge; more importantly, borrowers or the treasury can gain or lose whenever actual elapsed time diverges from `blocksElapsed * 12`. This is unlikely to create a large standalone extraction at a 4% annual rate, but it is avoidable financial-accounting drift in a production lending market.
-**Proof of Concept**: Execute `accrueInterest()` and then multiple borrow/repay operations in different Arbitrum L2 blocks that all report the same L1 `block.number`. Every call computes `blocksElapsed == 0`, so no interest is recorded even though time and L2 blocks elapsed. Conversely, if the exposed L1 block number advances several steps between calls, all estimated time is charged at once according to the hardcoded 12-second multiplier rather than actual elapsed seconds.
-**Recommendation**: Store `lastAccrualTimestamp` and compute interest from `block.timestamp - lastAccrualTimestamp`, with an explicit maximum accrual interval or administrative recovery procedure if desired. Do not use `ArbSys.arbBlockNumber()` as a substitute for elapsed time; it has L2-block rather than time semantics. Add tests covering many calls at the same `block.number`, sequencer downtime, and irregular block-number jumps.
-
-## Chain-specific checks with no additional finding
-
-- The README's native USDC address (`0xaf88...5831`) and wstETH address (`0x5979...0529`) are Arbitrum One addresses rather than Ethereum-mainnet or USDC.e addresses. The separate semantic error of assigning a stETH/USD feed directly to wstETH is reported by the ERC-20/oracle review and is not duplicated here.
-- No retryable-ticket, L2-to-L1 messaging, address-aliasing, `block.basefee`, hardcoded gas-price, `prevrandao`, native-ETH `transfer`/`send`, or chain-specific precompile logic exists in `src/`.
-- Solidity 0.8.28 may emit `PUSH0`, which is supported on current Arbitrum One; this is a deployment-compatibility concern only if the same bytecode is later deployed to a chain without Shanghai/PUSH0 support.
diff --git a/findings-erc20.md b/findings-erc20.md
deleted file mode 100644
index fe11693bdc9d4c7a7e1efe27382c440339639b26..0000000000000000000000000000000000000000
--- a/findings-erc20.md
+++ /dev/null
@@ -1,39 +0,0 @@
-## [ERC20-1] wstETH is priced as one stETH, overstating liquidation severity and collateral seized
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `LendingMarket.collateralValueUsd()` and `LendingMarket._liquidate()` (`src/LendingMarket.sol:132-138`, `src/LendingMarket.sol:219-230`); launch feed configuration in `README.md`
-**Description**: The launch configuration maps wstETH to a stETH/USD feed, while both valuation paths multiply the user's raw wstETH units directly by that feed price. One wstETH is a yield-bearing wrapper representing a changing quantity of stETH; it is not one stETH. The omitted `stEthPerToken()` conversion systematically undervalues wstETH and makes the effective loan-to-value and liquidation bonus differ from the configured 80% threshold and 5% bonus. The same integration error will recur if weETH or ezETH is listed against an ETH/USD feed without composing in its exchange rate. A borrower can be liquidated while economically above the advertised collateral threshold, and the liquidator receives more underlying value than the configured bonus at the borrower's expense.
-**Proof of Concept**: Suppose one wstETH represents 1.20 stETH. A user deposits 1 wstETH when the stETH feed is $2,400 and borrows $1,000; the account passes the current health check. The stETH feed later falls to $1,900. The market reports $1,900 of collateral while the wrapper is economically worth $2,280, and the position is liquidatable under the current implementation. `_liquidate()` calculates a nominal $1,050 seizure and transfers about 0.5526 wstETH. At the actual wrapper rate that is $1,260 of value: an effective 26% premium over repaid debt rather than 5%. The extra $210 comes from the borrower. (The separate loss-of-precision defect in `healthFactor()` makes the liquidation boundary even harsher; correcting it does not correct this wrapper price or seizure error.)
-**Recommendation**: Price the collateral token itself. For wstETH, either configure a maintained wstETH/USD feed or compose stETH/USD with wstETH's `stEthPerToken()` rate using explicit decimal normalization. Use asset-specific adapters for weETH and ezETH rather than assuming every wrapped LST/LRT is 1:1 with ETH. Test valuation and seizure against live wrapper conversion rates and define conservative handling for rate decreases/slashing.
-
-## [ERC20-2] Nominal deposit accounting lets non-standard collateral create unbacked borrowing power
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.deposit()` (`src/CollateralVault.sol:35-41`)
-**Description**: `deposit()` credits the caller-supplied `amount` without checking the vault's balance delta and ignores the return value of `transferFrom`. For a fee-on-transfer token the vault receives less than the credited amount. For a token that returns `false` without reverting, it may receive nothing and still credit the full amount. `LendingMarket.listCollateral()` provides no token-behavior validation, so a future listing can turn the discrepancy into borrowable collateral. An attacker deposits repeatedly, receives inflated accounting, borrows real USDC from the treasury, and leaves bad debt that the vault cannot cover. Raw transfers elsewhere also ignore a returned `false`, but this deposit path is the direct accounting exploit.
-**Proof of Concept**: Governance lists a token with a valid price feed that charges a 10% transfer fee. The attacker calls `deposit(token, 1_000e18)`; the vault receives 900 tokens but records 1,000. Health checks value 1,000 tokens and permit borrowing against them. With a token returning `false` and moving no funds, the same call records 1,000 tokens backed by zero. The attacker borrows USDC; liquidation or withdrawal later fails once actual vault inventory is exhausted.
-**Recommendation**: Use a checked transfer helper and derive the credited amount from `balanceAfter - balanceBefore`. If only exact-transfer collateral is supported, require the delta to equal `amount` and revert otherwise. Document and enforce an explicit token-adapter/allowlist policy before listing weETH, ezETH, USDT, or any future asset; never infer ERC-20 compatibility solely from the interface.
-
-## [ERC20-3] Cached balances are incompatible with the planned rebasing-collateral path
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.balanceOf`, `CollateralVault.deposit()`, `CollateralVault.withdraw()`, and `LendingMarket.collateralValueUsd()` (`src/CollateralVault.sol:12`, `src/CollateralVault.sol:35-52`, `src/LendingMarket.sol:132-138`)
-**Description**: User collateral is stored as a fixed token amount and never reconciled to the vault's actual balance. If a listed token negatively rebases, recorded balances and borrowing power remain unchanged even though backing has disappeared. Borrowers can retain or take USDC loans against nonexistent collateral, while withdrawals and liquidations eventually revert or become first-come-first-served. A positive rebase creates unallocated assets that depositors cannot claim. This does not affect non-rebasing wstETH itself, but it makes the README's planned path to rebasing collateral unsafe without a different accounting model.
-**Proof of Concept**: Two users each deposit 100 units of a listed rebasing token, so total internal balances and vault inventory are 200. After a 20% negative rebase the vault owns 160, while each user's recorded balance remains 100 and health calculations still value 200 total. Both can continue borrowing based on the stale amounts. The first user may withdraw or be seized for 100, leaving only 60 backing the second user's recorded 100; attempts to transfer the remaining nominal amount revert and USDC debt can become bad debt.
-**Recommendation**: Do not list rebasing tokens in the current vault. Prefer their non-rebasing wrapper, priced with its conversion rate. If direct rebasing support is required, implement share-based accounting (`userShares / totalShares`) against actual assets, specify who receives positive rebases and absorbs negative rebases, and validate every deposit, withdrawal, health check, and liquidation under both directions of rebase before governance can enable the asset.
-
-## [ERC20-4] USDC/USDT issuer controls can freeze shared custody and block risk reduction
-**Severity**: Medium
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.deposit()`, `CollateralVault.withdraw()`, `CollateralVault.seize()`, `LendingMarket.repay()`, `LendingMarket._borrow()`, and `LendingMarket._liquidate()`
-**Description**: USDC (the debt asset) and shortlisted USDT have issuer pause and address-blocklist controls. All debt liquidity is held by `LendingMarket`, and all collateral of a given token is pooled in `CollateralVault`. If the market is blocked, seeded USDC and repayments can be frozen for every user. If the vault is blocked after USDT is listed, every depositor's USDT is frozen. A global token pause can prevent repayment and liquidation during a price move; after transfers resume, borrowers may face immediate liquidation because the protocol has no emergency mode or grace period. A single user's blocklisting can also prevent that user's repayment or collateral withdrawal even when they are trying to reduce risk.
-**Proof of Concept**: A borrower has USDC debt and USDT collateral. Tether pauses transfers or blocks the vault address, making `withdraw()` and `seize()` revert for all USDT positions. Alternatively Circle pauses USDC, making `repay()` and `_liquidate()` revert. Prices and interest continue to move while users cannot repay and keepers cannot liquidate. When transfers resume, accounts may be underwater and liquidated despite having had no on-chain path to cure them during the outage.
-**Recommendation**: Treat issuer controls as an explicit listing risk. Add a protocol emergency state that stops new borrows and interest accrual/liquidations when the debt asset or a major collateral cannot transfer, followed by a governance-controlled recovery/grace period. Isolate centrally controlled collateral in separate vaults/markets where practical so one blocklisted custody address does not freeze unrelated assets. Publish this dependency and rehearse pause/blocklist incident procedures before launch and before listing USDT.
-
-## [ERC20-5] Unbounded token decimals can permanently disable account health operations
-**Severity**: Medium
-**Category**: evm-audit-erc20
-**Location**: `LendingMarket.listCollateral()`, `LendingMarket.collateralValueUsd()`, `LendingMarket.debtValueUsd()`, and `LendingMarket._liquidate()` (`src/LendingMarket.sol:107-114`, `src/LendingMarket.sol:132-143`, `src/LendingMarket.sol:219-230`)
-**Description**: Collateral listing validates neither that `token` is a contract nor that its `decimals()` is within a safe supported range. Valuation computes `10 ** decimals`; a listed token returning a sufficiently large value (78 or above) causes checked exponentiation to revert. Because `collateralValueUsd()` iterates the global token list, any user with a nonzero recorded amount of that asset can no longer borrow, pass the post-withdraw health check, or be liquidated. Tokens with unusual but smaller decimals can also create unsupported rounding behavior. This is a governance-triggered integration failure, but it can strand positions after a mistaken or compromised listing.
-**Proof of Concept**: Governance lists a token whose `decimals()` returns 78 and configures a feed. A user deposits one unit. Every call to `collateralValueUsd(user)` reaches `10 ** 78` and reverts from overflow. Consequently `healthFactor`, borrowing, collateral withdrawal (which calls `requireHealthy`), and liquidation for that account revert.
-**Recommendation**: Validate token code and cache normalized decimal metadata at listing time. Restrict decimals to a deliberately supported range (normally no more than 18 unless higher-decimal assets are explicitly tested), reject zero addresses/EOAs, and use a full-precision normalization library or asset adapter rather than unchecked generic exponentiation. Add a safe delisting/migration mechanism for a token whose metadata or implementation changes.
diff --git a/findings-general.md b/findings-general.md
deleted file mode 100644
index 85203bca72def126fa013964b28da77eed39b9d7..0000000000000000000000000000000000000000
--- a/findings-general.md
+++ /dev/null
@@ -1,63 +0,0 @@
-## [G-1] Anyone can replace the market implementation and seize all protocol assets
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo` has no authorization check and writes an arbitrary address directly to the ERC-1967 implementation slot. Because calls reach this function through `MarketProxy`, any account can replace the live implementation. The replacement executes in the proxy's storage context and the proxy is also the immutable `market` trusted by `CollateralVault`, so malicious implementation code can transfer the market's USDC and invoke `vault.seize` against every depositor. The attacker receives all treasury liquidity and all deposited collateral.
-**Proof of Concept**: (1) Deploy an implementation with a function that transfers the proxy's full USDC balance to the attacker and calls `CollateralVault.seize(user, token, attacker, amount)`. (2) Call `upgradeTo(maliciousImplementation)` through `MarketProxy`; the unguarded function stores the attacker's address. (3) Call the malicious function through the proxy. It executes as the trusted market and drains both contracts.
-**Recommendation**: Add `onlyOwner` to `upgradeTo`, reject `address(0)` and implementations with no code, and use a battle-tested UUPS implementation that verifies `proxiableUUID`. Put upgrade authority behind a timelock/multisig. Also disable initialization of the implementation contract itself.
-
-## [G-2] Anyone can install a malicious oracle and borrow the entire USDC treasury against dust
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)
-**Description**: `setOracle` lacks `onlyOwner`, so an arbitrary caller can replace the oracle. An attacker-controlled oracle can report an enormous collateral price and a minimal debt-asset price, making a dust-backed account appear healthy. The attacker can then borrow the market's directly seeded USDC balance and keep it; the recorded collateral cannot cover the debt.
-**Proof of Concept**: (1) Deposit a small amount of a listed collateral. (2) Deploy a contract implementing `getPrice` that returns an attacker-chosen high price for the collateral and a low positive price for USDC. (3) Call `setOracle` with that contract. (4) Call `borrow` for the market's full USDC balance. The manipulated health check passes and the real USDC is transferred to the attacker.
-**Recommendation**: Add `onlyOwner` to `setOracle`, reject zero/non-contract addresses, and preferably use a two-step, timelocked oracle update controlled by a multisig. Validate the new oracle against expected feeds and bounds before activating it.
-
-## [G-3] Anyone can weaken the liquidation threshold and drain treasury liquidity
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)
-**Description**: `setLiquidationThreshold` is publicly callable and accepts an unbounded value. A caller can set it far above `BPS`, causing nearly uncollateralized positions to pass `healthFactor`. The attacker receives real USDC while the protocol is left with bad debt backed by negligible collateral.
-**Proof of Concept**: (1) Deposit a minimal amount of listed collateral. (2) Call `setLiquidationThreshold(type(uint256).max / 1e18)` or another very large value that does not overflow the particular health-factor calculation. (3) Borrow up to the market's USDC liquidity. The inflated threshold makes the health factor exceed `1e18` despite insufficient collateral.
-**Recommendation**: Add `onlyOwner` and enforce a conservative bound such as `0 < bps && bps <= BPS`. Apply governance delay/multisig controls to risk-parameter changes and add invariant tests proving that increasing the threshold cannot permit undercollateralized borrowing.
-
-## [G-4] Callback-capable collateral can be withdrawn multiple times while leaving fictitious collateral recorded
-**Severity**: High
-**Category**: evm-audit-general
-**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)
-**Description**: `withdraw` transfers tokens before reducing `balanceOf` and before checking account health. A listed ERC777-like or otherwise callback-capable token can reenter `withdraw` during `transfer`. Every nested call reads the same pre-withdraw balance, transfers again, and then writes the same final balance. The account can therefore remove more collateral than it is charged for, retain an overstated vault balance, and borrow USDC that is no longer backed. The README explicitly plans to broaden collateral support, including yield-bearing and rebasing assets, making the token-behavior assumption security-critical.
-**Proof of Concept**: (1) A callback-capable token is listed and an attacker deposits `X`. (2) The attacker calls `withdraw(token, X)`. (3) During the token transfer callback, the attacker reenters `withdraw(token, X)`. Both invocations observe `balanceOf == X`, both transfer `X`, and both finally store zero. With a partial amount, the same technique can leave a positive fictitious balance that supports a USDC borrow.
-**Recommendation**: Follow checks-effects-interactions: decrement `balanceOf` before calling the token, then perform the health check and transfer (a revert rolls all changes back). Add a reentrancy guard as defense in depth and explicitly vet or reject callback/rebasing collateral types until accounting supports them.
-
-## [G-5] Unchecked ERC20 return values allow unbacked balances or debt cancellation
-**Severity**: High
-**Category**: evm-audit-general
-**Location**: `CollateralVault.deposit()`, `CollateralVault.withdraw()`, `CollateralVault.seize()`, `LendingMarket.repay()`, `LendingMarket._borrow()`, and `LendingMarket._liquidate()`
-**Description**: Every ERC20 `transfer`/`transferFrom` return value is ignored. A token that returns `false` instead of reverting can cause state transitions to complete without the corresponding asset movement. Most critically, a false-returning listed collateral creates credited collateral without a deposit, and a false-returning debt asset lets `repay` reduce debt or `_liquidate` clear a borrower's entire debt without receiving payment. The immediate launch assets may revert on failure, but the implementation presents the same unchecked generic interface for planned future listings and upgrades.
-**Proof of Concept**: For a listed token whose `transferFrom` returns `false`, call `deposit(token, amount)`. No tokens arrive, but `balanceOf[msg.sender][token]` increases by `amount`; the attacker then borrows real USDC against the fictitious balance. Alternatively, if a configured debt token returns `false`, calling `repay` reduces principal even though the market receives nothing.
-**Recommendation**: Use a safe-transfer library that accepts either `true` or empty returndata and reverts on `false` or malformed returndata. For collateral deposits, additionally measure the vault's balance before and after transfer and credit only the amount actually received; define explicit policy for fee-on-transfer and rebasing assets.
-
-## [G-6] Borrow authorizations have no nonce or deadline and can be replayed indefinitely
-**Severity**: Medium
-**Category**: evm-audit-general
-**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)
-**Description**: The signed struct contains only `borrower` and `amount`; it has neither a nonce nor expiry, and no digest is marked consumed. Anyone who sees one authorization can submit it repeatedly for as long as the account remains healthy. The recipient is the borrower, so a relayer does not directly steal the proceeds, but they can force the signer to take repeated unwanted debt, consume their borrowing capacity, and push the position to the liquidation boundary. A signature also remains valid indefinitely and after repayment.
-**Proof of Concept**: Obtain one valid signature authorizing a borrow of `A`. Call `borrowWithSig(borrower, A, ...)` repeatedly. Every call recovers the same borrower and succeeds until the health check or market liquidity stops it. After the borrower repays, the same old signature can be replayed again.
-**Recommendation**: Include a per-borrower nonce, deadline, and preferably the intended relayer/receiver in `BORROW_TYPEHASH`; check the deadline and increment the nonce before borrowing. Use a standard EIP-712/ECDSA implementation that rejects malleable signatures and invalid `v` values.
-
-## [G-7] The borrower array can be grown without bound until batch liquidation is unusable
-**Severity**: Medium
-**Category**: evm-audit-general
-**Location**: `LendingMarket._borrow()` and `LendingMarket.liquidateAll()` (`src/LendingMarket.sol:197`, `src/LendingMarket.sol:190`)
-**Description**: `_borrow` appends whenever `principalOf[borrower] == 0` but entries are never removed or marked as already known. Any account can repeatedly call `borrow(0)`, for which the principal remains zero and the zero-debt health factor is maximal, adding another entry each time. Normal users can also be added repeatedly after repaying. `liquidateAll` scans the entire attacker-growable array and performs oracle/vault calls per live entry; eventually it exceeds the Arbitrum transaction gas limit. Keepers lose the documented ability to sweep underwater positions during a sharp price move, increasing the chance of bad debt, although individual `liquidate` remains available.
-**Proof of Concept**: From one address, call `borrow(0)` thousands of times. Each call pushes that address into `borrowers` because its principal remains zero. Calling `liquidateAll` must iterate across all duplicate entries and eventually runs out of gas before completing.
-**Recommendation**: Reject zero and dust borrows, maintain an `isBorrower` membership flag, and remove users with an indexed set when debt reaches zero. Replace all-at-once liquidation with a bounded, cursor-based batch function accepting a maximum number of positions.
-
-## [G-8] Proxy construction permits an EOA implementation and an uninitialized deployment
-**Severity**: Low
-**Category**: evm-audit-general
-**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`)
-**Description**: The constructor does not verify that `implementation` contains code, and it allows empty `initData`. A delegatecall to a non-contract address reports success, so deployment tooling can silently create a proxy with no executable implementation. If initialization is omitted, `LendingMarket.initialize` remains publicly callable and an observer can become `owner`. The currently unprotected setters/upgrader make ownership less consequential, but once those Critical issues are fixed this deployment footgun becomes an ownership takeover or permanent deployment failure.
-**Proof of Concept**: Deploy `MarketProxy` with an EOA as `implementation` and non-empty encoded initialize data; `delegatecall` succeeds with empty returndata and the proxy deploys unusably. Or deploy a valid implementation with empty `initData`, then have another account call `initialize` through the proxy first and set itself as owner.
-**Recommendation**: Require `implementation.code.length > 0`, require non-empty initialization data for this deployment, and atomically delegatecall `initialize` in the constructor. Make the deployment script assert initialized owner, oracle, vault, and debt asset immediately after deployment.
diff --git a/findings-lending.md b/findings-lending.md
deleted file mode 100644
index 78375b3dfc090d2af7464faf1597867d0a74098c..0000000000000000000000000000000000000000
--- a/findings-lending.md
+++ /dev/null
@@ -1,47 +0,0 @@
-# Lending and Liquidation Findings
-
-## [HIGH] LEND-01 — Divide-before-multiply makes healthy positions liquidatable
-
-- **Contract / function:** `LendingMarket.sol`, `healthFactor()`
-- **Impact:** The market does not enforce the documented 80% liquidation threshold. Because the collateral/debt ratio is truncated to a whole integer first, every position with a collateral ratio from 100% through just under 200% receives the same health factor of `0.8e18` and is liquidatable. For example, a user with $150 of collateral and $100 of debt should have a health factor of 1.2, but the contract reports 0.8. A liquidator can repay the $100 debt and take $105 of collateral from this solvent user. The same error prevents users from borrowing to the advertised 80% LTV; they need at least 200% collateralization to pass the check.
-- **Cause:** `return (collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS;` performs integer division before applying the fixed-point scale.
-- **Fix:** Multiply before dividing, using overflow-safe full-precision math: `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Add boundary tests immediately below, at, and above 125% collateralization, plus fuzz tests against a high-precision reference implementation.
-
-## [HIGH] LEND-02 — The configured stETH/USD feed materially underprices wstETH collateral
-
-- **Contract / function:** Deployment configuration described in `README.md`; consumed by `LendingMarket.collateralValueUsd()` and `LendingMarket._liquidate()` through `PriceOracle.getPrice()`
-- **Impact:** wstETH is not redeemable 1:1 for stETH; one wstETH represents an increasing amount of stETH. Feeding the stETH/USD price directly as the price of one wstETH therefore undervalues every user's collateral by the wstETH/stETH exchange rate. Users can be liquidated before the intended threshold. During liquidation, the same underpricing makes the market transfer more wstETH than the stated 5% bonus, so a liquidator extracts the exchange-rate difference from the borrower in addition to the bonus.
-- **Cause:** The planned wstETH listing maps wstETH to the stETH/USD feed without converting through `wstETH.stEthPerToken()` (or using a purpose-built wstETH/USD feed).
-- **Fix:** Use Chainlink's Arbitrum wstETH/USD feed if supported and validate its heartbeat, or compose stETH/USD with the canonical wstETH-to-stETH conversion rate using carefully normalized fixed-point math. Test valuation and seizure using the live non-1:1 exchange rate before deployment.
-
-## [MEDIUM] LEND-03 — Full repayment can leave an unrepayable scaled-debt remainder
-
-- **Contract / function:** `LendingMarket.sol`, `repay()` and `debtOf()`
-- **Impact:** After interest makes `borrowIndex > 1e18`, repaying the displayed full debt can leave one or more units of scaled principal because both conversions round down. Once the displayed debt is very small, `amount * WAD / borrowIndex` can be zero, so further repayments transfer USDC without reducing principal. The borrower cannot close the position normally and cannot withdraw all collateral; their only escape is liquidation or a contract upgrade.
-- **Cause:** `debtOf()` rounds scaled principal down to debt units, then `repay()` independently rounds the debt payment down when converting it back to scaled principal. The full-repayment branch is not distinguished from partial repayment.
-- **Fix:** When `amount >= debt`, collect exactly `debt` and set `principalOf[onBehalfOf] = 0`. For partial repayments, define explicit rounding direction and reject a payment whose scaled reduction is zero. Add invariant tests that a full repayment always clears principal and that every accepted partial repayment reduces debt.
-
-## [MEDIUM] LEND-04 — Anyone can permanently gas-grief the keeper's bulk liquidation path for free
-
-- **Contract / function:** `LendingMarket.sol`, `_borrow()` and `liquidateAll()`
-- **Impact:** An attacker can call `borrow(0)` from arbitrarily many addresses. Each call appends the address to `borrowers` because its principal remains zero. Entries are never removed, and addresses can also be appended again after repayment or liquidation. The attacker pays no USDC and posts no collateral, yet can grow the array until `liquidateAll()` cannot fit in a block. Following a sharp price move, the documented keeper sweep becomes unusable, increasing the chance that positions remain underwater and turn into bad debt. Individual liquidations remain possible, but the intended crisis-response mechanism is lost.
-- **Cause:** `_borrow()` accepts zero and appends whenever current principal is zero; `liquidateAll()` performs an unbounded iteration over an append-only array.
-- **Fix:** Reject zero-value borrows, track membership separately, remove borrowers on closure, and replace the all-at-once sweep with bounded pagination (`start`, `maxCount`) or off-chain discovery plus individual liquidations. Set a meaningful minimum debt size so liquidation rewards cover Arbitrum execution costs.
-
-## [MEDIUM] LEND-05 — Deeply underwater positions have no economically viable liquidation path
-
-- **Contract / function:** `LendingMarket.sol`, `_liquidate()`
-- **Impact:** A liquidator must repay 100% of a user's debt before receiving collateral. If a fast oracle update or accrued interest makes the remaining collateral worth less than the debt, liquidation guarantees a loss: the liquidator pays the full debt and receives at most all collateral. Rational liquidators will leave the position untouched, so the treasury retains uncollectible debt and the account remains open indefinitely. Requiring the full debt also makes large liquidations unnecessarily capital-intensive.
-- **Cause:** Liquidation has no close factor, partial-repayment parameter, bad-debt settlement, or reserve/insurance backstop. The nominal 5% bonus cannot help once collateral value is below debt value.
-- **Fix:** Implement partial liquidation with a caller-specified repay amount and minimum collateral-out protection. Cap the bonus to available collateral, explicitly recognize residual bad debt, and fund a reserve/insurance mechanism able to settle it. Add simulations for abrupt 50%+ collateral moves and define who absorbs insolvency.
-
-## [MEDIUM] LEND-06 — USDC downtime accrues debt while repayment and liquidation are impossible
-
-- **Contract / function:** `LendingMarket.sol`, `accrueInterest()`, `repay()`, and `liquidate()`
-- **Impact:** Native USDC on Arbitrum is centrally pausable. While it is paused, borrowers cannot transfer USDC into the market to repay and liquidators cannot fund liquidations, but interest continues to advance by elapsed blocks. When transfers resume, borrowers that crossed the threshold during the outage can be liquidated immediately by bots before they have a practical chance to repay. Users lose collateral because of an external pause they could not defend against.
-- **Cause:** There is no market pause/emergency accounting mode and no post-resumption grace period; interest is calculated purely from elapsed blocks at the next state change.
-- **Fix:** Add a narrowly scoped emergency mode that freezes borrowing and interest/liquidation eligibility while the debt token is unavailable, while preserving safe collateral additions where possible. On resumption, provide a bounded repayment grace period before liquidation. Document governance controls and test pause/resume scenarios against a pausable USDC mock.
-
-## Notes on prospective collateral
-
-The README proposes weETH, ezETH, USDT, and later rebasing/yield-bearing assets. Do not treat wrappers as 1:1 with their underlying assets: each listing needs an independent market-price path or an explicitly validated wrapper conversion plus underlying feed. The current vault's nominal-balance accounting is also not suitable for rebasing tokens without an adapter/share-accounting layer. These are listing requirements rather than launch findings because those assets are not yet enabled.
diff --git a/findings-oracles.md b/findings-oracles.md
deleted file mode 100644
index b0fe4017335ba20b5f607c148aa9772be1ee7121..0000000000000000000000000000000000000000
--- a/findings-oracles.md
+++ /dev/null
@@ -1,42 +0,0 @@
-# Oracle and Pricing Findings
-
-## [CRITICAL] Anyone can replace the market oracle and drain all seeded USDC
-
-- **Contract / function:** `LendingMarket.setOracle()` (`src/LendingMarket.sol:91-94`)
-- **What happens:** `setOracle` has no access control. An attacker can deploy an oracle that reports an arbitrarily large collateral price (and a normal or tiny USDC price), call `setOracle`, deposit a trivial amount of wstETH, and borrow the market's entire seeded USDC balance. The same primitive can make every existing account appear underwater and let the attacker liquidate users at attacker-chosen prices. The attacker receives the treasury's USDC and/or users' collateral; the protocol is left with bad debt.
-- **Recommended fix:** Add `onlyOwner` (preferably a timelocked governance role) to `setOracle`. Validate that the new address is nonzero and contains code. Use a two-step/timelocked oracle change with an emergency pause, and test the candidate oracle for every listed collateral and the debt asset before activation.
-
-## [HIGH] wstETH is priced as one stETH, overpaying liquidators in wstETH
-
-- **Contract / function:** Launch feed configuration consumed by `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `LendingMarket._liquidate()` (`src/PriceOracle.sol:39-45`, `src/LendingMarket.sol:132-138, 209-230`)
-- **What happens:** The README maps wstETH (`0x5979...0529`) directly to the stETH/USD feed (`0x07C5...f2a`). One wstETH represents more than one stETH because staking rewards accumulate in its conversion rate. The market therefore treats `1 wstETH == 1 stETH`. This understates users' collateral value, makes them borrow less than intended and become liquidatable prematurely. More importantly, liquidation computes the number of wstETH to seize by dividing a USD claim by the stETH price. A liquidator receives `(1 + bonus)` worth of **stETH units** as wstETH units, whose real value is higher by the wstETH/stETH exchange rate. Thus a liquidator extracts more than the configured 5% bonus from the unlucky borrower; the excess grows as staking rewards accumulate.
-- **Recommended fix:** Price wstETH itself. Compose a manipulation-resistant wstETH/stETH conversion rate with the stETH/USD feed (with independent freshness and validity checks), or use an appropriate dedicated wstETH/USD route. Unit-test both collateral valuation and seized-token amounts against the live conversion rate; never map wstETH directly to stETH/USD at 1:1.
-
-## [HIGH] Prices have no round-validity or freshness checks
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:39-45`)
-- **What happens:** The oracle calls deprecated `latestAnswer()` and cannot inspect `updatedAt`, `roundId`, `answeredInRound`, or `startedAt`. If either feed stops updating, all borrowing and liquidation continue indefinitely at the last price. An attacker can borrow excessive USDC against collateral whose market value has already fallen, leaving bad debt; in the reverse direction, users can be liquidated using an obsolete low collateral price or high USDC price. A deprecated/disabled feed can also brick every price-dependent operation.
-- **Recommended fix:** Use `latestRoundData()` and require `answer > 0`, `startedAt != 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Store a per-feed maximum age based on that feed's Arbitrum heartbeat/deviation policy, rather than one global threshold. Add a controlled pause/fallback process for an unavailable or deprecated feed.
-
-## [MEDIUM] Arbitrum sequencer outages are not checked and no recovery grace period is enforced
-
-- **Contract / function:** `PriceOracle.getPrice()` and all price-dependent borrow/liquidation paths (`src/PriceOracle.sol:39-45`)
-- **What happens:** The deployment target is Arbitrum One, but the oracle never checks Chainlink's Arbitrum sequencer uptime feed. After the sequencer recovers, market transactions may execute before asset feeds have caught up. A borrower can exploit a pre-outage high collateral price to take USDC that is no longer adequately collateralized; a liquidator can exploit a pre-outage low price to seize collateral from a position that is healthy at current prices. Users or the treasury bear the difference.
-- **Recommended fix:** Before accepting any asset price, query the Arbitrum sequencer uptime feed, require the sequencer status to be up, validate its round data, and require at least a one-hour grace period since recovery. Apply this check consistently to borrow, withdraw-health checks, and liquidation.
-
-## [MEDIUM] Feed answers are not protected against zero, negative, or circuit-breaker values
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:39-45`), consumed by `LendingMarket.healthFactor()` and `_liquidate()`
-- **What happens:** A zero USDC/USD answer makes every debt position appear to have zero USD debt, so `healthFactor` returns the maximum value and an attacker with minimal collateral can borrow all available USDC. A zero collateral answer makes liquidation revert when `_liquidate` divides by `price`, preventing bad-debt containment. A negative answer is cast to `uint256` and generally causes arithmetic overflow/reverts for the configured 8-decimal feeds, globally denying borrow, withdraw, and liquidation. Finally, no check rejects a Chainlink aggregator's `minAnswer`/`maxAnswer`; in an extreme crash a floored collateral price can remain above the true market price and permit undercollateralized borrowing.
-- **Recommended fix:** Explicitly reject `answer <= 0`. For each feed, evaluate the underlying aggregator's configured bounds and reject boundary answers, or install independent conservative price/deviation circuit breakers and pause affected actions. Handle invalid values by pausing new borrowing while preserving safe repayment/emergency-resolution paths.
-
-## [LOW] Feeds with more than 18 decimals permanently revert price queries
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:44`)
-- **What happens:** Normalization evaluates `18 - feed.decimals()`. Any future feed with more than 18 decimals underflows and reverts. Because governance plans to list more assets, a mistaken feed selection can make valuation, withdrawals, borrowing, and liquidation revert for users exposed to that asset. Users gain nothing and can have positions stuck until governance repairs the feed.
-- **Recommended fix:** Normalize in both directions: multiply when decimals are below 18 and divide when above 18. Reject unreasonable decimal values during `setFeed`, and perform a successful validated price read before a collateral can be listed.
-
-## Oracle-specific notes
-
-- The configured addresses currently identify themselves on Arbitrum as `STETH / USD` and `USDC / USD`, both with 8 decimals. Dynamic decimal reads are therefore correct for the two launch feeds, but the wstETH denomination mismatch remains.
-- USDC is not hardcoded to USD parity; using USDC/USD is the correct direction. No TWAP, Pyth, LP-token pricing, or VRF path exists in the reviewed code.
diff --git a/findings-precision.md b/findings-precision.md
deleted file mode 100644
index de4c727d49c86b2c4e9bc1655e88fc66475df5c0..0000000000000000000000000000000000000000
--- a/findings-precision.md
+++ /dev/null
@@ -1,39 +0,0 @@
-## [P-1] Division before multiplication makes healthy positions liquidatable below 200% collateralization
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:145`)
-**Description**: The expression `(collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS` divides the two 18-decimal USD values before applying the WAD scale. This truncates every collateral-to-debt ratio between 1.0 and 1.999... to exactly 1. With the configured 80% threshold, such a position is reported at a health factor of 0.8 even when its intended health factor is as high as almost 1.6. Consequently, the implementation effectively requires 200% collateralization rather than 125% and allows liquidation of positions that are solvent under the documented parameters. A liquidator can pay the borrower's debt and receive collateral plus the 5% bonus; the borrower loses that bonus and is forcibly closed solely because of the precision error.
-**Proof of Concept**: A user has $1,500 of collateral and $1,000 of debt. The intended health factor is `1500e18 * 8000 * 1e18 / (1000e18 * 10000) = 1.2e18`, so the position is healthy. The implementation first evaluates `1500e18 / 1000e18` as `1`, then returns `1 * 8000 * 1e18 / 10000 = 0.8e18`. Any account can therefore call `liquidate(user)` and collect the configured liquidation bonus from this healthy borrower.
-**Recommendation**: Multiply before dividing, ideally with a full-precision `mulDiv`: `return Math.mulDiv(collateralValueUsd(user), liquidationThreshold * WAD, debtUsd * BPS);`. If bounds make the combined denominator unsafe, perform two full-precision operations while preserving the WAD scale and document the chosen rounding direction. Add boundary tests at exactly 125%, immediately above it, and immediately below it.
-
-## [P-2] Rounding borrow principal down permits uncollateralized micro-borrows that drain treasury liquidity
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`)
-**Description**: `_borrow()` credits principal with `amount * WAD / borrowIndex`, rounding down, but transfers the full requested USDC amount. As soon as interest has accrued and `borrowIndex > WAD`, borrowing one base unit of USDC records zero principal. Since `debtOf()` is then zero, `healthFactor()` returns `type(uint256).max`; the borrower needs no collateral. The attacker can repeat or batch this call, receiving treasury USDC each time while accruing no debt. The same rounding loss also undercharges larger repeated borrows by up to one principal unit per call.
-**Proof of Concept**: Wait until at least one block after initialization and call `accrueInterest()`, which makes `borrowIndex` greater than `1e18` at the nonzero configured rate. From an address with no collateral, call `borrow(1)` (one micro-USDC). The principal increment is `1 * 1e18 / borrowIndex = 0`; the health check sees no debt and passes; one USDC base unit is transferred. An attacker contract can loop this operation until the market's prefunded balance is exhausted (subject only to transaction gas and available liquidity).
-**Recommendation**: Round debt shares/principal up when borrowing, for example `principalDelta = Math.mulDiv(amount, WAD, borrowIndex, Math.Rounding.Ceil)`, and require `principalDelta != 0`. Use the exact rounded-up delta consistently for accounting. Add invariant tests asserting that every successful positive borrow increases `debtOf(borrower)` by at least the transferred amount and that an uncollateralized account can never receive debt assets.
-
-## [P-3] Full repayment rounds principal reduction down and leaves an irreducible debt residue
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket.repay()` (`src/LendingMarket.sol:170`)
-**Description**: Repayment reduces principal by `amount * WAD / borrowIndex`, rounded down. Even when `amount` equals the entire value returned by `debtOf()`, the inverse conversion commonly leaves one principal unit. Once the residue is small enough that `amount * WAD / borrowIndex == 0`, later repayments transfer USDC but do not reduce principal at all. Because `amount` is capped to the rounded-down `debt`, the user cannot overpay by one unit to clear it. A nonzero debt prevents the borrower from withdrawing all collateral, leaving collateral locked until an upgrade or a very long period of additional index growth; repeated attempts also directly lose the transferred USDC.
-**Proof of Concept**: Let `principalOf[user] = 1,000,000` and `borrowIndex = 1.0000001e18`. `debtOf(user)` rounds to `1,000,000`. Calling `repay(user, 1,000,000)` transfers that full amount but subtracts only `floor(1,000,000e18 / 1.0000001e18) = 999,999`, leaving principal `1`. `debtOf(user)` remains `1`, but another repayment of `1` subtracts `floor(1e18 / 1.0000001e18) = 0`; the residue cannot be cleared through `repay()` and a complete collateral withdrawal fails the health check.
-**Recommendation**: Special-case full repayment: after collecting `debt`, set `principalOf[onBehalfOf] = 0`. For partial repayments, choose and document protocol-favoring rounding and reject any positive payment whose calculated principal reduction is zero. A robust pattern is to calculate the principal reduction first, cap it to stored principal, derive the exact asset amount from that reduction with consistent rounding, and only then transfer funds.
-
-## [P-4] Liquidation charges for value that rounding does not seize
-**Severity**: Low
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)
-**Description**: The collateral amount `takeUsd * unit / price` rounds down, but `seizeUsd` is reduced by the full unrounded `takeUsd`. Thus the liquidator can receive slightly less collateral value than the accounting treats as seized. The shortfall is less than one smallest unit of each collateral token, which is negligible for launch wstETH but becomes material for a future low-decimal, high-price collateral. If `takeUsd < price / unit`, the seizure rounds to zero while the entire `takeUsd` is still discarded. This rounding favors the borrower at the liquidator's expense and can make marginal liquidations unattractive.
-**Proof of Concept**: For a listed token with `unit = 1e6`, `price = 3e18`, and `takeUsd = 2e12`, the calculated collateral amount is `2e12 * 1e6 / 3e18 = 0`. The vault transfers no collateral, yet `_liquidate()` subtracts the full `2e12` from `seizeUsd`; the liquidator has paid debt corresponding to that value without compensation.
-**Recommendation**: Choose a liquidation rounding policy explicitly. To deliver at least the promised seizure value, calculate token units with full-precision rounding up, capped by the user's balance, and reduce `seizeUsd` by the actual USD value of the units seized. Alternatively, round down but carry the unfilled remainder into the next collateral instead of discarding it. Enforce decimal and minimum-unit constraints when listing collateral.
-
-## [P-5] Feeds with more than 18 decimals permanently revert price conversion
-**Severity**: Low
-**Category**: evm-audit-precision-math
-**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)
-**Description**: Price normalization computes `10 ** (18 - feed.decimals())`. If governance configures a feed whose decimals exceed 18, the subtraction underflows and every price-dependent borrow, withdrawal-health check, and liquidation reverts for that token. The launch feeds are expected to use at most 18 decimals, so this is a latent listing/configuration hazard rather than a current exploit.
-**Proof of Concept**: Set a token's feed to an aggregator returning `decimals() == 19`, then call `getPrice(token)`. Evaluation of `18 - 19` reverts under Solidity 0.8 arithmetic. Any market path that values the token consequently reverts.
-**Recommendation**: Validate feed decimals in `setFeed()` and either reject values above a supported bound or normalize both directions: multiply when `feedDecimals <= 18` and divide when `feedDecimals > 18`, with explicit rounding and overflow bounds. Cache validated feed metadata at configuration time.
diff --git a/findings-proxies.md b/findings-proxies.md
deleted file mode 100644
index 9f6fa308ce2549c4d5250aee9af3037ccf598234..0000000000000000000000000000000000000000
--- a/findings-proxies.md
+++ /dev/null
@@ -1,23 +0,0 @@
-## [P-1] Anyone can replace the market implementation and steal all treasury liquidity
-**Severity**: Critical
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo()` writes an arbitrary address directly to the ERC-1967 implementation slot without `onlyOwner` (or any other authorization). Because calls execute through `MarketProxy` by `delegatecall`, any account can replace all market logic while retaining the proxy's storage and token balances. An attacker can install logic that transfers the proxy's entire USDC balance to themselves, rewrite every position, or permanently disable the market. The attacker directly receives all treasury-seeded USDC held by the proxy; borrowers and the treasury lose access to the legitimate market state.
-**Proof of Concept**: (1) Deploy a contract with a function such as `drain(IERC20 token)` that calls `token.transfer(msg.sender, token.balanceOf(address(this)))`. (2) Call `LendingMarket(proxy).upgradeTo(address(maliciousImplementation))`; the call succeeds for any sender and overwrites the proxy's implementation slot. (3) Call `drain(USDC)` through the proxy. The malicious implementation executes in proxy context and transfers the proxy's full USDC balance to the attacker.
-**Recommendation**: Restrict upgrades to a deliberately secured authority (`onlyOwner`, preferably a timelocked multisig) and use a reviewed UUPS implementation such as OpenZeppelin `UUPSUpgradeable`, including `_authorizeUpgrade`. Add upgrade-event monitoring and operational upgrade tests.
-
-## [P-2] Optional initialization lets the first caller seize an uninitialized deployment
-**Severity**: High
-**Category**: evm-audit-proxies
-**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`) and `LendingMarket.initialize()` (`src/LendingMarket.sol:56`)
-**Description**: The proxy accepts empty `initData`, while `initialize()` is externally callable by anyone exactly once and accepts an attacker-selected owner, oracle, vault, and debt asset. No deployment script exists in the repository to establish that deployment and initialization will be atomic. If the proxy is deployed with empty data (or initialization is otherwise deferred), a mempool observer can initialize it first. The attacker becomes owner and permanently installs attacker-controlled dependencies. Once the treasury seeds the advertised proxy—or if seeding and setup are bundled later—the attacker can control listings and use the malicious dependencies to compromise or deny the market. This requires the specific deployment mistake of non-atomic initialization, but then permanently compromises the deployment.
-**Proof of Concept**: (1) Deploy `MarketProxy(implementation, "")`. (2) Before the deployer initializes it, an attacker calls `initialize(attacker, attackerOracle, attackerVault, USDC)` through the proxy. (3) The intended initializer now reverts with `AlreadyInitialized()`. The proxy is permanently configured with attacker-selected ownership and core dependencies unless it is abandoned or upgraded; in the current code the attacker can also exploit the unrestricted upgrade path in P-1 immediately.
-**Recommendation**: Require non-empty initialization calldata in the proxy constructor and atomically delegatecall `initialize` as part of deployment. Validate every initialization address as nonzero and, where appropriate, verify deployed code. Make the deployment script pass the exact encoded initializer and assert all resulting state before funding the proxy. Also lock the standalone implementation against direct initialization (for example with OpenZeppelin `Initializable` and `_disableInitializers()`), although direct initialization alone does not control this custom proxy.
-
-## [P-3] Upgrades do not verify that the replacement is code-compatible, so one bad upgrade can be irreversible
-**Severity**: Medium
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`) and `MarketProxy.fallback()` (`src/MarketProxy.sol:26`)
-**Description**: `upgradeTo()` accepts zero addresses, EOAs, and arbitrary contracts without checking code presence or ERC-1967/UUPS compatibility. All upgrade logic lives in the current implementation and the proxy has no independent admin recovery function. Consequently, setting the slot to an address without a working compatible `upgradeTo()` removes the only route to another implementation. Calls to an EOA can misleadingly return success with empty returndata, while the market is permanently unusable. After P-1 is fixed, an authorized operator typo or an incompatible release can still permanently strand the market and its state; users may be unable to borrow, repay, or liquidate, and treasury USDC may be stuck.
-**Proof of Concept**: Call `upgradeTo(address(0x1234))`, where `0x1234` has no code. The slot update succeeds. Subsequent proxy calls delegatecall an address with no code and return empty data. Because that address exposes no upgrade function and `MarketProxy` exposes no admin upgrade path, another implementation cannot be installed through the proxy.
-**Recommendation**: Adopt a standard UUPS implementation that checks `proxiableUUID()` against the ERC-1967 slot before changing implementations, reject `address(0)` and addresses with `code.length == 0`, and test upgrade compatibility/storage layout before execution. Alternatively, move a tightly controlled recovery/upgrade path into a standard transparent proxy. These checks supplement, not replace, the authorization required by P-1.
diff --git a/findings-signatures.md b/findings-signatures.md
deleted file mode 100644
index bec634a866bc1de191f358960f56ce19dd89353c..0000000000000000000000000000000000000000
--- a/findings-signatures.md
+++ /dev/null
@@ -1,31 +0,0 @@
-## [SIG-1] Anyone can replace the market implementation and take all protocol assets
-**Severity**: Critical
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo` has no `onlyOwner` (or other authorization) check and writes an arbitrary address directly to the ERC-1967 implementation slot. Because calls arrive through `MarketProxy`, any account can make the proxy delegate all future calls to attacker-controlled code. The replacement code executes in the proxy's context, which is also the immutable `market` authorized by `CollateralVault`. An attacker can therefore transfer the market's seeded USDC and invoke `CollateralVault.seize()` for every depositor. There is also no code-size or UUPS compatibility check, so even an accidental call can permanently brick the market.
-**Proof of Concept**: (1) Deploy an implementation exposing a function that transfers the proxy's full USDC balance to the attacker and calls `vault.seize(victim, token, attacker, amount)`. (2) Call `MarketProxy.upgradeTo(attackerImplementation)` from any EOA; the fallback delegates to the current `LendingMarket`, which stores the supplied address without checking the caller. (3) Call the malicious drain function through the proxy. The attacker receives the treasury's USDC and all collateral held for users.
-**Recommendation**: Add `onlyOwner` to the upgrade entry point, validate `newImplementation.code.length != 0`, and use a reviewed UUPS implementation (including `onlyProxy`, `proxiableUUID`, and `_authorizeUpgrade`) or a standard transparent proxy. Put upgrade authority behind a multisig/timelock and test that direct implementation calls and incompatible implementations revert.
-
-## [SIG-2] Reusable borrow signatures let any holder repeatedly increase a user's debt
-**Severity**: High
-**Category**: evm-audit-signatures
-**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)
-**Description**: The signed `Borrow(address borrower,uint256 amount)` struct contains neither a nonce nor a deadline, and the contract does not mark a digest as consumed. A signature is therefore valid forever and can be submitted repeatedly by anyone. Each submission adds `amount` to `principalOf[borrower]` until the health check reaches its limit. Although borrowed USDC is sent to the signer rather than the submitter, a leaked or previously relayed signature lets a griefer force the signer into unintended leverage and liquidation exposure. The unlucky signer receives additional USDC, but also incurs matching debt and can lose collateral plus the 5% liquidation bonus after a price move; the attacker can later act as liquidator and collect that bonus.
-**Proof of Concept**: (1) Alice deposits enough wstETH and signs one request to borrow 1,000 USDC. (2) A relayer submits that exact `(borrower, amount, v, r, s)` multiple times. (3) Every call recovers Alice and `_borrow` increases her principal again; nothing consumes the authorization. (4) Once Alice is close to the threshold, an adverse price move makes her liquidatable and a liquidator takes collateral including the configured bonus.
-**Recommendation**: Sign and consume a per-borrower nonce and include an expiration, for example `Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)`. Require `block.timestamp <= deadline`, increment `nonces[borrower]` before `_borrow`, and use OpenZeppelin `EIP712` plus `ECDSA.recover`. If arbitrary relayers are not a product requirement, additionally bind the intended submitter or require `msg.sender == borrower`.
-
-## [SIG-3] Cached EIP-712 domain remains tied to the initialization chain ID
-**Severity**: Low
-**Category**: evm-audit-signatures
-**Location**: `LendingMarket.initialize()` and `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:56`, `src/LendingMarket.sol:162`)
-**Description**: `domainSeparator` is computed once during initialization and never recomputed if `block.chainid` changes. Following a chain-ID-changing fork or migration, the contract continues accepting signatures made for the old domain while wallets correctly produce signatures for the new chain ID that the contract rejects. Coupled with the absence of nonces, old signed borrows remain usable on the forked deployment. This is a latent fork/migration failure rather than a current Arbitrum One theft path.
-**Proof of Concept**: Initialize when `block.chainid == A`, then execute the same state on a chain whose ID is `B`. `domainSeparator` still embeds `A`. A digest signed against domain `A` continues to recover, while a standards-compliant signature created against `B` fails with `BadSignature`.
-**Recommendation**: Use OpenZeppelin's upgradeable `EIP712` implementation and `_hashTypedDataV4`, which derives the separator for the active chain and proxy address. Alternatively cache both the initial chain ID and separator and recompute the separator whenever `block.chainid` differs.
-
-## [SIG-4] Two sensitive risk controls are callable by anyone
-**Severity**: Critical
-**Category**: evm-audit-access-control
-**Location**: `LendingMarket.setOracle()` and `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:91`, `src/LendingMarket.sol:96`)
-**Description**: Both setters omit `onlyOwner`. Any account can replace the trusted oracle or arbitrarily change the collateral threshold. An attacker can install a malicious `PriceOracle`-compatible contract that reports enormous collateral prices, deposit a negligible amount of a listed token, and borrow the entire USDC treasury. Alternatively, manipulating the threshold/oracle can make healthy users liquidatable; the caller can liquidate them and receive their collateral plus the bonus.
-**Proof of Concept**: (1) Deploy a contract whose `getPrice(collateral)` returns an enormous value and whose `getPrice(debtAsset)` returns a small positive value. (2) Call `setOracle` through the proxy from any EOA. (3) Deposit a trivial amount of listed collateral and call `borrow` for the proxy's full USDC balance. The forged health factor passes and the attacker receives all seeded USDC. No owner key or prior protocol state is required.
-**Recommendation**: Add `onlyOwner` to both setters. Validate nonzero contract addresses and sensible threshold bounds (at minimum `bps <= BPS`, with governance-approved lower/upper limits). Prefer a multisig plus timelock for oracle and risk changes, with an emergency pause mechanism for compromised feeds.

exec
/bin/bash -lc "git status --short --untracked-files=all && git diff -- src && test -f AUDIT-REPORT.md && wc -l AUDIT-REPORT.md && rg '"'^## '"\\[[CHML]-' AUDIT-REPORT.md" in /tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001
 succeeded in 0ms:
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..66627d77d88afa76bc10573ba7dd2b9d0f5f0042
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,208 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-03  
+**Scope:** `README.md`, `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Target:** Arbitrum One; native USDC debt; wstETH launch collateral  
+**Result:** **Do not deploy in the current state.**
+
+## Executive summary
+
+The review found **2 Critical, 8 High, 7 Medium, and 4 Low** issues. The two Critical issues independently let any caller take control of pricing or implementation logic and steal the treasury-funded USDC and deposited collateral. The public liquidation-threshold setter is another immediate launch blocker. Even after access control is repaired, the health-factor formula incorrectly liquidates solvent borrowers, the proposed wstETH feed values the wrong unit, and stale oracle data is accepted.
+
+Fix order for Monday:
+
+1. Lock down upgrades, oracle replacement, and risk parameters; require atomic initialization.
+2. Correct health, wstETH pricing, oracle validation, interest realization on withdrawal, and full-repayment rounding.
+3. Add adversarial tests for borrowing, repayment, withdrawal, liquidation, oracle outages, and upgrades before funding the proxy.
+4. Address the Medium issues before launch. Do not list weETH, ezETH, USDT, fee-on-transfer, callback-capable, or rebasing assets until asset-specific adapters and accounting are implemented.
+
+This was a source review plus successful `forge build`; the repository has no test suite. No deployment scripts were present, so initialization safety and on-chain configuration could not be verified.
+
+## Findings
+
+## [C-01] Anyone can replace the implementation and drain the market and vault
+**Severity**: Critical  
+**Category**: Access control / proxy  
+**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)  
+**Description**: `upgradeTo()` has no authorization and writes an arbitrary address to the ERC-1967 implementation slot. Malicious logic then executes in the proxy context. Because the proxy holds seeded USDC and is the immutable `market` trusted by `CollateralVault`, the replacement can transfer all USDC and call `vault.seize()` for every depositor. The attacker receives all funded liquidity and deposited collateral.  
+**Proof of Concept**: Deploy logic with a drain function, call `upgradeTo(malicious)` through the proxy, then call the drain through the proxy. The new logic can transfer the proxy's USDC and invoke the vault as its trusted market.  
+**Recommendation**: Use a reviewed UUPS or transparent proxy implementation. Restrict upgrades to a timelocked multisig, validate code and `proxiableUUID`, and test storage compatibility and rollback/recovery procedures.
+
+## [C-02] Anyone can replace the oracle and steal all seeded USDC
+**Severity**: Critical  
+**Category**: Access control / oracle  
+**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)  
+**Description**: `setOracle()` has no `onlyOwner`. An attacker can report an enormous collateral price and a tiny positive USDC price, borrow the complete USDC balance against dust, and leave unrecoverable debt. The same control can fabricate unhealthy positions and extract users' collateral as liquidator.  
+**Proof of Concept**: Deposit dust wstETH, install an attacker oracle, return a huge wstETH price and small USDC price, then borrow the proxy's entire USDC balance.  
+**Recommendation**: Add access control, validate that the new oracle is a contract supporting every active asset, and place oracle changes behind a timelock/multisig with a pause and two-step activation process.
+
+## [H-01] Anyone can force liquidations by changing the liquidation threshold
+**Severity**: High  
+**Category**: Access control / risk parameters  
+**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)  
+**Description**: Any caller can set the threshold to any value. Setting it to zero makes every debtor unhealthy. The caller can then repay selected debts and receive borrowers' collateral plus the 5% bonus; unlucky borrowers lose the bonus and their positions are forcibly closed. Unbounded high values also allow governance parameters to be bypassed and can cause arithmetic reverts.  
+**Proof of Concept**: Call `setLiquidationThreshold(0)`, then call `liquidate(user)` for an otherwise healthy borrower after approving USDC.  
+**Recommendation**: Add `onlyOwner`, require `0 < bps && bps <= BPS`, use a timelocked risk role, and pause borrowing around material parameter changes.
+
+## [H-02] Division before multiplication makes solvent positions liquidatable
+**Severity**: High  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:146`)  
+**Description**: `collateralValueUsd / debtUsd` truncates before applying WAD precision. At the configured 80% threshold, every collateral ratio from 100% to just under 200% produces a health factor of `0.8e18`. A borrower with $1,500 collateral and $1,000 debt should have a 1.2 health factor but is liquidatable. A liquidator receives $1,050 of collateral; the solvent borrower loses $50 and is forcibly closed.  
+**Proof of Concept**: For `$1,500e18 / $1,000e18`, the contract first obtains `1`, then returns `1 * 8000 * 1e18 / 10000 = 0.8e18`.  
+**Recommendation**: Use full-precision multiplication before division, e.g. `mulDiv(collateralUsd, liquidationThreshold * WAD, debtUsd * BPS)`, with explicit rounding. Test immediately below, at, and above 125% collateralization.
+
+## [H-03] The stETH/USD feed prices wstETH as if it were one stETH
+**Severity**: High  
+**Category**: Oracle / asset integration  
+**Location**: launch configuration in `README.md`; `LendingMarket.collateralValueUsd()` and `_liquidate()` (`src/LendingMarket.sol:132`, `src/LendingMarket.sol:209`)  
+**Description**: One wstETH represents a changing amount greater than one stETH. Applying the stETH/USD feed directly to raw wstETH units undervalues collateral and transfers too many wstETH during liquidation. If one wstETH represents 1.20 stETH, a nominal 5% liquidation premium becomes approximately 26% in underlying-value terms. The liquidator receives the excess from the borrower.  
+**Proof of Concept**: At a $1,900 stETH price, a $1,050 seizure transfers about 0.5526 wstETH. At 1.20 stETH per wstETH, that collateral is actually worth about $1,260.  
+**Recommendation**: Use a maintained wstETH/USD feed or compose stETH/USD with the canonical `stEthPerToken()` conversion. Validate freshness and units at both legs. Require equivalent asset-specific adapters for weETH and ezETH.
+
+## [H-04] Stale or incomplete Chainlink rounds are accepted indefinitely
+**Severity**: High  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Deprecated `latestAnswer()` exposes no timestamp or round metadata. After a feed stops updating, borrowers can take too much USDC against a fallen collateral price, leaving treasury bad debt, or liquidators can seize collateral using an obsolete adverse price.  
+**Proof of Concept**: If wstETH falls while its feed remains at the old high value, deposit/retain collateral and borrow against the stale value before updates resume.  
+**Recommendation**: Use `latestRoundData()` and require positive answers, nonzero timestamps, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Configure maximum age per feed and define a safe pause/fallback response.
+
+## [H-05] Withdrawals check debt before realizing accrued interest
+**Severity**: High  
+**Category**: Lending accounting  
+**Location**: `CollateralVault.withdraw()` and `LendingMarket.requireHealthy()` (`src/CollateralVault.sol:44`, `src/LendingMarket.sol:153`)  
+**Description**: Withdrawal calls a view-only health check without first calling `accrueInterest()`. After inactivity, a borrower can withdraw collateral based on the old index; the next accrual makes the remaining position undercollateralized. The user receives collateral that should secure the debt, while the treasury can be left with bad debt.  
+**Proof of Concept**: Borrow at the maximum permitted boundary, wait without any market state-changing call, then withdraw collateral while `borrowIndex` is stale. Call `accrueInterest()` afterward; the updated debt exceeds the remaining collateral limit.  
+**Recommendation**: Route withdrawals through the market or expose an authenticated market hook that accrues before the vault changes balances. Check health using a preview index that includes elapsed interest, and test long idle periods.
+
+## [H-06] A displayed full repayment can leave permanent debt dust and lock collateral
+**Severity**: High  
+**Category**: Precision / debt accounting  
+**Location**: `LendingMarket.repay()` and `debtOf()` (`src/LendingMarket.sol:128`, `src/LendingMarket.sol:170`)  
+**Description**: Debt and repayment conversions both round down. Paying the full displayed debt can leave one scaled-principal unit. Once `amount * WAD / borrowIndex` rounds to zero, further payments transfer USDC but reduce no principal, and the amount cap prevents overpayment. The borrower loses every attempted payment and cannot withdraw all collateral.  
+**Proof of Concept**: With principal `1,000,000` and index `1.0000001e18`, displayed debt is `1,000,000`; repayment subtracts only `999,999`, leaving principal `1`. Paying the remaining displayed unit subtracts zero forever.  
+**Recommendation**: If `amount >= debt`, collect exactly `debt` and set principal to zero. For partial repayments, compute the principal reduction first with documented rounding and reject a positive payment that reduces zero principal.
+
+## [H-07] Reusable borrow signatures can force a signer into repeated debt and liquidation
+**Severity**: High  
+**Category**: Signatures  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)  
+**Description**: The signed message has no nonce or deadline and is never consumed. Anyone observing one signature can replay it until the account reaches its borrowing limit, and can replay it again after repayment. Funds go to the signer, but an unaware signer can be pushed to the liquidation boundary; the replayer can later liquidate and receive the 5% collateral bonus.  
+**Proof of Concept**: Submit the same `(borrower, amount, v, r, s)` repeatedly. Every digest is identical and accepted. After the borrower repays, submit it again.  
+**Recommendation**: Sign and validate a per-borrower nonce, deadline, receiver/intended relayer, and amount; increment the nonce before borrowing. Use a standard EIP-712/ECDSA implementation that enforces low-`s` and valid `v`.
+
+## [H-08] Non-atomic proxy initialization permits deployment takeover
+**Severity**: High  
+**Category**: Proxy / deployment  
+**Location**: `MarketProxy.constructor()` and `LendingMarket.initialize()` (`src/MarketProxy.sol:10`, `src/LendingMarket.sol:56`)  
+**Description**: The proxy allows empty `initData`, and anyone may call `initialize()` once. If initialization is deferred, a mempool observer selects the owner, oracle, vault, and debt token. The legitimate initializer is permanently locked out and any later funding is exposed. No deployment script demonstrates atomic initialization.  
+**Proof of Concept**: Deploy the proxy with empty init data; before the deployer initializes, call `initialize(attacker, attackerOracle, attackerVault, token)`.  
+**Recommendation**: Require nonempty init data and atomically initialize in the proxy constructor. Validate all addresses, assert state before funding, and disable initializers on the standalone implementation.
+
+## [M-01] Arbitrum sequencer recovery is not checked
+**Severity**: Medium  
+**Category**: Oracle / Arbitrum  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: The oracle does not consult the Arbitrum sequencer uptime feed. Immediately after recovery, asset feeds may not yet be current. A borrower can receive excess USDC or a liquidator can receive collateral based on pre-outage prices.  
+**Proof of Concept**: Submit a borrow or liquidation immediately after sequencer recovery while the relevant asset round still predates the outage.  
+**Recommendation**: Validate the Arbitrum sequencer uptime feed and enforce a recovery grace period (commonly one hour) before using prices, in addition to per-feed freshness checks.
+
+## [M-02] Invalid oracle answers can bypass health checks or halt liquidation
+**Severity**: Medium  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Zero and negative answers are not rejected. A zero USDC price makes debt value zero and the health factor maximal, allowing treasury USDC to be borrowed with inadequate backing. A zero collateral price makes liquidation divide by zero; a negative answer casts to a huge unsigned integer and generally reverts downstream. Users or the treasury lose funds if an invalid answer is consumed; otherwise risk-reducing actions are blocked.  
+**Proof of Concept**: Return zero for USDC/USD and borrow while `debtValueUsd()` is zero, or return zero for collateral and observe `_liquidate()` revert at division by `price`.  
+**Recommendation**: Require `answer > 0`, valid round metadata, and reject/circuit-break implausible or aggregator-bound values. Pause new risk while preserving repayment and recovery paths.
+
+## [M-03] Nominal and unchecked token transfers can create unbacked collateral
+**Severity**: Medium  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()`, `withdraw()`, `seize()`; `LendingMarket.repay()`, `_borrow()`, `_liquidate()`  
+**Description**: Return values from every transfer are ignored, and deposits credit the requested amount rather than the received balance delta. The launch assets normally revert or return true, but a future fee-on-transfer or false-returning listed token lets an attacker receive inflated collateral credit and borrow real USDC. False-returning debt transfers can also cancel debt without payment after a future debt-asset change.  
+**Proof of Concept**: List a token whose `transferFrom` returns false or transfers 90%. Calling `deposit(100)` records 100 although the vault receives zero or 90; the caller borrows against the fictitious difference.  
+**Recommendation**: Use safe-transfer helpers. Credit the observed balance delta and, unless explicitly supported by an adapter, require it to equal the requested amount.
+
+## [M-04] Transfer-before-effects permits reentrant withdrawals for callback-capable collateral
+**Severity**: Medium  
+**Category**: Reentrancy / future listings  
+**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)  
+**Description**: The vault transfers before decrementing `balanceOf`. A callback-capable future token can reenter and make nested withdrawals observe the same old balance, withdrawing more assets than are charged and potentially leaving fictitious collateral for a USDC borrow. Launch wstETH does not expose such transfer callbacks, so this becomes exploitable when an unsafe token is listed.  
+**Proof of Concept**: Deposit a listed callback token, call `withdraw(X)`, and reenter `withdraw(X)` during its transfer hook. Both frames read the original balance and transfer `X`.  
+**Recommendation**: Apply checks-effects-interactions, decrement before the external call, and add a reentrancy guard. Explicitly prohibit callback tokens unless an adapter has been reviewed.
+
+## [M-05] The borrower array can permanently disable batch liquidation
+**Severity**: Medium  
+**Category**: Denial of service  
+**Location**: `LendingMarket._borrow()` and `liquidateAll()` (`src/LendingMarket.sol:190`, `src/LendingMarket.sol:197`)  
+**Description**: `borrow(0)` appends the caller whenever principal is zero; entries are never removed or deduplicated. An attacker spends gas but no assets to grow the array until `liquidateAll()` cannot fit in a block. During a price shock, keepers lose the documented sweep function and bad debt risk rises, although individual liquidation remains available.  
+**Proof of Concept**: Repeatedly call `borrow(0)`, then call `liquidateAll()` after enough entries exist; it runs out of gas.  
+**Recommendation**: Reject zero/dust borrowing, maintain unique membership, remove closed accounts, and replace the unbounded sweep with cursor-based bounded batches or off-chain discovery.
+
+## [M-06] Deeply underwater debt has no economically viable liquidation path
+**Severity**: Medium  
+**Category**: Liquidation design  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)  
+**Description**: A liquidator must pay 100% of debt before receiving at most the remaining collateral. If collateral value falls below debt, liquidation guarantees a loss, so rational liquidators leave the position open and the treasury retains bad debt. Large positions also require unnecessary up-front capital.  
+**Proof of Concept**: For $1,000 debt backed by collateral now worth $700, liquidation takes $1,000 USDC and can return only $700 of collateral.  
+**Recommendation**: Support caller-selected partial liquidation and minimum collateral output, cap seizure to available collateral, explicitly recognize residual bad debt, and define a reserve/insurance loss mechanism.
+
+## [M-07] Upgrades can accidentally and irreversibly brick the proxy
+**Severity**: Medium  
+**Category**: Proxy safety  
+**Location**: `LendingMarket.upgradeTo()` and `MarketProxy.fallback()` (`src/LendingMarket.sol:84`, `src/MarketProxy.sol:26`)  
+**Description**: No check rejects zero, an EOA, or an incompatible implementation. Because upgrade logic lives only in the implementation, one bad authorized upgrade can remove the only upgrade path and permanently strand positions and treasury USDC.  
+**Proof of Concept**: Upgrade to an EOA. Subsequent delegatecalls return empty data, and that address exposes no function that can restore the implementation.  
+**Recommendation**: Validate code and UUPS UUID, use a standard proxy design, run storage-layout and fork upgrade tests, and retain a deliberately governed recovery process.
+
+## [L-01] Debt shares are rounded down when borrowing
+**Severity**: Low  
+**Category**: Precision  
+**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`)  
+**Description**: `amount * WAD / borrowIndex` rounds debt shares down while transferring the full amount. Once the index exceeds WAD, a one-base-unit borrow records zero debt and passes without collateral. Repetition undercharges debt, but for six-decimal USDC the extractable amount per call is below one micro-USDC and is not economically profitable at normal gas costs.  
+**Proof of Concept**: After interest accrues, call `borrow(1)` with no collateral; the principal increment is zero while one base unit transfers.  
+**Recommendation**: Round debt shares up on borrowing and require a nonzero share delta and a sensible minimum borrow.
+
+## [L-02] Interest uses an imprecise Arbitrum block-to-time conversion
+**Severity**: Low  
+**Category**: Arbitrum / accounting  
+**Location**: `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:117`)  
+**Description**: Arbitrum's Solidity `block.number` approximates the L1 block number and advances in steps; multiplying it by a fixed 12 seconds is not reliable elapsed wall time. Borrowers or the treasury receive slightly incorrect interest, and accrual can jump after periods where the reported number does not advance.  
+**Proof of Concept**: Compare `blocksElapsed * 12` with `block.timestamp - lastAccrualTimestamp` across Arbitrum blocks; the values can differ and update at different cadence.  
+**Recommendation**: Store a timestamp and accrue from `block.timestamp - lastAccrualTimestamp`, with a reasonable maximum interval and tests for sequencer outages.
+
+## [L-03] Liquidation discards value lost to token-unit rounding
+**Severity**: Low  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:224`)  
+**Description**: Collateral units round down, but `seizeUsd` is reduced by the full unrounded value. The liquidator can receive slightly less than paid for; for a future low-decimal, high-price token, a nontrivial requested seizure can round to zero.  
+**Proof of Concept**: If `takeUsd * unit < price`, the seized token amount is zero although `takeUsd` is fully subtracted.  
+**Recommendation**: Reduce remaining seizure value by the actual value transferred, or round units up subject to the user's balance and a documented policy.
+
+## [L-04] Feed and token decimal assumptions can freeze an asset
+**Severity**: Low  
+**Category**: Configuration validation  
+**Location**: `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `_liquidate()`  
+**Description**: A feed with more than 18 decimals underflows `18 - decimals`; a token with sufficiently large decimals overflows `10 ** decimals`. Price-dependent borrow, withdrawal, and liquidation then revert, potentially trapping users after a bad future listing.  
+**Proof of Concept**: Configure a feed reporting 19 decimals or list a token reporting 78 decimals and call the relevant valuation function.  
+**Recommendation**: Validate and cache code presence and decimal ranges before listing. Normalize multiplication and division in both directions with full-precision math and provide a safe delisting/migration path.
+
+## Planned-collateral constraints
+
+- The current fixed-balance vault is unsafe for rebasing tokens: a negative rebase leaves fictitious balances and bad-debt capacity, while a positive rebase becomes unallocated. Use non-rebasing wrappers or share-based adapters.
+- weETH and ezETH require wrapper-specific exchange-rate and market-price handling; do not map either 1:1 to ETH/USD.
+- USDT and USDC can be paused or blocklisted. Define an emergency mode that stops new borrowing, handles interest fairly, and provides a post-recovery repayment grace period. Consider isolated markets so one frozen custody address does not affect unrelated assets.
+
+These are listing gates rather than separate launch findings because only wstETH collateral and USDC debt are currently intended to be enabled.
+
+## Verification priorities
+
+Before deployment, add unit, fuzz, invariant, and Arbitrum-fork tests covering:
+
+- only authorized upgrades and configuration; atomic initialization; incompatible upgrade rejection;
+- debt conservation across every borrow/repay sequence and exact full closure;
+- health-factor boundaries and withdrawal after long idle periods;
+- wstETH conversion, stale/invalid rounds, sequencer outage and recovery;
+- liquidation solvency, rounding, partial liquidation, slippage, and bad-debt handling;
+- zero values, unusual token behavior, callbacks, pauses, and all planned asset adapters.
diff --git a/findings-chain.md b/findings-chain.md
deleted file mode 100644
index 3082a2a277646a7d034774743452e922dab69f32..0000000000000000000000000000000000000000
--- a/findings-chain.md
+++ /dev/null
@@ -1,21 +0,0 @@
-## [CHAIN-1] Sequencer recovery permits borrowing and liquidation against stale prices
-**Severity**: High
-**Category**: evm-audit-chain-specific
-**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:34-41`), consumed by `LendingMarket._borrow()`, `LendingMarket.liquidate()`, and `LendingMarket._liquidate()`
-**Description**: The market is explicitly targeting Arbitrum One, but its Chainlink adapter calls `latestAnswer()` and performs no Arbitrum sequencer-uptime check, recovery grace period, or `updatedAt` freshness check. During a sequencer outage users cannot repay, add collateral, or liquidate. On recovery, the last published answer may predate a large off-chain price movement, while transactions can resume before a trustworthy post-recovery price has propagated. An attacker can deposit collateral whose stale answer is too high and borrow real USDC that the collateral no longer covers. Conversely, a stale-low answer can make an otherwise solvent borrower liquidatable; a liquidator receives that user's collateral and bonus before the price catches up. This is an Arbitrum-specific amplification of the missing freshness validation because the sequencer outage simultaneously prevents users and keepers from taking protective actions.
-**Proof of Concept**: (1) The Arbitrum sequencer becomes unavailable while wstETH falls materially in external markets. (2) The on-chain feed remains at its pre-outage value and users cannot transact. (3) Immediately after sequencing resumes, before the collateral feed publishes a fresh round, an attacker deposits wstETH and calls `borrow()`. `getPrice()` returns the old high answer, the health check passes, and the attacker receives more native USDC than their collateral can support at the current market price. The treasury is left with bad debt after the feed catches up. The reverse price movement permits premature liquidation of an existing borrower.
-**Recommendation**: Integrate Chainlink's Arbitrum sequencer uptime feed. Reject prices while the sequencer reports down and for a deliberately chosen grace period after it comes back up. Replace `latestAnswer()` with `latestRoundData()` and require a positive answer, a nonzero `updatedAt`, a completed round, and per-feed maximum age calibrated to that feed's Arbitrum heartbeat. During the outage and grace period, disable borrowing and liquidation while preserving risk-reducing actions where dependencies permit. Test outage, recovery, stale-round, and delayed-feed-update scenarios before launch.
-
-## [CHAIN-2] L1 block-number approximation makes interest timing coarse and chain-dependent
-**Severity**: Low
-**Category**: evm-audit-chain-specific
-**Location**: `LendingMarket.initialize()` and `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:70`, `src/LendingMarket.sol:116-128`)
-**Description**: Arbitrum exposes an approximate L1 block number through Solidity's `block.number`, not the Arbitrum L2 block number. Many L2 transactions therefore share one value, and its progress is not a protocol guarantee that exactly 12 seconds elapsed per increment. The market nevertheless converts the difference to time using the Ethereum-specific `SECONDS_PER_BLOCK = 12`. Interest does not accrue between any transactions sharing an L1 block, then accrues in steps, and long sequencer or L1 timing irregularities translate directly into debt-accounting error. Rapid same-block borrowing and repayment avoids the small amount of interest that wall-clock time would charge; more importantly, borrowers or the treasury can gain or lose whenever actual elapsed time diverges from `blocksElapsed * 12`. This is unlikely to create a large standalone extraction at a 4% annual rate, but it is avoidable financial-accounting drift in a production lending market.
-**Proof of Concept**: Execute `accrueInterest()` and then multiple borrow/repay operations in different Arbitrum L2 blocks that all report the same L1 `block.number`. Every call computes `blocksElapsed == 0`, so no interest is recorded even though time and L2 blocks elapsed. Conversely, if the exposed L1 block number advances several steps between calls, all estimated time is charged at once according to the hardcoded 12-second multiplier rather than actual elapsed seconds.
-**Recommendation**: Store `lastAccrualTimestamp` and compute interest from `block.timestamp - lastAccrualTimestamp`, with an explicit maximum accrual interval or administrative recovery procedure if desired. Do not use `ArbSys.arbBlockNumber()` as a substitute for elapsed time; it has L2-block rather than time semantics. Add tests covering many calls at the same `block.number`, sequencer downtime, and irregular block-number jumps.
-
-## Chain-specific checks with no additional finding
-
-- The README's native USDC address (`0xaf88...5831`) and wstETH address (`0x5979...0529`) are Arbitrum One addresses rather than Ethereum-mainnet or USDC.e addresses. The separate semantic error of assigning a stETH/USD feed directly to wstETH is reported by the ERC-20/oracle review and is not duplicated here.
-- No retryable-ticket, L2-to-L1 messaging, address-aliasing, `block.basefee`, hardcoded gas-price, `prevrandao`, native-ETH `transfer`/`send`, or chain-specific precompile logic exists in `src/`.
-- Solidity 0.8.28 may emit `PUSH0`, which is supported on current Arbitrum One; this is a deployment-compatibility concern only if the same bytecode is later deployed to a chain without Shanghai/PUSH0 support.
diff --git a/findings-erc20.md b/findings-erc20.md
deleted file mode 100644
index fe11693bdc9d4c7a7e1efe27382c440339639b26..0000000000000000000000000000000000000000
--- a/findings-erc20.md
+++ /dev/null
@@ -1,39 +0,0 @@
-## [ERC20-1] wstETH is priced as one stETH, overstating liquidation severity and collateral seized
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `LendingMarket.collateralValueUsd()` and `LendingMarket._liquidate()` (`src/LendingMarket.sol:132-138`, `src/LendingMarket.sol:219-230`); launch feed configuration in `README.md`
-**Description**: The launch configuration maps wstETH to a stETH/USD feed, while both valuation paths multiply the user's raw wstETH units directly by that feed price. One wstETH is a yield-bearing wrapper representing a changing quantity of stETH; it is not one stETH. The omitted `stEthPerToken()` conversion systematically undervalues wstETH and makes the effective loan-to-value and liquidation bonus differ from the configured 80% threshold and 5% bonus. The same integration error will recur if weETH or ezETH is listed against an ETH/USD feed without composing in its exchange rate. A borrower can be liquidated while economically above the advertised collateral threshold, and the liquidator receives more underlying value than the configured bonus at the borrower's expense.
-**Proof of Concept**: Suppose one wstETH represents 1.20 stETH. A user deposits 1 wstETH when the stETH feed is $2,400 and borrows $1,000; the account passes the current health check. The stETH feed later falls to $1,900. The market reports $1,900 of collateral while the wrapper is economically worth $2,280, and the position is liquidatable under the current implementation. `_liquidate()` calculates a nominal $1,050 seizure and transfers about 0.5526 wstETH. At the actual wrapper rate that is $1,260 of value: an effective 26% premium over repaid debt rather than 5%. The extra $210 comes from the borrower. (The separate loss-of-precision defect in `healthFactor()` makes the liquidation boundary even harsher; correcting it does not correct this wrapper price or seizure error.)
-**Recommendation**: Price the collateral token itself. For wstETH, either configure a maintained wstETH/USD feed or compose stETH/USD with wstETH's `stEthPerToken()` rate using explicit decimal normalization. Use asset-specific adapters for weETH and ezETH rather than assuming every wrapped LST/LRT is 1:1 with ETH. Test valuation and seizure against live wrapper conversion rates and define conservative handling for rate decreases/slashing.
-
-## [ERC20-2] Nominal deposit accounting lets non-standard collateral create unbacked borrowing power
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.deposit()` (`src/CollateralVault.sol:35-41`)
-**Description**: `deposit()` credits the caller-supplied `amount` without checking the vault's balance delta and ignores the return value of `transferFrom`. For a fee-on-transfer token the vault receives less than the credited amount. For a token that returns `false` without reverting, it may receive nothing and still credit the full amount. `LendingMarket.listCollateral()` provides no token-behavior validation, so a future listing can turn the discrepancy into borrowable collateral. An attacker deposits repeatedly, receives inflated accounting, borrows real USDC from the treasury, and leaves bad debt that the vault cannot cover. Raw transfers elsewhere also ignore a returned `false`, but this deposit path is the direct accounting exploit.
-**Proof of Concept**: Governance lists a token with a valid price feed that charges a 10% transfer fee. The attacker calls `deposit(token, 1_000e18)`; the vault receives 900 tokens but records 1,000. Health checks value 1,000 tokens and permit borrowing against them. With a token returning `false` and moving no funds, the same call records 1,000 tokens backed by zero. The attacker borrows USDC; liquidation or withdrawal later fails once actual vault inventory is exhausted.
-**Recommendation**: Use a checked transfer helper and derive the credited amount from `balanceAfter - balanceBefore`. If only exact-transfer collateral is supported, require the delta to equal `amount` and revert otherwise. Document and enforce an explicit token-adapter/allowlist policy before listing weETH, ezETH, USDT, or any future asset; never infer ERC-20 compatibility solely from the interface.
-
-## [ERC20-3] Cached balances are incompatible with the planned rebasing-collateral path
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.balanceOf`, `CollateralVault.deposit()`, `CollateralVault.withdraw()`, and `LendingMarket.collateralValueUsd()` (`src/CollateralVault.sol:12`, `src/CollateralVault.sol:35-52`, `src/LendingMarket.sol:132-138`)
-**Description**: User collateral is stored as a fixed token amount and never reconciled to the vault's actual balance. If a listed token negatively rebases, recorded balances and borrowing power remain unchanged even though backing has disappeared. Borrowers can retain or take USDC loans against nonexistent collateral, while withdrawals and liquidations eventually revert or become first-come-first-served. A positive rebase creates unallocated assets that depositors cannot claim. This does not affect non-rebasing wstETH itself, but it makes the README's planned path to rebasing collateral unsafe without a different accounting model.
-**Proof of Concept**: Two users each deposit 100 units of a listed rebasing token, so total internal balances and vault inventory are 200. After a 20% negative rebase the vault owns 160, while each user's recorded balance remains 100 and health calculations still value 200 total. Both can continue borrowing based on the stale amounts. The first user may withdraw or be seized for 100, leaving only 60 backing the second user's recorded 100; attempts to transfer the remaining nominal amount revert and USDC debt can become bad debt.
-**Recommendation**: Do not list rebasing tokens in the current vault. Prefer their non-rebasing wrapper, priced with its conversion rate. If direct rebasing support is required, implement share-based accounting (`userShares / totalShares`) against actual assets, specify who receives positive rebases and absorbs negative rebases, and validate every deposit, withdrawal, health check, and liquidation under both directions of rebase before governance can enable the asset.
-
-## [ERC20-4] USDC/USDT issuer controls can freeze shared custody and block risk reduction
-**Severity**: Medium
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.deposit()`, `CollateralVault.withdraw()`, `CollateralVault.seize()`, `LendingMarket.repay()`, `LendingMarket._borrow()`, and `LendingMarket._liquidate()`
-**Description**: USDC (the debt asset) and shortlisted USDT have issuer pause and address-blocklist controls. All debt liquidity is held by `LendingMarket`, and all collateral of a given token is pooled in `CollateralVault`. If the market is blocked, seeded USDC and repayments can be frozen for every user. If the vault is blocked after USDT is listed, every depositor's USDT is frozen. A global token pause can prevent repayment and liquidation during a price move; after transfers resume, borrowers may face immediate liquidation because the protocol has no emergency mode or grace period. A single user's blocklisting can also prevent that user's repayment or collateral withdrawal even when they are trying to reduce risk.
-**Proof of Concept**: A borrower has USDC debt and USDT collateral. Tether pauses transfers or blocks the vault address, making `withdraw()` and `seize()` revert for all USDT positions. Alternatively Circle pauses USDC, making `repay()` and `_liquidate()` revert. Prices and interest continue to move while users cannot repay and keepers cannot liquidate. When transfers resume, accounts may be underwater and liquidated despite having had no on-chain path to cure them during the outage.
-**Recommendation**: Treat issuer controls as an explicit listing risk. Add a protocol emergency state that stops new borrows and interest accrual/liquidations when the debt asset or a major collateral cannot transfer, followed by a governance-controlled recovery/grace period. Isolate centrally controlled collateral in separate vaults/markets where practical so one blocklisted custody address does not freeze unrelated assets. Publish this dependency and rehearse pause/blocklist incident procedures before launch and before listing USDT.
-
-## [ERC20-5] Unbounded token decimals can permanently disable account health operations
-**Severity**: Medium
-**Category**: evm-audit-erc20
-**Location**: `LendingMarket.listCollateral()`, `LendingMarket.collateralValueUsd()`, `LendingMarket.debtValueUsd()`, and `LendingMarket._liquidate()` (`src/LendingMarket.sol:107-114`, `src/LendingMarket.sol:132-143`, `src/LendingMarket.sol:219-230`)
-**Description**: Collateral listing validates neither that `token` is a contract nor that its `decimals()` is within a safe supported range. Valuation computes `10 ** decimals`; a listed token returning a sufficiently large value (78 or above) causes checked exponentiation to revert. Because `collateralValueUsd()` iterates the global token list, any user with a nonzero recorded amount of that asset can no longer borrow, pass the post-withdraw health check, or be liquidated. Tokens with unusual but smaller decimals can also create unsupported rounding behavior. This is a governance-triggered integration failure, but it can strand positions after a mistaken or compromised listing.
-**Proof of Concept**: Governance lists a token whose `decimals()` returns 78 and configures a feed. A user deposits one unit. Every call to `collateralValueUsd(user)` reaches `10 ** 78` and reverts from overflow. Consequently `healthFactor`, borrowing, collateral withdrawal (which calls `requireHealthy`), and liquidation for that account revert.
-**Recommendation**: Validate token code and cache normalized decimal metadata at listing time. Restrict decimals to a deliberately supported range (normally no more than 18 unless higher-decimal assets are explicitly tested), reject zero addresses/EOAs, and use a full-precision normalization library or asset adapter rather than unchecked generic exponentiation. Add a safe delisting/migration mechanism for a token whose metadata or implementation changes.
diff --git a/findings-general.md b/findings-general.md
deleted file mode 100644
index 85203bca72def126fa013964b28da77eed39b9d7..0000000000000000000000000000000000000000
--- a/findings-general.md
+++ /dev/null
@@ -1,63 +0,0 @@
-## [G-1] Anyone can replace the market implementation and seize all protocol assets
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo` has no authorization check and writes an arbitrary address directly to the ERC-1967 implementation slot. Because calls reach this function through `MarketProxy`, any account can replace the live implementation. The replacement executes in the proxy's storage context and the proxy is also the immutable `market` trusted by `CollateralVault`, so malicious implementation code can transfer the market's USDC and invoke `vault.seize` against every depositor. The attacker receives all treasury liquidity and all deposited collateral.
-**Proof of Concept**: (1) Deploy an implementation with a function that transfers the proxy's full USDC balance to the attacker and calls `CollateralVault.seize(user, token, attacker, amount)`. (2) Call `upgradeTo(maliciousImplementation)` through `MarketProxy`; the unguarded function stores the attacker's address. (3) Call the malicious function through the proxy. It executes as the trusted market and drains both contracts.
-**Recommendation**: Add `onlyOwner` to `upgradeTo`, reject `address(0)` and implementations with no code, and use a battle-tested UUPS implementation that verifies `proxiableUUID`. Put upgrade authority behind a timelock/multisig. Also disable initialization of the implementation contract itself.
-
-## [G-2] Anyone can install a malicious oracle and borrow the entire USDC treasury against dust
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)
-**Description**: `setOracle` lacks `onlyOwner`, so an arbitrary caller can replace the oracle. An attacker-controlled oracle can report an enormous collateral price and a minimal debt-asset price, making a dust-backed account appear healthy. The attacker can then borrow the market's directly seeded USDC balance and keep it; the recorded collateral cannot cover the debt.
-**Proof of Concept**: (1) Deposit a small amount of a listed collateral. (2) Deploy a contract implementing `getPrice` that returns an attacker-chosen high price for the collateral and a low positive price for USDC. (3) Call `setOracle` with that contract. (4) Call `borrow` for the market's full USDC balance. The manipulated health check passes and the real USDC is transferred to the attacker.
-**Recommendation**: Add `onlyOwner` to `setOracle`, reject zero/non-contract addresses, and preferably use a two-step, timelocked oracle update controlled by a multisig. Validate the new oracle against expected feeds and bounds before activating it.
-
-## [G-3] Anyone can weaken the liquidation threshold and drain treasury liquidity
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)
-**Description**: `setLiquidationThreshold` is publicly callable and accepts an unbounded value. A caller can set it far above `BPS`, causing nearly uncollateralized positions to pass `healthFactor`. The attacker receives real USDC while the protocol is left with bad debt backed by negligible collateral.
-**Proof of Concept**: (1) Deposit a minimal amount of listed collateral. (2) Call `setLiquidationThreshold(type(uint256).max / 1e18)` or another very large value that does not overflow the particular health-factor calculation. (3) Borrow up to the market's USDC liquidity. The inflated threshold makes the health factor exceed `1e18` despite insufficient collateral.
-**Recommendation**: Add `onlyOwner` and enforce a conservative bound such as `0 < bps && bps <= BPS`. Apply governance delay/multisig controls to risk-parameter changes and add invariant tests proving that increasing the threshold cannot permit undercollateralized borrowing.
-
-## [G-4] Callback-capable collateral can be withdrawn multiple times while leaving fictitious collateral recorded
-**Severity**: High
-**Category**: evm-audit-general
-**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)
-**Description**: `withdraw` transfers tokens before reducing `balanceOf` and before checking account health. A listed ERC777-like or otherwise callback-capable token can reenter `withdraw` during `transfer`. Every nested call reads the same pre-withdraw balance, transfers again, and then writes the same final balance. The account can therefore remove more collateral than it is charged for, retain an overstated vault balance, and borrow USDC that is no longer backed. The README explicitly plans to broaden collateral support, including yield-bearing and rebasing assets, making the token-behavior assumption security-critical.
-**Proof of Concept**: (1) A callback-capable token is listed and an attacker deposits `X`. (2) The attacker calls `withdraw(token, X)`. (3) During the token transfer callback, the attacker reenters `withdraw(token, X)`. Both invocations observe `balanceOf == X`, both transfer `X`, and both finally store zero. With a partial amount, the same technique can leave a positive fictitious balance that supports a USDC borrow.
-**Recommendation**: Follow checks-effects-interactions: decrement `balanceOf` before calling the token, then perform the health check and transfer (a revert rolls all changes back). Add a reentrancy guard as defense in depth and explicitly vet or reject callback/rebasing collateral types until accounting supports them.
-
-## [G-5] Unchecked ERC20 return values allow unbacked balances or debt cancellation
-**Severity**: High
-**Category**: evm-audit-general
-**Location**: `CollateralVault.deposit()`, `CollateralVault.withdraw()`, `CollateralVault.seize()`, `LendingMarket.repay()`, `LendingMarket._borrow()`, and `LendingMarket._liquidate()`
-**Description**: Every ERC20 `transfer`/`transferFrom` return value is ignored. A token that returns `false` instead of reverting can cause state transitions to complete without the corresponding asset movement. Most critically, a false-returning listed collateral creates credited collateral without a deposit, and a false-returning debt asset lets `repay` reduce debt or `_liquidate` clear a borrower's entire debt without receiving payment. The immediate launch assets may revert on failure, but the implementation presents the same unchecked generic interface for planned future listings and upgrades.
-**Proof of Concept**: For a listed token whose `transferFrom` returns `false`, call `deposit(token, amount)`. No tokens arrive, but `balanceOf[msg.sender][token]` increases by `amount`; the attacker then borrows real USDC against the fictitious balance. Alternatively, if a configured debt token returns `false`, calling `repay` reduces principal even though the market receives nothing.
-**Recommendation**: Use a safe-transfer library that accepts either `true` or empty returndata and reverts on `false` or malformed returndata. For collateral deposits, additionally measure the vault's balance before and after transfer and credit only the amount actually received; define explicit policy for fee-on-transfer and rebasing assets.
-
-## [G-6] Borrow authorizations have no nonce or deadline and can be replayed indefinitely
-**Severity**: Medium
-**Category**: evm-audit-general
-**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)
-**Description**: The signed struct contains only `borrower` and `amount`; it has neither a nonce nor expiry, and no digest is marked consumed. Anyone who sees one authorization can submit it repeatedly for as long as the account remains healthy. The recipient is the borrower, so a relayer does not directly steal the proceeds, but they can force the signer to take repeated unwanted debt, consume their borrowing capacity, and push the position to the liquidation boundary. A signature also remains valid indefinitely and after repayment.
-**Proof of Concept**: Obtain one valid signature authorizing a borrow of `A`. Call `borrowWithSig(borrower, A, ...)` repeatedly. Every call recovers the same borrower and succeeds until the health check or market liquidity stops it. After the borrower repays, the same old signature can be replayed again.
-**Recommendation**: Include a per-borrower nonce, deadline, and preferably the intended relayer/receiver in `BORROW_TYPEHASH`; check the deadline and increment the nonce before borrowing. Use a standard EIP-712/ECDSA implementation that rejects malleable signatures and invalid `v` values.
-
-## [G-7] The borrower array can be grown without bound until batch liquidation is unusable
-**Severity**: Medium
-**Category**: evm-audit-general
-**Location**: `LendingMarket._borrow()` and `LendingMarket.liquidateAll()` (`src/LendingMarket.sol:197`, `src/LendingMarket.sol:190`)
-**Description**: `_borrow` appends whenever `principalOf[borrower] == 0` but entries are never removed or marked as already known. Any account can repeatedly call `borrow(0)`, for which the principal remains zero and the zero-debt health factor is maximal, adding another entry each time. Normal users can also be added repeatedly after repaying. `liquidateAll` scans the entire attacker-growable array and performs oracle/vault calls per live entry; eventually it exceeds the Arbitrum transaction gas limit. Keepers lose the documented ability to sweep underwater positions during a sharp price move, increasing the chance of bad debt, although individual `liquidate` remains available.
-**Proof of Concept**: From one address, call `borrow(0)` thousands of times. Each call pushes that address into `borrowers` because its principal remains zero. Calling `liquidateAll` must iterate across all duplicate entries and eventually runs out of gas before completing.
-**Recommendation**: Reject zero and dust borrows, maintain an `isBorrower` membership flag, and remove users with an indexed set when debt reaches zero. Replace all-at-once liquidation with a bounded, cursor-based batch function accepting a maximum number of positions.
-
-## [G-8] Proxy construction permits an EOA implementation and an uninitialized deployment
-**Severity**: Low
-**Category**: evm-audit-general
-**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`)
-**Description**: The constructor does not verify that `implementation` contains code, and it allows empty `initData`. A delegatecall to a non-contract address reports success, so deployment tooling can silently create a proxy with no executable implementation. If initialization is omitted, `LendingMarket.initialize` remains publicly callable and an observer can become `owner`. The currently unprotected setters/upgrader make ownership less consequential, but once those Critical issues are fixed this deployment footgun becomes an ownership takeover or permanent deployment failure.
-**Proof of Concept**: Deploy `MarketProxy` with an EOA as `implementation` and non-empty encoded initialize data; `delegatecall` succeeds with empty returndata and the proxy deploys unusably. Or deploy a valid implementation with empty `initData`, then have another account call `initialize` through the proxy first and set itself as owner.
-**Recommendation**: Require `implementation.code.length > 0`, require non-empty initialization data for this deployment, and atomically delegatecall `initialize` in the constructor. Make the deployment script assert initialized owner, oracle, vault, and debt asset immediately after deployment.
diff --git a/findings-lending.md b/findings-lending.md
deleted file mode 100644
index 78375b3dfc090d2af7464faf1597867d0a74098c..0000000000000000000000000000000000000000
--- a/findings-lending.md
+++ /dev/null
@@ -1,47 +0,0 @@
-# Lending and Liquidation Findings
-
-## [HIGH] LEND-01 — Divide-before-multiply makes healthy positions liquidatable
-
-- **Contract / function:** `LendingMarket.sol`, `healthFactor()`
-- **Impact:** The market does not enforce the documented 80% liquidation threshold. Because the collateral/debt ratio is truncated to a whole integer first, every position with a collateral ratio from 100% through just under 200% receives the same health factor of `0.8e18` and is liquidatable. For example, a user with $150 of collateral and $100 of debt should have a health factor of 1.2, but the contract reports 0.8. A liquidator can repay the $100 debt and take $105 of collateral from this solvent user. The same error prevents users from borrowing to the advertised 80% LTV; they need at least 200% collateralization to pass the check.
-- **Cause:** `return (collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS;` performs integer division before applying the fixed-point scale.
-- **Fix:** Multiply before dividing, using overflow-safe full-precision math: `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Add boundary tests immediately below, at, and above 125% collateralization, plus fuzz tests against a high-precision reference implementation.
-
-## [HIGH] LEND-02 — The configured stETH/USD feed materially underprices wstETH collateral
-
-- **Contract / function:** Deployment configuration described in `README.md`; consumed by `LendingMarket.collateralValueUsd()` and `LendingMarket._liquidate()` through `PriceOracle.getPrice()`
-- **Impact:** wstETH is not redeemable 1:1 for stETH; one wstETH represents an increasing amount of stETH. Feeding the stETH/USD price directly as the price of one wstETH therefore undervalues every user's collateral by the wstETH/stETH exchange rate. Users can be liquidated before the intended threshold. During liquidation, the same underpricing makes the market transfer more wstETH than the stated 5% bonus, so a liquidator extracts the exchange-rate difference from the borrower in addition to the bonus.
-- **Cause:** The planned wstETH listing maps wstETH to the stETH/USD feed without converting through `wstETH.stEthPerToken()` (or using a purpose-built wstETH/USD feed).
-- **Fix:** Use Chainlink's Arbitrum wstETH/USD feed if supported and validate its heartbeat, or compose stETH/USD with the canonical wstETH-to-stETH conversion rate using carefully normalized fixed-point math. Test valuation and seizure using the live non-1:1 exchange rate before deployment.
-
-## [MEDIUM] LEND-03 — Full repayment can leave an unrepayable scaled-debt remainder
-
-- **Contract / function:** `LendingMarket.sol`, `repay()` and `debtOf()`
-- **Impact:** After interest makes `borrowIndex > 1e18`, repaying the displayed full debt can leave one or more units of scaled principal because both conversions round down. Once the displayed debt is very small, `amount * WAD / borrowIndex` can be zero, so further repayments transfer USDC without reducing principal. The borrower cannot close the position normally and cannot withdraw all collateral; their only escape is liquidation or a contract upgrade.
-- **Cause:** `debtOf()` rounds scaled principal down to debt units, then `repay()` independently rounds the debt payment down when converting it back to scaled principal. The full-repayment branch is not distinguished from partial repayment.
-- **Fix:** When `amount >= debt`, collect exactly `debt` and set `principalOf[onBehalfOf] = 0`. For partial repayments, define explicit rounding direction and reject a payment whose scaled reduction is zero. Add invariant tests that a full repayment always clears principal and that every accepted partial repayment reduces debt.
-
-## [MEDIUM] LEND-04 — Anyone can permanently gas-grief the keeper's bulk liquidation path for free
-
-- **Contract / function:** `LendingMarket.sol`, `_borrow()` and `liquidateAll()`
-- **Impact:** An attacker can call `borrow(0)` from arbitrarily many addresses. Each call appends the address to `borrowers` because its principal remains zero. Entries are never removed, and addresses can also be appended again after repayment or liquidation. The attacker pays no USDC and posts no collateral, yet can grow the array until `liquidateAll()` cannot fit in a block. Following a sharp price move, the documented keeper sweep becomes unusable, increasing the chance that positions remain underwater and turn into bad debt. Individual liquidations remain possible, but the intended crisis-response mechanism is lost.
-- **Cause:** `_borrow()` accepts zero and appends whenever current principal is zero; `liquidateAll()` performs an unbounded iteration over an append-only array.
-- **Fix:** Reject zero-value borrows, track membership separately, remove borrowers on closure, and replace the all-at-once sweep with bounded pagination (`start`, `maxCount`) or off-chain discovery plus individual liquidations. Set a meaningful minimum debt size so liquidation rewards cover Arbitrum execution costs.
-
-## [MEDIUM] LEND-05 — Deeply underwater positions have no economically viable liquidation path
-
-- **Contract / function:** `LendingMarket.sol`, `_liquidate()`
-- **Impact:** A liquidator must repay 100% of a user's debt before receiving collateral. If a fast oracle update or accrued interest makes the remaining collateral worth less than the debt, liquidation guarantees a loss: the liquidator pays the full debt and receives at most all collateral. Rational liquidators will leave the position untouched, so the treasury retains uncollectible debt and the account remains open indefinitely. Requiring the full debt also makes large liquidations unnecessarily capital-intensive.
-- **Cause:** Liquidation has no close factor, partial-repayment parameter, bad-debt settlement, or reserve/insurance backstop. The nominal 5% bonus cannot help once collateral value is below debt value.
-- **Fix:** Implement partial liquidation with a caller-specified repay amount and minimum collateral-out protection. Cap the bonus to available collateral, explicitly recognize residual bad debt, and fund a reserve/insurance mechanism able to settle it. Add simulations for abrupt 50%+ collateral moves and define who absorbs insolvency.
-
-## [MEDIUM] LEND-06 — USDC downtime accrues debt while repayment and liquidation are impossible
-
-- **Contract / function:** `LendingMarket.sol`, `accrueInterest()`, `repay()`, and `liquidate()`
-- **Impact:** Native USDC on Arbitrum is centrally pausable. While it is paused, borrowers cannot transfer USDC into the market to repay and liquidators cannot fund liquidations, but interest continues to advance by elapsed blocks. When transfers resume, borrowers that crossed the threshold during the outage can be liquidated immediately by bots before they have a practical chance to repay. Users lose collateral because of an external pause they could not defend against.
-- **Cause:** There is no market pause/emergency accounting mode and no post-resumption grace period; interest is calculated purely from elapsed blocks at the next state change.
-- **Fix:** Add a narrowly scoped emergency mode that freezes borrowing and interest/liquidation eligibility while the debt token is unavailable, while preserving safe collateral additions where possible. On resumption, provide a bounded repayment grace period before liquidation. Document governance controls and test pause/resume scenarios against a pausable USDC mock.
-
-## Notes on prospective collateral
-
-The README proposes weETH, ezETH, USDT, and later rebasing/yield-bearing assets. Do not treat wrappers as 1:1 with their underlying assets: each listing needs an independent market-price path or an explicitly validated wrapper conversion plus underlying feed. The current vault's nominal-balance accounting is also not suitable for rebasing tokens without an adapter/share-accounting layer. These are listing requirements rather than launch findings because those assets are not yet enabled.
diff --git a/findings-oracles.md b/findings-oracles.md
deleted file mode 100644
index b0fe4017335ba20b5f607c148aa9772be1ee7121..0000000000000000000000000000000000000000
--- a/findings-oracles.md
+++ /dev/null
@@ -1,42 +0,0 @@
-# Oracle and Pricing Findings
-
-## [CRITICAL] Anyone can replace the market oracle and drain all seeded USDC
-
-- **Contract / function:** `LendingMarket.setOracle()` (`src/LendingMarket.sol:91-94`)
-- **What happens:** `setOracle` has no access control. An attacker can deploy an oracle that reports an arbitrarily large collateral price (and a normal or tiny USDC price), call `setOracle`, deposit a trivial amount of wstETH, and borrow the market's entire seeded USDC balance. The same primitive can make every existing account appear underwater and let the attacker liquidate users at attacker-chosen prices. The attacker receives the treasury's USDC and/or users' collateral; the protocol is left with bad debt.
-- **Recommended fix:** Add `onlyOwner` (preferably a timelocked governance role) to `setOracle`. Validate that the new address is nonzero and contains code. Use a two-step/timelocked oracle change with an emergency pause, and test the candidate oracle for every listed collateral and the debt asset before activation.
-
-## [HIGH] wstETH is priced as one stETH, overpaying liquidators in wstETH
-
-- **Contract / function:** Launch feed configuration consumed by `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `LendingMarket._liquidate()` (`src/PriceOracle.sol:39-45`, `src/LendingMarket.sol:132-138, 209-230`)
-- **What happens:** The README maps wstETH (`0x5979...0529`) directly to the stETH/USD feed (`0x07C5...f2a`). One wstETH represents more than one stETH because staking rewards accumulate in its conversion rate. The market therefore treats `1 wstETH == 1 stETH`. This understates users' collateral value, makes them borrow less than intended and become liquidatable prematurely. More importantly, liquidation computes the number of wstETH to seize by dividing a USD claim by the stETH price. A liquidator receives `(1 + bonus)` worth of **stETH units** as wstETH units, whose real value is higher by the wstETH/stETH exchange rate. Thus a liquidator extracts more than the configured 5% bonus from the unlucky borrower; the excess grows as staking rewards accumulate.
-- **Recommended fix:** Price wstETH itself. Compose a manipulation-resistant wstETH/stETH conversion rate with the stETH/USD feed (with independent freshness and validity checks), or use an appropriate dedicated wstETH/USD route. Unit-test both collateral valuation and seized-token amounts against the live conversion rate; never map wstETH directly to stETH/USD at 1:1.
-
-## [HIGH] Prices have no round-validity or freshness checks
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:39-45`)
-- **What happens:** The oracle calls deprecated `latestAnswer()` and cannot inspect `updatedAt`, `roundId`, `answeredInRound`, or `startedAt`. If either feed stops updating, all borrowing and liquidation continue indefinitely at the last price. An attacker can borrow excessive USDC against collateral whose market value has already fallen, leaving bad debt; in the reverse direction, users can be liquidated using an obsolete low collateral price or high USDC price. A deprecated/disabled feed can also brick every price-dependent operation.
-- **Recommended fix:** Use `latestRoundData()` and require `answer > 0`, `startedAt != 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Store a per-feed maximum age based on that feed's Arbitrum heartbeat/deviation policy, rather than one global threshold. Add a controlled pause/fallback process for an unavailable or deprecated feed.
-
-## [MEDIUM] Arbitrum sequencer outages are not checked and no recovery grace period is enforced
-
-- **Contract / function:** `PriceOracle.getPrice()` and all price-dependent borrow/liquidation paths (`src/PriceOracle.sol:39-45`)
-- **What happens:** The deployment target is Arbitrum One, but the oracle never checks Chainlink's Arbitrum sequencer uptime feed. After the sequencer recovers, market transactions may execute before asset feeds have caught up. A borrower can exploit a pre-outage high collateral price to take USDC that is no longer adequately collateralized; a liquidator can exploit a pre-outage low price to seize collateral from a position that is healthy at current prices. Users or the treasury bear the difference.
-- **Recommended fix:** Before accepting any asset price, query the Arbitrum sequencer uptime feed, require the sequencer status to be up, validate its round data, and require at least a one-hour grace period since recovery. Apply this check consistently to borrow, withdraw-health checks, and liquidation.
-
-## [MEDIUM] Feed answers are not protected against zero, negative, or circuit-breaker values
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:39-45`), consumed by `LendingMarket.healthFactor()` and `_liquidate()`
-- **What happens:** A zero USDC/USD answer makes every debt position appear to have zero USD debt, so `healthFactor` returns the maximum value and an attacker with minimal collateral can borrow all available USDC. A zero collateral answer makes liquidation revert when `_liquidate` divides by `price`, preventing bad-debt containment. A negative answer is cast to `uint256` and generally causes arithmetic overflow/reverts for the configured 8-decimal feeds, globally denying borrow, withdraw, and liquidation. Finally, no check rejects a Chainlink aggregator's `minAnswer`/`maxAnswer`; in an extreme crash a floored collateral price can remain above the true market price and permit undercollateralized borrowing.
-- **Recommended fix:** Explicitly reject `answer <= 0`. For each feed, evaluate the underlying aggregator's configured bounds and reject boundary answers, or install independent conservative price/deviation circuit breakers and pause affected actions. Handle invalid values by pausing new borrowing while preserving safe repayment/emergency-resolution paths.
-
-## [LOW] Feeds with more than 18 decimals permanently revert price queries
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:44`)
-- **What happens:** Normalization evaluates `18 - feed.decimals()`. Any future feed with more than 18 decimals underflows and reverts. Because governance plans to list more assets, a mistaken feed selection can make valuation, withdrawals, borrowing, and liquidation revert for users exposed to that asset. Users gain nothing and can have positions stuck until governance repairs the feed.
-- **Recommended fix:** Normalize in both directions: multiply when decimals are below 18 and divide when above 18. Reject unreasonable decimal values during `setFeed`, and perform a successful validated price read before a collateral can be listed.
-
-## Oracle-specific notes
-
-- The configured addresses currently identify themselves on Arbitrum as `STETH / USD` and `USDC / USD`, both with 8 decimals. Dynamic decimal reads are therefore correct for the two launch feeds, but the wstETH denomination mismatch remains.
-- USDC is not hardcoded to USD parity; using USDC/USD is the correct direction. No TWAP, Pyth, LP-token pricing, or VRF path exists in the reviewed code.
diff --git a/findings-precision.md b/findings-precision.md
deleted file mode 100644
index de4c727d49c86b2c4e9bc1655e88fc66475df5c0..0000000000000000000000000000000000000000
--- a/findings-precision.md
+++ /dev/null
@@ -1,39 +0,0 @@
-## [P-1] Division before multiplication makes healthy positions liquidatable below 200% collateralization
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:145`)
-**Description**: The expression `(collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS` divides the two 18-decimal USD values before applying the WAD scale. This truncates every collateral-to-debt ratio between 1.0 and 1.999... to exactly 1. With the configured 80% threshold, such a position is reported at a health factor of 0.8 even when its intended health factor is as high as almost 1.6. Consequently, the implementation effectively requires 200% collateralization rather than 125% and allows liquidation of positions that are solvent under the documented parameters. A liquidator can pay the borrower's debt and receive collateral plus the 5% bonus; the borrower loses that bonus and is forcibly closed solely because of the precision error.
-**Proof of Concept**: A user has $1,500 of collateral and $1,000 of debt. The intended health factor is `1500e18 * 8000 * 1e18 / (1000e18 * 10000) = 1.2e18`, so the position is healthy. The implementation first evaluates `1500e18 / 1000e18` as `1`, then returns `1 * 8000 * 1e18 / 10000 = 0.8e18`. Any account can therefore call `liquidate(user)` and collect the configured liquidation bonus from this healthy borrower.
-**Recommendation**: Multiply before dividing, ideally with a full-precision `mulDiv`: `return Math.mulDiv(collateralValueUsd(user), liquidationThreshold * WAD, debtUsd * BPS);`. If bounds make the combined denominator unsafe, perform two full-precision operations while preserving the WAD scale and document the chosen rounding direction. Add boundary tests at exactly 125%, immediately above it, and immediately below it.
-
-## [P-2] Rounding borrow principal down permits uncollateralized micro-borrows that drain treasury liquidity
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`)
-**Description**: `_borrow()` credits principal with `amount * WAD / borrowIndex`, rounding down, but transfers the full requested USDC amount. As soon as interest has accrued and `borrowIndex > WAD`, borrowing one base unit of USDC records zero principal. Since `debtOf()` is then zero, `healthFactor()` returns `type(uint256).max`; the borrower needs no collateral. The attacker can repeat or batch this call, receiving treasury USDC each time while accruing no debt. The same rounding loss also undercharges larger repeated borrows by up to one principal unit per call.
-**Proof of Concept**: Wait until at least one block after initialization and call `accrueInterest()`, which makes `borrowIndex` greater than `1e18` at the nonzero configured rate. From an address with no collateral, call `borrow(1)` (one micro-USDC). The principal increment is `1 * 1e18 / borrowIndex = 0`; the health check sees no debt and passes; one USDC base unit is transferred. An attacker contract can loop this operation until the market's prefunded balance is exhausted (subject only to transaction gas and available liquidity).
-**Recommendation**: Round debt shares/principal up when borrowing, for example `principalDelta = Math.mulDiv(amount, WAD, borrowIndex, Math.Rounding.Ceil)`, and require `principalDelta != 0`. Use the exact rounded-up delta consistently for accounting. Add invariant tests asserting that every successful positive borrow increases `debtOf(borrower)` by at least the transferred amount and that an uncollateralized account can never receive debt assets.
-
-## [P-3] Full repayment rounds principal reduction down and leaves an irreducible debt residue
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket.repay()` (`src/LendingMarket.sol:170`)
-**Description**: Repayment reduces principal by `amount * WAD / borrowIndex`, rounded down. Even when `amount` equals the entire value returned by `debtOf()`, the inverse conversion commonly leaves one principal unit. Once the residue is small enough that `amount * WAD / borrowIndex == 0`, later repayments transfer USDC but do not reduce principal at all. Because `amount` is capped to the rounded-down `debt`, the user cannot overpay by one unit to clear it. A nonzero debt prevents the borrower from withdrawing all collateral, leaving collateral locked until an upgrade or a very long period of additional index growth; repeated attempts also directly lose the transferred USDC.
-**Proof of Concept**: Let `principalOf[user] = 1,000,000` and `borrowIndex = 1.0000001e18`. `debtOf(user)` rounds to `1,000,000`. Calling `repay(user, 1,000,000)` transfers that full amount but subtracts only `floor(1,000,000e18 / 1.0000001e18) = 999,999`, leaving principal `1`. `debtOf(user)` remains `1`, but another repayment of `1` subtracts `floor(1e18 / 1.0000001e18) = 0`; the residue cannot be cleared through `repay()` and a complete collateral withdrawal fails the health check.
-**Recommendation**: Special-case full repayment: after collecting `debt`, set `principalOf[onBehalfOf] = 0`. For partial repayments, choose and document protocol-favoring rounding and reject any positive payment whose calculated principal reduction is zero. A robust pattern is to calculate the principal reduction first, cap it to stored principal, derive the exact asset amount from that reduction with consistent rounding, and only then transfer funds.
-
-## [P-4] Liquidation charges for value that rounding does not seize
-**Severity**: Low
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)
-**Description**: The collateral amount `takeUsd * unit / price` rounds down, but `seizeUsd` is reduced by the full unrounded `takeUsd`. Thus the liquidator can receive slightly less collateral value than the accounting treats as seized. The shortfall is less than one smallest unit of each collateral token, which is negligible for launch wstETH but becomes material for a future low-decimal, high-price collateral. If `takeUsd < price / unit`, the seizure rounds to zero while the entire `takeUsd` is still discarded. This rounding favors the borrower at the liquidator's expense and can make marginal liquidations unattractive.
-**Proof of Concept**: For a listed token with `unit = 1e6`, `price = 3e18`, and `takeUsd = 2e12`, the calculated collateral amount is `2e12 * 1e6 / 3e18 = 0`. The vault transfers no collateral, yet `_liquidate()` subtracts the full `2e12` from `seizeUsd`; the liquidator has paid debt corresponding to that value without compensation.
-**Recommendation**: Choose a liquidation rounding policy explicitly. To deliver at least the promised seizure value, calculate token units with full-precision rounding up, capped by the user's balance, and reduce `seizeUsd` by the actual USD value of the units seized. Alternatively, round down but carry the unfilled remainder into the next collateral instead of discarding it. Enforce decimal and minimum-unit constraints when listing collateral.
-
-## [P-5] Feeds with more than 18 decimals permanently revert price conversion
-**Severity**: Low
-**Category**: evm-audit-precision-math
-**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)
-**Description**: Price normalization computes `10 ** (18 - feed.decimals())`. If governance configures a feed whose decimals exceed 18, the subtraction underflows and every price-dependent borrow, withdrawal-health check, and liquidation reverts for that token. The launch feeds are expected to use at most 18 decimals, so this is a latent listing/configuration hazard rather than a current exploit.
-**Proof of Concept**: Set a token's feed to an aggregator returning `decimals() == 19`, then call `getPrice(token)`. Evaluation of `18 - 19` reverts under Solidity 0.8 arithmetic. Any market path that values the token consequently reverts.
-**Recommendation**: Validate feed decimals in `setFeed()` and either reject values above a supported bound or normalize both directions: multiply when `feedDecimals <= 18` and divide when `feedDecimals > 18`, with explicit rounding and overflow bounds. Cache validated feed metadata at configuration time.
diff --git a/findings-proxies.md b/findings-proxies.md
deleted file mode 100644
index 9f6fa308ce2549c4d5250aee9af3037ccf598234..0000000000000000000000000000000000000000
--- a/findings-proxies.md
+++ /dev/null
@@ -1,23 +0,0 @@
-## [P-1] Anyone can replace the market implementation and steal all treasury liquidity
-**Severity**: Critical
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo()` writes an arbitrary address directly to the ERC-1967 implementation slot without `onlyOwner` (or any other authorization). Because calls execute through `MarketProxy` by `delegatecall`, any account can replace all market logic while retaining the proxy's storage and token balances. An attacker can install logic that transfers the proxy's entire USDC balance to themselves, rewrite every position, or permanently disable the market. The attacker directly receives all treasury-seeded USDC held by the proxy; borrowers and the treasury lose access to the legitimate market state.
-**Proof of Concept**: (1) Deploy a contract with a function such as `drain(IERC20 token)` that calls `token.transfer(msg.sender, token.balanceOf(address(this)))`. (2) Call `LendingMarket(proxy).upgradeTo(address(maliciousImplementation))`; the call succeeds for any sender and overwrites the proxy's implementation slot. (3) Call `drain(USDC)` through the proxy. The malicious implementation executes in proxy context and transfers the proxy's full USDC balance to the attacker.
-**Recommendation**: Restrict upgrades to a deliberately secured authority (`onlyOwner`, preferably a timelocked multisig) and use a reviewed UUPS implementation such as OpenZeppelin `UUPSUpgradeable`, including `_authorizeUpgrade`. Add upgrade-event monitoring and operational upgrade tests.
-
-## [P-2] Optional initialization lets the first caller seize an uninitialized deployment
-**Severity**: High
-**Category**: evm-audit-proxies
-**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`) and `LendingMarket.initialize()` (`src/LendingMarket.sol:56`)
-**Description**: The proxy accepts empty `initData`, while `initialize()` is externally callable by anyone exactly once and accepts an attacker-selected owner, oracle, vault, and debt asset. No deployment script exists in the repository to establish that deployment and initialization will be atomic. If the proxy is deployed with empty data (or initialization is otherwise deferred), a mempool observer can initialize it first. The attacker becomes owner and permanently installs attacker-controlled dependencies. Once the treasury seeds the advertised proxy—or if seeding and setup are bundled later—the attacker can control listings and use the malicious dependencies to compromise or deny the market. This requires the specific deployment mistake of non-atomic initialization, but then permanently compromises the deployment.
-**Proof of Concept**: (1) Deploy `MarketProxy(implementation, "")`. (2) Before the deployer initializes it, an attacker calls `initialize(attacker, attackerOracle, attackerVault, USDC)` through the proxy. (3) The intended initializer now reverts with `AlreadyInitialized()`. The proxy is permanently configured with attacker-selected ownership and core dependencies unless it is abandoned or upgraded; in the current code the attacker can also exploit the unrestricted upgrade path in P-1 immediately.
-**Recommendation**: Require non-empty initialization calldata in the proxy constructor and atomically delegatecall `initialize` as part of deployment. Validate every initialization address as nonzero and, where appropriate, verify deployed code. Make the deployment script pass the exact encoded initializer and assert all resulting state before funding the proxy. Also lock the standalone implementation against direct initialization (for example with OpenZeppelin `Initializable` and `_disableInitializers()`), although direct initialization alone does not control this custom proxy.
-
-## [P-3] Upgrades do not verify that the replacement is code-compatible, so one bad upgrade can be irreversible
-**Severity**: Medium
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`) and `MarketProxy.fallback()` (`src/MarketProxy.sol:26`)
-**Description**: `upgradeTo()` accepts zero addresses, EOAs, and arbitrary contracts without checking code presence or ERC-1967/UUPS compatibility. All upgrade logic lives in the current implementation and the proxy has no independent admin recovery function. Consequently, setting the slot to an address without a working compatible `upgradeTo()` removes the only route to another implementation. Calls to an EOA can misleadingly return success with empty returndata, while the market is permanently unusable. After P-1 is fixed, an authorized operator typo or an incompatible release can still permanently strand the market and its state; users may be unable to borrow, repay, or liquidate, and treasury USDC may be stuck.
-**Proof of Concept**: Call `upgradeTo(address(0x1234))`, where `0x1234` has no code. The slot update succeeds. Subsequent proxy calls delegatecall an address with no code and return empty data. Because that address exposes no upgrade function and `MarketProxy` exposes no admin upgrade path, another implementation cannot be installed through the proxy.
-**Recommendation**: Adopt a standard UUPS implementation that checks `proxiableUUID()` against the ERC-1967 slot before changing implementations, reject `address(0)` and addresses with `code.length == 0`, and test upgrade compatibility/storage layout before execution. Alternatively, move a tightly controlled recovery/upgrade path into a standard transparent proxy. These checks supplement, not replace, the authorization required by P-1.
diff --git a/findings-signatures.md b/findings-signatures.md
deleted file mode 100644
index bec634a866bc1de191f358960f56ce19dd89353c..0000000000000000000000000000000000000000
--- a/findings-signatures.md
+++ /dev/null
@@ -1,31 +0,0 @@
-## [SIG-1] Anyone can replace the market implementation and take all protocol assets
-**Severity**: Critical
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo` has no `onlyOwner` (or other authorization) check and writes an arbitrary address directly to the ERC-1967 implementation slot. Because calls arrive through `MarketProxy`, any account can make the proxy delegate all future calls to attacker-controlled code. The replacement code executes in the proxy's context, which is also the immutable `market` authorized by `CollateralVault`. An attacker can therefore transfer the market's seeded USDC and invoke `CollateralVault.seize()` for every depositor. There is also no code-size or UUPS compatibility check, so even an accidental call can permanently brick the market.
-**Proof of Concept**: (1) Deploy an implementation exposing a function that transfers the proxy's full USDC balance to the attacker and calls `vault.seize(victim, token, attacker, amount)`. (2) Call `MarketProxy.upgradeTo(attackerImplementation)` from any EOA; the fallback delegates to the current `LendingMarket`, which stores the supplied address without checking the caller. (3) Call the malicious drain function through the proxy. The attacker receives the treasury's USDC and all collateral held for users.
-**Recommendation**: Add `onlyOwner` to the upgrade entry point, validate `newImplementation.code.length != 0`, and use a reviewed UUPS implementation (including `onlyProxy`, `proxiableUUID`, and `_authorizeUpgrade`) or a standard transparent proxy. Put upgrade authority behind a multisig/timelock and test that direct implementation calls and incompatible implementations revert.
-
-## [SIG-2] Reusable borrow signatures let any holder repeatedly increase a user's debt
-**Severity**: High
-**Category**: evm-audit-signatures
-**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)
-**Description**: The signed `Borrow(address borrower,uint256 amount)` struct contains neither a nonce nor a deadline, and the contract does not mark a digest as consumed. A signature is therefore valid forever and can be submitted repeatedly by anyone. Each submission adds `amount` to `principalOf[borrower]` until the health check reaches its limit. Although borrowed USDC is sent to the signer rather than the submitter, a leaked or previously relayed signature lets a griefer force the signer into unintended leverage and liquidation exposure. The unlucky signer receives additional USDC, but also incurs matching debt and can lose collateral plus the 5% liquidation bonus after a price move; the attacker can later act as liquidator and collect that bonus.
-**Proof of Concept**: (1) Alice deposits enough wstETH and signs one request to borrow 1,000 USDC. (2) A relayer submits that exact `(borrower, amount, v, r, s)` multiple times. (3) Every call recovers Alice and `_borrow` increases her principal again; nothing consumes the authorization. (4) Once Alice is close to the threshold, an adverse price move makes her liquidatable and a liquidator takes collateral including the configured bonus.
-**Recommendation**: Sign and consume a per-borrower nonce and include an expiration, for example `Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)`. Require `block.timestamp <= deadline`, increment `nonces[borrower]` before `_borrow`, and use OpenZeppelin `EIP712` plus `ECDSA.recover`. If arbitrary relayers are not a product requirement, additionally bind the intended submitter or require `msg.sender == borrower`.
-
-## [SIG-3] Cached EIP-712 domain remains tied to the initialization chain ID
-**Severity**: Low
-**Category**: evm-audit-signatures
-**Location**: `LendingMarket.initialize()` and `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:56`, `src/LendingMarket.sol:162`)
-**Description**: `domainSeparator` is computed once during initialization and never recomputed if `block.chainid` changes. Following a chain-ID-changing fork or migration, the contract continues accepting signatures made for the old domain while wallets correctly produce signatures for the new chain ID that the contract rejects. Coupled with the absence of nonces, old signed borrows remain usable on the forked deployment. This is a latent fork/migration failure rather than a current Arbitrum One theft path.
-**Proof of Concept**: Initialize when `block.chainid == A`, then execute the same state on a chain whose ID is `B`. `domainSeparator` still embeds `A`. A digest signed against domain `A` continues to recover, while a standards-compliant signature created against `B` fails with `BadSignature`.
-**Recommendation**: Use OpenZeppelin's upgradeable `EIP712` implementation and `_hashTypedDataV4`, which derives the separator for the active chain and proxy address. Alternatively cache both the initial chain ID and separator and recompute the separator whenever `block.chainid` differs.
-
-## [SIG-4] Two sensitive risk controls are callable by anyone
-**Severity**: Critical
-**Category**: evm-audit-access-control
-**Location**: `LendingMarket.setOracle()` and `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:91`, `src/LendingMarket.sol:96`)
-**Description**: Both setters omit `onlyOwner`. Any account can replace the trusted oracle or arbitrarily change the collateral threshold. An attacker can install a malicious `PriceOracle`-compatible contract that reports enormous collateral prices, deposit a negligible amount of a listed token, and borrow the entire USDC treasury. Alternatively, manipulating the threshold/oracle can make healthy users liquidatable; the caller can liquidate them and receive their collateral plus the bonus.
-**Proof of Concept**: (1) Deploy a contract whose `getPrice(collateral)` returns an enormous value and whose `getPrice(debtAsset)` returns a small positive value. (2) Call `setOracle` through the proxy from any EOA. (3) Deposit a trivial amount of listed collateral and call `borrow` for the proxy's full USDC balance. The forged health factor passes and the attacker receives all seeded USDC. No owner key or prior protocol state is required.
-**Recommendation**: Add `onlyOwner` to both setters. Validate nonzero contract addresses and sensible threshold bounds (at minimum `bps <= BPS`, with governance-approved lower/upper limits). Prefer a multisig plus timelock for oracle and risk changes, with an emergency pause mechanism for compromised feeds.

codex
Created [AUDIT-REPORT.md](/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001/AUDIT-REPORT.md).

Summary: **2 Critical, 8 High, 7 Medium, and 4 Low** findings. Current recommendation: **do not deploy** until the launch blockers are resolved.

`forge build` passes. `src/` is unchanged, all working notes were removed, and `AUDIT-REPORT.md` is the only new file.
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..66627d77d88afa76bc10573ba7dd2b9d0f5f0042
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,208 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-03  
+**Scope:** `README.md`, `src/CollateralVault.sol`, `src/LendingMarket.sol`, `src/MarketProxy.sol`, `src/PriceOracle.sol`, and interfaces  
+**Target:** Arbitrum One; native USDC debt; wstETH launch collateral  
+**Result:** **Do not deploy in the current state.**
+
+## Executive summary
+
+The review found **2 Critical, 8 High, 7 Medium, and 4 Low** issues. The two Critical issues independently let any caller take control of pricing or implementation logic and steal the treasury-funded USDC and deposited collateral. The public liquidation-threshold setter is another immediate launch blocker. Even after access control is repaired, the health-factor formula incorrectly liquidates solvent borrowers, the proposed wstETH feed values the wrong unit, and stale oracle data is accepted.
+
+Fix order for Monday:
+
+1. Lock down upgrades, oracle replacement, and risk parameters; require atomic initialization.
+2. Correct health, wstETH pricing, oracle validation, interest realization on withdrawal, and full-repayment rounding.
+3. Add adversarial tests for borrowing, repayment, withdrawal, liquidation, oracle outages, and upgrades before funding the proxy.
+4. Address the Medium issues before launch. Do not list weETH, ezETH, USDT, fee-on-transfer, callback-capable, or rebasing assets until asset-specific adapters and accounting are implemented.
+
+This was a source review plus successful `forge build`; the repository has no test suite. No deployment scripts were present, so initialization safety and on-chain configuration could not be verified.
+
+## Findings
+
+## [C-01] Anyone can replace the implementation and drain the market and vault
+**Severity**: Critical  
+**Category**: Access control / proxy  
+**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)  
+**Description**: `upgradeTo()` has no authorization and writes an arbitrary address to the ERC-1967 implementation slot. Malicious logic then executes in the proxy context. Because the proxy holds seeded USDC and is the immutable `market` trusted by `CollateralVault`, the replacement can transfer all USDC and call `vault.seize()` for every depositor. The attacker receives all funded liquidity and deposited collateral.  
+**Proof of Concept**: Deploy logic with a drain function, call `upgradeTo(malicious)` through the proxy, then call the drain through the proxy. The new logic can transfer the proxy's USDC and invoke the vault as its trusted market.  
+**Recommendation**: Use a reviewed UUPS or transparent proxy implementation. Restrict upgrades to a timelocked multisig, validate code and `proxiableUUID`, and test storage compatibility and rollback/recovery procedures.
+
+## [C-02] Anyone can replace the oracle and steal all seeded USDC
+**Severity**: Critical  
+**Category**: Access control / oracle  
+**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)  
+**Description**: `setOracle()` has no `onlyOwner`. An attacker can report an enormous collateral price and a tiny positive USDC price, borrow the complete USDC balance against dust, and leave unrecoverable debt. The same control can fabricate unhealthy positions and extract users' collateral as liquidator.  
+**Proof of Concept**: Deposit dust wstETH, install an attacker oracle, return a huge wstETH price and small USDC price, then borrow the proxy's entire USDC balance.  
+**Recommendation**: Add access control, validate that the new oracle is a contract supporting every active asset, and place oracle changes behind a timelock/multisig with a pause and two-step activation process.
+
+## [H-01] Anyone can force liquidations by changing the liquidation threshold
+**Severity**: High  
+**Category**: Access control / risk parameters  
+**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)  
+**Description**: Any caller can set the threshold to any value. Setting it to zero makes every debtor unhealthy. The caller can then repay selected debts and receive borrowers' collateral plus the 5% bonus; unlucky borrowers lose the bonus and their positions are forcibly closed. Unbounded high values also allow governance parameters to be bypassed and can cause arithmetic reverts.  
+**Proof of Concept**: Call `setLiquidationThreshold(0)`, then call `liquidate(user)` for an otherwise healthy borrower after approving USDC.  
+**Recommendation**: Add `onlyOwner`, require `0 < bps && bps <= BPS`, use a timelocked risk role, and pause borrowing around material parameter changes.
+
+## [H-02] Division before multiplication makes solvent positions liquidatable
+**Severity**: High  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:146`)  
+**Description**: `collateralValueUsd / debtUsd` truncates before applying WAD precision. At the configured 80% threshold, every collateral ratio from 100% to just under 200% produces a health factor of `0.8e18`. A borrower with $1,500 collateral and $1,000 debt should have a 1.2 health factor but is liquidatable. A liquidator receives $1,050 of collateral; the solvent borrower loses $50 and is forcibly closed.  
+**Proof of Concept**: For `$1,500e18 / $1,000e18`, the contract first obtains `1`, then returns `1 * 8000 * 1e18 / 10000 = 0.8e18`.  
+**Recommendation**: Use full-precision multiplication before division, e.g. `mulDiv(collateralUsd, liquidationThreshold * WAD, debtUsd * BPS)`, with explicit rounding. Test immediately below, at, and above 125% collateralization.
+
+## [H-03] The stETH/USD feed prices wstETH as if it were one stETH
+**Severity**: High  
+**Category**: Oracle / asset integration  
+**Location**: launch configuration in `README.md`; `LendingMarket.collateralValueUsd()` and `_liquidate()` (`src/LendingMarket.sol:132`, `src/LendingMarket.sol:209`)  
+**Description**: One wstETH represents a changing amount greater than one stETH. Applying the stETH/USD feed directly to raw wstETH units undervalues collateral and transfers too many wstETH during liquidation. If one wstETH represents 1.20 stETH, a nominal 5% liquidation premium becomes approximately 26% in underlying-value terms. The liquidator receives the excess from the borrower.  
+**Proof of Concept**: At a $1,900 stETH price, a $1,050 seizure transfers about 0.5526 wstETH. At 1.20 stETH per wstETH, that collateral is actually worth about $1,260.  
+**Recommendation**: Use a maintained wstETH/USD feed or compose stETH/USD with the canonical `stEthPerToken()` conversion. Validate freshness and units at both legs. Require equivalent asset-specific adapters for weETH and ezETH.
+
+## [H-04] Stale or incomplete Chainlink rounds are accepted indefinitely
+**Severity**: High  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Deprecated `latestAnswer()` exposes no timestamp or round metadata. After a feed stops updating, borrowers can take too much USDC against a fallen collateral price, leaving treasury bad debt, or liquidators can seize collateral using an obsolete adverse price.  
+**Proof of Concept**: If wstETH falls while its feed remains at the old high value, deposit/retain collateral and borrow against the stale value before updates resume.  
+**Recommendation**: Use `latestRoundData()` and require positive answers, nonzero timestamps, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Configure maximum age per feed and define a safe pause/fallback response.
+
+## [H-05] Withdrawals check debt before realizing accrued interest
+**Severity**: High  
+**Category**: Lending accounting  
+**Location**: `CollateralVault.withdraw()` and `LendingMarket.requireHealthy()` (`src/CollateralVault.sol:44`, `src/LendingMarket.sol:153`)  
+**Description**: Withdrawal calls a view-only health check without first calling `accrueInterest()`. After inactivity, a borrower can withdraw collateral based on the old index; the next accrual makes the remaining position undercollateralized. The user receives collateral that should secure the debt, while the treasury can be left with bad debt.  
+**Proof of Concept**: Borrow at the maximum permitted boundary, wait without any market state-changing call, then withdraw collateral while `borrowIndex` is stale. Call `accrueInterest()` afterward; the updated debt exceeds the remaining collateral limit.  
+**Recommendation**: Route withdrawals through the market or expose an authenticated market hook that accrues before the vault changes balances. Check health using a preview index that includes elapsed interest, and test long idle periods.
+
+## [H-06] A displayed full repayment can leave permanent debt dust and lock collateral
+**Severity**: High  
+**Category**: Precision / debt accounting  
+**Location**: `LendingMarket.repay()` and `debtOf()` (`src/LendingMarket.sol:128`, `src/LendingMarket.sol:170`)  
+**Description**: Debt and repayment conversions both round down. Paying the full displayed debt can leave one scaled-principal unit. Once `amount * WAD / borrowIndex` rounds to zero, further payments transfer USDC but reduce no principal, and the amount cap prevents overpayment. The borrower loses every attempted payment and cannot withdraw all collateral.  
+**Proof of Concept**: With principal `1,000,000` and index `1.0000001e18`, displayed debt is `1,000,000`; repayment subtracts only `999,999`, leaving principal `1`. Paying the remaining displayed unit subtracts zero forever.  
+**Recommendation**: If `amount >= debt`, collect exactly `debt` and set principal to zero. For partial repayments, compute the principal reduction first with documented rounding and reject a positive payment that reduces zero principal.
+
+## [H-07] Reusable borrow signatures can force a signer into repeated debt and liquidation
+**Severity**: High  
+**Category**: Signatures  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)  
+**Description**: The signed message has no nonce or deadline and is never consumed. Anyone observing one signature can replay it until the account reaches its borrowing limit, and can replay it again after repayment. Funds go to the signer, but an unaware signer can be pushed to the liquidation boundary; the replayer can later liquidate and receive the 5% collateral bonus.  
+**Proof of Concept**: Submit the same `(borrower, amount, v, r, s)` repeatedly. Every digest is identical and accepted. After the borrower repays, submit it again.  
+**Recommendation**: Sign and validate a per-borrower nonce, deadline, receiver/intended relayer, and amount; increment the nonce before borrowing. Use a standard EIP-712/ECDSA implementation that enforces low-`s` and valid `v`.
+
+## [H-08] Non-atomic proxy initialization permits deployment takeover
+**Severity**: High  
+**Category**: Proxy / deployment  
+**Location**: `MarketProxy.constructor()` and `LendingMarket.initialize()` (`src/MarketProxy.sol:10`, `src/LendingMarket.sol:56`)  
+**Description**: The proxy allows empty `initData`, and anyone may call `initialize()` once. If initialization is deferred, a mempool observer selects the owner, oracle, vault, and debt token. The legitimate initializer is permanently locked out and any later funding is exposed. No deployment script demonstrates atomic initialization.  
+**Proof of Concept**: Deploy the proxy with empty init data; before the deployer initializes, call `initialize(attacker, attackerOracle, attackerVault, token)`.  
+**Recommendation**: Require nonempty init data and atomically initialize in the proxy constructor. Validate all addresses, assert state before funding, and disable initializers on the standalone implementation.
+
+## [M-01] Arbitrum sequencer recovery is not checked
+**Severity**: Medium  
+**Category**: Oracle / Arbitrum  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: The oracle does not consult the Arbitrum sequencer uptime feed. Immediately after recovery, asset feeds may not yet be current. A borrower can receive excess USDC or a liquidator can receive collateral based on pre-outage prices.  
+**Proof of Concept**: Submit a borrow or liquidation immediately after sequencer recovery while the relevant asset round still predates the outage.  
+**Recommendation**: Validate the Arbitrum sequencer uptime feed and enforce a recovery grace period (commonly one hour) before using prices, in addition to per-feed freshness checks.
+
+## [M-02] Invalid oracle answers can bypass health checks or halt liquidation
+**Severity**: Medium  
+**Category**: Oracle  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)  
+**Description**: Zero and negative answers are not rejected. A zero USDC price makes debt value zero and the health factor maximal, allowing treasury USDC to be borrowed with inadequate backing. A zero collateral price makes liquidation divide by zero; a negative answer casts to a huge unsigned integer and generally reverts downstream. Users or the treasury lose funds if an invalid answer is consumed; otherwise risk-reducing actions are blocked.  
+**Proof of Concept**: Return zero for USDC/USD and borrow while `debtValueUsd()` is zero, or return zero for collateral and observe `_liquidate()` revert at division by `price`.  
+**Recommendation**: Require `answer > 0`, valid round metadata, and reject/circuit-break implausible or aggregator-bound values. Pause new risk while preserving repayment and recovery paths.
+
+## [M-03] Nominal and unchecked token transfers can create unbacked collateral
+**Severity**: Medium  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()`, `withdraw()`, `seize()`; `LendingMarket.repay()`, `_borrow()`, `_liquidate()`  
+**Description**: Return values from every transfer are ignored, and deposits credit the requested amount rather than the received balance delta. The launch assets normally revert or return true, but a future fee-on-transfer or false-returning listed token lets an attacker receive inflated collateral credit and borrow real USDC. False-returning debt transfers can also cancel debt without payment after a future debt-asset change.  
+**Proof of Concept**: List a token whose `transferFrom` returns false or transfers 90%. Calling `deposit(100)` records 100 although the vault receives zero or 90; the caller borrows against the fictitious difference.  
+**Recommendation**: Use safe-transfer helpers. Credit the observed balance delta and, unless explicitly supported by an adapter, require it to equal the requested amount.
+
+## [M-04] Transfer-before-effects permits reentrant withdrawals for callback-capable collateral
+**Severity**: Medium  
+**Category**: Reentrancy / future listings  
+**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)  
+**Description**: The vault transfers before decrementing `balanceOf`. A callback-capable future token can reenter and make nested withdrawals observe the same old balance, withdrawing more assets than are charged and potentially leaving fictitious collateral for a USDC borrow. Launch wstETH does not expose such transfer callbacks, so this becomes exploitable when an unsafe token is listed.  
+**Proof of Concept**: Deposit a listed callback token, call `withdraw(X)`, and reenter `withdraw(X)` during its transfer hook. Both frames read the original balance and transfer `X`.  
+**Recommendation**: Apply checks-effects-interactions, decrement before the external call, and add a reentrancy guard. Explicitly prohibit callback tokens unless an adapter has been reviewed.
+
+## [M-05] The borrower array can permanently disable batch liquidation
+**Severity**: Medium  
+**Category**: Denial of service  
+**Location**: `LendingMarket._borrow()` and `liquidateAll()` (`src/LendingMarket.sol:190`, `src/LendingMarket.sol:197`)  
+**Description**: `borrow(0)` appends the caller whenever principal is zero; entries are never removed or deduplicated. An attacker spends gas but no assets to grow the array until `liquidateAll()` cannot fit in a block. During a price shock, keepers lose the documented sweep function and bad debt risk rises, although individual liquidation remains available.  
+**Proof of Concept**: Repeatedly call `borrow(0)`, then call `liquidateAll()` after enough entries exist; it runs out of gas.  
+**Recommendation**: Reject zero/dust borrowing, maintain unique membership, remove closed accounts, and replace the unbounded sweep with cursor-based bounded batches or off-chain discovery.
+
+## [M-06] Deeply underwater debt has no economically viable liquidation path
+**Severity**: Medium  
+**Category**: Liquidation design  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)  
+**Description**: A liquidator must pay 100% of debt before receiving at most the remaining collateral. If collateral value falls below debt, liquidation guarantees a loss, so rational liquidators leave the position open and the treasury retains bad debt. Large positions also require unnecessary up-front capital.  
+**Proof of Concept**: For $1,000 debt backed by collateral now worth $700, liquidation takes $1,000 USDC and can return only $700 of collateral.  
+**Recommendation**: Support caller-selected partial liquidation and minimum collateral output, cap seizure to available collateral, explicitly recognize residual bad debt, and define a reserve/insurance loss mechanism.
+
+## [M-07] Upgrades can accidentally and irreversibly brick the proxy
+**Severity**: Medium  
+**Category**: Proxy safety  
+**Location**: `LendingMarket.upgradeTo()` and `MarketProxy.fallback()` (`src/LendingMarket.sol:84`, `src/MarketProxy.sol:26`)  
+**Description**: No check rejects zero, an EOA, or an incompatible implementation. Because upgrade logic lives only in the implementation, one bad authorized upgrade can remove the only upgrade path and permanently strand positions and treasury USDC.  
+**Proof of Concept**: Upgrade to an EOA. Subsequent delegatecalls return empty data, and that address exposes no function that can restore the implementation.  
+**Recommendation**: Validate code and UUPS UUID, use a standard proxy design, run storage-layout and fork upgrade tests, and retain a deliberately governed recovery process.
+
+## [L-01] Debt shares are rounded down when borrowing
+**Severity**: Low  
+**Category**: Precision  
+**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`)  
+**Description**: `amount * WAD / borrowIndex` rounds debt shares down while transferring the full amount. Once the index exceeds WAD, a one-base-unit borrow records zero debt and passes without collateral. Repetition undercharges debt, but for six-decimal USDC the extractable amount per call is below one micro-USDC and is not economically profitable at normal gas costs.  
+**Proof of Concept**: After interest accrues, call `borrow(1)` with no collateral; the principal increment is zero while one base unit transfers.  
+**Recommendation**: Round debt shares up on borrowing and require a nonzero share delta and a sensible minimum borrow.
+
+## [L-02] Interest uses an imprecise Arbitrum block-to-time conversion
+**Severity**: Low  
+**Category**: Arbitrum / accounting  
+**Location**: `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:117`)  
+**Description**: Arbitrum's Solidity `block.number` approximates the L1 block number and advances in steps; multiplying it by a fixed 12 seconds is not reliable elapsed wall time. Borrowers or the treasury receive slightly incorrect interest, and accrual can jump after periods where the reported number does not advance.  
+**Proof of Concept**: Compare `blocksElapsed * 12` with `block.timestamp - lastAccrualTimestamp` across Arbitrum blocks; the values can differ and update at different cadence.  
+**Recommendation**: Store a timestamp and accrue from `block.timestamp - lastAccrualTimestamp`, with a reasonable maximum interval and tests for sequencer outages.
+
+## [L-03] Liquidation discards value lost to token-unit rounding
+**Severity**: Low  
+**Category**: Precision / liquidation  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:224`)  
+**Description**: Collateral units round down, but `seizeUsd` is reduced by the full unrounded value. The liquidator can receive slightly less than paid for; for a future low-decimal, high-price token, a nontrivial requested seizure can round to zero.  
+**Proof of Concept**: If `takeUsd * unit < price`, the seized token amount is zero although `takeUsd` is fully subtracted.  
+**Recommendation**: Reduce remaining seizure value by the actual value transferred, or round units up subject to the user's balance and a documented policy.
+
+## [L-04] Feed and token decimal assumptions can freeze an asset
+**Severity**: Low  
+**Category**: Configuration validation  
+**Location**: `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `_liquidate()`  
+**Description**: A feed with more than 18 decimals underflows `18 - decimals`; a token with sufficiently large decimals overflows `10 ** decimals`. Price-dependent borrow, withdrawal, and liquidation then revert, potentially trapping users after a bad future listing.  
+**Proof of Concept**: Configure a feed reporting 19 decimals or list a token reporting 78 decimals and call the relevant valuation function.  
+**Recommendation**: Validate and cache code presence and decimal ranges before listing. Normalize multiplication and division in both directions with full-precision math and provide a safe delisting/migration path.
+
+## Planned-collateral constraints
+
+- The current fixed-balance vault is unsafe for rebasing tokens: a negative rebase leaves fictitious balances and bad-debt capacity, while a positive rebase becomes unallocated. Use non-rebasing wrappers or share-based adapters.
+- weETH and ezETH require wrapper-specific exchange-rate and market-price handling; do not map either 1:1 to ETH/USD.
+- USDT and USDC can be paused or blocklisted. Define an emergency mode that stops new borrowing, handles interest fairly, and provides a post-recovery repayment grace period. Consider isolated markets so one frozen custody address does not affect unrelated assets.
+
+These are listing gates rather than separate launch findings because only wstETH collateral and USDC debt are currently intended to be enabled.
+
+## Verification priorities
+
+Before deployment, add unit, fuzz, invariant, and Arbitrum-fork tests covering:
+
+- only authorized upgrades and configuration; atomic initialization; incompatible upgrade rejection;
+- debt conservation across every borrow/repay sequence and exact full closure;
+- health-factor boundaries and withdrawal after long idle periods;
+- wstETH conversion, stale/invalid rounds, sequencer outage and recovery;
+- liquidation solvency, rounding, partial liquidation, slippage, and bad-debt handling;
+- zero values, unusual token behavior, callbacks, pauses, and all planned asset adapters.
diff --git a/findings-chain.md b/findings-chain.md
deleted file mode 100644
index 3082a2a277646a7d034774743452e922dab69f32..0000000000000000000000000000000000000000
--- a/findings-chain.md
+++ /dev/null
@@ -1,21 +0,0 @@
-## [CHAIN-1] Sequencer recovery permits borrowing and liquidation against stale prices
-**Severity**: High
-**Category**: evm-audit-chain-specific
-**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:34-41`), consumed by `LendingMarket._borrow()`, `LendingMarket.liquidate()`, and `LendingMarket._liquidate()`
-**Description**: The market is explicitly targeting Arbitrum One, but its Chainlink adapter calls `latestAnswer()` and performs no Arbitrum sequencer-uptime check, recovery grace period, or `updatedAt` freshness check. During a sequencer outage users cannot repay, add collateral, or liquidate. On recovery, the last published answer may predate a large off-chain price movement, while transactions can resume before a trustworthy post-recovery price has propagated. An attacker can deposit collateral whose stale answer is too high and borrow real USDC that the collateral no longer covers. Conversely, a stale-low answer can make an otherwise solvent borrower liquidatable; a liquidator receives that user's collateral and bonus before the price catches up. This is an Arbitrum-specific amplification of the missing freshness validation because the sequencer outage simultaneously prevents users and keepers from taking protective actions.
-**Proof of Concept**: (1) The Arbitrum sequencer becomes unavailable while wstETH falls materially in external markets. (2) The on-chain feed remains at its pre-outage value and users cannot transact. (3) Immediately after sequencing resumes, before the collateral feed publishes a fresh round, an attacker deposits wstETH and calls `borrow()`. `getPrice()` returns the old high answer, the health check passes, and the attacker receives more native USDC than their collateral can support at the current market price. The treasury is left with bad debt after the feed catches up. The reverse price movement permits premature liquidation of an existing borrower.
-**Recommendation**: Integrate Chainlink's Arbitrum sequencer uptime feed. Reject prices while the sequencer reports down and for a deliberately chosen grace period after it comes back up. Replace `latestAnswer()` with `latestRoundData()` and require a positive answer, a nonzero `updatedAt`, a completed round, and per-feed maximum age calibrated to that feed's Arbitrum heartbeat. During the outage and grace period, disable borrowing and liquidation while preserving risk-reducing actions where dependencies permit. Test outage, recovery, stale-round, and delayed-feed-update scenarios before launch.
-
-## [CHAIN-2] L1 block-number approximation makes interest timing coarse and chain-dependent
-**Severity**: Low
-**Category**: evm-audit-chain-specific
-**Location**: `LendingMarket.initialize()` and `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:70`, `src/LendingMarket.sol:116-128`)
-**Description**: Arbitrum exposes an approximate L1 block number through Solidity's `block.number`, not the Arbitrum L2 block number. Many L2 transactions therefore share one value, and its progress is not a protocol guarantee that exactly 12 seconds elapsed per increment. The market nevertheless converts the difference to time using the Ethereum-specific `SECONDS_PER_BLOCK = 12`. Interest does not accrue between any transactions sharing an L1 block, then accrues in steps, and long sequencer or L1 timing irregularities translate directly into debt-accounting error. Rapid same-block borrowing and repayment avoids the small amount of interest that wall-clock time would charge; more importantly, borrowers or the treasury can gain or lose whenever actual elapsed time diverges from `blocksElapsed * 12`. This is unlikely to create a large standalone extraction at a 4% annual rate, but it is avoidable financial-accounting drift in a production lending market.
-**Proof of Concept**: Execute `accrueInterest()` and then multiple borrow/repay operations in different Arbitrum L2 blocks that all report the same L1 `block.number`. Every call computes `blocksElapsed == 0`, so no interest is recorded even though time and L2 blocks elapsed. Conversely, if the exposed L1 block number advances several steps between calls, all estimated time is charged at once according to the hardcoded 12-second multiplier rather than actual elapsed seconds.
-**Recommendation**: Store `lastAccrualTimestamp` and compute interest from `block.timestamp - lastAccrualTimestamp`, with an explicit maximum accrual interval or administrative recovery procedure if desired. Do not use `ArbSys.arbBlockNumber()` as a substitute for elapsed time; it has L2-block rather than time semantics. Add tests covering many calls at the same `block.number`, sequencer downtime, and irregular block-number jumps.
-
-## Chain-specific checks with no additional finding
-
-- The README's native USDC address (`0xaf88...5831`) and wstETH address (`0x5979...0529`) are Arbitrum One addresses rather than Ethereum-mainnet or USDC.e addresses. The separate semantic error of assigning a stETH/USD feed directly to wstETH is reported by the ERC-20/oracle review and is not duplicated here.
-- No retryable-ticket, L2-to-L1 messaging, address-aliasing, `block.basefee`, hardcoded gas-price, `prevrandao`, native-ETH `transfer`/`send`, or chain-specific precompile logic exists in `src/`.
-- Solidity 0.8.28 may emit `PUSH0`, which is supported on current Arbitrum One; this is a deployment-compatibility concern only if the same bytecode is later deployed to a chain without Shanghai/PUSH0 support.
diff --git a/findings-erc20.md b/findings-erc20.md
deleted file mode 100644
index fe11693bdc9d4c7a7e1efe27382c440339639b26..0000000000000000000000000000000000000000
--- a/findings-erc20.md
+++ /dev/null
@@ -1,39 +0,0 @@
-## [ERC20-1] wstETH is priced as one stETH, overstating liquidation severity and collateral seized
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `LendingMarket.collateralValueUsd()` and `LendingMarket._liquidate()` (`src/LendingMarket.sol:132-138`, `src/LendingMarket.sol:219-230`); launch feed configuration in `README.md`
-**Description**: The launch configuration maps wstETH to a stETH/USD feed, while both valuation paths multiply the user's raw wstETH units directly by that feed price. One wstETH is a yield-bearing wrapper representing a changing quantity of stETH; it is not one stETH. The omitted `stEthPerToken()` conversion systematically undervalues wstETH and makes the effective loan-to-value and liquidation bonus differ from the configured 80% threshold and 5% bonus. The same integration error will recur if weETH or ezETH is listed against an ETH/USD feed without composing in its exchange rate. A borrower can be liquidated while economically above the advertised collateral threshold, and the liquidator receives more underlying value than the configured bonus at the borrower's expense.
-**Proof of Concept**: Suppose one wstETH represents 1.20 stETH. A user deposits 1 wstETH when the stETH feed is $2,400 and borrows $1,000; the account passes the current health check. The stETH feed later falls to $1,900. The market reports $1,900 of collateral while the wrapper is economically worth $2,280, and the position is liquidatable under the current implementation. `_liquidate()` calculates a nominal $1,050 seizure and transfers about 0.5526 wstETH. At the actual wrapper rate that is $1,260 of value: an effective 26% premium over repaid debt rather than 5%. The extra $210 comes from the borrower. (The separate loss-of-precision defect in `healthFactor()` makes the liquidation boundary even harsher; correcting it does not correct this wrapper price or seizure error.)
-**Recommendation**: Price the collateral token itself. For wstETH, either configure a maintained wstETH/USD feed or compose stETH/USD with wstETH's `stEthPerToken()` rate using explicit decimal normalization. Use asset-specific adapters for weETH and ezETH rather than assuming every wrapped LST/LRT is 1:1 with ETH. Test valuation and seizure against live wrapper conversion rates and define conservative handling for rate decreases/slashing.
-
-## [ERC20-2] Nominal deposit accounting lets non-standard collateral create unbacked borrowing power
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.deposit()` (`src/CollateralVault.sol:35-41`)
-**Description**: `deposit()` credits the caller-supplied `amount` without checking the vault's balance delta and ignores the return value of `transferFrom`. For a fee-on-transfer token the vault receives less than the credited amount. For a token that returns `false` without reverting, it may receive nothing and still credit the full amount. `LendingMarket.listCollateral()` provides no token-behavior validation, so a future listing can turn the discrepancy into borrowable collateral. An attacker deposits repeatedly, receives inflated accounting, borrows real USDC from the treasury, and leaves bad debt that the vault cannot cover. Raw transfers elsewhere also ignore a returned `false`, but this deposit path is the direct accounting exploit.
-**Proof of Concept**: Governance lists a token with a valid price feed that charges a 10% transfer fee. The attacker calls `deposit(token, 1_000e18)`; the vault receives 900 tokens but records 1,000. Health checks value 1,000 tokens and permit borrowing against them. With a token returning `false` and moving no funds, the same call records 1,000 tokens backed by zero. The attacker borrows USDC; liquidation or withdrawal later fails once actual vault inventory is exhausted.
-**Recommendation**: Use a checked transfer helper and derive the credited amount from `balanceAfter - balanceBefore`. If only exact-transfer collateral is supported, require the delta to equal `amount` and revert otherwise. Document and enforce an explicit token-adapter/allowlist policy before listing weETH, ezETH, USDT, or any future asset; never infer ERC-20 compatibility solely from the interface.
-
-## [ERC20-3] Cached balances are incompatible with the planned rebasing-collateral path
-**Severity**: High
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.balanceOf`, `CollateralVault.deposit()`, `CollateralVault.withdraw()`, and `LendingMarket.collateralValueUsd()` (`src/CollateralVault.sol:12`, `src/CollateralVault.sol:35-52`, `src/LendingMarket.sol:132-138`)
-**Description**: User collateral is stored as a fixed token amount and never reconciled to the vault's actual balance. If a listed token negatively rebases, recorded balances and borrowing power remain unchanged even though backing has disappeared. Borrowers can retain or take USDC loans against nonexistent collateral, while withdrawals and liquidations eventually revert or become first-come-first-served. A positive rebase creates unallocated assets that depositors cannot claim. This does not affect non-rebasing wstETH itself, but it makes the README's planned path to rebasing collateral unsafe without a different accounting model.
-**Proof of Concept**: Two users each deposit 100 units of a listed rebasing token, so total internal balances and vault inventory are 200. After a 20% negative rebase the vault owns 160, while each user's recorded balance remains 100 and health calculations still value 200 total. Both can continue borrowing based on the stale amounts. The first user may withdraw or be seized for 100, leaving only 60 backing the second user's recorded 100; attempts to transfer the remaining nominal amount revert and USDC debt can become bad debt.
-**Recommendation**: Do not list rebasing tokens in the current vault. Prefer their non-rebasing wrapper, priced with its conversion rate. If direct rebasing support is required, implement share-based accounting (`userShares / totalShares`) against actual assets, specify who receives positive rebases and absorbs negative rebases, and validate every deposit, withdrawal, health check, and liquidation under both directions of rebase before governance can enable the asset.
-
-## [ERC20-4] USDC/USDT issuer controls can freeze shared custody and block risk reduction
-**Severity**: Medium
-**Category**: evm-audit-erc20
-**Location**: `CollateralVault.deposit()`, `CollateralVault.withdraw()`, `CollateralVault.seize()`, `LendingMarket.repay()`, `LendingMarket._borrow()`, and `LendingMarket._liquidate()`
-**Description**: USDC (the debt asset) and shortlisted USDT have issuer pause and address-blocklist controls. All debt liquidity is held by `LendingMarket`, and all collateral of a given token is pooled in `CollateralVault`. If the market is blocked, seeded USDC and repayments can be frozen for every user. If the vault is blocked after USDT is listed, every depositor's USDT is frozen. A global token pause can prevent repayment and liquidation during a price move; after transfers resume, borrowers may face immediate liquidation because the protocol has no emergency mode or grace period. A single user's blocklisting can also prevent that user's repayment or collateral withdrawal even when they are trying to reduce risk.
-**Proof of Concept**: A borrower has USDC debt and USDT collateral. Tether pauses transfers or blocks the vault address, making `withdraw()` and `seize()` revert for all USDT positions. Alternatively Circle pauses USDC, making `repay()` and `_liquidate()` revert. Prices and interest continue to move while users cannot repay and keepers cannot liquidate. When transfers resume, accounts may be underwater and liquidated despite having had no on-chain path to cure them during the outage.
-**Recommendation**: Treat issuer controls as an explicit listing risk. Add a protocol emergency state that stops new borrows and interest accrual/liquidations when the debt asset or a major collateral cannot transfer, followed by a governance-controlled recovery/grace period. Isolate centrally controlled collateral in separate vaults/markets where practical so one blocklisted custody address does not freeze unrelated assets. Publish this dependency and rehearse pause/blocklist incident procedures before launch and before listing USDT.
-
-## [ERC20-5] Unbounded token decimals can permanently disable account health operations
-**Severity**: Medium
-**Category**: evm-audit-erc20
-**Location**: `LendingMarket.listCollateral()`, `LendingMarket.collateralValueUsd()`, `LendingMarket.debtValueUsd()`, and `LendingMarket._liquidate()` (`src/LendingMarket.sol:107-114`, `src/LendingMarket.sol:132-143`, `src/LendingMarket.sol:219-230`)
-**Description**: Collateral listing validates neither that `token` is a contract nor that its `decimals()` is within a safe supported range. Valuation computes `10 ** decimals`; a listed token returning a sufficiently large value (78 or above) causes checked exponentiation to revert. Because `collateralValueUsd()` iterates the global token list, any user with a nonzero recorded amount of that asset can no longer borrow, pass the post-withdraw health check, or be liquidated. Tokens with unusual but smaller decimals can also create unsupported rounding behavior. This is a governance-triggered integration failure, but it can strand positions after a mistaken or compromised listing.
-**Proof of Concept**: Governance lists a token whose `decimals()` returns 78 and configures a feed. A user deposits one unit. Every call to `collateralValueUsd(user)` reaches `10 ** 78` and reverts from overflow. Consequently `healthFactor`, borrowing, collateral withdrawal (which calls `requireHealthy`), and liquidation for that account revert.
-**Recommendation**: Validate token code and cache normalized decimal metadata at listing time. Restrict decimals to a deliberately supported range (normally no more than 18 unless higher-decimal assets are explicitly tested), reject zero addresses/EOAs, and use a full-precision normalization library or asset adapter rather than unchecked generic exponentiation. Add a safe delisting/migration mechanism for a token whose metadata or implementation changes.
diff --git a/findings-general.md b/findings-general.md
deleted file mode 100644
index 85203bca72def126fa013964b28da77eed39b9d7..0000000000000000000000000000000000000000
--- a/findings-general.md
+++ /dev/null
@@ -1,63 +0,0 @@
-## [G-1] Anyone can replace the market implementation and seize all protocol assets
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo` has no authorization check and writes an arbitrary address directly to the ERC-1967 implementation slot. Because calls reach this function through `MarketProxy`, any account can replace the live implementation. The replacement executes in the proxy's storage context and the proxy is also the immutable `market` trusted by `CollateralVault`, so malicious implementation code can transfer the market's USDC and invoke `vault.seize` against every depositor. The attacker receives all treasury liquidity and all deposited collateral.
-**Proof of Concept**: (1) Deploy an implementation with a function that transfers the proxy's full USDC balance to the attacker and calls `CollateralVault.seize(user, token, attacker, amount)`. (2) Call `upgradeTo(maliciousImplementation)` through `MarketProxy`; the unguarded function stores the attacker's address. (3) Call the malicious function through the proxy. It executes as the trusted market and drains both contracts.
-**Recommendation**: Add `onlyOwner` to `upgradeTo`, reject `address(0)` and implementations with no code, and use a battle-tested UUPS implementation that verifies `proxiableUUID`. Put upgrade authority behind a timelock/multisig. Also disable initialization of the implementation contract itself.
-
-## [G-2] Anyone can install a malicious oracle and borrow the entire USDC treasury against dust
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)
-**Description**: `setOracle` lacks `onlyOwner`, so an arbitrary caller can replace the oracle. An attacker-controlled oracle can report an enormous collateral price and a minimal debt-asset price, making a dust-backed account appear healthy. The attacker can then borrow the market's directly seeded USDC balance and keep it; the recorded collateral cannot cover the debt.
-**Proof of Concept**: (1) Deposit a small amount of a listed collateral. (2) Deploy a contract implementing `getPrice` that returns an attacker-chosen high price for the collateral and a low positive price for USDC. (3) Call `setOracle` with that contract. (4) Call `borrow` for the market's full USDC balance. The manipulated health check passes and the real USDC is transferred to the attacker.
-**Recommendation**: Add `onlyOwner` to `setOracle`, reject zero/non-contract addresses, and preferably use a two-step, timelocked oracle update controlled by a multisig. Validate the new oracle against expected feeds and bounds before activating it.
-
-## [G-3] Anyone can weaken the liquidation threshold and drain treasury liquidity
-**Severity**: Critical
-**Category**: evm-audit-general
-**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)
-**Description**: `setLiquidationThreshold` is publicly callable and accepts an unbounded value. A caller can set it far above `BPS`, causing nearly uncollateralized positions to pass `healthFactor`. The attacker receives real USDC while the protocol is left with bad debt backed by negligible collateral.
-**Proof of Concept**: (1) Deposit a minimal amount of listed collateral. (2) Call `setLiquidationThreshold(type(uint256).max / 1e18)` or another very large value that does not overflow the particular health-factor calculation. (3) Borrow up to the market's USDC liquidity. The inflated threshold makes the health factor exceed `1e18` despite insufficient collateral.
-**Recommendation**: Add `onlyOwner` and enforce a conservative bound such as `0 < bps && bps <= BPS`. Apply governance delay/multisig controls to risk-parameter changes and add invariant tests proving that increasing the threshold cannot permit undercollateralized borrowing.
-
-## [G-4] Callback-capable collateral can be withdrawn multiple times while leaving fictitious collateral recorded
-**Severity**: High
-**Category**: evm-audit-general
-**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)
-**Description**: `withdraw` transfers tokens before reducing `balanceOf` and before checking account health. A listed ERC777-like or otherwise callback-capable token can reenter `withdraw` during `transfer`. Every nested call reads the same pre-withdraw balance, transfers again, and then writes the same final balance. The account can therefore remove more collateral than it is charged for, retain an overstated vault balance, and borrow USDC that is no longer backed. The README explicitly plans to broaden collateral support, including yield-bearing and rebasing assets, making the token-behavior assumption security-critical.
-**Proof of Concept**: (1) A callback-capable token is listed and an attacker deposits `X`. (2) The attacker calls `withdraw(token, X)`. (3) During the token transfer callback, the attacker reenters `withdraw(token, X)`. Both invocations observe `balanceOf == X`, both transfer `X`, and both finally store zero. With a partial amount, the same technique can leave a positive fictitious balance that supports a USDC borrow.
-**Recommendation**: Follow checks-effects-interactions: decrement `balanceOf` before calling the token, then perform the health check and transfer (a revert rolls all changes back). Add a reentrancy guard as defense in depth and explicitly vet or reject callback/rebasing collateral types until accounting supports them.
-
-## [G-5] Unchecked ERC20 return values allow unbacked balances or debt cancellation
-**Severity**: High
-**Category**: evm-audit-general
-**Location**: `CollateralVault.deposit()`, `CollateralVault.withdraw()`, `CollateralVault.seize()`, `LendingMarket.repay()`, `LendingMarket._borrow()`, and `LendingMarket._liquidate()`
-**Description**: Every ERC20 `transfer`/`transferFrom` return value is ignored. A token that returns `false` instead of reverting can cause state transitions to complete without the corresponding asset movement. Most critically, a false-returning listed collateral creates credited collateral without a deposit, and a false-returning debt asset lets `repay` reduce debt or `_liquidate` clear a borrower's entire debt without receiving payment. The immediate launch assets may revert on failure, but the implementation presents the same unchecked generic interface for planned future listings and upgrades.
-**Proof of Concept**: For a listed token whose `transferFrom` returns `false`, call `deposit(token, amount)`. No tokens arrive, but `balanceOf[msg.sender][token]` increases by `amount`; the attacker then borrows real USDC against the fictitious balance. Alternatively, if a configured debt token returns `false`, calling `repay` reduces principal even though the market receives nothing.
-**Recommendation**: Use a safe-transfer library that accepts either `true` or empty returndata and reverts on `false` or malformed returndata. For collateral deposits, additionally measure the vault's balance before and after transfer and credit only the amount actually received; define explicit policy for fee-on-transfer and rebasing assets.
-
-## [G-6] Borrow authorizations have no nonce or deadline and can be replayed indefinitely
-**Severity**: Medium
-**Category**: evm-audit-general
-**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)
-**Description**: The signed struct contains only `borrower` and `amount`; it has neither a nonce nor expiry, and no digest is marked consumed. Anyone who sees one authorization can submit it repeatedly for as long as the account remains healthy. The recipient is the borrower, so a relayer does not directly steal the proceeds, but they can force the signer to take repeated unwanted debt, consume their borrowing capacity, and push the position to the liquidation boundary. A signature also remains valid indefinitely and after repayment.
-**Proof of Concept**: Obtain one valid signature authorizing a borrow of `A`. Call `borrowWithSig(borrower, A, ...)` repeatedly. Every call recovers the same borrower and succeeds until the health check or market liquidity stops it. After the borrower repays, the same old signature can be replayed again.
-**Recommendation**: Include a per-borrower nonce, deadline, and preferably the intended relayer/receiver in `BORROW_TYPEHASH`; check the deadline and increment the nonce before borrowing. Use a standard EIP-712/ECDSA implementation that rejects malleable signatures and invalid `v` values.
-
-## [G-7] The borrower array can be grown without bound until batch liquidation is unusable
-**Severity**: Medium
-**Category**: evm-audit-general
-**Location**: `LendingMarket._borrow()` and `LendingMarket.liquidateAll()` (`src/LendingMarket.sol:197`, `src/LendingMarket.sol:190`)
-**Description**: `_borrow` appends whenever `principalOf[borrower] == 0` but entries are never removed or marked as already known. Any account can repeatedly call `borrow(0)`, for which the principal remains zero and the zero-debt health factor is maximal, adding another entry each time. Normal users can also be added repeatedly after repaying. `liquidateAll` scans the entire attacker-growable array and performs oracle/vault calls per live entry; eventually it exceeds the Arbitrum transaction gas limit. Keepers lose the documented ability to sweep underwater positions during a sharp price move, increasing the chance of bad debt, although individual `liquidate` remains available.
-**Proof of Concept**: From one address, call `borrow(0)` thousands of times. Each call pushes that address into `borrowers` because its principal remains zero. Calling `liquidateAll` must iterate across all duplicate entries and eventually runs out of gas before completing.
-**Recommendation**: Reject zero and dust borrows, maintain an `isBorrower` membership flag, and remove users with an indexed set when debt reaches zero. Replace all-at-once liquidation with a bounded, cursor-based batch function accepting a maximum number of positions.
-
-## [G-8] Proxy construction permits an EOA implementation and an uninitialized deployment
-**Severity**: Low
-**Category**: evm-audit-general
-**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`)
-**Description**: The constructor does not verify that `implementation` contains code, and it allows empty `initData`. A delegatecall to a non-contract address reports success, so deployment tooling can silently create a proxy with no executable implementation. If initialization is omitted, `LendingMarket.initialize` remains publicly callable and an observer can become `owner`. The currently unprotected setters/upgrader make ownership less consequential, but once those Critical issues are fixed this deployment footgun becomes an ownership takeover or permanent deployment failure.
-**Proof of Concept**: Deploy `MarketProxy` with an EOA as `implementation` and non-empty encoded initialize data; `delegatecall` succeeds with empty returndata and the proxy deploys unusably. Or deploy a valid implementation with empty `initData`, then have another account call `initialize` through the proxy first and set itself as owner.
-**Recommendation**: Require `implementation.code.length > 0`, require non-empty initialization data for this deployment, and atomically delegatecall `initialize` in the constructor. Make the deployment script assert initialized owner, oracle, vault, and debt asset immediately after deployment.
diff --git a/findings-lending.md b/findings-lending.md
deleted file mode 100644
index 78375b3dfc090d2af7464faf1597867d0a74098c..0000000000000000000000000000000000000000
--- a/findings-lending.md
+++ /dev/null
@@ -1,47 +0,0 @@
-# Lending and Liquidation Findings
-
-## [HIGH] LEND-01 — Divide-before-multiply makes healthy positions liquidatable
-
-- **Contract / function:** `LendingMarket.sol`, `healthFactor()`
-- **Impact:** The market does not enforce the documented 80% liquidation threshold. Because the collateral/debt ratio is truncated to a whole integer first, every position with a collateral ratio from 100% through just under 200% receives the same health factor of `0.8e18` and is liquidatable. For example, a user with $150 of collateral and $100 of debt should have a health factor of 1.2, but the contract reports 0.8. A liquidator can repay the $100 debt and take $105 of collateral from this solvent user. The same error prevents users from borrowing to the advertised 80% LTV; they need at least 200% collateralization to pass the check.
-- **Cause:** `return (collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS;` performs integer division before applying the fixed-point scale.
-- **Fix:** Multiply before dividing, using overflow-safe full-precision math: `collateralUsd * liquidationThreshold * WAD / (debtUsd * BPS)`. Add boundary tests immediately below, at, and above 125% collateralization, plus fuzz tests against a high-precision reference implementation.
-
-## [HIGH] LEND-02 — The configured stETH/USD feed materially underprices wstETH collateral
-
-- **Contract / function:** Deployment configuration described in `README.md`; consumed by `LendingMarket.collateralValueUsd()` and `LendingMarket._liquidate()` through `PriceOracle.getPrice()`
-- **Impact:** wstETH is not redeemable 1:1 for stETH; one wstETH represents an increasing amount of stETH. Feeding the stETH/USD price directly as the price of one wstETH therefore undervalues every user's collateral by the wstETH/stETH exchange rate. Users can be liquidated before the intended threshold. During liquidation, the same underpricing makes the market transfer more wstETH than the stated 5% bonus, so a liquidator extracts the exchange-rate difference from the borrower in addition to the bonus.
-- **Cause:** The planned wstETH listing maps wstETH to the stETH/USD feed without converting through `wstETH.stEthPerToken()` (or using a purpose-built wstETH/USD feed).
-- **Fix:** Use Chainlink's Arbitrum wstETH/USD feed if supported and validate its heartbeat, or compose stETH/USD with the canonical wstETH-to-stETH conversion rate using carefully normalized fixed-point math. Test valuation and seizure using the live non-1:1 exchange rate before deployment.
-
-## [MEDIUM] LEND-03 — Full repayment can leave an unrepayable scaled-debt remainder
-
-- **Contract / function:** `LendingMarket.sol`, `repay()` and `debtOf()`
-- **Impact:** After interest makes `borrowIndex > 1e18`, repaying the displayed full debt can leave one or more units of scaled principal because both conversions round down. Once the displayed debt is very small, `amount * WAD / borrowIndex` can be zero, so further repayments transfer USDC without reducing principal. The borrower cannot close the position normally and cannot withdraw all collateral; their only escape is liquidation or a contract upgrade.
-- **Cause:** `debtOf()` rounds scaled principal down to debt units, then `repay()` independently rounds the debt payment down when converting it back to scaled principal. The full-repayment branch is not distinguished from partial repayment.
-- **Fix:** When `amount >= debt`, collect exactly `debt` and set `principalOf[onBehalfOf] = 0`. For partial repayments, define explicit rounding direction and reject a payment whose scaled reduction is zero. Add invariant tests that a full repayment always clears principal and that every accepted partial repayment reduces debt.
-
-## [MEDIUM] LEND-04 — Anyone can permanently gas-grief the keeper's bulk liquidation path for free
-
-- **Contract / function:** `LendingMarket.sol`, `_borrow()` and `liquidateAll()`
-- **Impact:** An attacker can call `borrow(0)` from arbitrarily many addresses. Each call appends the address to `borrowers` because its principal remains zero. Entries are never removed, and addresses can also be appended again after repayment or liquidation. The attacker pays no USDC and posts no collateral, yet can grow the array until `liquidateAll()` cannot fit in a block. Following a sharp price move, the documented keeper sweep becomes unusable, increasing the chance that positions remain underwater and turn into bad debt. Individual liquidations remain possible, but the intended crisis-response mechanism is lost.
-- **Cause:** `_borrow()` accepts zero and appends whenever current principal is zero; `liquidateAll()` performs an unbounded iteration over an append-only array.
-- **Fix:** Reject zero-value borrows, track membership separately, remove borrowers on closure, and replace the all-at-once sweep with bounded pagination (`start`, `maxCount`) or off-chain discovery plus individual liquidations. Set a meaningful minimum debt size so liquidation rewards cover Arbitrum execution costs.
-
-## [MEDIUM] LEND-05 — Deeply underwater positions have no economically viable liquidation path
-
-- **Contract / function:** `LendingMarket.sol`, `_liquidate()`
-- **Impact:** A liquidator must repay 100% of a user's debt before receiving collateral. If a fast oracle update or accrued interest makes the remaining collateral worth less than the debt, liquidation guarantees a loss: the liquidator pays the full debt and receives at most all collateral. Rational liquidators will leave the position untouched, so the treasury retains uncollectible debt and the account remains open indefinitely. Requiring the full debt also makes large liquidations unnecessarily capital-intensive.
-- **Cause:** Liquidation has no close factor, partial-repayment parameter, bad-debt settlement, or reserve/insurance backstop. The nominal 5% bonus cannot help once collateral value is below debt value.
-- **Fix:** Implement partial liquidation with a caller-specified repay amount and minimum collateral-out protection. Cap the bonus to available collateral, explicitly recognize residual bad debt, and fund a reserve/insurance mechanism able to settle it. Add simulations for abrupt 50%+ collateral moves and define who absorbs insolvency.
-
-## [MEDIUM] LEND-06 — USDC downtime accrues debt while repayment and liquidation are impossible
-
-- **Contract / function:** `LendingMarket.sol`, `accrueInterest()`, `repay()`, and `liquidate()`
-- **Impact:** Native USDC on Arbitrum is centrally pausable. While it is paused, borrowers cannot transfer USDC into the market to repay and liquidators cannot fund liquidations, but interest continues to advance by elapsed blocks. When transfers resume, borrowers that crossed the threshold during the outage can be liquidated immediately by bots before they have a practical chance to repay. Users lose collateral because of an external pause they could not defend against.
-- **Cause:** There is no market pause/emergency accounting mode and no post-resumption grace period; interest is calculated purely from elapsed blocks at the next state change.
-- **Fix:** Add a narrowly scoped emergency mode that freezes borrowing and interest/liquidation eligibility while the debt token is unavailable, while preserving safe collateral additions where possible. On resumption, provide a bounded repayment grace period before liquidation. Document governance controls and test pause/resume scenarios against a pausable USDC mock.
-
-## Notes on prospective collateral
-
-The README proposes weETH, ezETH, USDT, and later rebasing/yield-bearing assets. Do not treat wrappers as 1:1 with their underlying assets: each listing needs an independent market-price path or an explicitly validated wrapper conversion plus underlying feed. The current vault's nominal-balance accounting is also not suitable for rebasing tokens without an adapter/share-accounting layer. These are listing requirements rather than launch findings because those assets are not yet enabled.
diff --git a/findings-oracles.md b/findings-oracles.md
deleted file mode 100644
index b0fe4017335ba20b5f607c148aa9772be1ee7121..0000000000000000000000000000000000000000
--- a/findings-oracles.md
+++ /dev/null
@@ -1,42 +0,0 @@
-# Oracle and Pricing Findings
-
-## [CRITICAL] Anyone can replace the market oracle and drain all seeded USDC
-
-- **Contract / function:** `LendingMarket.setOracle()` (`src/LendingMarket.sol:91-94`)
-- **What happens:** `setOracle` has no access control. An attacker can deploy an oracle that reports an arbitrarily large collateral price (and a normal or tiny USDC price), call `setOracle`, deposit a trivial amount of wstETH, and borrow the market's entire seeded USDC balance. The same primitive can make every existing account appear underwater and let the attacker liquidate users at attacker-chosen prices. The attacker receives the treasury's USDC and/or users' collateral; the protocol is left with bad debt.
-- **Recommended fix:** Add `onlyOwner` (preferably a timelocked governance role) to `setOracle`. Validate that the new address is nonzero and contains code. Use a two-step/timelocked oracle change with an emergency pause, and test the candidate oracle for every listed collateral and the debt asset before activation.
-
-## [HIGH] wstETH is priced as one stETH, overpaying liquidators in wstETH
-
-- **Contract / function:** Launch feed configuration consumed by `PriceOracle.getPrice()`, `LendingMarket.collateralValueUsd()`, and `LendingMarket._liquidate()` (`src/PriceOracle.sol:39-45`, `src/LendingMarket.sol:132-138, 209-230`)
-- **What happens:** The README maps wstETH (`0x5979...0529`) directly to the stETH/USD feed (`0x07C5...f2a`). One wstETH represents more than one stETH because staking rewards accumulate in its conversion rate. The market therefore treats `1 wstETH == 1 stETH`. This understates users' collateral value, makes them borrow less than intended and become liquidatable prematurely. More importantly, liquidation computes the number of wstETH to seize by dividing a USD claim by the stETH price. A liquidator receives `(1 + bonus)` worth of **stETH units** as wstETH units, whose real value is higher by the wstETH/stETH exchange rate. Thus a liquidator extracts more than the configured 5% bonus from the unlucky borrower; the excess grows as staking rewards accumulate.
-- **Recommended fix:** Price wstETH itself. Compose a manipulation-resistant wstETH/stETH conversion rate with the stETH/USD feed (with independent freshness and validity checks), or use an appropriate dedicated wstETH/USD route. Unit-test both collateral valuation and seized-token amounts against the live conversion rate; never map wstETH directly to stETH/USD at 1:1.
-
-## [HIGH] Prices have no round-validity or freshness checks
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:39-45`)
-- **What happens:** The oracle calls deprecated `latestAnswer()` and cannot inspect `updatedAt`, `roundId`, `answeredInRound`, or `startedAt`. If either feed stops updating, all borrowing and liquidation continue indefinitely at the last price. An attacker can borrow excessive USDC against collateral whose market value has already fallen, leaving bad debt; in the reverse direction, users can be liquidated using an obsolete low collateral price or high USDC price. A deprecated/disabled feed can also brick every price-dependent operation.
-- **Recommended fix:** Use `latestRoundData()` and require `answer > 0`, `startedAt != 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and `block.timestamp - updatedAt <= maxAge[token]`. Store a per-feed maximum age based on that feed's Arbitrum heartbeat/deviation policy, rather than one global threshold. Add a controlled pause/fallback process for an unavailable or deprecated feed.
-
-## [MEDIUM] Arbitrum sequencer outages are not checked and no recovery grace period is enforced
-
-- **Contract / function:** `PriceOracle.getPrice()` and all price-dependent borrow/liquidation paths (`src/PriceOracle.sol:39-45`)
-- **What happens:** The deployment target is Arbitrum One, but the oracle never checks Chainlink's Arbitrum sequencer uptime feed. After the sequencer recovers, market transactions may execute before asset feeds have caught up. A borrower can exploit a pre-outage high collateral price to take USDC that is no longer adequately collateralized; a liquidator can exploit a pre-outage low price to seize collateral from a position that is healthy at current prices. Users or the treasury bear the difference.
-- **Recommended fix:** Before accepting any asset price, query the Arbitrum sequencer uptime feed, require the sequencer status to be up, validate its round data, and require at least a one-hour grace period since recovery. Apply this check consistently to borrow, withdraw-health checks, and liquidation.
-
-## [MEDIUM] Feed answers are not protected against zero, negative, or circuit-breaker values
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:39-45`), consumed by `LendingMarket.healthFactor()` and `_liquidate()`
-- **What happens:** A zero USDC/USD answer makes every debt position appear to have zero USD debt, so `healthFactor` returns the maximum value and an attacker with minimal collateral can borrow all available USDC. A zero collateral answer makes liquidation revert when `_liquidate` divides by `price`, preventing bad-debt containment. A negative answer is cast to `uint256` and generally causes arithmetic overflow/reverts for the configured 8-decimal feeds, globally denying borrow, withdraw, and liquidation. Finally, no check rejects a Chainlink aggregator's `minAnswer`/`maxAnswer`; in an extreme crash a floored collateral price can remain above the true market price and permit undercollateralized borrowing.
-- **Recommended fix:** Explicitly reject `answer <= 0`. For each feed, evaluate the underlying aggregator's configured bounds and reject boundary answers, or install independent conservative price/deviation circuit breakers and pause affected actions. Handle invalid values by pausing new borrowing while preserving safe repayment/emergency-resolution paths.
-
-## [LOW] Feeds with more than 18 decimals permanently revert price queries
-
-- **Contract / function:** `PriceOracle.getPrice()` (`src/PriceOracle.sol:44`)
-- **What happens:** Normalization evaluates `18 - feed.decimals()`. Any future feed with more than 18 decimals underflows and reverts. Because governance plans to list more assets, a mistaken feed selection can make valuation, withdrawals, borrowing, and liquidation revert for users exposed to that asset. Users gain nothing and can have positions stuck until governance repairs the feed.
-- **Recommended fix:** Normalize in both directions: multiply when decimals are below 18 and divide when above 18. Reject unreasonable decimal values during `setFeed`, and perform a successful validated price read before a collateral can be listed.
-
-## Oracle-specific notes
-
-- The configured addresses currently identify themselves on Arbitrum as `STETH / USD` and `USDC / USD`, both with 8 decimals. Dynamic decimal reads are therefore correct for the two launch feeds, but the wstETH denomination mismatch remains.
-- USDC is not hardcoded to USD parity; using USDC/USD is the correct direction. No TWAP, Pyth, LP-token pricing, or VRF path exists in the reviewed code.
diff --git a/findings-precision.md b/findings-precision.md
deleted file mode 100644
index de4c727d49c86b2c4e9bc1655e88fc66475df5c0..0000000000000000000000000000000000000000
--- a/findings-precision.md
+++ /dev/null
@@ -1,39 +0,0 @@
-## [P-1] Division before multiplication makes healthy positions liquidatable below 200% collateralization
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:145`)
-**Description**: The expression `(collateralValueUsd(user) / debtUsd) * liquidationThreshold * WAD / BPS` divides the two 18-decimal USD values before applying the WAD scale. This truncates every collateral-to-debt ratio between 1.0 and 1.999... to exactly 1. With the configured 80% threshold, such a position is reported at a health factor of 0.8 even when its intended health factor is as high as almost 1.6. Consequently, the implementation effectively requires 200% collateralization rather than 125% and allows liquidation of positions that are solvent under the documented parameters. A liquidator can pay the borrower's debt and receive collateral plus the 5% bonus; the borrower loses that bonus and is forcibly closed solely because of the precision error.
-**Proof of Concept**: A user has $1,500 of collateral and $1,000 of debt. The intended health factor is `1500e18 * 8000 * 1e18 / (1000e18 * 10000) = 1.2e18`, so the position is healthy. The implementation first evaluates `1500e18 / 1000e18` as `1`, then returns `1 * 8000 * 1e18 / 10000 = 0.8e18`. Any account can therefore call `liquidate(user)` and collect the configured liquidation bonus from this healthy borrower.
-**Recommendation**: Multiply before dividing, ideally with a full-precision `mulDiv`: `return Math.mulDiv(collateralValueUsd(user), liquidationThreshold * WAD, debtUsd * BPS);`. If bounds make the combined denominator unsafe, perform two full-precision operations while preserving the WAD scale and document the chosen rounding direction. Add boundary tests at exactly 125%, immediately above it, and immediately below it.
-
-## [P-2] Rounding borrow principal down permits uncollateralized micro-borrows that drain treasury liquidity
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`)
-**Description**: `_borrow()` credits principal with `amount * WAD / borrowIndex`, rounding down, but transfers the full requested USDC amount. As soon as interest has accrued and `borrowIndex > WAD`, borrowing one base unit of USDC records zero principal. Since `debtOf()` is then zero, `healthFactor()` returns `type(uint256).max`; the borrower needs no collateral. The attacker can repeat or batch this call, receiving treasury USDC each time while accruing no debt. The same rounding loss also undercharges larger repeated borrows by up to one principal unit per call.
-**Proof of Concept**: Wait until at least one block after initialization and call `accrueInterest()`, which makes `borrowIndex` greater than `1e18` at the nonzero configured rate. From an address with no collateral, call `borrow(1)` (one micro-USDC). The principal increment is `1 * 1e18 / borrowIndex = 0`; the health check sees no debt and passes; one USDC base unit is transferred. An attacker contract can loop this operation until the market's prefunded balance is exhausted (subject only to transaction gas and available liquidity).
-**Recommendation**: Round debt shares/principal up when borrowing, for example `principalDelta = Math.mulDiv(amount, WAD, borrowIndex, Math.Rounding.Ceil)`, and require `principalDelta != 0`. Use the exact rounded-up delta consistently for accounting. Add invariant tests asserting that every successful positive borrow increases `debtOf(borrower)` by at least the transferred amount and that an uncollateralized account can never receive debt assets.
-
-## [P-3] Full repayment rounds principal reduction down and leaves an irreducible debt residue
-**Severity**: High
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket.repay()` (`src/LendingMarket.sol:170`)
-**Description**: Repayment reduces principal by `amount * WAD / borrowIndex`, rounded down. Even when `amount` equals the entire value returned by `debtOf()`, the inverse conversion commonly leaves one principal unit. Once the residue is small enough that `amount * WAD / borrowIndex == 0`, later repayments transfer USDC but do not reduce principal at all. Because `amount` is capped to the rounded-down `debt`, the user cannot overpay by one unit to clear it. A nonzero debt prevents the borrower from withdrawing all collateral, leaving collateral locked until an upgrade or a very long period of additional index growth; repeated attempts also directly lose the transferred USDC.
-**Proof of Concept**: Let `principalOf[user] = 1,000,000` and `borrowIndex = 1.0000001e18`. `debtOf(user)` rounds to `1,000,000`. Calling `repay(user, 1,000,000)` transfers that full amount but subtracts only `floor(1,000,000e18 / 1.0000001e18) = 999,999`, leaving principal `1`. `debtOf(user)` remains `1`, but another repayment of `1` subtracts `floor(1e18 / 1.0000001e18) = 0`; the residue cannot be cleared through `repay()` and a complete collateral withdrawal fails the health check.
-**Recommendation**: Special-case full repayment: after collecting `debt`, set `principalOf[onBehalfOf] = 0`. For partial repayments, choose and document protocol-favoring rounding and reject any positive payment whose calculated principal reduction is zero. A robust pattern is to calculate the principal reduction first, cap it to stored principal, derive the exact asset amount from that reduction with consistent rounding, and only then transfer funds.
-
-## [P-4] Liquidation charges for value that rounding does not seize
-**Severity**: Low
-**Category**: evm-audit-precision-math
-**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)
-**Description**: The collateral amount `takeUsd * unit / price` rounds down, but `seizeUsd` is reduced by the full unrounded `takeUsd`. Thus the liquidator can receive slightly less collateral value than the accounting treats as seized. The shortfall is less than one smallest unit of each collateral token, which is negligible for launch wstETH but becomes material for a future low-decimal, high-price collateral. If `takeUsd < price / unit`, the seizure rounds to zero while the entire `takeUsd` is still discarded. This rounding favors the borrower at the liquidator's expense and can make marginal liquidations unattractive.
-**Proof of Concept**: For a listed token with `unit = 1e6`, `price = 3e18`, and `takeUsd = 2e12`, the calculated collateral amount is `2e12 * 1e6 / 3e18 = 0`. The vault transfers no collateral, yet `_liquidate()` subtracts the full `2e12` from `seizeUsd`; the liquidator has paid debt corresponding to that value without compensation.
-**Recommendation**: Choose a liquidation rounding policy explicitly. To deliver at least the promised seizure value, calculate token units with full-precision rounding up, capped by the user's balance, and reduce `seizeUsd` by the actual USD value of the units seized. Alternatively, round down but carry the unfilled remainder into the next collateral instead of discarding it. Enforce decimal and minimum-unit constraints when listing collateral.
-
-## [P-5] Feeds with more than 18 decimals permanently revert price conversion
-**Severity**: Low
-**Category**: evm-audit-precision-math
-**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`)
-**Description**: Price normalization computes `10 ** (18 - feed.decimals())`. If governance configures a feed whose decimals exceed 18, the subtraction underflows and every price-dependent borrow, withdrawal-health check, and liquidation reverts for that token. The launch feeds are expected to use at most 18 decimals, so this is a latent listing/configuration hazard rather than a current exploit.
-**Proof of Concept**: Set a token's feed to an aggregator returning `decimals() == 19`, then call `getPrice(token)`. Evaluation of `18 - 19` reverts under Solidity 0.8 arithmetic. Any market path that values the token consequently reverts.
-**Recommendation**: Validate feed decimals in `setFeed()` and either reject values above a supported bound or normalize both directions: multiply when `feedDecimals <= 18` and divide when `feedDecimals > 18`, with explicit rounding and overflow bounds. Cache validated feed metadata at configuration time.
diff --git a/findings-proxies.md b/findings-proxies.md
deleted file mode 100644
index 9f6fa308ce2549c4d5250aee9af3037ccf598234..0000000000000000000000000000000000000000
--- a/findings-proxies.md
+++ /dev/null
@@ -1,23 +0,0 @@
-## [P-1] Anyone can replace the market implementation and steal all treasury liquidity
-**Severity**: Critical
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo()` writes an arbitrary address directly to the ERC-1967 implementation slot without `onlyOwner` (or any other authorization). Because calls execute through `MarketProxy` by `delegatecall`, any account can replace all market logic while retaining the proxy's storage and token balances. An attacker can install logic that transfers the proxy's entire USDC balance to themselves, rewrite every position, or permanently disable the market. The attacker directly receives all treasury-seeded USDC held by the proxy; borrowers and the treasury lose access to the legitimate market state.
-**Proof of Concept**: (1) Deploy a contract with a function such as `drain(IERC20 token)` that calls `token.transfer(msg.sender, token.balanceOf(address(this)))`. (2) Call `LendingMarket(proxy).upgradeTo(address(maliciousImplementation))`; the call succeeds for any sender and overwrites the proxy's implementation slot. (3) Call `drain(USDC)` through the proxy. The malicious implementation executes in proxy context and transfers the proxy's full USDC balance to the attacker.
-**Recommendation**: Restrict upgrades to a deliberately secured authority (`onlyOwner`, preferably a timelocked multisig) and use a reviewed UUPS implementation such as OpenZeppelin `UUPSUpgradeable`, including `_authorizeUpgrade`. Add upgrade-event monitoring and operational upgrade tests.
-
-## [P-2] Optional initialization lets the first caller seize an uninitialized deployment
-**Severity**: High
-**Category**: evm-audit-proxies
-**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`) and `LendingMarket.initialize()` (`src/LendingMarket.sol:56`)
-**Description**: The proxy accepts empty `initData`, while `initialize()` is externally callable by anyone exactly once and accepts an attacker-selected owner, oracle, vault, and debt asset. No deployment script exists in the repository to establish that deployment and initialization will be atomic. If the proxy is deployed with empty data (or initialization is otherwise deferred), a mempool observer can initialize it first. The attacker becomes owner and permanently installs attacker-controlled dependencies. Once the treasury seeds the advertised proxy—or if seeding and setup are bundled later—the attacker can control listings and use the malicious dependencies to compromise or deny the market. This requires the specific deployment mistake of non-atomic initialization, but then permanently compromises the deployment.
-**Proof of Concept**: (1) Deploy `MarketProxy(implementation, "")`. (2) Before the deployer initializes it, an attacker calls `initialize(attacker, attackerOracle, attackerVault, USDC)` through the proxy. (3) The intended initializer now reverts with `AlreadyInitialized()`. The proxy is permanently configured with attacker-selected ownership and core dependencies unless it is abandoned or upgraded; in the current code the attacker can also exploit the unrestricted upgrade path in P-1 immediately.
-**Recommendation**: Require non-empty initialization calldata in the proxy constructor and atomically delegatecall `initialize` as part of deployment. Validate every initialization address as nonzero and, where appropriate, verify deployed code. Make the deployment script pass the exact encoded initializer and assert all resulting state before funding the proxy. Also lock the standalone implementation against direct initialization (for example with OpenZeppelin `Initializable` and `_disableInitializers()`), although direct initialization alone does not control this custom proxy.
-
-## [P-3] Upgrades do not verify that the replacement is code-compatible, so one bad upgrade can be irreversible
-**Severity**: Medium
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`) and `MarketProxy.fallback()` (`src/MarketProxy.sol:26`)
-**Description**: `upgradeTo()` accepts zero addresses, EOAs, and arbitrary contracts without checking code presence or ERC-1967/UUPS compatibility. All upgrade logic lives in the current implementation and the proxy has no independent admin recovery function. Consequently, setting the slot to an address without a working compatible `upgradeTo()` removes the only route to another implementation. Calls to an EOA can misleadingly return success with empty returndata, while the market is permanently unusable. After P-1 is fixed, an authorized operator typo or an incompatible release can still permanently strand the market and its state; users may be unable to borrow, repay, or liquidate, and treasury USDC may be stuck.
-**Proof of Concept**: Call `upgradeTo(address(0x1234))`, where `0x1234` has no code. The slot update succeeds. Subsequent proxy calls delegatecall an address with no code and return empty data. Because that address exposes no upgrade function and `MarketProxy` exposes no admin upgrade path, another implementation cannot be installed through the proxy.
-**Recommendation**: Adopt a standard UUPS implementation that checks `proxiableUUID()` against the ERC-1967 slot before changing implementations, reject `address(0)` and addresses with `code.length == 0`, and test upgrade compatibility/storage layout before execution. Alternatively, move a tightly controlled recovery/upgrade path into a standard transparent proxy. These checks supplement, not replace, the authorization required by P-1.
diff --git a/findings-signatures.md b/findings-signatures.md
deleted file mode 100644
index bec634a866bc1de191f358960f56ce19dd89353c..0000000000000000000000000000000000000000
--- a/findings-signatures.md
+++ /dev/null
@@ -1,31 +0,0 @@
-## [SIG-1] Anyone can replace the market implementation and take all protocol assets
-**Severity**: Critical
-**Category**: evm-audit-proxies
-**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
-**Description**: `upgradeTo` has no `onlyOwner` (or other authorization) check and writes an arbitrary address directly to the ERC-1967 implementation slot. Because calls arrive through `MarketProxy`, any account can make the proxy delegate all future calls to attacker-controlled code. The replacement code executes in the proxy's context, which is also the immutable `market` authorized by `CollateralVault`. An attacker can therefore transfer the market's seeded USDC and invoke `CollateralVault.seize()` for every depositor. There is also no code-size or UUPS compatibility check, so even an accidental call can permanently brick the market.
-**Proof of Concept**: (1) Deploy an implementation exposing a function that transfers the proxy's full USDC balance to the attacker and calls `vault.seize(victim, token, attacker, amount)`. (2) Call `MarketProxy.upgradeTo(attackerImplementation)` from any EOA; the fallback delegates to the current `LendingMarket`, which stores the supplied address without checking the caller. (3) Call the malicious drain function through the proxy. The attacker receives the treasury's USDC and all collateral held for users.
-**Recommendation**: Add `onlyOwner` to the upgrade entry point, validate `newImplementation.code.length != 0`, and use a reviewed UUPS implementation (including `onlyProxy`, `proxiableUUID`, and `_authorizeUpgrade`) or a standard transparent proxy. Put upgrade authority behind a multisig/timelock and test that direct implementation calls and incompatible implementations revert.
-
-## [SIG-2] Reusable borrow signatures let any holder repeatedly increase a user's debt
-**Severity**: High
-**Category**: evm-audit-signatures
-**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`)
-**Description**: The signed `Borrow(address borrower,uint256 amount)` struct contains neither a nonce nor a deadline, and the contract does not mark a digest as consumed. A signature is therefore valid forever and can be submitted repeatedly by anyone. Each submission adds `amount` to `principalOf[borrower]` until the health check reaches its limit. Although borrowed USDC is sent to the signer rather than the submitter, a leaked or previously relayed signature lets a griefer force the signer into unintended leverage and liquidation exposure. The unlucky signer receives additional USDC, but also incurs matching debt and can lose collateral plus the 5% liquidation bonus after a price move; the attacker can later act as liquidator and collect that bonus.
-**Proof of Concept**: (1) Alice deposits enough wstETH and signs one request to borrow 1,000 USDC. (2) A relayer submits that exact `(borrower, amount, v, r, s)` multiple times. (3) Every call recovers Alice and `_borrow` increases her principal again; nothing consumes the authorization. (4) Once Alice is close to the threshold, an adverse price move makes her liquidatable and a liquidator takes collateral including the configured bonus.
-**Recommendation**: Sign and consume a per-borrower nonce and include an expiration, for example `Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)`. Require `block.timestamp <= deadline`, increment `nonces[borrower]` before `_borrow`, and use OpenZeppelin `EIP712` plus `ECDSA.recover`. If arbitrary relayers are not a product requirement, additionally bind the intended submitter or require `msg.sender == borrower`.
-
-## [SIG-3] Cached EIP-712 domain remains tied to the initialization chain ID
-**Severity**: Low
-**Category**: evm-audit-signatures
-**Location**: `LendingMarket.initialize()` and `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:56`, `src/LendingMarket.sol:162`)
-**Description**: `domainSeparator` is computed once during initialization and never recomputed if `block.chainid` changes. Following a chain-ID-changing fork or migration, the contract continues accepting signatures made for the old domain while wallets correctly produce signatures for the new chain ID that the contract rejects. Coupled with the absence of nonces, old signed borrows remain usable on the forked deployment. This is a latent fork/migration failure rather than a current Arbitrum One theft path.
-**Proof of Concept**: Initialize when `block.chainid == A`, then execute the same state on a chain whose ID is `B`. `domainSeparator` still embeds `A`. A digest signed against domain `A` continues to recover, while a standards-compliant signature created against `B` fails with `BadSignature`.
-**Recommendation**: Use OpenZeppelin's upgradeable `EIP712` implementation and `_hashTypedDataV4`, which derives the separator for the active chain and proxy address. Alternatively cache both the initial chain ID and separator and recompute the separator whenever `block.chainid` differs.
-
-## [SIG-4] Two sensitive risk controls are callable by anyone
-**Severity**: Critical
-**Category**: evm-audit-access-control
-**Location**: `LendingMarket.setOracle()` and `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:91`, `src/LendingMarket.sol:96`)
-**Description**: Both setters omit `onlyOwner`. Any account can replace the trusted oracle or arbitrarily change the collateral threshold. An attacker can install a malicious `PriceOracle`-compatible contract that reports enormous collateral prices, deposit a negligible amount of a listed token, and borrow the entire USDC treasury. Alternatively, manipulating the threshold/oracle can make healthy users liquidatable; the caller can liquidate them and receive their collateral plus the bonus.
-**Proof of Concept**: (1) Deploy a contract whose `getPrice(collateral)` returns an enormous value and whose `getPrice(debtAsset)` returns a small positive value. (2) Call `setOracle` through the proxy from any EOA. (3) Deposit a trivial amount of listed collateral and call `borrow` for the proxy's full USDC balance. The forged health factor passes and the attacker receives all seeded USDC. No owner key or prior protocol state is required.
-**Recommendation**: Add `onlyOwner` to both setters. Validate nonzero contract addresses and sensible threshold bounds (at minimum `bps <= BPS`, with governance-approved lower/upper limits). Prefer a multisig plus timelock for oracle and risk changes, with an emergency pause mechanism for compromised feeds.

tokens used
82,360
````

## final message

Created [AUDIT-REPORT.md](/tmp/ethskills-audit-eval/2026-09-03T133206Z-codex-with-skill-1/audit-goal-001/AUDIT-REPORT.md).

Summary: **2 Critical, 8 High, 7 Medium, and 4 Low** findings. Current recommendation: **do not deploy** until the launch blockers are resolved.

`forge build` passes. `src/` is unchanged, all working notes were removed, and `AUDIT-REPORT.md` is the only new file.
