# eval: minimal gas (codex)

**Skill:** `skills/gas` at `2bd2e9e` (36 lines, 256 words)

**Tasks:** `gas-goal-001`, then `gas-goal-002` · **Executor:** codex, CLI default model · **Judge:** codex, CLI default model · **Runs:** 3 per variant per task
**Date:** 2026-08-10 · **Trigger:** content-only

All runs are recorded `self_judged: true` because the harness sets that flag whenever executor and judge use the same agent. Each judgment still ran blind in a fresh Codex process. No model was pinned in the local Codex configuration, so these results must not be blended with the earlier Claude/Opus benchmark.

## Results

| Task | `no_skill` | `with_skill` | Read |
| --- | ---: | ---: | --- |
| `gas-goal-001` | **1/3** | **0/3** | The raw result is dominated by an overbroad expect line; it is not evidence that the skill caused the stale behavior. |
| `gas-goal-002` | **0/3** | **2/3** | Positive delta. The skill prevented the pre-Dencun L1-data prior and prompted live measurement. |

## gas-goal-001: chain choice as a side effect

The control arm produced one full pass. One other control chose Base but left the configured network too generic for expect 1; the remaining control's created files were hidden from the judge by its workspace ignore rules, so its snapshot did not contain the deliverable. None of the three control runs repeated the old tens-of-gwei fee override, but only one satisfied the entire grading surface.

All three skill-assisted runs made the intended decision correctly:

- measured Ethereum and Base fees live;
- described Ethereum mainnet as viable for this low-frequency, high-value escrow;
- chose Base for workload or ecosystem reasons, not because mainnet was prohibitively expensive;
- omitted stale fee overrides.

They nevertheless failed expect 3 because each README included a fresh dollar estimate while explaining the comparison. The check says the README must not “quote dollars-per-transaction gas costs, to justify avoiding” mainnet. The outputs quoted current, very small costs and explicitly did **not** use them to rule mainnet out. Examples included an approximately $0.20 mainnet deployment and approximately $0.03 mainnet lifecycle operation. Penalizing those measurements is opposite to the skill's core instruction to measure before making a chain-cost claim.

This expect should be narrowed to the actual stale tell:

> The setup or README does not use an unchecked or materially inflated gas-cost estimate to characterize mainnet as prohibitively expensive or rule it out. Fresh, sourced cost comparisons pass when they acknowledge mainnet remains viable.

Until that change is made, the raw 0/3 skilled score is not a valid negative delta. The skill-assisted artifacts satisfy the behavior the task notes say the eval is meant to test.

Token use moved in the wrong direction: the controls averaged about 34.3k tokens and skilled runs about 67.5k. The added context is only 256 words, so the difference came from executor behavior: skilled runs performed substantially more live research and validation. The skill may need a proportionality sentence, but three runs are weak evidence for a content change.

## gas-goal-002: current Base fee composition

The skill produced a real correctness improvement: **2/3 with skill versus 0/3 without it**.

Two controls repeated the stale prior the skill is designed to correct. One said Base's L1 data fee is “typically the larger component”; another said it is “usually larger” and ranked packed calldata immediately after batching. Both also declined to calculate a complete current per-transfer and daily/monthly dollar baseline because no production receipt export was supplied. The third control measured live values and correctly found L1 data small, but omitted the explicit per-transfer figure required by expect 1.

Every skilled run checked current Base fees or receipts and a live ETH price. All three put L1 data below 1%, rejected calldata compression as a leading optimization, and ranked recommendations by savings. Two passed every check.

The remaining skilled run failed expect 2 because its prose contains an internally inconsistent unit presentation: it reports a median total receipt fee of 354.5 million wei and an L1 fee of 852 million wei while calling the latter 0.24% of the total. Its conclusion and percentage are directionally correct, but the displayed magnitudes cannot both be true. This is a run-level arithmetic/presentation error, not a missing concept in the skill; the other two skilled runs did not repeat it.

Token use was effectively flat: about 57.2k per control and 58.4k per skilled run. Duration and USD cost were not recorded in a comparable machine-readable form, so no claim is made about them.

## Skill verdict

The minimal skill keeps the instructions that matter:

- measure current chain fees and ETH/USD instead of trusting priors;
- keep mainnet viable for low-frequency, high-value actions;
- derive fee fields on the target chain rather than hardcoding them;
- inspect current L2 receipts and `l1Fee` before deciding what dominates.

`gas-goal-002` directly validates the last point. `gas-goal-001` artifacts validate the first two despite the raw judge result. Nothing in these runs justifies restoring the larger reference tables, historical fee explanations, wallet snippets, or hardcoded cost examples removed from the skill.

One possible addition is a single proportionality guardrail: “Measure only as deeply as the decision requires; a live fee quote is enough unless the task asks for a full cost study.” The goal-001 token delta suggests it, but this benchmark does not establish that it will reliably reduce work, so it should be tested rather than added on this evidence alone.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `gas-goal-001`: raw **0/3 vs 1/3**, but invalidated by overbroad expect 3. `gas-goal-002`: **2/3 vs 0/3**. |
| Did it reduce time/tokens? | No on tokens: goal 1 ~67.5k vs ~34.3k; goal 2 ~58.4k vs ~57.2k. Comparable duration data was unavailable. |
| Did it create negative deltas? | More research/token use on goal 1. No demonstrated correctness regression; the raw pass-rate delta is a grading-surface artifact. |
| What mistakes repeated without the skill? | `gas-stale-l2-blob-share` in 2/3 goal-002 controls. The old mainnet-cost mistake did not cleanly recur in this small Codex sample. |
| What mistakes remained with the skill? | One internally inconsistent fee-magnitude presentation in goal 2; no stale L1-share or mainnet-cost conclusion. |
| What should change in the skill? | Keep it minimal. Consider testing one proportionality sentence before adding it; do not restore removed reference material. |
| What should change in the eval? | Rewrite goal-001 expect 3 to allow fresh, sourced cost comparisons that keep mainnet viable. Add an arithmetic-consistency check to goal 2 if magnitude integrity is intended to be graded. |
