# Executor transcript — 2026-09-13T152605Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-testing-patched-20260913/2026-09-13T152605Z-codex-no-skill-1/testing-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-testing-patched-20260913/2026-09-13T152605Z-codex-no-skill-1/testing-quiz-003
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a09b73-a76c-7f33-90b9-49acb8ac4bdd
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
I’ll write a concise root-cause analysis and include the robust token-call fix plus a mainnet-fork integration test recommendation.
apply patch
patch: completed
/tmp/ethskills-testing-patched-20260913/2026-09-13T152605Z-codex-no-skill-1/testing-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cd5dddfab277d70526e106838fe4333569d2ed5c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,29 @@
+# Root cause
+
+The revert occurs at `usdt.approve(address(aavePool), amount)`, before `supply` is reached.
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` call succeeds at the token-contract level but returns no value. By contrast, OpenZeppelin's `IERC20.approve` declaration says that the call returns a `bool`. A normal Solidity interface call therefore tries to ABI-decode a Boolean from USDT's empty return data. That decoding fails and the caller reverts, commonly without a useful reason string.
+
+The transfer works because it is invoked through `safeTransferFrom`. `SafeERC20` deliberately accepts either a returned `true` or no return data, which supports tokens such as USDT. The approval does **not** receive that protection: `using SafeERC20 for IERC20` only makes the library's methods available; it does not intercept or rewrite direct calls to `IERC20.approve`. The code calls the token's `approve` method, not a `SafeERC20` method.
+
+The OpenZeppelin mock follows the modern ERC-20 ABI and returns `true` from `approve`, so the decode always succeeds. Its six decimals are irrelevant to this failure. Repeating tests against that same compliant implementation cannot reveal behavior that the mock does not model; green unit tests here establish compatibility with the mock, not with every deployed contract that is commonly treated as an ERC-20.
+
+# Code fix
+
+Use `SafeERC20.forceApprove` (on a current OpenZeppelin version):
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return handling and also supports tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This makes it preferable to replacing the line with another raw `approve`. If the project uses an older OpenZeppelin release without `forceApprove`, upgrade it or implement the equivalent with SafeERC20-compatible optional-return calls: try the desired approval, and on failure approve zero before approving the desired value.
+
+# Testing-practice fix
+
+Add a pinned mainnet-fork integration test that impersonates/funds a USDT holder and executes the complete deposit against the **actual mainnet USDT contract and actual Aave V3 pool**. Assert both that the deposit succeeds and that Aave receives/accounts for the supplied assets. Keep the fast mock unit suite, but do not use it as the compatibility test for production token and protocol contracts.
+
+It is also useful to add adversarial token fixtures—especially an ERC-20 that returns no data and one that enforces zero-first approvals—but those are simulations. The fork test is what would have exercised USDT's real return-data behavior, Aave's real allowance pull, and the exact deployed integration before mainnet.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cd5dddfab277d70526e106838fe4333569d2ed5c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,29 @@
+# Root cause
+
+The revert occurs at `usdt.approve(address(aavePool), amount)`, before `supply` is reached.
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` call succeeds at the token-contract level but returns no value. By contrast, OpenZeppelin's `IERC20.approve` declaration says that the call returns a `bool`. A normal Solidity interface call therefore tries to ABI-decode a Boolean from USDT's empty return data. That decoding fails and the caller reverts, commonly without a useful reason string.
+
+The transfer works because it is invoked through `safeTransferFrom`. `SafeERC20` deliberately accepts either a returned `true` or no return data, which supports tokens such as USDT. The approval does **not** receive that protection: `using SafeERC20 for IERC20` only makes the library's methods available; it does not intercept or rewrite direct calls to `IERC20.approve`. The code calls the token's `approve` method, not a `SafeERC20` method.
+
+The OpenZeppelin mock follows the modern ERC-20 ABI and returns `true` from `approve`, so the decode always succeeds. Its six decimals are irrelevant to this failure. Repeating tests against that same compliant implementation cannot reveal behavior that the mock does not model; green unit tests here establish compatibility with the mock, not with every deployed contract that is commonly treated as an ERC-20.
+
+# Code fix
+
+Use `SafeERC20.forceApprove` (on a current OpenZeppelin version):
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return handling and also supports tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This makes it preferable to replacing the line with another raw `approve`. If the project uses an older OpenZeppelin release without `forceApprove`, upgrade it or implement the equivalent with SafeERC20-compatible optional-return calls: try the desired approval, and on failure approve zero before approving the desired value.
+
+# Testing-practice fix
+
+Add a pinned mainnet-fork integration test that impersonates/funds a USDT holder and executes the complete deposit against the **actual mainnet USDT contract and actual Aave V3 pool**. Assert both that the deposit succeeds and that Aave receives/accounts for the supplied assets. Keep the fast mock unit suite, but do not use it as the compatibility test for production token and protocol contracts.
+
+It is also useful to add adversarial token fixtures—especially an ERC-20 that returns no data and one that enforces zero-first approvals—but those are simulations. The fork test is what would have exercised USDT's real return-data behavior, Aave's real allowance pull, and the exact deployed integration before mainnet.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /tmp/ethskills-testing-patched-20260913/2026-09-13T152605Z-codex-no-skill-1/testing-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Root cause

The revert occurs at `usdt.approve(address(aavePool), amount)`, before `supply` is reached.

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` call succeeds at the token-contract level but returns no value. By contrast, OpenZeppelin's `IERC20.approve` declaration says that the call returns a `bool`. A normal Solidity interface call therefore tries to ABI-decode a Boolean from USDT's empty return data. That decoding fails and the caller reverts, commonly without a useful reason string.

The transfer works because it is invoked through `safeTransferFrom`. `SafeERC20` deliberately accepts either a returned `true` or no return data, which supports tokens such as USDT. The approval does **not** receive that protection: `using SafeERC20 for IERC20` only makes the library's methods available; it does not intercept or rewrite direct calls to `IERC20.approve`. The code calls the token's `approve` method, not a `SafeERC20` method.

The OpenZeppelin mock follows the modern ERC-20 ABI and returns `true` from `approve`, so the decode always succeeds. Its six decimals are irrelevant to this failure. Repeating tests against that same compliant implementation cannot reveal behavior that the mock does not model; green unit tests here establish compatibility with the mock, not with every deployed contract that is commonly treated as an ERC-20.

# Code fix

Use `SafeERC20.forceApprove` (on a current OpenZeppelin version):

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` uses optional-return handling and also supports tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This makes it preferable to replacing the line with another raw `approve`. If the project uses an older OpenZeppelin release without `forceApprove`, upgrade it or implement the equivalent with SafeERC20-compatible optional-return calls: try the desired approval, and on failure approve zero before approving the desired value.

# Testing-practice fix

Add a pinned mainnet-fork integration test that impersonates/funds a USDT holder and executes the complete deposit against the **actual mainnet USDT contract and actual Aave V3 pool**. Assert both that the deposit succeeds and that Aave receives/accounts for the supplied assets. Keep the fast mock unit suite, but do not use it as the compatibility test for production token and protocol contracts.

It is also useful to add adversarial token fixtures—especially an ERC-20 that returns no data and one that enforces zero-first approvals—but those are simulations. The fork test is what would have exercised USDT's real return-data behavior, Aave's real allowance pull, and the exact deployed integration before mainnet.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cd5dddfab277d70526e106838fe4333569d2ed5c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,29 @@
+# Root cause
+
+The revert occurs at `usdt.approve(address(aavePool), amount)`, before `supply` is reached.
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` call succeeds at the token-contract level but returns no value. By contrast, OpenZeppelin's `IERC20.approve` declaration says that the call returns a `bool`. A normal Solidity interface call therefore tries to ABI-decode a Boolean from USDT's empty return data. That decoding fails and the caller reverts, commonly without a useful reason string.
+
+The transfer works because it is invoked through `safeTransferFrom`. `SafeERC20` deliberately accepts either a returned `true` or no return data, which supports tokens such as USDT. The approval does **not** receive that protection: `using SafeERC20 for IERC20` only makes the library's methods available; it does not intercept or rewrite direct calls to `IERC20.approve`. The code calls the token's `approve` method, not a `SafeERC20` method.
+
+The OpenZeppelin mock follows the modern ERC-20 ABI and returns `true` from `approve`, so the decode always succeeds. Its six decimals are irrelevant to this failure. Repeating tests against that same compliant implementation cannot reveal behavior that the mock does not model; green unit tests here establish compatibility with the mock, not with every deployed contract that is commonly treated as an ERC-20.
+
+# Code fix
+
+Use `SafeERC20.forceApprove` (on a current OpenZeppelin version):
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return handling and also supports tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This makes it preferable to replacing the line with another raw `approve`. If the project uses an older OpenZeppelin release without `forceApprove`, upgrade it or implement the equivalent with SafeERC20-compatible optional-return calls: try the desired approval, and on failure approve zero before approving the desired value.
+
+# Testing-practice fix
+
+Add a pinned mainnet-fork integration test that impersonates/funds a USDT holder and executes the complete deposit against the **actual mainnet USDT contract and actual Aave V3 pool**. Assert both that the deposit succeeds and that Aave receives/accounts for the supplied assets. Keep the fast mock unit suite, but do not use it as the compatibility test for production token and protocol contracts.
+
+It is also useful to add adversarial token fixtures—especially an ERC-20 that returns no data and one that enforces zero-first approvals—but those are simulations. The fork test is what would have exercised USDT's real return-data behavior, Aave's real allowance pull, and the exact deployed integration before mainnet.

codex
Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152605Z-codex-no-skill-1/testing-quiz-003/answer.md) with the root cause, `forceApprove` code fix, and mainnet-fork testing recommendation.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cd5dddfab277d70526e106838fe4333569d2ed5c
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,29 @@
+# Root cause
+
+The revert occurs at `usdt.approve(address(aavePool), amount)`, before `supply` is reached.
+
+Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` call succeeds at the token-contract level but returns no value. By contrast, OpenZeppelin's `IERC20.approve` declaration says that the call returns a `bool`. A normal Solidity interface call therefore tries to ABI-decode a Boolean from USDT's empty return data. That decoding fails and the caller reverts, commonly without a useful reason string.
+
+The transfer works because it is invoked through `safeTransferFrom`. `SafeERC20` deliberately accepts either a returned `true` or no return data, which supports tokens such as USDT. The approval does **not** receive that protection: `using SafeERC20 for IERC20` only makes the library's methods available; it does not intercept or rewrite direct calls to `IERC20.approve`. The code calls the token's `approve` method, not a `SafeERC20` method.
+
+The OpenZeppelin mock follows the modern ERC-20 ABI and returns `true` from `approve`, so the decode always succeeds. Its six decimals are irrelevant to this failure. Repeating tests against that same compliant implementation cannot reveal behavior that the mock does not model; green unit tests here establish compatibility with the mock, not with every deployed contract that is commonly treated as an ERC-20.
+
+# Code fix
+
+Use `SafeERC20.forceApprove` (on a current OpenZeppelin version):
+
+```solidity
+using SafeERC20 for IERC20;
+
+usdt.safeTransferFrom(msg.sender, address(this), amount);
+usdt.forceApprove(address(aavePool), amount);
+aavePool.supply(address(usdt), amount, address(this), 0);
+```
+
+`forceApprove` uses optional-return handling and also supports tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This makes it preferable to replacing the line with another raw `approve`. If the project uses an older OpenZeppelin release without `forceApprove`, upgrade it or implement the equivalent with SafeERC20-compatible optional-return calls: try the desired approval, and on failure approve zero before approving the desired value.
+
+# Testing-practice fix
+
+Add a pinned mainnet-fork integration test that impersonates/funds a USDT holder and executes the complete deposit against the **actual mainnet USDT contract and actual Aave V3 pool**. Assert both that the deposit succeeds and that Aave receives/accounts for the supplied assets. Keep the fast mock unit suite, but do not use it as the compatibility test for production token and protocol contracts.
+
+It is also useful to add adversarial token fixtures—especially an ERC-20 that returns no data and one that enforces zero-first approvals—but those are simulations. The fork test is what would have exercised USDT's real return-data behavior, Aave's real allowance pull, and the exact deployed integration before mainnet.

tokens used
7,394
````

## final message

Created [answer.md](/tmp/ethskills-testing-patched-20260913/2026-09-13T152605Z-codex-no-skill-1/testing-quiz-003/answer.md) with the root cause, `forceApprove` code fix, and mainnet-fork testing recommendation.
