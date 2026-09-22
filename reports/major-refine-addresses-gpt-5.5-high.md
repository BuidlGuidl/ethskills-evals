# major-refine: `addresses` on GPT 5.5 high

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `codex` · `gpt-5.5` · effort `high` |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | false on all 54 runs |
| Runs | 3 per arm per task, 6 tasks × 3 arms = **54 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 `retracted`, 0 dead runs, 0 blindness flags |
| Trigger | not forced; all 36 with-skill runs read `.agents/skills/addresses/SKILL.md` |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `addresses` skill, 547 lines |
| new | `with_skill` | `d9952522` | refined minimal skill, 39 lines |

Both `skill_version` commits are ancestors of HEAD.

**Tasks** — all six live tasks whose `skill:` is `skills/addresses`; bare workspaces, no template: `addresses-quiz-001` … `addresses-quiz-005`, `addresses-goal-001`.

## Headline — pass counts, new · old · none

| Task | new · old · none | What separates the arms |
| --- | --- | --- |
| `addresses-quiz-001` | `3/3 · 0/3 · 2/3` | old asserts "dominant DEX on Base" with no Base figure |
| `addresses-quiz-002` | `3/3 · 3/3 · 3/3` | saturated |
| `addresses-quiz-003` | `3/3 · 3/3 · 2/3` | one none run gives no loss-of-funds warning |
| `addresses-quiz-004` | `3/3 · 1/3 · 3/3` | old restates its own V1/V2 note and names no authority |
| `addresses-quiz-005` | `3/3 · 3/3 · 3/3` | saturated |
| `addresses-goal-001` | `2/3 · 0/3 · 0/3` | venue by reputation; no verify-before-funds step |
| **total** | **`17/18 · 10/18 · 13/18`** | |

**Same shape as Opus, larger gaps.** New leads on both stacks. The old text is worse than no skill here: it loses 3 points to none, on quiz-001 and quiz-004, and gains none. Opus scored `18/18 · 14/18 · 14/18`. GPT does better without a skill on the quizzes (it measures unprompted) and worse on goal-001 (0/3 without a skill vs 1/3 on Opus).

### `addresses-quiz-001` — venue and router for a large Base USDC→WETH swap

- **old, 0/3, all `expect_1`.** old-1 and old-3 say Aerodrome is "the Base-native liquidity hub and the dominant DEX on Base" and hand over the v2-style Router `0xcF77…`, with no quote, reserve or volume figure. That is old L353 without its ~$500-600M number. old-3 also fails `expect_3`; old-1, with nearly the same answer, passes it. Treat that `expect_3` split as judge noise. old-2 picks 1inch and describes the fragmentation ("the deepest single pool I found today is on Uniswap V3") but gives no number.
- **new, 3/3.** All three quote Slipstream against Uniswap v3 at 500k (≈182.0–182.2 vs ≈181.7 WETH) or pull DefiLlama volume, then give the Slipstream SwapRouter `0xBE6D…`. 17–30 shell calls.
- **none, 2/3.** no-skill-1 quotes four pools at 100k–1M, the best-measured answer in the set. no-skill-2 fails `expect_2`: from one pool page it puts Uniswap v3 0.3% at "about $145M" against Slipstream pools "around $8M each", which contradicts the pinned ~$157M Slipstream TVL.

### `addresses-quiz-004` — the old skill's answer crowds out the source

old-1 and old-2 find the deprecated V1 VELO token and give the V2 address. They never name the Velodrome contract list or an explorer as what decides which one is current, so they fail `expect_3`. Old L379–L388 has the V2 row and the "V1 is deprecated, use V2" note, and both answers read as that note restated. old-3 links `velodrome-finance/contracts` and passes. The none and new runs all named a source. Filed as `addresses-current-deployment-no-authority`, a cousin of `addresses-verified-stamp-substitutes-for-check`. Opus did not show it (old 3/3).

### `addresses-goal-001` — the venue, when nobody asks for one

| Line | none | old | new |
| --- | --- | --- | --- |
| `expect_4` unsourced extra address | 1/3 | 0/3 | 0/3 |
| `expect_5` venue not justified against Base liquidity | 3/3 | 2/3 | 1/3 |
| `expect_6` no verify-before-funds step for the operator | 3/3 | 1/3 | 0/3 |

- **`expect_5`, the GPT-specific failure.** All three no-skill runs build on Uniswap v3 "because the Base deployment is canonical and documented" and add that Aerodrome or an aggregator "may beat it for very large clips". The same model quoted venues unprompted on quiz-001; when the venue is a step inside a build, good documentation stands in for depth. old-3 does the same; old-2 picks Aerodrome as "the native liquidity hub" and routes correctly through Slipstream. **new-3's fail is questionable:** it quoted every Slipstream tickSpacing at 500k but compared only pools inside Aerodrome, and failed. new-2 passed on "Aerodrome's own docs describe it as the central liquidity hub", which is weaker reasoning. Read strictly, new is 1/3 either way; the pair only shows the judge is not consistent on this line. Filed as `addresses-venue-by-reputation`. Opus passed `expect_5` on all 9 runs.
- **`expect_6`.** Every no-skill NOTES.md has a "Before using real funds" section covering RPC, slippage, gas, approvals and keys, but not the addresses. old-1 (1inch) says it checked bytecode itself and gives the operator no step. All three new runs name the deployment page and BaseScan.
- **`expect_7` (Slipstream vs v2 router):** 0 fails in every arm. Every Aerodrome run called the Slipstream router.

## Cost

From `yarn run-stats --tasks addresses-goal-001,addresses-quiz-001,addresses-quiz-002,addresses-quiz-003,addresses-quiz-004,addresses-quiz-005 --benchmark major-refine-d9952522`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01`, `--skill-version d9952522`. Medians with ranges. `cost_source: list_price`: codex tokens priced at OpenAI's standard-tier list price in `lib/prices.ts`, not what was billed. Codex reports no turn count.

| Task | Arm | n | duration | cost (list price) | cost range | tokens |
| --- | --- | --- | --- | --- | --- | --- |
| `addresses-quiz-001` | new | 3 | 244s | $0.79 | $0.74–$1.28 | 452765 |
| | old | 3 | 107s | $0.44 | $0.44–$1.36 | 241386 |
| | none | 3 | 151s | $0.80 | $0.72–$1.03 | 411258 |
| `addresses-quiz-002` | new | 3 | 70s | $0.36 | $0.33–$0.38 | 180120 |
| | old | 3 | 100s | $0.37 | $0.36–$0.42 | 210320 |
| | none | 3 | 70s | $0.38 | $0.30–$0.42 | 148856 |
| `addresses-quiz-003` | new | 3 | 147s | $0.65 | $0.56–$0.86 | 325578 |
| | old | 3 | 157s | $0.66 | $0.62–$0.90 | 370676 |
| | none | 3 | 127s | $0.64 | $0.49–$0.69 | 231943 |
| `addresses-quiz-004` | new | 3 | 126s | $0.52 | $0.49–$0.53 | 255274 |
| | old | 3 | 81s | $0.34 | $0.23–$0.45 | 154022 |
| | none | 3 | 96s | $0.51 | $0.39–$0.56 | 242594 |
| `addresses-quiz-005` | new | 3 | 193s | $0.87 | $0.84–$0.92 | 559659 |
| | old | 3 | 120s | $0.66 | $0.58–$0.73 | 292486 |
| | none | 3 | 163s | $0.61 | $0.49–$1.24 | 187217 |
| `addresses-goal-001` | new | 3 | 514s | $2.45 | $1.82–$2.48 | 2129074 |
| | old | 3 | 404s | $1.73 | $1.29–$2.22 | 1467041 |
| | none | 3 | 410s | $1.30 | $1.19–$1.35 | 741628 |

Summed over all 18 runs of each arm (from `result.yaml` `usage.cost_usd`): new $16.87, old $13.82, none $13.11. As on Opus, the refine does not make addresses cheaper: new checks on-chain and pays for it. On quiz-001 new costs the same as none ($0.79 vs $0.80) and beats it 3/3 vs 2/3. The cheap old runs are the ones that answered from the table (old-1 on quiz-001: 107s, $0.44, 0/3 on evidence). goal-001 new costs about twice none on tokens (2.13M vs 0.74M) and is the only arm that passes it.

## Records

- **New:** `addresses-venue-by-reputation` (open; codex none 3/3 · old 2/3 · new 1/3; claude 0/3 in every arm). `addresses-current-deployment-no-authority` (fixed; codex old 2/3, others 0/3). `addresses-slipstream-depth-understated` (open; codex none 1/3). `addresses-no-loss-of-funds-warning` (open; codex none 1/3).
- **Per-stack frequency added** to `addresses-no-verify-before-funds` (codex none 3/3 · old 1/3 · new 0/3) and `addresses-onchain-check-as-source` (codex none 1/6 · old 0/6 · new 0/6). Both records come from #147 (the Opus row), which is not merged yet. They are copied here with a `codex/gpt-5.5` key added, so whichever PR merges second has a small conflict to resolve.
- **Re-measured, still fixed:** `addresses-base-dominance-metric` (codex quiz-001 old 2/3, the claim without the figure); `addresses-verified-stamp-substitutes-for-check` (codex 0/3 in every arm: every old run checked on-chain, at least 8 shell calls).

All 54 `output/` snapshots are force-added (4–60K each, 648K total, no `node_modules`), so every run stays regradeable.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none: `17/18 vs 13/18` (quiz-001 3/3 vs 2/3, quiz-003 3/3 vs 2/3, goal-001 2/3 vs 0/3). new vs old: `17/18 vs 10/18` (quiz-001 3/3 vs 0/3, quiz-004 3/3 vs 1/3, goal-001 2/3 vs 0/3). old vs none: `10/18 vs 13/18`. |
| Did it reduce time/tokens? | No. new vs none on goal-001: 514s / 2.13M tokens / $2.45 vs 410s / 0.74M / $1.30. On quizzes new is at or above none, and above old on quiz-001, -004 and -005. Arm totals: new $16.87, old $13.82, none $13.11 (list price). |
| Did it create negative deltas? | new: none on pass rate; costs more. old vs none: quiz-001 `0/3 vs 2/3` (old L353 dominance claim) and quiz-004 `1/3 vs 3/3` (old L388 note replaces a source). |
| What mistakes repeated without the skill? | `addresses-venue-by-reputation` 3/3, `addresses-no-verify-before-funds` 3/3, `addresses-onchain-check-as-source` 1/6, `addresses-slipstream-depth-understated` 1/3, `addresses-no-loss-of-funds-warning` 1/3 |
| What mistakes remained with the skill? | old: `addresses-base-dominance-metric` 2/3, `addresses-venue-by-reputation` 2/3, `addresses-current-deployment-no-authority` 2/3, `addresses-no-verify-before-funds` 1/3. new: `addresses-venue-by-reputation` 1/3 (judge-noisy). |
| What should change in the skill? | One candidate: "Choosing a venue" reads as advice for when someone asks which venue to use. Tie it to building a swap too, e.g. "including when the venue is one step inside code you are writing". It is the only line where new still fails on GPT. Weak evidence (1/3, and a questionable grade), so not a required change. |
| What should change in the eval? | goal-001 `expect_5` needs to say whether quoting pools inside one venue at size counts as justifying that venue against Base liquidity; the judge failed new-3 for that and passed new-2's docs-only claim. quiz-001 `expect_3` split on two near-identical old answers (Aerodrome, v2 Router, no Slipstream evidence). quiz-002 and quiz-005 are saturated on both stacks. |
