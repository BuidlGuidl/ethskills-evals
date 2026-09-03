# orchestration-quiz-001

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 `with_skill` re-runs; the unchanged `no_skill` arm is the three-run 2026-08-13 baseline. All new runs were self-judged by fresh blind processes on the same stack, a caveat on the comparison.

**Version caveat, and it matters on this task.** These three runs were executed against skill text identical to `6b31941`, before the 2026-08-27 explorer-key patch. That patch rewrote the one paragraph quiz-001 grades, so this 3/3 is a result for the previous wording, not for the text this branch ships (`c065e45`). The change strengthened the claim rather than weakening it, so a drop is unlikely — but that is a prediction, not a measurement, and it is cheap to settle with a three-run re-execution.

**Skill load: 3 of 3.** `skills/orchestration/SKILL.md` appears in all three `with_skill` transcripts.

`with_skill` again passed 3/3 versus the standing `no_skill` baseline of 0/3. Every new answer rejected the explorer-key blocker, prescribed `yarn verify --network base`, said to verify now, and justified the timing. New `with_skill` median usage was 40s / 11,530 tokens. The legacy no-skill records predate usage capture.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 0/3` |
| Did it reduce time/tokens? | `with_skill`: 40s / 11,530 tokens; legacy `no_skill`: unavailable |
| Did it create negative deltas? | None |
| What mistakes repeated without the skill? | `orchestration-stale-verification-key` |
| What mistakes remained with the skill? | None in this task |
| What should change in the skill? | Keep the no-key, immediate-verification rule. |
| What should change in the eval? | Re-run `with_skill` against the shipped wording so the number is a measurement, not a carry-over. Capture usage on a future no-skill rerun if cost comparison becomes important. |

## Provenance of the run records

Every `skill_version` in this branch's 24 runs was restamped on 2026-09-03. Setup records repo HEAD, and this branch was rewritten after the runs were made, so the shas the runs carried — `a04cb2c` and `156168e` — survived only as orphaned objects and would have been unrecoverable after merge. Each was replaced by a reachable commit with a byte-identical `skills/orchestration/SKILL.md`: `a04cb2c` -> `6b31941`, `156168e` -> `c065e45`. The installed text is unchanged in both cases; only the pointer moved. `AGENTS.md` now states the check.
