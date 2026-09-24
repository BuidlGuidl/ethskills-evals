# Executor transcript — 2026-09-21T130446Z-claude-with-skill-2f0adb01-3

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-21T130446Z-claude-with-skill-2f0adb01-3/testing-quiz-003

## assistant
- **Bash** `ls -la && find . -name "*.sol" -not -path "./lib/*" | head -50 && cat foundry.toml 2>/dev/null`

## assistant
- **Skill** `{"skill":"testing"}`

  > Exit code 1
  > total 28
  > drwxrwxr-x 5 damu damu 4096 sep 21 10:04 .
  > drwxrwxr-x 3 damu damu 4096 sep 21 10:04 ..
  > drwxrwxr-x 3 damu damu 4096 sep 21 10:04 .agents
  > drwxrwxr-x 3 damu damu 4096 sep 21 10:04 .claude
  > drwxrwxr-x 8 damu damu 4096 sep 21 10:04 .git
  > -rw-rw-r-- 1 damu damu   50 sep 21 10:04 package.json
  > -rw-rw-r-- 1 damu damu 1187 sep 21 10:04 TASK.md

  > Launching skill: testing

## assistant
- **Bash** `cat TASK.md && ls .claude/skills/testing/ && grep -rin "aave\|usdt" .claude/skills/testing/addresses/ 2>/dev/null | head -20`

  > Our vault routes deposits into Aave V3. The suite runs against a MockERC20 for the
  > underlying and a MockAavePool for the pool — 39 tests, all green, and they have been
  > green since the first commit.
  > 
  > We deployed to mainnet with USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) as the
  > underlying. Every deposit reverts on-chain. The revert carries no reason string. The
  > relevant lines are:
  > 
  >     usdt.s … [793 more chars]

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why `deposit` reverts on mainnet with USDT but never against the mock

## Short version

Line 2 is a **raw** `approve` call, not a SafeERC20 call. Real USDT's `approve` retur … [12423 more chars]`

  > 276 answer.md

## assistant
Written to `answer.md`. The diagnosis:

**Root cause.** Line 2 is a raw `usdt.approve(...)`, not a SafeERC20 call. Real USDT (deployed with Solidity 0.4.17) declares `approve` with **no return value**. Calling it through OZ's `IERC20`, which declares `returns (bool)`, makes the compiler emit a `returndatasize() >= 32` check after the call. USDT returns 0 bytes, so it `revert(0, 0)` — an empty revert, exactly the reasonless failure you see. Line 1 survives because `safeTransferFrom` does a low-level call and accepts empty returndata; line 3 is never reached.

**Why SafeERC20 didn't help.** `using A for B` *adds* members, it doesn't override existing ones. `safeTransferFrom` resolves to the library; `approve` resolves to the plain `IERC20` member because `SafeERC20` has no function by that name. Well-typed, no warning, unprotected.

**Why mocks can't catch it.** `MockERC20` is stock OZ ERC20 — a faithful implementation of the same spec `IERC20` declares. The mock and the code share the identical wrong assumption about USDT, so they agree with each other. `MockERC20.approve` is declared `returns (bool)` and therefore always writes 32 bytes; the check that fails on mainnet is structurally unreachable. Mocks test your code against your assumptions; they cannot test your assumptions.

**Fixes.** Code: `usdt.forceApprove(address(aavePool), amount)` — it handles both the missing return value and USDT's second landmine, the `require` that forbids moving a non-zero allowance to another non-zero value without passing through 0. Testing: one fork test against the real USDT and real Aave V3 Pool at a pinned block, in CI, per listed asset — with a repo-wide grep + Slither lint for bare `approve`/`transfer` calls.

Two things the answer flags beyond what you asked: the non-zero-allowance guard is a latent second bug on that same line (currently masked because Aave consumes the full allowance), and USDT's owner-settable transfer fee means you should credit `balanceOf` delta rather than `amount`.

## run stats
- turns: 6
- duration: 101s
- cost: $0.4227645000000001
- tokens in/out: 95797/7511
- of which cache write/read: 19690/76099
