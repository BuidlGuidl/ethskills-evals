# indexing-quiz-003 (minimized skill)

Executor/judge: claude `claude-opus-5`. Runs: 3/variant. Skill under test: `skills/indexing` after the 2026-08-18 minimal rewrite. All runs report `self_judged: true` because executor and judge run on the same agent and model, although every grade ran in a fresh blind process.

| Variant | Pass |
| --- | --- |
| no_skill | 3/3 |
| with_skill | 3/3 |

This is the negative-delta guard: the minimized skill leads with "index, don't scan", so the risk was that a with_skill run would index a current-state read. It did not. All six runs rejected the balance-reconstructing subgraph, chose live `balanceOf` reads, and specified one aggregated request for the 40 tokens (Multicall3 or a provider balances endpoint). The skill triggered on its own in 3/3 with_skill runs.

Cost per run: with_skill $0.30 avg (5.3 turns), no_skill $0.35 avg (4.0 turns).

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 3/3` |
| Did it reduce time/tokens? | no meaningful difference ($0.30 vs $0.35 avg, n=3) |
| Did it create negative deltas? | none — no with_skill run over-indexed, which is what this task exists to catch |
| What mistakes repeated without the skill? | none |
| What mistakes remained with the skill? | none |
| What should change in the skill? | nothing; the one-paragraph current-state rule carries the same weight as the two sections it replaced |
| What should change in the eval? | nothing; keep it in every re-run as the counterweight to quiz-001 |
