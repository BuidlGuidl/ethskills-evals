# major-refine: `addresses` on Opus 5 medium

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `claude` · `claude-opus-5` · effort `medium` |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | **true** on all 54 runs — judge and executor are the same agent |
| Runs | 3 per arm per task, 6 tasks × 3 arms = **54 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 `retracted`, 0 dead runs, 0 blindness flags |
| Trigger | not forced; every one of the 36 with-skill runs loaded `addresses` exactly once |

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
| `addresses-quiz-001` | `3/3 · 0/3 · 1/3` | old copies its own stale "largest DEX on Base by TVL (~$500-600M)" |
| `addresses-quiz-002` | `3/3 · 3/3 · 3/3` | saturated |
| `addresses-quiz-003` | `3/3 · 3/3 · 3/3` | saturated |
| `addresses-quiz-004` | `3/3 · 3/3 · 3/3` | saturated |
| `addresses-quiz-005` | `3/3 · 3/3 · 3/3` | saturated |
| `addresses-goal-001` | `3/3 · 2/3 · 1/3` | sourcing extra addresses; a verify-before-funds note |
| **total** | **`18/18 · 14/18 · 14/18`** | |

**The refine is worth two tasks, and the old skill was worth nothing net.** New is the only arm at 18/18. Old ties none: it gains a point on goal-001 and loses more on quiz-001, where the old text makes the answer worse than no skill.

### `addresses-quiz-001` — the old text is the failure

The task: pick a venue and router for a large USDC→WETH swap on Base, with evidence.

- **old, 0/3.** Old `SKILL.md` L357 says "The largest DEX on Base by TVL (~$500-600M)", and L353 says "Aerodrome dominates Base". All three old runs assert that ranking with no Base figure behind it, and so fail `expect_1` (evidence) and `expect_2` (truth; Uniswap leads Base TVL, ~$305M vs ~$285M). old-1 copies the figure word for word. It writes "Addresses from a verified address list (checked on-chain Mar 2026)" after 0 Bash calls, and fails `expect_3` too. The old runs took 29–60s with 0–2 Bash calls; they answered from the skill.
- **new, 3/3.** The refined text says not to assert dominance from aggregate TVL, and to quote the pools at the clip size. New runs take 234–338s with 5–7 Bash calls, measure the pools, and pass every line.
- **none, 1/3.** no-skill-1 fails `expect_2`. It measured only two pools, called liquidity "split about evenly", and called Aerodrome "the main liquidity hub on Base". no-skill-2 fails `expect_3`: its Universal Router address is backed only by "has code (19.5 KB)", with no source.

`addresses-base-dominance-metric` and `addresses-verified-stamp-substitutes-for-check` were already `fixed` by the refine. Here they reproduce in the old arm (3/3 and 1/3) and not in new (0/3), which is the control that fix needed.

### `addresses-goal-001` — sourcing, and telling the operator to check

- **`expect_4`, unsourced extra contracts:** none 2/3, old 1/3, new 0/3. The QuoterV2s, the Chainlink ETH/USD feed and the sequencer uptime feed are backed only by "checked on-chain" (code exists, `factory()` matches). Filed as `addresses-onchain-check-as-source`. **The judge is not consistent on this line:** old-3 failed while old-1, old-2 and new-2 passed with the same sourcing. Only no-skill-1, new-1 and new-3 name a concrete list (Uniswap's Base deployments page, the Slipstream repo, data.chain.link). Read strictly, it is none 2/3 · old 3/3 · new 1/3. Do not read the old-vs-new gap on this line as signal.
- **`expect_6`, no verify-before-funds step:** none 2/3, old 0/3, new 0/3. no-skill-2 only says to re-verify "if any protocol announces a migration", and no-skill-3 says nothing. Filed as `addresses-no-verify-before-funds`. Both skill arms close it.

## Cost

From `yarn run-stats --tasks addresses-goal-001,addresses-quiz-001,…,addresses-quiz-005 --benchmark major-refine-d9952522`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01`, `--skill-version d9952522`. Medians with ranges; `cost_source: executor`.

| Task | Arm | n | turns | duration | cost | cost range | tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `addresses-quiz-001` | new | 3 | 10 | 236s | $0.48 | $0.41–$0.52 | 206231 |
| | old | 3 | 5 | 48s | $0.35 | $0.32–$0.40 | 114807 |
| | none | 3 | 7 | 180s | $0.37 | $0.36–$0.37 | 151345 |
| `addresses-quiz-002` | new | 3 | 9 | 103s | $0.43 | $0.42–$0.50 | 183042 |
| | old | 3 | 5 | 33s | $0.35 | $0.35–$0.36 | 84769 |
| | none | 3 | 4 | 54s | $0.24 | $0.23–$0.54 | 77133 |
| `addresses-quiz-003` | new | 3 | 11 | 80s | $0.36 | $0.29–$0.45 | 214315 |
| | old | 3 | 10 | 64s | $0.50 | $0.46–$0.57 | 254473 |
| | none | 3 | 7 | 54s | $0.30 | $0.23–$0.33 | 139379 |
| `addresses-quiz-004` | new | 3 | 6 | 32s | $0.20 | $0.17–$0.21 | 95680 |
| | old | 3 | 4 | 23s | $0.30 | $0.30–$0.30 | 81794 |
| | none | 3 | 3 | 26s | $0.16 | $0.15–$0.17 | 54594 |
| `addresses-quiz-005` | new | 3 | 9 | 60s | $0.34 | $0.32–$0.37 | 150203 |
| | old | 3 | 7 | 39s | $0.39 | $0.34–$0.41 | 150325 |
| | none | 3 | 6 | 48s | $0.26 | $0.24–$0.29 | 115241 |
| `addresses-goal-001` | new | 3 | 37 | 1154s | $2.27 | $1.87–$2.36 | 1599633 |
| | old | 3 | 30 | 797s | $2.10 | $1.44–$2.72 | 1449371 |
| | none | 3 | 16 | 475s | $1.41 | $1.32–$2.17 | 563719 |

Unlike tools and standards, **the refine does not make addresses cheaper, and it should not be read as if it should.** The refined text tells the model to check every address on-chain instead of trusting a table, and the model does. new is the dearest arm on quiz-001, quiz-002 and goal-001, and takes the most turns on all six tasks. On quiz-001 those extra checks are exactly what separates 3/3 from old's 0/3. On quiz-002 they buy nothing graded. The old text is cheaper where it was answering from a stale table. Against none, both skill arms cost more on every task.

Wall clock on goal-001 is dominated by long runs: 7 to 41 minutes each.

## Records

- **New:** `addresses-onchain-check-as-source` (open; graded none 3/6 · old 1/6 · new 0/6, with the judge-consistency caveat above). `addresses-no-verify-before-funds` (fixed; none 2/3 · old 0/3 · new 0/3).
- **Re-measured, still fixed:** `addresses-base-dominance-metric` (none 0/3 · old 3/3 · new 0/3); `addresses-verified-stamp-substitutes-for-check` (none 0/3 · old 1/3 · new 0/3). The old arm reproducing them is the control for the refine.
- **Not measured this run:** `addresses-aero-merger-tense`, `addresses-morpho-arbitrum-absent`, `addresses-erc8004-same-address-all-chains`. `addresses-aerodrome-slipstream-missing` did not reproduce as a graded failure (0/3 in every arm), although the old text still has no Slipstream router and old runs declined to give one ("not in my verified list").

All 54 `output/` snapshots are force-added (4–80K each, no `node_modules`), so every run stays regradeable.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none: `18/18 vs 14/18` (quiz-001 3/3 vs 1/3, goal-001 3/3 vs 1/3). new vs old: `18/18 vs 14/18` (quiz-001 3/3 vs 0/3, goal-001 3/3 vs 2/3). old vs none: `14/18 vs 14/18`. |
| Did it reduce time/tokens? | No. new costs more than old on quiz-001 ($0.48 / 206k vs $0.35 / 115k), quiz-002 and goal-001 ($2.27 / 1.60M vs $2.10 / 1.45M); less on quiz-003, quiz-004 and quiz-005. That is the verify behaviour the refined text asks for. |
| Did it create negative deltas? | old vs none on quiz-001: `0/3 vs 1/3`, caused by old L353/L357. new has no negative pass delta. Cost: new is dearer than none on every task. |
| What mistakes repeated without the skill? | `addresses-no-verify-before-funds` (2/3), `addresses-onchain-check-as-source` (3/6) |
| What mistakes remained with the skill? | old: `addresses-base-dominance-metric` 3/3, `addresses-verified-stamp-substitutes-for-check` 1/3, `addresses-onchain-check-as-source` 1/6. new: none graded. |
| What should change in the skill? | Nothing this benchmark requires. If quiz-002-style lookups should be cheaper, the verify paragraph could say which checks are enough for a read-only answer, but nothing here was graded down for over-checking. |
| What should change in the eval? | quiz-002 to quiz-005 are saturated on Opus 5 medium. goal-001 `expect_4` needs a sharper line: say whether "checked on-chain + re-verify on basescan" counts as a source, since the judge split 3–1 on identical sourcing. |
