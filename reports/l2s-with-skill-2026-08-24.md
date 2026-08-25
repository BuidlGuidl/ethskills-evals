# skills/l2s — with_skill regression run on the minimal skill

**Executor:** claude / `claude-opus-5`
**Judge:** claude / `claude-opus-5`, fresh blind process per run via `yarn verify`
**Runs:** 3 per task, 5 tasks, **15 runs, all graded, none discarded**
**Date:** 2026-08-24
**Skill version:** `a3df027` — the 50-line rewrite (187 lines before)

Every run records `judge.self_judged: true`, for the same reason as the 2026-08-20
benchmark: executor and judge are the same agent and model because only one harness is
installed here. The judge is still a separate, blind process that never sees the
variant, the skill or the transcript. Read the flag as "same model family", not "the
executor graded itself".

**`with_skill` only.** A skill edit cannot change a `no_skill` workspace, so the
2026-08-20 `no_skill` arm is the comparison and was not re-run. It stands under the
re-tensed quiz-003 expect_2 as well: all three of its failures were *never raises the
departure at all*, which fails under the old wording and the new one alike. Same shape
as the tools regression guard in #68. Do not blend these 15 runs into the 2026-08-20
table as if they were a fresh benchmark — they are a second `with_skill` arm against a
different skill revision.

## Headline

| Task | with_skill @ a3df027 (this run) | with_skill @ 191dcc1 (2026-08-20) | no_skill (2026-08-20) |
| --- | --- | --- | --- |
| l2s-quiz-001 (Celo sweep runbook) | 3/3 | 3/3 | 3/3 |
| l2s-quiz-002 (Polygon zkEVM stuck dashboard) | 3/3 | 3/3 | 3/3 |
| l2s-quiz-003 (Base ↔ OP game token) | 3/3 | 3/3 | **0/3** |
| l2s-quiz-004 (Rust onchain, no chain named) | 3/3 | 3/3 | 3/3 |
| l2s-goal-001 (Celo payout/sweep build) | 3/3 | 3/3 | 3/3 |
| **Total** | **15/15** | **15/15** | **12/15** |

The rewrite cut 73% of the lines and 32% of the words and held every graded line. The
one measured delta in this benchmark — quiz-003's expect_2 — survives the cut, which was
the point: that paragraph is the only content in the skill with evidence behind it.

## What the edit was supposed to fix, and did

All four are ungraded reads. They are the reason the edit existed, and they are the only
place these two `with_skill` arms differ, because the pass counts were already saturated.

| Read | @ 191dcc1 | @ a3df027 |
| --- | --- | --- |
| Base's exit described as "to be finalized in a future hardfork" (quiz-003) | 2/3 | **0/3** |
| Stylus multiplier quoted as a gas figure (quiz-004) | 1/3 | **0/3** — 3/3 state the speed/gas split |
| Celo CIP-64 fee abstraction raised (quiz-001 + goal-001) | 0/6 | **5/6** |
| Celo's exit gates read off the contracts on the quiz task (quiz-001) | 0/3 | **3/3** |

The last row is the interesting one. At 191dcc1 all three quiz-001 runs took the skill's
"Celo | 7 days" table row at face value; the cheapest of them wrote *"7-day challenge
period. This is a protocol constant. No amount of fee-paying shortens it"* into a \$2M
runbook and passed, because expect_3 grades the order of magnitude. With the table gone
and "read it live" in its place, every run pulled `proofMaturityDelaySeconds`,
`maxChallengeDuration` and `disputeGameFinalityDelaySeconds` off the portal instead.

## The edit's own defect, caught by the runs

That habit immediately caught the rewrite out. The new text said Celo's window is *"a
challenge duration of about 3.5 days"*. Wrong in the other direction: the exit is gated
twice and the later gate wins — `proofMaturityDelaySeconds` is 604,800 (7 days from the
prove transaction), and the game path is 3.5 days of challenge plus 3.5 days of
`disputeGameFinalityDelaySeconds`, so ~7 days either way. 3.5 days is
`maxChallengeDuration` quoted on its own.

**6/6 Celo runs contradicted the skill rather than inheriting it.** quiz-001 run 1:

> Anything claiming Celo's exit is "~3.5 days" is quoting `maxChallengeDuration` alone
> and is wrong. Plan for 7. … measured end-to-end on a real withdrawal
> (`0x8039c7ea…3588`): initiated 2026-08-24 13:03 UTC, finalizable 2026-08-31 14:16 UTC
> = **7.07 days**.

Measured cost: zero — no run carried the wrong figure into a deliverable. Filed as
`l2s-celo-exit-window-composite` and fixed in `e16c438`; `l2s-celo-chain-params-stale` is
half-superseded and says so. The general lesson is the one the skill already states about
itself: a number in a skill needs the instruction to re-measure it standing next to it,
because that instruction is what caught this.

## Cost: the rewrite is slower, not faster

Averages over 3 runs per cell.

| Task | no_skill @ 2026-08-20 | with_skill @ 191dcc1 | with_skill @ a3df027 |
| --- | --- | --- | --- |
| quiz-001 | \$2.24 / 663s | \$1.25 / 329s | \$1.93 / 583s |
| quiz-002 | \$0.99 / 303s | \$0.87 / 248s | \$0.95 / 311s |
| quiz-003 | \$0.51 / 189s | \$0.61 / 190s | \$0.87 / 229s |
| quiz-004 | \$0.69 / 251s | \$0.68 / 223s | \$0.80 / 262s |
| goal-001 | \$6.61 / 1502s | \$5.92 / 1431s | \$6.49 / 1468s |

This matters for the criterion in issue #1 — *if a skill cuts cost significantly, keep a
minimal version of the knowledge that does it*. The honest reading here is the reverse of
the hoped-for one:

- The old skill's quiz-001 saving (\$1.25 vs \$2.24 no_skill, −44%) was bought by handing
  the model a table of numbers, and **two of those numbers were wrong** — Celo's block
  time by 5x and its exit window by a factor the runs had to go and measure anyway.
- The minimal skill keeps most of that saving on quiz-001 (\$1.93 vs \$2.24, −14%) but
  loses it elsewhere, and on quiz-003 and quiz-004 it now costs slightly *more* than no
  skill at all. Telling a model to verify is not free.

So the cost argument does not carry this skill. What carries it is quiz-003: `3/3 vs 0/3`
on a fact no amount of live search reaches, because nothing in the prompt flags the
premise as questionable.

**Correction to the 2026-08-20 report.** Its efficiency table gives goal-001 `with_skill`
as \$7.66 / 1840s / 79 turns and reads that as "runs longer with the skill". That row is
run 2 alone; the three runs were \$7.66, \$6.66 and \$3.45, mean **\$5.92 / 1431s**, which
is slightly *cheaper* than the \$6.61 / 1502s no_skill mean. Every other row in that table
is a mean. The "negative delta" it hedges about is an artifact.

## The corrected line, measured

Three further `l2s-quiz-001 with_skill` runs against `f9fb1ea` (the corrected window
text): **3/3 pass**, run ids `2026-08-25T005210Z-claude-with-skill-4/5/6`. All three name
both gates and put the effective wait at ~7 days; run 4 wrote *"Anyone quoting 'Celo exits
in 3.5 days' is reading the game's `maxChallengeDuration` alone and understating the wait
by 2x"*. None inherited the bad figure, and none had to rediscover the composite gate from
scratch.

That last part shows up in the cost, and it is the most useful number in this report:

| quiz-001, `with_skill` | avg cost | avg secs |
| --- | --- | --- |
| @ 191dcc1 — states 7 days as the challenge window (wrong, cheap) | \$1.25 | 329 |
| @ a3df027 — states ~3.5 days (wrong), tells the reader to measure | \$1.93 | 583 |
| @ f9fb1ea — states both gates correctly, tells the reader to verify | **\$1.33** | **406** |
| no_skill (2026-08-20) | \$2.24 | 663 |

A correct stated figure with "verify it" next to it costs about a third less than an
instruction to go and measure, and lands within 6% of the old wrong-but-cheap table. The
efficiency case for a knowledge line survives minimization — but only when the line is
right. This is the sharpest evidence in either l2s benchmark for issue #1's cost
criterion, and it cuts against writing skills as pure nudges with the numbers stripped out.

An earlier attempt at these three runs (2026-08-24 20:50-20:55) returned HTTP 429,
*"You've hit your session limit"*, on all six tries including retries. The abort guard
discarded every one; nothing partial was graded or recorded. The runs above are fresh, from
after the window reset.

## Still outstanding
- The two new tasks the 2026-08-20 report asked for — a Celo CIP-64 task and a Unichain
  ordering task — still do not exist. The Unichain one is now writable: the skill states
  the ordering rule correctly, so an expect against reality no longer just measures the
  rot. The CIP-64 one matters more after this run, since the skill now carries content
  (5/6 runs used it) that no expect grades.

## Table

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Unchanged by the rewrite: **15/15 @ a3df027 vs 15/15 @ 191dcc1**, against **12/15 no_skill**. The delta is still quiz-003 alone, `3/3 vs 0/3`. |
| Did it reduce time/tokens? | Mixed, and the reason is instructive. At `a3df027` it **cost more than the skill it replaced**, on all five tasks (e.g. quiz-001 \$1.93 vs \$1.25), and slightly more than no_skill on quiz-003 and quiz-004. The saving the old version showed came from stating numbers, two of which were wrong. Correcting the Celo figure at `f9fb1ea` recovered most of it — quiz-001 \$1.33 vs \$1.25 at 191dcc1 and \$2.24 no_skill — so the cost is paid for wrong numbers, not for brevity. |
| Did it create negative deltas? | None in score. One in cost, above. One in content, caught and fixed: the new "~3.5 days" Celo window (`l2s-celo-exit-window-composite`), which 0/6 runs actually inherited. |
| What mistakes repeated without the skill? | `l2s-base-departure-model-blindspot` — not re-measured here; the 2026-08-20 no_skill arm stands (3/3). |
| What mistakes remained with the skill? | None of the ten records the rewrite closed re-appeared. `l2s-base-departure-tense` 2/3 → 0/3, `l2s-stylus-multiplier-conflation` 1/3 → 0/3. |
| What should change in the skill? | Nothing further. `e16c438`'s corrected window is measured: quiz-001 3/3 at `f9fb1ea`, cheaper and correct. The open question is whether the CIP-64 paragraph earns its place — it is the one piece of added content with no expect behind it. |
| What should change in the eval? | Write the Celo CIP-64 and Unichain ordering tasks. Four of five tasks now tie at 3/3 across three arms, so they are regression guards rather than discriminators, and the arms only separate in the ungraded reads — which is the resolution problem raised in issue #1, showing up here for the third skill running. |
