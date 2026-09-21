# Executor transcript — 2026-09-21T125252Z-claude-with-skill-2f0adb01-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-21T125252Z-claude-with-skill-2f0adb01-2/testing-quiz-003

## assistant
- **Bash** `ls -la && find . -name '*.sol' -not -path './lib/*' | head -50`

## assistant
- **Skill** `{"skill":"testing"}`

  > total 28
  > drwxrwxr-x 5 damu damu 4096 sep 21 09:52 .
  > drwxrwxr-x 3 damu damu 4096 sep 21 09:52 ..
  > drwxrwxr-x 3 damu damu 4096 sep 21 09:52 .agents
  > drwxrwxr-x 3 damu damu 4096 sep 21 09:52 .claude
  > drwxrwxr-x 8 damu damu 4096 sep 21 09:52 .git
  > -rw-rw-r-- 1 damu damu   50 sep 21 09:52 package.json
  > -rw-rw-r-- 1 damu damu 1187 sep 21 09:52 TASK.md

  > Launching skill: testing

## assistant
- **Bash** `cat TASK.md && ls .claude/skills/testing && sed -n '1,120p' .claude/skills/testing/addresses/SKILL.md 2>/dev/null`

  > Exit code 2
  > Our vault routes deposits into Aave V3. The suite runs against a MockERC20 for the
  > underlying and a MockAavePool for the pool — 39 tests, all green, and they have been
  > green since the first commit.
  > 
  > We deployed to mainnet with USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) as the
  > underlying. Every deposit reverts on-chain. The revert carries no reason string. The
  > relevant lines are: … [805 more chars]

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why `deposit()` reverts on mainnet but never in the suite

## Short version

`usdt.approve(...)` is a **raw interface call, not a SafeERC20 call**. Real USDT's
`approve` retu … [11757 more chars]`

  > 276 answer.md

## assistant
Written to `answer.md`. The core of it:

**Why it reverts on mainnet only.** `usdt.approve(...)` is a raw `IERC20` call, not a SafeERC20 one. Real USDT's `approve` has no return value, but the compiler-generated call site for `IERC20.approve` does `if lt(returndatasize(), 32) { revert(0, 0) }` before decoding the `bool`. That empty-data revert from the ABI decoder is your reasonless revert — USDT actually executed the approval, then the decode killed the tx. A stock OZ `ERC20` returns `true`, so the mock can never hit that branch. Decimals are irrelevant; the difference is the token's return-data *shape*, not any value a test could pick.

**Why SafeERC20 didn't help.** `using SafeERC20 for IERC20` doesn't wrap anything — it only *adds* `safeTransferFrom`/`forceApprove`/etc. as extra methods. The raw `approve` stays callable and unprotected. Line 1 survives because `_callOptionalReturn` explicitly tolerates empty return data; line 2 never reaches that code path. Safety is per-call-site, not per-file.

**Why more mock tests couldn't find it.** Mocks encode your assumptions about the dependency, so they can only verify your code is consistent with those assumptions — never falsify them. The mock and the contract shared the same wrong belief.

**Fix 1 (code):** `usdt.forceApprove(address(aavePool), amount)`, plus a trailing `forceApprove(..., 0)`. I also flagged a second independent landmine on that line: USDT's `require(!((_value != 0) && (allowed[...] != 0)))` bricks every later deposit if any allowance dust is ever left behind — `forceApprove` handles that too, and deprecated `safeApprove` would not.

**Fix 2 (practice):** pinned-block fork tests against real USDT and the real Aave V3 Pool, in CI, gating merges. The answer includes a runnable `VaultForkUSDT.t.sol` with a two-deposit regression test that fails on call 1 under the current code and on call 2 under `safeApprove`.

## run stats
- turns: 6
- duration: 86s
- cost: $0.4003105
- tokens in/out: 94041/6879
- of which cache write/read: 19082/74951
