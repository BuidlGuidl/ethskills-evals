# indexing: minimized skill, full re-run

Executor/judge: claude `claude-opus-5`, 3 runs/variant, 24 runs. Skill under test: `skills/indexing` at 24 lines, down from 318 (rewrite of 2026-08-18). Every run reports `self_judged: true` — executor and judge are the same agent and model — though each grade ran in a fresh blind process. This is a different stack from the codex round in PR #64, so the two tables sit side by side; they do not merge.

| Task | no_skill | with_skill | Only failing check |
| --- | --- | --- | --- |
| quiz-001 (scan vs index) | 3/3 | 3/3 | — |
| quiz-002 (Graph go-live + cost) | 3/3 | 3/3 | — |
| quiz-003 (don't over-index) | 3/3 | 3/3 | — |
| goal-001 (Streak build) | 2/3 | 3/3 | expect_6, one no_skill run |

## What the rewrite cost: nothing measurable

Cutting 294 lines did not lose a single check. Every claim the long version passed, the short version passes: the cap-derived page count, the two-step Studio path with live-sourced pricing, the Multicall3 current-state answer, event-first contracts, offchain ranking, and the read architecture written down. The trigger also survived the rewrite — the skill invoked itself in 11 of 12 with_skill runs on its `description` alone.

## What the rewrite is worth: one sentence, on this stack

The deploy-home paragraph is the only content still separating the variants, and only on one run of three. On codex the same claim was worth 3/3 vs 0/3; claude/opus names Railway or Fly unprompted in two runs of three. The remaining visible difference is not in the pass counts: all three with_skill runs commit a deploy artifact (Dockerfile, and twice a railway.json), no no_skill run commits any. goal-001's expect_6 grades README prose, so it cannot see that.

Both stacks chose Ponder for the read side in every run, with the with_skill runs naming subgraphs as the rejected alternative — so the delta was never "the skill points at The Graph".

## Verdict

Against the table in issue #1: three quizzes at both-pass and a goal task that is nearly both-pass reads **wiki** for the body of the content, with one live question — whether the deploy-home nudge holds up as a skill trigger. It is worth one more datapoint before deciding, not more evals of the trimmed knowledge:

1. Re-run goal-001 only on codex `gpt-5.6-terra` against the minimized skill. That is the stack where the claim was worth 0/3 vs 3/3, and it is the one apples-to-apples comparison available for the rewrite.
2. If codex also converges (no_skill 2/3 or 3/3), fold the paragraph into the wiki and retire the skill.
3. Widen expect_6 to credit a committed deploy artifact first — on this stack that is the real behavioural difference and the current check is blind to it.

Cost, across all four tasks, with_skill came in cheaper on average (goal $3.30 vs $6.78; quiz-002 $0.86 vs $1.20; the two short quizzes within a few cents). Consistent in direction across 12 pairs, but n=3 per task with one $11.54 no_skill outlier — suggestive, not a measurement.

## Records

- 24 result records under `artifacts/indexing-*/2026-08-19T*-claude-*`
- per-task reports: `reports/indexing-{quiz-001,quiz-002,quiz-003,goal-001}-2026-08-19.md`
- `mistakes/indexing/indexing-read-side-deploy-omitted.yaml` updated: no_skill 1/3 on this stack, was 3/3 on codex
- 7 runs were killed mid-flight by a session rate limit on the first attempt (12 concurrent executors) and deleted rather than graded; they were re-run at 2-way concurrency. No partial run was recorded.

## Addendum, 2026-08-20 — codex answered the open question

The verdict above proposed one experiment: goal-001 on codex `gpt-5.6-terra` against the minimized skill, with "if codex also converges, retire the skill" attached to it. It ran (`reports/indexing-goal-001-2026-08-20.md`, commit `0dc65d2`) and **codex did not converge**: `3/3` with the skill against `0/3` without it, every no_skill run failing both expect_5 and expect_6, which is the original #64 delta reproduced exactly on 24 lines instead of 318.

**The verdict is therefore resolved the other way: keep the minimal skill.** Points 1 and 2 above are closed; do not fold the deploy-home paragraph into the wiki. Point 3 is amended by the codex evidence — two of three with_skill runs there made a valid named production decision in README prose with no committed artifact, so a deploy-artifact check would have missed them. Keep expect_5/expect_6 as the graded surface and treat a committed Dockerfile/railway.json as supplementary evidence, not a replacement.

What the two rounds say together is that the same 24 lines are worth nothing on claude `claude-opus-5` (no_skill 2/3, and the one failure names a full run story without a host) and worth the entire task on codex `gpt-5.6-terra` (no_skill 0/3, stopping at a local read side every time). The content is not the variable; the executor's default thoroughness about production is. Two consequences for the program in issue #1:

- A verdict cell in that table is only meaningful with a stack attached. "Wiki — the skill is dead weight" was true of this skill on one stack and false on another, from identical content and identical checks.
- Trimming to nudges is safe under both readings. The 294 lines cut were dead weight on both stacks; the paragraph that survived is the one carrying the codex delta.

Token use also split by stack and cancels out as an argument either way: with_skill ran cheaper on claude (goal $3.30 vs $6.78) and about 42% more tokens on codex (57,384 vs 40,395 average). Both n=3, descriptive only.
