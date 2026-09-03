# orchestration-goal-001

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 per variant for the reported comparison. The `with_skill` arm was rerun after the one-line no-explorer-key fix; the earlier 0/3 skill arm remains append-only evidence but is superseded for the current skill version. All runs were self-judged by fresh blind processes on the same stack, a caveat on the comparison.

**Skill load: 3 of 3 in each `with_skill` set.** `skills/orchestration/SKILL.md` appears in all three transcripts of both the 152418Z and the 180856Z arms.

The patched `with_skill` arm passed 3/3 versus `no_skill` 0/3, with every skill run passing all eight checks. This closes the prior expect-4 regression: before the line was strengthened, all three skill plans required the team to supply an explorer key; afterwards none did. No-skill failed that check 3/3 and additionally missed small-real-money testing 3/3, the pre-mainnet gate 3/3, the pre-public gate 2/3, adjacent verification 1/3, and staging 1/3.

**Two of those `no_skill` line verdicts look like judge misses, and one of them is load-bearing.** `no-skill-3` was failed on expect_1 (staging) and expect_2 (small-real-money journey before public), and its LAUNCH.md does both: contracts deploy in "7. Mainnet deployment ceremony", a real-money tip through a restricted preview against the live contracts runs in "8. Restricted real-money smoke test" — funded test fan wallet, `balanceOf` before and after, fee arithmetic checked — and `vercel --prod` is not reached until "9. Publish and operate". Runs 1 and 2 fail expect_2 correctly: both publish the frontend and smoke-test afterwards ("6. Deploy frontend, smoke test, then announce"; "6. Public frontend and mainnet canary"). So expect_2's `no_skill` rate is likelier 2/3 than 3/3, and expect_1's 1/3 failure is likelier 0/3. The aggregate does not move — `no-skill-3` still fails expect_4, expect_5 and expect_6, so the arm stays 0/3 — but expect_2 at `no_skill` 0/3 is one of the two deltas the rewrite cites for keeping the staged-rollout claim, and at 1/3 it is a weaker one. This is a reading of the deliverable, not a verdict; the regrade beside these runs is what settles it.

Median usage for the patched arm was `with_skill` 258s / 44,770 tokens versus `no_skill` 312s / 68,753 tokens.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes: `3/3 vs 0/3`. |
| Did it reduce time/tokens? | Yes: 258s / 44,770 tokens vs 312s / 68,753 tokens. |
| Did it create negative deltas? | None relative to no-skill. |
| What mistakes repeated without the skill? | `orchestration-stale-verification-key`, `orchestration-transition-gates-implicit` |
| What mistakes remained with the skill? | None |
| What should change in the skill? | No further change supported; the strengthened no-key line and explicit gates both held 3/3. |
| What should change in the eval? | Keep the split gate checks; they localized the improvement. Watch expect_1/expect_2 for judge sensitivity — one `no_skill` plan was failed on both while satisfying both. |

## Provenance of the run records

Every `skill_version` in this branch's 24 runs was restamped on 2026-09-03. Setup records repo HEAD, and this branch was rewritten after the runs were made, so the shas the runs carried — `a04cb2c` and `156168e` — survived only as orphaned objects and would have been unrecoverable after merge. Each was replaced by a reachable commit with a byte-identical `skills/orchestration/SKILL.md`: `a04cb2c` -> `6b31941`, `156168e` -> `c065e45`. The installed text is unchanged in both cases; only the pointer moved. `AGENTS.md` now states the check.
