# indexing-quiz-001 (minimized skill)

Executor/judge: claude `claude-opus-5`. Runs: 3/variant. Skill under test: `skills/indexing` after the 2026-08-18 minimal rewrite (318 lines -> 24). All runs report `self_judged: true` because executor and judge run on the same agent and model, although every grade ran in a fresh blind process.

| Variant | Pass |
| --- | --- |
| no_skill | 3/3 |
| with_skill | 3/3 |

Same result as the codex round on the original skill: every run rejected the one-shot full-history `eth_getLogs`, derived a page count from a stated cap against the refreshed ~25.8M height, named rate limits/timeouts/credits as the first failure, and moved the historical read to an indexer while keeping "top holders right now" as a current-state read. No run reached for an archive node. No web searches in any run — this is parametric knowledge on both variants.

The skill triggered on its own in 3/3 with_skill runs (`Skill(indexing)` in the transcript), so the sharper `description` from the rewrite is firing.

Cost per run (CLI-reported, includes cache reads): with_skill $0.44 avg (5.3 turns), no_skill $0.52 avg (4.0 turns). The skill costs a turn to load and reads back slightly cheaper; at n=3 treat this as no meaningful difference.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 3/3` |
| Did it reduce time/tokens? | no meaningful difference ($0.44 vs $0.52 avg, n=3) |
| Did it create negative deltas? | none |
| What mistakes repeated without the skill? | none |
| What mistakes remained with the skill? | none |
| What should change in the skill? | nothing from this task; the trimmed opening paragraph held every check the long version held |
| What should change in the eval? | nothing; it stays as a regression guard, not a source of deltas — it does not discriminate on this stack |
