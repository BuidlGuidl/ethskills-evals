# Executor transcript — 2026-09-03T134529Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06784-79d9-7ef3-8afc-30ccc43b9fee
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

2026-09-03T13:45:30.564471Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a06784-79d9-7ef3-8afc-30ccc43b9fee.tmp-1788443130341738808: line 2547: syntax error near unexpected token `('

codex
I’m using the `audit` skill because this is a pre-deployment EVM security review. I’ll follow its workflow, keep `src/` untouched, and leave only the requested report.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/audit/SKILL.md" in /tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001
 succeeded in 0ms:
codex
The audit workflow explicitly calls for parallel specialist review. I’m loading its master methodology first, then I’ll map the contracts and assign the relevant lending, oracle, token, math, access-control, and Arbitrum checks.
web search: 
web search: https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md
exec
/bin/bash -lc "pwd && rg --files -g 'README.md' -g 'src/**' -g 'test/**' -g 'foundry.toml' -g 'remappings.txt' -g 'lib/**/src/**/*.sol' | sed -n '1,240p' && git status --short" in /tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001
 succeeded in 7ms:
foundry.toml
README.md
src/PriceOracle.sol
src/interfaces/IERC20.sol
src/interfaces/ILendingMarket.sol
src/interfaces/IAggregatorV3.sol
src/CollateralVault.sol
src/MarketProxy.sol
src/LendingMarket.sol

exec
/bin/bash -lc "sed -n '1,240p' README.md; for f in src/*.sol src/interfaces/*.sol; do echo \"FILE "'$f"; nl -ba "$f"; done; sed -n '"'1,200p' foundry.toml" in /tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001
 succeeded in 4ms:
exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-general/references/checklist.md && curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-precision-math/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001
 succeeded in 420ms:
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

codex
Recon is complete. The highest-risk surface is the proxy’s privileged control plane, followed by health-factor math and oracle handling; I’m now validating exploit paths and separating launch-critical issues from roadmap-only token compatibility risks.
exec
/bin/bash -lc 'forge build' in /tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001
 succeeded in 45ms:
No files changed, compilation skipped
2026-09-03T13:47:49.020956Z  WARN evm::traces: failed to flush signature cache err=failed to create file "/home/damu/.foundry/cache/signatures": Read-only file system (os error 30)
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


collab: Wait
exec
/bin/bash -lc 'git status --short && rg -n "external|public|delegatecall|transfer|oracle|getPrice|principal|borrowIndex|block.number" src' in /tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001
 succeeded in 3ms:
collab: Wait
collab: Wait
collab: Wait
collab: Wait
collab: Wait
collab: Wait
codex
The findings have been deduplicated and ranked. I’m writing the final report now, with conditional future-token issues clearly separated so they do not distract from the launch blockers.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001/AUDIT-REPORT.md
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..a2a400c62b29ae3fa6c056b4f3c37b632074d6a9
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,242 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-03  
+**Scope:** `README.md`, `src/LendingMarket.sol`, `src/CollateralVault.sol`, `src/PriceOracle.sol`, `src/MarketProxy.sol`, and interfaces  
+**Deployment:** Arbitrum One  
+**Revision:** local workspace as reviewed; no repository commit was available
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Two unauthenticated control-plane functions allow any account to take over pricing or replace all market code and drain the treasury. A third unauthenticated setter lets an attacker liquidate otherwise healthy users. These are direct, practical attacks and must be fixed before deployment.
+
+The health-factor formula also liquidates positions that are safely collateralized under the documented parameters. Oracle validation is insufficient for Chainlink on Arbitrum, and the signed-borrow path can be replayed. The current liquidation design has no economically viable bad-debt path after a sharp price fall.
+
+| Rank | ID | Severity | Finding |
+|---:|---|---|---|
+| 1 | C-01 | Critical | Anyone can replace the implementation and drain all market and vault funds |
+| 2 | C-02 | Critical | Anyone can install a fake oracle and borrow all treasury USDC |
+| 3 | H-01 | High | Anyone can force liquidation by changing the liquidation threshold |
+| 4 | H-02 | High | Health-factor precision makes positions below 200% liquidatable |
+| 5 | H-03 | High | Chainlink prices lack freshness, round, answer, and Arbitrum sequencer checks |
+| 6 | H-04 | High | Borrow signatures can be replayed until the signer is maximally indebted |
+| 7 | H-05 | High | Deeply underwater positions have no economically viable liquidation path |
+| 8 | M-01 | Medium | The configured stETH/USD feed undervalues wstETH collateral |
+| 9 | M-02 | Medium | Empty proxy initialization can give the first caller ownership |
+| 10 | M-03 | Medium | Zero-value borrows can permanently disable batch liquidation |
+| 11 | M-04 | Medium | Raw ERC-20 calls can create accounting without token movement |
+| 12 | M-05 | Medium | Signed borrow authorizations never expire |
+| 13 | M-06 | Medium | Immediate single-key administration creates uncompensated governance risk |
+| 14 | L-01 | Low | Interest accrual uses coarse Arbitrum L1-block timing |
+| 15 | L-02 | Low | Ownership transfer can permanently lose oracle administration |
+
+The future-collateral section records blockers for the announced listing roadmap. They do not affect launch wstETH by themselves, but those asset classes must not be listed through the current generic path.
+
+## Findings
+
+## [C-01] Anyone can replace the implementation and drain all market and vault funds
+**Severity**: Critical  
+**Category**: Proxies / access control  
+**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
+
+**Description**: `upgradeTo` writes the ERC-1967 implementation slot without `onlyOwner` or any implementation validation. Any account can make `MarketProxy` delegatecall arbitrary attacker code. Treasury USDC is held at the proxy, and malicious delegatecalled code can also call `CollateralVault.seize`: the vault sees the caller as the authorized market proxy.
+
+**Proof of Concept**: An attacker deploys an implementation whose function transfers the proxy's USDC balance to the attacker and calls `vault.seize(user, token, attacker, amount)`. The attacker calls `upgradeTo(maliciousImplementation)` through the proxy and then invokes the drain function. They receive all seeded USDC and any recorded user collateral. Upgrading to an EOA or incompatible contract can instead permanently brick the market.
+
+**Recommendation**: Treat this as a deployment blocker. Use an audited UUPS implementation, authorize upgrades with an owner-only `_authorizeUpgrade`, require deployed code and the correct `proxiableUUID`, and place upgrade authority behind a multisig and timelock. Test unauthorized, incompatible, and rollback upgrade cases.
+
+## [C-02] Anyone can install a fake oracle and borrow all treasury USDC
+**Severity**: Critical  
+**Category**: Access control / oracle  
+**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)
+
+**Description**: `setOracle` has no access control. An attacker can install an ABI-compatible oracle that assigns an arbitrarily high value to their collateral.
+
+**Proof of Concept**: The attacker deposits a small amount of wstETH, calls `setOracle` with a contract returning an enormous wstETH price and a nonzero USDC price, then borrows the market's entire USDC balance. The fabricated health factor passes and the attacker receives the treasury's USDC for negligible collateral.
+
+**Recommendation**: Add `onlyOwner`, reject zero/non-contract addresses, and use a timelocked two-step oracle change. Validate the complete feed configuration before activation and add an emergency pause that can stop new borrowing without stopping repayment.
+
+## [H-01] Anyone can force liquidation by changing the liquidation threshold
+**Severity**: High  
+**Category**: Access control  
+**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)
+
+**Description**: The setter is unauthenticated and unbounded. Any account can set the threshold to zero, making every indebted account's health factor zero, or set extreme values that make health calculations revert.
+
+**Proof of Concept**: An attacker sets the threshold to zero, approves enough USDC, and calls `liquidate` on a previously healthy borrower. The attacker repays that user's debt and receives collateral worth up to 105% of it, extracting the 5% bonus from a user who should not have been liquidatable.
+
+**Recommendation**: Add `onlyOwner`, enforce a protocol-approved range strictly below `BPS`, and apply risk-parameter changes through a timelock. Test zero, `BPS`, over-`BPS`, and exact-boundary values.
+
+## [H-02] Health-factor precision makes positions below 200% liquidatable
+**Severity**: High  
+**Category**: Precision math / lending  
+**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:146`)
+
+**Description**: The formula divides `collateralValueUsd` by `debtUsd` before multiplying. Integer division truncates every collateral ratio from 1.0 up to 1.999... to `1`. With the 80% threshold, all such accounts receive a health factor of `0.8e18`. The documented parameters should permit positions at or above 125%, but the implementation effectively requires 200%.
+
+**Proof of Concept**: A position with $200 collateral and $100 debt passes. After a move to $199 collateral, its intended health factor is 1.592, but the contract returns 0.8. A liquidator can repay $100 and receive $105 of the user's collateral, taking a $5 bonus despite the position remaining economically healthy.
+
+**Recommendation**: Multiply before dividing using full-precision math, for example `mulDiv(collateralUsd, liquidationThreshold * WAD, debtUsd * BPS)`, with an overflow-safe implementation. Add tests immediately below, at, and above 125% and 200%.
+
+## [H-03] Chainlink prices lack freshness, round, answer, and Arbitrum sequencer checks
+**Severity**: High  
+**Category**: Oracle / Arbitrum  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`); consumed by `LendingMarket._borrow()` and `LendingMarket.liquidate()`
+
+**Description**: `getPrice` uses deprecated `latestAnswer()` and accepts the result without checking that it is positive, fresh, or from a completed round. It also does not consult Arbitrum's sequencer uptime feed or enforce a grace period after recovery. Stale values can therefore be used for the two value-moving decisions in the system: borrowing and liquidation. A zero answer also causes divisions to revert; a negative answer reverts during conversion/multiplication rather than failing with a controlled oracle error.
+
+**Proof of Concept**: After a sequencer outage or delayed feed update, a user can borrow treasury USDC against collateral whose stale price is above its current market value. In the opposite price direction, a liquidator can use a stale value to seize collateral from a position that is healthy at current prices. The attacker or borrower retains the extracted USDC or liquidation bonus; the treasury or liquidated user absorbs the loss.
+
+**Recommendation**: Use `latestRoundData`; require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. Check the Arbitrum One sequencer uptime feed, require the sequencer to be up, and enforce a recovery grace period before borrowing or liquidation resumes. Permit repayments while oracle-dependent actions are paused.
+
+## [H-04] Borrow signatures can be replayed until the signer is maximally indebted
+**Severity**: High  
+**Category**: Signatures / lending  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`), `BORROW_TYPEHASH` (`src/LendingMarket.sol:11`)
+
+**Description**: The signed struct contains only `(borrower, amount)`. It has no nonce and successful digests are not marked as used. Anyone who obtains one valid authorization can submit it repeatedly; every replay adds debt and sends another `amount` of USDC to the signer until the health check rejects the next call.
+
+**Proof of Concept**: A relayer observes one valid borrow signature and replays it until the borrower's collateral is at the maximum permitted leverage. After a small interest or price move, the relayer can liquidate and receive the 5% bonus. The borrower gets unwanted USDC transfers but must actively repay them or suffer forced liquidation; the authorization was not one-time as represented.
+
+**Recommendation**: Include a per-borrower nonce in the EIP-712 struct, verify it, and increment it before `_borrow`. Provide explicit nonce invalidation. Use a vetted EIP-712/ECDSA library that rejects malleable signatures, and test replay and cancellation.
+
+## [H-05] Deeply underwater positions have no economically viable liquidation path
+**Severity**: High  
+**Category**: Lending / bad debt  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)
+
+**Description**: A liquidator must transfer the borrower's entire debt before collateral is seized. Seizure is capped by available collateral. When collateral is worth less than the debt, liquidation guarantees a loss; below 105% it cannot pay the advertised bonus. There is no partial liquidation, close factor, auction, reserve, insurance, or bad-debt write-off path.
+
+**Proof of Concept**: If a rapid wstETH move leaves $80 of collateral against $100 debt, a liquidator must pay $100 and can receive at most $80. Rational liquidators do nothing. The borrower retains the uncovered borrowed value and treasury liquidity remains undercollateralized; large accounts additionally require full-debt liquidity from one liquidator.
+
+**Recommendation**: Support bounded partial liquidation and calculate repayable debt from collateral that can actually be seized. Cap the bonus to available value, and add an explicit residual bad-debt mechanism backed by reserves, insurance, or an auction/backstop. Stress-test large single-update moves and feed gaps.
+
+## [M-01] The configured stETH/USD feed undervalues wstETH collateral
+**Severity**: Medium  
+**Category**: Oracle / yield-bearing collateral  
+**Location**: `README.md` feed configuration; `LendingMarket.collateralValueUsd()` (`src/LendingMarket.sol:132`); `PriceOracle.getPrice()`
+
+**Description**: The launch collateral is wstETH, but the configured feed prices one stETH. One wstETH represents a changing amount of stETH. The market treats the feed answer as the value of one whole wstETH and omits the wrapper exchange rate, systematically understating collateral value.
+
+**Proof of Concept**: A user whose wstETH's underlying stETH value leaves them above the real liquidation threshold can appear below it on-chain. A liquidator receives the 5% bonus and the user suffers an unintended unwind. Borrow capacity is also lower than intended, and the discrepancy grows as staking yield accrues.
+
+**Recommendation**: Use a validated direct wstETH/USD feed or an adapter that composes stETH/USD with the canonical wstETH-to-stETH conversion rate and normalizes decimals. Test the exact production addresses and exchange-rate direction.
+
+## [M-02] Empty proxy initialization can give the first caller ownership
+**Severity**: Medium  
+**Category**: Proxy deployment  
+**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`), `LendingMarket.initialize()` (`src/LendingMarket.sol:56`)
+
+**Description**: The proxy permits empty `initData`, while `initialize` is externally callable by anyone. No deployment script proves atomic initialization. If deployment and initialization are separate transactions, the first caller selects the owner, oracle, vault, and debt asset.
+
+**Proof of Concept**: A proxy is deployed with empty initialization data. An observer front-runs the intended initialization and calls `initialize(attacker, fakeOracle, fakeVault, fakeAsset)`. The legitimate call then reverts with `AlreadyInitialized`, and the attacker controls every owner-gated function.
+
+**Recommendation**: Require nonempty constructor initialization data for this market and initialize atomically. Validate nonzero contract parameters. Disable initialization on the standalone implementation as defense in depth, and test the actual deployment transaction.
+
+## [M-03] Zero-value borrows can permanently disable batch liquidation
+**Severity**: Medium  
+**Category**: Denial of service / lending  
+**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`), `LendingMarket.liquidateAll()` (`src/LendingMarket.sol:190`)
+
+**Description**: `_borrow` appends the borrower whenever their principal is zero and accepts `amount == 0`. The same account can therefore append itself indefinitely because its principal stays zero. Entries are never removed, and `liquidateAll` walks the entire array with external oracle and vault calls.
+
+**Proof of Concept**: An attacker repeatedly calls `borrow(0)`, permanently growing `borrowers`. Once iteration exceeds the Arbitrum block gas limit, every `liquidateAll` call reverts or runs out of gas. The attacker gains a window in which keeper batch liquidation cannot respond to a broad price move, increasing bad debt, though individual liquidation remains possible.
+
+**Recommendation**: Reject zero and enforce a meaningful minimum position size. Maintain unique active borrowers with explicit activation/deactivation, and replace the unbounded sweep with cursor-based, bounded batches that tolerate individual failures.
+
+## [M-04] Raw ERC-20 calls can create accounting without token movement
+**Severity**: Medium  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()`, `withdraw()`, and `seize()`; `LendingMarket._borrow()`, `repay()`, and `_liquidate()`
+
+**Description**: Every token operation uses the raw interface and ignores the returned boolean. If a listed token returns `false` without reverting, deposits are credited although nothing arrived; similarly, a false-returning transfer can reduce balances or debt without payment. Tokens that return no data instead revert during ABI decoding. Launch USDC and wstETH are not expected to exhibit this behavior, but the generic listing path does not enforce that assumption and USDT is announced next.
+
+**Proof of Concept**: If governance lists a token whose `transferFrom` returns false, an attacker calls `deposit`; `balanceOf` increases without backing assets. The market values that claim and sends real USDC to the attacker. On the debt side, an unsuccessful false-returning repayment can reduce recorded debt without receiving funds.
+
+**Recommendation**: Use a proven `SafeERC20` implementation for every transfer and transferFrom. For deposits, additionally measure the before/after vault balance and either credit the actual delta or reject any mismatch. Pin and integration-test the exact token contracts before listing.
+
+## [M-05] Signed borrow authorizations never expire
+**Severity**: Medium  
+**Category**: Signatures  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`), `BORROW_TYPEHASH`
+
+**Description**: The EIP-712 message has no deadline. An unexecuted authorization remains valid indefinitely, even after market conditions, deposited collateral, or the signer's intent changes.
+
+**Proof of Concept**: A holder waits months before submitting an old signature at the moment forced leverage is most harmful. The borrower receives unwanted debt and can later lose the liquidation bonus. The holder does not need a fresh authorization and the borrower has no on-chain expiry protection.
+
+**Recommendation**: Add `nonce` and `deadline` to the type hash, reject expired messages, and provide nonce cancellation. Recompute the domain separator on chain-ID changes through a vetted EIP-712 implementation.
+
+## [M-06] Immediate single-key administration creates uncompensated governance risk
+**Severity**: Medium  
+**Category**: Access control / trust model  
+**Location**: `LendingMarket.setBorrowRate()`, `LendingMarket.listCollateral()`, `PriceOracle.setFeed()`
+
+**Description**: After the missing modifiers are fixed, an owner can still immediately list worthless collateral, replace a price feed, or set an unbounded borrow rate. A compromised or mistaken owner can drain treasury liquidity through bad collateral pricing or make interest accrual overflow and freeze debt-dependent operations. Borrowers receive no time to repay or withdraw before changes take effect.
+
+**Proof of Concept**: The owner key lists an attacker-controlled token and configures an inflated feed, allowing its holder to borrow the USDC treasury. Alternatively, an extreme `borrowRate` makes `accrueInterest` revert on overflow, blocking borrow, repay, and liquidation.
+
+**Recommendation**: Use a multisig plus timelock, bounded parameters, two-step feed/listing activation, and an emergency guardian with narrowly scoped pause powers. Emit proposed changes before their activation and document the trust model.
+
+## [L-01] Interest accrual uses coarse Arbitrum L1-block timing
+**Severity**: Low  
+**Category**: Arbitrum / interest accounting  
+**Location**: `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:117`), `SECONDS_PER_BLOCK` (`src/LendingMarket.sol:15`)
+
+**Description**: On Arbitrum, Solidity `block.number` approximates the L1 block number; many L2 transactions can share it, and updates occur in jumps. Multiplying the difference by 12 seconds is reasonable only over longer periods. Short-term debt and health are path-dependent: many L2 transactions can accrue nothing, followed by a jump.
+
+**Proof of Concept**: A borrower opens and repays across L2 blocks that report the same L1 block number and pays no interest for that interval. A user transacting after the next update bears the coarse index jump. The extractable amount per short interval is small, so this is Low rather than a solvency finding.
+
+**Recommendation**: Track `lastAccrualTimestamp` and use `block.timestamp - lastAccrualTimestamp`; test long inactivity and sequencer downtime. Do not switch to Arbitrum's fast L2 block number while retaining a 12-second multiplier.
+
+## [L-02] Ownership transfer can permanently lose oracle administration
+**Severity**: Low  
+**Category**: Access control  
+**Location**: `PriceOracle.transferOwnership()` (`src/PriceOracle.sol:28`)
+
+**Description**: Ownership transfers in one step and allow the zero address. A typo, wrong network address, or zero address permanently removes the ability to update feeds, potentially leaving stale or deprecated feeds in service.
+
+**Proof of Concept**: The owner transfers ownership to an address without a usable key. No account can call `setFeed`; if the configured feed is later retired, oracle-dependent market operations become unsafe or unavailable.
+
+**Recommendation**: Reject the zero address and use a two-step ownership transfer in which the nominated owner explicitly accepts.
+
+## Future collateral listing blockers
+
+These are concrete incompatibilities, not launch findings for non-rebasing wstETH:
+
+### [R-01] Fee-on-transfer collateral is overcredited
+**Severity**: Medium (conditional on listing)  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()` (`src/CollateralVault.sol:35`)
+
+**Description**: The vault credits the requested amount rather than the received balance delta. A transfer-tax token creates claims greater than vault assets and lets borrowers use nonexistent collateral value.
+
+**Proof of Concept**: With a 50% transfer tax, a nominal deposit of 100 credits 100 while the vault receives 50. At 80% LTV the attacker can borrow about 80 units against 50 units of assets, leaving treasury bad debt. Later users can also be unable to withdraw their recorded balances.
+
+**Recommendation**: Do not list fee-on-transfer collateral unless all inbound, outbound, and liquidation fees are explicitly modeled. Measure balance deltas and reject or consistently account for any mismatch.
+
+### [R-02] Rebasing collateral makes nominal balances insolvent or strands yield
+**Severity**: Medium (conditional on listing)  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.balanceOf`, `deposit()`, `withdraw()`, and `seize()`
+
+**Description**: User balances are fixed nominal amounts. A negative rebase leaves claims and borrow capacity above actual vault assets; a positive rebase leaves unallocated assets that no user can withdraw. The README explicitly requests a future path to rebasing collateral, but the current accounting is not that path.
+
+**Proof of Concept**: Users deposit 100 units and a negative rebase leaves the vault with 80. The mappings still total 100 and are valued as 100, permitting borrowing against 20 nonexistent units; aggregate withdrawals or seizures eventually revert. A positive rebase strands the opposite surplus.
+
+**Recommendation**: Do not list rebasing tokens in this vault. Use audited share accounting against live total assets or require a non-rebasing wrapper, paired with an oracle that prices the wrapper and its exchange rate.
+
+### [R-03] Hook-capable collateral can reenter withdrawal before accounting is reduced
+**Severity**: Medium (conditional on listing)  
+**Category**: Reentrancy / ERC-20 integration  
+**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)
+
+**Description**: `withdraw` transfers before decrementing `balanceOf`. A token with recipient callbacks can reenter while the original balance remains visible and withdraw the same claim repeatedly from pooled vault funds.
+
+**Proof of Concept**: An attacker with a recorded balance of `X` receives a callback during `transfer` and reenters `withdraw(token, X)`. Each nested call sees the unchanged balance and transfers another `X`; the outer calls later all write the same reduced balance. The attacker receives other users' collateral.
+
+**Recommendation**: Follow checks-effects-interactions by decrementing the balance before transfer; a later health-check revert will roll back all effects. Add a reentrancy guard and disallow callback tokens unless an adapter receives a separate review.
+
+## Review notes and remediation order
+
+Fix C-01, C-02, and H-01 first and test every privileged selector through the proxy. Next correct health math and oracle validation, then add nonces/deadlines and redesign bad-debt liquidation. Deploy only through a reproducible script that initializes atomically and transfers bounded administration to the intended multisig/timelock.
+
+The workspace compiled successfully with Foundry. There is no test suite, deployment script, invariant suite, or live configuration to validate. This review is source-level and cannot establish the correctness of deployment parameters or off-chain keeper behavior. Add unit, fuzz, invariant, fork, and upgrade-layout tests before commissioning a remediation review.

diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..a2a400c62b29ae3fa6c056b4f3c37b632074d6a9
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,242 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-03  
+**Scope:** `README.md`, `src/LendingMarket.sol`, `src/CollateralVault.sol`, `src/PriceOracle.sol`, `src/MarketProxy.sol`, and interfaces  
+**Deployment:** Arbitrum One  
+**Revision:** local workspace as reviewed; no repository commit was available
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Two unauthenticated control-plane functions allow any account to take over pricing or replace all market code and drain the treasury. A third unauthenticated setter lets an attacker liquidate otherwise healthy users. These are direct, practical attacks and must be fixed before deployment.
+
+The health-factor formula also liquidates positions that are safely collateralized under the documented parameters. Oracle validation is insufficient for Chainlink on Arbitrum, and the signed-borrow path can be replayed. The current liquidation design has no economically viable bad-debt path after a sharp price fall.
+
+| Rank | ID | Severity | Finding |
+|---:|---|---|---|
+| 1 | C-01 | Critical | Anyone can replace the implementation and drain all market and vault funds |
+| 2 | C-02 | Critical | Anyone can install a fake oracle and borrow all treasury USDC |
+| 3 | H-01 | High | Anyone can force liquidation by changing the liquidation threshold |
+| 4 | H-02 | High | Health-factor precision makes positions below 200% liquidatable |
+| 5 | H-03 | High | Chainlink prices lack freshness, round, answer, and Arbitrum sequencer checks |
+| 6 | H-04 | High | Borrow signatures can be replayed until the signer is maximally indebted |
+| 7 | H-05 | High | Deeply underwater positions have no economically viable liquidation path |
+| 8 | M-01 | Medium | The configured stETH/USD feed undervalues wstETH collateral |
+| 9 | M-02 | Medium | Empty proxy initialization can give the first caller ownership |
+| 10 | M-03 | Medium | Zero-value borrows can permanently disable batch liquidation |
+| 11 | M-04 | Medium | Raw ERC-20 calls can create accounting without token movement |
+| 12 | M-05 | Medium | Signed borrow authorizations never expire |
+| 13 | M-06 | Medium | Immediate single-key administration creates uncompensated governance risk |
+| 14 | L-01 | Low | Interest accrual uses coarse Arbitrum L1-block timing |
+| 15 | L-02 | Low | Ownership transfer can permanently lose oracle administration |
+
+The future-collateral section records blockers for the announced listing roadmap. They do not affect launch wstETH by themselves, but those asset classes must not be listed through the current generic path.
+
+## Findings
+
+## [C-01] Anyone can replace the implementation and drain all market and vault funds
+**Severity**: Critical  
+**Category**: Proxies / access control  
+**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
+
+**Description**: `upgradeTo` writes the ERC-1967 implementation slot without `onlyOwner` or any implementation validation. Any account can make `MarketProxy` delegatecall arbitrary attacker code. Treasury USDC is held at the proxy, and malicious delegatecalled code can also call `CollateralVault.seize`: the vault sees the caller as the authorized market proxy.
+
+**Proof of Concept**: An attacker deploys an implementation whose function transfers the proxy's USDC balance to the attacker and calls `vault.seize(user, token, attacker, amount)`. The attacker calls `upgradeTo(maliciousImplementation)` through the proxy and then invokes the drain function. They receive all seeded USDC and any recorded user collateral. Upgrading to an EOA or incompatible contract can instead permanently brick the market.
+
+**Recommendation**: Treat this as a deployment blocker. Use an audited UUPS implementation, authorize upgrades with an owner-only `_authorizeUpgrade`, require deployed code and the correct `proxiableUUID`, and place upgrade authority behind a multisig and timelock. Test unauthorized, incompatible, and rollback upgrade cases.
+
+## [C-02] Anyone can install a fake oracle and borrow all treasury USDC
+**Severity**: Critical  
+**Category**: Access control / oracle  
+**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)
+
+**Description**: `setOracle` has no access control. An attacker can install an ABI-compatible oracle that assigns an arbitrarily high value to their collateral.
+
+**Proof of Concept**: The attacker deposits a small amount of wstETH, calls `setOracle` with a contract returning an enormous wstETH price and a nonzero USDC price, then borrows the market's entire USDC balance. The fabricated health factor passes and the attacker receives the treasury's USDC for negligible collateral.
+
+**Recommendation**: Add `onlyOwner`, reject zero/non-contract addresses, and use a timelocked two-step oracle change. Validate the complete feed configuration before activation and add an emergency pause that can stop new borrowing without stopping repayment.
+
+## [H-01] Anyone can force liquidation by changing the liquidation threshold
+**Severity**: High  
+**Category**: Access control  
+**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)
+
+**Description**: The setter is unauthenticated and unbounded. Any account can set the threshold to zero, making every indebted account's health factor zero, or set extreme values that make health calculations revert.
+
+**Proof of Concept**: An attacker sets the threshold to zero, approves enough USDC, and calls `liquidate` on a previously healthy borrower. The attacker repays that user's debt and receives collateral worth up to 105% of it, extracting the 5% bonus from a user who should not have been liquidatable.
+
+**Recommendation**: Add `onlyOwner`, enforce a protocol-approved range strictly below `BPS`, and apply risk-parameter changes through a timelock. Test zero, `BPS`, over-`BPS`, and exact-boundary values.
+
+## [H-02] Health-factor precision makes positions below 200% liquidatable
+**Severity**: High  
+**Category**: Precision math / lending  
+**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:146`)
+
+**Description**: The formula divides `collateralValueUsd` by `debtUsd` before multiplying. Integer division truncates every collateral ratio from 1.0 up to 1.999... to `1`. With the 80% threshold, all such accounts receive a health factor of `0.8e18`. The documented parameters should permit positions at or above 125%, but the implementation effectively requires 200%.
+
+**Proof of Concept**: A position with $200 collateral and $100 debt passes. After a move to $199 collateral, its intended health factor is 1.592, but the contract returns 0.8. A liquidator can repay $100 and receive $105 of the user's collateral, taking a $5 bonus despite the position remaining economically healthy.
+
+**Recommendation**: Multiply before dividing using full-precision math, for example `mulDiv(collateralUsd, liquidationThreshold * WAD, debtUsd * BPS)`, with an overflow-safe implementation. Add tests immediately below, at, and above 125% and 200%.
+
+## [H-03] Chainlink prices lack freshness, round, answer, and Arbitrum sequencer checks
+**Severity**: High  
+**Category**: Oracle / Arbitrum  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`); consumed by `LendingMarket._borrow()` and `LendingMarket.liquidate()`
+
+**Description**: `getPrice` uses deprecated `latestAnswer()` and accepts the result without checking that it is positive, fresh, or from a completed round. It also does not consult Arbitrum's sequencer uptime feed or enforce a grace period after recovery. Stale values can therefore be used for the two value-moving decisions in the system: borrowing and liquidation. A zero answer also causes divisions to revert; a negative answer reverts during conversion/multiplication rather than failing with a controlled oracle error.
+
+**Proof of Concept**: After a sequencer outage or delayed feed update, a user can borrow treasury USDC against collateral whose stale price is above its current market value. In the opposite price direction, a liquidator can use a stale value to seize collateral from a position that is healthy at current prices. The attacker or borrower retains the extracted USDC or liquidation bonus; the treasury or liquidated user absorbs the loss.
+
+**Recommendation**: Use `latestRoundData`; require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. Check the Arbitrum One sequencer uptime feed, require the sequencer to be up, and enforce a recovery grace period before borrowing or liquidation resumes. Permit repayments while oracle-dependent actions are paused.
+
+## [H-04] Borrow signatures can be replayed until the signer is maximally indebted
+**Severity**: High  
+**Category**: Signatures / lending  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`), `BORROW_TYPEHASH` (`src/LendingMarket.sol:11`)
+
+**Description**: The signed struct contains only `(borrower, amount)`. It has no nonce and successful digests are not marked as used. Anyone who obtains one valid authorization can submit it repeatedly; every replay adds debt and sends another `amount` of USDC to the signer until the health check rejects the next call.
+
+**Proof of Concept**: A relayer observes one valid borrow signature and replays it until the borrower's collateral is at the maximum permitted leverage. After a small interest or price move, the relayer can liquidate and receive the 5% bonus. The borrower gets unwanted USDC transfers but must actively repay them or suffer forced liquidation; the authorization was not one-time as represented.
+
+**Recommendation**: Include a per-borrower nonce in the EIP-712 struct, verify it, and increment it before `_borrow`. Provide explicit nonce invalidation. Use a vetted EIP-712/ECDSA library that rejects malleable signatures, and test replay and cancellation.
+
+## [H-05] Deeply underwater positions have no economically viable liquidation path
+**Severity**: High  
+**Category**: Lending / bad debt  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)
+
+**Description**: A liquidator must transfer the borrower's entire debt before collateral is seized. Seizure is capped by available collateral. When collateral is worth less than the debt, liquidation guarantees a loss; below 105% it cannot pay the advertised bonus. There is no partial liquidation, close factor, auction, reserve, insurance, or bad-debt write-off path.
+
+**Proof of Concept**: If a rapid wstETH move leaves $80 of collateral against $100 debt, a liquidator must pay $100 and can receive at most $80. Rational liquidators do nothing. The borrower retains the uncovered borrowed value and treasury liquidity remains undercollateralized; large accounts additionally require full-debt liquidity from one liquidator.
+
+**Recommendation**: Support bounded partial liquidation and calculate repayable debt from collateral that can actually be seized. Cap the bonus to available value, and add an explicit residual bad-debt mechanism backed by reserves, insurance, or an auction/backstop. Stress-test large single-update moves and feed gaps.
+
+## [M-01] The configured stETH/USD feed undervalues wstETH collateral
+**Severity**: Medium  
+**Category**: Oracle / yield-bearing collateral  
+**Location**: `README.md` feed configuration; `LendingMarket.collateralValueUsd()` (`src/LendingMarket.sol:132`); `PriceOracle.getPrice()`
+
+**Description**: The launch collateral is wstETH, but the configured feed prices one stETH. One wstETH represents a changing amount of stETH. The market treats the feed answer as the value of one whole wstETH and omits the wrapper exchange rate, systematically understating collateral value.
+
+**Proof of Concept**: A user whose wstETH's underlying stETH value leaves them above the real liquidation threshold can appear below it on-chain. A liquidator receives the 5% bonus and the user suffers an unintended unwind. Borrow capacity is also lower than intended, and the discrepancy grows as staking yield accrues.
+
+**Recommendation**: Use a validated direct wstETH/USD feed or an adapter that composes stETH/USD with the canonical wstETH-to-stETH conversion rate and normalizes decimals. Test the exact production addresses and exchange-rate direction.
+
+## [M-02] Empty proxy initialization can give the first caller ownership
+**Severity**: Medium  
+**Category**: Proxy deployment  
+**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`), `LendingMarket.initialize()` (`src/LendingMarket.sol:56`)
+
+**Description**: The proxy permits empty `initData`, while `initialize` is externally callable by anyone. No deployment script proves atomic initialization. If deployment and initialization are separate transactions, the first caller selects the owner, oracle, vault, and debt asset.
+
+**Proof of Concept**: A proxy is deployed with empty initialization data. An observer front-runs the intended initialization and calls `initialize(attacker, fakeOracle, fakeVault, fakeAsset)`. The legitimate call then reverts with `AlreadyInitialized`, and the attacker controls every owner-gated function.
+
+**Recommendation**: Require nonempty constructor initialization data for this market and initialize atomically. Validate nonzero contract parameters. Disable initialization on the standalone implementation as defense in depth, and test the actual deployment transaction.
+
+## [M-03] Zero-value borrows can permanently disable batch liquidation
+**Severity**: Medium  
+**Category**: Denial of service / lending  
+**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`), `LendingMarket.liquidateAll()` (`src/LendingMarket.sol:190`)
+
+**Description**: `_borrow` appends the borrower whenever their principal is zero and accepts `amount == 0`. The same account can therefore append itself indefinitely because its principal stays zero. Entries are never removed, and `liquidateAll` walks the entire array with external oracle and vault calls.
+
+**Proof of Concept**: An attacker repeatedly calls `borrow(0)`, permanently growing `borrowers`. Once iteration exceeds the Arbitrum block gas limit, every `liquidateAll` call reverts or runs out of gas. The attacker gains a window in which keeper batch liquidation cannot respond to a broad price move, increasing bad debt, though individual liquidation remains possible.
+
+**Recommendation**: Reject zero and enforce a meaningful minimum position size. Maintain unique active borrowers with explicit activation/deactivation, and replace the unbounded sweep with cursor-based, bounded batches that tolerate individual failures.
+
+## [M-04] Raw ERC-20 calls can create accounting without token movement
+**Severity**: Medium  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()`, `withdraw()`, and `seize()`; `LendingMarket._borrow()`, `repay()`, and `_liquidate()`
+
+**Description**: Every token operation uses the raw interface and ignores the returned boolean. If a listed token returns `false` without reverting, deposits are credited although nothing arrived; similarly, a false-returning transfer can reduce balances or debt without payment. Tokens that return no data instead revert during ABI decoding. Launch USDC and wstETH are not expected to exhibit this behavior, but the generic listing path does not enforce that assumption and USDT is announced next.
+
+**Proof of Concept**: If governance lists a token whose `transferFrom` returns false, an attacker calls `deposit`; `balanceOf` increases without backing assets. The market values that claim and sends real USDC to the attacker. On the debt side, an unsuccessful false-returning repayment can reduce recorded debt without receiving funds.
+
+**Recommendation**: Use a proven `SafeERC20` implementation for every transfer and transferFrom. For deposits, additionally measure the before/after vault balance and either credit the actual delta or reject any mismatch. Pin and integration-test the exact token contracts before listing.
+
+## [M-05] Signed borrow authorizations never expire
+**Severity**: Medium  
+**Category**: Signatures  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`), `BORROW_TYPEHASH`
+
+**Description**: The EIP-712 message has no deadline. An unexecuted authorization remains valid indefinitely, even after market conditions, deposited collateral, or the signer's intent changes.
+
+**Proof of Concept**: A holder waits months before submitting an old signature at the moment forced leverage is most harmful. The borrower receives unwanted debt and can later lose the liquidation bonus. The holder does not need a fresh authorization and the borrower has no on-chain expiry protection.
+
+**Recommendation**: Add `nonce` and `deadline` to the type hash, reject expired messages, and provide nonce cancellation. Recompute the domain separator on chain-ID changes through a vetted EIP-712 implementation.
+
+## [M-06] Immediate single-key administration creates uncompensated governance risk
+**Severity**: Medium  
+**Category**: Access control / trust model  
+**Location**: `LendingMarket.setBorrowRate()`, `LendingMarket.listCollateral()`, `PriceOracle.setFeed()`
+
+**Description**: After the missing modifiers are fixed, an owner can still immediately list worthless collateral, replace a price feed, or set an unbounded borrow rate. A compromised or mistaken owner can drain treasury liquidity through bad collateral pricing or make interest accrual overflow and freeze debt-dependent operations. Borrowers receive no time to repay or withdraw before changes take effect.
+
+**Proof of Concept**: The owner key lists an attacker-controlled token and configures an inflated feed, allowing its holder to borrow the USDC treasury. Alternatively, an extreme `borrowRate` makes `accrueInterest` revert on overflow, blocking borrow, repay, and liquidation.
+
+**Recommendation**: Use a multisig plus timelock, bounded parameters, two-step feed/listing activation, and an emergency guardian with narrowly scoped pause powers. Emit proposed changes before their activation and document the trust model.
+
+## [L-01] Interest accrual uses coarse Arbitrum L1-block timing
+**Severity**: Low  
+**Category**: Arbitrum / interest accounting  
+**Location**: `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:117`), `SECONDS_PER_BLOCK` (`src/LendingMarket.sol:15`)
+
+**Description**: On Arbitrum, Solidity `block.number` approximates the L1 block number; many L2 transactions can share it, and updates occur in jumps. Multiplying the difference by 12 seconds is reasonable only over longer periods. Short-term debt and health are path-dependent: many L2 transactions can accrue nothing, followed by a jump.
+
+**Proof of Concept**: A borrower opens and repays across L2 blocks that report the same L1 block number and pays no interest for that interval. A user transacting after the next update bears the coarse index jump. The extractable amount per short interval is small, so this is Low rather than a solvency finding.
+
+**Recommendation**: Track `lastAccrualTimestamp` and use `block.timestamp - lastAccrualTimestamp`; test long inactivity and sequencer downtime. Do not switch to Arbitrum's fast L2 block number while retaining a 12-second multiplier.
+
+## [L-02] Ownership transfer can permanently lose oracle administration
+**Severity**: Low  
+**Category**: Access control  
+**Location**: `PriceOracle.transferOwnership()` (`src/PriceOracle.sol:28`)
+
+**Description**: Ownership transfers in one step and allow the zero address. A typo, wrong network address, or zero address permanently removes the ability to update feeds, potentially leaving stale or deprecated feeds in service.
+
+**Proof of Concept**: The owner transfers ownership to an address without a usable key. No account can call `setFeed`; if the configured feed is later retired, oracle-dependent market operations become unsafe or unavailable.
+
+**Recommendation**: Reject the zero address and use a two-step ownership transfer in which the nominated owner explicitly accepts.
+
+## Future collateral listing blockers
+
+These are concrete incompatibilities, not launch findings for non-rebasing wstETH:
+
+### [R-01] Fee-on-transfer collateral is overcredited
+**Severity**: Medium (conditional on listing)  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()` (`src/CollateralVault.sol:35`)
+
+**Description**: The vault credits the requested amount rather than the received balance delta. A transfer-tax token creates claims greater than vault assets and lets borrowers use nonexistent collateral value.
+
+**Proof of Concept**: With a 50% transfer tax, a nominal deposit of 100 credits 100 while the vault receives 50. At 80% LTV the attacker can borrow about 80 units against 50 units of assets, leaving treasury bad debt. Later users can also be unable to withdraw their recorded balances.
+
+**Recommendation**: Do not list fee-on-transfer collateral unless all inbound, outbound, and liquidation fees are explicitly modeled. Measure balance deltas and reject or consistently account for any mismatch.
+
+### [R-02] Rebasing collateral makes nominal balances insolvent or strands yield
+**Severity**: Medium (conditional on listing)  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.balanceOf`, `deposit()`, `withdraw()`, and `seize()`
+
+**Description**: User balances are fixed nominal amounts. A negative rebase leaves claims and borrow capacity above actual vault assets; a positive rebase leaves unallocated assets that no user can withdraw. The README explicitly requests a future path to rebasing collateral, but the current accounting is not that path.
+
+**Proof of Concept**: Users deposit 100 units and a negative rebase leaves the vault with 80. The mappings still total 100 and are valued as 100, permitting borrowing against 20 nonexistent units; aggregate withdrawals or seizures eventually revert. A positive rebase strands the opposite surplus.
+
+**Recommendation**: Do not list rebasing tokens in this vault. Use audited share accounting against live total assets or require a non-rebasing wrapper, paired with an oracle that prices the wrapper and its exchange rate.
+
+### [R-03] Hook-capable collateral can reenter withdrawal before accounting is reduced
+**Severity**: Medium (conditional on listing)  
+**Category**: Reentrancy / ERC-20 integration  
+**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)
+
+**Description**: `withdraw` transfers before decrementing `balanceOf`. A token with recipient callbacks can reenter while the original balance remains visible and withdraw the same claim repeatedly from pooled vault funds.
+
+**Proof of Concept**: An attacker with a recorded balance of `X` receives a callback during `transfer` and reenters `withdraw(token, X)`. Each nested call sees the unchanged balance and transfers another `X`; the outer calls later all write the same reduced balance. The attacker receives other users' collateral.
+
+**Recommendation**: Follow checks-effects-interactions by decrementing the balance before transfer; a later health-check revert will roll back all effects. Add a reentrancy guard and disallow callback tokens unless an adapter receives a separate review.
+
+## Review notes and remediation order
+
+Fix C-01, C-02, and H-01 first and test every privileged selector through the proxy. Next correct health math and oracle validation, then add nonces/deadlines and redesign bad-debt liquidation. Deploy only through a reproducible script that initializes atomically and transfers bounded administration to the intended multisig/timelock.
+
+The workspace compiled successfully with Foundry. There is no test suite, deployment script, invariant suite, or live configuration to validate. This review is source-level and cannot establish the correctness of deployment parameters or off-chain keeper behavior. Add unit, fuzz, invariant, fork, and upgrade-layout tests before commissioning a remediation review.

exec
/bin/bash -lc "test -f AUDIT-REPORT.md && wc -l AUDIT-REPORT.md && git status --short && git diff -- src && git diff --check -- AUDIT-REPORT.md && sed -n '1,45p' AUDIT-REPORT.md" in /tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001
 succeeded in 2ms:
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..a2a400c62b29ae3fa6c056b4f3c37b632074d6a9
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,242 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-03  
+**Scope:** `README.md`, `src/LendingMarket.sol`, `src/CollateralVault.sol`, `src/PriceOracle.sol`, `src/MarketProxy.sol`, and interfaces  
+**Deployment:** Arbitrum One  
+**Revision:** local workspace as reviewed; no repository commit was available
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Two unauthenticated control-plane functions allow any account to take over pricing or replace all market code and drain the treasury. A third unauthenticated setter lets an attacker liquidate otherwise healthy users. These are direct, practical attacks and must be fixed before deployment.
+
+The health-factor formula also liquidates positions that are safely collateralized under the documented parameters. Oracle validation is insufficient for Chainlink on Arbitrum, and the signed-borrow path can be replayed. The current liquidation design has no economically viable bad-debt path after a sharp price fall.
+
+| Rank | ID | Severity | Finding |
+|---:|---|---|---|
+| 1 | C-01 | Critical | Anyone can replace the implementation and drain all market and vault funds |
+| 2 | C-02 | Critical | Anyone can install a fake oracle and borrow all treasury USDC |
+| 3 | H-01 | High | Anyone can force liquidation by changing the liquidation threshold |
+| 4 | H-02 | High | Health-factor precision makes positions below 200% liquidatable |
+| 5 | H-03 | High | Chainlink prices lack freshness, round, answer, and Arbitrum sequencer checks |
+| 6 | H-04 | High | Borrow signatures can be replayed until the signer is maximally indebted |
+| 7 | H-05 | High | Deeply underwater positions have no economically viable liquidation path |
+| 8 | M-01 | Medium | The configured stETH/USD feed undervalues wstETH collateral |
+| 9 | M-02 | Medium | Empty proxy initialization can give the first caller ownership |
+| 10 | M-03 | Medium | Zero-value borrows can permanently disable batch liquidation |
+| 11 | M-04 | Medium | Raw ERC-20 calls can create accounting without token movement |
+| 12 | M-05 | Medium | Signed borrow authorizations never expire |
+| 13 | M-06 | Medium | Immediate single-key administration creates uncompensated governance risk |
+| 14 | L-01 | Low | Interest accrual uses coarse Arbitrum L1-block timing |
+| 15 | L-02 | Low | Ownership transfer can permanently lose oracle administration |
+
+The future-collateral section records blockers for the announced listing roadmap. They do not affect launch wstETH by themselves, but those asset classes must not be listed through the current generic path.
+
+## Findings
+
+## [C-01] Anyone can replace the implementation and drain all market and vault funds
+**Severity**: Critical  
+**Category**: Proxies / access control  
+**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
+
+**Description**: `upgradeTo` writes the ERC-1967 implementation slot without `onlyOwner` or any implementation validation. Any account can make `MarketProxy` delegatecall arbitrary attacker code. Treasury USDC is held at the proxy, and malicious delegatecalled code can also call `CollateralVault.seize`: the vault sees the caller as the authorized market proxy.
+
+**Proof of Concept**: An attacker deploys an implementation whose function transfers the proxy's USDC balance to the attacker and calls `vault.seize(user, token, attacker, amount)`. The attacker calls `upgradeTo(maliciousImplementation)` through the proxy and then invokes the drain function. They receive all seeded USDC and any recorded user collateral. Upgrading to an EOA or incompatible contract can instead permanently brick the market.
+
+**Recommendation**: Treat this as a deployment blocker. Use an audited UUPS implementation, authorize upgrades with an owner-only `_authorizeUpgrade`, require deployed code and the correct `proxiableUUID`, and place upgrade authority behind a multisig and timelock. Test unauthorized, incompatible, and rollback upgrade cases.
+
+## [C-02] Anyone can install a fake oracle and borrow all treasury USDC
+**Severity**: Critical  
+**Category**: Access control / oracle  
+**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)
+
+**Description**: `setOracle` has no access control. An attacker can install an ABI-compatible oracle that assigns an arbitrarily high value to their collateral.
+
+**Proof of Concept**: The attacker deposits a small amount of wstETH, calls `setOracle` with a contract returning an enormous wstETH price and a nonzero USDC price, then borrows the market's entire USDC balance. The fabricated health factor passes and the attacker receives the treasury's USDC for negligible collateral.
+
+**Recommendation**: Add `onlyOwner`, reject zero/non-contract addresses, and use a timelocked two-step oracle change. Validate the complete feed configuration before activation and add an emergency pause that can stop new borrowing without stopping repayment.
+
+## [H-01] Anyone can force liquidation by changing the liquidation threshold
+**Severity**: High  
+**Category**: Access control  
+**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)
+
+**Description**: The setter is unauthenticated and unbounded. Any account can set the threshold to zero, making every indebted account's health factor zero, or set extreme values that make health calculations revert.
+
+**Proof of Concept**: An attacker sets the threshold to zero, approves enough USDC, and calls `liquidate` on a previously healthy borrower. The attacker repays that user's debt and receives collateral worth up to 105% of it, extracting the 5% bonus from a user who should not have been liquidatable.
+
+**Recommendation**: Add `onlyOwner`, enforce a protocol-approved range strictly below `BPS`, and apply risk-parameter changes through a timelock. Test zero, `BPS`, over-`BPS`, and exact-boundary values.
+
+## [H-02] Health-factor precision makes positions below 200% liquidatable
+**Severity**: High  
+**Category**: Precision math / lending  
+**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:146`)
+
+**Description**: The formula divides `collateralValueUsd` by `debtUsd` before multiplying. Integer division truncates every collateral ratio from 1.0 up to 1.999... to `1`. With the 80% threshold, all such accounts receive a health factor of `0.8e18`. The documented parameters should permit positions at or above 125%, but the implementation effectively requires 200%.
+
+**Proof of Concept**: A position with $200 collateral and $100 debt passes. After a move to $199 collateral, its intended health factor is 1.592, but the contract returns 0.8. A liquidator can repay $100 and receive $105 of the user's collateral, taking a $5 bonus despite the position remaining economically healthy.
+
+**Recommendation**: Multiply before dividing using full-precision math, for example `mulDiv(collateralUsd, liquidationThreshold * WAD, debtUsd * BPS)`, with an overflow-safe implementation. Add tests immediately below, at, and above 125% and 200%.
+
+## [H-03] Chainlink prices lack freshness, round, answer, and Arbitrum sequencer checks
+**Severity**: High  
+**Category**: Oracle / Arbitrum  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`); consumed by `LendingMarket._borrow()` and `LendingMarket.liquidate()`
+
+**Description**: `getPrice` uses deprecated `latestAnswer()` and accepts the result without checking that it is positive, fresh, or from a completed round. It also does not consult Arbitrum's sequencer uptime feed or enforce a grace period after recovery. Stale values can therefore be used for the two value-moving decisions in the system: borrowing and liquidation. A zero answer also causes divisions to revert; a negative answer reverts during conversion/multiplication rather than failing with a controlled oracle error.
+
+**Proof of Concept**: After a sequencer outage or delayed feed update, a user can borrow treasury USDC against collateral whose stale price is above its current market value. In the opposite price direction, a liquidator can use a stale value to seize collateral from a position that is healthy at current prices. The attacker or borrower retains the extracted USDC or liquidation bonus; the treasury or liquidated user absorbs the loss.
+
+**Recommendation**: Use `latestRoundData`; require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. Check the Arbitrum One sequencer uptime feed, require the sequencer to be up, and enforce a recovery grace period before borrowing or liquidation resumes. Permit repayments while oracle-dependent actions are paused.
+
+## [H-04] Borrow signatures can be replayed until the signer is maximally indebted
+**Severity**: High  
+**Category**: Signatures / lending  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`), `BORROW_TYPEHASH` (`src/LendingMarket.sol:11`)
+
+**Description**: The signed struct contains only `(borrower, amount)`. It has no nonce and successful digests are not marked as used. Anyone who obtains one valid authorization can submit it repeatedly; every replay adds debt and sends another `amount` of USDC to the signer until the health check rejects the next call.
+
+**Proof of Concept**: A relayer observes one valid borrow signature and replays it until the borrower's collateral is at the maximum permitted leverage. After a small interest or price move, the relayer can liquidate and receive the 5% bonus. The borrower gets unwanted USDC transfers but must actively repay them or suffer forced liquidation; the authorization was not one-time as represented.
+
+**Recommendation**: Include a per-borrower nonce in the EIP-712 struct, verify it, and increment it before `_borrow`. Provide explicit nonce invalidation. Use a vetted EIP-712/ECDSA library that rejects malleable signatures, and test replay and cancellation.
+
+## [H-05] Deeply underwater positions have no economically viable liquidation path
+**Severity**: High  
+**Category**: Lending / bad debt  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)
+
+**Description**: A liquidator must transfer the borrower's entire debt before collateral is seized. Seizure is capped by available collateral. When collateral is worth less than the debt, liquidation guarantees a loss; below 105% it cannot pay the advertised bonus. There is no partial liquidation, close factor, auction, reserve, insurance, or bad-debt write-off path.
+
+**Proof of Concept**: If a rapid wstETH move leaves $80 of collateral against $100 debt, a liquidator must pay $100 and can receive at most $80. Rational liquidators do nothing. The borrower retains the uncovered borrowed value and treasury liquidity remains undercollateralized; large accounts additionally require full-debt liquidity from one liquidator.
+
+**Recommendation**: Support bounded partial liquidation and calculate repayable debt from collateral that can actually be seized. Cap the bonus to available value, and add an explicit residual bad-debt mechanism backed by reserves, insurance, or an auction/backstop. Stress-test large single-update moves and feed gaps.
+
+## [M-01] The configured stETH/USD feed undervalues wstETH collateral
+**Severity**: Medium  
+**Category**: Oracle / yield-bearing collateral  
+**Location**: `README.md` feed configuration; `LendingMarket.collateralValueUsd()` (`src/LendingMarket.sol:132`); `PriceOracle.getPrice()`
+
+**Description**: The launch collateral is wstETH, but the configured feed prices one stETH. One wstETH represents a changing amount of stETH. The market treats the feed answer as the value of one whole wstETH and omits the wrapper exchange rate, systematically understating collateral value.
+
+**Proof of Concept**: A user whose wstETH's underlying stETH value leaves them above the real liquidation threshold can appear below it on-chain. A liquidator receives the 5% bonus and the user suffers an unintended unwind. Borrow capacity is also lower than intended, and the discrepancy grows as staking yield accrues.
+
+**Recommendation**: Use a validated direct wstETH/USD feed or an adapter that composes stETH/USD with the canonical wstETH-to-stETH conversion rate and normalizes decimals. Test the exact production addresses and exchange-rate direction.
+
+## [M-02] Empty proxy initialization can give the first caller ownership
+**Severity**: Medium  
+**Category**: Proxy deployment  
+**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`), `LendingMarket.initialize()` (`src/LendingMarket.sol:56`)
+
+**Description**: The proxy permits empty `initData`, while `initialize` is externally callable by anyone. No deployment script proves atomic initialization. If deployment and initialization are separate transactions, the first caller selects the owner, oracle, vault, and debt asset.
+
+**Proof of Concept**: A proxy is deployed with empty initialization data. An observer front-runs the intended initialization and calls `initialize(attacker, fakeOracle, fakeVault, fakeAsset)`. The legitimate call then reverts with `AlreadyInitialized`, and the attacker controls every owner-gated function.
+
+**Recommendation**: Require nonempty constructor initialization data for this market and initialize atomically. Validate nonzero contract parameters. Disable initialization on the standalone implementation as defense in depth, and test the actual deployment transaction.
+
+## [M-03] Zero-value borrows can permanently disable batch liquidation
+**Severity**: Medium  
+**Category**: Denial of service / lending  
+**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`), `LendingMarket.liquidateAll()` (`src/LendingMarket.sol:190`)
+
+**Description**: `_borrow` appends the borrower whenever their principal is zero and accepts `amount == 0`. The same account can therefore append itself indefinitely because its principal stays zero. Entries are never removed, and `liquidateAll` walks the entire array with external oracle and vault calls.
+
+**Proof of Concept**: An attacker repeatedly calls `borrow(0)`, permanently growing `borrowers`. Once iteration exceeds the Arbitrum block gas limit, every `liquidateAll` call reverts or runs out of gas. The attacker gains a window in which keeper batch liquidation cannot respond to a broad price move, increasing bad debt, though individual liquidation remains possible.
+
+**Recommendation**: Reject zero and enforce a meaningful minimum position size. Maintain unique active borrowers with explicit activation/deactivation, and replace the unbounded sweep with cursor-based, bounded batches that tolerate individual failures.
+
+## [M-04] Raw ERC-20 calls can create accounting without token movement
+**Severity**: Medium  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()`, `withdraw()`, and `seize()`; `LendingMarket._borrow()`, `repay()`, and `_liquidate()`
+
+**Description**: Every token operation uses the raw interface and ignores the returned boolean. If a listed token returns `false` without reverting, deposits are credited although nothing arrived; similarly, a false-returning transfer can reduce balances or debt without payment. Tokens that return no data instead revert during ABI decoding. Launch USDC and wstETH are not expected to exhibit this behavior, but the generic listing path does not enforce that assumption and USDT is announced next.
+
+**Proof of Concept**: If governance lists a token whose `transferFrom` returns false, an attacker calls `deposit`; `balanceOf` increases without backing assets. The market values that claim and sends real USDC to the attacker. On the debt side, an unsuccessful false-returning repayment can reduce recorded debt without receiving funds.
+
+**Recommendation**: Use a proven `SafeERC20` implementation for every transfer and transferFrom. For deposits, additionally measure the before/after vault balance and either credit the actual delta or reject any mismatch. Pin and integration-test the exact token contracts before listing.
+
+## [M-05] Signed borrow authorizations never expire
+**Severity**: Medium  
+**Category**: Signatures  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`), `BORROW_TYPEHASH`
+
+**Description**: The EIP-712 message has no deadline. An unexecuted authorization remains valid indefinitely, even after market conditions, deposited collateral, or the signer's intent changes.
+
+**Proof of Concept**: A holder waits months before submitting an old signature at the moment forced leverage is most harmful. The borrower receives unwanted debt and can later lose the liquidation bonus. The holder does not need a fresh authorization and the borrower has no on-chain expiry protection.
+
+**Recommendation**: Add `nonce` and `deadline` to the type hash, reject expired messages, and provide nonce cancellation. Recompute the domain separator on chain-ID changes through a vetted EIP-712 implementation.
+
+## [M-06] Immediate single-key administration creates uncompensated governance risk
+**Severity**: Medium  
+**Category**: Access control / trust model  
+**Location**: `LendingMarket.setBorrowRate()`, `LendingMarket.listCollateral()`, `PriceOracle.setFeed()`
+
+**Description**: After the missing modifiers are fixed, an owner can still immediately list worthless collateral, replace a price feed, or set an unbounded borrow rate. A compromised or mistaken owner can drain treasury liquidity through bad collateral pricing or make interest accrual overflow and freeze debt-dependent operations. Borrowers receive no time to repay or withdraw before changes take effect.
+
+**Proof of Concept**: The owner key lists an attacker-controlled token and configures an inflated feed, allowing its holder to borrow the USDC treasury. Alternatively, an extreme `borrowRate` makes `accrueInterest` revert on overflow, blocking borrow, repay, and liquidation.
+
+**Recommendation**: Use a multisig plus timelock, bounded parameters, two-step feed/listing activation, and an emergency guardian with narrowly scoped pause powers. Emit proposed changes before their activation and document the trust model.
+
+## [L-01] Interest accrual uses coarse Arbitrum L1-block timing
+**Severity**: Low  
+**Category**: Arbitrum / interest accounting  
+**Location**: `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:117`), `SECONDS_PER_BLOCK` (`src/LendingMarket.sol:15`)
+
+**Description**: On Arbitrum, Solidity `block.number` approximates the L1 block number; many L2 transactions can share it, and updates occur in jumps. Multiplying the difference by 12 seconds is reasonable only over longer periods. Short-term debt and health are path-dependent: many L2 transactions can accrue nothing, followed by a jump.
+
+**Proof of Concept**: A borrower opens and repays across L2 blocks that report the same L1 block number and pays no interest for that interval. A user transacting after the next update bears the coarse index jump. The extractable amount per short interval is small, so this is Low rather than a solvency finding.
+
+**Recommendation**: Track `lastAccrualTimestamp` and use `block.timestamp - lastAccrualTimestamp`; test long inactivity and sequencer downtime. Do not switch to Arbitrum's fast L2 block number while retaining a 12-second multiplier.
+
+## [L-02] Ownership transfer can permanently lose oracle administration
+**Severity**: Low  
+**Category**: Access control  
+**Location**: `PriceOracle.transferOwnership()` (`src/PriceOracle.sol:28`)
+
+**Description**: Ownership transfers in one step and allow the zero address. A typo, wrong network address, or zero address permanently removes the ability to update feeds, potentially leaving stale or deprecated feeds in service.
+
+**Proof of Concept**: The owner transfers ownership to an address without a usable key. No account can call `setFeed`; if the configured feed is later retired, oracle-dependent market operations become unsafe or unavailable.
+
+**Recommendation**: Reject the zero address and use a two-step ownership transfer in which the nominated owner explicitly accepts.
+
+## Future collateral listing blockers
+
+These are concrete incompatibilities, not launch findings for non-rebasing wstETH:
+
+### [R-01] Fee-on-transfer collateral is overcredited
+**Severity**: Medium (conditional on listing)  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()` (`src/CollateralVault.sol:35`)
+
+**Description**: The vault credits the requested amount rather than the received balance delta. A transfer-tax token creates claims greater than vault assets and lets borrowers use nonexistent collateral value.
+
+**Proof of Concept**: With a 50% transfer tax, a nominal deposit of 100 credits 100 while the vault receives 50. At 80% LTV the attacker can borrow about 80 units against 50 units of assets, leaving treasury bad debt. Later users can also be unable to withdraw their recorded balances.
+
+**Recommendation**: Do not list fee-on-transfer collateral unless all inbound, outbound, and liquidation fees are explicitly modeled. Measure balance deltas and reject or consistently account for any mismatch.
+
+### [R-02] Rebasing collateral makes nominal balances insolvent or strands yield
+**Severity**: Medium (conditional on listing)  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.balanceOf`, `deposit()`, `withdraw()`, and `seize()`
+
+**Description**: User balances are fixed nominal amounts. A negative rebase leaves claims and borrow capacity above actual vault assets; a positive rebase leaves unallocated assets that no user can withdraw. The README explicitly requests a future path to rebasing collateral, but the current accounting is not that path.
+
+**Proof of Concept**: Users deposit 100 units and a negative rebase leaves the vault with 80. The mappings still total 100 and are valued as 100, permitting borrowing against 20 nonexistent units; aggregate withdrawals or seizures eventually revert. A positive rebase strands the opposite surplus.
+
+**Recommendation**: Do not list rebasing tokens in this vault. Use audited share accounting against live total assets or require a non-rebasing wrapper, paired with an oracle that prices the wrapper and its exchange rate.
+
+### [R-03] Hook-capable collateral can reenter withdrawal before accounting is reduced
+**Severity**: Medium (conditional on listing)  
+**Category**: Reentrancy / ERC-20 integration  
+**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)
+
+**Description**: `withdraw` transfers before decrementing `balanceOf`. A token with recipient callbacks can reenter while the original balance remains visible and withdraw the same claim repeatedly from pooled vault funds.
+
+**Proof of Concept**: An attacker with a recorded balance of `X` receives a callback during `transfer` and reenters `withdraw(token, X)`. Each nested call sees the unchanged balance and transfers another `X`; the outer calls later all write the same reduced balance. The attacker receives other users' collateral.
+
+**Recommendation**: Follow checks-effects-interactions by decrementing the balance before transfer; a later health-check revert will roll back all effects. Add a reentrancy guard and disallow callback tokens unless an adapter receives a separate review.
+
+## Review notes and remediation order
+
+Fix C-01, C-02, and H-01 first and test every privileged selector through the proxy. Next correct health math and oracle validation, then add nonces/deadlines and redesign bad-debt liquidation. Deploy only through a reproducible script that initializes atomically and transfers bounded administration to the intended multisig/timelock.
+
+The workspace compiled successfully with Foundry. There is no test suite, deployment script, invariant suite, or live configuration to validate. This review is source-level and cannot establish the correctness of deployment parameters or off-chain keeper behavior. Add unit, fuzz, invariant, fork, and upgrade-layout tests before commissioning a remediation review.

codex
Created [AUDIT-REPORT.md](/tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001/AUDIT-REPORT.md).

Key result: **not ready for funded deployment**. The report identifies 2 Critical, 5 High, 6 Medium, and 2 Low findings, plus 3 conditional blockers for future collateral listings.

`src/` remains unchanged, and `AUDIT-REPORT.md` is the only new workspace file. Foundry compilation succeeds.
diff --git a/AUDIT-REPORT.md b/AUDIT-REPORT.md
new file mode 100644
index 0000000000000000000000000000000000000000..a2a400c62b29ae3fa6c056b4f3c37b632074d6a9
--- /dev/null
+++ b/AUDIT-REPORT.md
@@ -0,0 +1,242 @@
+# ArbiLend Security Review
+
+**Review date:** 2026-09-03  
+**Scope:** `README.md`, `src/LendingMarket.sol`, `src/CollateralVault.sol`, `src/PriceOracle.sol`, `src/MarketProxy.sol`, and interfaces  
+**Deployment:** Arbitrum One  
+**Revision:** local workspace as reviewed; no repository commit was available
+
+## Executive summary
+
+ArbiLend is **not ready to deploy with funds**. Two unauthenticated control-plane functions allow any account to take over pricing or replace all market code and drain the treasury. A third unauthenticated setter lets an attacker liquidate otherwise healthy users. These are direct, practical attacks and must be fixed before deployment.
+
+The health-factor formula also liquidates positions that are safely collateralized under the documented parameters. Oracle validation is insufficient for Chainlink on Arbitrum, and the signed-borrow path can be replayed. The current liquidation design has no economically viable bad-debt path after a sharp price fall.
+
+| Rank | ID | Severity | Finding |
+|---:|---|---|---|
+| 1 | C-01 | Critical | Anyone can replace the implementation and drain all market and vault funds |
+| 2 | C-02 | Critical | Anyone can install a fake oracle and borrow all treasury USDC |
+| 3 | H-01 | High | Anyone can force liquidation by changing the liquidation threshold |
+| 4 | H-02 | High | Health-factor precision makes positions below 200% liquidatable |
+| 5 | H-03 | High | Chainlink prices lack freshness, round, answer, and Arbitrum sequencer checks |
+| 6 | H-04 | High | Borrow signatures can be replayed until the signer is maximally indebted |
+| 7 | H-05 | High | Deeply underwater positions have no economically viable liquidation path |
+| 8 | M-01 | Medium | The configured stETH/USD feed undervalues wstETH collateral |
+| 9 | M-02 | Medium | Empty proxy initialization can give the first caller ownership |
+| 10 | M-03 | Medium | Zero-value borrows can permanently disable batch liquidation |
+| 11 | M-04 | Medium | Raw ERC-20 calls can create accounting without token movement |
+| 12 | M-05 | Medium | Signed borrow authorizations never expire |
+| 13 | M-06 | Medium | Immediate single-key administration creates uncompensated governance risk |
+| 14 | L-01 | Low | Interest accrual uses coarse Arbitrum L1-block timing |
+| 15 | L-02 | Low | Ownership transfer can permanently lose oracle administration |
+
+The future-collateral section records blockers for the announced listing roadmap. They do not affect launch wstETH by themselves, but those asset classes must not be listed through the current generic path.
+
+## Findings
+
+## [C-01] Anyone can replace the implementation and drain all market and vault funds
+**Severity**: Critical  
+**Category**: Proxies / access control  
+**Location**: `LendingMarket.upgradeTo()` (`src/LendingMarket.sol:84`)
+
+**Description**: `upgradeTo` writes the ERC-1967 implementation slot without `onlyOwner` or any implementation validation. Any account can make `MarketProxy` delegatecall arbitrary attacker code. Treasury USDC is held at the proxy, and malicious delegatecalled code can also call `CollateralVault.seize`: the vault sees the caller as the authorized market proxy.
+
+**Proof of Concept**: An attacker deploys an implementation whose function transfers the proxy's USDC balance to the attacker and calls `vault.seize(user, token, attacker, amount)`. The attacker calls `upgradeTo(maliciousImplementation)` through the proxy and then invokes the drain function. They receive all seeded USDC and any recorded user collateral. Upgrading to an EOA or incompatible contract can instead permanently brick the market.
+
+**Recommendation**: Treat this as a deployment blocker. Use an audited UUPS implementation, authorize upgrades with an owner-only `_authorizeUpgrade`, require deployed code and the correct `proxiableUUID`, and place upgrade authority behind a multisig and timelock. Test unauthorized, incompatible, and rollback upgrade cases.
+
+## [C-02] Anyone can install a fake oracle and borrow all treasury USDC
+**Severity**: Critical  
+**Category**: Access control / oracle  
+**Location**: `LendingMarket.setOracle()` (`src/LendingMarket.sol:91`)
+
+**Description**: `setOracle` has no access control. An attacker can install an ABI-compatible oracle that assigns an arbitrarily high value to their collateral.
+
+**Proof of Concept**: The attacker deposits a small amount of wstETH, calls `setOracle` with a contract returning an enormous wstETH price and a nonzero USDC price, then borrows the market's entire USDC balance. The fabricated health factor passes and the attacker receives the treasury's USDC for negligible collateral.
+
+**Recommendation**: Add `onlyOwner`, reject zero/non-contract addresses, and use a timelocked two-step oracle change. Validate the complete feed configuration before activation and add an emergency pause that can stop new borrowing without stopping repayment.
+
+## [H-01] Anyone can force liquidation by changing the liquidation threshold
+**Severity**: High  
+**Category**: Access control  
+**Location**: `LendingMarket.setLiquidationThreshold()` (`src/LendingMarket.sol:96`)
+
+**Description**: The setter is unauthenticated and unbounded. Any account can set the threshold to zero, making every indebted account's health factor zero, or set extreme values that make health calculations revert.
+
+**Proof of Concept**: An attacker sets the threshold to zero, approves enough USDC, and calls `liquidate` on a previously healthy borrower. The attacker repays that user's debt and receives collateral worth up to 105% of it, extracting the 5% bonus from a user who should not have been liquidatable.
+
+**Recommendation**: Add `onlyOwner`, enforce a protocol-approved range strictly below `BPS`, and apply risk-parameter changes through a timelock. Test zero, `BPS`, over-`BPS`, and exact-boundary values.
+
+## [H-02] Health-factor precision makes positions below 200% liquidatable
+**Severity**: High  
+**Category**: Precision math / lending  
+**Location**: `LendingMarket.healthFactor()` (`src/LendingMarket.sol:146`)
+
+**Description**: The formula divides `collateralValueUsd` by `debtUsd` before multiplying. Integer division truncates every collateral ratio from 1.0 up to 1.999... to `1`. With the 80% threshold, all such accounts receive a health factor of `0.8e18`. The documented parameters should permit positions at or above 125%, but the implementation effectively requires 200%.
+
+**Proof of Concept**: A position with $200 collateral and $100 debt passes. After a move to $199 collateral, its intended health factor is 1.592, but the contract returns 0.8. A liquidator can repay $100 and receive $105 of the user's collateral, taking a $5 bonus despite the position remaining economically healthy.
+
+**Recommendation**: Multiply before dividing using full-precision math, for example `mulDiv(collateralUsd, liquidationThreshold * WAD, debtUsd * BPS)`, with an overflow-safe implementation. Add tests immediately below, at, and above 125% and 200%.
+
+## [H-03] Chainlink prices lack freshness, round, answer, and Arbitrum sequencer checks
+**Severity**: High  
+**Category**: Oracle / Arbitrum  
+**Location**: `PriceOracle.getPrice()` (`src/PriceOracle.sol:39`); consumed by `LendingMarket._borrow()` and `LendingMarket.liquidate()`
+
+**Description**: `getPrice` uses deprecated `latestAnswer()` and accepts the result without checking that it is positive, fresh, or from a completed round. It also does not consult Arbitrum's sequencer uptime feed or enforce a grace period after recovery. Stale values can therefore be used for the two value-moving decisions in the system: borrowing and liquidation. A zero answer also causes divisions to revert; a negative answer reverts during conversion/multiplication rather than failing with a controlled oracle error.
+
+**Proof of Concept**: After a sequencer outage or delayed feed update, a user can borrow treasury USDC against collateral whose stale price is above its current market value. In the opposite price direction, a liquidator can use a stale value to seize collateral from a position that is healthy at current prices. The attacker or borrower retains the extracted USDC or liquidation bonus; the treasury or liquidated user absorbs the loss.
+
+**Recommendation**: Use `latestRoundData`; require `answer > 0`, `updatedAt != 0`, `answeredInRound >= roundId`, and a per-feed maximum age. Check the Arbitrum One sequencer uptime feed, require the sequencer to be up, and enforce a recovery grace period before borrowing or liquidation resumes. Permit repayments while oracle-dependent actions are paused.
+
+## [H-04] Borrow signatures can be replayed until the signer is maximally indebted
+**Severity**: High  
+**Category**: Signatures / lending  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`), `BORROW_TYPEHASH` (`src/LendingMarket.sol:11`)
+
+**Description**: The signed struct contains only `(borrower, amount)`. It has no nonce and successful digests are not marked as used. Anyone who obtains one valid authorization can submit it repeatedly; every replay adds debt and sends another `amount` of USDC to the signer until the health check rejects the next call.
+
+**Proof of Concept**: A relayer observes one valid borrow signature and replays it until the borrower's collateral is at the maximum permitted leverage. After a small interest or price move, the relayer can liquidate and receive the 5% bonus. The borrower gets unwanted USDC transfers but must actively repay them or suffer forced liquidation; the authorization was not one-time as represented.
+
+**Recommendation**: Include a per-borrower nonce in the EIP-712 struct, verify it, and increment it before `_borrow`. Provide explicit nonce invalidation. Use a vetted EIP-712/ECDSA library that rejects malleable signatures, and test replay and cancellation.
+
+## [H-05] Deeply underwater positions have no economically viable liquidation path
+**Severity**: High  
+**Category**: Lending / bad debt  
+**Location**: `LendingMarket._liquidate()` (`src/LendingMarket.sol:209`)
+
+**Description**: A liquidator must transfer the borrower's entire debt before collateral is seized. Seizure is capped by available collateral. When collateral is worth less than the debt, liquidation guarantees a loss; below 105% it cannot pay the advertised bonus. There is no partial liquidation, close factor, auction, reserve, insurance, or bad-debt write-off path.
+
+**Proof of Concept**: If a rapid wstETH move leaves $80 of collateral against $100 debt, a liquidator must pay $100 and can receive at most $80. Rational liquidators do nothing. The borrower retains the uncovered borrowed value and treasury liquidity remains undercollateralized; large accounts additionally require full-debt liquidity from one liquidator.
+
+**Recommendation**: Support bounded partial liquidation and calculate repayable debt from collateral that can actually be seized. Cap the bonus to available value, and add an explicit residual bad-debt mechanism backed by reserves, insurance, or an auction/backstop. Stress-test large single-update moves and feed gaps.
+
+## [M-01] The configured stETH/USD feed undervalues wstETH collateral
+**Severity**: Medium  
+**Category**: Oracle / yield-bearing collateral  
+**Location**: `README.md` feed configuration; `LendingMarket.collateralValueUsd()` (`src/LendingMarket.sol:132`); `PriceOracle.getPrice()`
+
+**Description**: The launch collateral is wstETH, but the configured feed prices one stETH. One wstETH represents a changing amount of stETH. The market treats the feed answer as the value of one whole wstETH and omits the wrapper exchange rate, systematically understating collateral value.
+
+**Proof of Concept**: A user whose wstETH's underlying stETH value leaves them above the real liquidation threshold can appear below it on-chain. A liquidator receives the 5% bonus and the user suffers an unintended unwind. Borrow capacity is also lower than intended, and the discrepancy grows as staking yield accrues.
+
+**Recommendation**: Use a validated direct wstETH/USD feed or an adapter that composes stETH/USD with the canonical wstETH-to-stETH conversion rate and normalizes decimals. Test the exact production addresses and exchange-rate direction.
+
+## [M-02] Empty proxy initialization can give the first caller ownership
+**Severity**: Medium  
+**Category**: Proxy deployment  
+**Location**: `MarketProxy.constructor()` (`src/MarketProxy.sol:10`), `LendingMarket.initialize()` (`src/LendingMarket.sol:56`)
+
+**Description**: The proxy permits empty `initData`, while `initialize` is externally callable by anyone. No deployment script proves atomic initialization. If deployment and initialization are separate transactions, the first caller selects the owner, oracle, vault, and debt asset.
+
+**Proof of Concept**: A proxy is deployed with empty initialization data. An observer front-runs the intended initialization and calls `initialize(attacker, fakeOracle, fakeVault, fakeAsset)`. The legitimate call then reverts with `AlreadyInitialized`, and the attacker controls every owner-gated function.
+
+**Recommendation**: Require nonempty constructor initialization data for this market and initialize atomically. Validate nonzero contract parameters. Disable initialization on the standalone implementation as defense in depth, and test the actual deployment transaction.
+
+## [M-03] Zero-value borrows can permanently disable batch liquidation
+**Severity**: Medium  
+**Category**: Denial of service / lending  
+**Location**: `LendingMarket._borrow()` (`src/LendingMarket.sol:197`), `LendingMarket.liquidateAll()` (`src/LendingMarket.sol:190`)
+
+**Description**: `_borrow` appends the borrower whenever their principal is zero and accepts `amount == 0`. The same account can therefore append itself indefinitely because its principal stays zero. Entries are never removed, and `liquidateAll` walks the entire array with external oracle and vault calls.
+
+**Proof of Concept**: An attacker repeatedly calls `borrow(0)`, permanently growing `borrowers`. Once iteration exceeds the Arbitrum block gas limit, every `liquidateAll` call reverts or runs out of gas. The attacker gains a window in which keeper batch liquidation cannot respond to a broad price move, increasing bad debt, though individual liquidation remains possible.
+
+**Recommendation**: Reject zero and enforce a meaningful minimum position size. Maintain unique active borrowers with explicit activation/deactivation, and replace the unbounded sweep with cursor-based, bounded batches that tolerate individual failures.
+
+## [M-04] Raw ERC-20 calls can create accounting without token movement
+**Severity**: Medium  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()`, `withdraw()`, and `seize()`; `LendingMarket._borrow()`, `repay()`, and `_liquidate()`
+
+**Description**: Every token operation uses the raw interface and ignores the returned boolean. If a listed token returns `false` without reverting, deposits are credited although nothing arrived; similarly, a false-returning transfer can reduce balances or debt without payment. Tokens that return no data instead revert during ABI decoding. Launch USDC and wstETH are not expected to exhibit this behavior, but the generic listing path does not enforce that assumption and USDT is announced next.
+
+**Proof of Concept**: If governance lists a token whose `transferFrom` returns false, an attacker calls `deposit`; `balanceOf` increases without backing assets. The market values that claim and sends real USDC to the attacker. On the debt side, an unsuccessful false-returning repayment can reduce recorded debt without receiving funds.
+
+**Recommendation**: Use a proven `SafeERC20` implementation for every transfer and transferFrom. For deposits, additionally measure the before/after vault balance and either credit the actual delta or reject any mismatch. Pin and integration-test the exact token contracts before listing.
+
+## [M-05] Signed borrow authorizations never expire
+**Severity**: Medium  
+**Category**: Signatures  
+**Location**: `LendingMarket.borrowWithSig()` (`src/LendingMarket.sol:162`), `BORROW_TYPEHASH`
+
+**Description**: The EIP-712 message has no deadline. An unexecuted authorization remains valid indefinitely, even after market conditions, deposited collateral, or the signer's intent changes.
+
+**Proof of Concept**: A holder waits months before submitting an old signature at the moment forced leverage is most harmful. The borrower receives unwanted debt and can later lose the liquidation bonus. The holder does not need a fresh authorization and the borrower has no on-chain expiry protection.
+
+**Recommendation**: Add `nonce` and `deadline` to the type hash, reject expired messages, and provide nonce cancellation. Recompute the domain separator on chain-ID changes through a vetted EIP-712 implementation.
+
+## [M-06] Immediate single-key administration creates uncompensated governance risk
+**Severity**: Medium  
+**Category**: Access control / trust model  
+**Location**: `LendingMarket.setBorrowRate()`, `LendingMarket.listCollateral()`, `PriceOracle.setFeed()`
+
+**Description**: After the missing modifiers are fixed, an owner can still immediately list worthless collateral, replace a price feed, or set an unbounded borrow rate. A compromised or mistaken owner can drain treasury liquidity through bad collateral pricing or make interest accrual overflow and freeze debt-dependent operations. Borrowers receive no time to repay or withdraw before changes take effect.
+
+**Proof of Concept**: The owner key lists an attacker-controlled token and configures an inflated feed, allowing its holder to borrow the USDC treasury. Alternatively, an extreme `borrowRate` makes `accrueInterest` revert on overflow, blocking borrow, repay, and liquidation.
+
+**Recommendation**: Use a multisig plus timelock, bounded parameters, two-step feed/listing activation, and an emergency guardian with narrowly scoped pause powers. Emit proposed changes before their activation and document the trust model.
+
+## [L-01] Interest accrual uses coarse Arbitrum L1-block timing
+**Severity**: Low  
+**Category**: Arbitrum / interest accounting  
+**Location**: `LendingMarket.accrueInterest()` (`src/LendingMarket.sol:117`), `SECONDS_PER_BLOCK` (`src/LendingMarket.sol:15`)
+
+**Description**: On Arbitrum, Solidity `block.number` approximates the L1 block number; many L2 transactions can share it, and updates occur in jumps. Multiplying the difference by 12 seconds is reasonable only over longer periods. Short-term debt and health are path-dependent: many L2 transactions can accrue nothing, followed by a jump.
+
+**Proof of Concept**: A borrower opens and repays across L2 blocks that report the same L1 block number and pays no interest for that interval. A user transacting after the next update bears the coarse index jump. The extractable amount per short interval is small, so this is Low rather than a solvency finding.
+
+**Recommendation**: Track `lastAccrualTimestamp` and use `block.timestamp - lastAccrualTimestamp`; test long inactivity and sequencer downtime. Do not switch to Arbitrum's fast L2 block number while retaining a 12-second multiplier.
+
+## [L-02] Ownership transfer can permanently lose oracle administration
+**Severity**: Low  
+**Category**: Access control  
+**Location**: `PriceOracle.transferOwnership()` (`src/PriceOracle.sol:28`)
+
+**Description**: Ownership transfers in one step and allow the zero address. A typo, wrong network address, or zero address permanently removes the ability to update feeds, potentially leaving stale or deprecated feeds in service.
+
+**Proof of Concept**: The owner transfers ownership to an address without a usable key. No account can call `setFeed`; if the configured feed is later retired, oracle-dependent market operations become unsafe or unavailable.
+
+**Recommendation**: Reject the zero address and use a two-step ownership transfer in which the nominated owner explicitly accepts.
+
+## Future collateral listing blockers
+
+These are concrete incompatibilities, not launch findings for non-rebasing wstETH:
+
+### [R-01] Fee-on-transfer collateral is overcredited
+**Severity**: Medium (conditional on listing)  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.deposit()` (`src/CollateralVault.sol:35`)
+
+**Description**: The vault credits the requested amount rather than the received balance delta. A transfer-tax token creates claims greater than vault assets and lets borrowers use nonexistent collateral value.
+
+**Proof of Concept**: With a 50% transfer tax, a nominal deposit of 100 credits 100 while the vault receives 50. At 80% LTV the attacker can borrow about 80 units against 50 units of assets, leaving treasury bad debt. Later users can also be unable to withdraw their recorded balances.
+
+**Recommendation**: Do not list fee-on-transfer collateral unless all inbound, outbound, and liquidation fees are explicitly modeled. Measure balance deltas and reject or consistently account for any mismatch.
+
+### [R-02] Rebasing collateral makes nominal balances insolvent or strands yield
+**Severity**: Medium (conditional on listing)  
+**Category**: ERC-20 integration  
+**Location**: `CollateralVault.balanceOf`, `deposit()`, `withdraw()`, and `seize()`
+
+**Description**: User balances are fixed nominal amounts. A negative rebase leaves claims and borrow capacity above actual vault assets; a positive rebase leaves unallocated assets that no user can withdraw. The README explicitly requests a future path to rebasing collateral, but the current accounting is not that path.
+
+**Proof of Concept**: Users deposit 100 units and a negative rebase leaves the vault with 80. The mappings still total 100 and are valued as 100, permitting borrowing against 20 nonexistent units; aggregate withdrawals or seizures eventually revert. A positive rebase strands the opposite surplus.
+
+**Recommendation**: Do not list rebasing tokens in this vault. Use audited share accounting against live total assets or require a non-rebasing wrapper, paired with an oracle that prices the wrapper and its exchange rate.
+
+### [R-03] Hook-capable collateral can reenter withdrawal before accounting is reduced
+**Severity**: Medium (conditional on listing)  
+**Category**: Reentrancy / ERC-20 integration  
+**Location**: `CollateralVault.withdraw()` (`src/CollateralVault.sol:44`)
+
+**Description**: `withdraw` transfers before decrementing `balanceOf`. A token with recipient callbacks can reenter while the original balance remains visible and withdraw the same claim repeatedly from pooled vault funds.
+
+**Proof of Concept**: An attacker with a recorded balance of `X` receives a callback during `transfer` and reenters `withdraw(token, X)`. Each nested call sees the unchanged balance and transfers another `X`; the outer calls later all write the same reduced balance. The attacker receives other users' collateral.
+
+**Recommendation**: Follow checks-effects-interactions by decrementing the balance before transfer; a later health-check revert will roll back all effects. Add a reentrancy guard and disallow callback tokens unless an adapter receives a separate review.
+
+## Review notes and remediation order
+
+Fix C-01, C-02, and H-01 first and test every privileged selector through the proxy. Next correct health math and oracle validation, then add nonces/deadlines and redesign bad-debt liquidation. Deploy only through a reproducible script that initializes atomically and transfers bounded administration to the intended multisig/timelock.
+
+The workspace compiled successfully with Foundry. There is no test suite, deployment script, invariant suite, or live configuration to validate. This review is source-level and cannot establish the correctness of deployment parameters or off-chain keeper behavior. Add unit, fuzz, invariant, fork, and upgrade-layout tests before commissioning a remediation review.

tokens used
83,837
```

## final message

Created [AUDIT-REPORT.md](/tmp/ethskills-audit-eval/2026-09-03T134529Z-codex-with-skill-2/audit-goal-001/AUDIT-REPORT.md).

Key result: **not ready for funded deployment**. The report identifies 2 Critical, 5 High, 6 Medium, and 2 Low findings, plus 3 conditional blockers for future collateral listings.

`src/` remains unchanged, and `AUDIT-REPORT.md` is the only new workspace file. Foundry compilation succeeds.
