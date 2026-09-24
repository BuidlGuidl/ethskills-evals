# eval: testing — codex / gpt-5.5 / high

**Benchmark:** `major-refine-d9952522` ([#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)),
harness and task set pinned at `d9952522`.

**Stack:** executor `codex`, model `gpt-5.5`, reasoning effort `high`.

**Judge:** `claude`, model `claude-opus-5`, effort `high`, fresh and blind for every
grade. `self_judged: false` on all 63 runs — the judge is a different agent from the
executor on this stack.

**Arms:** three, 3 runs each per task.

| Arm | Variant | `skill_version` |
| --- | --- | --- |
| none | `no_skill` | `null` |
| old | `with_skill --skill-ref 2f0adb01…` | `2f0adb01` |
| new | `with_skill --skill-ref d9952522…` | `d9952522` |

**Tasks:** every live task on `skills/testing` — `testing-quiz-001` … `testing-quiz-006`
and `testing-goal-001`. 63 runs, all graded, none retracted.

**Trigger:** content-only. No run was told to use the skill.

## Headline

Pass counts per arm, new · old · none.

| Task | new | old | none |
| --- | --- | --- | --- |
| quiz-001 (invariant stayed green) | **3/3** | 2/3 | 2/3 |
| quiz-002 (unbounded fee under 100% coverage) | **1/3** | 3/3 | 3/3 |
| quiz-003 (mock hid the real token) | 3/3 | 3/3 | 3/3 |
| quiz-004 (fork flake) | 3/3 | 2/3 | 3/3 |
| quiz-005 (tautological suite) | 1/3 | 0/3 | 0/3 |
| quiz-006 (held-out integration) | **3/3** | 0/3 | 0/3 |
| goal-001 (convince me it is safe) | **2/3** | 0/3 | 1/3 |
| **total** | **16/21** | 10/21 | 12/21 |

The refined text is ahead of both other arms overall, and the aggregate hides that the
movement is concentrated in three cells, in both directions.

## Where the difference actually is

Per-expect, the only cells that move are these. Everything else is either passed by all
nine runs of a task or failed by all nine.

| Cell | new | old | none | Reading |
| --- | --- | --- | --- | --- |
| quiz-006 expect_3 (archive depth on a pinned fork) | 3/3 pass | 0/3 | 0/3 | The clearest result in the benchmark. The old text lacked the archive paragraph, the new one has it, and the old arm is the control every earlier reading of [[testing-skill-fork-example-needs-archive]] was missing. It is recall — the skill states the answer — but the edit is doing the work. |
| goal-001 expect_1 (unbounded deposit fee) | 2/3 pass | 0/3 | 1/3 | Carries the goal headline almost alone. The misses are omissions: `setDepositFee` is never exercised and neither `NoSharesMinted` nor an underflow appears in those runs' diffs. |
| quiz-002 expect_4 (the setter is the defect) | 1/3 pass | 3/3 | 3/3 | The negative delta. See below. |
| quiz-005 expect_1 (tautological assertions) | 1/3 pass | 0/3 | 0/3 | Missed by 8 of 9 runs, in every arm. |
| quiz-001 expect_2 (`fail_on_revert` defaults false) | 3/3 pass | 2/3 | 2/3 | One miss in each of the other two arms. |
| quiz-004 expect_3 (re-baseline the pinned values) | 3/3 pass | 2/3 | 3/3 | Single old-arm miss; it pins the block and leaves the live-state assertions in place. |

### The negative delta, quiz-002

Two of three runs on the refined text worked the fee arithmetic correctly, named fuzzing
over the full range as the technique, and then never said that the underlying defect is
the missing `require(newFeeBps <= BPS_DENOMINATOR)` in the setter. One framed the remedy
as a disjunction — after any accepted fee a deposit "should either succeed and mint
shares, or the setter should have rejected that fee as invalid" — which leaves the fix as
one of two acceptable worlds. Both other arms named the setter fix 3/3. Filed as
`testing-quiz-setter-validation-not-named`.

The pairing is worth naming because the same skill text wins goal-001 expect_1 on the
other half of this exact bug: the refined text is better at finding the bound and worse
at saying it should be bounded.

## Method, per bug (observation, never graded)

`tasks/testing-goal-001.yaml` requires this split be recorded. Across all nine goal runs:

| Bug | How it was reached |
| --- | --- |
| unbounded fee (expect_1) | Reached in 3 of 9 runs: one fuzz campaign (`testFuzz_DepositFeeMustRejectValuesAtOrAboveOneHundredPercent`, new arm run 3), two inspection-plus-targeted-unit-test. Omitted entirely in the other six. |
| withdrawal-fee accounting (expect_2) | 9/9, every one of them inspection plus one targeted unit test. No handler invariant was written in any arm — the one file named `…AccountingInvariant.t.sol` contains `test_` functions, not `invariant_` ones. |
| real USDT approve (expect_3) | 8/9 by fork, as the fixture forces. The single miss (none, run 3) wrote no fork test at all — no `createSelectFork` and no `--fork-url` anywhere in its transcript. |

Two consequences the task notes ask for explicitly. First, **on this stack goal-001 is
measuring code review for expect_2**: all nine runs found the accounting drift by reading
`src/`, so that column discriminates nothing about testing judgment. Second, the fuzz and
invariant claims are still alive in *every* arm — one fuzz test and zero invariants in
nine runs — while the fork claim is dead on this stack, reached unprompted by 3/3
baselines. Recorded in `testing-no-fuzz-unprompted`.

No run reported the fourth, un-planted issue (Aave interest never reaching the share
price) as a separate finding, though several touched the same accounting-versus-holdings
theme while evidencing expect_2.

## Evidence integrity

Every `forge` command pasted into a FINDINGS.md was cross-checked against that run's
`transcript.md`: 9/9 runs clean, no fabricated command and no fabricated output. The only
string that did not match is forge's own `forge test --rerun` hint line, which appears
inside pasted output rather than as a command any run claimed to issue.

## Cost

From `yarn run-stats --tasks … --benchmark major-refine-d9952522`, split per arm.
Medians with the range beside them; codex dollars are `cost_source: list_price`
(token split × list price in `lib/prices.ts`), not what the account was billed.

| Task | new | old | none |
| --- | --- | --- | --- |
| quiz-001 | 60s · 81k · $0.17 ($0.17–$0.17) | 86s · 120k · $0.26 ($0.19–$0.30) | 65s · 76k · $0.16 ($0.14–$0.24) |
| quiz-002 | 50s · 79k · $0.14 ($0.14–$0.19) | 61s · 104k · $0.19 ($0.18–$0.24) | 40s · 71k · $0.12 ($0.08–$0.12) |
| quiz-003 | 46s · 77k · $0.13 ($0.12–$0.15) | 66s · 86k · $0.19 ($0.17–$0.22) | 53s · 74k · $0.14 ($0.12–$0.15) |
| quiz-004 | 42s · 76k · $0.13 ($0.11–$0.14) | 41s · 79k · $0.13 ($0.12–$0.15) | 40s · 57k · $0.12 ($0.09–$0.13) |
| quiz-005 | 54s · 79k · $0.15 ($0.14–$0.19) | 68s · 123k · $0.21 ($0.16–$0.29) | 57s · 76k · $0.16 ($0.15–$0.17) |
| quiz-006 | 51s · 79k · $0.15 ($0.14–$0.16) | 50s · 85k · $0.17 ($0.16–$0.18) | 40s · 42k · $0.11 ($0.08–$0.12) |
| goal-001 | 368s · 772k · $1.20 ($1.13–$1.58) | 418s · 555k · $1.22 ($1.01–$1.22) | 313s · 693k · $0.95 ($0.80–$1.40) |

The skill costs what a skill costs: both skilled arms are dearer than the baseline on
every task. Between the two skilled arms the refined text is cheaper on five of seven
quizzes despite being the longer answer surface, and on the goal task the two are level
on dollars while the refined arm spends its budget on more tokens in less time.

## Caveats

- `n=3` per arm. A one-run difference is one run, and the quiz-004 and quiz-001 cells in
  the table above are exactly that.
- The judge's per-condition reasoning is not retained by the harness, so every attribution
  of *why* a cell failed is read off the committed answer, not off the grade.
- quiz-002, quiz-005 and quiz-006 grade surfaces the refined skill text partly restates,
  as `tasks/testing-goal-001.yaml` warns. Uplift on those cells is recall, not transfer.
- Codex hit its account usage limit partway through the session; 15 runs died with
  `exit: 1` and were deleted and re-run after the reset, per the hard rules. No graded
  record in this benchmark comes from a limit-killed process.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none: `16/21 vs 12/21`. new vs old: `16/21 vs 10/21`. Per task, new is ahead on quiz-001, quiz-005, quiz-006 and goal-001, level on quiz-003, and behind on quiz-002. |
| Did it reduce time/tokens? | No — it costs. Median per quiz, new `46–60s / 76–81k / $0.13–$0.17` vs none `40–65s / 42–76k / $0.11–$0.16`; goal-001 new `368s / 772k / $1.20` vs none `313s / 693k / $0.95`. Against the old text the refined one is cheaper on five of seven quizzes (e.g. quiz-005 `54s / 79k` vs `68s / 123k`) and level on the goal. |
| Did it create negative deltas? | One, and it is real: quiz-002 `1/3` new against `3/3` in both other arms, all on expect_4 — the answer names the technique and never names the setter fix (`testing-quiz-setter-validation-not-named`). |
| What mistakes repeated without the skill? | `testing-skill-fork-example-needs-archive` (quiz-006 expect_3, 3/3 in none and old), `testing-quiz-tautological-tests-missed` (quiz-005, 3/3 both), `testing-goal-unbounded-fee-missed` (goal expect_1, none 2/3, old 3/3), `testing-goal-usdt-fork-missed` (none 1/3), `testing-quiz-fail-on-revert-not-explained` (none 1/3, old 1/3), `testing-quiz-pinned-values-not-rebaselined` (old 1/3). |
| What mistakes remained with the skill? | `testing-quiz-tautological-tests-missed` (2/3 on the refined text — reopened; it was called saturated on the previous stack), `testing-goal-unbounded-fee-missed` (1/3), `testing-no-fuzz-unprompted` (one fuzz test and zero invariants across nine goal runs, refined arm included), plus the new `testing-quiz-setter-validation-not-named`. |
| What should change in the skill? | (1) In the fuzz section, close the loop the refined text opened: after the breaking input is found, name the missing validation in the setter as the defect and give the bound check — quiz-002 shows the technique advice displacing the fix. (2) The invariant section is not landing at all on this stack: zero handler invariants in nine goal runs, and one run named a file `…Invariant.t.sol` while writing `test_` functions. It needs the mechanical shape (handler, `targetContract`, `fail_on_revert`), not the rationale. (3) Tautology detection (quiz-005) survives the refined text 2/3 — the "make tests capable of failing" material does not transfer to classifying assertions someone else wrote. |
| What should change in the eval? | goal-001 expect_2 is saturated (9/9, all by inspection) and expect_3 nearly so (8/9); the task now rests on expect_1 alone, which is what the notes predicted would happen as measured misses get written back into the skill. The planted defects need rotating rather than the rubric loosening. quiz-003 is 9/9 across three arms and discriminates nothing on this stack. quiz-005 is the opposite problem and the more interesting one: 8/9 missed here after being recorded as saturated at 0/3 on codex/gpt-5.6-sol, which says the previous "saturated" reading was a property of that stack, not of the quiz — worth re-reading before anything is retired on saturation grounds again. |
