# Executor transcript — 2026-09-01T165909Z-codex-no-skill-3

**executor**: codex  |  **model**: cli default  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-01T165909Z-codex-no-skill-3/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-01T165909Z-codex-no-skill-3/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a05df8-f62b-7ff2-a063-f1c8e18fb6a3
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

2026-09-01T17:16:32.414485Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a05df8-f62b-7ff2-a063-f1c8e18fb6a3.tmp-1788282992188379687: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the workspace instructions and then write the diagnosis and both fixes directly to `answer.md`.
exec
/bin/bash -lc 'ls -la && (find .. -name AGENTS.md -print) && rg -n "safeTransferFrom|aavePool|MockAave|USDT" . || true' in /home/damu/.cache/ethskills-evals/2026-09-01T165909Z-codex-no-skill-3/testing-quiz-003
 succeeded in 14ms:
total 20
drwxrwxr-x 5 damu damu 4096 Sep  1 14:16 .
drwxrwxr-x 3 damu damu 4096 Sep  1 13:59 ..
dr-xr-xr-x 2 damu damu   40 Sep  1 14:16 .agents
dr-xr-xr-x 2 damu damu   40 Sep  1 14:16 .codex
drwxrwxr-x 8 damu damu 4096 Sep  1 13:59 .git
-rw-rw-r-- 1 damu damu 1187 Sep  1 13:59 TASK.md
-rw-rw-r-- 1 damu damu   50 Sep  1 13:59 package.json
./TASK.md:2:underlying and a MockAavePool for the pool — 39 tests, all green, and they have been
./TASK.md:5:We deployed to mainnet with USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) as the
./TASK.md:9:    usdt.safeTransferFrom(msg.sender, address(this), amount);
./TASK.md:10:    usdt.approve(address(aavePool), amount);
./TASK.md:11:    aavePool.supply(address(usdt), amount, address(this), 0);
./TASK.md:19:Explain why this reverts against the real deployed USDT but never against the mock,

codex
The failure is at the direct `approve`, not at Aave’s `supply`: mainnet USDT’s legacy ABI returns no value, while an `IERC20.approve` call expects and decodes a Boolean. I’m capturing that distinction, including the allowance-reset-safe fix and a mainnet-fork regression test.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-01T165909Z-codex-no-skill-3/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..75d1dd5ccd47a0aeed74826dd5c39017ee10e396
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+# Why the mainnet deposit reverts
+
+The reverting statement is the direct `approve`, before execution reaches `aavePool.supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` required by the modern `IERC20` interface. Calling it through `IERC20.approve` makes Solidity expect ABI-encoded Boolean return data. USDT returns no data, so Solidity fails while decoding the empty return buffer. That low-level decode failure commonly appears as a revert with no reason string.
+
+The OpenZeppelin mock never exhibits this behavior because it is a standards-compliant `ERC20`: its `approve` returns `true`. Its ABI behavior therefore matches `IERC20`, whereas mainnet USDT's does not. The mock's six decimals are irrelevant; decimals affect denominations, not the token's call/return behavior.
+
+`SafeERC20` did protect the first line because the wrapper was actually used there:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success, while still requiring a decoded `true` if return data is present. But `using SafeERC20 for IERC20` does not automatically replace or intercept calls to methods already declared on `IERC20`. The second line explicitly calls the raw `IERC20.approve`, so none of `SafeERC20`'s compatibility logic applies to it.
+
+## Code fix
+
+Use the SafeERC20 allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the preferred fix in current OpenZeppelin versions. It accepts tokens that return no value and, when necessary, handles USDT's other allowance quirk: changing a nonzero allowance to another nonzero allowance must first set the allowance to zero. If the project's OpenZeppelin version predates `forceApprove`, use SafeERC20-compatible calls to set the allowance to zero and then to `amount` (or upgrade OpenZeppelin); do not call raw `approve`.
+
+An alternative design is to grant the pool a sufficiently large allowance once during initialization, also via `forceApprove`, and then avoid approving on every deposit. The contract should still account for any operational and upgradeability implications of an unlimited approval.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test, pinned to a known block, that uses the deployed USDT contract and the deployed Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the mock unit tests for fast testing, but do not use them as the sole evidence of compatibility with production tokens and protocols.
+
+No number of tests using only the stock OpenZeppelin mock could reveal this bug: every such test exercises the same compliant implementation whose `approve` returns a Boolean. More cases improve coverage of the vault's logic but cannot test behavior the mock does not model. Either a deliberately adversarial non-standard ERC-20 mock (including no-return and zero-first approval behavior) or, more convincingly, a fork test against the exact production bytecode would have exposed the mismatch before deployment.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..75d1dd5ccd47a0aeed74826dd5c39017ee10e396
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+# Why the mainnet deposit reverts
+
+The reverting statement is the direct `approve`, before execution reaches `aavePool.supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` required by the modern `IERC20` interface. Calling it through `IERC20.approve` makes Solidity expect ABI-encoded Boolean return data. USDT returns no data, so Solidity fails while decoding the empty return buffer. That low-level decode failure commonly appears as a revert with no reason string.
+
+The OpenZeppelin mock never exhibits this behavior because it is a standards-compliant `ERC20`: its `approve` returns `true`. Its ABI behavior therefore matches `IERC20`, whereas mainnet USDT's does not. The mock's six decimals are irrelevant; decimals affect denominations, not the token's call/return behavior.
+
+`SafeERC20` did protect the first line because the wrapper was actually used there:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success, while still requiring a decoded `true` if return data is present. But `using SafeERC20 for IERC20` does not automatically replace or intercept calls to methods already declared on `IERC20`. The second line explicitly calls the raw `IERC20.approve`, so none of `SafeERC20`'s compatibility logic applies to it.
+
+## Code fix
+
+Use the SafeERC20 allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the preferred fix in current OpenZeppelin versions. It accepts tokens that return no value and, when necessary, handles USDT's other allowance quirk: changing a nonzero allowance to another nonzero allowance must first set the allowance to zero. If the project's OpenZeppelin version predates `forceApprove`, use SafeERC20-compatible calls to set the allowance to zero and then to `amount` (or upgrade OpenZeppelin); do not call raw `approve`.
+
+An alternative design is to grant the pool a sufficiently large allowance once during initialization, also via `forceApprove`, and then avoid approving on every deposit. The contract should still account for any operational and upgradeability implications of an unlimited approval.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test, pinned to a known block, that uses the deployed USDT contract and the deployed Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the mock unit tests for fast testing, but do not use them as the sole evidence of compatibility with production tokens and protocols.
+
+No number of tests using only the stock OpenZeppelin mock could reveal this bug: every such test exercises the same compliant implementation whose `approve` returns a Boolean. More cases improve coverage of the vault's logic but cannot test behavior the mock does not model. Either a deliberately adversarial non-standard ERC-20 mock (including no-return and zero-first approval behavior) or, more convincingly, a fork test against the exact production bytecode would have exposed the mismatch before deployment.

exec
/bin/bash -lc "sed -n '1,240p' answer.md && git status --short" in /home/damu/.cache/ethskills-evals/2026-09-01T165909Z-codex-no-skill-3/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Why the mainnet deposit reverts

The reverting statement is the direct `approve`, before execution reaches `aavePool.supply`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` required by the modern `IERC20` interface. Calling it through `IERC20.approve` makes Solidity expect ABI-encoded Boolean return data. USDT returns no data, so Solidity fails while decoding the empty return buffer. That low-level decode failure commonly appears as a revert with no reason string.

The OpenZeppelin mock never exhibits this behavior because it is a standards-compliant `ERC20`: its `approve` returns `true`. Its ABI behavior therefore matches `IERC20`, whereas mainnet USDT's does not. The mock's six decimals are irrelevant; decimals affect denominations, not the token's call/return behavior.

`SafeERC20` did protect the first line because the wrapper was actually used there:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` performs a low-level call and treats empty return data as success, while still requiring a decoded `true` if return data is present. But `using SafeERC20 for IERC20` does not automatically replace or intercept calls to methods already declared on `IERC20`. The second line explicitly calls the raw `IERC20.approve`, so none of `SafeERC20`'s compatibility logic applies to it.

## Code fix

Use the SafeERC20 allowance operation as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the preferred fix in current OpenZeppelin versions. It accepts tokens that return no value and, when necessary, handles USDT's other allowance quirk: changing a nonzero allowance to another nonzero allowance must first set the allowance to zero. If the project's OpenZeppelin version predates `forceApprove`, use SafeERC20-compatible calls to set the allowance to zero and then to `amount` (or upgrade OpenZeppelin); do not call raw `approve`.

An alternative design is to grant the pool a sufficiently large allowance once during initialization, also via `forceApprove`, and then avoid approving on every deposit. The contract should still account for any operational and upgradeability implications of an unlimited approval.

## Testing-practice fix

Add a mainnet-fork integration test, pinned to a known block, that uses the deployed USDT contract and the deployed Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the mock unit tests for fast testing, but do not use them as the sole evidence of compatibility with production tokens and protocols.

No number of tests using only the stock OpenZeppelin mock could reveal this bug: every such test exercises the same compliant implementation whose `approve` returns a Boolean. More cases improve coverage of the vault's logic but cannot test behavior the mock does not model. Either a deliberately adversarial non-standard ERC-20 mock (including no-return and zero-first approval behavior) or, more convincingly, a fork test against the exact production bytecode would have exposed the mismatch before deployment.
?? answer.md

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..75d1dd5ccd47a0aeed74826dd5c39017ee10e396
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+# Why the mainnet deposit reverts
+
+The reverting statement is the direct `approve`, before execution reaches `aavePool.supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` required by the modern `IERC20` interface. Calling it through `IERC20.approve` makes Solidity expect ABI-encoded Boolean return data. USDT returns no data, so Solidity fails while decoding the empty return buffer. That low-level decode failure commonly appears as a revert with no reason string.
+
+The OpenZeppelin mock never exhibits this behavior because it is a standards-compliant `ERC20`: its `approve` returns `true`. Its ABI behavior therefore matches `IERC20`, whereas mainnet USDT's does not. The mock's six decimals are irrelevant; decimals affect denominations, not the token's call/return behavior.
+
+`SafeERC20` did protect the first line because the wrapper was actually used there:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success, while still requiring a decoded `true` if return data is present. But `using SafeERC20 for IERC20` does not automatically replace or intercept calls to methods already declared on `IERC20`. The second line explicitly calls the raw `IERC20.approve`, so none of `SafeERC20`'s compatibility logic applies to it.
+
+## Code fix
+
+Use the SafeERC20 allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the preferred fix in current OpenZeppelin versions. It accepts tokens that return no value and, when necessary, handles USDT's other allowance quirk: changing a nonzero allowance to another nonzero allowance must first set the allowance to zero. If the project's OpenZeppelin version predates `forceApprove`, use SafeERC20-compatible calls to set the allowance to zero and then to `amount` (or upgrade OpenZeppelin); do not call raw `approve`.
+
+An alternative design is to grant the pool a sufficiently large allowance once during initialization, also via `forceApprove`, and then avoid approving on every deposit. The contract should still account for any operational and upgradeability implications of an unlimited approval.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test, pinned to a known block, that uses the deployed USDT contract and the deployed Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the mock unit tests for fast testing, but do not use them as the sole evidence of compatibility with production tokens and protocols.
+
+No number of tests using only the stock OpenZeppelin mock could reveal this bug: every such test exercises the same compliant implementation whose `approve` returns a Boolean. More cases improve coverage of the vault's logic but cannot test behavior the mock does not model. Either a deliberately adversarial non-standard ERC-20 mock (including no-return and zero-first approval behavior) or, more convincingly, a fork test against the exact production bytecode would have exposed the mismatch before deployment.

codex
Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165909Z-codex-no-skill-3/testing-quiz-003/answer.md) with the root cause, `forceApprove` code fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..75d1dd5ccd47a0aeed74826dd5c39017ee10e396
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+# Why the mainnet deposit reverts
+
+The reverting statement is the direct `approve`, before execution reaches `aavePool.supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` required by the modern `IERC20` interface. Calling it through `IERC20.approve` makes Solidity expect ABI-encoded Boolean return data. USDT returns no data, so Solidity fails while decoding the empty return buffer. That low-level decode failure commonly appears as a revert with no reason string.
+
+The OpenZeppelin mock never exhibits this behavior because it is a standards-compliant `ERC20`: its `approve` returns `true`. Its ABI behavior therefore matches `IERC20`, whereas mainnet USDT's does not. The mock's six decimals are irrelevant; decimals affect denominations, not the token's call/return behavior.
+
+`SafeERC20` did protect the first line because the wrapper was actually used there:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+```
+
+`SafeERC20` performs a low-level call and treats empty return data as success, while still requiring a decoded `true` if return data is present. But `using SafeERC20 for IERC20` does not automatically replace or intercept calls to methods already declared on `IERC20`. The second line explicitly calls the raw `IERC20.approve`, so none of `SafeERC20`'s compatibility logic applies to it.
+
+## Code fix
+
+Use the SafeERC20 allowance operation as well:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` is the preferred fix in current OpenZeppelin versions. It accepts tokens that return no value and, when necessary, handles USDT's other allowance quirk: changing a nonzero allowance to another nonzero allowance must first set the allowance to zero. If the project's OpenZeppelin version predates `forceApprove`, use SafeERC20-compatible calls to set the allowance to zero and then to `amount` (or upgrade OpenZeppelin); do not call raw `approve`.
+
+An alternative design is to grant the pool a sufficiently large allowance once during initialization, also via `forceApprove`, and then avoid approving on every deposit. The contract should still account for any operational and upgradeability implications of an unlimited approval.
+
+## Testing-practice fix
+
+Add a mainnet-fork integration test, pinned to a known block, that uses the deployed USDT contract and the deployed Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the mock unit tests for fast testing, but do not use them as the sole evidence of compatibility with production tokens and protocols.
+
+No number of tests using only the stock OpenZeppelin mock could reveal this bug: every such test exercises the same compliant implementation whose `approve` returns a Boolean. More cases improve coverage of the vault's logic but cannot test behavior the mock does not model. Either a deliberately adversarial non-standard ERC-20 mock (including no-return and zero-first approval behavior) or, more convincingly, a fork test against the exact production bytecode would have exposed the mismatch before deployment.

tokens used
15,485
````

## final message

Created [answer.md](/home/damu/.cache/ethskills-evals/2026-09-01T165909Z-codex-no-skill-3/testing-quiz-003/answer.md) with the root cause, `forceApprove` code fix, and mainnet-fork testing recommendation.
