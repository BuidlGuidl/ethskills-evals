# indexing-goal-001: minimized skill, codex re-run

Executor/judge: codex `gpt-5.6-terra`. Runs: 3/variant. Skill under test: the 24-line minimized `skills/indexing` at `dc771ad`. Every run reports `self_judged: true` because executor and judge use the same agent/model, though every grade ran in a fresh blind process.

| Variant | Pass | expect_1 | expect_2 | expect_3 | expect_4 | expect_5 | expect_6 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| no_skill | 0/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 0/3 |
| with_skill | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |

## The codex delta survives the rewrite

The minimized skill reproduces the original codex result exactly: `3/3` with the skill versus `0/3` without it. All six runs built event-first contracts, derived the feed/streak/leaderboard offchain from a persistent full-history event index, and documented how the read model stays current. The only separation is the production-home decision.

Every no-skill run stopped at a local read side. Run 1 supplied PostgreSQL and local Docker Compose but named no host and no production service entrypoint. Run 2 discussed replacing SQLite with PostgreSQL for production without saying where or how the service runs. Run 3 documented only local SQLite operation. Accordingly, all three fail both expect_5 (a production run story) and expect_6 (a named target).

Every with-skill run named a production home and a start path. Run 1 named Render, Fly.io, or ECS with managed PostgreSQL and `npm run dev`; run 2 supplied a Dockerfile and a Railway/Postgres deployment procedure; run 3 named two Railway services with Railway Postgres and the `yarn indexer` / `yarn api` entrypoints. The mistake record remains `indexing-read-side-deploy-omitted`.

This does not converge with the claude/opus-5 result (`2/3` no-skill versus `3/3` with-skill). On codex `gpt-5.6-terra`, the deploy-home paragraph still changes behavior rather than merely restating knowledge both variants already apply. That is evidence to keep the minimal skill instead of retiring it into the wiki on the basis proposed in the prior report.

## Cost and artifacts

Executor token counts were higher with the skill: 172,152 total / 57,384 average versus 121,186 total / 40,395 average without it (about 42% higher average). At three runs this is descriptive, not a stable cost estimate; the longest with-skill run researched and validated a Ponder build.

The proposed deploy-artifact check would not replace the prose checks in this sample. One of three with-skill runs committed a production Dockerfile, while none of the no-skill runs did; the other two with-skill runs made valid named production decisions in README prose. Keep expect_5 and expect_6, and add an artifact check only as supplementary evidence.

## Records

- Six result records under `artifacts/indexing-goal-001/2026-08-20T*-codex-*`
- `mistakes/indexing/indexing-read-side-deploy-omitted.yaml` updated for this stack

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 0/3` |
| Did it reduce time/tokens? | no; with-skill averaged 57,384 tokens vs 40,395 no-skill |
| Did it create negative deltas? | Higher executor token use (about 42% average); no grading regressions |
| What mistakes repeated without the skill? | `indexing-read-side-deploy-omitted` |
| What mistakes remained with the skill? | none |
| What should change in the skill? | Keep the concise production-home paragraph; it is the section responsible for the codex delta |
| What should change in the eval? | Keep expect_5/expect_6; a deploy-artifact check can be supplementary but would miss two valid with-skill decisions here |
