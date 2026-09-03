# orchestration-goal-001

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 per variant for the reported comparison. The `with_skill` arm was rerun after the one-line no-explorer-key fix; the earlier 0/3 skill arm remains append-only evidence but is superseded for the current skill version. All runs were self-judged by fresh blind processes on the same stack, a caveat on the comparison.

**Skill load: 3 of 3 in each `with_skill` set.** `skills/orchestration/SKILL.md` appears in all three transcripts of both the 152418Z and the 180856Z arms.

The patched `with_skill` arm passed 3/3 versus `no_skill` 0/3, with every skill run passing all eight checks. This closes the prior expect-4 regression: before the line was strengthened, all three skill plans required the team to supply an explorer key; afterwards none did. No-skill failed that check 3/3 and additionally missed small-real-money testing 3/3, the pre-mainnet gate 3/3, the pre-public gate 2/3, adjacent verification 1/3, and staging 1/3.

**A suspected misgrade on `no-skill-3`, checked and not upheld.** That run was failed on expect_1 (staging) and expect_2 (small-real-money journey before public) while its LAUNCH.md deploys contracts at step 7, runs a real-money tip at step 8 and publishes at step 9, which reads on its face like both lines are satisfied. Regraded 2026-09-03 with the judge held fixed (`2026-08-27T152941Z-codex-no-skill-3-regrade-1`): all eight verdicts reproduced exactly, expect_1 and expect_2 included. The plan's step 8 points "a restricted preview" at the live contract, and a preview deployment is a public URL — so the journey does not precede the frontend going public, and the frontend is never on localhost against live contracts, which is the middle move expect_1 grades. Both verdicts stand and expect_2's `no_skill` rate is 3/3 as reported.

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

## Provenance of the run records

Every `skill_version` in this branch's 24 runs was restamped on 2026-09-03. Setup records repo HEAD, and this branch was rewritten after the runs were made, so the shas the runs carried — `a04cb2c` and `156168e` — survived only as orphaned objects and would have been unrecoverable after merge. Each was replaced by a reachable commit with a byte-identical `skills/orchestration/SKILL.md`: `a04cb2c` -> `6b31941`, `156168e` -> `c065e45`. The installed text is unchanged in both cases; only the pointer moved. `AGENTS.md` now states the check.
