# orchestration-quiz-001

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 per variant. All runs were self-judged, so the blind judge was a fresh process on the same stack; treat this as a caveat.

`with_skill` passed 3/3 and `no_skill` passed 0/3. Every no-skill answer preserved the ticket's false premise that an explorer key must arrive from ops. Two no-skill runs also weakened the prescribed command or timing. The with-skill answers read the installed skill and consistently used `yarn verify --network base`, rejected the key wait, and said to verify now.

The claim was revalidated before execution against `create-eth@2.0.23`: the generated Foundry project still includes the default `ETHERSCAN_API_KEY`, copies the example environment file on postinstall, and exposes `yarn verify` through its Foundry package script.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 0/3` |
| Did it reduce time/tokens? | no consistent reduction observed |
| Did it create negative deltas? | none |
| What mistakes repeated without the skill? | `orchestration-stale-verification-key` |
| What mistakes remained with the skill? | none |
| What should change in the skill? | Keep the Phase 2 no-key/immediate-verification rule. |
| What should change in the eval? | None; it intentionally ceilings only when agents independently discover the current SE2 behavior. |
