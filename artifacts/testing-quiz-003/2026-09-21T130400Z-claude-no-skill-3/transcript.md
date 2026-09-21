# Executor transcript — 2026-09-21T130400Z-claude-no-skill-3

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-21T130400Z-claude-no-skill-3/testing-quiz-003

## assistant
- **Bash** `ls -la && find . -name '*.sol' -not -path './.git/*' | head -50`

  > total 20
  > drwxrwxr-x 3 damu damu 4096 sep 21 10:04 .
  > drwxrwxr-x 3 damu damu 4096 sep 21 10:04 ..
  > drwxrwxr-x 8 damu damu 4096 sep 21 10:04 .git
  > -rw-rw-r-- 1 damu damu   50 sep 21 10:04 package.json
  > -rw-rw-r-- 1 damu damu 1187 sep 21 10:04 TASK.md

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why deposits revert on mainnet USDT but never against the mock

## Short version

Line 2 is the bug:

```solidity
usdt.approve(address(aavePool), amount);   // <-- raw IERC20 … [11209 more chars]`

  > written
  > 229 answer.md

## assistant
Written to `answer.md`. The core diagnosis:

**Why it reverts on real USDT:** `usdt.approve(...)` is a *raw* `IERC20` call. The OZ interface declares `approve` as returning `bool`, but real USDT returns nothing. Solidity's generated wrapper checks `returndatasize() >= 32` before ABI-decoding, the check fails, and the compiler's failure path is a bare `revert(0, 0)` — which is exactly why there's no reason string. USDT's `approve` itself succeeded; your contract reverted on decoding the reply. (There's a second landmine in that line too: USDT's non-zero → non-zero allowance guard.)

**Why the mock never shows it:** OZ's `ERC20.approve` ends in `return true`, so the decode always succeeds. The mock and USDT share a selector and an effect but differ in ABI return arity — the bug is a mismatch between your declared interface and bytecode you never execute in tests.

**Why SafeERC20 didn't help:** `using SafeERC20 for IERC20` only *adds* methods named `safeTransferFrom`, `forceApprove`, etc. It doesn't intercept `approve`. Line 1 is protected because you wrote `safeTransferFrom`; line 2 isn't because you wrote `approve`. SafeERC20 protects call sites, not tokens.

**Why more mock tests can't find it:** fuzzing, invariants, and 100% coverage all run against bytecode you wrote. Line 2 is already covered 39 times; the failing branch is compiler-generated decode logic.

**Fixes:** `usdt.forceApprove(address(aavePool), amount)` (OZ ≥4.9 — not deprecated `safeApprove`), plus a grep sweep for other raw `.approve(`/`.transfer(` call sites. And the practice change: a mainnet-fork suite against real USDT and the real Aave V3 pool, pinned block, run in CI as a deploy gate — with the deposit exercised *twice* to catch the allowance guard. Answer file includes a runnable Foundry fork test and an adversarial-mock recommendation as the cheap no-RPC complement.

## run stats
- turns: 3
- duration: 76s
- cost: $0.28868400000000005
- tokens in/out: 57438/5741
- of which cache write/read: 12254/45178
