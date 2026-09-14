# eval: testing operational gate — codex / gpt-5.6-sol / no explicit effort

**Skill:** `skills/testing` at repository revision `a1d0be01` (skill content
`a1715c7e3684` in the run records).

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

This benchmark follows the 2026-09-12 measurement of merged skill `0bc2e97b` and
changes only the testing skill before setup. The task inputs, templates and expect lines are unchanged. The
patch adds an opening deployment gate that maps configurable value math to fuzzing,
stateful accounting to a handler invariant and integrations to a pinned fork; names
`b - 1`, `b` and `b + 1` as distinct boundary cases; distinguishes evidence of a
single mismatch from evidence of accumulating drift; and removes the unconditional
Slither check. The Slither removal was not supported by a mistake record and should
not have been bundled into this measurement; it also prevents attributing any cost
change solely to the operational gate. PR #107's minimized wording and review
corrections remain intact.

Ten executor attempts ended with the model service's cybersecurity refusal and a
non-zero exit. Eight were `with_skill` goal attempts; the other two were a `no_skill`
goal attempt and a `no_skill` quiz-001 attempt. Each invalid run record and its exact
disposable workspace was deleted and replaced before grading, as the harness rules
require for a run that never finishes successfully. They are not counted. Because
8/10 refusals occurred in the skilled arm, selection bias cannot be ruled out and the
`17/18` versus `15/18` result must be read with that caveat. Independent workspaces ran concurrently in batches, so the documented
same-UID sibling-workspace visibility caveat applies; no transcript shows an executor
inspecting a sibling run.

## Results

| Task | Claim under test | `no_skill` | `with_skill` |
| --- | --- | --- | --- |
| testing-quiz-001 | Vacuously green invariant run; handler pattern | **3/3** | **3/3** |
| testing-quiz-002 | 100%-covered fee setter bricked by retune | **3/3** | **3/3** |
| testing-quiz-003 | Green mocks; real USDT deposits revert | **3/3** | **3/3** |
| testing-quiz-004 | Moving fork head; pin the block and verify archive depth | **2/3** | **3/3** |
| testing-quiz-005 | 100% coverage from mirrored tests | **3/3** | **3/3** |
| testing-goal-001 | Three planted bugs; safe to ship? | **1/3** | **2/3** |
| **Total** | | **15/18** | **17/18** |

At check level, `no_skill` passed **66/72** expect lines and `with_skill` passed
**71/72**. The skilled arm led by two complete runs and five checks.
The only skilled check failure was the exact-boundary evidence in goal-001.

## Goal-task detail

| Goal check | `no_skill` | `with_skill` |
| --- | --- | --- |
| Exact 10,000 and above-10,000 fee failures evidenced | 1/3 | 2/3 |
| Withdrawal-fee accounting drift evidenced | 2/3 | 3/3 |
| Real-USDT incompatibility evidenced on a fork | 1/3 | 3/3 |
| Do-not-ship verdict and complete fixes | 3/3 | 3/3 |

The remaining skilled boundary miss is substantive. The report called 10,001 the
first value above 100%, fuzzed only `BPS_DENOMINATOR + 1` and higher, and recommended
rejecting values `> BPS_DENOMINATOR`. It never stated or evidenced the distinct
exact-10,000 `NoSharesMinted` failure, and its proposed check would continue to allow
that unusable value. The gap is therefore semantic classification of the exact limit,
not merely missing command output. The next skill wording must first require deciding
whether the exact limit is usable, then separately exercise the maximum valid value,
the exact limit and the first value beyond it.

All three skilled reports passed the accounting check in the sitting that included the
new mismatch-versus-accumulation sentence. The clearest printed the custody/accounting gap growing from
3 USDT after the first withdrawal to 6 USDT after the second, and also supplied a
handler-invariant counterexample. One baseline report failed because its reproduction
combined ignored Aave yield with a single final withdrawal rather than separately
exhibiting the accumulating withdrawal-fee drift.

The methods used for the three planted bugs were:

| Discipline used in goal work | `no_skill` | `with_skill` |
| --- | --- | --- |
| Fuzz test over the fee domain | 0/3 | 3/3 |
| Stateful invariant with a handler | 0/3 | 3/3 |
| Mainnet fork against real USDT/Aave | 1/3 | 3/3 |
| Inspection followed by targeted tests | 3/3 | 3/3 |

This is a descriptive signal, not an isolated effect of the patch. On the immediately preceding run, only
1/3 skilled goal runs fuzzed and only 1/3 wrote a handler invariant. With the opening
risk-to-search gate, every skilled run performed all three applicable searches while
every baseline run still omitted fuzzing and invariants. However, the gate was written
from these planted defects and then measured on the same task; the result cannot
distinguish general workflow improvement from teaching to this test. A held-out task
with different contract behavior is required before making that causal claim.

## Quiz detail

All skilled quizzes passed. Quiz 004 supplied the only baseline quiz failure:
the answer correctly required historical/archive state and described direct
historical code/storage queries, but omitted the expect line's approximate 128-block
full-node window. Because the harness retains pass/fail but not the judge's reason,
that basis is inferred from the sole missing clause in the committed answer.

The quizzes remain useful regression guards but are mostly saturated. The skill now
states their handler/revert, boundary, real-token, moving-head/archive and mirrored-
oracle lessons directly, so another broad effectiveness measurement should rotate
the planted defects rather than treating repeated quiz passes as independent
reasoning gains.

## Evidence audit

All 25 Markdown `forge test` command lines in the six goal reports were checked as
exact substrings of their matching committed `transcript.md`, including environment
assignments, pipes and match filters. All 50 distinctive pasted `[FAIL: ...]` lines
also matched. No fabricated output or tidied command reconstruction was found.

The new-file quarantine held: all evidence tests were added under `test/`, while
`src/`, `test/UsdtYieldVault.t.sol` and `test/mocks/` were unchanged. The six goal
`run.diff` files and all 30 quiz `output/answer.md` files are committed, so every
grade remains auditable and regradeable.

All valid executors exited zero before grading. Every skilled goal run used a pinned
real-mainnet fork and evidenced the USDT return-data incompatibility. The transcripts
contain public RPC URLs and redacted/set environment markers, not credential values.

## Comparison with the preceding run

The preceding 2026-09-12 benchmark used the same executor model and effective effort
against merged skill `0bc2e97b`. It scored `14/18` without the skill and `16/18` with
it; this fresh benchmark scores `15/18` and `17/18`. The within-sitting complete-run
delta remains +2, so the one-run rise in both arms cannot by itself be attributed to
the patch.

The more diagnostic goal and method deltas moved in the intended direction:

| Signal | Merged skill `0bc2e97b` (2026-09-12) | Patched skill `a1d0be01` (2026-09-13) |
| --- | --- | --- |
| Goal complete passes | 1/3 | 2/3 |
| Goal accounting check | 2/3 | 3/3 |
| Goal exact-boundary check | 2/3 | 2/3 |
| Goal runs that fuzzed | 1/3 | 3/3 |
| Goal runs with a handler invariant | 1/3 | 3/3 |
| Goal runs with a real-token fork | 3/3 | 3/3 |

Fresh samples at `n=3` do not isolate the skill revision. The 3/3 method uptake is
aligned with the new workflow instruction and absent from the fresh baseline, but the
task supplied the misses used to write that instruction. Treat it as a regression
measurement until a held-out task tests transfer.

## Cost and duration

Every number below comes from `yarn run-stats`; cells show median followed by the
three-run range. Codex reports no dollar cost.

| Task | `no_skill` duration | `with_skill` duration | `no_skill` total tokens | `with_skill` total tokens |
| --- | --- | --- | --- | --- |
| testing-goal-001 | 247s (174-260) | 390s (324-490) | 51,627 (38,549-57,451) | 64,241 (50,397-66,685) |
| testing-quiz-001 | 66s (47-68) | 51s (47-51) | 23,748 (9,277-26,983) | 10,938 (10,622-11,224) |
| testing-quiz-002 | 38s (34-38) | 45s (43-48) | 6,542 (6,466-8,003) | 9,509 (9,498-9,577) |
| testing-quiz-003 | 45s (37-50) | 48s (43-61) | 8,542 (7,394-14,963) | 13,292 (9,857-16,970) |
| testing-quiz-004 | 51s (34-51) | 37s (36-42) | 11,679 (8,471-12,137) | 8,741 (8,707-9,385) |
| testing-quiz-005 | 64s (58-67) | 63s (62-64) | 10,632 (9,666-11,000) | 11,933 (11,760-12,122) |

The skilled goal median was 143 seconds and 12,614 tokens above baseline while those
runs performed fuzz, invariant and fork campaigns. Because the skill revision also
removed the Slither checklist item, the cost difference cannot be attributed to one
edit. Quiz cost was mixed: the skill was materially cheaper on quizzes 001 and
004, more expensive on 002 and 003, and roughly flat in time but higher in tokens on
005. There is no overall cost-reduction claim.

## Mistakes and recommendations

Repeated without the skill:

- `testing-goal-unbounded-fee-missed`
- `testing-goal-accounting-drift-not-evidenced`
- `testing-goal-usdt-fork-missed`
- `testing-no-fuzz-unprompted`
- `testing-skill-fork-example-needs-archive`

Remaining with the skill:

- `testing-boundary-excluded-from-bound-class`
- `testing-goal-unbounded-fee-missed`

The next skill edit should require semantic classification of a limit before testing
the nearest valid value, exact limit and first value beyond it. The accumulation line
should require at least two drift-producing operations, not merely two arbitrary state
transitions. The unsupported Slither removal should be reverted. No further
task-specific example belongs in the skill.

The eval should rotate the now-taught quiz defects and persist the judge's per-check
reasons. It should also record invalid model-service refusals in a benchmark-level
harness field: ten discarded attempts for 36 valid runs is operationally material,
even though correctly excluding them preserves the score.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | The skilled arm scored `17/18` vs `15/18`; causality is not established because this was the task used to write the patch and 8/10 service refusals were in the skilled arm. |
| Did it reduce time/tokens? | No overall. Goal median rose from 247s / 51,627 tokens to 390s / 64,241; quiz deltas were mixed. |
| Did it create negative deltas? | No pass-rate or check-level negative delta. It increased goal time and tokens by performing the additional searches. |
| What mistakes repeated without the skill? | Unbounded-fee/boundary, accounting evidence, missed real-token fork, no fuzz/invariant application, and one archive-detail miss. |
| What mistakes remained with the skill? | One exact-boundary evidence omission. |
| What should change in the skill? | Classify exact-limit validity, require repeated drift-producing operations, and restore the unsupported Slither line. |
| What should change in the eval? | Add a held-out task, persist judge reasons, and record discarded service refusals per variant. |
