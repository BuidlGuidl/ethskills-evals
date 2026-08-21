# skills/addresses (reduced) — eval report

**Executor:** claude / `claude-opus-5`
**Judge:** claude / `claude-opus-5`, fresh blind process per run via `yarn verify`
**Runs:** 24 graded — `with_skill` 3 per task across 6 tasks, plus `no_skill` 3 each on the two
tasks whose expects changed (goal-001, quiz-001)
**Date:** 2026-08-18/19
**Skill version:** `a461aa8` — the reduced skill from this branch, 39 lines / 706 words as
run. Two sentences were edited after the runs on PR #75 review and did not go through the
benchmark (now 39 lines / 753 words): the "unlike v3" clause, which was false — v3's Base
router differs from its mainnet one, as this PR's own expects pin — and the Slipstream
"where the major Base pairs actually trade" claim, which now names its metric and its date.
**Baseline:** [#62](https://github.com/BuidlGuidl/ethskills-evals/pull/62), same stack, skill
`326ad4b` (547 lines / 2,840 words of address tables)

Every run records `judge.self_judged: true`: one harness is installed here, which is what
AGENTS.md prescribes. The judge is still a separate blind process that never sees the variant,
the skill, or the transcript.

## Results

| task | no_skill | with_skill | #62 with_skill | failing check |
| --- | --- | --- | --- | --- |
| quiz-001 — Base swap venue + router address | **3/3** | **3/3** | 2/3 ‡ | — |
| quiz-002 — Uniswap v4 differs per chain | 3/3 † | **3/3** | 3/3 | — |
| quiz-003 — vanity CREATE2 proves nothing cross-chain | 3/3 † | **3/3** | 3/3 | — |
| quiz-004 — deprecated V1 VELO token | 3/3 † | **3/3** | 3/3 | — |
| quiz-005 — per-chain Aave pools + native USDC | 3/3 † | **3/3** | 2/3 | — |
| goal-001 — unprompted viem swap build | **1/3** | **3/3** | 3/3 ‡ | expect_6 (verify-before-funds) |
| **total** | | **18/18** | 16/18 ‡ | |

† carried over from #62. Those four tasks have identical inputs and identical expects, and the
judge model is unchanged, so re-running the unaided variant would have re-measured a constant.
goal-001 and quiz-001 were re-run in both variants because their expects moved (below).

‡ **graded against a different rubric.** quiz-001's three expects were all rewritten and
goal-001 gained expect_7 and a reworded expect_6, so the `#62 with_skill` cell on those two rows
is not a like-for-like comparison and neither is the 16/18 total that contains them. quiz-001's
2/3 → 3/3 in particular is confounded: #62's failing run copied the skill's TVL claim with no
lookup and would probably fail the new expect_1 too, but that is an argument, not a measurement.
The `no_skill` vs `with_skill` columns are the sound comparison on those rows — both variants ran
on the current expects. Read the #62 column per-expect or not at all.

Mean cost and effort per run:

| task | no_skill | with_skill | #62 with_skill |
| --- | --- | --- | --- |
| quiz-001 | 550s / $1.37 | 573s / $1.45 | 280s / $0.78 |
| quiz-002 | — | 387s / $1.08 | 72s / $0.39 |
| quiz-003 | — | 280s / $0.90 | 226s / $1.07 |
| quiz-004 | — | 171s / $0.57 | 52s / $0.35 |
| quiz-005 | — | 279s / $0.75 | 62s / $0.40 |
| goal-001 | 1689s / $4.53 | 2179s / $3.70 | 803s / $2.66 |

## What the cut did

**Both of #62's negative deltas are gone, and nothing regressed.** `with_skill` went 16/18 → 18/18.
The two failures the tables produced were not subtle, and neither survived deleting the tables:

- **quiz-001 (was 2/3).** #62's failing run copied L357's *"largest DEX on Base by TVL
  (~$500-600M)"* into its answer — wrong metric, roughly double the real figure — in 5 turns with
  no lookups. All three runs now commit to a venue on measured evidence. Run 1 handed over
  `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`, the Slipstream SwapRouter, with its QuoterV2,
  CLFactory and the ts=100 USDC/WETH pool — the contract whose absence from the old file was
  `addresses-aerodrome-slipstream-missing`.
- **quiz-005 (was 2/3).** #62's failing run got all eight addresses right and attributed every one
  to *"verified address reference"* — the skill itself — then wired them to a live `supply()`.
  With nothing to cite, the runs now cite `aave-address-book`, Circle's published contract list,
  and their own `getMarketId()` / `getReserveAToken()` calls.

**No `with_skill` output in 18 runs cites the skill as an address source.** That was the whole
mechanism behind `addresses-verified-stamp-substitutes-for-check`, and removing the tables and the
"Last Verified" stamp removed it.

**Every skilled run verified on-chain.** The tell is the Bash count: #62's two failing runs ran the
sequence `ls → Skill → Write`, zero verification. The minimum across all 18 runs here is 8 Bash
calls, the median 18, and goal-001 runs 38-64 — forked Base on a local anvil and executed the swap
against fork state before handing it over. The skill now tells runs what to check instead of
answering for them.

### goal-001: the delta the skill is kept for

`with_skill 3/3` vs `no_skill 1/3`, against #62's `3/3 vs 2/3` on the same task with six expects.

Read the two failures precisely, because they are narrower than "the unaided runs skipped
verification" — both verified heavily. no_skill run 1 wrote a table titled *"Addresses, and how
each was verified"*, every entry checked by calling the contract, with the same assertions re-run
in `preflight()` before funds move. no_skill run 3 shipped a five-point *"Before running this with
real funds"* section covering dry runs, fork testing at real size, the native-vs-bridged USDC trap,
and RPC quality.

What neither did was tell the developer to confirm the addresses against a block explorer or the
protocol's published deployment list. Both documented checks *the agent itself* performed and
assertions the *code* re-runs — which catch a mis-wired constant, but not a genuine-and-current
address that belongs to the wrong protocol, or a deployment that has been superseded. All three
`with_skill` runs named that step for the human.

expect_6 was reworded in this branch to state that distinction outright, because #62's single
failure turned on a reading the line did not carry. So part of the widened gap (1/3 here vs 2/3
there) is a stricter, clearer rubric rather than worse unaided behaviour. The honest summary: the
delta holds, and it is now legible instead of arguable.

### The cost of deleting the tables

Real, and smaller than #62 implied. quiz-004 — the sharpest case, where the V1/V2 VELO row bought
a 4x speedup — now runs at 171s / $0.57 against 52s / $0.35 with the table and 220s / $0.71
unaided. Deleting the row cost ~2 minutes and 22 cents, not a full regression to unaided speed: the
"same protocol, older deployment" rule still tells a run *what* to suspect, so it checks the token
contracts instead of rediscovering the failure mode. Same shape on quiz-002 and quiz-005.

goal-001 inverts the usual direction: skilled runs cost **less** than unaided ones ($3.70 vs $4.53)
while running longer, because the unaided runs spend tokens working out what to check.

### expect_7 does not discriminate

The new router-within-venue check passed in all six goal-001 runs, both variants. Unaided runs find
Slipstream by quoting pools too. It is worth keeping as a guard against the specific -1,283 bps
error, but it is not evidence for the skill, and the pass counts should not be read as if it were.

## Mistakes

All four #62 records for this skill are addressed by content, and the runs confirm three of them:

| id | status | evidence |
| --- | --- | --- |
| `addresses-base-dominance-metric` | fixed | claim deleted; quiz-001 3/3, no run asserts a dominance figure |
| `addresses-verified-stamp-substitutes-for-check` | fixed | stamp and ✅ column deleted; 0/18 runs cite the skill as a source, min 8 Bash calls per run |
| `addresses-aerodrome-slipstream-missing` | fixed | Slipstream named in the skill; quiz-001 run 1 and the goal runs route through its router |
| `addresses-morpho-arbitrum-absent` | fixed | false claim deleted; quiz-003 3/3 including expect_4 |
| `addresses-aero-merger-tense` | fixed | gone from `skills/addresses` — no run produced a merger-tense claim |

No new mistake records. The merger-tense error lives in three vendored skills and was filed once
under `addresses`; `skills/l2s` and `skills/building-blocks` have since got their own records
(`l2s-aero-merger-tense`, and `building-blocks-aero-merger-tense` from #69, which carries observed
run frequency). Holding the addresses record open on their behalf left `mistakes/addresses/`
describing an L375 that `skills/addresses` no longer has, so it is now closed on its own skill and
the other two stand on theirs. Nothing else failed that a record does not already cover.

## Evidence

Every run directory carries the graded material, not just the verdict: `output/` for all 24 runs —
`swap.ts` + `NOTES.md` for goal-001, `answer.md` or `chains.ts` for the quizzes — committed
verbatim as the judge saw it, lockfiles included. These tasks are all bare-workspace, so there is
no scaffold to diff and `output/` is the whole deliverable.

This matters most on goal-001, where the entire `3/3 vs 1/3` delta rests on expect_6 grading the
text of `NOTES.md`, and that text is not recoverable from `transcript.md` (the goal transcripts
carry 25-48 `…[+N chars]` truncation markers each). The same goes for the "0/18 outputs cite the
skill as an address source" claim, which is a statement about `answer.md`.

`.gitignore` blanket-ignored `artifacts/**/output/` — written for template-seeded runs, where the
snapshot is hundreds of unchanged scaffold files — which silently swallowed the evidence for
question-shaped runs too, against AGENTS.md "What gets committed". These 24 are force-added; the
rule's comment now says so. Narrowing the rule itself belongs on the harness branch, along with
the missing `executor_model` / `executor_exit` fields in `result.yaml`.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `with_skill 18/18` against `16/18` for the same tasks on the pre-cut skill — but see ‡: two of those six rows moved rubric, so that pair is not a clean measurement. Against `no_skill`: goal-001 `3/3 vs 1/3`, quiz-001 `3/3 vs 3/3`, and the four carried quizzes are saturated in both variants. The uplift is confined to the unprompted build, which is where #62 found it too. |
| Did it reduce time/tokens? | Not against the old skill: the tables were faster where their facts held (quiz-004 52s → 171s, quiz-002 72s → 387s). Against `no_skill` it is roughly neutral on the quizzes and cheaper on goal-001 ($3.70 vs $4.53). The cut trades speed for verification, deliberately. |
| Did it create negative deltas? | None. Both #62 negative deltas closed and no new ones appeared. |
| What mistakes repeated without the skill? | `no_skill` goal-001 runs 1 and 3: verified thoroughly themselves, never told the human to confirm against an explorer or deployment list. |
| What mistakes remained with the skill? | None observed in 18 runs. |
| What should change in the skill? | Nothing this benchmark can see. It is saturated at 18/18 — which also means it can no longer detect a regression, so the next content change needs a harder task, not this set. |
| What should change in the eval? | (1) The five quizzes are exhausted: `no_skill` is 15/15 in #62 and `with_skill` 15/15 here, so they measure nothing about this skill on this model — retire them as a regression check or replace with goal-shaped tasks. (2) expect_7 passes in both variants; keep it as a correctness guard, not a signal. (3) goal-001 is the only discriminating task left, and one expect carries the entire delta — a second goal task, targeting a different unprompted habit, would stop the verdict resting on a single line. (4) Nothing here tests the "bridged vs native" or "older deployment" rules unprompted; both currently only appear in quizzes that ask directly. (5) `quiz-001` expect_3 grades four things at once — address genuine for the venue, not a mainnet carryover, right router within the venue, attributed to a source — so a fail does not say which, the same defect goal-001 fixed by splitting expect_3/expect_4 and adding expect_7. Promoting the router-within-venue clause to a `quiz-001` expect_4 changes the expect count and needs a re-run, so it is held for the next benchmark. |

## Run conditions

Runs were executed serially, one executor at a time, and each was graded before the next started.

Two incidents, neither affecting a graded record:

- A session limit was reached mid-queue at 00:16 UTC. The CLI fails a run in ~18s while limited
  without writing anything, so the queue drained 17 entries in five minutes with nothing executed.
  Those runs were never started, produced no artifacts, and were re-queued and run after the reset.
  The driver now probes with a one-word canary before each run and waits out a limit instead of
  feeding the queue into it — the CLI exits 0 when it refuses on a limit, so the refusal text is
  the only usable signal.
- A queue-pruning bug re-dispatched one already-completed quiz-002 run. It was killed mid-flight
  and its run directory deleted before grading; quiz-002 has exactly 3 `with_skill` runs.
