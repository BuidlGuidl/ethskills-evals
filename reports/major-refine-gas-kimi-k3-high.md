# gas — major-refine, Kimi K3 high

Benchmark id: `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)).
Benchmark commit `d9952522`.

| | |
| --- | --- |
| Executor | opencode, `openrouter/moonshotai/kimi-k3`, effort `high` (models catalog `9eb2ba682cd6` on every run) |
| Judge | claude, `claude-opus-5`, effort `high` |
| Runs | 3 per arm per task, 27 graded runs |
| Arms | none (`no_skill`) · old (`with_skill`, skill_version `2f0adb01`) · new (`with_skill`, skill_version `d9952522`) |
| `self_judged` | **false** on every run — the judge is claude, the executor opencode. |

Tasks: `gas-goal-002`, `gas-quiz-001`, `gas-quiz-003` (every live task whose `skill:` is `skills/gas`).
No trigger was forced; these are unprompted-trigger numbers on both skill arms.

OpenRouter routes `kimi-k3` per request across providers, and the harness does not pin one, so
"same model" across these 27 runs means the same name, not provably the same weights (AGENTS.md,
"The three roles"). The arms were interleaved per round, so any routing drift lands on all three.

## Headline — pass counts, new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| gas-quiz-001 | **3/3** | **3/3** | **0/3** |
| gas-quiz-003 | 3/3 | 3/3 | 2/3 |
| gas-goal-002 | 3/3 | 2/3 | 2/3 |
| **all** | **9/9** | **8/9** | **4/9** |

The skill separates cleanly from no skill on this stack — 9/9 and 8/9 against 4/9 — and almost all of it
is on `gas-quiz-001`, the high-value escrow question. The two texts are one run apart, and that
run is a percentage slip, not a stale belief (see below).

### Per check

| Task | run | arm | expects | pass |
| --- | --- | --- | --- | --- |
| gas-quiz-001 | 105329Z-1 | none | ✔ ✘ ✘ | fail |
| gas-quiz-001 | 111629Z-2 | none | ✔ ✘ ✘ | fail |
| gas-quiz-001 | 112317Z-3 | none | ✔ ✘ ✘ | fail |
| gas-quiz-003 | 113915Z-3 | none | ✔ ✔ ✔ ✘ | fail |
| gas-goal-002 | 131409Z-3 | none | ✔ ✘ ✔ ✘ ✘ | fail |
| gas-goal-002 | 120622Z-1 | old | ✔ ✔ ✔ ✔ ✘ | fail |

Every other run passed every line. `expect_sha` is uniform across the nine runs of each task
(`2b2d28e70076` quiz-001, `f0aa1420274c` quiz-003, `98d1a0c467f1` goal-002), as is `input_sha`, so each
task's arms were graded against one rubric on one prompt. No expect line was touched.

**gas-quiz-001, none 0/3 — live reading, then discarded.** All three controls searched the web, read
the Etherscan gas tracker, and put a sub-gwei mainnet figure into `answer.md` (~0.1–1 gwei). All three then
recommended Base and ruled mainnet out on a "congestion returns" scenario priced at 20–100 gwei:
"$12.50 per job … Fails" at 20 gwei (`112317Z-3`), "$5–60 in congestion (30–100 gwei)" (`111629Z-2`), a
10–50 gwei "normal congestion" row (`105329Z-1`). They failed expect_2 (mainnet disqualified on
cost / dollars-per-transaction) and expect_3 (cost figures from values not live-checked). This is
[`gas-mainnet-disqualified-on-cost`](../mistakes/gas/gas-mainnet-disqualified-on-cost.yaml) in a shape
the earlier stacks did not show: the model *has* the live number and lets the remembered one decide. All six
skill runs, on either text, read mainnet off an RPC (0.30–0.35 gwei) and recommended mainnet.

**gas-quiz-003, none 2/3.** `113915Z-3` picked Base with sound reasoning from the traffic profile but
quoted mainnet at $1.10–$15 per action off four web searches and no gas reading — expect_4 only. Same record.

**gas-goal-002, none 2/3.** `131409Z-3` wrote a cost model with an `--rpc` flag, ran it once against
`mainnet.base.org`, got `over rate limit`, and shipped PLAN.md on the model's built-in defaults: ETH $3,300,
a 0.1 gwei tip, an L1 data fee of 13.6 gwei/byte. It puts spend at **$859/day** where the other eight
runs measured $30–40/day, and its L1 component is about a quarter of the fee. Filed under
[`gas-invented-gas-price`](../mistakes/gas/gas-invented-gas-price.yaml) and
[`gas-stale-l2-blob-share`](../mistakes/gas/gas-stale-l2-blob-share.yaml). The rate limit is counted as a
result, not a harness failure: the run was not killed, it hit a public RPC's limit mid-task and chose to ship
defaults rather than retry or switch endpoints. The one other goal-002 run to hit it, old-arm `131926Z-3`,
switched and passed. Recovering from a public endpoint's limit is part of what a live-data task measures,
but if #119 reads it the other way, this is the run to re-make.

**gas-goal-002, old 2/3.** `120622Z-1` measured everything live and got the story right — L1 data is
a rounding error, batching is the top lever, ~$40/day — but wrote the L1 share as "~0.3%" where its own
receipts (avg 60,240 gas at 0.005–0.006 gwei, L1 ~2.85e9 wei) give ~0.9%. expect_5 (arithmetic
consistency) only. Filed as
[`gas-l1-share-inconsistent-with-own-figures`](../mistakes/gas/gas-l1-share-inconsistent-with-own-figures.yaml).
The whole new-vs-old gap in this benchmark is this one slip, so it is not evidence that the old text
misleads about L2 fees.

## Cost — medians per arm, with ranges

From `yarn run-stats --tasks gas-quiz-001,gas-quiz-003,gas-goal-002 --benchmark major-refine-d9952522`,
split by `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`.
`cost_source: executor` throughout: opencode's own arithmetic on models.dev list price, not
OpenRouter's bill, which is at the routed provider's rate.

| Task | arm | turns | duration | cost | cost range | total tokens |
| --- | --- | --- | --- | --- | --- | --- |
| gas-quiz-001 | none | 5 | 130s | $0.13 | $0.12–$0.15 | 65,631 |
| gas-quiz-001 | old | 9 | 65s | $0.12 | $0.11–$0.14 | 90,276 |
| gas-quiz-001 | new | 10 | 133s | $0.12 | $0.10–$0.19 | 100,256 |
| gas-quiz-003 | none | 6 | 80s | $0.20 | $0.19–$0.21 | 126,156 |
| gas-quiz-003 | old | 5 | 55s | $0.07 | $0.06–$0.08 | 51,498 |
| gas-quiz-003 | new | 8 | 99s | $0.12 | $0.10–$0.15 | 81,281 |
| gas-goal-002 | none | 27 | 346s | $0.68 | $0.57–$1.57 | 740,040 |
| gas-goal-002 | old | 42 | 868s | $0.92 | $0.70–$1.48 | 1,175,770 |
| gas-goal-002 | new | 34 | 555s | $0.79 | $0.71–$0.96 | 786,211 |

Nothing here is large enough to carry a headline. The quizzes cost cents on every arm, and the
spreads overlap. On the goal task the old text is the dearest arm (median 868s / 1.18M tokens against 555s / 0.79M
for the new text and 346s / 0.74M for none), but the three cost ranges overlap. The new text lands
within ~6% of no_skill tokens on the goal task for 3/3 against 2/3.

## Observations the task notes ask for

**gas-quiz-001 pointer triage** (the task notes ask which skill pointers were exercised):

| pointer | old `2f0adb01` | new `d9952522` |
| --- | --- | --- |
| `cast base-fee` / `cast gas-price` on mainnet | 3/3 used | 3/3 used (`gas-price`) |
| `eth.llamarpc.com` (old text only) | 3/3 called, **3/3 failed** (HTTP 525 / empty) — caused a wasted turn | n/a |
| `ethereum-rpc.publicnode.com` + named fallbacks (new text) | 3/3 found it anyway, not named | 3/3 used |
| Chainlink ETH/USD feed | 1/3 | 1/3 |
| CoinGecko (old) / Coinbase spot (new) | 2/3 CoinGecko | 2/3 Coinbase |
| Base receipt / `l1Fee` for the L2 comparison | 0/3 | 3/3 read `mainnet.base.org`, 2/3 read `l1Fee` |
| "under 1 gwei" framing | used, never quoted in place of a reading | used, never quoted in place of a reading |

None of the pointers did harm. The dead llamarpc URL is the one that cost something: across all nine
old-arm runs, 7 called it and all 7 got an error, recovering on publicnode or cloudflare-eth. That re-confirms
[`gas-dead-llamarpc-endpoint`](../mistakes/gas/gas-dead-llamarpc-endpoint.yaml) on the old text; it stays
`fixed`, and no new-arm run hit a dead endpoint.

**gas-goal-002 mining.** Every passing run grounded its cost in live values (expect_4 passed on all eight). Across all eight passes and
all three arms, the top-ranked lever was batching or an EIP-1559 fee-policy audit, never calldata compression or
L1 data. Every with_skill run read `l1Fee` off a Base receipt or the GasPriceOracle and put the L1 share at
0.3–1.4%. Both passing no_skill runs passed expect_2 as well, so the judge found an L1 share of ~1% or less in each. Proportionality (noticing that a ~$35/day bill
does not justify a big project) was explicit in the two new-arm runs that ranked "audit fee fields,
$0 if already correct" first (`130521Z-2`, `132529Z-3`), and in old-arm `131926Z-3`.

**Feedback calls.** Both texts end with "send a one-line note via feedback/SKILL.md". 14 of 18
with_skill runs contacted that URL, and 8 of them sent a note, by query string or POST (5 of 6 on
gas-quiz-001). That is outbound traffic from benchmark runs to ethskills.com, prompted by the skill text itself. It is not a mistake against the
rubric, but it means most with_skill runs in this benchmark wrote to a production endpoint.

## Run incidents

**No run was discarded, retracted or graded over a refusal.** Every run exited 0; `--grade-failed-run`
and `--allow-skill-mention` were never used; no `harness_failure` is recorded.

One orchestration stop, with no effect on any record: the driver loop ran under `set -e`
and treated `yarn verify`'s exit 2, which means "graded, failing", as an error. It stopped after grading
gas-quiz-001 no_skill run 1 at 10:55Z. That run's record is complete and was kept. The loop was restarted at
11:11Z, skipping graded runs, so round 1's old and new arms ran 16 minutes after its none arm rather than
immediately after. Every other round ran back to back.

## What should change in the eval

- `gas-quiz-003` does not discriminate on this stack beyond expect_4: 8/9 skill-agnostic passes, and the
  single failure is a mainnet dollar figure. The same was true on codex (task notes, 2026-09-17). It measures one line.
- `gas-goal-002` expect_5 decided the only new-vs-old difference, on a ~3x error in a percentage that
  both readings agree is a rounding error. That is working as written (the line asks for arithmetic
  consistency), but it is a thin basis for ranking two texts. Raised on #119 as a note, not an edit.
- The skill's feedback line makes every with_skill run send traffic to ethskills.com. Worth deciding
  on #119 whether benchmark runs should do that.

## AGENTS.md table

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none **`9/9 vs 4/9`** (quiz-001 3/3 vs 0/3, quiz-003 3/3 vs 2/3, goal-002 3/3 vs 2/3). new vs old `9/9 vs 8/9`, one goal-002 arithmetic slip apart. |
| Did it reduce time/tokens? | Not materially. Quizzes: cents everywhere, ranges overlap. Goal task medians, none / old / new: `346s / 740k tok / $0.68` · `868s / 1.18M / $0.92` · `555s / 786k / $0.79`. The new text runs close to no_skill cost; the old one is ~1.5x tokens. |
| Did it create negative deltas? | Old text: the dead `eth.llamarpc.com` cost a turn in 7/9 runs. Both texts: the feedback line has 14/18 runs contact ethskills.com, 8 of them posting a note. No pass-rate regressions on either text. |
| What mistakes repeated without the skill? | `gas-mainnet-disqualified-on-cost` (4/6 chain-pick controls, now with a live reading in hand), `gas-invented-gas-price` (1/9), `gas-stale-l2-blob-share` (1/3 goal-002). |
| What mistakes remained with the skill? | New text: none. Old text: `gas-l1-share-inconsistent-with-own-figures` (1/3), `gas-dead-llamarpc-endpoint` (7/9, recovered each time). |
| What should change in the skill? | Nothing this stack supports on correctness: the refined text is 9/9 and closes the llamarpc cost. Optional: a sentence that a live reading is the figure to price with, and a hypothetical 20–100 gwei "congestion" scenario is not grounds to rule mainnet out. That is the exact move 3/3 controls made; no skilled run needed it. |
| What should change in the eval? | quiz-003 separates on one line only; goal-002's new-vs-old gap rests on one arithmetic check; decide whether the skill's feedback call should fire from benchmark runs. |
