# indexing-quiz-002 (minimized skill)

Executor/judge: claude `claude-opus-5`. Runs: 3/variant. Skill under test: `skills/indexing` after the 2026-08-18 minimal rewrite, which added what this task grades: the hosted-service sunset, the Studio -> publish -> API-key path, the current CLI, and the pricing with a re-check nudge. All runs report `self_judged: true` because executor and judge run on the same agent and model, although every grade ran in a fresh blind process.

| Variant | Pass |
| --- | --- |
| no_skill | 3/3 |
| with_skill | 3/3 |

No run recommended the hosted service, and none called production queries free. Every run gave the two-step Studio -> publish path, tied production queries to a Studio API key, and landed the budget in the right ballpark with a named source. The failure mode the rewrite created — a with_skill run reciting the skill's pricing line instead of checking it — did not appear: all three with_skill runs still fetched live sources (10, 18 and 16 web calls), which is what the skill's "re-read the live pricing page" line asks for.

Both variants lean heavily on the live web here (no_skill 19-20 web calls per run), so this task measures research ability at least as much as retained knowledge. The one visible skill effect is how much research it takes: with_skill 20.7 turns / $0.86 avg against no_skill 26.3 turns / $1.20 avg — the skill front-loads the answer shape and the runs spend less time discovering it. n=3, so directional only.

One with_skill run (`2026-08-19T033814Z-claude-with-skill-3`) never invoked the skill and passed anyway; the other two invoked it.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 3/3` |
| Did it reduce time/tokens? | yes, directionally: $0.86 vs $1.20 avg, 20.7 vs 26.3 turns, 14.7 vs 19.7 web calls (n=3) |
| Did it create negative deltas? | none — no with_skill run substituted the skill's pricing figure for a live check |
| What mistakes repeated without the skill? | none |
| What mistakes remained with the skill? | none |
| What should change in the skill? | nothing now; the pricing line carries a date and a re-check instruction, so it ages loudly rather than silently. Re-validate the figure whenever this task is re-run |
| What should change in the eval? | to separate retained knowledge from research ability, run one network-disabled pair as its own benchmark; as it stands both variants answer from the live web |
