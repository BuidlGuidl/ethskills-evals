# Executor transcript — 2026-09-04T125932Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-2/security-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-2/security-quiz-004
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06c8b-45ad-7432-90ef-70091425184a
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

codex
I’m checking the workspace layout first, then I’ll write the answer directly into `answer.md` with the reasoning and the minimal fix.
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-2/security-quiz-004
 succeeded in 4ms:
/home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-2/security-quiz-004

exec
/bin/bash -lc 'rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-2/security-quiz-004
 succeeded in 3ms:
TASK.md
package.json

codex
The repo is minimal. I’m reading the task file to confirm there aren’t any extra output constraints before I write `answer.md`.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-2/security-quiz-004
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
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

codex
I’ve confirmed the failure mode. I’m writing the answer now: the fix is the USDT-specific allowance reset pattern, and I’ll tie it back to the OpenZeppelin v5 helper that already encodes it.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-2/security-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..ca46a5db566cccaa649af531a7a30a7d31744add
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,48 @@
+USDT is the outlier because it does **not** reliably allow changing an existing
+non-zero allowance directly to another non-zero allowance. Its `approve`
+behavior follows the old "set to zero first, then set the new value" pattern.
+
+That matches the run history exactly:
+
+1. On the first run, the router's allowance to `strategy` was presumably `0`, so
+   `approve(strategy, amount)` succeeded.
+2. The strategy often spends less than approved, so a leftover allowance remains
+   non-zero after the run.
+3. On the next run, the router again tries to set a new non-zero allowance while
+   the current allowance is still non-zero.
+4. USDT rejects that approval change, so the low-level call returns `ok == false`
+   and the router reverts at `require(ok, "approve failed")`.
+
+USDC does not enforce that zero-first rule, so repeated runs keep working there.
+
+The minimal router change is to zero the allowance before setting the new one
+when refreshing approval. With OpenZeppelin Contracts v5, the cleanest version
+is to use `SafeERC20.forceApprove`, which already handles this pattern:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+Equivalent low-level logic would be:
+
+```solidity
+(bool ok0, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok0, "approve reset failed");
+
+(bool ok1, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok1, "approve failed");
+```
+
+About leftover allowance in general: the router should **not assume** the
+previous run consumed the full approval. Any future approval refresh must handle
+residual allowance safely. The usual options are:
+
+- always use `forceApprove(strategy, amount)` before each run, or
+- explicitly clear allowance back to `0` after the strategy has finished if the
+  design wants to avoid leaving standing approval behind.
+
+If the goal is least privilege, clearing the leftover allowance back to zero
+after the run is better. But the minimal fix for the current bug is the
+zero-first approval refresh.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..ca46a5db566cccaa649af531a7a30a7d31744add
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,48 @@
+USDT is the outlier because it does **not** reliably allow changing an existing
+non-zero allowance directly to another non-zero allowance. Its `approve`
+behavior follows the old "set to zero first, then set the new value" pattern.
+
+That matches the run history exactly:
+
+1. On the first run, the router's allowance to `strategy` was presumably `0`, so
+   `approve(strategy, amount)` succeeded.
+2. The strategy often spends less than approved, so a leftover allowance remains
+   non-zero after the run.
+3. On the next run, the router again tries to set a new non-zero allowance while
+   the current allowance is still non-zero.
+4. USDT rejects that approval change, so the low-level call returns `ok == false`
+   and the router reverts at `require(ok, "approve failed")`.
+
+USDC does not enforce that zero-first rule, so repeated runs keep working there.
+
+The minimal router change is to zero the allowance before setting the new one
+when refreshing approval. With OpenZeppelin Contracts v5, the cleanest version
+is to use `SafeERC20.forceApprove`, which already handles this pattern:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+Equivalent low-level logic would be:
+
+```solidity
+(bool ok0, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok0, "approve reset failed");
+
+(bool ok1, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok1, "approve failed");
+```
+
+About leftover allowance in general: the router should **not assume** the
+previous run consumed the full approval. Any future approval refresh must handle
+residual allowance safely. The usual options are:
+
+- always use `forceApprove(strategy, amount)` before each run, or
+- explicitly clear allowance back to `0` after the strategy has finished if the
+  design wants to avoid leaving standing approval behind.
+
+If the goal is least privilege, clearing the leftover allowance back to zero
+after the run is better. But the minimal fix for the current bug is the
+zero-first approval refresh.

codex
Wrote the answer to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-2/security-quiz-004/answer.md).

Core point: USDT follows the zero-first allowance reset rule, so the first `approve` from `0` works, later non-zero to non-zero updates fail when leftover allowance remains. The minimal fix is to replace the raw approval with `SafeERC20.forceApprove(...)`, or equivalently `approve(0)` before `approve(amount)`.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..ca46a5db566cccaa649af531a7a30a7d31744add
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,48 @@
+USDT is the outlier because it does **not** reliably allow changing an existing
+non-zero allowance directly to another non-zero allowance. Its `approve`
+behavior follows the old "set to zero first, then set the new value" pattern.
+
+That matches the run history exactly:
+
+1. On the first run, the router's allowance to `strategy` was presumably `0`, so
+   `approve(strategy, amount)` succeeded.
+2. The strategy often spends less than approved, so a leftover allowance remains
+   non-zero after the run.
+3. On the next run, the router again tries to set a new non-zero allowance while
+   the current allowance is still non-zero.
+4. USDT rejects that approval change, so the low-level call returns `ok == false`
+   and the router reverts at `require(ok, "approve failed")`.
+
+USDC does not enforce that zero-first rule, so repeated runs keep working there.
+
+The minimal router change is to zero the allowance before setting the new one
+when refreshing approval. With OpenZeppelin Contracts v5, the cleanest version
+is to use `SafeERC20.forceApprove`, which already handles this pattern:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+Equivalent low-level logic would be:
+
+```solidity
+(bool ok0, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok0, "approve reset failed");
+
+(bool ok1, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok1, "approve failed");
+```
+
+About leftover allowance in general: the router should **not assume** the
+previous run consumed the full approval. Any future approval refresh must handle
+residual allowance safely. The usual options are:
+
+- always use `forceApprove(strategy, amount)` before each run, or
+- explicitly clear allowance back to `0` after the strategy has finished if the
+  design wants to avoid leaving standing approval behind.
+
+If the goal is least privilege, clearing the leftover allowance back to zero
+after the run is better. But the minimal fix for the current bug is the
+zero-first approval refresh.

tokens used
9,341
````

## final message

Wrote the answer to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-2/security-quiz-004/answer.md).

Core point: USDT follows the zero-first allowance reset rule, so the first `approve` from `0` works, later non-zero to non-zero updates fail when leftover allowance remains. The minimal fix is to replace the raw approval with `SafeERC20.forceApprove(...)`, or equivalently `approve(0)` before `approve(amount)`.
