# major-refine: `building-blocks` on GPT 5.5 high

| | |
| --- | --- |
| Benchmark | `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)) |
| Benchmark commit | `d99525222883df0b32decbfb81e1a13f9c27cfed` |
| Executor | `codex`, model `gpt-5.5`, reasoning effort `high` |
| Judge | `claude`, model `claude-opus-5`, reasoning effort `high` — the same judge for all 54 grades |
| `self_judged` | `false` on all 54 runs (executor codex, judge claude) |
| Arms | none (`no_skill`) · old (`--skill-ref 2f0adb01`) · new (`--skill-ref d9952522`) |
| Runs | 3 per arm per task, 9 per task, **54 in all**, every one `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 `retracted`, 0 dead runs, 0 regrades, 0 codex usage-limit hits |
| Trigger | not forced. Both skill arms read `SKILL.md` on **36/36** runs (an `exec` over the installed skill file in every old and new transcript) |
| Date | 2026-09-22, run ids `T120031Z` through `T123703Z` |

Every run carries `expect_sha`, and each task's nine runs share one value, so every count below is a first-reading grade against one rubric.

**Tasks** — all six live tasks whose `skill:` is `skills/building-blocks`; bare workspaces, no template.

- `building-blocks-quiz-001` (Base vault: which pool and why, harvest flow, earnings)
- `building-blocks-quiz-002` (Aerodrome USDC/WETH vault: harvest flow, earnings, where swap fees go)
- `building-blocks-quiz-003` (Aave V3 flash-loan fee, repayment, break-even arithmetic)
- `building-blocks-quiz-004` (Arbitrum two-tranche vault: Pendle and GMX)
- `building-blocks-goal-001` (per-swap dynamic fee on Uniswap, version unnamed; Foundry)
- `building-blocks-goal-002` (Base USDC/WETH yield vault in Foundry, DEX unnamed)

## Headline — pass counts, new · old · none

| Task | new (`d9952522`) | old (`2f0adb01`) | none |
| --- | --- | --- | --- |
| `quiz-001` | 3/3 | 2/3 | 2/3 |
| `quiz-002` | 3/3 | 3/3 | 3/3 |
| `quiz-003` | 3/3 | 3/3 | 3/3 |
| `quiz-004` | 3/3 | 3/3 | 3/3 |
| `goal-001` | 3/3 | 3/3 | 3/3 |
| `goal-002` | **2/3** | **0/3** | **0/3** |
| **total** | **17/18** | **14/18** | **14/18** |

Four tasks are saturated at 9/9. The whole delta is `goal-002` (new 2/3 against 0/3 in both other arms) plus one run each on `quiz-001`. Old and none tie, and on this stack the old text's stale material costs nothing the rubric sees (next section): the old arm's `goal-002` misses are the same misses the unaided model makes.

Per-line failures, from `result.yaml`:

| Task | Arm | Line | Runs |
| --- | --- | --- | --- |
| `quiz-001` | none | expect_1 | none-3 |
| `quiz-001` | old | expect_1 | old-3 |
| `goal-002` | none | expect_2 | 3/3; expect_1 also on none-3 |
| `goal-002` | old | expect_2 | 3/3; expect_1 also on old-1, old-2; expect_4 on old-3 (judge false-fail, below) |
| `goal-002` | new | expect_2 | new-2 |

## `goal-002`: the one task that separates the arms

All nine runs ship a complete Foundry project. The last `forge test` in every transcript is green (4–5 tests, 0 failures), `forge build` passes at the end of every run, and expect_5 (a real test suite) and expect_3 (the reward model) are 9/9. The runs differ on which pool they target and whether they can say why.

| Arm | Venue | expect_1 (concrete pool) | expect_2 (dated figure) |
| --- | --- | --- | --- |
| none | Uniswap v3 ×2, Aerodrome ×1 | 2/3 | 0/3 |
| old | Aerodrome ×3 | 1/3 | 0/3 |
| new | Aerodrome ×2, Uniswap v3 ×1 | 3/3 | 2/3 |

- **none** picks Uniswap v3 twice, justified by "official v3 deployments" and "strong USDC/WETH liquidity" with no number and no date, and Aerodrome once (none-3) with every address left as an `0x...` env placeholder and the README telling the deployer to "confirm the pair, gauge, and route values from Aerodrome's current Base deployment sources". That third run also calls Aerodrome "the primary ve(3,3) liquidity and gauge system on Base" unprompted.
- **old** picks Aerodrome 3/3 on the old text's claim ("the native liquidity hub on Base", "native liquidity venue on Base"), copies the router and factory addresses, and stops there: old-1 and old-2 keep the pool and gauge as constructor arguments to be verified "before mainnet deployment", so they fail expect_1 as well as expect_2. old-3 lists the addresses but writes no figure.
- **new** resolves the pool. new-1 and new-3 read `PoolFactory.getPool(USDC, WETH, false)`, `Voter.gauges(pool)` and `Voter.isAlive(gauge)` against `mainnet.base.org`, write the returned addresses into the README with the date (new-1 with block `51645276` and a "$7.39M TVL, $826k volume" line from the liquidity page; new-3 with the reads dated and no depth figure, which expect_2's "live incentives/gauge status" clause admits). new-2 picked Uniswap v3, ran a live `getPool` check across the three fee tiers on 2026-09-22 and reported which one held the most active liquidity, then wrote no figure at all, and failed expect_2 on the dated-figure floor. It passed expect_1: the fee tier is a resolved decision.

**A judge false-fail on old-3.** `2026-09-22T122936Z-codex-with-skill-2f0adb01-3` carries `expect_4: fail`. expect_4 grades merger tense and says omission passes. A case-sensitive search of that run's whole snapshot (contracts, tests, README) for "merger", "merged", "Velodrome", "rebrand", "Dromos" or "Aero" as a brand finds nothing; the only "Aero" strings are the AERO token. The run fails expect_2 as well, so the verdict and the tally are unchanged. Judge reasoning is not stored, so what it read the line into cannot be recovered. Left as graded, noted here and in the merger record.

## `quiz-001`: every arm goes live on this stack

On Opus 5 medium (PR #150) this was the headline task: none and old made two Bash calls each, no network, no figure, and went 0/3; new alone read Base live. On GPT 5.5 high every one of the nine runs reads Base before naming a venue — `cast` against a Base RPC in 9/9, the Aerodrome liquidity page in 6/9, GeckoTerminal, DexScreener or DefiLlama in 4/9 — and every run picks Aerodrome. The two fails are on the evidence floor, not the venue:

- **none-3** quotes the WETH/USDC CL100 pool at "$8.33M TVL, $23.24M recent volume ... when checked for this design" and lists the pages it read, but never dates the snapshot. expect_1 asks for a *dated* figure.
- **old-3** opens with "Aerodrome is the primary liquidity venue on Base" and picks USDC/AERO on that, then reads the gauge and pool reserves on chain ("As of September 22, 2026", TVL from reserves about $36.37M). The judge failed it; the reading consistent with the line is that the venue was chosen by the assertion the line forbids and the figures describe the pool afterwards. This is the old text's L169 dominance claim doing on this stack what it did on Opus, once instead of three times.

Merger tense (expect_2): 9/9 pass, and no run in any arm mentions the merger at all. The old text states it as shipped; zero of nine old-arm readers repeated it.

## Trigger and how runs got their facts

Tool calls per run in run order 1, 2, 3 (`exec` / `web_search`), from `transcript.jsonl`:

| Task | none | old | new |
| --- | --- | --- | --- |
| `quiz-001` | 18,43,27 / 7,11,13 | 26,15,29 / 6,6,7 | 34,43,37 / 6,12,7 |
| `quiz-002` | 24,7,16 / 10,11,6 | 31,23,20 / 7,4,4 | 13,51,39 / 11,15,12 |
| `quiz-003` | 8,7,10 / 5,5,4 | 10,10,9 / 3,4,5 | 21,11,9 / 5,5,6 |
| `quiz-004` | 4,7,3 / 2,4,2 | 6,7,6 / 1,0,4 | 12,12,17 / 6,5,4 |
| `goal-001` | 43,39,41 / 1,0,1 | 27,48,34 / 2,0,0 | 45,52,29 / 2,4,8 |
| `goal-002` | 22,14,14 / 3,2,0 | 24,19,18 / 3,0,3 | 35,26,41 / 8,7,7 |

This model searches the web on nearly every quiz run without a skill (35 of 36 quiz runs made at least one `web_search`; old-2 on `quiz-004` is the one that did not). What the new text adds on top is on-chain and API reads: `cast` on `quiz-003` (new-1 only), the Pendle and GMX APIs on `quiz-004` (new 3/3, 0/6 elsewhere), and more of both on `quiz-002` and the goals. Where the rubric only asks for a fact the docs state, that is cost with no grade behind it.

Per task, as the task notes ask:

- **`goal-001` — where V4 came from:** prior knowledge in all nine runs. The first assistant message of every transcript names Uniswap V4 and a `beforeSwap` hook before any search; the searches that follow (7/9 runs, 1–8 each) are for details — the dynamic-fees and hooks pages on `developers.uniswap.org`, `OVERRIDE_FEE_FLAG` and `updateDynamicLPFee`, the deployments table, `LPFeeLibrary` and `Hooks` sources on GitHub. Dependencies: `forge install Uniswap/v4-core` (with periphery) in 6/9, `npm install @uniswap/v4-core @uniswap/v4-periphery` in 2/9 (none-3, new-2), and one run (new-3) hand-wrote the V4 types it needed. **Build:** the last `forge build` in every transcript succeeds; 4/9 also ran `forge test` (2–6 tests, 0 failures). expect_5 (the hook-address flag bits) passed 9/9, none included, as on Opus.
- **`quiz-001` — venue source:** live in 9/9, see above.
- **`quiz-002` — fee model source:** live in 9/9: every run searched Aerodrome's docs or contracts README, and 8/9 read the gauge or pool on chain with `cast` (none-2 was web-only). No run asserted the Uniswap model; all nine route swap fees to veAERO voters and harvest AERO from the gauge.
- **`quiz-003` — fee and gas source:** every run web-searched the Aave V3 docs for the premium and every run wrote 0.05%; none-3's query, "FLASHLOAN_PREMIUM_TOTAL 2026 0.09% 0.05%", is the stale prior being resolved live rather than asserted. Gas and ETH price came from web gas trackers and price widgets in 8/9; the only RPC hit is new-1 (`eth.llamarpc.com`, `ethereum.publicnode.com` via `cast`).
- **`quiz-004` — protocol picks:** Pendle and GMX in 9/9. 8/9 read `docs.pendle.finance` and `docs.gmx.io`; old-2 made no search and answered from prior knowledge. The new arm additionally queried `api-v2.pendle.finance` and `arbitrum-api.gmxinfra.io` 3/3, which is where its 2.6× cost on this task goes.

## Cost

From `yarn run-stats --tasks <the six> --benchmark major-refine-d9952522`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01`, `--skill-version d9952522`. Medians with ranges, `n=3`. Codex dollars are `cost_source: list_price` — the run's token split priced at OpenAI's standard-tier list price in `lib/prices.ts` (dated 2026-09-15 there), not what was billed, and the >272K long-context surcharge is not included. `turns` is null on codex.

| Task | Arm | Duration | Cost (list price) | Range | Tokens |
| --- | --- | --- | --- | --- | --- |
| `quiz-001` | new | 306s | $1.59 | $1.09–$1.79 | 1,293,748 |
| | old | 206s | $0.91 | $0.84–$1.10 | 540,161 |
| | none | 276s | $1.37 | $0.91–$1.80 | 756,604 |
| `quiz-002` | new | 309s | $1.50 | $1.08–$1.82 | 749,991 |
| | old | 226s | $0.83 | $0.82–$1.23 | 471,611 |
| | none | 200s | $1.00 | $0.99–$1.33 | 564,733 |
| `quiz-003` | new | 167s | $0.69 | $0.55–$0.78 | 291,747 |
| | old | 162s | $0.56 | $0.52–$0.63 | 281,401 |
| | none | 205s | $0.46 | $0.44–$0.54 | 182,443 |
| `quiz-004` | new | 189s | $0.89 | $0.69–$0.90 | 410,492 |
| | old | 92s | $0.34 | $0.22–$0.44 | 102,882 |
| | none | 105s | $0.33 | $0.31–$0.44 | 122,812 |
| `goal-001` | new | 400s | $1.81 | $1.53–$2.04 | 1,483,636 |
| | old | 590s | $1.41 | $1.17–$1.70 | 1,006,104 |
| | none | 643s | $1.34 | $1.23–$1.51 | 1,163,538 |
| `goal-002` | new | 563s | $1.89 | $1.74–$2.00 | 1,289,823 |
| | old | 480s | $1.23 | $1.00–$1.54 | 577,737 |
| | none | 392s | $1.14 | $0.90–$1.29 | 624,098 |

- **new is the dearest arm on every task**, 1.2–2.7× none by median cost (quiz-004 $0.89 vs $0.33; quiz-002 $1.50 vs $1.00; goal-002 $1.89 vs $1.14). On `goal-002` that buys the only passes. On `quiz-002`, `quiz-003`, `quiz-004` and `goal-001` every arm passes and the extra reads change no grade.
- **old is the cheapest arm on four of six tasks**, and cheaper than none on the two Base quizzes (quiz-001 $0.91 vs $1.37, 540k vs 757k tokens; quiz-002 $0.83 vs $1.00). The old text hands the model the venue and its addresses, so the unaided searching stops sooner. It is the same mechanism the tools row saw, and here it produces the same 14/18 as no skill.
- Ranges overlap between old and none everywhere; new's range clears both on `quiz-004` and `goal-002` only. The whole benchmark comes to $58.21 at list price.
- `goal-001` is the one task where new is faster (400s vs 590s / 643s) while costing more: more searches, fewer build-fix loops.

Durations are noisy: up to 13 codex executors ran on this machine at once (this row's drivers beside the standards and addresses rows in sibling worktrees). Costs are not affected.

## Records

`frequency` in every record below now carries a `codex/gpt-5.5` block beside the earlier measurements. PR #150 (the Opus row, open) restructures the same five files with a `claude/claude-opus-5` block; the two branches touch the same `frequency:` lines and will need both blocks kept when the second one merges.

- `building-blocks-aero-merger-tense`: **0/27** across all three arms — no deliverable on this stack mentions the merger, including the nine that read the old text stating it as shipped. Left `open` on the claude evidence (8/9 old on Opus). The goal-002 old-3 expect_4 false-fail is noted in it.
- `building-blocks-base-dominance-asserted`: quiz-001 expect_1, none 0/3, old **1/3**, new 0/3. The same assertion appears outside the line's scope in goal-002 prose: old 3/3, none 1/3, new 0/3.
- `building-blocks-live-pair-evidence-omitted`: goal-002 expect_2, none **3/3**, old **3/3**, new **1/3**. **Reopened**: it was `fixed` on the claude 3/3-vs-1/3 reading, and the fixed text misses it once here (new-2, a live check with no figure written).
- `building-blocks-gauge-fee-double-count`: 0/9. Did not reproduce; every gauge-staked design harvests AERO only.
- `building-blocks-gauge-mechanics-read-as-evidence`: 0/9 as a false pass. new-3's expect_2 pass rests on dated `isAlive`/`getPool` reads with no depth figure, which the line's own "live incentives/gauge status" clause allows; flagged under eval changes rather than counted.
- **New:** `building-blocks-pool-left-as-deploy-parameter`, goal-002 expect_1: none 1/3, old **2/3**, new 0/3. The venue is named but the pool, gauge and reward token stay constructor arguments or `0x...` placeholders with a "verify before mainnet" note. Not seen on Opus (expect_1 was 9/9 there).

## Harness notes

None of these produced a grade; they are here so the runs can be read honestly.

1. **Shell.** codex ran every command through `/bin/zsh -lc` (the operator's `$SHELL`), not `bash -lc` as AGENTS.md describes; the exposure is the same kind, the file is `.zprofile`/`.zshrc` rather than `.bash_profile`.
2. **`.npm-cache/` in a snapshot.** goal-001 none-3 pointed npm's cache into the workspace; `.npm-cache` is not in `GENERATED_DIRS`, so 10 files (52K) of cache index rode into `output/` and the judge's evidence. Small enough to grade here; the tools row (#119, GPT column) had the same gap kill two judges at 20M. Still worth adding to `GENERATED_DIRS`.
3. **Concurrency.** Ten drivers for this row ran alongside two other rows' executors on one machine (13 codex processes at peak). No usage-limit hit, no dead run; durations above carry that load.
4. **Judge false-fail** on goal-002 old-3 expect_4, described above. Judge output is not stored, so it cannot be re-read; only a regrade could, and a regrade would not change the pass.

All 54 `output/` snapshots are force-added (1.3M total, 8–96K each, no `lib/`), so every graded run stays regradeable.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **New vs none: 17/18 vs 14/18.** All of it on `goal-002` (2/3 vs 0/3) and one `quiz-001` run (3/3 vs 2/3). **New vs old: 17/18 vs 14/18**, the same two tasks. **Old vs none: 14/18 vs 14/18** — on this stack the old text neither helps nor hurts the rubric; it swaps the unaided model's "no figure" miss for its own "no figure, and no pool either". |
| Did it reduce time/tokens? | No. New is the dearest arm on all six tasks: quizzes $0.69–$1.59 / 292k–1.29M vs old $0.34–$0.91 / 103k–540k and none $0.33–$1.37 / 123k–757k; `goal-001` $1.81 / 1.48M vs $1.41 / 1.01M and $1.34 / 1.16M (but 400s vs 590s / 643s); `goal-002` $1.89 / 1.29M vs $1.23 / 578k and $1.14 / 624k. Old is cheaper than none on the two Base quizzes (quiz-001 $0.91 vs $1.37). |
| Did it create negative deltas? | New: 1.4–2.7× cost on `quiz-002`, `quiz-003`, `quiz-004` and `goal-001`, all saturated, for no grade change — on this model the unaided run already reads the docs live, so "verify live" buys API and chain reads the rubric never asks for. One `goal-002` fail (new-2) where the text's "cite dated evidence" was read as "date the check" and no figure was written. Old: `pool-left-as-deploy-parameter` 2/3 and `live-pair-evidence-omitted` 3/3 on `goal-002`, one dominance-asserted fail on `quiz-001`. |
| What mistakes repeated without the skill? | `building-blocks-live-pair-evidence-omitted` 3/3, `building-blocks-pool-left-as-deploy-parameter` 1/3, and one undated figure on `quiz-001` (none-3, not a record: the figure is there, the date is not). |
| What mistakes remained with the skill? | New: `building-blocks-live-pair-evidence-omitted` 1/3. Old: `live-pair-evidence-omitted` 3/3, `pool-left-as-deploy-parameter` 2/3, `base-dominance-asserted` 1/3 (plus 3/3 in `goal-002` prose). `aero-merger-tense` 0/9 in the old arm, unlike Opus. |
| What should change in the skill? | Two edits the records support. (1) Say *figure*: "Cite dated evidence" let new-2 date a `getPool` call and write no number; "quote the figure you read (TVL, volume, emissions rate) with its date or block" is what new-1 did and what expect_2 grades. (2) Scope the live check to the decision: on this stack the text sends the run to Pendle's and GMX's APIs on a question the docs answer, and to `cast` on an Aave fee that is a constant. "Verify live when choosing a venue or quoting a current figure" would keep `goal-002`'s 2/3 and drop the 2.6× on `quiz-004`. Both are hypotheses this benchmark did not test. |
| What should change in the eval? | (a) `quiz-002`, `quiz-003`, `quiz-004` and `goal-001` are 9/9 on this stack and 27/27 on Opus (bar one path slip); they measure cost only, and they are $34 of this row's $58. (b) `goal-002` expect_4's "If the implementation or README mentions …" framing produced a fail on a deliverable that mentions nothing; state the pass-on-omission first. (c) `goal-002` expect_2's "live incentives/gauge status" clause lets a dated `isAlive` read stand in for a depth figure (new-3), the same soft clause `gauge-mechanics-read-as-evidence` flagged; ask for the figure and allow gauge status as a second item. (d) `quiz-001` expect_1's ground truth is a 2026-07-28 venue-level snapshot; every run here quotes pool-level figures and none compares venues, so the line is grading the evidence floor, not the split it describes — refresh the snapshot or drop it from the line. (e) Harness: `.npm-cache` into `GENERATED_DIRS`. |

## Runs

All 54 run directories are under `artifacts/building-blocks-{quiz-001,quiz-002,quiz-003,quiz-004,goal-001,goal-002}/`, dated `2026-09-22T120031Z` through `2026-09-22T123703Z`, each with `result.yaml`, `executor.yaml`, `transcript.md`, `baseline.sha` and a committed `output/`.
