# major-refine: `building-blocks` on Opus 5 medium

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `claude` · `claude-opus-5` · effort `medium` |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | **true** on all 54 runs — judge and executor are the same agent |
| Runs | 3 per arm per task, 6 tasks × 3 arms = **54 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 `retracted`, 0 dead runs |
| Trigger | not forced — numbers are trigger-inclusive |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `building-blocks` skill, ~1,475 words |
| new | `with_skill` | `d9952522` | refined trigger, two paragraphs: verify live, trace the flow |

Both `skill_version` commits are ancestors of HEAD.

**Tasks** — all six live tasks whose `skill:` is `skills/building-blocks`; bare workspaces, no template.

- `building-blocks-quiz-001` (Base vault: which pool and why, harvest flow, earnings)
- `building-blocks-quiz-002` (Aerodrome USDC/WETH vault: harvest flow, earnings, where swap fees go)
- `building-blocks-quiz-003` (Aave flash-loan fee and repayment)
- `building-blocks-quiz-004` (Arbitrum yield stack: Pendle, GMX)
- `building-blocks-goal-001` (per-swap dynamic fee on Uniswap, V4 unnamed)
- `building-blocks-goal-002` (Base USDC/WETH yield vault in Foundry, DEX unnamed)

## Headline — pass counts, new · old · none

| Task | new · old · none |
| --- | --- |
| `building-blocks-quiz-001` | **`3/3 · 0/3 · 0/3`** |
| `building-blocks-quiz-002` | `2/3 · 3/3 · 3/3` |
| `building-blocks-quiz-003` | `3/3 · 3/3 · 3/3` |
| `building-blocks-quiz-004` | `3/3 · 3/3 · 3/3` |
| `building-blocks-goal-001` | `3/3 · 3/3 · 3/3` |
| `building-blocks-goal-002` | **`3/3 · 0/3 · 1/3`** |
| **total** | **`17/18 · 12/18 · 13/18`** |

Two tasks separate the arms, and on both the new text wins and the old text is at or below `none`:

- **`quiz-001`:** new 3/3, old 0/3, none 0/3. Every `none` and `old` run picks the venue from memory. Each makes only 2 Bash calls, no web or chain reads, and cites no dated figure, so all six fail expect_1. The three `old` runs also fail expect_2: they call the venue "Aero (formerly Aerodrome)" and say the Aerodrome/Velodrome merger happened in Nov 2025, which is the old skill's L16/L169 repeated. All three `new` runs read Base live (9–14 Bash calls: DefiLlama, `cast` on pools and gauges) and cite dated figures.
- **`goal-002`:** new 3/3, old 0/3, none 1/3. `none` fails expect_2 twice ("the largest DEX on Base by TVL and volume", undated). `old` fails expect_4 twice (merger stated as shipped: "Aerodrome (now "Aero")"; the second is borderline, "Aerodrome (Aero)" plus an "Aero … Vault" title) and expect_2 once (a pool TVL "at deploy time" but no dated venue evidence). Every `new` run carries an "evidence from 2026-09-21" section of onchain reads.

The one `new` failure is not a knowledge failure (see the next section). Without it the new arm is 18/18.

## The `quiz-002` new-2 failure: a mistyped path

`quiz-002/2026-09-21T130911Z-claude-with-skill-d9952522-2` failed all three expect lines on no evidence. The executor wrote `design.md` with the Write tool to `~/.cache/ethskills-evals/<run-id>-building-blocks-quiz-002/design.md`. The workspace is `<run-id>/building-blocks-quiz-002/`: it put a hyphen where the slash is. The file landed outside the workspace, `verify` snapshotted an empty workspace (no `output/`), and the judge graded nothing.

The run's closing message describes a correct design: harvest via `Gauge.getReward()`, AERO only, swap fees routed to veAERO voters, and dated onchain reads. That is not a grade. The run is kept as a fail, not retracted: the harness worked, and the executor put its deliverable in the wrong place. The stray dir was deleted after grading. Filed as `building-blocks-deliverable-written-outside-workspace`.

## Trigger

Counted from `"name":"Skill"` calls in each `transcript.jsonl`. Both skill arms loaded the skill on **18/18** runs, on every task. The difference between old and new is what the text does once it is loaded, not whether it loads.

## How runs got their facts

Tool calls per run, in run order 1, 2, 3 (`Bash` / `WebSearch`+`WebFetch`):

| Task | none | old | new |
| --- | --- | --- | --- |
| `quiz-001` | 2,2,2 / 0 | 2,2,2 / 0 | 11,9,14 / 0 |
| `quiz-002` | 2,2,2 / 0 | 2,2,2 / 0 | 8,15,10 / 4,0,0 |
| `quiz-003` | 0,2,2 / 0 | 4,2,2 / 0 | 8,8,7 / 0 |
| `quiz-004` | 2,2,0 / 0 | 2,2,2 / 0 | 6,6,11 / 6,6,8 |

On the quizzes, `none` and `old` answer from memory; their Bash calls are orientation (`ls -la`, `cat TASK.md`) or local `python3` arithmetic, with no network access. `new` verifies live on every quiz, which is what its text says to do ("verify the target chain and pair from live sources. Cite dated evidence"). On `quiz-001` and `goal-002` that is the whole delta. On `quiz-003` and `quiz-004` it buys nothing the rubric sees, and it costs (see Cost).

`goal-001` (the task notes ask for this):

- **Where V4 came from:** prior knowledge in all nine runs. Every arm, `none` included, built a Uniswap V4 hook unprompted. No run used WebSearch or WebFetch. Hook wiring was done from the `v4-core` / `v4-periphery` sources installed with `forge install`.
- **Build and test:** the last `forge test` in every transcript is `Suite result: ok` with 0 failed (1–15 tests). The judge cannot see this; it is read from `transcript.jsonl`.
- **expect_5 (hook-address flag bits):** passed in all nine, including `none`. The line meant to test whether the skill pushes the model past its own content does not separate the arms on this stack.

`goal-002`: the last `forge test` in every one of the nine transcripts is `Suite result: ok`, 0 failed (1–28 tests). Some runs' final suite is a fork suite, not the whole set. All nine LP on Aerodrome USDC/WETH and stake in its gauge. Where Uniswap appears, it is a swap route, not the LP venue. expect_3 (reward model) passed 9/9: no run treated swap fees as LP income.

## Cost

From `yarn run-stats --tasks <the six> --benchmark major-refine-d9952522`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01`, `--skill-version d9952522`. Medians with ranges; `cost_source: executor`.

| Task | Arm | n | turns | duration | cost | cost range | tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `quiz-001` | new | 3 | 16 | 284s | $0.77 | $0.65–$0.99 | 365513 |
| | old | 3 | 6 | 76s | $0.40 | $0.38–$0.41 | 97380 |
| | none | 3 | 4 | 79s | $0.35 | $0.30–$0.35 | 85194 |
| `quiz-002` | new | 3 | 18 | 411s | $0.77 | $0.71–$0.81 | 347929 |
| | old | 3 | 6 | 67s | $0.37 | $0.36–$0.38 | 95741 |
| | none | 3 | 4 | 60s | $0.29 | $0.29–$0.34 | 80833 |
| `quiz-003` | new | 3 | 12 | 156s | $0.64 | $0.63–$0.66 | 232606 |
| | old | 3 | 6 | 70s | $0.39 | $0.39–$0.44 | 99586 |
| | none | 3 | 4 | 61s | $0.30 | $0.28–$0.41 | 83362 |
| `quiz-004` | new | 3 | 17 | 168s | $0.86 | $0.72–$1.03 | 344387 |
| | old | 3 | 6 | 65s | $0.35 | $0.34–$0.36 | 94536 |
| | none | 3 | 4 | 57s | $0.27 | $0.25–$0.31 | 79420 |
| `goal-001` | new | 3 | 27 | 811s | $1.49 | $1.19–$1.89 | 946035 |
| | old | 3 | 21 | 682s | $1.30 | $1.06–$1.84 | 714700 |
| | none | 3 | 21 | 434s | $1.33 | $1.17–$1.52 | 761363 |
| `goal-002` | new | 3 | 30 | 1141s | $2.97 | $2.13–$3.42 | 1534250 |
| | old | 3 | 34 | 748s | $3.43 | $2.45–$3.73 | 2211055 |
| | none | 3 | 21 | 812s | $2.73 | $2.31–$3.32 | 1191845 |

- **Quizzes:** new costs about 2–3× the other arms on all four ($0.64–$0.86 against $0.27–$0.40, 3.5–4× the tokens, 2.5–6× the wall time). That is the live checking. On `quiz-001` it is the price of the only passing arm. On `quiz-003` and `quiz-004`, where every arm passes, it is a pure negative delta.
- **`goal-001`:** new is the dearest on median ($1.49 vs $1.30 / $1.33) but the ranges overlap; n=3.
- **`goal-002`:** new ($2.97 / 1.53M) is cheaper than old ($3.43 / 2.21M) and a little dearer than none ($2.73 / 1.19M), with overlapping ranges. It is the only arm that passes.

Durations overlap with other benchmarks' runs on the same machine (addresses, audit, frontend rows ran at the same time), so wall time is noisier than cost.

## Records

- `building-blocks-aero-merger-tense`: old 8/9 (quiz-001 3/3, quiz-002 3/3 ungraded, goal-002 2/3), none 0/9, new 0/9. On this stack the stale fact comes from the old text alone. Left `open`: the 2026-08-08 no_skill 2/6 says a model can hold it unaided, and the new text stops asserting it without correcting it.
- `building-blocks-base-dominance-asserted`: quiz-001 expect_1, none 3/3, old 3/3, new 0/3. Left `open` for the other stacks.
- `building-blocks-live-pair-evidence-omitted` (`fixed`): goal-002 expect_2, none 2/3, old 1/3, new 0/3. The fix holds.
- `building-blocks-gauge-fee-double-count`: 0 in every arm. Did not reproduce.
- **New:** `building-blocks-deliverable-written-outside-workspace`, new 1/3 on quiz-002 (see above).
- Every `frequency` in these records is now keyed per stack. Earlier measurements sit under `claude/unrecorded-model`, because those runs predate `executor_model`.

All 53 `output/` snapshots are force-added (8–96K each, 1.4M total, no `lib/`), so every graded run stays regradeable. The 54th run has none (see the quiz-002 section).

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | New vs none: yes, `17/18` vs `13/18`. The gain is all on `quiz-001` (`3/3` vs `0/3`) and `goal-002` (`3/3` vs `1/3`). New vs old: yes, `17/18` vs `12/18`. Old is *below* none (`12/18` vs `13/18`): it costs the `goal-002` merger check that none passes. |
| Did it reduce time/tokens? | No. Quizzes: new $0.64–$0.86 / 233–366k vs old $0.35–$0.40 / 95–100k and none $0.27–$0.35 / 79–85k. `goal-002`: new $2.97 / 1.53M is below old $3.43 / 2.21M, above none $2.73 / 1.19M. `goal-001`: new $1.49 / 946k vs old $1.30 / 715k, none $1.33 / 761k (ranges overlap). |
| Did it create negative deltas? | New: 2–3× cost on the saturated `quiz-003` and `quiz-004` for no grade change. One `quiz-002` fail from a path slip, not from the text. Old: the stale merger claim, 8/9 where it is in scope, and 2 goal-002 fails that none does not have. |
| What mistakes repeated without the skill? | `building-blocks-base-dominance-asserted` 3/3, `building-blocks-live-pair-evidence-omitted` 2/3. |
| What mistakes remained with the skill? | New: none of the knowledge mistakes. `building-blocks-deliverable-written-outside-workspace` 1/3, an execution slip. Old: `aero-merger-tense` 8/9, `base-dominance-asserted` 3/3, `live-pair-evidence-omitted` 1/3. |
| What should change in the skill? | Nothing the pass counts ask for. The cost of verifying on every question is the one lever. A line scoping live checks to "selecting a venue or quoting a figure", not to fixed protocol parameters (Aave's fee, Pendle mechanics), might cut the quiz-003/004 cost. That is a hypothesis this benchmark did not test. |
| What should change in the eval? | `quiz-003`, `quiz-004` and `goal-001` are saturated on this stack (27/27) and only measure cost. `goal-001` expect_5 was meant to separate arms and does not. Harness: `verify` could warn when a bare task's snapshot is empty, which would have flagged the quiz-002 slip before grading. Wait for the GPT 5.5 / open-model rows before retiring anything. |
