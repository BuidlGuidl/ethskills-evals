# eval: minimized testing skill (codex)

**Skill:** `skills/testing` at `0bc2e97b` (59 lines, 941 words; content hash
`9a4c7a72c983`), then boundary patch `0ce60b2f` (59 lines, 965 words; content hash
`0f32ad1c8ffc`) · **Executor:** codex `gpt-5.6-sol`, reasoning effort `low` ·
**Judge:** codex `gpt-5.6-sol` · **Runs:** 3 per variant per task initially (36), then
3 fresh `with_skill` runs per task at the patch (18); 54 recorded runs total ·
**Date:** 2026-09-11–12 · `self_judged: true` throughout.

This is the rerun requested by issue #112 after the minimization in PR #107. It uses the
same six inputs and the same judge stack as the 2026-09-01 benchmark. Before setup, the
fixture's pinned dependencies were installed exactly as its task note requires and the
baseline was verified at 39/39 passing.

## Result

| Task | `no_skill` | `with_skill` `0bc2e97b` | patched `with_skill` `0ce60b2f` |
| --- | ---: | ---: | ---: |
| `testing-goal-001` | 1/3 | **3/3** | 1/3 |
| `testing-quiz-001` | 3/3 | 3/3 | 3/3 |
| `testing-quiz-002` | 3/3 | 1/3 | **3/3** |
| `testing-quiz-003` | 3/3 | 3/3 | 3/3 |
| `testing-quiz-004` | 3/3 | 3/3 | 3/3 |
| `testing-quiz-005` | 3/3 | 3/3 | 3/3 |
| **Total** | **16/18** | **16/18** | **16/18** |

The initial aggregate tie hides two opposite movements. At `0bc2e97b`, on the unprompted
goal, the skill closes all three failures seen in the controls: every skilled run finds and evidences all three
planted defects. On quiz-002, two skilled answers define the failing fee class as strictly
above 10,000 bps and omit the distinct zero-net/`NoSharesMinted` failure at exactly 10,000.
All three controls include it. Both failures are `expect_1`; expects 2-4 pass 6/6.

That residual is `testing-boundary-excluded-from-bound-class`, not a new mistake. The
minimized skill says to include both sides of every bound, but two runs still treat the
boundary as part of the safe class. The intended skill fix therefore did not hold on the
direct question, even though goal-001 expect 1 improved from 2/3 to 3/3 relative to the
September 1 skilled arm.

### Follow-up patch and rerun

The observed cause was ambiguous wording: "both sides" invites a below/above split and
does not force the boundary itself to be treated as its own region. Patch `0ce60b2f`
replaces it with a reusable three-case rule — nearest value below, exactly at, nearest
value above — and requires each case to be traced through downstream checks. It does not
name this task's denominator or failure.

That targeted result is clean: quiz-002 moved from **1/3 to 3/3**. Every patched answer
separately derives the exact-limit zero-share revert and the above-limit underflow, and
recommends a strict bound.

The full rerun prevents reading that local fix as a blanket improvement. Patched goal-001
fell from 3/3 to 1/3. Two runs showed only one withdrawal and did not numerically establish
the accumulating accounting gap required by expect 2. One of those also described both fee
failures but pasted output only for the above-limit case, failing expect 1. These are
sampling-sensitive residuals already represented by
`testing-goal-accounting-drift-not-evidenced` and
`testing-boundary-excluded-from-bound-class`; the two-line boundary edit did not cause the
accounting miss. The corrected skill therefore still ties the control at 16/18 overall.

The patched goal evidence is genuine and reproducible: all 14 distinct pasted failure
lines and all 15 displayed forge commands occur in the corresponding transcripts. All
three runs used a pinned real-USDT fork. One fuzzed the above-limit fee domain; two used
targeted unit tests, and none used a stateful invariant campaign.

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

| Task | `no_skill` duration / tokens | `with_skill` `0bc2e97b` | patched `with_skill` `0ce60b2f` |
| --- | --- | --- | --- |
| `testing-goal-001` | 251s (203-283) / 57,367 (47,801-61,659) | 318s (285-405) / 56,671 (41,975-87,453) | 361s (308-396) / 66,950 (57,270-77,567) |
| `testing-quiz-001` | 73s (64-79) / 16,798 (16,547-18,840) | 64s (52-165) / 10,952 (9,396-16,103) | 48s (46-50) / 10,770 (10,410-18,179) |
| `testing-quiz-002` | 42s (36-55) / 8,051 (7,226-12,961) | 44s (44-45) / 15,238 (14,583-15,691) | 47s (45-47) / 10,104 (10,084-13,929) |
| `testing-quiz-003` | 48s (42-54) / 7,870 (7,711-12,695) | 49s (48-53) / 9,621 (9,561-16,501) | 44s (42-45) / 9,751 (9,535-17,117) |
| `testing-quiz-004` | 67s (63-69) / 9,055 (8,849-12,426) | 42s (37-51) / 8,361 (8,296-8,927) | 35s (34-40) / 8,704 (8,690-13,975) |
| `testing-quiz-005` | 69s (65-72) / 14,447 (13,958-16,422) | 74s (71-80) / 16,127 (11,980-16,999) | 51s (50-53) / 16,160 (11,278-18,712) |

The skill makes the goal slower (+67s median) while leaving median tokens essentially flat
(-696). Quiz cost is mixed: it helps materially on quiz-001 and quiz-004, but nearly doubles
tokens on the only correctness regression, quiz-002.

At the patch, quiz-002 becomes both correct and cheaper than the first skilled arm: 10,104
median tokens against 15,238, though still above the 8,051-token control. The patched goal
is slower and more expensive than both earlier arms.

## Run integrity

Two first-attempt goal executors exited non-zero after a platform safety filter. They were
not graded or retained; fresh run IDs replaced them, as required for append-only runs. All
36 initial and 18 patched recorded runs finished with exit 0 and were graded independently.
During the patched run, one capacity exit and two invalid captures were stopped, deleted,
and replaced before grading; they are not measurements. `output/answer.md` is committed for
every bare quiz run so the judgments remain auditable and regradeable; the template-backed
goal evidence is in `run.diff`.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **No overall: patched skill 16/18 vs control 16/18**, identical to the first skilled arm. The patch fixes quiz-002 from 1/3 to 3/3 but its fresh goal arm falls from 3/3 to 1/3. |
| Did it reduce time/tokens? | Mixed. Patched goal median was 361s / 66,950 tokens vs control 251s / 57,367. The patched quiz arm was faster on four of five tasks; tokens were lower only on quiz-001 and quiz-004. |
| Did it create negative deltas? | The patch removes the quiz-002 negative delta. Its fresh goal arm is 1/3, tied with control but 2/3 below the first skilled arm; the misses are accounting evidence (2/3) and one incomplete two-sided fee reproduction. |
| What mistakes repeated without the skill? | `testing-goal-unbounded-fee-missed` (2/3), `testing-goal-usdt-fork-missed` (2/3), and `testing-no-fuzz-unprompted` (3/3). |
| What mistakes remained with the skill? | At `0ce60b2f`: `testing-goal-accounting-drift-not-evidenced` (2/3), `testing-boundary-excluded-from-bound-class` (goal shape, 1/3), and `testing-no-fuzz-unprompted` (2/3). The quiz-002 instance is fixed 3/3. |
| What should change in the skill? | Keep the three-case boundary patch: it fixed its target without copying the answer. Do not chase the fresh accounting variance with another answer-key edit; the skill already requires sequences and custody invariants. The remaining method gap is that 2/3 goal runs still did not fuzz, and none discovered the accounting issue through an invariant campaign. |
| What should change in the eval? | Rotate the defects behind the PR #107-contaminated cells before treating another skilled pass as judgment evidence. Split goal-001 expect 2's finding from expect 4's fix so omitting one fix cannot lose two cells. Preserve exact judge reasons in `result.yaml`; without them, suspected false negatives remain unauditable. |
