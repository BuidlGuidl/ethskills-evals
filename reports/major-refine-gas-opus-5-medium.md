# gas — major-refine, Opus 5 medium

Benchmark id: `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)).
Benchmark commit `d9952522`.

| | |
| --- | --- |
| Executor | claude, `claude-opus-5`, effort `medium` |
| Judge | claude, `claude-opus-5`, effort `high` |
| Runs | 3 per arm per task, 27 graded runs |
| Arms | none (`no_skill`) · old (`with_skill`, skill_version `2f0adb01`) · new (`with_skill`, skill_version `d9952522`) |
| `self_judged` | **true** on every run. Judge and executor are both claude (the pinned judge for every stack), so this column is self-judged. The judge is blind to arm, skill and transcript, but it is the same model grading its own output. |

Tasks: `gas-goal-002`, `gas-quiz-001`, `gas-quiz-003` (every live task whose `skill:` is `skills/gas`).
No trigger was forced. The skill triggered unprompted (a `Skill {"skill":"gas"}` call) in all 18
with_skill runs, so these are trigger-inclusive numbers that, in practice, equal content-only ones.

## Headline — pass counts, new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| gas-quiz-001 | **3/3** | **3/3** | **0/3** |
| gas-quiz-003 | 3/3 | 3/3 | 1/3 |
| gas-goal-002 | 3/3 | 3/3 | 3/3 |
| **all** | **9/9** | **9/9** | **4/9** |

The skill separates from no skill on the two chain-choice quizzes, where every control that
failed priced mainnet off a remembered gas price. The two skill texts cannot be told apart on pass
rate: both are 9/9. The goal task saturates on this stack. Every control measured Base
live without being told to, so gas-goal-002 does not discriminate here.

### Per check

| Task | run | arm | expects | pass |
| --- | --- | --- | --- | --- |
| gas-quiz-001 | 100050Z-1 | none | ✔ ✘ ✘ | fail |
| gas-quiz-001 | 101018Z-2 | none | ✔ ✘ ✘ | fail |
| gas-quiz-001 | 101453Z-3 | none | ✔ ✘ ✘ | fail |
| gas-quiz-003 | 102338Z-1 | none | ✔ ✔ ✔ ✘ | fail |
| gas-quiz-003 | 104204Z-3 | none | ✔ ✔ ✔ ✘ | fail |

Every other run passed every line. `expect_sha` is uniform across the nine runs of each task
(`2b2d28e70076` quiz-001, `f0aa1420274c` quiz-003, `98d1a0c467f1` goal-002), as is `input_sha`
(`53990a85a9f4`, `b2ae7cad35fb`, `98f2b05df610`), so each task's three arms were graded against
one rubric on one prompt. No expect line was touched, and no run was regraded.

**gas-quiz-001, none 0/3: no lookup at all.** All three controls went from `TASK.md` to
`answer.md` in four turns without a single network call. They priced mainnet at 10–40 gwei with
ETH at $2,500–$4,000, against a live ~0.3 gwei and ~$2,730. That gives $6.90–$69 per job
(`100050Z-1`), $6.25–$80 (`101018Z-2`) and $12.96–$43.20 (`101453Z-3`). Two of the three then ruled
mainnet out outright ("Do not deploy this on Ethereum L1"). The third kept it as "the fallback if
you are low-volume" but still quoted dollars. All three recommended Base, and all three failed expect_2
(mainnet quoted at dollars / disqualified) and expect_3 (no live gas or ETH price). This is
[`gas-invented-gas-price`](../mistakes/gas/gas-invented-gas-price.yaml) feeding
[`gas-mainnet-disqualified-on-cost`](../mistakes/gas/gas-mainnet-disqualified-on-cost.yaml), in the
original shape: no reading taken. (The Kimi K3 controls, by contrast, took one and then discarded it.)

All six with_skill runs, on either text, read mainnet off an RPC (0.29–0.37 gwei) and a live ETH
price. Five of them recommended mainnet. New-arm `101923Z-3` recommended Base on non-cost grounds
("not for the reason you probably expect") with mainnet priced in cents, and passed.

**gas-quiz-003, none 1/3.** `102338Z-1` and `104204Z-3` both picked an L2 from the traffic profile
(expect_3 passes) but compared it with mainnet priced at an assumed 5 gwei with ETH at $3,000/$4,000,
which gives $0.50–$3.00 per post. That fails expect_4 only. `104204Z-3` also made 10-gwei blob data about 80% of its
Base per-post cost, which is the pre-Dencun split
([`gas-stale-l2-blob-share`](../mistakes/gas/gas-stale-l2-blob-share.yaml)). No expect line on quiz-003
charges it. The one control that passed, `103125Z-2`, queried four RPCs and l2fees.info before writing.

**gas-goal-002, 3/3 on every arm.** Every run read Base live, put spend at about $30–33/day
(~$11–12k/year), and gave the L1 data share as 1.0–1.5%. The controls gave ~1%, ~1.1% and ~1.1%.
No run ranked calldata compression or L1 data first. The top lever was batching in five runs
(all three controls, new-1, new-3) and an EIP-1559 fee/tip audit in four (old-1, old-2, old-3,
new-2). Several
runs spelled out the proportionality point: at ~$33/day, dropping L1 data entirely saves ~$120/year.

## Cost — medians per arm, with ranges

From `yarn run-stats --tasks gas-quiz-001,gas-quiz-003,gas-goal-002 --benchmark major-refine-d9952522`,
split by `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`.
`cost_source: executor` throughout (claude's reported price).

| Task | arm | turns | duration | cost | cost range | total tokens |
| --- | --- | --- | --- | --- | --- | --- |
| gas-quiz-001 | none | 4 | 99s | $0.35 | $0.34–$0.37 | 86,578 |
| gas-quiz-001 | old | 7 | 93s | $0.38 | $0.35–$0.39 | 130,856 |
| gas-quiz-001 | new | 17 | 137s | $0.64 | $0.51–$0.84 | 314,849 |
| gas-quiz-003 | none | 4 | 94s | $0.35 | $0.31–$1.22 | 82,532 |
| gas-quiz-003 | old | 9 | 146s | $0.48 | $0.47–$0.49 | 200,581 |
| gas-quiz-003 | new | 14 | 101s | $0.52 | $0.36–$0.70 | 282,792 |
| gas-goal-002 | none | 112 | 1798s | $10.11 | $5.75–$16.24 | 11,533,477 |
| gas-goal-002 | old | 53 | 1184s | $4.37 | $2.83–$4.76 | 3,438,736 |
| gas-goal-002 | new | 59 | 865s | $4.05 | $2.20–$4.81 | 3,458,948 |

**Goal task:** here the skill is cheaper, and not by a little. The control arm's median is $10.11 and
11.5M tokens against ~$4 and ~3.4M on either text, and the ranges do not overlap: the dearest skill
run ($4.81) costs less than the cheapest control ($5.75). The controls reached the same answer by
building more. `115327Z-none-2` made 174 tool calls, 31 of them RPC probes and 48 build/test
invocations, and shipped an `analysis/` model, a `bench/` harness and a relayer; the skill arms
went to the fee formula and measured the few things it names. With n=3 and one wide control run
($16.24), treat the size of the gap as indicative. Its direction holds on every pair.

**Quizzes:** the skill costs more, because it makes the run measure. The no-skill quiz runs are
cheap because they answered from memory in four turns and were wrong. The new text is the dearest
arm on quiz-001 (median 315k tokens / $0.64 against 131k / $0.38 for old). Its runs cross-checked
several RPCs and read Chainlink `latestRoundData`, and two of them (`100537Z-1`, `101923Z-3`) built
and gas-reported an escrow contract in Foundry before answering. Cents either way.

## Observations the task notes ask for

**gas-quiz-001 pointer triage** (from the `Bash`/`WebFetch` lines of each `transcript.md`):

| pointer | old `2f0adb01` | new `d9952522` |
| --- | --- | --- |
| `cast base-fee` / `cast gas-price` on mainnet | 3/3 used | 3/3 used (`gas-price`, 1/3 also `base-fee`) |
| `eth.llamarpc.com` (old text only) | 3/3 called, **3/3 failed** (HTTP 525 or a Cloudflare challenge page), a wasted turn each | n/a |
| `ethereum-rpc.publicnode.com` + named fallbacks (new text) | 3/3 found publicnode anyway, not named | 3/3 used; 2/3 cross-checked drpc/flashbots |
| Chainlink ETH/USD feed | 2/3 | 2/3 (as a cross-check) |
| CoinGecko (old) / Coinbase spot (new) | 2/3 CoinGecko | 3/3 Coinbase |
| Base `l1Fee` / GasPriceOracle for the L2 comparison | 0/3 | 2/3 |
| "under 1 gwei" framing (old) | used as a pointer, never quoted in place of a reading | n/a |

No pointer did harm. The dead llamarpc URL is the one that cost something: 6 of 9 old-arm runs,
every quiz run, called it first and got HTTP 525 or a Cloudflare challenge page. All six recovered on publicnode, drpc, ankr or
cloudflare-eth. That reconfirms
[`gas-dead-llamarpc-endpoint`](../mistakes/gas/gas-dead-llamarpc-endpoint.yaml) on the old text. The
record stays `fixed`, and no new-arm run hit a dead endpoint.

**Feedback calls.** Both texts end with "send a one-line note via feedback/SKILL.md". On this stack
three new-arm runs WebFetched `ethskills.com/feedback/SKILL.md` (`113236Z` goal-1, `135442Z` goal-3,
`103951Z` quiz-003-2). All three stopped at the page's "draft and request approval" step and asked in
their final message rather than posting. No run on this stack sent a note (the Kimi K3 row reports 8 sent).

## Run incidents

**No run was discarded, retracted, regraded or graded over a refusal.** All 27 executors exited 0.
`--grade-failed-run` was never used, and no `harness_failure` is recorded.

Two orchestration stops, neither of which changed any record:

1. The driver loop treated `yarn verify`'s exit 2 ("graded, failing") as an error and stopped after
   grading gas-quiz-001 none run 1 at 10:03Z. That grade was complete and was kept.
2. The restarted loop's skip-if-graded check matched a `…-claude-no-skill-2` run dir from the
   2026-07-24 gas set and skipped gas-quiz-001 none run 2. The loop was stopped while old run 2's
   executor ran on, detached. That run was graded by hand with the same `verify` command once
   `executor.yaml` said it finished, and a loop that checks `benchmark: major-refine-d9952522` took over.
   Net effect: in round 2 of gas-quiz-001, the none arm ran after the old arm rather than before it.
   Every other round ran none → old → new, back to back.

**Harness observation, isolation.** Claude executors inherit the orchestrator's yarn PnP loader in
`NODE_OPTIONS`, because `run-executor` is launched through `yarn`. New-arm gas-goal-002 `113236Z-1` tripped
over it running `npx vitest`, then ran `find / -maxdepth 6 -name ".pnp.cjs"`, which listed
this worktree and the four sibling eval checkouts (`/home/shiv/ethskills-evals`,
`/home/shiv/evals-run/gas-*`). It read nothing from them: it cleared `NODE_OPTIONS` and carried on.
But this is the "found on purpose" path AGENTS.md leaves open, reached here by accident through an
env var. Stripping `NODE_OPTIONS` (at least a PnP `--require`) from the executor env in
`run-executor` would close it. Eight runs, across all three arms, also built scratch Foundry
projects under fixed `/tmp` paths rather than in the workspace (`/tmp/esc`, `/tmp/escrowgas`, …). That is harmless to
grading, but it is outside the dir `verify` snapshots, and `/tmp` is shared with sibling worktrees' runs, so two
concurrent runs picking the same name would collide.

**Evidence gap (the one #151 raised).** `verify` excludes `**/lib/**` from a bare workspace's
snapshot, so gas-goal-002 `130607Z-none-3`'s `scripts/lib/fork.mjs` and `scripts/lib/rpc.mjs`
(fork and RPC helpers) are not in its committed `output/`. That run is a pass on the control arm,
and PLAN.md does not cite either file, so no grade here rests on them, but that run's evidence is
incomplete. No other run in this set wrote under an excluded dir.

## What should change in the eval

- `gas-goal-002` does not discriminate on Opus 5 medium: 3/3 on all three arms, with every control
  measuring unprompted. On this stack its signal is cost (the controls spend ~2.5× as much), not
  pass rate.
- `gas-quiz-003` separates on expect_4 alone (two controls, both on the mainnet dollar figure),
  as it did on Kimi K3 and codex. `104204Z-3`'s blob-dominant L2 figure is charged by no line (it
  fails on the mainnet figure only), so the rubric has no check on the L2 side of the comparison. That is a note for #119, not an edit.
- Nothing here separates the old text from the new. On pass rate, the only difference the benchmark can
  see between them on this stack is the llamarpc turn.

## AGENTS.md table

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none **`9/9 vs 4/9`** (quiz-001 3/3 vs 0/3, quiz-003 3/3 vs 1/3, goal-002 3/3 vs 3/3). new vs old **`9/9 vs 9/9`**: no difference. |
| Did it reduce time/tokens? | Goal task yes, on both texts: none / old / new medians `1798s / 11.5M tok / $10.11` · `1184s / 3.44M / $4.37` · `865s / 3.46M / $4.05`, and the ranges do not overlap with none. Quizzes no: the skill makes the run measure, so new costs `315k / $0.64` vs none `87k / $0.35` on quiz-001 (old `131k / $0.38`). New vs old: equal tokens on goal-002 and ~27% faster by median; dearer on the quizzes. |
| Did it create negative deltas? | Old text: the dead `eth.llamarpc.com` cost a turn in 6/9 runs. New text: ~2.4× old's tokens on quiz-001 (more cross-checks, two Foundry gas reports). No pass-rate regression on either text. |
| What mistakes repeated without the skill? | `gas-invented-gas-price` (5/9: quiz-001 3/3, quiz-003 2/3), `gas-mainnet-disqualified-on-cost` (2/6 chain-pick controls), `gas-stale-l2-blob-share` (1/9, quiz-003). |
| What mistakes remained with the skill? | New text: none. Old text: `gas-dead-llamarpc-endpoint` (6/9, recovered every time). |
| What should change in the skill? | Nothing on correctness that this stack supports: both texts are 9/9, and the refined one already removes the llamarpc turn. Against old, the new text's advantage is that one turn plus the named Chainlink/Coinbase sources, which its runs used. |
| What should change in the eval? | gas-goal-002 saturates on this stack (all arms 3/3, controls measure unprompted). quiz-003 has no L2-side check, so a blob-dominant L2 figure passes. Harness: strip the PnP `NODE_OPTIONS` from the executor env. |
