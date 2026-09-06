# orchestration-goal-001

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 per variant. All runs were self-judged, a caveat on the comparison.

`with_skill` passed 1/3 while `no_skill` passed 0/3. The skill consistently produced the staged local-UI/live-contract rollout, immediate `yarn verify --network base` without requiring an explorer key, and small-real-money testing before the public URL. Its remaining failures all came from expect 5: plans had extensive gates but did not spell out all three required transition gates in the judge's closed list.

No-skill plans frequently gave verification correctly after web research, but missed the small-real-money-before-public boundary and, in two runs, reintroduced the explorer-key prerequisite. This supports the Phase 2 verification content while exposing a procedural-gate gap.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `1/3 vs 0/3` |
| Did it reduce time/tokens? | no consistent reduction observed |
| Did it create negative deltas? | none |
| What mistakes repeated without the skill? | `orchestration-stale-verification-key`, `orchestration-transition-gates-implicit` |
| What mistakes remained with the skill? | `orchestration-transition-gates-implicit` |
| What should change in the skill? | Add explicit GO/NO-GO gates to Phase transitions: local tests/deploy before Base, small-live-money journey before public frontend, and public-URL smoke test after deploy. |
| What should change in the eval? | None; the closed transition list correctly caught plans that merely called checks “gates.” |

## Regrade against the split gate lines, 2026-09-03

The gate check that these six runs were graded on became three (expect_5/6/7) and secrets hygiene moved from expect_6 to expect_8, both on 2026-08-26 while these runs already existed. AGENTS.md requires a regrade when expect lines change; it had been skipped. Done now, judge held fixed at Codex `gpt-5.6-terra`, every run of the task and not the failures only. Records are in `<run-id>-regrade-1` beside each run.

| run | original (6 lines) | regrade (8 lines) | aggregate |
| --- | --- | --- | --- |
| no-skill-1 | P F P P P P | P F **F** P **F** P P P | fail → fail |
| no-skill-2 | P F P F F P | P **P** P F F P P P | fail → fail |
| no-skill-3 | F F P F F P | **P** F P F **P** P P P | fail → fail |
| with-skill-1 | P P P P F P | P P P P F P P P | fail → fail |
| with-skill-2 | P P P P P P | P P P P **F** P P P | **pass → fail** |
| with-skill-3 | P P P P F P | P P P P **P** P P P | **fail → pass** |

`with_skill` is 1/3 before and 1/3 after, so the headline this benchmark reports is unchanged and the branch's "1/3 → 0/3 → 3/3" sequence stands. But it is not unchanged for the reason the task notes gave. Those notes argued that "the aggregate pass/fail per run is unaffected — a run that failed the old expect_5 fails at least one of the three." Run 3 is a counterexample: it failed the old bundled gate line and passes all three split ones. Run 2 moved the other way. The rate survives because two runs swapped places, which is a coincidence rather than the property that was claimed, and the notes have been corrected to say so.

Two caveats on reading the drift. First, a regrade resamples the judge as well as applying the new wording, and four of the moved verdicts are on lines whose text did not change at all — expect_3 on no-skill-1, expect_2 on no-skill-2, expect_1 on no-skill-3 — so some of this is grader variance and not the split. Second, the direction of the two aggregate moves is what the split was for: run 3's plan states conditions at each boundary in wording the old single line did not credit, and run 2 states one at two boundaries but not at the pre-mainnet one, which the old bundled verdict let through. The split is doing its job; the notes' argument for why no regrade was needed was simply wrong.
