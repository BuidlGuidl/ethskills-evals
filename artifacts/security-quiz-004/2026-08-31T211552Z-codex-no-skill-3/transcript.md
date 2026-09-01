# Executor transcript — 2026-08-31T211552Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211552Z-codex-no-skill-3/security-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211552Z-codex-no-skill-3/security-quiz-004
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059c0-268b-78a1-8af0-f9cf81bf3190
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

2026-08-31T21:36:00.393166Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059c0-268b-78a1-8af0-f9cf81bf3190.tmp-1788212160153153130: line 2547: syntax error near unexpected token `('

codex
I’m checking the workspace layout first, then I’ll write the analysis directly into `answer.md` in this directory.
exec
/bin/bash -lc pwd in /tmp/ethskills-security-eval/2026-08-31T211552Z-codex-no-skill-3/security-quiz-004
 succeeded in 16ms:
/tmp/ethskills-security-eval/2026-08-31T211552Z-codex-no-skill-3/security-quiz-004

exec
/bin/bash -lc 'rg --files' in /tmp/ethskills-security-eval/2026-08-31T211552Z-codex-no-skill-3/security-quiz-004
 succeeded in 28ms:
package.json
TASK.md

codex
The repo is minimal. I found `TASK.md`; I’m reading it to confirm whether there are any formatting requirements before I write the answer file.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211552Z-codex-no-skill-3/security-quiz-004
 succeeded in 10ms:
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
I’ve confirmed the task. Now I’m checking the local package setup so the answer can reference the relevant OpenZeppelin v5 behavior accurately.
exec
/bin/bash -lc "sed -n '1,220p' package.json" in /tmp/ethskills-security-eval/2026-08-31T211552Z-codex-no-skill-3/security-quiz-004
 succeeded in 12ms:
{
  "name": "eval-workspace",
  "private": true
}

exec
/bin/bash -lc "if [ -d node_modules/@openzeppelin/contracts ]; then sed -n '1,260p' node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol; fi" in /tmp/ethskills-security-eval/2026-08-31T211552Z-codex-no-skill-3/security-quiz-004
 succeeded in 13ms:
codex
I have enough context. I’m writing `answer.md` with the root cause, the minimal router change, and the general allowance handling rule.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211552Z-codex-no-skill-3/security-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..51b79fb0c53f4e05e39c18593e823da832bb6bbe
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,49 @@
+USDT is the outlier because its `approve` behavior is stricter than a standard ERC-20's in a way that matches your timeline exactly.
+
+Reasoning:
+
+1. The first USDT run succeeded because the router's allowance to `strategy` was initially `0`, so `approve(strategy, amount)` was allowed.
+2. The strategy often spends less than approved, so after that first run the router usually still has a non-zero leftover allowance for `strategy`.
+3. USDT is a well-known non-standard token that rejects changing a non-zero allowance directly to another non-zero allowance. It requires the allowance to be set to `0` first.
+4. Your low-level call only checks whether the token call itself reverted:
+
+   ```solidity
+   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+   require(ok, "approve failed");
+   ```
+
+   For USDT:
+   - first run: `0 -> amount` succeeds
+   - later runs: `leftover_nonzero -> new_nonzero` reverts, so `ok == false`, and your router reverts at `require(ok, "approve failed")`
+
+5. USDC does not enforce that zero-first rule, so repeated `approve(strategy, amount)` calls keep succeeding there.
+
+Minimal router change:
+
+Reset the allowance to zero before setting the new allowance.
+
+```solidity
+(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok, "approve reset failed");
+
+(bool ok2, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok2, "approve failed");
+```
+
+If you are already using OpenZeppelin v5, the cleaner version is to use `SafeERC20.forceApprove`, which does exactly this compatibility flow for tokens like USDT.
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+What the router should do about leftover allowance in general:
+
+Treat leftover allowance as normal state that must be handled safely, not assumed away. In practice:
+
+- Before increasing or refreshing an allowance for a spender, support the case where a non-zero leftover allowance is still present.
+- The robust pattern is "set to 0, then set to desired amount", or equivalently `forceApprove`.
+- Do not rely on repeated plain `approve(amount)` succeeding across all mainnet tokens, because some prominent tokens, including USDT, are not fully standard here.
+
+So the direct answer is: this fails only for USDT because USDT requires zeroing a non-zero allowance before setting a new non-zero one; it starts failing only after the first run because that is when leftover allowance begins to exist.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..51b79fb0c53f4e05e39c18593e823da832bb6bbe
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,49 @@
+USDT is the outlier because its `approve` behavior is stricter than a standard ERC-20's in a way that matches your timeline exactly.
+
+Reasoning:
+
+1. The first USDT run succeeded because the router's allowance to `strategy` was initially `0`, so `approve(strategy, amount)` was allowed.
+2. The strategy often spends less than approved, so after that first run the router usually still has a non-zero leftover allowance for `strategy`.
+3. USDT is a well-known non-standard token that rejects changing a non-zero allowance directly to another non-zero allowance. It requires the allowance to be set to `0` first.
+4. Your low-level call only checks whether the token call itself reverted:
+
+   ```solidity
+   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+   require(ok, "approve failed");
+   ```
+
+   For USDT:
+   - first run: `0 -> amount` succeeds
+   - later runs: `leftover_nonzero -> new_nonzero` reverts, so `ok == false`, and your router reverts at `require(ok, "approve failed")`
+
+5. USDC does not enforce that zero-first rule, so repeated `approve(strategy, amount)` calls keep succeeding there.
+
+Minimal router change:
+
+Reset the allowance to zero before setting the new allowance.
+
+```solidity
+(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok, "approve reset failed");
+
+(bool ok2, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok2, "approve failed");
+```
+
+If you are already using OpenZeppelin v5, the cleaner version is to use `SafeERC20.forceApprove`, which does exactly this compatibility flow for tokens like USDT.
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+What the router should do about leftover allowance in general:
+
+Treat leftover allowance as normal state that must be handled safely, not assumed away. In practice:
+
+- Before increasing or refreshing an allowance for a spender, support the case where a non-zero leftover allowance is still present.
+- The robust pattern is "set to 0, then set to desired amount", or equivalently `forceApprove`.
+- Do not rely on repeated plain `approve(amount)` succeeding across all mainnet tokens, because some prominent tokens, including USDT, are not fully standard here.
+
+So the direct answer is: this fails only for USDT because USDT requires zeroing a non-zero allowance before setting a new non-zero one; it starts failing only after the first run because that is when leftover allowance begins to exist.

codex
Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211552Z-codex-no-skill-3/security-quiz-004/answer.md).

Core point: USDT rejects `approve(nonzero)` when a nonzero allowance already exists, so the first `0 -> amount` approval works and later `leftover -> new amount` approvals revert. The minimal fix is to zero the allowance before setting the new value, or use OpenZeppelin v5 `SafeERC20.forceApprove`, which handles that pattern directly.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..51b79fb0c53f4e05e39c18593e823da832bb6bbe
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,49 @@
+USDT is the outlier because its `approve` behavior is stricter than a standard ERC-20's in a way that matches your timeline exactly.
+
+Reasoning:
+
+1. The first USDT run succeeded because the router's allowance to `strategy` was initially `0`, so `approve(strategy, amount)` was allowed.
+2. The strategy often spends less than approved, so after that first run the router usually still has a non-zero leftover allowance for `strategy`.
+3. USDT is a well-known non-standard token that rejects changing a non-zero allowance directly to another non-zero allowance. It requires the allowance to be set to `0` first.
+4. Your low-level call only checks whether the token call itself reverted:
+
+   ```solidity
+   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+   require(ok, "approve failed");
+   ```
+
+   For USDT:
+   - first run: `0 -> amount` succeeds
+   - later runs: `leftover_nonzero -> new_nonzero` reverts, so `ok == false`, and your router reverts at `require(ok, "approve failed")`
+
+5. USDC does not enforce that zero-first rule, so repeated `approve(strategy, amount)` calls keep succeeding there.
+
+Minimal router change:
+
+Reset the allowance to zero before setting the new allowance.
+
+```solidity
+(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
+require(ok, "approve reset failed");
+
+(bool ok2, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok2, "approve failed");
+```
+
+If you are already using OpenZeppelin v5, the cleaner version is to use `SafeERC20.forceApprove`, which does exactly this compatibility flow for tokens like USDT.
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+What the router should do about leftover allowance in general:
+
+Treat leftover allowance as normal state that must be handled safely, not assumed away. In practice:
+
+- Before increasing or refreshing an allowance for a spender, support the case where a non-zero leftover allowance is still present.
+- The robust pattern is "set to 0, then set to desired amount", or equivalently `forceApprove`.
+- Do not rely on repeated plain `approve(amount)` succeeding across all mainnet tokens, because some prominent tokens, including USDT, are not fully standard here.
+
+So the direct answer is: this fails only for USDT because USDT requires zeroing a non-zero allowance before setting a new non-zero one; it starts failing only after the first run because that is when leftover allowance begins to exist.

tokens used
8,206
````

## final message

Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211552Z-codex-no-skill-3/security-quiz-004/answer.md).

Core point: USDT rejects `approve(nonzero)` when a nonzero allowance already exists, so the first `0 -> amount` approval works and later `leftover -> new amount` approvals revert. The minimal fix is to zero the allowance before setting the new value, or use OpenZeppelin v5 `SafeERC20.forceApprove`, which handles that pattern directly.
