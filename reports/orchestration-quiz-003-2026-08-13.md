# orchestration-quiz-003

Executor: Codex `gpt-5.6-terra`. Judge: Codex `gpt-5.6-terra`. Runs: 3 per variant. All runs were self-judged — one stack start to finish, each grade a fresh blind process on the same model — a caveat on the comparison.

Two run sets, both on 2026-08-13. The first is void; the second is the result. Both stay in `artifacts/`, runs being append-only.

## Result — second set (`2026-08-13T1455*`)

`no_skill` 3/3, `with_skill` 3/3. All four checks passed in all six runs.

This is the pre-registered deletion test for the skill's scaffold-hooks block, and both arms clear it: the SE2 workspace's own `AGENTS.md` is enough to make the agents use scaffold reads, writes, event history and generated identity. The workspace also ships nine create-eth skills of its own under `.agents/skills/` — none of them about SE2 phases, hooks or verification, but worth stating: `no_skill` here means "without this skill", not "without any".

By the decision rule registered in the task before the runs, and by the first row of the verdict matrix in #1: **the block is dead weight, delete it from the skill.**

## Why the first set (`2026-08-13T12*`) is void

It read `no_skill` 3/3, `with_skill` 1/3 — an implausible inversion, and it was one.

Both `with_skill` failures were the same check, expect_4, which read "…and `deployedContracts.ts` is not hand-edited". Neither run had hand-edited it: the added entries carry `inheritedFunctions` and `deployedOnBlock`, fields written by `generateTsAbis.js`, and the transcripts show `yarn deploy` and the generator running. The task's own notes had already declared that path the executor's call and ungraded.

The judge could not have got this right. It grades a diff, and a diff shows a file's text, not its origin — a generated registry and a hand-written one are identical there. The check asked about something the evidence does not contain.

Fixed in `3f2ee01`: expect_4 now grades only what a diff can answer (no address or ABI literals in components; changes to `deployedContracts.ts` out of scope). The same commit stopped the input asking for committed code, which codex's `workspace-write` sandbox forbids — every run of the first set reported it could not commit, three spent turns trying.

Both fixes show up in the second set. One run regenerated the registry and passed, the case that failed twice before. The sandbox complaint went from 6 runs of 6 to none.

## What the transcripts show

The skill's path appears in 2 of 3 `with_skill` transcripts; the third never opened it and passed anyway. The template's `AGENTS.md` is read in both arms.

Tokens, per run: `with_skill` 42.7k / 60.1k / 66.9k against `no_skill` 39.5k / 43.9k / 51.5k — about a quarter more for the same four passes. In the first set the gap was wider (76k against 45k on average), inflated by the deploy-and-regenerate detours.

Only 1 of 6 runs stood up a chain and deployed this time, against 2 of 6 in the first set — installing the template's dependencies beforehand did not push more runs toward deploying, as had been expected.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No. `3/3 vs 3/3` |
| Did it reduce time/tokens? | No — about 26% more tokens per run for the same result |
| Did it create negative deltas? | None graded. One `with_skill` run deployed and regenerated the registry on a frontend-only ticket: extra work, not a failed check (`orchestration-generated-registry-churn`, 1/3 vs 0/3) |
| What mistakes repeated without the skill? | None |
| What mistakes remained with the skill? | `orchestration-generated-registry-churn`, at a third of its earlier frequency and no longer a grading failure |
| What should change in the skill? | Delete the scaffold-hooks block — both arms pass without it. Optionally keep one line of it as a guard: frontend-only work does not deploy or regenerate `deployedContracts.ts` unless deployment was asked for |
| What should change in the eval? | Done for this task: expect_4 no longer grades a file's origin, and the prompt no longer asks codex for a commit its sandbox denies. Still open across the set — this task is named a quiz but grades applies-unprompted in a repo, so its result does not belong in the "quiz" column of #1's matrix; read it as a second goal task |
