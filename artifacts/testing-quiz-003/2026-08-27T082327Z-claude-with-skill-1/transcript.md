# Executor transcript — 2026-08-27T082327Z-claude-with-skill-1

**executor**: claude  |  **model**: claude-opus-5  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/2026-08-27T082327Z-claude-with-skill-1/testing-quiz-003

## assistant
- **Bash** `ls -R | head -50 && echo "---" && cat foundry.toml 2>/dev/null`

## assistant
- **Skill** `{"skill":"testing"}`

  > Exit code 1
  > package.json
  > TASK.md
  > ---

  > Launching skill: testing

## assistant
- **Bash** `cat TASK.md && echo "=== pkg ===" && cat package.json && echo "=== skill files ===" && find .claude/skills/testing -type f | head -30`

  > Our vault routes deposits into Aave V3. The suite runs against a MockERC20 for the
  > underlying and a MockAavePool for the pool — 39 tests, all green, and they have been
  > green since the first commit.
  > 
  > We deployed to mainnet with USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) as the
  > underlying. Every deposit reverts on-chain. The revert carries no reason string. The
  > relevant lines are:
  > 
  >     usdt.s … [898 more chars]

## assistant
- **Bash** `cat > /Users/liana/.cache/ethskills-evals/2026-08-27T082327Z-claude-with-skill-1/testing-quiz-003/answer.md <<'MDEOF'
# Why the deposit reverts on mainnet but never in the suite

## Short version

`us … [9602 more chars]`

  >      207 /Users/liana/.cache/ethskills-evals/2026-08-27T082327Z-claude-with-skill-1/testing-quiz-003/answer.md

## assistant
Written to `answer.md`. The core of it:

**Why it reverts on mainnet:** Real USDT's `approve` has no `returns (bool)`. Calling it through OZ's `IERC20` compiles to a `call` followed by a `returndatasize() < 32` guard — the call succeeds and the allowance is actually set, then your contract's own decode epilogue reverts with zero bytes of returndata. That's the missing reason string.

**Why the mock can't reproduce it:** the failure lives in the bytecode at the token address, not in the input space. A stock OZ ERC20 returns a well-formed `true` for every argument, caller, and state. The mock models the spec; the bug is a deployed contract deviating from the spec. The matching 6 decimals bought a false sense of having modeled USDT.

**Why SafeERC20 didn't help:** `using SafeERC20 for IERC20` *adds* names (`safeTransfer`, `forceApprove`, …) — it doesn't intercept `approve`, which SafeERC20 never defines. So `usdt.approve(...)` resolves unambiguously to the strict-decode interface member. Line 1 opted in and got `_callOptionalReturn`'s empty-returndata tolerance; line 2 didn't.

**Code fix:** `usdt.forceApprove(address(aavePool), amount)` — handles both the missing return value *and* USDT's non-zero→non-zero allowance guard, which is the second landmine waiting behind the first (bare `safeApprove` only fixes the former, and is gone in OZ v5). The file also covers the balance-delta pattern for USDT's dormant fee mechanism and a grep to sweep remaining raw `.approve/.transfer` call sites.

**Testing fix:** a mock may stand in for your own contracts, never for a third-party deployed one. Fork test at a pinned block against real USDT and the real Aave Pool (resolved via the addresses provider), with two tests — fresh allowance and stale allowance, the second being the one that survives a half-fix. Then a token matrix in CI, a listing gate, and a deployment rehearsal.

One flag worth repeating: "39 tests, green since the first commit" is itself the alarm. A suite that has never gone red hasn't been shown to detect anything — it measures agreement between code and mocks written by the same people on the same day.

## run stats
- turns: 6
- duration: 147s
- cost: $0.49647250000000004
- tokens in/out: 8/9290
