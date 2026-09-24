# major-refine: l2s (GPT 5.5 high)

- **Benchmark:** `major-refine-d9952522`, the l2s row of the GPT 5.5 high column of [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)
- **Executor:** `codex` · `gpt-5.5` · effort `high`, passed on argv for every run
- **Judge:** `claude` · `claude-opus-5` · effort `high`, the same for every run. No run is self-judged (`self_judged: false` on all 45).
- **Arms:**
  - none: `no_skill`
  - old: `with_skill` at `skill_version: 2f0adb01`, the 187-line vendored text
  - new: `with_skill` at `skill_version: d9952522`, the 50-line minimal rewrite

  The trigger was not forced, so these numbers are trigger-inclusive.
- **Runs:** 3 per arm per task, interleaved none → old → new within each run number, one executor at a time. 45 graded runs.
- **Tasks:** every live task with `skill: skills/l2s`:
  - `l2s-quiz-001`: Celo → Ethereum sweep runbook
  - `l2s-quiz-002`: Polygon zkEVM payout outage
  - `l2s-quiz-003`: Base ↔ OP Mainnet game token
  - `l2s-quiz-004`: Rust scoring library, chain choice
  - `l2s-goal-001`: Celo payout and sweep tooling, bare workspace
- **Date:** 2026-09-23

## Headline: new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| l2s-quiz-001 | 3/3 | 3/3 | 3/3 |
| l2s-quiz-002 | 3/3 | 3/3 | 2/3 |
| l2s-quiz-003 | 2/3 | 2/3 | 2/3 |
| l2s-quiz-004 | 3/3 | 3/3 | 3/3 |
| l2s-goal-001 | 3/3 | 3/3 | 2/3 |
| **total** | **14/15** | **14/15** | **12/15** |

**GPT 5.5 high barely needs this skill.**
- quiz-001 and quiz-004 are saturated: 9/9 on every arm.
- None of the five failures is a pattern: each failing line fails in exactly one run of an arm.
- Both skill texts come out 14/15. The two extra no-skill failures are one run each, which is too few to call a skill effect.
- The one line where a skill arm failed (quiz-003 e2) fails in both skill arms and passes in every no-skill run. That is the reverse of what the Opus row measured.

**The skill triggered on every with_skill run.** All 30 with_skill runs read `.agents/skills/l2s/SKILL.md` with `sed -n '1,240p'` (one run used `'1,220p'`). Either range covers the old text's 187 lines in full. So any old-vs-new difference is content, not triggering.

## Per-check failures

| Task · line | new | old | none | What fails |
| --- | --- | --- | --- | --- |
| quiz-003 e2 (Base's departure named) | 1/3 | 1/3 | 0/3 | The run keeps Superchain interop off the Q4 path but never says Base has left the OP Stack. It says only that the design does not assume a shared stack. |
| quiz-003 e1 (interop not shippable) | 0/3 | 0/3 | 1/3 | Native Superchain interop is the preferred transport, conditional on production-readiness, and the answer never says it isn't live |
| quiz-003 e3 (concrete Q4 design) | 0/3 | 0/3 | 1/3 | Same run. The fallback is "a production third-party transport", with no carrier named |
| quiz-002 e2 (named replacement chain) | 0/3 | 0/3 | 1/3 | "Deploy `PayoutVaultV2` on the selected live chain". No chain is named and no reason given. |
| goal-001 e5 (cycle timing for finance) | 0/3 | 0/3 | 1/3 | NOTES.md says "the bridge finalization window must elapse" with no figure. Finance cannot tell that the sweep takes days. |

Every other line passed in every run. Notes on the lines above:

- **quiz-003 e2 is a negative delta for both skill texts on this stack.**
  - All three no-skill runs named Base's departure unaided, from web search of `blog.base.dev`. Examples: "Base has publicly said it is moving away from the OP Stack distribution", and "Base's move toward a Base-operated stack".
  - The two skill-arm misses both read the fact and then softened it:
    - new run 1 (`203804Z`): "Base should not be treated as sharing OP Mainnet's stack/governance assumptions"
    - old run 3 (`205150Z`): "Assuming Base and OP Mainnet will remain in the same native interop dependency set"
  - On Opus the direction is opposite: none 1/3, both skill arms 3/3 (`l2s-base-departure-model-blindspot`).
  - Filed as `l2s-base-departure-unnamed-with-skill-gpt-5.5-high`. At one run per arm it is weak evidence.
- **quiz-002 e2.** The Opus row saw a new-vs-old gap on this line (old 2/3 fail, new 0/3). It does not reproduce here: both skill arms named a chain in every run. The one no-skill miss is filed as `l2s-zkevm-replacement-chain-deferred-gpt-5.5-high`. It mirrors the Opus row's `l2s-zkevm-replacement-chain-deferred`, which is still on that row's branch.
- **goal-001.**
  - All nine runs built the canonical OP Stack initiate → prove → finalize withdrawal. All nine said Celo is an OP Stack L2.
  - The one failure is a missing number, not a wrong route. Filed as `l2s-celo-exit-timing-unstated-gpt-5.5-high`.
- **quiz-003 no-skill run 2** (`204038Z`) is the only run that built the Q4 plan around shared-stack interop. Filed as `l2s-superchain-interop-as-q4-path-gpt-5.5-high`.

## Cost (from `yarn run-stats`, codex list price)

All dollar figures are `cost_source: list_price`: each run's token split priced at OpenAI's standard-tier list price in `lib/prices.ts`. They are not a bill. Tokens are `total_tokens`, and all 45 runs are `exec --json` runs with the four-way split. Turns are not measured, because codex reports none (`turns: null`).

Medians per arm, with the cost range across the three runs:

| Task | Arm | Duration | Cost (range) | Tokens |
| --- | --- | --- | --- | --- |
| l2s-quiz-001 | new | 178s | $0.85 ($0.83–$1.33) | 492,708 |
| | old | 182s | $1.07 ($0.86–$1.16) | 466,908 |
| | none | 130s | $0.82 ($0.80–$0.89) | 303,460 |
| l2s-quiz-002 | new | 93s | $0.34 ($0.32–$0.36) | 134,889 |
| | old | 94s | $0.42 ($0.32–$0.49) | 161,656 |
| | none | 85s | $0.34 ($0.33–$0.35) | 139,232 |
| l2s-quiz-003 | new | 124s | $0.54 ($0.44–$0.91) | 280,077 |
| | old | 115s | $0.59 ($0.42–$0.76) | 217,683 |
| | none | 155s | $1.05 ($1.04–$1.38) | 443,510 |
| l2s-quiz-004 | new | 71s | $0.32 ($0.21–$0.36) | 146,026 |
| | old | 88s | $0.43 ($0.38–$0.55) | 192,505 |
| | none | 74s | $0.24 ($0.15–$0.38) | 100,719 |
| l2s-goal-001 | new | 507s | $2.51 ($2.40–$3.41) | 2,765,105 |
| | old | 556s | $2.50 ($1.70–$3.01) | 2,292,464 |
| | none | 494s | $2.85 ($2.46–$3.26) | 2,968,132 |

- **New vs old:** the new text's median cost is at or below the old text's on four of five tasks. goal-001 is level ($2.51 vs $2.50). The cost ranges overlap on every task, so there is no clear cost win either way.
- **New vs none:**
  - quiz-003 is where the skill saves money: $0.54 vs $1.05 and 280k vs 444k tokens, with ranges that do not overlap. No-skill runs made 11–15 web searches each, against 3–7 for the skill arms.
  - quiz-001 goes the other way on tokens (493k vs 303k), but the dollar ranges overlap.
  - Elsewhere the two are within each other's ranges.

## Discarded runs and harness notes

Two runs were discarded and made again. Neither was graded.

1. **`l2s-quiz-002/2026-09-23T202214Z-codex-with-skill-d9952522-2`** (new, run 2): killed mid-run.
   - **What happened:** `run-executor` received SIGTERM or SIGINT about 90s in and left `finished: null`.
   - **Cause:** at the same moment every loop on the shared box died. The operator's notes attribute this to a sibling row's claude executor, which ran `pkill -f tsx` as cleanup at ~20:23Z. That pattern matches every `tsx scripts/run-executor.ts` on the machine.
   - **Handling:** I deleted the run dir and its workspace, and set up the run again as `2026-09-23T202404Z-codex-with-skill-d9952522-2`. The replacement passed.
2. **`l2s-goal-001/2026-09-23T212042Z-codex-with-skill-2f0adb01-1`** (old, run 1): finished but could not be graded.
   - **What happened:** the executor finished cleanly (exit 0, 741s). `verify` then failed twice with `judge failed: judge exited non-zero` and wrote no grade.
   - **Cause:** codex's `workspace-write` sandbox makes `~/.npm` read-only (`EROFS`), so the executor pointed npm's cache at `.npm-cache` inside the workspace. `verify`'s bare-workspace snapshot does not skip that directory, so it swept 7.7 MB of cacache text into `output/` and into the judge prompt. That is far past the judge's context.
   - **Handling:** a harness failure, not a result. I deleted the run dir and its workspace and set it up again as `2026-09-23T213447Z-codex-with-skill-2f0adb01-1`. The replacement passed.
   - **Not a one-off:** the concepts GPT 5.5 row hit the same leak (`.npm-cache` and `.home`, 50 MB). Every codex goal run hits the EROFS; whether it becomes a harness failure depends on whether the executor puts the cache in `/tmp` or in the workspace. The other eight goal-001 runs used `/tmp` or installed cleanly; none of the committed `output/` dirs contains a cache. Discarding these runs selects on a behaviour, so the harness fix matters.
   - **Suggested fix, for #119:** add `.npm-cache`, `.home` and similar in-workspace caches to `GENERATED_DIRS`, or cap the snapshot size before the judge is spawned. Not made here, because the harness is pinned.

**No other refusals or failures.** No `--grade-failed-run` was used, and every graded run has `executor_exit: 0`. All 45 `output/` snapshots are force-added (56–80K per goal run, one `answer.md` per quiz run), so every grade can be regraded from a clone.

**Rubric question for #119, not regraded because the rubric is pinned.** quiz-003 e2 accepts "Base runs its own stack now". New run 1 wrote "Base should not be treated as sharing OP Mainnet's stack/governance assumptions" and was failed. That is a close call. Under the lenient reading, quiz-003 comes out new 3/3 · old 2/3 · none 2/3. The headline keeps the grades as recorded.

## Summary

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Barely. new 14/15 · old 14/15 · none 12/15. The two no-skill failures the skill arms avoid (quiz-002 e2, goal-001 e5) are one run each. New vs old: no difference in total, and none on any task. |
| Did it reduce time/tokens? | On quiz-003 only, against no skill: new $0.54 / 124s / 280k vs none $1.05 / 155s / 444k. Elsewhere the new text is level with no skill within the ranges, and at or below the old text on median cost (e.g. quiz-004 $0.32 vs $0.43). |
| Did it create negative deltas? | quiz-003 e2: both skill arms missed Base's departure once (1/3 each), and no-skill never missed it (0/3). Token cost on quiz-001: new 493k and old 467k vs none 303k, though the dollar ranges overlap. |
| What mistakes repeated without the skill? | None repeated. Each no-skill failure is a single run: `l2s-zkevm-replacement-chain-deferred-gpt-5.5-high`, `l2s-celo-exit-timing-unstated-gpt-5.5-high`, `l2s-superchain-interop-as-q4-path-gpt-5.5-high` |
| What mistakes remained with the skill? | `l2s-base-departure-unnamed-with-skill-gpt-5.5-high` (old 1/3, new 1/3) |
| What should change in the skill? | Nothing at this evidence. If the quiz-003 e2 miss repeats on other stacks, state the Base fact in a form that gets quoted, not paraphrased ("Base has left the Superchain"). Keep the paragraph: it is still what rescues Opus on this line. |
| What should change in the eval? | (1) Harness: exclude in-workspace caches (`.npm-cache`, `.home`) from the bare-workspace snapshot, or cap evidence size before judging (see discarded run 2). (2) quiz-003 e2: decide whether "should not be treated as sharing the stack" names the departure. (3) On GPT 5.5 high, quiz-001 and quiz-004 are 9/9 on every arm, and quiz-002 and goal-001 separate the arms by one run. This set cannot distinguish old from new on this stack. |
