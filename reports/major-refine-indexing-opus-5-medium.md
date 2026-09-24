# indexing — major-refine, Opus 5 medium

Benchmark id: `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)).
Benchmark commit `d9952522`.

| | |
| --- | --- |
| Executor | claude, `claude-opus-5`, effort `medium` |
| Judge | claude, `claude-opus-5`, effort `high` |
| Runs | 3 per arm per task, 36 graded runs |
| Arms | none (`no_skill`) · old (`with_skill`, skill_version `2f0adb01`, the 318-line text) · new (`with_skill`, skill_version `d9952522`, the minimized text) |
| `self_judged` | **true** on every run — judge and executor are both claude. A caveat on the numbers, not a defect in them. |

Tasks: `indexing-goal-001`, `indexing-quiz-001`, `indexing-quiz-002`, `indexing-quiz-003` (every live task whose `skill:` is `skills/indexing`). None has a template, so there was nothing to install.

## Headline — pass counts, new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| indexing-goal-001 | **3/3** | **3/3** | **0/3** |
| indexing-quiz-001 | 3/3 | 3/3 | 3/3 |
| indexing-quiz-002 | 3/3 | 3/3 | 3/3 |
| indexing-quiz-003 | 3/3 | 3/3 | 3/3 |

The three quizzes are saturated on this stack: every arm passes every line of every run. The separation is
entirely on the goal task, and there it is a single line: all three no_skill runs pass expect_1–expect_5 and
fail **expect_6**, the named production target for the read side. Both skill texts close it, 3/3 each, so on
pass rate the two texts cannot be told apart.

The skill triggered unprompted in all 24 `with_skill` runs (a `Skill` call in every transcript). Nothing was
trigger-forced; these are trigger-inclusive numbers on all three arms.

## Per-check

| Task | line | new | old | none |
| --- | --- | --- | --- | --- |
| indexing-goal-001 | expect_1 event-first contract | 3/3 | 3/3 | 3/3 |
| | expect_2 indexer, not a request-time scan | 3/3 | 3/3 | 3/3 |
| | expect_3 ranking offchain | 3/3 | 3/3 | 3/3 |
| | expect_4 read architecture in README | 3/3 | 3/3 | 3/3 |
| | expect_5 production run story | 3/3 | 3/3 | 3/3 |
| | expect_6 named production target | 3/3 | 3/3 | **0/3** |

Every quiz line passed in every run.

The no_skill miss is the one [`indexing-read-side-deploy-omitted`](../mistakes/indexing/indexing-read-side-deploy-omitted.yaml)
already records, and it got more frequent: on 2026-08-19 the same model missed it 1/3 with no effort recorded; here
it is 3/3 at medium. All three no_skill builds are Ponder with a real production story — `npm run start`, Postgres
via `DATABASE_URL`, a fresh `DATABASE_SCHEMA` per deploy, `/ready` as the readiness probe — and then no host:
"set these in your host's dashboard". The record gains a `claude/claude-opus-5/medium` key with the arms split.

## Goal task, per run

What the task notes ask to record. Every run emits a `CheckedIn`-style event, keeps leaderboard and streak
logic offchain (expect_1 and expect_3 pass everywhere), ships one source contract, and targets Base. No run
fetched another ethskills `SKILL.md` over the network, in any arm.

| run | arm | read side | production target named in README |
| --- | --- | --- | --- |
| 020523Z-1 | none | Ponder | — |
| 025740Z-2 | none | Ponder | — |
| 034832Z-3 | none | Ponder | — |
| 021817Z-1 | old | subgraph | Subgraph Studio → The Graph network |
| 031053Z-2 | old | subgraph | The Graph decentralized network |
| 040839Z-3 | old | subgraph | The Graph decentralized network |
| 023745Z-1 | new | Ponder | Railway (Fly.io, systemd on a VM as alternatives) |
| 032753Z-2 | new | Ponder | Railway |
| 041638Z-3 | new | Ponder | Railway (Fly.io, systemd on a VM as alternatives) |

The two skill texts steer to different stacks. The old text, whose one worked indexer example is a full The Graph walkthrough (schema, mapping, `graph deploy` to Studio), produced
a subgraph 3/3; the new text, which lists "a subgraph, Ponder, a provider data API, or your own indexer" as
equals, left the model on its own default, Ponder, 3/3 — and then made it name a host, which is the one thing
the default lacked.

## Cost — medians per arm, with ranges

From `yarn run-stats --tasks indexing-quiz-001,indexing-quiz-002,indexing-quiz-003,indexing-goal-001 --benchmark major-refine-d9952522`,
split by `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. `cost_source: executor`
throughout (claude's own reported price).

| Task | arm | turns | duration | cost | cost range | total tokens |
| --- | --- | --- | --- | --- | --- | --- |
| indexing-goal-001 | none | 60 | 764s | $3.47 | $2.91–$4.05 | 3,226,549 |
| indexing-goal-001 | old | 58 | 990s | $3.66 | $1.86–$6.42 | 3,254,615 |
| indexing-goal-001 | new | 61 | 1209s | $3.30 | $2.87–$4.85 | 2,948,124 |
| indexing-quiz-001 | none | 4 | 136s | $0.41 | $0.40–$0.47 | 93,944 |
| indexing-quiz-001 | old | 6 | 132s | $0.47 | $0.43–$0.51 | 127,526 |
| indexing-quiz-001 | new | 5 | 93s | $0.34 | $0.28–$0.34 | 86,407 |
| indexing-quiz-002 | none | 14 | 149s | $0.72 | $0.65–$0.90 | 233,582 |
| indexing-quiz-002 | old | 17 | 162s | $0.87 | $0.77–$0.89 | 286,930 |
| indexing-quiz-002 | new | 16 | 129s | $0.56 | $0.55–$0.76 | 211,621 |
| indexing-quiz-003 | none | 4 | 79s | $0.30 | $0.26–$0.33 | 82,319 |
| indexing-quiz-003 | old | 4 | 57s | $0.27 | $0.26–$0.28 | 67,229 |
| indexing-quiz-003 | new | 4 | 48s | $0.21 | $0.21–$0.24 | 59,541 |

On the quizzes the new text is the cheapest arm on every task — below no_skill, not just below old — and
the old text costs more than no_skill on quiz-001 and quiz-002 (+36% and +23% tokens), where it is loaded
for a question the model already answers. On the goal task the three arms sit within each other's ranges on
cost and tokens; the new arm's median duration is the longest (1209s against 764s for none), which at n=3 with
overlapping cost ranges is a note rather than a finding. The indexing refinement is a small cost win, not
the large one ship's was.

## Run incidents

**One goal run was killed by its own executor and discarded, not graded.** The first none-arm goal run,
`indexing-goal-001/2026-09-23T201034Z-claude-no-skill-1`, finished its build and cleaned up after its local
end-to-end check with `pkill -f "tsx" ; … pkill -f anvil`. `yarn run-executor` and `yarn verify` run under
`tsx`, so the pattern matched the harness process driving the run: `run-executor` was interrupted, `executor.yaml`
kept `finished: null`, and `verify` would have refused it. The run dir and its workspace were deleted and the
run was set up again as `2026-09-24T020523Z-claude-no-skill-1`. By its timing the same `pkill` also reached
**other rows on the box**: after 20:23Z no `tsx` process was left on the machine, two sibling rows' goal runs
started at 20:14Z stopped and were re-made by their orchestrators at 20:24Z, and one of them left an orphaned
anvil on port 8545. Its `pkill -f anvil` did not appear to run (the sibling anvil survived).

A second run, `2026-09-24T020455Z-claude-no-skill-1`, was stopped by exact PID a few seconds after its
executor started, because it had been launched under a per-task lock file rather than the box-wide one the
operators agreed on; it was deleted and re-made under the right lock. It produced nothing.

After that, every goal-001 run — setup, run-executor, verify — ran under a box-wide
`flock ~/.cache/ethskills-evals/goal.lock`, so no two rows ran a goal executor at once, and after each
executor exited the loop killed, by exact PID, any process whose cwd was inside that run's workspace (anvil,
`next-server`, a Ponder indexer), before `verify` snapshotted it. The reaping happened after `executor.yaml`
recorded `finished:`, so it cannot have touched what the executor produced. Quiz runs took no lock.

No run was graded over a refusal, `--grade-failed-run` was never used, and nothing is retracted. `expect_sha`
is uniform across all nine runs of each task (`2057f17b8afa` goal-001, `7466a81452bb` quiz-001,
`830fce23dfcc` quiz-002, `b7b9e26f8d86` quiz-003); no expect line was touched.

**Evidence.** The goal task is bare, so `verify` snapshots the whole workspace into `output/`. It is
force-added for every run, minus `indexer/.ponder/` — Ponder's local PGlite database from the executor's own
dev run, 1,733 files and 504K across the six Ponder runs, which the indexer's own `.gitignore` excludes and no
expect line reads. The judge saw it; a regrade will not, which changes nothing on the current rubric.

## For #119: process and port isolation

The harness has no process isolation between runs, and on a shared box that means no isolation between
**rows**. An executor runs under the operator's uid, so any pattern kill it issues (`pkill -f tsx`,
`pkill -f anvil`, `pkill -f ponder` — the last reported by another row's operator on a Kimi K3 run of this same task) reaches every
row's harness processes and executors, not only its own. Goal tasks invite this: they stand up anvil, a dev
server and an indexer, and a tidy executor tears them down by name. They also share ports: every row's
goal-001 executor starts anvil on the default 8545, so two concurrent runs can deploy to, and read from, each
other's chain. AGENTS.md's "Isolation" section already names the gap ("closing either means a sandbox profile
or a container"); this benchmark is where it cost runs. The box-wide `goal.lock` above is a workaround that
serializes goal tasks across rows; the fix is a PID and network namespace per executor (or a container), so
a `pkill` and a port bind are scoped to the run.

## Summary

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes, on the goal task only: new **3/3** · old **3/3** · none **0/3**. Quizzes 3/3 on every arm. Totals new 12/12, old 12/12, none 9/12. New vs old: no difference in pass rate. |
| Did it reduce time/tokens? | New vs none: fewer tokens on every task (goal 2.95M vs 3.23M, quizzes 8–28% fewer) and cheaper on every quiz; goal duration longer (1209s vs 764s) with overlapping cost ranges. New vs old: cheaper and fewer tokens on every task (goal $3.30 / 2.95M vs $3.66 / 3.25M; quiz-002 $0.56 vs $0.87). |
| Did it create negative deltas? | None on pass rate. The old text costs more than no_skill on quiz-001 and quiz-002 (+36% / +23% tokens) for no pass-rate gain; the new text does not. |
| What mistakes repeated without the skill? | `indexing-read-side-deploy-omitted` — 3/3 no_skill, expect_6 only. |
| What mistakes remained with the skill? | None: 0/3 on both old and new. |
| What should change in the skill? | Nothing the runs demand. The new text's production-home paragraph is doing the work (every new-arm run names Railway), at lower cost than the old text. |
| What should change in the eval? | The quizzes are saturated on Opus 5 medium, 27/27 across all arms, so on this stack they measure cost, not knowledge; the goal task's expect_6 is the only line that separates. Harder quiz variants, or dropping the quizzes' weight in the headline, would help. And the process/port isolation gap above, raised on #119. |
