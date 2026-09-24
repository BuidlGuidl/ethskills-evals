# major-refine: concepts (GPT 5.5 high)

- **Benchmark:** `major-refine-d9952522`, the concepts row of the GPT 5.5 high column of [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)
- **Executor:** `codex` · `gpt-5.5` · effort `high`, passed on argv for every run
- **Judge:** `claude` · `claude-opus-5` · effort `high`, the same for every run. No run is self-judged (`self_judged: false` on all 27).
- **Arms:** none (`no_skill`) · old (`with_skill`, `skill_version: 2f0adb01`, the 230-line vendored text) · new (`with_skill`, `skill_version: d9952522`, the 42-line refined text). Trigger-inclusive: the trigger was not forced.
- **Runs:** 3 per arm per task, interleaved none → old → new within each run number, one executor at a time. 27 graded runs.
- **Tasks:** `concepts-quiz-001` (same-evening raffle randomness), `concepts-quiz-002` (harvest-incentive vault), `concepts-goal-001` (onchain subscription billing, bare workspace). These are every live task with `skill: skills/concepts`.
- **Date:** 2026-09-23

## Headline: new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| concepts-quiz-001 | 2/3 | 1/3 | 2/3 |
| concepts-quiz-002 | 3/3 | 2/3 | 2/3 |
| concepts-goal-001 | 3/3 | 0/3 | 0/3 |
| **total** | **8/9** | **3/9** | **4/9** |

The refined text is the only arm that passes the goal task. On this stack the old text does no better than no skill at all: 3/9 against 4/9.

**The skill triggered on every with_skill run.** All 18 with_skill runs read `.agents/skills/concepts/SKILL.md` with `sed -n '1,240p'`. That covers the old text's 230 lines in full. So the old-vs-new gap is a difference in content, not in triggering.

## Per-check failures

| Task · line | new | old | none | What fails |
| --- | --- | --- | --- | --- |
| goal-001 e7 (what survives the operator) | 0/3 | 3/3 | 3/3 | NOTES.md never splits the contracts from the weather API and check service. Old-text run 2 stops at "Verify the contract on the chain explorer". |
| goal-001 e6 (what is public) | 0/3 | 0/3 | 3/3 | No-skill NOTES.md never says that subscriber addresses, plans and balances are readable by anyone |
| quiz-001 e5 (missed reveal) | 0/3 | 2/3 | 1/3 | All-or-abort commit-reveal: one absent revealer voids or restarts the draw |
| quiz-001 e2 (blockhash lookback) | 1/3 | 0/3 | 0/3 | "comfortably below `blockhash` expiry, for example 180 mainnet blocks", with no 256 and no 8191 |
| quiz-002 e1 (fee vs gas, as figures) | 0/3 | 1/3 | 1/3 | No per-call gas figure or gas price; "sub-gwei", or "the caller loses money" |
| quiz-002 e2 (cadence from that comparison) | 0/3 | 0/3 | 1/3 | Same no-skill run: a qualitative cadence with no break-even |

Every other line passed in every run. Notes on the lines above:

- **goal-001 is where the refinement shows.** Every run chose the same charging design, whatever the arm: Foundry, access accrued at read time in the `isSubscribed` view, and permissionless `settle`/`collect`. Two runs added an optional keeper on top. So e1–e5 pass 9/9, and the prior this skill corrects first ("charged monthly" needs a cron) is not held by GPT 5.5. What separates the arms is the end-of-build CROPS write-up:
  - Old-text runs carry the privacy question (e6 3/3) but not the forkability split (e7 0/3).
  - No-skill runs carry neither.
  - Both new-text passes that were examined wrote explicit sections: "Onchain Tradeoffs", and "What This Gives Up" answering all four questions.
  - No run named a target chain; all are chain-agnostic through `RPC_URL`.
- **quiz-001 e5 tracks a design choice.** All three new-text runs forfeit the absent entrant and bond the committers ("They are ineligible. Their bond is forfeited."). All three old-text runs, and two of three no-skill runs, made the draw all-or-abort instead. The graded counts are lower than that (old 2/3, none 1/3) because of the judge-consistency issue below.
- **quiz-002 pricing.** 8/9 runs got gas and ETH prices through codex `web_search`; none called `eth_gasPrice` over RPC. On the same day the searched gas price ranged from 0.063 gwei to 3 gwei across runs. ETH clustered at $2,700–2,750. No expect line grades where the prices came from. See `mistakes/concepts/concepts-gas-price-from-memory.yaml`; no new record is filed for it.

## Cost (from `yarn run-stats`, codex list price)

All dollar figures are `cost_source: list_price`: each run's token split priced at OpenAI's standard-tier list price in `lib/prices.ts`. They are not a bill. Tokens are `total_tokens`, and all 27 runs are `exec --json` runs with the four-way split.

Medians per arm, with the cost range across the three runs:

| Task | Arm | Duration | Cost (range) | Tokens |
| --- | --- | --- | --- | --- |
| concepts-quiz-001 | new | 133s | $0.33 ($0.28–$0.51) | 130,764 |
| | old | 239s | $0.57 ($0.44–$0.61) | 212,101 |
| | none | 157s | $0.38 ($0.36–$0.45) | 99,698 |
| concepts-quiz-002 | new | 105s | $0.34 ($0.31–$0.40) | 149,769 |
| | old | 99s | $0.39 ($0.34–$0.41) | 174,487 |
| | none | 94s | $0.32 ($0.23–$0.45) | 151,882 |
| concepts-goal-001 | new | 338s | $0.88 ($0.62–$0.93) | 433,171 |
| | old | 317s | $0.94 ($0.78–$1.02) | 609,272 |
| | none | 269s | $0.80 ($0.63–$1.03) | 463,966 |

- **New vs old:** the new text is cheaper than the old on every task by median. The only clear gap is quiz-001: $0.33 vs $0.57, 131k vs 212k tokens, 133s vs 239s. On the other two tasks the ranges overlap.
- **New vs none:** the new text costs about the same as no skill. It passes 8/9 against 4/9 for $0.02–0.08 more per run by median, and the ranges overlap on all three tasks.
- **Turns:** not measured. Codex reports no turn count (`turns: null`).

## Discarded and harness notes

- **One run discarded and made again:** `concepts-goal-001/2026-09-23T141137Z-codex-with-skill-2f0adb01-3` (old, run 3).
  - **What happened:** the executor finished cleanly (exit 0), then `verify` failed with `judge failed: spawnSync env EPIPE`, and no grade was written.
  - **Cause:** codex's `workspace-write` sandbox made `~/.npm` and `~/.config` read-only (`EROFS`). The executor worked around that by running `npm install --cache .npm-cache` and hardhat with `HOME=.home` inside the workspace. `verify`'s bare-workspace snapshot does not skip those directories, so it swept 1,853 files (50 MB) of npm cache into `output/` and into the judge's evidence, and spawning the judge broke on it.
  - **Handling:** this is a harness failure, not a result. I deleted the run dir and its workspace and set up the run again as `2026-09-23T141924Z-codex-with-skill-2f0adb01-3`. That replacement ran hardhat-free and graded normally (e7 fail, like the other two old-text runs).
  - **Not a one-off:** a smaller copy of the same leak is committed in `concepts-goal-001/2026-09-23T134821Z-codex-no-skill-2/output/.home/.svm/` (solc-select state, a few KB). Any codex goal task that runs npm or svm can hit this. Suggested harness fix, to raise on #119, not made here because the harness is pinned: add `.npm-cache`, `.home` and similar in-workspace caches to `GENERATED_DIRS`, or cap the snapshot size before the judge is spawned.
- **Judge consistency on quiz-001 e5, to raise on #119, not regraded because the rubric is pinned.** Three runs built the same all-or-abort ceremony: bonded non-entrant witnesses, where one missed reveal voids or re-rolls the draw. They were graded differently:
  - old run 1 (`123731Z`): pass
  - no-skill run 3 (`125715Z`): pass
  - old run 2 (`124902Z`): fail

  Read consistently they should all pass or all fail. Under the strict reading, which is the line's own first clause ("the missed step forfeits that entrant instead of stalling the draw"), quiz-001 comes out new 2/3 · old 0/3 · none 1/3. The headline above keeps the grades as recorded.
- **No other refusals or failures.** No `--grade-failed-run` and no `--allow-skill-mention` were used. Every graded run has `executor_exit: 0`.
- **Evidence is committed.** Every run's `output/` is force-added (104 files, about 1 MB in total), so every grade here can be re-checked and regraded from a clone.
- **Workspaces:** `yarn clean-workspaces` was not run, because other operators' runs are live in sibling worktrees. `verify` removed this row's workspaces as it graded them.

## Mistake records

All five are new files, suffixed with this stack, so they sit beside the claude-era records rather than editing them:

- `concepts-forkability-stops-at-verified-contracts-gpt-5.5-high`: goal e7, none 3/3 · old 3/3 · new 0/3. Status `fixed` for the new text. It answers the parent record's "reopen if expect_7 fails on any other stack": it fails on this stack, but only without the new text.
- `concepts-subscriber-privacy-unstated-gpt-5.5-high`: goal e6, none 3/3 · both skill texts 0/3. Closed on this stack. This is the higher base rate the claude record said it needed.
- `concepts-draw-aborts-on-missed-reveal-gpt-5.5-high` (new pattern): quiz-001 e5, graded none 1/3 · old 2/3 · new 0/3. The all-or-abort shape itself appears in none 2/3 · old 3/3 · new 0/3.
- `concepts-harvest-incentive-unpriced-gpt-5.5-high` (new pattern): quiz-002 e1, none 1/3 · old 1/3 · new 0/3.
- `concepts-blockhash-lookback-unstated-gpt-5.5-high` (new pattern, weak evidence): quiz-001 e2, new 1/3.

## Summary

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **New vs none: yes, `8/9` vs `4/9`**. Per task: quiz-001 `2/3` vs `2/3`, quiz-002 `3/3` vs `2/3`, goal-001 `3/3` vs `0/3`. **New vs old: yes, `8/9` vs `3/9`**. The old text did not beat no skill on this stack (`3/9` vs `4/9`). |
| Did it reduce time/tokens? | **New vs old: yes by median**, clearly on quiz-001 (`133s / 131k / $0.33` vs `239s / 212k / $0.57`); on quiz-002 and goal-001 the ranges overlap (`105s / 150k` vs `99s / 174k`; `338s / 433k` vs `317s / 609k`). **New vs none: no reduction**; within noise on all three tasks (quiz-001 `133s / 131k` vs `157s / 100k`, quiz-002 `105s / 150k` vs `94s / 152k`, goal-001 `338s / 433k` vs `269s / 464k`). All dollar figures are list price. |
| Did it create negative deltas? | **New:** one quiz-001 e2 failure (lookback number not stated), a line no other arm failed. At n=1 it is not a demonstrated regression. **Old:** quiz-001 e5 is worse than none (2/3 vs 1/3 graded, 3/3 vs 2/3 by design shape); the old text's randomness section pushed runs toward all-or-abort. |
| What mistakes repeated without the skill? | `concepts-forkability-stops-at-verified-contracts-gpt-5.5-high` (3/3), `concepts-subscriber-privacy-unstated-gpt-5.5-high` (3/3), `concepts-draw-aborts-on-missed-reveal-gpt-5.5-high` (shape 2/3, graded 1/3), `concepts-harvest-incentive-unpriced-gpt-5.5-high` (1/3) |
| What mistakes remained with the skill? | **New:** `concepts-blockhash-lookback-unstated-gpt-5.5-high` (1/3). **Old:** `concepts-forkability-stops-at-verified-contracts-gpt-5.5-high` (3/3), `concepts-draw-aborts-on-missed-reveal-gpt-5.5-high` (graded 2/3), `concepts-harvest-incentive-unpriced-gpt-5.5-high` (1/3) |
| What should change in the skill? | **Nothing on this evidence.** Each failure the new text still has is n=1. If the lookback miss recurs on another stack, the commit-reveal bullet could require the answer to *state* the limit it sizes against, not just mind it. The benchmark supports the old→new rewrite: the old text's CROPS list at the top never reached the goal's NOTES.md (e7 0/3), and the new end-of-build questions did (3/3). |
| What should change in the eval? | **(1)** quiz-001 e5 was graded inconsistently on identical all-or-abort witness designs; tighten the line or its judge prompt so "one absence re-rolls the draw" has one reading. **(2)** The `verify` snapshot needs to exclude in-workspace caches (`.npm-cache`, `.home`). On codex the read-only-home sandbox makes them routine, and one killed a judge here. **(3)** quiz-002 e1 accepts any stated prices, so search-snippet gas prices that differed 50× on one day all pass. If where the prices come from matters, the line has to say so. **(4)** GPT 5.5 passes goal-001 e1–e5 in every arm, so that task measures only the CROPS write-up on this stack. |
