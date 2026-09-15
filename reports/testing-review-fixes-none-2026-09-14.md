# eval: testing review fixes — codex / gpt-5.6-sol / no explicit effort

**Skill:** `skills/testing` at repository revision `a953dad7` (skill content
`2bd6a429a09e` in the run records).

**Executor:** `codex`, model `gpt-5.6-sol`, with no
`model_reasoning_effort` argument. All 46 retained executor attempts record
`reasoning_effort: null`.

**Judge:** `codex`, model `gpt-5.6-sol`, fresh blind process per grade, launched
from the same temporary operator home with no reasoning-effort setting. Every grade
is self-judged, as expected for this single-stack benchmark.

**Runs:** The five repeated quizzes and the new held-out quiz have 3 valid runs per
variant. Goal-001 has 3 valid baseline runs but only 2 valid skilled runs; five
additional skilled attempts are retained as retracted harness failures.

**Trigger:** content-only; no forced skill invocation.

This follow-up addresses all 13 inline comments on PR #114. It corrects the prior
boundary diagnosis and histories, separates refusal counts by variant, restores the
unsupported Slither checklist item, labels prior comparisons by skill revision rather
than PR number, changes accumulation evidence from arbitrary transitions to at least
two drift-producing operations, and repeats semantic boundary classification in the
deploy checklist. It also adds held-out `testing-quiz-006`, which changes the concrete
surfaces to reserve-factor redemption, repayments, and Chainlink/collateral liquidation.

## Valid-run results

The repeated quizzes are comparable 3-by-3. The goal is not: after the two valid
skilled runs, repeated service failures prevented a third sample. No combined 18-run
headline is reported because that would hide unequal denominators.

| Task | Claim under test | `no_skill` | `with_skill` |
| --- | --- | --- | --- |
| testing-quiz-001 | Vacuously green invariant run; handler pattern | **3/3** | **3/3** |
| testing-quiz-002 | Fee-setter semantic boundary | **3/3** | **3/3** |
| testing-quiz-003 | Green mocks; real USDT deposits revert | **3/3** | **3/3** |
| testing-quiz-004 | Moving fork head and archive depth | **2/3** | **3/3** |
| testing-quiz-005 | Coverage from mirrored tests | **1/3** | **3/3** |
| **Repeated-quiz subtotal** | | **12/15** | **15/15** |
| testing-goal-001 | Three planted bugs; safe to ship? | **0/3** | **1/2 valid** |

At check level, the repeated quizzes scored **57/60** without the skill and **60/60**
with it. Goal-001 scored **6/12** baseline and **6/8** across the two valid skilled
runs. The skilled goal's missing sample is not treated as either a pass or a model
failure.

### Goal detail

| Goal check | `no_skill` | `with_skill` valid runs |
| --- | --- | --- |
| Exact 10,000 and above-10,000 fee failures evidenced | 2/3 | 2/2 |
| Withdrawal-fee accumulation evidenced | 3/3 | 2/2 |
| Real-USDT incompatibility evidenced on a fork | 0/3 | 1/2 |
| Do-not-ship verdict and complete fixes | 1/3 | 1/2 |

The semantic-boundary edit removed the observed skilled miss: both valid skilled goal
runs separately described the exact-limit `NoSharesMinted` path and the above-limit
underflow. One baseline run still excluded the exact boundary. The accumulation edit
was also compatible with both valid skilled reports; both used at least two
drift-producing withdrawals, rather than counting setup as evidence of growth.

The remaining skilled goal failure is integration evidence. It authored a pinned
mainnet-fork test, but the available public endpoint rejected the historical-state
request. The report correctly left qualification outstanding, so the judge failed the
requirement for actual real-USDT/Aave evidence. That is an outcome failure with an
environment confounder, not evidence that an unexecuted fork passed.

| Discipline used in valid goal work | `no_skill` | `with_skill` |
| --- | --- | --- |
| Fuzz test over the fee domain | 0/3 | 1/2 |
| Stateful invariant with a handler | 0/3 | 2/2 |
| Authored pinned mainnet-fork test | 0/3 | 2/2 |
| Produced successful real-fork evidence | 0/3 | 1/2 |

The opening risk-to-search gate still moved method choice, most clearly for handler
invariants and fork-test authorship. It did not make fuzzing deterministic: one valid
skilled run used targeted boundary tests only. This remains same-task regression
evidence, not an isolated causal estimate.

## Held-out forward check

`testing-quiz-006` was written after the skill edit but before these runs, and its
result is reported separately from the repeated suite.

| Held-out check | `no_skill` | `with_skill` |
| --- | --- | --- |
| Semantic reserve-factor boundary | 3/3 | 3/3 |
| At least two cut-bearing repayments prove accumulation | 3/3 | 3/3 |
| Real Chainlink/token fork, pinned block, archive-depth check | 2/3 | 3/3 |
| Risk-to-search mapping and no sign-off | 3/3 | 3/3 |
| **Complete runs** | **2/3** | **3/3** |

The sole delta is archive-depth guidance. The two newly tightened ideas—semantic
boundary classification and two drift-producing operations—were already 3/3 in the
held-out baseline. The held-out task therefore shows that the revised skill does not
degrade those answers, but it does not show that the skill caused them. It is also
question-shaped: it measures recommendations, not whether an executor actually builds
and runs the searches in an unfamiliar repository.

## Retracted attempts and selection bias

The scheduled `with_skill` goal-001 slot 2 produced five retained non-zero attempts:
four model-service cybersecurity refusals after partial execution and one usage-limit
termination. Each was graded only with `--grade-failed-run`, marked with
`harness_failure` and `retracted`, and excluded from pass and check counts. There were
no invalid baseline attempts in this sitting.

The five retained failures took 99–262 seconds and 14,330–57,431 tokens each according
to the per-run rows from `yarn run-stats`; their aggregate median is 185 seconds and
25,027 tokens. Those are operational costs, not valid-arm performance. A sixth
replacement was interrupted before completion and removed after its transcript printed
a live credential; it is not a benchmark sample. The credential was redacted from the
working records, but rotation is still required because earlier branch history had
already been pushed.

This imbalance is itself a negative result. The valid `1/2` skilled goal score may be
selection-biased, and repeated redrawing would make that worse. The benchmark stops
without filling the third slot.

## Evidence audit

All 25 reported command lines in the five valid goal reports are exact substrings of
their matching `transcript.md`, including environment assignments, pipes and match
filters. All 48 distinctive pasted `[FAIL: ...]` lines also match. No reconstructed
command or fabricated failure output was found.

The new-file quarantine held in all five valid goal runs: changes are limited to
`FINDINGS.md` and new files under `test/`. The goal `run.diff` files and question-task
`output/answer.md` files are committed so the grades remain auditable and regradeable.

Both valid skilled goal runs attempted the restored Slither checklist step. Both found
that the installed launcher lacks its Python package and correctly reported the scan as
outstanding. This added work without graded benefit and is a cost caveat, but the line
was restored because its removal had no supporting mistake record.

## Cost and duration

Every number below comes from `yarn run-stats`. Cells show the valid-run median followed
by the valid range. Codex reports no dollar cost. The tool's aggregate goal row includes
retracted attempts, so the skilled goal cell below is derived from its two valid per-run
rows only: 347s / 73,790 tokens and 308s / 47,090 tokens.

| Task | `no_skill` duration | `with_skill` duration | `no_skill` total tokens | `with_skill` total tokens |
| --- | --- | --- | --- | --- |
| testing-quiz-001 | 47s (46–54) | 47s (44–64) | 13,652 (13,072–15,211) | 11,233 (10,589–13,018) |
| testing-quiz-002 | 35s (34–35) | 39s (36–42) | 7,895 (7,712–7,978) | 9,959 (9,487–10,144) |
| testing-quiz-003 | 39s (37–41) | 40s (39–40) | 8,325 (8,034–8,362) | 9,887 (9,821–13,710) |
| testing-quiz-004 | 42s (40–47) | 35s (34–40) | 9,363 (8,393–12,685) | 8,681 (8,679–9,077) |
| testing-quiz-005 | 52s (51–61) | 50s (44–54) | 11,254 (10,589–12,277) | 12,004 (11,028–12,350) |
| testing-goal-001 | 207s (179–211), n=3 | 328s (308–347), n=2 valid | 44,426 (28,531–51,528) | 60,440 (47,090–73,790) |
| testing-quiz-006 held-out | 51s (50–59) | 55s (53–60) | 14,091 (13,092–16,492) | 11,928 (11,874–11,990) |

The valid skilled goal median is 121 seconds and 16,014 tokens above baseline while
performing more search work. Quiz costs are mixed. The held-out skill arm is four
seconds slower but uses 2,163 fewer tokens at the median. There is no overall
cost-reduction claim.

## Mistakes and recommendations

Repeated without the skill:

- `testing-goal-unbounded-fee-missed`
- `testing-goal-usdt-fork-missed`
- `testing-no-fuzz-unprompted`
- `testing-quiz-tautological-tests-missed`
- `testing-quiz-no-drift-handler-omitted`
- `testing-skill-fork-example-needs-archive`

Remaining with the skill:

- `testing-goal-usdt-fork-missed` (1/2 valid runs; archive RPC unavailable)
- `testing-no-fuzz-unprompted` (1/2 valid runs used no fuzz test)

No further task-specific wording should be added from goal-001. The review-requested
boundary and accumulation corrections are now present and compatible with the held-out
answers, but the next content change should wait for an operational, repo-shaped
held-out task. The eval should provision an archive-capable RPC for pinned integration
checks, retain refusal/usage-limit outcomes automatically, make `run-stats` exclude
`retracted` runs from default arm aggregates, persist judge reasons, and add a
repo-shaped transfer task whose defects differ from goal-001.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Repeated quizzes: `15/15` vs `12/15`; held-out quiz: `3/3` vs `2/3`. Goal: `1/2` valid vs `0/3`, with no third skilled sample after five retained harness failures. |
| Did it reduce time/tokens? | No overall. Valid goal median rose from 207s / 44,426 tokens to 328s / 60,440; held-out median moved from 51s / 14,091 to 55s / 11,928. |
| Did it create negative deltas? | No valid pass/check delta. Operationally, the skilled goal arm had five retained service failures, one credential-leaking interrupted attempt, higher valid-run goal cost, and two failed Slither-launcher attempts. |
| What mistakes repeated without the skill? | Boundary/unbounded-fee miss, no real-token fork, no fuzzing, incomplete tautology diagnosis, incomplete handler/no-drift replacement, and archive-depth omission. |
| What mistakes remained with the skill? | One valid run omitted fuzzing; one authored a fork but could not produce real integration evidence without archive access. |
| What should change in the skill? | Nothing further from this same task; validate future edits on an operational held-out repository. |
| What should change in the eval? | Provision archive RPC access, treat retracted attempts as first-class filtered records, persist judge reasons, and add a repo-shaped held-out transfer task. |
