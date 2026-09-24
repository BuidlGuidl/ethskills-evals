# major-refine: orchestration (Opus 5 medium)

| | |
| --- | --- |
| Benchmark id | `major-refine-d9952522` |
| Stack | executor `claude` / `claude-opus-5` / effort `medium` |
| Judge | `claude` / `claude-opus-5` / effort `high` |
| `self_judged` | **true** on every run — judge and executor are the same agent. A caveat on the numbers, not a defect in them. |
| Runs | 3 per arm per task, 3 arms, 5 tasks = 45 runs |
| Arms | **none** = `no_skill`; **old** = `with_skill` @ `2f0adb01`; **new** = `with_skill` @ `d9952522` |
| Tasks | `orchestration-goal-001`, `orchestration-quiz-001..004` — every live task whose `skill:` is `skills/orchestration` |
| Trigger | not forced; these are content-only numbers |
| Harness | every run `executor_exit: 0`, no `harness_failure`, no retractions, no regrades |

**Template pre-flight** (`orchestration-quiz-003`/`004`, per their notes — one install serves both): `yarn install` in `templates/se-2-foundry`, verified by the check the notes pin — `yarn --version` → **4.13.0** and `forge test` in `packages/foundry` → **1 passed** (`YourContractTest::testMessageOnDeployment`). create-eth's postinstall wrote `packages/foundry/.env` with the default `ALCHEMY_API_KEY` / `ETHERSCAN_API_KEY`, which is load-bearing for this row's central claim. Foundry on PATH: `anvil`/`cast` 1.5.1-stable.

**Five old-arm runs were graded with `--allow-skill-mention`** — see "Run incidents" below.

## Headline

Pass counts, **new · old · none**:

| Task | new | old | none |
| --- | --- | --- | --- |
| orchestration-quiz-001 (explorer key ticket) | **3/3** | **3/3** | 0/3 |
| orchestration-quiz-002 | 3/3 | 3/3 | 3/3 |
| orchestration-quiz-003 | 3/3 | 3/3 | 3/3 |
| orchestration-quiz-004 | 3/3 | 3/3 | 3/3 |
| orchestration-goal-001 (launch plan) | **3/3** | 2/3 | 0/3 |
| **Total** | **15/15** | 14/15 | 9/15 |

### The row turns on exactly one fact

Both separating lines grade the same claim — **Scaffold-ETH 2 ships a default block-explorer key, so verification works out of the box and no key has to be obtained**:

- `quiz-001` **expect_1** asks it directly. All three `no_skill` runs fail it, treating "get a key from the explorer / from ops" as a prerequisite. Both skill arms: 3/3.
- `goal-001` **expect_4** buries it in a launch plan — the same claim, applied unprompted. All three `no_skill` runs fail it. New: 3/3. Old: **2/3** (run 3 fails expect_4).

Everything else is saturated: quizzes 002–004 are 9/9 across all three arms, and on `goal-001` seven of eight lines pass in every arm.

**Where the two texts differ.** They are equal when the question is asked directly and unequal when it is buried: the 644-line original loses the fact 1/3 inside a launch plan, the 50-line rewrite does not. That is the row's only new-vs-old signal, and it is one run wide — real, but thin.

**One extra `no_skill` failure**, not shared: `goal-001` run 2 also fails expect_2 (test the live user journey with real small amounts before the frontend goes public). Both skill arms are 0/3 there — `orchestration-transition-gates-implicit`, much weaker than its August 3/3.

## Cost

From `yarn run-stats --tasks … --benchmark major-refine-d9952522`, split per arm. Medians with ranges; `cost_source: executor`.

| Task | arm | turns | duration | cost | cost range | total_tokens |
| --- | --- | --- | --- | --- | --- | --- |
| goal-001 | **new** | 5 | **133s** | **$0.45** | $0.40–$0.63 | **92,694** |
| | old | 7 | 228s | $0.78 | $0.66–$0.81 | 155,218 |
| | none | 4 | 244s | $0.72 | $0.70–$0.98 | 107,502 |
| quiz-001 | **new** | 4 | **35s** | **$0.19** | $0.19–$0.20 | 59,345 |
| | old | 4 | 50s | $0.25 | $0.23–$0.28 | 65,652 |
| | none | 2 | 93s | $0.33 | $0.27–$0.37 | 47,933 |
| quiz-002 | **new** | 4 | **43s** | **$0.22** | $0.21–$0.23 | 61,025 |
| | old | 4 | 58s | $0.25 | $0.25–$0.26 | 66,067 |
| | none | 2 | 80s | $0.27 | $0.25–$0.28 | 44,460 |
| quiz-003 | new | 39 | 269s | $1.63 | $0.56–$2.71 | 1,516,614 |
| | old | 33 | 242s | $1.55 | $0.85–$2.19 | 1,375,788 |
| | **none** | 24 | **139s** | **$0.96** | $0.86–$1.42 | 717,922 |
| quiz-004 | **new** | 13 | **134s** | **$0.58** | $0.56–$1.04 | 358,963 |
| | old | 21 | 295s | $1.07 | $0.90–$1.12 | 708,435 |
| | none | 19 | 307s | $0.92 | $0.78–$1.11 | 697,334 |

The rewrite is cheapest and fastest on four of five tasks, and beats `no_skill` on those four as well — clearest on `goal-001` (133s/$0.45 against 228s/$0.78 and 244s/$0.72) and `quiz-004` (134s/$0.58 against 295s/$1.07 and 307s/$0.92, on roughly half the tokens).

`quiz-003` is the exception and should not be read as a finding: both skill arms cost more than `no_skill`, but the ranges are enormous — new $0.56–$2.71 against old $0.85–$2.19 — so at n=3 the medians are not separable. This is the task where runs drive a local chain, and the spread is the chain work, not the skill.

## Run incidents

**Judge-blindness guard, 5 old-arm runs** (`goal-001` ×3, `quiz-002` ×2). `verify` refused to grade because the deliverables cite sibling ethskills skills by public URL — `https://ethskills.com/audit/SKILL.md`, `.../qa/SKILL.md` — inside their own recommendations. I read every hit: none reveals the harness. A repo-wide grep for `.agents/skills`, `.claude/skills` or "the skill I was given" across all 45 runs' evidence returns nothing.

Graded with `--allow-skill-mention`, following the precedent set on the ship row, for its stated reason: **resampling would select the sample on the behavior under test.** The old text's tendency to send readers to sibling skills is itself the bundling behavior other rows have measured, so re-running until a run stops doing it would erase the signal being studied.

Residual risk, stated rather than dismissed: a judge could still infer that a run citing ethskills.com sibling skills probably had skill context. That inference channel is weaker than a direct harness leak but is not zero, and it applies only to the old arm — the arm that lost a run on `goal-001`. Since the loss is a *failure*, any such bias would have to have been generous, so it does not manufacture the new-vs-old gap.

**Rate limit, 1 run.** `orchestration-quiz-001 none 1` hit the account session limit mid-row. The run was deleted before it could be graded, automatically re-queued, and re-executed after capacity returned (10 minutes later); every other worker paused rather than burning into the same wall. No run in this report was graded over a refusal, and none was lost. For contrast, the same fault destroyed 17 runs on the noir row.

**Checked and absent:** `lib/`-directory evidence loss (this row's only bare goal task shows no imports pointing outside its snapshot), truncated run stats (all 45 runs have `usage.duration_s` within 1s of the `executor.yaml` wall clock — including the nine `quiz-003` runs that actually used backgrounded tasks, the at-risk population for that fault), and backgrounded-install truncation.

## Mistakes

No new records; both existing ones re-measured on this stack.

| id | none | old | new |
| --- | --- | --- | --- |
| `orchestration-stale-verification-key` — quiz-001 | 3/3 | 0/3 | 0/3 |
| `orchestration-stale-verification-key` — goal-001 | 3/3 | **1/3** | 0/3 |
| `orchestration-transition-gates-implicit` — goal-001 | 1/3 | 0/3 | 0/3 |

The verification-key prior has **not moved at all** since 2026-08-13: still 3/3 unaided on both tasks. It stays `status: fixed` for the rewrite and now carries the old text's 1/3 on the goal task. `orchestration-generated-registry-churn` was not exercised by any failure in this row.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **new vs none: 15/15 vs 9/15.** Per task `3/3 · 3/3 · 3/3 · 3/3 · 3/3` against `0/3 · 3/3 · 3/3 · 3/3 · 0/3`. **new vs old: 15/15 vs 14/15**, the single difference being `goal-001` run 3, where the old text loses the explorer-key fact inside a launch plan. |
| Did it reduce time/tokens? | Yes, against both arms, on four of five tasks. `goal-001`: `133s / 93k / $0.45` (new) vs `228s / 155k / $0.78` (old) vs `244s / 108k / $0.72` (none). `quiz-004`: `134s / 359k / $0.58` vs `295s / 708k / $1.07` vs `307s / 697k / $0.92`. `quiz-003` is unreadable at n=3 (ranges overlap almost completely). |
| Did it create negative deltas? | None for the new text — it is ≥ both arms on every expect line of every task. The old text's one loss is `goal-001` expect_4. |
| What mistakes repeated without the skill? | `orchestration-stale-verification-key` 3/3 on both tasks; `orchestration-transition-gates-implicit` 1/3. |
| What mistakes remained with the skill? | With **new**: none. With **old**: `orchestration-stale-verification-key` 1/3 on `goal-001`. |
| What should change in the skill? | Nothing this row justifies. The rewrite is 15/15, cheaper and faster on four of five tasks, and the only behavioural difference from the 644-line text favours it. Worth noting for whoever edits it next: the *entire* measured value of this skill on this stack is one fact — SE2's default explorer key. Everything else it says is either already known to the model or untested here. |
| What should change in the eval? | **(1) Three of five tasks are saturated at 9/9** and measure nothing on this stack; quizzes 002–004 cost ~2.8M tokens per arm to confirm a ceiling. **(2) The row rests on one claim tested twice.** quiz-001 expect_1 and goal-001 expect_4 grade the same fact, asked-directly and applied-unprompted — a good pairing, but it means "orchestration helps" currently means "orchestration knows about the SE2 explorer key". New coverage should target a second claim. **(3) `goal-001` expect_2 is the only other line that ever fails** and did so once; the remaining six lines have never discriminated. **(4) The judge-blindness guard fires on public sibling-skill URLs in deliverables**, which is a normal thing for this skill's output to contain — 5 of 15 old-arm runs. Either the guard should not match `ethskills.com/*/SKILL.md` in an executor's own prose, or the task notes should pre-authorise `--allow-skill-mention` for this skill, so the decision is not re-litigated per operator. **(5) `result.yaml` stores no judge rationale.** |
