# Executor transcript — 2026-09-02T151519Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-02T151519Z-codex-no-skill-1/audit-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-02T151519Z-codex-no-skill-1/audit-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a062b0-5cf8-7c11-b14c-b0037dfaa60f
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

2026-09-02T15:15:20.665492Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a062b0-5cf8-7c11-b14c-b0037dfaa60f.tmp-1788362120454130949: line 2547: syntax error near unexpected token `('

codex
I’ll trace the signature’s authorization scope, inspect the workspace guidance, then write a concrete incident explanation and patch specification to `answer.md`.
exec
/bin/bash -lc "ls -la && find .. -name AGENTS.md -print && rg --files -g '"'!answer.md'"' . | head -100" in /tmp/ethskills-audit-eval/2026-09-02T151519Z-codex-no-skill-1/audit-quiz-003
 succeeded in 8ms:
./package.json
./TASK.md

codex
The key fact is that `ecrecover` proves who signed the message, but the message contains no “use once” state. I’m also covering delayed execution, signature malleability, fork/domain behavior, and the rollout needed to make old authorizations unusable.
2026-09-02T15:16:49.144063Z  WARN codex_core::responses_retry: stream disconnected - retrying sampling request (1/5 in 204ms)... turn_id=01a062b0-5d7d-7f22-8b8e-2c59d0875ccf retries=1 max_retries=5 sampling_error=stream disconnected before completion: WebSocket protocol error: Connection reset without closing handshake
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-02T151519Z-codex-no-skill-1/audit-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..33ce096d2824500502259ee341cf47c00feaabd5
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,73 @@
+# Incident explanation and remediation
+
+## What happened in June
+
+The June transaction was a replay of the user's valid March authorization.
+
+The signed EIP-712 message is effectively:
+
+```text
+ArbiLend v1, on this chain, at this contract:
+borrow 5,000 USDC for <borrower>
+```
+
+It does **not** say "only once," "before a particular time," or "only when submitted by our relayer." The contract also records no fact that the authorization was consumed. Consequently, after the March borrow was repaid, exactly the same digest and signature still passed `ecrecover`, and `_borrow` created the debt again. Repayment changes the account's debt, but it does not revoke a signature.
+
+Anyone can read `(v, r, s)` from the public March transaction and call the public function. The unknown June sender therefore needed neither the borrower's private key nor access to the operator. The boarding pass and the absence of key compromise are consistent with the on-chain evidence. The signature is authentic; the contract interpreted its scope too broadly.
+
+This is an authorization-replay vulnerability, not evidence that the borrower authorized a second loan. We should tell the user that their one-time authorization was accepted twice because of a protocol defect, and treat the June debt and any resulting interest, fees, or liquidation effects as unauthorized under the intended product semantics.
+
+## Other exposure
+
+- The same signature can be submitted again, without limit, whenever the position has enough borrowing capacity. An attacker can also race the intended first submission or repeatedly use it after later repayments/collateral deposits.
+- A signature that is never submitted promptly remains valid indefinitely. A relayer, mempool observer, compromised database, or any later holder can execute it when prices, rates, collateral, or the user's circumstances are less favorable.
+- The signed data does not constrain mutable execution terms. If `_borrow` depends on an interest-rate model, fees, oracle prices, collateral selection, proceeds recipient, slippage-like limits, or another market choice not already fixed by this verifying contract and `borrower`, the signer did not approve bounds for those values.
+- Raw `ecrecover` does not reject high-`s` malleable signatures or invalid `v` values as robustly as a maintained signature library. A valid ECDSA signature may have an alternative byte representation with the same signer. This is not needed for the observed replay, but it means a future patch that marks only `keccak256(signatureBytes)` as used would still be bypassable. Consumption must be keyed by an authorization nonce/digest, not signature bytes.
+- The domain prevents ordinary replay into a different contract address or chain ID, but the separator is cached forever. If a chain fork changes `block.chainid`, this contract continues accepting signatures under the old domain; copies on both sides can share the same stored separator and signatures can be replayed across the fork. Deployments that reproduce both the chain ID and contract address have the same issue.
+- `ecrecover(...) == borrower` supports only EOAs. If contract-wallet borrowers are or may become supported, this scheme lacks ERC-1271 validation. Also reject `address(0)` explicitly: `ecrecover` returns zero for malformed signatures, so a zero borrower would otherwise satisfy the equality check if `_borrow` permits it.
+
+Permissionless submission is not itself a flaw if gasless borrowing is meant to work with any relayer. If only the operator should submit, `msg.sender` must also be authorized or included in the signed message—but that is a policy choice and is not a substitute for replay protection.
+
+## What to ship
+
+Immediately pause or disable the existing `borrowWithSig` entry point. Search all successful calls for repeated signed digests and remediate affected accounts. Do not leave the old path callable alongside a corrected overload: every already disclosed v1 signature would remain reusable through it.
+
+Replace it with a new authorization type and bump the EIP-712 domain version so existing v1 signatures cannot be interpreted as v2 authorizations:
+
+```solidity
+bytes32 constant BORROW_TYPEHASH = keccak256(
+    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+);
+
+mapping(address => uint256) public borrowNonces;
+
+function borrowWithSig(
+    address borrower,
+    uint256 amount,
+    uint256 nonce,
+    uint256 deadline,
+    bytes calldata signature
+) external {
+    require(borrower != address(0), "zero borrower");
+    require(block.timestamp <= deadline, "expired");
+    require(nonce == borrowNonces[borrower], "bad nonce");
+
+    bytes32 structHash = keccak256(
+        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+    );
+    bytes32 digest = _hashTypedDataV4(structHash);
+    require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");
+
+    // Consume before code that can make an external call. A revert rolls this back.
+    borrowNonces[borrower] = nonce + 1;
+    _borrow(borrower, amount);
+}
+```
+
+Use audited OpenZeppelin `EIP712` plus `SignatureChecker` (or `ECDSA.recover` if borrowers are guaranteed to be EOAs), rather than raw `ecrecover`. These enforce canonical EOA signatures; `SignatureChecker` additionally supports ERC-1271 wallets. OpenZeppelin's EIP-712 implementation also derives a separator appropriate to the current chain and contract, avoiding a permanently stale chain ID. Use checked nonce increment semantics and a sufficiently wide nonce (`uint256`).
+
+The nonce is the actual one-use control. A simple monotonically increasing per-borrower nonce is appropriate: the signed nonce must equal `borrowNonces[borrower]`, and it is incremented atomically before borrowing. The deadline limits how long an unused authorization remains dangerous. Expose a borrower-authorized `invalidateBorrowNonces(newNonce)`/cancellation path if users need to revoke outstanding signatures; require `newNonce > currentNonce`, and emit events for use and invalidation.
+
+The production type should also bind every user-controlled or economically material parameter used by `_borrow`. Depending on the implementation, that can include the asset or market ID, destination of proceeds, collateral/account identifier, maximum acceptable interest rate or fee, referral/delegation data, and any execution mode. Include a relayer only if product policy deliberately restricts who may submit. Keep `verifyingContract`, live `chainId`, a unique protocol name, and the bumped version in the domain.
+
+Finally, add tests that prove: the same authorization cannot succeed twice; repayment does not reset its nonce; expired, wrong-nonce, wrong-chain, wrong-contract, and altered-parameter signatures fail; cancellation works; high-`s`/bad-`v` signatures fail; reentrancy cannot reuse a nonce; and both EOA and ERC-1271 behavior match the supported account model.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..33ce096d2824500502259ee341cf47c00feaabd5
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,73 @@
+# Incident explanation and remediation
+
+## What happened in June
+
+The June transaction was a replay of the user's valid March authorization.
+
+The signed EIP-712 message is effectively:
+
+```text
+ArbiLend v1, on this chain, at this contract:
+borrow 5,000 USDC for <borrower>
+```
+
+It does **not** say "only once," "before a particular time," or "only when submitted by our relayer." The contract also records no fact that the authorization was consumed. Consequently, after the March borrow was repaid, exactly the same digest and signature still passed `ecrecover`, and `_borrow` created the debt again. Repayment changes the account's debt, but it does not revoke a signature.
+
+Anyone can read `(v, r, s)` from the public March transaction and call the public function. The unknown June sender therefore needed neither the borrower's private key nor access to the operator. The boarding pass and the absence of key compromise are consistent with the on-chain evidence. The signature is authentic; the contract interpreted its scope too broadly.
+
+This is an authorization-replay vulnerability, not evidence that the borrower authorized a second loan. We should tell the user that their one-time authorization was accepted twice because of a protocol defect, and treat the June debt and any resulting interest, fees, or liquidation effects as unauthorized under the intended product semantics.
+
+## Other exposure
+
+- The same signature can be submitted again, without limit, whenever the position has enough borrowing capacity. An attacker can also race the intended first submission or repeatedly use it after later repayments/collateral deposits.
+- A signature that is never submitted promptly remains valid indefinitely. A relayer, mempool observer, compromised database, or any later holder can execute it when prices, rates, collateral, or the user's circumstances are less favorable.
+- The signed data does not constrain mutable execution terms. If `_borrow` depends on an interest-rate model, fees, oracle prices, collateral selection, proceeds recipient, slippage-like limits, or another market choice not already fixed by this verifying contract and `borrower`, the signer did not approve bounds for those values.
+- Raw `ecrecover` does not reject high-`s` malleable signatures or invalid `v` values as robustly as a maintained signature library. A valid ECDSA signature may have an alternative byte representation with the same signer. This is not needed for the observed replay, but it means a future patch that marks only `keccak256(signatureBytes)` as used would still be bypassable. Consumption must be keyed by an authorization nonce/digest, not signature bytes.
+- The domain prevents ordinary replay into a different contract address or chain ID, but the separator is cached forever. If a chain fork changes `block.chainid`, this contract continues accepting signatures under the old domain; copies on both sides can share the same stored separator and signatures can be replayed across the fork. Deployments that reproduce both the chain ID and contract address have the same issue.
+- `ecrecover(...) == borrower` supports only EOAs. If contract-wallet borrowers are or may become supported, this scheme lacks ERC-1271 validation. Also reject `address(0)` explicitly: `ecrecover` returns zero for malformed signatures, so a zero borrower would otherwise satisfy the equality check if `_borrow` permits it.
+
+Permissionless submission is not itself a flaw if gasless borrowing is meant to work with any relayer. If only the operator should submit, `msg.sender` must also be authorized or included in the signed message—but that is a policy choice and is not a substitute for replay protection.
+
+## What to ship
+
+Immediately pause or disable the existing `borrowWithSig` entry point. Search all successful calls for repeated signed digests and remediate affected accounts. Do not leave the old path callable alongside a corrected overload: every already disclosed v1 signature would remain reusable through it.
+
+Replace it with a new authorization type and bump the EIP-712 domain version so existing v1 signatures cannot be interpreted as v2 authorizations:
+
+```solidity
+bytes32 constant BORROW_TYPEHASH = keccak256(
+    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+);
+
+mapping(address => uint256) public borrowNonces;
+
+function borrowWithSig(
+    address borrower,
+    uint256 amount,
+    uint256 nonce,
+    uint256 deadline,
+    bytes calldata signature
+) external {
+    require(borrower != address(0), "zero borrower");
+    require(block.timestamp <= deadline, "expired");
+    require(nonce == borrowNonces[borrower], "bad nonce");
+
+    bytes32 structHash = keccak256(
+        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+    );
+    bytes32 digest = _hashTypedDataV4(structHash);
+    require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");
+
+    // Consume before code that can make an external call. A revert rolls this back.
+    borrowNonces[borrower] = nonce + 1;
+    _borrow(borrower, amount);
+}
+```
+
+Use audited OpenZeppelin `EIP712` plus `SignatureChecker` (or `ECDSA.recover` if borrowers are guaranteed to be EOAs), rather than raw `ecrecover`. These enforce canonical EOA signatures; `SignatureChecker` additionally supports ERC-1271 wallets. OpenZeppelin's EIP-712 implementation also derives a separator appropriate to the current chain and contract, avoiding a permanently stale chain ID. Use checked nonce increment semantics and a sufficiently wide nonce (`uint256`).
+
+The nonce is the actual one-use control. A simple monotonically increasing per-borrower nonce is appropriate: the signed nonce must equal `borrowNonces[borrower]`, and it is incremented atomically before borrowing. The deadline limits how long an unused authorization remains dangerous. Expose a borrower-authorized `invalidateBorrowNonces(newNonce)`/cancellation path if users need to revoke outstanding signatures; require `newNonce > currentNonce`, and emit events for use and invalidation.
+
+The production type should also bind every user-controlled or economically material parameter used by `_borrow`. Depending on the implementation, that can include the asset or market ID, destination of proceeds, collateral/account identifier, maximum acceptable interest rate or fee, referral/delegation data, and any execution mode. Include a relayer only if product policy deliberately restricts who may submit. Keep `verifyingContract`, live `chainId`, a unique protocol name, and the bumped version in the domain.
+
+Finally, add tests that prove: the same authorization cannot succeed twice; repayment does not reset its nonce; expired, wrong-nonce, wrong-chain, wrong-contract, and altered-parameter signatures fail; cancellation works; high-`s`/bad-`v` signatures fail; reentrancy cannot reuse a nonce; and both EOA and ERC-1271 behavior match the supported account model.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git diff --check -- answer.md && git status --short" in /tmp/ethskills-audit-eval/2026-09-02T151519Z-codex-no-skill-1/audit-quiz-003
 succeeded in 15ms:
# Incident explanation and remediation

## What happened in June

The June transaction was a replay of the user's valid March authorization.

The signed EIP-712 message is effectively:

```text
ArbiLend v1, on this chain, at this contract:
borrow 5,000 USDC for <borrower>
```

It does **not** say "only once," "before a particular time," or "only when submitted by our relayer." The contract also records no fact that the authorization was consumed. Consequently, after the March borrow was repaid, exactly the same digest and signature still passed `ecrecover`, and `_borrow` created the debt again. Repayment changes the account's debt, but it does not revoke a signature.

Anyone can read `(v, r, s)` from the public March transaction and call the public function. The unknown June sender therefore needed neither the borrower's private key nor access to the operator. The boarding pass and the absence of key compromise are consistent with the on-chain evidence. The signature is authentic; the contract interpreted its scope too broadly.

This is an authorization-replay vulnerability, not evidence that the borrower authorized a second loan. We should tell the user that their one-time authorization was accepted twice because of a protocol defect, and treat the June debt and any resulting interest, fees, or liquidation effects as unauthorized under the intended product semantics.

## Other exposure

- The same signature can be submitted again, without limit, whenever the position has enough borrowing capacity. An attacker can also race the intended first submission or repeatedly use it after later repayments/collateral deposits.
- A signature that is never submitted promptly remains valid indefinitely. A relayer, mempool observer, compromised database, or any later holder can execute it when prices, rates, collateral, or the user's circumstances are less favorable.
- The signed data does not constrain mutable execution terms. If `_borrow` depends on an interest-rate model, fees, oracle prices, collateral selection, proceeds recipient, slippage-like limits, or another market choice not already fixed by this verifying contract and `borrower`, the signer did not approve bounds for those values.
- Raw `ecrecover` does not reject high-`s` malleable signatures or invalid `v` values as robustly as a maintained signature library. A valid ECDSA signature may have an alternative byte representation with the same signer. This is not needed for the observed replay, but it means a future patch that marks only `keccak256(signatureBytes)` as used would still be bypassable. Consumption must be keyed by an authorization nonce/digest, not signature bytes.
- The domain prevents ordinary replay into a different contract address or chain ID, but the separator is cached forever. If a chain fork changes `block.chainid`, this contract continues accepting signatures under the old domain; copies on both sides can share the same stored separator and signatures can be replayed across the fork. Deployments that reproduce both the chain ID and contract address have the same issue.
- `ecrecover(...) == borrower` supports only EOAs. If contract-wallet borrowers are or may become supported, this scheme lacks ERC-1271 validation. Also reject `address(0)` explicitly: `ecrecover` returns zero for malformed signatures, so a zero borrower would otherwise satisfy the equality check if `_borrow` permits it.

Permissionless submission is not itself a flaw if gasless borrowing is meant to work with any relayer. If only the operator should submit, `msg.sender` must also be authorized or included in the signed message—but that is a policy choice and is not a substitute for replay protection.

## What to ship

Immediately pause or disable the existing `borrowWithSig` entry point. Search all successful calls for repeated signed digests and remediate affected accounts. Do not leave the old path callable alongside a corrected overload: every already disclosed v1 signature would remain reusable through it.

Replace it with a new authorization type and bump the EIP-712 domain version so existing v1 signatures cannot be interpreted as v2 authorizations:

```solidity
bytes32 constant BORROW_TYPEHASH = keccak256(
    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
);

mapping(address => uint256) public borrowNonces;

function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 nonce,
    uint256 deadline,
    bytes calldata signature
) external {
    require(borrower != address(0), "zero borrower");
    require(block.timestamp <= deadline, "expired");
    require(nonce == borrowNonces[borrower], "bad nonce");

    bytes32 structHash = keccak256(
        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");

    // Consume before code that can make an external call. A revert rolls this back.
    borrowNonces[borrower] = nonce + 1;
    _borrow(borrower, amount);
}
```

Use audited OpenZeppelin `EIP712` plus `SignatureChecker` (or `ECDSA.recover` if borrowers are guaranteed to be EOAs), rather than raw `ecrecover`. These enforce canonical EOA signatures; `SignatureChecker` additionally supports ERC-1271 wallets. OpenZeppelin's EIP-712 implementation also derives a separator appropriate to the current chain and contract, avoiding a permanently stale chain ID. Use checked nonce increment semantics and a sufficiently wide nonce (`uint256`).

The nonce is the actual one-use control. A simple monotonically increasing per-borrower nonce is appropriate: the signed nonce must equal `borrowNonces[borrower]`, and it is incremented atomically before borrowing. The deadline limits how long an unused authorization remains dangerous. Expose a borrower-authorized `invalidateBorrowNonces(newNonce)`/cancellation path if users need to revoke outstanding signatures; require `newNonce > currentNonce`, and emit events for use and invalidation.

The production type should also bind every user-controlled or economically material parameter used by `_borrow`. Depending on the implementation, that can include the asset or market ID, destination of proceeds, collateral/account identifier, maximum acceptable interest rate or fee, referral/delegation data, and any execution mode. Include a relayer only if product policy deliberately restricts who may submit. Keep `verifyingContract`, live `chainId`, a unique protocol name, and the bumped version in the domain.

Finally, add tests that prove: the same authorization cannot succeed twice; repayment does not reset its nonce; expired, wrong-nonce, wrong-chain, wrong-contract, and altered-parameter signatures fail; cancellation works; high-`s`/bad-`v` signatures fail; reentrancy cannot reuse a nonce; and both EOA and ERC-1271 behavior match the supported account model.
?? answer.md

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..33ce096d2824500502259ee341cf47c00feaabd5
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,73 @@
+# Incident explanation and remediation
+
+## What happened in June
+
+The June transaction was a replay of the user's valid March authorization.
+
+The signed EIP-712 message is effectively:
+
+```text
+ArbiLend v1, on this chain, at this contract:
+borrow 5,000 USDC for <borrower>
+```
+
+It does **not** say "only once," "before a particular time," or "only when submitted by our relayer." The contract also records no fact that the authorization was consumed. Consequently, after the March borrow was repaid, exactly the same digest and signature still passed `ecrecover`, and `_borrow` created the debt again. Repayment changes the account's debt, but it does not revoke a signature.
+
+Anyone can read `(v, r, s)` from the public March transaction and call the public function. The unknown June sender therefore needed neither the borrower's private key nor access to the operator. The boarding pass and the absence of key compromise are consistent with the on-chain evidence. The signature is authentic; the contract interpreted its scope too broadly.
+
+This is an authorization-replay vulnerability, not evidence that the borrower authorized a second loan. We should tell the user that their one-time authorization was accepted twice because of a protocol defect, and treat the June debt and any resulting interest, fees, or liquidation effects as unauthorized under the intended product semantics.
+
+## Other exposure
+
+- The same signature can be submitted again, without limit, whenever the position has enough borrowing capacity. An attacker can also race the intended first submission or repeatedly use it after later repayments/collateral deposits.
+- A signature that is never submitted promptly remains valid indefinitely. A relayer, mempool observer, compromised database, or any later holder can execute it when prices, rates, collateral, or the user's circumstances are less favorable.
+- The signed data does not constrain mutable execution terms. If `_borrow` depends on an interest-rate model, fees, oracle prices, collateral selection, proceeds recipient, slippage-like limits, or another market choice not already fixed by this verifying contract and `borrower`, the signer did not approve bounds for those values.
+- Raw `ecrecover` does not reject high-`s` malleable signatures or invalid `v` values as robustly as a maintained signature library. A valid ECDSA signature may have an alternative byte representation with the same signer. This is not needed for the observed replay, but it means a future patch that marks only `keccak256(signatureBytes)` as used would still be bypassable. Consumption must be keyed by an authorization nonce/digest, not signature bytes.
+- The domain prevents ordinary replay into a different contract address or chain ID, but the separator is cached forever. If a chain fork changes `block.chainid`, this contract continues accepting signatures under the old domain; copies on both sides can share the same stored separator and signatures can be replayed across the fork. Deployments that reproduce both the chain ID and contract address have the same issue.
+- `ecrecover(...) == borrower` supports only EOAs. If contract-wallet borrowers are or may become supported, this scheme lacks ERC-1271 validation. Also reject `address(0)` explicitly: `ecrecover` returns zero for malformed signatures, so a zero borrower would otherwise satisfy the equality check if `_borrow` permits it.
+
+Permissionless submission is not itself a flaw if gasless borrowing is meant to work with any relayer. If only the operator should submit, `msg.sender` must also be authorized or included in the signed message—but that is a policy choice and is not a substitute for replay protection.
+
+## What to ship
+
+Immediately pause or disable the existing `borrowWithSig` entry point. Search all successful calls for repeated signed digests and remediate affected accounts. Do not leave the old path callable alongside a corrected overload: every already disclosed v1 signature would remain reusable through it.
+
+Replace it with a new authorization type and bump the EIP-712 domain version so existing v1 signatures cannot be interpreted as v2 authorizations:
+
+```solidity
+bytes32 constant BORROW_TYPEHASH = keccak256(
+    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+);
+
+mapping(address => uint256) public borrowNonces;
+
+function borrowWithSig(
+    address borrower,
+    uint256 amount,
+    uint256 nonce,
+    uint256 deadline,
+    bytes calldata signature
+) external {
+    require(borrower != address(0), "zero borrower");
+    require(block.timestamp <= deadline, "expired");
+    require(nonce == borrowNonces[borrower], "bad nonce");
+
+    bytes32 structHash = keccak256(
+        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+    );
+    bytes32 digest = _hashTypedDataV4(structHash);
+    require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");
+
+    // Consume before code that can make an external call. A revert rolls this back.
+    borrowNonces[borrower] = nonce + 1;
+    _borrow(borrower, amount);
+}
+```
+
+Use audited OpenZeppelin `EIP712` plus `SignatureChecker` (or `ECDSA.recover` if borrowers are guaranteed to be EOAs), rather than raw `ecrecover`. These enforce canonical EOA signatures; `SignatureChecker` additionally supports ERC-1271 wallets. OpenZeppelin's EIP-712 implementation also derives a separator appropriate to the current chain and contract, avoiding a permanently stale chain ID. Use checked nonce increment semantics and a sufficiently wide nonce (`uint256`).
+
+The nonce is the actual one-use control. A simple monotonically increasing per-borrower nonce is appropriate: the signed nonce must equal `borrowNonces[borrower]`, and it is incremented atomically before borrowing. The deadline limits how long an unused authorization remains dangerous. Expose a borrower-authorized `invalidateBorrowNonces(newNonce)`/cancellation path if users need to revoke outstanding signatures; require `newNonce > currentNonce`, and emit events for use and invalidation.
+
+The production type should also bind every user-controlled or economically material parameter used by `_borrow`. Depending on the implementation, that can include the asset or market ID, destination of proceeds, collateral/account identifier, maximum acceptable interest rate or fee, referral/delegation data, and any execution mode. Include a relayer only if product policy deliberately restricts who may submit. Keep `verifyingContract`, live `chainId`, a unique protocol name, and the bumped version in the domain.
+
+Finally, add tests that prove: the same authorization cannot succeed twice; repayment does not reset its nonce; expired, wrong-nonce, wrong-chain, wrong-contract, and altered-parameter signatures fail; cancellation works; high-`s`/bad-`v` signatures fail; reentrancy cannot reuse a nonce; and both EOA and ERC-1271 behavior match the supported account model.

codex
Created [answer.md](/tmp/ethskills-audit-eval/2026-09-02T151519Z-codex-no-skill-1/audit-quiz-003/answer.md) with the incident explanation, additional vulnerabilities, exact remediation design, rollout precautions, and required tests.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..33ce096d2824500502259ee341cf47c00feaabd5
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,73 @@
+# Incident explanation and remediation
+
+## What happened in June
+
+The June transaction was a replay of the user's valid March authorization.
+
+The signed EIP-712 message is effectively:
+
+```text
+ArbiLend v1, on this chain, at this contract:
+borrow 5,000 USDC for <borrower>
+```
+
+It does **not** say "only once," "before a particular time," or "only when submitted by our relayer." The contract also records no fact that the authorization was consumed. Consequently, after the March borrow was repaid, exactly the same digest and signature still passed `ecrecover`, and `_borrow` created the debt again. Repayment changes the account's debt, but it does not revoke a signature.
+
+Anyone can read `(v, r, s)` from the public March transaction and call the public function. The unknown June sender therefore needed neither the borrower's private key nor access to the operator. The boarding pass and the absence of key compromise are consistent with the on-chain evidence. The signature is authentic; the contract interpreted its scope too broadly.
+
+This is an authorization-replay vulnerability, not evidence that the borrower authorized a second loan. We should tell the user that their one-time authorization was accepted twice because of a protocol defect, and treat the June debt and any resulting interest, fees, or liquidation effects as unauthorized under the intended product semantics.
+
+## Other exposure
+
+- The same signature can be submitted again, without limit, whenever the position has enough borrowing capacity. An attacker can also race the intended first submission or repeatedly use it after later repayments/collateral deposits.
+- A signature that is never submitted promptly remains valid indefinitely. A relayer, mempool observer, compromised database, or any later holder can execute it when prices, rates, collateral, or the user's circumstances are less favorable.
+- The signed data does not constrain mutable execution terms. If `_borrow` depends on an interest-rate model, fees, oracle prices, collateral selection, proceeds recipient, slippage-like limits, or another market choice not already fixed by this verifying contract and `borrower`, the signer did not approve bounds for those values.
+- Raw `ecrecover` does not reject high-`s` malleable signatures or invalid `v` values as robustly as a maintained signature library. A valid ECDSA signature may have an alternative byte representation with the same signer. This is not needed for the observed replay, but it means a future patch that marks only `keccak256(signatureBytes)` as used would still be bypassable. Consumption must be keyed by an authorization nonce/digest, not signature bytes.
+- The domain prevents ordinary replay into a different contract address or chain ID, but the separator is cached forever. If a chain fork changes `block.chainid`, this contract continues accepting signatures under the old domain; copies on both sides can share the same stored separator and signatures can be replayed across the fork. Deployments that reproduce both the chain ID and contract address have the same issue.
+- `ecrecover(...) == borrower` supports only EOAs. If contract-wallet borrowers are or may become supported, this scheme lacks ERC-1271 validation. Also reject `address(0)` explicitly: `ecrecover` returns zero for malformed signatures, so a zero borrower would otherwise satisfy the equality check if `_borrow` permits it.
+
+Permissionless submission is not itself a flaw if gasless borrowing is meant to work with any relayer. If only the operator should submit, `msg.sender` must also be authorized or included in the signed message—but that is a policy choice and is not a substitute for replay protection.
+
+## What to ship
+
+Immediately pause or disable the existing `borrowWithSig` entry point. Search all successful calls for repeated signed digests and remediate affected accounts. Do not leave the old path callable alongside a corrected overload: every already disclosed v1 signature would remain reusable through it.
+
+Replace it with a new authorization type and bump the EIP-712 domain version so existing v1 signatures cannot be interpreted as v2 authorizations:
+
+```solidity
+bytes32 constant BORROW_TYPEHASH = keccak256(
+    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+);
+
+mapping(address => uint256) public borrowNonces;
+
+function borrowWithSig(
+    address borrower,
+    uint256 amount,
+    uint256 nonce,
+    uint256 deadline,
+    bytes calldata signature
+) external {
+    require(borrower != address(0), "zero borrower");
+    require(block.timestamp <= deadline, "expired");
+    require(nonce == borrowNonces[borrower], "bad nonce");
+
+    bytes32 structHash = keccak256(
+        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+    );
+    bytes32 digest = _hashTypedDataV4(structHash);
+    require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");
+
+    // Consume before code that can make an external call. A revert rolls this back.
+    borrowNonces[borrower] = nonce + 1;
+    _borrow(borrower, amount);
+}
+```
+
+Use audited OpenZeppelin `EIP712` plus `SignatureChecker` (or `ECDSA.recover` if borrowers are guaranteed to be EOAs), rather than raw `ecrecover`. These enforce canonical EOA signatures; `SignatureChecker` additionally supports ERC-1271 wallets. OpenZeppelin's EIP-712 implementation also derives a separator appropriate to the current chain and contract, avoiding a permanently stale chain ID. Use checked nonce increment semantics and a sufficiently wide nonce (`uint256`).
+
+The nonce is the actual one-use control. A simple monotonically increasing per-borrower nonce is appropriate: the signed nonce must equal `borrowNonces[borrower]`, and it is incremented atomically before borrowing. The deadline limits how long an unused authorization remains dangerous. Expose a borrower-authorized `invalidateBorrowNonces(newNonce)`/cancellation path if users need to revoke outstanding signatures; require `newNonce > currentNonce`, and emit events for use and invalidation.
+
+The production type should also bind every user-controlled or economically material parameter used by `_borrow`. Depending on the implementation, that can include the asset or market ID, destination of proceeds, collateral/account identifier, maximum acceptable interest rate or fee, referral/delegation data, and any execution mode. Include a relayer only if product policy deliberately restricts who may submit. Keep `verifyingContract`, live `chainId`, a unique protocol name, and the bumped version in the domain.
+
+Finally, add tests that prove: the same authorization cannot succeed twice; repayment does not reset its nonce; expired, wrong-nonce, wrong-chain, wrong-contract, and altered-parameter signatures fail; cancellation works; high-`s`/bad-`v` signatures fail; reentrancy cannot reuse a nonce; and both EOA and ERC-1271 behavior match the supported account model.

2026-09-02T15:18:02.960664Z  WARN codex_core::tasks: failed to flush rollout after emitting terminal turn event: thread 01a062b0-5cf8-7c11-b14c-b0037dfaa60f not found
tokens used
10,112
````

## final message

Created [answer.md](/tmp/ethskills-audit-eval/2026-09-02T151519Z-codex-no-skill-1/audit-quiz-003/answer.md) with the incident explanation, additional vulnerabilities, exact remediation design, rollout precautions, and required tests.
