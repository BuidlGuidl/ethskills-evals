# Executor transcript — 2026-09-02T145923Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a062a1-c60c-73d1-96e0-cd2847483604
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

2026-09-02T14:59:24.532345Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a062a1-c60c-73d1-96e0-cd2847483604.tmp-1788361164312522507: line 2547: syntax error near unexpected token `('

codex
I’m using the smart-contract audit skill because this is a chain-specific accounting review with deployment risk. I’ll inspect its required guidance, verify current L2 block-number semantics from primary sources, then write the reconciled arithmetic and recommendation to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/audit/SKILL.md" in /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
 succeeded in 1ms:
codex
The key distinction I’m checking is between “L2 blocks are produced quickly” and what Solidity’s `block.number` opcode actually returns on each rollup. Those are not necessarily the same counter, and identical bytecode does not guarantee identical environmental semantics.
exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md' in /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
 succeeded in 231ms:
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

web search: 
web search: site:docs.arbitrum.io block.number returns L1 block number Solidity ArbSys arbBlockNumber ...
exec
/bin/bash -lc "python3 - <<'PY'
from decimal import Decimal,getcontext
getcontext().prec=30
P=Decimal(1_000_000); r=Decimal('0.04'); days=Decimal(31)
simple=P*r*days/Decimal(365)
base_simple=P*r*days*Decimal(6)/Decimal(365)
base_daily=P*((Decimal(1)+r*Decimal(6)/Decimal(365))**31-1)
base_cont=P*((r*days*Decimal(6)/Decimal(365)).exp()-1)
N=Decimal(3391)*Decimal(10000)*Decimal(365*86400)/(P*Decimal(400)*Decimal(12))
print(simple,base_simple,base_daily,base_cont,N, Decimal(31*86400)/12, Decimal(3391)/simple)
PY" in /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
 succeeded in 15ms:
3397.26027397260273972602739726 20383.5616438356164383561643836 20585.8887587436034216874827300 20592.7251851487674740929363700 222788.7 223200 0.998157258064516129032258064516

exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-general/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
 succeeded in 43ms:
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

exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-precision-math/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
 succeeded in 32ms:
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

exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-defi-lending/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
 succeeded in 240ms:
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

exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-chain-specific/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
 succeeded in 55ms:
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

exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-precision-math/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
 succeeded in 35ms:
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

exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-defi-lending/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
 succeeded in 48ms:
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

exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-general/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
 succeeded in 40ms:
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

web search: 
web search: site:ethereum.org developers block proposal slots 12 seconds missed slot block number ...
collab: Wait
codex
The reconciliation is now pinned down: Arbitrum’s 250 ms activity is not the counter read by this bytecode, while Base’s canonical two-second L2 height is. One important caveat is that the snippet does not define one exact monthly charge by itself—public call frequency changes compounding—so I’ll present the single-period figure, the frequent-call bound, and what evidence is needed to reproduce the exact July dollars.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f18a51da8f4c01aaee9733c6a53216c3f1283d49
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,104 @@
+# Fixed-rate accrual across Ethereum, Arbitrum, and Base
+
+## Conclusion
+
+Do **not** deploy this code unchanged to Base. On Arbitrum One, Solidity's `block.number` is approximately the Ethereum L1 block number, so the code accidentally behaves much like it does on mainnet. On Base, `block.number` is the Base L2 block number, which normally advances every two seconds. The hard-coded 12 seconds therefore makes time—and interest—run approximately six times too fast on Base.
+
+There is a second issue: the result depends on how often anyone calls `accrueInterest()`. Each update is linear for that interval, but it applies to an already-increased `index`, so splitting a period into more calls compounds the debt more frequently. Consequently, the snippet alone cannot determine an exact monthly charge without the call history and the index's fixed-point precision.
+
+## 1. July reconciliation
+
+The finance benchmark is simple 4.00% APR over 31 days:
+
+```text
+1,000,000 * 0.04 * 31 / 365
+= 3,397.260274 USDC
+```
+
+### Why Arbitrum did not charge roughly 48 times too much
+
+Arbitrum's roughly 250 ms L2 production cadence is not what the EVM `NUMBER` opcode exposes to this contract. On Arbitrum One, Solidity's `block.number` returns an approximation of the first non-Arbitrum ancestor's block number—Ethereum L1—not the Arbitrum child-chain height. The native Arbitrum height is available separately from `ArbSys(100).arbBlockNumber()`. The [Arbitrum documentation explains this distinction](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).
+
+Thus both deployments are effectively doing this over a long interval:
+
+```text
+change in Ethereum block height * 12 seconds
+```
+
+That is why they agree. Arbitrum may observe the approximate L1 number in delayed jumps, and many Arbitrum transactions can see the same `block.number`, but those effects are small at month scale.
+
+### Why both were slightly below 3,397 USDC
+
+Ethereum has 12-second **slots**, but not necessarily one block in every slot. Empty/missed slots consume wall-clock time without incrementing execution-layer block height. Ethereum's own [block documentation](https://ethereum.org/developers/docs/blocks/) explicitly notes that slots are 12 seconds and can be empty. Therefore `blocksElapsed * 12` normally understates elapsed wall time whenever slots are missed.
+
+For scale, treating the reported 3,391 USDC as an unrounded, single-period result implies:
+
+```text
+modeled seconds = 3,391 * 365 days / (1,000,000 * 0.04)
+                = 2,673,464.4 seconds
+
+modeled blocks  = 2,673,464.4 / 12
+                = 222,788.7 blocks
+
+ideal 31-day slots = 31 days / 12 seconds
+                   = 223,200 slots
+
+difference ≈ 411 blocks ≈ 4,936 seconds ≈ 82 minutes ≈ 0.184%
+```
+
+That magnitude is consistent with missed slots plus reconciliation endpoint placement and integer truncation. It is not possible to prove that missed slots alone account for the exact six-dollar difference from the information given. To reproduce the exact number, finance should retain the start/end timestamps and block numbers, every `accrueInterest()` call, the starting index, its scale, and the final rounding rule.
+
+Call cadence cannot by itself explain an undercharge: absent integer truncation, more calls increase the result. At perfect 31-day timing, one update gives 3,397.26 USDC, daily updates give about 3,402.85 USDC, and extremely frequent updates approach about 3,403.04 USDC. Integer division rounds each index increment down, but its dollar effect depends on the undisclosed index scale and number of calls.
+
+## 2. What happens on Base
+
+Base is an OP Stack chain. Its canonical L2 blocks are produced approximately every two seconds; the [Base documentation distinguishes two-second L2 blocks from 200 ms Flashblock preconfirmations](https://docs.base.org/base-chain/network-information/transaction-finality). Flashblocks do not make the contract's canonical block number advance every 200 ms. The OP Stack derivation rules also describe a [two-second L2 block interval](https://docs.base.org/base-chain/specs/protocol/consensus/derivation).
+
+For 31 days at two seconds per Base block:
+
+```text
+actual elapsed seconds = 31 * 86,400
+                       = 2,678,400
+
+Base blocks            = 2,678,400 / 2
+                       = 1,339,200
+
+seconds used by code   = 1,339,200 * 12
+                       = 16,070,400 seconds
+                       = 186 days
+```
+
+With one accrual covering the whole month, the charge is therefore:
+
+```text
+1,000,000 * 0.04 * 186 / 365
+= 20,383.561644 USDC
+```
+
+That is exactly six times the simple 31-day benchmark, or about **20,384 USDC** rather than 3,397 USDC.
+
+It is not an unconditional exact figure because the public function compounds on every call. Ignoring fixed-point truncation:
+
+- one call spanning the month: **20,383.56 USDC**;
+- one call per wall-clock day: about **20,585.89 USDC**;
+- calls every Base block: about **20,592.73 USDC**.
+
+An arbitrary real call schedule will produce a value between the single-period and frequent-call results, subject to downward integer rounding. Because anyone can call, an external party can influence the amount within that range.
+
+## Recommended change
+
+Replace the block-height clock with elapsed timestamps:
+
+```solidity
+uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+lastAccrualTimestamp = block.timestamp;
+```
+
+For month-scale interest, `block.timestamp` is the portable EVM clock. It still has chain-specific sequencer/validator constraints, but it measures seconds directly and does not embed a false block-time assumption.
+
+Also specify whether “4.00% per year” means simple APR or a compounded rate, then make the result independent of public call partitioning:
+
+- If it is simple APR, accrue from principal and elapsed time without repeatedly applying the rate to previously accrued interest merely because someone called the function.
+- If compounding is intended, use a documented fixed-period/per-second growth factor with full-precision fixed-point exponentiation so `growth(a + b) = growth(a) * growth(b)` apart from controlled rounding.
+
+Use full-precision `mulDiv`-style arithmetic with an explicit rounding policy, initialize the timestamp atomically at deployment, and test identical wall-clock intervals on every target chain. This removes both the Base six-times error and the caller-controlled compounding ambiguity.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f18a51da8f4c01aaee9733c6a53216c3f1283d49
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,104 @@
+# Fixed-rate accrual across Ethereum, Arbitrum, and Base
+
+## Conclusion
+
+Do **not** deploy this code unchanged to Base. On Arbitrum One, Solidity's `block.number` is approximately the Ethereum L1 block number, so the code accidentally behaves much like it does on mainnet. On Base, `block.number` is the Base L2 block number, which normally advances every two seconds. The hard-coded 12 seconds therefore makes time—and interest—run approximately six times too fast on Base.
+
+There is a second issue: the result depends on how often anyone calls `accrueInterest()`. Each update is linear for that interval, but it applies to an already-increased `index`, so splitting a period into more calls compounds the debt more frequently. Consequently, the snippet alone cannot determine an exact monthly charge without the call history and the index's fixed-point precision.
+
+## 1. July reconciliation
+
+The finance benchmark is simple 4.00% APR over 31 days:
+
+```text
+1,000,000 * 0.04 * 31 / 365
+= 3,397.260274 USDC
+```
+
+### Why Arbitrum did not charge roughly 48 times too much
+
+Arbitrum's roughly 250 ms L2 production cadence is not what the EVM `NUMBER` opcode exposes to this contract. On Arbitrum One, Solidity's `block.number` returns an approximation of the first non-Arbitrum ancestor's block number—Ethereum L1—not the Arbitrum child-chain height. The native Arbitrum height is available separately from `ArbSys(100).arbBlockNumber()`. The [Arbitrum documentation explains this distinction](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).
+
+Thus both deployments are effectively doing this over a long interval:
+
+```text
+change in Ethereum block height * 12 seconds
+```
+
+That is why they agree. Arbitrum may observe the approximate L1 number in delayed jumps, and many Arbitrum transactions can see the same `block.number`, but those effects are small at month scale.
+
+### Why both were slightly below 3,397 USDC
+
+Ethereum has 12-second **slots**, but not necessarily one block in every slot. Empty/missed slots consume wall-clock time without incrementing execution-layer block height. Ethereum's own [block documentation](https://ethereum.org/developers/docs/blocks/) explicitly notes that slots are 12 seconds and can be empty. Therefore `blocksElapsed * 12` normally understates elapsed wall time whenever slots are missed.
+
+For scale, treating the reported 3,391 USDC as an unrounded, single-period result implies:
+
+```text
+modeled seconds = 3,391 * 365 days / (1,000,000 * 0.04)
+                = 2,673,464.4 seconds
+
+modeled blocks  = 2,673,464.4 / 12
+                = 222,788.7 blocks
+
+ideal 31-day slots = 31 days / 12 seconds
+                   = 223,200 slots
+
+difference ≈ 411 blocks ≈ 4,936 seconds ≈ 82 minutes ≈ 0.184%
+```
+
+That magnitude is consistent with missed slots plus reconciliation endpoint placement and integer truncation. It is not possible to prove that missed slots alone account for the exact six-dollar difference from the information given. To reproduce the exact number, finance should retain the start/end timestamps and block numbers, every `accrueInterest()` call, the starting index, its scale, and the final rounding rule.
+
+Call cadence cannot by itself explain an undercharge: absent integer truncation, more calls increase the result. At perfect 31-day timing, one update gives 3,397.26 USDC, daily updates give about 3,402.85 USDC, and extremely frequent updates approach about 3,403.04 USDC. Integer division rounds each index increment down, but its dollar effect depends on the undisclosed index scale and number of calls.
+
+## 2. What happens on Base
+
+Base is an OP Stack chain. Its canonical L2 blocks are produced approximately every two seconds; the [Base documentation distinguishes two-second L2 blocks from 200 ms Flashblock preconfirmations](https://docs.base.org/base-chain/network-information/transaction-finality). Flashblocks do not make the contract's canonical block number advance every 200 ms. The OP Stack derivation rules also describe a [two-second L2 block interval](https://docs.base.org/base-chain/specs/protocol/consensus/derivation).
+
+For 31 days at two seconds per Base block:
+
+```text
+actual elapsed seconds = 31 * 86,400
+                       = 2,678,400
+
+Base blocks            = 2,678,400 / 2
+                       = 1,339,200
+
+seconds used by code   = 1,339,200 * 12
+                       = 16,070,400 seconds
+                       = 186 days
+```
+
+With one accrual covering the whole month, the charge is therefore:
+
+```text
+1,000,000 * 0.04 * 186 / 365
+= 20,383.561644 USDC
+```
+
+That is exactly six times the simple 31-day benchmark, or about **20,384 USDC** rather than 3,397 USDC.
+
+It is not an unconditional exact figure because the public function compounds on every call. Ignoring fixed-point truncation:
+
+- one call spanning the month: **20,383.56 USDC**;
+- one call per wall-clock day: about **20,585.89 USDC**;
+- calls every Base block: about **20,592.73 USDC**.
+
+An arbitrary real call schedule will produce a value between the single-period and frequent-call results, subject to downward integer rounding. Because anyone can call, an external party can influence the amount within that range.
+
+## Recommended change
+
+Replace the block-height clock with elapsed timestamps:
+
+```solidity
+uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+lastAccrualTimestamp = block.timestamp;
+```
+
+For month-scale interest, `block.timestamp` is the portable EVM clock. It still has chain-specific sequencer/validator constraints, but it measures seconds directly and does not embed a false block-time assumption.
+
+Also specify whether “4.00% per year” means simple APR or a compounded rate, then make the result independent of public call partitioning:
+
+- If it is simple APR, accrue from principal and elapsed time without repeatedly applying the rate to previously accrued interest merely because someone called the function.
+- If compounding is intended, use a documented fixed-period/per-second growth factor with full-precision fixed-point exponentiation so `growth(a + b) = growth(a) * growth(b)` apart from controlled rounding.
+
+Use full-precision `mulDiv`-style arithmetic with an explicit rounding policy, initialize the timestamp atomically at deployment, and test identical wall-clock intervals on every target chain. This removes both the Base six-times error and the caller-controlled compounding ambiguity.

exec
/bin/bash -lc "wc -w answer.md && sed -n '1,30p' answer.md" in /tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
893 answer.md
# Fixed-rate accrual across Ethereum, Arbitrum, and Base

## Conclusion

Do **not** deploy this code unchanged to Base. On Arbitrum One, Solidity's `block.number` is approximately the Ethereum L1 block number, so the code accidentally behaves much like it does on mainnet. On Base, `block.number` is the Base L2 block number, which normally advances every two seconds. The hard-coded 12 seconds therefore makes time—and interest—run approximately six times too fast on Base.

There is a second issue: the result depends on how often anyone calls `accrueInterest()`. Each update is linear for that interval, but it applies to an already-increased `index`, so splitting a period into more calls compounds the debt more frequently. Consequently, the snippet alone cannot determine an exact monthly charge without the call history and the index's fixed-point precision.

## 1. July reconciliation

The finance benchmark is simple 4.00% APR over 31 days:

```text
1,000,000 * 0.04 * 31 / 365
= 3,397.260274 USDC
```

### Why Arbitrum did not charge roughly 48 times too much

Arbitrum's roughly 250 ms L2 production cadence is not what the EVM `NUMBER` opcode exposes to this contract. On Arbitrum One, Solidity's `block.number` returns an approximation of the first non-Arbitrum ancestor's block number—Ethereum L1—not the Arbitrum child-chain height. The native Arbitrum height is available separately from `ArbSys(100).arbBlockNumber()`. The [Arbitrum documentation explains this distinction](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).

Thus both deployments are effectively doing this over a long interval:

```text
change in Ethereum block height * 12 seconds
```

That is why they agree. Arbitrum may observe the approximate L1 number in delayed jumps, and many Arbitrum transactions can see the same `block.number`, but those effects are small at month scale.

### Why both were slightly below 3,397 USDC

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f18a51da8f4c01aaee9733c6a53216c3f1283d49
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,104 @@
+# Fixed-rate accrual across Ethereum, Arbitrum, and Base
+
+## Conclusion
+
+Do **not** deploy this code unchanged to Base. On Arbitrum One, Solidity's `block.number` is approximately the Ethereum L1 block number, so the code accidentally behaves much like it does on mainnet. On Base, `block.number` is the Base L2 block number, which normally advances every two seconds. The hard-coded 12 seconds therefore makes time—and interest—run approximately six times too fast on Base.
+
+There is a second issue: the result depends on how often anyone calls `accrueInterest()`. Each update is linear for that interval, but it applies to an already-increased `index`, so splitting a period into more calls compounds the debt more frequently. Consequently, the snippet alone cannot determine an exact monthly charge without the call history and the index's fixed-point precision.
+
+## 1. July reconciliation
+
+The finance benchmark is simple 4.00% APR over 31 days:
+
+```text
+1,000,000 * 0.04 * 31 / 365
+= 3,397.260274 USDC
+```
+
+### Why Arbitrum did not charge roughly 48 times too much
+
+Arbitrum's roughly 250 ms L2 production cadence is not what the EVM `NUMBER` opcode exposes to this contract. On Arbitrum One, Solidity's `block.number` returns an approximation of the first non-Arbitrum ancestor's block number—Ethereum L1—not the Arbitrum child-chain height. The native Arbitrum height is available separately from `ArbSys(100).arbBlockNumber()`. The [Arbitrum documentation explains this distinction](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).
+
+Thus both deployments are effectively doing this over a long interval:
+
+```text
+change in Ethereum block height * 12 seconds
+```
+
+That is why they agree. Arbitrum may observe the approximate L1 number in delayed jumps, and many Arbitrum transactions can see the same `block.number`, but those effects are small at month scale.
+
+### Why both were slightly below 3,397 USDC
+
+Ethereum has 12-second **slots**, but not necessarily one block in every slot. Empty/missed slots consume wall-clock time without incrementing execution-layer block height. Ethereum's own [block documentation](https://ethereum.org/developers/docs/blocks/) explicitly notes that slots are 12 seconds and can be empty. Therefore `blocksElapsed * 12` normally understates elapsed wall time whenever slots are missed.
+
+For scale, treating the reported 3,391 USDC as an unrounded, single-period result implies:
+
+```text
+modeled seconds = 3,391 * 365 days / (1,000,000 * 0.04)
+                = 2,673,464.4 seconds
+
+modeled blocks  = 2,673,464.4 / 12
+                = 222,788.7 blocks
+
+ideal 31-day slots = 31 days / 12 seconds
+                   = 223,200 slots
+
+difference ≈ 411 blocks ≈ 4,936 seconds ≈ 82 minutes ≈ 0.184%
+```
+
+That magnitude is consistent with missed slots plus reconciliation endpoint placement and integer truncation. It is not possible to prove that missed slots alone account for the exact six-dollar difference from the information given. To reproduce the exact number, finance should retain the start/end timestamps and block numbers, every `accrueInterest()` call, the starting index, its scale, and the final rounding rule.
+
+Call cadence cannot by itself explain an undercharge: absent integer truncation, more calls increase the result. At perfect 31-day timing, one update gives 3,397.26 USDC, daily updates give about 3,402.85 USDC, and extremely frequent updates approach about 3,403.04 USDC. Integer division rounds each index increment down, but its dollar effect depends on the undisclosed index scale and number of calls.
+
+## 2. What happens on Base
+
+Base is an OP Stack chain. Its canonical L2 blocks are produced approximately every two seconds; the [Base documentation distinguishes two-second L2 blocks from 200 ms Flashblock preconfirmations](https://docs.base.org/base-chain/network-information/transaction-finality). Flashblocks do not make the contract's canonical block number advance every 200 ms. The OP Stack derivation rules also describe a [two-second L2 block interval](https://docs.base.org/base-chain/specs/protocol/consensus/derivation).
+
+For 31 days at two seconds per Base block:
+
+```text
+actual elapsed seconds = 31 * 86,400
+                       = 2,678,400
+
+Base blocks            = 2,678,400 / 2
+                       = 1,339,200
+
+seconds used by code   = 1,339,200 * 12
+                       = 16,070,400 seconds
+                       = 186 days
+```
+
+With one accrual covering the whole month, the charge is therefore:
+
+```text
+1,000,000 * 0.04 * 186 / 365
+= 20,383.561644 USDC
+```
+
+That is exactly six times the simple 31-day benchmark, or about **20,384 USDC** rather than 3,397 USDC.
+
+It is not an unconditional exact figure because the public function compounds on every call. Ignoring fixed-point truncation:
+
+- one call spanning the month: **20,383.56 USDC**;
+- one call per wall-clock day: about **20,585.89 USDC**;
+- calls every Base block: about **20,592.73 USDC**.
+
+An arbitrary real call schedule will produce a value between the single-period and frequent-call results, subject to downward integer rounding. Because anyone can call, an external party can influence the amount within that range.
+
+## Recommended change
+
+Replace the block-height clock with elapsed timestamps:
+
+```solidity
+uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+lastAccrualTimestamp = block.timestamp;
+```
+
+For month-scale interest, `block.timestamp` is the portable EVM clock. It still has chain-specific sequencer/validator constraints, but it measures seconds directly and does not embed a false block-time assumption.
+
+Also specify whether “4.00% per year” means simple APR or a compounded rate, then make the result independent of public call partitioning:
+
+- If it is simple APR, accrue from principal and elapsed time without repeatedly applying the rate to previously accrued interest merely because someone called the function.
+- If compounding is intended, use a documented fixed-period/per-second growth factor with full-precision fixed-point exponentiation so `growth(a + b) = growth(a) * growth(b)` apart from controlled rounding.
+
+Use full-precision `mulDiv`-style arithmetic with an explicit rounding policy, initialize the timestamp atomically at deployment, and test identical wall-clock intervals on every target chain. This removes both the Base six-times error and the caller-controlled compounding ambiguity.

codex
Completed the analysis in [answer.md](/tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002/answer.md).

Bottom line: Arbitrum accidentally tracks Ethereum block height, while Base would charge roughly 6× too much—about 20,384 USDC, potentially rising to about 20,593 depending on call frequency. The recommendation is to use timestamp-based, call-schedule-independent accrual.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f18a51da8f4c01aaee9733c6a53216c3f1283d49
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,104 @@
+# Fixed-rate accrual across Ethereum, Arbitrum, and Base
+
+## Conclusion
+
+Do **not** deploy this code unchanged to Base. On Arbitrum One, Solidity's `block.number` is approximately the Ethereum L1 block number, so the code accidentally behaves much like it does on mainnet. On Base, `block.number` is the Base L2 block number, which normally advances every two seconds. The hard-coded 12 seconds therefore makes time—and interest—run approximately six times too fast on Base.
+
+There is a second issue: the result depends on how often anyone calls `accrueInterest()`. Each update is linear for that interval, but it applies to an already-increased `index`, so splitting a period into more calls compounds the debt more frequently. Consequently, the snippet alone cannot determine an exact monthly charge without the call history and the index's fixed-point precision.
+
+## 1. July reconciliation
+
+The finance benchmark is simple 4.00% APR over 31 days:
+
+```text
+1,000,000 * 0.04 * 31 / 365
+= 3,397.260274 USDC
+```
+
+### Why Arbitrum did not charge roughly 48 times too much
+
+Arbitrum's roughly 250 ms L2 production cadence is not what the EVM `NUMBER` opcode exposes to this contract. On Arbitrum One, Solidity's `block.number` returns an approximation of the first non-Arbitrum ancestor's block number—Ethereum L1—not the Arbitrum child-chain height. The native Arbitrum height is available separately from `ArbSys(100).arbBlockNumber()`. The [Arbitrum documentation explains this distinction](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).
+
+Thus both deployments are effectively doing this over a long interval:
+
+```text
+change in Ethereum block height * 12 seconds
+```
+
+That is why they agree. Arbitrum may observe the approximate L1 number in delayed jumps, and many Arbitrum transactions can see the same `block.number`, but those effects are small at month scale.
+
+### Why both were slightly below 3,397 USDC
+
+Ethereum has 12-second **slots**, but not necessarily one block in every slot. Empty/missed slots consume wall-clock time without incrementing execution-layer block height. Ethereum's own [block documentation](https://ethereum.org/developers/docs/blocks/) explicitly notes that slots are 12 seconds and can be empty. Therefore `blocksElapsed * 12` normally understates elapsed wall time whenever slots are missed.
+
+For scale, treating the reported 3,391 USDC as an unrounded, single-period result implies:
+
+```text
+modeled seconds = 3,391 * 365 days / (1,000,000 * 0.04)
+                = 2,673,464.4 seconds
+
+modeled blocks  = 2,673,464.4 / 12
+                = 222,788.7 blocks
+
+ideal 31-day slots = 31 days / 12 seconds
+                   = 223,200 slots
+
+difference ≈ 411 blocks ≈ 4,936 seconds ≈ 82 minutes ≈ 0.184%
+```
+
+That magnitude is consistent with missed slots plus reconciliation endpoint placement and integer truncation. It is not possible to prove that missed slots alone account for the exact six-dollar difference from the information given. To reproduce the exact number, finance should retain the start/end timestamps and block numbers, every `accrueInterest()` call, the starting index, its scale, and the final rounding rule.
+
+Call cadence cannot by itself explain an undercharge: absent integer truncation, more calls increase the result. At perfect 31-day timing, one update gives 3,397.26 USDC, daily updates give about 3,402.85 USDC, and extremely frequent updates approach about 3,403.04 USDC. Integer division rounds each index increment down, but its dollar effect depends on the undisclosed index scale and number of calls.
+
+## 2. What happens on Base
+
+Base is an OP Stack chain. Its canonical L2 blocks are produced approximately every two seconds; the [Base documentation distinguishes two-second L2 blocks from 200 ms Flashblock preconfirmations](https://docs.base.org/base-chain/network-information/transaction-finality). Flashblocks do not make the contract's canonical block number advance every 200 ms. The OP Stack derivation rules also describe a [two-second L2 block interval](https://docs.base.org/base-chain/specs/protocol/consensus/derivation).
+
+For 31 days at two seconds per Base block:
+
+```text
+actual elapsed seconds = 31 * 86,400
+                       = 2,678,400
+
+Base blocks            = 2,678,400 / 2
+                       = 1,339,200
+
+seconds used by code   = 1,339,200 * 12
+                       = 16,070,400 seconds
+                       = 186 days
+```
+
+With one accrual covering the whole month, the charge is therefore:
+
+```text
+1,000,000 * 0.04 * 186 / 365
+= 20,383.561644 USDC
+```
+
+That is exactly six times the simple 31-day benchmark, or about **20,384 USDC** rather than 3,397 USDC.
+
+It is not an unconditional exact figure because the public function compounds on every call. Ignoring fixed-point truncation:
+
+- one call spanning the month: **20,383.56 USDC**;
+- one call per wall-clock day: about **20,585.89 USDC**;
+- calls every Base block: about **20,592.73 USDC**.
+
+An arbitrary real call schedule will produce a value between the single-period and frequent-call results, subject to downward integer rounding. Because anyone can call, an external party can influence the amount within that range.
+
+## Recommended change
+
+Replace the block-height clock with elapsed timestamps:
+
+```solidity
+uint256 elapsed = block.timestamp - lastAccrualTimestamp;
+lastAccrualTimestamp = block.timestamp;
+```
+
+For month-scale interest, `block.timestamp` is the portable EVM clock. It still has chain-specific sequencer/validator constraints, but it measures seconds directly and does not embed a false block-time assumption.
+
+Also specify whether “4.00% per year” means simple APR or a compounded rate, then make the result independent of public call partitioning:
+
+- If it is simple APR, accrue from principal and elapsed time without repeatedly applying the rate to previously accrued interest merely because someone called the function.
+- If compounding is intended, use a documented fixed-period/per-second growth factor with full-precision fixed-point exponentiation so `growth(a + b) = growth(a) * growth(b)` apart from controlled rounding.
+
+Use full-precision `mulDiv`-style arithmetic with an explicit rounding policy, initialize the timestamp atomically at deployment, and test identical wall-clock intervals on every target chain. This removes both the Base six-times error and the caller-controlled compounding ambiguity.

tokens used
62,325
````

## final message

Completed the analysis in [answer.md](/tmp/ethskills-audit-eval/2026-09-02T145923Z-codex-with-skill-1/audit-quiz-002/answer.md).

Bottom line: Arbitrum accidentally tracks Ethereum block height, while Base would charge roughly 6× too much—about 20,384 USDC, potentially rising to about 20,593 depending on call frequency. The recommendation is to use timestamp-based, call-schedule-independent accrual.
