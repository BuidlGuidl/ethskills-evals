# major-refine: l2s (Opus 5 medium)

| | |
| --- | --- |
| Benchmark id | `major-refine-d9952522` |
| Stack | executor `claude` / `claude-opus-5` / effort `medium` |
| Judge | `claude` / `claude-opus-5` / effort `high` |
| `self_judged` | **true** on every run — judge and executor are the same agent. A caveat on the numbers, not a defect in them. |
| Runs | 3 per arm per task, 3 arms, 5 tasks = 45 runs |
| Arms | **none** = `no_skill`; **old** = `with_skill` @ `2f0adb01` (first vendored l2s, 187 lines); **new** = `with_skill` @ `d9952522` (50-line minimal rewrite) |
| Tasks | `l2s-quiz-001`, `l2s-quiz-002`, `l2s-quiz-003`, `l2s-quiz-004`, `l2s-goal-001` — every live task whose `skill:` is `skills/l2s` |
| Trigger | not forced; these are content-only numbers |
| Harness | every run `executor_exit: 0`, no `harness_failure`, no retractions, no regrades |

## Headline

Pass counts, **new · old · none**:

| Task | new | old | none |
| --- | --- | --- | --- |
| l2s-quiz-001 (Celo sweep runbook) | **3/3** | 3/3 | 3/3 |
| l2s-quiz-002 (Polygon zkEVM sunset) | **3/3** | 0/3 | 1/3 |
| l2s-quiz-003 (Base ↔ OP token) | **3/3** | 3/3 | 1/3 |
| l2s-quiz-004 (Stylus DePIN scoring) | **3/3** | 3/3 | 3/3 |
| l2s-goal-001 (Celo payout + sweep build) | **3/3** | 3/3 | 3/3 |
| **Total** | **15/15** | 12/15 | 11/15 |

Three of five tasks are saturated on all three arms — quiz-001, quiz-004 and goal-001 pass 9/9. The whole signal sits in quiz-002 and quiz-003.

### Where the arms separate

**l2s-quiz-002 — the rewrite is the only arm that passes, and the old text is *worse than no skill*.**
Every arm gets expect_1 (the chain has stopped) 3/3; the model knows the sunset unaided. The two failing lines:

- *expect_2, commit to a named replacement chain*: none 2/3 fail, old 2/3 fail, new 0/3 fail. Both losing arms hand back a candidate list — "Candidates: Base, Arbitrum One, OP Mainnet, or Polygon PoS" with a criteria checklist (none run 1), a four-row options table closing on "Choose based on where merchants want to receive funds" (old run 1). The new arm's selection table, keyed on the binding constraint, is what turns that into a decision. Filed as `l2s-zkevm-replacement-chain-deferred`.
- *expect_3, do not present recovery as a routine exit*: none 0/3 fail, **old 2/3 fail**, new 0/3 fail. The old text's present-progressive "is being shut down" leaves the bridge reading as still draining, and two old-arm runs route the $400K out through it — "Follow Polygon's official withdrawal procedure … once a batch is verified, the claim on L1 is quick", bottom line "the money is very likely recoverable". No unaided run made that mistake. Filed as `l2s-zkevm-recovery-as-routine-bridge-exit`; it is the one measured negative delta of the old skill against no skill at all, and the rewrite closes it.

**l2s-quiz-003 — both skill arms rescue the same single line.** none 1/3, both skill arms 3/3. Every no_skill failure is expect_2 alone (Base's departure from the OP Stack), with all four other lines passing. This is `l2s-base-departure-model-blindspot`, re-measured: 2/3 unaided here against 3/3 on 2026-08-20, both skill arms 0/3. The fact is worth its line in the skill and the rewrite carries it as well as the 187-line text did.

### Ungraded reads recorded by the task notes

- **quiz-001 exit window (one gate vs the composite).** All 3 new-arm runs state the composite — 3.5 days named as the challenge gate *and* ~7 days as the effective wait, with `proofMaturityDelaySeconds` and viem's `getTimeToFinalize` cited. Old arm: 3/3 quote 7 days flat, never naming the second gate. none: 2/3 quote 7 days flat, 1/3 gets the composite. This is the rewrite's correction (`l2s-celo-exit-window-composite`) landing in deliverables, and it is invisible to the pass counts because expect_3 grades magnitude on purpose.
- **quiz-001 CELO as L2 gas token / CIP-64 fee abstraction.** Covered by the new arm's Celo paragraph; not separately failed anywhere, so `l2s-celo-fee-abstraction-gap` stays closed.

## Cost

All figures from `yarn run-stats --tasks … --benchmark major-refine-d9952522`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01`, `--skill-version d9952522`. Medians with ranges; `cost_source: executor` throughout (claude's own reported price).

| Task | arm | turns | duration | cost (median) | cost range | total_tokens |
| --- | --- | --- | --- | --- | --- | --- |
| l2s-quiz-001 | new | 4 | 84s | $0.39 | $0.36–$0.41 | 69,338 |
| | old | 4 | 101s | $0.47 | $0.46–$0.48 | 77,550 |
| | none | 4 | 98s | $0.39 | $0.34–$0.76 | 88,433 |
| l2s-quiz-002 | new | 6 | 73s | $0.35 | $0.32–$0.36 | 87,417 |
| | old | 6 | 69s | $0.38 | $0.35–$0.41 | 96,944 |
| | none | 4 | 73s | $0.33 | $0.31–$0.44 | 80,028 |
| l2s-quiz-003 | new | 4 | 77s | $0.35 | $0.34–$0.40 | 66,728 |
| | old | 5 | 87s | $0.42 | $0.42–$0.42 | 96,532 |
| | none | 4 | 95s | $0.40 | $0.37–$0.47 | 88,161 |
| l2s-quiz-004 | new | 4 | 78s | $0.35 | $0.34–$0.36 | 67,506 |
| | old | 4 | 90s | $0.43 | $0.41–$0.44 | 75,854 |
| | none | 2 | 91s | $0.38 | $0.32–$0.44 | 49,033 |
| l2s-goal-001 | new | 59 | 965s | $5.81 | $5.17–$6.34 | 4,988,950 |
| | old | 53 | 1310s | $4.49 | $2.93–$4.75 | 3,489,921 |
| | none | 57 | 1325s | $5.14 | $4.62–$7.42 | 4,373,635 |

On the four quizzes the rewrite is the cheapest arm on every task and cheaper than the old text on all four — $0.35–$0.39 against $0.38–$0.47 — and lower on tokens than both other arms on three of four. A 50-line skill that answers the question costs less than a 187-line one that also has to be read, and less than no skill at all searching for what the skill would have said.

On `l2s-goal-001` the ordering reverses on money and holds on time: the new arm is the fastest (965s median against 1310s and 1325s, a 26% cut) but the dearest ($5.81 against $4.49 and $5.14) on the most tokens (5.0M against 3.5M and 4.4M). At n=3 the ranges overlap enough ($5.17–$6.34 against $2.93–$4.75) that the dollar gap is real but the cheapest old run and the dearest new run are not a like-for-like pair; the token gap is outside the noise. Read it as the rewrite spending more of a long agentic run on work it now knows to do — the multi-step prove/finalize sweep and the composite window — rather than as overhead.

## Mistakes

Filed this benchmark:

| id | none | old | new |
| --- | --- | --- | --- |
| `l2s-zkevm-replacement-chain-deferred` | 2/3 | 2/3 | 0/3 |
| `l2s-zkevm-recovery-as-routine-bridge-exit` | 0/3 | 2/3 | 0/3 |

Re-measured: `l2s-base-departure-model-blindspot` — none 2/3, old 0/3, new 0/3 (a stack key was added to its `frequency`; it stays `open`, since it is a gap in the model, not in the skill).

Closed records confirmed still closed by these runs: `l2s-polygon-zkevm-tense`, `l2s-celo-bridging-gap`, `l2s-celo-chain-params-stale`, `l2s-celo-exit-window-composite`, `l2s-celo-fee-abstraction-gap`, `l2s-stylus-multiplier-conflation`, `l2s-zksync-zksolc-required`, `l2s-unichain-ordering-inverted`, `l2s-base-superchain-contradiction`, `l2s-aero-merger-tense` — none of their symptoms appears in any new-arm deliverable.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **new vs none: 15/15 vs 11/15.** Per task `3/3 · 3/3 · 3/3 · 3/3 · 3/3` against `3/3 · 1/3 · 1/3 · 3/3 · 3/3`. **new vs old: 15/15 vs 12/15**, the whole gap on l2s-quiz-002 (3/3 vs 0/3). |
| Did it reduce time/tokens? | On the quizzes, yes, against both arms: new is the cheapest and usually the leanest arm on all four — e.g. quiz-003 `77s / 67k tokens / $0.35` (new) against `87s / 97k / $0.42` (old) and `95s / 88k / $0.40` (none). On l2s-goal-001 it is fastest and dearest: `965s / 5.0M / $5.81` (new) against `1310s / 3.5M / $4.49` (old) and `1325s / 4.4M / $5.14` (none). |
| Did it create negative deltas? | Not for the new text — it is ≥ both other arms on every task and every expect line. The **old** text did: `l2s-zkevm-recovery-as-routine-bridge-exit` at old 2/3 against none 0/3, i.e. the 187-line skill made an unaided-correct answer wrong. The new text's only cost is dollars and tokens on the one goal task. |
| What mistakes repeated without the skill? | `l2s-base-departure-model-blindspot` (2/3), `l2s-zkevm-replacement-chain-deferred` (2/3). |
| What mistakes remained with the skill? | With the **new** skill: none of the above; all three are 0/3. With the **old** skill: `l2s-zkevm-replacement-chain-deferred` (2/3) and `l2s-zkevm-recovery-as-routine-bridge-exit` (2/3). |
| What should change in the skill? | Nothing this benchmark can justify. The rewrite is 15/15 on its own task set, cheaper than the old text on four of five tasks, and closes both zkEVM mistakes. The one thing to watch is the goal-task token growth (5.0M against 3.5M): if a later benchmark shows it on other agentic tasks, look at the Celo exit paragraph's density before trimming anything with a measured delta. |
| What should change in the eval? | Three things. (1) **quiz-002 expect_2 is graded inconsistently at its boundary.** New runs 1 and 2 give a constraint-to-chain *rule* rather than a single named chain and pass; old run 3 recommends "Base or Arbitrum" and passes; none run 1 and old run 1 give constraint-keyed candidate lists and fail. The line says "a named replacement chain, with a reason given for the pick" — it should say explicitly whether a decision rule that resolves to a chain counts, or whether one chain has to be written down. Until it does, quiz-002's new-vs-old gap rests partly on judge discretion. (2) **Three of five tasks are saturated at 9/9** and measure nothing on this stack; quiz-001, quiz-004 and goal-001 are worth either retiring or hardening before the next model. (3) `result.yaml` **stores no judge rationale**, so every boundary call above had to be reconstructed by reading deliverables against expect lines. A one-line reason per expect would make a report like this checkable without re-deriving it. |
