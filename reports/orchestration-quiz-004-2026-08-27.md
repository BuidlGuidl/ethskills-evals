# orchestration-quiz-004

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 per variant. All six runs were self-judged by fresh blind processes on the same stack.

Both arms passed 3/3 and all four checks passed in all six runs. No-skill agents derived the fallback, Yarn argument loss, corrected invocation, and state validation from the checkout. The fork-command line earned no pass-rate delta and should be removed under the pre-registered rule.

Median usage was `with_skill` 63s / 27,770 tokens versus `no_skill` 104s / 30,671 tokens, a modest efficiency benefit despite equal pass rates.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No: `3/3 vs 3/3` |
| Did it reduce time/tokens? | Yes: 63s / 27,770 tokens vs 104s / 30,671 tokens. |
| Did it create negative deltas? | None |
| What mistakes repeated without the skill? | None |
| What mistakes remained with the skill? | None |
| What should change in the skill? | Remove the fork-command line per the pre-registered rule, noting its efficiency benefit. |
| What should change in the eval? | None; it resolved the claim cleanly. |
