# Re-run — `standards-goal-001`, `with_skill` only, after the x402 instruction fix

**Skill:** `skills/standards` @ `e2e50ab` (the 51-line minimal skill with the bounded x402 type-check).
**Executor / judge:** claude, `claude-opus-5`, blind judge in a fresh process per run. `self_judged: true`.
**Runs:** 3 `with_skill`. The `no_skill` arm does not depend on the skill, so the three runs from 2026-08-26 stand as its comparison; task input is unchanged across all three benchmarks.

**Records:** these three run dirs carry `result.yaml` and `transcript.md` only. `executor.yaml` — the record `run-executor` writes, and which the 60 other 08-27 runs on `main` commit — is absent from all three and is no longer on the machine that made them, so why it was never committed cannot now be recovered. Every cost, wall-clock and turn figure below was therefore read out of `transcript.md` by hand. These runs also predate the `## run stats` footer `run-executor` now writes, so `yarn run-stats --tasks standards-goal-001` reports them as `(n with no footer)` and cannot re-derive a single cell — the check AGENTS.md now requires of every cost number in a report does not reach this table. The figures are still recoverable from the transcripts, but only the way they were produced: by reading. Treat them as one step weaker than a `run-stats` table.

## Why this run exists

The 2026-08-26 benchmark (`reports/standards-2026-08-26.md`) charged the minimal skill a 2.75× cost regression on this task, traced to one instruction in the rewrite: *"Do not write the integration from a remembered snippet … Read the installed types"*. All three runs obeyed it with an open-ended tour of the installed packages — 33–82 shell commands each.

`e2e50ab` keeps the correction (dead symbols named, no signature pinned), states the 2.x shapes inline so a check is a confirmation rather than a discovery, scopes it to runs that actually import the packages, and names a hand-rolled handler against a facilitator's `/verify` and `/settle` as an equally legitimate implementation.

## Result

| goal-001 | pass | avg $/run | avg wall-clock | avg turns |
| --- | --- | --- | --- | --- |
| no_skill (2026-08-26) | 2/3 | $2.56 | 650s | 26 |
| with_skill, before fix (`f3ba42f`) | 3/3 | $7.04 | 1061s | 89 |
| **with_skill, after fix (`e2e50ab`)** | **3/3** | **$1.37** | **358s** | **14** |

Per run: $1.69 / $0.96 / $1.47. **The regression is gone** — the skill is now 46% cheaper and 45% faster than no skill on this task, against 3/3 vs 2/3 on the grade. That lands on top of the old 393-line skill's $1.33 in #35.

## What it cost to get there

The implementation flipped. Before the fix, all three runs installed `@x402/*` and shipped a real 2.x integration (`paymentMiddleware` + `x402ResourceServer`, `registerExactEvmScheme`, one wiring `facilitator` from `@coinbase/x402`). After it, **all three hand-roll the 402 flow on `node:http`, install nothing, and read no types** — the same thing every `no_skill` run does, and the same thing the old skill's runs did in #35.

So the saving is not the bounded check doing its job; it is the *"either implementation is fine"* clause moving the runs off the SDK entirely. Nothing graded changed — expect_7 accepts both — but the ungraded read did:

| | x402 integration | npm installs | type reads |
| --- | --- | --- | --- |
| with_skill, before fix | real 2.x SDK, verified against installed exports | 3/3 | 33–82 commands |
| with_skill, after fix | hand-rolled on `node:http` | 0/3 | 0 |
| no_skill | hand-rolled on `node:http` | 0/3 | 0 |

That is a trade, not a free win: **$4.50 a run buys an SDK integration checked against the real API instead of a hand-rolled one.** Whether that is worth paying is a judgement about what the skill is for, and it is not settled by anything in the expect lines. A middle version — bounded check without the "either is fine" clause — is untested and would cost ~$4–20 to measure.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | `3/3 vs 2/3` on this task, unchanged by the fix. |
| Did it reduce time/tokens? | **Yes, now.** $2.56 → $1.37 (−46%), 650s → 358s (−45%), 26 → 14 turns. Before the fix it was +175%. |
| Did it create negative deltas? | None on cost or grade. Ungraded: the runs no longer verify the x402 API they build against, and hand-roll instead. |
| What should change in the skill? | Nothing this run justifies. Open question left explicitly: whether the "either implementation is fine" clause should stay, given it is what moved the runs off the SDK. |
| What should change in the eval? | expect_7 accepts either implementation by design, so the SDK-vs-hand-rolled difference is invisible to the grade. If the team wants that difference to count, it needs its own line — otherwise keep reading it out of transcripts and say so in the report. |
