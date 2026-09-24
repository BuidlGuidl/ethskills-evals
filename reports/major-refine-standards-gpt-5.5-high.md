# Major refine — standards on GPT 5.5 high

**Benchmark id:** `major-refine-d9952522`
**Skill:** `skills/standards`
**Stack:** executor `codex`, model `gpt-5.5`, effort `high`
**Judge:** `claude`, `claude-opus-5`, effort `high`
**Runs:** 3 per arm per task, three arms: none, old skill `2f0adb01`, new skill `d9952522`
**self_judged:** false

Two `standards-quiz-001` attempts hit the Codex usage limit after writing `answer.md` but before a clean executor exit:

- `2026-09-22T085444Z-codex-no-skill-2`
- `2026-09-22T085444Z-codex-with-skill-2f0adb01-2`

They were graded with `--grade-failed-run` only to preserve the evidence, then marked `retracted:` because `executor_exit: 1` makes them provider-limit records, not clean model samples. Replacement run-2 samples were created under fresh run ids and are the counted measurements:

- `2026-09-22T115647Z-codex-no-skill-2`
- `2026-09-22T115648Z-codex-with-skill-2f0adb01-2`

## Headline

| Task | new skill `d9952522` | old skill `2f0adb01` | no skill |
| --- | ---: | ---: | ---: |
| `standards-goal-001` | 2/3 | 2/3 | 0/3 |
| `standards-quiz-001` | 3/3 | 3/3 | 3/3 |
| `standards-quiz-002` | 3/3 | 3/3 | 3/3 |
| **Total** | **8/9** | **8/9** | **6/9** |

The only pass-rate signal is the goal task. Both quizzes are at ceiling on all arms. The old and new skill texts tie on pass rate.

Across counted runs, expect-line judgments were:

| Arm | Expect lines |
| --- | ---: |
| new skill | 71/72 |
| old skill | 71/72 |
| no skill | 67/72 |

## What failed

`standards-goal-001` no-skill failed every run:

- Run 1 failed `expect_1` and `expect_4`: it selected ERC-8004, but shipped placeholder/env-only Identity and Reputation registry addresses.
- Run 2 failed `expect_9`: it used the wrong Base USDC address, `0x833589fCD6eDb6E08f4c7C32D4f71b54bDa3`.
- Run 3 failed `expect_1` and `expect_4`: same registry-address deferral pattern as run 1.

The old skill failed `standards-goal-001` run 1 on `expect_11`: design.md served/built the domain binding but did not state what the binding proves clearly enough for the judge. Runs 2 and 3 passed.

The new skill failed `standards-goal-001` run 3 on `expect_11`, the same domain-binding reasoning line. Runs 1 and 2 passed.

## Mistakes

Updated:

- `mistakes/standards/standards-registry-address-deferred-to-config.yaml` now records codex/gpt-5.5-high: no_skill 2/3, old_skill 0/3, new_skill 0/3.

Added:

- `mistakes/standards/standards-base-usdc-address-mistranscribed.yaml` for the no_skill run that used a visually similar but wrong Base USDC address.

`standards-missing-domain-binding` did not reproduce as a no-skill failure here: all counted no-skill runs either served the domain file or used the same-domain agentURI route. The remaining goal-task `expect_11` failures were skill-arm reasoning omissions, not missing documents.

## Search and Cost

The quizzes are search-recoverable on this stack. No-skill runs repeatedly used web search for ERC-8004/x402/EIP-7702 constants, and still passed 6/6 quiz samples. The skill mostly reduced search and wall time, but did not change the quiz pass rate.

Official `yarn run-stats` rows, split by arm:

| Task | Arm | n | duration | cost | tokens |
| --- | --- | ---: | ---: | ---: | ---: |
| goal-001 | no skill | 3 | 416s | $1.83 | 1153573 |
| goal-001 | old skill | 3 | 403s | $1.65 | 1265271 |
| goal-001 | new skill | 3 | 387s | $1.57 | 1091651 |
| quiz-001 | no skill | 4 (1 no stats) | 164s | $0.87 | 308048 |
| quiz-001 | old skill | 4 (1 no stats) | 145s | $0.55 | 235308 |
| quiz-001 | new skill | 3 | 125s | $0.43 | 144412 |
| quiz-002 | no skill | 3 | 82s | $0.43 | 171037 |
| quiz-002 | old skill | 3 | 98s | $0.52 | 182250 |
| quiz-002 | new skill | 3 | 71s | $0.31 | 120479 |

For `quiz-001`, the two excluded usage-limit attempts are why `run-stats` reports `4 (1 no stats)` for no_skill and old_skill. The pass counts above use only clean, graded runs.

## Verdict

| Question | Answer |
| --- | --- |
| Did the new skill improve pass rate vs no skill? | Yes on the goal task: 2/3 vs 0/3. No on the quizzes: both are 3/3 vs 3/3. Overall 8/9 vs 6/9. |
| Did the new skill improve pass rate vs the old skill? | No. Both are 8/9 overall and 2/3 on the goal task. |
| Did it reduce time/tokens? | Generally yes for the new skill against no_skill on all three tasks in the run-stats rows. New skill was also cheaper than old skill on all three tasks in these rows. |
| Did it create negative deltas? | No graded pass-rate regression. New skill still had one `expect_11` failure on goal-001, same line family as the old skill failure. |
| What mistakes repeated without the skill? | `standards-registry-address-deferred-to-config` reproduced at 2/3 on no_skill; `standards-base-usdc-address-mistranscribed` appeared once. |
| What mistakes remained with the new skill? | One goal-task run omitted the explicit reasoning for what the domain binding proves (`expect_11`). The document/path was present; the reasoning line was not strong enough. |
| What should change in the skill? | Consider making the endpoint-domain binding sentence even more explicit: a never-seen client verifies that the endpoint domain is controlled by the holder of the advertised ERC-8004 agentId before trusting what the domain serves. |
| What should change in the eval? | Retire or retarget both quizzes for this stack; they are now 3/3 across all arms and mostly measure searchable constants. Keep `goal-001`, but `expect_11` may be worth tightening with examples of acceptable reasoning, since both skill arms failed it once despite serving the binding artifact. |
