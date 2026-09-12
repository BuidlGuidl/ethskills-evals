# eval: minimized testing — codex / gpt-5.6-sol / no explicit effort

**Skill:** `skills/testing` at repository revision `0bc2e97b` (skill content
`9a4c7a72c983` in the run records)

**Executor:** `codex`, model `gpt-5.6-sol`, with no
`model_reasoning_effort` argument. All 36 `executor.yaml` files record
`reasoning_effort: null`, and all 36 transcript headers report the effective setting
as `reasoning effort: none`.

**Judge:** `codex`, model `gpt-5.6-sol`, fresh blind process per run, launched from
the same temporary operator home with no reasoning-effort setting. The harness does
not persist the judge's effort level; it does persist the model and records all 36
runs as `self_judged: true`.

**Runs:** 3 per variant x 2 variants x 6 tasks = 36 valid graded runs.

**Trigger:** content-only; no forced skill invocation.

This branch starts from `origin/main` at `0bc2e97b`. That tree contains PR #107's
merged testing-skill revision and all of its review follow-ups (`988e4300`,
`02a481fc`): the de-verbatimized minimal skill, archive-RPC guidance, corrected
goal-rubric history, missing mistake records, and contamination notes. The task
inputs and expects were not edited for this rerun.

Six executor attempts ended with a model-service cybersecurity refusal and non-zero
exit: one quiz attempt and five goal attempts. They and their disposable workspaces
were deleted and replaced before grading, as required by the harness rules. They are
not counted. Some independent workspaces ran concurrently; the documented same-UID
sibling-workspace visibility caveat therefore applies, although no transcript shows
an executor inspecting a sibling run.

## Results

| Task | Claim under test | `no_skill` | `with_skill` |
| --- | --- | --- | --- |
| testing-quiz-001 | Vacuously green invariant run; handler pattern | **3/3** | **3/3** |
| testing-quiz-002 | 100%-covered fee setter bricked by retune | **2/3** | **3/3** |
| testing-quiz-003 | Green mocks; real USDT deposits revert | **3/3** | **3/3** |
| testing-quiz-004 | Moving fork head; pin the block and verify archive depth | **3/3** | **3/3** |
| testing-quiz-005 | 100% coverage from mirrored tests | **2/3** | **3/3** |
| testing-goal-001 | Three planted bugs; safe to ship? | **1/3** | **1/3** |
| **Total** | | **14/18** | **16/18** |

At check level, `no_skill` passed **67/72** expect lines and `with_skill` passed
**70/72**. The skill improved the aggregate by two complete runs and three checks.
The entire complete-run gain came from quizzes 002 and 005; the goal task remained
`1/3` in both variants.

## Goal-task detail

| Goal check | `no_skill` | `with_skill` |
| --- | --- | --- |
| Exact 10,000 and above-10,000 fee failures evidenced | 2/3 | 2/3 |
| Withdrawal-fee accounting drift evidenced | 3/3 | 2/3 |
| Real-USDT incompatibility evidenced on a fork | 2/3 | 3/3 |
| Do-not-ship verdict and complete fixes | 2/3 | 3/3 |

The two boundary misses had the same shape. One baseline and one skilled goal report
proved the above-limit underflow but did not separately prove the exact-10,000
zero-net/`NoSharesMinted` path. PR #107's "both sides" sentence was enough for quiz
002 to move from the original PR #101 skilled result of `2/3` to `3/3`, but it did
not eliminate the mistake in the less-directed goal.

The skilled accounting miss exhibited one 3-USDT custody/accounting gap and stated
that it accumulates, but supplied no second withdrawal or second numerical gap. The
other two skilled reports satisfied the check; the strongest one used a handler
invariant and shrank the drift to a two-call deposit/withdraw sequence.

The methods used for the three planted bugs were:

| Discipline used in goal work | `no_skill` | `with_skill` |
| --- | --- | --- |
| Fuzz test over the fee domain | 0/3 | 1/3 |
| Stateful invariant with a handler | 0/3 | 1/3 |
| Mainnet fork against real USDT/Aave | 2/3 | 3/3 |
| Inspection followed by targeted tests | 3/3 | 3/3 |

The revision moved fuzz and invariant use from `0/3` to `1/3`, but most skilled
runs still reasoned to a suspected defect and confirmed it with targeted examples.
That is valid outcome evidence, but it is weaker support for the skill's claim that
it causes systematic search of the input and state space.

## Evidence audit

Every goal run's Markdown command lines and every distinctive pasted `[FAIL: ...]`
line were checked as exact substrings of that run's committed `transcript.md`. All
six matched; no fabricated output or tidied command reconstruction was found. The
new-file quarantine also held: evidence tests were added under `test/`, while `src/`,
`test/UsdtYieldVault.t.sol`, and `test/mocks/` were unchanged.

All valid executors exited zero before grading. All six goal runs that claimed the
USDT incompatibility used a pinned real-mainnet fork; the one baseline run that did
not fork failed that check. The transcripts expose only redacted/set markers for
environment keys, not credential values.

## Comparison with PR #101

PR #101 used the same effective executor stack: Codex `gpt-5.6-sol` with
`reasoning effort: none`. Its result was `13/18` without the skill and `15/18` with
it; this fresh run is `14/18` and `16/18`. The within-sitting skill delta is therefore
the same, +2 complete runs. The one-run rise in each arm is not attributable to the
skill: these are fresh samples, and PR #107 changed the skill and one goal expect
between sittings. The old goal evidence was regraded under that expect and retained
all 24 original check verdicts, but sampling variance remains.

PR #107 also makes several quiz answers close to direct recall: the skill now states
the handler/revert diagnosis, moving-head/archive diagnosis, mirrored-test problem,
and both-sides boundary rule. Those quizzes are useful regression guards for the
new text, not clean measurements of independent problem-solving. The goal remains
the more useful judgment test, and it still shows the boundary and cumulative-
accounting gaps.

## Cost and duration

Every number below comes from `yarn run-stats`; cells show median followed by the
three-run range. Codex reports no dollar cost.

| Task | `no_skill` duration | `with_skill` duration | `no_skill` total tokens | `with_skill` total tokens |
| --- | --- | --- | --- | --- |
| testing-goal-001 | 223s (178-261) | 345s (211-370) | 38,496 (30,261-61,341) | 50,112 (34,053-50,609) |
| testing-quiz-001 | 69s (61-71) | 60s (55-62) | 10,598 (10,077-14,736) | 14,497 (10,258-16,033) |
| testing-quiz-002 | 47s (41-56) | 42s (36-44) | 12,045 (11,838-15,340) | 16,609 (9,160-16,772) |
| testing-quiz-003 | 36s (33-36) | 37s (35-40) | 8,564 (7,589-13,794) | 9,575 (9,368-9,943) |
| testing-quiz-004 | 41s (40-47) | 34s (32-37) | 8,340 (7,830-9,289) | 8,848 (8,656-14,048) |
| testing-quiz-005 | 49s (46-50) | 50s (45-56) | 10,031 (9,902-10,530) | 11,936 (11,190-18,341) |

Wall time was mixed: the skill arm was faster on quizzes 001, 002 and 004, roughly
flat on 003 and 005, and 122 seconds slower at the goal median. Median token use was
higher with the skill on every task, most materially on the goal. There is no cost
reduction claim.

## Mistakes and recommendations

Repeated without the skill:

- `testing-boundary-excluded-from-bound-class` / `testing-goal-unbounded-fee-missed`
- `testing-goal-usdt-fork-missed`
- `testing-quiz-tautological-tests-missed`
- `testing-no-fuzz-unprompted`

Remaining with the skill:

- `testing-boundary-excluded-from-bound-class` / `testing-goal-unbounded-fee-missed`
- `testing-goal-accounting-drift-not-evidenced`
- `testing-no-fuzz-unprompted`

The next skill edit should turn "both sides" into three named cases: nearest value
below the bound, exact bound, and nearest value above it, with separate evidence for
every claimed path. The invariant section should require at least two measured
post-operation gaps when a report claims cumulative drift, unless a stateful
invariant itself demonstrates the accumulating sequence. This rerun intentionally
does not make either edit; it measures PR #107 as merged.

The eval should rotate planted defects before using these quizzes as another broad
effectiveness measurement. It should also persist the judge's per-condition reasons:
the current pass/fail-only record makes the exact basis of close rubric decisions an
inference even when the evidence is committed.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes overall: `16/18` with skill vs `14/18` without; the goal stayed `1/3` vs `1/3`. |
| Did it reduce time/tokens? | No overall. Wall time was mixed and the goal median rose from 223s to 345s; median tokens were higher with skill on all six tasks. |
| Did it create negative deltas? | Yes: goal accounting-drift evidence passed `3/3` without vs `2/3` with. No task-level complete-run delta was negative. |
| What mistakes repeated without the skill? | Boundary/unbounded-fee, missed real-USDT fork, tautological-test diagnosis, and no unprompted fuzzing. |
| What mistakes remained with the skill? | Exact-boundary evidence, cumulative accounting evidence, and failure to apply fuzz/invariant search in 2/3 goal runs. |
| What should change in the skill? | Name below/exact/above as separate boundary cases and require numerical evidence across repeated operations for claims of accumulated drift. |
| What should change in the eval? | Rotate now-restated quiz defects and persist judge reasons; keep the goal as the primary judgment signal. |
