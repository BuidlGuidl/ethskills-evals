# Executor transcript — 2026-09-04T125931Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T125931Z-codex-no-skill-1/security-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T125931Z-codex-no-skill-1/security-quiz-004
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06c8a-f13d-79a3-b94c-494946666c48
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
I’m checking the workspace structure first, then I’ll write the analysis directly into `answer.md` in this directory.
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T125931Z-codex-no-skill-1/security-quiz-004
 succeeded in 3ms:
/home/damu/.cache/ethskills-evals/2026-09-04T125931Z-codex-no-skill-1/security-quiz-004

exec
/bin/bash -lc 'rg --files' in /home/damu/.cache/ethskills-evals/2026-09-04T125931Z-codex-no-skill-1/security-quiz-004
 succeeded in 9ms:
TASK.md
package.json

codex
The workspace is minimal. I’m reading the task file to confirm expected output format before editing `answer.md`.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125931Z-codex-no-skill-1/security-quiz-004
 succeeded in 22ms:
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
I’ve confirmed the task. I’m writing `answer.md` now with the root cause, the smallest safe fix for OZ v5, and how to handle stale allowance going forward.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125931Z-codex-no-skill-1/security-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4e036fe1cd5ee8d24c141933202c15c3f139c50a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,63 @@
+The failure pattern matches USDT's well-known approval rule: it does **not**
+allow changing an existing **non-zero allowance** directly to another non-zero
+allowance.
+
+Reasoning:
+
+1. On the first run, the router's allowance to `strategy` was presumably `0`.
+   `approve(strategy, amount)` therefore succeeded for USDT.
+2. The strategy often spends **less** than the approved amount, so after the
+   run there is still a **leftover non-zero allowance**.
+3. On the next run, the router again does a low-level `approve(strategy, amount)`.
+   For USDT, that is a non-zero to non-zero allowance change, so USDT reverts.
+   Your low-level call sees `ok == false`, and `require(ok, "approve failed")`
+   reverts before any transfer happens.
+4. USDC does not enforce that zero-first rule, so repeated approvals keep
+   succeeding there.
+
+So this is not a decoding problem. The low-level call avoided return-value
+decoding issues, but it does not change token-specific approval semantics.
+
+Minimal fix:
+
+Before setting a new non-zero allowance, force the allowance to zero first when
+needed.
+
+With OpenZeppelin v5, the minimal router change is to use `SafeERC20.forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+That helper is specifically meant for tokens like USDT. It attempts the approve,
+and if needed performs the zero-then-set flow safely.
+
+If you want the equivalent logic spelled out, it is effectively:
+
+```solidity
+if (IERC20(token).allowance(address(this), strategy) != 0) {
+    (bool ok0, ) = token.call(
+        abi.encodeWithSelector(0x095ea7b3, strategy, 0)
+    );
+    require(ok0, "approve zero failed");
+}
+
+(bool ok1, ) = token.call(
+    abi.encodeWithSelector(0x095ea7b3, strategy, amount)
+);
+require(ok1, "approve failed");
+```
+
+What to do about leftover allowance in general:
+
+Do not rely on leftover allowance as part of normal operation. Treat it as stale
+approval state.
+
+At minimum, each run should overwrite allowance with a zero-then-set pattern so
+USDT-style tokens work reliably.
+
+For tighter privilege, the router should also clear any unused allowance back to
+zero after the strategy has finished pulling funds, because leftover allowance is
+unnecessary standing authorization if approvals are meant to be per-run.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4e036fe1cd5ee8d24c141933202c15c3f139c50a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,63 @@
+The failure pattern matches USDT's well-known approval rule: it does **not**
+allow changing an existing **non-zero allowance** directly to another non-zero
+allowance.
+
+Reasoning:
+
+1. On the first run, the router's allowance to `strategy` was presumably `0`.
+   `approve(strategy, amount)` therefore succeeded for USDT.
+2. The strategy often spends **less** than the approved amount, so after the
+   run there is still a **leftover non-zero allowance**.
+3. On the next run, the router again does a low-level `approve(strategy, amount)`.
+   For USDT, that is a non-zero to non-zero allowance change, so USDT reverts.
+   Your low-level call sees `ok == false`, and `require(ok, "approve failed")`
+   reverts before any transfer happens.
+4. USDC does not enforce that zero-first rule, so repeated approvals keep
+   succeeding there.
+
+So this is not a decoding problem. The low-level call avoided return-value
+decoding issues, but it does not change token-specific approval semantics.
+
+Minimal fix:
+
+Before setting a new non-zero allowance, force the allowance to zero first when
+needed.
+
+With OpenZeppelin v5, the minimal router change is to use `SafeERC20.forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+That helper is specifically meant for tokens like USDT. It attempts the approve,
+and if needed performs the zero-then-set flow safely.
+
+If you want the equivalent logic spelled out, it is effectively:
+
+```solidity
+if (IERC20(token).allowance(address(this), strategy) != 0) {
+    (bool ok0, ) = token.call(
+        abi.encodeWithSelector(0x095ea7b3, strategy, 0)
+    );
+    require(ok0, "approve zero failed");
+}
+
+(bool ok1, ) = token.call(
+    abi.encodeWithSelector(0x095ea7b3, strategy, amount)
+);
+require(ok1, "approve failed");
+```
+
+What to do about leftover allowance in general:
+
+Do not rely on leftover allowance as part of normal operation. Treat it as stale
+approval state.
+
+At minimum, each run should overwrite allowance with a zero-then-set pattern so
+USDT-style tokens work reliably.
+
+For tighter privilege, the router should also clear any unused allowance back to
+zero after the strategy has finished pulling funds, because leftover allowance is
+unnecessary standing authorization if approvals are meant to be per-run.

codex
Wrote the answer to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125931Z-codex-no-skill-1/security-quiz-004/answer.md).

The core point is that USDT rejects non-zero-to-non-zero `approve` changes, so the first approval from `0` succeeds and later ones fail when leftover allowance remains. The minimal OZ v5 fix is to replace the low-level approval with `IERC20(token).forceApprove(strategy, amount)`, or equivalently do `approve(0)` before the new non-zero approval when needed. In general, leftover allowance should be treated as stale authorization and zeroed, ideally after each run as well if approvals are intended to be per-run.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..4e036fe1cd5ee8d24c141933202c15c3f139c50a
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,63 @@
+The failure pattern matches USDT's well-known approval rule: it does **not**
+allow changing an existing **non-zero allowance** directly to another non-zero
+allowance.
+
+Reasoning:
+
+1. On the first run, the router's allowance to `strategy` was presumably `0`.
+   `approve(strategy, amount)` therefore succeeded for USDT.
+2. The strategy often spends **less** than the approved amount, so after the
+   run there is still a **leftover non-zero allowance**.
+3. On the next run, the router again does a low-level `approve(strategy, amount)`.
+   For USDT, that is a non-zero to non-zero allowance change, so USDT reverts.
+   Your low-level call sees `ok == false`, and `require(ok, "approve failed")`
+   reverts before any transfer happens.
+4. USDC does not enforce that zero-first rule, so repeated approvals keep
+   succeeding there.
+
+So this is not a decoding problem. The low-level call avoided return-value
+decoding issues, but it does not change token-specific approval semantics.
+
+Minimal fix:
+
+Before setting a new non-zero allowance, force the allowance to zero first when
+needed.
+
+With OpenZeppelin v5, the minimal router change is to use `SafeERC20.forceApprove`:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+That helper is specifically meant for tokens like USDT. It attempts the approve,
+and if needed performs the zero-then-set flow safely.
+
+If you want the equivalent logic spelled out, it is effectively:
+
+```solidity
+if (IERC20(token).allowance(address(this), strategy) != 0) {
+    (bool ok0, ) = token.call(
+        abi.encodeWithSelector(0x095ea7b3, strategy, 0)
+    );
+    require(ok0, "approve zero failed");
+}
+
+(bool ok1, ) = token.call(
+    abi.encodeWithSelector(0x095ea7b3, strategy, amount)
+);
+require(ok1, "approve failed");
+```
+
+What to do about leftover allowance in general:
+
+Do not rely on leftover allowance as part of normal operation. Treat it as stale
+approval state.
+
+At minimum, each run should overwrite allowance with a zero-then-set pattern so
+USDT-style tokens work reliably.
+
+For tighter privilege, the router should also clear any unused allowance back to
+zero after the strategy has finished pulling funds, because leftover allowance is
+unnecessary standing authorization if approvals are meant to be per-run.

tokens used
10,042
````

## final message

Wrote the answer to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125931Z-codex-no-skill-1/security-quiz-004/answer.md).

The core point is that USDT rejects non-zero-to-non-zero `approve` changes, so the first approval from `0` succeeds and later ones fail when leftover allowance remains. The minimal OZ v5 fix is to replace the low-level approval with `IERC20(token).forceApprove(strategy, amount)`, or equivalently do `approve(0)` before the new non-zero approval when needed. In general, leftover allowance should be treated as stale authorization and zeroed, ideally after each run as well if approvals are intended to be per-run.
