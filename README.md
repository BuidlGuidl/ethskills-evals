# ethskills-evals

Evals for every skill in the [ethskills](https://ethskills.com) library, built on [skill-eval-framework](https://github.com/BuidlGuidl/skill-eval-framework).

To run your part: point your [claude code](https://github.com/anthropics/claude-code) or [codex](https://github.com/openai/codex) at this repo and it orchestrates the whole benchmark itself.

## Using it

Two harnesses are supported right now, [claude code](https://github.com/anthropics/claude-code) and [codex](https://github.com/openai/codex), so make sure the ones you'll use are installed. Either can fill any of the three roles in a benchmark: the orchestrator you open here, the executors that perform the runs, and the judge that grades them. Mixing is fine (claude orchestrating, codex executing), and so is running everything on one. Opening it up to opencode and other harnesses is planned.

```bash
git clone https://github.com/BuidlGuidl/ethskills-evals.git
cd ethskills-evals
yarn install
claude   # or codex
```

Then tell it which skill to check:

```
I want to eval the skill at https://ethskills.com/gas/SKILL.md
```

Before anything runs, it interviews you. It reads `AGENTS.md`, drafts a task from the skill and shows it to you, then drafts the `expect:` lines and shows you those. The expect lines are the conditions the judge grades against, so this is the step worth slowing down on; they're the whole grading surface. Last it asks which executor to run and how many runs per variant. One question at a time, each with a recommended answer, so approving the whole thing takes a few words. Everything after that it does on its own.

When the benchmark is done, everything it produced is still on disk, so you can keep asking the orchestrator questions (which run spent more tokens, what the failing run actually wrote) instead of re-running anything.

## Layout

```
ethskills-evals/
├─ AGENTS.md                     the rules; the orchestrator reads this first
├─ skills/                       vendored skill versions under test
├─ tasks/                        task specs, one yaml per task (filename = task id)
├─ scripts/setup-workspace.ts    seeds the clean workspace, hard-fails on grading leaks
├─ scripts/run-executor.ts       spawns the executor on the task, records what it did
├─ scripts/verify.ts             assembles the evidence, spawns the judge
├─ lib/judge.ts                  the blind judge: evidence in, graded expects out
├─ lib/evidence.ts               what the judge reads: the diff, or a snapshot of the files
├─ lib/transcript.ts             one transcript format across executors
├─ lib/workspace.ts              where a workspace lives, its own git repo, the markers
├─ artifacts/                    per run: result.yaml + executor.yaml + transcript.md and
│                                the graded evidence committed; raw executor capture,
│                                question-shaped snapshots and workspace.path gitignored
│                                (workspaces live outside the repo, under ~/.cache/)
├─ mistakes/                     mistake records mined from failures
├─ reports/                      markdown comparisons per benchmark
└─ templates/                    workspace seeds (gitignored; tasks record how to regenerate)

# there is no runner. the orchestrator is
# whatever agent you happen to open here
```

## How it works

A benchmark is the same task run with the skill and without, a fresh executor per run, and raw pass counts per variant as the headline.

The orchestrating agent works from `AGENTS.md`, the full playbook including every record schema. Three small scripts guard the steps where improvisation would quietly corrupt results:

- `yarn setup` builds a clean workspace for one run: task prompt in, skill installed (or not), and a hard fail if any grading material would leak in. The isolation is load-bearing, not hygiene. An executor that knows how it's being judged starts acting smart, so it gets the task and nothing else.
- `yarn run-executor` spawns the executor in that workspace on `TASK.md` alone, builds the CLI invocation so the load-bearing flags cannot be forgotten, saves the transcript, and records when the process finished. A run whose executor was killed stays ungradeable by design: that is a dead run, not a zero.
- `yarn verify` grades a finished run: snapshots the output, has a blind LLM judge grade the task's `expect:` lines against it, and writes `result.yaml`. No judge is baked in; the orchestrator passes `--judge-agent` and `--judge-model`, and `result.yaml` records which judge graded which run.

Every run leaves a record behind: what the executor changed (`run.diff`, or a snapshot of the files for a task with no starting repo), its transcript, `executor.yaml` with the model and the exit, and the graded `result.yaml`. The orchestrating agent never performs the task itself.

Executors are pluggable: `--executor claude` or `--executor codex`. Skills install at the cross-agent standard `.agents/skills/` (codex reads it natively; claude runs get a bridge copy at `.claude/skills/`).

Because the fixed part is this small, the orchestrator can bend the framework into shapes it wasn't written for, like comparing two similar skills from different developers.

## Running a benchmark

```bash
yarn setup --task tasks/<id>.yaml --variant no_skill --run 1 --executor claude
yarn run-executor --run artifacts/<id>/<run-id> --model <model>
yarn verify --run artifacts/<id>/<run-id> --judge-agent claude --judge-model <model>
```

Repeat per variant and run count, then compare `result.yaml`s and write the report. You don't normally type these; the orchestrator does. `AGENTS.md` has the full loop, the intake conversation, and the mistake-record format.
