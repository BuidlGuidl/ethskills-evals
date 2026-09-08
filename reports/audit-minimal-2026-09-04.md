# Audit minimal skill — Codex comparison (2026-09-04)

Executor and judge: `codex` / `gpt-5.6-sol`. Three fresh runs per variant on
each of the four existing audit tasks. Every run is self-judged by a separate blind
Codex process. Trigger was content-only; no forced skill instruction was added.

The skill revision was `7be55c8b`; its external checklist URLs pin
`austintgriffith/evm-audit-skills` at
`ffe4b670e78e1945bcf275f79d4b7b0481bcff35`. All 24 executors and judges exited 0.
Unlike PR #108, no run was rejected by the cybersecurity classifier.

**One goal run was not graded blind and has been retracted; a replacement was drawn
on 2026-09-08.** See "Blindness incident" below before reading the goal numbers —
it moves them.

## Blindness incident and the replacement run

`2026-09-04T155051Z-codex-with-skill-3` opened its method section with:

> This was a source review of the complete workspace supplied, informed by pinned
> general, precision/math, ERC-20, lending, oracle, proxy, access-control, and
> Arbitrum checklists.

No `no_skill` run can write that sentence — all three `no_skill` run diffs of this
sitting are clean — so the judge knew which arm it was grading. `lib/blindness.ts`
did not stop it because all three of its patterns keyed on the word *skill*, and
the rewritten skill's fingerprint is checklist vocabulary instead. `08bc438` adds
two patterns for that shape, calibrated against every artifact on disk: they flag
this run and the two 2026-08-27 `claude` runs that leaked the same way, and none of
the 581 `no_skill` runs, whose 48 lines recommending that a team adopt a checklist
stay clean.

The run carries `retracted:` rather than being deleted, so it is visibly excluded.
It is not regradeable — a regrade re-reads the same leaking report.

`2026-09-08T142026Z-codex-with-skill-4` replaces it: same stack, same
`input_sha` (`c199c849f028`) and `expect_sha` (`19b9dc8a26cc`), skill file byte-identical
(`git diff 7be55c8b 08bc438 -- skills/audit/` is empty; `skill_version` records
`08bc438` because that is the repo HEAD it was set up from). It is a **different
sitting**, four days later. Pinning removed checklist drift, not model, CLI or
machine-load drift, so both readings are given below and the sitting-only one is
the controlled one.

## Results

| Task | What it grades | `no_skill` | `with_skill` |
| --- | --- | ---: | ---: |
| `audit-quiz-001` | L2 sequencer feed and recovery grace period | 3/3 | 3/3 |
| `audit-quiz-002` | Arbitrum/OP-stack `block.number` semantics | 3/3 | 3/3 |
| `audit-quiz-003` | Nonce/deadline and fork-safe EIP-712 domain | 2/3 | 3/3 |
| `audit-goal-001` | All 11 findings plus severity | 0/3 | 1/3 † |

† the one full pass is the 2026-09-08 replacement run. On the 2026-09-04 sitting
alone the goal is `0/3 vs 0/2`.

The goal is read as a planted-finding count, not as its intentionally strict full-task
pass. Baseline reports found **29/33** planted vulnerabilities (10/11, 9/11, 10/11).

Skill reports read two ways:

- **Sitting only** (2026-09-04, the two runs graded blind): **20/22** — 10/11 twice.
- **With the replacement** (runs 1, 2 and the 2026-09-08 redraw): **31/33** —
  10/11, 10/11, **11/11**.

Neither reading supports a strong correctness claim. The 20/22 rate is
indistinguishable from the baseline's 29/33 on two samples, and the 31/33 rate leans
entirely on a run drawn on a different day, which is the comparison this benchmark
exists to avoid. Read the goal as *no measured separation on planted findings*, and
the quizzes as the place the skill still shows a small edge: **9/9 vs 8/9** full-task
passes.

Severity ranking (expect 12) passed in every graded run of both arms.

Goal misses were:

- `no_skill`: transfer-before-effects withdrawal reentrancy in 3/3; the unbounded
  `liquidateAll` loop in 1/3.
- `with_skill`: withdrawal reentrancy in 1/3 (run 1) and missing sequencer
  liveness/grace period in 1/3 (run 2). The replacement run missed nothing.
- The retracted run missed `block.number`-as-clock. That miss is excluded from
  the counts above and from `audit-block-number-clock-missed`, whose `with_skill`
  rate on this revision is therefore 0/3, not 1/3.

## Record, do not grade

`tasks/audit-goal-001.yaml` asks for four things to be recorded rather than graded.
All four are read off the seven goal runs of this benchmark (six from the sitting,
plus the replacement).

**False positives: 0 of 85 reported findings.** Per-run severity-numbered finding
counts were 14, 15 and 12 (`no_skill`) and 11, 13, 12 and 8 (`with_skill`, the last
being the replacement run). Every one names a property that is true of this fixture:
the six sitting reports were read finding-by-finding, the replacement's eight at the
finding level too. Reports routinely included true issues outside the grading surface
— repay dust, bad debt with no close factor, no pause, duplicate `borrowers` entries,
the `18 - feed.decimals()` underflow — which the task explicitly permits.

**Parallel sub-agents spawned: 0 in every run, on both arms.** `no_skill` never
attempts it. Of the four `with_skill` goal runs, one (2026-09-04 run 1) attempted a
specialist call and recorded `collab spawn failed: no thread with id`; the other
three never attempted it. All four read their selected checklists inline.

**Expects 4, 6 and 7 — review or `forge build` lint?** All seven goal runs ran
`forge build` before writing the report, and all seven saw the same lint output.
Splitting it by expect:

| Expect | What the lint gives | Verdict |
| --- | --- | --- |
| 6 — divide-before-multiply in `healthFactor` | `warning[divide-before-multiply]` naming `LendingMarket.sol:150` and printing the expression | **Handed over.** Both arms get this free; it discriminates nothing. |
| 4 — missing `updatedAt` freshness check | `warning[unsafe-typecast]` on the `int256`→`uint256` cast only | Partly. The lint points at the right line and covers the unvalidated-answer half; the freshness check the expect requires is review work. |
| 7 — `deposit` credits requested, not received | `warning[erc20-unchecked-transfer]` | No. The expect states that "check the ERC-20 return value" does not satisfy it, and that is all the lint says. The passing reports added the received-amount reasoning themselves. |

Expects 4, 6 and 7 passed 7/7. Only expect 6 should be discounted outright.

**Expect 5 chain semantics.** Every run that flagged the clock got Arbitrum right:
`block.number` there approximates the L1 block number, so the 12-second constant is
near-correct by coincidence and detonates on an L2-counting chain. The replacement
run states this and prescribes `block.timestamp`, but does so in an
"Additional observations" bullet rather than as a severity-ranked finding — a
judgment call worth re-reading at `2026-09-08T142026Z-codex-with-skill-4/run.diff:150`.

## Routing behavior

All skill-enabled runs opened `SKILL.md`. Narrow quiz runs followed the minimized
routing instruction and fetched only relevant pinned checklists rather than the master
index plus a broad bundle: 9/9 quiz runs opened the loader and fetched one or two
pinned checklists each, and every one of them was on-topic — `oracles` and
`chain-specific` for quiz 001, `chain-specific` and `precision-math` for quiz 002,
`signatures` (plus `defi-lending` or `general`) for quiz 003.

**No skill-enabled goal run completed specialist fan-out — 4/4 including the
replacement.** Two of the 2026-09-04 runs read their checklists inline without
attempting collaboration; one attempted it and recorded `collab spawn failed: no
thread with id`; the 2026-09-08 replacement never attempted it either. This reverses
PR #108's two valid skill runs, both of which completed parallel routing, and it means
the revised output-transport wording remains unexercised.

What that costs is now less clear than it looked. The replacement run fetched the same
eight checklists as the retracted one, read them inline, spawned nothing — and returned
the only 11/11-plus-severity report this task has produced on any stack. Inline
fallback is therefore not *inherently* lossy; it is unreliable. The skill still needs
an explicit fallback, but the case for it is variance, not a demonstrated ceiling.

The grades themselves stand: each executor completed normally, produced the requested
report, and was judged on that report alone — with the one exception handled above.

## Cost and duration

Derived with:

```text
yarn run-stats --tasks audit-quiz-001,audit-quiz-002,audit-quiz-003,audit-goal-001 --since 2026-09-04 --runs
```

| Task | Variant | n | Duration median (range) | Tokens median (range) |
| --- | --- | ---: | --- | --- |
| `audit-quiz-001` | no_skill | 3 | 70s (63–70) | 27,268 (11,395–29,975) |
| `audit-quiz-001` | with_skill | 3 | 87s (74–88) | 22,943 (21,304–42,573) |
| `audit-quiz-002` | no_skill | 3 | 93s (91–134) | 29,726 (27,776–38,203) |
| `audit-quiz-002` | with_skill | 3 | 102s (89–113) | 38,921 (31,062–42,803) |
| `audit-quiz-003` | no_skill | 3 | 77s (61–98) | 15,243 (10,802–23,079) |
| `audit-quiz-003` | with_skill | 3 | 83s (73–84) | 22,767 (20,842–27,727) |
| `audit-goal-001` | no_skill | 3 | 180s (158–251) | 32,399 (28,350–52,634) |
| `audit-goal-001` | with_skill | 3 | 187s (174–195) | 40,179 (39,567–42,977) |

The goal `with_skill` row still includes the retracted run. Retraction is about
whether a *grade* is comparable, not about what the executor spent, and that run
spent 187s / 40,179 tokens like any other.

The 2026-09-08 replacement is not in the table — it is a different sitting and would
corrupt a within-sitting median. It cost **287s and 60,592 tokens**, well above every
run in the table, which is a second reason not to read its 11/11 as free.

Within this sitting, the skill added 4–24% to median duration on every task; there is
no task where it reduced duration. Token effects ranged from a 16% reduction on quiz
001 to increases of 31% on quiz 002, 49% on quiz 003, and 24% on the goal. Codex
reports no dollar cost.

Runs executed four-wide. Concurrency affects wall-clock duration, so the duration
column is a within-sitting comparison under equal load and not an absolute cost;
token counts and per-run correctness are unaffected by it.

The earlier skill in PR #108 cost 1.6–2.3x time and 1.4–2.1x tokens. Current absolute
medians are substantially lower, but the baseline arm also became faster, so cross-sitting
ratios are context rather than a controlled attribution. The controlled conclusion is
that this revision reduced the within-sitting penalty to near parity in time, while still
adding tokens on three tasks.

## Task review and recommendations

No prompt or `expect:` edit is supported. The direct quizzes remain mostly saturated,
but quiz 003 reproduced its one baseline discriminator. The goal continues to separate
unprompted application. Task-note edits made in review of this PR restore the
run-both-variants-in-one-sitting rule (pinning removed the checklist-drift reason for
it, not the model/CLI/load reason), record that `skills/audit` is now a local revision
rather than a copy of upstream, and replace a stale cost warning with what was measured.
None of them touch the grading surface; `input_sha` and `expect_sha` are unchanged.

The next skill edit should carry all of:

1. **An explicit no-collaboration fallback** — attempt specialists for a full audit, but
   if collaboration is unavailable, execute a domain-by-domain checklist pass with a
   compact coverage ledger before synthesis, and require that ledger to cover
   external-call ordering, chain-specific clocks and L2 sequencer controls when those
   domains were routed.
2. **A severity rubric.** `7be55c8b` dropped the master-index fetch, which was the only
   route to the standard finding format and its severity definitions, while expect 12
   still grades severity ordering. It held on `gpt-5.6-sol`; nothing supports it
   elsewhere.
3. **Two defects in the measured revision, left in place so this benchmark measures what
   is committed:** `SKILL.md:15` defines `CHECKLIST_REV` and never uses it while line 20
   hardcodes the same sha (a re-pin can update one and miss the other), and `SKILL.md:23`
   names the checklists `general` / `precision-math` in prose while the URL template needs
   `evm-audit-general` / `evm-audit-precision-math`. Runs recovered via the table; the
   prose 404s if followed literally.

Do not restore the mutable master URL or automatic issue filing. Re-run the goal on both
arms after the edit — the current goal reading rests on two blind samples plus a
cross-sitting redraw, which is thinner than the headline numbers suggest.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Quizzes: `9/9 vs 8/9`. Goal: no measured separation — `20/22` over the two blind samples of this sitting, `31/33` if the 2026-09-08 redraw is included, against `29/33` baseline |
| Did it reduce time/tokens? | No. Time stayed higher: quiz medians `87/102/83s vs 70/93/77s`, goal `187s vs 180s`; tokens fell only on quiz 001 and rose on the other three tasks |
| Did it create negative deltas? | Yes: 4–24% more median time and 24–49% more tokens on three tasks. Goal coverage per run is `10/11` in both blind samples of this sitting, against the prior revision's two valid `11/11` runs |
| What mistakes repeated without the skill? | `audit-withdraw-reentrancy-ordering-missed`, `audit-cached-domain-separator-missed`; the non-repeated omission is recorded as `audit-liquidate-all-unbounded-loop-missed` |
| What mistakes remained with the skill? | `audit-withdraw-reentrancy-ordering-missed`, `audit-sequencer-liveness-missed`, `audit-subagent-fanout-not-executed`. `audit-block-number-clock-missed` did **not** — its only occurrence was the retracted run |
| What should change in the skill? | The three items above: no-collaboration fallback with a coverage ledger, a severity rubric to replace the deleted master index, and the two `SKILL.md` defects |
| What should change in the eval? | No grading change. `lib/blindness.ts` needed the fix in `08bc438`; the task notes needed the one-sitting rule and the local-revision provenance restored |
