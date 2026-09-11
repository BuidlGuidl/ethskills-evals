# Executor transcript — 2026-09-11T170334Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-evals-issue112/2026-09-11T170334Z-codex-no-skill-3/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-evals-issue112/2026-09-11T170334Z-codex-no-skill-3/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 01a09179-15e3-75c1-b7cf-b9418b30664f
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
I’ll inspect the workspace guidance, then write the diagnosis and both fixes directly to `answer.md`.
exec
/bin/bash -lc "ls -la && find .. -name AGENTS.md -print && if [ -f AGENTS.md ]; then sed -n '1,240p' AGENTS.md; fi" in /tmp/ethskills-evals-issue112/2026-09-11T170334Z-codex-no-skill-3/testing-quiz-003
 succeeded in 32ms:
total 20
drwxrwxr-x 5 damu damu 4096 Sep 11 14:17 .
drwxrwxr-x 3 damu damu 4096 Sep 11 14:03 ..
dr-xr-xr-x 2 damu damu   40 Sep 11 14:17 .agents
dr-xr-xr-x 2 damu damu   40 Sep 11 14:17 .codex
drwxrwxr-x 8 damu damu 4096 Sep 11 14:03 .git
-rw-rw-r-- 1 damu damu 1187 Sep 11 14:03 TASK.md
-rw-rw-r-- 1 damu damu   50 Sep 11 14:03 package.json

apply patch
patch: completed
/tmp/ethskills-evals-issue112/2026-09-11T170334Z-codex-no-skill-3/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a782d78798d8ff0280f4a5d4e99da2f1e9b36090
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,25 @@
+# Why the USDT deposit reverts
+
+The failing call is the raw `approve`, not the preceding transfer and most likely not `AavePool.supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 conventions. Its `approve` function does not return a Boolean value, even though `IERC20.approve` declares `returns (bool)`. Calling it through `IERC20` makes Solidity expect ABI-encoded return data. USDT executes the state change but returns no data, so Solidity's return-data decoding reverts the transaction without a reason string. Because the whole transaction is reverted, the approval state change is rolled back as well.
+
+The mock never exposes this problem because OpenZeppelin's stock `ERC20` is standards-conforming: its `approve` returns `true`. Matching USDT's six decimals only matches denomination; it does not reproduce USDT's non-standard call behavior. Repeating or expanding tests against that same conforming mock cannot reveal an incompatibility that the mock does not model.
+
+`using SafeERC20 for IERC20` does not automatically make every token call safe. It only adds the library's explicitly named extension methods. The first line calls `safeTransferFrom`, so `SafeERC20` performs a low-level call and accepts either `true` or empty return data. The second line calls `approve` directly, bypassing `SafeERC20`, so normal Solidity ABI return decoding is still used.
+
+USDT also requires an existing nonzero allowance to be set to zero before it can be changed to another nonzero value. The robust code fix, with a current OpenZeppelin version, is therefore:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and, when necessary, performs the zero-then-set allowance sequence required by USDT. With an older OpenZeppelin release that lacks `forceApprove`, the equivalent is to use `SafeERC20` calls to set the allowance to zero and then to `amount`; a raw `approve` must not be used.
+
+The testing fix is a mainnet-fork integration test pinned to a known block, using the actual USDT contract and the actual Aave V3 pool. Fund or impersonate a holder, call the vault's real deposit path, and assert the resulting Aave position. Unit tests should additionally include adversarial token doubles for common ERC-20 deviations—especially no-return tokens and zero-first approval tokens—but such mocks supplement rather than replace the fork test. A fork test would have exercised USDT's deployed bytecode and caught this exact failure before deployment.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a782d78798d8ff0280f4a5d4e99da2f1e9b36090
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,25 @@
+# Why the USDT deposit reverts
+
+The failing call is the raw `approve`, not the preceding transfer and most likely not `AavePool.supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 conventions. Its `approve` function does not return a Boolean value, even though `IERC20.approve` declares `returns (bool)`. Calling it through `IERC20` makes Solidity expect ABI-encoded return data. USDT executes the state change but returns no data, so Solidity's return-data decoding reverts the transaction without a reason string. Because the whole transaction is reverted, the approval state change is rolled back as well.
+
+The mock never exposes this problem because OpenZeppelin's stock `ERC20` is standards-conforming: its `approve` returns `true`. Matching USDT's six decimals only matches denomination; it does not reproduce USDT's non-standard call behavior. Repeating or expanding tests against that same conforming mock cannot reveal an incompatibility that the mock does not model.
+
+`using SafeERC20 for IERC20` does not automatically make every token call safe. It only adds the library's explicitly named extension methods. The first line calls `safeTransferFrom`, so `SafeERC20` performs a low-level call and accepts either `true` or empty return data. The second line calls `approve` directly, bypassing `SafeERC20`, so normal Solidity ABI return decoding is still used.
+
+USDT also requires an existing nonzero allowance to be set to zero before it can be changed to another nonzero value. The robust code fix, with a current OpenZeppelin version, is therefore:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and, when necessary, performs the zero-then-set allowance sequence required by USDT. With an older OpenZeppelin release that lacks `forceApprove`, the equivalent is to use `SafeERC20` calls to set the allowance to zero and then to `amount`; a raw `approve` must not be used.
+
+The testing fix is a mainnet-fork integration test pinned to a known block, using the actual USDT contract and the actual Aave V3 pool. Fund or impersonate a holder, call the vault's real deposit path, and assert the resulting Aave position. Unit tests should additionally include adversarial token doubles for common ERC-20 deviations—especially no-return tokens and zero-first approval tokens—but such mocks supplement rather than replace the fork test. A fork test would have exercised USDT's deployed bytecode and caught this exact failure before deployment.

exec
/bin/bash -lc "sed -n '1,240p' answer.md && git diff --check && git status --short" in /tmp/ethskills-evals-issue112/2026-09-11T170334Z-codex-no-skill-3/testing-quiz-003
 succeeded in 19ms:
# Why the USDT deposit reverts

The failing call is the raw `approve`, not the preceding transfer and most likely not `AavePool.supply`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT predates the modern ERC-20 conventions. Its `approve` function does not return a Boolean value, even though `IERC20.approve` declares `returns (bool)`. Calling it through `IERC20` makes Solidity expect ABI-encoded return data. USDT executes the state change but returns no data, so Solidity's return-data decoding reverts the transaction without a reason string. Because the whole transaction is reverted, the approval state change is rolled back as well.

The mock never exposes this problem because OpenZeppelin's stock `ERC20` is standards-conforming: its `approve` returns `true`. Matching USDT's six decimals only matches denomination; it does not reproduce USDT's non-standard call behavior. Repeating or expanding tests against that same conforming mock cannot reveal an incompatibility that the mock does not model.

`using SafeERC20 for IERC20` does not automatically make every token call safe. It only adds the library's explicitly named extension methods. The first line calls `safeTransferFrom`, so `SafeERC20` performs a low-level call and accepts either `true` or empty return data. The second line calls `approve` directly, bypassing `SafeERC20`, so normal Solidity ABI return decoding is still used.

USDT also requires an existing nonzero allowance to be set to zero before it can be changed to another nonzero value. The robust code fix, with a current OpenZeppelin version, is therefore:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` handles tokens that return no value and, when necessary, performs the zero-then-set allowance sequence required by USDT. With an older OpenZeppelin release that lacks `forceApprove`, the equivalent is to use `SafeERC20` calls to set the allowance to zero and then to `amount`; a raw `approve` must not be used.

The testing fix is a mainnet-fork integration test pinned to a known block, using the actual USDT contract and the actual Aave V3 pool. Fund or impersonate a holder, call the vault's real deposit path, and assert the resulting Aave position. Unit tests should additionally include adversarial token doubles for common ERC-20 deviations—especially no-return tokens and zero-first approval tokens—but such mocks supplement rather than replace the fork test. A fork test would have exercised USDT's deployed bytecode and caught this exact failure before deployment.
?? answer.md

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a782d78798d8ff0280f4a5d4e99da2f1e9b36090
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,25 @@
+# Why the USDT deposit reverts
+
+The failing call is the raw `approve`, not the preceding transfer and most likely not `AavePool.supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 conventions. Its `approve` function does not return a Boolean value, even though `IERC20.approve` declares `returns (bool)`. Calling it through `IERC20` makes Solidity expect ABI-encoded return data. USDT executes the state change but returns no data, so Solidity's return-data decoding reverts the transaction without a reason string. Because the whole transaction is reverted, the approval state change is rolled back as well.
+
+The mock never exposes this problem because OpenZeppelin's stock `ERC20` is standards-conforming: its `approve` returns `true`. Matching USDT's six decimals only matches denomination; it does not reproduce USDT's non-standard call behavior. Repeating or expanding tests against that same conforming mock cannot reveal an incompatibility that the mock does not model.
+
+`using SafeERC20 for IERC20` does not automatically make every token call safe. It only adds the library's explicitly named extension methods. The first line calls `safeTransferFrom`, so `SafeERC20` performs a low-level call and accepts either `true` or empty return data. The second line calls `approve` directly, bypassing `SafeERC20`, so normal Solidity ABI return decoding is still used.
+
+USDT also requires an existing nonzero allowance to be set to zero before it can be changed to another nonzero value. The robust code fix, with a current OpenZeppelin version, is therefore:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and, when necessary, performs the zero-then-set allowance sequence required by USDT. With an older OpenZeppelin release that lacks `forceApprove`, the equivalent is to use `SafeERC20` calls to set the allowance to zero and then to `amount`; a raw `approve` must not be used.
+
+The testing fix is a mainnet-fork integration test pinned to a known block, using the actual USDT contract and the actual Aave V3 pool. Fund or impersonate a holder, call the vault's real deposit path, and assert the resulting Aave position. Unit tests should additionally include adversarial token doubles for common ERC-20 deviations—especially no-return tokens and zero-first approval tokens—but such mocks supplement rather than replace the fork test. A fork test would have exercised USDT's deployed bytecode and caught this exact failure before deployment.

codex
Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-11T170334Z-codex-no-skill-3/testing-quiz-003/answer.md) with the diagnosis, `forceApprove` code fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..a782d78798d8ff0280f4a5d4e99da2f1e9b36090
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,25 @@
+# Why the USDT deposit reverts
+
+The failing call is the raw `approve`, not the preceding transfer and most likely not `AavePool.supply`:
+
+```solidity
+usdt.approve(address(aavePool), amount);
+```
+
+Mainnet USDT predates the modern ERC-20 conventions. Its `approve` function does not return a Boolean value, even though `IERC20.approve` declares `returns (bool)`. Calling it through `IERC20` makes Solidity expect ABI-encoded return data. USDT executes the state change but returns no data, so Solidity's return-data decoding reverts the transaction without a reason string. Because the whole transaction is reverted, the approval state change is rolled back as well.
+
+The mock never exposes this problem because OpenZeppelin's stock `ERC20` is standards-conforming: its `approve` returns `true`. Matching USDT's six decimals only matches denomination; it does not reproduce USDT's non-standard call behavior. Repeating or expanding tests against that same conforming mock cannot reveal an incompatibility that the mock does not model.
+
+`using SafeERC20 for IERC20` does not automatically make every token call safe. It only adds the library's explicitly named extension methods. The first line calls `safeTransferFrom`, so `SafeERC20` performs a low-level call and accepts either `true` or empty return data. The second line calls `approve` directly, bypassing `SafeERC20`, so normal Solidity ABI return decoding is still used.
+
+USDT also requires an existing nonzero allowance to be set to zero before it can be changed to another nonzero value. The robust code fix, with a current OpenZeppelin version, is therefore:
+
+```solidity
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` handles tokens that return no value and, when necessary, performs the zero-then-set allowance sequence required by USDT. With an older OpenZeppelin release that lacks `forceApprove`, the equivalent is to use `SafeERC20` calls to set the allowance to zero and then to `amount`; a raw `approve` must not be used.
+
+The testing fix is a mainnet-fork integration test pinned to a known block, using the actual USDT contract and the actual Aave V3 pool. Fund or impersonate a holder, call the vault's real deposit path, and assert the resulting Aave position. Unit tests should additionally include adversarial token doubles for common ERC-20 deviations—especially no-return tokens and zero-first approval tokens—but such mocks supplement rather than replace the fork test. A fork test would have exercised USDT's deployed bytecode and caught this exact failure before deployment.

tokens used
7,870
````

## final message

Created [answer.md](/tmp/ethskills-evals-issue112/2026-09-11T170334Z-codex-no-skill-3/testing-quiz-003/answer.md) with the diagnosis, `forceApprove` code fix, and mainnet-fork testing recommendation.
