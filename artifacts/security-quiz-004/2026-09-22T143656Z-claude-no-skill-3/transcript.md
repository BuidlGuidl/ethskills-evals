# Executor transcript — 2026-09-22T143656Z-claude-no-skill-3

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143656Z-claude-no-skill-3/security-quiz-004

## assistant
- **Bash** `ls -la && cat MEMORY.md 2>/dev/null; ls /home/damu/.claude/projects/-home-damu--cache-ethskills-evals-security-opus-2026-09-22T143656Z-claude-no-skill-3-security-quiz-004/memory/ 2>/dev/null`

  > total 20
  > drwxrwxr-x 3 damu damu 4096 sep 22 11:36 .
  > drwxrwxr-x 3 damu damu 4096 sep 22 11:36 ..
  > drwxrwxr-x 8 damu damu 4096 sep 22 11:36 .git
  > -rw-rw-r-- 1 damu damu   50 sep 22 11:36 package.json
  > -rw-rw-r-- 1 damu damu 1248 sep 22 11:36 TASK.md

## assistant
- **Bash** `cat package.json TASK.md`

  > {
  >   "name": "eval-workspace",
  >   "private": true
  > }
  > Our treasury router on Ethereum mainnet pulls stablecoins in and forwards
  > them to a strategy contract, which it has to approve before each run. The
  > repo is on @openzeppelin/contracts v5 and Solidity 0.8.26.
  > 
  > The approval step is a low-level call, because an earlier version reverted
  > while decoding the return value of some tokens:
  > 
  >   (bool ok, ) = to … [897 more chars]

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why the USDT approval reverts (and only after the first run)

## Short version

USDT's `approve()` contains a non-standard guard:

```solidity
// Tether (TetherToken.sol), in … [6101 more chars]`

  > written

## assistant
Written to `answer.md`. The short version:

**Why USDT, and why only after run 1.** Tether's `approve` carries the 2017-era race-condition guard:

```solidity
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

A non-zero allowance may not be overwritten with another non-zero value. Run 1 starts from zero and succeeds; the strategy under-spends, leaving a non-zero residue; every run after that tries non-zero → non-zero and USDT reverts, so `ok == false` and your `require` fires before any transfer. USDC's `approve` has no such guard, so it never trips.

**Bonus bug in the same two lines.** The raw `.call` was added to dodge USDT's *other* quirk (no return value, so the ABI decoder reverts), but a call to a codeless address returns `ok == true`, and a token returning `false` is also read as success — two silent-failure paths.

**Minimal fix** (OZ v5 — note `safeApprove` was removed, `forceApprove` is the replacement, and it handles both the zero-first retry and the missing return value):

```diff
-        (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
-        require(ok, "approve failed");
+        IERC20(token).forceApprove(strategy, amount);
```

**Leftover allowance.** Approve the exact per-run amount, and zero it in the same transaction after the strategy call (`forceApprove(strategy, 0)`) — that removes the non-zero → non-zero transition entirely and closes a standing pull right on the treasury. Never `type(uint256).max`. Separately, the USDT allowance from run 1 is still live on mainnet; revoke it with a one-off `approve(strategy, 0)`.

## run stats
- turns: 4
- duration: 51s
- cost: $0.2383745
- tokens in/out: 74864/3846
- of which cache write/read: 11027/63829
