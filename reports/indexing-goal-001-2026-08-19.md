# indexing-goal-001 (minimized skill, split expect_5)

Executor/judge: claude `claude-opus-5`. Runs: 3/variant. Skill under test: `skills/indexing` after the 2026-08-18 minimal rewrite. Task changed in the same pass: the old expect_5 was split into expect_5 (is there a production run story at all) and expect_6 (is the production target named), so the counts below are not directly comparable with reports/indexing-goal-001-2026-08-12.md, which ran the original skill on codex with five checks. All runs report `self_judged: true` because executor and judge run on the same agent and model, although every grade ran in a fresh blind process.

| Variant | Pass |
| --- | --- |
| no_skill | 2/3 |
| with_skill | 3/3 |

Per check, expect_1 through expect_5 passed 6/6. The only failure in the whole benchmark is expect_6 in `2026-08-19T061503Z-claude-no-skill-3`.

**The split did its job.** That failing run has a complete production run story — Postgres required rather than PGlite, `npm run start -- --schema streak_v1` for zero-downtime cutover, stateless API replicas, reorg handling — and never says where any of it runs. It passes expect_5 and fails expect_6, which is exactly the distinction the old single check could not express.

**The delta the codex round found has mostly evaporated on this stack.** On codex the original skill went 3/3 against 0/3 with every no_skill run missing the deploy path; here two of three no_skill runs name Railway/Fly/ECS/Render in prose unprompted. What survives is a difference in kind rather than pass rate: all three with_skill runs ship a deployable artifact (a `Dockerfile`, two of them a `railway.json`) alongside the prose, while no no_skill run committed any deploy config. The check cannot see that difference — it grades the README.

**Stack choice was Ponder 6/6.** The with_skill runs discuss subgraphs and Subgraph Studio as the alternative and pick Ponder anyway, so the skill's Graph content is not steering the decision — worth knowing, since "the skill just points at The Graph" was the competing explanation for the codex delta.

**Trigger fired 3/3** — every with_skill run invoked `Skill(indexing)` on its own.

Cost per run: with_skill $3.30 avg (59 turns), no_skill $6.78 avg (99 turns). One no_skill run cost $11.54 over 152 turns and pulls that average up; the direction is consistent across all four tasks in this round, but n=3 with an outlier is not a measurement. Wall-clock is not comparable — runs overlapped.

Harness note: a `forge install` inside `2026-08-19T053207Z-claude-with-skill-2` (a workspace with no `.git` of its own) wrote a `forge-std` submodule entry into the *parent* repo's index and `.gitmodules`. Unstaged and removed by hand; grading was unaffected because that run was graded from the output snapshot. Worth guarding in `setup` if repo-shaped runs become common.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 2/3` — one no_skill run left the production target unnamed (expect_6) |
| Did it reduce time/tokens? | directionally yes: $3.30 vs $6.78 avg, 59 vs 99 turns (n=3, one no_skill outlier at $11.54) |
| Did it create negative deltas? | none |
| What mistakes repeated without the skill? | `indexing-read-side-deploy-omitted`, 1/3 here against 3/3 on codex |
| What mistakes remained with the skill? | none |
| What should change in the skill? | nothing yet. The deploy-home paragraph is the only part still earning its place on this stack, and it is one sentence — if a claude-stack re-run puts no_skill at 3/3, the honest verdict is wiki for the whole skill |
| What should change in the eval? | expect_6 should also credit a committed deploy artifact (Dockerfile / railway.json / compose file), not only README prose — that is where the with_skill runs actually differ, and the current wording is blind to it |
