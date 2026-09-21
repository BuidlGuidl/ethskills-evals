# Executor transcript — 2026-09-21T124545Z-claude-with-skill-2f0adb01-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-21T124545Z-claude-with-skill-2f0adb01-1/testing-quiz-006

## assistant
- **Bash** `ls -la && find . -path ./.git -prune -o -type f -print | head -50`

## assistant
- **Skill** `{"skill":"testing"}`

  > total 28
  > drwxrwxr-x 5 damu damu 4096 sep 21 09:45 .
  > drwxrwxr-x 3 damu damu 4096 sep 21 09:45 ..
  > drwxrwxr-x 3 damu damu 4096 sep 21 09:45 .agents
  > drwxrwxr-x 3 damu damu 4096 sep 21 09:45 .claude
  > drwxrwxr-x 8 damu damu 4096 sep 21 09:45 .git
  > -rw-rw-r-- 1 damu damu   50 sep 21 09:45 package.json
  > -rw-rw-r-- 1 damu damu 1325 sep 21 09:45 TASK.md
  > ./package.json
  > ./TASK.md
  > ./.claude/skills/testing/SKILL.m … [35 more chars]

  > Launching skill: testing

## assistant
- **Bash** `cat TASK.md && ls .claude/skills/testing/`

  > Write your answer to answer.md.
  > 
  > I am reviewing the test plan for a new onchain credit pool before deployment. The
  > current unit suite is green and covers every line, but it only uses local mocks and
  > one-operation examples. The implementation has these three independent surfaces:
  > 
  > 1. Governance can set `reserveFactorWad`. A redemption computes
  >    `net = assets * (1e18 - reserveFactorWad) / 1e18` an … [933 more chars]

## assistant
No repo code here — `TASK.md` is the whole task, so this is a review answer. Writing it now.

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Pre-deploy test review: onchain credit pool

## Verdict: no, this is not enough to sign off.

"Green suite, every line covered, local mocks, one-operation examples" is the ex … [19278 more chars]`

  > 388 answer.md

## assistant
Written to `answer.md`. Short version:

**No — don't sign off.** Green + full line coverage on mocks proves the code runs, not that it's correct. Line coverage counts lines executed, not states reached, and all three surfaces are state-space or integration problems.

**1. `reserveFactorWad`** — the decisive question is a source read, not a test: is `1e18 - reserveFactorWad` inside `unchecked`? Checked → any value `> 1e18` panics and bricks every redemption (one governance tx = permanent withdrawal freeze). Unchecked → it wraps to a near-max multiplier and the thing becomes a drain. Limit cases to pin: `0`, `1`, `1e18-1`, `1e18`, `1e18+1`, `type(uint256).max`. The one the plan will miss is `1e18-1`, where `net = assets/1e18` — for a 6-decimal asset that means every redemption under a trillion tokens rounds to zero and hits the `net == 0` revert. There's a whole *region* of legal-looking high reserve factors with that DoS. Fuzz the **raw** setter input unbounded; bounding to `[0, 1e18]` tests a cap you haven't written.

**2. Repayment drift** — one observation at N=1 can't distinguish a one-time offset from a per-operation drift. Require `assertEq(drift, Σ cut_i)` in closed form plus strict monotonicity across N repayments — the closed form identifies the mechanism, not just a trend. Then a two-depositor test quantifying who is short-changed (`accountedAssets` *understates* real holdings, so exiting LPs are paid short and the surplus strands) and an invariant on `balanceOf == accountedAssets + protocolReserves` — if there's no `protocolReserves` term to write, that absence *is* the bug. Critically: require handler call-count evidence, or the invariant passes vacuously over states where `repay` barely executed.

**3. Chainlink + collateral** — a standard-behaviour mock only confirms your code agrees with your own assumptions. Fork at a **pinned block** (two blocks, calm and volatile), assert the addresses themselves in `setUp` (`code.length`, `description()`, `symbol()`, `decimals()`), read `decimals()` live rather than hardcoded — a mock at 18 vs. a real USD feed at 8 is a 1e10 error in liquidation math. Inject staleness/zero/negative answers with `vm.mockCall` **on the real forked address** so everything else stays real. Fund via whale prank, not `deal()` (slot inference breaks on proxies). Cached RPC + required CI job.

Surfaces 1 and 2 look like potential loss-of-funds findings rather than coverage gaps — I'd expect at least one to change the contract, not just the suite.

## run stats
- turns: 6
- duration: 153s
- cost: $0.5548165
- tokens in/out: 96963/11363
- of which cache write/read: 23392/73563
