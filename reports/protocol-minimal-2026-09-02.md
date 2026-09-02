# eval: minimal `protocol` skill (claude)

Closes the last unmeasured skill reduction in the repo. `skills/protocol` was cut from
267 lines to 24 in #59 and merged without a benchmark; this is that benchmark.

**Skill:** `skills/protocol` @ `e3aea23` — 24 lines, 216 words (the minimal version from
`578499e`, 2026-08-11). The 2026-07-25 baseline measured the vendored 267-line / 1,931-word
version at `2f0adb0`.
**Executor:** `claude`, model `claude-opus-5`, fresh spawn per run.
**Judge:** `claude`, model `claude-opus-5`, fresh blind process spawned by `verify`.
**`self_judged: true` on all six runs** — one claude stack, executor and judge the same agent.
Each grade ran in a process that never saw the variant, the skill, or the transcript, but it
is a caveat on the numbers and is stated here rather than buried.
**Date:** 2026-09-02. Six new runs, `with_skill` only, 3 per task.

## Why only six runs

The `no_skill` arm is **carried over from 2026-07-25**, not re-run. `git log` on both task
specs shows exactly one commit since that benchmark — `67c6e6d`, which touched only `notes:`.
Every `input:` and every `expect:` line is byte-identical to what the July runs were graded
against, so the unaided side measures the same thing it measured then and re-drawing it would
buy nothing but noise.

Two limits on that carry-over, stated up front:

- The July runs predate `input_sha` and `expect_sha`, so their records cannot self-certify the
  rubric they were graded against. The git check above is what stands in for it.
- They also predate `executor.yaml` and the `## run stats` footer. They carry no
  `executor_model` and no `usage` block. The report's stack line for them comes from
  `reports/protocol-2026-07-25.md`, which states `claude-opus-5`.

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

| Task | `no_skill` (267-line era, carried over) | `with_skill` @ 24 lines |
| --- | ---: | ---: |
| `protocol-quiz-001` | 3/3 | **3/3** |
| `protocol-goal-001` | 3/3 | **3/3** |
| **total** | **6/6** | **6/6** |

For reference, the 267-line `with_skill` arm was also 6/6 on 2026-07-25.

**The reduction held the line.** Every expect passed in every run — 9 expect lines across two
tasks, 27 judgements, zero failures. Cutting 267 lines to 24 cost nothing measurable on this
rubric, which is the question #102 asked.

It is worth being exact about what that does and does not prove. The July benchmark found
`no_skill` at 6/6 too: **the prior these tasks test is not stale for `claude-opus-5`**, so the
tasks were already saturated before the cut. A saturated task cannot detect a regression it
was never able to detect. What this run establishes is that the 24-line version does not
introduce a *new* failure on a rubric where the model was already at ceiling — a real but
bounded result, and the same bound the 2026-07-25 report carried.

## Per-run records

All six exited 0. No run was killed, and no transcript contains a session-limit message.

| Task | Run | Expects | Duration | Cost | Total tokens |
| --- | --- | --- | ---: | ---: | ---: |
| quiz | `171647Z…with-skill-1` | 4/4 | 235s | $1.12 | 489,038 |
| quiz | `172129Z…with-skill-2` | 4/4 | 221s | $1.07 | 333,289 |
| quiz | `172529Z…with-skill-3` | 4/4 | 261s | $1.18 | 441,825 |
| goal | `171716Z…with-skill-1` | 5/5 | 371s | $1.97 | 532,019 |
| goal | `172352Z…with-skill-2` | 5/5 | 449s | $2.79 | 2,234,999 |
| goal | `173158Z…with-skill-3` | 5/5 | 331s | $1.64 | 445,095 |

Durations and costs are `yarn run-stats --tasks protocol-quiz-001,protocol-goal-001 --runs`;
token totals are the `usage.total_tokens` the harness wrote into each `result.yaml`.

| Task | Variant | n | Median turns | Median duration | Median cost | Cost range | Median tokens |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |
| quiz-001 | `with_skill` @ 24 lines | 3 | 27 | 235s | $1.12 | $1.07–$1.18 | 441,825 |
| goal-001 | `with_skill` @ 24 lines | 3 | 42 | 371s | $1.97 | $1.64–$2.79 | 532,019 |

The goal spread is wide enough to matter: `with-skill-2` ran 2.23M tokens against 445k and
532k for its siblings — a 4x outlier inside n=3, driven by a much longer search (55 turns,
including a fetch of the Glamsterdam devnet-8 dora dashboard). The median is reported with its
range for exactly this reason.

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

Pass counts cannot answer this, because both arms were already at ceiling in July. The
behavior the skill installs — check live sources, report fork status explicitly, refuse to
give an unscheduled feature a ship date — is visible in the transcripts, and full-session
capture (`--output-format stream-json`, added since July) makes it directly measurable rather
than inferred, which is the fix the July report asked for.

**Every one of the six runs checked live sources.** All six fetched `eips.ethereum.org` for
the relevant meta EIPs; the fork-scope metas 7773 (Glamsterdam) and 8081 (Hegotá) were pulled
by name, and runs also went to `forkcast.org`, `ethereum-magicians.org` ACDE-242 call notes,
`eipsinsight.com`, and in one case a live devnet dashboard. No run asserted fork status from
memory.

Status vocabulary in the graded deliverable, which is committed and re-checkable:

| Task | Run | `forkcast` mentions | SFI/CFI/DFI uses | Deliverable |
| --- | --- | ---: | ---: | ---: |
| quiz | w1 | 3 | 6 | 8.9 KB |
| quiz | w2 | 2 | 4 | 13.2 KB |
| quiz | w3 | 2 | 5 | 13.4 KB |
| goal | w1 | 1 | 15 | 23.5 KB |
| goal | w2 | 5 | 15 | 29.3 KB |
| goal | w3 | 5 | 15 | 23.0 KB |

**These cannot be compared to the equivalent table in `reports/protocol-2026-07-25.md`.** That
report's source-checking counts are not reproducible from committed evidence: the July runs
committed only `result.yaml` and a `transcript.md` that holds the final assistant message
alone (2.2–3.6 KB), and their `output/` was left gitignored, so the deliverables those counts
were taken over no longer exist anywhere. Recounting the July committed files with the same
greps gives 0–5 where the report prints 3–26. The July table is a record of an observation
that can no longer be audited; it is not evidence this run can be measured against.

Content-wise the six deliverables land the claim cleanly. Representative, from quiz `w2`:

> **Do not build around Verkle trees.** That is precisely the design the protocol is
> moving *away* from — it has been dropped from the roadmap.
>
> **The binary tree has no ship date, because it has no fork.** It is not merely
> "unscheduled for the next fork" — it has no fork relationship whatsoever.

No brief presented Verkle as the coming relief, none claimed a scheduled fork for the state-tree
migration, and none leaned on EIP-4444 as the state-growth fix. All three goal briefs
name history expiry (2–6 mentions each) and every one of them scopes it correctly to chain
history rather than the state trie — `w3` spells it out in a table cell: "**Does not help
archive nodes** — an archive node keeps this by definition." `w1` went further and flagged
that ethereum.org's own `/roadmap/statelessness` page is stale on 4444's shipping status,
preferring the fork meta EIPs as authoritative — the skill's habit applied to a source the
skill never names.

## Mistakes

None filed. Zero expect failures across six runs leaves nothing to record, and a mistake
record invented from a passing run is noise.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No, and neither did the version it replaced. `6/6 with_skill` @ 24 lines vs `6/6 no_skill`; the 267-line version was also `6/6`. The prior these tasks test is not stale for `claude-opus-5`, so both arms sit at ceiling |
| Did it reduce time/tokens? | Not measurable against the 267-line version — all twelve 2026-07-25 runs predate the `## run stats` footer, so `run-stats` has no duration, cost or token figure for either of that benchmark's arms. The minimal arm's own medians are quiz `235s / $1.12 / 442k tokens`, goal `371s / $1.97 / 532k tokens` (goal cost range `$1.64–$2.79`, token range `445k–2.23M`) |
| Did it create negative deltas? | None found. No expect regressed, and the live-source-checking habit is present in all six runs |
| What mistakes repeated without the skill? | None. Carried over from 2026-07-25: `no_skill` never recommended Verkle, never claimed a scheduled fork, never mistook EIP-4444 for a state-growth fix |
| What mistakes remained with the skill? | None |
| What should change in the skill? | Nothing this run forces. The reduction removed the one concrete defect the July report named — a hardcoded Fork Process table that was already going stale in a skill whose thesis is anti-staleness — and replaced it with a pointer to forkcast. That fix is confirmed by the runs: the six executors resolved current Glamsterdam and Hegotá scope from live metas, and Glamsterdam's scope has in fact moved from 3 named EIPs to 18 SFI since July, which the old table would have gotten wrong |
| What should change in the eval? | **These two tasks no longer discriminate on `claude-opus-5` and should stop being used as if they do.** The expects grade the conclusion, so parametric recall satisfies them, and this run had a ceiling on both sides before it started. Three options, unchanged from the July report and now overdue: (1) grade the *habit* — add an expect that fails a scheduling claim asserted without a live check, which is the only thing the transcripts separate on; (2) re-target the claim past the model's knowledge cutoff, e.g. Hegotá's current non-headliner scope, which is genuinely in flux (~66 proposals narrowing); (3) mark both `status: retired` for this stack and keep them as regression checks for smaller models. Separately, the July runs' `output/` was left gitignored, and their deliverables are gone — the six runs here force-add `output/` (8–29 KB each) so the judge can be re-checked on the material it saw |
