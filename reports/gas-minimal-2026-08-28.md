# eval: minimal gas skill, description rewritten (codex executor / claude judge)

**Skill:** `skills/gas` at `8b199ff` (36 lines, 256 words)

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

The criteria fix is confirmed: `gas-goal-001` `with_skill` moved 0/3 → 3/3 with no change to the
skill body between the two runs. The old `expect_3` was failing correct work.

## gas-goal-001 — the cleanest signal

All three controls failed on `expect_2` alone, and for the same reason. Each chose Base and named
cost as the justification, without measuring anything and without conceding mainnet was viable:

- "Deploy to **Base** for production: it is an Ethereum L2 with low transaction fees"
- "low transaction fees make it a practical production destination for frequent escrow actions"
- "low fees make per-job contracts practical"

None quoted an inflated number — they simply never checked, and the chain choice fell out of an
unexamined prior. That is precisely the behavior the skill's one instruction targets. All three
skilled runs measured mainnet and Base live, quoted cents-range figures, and kept mainnet viable.

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
| What mistakes remained with the skill? | One wei→gwei conversion error producing a 1000× cost overstatement. |
| What should change in the skill? | State that `cast` prints wei. Keep everything else minimal; nothing here argues for restoring removed reference material. |
| What should change in the eval? | `gas-quiz-003` needs its scope fixed — two controls failed for answering Solana, which the prompt permits and `expect_2` forbids. |
