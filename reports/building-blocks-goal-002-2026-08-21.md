# eval: building-blocks-goal-002, shipped trigger (claude/opus-5)

**Skill:** `skills/building-blocks` at `d6887a8` — the 128-word trigger, benchmarked before the `description` rewrite this PR also carries (see integrity notes)

**Task:** `building-blocks-goal-002` · **Executor:** claude, `claude-opus-5` · **Judge:** claude, `claude-opus-5` · **Runs:** 3 per variant
**Date:** 2026-08-20 → 2026-08-21 · **Trigger:** content-only

All runs are recorded `self_judged: true` because executor and judge run on the same agent, as AGENTS.md prescribes for a single-stack benchmark. Each verdict came from a fresh blind process that saw the task and the run's evidence, never the skill, the variant or the transcript.

This benchmark exists because the 2026-08-18 round measured the 467-word candidate at `06e154a` and the branch then shipped a 128-word reduction. Those numbers never applied to the merged text.

## Result

| Variant | Full passes | Per-check |
| --- | ---: | --- |
| `no_skill` | **1/3** | expect 1, 4, 5: 3/3 · expect 2: 1/3 · expect 3: 2/3 |
| `with_skill` | **3/3** | all five checks: 3/3 |

Same split the candidate produced. Read the control's single full pass with the caveat below before treating `1/3` as solid.

| Run | Verdict | Failed | Tests | Duration | Cost |
| --- | --- | --- | ---: | ---: | ---: |
| `with-skill-4` | 5/5 | — | 32 | 28m | $6.06 |
| `with-skill-5` | 5/5 | — | 50 | 35m | $8.40 |
| `with-skill-6` | 5/5 | — | 63 | 33m | $9.34 |
| `no-skill-4` | 3/5 | expect_2, expect_3 | 70 | 44m | $13.05 |
| `no-skill-5` | 4/5 | expect_2 | 72 | 32m | $8.50 |
| `no-skill-6` | 5/5 | — | 57 | 26m | $6.85 |

## The trigger fires unprompted

All three `with_skill` runs invoked the skill on their own, and the `Skill` tool call is in each session log. This was the specific doubt raised in review: the 467-word candidate's `description` named Uniswap, Aerodrome, Aave, GMX and Pendle, the 128-word text benchmarked here names no protocol, and the task input names no DEX. It still fired 3/3 — the category words (`DEX pools`, `yield venues`, `gauges`) carried it against a prompt saying only "yield vault on Base", "DEX liquidity" and "harvest()". The earlier round could not answer this — two of its three skilled runs mentioned nothing about the skill, and a final-message transcript cannot show a tool call either way.

## What separated the arms

`expect_2` — dated, sourced, pair-specific Base evidence — is the axis, as before. The skilled runs measured and dated:

- `with-skill-5`: "read from Base mainnet (chain 8453) on 2026-08-20, around block 50,237,000", repeated in NatSpec over the address book.
- `with-skill-6`: "read from Base mainnet on 2026-08-20, around block 50,243,125".

The controls asserted:

- `no-skill-4`: "It is the dominant AMM on Base."
- `no-skill-5`: "Aerodrome is the dominant DEX on Base by both TVL and volume." No date, block, or source anywhere in its diff. "By both" is also wrong on one axis — the task's ground truth has Uniswap leading Base TVL.

Both are `building-blocks-live-pair-evidence-omitted`, unchanged in character from the candidate round.

## Two findings that complicate the story

**`expect_2` looks false-passed on `no-skill-6`.** The control that scored 5/5 contains no date and no block number anywhere in its diff, and states "Aerodrome is the dominant AMM on Base" unsourced. What it did verify on chain is mechanism — `Pool.claimable0/claimable1` against the gauge, `Voter.isAlive(gauge)` — not a figure. `expect_2` says "protocol mechanics alone, or an unsupported dominance claim does not pass" and asks for a **dated** figure. On its own text this run should have failed the check, which would make the split `3/3 vs 0/3` rather than `3/3 vs 1/3`. The verdict was not regraded: the orchestrator has read the skill and the expect lines and cannot judge blind. Filed as `building-blocks-gauge-mechanics-read-as-evidence`. The honest headline is that the delta is at least as large as reported, not smaller.

**A control shipped the fees-plus-emissions double count.** `no-skill-4` modelled gauge-staked LP income as emissions *and* trading fees, in three places: README "the gauge pays AERO emissions voted to this pool, on top of the 0.30% swap fees that accrue into the reserves"; NatSpec "compounds the AERO emissions plus accrued swap fees back into the LP"; and a test that donates to both sides to simulate fee accrual. A gauge-staked Aerodrome LP forfeits trading fees to veAERO voters, so this overstates yield.

That matters for the reduction. The 2026-08-18 report concluded the protocol facts could move to a wiki because "even failed controls implemented the Aerodrome mechanics correctly" — true across 6/6 runs then, and now 5/6. One counterexample in three controls is a dent in that reasoning, not a refutation, but the claim as written no longer holds and the reduction rests on it. Filed as `building-blocks-gauge-fee-double-count` at `1/3`.

## What the trigger bought beyond the score

`with-skill-6` surfaced a protocol change newer than the skill itself: it reports that Aerodrome announced Predictive Allocation on 2026-07-26, replacing weekly veAERO gauge voting. That is the run's own sourced finding and is repeated here unverified — but the mechanism is the point. A reference page written before that date would have been confidently stale, and the run went and looked because the skill told it to. This is the clearest instance in either round of the keep-a-trigger side of issue #1's rule.

## Integrity notes

- **Every run commits the evidence it was graded on.** `run.diff` (17–30 files, 1,969–3,301 lines) plus a full session transcript with tool calls, build output and telemetry. The candidate round committed neither, which is why none of its verdicts could be re-checked.
- **`skill_version` reads `9c0c1a5` on one run and `5a084e3` on two.** Both are harness commits made during the benchmark. `skills/building-blocks/SKILL.md` is byte-identical across `d6887a8`, `f553102`, `9c0c1a5` and `5a084e3` (sha256 `0793d0fd8…`), so one skill text produced all three skilled runs.
- **The `description` was rewritten after these runs, under #91.** The graded text is `d6887a8` (128 words, sha256 `0793d0fd8…`); what merges is 153 words, sha256 `ce51e6c98…`. The body is byte-identical — only the `description` changed, to meet #91's trigger-not-summary bar: it drops a first sentence that restated the body, re-adds protocol names as routing keywords, and adds a "not for" clause pointing at `addresses` and `l2s`. The change is additive to the matched surface: the clause that did the matching — "selecting or integrating DEX pools, lending markets, yield venues, gauges, reward systems, or multiple protocols in one flow" — is carried over verbatim, and everything else is added around it. So the 3/3 is taken to hold, but it was not re-measured. The negative clause is untested by construction: these runs had no sibling ethskills loaded (`skills: ["building-blocks", …]` is otherwise all operator-local skills), so this benchmark cannot speak to routing against `addresses` or `l2s`.
- **The harness changed between the two rounds.** Workspaces now carry their own git repo and `writeDiff` diffs against the baseline commit recorded at setup (#66). The candidate round's numbers were produced under the old harness; the two tables are not interchangeable.
- **One run was discarded for reading the orchestrator's memory.** Before the harness fix, a workspace under `artifacts/` had no repo of its own, so anything resolving a project by walking up to the nearest `.git` resolved it to this repo and the executor inherited the orchestrator's memory directory. The discarded run read four memory files — including a Base archive-RPC endpoint with a pinned fork block, and the USDC storage slot for funding test accounts — and wrote two more back, one of which stated `expect_3`'s ground truth outright. Fixed on main by #66 (`seedWorkspaceRepo`), which supersedes the `9c0c1a5` version this branch ran under; every graded run here is confirmed to have touched neither that directory, nor `tasks/`, nor a sibling run.
- **The candidate round cannot be cleared or convicted on this.** The two DeFi memory files were created 2026-08-18 17:00 and 21:14, after all six of those runs finished (latest 2026-08-18T00:08Z), so they could not have been read. The mechanism was live throughout, and final-message transcripts make it unprovable either way.
- **One control was truncated by the session limit** at 13 turns with `is_error: true`, having produced a partial Foundry project. Deleted ungraded and redone under a fresh run id. A truncated control fails every check and would have flattered the skilled arm — the same call the 2026-08-14 report made when it discarded two rate-limited controls, one already graded 5/5.
- **Fork tests are conditional.** `with-skill-4`'s Aerodrome fork suite reports 14 skipped without an RPC and 14 passed with one. Build/test success is an orchestrator reading of the transcript, not a judged check; `expect_5` grades the committed suite because `verify` never hands the judge a transcript.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes: **3/3 vs 1/3**, and at least that, given the `no-skill-6` false pass. |
| Did it reduce time/tokens? | No. Skilled runs averaged 32m/$7.93, controls 34m/$9.47, but the controls' spread (26–44m, $6.85–$13.05) is wider than the gap. Nothing established at n=3. |
| Did it create negative deltas? | None scored. |
| What mistakes repeated without the skill? | `building-blocks-live-pair-evidence-omitted` (2/3), `building-blocks-gauge-fee-double-count` (1/3). |
| What mistakes remained with the skill? | None across the five checks. |
| What should change in the skill? | Nothing on this evidence — the shipped trigger reproduces the candidate's result. But the reduction's justification needs revisiting: it deleted the Aerodrome fee-model correction on the grounds that controls never got it wrong, and one now has. |
| What should change in the eval? | `expect_2` needs to exclude onchain mechanism checks from counting as dated evidence — `no-skill-6` passed on `claimable0/claimable1` and `isAlive` reads with no figure and no date. Re-run after sharpening. |
