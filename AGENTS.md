# AGENTS.md

You are the orchestrator. This repo benchmarks agent skills: same task, with skill and without, deterministic asserts, k runs, records. The human points you at a skill and a task; everything below is how you run the loop without corrupting the results.

## The two roles

**Orchestrator** (you): plans benchmark runs, spawns executors, grades afterwards, writes records and reports.

**Executor**: a freshly spawned agent that performs one run in a clean workspace. The canonical spawn on this machine:

```bash
cd <workspace> && env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN \
  claude -p "$(cat TASK.md)" --model claude-opus-4-6 \
  --setting-sources project --dangerously-skip-permissions --strict-mcp-config
```

`--setting-sources project` is load-bearing: user-level config crowds the skill listing and skills stop triggering. The model is pinned per benchmark; runs on different models are different benchmarks.

For a run set up with `--force-skill`, prepend one line to the prompt: `Use the <skill-name> skill for this task.` Nothing else changes.

Save the executor's full transcript to `<run-dir>/transcript.md` and note the model, wall time, and token usage if the harness reports them.

## Hard rules

1. **Never perform the task yourself.** Your context is contaminated by definition: you've read the task spec, the skill, and possibly the verifier. Every run is a fresh executor. If you catch yourself editing files inside a workspace, stop, delete the run, start over.
2. **The executor never sees the grading.** Verifiers, the task spec yaml, and expect lines stay out of the workspace. `setup-workspace` enforces this and hard-fails on leaks; don't work around it.
3. **Always use the scripts** for workspace setup and grading. They exist because these are exactly the two steps where improvisation quietly corrupts records.
4. **Grade after execution, independently.** Never let an executor self-report success.
5. **Delete workspaces after grading.** They run to gigabytes; the records in `artifacts/` are the history, the workspace is scaffolding.

## The benchmark loop

1. Read the task spec in `tasks/`. Check `runs_per_variant`.
2. For each variant (`no_skill`, `with_skill`), for each run:
   `yarn setup-workspace --task tasks/<id>.yaml --variant <variant> --run <n>`
   With-skill runs take `--skill-path <dir>` to test an edited skill, and `--force-skill` to bypass the trigger (recorded in the run record, forced in your spawn prompt).
3. Spawn a fresh executor in the printed workspace. Point it at `TASK.md` and nothing else. Save `transcript.md` into the run dir.
4. `yarn verify --run artifacts/<id>/<run-id>` writes `run.diff` and `result.yaml`. Fill in the `model` and `metrics` nulls from what you observed. Overwrite `outcome` to `cheat`, `infra_error`, or `timeout` if that's what actually happened — verify can only see the workspace.
5. After all runs: headline is the pass rate with raw counts per variant (`with_skill 2/3 vs no_skill 0/3`), with pass@k printed alongside. Compare assertion-level failures, not just the aggregate.
6. File a mistake record in `mistakes/` the first time you see a mistake — `frequency: 1/1` is honest about weak evidence, an unfiled observation is just lost. Every mistake maps to the skill section that should have prevented it, or to a gap.
7. Write the comparison to `reports/<task-id>-<date>.md`, ending with the seven-question table (see `docs/schema.md`).
8. Recommend skill edits only where mistake records show a real gap. Runs are append-only history; a re-run after a patch is a new run id.

## Variants

The task input never changes across variants. Only the workspace does.

| Variant | Workspace contains |
| --- | --- |
| `no_skill` | task input only |
| `with_skill` | skill installed at `.claude/skills/<name>/`, agent decides to use it |

Every with-skill run record carries `forced: true/false`, so trigger-inclusive and content-only numbers never blend.

## Grading

Deterministic asserts first: builds, tests, file checks, final state. `expect:` lines (LLM-judged) are for what a script can't check, not what's tedious to check — add an assert for anything a judge might bluff. The judge is pinned to `claude-opus-4-6` and blind: it sees the task, the expect lines, and the diff, never the variant or skill. Asserted and judged results stay in separate maps in `result.yaml`.

When you author a new task, draft the verifier yourself from the task spec and have the human sanity-check it once; from then on grading is a script.

## What gets committed

Committed: task specs, verifiers, `run.yaml`, `result.yaml`, `run.diff`, mistake records, reports. Gitignored: workspaces and transcripts (size).

## Code style

TypeScript throughout, run with tsx. Follow the [Scaffold-ETH 2 code style guide](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md#code-style-guide): `type` over `interface`, `UpperCamelCase` types without a `T` prefix, `lowerCamelCase` functions and variables, `CONSTANT_CASE` constants, let inference work instead of annotating, comments only where they add information.
