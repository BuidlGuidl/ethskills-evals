# Executor transcript — 2026-09-01T165908Z-codex-no-skill-2

**executor**: codex  |  **model**: cli default  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-01T165908Z-codex-no-skill-2/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-01T165908Z-codex-no-skill-2/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a05df8-ce98-7de0-9ce7-f41d7c297f1a
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

2026-09-01T17:16:22.274667Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a05df8-ce98-7de0-9ce7-f41d7c297f1a.tmp-1788282982050171648: line 2547: syntax error near unexpected token `('

codex
I’ll document the production-specific ERC-20 ABI mismatch, the allowance-safe code fix, and the fork-testing practice needed to expose it.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-01T165908Z-codex-no-skill-2/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..aee060c61c06143afa3bad3fb84c3578ec3f116a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+# Why the USDT deposit reverts
+
+The failure is the direct `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return a Boolean value. By contrast, OpenZeppelin's `IERC20.approve` declares `returns (bool)`. A normal high-level Solidity call through `IERC20` therefore expects ABI-encoded return data. USDT returns no data, so Solidity's return-data decoding fails and the transaction reverts, commonly without a useful reason string.
+
+The preceding transfer succeeds because it uses the SafeERC20 wrapper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+SafeERC20 performs a low-level call and treats either of these as success:
+
+- no return data, for legacy tokens such as USDT; or
+- return data that decodes to `true`.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not intercept or modify calls to the token's own methods. Thus `safeTransferFrom` is protected, but the direct `.approve(...)` call is not.
+
+The stock OpenZeppelin `MockERC20` is standards-compliant and returns `true` from `approve`, so it cannot reproduce this behavior. Its six decimals are irrelevant: decimals affect display/unit conventions, not the ABI behavior of `approve`. Adding more tests against that same mock would only exercise the same compliant implementation. Test quantity cannot compensate for a model that omits the production token's behavior.
+
+## Code fix
+
+Use SafeERC20 for the allowance operation as well. With OpenZeppelin 5.x, the robust choice is `forceApprove`, which supports optional-return tokens and tokens such as USDT that require an allowance to be reset to zero before changing one nonzero value to another:
+
+```solidity
+using SafeERC20 for IERC20;
+
+function deposit(uint256 amount) external {
+    usdt.safeTransferFrom(msg.sender, address(this), amount);
+    usdt.forceApprove(address(aavePool), amount);
+    aavePool.supply(address(usdt), amount, address(this), 0);
+}
+```
+
+For an older OpenZeppelin version without `forceApprove`, use SafeERC20's optional-return-safe allowance operation supported by that version, resetting to zero before setting the desired amount when necessary:
+
+```solidity
+usdt.safeApprove(address(aavePool), 0);
+usdt.safeApprove(address(aavePool), amount);
+```
+
+Do not replace the failing line with another raw `approve` call. Also, simply ignoring its returned Boolean would not help: the ABI decoder still expects return data.
+
+## Testing-practice fix
+
+Keep fast unit tests, but add a pinned mainnet-fork integration test that uses the actual deployed USDT contract and the actual Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/accounting. That test would execute USDT's real bytecode and would have failed on the raw `approve` before deployment.
+
+A deliberately non-standard token double can supplement the fork test (no return value from `approve`, plus USDT's zero-first allowance behavior), but it should not be the sole production-compatibility check. The fork test guards against other differences in the real token and Aave integration that a hand-written mock may fail to model.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..aee060c61c06143afa3bad3fb84c3578ec3f116a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+# Why the USDT deposit reverts
+
+The failure is the direct `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return a Boolean value. By contrast, OpenZeppelin's `IERC20.approve` declares `returns (bool)`. A normal high-level Solidity call through `IERC20` therefore expects ABI-encoded return data. USDT returns no data, so Solidity's return-data decoding fails and the transaction reverts, commonly without a useful reason string.
+
+The preceding transfer succeeds because it uses the SafeERC20 wrapper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+SafeERC20 performs a low-level call and treats either of these as success:
+
+- no return data, for legacy tokens such as USDT; or
+- return data that decodes to `true`.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not intercept or modify calls to the token's own methods. Thus `safeTransferFrom` is protected, but the direct `.approve(...)` call is not.
+
+The stock OpenZeppelin `MockERC20` is standards-compliant and returns `true` from `approve`, so it cannot reproduce this behavior. Its six decimals are irrelevant: decimals affect display/unit conventions, not the ABI behavior of `approve`. Adding more tests against that same mock would only exercise the same compliant implementation. Test quantity cannot compensate for a model that omits the production token's behavior.
+
+## Code fix
+
+Use SafeERC20 for the allowance operation as well. With OpenZeppelin 5.x, the robust choice is `forceApprove`, which supports optional-return tokens and tokens such as USDT that require an allowance to be reset to zero before changing one nonzero value to another:
+
+```solidity
+using SafeERC20 for IERC20;
+
+function deposit(uint256 amount) external {
+    usdt.safeTransferFrom(msg.sender, address(this), amount);
+    usdt.forceApprove(address(aavePool), amount);
+    aavePool.supply(address(usdt), amount, address(this), 0);
+}
+```
+
+For an older OpenZeppelin version without `forceApprove`, use SafeERC20's optional-return-safe allowance operation supported by that version, resetting to zero before setting the desired amount when necessary:
+
+```solidity
+usdt.safeApprove(address(aavePool), 0);
+usdt.safeApprove(address(aavePool), amount);
+```
+
+Do not replace the failing line with another raw `approve` call. Also, simply ignoring its returned Boolean would not help: the ABI decoder still expects return data.
+
+## Testing-practice fix
+
+Keep fast unit tests, but add a pinned mainnet-fork integration test that uses the actual deployed USDT contract and the actual Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/accounting. That test would execute USDT's real bytecode and would have failed on the raw `approve` before deployment.
+
+A deliberately non-standard token double can supplement the fork test (no return value from `approve`, plus USDT's zero-first allowance behavior), but it should not be the sole production-compatibility check. The fork test guards against other differences in the real token and Aave integration that a hand-written mock may fail to model.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /home/damu/.cache/ethskills-evals/2026-09-01T165908Z-codex-no-skill-2/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Why the USDT deposit reverts

The failure is the direct `approve` call:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return a Boolean value. By contrast, OpenZeppelin's `IERC20.approve` declares `returns (bool)`. A normal high-level Solidity call through `IERC20` therefore expects ABI-encoded return data. USDT returns no data, so Solidity's return-data decoding fails and the transaction reverts, commonly without a useful reason string.

The preceding transfer succeeds because it uses the SafeERC20 wrapper:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

SafeERC20 performs a low-level call and treats either of these as success:

- no return data, for legacy tokens such as USDT; or
- return data that decodes to `true`.

`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not intercept or modify calls to the token's own methods. Thus `safeTransferFrom` is protected, but the direct `.approve(...)` call is not.

The stock OpenZeppelin `MockERC20` is standards-compliant and returns `true` from `approve`, so it cannot reproduce this behavior. Its six decimals are irrelevant: decimals affect display/unit conventions, not the ABI behavior of `approve`. Adding more tests against that same mock would only exercise the same compliant implementation. Test quantity cannot compensate for a model that omits the production token's behavior.

## Code fix

Use SafeERC20 for the allowance operation as well. With OpenZeppelin 5.x, the robust choice is `forceApprove`, which supports optional-return tokens and tokens such as USDT that require an allowance to be reset to zero before changing one nonzero value to another:

```solidity
using SafeERC20 for IERC20;

function deposit(uint256 amount) external {
    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.forceApprove(address(aavePool), amount);
    aavePool.supply(address(usdt), amount, address(this), 0);
}
```

For an older OpenZeppelin version without `forceApprove`, use SafeERC20's optional-return-safe allowance operation supported by that version, resetting to zero before setting the desired amount when necessary:

```solidity
usdt.safeApprove(address(aavePool), 0);
usdt.safeApprove(address(aavePool), amount);
```

Do not replace the failing line with another raw `approve` call. Also, simply ignoring its returned Boolean would not help: the ABI decoder still expects return data.

## Testing-practice fix

Keep fast unit tests, but add a pinned mainnet-fork integration test that uses the actual deployed USDT contract and the actual Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/accounting. That test would execute USDT's real bytecode and would have failed on the raw `approve` before deployment.

A deliberately non-standard token double can supplement the fork test (no return value from `approve`, plus USDT's zero-first allowance behavior), but it should not be the sole production-compatibility check. The fork test guards against other differences in the real token and Aave integration that a hand-written mock may fail to model.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..aee060c61c06143afa3bad3fb84c3578ec3f116a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+# Why the USDT deposit reverts
+
+The failure is the direct `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return a Boolean value. By contrast, OpenZeppelin's `IERC20.approve` declares `returns (bool)`. A normal high-level Solidity call through `IERC20` therefore expects ABI-encoded return data. USDT returns no data, so Solidity's return-data decoding fails and the transaction reverts, commonly without a useful reason string.
+
+The preceding transfer succeeds because it uses the SafeERC20 wrapper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+SafeERC20 performs a low-level call and treats either of these as success:
+
+- no return data, for legacy tokens such as USDT; or
+- return data that decodes to `true`.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not intercept or modify calls to the token's own methods. Thus `safeTransferFrom` is protected, but the direct `.approve(...)` call is not.
+
+The stock OpenZeppelin `MockERC20` is standards-compliant and returns `true` from `approve`, so it cannot reproduce this behavior. Its six decimals are irrelevant: decimals affect display/unit conventions, not the ABI behavior of `approve`. Adding more tests against that same mock would only exercise the same compliant implementation. Test quantity cannot compensate for a model that omits the production token's behavior.
+
+## Code fix
+
+Use SafeERC20 for the allowance operation as well. With OpenZeppelin 5.x, the robust choice is `forceApprove`, which supports optional-return tokens and tokens such as USDT that require an allowance to be reset to zero before changing one nonzero value to another:
+
+```solidity
+using SafeERC20 for IERC20;
+
+function deposit(uint256 amount) external {
+    usdt.safeTransferFrom(msg.sender, address(this), amount);
+    usdt.forceApprove(address(aavePool), amount);
+    aavePool.supply(address(usdt), amount, address(this), 0);
+}
+```
+
+For an older OpenZeppelin version without `forceApprove`, use SafeERC20's optional-return-safe allowance operation supported by that version, resetting to zero before setting the desired amount when necessary:
+
+```solidity
+usdt.safeApprove(address(aavePool), 0);
+usdt.safeApprove(address(aavePool), amount);
+```
+
+Do not replace the failing line with another raw `approve` call. Also, simply ignoring its returned Boolean would not help: the ABI decoder still expects return data.
+
+## Testing-practice fix
+
+Keep fast unit tests, but add a pinned mainnet-fork integration test that uses the actual deployed USDT contract and the actual Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/accounting. That test would execute USDT's real bytecode and would have failed on the raw `approve` before deployment.
+
+A deliberately non-standard token double can supplement the fork test (no return value from `approve`, plus USDT's zero-first allowance behavior), but it should not be the sole production-compatibility check. The fork test guards against other differences in the real token and Aave integration that a hand-written mock may fail to model.

codex
Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165908Z-codex-no-skill-2/testing-quiz-003/answer.md) with the cause, both fixes, and the recommended mainnet-fork testing practice.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..aee060c61c06143afa3bad3fb84c3578ec3f116a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+# Why the USDT deposit reverts
+
+The failure is the direct `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return a Boolean value. By contrast, OpenZeppelin's `IERC20.approve` declares `returns (bool)`. A normal high-level Solidity call through `IERC20` therefore expects ABI-encoded return data. USDT returns no data, so Solidity's return-data decoding fails and the transaction reverts, commonly without a useful reason string.
+
+The preceding transfer succeeds because it uses the SafeERC20 wrapper:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+SafeERC20 performs a low-level call and treats either of these as success:
+
+- no return data, for legacy tokens such as USDT; or
+- return data that decodes to `true`.
+
+`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not intercept or modify calls to the token's own methods. Thus `safeTransferFrom` is protected, but the direct `.approve(...)` call is not.
+
+The stock OpenZeppelin `MockERC20` is standards-compliant and returns `true` from `approve`, so it cannot reproduce this behavior. Its six decimals are irrelevant: decimals affect display/unit conventions, not the ABI behavior of `approve`. Adding more tests against that same mock would only exercise the same compliant implementation. Test quantity cannot compensate for a model that omits the production token's behavior.
+
+## Code fix
+
+Use SafeERC20 for the allowance operation as well. With OpenZeppelin 5.x, the robust choice is `forceApprove`, which supports optional-return tokens and tokens such as USDT that require an allowance to be reset to zero before changing one nonzero value to another:
+
+```solidity
+using SafeERC20 for IERC20;
+
+function deposit(uint256 amount) external {
+    usdt.safeTransferFrom(msg.sender, address(this), amount);
+    usdt.forceApprove(address(aavePool), amount);
+    aavePool.supply(address(usdt), amount, address(this), 0);
+}
+```
+
+For an older OpenZeppelin version without `forceApprove`, use SafeERC20's optional-return-safe allowance operation supported by that version, resetting to zero before setting the desired amount when necessary:
+
+```solidity
+usdt.safeApprove(address(aavePool), 0);
+usdt.safeApprove(address(aavePool), amount);
+```
+
+Do not replace the failing line with another raw `approve` call. Also, simply ignoring its returned Boolean would not help: the ABI decoder still expects return data.
+
+## Testing-practice fix
+
+Keep fast unit tests, but add a pinned mainnet-fork integration test that uses the actual deployed USDT contract and the actual Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/accounting. That test would execute USDT's real bytecode and would have failed on the raw `approve` before deployment.
+
+A deliberately non-standard token double can supplement the fork test (no return value from `approve`, plus USDT's zero-first allowance behavior), but it should not be the sole production-compatibility check. The fork test guards against other differences in the real token and Aave integration that a hand-written mock may fail to model.

tokens used
8,783
````

## final message

Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165908Z-codex-no-skill-2/testing-quiz-003/answer.md) with the cause, both fixes, and the recommended mainnet-fork testing practice.
