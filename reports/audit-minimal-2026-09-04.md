# Audit minimal skill — Codex comparison (2026-09-04)

Executor and judge: `codex` / `gpt-5.6-sol`. Three fresh runs per variant on
each of the four existing audit tasks. Every run is self-judged by a separate blind
Codex process. Trigger was content-only; no forced skill instruction was added.

The skill revision was `7be55c8b`; its external checklist URLs pin
`austintgriffith/evm-audit-skills` at
`ffe4b670e78e1945bcf275f79d4b7b0481bcff35`. All 24 executors and judges exited 0.
Unlike PR #108, no run was rejected by the cybersecurity classifier.

## Results

| Task | What it grades | `no_skill` | `with_skill` |
| --- | --- | ---: | ---: |
| `audit-quiz-001` | L2 sequencer feed and recovery grace period | 3/3 | 3/3 |
| `audit-quiz-002` | Arbitrum/OP-stack `block.number` semantics | 3/3 | 3/3 |
| `audit-quiz-003` | Nonce/deadline and fork-safe EIP-712 domain | 2/3 | 3/3 |
| `audit-goal-001` | All 11 findings plus severity | 0/3 | 0/3 |

The goal is read as a planted-finding count, not as its intentionally strict full-task
pass. Baseline reports found **29/33** planted vulnerabilities (10/11, 9/11, 10/11).
Skill reports found **30/33** (10/11 in each run). Severity ranking passed 3/3 in both
arms. Across the quizzes, the skill retained the earlier cached-domain separator uplift:
**9/9 vs 8/9** full-task passes.

Goal misses were:

- `no_skill`: transfer-before-effects withdrawal reentrancy in 3/3; the unbounded
  `liquidateAll` loop in 1/3.
- `with_skill`: withdrawal reentrancy in 1/3, missing sequencer liveness/grace period
  in 1/3, and `block.number`-as-clock in 1/3.

Manual review found no clear false-positive finding in the six goal reports. Reports
often included additional true issues outside the grading surface, as the task permits.

## Routing behavior

All skill-enabled runs opened `SKILL.md`. Narrow quiz runs followed the minimized
routing instruction and fetched only relevant pinned checklists rather than the master
index plus a broad bundle.

None of the three skill-enabled goal runs completed specialist fan-out. Two read eight
selected checklists inline without attempting collaboration. One attempted a specialist
call, recorded `collab spawn failed: no thread with id`, then continued inline. This is a
regression from PR #108's two valid skill runs, both of which completed parallel routing.
It also means the revised output-transport wording was not exercised.

The behavior does not invalidate the grades: each executor completed normally, produced
the requested report, and was judged only on that report. It does weaken the skill's
central process claim, and the three distinct goal misses show that inline fallback did
not preserve the earlier revision's 11/11 coverage.

## Cost and duration

Derived with:

```text
yarn run-stats --tasks audit-quiz-001,audit-quiz-002,audit-quiz-003,audit-goal-001 --since 2026-09-04 --runs
```

| Task | Variant | n | Duration median (range) | Tokens median (range) |
| --- | --- | ---: | --- | --- |
| `audit-quiz-001` | no_skill | 3 | 70s (63–70) | 27,268 (11,395–29,975) |
| `audit-quiz-001` | with_skill | 3 | 87s (74–88) | 22,943 (21,304–42,573) |
| `audit-quiz-002` | no_skill | 3 | 93s (91–134) | 29,726 (27,776–38,203) |
| `audit-quiz-002` | with_skill | 3 | 102s (89–113) | 38,921 (31,062–42,803) |
| `audit-quiz-003` | no_skill | 3 | 77s (61–98) | 15,243 (10,802–23,079) |
| `audit-quiz-003` | with_skill | 3 | 83s (73–84) | 22,767 (20,842–27,727) |
| `audit-goal-001` | no_skill | 3 | 180s (158–251) | 32,399 (28,350–52,634) |
| `audit-goal-001` | with_skill | 3 | 187s (174–195) | 40,179 (39,567–42,977) |

Within this sitting, the skill added 4–24% median duration except on no task where it
reduced duration. Token effects ranged from a 16% reduction on quiz 001 to increases of
31% on quiz 002, 49% on quiz 003, and 24% on the goal. Codex reports no dollar cost.

The earlier skill in PR #108 cost 1.6–2.3x time and 1.4–2.1x tokens. Current absolute
medians are substantially lower, but the baseline arm also became faster, so cross-sitting
ratios are context rather than a controlled attribution. The controlled conclusion is
that this revision reduced the within-sitting penalty to near parity in time, while still
adding tokens on three tasks.

## Task review and recommendations

No prompt or `expect:` edit is supported. The direct quizzes remain mostly saturated,
but quiz 003 reproduced its one baseline discriminator. The goal continues to separate
unprompted application and exposed three different omissions in the minimized skill arm.
Task-note edits made before this sitting correctly describe the pinned checklist source
and opt-in publication policy; they do not change the grading surface.

The next skill edit should make fallback behavior explicit: attempt specialists for a
full audit, but if collaboration is unavailable, execute a domain-by-domain checklist
pass with a compact coverage ledger before synthesis. The skill should also require the
final coverage pass to include external-call ordering, chain-specific clocks, and L2
sequencer controls when those domains were routed. Do not restore the mutable master URL
or automatic issue filing.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Quizzes: `9/9 vs 8/9`; goal planted findings: `30/33 vs 29/33` |
| Did it reduce time/tokens? | Time remained higher: quiz medians `87/102/83s vs 70/93/77s`, goal `187s vs 180s`; tokens fell only on quiz 001 and rose on the other three tasks |
| Did it create negative deltas? | Yes: 4–24% more median time and 24–49% more tokens on three tasks; goal coverage fell from the prior revision's valid `11/11` runs to `10/11` in all three |
| What mistakes repeated without the skill? | `audit-withdraw-reentrancy-ordering-missed`, `audit-cached-domain-separator-missed`; the non-repeated omission is recorded as `audit-liquidate-all-unbounded-loop-missed` |
| What mistakes remained with the skill? | `audit-withdraw-reentrancy-ordering-missed`, `audit-block-number-clock-missed`, `audit-sequencer-liveness-missed`, `audit-subagent-fanout-not-executed` |
| What should change in the skill? | Add an explicit no-collaboration fallback and a compact final domain-coverage ledger before synthesis |
| What should change in the eval? | No grading change; retain the task-note updates for pinned checklist provenance |
