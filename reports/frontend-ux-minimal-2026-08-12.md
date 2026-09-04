# frontend-ux (minimal revision) — goal eval

## The brief

The prompt this run was given, verbatim:

```text
We're evaluating skills/frontend-ux — the minimal revision checked out
on this branch, cut to ~360 words. The benchmark asks whether the
shorter skill still moves the goal outcomes; run it standalone, with
no comparisons to prior runs.

Before anything else, report your setup to the runner: which harness
you are running on, which model this session runs on, the exact
executor and judge models the runs will use, the current git branch,
and the version of the skill under test (git log -1 --format=%h --
skills/frontend-ux/SKILL.md, plus its word count — expect ~360 words,
not ~1100). This benchmark should run claude with model claude-opus-5
as executor and judge, one stack start to finish. If this session is
on a different model, tell the runner to start a new session, switch
with the /model command, and paste this prompt again there. If the
branch is main or the skill is the long version, stop and tell the
runner to check out the right branch. Wait for their ok before the
first run.

You are the orchestrator. Read AGENTS.md at the repo root and follow
"Running a pre-crafted task" and "The loop" exactly. This run is goals
only — the quizzes are out of scope for this benchmark:

  - tasks/frontend-ux-goal-001.yaml: the rules applied unprompted in a
    staking build on the SE-2 template
  - tasks/frontend-ux-goal-002.yaml: the same habits with no scaffold,
    stack choice included

One reading note: goal-001 runs on the SE-2 template, whose own
AGENTS.md and bundled guidance can carry a no_skill run; goal-002
strips the scaffold to isolate that. Read the pair against each other,
per their notes. The workspace seeds under templates/ are already
installed; verify them against the notes before the first run.
Executors may git-commit inside the workspace — capture goal-001
evidence as the git diff against the pristine template baseline.

Run both goals, both variants, 3 runs each (12 total). Runs are
append-only; re-run only on infrastructure failures, never because of
a result, and record every recovery in the report's integrity notes.
Each task's notes tell you what to mine from the transcripts; treat
that as part of the job.

When all runs are graded, commit the artifacts and the report
(reports/frontend-ux-minimal-<date>.md, ending with the required
table) to this branch, and give the runner the headline table with
per-expect pass counts for both variants.
```

**Skill under test:** `skills/frontend-ux` @ `32547c9`, 359 words (the minimal revision; the
prior vendored version was ~1100 words). Branch `skill/frontend-ux-minimal`.

**Stack:** one stack start to finish — executor `claude` @ `claude-opus-5`, judge `claude` @
`claude-opus-5`, Claude Code CLI 2.1.228 on darwin. 3 runs per variant per goal, 12 runs total,
all graded.

**`self_judged: true` on all 12 runs.** Executor and judge are both `claude`, which is what
AGENTS.md prescribes for a one-stack benchmark ("claude → opus, executor and judge both"). The
judge still ran as a fresh, blind process per run (`--judge-agent claude --judge-model
claude-opus-5`), seeing only task input + evidence — never the variant, the skill, or the
transcript. Flagged here as the record requires.

**Scope:** goals only. The frontend-ux quizzes were out of scope for this benchmark, so every
number below is applies-unprompted, not knows-when-asked.

**Trigger:** content-only. No forced trigger line was used, and all 6 `with_skill` runs invoked
the skill on their own (`{"skill":"frontend-ux"}` in the transcript). The skill's description
earns its own trigger on both a scaffolded and a bare dApp build.

## Headline

| Goal | Workspace | `no_skill` | `with_skill` |
| --- | --- | --- | --- |
| goal-001 (USDC staking) | SE-2 template | **0/3** (7/8, 6/8, 7/8) | **3/3** (8/8, 8/8, 8/8) |
| goal-002 (USDC payments) | bare | **0/3** (3/6, 4/6, 4/6) | **3/3** (6/6, 6/6, 6/6) |

Every `with_skill` run passed every expect. No `no_skill` run passed either goal outright.

## Per-expect pass counts

### goal-001 — SE-2 template

| # | Rule | `no_skill` | `with_skill` |
| --- | --- | --- | --- |
| e1 | approve/stake gating, one primary action | 3/3 | 3/3 |
| e2 | per-button pending through confirmation | 3/3 | 3/3 |
| e3 | USDC 6 decimals end to end | 3/3 | 3/3 |
| e4 | USD context / ETH gas balance priced | 2/3 | 3/3 |
| e5 | human-readable tx errors | 2/3 | 3/3 |
| e6 | product identity (metadata + branding) | 1/3 | 3/3 |
| e7 | theme tokens, coherent light/dark | 3/3 | 3/3 |
| e8 | retargeted at Base, polling healthy | 3/3 | 3/3 |

### goal-002 — bare workspace

| # | Rule | `no_skill` | `with_skill` |
| --- | --- | --- | --- |
| e1 | ENS-resolving recipient field | 3/3 | 3/3 |
| e2 | USDC 6 decimals end to end | 3/3 | 3/3 |
| e3 | ETH gas balance priced in USD | **0/3** | 3/3 |
| e4 | send button pending state, released on reject | 3/3 | 3/3 |
| e5 | human-readable tx errors | 2/3 | 3/3 |
| e6 | product identity (title, favicon, OG/social) | **0/3** | 3/3 |

No expect regressed with the skill. Every movement is `no_skill` → `with_skill` upward.

## Reading the pair: how much was the template?

goal-002's notes call for reading the two goals against each other on the shared rules, because a
`no_skill` run can pass much of goal-001 on SE-2's own AGENTS.md and bundled skills. Strip the
scaffold and the shared rules separate cleanly:

| Shared rule | goal-001 `no_skill` (SE-2) | goal-002 `no_skill` (bare) | Reading |
| --- | --- | --- | --- |
| Fiat context | 2/3 | **0/3** | **The template was carrying it.** SE-2 ships the native-currency price ready to use; with nothing to lean on, no run wired a price source at all. |
| Product identity | 1/3 | 0/3 | Fails either way — the scaffold does not help, it supplies the defaults that get left behind. |
| Token decimals | 3/3 | 3/3 | Model habit, not template. USDC's 6 decimals survive a bare workspace. |
| Per-button pending | 3/3 | 3/3 | Model habit, not template. |
| Error translation | 2/3 | 2/3 | Same rate both ways; unaffected by the scaffold. |

So goal-001's respectable `no_skill` per-expect numbers are partly SE-2 talking. The two rules
that fail with or without a scaffold — identity and fiat context — are the two the minimal skill
leads with.

**Stack choice with no scaffold (goal-002's other mining question):** all six runs, both variants,
independently picked Next.js App Router + wagmi + viem + RainbowKit + TanStack Query, with a
`src/` tree split into `components/` and `hooks/`. Identical across variants — the skill changes
habits, not stack selection, and the model reaches for the production-standard stack unprompted.

## What the skill actually changed

Traceable skill → artifact links, from the graded evidence:

- **Fiat context.** `with_skill` goal-002 runs wired a real price source where `no_skill` runs had
  none — a `usePrices` hook reading Chainlink `latestRoundData`. One run's `UsdValue` component
  implements the skill's stale-price line directly, commented *"a missing or stale price is
  labelled rather than silently omitted — a number with no caveat reads as current."*
- **Product identity.** `with_skill` goal-002 runs shipped `openGraph` and `twitter` metadata
  blocks plus generated `icon.svg`, `opengraph-image.tsx`, `apple-icon.tsx`. `no_skill` runs set a
  tab title and stopped there — no OG block, no favicon file anywhere.
- **Diff size.** goal-001 `with_skill` diffs run 85–95 KB against 62–66 KB for `no_skill`. The
  extra surface is metadata and fiat plumbing, i.e. the skill's own subject.

## Mistakes filed

Two of these were already on file from #27 (2026-07-24, opus-4.8, the long skill); this run adds a
`claude/claude-opus-5` stack line to each record rather than a second record for the same mistake.
The third is new.

- `metadata-left-as-template-default` — no_skill 5/6, with_skill 0/6 (6/6, 0/6 in July).
  Ships under someone else's identity. On SE-2, no run touched `layout.tsx` (all three still export `'Scaffold-ETH 2 App'`)
  though all three rewrote `Header.tsx` — the visible half gets renamed, the metadata half does
  not. On bare, the inverse: real title, but zero OG/twitter/favicon.
- `eth-balance-no-usd-context` — no_skill 4/6, with_skill 0/6 (same in July). ETH gas balance rendered as bare
  token units; on the bare workspace there is no price source in the tree at all.
- `frontend-ux-unsurfaced-tx-error` — no_skill 2/6, with_skill 0/6. Failure path modeled and never
  rendered: one run `console.error`s both tx failures; another derives an `'error'` status in
  `useSendUsdc`, then falls through to `return null` in `TxStatus` because only `'reverted'` has a
  branch — a wallet rejection shows the user nothing.

## Grading precision

One judge call is softer than the expect line it graded: goal-001 `no_skill` run 2 passed e6
("page metadata **and** visible branding are updated") on the strength of its `Header.tsx` rewrite
while its `layout.tsx` metadata was untouched, exactly like runs 1 and 3 which were failed on the
same expect. By file evidence the metadata half is 0/3, so e6's recorded 1/3 understates the
mistake and the true `no_skill` gap is slightly wider than the table shows. It does not change any
run's overall pass/fail (run 2 already failed on e4 and e5).

## Cost and time

Not a clean win, and it points the other way on the scaffolded goal:

| Goal | Variant | Mean wall-clock | Mean cost |
| --- | --- | --- | --- |
| goal-001 | `no_skill` | 25.8 min | $11.28 |
| goal-001 | `with_skill` | 30.0 min | $13.85 (**+23%**) |
| goal-002 | `no_skill` | 24.7 min | $7.51 |
| goal-002 | `with_skill` | 20.1 min | $6.29 (−16%) |

goal-001 `with_skill` costs more — it is doing strictly more work (metadata, price plumbing). The
goal-002 direction is the reverse but should not be read as a saving: those runs executed under
different concurrency than their `no_skill` counterparts, so wall-clock there is confounded.
Token cost is not concurrency-confounded, and it splits by goal rather than favoring either
variant. Call it: no consistent time/token effect, with a real cost premium on the scaffolded
build.

## Integrity notes

Runs are append-only. No run was re-executed because of its result.

1. **`verify.ts` `git add -N` bug — grading blocked on the first three runs, fixed in this
   branch.** The diff-evidence path had never been exercised on a template workspace: without a
   pre-seeded `.git`, `verify` always takes the snapshot path instead. With one,
   `git add -N -- . :(exclude)node_modules …` exits 1 (*"The following paths are ignored by one of
   your .gitignore files: node_modules"*) — exclusion magic makes git enumerate ignored entries,
   while a bare `.` skips them silently. Fixed in `scripts/verify.ts`: the intent-to-add now takes
   a bare `.`, while `diff` and `status` keep the full exclusion pathspec, so evidence content is
   unchanged. Verified no skill leak: `grep -c frontend-ux run.diff` = 0 on all 12 runs. The three
   affected runs were **re-graded only, never re-executed** — they had errored before writing
   `pass`.
2. **goal-001 `with_skill` batch aborted at ~23 min (run ids `2026-08-12T1301{39,40,41}Z`).** All
   three executors ended `error_during_execution` at an identical `duration_ms` of 1382.5 s with
   work uncommitted — an external kill of the launching process, not a result. Discarded
   (incomplete, ungraded) and re-run under new run ids `2026-08-12T1328{32,34,35}Z`. Executors were
   thereafter launched detached in their own session (macOS has no `setsid(1)`; `perl -MPOSIX -e
   'POSIX::setsid()'` does the job), after which two further launcher/waiter kills left every
   executor running untouched. The `claude` invocation itself is byte-identical across all 12 runs.
3. **A second set of run ids (`2026-08-12T1328…`) was created before the detach fix landed and
   never executed** — `setsid` was missing, so nothing launched and the workspaces sat pristine
   (template + baseline commit, no transcript, no evidence). Those same untouched dirs were reused
   for the real run rather than burning fresh ids.
4. **Evidence method.** Executors commit inside the workspace (both prompts ask for committed
   code), which would leave `verify`'s `git diff` empty. Each workspace was therefore `git init`-ed
   and committed to a pristine baseline **before** the executor started, and reset with
   `git reset --mixed <baseline>` **after** it finished — worktree untouched, index and HEAD back
   to pristine — so `run.diff` renders exactly the changes against the pristine template. Applied
   uniformly to both goals and both variants. No workspace source file was edited by the
   orchestrator.
5. **goal-002 lockfiles** (`package-lock.json` et al.) were added to each workspace's
   `.git/info/exclude` so a 500 KB lockfile could not swamp the judge's evidence. No expect depends
   on lockfile contents; `.git/info/exclude` is not part of the deliverable.
6. Workspaces deleted after grading, per hard rule 5. `run.diff`, `result.yaml` and transcripts are
   committed.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes. goal-001 `3/3 vs 0/3`; goal-002 `3/3 vs 0/3`. Every `with_skill` run passed every expect (8/8 and 6/6); no `no_skill` run passed either goal. |
| Did it reduce time/tokens? | No. goal-001 `with_skill` cost +23% ($13.85 vs $11.28) and ran ~4 min longer — it does strictly more work. goal-002 ran cheaper with the skill (−16%) but under different concurrency, so that direction is not trustworthy. No consistent effect. |
| Did it create negative deltas? | None in grading — no expect regressed, in either goal. The only cost is the token premium above. |
| What mistakes repeated without the skill? | `metadata-left-as-template-default` (5/6), `eth-balance-no-usd-context` (4/6), `frontend-ux-unsurfaced-tx-error` (2/6). |
| What mistakes remained with the skill? | None. All three are 0/6 with the skill. |
| What should change in the skill? | Nothing, on this evidence. The 359-word revision still moves both goals from 0/3 to 3/3 and triggers unprompted 6/6, so the cut did not cost it the outcomes. Two of its four headline bullets are unbacked *by this eval* rather than wrong: **Address inputs** (goal-002 e1 passes 3/3 unprompted — ENS resolution is already habit; quiz-005 is its real coverage) and **Target chain** (goal-001 e8 passes 3/3 unprompted, and its notes say the expect only discriminates downward). Do not cut either on this alone — a goal eval cannot show a rule's value when the model already has the habit. The two bullets carrying the whole delta are **Product identity** and **Fiat context**; keep them first. |
| What should change in the eval? | Three gaps. (1) **e6 is two conditions in one** — "metadata *and* branding" let a run pass on branding alone with template metadata intact; split into a metadata expect and a branding expect so the judge cannot trade one for the other. (2) **goal-001 is saturated at the top** — e1/e2/e3/e7/e8 are 3/3 in both variants and cost a full 25-minute SE-2 build to measure nothing; goal-002's bare workspace is where the discrimination lives, and is the model to follow for future rules. (3) **`verify`'s diff path was untested for template workspaces** — it took a pre-seeded `.git` to find a bug that would have silently produced empty evidence; worth a fixture test now that the fix is in. |
