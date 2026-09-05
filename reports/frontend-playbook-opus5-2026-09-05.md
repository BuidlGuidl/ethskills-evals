# Eval report — frontend-playbook on claude-opus-5, two skill revisions

**Skill:** `skills/frontend-playbook`, two revisions measured as separate `with_skill` arms
**Executor:** `claude`, `claude-opus-5` — fresh spawn per run
**Judge:** `claude`, `claude-opus-5` — fresh blind process spawned by `verify`
**Runs:** 72 graded — 24 `no_skill`, 24 short arm, 24 long arm; `runs: 3` per task per arm
**Node:** 25.9.0 for every run
**Date:** 2026-09-05

Every run is `self_judged: true` — judge and executor are the same agent on a
single-stack benchmark. That is a caveat on the numbers, not a defect in them.

## Why this pass exists

The previous pass (`reports/frontend-playbook-2026-08-19.md`) ran on
`claude-opus-4-8` and reused #31's `no_skill` columns. Review on #56 raised two
things that pass could not answer:

1. **goal-001 was graded on Node 22.** expect_10 only fires on Node 25+, where the
   built-in `localStorage` global lacks the Web Storage methods and the static
   prerender crashes. On Node 22 the crash never happens, so a build carrying no
   remedy at all grades as a pass. All three of those runs are now marked
   `retracted:` and are excluded from every count here.
2. **Stacks cannot be blended.** Moving to `claude-opus-5` meant re-measuring both
   variants, not carrying #31's baseline forward. That is what this pass does.

A third question came out of the review and is answered here directly: the concision
cut in #56 removed six sections no task in this benchmark grades. Rather than settle
that by argument, both revisions were run as arms against one shared baseline.

## The two arms

Both are `variant: with_skill`, differing only by `skill_version`, which is what
`run-stats --skill-version` filters on. Same tasks, same expect lines, same judge,
same executor model, same Node.

| Arm | `skill_version` | SKILL.md |
| --- | --- | --- |
| short | `adf4348` | the concision cut as this PR proposes it — 636 words |
| long | `468e990` | the same corrections applied to the full structure — 2,444 words |

The long arm is **not** the pre-cut original. It carries every correction the #31
evidence supports — fork scoping, the `create-eth` pin, fork-powered funding,
interval vs manual mining, the corrected Node 25 explanation with all three
process-level remedies, the qualified CID claim — applied to the restored structure.
Comparing against the uncorrected 1,919-word original would have confounded length
with the corrections, and the corrections were never what the review disputed.

## Results

| Task | `no_skill` | short `adf4348` | long `468e990` |
| --- | --- | --- | --- |
| quiz-001 | 3/3 | 3/3 | 3/3 |
| quiz-002 | 3/3 | 3/3 | 3/3 |
| quiz-003 | 3/3 | 3/3 | 3/3 |
| quiz-004 | 3/3 | 3/3 | 3/3 |
| quiz-005 | **0/3** | 3/3 | 3/3 |
| quiz-006 | 3/3 | 3/3 | 3/3 |
| goal-001 | **0/3** | 3/3 | 3/3 |
| goal-002 | **0/3** | 3/3 | 3/3 |
| **total** | **15/24** | **24/24** | **24/24** |

The skill's value is concentrated in exactly three tasks — quiz-005, goal-001,
goal-002 — and is total in all three: **0/9 unaided, 9/9 with either revision**. The
other five quizzes are 3/3 in all three arms; the model already knows that material.

### Where `no_skill` actually fails

Per-expect failure counts across the three `no_skill` runs:

| Task | Expect | Fails |
| --- | --- | --- |
| goal-001 | 6 — clean rebuild (`rm -rf .next out`) | **3/3** |
| goal-001 | 7 — changed CID as proof | 2/3 |
| goal-001 | 9 — OG metadata → production URL | 2/3 |
| goal-001 | 10 — Node 25 remedy | 2/3 |
| goal-001 | 1–5, 8 | 0/3 |
| goal-002 | 1 and 2 — SE2 generator, scaffolded tooling | **3/3** each |
| quiz-005 | 4 | **3/3** |

Opus 5 unaided gets the whole fork-mode half of goal-001 right — fork not chain, real
USDC, fork-powered funding, `chains.foundry`, `trailingSlash` — and every run checked
a non-home route on the gateway. It fails on deployment discipline. **expect_6 is the
hard floor: not one unaided run deleted `.next`/`out` before a production build.**

## Cost — where the arms separate

All figures from `yarn run-stats`; none typed. Medians with ranges beside them.
`total_tokens`, never `input_tokens`.

**Goal tasks (n=3 per cell):**

| Task | Arm | Duration | Cost (median) | Cost range | Tokens |
| --- | --- | --- | --- | --- | --- |
| goal-001 | `no_skill` | 1974s | $16.99 | $16.65–$18.84 | 15.9M |
| goal-001 | short | 2419s | $19.59 | $12.71–$22.48 | 24.7M |
| goal-001 | long | 3048s | $25.37 | $18.97–$28.61 | 27.5M |
| goal-002 | `no_skill` | 1368s | $8.35 | $7.01–$9.98 | 9.5M |
| goal-002 | short | 1235s | $6.22 | $5.21–$6.35 | 7.0M |
| goal-002 | long | 1735s | $9.23 | $8.11–$12.72 | 11.3M |

**Quiz tasks, median cost:**

| Task | `no_skill` | short | long |
| --- | --- | --- | --- |
| quiz-001 | $0.64 | $0.41 | $0.44 |
| quiz-002 | $0.28 | $0.22 | $0.28 |
| quiz-003 | $0.33 | $0.31 | $0.32 |
| quiz-004 | $0.91 | $0.37 | $0.33 |
| quiz-005 | $0.41 | $0.21 | $0.28 |
| quiz-006 | $0.39 | $0.30 | $0.33 |

The short arm is cheaper than the long arm on both goals and on five of six quizzes.
**Read the ranges before the medians.** goal-001's arms overlap ($12.71–22.48 vs
$18.97–28.61) and at n=3 that comparison does not support a strong claim on its own.
goal-002 separates cleanly ($5.21–6.35 vs $8.11–12.72) and is the firmer evidence.

Note also that on goal-002 the short arm is **cheaper than `no_skill`** ($6.22 vs
$8.35) while scoring 3/3 against 0/3: reaching for the generator costs less than
hand-rolling a stack badly.

## What this does not establish

Equal pass rates do **not** show the cut sections were safe to remove. No task here
exercises Vercel configuration, ENS subdomain setup, the production checklist, the
four verification phases, "Don't Do These" or Resources — goal-001's own notes call
the Vercel path, ENS and RPC hygiene "left uncovered on purpose." **The eval cannot
regress on that material by construction.** What the arms show is that removing it
cost nothing across the eight tasks that exist, and saved 25–50% on goal-task cost.
Whether that trade is right is a judgment about the skill's audience, not a result
this benchmark produced.

The `description` also narrowed from "any Ethereum frontend project" to SE2 + IPFS.
Nothing in this benchmark grades trigger behaviour, so that change is likewise
unmeasured.

## Operator calls that had to be made

**`--allow-skill-mention` on six runs.** `verify` refuses to grade when the assembled
evidence carries a skill mention, since the judge would learn the variant. Two
distinct causes, each read before clearing:

- *`create-eth` boilerplate* — every goal-002 run that actually scaffolds emits
  `output/AGENTS.md:238`, `**Skills** (read `.agents/skills/<name>/SKILL.md` before
  implementing):`. This is generator output: the identical line sits at line 238 of
  both committed templates, and the list it heads names openzeppelin, erc-721,
  eip-5792, ponder, siwe, x402, drizzle-neon and subgraph. `frontend-playbook` is
  named nowhere in any evidence file.
- *indexer citations in prose* — some goal-001 runs recommend moving the tip feed to
  an indexer and cite `.agents/skills/ponder/SKILL.md` or `.../subgraph/SKILL.md`.

Both are incidental, and the proof is that **the same citation appears in a
`no_skill` run**, which has no `.agents/` directory at all. It is a model habit
carried from SE2/BuidlGuidl priors, not evidence of an installed skill.

Worth stating plainly: the boilerplate case lands almost entirely on `with_skill`
runs, because only runs that scaffolded have an AGENTS.md and the `no_skill` runs
mostly hand-rolled. The override permits grading; it does not change what the judge
is asked or shown.

**Runs lost to session usage limits.** Two limit windows killed runs mid-flight.
Those run dirs were deleted and re-run from scratch, never graded — no partial work
entered any table. One goal-001 run died 34 minutes in having spent $14.93.

## Mistakes

`frequency` in `mistakes/frontend-playbook/` is now nested per `<executor>/<model>`,
since a second stack has been measured. Two records moved:

- **`deploy-verify-home-route-only` is 0/3 unaided on opus-5**, down from 2/3 on
  opus-4-8. Every unaided run checked a non-home route on the gateway. The model has
  absorbed this one; the record stays `open` because the skill still prevents it and
  a single stack is thin evidence for closing it.
- **`node25-localstorage-fix-wrong-layer` is 0/3 on quiz-004** (was 1/3), but still
  2/3 on goal-001 expect_10. Knowing the fix when asked and applying it unprompted
  remain different things.

The opus-4-8 `with_skill` half of `node25-localstorage-fix-wrong-layer` rests partly
on the three goal-001 runs since retracted for having been graded on Node 22. It is
kept as recorded history and should not be read as a live measurement.

## A gap in expect_10 this pass exposed

goal-001 `no_skill` run 1 hit the Node 25 crash, diagnosed it, and routed around it
by pinning `.nvmrc` to `22`, documenting: *"Node 20.18.3 – 24.x (`nvm use` — see
`.nvmrc`). Node 25 breaks the Next.js prerender."*

expect_10 admits only a process-level `localStorage` remedy or explicitly dealing
with the crash-prone pages, so the judge scored it `fail`. Pinning the toolchain
below 25 is a third answer the line does not contemplate: it ships a working build,
but the project then cannot build on Node 25 at all.

This was left alone rather than fixed mid-benchmark — AGENTS.md is explicit that a
reworded expect means **regrade, never re-run**, and a regrade has to cover every run
of the task. It needs deciding before the next pass: does pinning Node count as
handling the crash? Part of any expect_10 gap between arms currently measures the
rubric's enumeration rather than the skill.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `15/24 → 24/24`. Concentrated in quiz-005, goal-001, goal-002: `0/9 → 9/9`. Identical on both revisions. |
| Did it reduce time/tokens? | On goal-002 yes — short arm `1235s / 7.0M tok / $6.22` vs `no_skill` `1368s / 9.5M / $8.35`. On goal-001 no: `2419s / 24.7M / $19.59` vs `1974s / 15.9M / $16.99`. It buys the result with more work, not less. |
| Did it create negative deltas? | None on correctness. The long revision costs 25–50% more than the short one for identical grades. |
| What mistakes repeated without the skill? | `deploy-no-clean-rebuild-no-cid-proof` (3/3), `scaffold-manual-not-create-eth` (3/3), `frozen-timestamp-wrong-oneoff-fix` (3/3), `og-metadata-not-prod-url` (2/3), `node25-localstorage-fix-wrong-layer` (2/3 on goal-001) |
| What mistakes remained with the skill? | None — 0/3 on every mistake, on both revisions |
| What should change in the skill? | Nothing the data demands. The concision is free on everything measured and cheaper to run, so the short revision ships. The removed sections remain unmeasured, which is an argument for new tasks, not for restoring text blindly. |
| What should change in the eval? | (1) expect_10 must decide whether pinning Node below 25 counts as handling the crash. (2) Nothing covers Vercel, ENS, the production checklist or trigger behaviour, so the eval cannot see the largest change this PR makes. (3) Five of six quizzes are 3/3 in every arm and no longer discriminate — they are regression guards now, not measurements. |
