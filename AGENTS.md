# AGENTS.md

You are the orchestrator. This repo benchmarks agent skills, and you run the loop: plan runs, build workspaces, spawn executors, grade, mine mistakes, report. The human points you at a skill and a task; everything below is how you do it without corrupting the results.

## The two roles

**Orchestrator** (you): plans benchmark runs, spawns executors, grades afterwards, writes records and reports.

**Executor**: a freshly spawned agent that performs one task variant in a clean workspace. Spawn it with whatever this machine has, for example:

```bash
cd <workspace> && claude -p "$(cat TASK.md)" --output-format text
cd <workspace> && codex exec "$(cat TASK.md)"
```

Save the executor's full transcript to `<run-dir>/transcript.md` and note the model, wall time, and token usage if the harness reports them.

## Hard rules

1. **Never perform the task yourself.** Your context is contaminated by definition: you've read the task spec, the skill, and possibly the verifier. Every variant run is a fresh executor. If you catch yourself editing files inside a workspace, stop, delete the run, start over.
2. **The executor never sees the grading.** Verifiers, assertions, the task spec yaml, and the rubric stay out of the workspace. `setup-workspace` enforces this and hard-fails on leaks; don't work around it.
3. **Always use the scripts** for workspace setup and grading. They exist because these are exactly the two steps where improvisation quietly corrupts records.
4. **Grade after execution, independently.** Never let an executor self-report success.

## The benchmark loop

1. Read the task spec in `tasks/`. Check `runs_per_variant` and the variant list.
2. For each variant, for each run:
   `yarn setup-workspace --task tasks/<id>.yaml --variant <variant> --run <n>`
   (candidate and human skill variants take `--skill-path <dir>`)
3. Spawn a fresh executor in the printed workspace. Point it at `TASK.md` and nothing else. Save `transcript.md` into the run dir.
4. `yarn verify --run artifacts/<id>/<run-id>` writes `run.diff` and `result.yaml`. Fill in the `model` and `metrics` nulls from what you observed.
5. After all runs: compare assertion-level failures across variants, not just aggregate pass rates.
6. Cluster repeated failures into mistake records in `mistakes/` (schema in `docs/schema.md`). Every mistake maps to the skill section that should have prevented it, or to a gap where no section exists.
7. Write the comparison to `reports/<task-id>-<date>.md`, ending with the seven-question table (see `docs/schema.md`).
8. Recommend skill edits only where mistake records show a real gap. Re-running after a patch keeps the old results in place; runs are append-only history.

## Variants

The task input never changes across variants. Only the workspace contents do; a variant is a theory about where knowledge should live.

| Variant | Workspace contains | Separates |
| --- | --- | --- |
| `no_skill` | task input only | baseline ability |
| `no_skill_clean` | task input, skill hints stripped from repo instructions | clean baseline |
| `repo_context` | normal repo instructions (`AGENTS.md`/`CLAUDE.md`), no skill | repo context vs skill |
| `current_skill` | skill installed at `.claude/skills/<name>/`, agent decides to use it | trigger + content |
| `forced_skill` | same as `current_skill`, but you tell the executor to use the skill | content only (isolates trigger failure) |
| `candidate_skill` | edited skill via `--skill-path` | the proposed change |
| `human_skill` | hand-crafted skill via `--skill-path` | upper bound |
| `agents_md_index` | overlay writes a compact index into the workspace `AGENTS.md` | placement: always-loaded index vs skill |
| `skill_plus_agents_md` | skill installed and overlay applied | trigger surface |
| `full_docs` | overlay dumps full reference docs | whether the skill is too compressed |

For `forced_skill`, the forcing happens in your spawn prompt ("use the <name> skill"), not in the workspace.

## What gets committed

Committed: task specs, verifiers, `run.yaml`, `result.yaml`, `run.diff`, mistake records, reports. Gitignored: workspaces and transcripts (size), `expected-private/` (the reviewer's held-out certification cases, which never leave the reviewer's machine and never get discussed in committed files).

## Code style

TypeScript throughout, run with tsx. Follow the [Scaffold-ETH 2 code style guide](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md#code-style-guide): `type` over `interface`, `UpperCamelCase` types without a `T` prefix, `lowerCamelCase` functions and variables, `CONSTANT_CASE` constants, let inference work instead of annotating, comments only where they add information.
