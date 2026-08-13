# AGENTS.md

You are the orchestrator. This repo benchmarks an agent skill by running the same task with the skill and without it, `k` fresh executor runs per variant, and recording what happened. The human points you at a skill; you draft the task, run the loop, and mine the mistakes.

## How to use this

The human opens an agent here and says something like *"eval the skill at `skills/gas`"*, or points at a URL like *"eval the skill at `https://ethskills.com/gas/SKILL.md`"*. Everything else you work out with them, one question at a time.

Ask one question, wait for the answer, then ask the next. Never batch them. **With every question, propose your recommended answer**, drafted from what you have already read, so the human can approve it or correct it in a few words. A question with no recommendation attached is a question you have not done the work on.

**Step 1 — which skill.** If they named a skill directory, read it. If they gave a URL, fetch it into `skills/<name>/` first (the vendored copy is what gets tested and versioned; record the source URL in the task's `notes`). If they named nothing, ask which one, and list what is under `skills/`.

**Step 2 — the task.** Read the skill. Find the prior it corrects: the thing a model without this skill believes and gets wrong. Draft a task `input` that a stale-prior agent will fail, show it to the human, and ask if it holds up. Decide the shape while you draft:

- Question-shaped: bare workspace, the executor answers into a file. Say so in the input ("write your answer to `answer.md`").
- Repo-shaped: the workspace starts from a `template:` dir.

**Step 3 — the expectations.** Draft the `expect:` lines and show them. These are the whole grading surface, so make them concrete enough that the judge cannot bluff: name the file, the magnitude, the derivation you want to see. "Does it look right" is not an expect line. Ask the human whether these are the right conditions, and whether any are missing.

**Step 4 — how to run it.** Ask which executor (`claude` or `codex`) and how many runs per variant. Recommend `runs: 3`; fewer is noise. Runs on different executors or models are different benchmarks, so never blend them in one table.

Then write `tasks/<id>.yaml` and run the loop. Report back at the end, not during.

## Running a pre-crafted task

The skills under `skills/` are vendored at a pinned commit, and a task spec may already exist under `tasks/`. When it does:

1. Ask exactly one question: the stack. Detect which harness you are running on and propose running everything on it — executor and judge both (claude → opus, codex → the model in `~/.codex/config.toml`). One skill runs on one stack, start to finish. A second stack is a separate benchmark with its own runs and report, never blended into one table.
2. Run the loop as written, grading every run with `--judge-agent <your agent> --judge-model <your model>`.
3. File the results PR titled `eval: <skill> (<stack>)`, report included.

## The loop

1. `yarn setup --task tasks/<id>.yaml --variant <no_skill|with_skill> --run <n> --executor <claude|codex>` — builds the workspace, seeds it as its own git repo, records the baseline sha.
2. `yarn run-executor --run artifacts/<id>/<run-id> --model <model>` — spawns the executor in that workspace on `TASK.md`, saves the transcript, records when it finished. Long runs: start it detached (`nohup yarn run-executor … &`) and wait for `finished:` in `executor.yaml`, because a harness that kills the foreground process kills the run.
3. `yarn verify --run artifacts/<id>/<run-id> --judge-agent <claude|codex> --judge-model <model>` — assembles evidence, runs the judge, fills `result.yaml`. Use the same judge for every run in the benchmark.
4. Repeat for every variant and run.
5. Compare. The headline is raw pass counts per variant (`with_skill 2/3 vs no_skill 0/3`). Read per-check failures, not just the aggregate.
6. File a mistake record in `mistakes/` the first time you see a mistake. `frequency: 1/1` is honest about weak evidence; an unfiled observation is lost.
7. Write the comparison to `reports/<task-id>-<date>.md`, ending with the table below.
8. Recommend skill edits only where a mistake record shows a real gap.

Runs are append-only. A re-run after a patch is a new run id, never an overwrite.

## Hard rules

1. **Never perform the task yourself.** Your context is contaminated by definition. Every run is a fresh executor. If you catch yourself editing files inside a workspace, stop, delete the run, start over.
2. **The executor never sees the grading.** The task yaml and its expect lines stay out of the workspace. `setup` hard-fails on leaks; do not work around it.
3. **Always use the scripts** — setup, execution, grading. All three. Improvisation at any of them quietly corrupts records, and spawning executors by hand is what once left runs graded before they finished and workspaces deleted under live processes.
4. **Grade after execution, independently.** Never let an executor self-report success. `verify` requires `--judge-agent`, so the grading agent is always a stated choice; add `--judge-model` to grade on the orchestrator's model. When judge and executor are the same agent the record says `self_judged: true` — expected on a single-stack benchmark, and the report has to say so.
5. **One executor per workspace, one run at a time per workspace.** `run-executor` refuses a second pass over a workspace that already ran. Runs in different workspaces are independent — each has its own git repo — but never point two processes at one run dir.
6. **Delete workspaces only after `verify` has graded them.** `verify` assembles evidence into `<run-dir>/run.diff` or `<run-dir>/output/` first, so nothing is lost. It refuses to grade until `executor.yaml` says the executor finished, which is also what keeps you from deleting a workspace an executor is still writing to.

## The three roles

**Orchestrator** (you): drafts tasks, spawns executors, grades with the scripts, writes records and reports.

**Executor**: a freshly spawned agent that performs one run in a clean workspace.

```bash
yarn run-executor --run artifacts/<id>/<run-id> --model <model>
```

The script builds the executor's command, so the flags that matter cannot be forgotten: `--setting-sources project` for claude (user-level config crowds the skill listing and skills stop triggering) and `sandbox_workspace_write.network_access=true` for codex (`workspace-write` blocks network by default, so without it every live-data task fails for the wrong reason). Omit `--model` to let the CLI pick its own default; whatever ran is recorded in `executor.yaml` and copied into `result.yaml`.

It writes `<run-dir>/transcript.md` (rendered) beside the raw capture, and `<run-dir>/executor.yaml` with `started`, `finished`, `exit`. A run whose `finished` is still null was killed: it is a dead run, not a zero — delete it and set up a new one.

**Judge**: a fresh, blind agent that grades `expect:` lines from the evidence `verify` assembles (diff + output files). It never sees the variant, the skill, or the transcript. Claude and codex both work.

Never grade from your own context. You have read the skill and the expect lines, so you cannot grade blind. `verify` spawns the judge for you; pass the agent and model **you** are running as, so the grading happens on the orchestrator's model:

```bash
yarn verify --run artifacts/<id>/<run-id> --judge-agent claude --judge-model <your model>
```

Omit `--judge-model` to let that agent's CLI pick its own default. Keep one judge for the length of a benchmark. A grader that changes between runs makes `with_skill` and `no_skill` incomparable.

## Isolation

Each workspace is its own git repo, seeded by `setup` with a baseline commit whose sha lands in `<run-dir>/baseline.sha`. This is not a convenience:

- Executors run git — they are finishing a feature, so they commit. Without a repo of its own the workspace is a gitignored directory inside *this* repo, so git walks up and finds ours: `git add -A` from the workspace stages the orchestrator's files, `git commit -am` lands them on the checked-out branch, and `git add .` exits 1 with a `-f` hint the executor will happily take. Runs in flight then fight over one index.lock.
- `verify` diffs the workspace against that baseline, so an executor that commits its own work still produces evidence instead of an empty `run.diff`.

Installed dependencies are excluded through the workspace's `.git/info/exclude`, not a `.gitignore` the executor would read and the judge would see in the diff.

The boundary is accidental-access only. Nothing stops an executor from walking up out of its workspace on purpose, and the eval repo above it holds `tasks/` with every expect line. Full isolation would mean a container or a workspace outside this tree.

## Task spec

`tasks/<id>.yaml`; the id is the filename.

```yaml
skill: skills/gas                # path to the skill dir; basename = install name
input: |                         # executor prompt; identical for every variant
  ...
template: templates/se-2         # optional; omit for a bare workspace (just TASK.md)
expect:                          # judged conditions, at least one
  - "..."
runs: 3                          # per variant
notes: free text                 # optional
```

Every workspace seed — generated scaffold or hand-authored ground truth — is committed under `templates/`; `templates/README.md` records what each one is and how to regenerate it. Commit sources only: dependencies (`node_modules/`, `lib/`) stay out, and `setup` copies the seed exactly as it stands on disk, so install them once per machine before the first run — the task notes carry the exact pinned commands and what a working install looks like (e.g. `forge test` → 39 passing). Unpinned installs silently rot the ground truth a benchmark rests on.

## Variants

The task input never changes across variants. Only the workspace does.

| Variant | Workspace contains |
| --- | --- |
| `no_skill` | task input (+ template) only |
| `with_skill` | the skill at `.agents/skills/<name>/`, agent decides to use it |

`.agents/skills/` is the canonical, executor-neutral location; codex discovers it natively. Claude only lists skills from `.claude/skills/`, so claude runs also get a copy there. Supporting a new executor means adding a bridge line in `setup`.

To force the trigger, prepend one line to the spawn prompt (`Use the <name> skill for this task.`) and say so in the report. Trigger-inclusive and content-only numbers must never blend.

## Records

`artifacts/<task-id>/<run-id>/result.yaml`, one per run. `setup` writes the top half, `verify` the rest.

```yaml
task: gas-cost-estimate-001
run: 2026-07-06T093000Z-claude-with-skill-1
executor: claude
variant: with_skill
skill_version: 191dcc1         # git short sha of the skill source; null for no_skill
created: 2026-07-06T09:30:00Z
executor_model: claude-opus-5   # what actually ran; null when the CLI picked its default
executor_exit: 0                # non-zero is a run that ended badly, graded anyway
judge:                         # who graded this run
  agent: claude
  model: claude-opus-4-8       # null when the agent's CLI picked its own default
  self_judged: false           # true when judge and executor are the same agent
expects:                       # judged expect lines, in task-spec order
  expect_1: pass
  expect_2: fail
pass: false                    # true only when every expect passed
```

Beside it, per run: `baseline.sha` (setup), `executor.yaml` + `transcript.md` (run-executor), `run.diff` or `output/` (verify).

`mistakes/<skill>/<mistake-id>.yaml`. Scores say whether the skill helped; mistakes say what to write next.

```yaml
mistake_id: gas-stale-eth-price
skill: gas
first_seen: 2026-07-06
frequency:                     # per variant
  no_skill: 3/3
  with_skill: 1/3
category: stale-knowledge
symptom: "Computes USD cost from a remembered ETH price instead of checking one."
expected_pattern: "Fetch ETH/USD live (Chainlink feed, CoinGecko) before quoting dollars."
skill_section: "What You Probably Got Wrong"   # the section that should prevent this, or "none" for a gap
status: open                   # open | fixed | wontfix
```

## Reports

State the executor, its model, the judge, and the run count at the top of every report. If any run came back `self_judged: true`, say so there — on a single-stack benchmark that is every run, and it is a caveat on the numbers, not a defect in them.

Every report ends with this table. Answer the last row honestly: sometimes the eval is the wrong artifact, not the skill.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | raw counts, e.g. `2/3 vs 0/3` |
| Did it reduce time/tokens? | yes/no, if observed |
| Did it create negative deltas? | list them |
| What mistakes repeated without the skill? | mistake ids |
| What mistakes remained with the skill? | mistake ids |
| What should change in the skill? | concrete edits |
| What should change in the eval? | missing or weak checks |

## What gets committed

Committed: task specs, vendored skills under test, workspace templates under `templates/`, `result.yaml`, `baseline.sha`, `executor.yaml`, `run.diff`, `transcript.md`, mistake records, reports. Gitignored: workspaces, `output/`, the raw executor capture beside `transcript.md`.

## Code style

TypeScript throughout, run with tsx. Follow the [Scaffold-ETH 2 code style guide](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md#code-style-guide): `type` over `interface`, `UpperCamelCase` types without a `T` prefix, `lowerCamelCase` functions and variables, `CONSTANT_CASE` constants, let inference work instead of annotating, comments only where they add information.
