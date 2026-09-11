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
    { "skill": "orchestration", "model": "gpt-5.6-terra",  "before": "524ef0810e78", "after": "60b3a1402947" },
    { "skill": "frontend-playbook", "model": "claude-opus-5", "before": "13df4b400c54", "after": "95a2e7035710" }
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
| frontend-playbook | claude-opus-5 | 394 lines, 24 / 8 | 93 lines, 24 / 8 | 24 |

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
  // skill_content, rubric, prompt, lineage, reading, rubric_expects, transcript_url …
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
JSON. `Skill.versions` should contain the before and after versions (with lines, words,
tokens under the o200k tokenizer, sha). The text lives in `docs.json` since section 14; the diff fetches it from there.

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

## 11. Review round 1 (Shiv, 2026-09-07) — make it readable for someone with no context

The test for every page: a newcomer who has never seen this repo should understand what they
are looking at from the layout and a few words, without reading a paragraph. Less text,
more structure; where a number needs a definition, put the definition next to the number.

### Front page

- The heading is not a slogan. Drop "Less to read. Put to the same test." Use a plain title,
  e.g. **Skill evals** (or "ethskills evals"), with one line under it: what is benchmarked —
  *7 skills from ethskills.com, each measured before and after a rewrite, on one model.*
- Replace the two paragraphs with **pointers** (a short list), roughly:
  - Two kinds of task per skill: a **quiz** (questions that need derivation, not lookup —
    "what does a 100k USDC flash loan on Aave V3 cost all-in?", not "what is the fee?") and
    a **goal** (a build where the skill's key claim is one decision along the way, never
    named in the prompt).
  - Each task runs several times **with** the skill and several times **without**, each run
    in a fresh workspace on its own branch.
  - A separate, **blind judge** grades every run against the task's checks without knowing
    which variant it was.
  - Then the skill is rewritten — usually much shorter — and the same tasks run again on the
    same model. Before and after sit side by side.
- Put the longer explanation of quizzes and goals (why derivation, why unprompted — see
  GitHub issue #1 "The type of tasks") in a **collapsible** `<details>` under the list, closed
  by default. Drop the sentence "Measure the skill, read the mistakes, rewrite it, then
  repeat…" entirely.

### The table needs to explain itself

Today a cell says `12/12` and a newcomer asks "12 of what?", and sees `12/12` beside `6/6`
and asks why the counts differ. Facts to design around:

- A cell is *runs that passed every check / runs*. The denominator differs between columns
  because (a) the unaided arm was run in both benchmark rounds, so **without skill pools
  both rounds** (3 + 3 per task) while before and after have 3 each; (b) a few tasks were
  set to more runs later (`concepts-goal-001` has 5 after-runs, `wallets-goal-004` has 7).
- The comparison that matters is the **pass rate**, not the raw count.

So: make the **pass rate the primary value** in every cell (e.g. `100%` with the bar), and
the fraction the secondary, smaller (`12 of 12 runs`). Keep both — the fraction is the
honesty. Put a one-line legend directly above the table, not a footnote below it:
*"Each cell: share of runs that passed every check. Without skill pools the unaided runs of
both rounds, so it has more runs."* Column headers should read as sentences a newcomer
gets: **Without skill · With skill, before rewrite · With skill, after rewrite** (a group
header "With skill" over the two is fine). Consider whether a different arrangement reads
better than one wide table — e.g. one compact card per skill with the three rates and the
line count — and pick whichever a first-time reader parses faster; the table is acceptable
if the legend and headers do the work.

### Skill page

- The headline "12/12 passed after vs 12/12 without skill" does not explain itself. Restate
  it as a sentence with the definitions inline, e.g. **"With the rewritten skill, the model
  passed 100% of runs (12 of 12). Without any skill: 100% (12 of 12). The original skill:
  92% (11 of 12)."** Or a three-tile strip — *Without skill · Before rewrite · After
  rewrite* — each tile showing the rate large, the fraction small, and the line count under
  the two skill tiles. Either way: the three numbers, labelled in words, no "vs".
- "not totalled" under a task name says nothing to a newcomer. Label the row with the
  **reason in words**: *checks rewritten between rounds* or *added after the first round*,
  and keep the explanatory sentence under the table. Consider muting the whole row.
- The results table gets the same legend line and the same primary-rate / secondary-fraction
  cells as the front page.

### The diff

Long lines force horizontal scrolling. Use `@pierre/diffs`' `overflow: "wrap"` option so
lines fold, and check the split view still reads on a phone (fall back to unified view
below ~700px if split with wrapping is unreadable).

### Everywhere

Words over symbols, definitions next to numbers, no paragraph where a list will do. Keep
the vocabulary rules from the design brief. Re-check every page at 375px for sideways
scroll after the changes (use a real viewport — `agent-browser set viewport 375 812`, then
`eval 'document.documentElement.scrollWidth'` — not headless Chrome's window size).

## 12. Review round 2 (Shiv, 2026-09-07) — no messy rows at all, and plainer words

Decision: the site shows **only rows that are a clean comparison**. A task is on the site
only when its without / before / after cells were all graded on the same checks and every
side has runs. Tasks that fail that are excluded at index time, the same way retired tasks
are — not shown, not labelled, not explained. In a real clean re-run nothing is excluded,
so this rule costs nothing later and removes every "not totalled", every row reason and
every explanatory sentence today.

- Implement the exclusion in the selection step (`lib/showcase.ts` / `build-index`), using
  the same rubric logic `compareEntry` uses to decide whether a row is totalled: drop a
  task from `tasks` (and its runs) when its three cells do not share one rubric or a side
  has no runs. Print one stderr note per entry listing what was excluded and why
  (`showcase wallets (claude-opus-5): excluded wallets-quiz-002 (checks rewritten between
  rounds), wallets-goal-002 (no runs before the rewrite)`). This is a note, not a warning:
  it must not fail `--strict`.
- Remove `concepts` from the manifest: it would be left with one task. Six skills remain:
  addresses (4 tasks), l2s (4), protocol (2), wallets (3), security (6), orchestration (3).
- With no messy rows possible, delete the row-reason labels, the `explanations` sentences
  and the "N of M tasks with matching checks" qualifiers from the pages, and the
  now-unreachable code in `compare.ts` (keep the rubric check itself — it is what the
  selection uses — and keep tests for it). Totals cover every row shown. Update the
  real-data test to the new counts.

Wording:

- Define **rate** where it first appears, in words a newcomer gets. Legend above every
  results table, exactly: *"Pass rate: the share of runs in which the model passed every
  check. Without skill has more runs because the no-skill runs from both rounds are counted
  together."* Drop the second legend line ("Rates use tasks with matching checks…") — it no
  longer applies.
- Front page lede: *"… each measured before and after a rewrite, on the same model."*
  ("on one model" → "on the same model".)
- Skill page headline stays a sentence; make sure it says "pass rate" once, e.g. *"With the
  rewritten skill the model's pass rate was 100% (9 of 9 runs). Without any skill: 100% (18
  of 18). With the original skill: 100% (9 of 9)."* Drop the "These rates cover N of M
  tasks" line under it (every task counts now); keep "A run passes only if it passes every
  check."
- Anywhere else the word "pools"/"pooled" appears, replace it with plain words.

## 13. Copy pass — apply `site/UNSLOP.md` to every user-facing string

Read `site/UNSLOP.md` and apply it to all site copy: page intros, the four pointers, the
collapsible, legends, headings, column headers, the skill headline sentence, the usage
block copy, footnotes, empty states ("No runs", "not recorded"), button labels, the
footer. Do not change any number, any vocabulary rule from the design brief, or the
meaning of a legend. Curly quotes become straight quotes everywhere in JSX text.
Headings in sentence case. No em dashes; the "→" between two numbers in a cell stays.
Where a sentence could sit unchanged on any benchmark site, make it specific to this one
or delete it.

## 14. Back-merge of Rinat's branch (2026-09-11)

`origin/site/results-frontend` moved 30+ commits past our fork point: two merges of `main`
(new runs for audit, frontend-playbook, qa, testing) and two review rounds that changed the
data contract. Merged at his `215e243e`. What was taken from each side:

- **His, wholesale:** `site/derived.json` (never hand-merge it), `site/yarn.lock`, everything
  under `artifacts/`, `tasks/`, `skills/`, `reports/`, `mistakes/`, `site/src/lib/data.ts`
  (plus our two copy strings), `site/src/pages/Doc.tsx`, `scripts/build-index.ts` with our
  hook re-applied on top.
- **Ours:** `lib/showcase.ts`, `site/src/lib/compare.ts`, the four pages, `styles.css`, the
  tests, the manifest. `Marker.tsx`, `notes.ts` and `Writeups.tsx` stay deleted.

Contract changes absorbed:

- A rubric is two fingerprints. `Run.rubric` is the checks (`expect_sha`), `Run.prompt` is
  the prompt (`input_sha`); `Task` carries both for today's file. `sameRubric` requires both
  to match across the three columns, since a reworded prompt is not the same task either.
  The exclusion note says "prompt rewritten between rounds" when only the prompt moved.
- `Run.lineage` and `Run.reading` name a reading's source run and its place in the order.
  `newest` in `compare.ts` keeps the newest reading present, however many hops apart, and no
  longer needs `superseded_by`.
- Prose left `index.json`. Skill texts, report markdown and PR bodies live in
  `site/public/docs.json`, fetched once by `useDocs()` when a skill or document page opens.
  The Skill page builds its diff from there. `docs.json` is written unfiltered.
- `index.json` is written compact.

Kept as decided, against his side: `runModel` (D4) rather than his `modelOf`. His compare
labels a run without `executor_model` as "(model unrecorded)" and marks a model mismatch
with a `◊`. Ours infers the model from the judge when the record says the judge was the
same agent, and the manifest names the model, so there is nothing to mark. The tension is
noted in the PR description for him to see.

Checks after the merge: tsc at root and in `site/`, 79 tests, `yarn build-index --strict
--no-prs` with no warnings and `site/derived.json` byte-identical to his, `site/` build,
375px viewport check on `/`, `/skill/wallets`, `/task/wallets-goal-001`. Selection
unchanged: 22 tasks, 234 runs.

### Entries checked after the back-merge

The runs that arrived from `main` were checked for a clean before/after on one model:

- **frontend-playbook, claude-opus-5: added.** Two versions measured on the same model across
  all 8 live tasks, nothing excluded, same checks and prompt throughout. Caveat for the copy:
  the `before` version (`13df4b400c54`, 394 lines) is the long arm from
  `reports/frontend-playbook-opus5-2026-09-05.md`, the full structure with the #56
  corrections applied, not the 362-line pre-cut original (`c00a0bedc1b8`), which was never
  run on opus-5. The report chose it so that length is the only difference between the arms.
  The skill page's "original" wording is loose for this entry.
- **frontend-playbook, claude-opus-4-8: not added.** The original and the rewrite were both
  run on opus-4.8, but exclusions remove goal-001 (no runs after the rewrite), goal-002 and
  quiz-005 (checks rewritten). Those are exactly the three tasks the skill changes the
  outcome on; the five that survive are all passes in every column.
- **qa: not added.** The original (439 lines) has runs only on opus-4.8, the minimal version
  (66 lines) only on opus-5, and there on two goals only.
- **testing: not added.** One version measured (379 lines); the 59-line minimal has no runs.
- **audit: not added.** One version measured (72 lines).
