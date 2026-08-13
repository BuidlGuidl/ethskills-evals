# orchestration-quiz-003

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 per variant. All runs were self-judged, a caveat on the comparison.

This is the pre-registered deletion test. `no_skill` passed all four checks in all 3 runs, so the real SE2 workspace's `AGENTS.md` was sufficient to make the agents use scaffold reads, writes, event history, and generated identity. The block therefore has no demonstrated marginal value here.

`with_skill` passed 1/3. The two failures were not raw-wagmi regressions: both agents unnecessarily ran a local deploy/generation flow and changed `deployedContracts.ts`, failing the no-duplicated-identity check. One run also reformatted broad unrelated frontend code, increasing diff noise. This is a negative workflow delta.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `1/3 vs 3/3` |
| Did it reduce time/tokens? | no; two with-skill runs added deployment/generation work, and one produced broad formatting churn |
| Did it create negative deltas? | `orchestration-generated-registry-churn` |
| What mistakes repeated without the skill? | none |
| What mistakes remained with the skill? | `orchestration-generated-registry-churn` |
| What should change in the skill? | Delete the redundant scaffold-hooks block, per the decision rule. Add one short guard: frontend-only work must not deploy/regenerate `deployedContracts.ts` unless deployment is requested. |
| What should change in the eval? | Keep the identity check, but distinguish generated registry output from hand editing if regeneration is intended to be allowed in a future task. |
