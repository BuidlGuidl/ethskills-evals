# indexing-goal-001

Executor/judge: codex `gpt-5.6-terra`. Runs: 3/variant. All runs report `self_judged: true` because executor and judge use the same harness, despite fresh judge processes.

| Variant | Pass |
| --- | --- |
| no_skill | 0/3 |
| with_skill | 3/3 |

All six builds were event-first and used indexed historical reads; no leaderboard sorting leaked onchain. Every no-skill run failed only expect_5: its bespoke SQLite/indexer read side had no concrete production deployment target/command. With-skill runs chose Graph subgraphs and named Studio/Graph Node deployment paths and commands. Record: `indexing-read-side-deploy-omitted`.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 0/3` |
| Did it reduce time/tokens? | no; not measured reliably |
| Did it create negative deltas? | none |
| What mistakes repeated without the skill? | `indexing-read-side-deploy-omitted` |
| What mistakes remained with the skill? | none |
| What should change in the skill? | none; deploy guidance prevented the observed omission |
| What should change in the eval? | none; expect_5 isolated the deploy-plan delta cleanly |
