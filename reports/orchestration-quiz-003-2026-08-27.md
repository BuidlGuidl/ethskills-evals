# orchestration-quiz-003

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 `with_skill` re-runs; the unchanged `no_skill` arm is the valid three-run 2026-08-13 baseline. All new runs were self-judged by fresh blind processes on the same stack.

`with_skill` passed 3/3 versus the standing `no_skill` 3/3. All hook and identity checks passed after the hooks block was deleted. New median usage was 133s / 45,109 tokens; the legacy no-skill duration is unavailable and its reported token median was about 43,900.

**Skill load: 0 of 3.** `skills/orchestration/SKILL.md` appears in none of the three `with_skill` transcripts — run 3 lists `.agents` with `rg` and goes no further, and no run opens the file. The 2026-08-13 report made this check (2 of 3 then) and this one initially omitted it, which is how an earlier draft came to credit the retained frontend-only guard for the 0/3 deploy rate. It cannot: no run read that line. The 0/3 is real and the deletion regression guard still reports nothing lost, but neither number is a measurement of the skill on this task.

The likely cause is this branch's own description rewrite, which now says "Not for frontend implementation (`frontend-ux`)". That is a correct routing rule and quiz-003 is a frontend ticket, so the skill is not supposed to load here. The consequence is that quiz-003 can no longer do the job its notes give it: with the skill never loading, a `with_skill` drop cannot signal that the deleted hooks block mattered. Either the deletion test moves to a task shaped so the skill does load, or the notes stop calling it a regression guard.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No: `3/3 vs 3/3` |
| Did it reduce time/tokens? | No: `with_skill` 133s / 45,109 tokens; legacy `no_skill` duration unavailable / ~43,900 tokens |
| Did it create negative deltas? | None graded; a small token increase remains. |
| What mistakes repeated without the skill? | None |
| What mistakes remained with the skill? | None observed; `orchestration-generated-registry-churn` was 0/3, but on transcripts where the skill never loaded, so it is not a measurement of the guard. |
| What should change in the skill? | Nothing on this evidence. Keep the hooks block deleted; the frontend-only guard is untested here. |
| What should change in the eval? | Reshape it, or relabel it. As a frontend ticket it no longer loads the skill it is meant to test, so it can neither confirm the deletion nor exercise the guard. |

## Provenance of the run records

Every `skill_version` under `artifacts/orchestration-*` was restamped on 2026-09-03. Setup records repo HEAD, and branches were rewritten after the runs were made, so four shas survived only as orphaned objects and would have been unrecoverable after merge. Each was replaced by a reachable commit with a byte-identical `skills/orchestration/SKILL.md`: `a04cb2c` -> `6b31941` and `156168e` -> `c065e45` (this branch's 24 runs), `9b3f8c0` and `6115e4f` -> `2f0adb0` (the 2026-08-13 sets inherited from #67, which had the same problem). The installed text is unchanged in every case; only the pointer moved. `AGENTS.md` now states the check to run before a merge.
