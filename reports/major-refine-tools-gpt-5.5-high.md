# major-refine: `tools` on GPT 5.5 high

| | |
| --- | --- |
| Benchmark | `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)) |
| Benchmark commit | `d99525222883df0b32decbfb81e1a13f9c27cfed` |
| Executor | `codex`, model `gpt-5.5`, reasoning effort `high` |
| Judge | `claude`, model `claude-opus-5`, reasoning effort `high` — the same judge for all 36 grades |
| `self_judged` | `false` on all 36 runs (executor codex, judge claude) |
| Arms | none (`no_skill`) · old (`--skill-ref 2f0adb01`) · new (`--skill-ref d9952522`) |
| Runs | 3 per arm per task, 9 per task, 36 in all |
| Tasks | `tools-quiz-001`, `tools-quiz-003`, `tools-quiz-004`, `tools-goal-001` |
| Dates | 2026-09-20 / 2026-09-21 |

Every run carries `expect_sha` and every task's nine runs share one value, so all
counts below are first-reading grades against one rubric. No regrades, no retractions.

## Pass counts — new · old · none

| Task | new (`d9952522`) | old (`2f0adb01`) | none |
| --- | --- | --- | --- |
| `tools-quiz-001` (x402 packages, asked) | 3/3 | 3/3 | 3/3 |
| `tools-quiz-003` (agent on-chain data) | 3/3 | 3/3 | **2/3** |
| `tools-quiz-004` (Scaffold-ETH 2 setup) | 3/3 | 3/3 | 3/3 |
| `tools-goal-001` (build the paid API) | 3/3 | 3/3 | 3/3 |
| **Total** | **12/12** | **12/12** | **11/12** |

One graded failure in the whole benchmark: `2026-09-21T023352Z-codex-no-skill-3`
on quiz-003, expect_1.

**The graded surface is saturated on this stack, and the one delta it shows is
smaller than it looks.** The paragraphs below are the part of the result that the
table cannot carry; they come from the committed transcripts and `output/`
snapshots, not from the judge.

## quiz-003: 2/3 overstates the unaided model by two runs

No `no_skill` run named Blockscout MCP. What they named:

| Run | Answer | Graded |
| --- | --- | --- |
| `…132327Z-codex-no-skill-1` | GoldRush by Covalent, via the GoldRush MCP server | pass |
| `…153946Z-codex-no-skill-2` | GoldRush by Covalent, `@covalenthq/goldrush-mcp-server` | pass |
| `…023352Z-codex-no-skill-3` | Zerion Wallet REST API | fail |

expect_1 accepts "Blockscout MCP at mcp.blockscout.com/mcp (**or a clearly-equivalent
MCP endpoint**)", and a Covalent MCP server serving the same wallet data is a fair
reading of that clause. So the judge was right and the line is wrong: the rate at
which unaided runs reached the skill's actual claim is **0/3**, not 2/3. Both skill
arms named `mcp.blockscout.com/mcp` explicitly, 3/3 each.

The shape of the miss has also moved since the 2026-08 claude measurement, where
`no_skill` reached for the Etherscan REST API 3/3. This model knows that agent-native
MCP for on-chain data exists as a category — it reaches for a rival MCP server, not
for REST. What it does not know is this endpoint. Filed as
`tools-quiz-003-equivalent-mcp-escape-hatch`.

## goal-001 no longer separates the arms on the data path

The task notes ask for the wallet-data path to be recorded as an observation:

| Arm | Data path in the shipped artifact |
| --- | --- |
| none | 1/3 hand-decoded (viem `parseAbiItem` + `getLogs` over `Transfer`), 2/3 `base.blockscout.com/api/v2` |
| old | 3/3 `base.blockscout.com/api/v2` |
| new | 3/3 `base.blockscout.com/api/v2` |

Two of three unaided runs reach Blockscout by themselves under build pressure. The
2026-08 claude benchmark had `no_skill` on Etherscan/Alchemy 3/3 here, so this is a
real weakening of the claim's uplift on this stack, not a rubric artifact. No run in
any arm wired the MCP endpoint for the server path — correct, since the server is not
itself the agent, and consistent with what the refined skill actually says.

## The one place the two skill texts measurably differ

All 3/3 `new` runs of quiz-001 write an explicit warning into `answer.md`:

> Avoid the old unscoped packages (`x402`, `x402-fetch`, `x402-express`) for new work;
> they are the frozen v1 line.

No `old` run and no `no_skill` run does — the string `x402-fetch` or `x402-express`
appears in the `new` arm's answers 3/3 and nowhere else. The refined text names the
frozen line and says "whatever a version range resolves them to"; the old text names
`@x402/fetch` as a production SDK and never names the frozen line at all. Both arms
ship the correct scoped packages, so no expect line can see the difference.

Related, and the reason this matters more than a stylistic note: one `no_skill` goal
run (`…080429Z-codex-no-skill-3`) ran `npm install express x402-express x402-fetch …`
as its first install, read the installed types, and migrated to `@x402/*` before
writing the integration. The frozen line is still what this model reaches for when it
has to build — 1/3 unaided, 0/6 with either skill text. It never reached the artifact,
so expect_3 and expect_4 are 9/9. See `tools-x402-v1-line-under-build-pressure`.

## What the old skill's stale material did not do

The old text ships `x402Fetch` / `createWallet` as a working code example and the Go
path `github.com/coinbase/x402/go`; neither exists. **No run in any arm reproduced
either** — 0/12 on the `old` arm across quiz-001 and goal-001. This model reads the
installed types instead of the handed snippet, so the known-stale material in
`2f0adb01` cost nothing measurable here. That is a fact about gpt-5.5 at high effort,
not an argument that the material was harmless.

## quiz-001 and quiz-004 are saturated

- quiz-001: 9/9. Every run in every arm named the scoped `@x402/*` family, and every
  run checked npm (3–9 registry calls each).
- quiz-004: 9/9. Every run gave `npx create-eth@latest` or a live-verified pin
  (`create-eth@2.0.23`), and checked it resolved (3–18 registry calls each). No run
  reached for the dead `create-eth-app`.

Both measure claims this model already holds. quiz-004's own notes already record it
as partly orphaned by the minimal-skill rewrite: expect_1 and expect_3 grade material
the refined skill no longer contains.

## Cost

All figures from `yarn run-stats --tasks … --benchmark major-refine-d9952522`, split
per arm. Codex dollars are `cost_source: list_price` — the run's token split priced at
OpenAI's standard-tier list price in `lib/prices.ts`, not what was billed, and the
>272K long-context surcharge is not included. Medians with ranges, `n=3`.

| Task | Arm | Duration | Cost (list price) | Range | Tokens |
| --- | --- | --- | --- | --- | --- |
| quiz-001 | new | 256s | $1.27 | $1.09–$1.44 | 1,056,326 |
| quiz-001 | old | 255s | $1.08 | $1.06–$1.37 | 916,967 |
| quiz-001 | none | 249s | $1.53 | $1.38–$2.23 | 1,432,348 |
| quiz-003 | new | 38s | $0.19 | $0.17–$0.23 | 88,405 |
| quiz-003 | old | 28s | $0.10 | $0.09–$0.17 | 74,229 |
| quiz-003 | none | 72s | $0.34 | $0.31–$0.58 | 144,041 |
| quiz-004 | new | 167s | $0.58 | $0.51–$0.61 | 380,535 |
| quiz-004 | old | 194s | $0.86 | $0.73–$0.88 | 618,567 |
| quiz-004 | none | 177s | $0.78 | $0.61–$0.91 | 575,471 |
| goal-001 | new | 497s | $2.44 | $2.09–$2.86 | 2,825,684 |
| goal-001 | old | 457s | $2.64 | $2.42–$3.39 | 3,009,030 |
| goal-001 | none | 502s | $2.67 | $1.23–$3.23 | 2,885,241 |

Both skill arms are cheaper than `none` on three of four tasks, by 17–47% of tokens on
the quizzes. The mechanism is visible in the transcripts: an unaided run spends turns
searching for and verifying what the skill states, and quiz-003 is the extreme — 144k
tokens unaided against 74–88k with either skill, because the unaided runs go looking
for a provider. Read the ranges, not just the medians: goal-001 `none` spans
$1.23–$3.23, wider than any gap between the arms.

## Harness notes

Three things happened that are not results, recorded so the runs above can be read
honestly. None of them produced a grade.

1. **Disk full.** The machine's root filesystem reached 291M free during the first
   goal-001 batch (a second benchmark column was running on the same machine). Three
   executors spent turns trying to clear `/tmp`. Two recovered and produced clean
   deliverables; the third is (2) below.
2. **`npm_config_cache` in the workspace makes a run ungradeable.** Twice on
   goal-001's `new` arm, the executor re-pointed npm's cache to `$PWD/.npm-cache`.
   `.npm-cache` is not in `GENERATED_DIRS`, so `verify` snapshotted it into `output/`
   — 600 files and 20M against the 8–10 files a clean run leaves — and the judge died
   with `spawnSync env EPIPE` on a prompt that size. Both runs had exit 0 and complete
   deliverables; neither could be graded, and re-running `verify` cannot help. Both
   were deleted with their workspaces and set up again under new run ids, per
   AGENTS.md. Filed as `tools-goal-npm-cache-breaks-judge`. The second occurrence had
   11G free, so low disk makes it likelier but is not the cause.
3. **Codex usage limit, twice.** 13 runs died mid-execution with
   `You've hit your usage limit`. All 13 run dirs and workspaces were deleted and the
   runs set up again after the reset; `--grade-failed-run` was never used and no grade
   was written over a refusal. Every one of the 36 records below carries
   `executor_exit: 0`.

One more exposure, seen but not acted on: in the ungradeable run's transcript,
`require('@x402/evm')` inside the workspace resolved through this repo's
`/ssd/workspace/buidlguidl/ethskills-evals/.pnp.cjs` and threw "The locator that owns
… can't be found inside the dependency tree". This repo's yarn PnP reaches the
executor's shell. It did not affect any graded run — every graded goal run's
deliverable installed and imported normally — but it will bite any goal task that runs
installed code, and it belongs in the isolation list in AGENTS.md alongside the
`bash -lc` exposure.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **new vs none: 12/12 vs 11/12.** One graded delta, on quiz-003. Read against the skill's actual claim rather than expect_1's equivalence clause it is 3/3 vs 0/3 on that task, and 12/12 vs 9/12 overall. **new vs old: 12/12 vs 12/12** — no graded difference between the two skill texts. |
| Did it reduce time/tokens? | Yes, on three of four tasks. quiz-003 new 38s / 88k vs none 72s / 144k; quiz-004 new 167s / 381k vs none 177s / 575k; quiz-001 new 256s / 1.06M vs none 249s / 1.43M; goal-001 new 497s / 2.83M vs none 502s / 2.89M. new vs old is within noise everywhere except quiz-004 (381k vs 619k). |
| Did it create negative deltas? | None graded. The only cost regression is quiz-003, where both skill arms are cheaper than none but new (38s / 88k / $0.19) is dearer than old (28s / 74k / $0.10) — the refined text says more about when MCP applies. |
| What mistakes repeated without the skill? | `tools-etherscan-instead-of-blockscout-mcp` (3/3 on quiz-003, 1/3 on goal-001, and shifted from Etherscan to rival MCP servers); `tools-x402-v1-line-under-build-pressure` (1/3 on goal-001, first-reach only, migrated before shipping). |
| What mistakes remained with the skill? | None, in either arm. 0/12 on every mistake tracked for this skill, including the old arm reproducing none of its own stale `x402Fetch` / `createWallet` / `coinbase/x402/go` material. |
| What should change in the skill? | Nothing this benchmark can justify on this stack — the two texts are 12/12 against 12/12. The one measured behavioural gain from the refinement is the explicit frozen-line warning (3/3 new, 0/6 elsewhere), which argues for keeping that sentence, not for adding anything. The Blockscout MCP claim is the only one still earning its place here, and on this model it is closer to a wiki fact than a behaviour change: 0/3 unaided runs name the endpoint when asked, but 2/3 already pick Blockscout unprompted when building. |
| What should change in the eval? | Three things, and they matter more than the skill edits. **(a)** quiz-003 expect_1's "or a clearly-equivalent MCP endpoint" clause lets a GoldRush answer pass and hides the real 0/3 — reword it and regrade all nine runs (`tools-quiz-003-equivalent-mcp-escape-hatch`). **(b)** quiz-001 and quiz-004 are 9/9 and measure this model, not this skill; at median they account for ~$18 of the ~$43 this benchmark cost and separate nothing. **(c)** goal-001's graded surface is saturated (9/9 on all four expects) while the transcripts still separate the arms on first-reach and data path — the same pattern earlier reports flagged, now true of every check on the task. |

## Runs

All 36 run directories are under `artifacts/tools-{quiz-001,quiz-003,quiz-004,goal-001}/`,
dated `2026-09-20T13…` through `2026-09-21T08…`, each with `result.yaml`,
`executor.yaml`, `transcript.md`, `baseline.sha` and a committed `output/`.
