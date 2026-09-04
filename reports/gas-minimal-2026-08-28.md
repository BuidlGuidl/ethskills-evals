# eval: minimal gas skill, description rewritten (codex executor / claude judge)

> **SUPERSEDED 2026-08-31 by `reports/gas-minimal-2026-08-31.md`.** In review of PR #57
> `gas-goal-001` was found to have no expect line requiring a measurement, and
> `gas-goal-002`'s `expect_5` could only fail a plan that showed its components. Both
> rubrics were fixed and every run with committed evidence was regraded. **The
> `gas-goal-001` numbers in this file are wrong** — they were produced by a rubric that
> scored a run 4/4 for measuring nothing. The 08-31 report carries the corrected table.
> Everything below is kept as written, so the regrade can be checked against what it
> replaced.

**Skill:** the first half measures `skills/gas` at `8b199ff` (36 lines, 265 words); the
re-validation half below measures `017d9dc` (38 lines, 308 words), which adds the wei
clause. An earlier draft of this header gave one revision and one word count for both.

**Tasks:** `gas-goal-001`, `gas-goal-002`, `gas-quiz-001`, `gas-quiz-003`
**Executor:** codex `gpt-5.6-terra` · **Judge:** claude `claude-opus-5` · **Runs:** 3 per variant per task (24 total)
**Date:** 2026-08-28 · **Trigger:** content + description

Executor and judge are different harnesses, so every run records `self_judged: false`. This is the
first gas benchmark with a pinned executor model recorded in `executor.yaml`; the 2026-07-24 and
2026-08-10 sets have no `executor.yaml` at all and cannot be reproduced or blended with this one.

## Why this re-run

Three things had changed since the last gas benchmark, and each invalidated part of it:

1. `gas-goal-001`'s `expect_3` was rewritten (`8754d9d`). The 2026-08-10 report showed the old line
   failing skilled runs for quoting *fresh, correct* dollar figures — the opposite of what the skill
   asks for. Every 2026-08-10 grade was made against that line.
2. `gas-goal-002` gained an arithmetic-consistency check (`expect_5`), ungraded in the prior set.
3. The skill `description` was rewritten from a body summary into a trigger, per issue #91. The
   harness installs the skill but never tells the executor to read it, so the description is
   load-bearing for whether the skill is loaded at all.

## Results

| Task | `no_skill` | `with_skill` |
| --- | ---: | ---: |
| `gas-goal-001` | **0/3** | **3/3** |
| `gas-goal-002` | **0/3** | **3/3** |
| `gas-quiz-001` | **0/3** | **3/3** |
| `gas-quiz-003` | **0/3** | **2/3** |
| **total** | **0/12** | **11/12** |

**This is the first of two tables in this file and it is superseded twice over** — by the
re-validation below, which re-ran `gas-quiz-003` after its scope fix, and then by the
2026-08-31 regrade. It is kept because the re-validation carries three of its four
`no_skill` arms forward. Do not read it as the result.

The criteria fix is confirmed: `gas-goal-001` `with_skill` moved 0/3 → 3/3 with no change to the
skill body between the two runs. The old `expect_3` was failing correct work.

## gas-goal-001 — the cleanest signal

All three controls failed on `expect_2` alone, and for the same reason. Each chose Base and named
cost as the justification, without measuring anything and without conceding mainnet was viable:

- "Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees"
- "low transaction fees make it a practical production destination for frequent escrow actions"
- "low fees make per-job contracts practical"

None quoted an inflated number — they simply never checked, and the chain choice fell out of an
unexamined prior. That is precisely the behavior the skill's one instruction targets.

**CORRECTED 2026-08-31.** This paragraph originally ended "All three skilled runs measured
mainnet and Base live, quoted cents-range figures, and kept mainnet viable." That is false,
and the artifacts in this repo show it. `2026-08-27T233445Z-codex-with-skill-2` contains no
`cast base-fee`, no `cast gas-price`, no `gwei` figure, no `curl`, and no ETH price across
7,213 transcript lines: it read `SKILL.md` and went straight to `forge`. It still scored
4/4, because no expect line required a reading. `2026-08-27T233109Z-codex-with-skill-1` did
measure, then divided by 1e6 instead of 1e9 and ruled mainnet out at $503 to deploy. One of
the three matches the sentence. See `mistakes/gas/gas-chain-picked-without-measuring.yaml`.

## gas-goal-002 — 3/3 with the skill, 0/3 without

Every control failed `expect_2` (the L1 data-availability share) and `expect_4` (live-checked
figures); two also failed `expect_3`, and one failed all four. The skilled runs all passed,
including the new arithmetic-consistency check that the prior benchmark's one skilled failure
would have tripped.

## gas-quiz-001 — the stale-prior pattern, explicitly

The controls did not merely omit measurement; they produced concretely wrong numbers while the
chain sat at ~0.045 gwei and ETH at ~$2,512:

- `$5.48` per ERC-20 transfer on Ethereum, `$16.44` per job, from a "tracker" figure
- a `20 gwei` "L1 stress case" yielding `$16.10`, alongside a hardcoded `ETH = $3,500`
- a `$0.10 per interaction` planning allowance derived from Base docs at `ETH = $2,000`

All three skilled runs measured live (0.045–0.050 gwei mainnet, ~$2,512 ETH) and passed.

## gas-quiz-003 — a real win, but read the controls carefully

2/3 skilled, 0/3 control, though the control failures are not all stale-prior failures. **Two of
the three controls recommended Solana**, which fails `expect_2` because the line requires an L2 or
L2-native chain. The task prompt ("a social feed for AI agents") never restricts the answer to
Ethereum, so those two runs failed a scope condition the prompt does not state, not a cost
misconception. Only the third control failed for the intended reason (Base recommended off
documentation figures at a stale `ETH = $2,000`, no live check).

**This task should not be counted as clean evidence in its current form.** Either the prompt should
scope the question to Ethereum and its L2s, or `expect_2` should accommodate a reasoned non-Ethereum
answer. Flagging rather than fixing here, since changing it now would invalidate this run too.

## The one skilled failure is a skill gap, and it is fixable

`gas-quiz-003` `with-skill-3` did everything the skill asked and still produced a stale-looking
answer. It ran `cast gas-price` against mainnet and got `133491758` (transcript line 101) — wei,
i.e. **0.1335 gwei**, consistent with every other run in the batch. It then divided by `1e6` instead
of `1e9`, wrote "133.491758 gwei", and derived `$33.59` per post and `$503.81` per deployment. On
those numbers it ruled mainnet out, failing `expect_2` and `expect_3`.

This is not a stale prior. It is the skill's formula being under-specified:

```text
cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd
```

The formula consumes gwei, but the two `cast` commands printed immediately above it emit **wei**,
and the skill never says so. The single failing run is the run that made exactly that conversion
error. A one-clause fix is proposed in the follow-up commit; it is **untested** and should be
validated by re-running `gas-quiz-003` before the PR merges.

## Cost

| Task | `no_skill` | `with_skill` |
| --- | --- | --- |
| `gas-goal-001` | 26.9k tok / 149s | 39.3k / 176s |
| `gas-goal-002` | 38.8k / 214s | 63.4k / 268s |
| `gas-quiz-001` | 36.3k / 95s | 22.8k / 91s |
| `gas-quiz-003` | 37.9k / 88s | 32.9k / 121s |

The goal tasks cost more with the skill; the quiz tasks cost **less**. The skill short-circuits
research that a control does from scratch when the question is asked directly, and adds measurement
work when the agent is building. That localizes the token penalty to build tasks and weakens the
case for the proportionality guardrail the 2026-08-10 report floated — the overhead is not general.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes, decisively: **11/12 vs 0/12**. Every task shows the delta. |
| Did it reduce time/tokens? | Split: higher on goals (+46%, +64%), lower on quizzes (−37%, −13%). |
| Did it create negative deltas? | No correctness regression. Token cost rises on build tasks only. |
| What mistakes repeated without the skill? | Unmeasured "L2 is cheaper" chain choice (goal-001, 3/3); stale gas and ETH figures — $5.48/transfer, 20 gwei, ETH $3,500 (quiz-001). |
| What mistakes remained with the skill? | One wei→gwei conversion error producing a 1000× cost overstatement. *(2026-08-31: also `gas-chain-picked-without-measuring`, 2 of these 9 skilled runs, which the rubric of the day could not see.)* |
| What should change in the skill? | State that `cast` prints wei. Keep everything else minimal; nothing here argues for restoring removed reference material. |
| What should change in the eval? | `gas-quiz-003` scope fixed in `017d9dc`; see the re-validation section below. *(2026-08-31: this row missed the two real eval defects — `gas-goal-001` required no measurement and `gas-goal-002`'s `expect_5` rewarded omitting the fee breakdown. Both fixed and regraded.)* |

---

# Re-validation at `017d9dc`

Two changes landed after the benchmark above, and each invalidated part of it:

- **`9ece856`** added the wei/gwei clause to the skill, so every `with_skill` result above
  describes an older skill than the branch carries.
- **`017d9dc`** scoped `gas-quiz-003` to the Ethereum ecosystem, so both of its arms needed
  re-running.

15 further runs: `gas-quiz-003` both variants, plus the `with_skill` arms of the other three tasks.
The `no_skill` arms of those three stand unchanged — the skill cannot affect them and their criteria
did not move.

## Final results

| Task | `no_skill` | `with_skill` |
| --- | ---: | ---: |
| `gas-goal-001` | 0/3 *(carried)* | **3/3** |
| `gas-goal-002` | 0/3 *(carried)* | **3/3** |
| `gas-quiz-001` | 0/3 *(carried)* | **3/3** |
| `gas-quiz-003` | **1/3** | **3/3** |
| **total** | **1/12** | **12/12** |

**Superseded 2026-08-31.** `gas-goal-001`'s 3/3 here was produced by a rubric with no
measurement requirement; see the banner at the top of this file and the 08-31 report.

## The scope fix did what it was meant to

All three controls now recommend Base — an Ethereum L2 — instead of leaving the ecosystem. The two
that failed did so on `expect_3`, the intended mechanism: they quoted mainnet at **$12.35** and
**$12.75** per action while mainnet was at 0.053–0.064 gwei, where the same action costs cents.
The one control that passed picked Base for traffic-profile reasons and simply never quoted a stale
mainnet figure, so `expect_3` did not bite. That is a legitimate pass, and a 1/3 control rate is a
more credible baseline than the 0/3 the unscoped prompt produced.

## The wei clause is not yet validated

`gas-quiz-003` `with_skill` went 2/3 → 3/3 and no run in this batch repeated the conversion error;
every skilled run read mainnet at 0.053–0.064 gwei and Base at 0.005–0.006 gwei. But the original
error appeared **once in twelve runs**, so its absence from twelve more is weak evidence. Only one
run's output references the conversion at all. Treat the clause as plausible and cheap, not proven.

## Cost, second batch

| Task | `with_skill` |
| --- | --- |
| `gas-goal-001` | 40.5k tok |
| `gas-goal-002` | 54.2k tok |
| `gas-quiz-001` | 21.4k tok |
| `gas-quiz-003` | 24.9k tok (vs 53.3k `no_skill`) |

`gas-quiz-003` now shows the sharpest efficiency result in the set: the skill halves token use on a
direct question, because the control researches from scratch what the skill states outright. The
build-task overhead seen above is unchanged.

## Standing caveats

- One skill version, one executor model, three runs per cell. Three runs separate 0/3 from 3/3
  reliably; they do not resolve 1/3 from 2/3.
- The `output/` evidence for every run here is gitignored, as in all prior sets. It exists on disk
  in the run directories and nothing protects it.
