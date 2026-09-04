# Eval report — minimal `security` skill (codex stack)

**Skill:** `skills/security` @ `dcd9152a` (56 lines, reduced from 487)

**Executor:** codex, `gpt-5.4` — fresh process per run

**Judge:** codex, `gpt-5.4` — fresh blind process per run

**Runs:** 3 per variant per task; 8 tasks × 2 variants × 3 = 48 graded runs

**Date:** 2026-09-04; content-only variant, with no trigger line prepended

Every run has `self_judged: true` because executor and judge used the same
Codex stack. Grading remained independent: `verify` launched a fresh judge
that saw the task and captured evidence, but not the skill, variant, or
executor transcript.

## Headline

| Task | no_skill | with_skill | no_skill median | with_skill median |
| --- | ---: | ---: | ---: | ---: |
| security-quiz-001 — ERC-4626 donation attack | 3/3 | 3/3 | 60s / 13,322 tokens | 57s / 13,124 tokens |
| security-quiz-002 — DEX spot is not an oracle | 2/3 | 3/3 | 127s / 20,151 tokens | 112s / 20,090 tokens |
| security-quiz-003 — balance-delta crediting | 3/3 | 3/3 | 61s / 15,395 tokens | 71s / 13,819 tokens |
| security-quiz-004 — USDT approval / OZ v5 | 3/3 | 3/3 | 41s / 9,341 tokens | 46s / 10,858 tokens |
| security-quiz-005 — EIP-712 cross-chain replay | 0/3 | 3/3 | 49s / 10,554 tokens | 51s / 12,341 tokens |
| security-quiz-006 — append-only storage | 3/3 | 3/3 | 48s / 10,073 tokens | 49s / 12,260 tokens |
| security-goal-001 — permissionless vault | 1/3 | 3/3 | 178s / 33,689 tokens | 218s / 40,747 tokens |
| security-goal-002 — borrowing market | 1/3 | 3/3 | 176s / 31,360 tokens | 339s / 50,766 tokens |
| **All tasks** | **16/24** | **24/24** | **60.5s / 13,955.5 tokens** | **68s / 13,791 tokens** |

The minimal skill improved pass rate by 33 percentage points, from 16/24 to
24/24. Its strongest separators were unchanged from PR #100: the unprompted
vault build and fork-aware EIP-712 handling. It also eliminated two unsafe
bare-ERC20 borrowing-market builds and one oracle-max-age omission.

The reduction removed the old skill's token penalty. PR #100 measured the
487-line skill at 18,545.5 median tokens versus 11,664.5 no_skill (+59%). This
run measured 13,791 with_skill versus 13,955.5 no_skill (-1%). Median duration
was 68s versus 60.5s (+12%). Pooling six quizzes and two goals makes that
aggregate mostly a quiz statistic; the goal-002 skilled arm remained costly at
339s / 50,766 tokens versus 176s / 31,360.

Codex does not report dollar cost, so none is derived here. All duration and
token figures come from the run `usage` records via `yarn run-stats` (the
aggregate median is the midpoint of the 12th and 13th sorted values).

## What changed behavior

- **Vault donation defense:** two of three no_skill goal builds shipped the
  vulnerable empty-vault 1:1 path; every skilled build protected it. The third
  no_skill run improved over PR #100, but the stale default remains common.
- **EIP-712 fork invalidation:** all three no_skill answers again trusted a
  constructor-cached separator after a chain-id change. All three skilled
  answers handled invalidation, improving the old skill's 2/3 to 3/3.
- **ERC-20 integration:** two no_skill borrowing markets used boolean-assuming
  token calls; every skilled market used SafeERC20 or an equivalent checked
  low-level call.
- **Oracle freshness:** one no_skill answer required a configurable max age but
  never tied it to the selected feed's heartbeat. Every skilled answer did.

The corrected `forceApprove` guidance also survived: quiz-004 passed 3/3 in
both arms, and no skilled run copied the removed OZ v5 `safeApprove` API.

## Rubric correction and regrades

The first blind reading exposed two expectation wordings that rejected correct
answers:

- `security-quiz-002` did not state clearly enough that Chainlink alone is an
  acceptable primary source and that TWAP is optional, nor that a configured
  per-feed max age derived from the heartbeat is the required freshness shape.
- `security-quiz-003` said to account for outbound transfers “the same way,”
  which made the judge demand a second balance-delta credit mechanism even
  though debiting the requested amount already equals what leaves the pool.

The accepted security behavior did not change. Both expect lists were made
explicit and all six runs of each task were regraded with the same judge. The
headline uses these twelve `-regrade-1` records, not their superseded source
grades. Quiz-002 moved from 1/3 vs 2/3 to 2/3 vs 3/3; quiz-003 moved from 2/3
vs 2/3 to 3/3 vs 3/3.

## Mistakes

Repeated without the skill:

- `security-vault-first-depositor-unmitigated` — 2/3 goal builds
- `security-bare-erc20-transfer` — 2/3 borrowing-market builds
- `security-eip712-fork-domain-cache` — 3/3 answers
- `security-oracle-maxage-not-feed-derived` — 1/3 answers

No graded mistake remained with the minimal skill. The fork-domain,
`safeApprove`, and hardcoded-3600 skill defects are marked fixed and carry this
run as verification. Other historical records remain open as observations;
this sample does not erase their earlier frequencies.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes: 24/24 with_skill vs 16/24 no_skill. |
| Did it reduce time/tokens? | Tokens were effectively flat/slightly lower: 13,791 vs 13,955.5 median; duration increased to 68s from 60.5s. Goal-002 remained substantially slower and larger with the skill. |
| Did it create negative deltas? | No correctness regressions. Duration increased on quiz-003, quiz-004, quiz-005, quiz-006 and both goals; goal-002 was the material increase. |
| What mistakes repeated without the skill? | `security-vault-first-depositor-unmitigated`, `security-bare-erc20-transfer`, `security-eip712-fork-domain-cache`, `security-oracle-maxage-not-feed-derived`. |
| What mistakes remained with the skill? | None in the final grading. |
| What should change in the skill? | Keep the 56-line reduction. Its targeted vault, ERC-20, oracle, EIP-712 and storage nudges retained or improved correctness while removing the prior token overhead. Investigate goal-002's execution cost before adding any content. |
| What should change in the eval? | The quiz-002 and quiz-003 expectation clarifications made in this branch should remain; no task input needs changing. |
