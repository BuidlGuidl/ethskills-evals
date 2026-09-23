# major-refine: concepts (GLM 5.3 high)

- **Benchmark:** `major-refine-d9952522`, the concepts row of the GLM 5.3 high column of [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)
- **Executor:** `opencode` · `openrouter/z-ai/glm-5.3` · effort `high`, passed on argv for every run. Models catalog pinned at `9eb2ba682cd6` for all 27 runs. OpenRouter picks a provider per request, so "same model" means the same name, not the same weights (AGENTS.md).
- **Judge:** `claude` · `claude-opus-5` · effort `high`, the same for every run. No run is self-judged (`self_judged: false` on all 27).
- **Arms:** none (`no_skill`) · old (`with_skill`, `skill_version: 2f0adb01`, the 230-line vendored text) · new (`with_skill`, `skill_version: d9952522`, the 42-line refined text). Trigger-inclusive: the trigger was not forced.
- **Runs:** 3 per arm per task, interleaved none → old → new within each run number, one executor at a time. 27 graded runs.
- **Tasks:** `concepts-quiz-001` (same-evening raffle randomness), `concepts-quiz-002` (harvest-incentive vault), `concepts-goal-001` (onchain subscription billing, bare workspace). These are every live task with `skill: skills/concepts`.
- **Date:** 2026-09-23

## Headline: new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| concepts-quiz-001 | 3/3 | 3/3 | 3/3 |
| concepts-quiz-002 | 3/3 | 1/3 | 1/3 |
| concepts-goal-001 | 3/3 | 0/3 | 0/3 |
| **total** | **9/9** | **4/9** | **4/9** |

The refined text passes every run. On this stack the old text scores the same as no skill, 4/9 each. It fixes one check that no skill fails (goal-001 e6) and nothing else.

**The skill triggered on every with_skill run.** All 18 with_skill transcripts open with opencode's `skill` tool call (`{"name":"concepts"}`), loading the skill before reading `TASK.md`. So the old-vs-new gap is a difference in content, not in triggering.

## Per-check failures

| Task · line | new | old | none | What fails |
| --- | --- | --- | --- | --- |
| goal-001 e7 (what survives the operator) | 0/3 | 3/3 | 3/3 | NOTES.md never names the weather API and the per-request check as the half that dies with the operator |
| goal-001 e6 (what is public) | 0/3 | 0/3 | 3/3 | No-skill NOTES.md never says that anyone can read who subscribes to which plan |
| quiz-002 e1 (fee vs gas, as figures) | 0/3 | 2/3 | 2/3 | A per-call gas figure and a dollar band, with no gas price or ETH price behind them |

Every other line passed in every run. Notes on the lines above:

- **goal-001 is where the refinement shows.** Every run passes e1–e5 in all three arms. All nine chose Foundry and a design where a customer cancels and withdraws on their own. None made the monthly charge depend on an operator-only transaction. GLM 5.3 does not hold the "charged monthly means a cron" prior this skill corrects first. What separates the arms is the end-of-build CROPS write-up:
  - The new-text runs all wrote a "What this design gives up" section. It names what dies with the operator: "What dies with you is everything offchain: the weather API itself, the frontend…" (run 1); "Your API, domain and any frontend would not survive you — that's the half that dies" (run 2).
  - The old-text runs state the privacy trade-off (e6 3/3) but not the split.
  - Old run 2 and none run 3 are near misses: each says the contract survives the operator ("customers can still cancel and self-refund forever… This contract runs fine without you") and stops there.
- **quiz-002 e1 tracks whether the run fetched prices.**
  - **New arm, 3/3.** All three new-text runs went and got both prices, as the new text's third question asks. New run 2 called `eth_gasPrice` on a public RPC (1.29 gwei) and CoinGecko ($2,665.92). New runs 1 and 3 searched the web.
  - **Old arm, 0/3.** No old-text run fetched anything.
  - **None arm, 1/3.** One no-skill run searched, and it passed.
  - **The failures.** All four state a gas amount and a dollar cost ("~300–500k gas → $2–20 per call at typical gas prices") with neither input written down.
  - **Old run 3.** It passed on remembered inputs, "3–15 gwei, ETH $2,500–3,500", 2–12× the live gas price. That is the failure in `concepts-gas-price-from-memory`. expect_1 accepts any stated price, so this pass is on the rubric as written.
  - **Verdicts.** All nine runs reach the right verdict: the 1% fee never covers gas, so nobody calls harvest. e2–e4 pass 9/9.
- **quiz-001 is saturated on this stack.** 9/9, all three arms. Every run chose a commit-reveal or blockhash design with no paid provider, as the treasury constraint asks. The new-text runs are the only ones that name the EIP-2935 8191-block window (3/3 against 0/6). Where the old runs carry no bond, they pin the seed block after reveals close, so no single absence moves the winner. No grading inconsistency stood out on the lines that were checked.

## Cost (from `yarn run-stats`)

`cost_source: executor`: opencode's own arithmetic on models.dev's list price, not OpenRouter's bill. Tokens are `total_tokens`. Medians per arm, with the cost range across the three runs:

| Task | Arm | Turns | Duration | Cost (range) | Tokens |
| --- | --- | --- | --- | --- | --- |
| concepts-quiz-001 | new | 5 | 148s | $0.16 ($0.12–$0.16) | 143,420 |
| | old | 4 | 155s | $0.15 ($0.11–$0.15) | 83,383 |
| | none | 4 | 142s | $0.11 ($0.10–$0.13) | 82,217 |
| concepts-quiz-002 | new | 5 | 79s | $0.09 ($0.08–$0.14) | 103,612 |
| | old | 4 | 30s | $0.04 ($0.04–$0.07) | 60,440 |
| | none | 4 | 50s | $0.07 ($0.04–$0.07) | 63,959 |
| concepts-goal-001 | new | 31 | 285s | $0.54 ($0.40–$0.77) | 1,309,608 |
| | old | 46 | 762s | $1.57 ($0.27–$2.05) | 3,804,371 |
| | none | 47 | 490s | $1.38 ($1.10–$1.56) | 4,017,139 |

- **Goal task: the new text is cheaper than no skill, with no overlap.** $0.40–$0.77 against $1.10–$1.56, and 1.3M tokens against 4.0M, for 3/3 against 0/3.
  - The old arm's range covers both. Old run 2 was the cheapest run of the nine ($0.27, 158s, 21 turns). Old runs 1 and 3 were the dearest ($2.05; $1.57 over 1,395s).
- **Quizzes: the new text costs a little more.** It spends about a cent or a few cents more per quiz, and 40–70k more tokens, than either other arm.
  - On quiz-002 that extra is the price lookups that decide e1.
  - Every quiz run costs under $0.20.

## Discarded and harness notes

- **No run discarded.** All 27 runs have `executor_exit: 0`. `--grade-failed-run` and `--allow-skill-mention` were never used, and nothing is retracted or regraded.
- **The orchestrator's loop shell died at about 14:52**, while `concepts-quiz-002/2026-09-23T145225Z-opencode-with-skill-d9952522-2` was running. Two sibling orchestrators on the box lost their shells at the same moment. The executor itself finished cleanly (`finished:` set, exit 0), so I graded it with the usual `verify` command and restarted the loop under `setsid`. The result is a normal first grade; nothing was re-run.
- **Two `verify` calls failed in the judge before writing a grade.** No executor was affected.
  - `concepts-goal-001/…151740Z-…-2f0adb01-1` failed with "judge output was not strict JSON".
  - `…153221Z-…-d9952522-1` failed with "judge exited non-zero" when the claude usage limit was hit.
  - Both workspaces were still intact. Each was graded by re-running the same `verify` command once the judge was available, and each `result.yaml` is its only grade.
- **Evidence is committed.** Every run's `output/` is force-added: `answer.md` for the quizzes, and 7–13 source files (64–100K) per goal run. Every grade here can be re-checked and regraded from a clone.
- **Workspaces:** `yarn clean-workspaces` was not run, because other operators' runs are live in sibling worktrees. `verify` removed this row's 27 workspaces as it graded them, and none is left on disk.

## Mistake records

All three are new files, suffixed with this stack, beside the claude-era records and matching the codex and kimi-k3 rows:

- `concepts-forkability-stops-at-verified-contracts-glm-5.3-high`: goal e7, none 3/3 · old 3/3 · new 0/3. Status `fixed` for the new text. It answers the parent record's "reopen if expect_7 fails on any other stack": it fails here only without the new text, the same as on codex and kimi-k3.
- `concepts-subscriber-privacy-unstated-glm-5.3-high`: goal e6, none 3/3 · both skill texts 0/3. Closed on this stack. This is the base rate the claude record said it needed.
- `concepts-harvest-incentive-unpriced-glm-5.3-high`: quiz-002 e1, none 2/3 · old 2/3 · new 0/3. Left `open`, because the same text still misses 2/3 on kimi-k3.

The old-arm pass on remembered prices is the pattern in `concepts-gas-price-from-memory`. It is cited in the record above rather than edited into the claude-era file.

## Summary

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **New vs none: yes, `9/9` vs `4/9`**. Per task: quiz-001 `3/3` vs `3/3`, quiz-002 `3/3` vs `1/3`, goal-001 `3/3` vs `0/3`. **New vs old: yes, `9/9` vs `4/9`**. The old text did no better than no skill on this stack (`4/9` vs `4/9`). |
| Did it reduce time/tokens? | **Goal task: yes, against both.** New vs none is `285s / 1.31M / $0.54` vs `490s / 4.02M / $1.38`, with non-overlapping cost ranges. New vs old is `285s / 1.31M / $0.54` vs `762s / 3.80M / $1.57`, with the old range ($0.27–$2.05) overlapping. **Quizzes: no.** The new text spends slightly more: quiz-001 `148s / 143k` vs `142s / 82k` none; quiz-002 `79s / 104k` vs `50s / 64k` none, `30s / 60k` old. Every quiz run costs under $0.20. |
| Did it create negative deltas? | **New:** none in pass rate. It costs ~40–70k more tokens per quiz, which on quiz-002 is the price lookups the line needs. **Old:** no check where it is worse than none. |
| What mistakes repeated without the skill? | `concepts-forkability-stops-at-verified-contracts-glm-5.3-high` (3/3), `concepts-subscriber-privacy-unstated-glm-5.3-high` (3/3), `concepts-harvest-incentive-unpriced-glm-5.3-high` (2/3) |
| What mistakes remained with the skill? | **New:** none. **Old:** `concepts-forkability-stops-at-verified-contracts-glm-5.3-high` (3/3) and `concepts-harvest-incentive-unpriced-glm-5.3-high` (2/3). Old run 3 also priced from memory (`concepts-gas-price-from-memory`) and passed. |
| What should change in the skill? | **Nothing on this evidence.** The new text passes 9/9 on GLM 5.3. The benchmark supports the old→new rewrite on the two lines the rewrite targeted: the end-of-build "could someone else run it?" question (goal e7: old 3/3 fail → new 0/3) and "the gas price and ETH price the target chain shows today" (3/3 new runs fetched both, 0/3 old). |
| What should change in the eval? | **(1)** quiz-001 does not separate the arms on this stack (9/9), and neither did goal-001 e1–e5 (27/27 passes across the nine runs), so on GLM 5.3 this benchmark measures the CROPS write-up and the price comparison only. **(2)** quiz-002 e1 accepts any stated prices, so old run 3 passes on a remembered 3–15 gwei when mainnet was at ~1.3 gwei. If the source of the prices matters, the line has to say so (as the codex and kimi-k3 rows also note). **(3)** Harness: a judge failure ("not strict JSON", or a usage limit) stops `verify` with exit 1 and no grade. It cost two manual regrades here and is safe, but a retry inside `verify` would save the operator a step. |
