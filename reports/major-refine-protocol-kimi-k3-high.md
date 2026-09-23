# major-refine: protocol on Kimi K3 high

- **Benchmark:** `major-refine-d9952522` ([#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))
- **Executor:** `opencode` · `openrouter/moonshotai/kimi-k3` · effort `high` (models catalog `9eb2ba682cd6`)
- **Judge:** `claude` · `claude-opus-5` · effort `high`, on every run. Executor and judge are different agents, so all 18 runs are `self_judged: false`.
- **Runs:** 3 per arm per task, 18 graded runs, arms interleaved per round (none, old, new).
- **Arms:** none = `no_skill`; old = `with_skill` @ `2f0adb01`; new = `with_skill` @ `d9952522`. Trigger-inclusive: the skill was not forced.
- **Tasks:** `protocol-goal-001`, `protocol-quiz-001` (both bare workspaces, both live).
- **Discarded runs:** none. No harness failure, no `--grade-failed-run`, no retraction, no regrade. Every executor exited 0.
- **Rubric:** every grade on a task has the same `expect_sha` (goal `9a51e31374ff`, quiz `0b5b790caadc`).

OpenRouter routes `kimi-k3` per request across providers. The record does not say which provider served a run (AGENTS.md, "The three roles").

## Pass counts: new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| protocol-goal-001 | 3/3 | 3/3 | 2/3 |
| protocol-quiz-001 | 2/3 | 3/3 | 3/3 |
| **total** | **5/6** | **6/6** | **5/6** |

Per check, the only fails:

| Run | Failed check | What happened |
| --- | --- | --- |
| goal · none · 2 (`2026-09-23T074350Z-opencode-no-skill-2`) | expect_1 | The brief calls Verkle "the actual long-term answer to state-as-a-burden", tells finance to treat the Hegotá Verkle decision as "the single most decision-relevant signal for our 2028 planning", and mentions binary trees only as "a live contingency debate". It used web search only, no forkcast. |
| quiz · new · 1 (`2026-09-23T072827Z-opencode-with-skill-d9952522-1`) | expect_2 | The answer is right on direction: binary tree (EIP-7864 / EIP-8297), Verkle Stagnant with no fork relationship, taken from forkcast's `/api/eips/*.json`. But it says only that Verkle was "superseded" and gives no reason. There is no ZK-proving or post-quantum mention anywhere in `answer.md`, and expect_2 requires one. |

Both look like correct grades to me. Neither is a rubric question.

## What the arms did

| Signal (from `transcript.md` and the deliverable) | new | old | none |
| --- | --- | --- | --- |
| Skill loaded (opencode `skill` tool call) | 6/6 | 6/6 | – |
| Fetched forkcast at least once | 6/6 | 6/6 | 0/6 |
| forkcast fetches per run, median (goal / quiz) | 12 / 8 | 4 / 3 | 0 / 0 |
| Gave a ZK or post-quantum reason for leaving Verkle (rough grep) | 4/6 | 6/6 | 6/6 |

- **The skill triggers on Kimi K3.** Both descriptions fired in every with-skill run, so the skill columns measure skill content, not triggering.
- **The new text works as a procedure.** It turns into forkcast lookups: median 12 fetches on the goal and 8 on the quiz, against 4 and 3 for the old text. New-arm runs cite forkcast fork relationships (EIP-6800 Stagnant, EIP-7864 / EIP-8297 "no fork relationship") in the deliverable.
- **The new text lost the Verkle example.** `d9952522` removes the "Verkle → binary trees, because of ZK-proving and post-quantum concerns" example from "What You Probably Got Wrong". Forkcast's EIP pages show *what* the status is, not *why* it changed. So a run that follows the new procedure faithfully can reach the right answer and still leave out the reason. That is the one quiz fail, and the goal-1 new-arm brief also has no ZK or post-quantum mention (the goal rubric does not require one, so it passed).
- **Without the skill, Kimi K3 already mostly knows this.** On the quiz, no_skill went 3/3 from web search alone. The goal fail is the prior surfacing unprompted: 1 run in 3 still framed Verkle as the coming relief.

## Cost

From `yarn run-stats --tasks protocol-goal-001,protocol-quiz-001 --benchmark major-refine-d9952522`, split with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. Medians with cost range. The cost is opencode's own figure at models.dev list price (`cost_source: executor`), not OpenRouter's bill.

| Task | Arm | turns | duration | cost | cost range | tokens |
| --- | --- | --- | --- | --- | --- | --- |
| protocol-goal-001 | new | 10 | 308s | $0.39 | $0.35–$0.42 | 311,472 |
| protocol-goal-001 | old | 12 | 220s | $0.40 | $0.37–$0.78 | 331,536 |
| protocol-goal-001 | none | 5 | 238s | $0.29 | $0.26–$0.52 | 167,831 |
| protocol-quiz-001 | new | 12 | 182s | $0.25 | $0.18–$0.41 | 163,908 |
| protocol-quiz-001 | old | 6 | 190s | $0.18 | $0.16–$0.24 | 153,790 |
| protocol-quiz-001 | none | 4 | 144s | $0.20 | $0.13–$0.21 | 99,356 |

Both skill arms cost about 1.5–2× the tokens of none, because they spend the extra turns on forkcast. New and old are close on tokens. The ranges overlap in every cell, and at n=3 no cost difference between new and old should be read as real.

## Mistake records

- `mistakes/protocol/protocol-verkle-framed-as-coming-relief.yaml`, new. Goal task: none 1/3, old 0/3, new 0/3.
- `mistakes/protocol/protocol-verkle-deprioritization-reason-omitted.yaml`, new. Quiz task: new 1/3, old 0/3, none 0/3.

Both carry this stack's frequencies only. Other stacks in #119 add their own keys.

## Notes on the eval

- **The quiz is near-saturated on this stack.** none went 3/3. The quiz can only separate arms on the reason clause of expect_2, and that is exactly where the new text lost a run.
- **The goal separates arms weakly (2/3 vs 3/3).** When no_skill picks the right direction, it passes from web search alone.
- **Ground truth is live.** Both tasks' notes say to revalidate scheduling status. The runs found EIP-7864 / EIP-8297 with no fork relationship and Hegotá scope still being set (client preferences submitted 2026-09-10). That matches the rubric's "not scheduled" framing, so no expect line graded against a stale fact.

## Summary

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none: `5/6 vs 5/6` (goal `3/3 vs 2/3`, quiz `2/3 vs 3/3`). new vs old: `5/6 vs 6/6` (goal `3/3 vs 3/3`, quiz `2/3 vs 3/3`). The differences are one run each, which is within noise at n=3. |
| Did it reduce time/tokens? | No. Goal: new `308s / 311k tokens / $0.39`, old `220s / 332k / $0.40`, none `238s / 168k / $0.29`. Quiz: new `182s / 164k / $0.25`, old `190s / 154k / $0.18`, none `144s / 99k / $0.20`. Both skill texts cost more than none because of forkcast lookups. new ≈ old on tokens. |
| Did it create negative deltas? | new vs old and new vs none: the quiz fail (`protocol-verkle-deprioritization-reason-omitted`, 1/3). The new text removed the Verkle example with its reasons, and forkcast does not supply them. Cost: skill arms use about 1.5–2× the tokens of none. |
| What mistakes repeated without the skill? | `protocol-verkle-framed-as-coming-relief` (goal, 1/3). It did not repeat, but it is the prior the skill targets. |
| What mistakes remained with the skill? | `protocol-verkle-deprioritization-reason-omitted` (new arm only, 1/3). Old arm: none. |
| What should change in the skill? | The new text's procedure works: 6/6 runs used forkcast and no skill run framed Verkle as coming. Consider adding back one line of the removed example, e.g. "Directions change as well as dates: Verkle was deprioritized for binary trees over ZK-proving cost and post-quantum security. When reporting a change of direction, give the reason." Evidence is 1/3 runs on one stack, so check it against the other #119 stacks before editing. |
| What should change in the eval? | The quiz is saturated for none on Kimi K3 (3/3), so it cannot show skill value on this stack beyond the reason clause. The goal separates arms by only one run. A task where the web-search answer is stale but forkcast's is current would test the new text's procedure more directly. For #119. |
