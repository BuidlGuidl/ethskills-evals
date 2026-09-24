# major-refine: wallets on Opus 5 medium

- **Benchmark:** `major-refine-d9952522` ([#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)), harness and tasks at `d9952522`
- **Stack:** executor `claude`, model `claude-opus-5`, effort `medium`
- **Judge:** `claude` / `claude-opus-5` / `high`, every run
- **Arms:** none (`no_skill`) · old (`with_skill`, `skill_version: 2f0adb01`, the first vendored text, 169 lines) · new (`with_skill`, `skill_version: d9952522`, the refined text, 26 lines)
- **Runs:** 3 per arm per task, interleaved none → old → new within each run number, all seven tasks in parallel, 2026-09-19. One old-arm run was retracted and replaced (see below), so 64 runs were made and 63 count.
- **Tasks (7):** `wallets-goal-001`, `wallets-goal-002`, `wallets-goal-004`, `wallets-quiz-001`, `wallets-quiz-002`, `wallets-quiz-005`, `wallets-quiz-006`
- **Trigger:** not forced; numbers are trigger-inclusive. The new text triggered in 21/21 runs, the old text in 20/22 (both misses are `wallets-quiz-005` old runs 1 and 2, which passed anyway).

> **`self_judged: true` on all 64 runs.** The executor and the judge are both claude/opus-5, as the benchmark pins for this stack. The judge was still fresh and blind — started outside the repo, shown only the evidence — and `lib/blindness.ts` held on every counted run.

## Headline: pass counts, new · old · none

| Task | new | old | none |
| --- | --- | --- | --- |
| wallets-goal-001 | 3/3 | 3/3 | 3/3 |
| wallets-goal-002 | 3/3 | 3/3 | 3/3 |
| wallets-goal-004 | **2/3** | **1/3** | **0/3** |
| wallets-quiz-001 | 3/3 | 3/3 | 3/3 |
| wallets-quiz-002 | 3/3 | 3/3 | 3/3 |
| wallets-quiz-005 | 3/3 | 3/3 | 3/3 |
| wallets-quiz-006 | 3/3 | 3/3 ¹ | 3/3 |
| **Total** | **20/21** | **19/21** | **18/21** |

¹ Counted runs 1, 2 and 4. Run 3 is retracted.

Six of the seven tasks are saturated: every run in every arm passes every expect line. The only task that separates the arms is `wallets-goal-004`, and only on `expect_3`, which is failed by every failing run and by no passing one. The ordering (new > old > none) matches the direction the skill should push, but at n=3 a 2/3 vs 1/3 vs 0/3 split is not a significant difference, and the next section changes what `expect_3` is measuring on this stack.

## wallets-goal-004: what `expect_3` actually separated

`expect_3` asks whether the run treats the key pasted into the brief as burned, and names *this* key rather than stating the general rule. The judge sees `output/` only, not the transcript.

**All six failing runs did name this key as burned, in their final chat message.** None of them carried it into a file they delivered:

| Run | In the final chat message | In the delivered files |
| --- | --- | --- |
| none-1 | "Replace the deployer key. It has been pasted in chat, written to a file and committed… Create a fresh key" | nothing about this key |
| none-2 | "Replace the key… treat it as leaked… The old key's address is `0x6Ed090E7…`" | README: the abstract rule only |
| none-3 | "that key has now been pasted into a task file and this chat… used just for this deploy, swept, and then retired" | README: the abstract rule only |
| old-2 | "Retire that key regardless. It has been pasted in plaintext into a task file and this chat." | README: GitHub-scraping warning only |
| old-3 | "the key has been in a plaintext file and in this chat, so treat it as burned" | nothing about this key |
| new-1 | "Stop using the key either way… it has already been shared in chat. Generate a new deployer with `npm run new-key`" | README: "pasted anywhere counts as leaked. Stop using it…" — the rule, not this key; ships `new-key.ts` |

The three passing runs (old-1, new-2, new-3) put it in the deliverable, in `README.md` and/or code (`deploy.ts`, a shared `common.ts`).

So on this stack the model notices the burned key in every arm. What the skill changes is whether the warning ends up in the repo the team will clone. That is still a real difference in the deliverable — the teammate who clones the repo, not the person in the chat, is the one who has to stop using the account — but it is narrower than "the skill makes the model notice". The existing mistake record `wallets-burned-key-stated-not-acted-on` claimed the failing runs "never identify the key in front of it"; I added this sitting's frequency and a note narrowing that claim.

A second thing every `wallets-goal-004` run noticed: `setup` commits `TASK.md`, key included, into the workspace's baseline commit, so the runs spent effort warning that the git history leaks the key. Several deleted or redacted `TASK.md`. This is a harness artifact, and it is also what several runs cite as the reason the key is burned ("written to a file and committed"). It applies equally to all three arms.

## Costs

From `yarn run-stats --tasks <all seven> --benchmark major-refine-d9952522`, split with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. Medians, with the cost range; `total_tokens`.

| Task | none: duration / cost (range) / tokens | old: duration / cost (range) / tokens | new: duration / cost (range) / tokens |
| --- | --- | --- | --- |
| wallets-goal-001 | 517s / $1.82 ($1.69–$2.05) / 944k | 475s / $1.74 ($1.55–$1.74) / 812k | 516s / $1.84 ($1.54–$1.88) / 924k |
| wallets-goal-002 | 931s / $4.12 ($3.90–$4.15) / 2418k | 923s / $3.59 ($2.40–$4.84) / 1840k | 387s ² / $3.06 ($1.43–$3.36) / 483k ² |
| wallets-goal-004 | 287s / $0.86 ($0.80–$0.98) / 455k | 509s / $1.04 ($0.82–$2.20) / 588k | 305s / $1.07 ($0.70–$1.37) / 601k |
| wallets-quiz-001 | 57s / $0.26 ($0.24–$0.39) / 62k | 63s / $0.31 ($0.30–$0.33) / 67k | 62s / $0.27 ($0.26–$0.28) / 60k |
| wallets-quiz-002 | 44s / $0.20 ($0.20–$0.25) / 39k | 49s / $0.24 ($0.23–$0.24) / 62k | 46s / $0.21 ($0.19–$0.21) / 57k |
| wallets-quiz-005 | 59s / $0.26 ($0.24–$0.26) / 59k | 55s / $0.26 ($0.23–$0.27) / 60k | 61s / $0.28 ($0.27–$0.28) / 80k |
| wallets-quiz-006 | 88s / $0.33 ($0.30–$0.47) / 81k | 77s / $0.36 ($0.30–$0.41) / 90k ³ | 68s / $0.33 ($0.28–$0.36) / 82k |

² **Not measured correctly.** `wallets-goal-002` new-2 (`2026-09-19T174427Z-claude-with-skill-d9952522-2`) waited on background tasks, so the claude CLI resumed its session and emitted 8 `result` events. `parseClaudeUsage` (`lib/usage.ts`) and the transcript footer that `run-stats` reads both keep only the **last** event. That event's `total_cost_usd` is cumulative, so $3.06 is right. Its `num_turns`, `duration_ms` and `usage` cover only the last segment, so the run records 5 turns / 48s / 274k tokens where the first segment alone was 32 turns / 626s / 1.37M. `executor.yaml`'s own wall clock says 839s. With that run's true figures, the new arm's median on this task would sit near its run 3 (797s / 1.73M), level with the other arms rather than half of them. Read the new arm's `goal-002` duration and token cells as not measured. It is the only run in this benchmark with more than one `result` event. Raised on #119, since the harness is pinned.

³ `run-stats` counts the retracted old-3 in this row (n=4). The three counted runs are 58s / $0.30 / 87k, 80s / $0.41 / 144k and 83s / $0.37 / 89k (from `run-stats --runs`).

Leaving that one cell aside, no arm is consistently cheaper or faster. On the saturated tasks the three arms sit within each other's ranges. The spread within an arm on the goal tasks is wider than the differences between arms.

## Operator calls

**`wallets-quiz-006` old-3 retracted and replaced.** `verify` refused to grade `2026-09-19T165031Z-claude-with-skill-2f0adb01-3`: `answer.md:40` reads "The skill's rule applies directly: *Assume keys will be compromised…*", which no no-skill run can write. That is a genuine leak of the arm, not an incidental match. Following the `audit-goal-001` precedent, I graded it afterwards with `--allow-skill-mention` only so the record is complete (4/4 pass), added `retracted:` to its `result.yaml`, and drew a replacement, old-4 (`2026-09-19T165249Z-claude-with-skill-2f0adb01-4`), on the same stack against the same input and expect shas. The replacement graded blind and passed. It ran after new-3 rather than in its interleaved slot. The retracted run is excluded from every count above except the one `run-stats` row noted in ³.

**Evidence committed.** `output/` is force-added for all 64 runs (3.2 MB in total, 160K at most per run), so every grade can be regraded from any clone.

**No other incidents.** No run died, no executor exited non-zero, no `harness_failure`. `verify` exited 2 on the six failing `wallets-goal-004` grades, which is a failed grade, not an error.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **new vs none:** 20/21 vs 18/21, all of it on `wallets-goal-004` (2/3 vs 0/3). **new vs old:** 20/21 vs 19/21, again only `wallets-goal-004` (2/3 vs 1/3). The other six tasks are 3/3 in every arm. The ordering holds, but n=3 cannot separate it from noise, and what separates is whether the burned-key verdict reaches the README, not whether the model notices (see above). |
| Did it reduce time/tokens? | No consistent reduction, new vs none or new vs old. Per-task medians sit within each other's ranges (e.g. goal-001: 516s / 924k new vs 475s / 812k old vs 517s / 944k none; goal-004: 305s / 601k vs 509s / 588k vs 287s / 455k). The one large apparent saving, goal-002 new at 387s / 483k, is a harness accounting error (²), not a measurement. The refined text is 26 lines against 169, so its fixed prompt cost is lower when it triggers, but that does not show at this spread. |
| Did it create negative deltas? | None in pass rate: no task where a skill arm scores below none, or new below old. The old text missed its trigger twice on `wallets-quiz-005`; the new text never did. One old-arm run cited the skill in its answer and was retracted; no new-arm run did. |
| What mistakes repeated without the skill? | `wallets-burned-key-stated-not-acted-on`, 3/3 none. Narrowed on this stack: the key is named as burned in chat, not in the deliverable. |
| What mistakes remained with the skill? | `wallets-burned-key-stated-not-acted-on`: 2/3 old, 1/3 new. |
| What should change in the skill? | One edit, backed by that record: the refined bullet says "A key that arrived in a prompt, a chat, or a ticket is burned. Say so, rotate it…" and does not say where. Make it "say so in what you deliver — the README the team reads, naming the account's address — not only in your reply". Nothing else in this benchmark points at a gap: six tasks are saturated on both texts. |
| What should change in the eval? | (a) **Six of seven tasks do not discriminate on this stack**; every arm is 3/3 on both quizzes and both other goals. They confirm no regression from the 169 → 26 line cut, which is worth knowing, but they cannot show a gain. (b) **`wallets-goal-004` `expect_3` measures placement, not noticing**, because the judge cannot see the chat reply. That is defensible (the deliverable is the repo) but the input never says the warning has to live in the repo, so the check should either say so or the input should ask for it. It is a rubric decision for #119, not a branch edit. (c) **`setup` commits `TASK.md`, key included, into the workspace's baseline commit**, which hands every `wallets-goal-004` run a second, harness-made reason the key is burned and a git-history problem that exists only because of the harness. (d) **Harness:** `parseClaudeUsage` and the transcript footer take the last `result` event, which undercounts turns, duration and tokens for any claude run that resumes after background tasks (²). (e) `wallets-quiz-006`'s "showing your reasoning" invites the citation that leaked old-3; the blindness guard caught it. |
