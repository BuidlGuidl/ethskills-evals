# ship — major-refine, Opus 5 medium

Benchmark id: `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)).
Benchmark commit `d9952522`.

| | |
| --- | --- |
| Executor | claude, `claude-opus-5`, effort `medium` |
| Judge | claude, `claude-opus-5`, effort `high` |
| Runs | 3 per arm per task, 45 graded runs |
| Arms | none (`no_skill`) · old (`with_skill`, skill_version `2f0adb01`) · new (`with_skill`, skill_version `d9952522`) |
| `self_judged` | **true** on every run — judge and executor are both claude. A caveat on the numbers, not a defect in them. |

Tasks: `ship-goal-001`, `ship-quiz-001`, `ship-quiz-002`, `ship-quiz-003`, `ship-quiz-004` (every live task whose `skill:` is `skills/ship`).

## Headline — pass counts, new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| ship-goal-001 | **3/3** | **3/3** | **2/3** |
| ship-quiz-001 | 3/3 | 3/3 | 3/3 |
| ship-quiz-002 | 3/3 | 3/3 | 3/3 |
| ship-quiz-003 | 3/3 | 3/3 | 3/3 |
| ship-quiz-004 | 3/3 | 3/3 | 3/3 |

All four quizzes are saturated on this stack: every arm passes every run. The only separation anywhere
is one no_skill run of the goal task, and the two skill texts are indistinguishable on pass rate —
`15/15` each.

The single failure is `ship-goal-001/2026-09-21T201432Z-claude-no-skill-1`, on expect_2 and expect_3:
a `Tool` struct holding `string name`, `string photoUri`, `string conditionNotes`, a `displayName` in a
`MemberRegistry`, a `NEWCOMER_SCORE_BPS` reputation score, and a paginated `getMembers(offset, limit)`
roster view — the onchain browse feed those lines forbid. Filed as
[`ship-goal-offchain-data`](../mistakes/ship/ship-goal-offchain-data.yaml) and
[`ship-goal-offchain-ranking`](../mistakes/ship/ship-goal-offchain-ranking.yaml), where the claude rate
is 1/3 against codex's 3/3 on the same checks.

## Cost — medians per arm, with ranges

From `yarn run-stats --tasks <ids> --benchmark major-refine-d9952522`, split by `--variant no_skill`,
`--skill-version 2f0adb01` and `--skill-version d9952522`. `cost_source: executor` throughout (claude's
own reported price).

| Task | arm | turns | duration | cost | cost range | total tokens |
| --- | --- | --- | --- | --- | --- | --- |
| ship-goal-001 | none | 67 | 1209s | $6.87 | $4.73–$9.65 | 5,684,001 |
| ship-goal-001 | old | 213 | 4351s | $38.99 | $34.37–$39.41 | 49,574,347 |
| ship-goal-001 | new | 136 | 2119s | $14.92 | $9.29–$15.24 | 18,081,630 |
| ship-quiz-001 | none | 4 | 183s | $0.50 | $0.43–$0.55 | 98,675 |
| ship-quiz-001 | old | 9 | 169s | $0.68 | $0.56–$0.77 | 204,181 |
| ship-quiz-001 | new | 5 | 166s | $0.56 | $0.48–$0.58 | 103,006 |
| ship-quiz-002 | none | 4 | 133s | $0.40 | $0.34–$0.43 | 88,063 |
| ship-quiz-002 | old | 6 | 96s | $0.41 | $0.38–$0.45 | 124,839 |
| ship-quiz-002 | new | 6 | 117s | $0.42 | $0.38–$0.48 | 108,609 |
| ship-quiz-003 | none | 4 | 198s | $0.58 | $0.55–$0.63 | 107,486 |
| ship-quiz-003 | old | 10 | 254s | $0.89 | $0.69–$0.92 | 204,904 |
| ship-quiz-003 | new | 6 | 181s | $0.56 | $0.53–$0.57 | 103,814 |
| ship-quiz-004 | none | 4 | 136s | $0.42 | $0.36–$0.49 | 92,633 |
| ship-quiz-004 | old | 9 | 145s | $0.56 | $0.49–$0.60 | 183,445 |
| ship-quiz-004 | new | 6 | 161s | $0.52 | $0.48–$0.54 | 121,076 |

**This is where the refinement shows up.** Pass counts cannot tell the two texts apart; cost can.
On the goal task the old text spends **2.6x the money and 2.7x the tokens of the new one** for the same
3/3 — $38.99 / 49.6M / 213 turns against $14.92 / 18.1M / 136 turns — and the ranges do not overlap
($34.37–$39.41 vs $9.29–$15.24). On three of four quizzes the old text roughly doubles tokens over
no_skill while the new text lands at no_skill cost. Filed as
[`ship-skill-token-overhead-claude-opus-5`](../mistakes/ship/ship-skill-token-overhead-claude-opus-5.yaml),
still `open`: the refined text is 3.2x no_skill on the goal task (18.1M vs 5.7M) for 3/3 vs 2/3.

What the old text spent it on is visible in the deliverables. Its two surviving goal builds scaffolded
full Scaffold-ETH monorepos — `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `LICENCE`, `opencode.json`,
`packages/` — where the new text shipped `contracts/`, an `app/`, and a README.

## Per-run observations the task notes ask for

**Sibling-skill fetches.** Every ship task's notes warn that a `with_skill` run pulling other
ethskills skills makes the delta about the bundle rather than this skill. Counted from `WebFetch`
calls in `transcript.md`:

| arm | runs that fetched another `ethskills.com/*/SKILL.md` |
| --- | --- |
| none | 0/15 |
| old | **7/15** (audit, security, standards, addresses, gas, concepts, wallets, frontend-ux) |
| new | 1/15 (addresses, goal task) |

So the old arm's numbers are partly bundle numbers, and the new arm's are close to content-only.
Filed as [`ship-old-text-bundle-fetch`](../mistakes/ship/ship-old-text-bundle-fetch.yaml). Nothing was
trigger-forced: these are unprompted-trigger numbers on all three arms.

**Goal task, per run.** Framework reached for, offchain component, deployment target:

| run | arm | framework | shipped tree | target |
| --- | --- | --- | --- | --- |
| 201432Z-1 | none | hardhat | `contracts/`, `web/` | Base |
| 022433Z-2 | none | none — no contracts at all | `server/`, `web/`, Docker | Base |
| 061201Z-3 | none | none — no contracts at all | `src/`, `deploy/`, `test/` | see eval note below |
| 011739Z-1 | old | scaffold-eth | full monorepo + AGENTS.md/CLAUDE.md/LICENCE | Base |
| 022433Z-2 | old | scaffold-eth | `toolshed/` monorepo | Base |
| 061201Z-3 | old | scaffold-eth | `packages/` monorepo | Base |
| 201434Z-1 | new | foundry | `contracts/`, `web/`, `scripts/` | Base |
| 022433Z-2 | new | hardhat | `contracts/`, `app/` | Base mainnet |
| 061201Z-3 | new | foundry | `contracts/`, `app/` | Base |

Every run that picked a chain picked Base. Chain selection is recorded, not graded, on this task.

## Run incidents

**Four old-arm runs were graded with `--allow-skill-mention`.** `verify`'s judge-blindness guard
refused them because the deliverable named the harness's own skill plumbing:

| run | hit |
| --- | --- |
| ship-quiz-003/2026-09-21T201709Z-…-2f0adb01-1 | `plan.md:199` — "Hand the code to a fresh agent with `audit/SKILL.md`" |
| ship-goal-001/2026-09-22T011739Z-…-2f0adb01-1 | `output/AGENTS.md:238` — read `.agents/skills/<name>/SKILL.md` |
| ship-goal-001/2026-09-22T022433Z-…-2f0adb01-2 | `output/toolshed/AGENTS.md:238` — same |
| ship-goal-001/2026-09-22T061201Z-…-2f0adb01-3 | `output/README.md:302` — links `ethskills.com/audit/SKILL.md` |

Each hit was read before the decision. They were graded rather than resampled, because the mentions
come from the arm's own text — the old skill routes to siblings by URL — so re-running until they
disappear would select the sample on the behavior under test. The judge learns "this run had a skill",
not which of the two texts; all four passed every line, as did the new-arm runs they are compared
against, so no conclusion here rests on them. The direction of any leniency is unknown, and that is a
real limit on the old arm's grades. Filed as
[`ship-old-text-leaks-skill-paths`](../mistakes/ship/ship-old-text-leaks-skill-paths.yaml). New arm: 0/15.

**Ten runs were killed by a claude session limit and re-made, not graded over.** Seven `ship-goal-001`
runs (wave 1 old, all of wave 2, all of wave 3) died with `exit: 1` and
`You've hit your session limit`; three more died the same way on the wave-3 retry. `verify` refuses a
non-zero exit, which is what kept a harness failure out of the record. Each dead run dir was deleted and
set up again under a new run id, per AGENTS.md; `--grade-failed-run` was never used and no retracted
grade is in this benchmark. The re-made runs carry later timestamps than their wave siblings — wave 1's
old arm ran 2026-09-22T01:17Z against its siblings' 2026-09-21T20:14Z — so that wave is interleaved in
intent but not in wall-clock.

Nothing else was retracted. `expect_sha` is uniform across all nine runs of each task
(`9c9b43d52452` goal-001, `3e7ce7429819` quiz-001, `a429614082aa` quiz-002, `4addc52e998c` quiz-003,
`8f1adae3f036` quiz-004), so every arm of a task was graded against one rubric; no expect line was
touched during the benchmark.

## What should change in the eval

**`ship-goal-001` can be passed by not building the product.** Its no_skill run
`2026-09-22T061201Z-claude-no-skill-3` shipped **zero Solidity files** — an offchain Node app whose
`src/payments/onchain.js` is, in its own README's words, "a deliberate stub that throws at boot" — and
passed all six expect lines. Every line is either a prohibition (expect_1 "at most two contracts", with
zero explicitly passing; expect_2/expect_3 nothing onchain; expect_4 no automatic transitions) or a
README requirement, so a build with no chain in it satisfies the rubric completely while ignoring the
task, which asks for USDC deposits and late fees. Two of the three no_skill runs went this way — `022433Z-2` and `061201Z-3` both ship 0 `.sol` files against `201432Z-1`'s 5. That
makes the goal task's 2/3 vs 3/3 weaker than it reads: the arm difference is partly *whether a run built
a dApp at all*, which nothing grades. The task needs a positive check — USDC custody and settlement are
enforced onchain by contract code in the workspace — of the kind `ship-quiz-002`'s expect_4 already has.
Raised on #119.

Second, the four quizzes no longer discriminate on this stack: 12 runs, 12 passes, three arms. They are
measuring a ceiling. `ship-quiz-002`'s notes anticipated this shape for its own predecessor; the same
now holds for all four, and re-running them on Opus 5 medium buys nothing but cost.

## AGENTS.md table

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none `15/15 vs 14/15` — one goal-task run (`ship-goal-001` 3/3 vs 2/3), quizzes saturated 3/3 everywhere. new vs old `15/15 vs 15/15` — indistinguishable. |
| Did it reduce time/tokens? | No — it costs them, and the refinement is what cut the bill. Goal task medians, none / old / new: `1209s / 5.7M tok / $6.87` · `4351s / 49.6M / $38.99` · `2119s / 18.1M / $14.92`. New is 2.7x cheaper than old for the same 3/3, and 2.2x dearer than none. Quizzes: old ≈2x no_skill tokens, new ≈ no_skill. |
| Did it create negative deltas? | Yes, all in the old text and all cost- or hygiene-shaped, none in pass rate: 2.7x spend on the goal task, ≈2x quiz tokens, sibling-skill fetches in 7/15 runs, and internal skill paths written into shipped deliverables in 4/15. The refined text leaves a 3.2x-vs-none token residue on the goal task. |
| What mistakes repeated without the skill? | `ship-goal-offchain-data`, `ship-goal-offchain-ranking` (1/3 no_skill each on this stack, both 0/3 with either text). |
| What mistakes remained with the skill? | None against the rubric — 15/15 on both texts. `ship-skill-token-overhead-claude-opus-5` remains open against the refined text (3.2x no_skill tokens on the goal task). |
| What should change in the skill? | Nothing this stack supports on correctness; the refinement already did the work — it holds the old text's pass rate at a third of its cost and closed the sibling-fetch and skill-path-leak behaviors. Do not re-expand it. |
| What should change in the eval? | `ship-goal-001` needs a positive onchain-custody check — two of three no_skill runs passed with no contracts at all, one with no chain in the product. The four quizzes are saturated on Opus 5 medium and should be retired from this stack or hardened. |
