# major-refine: `tools` on Opus 5 medium

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `claude` · `claude-opus-5` · effort `medium` |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | **true** on all 36 runs — judge and executor are the same agent |
| Runs | 3 per arm per task, 4 tasks × 3 arms = **36 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 `retracted` |
| Trigger | not forced — these are content-only numbers, no `Use the tools skill` line prepended |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `tools` skill, 172 lines |
| new | `with_skill` | `d9952522` | refined minimal skill, 44 lines |

Both `skill_version` commits are ancestors of HEAD, so every run can still say what text it was given.

**Tasks** — all four live tasks whose `skill:` is `skills/tools`; all bare workspaces, no template, so no template install pins apply.

| Task | `expect_sha` |
| --- | --- |
| `tools-quiz-001` | `462bfede58a8` |
| `tools-quiz-003` | `8ddb571522d8` |
| `tools-quiz-004` | `4fa1227c6888` |
| `tools-goal-001` | `7e950ccb2908` |

One `expect_sha` per task across all nine of its runs, so the three arms are graded against one rubric.

## Headline — pass counts, new · old · none

| Task | new · old · none | new | old | none | What separates the arms |
| --- | --- | --- | --- | --- | --- |
| `tools-quiz-001` | `3/3 · 3/3 · 3/3` | 3/3 | 3/3 | 3/3 | saturated — x402 is known when asked |
| `tools-quiz-003` | `3/3 · 3/3 · 0/3` | 3/3 | 3/3 | **0/3** | Blockscout MCP; `none` fails `expect_1` 3/3 |
| `tools-quiz-004` | `3/3 · 3/3 · 3/3` | 3/3 | 3/3 | 3/3 | saturated — SE-2 / `create-eth` is known |
| `tools-goal-001` | `3/3 · 3/3 · 0/3` | 3/3 | 3/3 | **0/3** | x402 package family; `none` fails `expect_3` 3/3 |
| **total** | `12/12 · 12/12 · 6/12` | **12/12** | **12/12** | **6/12** | |

**The skill is worth 2 of 4 tasks, and the refine is worth none of them on the graded surface.** New and old are identical, 12/12 each; none is 6/12. Every point of uplift comes from having *a* tools skill, not from refining it. The refine's value shows up only in cost and in ungraded answer content, both below.

### Where `none` fails

Both failures reproduce documented mistakes, and both are now caught by a graded check rather than only by a transcript reading.

- **`tools-quiz-003` `expect_1`, 3/3** — every `none` run recommends the Etherscan API (with Alchemy, Covalent and Dune alongside) and none names an MCP endpoint. `tools-etherscan-instead-of-blockscout-mcp`.
- **`tools-goal-001` `expect_3`, 3/3** — every `none` run ships the frozen unscoped x402 v1 line in `package.json`: `x402-fetch@^1.2.0`, `x402-express@^1.2.0`, `@coinbase/x402@^1.0.1`. `tools-x402-v1-line-under-build-pressure`. This is the first benchmark where this failure is *graded* in all three `none` runs rather than recovered mid-run; the rewritten `expect_3` is what makes it visible.

`expect_1`, `expect_2` and `expect_4` pass in all three `none` goal runs — the builds are real and internally consistent, they just stand on the dead package line.

## Cost

All figures from `yarn run-stats --tasks … --benchmark major-refine-d9952522`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. Medians with ranges; `cost_source: executor` throughout (claude's own reported price, not list price).

| Task | Arm | n | turns | duration | cost | cost range | tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tools-quiz-001` | new | 3 | 28 | 238s | $1.07 | $0.76–$1.72 | 812386 |
| | old | 3 | 33 | 223s | $1.22 | $0.75–$1.28 | 1047639 |
| | none | 3 | 29 | 279s | $1.24 | $1.07–$2.33 | 973322 |
| `tools-quiz-003` | new | 3 | 6 | 42s | $0.24 | $0.19–$0.25 | 99579 |
| | old | 3 | 4 | 27s | $0.18 | $0.18–$0.18 | 59870 |
| | none | 3 | 2 | 44s | $0.19 | $0.19–$0.21 | 39587 |
| `tools-quiz-004` | new | 3 | 12 | 88s | $0.46 | $0.31–$0.52 | 265853 |
| | old | 3 | 23 | 196s | $0.72 | $0.52–$0.77 | 472112 |
| | none | 3 | 22 | 166s | $0.84 | $0.61–$1.39 | 467221 |
| `tools-goal-001` | new | 3 | 50 | 429s | $2.48 | $2.08–$2.59 | 2331623 |
| | old | 3 | 60 | 405s | $2.82 | $2.55–$3.60 | 2840931 |
| | none | 3 | 45 | 563s | $2.09 | $1.72–$3.26 | 1687742 |

**This is where the refine pays.** New beats old on 3 of 4 tasks in both dollars and tokens:

- `tools-quiz-004` is the clearest: **$0.46 / 266k / 12 turns** vs old's **$0.72 / 472k / 23 turns** — 36% cheaper, 44% fewer tokens, roughly half the turns and half the wall clock, for the same 3/3. Cutting 128 lines of stack tables, cast recipes, RPC lists and faucet tables removed work the task never needed.
- `tools-goal-001`: **$2.48 / 2.33M** vs old's **$2.82 / 2.84M**, and the new arm's range is tighter ($2.08–$2.59 vs $2.55–$3.60).
- `tools-quiz-001`: **$1.07 / 812k** vs old's **$1.22 / 1.05M**.
- `tools-quiz-003` is the one inversion: new costs **$0.24 / 100k** against old's **$0.18 / 60k**. The new arm spends 6 turns to old's 4. Small absolute numbers, and the extra spend buys the cleaner answer described below, but it is a real negative delta and is listed as one.

Against `none`, the skill arms are *more* expensive on `tools-goal-001` ($2.48 new vs $2.09 none) — the `none` runs are cheaper because they build on the wrong packages and stop, rather than reading installed types. A cheaper failing run is not a saving.

Compare tokens within a stack only; this report is a single stack, so no cross-stack token comparison arises.

## Ungraded findings — where new and old actually differ

The graded surface says new = old. The answer content does not. Three ungraded differences, all favouring the refine, mined from `output/` and `transcript.md`.

### 1. The old skill propagates a stale Go module path into answers

The old skill ships `go get github.com/coinbase/x402/go`. That path does not error — it silently resolves to a stale pre-Foundation commit.

| Arm | Runs recommending `coinbase/x402/go` |
| --- | --- |
| old | **2/3** (`…2f0adb01-1` line 192, `…2f0adb01-2` line 54) |
| new | 0/3 — the one run that mentions Go gives `github.com/x402-foundation/x402/go/v2` and warns the old path resolves stale |
| none | 0/3 — no `none` run mentions Go at all |

This is new evidence. `tools-skill-x402-example-api-nonexistent` records "never reproduced by an executor — all 6 with_skill runs caught it", which was true of the *API symbols* and is confirmed again here: every mention of `x402Fetch` / `createWallet` in both skill arms is a warning that they do not exist, never an endorsement. The Go path behaves differently — it is prose, not a code sample, so nothing prompts the executor to check it, and it travels straight through into the answer. Filed as `tools-stale-go-module-path-propagated`.

### 2. The old skill hedges its own Blockscout claim; the new one does not

Both arms pass `tools-quiz-003` `expect_1` 3/3, so the graded surface is blind to this.

| Arm | `mcp.blockscout.com/mcp` | Etherscan also offered |
| --- | --- | --- |
| new | 3/3 | **0/3** |
| old | 3/3 | **3/3** |
| none | 0/3 | 3/3 |

The old skill's "Tool Discovery Pattern" lists read ops as "Blockscout MCP or Etherscan API" — co-equal, no stated preference — and all three old-arm answers carry Etherscan alongside the MCP endpoint. The new skill states the preference outright and splits agent-facing MCP from server-side REST; all three new-arm answers name only Blockscout MCP. `tasks/tools-quiz-003.yaml` notes predicted exactly this tension and asked for it to be reported rather than hidden: the refine resolved it. Filed as `tools-skill-blockscout-claim-hedged-by-etherscan`.

### 3. `tools-goal-001` data path (the observation the task spec requires)

Recorded, deliberately not graded — grading it would stop the task's headline meaning x402.

| Arm | Wallet-activity data path |
| --- | --- |
| new | 3/3 Blockscout REST; **2/3 also wire `mcp.blockscout.com/mcp`** for the agent path |
| old | 3/3 Blockscout REST; 0/3 wire the MCP endpoint |
| none | 1/3 Blockscout REST, 2/3 Etherscan (one with Alchemy) |

Read together with `tools-quiz-003`: knows-when-asked and applies-unprompted both hold for the skill arms, and the new arm reaches the MCP endpoint unprompted where the old one does not.

### 4. Verification behaviour

`tools-quiz-001` asks the executor to confirm what it installs resolves. Every run in every arm hit the npm registry at least once, so no pass in this report rests on parametric memory alone. The arms differ in *how*: the new arm runs fewer registry metadata queries (1–2 vs 4–6) and more installs (4–15), i.e. it reads the installed types — which is what the new skill instructs ("Inspect the installed exports before writing the integration", "Read the installed types instead of a remembered snippet"). The old arm queries metadata more and installs less.

On `tools-quiz-004`, all three new-arm answers name `create-eth-app` and `create-scaffold-eth` **as dead packages with live-checked last-publish dates** (2024-01-10 and 2023-01-16) — warnings, not recommendations, and more verification than the check requires. `expect_2` passes 3/3 in every arm.

## Task health

`tools-quiz-001` and `tools-quiz-004` are saturated at `3/3 · 3/3 · 3/3` and measure the executor model, not this skill. This confirms on a third stack what `tasks/tools-quiz-004.yaml` notes already record (3/3 vs 3/3 on both earlier stacks, which is why the SE-2 material was cut from the skill). Neither task is broken — both grade real artifact facts — but neither can separate any pair of arms on Opus 5 medium, and two of `tools-quiz-004`'s three expect lines grade claims the minimal skill no longer makes.

No task looked broken in a way that needs raising on #119.

## Skill questions

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **new vs none: `12/12` vs `6/12`.** Per task `3/3 vs 0/3` on `tools-quiz-003` and `tools-goal-001`; `3/3 vs 3/3` on `tools-quiz-001` and `tools-quiz-004`. **new vs old: `12/12` vs `12/12` — no graded change.** |
| Did it reduce time/tokens? | **new vs old: yes on 3 of 4.** `tools-quiz-004` $0.46 / 266k / 88s vs $0.72 / 472k / 196s; `tools-goal-001` $2.48 / 2.33M vs $2.82 / 2.84M; `tools-quiz-001` $1.07 / 812k vs $1.22 / 1.05M. `tools-quiz-003` inverts: $0.24 / 100k vs $0.18 / 60k. **new vs none: mixed** — cheaper on `tools-quiz-001` and `tools-quiz-004`, dearer on `tools-goal-001` ($2.48 / 2.33M vs $2.09 / 1.69M) where the `none` runs are cheap because they build on dead packages. |
| Did it create negative deltas? | One: `tools-quiz-003` new costs more than old ($0.24 / 100k / 6 turns vs $0.18 / 60k / 4 turns) — the new arm does more work to reach a cleaner, un-hedged answer. No pass-rate regression anywhere; no arm lost a check the other passed. |
| What mistakes repeated without the skill? | `tools-etherscan-instead-of-blockscout-mcp` (3/3 quiz-003 graded, 2/3 goal-001 observed), `tools-x402-v1-line-under-build-pressure` (3/3 goal-001, graded by `expect_3` this time) |
| What mistakes remained with the skill? | None on the graded surface — both skill arms are 12/12. Ungraded, the **old** arm carries `tools-stale-go-module-path-propagated` (2/3) and `tools-skill-blockscout-claim-hedged-by-etherscan` (3/3); the **new** arm carries neither. |
| What should change in the skill? | Nothing this benchmark can justify changing. The refine is already the better text: same pass rate, cheaper on 3 of 4 tasks, and it fixes two stale/hedged claims that measurably reached the old arm's answers. Keep `d9952522` as shipped. |
| What should change in the eval? | `tools-quiz-001` and `tools-quiz-004` are saturated `3/3` across all three arms on this stack and should be retired or re-pitched — `tools-quiz-004` especially, where `expect_1` and `expect_3` grade claims the minimal skill no longer makes. The two differences that actually separate new from old — the stale Go module path and the Etherscan hedge — are both invisible to every current expect line; if the Go path is worth defending, `tools-quiz-001` needs an expect for it. `tools-goal-001`'s rewritten `expect_3` is doing its job: it converted a transcript-only observation into a 3/3 graded failure. |

## Caveats

- **`self_judged: true` on all 36 runs.** Judge and executor are both `claude` / `claude-opus-5`; the judge ran at effort `high`, the executor at `medium`. Expected on a single-stack benchmark, and a caveat on these numbers rather than a defect in them.
- **n=3 per arm.** Read the direction, not the rate. Cost ranges are printed beside every median for this reason — on `tools-quiz-001` the `none` range ($1.07–$2.33) is wider than the new-vs-old median gap.
- **Workspaces were not swept.** A second operator was running the `codex` / GPT 5.5 high column for the same tasks from a different checkout (`/ssd/workspace/buidlguidl/ethskills-evals`) against the same default workspace root during this benchmark, so `yarn clean-workspaces --delete` was not run — from this checkout their live runs look like orphans. Sweep once both columns are finished.
