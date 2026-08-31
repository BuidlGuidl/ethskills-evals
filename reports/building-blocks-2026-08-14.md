# eval: building-blocks (claude/opus-5)

**Skill:** `skills/building-blocks` at `ff8a521` and `cf69190` — byte-identical content, see the sha note under Run integrity

**Tasks:** `building-blocks-quiz-001` … `-004`, `building-blocks-goal-001` · **Executor:** claude, `claude-opus-5` · **Judge:** claude, `claude-opus-5` · **Runs:** 3 per variant per task (30 total)
**Date:** 2026-08-08 → 2026-08-14 · **Trigger:** content-only (no trigger line prepended; the skill fired on its own in every `with_skill` run)

Every run is recorded `self_judged: true`. The harness sets that flag whenever `judge.agent == executor`, which is unavoidable for a single-stack claude benchmark run as AGENTS.md prescribes. Each judgment still ran blind in a fresh `claude -p` process that never saw the variant, the skill, or the transcript.

## Results

| Task | `no_skill` | `with_skill` | Read |
| --- | ---: | ---: | --- |
| `quiz-001` — Base DEX pick | **3/3** | **3/3** | Ceiling. No control run defaulted to Uniswap. |
| `quiz-002` — Aerodrome fee model | **3/3** | **3/3** | Ceiling. No control run applied the Uniswap LP-earns-fees model. |
| `quiz-003` — Aave V3 flash-loan fee | **3/3** | **3/3** | Ceiling. 0.09% never appeared, including from pure memory. |
| `quiz-004` — Arbitrum yield stack | **3/3** | **3/3** | Ceiling. GLP-as-current never appeared. |
| `goal-001` — V4 dynamic-fee hook | **3/3** | **3/3** | Ceiling. All six compiled and tested green. |
| **Total** | **15/15** | **15/15** | |

**The skill did not improve pass rate, because there was nothing left to improve.** Every stale prior these five tasks were built to catch failed to reproduce on Opus 5. That is the headline finding, and it is a finding about the eval as much as about the skill.

## The priors did not fire

Each task targets a specific 2023-era belief. None of them surfaced in any of the 15 control runs:

- **Uniswap-everywhere (quiz-001).** All three controls picked Aerodrome and argued it from live Base data — `api.llama.fi/v2/chains` and `/overview/dexs/base`, `defillama.com/protocol/aerodrome`, the Aerodrome docs, and `Gauge.sol` / `CLGauge.sol` read straight from GitHub. One went further and checked whether the Aero launch had happened yet.
- **LPs earn trading fees (quiz-002).** All three controls read `Gauge.sol` and `SPECIFICATION.md` from `aerodrome-finance/contracts` and got the ve(3,3) split right: emissions to the staked LP, 100% of swap fees to veAERO voters.
- **The 0.09% V2 flash-loan rate (quiz-003).** All three controls itemized 0.05%. Two used no lookups at all and recalled it correctly from prior knowledge; the third read `FLASHLOAN_PREMIUM_TOTAL = 5` off the Aave Pool at `0x8787…4E2` with `cast`, pulled gas from `eth_feeHistory`, then forked mainnet with anvil and measured the arb at ~333k gas. All three carried the premium into the repayment leg (100,050 USDC back).
- **GLP as the current GMX product (quiz-004).** All three controls named Pendle PT-at-a-discount for the fixed tranche and GMX V2 GM/GLV pools for the trader-fee tranche. GLP appears only as an explicit "V1, legacy" contrast.
- **Pre-V4 Uniswap (goal-001).** All three controls built a V4 `BaseHook` with `beforeSwap`, used the `0x400000` override flag rather than the `0x800000` pool sentinel, keyed the pool with `DYNAMIC_FEE_FLAG`, and covered the mined-CREATE2 hook address. None reached for a V2/V3 workaround.

Notably `expect_5` on goal-001 — the hook-address flag bits, written deliberately beyond the skill's content to test whether the skill's V4 context pushes a run to dig into the docs — did not separate the variants either. Four of six runs named HookMiner explicitly, three of them controls; the two that did not still described the address requirement and passed.

## What the skill actually changed: cost, not correctness

With both arms at ceiling, the only measurable delta is how much work each arm did to get there.

| Task | Duration `no_skill` → `with_skill` | Tokens `no_skill` → `with_skill` | Cost `no_skill` → `with_skill` |
| --- | ---: | ---: | ---: |
| `quiz-001` | 720s → **374s** | 1.26M → **0.58M** | $2.36 → **$1.37** |
| `quiz-002` | 219s → **146s** | 156k → **125k** | $0.69 → **$0.47** |
| `quiz-003` | 393s → **266s** | 404k → **177k** | $1.15 → **$0.77** |
| `quiz-004` | 195s → **160s** | 104k → 116k | $0.57 → **$0.52** |
| `goal-001` | 793s → **753s** | 3.22M → **2.92M** | $3.85 → **$3.48** |

Averages over 3 runs per cell. The mechanism is visible in the transcripts: `with_skill` runs on the quiz tasks frequently answer from the skill with **no web or RPC calls at all** — quiz-002 `with_skill-1` and `-2` are `Skill → Bash → Read → Write` in ~155s, against controls spending 190–255s reading Aerodrome source to arrive at the same place. quiz-004 is the one cell where tokens rose slightly; its controls were already answering largely from memory, so there was little research for the skill to displace.

This is a real benefit where the skill is right. It is also the mechanism behind both mistakes below, because a run that stops looking things up inherits whatever the skill got wrong.

## Mistakes

Two records filed, both `with_skill`-weighted, neither caught by any expect line.

**`building-blocks-aero-merger-tense`** (`no_skill` 2/6, `with_skill` 3/6). SKILL.md L16 and L169 state the Aerodrome/Velodrome merger into Aero as completed. It was announced Nov 2025 and is still unlaunched, currently targeting Sep 2026. Three `with_skill` designs repeat it as shipped fact — quiz-002 `with_skill-2` does so inside a "verify every address onchain before deploy" warning, which is precisely the sentence that should have caught it. Two controls hold the same belief unaided, so the skill confirms an existing error rather than creating one. This was predicted by quiz-001's own notes and was already flagged from the addresses side: `mistakes/addresses/addresses-aero-merger-tense.yaml` names `skills/building-blocks` L16 and L169 as carrying the stale fact untracked. This record is that tracking, now with run frequency behind it.

The correction is reachable from inside the skill: quiz-001 `with_skill-1` and `with_skill-3` both invoked the skill, then checked launch status live and wrote the merger as pending.

**`building-blocks-base-dominance-asserted`** (`no_skill` 0/3, `with_skill` 1/3). quiz-001 `with_skill-2` picks its venue in 162s with no lookup of any kind, asserts "Aerodrome is the dominant DEX" from L169, and then declines on principle to quote any depth figure — "any specific TVL or APR figure written into this document is stale the week after it's written." The venue is argued from mechanism (emissions exist, so there is something to harvest), never from Base liquidity for the pair. expect_1 states that a dominance claim asserted rather than shown fails. The judge passed it.

Two separate problems there, and both need fixing — see below.

## Recommended skill edits

1. **L16 and L169 — re-tense the merger.** "Announced Nov 2025 by Dromos Labs, still unlaunched as of Aug 2026, targeting Sep 2026, with the AERO/VELO token upgrade due at launch. Aerodrome and Velodrome are the live protocols today." The same fix has to land in `skills/l2s` L22 and L97-98 and `skills/addresses` L375, which carry the identical claim.
2. **L169 — drop the bare TVL number and the unqualified dominance claim.** "~$500-600M TVL" is wrong on the metric that matters: as of 2026-07-28 Uniswap leads Base TVL (~$377M across v2/v3/v4 vs ~$281M across Aerodrome v1 + Slipstream) while Aerodrome leads routed volume (24h ~$472M vs ~$285M). Replace with the split plus an instruction to read DefiLlama for the specific pair. This keeps the anti-Uniswap-default correction — which is the skill's real value — while removing the "already know it" shortcut that produced the run above.
3. **Nothing else.** The fee model (L171-175), the 0.05% flash-loan fee, and the V4 hooks material are all correct and all carried runs to full passes faster than the controls got there.

**Superseded by `building-blocks-goal-002` (2026-08-18).** Recommendation 3 was written from this benchmark alone, where both arms sat at 15/15 and the only measured skill benefit was cost. goal-002 then showed the delta is a *trigger* effect — controls that knew every protocol fact still skipped live pair verification — which reframes the retained prose as knowledge the model already holds. The branch therefore deletes it, including the `0x400000` vs `0x800000` override-flag correction that `goal-001` `expect_3` grades. That is a deliberate trade, and this report should not be read as endorsing both positions: the reduction gives up the speed and token savings measured here (48%/32% duration, 54–56% tokens), and gives up a correct V4 fact that the model reached unaided in 3/3 controls anyway. What it buys is one less stale-data surface. `goal-001` is the task that would catch it if the model stops reaching that fact unaided, and it should be re-run alongside goal-002 at the shipped sha.

## Recommended eval changes

1. **quiz-001 expect_1 needs a hard evidence floor.** As written the judge can credit a mechanism argument as Base-specific reasoning. Suggested addition: *the design cites at least one dated, sourced Base liquidity or volume figure for the pair it picks; a design that states it is deliberately omitting such figures fails.*
2. **Add a merger-tense expect to quiz-001 or quiz-002.** The single most repeated error in this benchmark is invisible to the current grading surface. It rides along in prose while every run passes.
3. **These five tasks are spent as pass/fail instruments on this stack.** 30/30 with both arms at ceiling carries almost no information. Sharpening them means targeting facts the model cannot reach with one search — the metric-dependent split (which venue leads *which* metric, where the model reliably overclaims), or a mechanism deep enough that reading `Gauge.sol` for five minutes does not settle it.
4. **Consider grading process, not just output.** The most interesting variance in this benchmark — a 162s run that verified nothing versus a 634s run that read `Voter.isAlive()` onchain and rejected two traps — is invisible to a judge that sees only `design.md`. Both passed identically.

## Run-integrity notes

Session limits interrupted this benchmark repeatedly on 2026-08-13. Handling, so the records can be read honestly:

- **Nine runs were discarded and re-run.** Four `goal-001` runs returned "You've hit your session limit" in under 700ms with only `TASK.md` in the workspace — no work at all. Two others (`goal-001` `no_skill-2` and `no_skill-3`) did 800s and 854s of real work and produced compiling projects, but their transcripts end on the rate-limit error, meaning the agent was cut off rather than finishing. Truncated runs are not measurements of the model, so those were discarded too, even though one had already graded 5/5 — keeping it would have flattered the control arm. Three more were lost to the same window in other ways. Every discarded run was deleted, not overwritten; all 30 records in `artifacts/` are clean runs.
- **One `quiz-001` `with_skill` run was lost to orchestration error, not the limit.** The judge failed and the wrapper had already deleted the workspace, so `verify` could not re-run. It was deleted ungraded and redone under a fresh run id (`183353Z`). The wrapper was then fixed to retry the judge and to keep the workspace unless a verdict lands.
- **The `with_skill` records carry two shas, not one: 9 at `ff8a521` and 6 at `cf69190`** (all six `quiz-001` and `quiz-002` `with_skill` runs, the earliest in the benchmark). Both are commits on `fix/minimal-gas-skill`, the branch checked out while the runs executed. `skills/building-blocks/` and `tasks/building-blocks-*` are byte-identical across `cf69190`, `ff8a521` and `origin/main` — only the surrounding gas-skill work differs — so the benchmark is not blended across two skill versions. The sha moved under the runs because the branch advanced mid-benchmark. This branch is cut from `origin/main`.
- **Several judge failures were transient.** `quiz-003` `with_skill-1`, `quiz-004` `no_skill-2`, and `goal-001` `no_skill-2` all failed the judge 3–5× during the outage window and graded cleanly on retry from their preserved workspaces, with no change to the evidence.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No. `15/15` vs `15/15` — both arms at ceiling on all five tasks. |
| Did it reduce time/tokens? | Yes, consistently. Duration down on all 5 tasks (48% on quiz-001, 32% on quiz-003); tokens down on 4 of 5 (54% on quiz-001, 56% on quiz-003), up 11% on quiz-004; cost down on all 5. |
| Did it create negative deltas? | No scored ones. Two unscored: `building-blocks-aero-merger-tense` (3/6 with vs 2/6 without) and `building-blocks-base-dominance-asserted` (1/3 vs 0/3), both from runs that stopped verifying because the skill had already answered. |
| What mistakes repeated without the skill? | `building-blocks-aero-merger-tense` (2/6). No other target prior reproduced. |
| What mistakes remained with the skill? | `building-blocks-aero-merger-tense` (3/6), `building-blocks-base-dominance-asserted` (1/3). |
| What should change in the skill? | As written here: re-tense the merger at L16/L169 (and in `skills/l2s`, `skills/addresses`); drop "~$500-600M TVL / dominant" for the volume-vs-TVL split plus a live-check instruction. Superseded — `building-blocks-goal-002` showed the value is the trigger, so the skill was cut to it and the protocol prose moved to the wiki/reference layer. See the note under recommendation 3. |
| What should change in the eval? | quiz-001 expect_1 needs a dated-figure requirement the judge cannot read past (it false-passed one run). Add a merger-tense expect. All five tasks are now saturated on this stack and need harder targets to stay informative. |
