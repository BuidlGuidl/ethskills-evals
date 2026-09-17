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

**Step 4 — how to run it.** Ask which executor (`claude`, `codex` or `opencode`) and how many runs per variant. Recommend `runs: 3`; fewer is noise. Runs on different executors or models are different benchmarks, so never blend them in one table. In the same question, propose the benchmark id every `setup` will carry (see `--benchmark` under "The loop"): the one the human named, or else a readable one you pick, `2026-09-clean` say. One id per comparison, not per task.

Then write `tasks/<id>.yaml` and run the loop. Report back at the end, not during.

## Running a pre-crafted task

The skills under `skills/` are vendored at a pinned commit, and a task spec may already exist under `tasks/`. When it does:

1. Ask exactly one question: the stack. A stack is the agent, the model and the effort. Detect which harness you are running on and propose running everything on it — executor and judge both (claude → opus at the effort you are running at, codex → the model and `model_reasoning_effort` the harness reads out of `~/.codex/config.toml` and passes explicitly, see "The three roles"). An open model is a stack too: `opencode` as executor with the model named as opencode names it (`openrouter/moonshotai/kimi-k3`, `openrouter/z-ai/glm-5.3` — the provider is part of the name, on the site too) at an effort its catalog entry lists (`low`, `high` or `max` for both). If you are opencode yourself, you can orchestrate — the loop below has been run from opencode start to finish — but you cannot judge, so propose a claude or codex judge and name it in every `verify`. One skill runs on one stack, start to finish. A second stack, including the same model at another effort, is a separate benchmark with its own runs and report, never blended into one table. Propose the benchmark id in the same breath — the one the human named, or a readable one you pick — so `setup` has it without a second question.
2. Run the loop as written, grading every run with `--judge-agent <your agent> --judge-model <your model> --judge-effort <your effort>`.
3. File the results PR titled `eval: <skill> (<stack>)`, report included.

## The loop

1. `yarn setup --task tasks/<id>.yaml --variant <no_skill|with_skill|routing> --run <n> --executor <claude|codex|opencode> --benchmark <id>` — builds `<run-dir>/workspace`, seeds it as its own git repo and records the baseline sha in `<run-dir>/baseline.sha`.
2. `yarn run-executor --run artifacts/<id>/<run-id> --model <model> --effort <effort>` — spawns the executor in that workspace on `TASK.md`, saves the transcript, records when it finished. Long runs: start it detached (`nohup yarn run-executor … &`) and wait for `finished:` in `executor.yaml`, because a harness that kills the foreground process kills the run.
3. `yarn verify --run artifacts/<id>/<run-id> --judge-agent <claude|codex> --judge-model <model> --judge-effort <effort>` — assembles evidence, runs the judge, fills `result.yaml`. Use the same judge for every run in the benchmark.
4. Repeat for every variant and run.
5. Compare. The headline is raw pass counts per variant (`with_skill 2/3 vs no_skill 0/3`). Read per-check failures, not just the aggregate.
6. File a mistake record in `mistakes/` the first time you see a mistake. `frequency: 1/1` is honest about weak evidence; an unfiled observation is lost.
7. Write the comparison to `reports/<task-id>-<date>.md`, ending with the table below.
8. Recommend skill edits only where a mistake record shows a real gap.

Runs are append-only. A re-run after a patch is a new run id, never an overwrite.

**`--benchmark <id>` names the comparison a run belongs to**, and every run of one comparison
carries the same id: same task set, same expect lines, same skill text, one model and effort
per column, `k` runs per variant, one judge. The site selects runs by this id, so it is what
keeps a run made for a benchmark apart from a run made by hand a day later on the same model.
Pick one readable name per benchmark, `2026-09-clean` say, and use it for every `setup` in it;
if the benchmark has to start over (a task reworded, so its runs are made again), that is a new
id, and the old runs stay in `artifacts/` under theirs. `setup` refuses to run without one. A
rubric fix is not a restart: its regrades inherit the source run's id, and `expect_sha` is what
tells the readings apart.

**Editing an expect line is the one exception**, and it is still not an overwrite — see
"Revising expect lines" below. A rubric fix is not a new measurement, so re-running the
executor to answer it pays for the wrong thing, and paying it is what makes editing a
task's `input` look cheaper than editing its `expect`, which is the more destructive of
the two.

## Hard rules

1. **Never perform the task yourself.** Your context is contaminated by definition. Every run is a fresh executor. If you catch yourself editing files inside a workspace, stop, delete the run, start over.
2. **The executor never sees the grading.** The task yaml and its expect lines stay out of the workspace. `setup` hard-fails on leaks; do not work around it.
3. **Always use the scripts** — setup, execution, grading. All three. Improvisation at any of them quietly corrupts records, and spawning executors by hand is what once left runs graded before they finished and workspaces deleted under live processes.
4. **Grade after execution, independently.** Never let an executor self-report success. `verify` requires `--judge-agent`, `--judge-model` and `--judge-effort` (codex takes the last two from `~/.codex/config.toml` when they are not passed), so the grading stack is always a stated choice and `result.yaml` names it under `judge:`. When judge and executor are the same agent the record says `self_judged: true` — expected on a single-stack benchmark, and the report has to say so.
5. **One executor per workspace, one run at a time per workspace.** `run-executor` refuses a second pass over a workspace that already ran. Runs in different workspaces are independent — each has its own git repo — but never point two processes at one run dir.
6. **`verify` deletes the workspace once it has graded it.** Evidence is captured into `<run-dir>/run.diff` or `<run-dir>/output/` first and both are committed, so nothing is lost. Pass `--keep-workspace` when you mean to dig through it afterwards — it holds the workspace until the next `clean-workspaces --delete`, which counts a graded run's workspace as spent, so dig through it before you sweep. Grading cannot start until `executor.yaml` says the executor finished, which is what keeps a live run from being graded and deleted under itself. Every other ending orphans a workspace — a killed executor never gets graded, and deleting its run dir to start over (rules 1 and 3) deletes the only record of where its workspace is. `yarn clean-workspaces` lists what can be reclaimed — a workspace whose run dir is gone, and one whose run is already graded, which covers `--keep-workspace` and a cleanup that failed after the grade was written — and `--delete` removes them; run it after a benchmark, from the checkout that made the runs, or live runs in another worktree look like orphans. If the runs were made with `EVAL_WORKSPACE_ROOT` set, sweep that root: `--root <path>`, or the same variable in the environment. That variable is read by all three commands, not just `setup` — export it for the whole benchmark or `run-executor` and `verify` will look for the workspace under the default root.

## The three roles

**Orchestrator** (you): drafts tasks, spawns executors, grades with the scripts, writes records and reports.

**Executor**: a freshly spawned agent that performs one run in a clean workspace.

```bash
yarn run-executor --run artifacts/<id>/<run-id> --model <model> --effort <effort>
```

The script builds the executor's command, so the flags that matter cannot be forgotten: `--setting-sources project` for claude (user-level config crowds the skill listing and skills stop triggering), and for codex `sandbox_workspace_write.network_access=true` (`workspace-write` blocks network by default, so without it every live-data task fails for the wrong reason) plus `--disable shell_snapshot` (codex otherwise sources a snapshot of the operator's interactive shell into every command; one unparseable line in it takes the executor's shell down for the whole run, and a run that cannot open a file grades as a skill that did not help) and `--ephemeral` (the codex home below is shared by every run on the machine, and without it each run's session log lands there for the next run to find). The codex judge carries both flags too. The same exposure on the claude side is still open: `--setting-sources project` governs settings-file discovery only, and claude snapshots the operator's shell the same way. Two limits on that codex flag worth stating: it removes the snapshot, not the login shell — codex still runs every command through `/bin/bash -lc`, so `/etc/profile` and the operator's `~/.bash_profile` are sourced with it on — and it does not fail open, because an unrecognised feature name exits 1 before the run starts and `verify` refuses a non-zero exit, so a codex rename surfaces as a dead run rather than as a flag that quietly stopped applying.

Codex also runs with `CODEX_HOME` pointed at `.codex-home/` in this repo, built by `lib/codex-home.ts`: the harness puts a generated `config.toml` and a symlink to the operator's `auth.json` there, and nothing of the operator's beyond that. Flags do not cover this: `--ignore-user-config` drops `config.toml` alone, while `~/.codex/skills`, `plugins/`, `rules/` and `memories` load by directory discovery, so an operator with a global codex skill on the task's subject contaminates the `no_skill` variant and nothing in the record shows it. Codex fills the rest of the dir in itself as it runs — its own bundled skills, plugin cache and state dbs — which is machine-local and the same for every operator, and `--ephemeral` keeps run content (`sessions/`, `history.jsonl`) out of it so one run's skill text cannot reach the next one. The judge runs under the same home. Delete `.codex-home/` any time; the next run rebuilds it.

Opencode is the route to open models, and runs on OpenRouter only: `OPENROUTER_API_KEY` must be set, and the model is named the way opencode names it (`openrouter/<vendor>/<model>`, e.g. `openrouter/moonshotai/kimi-k3` — `opencode models` lists them). Its isolation is all environment, built by `lib/opencode-home.ts`, and it takes more levers than codex's one variable. The child environment is rebuilt without every `OPENCODE_*` and `OTEL_*` variable and without every provider key the models catalog names, `OPENROUTER_API_KEY` included: a key in the environment enables its provider, and the bash tool inherits the environment, so a debugging `env` would put the key in a committed transcript. That list is the catalog's, not a list of AI vendors — it takes `GITHUB_TOKEN`, `AWS_*`, `HF_TOKEN`, `GOOGLE_APPLICATION_CREDENTIALS` and `CLOUDFLARE_API_TOKEN` with it — so an opencode run's shell is poorer than a claude or codex run's in those, which no task here has needed yet; a task that does needs the filter narrowed first. The OpenRouter key goes into an `auth.json` in the run's own data dir instead, deleted when the run ends, and every run start sweeps the keys of run-executors that were killed before they could. `XDG_CONFIG_HOME` points at a shared, settings-free config dir under `.opencode-home/`, and `XDG_DATA_HOME` / `XDG_STATE_HOME` at a dir per run under `.opencode-home/runs/`, because opencode's data dir carries `tool-output/` and workspace snapshots a later run can read — codex's `--ephemeral`, by another route. `~/.opencode` and the managed dirs (`/etc/opencode`, on macOS also `/Library/Application Support/opencode` and an opencode plist under `/Library/Managed Preferences`) cannot be redirected, so `run-executor` refuses to start while they hold anything opencode would load (skills, agents, commands, plugins, tools, an `opencode.json`); opencode's own npm install in `~/.opencode` does not count. The same check runs over the harness's shared config dir, the one place every run reads that a run can also write to: an `AGENTS.md` or a `skills/` an executor put there is a refusal, not something to clean up quietly. `OPENCODE_DISABLE_EXTERNAL_SKILLS` drops the `.claude/` and `.agents/` skill dirs, global and project alike — there is no switch that keeps the project copy and drops `~/.agents/skills` — so the skill under test is installed at `.opencode/skills/` for opencode runs, the one place left that opencode reads; `OPENCODE_DISABLE_CLAUDE_CODE` drops `~/.claude/CLAUDE.md`. `OPENCODE_CONFIG_CONTENT` carries the harness's own settings, which outrank any `opencode.json` in the workspace: sharing off (an operator's `share: auto` would publish the session), the `task` tool off (subagent spend never reaches the parent session's usage events, and `--auto` never answers a subagent's permission prompt, so a run that delegated would under-report or hang), and `small_model` pinned to the run's model. `PWD` is set to the workspace, because opencode takes its project root from `$PWD` ahead of the cwd it was spawned in — inherited from the orchestrator's shell, that made the first run treat this repo as its project, read this file and write its answer here (`--dir` is passed as well).

The models catalog is pinned. opencode refreshes `~/.cache/opencode/models.json` hourly and reads a model's accepted efforts and prices from it, so a benchmark would otherwise straddle a catalog change: the first opencode run copies the operator's catalog to `.opencode-home/models.json`, every run reads that copy (`OPENCODE_MODELS_PATH`, fetching off), `executor.yaml` records its hash as `models_catalog`, and `--effort` is checked against the `effort` entry in the model's `reasoning_options` — `kimi-k3` and `glm-5.3` take `low`, `high`, `max`, and no `medium`. Only that entry counts: a reasoning model without one (127 of the 247 OpenRouter reasoning models on the 2026-09-16 catalog, the qwen and deepseek lines among them) takes no effort on OpenRouter, so it is refused rather than recorded with one. The check has to be here because opencode accepts any `--variant` and silently runs at the model's default when it knows none of that name, which is a record naming an effort that never ran. Delete the pinned copy to re-pin a fresher catalog — the hash in the record is what shows a benchmark straddled that; a model that is not in it is refused. On argv the run gets `--auto` (approve every permission, claude's `--dangerously-skip-permissions`), `--format json` (the only place opencode reports tokens and its price) and `--title` (without it opencode makes a separate model call to name the session, which reports no usage). Web search is on (`OPENCODE_ENABLE_EXA`), because claude and codex search out of the box; without `EXA_API_KEY` it goes through Exa's shared endpoint. Its bash tool runs every command as `$SHELL -c` — neither login nor interactive — so a zsh operator's `.zshrc` and `.zprofile` stay out (checked 2026-09-16: 2 aliases and 0 functions inside the run against 5 and 8379 in the operator's interactive shell), and only `~/.zshenv` is sourced, which is where `PATH` entries such as foundry's come from. A smaller exposure than codex's `bash -lc`, but the same kind: `$SHELL` and `.zshenv` are the operator's.

What the record does not hold for an opencode run is who served it. OpenRouter routes `kimi-k3` and `glm-5.3` per request across providers that serve different quantizations and context limits behind one name, opencode sends no provider preferences, and the harness sets none — pinning takes a provider order it has no basis to choose. So "same model" on OpenRouter is the same name, not the same weights on the same hardware, across runs and even across the steps of one run. That is a gap in the stack rule, stated here rather than closed.

Every run names its model and its effort, because the effort moves the answer as much as the model does and a benchmark cannot straddle a silent change to either. Both travel on argv and into `executor.yaml` (`model`, `reasoning_effort`), then into `result.yaml` (`executor_model`, `executor_reasoning_effort`). There is no CLI default to fall back on: `run-executor` refuses to start, before it writes `executor.yaml`, when either one cannot be resolved. For claude, `--model` and `--effort` (`low`, `medium`, `high`, `xhigh`, `max`) are both required; for opencode likewise, with `--effort` one of the values the model's entry in the pinned catalog lists (see below). The stacks do not take the same set — codex also takes `none` and `minimal` — and each is checked against its own, because codex validates nothing itself: an unknown effort reaches the API, which refuses it once the run is already under way. For codex, the flags win, and without them the harness reads the operator's top-level `model =` and `model_reasoning_effort =` out of `~/.codex/config.toml` itself, since the redirect means codex reads none of it. A value set only under a `[profile]` table is not picked up, so without a flag it is refused rather than recorded as a setting the run never used. Runs made before this rule carry no effort, and the site shows them as "effort unrecorded". Leave them that way: a codex `transcript.md` header saying `reasoning effort: none` is the CLI reporting that nothing was set, not the API value `none` — every one of the 73 codex runs recording `reasoning_effort: null` prints it — so headers cannot be used to backfill the field. What the record names is what the harness passed, which is not always what the model ran at: a `maxEffortLevel` in the workspace's own settings, or a model with no effort support, can clamp or drop it, and nothing downstream can see that. No template sets one today; if one ever does, say so in the report.

It writes `<run-dir>/transcript.md` beside the raw capture, and `<run-dir>/executor.yaml` with `started`, `finished`, `exit`. A run whose `finished` is still null was killed — including by Ctrl-C, which leaves the record untouched on purpose: it is a dead run, not a zero. Delete it and set up a new one. A run that finished with a non-zero exit is refused by `verify` unless you pass `--grade-failed-run`, so a CLI that was missing or crashed cannot be recorded as a model failure. The same refusal covers the runs the exit code cannot see: `executor.err` is scanned for the signatures of an executor that had no working shell (`Shell snapshot validation failed`, `bwrap:`), because those exit 0 and read as a model that chose not to look at anything. `run-executor` scans first and exits non-zero itself, so the loop stops on the run that broke rather than on the `verify` two steps later; `verify` scans again for runs launched by hand. Only the executor's own signatures are matched, and only up to its first successful command — past that the capture is the run's output, and this repo's own files hold both signatures verbatim. `--grade-failed-run` overrides both refusals and writes `harness_failure:` into `result.yaml` so a run graded over one is never mistaken for a clean one. Add a signature to `SHELL_FAILURES` in `lib/executor-health.ts` whenever a new way of losing the shell turns up.

`transcript.md` means the same thing on every stack, which takes assembling: claude streams the whole session as stream-json on stdout, codex (with `--json`) and opencode (with `--format json`) stream their own event shapes there, and each is rendered to the same sections. Mine transcripts from `transcript.md` alone; the raw streams beside it are gitignored.

**Judge**: a fresh, blind agent that grades `expect:` lines from the evidence `verify` assembles (diff + output files). It never sees the variant, the skill, or the transcript. Claude and codex both work; opencode does not judge yet, though it orchestrates fine.

Never grade from your own context. You have read the skill and the expect lines, so you cannot grade blind. `verify` spawns the judge for you; pass the agent and model **you** are running as, so the grading happens on the orchestrator's model:

```bash
yarn verify --run artifacts/<id>/<run-id> --judge-agent claude --judge-model <your model> --judge-effort <your effort>
```

There is no CLI default for the judge either: a missing model or effort stops `verify` before the judge is spawned, with the same codex fallback to `~/.codex/config.toml` as the executor. Keep one judge, at one effort, for the length of a benchmark. A grader that changes between runs makes `with_skill` and `no_skill` incomparable.

### Revising expect lines: regrade, do not re-run

When you change a task's `expect:` lines after runs exist, the question is whether the new wording grades the same answers differently. Re-running executors answers a different question, because it changes the grading surface and draws fresh samples at once.

```bash
yarn verify --run artifacts/<id>/<run-id> --regrade --reason "<what changed in the rubric and why>" \
  --judge-agent claude --judge-model <model> --judge-effort <effort>
```

`--regrade` re-judges a run's stored evidence (`run.diff`, `output/`) against the task spec as it stands now. It never re-executes, never touches the source run dir, and writes `<run-id>-regrade-<n>/result.yaml` with `regrade_of` naming the run it re-read and `regrade_reason` saying why. It inherits the source run's `benchmark`: the site supersedes readings along `regrade_of`, so a re-reading filed under another id would take the run out of the benchmark it was made for. Grade every run of the task, not the failures only — a wording change that flips a fail to a pass usually flips something the other way too. Hold the judge fixed at whatever graded the run originally; changing the wording and the judge together tells you nothing about either. `verify` holds it for you: on a regrade the judge flags may be omitted, and the judge recorded in the source grade is reused, flags that disagree with it are refused, and a source grade that names no judge still has to be stated in full. A regrade is a second reading of one run, never a second run: never add it to a pass tally beside its source.

It refuses a run that was never graded, a graded run without the flag, a regrade with no stated reason, and — the one that decides whether any of this works — evidence git does not track. Two fields make a mixed rubric visible rather than something a reader reconstructs from git log:

- `expect_sha` fingerprints the expect list a grade was made against, and is written on every grade, first or re-reading. Runs are comparable only where it matches; a grade written before the field existed shows it as absent, which means "unknown, probably an older rubric". A regrade dir and its source disagreeing on it is the normal case — that disagreement is the regrade's whole point.
- `retracted: <reason>` marks a grade that measures the harness rather than the model — a killed CLI, or a deliverable that never reached the judge. It is carried into a regrade of that run, because the deliverable did not reappear. Keep the record and exclude it from the counts in the report, saying so; deleting it hides that the run happened.

**A source run's `result.yaml` does not know it was regraded.** The pointer runs one way — `regrade_of` names the source, nothing in the source names the regrade — so a reader who opens the run dir, or a tool that walks `artifacts/*/*/result.yaml`, sees the superseded grade with nothing marking it stale. `run-stats` skips `-regrade-` dirs for its cost tables, which is right (a regrade spawned no executor and has no cost), and it never reads `pass` at all. Pass tallies are read by hand, so the report is the only thing that can say which reading a table is on. Say it, and name the regrade dirs.

The evidence a regrade re-reads is committed — `run.diff` for template-seeded runs, a force-added `output/` for the question-shaped ones — so it works from any clone that has the run dir. Where `output/` was left ignored, which is the default for a bare task that snapshots a whole scaffold, the evidence exists only on the machine that made the run: regrade there, and commit the records.

**Rewording `input:` is not a wording change a regrade can absorb.** The judge is sent the task input as it stands now, so a regrade of a run made before the rewording shows the judge a question the executor was never asked, and grades old evidence against a new prompt. `setup` records `input_sha` on every run for exactly this: `--regrade` hard-fails when the current input hashes differently, and warns when the run predates the field and cannot be checked at all. A reworded input means a fresh baseline in both variants, never a regrade — and the old grades are not comparable to the new ones, which is a fact about the *input*, not about the expect lines.

## Isolation

Tooling resolves context by walking *up* the filesystem, and every such walk used to end in this repo. Three things stop it.

**The workspace lives outside the repo** — `~/.cache/ethskills-evals/<run-id>/<task-id>/`, or wherever `EVAL_WORKSPACE_ROOT` points; `<run-dir>/workspace.path` records where, gitignored because it is a machine-local path. The two markers below stop the tools that own them, and nothing else. Under `artifacts/` the run dir's siblings were other runs of the same task, holding their `answer.md`, `run.diff` and `result.yaml`, and `tasks/` with every expect line sat two directories further up — no marker stops an `ls`. What the move closes is that pair: neither the expect lines nor an earlier run's committed evidence is reachable by walking up from a workspace. What it does not close is the live neighbourhood — `ls ../..` is the root, so a run in flight lists the runs in flight beside it, and the run id names the variant. Run id above task id makes that reach cost a second `..` rather than the first, and graded runs drop out of it as `verify` deletes them, but layout cannot do more: same uid, so permissions are a no-op, and an unguessable name loses to an `ls`. It is not a sandbox — `~/.cache` still has `$HOME` above it and the executor runs under your uid.

**The workspace is its own git repo**, seeded by `setup` with a baseline commit whose sha lands in `<run-dir>/baseline.sha`. Executors run git — they are finishing a feature, so they commit. Without a repo of its own, `git add -A` from the workspace staged the orchestrator's files, `git commit -am` landed them on the checked-out branch, `git add .` exited 1 with a `-f` hint the executor would happily take, and runs in flight fought over one index.lock. `verify` diffs against that baseline, so an executor that commits its own work still produces evidence instead of an empty `run.diff`. Installed dependencies stay out through the workspace's `.git/info/exclude`, not a `.gitignore` the executor would read and the judge would see in the diff — note that this hides `lib/`, `out/`, `build/`, `cache/` and `target/` from the executor's own `git status` too, so a task whose deliverable lives in one of those needs `GENERATED_DIRS` trimmed first.

**A minimal `package.json`** is dropped into any workspace that has none. npm resolves its project root by walking up for the nearest manifest, and a git boundary does not stop it: in a bare workspace the nearest one was this repo's, so `npm install` inside a run rewrote the framework's own manifest. The stub is part of the baseline commit, so it never appears in a diff, and `verify` skips it in the snapshot by content match.

**The agent's own config is the benchmark's, not the operator's** — `--setting-sources project` for claude, and for codex a `CODEX_HOME` pointed at `.codex-home/` in this repo (see "The three roles"), which is what keeps a global codex skill on the task's subject from contaminating the `no_skill` variant. Neither half is complete: claude still discovers `CLAUDE.md` up the filesystem, and still sources the operator's interactive shell into its own Bash tool — codex no longer does, since `--disable shell_snapshot`.

What is still open: a concurrent run's workspace, two directories up — the one an executor reaches without meaning to — and this repo, which nothing stops an executor from finding on purpose. Closing either means a sandbox profile or a container.

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
status: live                     # optional; live | retired. Absent means live.
notes: free text                 # optional
```

**Retiring a task is a field, not a sentence in `notes`.** `status: retired` keeps the spec and
every artifact under it — the record of what it once graded stays readable — and makes `setup`
refuse to build a workspace for it, so a task whose claim the skill no longer makes cannot quietly
re-enter a benchmark table. Anything that lists tasks filters on this field; prose in `notes` is
for *why*, and nothing reads it.

Every workspace seed — generated scaffold or hand-authored ground truth — is committed under `templates/`; `templates/README.md` records what each one is and how to regenerate it. Commit sources only: dependencies (`node_modules/`, `lib/`) stay out, and `setup` copies the seed exactly as it stands on disk, so install them once per machine before the first run — the task notes carry the exact pinned commands and what a working install looks like (e.g. `forge test` → 39 passing). Unpinned installs silently rot the ground truth a benchmark rests on.

## Variants

The task input never changes across variants. Only the workspace does.

| Variant | Workspace contains |
| --- | --- |
| `no_skill` | task input (+ template) only |
| `with_skill` | the skill at `.agents/skills/<name>/`, agent decides to use it |
| `routing` | the skill plus every skill its description cedes to or is ceded to by, agent decides which to use |

`.agents/skills/` is the canonical, executor-neutral location; codex discovers it natively. Claude only lists skills from `.claude/skills/`, so claude runs also get a copy there, and opencode runs get one at `.opencode/skills/`, because the harness switches opencode's `.agents/` discovery off to keep the operator's global `~/.agents/skills` out (see "The three roles"). Supporting a new executor means adding a bridge line in `setup` and its dir to `SKILL_INSTALL_DIRS` in `lib/workspace.ts`, or the skill leaks into the judge's evidence.

**`routing` measures the descriptions, not the skill.** A `with_skill` workspace holds one skill, so "Skill called 3/3" shows that an agent with one relevant skill loads it; it cannot fail for a wrong `Not for … (\`x\`)` cede, because a cede only decides anything when both skills are installed. A routing run installs the task's skill beside every cede neighbour `setup` reads out of the descriptions (`routingNeighbours` in `lib/skill.ts`, both directions), records them as `installed_skills`, and `run-executor` reads which of them the run loaded off `transcript.md` into `skills_loaded`, first reach first — that first name is the routing decision. A skill with no cede in either direction is refused: one skill installed is a `with_skill` run. The run is graded like any other, but its grade is not a with/without measurement and the site keeps it out of both columns; read `skills_loaded` per run and report it as its own table. Same executor and effort as the benchmark it sits beside (#134, after #119).

To force the trigger, prepend one line to the spawn prompt (`Use the <name> skill for this task.`) and say so in the report. Trigger-inclusive and content-only numbers must never blend.

## Records

`artifacts/<task-id>/<run-id>/result.yaml`, one per run. `setup` writes the top half, `verify` the rest.

`skill_version` is the repo's HEAD at setup time, not a hash of the skill, so it only identifies the text as long as that commit stays reachable. A rebase, an amend or a squash-merge orphans it and the run stops being able to say what it was given. Before a branch merges, check every `skill_version` it adds with `git merge-base --is-ancestor <sha> HEAD`; where one is unreachable, restamp it to a reachable commit whose `skills/<name>/SKILL.md` blob is byte-identical (`git rev-parse <sha>:skills/<name>/SKILL.md`) and say so in the report. Restamping to a commit with different text is falsifying the record.

```yaml
task: gas-cost-estimate-001
run: 2026-07-06T093000Z-claude-with-skill-1
executor: claude
variant: with_skill
skill_version: 191dcc1                # git short sha of the skill source; null for no_skill
input_sha: 4f2b9c1de803               # sha256 of the input this run was given; absent on pre-2026-08-28 runs
installed_skills: [gas]               # every skill in the workspace, the task's own first; the neighbours too on routing; absent on no_skill and pre-2026-09-17 runs
created: 2026-07-06T09:30:00Z
executor_model: claude-opus-5         # what actually ran; null only on runs made before it was required
executor_reasoning_effort: medium     # every executor, passed on argv; absent or null on runs made before 2026-09-15
executor_exit: 0                      # verify refuses anything else unless --grade-failed-run
skills_loaded: [gas]                  # which of installed_skills the run loaded, first reach first (from transcript.md); absent where installed_skills is
harness_failure:                      # absent unless --grade-failed-run graded over a refusal
usage:                                # what the run cost; absent on runs made before 2026-08-27
  duration_s: 812                     # the harness's own wall clock — the one figure both stacks share
  turns: 34                           # claude, and opencode (one per model call); null on codex
  cost_usd: 4.66                      # claude's and opencode's reported price; on codex derived from tokens × lib/prices.ts
  cost_source: executor               # executor (claude, opencode) | list_price (codex); null when there is no cost
  input_tokens: 12                    # the UNCACHED remainder, double digits on a real claude run
  cache_creation_input_tokens: 47453  # where a skill's own prompt lands
  cache_read_input_tokens: 203362     # the context re-read on every turn
  output_tokens: 31748                # includes reasoning tokens on codex and opencode
  total_tokens: 282575                # the sum of the four above, on both stacks
judge:                                # who graded this run
  agent: claude
  model: claude-opus-4-8              # null only on grades made before it was required
  reasoning_effort: high              # absent on grades made before 2026-09-15
  self_judged: false                  # true when judge and executor are the same agent
expects:                              # judged expect lines, in task-spec order
  expect_1: pass
  expect_2: fail
pass: false                           # true only when every expect passed
```

Beside it, per run: `baseline.sha` and `workspace.path` (setup; the pointer is local-only), `executor.yaml` + `transcript.md` (run-executor), `run.diff` or `output/` (verify).

`mistakes/<skill>/<mistake-id>.yaml`. Scores say whether the skill helped; mistakes say what to write next.

```yaml
mistake_id: gas-stale-eth-price
skill: gas
first_seen: 2026-07-06
frequency:                     # per variant; nest under <executor>/<model> once a
  no_skill: 3/3                # second stack has been measured, because a rate that
  with_skill: 1/3              # averages two stacks describes neither
category: stale-knowledge
symptom: "Computes USD cost from a remembered ETH price instead of checking one."
expected_pattern: "Fetch ETH/USD live (Chainlink feed, CoinGecko) before quoting dollars."
skill_section: "What You Probably Got Wrong"   # the section that should prevent this, or "none" for a gap
status: open                   # open | fixed | wontfix | retracted (a regrade showed it was the expect lines, not the run)
```

When the same mistake has been measured on more than one stack, `frequency` takes a stack
key per measurement instead of the two bare variant lines — see
`mistakes/indexing/indexing-read-side-deploy-omitted.yaml`, where the no_skill rate is
`3/3` on codex and `1/3` on claude from identical content and identical checks.

## Reports

**Every cost or duration number in a report comes out of `yarn run-stats`, never off a keyboard.**

```bash
yarn run-stats --tasks <id>,<id> [--benchmark <id>] [--since 2026-08-27] [--variant no_skill] [--skill-version <sha>] [--runs]
```

It reads the `## run stats` footer `run-executor` writes into each committed `transcript.md`,
falling back to the raw `## result` block older transcripts carry instead — the same result event
under different labels, so those runs are derivable too — and to `result.yaml`'s `usage` block for
what neither holds, which on pre-`--json` codex runs is the token total. Codex runs made before `exec --json` are grouped apart from the rest, as `codex (pre-json tokens)`: their `total_tokens` is the old `tokens used` line, a different unit from every other total in the table. It prints per-task medians per executor and variant with
the cost range beside them and the median `total_tokens`, and says `(n with no stats)` for runs
that carry none of the three — whose cost and duration this repo simply does not have.

`--skill-version` filters on `result.yaml`'s `skill_version`. Two `with_skill` arms of one task
differ only by which revision of the skill they read, and the run directory name does not say, so
an arm is one command rather than a date range a reader has to know the boundaries of.

Print the range as well as the median: at `n=3` a goal task's cheapest and dearest run can differ by
more than the delta the median is being read for, and a median that carries a headline needs its
spread printed next to it. A number that `run-stats` cannot produce does not go in the table; write
"not measured" and say what it would take to measure it. This paragraph exists because a wallets
report once carried baseline costs assembled by hand out of a *benchmark-wide* median in an older
report — one cell took its duration from an aggregate over seven tasks and its cost from the other
variant's column — and no reviewer could have caught it without re-deriving every cell.

State the executor, its model and effort, the judge with its model and effort, and the run count at the top of every report. If any run came back `self_judged: true`, say so there — on a single-stack benchmark that is every run, and it is a caveat on the numbers, not a defect in them.

Pass counts are not the whole verdict. `result.yaml` carries a `usage` block per run, so
give the cost row real numbers rather than "no reduction observed": duration, tokens and
dollars on both stacks. Two arms that both pass every line are not equivalent if one
of them took twice the tokens to get there, and on a saturated task that difference is the
result. A codex dollar figure is `cost_source: list_price`: the run's token split priced at
OpenAI's standard-tier list price in `lib/prices.ts` (dated there), not what the operator was
billed, and it ignores the >272K long-context surcharge. `run-stats` marks it `(list price)`;
say so in the report too. A codex model missing from that table records `cost_usd: null` —
add its row before running it. An opencode figure is `cost_source: executor` like claude's,
but it is opencode's own arithmetic on models.dev's list price, not OpenRouter's bill, which
is at the routed provider's rate; a route opencode cannot price reports $0 on every step and
records `cost_usd: null`.

Quote `total_tokens`, never `input_tokens`. The run's input is spread over three fields and
`input_tokens` alone is the uncached leftover — a skill's whole prompt is billed through
`cache_creation_input_tokens` and re-read every turn through `cache_read_input_tokens`, so a
total that skips them cannot see the cost the skill adds. Since 2026-09-15 codex runs with
`exec --json` and records the same four-way split. Codex runs before that carry only the
`tokens used` line as `total_tokens` — uncached input plus output, several times smaller than
the same work counted the new way — so never put an old codex total beside a new one. Even
with the same shape, the two stacks tokenize and cache differently: compare tokens between
variants within one stack, and dollars across stacks.

Every report ends with this table. Answer the last row honestly: sometimes the eval is the wrong artifact, not the skill.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | raw counts, e.g. `2/3 vs 0/3` |
| Did it reduce time/tokens? | per-variant medians from `usage`, e.g. `808s / 283k tokens vs 1277s / 431k` |
| Did it create negative deltas? | list them |
| What mistakes repeated without the skill? | mistake ids |
| What mistakes remained with the skill? | mistake ids |
| What should change in the skill? | concrete edits |
| What should change in the eval? | missing or weak checks |

## What gets committed

Committed: task specs, vendored skills under test, workspace templates under `templates/`, and per run `result.yaml`, `baseline.sha`, `executor.yaml`, `transcript.md`, `run.diff`, plus mistake records and reports. Gitignored: the raw executor capture beside `transcript.md` (`transcript.jsonl`, and `transcript.log` on codex runs made before `exec --json`), `executor.err`, `output/`, and `workspace.path` — an absolute path on one machine, pointing at a workspace `verify` has already deleted, so it is stale for every reader but the one who made it.

This line said the opposite until 2026-08-20 — transcripts gitignored, `output/` committed — while `.gitignore` and all 210 committed runs did the reverse. Follow `.gitignore`; the transcript is what a reviewer re-derives a report's claims from, so it is the record that has to survive.

`output/` stays ignored by default because a bare task has no template to diff against and `verify` snapshots the whole workspace into it: a quiz leaves one `answer.md` of a few KB, a goal that scaffolds leaves a tree (noir-goal-001: 176 files, 760K). Where that snapshot is the graded deliverable and small, force-add it (`git add -f`) so a reader of the eval PR can re-check the judge on the material the judge saw. Read "small" generously — the nine gas-goal-001 runs are Foundry source trees and come to 40-72K each — and note that this is also the only thing that keeps a run regradeable: `verify` deletes the workspace, so uncommitted evidence means the grade can never be revisited by anyone, including you. If the snapshot is genuinely too big to commit, say so in the report, because the runs behind that table are then unauditable.

## The results site

`site/` is a viewer, not part of the loop: it reads what runs already produced and never
takes part in producing them. Do not touch it while running a benchmark. After one, run
`yarn build-index` and commit `site/derived.json` if it changed — it carries the skill text
and the task rubric each run was measured against, and those stop being recoverable once
the branch that held them is deleted.

## Code style

TypeScript throughout, run with tsx. Follow the [Scaffold-ETH 2 code style guide](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md#code-style-guide): `type` over `interface`, `UpperCamelCase` types without a `T` prefix, `lowerCamelCase` functions and variables, `CONSTANT_CASE` constants, let inference work instead of annotating, comments only where they add information.
