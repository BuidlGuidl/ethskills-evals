# ship minimal — 2026-08-24

Executor: Codex CLI default (`gpt-5.6-sol` observed in transcripts). Judge:
Codex CLI default. Runs: 3/variant for five tasks. All 30 result records are
marked `self_judged: true` because executor and judge used the same stack.

Skill version: `678141e`. The skill was reduced from 2,295 to 575 words. Quiz
001, quiz 002, and quiz 004 were revised before this run; quiz 003 and goal 001
kept their prior grading surface. Every executor completed naturally.

## Results

| Task | no_skill | with_skill | Delta |
| --- | --- | --- | --- |
| ship-quiz-001 | 3/3 | 3/3 | saturated |
| ship-quiz-002 | 3/3 | 3/3 | saturated |
| ship-quiz-003 | 1/3 | 3/3 | +2 |
| ship-quiz-004 | 3/3 | 3/3 | saturated |
| ship-goal-001 | 0/3 | 3/3 | +3 |

The strongest result is the unprompted build. Without the skill, all three goal
runs failed README caller coverage; two stored raw application data onchain, two
left deployment undecided, and one also maintained onchain ranking. All three
with-skill runs passed all six conditions.

Quiz 003 independently validates the new caller-incentive example. Two no-skill
runs named permissionless settlement without a concrete reason to pay gas; all
three with-skill runs supplied an incentive.

The three revised quizzes remain ceiling-limited on this stack. Quiz 002 now
applies realistic verification pressure and quiz 004 no longer depends on live
product research, so their validity improved, but neither distinguishes the
variants. Quiz 001 should not be made more elaborate merely to force a delta;
the current model already handles the contract-surface decision.

Cost and duration were not recorded consistently by this Codex harness. Quiz
transcripts expose token counts inconsistently and goal transcripts do not
provide a reliable comparable total, so no cost claim is made.

## Run integrity

An initial batch-wrapper error propagated Bash `nounset` into executor login
shells and created empty-evidence setup/grade records. Those records are invalid
and excluded. A second set of otherwise-valid with-skill runs recorded the
pre-edit Git SHA because the working-tree skill had not yet been committed; they
are also excluded. The reported cohort consists of the valid no-skill runs and
fresh with-skill runs whose `skill_version` is `678141e`.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes: goal `3/3 vs 0/3`; quiz 003 `3/3 vs 1/3`; other quizzes `3/3 vs 3/3`. |
| Did it reduce time/tokens? | Not established; Codex did not record comparable cost/duration metrics. |
| Did it create negative deltas? | None observed. |
| What mistakes repeated without the skill? | `ship-goal-offchain-data`, `ship-goal-offchain-ranking`, `ship-goal-readme-transition-audit`, `ship-goal-deployment-decision`, `ship-state-transition-incentive`. |
| What mistakes remained with the skill? | None of the recorded ship mistakes. |
| What should change in the skill? | Keep the 575-word minimal skill; no further content addition is supported by this run. |
| What should change in the eval? | Retain goal 001 and quiz 003. Quiz 001/002/004 are valid regression checks but should not drive skill-retention decisions on this stack while saturated. Add first-class duration/token capture and make failed executors ungradable. |
