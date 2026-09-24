# Protocol major-refine — GPT 5.5 high

Benchmark: `major-refine-d9952522` (#119). Executor: `codex`, `gpt-5.5`, effort `high`. Judge: `claude`, `claude-opus-5`, effort `high`, fresh and blind through `yarn verify`. `self_judged: false`. Three runs per arm per task, 18 graded runs. Tasks: `protocol-quiz-001` and `protocol-goal-001` (every live protocol task).

Arms: new `d9952522`, old `2f0adb01`, none. Both skill refs were passed in full to setup. Runs execute sequentially, interleaving none → old → new within each repetition. Skill triggering is left to the executor. No task, expectation, template, harness, or skill text was changed. Node was v24.21.0; the pinned checkout and benchmark-skill checks passed. No templates or dependency installs were needed.

## Scheduling revalidation

Checked on 2026-09-23. The [EIP-7864 specification](https://eips.ethereum.org/EIPS/eip-7864) is Draft, and [its Forkcast record](https://forkcast.org/api/eips/7864.json) has an empty `forkRelationships` array. These were checked before the first completed execution. The [Glamsterdam meta-EIP](https://eips.ethereum.org/EIPS/eip-7773) and [Hegotá meta-EIP](https://eips.ethereum.org/EIPS/eip-8081), checked during the first repetition, schedule no binary-tree migration. Hegotá now lists FOCIL and Frame Transaction as SFI; its scope has changed since the earlier protocol report. The task's scheduling premise remains applicable. This revalidation was not given to executors or substituted for blind grading.

## Harness incident

Discarded quiz none-1 `2026-09-23T071749Z-codex-no-skill-1`: the detached process disappeared when the launching tool session closed. `executor.yaml` remained `finished: null`; its raw capture contained only thread/turn startup events and no task work. It was not graded. Only that run directory and its own workspace were deleted. Replacement: `2026-09-23T072020Z-codex-no-skill-1`.

Subsequent launches retain the prescribed `nohup` executor and keep the supervising session open until it exits; the local orchestration wrapper calls only the existing setup/executor/verify scripts and stops on harness failures. Initial sandbox refusals for git metadata and tsx IPC were retried with approved escalation before any executor work. No benchmark code was patched, no failure was graded over, and no shared workspace sweep was run.

## Recorded results

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | ---: | ---: | ---: |
| protocol-quiz-001 | 3/3 | 3/3 | 3/3 |
| protocol-goal-001 | 3/3 | 3/3 | 2/3 |
| Total | 6/6 | 6/6 | 5/6 |

Every retained executor finished with exit 0. All 81 individual checks passed except goal none-2 `expect_1`. The input/expect fingerprints are identical across arms within each task: quiz `3e5de462c7bd` / `0b5b790caadc`; goal `bf6d1a188b62` / `9a51e31374ff`. These are original grades, with no regrades, overrides, or retractions. `verify` removed all 18 owned workspaces. All answer/brief snapshots are included in the commit.

The quiz is saturated on this stack. The recorded goal advantage is one run at n=3, and the grading question below limits the claim: the refinement does not show a reliable correctness improvement over the old text, and its apparent advantage over none should not be read without the evidence caveat.

## The failed check and the grading question

[Goal none-2](../artifacts/protocol-goal-001/2026-09-23T075844Z-codex-no-skill-2/output/brief.md) has a section headed “Strategic But Not Bankable: Verkle/Binary Trees and Statelessness.” It repeats the older Verkle roadmap's smaller-witness case and calls binary trees “alternate/new trie designs,” without explaining that binary trees superseded the Verkle direction. The judge failed `expect_1`. It passed the other four checks: the brief does not budget on Verkle landing, separates history from state, and gives a concrete client/hardware plan. The failure is stale architectural framing, not reckless capacity budgeting.

Two refined-arm passes raise a related question:

- [Goal new-1](../artifacts/protocol-goal-001/2026-09-23T075442Z-codex-with-skill-d9952522-1/output/brief.md) labels Verkle Stagnant/no fork and separately calls binary variants the likely direction, but never clearly states Verkle was deprioritized in favor of binary trees or gives that switch's rationale.
- [Goal new-2](../artifacts/protocol-goal-001/2026-09-23T080735Z-codex-with-skill-d9952522-2/output/brief.md) says “Treat Verkle/statelessness/state expiry as strategically important,” calls Verkle Stagnant and unscheduled, and rejects budget savings, but **never mentions binary trees**.

The pinned goal `expect_1` says that if Verkle is mentioned, it must be framed as deprioritized in favor of binary trees, not merely unscheduled. These two passes appear to apply the safe-budget part more leniently than the architectural-framing part. The records above retain the judge's actual verdicts. No expect was edited, no run was selectively regraded, and #119 was not edited. The reviewer should raise this rubric/application question before treating 3/3 versus 2/3 as an established skill benefit.

The observation is recorded in [protocol-verkle-not-clearly-superseded](../mistakes/protocol/protocol-verkle-not-clearly-superseded.yaml), with manual observation frequencies separated explicitly from judge failures.

## Cost, time, and tokens

All figures below come from `yarn run-stats`; durations and tokens are medians, costs include median and observed range. Codex prices are **list-price estimates**, not billed spend, and exclude the long-context surcharge noted by the harness. Tokens are `total_tokens`, including cached input. Turn counts are not reported by this Codex harness.

| Task | Arm | n | Median duration | Median total tokens | Median cost | Cost range |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| quiz | new | 3 | 147s | 895754 | $1.07 | $0.80–$1.69 |
| quiz | old | 3 | 138s | 442491 | $1.04 | $0.86–$1.08 |
| quiz | none | 3 | 112s | 275285 | $0.86 | $0.53–$0.87 |
| goal | new | 3 | 220s | 855768 | $1.46 | $1.42–$1.56 |
| goal | old | 3 | 221s | 690054 | $1.55 | $1.33–$1.65 |
| goal | none | 3 | 215s | 504812 | $1.30 | $1.21–$1.45 |

The refinement increases median tokens on both tasks versus old and none. Quiz cost and time also rise; goal median cost is slightly lower than old and higher than none, with overlapping ranges. Goal duration is effectively unchanged across arms. A shorter skill did not produce a cheaper research process here. All runs were sequential on the same shared host; wall-clock comparisons still include service/network variability, and n=3 is weak evidence.

Reproduce the three columns with:

```bash
yarn run-stats --tasks protocol-quiz-001,protocol-goal-001 --benchmark major-refine-d9952522 --variant no_skill --runs
yarn run-stats --tasks protocol-quiz-001,protocol-goal-001 --benchmark major-refine-d9952522 --skill-version 2f0adb01 --runs
yarn run-stats --tasks protocol-quiz-001,protocol-goal-001 --benchmark major-refine-d9952522 --skill-version d9952522 --runs
```

## Trigger and source audit

Both skill arms read their installed `protocol/SKILL.md` in all six runs each, without a forced trigger. Every run used web search; none was purely an answer from memory. Verkle appeared in every deliverable. Source actions below are mined from committed `transcript.md`, not raw captures or the mere presence of a citation. The renderer abbreviates long commands and outputs, so these are visible actions, not a claim that every cited source was fetched or every fetched page was fully read.

All six refined runs queried Forkcast JSON directly, compared with two old runs (quiz-3 and goal-3) and zero none runs. All six old runs attempted Forkcast-oriented web searches; only none goal-1 did so unaided. An explicit fork meta-EIP fetch is visible in old goal-2 (`7773`); most other scope checks used Forkcast records or roadmap pages instead.

Five refined runs and one old run initially treated an object-wrapped Forkcast response as a top-level array, causing `jq` exit-5 errors before recovering. See [protocol-forkcast-json-envelope-assumed](../mistakes/protocol/protocol-forkcast-json-envelope-assumed.yaml). These are query/schema mistakes in functioning executors, not network outages; all affected runs completed and were graded normally. More source retrieval and these retries coexist with the higher token totals, but this experiment does not isolate their causal cost.

| Task / arm / repetition | Run and transcript | Grade | Visible source path |
| --- | --- | --- | --- |
| quiz-001 / none / 1 | [2026-09-23T072020Z-codex-no-skill-1](../artifacts/protocol-quiz-001/2026-09-23T072020Z-codex-no-skill-1/transcript.md) | pass | Web search: EF priorities, EIP-7864/1186/8297; no visible fork-scope fetch. |
| quiz-001 / old / 1 | [2026-09-23T072236Z-codex-with-skill-2f0adb01-1](../artifacts/protocol-quiz-001/2026-09-23T072236Z-codex-with-skill-2f0adb01-1/transcript.md) | pass | Forkcast searches/pages, EIP-6800/1186/7864 search, EF priorities and research overview. |
| quiz-001 / new / 1 | [2026-09-23T072509Z-codex-with-skill-d9952522-1](../artifacts/protocol-quiz-001/2026-09-23T072509Z-codex-with-skill-d9952522-1/transcript.md) | pass | Forkcast EIP/upgrades JSON and call corpus; EIP-7864/6800. |
| quiz-001 / none / 2 | [2026-09-23T072756Z-codex-no-skill-2](../artifacts/protocol-quiz-001/2026-09-23T072756Z-codex-no-skill-2/transcript.md) | pass | Web search: EF priorities, EIP-7864/1186, Geth/light-client docs; no visible fork-scope fetch. |
| quiz-001 / old / 2 | [2026-09-23T073003Z-codex-with-skill-2f0adb01-2](../artifacts/protocol-quiz-001/2026-09-23T073003Z-codex-with-skill-2f0adb01-2/transcript.md) | pass | Forkcast searches/pages/llms attempt; EF priorities, EIP-1186, binary-tree searches. |
| quiz-001 / new / 2 | [2026-09-23T073323Z-codex-with-skill-d9952522-2](../artifacts/protocol-quiz-001/2026-09-23T073323Z-codex-with-skill-d9952522-2/transcript.md) | pass | Forkcast repo data and JSON; PBT EIP-8297/8347, upgrade records. |
| quiz-001 / none / 3 | [2026-09-23T073715Z-codex-no-skill-3](../artifacts/protocol-quiz-001/2026-09-23T073715Z-codex-no-skill-3/transcript.md) | pass | Web search: roadmap pages, EIPs, EF future-of-state; no visible fork-scope fetch. |
| quiz-001 / old / 3 | [2026-09-23T074107Z-codex-with-skill-2f0adb01-3](../artifacts/protocol-quiz-001/2026-09-23T074107Z-codex-with-skill-2f0adb01-3/transcript.md) | pass | Forkcast JSON and upgrades; EIP-8297/8347/6800 and EIP-1186 search. |
| quiz-001 / new / 3 | [2026-09-23T074340Z-codex-with-skill-d9952522-3](../artifacts/protocol-quiz-001/2026-09-23T074340Z-codex-with-skill-d9952522-3/transcript.md) | pass | Forkcast JSON, upgrades and call corpus; EIP-1186. |
| goal-001 / none / 1 | [2026-09-23T074623Z-codex-no-skill-1](../artifacts/protocol-goal-001/2026-09-23T074623Z-codex-no-skill-1/transcript.md) | pass | Forkcast scope search; ethereum.org roadmap, EIP-7864/8037, client docs. |
| goal-001 / old / 1 | [2026-09-23T074959Z-codex-with-skill-2f0adb01-1](../artifacts/protocol-goal-001/2026-09-23T074959Z-codex-with-skill-2f0adb01-1/transcript.md) | pass | Forkcast scope searches; ethereum.org Glamsterdam/Hegotá, EIPs and EF priorities, client docs. |
| goal-001 / new / 1 | [2026-09-23T075442Z-codex-with-skill-d9952522-1](../artifacts/protocol-goal-001/2026-09-23T075442Z-codex-with-skill-d9952522-1/transcript.md) | pass | Forkcast JSON and September ACD summaries/decisions; EIP specs, client docs. |
| goal-001 / none / 2 | [2026-09-23T075844Z-codex-no-skill-2](../artifacts/protocol-goal-001/2026-09-23T075844Z-codex-no-skill-2/transcript.md) | fail: expect_1 | EF priorities, ethereum.org Glamsterdam/statelessness, EIP-8037/8038 and binary-tree search, client docs. |
| goal-001 / old / 2 | [2026-09-23T080355Z-codex-with-skill-2f0adb01-2](../artifacts/protocol-goal-001/2026-09-23T080355Z-codex-with-skill-2f0adb01-2/transcript.md) | pass | Forkcast searches; Glamsterdam meta-EIP 7773, EIP-8038/7864/8297, client docs. |
| goal-001 / new / 2 | [2026-09-23T080735Z-codex-with-skill-d9952522-2](../artifacts/protocol-goal-001/2026-09-23T080735Z-codex-with-skill-d9952522-2/transcript.md) | pass | Forkcast JSON, stage changes and call corpus; EIP specs, Glamsterdam page, client docs. |
| goal-001 / none / 3 | [2026-09-23T081139Z-codex-no-skill-3](../artifacts/protocol-goal-001/2026-09-23T081139Z-codex-no-skill-3/transcript.md) | pass | ethereum.org Glamsterdam, EF/EIP searches, EIP-8037/7928/4444, client docs. |
| goal-001 / old / 3 | [2026-09-23T081538Z-codex-with-skill-2f0adb01-3](../artifacts/protocol-goal-001/2026-09-23T081538Z-codex-with-skill-2f0adb01-3/transcript.md) | pass | Forkcast JSON/call corpus, EIP specs and EF September priorities. |
| goal-001 / new / 3 | [2026-09-23T081938Z-codex-with-skill-d9952522-3](../artifacts/protocol-goal-001/2026-09-23T081938Z-codex-with-skill-d9952522-3/transcript.md) | pass | Forkcast JSON including both forks’ inclusion stages, call index/corpus, EIP specs and EF priorities. |

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Recorded new vs old: quiz 3/3 vs 3/3, goal 3/3 vs 3/3. New vs none: quiz 3/3 vs 3/3, goal 3/3 vs 2/3. The goal advantage is subject to the documented expect_1 application question. |
| Did it reduce time/tokens? | New vs old: quiz 147s / 895754 vs 138s / 442491; goal 220s / 855768 vs 221s / 690054. New vs none: quiz 147s / 895754 vs 112s / 275285; goal 220s / 855768 vs 215s / 504812. No token reduction; cost medians and ranges are above. |
| Did it create negative deltas? | No recorded pass-rate regression. More median tokens on both tasks, more quiz time/cost, and higher goal cost than none. New goal-1/2 retain ambiguous Verkle framing despite passing. Forkcast envelope-query mistakes occur in new 5/6 versus old 1/6; none did not exercise that API. |
| What mistakes repeated without the skill? | No repeated scored mistake: goal none-2 alone failed expect_1. `protocol-verkle-not-clearly-superseded` records that one observation (1/3 goal runs), not a general error rate inferred from one failure. |
| What mistakes remained with the skill? | `protocol-verkle-not-clearly-superseded` in new goal-1/2 as manual observations, despite passing grades; `protocol-forkcast-json-envelope-assumed` in new 5/6 and old 1/6 across both tasks. |
| What should change in the skill? | Consider explicitly distinguishing superseded designs from merely unscheduled proposals, following through to the replacement design; the old text's concrete Verkle correction was removed. Add a short Forkcast retrieval note to inspect JSON envelopes and reuse fetched data. These recommendations follow the two mistake records; no skill edits were made in this benchmark. |
| What should change in the eval? | Resolve whether goal expect_1 requires the stated binary-tree replacement/rationale or only a no-savings budget posture, applying any future clarification to every stored answer through the repository regrade process. The quiz is saturated; a future task could test current fork-scope evidence rather than only the familiar Verkle conclusion. Keep this pinned benchmark unchanged. |
