# major-refine: `standards` on Opus 5 medium

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `claude` · `claude-opus-5` · effort `medium` |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | **true** on all 27 runs — judge and executor are the same agent |
| Runs | 3 per arm per task, 3 tasks × 3 arms = **27 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 `retracted`, 0 dead runs |
| Trigger | not forced — numbers are trigger-inclusive |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `standards` skill, 393 lines |
| new | `with_skill` | `d9952522` | refined minimal skill, 51 lines |

Both `skill_version` commits are ancestors of HEAD.

**Tasks** — all three live tasks whose `skill:` is `skills/standards`; bare workspaces, no template.

- `standards-quiz-001` (ERC-8004 + x402 + EIP-3009, named)
- `standards-quiz-002` (EIP-7702)
- `standards-goal-001` (the same agent-commerce cluster, unnamed)

## Headline — pass counts, new · old · none

| Task | new · old · none |
| --- | --- |
| `standards-quiz-001` | `3/3 · 3/3 · 3/3` |
| `standards-quiz-002` | `3/3 · 3/3 · 3/3` |
| `standards-goal-001` | `3/3 · 3/3 · 3/3` |
| **total** | **`9/9 · 9/9 · 9/9`** |

**Saturated.** Every run passes every expect line in all three arms. On Opus 5 medium the standards tasks measure the executor model, not the skill: the base model already knows ERC-8004, x402, EIP-3009 and EIP-7702 well enough to clear this rubric unprompted. The 2026-07-27 and 2026-08-26 runs separated the arms only on `goal-001` `expect_10`, and that gap has now closed in the `none` arm too (see Records).

## Trigger

Not forced, so which arms actually read the skill matters. Counted from `"name":"Skill"` calls in each `transcript.jsonl`:

| Task | new | old |
| --- | --- | --- |
| `standards-quiz-001` | 3/3 | 3/3 |
| `standards-quiz-002` | **3/3** | **0/3** |
| `standards-goal-001` | 3/3 | 3/3 |

The old description lists ERC-20/721/1155/4337/8004 and never names EIP-7702, so on the 7702 quiz the old arm never loaded it — those three runs are `none` runs in all but name. The new description names EIP-7702 ("contract abilities on an address the user already owns") and triggers 3/3. That is the one behavioural difference the refine made here; it did not change a grade because `none` passes quiz-002 too.

## Cost

From `yarn run-stats --tasks standards-quiz-001,standards-quiz-002,standards-goal-001 --benchmark major-refine-d9952522`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01`, `--skill-version d9952522`. Medians with ranges; `cost_source: executor`.

| Task | Arm | n | turns | duration | cost | cost range | tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `standards-quiz-001` | new | 3 | 4 | 26s | $0.21 | $0.21–$0.22 | 61938 |
| | old | 3 | 8 | 51s | $0.36 | $0.35–$0.37 | 146740 |
| | none | 3 | 4 | 42s | $0.24 | $0.23–$0.25 | 78933 |
| `standards-quiz-002` | new | 3 | 4 | 29s | $0.21 | $0.21–$0.22 | 61851 |
| | old | 3 | 2 | 35s | $0.19 | $0.17–$0.19 | 39828 |
| | none | 3 | 2 | 31s | $0.18 | $0.18–$0.18 | 39378 |
| `standards-goal-001` | new | 3 | 12 | 146s | $0.83 | $0.78–$1.18 | 269323 |
| | old | 3 | 13 | 268s | $1.26 | $0.80–$1.53 | 450951 |
| | none | 3 | 11 | 253s | $1.11 | $1.03–$1.24 | 359982 |

On a saturated task the cost is the result:

- **`quiz-001`:** new is the cheapest arm — $0.21 / 62k / 4 turns against old's $0.36 / 147k / 8 turns, and below `none` too. The 393-line old text doubles the turns and tokens to reach the same 3/3.
- **`goal-001`:** new $0.83 / 269k / 146s against old $1.26 / 451k / 268s and none $1.11 / 360k / 253s. Direction holds but the ranges overlap (new tops at $1.18, old bottoms at $0.80); n=3.
- **`quiz-002`:** new costs more ($0.21 / 62k vs ~$0.18 / 40k). That is the trigger, not the text: new loads the skill, old and none never do. A real negative delta on a task where loading bought nothing.

## Blindness flag

`verify` refused `standards-goal-001/2026-09-21T094611Z-claude-with-skill-2f0adb01-3` on one skill mention: `output/server.ts:92  // A2A agent card: machine-readable description of the skill and how to pay.` That is A2A's own vocabulary (an agent card lists `skills`), not a reference to the eval's skill, so it was graded with `--allow-skill-mention`. It passed 11/11 like every other goal run.

## Records

- `standards-missing-domain-binding` re-measured: 0/3 in all three arms. Every goal output serves `.well-known/agent-registration.json` (checked in `output/`, not just the judge's verdict). The record said to close it if the next benchmark also came back 0/3; the measurement is added to `frequency_history`, and the status is left for review (see the PR).
- No new mistake records: no expect line failed, and no run shipped a claim that would need one.

All 27 `output/` snapshots are force-added (4–100K each, no `node_modules`) so every run stays regradeable.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No — `9/9 · 9/9 · 9/9` (new · old · none). Saturated. |
| Did it reduce time/tokens? | New vs old: yes on quiz-001 ($0.21 / 62k vs $0.36 / 147k) and goal-001 ($0.83 / 269k vs $1.26 / 451k); no on quiz-002 ($0.21 / 62k vs $0.19 / 40k). New vs none: cheaper on quiz-001 and goal-001, dearer on quiz-002 ($0.21 vs $0.18). |
| Did it create negative deltas? | quiz-002 cost: new loads the skill and pays ~$0.03 / 22k tokens more for no grade change. Old costs more than none on quiz-001 and goal-001. |
| What mistakes repeated without the skill? | None. `standards-missing-domain-binding` 0/3. |
| What mistakes remained with the skill? | None. |
| What should change in the skill? | Nothing this benchmark justifies. New is the cheaper text on the two tasks where both skill arms loaded it. |
| What should change in the eval? | All three tasks are saturated on Opus 5 medium and cannot separate the arms. They need harder checks, e.g. on details the base model gets wrong under build pressure rather than on knowing a standard exists, or retiring for this stack. Wait for the GPT 5.5 / open-model columns first: they may not saturate. |
