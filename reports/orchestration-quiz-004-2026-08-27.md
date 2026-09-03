# orchestration-quiz-004

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 per variant. All six runs were self-judged by fresh blind processes on the same stack.

**Skill load: 3 of 3.** `skills/orchestration/SKILL.md` appears in all three `with_skill` transcripts.

Both arms passed 3/3 and all four checks passed in all six runs.

**How each run reached the answer** — the split the task notes pre-register, and the one that decides whether the line is dead weight. Anvil and cast were on PATH in all six runs; no run hit a missing binary. Every run read `packages/foundry/package.json` and the Makefile first, and then **every run executed something to settle it**, `no_skill` included. `no_skill` run 1 ran `yarn workspace @se-2/foundry fork base` and then `anvil --fork-url base` on a second port and compared `cast code` at the USDC address across three RPCs; runs 2 and 3 did not need a fork at all — run 2 used `MAKEFLAGS=-n yarn fork base` against `yarn fork -- base` to read the FORK_URL make would have used, and run 3 shimmed a fake `make` onto PATH for the same purpose. Both are decisive one-command experiments.

That is the finding. No `no_skill` run derived the argument-binding rule from the scripts alone; each one measured it in a checkout where the scripts, the Makefile, foundry.toml, anvil, cast and the network were all present, on a task that hands over the symptom and asks for a diagnosis. The skill's line exists to prevent a silent failure, and both arms passing a recovery test with a live checkout in hand is not evidence the prevention is redundant.

Median usage was `with_skill` 63s / 27,770 tokens versus `no_skill` 104s / 30,671 tokens, a modest efficiency benefit despite equal pass rates — and the run-versus-read split is where that 41s goes: the `no_skill` arm spent it running the experiment the skill line would have made unnecessary.

**Correction to the claim under test.** The skill line this task was written to validate was wrong about the mechanism, and expect_3 inherited the error. yarn binds the first token after the script name to `$0` whatever that token looks like; it does not specifically discard a bare positional, and a flag is not what makes the difference. Measured on yarn 4.13.0: `yarn fork --network base` -> `FORK_URL=base`, `yarn fork base` -> `mainnet`, `yarn fork --network=base` -> `mainnet`, `yarn fork -n base` -> `base`, `yarn fork -- base` -> `base`. `--network=base` is the natural second guess for a reader told "the flag is load-bearing", and it reaches the exact failure the line exists to prevent. Skill and task both corrected 2026-09-03; expect_3 now names two tokens rather than a flag shape, and fails `--network=base` explicitly. Regraded 2026-09-03 under the corrected lines, judge held fixed, all six runs: every one still passes 4/4, so no verdict in this table moves. Records are in `<run-id>-regrade-1`. That is the expected result — no recorded run proposed a single-token spelling — but the rule is to regrade rather than to predict.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No: `3/3 vs 3/3` |
| Did it reduce time/tokens? | Yes: 63s / 27,770 tokens vs 104s / 30,671 tokens. |
| Did it create negative deltas? | None |
| What mistakes repeated without the skill? | None |
| What mistakes remained with the skill? | None |
| What should change in the skill? | Fix it, do not cut it. The mechanism was misstated and is now corrected. The pre-registered cut rule reads on a pass-rate delta, but this task grades recovery after the symptom is handed over, and every `no_skill` run got there by running an experiment — which says nothing about the silent failure the line prevents. |
| What should change in the eval? | A goal-shaped version: a task that needs a Base fork and hints at nothing, where forking mainnet stays silent. That is the question the cut rule should be read against. |

## Provenance of the run records

Every `skill_version` under `artifacts/orchestration-*` was restamped on 2026-09-03. Setup records repo HEAD, and branches were rewritten after the runs were made, so four shas survived only as orphaned objects and would have been unrecoverable after merge. Each was replaced by a reachable commit with a byte-identical `skills/orchestration/SKILL.md`: `a04cb2c` -> `6b31941` and `156168e` -> `c065e45` (this branch's 24 runs), `9b3f8c0` and `6115e4f` -> `2f0adb0` (the 2026-08-13 sets inherited from #67, which had the same problem). The installed text is unchanged in every case; only the pointer moved. `AGENTS.md` now states the check to run before a merge.
