# indexing-quiz-001

Executor/judge: codex `gpt-5.6-terra`. Runs: 3/variant. All runs report `self_judged: true` because executor and judge use the same harness, despite fresh judge processes.

| Variant | Pass |
| --- | --- |
| no_skill | 3/3 |
| with_skill | 3/3 |

All answers rejected a one-shot full-history `eth_getLogs`, derived pagination from a cap, identified rate-limit/time-out/credit failure, and chose an indexed historical read. The extra append-only no-skill run `2026-08-12T221449Z-codex-no-skill-3` was caused by overlapping orchestration; it passed but is excluded from the 3-run comparison.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 3/3` |
| Did it reduce time/tokens? | no; not measured reliably |
| Did it create negative deltas? | none |
| What mistakes repeated without the skill? | none |
| What mistakes remained with the skill? | none |
| What should change in the skill? | none from this task |
| What should change in the eval? | none; cap/volume derivation is discriminating, but this stack already knows it |
