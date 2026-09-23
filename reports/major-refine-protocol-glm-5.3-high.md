# major-refine: protocol on GLM 5.3 high

- **Benchmark:** `major-refine-d9952522` ([#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))
- **Executor:** `opencode` · `openrouter/z-ai/glm-5.3` · effort `high` (models catalog `9eb2ba682cd6`)
- **Judge:** `claude` · `claude-opus-5` · effort `high`, on every graded run. Executor and judge are different agents, so every grade is `self_judged: false`.
- **Runs:** 3 graded runs per arm per task, arms interleaved per round (none, old, new). 19 executor runs in all: 18 graded, plus 1 new-arm quiz run that `verify` refused for judge blindness (below).
- **Arms:** none = `no_skill`; old = `with_skill` @ `2f0adb01`; new = `with_skill` @ `d9952522`. Trigger-inclusive: the skill was not forced, and it loaded (opencode `skill` tool call) in 13/13 with-skill runs and 0/6 no-skill runs.
- **Tasks:** `protocol-goal-001`, `protocol-quiz-001` (both bare workspaces, both live).
- **Rubric:** every grade on a task has the same `expect_sha` (goal `9a51e31374ff`, quiz `0b5b790caadc`). No regrade, no retraction, no `--grade-failed-run`. Every executor exited 0.

OpenRouter routes `glm-5.3` per request across providers. The record does not say which provider served a run (AGENTS.md, "The three roles").

## Pass counts: new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| protocol-goal-001 | 2/3 | 3/3 | 3/3 |
| protocol-quiz-001 | 2/3 | 3/3 | 3/3 |
| **total** | **4/6** | **6/6** | **6/6** |

The new-arm quiz count is over runs 2, 3 and 4. Run 1 was not graded (see "Discarded run").

Per check, the only fails:

| Run | Failed check | What happened |
| --- | --- | --- |
| goal · new · 2 (`2026-09-23T075209Z-opencode-with-skill-d9952522-2`) | expect_3 | The fork-status half is current and well-sourced: Glamsterdam repricings EIP-8037/8038 SFI, EIP-8188 DFI'd for Hegotá, Verkle Stagnant. The "meantime" half is budget-for-trajectory, serving/archive tiering, retention flags and snapshot provisioning. It never recommends a more disk-efficient archive client (Erigon/Reth flat storage) or path-based state storage, and it dates structural relief as "2028+ at the earliest" instead of leaving it undated. It mentions Erigon/Reth twice, against 4–16 times in every passing brief. |
| quiz · new · 3 (`2026-09-23T075603Z-opencode-with-skill-d9952522-3`) | expect_2 | Verkle is correctly rejected (a table of seven Verkle EIPs from forkcast, all with no fork relationship), and MPT via `eth_getProof` is the right build target. But the forward direction is given as "ZK proving of execution" (EIP-8025) and a "STARK-provable hash-based state tree". The answer never names a binary Merkle tree or EIP-7864. Its only "binary" is "binary fields", in a note on hash functions. |

Both look like correct grades to me. Neither is a rubric question.

## Discarded run

**`protocol-quiz-001/2026-09-23T073957Z-opencode-with-skill-d9952522-1`: judge-blindness refusal, not graded.** `verify` found `output/answer.md:39`: "Per the skill's classification: **no fork relationship — proposal/research only.**" That is not incidental, as the template boilerplate in the earlier `--allow-skill-mention` precedents was. It is the executor citing its installed skill as the authority for a claim, and it would tell the judge the variant. So I followed the guard's instruction and did not override it. The run is recorded as a run incident: `result.yaml` carries only the setup half (`pass` is absent, so `build-index` counts it as ungraded), and `transcript.md`, `executor.yaml` and `output/answer.md` are committed. Its workspace was removed by hand after checking that `output/answer.md` matched it byte for byte, since `verify` never reached its own cleanup. A fourth new-arm run (`…-d9952522-4`) replaced it and passed.

Reading it outside the grading, the answer was strong: it named the EIP-7864 binary tree, said it was not scheduled, and advised against a hard dependency. Had it been graded, it would probably have passed. So excluding it most likely costs the new arm a pass, not a fail. The citation habit is filed as a mistake (`protocol-skill-cited-in-deliverable`), because a user-facing brief that says "per the skill" is a defect in its own right.

## What the arms did

| Signal (from `transcript.md` and the deliverable) | new | old | none |
| --- | --- | --- | --- |
| Skill loaded | 7/7 | 6/6 | – |
| Used forkcast at least once | 7/7 | 6/6 | 0/6 |
| Used web search | – | – | 6/6 |
| Named binary tree / EIP-7864 (quiz, graded runs) | 2/3 | 3/3 | 3/3 |
| Framed Verkle as upcoming relief (goal) | 0/3 | 0/3 | 0/3 |

- **Without the skill, GLM 5.3 already has the right prior.** All six no-skill runs got there from web search alone, without forkcast. Each named binary trees over Verkle, kept statelessness unscheduled, and kept EIP-4444 off the state-growth problem. The stale prior the tasks target never surfaced on this stack.
- **The new text works as a procedure.** Every new-arm run ran the forkcast lookup and reported statuses in the skill's vocabulary (Live/SFI/CFI/DFI/no fork relationship). The deliverables are the most precisely dated of the three arms: Glamsterdam testnet dates, EIP-8188 DFI on 2026-09-10, EIP-8025 Proposed for Hegotá.
- **Both new-arm fails come from what the procedure does not supply.** Forkcast says what is *not* scheduled. It does not say what replaced Verkle, because EIP-7864 has no fork relationship either. The new text removed the "Verkle → binary trees (ZK + post-quantum)" example that the old text states three times. So a run that follows the procedure faithfully can end up with an accurate status table and no named successor (quiz run 3). The Kimi K3 row of #119 lost a new-arm quiz run on the same check from the same cut: its run named the binary tree and dropped the reason. On the goal, the fail is not about Verkle at all. The run put its effort into fork-status research, and the operator-side levers came out thin.
- **The old text is 6/6 on this stack.** At n=3 per cell, one fail per task is within noise. But both fails are in the new arm, and both trace to content the new text does not carry.

Task notes ask for provenance per run. Every with-skill run checked forkcast (plus EIP texts and ACD call summaries). Every no-skill run used web search and never fetched forkcast. No run in any arm recited a roadmap without checking.

## Cost

From `yarn run-stats --tasks protocol-goal-001,protocol-quiz-001 --benchmark major-refine-d9952522`, split with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. Medians, with the cost range. The cost is opencode's own figure at models.dev list price (`cost_source: executor`), not OpenRouter's bill.

| Task | Arm | n | turns | duration | cost | cost range | tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| protocol-goal-001 | new | 3 | 15 | 131s | $0.25 | $0.24–$0.28 | 427,647 |
| protocol-goal-001 | old | 3 | 15 | 157s | $0.28 | $0.22–$0.47 | 556,903 |
| protocol-goal-001 | none | 3 | 7 | 129s | $0.26 | $0.18–$0.31 | 401,165 |
| protocol-quiz-001 | new | 4 | 14 | 93s | $0.14 | $0.12–$0.21 | 289,451 |
| protocol-quiz-001 | old | 3 | 8 | 90s | $0.15 | $0.10–$0.15 | 198,199 |
| protocol-quiz-001 | none | 3 | 4 | 70s | $0.12 | $0.11–$0.20 | 144,350 |

The new-arm quiz row is `n=4`: it includes the ungraded run 1, which `run-stats` counts because it spent real executor money. Per-run figures from `--runs` for that arm are `202s/$0.15/330,280` (run 1, ungraded), `103s/$0.21/459,121`, `82s/$0.12/226,186` and `66s/$0.12/248,621`.

On the goal, the skill arms cost the same dollars as none, while spending about twice the turns on forkcast lookups. On the quiz, the new arm uses the most tokens of the three. All ranges overlap, and at n=3 no cost difference here should be read as real.

## Mistake records

All three are new, and all carry this stack's frequencies only:

- `mistakes/protocol/protocol-binary-tree-unnamed.yaml`. Quiz task: new 1/3, old 0/3, none 0/3. Sibling of the Kimi row's `protocol-verkle-deprioritization-reason-omitted` (same check, same arm, same cause).
- `mistakes/protocol/protocol-state-growth-no-efficient-client-lever.yaml`. Goal task: new 1/3, old 0/3, none 0/3.
- `mistakes/protocol/protocol-skill-cited-in-deliverable.yaml`. Quiz task: new 1/4 (the refused run), old 0/3, none 0/3.

## Notes on the eval

- **Both tasks are saturated for none on GLM 5.3** (3/3 each). With the prior already correct, the tasks can only show the skill hurting, not helping. That is what happened, by one run per task.
- **Judge blindness caught a genuine leak on an opencode stack.** The refined skill's named status taxonomy makes "per the skill's classification" an easy phrase to reach for. If other stacks show the same, the tasks could ask the executor to cite sources instead, but that would be an `input:` change and a new benchmark, not something for this row.
- **Ground truth is live.** The runs found EIP-7864 with no fork relationship, and Hegotá's scope still being set (EIP-8188 DFI 2026-09-10, headliners FOCIL and Frame Transactions). That matches the rubric's "not scheduled" framing, so no expect line graded against a stale fact.

## Summary

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none: `4/6 vs 6/6` (goal `2/3 vs 3/3`, quiz `2/3 vs 3/3`). new vs old: `4/6 vs 6/6` (same split). old vs none: `6/6 vs 6/6`. No: none is already at ceiling on this stack, and each new-arm deficit is one run, within noise at n=3. |
| Did it reduce time/tokens? | No. Goal: new `131s / 428k tokens / $0.25`, old `157s / 557k / $0.28`, none `129s / 401k / $0.26`. Quiz: new `93s / 289k / $0.14` (n=4, one ungraded), old `90s / 198k / $0.15`, none `70s / 144k / $0.12`. new is cheaper than old on the goal and dearer on the quiz. Ranges overlap throughout. |
| Did it create negative deltas? | new vs old and new vs none, one run per task: `protocol-binary-tree-unnamed` (quiz) and `protocol-state-growth-no-efficient-client-lever` (goal). Also `protocol-skill-cited-in-deliverable`, which cost a graded slot and needed a replacement run. |
| What mistakes repeated without the skill? | None. All six no-skill runs passed. The Verkle-as-coming-relief prior the skill targets did not surface on this stack. |
| What mistakes remained with the skill? | new arm only: `protocol-binary-tree-unnamed` (1/3), `protocol-state-growth-no-efficient-client-lever` (1/3), `protocol-skill-cited-in-deliverable` (1/4). old arm: none. |
| What should change in the skill? | Restore one line of the removed example, stating the successor as well as the reason: "Directions change as well as dates: Verkle was deprioritized in favor of a binary Merkle tree (EIP-7864) over ZK-proving cost and post-quantum security. When a direction changed, name what replaced it and why." That one line covers this row's quiz fail and the Kimi row's. Add "Cite the sources you checked, not these instructions" to the closing paragraph, against the self-citation. The goal fail has no skill-text fix I would back on 1/3 evidence. |
| What should change in the eval? | Both tasks are saturated for none on GLM 5.3 (3/3), so on this stack they can only detect regressions. A task where the web-search answer is stale but forkcast's is current would test the new text's procedure directly. For #119. |
