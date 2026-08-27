# orchestration-goal-001

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 per variant for the reported comparison. The `with_skill` arm was rerun after the one-line no-explorer-key fix; the earlier 0/3 skill arm remains append-only evidence but is superseded for the current skill version. All runs were self-judged by fresh blind processes on the same stack, a caveat on the comparison.

The patched `with_skill` arm passed 3/3 versus `no_skill` 0/3, with every skill run passing all eight checks. This closes the prior expect-4 regression: before the line was strengthened, all three skill plans required the team to supply an explorer key; afterwards none did. No-skill failed that check 3/3 and additionally missed small-real-money testing 3/3, the pre-mainnet gate 3/3, the pre-public gate 2/3, adjacent verification 1/3, and staging 1/3.

Median usage for the patched arm was `with_skill` 258s / 44,770 tokens versus `no_skill` 312s / 68,753 tokens.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes: `3/3 vs 0/3`. |
| Did it reduce time/tokens? | Yes: 258s / 44,770 tokens vs 312s / 68,753 tokens. |
| Did it create negative deltas? | None relative to no-skill. |
| What mistakes repeated without the skill? | `orchestration-stale-verification-key`, `orchestration-transition-gates-implicit` |
| What mistakes remained with the skill? | None |
| What should change in the skill? | No further change supported; the strengthened no-key line and explicit gates both held 3/3. |
| What should change in the eval? | Keep the split gate checks; they localized the improvement. |
