# Executor transcript — 2026-09-14T192829Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192829Z-codex-no-skill-1/testing-quiz-003

## session

````text
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "/tmp" (codex_home: AbsolutePathBuf("/tmp/ethskills-eval-harness-codex"))
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192829Z-codex-no-skill-1/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0a166-caf6-7c62-a121-1cf41604fea3
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
I’ll inspect the workspace instructions and then write the diagnosis and both fixes directly to `answer.md`.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!lib'"' -g '"'!out'"' && (test -f AGENTS.md && sed -n '1,240p' AGENTS.md || true)" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192829Z-codex-no-skill-1/testing-quiz-003
 exited 1 in 9ms:
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192829Z-codex-no-skill-1/testing-quiz-003

codex
The key mismatch is confirmed: the successful call is wrapped by `SafeERC20`, while `approve` is a raw interface call. Mainnet USDT’s legacy return-data behavior makes that distinction decisive.
apply patch
patch: completed
/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192829Z-codex-no-skill-1/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..e0d1825b545f3239d0af4c5d4f764d84cce20dac
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Why the USDT deposit reverts
+
+The failure is the raw `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy ERC-20 implementation. Its state-changing token functions do not behave exactly like a modern OpenZeppelin `ERC20`: in particular, its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore tries to decode an empty return value as a `bool` and reverts. That ABI decoding failure commonly has no reason string.
+
+The preceding transfer succeeds because it is a different kind of call:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is supplied by `SafeERC20`. It performs a low-level call and accepts either an explicit `true` return value or no return data, specifically to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` does not automatically wrap every method on the token. It only adds the library's named extension methods. Calling `usdt.approve(...)` still invokes `IERC20.approve` directly, so none of `SafeERC20`'s optional-return handling protects that line.
+
+The OpenZeppelin `MockERC20` never exposes the problem because it is a standards-conforming implementation whose `approve` returns `true`. More assertions and more test cases against that same mock only exercise the mock's behavior; they cannot discover behavior the mock does not model. Matching USDT's six decimals models denomination, not its ABI quirks. A specially written USDT-like mock could reproduce the issue, but the stock mock cannot.
+
+## Code fix
+
+Use the `SafeERC20` allowance helper rather than raw `approve`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and also supports USDT's other well-known allowance rule: changing a nonzero allowance to another nonzero allowance may require first setting it to zero. It is therefore preferable here to merely replacing `approve` with an optional-return wrapper. If the project's OpenZeppelin version predates `forceApprove`, use safe optional-return calls to approve zero and then approve `amount`, or upgrade OpenZeppelin.
+
+An alternative architecture is to establish the pool's maximum allowance once with `forceApprove` and reuse it, subject to the project's allowance-risk policy.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a known block and run the deposit path against the actual deployed USDT and Aave V3 pool contracts. Fund the test account with USDT using fork test facilities, approve the vault, deposit, and assert that Aave receives/supplies the assets.
+
+Keep the fast mock unit tests, but do not treat a generic OpenZeppelin ERC-20 mock as compatibility coverage for production tokens. For supported assets, test against their real deployed bytecode on a fork (and optionally maintain adversarial token mocks for no-return values, false returns, zero-first approvals, fees, rebasing, and other relevant behaviors). The fork test would have exercised USDT's real return-data and allowance semantics and failed before deployment.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..e0d1825b545f3239d0af4c5d4f764d84cce20dac
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Why the USDT deposit reverts
+
+The failure is the raw `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy ERC-20 implementation. Its state-changing token functions do not behave exactly like a modern OpenZeppelin `ERC20`: in particular, its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore tries to decode an empty return value as a `bool` and reverts. That ABI decoding failure commonly has no reason string.
+
+The preceding transfer succeeds because it is a different kind of call:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is supplied by `SafeERC20`. It performs a low-level call and accepts either an explicit `true` return value or no return data, specifically to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` does not automatically wrap every method on the token. It only adds the library's named extension methods. Calling `usdt.approve(...)` still invokes `IERC20.approve` directly, so none of `SafeERC20`'s optional-return handling protects that line.
+
+The OpenZeppelin `MockERC20` never exposes the problem because it is a standards-conforming implementation whose `approve` returns `true`. More assertions and more test cases against that same mock only exercise the mock's behavior; they cannot discover behavior the mock does not model. Matching USDT's six decimals models denomination, not its ABI quirks. A specially written USDT-like mock could reproduce the issue, but the stock mock cannot.
+
+## Code fix
+
+Use the `SafeERC20` allowance helper rather than raw `approve`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and also supports USDT's other well-known allowance rule: changing a nonzero allowance to another nonzero allowance may require first setting it to zero. It is therefore preferable here to merely replacing `approve` with an optional-return wrapper. If the project's OpenZeppelin version predates `forceApprove`, use safe optional-return calls to approve zero and then approve `amount`, or upgrade OpenZeppelin.
+
+An alternative architecture is to establish the pool's maximum allowance once with `forceApprove` and reuse it, subject to the project's allowance-risk policy.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a known block and run the deposit path against the actual deployed USDT and Aave V3 pool contracts. Fund the test account with USDT using fork test facilities, approve the vault, deposit, and assert that Aave receives/supplies the assets.
+
+Keep the fast mock unit tests, but do not treat a generic OpenZeppelin ERC-20 mock as compatibility coverage for production tokens. For supported assets, test against their real deployed bytecode on a fork (and optionally maintain adversarial token mocks for no-return values, false returns, zero-first approvals, fees, rebasing, and other relevant behaviors). The fork test would have exercised USDT's real return-data and allowance semantics and failed before deployment.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git status --short -- answer.md" in /tmp/ethskills-eval-workspaces-114-review/2026-09-14T192829Z-codex-no-skill-1/testing-quiz-003
 succeeded in 4ms:
?? answer.md

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..e0d1825b545f3239d0af4c5d4f764d84cce20dac
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Why the USDT deposit reverts
+
+The failure is the raw `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy ERC-20 implementation. Its state-changing token functions do not behave exactly like a modern OpenZeppelin `ERC20`: in particular, its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore tries to decode an empty return value as a `bool` and reverts. That ABI decoding failure commonly has no reason string.
+
+The preceding transfer succeeds because it is a different kind of call:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is supplied by `SafeERC20`. It performs a low-level call and accepts either an explicit `true` return value or no return data, specifically to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` does not automatically wrap every method on the token. It only adds the library's named extension methods. Calling `usdt.approve(...)` still invokes `IERC20.approve` directly, so none of `SafeERC20`'s optional-return handling protects that line.
+
+The OpenZeppelin `MockERC20` never exposes the problem because it is a standards-conforming implementation whose `approve` returns `true`. More assertions and more test cases against that same mock only exercise the mock's behavior; they cannot discover behavior the mock does not model. Matching USDT's six decimals models denomination, not its ABI quirks. A specially written USDT-like mock could reproduce the issue, but the stock mock cannot.
+
+## Code fix
+
+Use the `SafeERC20` allowance helper rather than raw `approve`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and also supports USDT's other well-known allowance rule: changing a nonzero allowance to another nonzero allowance may require first setting it to zero. It is therefore preferable here to merely replacing `approve` with an optional-return wrapper. If the project's OpenZeppelin version predates `forceApprove`, use safe optional-return calls to approve zero and then approve `amount`, or upgrade OpenZeppelin.
+
+An alternative architecture is to establish the pool's maximum allowance once with `forceApprove` and reuse it, subject to the project's allowance-risk policy.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a known block and run the deposit path against the actual deployed USDT and Aave V3 pool contracts. Fund the test account with USDT using fork test facilities, approve the vault, deposit, and assert that Aave receives/supplies the assets.
+
+Keep the fast mock unit tests, but do not treat a generic OpenZeppelin ERC-20 mock as compatibility coverage for production tokens. For supported assets, test against their real deployed bytecode on a fork (and optionally maintain adversarial token mocks for no-return values, false returns, zero-first approvals, fees, rebasing, and other relevant behaviors). The fork test would have exercised USDT's real return-data and allowance semantics and failed before deployment.

codex
Created [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192829Z-codex-no-skill-1/testing-quiz-003/answer.md) with the USDT ABI diagnosis, `forceApprove` code fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..e0d1825b545f3239d0af4c5d4f764d84cce20dac
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,41 @@
+# Why the USDT deposit reverts
+
+The failure is the raw `approve` call:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy ERC-20 implementation. Its state-changing token functions do not behave exactly like a modern OpenZeppelin `ERC20`: in particular, its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore tries to decode an empty return value as a `bool` and reverts. That ABI decoding failure commonly has no reason string.
+
+The preceding transfer succeeds because it is a different kind of call:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`safeTransferFrom` is supplied by `SafeERC20`. It performs a low-level call and accepts either an explicit `true` return value or no return data, specifically to support tokens such as USDT.
+
+`using SafeERC20 for IERC20` does not automatically wrap every method on the token. It only adds the library's named extension methods. Calling `usdt.approve(...)` still invokes `IERC20.approve` directly, so none of `SafeERC20`'s optional-return handling protects that line.
+
+The OpenZeppelin `MockERC20` never exposes the problem because it is a standards-conforming implementation whose `approve` returns `true`. More assertions and more test cases against that same mock only exercise the mock's behavior; they cannot discover behavior the mock does not model. Matching USDT's six decimals models denomination, not its ABI quirks. A specially written USDT-like mock could reproduce the issue, but the stock mock cannot.
+
+## Code fix
+
+Use the `SafeERC20` allowance helper rather than raw `approve`:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and also supports USDT's other well-known allowance rule: changing a nonzero allowance to another nonzero allowance may require first setting it to zero. It is therefore preferable here to merely replacing `approve` with an optional-return wrapper. If the project's OpenZeppelin version predates `forceApprove`, use safe optional-return calls to approve zero and then approve `amount`, or upgrade OpenZeppelin.
+
+An alternative architecture is to establish the pool's maximum allowance once with `forceApprove` and reuse it, subject to the project's allowance-risk policy.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test pinned to a known block and run the deposit path against the actual deployed USDT and Aave V3 pool contracts. Fund the test account with USDT using fork test facilities, approve the vault, deposit, and assert that Aave receives/supplies the assets.
+
+Keep the fast mock unit tests, but do not treat a generic OpenZeppelin ERC-20 mock as compatibility coverage for production tokens. For supported assets, test against their real deployed bytecode on a fork (and optionally maintain adversarial token mocks for no-return values, false returns, zero-first approvals, fees, rebasing, and other relevant behaviors). The fork test would have exercised USDT's real return-data and allowance semantics and failed before deployment.

tokens used
8,325
````

## final message

Created [answer.md](/tmp/ethskills-eval-workspaces-114-review/2026-09-14T192829Z-codex-no-skill-1/testing-quiz-003/answer.md) with the USDT ABI diagnosis, `forceApprove` code fix, and mainnet-fork testing recommendation.
