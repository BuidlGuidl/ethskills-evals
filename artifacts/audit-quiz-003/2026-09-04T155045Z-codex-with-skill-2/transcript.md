# Executor transcript — 2026-09-04T155045Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-04T155045Z-codex-with-skill-2/audit-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-04T155045Z-codex-with-skill-2/audit-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06d27-0ba4-7a32-8be6-9c877b6711ce
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

codex
I’m treating this as a smart-contract security review and will use the audit skill to trace the replay surface, rank the risks, and specify a concrete patch.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/audit/SKILL.md" in /tmp/ethskills-audit-eval/2026-09-04T155045Z-codex-with-skill-2/audit-quiz-003
 succeeded in 0ms:
codex
The identical calldata is the key evidence: this is a replay, not a forged signature. I’m checking both the immediate nonce omission and the broader domain/signature edge cases so the shipped fix closes the whole authorization class.
exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/ffe4b670e78e1945bcf275f79d4b7b0481bcff35/evm-audit-signatures/references/checklist.md && curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/ffe4b670e78e1945bcf275f79d4b7b0481bcff35/evm-audit-general/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-04T155045Z-codex-with-skill-2/audit-quiz-003
 succeeded in 512ms:
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

codex
The patch needs a migration detail that is easy to miss: adding a safe new function is insufficient if the old `borrowWithSig` selector remains callable. The release must disable that path and change the EIP-712 version so every outstanding version-1 signature becomes unusable.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-04T155045Z-codex-with-skill-2/audit-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..6564f14ec8a3b35a296acd328aa9ae1cb76d9de1
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,103 @@
+# Support conclusion
+
+The June transaction did not require either private key. It replayed the March authorization.
+
+The signed EIP-712 value is only `(borrower, amount)`. Nothing in it identifies a particular use of the authorization, and the contract records no consumed authorization. Repayment changes the loan balance, but it does not change the signed digest or invalidate the signature. Consequently, after repayment the exact March `(v,r,s)` still recovers the user's address and `borrowWithSig` opens the same debt again. Anyone who obtained the signature—most simply by reading the public March transaction calldata—could submit it. The June sender and the boarding pass are therefore consistent with the user's account, as is the absence of a key compromise.
+
+This is a critical authorization-replay vulnerability. A signature currently means “the bearer may borrow 5,000 USDC for this address any number of times, forever,” not “authorize one 5,000 USDC borrow.” Subject to the market's collateral and accounting checks, an attacker can replay it whenever repayment or added collateral restores borrowing capacity.
+
+## Other exposure
+
+- Every historical successful signature, and every signature leaked before submission, is a permanent public bearer authorization. It can be replayed repeatedly, including long after the user intended it to expire.
+- The authorization is not bound to the intended relayer. Anyone can submit it or copy/front-run it. This explains why the relayer's key and systems need not be involved. If execution timing, relayer fees, or any caller-dependent behavior matters, this is independently dangerous.
+- Raw `ecrecover` accepts non-canonical high-`s` signatures. An attacker can derive a second `(v,r,s)` for the same authorization. Therefore a patch that merely stores `keccak256(abi.encode(v,r,s))` as “used” can still be bypassed. Recovery also needs an explicit nonzero/canonical-signature implementation.
+- There is no expiry, so even a correctly single-use authorization cannot naturally become stale or be bounded to the period the user expected.
+- The constructor-cached domain contains the deployment chain ID, which is good under normal conditions, but it does not adapt if the chain ID changes after a fork. The old cached domain can make signatures valid in an unintended fork/domain. Use an EIP-712 implementation that recomputes the separator when the runtime chain ID differs.
+- EOAs are the only borrowers supported by raw `ecrecover`. If smart-contract wallets are or may become borrowers, validation should support ERC-1271 as well.
+
+`amount` and `borrower` are correctly included, and the domain includes both `chainId` and `verifyingContract`, so changing the amount or ordinarily replaying the signature against another address/chain/contract is not the issue here.
+
+## What to ship
+
+Upgrade or replace the contract with all of the following changes as one release:
+
+1. Change the signed type to include a per-borrower nonce, deadline, and intended executor (the relayer).
+2. Require the supplied nonce to equal the borrower's current nonce and consume it before `_borrow` or any other state-changing/external execution. A revert restores the nonce, so invalid signatures cannot burn it.
+3. Reject expired authorizations.
+4. Use OpenZeppelin `EIP712` plus `SignatureChecker` (which uses canonical ECDSA validation for EOAs and ERC-1271 for contract wallets), rather than raw `ecrecover`.
+5. Change the EIP-712 domain version from `"1"` to `"2"`.
+6. Remove or permanently disable the old nonce-less entry point. Merely adding a new entry point leaves the exploit open.
+
+A concrete Solidity shape is:
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {SignatureChecker} from
+    "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline,address executor)"
+    );
+
+    mapping(address borrower => uint256 nonce) public nonces;
+
+    error BadSignature();
+    error AuthorizationExpired();
+    error InvalidNonce();
+    error WrongExecutor();
+
+    constructor(/* ... */) EIP712("ArbiLend", "2") {
+        // existing initialization
+    }
+
+    function borrowWithSig(
+        address borrower,
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        address executor,
+        bytes calldata signature
+    ) external {
+        if (msg.sender != executor) revert WrongExecutor();
+        if (block.timestamp > deadline) revert AuthorizationExpired();
+        if (nonce != nonces[borrower]) revert InvalidNonce();
+
+        bytes32 structHash = keccak256(abi.encode(
+            BORROW_TYPEHASH,
+            borrower,
+            amount,
+            nonce,
+            deadline,
+            executor
+        ));
+        bytes32 digest = _hashTypedDataV4(structHash);
+
+        // Consume before ERC-1271 validation and before _borrow. Any later revert
+        // rolls this write back; early consumption also closes reentrant reuse.
+        nonces[borrower] = nonce + 1;
+
+        if (!SignatureChecker.isValidSignatureNow(borrower, digest, signature)) {
+            revert BadSignature();
+        }
+
+        _borrow(borrower, amount);
+    }
+
+    // Lets a user revoke all still-pending lower nonces without a borrow.
+    function invalidateBorrowNonces(uint256 newNonce) external {
+        if (newNonce <= nonces[msg.sender]) revert InvalidNonce();
+        nonces[msg.sender] = newNonce;
+    }
+}
+```
+
+If permissionless submission is an intentional product requirement, omit `executor` from both the type and function instead of accepting an unsigned executor. Nonce and deadline remain mandatory. If several concurrent outstanding authorizations are required, use unordered/bitmap nonces rather than a sequential counter, with a borrower-only cancellation function.
+
+For a proxy, use the upgradeable OpenZeppelin variants and an initializer, append storage without changing the existing layout, and set the new domain version during reinitialization. For an immutable deployment, deploy version 2, pause/disable signature borrowing on version 1, and migrate the market. Do not advertise the new route as safe while version 1 can still originate debt.
+
+Before reopening, tests should prove: the same signature succeeds once only; replay after repayment fails; an expired signature fails; the wrong executor fails; nonce cancellation works; high-`s` ECDSA fails; an ERC-1271 wallet works (if supported); nonce consumption precedes callbacks; chain/domain/contract mismatches fail; and the legacy selector is unreachable.
+
+## What to tell the user
+
+“Your key was not used in June. A defect in our authorization contract allowed the one signature you supplied in March, which became visible in transaction data, to be submitted again by anyone. Repaying the March loan did not invalidate that signature. The June debt was therefore created by replaying your valid March authorization, not by a new authorization from you. We are disabling the affected route, addressing the resulting unauthorized debt under our incident process, and deploying single-use, expiring authorizations before restoring gasless borrowing.”

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..6564f14ec8a3b35a296acd328aa9ae1cb76d9de1
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,103 @@
+# Support conclusion
+
+The June transaction did not require either private key. It replayed the March authorization.
+
+The signed EIP-712 value is only `(borrower, amount)`. Nothing in it identifies a particular use of the authorization, and the contract records no consumed authorization. Repayment changes the loan balance, but it does not change the signed digest or invalidate the signature. Consequently, after repayment the exact March `(v,r,s)` still recovers the user's address and `borrowWithSig` opens the same debt again. Anyone who obtained the signature—most simply by reading the public March transaction calldata—could submit it. The June sender and the boarding pass are therefore consistent with the user's account, as is the absence of a key compromise.
+
+This is a critical authorization-replay vulnerability. A signature currently means “the bearer may borrow 5,000 USDC for this address any number of times, forever,” not “authorize one 5,000 USDC borrow.” Subject to the market's collateral and accounting checks, an attacker can replay it whenever repayment or added collateral restores borrowing capacity.
+
+## Other exposure
+
+- Every historical successful signature, and every signature leaked before submission, is a permanent public bearer authorization. It can be replayed repeatedly, including long after the user intended it to expire.
+- The authorization is not bound to the intended relayer. Anyone can submit it or copy/front-run it. This explains why the relayer's key and systems need not be involved. If execution timing, relayer fees, or any caller-dependent behavior matters, this is independently dangerous.
+- Raw `ecrecover` accepts non-canonical high-`s` signatures. An attacker can derive a second `(v,r,s)` for the same authorization. Therefore a patch that merely stores `keccak256(abi.encode(v,r,s))` as “used” can still be bypassed. Recovery also needs an explicit nonzero/canonical-signature implementation.
+- There is no expiry, so even a correctly single-use authorization cannot naturally become stale or be bounded to the period the user expected.
+- The constructor-cached domain contains the deployment chain ID, which is good under normal conditions, but it does not adapt if the chain ID changes after a fork. The old cached domain can make signatures valid in an unintended fork/domain. Use an EIP-712 implementation that recomputes the separator when the runtime chain ID differs.
+- EOAs are the only borrowers supported by raw `ecrecover`. If smart-contract wallets are or may become borrowers, validation should support ERC-1271 as well.
+
+`amount` and `borrower` are correctly included, and the domain includes both `chainId` and `verifyingContract`, so changing the amount or ordinarily replaying the signature against another address/chain/contract is not the issue here.
+
+## What to ship
+
+Upgrade or replace the contract with all of the following changes as one release:
+
+1. Change the signed type to include a per-borrower nonce, deadline, and intended executor (the relayer).
+2. Require the supplied nonce to equal the borrower's current nonce and consume it before `_borrow` or any other state-changing/external execution. A revert restores the nonce, so invalid signatures cannot burn it.
+3. Reject expired authorizations.
+4. Use OpenZeppelin `EIP712` plus `SignatureChecker` (which uses canonical ECDSA validation for EOAs and ERC-1271 for contract wallets), rather than raw `ecrecover`.
+5. Change the EIP-712 domain version from `"1"` to `"2"`.
+6. Remove or permanently disable the old nonce-less entry point. Merely adding a new entry point leaves the exploit open.
+
+A concrete Solidity shape is:
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {SignatureChecker} from
+    "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline,address executor)"
+    );
+
+    mapping(address borrower => uint256 nonce) public nonces;
+
+    error BadSignature();
+    error AuthorizationExpired();
+    error InvalidNonce();
+    error WrongExecutor();
+
+    constructor(/* ... */) EIP712("ArbiLend", "2") {
+        // existing initialization
+    }
+
+    function borrowWithSig(
+        address borrower,
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        address executor,
+        bytes calldata signature
+    ) external {
+        if (msg.sender != executor) revert WrongExecutor();
+        if (block.timestamp > deadline) revert AuthorizationExpired();
+        if (nonce != nonces[borrower]) revert InvalidNonce();
+
+        bytes32 structHash = keccak256(abi.encode(
+            BORROW_TYPEHASH,
+            borrower,
+            amount,
+            nonce,
+            deadline,
+            executor
+        ));
+        bytes32 digest = _hashTypedDataV4(structHash);
+
+        // Consume before ERC-1271 validation and before _borrow. Any later revert
+        // rolls this write back; early consumption also closes reentrant reuse.
+        nonces[borrower] = nonce + 1;
+
+        if (!SignatureChecker.isValidSignatureNow(borrower, digest, signature)) {
+            revert BadSignature();
+        }
+
+        _borrow(borrower, amount);
+    }
+
+    // Lets a user revoke all still-pending lower nonces without a borrow.
+    function invalidateBorrowNonces(uint256 newNonce) external {
+        if (newNonce <= nonces[msg.sender]) revert InvalidNonce();
+        nonces[msg.sender] = newNonce;
+    }
+}
+```
+
+If permissionless submission is an intentional product requirement, omit `executor` from both the type and function instead of accepting an unsigned executor. Nonce and deadline remain mandatory. If several concurrent outstanding authorizations are required, use unordered/bitmap nonces rather than a sequential counter, with a borrower-only cancellation function.
+
+For a proxy, use the upgradeable OpenZeppelin variants and an initializer, append storage without changing the existing layout, and set the new domain version during reinitialization. For an immutable deployment, deploy version 2, pause/disable signature borrowing on version 1, and migrate the market. Do not advertise the new route as safe while version 1 can still originate debt.
+
+Before reopening, tests should prove: the same signature succeeds once only; replay after repayment fails; an expired signature fails; the wrong executor fails; nonce cancellation works; high-`s` ECDSA fails; an ERC-1271 wallet works (if supported); nonce consumption precedes callbacks; chain/domain/contract mismatches fail; and the legacy selector is unreachable.
+
+## What to tell the user
+
+“Your key was not used in June. A defect in our authorization contract allowed the one signature you supplied in March, which became visible in transaction data, to be submitted again by anyone. Repaying the March loan did not invalidate that signature. The June debt was therefore created by replaying your valid March authorization, not by a new authorization from you. We are disabling the affected route, addressing the resulting unauthorized debt under our incident process, and deploying single-use, expiring authorizations before restoring gasless borrowing.”

exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /tmp/ethskills-audit-eval/2026-09-04T155045Z-codex-with-skill-2/audit-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Support conclusion

The June transaction did not require either private key. It replayed the March authorization.

The signed EIP-712 value is only `(borrower, amount)`. Nothing in it identifies a particular use of the authorization, and the contract records no consumed authorization. Repayment changes the loan balance, but it does not change the signed digest or invalidate the signature. Consequently, after repayment the exact March `(v,r,s)` still recovers the user's address and `borrowWithSig` opens the same debt again. Anyone who obtained the signature—most simply by reading the public March transaction calldata—could submit it. The June sender and the boarding pass are therefore consistent with the user's account, as is the absence of a key compromise.

This is a critical authorization-replay vulnerability. A signature currently means “the bearer may borrow 5,000 USDC for this address any number of times, forever,” not “authorize one 5,000 USDC borrow.” Subject to the market's collateral and accounting checks, an attacker can replay it whenever repayment or added collateral restores borrowing capacity.

## Other exposure

- Every historical successful signature, and every signature leaked before submission, is a permanent public bearer authorization. It can be replayed repeatedly, including long after the user intended it to expire.
- The authorization is not bound to the intended relayer. Anyone can submit it or copy/front-run it. This explains why the relayer's key and systems need not be involved. If execution timing, relayer fees, or any caller-dependent behavior matters, this is independently dangerous.
- Raw `ecrecover` accepts non-canonical high-`s` signatures. An attacker can derive a second `(v,r,s)` for the same authorization. Therefore a patch that merely stores `keccak256(abi.encode(v,r,s))` as “used” can still be bypassed. Recovery also needs an explicit nonzero/canonical-signature implementation.
- There is no expiry, so even a correctly single-use authorization cannot naturally become stale or be bounded to the period the user expected.
- The constructor-cached domain contains the deployment chain ID, which is good under normal conditions, but it does not adapt if the chain ID changes after a fork. The old cached domain can make signatures valid in an unintended fork/domain. Use an EIP-712 implementation that recomputes the separator when the runtime chain ID differs.
- EOAs are the only borrowers supported by raw `ecrecover`. If smart-contract wallets are or may become borrowers, validation should support ERC-1271 as well.

`amount` and `borrower` are correctly included, and the domain includes both `chainId` and `verifyingContract`, so changing the amount or ordinarily replaying the signature against another address/chain/contract is not the issue here.

## What to ship

Upgrade or replace the contract with all of the following changes as one release:

1. Change the signed type to include a per-borrower nonce, deadline, and intended executor (the relayer).
2. Require the supplied nonce to equal the borrower's current nonce and consume it before `_borrow` or any other state-changing/external execution. A revert restores the nonce, so invalid signatures cannot burn it.
3. Reject expired authorizations.
4. Use OpenZeppelin `EIP712` plus `SignatureChecker` (which uses canonical ECDSA validation for EOAs and ERC-1271 for contract wallets), rather than raw `ecrecover`.
5. Change the EIP-712 domain version from `"1"` to `"2"`.
6. Remove or permanently disable the old nonce-less entry point. Merely adding a new entry point leaves the exploit open.

A concrete Solidity shape is:

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from
    "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

contract ArbiLend is EIP712 {
    bytes32 private constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline,address executor)"
    );

    mapping(address borrower => uint256 nonce) public nonces;

    error BadSignature();
    error AuthorizationExpired();
    error InvalidNonce();
    error WrongExecutor();

    constructor(/* ... */) EIP712("ArbiLend", "2") {
        // existing initialization
    }

    function borrowWithSig(
        address borrower,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        address executor,
        bytes calldata signature
    ) external {
        if (msg.sender != executor) revert WrongExecutor();
        if (block.timestamp > deadline) revert AuthorizationExpired();
        if (nonce != nonces[borrower]) revert InvalidNonce();

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH,
            borrower,
            amount,
            nonce,
            deadline,
            executor
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        // Consume before ERC-1271 validation and before _borrow. Any later revert
        // rolls this write back; early consumption also closes reentrant reuse.
        nonces[borrower] = nonce + 1;

        if (!SignatureChecker.isValidSignatureNow(borrower, digest, signature)) {
            revert BadSignature();
        }

        _borrow(borrower, amount);
    }

    // Lets a user revoke all still-pending lower nonces without a borrow.
    function invalidateBorrowNonces(uint256 newNonce) external {
        if (newNonce <= nonces[msg.sender]) revert InvalidNonce();
        nonces[msg.sender] = newNonce;
    }
}
```

If permissionless submission is an intentional product requirement, omit `executor` from both the type and function instead of accepting an unsigned executor. Nonce and deadline remain mandatory. If several concurrent outstanding authorizations are required, use unordered/bitmap nonces rather than a sequential counter, with a borrower-only cancellation function.

For a proxy, use the upgradeable OpenZeppelin variants and an initializer, append storage without changing the existing layout, and set the new domain version during reinitialization. For an immutable deployment, deploy version 2, pause/disable signature borrowing on version 1, and migrate the market. Do not advertise the new route as safe while version 1 can still originate debt.

Before reopening, tests should prove: the same signature succeeds once only; replay after repayment fails; an expired signature fails; the wrong executor fails; nonce cancellation works; high-`s` ECDSA fails; an ERC-1271 wallet works (if supported); nonce consumption precedes callbacks; chain/domain/contract mismatches fail; and the legacy selector is unreachable.

## What to tell the user

“Your key was not used in June. A defect in our authorization contract allowed the one signature you supplied in March, which became visible in transaction data, to be submitted again by anyone. Repaying the March loan did not invalidate that signature. The June debt was therefore created by replaying your valid March authorization, not by a new authorization from you. We are disabling the affected route, addressing the resulting unauthorized debt under our incident process, and deploying single-use, expiring authorizations before restoring gasless borrowing.”

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..6564f14ec8a3b35a296acd328aa9ae1cb76d9de1
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,103 @@
+# Support conclusion
+
+The June transaction did not require either private key. It replayed the March authorization.
+
+The signed EIP-712 value is only `(borrower, amount)`. Nothing in it identifies a particular use of the authorization, and the contract records no consumed authorization. Repayment changes the loan balance, but it does not change the signed digest or invalidate the signature. Consequently, after repayment the exact March `(v,r,s)` still recovers the user's address and `borrowWithSig` opens the same debt again. Anyone who obtained the signature—most simply by reading the public March transaction calldata—could submit it. The June sender and the boarding pass are therefore consistent with the user's account, as is the absence of a key compromise.
+
+This is a critical authorization-replay vulnerability. A signature currently means “the bearer may borrow 5,000 USDC for this address any number of times, forever,” not “authorize one 5,000 USDC borrow.” Subject to the market's collateral and accounting checks, an attacker can replay it whenever repayment or added collateral restores borrowing capacity.
+
+## Other exposure
+
+- Every historical successful signature, and every signature leaked before submission, is a permanent public bearer authorization. It can be replayed repeatedly, including long after the user intended it to expire.
+- The authorization is not bound to the intended relayer. Anyone can submit it or copy/front-run it. This explains why the relayer's key and systems need not be involved. If execution timing, relayer fees, or any caller-dependent behavior matters, this is independently dangerous.
+- Raw `ecrecover` accepts non-canonical high-`s` signatures. An attacker can derive a second `(v,r,s)` for the same authorization. Therefore a patch that merely stores `keccak256(abi.encode(v,r,s))` as “used” can still be bypassed. Recovery also needs an explicit nonzero/canonical-signature implementation.
+- There is no expiry, so even a correctly single-use authorization cannot naturally become stale or be bounded to the period the user expected.
+- The constructor-cached domain contains the deployment chain ID, which is good under normal conditions, but it does not adapt if the chain ID changes after a fork. The old cached domain can make signatures valid in an unintended fork/domain. Use an EIP-712 implementation that recomputes the separator when the runtime chain ID differs.
+- EOAs are the only borrowers supported by raw `ecrecover`. If smart-contract wallets are or may become borrowers, validation should support ERC-1271 as well.
+
+`amount` and `borrower` are correctly included, and the domain includes both `chainId` and `verifyingContract`, so changing the amount or ordinarily replaying the signature against another address/chain/contract is not the issue here.
+
+## What to ship
+
+Upgrade or replace the contract with all of the following changes as one release:
+
+1. Change the signed type to include a per-borrower nonce, deadline, and intended executor (the relayer).
+2. Require the supplied nonce to equal the borrower's current nonce and consume it before `_borrow` or any other state-changing/external execution. A revert restores the nonce, so invalid signatures cannot burn it.
+3. Reject expired authorizations.
+4. Use OpenZeppelin `EIP712` plus `SignatureChecker` (which uses canonical ECDSA validation for EOAs and ERC-1271 for contract wallets), rather than raw `ecrecover`.
+5. Change the EIP-712 domain version from `"1"` to `"2"`.
+6. Remove or permanently disable the old nonce-less entry point. Merely adding a new entry point leaves the exploit open.
+
+A concrete Solidity shape is:
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {SignatureChecker} from
+    "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline,address executor)"
+    );
+
+    mapping(address borrower => uint256 nonce) public nonces;
+
+    error BadSignature();
+    error AuthorizationExpired();
+    error InvalidNonce();
+    error WrongExecutor();
+
+    constructor(/* ... */) EIP712("ArbiLend", "2") {
+        // existing initialization
+    }
+
+    function borrowWithSig(
+        address borrower,
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        address executor,
+        bytes calldata signature
+    ) external {
+        if (msg.sender != executor) revert WrongExecutor();
+        if (block.timestamp > deadline) revert AuthorizationExpired();
+        if (nonce != nonces[borrower]) revert InvalidNonce();
+
+        bytes32 structHash = keccak256(abi.encode(
+            BORROW_TYPEHASH,
+            borrower,
+            amount,
+            nonce,
+            deadline,
+            executor
+        ));
+        bytes32 digest = _hashTypedDataV4(structHash);
+
+        // Consume before ERC-1271 validation and before _borrow. Any later revert
+        // rolls this write back; early consumption also closes reentrant reuse.
+        nonces[borrower] = nonce + 1;
+
+        if (!SignatureChecker.isValidSignatureNow(borrower, digest, signature)) {
+            revert BadSignature();
+        }
+
+        _borrow(borrower, amount);
+    }
+
+    // Lets a user revoke all still-pending lower nonces without a borrow.
+    function invalidateBorrowNonces(uint256 newNonce) external {
+        if (newNonce <= nonces[msg.sender]) revert InvalidNonce();
+        nonces[msg.sender] = newNonce;
+    }
+}
+```
+
+If permissionless submission is an intentional product requirement, omit `executor` from both the type and function instead of accepting an unsigned executor. Nonce and deadline remain mandatory. If several concurrent outstanding authorizations are required, use unordered/bitmap nonces rather than a sequential counter, with a borrower-only cancellation function.
+
+For a proxy, use the upgradeable OpenZeppelin variants and an initializer, append storage without changing the existing layout, and set the new domain version during reinitialization. For an immutable deployment, deploy version 2, pause/disable signature borrowing on version 1, and migrate the market. Do not advertise the new route as safe while version 1 can still originate debt.
+
+Before reopening, tests should prove: the same signature succeeds once only; replay after repayment fails; an expired signature fails; the wrong executor fails; nonce cancellation works; high-`s` ECDSA fails; an ERC-1271 wallet works (if supported); nonce consumption precedes callbacks; chain/domain/contract mismatches fail; and the legacy selector is unreachable.
+
+## What to tell the user
+
+“Your key was not used in June. A defect in our authorization contract allowed the one signature you supplied in March, which became visible in transaction data, to be submitted again by anyone. Repaying the March loan did not invalidate that signature. The June debt was therefore created by replaying your valid March authorization, not by a new authorization from you. We are disabling the affected route, addressing the resulting unauthorized debt under our incident process, and deploying single-use, expiring authorizations before restoring gasless borrowing.”

codex
Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155045Z-codex-with-skill-2/audit-quiz-003/answer.md) with the replay explanation, additional risks, concrete Solidity remediation, deployment requirements, tests, and suggested customer response.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..6564f14ec8a3b35a296acd328aa9ae1cb76d9de1
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,103 @@
+# Support conclusion
+
+The June transaction did not require either private key. It replayed the March authorization.
+
+The signed EIP-712 value is only `(borrower, amount)`. Nothing in it identifies a particular use of the authorization, and the contract records no consumed authorization. Repayment changes the loan balance, but it does not change the signed digest or invalidate the signature. Consequently, after repayment the exact March `(v,r,s)` still recovers the user's address and `borrowWithSig` opens the same debt again. Anyone who obtained the signature—most simply by reading the public March transaction calldata—could submit it. The June sender and the boarding pass are therefore consistent with the user's account, as is the absence of a key compromise.
+
+This is a critical authorization-replay vulnerability. A signature currently means “the bearer may borrow 5,000 USDC for this address any number of times, forever,” not “authorize one 5,000 USDC borrow.” Subject to the market's collateral and accounting checks, an attacker can replay it whenever repayment or added collateral restores borrowing capacity.
+
+## Other exposure
+
+- Every historical successful signature, and every signature leaked before submission, is a permanent public bearer authorization. It can be replayed repeatedly, including long after the user intended it to expire.
+- The authorization is not bound to the intended relayer. Anyone can submit it or copy/front-run it. This explains why the relayer's key and systems need not be involved. If execution timing, relayer fees, or any caller-dependent behavior matters, this is independently dangerous.
+- Raw `ecrecover` accepts non-canonical high-`s` signatures. An attacker can derive a second `(v,r,s)` for the same authorization. Therefore a patch that merely stores `keccak256(abi.encode(v,r,s))` as “used” can still be bypassed. Recovery also needs an explicit nonzero/canonical-signature implementation.
+- There is no expiry, so even a correctly single-use authorization cannot naturally become stale or be bounded to the period the user expected.
+- The constructor-cached domain contains the deployment chain ID, which is good under normal conditions, but it does not adapt if the chain ID changes after a fork. The old cached domain can make signatures valid in an unintended fork/domain. Use an EIP-712 implementation that recomputes the separator when the runtime chain ID differs.
+- EOAs are the only borrowers supported by raw `ecrecover`. If smart-contract wallets are or may become borrowers, validation should support ERC-1271 as well.
+
+`amount` and `borrower` are correctly included, and the domain includes both `chainId` and `verifyingContract`, so changing the amount or ordinarily replaying the signature against another address/chain/contract is not the issue here.
+
+## What to ship
+
+Upgrade or replace the contract with all of the following changes as one release:
+
+1. Change the signed type to include a per-borrower nonce, deadline, and intended executor (the relayer).
+2. Require the supplied nonce to equal the borrower's current nonce and consume it before `_borrow` or any other state-changing/external execution. A revert restores the nonce, so invalid signatures cannot burn it.
+3. Reject expired authorizations.
+4. Use OpenZeppelin `EIP712` plus `SignatureChecker` (which uses canonical ECDSA validation for EOAs and ERC-1271 for contract wallets), rather than raw `ecrecover`.
+5. Change the EIP-712 domain version from `"1"` to `"2"`.
+6. Remove or permanently disable the old nonce-less entry point. Merely adding a new entry point leaves the exploit open.
+
+A concrete Solidity shape is:
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {SignatureChecker} from
+    "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline,address executor)"
+    );
+
+    mapping(address borrower => uint256 nonce) public nonces;
+
+    error BadSignature();
+    error AuthorizationExpired();
+    error InvalidNonce();
+    error WrongExecutor();
+
+    constructor(/* ... */) EIP712("ArbiLend", "2") {
+        // existing initialization
+    }
+
+    function borrowWithSig(
+        address borrower,
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        address executor,
+        bytes calldata signature
+    ) external {
+        if (msg.sender != executor) revert WrongExecutor();
+        if (block.timestamp > deadline) revert AuthorizationExpired();
+        if (nonce != nonces[borrower]) revert InvalidNonce();
+
+        bytes32 structHash = keccak256(abi.encode(
+            BORROW_TYPEHASH,
+            borrower,
+            amount,
+            nonce,
+            deadline,
+            executor
+        ));
+        bytes32 digest = _hashTypedDataV4(structHash);
+
+        // Consume before ERC-1271 validation and before _borrow. Any later revert
+        // rolls this write back; early consumption also closes reentrant reuse.
+        nonces[borrower] = nonce + 1;
+
+        if (!SignatureChecker.isValidSignatureNow(borrower, digest, signature)) {
+            revert BadSignature();
+        }
+
+        _borrow(borrower, amount);
+    }
+
+    // Lets a user revoke all still-pending lower nonces without a borrow.
+    function invalidateBorrowNonces(uint256 newNonce) external {
+        if (newNonce <= nonces[msg.sender]) revert InvalidNonce();
+        nonces[msg.sender] = newNonce;
+    }
+}
+```
+
+If permissionless submission is an intentional product requirement, omit `executor` from both the type and function instead of accepting an unsigned executor. Nonce and deadline remain mandatory. If several concurrent outstanding authorizations are required, use unordered/bitmap nonces rather than a sequential counter, with a borrower-only cancellation function.
+
+For a proxy, use the upgradeable OpenZeppelin variants and an initializer, append storage without changing the existing layout, and set the new domain version during reinitialization. For an immutable deployment, deploy version 2, pause/disable signature borrowing on version 1, and migrate the market. Do not advertise the new route as safe while version 1 can still originate debt.
+
+Before reopening, tests should prove: the same signature succeeds once only; replay after repayment fails; an expired signature fails; the wrong executor fails; nonce cancellation works; high-`s` ECDSA fails; an ERC-1271 wallet works (if supported); nonce consumption precedes callbacks; chain/domain/contract mismatches fail; and the legacy selector is unreachable.
+
+## What to tell the user
+
+“Your key was not used in June. A defect in our authorization contract allowed the one signature you supplied in March, which became visible in transaction data, to be submitted again by anyone. Repaying the March loan did not invalidate that signature. The June debt was therefore created by replaying your valid March authorization, not by a new authorization from you. We are disabling the affected route, addressing the resulting unauthorized debt under our incident process, and deploying single-use, expiring authorizations before restoring gasless borrowing.”

tokens used
22,767
````

## final message

Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155045Z-codex-with-skill-2/audit-quiz-003/answer.md) with the replay explanation, additional risks, concrete Solidity remediation, deployment requirements, tests, and suggested customer response.
