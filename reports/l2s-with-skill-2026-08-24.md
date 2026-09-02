# skills/l2s — with_skill regression run on the minimal skill

**Executor:** claude / `claude-opus-5`
**Judge:** claude / `claude-opus-5`, fresh blind process per run via `yarn verify`
**Runs:** 3 per task, 5 tasks, **15 runs @ `a3df027`, plus 3 more @ `f9fb1ea` — 18 in
all, all graded, none discarded**
**Date:** 2026-08-24 (the `f9fb1ea` runs 2026-08-25)
**Skill version:** `a3df027` — the 50-line rewrite (187 lines before), and `f9fb1ea` for
the three follow-up quiz-001 runs in "The corrected line, measured"
**Baseline arm:** `4f93522` — the skill as the 2026-08-20 benchmark ran it, vendored at
`skills/l2s` from ethskills.com/l2s/SKILL.md, upstream source @ `191dcc1`. `4f93522` is
what those runs record in `skill_version` and the only one of the two this repo can
resolve; `191dcc1` is an upstream sha and `git cat-file` will not find it here.

**Every cost, duration and token figure below comes from `yarn run-stats`**, per arm:

```bash
T=l2s-quiz-001,l2s-quiz-002,l2s-quiz-003,l2s-quiz-004,l2s-goal-001
yarn run-stats --tasks $T --variant no_skill          # the 2026-08-20 baseline
yarn run-stats --tasks $T --skill-version 4f93522     # with_skill, pre-rewrite
yarn run-stats --tasks $T --skill-version a3df027     # with_skill, the rewrite
yarn run-stats --tasks $T --skill-version f9fb1ea     # with_skill, corrected window
```

Medians with the cost range beside them, never means: at `n=3` on goal-001 the cheapest
and dearest run differ by more than any delta being read off the middle.

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

| Task | with_skill @ a3df027 (this run) | with_skill @ 4f93522 (2026-08-20) | no_skill (2026-08-20) |
| --- | --- | --- | --- |
| l2s-quiz-001 (Celo sweep runbook) | 3/3 | 3/3 | 3/3 |
| l2s-quiz-002 (Polygon zkEVM stuck dashboard) | 3/3 | 3/3 | 3/3 |
| l2s-quiz-003 (Base ↔ OP game token) | 3/3 | 3/3 | **0/3** |
| l2s-quiz-004 (Rust onchain, no chain named) | 3/3 | 3/3 | 3/3 |
| l2s-goal-001 (Celo payout/sweep build) | 3/3 | 3/3 | 3/3 |
| **Total** | **15/15** | **15/15** | **12/15** |

The rewrite cut 73% of the lines (187 → 50) and 32% of the words (1,675 → 1,136 at
`a3df027`; 29% as the skill ships at `f9fb1ea`, which spends words back on the corrected
Celo window) and held every graded line. The one measured delta in this benchmark —
quiz-003's expect_2 — survives the cut, which was the point: that paragraph is the only
content in the skill with evidence behind it.

## What the edit was supposed to fix, and did

All four are ungraded reads. They are the reason the edit existed, and they are the only
place these two `with_skill` arms differ, because the pass counts were already saturated.

| Read | @ 4f93522 | @ a3df027 |
| --- | --- | --- |
| Base's exit described as "to be finalized in a future hardfork" (quiz-003) | 2/3 | **0/3** |
| Stylus multiplier quoted as a gas figure (quiz-004) | 1/3 | **0/3** — 3/3 state the speed/gas split |
| Celo CIP-64 fee abstraction raised (quiz-001 + goal-001) | 0/6 | **5/6** |
| Celo's exit gates read off the contracts on the quiz task (quiz-001) | 0/3 | **3/3** |

The last row is the interesting one. At 4f93522 all three quiz-001 runs took the skill's
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

## Cost: the rewrite is dearer on four tasks of five, and only clearly so on one

Medians over 3 runs per cell, cost range beside each, from the `run-stats` commands at
the top of this report. Tokens are `total_tokens` — the three-way input sum plus output,
so a skill's own context cost is inside them.

| Task | no_skill @ 2026-08-20 | with_skill @ 4f93522 | with_skill @ a3df027 |
| --- | --- | --- | --- |
| quiz-001 | \$2.59 (\$1.25–\$2.89) / 782s / 1.38M | \$1.23 (\$0.69–\$1.83) / 331s / 0.36M | \$1.68 (\$1.60–\$2.51) / 525s / 0.95M |
| quiz-002 | \$0.96 (\$0.95–\$1.05) / 299s / 0.22M | \$0.95 (\$0.68–\$0.96) / 240s / 0.23M | \$0.97 (\$0.81–\$1.07) / 306s / 0.36M |
| quiz-003 | \$0.50 (\$0.45–\$0.59) / 188s / 0.09M | \$0.60 (\$0.49–\$0.73) / 190s / 0.12M | \$1.01 (\$0.45–\$1.16) / 260s / 0.28M |
| quiz-004 | \$0.72 (\$0.62–\$0.72) / 258s / 0.12M | \$0.70 (\$0.62–\$0.71) / 231s / 0.13M | \$0.77 (\$0.71–\$0.93) / 270s / 0.15M |
| goal-001 | \$7.12 (\$4.95–\$7.75) / 1552s / 6.72M | \$6.66 (\$3.45–\$7.66) / 1629s / 5.29M | \$5.95 (\$5.31–\$8.22) / 1365s / 5.07M |

Read the ranges before the medians. On goal-001 all three arms span three dollars or more
and overlap almost entirely: nothing in that row is a measurement at `n=3`, in either
direction. The four quiz tasks are tight enough to read, and quiz-001 is where the arms
sit furthest apart — though even there `no_skill`'s \$1.25–\$2.89 covers the whole
`a3df027` range, so the gap below is a tendency rather than a separation. The benchmark's
one pair of genuinely disjoint ranges is `a3df027` against `f9fb1ea`, further down.

This matters for the criterion in issue #1 — *if a skill cuts cost significantly, keep a
minimal version of the knowledge that does it*. The honest reading is the reverse of the
hoped-for one:

- The old skill's quiz-001 saving (\$1.23 vs \$2.59 no_skill, −53%, and 0.36M tokens
  against 1.38M) was bought by handing the model a table of numbers, and **two of those
  numbers were wrong** — Celo's block time by 5x and its exit window by a factor the runs
  had to go and measure anyway.
- The minimal skill keeps most of that saving on quiz-001 (\$1.68 vs \$2.59, −35%) but
  hands back a third of what the old table bought, and on quiz-003 it costs twice
  no_skill's median (\$1.01 vs \$0.50) — though the ranges there overlap at the bottom,
  so read that as a tendency, not a measurement. Telling a model to verify is not free.
- It is dearer than the skill it replaced on four tasks of five. goal-001 is the fifth and
  runs the other way (\$5.95 vs \$6.66) on ranges that overlap almost completely, so the
  only cell that carries the claim on its own is quiz-001, \$1.68 against \$1.23 on
  ranges that meet only in \$1.60–\$1.83.

So the cost argument does not carry this skill. What carries it is quiz-003: `3/3 vs 0/3`
on a fact no amount of live search reaches, because nothing in the prompt flags the
premise as questionable.

**Correction to the 2026-08-20 report.** Its efficiency table gives goal-001 `with_skill`
as \$7.66 / 1840s / 79 turns and reads that as "runs longer with the skill". That row is
run 2 alone (`2026-08-20T054309Z-claude-with-skill-2`); the three runs were \$7.66,
\$6.66 and \$3.45. Every other row in that table is a genuine mean. On medians the arm is
**\$6.66 / 1629s / 59 turns** against **\$7.12 / 1552s / 79 turns** `no_skill`, ranges
\$3.45–\$7.66 and \$4.95–\$7.75 — two arms that cannot be told apart at `n=3`, which is a
better description than either "runs longer with the skill" or "slightly cheaper". The
"negative delta" it hedges about is an artifact of reading one run as a mean. That report
now carries this correction in place, above its efficiency table.

## The text the 15 runs actually read

`a3df027` and `f9fb1ea` exist only on `skill/l2s-minimal`, so a squash-merge would take
both with it. It costs one line to make that survivable: `f9fb1ea` is identical to the
branch tip, and `a3df027` — the revision all 15 runs above read — differs from it in
exactly one sentence, the second paragraph of "Exiting to L1":

```diff
-The window is per-chain, not a universal 7 days: Celo settles through an OP Succinct dispute game with a challenge duration of about 3.5 days, and produces a block every 1s. Read the live figure with viem's `getTimeToProve` / `getTimeToFinalize` against the chain's own contracts rather than quoting a remembered table. ZK rollups settle in minutes to hours.
+The window is per-chain, and usually composite — which is why quoting any single remembered number goes wrong. Celo, read off the portal 2026-08-24: `proofMaturityDelaySeconds` is 604,800, i.e. 7 days from your prove transaction, while the OP Succinct game's `maxChallengeDuration` is 302,400 (3.5 days) with a further 302,400 of `disputeGameFinalityDelaySeconds` after the game resolves. Whichever gate falls later wins, so the real wait is about 7 days — "Celo exits in 3.5 days" is the challenge window quoted on its own. Celo produces a block every 1s. Read both gates live rather than either number: viem's `getTimeToProve` / `getTimeToFinalize` do it against the chain's own contracts. ZK rollups settle in minutes to hours.
```

Everything else in the 50 lines is byte-identical across the two. Reverse that hunk
against `skills/l2s/SKILL.md` and you have what the 15 runs were graded against, whether
or not `a3df027` still resolves.

## The corrected line, measured

Three further `l2s-quiz-001 with_skill` runs against `f9fb1ea` (the corrected window
text): **3/3 pass**, run ids `2026-08-25T005210Z-claude-with-skill-4/5/6`. All three name
both gates and put the effective wait at ~7 days; run 4 wrote *"Anyone quoting 'Celo exits
in 3.5 days' is reading the game's `maxChallengeDuration` alone and understating the wait
by 2x"*. None inherited the bad figure, and none had to rediscover the composite gate from
scratch.

That last part shows up in the cost, and it is the most useful number in this report:

| quiz-001, `with_skill` | cost | range | secs | tokens |
| --- | --- | --- | --- | --- |
| @ 4f93522 — states 7 days as the challenge window (wrong, cheap) | \$1.23 | \$0.69–\$1.83 | 331 | 0.36M |
| @ a3df027 — states ~3.5 days (wrong), tells the reader to measure | \$1.68 | \$1.60–\$2.51 | 525 | 0.95M |
| @ f9fb1ea — states both gates correctly, tells the reader to verify | **\$1.34** | **\$1.24–\$1.42** | **395** | **0.62M** |
| no_skill (2026-08-20) | \$2.59 | \$1.25–\$2.89 | 782 | 1.38M |

This is the one place in the benchmark where two arms separate on cost with the ranges
staying apart: \$1.24–\$1.42 at `f9fb1ea` against \$1.60–\$2.51 at `a3df027`, three runs
each, no overlap. A correct stated figure with "verify it" next to it costs 20% less on
the median and a third fewer tokens than an instruction to go and measure, and lands
within 9% of the old wrong-but-cheap table while being right. The efficiency case for a
knowledge line survives minimization — but only when the line is right. This is the
sharpest evidence in either l2s benchmark for issue #1's cost criterion, and it cuts
against writing skills as pure nudges with the numbers stripped out.

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
| Did the skill improve pass rate? | Unchanged by the rewrite: **15/15 @ a3df027 vs 15/15 @ 4f93522**, against **12/15 no_skill**. The delta is still quiz-003 alone, `3/3 vs 0/3`. The three `f9fb1ea` quiz-001 runs add 3/3 on the corrected window and are counted separately, never blended into either 15. |
| Did it reduce time/tokens? | Mixed, and the reason is instructive. Medians, quiz-001: **525s / 0.95M tokens / \$1.68 @ `a3df027`** against **331s / 0.36M / \$1.23 @ `4f93522`** and **782s / 1.38M / \$2.59 no_skill** — so the rewrite is dearer than the skill it replaced and still cheaper than none. That holds on four tasks of five (goal-001 runs the other way on ranges that overlap almost entirely, \$5.95 vs \$6.66). The saving the old version showed came from stating numbers, two of which were wrong. Correcting the Celo figure at `f9fb1ea` recovered most of it — quiz-001 \$1.34 / 395s / 0.62M, on a range disjoint from `a3df027`'s — so the cost is paid for wrong numbers, not for brevity. |
| Did it create negative deltas? | None in score. One in cost, above. One in content, caught and fixed: the new "~3.5 days" Celo window (`l2s-celo-exit-window-composite`), which 0/6 runs actually inherited. |
| What mistakes repeated without the skill? | `l2s-base-departure-model-blindspot` — not re-measured here; the 2026-08-20 no_skill arm stands (3/3). |
| What mistakes remained with the skill? | None of the ten records the rewrite closed re-appeared. `l2s-base-departure-tense` 2/3 → 0/3, `l2s-stylus-multiplier-conflation` 1/3 → 0/3. |
| What should change in the skill? | Nothing further. `e16c438`'s corrected window is measured: quiz-001 3/3 at `f9fb1ea`, cheaper and correct. The open question is whether the CIP-64 paragraph earns its place — it is the one piece of added content with no expect behind it. |
| What should change in the eval? | Write the Celo CIP-64 and Unichain ordering tasks. Four of five tasks now tie at 3/3 across three arms, so they are regression guards rather than discriminators, and the arms only separate in the ungraded reads — which is the resolution problem raised in issue #1, showing up here for the third skill running. |
