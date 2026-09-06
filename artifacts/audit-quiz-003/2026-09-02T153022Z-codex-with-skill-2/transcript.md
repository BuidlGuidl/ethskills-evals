# Executor transcript — 2026-09-02T153022Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-02T153022Z-codex-with-skill-2/audit-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-02T153022Z-codex-with-skill-2/audit-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a062be-26fc-7b32-9f3e-9ae12cb77e9f
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

2026-09-02T15:30:24.353756Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a062be-26fc-7b32-9f3e-9ae12cb77e9f.tmp-1788363024135972533: line 2547: syntax error near unexpected token `('

codex
I’m using the audit skill because this is a smart-contract security diagnosis and remediation task. I’ll inspect its required workflow, then produce the support-ready explanation and exact patch guidance in `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/audit/SKILL.md" in /tmp/ethskills-audit-eval/2026-09-02T153022Z-codex-with-skill-2/audit-quiz-003
 succeeded in 2ms:
codex
The relevant audit domains are signature authorization, lending state transitions, and chain/domain separation. The incident already points strongly to signature replay; I’m checking the full checklist for adjacent replay paths before writing the remediation.
web search: 
web search: https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md
exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md && curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-signatures/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-02T153022Z-codex-with-skill-2/audit-quiz-003
 succeeded in 469ms:
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

codex
The core finding is confirmed: the signature authenticates the borrower and amount, but not a one-time authorization or validity window. Whoever obtained the March signature could submit that same bearer authorization again indefinitely; the caller’s identity and the borrower’s physical location are irrelevant to verification. I’m now writing the exact migration-safe contract change, including invalidating all legacy signatures.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-02T153022Z-codex-with-skill-2/audit-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a93f8a9d2cf3c3572fdeecff94555b530bcc1562
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,84 @@
+# What happened
+
+The June transaction was a replay of the March authorization. The signature check proves only that the borrower once signed the tuple `(borrower, 5_000 USDC)` for this EIP-712 domain. It does **not** prove that this is the first use of that authorization, that it is still current, or that the caller is the protocol's relayer.
+
+There is no nonce (or other one-time identifier) in the signed data and no on-chain state marking the authorization consumed. There is also no deadline. Consequently, the March signature remains valid forever and every successful call leaves it valid for another call. Repaying changes the loan state, but it does not change the signed digest or revoke the signature. Because `borrowWithSig` is public and neither the signature nor the function restricts `msg.sender`, anyone who learns the signature can submit it. A copied signature is enough; no private-key compromise is required. The identical `(v,r,s)` is especially strong evidence of replay.
+
+The boarding pass and the unknown sender are therefore consistent with the code. The borrower did not have to be online and the sender did not have to be the original relayer. We should tell the user that this was an authorization-replay vulnerability in our contract, not evidence that they signed again.
+
+# Other exposure
+
+The same signature can be replayed repeatedly, not just twice, whenever `_borrow`'s collateral/liquidity checks permit it. An attacker can wait until a repayment, collateral top-up, price change, or restored credit makes an old authorization executable, then recreate debt. This can force interest, liquidation, and collateral loss. If borrowed funds can be directed to or otherwise benefit the caller, the impact can also be direct theft; even if proceeds always go to the borrower, forced debt and liquidation remain harmful.
+
+There are several adjacent problems:
+
+- There is no expiry, so leaked, logged, phished, or previously broadcast authorizations are lifetime bearer instruments.
+- The authorization is not bound to an intended relayer. Any observer, compromised service, calldata/indexing consumer, or mempool participant can submit it and choose its timing. If permissionless submission is intentional this is acceptable only after nonce and deadline protections; otherwise the relayer must also be signed or access-controlled.
+- Raw `ecrecover` accepts malleable high-`s` signatures and has awkward invalid-signature behavior. That did not cause this incident—the exact same bytes were reused—but it means a future defense keyed by `(v,r,s)` or signature bytes can be bypassed with the alternate valid signature. Consumption must be keyed by signed nonce/digest, and recovery should use OpenZeppelin `ECDSA`.
+- The domain separator is permanently cached with the deployment chain ID. It separates this contract from ordinary cross-contract and cross-chain replay today because it includes both `chainId` and `verifyingContract`, but after a contentious chain split the same cached domain and signature can remain valid on both branches. OpenZeppelin `EIP712` recomputes the separator when the runtime chain ID changes.
+- The current scheme supports only EOAs. If smart-contract wallets are in scope, validation must also support ERC-1271 (for example with OpenZeppelin `SignatureChecker`).
+
+# What to ship
+
+Ship a new authorization schema with a per-borrower nonce and deadline, use a fresh EIP-712 domain version, and consume the nonce before calling `_borrow`. The version change is important: it makes every outstanding legacy signature—including the March one—invalid after the upgrade. Do not retain the old entry point as a fallback.
+
+For an EOA-only implementation using current OpenZeppelin contracts:
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
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
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        bytes calldata signature
+    ) external {
+        require(borrower != address(0), "zero borrower");
+        require(block.timestamp <= deadline, "expired");
+        require(nonce == borrowNonces[borrower], "bad nonce");
+
+        bytes32 structHash = keccak256(
+            abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+        );
+        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
+        require(signer == borrower, "bad sig");
+
+        // Checks/effects/interactions: consume before any external interaction in _borrow.
+        borrowNonces[borrower] = nonce + 1;
+        _borrow(borrower, amount);
+    }
+
+    // Lets a borrower invalidate an unsubmitted signature (and batches of old ones).
+    function invalidateBorrowNonces(uint256 newNonce) external {
+        require(newNonce > borrowNonces[msg.sender], "nonce not increased");
+        borrowNonces[msg.sender] = newNonce;
+    }
+}
+```
+
+The client must read `borrowNonces[borrower]` immediately before signing and include that exact nonce and a short, user-visible deadline in the typed data. A relayer may submit the transaction, but it must not be allowed to alter any signed field. Concurrent authorizations for one borrower will contend under a sequential nonce; if the product needs several outstanding authorizations, use a signed random `bytes32 authorizationId` and `mapping(address => mapping(bytes32 => bool)) used`, marking it used before `_borrow`.
+
+If only a designated relayer may submit, add `address relayer` to the type string and struct hash and require `msg.sender == relayer`, or enforce a relayer role on the entry point. Signing the relayer permits rotation per authorization; role gating is operationally simpler. Nonce and deadline are required either way—relayer restriction alone does not prevent a trusted or compromised relayer from replaying.
+
+For ERC-1271 support, replace EOA recovery with `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. Keep the nonce consumption unchanged.
+
+# Deployment and incident actions
+
+1. Pause the vulnerable signed-borrow path immediately if the protocol has that capability. Do not rely on deleting known signature bytes or blocking the unknown sender.
+2. Deploy/upgrade to the version-2 domain and remove or permanently disable the legacy function. For a proxy, use OpenZeppelin's upgradeable `EIP712` initializer, preserve storage layout, and append the nonce mapping; do not use the constructor shown above.
+3. Test that first use succeeds; exact replay fails; the high-`s` variant fails; expired, wrong-nonce, wrong-amount, wrong-contract, wrong-chain, and unauthorized-relayer cases fail; nonce cancellation works; and reentrancy cannot reuse a nonce.
+4. Search historical calldata for every signature/digest used more than once and for repeated `(borrower, amount)` authorizations, then assess affected accounts. Assume every legacy authorization observable off-chain or on-chain is compromised because the old format cannot be safely revoked individually.
+5. Restore service only after legacy signatures are cryptographically invalid under the deployed code. Address the user's June debt and any resulting interest/liquidation as a protocol incident caused by replay, not as a valid second authorization.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a93f8a9d2cf3c3572fdeecff94555b530bcc1562
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,84 @@
+# What happened
+
+The June transaction was a replay of the March authorization. The signature check proves only that the borrower once signed the tuple `(borrower, 5_000 USDC)` for this EIP-712 domain. It does **not** prove that this is the first use of that authorization, that it is still current, or that the caller is the protocol's relayer.
+
+There is no nonce (or other one-time identifier) in the signed data and no on-chain state marking the authorization consumed. There is also no deadline. Consequently, the March signature remains valid forever and every successful call leaves it valid for another call. Repaying changes the loan state, but it does not change the signed digest or revoke the signature. Because `borrowWithSig` is public and neither the signature nor the function restricts `msg.sender`, anyone who learns the signature can submit it. A copied signature is enough; no private-key compromise is required. The identical `(v,r,s)` is especially strong evidence of replay.
+
+The boarding pass and the unknown sender are therefore consistent with the code. The borrower did not have to be online and the sender did not have to be the original relayer. We should tell the user that this was an authorization-replay vulnerability in our contract, not evidence that they signed again.
+
+# Other exposure
+
+The same signature can be replayed repeatedly, not just twice, whenever `_borrow`'s collateral/liquidity checks permit it. An attacker can wait until a repayment, collateral top-up, price change, or restored credit makes an old authorization executable, then recreate debt. This can force interest, liquidation, and collateral loss. If borrowed funds can be directed to or otherwise benefit the caller, the impact can also be direct theft; even if proceeds always go to the borrower, forced debt and liquidation remain harmful.
+
+There are several adjacent problems:
+
+- There is no expiry, so leaked, logged, phished, or previously broadcast authorizations are lifetime bearer instruments.
+- The authorization is not bound to an intended relayer. Any observer, compromised service, calldata/indexing consumer, or mempool participant can submit it and choose its timing. If permissionless submission is intentional this is acceptable only after nonce and deadline protections; otherwise the relayer must also be signed or access-controlled.
+- Raw `ecrecover` accepts malleable high-`s` signatures and has awkward invalid-signature behavior. That did not cause this incident—the exact same bytes were reused—but it means a future defense keyed by `(v,r,s)` or signature bytes can be bypassed with the alternate valid signature. Consumption must be keyed by signed nonce/digest, and recovery should use OpenZeppelin `ECDSA`.
+- The domain separator is permanently cached with the deployment chain ID. It separates this contract from ordinary cross-contract and cross-chain replay today because it includes both `chainId` and `verifyingContract`, but after a contentious chain split the same cached domain and signature can remain valid on both branches. OpenZeppelin `EIP712` recomputes the separator when the runtime chain ID changes.
+- The current scheme supports only EOAs. If smart-contract wallets are in scope, validation must also support ERC-1271 (for example with OpenZeppelin `SignatureChecker`).
+
+# What to ship
+
+Ship a new authorization schema with a per-borrower nonce and deadline, use a fresh EIP-712 domain version, and consume the nonce before calling `_borrow`. The version change is important: it makes every outstanding legacy signature—including the March one—invalid after the upgrade. Do not retain the old entry point as a fallback.
+
+For an EOA-only implementation using current OpenZeppelin contracts:
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
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
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        bytes calldata signature
+    ) external {
+        require(borrower != address(0), "zero borrower");
+        require(block.timestamp <= deadline, "expired");
+        require(nonce == borrowNonces[borrower], "bad nonce");
+
+        bytes32 structHash = keccak256(
+            abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+        );
+        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
+        require(signer == borrower, "bad sig");
+
+        // Checks/effects/interactions: consume before any external interaction in _borrow.
+        borrowNonces[borrower] = nonce + 1;
+        _borrow(borrower, amount);
+    }
+
+    // Lets a borrower invalidate an unsubmitted signature (and batches of old ones).
+    function invalidateBorrowNonces(uint256 newNonce) external {
+        require(newNonce > borrowNonces[msg.sender], "nonce not increased");
+        borrowNonces[msg.sender] = newNonce;
+    }
+}
+```
+
+The client must read `borrowNonces[borrower]` immediately before signing and include that exact nonce and a short, user-visible deadline in the typed data. A relayer may submit the transaction, but it must not be allowed to alter any signed field. Concurrent authorizations for one borrower will contend under a sequential nonce; if the product needs several outstanding authorizations, use a signed random `bytes32 authorizationId` and `mapping(address => mapping(bytes32 => bool)) used`, marking it used before `_borrow`.
+
+If only a designated relayer may submit, add `address relayer` to the type string and struct hash and require `msg.sender == relayer`, or enforce a relayer role on the entry point. Signing the relayer permits rotation per authorization; role gating is operationally simpler. Nonce and deadline are required either way—relayer restriction alone does not prevent a trusted or compromised relayer from replaying.
+
+For ERC-1271 support, replace EOA recovery with `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. Keep the nonce consumption unchanged.
+
+# Deployment and incident actions
+
+1. Pause the vulnerable signed-borrow path immediately if the protocol has that capability. Do not rely on deleting known signature bytes or blocking the unknown sender.
+2. Deploy/upgrade to the version-2 domain and remove or permanently disable the legacy function. For a proxy, use OpenZeppelin's upgradeable `EIP712` initializer, preserve storage layout, and append the nonce mapping; do not use the constructor shown above.
+3. Test that first use succeeds; exact replay fails; the high-`s` variant fails; expired, wrong-nonce, wrong-amount, wrong-contract, wrong-chain, and unauthorized-relayer cases fail; nonce cancellation works; and reentrancy cannot reuse a nonce.
+4. Search historical calldata for every signature/digest used more than once and for repeated `(borrower, amount)` authorizations, then assess affected accounts. Assume every legacy authorization observable off-chain or on-chain is compromised because the old format cannot be safely revoked individually.
+5. Restore service only after legacy signatures are cryptographically invalid under the deployed code. Address the user's June debt and any resulting interest/liquidation as a protocol incident caused by replay, not as a valid second authorization.

exec
/bin/bash -lc "wc -l answer.md && sed -n '1,240p' answer.md" in /tmp/ethskills-audit-eval/2026-09-02T153022Z-codex-with-skill-2/audit-quiz-003
 succeeded in 1ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a93f8a9d2cf3c3572fdeecff94555b530bcc1562
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,84 @@
+# What happened
+
+The June transaction was a replay of the March authorization. The signature check proves only that the borrower once signed the tuple `(borrower, 5_000 USDC)` for this EIP-712 domain. It does **not** prove that this is the first use of that authorization, that it is still current, or that the caller is the protocol's relayer.
+
+There is no nonce (or other one-time identifier) in the signed data and no on-chain state marking the authorization consumed. There is also no deadline. Consequently, the March signature remains valid forever and every successful call leaves it valid for another call. Repaying changes the loan state, but it does not change the signed digest or revoke the signature. Because `borrowWithSig` is public and neither the signature nor the function restricts `msg.sender`, anyone who learns the signature can submit it. A copied signature is enough; no private-key compromise is required. The identical `(v,r,s)` is especially strong evidence of replay.
+
+The boarding pass and the unknown sender are therefore consistent with the code. The borrower did not have to be online and the sender did not have to be the original relayer. We should tell the user that this was an authorization-replay vulnerability in our contract, not evidence that they signed again.
+
+# Other exposure
+
+The same signature can be replayed repeatedly, not just twice, whenever `_borrow`'s collateral/liquidity checks permit it. An attacker can wait until a repayment, collateral top-up, price change, or restored credit makes an old authorization executable, then recreate debt. This can force interest, liquidation, and collateral loss. If borrowed funds can be directed to or otherwise benefit the caller, the impact can also be direct theft; even if proceeds always go to the borrower, forced debt and liquidation remain harmful.
+
+There are several adjacent problems:
+
+- There is no expiry, so leaked, logged, phished, or previously broadcast authorizations are lifetime bearer instruments.
+- The authorization is not bound to an intended relayer. Any observer, compromised service, calldata/indexing consumer, or mempool participant can submit it and choose its timing. If permissionless submission is intentional this is acceptable only after nonce and deadline protections; otherwise the relayer must also be signed or access-controlled.
+- Raw `ecrecover` accepts malleable high-`s` signatures and has awkward invalid-signature behavior. That did not cause this incident—the exact same bytes were reused—but it means a future defense keyed by `(v,r,s)` or signature bytes can be bypassed with the alternate valid signature. Consumption must be keyed by signed nonce/digest, and recovery should use OpenZeppelin `ECDSA`.
+- The domain separator is permanently cached with the deployment chain ID. It separates this contract from ordinary cross-contract and cross-chain replay today because it includes both `chainId` and `verifyingContract`, but after a contentious chain split the same cached domain and signature can remain valid on both branches. OpenZeppelin `EIP712` recomputes the separator when the runtime chain ID changes.
+- The current scheme supports only EOAs. If smart-contract wallets are in scope, validation must also support ERC-1271 (for example with OpenZeppelin `SignatureChecker`).
+
+# What to ship
+
+Ship a new authorization schema with a per-borrower nonce and deadline, use a fresh EIP-712 domain version, and consume the nonce before calling `_borrow`. The version change is important: it makes every outstanding legacy signature—including the March one—invalid after the upgrade. Do not retain the old entry point as a fallback.
+
+For an EOA-only implementation using current OpenZeppelin contracts:
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
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
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        bytes calldata signature
+    ) external {
+        require(borrower != address(0), "zero borrower");
+        require(block.timestamp <= deadline, "expired");
+        require(nonce == borrowNonces[borrower], "bad nonce");
+
+        bytes32 structHash = keccak256(
+            abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+        );
+        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
+        require(signer == borrower, "bad sig");
+
+        // Checks/effects/interactions: consume before any external interaction in _borrow.
+        borrowNonces[borrower] = nonce + 1;
+        _borrow(borrower, amount);
+    }
+
+    // Lets a borrower invalidate an unsubmitted signature (and batches of old ones).
+    function invalidateBorrowNonces(uint256 newNonce) external {
+        require(newNonce > borrowNonces[msg.sender], "nonce not increased");
+        borrowNonces[msg.sender] = newNonce;
+    }
+}
+```
+
+The client must read `borrowNonces[borrower]` immediately before signing and include that exact nonce and a short, user-visible deadline in the typed data. A relayer may submit the transaction, but it must not be allowed to alter any signed field. Concurrent authorizations for one borrower will contend under a sequential nonce; if the product needs several outstanding authorizations, use a signed random `bytes32 authorizationId` and `mapping(address => mapping(bytes32 => bool)) used`, marking it used before `_borrow`.
+
+If only a designated relayer may submit, add `address relayer` to the type string and struct hash and require `msg.sender == relayer`, or enforce a relayer role on the entry point. Signing the relayer permits rotation per authorization; role gating is operationally simpler. Nonce and deadline are required either way—relayer restriction alone does not prevent a trusted or compromised relayer from replaying.
+
+For ERC-1271 support, replace EOA recovery with `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. Keep the nonce consumption unchanged.
+
+# Deployment and incident actions
+
+1. Pause the vulnerable signed-borrow path immediately if the protocol has that capability. Do not rely on deleting known signature bytes or blocking the unknown sender.
+2. Deploy/upgrade to the version-2 domain and remove or permanently disable the legacy function. For a proxy, use OpenZeppelin's upgradeable `EIP712` initializer, preserve storage layout, and append the nonce mapping; do not use the constructor shown above.
+3. Test that first use succeeds; exact replay fails; the high-`s` variant fails; expired, wrong-nonce, wrong-amount, wrong-contract, wrong-chain, and unauthorized-relayer cases fail; nonce cancellation works; and reentrancy cannot reuse a nonce.
+4. Search historical calldata for every signature/digest used more than once and for repeated `(borrower, amount)` authorizations, then assess affected accounts. Assume every legacy authorization observable off-chain or on-chain is compromised because the old format cannot be safely revoked individually.
+5. Restore service only after legacy signatures are cryptographically invalid under the deployed code. Address the user's June debt and any resulting interest/liquidation as a protocol incident caused by replay, not as a valid second authorization.

codex
Created [answer.md](/tmp/ethskills-audit-eval/2026-09-02T153022Z-codex-with-skill-2/audit-quiz-003/answer.md).

It explains the nonce-less signature replay, adjacent risks, user-facing conclusion, exact Solidity remediation, migration requirements, tests, and incident-response steps.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a93f8a9d2cf3c3572fdeecff94555b530bcc1562
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,84 @@
+# What happened
+
+The June transaction was a replay of the March authorization. The signature check proves only that the borrower once signed the tuple `(borrower, 5_000 USDC)` for this EIP-712 domain. It does **not** prove that this is the first use of that authorization, that it is still current, or that the caller is the protocol's relayer.
+
+There is no nonce (or other one-time identifier) in the signed data and no on-chain state marking the authorization consumed. There is also no deadline. Consequently, the March signature remains valid forever and every successful call leaves it valid for another call. Repaying changes the loan state, but it does not change the signed digest or revoke the signature. Because `borrowWithSig` is public and neither the signature nor the function restricts `msg.sender`, anyone who learns the signature can submit it. A copied signature is enough; no private-key compromise is required. The identical `(v,r,s)` is especially strong evidence of replay.
+
+The boarding pass and the unknown sender are therefore consistent with the code. The borrower did not have to be online and the sender did not have to be the original relayer. We should tell the user that this was an authorization-replay vulnerability in our contract, not evidence that they signed again.
+
+# Other exposure
+
+The same signature can be replayed repeatedly, not just twice, whenever `_borrow`'s collateral/liquidity checks permit it. An attacker can wait until a repayment, collateral top-up, price change, or restored credit makes an old authorization executable, then recreate debt. This can force interest, liquidation, and collateral loss. If borrowed funds can be directed to or otherwise benefit the caller, the impact can also be direct theft; even if proceeds always go to the borrower, forced debt and liquidation remain harmful.
+
+There are several adjacent problems:
+
+- There is no expiry, so leaked, logged, phished, or previously broadcast authorizations are lifetime bearer instruments.
+- The authorization is not bound to an intended relayer. Any observer, compromised service, calldata/indexing consumer, or mempool participant can submit it and choose its timing. If permissionless submission is intentional this is acceptable only after nonce and deadline protections; otherwise the relayer must also be signed or access-controlled.
+- Raw `ecrecover` accepts malleable high-`s` signatures and has awkward invalid-signature behavior. That did not cause this incident—the exact same bytes were reused—but it means a future defense keyed by `(v,r,s)` or signature bytes can be bypassed with the alternate valid signature. Consumption must be keyed by signed nonce/digest, and recovery should use OpenZeppelin `ECDSA`.
+- The domain separator is permanently cached with the deployment chain ID. It separates this contract from ordinary cross-contract and cross-chain replay today because it includes both `chainId` and `verifyingContract`, but after a contentious chain split the same cached domain and signature can remain valid on both branches. OpenZeppelin `EIP712` recomputes the separator when the runtime chain ID changes.
+- The current scheme supports only EOAs. If smart-contract wallets are in scope, validation must also support ERC-1271 (for example with OpenZeppelin `SignatureChecker`).
+
+# What to ship
+
+Ship a new authorization schema with a per-borrower nonce and deadline, use a fresh EIP-712 domain version, and consume the nonce before calling `_borrow`. The version change is important: it makes every outstanding legacy signature—including the March one—invalid after the upgrade. Do not retain the old entry point as a fallback.
+
+For an EOA-only implementation using current OpenZeppelin contracts:
+
+```solidity
+import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
+import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
+
+contract ArbiLend is EIP712 {
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
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
+        uint256 amount,
+        uint256 nonce,
+        uint256 deadline,
+        bytes calldata signature
+    ) external {
+        require(borrower != address(0), "zero borrower");
+        require(block.timestamp <= deadline, "expired");
+        require(nonce == borrowNonces[borrower], "bad nonce");
+
+        bytes32 structHash = keccak256(
+            abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+        );
+        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
+        require(signer == borrower, "bad sig");
+
+        // Checks/effects/interactions: consume before any external interaction in _borrow.
+        borrowNonces[borrower] = nonce + 1;
+        _borrow(borrower, amount);
+    }
+
+    // Lets a borrower invalidate an unsubmitted signature (and batches of old ones).
+    function invalidateBorrowNonces(uint256 newNonce) external {
+        require(newNonce > borrowNonces[msg.sender], "nonce not increased");
+        borrowNonces[msg.sender] = newNonce;
+    }
+}
+```
+
+The client must read `borrowNonces[borrower]` immediately before signing and include that exact nonce and a short, user-visible deadline in the typed data. A relayer may submit the transaction, but it must not be allowed to alter any signed field. Concurrent authorizations for one borrower will contend under a sequential nonce; if the product needs several outstanding authorizations, use a signed random `bytes32 authorizationId` and `mapping(address => mapping(bytes32 => bool)) used`, marking it used before `_borrow`.
+
+If only a designated relayer may submit, add `address relayer` to the type string and struct hash and require `msg.sender == relayer`, or enforce a relayer role on the entry point. Signing the relayer permits rotation per authorization; role gating is operationally simpler. Nonce and deadline are required either way—relayer restriction alone does not prevent a trusted or compromised relayer from replaying.
+
+For ERC-1271 support, replace EOA recovery with `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. Keep the nonce consumption unchanged.
+
+# Deployment and incident actions
+
+1. Pause the vulnerable signed-borrow path immediately if the protocol has that capability. Do not rely on deleting known signature bytes or blocking the unknown sender.
+2. Deploy/upgrade to the version-2 domain and remove or permanently disable the legacy function. For a proxy, use OpenZeppelin's upgradeable `EIP712` initializer, preserve storage layout, and append the nonce mapping; do not use the constructor shown above.
+3. Test that first use succeeds; exact replay fails; the high-`s` variant fails; expired, wrong-nonce, wrong-amount, wrong-contract, wrong-chain, and unauthorized-relayer cases fail; nonce cancellation works; and reentrancy cannot reuse a nonce.
+4. Search historical calldata for every signature/digest used more than once and for repeated `(borrower, amount)` authorizations, then assess affected accounts. Assume every legacy authorization observable off-chain or on-chain is compromised because the old format cannot be safely revoked individually.
+5. Restore service only after legacy signatures are cryptographically invalid under the deployed code. Address the user's June debt and any resulting interest/liquidation as a protocol incident caused by replay, not as a valid second authorization.

2026-09-02T15:32:35.553770Z  WARN codex_core::tasks: failed to flush rollout after emitting terminal turn event: thread 01a062be-26fc-7b32-9f3e-9ae12cb77e9f not found
tokens used
24,240
````

## final message

Created [answer.md](/tmp/ethskills-audit-eval/2026-09-02T153022Z-codex-with-skill-2/audit-quiz-003/answer.md).

It explains the nonce-less signature replay, adjacent risks, user-facing conclusion, exact Solidity remediation, migration requirements, tests, and incident-response steps.
