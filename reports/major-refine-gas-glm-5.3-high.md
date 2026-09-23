# gas — major-refine, GLM 5.3 high

Benchmark id: `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)).
Benchmark commit `d9952522`.

| | |
| --- | --- |
| Executor | opencode, `openrouter/z-ai/glm-5.3`, effort `high` (models catalog `9eb2ba682cd6` on every run) |
| Judge | claude, `claude-opus-5`, effort `high` |
| Runs | 3 per arm per task, 27 graded runs |
| Arms | none (`no_skill`) · old (`with_skill`, skill_version `2f0adb01`) · new (`with_skill`, skill_version `d9952522`) |
| `self_judged` | **false** on every run. The judge is claude and the executor is opencode. |

Tasks: `gas-goal-002`, `gas-quiz-001`, `gas-quiz-003` (every live task whose `skill:` is `skills/gas`).
No trigger was forced, so both skill arms are unprompted-trigger numbers. The skill loaded (a `skill` tool
call for `gas`) in 18 of 18 with_skill runs.

OpenRouter routes `glm-5.3` per request across providers, and the harness does not pin one. "Same model"
across these 27 runs therefore means the same name, not provably the same weights (AGENTS.md, "The three
roles"). The arms were interleaved per round (none, old, new for run 1, then run 2, then run 3), so any
routing drift lands on all three arms.

## Headline — pass counts, new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| gas-quiz-001 | **3/3** | **3/3** | **1/3** |
| gas-quiz-003 | 2/3 | 3/3 | **0/3** |
| gas-goal-002 | 3/3 | 2/3 | 3/3 |
| **all** | **8/9** | **8/9** | **4/9** |

On this stack the skill separates cleanly from no skill on the two chain-pick quizzes: 5/6 and 6/6
against 1/6. On the goal task it makes no difference, because all three GLM controls measured Base live and
passed. The two texts tie at 8/9. Each misses one run, on a different task, and neither miss is the stale
prior the skill exists to correct. In both, the run had a correct live reading and priced off something
else instead (see below).

### Per check

| Task | run | arm | expects | pass |
| --- | --- | --- | --- | --- |
| gas-quiz-001 | 111750Z-2 | none | ✔ ✘ ✘ | fail |
| gas-quiz-001 | 112200Z-3 | none | ✔ ✘ ✘ | fail |
| gas-quiz-003 | 112650Z-1 | none | ✔ ✔ ✔ ✘ | fail |
| gas-quiz-003 | 113739Z-2 | none | ✔ ✔ ✔ ✘ | fail |
| gas-quiz-003 | 114147Z-3 | none | ✔ ✔ ✔ ✘ | fail |
| gas-quiz-003 | 114344Z-3 | new | ✔ ✔ ✔ ✘ | fail |
| gas-goal-002 | 125436Z-2 | old | ✔ ✘ ✔ ✔ ✘ | fail |

Every other run passed every line. `expect_sha` is uniform across the nine runs of each task
(`2b2d28e70076` quiz-001, `f0aa1420274c` quiz-003, `98d1a0c467f1` goal-002), and so is `input_sha`.
Each task's arms were therefore graded against one rubric on one prompt, the same rubric hashes the
other gas rows of this benchmark carry. No expect line was touched.

**gas-quiz-001, none 1/3.** Neither failing control made an RPC call. `111750Z-2` found "0.65 gwei (today,
historically anomalous low)" by web search, assumed ETH at $2,500, and let an 8/30/100-gwei scenario table
decide: "gas eliminates mainnet as the default". It recommended Base. `112200Z-3` priced a 250k-gas job at
10 gwei and ETH $3,000 ($8–60 per job) while noting that 2026 averages run 0.5–1 gwei, and recommended
Arbitrum. Both failed expect_2 (mainnet disqualified on cost) and expect_3 (not live-checked). Filed under
[`gas-mainnet-disqualified-on-cost`](../mistakes/gas/gas-mainnet-disqualified-on-cost.yaml) and
[`gas-invented-gas-price`](../mistakes/gas/gas-invented-gas-price.yaml). The passing control (`111438Z-1`)
fetched ETH from Coinbase and kept mainnet viable. All six skilled runs, on either text, read mainnet off an
RPC (0.29–0.38 gwei) and kept mainnet viable.

**gas-quiz-003, none 0/3.** All three controls picked Base with reasoning from the traffic profile, which
passes expect_3. All three then quoted mainnet at "$2–15" per action from web fee-comparison articles,
calling it "dead on arrival", a "non-starter" and "disqualified", and failed expect_4 alone. `113739Z-2` even
printed a $0.012 Q1-2026 mainnet figure and footnoted it away as an unusually quiet market. None made a gas
reading. Same record as above.

**gas-quiz-003, new 2/3.** `114344Z-3` is the most thoroughly measured answer in the set. It ran three RPCs
per chain, fetched ETH from Chainlink with Coinbase as a cross-check, read l1Fee off Base and OP receipts,
and read Arbitrum's gasUsedForL1. It then headlined mainnet at the **median effectiveGasPrice of a
12-transaction block sample, 2.17 gwei**, rather than its own `cast gas-price` reading of 0.365 gwei. That
gives $0.47 per post, where the reading it had would give about $0.08, and it added a "routine congestion
spike to 30+ gwei" at $3+ per action. It failed expect_4 alone. Filed as a new record,
[`gas-mainnet-priced-at-block-median-paid`](../mistakes/gas/gas-mainnet-priced-at-block-median-paid.yaml).
**This grade is borderline and worth a look on #119:** $0.47 is cents rather than dollars, but it rests on a
2.17-gwei price where expect_4 asks for a sub-1-gwei one. The judge's reading is defensible, and I have not
touched the line.

**gas-goal-002, old 2/3.** `125436Z-2` called `GasPriceOracle.getL1Fee` on two Base RPCs and got
3,042,062,991 wei for both a 69-byte and a 210-byte payload, about 1% of its own execution figure. It judged
the equal values "suspicious". They are the oracle's minimum-L1-gas floor for small payloads:
`getL1GasUsed` returned 1600 for every size. It concluded that "the public RPC proxies don't execute
predeploy calls correctly", discarded the reading, and wrote "~1–5% at today's blob prices" into PLAN.md with
no L1 amount. That fails expect_2 (share not stated at ~1% or less) and expect_5 (no component amount). Filed
under [`gas-stale-l2-blob-share`](../mistakes/gas/gas-stale-l2-blob-share.yaml) as a new shape: a correct
reading thrown out and replaced by a remembered range. The plan is otherwise sound: $34/day, fee hygiene
first, batching second.

**gas-goal-002, none 3/3.** Unlike the Kimi and GPT rows, every GLM control measured Base live (base fee,
receipts, l1Fee), put the L1 share at ~1% or below, and ranked batching or a fee-policy audit first. On this
stack the goal task does not discriminate between arms.

## Cost — medians per arm, with ranges

From `yarn run-stats --tasks gas-quiz-001,gas-quiz-003,gas-goal-002 --benchmark major-refine-d9952522`,
split by `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`.
`cost_source: executor` throughout. That is opencode's own arithmetic on the models.dev list price, not
OpenRouter's bill, which is at the routed provider's rate.

| Task | arm | turns | duration | cost | cost range | total tokens |
| --- | --- | --- | --- | --- | --- | --- |
| gas-quiz-001 | none | 5 | 49s | $0.08 | $0.06–$0.12 | 80,766 |
| gas-quiz-001 | old | 7 | 37s | $0.05 | $0.05–$0.08 | 87,477 |
| gas-quiz-001 | new | 8 | 47s | $0.07 | $0.07–$0.13 | 102,471 |
| gas-quiz-003 | none | 4 | 36s | $0.08 | $0.06–$0.08 | 94,620 |
| gas-quiz-003 | old | 7 | 31s | $0.05 | $0.05–$0.07 | 94,749 |
| gas-quiz-003 | new | 17 | 278s | $0.20 | $0.11–$0.34 | 387,688 |
| gas-goal-002 | none | 106 | 847s | $3.31 | $2.79–$4.95 | 10,287,850 |
| gas-goal-002 | old | 74 | 727s | $1.80 | $1.26–$3.07 | 4,969,512 |
| gas-goal-002 | new | 101 | 1213s | $2.34 | $2.02–$4.89 | 6,675,423 |

The quizzes cost cents on every arm. The one standout is gas-quiz-003 on the new text: 4x the tokens and
~8x the wall clock of the other arms. That arm measured every L2 it compared (receipts, l1Fee, three RPCs
per chain), where the old-text runs mostly read mainnet alone (Base in 1 of 3). On the goal task the controls were the dearest
arm (10.3M median tokens against 5.0M old and 6.7M new), but all three ranges overlap, so no ordering there
carries a headline.

## Observations the task notes ask for

**gas-quiz-001 pointer triage.** Counted from bash, webfetch and websearch calls in `transcript.md`, not
from the skill text echoed into it.

| pointer | old `2f0adb01` | new `d9952522` |
| --- | --- | --- |
| `cast base-fee` / `cast gas-price` on mainnet | 3/3 used | 3/3 used |
| `eth.llamarpc.com` (old text only) | 3/3 called, **3/3 failed** (HTTP 525). Caused harm: a wasted turn each | n/a |
| `ethereum-rpc.publicnode.com` + drpc/flashbots fallbacks (new text) | 1/3 found publicnode unprompted | 3/3 used |
| Chainlink ETH/USD feed | 0/3 | 1/3 |
| CoinGecko (old) / Coinbase spot (new) | 2/3 CoinGecko, 1/3 web search | 3/3 Coinbase |
| A Base reading for the L2 side | 1/3 | 3/3 (3/3 also read `l1Fee`) |
| Old text's 1/10-gwei "busy/event" table and "1–2 gwei" maxFee values | appear in 3/3 answers as labelled scenarios. Ignored as a basis: every run priced off its live reading | n/a |

Across all nine old-arm runs, 8 called llamarpc and all 8 got an error: HTTP 525 on the six quiz runs, a
Cloudflare challenge page and "mainnet rpc failed" on two goal runs. Each recovered on publicnode, drpc
or ankr. That re-confirms [`gas-dead-llamarpc-endpoint`](../mistakes/gas/gas-dead-llamarpc-endpoint.yaml) on
the old text. It stays `fixed`: no new-arm run hit a dead endpoint.

**gas-goal-002 mining.**
- **Measure first or reason from priors?** All nine runs measured before optimizing. Every run read the Base
  base fee or receipts and fetched a live ETH price (expect_4 passed on all nine).
- **Calldata compression.** It was never ranked first. Every plan ranked batching or an EIP-1559 fee-policy
  audit first (none 2 batching / 1 fee audit, old 3 fee audit, new 2 batching / 1 fee fields). Several listed
  L1 data or compression under "not worth doing" with a measured share of ~1%.
- **Proportionality.** Every run put today's bill at $33–51/day at market fees, and every run carried a
  fee-policy item: check what the relayer actually pays, or derive fee fields from the chain, because a
  hardcoded 0.1-gwei fee would be ~20x the bill and outweigh any optimization. Five ranked it first or as a
  step 0 (none-1, all three old, new-2). Two flagged it "check first" or "do this first" while ranking it
  lower (none-2, none-3). Two ranked it second behind batching (new-1, new-3).

**Feedback calls.** Both texts end with "send a one-line note via feedback/SKILL.md". 13 of 18 with_skill runs
fetched `https://ethskills.com/feedback/SKILL.md`. **None sent a note**: no query string, POST or form
submission to ethskills.com appears in any transcript. Unlike the Kimi row, this stack produced no outbound
writes to a production endpoint.

## Run incidents

**No run was discarded, retracted or graded over a refusal.** All 27 runs exited 0. `--grade-failed-run` and
`--allow-skill-mention` were never used, and no `harness_failure` is recorded. No usage limit, network error or
dead sandbox interrupted any run.

One orchestration stop, with no effect on any record. The first launch of the driver loop used `yarn -s`, which
Yarn 4 rejects, so it exited at the first `setup` before creating a run dir. The loop was fixed and restarted
13 seconds later. The 27 runs then ran one at a time, back to back, from 11:14Z to 14:10Z.

## What should change in the eval

- **gas-goal-002 does not discriminate on this stack.** The controls were 3/3, and the task's only miss is
  the old-arm run that discarded its L1 reading. The same task separated arms on the Kimi row (none 2/3), so this is
  a property of the stack, not a broken task.
- **gas-quiz-003 expect_4 grades the headline mainnet figure.** A run that reads 0.365 gwei correctly and
  then quotes a block median of 2.17 gwei fails the same line as a control that quotes $2–15 from an article.
  Both fail for a reason, but they are very different errors. If #119 wants the rubric to tell them apart, it
  could say which reading the figure must rest on (the base fee or `gas-price`, not a paid-price sample).
  Raised as a note, not an edit.
- gas-quiz-003 separates arms on expect_4 alone: its first three lines passed on 9/9 runs. On the Kimi row the same line was the only failure, and on the GPT row the task did not separate at all (3/3 on every arm).

## AGENTS.md table

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none **`8/9 vs 4/9`** (quiz-001 3/3 vs 1/3, quiz-003 2/3 vs 0/3, goal-002 3/3 vs 3/3). old vs none `8/9 vs 4/9`. new vs old **`8/9 vs 8/9`**, a tie, with one miss each on a different task. |
| Did it reduce time/tokens? | Not in a way the ranges support. Quizzes cost cents everywhere, but new-text quiz-003 took 278s / 388k tokens against 31–36s / ~95k for old and none, because it measured every L2. Goal-002 medians, none / old / new: `847s / 10.3M tok / $3.31` · `727s / 5.0M / $1.80` · `1213s / 6.7M / $2.34`. Ranges overlap. |
| Did it create negative deltas? | Old text: the dead `eth.llamarpc.com` cost a turn in 8/9 runs. New text: ~4x tokens on quiz-003, and its one miss (block-median pricing) came from a run that measured more than any other. No pass-rate regression against none on either text. 13/18 skilled runs fetched the feedback page, and none posted to it. |
| What mistakes repeated without the skill? | `gas-mainnet-disqualified-on-cost` (5/6 chain-pick controls), `gas-invented-gas-price` (2/9). |
| What mistakes remained with the skill? | New text: `gas-mainnet-priced-at-block-median-paid` (1/3 quiz-003). Old text: `gas-stale-l2-blob-share` (1/3 goal-002, a discarded oracle reading), `gas-dead-llamarpc-endpoint` (8/9, recovered each time). |
| What should change in the skill? | **new vs none:** the correction holds. No skilled run disqualified mainnet on a stale figure, and none quoted a remembered price. **new vs old:** keep the new text. It removes the llamarpc cost and the stale scenario tables, and its miss is narrower. Two small edits this stack supports: (1) under the `cast gas-price` paragraph, add that a block's median effectiveGasPrice is inflated by tips and is not the price to quote; (2) beside the GasPriceOracle pointer, add that `getL1Fee` returns the same value for small payloads because of its minimum-L1-gas floor, so an equal reading is not a broken RPC. |
| What should change in the eval? | goal-002 does not discriminate on this stack (controls 3/3). quiz-003 separates on expect_4 only, and that line cannot tell a mis-chosen live reading from a stale prior. Both raised as notes on #119. The rubric is unchanged. |
