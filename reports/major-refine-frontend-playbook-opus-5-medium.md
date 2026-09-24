# major-refine: `frontend-playbook` on Opus 5 medium

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `claude` · `claude-opus-5` · effort `medium` |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | **true** on all 72 records — judge and executor are the same agent |
| Runs | 3 per arm per task, 8 tasks × 3 arms = **72 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 dead runs, 0 `retracted`; one judge retry (see Harness notes) |
| Trigger | not forced — numbers are trigger-inclusive; the Skill tool fired in **48/48** `with_skill` runs |
| Node | `v25.9.0` (nvm) on `PATH` for all 72 runs; each driver logged `node -v` at start. goal-001's notes require Node 25+ for expect_10 |
| Date | 2026-09-21, 18:26–20:35 local |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `frontend-playbook`, 362 lines / 13.7 KB: fork workflow, IPFS/ENS/Vercel deploy paths, OG-image and production checklists, phased QA |
| new | `with_skill` | `d9952522` | refined skill, 93 lines / 4.5 KB: `npx create-eth@2.0.23`, fork-mode rules, interval mining, static IPFS build, Node 25 remedy, pre/post-upload verification |

Both `skill_version` commits are ancestors of HEAD. Old is passed as the full sha; both are recorded as 8 characters.

**Tasks** — all eight live tasks whose `skill:` is `skills/frontend-playbook`.

- `frontend-playbook-quiz-001` — fork vs `yarn chain`, real Base USDC, fork-powered funding.
- `frontend-playbook-quiz-002` — `chains.base` vs `chains.foundry` while developing on a fork (chain-ID gotcha).
- `frontend-playbook-quiz-003` — static export with `trailingSlash` so routes resolve on IPFS gateways.
- `frontend-playbook-quiz-004` — Node 25 `localStorage` prerender crash and which layer the remedy lives at.
- `frontend-playbook-quiz-005` — `block.timestamp` frozen on an anvil fork (vesting page), one-off and permanent fix, generalization.
- `frontend-playbook-quiz-006` — stale build, CID as proof, gateway route checks.
- `frontend-playbook-goal-001` — template `se-2-foundry`: USDC tip jar on a Base fork plus an IPFS `DEPLOY.md`; 10 expects (1–5 fork mode and config, 6–9 deploy discipline, 10 Node 25).
- `frontend-playbook-goal-002` — bare workspace: the same tip jar from scratch; 2 expects (scaffolded with `create-eth`, scaffolded wallet/contract tooling).

Template note: `se-2-foundry` ships without `node_modules`, as `templates/README.md` says (the executor runs `yarn install` itself), and goal-001's notes pin no install, so nothing was pre-installed. The runs were made from a fresh worktree of the benchmark commit, where the template is exactly as git holds it.

## Pass counts — new · old · none

| Task | new · old · none | Failing lines |
| --- | --- | --- |
| `quiz-001` | `3/3 · 3/3 · 3/3` | — |
| `quiz-002` | `3/3 · 3/3 · 3/3` | — |
| `quiz-003` | `3/3 · 3/3 · 3/3` | — |
| `quiz-004` | `3/3 · 3/3 · 3/3` | — |
| `quiz-005` | **`1/3` · `3/3` · `0/3`** | none: e4 ×3, e3 ×1 (run 1). new: e4 ×2 (runs 1, 3) |
| `quiz-006` | `3/3 · 3/3 · 3/3` | — |
| `goal-001` | `3/3 · 3/3 · 0/3` | none: e6, e7, e9, e10 in every run; e1–e5 and e8 pass 3/3 |
| `goal-002` | `3/3 · 3/3 · 0/3` | none: e1, e2 in every run |
| **total** | **`22/24 · 24/24 · 15/24`** | |

The skill's value sits in the same three tasks as on 2026-09-05: goal-001, goal-002 and quiz-005 — `0/9` unaided, `9/9` with the old text, `7/9` with the new one. The other five quizzes and the fork-mode half of goal-001 (fork not chain, real USDC, whale funding, `chains.foundry`, `trailingSlash`, a non-home route on the gateway) are things Opus 5 medium does unaided, 3/3 every time.

### Where none fails

- **goal-001, deploy discipline (e6, e7, e9): 9/9 line failures.** No unaided `DEPLOY.md` deletes `.next`/`out` before the production build, none treats a changed CID as the proof that new content shipped, and none sets a production origin so OG metadata resolves off localhost. Records: `deploy-no-clean-rebuild-no-cid-proof`, `og-metadata-not-prod-url`.
- **goal-001, Node 25 (e10): 3/3.** All three unaided builds pinned Node 22 through `.nvmrc` and told the reader "Node 25 breaks the build" instead of a process-level remedy that reaches the build workers. The judge graded the pin as not handling the crash. Record: `node25-localstorage-fix-wrong-layer`, whose symptom already lists the Node-24 pin as a variant.
- **goal-002 (e1, e2): 3/3.** Every unaided run did `forge init` plus a hand-rolled `web/` app, 24–26 files, zero mentions of `create-eth` in the transcript. Record: `scaffold-manual-not-create-eth`.
- **quiz-005 (e4): 3/3; (e3): 1/3.** All three unaided answers diagnose the mining model and give the interval-mining fix but stop at vesting — no sentence generalizing the freeze to deadlines, expiry or any other `block.timestamp` read. Run 1 also led with `anvil_mine`/`evm_mine` as the one-off and mentioned interval mining only in passing. Records: `frozen-timestamp-not-generalized` (new, see Records), `frozen-timestamp-wrong-oneoff-fix`.
- `deploy-verify-home-route-only` (goal-001 e8) did not occur unaided: 0/3, as on 2026-09-05.

### New vs old: quiz-005 e4

The one place the arms differ. Old passes e4 3/3; new fails it in runs 1 and 3, and both failing answers end on the permanent `--block-time 1` fix plus an unrelated `chains.foundry` tip, with no generalization at all. Both skill texts name the wider class. The old text states it as a rule about contract logic ("Any contract logic using timestamps (deadlines, expiry, vesting) will break silently"); the new text lists what breaks in a display ("This silently breaks live deadlines, expiry, and vesting displays even when `vm.warp` unit tests pass"). At n=3, `0/3` vs `2/3` is weak evidence that the rule form carries into the answer and the list form does not. The one-off command itself — the fragile part on 2026-08-19 — held in both arms (e3 `0/3` with either text).

## Cost

All figures from `yarn run-stats --tasks <ids> --benchmark major-refine-d9952522` with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. Median per task per arm; cost is claude's own reported price (`cost_source: executor`); tokens are `total_tokens`.

| Task | none: duration / cost (range) / tokens | old: duration / cost (range) / tokens | new: duration / cost (range) / tokens |
| --- | --- | --- | --- |
| `quiz-001` | 78s / $0.31 ($0.28–$0.32) / 82,335 | 57s / $0.31 ($0.28–$0.33) / 70,886 | 47s / $0.23 ($0.22–$0.26) / 60,634 |
| `quiz-002` | 42s / $0.18 ($0.16–$0.19) / 72,517 | 22s / $0.20 ($0.20–$0.22) / 65,020 | 40s / $0.16 ($0.16–$0.19) / 57,582 |
| `quiz-003` | 57s / $0.24 ($0.20–$0.29) / 59,850 | 48s / $0.29 ($0.25–$0.29) / 69,833 | 45s / $0.23 ($0.21–$0.24) / 60,344 |
| `quiz-004` | 41s / $0.22 ($0.19–$0.23) / 76,127 | 45s / $0.27 ($0.26–$0.28) / 92,747 | 43s / $0.23 ($0.19–$0.23) / 79,560 |
| `quiz-005` | 42s / $0.18 ($0.17–$0.20) / 72,430 | 46s / $0.22 ($0.20–$0.24) / 65,576 | 27s / $0.16 ($0.16–$0.17) / 56,311 |
| `quiz-006` | 59s / $0.23 ($0.22–$0.24) / 75,634 | 43s / $0.27 ($0.26–$0.30) / 68,291 | 46s / $0.24 ($0.22–$0.30) / 77,861 |
| `goal-001` | 853s / $4.82 ($4.28–$6.06) / 4,127,807 | 776s / $4.95 ($4.73–$6.72) / 3,798,002 | 1026s / $4.65 ($4.41–$6.08) / 4,870,051 |
| `goal-002` | 782s / $2.17 ($1.70–$2.34) / 1,685,638 | 1603s / $3.47 ($2.54–$4.04) / 3,583,538 | 1063s / $4.70 ($1.99–$5.16) / 5,250,997 |

Median turns on the goals: goal-001 none 53 · old 50 · new 69; goal-002 none 45 · old 65 · new 79.

- **Quizzes:** the new arm is the cheapest of the three on five of six by cost and on five of six by tokens (roughly 10–15% under old), which is the 4.5 KB prompt against the 13.7 KB one being cached and re-read per turn. Differences are cents.
- **goal-001:** cost ranges overlap across all three arms ($4.28–$6.72) and the medians sit within $0.30 of each other; nothing here separates the arms on dollars. On tokens and turns the new arm is the heaviest (4.87M / 69 turns vs old 3.80M / 50).
- **goal-002:** none is cheap because it builds a small hand-rolled project and fails both lines. Between the skill arms, new has the higher median cost and tokens ($4.70 / 5.25M vs $3.47 / 3.58M) but a wide range ($1.99–$5.16): one new run scaffolded and finished for $1.99, the other two cost more than any old run. The new text's pinned `npx create-eth@2.0.23` is the one instruction that differs on the scaffold step; whether it is the cause is not something three runs can say.

**Duration caveat.** Round 1 of both goals (18:26–20:01) ran while two other #119 rows shared this machine (about fourteen concurrent executors, load average 60–80). goal-001 round-1 durations were 4016s / 3863s / 5700s (none / old / new) against 777–1028s in rounds 2 and 3; goal-002 old run 1 took 3189s against 641–1609s for the other five skill-arm runs. The medians above are round-2/3 values. Arms are interleaved, so within each round all three carried the same load and the arm-to-arm reading holds; the durations are not comparable to the 2026-09-05 report's.

## Blindness

Six skill-arm goal runs were refused by `verify`'s blindness check and graded with `--allow-skill-mention`; every hit is in the evidence, not in anything the executor wrote about the skill:

- goal-002 old 1, 2, 3 and new 1, 3: `output/AGENTS.md:238` (or `output/usdc-tipjar/AGENTS.md:238`) — the line `**Skills** (read .agents/skills/<name>/SKILL.md before implementing)` in the `AGENTS.md` that `create-eth` writes into every scaffold. It is a consequence of passing expect_1: a `no_skill` run that scaffolded with `create-eth` would carry the same file. None did.
- goal-001 new 1: `run.diff:140`, a `DEPLOY.md` sentence pointing the reader at `.agents/skills/ponder` for indexing. `ponder` is one of the eight skills the `se-2-foundry` template ships (`drizzle-neon`, `eip-5792`, `erc-721`, `openzeppelin`, `ponder`, `siwe`, `subgraph`, `x402`) for every variant.

Neither names `frontend-playbook`, the variant, or anything only a `with_skill` workspace holds. The decision and the hits are recorded here; the judge saw the same evidence as for every other run.

## Harness notes

- `quiz-006` old run 2: the first `verify` ended with `judge failed: judge output was not strict JSON`; `verify` was re-run with the same judge flags and graded 3/3. One judge retry, no re-execution.
- Two goal-002 executors left dev servers running (`vite`, `next dev`), so `verify` graded but could not remove the workspace (`ENOTEMPTY`). The orphaned processes were killed after grading and the remnant directories removed by hand; `yarn clean-workspaces` found nothing else.
- Evidence: all 54 quiz `output/answer.md` are force-added; goal-001 evidence is `run.diff` (committed). goal-002's `output/` snapshots — 24–26 files / ~150 KB for the none runs, 124–131 files / 570–610 KB for the skill arms, about 4 MB in all — are left ignored, as the 2026-09-05 pass did for this task. **Those nine grades are regradeable only on the machine that made them.**
- Record keys: the `claude/claude-opus-5` key in this skill's mistake files already holds the 2026-09-05 reading (effort unrecorded), so this benchmark's counts are under `claude/claude-opus-5/medium`, with `none` / `old` / `new` as the sibling rows use.

## Records

- **New:** `frozen-timestamp-not-generalized` — quiz-005 e4, none 3/3 · old 0/3 · new 2/3. The 2026-09-05 report saw this 3/3 unaided but counted it under `frozen-timestamp-wrong-oneoff-fix`; those runs' `result.yaml` show e3 passing and e4 failing, so the older record's Opus 5 entry is corrected to 0/3 there and the e4 reading moved here (both files carry the note).
- **Updated with this stack's reading:** `frozen-timestamp-wrong-oneoff-fix` (1/3 · 0/3 · 0/3), `scaffold-manual-not-create-eth` (3/3 · 0/3 · 0/3), `deploy-no-clean-rebuild-no-cid-proof` (3/3 · 0/3 · 0/3), `og-metadata-not-prod-url` (3/3 · 0/3 · 0/3), `node25-localstorage-fix-wrong-layer` (goal-001 e10 3/3, quiz-004 0/3 · 0/3 · 0/3), `deploy-verify-home-route-only` (0/3 · 0/3 · 0/3).
- `site/derived.json` rebuilt (`yarn build-index`: 72 runs under `major-refine-d9952522`).

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none `22/24 vs 15/24`; old vs none `24/24 vs 15/24`; new vs old `22/24 vs 24/24`. On the goals both skill arms are `6/6` against `0/6` unaided. The whole gap between the arms is quiz-005 e4. |
| Did it reduce time/tokens? | Quizzes: new is cheapest on 5/6 (e.g. quiz-005 `27s / 56k / $0.16` vs old `46s / 66k / $0.22` vs none `42s / 72k / $0.18`). goal-001: new `1026s / 4.87M / $4.65` vs old `776s / 3.80M / $4.95` vs none `853s / 4.13M / $4.82`, ranges overlapping. goal-002: new `1063s / 5.25M / $4.70` vs old `1603s / 3.58M / $3.47` vs none `782s / 1.69M / $2.17` (none fails). No token reduction on the goals from the shorter text. |
| Did it create negative deltas? | new vs old: quiz-005 e4 `1/3` vs `3/3`; goal token medians higher on both goals (4.87M vs 3.80M, 5.25M vs 3.58M) and goal-002 median cost $4.70 vs $3.47 with a $1.99–$5.16 range. new vs none: none on correctness. |
| What mistakes repeated without the skill? | `deploy-no-clean-rebuild-no-cid-proof` 3/3, `og-metadata-not-prod-url` 3/3, `node25-localstorage-fix-wrong-layer` 3/3 (Node-22 pin variant), `scaffold-manual-not-create-eth` 3/3, `frozen-timestamp-not-generalized` 3/3, `frozen-timestamp-wrong-oneoff-fix` 1/3. `deploy-verify-home-route-only` 0/3. |
| What mistakes remained with the skill? | `frozen-timestamp-not-generalized`: new 2/3, old 0/3. Every other record 0/3 on both arms. |
| What should change in the skill? | One candidate edit, on weak evidence: in "Choose the local chain deliberately", state the freeze as a rule about logic rather than a list of displays — "any `block.timestamp`-dependent logic (deadlines, expiry, vesting, auctions) stays frozen between transactions" — which is the sentence the two failing answers lacked. Re-read after the GPT/Kimi/GLM rows before editing; at n=3 this is one line moving on two runs. Nothing else in the data asks for a change. |
| What should change in the eval? | (1) goal-001 expect_10 still does not say whether pinning Node below 25 counts as handling the crash; all three unaided runs did exactly that and the judge failed them — if that is the intent, write it into the line so the grade stops depending on the judge's reading. (2) goal-002 expect_1's pass condition puts SE-2's own `AGENTS.md` into every passing run's evidence, so the blindness check refuses every skill-arm pass; the harness should treat scaffold-bundled `.agents/skills/` paths as non-leaks, or the report will carry this override on every stack. (3) Five of six quizzes and goal-001 e1–e5/e8 saturate on this stack. (4) goal-002 evidence is uncommitted, so its grades cannot be revisited from a clone. |
