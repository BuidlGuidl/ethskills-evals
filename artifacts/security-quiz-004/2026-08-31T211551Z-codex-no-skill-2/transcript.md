# Executor transcript — 2026-08-31T211551Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-2/security-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-2/security-quiz-004
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059c0-22be-77f1-96a5-613b8dded5e5
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

2026-08-31T21:35:59.418830Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059c0-22be-77f1-96a5-613b8dded5e5.tmp-1788212159179522144: line 2547: syntax error near unexpected token `('

codex
I’m checking the workspace first to see what’s already here and then I’ll write the answer into `answer.md` with the minimal fix and the underlying cause.
exec
/bin/bash -lc pwd in /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-2/security-quiz-004
exec
/bin/bash -lc 'rg --files' in /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-2/security-quiz-004
 succeeded in 18ms:
/tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-2/security-quiz-004

 succeeded in 19ms:
TASK.md
package.json

codex
The workspace is minimal. I’m reading the task file now, then I’ll create `answer.md` directly with the fix and the reasoning chain.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-2/security-quiz-004
 succeeded in 19ms:
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
/bin/bash -lc "sed -n '1,220p' package.json" in /tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-2/security-quiz-004
 succeeded in 13ms:
{
  "name": "eval-workspace",
  "private": true
}

codex
I’ve confirmed the issue pattern: this is the classic USDT nonzero-to-nonzero approval behavior. I’m writing the answer file now, including the minimal router change and the allowance policy implication.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-2/security-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..d4e6e488dbc82b3221ea814768cd6688afdcab67
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,61 @@
+The failure is specific to USDT because USDT does not behave like a standard ERC-20 on `approve`.
+
+Reasoning:
+
+1. On the first run, the router's allowance to the strategy was presumably `0`, so
+   `approve(strategy, amount)` succeeded.
+2. The strategy often spends less than the approved amount, so after that first run the
+   router still has a nonzero leftover allowance for the strategy.
+3. On later runs, the router tries to call `approve(strategy, newAmount)` again while the
+   current allowance is still nonzero.
+4. USDT is one of the tokens that rejects changing an allowance directly from nonzero to
+   nonzero. It requires the allowance to be set to `0` first, then set to the new value.
+5. Because the router is using a low-level `call`, it is no longer failing on return-value
+   decoding, but it still correctly sees that the token call itself reverted or returned
+   failure, so `ok == false` and `require(ok, "approve failed")` trips.
+6. USDC does not enforce this zero-first rule, so repeated approvals keep working there.
+
+That matches the observed behavior exactly: first USDT run succeeds, every later run fails,
+and it fails before transfers because the failure is at the approval step.
+
+Minimal router change:
+
+If you want the smallest direct fix around the current pattern, zero the allowance before
+setting the new one whenever the current allowance is nonzero.
+
+```solidity
+(bool ok0, bytes memory data0) =
+    token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok0 && (data0.length == 0 || abi.decode(data0, (bool))), "approve reset failed");
+
+(bool ok1, bytes memory data1) =
+    token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok1 && (data1.length == 0 || abi.decode(data1, (bool))), "approve failed");
+```
+
+If you want the OpenZeppelin v5 version of the same fix, use `SafeERC20.forceApprove`,
+which exists specifically for tokens like USDT:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+That is the better minimal change in this codebase because it preserves compatibility with
+non-standard tokens without relying on the raw call workaround.
+
+What to do about leftover allowance in general:
+
+Do not assume you can overwrite a leftover nonzero allowance with another nonzero allowance.
+In general, the router should either:
+
+- always use a zero-first approval flow when resetting allowances, or
+- use `SafeERC20.forceApprove`, which handles that for you.
+
+Operationally, leftover allowance should be treated as normal and expected. The code that
+refreshes approval must handle it safely. If the design wants tighter approval hygiene, the
+router can also clear the allowance back to zero after the strategy pull completes, but that
+is a policy choice, not the minimal fix. The essential requirement is: when a leftover
+allowance may exist, approval refresh logic must support tokens that require `0 -> N` rather
+than `N -> M`.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..d4e6e488dbc82b3221ea814768cd6688afdcab67
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,61 @@
+The failure is specific to USDT because USDT does not behave like a standard ERC-20 on `approve`.
+
+Reasoning:
+
+1. On the first run, the router's allowance to the strategy was presumably `0`, so
+   `approve(strategy, amount)` succeeded.
+2. The strategy often spends less than the approved amount, so after that first run the
+   router still has a nonzero leftover allowance for the strategy.
+3. On later runs, the router tries to call `approve(strategy, newAmount)` again while the
+   current allowance is still nonzero.
+4. USDT is one of the tokens that rejects changing an allowance directly from nonzero to
+   nonzero. It requires the allowance to be set to `0` first, then set to the new value.
+5. Because the router is using a low-level `call`, it is no longer failing on return-value
+   decoding, but it still correctly sees that the token call itself reverted or returned
+   failure, so `ok == false` and `require(ok, "approve failed")` trips.
+6. USDC does not enforce this zero-first rule, so repeated approvals keep working there.
+
+That matches the observed behavior exactly: first USDT run succeeds, every later run fails,
+and it fails before transfers because the failure is at the approval step.
+
+Minimal router change:
+
+If you want the smallest direct fix around the current pattern, zero the allowance before
+setting the new one whenever the current allowance is nonzero.
+
+```solidity
+(bool ok0, bytes memory data0) =
+    token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok0 && (data0.length == 0 || abi.decode(data0, (bool))), "approve reset failed");
+
+(bool ok1, bytes memory data1) =
+    token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok1 && (data1.length == 0 || abi.decode(data1, (bool))), "approve failed");
+```
+
+If you want the OpenZeppelin v5 version of the same fix, use `SafeERC20.forceApprove`,
+which exists specifically for tokens like USDT:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+That is the better minimal change in this codebase because it preserves compatibility with
+non-standard tokens without relying on the raw call workaround.
+
+What to do about leftover allowance in general:
+
+Do not assume you can overwrite a leftover nonzero allowance with another nonzero allowance.
+In general, the router should either:
+
+- always use a zero-first approval flow when resetting allowances, or
+- use `SafeERC20.forceApprove`, which handles that for you.
+
+Operationally, leftover allowance should be treated as normal and expected. The code that
+refreshes approval must handle it safely. If the design wants tighter approval hygiene, the
+router can also clear the allowance back to zero after the strategy pull completes, but that
+is a policy choice, not the minimal fix. The essential requirement is: when a leftover
+allowance may exist, approval refresh logic must support tokens that require `0 -> N` rather
+than `N -> M`.

codex
Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-2/security-quiz-004/answer.md).

Core point: USDT rejects `approve` when changing allowance from nonzero to nonzero, so the first `0 -> amount` succeeds and later runs fail because leftover allowance remains. The minimal fix is to use a zero-first approval flow, preferably `SafeERC20.forceApprove` from OpenZeppelin v5.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..d4e6e488dbc82b3221ea814768cd6688afdcab67
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,61 @@
+The failure is specific to USDT because USDT does not behave like a standard ERC-20 on `approve`.
+
+Reasoning:
+
+1. On the first run, the router's allowance to the strategy was presumably `0`, so
+   `approve(strategy, amount)` succeeded.
+2. The strategy often spends less than the approved amount, so after that first run the
+   router still has a nonzero leftover allowance for the strategy.
+3. On later runs, the router tries to call `approve(strategy, newAmount)` again while the
+   current allowance is still nonzero.
+4. USDT is one of the tokens that rejects changing an allowance directly from nonzero to
+   nonzero. It requires the allowance to be set to `0` first, then set to the new value.
+5. Because the router is using a low-level `call`, it is no longer failing on return-value
+   decoding, but it still correctly sees that the token call itself reverted or returned
+   failure, so `ok == false` and `require(ok, "approve failed")` trips.
+6. USDC does not enforce this zero-first rule, so repeated approvals keep working there.
+
+That matches the observed behavior exactly: first USDT run succeeds, every later run fails,
+and it fails before transfers because the failure is at the approval step.
+
+Minimal router change:
+
+If you want the smallest direct fix around the current pattern, zero the allowance before
+setting the new one whenever the current allowance is nonzero.
+
+```solidity
+(bool ok0, bytes memory data0) =
+    token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok0 && (data0.length == 0 || abi.decode(data0, (bool))), "approve reset failed");
+
+(bool ok1, bytes memory data1) =
+    token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok1 && (data1.length == 0 || abi.decode(data1, (bool))), "approve failed");
+```
+
+If you want the OpenZeppelin v5 version of the same fix, use `SafeERC20.forceApprove`,
+which exists specifically for tokens like USDT:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+That is the better minimal change in this codebase because it preserves compatibility with
+non-standard tokens without relying on the raw call workaround.
+
+What to do about leftover allowance in general:
+
+Do not assume you can overwrite a leftover nonzero allowance with another nonzero allowance.
+In general, the router should either:
+
+- always use a zero-first approval flow when resetting allowances, or
+- use `SafeERC20.forceApprove`, which handles that for you.
+
+Operationally, leftover allowance should be treated as normal and expected. The code that
+refreshes approval must handle it safely. If the design wants tighter approval hygiene, the
+router can also clear the allowance back to zero after the strategy pull completes, but that
+is a policy choice, not the minimal fix. The essential requirement is: when a leftover
+allowance may exist, approval refresh logic must support tokens that require `0 -> N` rather
+than `N -> M`.

tokens used
8,947
````

## final message

Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211551Z-codex-no-skill-2/security-quiz-004/answer.md).

Core point: USDT rejects `approve` when changing allowance from nonzero to nonzero, so the first `0 -> amount` succeeds and later runs fail because leftover allowance remains. The minimal fix is to use a zero-first approval flow, preferably `SafeERC20.forceApprove` from OpenZeppelin v5.
