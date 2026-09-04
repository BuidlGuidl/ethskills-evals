# Executor transcript — 2026-09-04T155044Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-04T155044Z-codex-with-skill-1/audit-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-04T155044Z-codex-with-skill-1/audit-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06d27-0311-7130-8257-7c28f2a42988
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
I’m treating this as a focused smart-contract security review, so I’ll use the audit skill and inspect the workspace before drafting the support explanation and remediation.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/audit/SKILL.md && rg --files -g '"'!answer.md'"' | sed -n '1,160p'" in /tmp/ethskills-audit-eval/2026-09-04T155044Z-codex-with-skill-1/audit-quiz-003
 succeeded in 4ms:
package.json
TASK.md

codex
The central failure is already clear: signature validity is being mistaken for one-time authorization. I’m checking the signature and lending audit guidance now, then I’ll write the exact on-chain schema/state changes, rollout precautions, and user-facing conclusion.
web search: 
web search: https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/ffe4b670e78e1945bcf275f79d4b7b0481bcff35/evm-audit-signatures/references/checklist.md
exec
/bin/bash -lc 'curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/ffe4b670e78e1945bcf275f79d4b7b0481bcff35/evm-audit-signatures/references/checklist.md && curl -fsSL https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/ffe4b670e78e1945bcf275f79d4b7b0481bcff35/evm-audit-defi-lending/references/checklist.md' in /tmp/ethskills-audit-eval/2026-09-04T155044Z-codex-with-skill-1/audit-quiz-003
 succeeded in 311ms:
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

codex
The fix needs more than adding a “used signature” mapping: raw ECDSA signatures are malleable, so tracking `(v,r,s)` can still be bypassed. The durable design consumes a borrower nonce (or authorization ID), adds expiry, validates every execution-relevant field, and disables the legacy entry point.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-04T155044Z-codex-with-skill-1/audit-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f99b73afb019f2bd5c1433b0f25b9338e3dcc54c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,85 @@
+# Incident explanation and required fix
+
+## What happened
+
+The June transaction was a replay of the March authorization. The signature check proves only that the borrower once signed the tuple `(borrower, 5_000 USDC)` for this domain. It does not prove that this is the first execution of that authorization.
+
+`borrowWithSig` has no nonce or other one-use identifier and records no consumed authorization. Repaying the loan changes the lending position, but it does not invalidate the signature. There is also no deadline, so the signature remains valid indefinitely. Consequently, the byte-identical March signature still recovered the borrower's address in June and passed the same `require`.
+
+No key compromise, borrower activity in June, or relayer compromise is needed. Ethereum transaction calldata is public. Anyone who saw the March transaction could copy its `(v,r,s)` and arguments and call the public `borrowWithSig` function. The function does not restrict callers or bind an intended relayer, so the unrecognized sender is expected under this attack. A boarding pass is immaterial to the on-chain cause: the June caller needed the old public signature, not the borrower's key.
+
+This is a critical authorization-replay vulnerability. The user is correct that they authorized one borrow. The contract incorrectly treated that authorization as a reusable license.
+
+## Additional exposure
+
+The same signature can be submitted repeatedly, not just once after repayment. Subject to collateral, liquidity, caps, and `_borrow`'s checks, an arbitrary caller can use it to create repeated or cumulative debt, force interest costs, push the account toward liquidation, and potentially cause collateral loss or protocol bad debt. If proceeds are always delivered to the borrower, that does not make the action harmless: the attacker can still grief the borrower and manipulate their risk. If any unsigned execution parameter elsewhere controls the proceeds recipient, asset, market, fees, or collateral, the impact can become direct theft.
+
+Other weaknesses are:
+
+- There is no expiry, so leaked or harvested authorizations remain dangerous forever.
+- There is no caller/relayer binding. Any observer can execute or front-run an authorization. That is acceptable only if permissionless relay is an explicit design choice; it does not solve replay.
+- `ecrecover` is used directly. It accepts malleable high-`s` signatures and has awkward invalid-signature behavior. A mapping keyed by signature bytes would therefore be an unsafe patch: the alternate `(v,s)` representation can recover the same signer while having different bytes. `borrower == address(0)` should also be rejected explicitly.
+- The domain separator is permanently cached with the deployment-time chain ID. The current domain includes both `chainId` and `verifyingContract`, which normally prevents cross-chain and cross-contract replay, but a chain fork can leave the cached separator valid on both branches. Use an implementation that rebuilds the separator when the runtime chain ID changes.
+- Any value that affects execution but is absent from the typed struct is not authorized by the borrower. The production schema must cover the asset/market, receiver, fees or rate bounds, and any other user-controlled execution terms if those are not already fixed by this verifying contract.
+
+## What to ship
+
+Immediately pause signature borrows if the system supports it. Then upgrade or migrate so the old `borrowWithSig(address,uint256,uint8,bytes32,bytes32)` selector is permanently disabled. Adding a safe overload while leaving the old function callable does not fix the incident. Treat every previously published legacy signature as compromised/replayable and monitor for prior replays.
+
+Ship EIP-712 verification with a per-borrower nonce, a deadline, canonical signature recovery, and a domain separator that is chain-aware at runtime. For example, using current OpenZeppelin `EIP712`, `Nonces`, and `ECDSA`:
+
+```solidity
+contract ArbiLend is EIP712, Nonces {
+    using ECDSA for bytes32;
+
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+    );
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
+        require(nonce == nonces(borrower), "bad nonce");
+
+        bytes32 structHash = keccak256(
+            abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+        );
+        address signer = _hashTypedDataV4(structHash).recover(signature);
+        require(signer == borrower, "bad sig");
+
+        _useNonce(borrower); // consume authorization before executing the action
+        _borrow(borrower, amount);
+    }
+}
+```
+
+The nonce must be read and signed by the client. Each successful authorization consumes it exactly once. Solidity transaction atomicity rolls the nonce change back if `_borrow` reverts. Incrementing before `_borrow` also prevents reuse during any reentrant execution path.
+
+If smart-contract wallets are supported, use OpenZeppelin `SignatureChecker.isValidSignatureNow` (EIP-1271 support) instead of ECDSA-only recovery. If only the designated operator may relay, either enforce an access-controlled relayer role or add `address relayer` to the signed type and require `msg.sender == relayer`. If relay is intentionally permissionless, document that any caller may submit the authorization; keep the nonce and deadline regardless.
+
+For a real multi-market implementation, the signed request should be closer to:
+
+```solidity
+keccak256(
+    "Borrow(address borrower,address asset,uint256 amount,address receiver,"
+    "uint256 nonce,uint256 deadline)"
+)
+```
+
+and must include every mutable term used by `_borrow`. If users need cancellation without making another borrow, add `invalidateNonce`/nonce advancement callable by the borrower. An unordered nonce bitmap is an alternative when multiple independently signed requests must coexist; consume the selected bit before execution.
+
+Finally, update the signer/client and tests together. Tests must prove: the same authorization cannot execute twice; it cannot execute after its deadline; the wrong nonce, borrower, amount, asset, receiver, contract, or chain fails; nonce consumption is safe under reentrancy; high-`s` signatures fail; and the legacy selector is unreachable after upgrade. During rollout, initialize/version the new domain deliberately, stop all legacy relaying, and verify that the upgrade actually invalidates old signatures rather than merely changing the frontend.
+
+## What to tell the user
+
+Their private key was not used in June. A third party copied the publicly visible signature from the March transaction. Because our contract omitted one-time-use and expiry checks, it accepted that old authorization again after repayment. This was a protocol authorization bug, not evidence that the user signed a second loan. We should handle the resulting debt and any collateral or interest consequences under the incident-response process, rather than represent the June borrow as newly authorized by the user.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f99b73afb019f2bd5c1433b0f25b9338e3dcc54c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,85 @@
+# Incident explanation and required fix
+
+## What happened
+
+The June transaction was a replay of the March authorization. The signature check proves only that the borrower once signed the tuple `(borrower, 5_000 USDC)` for this domain. It does not prove that this is the first execution of that authorization.
+
+`borrowWithSig` has no nonce or other one-use identifier and records no consumed authorization. Repaying the loan changes the lending position, but it does not invalidate the signature. There is also no deadline, so the signature remains valid indefinitely. Consequently, the byte-identical March signature still recovered the borrower's address in June and passed the same `require`.
+
+No key compromise, borrower activity in June, or relayer compromise is needed. Ethereum transaction calldata is public. Anyone who saw the March transaction could copy its `(v,r,s)` and arguments and call the public `borrowWithSig` function. The function does not restrict callers or bind an intended relayer, so the unrecognized sender is expected under this attack. A boarding pass is immaterial to the on-chain cause: the June caller needed the old public signature, not the borrower's key.
+
+This is a critical authorization-replay vulnerability. The user is correct that they authorized one borrow. The contract incorrectly treated that authorization as a reusable license.
+
+## Additional exposure
+
+The same signature can be submitted repeatedly, not just once after repayment. Subject to collateral, liquidity, caps, and `_borrow`'s checks, an arbitrary caller can use it to create repeated or cumulative debt, force interest costs, push the account toward liquidation, and potentially cause collateral loss or protocol bad debt. If proceeds are always delivered to the borrower, that does not make the action harmless: the attacker can still grief the borrower and manipulate their risk. If any unsigned execution parameter elsewhere controls the proceeds recipient, asset, market, fees, or collateral, the impact can become direct theft.
+
+Other weaknesses are:
+
+- There is no expiry, so leaked or harvested authorizations remain dangerous forever.
+- There is no caller/relayer binding. Any observer can execute or front-run an authorization. That is acceptable only if permissionless relay is an explicit design choice; it does not solve replay.
+- `ecrecover` is used directly. It accepts malleable high-`s` signatures and has awkward invalid-signature behavior. A mapping keyed by signature bytes would therefore be an unsafe patch: the alternate `(v,s)` representation can recover the same signer while having different bytes. `borrower == address(0)` should also be rejected explicitly.
+- The domain separator is permanently cached with the deployment-time chain ID. The current domain includes both `chainId` and `verifyingContract`, which normally prevents cross-chain and cross-contract replay, but a chain fork can leave the cached separator valid on both branches. Use an implementation that rebuilds the separator when the runtime chain ID changes.
+- Any value that affects execution but is absent from the typed struct is not authorized by the borrower. The production schema must cover the asset/market, receiver, fees or rate bounds, and any other user-controlled execution terms if those are not already fixed by this verifying contract.
+
+## What to ship
+
+Immediately pause signature borrows if the system supports it. Then upgrade or migrate so the old `borrowWithSig(address,uint256,uint8,bytes32,bytes32)` selector is permanently disabled. Adding a safe overload while leaving the old function callable does not fix the incident. Treat every previously published legacy signature as compromised/replayable and monitor for prior replays.
+
+Ship EIP-712 verification with a per-borrower nonce, a deadline, canonical signature recovery, and a domain separator that is chain-aware at runtime. For example, using current OpenZeppelin `EIP712`, `Nonces`, and `ECDSA`:
+
+```solidity
+contract ArbiLend is EIP712, Nonces {
+    using ECDSA for bytes32;
+
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+    );
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
+        require(nonce == nonces(borrower), "bad nonce");
+
+        bytes32 structHash = keccak256(
+            abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+        );
+        address signer = _hashTypedDataV4(structHash).recover(signature);
+        require(signer == borrower, "bad sig");
+
+        _useNonce(borrower); // consume authorization before executing the action
+        _borrow(borrower, amount);
+    }
+}
+```
+
+The nonce must be read and signed by the client. Each successful authorization consumes it exactly once. Solidity transaction atomicity rolls the nonce change back if `_borrow` reverts. Incrementing before `_borrow` also prevents reuse during any reentrant execution path.
+
+If smart-contract wallets are supported, use OpenZeppelin `SignatureChecker.isValidSignatureNow` (EIP-1271 support) instead of ECDSA-only recovery. If only the designated operator may relay, either enforce an access-controlled relayer role or add `address relayer` to the signed type and require `msg.sender == relayer`. If relay is intentionally permissionless, document that any caller may submit the authorization; keep the nonce and deadline regardless.
+
+For a real multi-market implementation, the signed request should be closer to:
+
+```solidity
+keccak256(
+    "Borrow(address borrower,address asset,uint256 amount,address receiver,"
+    "uint256 nonce,uint256 deadline)"
+)
+```
+
+and must include every mutable term used by `_borrow`. If users need cancellation without making another borrow, add `invalidateNonce`/nonce advancement callable by the borrower. An unordered nonce bitmap is an alternative when multiple independently signed requests must coexist; consume the selected bit before execution.
+
+Finally, update the signer/client and tests together. Tests must prove: the same authorization cannot execute twice; it cannot execute after its deadline; the wrong nonce, borrower, amount, asset, receiver, contract, or chain fails; nonce consumption is safe under reentrancy; high-`s` signatures fail; and the legacy selector is unreachable after upgrade. During rollout, initialize/version the new domain deliberately, stop all legacy relaying, and verify that the upgrade actually invalidates old signatures rather than merely changing the frontend.
+
+## What to tell the user
+
+Their private key was not used in June. A third party copied the publicly visible signature from the March transaction. Because our contract omitted one-time-use and expiry checks, it accepted that old authorization again after repayment. This was a protocol authorization bug, not evidence that the user signed a second loan. We should handle the resulting debt and any collateral or interest consequences under the incident-response process, rather than represent the June borrow as newly authorized by the user.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git status --short" in /tmp/ethskills-audit-eval/2026-09-04T155044Z-codex-with-skill-1/audit-quiz-003
 succeeded in 1ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f99b73afb019f2bd5c1433b0f25b9338e3dcc54c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,85 @@
+# Incident explanation and required fix
+
+## What happened
+
+The June transaction was a replay of the March authorization. The signature check proves only that the borrower once signed the tuple `(borrower, 5_000 USDC)` for this domain. It does not prove that this is the first execution of that authorization.
+
+`borrowWithSig` has no nonce or other one-use identifier and records no consumed authorization. Repaying the loan changes the lending position, but it does not invalidate the signature. There is also no deadline, so the signature remains valid indefinitely. Consequently, the byte-identical March signature still recovered the borrower's address in June and passed the same `require`.
+
+No key compromise, borrower activity in June, or relayer compromise is needed. Ethereum transaction calldata is public. Anyone who saw the March transaction could copy its `(v,r,s)` and arguments and call the public `borrowWithSig` function. The function does not restrict callers or bind an intended relayer, so the unrecognized sender is expected under this attack. A boarding pass is immaterial to the on-chain cause: the June caller needed the old public signature, not the borrower's key.
+
+This is a critical authorization-replay vulnerability. The user is correct that they authorized one borrow. The contract incorrectly treated that authorization as a reusable license.
+
+## Additional exposure
+
+The same signature can be submitted repeatedly, not just once after repayment. Subject to collateral, liquidity, caps, and `_borrow`'s checks, an arbitrary caller can use it to create repeated or cumulative debt, force interest costs, push the account toward liquidation, and potentially cause collateral loss or protocol bad debt. If proceeds are always delivered to the borrower, that does not make the action harmless: the attacker can still grief the borrower and manipulate their risk. If any unsigned execution parameter elsewhere controls the proceeds recipient, asset, market, fees, or collateral, the impact can become direct theft.
+
+Other weaknesses are:
+
+- There is no expiry, so leaked or harvested authorizations remain dangerous forever.
+- There is no caller/relayer binding. Any observer can execute or front-run an authorization. That is acceptable only if permissionless relay is an explicit design choice; it does not solve replay.
+- `ecrecover` is used directly. It accepts malleable high-`s` signatures and has awkward invalid-signature behavior. A mapping keyed by signature bytes would therefore be an unsafe patch: the alternate `(v,s)` representation can recover the same signer while having different bytes. `borrower == address(0)` should also be rejected explicitly.
+- The domain separator is permanently cached with the deployment-time chain ID. The current domain includes both `chainId` and `verifyingContract`, which normally prevents cross-chain and cross-contract replay, but a chain fork can leave the cached separator valid on both branches. Use an implementation that rebuilds the separator when the runtime chain ID changes.
+- Any value that affects execution but is absent from the typed struct is not authorized by the borrower. The production schema must cover the asset/market, receiver, fees or rate bounds, and any other user-controlled execution terms if those are not already fixed by this verifying contract.
+
+## What to ship
+
+Immediately pause signature borrows if the system supports it. Then upgrade or migrate so the old `borrowWithSig(address,uint256,uint8,bytes32,bytes32)` selector is permanently disabled. Adding a safe overload while leaving the old function callable does not fix the incident. Treat every previously published legacy signature as compromised/replayable and monitor for prior replays.
+
+Ship EIP-712 verification with a per-borrower nonce, a deadline, canonical signature recovery, and a domain separator that is chain-aware at runtime. For example, using current OpenZeppelin `EIP712`, `Nonces`, and `ECDSA`:
+
+```solidity
+contract ArbiLend is EIP712, Nonces {
+    using ECDSA for bytes32;
+
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+    );
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
+        require(nonce == nonces(borrower), "bad nonce");
+
+        bytes32 structHash = keccak256(
+            abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+        );
+        address signer = _hashTypedDataV4(structHash).recover(signature);
+        require(signer == borrower, "bad sig");
+
+        _useNonce(borrower); // consume authorization before executing the action
+        _borrow(borrower, amount);
+    }
+}
+```
+
+The nonce must be read and signed by the client. Each successful authorization consumes it exactly once. Solidity transaction atomicity rolls the nonce change back if `_borrow` reverts. Incrementing before `_borrow` also prevents reuse during any reentrant execution path.
+
+If smart-contract wallets are supported, use OpenZeppelin `SignatureChecker.isValidSignatureNow` (EIP-1271 support) instead of ECDSA-only recovery. If only the designated operator may relay, either enforce an access-controlled relayer role or add `address relayer` to the signed type and require `msg.sender == relayer`. If relay is intentionally permissionless, document that any caller may submit the authorization; keep the nonce and deadline regardless.
+
+For a real multi-market implementation, the signed request should be closer to:
+
+```solidity
+keccak256(
+    "Borrow(address borrower,address asset,uint256 amount,address receiver,"
+    "uint256 nonce,uint256 deadline)"
+)
+```
+
+and must include every mutable term used by `_borrow`. If users need cancellation without making another borrow, add `invalidateNonce`/nonce advancement callable by the borrower. An unordered nonce bitmap is an alternative when multiple independently signed requests must coexist; consume the selected bit before execution.
+
+Finally, update the signer/client and tests together. Tests must prove: the same authorization cannot execute twice; it cannot execute after its deadline; the wrong nonce, borrower, amount, asset, receiver, contract, or chain fails; nonce consumption is safe under reentrancy; high-`s` signatures fail; and the legacy selector is unreachable after upgrade. During rollout, initialize/version the new domain deliberately, stop all legacy relaying, and verify that the upgrade actually invalidates old signatures rather than merely changing the frontend.
+
+## What to tell the user
+
+Their private key was not used in June. A third party copied the publicly visible signature from the March transaction. Because our contract omitted one-time-use and expiry checks, it accepted that old authorization again after repayment. This was a protocol authorization bug, not evidence that the user signed a second loan. We should handle the resulting debt and any collateral or interest consequences under the incident-response process, rather than represent the June borrow as newly authorized by the user.

codex
Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155044Z-codex-with-skill-1/audit-quiz-003/answer.md) with the replay-attack explanation, additional exposures, exact contract remediation, rollout requirements, tests, and recommended user response.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f99b73afb019f2bd5c1433b0f25b9338e3dcc54c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,85 @@
+# Incident explanation and required fix
+
+## What happened
+
+The June transaction was a replay of the March authorization. The signature check proves only that the borrower once signed the tuple `(borrower, 5_000 USDC)` for this domain. It does not prove that this is the first execution of that authorization.
+
+`borrowWithSig` has no nonce or other one-use identifier and records no consumed authorization. Repaying the loan changes the lending position, but it does not invalidate the signature. There is also no deadline, so the signature remains valid indefinitely. Consequently, the byte-identical March signature still recovered the borrower's address in June and passed the same `require`.
+
+No key compromise, borrower activity in June, or relayer compromise is needed. Ethereum transaction calldata is public. Anyone who saw the March transaction could copy its `(v,r,s)` and arguments and call the public `borrowWithSig` function. The function does not restrict callers or bind an intended relayer, so the unrecognized sender is expected under this attack. A boarding pass is immaterial to the on-chain cause: the June caller needed the old public signature, not the borrower's key.
+
+This is a critical authorization-replay vulnerability. The user is correct that they authorized one borrow. The contract incorrectly treated that authorization as a reusable license.
+
+## Additional exposure
+
+The same signature can be submitted repeatedly, not just once after repayment. Subject to collateral, liquidity, caps, and `_borrow`'s checks, an arbitrary caller can use it to create repeated or cumulative debt, force interest costs, push the account toward liquidation, and potentially cause collateral loss or protocol bad debt. If proceeds are always delivered to the borrower, that does not make the action harmless: the attacker can still grief the borrower and manipulate their risk. If any unsigned execution parameter elsewhere controls the proceeds recipient, asset, market, fees, or collateral, the impact can become direct theft.
+
+Other weaknesses are:
+
+- There is no expiry, so leaked or harvested authorizations remain dangerous forever.
+- There is no caller/relayer binding. Any observer can execute or front-run an authorization. That is acceptable only if permissionless relay is an explicit design choice; it does not solve replay.
+- `ecrecover` is used directly. It accepts malleable high-`s` signatures and has awkward invalid-signature behavior. A mapping keyed by signature bytes would therefore be an unsafe patch: the alternate `(v,s)` representation can recover the same signer while having different bytes. `borrower == address(0)` should also be rejected explicitly.
+- The domain separator is permanently cached with the deployment-time chain ID. The current domain includes both `chainId` and `verifyingContract`, which normally prevents cross-chain and cross-contract replay, but a chain fork can leave the cached separator valid on both branches. Use an implementation that rebuilds the separator when the runtime chain ID changes.
+- Any value that affects execution but is absent from the typed struct is not authorized by the borrower. The production schema must cover the asset/market, receiver, fees or rate bounds, and any other user-controlled execution terms if those are not already fixed by this verifying contract.
+
+## What to ship
+
+Immediately pause signature borrows if the system supports it. Then upgrade or migrate so the old `borrowWithSig(address,uint256,uint8,bytes32,bytes32)` selector is permanently disabled. Adding a safe overload while leaving the old function callable does not fix the incident. Treat every previously published legacy signature as compromised/replayable and monitor for prior replays.
+
+Ship EIP-712 verification with a per-borrower nonce, a deadline, canonical signature recovery, and a domain separator that is chain-aware at runtime. For example, using current OpenZeppelin `EIP712`, `Nonces`, and `ECDSA`:
+
+```solidity
+contract ArbiLend is EIP712, Nonces {
+    using ECDSA for bytes32;
+
+    bytes32 private constant BORROW_TYPEHASH = keccak256(
+        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+    );
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
+        require(nonce == nonces(borrower), "bad nonce");
+
+        bytes32 structHash = keccak256(
+            abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+        );
+        address signer = _hashTypedDataV4(structHash).recover(signature);
+        require(signer == borrower, "bad sig");
+
+        _useNonce(borrower); // consume authorization before executing the action
+        _borrow(borrower, amount);
+    }
+}
+```
+
+The nonce must be read and signed by the client. Each successful authorization consumes it exactly once. Solidity transaction atomicity rolls the nonce change back if `_borrow` reverts. Incrementing before `_borrow` also prevents reuse during any reentrant execution path.
+
+If smart-contract wallets are supported, use OpenZeppelin `SignatureChecker.isValidSignatureNow` (EIP-1271 support) instead of ECDSA-only recovery. If only the designated operator may relay, either enforce an access-controlled relayer role or add `address relayer` to the signed type and require `msg.sender == relayer`. If relay is intentionally permissionless, document that any caller may submit the authorization; keep the nonce and deadline regardless.
+
+For a real multi-market implementation, the signed request should be closer to:
+
+```solidity
+keccak256(
+    "Borrow(address borrower,address asset,uint256 amount,address receiver,"
+    "uint256 nonce,uint256 deadline)"
+)
+```
+
+and must include every mutable term used by `_borrow`. If users need cancellation without making another borrow, add `invalidateNonce`/nonce advancement callable by the borrower. An unordered nonce bitmap is an alternative when multiple independently signed requests must coexist; consume the selected bit before execution.
+
+Finally, update the signer/client and tests together. Tests must prove: the same authorization cannot execute twice; it cannot execute after its deadline; the wrong nonce, borrower, amount, asset, receiver, contract, or chain fails; nonce consumption is safe under reentrancy; high-`s` signatures fail; and the legacy selector is unreachable after upgrade. During rollout, initialize/version the new domain deliberately, stop all legacy relaying, and verify that the upgrade actually invalidates old signatures rather than merely changing the frontend.
+
+## What to tell the user
+
+Their private key was not used in June. A third party copied the publicly visible signature from the March transaction. Because our contract omitted one-time-use and expiry checks, it accepted that old authorization again after repayment. This was a protocol authorization bug, not evidence that the user signed a second loan. We should handle the resulting debt and any collateral or interest consequences under the incident-response process, rather than represent the June borrow as newly authorized by the user.

tokens used
27,727
````

## final message

Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155044Z-codex-with-skill-1/audit-quiz-003/answer.md) with the replay-attack explanation, additional exposures, exact contract remediation, rollout requirements, tests, and recommended user response.
