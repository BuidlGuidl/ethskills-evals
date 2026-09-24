# major-refine: `skills/testing` on Opus 5 medium

| | |
| --- | --- |
| Benchmark id | `major-refine-d9952522` |
| Benchmark commit | `d99525222883df0b32decbfb81e1a13f9c27cfed` |
| Executor | claude · `claude-opus-5` · medium |
| Judge | claude · `claude-opus-5` · high |
| `self_judged` | **true** on every run — judge and executor are the same agent |
| Runs | 3 per arm per task, 63 runs, all graded |
| Arms | none (`no_skill`) · old (`--skill-ref 2f0adb01`) · new (`--skill-ref d9952522`) |
| Tasks | `testing-goal-001`, `testing-quiz-001` … `testing-quiz-006` (every live task with `skill: skills/testing`) |

`self_judged: true` is expected on a single-stack benchmark and is a caveat on these numbers, not a defect in them. The three open-model stacks and GPT 5.5 high remain unrun for this skill.

## Headline

Pass counts per arm, **new · old · none**:

| Task | new | old | none |
| --- | --- | --- | --- |
| `testing-goal-001` | 3/3 | 3/3 | 2/3 |
| `testing-quiz-001` | 3/3 | 3/3 | 3/3 |
| `testing-quiz-002` | 3/3 | 3/3 | 3/3 |
| `testing-quiz-003` | 3/3 | 3/3 | 3/3 |
| `testing-quiz-004` | 3/3 | 3/3 | 3/3 |
| `testing-quiz-005` | 3/3 | 3/3 | 3/3 |
| **Six-task total** | **18/18** | **18/18** | **17/18** |

`testing-quiz-006` is reported separately, as its own notes require ("Do not blend it into earlier six-task totals; report it as a separate 3-per-variant forward-validation result"):

| Task | new | old | none |
| --- | --- | --- | --- |
| `testing-quiz-006` (held-out forward check) | **3/3** | **0/3** | **1/3** |

**Only two cells in the whole benchmark failed anything**, and they are the entire result:

- `goal-001` expect_2 (accounting drift), lost by one no_skill run.
- `quiz-006` expect_3 (archive depth), lost by **all three** old-text runs and two of three no-skill runs, and by none of the refined-text runs.

Every other one of the 63 runs passed every expect line.

## What the refinement changed

`2f0adb01` → `d9952522` is a near-total rewrite: 379 lines to 63, 1527 words to 1056. The old text is a Foundry tutorial — `### Test File Structure`, `### Basic Fuzz Test`, `### Running Invariant Tests`, ten Solidity and shell blocks, a nine-item checklist. The refined text drops almost all the code and states decision rules instead: which search each class of risk maps to, why a mock cannot surface a deviation it was written from, that one post-operation mismatch proves divergence and not accumulation, that `targetContract` must point at a handler, and that pinning an old block is an archive request.

## The one cell that discriminates: `quiz-006` expect_3

> answer.md requires testing the deployed Chainlink feed and collateral token on a real fork rather than relying only on standard-behaviour mocks, pins a specific block for reproducibility, **and says to confirm the RPC endpoint can serve the historical state at that block (archive depth)** before treating failures as contract failures.

The refined skill states this outright:

> Pinning an old block is an archive request. A full node keeps only recent state — geth's default window is roughly the last 128 blocks — and answers anything older with an error rather than a wrong number. […] confirm it answers a historical `eth_call` at your block before pinning that block.

The old skill recommends pinning — a `### Fork at specific block (reproducible)` comment — and never mentions the constraint. Its three runs all pinned and all omitted the archive check. That is the documented gap in [[testing-skill-fork-example-needs-archive]] reproducing on a task whose vocabulary was deliberately rotated away from the skill's own example, which is stronger evidence than the same-task reruns that record has carried until now.

Two honest limits on it. The refinement rewrote the whole skill, so the uplift belongs to the revision, not provably to that paragraph. And the old arm scored *below* no-skill here (0/3 against 1/3) — at n=3 that is one run and should not be read as the old text actively harming the answer.

## Quizzes 001–005 measured nothing

45 runs, three arms, not one failing cell — including the unskilled baseline. On this stack these five tasks cannot distinguish the refined skill from the old one, nor either from no skill at all. Filed as [[testing-eval-quizzes-saturated-on-opus5]].

This is what `testing-goal-001`'s own notes predicted: "every turn of the loop that writes a measured miss into the skill shrinks what these cells can still discriminate", sharpest "on quiz-001, quiz-004 and quiz-005, whose graded surface the revision covers outright". The refined text does restate several of these expect lines almost directly. But the no_skill arm also passes them 3/3, so this is not skill contamination alone — Opus 5 at medium already holds the material. Do not read those 15/15 cells as evidence the refinement helped, nor as evidence it did no harm.

## Method, per `goal-001` run

The task requires recording which discipline reached each defect, because grading is outcome-based by design and the method split is the applies-unprompted signal. Counted from the test files each run actually wrote (`run.diff`):

| Arm | run | `testFuzz_` | `invariant_` | handler `targetContract` | fork |
| --- | --- | --- | --- | --- | --- |
| none | 1 | 2 | 2 | 1 | 3 |
| none | 2 | **0** | 4 | 1 | 3 |
| none | 3 | 2 | 3 | 1 | 1 |
| old | 1 | **0** | 5 | 1 | 1 |
| old | 2 | 3 | 4 | 1 | 1 |
| old | 3 | 3 | 4 | 1 | 1 |
| new | 1 | 2 | 2 | 1 | 2 |
| new | 2 | 2 | 3 | 1 | 1 |
| new | 3 | 1 | 1 | 1 | 1 |

**Every run in every arm wrote a handler-driven invariant and a fork test.** Fuzzing: none 2/3, old 2/3, new 3/3.

This is the finding that matters most for the eval, and it is not a skill result. `goal-001` exists because an unskilled model was believed to skip these searches; on Opus 5 medium the baseline performs all three unprompted. The condition the task notes name — "If all three no_skill runs find everything by inspection, this task measured code review rather than testing judgment" — is met in substance, by a different route: it is not inspection, it is the baseline doing the searches. [[testing-no-fuzz-unprompted]] is updated with this measurement and kept open, because the gap is still live on codex/gpt-5.6-sol and the weaker stacks are unmeasured.

Worth recording: several runs across all three arms independently reported the **fourth, un-planted issue** the notes describe — Aave interest accruing in the pool but never reaching the share price, because the vault prices shares off `totalAssetsStored`. One no_skill run evidenced it on a fork with real numbers (100000000000 held at deposit against 104256651917 after 365 days). Per the notes this is correct, not hallucinated, and is not graded.

## Cost

All figures from `yarn run-stats --tasks <ids> --benchmark major-refine-d9952522`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. `cost_source: executor` throughout (claude's own reported price). Medians, with range and median `total_tokens`.

| Task | new | old | none |
| --- | --- | --- | --- |
| `goal-001` | **504s · $2.39** ($2.30–$2.50) · 1.40M | 880s · $3.74 ($3.34–$3.78) · 2.51M | 684s · $2.73 ($2.59–$2.92) · 1.70M |
| `quiz-001` | 60s · $0.29 · 86.8k | 118s · $0.46 · 80.4k | 79s · $0.33 · 84.1k |
| `quiz-002` | 71s · $0.30 · 85.2k | 72s · $0.32 · 72.9k | 66s · $0.26 · 61.7k |
| `quiz-003` | 83s · $0.36 · 112k | 101s · $0.42 · 103k | 76s · $0.29 · 63.2k |
| `quiz-004` | 55s · $0.26 · 84.4k | 101s · $0.41 · 102k | 73s · $0.27 · 62.3k |
| `quiz-005` | 100s · $0.40 · 91.8k | 108s · $0.45 · 104k | 107s · $0.37 · 68.1k |
| `quiz-006` | 75s · $0.33 · 88.5k | 129s · $0.50 ($0.34–$0.55) · 105k | 112s · $0.37 · 70.7k |

**The refined text is cheaper and faster than the old text on all seven tasks.** On `goal-001` it beats the old arm by 376s and $1.35 per run, and beats the *unskilled* baseline too — 504s against 684s, $2.39 against $2.73, 1.40M tokens against 1.70M. A shorter skill that routes the model to the right three searches immediately costs less than no skill at all on the one task with real work in it.

Against no-skill the quizzes go the other way on tokens: the refined skill adds roughly 20–50k tokens per quiz (its own text, billed through `cache_creation_input_tokens` and re-read each turn), while roughly matching on dollars and beating on wall clock. That is the skill's prompt cost showing up on tasks too small to amortise it.

## Run incidents

Two runs were refused by `verify`'s judge-blindness guard and are **not** in the tables above:

- `testing-quiz-006` new-1 (`2026-09-21T124623Z-claude-with-skill-d9952522-1`) — `answer.md` wrote "(`addresses/SKILL.md` in the testing skill)".
- `testing-quiz-006` new-3 (`2026-09-21T131041Z-claude-with-skill-d9952522-3`) — "the canonical list in the skill's `addresses/SKILL.md` reference".

Both executors exited 0; only grading was blocked. A judge reading either line learns a skill was installed, so these are genuine variant leaks, not incidental matches. Per AGENTS.md ("a dead or refused run … delete it and set it up again") both run dirs and workspaces were deleted and each was set up and run once more. Both re-runs graded clean with no mention and passed 4/4. **Each refused run was replaced by exactly one fresh sample** — not re-rolled until clean, which would have biased the new arm toward runs that ignored the skill's cross-reference. Neither `--allow-skill-mention` nor `--grade-failed-run` was used anywhere in this benchmark.

The `addresses/SKILL.md` pointer is in **both** skill texts (twice in the old, once in the refined), so this is not a defect introduced by the refinement; these two runs simply followed the pointer and said so. No old-arm or no-skill run leaked.

## The evidence check `goal-001` mandates could not be completed

The task notes require: "Cross-check every run's FINDINGS.md against its transcript.md; a fabricated forge run is a mistake record, not a pass." That check is not fully executable. `transcript.md` elides long tool results as `… [N more chars]`, and all nine goal runs carry 32–56 such truncated blocks — falling precisely on the forge output the expects grade. Matching pasted result lines verbatim reports 6–29 unmatched lines per run, none of which indicates fabrication; they are lines the renderer cut.

What was checkable: every run really did invoke forge (5–14 visible invocations with real compiler and test output attached), untruncated prefixes agree with `FINDINGS.md` wherever they overlap, and all three planted defects are corroborated in visible transcript text. **No run showed any sign of fabricated evidence.** That is a weaker claim than the notes ask for, and it is stated as such rather than reported as the mandated check passing. Filed as [[testing-eval-transcript-truncation-blocks-evidence-check]].

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **new vs none:** six-task `18/18 vs 17/18`; held-out `quiz-006` `3/3 vs 1/3`. **new vs old:** six-task `18/18 vs 18/18`; held-out `quiz-006` `3/3 vs 0/3`. The refinement's whole measured gain over the old text is `quiz-006` expect_3. |
| Did it reduce time/tokens? | Yes, decisively, and on every task. `goal-001`: **new 504s / 1.40M / $2.39** vs **old 880s / 2.51M / $3.74** vs **none 684s / 1.70M / $2.73**. The refined text is faster and cheaper than the old text everywhere, and beats even the unskilled baseline on the goal task. On the quizzes it adds ~20–50k tokens over no-skill (its own prompt) while still beating both other arms on wall clock. |
| Did it create negative deltas? | None on pass rate — no cell where new lost and old or none won. Two cost-side notes: the refined text still costs ~20–50k tokens per quiz over no-skill on tasks too small to amortise it, and its `addresses/SKILL.md` cross-reference induced two judge-blindness refusals (see Run incidents) — a pointer the old text also carries, twice. |
| What mistakes repeated without the skill? | [[testing-skill-fork-example-needs-archive]] (`quiz-006` expect_3, 2/3 no-skill runs); [[testing-goal-accounting-drift-not-evidenced]] (`goal-001` expect_2, 1/3). [[testing-no-fuzz-unprompted]] did **not** repeat as a method gap — baseline forked 3/3 and wrote handler invariants 3/3, and fuzzed 2/3. |
| What mistakes remained with the skill? | With the refined text: none — 21/21 runs passed every line. With the old text: [[testing-skill-fork-example-needs-archive]] in 3/3 `quiz-006` runs, the only mistake to reproduce in a full arm anywhere in this benchmark. |
| What should change in the skill? | Nothing on this evidence. The refined text passed every expect in all 21 of its runs while being the cheapest and fastest arm. Worth considering: the `addresses/SKILL.md` cross-reference is what executors quoted into deliverables and tripped the blindness guard twice — a phrasing that names the address list without naming a skill file would cost nothing and avoid it. Do not act on this benchmark alone; the three unrun stacks are where the old text's material may still be carrying weight. |
| What should change in the eval? | This is where the work is. **(1)** `quiz-001`–`005` are saturated on this stack — 45 runs, zero failing cells, baseline included — and measure nothing; rotate their planted decisions rather than loosening rubrics ([[testing-eval-quizzes-saturated-on-opus5]]). **(2)** `goal-001` no longer measures the prior it was built for: the unskilled baseline performs fuzz, handler invariants and forks unprompted, so on this stack it grades code review plus execution, not testing judgment. **(3)** The fabricated-evidence cross-check its notes mandate cannot be completed, because `transcript.md` truncates the tool output it grades and the full capture is gitignored, so no PR reviewer can repeat it ([[testing-eval-transcript-truncation-blocks-evidence-check]]). **(4)** `quiz-006` is the only task that still discriminates, and it does so through a single cell; the held-out-with-rotated-vocabulary design is what worked, and more tasks should be built that way. |
