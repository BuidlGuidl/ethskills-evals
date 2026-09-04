# Executor transcript — 2026-09-04T155041Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-04T155041Z-codex-no-skill-1/audit-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-04T155041Z-codex-no-skill-1/audit-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06d26-1981-7631-bf06-03eb2d208c09
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
I’ll inspect the workspace guidance and then write a concrete incident explanation and remediation plan into `answer.md`.
exec
/bin/bash -lc "ls -la && find .. -name AGENTS.md -print && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' ." in /tmp/ethskills-audit-eval/2026-09-04T155041Z-codex-no-skill-1/audit-quiz-003
 exited 1 in 6ms:
codex
The core issue is confirmed: the signature authenticates the borrow parameters but contains no one-time-use or expiry state. I’m also covering mempool/calldata theft, repeated replay, signature malleability, smart-contract wallets, and the deployment/upgrade steps needed to invalidate every legacy authorization.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-04T155041Z-codex-no-skill-1/audit-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a16b3c3b3f5365662d7568e83c5b299bdeda8861
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,74 @@
+# Incident explanation and fix
+
+## What happened in June
+
+The June transaction did not require a compromised key or cooperation from the original relayer. The March signature is a permanent, publicly reusable authorization for exactly this tuple:
+
+```text
+(domain: ArbiLend v1 on this chain at this contract, borrower, 5,000 USDC)
+```
+
+It does not authorize “one borrow.” There is no nonce, authorization identifier, deadline, or on-chain record that makes it single-use. `ecrecover` therefore returns the borrower every time the same digest and signature are supplied. Repayment changes the loan balance, but it does not consume or revoke the signature. Once the March transaction was broadcast, its calldata—including `(v,r,s)`—was public forever. Any observer, indexer, RPC provider, block builder, or ordinary user could copy it and call the permissionless `borrowWithSig` function. The caller's address is not signed or checked, so the unknown address could validly replay it after repayment.
+
+The boarding pass and the relayer's account are consequently consistent with the on-chain evidence. The transaction proves that the borrower signed these fields at some earlier time; it proves neither when the signature was submitted nor who was allowed to submit it. This is an authorization-replay vulnerability, not evidence that the borrower initiated a new loan in June.
+
+## Other exposure
+
+- The authorization can be replayed any number of times. If `_borrow` permits another loan while debt is outstanding, an attacker can stack repeated 5,000 USDC borrows immediately; if it does not, the attacker can wait for each repayment and replay again.
+- Every existing signature made under this schema remains live indefinitely, including signatures that were never submitted, rejected because conditions were temporarily unsuitable, or observed in a public mempool. An attacker can front-run the intended relayer. A deadline alone would only shorten this window; it would not provide single-use semantics.
+- Because no relayer is bound into the signed data, restricting the intended operational relayer off-chain provides no security. If exclusive submission is desired, an authorized relayer must be signed and enforced (or callers must be allowlisted); this is separate from replay protection.
+- The domain prevents ordinary replay on a different chain ID or verifying contract, but not repeated use on this same deployment. A cached constructor domain can also have undesirable behavior if the chain ID later changes; a maintained EIP-712 implementation recomputes/caches it safely.
+- Raw `ecrecover` accepts non-canonical high-`s` signatures and legacy `v` forms. This permits a second byte representation of the same authorization and makes byte-based “used signature” tracking unsafe. It also cannot validate ERC-1271 smart-contract-wallet signatures. Neither issue caused this exact byte-identical replay, but both should be fixed rather than designing consumption around signature bytes.
+- If `borrower == address(0)`, failed `ecrecover` returns zero and the equality check passes. Whether exploitable depends on `_borrow`, but the entry point must reject the zero address.
+
+The domain does bind chain ID and contract address, which is good. The missing property is freshness and on-chain consumption.
+
+## What to ship
+
+Immediately pause or disable the legacy `borrowWithSig` entry point. Do not leave it callable alongside a fixed overload: all old signatures would remain replayable through the old selector. Review all historical successful and pending authorizations, alert affected borrowers, and investigate/restore the June position under the protocol's incident process.
+
+Deploy an upgraded authorization format under domain version `2`, with a borrower-scoped nonce and deadline included in the signed struct. The version change makes every v1 signature invalid at the new entry point. Use OpenZeppelin's maintained `EIP712`, `Nonces`, and `SignatureChecker` implementations (matching the repository's installed OpenZeppelin version), rather than raw `ecrecover`.
+
+The intended interface and logic are:
+
+```solidity
+bytes32 private constant BORROW_TYPEHASH = keccak256(
+    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+);
+
+// EIP712("ArbiLend", "2") and Nonces are inherited.
+function borrowWithSig(
+    address borrower,
+    uint256 amount,
+    uint256 nonce,
+    uint256 deadline,
+    bytes calldata signature
+) external nonReentrant {
+    if (borrower == address(0)) revert InvalidBorrower();
+    if (block.timestamp > deadline) revert SignatureExpired();
+
+    // _useCheckedNonce must require nonce == nonces(borrower), then increment.
+    // A later revert rolls the increment back atomically.
+    _useCheckedNonce(borrower, nonce);
+
+    bytes32 structHash = keccak256(
+        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+    );
+    bytes32 digest = _hashTypedDataV4(structHash);
+    if (!SignatureChecker.isValidSignatureNow(borrower, digest, signature)) {
+        revert InvalidSignature();
+    }
+
+    _borrow(borrower, amount);
+}
+```
+
+For an EOA, the signed message is usable only while `nonce == nonces[borrower]`; the first successful execution increments it, so a second execution reverts. `deadline` limits exposure of an unsubmitted signature. `SignatureChecker` enforces canonical ECDSA behavior and supports ERC-1271 wallets. `nonReentrant` is defense in depth around validation and `_borrow`; preserve checks-effects-interactions within `_borrow` as well.
+
+Expose a borrower-only cancellation/invalidation function so a user can advance their nonce without borrowing. If users may prepare multiple concurrent authorizations, use an explicit random/sequential authorization ID with a `used[borrower][id]` mapping instead of a strictly sequential nonce, and mark it used before `_borrow`; never key replay protection by `(v,r,s)` or signature bytes. If the proceeds destination, asset/market, rate/slippage limit, collateral account, or authorized relayer can vary or matter to consent, include each of those values in the signed struct and enforce them. `amount` without an asset identifier is safe only if this verifying contract can represent exactly one immutable asset/market.
+
+Finally, update the client to fetch the current nonce, choose a short explicit deadline, display all economically relevant fields, and sign the v2 typed data. Add tests for first use, identical replay, malleated-signature replay, expired signatures, wrong nonce, nonce cancellation, wrong chain/domain/contract, zero borrower, front-running by an arbitrary caller, and ERC-1271 validation. The arbitrary-caller test should succeed once if gasless public relay is intended and fail on the second use; if only a designated relayer is intended, include and enforce that signed field instead.
+
+## What to tell the user
+
+Their account is technically credible: the March authorization was accidentally implemented as reusable and had no expiry. Repaying the March loan did not cancel it. A third party copied the signature from public blockchain data and the contract accepted it again in June; no new signature, key compromise, presence, or action by the original relayer was necessary. This is a protocol authorization flaw, and the protocol should treat the June debt as an incident rather than as proof that the user requested a second loan.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a16b3c3b3f5365662d7568e83c5b299bdeda8861
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,74 @@
+# Incident explanation and fix
+
+## What happened in June
+
+The June transaction did not require a compromised key or cooperation from the original relayer. The March signature is a permanent, publicly reusable authorization for exactly this tuple:
+
+```text
+(domain: ArbiLend v1 on this chain at this contract, borrower, 5,000 USDC)
+```
+
+It does not authorize “one borrow.” There is no nonce, authorization identifier, deadline, or on-chain record that makes it single-use. `ecrecover` therefore returns the borrower every time the same digest and signature are supplied. Repayment changes the loan balance, but it does not consume or revoke the signature. Once the March transaction was broadcast, its calldata—including `(v,r,s)`—was public forever. Any observer, indexer, RPC provider, block builder, or ordinary user could copy it and call the permissionless `borrowWithSig` function. The caller's address is not signed or checked, so the unknown address could validly replay it after repayment.
+
+The boarding pass and the relayer's account are consequently consistent with the on-chain evidence. The transaction proves that the borrower signed these fields at some earlier time; it proves neither when the signature was submitted nor who was allowed to submit it. This is an authorization-replay vulnerability, not evidence that the borrower initiated a new loan in June.
+
+## Other exposure
+
+- The authorization can be replayed any number of times. If `_borrow` permits another loan while debt is outstanding, an attacker can stack repeated 5,000 USDC borrows immediately; if it does not, the attacker can wait for each repayment and replay again.
+- Every existing signature made under this schema remains live indefinitely, including signatures that were never submitted, rejected because conditions were temporarily unsuitable, or observed in a public mempool. An attacker can front-run the intended relayer. A deadline alone would only shorten this window; it would not provide single-use semantics.
+- Because no relayer is bound into the signed data, restricting the intended operational relayer off-chain provides no security. If exclusive submission is desired, an authorized relayer must be signed and enforced (or callers must be allowlisted); this is separate from replay protection.
+- The domain prevents ordinary replay on a different chain ID or verifying contract, but not repeated use on this same deployment. A cached constructor domain can also have undesirable behavior if the chain ID later changes; a maintained EIP-712 implementation recomputes/caches it safely.
+- Raw `ecrecover` accepts non-canonical high-`s` signatures and legacy `v` forms. This permits a second byte representation of the same authorization and makes byte-based “used signature” tracking unsafe. It also cannot validate ERC-1271 smart-contract-wallet signatures. Neither issue caused this exact byte-identical replay, but both should be fixed rather than designing consumption around signature bytes.
+- If `borrower == address(0)`, failed `ecrecover` returns zero and the equality check passes. Whether exploitable depends on `_borrow`, but the entry point must reject the zero address.
+
+The domain does bind chain ID and contract address, which is good. The missing property is freshness and on-chain consumption.
+
+## What to ship
+
+Immediately pause or disable the legacy `borrowWithSig` entry point. Do not leave it callable alongside a fixed overload: all old signatures would remain replayable through the old selector. Review all historical successful and pending authorizations, alert affected borrowers, and investigate/restore the June position under the protocol's incident process.
+
+Deploy an upgraded authorization format under domain version `2`, with a borrower-scoped nonce and deadline included in the signed struct. The version change makes every v1 signature invalid at the new entry point. Use OpenZeppelin's maintained `EIP712`, `Nonces`, and `SignatureChecker` implementations (matching the repository's installed OpenZeppelin version), rather than raw `ecrecover`.
+
+The intended interface and logic are:
+
+```solidity
+bytes32 private constant BORROW_TYPEHASH = keccak256(
+    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+);
+
+// EIP712("ArbiLend", "2") and Nonces are inherited.
+function borrowWithSig(
+    address borrower,
+    uint256 amount,
+    uint256 nonce,
+    uint256 deadline,
+    bytes calldata signature
+) external nonReentrant {
+    if (borrower == address(0)) revert InvalidBorrower();
+    if (block.timestamp > deadline) revert SignatureExpired();
+
+    // _useCheckedNonce must require nonce == nonces(borrower), then increment.
+    // A later revert rolls the increment back atomically.
+    _useCheckedNonce(borrower, nonce);
+
+    bytes32 structHash = keccak256(
+        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+    );
+    bytes32 digest = _hashTypedDataV4(structHash);
+    if (!SignatureChecker.isValidSignatureNow(borrower, digest, signature)) {
+        revert InvalidSignature();
+    }
+
+    _borrow(borrower, amount);
+}
+```
+
+For an EOA, the signed message is usable only while `nonce == nonces[borrower]`; the first successful execution increments it, so a second execution reverts. `deadline` limits exposure of an unsubmitted signature. `SignatureChecker` enforces canonical ECDSA behavior and supports ERC-1271 wallets. `nonReentrant` is defense in depth around validation and `_borrow`; preserve checks-effects-interactions within `_borrow` as well.
+
+Expose a borrower-only cancellation/invalidation function so a user can advance their nonce without borrowing. If users may prepare multiple concurrent authorizations, use an explicit random/sequential authorization ID with a `used[borrower][id]` mapping instead of a strictly sequential nonce, and mark it used before `_borrow`; never key replay protection by `(v,r,s)` or signature bytes. If the proceeds destination, asset/market, rate/slippage limit, collateral account, or authorized relayer can vary or matter to consent, include each of those values in the signed struct and enforce them. `amount` without an asset identifier is safe only if this verifying contract can represent exactly one immutable asset/market.
+
+Finally, update the client to fetch the current nonce, choose a short explicit deadline, display all economically relevant fields, and sign the v2 typed data. Add tests for first use, identical replay, malleated-signature replay, expired signatures, wrong nonce, nonce cancellation, wrong chain/domain/contract, zero borrower, front-running by an arbitrary caller, and ERC-1271 validation. The arbitrary-caller test should succeed once if gasless public relay is intended and fail on the second use; if only a designated relayer is intended, include and enforce that signed field instead.
+
+## What to tell the user
+
+Their account is technically credible: the March authorization was accidentally implemented as reusable and had no expiry. Repaying the March loan did not cancel it. A third party copied the signature from public blockchain data and the contract accepted it again in June; no new signature, key compromise, presence, or action by the original relayer was necessary. This is a protocol authorization flaw, and the protocol should treat the June debt as an incident rather than as proof that the user requested a second loan.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git diff --check && git status --short" in /tmp/ethskills-audit-eval/2026-09-04T155041Z-codex-no-skill-1/audit-quiz-003
 succeeded in 7ms:
# Incident explanation and fix

## What happened in June

The June transaction did not require a compromised key or cooperation from the original relayer. The March signature is a permanent, publicly reusable authorization for exactly this tuple:

```text
(domain: ArbiLend v1 on this chain at this contract, borrower, 5,000 USDC)
```

It does not authorize “one borrow.” There is no nonce, authorization identifier, deadline, or on-chain record that makes it single-use. `ecrecover` therefore returns the borrower every time the same digest and signature are supplied. Repayment changes the loan balance, but it does not consume or revoke the signature. Once the March transaction was broadcast, its calldata—including `(v,r,s)`—was public forever. Any observer, indexer, RPC provider, block builder, or ordinary user could copy it and call the permissionless `borrowWithSig` function. The caller's address is not signed or checked, so the unknown address could validly replay it after repayment.

The boarding pass and the relayer's account are consequently consistent with the on-chain evidence. The transaction proves that the borrower signed these fields at some earlier time; it proves neither when the signature was submitted nor who was allowed to submit it. This is an authorization-replay vulnerability, not evidence that the borrower initiated a new loan in June.

## Other exposure

- The authorization can be replayed any number of times. If `_borrow` permits another loan while debt is outstanding, an attacker can stack repeated 5,000 USDC borrows immediately; if it does not, the attacker can wait for each repayment and replay again.
- Every existing signature made under this schema remains live indefinitely, including signatures that were never submitted, rejected because conditions were temporarily unsuitable, or observed in a public mempool. An attacker can front-run the intended relayer. A deadline alone would only shorten this window; it would not provide single-use semantics.
- Because no relayer is bound into the signed data, restricting the intended operational relayer off-chain provides no security. If exclusive submission is desired, an authorized relayer must be signed and enforced (or callers must be allowlisted); this is separate from replay protection.
- The domain prevents ordinary replay on a different chain ID or verifying contract, but not repeated use on this same deployment. A cached constructor domain can also have undesirable behavior if the chain ID later changes; a maintained EIP-712 implementation recomputes/caches it safely.
- Raw `ecrecover` accepts non-canonical high-`s` signatures and legacy `v` forms. This permits a second byte representation of the same authorization and makes byte-based “used signature” tracking unsafe. It also cannot validate ERC-1271 smart-contract-wallet signatures. Neither issue caused this exact byte-identical replay, but both should be fixed rather than designing consumption around signature bytes.
- If `borrower == address(0)`, failed `ecrecover` returns zero and the equality check passes. Whether exploitable depends on `_borrow`, but the entry point must reject the zero address.

The domain does bind chain ID and contract address, which is good. The missing property is freshness and on-chain consumption.

## What to ship

Immediately pause or disable the legacy `borrowWithSig` entry point. Do not leave it callable alongside a fixed overload: all old signatures would remain replayable through the old selector. Review all historical successful and pending authorizations, alert affected borrowers, and investigate/restore the June position under the protocol's incident process.

Deploy an upgraded authorization format under domain version `2`, with a borrower-scoped nonce and deadline included in the signed struct. The version change makes every v1 signature invalid at the new entry point. Use OpenZeppelin's maintained `EIP712`, `Nonces`, and `SignatureChecker` implementations (matching the repository's installed OpenZeppelin version), rather than raw `ecrecover`.

The intended interface and logic are:

```solidity
bytes32 private constant BORROW_TYPEHASH = keccak256(
    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
);

// EIP712("ArbiLend", "2") and Nonces are inherited.
function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 nonce,
    uint256 deadline,
    bytes calldata signature
) external nonReentrant {
    if (borrower == address(0)) revert InvalidBorrower();
    if (block.timestamp > deadline) revert SignatureExpired();

    // _useCheckedNonce must require nonce == nonces(borrower), then increment.
    // A later revert rolls the increment back atomically.
    _useCheckedNonce(borrower, nonce);

    bytes32 structHash = keccak256(
        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    if (!SignatureChecker.isValidSignatureNow(borrower, digest, signature)) {
        revert InvalidSignature();
    }

    _borrow(borrower, amount);
}
```

For an EOA, the signed message is usable only while `nonce == nonces[borrower]`; the first successful execution increments it, so a second execution reverts. `deadline` limits exposure of an unsubmitted signature. `SignatureChecker` enforces canonical ECDSA behavior and supports ERC-1271 wallets. `nonReentrant` is defense in depth around validation and `_borrow`; preserve checks-effects-interactions within `_borrow` as well.

Expose a borrower-only cancellation/invalidation function so a user can advance their nonce without borrowing. If users may prepare multiple concurrent authorizations, use an explicit random/sequential authorization ID with a `used[borrower][id]` mapping instead of a strictly sequential nonce, and mark it used before `_borrow`; never key replay protection by `(v,r,s)` or signature bytes. If the proceeds destination, asset/market, rate/slippage limit, collateral account, or authorized relayer can vary or matter to consent, include each of those values in the signed struct and enforce them. `amount` without an asset identifier is safe only if this verifying contract can represent exactly one immutable asset/market.

Finally, update the client to fetch the current nonce, choose a short explicit deadline, display all economically relevant fields, and sign the v2 typed data. Add tests for first use, identical replay, malleated-signature replay, expired signatures, wrong nonce, nonce cancellation, wrong chain/domain/contract, zero borrower, front-running by an arbitrary caller, and ERC-1271 validation. The arbitrary-caller test should succeed once if gasless public relay is intended and fail on the second use; if only a designated relayer is intended, include and enforce that signed field instead.

## What to tell the user

Their account is technically credible: the March authorization was accidentally implemented as reusable and had no expiry. Repaying the March loan did not cancel it. A third party copied the signature from public blockchain data and the contract accepted it again in June; no new signature, key compromise, presence, or action by the original relayer was necessary. This is a protocol authorization flaw, and the protocol should treat the June debt as an incident rather than as proof that the user requested a second loan.
?? answer.md

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a16b3c3b3f5365662d7568e83c5b299bdeda8861
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,74 @@
+# Incident explanation and fix
+
+## What happened in June
+
+The June transaction did not require a compromised key or cooperation from the original relayer. The March signature is a permanent, publicly reusable authorization for exactly this tuple:
+
+```text
+(domain: ArbiLend v1 on this chain at this contract, borrower, 5,000 USDC)
+```
+
+It does not authorize “one borrow.” There is no nonce, authorization identifier, deadline, or on-chain record that makes it single-use. `ecrecover` therefore returns the borrower every time the same digest and signature are supplied. Repayment changes the loan balance, but it does not consume or revoke the signature. Once the March transaction was broadcast, its calldata—including `(v,r,s)`—was public forever. Any observer, indexer, RPC provider, block builder, or ordinary user could copy it and call the permissionless `borrowWithSig` function. The caller's address is not signed or checked, so the unknown address could validly replay it after repayment.
+
+The boarding pass and the relayer's account are consequently consistent with the on-chain evidence. The transaction proves that the borrower signed these fields at some earlier time; it proves neither when the signature was submitted nor who was allowed to submit it. This is an authorization-replay vulnerability, not evidence that the borrower initiated a new loan in June.
+
+## Other exposure
+
+- The authorization can be replayed any number of times. If `_borrow` permits another loan while debt is outstanding, an attacker can stack repeated 5,000 USDC borrows immediately; if it does not, the attacker can wait for each repayment and replay again.
+- Every existing signature made under this schema remains live indefinitely, including signatures that were never submitted, rejected because conditions were temporarily unsuitable, or observed in a public mempool. An attacker can front-run the intended relayer. A deadline alone would only shorten this window; it would not provide single-use semantics.
+- Because no relayer is bound into the signed data, restricting the intended operational relayer off-chain provides no security. If exclusive submission is desired, an authorized relayer must be signed and enforced (or callers must be allowlisted); this is separate from replay protection.
+- The domain prevents ordinary replay on a different chain ID or verifying contract, but not repeated use on this same deployment. A cached constructor domain can also have undesirable behavior if the chain ID later changes; a maintained EIP-712 implementation recomputes/caches it safely.
+- Raw `ecrecover` accepts non-canonical high-`s` signatures and legacy `v` forms. This permits a second byte representation of the same authorization and makes byte-based “used signature” tracking unsafe. It also cannot validate ERC-1271 smart-contract-wallet signatures. Neither issue caused this exact byte-identical replay, but both should be fixed rather than designing consumption around signature bytes.
+- If `borrower == address(0)`, failed `ecrecover` returns zero and the equality check passes. Whether exploitable depends on `_borrow`, but the entry point must reject the zero address.
+
+The domain does bind chain ID and contract address, which is good. The missing property is freshness and on-chain consumption.
+
+## What to ship
+
+Immediately pause or disable the legacy `borrowWithSig` entry point. Do not leave it callable alongside a fixed overload: all old signatures would remain replayable through the old selector. Review all historical successful and pending authorizations, alert affected borrowers, and investigate/restore the June position under the protocol's incident process.
+
+Deploy an upgraded authorization format under domain version `2`, with a borrower-scoped nonce and deadline included in the signed struct. The version change makes every v1 signature invalid at the new entry point. Use OpenZeppelin's maintained `EIP712`, `Nonces`, and `SignatureChecker` implementations (matching the repository's installed OpenZeppelin version), rather than raw `ecrecover`.
+
+The intended interface and logic are:
+
+```solidity
+bytes32 private constant BORROW_TYPEHASH = keccak256(
+    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+);
+
+// EIP712("ArbiLend", "2") and Nonces are inherited.
+function borrowWithSig(
+    address borrower,
+    uint256 amount,
+    uint256 nonce,
+    uint256 deadline,
+    bytes calldata signature
+) external nonReentrant {
+    if (borrower == address(0)) revert InvalidBorrower();
+    if (block.timestamp > deadline) revert SignatureExpired();
+
+    // _useCheckedNonce must require nonce == nonces(borrower), then increment.
+    // A later revert rolls the increment back atomically.
+    _useCheckedNonce(borrower, nonce);
+
+    bytes32 structHash = keccak256(
+        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+    );
+    bytes32 digest = _hashTypedDataV4(structHash);
+    if (!SignatureChecker.isValidSignatureNow(borrower, digest, signature)) {
+        revert InvalidSignature();
+    }
+
+    _borrow(borrower, amount);
+}
+```
+
+For an EOA, the signed message is usable only while `nonce == nonces[borrower]`; the first successful execution increments it, so a second execution reverts. `deadline` limits exposure of an unsubmitted signature. `SignatureChecker` enforces canonical ECDSA behavior and supports ERC-1271 wallets. `nonReentrant` is defense in depth around validation and `_borrow`; preserve checks-effects-interactions within `_borrow` as well.
+
+Expose a borrower-only cancellation/invalidation function so a user can advance their nonce without borrowing. If users may prepare multiple concurrent authorizations, use an explicit random/sequential authorization ID with a `used[borrower][id]` mapping instead of a strictly sequential nonce, and mark it used before `_borrow`; never key replay protection by `(v,r,s)` or signature bytes. If the proceeds destination, asset/market, rate/slippage limit, collateral account, or authorized relayer can vary or matter to consent, include each of those values in the signed struct and enforce them. `amount` without an asset identifier is safe only if this verifying contract can represent exactly one immutable asset/market.
+
+Finally, update the client to fetch the current nonce, choose a short explicit deadline, display all economically relevant fields, and sign the v2 typed data. Add tests for first use, identical replay, malleated-signature replay, expired signatures, wrong nonce, nonce cancellation, wrong chain/domain/contract, zero borrower, front-running by an arbitrary caller, and ERC-1271 validation. The arbitrary-caller test should succeed once if gasless public relay is intended and fail on the second use; if only a designated relayer is intended, include and enforce that signed field instead.
+
+## What to tell the user
+
+Their account is technically credible: the March authorization was accidentally implemented as reusable and had no expiry. Repaying the March loan did not cancel it. A third party copied the signature from public blockchain data and the contract accepted it again in June; no new signature, key compromise, presence, or action by the original relayer was necessary. This is a protocol authorization flaw, and the protocol should treat the June debt as an incident rather than as proof that the user requested a second loan.

codex
Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155041Z-codex-no-skill-1/audit-quiz-003/answer.md) with the replay-vulnerability explanation, additional exposures, exact remediation design, deployment precautions, tests, and suggested user response. `git diff --check` passes.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a16b3c3b3f5365662d7568e83c5b299bdeda8861
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,74 @@
+# Incident explanation and fix
+
+## What happened in June
+
+The June transaction did not require a compromised key or cooperation from the original relayer. The March signature is a permanent, publicly reusable authorization for exactly this tuple:
+
+```text
+(domain: ArbiLend v1 on this chain at this contract, borrower, 5,000 USDC)
+```
+
+It does not authorize “one borrow.” There is no nonce, authorization identifier, deadline, or on-chain record that makes it single-use. `ecrecover` therefore returns the borrower every time the same digest and signature are supplied. Repayment changes the loan balance, but it does not consume or revoke the signature. Once the March transaction was broadcast, its calldata—including `(v,r,s)`—was public forever. Any observer, indexer, RPC provider, block builder, or ordinary user could copy it and call the permissionless `borrowWithSig` function. The caller's address is not signed or checked, so the unknown address could validly replay it after repayment.
+
+The boarding pass and the relayer's account are consequently consistent with the on-chain evidence. The transaction proves that the borrower signed these fields at some earlier time; it proves neither when the signature was submitted nor who was allowed to submit it. This is an authorization-replay vulnerability, not evidence that the borrower initiated a new loan in June.
+
+## Other exposure
+
+- The authorization can be replayed any number of times. If `_borrow` permits another loan while debt is outstanding, an attacker can stack repeated 5,000 USDC borrows immediately; if it does not, the attacker can wait for each repayment and replay again.
+- Every existing signature made under this schema remains live indefinitely, including signatures that were never submitted, rejected because conditions were temporarily unsuitable, or observed in a public mempool. An attacker can front-run the intended relayer. A deadline alone would only shorten this window; it would not provide single-use semantics.
+- Because no relayer is bound into the signed data, restricting the intended operational relayer off-chain provides no security. If exclusive submission is desired, an authorized relayer must be signed and enforced (or callers must be allowlisted); this is separate from replay protection.
+- The domain prevents ordinary replay on a different chain ID or verifying contract, but not repeated use on this same deployment. A cached constructor domain can also have undesirable behavior if the chain ID later changes; a maintained EIP-712 implementation recomputes/caches it safely.
+- Raw `ecrecover` accepts non-canonical high-`s` signatures and legacy `v` forms. This permits a second byte representation of the same authorization and makes byte-based “used signature” tracking unsafe. It also cannot validate ERC-1271 smart-contract-wallet signatures. Neither issue caused this exact byte-identical replay, but both should be fixed rather than designing consumption around signature bytes.
+- If `borrower == address(0)`, failed `ecrecover` returns zero and the equality check passes. Whether exploitable depends on `_borrow`, but the entry point must reject the zero address.
+
+The domain does bind chain ID and contract address, which is good. The missing property is freshness and on-chain consumption.
+
+## What to ship
+
+Immediately pause or disable the legacy `borrowWithSig` entry point. Do not leave it callable alongside a fixed overload: all old signatures would remain replayable through the old selector. Review all historical successful and pending authorizations, alert affected borrowers, and investigate/restore the June position under the protocol's incident process.
+
+Deploy an upgraded authorization format under domain version `2`, with a borrower-scoped nonce and deadline included in the signed struct. The version change makes every v1 signature invalid at the new entry point. Use OpenZeppelin's maintained `EIP712`, `Nonces`, and `SignatureChecker` implementations (matching the repository's installed OpenZeppelin version), rather than raw `ecrecover`.
+
+The intended interface and logic are:
+
+```solidity
+bytes32 private constant BORROW_TYPEHASH = keccak256(
+    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
+);
+
+// EIP712("ArbiLend", "2") and Nonces are inherited.
+function borrowWithSig(
+    address borrower,
+    uint256 amount,
+    uint256 nonce,
+    uint256 deadline,
+    bytes calldata signature
+) external nonReentrant {
+    if (borrower == address(0)) revert InvalidBorrower();
+    if (block.timestamp > deadline) revert SignatureExpired();
+
+    // _useCheckedNonce must require nonce == nonces(borrower), then increment.
+    // A later revert rolls the increment back atomically.
+    _useCheckedNonce(borrower, nonce);
+
+    bytes32 structHash = keccak256(
+        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
+    );
+    bytes32 digest = _hashTypedDataV4(structHash);
+    if (!SignatureChecker.isValidSignatureNow(borrower, digest, signature)) {
+        revert InvalidSignature();
+    }
+
+    _borrow(borrower, amount);
+}
+```
+
+For an EOA, the signed message is usable only while `nonce == nonces[borrower]`; the first successful execution increments it, so a second execution reverts. `deadline` limits exposure of an unsubmitted signature. `SignatureChecker` enforces canonical ECDSA behavior and supports ERC-1271 wallets. `nonReentrant` is defense in depth around validation and `_borrow`; preserve checks-effects-interactions within `_borrow` as well.
+
+Expose a borrower-only cancellation/invalidation function so a user can advance their nonce without borrowing. If users may prepare multiple concurrent authorizations, use an explicit random/sequential authorization ID with a `used[borrower][id]` mapping instead of a strictly sequential nonce, and mark it used before `_borrow`; never key replay protection by `(v,r,s)` or signature bytes. If the proceeds destination, asset/market, rate/slippage limit, collateral account, or authorized relayer can vary or matter to consent, include each of those values in the signed struct and enforce them. `amount` without an asset identifier is safe only if this verifying contract can represent exactly one immutable asset/market.
+
+Finally, update the client to fetch the current nonce, choose a short explicit deadline, display all economically relevant fields, and sign the v2 typed data. Add tests for first use, identical replay, malleated-signature replay, expired signatures, wrong nonce, nonce cancellation, wrong chain/domain/contract, zero borrower, front-running by an arbitrary caller, and ERC-1271 validation. The arbitrary-caller test should succeed once if gasless public relay is intended and fail on the second use; if only a designated relayer is intended, include and enforce that signed field instead.
+
+## What to tell the user
+
+Their account is technically credible: the March authorization was accidentally implemented as reusable and had no expiry. Repaying the March loan did not cancel it. A third party copied the signature from public blockchain data and the contract accepted it again in June; no new signature, key compromise, presence, or action by the original relayer was necessary. This is a protocol authorization flaw, and the protocol should treat the June debt as an incident rather than as proof that the user requested a second loan.

tokens used
10,802
````

## final message

Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155041Z-codex-no-skill-1/audit-quiz-003/answer.md) with the replay-vulnerability explanation, additional exposures, exact remediation design, deployment precautions, tests, and suggested user response. `git diff --check` passes.
