# Executor transcript — 2026-09-02T152433Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a062b8-d353-7561-86dd-242c65fa16c8
--------
user
Support ticket I cannot close, and I need to know what to tell the user.

Our lending market lets a relayer submit a borrow that the borrower
authorised off-chain, so borrowers never need gas:

  bytes32 constant BORROW_TYPEHASH = keccak256("Borrow(address borrower,uint256 amount)");

  constructor(...) {
      DOMAIN_SEPARATOR = keccak256(abi.encode(
          keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
          keccak256("ArbiLend"),
          keccak256("1"),
          block.chainid,
          address(this)
      ));
  }

  function borrowWithSig(address borrower, uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
      bytes32 structHash = keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount));
      bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
      require(ecrecover(digest, v, r, s) == borrower, "bad sig");
      _borrow(borrower, amount);
  }

The user signed one borrow, 5,000 USDC, in March. They repaid it in full in
April and have signed nothing since. In June they woke up to a fresh 5,000
USDC debt against their collateral, opened while they were on a flight they
can produce a boarding pass for. The (v, r, s) in the June transaction's
calldata is byte-identical to the one from March. Our relayer operator says
they did not send it, and the June transaction came from an address none of
us recognise.

The user's position is that they only ever authorised one borrow, and the
verification looks right to me — the recovered address is genuinely theirs,
and no key was compromised on either side.

Explain how the June borrow was possible, what else this same construction
exposes us to that has not bitten us yet, and exactly what we ship to fix it.

Write your answer to answer.md in this directory.

2026-09-02T15:24:35.257768Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a062b8-d353-7561-86dd-242c65fa16c8.tmp-1788362675040753507: line 2547: syntax error near unexpected token `('

codex
I’m using the smart-contract audit skill because this is a signature/replay vulnerability analysis with a concrete remediation deliverable. I’ll inspect its checklist, then the workspace and write the support-ready answer.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/audit/SKILL.md" in /tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003
 succeeded in 0ms:
codex
The audit workflow calls for parallel checklist review. I’ll use focused signature, lending, and chain/domain-separation passes, while I independently synthesize the exact patch and migration guidance.
exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md' in /tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003
 succeeded in 268ms:
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
/bin/bash -lc 'for skill in evm-audit-general evm-audit-precision-math evm-audit-erc20 evm-audit-defi-lending evm-audit-signatures evm-audit-chain-specific; do curl -fsSL "https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/${skill}/references/checklist.md"; done' in /tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003
 succeeded in 1708ms:
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
# Weird ERC20 Token Security Checklist

Every known ERC20 edge case that can break protocols. Not basic "use SafeERC20" advice — specific token behaviors.

## Transfer Behavior Anomalies

- [ ] **Fee-on-transfer tokens (USDT on some chains, STA, PAXG, SAFEMOON)**: Tokens that deduct a fee on every transfer. The received amount ≠ sent amount. Any protocol that records `amount` from the function parameter instead of measuring `balanceAfter - balanceBefore` will have inflated internal accounting. Look for: `token.transferFrom(user, address(this), amount)` followed by recording `amount` as the deposit. [weird-erc20, beirao FT-06]

- [ ] **Rebasing tokens (stETH, AMPL, aTokens, OHM)**: Token balances change automatically without transfers. A protocol holding 100 stETH at time T may hold 101 stETH at time T+1 without any transaction. Internal accounting based on cached balances will drift from actual holdings. Look for: any internal balance tracking that doesn't periodically re-sync with actual `balanceOf`. [weird-erc20, beirao V-01]

- [ ] **Tokens that revert on zero-amount transfer (LEND, BNB)**: Some tokens revert when `transfer(to, 0)` is called. If a reward distribution or fee collection computes zero and then transfers, it causes DoS. Look for: transfer calls where the amount could be 0 in edge cases (empty rewards, rounding to zero). [beirao FT-12]

- [ ] **Tokens that revert on transfer to specific addresses (LUSD)**: LUSD reverts when transferring to certain addresses (its own address, zero address, pool addresses). Look for: protocols that transfer tokens to addresses derived from user input without whitelist checking. [beirao FT-15]

- [ ] **Multiple-address tokens (Synthetix SNX)**: Some tokens are accessible via multiple contract addresses (proxy + implementation, or multiple proxies). If your protocol tracks by token address, the same underlying token appears as different tokens. Look for: allowlists or mappings keyed by token address that could miss an alias. [beirao FT-05]

- [ ] **Flash-mintable tokens (DAI, any token with `flashMint`)**: Tokens supporting flash minting temporarily inflate `totalSupply` within a transaction. Any pricing formula using `totalSupply` (e.g., `price = reserves / totalSupply`) becomes manipulable. Look for: `totalSupply()` used in price or share calculations. [beirao FT-11]

- [ ] **Tokens with blocklists/blacklists (USDC, USDT, cUSDC)**: Transfer to/from blocklisted addresses reverts. If your contract or a user gets blocklisted, funds are permanently stuck. Look for: any protocol that holds user funds in a shared vault — if the vault address gets blocklisted, all users lose funds. [weird-erc20, beirao FT-04]

- [ ] **Tokens with transfer pausing (USDC, USDT, BNB)**: The token issuer can pause ALL transfers. If the collateral token is paused, users can't add collateral but can still be liquidated = unfair liquidation. Look for: collateral/debt tokens that have pause functionality and the protocol's behavior when transfers revert. [Decurity CDP checklist]

- [ ] **Tokens with admin minting/burning (centralized stablecoins)**: Token admins can mint unlimited tokens or burn from any address. A protocol using such a token as collateral faces unbounded dilution risk. Look for: collateral tokens where the admin can inflate supply. [weird-erc20]

## Approval & Allowance Edge Cases

- [ ] **USDT approve race condition**: USDT requires setting allowance to 0 before changing to a new non-zero value. `approve(spender, newAmount)` reverts if current allowance > 0 and newAmount > 0. Look for: `token.approve()` without first resetting to 0, especially on tokens that could be USDT. Fix: use `safeIncreaseAllowance` / `safeDecreaseAllowance`, or always approve(0) first. [beirao FT-02, weird-erc20]

- [ ] **BNB reverts on zero-amount approval**: Unlike USDT, BNB reverts when `approve(spender, 0)` is called. So the "always approve 0 first" pattern fails for BNB. Look for: generic approve-to-zero patterns in protocols supporting multiple tokens. [ERC4626 primer]

- [ ] **Infinite approval can be drained**: If a contract holds user approvals (e.g., a router), a bug in any function that calls `transferFrom` using those approvals can drain all approved tokens. Look for: contracts that receive approvals and make arbitrary calls or have complex transfer logic. [beirao FT-13]

## Missing Return Values

- [ ] **USDT on Ethereum has no return value on `transfer()`/`transferFrom()`**: The ERC20 spec says these should return `bool`, but USDT doesn't. Raw `.transfer()` calls will work, but wrapping in an interface that expects `bool` will revert. Look for: direct `IERC20(token).transfer()` calls without SafeERC20. [weird-erc20, multichain-auditor]

- [ ] **Different interfaces across chains**: USDT on Ethereum: no return value. USDT on Polygon: returns bool. Same token, different interface. Look for: hardcoded interface assumptions in multichain deployments. [multichain-auditor]

- [ ] **Solmate SafeTransferLib doesn't check contract existence**: Unlike OpenZeppelin's SafeERC20, Solmate's `safeTransfer()` returns success for calls to addresses with no code (EOAs, not-yet-deployed contracts). Look for: `import {SafeTransferLib}` from solmate where the token address could be invalid. [beirao FT-09]

## Decimal Quirks

- [ ] **Decimals vary across chains**: USDT/USDC = 6 decimals on Ethereum, 18 decimals on BSC. A protocol hardcoding `10**6` will break on BSC. Look for: hardcoded decimal values, especially `1e6`, `1e18`, or `10**decimals` with assumed values. [multichain-auditor]

- [ ] **Tokens with 0 decimals**: Some tokens use 0 decimals (indivisible). Math that divides by `10**decimals` divides by 1 (no-op) but rounding issues appear in share calculations. Look for: vault/share math that doesn't handle 0-decimal tokens. [weird-erc20]

- [ ] **Tokens with >18 decimals (e.g., YAM-V2 has 24)**: Multiplication of two such values can overflow uint256. Look for: `amount * price` or `amount * rate` calculations without overflow protection for high-decimal tokens. [weird-erc20]

- [ ] **`IERC20(address(0)).decimals()` reverts**: Calling `decimals()` on the zero address reverts. If a token address hasn't been set yet, this causes DoS. Look for: `decimals()` calls on potentially-unset token addresses. [beirao FT-10]

## ERC777 & Hook-Based Tokens

- [ ] **ERC777 tokens disguised as ERC20**: ERC777 is backward-compatible with ERC20. A protocol accepting "any ERC20" may receive an ERC777, enabling reentrancy via `tokensToSend` (before transfer) and `tokensReceived` (after transfer) hooks. Look for: protocols with open token allowlists that don't explicitly block ERC777. [beirao FT-08, Decurity AMM checklist]

- [ ] **ERC677 `transferAndCall` hooks**: Similar to ERC777, ERC677 tokens (like LINK) have a `transferAndCall` that triggers a callback. Look for: protocols interacting with LINK or other ERC677 tokens without reentrancy protection. [Decurity AMM checklist]

## Permit (ERC-2612) Edge Cases

- [ ] **DAI permit uses non-standard signature**: DAI's permit function has a different parameter ordering than ERC-2612. Code that assumes standard permit will fail on DAI. Look for: generic `permit()` wrappers that don't handle DAI's variant. [ERC4626 primer]

- [ ] **Missing `DOMAIN_SEPARATOR()` function**: Some tokens implementing permit lack the `DOMAIN_SEPARATOR()` getter. Look for: code that queries `DOMAIN_SEPARATOR()` on arbitrary tokens. [beirao FT-14]

- [ ] **Permit front-running griefing**: An attacker can front-run a permit transaction by copying the signature and submitting the permit themselves. The original user's subsequent `transferFrom` then succeeds (because allowance is set), but if the user's transaction was `permit + transferFrom` in one call, the permit part reverts with "invalid nonce". Look for: contracts that call permit in the same transaction as other operations. [weird-erc20]

## Protocol-Specific Token Behaviors

- [ ] **USDT is upgradeable on Polygon but immutable on Ethereum**: The same token may behave differently on different chains due to proxy status. Look for: assumptions about token immutability in multichain deployments. [multichain-auditor]

- [ ] **Gnosis Chain USDC/WETH/WBTC have post-transfer callbacks**: On Gnosis (formerly xDai), these tokens had transfer callbacks enabling reentrancy. The chain hard-forked to fix it. Look for: token interaction patterns that assume no callbacks exist for standard tokens on non-mainnet chains. [multichain-auditor]

- [ ] **Rebasing tokens in AMMs**: If a rebasing token is in an AMM pool, the pool doesn't update reserves on rebase. This creates an arbitrage opportunity where someone can extract the rebase yield from the pool. Look for: AMMs or vaults holding rebasing tokens without rebase tracking. [beirao AMM-04]

## Additional Weird ERC20 Behaviors (Expanded)

- [ ] **Tether Gold returns `false` even on success**: Some tokens declare `bool` return but return `false` regardless of transfer success. SafeERC20 patterns checking for `false` return will incorrectly revert. This makes it impossible to build a correct generic transfer wrapper for ALL tokens. Look for: protocols that treat `return false` as failure for all tokens. [weird-erc20]

- [ ] **UNI/COMP revert on amounts > uint96**: UNI and COMP use uint96 for internal balance tracking. `transfer()` and `approve()` revert if amount exceeds `type(uint96).max`. However, `approve(uint256(-1))` sets allowance to `type(uint96).max` as a special case. Look for: protocols that approve `type(uint256).max` and expect it to be reflected exactly in `allowance()`. [weird-erc20]

- [ ] **`transferFrom` with src==msg.sender has inconsistent behavior**: DSToken-style tokens skip allowance deduction when `from == msg.sender`, making `transferFrom(address(this), dst, amt)` equivalent to `transfer(dst, amt)`. OpenZeppelin/Uniswap always deducts allowance. Look for: contracts relying on consistent `transferFrom` allowance behavior. [weird-erc20]

- [ ] **cUSDCv3 `transfer(type(uint256).max)` only sends balance**: Some tokens treat `amount == type(uint256).max` as "transfer all my balance". A protocol that transfers a user-supplied `type(uint256).max` amount and credits the full value in storage will have inflated accounting. Look for: vault systems that don't verify received amounts via balance difference. [weird-erc20]

- [ ] **ERC20 representation of native currency (CELO, POL, zkSync ETH)**: Some chains have ERC20 wrappers for their native token at fixed addresses. A protocol interacting with both native ETH and ERC20 tokens on these chains must guard against double-spending where the same asset can be used as both native and ERC20. Led to critical Uniswap V4 vulnerability on Celo. Look for: protocols on Celo/Polygon/zkSync that accept both native + ERC20 without deduplication. [weird-erc20]

- [ ] **Non-string metadata fields (MKR uses bytes32)**: MKR's `name()` and `symbol()` return `bytes32` not `string`. Contracts that decode metadata as string will get garbage or revert. Look for: `IERC20Metadata(token).name()` calls on arbitrary tokens without try/catch. [weird-erc20]

- [ ] **USDC/USDT have different decimals on different chains**: USDT = 6 decimals on ETH, 18 on BSC. USDC = 6 on ETH, 18 on BSC. A cross-chain protocol using hardcoded decimals will miscalculate values. Look for: `decimals` assumptions in cross-chain or multichain deployments. [multichain-auditor]

- [ ] **Phantom functions on tokens without permit**: Tokens that don't implement `permit()` won't revert on low-level calls — the call succeeds as a no-op (phantom function). Code that calls `permit()` then `transferFrom()` may silently skip the permit. Look for: `try token.permit(...)` patterns that don't verify the permit actually set allowance. [weird-erc20]

- [ ] **Tokens that revert on transfer to self (address(token))**: LUSD and some tokens revert when you transfer to the token's own address. Look for: patterns where `token.transfer(address(token), amount)` could occur, e.g., when destination is derived from user input. [weird-erc20, beirao FT-15]
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
# Signature Security Checklist

## Cross-Chain & Cross-Protocol Replay

- [ ] **Missing chain ID in signature**: A valid signature on Ethereum can be replayed on Arbitrum, Polygon, etc. Every signature hash MUST include `block.chainid`. After hard forks (ETH/ETC split, EIP-155), old signatures without chain ID are valid on both chains. Look for: signature hash that doesn't include `block.chainid` or EIP-712 domain separator with `chainId`. [beirao S-01, SWC-121]

- [ ] **Missing `address(this)` in signature**: Same contract deployed at the same address on multiple chains (CREATE2 or same nonce) has identical verification. A signature valid for Contract A on chain 1 may be valid for Contract A on chain 2. Even on the SAME chain: if the same contract logic is deployed at two addresses, signatures for one instance replay on the other. Include `verifyingContract: address(this)` in domain separator. Look for: EIP-712 domain separator missing `verifyingContract`. [beirao S-02]

- [ ] **Missing `msg.sender` binding in signature**: If the signed message doesn't include the caller's address, anyone who obtains the signature can replay it as themselves. Look for: signature verification that doesn't validate `msg.sender == signer` or doesn't include intended caller in hash. [beirao S-06]

- [ ] **Nonce-less signatures are infinitely replayable**: Without a nonce, the same signature can be used to execute the same action forever. Look for: signature hash without a per-user incrementing nonce or deadline-only expiry. [beirao S-03]

- [ ] **Stale nonce check**: If nonce is checked but not incremented BEFORE the action, reentrancy can replay the same nonce. Increment nonce first, then execute. Look for: nonce increment after `call()` or `transfer()`. [beirao S-04]

## ecrecover Pitfalls

- [ ] **ecrecover returns address(0) for invalid signatures**: If `v` is invalid or `s` is out of range, `ecrecover` returns `address(0)` instead of reverting. If `address(0)` has permissions (e.g., as an uninitialized owner), the attacker gains access. Look for: `ecrecover(hash, v, r, s)` without checking `result != address(0)`. [beirao S-05, SWC-117]

- [ ] **Signature malleability**: For every valid `(r, s, v)` there's a second valid signature `(r, s', v')` where `s' = secp256k1.n - s`. Both recover to the same address. If signatures are used as unique identifiers (e.g., in a mapping), the second signature bypasses the "already used" check. Look for: signature hashes used as keys without canonicalizing `s` to the lower half-order. Fix: use OpenZeppelin ECDSA which enforces `s` in lower half. [beirao S-07, SWC-117]

- [ ] **Different encoding schemes produce different hashes**: `abi.encode` vs `abi.encodePacked` vs `keccak256(abi.encode(keccak256(abi.encode(...))))`. If the signer uses one encoding and the verifier uses another, the signature is invalid. Look for: encoding mismatches between frontend/backend signing and on-chain verification. [beirao S-08]

- [ ] **`abi.encodePacked` collision with dynamic types**: `abi.encodePacked` concatenates without padding. `abi.encodePacked("ab", "cd") == abi.encodePacked("a", "bcd")`. This creates signature collisions for different inputs. Look for: `abi.encodePacked` with multiple dynamic-length arguments (strings, bytes, arrays) in signature hashes. [SWC-133, beirao G-09]

## EIP-712 Typed Signatures

- [ ] **`DOMAIN_SEPARATOR` cached at deployment**: If `DOMAIN_SEPARATOR` is computed once in the constructor and cached, it contains the deployment chain's `block.chainid`. After a hard fork, the cached value is wrong on one chain. Must recompute if `block.chainid` changed. Look for: `immutable DOMAIN_SEPARATOR` without runtime chain ID check. [beirao S-09]

- [ ] **Struct hash must include ALL fields**: Omitting a field from the struct hash means it's not signed. An attacker can change the unsigned field freely. Look for: EIP-712 type hash that doesn't include all struct fields. [beirao S-10]

- [ ] **EIP-712 salt for unintended cross-protocol replay**: Two protocols using the same EIP-712 struct types can have signature replay between them. Using a unique `salt` in the domain separator prevents this. Look for: protocols with identical struct types and no differentiating domain parameter. [beirao S-11]

## Permit (ERC-2612) Specific

- [ ] **Permit front-running griefing (DoS)**: User creates permit signature → submits `permit()` + `transferFrom()` in one transaction → attacker front-runs by extracting the signature and calling `permit()` first → user's transaction reverts because the nonce was consumed. Fix: wrap permit in try/catch, or use separate transactions. Look for: `permit()` followed by `transferFrom()` in the same function without try/catch on permit. [beirao S-12, weird-erc20]

- [ ] **DAI non-standard permit**: DAI's permit function signature differs from ERC-2612: `permit(holder, spender, nonce, expiry, allowed, v, r, s)` vs `permit(owner, spender, value, deadline, v, r, s)`. Code calling standard permit on DAI will revert. Look for: generic permit wrappers without DAI special-casing. [beirao S-13]

- [ ] **Not all ERC20s support permit**: Tokens without EIP-2612 have no `permit()` function. Calling it reverts. Look for: mandatory permit calls on user-provided tokens. [beirao S-14]

## Meta-Transactions & Gas Abstraction

- [ ] **Trusted forwarder in ERC-2771**: When using meta-transactions, `_msgSender()` extracts the real sender from the last 20 bytes of calldata (appended by the trusted forwarder). If the forwarder doesn't properly validate signatures, anyone can forge the appended address. Look for: ERC-2771 recipient contracts with misconfigured or untrusted forwarders. [beirao S-15]

- [ ] **Gas griefing on relayed transactions**: A relayer can provide just enough gas to execute the outer call but not the inner forwarded call. The inner call fails silently, but the outer call succeeds and the nonce is consumed. The user's action didn't execute but can't be retried. Look for: relayed calls without gas sufficiency checks (EIP-150's 1/64th rule). [SWC-126]

## Smart Contract Signatures (ERC-1271)

- [ ] **`isValidSignature` called on non-contract address**: If `isValidSignature()` is called on an EOA (no code), the call returns empty data which may be interpreted as success. Look for: `isValidSignature` calls without `extcodesize` check on the verifying address. [ERC4337 checklist]

- [ ] **`isValidSignature` can be upgraded to accept anything**: If the contract implementing `isValidSignature` is upgradeable, a future upgrade could change the validation logic. Don't treat ERC-1271 signatures as permanently valid. Look for: timestamped or cached ERC-1271 validations that don't re-verify. [ERC4337 checklist]

## Signature Edge Cases (Expanded from Beirao/Multichain-Auditor)

- [ ] **Signature malleability with raw ecrecover**: Raw `ecrecover` accepts both `s` values (s and n-s) for the same signature, producing the same signer. An attacker can flip `s` to create a "different" signature that recovers to the same address. If signatures are used as unique identifiers (stored in a mapping), the attacker bypasses uniqueness checks. Fix: use OZ ECDSA library (latest version — earlier versions had their own bugs). Look for: direct `ecrecover()` calls without `s` value validation. [beirao S-02]

- [ ] **Recovered address of zero means invalid signature**: `ecrecover` returns `address(0)` for invalid signatures. If the expected signer is also `address(0)` (unset), the check passes. Always verify `recoveredAddress != address(0) && recoveredAddress == expectedSigner`. Look for: `ecrecover` result compared to a potentially-unset signer variable. [beirao S-03]

- [ ] **Signature used by wrong person**: If a signature doesn't bind to a specific authorized user, anyone who obtains the signature can use it. Look for: signed messages that don't include the intended `msg.sender` or authorized address. [beirao S-04]

- [ ] **Missing expiration / deadline in signatures**: Signatures without a deadline are valid forever. An old signature can be replayed years later. Look for: signed message schemas without a `deadline` or `expiry` field. [beirao S-05]

- [ ] **Cross-chain signature replay**: Signatures valid on one chain can be replayed on another if the chain ID isn't included. After chain forks (ETH/ETC), signatures without chain ID are valid on both chains. Look for: EIP-712 domains without `chainId`, or `chainId` computed once in constructor (breaks if chain forks). [multichain-auditor, beirao S-01]

- [ ] **EIP-712 `DOMAIN_SEPARATOR` cached in constructor breaks on fork**: If `DOMAIN_SEPARATOR` is computed in the constructor with the current `block.chainid`, it becomes invalid after a chain fork. Must recompute dynamically or use OZ's `_domainSeparatorV4()`. Look for: `DOMAIN_SEPARATOR` stored as `immutable` without runtime recomputation fallback. [multichain-auditor]

- [ ] **`abi.encodePacked` with multiple dynamic types causes hash collisions**: `abi.encodePacked("ab", "c")` == `abi.encodePacked("a", "bc")`. If signed message data uses `abi.encodePacked` with multiple dynamic types, two different messages can produce the same hash. Use `abi.encode` instead. Look for: `keccak256(abi.encodePacked(dynamic1, dynamic2))` in signature hashing. [beirao G-15, Tamjid C12]

---

## Dacian — Signature Replay Attacks (Phase 3)

- [ ] **Missing nonce allows KYC/privilege replay**: Signatures granting privileges (KYC status, whitelisting) without nonces can be replayed after revocation. User simply resubmits the original signature. Fix: include incrementing nonce in signature, store used nonces. [Source: Dacian — Signature Replay Attacks, Code4rena Ondo]

- [ ] **Cross-chain replay — UserOperation not signed with chain_id**: If `getHash()` for account abstraction operations doesn't include `block.chainid`, a valid signature from one chain can be replayed on another chain where the same contract exists at the same address. [Source: Dacian — Signature Replay Attacks, Code4rena Biconomy]

- [ ] **Missing parameter in signature allows fund drainage**: If `tokenGasPriceFactor` is used in refund calculation but not included in the signed message, the transaction submitter can set it to an arbitrarily large value to drain user funds while passing signature verification. [Source: Dacian — Signature Replay Attacks, Code4rena Biconomy]

- [ ] **No signature expiration grants lifetime license**: Without an expiration timestamp, a signed message remains valid forever. Even if a user's circumstances change, old signatures can be used indefinitely. Conform to EIP-712 with deadline. [Source: Dacian — Signature Replay Attacks, Sherlock NFTPort]

- [ ] **Unchecked ecrecover() return of address(0)**: `ecrecover()` returns address(0) for invalid signatures. If `require(o.maker == ecrecover(...))` is used and attacker passes `o.maker = address(0)`, the check passes for an invalid signature. Always verify recovered address != address(0). [Source: Dacian — Signature Replay Attacks, Code4rena Swivel]

- [ ] **Signature malleability — dual valid [v,r,s]**: Due to elliptic curve symmetry, for every valid [v,r,s] there exists another valid [v',r',s'] that passes `ecrecover()`. Use OpenZeppelin's ECDSA library (v4.7.3+) which restricts s to lower half-order. [Source: Dacian — Signature Replay Attacks]
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
/bin/bash -lc "pwd && rg --files -g '"'!answer.md'"' | sed -n '1,160p'" in /tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003
 succeeded in 5ms:
TASK.md
package.json

codex
The evidence is conclusive: this was a literal replay, not an account compromise. The identical signature is expected because repayment changes loan state but never consumes or invalidates the signed authorization. I’m writing the answer with immediate containment, customer language, and a V2 implementation that invalidates every legacy signature.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..e4fb7009df5fb33c386a24d1a7dc6b975db5b022
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,119 @@
+# Incident conclusion
+
+The June transaction was possible because the signature authenticates a borrow, but the contract never consumes that authorization.
+
+The signed digest is a deterministic function of only:
+
+- the EIP-712 domain;
+- `borrower`; and
+- `amount`.
+
+There is no nonce, authorization ID, used-digest flag, or expiry. The March transaction published the complete signature in public calldata. From then on, anyone could copy that calldata and call `borrowWithSig`. The function does not require `msg.sender` to be the protocol relayer, so the unknown address needed neither private key nor cooperation from the relayer; it only paid gas.
+
+Repayment does not affect signature validity. It merely restored the account's ability to borrow. Thus the same March authorization passed `ecrecover` again in June and `_borrow` created new debt. The byte-identical `(v,r,s)` is strong evidence of this exact replay. The boarding pass, the relayer's denial, and the absence of key compromise are all consistent with it.
+
+What to tell the customer:
+
+> We confirmed that the June debt was caused by a replay vulnerability in our gasless-borrow contract. Your March signature was valid, but our contract failed to mark it as used, so a third party could copy the public March transaction data and submit it again. This does not indicate that your wallet key was compromised, and you did not need to be online for the June transaction. We have disabled the affected path while we replace it. We are treating the duplicate debt and any resulting interest, fees, or collateral effects as a protocol incident and will remediate them under our incident policy.
+
+# Exposure beyond this incident
+
+This is not limited to one replay after one repayment:
+
+- Every successful historical V1 signature is public and remains valid forever.
+- A signature can be replayed repeatedly, including back-to-back, until collateral checks, liquidity, or borrow caps stop it. It becomes usable again after repayment, new collateral, or other restored capacity.
+- An attacker can force debt, worsen health factors, cause interest and liquidation penalties, consume market liquidity/caps, and potentially create bad debt or socialized losses.
+- Anyone can front-run the intended relayer. Rotating or securing the relayer does not fix a permissionless contract entry point.
+- There is no way in the current contract for a borrower to revoke an outstanding signature.
+- There is no deadline, so an authorization can execute years later under very different rates, collateral prices, or market conditions. A deadline limits staleness but does **not** replace a nonce.
+- Only `borrower` and `amount` are signed. Every value that can affect the action must be signed or fixed by code: at least the proceeds recipient, asset/market identifier, and any caller-selectable fee, rate mode, maximum rate, or slippage/terms bound. If `_borrow` sends proceeds to `msg.sender` or to an unsigned receiver, replay can be direct theft; if proceeds are forced to the borrower, it is still forced-debt and liquidation griefing.
+
+There are also two independent signature-hardening issues:
+
+1. Raw `ecrecover` accepts malleable high-`s` signatures. This did not cause the byte-identical June replay, but it means `used[keccak256(signatureBytes)]` is an unsafe patch: the alternate `(v,s)` form can represent the same authorization with different bytes. Track a nonce/authorization, not signature bytes, and use OpenZeppelin's canonical signature checks.
+2. Invalid `ecrecover` input returns `address(0)`. Because `borrower` is supplied by the caller, malformed input can satisfy the current comparison when `borrower == address(0)`. Reject the zero borrower and use a library that rejects invalid signatures.
+
+The existing domain does prevent ordinary replay on a different chain ID or contract address. However, caching the separator in the constructor is fragile across a chain split or chain-ID change: both sides retain the old separator, and the new chain does not dynamically adopt its new ID. Use OpenZeppelin `EIP712`, which rebuilds the separator when the chain ID changes. If this is a proxy, constructor-based domain storage is wrong for an additional reason; use `EIP712Upgradeable` and initialize the domain in proxy storage.
+
+# Immediate containment
+
+1. Pause or permanently disable the legacy `borrowWithSig` path immediately. Keep repayment and other risk-reducing operations available. If it cannot be paused independently, stop new borrowing in the affected market while preserving safe exits.
+2. Treat every V1 signature as exposed. Enumerate all past `borrowWithSig` calls, group identical digests, identify replays and affected accounts, and monitor attempts while containment completes.
+3. Do not try to fix this by changing relayers or by merely adding a V2 function. The V1 selector must become uncallable.
+4. Correct the user's replay-created debt and account for related interest, fees, liquidation loss, or collateral effects under the incident-response policy.
+
+# Code to ship
+
+For an EOA-only product, use OpenZeppelin `EIP712` and `ECDSA`. The replacement should have this shape (add all other execution-relevant fields before release):
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
+    );
+
+    mapping(address borrower => uint256 nonce) public borrowNonces;
+
+    constructor(/* ... */) EIP712("ArbiLend", "2") {
+        // ...
+    }
+
+    function borrowWithSig(
+        address borrower,
+        address receiver,
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        bytes calldata signature
+    ) external {
+        require(borrower != address(0), "zero borrower");
+        require(block.timestamp <= deadline, "expired");
+        require(nonce == borrowNonces[borrower], "bad nonce");
+
+        bytes32 structHash = keccak256(abi.encode(
+            BORROW_TYPEHASH,
+            borrower,
+            receiver,
+            amount,
+            nonce,
+            deadline
+        ));
+        bytes32 digest = _hashTypedDataV4(structHash);
+        require(ECDSA.recover(digest, signature) == borrower, "bad sig");
+
+        // Consume before _borrow or any external interaction. A revert rolls this back.
+        borrowNonces[borrower] = nonce + 1;
+        _borrow(borrower, receiver, amount);
+    }
+}
+```
+
+If proceeds must always go to the borrower, remove `receiver` from the API entirely and enforce that in `_borrow`; otherwise it must remain signed. Similarly add `asset`/`marketId` and every mutable economic term to both the type string and `abi.encode`, in exactly the same order and types.
+
+If smart-contract wallets are supported, replace `ECDSA.recover` with OpenZeppelin `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. Keep nonce consumption before `_borrow`, protect the full flow against reentrancy as appropriate, and do not cache ERC-1271 validity because a wallet's authorization logic can change.
+
+Add a borrower-controlled cancellation method that can advance the nonce, for example:
+
+```solidity
+function invalidateBorrowNonces(uint256 newNonce) external {
+    require(newNonce > borrowNonces[msg.sender], "nonce not advanced");
+    borrowNonces[msg.sender] = newNonce;
+}
+```
+
+Sequential nonces intentionally invalidate older pending requests when a later nonce is consumed or cancelled. If the product requires multiple independently executable outstanding requests, use unique authorization IDs with a used/cancelled mapping, or bitmap nonces, instead. In either design, consumption must be keyed by the signed authorization—not by signature bytes—and occur before external effects.
+
+Restricting submission to a designated relayer is optional product policy, not the replay fix. If required, enforce a relayer role on-chain or sign an `executor` field and require `msg.sender == executor`. Permissionless relaying is safe when the nonce prevents replay and every outcome-affecting field is signed or fixed.
+
+# Rollout requirements
+
+- Bump the EIP-712 version to `"2"`, change the type hash, and reject every V1 signature. Users must sign the new schema.
+- On an upgradeable proxy, use `EIP712Upgradeable`, append or namespace nonce storage without corrupting the existing layout, and atomically initialize/upgrade while disabling the legacy selector. Test against the deployed storage layout.
+- On an immutable deployment, deploy a new contract and actually disable, drain, or migrate the old market; a safe new contract does not neutralize the callable old one.
+- Update the signer UI so it displays the receiver, asset/market, amount, nonce, deadline, and economic bounds.
+- Consider a domain salt/epoch if the deployment model can recreate contract state at the same address and chain ID. It is defense in depth, not a substitute for nonce and deadline.
+
+Required regression tests include: second use of one signature; replay after repayment; two uses in one transaction/reentrant callback; expired and cancelled signatures; wrong nonce; altered amount/receiver/market/terms; wrong contract and chain domain; high-`s`, invalid-`v`, and zero-signer cases; ERC-1271 acceptance/rejection if supported; chain-ID-change domain behavior; and proof that all V1 calls fail after the upgrade.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..e4fb7009df5fb33c386a24d1a7dc6b975db5b022
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,119 @@
+# Incident conclusion
+
+The June transaction was possible because the signature authenticates a borrow, but the contract never consumes that authorization.
+
+The signed digest is a deterministic function of only:
+
+- the EIP-712 domain;
+- `borrower`; and
+- `amount`.
+
+There is no nonce, authorization ID, used-digest flag, or expiry. The March transaction published the complete signature in public calldata. From then on, anyone could copy that calldata and call `borrowWithSig`. The function does not require `msg.sender` to be the protocol relayer, so the unknown address needed neither private key nor cooperation from the relayer; it only paid gas.
+
+Repayment does not affect signature validity. It merely restored the account's ability to borrow. Thus the same March authorization passed `ecrecover` again in June and `_borrow` created new debt. The byte-identical `(v,r,s)` is strong evidence of this exact replay. The boarding pass, the relayer's denial, and the absence of key compromise are all consistent with it.
+
+What to tell the customer:
+
+> We confirmed that the June debt was caused by a replay vulnerability in our gasless-borrow contract. Your March signature was valid, but our contract failed to mark it as used, so a third party could copy the public March transaction data and submit it again. This does not indicate that your wallet key was compromised, and you did not need to be online for the June transaction. We have disabled the affected path while we replace it. We are treating the duplicate debt and any resulting interest, fees, or collateral effects as a protocol incident and will remediate them under our incident policy.
+
+# Exposure beyond this incident
+
+This is not limited to one replay after one repayment:
+
+- Every successful historical V1 signature is public and remains valid forever.
+- A signature can be replayed repeatedly, including back-to-back, until collateral checks, liquidity, or borrow caps stop it. It becomes usable again after repayment, new collateral, or other restored capacity.
+- An attacker can force debt, worsen health factors, cause interest and liquidation penalties, consume market liquidity/caps, and potentially create bad debt or socialized losses.
+- Anyone can front-run the intended relayer. Rotating or securing the relayer does not fix a permissionless contract entry point.
+- There is no way in the current contract for a borrower to revoke an outstanding signature.
+- There is no deadline, so an authorization can execute years later under very different rates, collateral prices, or market conditions. A deadline limits staleness but does **not** replace a nonce.
+- Only `borrower` and `amount` are signed. Every value that can affect the action must be signed or fixed by code: at least the proceeds recipient, asset/market identifier, and any caller-selectable fee, rate mode, maximum rate, or slippage/terms bound. If `_borrow` sends proceeds to `msg.sender` or to an unsigned receiver, replay can be direct theft; if proceeds are forced to the borrower, it is still forced-debt and liquidation griefing.
+
+There are also two independent signature-hardening issues:
+
+1. Raw `ecrecover` accepts malleable high-`s` signatures. This did not cause the byte-identical June replay, but it means `used[keccak256(signatureBytes)]` is an unsafe patch: the alternate `(v,s)` form can represent the same authorization with different bytes. Track a nonce/authorization, not signature bytes, and use OpenZeppelin's canonical signature checks.
+2. Invalid `ecrecover` input returns `address(0)`. Because `borrower` is supplied by the caller, malformed input can satisfy the current comparison when `borrower == address(0)`. Reject the zero borrower and use a library that rejects invalid signatures.
+
+The existing domain does prevent ordinary replay on a different chain ID or contract address. However, caching the separator in the constructor is fragile across a chain split or chain-ID change: both sides retain the old separator, and the new chain does not dynamically adopt its new ID. Use OpenZeppelin `EIP712`, which rebuilds the separator when the chain ID changes. If this is a proxy, constructor-based domain storage is wrong for an additional reason; use `EIP712Upgradeable` and initialize the domain in proxy storage.
+
+# Immediate containment
+
+1. Pause or permanently disable the legacy `borrowWithSig` path immediately. Keep repayment and other risk-reducing operations available. If it cannot be paused independently, stop new borrowing in the affected market while preserving safe exits.
+2. Treat every V1 signature as exposed. Enumerate all past `borrowWithSig` calls, group identical digests, identify replays and affected accounts, and monitor attempts while containment completes.
+3. Do not try to fix this by changing relayers or by merely adding a V2 function. The V1 selector must become uncallable.
+4. Correct the user's replay-created debt and account for related interest, fees, liquidation loss, or collateral effects under the incident-response policy.
+
+# Code to ship
+
+For an EOA-only product, use OpenZeppelin `EIP712` and `ECDSA`. The replacement should have this shape (add all other execution-relevant fields before release):
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
+    );
+
+    mapping(address borrower => uint256 nonce) public borrowNonces;
+
+    constructor(/* ... */) EIP712("ArbiLend", "2") {
+        // ...
+    }
+
+    function borrowWithSig(
+        address borrower,
+        address receiver,
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        bytes calldata signature
+    ) external {
+        require(borrower != address(0), "zero borrower");
+        require(block.timestamp <= deadline, "expired");
+        require(nonce == borrowNonces[borrower], "bad nonce");
+
+        bytes32 structHash = keccak256(abi.encode(
+            BORROW_TYPEHASH,
+            borrower,
+            receiver,
+            amount,
+            nonce,
+            deadline
+        ));
+        bytes32 digest = _hashTypedDataV4(structHash);
+        require(ECDSA.recover(digest, signature) == borrower, "bad sig");
+
+        // Consume before _borrow or any external interaction. A revert rolls this back.
+        borrowNonces[borrower] = nonce + 1;
+        _borrow(borrower, receiver, amount);
+    }
+}
+```
+
+If proceeds must always go to the borrower, remove `receiver` from the API entirely and enforce that in `_borrow`; otherwise it must remain signed. Similarly add `asset`/`marketId` and every mutable economic term to both the type string and `abi.encode`, in exactly the same order and types.
+
+If smart-contract wallets are supported, replace `ECDSA.recover` with OpenZeppelin `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. Keep nonce consumption before `_borrow`, protect the full flow against reentrancy as appropriate, and do not cache ERC-1271 validity because a wallet's authorization logic can change.
+
+Add a borrower-controlled cancellation method that can advance the nonce, for example:
+
+```solidity
+function invalidateBorrowNonces(uint256 newNonce) external {
+    require(newNonce > borrowNonces[msg.sender], "nonce not advanced");
+    borrowNonces[msg.sender] = newNonce;
+}
+```
+
+Sequential nonces intentionally invalidate older pending requests when a later nonce is consumed or cancelled. If the product requires multiple independently executable outstanding requests, use unique authorization IDs with a used/cancelled mapping, or bitmap nonces, instead. In either design, consumption must be keyed by the signed authorization—not by signature bytes—and occur before external effects.
+
+Restricting submission to a designated relayer is optional product policy, not the replay fix. If required, enforce a relayer role on-chain or sign an `executor` field and require `msg.sender == executor`. Permissionless relaying is safe when the nonce prevents replay and every outcome-affecting field is signed or fixed.
+
+# Rollout requirements
+
+- Bump the EIP-712 version to `"2"`, change the type hash, and reject every V1 signature. Users must sign the new schema.
+- On an upgradeable proxy, use `EIP712Upgradeable`, append or namespace nonce storage without corrupting the existing layout, and atomically initialize/upgrade while disabling the legacy selector. Test against the deployed storage layout.
+- On an immutable deployment, deploy a new contract and actually disable, drain, or migrate the old market; a safe new contract does not neutralize the callable old one.
+- Update the signer UI so it displays the receiver, asset/market, amount, nonce, deadline, and economic bounds.
+- Consider a domain salt/epoch if the deployment model can recreate contract state at the same address and chain ID. It is defense in depth, not a substitute for nonce and deadline.
+
+Required regression tests include: second use of one signature; replay after repayment; two uses in one transaction/reentrant callback; expired and cancelled signatures; wrong nonce; altered amount/receiver/market/terms; wrong contract and chain domain; high-`s`, invalid-`v`, and zero-signer cases; ERC-1271 acceptance/rejection if supported; chain-ID-change domain behavior; and proof that all V1 calls fail after the upgrade.

exec
/bin/bash -lc "wc -l answer.md && sed -n '1,260p' answer.md" in /tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
119 answer.md
# Incident conclusion

The June transaction was possible because the signature authenticates a borrow, but the contract never consumes that authorization.

The signed digest is a deterministic function of only:

- the EIP-712 domain;
- `borrower`; and
- `amount`.

There is no nonce, authorization ID, used-digest flag, or expiry. The March transaction published the complete signature in public calldata. From then on, anyone could copy that calldata and call `borrowWithSig`. The function does not require `msg.sender` to be the protocol relayer, so the unknown address needed neither private key nor cooperation from the relayer; it only paid gas.

Repayment does not affect signature validity. It merely restored the account's ability to borrow. Thus the same March authorization passed `ecrecover` again in June and `_borrow` created new debt. The byte-identical `(v,r,s)` is strong evidence of this exact replay. The boarding pass, the relayer's denial, and the absence of key compromise are all consistent with it.

What to tell the customer:

> We confirmed that the June debt was caused by a replay vulnerability in our gasless-borrow contract. Your March signature was valid, but our contract failed to mark it as used, so a third party could copy the public March transaction data and submit it again. This does not indicate that your wallet key was compromised, and you did not need to be online for the June transaction. We have disabled the affected path while we replace it. We are treating the duplicate debt and any resulting interest, fees, or collateral effects as a protocol incident and will remediate them under our incident policy.

# Exposure beyond this incident

This is not limited to one replay after one repayment:

- Every successful historical V1 signature is public and remains valid forever.
- A signature can be replayed repeatedly, including back-to-back, until collateral checks, liquidity, or borrow caps stop it. It becomes usable again after repayment, new collateral, or other restored capacity.
- An attacker can force debt, worsen health factors, cause interest and liquidation penalties, consume market liquidity/caps, and potentially create bad debt or socialized losses.
- Anyone can front-run the intended relayer. Rotating or securing the relayer does not fix a permissionless contract entry point.
- There is no way in the current contract for a borrower to revoke an outstanding signature.
- There is no deadline, so an authorization can execute years later under very different rates, collateral prices, or market conditions. A deadline limits staleness but does **not** replace a nonce.
- Only `borrower` and `amount` are signed. Every value that can affect the action must be signed or fixed by code: at least the proceeds recipient, asset/market identifier, and any caller-selectable fee, rate mode, maximum rate, or slippage/terms bound. If `_borrow` sends proceeds to `msg.sender` or to an unsigned receiver, replay can be direct theft; if proceeds are forced to the borrower, it is still forced-debt and liquidation griefing.

There are also two independent signature-hardening issues:

1. Raw `ecrecover` accepts malleable high-`s` signatures. This did not cause the byte-identical June replay, but it means `used[keccak256(signatureBytes)]` is an unsafe patch: the alternate `(v,s)` form can represent the same authorization with different bytes. Track a nonce/authorization, not signature bytes, and use OpenZeppelin's canonical signature checks.
2. Invalid `ecrecover` input returns `address(0)`. Because `borrower` is supplied by the caller, malformed input can satisfy the current comparison when `borrower == address(0)`. Reject the zero borrower and use a library that rejects invalid signatures.

The existing domain does prevent ordinary replay on a different chain ID or contract address. However, caching the separator in the constructor is fragile across a chain split or chain-ID change: both sides retain the old separator, and the new chain does not dynamically adopt its new ID. Use OpenZeppelin `EIP712`, which rebuilds the separator when the chain ID changes. If this is a proxy, constructor-based domain storage is wrong for an additional reason; use `EIP712Upgradeable` and initialize the domain in proxy storage.

# Immediate containment

1. Pause or permanently disable the legacy `borrowWithSig` path immediately. Keep repayment and other risk-reducing operations available. If it cannot be paused independently, stop new borrowing in the affected market while preserving safe exits.
2. Treat every V1 signature as exposed. Enumerate all past `borrowWithSig` calls, group identical digests, identify replays and affected accounts, and monitor attempts while containment completes.
3. Do not try to fix this by changing relayers or by merely adding a V2 function. The V1 selector must become uncallable.
4. Correct the user's replay-created debt and account for related interest, fees, liquidation loss, or collateral effects under the incident-response policy.

# Code to ship

For an EOA-only product, use OpenZeppelin `EIP712` and `ECDSA`. The replacement should have this shape (add all other execution-relevant fields before release):

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ArbiLend is EIP712 {
    bytes32 private constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    mapping(address borrower => uint256 nonce) public borrowNonces;

    constructor(/* ... */) EIP712("ArbiLend", "2") {
        // ...
    }

    function borrowWithSig(
        address borrower,
        address receiver,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(borrower != address(0), "zero borrower");
        require(block.timestamp <= deadline, "expired");
        require(nonce == borrowNonces[borrower], "bad nonce");

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH,
            borrower,
            receiver,
            amount,
            nonce,
            deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        require(ECDSA.recover(digest, signature) == borrower, "bad sig");

        // Consume before _borrow or any external interaction. A revert rolls this back.
        borrowNonces[borrower] = nonce + 1;
        _borrow(borrower, receiver, amount);
    }
}
```

If proceeds must always go to the borrower, remove `receiver` from the API entirely and enforce that in `_borrow`; otherwise it must remain signed. Similarly add `asset`/`marketId` and every mutable economic term to both the type string and `abi.encode`, in exactly the same order and types.

If smart-contract wallets are supported, replace `ECDSA.recover` with OpenZeppelin `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. Keep nonce consumption before `_borrow`, protect the full flow against reentrancy as appropriate, and do not cache ERC-1271 validity because a wallet's authorization logic can change.

Add a borrower-controlled cancellation method that can advance the nonce, for example:

```solidity
function invalidateBorrowNonces(uint256 newNonce) external {
    require(newNonce > borrowNonces[msg.sender], "nonce not advanced");
    borrowNonces[msg.sender] = newNonce;
}
```

Sequential nonces intentionally invalidate older pending requests when a later nonce is consumed or cancelled. If the product requires multiple independently executable outstanding requests, use unique authorization IDs with a used/cancelled mapping, or bitmap nonces, instead. In either design, consumption must be keyed by the signed authorization—not by signature bytes—and occur before external effects.

Restricting submission to a designated relayer is optional product policy, not the replay fix. If required, enforce a relayer role on-chain or sign an `executor` field and require `msg.sender == executor`. Permissionless relaying is safe when the nonce prevents replay and every outcome-affecting field is signed or fixed.

# Rollout requirements

- Bump the EIP-712 version to `"2"`, change the type hash, and reject every V1 signature. Users must sign the new schema.
- On an upgradeable proxy, use `EIP712Upgradeable`, append or namespace nonce storage without corrupting the existing layout, and atomically initialize/upgrade while disabling the legacy selector. Test against the deployed storage layout.
- On an immutable deployment, deploy a new contract and actually disable, drain, or migrate the old market; a safe new contract does not neutralize the callable old one.
- Update the signer UI so it displays the receiver, asset/market, amount, nonce, deadline, and economic bounds.
- Consider a domain salt/epoch if the deployment model can recreate contract state at the same address and chain ID. It is defense in depth, not a substitute for nonce and deadline.

Required regression tests include: second use of one signature; replay after repayment; two uses in one transaction/reentrant callback; expired and cancelled signatures; wrong nonce; altered amount/receiver/market/terms; wrong contract and chain domain; high-`s`, invalid-`v`, and zero-signer cases; ERC-1271 acceptance/rejection if supported; chain-ID-change domain behavior; and proof that all V1 calls fail after the upgrade.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..e4fb7009df5fb33c386a24d1a7dc6b975db5b022
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,119 @@
+# Incident conclusion
+
+The June transaction was possible because the signature authenticates a borrow, but the contract never consumes that authorization.
+
+The signed digest is a deterministic function of only:
+
+- the EIP-712 domain;
+- `borrower`; and
+- `amount`.
+
+There is no nonce, authorization ID, used-digest flag, or expiry. The March transaction published the complete signature in public calldata. From then on, anyone could copy that calldata and call `borrowWithSig`. The function does not require `msg.sender` to be the protocol relayer, so the unknown address needed neither private key nor cooperation from the relayer; it only paid gas.
+
+Repayment does not affect signature validity. It merely restored the account's ability to borrow. Thus the same March authorization passed `ecrecover` again in June and `_borrow` created new debt. The byte-identical `(v,r,s)` is strong evidence of this exact replay. The boarding pass, the relayer's denial, and the absence of key compromise are all consistent with it.
+
+What to tell the customer:
+
+> We confirmed that the June debt was caused by a replay vulnerability in our gasless-borrow contract. Your March signature was valid, but our contract failed to mark it as used, so a third party could copy the public March transaction data and submit it again. This does not indicate that your wallet key was compromised, and you did not need to be online for the June transaction. We have disabled the affected path while we replace it. We are treating the duplicate debt and any resulting interest, fees, or collateral effects as a protocol incident and will remediate them under our incident policy.
+
+# Exposure beyond this incident
+
+This is not limited to one replay after one repayment:
+
+- Every successful historical V1 signature is public and remains valid forever.
+- A signature can be replayed repeatedly, including back-to-back, until collateral checks, liquidity, or borrow caps stop it. It becomes usable again after repayment, new collateral, or other restored capacity.
+- An attacker can force debt, worsen health factors, cause interest and liquidation penalties, consume market liquidity/caps, and potentially create bad debt or socialized losses.
+- Anyone can front-run the intended relayer. Rotating or securing the relayer does not fix a permissionless contract entry point.
+- There is no way in the current contract for a borrower to revoke an outstanding signature.
+- There is no deadline, so an authorization can execute years later under very different rates, collateral prices, or market conditions. A deadline limits staleness but does **not** replace a nonce.
+- Only `borrower` and `amount` are signed. Every value that can affect the action must be signed or fixed by code: at least the proceeds recipient, asset/market identifier, and any caller-selectable fee, rate mode, maximum rate, or slippage/terms bound. If `_borrow` sends proceeds to `msg.sender` or to an unsigned receiver, replay can be direct theft; if proceeds are forced to the borrower, it is still forced-debt and liquidation griefing.
+
+There are also two independent signature-hardening issues:
+
+1. Raw `ecrecover` accepts malleable high-`s` signatures. This did not cause the byte-identical June replay, but it means `used[keccak256(signatureBytes)]` is an unsafe patch: the alternate `(v,s)` form can represent the same authorization with different bytes. Track a nonce/authorization, not signature bytes, and use OpenZeppelin's canonical signature checks.
+2. Invalid `ecrecover` input returns `address(0)`. Because `borrower` is supplied by the caller, malformed input can satisfy the current comparison when `borrower == address(0)`. Reject the zero borrower and use a library that rejects invalid signatures.
+
+The existing domain does prevent ordinary replay on a different chain ID or contract address. However, caching the separator in the constructor is fragile across a chain split or chain-ID change: both sides retain the old separator, and the new chain does not dynamically adopt its new ID. Use OpenZeppelin `EIP712`, which rebuilds the separator when the chain ID changes. If this is a proxy, constructor-based domain storage is wrong for an additional reason; use `EIP712Upgradeable` and initialize the domain in proxy storage.
+
+# Immediate containment
+
+1. Pause or permanently disable the legacy `borrowWithSig` path immediately. Keep repayment and other risk-reducing operations available. If it cannot be paused independently, stop new borrowing in the affected market while preserving safe exits.
+2. Treat every V1 signature as exposed. Enumerate all past `borrowWithSig` calls, group identical digests, identify replays and affected accounts, and monitor attempts while containment completes.
+3. Do not try to fix this by changing relayers or by merely adding a V2 function. The V1 selector must become uncallable.
+4. Correct the user's replay-created debt and account for related interest, fees, liquidation loss, or collateral effects under the incident-response policy.
+
+# Code to ship
+
+For an EOA-only product, use OpenZeppelin `EIP712` and `ECDSA`. The replacement should have this shape (add all other execution-relevant fields before release):
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
+    );
+
+    mapping(address borrower => uint256 nonce) public borrowNonces;
+
+    constructor(/* ... */) EIP712("ArbiLend", "2") {
+        // ...
+    }
+
+    function borrowWithSig(
+        address borrower,
+        address receiver,
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        bytes calldata signature
+    ) external {
+        require(borrower != address(0), "zero borrower");
+        require(block.timestamp <= deadline, "expired");
+        require(nonce == borrowNonces[borrower], "bad nonce");
+
+        bytes32 structHash = keccak256(abi.encode(
+            BORROW_TYPEHASH,
+            borrower,
+            receiver,
+            amount,
+            nonce,
+            deadline
+        ));
+        bytes32 digest = _hashTypedDataV4(structHash);
+        require(ECDSA.recover(digest, signature) == borrower, "bad sig");
+
+        // Consume before _borrow or any external interaction. A revert rolls this back.
+        borrowNonces[borrower] = nonce + 1;
+        _borrow(borrower, receiver, amount);
+    }
+}
+```
+
+If proceeds must always go to the borrower, remove `receiver` from the API entirely and enforce that in `_borrow`; otherwise it must remain signed. Similarly add `asset`/`marketId` and every mutable economic term to both the type string and `abi.encode`, in exactly the same order and types.
+
+If smart-contract wallets are supported, replace `ECDSA.recover` with OpenZeppelin `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. Keep nonce consumption before `_borrow`, protect the full flow against reentrancy as appropriate, and do not cache ERC-1271 validity because a wallet's authorization logic can change.
+
+Add a borrower-controlled cancellation method that can advance the nonce, for example:
+
+```solidity
+function invalidateBorrowNonces(uint256 newNonce) external {
+    require(newNonce > borrowNonces[msg.sender], "nonce not advanced");
+    borrowNonces[msg.sender] = newNonce;
+}
+```
+
+Sequential nonces intentionally invalidate older pending requests when a later nonce is consumed or cancelled. If the product requires multiple independently executable outstanding requests, use unique authorization IDs with a used/cancelled mapping, or bitmap nonces, instead. In either design, consumption must be keyed by the signed authorization—not by signature bytes—and occur before external effects.
+
+Restricting submission to a designated relayer is optional product policy, not the replay fix. If required, enforce a relayer role on-chain or sign an `executor` field and require `msg.sender == executor`. Permissionless relaying is safe when the nonce prevents replay and every outcome-affecting field is signed or fixed.
+
+# Rollout requirements
+
+- Bump the EIP-712 version to `"2"`, change the type hash, and reject every V1 signature. Users must sign the new schema.
+- On an upgradeable proxy, use `EIP712Upgradeable`, append or namespace nonce storage without corrupting the existing layout, and atomically initialize/upgrade while disabling the legacy selector. Test against the deployed storage layout.
+- On an immutable deployment, deploy a new contract and actually disable, drain, or migrate the old market; a safe new contract does not neutralize the callable old one.
+- Update the signer UI so it displays the receiver, asset/market, amount, nonce, deadline, and economic bounds.
+- Consider a domain salt/epoch if the deployment model can recreate contract state at the same address and chain ID. It is defense in depth, not a substitute for nonce and deadline.
+
+Required regression tests include: second use of one signature; replay after repayment; two uses in one transaction/reentrant callback; expired and cancelled signatures; wrong nonce; altered amount/receiver/market/terms; wrong contract and chain domain; high-`s`, invalid-`v`, and zero-signer cases; ERC-1271 acceptance/rejection if supported; chain-ID-change domain behavior; and proof that all V1 calls fail after the upgrade.

apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..28bd546bdeadd38aa7eb8bd2c4a4b0b59360cdb6
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,119 @@
+# Incident conclusion
+
+The June transaction was possible because the signature authenticates a borrow, but the contract never consumes that authorization.
+
+The signed digest is a deterministic function of only:
+
+- the EIP-712 domain;
+- `borrower`; and
+- `amount`.
+
+There is no nonce, authorization ID, used-digest flag, or expiry. The March transaction published the complete signature in public calldata. From then on, anyone could copy that calldata and call `borrowWithSig`. The function does not require `msg.sender` to be the protocol relayer, so the unknown address needed neither private key nor cooperation from the relayer; it only paid gas.
+
+Repayment does not affect signature validity. It merely restored the account's ability to borrow. Thus the same March authorization passed `ecrecover` again in June and `_borrow` created new debt. The byte-identical `(v,r,s)` is strong evidence of this exact replay. The boarding pass, the relayer's denial, and the absence of key compromise are all consistent with it.
+
+What to tell the customer:
+
+> We confirmed that the June debt was caused by a replay vulnerability in our gasless-borrow contract. Your March signature was valid, but our contract failed to mark it as used, so a third party could copy the public March transaction data and submit it again. This does not indicate that your wallet key was compromised, and you did not need to be online for the June transaction. We have disabled the affected path while we replace it. We are treating the duplicate debt and any resulting interest, fees, or collateral effects as a protocol incident and will remediate them under our incident policy.
+
+# Exposure beyond this incident
+
+This is not limited to one replay after one repayment:
+
+- Every successful historical V1 signature is public and remains valid forever.
+- A signature can be replayed repeatedly, including back-to-back, until collateral checks, liquidity, or borrow caps stop it. It becomes usable again after repayment, new collateral, or other restored capacity.
+- An attacker can force debt, worsen health factors, cause interest and liquidation penalties, consume market liquidity/caps, and potentially create bad debt or socialized losses.
+- Anyone can front-run the intended relayer. Rotating or securing the relayer does not fix a permissionless contract entry point.
+- There is no way in the current contract for a borrower to revoke an outstanding signature.
+- There is no deadline, so an authorization can execute years later under very different rates, collateral prices, or market conditions. A deadline limits staleness but does **not** replace a nonce.
+- Only `borrower` and `amount` are signed. Every value that can affect the action must be signed or fixed by code: at least the proceeds recipient, asset/market identifier, and any caller-selectable fee, rate mode, maximum rate, or slippage/terms bound. If `_borrow` sends proceeds to `msg.sender` or to an unsigned receiver, replay can be direct theft; if proceeds are forced to the borrower, it is still forced-debt and liquidation griefing.
+
+There are also two independent signature-hardening issues:
+
+1. Raw `ecrecover` accepts malleable high-`s` signatures. This did not cause the byte-identical June replay, but it means `used[keccak256(signatureBytes)]` is an unsafe patch: the alternate `(v,s)` form can represent the same authorization with different bytes. Track a nonce/authorization, not signature bytes, and use OpenZeppelin's canonical signature checks.
+2. Invalid `ecrecover` input returns `address(0)`. Because `borrower` is supplied by the caller, malformed input can satisfy the current comparison when `borrower == address(0)`. Reject the zero borrower and use a library that rejects invalid signatures.
+
+The existing domain does prevent ordinary replay on a different chain ID or contract address. However, caching the separator in the constructor is fragile across a chain split or chain-ID change: both sides retain the old separator, and the new chain does not dynamically adopt its new ID. Use OpenZeppelin `EIP712`, which rebuilds the separator when the chain ID changes. If this is a proxy, constructor-based domain storage is wrong for an additional reason; use `EIP712Upgradeable` and initialize the domain in proxy storage.
+
+# Immediate containment
+
+1. Pause or permanently disable the legacy `borrowWithSig` path immediately. Keep repayment and other risk-reducing operations available. If it cannot be paused independently, stop new borrowing in the affected market while preserving safe exits.
+2. Treat every V1 signature as exposed. Enumerate all past `borrowWithSig` calls, group identical digests, identify replays and affected accounts, and monitor attempts while containment completes.
+3. Do not try to fix this by changing relayers or by merely adding a V2 function. The V1 selector must become uncallable.
+4. Correct the user's replay-created debt and account for related interest, fees, liquidation loss, or collateral effects under the incident-response policy.
+
+# Code to ship
+
+For an EOA-only product, use OpenZeppelin `EIP712` and `ECDSA`. The replacement should have this shape (add all other execution-relevant fields before release):
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
+    );
+
+    mapping(address borrower => uint256 nonce) public borrowNonces;
+
+    constructor(/* ... */) EIP712("ArbiLend", "2") {
+        // ...
+    }
+
+    function borrowWithSig(
+        address borrower,
+        address receiver,
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        bytes calldata signature
+    ) external {
+        require(borrower != address(0), "zero borrower");
+        require(block.timestamp <= deadline, "expired");
+        require(nonce == borrowNonces[borrower], "bad nonce");
+
+        bytes32 structHash = keccak256(abi.encode(
+            BORROW_TYPEHASH,
+            borrower,
+            receiver,
+            amount,
+            nonce,
+            deadline
+        ));
+        bytes32 digest = _hashTypedDataV4(structHash);
+        require(ECDSA.recover(digest, signature) == borrower, "bad sig");
+
+        // Consume before _borrow or any external interaction. A revert rolls this back.
+        borrowNonces[borrower] = nonce + 1;
+        _borrow(borrower, receiver, amount);
+    }
+}
+```
+
+If proceeds must always go to the borrower, remove `receiver` from the API entirely and enforce that in `_borrow`; otherwise it must remain signed. Similarly add `asset`/`marketId` and every mutable economic term to both the type string and `abi.encode`, in exactly the same order and types.
+
+If smart-contract wallets are supported, replace `ECDSA.recover` with OpenZeppelin `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. ERC-1271 validation is itself an external call: increment the checked nonce **before** calling `SignatureChecker` (a failed check reverts the increment), and use a reentrancy guard as defense in depth. Do not cache ERC-1271 validity because a wallet's authorization logic can change.
+
+Add a borrower-controlled cancellation method that can advance the nonce, for example:
+
+```solidity
+function invalidateBorrowNonces(uint256 newNonce) external {
+    require(newNonce > borrowNonces[msg.sender], "nonce not advanced");
+    borrowNonces[msg.sender] = newNonce;
+}
+```
+
+Sequential nonces intentionally invalidate older pending requests when a later nonce is consumed or cancelled. If the product requires multiple independently executable outstanding requests, use unique authorization IDs with a used/cancelled mapping, or bitmap nonces, instead. In either design, consumption must be keyed by the signed authorization—not by signature bytes—and occur before external effects.
+
+Restricting submission to a designated relayer is optional product policy, not the replay fix. If required, enforce a relayer role on-chain or sign an `executor` field and require `msg.sender == executor`. Permissionless relaying is safe when the nonce prevents replay and every outcome-affecting field is signed or fixed.
+
+# Rollout requirements
+
+- Bump the EIP-712 version to `"2"`, change the type hash, and reject every V1 signature. Users must sign the new schema.
+- On an upgradeable proxy, use `EIP712Upgradeable`, append or namespace nonce storage without corrupting the existing layout, and atomically initialize/upgrade while disabling the legacy selector. Test against the deployed storage layout.
+- On an immutable deployment, deploy a new contract and actually disable, drain, or migrate the old market; a safe new contract does not neutralize the callable old one.
+- Update the signer UI so it displays the receiver, asset/market, amount, nonce, deadline, and economic bounds.
+- Consider a domain salt/epoch if the deployment model can recreate contract state at the same address and chain ID. It is defense in depth, not a substitute for nonce and deadline.
+
+Required regression tests include: second use of one signature; replay after repayment; two uses in one transaction/reentrant callback; expired and cancelled signatures; wrong nonce; altered amount/receiver/market/terms; wrong contract and chain domain; high-`s`, invalid-`v`, and zero-signer cases; ERC-1271 acceptance/rejection if supported; chain-ID-change domain behavior; and proof that all V1 calls fail after the upgrade.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..28bd546bdeadd38aa7eb8bd2c4a4b0b59360cdb6
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,119 @@
+# Incident conclusion
+
+The June transaction was possible because the signature authenticates a borrow, but the contract never consumes that authorization.
+
+The signed digest is a deterministic function of only:
+
+- the EIP-712 domain;
+- `borrower`; and
+- `amount`.
+
+There is no nonce, authorization ID, used-digest flag, or expiry. The March transaction published the complete signature in public calldata. From then on, anyone could copy that calldata and call `borrowWithSig`. The function does not require `msg.sender` to be the protocol relayer, so the unknown address needed neither private key nor cooperation from the relayer; it only paid gas.
+
+Repayment does not affect signature validity. It merely restored the account's ability to borrow. Thus the same March authorization passed `ecrecover` again in June and `_borrow` created new debt. The byte-identical `(v,r,s)` is strong evidence of this exact replay. The boarding pass, the relayer's denial, and the absence of key compromise are all consistent with it.
+
+What to tell the customer:
+
+> We confirmed that the June debt was caused by a replay vulnerability in our gasless-borrow contract. Your March signature was valid, but our contract failed to mark it as used, so a third party could copy the public March transaction data and submit it again. This does not indicate that your wallet key was compromised, and you did not need to be online for the June transaction. We have disabled the affected path while we replace it. We are treating the duplicate debt and any resulting interest, fees, or collateral effects as a protocol incident and will remediate them under our incident policy.
+
+# Exposure beyond this incident
+
+This is not limited to one replay after one repayment:
+
+- Every successful historical V1 signature is public and remains valid forever.
+- A signature can be replayed repeatedly, including back-to-back, until collateral checks, liquidity, or borrow caps stop it. It becomes usable again after repayment, new collateral, or other restored capacity.
+- An attacker can force debt, worsen health factors, cause interest and liquidation penalties, consume market liquidity/caps, and potentially create bad debt or socialized losses.
+- Anyone can front-run the intended relayer. Rotating or securing the relayer does not fix a permissionless contract entry point.
+- There is no way in the current contract for a borrower to revoke an outstanding signature.
+- There is no deadline, so an authorization can execute years later under very different rates, collateral prices, or market conditions. A deadline limits staleness but does **not** replace a nonce.
+- Only `borrower` and `amount` are signed. Every value that can affect the action must be signed or fixed by code: at least the proceeds recipient, asset/market identifier, and any caller-selectable fee, rate mode, maximum rate, or slippage/terms bound. If `_borrow` sends proceeds to `msg.sender` or to an unsigned receiver, replay can be direct theft; if proceeds are forced to the borrower, it is still forced-debt and liquidation griefing.
+
+There are also two independent signature-hardening issues:
+
+1. Raw `ecrecover` accepts malleable high-`s` signatures. This did not cause the byte-identical June replay, but it means `used[keccak256(signatureBytes)]` is an unsafe patch: the alternate `(v,s)` form can represent the same authorization with different bytes. Track a nonce/authorization, not signature bytes, and use OpenZeppelin's canonical signature checks.
+2. Invalid `ecrecover` input returns `address(0)`. Because `borrower` is supplied by the caller, malformed input can satisfy the current comparison when `borrower == address(0)`. Reject the zero borrower and use a library that rejects invalid signatures.
+
+The existing domain does prevent ordinary replay on a different chain ID or contract address. However, caching the separator in the constructor is fragile across a chain split or chain-ID change: both sides retain the old separator, and the new chain does not dynamically adopt its new ID. Use OpenZeppelin `EIP712`, which rebuilds the separator when the chain ID changes. If this is a proxy, constructor-based domain storage is wrong for an additional reason; use `EIP712Upgradeable` and initialize the domain in proxy storage.
+
+# Immediate containment
+
+1. Pause or permanently disable the legacy `borrowWithSig` path immediately. Keep repayment and other risk-reducing operations available. If it cannot be paused independently, stop new borrowing in the affected market while preserving safe exits.
+2. Treat every V1 signature as exposed. Enumerate all past `borrowWithSig` calls, group identical digests, identify replays and affected accounts, and monitor attempts while containment completes.
+3. Do not try to fix this by changing relayers or by merely adding a V2 function. The V1 selector must become uncallable.
+4. Correct the user's replay-created debt and account for related interest, fees, liquidation loss, or collateral effects under the incident-response policy.
+
+# Code to ship
+
+For an EOA-only product, use OpenZeppelin `EIP712` and `ECDSA`. The replacement should have this shape (add all other execution-relevant fields before release):
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
+    );
+
+    mapping(address borrower => uint256 nonce) public borrowNonces;
+
+    constructor(/* ... */) EIP712("ArbiLend", "2") {
+        // ...
+    }
+
+    function borrowWithSig(
+        address borrower,
+        address receiver,
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        bytes calldata signature
+    ) external {
+        require(borrower != address(0), "zero borrower");
+        require(block.timestamp <= deadline, "expired");
+        require(nonce == borrowNonces[borrower], "bad nonce");
+
+        bytes32 structHash = keccak256(abi.encode(
+            BORROW_TYPEHASH,
+            borrower,
+            receiver,
+            amount,
+            nonce,
+            deadline
+        ));
+        bytes32 digest = _hashTypedDataV4(structHash);
+        require(ECDSA.recover(digest, signature) == borrower, "bad sig");
+
+        // Consume before _borrow or any external interaction. A revert rolls this back.
+        borrowNonces[borrower] = nonce + 1;
+        _borrow(borrower, receiver, amount);
+    }
+}
+```
+
+If proceeds must always go to the borrower, remove `receiver` from the API entirely and enforce that in `_borrow`; otherwise it must remain signed. Similarly add `asset`/`marketId` and every mutable economic term to both the type string and `abi.encode`, in exactly the same order and types.
+
+If smart-contract wallets are supported, replace `ECDSA.recover` with OpenZeppelin `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. ERC-1271 validation is itself an external call: increment the checked nonce **before** calling `SignatureChecker` (a failed check reverts the increment), and use a reentrancy guard as defense in depth. Do not cache ERC-1271 validity because a wallet's authorization logic can change.
+
+Add a borrower-controlled cancellation method that can advance the nonce, for example:
+
+```solidity
+function invalidateBorrowNonces(uint256 newNonce) external {
+    require(newNonce > borrowNonces[msg.sender], "nonce not advanced");
+    borrowNonces[msg.sender] = newNonce;
+}
+```
+
+Sequential nonces intentionally invalidate older pending requests when a later nonce is consumed or cancelled. If the product requires multiple independently executable outstanding requests, use unique authorization IDs with a used/cancelled mapping, or bitmap nonces, instead. In either design, consumption must be keyed by the signed authorization—not by signature bytes—and occur before external effects.
+
+Restricting submission to a designated relayer is optional product policy, not the replay fix. If required, enforce a relayer role on-chain or sign an `executor` field and require `msg.sender == executor`. Permissionless relaying is safe when the nonce prevents replay and every outcome-affecting field is signed or fixed.
+
+# Rollout requirements
+
+- Bump the EIP-712 version to `"2"`, change the type hash, and reject every V1 signature. Users must sign the new schema.
+- On an upgradeable proxy, use `EIP712Upgradeable`, append or namespace nonce storage without corrupting the existing layout, and atomically initialize/upgrade while disabling the legacy selector. Test against the deployed storage layout.
+- On an immutable deployment, deploy a new contract and actually disable, drain, or migrate the old market; a safe new contract does not neutralize the callable old one.
+- Update the signer UI so it displays the receiver, asset/market, amount, nonce, deadline, and economic bounds.
+- Consider a domain salt/epoch if the deployment model can recreate contract state at the same address and chain ID. It is defense in depth, not a substitute for nonce and deadline.
+
+Required regression tests include: second use of one signature; replay after repayment; two uses in one transaction/reentrant callback; expired and cancelled signatures; wrong nonce; altered amount/receiver/market/terms; wrong contract and chain domain; high-`s`, invalid-`v`, and zero-signer cases; ERC-1271 acceptance/rejection if supported; chain-ID-change domain behavior; and proof that all V1 calls fail after the upgrade.

exec
/bin/bash -lc 'git diff --check -- answer.md && git status --short -- answer.md' in /tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003
 succeeded in 3ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..28bd546bdeadd38aa7eb8bd2c4a4b0b59360cdb6
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,119 @@
+# Incident conclusion
+
+The June transaction was possible because the signature authenticates a borrow, but the contract never consumes that authorization.
+
+The signed digest is a deterministic function of only:
+
+- the EIP-712 domain;
+- `borrower`; and
+- `amount`.
+
+There is no nonce, authorization ID, used-digest flag, or expiry. The March transaction published the complete signature in public calldata. From then on, anyone could copy that calldata and call `borrowWithSig`. The function does not require `msg.sender` to be the protocol relayer, so the unknown address needed neither private key nor cooperation from the relayer; it only paid gas.
+
+Repayment does not affect signature validity. It merely restored the account's ability to borrow. Thus the same March authorization passed `ecrecover` again in June and `_borrow` created new debt. The byte-identical `(v,r,s)` is strong evidence of this exact replay. The boarding pass, the relayer's denial, and the absence of key compromise are all consistent with it.
+
+What to tell the customer:
+
+> We confirmed that the June debt was caused by a replay vulnerability in our gasless-borrow contract. Your March signature was valid, but our contract failed to mark it as used, so a third party could copy the public March transaction data and submit it again. This does not indicate that your wallet key was compromised, and you did not need to be online for the June transaction. We have disabled the affected path while we replace it. We are treating the duplicate debt and any resulting interest, fees, or collateral effects as a protocol incident and will remediate them under our incident policy.
+
+# Exposure beyond this incident
+
+This is not limited to one replay after one repayment:
+
+- Every successful historical V1 signature is public and remains valid forever.
+- A signature can be replayed repeatedly, including back-to-back, until collateral checks, liquidity, or borrow caps stop it. It becomes usable again after repayment, new collateral, or other restored capacity.
+- An attacker can force debt, worsen health factors, cause interest and liquidation penalties, consume market liquidity/caps, and potentially create bad debt or socialized losses.
+- Anyone can front-run the intended relayer. Rotating or securing the relayer does not fix a permissionless contract entry point.
+- There is no way in the current contract for a borrower to revoke an outstanding signature.
+- There is no deadline, so an authorization can execute years later under very different rates, collateral prices, or market conditions. A deadline limits staleness but does **not** replace a nonce.
+- Only `borrower` and `amount` are signed. Every value that can affect the action must be signed or fixed by code: at least the proceeds recipient, asset/market identifier, and any caller-selectable fee, rate mode, maximum rate, or slippage/terms bound. If `_borrow` sends proceeds to `msg.sender` or to an unsigned receiver, replay can be direct theft; if proceeds are forced to the borrower, it is still forced-debt and liquidation griefing.
+
+There are also two independent signature-hardening issues:
+
+1. Raw `ecrecover` accepts malleable high-`s` signatures. This did not cause the byte-identical June replay, but it means `used[keccak256(signatureBytes)]` is an unsafe patch: the alternate `(v,s)` form can represent the same authorization with different bytes. Track a nonce/authorization, not signature bytes, and use OpenZeppelin's canonical signature checks.
+2. Invalid `ecrecover` input returns `address(0)`. Because `borrower` is supplied by the caller, malformed input can satisfy the current comparison when `borrower == address(0)`. Reject the zero borrower and use a library that rejects invalid signatures.
+
+The existing domain does prevent ordinary replay on a different chain ID or contract address. However, caching the separator in the constructor is fragile across a chain split or chain-ID change: both sides retain the old separator, and the new chain does not dynamically adopt its new ID. Use OpenZeppelin `EIP712`, which rebuilds the separator when the chain ID changes. If this is a proxy, constructor-based domain storage is wrong for an additional reason; use `EIP712Upgradeable` and initialize the domain in proxy storage.
+
+# Immediate containment
+
+1. Pause or permanently disable the legacy `borrowWithSig` path immediately. Keep repayment and other risk-reducing operations available. If it cannot be paused independently, stop new borrowing in the affected market while preserving safe exits.
+2. Treat every V1 signature as exposed. Enumerate all past `borrowWithSig` calls, group identical digests, identify replays and affected accounts, and monitor attempts while containment completes.
+3. Do not try to fix this by changing relayers or by merely adding a V2 function. The V1 selector must become uncallable.
+4. Correct the user's replay-created debt and account for related interest, fees, liquidation loss, or collateral effects under the incident-response policy.
+
+# Code to ship
+
+For an EOA-only product, use OpenZeppelin `EIP712` and `ECDSA`. The replacement should have this shape (add all other execution-relevant fields before release):
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
+    );
+
+    mapping(address borrower => uint256 nonce) public borrowNonces;
+
+    constructor(/* ... */) EIP712("ArbiLend", "2") {
+        // ...
+    }
+
+    function borrowWithSig(
+        address borrower,
+        address receiver,
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        bytes calldata signature
+    ) external {
+        require(borrower != address(0), "zero borrower");
+        require(block.timestamp <= deadline, "expired");
+        require(nonce == borrowNonces[borrower], "bad nonce");
+
+        bytes32 structHash = keccak256(abi.encode(
+            BORROW_TYPEHASH,
+            borrower,
+            receiver,
+            amount,
+            nonce,
+            deadline
+        ));
+        bytes32 digest = _hashTypedDataV4(structHash);
+        require(ECDSA.recover(digest, signature) == borrower, "bad sig");
+
+        // Consume before _borrow or any external interaction. A revert rolls this back.
+        borrowNonces[borrower] = nonce + 1;
+        _borrow(borrower, receiver, amount);
+    }
+}
+```
+
+If proceeds must always go to the borrower, remove `receiver` from the API entirely and enforce that in `_borrow`; otherwise it must remain signed. Similarly add `asset`/`marketId` and every mutable economic term to both the type string and `abi.encode`, in exactly the same order and types.
+
+If smart-contract wallets are supported, replace `ECDSA.recover` with OpenZeppelin `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. ERC-1271 validation is itself an external call: increment the checked nonce **before** calling `SignatureChecker` (a failed check reverts the increment), and use a reentrancy guard as defense in depth. Do not cache ERC-1271 validity because a wallet's authorization logic can change.
+
+Add a borrower-controlled cancellation method that can advance the nonce, for example:
+
+```solidity
+function invalidateBorrowNonces(uint256 newNonce) external {
+    require(newNonce > borrowNonces[msg.sender], "nonce not advanced");
+    borrowNonces[msg.sender] = newNonce;
+}
+```
+
+Sequential nonces intentionally invalidate older pending requests when a later nonce is consumed or cancelled. If the product requires multiple independently executable outstanding requests, use unique authorization IDs with a used/cancelled mapping, or bitmap nonces, instead. In either design, consumption must be keyed by the signed authorization—not by signature bytes—and occur before external effects.
+
+Restricting submission to a designated relayer is optional product policy, not the replay fix. If required, enforce a relayer role on-chain or sign an `executor` field and require `msg.sender == executor`. Permissionless relaying is safe when the nonce prevents replay and every outcome-affecting field is signed or fixed.
+
+# Rollout requirements
+
+- Bump the EIP-712 version to `"2"`, change the type hash, and reject every V1 signature. Users must sign the new schema.
+- On an upgradeable proxy, use `EIP712Upgradeable`, append or namespace nonce storage without corrupting the existing layout, and atomically initialize/upgrade while disabling the legacy selector. Test against the deployed storage layout.
+- On an immutable deployment, deploy a new contract and actually disable, drain, or migrate the old market; a safe new contract does not neutralize the callable old one.
+- Update the signer UI so it displays the receiver, asset/market, amount, nonce, deadline, and economic bounds.
+- Consider a domain salt/epoch if the deployment model can recreate contract state at the same address and chain ID. It is defense in depth, not a substitute for nonce and deadline.
+
+Required regression tests include: second use of one signature; replay after repayment; two uses in one transaction/reentrant callback; expired and cancelled signatures; wrong nonce; altered amount/receiver/market/terms; wrong contract and chain domain; high-`s`, invalid-`v`, and zero-signer cases; ERC-1271 acceptance/rejection if supported; chain-ID-change domain behavior; and proof that all V1 calls fail after the upgrade.

codex
Created [answer.md](/tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003/answer.md).

It covers:

- The confirmed signature replay mechanism
- Customer-facing incident language
- Additional latent signature and lending risks
- Immediate containment measures
- An exact nonce/deadline-based V2 implementation
- Proxy and immutable-contract rollout requirements
- Required regression tests

The file passes `git diff --check`.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..28bd546bdeadd38aa7eb8bd2c4a4b0b59360cdb6
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,119 @@
+# Incident conclusion
+
+The June transaction was possible because the signature authenticates a borrow, but the contract never consumes that authorization.
+
+The signed digest is a deterministic function of only:
+
+- the EIP-712 domain;
+- `borrower`; and
+- `amount`.
+
+There is no nonce, authorization ID, used-digest flag, or expiry. The March transaction published the complete signature in public calldata. From then on, anyone could copy that calldata and call `borrowWithSig`. The function does not require `msg.sender` to be the protocol relayer, so the unknown address needed neither private key nor cooperation from the relayer; it only paid gas.
+
+Repayment does not affect signature validity. It merely restored the account's ability to borrow. Thus the same March authorization passed `ecrecover` again in June and `_borrow` created new debt. The byte-identical `(v,r,s)` is strong evidence of this exact replay. The boarding pass, the relayer's denial, and the absence of key compromise are all consistent with it.
+
+What to tell the customer:
+
+> We confirmed that the June debt was caused by a replay vulnerability in our gasless-borrow contract. Your March signature was valid, but our contract failed to mark it as used, so a third party could copy the public March transaction data and submit it again. This does not indicate that your wallet key was compromised, and you did not need to be online for the June transaction. We have disabled the affected path while we replace it. We are treating the duplicate debt and any resulting interest, fees, or collateral effects as a protocol incident and will remediate them under our incident policy.
+
+# Exposure beyond this incident
+
+This is not limited to one replay after one repayment:
+
+- Every successful historical V1 signature is public and remains valid forever.
+- A signature can be replayed repeatedly, including back-to-back, until collateral checks, liquidity, or borrow caps stop it. It becomes usable again after repayment, new collateral, or other restored capacity.
+- An attacker can force debt, worsen health factors, cause interest and liquidation penalties, consume market liquidity/caps, and potentially create bad debt or socialized losses.
+- Anyone can front-run the intended relayer. Rotating or securing the relayer does not fix a permissionless contract entry point.
+- There is no way in the current contract for a borrower to revoke an outstanding signature.
+- There is no deadline, so an authorization can execute years later under very different rates, collateral prices, or market conditions. A deadline limits staleness but does **not** replace a nonce.
+- Only `borrower` and `amount` are signed. Every value that can affect the action must be signed or fixed by code: at least the proceeds recipient, asset/market identifier, and any caller-selectable fee, rate mode, maximum rate, or slippage/terms bound. If `_borrow` sends proceeds to `msg.sender` or to an unsigned receiver, replay can be direct theft; if proceeds are forced to the borrower, it is still forced-debt and liquidation griefing.
+
+There are also two independent signature-hardening issues:
+
+1. Raw `ecrecover` accepts malleable high-`s` signatures. This did not cause the byte-identical June replay, but it means `used[keccak256(signatureBytes)]` is an unsafe patch: the alternate `(v,s)` form can represent the same authorization with different bytes. Track a nonce/authorization, not signature bytes, and use OpenZeppelin's canonical signature checks.
+2. Invalid `ecrecover` input returns `address(0)`. Because `borrower` is supplied by the caller, malformed input can satisfy the current comparison when `borrower == address(0)`. Reject the zero borrower and use a library that rejects invalid signatures.
+
+The existing domain does prevent ordinary replay on a different chain ID or contract address. However, caching the separator in the constructor is fragile across a chain split or chain-ID change: both sides retain the old separator, and the new chain does not dynamically adopt its new ID. Use OpenZeppelin `EIP712`, which rebuilds the separator when the chain ID changes. If this is a proxy, constructor-based domain storage is wrong for an additional reason; use `EIP712Upgradeable` and initialize the domain in proxy storage.
+
+# Immediate containment
+
+1. Pause or permanently disable the legacy `borrowWithSig` path immediately. Keep repayment and other risk-reducing operations available. If it cannot be paused independently, stop new borrowing in the affected market while preserving safe exits.
+2. Treat every V1 signature as exposed. Enumerate all past `borrowWithSig` calls, group identical digests, identify replays and affected accounts, and monitor attempts while containment completes.
+3. Do not try to fix this by changing relayers or by merely adding a V2 function. The V1 selector must become uncallable.
+4. Correct the user's replay-created debt and account for related interest, fees, liquidation loss, or collateral effects under the incident-response policy.
+
+# Code to ship
+
+For an EOA-only product, use OpenZeppelin `EIP712` and `ECDSA`. The replacement should have this shape (add all other execution-relevant fields before release):
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
+    );
+
+    mapping(address borrower => uint256 nonce) public borrowNonces;
+
+    constructor(/* ... */) EIP712("ArbiLend", "2") {
+        // ...
+    }
+
+    function borrowWithSig(
+        address borrower,
+        address receiver,
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        bytes calldata signature
+    ) external {
+        require(borrower != address(0), "zero borrower");
+        require(block.timestamp <= deadline, "expired");
+        require(nonce == borrowNonces[borrower], "bad nonce");
+
+        bytes32 structHash = keccak256(abi.encode(
+            BORROW_TYPEHASH,
+            borrower,
+            receiver,
+            amount,
+            nonce,
+            deadline
+        ));
+        bytes32 digest = _hashTypedDataV4(structHash);
+        require(ECDSA.recover(digest, signature) == borrower, "bad sig");
+
+        // Consume before _borrow or any external interaction. A revert rolls this back.
+        borrowNonces[borrower] = nonce + 1;
+        _borrow(borrower, receiver, amount);
+    }
+}
+```
+
+If proceeds must always go to the borrower, remove `receiver` from the API entirely and enforce that in `_borrow`; otherwise it must remain signed. Similarly add `asset`/`marketId` and every mutable economic term to both the type string and `abi.encode`, in exactly the same order and types.
+
+If smart-contract wallets are supported, replace `ECDSA.recover` with OpenZeppelin `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. ERC-1271 validation is itself an external call: increment the checked nonce **before** calling `SignatureChecker` (a failed check reverts the increment), and use a reentrancy guard as defense in depth. Do not cache ERC-1271 validity because a wallet's authorization logic can change.
+
+Add a borrower-controlled cancellation method that can advance the nonce, for example:
+
+```solidity
+function invalidateBorrowNonces(uint256 newNonce) external {
+    require(newNonce > borrowNonces[msg.sender], "nonce not advanced");
+    borrowNonces[msg.sender] = newNonce;
+}
+```
+
+Sequential nonces intentionally invalidate older pending requests when a later nonce is consumed or cancelled. If the product requires multiple independently executable outstanding requests, use unique authorization IDs with a used/cancelled mapping, or bitmap nonces, instead. In either design, consumption must be keyed by the signed authorization—not by signature bytes—and occur before external effects.
+
+Restricting submission to a designated relayer is optional product policy, not the replay fix. If required, enforce a relayer role on-chain or sign an `executor` field and require `msg.sender == executor`. Permissionless relaying is safe when the nonce prevents replay and every outcome-affecting field is signed or fixed.
+
+# Rollout requirements
+
+- Bump the EIP-712 version to `"2"`, change the type hash, and reject every V1 signature. Users must sign the new schema.
+- On an upgradeable proxy, use `EIP712Upgradeable`, append or namespace nonce storage without corrupting the existing layout, and atomically initialize/upgrade while disabling the legacy selector. Test against the deployed storage layout.
+- On an immutable deployment, deploy a new contract and actually disable, drain, or migrate the old market; a safe new contract does not neutralize the callable old one.
+- Update the signer UI so it displays the receiver, asset/market, amount, nonce, deadline, and economic bounds.
+- Consider a domain salt/epoch if the deployment model can recreate contract state at the same address and chain ID. It is defense in depth, not a substitute for nonce and deadline.
+
+Required regression tests include: second use of one signature; replay after repayment; two uses in one transaction/reentrant callback; expired and cancelled signatures; wrong nonce; altered amount/receiver/market/terms; wrong contract and chain domain; high-`s`, invalid-`v`, and zero-signer cases; ERC-1271 acceptance/rejection if supported; chain-ID-change domain behavior; and proof that all V1 calls fail after the upgrade.

tokens used
33,993
````

## final message

Created [answer.md](/tmp/ethskills-audit-eval/2026-09-02T152433Z-codex-with-skill-1/audit-quiz-003/answer.md).

It covers:

- The confirmed signature replay mechanism
- Customer-facing incident language
- Additional latent signature and lending risks
- Immediate containment measures
- An exact nonce/deadline-based V2 implementation
- Proxy and immutable-contract rollout requirements
- Required regression tests

The file passes `git diff --check`.
