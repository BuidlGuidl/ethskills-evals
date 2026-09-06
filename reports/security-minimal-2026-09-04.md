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

**Durations were measured under concurrency, and not matched concurrency.**
`executor.yaml` shows the loop running up to four-wide — four runs start
together at `13:00:06`, one of them a quiz alongside all three goal-002
`with_skill` builds. The two goal-002 arms also straddle two batches:
`no_skill` ran 04:19–04:25 on 2026-09-04, `with_skill` 13:00–13:05. PR #100
carried the same caveat, and it applies here for the same reason: wall-clock is
the one column concurrency moves, tokens are not affected.

The goal-002 duration finding survives that caveat — the per-run ranges do not
overlap, 165/176/249s `no_skill` against 275/339/346s `with_skill`. The token
half is weaker: 27,881–54,659 against 46,417–70,604, which overlaps. So read
"339s / 50,766 tokens versus 176s / 31,360" as a duration result with a token
median inside a shared spread, not as two independent separations.
`run-stats` prints a cost range but no token range, so this can only be said in
prose; the per-run numbers behind it come from
`yarn run-stats --tasks security-goal-002 --runs`.

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

The twelve, all under `artifacts/`:

| task | regrade dirs (`2026-09-04T…-codex-…-regrade-1`) |
| --- | --- |
| `security-quiz-002` | `125920Z-no-skill-1`, `125921Z-no-skill-2`, `125922Z-no-skill-3`, `125923Z-with-skill-1`, `125924Z-with-skill-2`, `125925Z-with-skill-3` |
| `security-quiz-003` | `125926Z-no-skill-1`, `125926Z-no-skill-2`, `125927Z-no-skill-3`, `125928Z-with-skill-1`, `125929Z-with-skill-2`, `125930Z-with-skill-3` |

**One of the two clarifications made a check stricter, and it flipped a run.**
Quiz-002's `expect_4` gained an explicit failure condition — "a bare
`latestAnswer()`, an unchecked `latestRoundData()`, or one global timeout
asserted to fit every feed fails" — alongside the loosening in `expect_3`.
`2026-09-04T125920Z-codex-no-skill-1` passed `expect_4` on the original wording
and fails it on the new one. It is the only run of the twelve that got worse:
the other five run-level flips — quiz-002 `no-skill-2`, `no-skill-3` and
`with-skill-2`, quiz-003 `no-skill-3` and `with-skill-2` — all went fail→pass. So
"only the expectation wording changed" is true of the task input and the
accepted behavior, but the wording is not uniformly looser, and the new
`security-oracle-maxage-not-feed-derived` record rests entirely on that one
run turning over. It did not widen the headline gap: pre-regrade the tally
would have been 14/24 vs 22/24, post-regrade 16/24 vs 24/24 — delta 8 either
way.

The stricter clause is close to the rewritten skill's own wording ("never one
global hardcoded timeout"), which is worth naming as a risk rather than
defending: an expect line that tracks the skill text is the failure mode this
suite has documented before. It is kept because the underlying claim predates
the rewrite — `security-hardcoded-3600-staleness` was filed on 2026-07-28
against the old skill's snippet — but the aided arm's 3/3 on `expect_4` should
be read with that overlap in view.

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

Every open security record now points at a heading that exists in the rewritten
file: `skill_section` was repointed from the pre-`dcd9152a` headings
("SafeERC20", "Token Decimals Vary", "Never Use DEX Spot Prices as Oracles",
"Vault Inflation Attack", "Pre-Deploy Security Checklist — Fee-on-transfer
safe") onto "Asset accounting" and "Prices and liquidations", with the old
heading kept in a comment. `security-eip712-fork-domain-cache` moves from
`"none"` — it was filed as a content gap — to "Signatures and replay
protection", and its `frequency` block now carries a skill revision per
measurement, so the superseded `with_skill 1/3` at `191dcc1` sits beside the
`0/3` at `dcd9152a` that `status: fixed` rests on.

## What is not covered

**"No correctness regression" is a statement about eight tasks, not about the
431 deleted lines.** The reduction removed whole sections that nothing in this
suite grades, so their loss is untested rather than shown harmless:

- **MEV and sandwich attacks** — the entire `## MEV & Sandwich Attacks` section:
  Flashbots Protect and private mempools, per-asset slippage sizing (0.5–1% for
  majors, 1–3% for small tokens), MEV-aware aggregators, and when MEV does and
  does not matter. The one adjacent check is goal-002's conditional `expect_6`,
  which grades a non-zero minimum output *if* the liquidation path swaps — and
  the new file keeps that one clause ("bound … any swap's minimum output").
  Everything else in the section is ungraded.
- **UUPS vs Transparent** — the proxy-pattern choice and the UUPS
  implementation example. quiz-006 grades storage layout only; the new file
  keeps the append-only rule and drops the pattern comparison.
- **`delegatecall`** — the old `### Delegatecall` section. The new file keeps
  one sentence ("never `delegatecall` to a user-selected target") and no task
  reaches it.
- **`### 9. Input Validation`** — zero-address, zero-amount, bounds,
  array-length-mismatch and duplicate-entry checks as a standalone section. The
  goal tasks could surface these in code review, but no expect line asks for
  them.
- **Static-analysis commands** — the old `## Automated Security Tools` block's
  concrete invocations (`slither .`, `mythril analyze`, `forge test
  --fuzz-runs`) and its "Slither findings to NEVER ignore" list. The new file
  says "run static analysis and resolve every high or medium finding" without
  naming a tool or a command, and nothing grades either form.
- **`### 2. No Floating Point in Solidity`** and **`### 3. Reentrancy`** as
  worked examples with code. Both survive as one line each under "Asset
  accounting"; the compressed form is what the passing runs acted on, but no
  task separates the line from the example.

**The rewritten `description` is an unnamed confound.** The frontmatter
description was replaced wholesale — from "Solidity security patterns, common
vulnerabilities, and pre-deploy audit checklist…" to an explicit
when-to-use list — and that field is loaded before the body is. It is not a
*firing* difference: all 24 `with_skill` runs here read
`.agents/skills/security/SKILL.md`, and so did all 24 in PR #100, so the skill
loaded in every run of both benchmarks. The untested part is what the new
description contributes on its own. It enumerates "custody assets, account for
shares or debt, consume price oracles, verify signatures, integrate ERC-20s, or
use upgradeable proxies" — which is close to a table of contents for the eight
graded tasks — and no run in this suite reads the new description with the old
body, or the reverse, so nothing here can attribute the gain between the two.

**And nothing here could catch the new `Not for` clause misfiring.** The
description now excludes test-suite design (`testing`) and full audits
(`audit`). All eight tasks are security-shaped and none is either of those, so
a routing loss on a testing- or audit-shaped prompt would not show up as any
number in this report.

Also unmeasured: one model tier — everything is codex / `gpt-5.4`, so nothing
here says whether a weaker model needs the deleted material; n=3 per cell, with
the goal tasks' within-cell token spread exceeding the between-cell delta; and
`self_judged: true` on all 48, since one stack supplied both executor and
judge.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes: 24/24 with_skill vs 16/24 no_skill. |
| Did it reduce time/tokens? | Tokens were effectively flat/slightly lower: 13,791 vs 13,955.5 median; duration increased to 68s from 60.5s. Goal-002 remained substantially slower with the skill (275–346s vs 165–249s, non-overlapping) and larger in the median, though its token ranges overlap. Durations were measured up to four-wide and the two goal-002 arms ran in different batches — see the concurrency caveat above. |
| Did it create negative deltas? | No correctness regressions. Duration increased on quiz-003, quiz-004, quiz-005, quiz-006 and both goals; goal-002 was the material increase, and it is the duration column that carries it. The one run that got worse on regrade (quiz-002 `no-skill-1`, `expect_4`) is a rubric effect in the unaided arm, not a skill delta. |
| What mistakes repeated without the skill? | `security-vault-first-depositor-unmitigated`, `security-bare-erc20-transfer`, `security-eip712-fork-domain-cache`, `security-oracle-maxage-not-feed-derived`. |
| What mistakes remained with the skill? | None in the final grading. |
| What should change in the skill? | Keep the 56-line reduction. Its targeted vault, ERC-20, oracle, EIP-712 and storage nudges retained or improved correctness while removing the prior token overhead. Nothing here argues for restoring the MEV, UUPS-vs-Transparent, `delegatecall`, input-validation or static-analysis-command material — but nothing here argues against it either, since no task grades any of it; that is a gap in the eval, not evidence about the file. Investigate goal-002's execution cost before adding any content back. |
| What should change in the eval? | Keep the quiz-002 and quiz-003 expectation clarifications; no task input needs changing. Add coverage for the deleted-and-ungraded surface above — MEV/slippage and input validation are the two a goal task could reach without a new template. Build one task the description should *not* fire on (testing- or audit-shaped), since nothing here can catch a routing loss. Raise n on goal-002 before its token delta is reported as a finding, and run the two arms at matched concurrency if wall-clock is going to carry a conclusion. |
