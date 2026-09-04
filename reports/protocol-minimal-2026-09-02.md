# eval: minimal `protocol` skill (claude)

Closes the last unmeasured skill reduction in the repo. `skills/protocol` was cut from
267 lines to 24 in #59 and merged without a benchmark; this is that benchmark.

**Skill:** `skills/protocol` @ `e3aea23` — 24 lines, 216 words (the minimal version from
`578499e`, 2026-08-11). The 2026-07-25 baseline measured the vendored 267-line / 1,931-word
version at `2f0adb0`.
**Executor:** `claude`, model `claude-opus-5`, fresh spawn per run.
**Judge:** `claude`, model `claude-opus-5`, fresh blind process spawned by `verify`.
**`self_judged: true` on all twelve runs** — one claude stack, executor and judge the same
agent. Each grade ran in a process that never saw the variant, the skill, or the transcript,
but it is a caveat on the numbers and is stated here rather than buried.
**Dates:** `with_skill` 2026-09-02, `no_skill` 2026-09-03. Twelve runs, 3 per task per
variant, both arms measured on the same harness.

## Why the `no_skill` arm was re-measured

The first version of this report carried the `no_skill` arm over from 2026-07-25 rather than
re-running it. The argument for that was sound as far as it went: `git log` on both task specs
shows exactly one commit since that benchmark — `67c6e6d`, which touched only `notes:` — so
every `input:` and every `expect:` line was byte-identical to what the July runs were graded
against, and all six July `result.yaml` files carry `judge.agent: claude`,
`judge.model: claude-opus-5`, `self_judged: true`, the same judge stack used here.

It was still the wrong call, for a reason this repo had already learned once. On the wallets
reduction (#96), carrying stale unaided arms forward was the blocking review finding, and
re-measuring same-day **moved the pass column** — `3/3 vs 3/3` became `3/3 vs 1/3` and
`3/3 vs 2/3` on two tasks (`33a3acfc`), over a three-to-five week gap where the rubric had not
moved either. This gap was five and a half weeks. And the July records cannot settle it
after the fact: those runs left `output/` gitignored and their `transcript.md` holds the final
assistant message alone (2.2–3.6 KB), so their grades are not re-checkable by anyone.

So the six `no_skill` runs were re-run on 2026-09-03, same harness, same executor and judge
stack, `output/` force-added. **The carry-over turned out to be right** — the arm re-measures
at 6/6, unchanged — but that is now a measurement rather than an inference, and the left
column of the headline rests on committed evidence like the right one does. Cost of settling
it: $8.75.

Two things the July runs still cannot support, and which this re-run does not fix:

- They predate `input_sha` and `expect_sha`, so their records cannot self-certify the rubric.
  All twelve 2026-09 runs carry both.
- They predate `executor.yaml` and the `## run stats` footer, so they carry no
  `executor_model` and no `usage` block, and no cost or duration comparison against the
  267-line era is recoverable from them.

## Ground truth revalidated before the first run

Both task notes carry dated ground truth ("as of 2026-07") and instruct a revalidation,
because quiz `expect_4` and goal `expect_2` grade against **current** fork scope rather than a
frozen line. Checked 2026-09-02, before any run:

| Check | Status | Source |
| --- | --- | --- |
| EIP-7864 (unified binary tree) | **Draft**, no fork assignment | [eip-7864](https://eips.ethereum.org/EIPS/eip-7864) |
| EIP-8297 (partitioned binary tree, the 7864 consolidation) | **Draft**, no fork assignment | [eip-8297](https://eips.ethereum.org/EIPS/eip-8297) |
| EIP-7748 (state conversion) | **Draft**, no fork; `CONVERSION_START_TIMESTAMP` still TBD | [eip-7748](https://eips.ethereum.org/EIPS/eip-7748) |
| Glamsterdam scope | 18 SFI — ePBS (7732), BALs (7928), 8037/8038 state-access repricings, and others. **No state-tree migration.** | meta [EIP-7773](https://eips.ethereum.org/EIPS/eip-7773) |
| Hegotá scope | FOCIL (7805) the only scheduled EIP; meta still Draft with ~66 proposals under review. **No state-tree migration.** | meta [EIP-8081](https://eips.ethereum.org/EIPS/eip-8081) |

Glamsterdam's list has grown a lot since July — 3 named EIPs then, 18 SFI now — but nothing in
it touches the state tree. **The assumption the expects rest on is unchanged: no confirmed
fork schedules a binary-tree or stateless state migration.**

## Headline

| Task | `no_skill` (re-measured 2026-09-03) | `with_skill` @ 24 lines |
| --- | ---: | ---: |
| `protocol-quiz-001` | 3/3 | **3/3** |
| `protocol-goal-001` | 3/3 | **3/3** |
| **total** | **6/6** | **6/6** |

For reference, on 2026-07-25 the 267-line `with_skill` arm was 6/6 and `no_skill` was 6/6.

**The reduction held the line.** Every expect passed in every run — 9 expect lines across two
tasks, 54 judgements across both arms, zero failures. Cutting 267 lines to 24 cost nothing
measurable on this rubric, which is the question #102 asked.

It is worth being exact about what that does and does not prove. `no_skill` is at 6/6 too, on
runs made the day after the skilled ones: **the prior these tasks test is not stale for
`claude-opus-5`**, and it was not stale in July either. The tasks were already saturated
before the cut, and a saturated task cannot detect a regression it was never able to detect.
What this benchmark establishes is that the 24-line version does not introduce a *new* failure
on a rubric where the model is at ceiling on both sides — a real but bounded result, and the
same bound the 2026-07-25 report carried.

## Per-run records

All twelve exited 0. No run was killed, and no transcript contains a session-limit message.
All twelve carry `input_sha` and `expect_sha`.

| Task | Run | Expects | Duration | Cost | Total tokens |
| --- | --- | --- | ---: | ---: | ---: |
| quiz | `171647Z…with-skill-1` | 4/4 | 235s | $1.12 | 489,038 |
| quiz | `172129Z…with-skill-2` | 4/4 | 221s | $1.07 | 333,289 |
| quiz | `172529Z…with-skill-3` | 4/4 | 261s | $1.18 | 441,825 |
| quiz | `190420Z…no-skill-1` | 4/4 | 268s | $1.21 | 318,622 |
| quiz | `190421Z…no-skill-2` | 4/4 | 227s | $0.90 | 257,378 |
| quiz | `190422Z…no-skill-3` | 4/4 | 206s | $0.85 | 218,475 |
| goal | `171716Z…with-skill-1` | 5/5 | 371s | $1.97 | 532,019 |
| goal | `172352Z…with-skill-2` | 5/5 | 449s | $2.79 | 2,234,999 |
| goal | `173158Z…with-skill-3` | 5/5 | 331s | $1.64 | 445,095 |
| goal | `190423Z…no-skill-1` | 5/5 | 479s | $2.13 | 790,557 |
| goal | `190424Z…no-skill-2` | 5/5 | 426s | $2.00 | 643,118 |
| goal | `190424Z…no-skill-3` | 5/5 | 395s | $1.66 | 526,953 |

Durations and costs are `yarn run-stats --tasks protocol-quiz-001,protocol-goal-001 --runs`;
token totals are the `usage.total_tokens` the harness wrote into each `result.yaml`.

| Task | Variant | n | Median turns | Median duration | Median cost | Cost range | Median tokens |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |
| quiz-001 | `no_skill` | 3 | 15 | 227s | $0.90 | $0.85–$1.21 | 257,378 |
| quiz-001 | `with_skill` @ 24 lines | 3 | 27 | 235s | $1.12 | $1.07–$1.18 | 441,825 |
| goal-001 | `no_skill` | 3 | 34 | 426s | $2.00 | $1.66–$2.13 | 643,118 |
| goal-001 | `with_skill` @ 24 lines | 3 | 42 | 371s | $1.97 | $1.64–$2.79 | 532,019 |

**The two arms were not run at the same concurrency, and only the duration column is
affected.** All six `no_skill` runs were launched together — `created` timestamps
`19:04:20` through `19:04:25` — so they ran 6-way concurrent and thinned out as the quiz runs
finished (6 concurrent for the first ~208s, 2 by 397s). The `with_skill` arm ran sequentially
*within* each task and the two tasks overlapped each other, so it was 2-way concurrent for all
but its last goal run. Contention inflates unaided wall-clock: the unaided `227s` and `426s`
are upper bounds, and the skilled `235s` and `371s` are closer to clean. Turns, tokens and cost
are unaffected. `33a3acfc` matched concurrency on the wallets rewrite for exactly this reason;
these runs did not, and the duration column below should be read with that in mind.

**The skill costs turns and buys nothing on the clock.** On quiz it runs 27 turns against 15
and $1.12 against $0.90 — roughly 25% more cost for the same 4/4, and the clock is a wash
(235s vs 227s) or worse for the skill once the unaided contention is allowed for. On goal the
medians appear to cross — more turns (42 vs 34) but *less* wall-clock (371s vs 426s) at
effectively the same cost ($1.97 vs $2.00) — but that 55s is the one delta that runs in the
skill's favour and it is also the one the concurrency gap eats first: a 6-way-contended unaided
arm is exactly how a 55s "saving" appears without the skill saving anything. **Read goal as no
measured clock difference, not as a saving.** Neither delta is worth much at n=3, both sit
inside the arms' own ranges, and they are reported because the runs now exist to report them,
not because three runs settle a 25% cost question.

The goal spread is wide enough to matter: `with-skill-2` ran 2.23M tokens against 445k and
532k for its siblings — a 4x outlier inside n=3, driven by a much longer search: 55 turns,
including a 51 MB shallow clone of `ethereum/forkcast` and greps through its committed EIP
markdown and ACDE call-note JSON. The median is reported with its range for exactly this
reason.

**There is no cost comparison against the 267-line version, and cannot be.** All twelve
2026-07-25 runs predate the `## run stats` footer, so `run-stats` prints
`3 (3 with no footer)` and a dash for every cell on both of that benchmark's arms. The July
report does carry hand-timed wall-clock averages (quiz `with_skill` ~7m13s, goal ~10m00s)
which would suggest the minimal version is substantially faster than the full one — but those
were assembled by keyboard, not by the harness, and this repo's rules say a number
`run-stats` cannot produce does not go in a table. Measuring it would mean re-running the
267-line skill on today's harness: 6 runs, ~35 minutes, ~$10. That was not in scope for #102
and was not done.

## Did the habit survive the cut?

Pass counts cannot answer this, because both arms sit at ceiling. The behavior the skill
installs — check live sources, report fork status in the process's own vocabulary, refuse to
give an unscheduled feature a ship date — is visible in the transcripts, and full-session
capture (`--output-format stream-json`, added since July) makes it directly measurable rather
than inferred, which is the fix the July report asked for. With both arms now run on that
capture, it is measurable *against a control* for the first time.

**Live-source checking is not what the skill adds.** All twelve runs checked live sources and
no run in either arm asserted fork status from memory; all twelve fetched `eips.ethereum.org`.
The unaided runs got the substance right too: **all six name Verkle as dropped**, which is why
they pass.

Catching the *stale page* is a separate and much rarer thing, and worth keeping separate from
the Verkle call. Only **2/6** unaided runs flag `ethereum.org/roadmap/verkle-trees` itself —
quiz `n1` ("as of today it still presents Verkle as an active initiative") and quiz `n2`
("**stale**, still presents Verkle as the active plan"). Goal `n1` flags a *different*
ethereum.org page (`/roadmap/statelessness`, "cites 2023 figures"); goal `n2` and `n3` warn
that outlets and articles are out of date rather than ethereum.org; quiz `n3` says nothing
about staleness at all. Nothing in the rubric grades the catch, so the 4/6 that miss it still
pass.

**What the skill adds is which sources and which vocabulary**, and here the arms separate
cleanly:

| Signal | `no_skill` | `with_skill` @ 24 lines |
| --- | ---: | ---: |
| deliverables mentioning `forkcast` | **0 / 6** | **6 / 6** |
| transcripts touching `forkcast.org` at all | **0 / 6** | **6 / 6** |
| deliverables using SFI/CFI/DFI status vocabulary | 1 / 6 | **6 / 6** |
| runs pulling both fork-scope metas (7773 + 8081) by name | 1 / 6 | 4 / 6 |

That first row is the skill's one concrete instruction doing exactly what #59 replaced the
hardcoded Fork Process table with: a pointer to forkcast. Not one unaided run found forkcast
on its own, in either task, and not one used it in a deliverable. The metas row is the weakest
of the four and cuts both ways — the skilled arm is 4/6, not 6/6, so the pointer moves *where*
runs look more reliably than it moves *how completely*.

Per-run detail, over the committed deliverable in both arms. Sizes are decimal kB
(bytes ÷ 1000) throughout — an earlier version of this table mixed kB on the skilled rows
with KiB on the unaided ones:

| Task | Variant | Run | `forkcast` mentions | SFI/CFI/DFI uses | Deliverable |
| --- | --- | --- | ---: | ---: | ---: |
| quiz | `no_skill` | n1 | 0 | 2 | 15.7 kB |
| quiz | `no_skill` | n2 | 0 | 0 | 12.0 kB |
| quiz | `no_skill` | n3 | 0 | 0 | 9.7 kB |
| quiz | `with_skill` | w1 | 3 | 6 | 8.9 kB |
| quiz | `with_skill` | w2 | 2 | 4 | 13.2 kB |
| quiz | `with_skill` | w3 | 2 | 5 | 13.4 kB |
| goal | `no_skill` | n1 | 0 | 0 | 30.1 kB |
| goal | `no_skill` | n2 | 0 | 0 | 30.1 kB |
| goal | `no_skill` | n3 | 0 | 0 | 28.2 kB |
| goal | `with_skill` | w1 | 1 | 15 | 23.5 kB |
| goal | `with_skill` | w2 | 5 | 15 | 29.3 kB |
| goal | `with_skill` | w3 | 5 | 15 | 23.0 kB |

On the meta EIPs specifically: quiz `w1`, quiz `w3`, goal `w1` and goal `w3` pulled both
EIP-7773 (Glamsterdam) and EIP-8081 (Hegotá) from `eips.ethereum.org` by name. Quiz `w2`
resolved fork scope from `forkcast.org` and `eipsinsight.com` instead (its `eips.ethereum.org`
fetches were 2935, 7709 and 7864, none of them a meta); goal `w2` from `forkcast.org` plus a
shallow clone of `ethereum/forkcast`, where it read the repo's own `public/eips/7773.md` and
its committed ACDE call-note JSON, and never touched 8081. In the unaided arm only goal `n2`
fetched both metas and goal `n3` fetched 7773 alone; the other four fetched neither.

**None of this can be compared to the equivalent table in `reports/protocol-2026-07-25.md`.**
That report's source-checking counts are not reproducible from committed evidence: the July
runs committed only `result.yaml` and a `transcript.md` that holds the final assistant message
alone (2.2–3.6 KB), and their `output/` was left gitignored, so the deliverables those counts
were taken over no longer exist anywhere. Recounting the July committed files with the same
greps gives 0–5 where the report prints 3–26. The July table is a record of an observation
that can no longer be audited. The table above is the replacement, and both of its arms are
committed.

Content-wise the six skilled deliverables land the claim cleanly. Representative, from quiz `w2`:

> **Do not build around Verkle trees.** That is precisely the design the protocol is
> moving *away* from — it has been dropped from the roadmap.
>
> **The binary tree has no ship date, because it has no fork.** It is not merely
> "unscheduled for the next fork" — it has no fork relationship whatsoever.

No brief presented Verkle as the coming relief, none claimed a scheduled fork for the state-tree
migration, and none leaned on EIP-4444 as the state-growth fix. All three goal briefs
name history expiry (4–8 mentions each) and every one of them scopes it correctly to chain
history rather than the state trie — `w3` spells it out in a table cell: "**Does not help
archive nodes** — an archive node keeps this by definition." `w1` went further and flagged
that ethereum.org's own `/roadmap/statelessness` page is stale on 4444's shipping status,
preferring the fork meta EIPs as authoritative — the skill's habit applied to a source the
skill never names. That one is not exclusive to the skilled arm: unaided goal `n1` flags the
same page, on a different ground (its 2023 archive-size figures).

## Mistakes

None filed. Zero expect failures across twelve runs, in either arm, leaves nothing to record,
and a mistake record invented from a passing run is noise.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No, and neither did the version it replaced. `6/6 with_skill` @ 24 lines vs `6/6 no_skill`; the 267-line version was also `6/6`. The prior these tasks test is not stale for `claude-opus-5`, so both arms sit at ceiling |
| Did it reduce time/tokens? | Not against the 267-line version — all twelve 2026-07-25 runs predate the `## run stats` footer, so `run-stats` has no duration, cost or token figure for either of that benchmark's arms. Against an unaided control on the same harness it costs rather than saves on quiz (`27 turns / 235s / $1.12` vs `15 / 227s / $0.90`) and roughly breaks even on goal (`42 / 371s / $1.97` vs `34 / 426s / $2.00`) — n=3 a side, inside the arms' own ranges. The duration cells are not comparable like-for-like: the unaided arm ran 6-way concurrent against the skilled arm's 2-way, which inflates unaided wall-clock and accounts for goal's apparent 55s saving. Turns, tokens and cost are unaffected |
| Did it create negative deltas? | None on the rubric — no expect regressed. The one cost is turns and spend on quiz, ~25% above the unaided arm for the same 4/4 |
| What mistakes repeated without the skill? | None, re-measured 2026-09-03 rather than carried over: `no_skill` never recommended Verkle (`6/6` call it dropped), never claimed a scheduled fork, never mistook EIP-4444 for a state-growth fix. Flagging `ethereum.org/roadmap/verkle-trees` as stale is a *separate* signal and a rarer one — `2/6`, quiz `n1` and `n2` — but no expect grades it. What it did miss is forkcast — `0/6` unaided runs found it — and the SFI/CFI/DFI status vocabulary, `1/6` |
| What mistakes remained with the skill? | None |
| What should change in the skill? | Nothing this benchmark forces. The reduction removed the one concrete defect the July report named — a hardcoded Fork Process table that was already going stale in a skill whose thesis is anti-staleness — and replaced it with a pointer to forkcast. The control arm confirms that pointer is load-bearing: `0/6` unaided runs reached forkcast on their own, `6/6` skilled ones did. Glamsterdam's scope has in fact moved from 3 named EIPs to 18 SFI since July, which the old table would have gotten wrong |
| What should change in the eval? | **These two tasks no longer discriminate on `claude-opus-5` and should stop being used as if they do.** The expects grade the conclusion, so parametric recall satisfies them — confirmed, not assumed: a freshly measured unaided arm reaches the same 6/6. But the deliverables *do* separate, `0/6` vs `6/6` on forkcast and `1/6` vs `6/6` on status vocabulary, so option (1) below is no longer speculative — it is grading a delta this benchmark has now measured. Three options, unchanged from the July report and now overdue: (1) grade the *sourcing*, not the conclusion — an expect that requires the brief cite the fork-scope source it used, which is where the arms actually differ; (2) re-target the claim past the model's knowledge cutoff, e.g. Hegotá's current non-headliner scope, which is genuinely in flux (~66 proposals narrowing); (3) mark both `status: retired` for this stack and keep them as regression checks for smaller models. Separately, the July runs' `output/` was left gitignored and their deliverables are gone — all twelve runs here force-add `output/` (8.9–30.1 kB each) so the judge can be re-checked on the material it saw |
