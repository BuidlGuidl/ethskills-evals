# Eval report — frontend-playbook after the concision cut (Claude stack)

**Skill:** `skills/frontend-playbook` @ `a729598` (636 words, down from 1,919)
**Executor:** `claude`, `claude-opus-4-8` — fresh spawn per run
**Judge:** `claude`, `claude-opus-4-8` — fresh blind process spawned by `verify`
**Runs:** 30 new graded runs; `no_skill` for six unchanged tasks reused from #31
**Date:** 2026-08-19

This measures the compression in #56 against the pre-cut baseline in #31. Same
stack and same judge model as #31 (`claude-opus-4-8` throughout), so the two sets
are comparable and are not blended with the separate Codex benchmark in
`reports/frontend-playbook-affected-2026-08-12.md`.

## Scope

`no_skill` runs are skill-independent, so #31's remain valid wherever the task
spec did not move. Two specs moved in this PR, and both had their baseline
re-measured rather than reused:

- `quiz-005` — expect 3 reworded and expect 4 added (the split #31 recommended).
- `goal-002` — expect 1 no longer quotes `npx create-eth@latest`.

That is 24 `with_skill` runs plus 6 `no_skill`, and 18 reused `no_skill` records.

## Results

| Task | no_skill | with_skill | vs #31 |
| --- | --- | --- | --- |
| quiz-001 | 3/3 *(#31)* | 3/3 | held |
| quiz-002 | 3/3 *(#31)* | 3/3 | held |
| quiz-003 | 3/3 *(#31)* | 3/3 | held |
| quiz-004 | 2/3 *(#31)* | 3/3 | held |
| quiz-005 | 1/3 *(new)* | 2/3 | see below |
| quiz-006 | 3/3 *(#31)* | 3/3 | held |
| goal-001 | 0/3 *(#31)* | 3/3 | held |
| goal-002 | 0/3 *(new)* | 3/3 | held |

The cut preserves every result the pre-cut skill produced. `goal-002`'s
re-measured baseline is still 0/3 — both expects fail in all three runs — so the
reworded expect 1 did not become trivially passable by dropping the version pin.

## The regression this rerun caught

The first pass of `with_skill` runs was graded at `ce49574`, before the fix in
`a729598`. On `quiz-005` expect 3 — the interval-mining claim the skill most
clearly owns — it produced:

| quiz-005 expect 3 | no_skill | with_skill |
| --- | --- | --- |
| #31, pre-cut skill | 0/3 | 3/3 |
| `ce49574`, after the cut | 2/3 | **1/3** |
| `a729598`, after the fix | 2/3 | **3/3** |

`dcf1056` ("make frontend playbook concise") had compressed the guidance to
"manual mining or time manipulation is valid for a controlled one-step test; use
interval mining for continuous behavior". Executors took the first clause: two of
three `with_skill` runs proposed `cast rpc evm_mine` as the live-demo one-off,
while the `no_skill` baseline reached for interval mining unaided. The skill was
steering runs into `frozen-timestamp-wrong-oneoff-fix`, the mistake it exists to
prevent — recorded there as `no_skill 3/3`, `with_skill 0/3` against the pre-cut
text.

`a729598` scopes manual mining to controlled single-step tests and says why it
does not hold for a running demo: one block restamps the timestamp once and it
freezes again. Expect 3 returned to 3/3. The 18 runs graded at `ce49574` were
deleted, not kept.

This is the finding that justifies the wider rerun. The regression sat in a task
#56 had already re-run and reported as unaffected, and it was invisible until the
skill was graded against a task spec it had not been tuned to.

## quiz-005 under the split expects

| | expect 3 (interval mining) | expect 4 (generalization) | task |
| --- | --- | --- | --- |
| no_skill | 2/3 | 1/3 | 1/3 |
| with_skill | 3/3 | 2/3 | 2/3 |

Splitting the expect did what #31's note predicted: expect 3 now isolates the
behavior the skill owns and shows a clean 3/3. Expect 4 is a weak discriminator
in both variants — one `with_skill` run diagnoses and fixes the incident
correctly but does not restate deadlines and expiry, and fails the task on that
alone. It is a fair check, but it measures answer completeness, not the skill's
claim.

## Cost

Total executor tokens, mean per run, for the pairs where both variants ran in
this batch:

| Task | no_skill | with_skill |
| --- | ---: | ---: |
| quiz-005 | 72,112 | 91,920 |
| goal-002 | 2,733,311 | 4,574,882 |

The skill increases executor tokens, substantially so on `goal-002` (+67%). That
is not waste: `no_skill` hand-rolls `forge init` plus a manual Next.js app and
stops early with a failing result, while `with_skill` scaffolds the SE2 monorepo,
installs it, and completes the build. The skill buys a passing outcome by doing
more work, and the honest reading is that it costs more rather than less.

Wall-clock was not captured cleanly. Goal runs averaged roughly 15–17 minutes.

## Notes for the reviewer

- **All runs `self_judged: true`** — mechanical on a single-claude stack, since
  `verify.ts:253` derives it from `judge.agent === executor` alone. Each grade
  still ran in a fresh, blind `claude -p` process that never saw the variant, the
  skill, or the transcript. `judge.model` is now stamped as `claude-opus-4-8` on
  every new record rather than left null.
- **Account usage limit** interrupted four goal runs. They never produced a
  grade; the run dirs were deleted and re-run fresh after the limit reset. No
  partial data was kept.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes. Quizzes `17/18 with_skill vs 15/18 no_skill`; goals `6/6 vs 0/6`. The goal surface is where the skill decides the outcome. |
| Did it reduce time/tokens? | No — it increases them (`goal-002` +67%), because `with_skill` completes work `no_skill` abandons. |
| Did it create negative deltas? | One, since fixed: `dcf1056` regressed `quiz-005` expect 3 from 3/3 to 1/3. Repaired in `a729598`, verified back at 3/3. |
| What mistakes repeated without the skill? | `scaffold-manual-not-create-eth` (3/3 on goal-002), `frozen-timestamp-wrong-oneoff-fix` (1/3 on quiz-005). |
| What mistakes remained with the skill? | None in the target behaviors. |
| What should change in the skill? | Nothing further from these runs. The 636-word revision holds every pre-cut result. |
| What should change in the eval? | `quiz-005` expect 4 grades answer completeness rather than a skill claim and fails runs that diagnose and fix correctly; consider making it advisory. `quiz-001` expect 3 and `goal-001` expect 3 graded fork powers the skill never taught until `aa4a090` — attributable now, but they were measuring unaided model knowledge for the whole of #31. |
