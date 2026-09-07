# The showcase site — spec for the `site/clean-showcase` branch

This document is the brief for the work on this branch. Read all of it before touching code.
It explains what this repo is, what the site is for, what the current site gets right and why
it nevertheless has to change, the exact decisions already taken, and how the work is sliced.
Where the spec says "decide yourself", do — but say what you decided in the commit message.

## 1. What this repo is, and what the site is for

`ethskills-evals` benchmarks **skills** — `SKILL.md` files that an AI coding agent loads to do
Ethereum work better. The skills come from [ethskills.com](https://ethskills.com); this repo
vendors them under `skills/<name>/SKILL.md`, writes **tasks** for each one (`tasks/*.yaml`),
and runs every task several times **with** the skill installed and several times **without**
it. A blind judge (a separate model call that does not know which variant it is grading)
scores every run against the task's `expect:` lines. Each run leaves a folder under
`artifacts/<task>/<run>/` with a `result.yaml` (the grade), a `transcript.md` (what the agent
did, with a stats footer) and often the output files.

The point of the exercise is a loop:

1. measure the skill as vendored (**before**), with and without;
2. rewrite the skill — usually cut it down hard, 547 lines → 39 is typical;
3. measure the rewrite (**after**), with and without, on the same tasks, same model;
4. keep the rewrite only if it does the job as well or better.

The site is where step 3 is *read*. Its audience is not the people running the loop; it is
the people who have to be convinced by it — the maintainer of ethskills, the Ethereum
Foundation, and later other teams who want their own skill collections measured the same
way. The one-paragraph story the site has to tell, per skill, is:

> *The model does the task better with this skill than without it. We rewrote the skill to a
> tenth of its size, ran the same tasks again on the same model, and it still does. Here are
> the numbers, the prompts, the transcripts, and the diff.*

## 2. What exists today (PR #97, branch `site/results-frontend`) and why it changes

The current `site/` is a React + Vite static site fed by one JSON file that
`scripts/build-index.ts` writes from the repo. Read `scripts/build-index.ts`,
`site/src/lib/compare.ts`, `site/src/lib/types.ts` and the pages before starting; the
comments in them are accurate and explain the traps in the data. The short version:

- **`result.yaml` does not say which skill text a run saw.** It records `skill_version`, which
  is `git rev-parse HEAD` at setup — a fingerprint of the whole repo, not of the skill. The
  indexer recovers the real text with `git show <sha>:skills/<n>/SKILL.md`, hashes it
  (`lib/skill.ts`, 12-hex id), and that hash is the **version id**. Newer runs record the id
  directly as `skill_content`.
- **Tasks' `expect:` lines get rewritten between benchmarks.** A pass count graded against
  different lines is not comparable. The indexer pins every run to the rubric (hash of input +
  expect lines) it was actually graded on, from git history. `Run.rubric` carries it.
- **Regrades.** A run can be re-judged against rewritten lines without re-running the model;
  the new grade is a second *reading* of the same run (`regrade_of`, `superseded_by`). Only
  the newest reading counts. **Retracted** grades measured a harness failure, not the model.
- **All of those answers live only in git history**, which is not durable (squash merges,
  shallow deploy clones), so they are cached in the committed `site/derived.json`. CI fails
  the PR if that cache is stale; the deploy runs `build-index --strict` and refuses to build
  on an unresolved fact. **None of that changes on this branch.**

The current site is a careful, honest viewer of *five months of experimenting*: several
versions per skill, three generations of models, rewritten and retired tasks, regrades. It
copes by inferring which version is "after", and by a system of markers and footnotes
(`‡ § † *`) explaining why a cell may not be compared to its neighbour. It is correct, and
it reads like an internal dashboard. Two things in particular are wrong for the audience:

- **The model is not part of the comparison.** `compare.ts` groups runs by skill text and
  rubric only. For `gas`, "before" was measured on `claude-opus-4-8` and "after" on
  `gpt-5.6-terra`; for `indexing`, before on Codex and after on Claude. The site presents
  those as skill gains. Nothing marks it.
- **"After" is a heuristic** (`compare.ts:103-121`). It picks the wrong version for `l2s`,
  `wallets` and `orchestration` (it prefers a later 3-run re-check over the full benchmark),
  which is why those pages show empty cells today.

## 3. What this branch is

A branch that shows **what the site will look like after a clean re-run**, built from the
runs we already have that happen to be clean. It is a preview of the future, not a fix for
the past. Concretely:

- Only the runs named by a small **manifest** are shown. Nothing else exists as far as the
  site is concerned. The manifest is the thing a person fills in after a benchmark.
- The model is a **first-class dimension**: a manifest entry is one skill measured on one
  model. A skill may have several entries (one per model). Today each skill has one.
- No inferred "after", no marker system, no version history, no "self-judged" anywhere.
- Tokens, duration and cost are shown.
- The design is new: clean, minimal, easy to read, pretty, nothing broken. You choose it.

## 4. Decisions already taken (do not reopen)

| # | Decision |
|---|---|
| D1 | Only skills with a clean before/after on one model are shown. Today that is 7 skills; the manifest lists them. `standards` was in the first cut and dropped: its checks were rewritten for all three tasks between the two benchmarks, so it has no comparable row. |
| D2 | Selection is by a manifest, `site/showcase.json`, read by `build-index`. Nothing in `artifacts/` moves. If the manifest is absent, `build-index` behaves as it does today (unfiltered). |
| D3 | A manifest entry is `{ skill, model, before, after }` where `before`/`after` are version ids (the 12-hex `skill_content` hashes). Several entries per skill are allowed, one per model. |
| D4 | The executor model of a run is `executor_model` when recorded; otherwise, when the record says the judge was the same agent as the executor (`judge.self_judged === true`), the judge's model — every report in `reports/` confirms those were single-model stacks; otherwise `<executor>-unknown`, e.g. `claude-unknown`. |
| D5 | The words "self-judged" / "self_judged" appear nowhere in the UI. The model name is shown instead. |
| D6 | "Before" is the skill text as it was **when we vendored it** (the manifest's `before` id). The site never fetches, mentions or compares against ethskills.com's current text. A link to `https://ethskills.com/<skill>/SKILL.md` labelled "upstream" is fine. |
| D7 | Tokens / duration / cost come from the transcript stats footer via `parseTranscriptStats` in `lib/usage.ts`, with `result.yaml`'s `usage:` block filling gaps, exactly as `scripts/run-stats.ts` merges them. Aggregates are **medians per run**. Cost is shown for a column only when every run in it has a cost (in practice: Claude runs); otherwise "—". Never estimate cost. Codex token totals and Claude token totals are not comparable with each other (see the comment above `buildUsage`); they are only ever compared within one model, between columns. |
| D7a | The harness only began recording tokens, duration and cost on 2026-08-20 (`ddf3e322`), and the older run folders hold nothing else to recover them from. In today's data only `l2s` and `security` have usage on all three columns; `addresses` and `standards` have none; `concepts`, `protocol`, `wallets`, `orchestration` have it for "after" and (partly) "without" but not "before". A clean re-run will have full coverage, so the UI must **degrade, not hide the feature**: show a column's medians when at least one run in it has them, with the run count they are over (`over 11 of 11 runs`); show "not recorded" for a column with none; when no column of an entry has any, replace the block with one sentence: "Tokens, time and cost were not recorded for these runs." On the front page the tokens before → after cell is "—" unless both sides have data. Never mix Codex and Claude token counts. |
| D8 | Pages: **Summary** (`/`), **Skill** (`/skill/:name`), **Tasks** (`/tasks`), **Task** (`/task/:id`), plus the existing report/PR document routes so links still work. No "Write-ups" navigation item. |
| D9 | Headline comparison is **after vs without** ("the skill helps"); secondary is **before → after** ("the rewrite kept it"), and size before → after in lines. |
| D10 | Task rows whose `expect:` lines were rewritten between the before and after benchmarks (the two cells carry different rubric ids) are **shown** with their numbers, **left out of the totals**, and explained by one plain sentence under the table — no symbols. Same for a task that has runs on only one side. Retired tasks are excluded from the showcase entirely. |
| D11 | Rinat's resolution machinery (`derived.json`, `--strict`, `--no-git`, CI) is untouched. The manifest filters **after** every fact is resolved and the cache is written, so `yarn build-index --strict` must still pass and `derived.json` must not change because of this branch. |
| D12 | Code style is the repo's (`AGENTS.md` → "Code style"): `type` over `interface`, no `T` prefix, let inference work, comments only where they add information — and in this repo comments explain *why*, often with the concrete run or skill that motivated the rule. Match that. |

## 5. The manifest

`site/showcase.json`:

```json
{
  "entries": [
    { "skill": "addresses",     "model": "claude-opus-5",  "before": "feb92ff9d768", "after": "0b27983975a5" },
    { "skill": "concepts",      "model": "claude-opus-5",  "before": "2967d95ba7c0", "after": "6caff76c2ad3" },
    { "skill": "l2s",           "model": "claude-opus-5",  "before": "a3ec5f219e45", "after": "3705d577e3ff" },
    { "skill": "protocol",      "model": "claude-opus-5",  "before": "100b87c78a9e", "after": "76d1dc80c748" },
    { "skill": "wallets",       "model": "claude-opus-5",  "before": "ae147e09a230", "after": "fc965d17a92a" },
    { "skill": "security",      "model": "gpt-5.4",        "before": "dd988d2f4172", "after": "662e68fa0226" },
    { "skill": "orchestration", "model": "gpt-5.6-terra",  "before": "524ef0810e78", "after": "60b3a1402947" }
  ]
}
```

What these resolve to (so you can check your work; run counts are newest readings, not
retracted, graded):

| skill | model | before | after | without-skill runs |
|---|---|---|---|---|
| addresses | claude-opus-5 | 547 lines, 18 runs / 6 tasks | 39 lines, 18 runs / 6 tasks | 24 |
| concepts | claude-opus-5 | 230 lines, 9 / 3 | 42 lines, 11 / 3 | 9 |
| l2s | claude-opus-5 | 187 lines, 15 / 5 | 50 lines, 15 / 5 | 15 |
| protocol | claude-opus-5 | 267 lines, 6 / 2 | 24 lines, 6 / 2 | 12 |
| wallets | claude-opus-5 | 169 lines, 21 / 7 | 26 lines, 25 / 7 | 46 |
| security | gpt-5.4 | 487 lines, 24 / 8 | 56 lines, 24 / 8 | 48 |
| orchestration | gpt-5.6-terra | 225 lines, 15 / 4 of 5 | 34 lines, 15 / 5 | 21 |

Known wrinkles in this data that D10 covers: `orchestration-quiz-004` has no before runs;
`addresses` (2 tasks), `concepts` (2), `security` (2), `wallets` (2) and `l2s` (1)
have tasks whose expect lines were rewritten between the two benchmarks. `wallets` also has
3 retired tasks with before-only runs — excluded.

## 6. What `build-index` emits (the contract between the script and the site)

Keep the existing shape and add to it; remove what the showcase does not need. The result
must be self-describing enough that the pages need no heuristics.

```ts
type Index = {
  generated: { at: string; commit: string | null; dirty: boolean; repo: string };
  showcase: Entry[];              // the manifest, verbatim, in manifest order
  skills: Skill[];                // only skills that have an entry
  tasks: Task[];                  // only live tasks of those skills
  runs: Run[];                    // only runs an entry selects (see below)
  reports: Report[];              // only for those skills
  prs: PullRequest[];             // only for those skills
  warnings: string[];
};

type Entry = { skill: string; model: string; before: string; after: string };

type Run = {
  // existing fields stay: task, skill, run, variant, executor, created, pass, expects,
  // skill_content, rubric, rubric_expects, transcript_url …
  model: string;                  // D4, always set
  usage: {                        // D7; a field is null when not recorded, never 0
    tokens: number | null;
    duration_s: number | null;
    cost_usd: number | null;
    turns: number | null;
  };
};
```

A run is selected by an entry when: `run.skill === entry.skill`, `run.model === entry.model`,
the run is the newest reading of itself (not superseded), it is not retracted, it is graded,
its task is live, and either `variant === "no_skill"` or `skill_content` is the entry's
`before` or `after`. Drop `regrade_of` / `superseded_by` / `retracted` from the emitted run
if they are always null after selection; keep `judge` out of the UI but it may stay in the
JSON. `Skill.versions` should contain the before and after versions (with text, lines,
words, sha) — the diff needs the text.

`build-index` should warn (and therefore fail `--strict`) when an entry names a skill,
version or model that selects zero runs on either side, so a typo in the manifest cannot
deploy as an empty page. Add `--showcase <path>` with default `site/showcase.json`; when the
file does not exist, emit the unfiltered index exactly as today.

## 7. The site

### Summary (`/`)

Short intro: what this is, how a skill is measured (task kinds, with/without, blind judge,
same tasks and model for before and after), and the loop. Keep the tone of the current
front page — plain, specific, no marketing — but shorter. Then the table, one row per
manifest entry:

`skill · model · tasks · runs · without skill · with skill: before · after · size before → after · tokens before → after`

Pass counts as `passed/total`. Make the headline (after vs without) and the secondary
(before → after) readable at a glance — a compact bar, a colour, a delta, your call — without
turning the table into a dashboard. Every skill name links to its page.

### Skill (`/skill/:name`)

One block per entry for that skill (today: one). In order:

1. Header: skill name, model, "rewritten from N lines to M lines", the headline in one
   sentence with the numbers.
2. Results table: one row per live task — task · kind · without · before · after. Totals row.
   The D10 sentence under it when it applies ("Checks for 2 tasks were rewritten between the
   two benchmarks; those rows are shown but not totalled." / "1 task was added after the
   first benchmark; it has no before column.").
3. Cost block: for each column (without / before / after) the median tokens, median
   duration, median cost per run, and the run count — a small table or three tiles. "—"
   where D7 says so.
4. "Why it changed": links to the reports and PRs for the skill (existing `Doc` routes).
5. The diff, before → after, using `@pierre/diffs` as today (split view, word-level, collapse
   unchanged). Left is the before version, right is the after version, both labelled with
   their line counts. Keep the show/hide toggle.

### Tasks (`/tasks`)

A list grouped by skill: task · kind · number of checks · runs · without · with (after).
Links to the task page. No markers.

### Task (`/task/:id`)

Prompt (copyable — a copy button is welcome), the checks (the `expect:` lines as they stand;
if some shown runs were graded on an earlier revision, say so in one sentence), then the
runs table: run · variant · version (before / after / —) · model · pass/fail · per-check dots ·
tokens · duration · transcript link. Drop the "why this task exists" box.

### Design brief

You choose typography, spacing, colour, components. The constraints:

- Clean, minimal, generous whitespace, readable numbers. Tables are the content; make them
  beautiful rather than hiding them.
- Light and dark both good, via `prefers-color-scheme`. Keep the CSS in `site/src/styles.css`
  (plain CSS is fine; no CSS framework).
- Works on a phone: tables scroll inside their own container, the page never scrolls
  sideways.
- No symbols-as-footnotes. Where a caveat is needed, a sentence.
- Keep the topbar: site name, `tasks`, `repo`, generated commit + date on the right.
- No "self-judged", no "regrade", no "retracted", no "rubric" in user-facing text. Say
  "checks" for expect lines, "model" for the executor model.

## 8. Slices, in order — commit after each, run the checks after each

Checks that must be green after every slice (run them from the repo root of this worktree):

```bash
yarn tsc --noEmit
yarn test
yarn build-index --strict --no-prs        # must print no warnings; must NOT modify site/derived.json
git diff --quiet -- site/derived.json     # confirms the above
cd site && yarn build && cd ..            # site tsc + vite build
```

**Slice 1 — data.** `site/showcase.json`; `--showcase` in `build-index`; `run.model` (D4);
`run.usage` (D7, via `parseTranscriptStats` + `parseUsageRecord`, reading
`artifacts/<task>/<run>/transcript.md`); selection and filtering (§6); warnings for entries
that select nothing; `site/src/lib/types.ts` updated. Tests: a `tests/showcase.test.ts`
covering the model inference rule, the usage merge, and selection (including: a superseded
reading is dropped, a retracted run is dropped, a retired task is dropped, an entry naming an
unknown version warns). Acceptance: `site/public/index.json` holds 8 skills, their live
tasks, only selected runs, and every run has `model` and `usage`.

**Slice 2 — engine.** Replace the inference in `site/src/lib/compare.ts` with a
`compareEntry(entry, index)` that returns rows, totals, coverage, the D10 explanations, and
per-column usage medians. Keep `tally`, `shareRubric` and the rubric logic that decides
whether a row is totalled. Delete what is no longer reachable (the after-selection heuristic,
`between`, `editedAfterBenchmark`, the marker notes). Rewrite `tests/compare.test.ts` for the
new function; keep the existing cases that still apply (rubric moved ⇒ not totalled;
regrade ⇒ newest reading only). Acceptance: tests green; the totals for the 8 entries match
§5's run counts.

**Slice 3 — pages and design.** The four pages per §7, the new `styles.css`, remove
`Marker.tsx`, `notes.ts`, `Writeups.tsx` and anything else unreachable. Acceptance: `cd site
&& yarn build` clean; open `yarn dev` and check every page for the 8 skills and a handful of
tasks; nothing says "self-judged"; no horizontal page scroll at 375px width.

**Slice 4 — docs and polish.** Update the "results site" sections of `README.md` and
`AGENTS.md` for the manifest (what to add after a benchmark: the entry, then `yarn
build-index`, commit `derived.json` if it changed). Final pass over wording on the pages.
Re-run all checks.

Commit messages: imperative, prefixed `site:` like the branch's history (`git log --oneline
-20`), body says what was decided where the spec left room. Add the trailer
`Co-Authored-By: Codex <noreply@openai.com>` to commits you author.

## 9. Things not to do

- Do not edit anything under `artifacts/`, `tasks/`, `skills/`, `reports/`.
- Do not change how `build-index` resolves facts or writes `site/derived.json`, and do not
  change `.github/workflows/checks.yml` or `vercel.json`.
- Do not add dependencies beyond what `site/package.json` already has, except a small
  diff/markdown/icon helper if genuinely needed — say so in the commit.
- Do not reintroduce a versions table, a status column, or a "measured once" state: a skill
  is on the site when it has an entry, and not before.
- Do not guess a model. `claude-unknown` is the honest answer when D4 has nothing.

## 10. What was built

`site/showcase.json` selects seven skill comparisons, each on one model, through `lib/showcase.ts` and `scripts/build-index.ts`.
`site/src/lib/compare.ts` computes matching-check totals and usage medians for the summary, skill, task list, and task pages.
Skill pages label rows excluded from totals and show the text diff; task pages show full run ids and transcript links.
The shared `site/src/styles.css` supports light and dark themes, wrapping text, and tables that scroll within the page.

After a benchmark, add or update `{ skill, model, before, after }` in `site/showcase.json`.
Find the skill content version ids with `yarn build-index --versions --no-prs`, which prints skills, ids, lines, and runs on stderr.
Run `yarn build-index`, then commit the manifest and `site/derived.json` if it changed.
The indexer still resolves and caches all facts before selecting showcase entries; `--strict` still rejects unresolved facts.
