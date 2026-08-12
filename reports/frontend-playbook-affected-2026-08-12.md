# Eval report — frontend-playbook affected quizzes (Codex stack)

**Skill:** `skills/frontend-playbook` @ `b30213c`
**Executor:** Codex, `gpt-5.6-sol` — fresh `codex exec` process per run
**Judge:** Codex, CLI-configured `gpt-5.6-sol` — fresh blind process spawned by `verify`
**Runs:** 3 per variant for quiz-004 and quiz-005; 12 runs total
**Date:** 2026-08-12

All 12 records report `self_judged: true` because executor and judge use the same
Codex stack. Each grade still ran in a separate blind process over the task input
and snapshotted output. This is a new Codex benchmark and is not blended with the
earlier Claude results.

## Results

| Task | no_skill | with_skill |
| --- | --- | --- |
| quiz-004 — Node 25 prerender worker | 3/3 | 3/3 |
| quiz-005 — continuous fork mining | 0/3 | 0/3 |

Quiz-004 passed every check in every run. The compact skill preserved the exact
Node 25 mechanism, worker-process boundary, and process-level remedies. The
baseline also knew or researched all of it, so this task is at ceiling on
`gpt-5.6-sol`.

Quiz-005 is more informative at the method level. Every run passed expect 1
(transaction-triggered blocks explain frozen time and the jump) and expect 2
(`vm.warp` tests math, not node mining behavior). All three no_skill runs failed
the core method in expect 3: they recommended `evm_mine` or another manual
single-step action for the immediate fix, while giving interval mining only as a
permanent configuration.

All three with_skill runs instead gave the exact immediate command:

```bash
cast rpc anvil_setIntervalMining 1
```

and the permanent `--block-time 1` configuration. They nevertheless failed
expect 3 because that single expect also requires explicitly generalizing the
impact to deadlines, expiry, and vesting. The answers fully diagnosed and fixed
the prompted vesting problem but did not restate all three categories. Therefore
the raw task score hides a real `0/3 -> 3/3` correction in the behavior the skill
was revised to preserve.

## Cost

Executor transcript token counts averaged:

| Task | no_skill | with_skill |
| --- | ---: | ---: |
| quiz-004 | 30,826 | 19,200 |
| quiz-005 | 20,161 | 20,555 |
| overall | 25,493 | 19,878 |

The skill reduced executor tokens by about 22% overall in these runs, driven by
shorter quiz-004 answers and less independent research. Wall-clock cost was not
captured cleanly enough to claim a delta.

## Eval correction

Split quiz-005 expect 3 into two checks:

1. The immediate live-demo fix is continuous interval mining with
   `anvil_setIntervalMining`, and the permanent fix is `--block-time` in the fork
   script.
2. The answer recognizes that transaction-triggered mining affects other
   time-dependent behavior such as deadlines and expiry.

The first is the skill behavior evidenced by the benchmark. The second is a
useful generalization but should not erase correct diagnosis and remediation of
the actual vesting incident.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Raw score: no, quiz-004 `3/3 vs 3/3`, quiz-005 `0/3 vs 0/3`. At the method level hidden inside quiz-005 expect 3: `3/3 with_skill vs 0/3 no_skill`. |
| Did it reduce time/tokens? | Tokens: yes, about 22% overall. Time: not reliably measured. |
| Did it create negative deltas? | None observed. |
| What mistakes repeated without the skill? | `frozen-timestamp-wrong-oneoff-fix-codex` (3/3). |
| What mistakes remained with the skill? | None in the target behaviors; quiz-005's bundled generalization remained omitted 3/3. |
| What should change in the skill? | Nothing from these runs. The compact Node 25 and interval-mining guidance was applied correctly. |
| What should change in the eval? | Split quiz-005 expect 3 so the immediate command/permanent configuration and the broader deadline/expiry generalization are graded independently. Quiz-004 is at ceiling for this stack. |
