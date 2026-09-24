# Executor transcript — 2026-09-22T143532Z-claude-no-skill-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143532Z-claude-no-skill-2/security-quiz-004

## assistant
- **Bash** `ls -la /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143532Z-claude-no-skill-2/security-quiz-004`

  > total 20
  > drwxrwxr-x 3 damu damu 4096 sep 22 11:35 .
  > drwxrwxr-x 3 damu damu 4096 sep 22 11:35 ..
  > drwxrwxr-x 8 damu damu 4096 sep 22 11:35 .git
  > -rw-rw-r-- 1 damu damu   50 sep 22 11:35 package.json
  > -rw-rw-r-- 1 damu damu 1248 sep 22 11:35 TASK.md

## assistant
- **Bash** `cat > /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143532Z-claude-no-skill-2/security-quiz-004/answer.md <<'EOF'
# Why the USDT approval reverts after the first run

## Short version

US … [8723 more chars]`

  > done

## assistant
Written to `answer.md`. The short version:

**Root cause.** USDT's `approve()` carries a guard standard ERC-20s don't:

```solidity
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

It blocks any non-zero → non-zero allowance change (an anti-front-running mitigation for the ERC-20 approve race). Run 1 started from a zero allowance and passed. The strategy then under-spent, leaving a non-zero remainder — so every run since tries to overwrite a non-zero allowance with a non-zero amount, USDT reverts, `ok` comes back `false`, and you hit `require(ok, ...)` before any transfer. USDC has no such guard, so it never fails. The "first run only" pattern is the fingerprint: it's the only run that began at zero.

**Minimal fix.** Swap the low-level call for OZ v5's `SafeERC20.forceApprove` — it retries with a zeroing approve on failure, and its `_callOptionalReturn` tolerates USDT's missing return value without the hole your current line has. Note `safeApprove` was removed in v5; `forceApprove` is the replacement.

**A second bug on that same line:** `(bool ok, )` discards returndata entirely, so it also accepts a token that returns `false` and a call to an address with *no code* as success. `forceApprove` closes both.

**The leftover allowance.** Fixing the revert doesn't fix the standing allowance, which is the more serious issue — a permanent open door letting any strategy bug, upgrade, or key compromise drain the router. Prefer a push/`safeTransfer` design with no allowance at all; failing that, approve the exact amount and unconditionally `forceApprove(strategy, 0)` after the run. Never infinite-approve from a treasury, and zero out the allowances already live on mainnet from the runs that happened.

## run stats
- turns: 3
- duration: 63s
- cost: $0.2542795
- tokens in/out: 56646/4720
- of which cache write/read: 11361/45279
