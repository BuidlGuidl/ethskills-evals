# skills/wallets (reduced) — eval report

**Skill:** `skills/wallets` reduced on this branch — 169 lines / 1,107 words → **26 / 500**.
`skill_version: 1119b32` on twelve runs; two earlier runs carry `2750ecf`, whose body is identical
and whose description differs only by a `Not for` clause since dropped.
**Stack:** executor = claude / `claude-opus-5`; judge = **codex**. `self_judged: false` on all 14.
**Runs:** 14 graded today — quiz-002 both arms × 3, goal-002 `with_skill` × 3, goal-004
`with_skill` × 3 (+1 earlier), quiz-004 `with_skill` × 1.
**Trigger:** content-only, no trigger line. Every `with_skill` run invoked the `Skill` tool on its
own, quiz-004 included — see below.
**Baselines:** `reports/wallets-2026-07-25.md` (quiz-002, claude judge),
`reports/wallets-goal-002-2026-08-05.md` and `reports/wallets-guardrails-2026-08-06.md` (codex
judge).

## Results

| task | today `no_skill` | today `with_skill` | prior `with_skill` | failing check |
| --- | --- | --- | --- | --- |
| quiz-002 — multisig > lone hardware wallet (**input reworded**) | **3/3** | **3/3** | 3/3 | — |
| goal-002 — agent custody, unprompted | — † | **3/3** | 3/3 | — |
| goal-004 — guardrails, unrecognizable key | — † | **3/3** | 2/3 ‡ | — |
| quiz-004 — Safe CREATE2 (**retiring**) | — | **3/3** | 3/3 | — |

† Inputs and expects are unchanged on these two, so an unaided arm would re-measure a constant.
Their `no_skill` baselines stand at 3/3 from 2026-08-05 and 2026-08-06.

‡ The August `with-skill-1` run failed `expect_3` on a strict reading (it designed the brief's key
out of existence without naming it). All three runs today pass it.

**Nothing regressed.** Cutting two thirds of the file — including roughly 100 lines of secret
handling down to three bullets — changed no verdict on any task.

## Cost, which is where the result actually is

Medians per arm. Duration is confounded today (3–6 runs concurrent against roughly 2 in the
August benchmarks); cost and turns are not.

| task | arm | turns | duration | cost |
| --- | --- | --- | --- | --- |
| quiz-002 | today, reduced, `with_skill` | 5 | **98s** | **$0.32** |
| | today, reduced, `no_skill` | 4 | 146s | $0.43 |
| | 07-25, full, `with_skill` | 5 | 99s | $0.33 |
| | 07-25, full, `no_skill` | 4 | 144s | $0.40 |
| goal-002 | today, reduced, `with_skill` | **28** | **764s** | **$2.82** |
| | 08-05, full, `with_skill` | 40 | 1079s | $3.70 |
| | 08-05, full, `no_skill` | 21 | 722s | $2.07 |
| goal-004 | today, reduced, `with_skill` | 44 | 475s | **$2.29** |
| | 08-06, full, `with_skill` | 38 | 431s | $1.57 |
| | 08-06, full, `no_skill` | 45 | 552s | $1.88 |

Three tasks, three different answers:

- **quiz-002 — the skill pays for itself, and the cut is free.** `with_skill` beats `no_skill` by
  about −33% duration and −25% cost, and it does so *twice*: on the full file in July and on the
  reduced file today, at nearly identical numbers (98s vs 99s). Half the words, same saving. This
  is the criterion damianmarti named on issue #1 for keeping a minimal skill, and it is the first
  wallets task in three benchmarks to meet it.
- **goal-002 — the cut removes most of a real penalty.** The full file cost +50% duration and 2×
  the turns over `no_skill` for an identical verdict. Reduced: −30% turns, −29% duration and −24%
  cost against the full file, taking the duration gap over `no_skill` from +50% to +6%. Still
  +36% on cost.
- **goal-004 — the cut costs.** On the full file this task's `with_skill` runs were the *cheapest*
  arm ($1.57 against `no_skill`'s $1.88). On the reduced file they are the most expensive ($2.29).
  Same verdict, more work to reach it.

**The pattern that reads across all three: the saving survives where the content survived.**
quiz-002's claim is still stated in full and keeps its saving intact. goal-002's custody argument
survived as the promoted top section and its penalty shrank. goal-004's guardrail checklist became
three bullets, and the advantage the checklist was buying disappeared. That is an argument about
*where* to cut rather than how much, and it is the first evidence in this skill's evaluation that
a cut can cost something.

## Two findings about the eval, not the skill

**The telegraph hypothesis is dead for quiz-002.** PR #33 flagged that three prompts stated their
own expect lines, which was a live alternative explanation for the wash that model capability does
not cover. quiz-002's prompt no longer asks whether there is "a strictly more secure setup I can
run entirely by myself", and `no_skill` still goes 3/3 at the same cost as it did in July. On this
task the model holds the claim; the question was not handing it over. quiz-003 and quiz-004 were
reworded the same way but are retiring, so the hypothesis stays untested there.

**A `Not for` clause was tried in the description and measured, then dropped.** The first version
of the reduced description ended "Not for looking up a contract address (`addresses`)". One
`with_skill` run on quiz-004 — whose prompt is "the counterfactual address of a user's 2-of-3
Safe, same owners, same threshold, same salt" — fired the skill anyway: the disclaimer lost to the
description's own front-loaded custody keywords. Sharpening it until that one task stopped firing
would be over-pinning a description to an eval task, which is the failure this suite has already
documented three times on expect lines. Issue
[#91](https://github.com/BuidlGuidl/ethskills-evals/issues/91) asks for a not-for clause *where
useful*; here it was not. Recorded rather than tuned: on a task the skill has no content for, it
still loads, and it costs about $0.50 to do so — without harming the answer (3/3).

## What is not covered

Four tasks did not run today: quiz-001, quiz-005, quiz-006 and goal-001, whose inputs and expects
are unchanged and whose claims all survive in the reduced file. They are `with_skill` × 3 each, 12
runs, and they are the remaining regression surface. quiz-003 and quiz-004 retire — the reduced
file makes neither claim.

Caveats: one model tier throughout; n=3 per cell with wide goal-task spread (goal-002 ran
684–1375s today, 663–1226s in August); `no_skill` arms for goal-002 and goal-004 are three weeks
old rather than re-measured; and today's concurrency inflates wall-clock, though not cost.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No. Every arm passes everywhere: 3/3 vs 3/3 on quiz-002, 3/3 `with_skill` on goal-002 and goal-004 against 3/3 unaided baselines. Fourteen runs, no failing check. |
| Did it reduce time/tokens? | On quiz-002, yes and reproducibly: −33% duration, −25% cost against `no_skill`, in both benchmarks. On goal-002 it still costs +36% over unaided, down from +79%. On goal-004 it now costs more than either August arm. |
| Did it create negative deltas? | None in grading. goal-004's cost regression against the *full* file is the only negative direction, and it is a cost result at n=3. |
| What mistakes repeated without the skill? | None. quiz-002's unaided arm passed every check on the reworded prompt. |
| What mistakes remained with the skill? | None. |
| What should change in the skill? | Nothing on this evidence — but goal-004 says the guardrail compression is the part of the cut to revisit if any of it is restored. Do not restore the reference tables: no task shows them buying anything. |
| What should change in the eval? | Retire quiz-003 and quiz-004; the reduced file makes neither claim. Carry cost and turns in every future wallets table — the pass column has been saturated for three benchmarks and every real signal in this one is in the cost column. Run the four remaining regression tasks before the reduced file is proposed upstream. |
