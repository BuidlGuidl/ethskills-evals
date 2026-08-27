# orchestration-quiz-001

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 `with_skill` re-runs; the unchanged `no_skill` arm is the three-run 2026-08-13 baseline. All new runs were self-judged by fresh blind processes on the same stack, a caveat on the comparison.

`with_skill` again passed 3/3 versus the standing `no_skill` baseline of 0/3. Every new answer rejected the explorer-key blocker, prescribed `yarn verify --network base`, said to verify now, and justified the timing. New `with_skill` median usage was 40s / 11,530 tokens. The legacy no-skill records predate usage capture.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 0/3` |
| Did it reduce time/tokens? | `with_skill`: 40s / 11,530 tokens; legacy `no_skill`: unavailable |
| Did it create negative deltas? | None |
| What mistakes repeated without the skill? | `orchestration-stale-verification-key` |
| What mistakes remained with the skill? | None in this task |
| What should change in the skill? | Keep the no-key, immediate-verification rule. |
| What should change in the eval? | Capture usage on a future no-skill rerun if cost comparison becomes important. |
