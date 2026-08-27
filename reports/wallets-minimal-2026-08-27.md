# skills/wallets (reduced) — eval report

**Skill:** `skills/wallets` reduced on this branch — 169 lines / 1,107 words → **26 / 500**.
`skill_version: 1119b32` on twelve runs; two earlier runs carry `2750ecf`, whose body is identical
and whose description differs only by a `Not for` clause since dropped.
**Stack:** executor = claude / `claude-opus-5`; judge = **codex**. `self_judged: false` on all 14.
**Runs:** 26 graded today — quiz-002 both arms × 3; `with_skill` × 3 on quiz-001, quiz-005,
quiz-006, goal-001, goal-002 and goal-004 (+1 earlier goal-004); quiz-004 `with_skill` × 1.
**Trigger:** content-only, no trigger line. Every `with_skill` run invoked the `Skill` tool on its
own, quiz-004 included — see below.
**Baselines:** `reports/wallets-2026-07-25.md` (quiz-002, claude judge),
`reports/wallets-goal-002-2026-08-05.md` and `reports/wallets-guardrails-2026-08-06.md` (codex
judge).

## Results

| task | today `no_skill` | today `with_skill` | prior `with_skill` | failing check |
| --- | --- | --- | --- | --- |
| quiz-001 — 7702 batching from an EOA | — † | **3/3** | 3/3 | — |
| quiz-002 — multisig > lone hardware wallet (**input reworded**) | **3/3** | **3/3** | 3/3 | — |
| quiz-005 — 7702 delegation persists | — † | **3/3** | 3/3 | — |
| quiz-006 — agent custody topology | — † | **3/3** | 3/3 ‡ | — |
| goal-001 — same batching, unprompted | — † | **3/3** | 3/3 | — |
| goal-002 — agent custody, unprompted | — † | **3/3** | 3/3 | — |
| goal-004 — guardrails, unrecognizable key | — † | **3/3** | 2/3 ‡‡ | — |
| quiz-004 — Safe CREATE2 (**retiring**) | — | **3/3** | 3/3 | — |
| **total** | **3/3** | **24/24 runs, 79/79 checks** | | |

† Inputs and expects are unchanged on these two, so an unaided arm would re-measure a constant.
Their `no_skill` baselines stand at 3/3 from 2026-08-05 and 2026-08-06.

‡ quiz-006's prior 3/3 is the 2026-08-05 regrade under property-based expects; under the original
topology-shaped wording it graded 1/3. The reduced skill prescribes no owner count at all, only the
property, and the property-based checks still pass 3/3.

‡‡ The August `with-skill-1` run failed `expect_3` on a strict reading (it designed the brief's key
out of existence without naming it). All three runs today pass it.

**Nothing regressed, anywhere.** Cutting two thirds of the file — including roughly 100 lines of
secret handling down to three bullets, the 7702 hedge, and the 2-of-3 topology — changed no verdict
on any of the eight live tasks. goal-001 is the specific check on the hedge deletion: every run
shipped 7702, none steered off it.

## Cost, which is where the result actually is

Medians per arm. Duration is confounded today (3–6 runs concurrent against roughly 2 in the
August benchmarks); cost and turns are not.

| task | reduced `with_skill` | full `with_skill` | `no_skill` (prior) |
| --- | --- | --- | --- |
| quiz-001 | 6 / **137s** / **$0.45** | 6 / 178s / $0.53 | 4 / 164s / $0.48 |
| quiz-002 | 5 / **98s** / **$0.32** | 5 / 99s / $0.33 | 4 / 146s / $0.43 ◊ |
| quiz-005 | 6 / 96s / $0.35 | 5 / 106s / $0.34 | 4 / 109s / $0.36 |
| quiz-006 | 6 / **112s** / **$0.38** | 6 / 176s / $0.48 | 5 / 176s / $0.45 |
| goal-001 | 33 / 718s / $2.46 | 39 / 735s / $2.37 | 60 / 1197s / $4.23 |
| goal-002 | 28 / 764s / $2.82 | 40 / 1079s / $3.70 | 21 / 722s / $2.07 |
| goal-004 | 44 / 475s / $2.29 | 38 / 431s / $1.57 | 45 / 552s / $1.88 |

◊ quiz-002's `no_skill` was re-measured today on the reworded prompt; every other `no_skill` cell
is the August/July baseline.

**On four of seven tasks the skill is cheaper than working unaided, and the reduced file is the
cheapest arm measured on three of them.** goal-001 carries the largest saving in the suite — about
−42% cost against `no_skill`, and the cut preserves it. That reframes the earlier verdict: three
benchmarks concluded "dead weight" on pass counts alone, and pass counts were saturated.

Where the cut moved things:

- **quiz-001, quiz-002, quiz-006 — the cut is free or better.** Same verdicts at half the words,
  and on quiz-001 and quiz-006 the reduced file beats both August arms.
- **quiz-005, goal-001 — flat.** Claims whose statement is one sentence either way.
- **goal-002 — the cut removes most of a real penalty.** The full file cost +50% duration and 2×
  the turns over `no_skill` for an identical verdict; reduced, that is +6% duration, and −30%
  turns / −24% cost against the full file.
- **goal-004 — the cut costs.** On the full file this task's `with_skill` runs were the *cheapest*
  arm ($1.57 against `no_skill`'s $1.88). On the reduced file they are the most expensive ($2.29).

**The pattern that reads across all seven: the saving survives where the content survived.**
quiz-001, quiz-002 and quiz-006 test claims the reduced file still states in full, and all three
keep or improve their saving. goal-002's custody argument survived as the promoted top section and
its penalty shrank. goal-004's guardrail checklist became three bullets, and the advantage the
checklist was buying disappeared — it is the one section where compression cost something. That is an argument about
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

The regression surface is complete: all eight live tasks ran. quiz-003 and quiz-004 retire — the
reduced file makes neither claim.

What did not get measured is a fresh `no_skill` arm on the six tasks whose inputs are unchanged.
Their baselines are three to five weeks old, which is fine for pass counts (all 3/3, and the model
is the same tier) but weaker for the cost comparison, which is where this benchmark's result now
lives. If the cost claim is going to carry the upstream proposal, those six unaided arms are worth
re-measuring on the same day and the same concurrency as their `with_skill` runs.

Caveats: one model tier throughout; n=3 per cell with wide goal-task spread (goal-002 ran
684–1375s today, 663–1226s in August); `no_skill` arms for goal-002 and goal-004 are three weeks
old rather than re-measured; and today's concurrency inflates wall-clock, though not cost.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No, and it never could here: 24/24 runs and 79/79 checks pass, against unaided baselines that are also 3/3 everywhere. The pass column has been saturated for four benchmarks. |
| Did it reduce time/tokens? | **Yes, on four of seven tasks.** goal-001 −42% cost against unaided, quiz-002 −25%, quiz-006 −16%, quiz-001 −6%. quiz-005 is flat. goal-002 still costs +36% over unaided, down from +79% on the full file. goal-004 is the one task where the reduced file is the most expensive arm measured. |
| Did it create negative deltas? | None in grading, at any point. goal-004's cost regression against the *full* file is the only negative direction in the benchmark. |
| What mistakes repeated without the skill? | None. quiz-002's unaided arm passed every check on the reworded prompt. |
| What mistakes remained with the skill? | None. No mistake record filed from these 26 runs. |
| What should change in the skill? | Nothing this evidence contradicts. goal-004 says the guardrail compression is the one part of the cut to revisit if any of it is restored — restore there first, not into the reference tables, which no task shows buying anything. |
| What should change in the eval? | Retire quiz-003 and quiz-004. Carry cost and turns in every future wallets table — the pass column is saturated and every real signal in this benchmark is in the cost column. Re-measure the six stale `no_skill` arms same-day before the cost claim carries an upstream proposal. |

## What this changes about the wallets verdict

Three benchmarks and 60 runs concluded issue #1 row 1 — *wiki, the skill is dead weight* — on pass
counts alone. That conclusion was sound for what it measured and is now incomplete: on four of
seven tasks this skill is measurably cheaper than working unaided, the largest being −42% cost on
goal-001, and the reduced file preserves or improves that on every task except goal-004.

By damianmarti's criterion on issue #1 — *if the skill helps reduce costs by a significant amount,
it makes sense to keep a minimal skill file* — wallets keeps a minimal skill. That is a different
answer from the one the same suite gave three times, and the only reason it is available is that
this benchmark graded the cost column rather than the pass column, which is exactly the resolution
problem rin-st raised on issue #1.

Unchanged caveat: one model tier. Everything here is `claude-opus-5`.
