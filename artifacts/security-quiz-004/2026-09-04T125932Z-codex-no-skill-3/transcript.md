# Executor transcript — 2026-09-04T125932Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-3/security-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-3/security-quiz-004
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06c8b-744d-7971-b918-24ad40140bca
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
I’m checking the workspace layout first, then I’ll write the explanation into `answer.md` in this directory.
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-3/security-quiz-004
 succeeded in 12ms:
/home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-3/security-quiz-004

exec
/bin/bash -lc 'rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-3/security-quiz-004
 succeeded in 10ms:
TASK.md
package.json

codex
The workspace is minimal. I’m reading the task file to see whether there are formatting constraints before I write `answer.md`.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-3/security-quiz-004
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
I have the full prompt context. Next I’m writing `answer.md` with the root cause, the minimal router change, and the allowance-handling recommendation.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-3/security-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..7bd355bcdf0b8122a8c8fdbb3f449e7cac923a58
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,50 @@
+The failure pattern matches **USDT's non-standard approve behavior**.
+
+Reasoning:
+
+1. The first USDT run succeeded because the router's allowance to the strategy
+   was initially `0`, and USDT allows `approve(spender, amount)` from `0` to a
+   non-zero value.
+2. After that run, the strategy often spent **less** than the approved amount,
+   so the router still had a **non-zero leftover allowance** for the strategy.
+3. On the next run, the router tried to call `approve(strategy, amount)` again
+   while the current allowance was still non-zero.
+4. USDT is one of the tokens that rejects changing a non-zero allowance
+   directly to another non-zero allowance. It requires the allowance to be set
+   to `0` first, then set to the new value.
+5. Because the router uses a low-level `call`, it is not failing on ABI return
+   decoding. The token call itself is reverting, so `ok` is `false` and
+   `require(ok, "approve failed")` reverts.
+6. USDC does not enforce that zero-first rule, so repeated approvals keep
+   succeeding there.
+
+So this fails only for USDT, and only after the first run, because only then is
+there typically a leftover non-zero allowance.
+
+The minimal fix is to use OpenZeppelin's zero-first approval helper instead of
+the raw low-level call. In `@openzeppelin/contracts` v5, that is
+`SafeERC20.forceApprove`.
+
+Minimal change:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` handles tokens like USDT by trying the approval and, if needed,
+resetting the allowance to `0` before setting it to `amount`.
+
+What the router should do about leftover allowance in general:
+
+- It should **not assume** the previous allowance was fully consumed.
+- Before each run, it should set the strategy's allowance to exactly the amount
+  needed for that run, using `forceApprove`.
+- If the design wants least-privilege behavior, it can also clear any residual
+  allowance back to `0` after the strategy finishes, but that is optional and
+  costs extra gas.
+
+In short: the bug is not the low-level call itself; the bug is re-approving
+USDT from one non-zero allowance to another non-zero allowance. The practical
+fix is `forceApprove`, which safely handles the leftover allowance case.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..7bd355bcdf0b8122a8c8fdbb3f449e7cac923a58
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,50 @@
+The failure pattern matches **USDT's non-standard approve behavior**.
+
+Reasoning:
+
+1. The first USDT run succeeded because the router's allowance to the strategy
+   was initially `0`, and USDT allows `approve(spender, amount)` from `0` to a
+   non-zero value.
+2. After that run, the strategy often spent **less** than the approved amount,
+   so the router still had a **non-zero leftover allowance** for the strategy.
+3. On the next run, the router tried to call `approve(strategy, amount)` again
+   while the current allowance was still non-zero.
+4. USDT is one of the tokens that rejects changing a non-zero allowance
+   directly to another non-zero allowance. It requires the allowance to be set
+   to `0` first, then set to the new value.
+5. Because the router uses a low-level `call`, it is not failing on ABI return
+   decoding. The token call itself is reverting, so `ok` is `false` and
+   `require(ok, "approve failed")` reverts.
+6. USDC does not enforce that zero-first rule, so repeated approvals keep
+   succeeding there.
+
+So this fails only for USDT, and only after the first run, because only then is
+there typically a leftover non-zero allowance.
+
+The minimal fix is to use OpenZeppelin's zero-first approval helper instead of
+the raw low-level call. In `@openzeppelin/contracts` v5, that is
+`SafeERC20.forceApprove`.
+
+Minimal change:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` handles tokens like USDT by trying the approval and, if needed,
+resetting the allowance to `0` before setting it to `amount`.
+
+What the router should do about leftover allowance in general:
+
+- It should **not assume** the previous allowance was fully consumed.
+- Before each run, it should set the strategy's allowance to exactly the amount
+  needed for that run, using `forceApprove`.
+- If the design wants least-privilege behavior, it can also clear any residual
+  allowance back to `0` after the strategy finishes, but that is optional and
+  costs extra gas.
+
+In short: the bug is not the low-level call itself; the bug is re-approving
+USDT from one non-zero allowance to another non-zero allowance. The practical
+fix is `forceApprove`, which safely handles the leftover allowance case.

codex
Wrote the answer to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-3/security-quiz-004/answer.md).

Core conclusion: USDT enforces the old zero-first allowance rule, so the first approval from `0` succeeds, later approvals fail when a leftover non-zero allowance remains. The minimal fix is to replace the raw `approve` call with OpenZeppelin v5 `SafeERC20.forceApprove`, which handles the `0 -> amount` reset automatically.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..7bd355bcdf0b8122a8c8fdbb3f449e7cac923a58
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,50 @@
+The failure pattern matches **USDT's non-standard approve behavior**.
+
+Reasoning:
+
+1. The first USDT run succeeded because the router's allowance to the strategy
+   was initially `0`, and USDT allows `approve(spender, amount)` from `0` to a
+   non-zero value.
+2. After that run, the strategy often spent **less** than the approved amount,
+   so the router still had a **non-zero leftover allowance** for the strategy.
+3. On the next run, the router tried to call `approve(strategy, amount)` again
+   while the current allowance was still non-zero.
+4. USDT is one of the tokens that rejects changing a non-zero allowance
+   directly to another non-zero allowance. It requires the allowance to be set
+   to `0` first, then set to the new value.
+5. Because the router uses a low-level `call`, it is not failing on ABI return
+   decoding. The token call itself is reverting, so `ok` is `false` and
+   `require(ok, "approve failed")` reverts.
+6. USDC does not enforce that zero-first rule, so repeated approvals keep
+   succeeding there.
+
+So this fails only for USDT, and only after the first run, because only then is
+there typically a leftover non-zero allowance.
+
+The minimal fix is to use OpenZeppelin's zero-first approval helper instead of
+the raw low-level call. In `@openzeppelin/contracts` v5, that is
+`SafeERC20.forceApprove`.
+
+Minimal change:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` handles tokens like USDT by trying the approval and, if needed,
+resetting the allowance to `0` before setting it to `amount`.
+
+What the router should do about leftover allowance in general:
+
+- It should **not assume** the previous allowance was fully consumed.
+- Before each run, it should set the strategy's allowance to exactly the amount
+  needed for that run, using `forceApprove`.
+- If the design wants least-privilege behavior, it can also clear any residual
+  allowance back to `0` after the strategy finishes, but that is optional and
+  costs extra gas.
+
+In short: the bug is not the low-level call itself; the bug is re-approving
+USDT from one non-zero allowance to another non-zero allowance. The practical
+fix is `forceApprove`, which safely handles the leftover allowance case.

tokens used
9,305
````

## final message

Wrote the answer to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125932Z-codex-no-skill-3/security-quiz-004/answer.md).

Core conclusion: USDT enforces the old zero-first allowance rule, so the first approval from `0` succeeds, later approvals fail when a leftover non-zero allowance remains. The minimal fix is to replace the raw `approve` call with OpenZeppelin v5 `SafeERC20.forceApprove`, which handles the `0 -> amount` reset automatically.
