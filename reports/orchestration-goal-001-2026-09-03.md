# orchestration-goal-001

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 `with_skill` on `5ad8abf`; the `no_skill` arm is the unchanged three-run 2026-08-27 set (0/3). All new runs were self-judged by fresh blind processes on the same stack, a caveat on the comparison.

Why this set exists: the 2026-08-26 rewrite silently dropped the deployer step (`yarn generate` -> `yarn account` -> fund with real ETH) and the `targetNetworks` switch. Neither appeared in the PR's cut list, no expect line grades either, and 3/3 of the 2026-08-27 `with_skill` plans omitted `yarn generate` — so a runbook built from the skill could reach `yarn deploy --network base` with an unfunded deployer. Both were folded back in on 2026-09-03: the funded deployer as part of the pre-deploy gate, `targetNetworks` as one bullet. This measures the skill with them.

**Skill load: 3 of 3.** `skills/orchestration/SKILL.md` appears in all three transcripts.

**The restored material lands.** Against the 2026-08-27 arm that lacked it:

| | `yarn generate` | `yarn account` | `targetNetworks` |
| --- | --- | --- | --- |
| 2026-08-27 (`c065e45`) | 0/3 | 1/3 | 0/3 |
| 2026-09-03 (`5ad8abf`) | 2/3 | 3/3 | 3/3 |

**And the pass rate went 3/3 -> 2/3.** Run 2 failed expect_7, the post-deploy gate. It is a borderline verdict rather than an absent step: its section 9 says "Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash." The URL is loaded and exercised, so the *action* expect_7 asks for is there — what is missing is a stated condition, and expect_7 grades "an explicit go/no-go check, not merely the commands". The plan's last stated gate is "**Go live only if:** ..." at the end of section 8, before publishing; nothing after the deploy is phrased as something that has to hold. The judge's reading is defensible on the line as written.

Two readings, and this set does not separate them. Either the added deployer and `targetNetworks` material crowds the third gate — run 2 is also the one run that omitted `yarn generate`, so it is not a plan that simply absorbed everything — or this is variance at n=3 on a line with known wording sensitivity, which the 2026-08-13 regrade showed moving in both directions on unchanged text. A second three-run set on `5ad8abf` would tell them apart, and is the honest next step before this number is quoted anywhere.

What is not in doubt: the hole the restored lines close is real, they close it, and the cost of closing it is at worst one gate verdict on one run. Median usage 240s / 38,087 tokens against the prior arm's 258s / 44,770.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes: `2/3 vs 0/3`. Down from `3/3` on the skill text that lacked the deployer step. |
| Did it reduce time/tokens? | Yes: 240s / 38,087 tokens vs `no_skill` 312s / 68,753. |
| Did it create negative deltas? | None relative to no-skill. Relative to the previous skill version, one expect_7 failure — unresolved between crowding and variance. |
| What mistakes repeated without the skill? | `orchestration-stale-verification-key`, `orchestration-transition-gates-implicit` |
| What mistakes remained with the skill? | `orchestration-transition-gates-implicit`, 1/3, on the post-deploy boundary only. |
| What should change in the skill? | Nothing yet. Re-measure before reacting to a single borderline gate verdict. |
| What should change in the eval? | Grade the funded deployer and the `targetNetworks` switch. Both are now in the skill, both are real launch prerequisites, and neither has an expect line — which is how they were cut unnoticed in the first place. |
