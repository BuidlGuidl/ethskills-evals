# orchestration-goal-001

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 per variant. All six runs were self-judged by fresh blind processes on the same stack, a caveat on the comparison.

Both variants passed 0/3, but the aggregate hides a large check-level delta. Every `with_skill` run passed seven checks and failed only expect 4 by requiring an explorer API key. No-skill also failed that check 3/3, plus small-real-money testing 3/3, pre-mainnet gate 3/3, pre-public gate 2/3, adjacent verification 1/3, and staging 1/3. The rewritten explicit gates fully fixed the old gap; the no-key rule passed when directly asked in quiz-001 but failed unprompted here.

Median usage was `with_skill` 211s / 51,045 tokens versus `no_skill` 312s / 68,753 tokens.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Aggregate `0/3 vs 0/3`; substantial check-level improvement. |
| Did it reduce time/tokens? | Yes: 211s / 51,045 tokens vs 312s / 68,753 tokens. |
| Did it create negative deltas? | None relative to no-skill. |
| What mistakes repeated without the skill? | `orchestration-stale-verification-key`, `orchestration-transition-gates-implicit` |
| What mistakes remained with the skill? | `orchestration-stale-verification-key` |
| What should change in the skill? | Strengthen the no-key line so launch planning applies it unprompted; keep the gates. |
| What should change in the eval? | Keep the split gate checks; they localized the improvement. |
