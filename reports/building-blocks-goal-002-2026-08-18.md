# eval: building-blocks-goal-002 (claude/opus-5)

**Skill:** `skills/building-blocks` at `06e154a` (467-word candidate)

**Task:** `building-blocks-goal-002` · **Executor:** claude, `claude-opus-5` · **Judge:** claude, `claude-opus-5` · **Runs:** 3 per variant
**Date:** 2026-08-14 → 2026-08-18 · **Trigger:** content-only

All runs are recorded `self_judged: true` because executor and judge use the same agent. Each verdict still came from a fresh blind Claude process that saw the task and workspace evidence, not the skill, variant, or executor transcript.

## Result

| Variant | Full passes | Per-check result |
| --- | ---: | --- |
| `no_skill` | **1/3** | expect 1, 3, 4, 5: 3/3; expect 2: 1/3 |
| `with_skill` | **3/3** | all five checks: 3/3 |

This is the quiz-pass / goal-split outcome in issue #1: the model knows the protocol facts when asked, but the skill makes it apply live venue verification during a build. That is a trigger benefit a passive wiki page cannot reliably provide, so a small skill is justified.

## What separated the arms

All six valid runs independently made the same core decisions:

- selected a concrete Aerodrome USDC/WETH pool and gauge on Base;
- treated gauge emissions as the LP reward and did not harvest trading fees;
- built contracts and deployment setup rather than leaving a generic DEX adapter;
- passed the requested build and test check;
- did not repeat the stale completed-Aero-merger claim.

The protocol knowledge therefore did not distinguish the variants. The only repeated control failure was expect 2. Two controls asserted that Aerodrome was dominant or had comparable depth without a dated source or current pair figure. Both recognized that addresses and gauges can change, but deferred verification to the deployer.

All three skilled runs measured before choosing. They compared live pools, gauge status, liquidity, volume or emissions, dated the observations, and cited how to reproduce them. Their actual choices differed: two used the simpler volatile pool and one accepted Slipstream complexity for much stronger measured emissions. That is the intended behavior—current pair evidence drives the integration rather than a static leaderboard.

Mistake filed: `building-blocks-live-pair-evidence-omitted` (`no_skill` 2/3, `with_skill` 0/3).

## What this says about the skill

PR #69 already showed that Opus 5 knows the Aerodrome fee model, Aave premium, Pendle/GMX stack, and Uniswap V4 hook mechanics without a skill. This goal confirms it: even failed controls implemented the Aerodrome mechanics correctly. Retaining those facts in an always-loaded skill would cache knowledge the model already has and create another stale-data surface.

The tested candidate's opening instruction did add capability: it made live, pair-specific verification happen unprompted. The branch therefore reduces the skill again after this benchmark—from 467 words to a trigger-only instruction to verify current deployments, pair metrics, incentives, fees, and reward routing, plus one composition guardrail. The protocol explanations belong in a wiki/reference layer.

The new shorter version was not the version tested here. It must be rerun against this same task before merge; do not transfer the 3/3 score to it without evidence.

**Superseded 2026-08-21.** That re-run happened: the 128-word trigger reproduces this split, 3/3 vs 1/3, and fires unprompted in all three skilled runs. See `reports/building-blocks-goal-002-2026-08-21.md`, which also records two things this round got wrong — a control that shipped the fees-plus-emissions double count, against the claim below that even failed controls implemented the Aerodrome mechanics correctly, and an `expect_2` verdict on the newer round's passing control that looks like a judge false pass.

Two things the re-run has to settle beyond the pass count. The benchmarked `description` named Uniswap, Aerodrome, Aave, GMX and Pendle; the shipped one names no protocol, and this task's input names no DEX, so whether the skill still fires unprompted is itself untested. And the run record has to carry the evidence the judge graded — `run.diff` committed and non-empty, plus a full session transcript — or the re-run reproduces the same unauditable result at a different sha.

## Integrity notes

- One empty control attempt stopped on the Claude subscription limit and was deleted.
- One skilled attempt returned only an HTTP 529 overload error, graded 0/5 because it had no evidence, and was deleted rather than counted.
- A partial replacement was stopped at the user's request before completion and deleted.
- The first run's judge timed out once; the unchanged evidence passed 5/5 on a fresh retry.
- A scheduled continuation failed before setup because its service environment could not resolve `tsx`; it created no benchmark run.
- Transcript capture contains the CLI's final response rather than machine-readable token/cost telemetry, so no reliable token, cost, or duration comparison is reported.
- **No graded evidence is committed for these runs.** `run.diff` is not gitignored and should have been committed; it was not, and the workspaces were deleted after grading, so it cannot be recovered. What ships is a judge verdict plus a `transcript.md` holding the executor's final message — 25 to 41 lines, not a session log. A reader cannot re-check the judge on what the judge saw. This is not fixable in place; the re-run below has to commit `run.diff` and capture the full session.
- **`expect_5` graded a claim the judge could not see.** It was worded "the transcript shows `forge build` and `forge test` completing successfully", but `verify` hands the judge `run.diff` plus `output/` and never the transcript. All six runs read `expect_5: pass` on evidence that could not support the check. The expect has since been rewritten to grade the committed test suite instead; the six records predate that rewrite. Whether the commands passed is an orchestrator reading of the transcript, and remains unverified for these runs.
- **Two of the three `with_skill` runs show no evidence the skill loaded.** The trigger is content-only, so firing is the agent's choice. `with-skill-1` mentions it in prose; `with-skill-2` and `with-skill-3` mention nothing, and a final-message transcript cannot show a tool call. For contrast, the five-task benchmark's full transcripts carry dozens of skill references each. The 3/3 arm should be read as "3 runs with the skill installed", not "3 runs that used it".
- **A run that commits its own work is graded on an empty diff.** `writeDiff` diffs the worktree against the index with no baseline ref. These runs scaffold their own Foundry project, so the workspace carries a `.git` and takes that path. One transcript states it committed nothing; the other five are unverifiable.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes: **3/3 vs 1/3**. |
| Did it reduce time/tokens? | Not established; comparable machine-readable telemetry was not captured. |
| Did it create negative deltas? | No scored correctness delta. Skilled runs did more live research, which was necessary for the passing evidence. |
| What mistakes repeated without the skill? | `building-blocks-live-pair-evidence-omitted` in 2/3 controls. |
| What mistakes remained with the skill? | None across the five checks. |
| What should change in the skill? | Keep only the live-verification trigger and composition guardrail; move protocol facts and examples to the wiki. Rerun the shorter version. |
| What should change in the eval? | `expect_5` was ungradeable as written and is rewritten to grade the committed test suite. Re-runs must commit `run.diff`, confirm it is non-empty, and capture the full session transcript; without that the record cannot be re-checked. Otherwise the criteria hold: goal-002 exposed the intended unprompted behavior and the strengthened evidence floor graded it consistently. |
