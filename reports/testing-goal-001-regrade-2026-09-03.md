# regrade: testing-goal-001 — codex / gpt-5.6-sol

**Task:** `testing-goal-001`, `expect_2` rewritten in PR #107

**Judge:** `codex`, model `gpt-5.6-sol` — the judge that graded these runs originally,
held fixed. `self_judged: true` on every record, as in the source benchmark.

**Regraded:** all six goal-001 runs from `reports/testing-2026-09-01.md`, both variants.
No executor was re-run. `expect_sha` `unrecorded` -> `634855aea465`.

## What changed in the rubric

`expect_2` was **widened in one clause and narrowed in another**. The first description of
this edit — in the PR body, in this report, in the task note, in the mistake record and in
the six committed `regrade_reason` strings — called it a widening only, and said the
retained-fee fix was "still" required. That was wrong, and is corrected here on 2026-09-04
in review of PR #107. The regrade records are append-only, so the correction lives in this
report, in `tasks/testing-goal-001.yaml` and in the mistake record, not in them.

**Widened.** The old line required the drift to be shown as `totalAssetsStored` against
the vault's aUSDT balance. Any figures that exhibit the recorded-vs-held gap, or a direct
consequence of it, now satisfy it.

**Narrowed.** The old line ended at the new-file quarantine and required no fix at all.
The new one adds: *"The reported fix accounts for the retained fee, by subtracting only
the net or by pricing shares off live holdings."*

**Unchanged.** The gross-vs-net mechanism, the accumulating gap, unclaimability, the
direction (a surplus no share can claim, never a shortfall), pasted real command output,
and the test quarantined in a new file under `test/`.

The edit was made on the suspicion that the old wording had failed a correct answer —
`with-skill-1`, which proved the same gap through the share price. Filed as
`mistakes/testing/testing-eval-rejects-alternate-drift-measurement`.

## Result: the wording made no difference

Every cell below is the `-regrade-1` reading. The regrade dirs are
`artifacts/testing-goal-001/<run-id>-regrade-1/` for each of the six run ids named in the
first column; each names its source in `regrade_of` and its rubric in `expect_sha`. The
source run dirs keep the grades they were first given and nothing in them says a later
reading exists, so this report is the only pointer from the old grades to the new ones.

| Run | Variant | Old (`e1 e2 e3 e4`) | Regrade (`e1 e2 e3 e4`) | pass |
| --- | --- | --- | --- | --- |
| `2026-09-01T165922Z-codex-no-skill-1` | no_skill | f p f f | f p f f | fail -> fail |
| `2026-09-01T172548Z-codex-no-skill-2` | no_skill | p p p p | p p p p | pass -> pass |
| `2026-09-01T172549Z-codex-no-skill-3` | no_skill | f p p f | f p p f | fail -> fail |
| `2026-09-01T220914Z-codex-with-skill-1` | with_skill | p **f** p p | p **f** p p | fail -> fail |
| `2026-09-01T174256Z-codex-with-skill-2` | with_skill | f p p p | f p p p | fail -> fail |
| `2026-09-01T165927Z-codex-with-skill-3` | with_skill | p p p p | p p p p | pass -> pass |

**24 of 24 expect verdicts identical.** The headline is unchanged at `no_skill` 1/3 vs
`with_skill` 1/3, and the accounting-drift column is unchanged at 3/3 vs 2/3.

`with-skill-1` `expect_2` — the cell the edit was aimed at — fails under both wordings.

Two offsetting edits can in principle produce identical verdicts while masking each other.
Here they demonstrably do not: `expect_4` grades the same retained-fee fix independently,
and every run's `expect_4` verdict is unchanged as well, so no run gained a fix clause in
`expect_2` that it was silently losing elsewhere.

## What that settles

**The negative accounting-drift delta in `reports/testing-2026-09-01.md` stands as
measured.** It is not a rubric artifact. The suspicion behind the mistake record is
withdrawn there.

The likeliest ground for the fail is the clause `with-skill-1` asserts without
evidencing: `expect_2` wants a gap that accumulates across withdrawals, and the run shows
one withdrawal and one 3 USDT fee before stating that "all accumulated withdrawal fees
remain ownerless". That reading is inference, not record — see below.

**The new wording was kept**, on the narrower ground that it no longer names a single
measurement while being demonstrably verdict-neutral on the evidence in hand. It is
credited with nothing else. Tables mixing `expect_sha` `634855aea465` with the unrecorded
original are comparable on this evidence, which is an empirical finding about these six
runs and not a general licence.

## Harness gap this exposed

`lib/judge.ts` asks the judge for a `reason` per condition and `verify` keeps only
pass/fail, so why a check failed is unrecoverable once the run is graded. That is what
forces the paragraph above to be inference, and it is the difference between auditing a
suspected false negative from the records and re-rolling a judge to guess at it.
Persisting the reasons — beside `result.yaml`, or in it — is the cheapest useful change
here.

## Method note

One regrade per run on the original judge answers the question a rubric edit raises.
Re-rolling the judge, or loosening the wording again until the cell flips, would be
shopping for a verdict; neither was done.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Not measured here and not measurable here: no executor ran. The pass rate this re-reading produces is the one already reported on 2026-09-01, `1/3` vs `1/3`. |
| Did it reduce time/tokens? | Not applicable. A regrade spawns no executor and has no cost of its own; `run-stats` skips `-regrade-` dirs for exactly that reason. |
| Did it create negative deltas? | None created and none removed. The accounting-drift column stays negative at `3/3` no_skill vs `2/3` with_skill, and this regrade exists to establish that it is a measurement rather than a wording artifact. |
| What mistakes repeated without the skill? | Unchanged from `reports/testing-2026-09-01.md`; a regrade cannot alter which runs exhibited what. |
| What mistakes remained with the skill? | Unchanged, and one was withdrawn on this evidence: `testing-eval-rejects-alternate-drift-measurement` is `wontfix`, since the answer it defended fails under both wordings. |
| What should change in the skill? | Nothing on this evidence. A regrade grades old evidence; it says nothing about a skill revision, and the revision in PR #107 is unvalidated until it is run. |
| What should change in the eval? | Two things. `expect_2` and `expect_4` now both grade the withdraw fix — removing the clause from `expect_2` would restore two independent columns, and needs its own regrade of all six runs. And the harness should persist the judge's per-condition `reason`, without which the ground for the one contested cell here is unrecoverable and this report has to reason by inference. |
