# skill-eval-framework

Benchmarks whether an agent skill actually makes the agent better at the task it claims to improve. The headline number is the skill delta: pass rate with the skill minus pass rate without it, on the same task input. The framework is equally interested in the follow-up question, because that's what keeps a skill library maintainable: when the skill didn't help, what did the model get wrong, and which part of the skill should change?

## How it works

There is no runner. Whatever coding agent you already drive (Claude Code, Codex, anything that reads `AGENTS.md`) orchestrates the benchmark loop, and two small scripts guard the steps where improvisation would corrupt results:

- `yarn setup-workspace` builds a clean workspace for one task variant. It decides what the executor is allowed to see, and it hard-fails if a verifier would leak in.
- `yarn verify` grades a finished run and writes a schema-valid result record.

Your agent plans runs, spawns fresh executor agents into those workspaces, grades with `verify`, and mines the failures into mistake records. It never performs the task itself. `AGENTS.md` is the full playbook; `docs/schema.md` is the record reference.

## Layout

```
tasks/        task specs (yaml, one per task)
verifiers/    grading code, never enters a workspace
skills/       checked-out skill versions under test
artifacts/    run output: run.yaml + result.yaml + run.diff committed,
              workspaces and transcripts gitignored
mistakes/     mistake records mined from failed assertions
reports/      markdown comparisons across variants
scripts/      setup-workspace and verify
```

## Adding a task

1. Write `tasks/<id>.yaml` following `docs/schema.md`. Same `input` for every variant, that's the whole point.
2. Write a verifier in `verifiers/` that default-exports a `Verifier` (see `lib/types.ts`). Deterministic checks wherever possible.
3. Run the loop with your agent, or by hand:

```bash
yarn setup-workspace --task tasks/<id>.yaml --variant no_skill --run 1
# spawn a fresh executor agent in the printed workspace, let it work, save its transcript
yarn verify --run artifacts/<id>/<run-id>
```

## Reading a report

Every report in `reports/` ends with the same seven questions: did the skill improve pass rate, did it cost less time/tokens, did it make anything worse, which mistakes repeated without it, which remained with it, what should change in the skill, and what should change in the eval. That last one matters. Sometimes the eval is the wrong artifact, not the skill.

## Certification

Skill authors iterate against the committed task cases. Before a skill change ships, a reviewer runs the same verifier against a small held-out case set (`expected-private/`, gitignored, lives only on the reviewer's machine). Fixing the skill until the public cases pass proves nothing about generalization, and the held-out set is what keeps everyone honest about that. If you're writing skills: assume it exists, don't ask what's in it.
