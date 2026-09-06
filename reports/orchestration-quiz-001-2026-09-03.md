# orchestration-quiz-001

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 `with_skill`; the `no_skill` arm is the unchanged three-run 2026-08-13 baseline. All new runs were self-judged by fresh blind processes on the same stack, a caveat on the comparison.

Why this set exists: the 2026-08-27 `with_skill` runs were executed against skill text identical to `6b31941`, and the patch later that day rewrote exactly the paragraph quiz-001 grades. Their 3/3 was therefore a result for the previous wording. The 2026-09-03 report predicted the result would hold; this replaces the prediction with a measurement, on `5ad8abf`, which is the text this branch ships.

**Skill load: 3 of 3.** `skills/orchestration/SKILL.md` appears in all three transcripts.

`with_skill` passed 3/3, all four checks in every run, against the standing `no_skill` baseline of 0/3. Median usage 43s / 11,142 tokens, against 40s / 11,530 for the 2026-08-27 set — the strengthened wording costs nothing measurable.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 0/3` |
| Did it reduce time/tokens? | `with_skill`: 43s / 11,142 tokens; legacy `no_skill`: unavailable |
| Did it create negative deltas? | None |
| What mistakes repeated without the skill? | `orchestration-stale-verification-key` |
| What mistakes remained with the skill? | None |
| What should change in the skill? | Nothing. The explicit no-key rule holds at 3/3 on the shipped wording. |
| What should change in the eval? | Capture usage on a future no-skill rerun if cost comparison becomes important. |
