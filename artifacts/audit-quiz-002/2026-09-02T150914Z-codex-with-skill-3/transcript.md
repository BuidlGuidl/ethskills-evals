# Executor transcript — 2026-09-02T150914Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a062aa-caae-7082-a24a-90e2ef1e3d96
--------
user
We run the same fixed-rate borrowing contract on Ethereum mainnet and on
Arbitrum One. Identical bytecode, identical constructor arguments, deployed a
day apart. The rate is 4.00% per year. Interest is applied by a public
accrueInterest() that anyone can call, and the accounting is:

  uint256 constant SECONDS_PER_BLOCK = 12;

  function accrueInterest() public {
      uint256 blocksElapsed = block.number - lastAccrualBlock;
      if (blocksElapsed == 0) return;
      uint256 secondsElapsed = blocksElapsed * SECONDS_PER_BLOCK;
      index += index * rateBps * secondsElapsed / (10_000 * 365 days);
      lastAccrualBlock = block.number;
  }

Finance reconciled July across both deployments. On the rate alone, a
borrower holding 1,000,000 USDC of debt for all 31 days should owe 3,397 USDC
of interest. On mainnet that borrower was charged 3,391. On Arbitrum, same
debt, same 31 days, the charge came out at 3,391 as well — the two
deployments agree with each other to within a couple of dollars.

I had braced for the Arbitrum figure to be nonsense. That chain produces
blocks roughly every 250 milliseconds, so by my arithmetic this contract
should have been charging tens of times too much interest there, and it
plainly is not.

Two things I need before we sign off on deploying this same contract to Base
next month:

  1. Explain the July reconciliation. Why did Arbitrum land on the same
     number as mainnet, and why are both of them a shade under the 3,397 the
     rate implies?
  2. Tell me what this code will do on Base, with the arithmetic worked
     through on the same 1,000,000 USDC over 31 days.

Then tell me what you would change, if anything.

Write your answer to answer.md in this directory.

2026-09-02T15:09:15.544268Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a062aa-caae-7082-a24a-90e2ef1e3d96.tmp-1788361755326185864: line 2547: syntax error near unexpected token `('

codex
I’m using the audit skill because this is a cross-chain smart-contract accounting review. I’ll inspect its required guidance, verify the chain-specific block-number semantics, then write the reconciled arithmetic and recommendation to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/audit/SKILL.md" in /tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002
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
The skill’s routing requires the general, precision-math, lending, and chain-specific checklists here, including parallel specialist review. I’m loading those instructions and will cross-check the conclusion against official Arbitrum and Base documentation.
web search: 
web search: https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md
exec
/bin/bash -lc 'for u in evm-audit-master/SKILL.md evm-audit-general/references/checklist.md evm-audit-precision-math/references/checklist.md evm-audit-defi-lending/references/checklist.md evm-audit-chain-specific/references/checklist.md; do curl -fsSL "https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/$u"; done' in /tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002
 succeeded in 1150ms:
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
# General Solidity/EVM Security Checklist

Every item here is non-obvious — basic reentrancy, overflow checks, access control patterns are excluded.

## External Calls & Low-Level Interactions

- [ ] **Call to non-existent address returns true**: A low-level `.call()` to an address with no deployed code returns `(true, "")`. If you're relying on call success without verifying target has code via `extcodesize > 0` or `address.code.length > 0`, you'll silently accept no-ops. Look for: any `.call()` where the target address is user-supplied or computed. [beirao E-05]

- [ ] **Grief attack via returndata bombing**: When making `.call()` to an unknown address, the callee can return a massive `bytes` payload. Solidity automatically copies all returndata into memory, consuming gas quadratically. An attacker returns megabytes of data to grief the caller. Fix: use inline assembly to limit returndata copy size. Look for: `.call()` to untrusted addresses without assembly returndata handling. [beirao E-04]

- [ ] **Fixed gas in `.call{gas: X}()`**: Hardcoding gas amounts (e.g., `addr.call{gas: 2300}("")`) breaks when opcode costs change across hard forks (see EIP-1884 which repriced SLOAD). Also breaks on L2s with different gas schedules. Look for: any `.call` or `.send` with explicit gas amounts. [beirao E-03]

- [ ] **`msg.value` persistence in multicall/batch patterns**: In a contract with a `multicall(bytes[] calldata data)` function that loops through delegatecalls, `msg.value` is the SAME in every iteration. An attacker sends 1 ETH and "spends" it N times. Look for: `msg.value` used inside any loop or batch execution pattern. [beirao E-17, L-03]

- [ ] **`msg.value` in a multi-call via delegatecall**: Even without explicit loops, if a function uses `msg.value` and can be reached via `delegatecall` from a multicall, the value is re-readable. Look for: payable functions callable through delegatecall patterns. [beirao G-24]

- [ ] **try/catch always fails with insufficient gas**: Solidity `try/catch` doesn't protect against OOG in the external call. An attacker who controls gas forwarding can force the catch path every time by providing just enough gas to enter but not complete the try block. Look for: security-critical logic that depends on try succeeding vs catching. [beirao G-18]

- [ ] **`abi.encodePacked` with 2+ dynamic types = hash collisions**: `abi.encodePacked(string a, string b)` can collide: `encodePacked("a","bc") == encodePacked("ab","c")`. Look for: `keccak256(abi.encodePacked(...))` with multiple `string`, `bytes`, or dynamic array arguments. Fix: use `abi.encode()`. [beirao G-15, SWC-133]

- [ ] **Delegate calls to non-library contracts**: `delegatecall` to stateful contracts is extremely dangerous — the called contract's code runs in the caller's storage context. Look for: `delegatecall` to any address that isn't a known stateless library. [beirao E-09, E-10]

- [ ] **ETH transfer via `transfer()`/`send()` is 2300 gas**: This fails for contracts with non-trivial `receive()`/`fallback()` functions and fails on some L2s (zkSync). Always use `.call{value: x}("")`. Look for: `.transfer()` or `.send()`. [beirao E-07, multichain-auditor]

- [ ] **Unchecked return of low-level `.call()`**: `(bool success, ) = addr.call(data)` — if `success` isn't checked, the call fails silently. Look for: `.call()` without `require(success)`. [SWC-104]

## Force-Feeding Attacks

- [ ] **Force-feed via `selfdestruct`**: `selfdestruct(payable(target))` sends the contract's ETH balance to `target` regardless of whether target has `receive()`/`fallback()`. This breaks any invariant based on `address(this).balance`. Look for: any comparison or calculation using `address(this).balance`. [beirao G-03]

- [ ] **Force-feed via pre-computed CREATE2 address**: ETH can be sent to a CREATE2 address before the contract is deployed there. The newly deployed contract will have a non-zero ETH balance from block 0 that it didn't expect. Look for: balance assumptions in constructors/initializers. [beirao G-03]

- [ ] **Coinbase force-feeding**: A validator/miner can set their coinbase to any address, force-feeding the block reward. Look for: balance-based invariants in contracts that could be targeted by validators. [beirao G-03]

- [ ] **Direct token transfers bypass accounting**: Sending ERC20 tokens directly via `transfer()` to a contract (not through its deposit function) inflates `balanceOf(address(this))` without updating internal accounting. Look for: any use of `token.balanceOf(address(this))` as a source of truth instead of internal tracking variables. [beirao V-01, V-02, G-07]

## Pause Mechanism Pitfalls

- [ ] **Pausing liquidations = solvency crisis**: If a protocol's pause mechanism freezes liquidations, bad debt accumulates silently. When unpaused, cascading liquidations can drain the protocol. Look for: pause modifiers on liquidation functions. [beirao G-09, LEN-06]

- [ ] **Pause front-running**: If pausing requires an on-chain transaction, an attacker monitoring the mempool can front-run the pause with a malicious transaction. Look for: security-critical state changes that depend on pause being active. [beirao F-04]

- [ ] **`whenNotPaused` missing from critical functions**: Common to add pause to most functions but miss some edge case paths. Look for: functions that modify state or transfer value that lack the pause modifier when other similar functions have it. [beirao G-09]

- [ ] **Pause can permanently brick the contract**: If pause has no unpause mechanism, or if the unpause requires conditions that can't be met while paused, the contract is bricked forever. Look for: circular dependencies in pause/unpause logic. [beirao G-09]

## Reentrancy (Non-Obvious)

- [ ] **Read-only reentrancy**: During a callback (e.g., ERC777 `tokensReceived`, ERC721 `onERC721Received`), the attacked contract's state is stale. OTHER contracts that read state from the attacked contract via view functions will get stale data. Example: a lending protocol reads a vault's share price during a vault callback. Look for: protocols that read state from external contracts that have callback mechanisms. [beirao G-21]

- [ ] **Cross-contract reentrancy**: Contract A has a `nonReentrant` modifier, but during an external call from A, the attacker enters Contract B which shares state with A (e.g., same storage via proxy, or reads A's state). A's reentrancy guard doesn't protect B. Look for: multiple contracts sharing state where any one of them makes external calls. [beirao G-20]

- [ ] **ERC721 `safeMint`/`safeTransferFrom` callbacks**: These call `onERC721Received()` on the recipient, creating reentrancy vectors. Same for ERC1155's `_safeTransferFrom` with `onERC1155Received`. Look for: `_safeMint()`, `safeTransferFrom()` without reentrancy guards or CEI pattern. [beirao NFT-02, NFT-03]

- [ ] **ERC777 pre/post transfer hooks**: ERC777 tokens call `tokensToSend()` (before transfer) and `tokensReceived()` (after transfer). Both are reentrancy vectors that bypass `nonReentrant` if the modifier is only on the outer function. Look for: any protocol that accepts arbitrary ERC20 tokens — it might receive an ERC777. [beirao FT-08]

- [ ] **NoReentrancy modifier MUST be first**: If `nonReentrant` is placed after other modifiers, those modifiers' code executes before the lock is set. Look for: modifier ordering on external/public functions. [beirao G-17]

## Merkle Tree Pitfalls

- [ ] **Merkle proofs are front-runnable**: Once a valid proof is submitted on-chain, anyone can copy it. The claim must be bound to `msg.sender` (included in the leaf) to prevent theft. Look for: `claim()` functions where the leaf doesn't include the claimant's address. [beirao MT-01, MT-02, MT-03]

- [ ] **Zero hash as valid proof**: Passing `bytes32(0)` may satisfy poorly constructed Merkle trees where empty nodes are represented as zero. Look for: Merkle verification that doesn't reject zero-hash leaves. [beirao MT-04]

- [ ] **Duplicate leaves enable double-claim**: If the same data appears as two leaves in the tree, the same proof may allow claiming twice. Look for: trees constructed without deduplication. [beirao MT-05]

## Reveal-Gap Steering (value public before it's consumed)

- [ ] **A value revealed before the tx that consumes it can steer the outcome**: Any two-phase flow where a value becomes public before the code that acts on it runs — a VRF word sitting in the mempool, an oracle answer, a commit-reveal reveal, any request-then-fulfill — is exploitable if the consuming step reads *mutable* state to decide the outcome. The value can be provably unbiasable and the callback sender-authenticated and it is still exploitable, because the bias is not in the value — it is in the state the code reads *after* the value is already known. Rule to verify: the outcome must be a pure function of state committed at or before the moment the value was fixed. If any actor can change that state in the gap (deposit, mint, withdraw, reprice, reorder), the outcome is steerable. Check both directions of any window-lock, and confirm that a smooth price/amount guard is not being trusted to protect a discontinuous selection (`% N`). Look for: a callback / step-2 whose result depends on storage that an external function can mutate between reveal and execution. [Source: FWA / TokenWorks CryptoPunk #5450 incident, 2026]

## Code Structure Issues

- [ ] **Withdraw should undo ALL deposit state changes**: For every state variable modified during `deposit()`, there should be a symmetric reversal in `withdraw()`. Asymmetries cause accounting drift. Look for: compare `deposit` and `withdraw` functions line by line for state variable coverage. [beirao G-26]

- [ ] **Semantic overloading**: Using the same return value (e.g., `0`, `-1`, `type(uint256).max`) to mean different things in different contexts. Look for: magic numbers used in return values, especially in functions that return success/failure/amount. [beirao G-11]

- [ ] **Inconsistent logic across duplicated implementations**: When the same logic is implemented in multiple places (e.g., calculating fees in both `deposit` and `withdraw`), they may diverge over time. Look for: duplicated business logic that should be a shared internal function. [beirao G-01]

- [ ] **Documentation-code mismatch**: Comments describing one thing while code does another. Particularly dangerous when the comment matches the spec but the code doesn't. Look for: NatSpec/comments that describe different behavior than the implementation. [beirao F-07, G-12]

- [ ] **Deployment scripts not checked**: Bugs in deployment scripts (wrong constructor args, missing initialization calls, wrong chain configs) are as dangerous as bugs in contracts. Look for: deployment scripts that aren't tested or reviewed. [beirao G-13]

## Array and Loop Hazards

- [ ] **Unbounded loops with external calls = DoS**: If a loop iterates over a user-growable array and makes external calls (especially transfers), an attacker can grow the array until the function exceeds block gas limit. Look for: `for` loops over dynamic arrays that contain `.call()`, `.transfer()`, or `safeTransfer()`. [beirao G-04, L-02]

- [ ] **Duplicate addresses in calldata arrays**: When a function takes `address[] calldata addresses` and processes each one, duplicates can cause double-counting or double-payment. Look for: functions that iterate over user-provided address arrays without dedup checks. [beirao F-10]

- [ ] **First iteration edge case**: The first iteration of a loop may behave differently (e.g., empty state, uninitialized variables). Look for: loop body logic that assumes prior iterations have run. [beirao L-01]

## Block/Time Assumptions

- [ ] **`block.timestamp` only reliable for long intervals**: Validators can manipulate timestamps by several seconds. Don't use for intervals shorter than ~15 minutes. Look for: time-sensitive logic with sub-minute precision. [beirao G-28]

- [ ] **Block time varies across chains**: `block.number` as a time proxy: 12s on mainnet, ~2s on Optimism, ~0.25s on Arbitrum. A value of `7200` blocks = 1 day on mainnet but only hours elsewhere. Look for: hardcoded block counts used as time proxies. [multichain-auditor, beirao MC-01]

- [ ] **Block production may not be constant**: Arbitrum `block.number` reflects L1 blocks, updating in ~5-block jumps per minute. On Optimism, `block.number` is the L2 block. Look for: code that assumes monotonically incrementing `block.number` with constant intervals. [multichain-auditor, Arbitrum checklist]

## Comparison & Logic Operators

- [ ] **Off-by-one in comparisons**: `<` vs `<=`, `>` vs `>=` — especially in liquidation thresholds, fee boundaries, and time windows. A single off-by-one can make a position unliquidatable or skip fee collection. Look for: boundary comparisons in critical math. [beirao G-29, M-11]

- [ ] **Incorrect logical operators**: `&&` vs `||`, `==` vs `!=`, `!` applied to wrong subexpression. Look for: complex conditional expressions, especially negated ones. [beirao G-30]

## Multi-Agent Systems

- [ ] **All agents could be the same person**: In any system with multiple roles (buyer/seller, borrower/liquidator, proposer/voter), check what happens if one person controls all roles. Self-liquidation for profit, self-trading for rewards, etc. Look for: role-based systems without Sybil resistance. [beirao G-22]

- [ ] **Receiver address pointing to another system contract**: If a function takes a `receiver` parameter, what happens if the receiver is another contract in the same system? Look for: user-provided address parameters that could target internal system contracts. [beirao G-31]

## Solidity Compiler

- [ ] **Solidity version-specific bugs**: Each Solidity release has known bugs. Check the [changelog](https://github.com/ethereum/solidity/blob/develop/Changelog.md) for the version used. Look for: compiler version in `pragma`. [beirao G-16]

- [ ] **PUSH0 opcode (Solidity ≥0.8.20)**: The `push0` opcode emitted by default in ≥0.8.20 isn't supported on many L2s and alt-chains. Look for: `pragma solidity ^0.8.20` or higher in multichain deployments. [multichain-auditor, beirao MC-03]

- [ ] **Unchecked blocks need validation**: Code in `unchecked { }` bypasses overflow/underflow checks. Every unchecked block must be manually verified for safety. Look for: `unchecked` blocks, especially around user-influenced values. [beirao M-10]

- [ ] **Assigning negative value to uint reverts**: In Solidity ≥0.8.0, casting a negative `int` to `uint` reverts. In `unchecked`, it wraps. Look for: signed-to-unsigned conversions near `unchecked` blocks. [beirao M-09]

- [ ] **Regular time expressions are uint24**: `1 days`, `1 hours` etc. are `uint24` in some contexts. Operations mixing these with larger types may silently truncate. Look for: arithmetic involving Solidity time literals cast to larger types. [beirao M-04]

## General Solidity Footguns (Expanded from Beirao/Tamjid/Multichain-Auditor)

- [ ] **Force-feeding ETH to a contract**: Three methods bypass `receive()`/`fallback()`: (1) `selfdestruct(target)` sends ETH without calling any function. (2) Pre-computed CREATE2 addresses can receive ETH before deployment. (3) Block coinbase rewards go to the miner/validator address. Contracts using `address(this).balance` for logic are vulnerable. Look for: `address(this).balance` used in invariant checks or pricing. [beirao G-03]

- [ ] **Deleting a struct doesn't delete its nested mappings**: `delete myStruct` zeros out the struct fields but any mappings inside persist in storage. Look for: `delete` on structs containing mappings, where the mapping data should also be cleared. [beirao G-06]

- [ ] **`msg.value` in a loop or multicall**: If `msg.value` is checked inside a loop or in a `Multicall`/`Batchable` with `delegatecall`, the same `msg.value` is counted for every iteration. An attacker can deposit 1 ETH but get credit for N ETH across N calls. Look for: `msg.value` referenced in any function callable via multicall or batch. [beirao E-17, L-03, Tamjid C28, C29]

- [ ] **Call to address that doesn't exist returns true**: Low-level `.call()` to an address with no code returns `success = true` with empty returndata. This can silently skip operations if the target hasn't been deployed yet. Look for: `.call()` to addresses derived from configuration or computation without checking `extcodesize > 0`. [beirao E-05, Tamjid C34]

- [ ] **Semantic overloading**: Using the same variable or return value for multiple meanings (e.g., 0 means "not found" AND "zero balance") creates ambiguity that leads to logic errors. Look for: functions where a zero return could mean success, failure, or absence. [beirao G-11]

- [ ] **Code asymmetry — withdraw doesn't undo deposit state**: If `deposit()` updates state variables A, B, C, the `withdraw()` function should reverse ALL of A, B, C. Missing one creates an inconsistent state. Look for: deposit/withdraw function pairs where state modifications aren't symmetric. [beirao G-26]

- [ ] **`if (receiver == caller)` unexpected behavior**: Self-transfers or self-operations may skip important logic (e.g., fee charging, balance validation). Look for: functions where `from == to` or `sender == receiver` isn't handled as a special case. [beirao G-08]

- [ ] **Providing a system address as a user input**: A user passes the contract's own address, a pool address, or another system contract as the "receiver" parameter. This can bypass balance checks or create circular dependencies. Look for: user-supplied address parameters without validation against known system addresses. [beirao G-31]

- [ ] **`NoReentrant` modifier must be FIRST**: If reentrancy guard is placed after other modifiers, the other modifiers execute before the guard, potentially allowing reentry during modifier execution. Look for: `nonReentrant` not being the first modifier in the modifier chain. [beirao G-17]

- [ ] **Cross-contract reentrancy**: Two contracts share state. Contract A calls external contract, which reenters Contract B. B reads stale state from the shared storage because A hasn't finished updating it. `nonReentrant` on individual contracts doesn't prevent this. Look for: multiple contracts sharing storage (via diamond pattern, delegatecall, or direct storage access) without a global reentrancy lock. [beirao G-20]

- [ ] **Read-only reentrancy**: A view function on contract A is called during a callback from contract A's state-modifying function. The view returns stale data because the state hasn't been committed yet. Other protocols reading A's view during this window get incorrect prices/balances. Look for: view functions that can be called during callbacks from the same contract's mutating functions. [beirao G-21]

- [ ] **Reorgs change CREATE-deployed addresses**: On chains with reorgs (Polygon, rollup chains), a CREATE deployment may end up at a different address post-reorg if the nonce changes. Users who sent funds to the pre-reorg address lose them. Look for: `new Contract()` (CREATE) where the address is pre-computed and funds are sent to it. [beirao G-19]

- [ ] **Solidity version-specific compiler bugs**: Each Solidity version has known bugs. Check the [Solidity changelog](https://github.com/ethereum/solidity/blob/develop/Changelog.md) for bugs affecting the specific version used. Look for: the exact `pragma solidity` version and cross-reference with known bugs. [beirao G-16]

- [ ] **Updating memory struct/array doesn't update storage**: Copying a storage struct/array to memory creates a local copy. Modifying the memory copy doesn't persist. Look for: struct assignments like `MyStruct memory s = storageStruct; s.field = newValue;` without writing back. [Tamjid C17]

- [ ] **State variable shadowing**: A child contract declares a variable with the same name as a parent's. The child's variable shadows the parent's, leading to two different storage slots for what appears to be the same variable. Look for: variables in child contracts with the same name as parent contract variables. [Tamjid C18]

- [ ] **`block.timestamp` should only be used for long intervals**: Miners/validators can manipulate timestamps by a few seconds. Using it for sub-minute precision is unreliable. Look for: `block.timestamp` in calculations where seconds matter (e.g., interest calculations per second). [Tamjid C4, beirao G-28]

- [ ] **Don't assume specific ETH balance**: Contracts can receive ETH via selfdestruct, coinbase, or pre-deployment sends. `require(address(this).balance == expectedAmount)` will break. Look for: exact balance assertions or calculations dependent on a specific ETH balance. [Tamjid C14]

---

## RareSkills — Smart Contract Security Comprehensive (Phase 3)

- [ ] **Solidity doesn't upcast to final uint size in expressions**: `uint8 a * uint8 b` assigned to `uint256 product` will still revert if result > 255. Each operand must be individually upcast: `uint256(a) * uint256(b)`. Especially dangerous with struct-packed small types. [Source: RareSkills — Smart Contract Security]

- [ ] **Ternary operator silently returns uint8**: `(condition ? 1 : 0)` in expressions returns uint8. Adding to uint256(255) overflows and reverts. Cast explicitly: `(condition ? uint256(1) : uint256(0))`. [Source: RareSkills — Smart Contract Security]

- [ ] **Solidity downcasting doesn't revert on overflow**: `int8(value + 1)` silently truncates without reverting in Solidity ≥0.8. Use SafeCast library for all type narrowing. [Source: RareSkills — Smart Contract Security]

- [ ] **Writes to storage pointers don't save new data**: `Foo storage foo = myArray[0]; foo = myArray[1];` does NOT copy myArray[1] to myArray[0]. The pointer reassignment is a no-op on the underlying storage. [Source: RareSkills — Smart Contract Security]

- [ ] **Deleting structs with dynamic types doesn't delete the inner mappings**: `delete buzz[i]` removes the struct but inner `mapping(uint256 => uint256) bar` retains its data. `getFromFoo(1)` still returns 6 after deletion. [Source: RareSkills — Smart Contract Security]

- [ ] **Mixed accounting between balance variable and introspection**: If a contract tracks balances via `myBalance` variable AND uses `address(this).balance`, forced ETH via `selfdestruct` or direct ERC20 transfers create inconsistency. Pick one accounting method. [Source: RareSkills — Smart Contract Security]

- [ ] **Merkle proof treated as password — leaf not tied to msg.sender**: If the merkle leaf is just the address (not hashed with msg.sender binding), anyone who knows the tree can create valid proofs. Also: unhashed leaf == merkle root passes verification. And: valid proofs can be front-run. [Source: RareSkills — Smart Contract Security]

- [ ] **msg.value reused in loops (payable multicalls)**: In multicall patterns, `msg.value` is constant throughout the loop, allowing the same ETH to be "spent" multiple times. Root cause of the Opyn hack. [Source: RareSkills — Smart Contract Security]

- [ ] **Returning large memory arrays for gas griefing**: External calls that return unbounded `bytes memory` force the caller to allocate quadratic gas for memory > 724 bytes. Use assembly with `returndatacopy()` to control copied data size. [Source: RareSkills — Smart Contract Security]

- [ ] **ERC20 fee-on-transfer breaks balance accounting**: If `balancesInContract[msg.sender] += amount` but actual received amount is `amount * 99/100`, the recorded balance exceeds actual balance. Last withdrawer gets short-changed or reverts. Check balance before/after transfer. [Source: RareSkills — Smart Contract Security]

- [ ] **Rebasing tokens break stored balance accounting**: Rebasing tokens change everyone's balance automatically. If a contract stores `balanceHeld[user] = amount` at deposit time, the actual balance may differ at withdrawal. Either disallow rebasing tokens or use `balanceOf(address(this))` checks. [Source: RareSkills — Smart Contract Security]

- [ ] **ERC4626 inflation attack — front-running first depositor**: First depositor donates assets to inflate share price, causing subsequent depositors to receive 0 shares due to rounding. Combination of front-running + rounding error. Mitigate with virtual shares/assets or minimum first deposit. [Source: RareSkills — Smart Contract Security]

## Devdacian — Base AI Auditor Primer Additions (Phase 3)

- [ ] **Auction can be seized during active period — off-by-one in timestamp**: If auction end check uses `>` instead of `>=`, the auction can be seized at exactly `auctionStartTimestamp + auctionLength`, one second early. [Source: Devdacian — Base Primer]

- [ ] **Loan state manipulation via refinancing to cancel auctions indefinitely**: Borrowers can cancel liquidation auctions by refinancing the loan, then allow it to become liquidatable again, repeating the cycle to extend loans indefinitely. [Source: Devdacian — Base Primer]

- [ ] **Double debt subtraction during refinancing**: If refinancing subtracts the old debt from pool balance and also subtracts it again during loan transfer, the pool balance becomes understated, potentially blocking future operations. [Source: Devdacian — Base Primer]

- [ ] **Griefing with dust loans below minLoanSize**: If `minLoanSize` is only checked at loan creation but not on refinancing/splitting, attackers can create compliant loans then split them into dust, forcing unwanted small positions onto lenders. [Source: Devdacian — Base Primer]
# Precision & Math Security Checklist

## Division Before Multiplication

- [ ] **Always multiply before dividing**: `(a / b) * c` loses precision from the division. Must be `(a * c) / b`. This is the single most common precision bug in DeFi. Look for: any expression where a division appears to the left of a multiplication. [Dacian, ERC4626 primer pattern #35]

- [ ] **Hidden division-before-multiplication in library calls**: Expand function calls to reveal hidden ordering. Example: `utilRate.wmul(slope1).wdiv(optimalUsageRate)` expands to `utilRate * (slope1 / 1e18) * (1e18 / optimalUsageRate)` — division before multiplication. Fix: `utilRate * slope1 / optimalUsageRate`. Look for: chained `mulDiv`, `wmul`, `wdiv` calls where the division happens first. [Dacian, ERC4626 primer]

- [ ] **Extra divisions by scaling factor**: A common copy-paste bug is dividing by 1e18 twice instead of once. Example: `(amountToBuyLeftUSD * 1e18 / collateralval) / 1e18) / 1e18` — the last `/1e18` destroys 18 digits of precision. Look for: sequential divisions by the same constant. [ERC4626 primer USSD example]

- [ ] **Division resulting in zero for small values**: When `amount < divisor`, Solidity integer division returns 0. Example: `(amount * rewardRate) / totalSupply` returns 0 when `amount * rewardRate < totalSupply`. Look for: intermediate values that could be < the denominator. [Dacian]

## Rounding Direction

- [ ] **Protocol-favoring rounding rule**: Deposits/mints should round DOWN (give fewer shares). Withdrawals/redeems should round UP (burn more shares). Any deviation means users can extract rounding dust. Look for: `mulDiv` or division calls without explicit rounding direction in vault math. [ERC4626 checklist]

- [ ] **Inconsistent rounding across functions**: If `deposit()` rounds one way and `withdraw()` rounds the same way, an attacker can loop deposits/withdrawals to extract dust each cycle. Look for: both deposit and withdraw using `Math.mulDiv` with the same rounding mode. [ERC4626 checklist M1]

- [ ] **Inverse fee calculation error**: When converting between assets and shares with fees: `shares = assets / (1 - fee)` NOT `shares = assets * (1 - fee)`. The latter under-charges. Look for: fee-adjusted conversion formulas. [ERC4626 checklist M5]

## Integer Overflow/Underflow (Even with Solidity ≥0.8)

- [ ] **Overflow in `unchecked` blocks**: Code in `unchecked { }` has no overflow protection. A value wrapping from `type(uint256).max` to 0 or vice versa in unchecked code is a critical bug. Look for: every `unchecked` block, especially those with user-influenced values. [beirao M-10]

- [ ] **Downcast overflow**: Casting `uint256` to `uint128`, `uint64`, `uint32`, etc. silently truncates. Example: `uint32(amount)` where `amount > type(uint32).max` silently wraps. Look for: any explicit or implicit downcast, especially `uint32`, `uint64`, `uint128`. Use `SafeCast`. [ERC4626 primer pattern #20]

- [ ] **Negative-to-unsigned cast**: `uint256(negativeInt256)` creates a massive positive number in unchecked context, or reverts in checked context. When taking absolute value: must use `uint256(-negativeValue)` not `uint256(negativeValue)`. Look for: `uint256(signedVariable)` or `uint128(signedVariable)`. [ERC4626 primer pattern #66]

- [ ] **Signed-unsigned addition/subtraction overflow**: `int256 x + uint256 y` — if `y > type(int256).max`, this overflows. Look for: mixed signed/unsigned arithmetic. [ERC4626 primer pattern #55]

- [ ] **Overflow in time-based calculations**: `block.timestamp * rate` or `(endTime - startTime) * emissionRate` can overflow for large time differences or rates, especially with `int40`/`int64` types. Look for: time arithmetic with narrow types. [ERC4626 primer pattern #72]

## Decimal Handling

- [ ] **Oracle decimal mismatch**: Code assuming 8-decimal Chainlink feeds breaks with 6-decimal or 18-decimal feeds. Example: `price * 10**(18 - feed.decimals())` — correct for 8 decimals, wrong for 6 or 18. Look for: hardcoded decimal adjustments without querying `decimals()`. [ERC4626 primer pattern #26]

- [ ] **Token decimal mismatch in price calculations**: When computing value of `tokenA` in terms of `tokenB`, both token decimals AND oracle decimals must be normalized. A 6-decimal token priced by an 8-decimal oracle requires different scaling than an 18-decimal token. Look for: price calculations that don't normalize for both token and oracle decimals. [beirao V-04, Decurity CDP]

- [ ] **Decimal scaling for vault with non-18 decimal assets**: ERC4626 vaults with 6-decimal underlying tokens (USDC) need careful decimal scaling between shares (usually 18) and assets (6). Look for: hardcoded `1e18` in vault math when the underlying isn't 18 decimals. [ERC4626 checklist M6]

- [ ] **Zero/one remaining after division**: After fee deduction or precision scaling, a value of 1 wei may remain in the system. Over many operations, these round-to-1 remainders accumulate. Look for: fee calculations where `amount * fee / FEE_DENOMINATOR` always leaves ≥1 wei. [beirao V-06]

## Accumulator & Interest Math

- [ ] **Compounding when claiming simple interest**: If the interest accrual formula assumes simple interest but rewards/interest is claimed and re-deposited by users, the effective rate is higher than intended. Look for: interest rate formulas that don't account for compounding frequency. [ERC4626 primer]

- [ ] **Reward per token precision loss**: In staking reward contracts, `rewardPerToken = rewardRate * duration / totalStaked`. If `totalStaked` is very large relative to `rewardRate * duration`, this rounds to 0 and rewards are permanently lost. Look for: reward distribution math where the numerator can be smaller than the denominator. [Dacian]

- [ ] **Missing state update before reward claim**: If `_updateIntegrals()` isn't called before `_fetchRewards()`, all rewards accrued since the last update are lost. The fetch updates `lastUpdate` without capturing pending rewards. Look for: reward claim functions that don't update global state first. [ERC4626 primer pattern #17]

- [ ] **Fee shares minted after reward distribution**: If fee shares are minted AFTER rewards are distributed, the fee captures a portion of the rewards meant for existing holders. Must mint fee shares BEFORE distributing rewards. Look for: ordering of fee minting vs reward distribution. [ERC4626 primer pattern #9]

## Special Values

- [ ] **Division by zero returns 0 in assembly**: In Yul/inline assembly, `div(x, 0)` returns 0 instead of reverting. Look for: assembly division without prior zero-check on denominator. [beirao M-12]

- [ ] **`type(uint256).max` as sentinel value**: Using max-uint as "no limit" can cause overflow when added to anything. Look for: `type(uint256).max` used in calculations (not just comparisons). [weird-erc20]

- [ ] **Extreme weight ratios cause overflow**: In weighted pool math, `balance * (ratio ^ (1/weight))` overflows when weight is very small (e.g., 1.166%). Example: `7500e21 * (3.0 ^ 85.76) = OVERFLOW`. Look for: exponential calculations where the exponent can be very large. [ERC4626 primer pattern #73]

## Precision Loss Patterns (Expanded from Beirao/Tamjid)

- [ ] **Solidity time literals are uint24**: Expressions like `1 days`, `1 hours` are `uint24`. Operations involving these literals cast the result to `uint24`, which can overflow for large time calculations. `1 days * largeNumber` may silently truncate. Look for: arithmetic with Solidity time literals and large multipliers. [beirao M-04]

- [ ] **Rounding direction must favor the protocol**: In every division, the truncated remainder goes somewhere. In deposits: round shares DOWN (user gets fewer shares). In withdrawals: round assets DOWN (user gets fewer assets). In fee collection: round UP (protocol collects more). Getting this wrong lets users extract value. Look for: divisions in deposit/withdraw/fee paths without explicit rounding direction choice. [beirao M-06, ERC4626 Checklist M1]

- [ ] **Off-by-one in comparison operators**: `>` vs `>=`, `<` vs `<=` can mean the difference between allowing/blocking an action at the exact boundary. In liquidation: `healthFactor < 1.0` vs `healthFactor <= 1.0` determines if exactly-at-threshold positions are liquidatable. Look for: boundary conditions in health checks, auction timing, and threshold comparisons. [beirao M-11, Tamjid C22, C23]

- [ ] **Assigning negative value to uint reverts in Solidity >=0.8.0**: Even intermediate calculations can underflow. `uint a = 5; uint b = a - 10;` reverts. This can DoS functions where underflow was intentionally handled before 0.8.0. Look for: subtraction operations where the result could be negative but the type is unsigned. [beirao M-09]

- [ ] **`unchecked` blocks need explicit validation**: Unchecked blocks disable overflow/underflow checks for gas savings. Every unchecked block must have a proof that overflow/underflow is impossible or harmless. Look for: `unchecked` blocks without adjacent comments explaining why overflow is impossible. [beirao M-10, Tamjid C44]

- [ ] **Precision loss compounds across multiple operations**: A single division losing 1 wei is negligible. But if that result feeds into another division, and another, precision loss compounds exponentially. Look for: chains of divisions in multi-step calculations (e.g., reward distribution formulas with multiple intermediary divisions). [Tamjid C47]

---

## Dacian — Precision Loss Errors (Phase 3)

- [ ] **Division before multiplication hidden by function calls**: `wmul()` and `wdiv()` chaining can hide division-before-multiplication. Expand: `utilRate.wmul(slope1).wdiv(optimalUsageRate)` = `utilRate * (slope1/1e18) * (1e18/optimalUsageRate)` — the intermediate division causes precision loss. Fix: `utilRate * slope1 / optimalUsageRate`. [Source: Dacian — Precision Loss Errors, Yield VR Audit]

- [ ] **Rounding down to zero allows state changes without proper accounting**: If `decollateralized = loanCollateral * repaid / loanAmount` rounds to 0 for small repayments, the loan amount decreases but collateral stays unchanged. Repeated small repayments drain the loan while keeping all collateral. Fix: revert if decollateralized == 0. [Source: Dacian — Precision Loss Errors, Sherlock Cooler]

- [ ] **~50% value understatement from mixing precisions without scaling**: Adding `primaryBalance` (18 decimals) + `secondaryAmountInPrimary` (6 decimals) without first scaling the secondary token to primary precision causes a ~50% undervaluation of LP positions. [Source: Dacian — Precision Loss Errors, Sherlock Notional]

- [ ] **Excessive precision scaling — double-scaling already-scaled values**: When module A scales a token amount to 18 decimals, then passes it to module B which scales it again, the result is inflated by the scaling factor. Trace token amounts through the entire call path to verify they aren't re-scaled. [Source: Dacian — Precision Loss Errors, Sherlock Notional]

- [ ] **Mismatched precision scaling — decimals vs hardcoded 1e18**: If module A uses `token.decimals()` for precision and module B hardcodes `1e18`, tokens with non-18 decimals will have incorrect valuations when flowing between modules. [Source: Dacian — Precision Loss Errors, Code4rena Sublime/Yearn]

- [ ] **Downcast overflow silently invalidates pre-downcast invariant checks**: If `require(endTime > startTime)` passes with uint256 values, but `uint32(endTime)` overflows to 0 when endTime >= 2^32, the invariant is silently violated. Use OpenZeppelin's SafeCast for all downcasts. [Source: Dacian — Precision Loss Errors, Balancer Bug Bounty]

- [ ] **Rounding direction leaks value from protocol to traders**: In AMMs, `protocolFee` and `tradeFee` using `mulWadDown` (rounding down) lets traders pay slightly less than they should on every trade, leaking value. Fix: round fees up (`mulWadUp`). [Source: Dacian — Precision Loss Errors, Cyfrin SudoSwap Audit]
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
web search: site:docs.arbitrum.io block.number L1 block number Solidity Arbitrum ...
exec
/bin/bash -lc "curl -fsSL https://docs.arbitrum.io/build-decentralized-apps/arbitrum-vs-ethereum/block-numbers-and-time | sed -n '1,120p'
curl -fsSL https://docs.base.org/base-chain/network-information/network-information | rg -i -m 5 -C 2 'block time|2 seconds|block.number'
curl -fsSL https://specs.optimism.io/protocol/exec-engine.html | rg -i -m 8 -C 2 'block.number|block time|block number'" in /tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002
 exited 1 in 1991ms:
<!doctype html>
<html lang="en" dir="ltr" class="docs-wrapper plugin-docs plugin-id-default docs-version-current docs-doc-page docs-doc-id-arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time" data-has-hydrated="false">
<head>
<meta charset="UTF-8">
<meta name="generator" content="Docusaurus v3.10.2">
<title data-rh="true">Block gas limit, numbers and time | Arbitrum Docs</title><meta data-rh="true" name="viewport" content="width=device-width,initial-scale=1"><meta data-rh="true" property="og:url" content="https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time"><meta data-rh="true" property="og:locale" content="en"><meta data-rh="true" name="docusaurus_locale" content="en"><meta data-rh="true" name="docsearch:language" content="en"><meta data-rh="true" name="twitter:card" content="summary"><meta data-rh="true" name="twitter:site" content="@arbitrum"><meta data-rh="true" name="twitter:title" content="Block Numbers And Time"><meta data-rh="true" name="twitter:description" content="Arbitrum Docs"><meta data-rh="true" name="twitter:image" content="https://developer.arbitrum.io/img/devdocs.png"><meta data-rh="true" name="docusaurus_version" content="current"><meta data-rh="true" name="docusaurus_tag" content="docs-default-current"><meta data-rh="true" name="docsearch:version" content="current"><meta data-rh="true" name="docsearch:docusaurus_tag" content="docs-default-current"><meta data-rh="true" property="og:title" content="Block gas limit, numbers and time | Arbitrum Docs"><meta data-rh="true" name="description" content="Understand how Arbitrum handles block gas limits, block numbers, and transaction timing differently from Ethereum. Learn about parent chain gas components and block.number behavior on Arbitrum."><meta data-rh="true" property="og:description" content="Understand how Arbitrum handles block gas limits, block numbers, and transaction timing differently from Ethereum. Learn about parent chain gas components and block.number behavior on Arbitrum."><link data-rh="true" rel="icon" href="/img/logo.svg"><link data-rh="true" rel="canonical" href="https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time"><link data-rh="true" rel="alternate" href="https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time" hreflang="en"><link data-rh="true" rel="alternate" href="https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time" hreflang="x-default"><link rel="preconnect" href="https://app.posthog.com">
<script>!function(e,t){var o,s,r,n;t.__SV||(window.posthog=t,t._i=[],t.init=function(p,a,i){function c(e,t){var o=t.split(".");2==o.length&&(e=e[o[0]],t=o[1]),e[t]=function(){e.push([t].concat(Array.prototype.slice.call(arguments,0)))}}(r=e.createElement("script")).type="text/javascript",r.async=!0,r.src=a.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(n=e.getElementsByTagName("script")[0]).parentNode.insertBefore(r,n);var g=t;for(void 0!==i?g=t[i]=[]:i="posthog",g.people=g.people||[],g.toString=function(e){var t="posthog";return"posthog"!==i&&(t+="."+i),e||(t+=" (stub)"),t},g.people.toString=function(){return g.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),s=0;s<o.length;s++)c(g,o[s]);t._i.push([p,a,i])},t.__SV=1)}(document,window.posthog||[]),posthog.init("phc_AscFTQ876SsPAVMgxMmLn0EIpxdcRRq0XmJWnpG1SHL",{api_host:"https://app.posthog.com",persistence:"memory",disable_session_recording:!0,id:"default"})</script>


<script>window.__COPY_PAGE_BUTTON_OPTIONS__={customStyles:{},generateMarkdownRoutes:!1,placement:"auto",mcpServer:null,id:"default"}</script>


<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.13.24/dist/katex.min.css" integrity="sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM" crossorigin="anonymous"><link rel="stylesheet" href="/assets/css/styles.f6901591.css">
<script src="/assets/js/runtime~main.c377e3ba.js" defer="defer"></script>
<script src="/assets/js/main.9f906c67.js" defer="defer"></script>
</head>
<body>
<svg style="display: none;"><defs>
<symbol id="theme-svg-external-link" viewBox="0 0 24 24"><path fill="currentColor" d="M21 13v10h-21v-19h12v2h-10v15h17v-8h2zm3-12h-10.988l4.035 4-6.977 7.07 2.828 2.828 6.977-7.07 4.125 4.172v-11z"/></symbol>
</defs></svg>
<script>!function(){var t=function(){try{return new URLSearchParams(window.location.search).get("docusaurus-theme")}catch(t){}}()||function(){try{return window.localStorage.getItem("theme")}catch(t){}}();document.documentElement.setAttribute("data-theme",t||"light"),document.documentElement.setAttribute("data-theme-choice",t||"light")}(),function(){try{const a=new URLSearchParams(window.location.search).entries();for(var[t,e]of a)if(t.startsWith("docusaurus-data-")){var n=t.replace("docusaurus-data-","data-");document.documentElement.setAttribute(n,e)}}catch(t){}}(),document.documentElement.setAttribute("data-announcement-bar-initially-dismissed",function(){try{return"true"===localStorage.getItem("docusaurus.announcement.dismiss")}catch(t){}return!1}())</script><div id="__docusaurus"><link rel="preload" as="image" href="/img/logo.svg"><div class="sr-only" aria-hidden="true">For AI agents: a documentation index is available at the root level at /llms.txt and /llms-full.txt. Append .md to any URL for the markdown version of that page.</div><div role="region" aria-label="Skip to main content"><a class="skipToContent_fXgn" href="#__docusaurus_skipToContent_fallback">Skip to main content</a></div><div class="theme-announcement-bar announcementBar_mb4j" style="background-color:#e3246e;color:white" role="banner"><div class="content_knG7 announcementBarContent_xLdY">Reactivate your Stylus contracts to ensure they remain callable - <a href="https://docs.arbitrum.io/stylus/gentle-introduction#activation" target="_blank">here’s how to do it.</a></div></div><nav aria-label="Main" class="theme-layout-navbar navbar navbar--fixed-top"><div class="navbar__inner"><div class="theme-layout-navbar-left navbar__items"><button aria-label="Toggle navigation bar" aria-expanded="false" class="navbar__toggle clean-btn" type="button"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="2" d="M4 7h22M4 15h22M4 23h22"></path></svg></button><a class="navbar__brand" href="/"><div class="navbar__logo"><img src="/img/logo.svg" alt="Arbitrum Logo" class="themedComponent_mlkZ themedComponent--light_NVdE"><img src="/img/logo.svg" alt="Arbitrum Logo" class="themedComponent_mlkZ themedComponent--dark_xIcU"></div><b class="navbar__title text--truncate">Arbitrum Docs</b></a></div><div class="theme-layout-navbar-right navbar__items navbar__items--right"><a class="navbar__item navbar__link" href="/">Get started</a><div class="navbar__item dropdown dropdown--hoverable dropdown--right"><a href="#" aria-haspopup="true" aria-expanded="false" role="button" class="navbar__link">Build apps</a><ul class="dropdown__menu"><li><a class="dropdown__link" href="/build-decentralized-apps/quickstart-solidity-remix">Build with Solidity</a></li><li><a class="dropdown__link" href="/stylus/quickstart">Build with Stylus</a></li><li><a aria-current="page" class="dropdown__link dropdown__link--active" href="/arbitrum-essentials">Arbitrum essentials</a></li><li><a class="dropdown__link" href="/build-decentralized-apps/machine-payments-protocol">Machine Payments Protocol (MPP)</a></li></ul></div><a class="navbar__item navbar__link" href="/launch-arbitrum-chain/overview/introduction">Launch a chain</a><a class="navbar__item navbar__link" href="/run-arbitrum-node/overview">Run a node</a><a class="navbar__item navbar__link" href="/arbitrum-bridge/quickstart">Use the bridge</a><a class="navbar__item navbar__link" href="/how-arbitrum-works/inside-arbitrum-nitro">How it works</a><a class="navbar__item navbar__link" href="/notices/arbos61-upgrade-notice">Notices</a><div class="toggle_vylO colorModeToggle_DEke"><button class="clean-btn toggleButton_gllP toggleButtonDisabled_aARS" type="button" disabled="" title="system mode" aria-label="Switch between dark and light mode (currently system mode)"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" class="toggleIcon_g3eP lightToggleIcon_pyhR"><path fill="currentColor" d="M12,9c1.65,0,3,1.35,3,3s-1.35,3-3,3s-3-1.35-3-3S10.35,9,12,9 M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5 S14.76,7,12,7L12,7z M2,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S1.45,13,2,13z M20,13l2,0c0.55,0,1-0.45,1-1 s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S19.45,13,20,13z M11,2v2c0,0.55,0.45,1,1,1s1-0.45,1-1V2c0-0.55-0.45-1-1-1S11,1.45,11,2z M11,20v2c0,0.55,0.45,1,1,1s1-0.45,1-1v-2c0-0.55-0.45-1-1-1C11.45,19,11,19.45,11,20z M5.99,4.58c-0.39-0.39-1.03-0.39-1.41,0 c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0s0.39-1.03,0-1.41L5.99,4.58z M18.36,16.95 c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41 L18.36,16.95z M19.42,5.99c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06c-0.39,0.39-0.39,1.03,0,1.41 s1.03,0.39,1.41,0L19.42,5.99z M7.05,18.36c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06 c-0.39,0.39-0.39,1.03,0,1.41s1.03,0.39,1.41,0L7.05,18.36z"></path></svg><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" class="toggleIcon_g3eP darkToggleIcon_wfgR"><path fill="currentColor" d="M9.37,5.51C9.19,6.15,9.1,6.82,9.1,7.5c0,4.08,3.32,7.4,7.4,7.4c0.68,0,1.35-0.09,1.99-0.27C17.45,17.19,14.93,19,12,19 c-3.86,0-7-3.14-7-7C5,9.07,6.81,6.55,9.37,5.51z M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36 c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z"></path></svg><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" class="toggleIcon_g3eP systemToggleIcon_QzmC"><path fill="currentColor" d="m12 21c4.971 0 9-4.029 9-9s-4.029-9-9-9-9 4.029-9 9 4.029 9 9 9zm4.95-13.95c1.313 1.313 2.05 3.093 2.05 4.95s-0.738 3.637-2.05 4.95c-1.313 1.313-3.093 2.05-4.95 2.05v-14c1.857 0 3.637 0.737 4.95 2.05z"></path></svg></button></div><div class="navbarSearchContainer_Bca1"><div id="inkeep-shadowradix-_R_uclq5_" style="display:contents"></div><span></span></div></div></div><div role="presentation" class="navbar-sidebar__backdrop"></div></nav><div id="__docusaurus_skipToContent_fallback" class="theme-layout-main main-wrapper mainWrapper_z2l0"><div class="docsWrapper_hBAB"><button aria-label="Scroll back to top" class="clean-btn theme-back-to-top-button backToTopButton_sjWU" type="button"></button><div class="docRoot_UBD9"><aside class="theme-doc-sidebar-container docSidebarContainer_YfHR"><div class="sidebarViewport_aRkj"><div class="sidebar_njMd"><nav aria-label="Docs sidebar" class="menu thin-scrollbar menu_SIkG menuWithAnnouncementBar_GW3s"><ul class="theme-doc-sidebar-menu menu__list"><li class="theme-doc-sidebar-item-category theme-doc-sidebar-item-category-level-1 menu__list-item"><div class="menu__list-item-collapsible"><a class="categoryLink_byQd menu__link menu__link--sublist menu__link--active" href="/arbitrum-essentials"><span class="categoryLinkLabel_W154">Arbitrum essentials</span></a><button aria-label="Collapse sidebar category &#x27;Arbitrum essentials&#x27;" aria-expanded="true" type="button" class="clean-btn menu__caret"></button></div><ul class="menu__list"><li class="theme-doc-sidebar-item-link theme-doc-sidebar-item-link-level-2 menu__list-item"><a class="menu__link" tabindex="0" href="/arbitrum-essentials/how-to-estimate-gas"><span class="linkLabel_WmDU">Estimate gas</span></a></li><li class="theme-doc-sidebar-item-link theme-doc-sidebar-item-link-level-2 menu__list-item"><a class="menu__link" tabindex="0" href="/arbitrum-essentials/public-chains"><span class="linkLabel_WmDU">Chains and testnets</span></a></li><li class="theme-doc-sidebar-item-category theme-doc-sidebar-item-category-level-2 menu__list-item menu__list-item--collapsed"><div class="menu__list-item-collapsible"><a class="categoryLink_byQd menu__link menu__link--sublist menu__link--sublist-caret" role="button" aria-expanded="false" tabindex="0" href="/arbitrum-essentials/bridging/overview"><span class="categoryLinkLabel_W154">Bridging</span></a></div></li><li class="theme-doc-sidebar-item-category theme-doc-sidebar-item-category-level-2 menu__list-item"><div class="menu__list-item-collapsible"><a class="categoryLink_byQd menu__link menu__link--sublist menu__link--sublist-caret menu__link--active" role="button" aria-expanded="true" tabindex="0" href="/arbitrum-essentials/arbitrum-vs-ethereum/comparison-overview"><span class="categoryLinkLabel_W154">Arbitrum vs Ethereum</span></a></div><ul class="menu__list"><li class="theme-doc-sidebar-item-link theme-doc-sidebar-item-link-level-3 menu__list-item"><a class="menu__link" tabindex="0" href="/arbitrum-essentials/arbitrum-vs-ethereum/comparison-overview"><span class="linkLabel_WmDU">Comparison overview</span></a></li><li class="theme-doc-sidebar-item-link theme-doc-sidebar-item-link-level-3 menu__list-item"><a class="menu__link menu__link--active" aria-current="page" tabindex="0" href="/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time"><span class="linkLabel_WmDU">Block gas limit, numbers and time</span></a></li><li class="theme-doc-sidebar-item-link theme-doc-sidebar-item-link-level-3 menu__list-item"><a class="menu__link" tabindex="0" href="/arbitrum-essentials/arbitrum-vs-ethereum/rpc-methods"><span class="linkLabel_WmDU">RPC methods</span></a></li><li class="theme-doc-sidebar-item-link theme-doc-sidebar-item-link-level-3 menu__list-item"><a class="menu__link" tabindex="0" href="/arbitrum-essentials/arbitrum-vs-ethereum/solidity-support"><span class="linkLabel_WmDU">Solidity support</span></a></li><li class="theme-doc-sidebar-item-link theme-doc-sidebar-item-link-level-3 menu__list-item"><a class="menu__link" tabindex="0" href="/arbitrum-essentials/arbitrum-vs-ethereum/nonce-management"><span class="linkLabel_WmDU">Nonce management</span></a></li></ul></li><li class="theme-doc-sidebar-item-link theme-doc-sidebar-item-link-level-2 menu__list-item"><a class="menu__link" tabindex="0" href="/arbitrum-essentials/oracles/overview-oracles"><span class="linkLabel_WmDU">Oracles</span></a></li><li class="theme-doc-sidebar-item-category theme-doc-sidebar-item-category-level-2 menu__list-item menu__list-item--collapsed"><div class="menu__list-item-collapsible"><a class="categoryLink_byQd menu__link menu__link--sublist menu__link--sublist-caret" role="button" aria-expanded="false" tabindex="0" href="/arbitrum-essentials/precompiles/overview"><span class="categoryLinkLabel_W154">Precompiles</span></a></div></li><li class="theme-doc-sidebar-item-category theme-doc-sidebar-item-category-level-2 menu__list-item menu__list-item--collapsed"><div class="menu__list-item-collapsible"><a class="categoryLink_byQd menu__link menu__link--sublist menu__link--sublist-caret" role="button" aria-expanded="false" tabindex="0" href="/arbitrum-essentials/nodeinterface/overview"><span class="categoryLinkLabel_W154">NodeInterface</span></a></div></li><li class="theme-doc-sidebar-item-category theme-doc-sidebar-item-category-level-2 menu__list-item menu__list-item--collapsed"><div class="menu__list-item-collapsible"><a class="categoryLink_byQd menu__link menu__link--sublist menu__link--sublist-caret" role="button" aria-expanded="false" tabindex="0" href="/arbitrum-essentials/reference/chain-params"><span class="categoryLinkLabel_W154">Reference</span></a></div></li></ul></li><li class="theme-doc-sidebar-item-link theme-doc-sidebar-item-link-level-1"><a class="menu__link menu__list-item" href="/for-devs/dev-tools-and-resources/chain-info">Chain Info<span class="other-section-icon">↑</span></a></li><li class="theme-doc-sidebar-item-link theme-doc-sidebar-item-link-level-1"><a class="menu__link menu__list-item" href="/intro/glossary">Glossary<span class="other-section-icon">↑</span></a></li><li class="theme-doc-sidebar-item-link theme-doc-sidebar-item-link-level-1"><a class="menu__link menu__list-item" href="/for-devs/contribute">Contribute<span class="other-section-icon">↑</span></a></li></ul></nav></div></div></aside><main class="docMainContainer_TBSr"><div class="container padding-top--md padding-bottom--lg"><div class="row"><div class="col docItemCol_VOVn"><div class="docItemContainer_Djhp"><article><div class="tocCollapsible_ETCw theme-doc-toc-mobile tocMobile_ITEo"><button type="button" class="clean-btn tocCollapsibleButton_TO0P">On this page</button></div><div class="theme-doc-markdown markdown"><header><h1>Block gas limit, numbers and time</h1></header><div class="theme-admonition theme-admonition-info admonition_xJq3 alert alert--info"><div class="admonitionHeading_Gvgb"><span class="admonitionIcon_Rf37"><svg viewBox="0 0 14 16"><path fill-rule="evenodd" d="M7 2.3c3.14 0 5.7 2.56 5.7 5.7s-2.56 5.7-5.7 5.7A5.71 5.71 0 0 1 1.3 8c0-3.14 2.56-5.7 5.7-5.7zM7 1C3.14 1 0 4.14 0 8s3.14 7 7 7 7-3.14 7-7-3.14-7-7-7zm1 3H6v5h2V4zm0 6H6v2h2v-2z"></path></svg></span>block number vs <code>block.number</code></div><div class="admonitionContent_BuS1"><p>Throughout this and other pages, we note that the block number of a chain does not match the value obtained from <code>block.number</code>. When using <code>block.number</code> in a smart contract, the value obtained will be the block of the first non-Arbitrum ancestor chain. That is:</p><ul>
<li class="">Ethereum, if the chain is a Layer 2 (L2) chain on top of Ethereum, or a Layer 3 (L3) chain on top of an Arbitrum chain</li>
<li class="">The parent chain, if it&#x27;s not Ethereum or an Arbitrum chain (for example, a chain that settles to Base)</li>
</ul></div></div>
<p>As with Ethereum, Arbitrum clients submit transactions, and the system executes them later. In Arbitrum, clients submit transactions by posting messages to the Ethereum chain, either <a class="" href="/how-arbitrum-works/deep-dives/sequencer">through the Sequencer</a> or via the chain&#x27;s <a class="" href="/how-arbitrum-works/deep-dives/sequencer">Delayed Inbox</a>.</p>
<p>Once in the chain&#x27;s core inbox contract, transaction processing occurs in order. Generally, some time will elapse between when a message is put into the inbox (and timestamped) and when the contract processes the message and carries out the transaction requested by the message.</p>
<p>Additionally, since the calldata/blobs of Arbitrum transactions (or the DAC certificate on <a data-quicklook-from="arbitrum-anytrust-chain">AnyTrust</a>chains) is posted to Ethereum, the gas paid when executing them includes a component for the parent chain to cover the costs of the batch poster.</p>
<p>This page explains the implications of this mechanism for the block gas limit, block numbers, and the time assumptions associated with transactions submitted to Arbitrum.</p>
<h2 class="anchor anchorTargetStickyNavbar_Vzrq" id="block-gas-limit">Block gas limit<a href="#block-gas-limit" class="hash-link" aria-label="Direct link to Block gas limit" title="Direct link to Block gas limit" translate="no">​</a></h2>
<p>When submitting a transaction to Arbitrum, users incur fees for both the execution cost on Arbitrum and the cost of posting its calldata to Ethereum. Managing the dual cost structure involves adjusting the transaction&#x27;s gas limit to reflect these two dimensions, resulting in a higher gas limit value than would be seen for pure execution.</p>
<p>The gas limit of an Arbitrum block is set to the sum of all transaction gas limits, including the costs associated with posting parent chain data. To accommodate potential variations in parent chain costs, Arbitrum assigns an artificially large gas limit (<code>1,125,899,906,842,624</code>) for each block. However, the effective execution gas limit has a cap of 32 million. This cap means that, although the visible gas limit may appear very high, the actual execution costs are constrained within this limit. Understanding this distinction helps clarify why querying a block might show an inflated gas limit that doesn&#x27;t match the effective execution costs.</p>
<p>For a more detailed breakdown of the gas model, refer to <a href="https://medium.com/offchainlabs/understanding-arbitrum-2-dimensional-fees-fd1d582596c9" target="_blank" rel="noopener noreferrer" class="">this article on Arbitrum&#x27;s 2-dimensional fee structure</a>.</p>
<h2 class="anchor anchorTargetStickyNavbar_Vzrq" id="block-numbers-arbitrum-vs-ethereum">Block numbers: Arbitrum vs. Ethereum<a href="#block-numbers-arbitrum-vs-ethereum" class="hash-link" aria-label="Direct link to Block numbers: Arbitrum vs. Ethereum" title="Direct link to Block numbers: Arbitrum vs. Ethereum" translate="no">​</a></h2>
<p>Arbitrum blocks are assigned their own child chain block numbers, distinct from Ethereum&#x27;s block numbers.</p>
<p>A single Ethereum block can include multiple Arbitrum blocks; however, an Arbitrum block cannot span across multiple Ethereum blocks. Thus, any given Arbitrum transaction is associated with exactly one Ethereum block and one Arbitrum block.</p>
<h3 class="anchor anchorTargetStickyNavbar_Vzrq" id="ethereum-or-parent-chain-block-numbers-within-arbitrum">Ethereum (or parent chain) block numbers within Arbitrum<a href="#ethereum-or-parent-chain-block-numbers-within-arbitrum" class="hash-link" aria-label="Direct link to Ethereum (or parent chain) block numbers within Arbitrum" title="Direct link to Ethereum (or parent chain) block numbers within Arbitrum" translate="no">​</a></h3>
<p>Accessing block numbers within an Arbitrum smart contract (i.e., <code>block.number</code> in Solidity) will return a value <em>close to</em> (but not necessarily exactly) the block number of the first non-Arbitrum ancestor chain where the sequencer received the transaction.</p>
<p>The &quot;first non-Arbitrum ancestor chain&quot; is:</p>
<ul>
<li class="">Ethereum, if the chain is an L2 chain on top of Ethereum, or an L3 chain on top of an Arbitrum chain</li>
<li class="">The parent chain, if it&#x27;s not Ethereum or an Arbitrum chain (for example, a chain that settles to Base)</li>
</ul>
<div class="language-solidity codeBlockContainer_Ckt0 theme-code-block" style="--prism-color:#393A34;--prism-background-color:#f6f8fa"><div class="codeBlockContent_QJqH"><pre tabindex="0" class="prism-code language-solidity codeBlock_bY9V thin-scrollbar" style="color:#393A34;background-color:#f6f8fa"><code class="codeBlockLines_e6Vv"><div class="token-line" style="color:#393A34"><span class="token comment" style="color:#999988;font-style:italic">// some Arbitrum contract:</span><span class="token plain"></span><br></div><div class="token-line" style="color:#393A34"><span class="token plain">block</span><span class="token punctuation" style="color:#393A34">.</span><span class="token plain">number </span><span class="token comment" style="color:#999988;font-style:italic">// =&gt; returns the approximate block number of the first non-Arbitrum ancestor chain</span><br></div></code></pre></div></div>
<p>As a general rule, any timing assumptions a contract makes about block numbers and timestamps should be considered generally reliable in the longer term (i.e., on the order of at least several hours) but unreliable in the shorter term (minutes). (These are generally the same assumptions one should operate under when using block numbers directly on Ethereum!) For how this affects specific Solidity operations like <code>block.number</code> and <code>block.timestamp</code>, see <a class="" href="/arbitrum-essentials/arbitrum-vs-ethereum/solidity-support">Solidity support</a>.</p>
<div class="theme-admonition theme-admonition-info admonition_xJq3 alert alert--info"><div class="admonitionHeading_Gvgb"><span class="admonitionIcon_Rf37"><svg viewBox="0 0 14 16"><path fill-rule="evenodd" d="M7 2.3c3.14 0 5.7 2.56 5.7 5.7s-2.56 5.7-5.7 5.7A5.71 5.71 0 0 1 1.3 8c0-3.14 2.56-5.7 5.7-5.7zM7 1C3.14 1 0 4.14 0 8s3.14 7 7 7 7-3.14 7-7-3.14-7-7-7zm1 3H6v5h2V4zm0 6H6v2h2v-2z"></path></svg></span>EIP-2935 difference</div><div class="admonitionContent_BuS1"><p><a href="https://eips.ethereum.org/EIPS/eip-2935" target="_blank" rel="noopener noreferrer" class="">EIP-2935</a> adds another way to retrieve block hashes by making a call to a contract. The contract is at the same address and has the same interface as the original. It was modified to have a larger buffer and different code, but it remains usable in the same way to retrieve past L2 block hashes.</p></div></div>
<h3 class="anchor anchorTargetStickyNavbar_Vzrq" id="arbitrum-block-numbers">Arbitrum block numbers<a href="#arbitrum-block-numbers" class="hash-link" aria-label="Direct link to Arbitrum block numbers" title="Direct link to Arbitrum block numbers" translate="no">​</a></h3>
<p>Arbitrum blocks have their own block numbers, starting at <code>0</code> at the Arbitrum genesis block and updating sequentially.</p>
<p>ArbOS and the sequencer are responsible for delineating when one Arbitrum block ends and the next one begins. However, block creation depends entirely on chain usage, meaning that block production only occurs when there are transactions to sequence. In active chains, one can expect to see Arbitrum blocks produced at a relatively steady rate. In less active chains, block production might be sporadic depending on the rate at which transactions are received.</p>
<p>A client that queries an Arbitrum node&#x27;s RPC interface (e.g., transaction receipts) will receive the transaction&#x27;s Arbitrum block number as the standard block number field. The block number of the first non-Arbitrum ancestor chain will also be included in the added <code>l1BlockNumber</code> field.</p>
<div class="language-typescript codeBlockContainer_Ckt0 theme-code-block" style="--prism-color:#393A34;--prism-background-color:#f6f8fa"><div class="codeBlockContent_QJqH"><pre tabindex="0" class="prism-code language-typescript codeBlock_bY9V thin-scrollbar" style="color:#393A34;background-color:#f6f8fa"><code class="codeBlockLines_e6Vv"><div class="token-line" style="color:#393A34"><span class="token keyword" style="color:#00009f">const</span><span class="token plain"> txnReceipt </span><span class="token operator" style="color:#393A34">=</span><span class="token plain"> </span><span class="token keyword" style="color:#00009f">await</span><span class="token plain"> arbitrumProvider</span><span class="token punctuation" style="color:#393A34">.</span><span class="token function" style="color:#d73a49">getTransactionReceipt</span><span class="token punctuation" style="color:#393A34">(</span><span class="token string" style="color:#e3116c">&#x27;0x...&#x27;</span><span class="token punctuation" style="color:#393A34">)</span><span class="token punctuation" style="color:#393A34">;</span><span class="token plain"></span><br></div><div class="token-line" style="color:#393A34"><span class="token plain"></span><span class="token doc-comment comment" style="color:#999988;font-style:italic">/** </span><br></div><div class="token-line" style="color:#393A34"><span class="token doc-comment comment" style="color:#999988;font-style:italic">    txnReceipt.l1BlockNumber =&gt; Approximate block number of the first non-Arbitrum ancestor chain</span><br></div><div class="token-line" style="color:#393A34"><span class="token doc-comment comment" style="color:#999988;font-style:italic">*/</span><br></div></code></pre></div></div>
<p>The Arbitrum block number can also be retrieved within an Arbitrum contract via the <a class="" href="/arbitrum-essentials/precompiles/reference#arbsys">ArbSys</a> precompile:</p>
<div class="language-solidity codeBlockContainer_Ckt0 theme-code-block" style="--prism-color:#393A34;--prism-background-color:#f6f8fa"><div class="codeBlockContent_QJqH"><pre tabindex="0" class="prism-code language-solidity codeBlock_bY9V thin-scrollbar" style="color:#393A34;background-color:#f6f8fa"><code class="codeBlockLines_e6Vv"><div class="token-line" style="color:#393A34"><span class="token function" style="color:#d73a49">ArbSys</span><span class="token punctuation" style="color:#393A34">(</span><span class="token number" style="color:#36acaa">100</span><span class="token punctuation" style="color:#393A34">)</span><span class="token punctuation" style="color:#393A34">.</span><span class="token function" style="color:#d73a49">arbBlockNumber</span><span class="token punctuation" style="color:#393A34">(</span><span class="token punctuation" style="color:#393A34">)</span><span class="token plain"> </span><span class="token comment" style="color:#999988;font-style:italic">// returns Arbitrum block number</span><br></div></code></pre></div></div>
<h3 class="anchor anchorTargetStickyNavbar_Vzrq" id="example">Example<a href="#example" class="hash-link" aria-label="Direct link to Example" title="Direct link to Example" translate="no">​</a></h3>
<p>The following example illustrates timings on a chain that settles to Ethereum (similar to Arbitrum One), although it also applies to L3 chains that settle to an Arbitrum chain.</p>
<div class="table-wrapper"><table><thead><tr><th>Wall clock time</th><th>12:00 am</th><th>12:00:15 am</th><th>12:00:30 am</th><th>12:00:45 am</th><th>12:01 am</th><th>12:01:15 am</th></tr></thead><tbody><tr><td>Ethereum <code>block.number</code></td><td>1000</td><td>1001</td><td>1002</td><td>1003</td><td>1004</td><td>1005</td></tr><tr><td>Chain&#x27;s <code>block.number</code> *</td><td>1000</td><td>1000</td><td>1000</td><td>1000</td><td>1004</td><td>1004</td></tr><tr><td>Chain&#x27;s block number (from RPCs) **</td><td>370000</td><td>370005</td><td>370006</td><td>370008</td><td>370012</td><td>370015</td></tr></tbody></table></div>
<div class="admonition_hK4M info_pcHf"><div class="admonitionHeader_k_rs"><span class="admonitionIcon_clCG"><svg viewBox="0 0 14 16" class="icon_KlQo"><path fill-rule="evenodd" d="M7 2.3c3.14 0 5.7 2.56 5.7 5.7s-2.56 5.7-5.7 5.7A5.71 5.71 0 0 1 1.3 8c0-3.14 2.56-5.7 5.7-5.7zM7 1C3.14 1 0 4.14 0 8s3.14 7 7 7 7-3.14 7-7-3.14-7-7-7zm1 3H6v5h2V4zm0 6H6v2h2v-2z"></path></svg></span><span class="admonitionTitle_i61A">Info</span></div><div class="admonitionContent_jO9n"><p>txnReceipt.blockNumber =&gt; Arbitrum block number</p><p>_* <strong>The chain&#x27;s <code>block.number</code>:</strong> updated to sync with Ethereum&#x27;s <code>block.number</code> every 13 to 15 seconds (occasionally longer).</p></div></div>
<p><em>** <strong>Chain&#x27;s block number from RPCs:</strong> note that this can be updated multiple times per Ethereum block (this lets the sequencer give sub-Ethereum-block-time transaction receipts.)</em></p>
<h3 class="anchor anchorTargetStickyNavbar_Vzrq" id="case-study-the-multicall-contract">Case study: the Multicall contract<a href="#case-study-the-multicall-contract" class="hash-link" aria-label="Direct link to Case study: the Multicall contract" title="Direct link to Case study: the Multicall contract" translate="no">​</a></h3>
<p>The Multicall contract provides a valuable case study for the differences between various block numbers.</p>
<p>The <a href="https://github.com/makerdao/multicall/" target="_blank" rel="noopener noreferrer" class="">canonical implementation</a> of Multicall returns the value of <code>block.number</code>. When used out of the box, some applications may exhibit unintended behavior.</p>
<p>You can find a version of the adapted <code>Multicall2</code> deployed on Arbitrum One at <a href="https://arbiscan.io/address/0x842eC2c7D803033Edf55E478F461FC547Bc54EB2#code" target="_blank" rel="noopener noreferrer" class="">0x842eC2c7D803033Edf55E478F461FC547Bc54EB2</a>.</p>
<p>By default, the <code>getBlockNumber</code>, <code>tryBlockAndAggregate</code>, and <code>aggregate</code> functions return the child chain block number. This function allows you to use this value to compare your state against the tip of the chain.</p>
<p>The <code>getL1BlockNumber</code> function is queriable if applications need to surface the block number of the first non-Arbitrum ancestor chain.</p>
<h2 class="anchor anchorTargetStickyNavbar_Vzrq" id="block-timestamps-arbitrum-vs-ethereum">Block timestamps: Arbitrum vs. Ethereum<a href="#block-timestamps-arbitrum-vs-ethereum" class="hash-link" aria-label="Direct link to Block timestamps: Arbitrum vs. Ethereum" title="Direct link to Block timestamps: Arbitrum vs. Ethereum" translate="no">​</a></h2>
<p>Block timestamps on Arbitrum are not linked to the timestamp of the parent chain block. They are updated every child chain block based on the sequencer&#x27;s clock. These timestamps must follow these two rules:</p>
<ol>
<li class="">Must always be equal to or greater than the previous child chain block timestamp</li>
<li class="">Must fall within the established boundaries (24 hours earlier than the current time or one hour in the future). More on this below.</li>
</ol>
<p>Furthermore, for transactions that are force-included from the parent chain (bypassing the Sequencer), the block timestamp will be equal to either the parent chain timestamp when the transaction was put in the Delayed Inbox on the parent chain (not when it was force-included), or the child chain timestamp of the previous child chain block, whichever of the two timestamps is greater.</p>
<h3 class="anchor anchorTargetStickyNavbar_Vzrq" id="timestamp-boundaries-of-the-sequencer">Timestamp boundaries of the sequencer<a href="#timestamp-boundaries-of-the-sequencer" class="hash-link" aria-label="Direct link to Timestamp boundaries of the sequencer" title="Direct link to Timestamp boundaries of the sequencer" translate="no">​</a></h3>
<p>As mentioned, block timestamps are usually set based on the sequencer&#x27;s clock. Because there&#x27;s a possibility that the Sequencer fails to post batches on the parent chain (i.e., Ethereum) for a period of time, it should have the ability to slightly adjust the timestamp of the block to account for those delays and prevent any potential reorganizations of the chain. To limit the degree to which the Sequencer can adjust timestamps, some boundaries are set, currently to 24 hours earlier than the current time, and one hour in the future.</p></div><footer class="theme-doc-footer docusaurus-mt-lg"><div class="row margin-top--sm theme-doc-footer-edit-meta-row"><div class="col noPrint_WFHX"><a href="https://github.com/OffchainLabs/arbitrum-docs/edit/master/docs/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time.mdx" target="_blank" rel="noopener noreferrer" class="theme-edit-this-page"><svg fill="currentColor" height="20" width="20" viewBox="0 0 40 40" class="iconEdit_Z9Sw" aria-hidden="true"><g><path d="m34.5 11.7l-3 3.1-6.3-6.3 3.1-3q0.5-0.5 1.2-0.5t1.1 0.5l3.9 3.9q0.5 0.4 0.5 1.1t-0.5 1.2z m-29.5 17.1l18.4-18.5 6.3 6.3-18.4 18.4h-6.3v-6.2z"></path></g></svg>Edit this page</a></div><div class="col lastUpdated_JAkA"><span class="theme-last-updated">Last updated<!-- --> on <b><time datetime="2026-08-26T14:33:07.000Z" itemprop="dateModified">Aug 26, 2026</time></b></span></div></div></footer></article><nav class="docusaurus-mt-lg pagination-nav" aria-label="Docs pages"><a class="pagination-nav__link pagination-nav__link--prev" href="/arbitrum-essentials/arbitrum-vs-ethereum/comparison-overview"><div class="pagination-nav__sublabel">Previous</div><div class="pagination-nav__label">Comparison overview</div></a><a class="pagination-nav__link pagination-nav__link--next" href="/arbitrum-essentials/arbitrum-vs-ethereum/rpc-methods"><div class="pagination-nav__sublabel">Next</div><div class="pagination-nav__label">RPC methods</div></a></nav></div></div><div class="col col--3"><div class="tableOfContents_bqdL thin-scrollbar theme-doc-toc-desktop"><ul class="table-of-contents table-of-contents__left-border"><li><a href="#block-gas-limit" class="table-of-contents__link toc-highlight">Block gas limit</a></li><li><a href="#block-numbers-arbitrum-vs-ethereum" class="table-of-contents__link toc-highlight">Block numbers: Arbitrum vs. Ethereum</a><ul><li><a href="#ethereum-or-parent-chain-block-numbers-within-arbitrum" class="table-of-contents__link toc-highlight">Ethereum (or parent chain) block numbers within Arbitrum</a></li><li><a href="#arbitrum-block-numbers" class="table-of-contents__link toc-highlight">Arbitrum block numbers</a></li><li><a href="#example" class="table-of-contents__link toc-highlight">Example</a></li><li><a href="#case-study-the-multicall-contract" class="table-of-contents__link toc-highlight">Case study: the Multicall contract</a></li></ul></li><li><a href="#block-timestamps-arbitrum-vs-ethereum" class="table-of-contents__link toc-highlight">Block timestamps: Arbitrum vs. Ethereum</a><ul><li><a href="#timestamp-boundaries-of-the-sequencer" class="table-of-contents__link toc-highlight">Timestamp boundaries of the sequencer</a></li></ul></li></ul></div></div></div></div></main></div></div></div><footer class="theme-layout-footer footer footer--dark"><div class="container container-fluid"><div class="row footer__links"><div class="theme-layout-footer-column col footer__col"><div class="footer__title">Ecosystem</div><ul class="footer__items clean-list"><li class="footer__item"><a href="https://arbitrum.io/" target="_blank" rel="noopener noreferrer" class="footer__link-item">Arbitrum.io</a></li><li class="footer__item"><a href="https://arbitrum.io/launch-chain" target="_blank" rel="noopener noreferrer" class="footer__link-item">Arbitrum chains</a></li><li class="footer__item"><a href="https://arbitrum.foundation/" target="_blank" rel="noopener noreferrer" class="footer__link-item">Arbitrum Foundation</a></li><li class="footer__item"><a href="/nitro-whitepaper.pdf">Arbitrum whitepaper</a></li></ul></div><div class="theme-layout-footer-column col footer__col"><div class="footer__title">Products</div><ul class="footer__items clean-list"><li class="footer__item"><a href="https://portal.arbitrum.io/" target="_blank" rel="noopener noreferrer" class="footer__link-item">Portal</a></li><li class="footer__item"><a href="https://bridge.arbitrum.io/" target="_blank" rel="noopener noreferrer" class="footer__link-item">Bridge</a></li><li class="footer__item"><a href="https://status.arbitrum.io/" target="_blank" rel="noopener noreferrer" class="footer__link-item">Network status</a></li><li class="footer__item"><a href="https://docs.arbitrum.foundation/" target="_blank" rel="noopener noreferrer" class="footer__link-item">Governance docs</a></li></ul></div><div class="theme-layout-footer-column col footer__col"><div class="footer__title">Community</div><ul class="footer__items clean-list"><li class="footer__item"><a href="https://discord.gg/ZpZuw7p" target="_blank" rel="noopener noreferrer" class="footer__link-item">Discord</a></li><li class="footer__item"><a href="https://twitter.com/OffchainLabs" target="_blank" rel="noopener noreferrer" class="footer__link-item">Twitter</a></li><li class="footer__item"><a href="https://www.youtube.com/@Arbitrum" target="_blank" rel="noopener noreferrer" class="footer__link-item">Youtube</a></li><li class="footer__item"><a href="https://medium.com/offchainlabs" target="_blank" rel="noopener noreferrer" class="footer__link-item">Medium Blog</a></li></ul></div><div class="theme-layout-footer-column col footer__col"><div class="footer__title">Resources</div><ul class="footer__items clean-list"><li class="footer__item"><a href="https://support.arbitrum.io/" target="_blank" rel="noopener noreferrer" class="footer__link-item">Support</a></li><li class="footer__item"><a href="https://immunefi.com/bounty/arbitrum/" target="_blank" rel="noopener noreferrer" class="footer__link-item">Bug Bounties</a></li><li class="footer__item"><a href="https://research.arbitrum.io/" target="_blank" rel="noopener noreferrer" class="footer__link-item">Research forum</a></li><li class="footer__item"><a href="https://offchainlabs.com/careers/" target="_blank" rel="noopener noreferrer" class="footer__link-item">Careers</a></li></ul></div></div><div class="footer__bottom text--center"><div class="footer__copyright">© 2026 Offchain Labs · <a href="https://arbitrum.io/privacy">Privacy Policy</a> · <a href="https://arbitrum.io/tos">Terms of Service</a></div></div></div></footer><div id="inkeep-shadowradix-_R_p_" style="display:contents"></div><span></span></div>
</body>
</html>curl: (22) The requested URL returned error: 404

exec
/bin/bash -lc "curl -fsSL https://docs.base.org/llms.txt | rg -i -m 20 'network|block time|chain'" in /tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002
 succeeded in 545ms:
> Build on Base — Coinbase's Ethereum L2. Smart Wallet, OnchainKit, MiniKit, Base Chain RPCs, and AI Agents. This index points AI assistants at the canonical page for each topic; follow the links for full context.
- [Base](https://docs.base.org/get-started/base): The blockchain for global finance.
- [Connect to Base](https://docs.base.org/get-started/connect-to-base): Network details for Base Mainnet and Base Sepolia: RPC endpoints, chain IDs, and block explorers.
- [Get Funds](https://docs.base.org/get-started/get-funds): Fund an address on Base: withdraw from a Coinbase account, bridge from another chain, or use a testnet faucet.
- [Bridge to Base](https://docs.base.org/base-chain/network-information/ecosystem-bridges): Move ETH, stablecoins, and tokens to and from Base — from a Coinbase account, Ethereum, Solana, or Bitcoin.
- [Issue a Stablecoin](https://docs.base.org/get-started/issue-stablecoins): Run a fiat-backed stablecoin on Base with minting, compliance, and reconciliation built into the chain.
- [Accept Payments](https://docs.base.org/get-started/accept-payments): Choose an onchain payment lifecycle for checkout, agentic payments, reconciliation, refunds, and payouts on Base.
- [Base Ecosystem Fund](https://docs.base.org/get-started/base-ecosystem-fund): The Base Ecosystem Fund backs pre-seed and seed teams building onchain businesses on Base, in partnership with Coinbase Ventures.
- [Base Protocol](https://docs.base.org/get-started/base-chain): Explore Base as a chain: connect to its networks, use native primitives, understand transactions and network systems, and operate infrastructure.
- [Test on Vibenet](https://docs.base.org/build-on-base/test-on-vibenet): Build and test against Base's newest chain-level features on Vibenet, Base's experimental preview network, and track what's live at chain.base.org/vibenet.
- [Reconcile with Memos](https://docs.base.org/build-on-base/issue-stablecoins/reconcile-with-memos): Tag stablecoin operations with an onchain reference so you can match them to offchain records at scale.
- [Void an Authorization](https://docs.base.org/build-on-base/accept-payments/void-an-authorization): Expire an unused USDC authorization or cancel its nonce onchain with the buyer's signature.
- [Call a Paid Service](https://docs.base.org/build-on-base/accept-payments/call-a-paid-service): Call an x402 service from an agent while enforcing network, token, per-request, and session spend limits.
- [Overview](https://docs.base.org/specifications/base-protocol/overview): High-level overview of the Base Chain protocol — network participants, system architecture, core components, and user flows.
- [Derivation](https://docs.base.org/specifications/base-protocol/consensus/derivation): Specification of the L2 chain derivation pipeline, describing how L2 blocks are deterministically derived from L1 data and sequencer batches.
- [P2P](https://docs.base.org/specifications/base-protocol/consensus/p2p): Specification of the rollup node peer-to-peer network, covering node discovery, gossip protocol, and unsafe block propagation.
- [Proofs](https://docs.base.org/specifications/base-protocol/proofs/overview): Overview of the offchain services and onchain contracts that make L2 checkpoint proposals verifiable from Ethereum in the Azul proof system.
- [Challenger](https://docs.base.org/specifications/base-protocol/proofs/challenger): Specification of the challenger, an offchain service that detects invalid AggregateVerifier games and submits dispute transactions on L1 to nullify them.
- [Proposer](https://docs.base.org/specifications/base-protocol/proofs/proposer): Specification of the proposer, an offchain service that turns canonical L2 checkpoint ranges into AggregateVerifier games on L1.
- [Registrar](https://docs.base.org/specifications/base-protocol/proofs/registrar): Specification of the registrar, an offchain service that maintains the onchain registry of accepted TEE signer identities via attestation ZK proofs.
curl: (23) Failure writing output to destination

exec
/bin/bash -lc "curl -fsSL https://docs.base.org/llms-full.txt | rg -i -m 12 -C 2 '2.second|two.second|block time|blocktime|200ms'" in /tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002
 succeeded in 225ms:
- [eth_gasPrice](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_gasPrice): Returns the current gas price in wei.

- [eth_getBalance](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_getBalance): Returns the ETH balance of an account at a given block. Use the pending tag for 200ms pre-confirmed balances.

- [eth_getBlockByHash](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_getBlockByHash): Returns block information by block hash.

- [eth_getBlockByNumber](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_getBlockByNumber): Returns block information by number. On Flashblocks endpoints, the pending tag returns the live pre-confirmed block updated every ~200ms.

- [eth_getBlockReceipts](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_getBlockReceipts): Returns all transaction receipts for a block. Use pending for pre-confirmed receipts.
--
- [eth_maxPriorityFeePerGas](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_maxPriorityFeePerGas): Returns the suggested EIP-1559 priority fee (tip) per gas.

- [eth_sendRawTransaction](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_sendRawTransaction): Submits a pre-signed transaction to the network. All Base endpoints are Flashblocks-enabled, providing 200ms pre-confirmation.

- [eth_subscribe](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_subscribe): Creates a real-time WebSocket subscription for new blocks, logs, and pending transactions.
--
### Denim

- [200ms Native Blocks](https://docs.base.org/upgrades/denim/200ms-blocks): Specification for Denim's canonical 200ms blocks, including BaseTime, derivation, validation, and RPC behavior.

- [Migrate From Flashblocks](https://docs.base.org/upgrades/denim/migrate-from-flashblocks): Migrate your Flashblocks integration to 200ms blocks.

### Cobalt

exec
/bin/bash -lc "curl -fsSL https://docs.base.org/upgrades/denim/200ms-blocks.md | sed -n '1,260p'
curl -fsSL https://docs.base.org/upgrades/denim/migrate-from-flashblocks.md | sed -n '1,220p'" in /tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002
 succeeded in 1016ms:
> ## Documentation Index
> Fetch the complete documentation index at: https://docs.base.org/llms.txt
> Use this file to discover all available pages before exploring further.

# 200ms Native Blocks

> Specification for Denim's canonical 200ms blocks, including BaseTime, derivation, validation, and RPC behavior.

<Warning>
  200ms native blocks are live on [Vibenet](/build-on-base/test-on-vibenet) for experimental developer testing. This deployment may change, and you should not rely on it for production decisions.

  Denim is not active on Base Sepolia or Base Mainnet; activation times and required client versions remain undecided.
</Warning>

## Summary

Denim changes Base block production from one canonical block every two seconds to five complete canonical blocks per second. Each 200ms block has its own block number, hash, state root, receipts, forkchoice updates, and unsafe, safe, and finalized lifecycle.

Denim replaces [Flashblocks](/specifications/flashblocks), which publish incremental pending-state updates for a single block. As part of the Denim rollout, Base will stop producing Flashblocks and instead produce a canonical block every 200ms. Applications using Flashblocks must migrate to canonical block and RPC streams.

Denim keeps the Ethereum block header and its seconds-based `timestamp` unchanged. A BaseTime metadata deposit supplies the sub-second component. Together, these values identify a canonical block's full millisecond timestamp.

<Info>
  If your application uses Flashblocks, see [Migrate From Flashblocks](/base-chain/specs/upgrades/denim/migrate-from-flashblocks) for the required API changes.
</Info>

## Network Availability

| Network   | Status                        | Activation timestamp | Required client versions |
| --------- | ----------------------------- | -------------------- | ------------------------ |
| `vibenet` | Live for experimental testing | —                    | —                        |
| `sepolia` | Not active                    | `TBD`                | `TBD`                    |
| `mainnet` | Not active                    | `TBD`                | `TBD`                    |

Base Sepolia and Base Mainnet activation have not been scheduled.

## Execution

### Full block timestamp

Denim leaves `block.header.timestamp` as Unix time in whole seconds. For an activated block `b`, its full timestamp is:

$$
T_{ms}(b) = 1000 \times b.header.timestamp + b.tx[1].timestamp\_millis\_part
$$

The BaseTime deposit at `tx[1]` carries `timestamp_millis_part`. The only valid values are `0`, `200`, `400`, `600`, and `800`. Consecutive activated blocks satisfy:

$$
T_{ms}(child) = T_{ms}(parent) + 200
$$

Blocks cannot skip slots. The seconds header and millisecond part must come from the same scheduled timestamp; wall-clock time controls when the sequencer starts a build, not the timestamp assigned to that block. EVM `block.timestamp` remains the whole-second header value.

### BaseTime metadata deposit

After activation, every block contains the canonical BaseTime update at `tx[1]`, immediately after the L1 information deposit at `tx[0]` and before user transactions. The deposit is bound to the current block number by source-hash domain `3`.

| Field              | Value                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Transaction type   | Deposit (`0x7e`)                                                                                       |
| Source hash        | Domain `3`, bound to the current block number                                                          |
| From               | `0xDeaDDEaDDeAdDeAdDEAdDEaddeAddEAdDEAd0001`                                                           |
| To                 | `0x4200000000000000000000000000000000000030`                                                           |
| Mint               | `0`                                                                                                    |
| Value              | `0`                                                                                                    |
| Gas limit          | `1,000,000`                                                                                            |
| System transaction | `false`                                                                                                |
| Calldata           | `setTimestampMillisPart(uint16)` with selector `0x86bdf394` and a 32-byte ABI-encoded millisecond part |

Before activation, blocks must not contain this metadata transaction or the Engine millisecond field. After activation, implementations validate the transaction's position, source hash, sender, recipient, mint, value, gas limit, system flag, calldata shape, and lattice value.

### BaseTime predeploy

The initial design exposes the current block's millisecond part to contracts through a predeploy.

| Property                | Value                                        |
| ----------------------- | -------------------------------------------- |
| Proxy                   | `0x4200000000000000000000000000000000000030` |
| Implementation          | `0xc0D3C0d3C0d3C0D3c0d3C0d3c0D3C0d3c0d30030` |
| Storage                 | `uint16` millisecond part in slot `0`        |
| Setter                  | `setTimestampMillisPart(uint16)`             |
| Millisecond-part getter | `timestampMillisPart()`                      |
| Full-timestamp getter   | `timestampMs()`                              |

The BaseTime deposit executes before L1 user deposits, and user transactions, so all later transactions can read the updated value.

Fresh chains install the linked BaseTime predeploy in genesis. On existing chains, the reserved address already contains the canonical proxy runtime and uses the Base ProxyAdmin, but its implementation slot is unset. Calls therefore revert until activation.

At activation, before transaction execution, the protocol installs the canonical BaseTime implementation and links the existing proxy. It preserves the proxy admin and any implementation already set through governance.

### Engine payload attributes

The Engine API uses `BasePayloadAttributes`, which flattens the standard `PayloadAttributes` fields alongside Base-specific fields.

For payloads at or after Denim activation, `BasePayloadAttributes.timestampMillisPart` **MUST** be present and equal `0`, `200`, `400`, `600`, or `800`. Before activation, it **MUST NOT** be present.

`BasePayloadAttributes.transactions[1]` **MUST** contain the BaseTime metadata deposit. The deposit **MUST** be sent by the protocol depositor to the BaseTime predeploy, and its calldata **MUST** contain the canonical encoding of `setTimestampMillisPart(uint16)`. The encoded value **MUST** equal `timestampMillisPart`.

An execution client **MUST** reject malformed `forkchoiceUpdated` payload attributes with JSON-RPC `Invalid params` (`-32602`). It **MUST** report an execution payload with a missing or invalid BaseTime deposit as invalid during `newPayload` validation.

The payload ID includes `timestampMillisPart`, so builds that differ only in the millisecond part receive different IDs. When the field is absent, legacy payload-ID calculation remains unchanged.

All existing Engine timestamp fields remain seconds-based.

### Validation

When processing `forkchoiceUpdated`, the execution client performs checks that do not require reading contract state. Before Denim, `timestampMillisPart` must be absent. After Denim, it must be present and equal `0`, `200`, `400`, `600`, or `800`. The block's whole-second timestamp must not be earlier than its parent's. Because block headers do not store milliseconds, the client checks exact 200ms progression after execution.

After execution, the client **MUST** verify that the block's full timestamp is exactly 200ms after its parent's. Blocks that do not satisfy this requirement are invalid.

## Derivation

### Scheduled timestamps

After activation, the derivation pipeline computes each block's timestamp from the Denim activation schedule and absolute L2 block number. It does not read the millisecond part from batch data or derive it from the local wall clock. The sequence is:

`p (.000)` → `child (.200)` → `child (.400)` → `child (.600)` → `child (.800)` → `child (.000 in the next second)`

The pipeline splits the scheduled timestamp into the seconds-based header timestamp and the BaseTime millisecond part, then reconstructs the BaseTime deposit at `tx[1]`.

### Block lifecycle

The sequencer builds and executes a complete block for every selected 200ms slot. Each block receives its own hash, state root, receipts, Engine payload, forkchoice update, and unsafe-to-safe-to-finalized lifecycle.

The block begins with the L1 information deposit at `tx[0]` and the BaseTime metadata deposit at `tx[1]`. User transactions and other applicable transactions follow. The design intends the payload attribute, `tx[1]`, and the value written to the BaseTime predeploy to represent the same planned millisecond part.

## RPC

<Note>
  The RPC behavior below is planned for Denim and is not available on production endpoints.
</Note>

### Seconds compatibility

Denim keeps the existing `timestamp` JSON-RPC field in Unix seconds. Engine timestamps, transaction-validity timestamps, `eth_call` timestamps, and EVM `block.timestamp` also remain seconds-based. RPC responses do not expose the internal `timestampMillisPart` field.

After the Denim rollout, use canonical block responses and subscriptions such as `eth_subscribe("newHeads")` for sub-second updates. Flashblocks streams will stop.

### Block and header timestamps

The following responses will add optional `timestampMs`, encoded as a JSON-RPC quantity containing the full Unix timestamp in milliseconds:

* `eth_getBlockByHash`
* `eth_getBlockByNumber`
* `eth_getHeaderByHash`
* `eth_getHeaderByNumber`
* `eth_subscribe("newHeads")`

For example, a block at 42.200 seconds has:

| Field         | Value    |
| ------------- | -------- |
| `timestamp`   | `0x2a`   |
| `timestampMs` | `0xa4d8` |

Clients will derive `timestampMs` from authenticated BaseTime metadata rather than estimate it from the seconds field. If a historical block body or its BaseTime metadata has been pruned or is otherwise unavailable, the response will omit `timestampMs`.

### Transaction timestamps

Mined transaction objects will add optional `blockTimestampMs` for these methods:

* `eth_getTransactionByHash`
* `eth_getTransactionByBlockHashAndIndex`
* `eth_getTransactionByBlockNumberAndIndex`

Full transaction objects nested in block responses will follow the same mined-transaction behavior. Pending transactions will omit `blockTimestampMs` because they do not yet belong to a canonical block.

### Log and receipt timestamps

Mined log objects will add optional `blockTimestampMs` when returned by:

* `eth_getLogs`
* `eth_getFilterChanges`
* `eth_getFilterLogs`
* `eth_getTransactionReceipt`
* `eth_getBlockReceipts`
* `eth_subscribe("logs")`
* `eth_subscribe("transactionReceipts")`

Receipts will expose the field on their nested logs, not at the receipt's top level. A removed log will retain its original block timestamp along with its original block provenance. If the originating block's authenticated BaseTime metadata is unavailable, the log will omit the field rather than estimate it.

As with block responses, pruned or unprovenanced transaction and log data will omit `blockTimestampMs`. The fields are optional so pre-Denim history and clients without the required body data remain representable.

### Tooling

Foundry's `AnyRpcBlock` and `OtherFields` paths can preserve an unknown block-level `timestampMs`, while EVM execution continues to use seconds. Plain Alloy `AnyRpcHeader` drops unknown fields; consumers that need Denim timestamps can use `WithOtherFields<AnyRpcHeader>` or a typed Base response. Locally mined Anvil blocks are not expected to produce BaseTime metadata in the initial rollout.
> ## Documentation Index
> Fetch the complete documentation index at: https://docs.base.org/llms.txt
> Use this file to discover all available pages before exploring further.

# Migrate From Flashblocks

> Migrate your Flashblocks integration to 200ms blocks.

<Warning>
  200ms native blocks are live on [Vibenet](/build-on-base/test-on-vibenet) for experimental developer testing. This deployment may change, and you should not rely on it for production decisions.

  Denim is not active on Base Sepolia or Base Mainnet; activation times and required client versions remain undecided.
</Warning>

## Summary

Use this guide if your application consumes Flashblocks. Denim replaces Flashblocks with canonical 200ms blocks, so Flashblocks subscriptions and pending state are unavailable after activation.

## Recommended Action

Inventory every Flashblocks subscription and RPC request that uses the `"pending"` block tag before Denim. Replace each integration using the table below.

## Replace Flashblocks Integrations

| Flashblocks integration                           | Update for Denim                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `eth_subscribe("newFlashblocks")`                 | Use `eth_subscribe("newHeads")`.                                                   |
| `eth_subscribe("pendingLogs")`                    | Use `eth_subscribe("logs")`.                                                       |
| `eth_subscribe("newFlashblockTransactions")`      | Use `eth_subscribe("newHeads")`, then fetch transactions for each canonical block. |
| `eth_getBlockByNumber("pending", ...)`            | Use normal RPC calls to read the latest canonical blocks.                          |
| `eth_getBalance(..., "pending")`                  | Use normal RPC calls to read the latest canonical state.                           |
| `eth_getTransactionCount(..., "pending", ...)`    | Use normal RPC calls to read the latest canonical state.                           |
| `eth_call(..., "pending")`                        | Use normal RPC calls to read the latest canonical state.                           |
| `eth_estimateGas(..., "pending")`                 | Use normal RPC calls to read the latest canonical state.                           |
| `eth_simulateV1(..., "pending")`                  | Use normal RPC calls to read the latest canonical state.                           |
| `eth_getLogs` with a range ending at `"pending"`  | Use normal RPC calls to query logs from canonical blocks.                          |
| `eth_getBlockTransactionCountByNumber("pending")` | Use normal RPC calls to read the latest canonical block.                           |

<Warning>
  The `"pending"` block tag and Flashblocks preconfirmation state have no direct equivalent after Denim. The replacements above return canonical data from 200ms blocks, not preconfirmed or pending data.
</Warning>

## Test on Vibenet

Test your migrated integration on [Vibenet](/build-on-base/test-on-vibenet). For the protocol design and RPC behavior, see [200ms Native Blocks](/base-chain/specs/upgrades/denim/200ms-blocks).

exec
/bin/bash -lc "python3 - <<'PY'
from decimal import Decimal, getcontext
getcontext().prec=40
P=Decimal(1_000_000); r=Decimal('0.04'); days=Decimal(31)
for t in [12,2,Decimal('0.2')]:
    blocks=days*86400/t
    synth=blocks*12
    simple=P*r*synth/(Decimal(365)*86400)
    eff=P*((Decimal(1)+r*Decimal(12)/(Decimal(365)*86400))**int(blocks)-1)
    print(t, blocks, synth, simple, eff)
# inferred block count for 3391
print('blocks for 3391', Decimal(3391)*Decimal(365)*86400/(P*r*12))
print('seconds', Decimal(3391)*Decimal(365)*86400/(P*r))
# expected nominal
print('nominal',P*r*days/365)
PY" in /tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002
 succeeded in 14ms:
12 223200 2678400 3397.260273972602739726027397260273972603 3403.037477112557607572361443014745398000
2 1339200 16070400 20383.56164383561643835616438356164383562 20592.72502682826127657325103559429054500
0.2 1.339200E+7 1.6070400E+8 203835.6164383561643835616438356164383562 226096.5848636922991625040990946957265990
blocks for 3391 222788.7
seconds 2673464.4
nominal 3397.260273972602739726027397260273972603

codex
The key reconciliation is now clear: Solidity `block.number` on Arbitrum is not the fast Arbitrum RPC block height; it tracks an approximate Ethereum ancestor block number. I’m also checking an important Base roadmap wrinkle: production Base is currently two-second canonical blocks, while a proposed 200 ms canonical-block upgrade is documented but not yet scheduled for mainnet.
collab: Wait
collab: Wait
exec
/bin/bash -lc "curl -fsSL https://docs.base.org/base-chain/network-information/transaction-finality.md | sed -n '1,100p'" in /tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002
 succeeded in 798ms:
> ## Documentation Index
> Fetch the complete documentation index at: https://docs.base.org/llms.txt
> Use this file to discover all available pages before exploring further.

# Transaction Finality

> Detailed information about transaction finality on Base.

## What Is Transaction Finality?

Finality refers to the point at which a transaction sent to Base becomes irreversible. This provides guarantees that the transaction will not be rolled back or lost.

Finality works differently for normal transactions that modify Base L2 state than it does for transactions that withdraw funds from Base L2 to Ethereum L1.

<Note>
  **Only transactions that withdraw funds from Base to Ethereum must wait 7 days.** Regular transactions within Base, such as swaps or sends, *do not* have to wait 7 days.
</Note>

## Finality for Base L2 Transactions

This describes finality for transactions on Base except withdrawal transactions that move funds from Base to Ethereum L1

For transactions on Base, finality is not a single time to wait for. Instead, there are 4 stages in time that each provide increasing security guarantees.

<Frame>
  <img src="https://mintcdn.com/base-a060aa97/3yeWKHFGuuHmWm2_/images/transaction-finality/base-tx-finality.jpg?fit=max&auto=format&n=3yeWKHFGuuHmWm2_&q=85&s=c4f2606bd0011ae165dd4051b7116707" alt="Diagram of transaction finality stages on Base" width="2874" height="739" data-path="images/transaction-finality/base-tx-finality.jpg" />
</Frame>

<Steps>
  <Step title="Flashblock Inclusion: ~200ms" titleSize="h3">
    After roughly 200ms, the transaction is included in a preconfirmation block (Flashblock) by the Base sequencer.

    <Accordion title="Under 0.001% Probability of a Reorg.">
      * Flashblocks reorg less than 0.001% of the time
      * You can see the reorg history in our [public stats page.](https://base.org/stats)
    </Accordion>
  </Step>

  <Step title="L2 Block Inclusion: ~2s" titleSize="h3">
    After roughly 2 seconds, the sequencer has built the transaction into an L2 block and distributed it to validator nodes.

    <Accordion title="Near 0% Probability of a Reorg.">
      * Only a single Base L2 block has ever reorged, representing .0000003% of transactions. The data can be [seen here](https://base.blockscout.com/blocks?tab=reorgs)
    </Accordion>
  </Step>

  <Step title="L1 Batch Inclusion: ~2m" titleSize="h3">
    After roughly 2 minutes, a Base batch containing the transaction has been posted to Ethereum.

    <Accordion title="Effectively 0% Probability of a Reorg.">
      * There has never been a reorg of L2 blocks that were batched to Ethereum L1.
      * **A reorg of Ethereum L1 does not require a reorg of the Base L2 chain.** The sequencer and validator nodes maintain a configurable lag from the tip of Ethereum, so typical L1 reorgs have no effect. In the event of larger Ethereum reorgs, Base can resubmit batch data on L1 without changing the sequenced L2 blocks.
    </Accordion>
  </Step>

  <Step title="L1 Batch Finality: ~20m" titleSize="h3">
    The Ethereum L1 batch containing the transaction is older than 2 epochs, or 64 L1 blocks.

    <Accordion title="Effectively 0% Probability of a Reorg.">
      * L2 blocks that have reached L1 batch finality are protected from reorgs the same way Ethereum finalized blocks are. They are in practice impossible to reverse.
    </Accordion>
  </Step>
</Steps>

## Finality for Withdrawal Transactions

This describes finality of transactions that move funds from Base to Ethereum

**Only withdrawals to Ethereum must wait 7 days to finalize before the funds can be released to the address on Ethereum L1.** This allows Base's Fault Proof system to provide extremely high security guarantees for funds bridged to Base.

<Accordion title="What Happens During the 7 Days?">
  When a transaction initiates a withdrawal from Base to Ethereum, the funds are removed from the account balance on Base. Later, a permissionless “proposer” must provide Ethereum with proof that Base contains this withdrawal.

  However, Ethereum cannot natively confirm what happened on Base as they are separate blockchains. Thus, there is a 7 day window in which a permissionless “challenger” can dispute a proposal that it feels is malicious. If no challenge is made in the 7 days, the withdrawal can be proven against the finalized output root and released to the L1 recipient. But if a challenge is made, the proposer and challenger play what is called the Fault Dispute Game. This game requires increasing bonds to be made, with an eventual winner. If the proposer wins, the output root finalizes and can be used to prove withdrawals against (releasing them on L1). If the challenger wins, the output proposal becomes invalid.

  This system requires only a one honest party to remain secure. Base will always run an honest proposer and challenger.

  Note: if the dispute game is won by a challenger, the state of the L2 chain does not reorg. The output proposal is marked invalid and any withdrawals that were proven against it cannot finalize. Those withdrawals would need to be re-proven against a different, valid output root.
</Accordion>

## FAQ

<AccordionGroup>
  <Accordion title="If There Is a Reorg on Ethereum, Will It Cause a Reorg on Base?">
    In almost all circumstances, no. Base can simply re-submit batch data to Ethereum transparently while the L2 chain continues to progress.
  </Accordion>

  <Accordion title="How Long Do Deposit Transactions Take to Finalize?">
    Transactions moving funds from Ethereum L1 to Base must be initiated on Ethereum and typically get included within 3 minutes by the Base sequencer.
  </Accordion>

  <Accordion title="If a Challenger Wins a Dispute Game, Will the L2 Chain Reorg?">
    No. The output proposal that was challenged is marked invalid, and any actions that used it's output root become invalid. Specifically, withdrawals from Base to L1 that proved against this output root must now prove against a different and valid one.
  </Accordion>
</AccordionGroup>

apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9e43b3893f23b8bf8fb7b67c6f34080827a8d377
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,82 @@
+# Reconciliation and Base deployment assessment
+
+## Executive conclusion
+
+The Arbitrum result is not anomalous. Inside an Arbitrum One contract, Solidity's `block.number` is an approximate Ethereum L1 block number, not the fast Arbitrum L2/RPC block height. The two deployments are therefore using substantially the same clock: Ethereum blocks multiplied by 12 seconds.
+
+Base is different. On current Base mainnet, `block.number` advances with Base's approximately two-second canonical L2 blocks. Deployed unchanged, the contract will therefore accrue at roughly six times the intended rate. It should not be deployed to Base unchanged.
+
+## 1. July
+
+The intended simple pro-rata interest is:
+
+```text
+1,000,000 * 0.04 * 31 / 365 = 3,397.260274 USDC
+```
+
+The premise that Arbitrum's roughly 250 ms transaction cadence drives this calculation is the mistaken part. Arbitrum distinguishes its child-chain/RPC block height from the value returned by the EVM `NUMBER` opcode. Its documentation says that Solidity `block.number` returns a value close to the block number of the first non-Arbitrum ancestor—Ethereum for Arbitrum One—and is synchronized with Ethereum periodically. The separate Arbitrum height can be obtained through `ArbSys.arbBlockNumber()`, but this code does not call it. See [Arbitrum: block numbers and time](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).
+
+Consequently, on both Ethereum and Arbitrum One the contract approximately computes:
+
+```text
+Ethereum blocks elapsed * 12 seconds/block
+```
+
+That explains why the deployments agree despite being deployed on different days. Their deployment dates merely select slightly different Ethereum block intervals; they do not cause the Arbitrum contract to count all Arbitrum L2 blocks.
+
+The small shortfall is also consistent with using block height as a clock. Ethereum schedules slots 12 seconds apart, but a slot can be empty; `block.number` advances for produced blocks, not for an empty slot. Accrual boundary times can add another small discrepancy. Ethereum documents both the 12-second slot and the possibility of an empty slot in [Ethereum blocks](https://ethereum.org/developers/docs/blocks/).
+
+Working backward from 3,391 USDC under a one-period/simple calculation:
+
+```text
+accounted seconds = 3,391 / (1,000,000 * 0.04) * 365 days
+                  = 2,673,464.4 seconds
+
+accounted blocks  = 2,673,464.4 / 12
+                  = 222,788.7 blocks
+
+ideal 31-day slots = 31 * 86,400 / 12
+                   = 223,200 slots
+
+difference         = about 411 blocks
+                   = about 4,936 synthetic seconds
+                   = about 82.3 minutes, or 0.184% of the month
+```
+
+The fractional inferred block is just a consequence of starting from a rounded USDC result. Missed L1 slots and the precise reconciliation cutoffs readily explain a gap of that order. The actual first and last accrual blocks and the complete `accrueInterest()` call history are needed to tie the result exactly to 3,391.
+
+There is a second issue hidden in the function: call cadence changes the charge. Each call increases `index`, and a later call earns interest on that increase. One call for a perfect 31-day interval produces 3,397.26 USDC, but daily calls produce about 3,402.85 and near-every-block calls approach 3,403.04. Integer division rounds each update down, but with a conventional high-precision index that effect should be tiny; without the index scale it should not be credited with explaining a six-dollar difference. Compounding pushes upward, so it cannot itself explain why 3,391 is below the simple-interest benchmark.
+
+## 2. Base
+
+Base currently builds a canonical L2 block about every two seconds. Its roughly 200 ms Flashblocks are preconfirmations, not additional canonical `block.number` increments. See [Base transaction finality](https://docs.base.org/base-chain/network-information/transaction-finality).
+
+For 31 days, assuming the same one-period/simple comparison used for the 3,397 benchmark:
+
+```text
+Base blocks       = 31 * 86,400 / 2
+                  = 1,339,200
+
+time invented by the contract
+                  = 1,339,200 * 12 seconds
+                  = 16,070,400 seconds
+                  = 186 days
+
+interest          = 1,000,000 * 0.04 * 186 / 365
+                  = 20,383.561644 USDC
+```
+
+That is exactly six times the intended simple charge of 3,397.260274 USDC. The actual charge is cadence-dependent: daily accrual is about 20,585.89 USDC, while near-every-block accrual approaches 20,592.73 USDC. Production gaps, boundary blocks, and integer rounding will move the exact result slightly.
+
+There is also a roadmap risk worth checking immediately before deployment. Base documents a proposed Denim upgrade from two-second canonical blocks to 200 ms canonical blocks. As of this assessment, it is experimental on Vibenet, is not active on Base mainnet, and has no scheduled mainnet activation. If it were activated, this unchanged code would run at roughly 60 times wall-clock time: one-period 31-day interest would be about 203,835.62 USDC. See [Base: 200 ms native blocks](https://docs.base.org/upgrades/denim/200ms-blocks).
+
+## Recommended change
+
+Do not deploy this implementation unchanged. Store `lastAccrualTimestamp` and calculate elapsed time from `block.timestamp - lastAccrualTimestamp`. That removes the chain-specific block-time assumption and the systematic undercount from missed Ethereum slots.
+
+Also decide and encode the product's intended rate semantics:
+
+- If 4.00% means simple fixed APR, do not repeatedly multiply an already-grown index by a linear period rate in a caller-controlled function. Anchor accrued interest to principal and elapsed time, or maintain a linear accumulator whose result is invariant to how callers partition an interval.
+- If compounding is intended, document whether 4.00% is APR or APY and use a vetted timestamp-based cumulative factor whose result depends only on total elapsed time, not on how often an arbitrary caller invokes the function.
+
+Use sufficient fixed-point precision/full-precision `mulDiv`, specify the rounding direction, accrue before every borrow, repay, liquidation, and other index-sensitive transition, and initialize/migrate the timestamp and old index atomically. Tests should compare the same wall-clock trace on Ethereum, Arbitrum, and Base and should explicitly split an identical interval into one, daily, and very frequent calls; all three partitions should yield the product's specified result.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9e43b3893f23b8bf8fb7b67c6f34080827a8d377
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,82 @@
+# Reconciliation and Base deployment assessment
+
+## Executive conclusion
+
+The Arbitrum result is not anomalous. Inside an Arbitrum One contract, Solidity's `block.number` is an approximate Ethereum L1 block number, not the fast Arbitrum L2/RPC block height. The two deployments are therefore using substantially the same clock: Ethereum blocks multiplied by 12 seconds.
+
+Base is different. On current Base mainnet, `block.number` advances with Base's approximately two-second canonical L2 blocks. Deployed unchanged, the contract will therefore accrue at roughly six times the intended rate. It should not be deployed to Base unchanged.
+
+## 1. July
+
+The intended simple pro-rata interest is:
+
+```text
+1,000,000 * 0.04 * 31 / 365 = 3,397.260274 USDC
+```
+
+The premise that Arbitrum's roughly 250 ms transaction cadence drives this calculation is the mistaken part. Arbitrum distinguishes its child-chain/RPC block height from the value returned by the EVM `NUMBER` opcode. Its documentation says that Solidity `block.number` returns a value close to the block number of the first non-Arbitrum ancestor—Ethereum for Arbitrum One—and is synchronized with Ethereum periodically. The separate Arbitrum height can be obtained through `ArbSys.arbBlockNumber()`, but this code does not call it. See [Arbitrum: block numbers and time](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).
+
+Consequently, on both Ethereum and Arbitrum One the contract approximately computes:
+
+```text
+Ethereum blocks elapsed * 12 seconds/block
+```
+
+That explains why the deployments agree despite being deployed on different days. Their deployment dates merely select slightly different Ethereum block intervals; they do not cause the Arbitrum contract to count all Arbitrum L2 blocks.
+
+The small shortfall is also consistent with using block height as a clock. Ethereum schedules slots 12 seconds apart, but a slot can be empty; `block.number` advances for produced blocks, not for an empty slot. Accrual boundary times can add another small discrepancy. Ethereum documents both the 12-second slot and the possibility of an empty slot in [Ethereum blocks](https://ethereum.org/developers/docs/blocks/).
+
+Working backward from 3,391 USDC under a one-period/simple calculation:
+
+```text
+accounted seconds = 3,391 / (1,000,000 * 0.04) * 365 days
+                  = 2,673,464.4 seconds
+
+accounted blocks  = 2,673,464.4 / 12
+                  = 222,788.7 blocks
+
+ideal 31-day slots = 31 * 86,400 / 12
+                   = 223,200 slots
+
+difference         = about 411 blocks
+                   = about 4,936 synthetic seconds
+                   = about 82.3 minutes, or 0.184% of the month
+```
+
+The fractional inferred block is just a consequence of starting from a rounded USDC result. Missed L1 slots and the precise reconciliation cutoffs readily explain a gap of that order. The actual first and last accrual blocks and the complete `accrueInterest()` call history are needed to tie the result exactly to 3,391.
+
+There is a second issue hidden in the function: call cadence changes the charge. Each call increases `index`, and a later call earns interest on that increase. One call for a perfect 31-day interval produces 3,397.26 USDC, but daily calls produce about 3,402.85 and near-every-block calls approach 3,403.04. Integer division rounds each update down, but with a conventional high-precision index that effect should be tiny; without the index scale it should not be credited with explaining a six-dollar difference. Compounding pushes upward, so it cannot itself explain why 3,391 is below the simple-interest benchmark.
+
+## 2. Base
+
+Base currently builds a canonical L2 block about every two seconds. Its roughly 200 ms Flashblocks are preconfirmations, not additional canonical `block.number` increments. See [Base transaction finality](https://docs.base.org/base-chain/network-information/transaction-finality).
+
+For 31 days, assuming the same one-period/simple comparison used for the 3,397 benchmark:
+
+```text
+Base blocks       = 31 * 86,400 / 2
+                  = 1,339,200
+
+time invented by the contract
+                  = 1,339,200 * 12 seconds
+                  = 16,070,400 seconds
+                  = 186 days
+
+interest          = 1,000,000 * 0.04 * 186 / 365
+                  = 20,383.561644 USDC
+```
+
+That is exactly six times the intended simple charge of 3,397.260274 USDC. The actual charge is cadence-dependent: daily accrual is about 20,585.89 USDC, while near-every-block accrual approaches 20,592.73 USDC. Production gaps, boundary blocks, and integer rounding will move the exact result slightly.
+
+There is also a roadmap risk worth checking immediately before deployment. Base documents a proposed Denim upgrade from two-second canonical blocks to 200 ms canonical blocks. As of this assessment, it is experimental on Vibenet, is not active on Base mainnet, and has no scheduled mainnet activation. If it were activated, this unchanged code would run at roughly 60 times wall-clock time: one-period 31-day interest would be about 203,835.62 USDC. See [Base: 200 ms native blocks](https://docs.base.org/upgrades/denim/200ms-blocks).
+
+## Recommended change
+
+Do not deploy this implementation unchanged. Store `lastAccrualTimestamp` and calculate elapsed time from `block.timestamp - lastAccrualTimestamp`. That removes the chain-specific block-time assumption and the systematic undercount from missed Ethereum slots.
+
+Also decide and encode the product's intended rate semantics:
+
+- If 4.00% means simple fixed APR, do not repeatedly multiply an already-grown index by a linear period rate in a caller-controlled function. Anchor accrued interest to principal and elapsed time, or maintain a linear accumulator whose result is invariant to how callers partition an interval.
+- If compounding is intended, document whether 4.00% is APR or APY and use a vetted timestamp-based cumulative factor whose result depends only on total elapsed time, not on how often an arbitrary caller invokes the function.
+
+Use sufficient fixed-point precision/full-precision `mulDiv`, specify the rounding direction, accrue before every borrow, repay, liquidation, and other index-sensitive transition, and initialize/migrate the timestamp and old index atomically. Tests should compare the same wall-clock trace on Ethereum, Arbitrum, and Base and should explicitly split an identical interval into one, daily, and very frequent calls; all three partitions should yield the product's specified result.

exec
/bin/bash -lc "wc -l answer.md && sed -n '1,260p' answer.md" in /tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002
 succeeded in 4ms:
# Reconciliation and Base deployment assessment

## Executive conclusion

The Arbitrum result is not anomalous. Inside an Arbitrum One contract, Solidity's `block.number` is an approximate Ethereum L1 block number, not the fast Arbitrum L2/RPC block height. The two deployments are therefore using substantially the same clock: Ethereum blocks multiplied by 12 seconds.

Base is different. On current Base mainnet, `block.number` advances with Base's approximately two-second canonical L2 blocks. Deployed unchanged, the contract will therefore accrue at roughly six times the intended rate. It should not be deployed to Base unchanged.

## 1. July

The intended simple pro-rata interest is:

```text
1,000,000 * 0.04 * 31 / 365 = 3,397.260274 USDC
```

The premise that Arbitrum's roughly 250 ms transaction cadence drives this calculation is the mistaken part. Arbitrum distinguishes its child-chain/RPC block height from the value returned by the EVM `NUMBER` opcode. Its documentation says that Solidity `block.number` returns a value close to the block number of the first non-Arbitrum ancestor—Ethereum for Arbitrum One—and is synchronized with Ethereum periodically. The separate Arbitrum height can be obtained through `ArbSys.arbBlockNumber()`, but this code does not call it. See [Arbitrum: block numbers and time](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).

Consequently, on both Ethereum and Arbitrum One the contract approximately computes:

```text
Ethereum blocks elapsed * 12 seconds/block
```

That explains why the deployments agree despite being deployed on different days. Their deployment dates merely select slightly different Ethereum block intervals; they do not cause the Arbitrum contract to count all Arbitrum L2 blocks.

The small shortfall is also consistent with using block height as a clock. Ethereum schedules slots 12 seconds apart, but a slot can be empty; `block.number` advances for produced blocks, not for an empty slot. Accrual boundary times can add another small discrepancy. Ethereum documents both the 12-second slot and the possibility of an empty slot in [Ethereum blocks](https://ethereum.org/developers/docs/blocks/).

Working backward from 3,391 USDC under a one-period/simple calculation:

```text
accounted seconds = 3,391 / (1,000,000 * 0.04) * 365 days
                  = 2,673,464.4 seconds

accounted blocks  = 2,673,464.4 / 12
                  = 222,788.7 blocks

ideal 31-day slots = 31 * 86,400 / 12
                   = 223,200 slots

difference         = about 411 blocks
                   = about 4,936 synthetic seconds
                   = about 82.3 minutes, or 0.184% of the month
```

The fractional inferred block is just a consequence of starting from a rounded USDC result. Missed L1 slots and the precise reconciliation cutoffs readily explain a gap of that order. The actual first and last accrual blocks and the complete `accrueInterest()` call history are needed to tie the result exactly to 3,391.

There is a second issue hidden in the function: call cadence changes the charge. Each call increases `index`, and a later call earns interest on that increase. One call for a perfect 31-day interval produces 3,397.26 USDC, but daily calls produce about 3,402.85 and near-every-block calls approach 3,403.04. Integer division rounds each update down, but with a conventional high-precision index that effect should be tiny; without the index scale it should not be credited with explaining a six-dollar difference. Compounding pushes upward, so it cannot itself explain why 3,391 is below the simple-interest benchmark.

## 2. Base

Base currently builds a canonical L2 block about every two seconds. Its roughly 200 ms Flashblocks are preconfirmations, not additional canonical `block.number` increments. See [Base transaction finality](https://docs.base.org/base-chain/network-information/transaction-finality).

For 31 days, assuming the same one-period/simple comparison used for the 3,397 benchmark:

```text
Base blocks       = 31 * 86,400 / 2
                  = 1,339,200

time invented by the contract
                  = 1,339,200 * 12 seconds
                  = 16,070,400 seconds
                  = 186 days

interest          = 1,000,000 * 0.04 * 186 / 365
                  = 20,383.561644 USDC
```

That is exactly six times the intended simple charge of 3,397.260274 USDC. The actual charge is cadence-dependent: daily accrual is about 20,585.89 USDC, while near-every-block accrual approaches 20,592.73 USDC. Production gaps, boundary blocks, and integer rounding will move the exact result slightly.

There is also a roadmap risk worth checking immediately before deployment. Base documents a proposed Denim upgrade from two-second canonical blocks to 200 ms canonical blocks. As of this assessment, it is experimental on Vibenet, is not active on Base mainnet, and has no scheduled mainnet activation. If it were activated, this unchanged code would run at roughly 60 times wall-clock time: one-period 31-day interest would be about 203,835.62 USDC. See [Base: 200 ms native blocks](https://docs.base.org/upgrades/denim/200ms-blocks).

## Recommended change

Do not deploy this implementation unchanged. Store `lastAccrualTimestamp` and calculate elapsed time from `block.timestamp - lastAccrualTimestamp`. That removes the chain-specific block-time assumption and the systematic undercount from missed Ethereum slots.

Also decide and encode the product's intended rate semantics:

- If 4.00% means simple fixed APR, do not repeatedly multiply an already-grown index by a linear period rate in a caller-controlled function. Anchor accrued interest to principal and elapsed time, or maintain a linear accumulator whose result is invariant to how callers partition an interval.
- If compounding is intended, document whether 4.00% is APR or APY and use a vetted timestamp-based cumulative factor whose result depends only on total elapsed time, not on how often an arbitrary caller invokes the function.

Use sufficient fixed-point precision/full-precision `mulDiv`, specify the rounding direction, accrue before every borrow, repay, liquidation, and other index-sensitive transition, and initialize/migrate the timestamp and old index atomically. Tests should compare the same wall-clock trace on Ethereum, Arbitrum, and Base and should explicitly split an identical interval into one, daily, and very frequent calls; all three partitions should yield the product's specified result.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9e43b3893f23b8bf8fb7b67c6f34080827a8d377
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,82 @@
+# Reconciliation and Base deployment assessment
+
+## Executive conclusion
+
+The Arbitrum result is not anomalous. Inside an Arbitrum One contract, Solidity's `block.number` is an approximate Ethereum L1 block number, not the fast Arbitrum L2/RPC block height. The two deployments are therefore using substantially the same clock: Ethereum blocks multiplied by 12 seconds.
+
+Base is different. On current Base mainnet, `block.number` advances with Base's approximately two-second canonical L2 blocks. Deployed unchanged, the contract will therefore accrue at roughly six times the intended rate. It should not be deployed to Base unchanged.
+
+## 1. July
+
+The intended simple pro-rata interest is:
+
+```text
+1,000,000 * 0.04 * 31 / 365 = 3,397.260274 USDC
+```
+
+The premise that Arbitrum's roughly 250 ms transaction cadence drives this calculation is the mistaken part. Arbitrum distinguishes its child-chain/RPC block height from the value returned by the EVM `NUMBER` opcode. Its documentation says that Solidity `block.number` returns a value close to the block number of the first non-Arbitrum ancestor—Ethereum for Arbitrum One—and is synchronized with Ethereum periodically. The separate Arbitrum height can be obtained through `ArbSys.arbBlockNumber()`, but this code does not call it. See [Arbitrum: block numbers and time](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).
+
+Consequently, on both Ethereum and Arbitrum One the contract approximately computes:
+
+```text
+Ethereum blocks elapsed * 12 seconds/block
+```
+
+That explains why the deployments agree despite being deployed on different days. Their deployment dates merely select slightly different Ethereum block intervals; they do not cause the Arbitrum contract to count all Arbitrum L2 blocks.
+
+The small shortfall is also consistent with using block height as a clock. Ethereum schedules slots 12 seconds apart, but a slot can be empty; `block.number` advances for produced blocks, not for an empty slot. Accrual boundary times can add another small discrepancy. Ethereum documents both the 12-second slot and the possibility of an empty slot in [Ethereum blocks](https://ethereum.org/developers/docs/blocks/).
+
+Working backward from 3,391 USDC under a one-period/simple calculation:
+
+```text
+accounted seconds = 3,391 / (1,000,000 * 0.04) * 365 days
+                  = 2,673,464.4 seconds
+
+accounted blocks  = 2,673,464.4 / 12
+                  = 222,788.7 blocks
+
+ideal 31-day slots = 31 * 86,400 / 12
+                   = 223,200 slots
+
+difference         = about 411 blocks
+                   = about 4,936 synthetic seconds
+                   = about 82.3 minutes, or 0.184% of the month
+```
+
+The fractional inferred block is just a consequence of starting from a rounded USDC result. Missed L1 slots and the precise reconciliation cutoffs readily explain a gap of that order. The actual first and last accrual blocks and the complete `accrueInterest()` call history are needed to tie the result exactly to 3,391.
+
+There is a second issue hidden in the function: call cadence changes the charge. Each call increases `index`, and a later call earns interest on that increase. One call for a perfect 31-day interval produces 3,397.26 USDC, but daily calls produce about 3,402.85 and near-every-block calls approach 3,403.04. Integer division rounds each update down, but with a conventional high-precision index that effect should be tiny; without the index scale it should not be credited with explaining a six-dollar difference. Compounding pushes upward, so it cannot itself explain why 3,391 is below the simple-interest benchmark.
+
+## 2. Base
+
+Base currently builds a canonical L2 block about every two seconds. Its roughly 200 ms Flashblocks are preconfirmations, not additional canonical `block.number` increments. See [Base transaction finality](https://docs.base.org/base-chain/network-information/transaction-finality).
+
+For 31 days, assuming the same one-period/simple comparison used for the 3,397 benchmark:
+
+```text
+Base blocks       = 31 * 86,400 / 2
+                  = 1,339,200
+
+time invented by the contract
+                  = 1,339,200 * 12 seconds
+                  = 16,070,400 seconds
+                  = 186 days
+
+interest          = 1,000,000 * 0.04 * 186 / 365
+                  = 20,383.561644 USDC
+```
+
+That is exactly six times the intended simple charge of 3,397.260274 USDC. The actual charge is cadence-dependent: daily accrual is about 20,585.89 USDC, while near-every-block accrual approaches 20,592.73 USDC. Production gaps, boundary blocks, and integer rounding will move the exact result slightly.
+
+There is also a roadmap risk worth checking immediately before deployment. Base documents a proposed Denim upgrade from two-second canonical blocks to 200 ms canonical blocks. As of this assessment, it is experimental on Vibenet, is not active on Base mainnet, and has no scheduled mainnet activation. If it were activated, this unchanged code would run at roughly 60 times wall-clock time: one-period 31-day interest would be about 203,835.62 USDC. See [Base: 200 ms native blocks](https://docs.base.org/upgrades/denim/200ms-blocks).
+
+## Recommended change
+
+Do not deploy this implementation unchanged. Store `lastAccrualTimestamp` and calculate elapsed time from `block.timestamp - lastAccrualTimestamp`. That removes the chain-specific block-time assumption and the systematic undercount from missed Ethereum slots.
+
+Also decide and encode the product's intended rate semantics:
+
+- If 4.00% means simple fixed APR, do not repeatedly multiply an already-grown index by a linear period rate in a caller-controlled function. Anchor accrued interest to principal and elapsed time, or maintain a linear accumulator whose result is invariant to how callers partition an interval.
+- If compounding is intended, document whether 4.00% is APR or APY and use a vetted timestamp-based cumulative factor whose result depends only on total elapsed time, not on how often an arbitrary caller invokes the function.
+
+Use sufficient fixed-point precision/full-precision `mulDiv`, specify the rounding direction, accrue before every borrow, repay, liquidation, and other index-sensitive transition, and initialize/migrate the timestamp and old index atomically. Tests should compare the same wall-clock trace on Ethereum, Arbitrum, and Base and should explicitly split an identical interval into one, daily, and very frequent calls; all three partitions should yield the product's specified result.

codex
Created [answer.md](/tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002/answer.md).

It covers the July reconciliation, Base’s approximately 6× overcharge, caller-dependent compounding, the prospective Base 200 ms block upgrade risk, and recommended timestamp-based remediation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..9e43b3893f23b8bf8fb7b67c6f34080827a8d377
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,82 @@
+# Reconciliation and Base deployment assessment
+
+## Executive conclusion
+
+The Arbitrum result is not anomalous. Inside an Arbitrum One contract, Solidity's `block.number` is an approximate Ethereum L1 block number, not the fast Arbitrum L2/RPC block height. The two deployments are therefore using substantially the same clock: Ethereum blocks multiplied by 12 seconds.
+
+Base is different. On current Base mainnet, `block.number` advances with Base's approximately two-second canonical L2 blocks. Deployed unchanged, the contract will therefore accrue at roughly six times the intended rate. It should not be deployed to Base unchanged.
+
+## 1. July
+
+The intended simple pro-rata interest is:
+
+```text
+1,000,000 * 0.04 * 31 / 365 = 3,397.260274 USDC
+```
+
+The premise that Arbitrum's roughly 250 ms transaction cadence drives this calculation is the mistaken part. Arbitrum distinguishes its child-chain/RPC block height from the value returned by the EVM `NUMBER` opcode. Its documentation says that Solidity `block.number` returns a value close to the block number of the first non-Arbitrum ancestor—Ethereum for Arbitrum One—and is synchronized with Ethereum periodically. The separate Arbitrum height can be obtained through `ArbSys.arbBlockNumber()`, but this code does not call it. See [Arbitrum: block numbers and time](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).
+
+Consequently, on both Ethereum and Arbitrum One the contract approximately computes:
+
+```text
+Ethereum blocks elapsed * 12 seconds/block
+```
+
+That explains why the deployments agree despite being deployed on different days. Their deployment dates merely select slightly different Ethereum block intervals; they do not cause the Arbitrum contract to count all Arbitrum L2 blocks.
+
+The small shortfall is also consistent with using block height as a clock. Ethereum schedules slots 12 seconds apart, but a slot can be empty; `block.number` advances for produced blocks, not for an empty slot. Accrual boundary times can add another small discrepancy. Ethereum documents both the 12-second slot and the possibility of an empty slot in [Ethereum blocks](https://ethereum.org/developers/docs/blocks/).
+
+Working backward from 3,391 USDC under a one-period/simple calculation:
+
+```text
+accounted seconds = 3,391 / (1,000,000 * 0.04) * 365 days
+                  = 2,673,464.4 seconds
+
+accounted blocks  = 2,673,464.4 / 12
+                  = 222,788.7 blocks
+
+ideal 31-day slots = 31 * 86,400 / 12
+                   = 223,200 slots
+
+difference         = about 411 blocks
+                   = about 4,936 synthetic seconds
+                   = about 82.3 minutes, or 0.184% of the month
+```
+
+The fractional inferred block is just a consequence of starting from a rounded USDC result. Missed L1 slots and the precise reconciliation cutoffs readily explain a gap of that order. The actual first and last accrual blocks and the complete `accrueInterest()` call history are needed to tie the result exactly to 3,391.
+
+There is a second issue hidden in the function: call cadence changes the charge. Each call increases `index`, and a later call earns interest on that increase. One call for a perfect 31-day interval produces 3,397.26 USDC, but daily calls produce about 3,402.85 and near-every-block calls approach 3,403.04. Integer division rounds each update down, but with a conventional high-precision index that effect should be tiny; without the index scale it should not be credited with explaining a six-dollar difference. Compounding pushes upward, so it cannot itself explain why 3,391 is below the simple-interest benchmark.
+
+## 2. Base
+
+Base currently builds a canonical L2 block about every two seconds. Its roughly 200 ms Flashblocks are preconfirmations, not additional canonical `block.number` increments. See [Base transaction finality](https://docs.base.org/base-chain/network-information/transaction-finality).
+
+For 31 days, assuming the same one-period/simple comparison used for the 3,397 benchmark:
+
+```text
+Base blocks       = 31 * 86,400 / 2
+                  = 1,339,200
+
+time invented by the contract
+                  = 1,339,200 * 12 seconds
+                  = 16,070,400 seconds
+                  = 186 days
+
+interest          = 1,000,000 * 0.04 * 186 / 365
+                  = 20,383.561644 USDC
+```
+
+That is exactly six times the intended simple charge of 3,397.260274 USDC. The actual charge is cadence-dependent: daily accrual is about 20,585.89 USDC, while near-every-block accrual approaches 20,592.73 USDC. Production gaps, boundary blocks, and integer rounding will move the exact result slightly.
+
+There is also a roadmap risk worth checking immediately before deployment. Base documents a proposed Denim upgrade from two-second canonical blocks to 200 ms canonical blocks. As of this assessment, it is experimental on Vibenet, is not active on Base mainnet, and has no scheduled mainnet activation. If it were activated, this unchanged code would run at roughly 60 times wall-clock time: one-period 31-day interest would be about 203,835.62 USDC. See [Base: 200 ms native blocks](https://docs.base.org/upgrades/denim/200ms-blocks).
+
+## Recommended change
+
+Do not deploy this implementation unchanged. Store `lastAccrualTimestamp` and calculate elapsed time from `block.timestamp - lastAccrualTimestamp`. That removes the chain-specific block-time assumption and the systematic undercount from missed Ethereum slots.
+
+Also decide and encode the product's intended rate semantics:
+
+- If 4.00% means simple fixed APR, do not repeatedly multiply an already-grown index by a linear period rate in a caller-controlled function. Anchor accrued interest to principal and elapsed time, or maintain a linear accumulator whose result is invariant to how callers partition an interval.
+- If compounding is intended, document whether 4.00% is APR or APY and use a vetted timestamp-based cumulative factor whose result depends only on total elapsed time, not on how often an arbitrary caller invokes the function.
+
+Use sufficient fixed-point precision/full-precision `mulDiv`, specify the rounding direction, accrue before every borrow, repay, liquidation, and other index-sensitive transition, and initialize/migrate the timestamp and old index atomically. Tests should compare the same wall-clock trace on Ethereum, Arbitrum, and Base and should explicitly split an identical interval into one, daily, and very frequent calls; all three partitions should yield the product's specified result.

tokens used
48,931
````

## final message

Created [answer.md](/tmp/ethskills-audit-eval/2026-09-02T150914Z-codex-with-skill-3/audit-quiz-002/answer.md).

It covers the July reconciliation, Base’s approximately 6× overcharge, caller-dependent compounding, the prospective Base 200 ms block upgrade risk, and recommended timestamp-based remediation.
