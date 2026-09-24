# major-refine: qa (Opus 5 medium)

| | |
| --- | --- |
| Benchmark id | `major-refine-d9952522` |
| Stack | executor `claude` / `claude-opus-5` / effort `medium` |
| Judge | `claude` / `claude-opus-5` / effort `high` |
| `self_judged` | **true** on every run. A caveat on the numbers, not a defect in them. |
| Runs | 3 per arm per task, 3 arms, 7 tasks = 63 runs |
| Arms | **none** = `no_skill`; **old** = `with_skill` @ `2f0adb01` (439 lines); **new** = `with_skill` @ `d9952522` (68 lines) |
| Tasks | `qa-goal-001`, `qa-goal-002`, `qa-quiz-001..005` |
| Trigger | not forced; content-only numbers |
| Harness | every run `executor_exit: 0`, no `harness_failure`, no retractions, no regrades |

**Template pre-flight** (`qa-goal-001`/`002`, template `templates/qa-target`): `yarn install`, then the two checks its notes name — the contract compiles (`yarn compile` → solc 0.8.30) and nextjs typechecks (`yarn next:check-types` → exit 0). Hardhat flavor, not foundry. Node v25.9.0 emits a `--localstorage-file` warning during compile; harmless for these checks, but worth knowing if a task ever needs `next build`.

**Five runs graded with `--allow-skill-mention`** — see "Run incidents".

## Headline

Pass counts, **new · old · none**:

| Task | new | old | none |
| --- | --- | --- | --- |
| qa-quiz-001 | 3/3 | 3/3 | 3/3 |
| qa-quiz-002 | 3/3 | 3/3 | 3/3 |
| qa-quiz-003 | 3/3 | 3/3 | 3/3 |
| qa-quiz-004 (mobile deep link) | **1/3** | **2/3** | 0/3 |
| qa-quiz-005 | 3/3 | 3/3 | 3/3 |
| qa-goal-001 (audit pass, 18 lines) | **3/3** | **3/3** | 0/3 |
| qa-goal-002 (audit pass) | **3/3** | **3/3** | 0/3 |
| **Total** | 17/21 | **18/21** | 12/21 |

Two separate stories, and they point opposite ways.

### The goal tasks are where this skill earns its place

`qa-goal-001` and `qa-goal-002` are both **3/3 · 3/3 · 0/3**. These are the audit-shaped tasks — a finished dApp seeded with checklist violations, no check ever named — and unaided runs fail all six attempts. The skill's designed use is exactly this, and both texts deliver it equally. That is the strongest single-task signal in any of the four rows I have run.

Note the baseline is not empty: `templates/qa-target` ships SE-2's own `AGENTS.md` **and eight skills** under `.agents/skills/` (`drizzle-neon`, `eip-5792`, `erc-721`, `openzeppelin`, `ponder`, `siwe`, `subgraph`, `x402`). None is `qa`, so the contrast is clean for the skill under test, but "no_skill" here means *no qa skill*, not *no skills*.

### qa-quiz-004: the first measured regression of the rewrite

This is the only task across all four rows I have run (l2s, noir, orchestration, qa) where **the old text outscores the rewrite**. One line discriminates — expect_2, the deep-link ordering *and delay*:

| arm | expect_2 | delay the run proposed |
| --- | --- | --- |
| none | 0/3 | 0ms, none, "1 second after" |
| **old** | **2/3** | both passes: `setTimeout(openWallet, 2000)` |
| **new** | **1/3** | pass: 750ms · **both failures: exactly 300ms** |

The mechanism is not in doubt. The old `SKILL.md` carries the figure, the code and the reason:

> L269 `setTimeout(openWallet, 2000); // Switch to wallet AFTER request is relayed`
> L279 **"Why 2 seconds?"** `writeContractAsync` must estimate gas, encode calldata, and relay the signing request through WalletConnect's servers. **300ms is too fast** — the wallet won't have received the request yet.

The rewrite keeps the ordering rule (L59: "Any redirect fires the write first…") and drops the magnitude and the rationale. **Both failing new-arm runs land on 300ms — the exact value the deleted sentence names as too fast.**

Strength, stated honestly: 2/3 against 1/3 at n=3 is a one-run difference and would be noise on its own. What lifts it above noise is that the failure value is the specific number the deleted text warns against, in both failures, and that no unaided run gets the line either. This is a content gap the compression introduced, not a sampling artefact — but it wants a second stack before anyone treats the rate as precise.

`mistakes/qa/qa-deeplink-delay-magnitude.yaml` anticipated this exactly and left it open, recording that quiz-004 "was deliberately skipped… the magnitude facet has no reading on this stack and this record cannot be closed on it." This row is that reading, and it reverses the record's working assumption that deleting the figure was harmless. Updated, still `open`.

### The rest is saturated

Quizzes 001, 002, 003 and 005 are 9/9 across all three arms — four of seven tasks measuring a ceiling, at ~250k tokens per arm each.

## Cost

From `yarn run-stats`, split per arm. Medians with ranges; `cost_source: executor`.

| Task | arm | turns | duration | cost | cost range | total_tokens |
| --- | --- | --- | --- | --- | --- | --- |
| goal-001 | new | 17 | 164s | $1.08 | $0.95–$1.18 | 632,510 |
| | old | 16 | **154s** | **$1.10** | $0.92–$1.12 | 636,278 |
| | none | 30 | 359s | $2.13 | $1.81–$2.45 | 1,716,795 |
| goal-002 | **new** | 45 | **359s** | **$3.35** | $2.46–$10.48 | **2,710,547** |
| | old | 62 | 663s | $4.63 | $4.40–$8.16 | 4,974,867 |
| | none | 52 | 505s | $3.10 | $2.80–$6.33 | 3,324,196 |
| quiz-001 | new | 5 | 59s | $0.26 | $0.25–$0.30 | 82,816 |
| | old | 3 | 71s | $0.29 | $0.23–$0.30 | 63,088 |
| | none | 3 | 76s | $0.29 | $0.25–$0.32 | 63,639 |
| quiz-002 | new | 3 | 50s | $0.23 | $0.21–$0.26 | 61,971 |
| | old | 6 | 47s | $0.29 | $0.21–$0.32 | 113,356 |
| | none | 3 | 44s | $0.21 | $0.20–$0.23 | 60,216 |
| quiz-003 | new | 6 | 51s | $0.26 | $0.26–$0.29 | 82,344 |
| | old | 6 | 65s | $0.33 | $0.33–$0.37 | 112,090 |
| | none | 4 | 77s | $0.30 | $0.25–$0.31 | 81,559 |
| quiz-004 | new | 5 | 114s | $0.40 | $0.28–$0.47 | 96,429 |
| | old | 5 | 99s | $0.39 | $0.29–$0.40 | 100,744 |
| | none | 3 | 126s | $0.41 | $0.41–$0.44 | 73,192 |
| quiz-005 | new | 5 | 69s | $0.33 | $0.30–$0.37 | 90,211 |
| | old | 6 | 68s | $0.39 | $0.35–$0.41 | 108,332 |
| | none | 3 | 75s | $0.28 | $0.26–$0.30 | 61,947 |

**On the goal tasks the skill pays for itself outright.** `goal-001`: both skill arms find every violation in ~160s and ~630k tokens, against 359s and 1.72M unaided — for a *better* result (3/3 vs 0/3). Doing the audit without the checklist costs 2.7× the tokens and still fails.

`goal-002` is where the rewrite separates from the old text: 359s/2.71M/$3.35 against 663s/4.97M/$4.63 — 54% of the wall clock on 54% of the tokens for the same 3/3. Its range is wide ($2.46–$10.48, one slow run), so read the token figure rather than the dollar median.

On the quizzes the arms are within a few cents of each other; nothing there is a finding.

## Run incidents

**Judge-blindness guard, 5 runs** (`goal-001` ×2, `goal-002` ×3): `no_skill` ×3, `d9952522` ×1, `2f0adb01` ×1. Every hit is a `[skill install path]` match on `.agents/skills/ponder/SKILL.md` or similar, written into the deliverable as a recommendation to move event indexing off `getLogs`.

These are incidental beyond reasonable doubt, and more clearly so than the comparable orchestration case:

1. **The path is template content.** `templates/qa-target/AGENTS.md:238` instructs the reader "read `.agents/skills/<name>/SKILL.md` before implementing", and the template ships `ponder` among its eight skills. Runs are citing a convention their own workspace taught them.
2. **Three of the five are `no_skill` runs** producing the identical string, which is a direct demonstration that the mention carries no variant information.
3. The cited skill is `ponder`, not `qa` — nothing points at the skill under test.

Graded with `--allow-skill-mention`, following the ship-row precedent. Unlike the orchestration row there is no residual inference channel to caveat here: a judge seeing this string cannot distinguish the arms, because all three arms produce it.

**Rate limit, 4 runs.** Four runs hit the account session limit across the row. Each was deleted before grading, re-queued, and re-executed after capacity returned (~10 minutes each time); other workers paused rather than burning into the same wall, and round 2 drained all four. **No work lost, nothing graded over a refusal.** The same fault destroyed 17 runs on the noir row.

**Checked and absent:** `lib/` evidence loss, truncated run stats (all 63 runs' `usage.duration_s` within 1s of the `executor.yaml` wall clock), backgrounded-install truncation.

## Mistakes

No new records. `qa-deeplink-delay-magnitude` re-measured and substantially rewritten — it had explicitly flagged this reading as missing, and the reading reverses its working assumption. Still `open`; the suggested fix is one clause, not the restored 439-line section.

The other six qa records were not exercised as failures: with both goal tasks at 3/3 in both skill arms, no seeded violation went unflagged with the skill.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **new vs none: 17/21 vs 12/21**, and the whole gap is the two goal tasks — `3/3 · 3/3` against `0/3 · 0/3`. On its designed use, an audit pass over a finished build, the skill is the difference between finding the violations and finding none. **new vs old: 17/21 vs 18/21** — the rewrite is *behind* by one run, entirely on `qa-quiz-004` expect_2. |
| Did it reduce time/tokens? | Against `no_skill`, decisively on the goals: `goal-001` `164s / 633k` (new) vs `359s / 1.72M` (none) — 37% of the tokens for a 3/3 instead of 0/3. Against the old text, on `goal-002`: `359s / 2.71M / $3.35` vs `663s / 4.97M / $4.63`. Quizzes are a wash. |
| Did it create negative deltas? | **Yes — the first one in four rows.** `qa-quiz-004` expect_2: old 2/3, new 1/3, because the rewrite dropped the 2-second delay figure and its rationale, and both failing runs used the 300ms the deleted text explicitly calls too fast. One run wide at n=3; mechanism confirmed by diffing the two texts against the deliverables. |
| What mistakes repeated without the skill? | `qa-deeplink-delay-magnitude` (quiz-004 e2, 3/3 wrong unaided), plus every seeded violation in both goal tasks going unflagged 3/3. |
| What mistakes remained with the skill? | With **new**: `qa-deeplink-delay-magnitude`, 2/3. With **old**: the same, 1/3. |
| What should change in the skill? | **One clause.** Restore a magnitude and a reason to the deep-link line: fire the write first, then redirect after ~2s, because the request has to be gas-estimated, encoded and relayed — sub-second arrives before the wallet has anything to sign. Do not restore the 439-line section; the rewrite is equal-or-better everywhere else and much cheaper on `goal-002`. This is the one place in four rows where compression cost something measurable. |
| What should change in the eval? | **(1) Four of seven tasks are saturated at 9/9** and measure a ceiling. **(2) The two goal tasks carry the entire new-vs-none signal** and are 18 expect lines each — they are the row worth keeping and worth hardening. **(3) The judge-blindness guard has a false positive built into this template**: `qa-target/AGENTS.md` tells executors to cite `.agents/skills/<name>/SKILL.md`, so any run recommending an indexer trips it, in every arm. Either exempt `[skill install path]` hits that match a skill the template itself ships, or pre-authorise `--allow-skill-mention` in these tasks' notes. It fired on 5 of 63 runs here and 5 of 45 on orchestration, and each firing is currently a per-operator judgment call. **(4) `result.yaml` stores no judge rationale.** |
