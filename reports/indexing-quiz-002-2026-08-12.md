# indexing-quiz-002

Executor/judge: codex `gpt-5.6-terra`. Runs: 3/variant. All runs report `self_judged: true` because executor and judge use the same harness, despite fresh judge processes.

| Variant | Pass |
| --- | --- |
| no_skill | 3/3 |
| with_skill | 3/3 |

Before execution, live Graph docs were rechecked: hosted service remains sunset; Studio docs/pricing still state 100K free monthly queries and $2/100K thereafter. Every run gave Studio -> Network -> API-key, paid-beyond-free guidance and did not make GRT a strict per-query requirement. Transcripts show web checks in all runs, so this is partly current-web capability rather than skill-only knowledge.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 3/3` |
| Did it reduce time/tokens? | no; not measured reliably |
| Did it create negative deltas? | none |
| What mistakes repeated without the skill? | none |
| What mistakes remained with the skill? | none |
| What should change in the skill? | none from this task |
| What should change in the eval? | consider recording/controlling live-web use if measuring retained knowledge rather than research ability |
