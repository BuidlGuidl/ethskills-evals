# major-refine: `gas` on GPT 5.5 high

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `codex` · `gpt-5.5` · effort `high` (codex-cli 0.156.1) |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | **false** on all 27 records |
| Runs | 3 per arm per task, 3 tasks × 3 arms = **27 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 dead runs, 0 retracted, 0 blindness refusals, `--grade-failed-run` never used, no run discarded |
| Trigger | not forced — numbers are trigger-inclusive. Every skill-arm run (18/18) read `.agents/skills/gas/SKILL.md` |
| Sitting | 2026-09-23, 10:02–12:08 UTC, one run at a time (setup → run-executor → verify), arms interleaved none/old/new within each wave |
| Costs | codex dollars are `cost_source: list_price` — the token split priced at OpenAI list price in `lib/prices.ts`, not a bill |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `gas`, 124 lines: "What You Probably Got Wrong", cost tables at ETH ~$2,000, a Base L2-components example with L1 blob ≈ 90% of the fee, `cast base-fee --rpc-url https://eth.llamarpc.com` |
| new | `with_skill` | `d9952522` | refined `gas`, 48 lines: measure-first instruction, publicnode/base.org RPCs with named fallbacks, Chainlink/Coinbase ETH/USD, the cost formula with an OP-stack `l1_fee_eth` term, wei→gwei warning, three workload rules for mainnet vs L2 |

Both `skill_version` commits are ancestors of HEAD. No task has a template, so there was nothing to pre-install. Every run carries the same `input_sha` and `expect_sha` per task.

**Tasks** — all three live tasks whose `skill:` is `skills/gas`.

- `gas-quiz-001` — escrow for freelance payments, $2,000–$50,000 per job: which chain, with numbers. Three lines: concrete pick with current costs, mainnet not disqualified on cost, live sub-gwei gas and live ETH price.
- `gas-quiz-003` — social feed for AI agents inside the Ethereum ecosystem: which chain, with numbers. Four lines: concrete pick with costs, inside the ecosystem, reasoning from the traffic profile, any mainnet figure in cents at a live gas price.
- `gas-goal-002` — payments app on Base, 40,000 ERC-20 transfers/day from one relayer: `PLAN.md` ranked by saving, and ship the code. Five lines: spend quantified and ranked, L1 data share ≲1%, no stale calldata-first tell, live inputs, a component breakdown that adds up.

## Headline — pass counts, new · old · none

| Task | new · old · none | Per run |
| --- | --- | --- |
| `gas-quiz-001` | `3/3 · 3/3 · 0/3` | skill arms 3/3 lines ×6; none `p f f` ×3 |
| `gas-quiz-003` | `3/3 · 3/3 · 3/3` | 4/4 lines in all nine runs |
| `gas-goal-002` | `3/3 · 2/3 · 1/3` | new 5/5 ×3; old `p f p p f`, 5/5, 5/5; none 5/5, `p p p p f`, `p f p p f` |
| **total** | **`9/9 · 8/9 · 4/9`** | |

**The skill carries quiz-001 in both texts.** Without it, all three runs priced mainnet off a web fee page and failed both cost lines; with either text, all six read the chain over RPC and passed.

**quiz-003 is saturated on this stack.** The none runs pulled realized per-chain tx costs from growthepie's API, landed on cents, and reasoned from the traffic profile; nothing in the task separates the arms.

**goal-002 is the only old-vs-new difference, and it is one run.** One old-arm plan left the L1 data fee out altogether (e2, e5), and so did one none plan; a second none plan gave totals with no per-component amounts (e5). All three new-arm plans read `l1Fee` off Base receipts and showed it as its own amount. That matches the new text's two-line formula, which carries `l1_fee_eth` and says to read it off a receipt, but at 1 run in 3 it is weak evidence.

### Per-expect

| gas-quiz-001 line | new | old | none |
| --- | --- | --- | --- |
| e1 concrete pick with current per-tx costs | 3/3 | 3/3 | 3/3 |
| e2 mainnet viable, cents-range costs, not dollars | 3/3 | 3/3 | **0/3** |
| e3 live sub-gwei gas price and live ETH price | 3/3 | 3/3 | **0/3** |

| gas-quiz-003 line | new | old | none |
| --- | --- | --- | --- |
| e1 concrete pick with per-action costs | 3/3 | 3/3 | 3/3 |
| e2 inside the Ethereum ecosystem | 3/3 | 3/3 | 3/3 |
| e3 derived from the traffic profile | 3/3 | 3/3 | 3/3 |
| e4 any mainnet figure in cents at a live gas price | 3/3 | 3/3 | 3/3 |

| gas-goal-002 line | new | old | none |
| --- | --- | --- | --- |
| e1 spend quantified, ranked by saving | 3/3 | 3/3 | 3/3 |
| e2 L1 data share ≲1% | 3/3 | 2/3 | 2/3 |
| e3 no stale L1/calldata-first tell | 3/3 | 3/3 | 3/3 |
| e4 live-checked inputs | 3/3 | 3/3 | 3/3 |
| e5 component breakdown, arithmetically consistent | 3/3 | **2/3** | **1/3** |

The judge's per-line reasoning is not persisted by `verify`; the causes below are my reading of the committed `output/` and `transcript.md`, not the judge's words.

## What the runs did

**quiz-001, none: sourced, dated, and 20–90× high.** None of the three made an RPC call or ran `cast`; each did 4–15 web searches. Runs 1 and 3 took L2Fees.info's "Ethereum $1.10 send / $5.48 swap" and built a "$3.30–$16.44 per escrow" row; run 2 took usdc.org's fee calculator ("Ethereum $4.10 for a modeled 65k-gas USDC transfer") and priced a job at $21.13, 1.06% of a $2,000 escrow. In the same hour the skill arms read mainnet at 0.29–0.35 gwei with ETH near $2,720, where a 65k-gas transfer is about $0.06. Picks: Arbitrum (runs 1, 2) and Base (run 3). Runs 2 and 3 ruled mainnet out for the low end of the range on that figure; run 1 called it "economically tolerable for $50,000" and picked Arbitrum on governance risk. The judge failed e2 and e3 in all three. Filed as `gas-fee-aggregator-quoted-as-live` (new); two of the three also count toward `gas-mainnet-disqualified-on-cost`.

**quiz-001, skill arms.** All six read mainnet gas over RPC and fetched ETH/USD live. The old arm followed its `cast base-fee --rpc-url https://eth.llamarpc.com` line and hit HTTP 525 in every run (and in all three old quiz-003 runs; see below), then recovered on publicnode. It took ETH/USD from CoinGecko, which it names, rather than the Chainlink feed it also names. The new arm used publicnode and the Coinbase spot URL it names. Four of its six quiz runs also read Base's OP-stack `l1Fee` or `GasPriceOracle`. Every new-arm quiz-001 run also tried `polygon-rpc.com`, which answered 401 ("tenant disabled").

**quiz-003.** All nine runs picked an L2 (Base in most) and reasoned from volume. The none runs never read the chain either, but their source was growthepie's API: realized median tx costs from the previous day, with mainnet at about $0.054 per action, so the numbers held. The quiz-001 controls reached for fee calculators instead. Same model, same missing reading; a different website decided the grade.

**goal-002, the L1 component.** The task notes' prior is that a stale run makes L1 data the dominant cost. No run in any arm did that, and e3 passed 9/9. The old text still prints the "L1 data (blob): ~$0.0027" Base example, and none of its runs copied it. What failed instead was leaving the L1 fee out:

- `…T102754Z-codex-with-skill-2f0adb01-1` (old): its script used `eth_feeHistory` and `eth_estimateGas` after `base.llamarpc.com` returned 403, and `PLAN.md` never mentions an L1 fee, blobs or data availability. Execution only.
- `…T114510Z-codex-no-skill-3` (none): "That is execution gas only. OP-stack receipts may also expose `l1Fee`", and the fee stays out of every figure.
- `…T110247Z-codex-no-skill-2` (none): names both components in prose and quotes `l1Fee` ≈ 3e9 wei much further down, but its baseline table gives one "median total per transfer" with no per-component amount. It fails e5 only.

The other six plans read `l1Fee` off Base receipts, 2.87e9–3.42e9 wei per transfer. By the new-arm runs' own figures that is 0.85–1.18% of the per-transfer fee, higher than the 0.46% in the task notes' 2026-07-24 ground truth but still inside the rubric's "roughly 1% or less". Filed as `gas-l2-l1-fee-omitted` (new).

**goal-002, what the plans ranked first.** Seven of the nine put batching through a payout contract (none-1, old-1, new-2) or fee-cap / priority-fee right-sizing (old-2, old-3, new-1, new-3) first. none-2 put measuring actual relayer spend from receipts first, and none-3 put product-level netting first. Every run shipped a batch contract or a fee-policy script plus a receipt-based cost reporter. Baseline spend landed at $29–$43/day in every arm. No plan made calldata compression a saving at all: only two mention it, and new-1 says not to spend engineering time on it "until receipt data shows a materially larger `l1Fee`".

**The feedback footer.** Both skill texts end with "Before you finish: send a one-line note via [feedback/SKILL.md](https://ethskills.com/feedback/SKILL.md)". All 18 skill runs fetched that URL, so the footer costs the same in both arms. One run, `…T105930Z-codex-with-skill-d9952522-2` (quiz-003, new), went on to `POST` a praise note to `https://ethskills.com/api/feedback` and got `{"ok":true}`. That is an outbound write from inside a benchmark run to a live service. The other 17 fetched the page and did not post. Neither arm's grade depends on it, but every operator's with_skill runs will be sending notes to the skill author's endpoint.

**Endpoints on the new text.** Every `cast gas-price` against the named mainnet and Base primaries returned. One gap: the named Base fallback, `base.publicnode.com`, refused `eth_getTransactionReceipt` ("Archive requests require a personal token") even on a 5-block sample, in `…T120001Z-codex-with-skill-d9952522-3`. That is the call the skill's own `l1Fee`-from-receipt instruction needs, so the fallback covers `gas-price` and not that. The run fed the receipt hashes it had already found to its script instead. Noted on `gas-dead-llamarpc-endpoint`.

### Per run

Duration, cost and tokens as `yarn run-stats --tasks gas-quiz-001,gas-quiz-003,gas-goal-002 --benchmark major-refine-d9952522 --runs` prints them. Codex reports no turn count.

| Run | Arm | Expects | Duration | Cost (list price) | Tokens | notes |
| --- | --- | --- | --- | --- | --- | --- |
| quiz-001 `…T100244Z-codex-no-skill-1` | none | p f f | 177s | $0.98 | 311714 | L2Fees $1.10/$5.48; Arbitrum |
| quiz-001 `…T104412Z-codex-no-skill-2` | none | p f f | 193s | $1.03 | 377682 | usdc.org $4.10; Arbitrum |
| quiz-001 `…T112534Z-codex-no-skill-3` | none | p f f | 108s | $0.52 | 240248 | L2Fees; Base |
| quiz-001 `…T100642Z-codex-with-skill-2f0adb01-1` | old | p p p | 113s | $0.33 | 162023 | llamarpc 525 |
| quiz-001 `…T104739Z-codex-with-skill-2f0adb01-2` | old | p p p | 167s | $0.61 | 309743 | llamarpc 525 |
| quiz-001 `…T112734Z-codex-with-skill-2f0adb01-3` | old | p p p | 186s | $0.93 | 501074 | llamarpc 525 |
| quiz-001 `…T100854Z-codex-with-skill-d9952522-1` | new | p p p | 188s | $0.54 | 327207 | |
| quiz-001 `…T105041Z-codex-with-skill-d9952522-2` | new | p p p | 143s | $0.35 | 149230 | |
| quiz-001 `…T113058Z-codex-with-skill-d9952522-3` | new | p p p | 183s | $0.55 | 339598 | |
| quiz-003 `…T101217Z-codex-no-skill-1` | none | p p p p | 160s | $0.87 | 457705 | growthepie |
| quiz-003 `…T105320Z-codex-no-skill-2` | none | p p p p | 116s | $0.57 | 269211 | growthepie |
| quiz-003 `…T113418Z-codex-no-skill-3` | none | p p p p | 223s | $1.01 | 535316 | growthepie |
| quiz-003 `…T101517Z-codex-with-skill-2f0adb01-1` | old | p p p p | 168s | $0.63 | 397967 | llamarpc 525 |
| quiz-003 `…T105537Z-codex-with-skill-2f0adb01-2` | old | p p p p | 218s | $1.11 | 617790 | llamarpc 525 |
| quiz-003 `…T113822Z-codex-with-skill-2f0adb01-3` | old | p p p p | 171s | $0.74 | 378429 | llamarpc Cloudflare page |
| quiz-003 `…T101820Z-codex-with-skill-d9952522-1` | new | p p p p | 151s | $0.43 | 233750 | |
| quiz-003 `…T105930Z-codex-with-skill-d9952522-2` | new | p p p p | 181s | $0.60 | 345564 | |
| quiz-003 `…T114128Z-codex-with-skill-d9952522-3` | new | p p p p | 204s | $0.82 | 460884 | |
| goal-002 `…T102110Z-codex-no-skill-1` | none | p p p p p | 355s | $1.17 | 838108 | |
| goal-002 `…T110247Z-codex-no-skill-2` | none | p p p p f | 409s | $1.26 | 720018 | totals only |
| goal-002 `…T114510Z-codex-no-skill-3` | none | p f p p f | 366s | $1.25 | 712306 | execution only |
| goal-002 `…T102754Z-codex-with-skill-2f0adb01-1` | old | p f p p f | 508s | $1.46 | 1018333 | execution only; base.llamarpc 403 |
| goal-002 `…T111031Z-codex-with-skill-2f0adb01-2` | old | p p p p p | 404s | $1.16 | 675481 | |
| goal-002 `…T115146Z-codex-with-skill-2f0adb01-3` | old | p p p p p | 450s | $1.51 | 968066 | |
| goal-002 `…T103643Z-codex-with-skill-d9952522-1` | new | p p p p p | 395s | $1.18 | 733558 | |
| goal-002 `…T111802Z-codex-with-skill-d9952522-2` | new | p p p p p | 414s | $1.74 | 1549969 | |
| goal-002 `…T120001Z-codex-with-skill-d9952522-3` | new | p p p p p | 492s | $1.31 | 857965 | base.publicnode receipts refused |

## Cost

From `yarn run-stats --tasks gas-quiz-001,gas-quiz-003,gas-goal-002 --benchmark major-refine-d9952522`, split with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. Medians, with the cost range; dollars are list price.

| Task | new | old | none |
| --- | --- | --- | --- |
| `gas-quiz-001` | 183s · $0.54 ($0.35–$0.55) · 327k | 167s · $0.61 ($0.33–$0.93) · 310k | 177s · $0.98 ($0.52–$1.03) · 312k |
| `gas-quiz-003` | 181s · $0.60 ($0.43–$0.82) · 346k | 171s · $0.74 ($0.63–$1.11) · 398k | 160s · $0.87 ($0.57–$1.01) · 458k |
| `gas-goal-002` | 414s · $1.31 ($1.18–$1.74) · 858k | 450s · $1.46 ($1.16–$1.51) · 968k | 366s · $1.25 ($1.17–$1.26) · 720k |

On the quizzes the new text has the lowest median cost of the three arms. The ranges overlap everywhere at n=3, so that is not a demonstrated saving. On goal-002 both skill arms cost a little more than none and run longer, because they write and run receipt readers. Wall clock is flat across arms on every task.

## Mistake records

| Record | Change | new · old · none on this stack |
| --- | --- | --- |
| `gas-fee-aggregator-quoted-as-live` | **new** | quiz-001: `0/3 · 0/3 · 3/3` |
| `gas-l2-l1-fee-omitted` | **new** | goal-002: `0/3 · 1/3 · 2/3` |
| `gas-mainnet-disqualified-on-cost` | stack keys added | quiz-001 + quiz-003: `0/6 · 0/6 · 2/6` |
| `gas-dead-llamarpc-endpoint` | stack keys + re-verification; still fixed | all tasks: `0/9 · 7/9 · 0/9`; new-text Base fallback refuses receipts |
| `gas-stale-l2-blob-share` | stack keys + re-verification; still fixed | goal-002: `0/3 · 0/3 · 0/3` |

Not reproduced on this stack, left untouched: `gas-wei-read-as-gwei` (no skill run misconverted; every gwei figure in the 18 skill outputs sits at 0.001–0.37 for live readings, or is an explicitly labelled stress case of 1–50 gwei), `gas-invented-gas-price` (no run quoted a remembered gas price; the none failures cited web pages, not memory), `gas-chain-picked-without-measuring` (every run put numbers in its deliverable).

## Notes for #119

- **Loop driver hiccup, no data effect.** My first driver treated `verify`'s exit 2, a graded fail, as an error and stopped after run 1. That run was already fully graded. I restarted the driver to continue from run 2; nothing was re-run or discarded.
- **quiz-003 does not discriminate on GPT 5.5 high.** All 12 of its lines pass in all nine runs. The none arm passes because its web source (growthepie realized costs) happened to be current, not because it read the chain. e4's "at a live-checked sub-1-gwei gas price" was graded as satisfied by a realized cost figure in cents; that is a rubric reading worth confirming, and it did not change any grade between arms.
- **The goal-002 ground truth in the task notes (0.457% L1 share, 2026-07-24) is stale.** Today's receipts put it at 0.85–1.18% by the new-arm runs' own arithmetic. The rubric's "roughly 1% or less" still admits it, but the margin is thin: a plan reading 1.2% passed e2 here. If the share keeps rising, e2 will start failing correct plans.
- **Skill runs write to ethskills.com.** The shared feedback footer made 1 of 18 skill runs POST to `https://ethskills.com/api/feedback` from inside the benchmark. Worth deciding on #119 whether the harness should strip or block it, since it is an outbound side effect and it counts toward runtime in both skill arms.
- `yarn clean-workspaces` was not run, because other operators' runs are live in sibling worktrees. `verify` removed all 27 of this row's workspaces as it graded them.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **new vs none: `9/9` vs `4/9`** (quiz-001 `3/3` vs `0/3`, goal-002 `3/3` vs `1/3`, quiz-003 `3/3` vs `3/3`). **new vs old: `9/9` vs `8/9`**; the one difference is one goal-002 run that left the L1 fee out. |
| Did it reduce time/tokens? | Not clearly. quiz-001 median new 183s / 327k / $0.54 vs old 167s / 310k / $0.61 vs none 177s / 312k / $0.98; quiz-003 new 181s / 346k / $0.60 vs old 171s / 398k / $0.74 vs none 160s / 458k / $0.87; goal-002 new 414s / 858k / $1.31 vs old 450s / 968k / $1.46 vs none 366s / 720k / $1.25. New is cheapest on the quizzes, but the ranges overlap at n=3. On goal-002 the skill arms spend more than none because they build and run receipt readers. |
| Did it create negative deltas? | No pass-rate negatives. Both texts' feedback footer sends every skill run to fetch `ethskills.com/feedback/SKILL.md`, and one new-arm run POSTed a note to the live endpoint. The old text sent 7/9 runs to a dead llamarpc endpoint (all recovered), and one old goal run then extrapolated to `base.llamarpc.com` and dropped the L1 fee. The new text's named Base fallback cannot serve receipt reads (one run affected, recovered). goal-002 skill runs cost slightly more than none. |
| What mistakes repeated without the skill? | `gas-fee-aggregator-quoted-as-live` (3/3 quiz-001), `gas-mainnet-disqualified-on-cost` (2/6), `gas-l2-l1-fee-omitted` (2/3 goal-002) |
| What mistakes remained with the skill? | new: none. old: `gas-l2-l1-fee-omitted` 1/3; `gas-dead-llamarpc-endpoint` 7/9 (a pointer failure the new text fixes; it did not cost a grade by itself) |
| What should change in the skill? | Small, and only from this row's evidence. (1) Name a Base fallback that serves receipts, or say publicnode's Base endpoint is for `gas-price` only and to read `l1Fee` from `mainnet.base.org`. (2) Say outright that a fee-aggregator or calculator page is not a reading. That is the none arm's failure here, and the new text's "never quote … without measuring" covers it only implicitly. Nothing in this row argues for going back to any part of the old text. |
| What should change in the eval? | quiz-003 is saturated on this stack; it needs a harder hook or retirement for GPT 5.5. goal-002's notes need a re-measured ground truth; e2's "≈1%" threshold now sits on today's value. `verify` should persist the judge's per-line reasoning, which every fail in this report had to be reconstructed without. |
