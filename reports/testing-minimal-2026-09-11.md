# eval: minimized testing skill (codex)

**Skill:** `skills/testing` at `0bc2e97b` (59 lines, 941 words; content hash
`9a4c7a72c983`) · **Executor:** codex `gpt-5.6-sol`, reasoning effort `low` ·
**Judge:** codex `gpt-5.6-sol` · **Runs:** 3 per variant per task, 36 total ·
**Date:** 2026-09-11 · `self_judged: true` throughout.

This is the rerun requested by issue #112 after the minimization in PR #107. It uses the
same six inputs and the same judge stack as the 2026-09-01 benchmark. Before setup, the
fixture's pinned dependencies were installed exactly as its task note requires and the
baseline was verified at 39/39 passing.

## Result

| Task | `no_skill` | `with_skill` | Delta |
| --- | ---: | ---: | ---: |
| `testing-goal-001` | 1/3 | **3/3** | **+2** |
| `testing-quiz-001` | 3/3 | 3/3 | 0 |
| `testing-quiz-002` | **3/3** | 1/3 | **-2** |
| `testing-quiz-003` | 3/3 | 3/3 | 0 |
| `testing-quiz-004` | 3/3 | 3/3 | 0 |
| `testing-quiz-005` | 3/3 | 3/3 | 0 |
| **Total** | **16/18** | **16/18** | **0** |

The aggregate tie hides two opposite movements. On the unprompted goal, the skill closes
all three failures seen in the controls: every skilled run finds and evidences all three
planted defects. On quiz-002, two skilled answers define the failing fee class as strictly
above 10,000 bps and omit the distinct zero-net/`NoSharesMinted` failure at exactly 10,000.
All three controls include it. Both failures are `expect_1`; expects 2-4 pass 6/6.

That residual is `testing-boundary-excluded-from-bound-class`, not a new mistake. The
minimized skill says to include both sides of every bound, but two runs still treat the
boundary as part of the safe class. The intended skill fix therefore did not hold on the
direct question, even though goal-001 expect 1 improved from 2/3 to 3/3 relative to the
September 1 skilled arm.

## PR #107 caveat: four quiz cells now measure recall

PR #107's review correctly found that the rewrite was informed by this benchmark's answer
key. The wording was pushed back from exact instances to general rules, but that does not
restore independence. In this rerun, four quiz cells are direct recall checks and two goal
cells are partly restated:

- goal-001 expects 1 and 3 are partly restated by the skill;
- quiz-001 expects 2-3 and quiz-004 expect 4 are now direct skill content;
- quiz-005 expect 4's one-sided-bound rule is now direct skill content.

Passes on those cells establish that the minimized text can be recalled and applied. They
are not fresh evidence that the model derived the testing judgment independently. This is
particularly limiting on quiz-001, quiz-004, and quiz-005, where both variants are saturated
at 3/3. A future judgment benchmark should rotate the planted defects rather than loosen
these rubrics. The unchanged inputs are retained here because issue #112 asks for a directly
comparable rerun of the minimized revision.

The routing risk raised in review did not materialize: all three skilled goal runs loaded
the testing skill and produced the requested defect report rather than routing the task away
to `security` or `audit`.

## What the goal task actually measured

The six FINDINGS files were cross-checked against their transcripts, as the task note
requires. Every distinct pasted `[FAIL]` line appears in the corresponding transcript
(25/25), and every displayed forge command appears exactly as executed (27/27). No
fabricated evidence or reconstructed-command mistake occurred.

| Variant/run | Fee defect | Accounting drift | Real USDT |
| --- | --- | --- | --- |
| no_skill 1 | missed | inspection + targeted unit test | synthetic no-return-token test; no real fork |
| no_skill 2 | only the value above the boundary | inspection + targeted unit test | recommended only; no fork evidence |
| no_skill 3 | targeted boundary unit tests | inspection + targeted unit tests | pinned mainnet fork |
| with_skill 1 | targeted boundary unit tests | inspection + targeted unit tests | pinned mainnet fork |
| with_skill 2 | fuzz confirmation | inspection + targeted unit test | pinned mainnet fork |
| with_skill 3 | targeted boundary unit test | inspection + targeted unit test | pinned mainnet fork |

The fork discipline remains the clean useful signal: 3/3 skilled runs against 1/3 controls
used a real mainnet fork and proved the deployed-USDT failure. Fuzzing did not become an
unprompted search habit. Only one skilled run fuzzed, and its transcript reasons to the bug
before writing the fuzz test; none of the controls fuzzed. No run used a stateful invariant
campaign to discover the accounting defect. The goal uplift is therefore finding-and-
evidencing uplift, not evidence that the skill caused fuzz or invariant discovery.

## Cost and duration

All figures below are the per-task medians and ranges emitted by `yarn run-stats`; Codex
does not report dollar cost. Token counts are comparable only within this Codex stack.

| Task | `no_skill` duration / tokens | `with_skill` duration / tokens |
| --- | --- | --- |
| `testing-goal-001` | 251s (203-283) / 57,367 (47,801-61,659) | 318s (285-405) / 56,671 (41,975-87,453) |
| `testing-quiz-001` | 73s (64-79) / 16,798 (16,547-18,840) | 64s (52-165) / 10,952 (9,396-16,103) |
| `testing-quiz-002` | 42s (36-55) / 8,051 (7,226-12,961) | 44s (44-45) / 15,238 (14,583-15,691) |
| `testing-quiz-003` | 48s (42-54) / 7,870 (7,711-12,695) | 49s (48-53) / 9,621 (9,561-16,501) |
| `testing-quiz-004` | 67s (63-69) / 9,055 (8,849-12,426) | 42s (37-51) / 8,361 (8,296-8,927) |
| `testing-quiz-005` | 69s (65-72) / 14,447 (13,958-16,422) | 74s (71-80) / 16,127 (11,980-16,999) |

The skill makes the goal slower (+67s median) while leaving median tokens essentially flat
(-696). Quiz cost is mixed: it helps materially on quiz-001 and quiz-004, but nearly doubles
tokens on the only correctness regression, quiz-002.

## Run integrity

Two first-attempt goal executors exited non-zero after a platform safety filter. They were
not graded or retained; fresh run IDs replaced them, as required for append-only runs. All
36 recorded runs finished with exit 0 and were graded independently. `output/answer.md` is
committed for every bare quiz run so the judgments remain auditable and regradeable; the
template-backed goal evidence is in `run.diff`.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **No overall: 16/18 vs 16/18.** It improved goal-001 to 3/3 from 1/3, offset by quiz-002 falling to 1/3 from 3/3. |
| Did it reduce time/tokens? | Mixed. Goal median was 318s / 56,671 tokens with skill vs 251s / 57,367 without. Quiz medians improved on 001 and 004, and worsened on 002, 003, and 005. |
| Did it create negative deltas? | Yes: quiz-002 `expect_1` regressed by 2/3 because two skilled answers omitted the failure at exactly 10,000 bps; the same arm used 15,238 median tokens vs 8,051. |
| What mistakes repeated without the skill? | `testing-goal-unbounded-fee-missed` (2/3), `testing-goal-usdt-fork-missed` (2/3), and `testing-no-fuzz-unprompted` (3/3). |
| What mistakes remained with the skill? | `testing-boundary-excluded-from-bound-class` (quiz-002, 2/3) and `testing-no-fuzz-unprompted` (2/3). |
| What should change in the skill? | The boundary instruction needs a concrete structural rule: enumerate the value immediately below, exactly at, and immediately above a limit, and state the distinct property expected in each region. Keep the current fork and routing language. The fuzz instruction still does not cause discovery; if that behavior matters, require the input-space search before accepting a hand-picked reproducer. |
| What should change in the eval? | Rotate the defects behind the PR #107-contaminated cells before treating another skilled pass as judgment evidence. Split goal-001 expect 2's finding from expect 4's fix so omitting one fix cannot lose two cells. Preserve exact judge reasons in `result.yaml`; without them, suspected false negatives remain unauditable. |
