# Executor transcript — 2026-09-11T170333Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-2/testing-quiz-003

## session

````text
2026-09-11T17:17:07.126438Z  WARN codex_app_server::skills_watcher: failed to initialize skills file watcher: No file descriptors available (os error 24)
2026-09-11T17:17:07.127092Z  WARN codex_app_server::fs_watch: filesystem watch manager falling back to noop core watcher: No file descriptors available (os error 24)
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-2/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 01a09179-1778-7380-8b62-d24c977a87d2
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
I’ll trace the token-call semantics and then write a concise root-cause-and-fixes explanation to `answer.md`.
exec
/bin/bash -lc "ls -la && (rg --files -g 'AGENTS.md' -g '"'!node_modules'"' || true)" in /tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-2/testing-quiz-003
 succeeded in 24ms:
total 20
drwxrwxr-x 5 damu damu 4096 Sep 11 14:17 .
drwxrwxr-x 3 damu damu 4096 Sep 11 14:03 ..
dr-xr-xr-x 2 damu damu   40 Sep 11 14:17 .agents
dr-xr-xr-x 2 damu damu   40 Sep 11 14:17 .codex
drwxrwxr-x 8 damu damu 4096 Sep 11 14:03 .git
-rw-rw-r-- 1 damu damu 1187 Sep 11 14:03 TASK.md
-rw-rw-r-- 1 damu damu   50 Sep 11 14:03 package.json

codex
The key distinction is confirmed: `using SafeERC20` only adds wrapper methods; it does not change the behavior of a direct `approve` call. I’m capturing the empty-return ABI mismatch, USDT’s allowance quirk, and the fork-testing remedy.
apply patch
patch: completed
/tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-2/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..82ac42cb10178d829a9e44a334d36f291f8c8507
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Root cause
+
+Mainnet USDT is not a fully ABI-conforming `IERC20`. In particular, its `approve` implementation does not return the `bool` that `IERC20.approve` declares.
+
+The first call succeeds because it goes through `SafeERC20`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` makes a low-level call and accepts either `true` **or no return data**, which accommodates tokens such as USDT.
+
+The next call does not go through `SafeERC20`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+This is a normal high-level call through the `IERC20` ABI. Solidity therefore expects and decodes a returned `bool`. Real USDT returns no data, so ABI decoding fails and the caller reverts. The empty-data decoding failure explains the absence of a token revert reason. Execution never reaches `aavePool.supply`.
+
+`using SafeERC20 for IERC20` does not transparently intercept or replace existing `IERC20` methods. It only makes the library's explicitly named extension methods, such as `safeTransferFrom` and `forceApprove`, available on the value. Calling `approve` still calls `IERC20.approve` directly.
+
+The OpenZeppelin `MockERC20` follows the standard ABI and returns `true` from `approve`, so it cannot reproduce this behavior. Its six decimals are irrelevant. Adding more tests against that same conforming mock only exercises the mock's semantics; it cannot reveal a mismatch that the mock does not model. A deliberately USDT-like mock could expose it, but the stock mock cannot.
+
+# Fixes
+
+Use SafeERC20 for the allowance operation as well. With a current OpenZeppelin version, the robust change is:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens with optional/no return data and also handles USDT's other non-standard rule: changing a nonzero allowance to another nonzero allowance may require first setting it to zero. With an older SafeERC20 version that lacks `forceApprove`, use SafeERC20-wrapped approvals to set the allowance to zero and then to `amount` (or upgrade OpenZeppelin); do not use a raw `IERC20.approve` call.
+
+The testing-practice fix is to add a mainnet-fork integration test that uses the actual USDT contract and the actual Aave V3 pool, funds/impersonates an account holding USDT, performs a deposit, and verifies the resulting Aave position. Keep unit tests and mocks for speed, but run fork tests for every real external token/protocol combination the deployment supports. Such a test executes the deployed bytecode and would have failed on the direct `approve` before deployment. Complementary adversarial token mocks for no-return values, false returns, and zero-first approvals are useful, but they are not a substitute for the fork test.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..82ac42cb10178d829a9e44a334d36f291f8c8507
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Root cause
+
+Mainnet USDT is not a fully ABI-conforming `IERC20`. In particular, its `approve` implementation does not return the `bool` that `IERC20.approve` declares.
+
+The first call succeeds because it goes through `SafeERC20`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` makes a low-level call and accepts either `true` **or no return data**, which accommodates tokens such as USDT.
+
+The next call does not go through `SafeERC20`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+This is a normal high-level call through the `IERC20` ABI. Solidity therefore expects and decodes a returned `bool`. Real USDT returns no data, so ABI decoding fails and the caller reverts. The empty-data decoding failure explains the absence of a token revert reason. Execution never reaches `aavePool.supply`.
+
+`using SafeERC20 for IERC20` does not transparently intercept or replace existing `IERC20` methods. It only makes the library's explicitly named extension methods, such as `safeTransferFrom` and `forceApprove`, available on the value. Calling `approve` still calls `IERC20.approve` directly.
+
+The OpenZeppelin `MockERC20` follows the standard ABI and returns `true` from `approve`, so it cannot reproduce this behavior. Its six decimals are irrelevant. Adding more tests against that same conforming mock only exercises the mock's semantics; it cannot reveal a mismatch that the mock does not model. A deliberately USDT-like mock could expose it, but the stock mock cannot.
+
+# Fixes
+
+Use SafeERC20 for the allowance operation as well. With a current OpenZeppelin version, the robust change is:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens with optional/no return data and also handles USDT's other non-standard rule: changing a nonzero allowance to another nonzero allowance may require first setting it to zero. With an older SafeERC20 version that lacks `forceApprove`, use SafeERC20-wrapped approvals to set the allowance to zero and then to `amount` (or upgrade OpenZeppelin); do not use a raw `IERC20.approve` call.
+
+The testing-practice fix is to add a mainnet-fork integration test that uses the actual USDT contract and the actual Aave V3 pool, funds/impersonates an account holding USDT, performs a deposit, and verifies the resulting Aave position. Keep unit tests and mocks for speed, but run fork tests for every real external token/protocol combination the deployment supports. Such a test executes the deployed bytecode and would have failed on the direct `approve` before deployment. Complementary adversarial token mocks for no-return values, false returns, and zero-first approvals are useful, but they are not a substitute for the fork test.

exec
/bin/bash -lc "sed -n '1,240p' answer.md && git diff --check && git status --short" in /tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-2/testing-quiz-003
 succeeded in 2ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..82ac42cb10178d829a9e44a334d36f291f8c8507
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Root cause
+
+Mainnet USDT is not a fully ABI-conforming `IERC20`. In particular, its `approve` implementation does not return the `bool` that `IERC20.approve` declares.
+
+The first call succeeds because it goes through `SafeERC20`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` makes a low-level call and accepts either `true` **or no return data**, which accommodates tokens such as USDT.
+
+The next call does not go through `SafeERC20`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+This is a normal high-level call through the `IERC20` ABI. Solidity therefore expects and decodes a returned `bool`. Real USDT returns no data, so ABI decoding fails and the caller reverts. The empty-data decoding failure explains the absence of a token revert reason. Execution never reaches `aavePool.supply`.
+
+`using SafeERC20 for IERC20` does not transparently intercept or replace existing `IERC20` methods. It only makes the library's explicitly named extension methods, such as `safeTransferFrom` and `forceApprove`, available on the value. Calling `approve` still calls `IERC20.approve` directly.
+
+The OpenZeppelin `MockERC20` follows the standard ABI and returns `true` from `approve`, so it cannot reproduce this behavior. Its six decimals are irrelevant. Adding more tests against that same conforming mock only exercises the mock's semantics; it cannot reveal a mismatch that the mock does not model. A deliberately USDT-like mock could expose it, but the stock mock cannot.
+
+# Fixes
+
+Use SafeERC20 for the allowance operation as well. With a current OpenZeppelin version, the robust change is:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens with optional/no return data and also handles USDT's other non-standard rule: changing a nonzero allowance to another nonzero allowance may require first setting it to zero. With an older SafeERC20 version that lacks `forceApprove`, use SafeERC20-wrapped approvals to set the allowance to zero and then to `amount` (or upgrade OpenZeppelin); do not use a raw `IERC20.approve` call.
+
+The testing-practice fix is to add a mainnet-fork integration test that uses the actual USDT contract and the actual Aave V3 pool, funds/impersonates an account holding USDT, performs a deposit, and verifies the resulting Aave position. Keep unit tests and mocks for speed, but run fork tests for every real external token/protocol combination the deployment supports. Such a test executes the deployed bytecode and would have failed on the direct `approve` before deployment. Complementary adversarial token mocks for no-return values, false returns, and zero-first approvals are useful, but they are not a substitute for the fork test.

codex
Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-2/testing-quiz-003/answer.md) with the root cause, `forceApprove` fix, and mainnet-fork testing recommendation. `git diff --check` passes.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..82ac42cb10178d829a9e44a334d36f291f8c8507
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,37 @@
+# Root cause
+
+Mainnet USDT is not a fully ABI-conforming `IERC20`. In particular, its `approve` implementation does not return the `bool` that `IERC20.approve` declares.
+
+The first call succeeds because it goes through `SafeERC20`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` makes a low-level call and accepts either `true` **or no return data**, which accommodates tokens such as USDT.
+
+The next call does not go through `SafeERC20`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+This is a normal high-level call through the `IERC20` ABI. Solidity therefore expects and decodes a returned `bool`. Real USDT returns no data, so ABI decoding fails and the caller reverts. The empty-data decoding failure explains the absence of a token revert reason. Execution never reaches `aavePool.supply`.
+
+`using SafeERC20 for IERC20` does not transparently intercept or replace existing `IERC20` methods. It only makes the library's explicitly named extension methods, such as `safeTransferFrom` and `forceApprove`, available on the value. Calling `approve` still calls `IERC20.approve` directly.
+
+The OpenZeppelin `MockERC20` follows the standard ABI and returns `true` from `approve`, so it cannot reproduce this behavior. Its six decimals are irrelevant. Adding more tests against that same conforming mock only exercises the mock's semantics; it cannot reveal a mismatch that the mock does not model. A deliberately USDT-like mock could expose it, but the stock mock cannot.
+
+# Fixes
+
+Use SafeERC20 for the allowance operation as well. With a current OpenZeppelin version, the robust change is:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens with optional/no return data and also handles USDT's other non-standard rule: changing a nonzero allowance to another nonzero allowance may require first setting it to zero. With an older SafeERC20 version that lacks `forceApprove`, use SafeERC20-wrapped approvals to set the allowance to zero and then to `amount` (or upgrade OpenZeppelin); do not use a raw `IERC20.approve` call.
+
+The testing-practice fix is to add a mainnet-fork integration test that uses the actual USDT contract and the actual Aave V3 pool, funds/impersonates an account holding USDT, performs a deposit, and verifies the resulting Aave position. Keep unit tests and mocks for speed, but run fork tests for every real external token/protocol combination the deployment supports. Such a test executes the deployed bytecode and would have failed on the direct `approve` before deployment. Complementary adversarial token mocks for no-return values, false returns, and zero-first approvals are useful, but they are not a substitute for the fork test.

tokens used
12,695
````

## final message

Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-11T170333Z-codex-no-skill-2/testing-quiz-003/answer.md) with the root cause, `forceApprove` fix, and mainnet-fork testing recommendation. `git diff --check` passes.
