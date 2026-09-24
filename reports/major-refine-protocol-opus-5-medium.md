# protocol — major-refine, Opus 5 medium

Benchmark id: `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)).
Benchmark commit `d9952522`.

| | |
| --- | --- |
| Executor | claude, `claude-opus-5`, effort `medium` |
| Judge | claude, `claude-opus-5`, effort `high` |
| Runs | 3 per arm per task, 18 graded runs in the tally, plus one extra graded run and one ungraded run (see "Run incidents") |
| Arms | none (`no_skill`) · old (`with_skill`, skill_version `2f0adb01`, 267 lines / 1,931 words) · new (`with_skill`, skill_version `d9952522`, 24 lines / 222 words) |
| `self_judged` | **true** on every graded run: judge and executor are both claude. That's a caveat on the numbers, not a defect in them. |
| Trigger | not forced. The skill triggered on its own in all 13 `with_skill` runs (one `Skill` call each). |

Tasks: `protocol-quiz-001`, `protocol-goal-001` (every live task whose `skill:` is `skills/protocol`).
Every graded run carries the same `input_sha` / `expect_sha` per task (quiz `3e5de462c7bd` / goal `bf6d1a188b62`).

## Headline: pass counts, new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| protocol-quiz-001 | 3/3 | 3/3 ¹ | 3/3 |
| protocol-goal-001 | 3/3 | 3/3 | 3/3 |

¹ Runs 1, 2 and 4. Run 3 is ungraded, and run 4 was set up to replace it (see "Run incidents").

Both tasks are **saturated on this stack**: every graded run passes every expect line (4/4 on the quiz,
5/5 on the goal), in all three arms. Pass rate cannot tell the arms apart. Opus 5 at medium effort no
longer holds the stale prior these tasks were built to catch: no run in any arm put Verkle forward as the
direction, every run named the binary tree (EIP-7864), grounded today in the hexary MPT, and refused a
hard dependency on an unscheduled fork. This matches the 2026-09-02 minimal-protocol benchmark
(`reports/protocol-minimal-2026-09-02.md`), which measured 6/6 vs 6/6 on the same two tasks.

## Ground truth revalidated

Both task notes ask for a revalidation of scheduling status, because quiz expect_4 and goal expect_2 grade
against current scope. Checked 2026-09-23, the day of the runs:

| Check | Status | Source |
| --- | --- | --- |
| EIP-7864 (binary tree) | **Draft**, no fork named | [eip-7864](https://eips.ethereum.org/EIPS/eip-7864) |
| Glamsterdam | 18 SFI. **No binary-tree / state-tree / Verkle EIP in SFI or CFI.** | meta [EIP-7773](https://eips.ethereum.org/EIPS/eip-7773) |
| Hegotá | SFI: FOCIL (7805), frame tx (8141); CFI: 8015. **No state-tree EIP.** | meta [EIP-8081](https://eips.ethereum.org/EIPS/eip-8081) |

The expect lines' "not scheduled" reading still holds, so no grade rests on stale ground truth.

## Cost: medians per arm, with ranges

From `yarn run-stats --tasks protocol-quiz-001,protocol-goal-001 --benchmark major-refine-d9952522`, split by
`--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. `cost_source: executor`
throughout (claude's own reported price).

| Task | arm | n | turns | duration | cost | cost range | total tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| protocol-quiz-001 | none | 3 | 9 | 157s | $0.68 | $0.57–$0.88 | 155,477 |
| protocol-quiz-001 | old | 4 ² | 23 | 196s | $0.99 | $0.83–$1.22 | 404,058 |
| protocol-quiz-001 | new | 3 | 23 | 221s | $0.94 | $0.80–$1.00 | 385,975 |
| protocol-goal-001 | none | 3 | 26 | 276s | $1.42 | $1.30–$1.79 | 463,403 |
| protocol-goal-001 | old | 3 | 25 | 245s | $1.35 | $1.26–$1.45 | 415,942 |
| protocol-goal-001 | new | 3 | 33 | 429s | $1.62 | $1.52–$2.82 | 602,150 |

² `run-stats` cannot exclude a run, so its old-arm quiz row counts the ungraded run 3 along with the three
graded ones. From the per-run rows of the same `--runs` output, the three graded runs (1, 2, 4) alone have a
median of 25 turns / 164s / $1.02 ($0.83–$1.22) / 441,124 tokens. The conclusion below holds either way.

Reading it:

- **Quiz: both skill texts cost about 2.5x the tokens of no_skill** (~390–440k vs 155k) and ~$0.30
  more per run, for the same 3/3. Old and new overlap completely. What the skill buys is visible in the
  transcripts, not the grade: every `with_skill` run fetched forkcast (13/13) and no `no_skill` run did
  (0/6). The no_skill quiz runs answered from 4–8 web searches and 0–2 fetches. So a skill pass is a
  *checked* answer and a no_skill pass is largely a *recalled* one (the task notes ask for exactly this
  split), but the rubric does not grade that difference.
- **Goal: old ≈ none, new is dearer.** New's median is $1.62 / 602k against $1.42 / 463k for none,
  and its range reaches $2.82 / 1.82M on run 1 (50 turns), the costliest run in the benchmark. At n=3 with
  overlapping low ends ($1.52 vs $1.30–$1.79) this is a lean, not a result. It matches the new text's
  instruction to check forkcast, the EIP and the fork meta-EIP for *every* future-feature claim, and a
  capacity brief makes many such claims.
- The refinement took the text from 1,931 words to 222 and moved neither pass rate nor quiz cost.
  Unlike ship, old-text overhead is not where this skill's cost goes.

## Run incidents

**`protocol-quiz-001/2026-09-23T073555Z-claude-with-skill-2f0adb01-3` is ungraded.** `verify`'s
judge-blindness guard refused it on `output/answer.md:61`:

> Per the skill's own guidance: no fork relationship means *not currently planned*, however loudly the
> roadmap talks about it.

This is a direct self-reference to the skill in the user-facing deliverable, not install-path boilerplate,
so I first treated it as the genuine leak the guard's message describes. I recorded it as a run incident
and set up a replacement, `…-2f0adb01-4`, which graded 4/4. Then I read #156's handling of the same guard
in this benchmark: it graded its hits with `--allow-skill-mention`, so as not to select the sample on the
behavior under test. I tried to do the same for consistency, but `verify` could no longer grade the run,
because **I had already deleted its workspace by hand** (after `output/` was captured, but before
settling the call). `verify` has no first-grade path from `output/`, and rebuilding the workspace by hand
would bypass the scripts, so the run stays ungraded. That was an operator error, and it has a cost:
the old-arm quiz tally is on runs 1, 2 and 4, a sample chosen partly on "did not cite the skill". Given
16/16 graded passes elsewhere on this task it is very unlikely to move the headline, but it is not an
unselected sample. The run's `transcript.md` and force-added `output/answer.md` are committed, so anyone
can read the deliverable. Filed as
[`protocol-skill-cited-in-deliverable`](../mistakes/protocol/protocol-skill-cited-in-deliverable.yaml)
(old 1/7, new 0/6, none 0/6).

No other incidents: no session limits, no non-zero exits, no `--grade-failed-run`, no other blindness
refusals, no deleted runs.

## Evidence committed

Every run's `output/` (one `answer.md` or `brief.md`, ≤32K) is force-added, so every grade here can be
regraded from any clone.

## Summary

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No, saturated. quiz new · old · none `3/3 · 3/3 · 3/3`; goal `3/3 · 3/3 · 3/3`. New vs old: no difference. |
| Did it reduce time/tokens? | No. Quiz: new 221s / 386k / $0.94, old 164s / 441k / $1.02 (graded runs), none 157s / 155k / $0.68. Goal: new 429s / 602k / $1.62, old 245s / 416k / $1.35, none 276s / 463k / $1.42. New vs old is a wash on the quiz and a lean toward new costing more on the goal. |
| Did it create negative deltas? | Cost only: both texts ~2.5x no_skill tokens on the quiz. The new text leans dearer on the goal (one 1.82M-token run). One old-arm run cited the skill in its deliverable (`protocol-skill-cited-in-deliverable`). No correctness regressions. |
| What mistakes repeated without the skill? | None graded. no_skill runs did not check forkcast (0/6), but that is not graded. |
| What mistakes remained with the skill? | `protocol-skill-cited-in-deliverable`, old arm only (1/7), new 0/6. |
| What should change in the skill? | Nothing on this evidence. The new text already says "cite the live sources checked", which is the fix for the one mistake seen. If the goal-cost lean holds on other stacks, scope the three-source check to claims the plan actually depends on. |
| What should change in the eval? | Both tasks are saturated on Opus 5 medium, as they were on 2026-09-02. The eval, not the skill, is the weak artifact here. What separates the arms is *checked vs recalled* (forkcast fetched 13/13 vs 0/6), and no expect line grades it. A line requiring the answer to cite a live fork-scope source (forkcast or the fork meta-EIP) would measure the skill's actual instruction. Raise on #119; the rubric is pinned for this benchmark. |
