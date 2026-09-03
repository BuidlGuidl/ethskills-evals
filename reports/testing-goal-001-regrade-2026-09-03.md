# regrade: testing-goal-001 — codex / gpt-5.6-sol

**Task:** `testing-goal-001`, expect_2 rewritten on `skill/testing-minimal`

**Judge:** `codex`, model `gpt-5.6-sol` — the judge that graded these runs originally,
held fixed. `self_judged: true` on every record, as in the source benchmark.

**Regraded:** all six goal-001 runs from `reports/testing-2026-09-01.md`, both variants.
No executor was re-run. `expect_sha` `unrecorded` -> `634855aea465`.

## What changed in the rubric

expect_2 previously required the withdrawal-fee drift to be shown as `totalAssetsStored`
against the vault's aUSDT balance. It now accepts any figures that exhibit the
recorded-vs-held gap, or a direct consequence of it. Everything else it asked for is
unchanged: the gross-vs-net mechanism, the accumulating gap, unclaimability, the
direction (a surplus no share can claim, never a shortfall), pasted real command output,
the test quarantined in a new file under `test/`, and a fix that accounts for the
retained fee.

The edit was made on the suspicion that the old wording had failed a correct answer —
`with-skill-1`, which proved the same gap through the share price. Filed as
`mistakes/testing/testing-eval-rejects-alternate-drift-measurement`.

## Result: the wording made no difference

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

`with-skill-1` expect_2 — the cell the edit was aimed at — fails under both wordings.

## What that settles

**The negative accounting-drift delta in `reports/testing-2026-09-01.md` stands as
measured.** It is not a rubric artifact. The suspicion behind the mistake record is
withdrawn there.

The likeliest ground for the fail is the clause `with-skill-1` asserts without
evidencing: expect_2 wants a gap that accumulates across withdrawals, and the run shows
one withdrawal and one 3 USDT fee before stating that "all accumulated withdrawal fees
remain ownerless". That reading is inference, not record — see below.

**The widened wording was kept**, on the narrower ground that it no longer names a single
measurement while being verdict-neutral on the evidence in hand. It is credited with
nothing else. Tables mixing `expect_sha` `634855aea465` with the unrecorded original are
comparable on this evidence, which is an empirical finding about these six runs and not a
general licence.

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
