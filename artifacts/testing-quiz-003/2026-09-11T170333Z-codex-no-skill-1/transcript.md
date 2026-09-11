# Executor transcript — 2026-09-11T170333Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-1/testing-quiz-003

## session

````text
2026-09-11T17:17:07.052734Z  WARN codex_app_server::skills_watcher: failed to initialize skills file watcher: No file descriptors available (os error 24)
2026-09-11T17:17:07.053132Z  WARN codex_app_server::fs_watch: filesystem watch manager falling back to noop core watcher: No file descriptors available (os error 24)
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-1/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 01a09179-174d-7903-b775-7097b6fb604a
--------
user
Our vault routes deposits into Aave V3. The suite runs against a MockERC20 for the
underlying and a MockAavePool for the pool — 39 tests, all green, and they have been
green since the first commit.

We deployed to mainnet with USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) as the
underlying. Every deposit reverts on-chain. The revert carries no reason string. The
relevant lines are:

    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.approve(address(aavePool), amount);
    aavePool.supply(address(usdt), amount, address(this), 0);

where `usdt` is declared as an OpenZeppelin `IERC20` and the contract does
`using SafeERC20 for IERC20`. Our MockERC20 is a stock OpenZeppelin ERC20 with
6 decimals.

Note the first line uses the token and succeeds; the failure is further down.

Explain why this reverts against the real deployed USDT but never against the mock,
why the SafeERC20 usage did not protect the failing line, and why no amount of extra
mock-based tests would have surfaced it. Then give both fixes: the code change, and
the change in testing practice that would have caught this before mainnet.

Write your answer to answer.md in this directory.

codex
I’ll inspect the repository instructions and then write a focused root-cause analysis and both fixes into `answer.md`.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!lib'"' | head -20" in /tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-1/testing-quiz-003
 succeeded in 12ms:
/tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-1/testing-quiz-003

apply patch
patch: completed
/tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-1/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..bad802d7e05017b32e45a6ae8a930bba38da4dad
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Root cause
+
+Mainnet USDT is not fully ERC-20 ABI-compliant. In particular, its `approve(address,uint256)` function does not return a `bool`. Calling it through OpenZeppelin's `IERC20` interface makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the high-level call fails while decoding the empty return data. That is why the transaction reverts without a reason before `aavePool.supply` can complete.
+
+The preceding transfer succeeds because it is actually wrapped:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and accepts either no return data or a decoded `true`, specifically accommodating tokens such as USDT. By contrast:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+is a direct `IERC20.approve` call. `using SafeERC20 for IERC20` only makes the library's explicitly named methods available; it does not intercept or change ordinary `approve` calls. Consequently, `SafeERC20` protected `safeTransferFrom` but never participated in the failing call.
+
+The OpenZeppelin mock always returns the standard `bool` from `approve`, so it cannot reproduce this behavior. More tests against that same implementation would only explore more inputs against the same compliant semantics; they could not reveal an incompatibility that the mock does not model. Matching USDT's six decimals does not make the mock behaviorally equivalent to USDT.
+
+# Code fix
+
+Use the SafeERC20 allowance helper as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and also handles USDT-style allowance rules by retrying via an allowance of zero when a direct allowance update fails. It is therefore preferable to a raw `approve` and more robust than merely wrapping approval with an optional-return call. The project should use an OpenZeppelin version that provides `SafeERC20.forceApprove`; on older versions, implement the equivalent safe zero-then-set sequence with SafeERC20 helpers or upgrade OpenZeppelin.
+
+# Testing-practice fix
+
+Add mainnet-fork integration tests using the actual deployed USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool, at a pinned block. Fund or impersonate a real USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but supplement them with fork tests for every production token and external protocol integration.
+
+For focused unit coverage, also include adversarial token doubles that model common non-standard ERC-20 behavior—especially no return value and zero-first approval—but those doubles complement rather than replace a fork test against the exact deployed contracts. The fork test would have exercised USDT's real return-data behavior and failed before deployment.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..bad802d7e05017b32e45a6ae8a930bba38da4dad
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Root cause
+
+Mainnet USDT is not fully ERC-20 ABI-compliant. In particular, its `approve(address,uint256)` function does not return a `bool`. Calling it through OpenZeppelin's `IERC20` interface makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the high-level call fails while decoding the empty return data. That is why the transaction reverts without a reason before `aavePool.supply` can complete.
+
+The preceding transfer succeeds because it is actually wrapped:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and accepts either no return data or a decoded `true`, specifically accommodating tokens such as USDT. By contrast:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+is a direct `IERC20.approve` call. `using SafeERC20 for IERC20` only makes the library's explicitly named methods available; it does not intercept or change ordinary `approve` calls. Consequently, `SafeERC20` protected `safeTransferFrom` but never participated in the failing call.
+
+The OpenZeppelin mock always returns the standard `bool` from `approve`, so it cannot reproduce this behavior. More tests against that same implementation would only explore more inputs against the same compliant semantics; they could not reveal an incompatibility that the mock does not model. Matching USDT's six decimals does not make the mock behaviorally equivalent to USDT.
+
+# Code fix
+
+Use the SafeERC20 allowance helper as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and also handles USDT-style allowance rules by retrying via an allowance of zero when a direct allowance update fails. It is therefore preferable to a raw `approve` and more robust than merely wrapping approval with an optional-return call. The project should use an OpenZeppelin version that provides `SafeERC20.forceApprove`; on older versions, implement the equivalent safe zero-then-set sequence with SafeERC20 helpers or upgrade OpenZeppelin.
+
+# Testing-practice fix
+
+Add mainnet-fork integration tests using the actual deployed USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool, at a pinned block. Fund or impersonate a real USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but supplement them with fork tests for every production token and external protocol integration.
+
+For focused unit coverage, also include adversarial token doubles that model common non-standard ERC-20 behavior—especially no return value and zero-first approval—but those doubles complement rather than replace a fork test against the exact deployed contracts. The fork test would have exercised USDT's real return-data behavior and failed before deployment.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-1/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Root cause

Mainnet USDT is not fully ERC-20 ABI-compliant. In particular, its `approve(address,uint256)` function does not return a `bool`. Calling it through OpenZeppelin's `IERC20` interface makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the high-level call fails while decoding the empty return data. That is why the transaction reverts without a reason before `aavePool.supply` can complete.

The preceding transfer succeeds because it is actually wrapped:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` performs a low-level call and accepts either no return data or a decoded `true`, specifically accommodating tokens such as USDT. By contrast:

```solidity
usdt.approve(address(aavePool), amount);
```

is a direct `IERC20.approve` call. `using SafeERC20 for IERC20` only makes the library's explicitly named methods available; it does not intercept or change ordinary `approve` calls. Consequently, `SafeERC20` protected `safeTransferFrom` but never participated in the failing call.

The OpenZeppelin mock always returns the standard `bool` from `approve`, so it cannot reproduce this behavior. More tests against that same implementation would only explore more inputs against the same compliant semantics; they could not reveal an incompatibility that the mock does not model. Matching USDT's six decimals does not make the mock behaviorally equivalent to USDT.

# Code fix

Use the SafeERC20 allowance helper as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` accepts tokens that return no value and also handles USDT-style allowance rules by retrying via an allowance of zero when a direct allowance update fails. It is therefore preferable to a raw `approve` and more robust than merely wrapping approval with an optional-return call. The project should use an OpenZeppelin version that provides `SafeERC20.forceApprove`; on older versions, implement the equivalent safe zero-then-set sequence with SafeERC20 helpers or upgrade OpenZeppelin.

# Testing-practice fix

Add mainnet-fork integration tests using the actual deployed USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool, at a pinned block. Fund or impersonate a real USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but supplement them with fork tests for every production token and external protocol integration.

For focused unit coverage, also include adversarial token doubles that model common non-standard ERC-20 behavior—especially no return value and zero-first approval—but those doubles complement rather than replace a fork test against the exact deployed contracts. The fork test would have exercised USDT's real return-data behavior and failed before deployment.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..bad802d7e05017b32e45a6ae8a930bba38da4dad
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Root cause
+
+Mainnet USDT is not fully ERC-20 ABI-compliant. In particular, its `approve(address,uint256)` function does not return a `bool`. Calling it through OpenZeppelin's `IERC20` interface makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the high-level call fails while decoding the empty return data. That is why the transaction reverts without a reason before `aavePool.supply` can complete.
+
+The preceding transfer succeeds because it is actually wrapped:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and accepts either no return data or a decoded `true`, specifically accommodating tokens such as USDT. By contrast:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+is a direct `IERC20.approve` call. `using SafeERC20 for IERC20` only makes the library's explicitly named methods available; it does not intercept or change ordinary `approve` calls. Consequently, `SafeERC20` protected `safeTransferFrom` but never participated in the failing call.
+
+The OpenZeppelin mock always returns the standard `bool` from `approve`, so it cannot reproduce this behavior. More tests against that same implementation would only explore more inputs against the same compliant semantics; they could not reveal an incompatibility that the mock does not model. Matching USDT's six decimals does not make the mock behaviorally equivalent to USDT.
+
+# Code fix
+
+Use the SafeERC20 allowance helper as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and also handles USDT-style allowance rules by retrying via an allowance of zero when a direct allowance update fails. It is therefore preferable to a raw `approve` and more robust than merely wrapping approval with an optional-return call. The project should use an OpenZeppelin version that provides `SafeERC20.forceApprove`; on older versions, implement the equivalent safe zero-then-set sequence with SafeERC20 helpers or upgrade OpenZeppelin.
+
+# Testing-practice fix
+
+Add mainnet-fork integration tests using the actual deployed USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool, at a pinned block. Fund or impersonate a real USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but supplement them with fork tests for every production token and external protocol integration.
+
+For focused unit coverage, also include adversarial token doubles that model common non-standard ERC-20 behavior—especially no return value and zero-first approval—but those doubles complement rather than replace a fork test against the exact deployed contracts. The fork test would have exercised USDT's real return-data behavior and failed before deployment.

codex
Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-1/testing-quiz-003/answer.md) with the root cause, `forceApprove` code fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..bad802d7e05017b32e45a6ae8a930bba38da4dad
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Root cause
+
+Mainnet USDT is not fully ERC-20 ABI-compliant. In particular, its `approve(address,uint256)` function does not return a `bool`. Calling it through OpenZeppelin's `IERC20` interface makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the high-level call fails while decoding the empty return data. That is why the transaction reverts without a reason before `aavePool.supply` can complete.
+
+The preceding transfer succeeds because it is actually wrapped:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and accepts either no return data or a decoded `true`, specifically accommodating tokens such as USDT. By contrast:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+is a direct `IERC20.approve` call. `using SafeERC20 for IERC20` only makes the library's explicitly named methods available; it does not intercept or change ordinary `approve` calls. Consequently, `SafeERC20` protected `safeTransferFrom` but never participated in the failing call.
+
+The OpenZeppelin mock always returns the standard `bool` from `approve`, so it cannot reproduce this behavior. More tests against that same implementation would only explore more inputs against the same compliant semantics; they could not reveal an incompatibility that the mock does not model. Matching USDT's six decimals does not make the mock behaviorally equivalent to USDT.
+
+# Code fix
+
+Use the SafeERC20 allowance helper as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` accepts tokens that return no value and also handles USDT-style allowance rules by retrying via an allowance of zero when a direct allowance update fails. It is therefore preferable to a raw `approve` and more robust than merely wrapping approval with an optional-return call. The project should use an OpenZeppelin version that provides `SafeERC20.forceApprove`; on older versions, implement the equivalent safe zero-then-set sequence with SafeERC20 helpers or upgrade OpenZeppelin.
+
+# Testing-practice fix
+
+Add mainnet-fork integration tests using the actual deployed USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool, at a pinned block. Fund or impersonate a real USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but supplement them with fork tests for every production token and external protocol integration.
+
+For focused unit coverage, also include adversarial token doubles that model common non-standard ERC-20 behavior—especially no return value and zero-first approval—but those doubles complement rather than replace a fork test against the exact deployed contracts. The fork test would have exercised USDT's real return-data behavior and failed before deployment.

tokens used
7,711
````

## final message

Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-1/testing-quiz-003/answer.md) with the root cause, `forceApprove` code fix, and mainnet-fork testing recommendation.
