---
name: benchmark-major-refine
description: 'Run the major-refine benchmark (issue #119) for one skill on one of its four stacks — no skill vs the first vendored skill text vs the refined one, every live task, judged by Opus 5 high. Use when asked to "run major-refine for <skill>", "run the eval for <skill>" for #119, or to pick up a row of #119. Not for drafting a new task or evaluating a skill outside this benchmark (AGENTS.md).'
---

# major-refine benchmark

The clean re-run from [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119): every skill, three arms, one harness version, four stacks, one judge. Everything that has to be the same across operators is pinned below, so the human names only the skill (and the stack, if their message did not). AGENTS.md still governs everything this file does not pin: the loop, the hard rules, the records, the report table. Where the two differ, this file wins for this benchmark.

## Pinned

| What | Value |
| --- | --- |
| Benchmark commit | `UNSET`, recorded as `UNSET` |
| Benchmark id | `major-refine-<benchmark short>` |
| Old skill ref | `2f0adb01554aa3f4feb52a1b3f5797ab2499e933`, recorded as `2f0adb01` (the first version of every skill in this repo, "vendor all 19 ethskills skills @ 191dcc1"; gas was added earlier but its text there is the same) |
| New skill ref | the benchmark commit |
| Runs | 3 per arm per task, whatever the task's own `runs:` says |
| Judge | `--judge-agent claude --judge-model claude-opus-5 --judge-effort high`, on every stack, every run |

**If the benchmark commit is still `UNSET`, stop.** It is set once #128 and #129 are merged, to the commit on `main` the benchmark measures, and that commit has to contain `setup --skill-ref`. Both forms are written into the row, the way the old ref's is: the full sha, then its first 8 characters (the length `setup` records). Below, `<benchmark sha>` is the full one, used after `--skill-ref` and in the git checks for the reason the old ref is passed in full, and `<benchmark short>` is the 8 characters, used everywhere a record or an id carries it. Copy each from the row; never cut the short one yourself, because one operator's slip splits the benchmark id. Tell the human; do not pick a commit yourself, because every operator has to land on the same one.

### Stacks

| Stack | `--executor` | `--model` | `--effort` | Slug |
| --- | --- | --- | --- | --- |
| Opus 5 medium | `claude` | `claude-opus-5` | `medium` | `opus-5-medium` |
| GPT 5.5 high | `codex` | `gpt-5.5` | `high` | `gpt-5.5-high` |
| Kimi K3 high | `opencode` | `openrouter/moonshotai/kimi-k3` | `high` | `kimi-k3-high` |
| GLM 5.3 high | `opencode` | `openrouter/z-ai/glm-5.3` | `high` | `glm-5.3-high` |

Always pass `--model` and `--effort`, codex included: its fallback to `~/.codex/config.toml` is per operator, which is exactly what this benchmark pins away. The judge is claude for every stack, so the `claude` CLI has to be installed and logged in even when you orchestrate from codex or opencode. The Opus stack comes out `self_judged: true` and the other three do not; the report says so. Opencode stacks need `OPENROUTER_API_KEY`.

### Arms

| Arm | `setup` flags | Recorded `skill_version` |
| --- | --- | --- |
| none | `--variant no_skill` | `null` |
| old | `--variant with_skill --skill-ref 2f0adb01554aa3f4feb52a1b3f5797ab2499e933` | `2f0adb01` |
| new | `--variant with_skill --skill-ref <benchmark sha>` | `<benchmark short>` |

The old ref is passed in full because 8 characters are only unique until some clone holds a second commit that starts with them, and `setup` refuses an ambiguous ref; what it records is the first 8 either way. The new arm goes through `--skill-ref` too, not through the checkout, so a stray local edit under `skills/` cannot reach it. Old and new are both `with_skill`; `setup` puts the ref in their run ids (`…-with-skill-2f0adb01-1`) and records it as `skill_version`, 8 characters, which is what `yarn run-stats --skill-version` filters on. Do not force the trigger: the numbers are trigger-inclusive, as AGENTS.md defines them.

## Before the first run

Ask at most one question: the stack, if the human did not name one. Recommend the one your own harness runs (claude → Opus 5 medium, codex → GPT 5.5 high); opencode can orchestrate either open-model stack. Then check, and stop on any failure rather than working around it:

1. **Nobody else has the row.** Read #119 (`gh issue view 119`). If another handle sits on this skill under this stack, stop and tell the human. If it is free, tell the human to put their handle on it; do not edit the issue body yourself, since several people edit that checklist at once.
2. **The checkout measures the benchmark commit.** Tasks, templates and harness must be byte-identical to it, working tree included:

   ```bash
   git merge-base --is-ancestor <benchmark sha> HEAD
   git diff --quiet <benchmark sha> -- tasks templates lib scripts package.json yarn.lock tsconfig.json AGENTS.md .agents/skills .claude/skills
   extra=$(git ls-files --others --exclude-standard -- tasks templates lib scripts AGENTS.md .agents/skills .claude/skills && git ls-files --others -- 'tasks/*.yaml') && test -z "$extra"
   ```

   A non-zero exit on the second means the rubric, the harness or the pins above moved since the benchmark started — this file is in the pathspec because a locally edited judge, effort or arm would otherwise pass preflight and land in a column under the shared id. That is a team decision (a new benchmark id), not something to fix on a branch. The third fails on any untracked file there: `git diff` does not see them, and an untracked `tasks/*.yaml` would join the task set below. Its second listing drops `--exclude-standard` for the task specs, because the task set is a glob and a glob picks up a yaml your own gitignore hides; and the `&&` chain is what makes a `git` that failed, and so listed nothing, a failure rather than a pass.
3. **The branch.** Work on `eval/major-refine-<skill>-<slug>`, cut from `main`.
4. **`EVAL_WORKSPACE_ROOT` is unset**, or points outside this repo. A workspace inside the repo is a walk up from `tasks/` and from this file, which names the arm the run is in.

## The task set

Every live task whose `skill:` is this skill:

```bash
grep -lx "skill: skills/<skill>" tasks/*.yaml | xargs -r grep -L "^status: retired"
```

Before a task with a `template:`, install that template's dependencies the way its `notes` pin them, and check the result they describe (e.g. `forge test` → 39 passing). They are gitignored, so the checks above cannot see them, and `setup` copies the template as it stands on disk: an unpinned or missing install is a different workspace on your machine than on everyone else's.

Run all of them. Do not draft, reword or add tasks, and do not touch an `expect:` line: every operator measures against the rubric at the benchmark commit. If a task looks broken, finish its runs, say so in the report, and raise it on #119. If the list is empty, stop and tell the human.

## The runs

For each task, 3 runs of each of the three arms, 9 in all. Interleave the arms (run 1 of none, old, new, then run 2 of each, …) rather than doing one arm after another, so a model or routing change during the session lands on all three arms instead of on one. Each run is the AGENTS.md loop with the pinned values filled in:

```bash
yarn setup --task tasks/<task>.yaml --run <n> --executor <executor> --benchmark major-refine-<benchmark short> <arm flags>
yarn run-executor --run artifacts/<task>/<run-id> --model <model> --effort <effort>
yarn verify --run artifacts/<task>/<run-id> --judge-agent claude --judge-model claude-opus-5 --judge-effort high
```

`<n>` is 1–3 within each arm. Runs in different workspaces may overlap; one run's three commands never do. A dead or refused run follows AGENTS.md (delete it and set it up again, or retract it); never grade over a refusal to keep the count at 3 without saying so in the report.

## The PR

Commit what AGENTS.md "What gets committed" lists, file the mistake records, run `yarn build-index` and commit `site/derived.json` if it changed. Then:

- **Report:** `reports/major-refine-<skill>-<slug>.md`. At the top: the benchmark id, the stack (executor, model, effort), the judge (claude-opus-5, high), 3 runs per arm, the task list, and `self_judged: true` if this is the Opus stack. The headline per task is pass counts per arm, new vs old vs none (`3/3 · 1/3 · 0/3`); costs come from `yarn run-stats --tasks <ids> --benchmark major-refine-<benchmark short>`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version <benchmark short>`. End with the AGENTS.md table, answering its skill questions for new vs old as well as for new vs none.
- **PR:** titled `eval: <skill> (<stack>)`, body naming the benchmark id and linking #119. Give the human the link so they can tick the row.
