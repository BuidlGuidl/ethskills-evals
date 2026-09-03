# orchestration-quiz-002

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 `with_skill` re-runs; the unchanged `no_skill` arm is the three-run 2026-08-13 baseline. All new runs were self-judged by fresh blind processes on the same stack.

**Skill load: 3 of 3.** `skills/orchestration/SKILL.md` appears in all three `with_skill` transcripts.

`with_skill` passed 3/3, matching the old skill and exceeding the standing `no_skill` result of 2/3. All runs treated the UI clamp only as mitigation, fixed and tested locally, and closed the on-chain migration/repointing loop. New median usage was 59s / 18,859 tokens; legacy no-skill usage is unavailable.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 2/3` |
| Did it reduce time/tokens? | `with_skill`: 59s / 18,859 tokens; legacy `no_skill`: unavailable |
| Did it create negative deltas? | None |
| What mistakes repeated without the skill? | None at repeated frequency |
| What mistakes remained with the skill? | None |
| What should change in the skill? | No change supported; the compact incident loop held. |
| What should change in the eval? | Consider retiring or strengthening this near-saturated task. |

## Provenance of the run records

Every `skill_version` in this branch's 24 runs was restamped on 2026-09-03. Setup records repo HEAD, and this branch was rewritten after the runs were made, so the shas the runs carried — `a04cb2c` and `156168e` — survived only as orphaned objects and would have been unrecoverable after merge. Each was replaced by a reachable commit with a byte-identical `skills/orchestration/SKILL.md`: `a04cb2c` -> `6b31941`, `156168e` -> `c065e45`. The installed text is unchanged in both cases; only the pointer moved. `AGENTS.md` now states the check.
