# Executor transcript — 2026-08-31T211551Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-1/security-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-1/security-quiz-004
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059bf-e63c-7e02-a387-b8819e1c1a72
--------
user
Our treasury router on Ethereum mainnet pulls stablecoins in and forwards
them to a strategy contract, which it has to approve before each run. The
repo is on @openzeppelin/contracts v5 and Solidity 0.8.26.

The approval step is a low-level call, because an earlier version reverted
while decoding the return value of some tokens:

  (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
  require(ok, "approve failed");

Three weeks of runs:

  - USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48): every run succeeds
  - USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7): the FIRST run
    succeeded. Every run since reverts, always at that require, before any
    transfer happens
  - the strategy frequently spends less than it was approved for, so a
    leftover allowance from the previous run is normally still sitting there
  - the router holds enough ETH for gas, is not paused, is not on any
    blocklist, and the amounts are ordinary five-figure sums

Why does this fail only for USDT, and only after the first run? Give the
minimal change to the router that fixes it, and say what it should do about
the leftover allowance in general.

Write your answer to answer.md in this directory, showing your reasoning.

2026-08-31T21:35:43.929382Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059bf-e63c-7e02-a387-b8819e1c1a72.tmp-1788212143688885571: line 2547: syntax error near unexpected token `('

codex
I’m checking the workspace first, then I’ll write the root-cause analysis and minimal fix directly into `answer.md`.
exec
/bin/bash -lc 'rg --files' in /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-1/security-quiz-004
exec
/bin/bash -lc pwd in /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-1/security-quiz-004
 succeeded in 26ms:
/tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-1/security-quiz-004

 succeeded in 31ms:
TASK.md
package.json

codex
The repo is minimal. I found `TASK.md`; I’m reading it to confirm there aren’t any output constraints beyond writing `answer.md`.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-1/security-quiz-004
 succeeded in 18ms:
Our treasury router on Ethereum mainnet pulls stablecoins in and forwards
them to a strategy contract, which it has to approve before each run. The
repo is on @openzeppelin/contracts v5 and Solidity 0.8.26.

The approval step is a low-level call, because an earlier version reverted
while decoding the return value of some tokens:

  (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
  require(ok, "approve failed");

Three weeks of runs:

  - USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48): every run succeeds
  - USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7): the FIRST run
    succeeded. Every run since reverts, always at that require, before any
    transfer happens
  - the strategy frequently spends less than it was approved for, so a
    leftover allowance from the previous run is normally still sitting there
  - the router holds enough ETH for gas, is not paused, is not on any
    blocklist, and the amounts are ordinary five-figure sums

Why does this fail only for USDT, and only after the first run? Give the
minimal change to the router that fixes it, and say what it should do about
the leftover allowance in general.

Write your answer to answer.md in this directory, showing your reasoning.

exec
/bin/bash -lc "sed -n '1,220p' package.json" in /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-1/security-quiz-004
 succeeded in 10ms:
{
  "name": "eval-workspace",
  "private": true
}

codex
I’ve confirmed the task scope. I’m writing `answer.md` now with the concrete cause, the smallest safe fix for OZ v5, and the allowance-handling guidance.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-1/security-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..5ee726002e250dae798dc2fc9a10131b062316dd
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+USDT is the outlier because its `approve` behavior is non-standard: if the current allowance is non-zero, it does not allow changing it directly to another non-zero value. In practice, you must first set the allowance to `0`, then set the new value.
+
+That matches the run history exactly:
+
+1. The first USDT run succeeded because the router's allowance to the strategy started at `0`, so `approve(strategy, amount)` was allowed.
+2. The strategy then spent less than `amount`, leaving a non-zero leftover allowance.
+3. On the next run, the router again tried `approve(strategy, amount)` while the existing allowance was still non-zero.
+4. USDT rejects that transition, so the low-level call returns `ok == false`, and `require(ok, "approve failed")` reverts.
+
+USDC does not enforce that zero-first rule, so repeated non-zero-to-non-zero approvals keep working there.
+
+The minimal router change is to stop doing the raw low-level `approve` call and use OpenZeppelin v5's USDT-compatible helper:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+That is the smallest correct fix on `@openzeppelin/contracts` v5. `forceApprove` handles tokens like USDT by zeroing the allowance first when needed, then setting the requested value.
+
+If you want the equivalent logic spelled out, it is:
+
+```solidity
+IERC20 erc20 = IERC20(token);
+if (erc20.allowance(address(this), strategy) != 0) {
+    erc20.approve(strategy, 0);
+}
+erc20.approve(strategy, amount);
+```
+
+But on OZ v5, `forceApprove` is the better minimal change because it already encapsulates this compatibility behavior safely.
+
+About leftover allowance in general: do not assume you can overwrite a leftover non-zero allowance with another non-zero allowance on every token. The router should treat leftover allowance as state that must be reconciled before setting a new approval. In practice, that means either:
+
+- always use `forceApprove(strategy, amount)` before the run, or
+- explicitly zero the allowance before setting a new one.
+
+If the intended security model is "approve exactly what this run may spend," then leftover allowance should not be left sitting around indefinitely; it should be reset to `0` after the strategy is done, or the next approval path must always normalize it first. The key point is that leftover allowance is not harmless bookkeeping for USDT-like tokens: it directly causes the next non-zero approval to fail.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..5ee726002e250dae798dc2fc9a10131b062316dd
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+USDT is the outlier because its `approve` behavior is non-standard: if the current allowance is non-zero, it does not allow changing it directly to another non-zero value. In practice, you must first set the allowance to `0`, then set the new value.
+
+That matches the run history exactly:
+
+1. The first USDT run succeeded because the router's allowance to the strategy started at `0`, so `approve(strategy, amount)` was allowed.
+2. The strategy then spent less than `amount`, leaving a non-zero leftover allowance.
+3. On the next run, the router again tried `approve(strategy, amount)` while the existing allowance was still non-zero.
+4. USDT rejects that transition, so the low-level call returns `ok == false`, and `require(ok, "approve failed")` reverts.
+
+USDC does not enforce that zero-first rule, so repeated non-zero-to-non-zero approvals keep working there.
+
+The minimal router change is to stop doing the raw low-level `approve` call and use OpenZeppelin v5's USDT-compatible helper:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+That is the smallest correct fix on `@openzeppelin/contracts` v5. `forceApprove` handles tokens like USDT by zeroing the allowance first when needed, then setting the requested value.
+
+If you want the equivalent logic spelled out, it is:
+
+```solidity
+IERC20 erc20 = IERC20(token);
+if (erc20.allowance(address(this), strategy) != 0) {
+    erc20.approve(strategy, 0);
+}
+erc20.approve(strategy, amount);
+```
+
+But on OZ v5, `forceApprove` is the better minimal change because it already encapsulates this compatibility behavior safely.
+
+About leftover allowance in general: do not assume you can overwrite a leftover non-zero allowance with another non-zero allowance on every token. The router should treat leftover allowance as state that must be reconciled before setting a new approval. In practice, that means either:
+
+- always use `forceApprove(strategy, amount)` before the run, or
+- explicitly zero the allowance before setting a new one.
+
+If the intended security model is "approve exactly what this run may spend," then leftover allowance should not be left sitting around indefinitely; it should be reset to `0` after the strategy is done, or the next approval path must always normalize it first. The key point is that leftover allowance is not harmless bookkeeping for USDT-like tokens: it directly causes the next non-zero approval to fail.

codex
`answer.md` is in place. I’m doing a quick readback to make sure the wording is tight and the fix is exactly aligned with OZ v5.
exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-1/security-quiz-004
 succeeded in 16ms:
USDT is the outlier because its `approve` behavior is non-standard: if the current allowance is non-zero, it does not allow changing it directly to another non-zero value. In practice, you must first set the allowance to `0`, then set the new value.

That matches the run history exactly:

1. The first USDT run succeeded because the router's allowance to the strategy started at `0`, so `approve(strategy, amount)` was allowed.
2. The strategy then spent less than `amount`, leaving a non-zero leftover allowance.
3. On the next run, the router again tried `approve(strategy, amount)` while the existing allowance was still non-zero.
4. USDT rejects that transition, so the low-level call returns `ok == false`, and `require(ok, "approve failed")` reverts.

USDC does not enforce that zero-first rule, so repeated non-zero-to-non-zero approvals keep working there.

The minimal router change is to stop doing the raw low-level `approve` call and use OpenZeppelin v5's USDT-compatible helper:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

That is the smallest correct fix on `@openzeppelin/contracts` v5. `forceApprove` handles tokens like USDT by zeroing the allowance first when needed, then setting the requested value.

If you want the equivalent logic spelled out, it is:

```solidity
IERC20 erc20 = IERC20(token);
if (erc20.allowance(address(this), strategy) != 0) {
    erc20.approve(strategy, 0);
}
erc20.approve(strategy, amount);
```

But on OZ v5, `forceApprove` is the better minimal change because it already encapsulates this compatibility behavior safely.

About leftover allowance in general: do not assume you can overwrite a leftover non-zero allowance with another non-zero allowance on every token. The router should treat leftover allowance as state that must be reconciled before setting a new approval. In practice, that means either:

- always use `forceApprove(strategy, amount)` before the run, or
- explicitly zero the allowance before setting a new one.

If the intended security model is "approve exactly what this run may spend," then leftover allowance should not be left sitting around indefinitely; it should be reset to `0` after the strategy is done, or the next approval path must always normalize it first. The key point is that leftover allowance is not harmless bookkeeping for USDT-like tokens: it directly causes the next non-zero approval to fail.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..5ee726002e250dae798dc2fc9a10131b062316dd
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+USDT is the outlier because its `approve` behavior is non-standard: if the current allowance is non-zero, it does not allow changing it directly to another non-zero value. In practice, you must first set the allowance to `0`, then set the new value.
+
+That matches the run history exactly:
+
+1. The first USDT run succeeded because the router's allowance to the strategy started at `0`, so `approve(strategy, amount)` was allowed.
+2. The strategy then spent less than `amount`, leaving a non-zero leftover allowance.
+3. On the next run, the router again tried `approve(strategy, amount)` while the existing allowance was still non-zero.
+4. USDT rejects that transition, so the low-level call returns `ok == false`, and `require(ok, "approve failed")` reverts.
+
+USDC does not enforce that zero-first rule, so repeated non-zero-to-non-zero approvals keep working there.
+
+The minimal router change is to stop doing the raw low-level `approve` call and use OpenZeppelin v5's USDT-compatible helper:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+That is the smallest correct fix on `@openzeppelin/contracts` v5. `forceApprove` handles tokens like USDT by zeroing the allowance first when needed, then setting the requested value.
+
+If you want the equivalent logic spelled out, it is:
+
+```solidity
+IERC20 erc20 = IERC20(token);
+if (erc20.allowance(address(this), strategy) != 0) {
+    erc20.approve(strategy, 0);
+}
+erc20.approve(strategy, amount);
+```
+
+But on OZ v5, `forceApprove` is the better minimal change because it already encapsulates this compatibility behavior safely.
+
+About leftover allowance in general: do not assume you can overwrite a leftover non-zero allowance with another non-zero allowance on every token. The router should treat leftover allowance as state that must be reconciled before setting a new approval. In practice, that means either:
+
+- always use `forceApprove(strategy, amount)` before the run, or
+- explicitly zero the allowance before setting a new one.
+
+If the intended security model is "approve exactly what this run may spend," then leftover allowance should not be left sitting around indefinitely; it should be reset to `0` after the strategy is done, or the next approval path must always normalize it first. The key point is that leftover allowance is not harmless bookkeeping for USDT-like tokens: it directly causes the next non-zero approval to fail.

codex
Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-1/security-quiz-004/answer.md).

Core point: USDT requires a zero-first allowance update, so the first run works from `0`, then later runs fail because leftover allowance makes the next approval a non-zero-to-non-zero change. The minimal OZ v5 fix in the writeup is `SafeERC20.forceApprove(...)`, with guidance to always normalize or clear leftover allowance rather than assuming it can be overwritten.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..5ee726002e250dae798dc2fc9a10131b062316dd
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,39 @@
+USDT is the outlier because its `approve` behavior is non-standard: if the current allowance is non-zero, it does not allow changing it directly to another non-zero value. In practice, you must first set the allowance to `0`, then set the new value.
+
+That matches the run history exactly:
+
+1. The first USDT run succeeded because the router's allowance to the strategy started at `0`, so `approve(strategy, amount)` was allowed.
+2. The strategy then spent less than `amount`, leaving a non-zero leftover allowance.
+3. On the next run, the router again tried `approve(strategy, amount)` while the existing allowance was still non-zero.
+4. USDT rejects that transition, so the low-level call returns `ok == false`, and `require(ok, "approve failed")` reverts.
+
+USDC does not enforce that zero-first rule, so repeated non-zero-to-non-zero approvals keep working there.
+
+The minimal router change is to stop doing the raw low-level `approve` call and use OpenZeppelin v5's USDT-compatible helper:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+That is the smallest correct fix on `@openzeppelin/contracts` v5. `forceApprove` handles tokens like USDT by zeroing the allowance first when needed, then setting the requested value.
+
+If you want the equivalent logic spelled out, it is:
+
+```solidity
+IERC20 erc20 = IERC20(token);
+if (erc20.allowance(address(this), strategy) != 0) {
+    erc20.approve(strategy, 0);
+}
+erc20.approve(strategy, amount);
+```
+
+But on OZ v5, `forceApprove` is the better minimal change because it already encapsulates this compatibility behavior safely.
+
+About leftover allowance in general: do not assume you can overwrite a leftover non-zero allowance with another non-zero allowance on every token. The router should treat leftover allowance as state that must be reconciled before setting a new approval. In practice, that means either:
+
+- always use `forceApprove(strategy, amount)` before the run, or
+- explicitly zero the allowance before setting a new one.
+
+If the intended security model is "approve exactly what this run may spend," then leftover allowance should not be left sitting around indefinitely; it should be reset to `0` after the strategy is done, or the next approval path must always normalize it first. The key point is that leftover allowance is not harmless bookkeeping for USDT-like tokens: it directly causes the next non-zero approval to fail.

tokens used
11,612
````

## final message

Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-1/security-quiz-004/answer.md).

Core point: USDT requires a zero-first allowance update, so the first run works from `0`, then later runs fail because leftover allowance makes the next approval a non-zero-to-non-zero change. The minimal OZ v5 fix in the writeup is `SafeERC20.forceApprove(...)`, with guidance to always normalize or clear leftover allowance rather than assuming it can be overwritten.
