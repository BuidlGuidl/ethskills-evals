# eval: minimal gas skill, regraded against a rubric that requires a measurement

**Supersedes** `reports/gas-minimal-2026-08-28.md`, which is kept and annotated.

**Skill:** `skills/gas` at `017d9dc` (38 lines, 308 words) for the headline cells; the
2026-08-27 `with_skill` runs are `8b199ff` (36 lines, 265 words) and are reported separately,
never blended.
**Executor:** codex `gpt-5.6-terra` · **Judge:** claude `claude-opus-5` · `self_judged: false`
throughout.
**Date:** 2026-08-31. No executor ran. Every number below comes from re-judging committed
evidence with `yarn verify --regrade`; 18 runs, two passes over `gas-goal-001` and one over
`gas-goal-002`.

**Which reading this table is on.** The regrades are their own records —
`artifacts/gas-goal-00{1,2}/<run-id>-regrade-<n>/result.yaml`, each naming its source in
`regrade_of` and its rubric in `expect_sha`. The source runs keep the grades they were first
given, and nothing in those files says a later reading exists: open
`artifacts/gas-goal-001/2026-08-28T013258Z-codex-with-skill-1/result.yaml` and it still reads
4/4 pass, the number this report exists to withdraw. The cells below are the **latest regrade**
of each run; the "was" column is the first grading. Count from the `-regrade-2` dirs for
`gas-goal-001` and the `-regrade-1` dirs for `gas-goal-002`.

## Why this exists

Review of PR #57 found that `gas-goal-001` had no expect line requiring a measurement. Its
`expect_4` explicitly passed a setup with no fee overrides and its `expect_3` bit only on an
estimate that was actually stated, so a run that measured nothing and picked a chain on
unrelated grounds scored 4/4. Two did. `gas-goal-002`'s `expect_5` was inert in the opposite
direction: it could only fail a plan that showed its components, so a plan with no usable
numbers passed the arithmetic-consistency check, and all three controls passed it.

Both rubrics were fixed. `verify --regrade` was built in the same pass, because until now the
only way to answer an edited expect line was a fresh executor run — which is what made
editing a task's `input` look cheaper than editing its `expect`, the more destructive of the
two choices.

## Results at `017d9dc`

| Task | `no_skill` | `with_skill` | was |
| --- | ---: | ---: | ---: |
| `gas-goal-001` | 0/3 | **0/3** | *3/3* |
| `gas-goal-002` | 0/3 | **3/3** | 3/3 |
| `gas-quiz-001` | 0/3 | **3/3** | 3/3 |
| `gas-quiz-003` | 1/3 | **3/3** | 3/3 |
| **total** | **1/12** | **9/12** | *12/12* |

`gas-goal-001` at `8b199ff` (the 2026-08-27 skilled arm, a different skill revision) is 1/3.

## gas-goal-001 no longer supports the claim it was cited for

The PR called this task "the cleanest signal". Under a rubric that asks for the measurement,
it shows **no delta**. Worse, reading the six skilled runs directly — transcript against
README, which the judge never gets to do — the picture is not a grading artifact:

| Run | Skill rev | Measured? | Converted? | In the README |
| --- | --- | --- | --- | --- |
| `233109…with-skill-1` | 8b199ff | yes | **÷1e6** → $503 to deploy, mainnet ruled out | no figures at all |
| `233445…with-skill-2` | 8b199ff | **no** | — | none |
| `233831…with-skill-3` | 8b199ff | yes, 52,042,833 wei | **÷1e6** → "52 gwei" | "52 gwei", "0.006 gwei" |
| `013258…with-skill-1` | 017d9dc | **no** | — | none |
| `013927…with-skill-2` | 017d9dc | yes, 49,519,046 wei | not converted | raw wei only |
| `014313…with-skill-3` | 017d9dc | yes, 56,249,696 wei | **correct** | wei and gwei both |

One run in six both measured and converted correctly. Two measured nothing at all despite
reading `SKILL.md` first — `233445` has no `cast base-fee`, no `cast gas-price`, no `gwei`,
no `curl` and no price lookup across 7,213 transcript lines, and `013258` none across 11,767.
Three measured and then lost the unit.

`233831` deserves its own line, because it was the single run that *passed* the corrected
rubric. It read 52,042,833 wei, wrote "approximately 52 gwei on Ethereum mainnet", and two
clauses later converted Base's 6,000,000 wei to 0.006 gwei correctly. One run, two chains,
two divisors — and it passes, because the README shows only the converted figure and the
judge has nothing to check it against.

That is the limit worth taking away: **the judge sees `output/`, not the transcript, so a
unit-consistency expect can only catch this error where the run happens to report both the
raw reading and the converted one.** `014313` is checkable because it wrote
"56,249,696 wei (0.056249696 gwei)". `233831` is not. The check is conditional on a reporting
habit the task never asks for. Filed as the closing note on
`mistakes/gas/gas-wei-read-as-gwei.yaml`.

`014313`, the one correct run, fails `expect_2`: it chose Base and never conceded mainnet was
viable, putting the two gas prices side by side as the supporting evidence. That is the line
working as written.

## What still holds

`gas-goal-002` is the result this PR can stand on. **3/3 vs 0/3**, unchanged through a rubric
fix that made `expect_5` strictly harder — the controls that passed it by having nothing to
check now fail it. Its `expect_4` ("cost figures rest on live-checked values") is the line
`gas-goal-001` was missing, and it discriminates: every control failed it, every skilled run
passed.

`gas-quiz-001` 3/3 vs 0/3 and `gas-quiz-003` 3/3 vs 1/3 are unchanged; their expect lines were
not touched, so they were not regraded and their records carry no `expect_sha`, which reads as
"graded before the field existed". For those two tasks there is only one reading, so the run
dirs are the whole record.

## Rubric provenance, stated because it matters

`gas-goal-001`'s new lines were written after reading the runs they grade. That is
contamination and the task notes say so. The requirements trace to the skill's own text —
it tells the reader to divide by 1e9, and to measure before excluding a chain — and to a
review comment written independently of these runs, but the order things happened in is
what it is, and the two-pass history is in `tasks/gas-goal-001.yaml`. A reader who wants an
uncontaminated number should discount `gas-goal-001` entirely and read `gas-goal-002`, whose
`expect_4` predates all of this.

## Cost

Unchanged; no executor ran. The 2026-08-28 figures stand: higher with the skill on build
tasks (`gas-goal-001` 40.5k vs 26.9k, `gas-goal-002` 54.2k vs 38.8k), lower on direct
questions (`gas-quiz-001` 21.4k vs 36.3k, `gas-quiz-003` 24.9k vs 53.3k).

## Excluded

`artifacts/gas-goal-001/2026-08-10T185641Z-codex-no-skill-1` is retracted: the judge graded
an empty snapshot while the transcript shows a complete Foundry deliverable. It had been
counted in that task's `no_skill` baseline, which is 1/2, not 1/3. The record is kept and
marked rather than deleted.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **9/12 vs 1/12**, but not uniformly: `gas-goal-002` 3/3 vs 0/3, `gas-quiz-001` 3/3 vs 0/3, `gas-quiz-003` 3/3 vs 1/3, and `gas-goal-001` **0/3 vs 0/3**. |
| Did it reduce time/tokens? | Split, unchanged: higher on goals, lower on quizzes. |
| Did it create negative deltas? | No correctness regression. The honest negative is that the strongest claimed cell was a rubric artifact. |
| What mistakes repeated without the skill? | `gas-invented-gas-price` (quiz-001, 3/3), `gas-mainnet-disqualified-on-cost` (quiz-003, 2/3), `gas-chain-picked-without-measuring` (goal-001, 3/3). |
| What mistakes remained with the skill? | `gas-wei-read-as-gwei` **3/6** on goal-001 — including the only run that passes. `gas-chain-picked-without-measuring` 2/6: the skill was read and not acted on. |
| What should change in the skill? | The four pointer restorations already made (fallback RPCs, ETH/USD sources, the L1 data-fee term, `gas-price` vs `base-fee`) are unvalidated — they need a run set. The wei clause is present and did not prevent the error; the next thing to try is requiring the raw and converted value side by side, since that is also what makes the error gradeable. |
| What should change in the eval? | `gas-goal-001` needs rebuilding, not patching: its rubric now depends on a reporting habit it does not require, and its lines were written against runs already read. `gas-quiz-001` and `gas-quiz-003` should be regraded once to stamp an `expect_sha`. Every bare task should commit `output/` at grade time, not retroactively. |
