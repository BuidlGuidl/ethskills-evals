# major-refine: `indexing` on GPT 5.5 high

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `codex` · `gpt-5.5` · effort `high` (codex-cli 0.156.1) |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | **false** on all 36 records |
| Runs | 3 per arm per task, 4 tasks × 3 arms = **36 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 retracted, `--grade-failed-run` never used, no run discarded or re-run. Two judge failures were re-graded on the same evidence (see "Integrity notes") |
| Trigger | not forced; numbers are trigger-inclusive. All 24 skill-arm runs read `.agents/skills/indexing/SKILL.md` as their first tool call |
| Sitting | 2026-09-23, 14:52–18:58 UTC, with a pause 15:36–17:02 while the judge's claude.ai usage limit reset. One executor at a time (setup → run-executor → verify), arms interleaved none/old/new within each wave, except wave 1 of quiz-001 (see "Integrity notes") |
| Costs | codex dollars are `cost_source: list_price`: the token split priced at OpenAI list price in `lib/prices.ts`. They are not a bill |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `indexing`, 318 lines: "What You Probably Got Wrong", event-first design, a full NFT subgraph example, "Deploying a Subgraph" (`graph deploy --studio`, "Publish to the decentralized network for production"), alternatives, provider APIs, then "Reading Current State" / Multicall3 from line 241 |
| new | `with_skill` | `d9952522` | refined `indexing`, 24 lines: index-don't-scan with the getLogs caps, event-first, "current state is not indexing work" with Multicall3, "the read side is not designed until its production home is named", hosted-service sunset, Studio → publish, ~100K free then ~$2/100K |

Both `skill_version` commits are ancestors of HEAD. No task has a template. Within each task, all nine runs carry the same `input_sha` and `expect_sha`.

**Tasks.** All four live tasks whose `skill:` is `skills/indexing`:

- `indexing-quiz-001`: an NFT activity feed planned as `eth_getLogs` from block 0 on page load. What happens, how many requests, what breaks, what to build instead. 5 lines.
- `indexing-quiz-002`: a runbook that says `graph deploy --hosted-service` is free. The real go-live path to The Graph, and its cost at a few million queries a month, with sources. 5 lines.
- `indexing-quiz-003`: a portfolio panel of 40 ERC-20 balances, with a proposed subgraph. Overkill or not, and how many onchain calls. 4 lines.
- `indexing-goal-001`: build "Streak", a daily check-in app on Base: contract, read side for feed / streaks / monthly leaderboard over full history, and a README with architecture, deploy, local run. 6 lines. e5 asks for a production run story; e6 asks for a named production target.

## Headline: pass counts, new · old · none

| Task | new · old · none | Per run |
| --- | --- | --- |
| `indexing-quiz-001` | `3/3 · 3/3 · 3/3` | 5/5 lines in all nine runs |
| `indexing-quiz-002` | `3/3 · 3/3 · 3/3` | 5/5 lines in all nine runs |
| `indexing-quiz-003` | `3/3 · 3/3 · 3/3` | 4/4 lines in all nine runs |
| `indexing-goal-001` | `0/3 · 1/3 · 0/3` | new `ppppp f` ×3; old `pppp ff`, 6/6, `ppppp f`; none `pppp ff` ×3 |
| **total** | **`9/12 · 10/12 · 9/12`** | |

**The quizzes are saturated on this stack.** All 27 runs pass every line. Without the skill, codex gpt-5.5 already:

- derives the getLogs page count from a stated cap,
- knows the hosted service is gone,
- quotes The Graph's 100K-free / $2-per-100K pricing from thegraph.com,
- and batches the 40 balances into one Multicall call.

**The goal task is the only signal, and it sits on two lines.** e1–e4 pass in all nine runs. Every run, in every arm, emits the note in the event, backfills into a persistent store, and ranks offchain. The arms separate only on the README's production story:

| indexing-goal-001 line | new | old | none |
| --- | --- | --- | --- |
| e1 event-first contract, note recoverable | 3/3 | 3/3 | 3/3 |
| e2 indexer with one-time backfill, no per-request scan | 3/3 | 3/3 | 3/3 |
| e3 rankings computed offchain | 3/3 | 3/3 | 3/3 |
| e4 README names the read architecture and its sync | 3/3 | 3/3 | 3/3 |
| e5 production run story (process + command + state) | **3/3** | 2/3 | **0/3** |
| e6 a named production target | **0/3** | 1/3 | **0/3** |

The new text fixes e5 completely and fixes e6 in no run. The single old-arm pass is a subgraph run whose Studio target came from the tool choice, and I think it is a lenient grade (below).

The judge's per-line reasoning is not persisted by `verify`. The causes below are my reading of the committed `output/` and `transcript.md`, not the judge's words.

## What the runs did

### indexing-goal-001

All nine runs put the note in the event and compute streaks and the leaderboard offchain. All of them passed their own tests or typecheck by the end.

**Common sandbox friction.** The codex sandbox's home directory is read-only, so every first `npm install` failed with EROFS and was retried with a redirected npm cache. Six runs redirected to `/tmp`. Three redirected to `.npm-cache/` inside the workspace, which is what broke grading (see "Integrity notes"). Two runs (old-1, none-3) dropped `better-sqlite3` because it could not build natively, and fell back to `node:sqlite` or a JSON file.

| Run | Arm | Expects | Indexer · store | Production text (short quote) |
| --- | --- | --- | --- | --- |
| `…T172524Z-codex-no-skill-1` | none | pppp ff | custom viem poller · JSON file | none. Deployment ends at "Run the read side with `STREAK_CONTRACT_ADDRESS` and `STREAK_START_BLOCK` set" |
| `…T175934Z-codex-no-skill-2` | none | pppp ff | custom indexer + SSE · JSON file | "Notes For Production": "replace the persistence internals with Postgres, SQLite, or another durable database" |
| `…T182610Z-codex-no-skill-3` | none | pppp ff | custom indexer · "durable JSON file" | none; `npm run index` appears only under Local Development |
| `…T173843Z-codex-with-skill-2f0adb01-1` | old | pppp ff | custom worker · SQLite (`node:sqlite`) | "For a larger hosted production setup, the same event model can be moved to a managed indexer or a subgraph" |
| `…T180804Z-codex-with-skill-2f0adb01-2` | old | pppppp | **subgraph** + thin read-api proxy | "Deploy with The Graph CLI, for example to Subgraph Studio: `npx graph deploy --studio streak …`", `SUBGRAPH_URL=https://api.studio.thegraph.com/query/…` |
| `…T183954Z-codex-with-skill-2f0adb01-3` | old | ppppp f | Ponder · Postgres | "Run Ponder in production with a persistent Postgres database: `DATABASE_URL=… npm run start`" |
| `…T174931Z-codex-with-skill-d9952522-1` | new | ppppp f | Ponder · Postgres | "Host this as one continuously running worker/API process on a platform that supports Node.js and Postgres" |
| `…T181724Z-codex-with-skill-d9952522-2` | new | ppppp f | custom worker · Postgres | "run `npm run start:indexer` as a long-lived worker service with a persistent Postgres database … Use managed Postgres" |
| `…T185101Z-codex-with-skill-d9952522-3` | new | ppppp f | custom worker (bounded getLogs + cursor) · Postgres | "one worker service running `npm run indexer`; one managed Postgres instance with backups" |

**Why the new arm passes e5 and fails e6.** The new text's fourth paragraph says: "Decide where the indexer runs in production and by which command or service, and write that down." All three new runs did the "command or service" half literally: a production section, a start command, Postgres. That is e5. They answered "where" with a *kind* of host, not a named one. new-2's own closing summary says "the production service commands are named explicitly", so it took naming the command for naming the home. No platform appears anywhere in the three new-arm transcripts or output trees; searched for Railway, Fly, Render, systemd, Heroku, k8s, Cloud Run, Neon and Supabase. The paragraph's only concrete targets are The Graph's. Its line "the host, the persistent store and the process supervision are yours to name" hangs off the self-hosting sentence with no example. All three new runs self-hosted (Ponder or a custom worker).

**What made old-2 pass.** It was the only run of the nine to pick a subgraph. The old text's `graph deploy --studio` block sat inside its 240-line read, and it copied that path. So a named target came with the tool. The other two old runs chose Ponder or a custom worker and named no host.

**A hypothesis about the description (not a finding).**
- **What differs:** between `dc771ad`, which the 2026-08-20 codex runs used, and `d9952522`, the SKILL.md *body* is byte-identical. Only the frontmatter `description` changed, in #129. It used to read "…and ship that read side to a named production home". The trigger rewrite dropped that clause.
- **The earlier runs:** all three 2026-08-20 codex with-skill goal runs (gpt-5.6-terra) named a platform and passed e6. Two named a Railway service with Railway Postgres; one said "for example Render, Fly.io, or ECS".
- **Today's runs:** none of today's three new-arm runs named one.
- **Confound:** the model changed as well (gpt-5.6-terra → gpt-5.5), so these runs cannot separate the description from the model. A same-model run of the `dc771ad` text would.

**The none arm** is codex's known default (`indexing-read-side-deploy-omitted`): a read side that only ever ran locally, and all three store it in JSON files.

### indexing-quiz-001 (NFT feed via getLogs from block 0)

All nine runs anchor on a ~10K-block `eth_getLogs` window, giving about 2,580 requests at block 25.8M. Most also give the 2K-block figure (~12,900) and the 10K-matched-log cap. All flag that `Transfer` logs alone cannot identify sales, recommend an indexer (Ponder, a subgraph, or an NFT data API), and keep top holders as a precomputed holder table.

- **Where the figures came from:**
  - The two old runs that made no web search took "~10K blocks" straight from the old text.
  - The new text gives no number. New runs searched once or not at all.
  - No-skill runs searched 2–7 times. Two of them went furthest, pricing Alchemy's free 10-block range and QuickNode's 5-block trial range at 2.58M and 5.16M requests.
- **Only the new arm says where the indexer runs** in production: new-1 names a "production host/scheduler", and new-2 has the subgraph "published for production".

### indexing-quiz-002 (hosted-service runbook)

All nine runs:

- quote "first 100,000 queries/month free" and "$2 per 100,000", which gives $58 at 3M and $98 at 5M;
- source those figures to The Graph's studio-pricing or billing pages;
- separate a Studio deploy from publishing to the network;
- and say the hosted service is gone.

**Differences between arms:**
- **Sunset date:** two of the three no-skill runs give none. One says "new hosted-service deployments stopped during the migration path", another "started sunsetting… years ago". Every skill-arm run gives June 12, 2024, but the old text has no sunset line, so the old runs got the date by search as well.
- **Research volume:** skill arms searched as much as none (8–14 searches per run). The new text's "$2/100K" did not save a search; every run re-read the pricing page, which is what the task asks for.
- **Signal size:** two runs (old-2, none-3) recommend 5–10K GRT of curation signal, citing an "Incentivizing Syncs" page dated August 2026. I could not verify that page from the transcripts.
- **Old-1 budget line:** it says "about $60/month at 3M", while its own table gives $58.
- **Hallucinated prices:** none found.

### indexing-quiz-003 (40 balances, proposed subgraph)

No run searched the web. All nine judge the subgraph overkill and less accurate (indexing lag, rebasing tokens), and give one `eth_call` carrying 40 `balanceOf` calls.

- **Multicall3 by name:** all 3 new, all 3 old, and 1 of 3 none. The other two no-skill runs say "Base multicall contract" / viem `multicall`, and "Multicall".
- **Contract address:** only new-3 gives `0xcA11…CA11`.
- **Provider balances endpoint** (`getTokenBalances`): no run in any arm mentioned it, although the new text names one.

### How the old text was read

All 18 old- and new-arm quiz runs, and all 6 skill-arm goal runs, read the skill with `sed -n '1,240p'` (one run used `1,220p`), once, as their first tool call.

- **New text:** 24 lines, read in full.
- **Old text:** 318 lines, so codex never saw lines 241–318: "Reading Current State", "Batch Reads with Multicall", "Real-Time Updates", "Common Patterns". The old arm's Multicall3 answers on quiz-003 therefore came from the model, not from that section.

This is a structural argument for the short text on codex: what is past the cut does not get read.

## Per run

Duration, cost and tokens are from `yarn run-stats --tasks indexing-quiz-001,indexing-quiz-002,indexing-quiz-003,indexing-goal-001 --benchmark major-refine-d9952522 --runs`. Codex reports no turn count.

| Run | Arm | Expects | Duration | Cost (list price) | Tokens |
| --- | --- | --- | --- | --- | --- |
| quiz-001 `…T150330Z-codex-no-skill-1` | none | ppppp | 98s | $0.45 | 188770 |
| quiz-001 `…T150818Z-codex-no-skill-2` | none | ppppp | 86s | $0.32 | 114438 |
| quiz-001 `…T151440Z-codex-no-skill-3` | none | ppppp | 150s | $0.69 | 307215 |
| quiz-001 `…T145228Z-codex-with-skill-2f0adb01-1` | old | ppppp | 68s | $0.21 | 85185 |
| quiz-001 `…T151020Z-codex-with-skill-2f0adb01-2` | old | ppppp | 108s | $0.41 | 254434 |
| quiz-001 `…T151741Z-codex-with-skill-2f0adb01-3` | old | ppppp | 92s | $0.18 | 84775 |
| quiz-001 `…T150559Z-codex-with-skill-d9952522-1` | new | ppppp | 107s | $0.31 | 126642 |
| quiz-001 `…T151241Z-codex-with-skill-d9952522-2` | new | ppppp | 89s | $0.28 | 87685 |
| quiz-001 `…T151938Z-codex-with-skill-d9952522-3` | new | ppppp | 64s | $0.16 | 78788 |
| quiz-002 `…T152119Z-codex-no-skill-1` | none | ppppp | 115s | $0.83 | 282059 |
| quiz-002 `…T153051Z-codex-no-skill-2` | none | ppppp | 133s | $0.66 | 220930 |
| quiz-002 `…T170522Z-codex-no-skill-3` | none | ppppp | 156s | $0.88 | 270879 |
| quiz-002 `…T152336Z-codex-with-skill-2f0adb01-1` | old | ppppp | 189s | $0.99 | 339959 |
| quiz-002 `…T153340Z-codex-with-skill-2f0adb01-2` | old | ppppp | 158s | $0.83 | 387890 |
| quiz-002 `…T170837Z-codex-with-skill-2f0adb01-3` | old | ppppp | 143s | $0.75 | 265375 |
| quiz-002 `…T152715Z-codex-with-skill-d9952522-1` | new | ppppp | 189s | $0.97 | 316340 |
| quiz-002 `…T170227Z-codex-with-skill-d9952522-2` | new | ppppp | 140s | $0.79 | 262215 |
| quiz-002 `…T171133Z-codex-with-skill-d9952522-3` | new | ppppp | 162s | $0.89 | 282218 |
| quiz-003 `…T171451Z-codex-no-skill-1` | none | pppp | 50s | $0.14 | 74469 |
| quiz-003 `…T171820Z-codex-no-skill-2` | none | pppp | 35s | $0.11 | 57288 |
| quiz-003 `…T172146Z-codex-no-skill-3` | none | pppp | 45s | $0.12 | 59159 |
| quiz-003 `…T171611Z-codex-with-skill-2f0adb01-1` | old | pppp | 50s | $0.16 | 80717 |
| quiz-003 `…T171916Z-codex-with-skill-2f0adb01-2` | old | pppp | 51s | $0.17 | 81963 |
| quiz-003 `…T172301Z-codex-with-skill-2f0adb01-3` | old | pppp | 42s | $0.13 | 78991 |
| quiz-003 `…T171726Z-codex-with-skill-d9952522-1` | new | pppp | 37s | $0.11 | 59645 |
| quiz-003 `…T172033Z-codex-with-skill-d9952522-2` | new | pppp | 54s | $0.15 | 77425 |
| quiz-003 `…T172413Z-codex-with-skill-d9952522-3` | new | pppp | 47s | $0.14 | 76714 |
| goal-001 `…T172524Z-codex-no-skill-1` | none | pppp ff | 690s | $1.75 | 1333913 |
| goal-001 `…T175934Z-codex-no-skill-2` | none | pppp ff | 464s | $1.04 | 680249 |
| goal-001 `…T182610Z-codex-no-skill-3` | none | pppp ff | 796s | $1.61 | 1224831 |
| goal-001 `…T173843Z-codex-with-skill-2f0adb01-1` | old | pppp ff | 607s | $1.35 | 957305 |
| goal-001 `…T180804Z-codex-with-skill-2f0adb01-2` | old | pppppp | 508s | $1.24 | 959890 |
| goal-001 `…T183954Z-codex-with-skill-2f0adb01-3` | old | ppppp f | 622s | $1.83 | 1546051 |
| goal-001 `…T174931Z-codex-with-skill-d9952522-1` | new | ppppp f | 563s | $1.57 | 1342736 |
| goal-001 `…T181724Z-codex-with-skill-d9952522-2` | new | ppppp f | 482s | $1.25 | 905774 |
| goal-001 `…T185101Z-codex-with-skill-d9952522-3` | new | ppppp f | 386s | $0.93 | 524568 |

## Cost

From `yarn run-stats --tasks indexing-quiz-001,indexing-quiz-002,indexing-quiz-003,indexing-goal-001 --benchmark major-refine-d9952522`, split with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. Medians, with the cost range; dollars are list price.

| Task | new | old | none |
| --- | --- | --- | --- |
| `indexing-quiz-001` | 89s · $0.28 ($0.16–$0.31) · 88k | 92s · $0.21 ($0.18–$0.41) · 85k | 98s · $0.45 ($0.32–$0.69) · 189k |
| `indexing-quiz-002` | 162s · $0.89 ($0.79–$0.97) · 282k | 158s · $0.83 ($0.75–$0.99) · 340k | 133s · $0.83 ($0.66–$0.88) · 271k |
| `indexing-quiz-003` | 47s · $0.14 ($0.11–$0.15) · 77k | 50s · $0.16 ($0.13–$0.17) · 81k | 45s · $0.12 ($0.11–$0.14) · 59k |
| `indexing-goal-001` | 482s · $1.25 ($0.93–$1.57) · 906k | 607s · $1.35 ($1.24–$1.83) · 960k | 690s · $1.61 ($1.04–$1.75) · 1225k |

- **quiz-001:** both skill arms cost about half of none and use under half the tokens, because none researched the RPC caps on the web. The ranges barely overlap: none's cheapest run, $0.32, sits inside old's range and above new's highest.
- **quiz-002 and quiz-003:** the skill adds a little. The skill arms searched as much as none on quiz-002, and quiz-003 needed no research in any arm.
- **goal-001:** the medians fall new < old < none on duration, cost and tokens. At n=3 the ranges overlap, so that is not a demonstrated saving.

## Mistake records

| Record | Change | new · old · none on this stack |
| --- | --- | --- |
| `indexing-read-side-deploy-omitted` | stack keys `codex/gpt-5.5-high@2f0adb01` / `@d9952522` added, reopened note | goal-001, e5 or e6 failed: `3/3 · 2/3 · 3/3`. Split by line, e5: `0/3 · 1/3 · 3/3`, e6: `3/3 · 2/3 · 3/3` |
| `indexing-production-host-generic` | **new**. The e6-only residue: production run story present, host described by kind | goal-001: `3/3 · 1/3 · 0/3` (the none runs fail e5 as well, so they count under the record above) |

Nothing else repeated. No run scanned history per request or ranked onchain. No quiz run over-indexed a current-state read, and none presented the hosted service as live.

## Integrity notes

- **Wave 1 of quiz-001 ran old before none.** My first loop's skip check matched an older, unrelated `codex-no-skill-1` run of quiz-001 (from 2026-08-20) as already graded. So it started `…T145228Z-codex-with-skill-2f0adb01-1` before any none run. I stopped the loop, scoped the skip check to `benchmark: major-refine-d9952522`, let that executor finish, and graded it. From then on the order is none/old/new within every wave. No run was discarded.
- **Operator incident, not a run fault.** To stop that first loop, I ran `pkill -f scratchpad/loop.sh` at 14:52 UTC. The pattern also matched the loop scripts of three sibling orchestrators on the same box (the concepts rows on Opus 5 medium, GLM 5.3 high and Kimi K3 high) and killed their loop shells; their executors ran on. The owners restarted them between 14:54 and 15:05. From then on this row's loops ran under `setsid` and were stopped only by exact PID.
- **Judge usage limit.** The judge for `…T153340Z-codex-with-skill-2f0adb01-2` (quiz-002) exited non-zero at 15:36 on the claude.ai usage limit. Its executor had finished with exit 0 and its workspace was intact. After the reset at 17:02, `verify` graded the same run. No executor was re-run and nothing was regraded under `--regrade`: this was the run's first grade.
- **Judge `EPIPE` on goal-001: `.npm-cache` in the evidence.** The first grade of `…T172524Z-codex-no-skill-1` failed with `spawnSync env EPIPE`. The executor had pointed npm's cache at `.npm-cache/` inside the workspace (the sandbox's home directory is read-only), and 14 MB of it got past the snapshot filters (365 cacache files) into the judge prompt. `reports/tools-2026-08-13.md` hit the same failure (there `ENOBUFS`) and removed the cache; I followed that. For every goal run, before `verify`, the loop moved any workspace-root `.npm-cache/` out of the workspace, then deleted it after the grade. Authored files, lockfiles and everything else were left as the executor wrote them. It applied to three runs, one per arm:

  | Run | `.npm-cache` moved |
  | --- | --- |
  | `…T172524Z-codex-no-skill-1` | 90 MB |
  | `…T180804Z-codex-with-skill-2f0adb01-2` | 174 MB |
  | `…T185101Z-codex-with-skill-d9952522-3` | 92 MB |

  The other six runs put their npm cache in `/tmp`, outside the workspace, so none of them had one to snapshot.
- **The executor inherits this repo's Yarn PnP loader.** In `…T175934Z-codex-no-skill-2`, a Hardhat EROFS stack trace runs through `/home/shiv/evals-run/indexing-gpt-5.5-high/.pnp.cjs`. So `yarn run-executor` hands its PnP `NODE_OPTIONS` down to the codex child, and every `node` the executor runs resolves through the orchestrator repo's PnP map. It also tells the executor where the orchestrator repo is. Nothing in the transcripts shows it changed an outcome. I did not patch the harness; raising it on #119.
- **A grade I think is lenient: old-2 on e5 and e6.**
  - Its README says "Deploy with The Graph CLI, *for example* to Subgraph Studio".
  - It never says "production" and never mentions publishing to the network, which its own skill text calls the production step.
  - Its read API ships only a `read-api:dev` script.

  e6 lists "Subgraph Studio" as a passing target, so e6 is defensible. But e5 fails a README that "documents only local `npm start` / `graph deploy` for development and says nothing about production", and on that wording old-2 could fail e5. If it did, goal-001 would be `0/3 · 0/3 · 0/3`. The rubric is pinned, so I did not touch it. This is for #119: does a Studio deploy without a publish step, hedged with "for example", count as a production home?
- **Output committed.** `output/` is force-added for all 36 runs: 27 `answer.md` files and nine goal trees of 176–368 KB, 2.5 MB in all. Two goal trees (none-1, none-2) also carry small sandbox-workaround dirs (`.foundry-home/.svm`, `.data/xdg/hardhat…`).

## Wrap-up

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Overall, new `9/12` · old `10/12` · none `9/12`. The quizzes are saturated, `9/9` in every arm. On goal-001, new `0/3` vs none `0/3` and vs old `1/3`. By line, new moves e5 (a production run story) from `0/3` to `3/3` vs none, and old reaches `2/3`. Neither text makes codex name a production target (e6: new `0/3`, old `1/3`, none `0/3`) |
| Did it reduce time/tokens? | goal-001 medians: new 482s / 906k / $1.25 · old 607s / 960k / $1.35 · none 690s / 1225k / $1.61. Ranges overlap at n=3. quiz-001: new 89s / 88k and old 92s / 85k vs none 98s / 189k, about half the cost because the skill replaces the web research into RPC caps. quiz-002 and quiz-003 cost slightly more with either skill |
| Did it create negative deltas? | New vs old on goal-001: `0/3` vs `1/3`, on e6 only. That is one run, and its pass came from choosing a subgraph (Studio came with the tool), on a grade I think is lenient. No negative delta against none on any line |
| What mistakes repeated without the skill? | `indexing-read-side-deploy-omitted`, 3/3: a read side that only ever ran locally, on JSON-file stores |
| What mistakes remained with the skill? | `indexing-production-host-generic`: new 3/3, old 1/3. `indexing-read-side-deploy-omitted` as the e5 failure: old 1/3, new 0/3 |
| What should change in the skill? | **New vs none:** (1) In paragraph four, show what a named self-hosted home looks like, e.g. "a Railway service with Railway Postgres, a Fly machine with a volume, a systemd unit on a named VM", and say that a start command plus "managed Postgres" is not a home. All three failures self-hosted and got no concrete target from the text. (2) Test restoring the description clause "ship that read side to a named production home" that #129 dropped: the same body with that description passed e6 3/3 on codex gpt-5.6-terra, but the model differs, so rerun `dc771ad` on gpt-5.5 before crediting it. **New vs old:** keep the short text. Codex reads a skill with one `sed -n '1,240p'`, so 78 of the old text's 318 lines, including its current-state/Multicall section, never reach the model. The new text's 24 lines are read in full |
| What should change in the eval? | (1) The three quizzes are saturated on codex gpt-5.5 (27/27, with the no-skill arm researching or already knowing every fact). They measure nothing between arms on this stack. (2) e5 needs a ruling on a hedged Studio deploy with no publish step (old-2). (3) Harness: add `.npm-cache` to `GENERATED_DIRS` or cap the judge's evidence size, since a codex executor on a read-only home puts npm's cache in the workspace. And strip Yarn PnP `NODE_OPTIONS` from the executor environment |
