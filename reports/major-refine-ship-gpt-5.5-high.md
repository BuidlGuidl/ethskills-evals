# eval: ship (GPT 5.5 high)

| | |
| --- | --- |
| Benchmark id | `major-refine-d9952522` ([#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)) |
| Benchmark commit | `d99525222883df0b32decbfb81e1a13f9c27cfed` |
| Executor | `codex` · `gpt-5.5` · effort `high` |
| Judge | `claude` · `claude-opus-5` · effort `high` — `self_judged: false` on every run |
| Arms | none (`skill_version: null`) · old (`2f0adb01`) · new (`d9952522`) |
| Runs | 3 per arm per task, 5 tasks, 45 executions; 44 graded, 1 ungradeable (below) |
| Tasks | `ship-goal-001`, `ship-quiz-001`, `ship-quiz-002`, `ship-quiz-003`, `ship-quiz-004` (every live task with `skill: skills/ship`) |

Both skill refs were installed through `--skill-ref`, so neither arm read the working tree.
Both are reachable from `HEAD` (`git merge-base --is-ancestor`). The trigger was not forced:
these are trigger-inclusive numbers.

## Pass counts — new · old · none

| Task | new | old | none |
| --- | --- | --- | --- |
| `ship-goal-001` | **3/3** | **3/3** | **0/3** |
| `ship-quiz-001` | 3/3 | 2/2 | 3/3 |
| `ship-quiz-002` | 3/3 | 3/3 | 3/3 |
| `ship-quiz-003` | 3/3 | 3/3 | 2/3 |
| `ship-quiz-004` | 3/3 | 3/3 | 3/3 |

Denominators are **graded** runs, not runs attempted. One run could not be graded and is
excluded from the counts rather than deleted — see "Run incidents". Two goal-001 runs that
were ungradeable when this report was first written were graded on 2026-09-24 off their
surviving workspaces (incident 2 below), which took the skill arms of goal-001 from 2/2 to
3/3.

One task discriminates. Three of the four quizzes are saturated on this stack: quiz-001,
quiz-002 and quiz-004 pass every graded run across all three arms (9/9, quiz-001 8/8
graded), and on quiz-004 all nine runs picked
Base. quiz-003 gave up one `none` run. Everything interesting is in `ship-goal-001`.

## What happened on ship-goal-001

`none` scored 0/3 for a reason the aggregate hides: **all three `none` runs shipped zero
Solidity files.** They built an Express/Vite web app with USDC represented as an in-app ledger
and said so plainly — "USDC is represented as an application ledger balance in this first
version", "escrow, refunds, and late-fee payouts are simulated in app state", "so developers
can run the product locally without a wallet, RPC endpoint, or smart contract". All six
skill runs built real contracts (hardhat ×2, foundry ×4).

Per-expect, where `pass` means the check held:

| Expect | new | old | none |
| --- | --- | --- | --- |
| 1 — at most two custom contracts | 3/3 | 3/3 | 3/3 |
| 2 — photos/notes/profiles off contract storage | 3/3 | 3/3 | 3/3 |
| 3 — no onchain reputation score or ranking view | 3/3 | 3/3 | 3/3 |
| 4 — fee/deposit move only on a named party's tx | 3/3 | 3/3 | 3/3 |
| 5 — README names the caller for every USDC transition | 3/3 | 3/3 | 2/3 |
| 6 — README names a concrete deployment target + steps | 3/3 | 3/3 | **0/3** |

Expects 1–4 are all phrased as prohibitions, so a run with no contracts satisfies every one of
them vacuously. The `none` column's four clean rows are not agreement with the skill; they are
the absence of the thing being checked. Only expect_6 actually caught it, 3/3, and expect_5
caught one run. That is an eval weakness, not a skill result — see the last table.

## The old skill pulls the bundle; the new one does not

Counting transcripts for a `curl`/`web_search` against `https://ethskills.com/<skill>/SKILL.md`:

| Arm | Runs that fetched another ethskills skill |
| --- | --- |
| none | 0/15 |
| old (`2f0adb01`) | **8/15** — goal-001 3/3, quiz-001 2/3, quiz-003 1/3, quiz-004 3/3, quiz-002 0/3 |
| new (`d9952522`) | 0/15 |

The old text (318 lines) advertises "All skills are at `https://ethskills.com/<skill>/SKILL.md`"
and runs act on it mid-task, pulling `audit`, `wallets`, `gas`, `qa` and `frontend-playbook`.
The new text (81 lines) rewords it to "Fetch another focused skill **only when** the plan
reaches that phase and needs its detail", and no new-arm run fetched anything.

Every task's `notes:` asks for this to be recorded, and it matters for reading the table
above: where the old arm fetched, **its pass counts and its cost describe ship-plus-what-it-
fetched, not ship.** The new arm's numbers are ship alone. The two `with_skill` columns are
therefore not quite like-for-like even though they pass identically, and the cost gap below
is partly the bundle. Filed as `ship-old-skill-pulls-the-bundle-gpt-5.5-high`.

## Cost

All figures from `yarn run-stats --benchmark major-refine-d9952522`, medians with ranges.
Codex dollars are `cost_source: list_price` — the run's token split priced at OpenAI's
standard-tier list price in `lib/prices.ts`, not what the operator was billed, and the
>272K long-context surcharge is ignored. `turns` is null on codex. `n` is executions, so
the three ungradeable runs are included here even though they carry no grade.

| Task | Arm | n | duration | cost (list) | cost range | total tokens |
| --- | --- | --- | --- | --- | --- | --- |
| `ship-goal-001` | none | 3 | 451s | $1.22 | $1.03–$2.16 | 664,075 |
| `ship-goal-001` | old | 3 | 850s | $2.57 | $2.28–$3.87 | 2,031,669 |
| `ship-goal-001` | new | 3 | 751s | $2.02 | $1.69–$2.32 | 1,603,358 |
| `ship-quiz-001` | none | 3 | 104s | $0.27 | $0.24–$0.49 | 103,557 |
| `ship-quiz-001` | old | 3 | 124s | $0.36 | $0.34–$0.47 | 186,243 |
| `ship-quiz-001` | new | 3 | 125s | $0.33 | $0.29–$0.37 | 157,414 |
| `ship-quiz-002` | none | 3 | 64s | $0.18 | $0.17–$0.21 | 76,628 |
| `ship-quiz-002` | old | 3 | 83s | $0.24 | $0.20–$0.25 | 108,017 |
| `ship-quiz-002` | new | 3 | 80s | $0.21 | $0.20–$0.22 | 96,439 |
| `ship-quiz-003` | none | 3 | 137s | $0.34 | $0.27–$0.40 | 88,300 |
| `ship-quiz-003` | old | 3 | 116s | $0.31 | $0.27–$0.55 | 130,552 |
| `ship-quiz-003` | new | 3 | 190s | $0.60 | $0.34–$0.92 | 204,361 |
| `ship-quiz-004` | none | 3 | 138s | $0.46 | $0.44–$0.83 | 151,375 |
| `ship-quiz-004` | old | 3 | 169s | $0.83 | $0.40–$0.94 | 332,427 |
| `ship-quiz-004` | new | 3 | 125s | $0.53 | $0.36–$0.70 | 179,271 |

Both skill arms cost more than `none` on every task — the skill buys the goal task and pays
for it on the saturated quizzes, which is the `ship-scope-token-overhead` pattern already on
record for gpt-5.6-sol. New is cheaper than old on four of five (goal-001 $2.02 vs $2.57,
quiz-001 $0.33 vs $0.36, quiz-002 $0.21 vs $0.24, quiz-004 $0.53 vs $0.83) and dearer on
quiz-003 ($0.60 vs $0.31, ranges $0.34–$0.92 against $0.27–$0.55 — overlapping at n=3, so
read it as noise rather than a regression). On goal-001 the new text saves 21% of the tokens
and 99s of wall clock while passing the same checks; part of that saving is simply not
fetching four other skills.

## Run incidents

Three of 45 runs produced no grade when the benchmark first ran. Two of them (incident 2)
were graded on 2026-09-24 and are counted above; one (incident 1) remains ungraded. None
of the incidents is a model result.

1. **`ship-quiz-001` old run 3** (`2026-09-21T202932Z-codex-with-skill-2f0adb01-3`) — judge
   blindness. The run fetched `ethskills.com/audit/SKILL.md` and the
   `austintgriffith/evm-audit-skills` repo, then wrote nine `evm-audit-*` namespace ids into
   `plan.md`. A `none` run has no path to those ids, so this is a genuine variant leak and
   `lib/blindness.ts` says to record it as an incident rather than grade it. Not re-rolled:
   re-running until a sample does not leak would bias the arm.
2. **`ship-goal-001` old run 3** (`2026-09-22T013242Z-codex-with-skill-2f0adb01-3`) and
3. **`ship-goal-001` new run 3** (`2026-09-22T014656Z-codex-with-skill-d9952522-3`) —
   evidence too large for the judge, **since resolved**. Codex's sandbox blocks npm's default
   `~/.npm`, npm falls back to `./.npm-cache` inside the workspace, and `.npm-cache` is not in
   `GENERATED_DIRS` (`lib/workspace.ts`), so `verify`'s bare-task snapshot swept 20M and 14M of
   cache blobs into `output/`. `claude -p` refuses piped stdin over 10MB (`Error: piped stdin
   input exceeds 10MB`), so the judge spawn died with `spawnSync env EPIPE`. Reproduced
   directly outside the harness. Two of eight goal-001 runs hit it; the real deliverables were
   170K and 190K. New run 3 also tripped the blindness guard on a single incidental hit — a
   `github.com/circlefin/skills/.../use-usdc/SKILL.md` URL cited as a USDC reference, which
   says nothing about the variant — and was re-run with `--allow-skill-mention` per the
   guard's instruction; it still could not be graded for the size reason.

   **Resolution (2026-09-24, on PR review):** the judge had died before `verify` could grade
   or delete, so both workspaces survived under `EVAL_WORKSPACE_ROOT` with their `result.yaml`
   carrying no grade. `.npm-cache/` was deleted from each workspace — executor output was
   untouched — and `verify` re-run as a first grade with the benchmark's judge
   (`claude-opus-5` · high, `--allow-skill-mention` again on new run 3). Both graded 6/6
   (`expect_sha` matches the other seven goal-001 grades), and the snapshot the judge read is
   byte-identical to the evidence already committed for them. Precedent: #160, #161, #182.

Preventing a recurrence means editing `lib/workspace.ts`, which the benchmark's byte-identical
harness check forbids on a branch, so it is raised on #119 rather than patched here. Until the
2026-09-24 regrade it had cost the old and new arms of goal-001 one sample each; the goal-001
row is now n=3 in every arm.

Fifteen further runs were set up and died before producing anything: eight on a codex usage
limit ("You've hit your usage limit ... try again at 10:13 PM"), which stopped the benchmark
for four hours, and the rest on the same quota or as dead runs from it. All were deleted and
set up again per AGENTS.md; none was graded. Committed evidence for the two oversized runs is
their deliverable with `.npm-cache` omitted, which is exactly what the judge saw at the
2026-09-24 grading; the cache blobs are not part of the answer.

## Mistake records filed

| id | source | none | old | new |
| --- | --- | --- | --- | --- |
| `ship-goal-deployment-decision-gpt-5.5-high` | goal-001 expect_6 | 3/3 | 0/3 | 0/3 |
| `ship-goal-readme-transition-audit-gpt-5.5-high` | goal-001 expect_5 | 1/3 | 0/3 | 0/3 |
| `ship-state-transition-incentive-gpt-5.5-high` | quiz-003 expect_2 | 1/3 | 0/3 | 0/3 |
| `ship-old-skill-pulls-the-bundle-gpt-5.5-high` | transcripts | 0/15 | 8/15 | 0/15 |

These use `none`/`old`/`new` keys nested under a `codex/gpt-5.5-high` stack key. AGENTS.md
prescribes per-stack keys for a mistake measured on more than one stack; the three-arm shape
does not fit the `no_skill`/`with_skill` pair, and this is the first three-arm record in
`mistakes/`. Earlier two-arm measurements of the first three live in their unsuffixed and
`-gpt-5.6-sol` siblings, unchanged.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **new vs none: `3/3 vs 0/3` on goal-001, `3/3 vs 2/3` on quiz-003, `3/3 vs 3/3` on the other three.** new vs old: identical everywhere both were graded — `3/3 vs 3/3` on goal-001 and three quizzes, `3/3 vs 2/2` on quiz-001. The refine changed no pass count on this stack. |
| Did it reduce time/tokens? | Against `none`, no — it costs more on all five tasks (goal-001 $2.02 / 751s / 1.60M vs $1.22 / 451s / 664k). Against `old`, yes on four of five: goal-001 $2.02 / 751s / 1.60M vs $2.57 / 850s / 2.03M (−21% tokens), quiz-004 $0.53 vs $0.83, quiz-001 $0.33 vs $0.36, quiz-002 $0.21 vs $0.24; quiz-003 went up, $0.60 vs $0.31, on overlapping ranges at n=3. |
| Did it create negative deltas? | One candidate: quiz-003 cost roughly doubled against `old` while staying 3/3. Ranges overlap at n=3, so it is not established. No pass-rate regression anywhere. |
| What mistakes repeated without the skill? | `ship-goal-deployment-decision-gpt-5.5-high` (3/3), `ship-goal-readme-transition-audit-gpt-5.5-high` (1/3), `ship-state-transition-incentive-gpt-5.5-high` (1/3). |
| What mistakes remained with the skill? | None of the graded ones — 0/3 on both skill texts. `ship-old-skill-pulls-the-bundle-gpt-5.5-high` was present in the old arm at 8/15 and is fixed in the new one. `ship-scope-token-overhead` persists in both arms as a cost, not a failed check. |
| What should change in the skill? | Nothing this run justifies. Both texts pass identically, and the refine already fixed the one behavioural defect measured (bundle-fetching) while cutting goal-001 tokens 21%. The open question is the cost the skill adds on saturated quizzes, which is a scoping question the existing `ship-scope-token-overhead-gpt-5.6-sol` record already states. |
| What should change in the eval? | **goal-001's expects 1–4 are vacuously satisfiable.** All three `none` runs shipped no Solidity at all and passed every one of those four prohibitions; only expect_6 caught them. The task needs a positive check that USDC custody and settlement are actually enforced onchain — `ship-quiz-002` expect_4 already has exactly this shape and goal-001 lacks it. Without it, a run that builds no blockchain scores 4/6 and, on a slightly softer expect_6, would have scored 6/6. **Second, three of four quizzes are saturated** (9/9 across all arms; quiz-004 got the same chain from all nine runs) and measure nothing on this stack — retire or harden them. **Third**, `.npm-cache` belongs in `GENERATED_DIRS`, and `lib/judge.ts` should cap assembled evidence below the CLI's 10MB stdin limit rather than dying with `EPIPE` at the end of a paid run. |
