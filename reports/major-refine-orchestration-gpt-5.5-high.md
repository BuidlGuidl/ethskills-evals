# major-refine: orchestration (gpt-5.5-high)

Benchmark: `major-refine-d9952522`. Executor: codex `gpt-5.5` at `high`. Judge: claude `claude-opus-5` at `high` on every run (`self_judged: false` throughout). 3 runs per arm, three arms per task: `none` (no_skill), `old` (`--skill-ref 2f0adb01`, the first vendored text), `new` (`--skill-ref d9952522`, the benchmark commit). Tasks: orchestration-goal-001, orchestration-quiz-001, orchestration-quiz-002, orchestration-quiz-003, orchestration-quiz-004 — every live task with `skill: skills/orchestration`. Runs are trigger-inclusive: nothing in the input names the skill.

## Pass counts

| Task | new | old | none |
| --- | --- | --- | --- |
| orchestration-goal-001 | **3/3** | 1/3 | 0/3 |
| orchestration-quiz-001 | **3/3** | 2/3 | 0/3 |
| orchestration-quiz-002 | 3/3 | 3/3 | 3/3 |
| orchestration-quiz-003 | 3/3 | 3/3 | 3/3 |
| orchestration-quiz-004 | 3/3 | 3/3 | 3/3 |
| **Total** | **15/15** | **12/15** | **9/15** |

All 45 runs executed cleanly (`executor_exit: 0`, no harness failures, no retractions).

## Per-check failures

Every failure on this stack is one of two lines:

- **The explorer-key prior** (goal-001 expect_4, quiz-001 expect_1 — `orchestration-stale-verification-key`). none: 6/6 runs failed — every no-skill goal-001 plan lists obtaining a `BASESCAN_API_KEY`/`ETHERSCAN_API_KEY` among launch setup, and every no-skill quiz-001 answer names a valid explorer key as a verification prerequisite. old: 3/6 failed (goal-001 runs 1–2, quiz-001 run 3) — the first vendored text carries the claim but it does not stick reliably. new: 0/6.
- **The live real-money journey** (goal-001 expect_2 — `orchestration-live-money-journey-deferred`, filed this benchmark). none: 2/3 failed — both plans state a pre-public gate (passing expect_6) but the real-funds journey lands after the frontend is already on a public URL, or is left to team discretion. old and new: 0/3 each.

The three go/no-go gate lines (goal-001 expect_5/6/7, `orchestration-transition-gates-implicit`) passed in all nine goal-001 runs, no-skill included: that mistake does not occur on gpt-5.5, unlike the 3/3 no-skill rate recorded on gpt-5.6-terra.

## Saturated tasks

quiz-002, quiz-003 and quiz-004 pass every line in every arm (27/27 runs). For quiz-003 this is documented in its task notes: the refined skill's description routes frontend tickets elsewhere, the skill does not load (0 of 3 new-arm transcripts reference `skills/orchestration`), and what the 3/3 measures is the template's own AGENTS.md. quiz-002 and quiz-004 are saturated on this stack in all three arms — gpt-5.5 already holds those claims (fork-vs-local reasoning, `yarn fork` semantics) without help, so they contribute no delta here.

## Cost

All numbers from `yarn run-stats --tasks <ids> --benchmark major-refine-d9952522`, split per arm with `--variant no_skill` / `--skill-version 2f0adb01` / `--skill-version d9952522`. Medians, with the cost range beside them; codex dollars are `cost_source: list_price` (token split priced at OpenAI's standard-tier list in `lib/prices.ts`), not a bill. Tokens are `total_tokens` and compare within this stack only.

| Task | new | old | none |
| --- | --- | --- | --- |
| goal-001 | 254s · $1.05 ($0.92–1.48) · 585k | 321s · $1.30 ($0.83–1.31) · 558k | 325s · $1.18 ($1.02–2.34) · 562k |
| quiz-001 | 37s · $0.11 ($0.09–0.12) · 59k | 168s · $0.92 ($0.14–0.92) · 591k | 177s · $1.14 ($0.95–1.26) · 983k |
| quiz-002 | 50s · $0.14 ($0.14–0.15) · 77k | 56s · $0.16 ($0.12–0.21) · 67k | 43s · $0.12 ($0.09–0.20) · 57k |
| quiz-003 | 204s · $0.83 ($0.74–0.95) · 617k | 269s · $1.10 ($0.82–1.18) · 951k | 203s · $0.77 ($0.74–1.01) · 575k |
| quiz-004 | 164s · $0.52 ($0.45–0.56) · 328k | 193s · $0.71 ($0.65–0.99) · 521k | 218s · $0.91 ($0.57–0.99) · 884k |

The standout is quiz-001: the new text answers from the skill in 37s / 59k tokens median, where no-skill spends 177s / 983k searching for a verification route and still gets the key prerequisite wrong. The new arm is also the cheapest of the three on quiz-003 and quiz-004 despite carrying the skill's prompt. At n=3 the goal-001 ranges overlap too much to claim a duration delta there.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none: `15/15 vs 9/15` (goal-001 `3/3 vs 0/3`, quiz-001 `3/3 vs 0/3`). new vs old: `15/15 vs 12/15` — the refinement fixes the explorer-key line the old text carried but did not land (old failed it 3/6). |
| Did it reduce time/tokens? | quiz-001: 37s / 59k (new) vs 177s / 983k (none) and 168s / 591k (old). quiz-004: 328k (new) vs 884k (none). Elsewhere within noise at n=3; no task where the skill made runs dearer beyond the ranges' overlap. |
| Did it create negative deltas? | None. No expect line passed by none/old and failed by new; no cost regression outside overlapping ranges. |
| What mistakes repeated without the skill? | `orchestration-stale-verification-key` (6/6), `orchestration-live-money-journey-deferred` (2/3, new record). `orchestration-transition-gates-implicit` did **not** reproduce on this stack (0/3 no-skill). |
| What mistakes remained with the skill? | On the old text: `orchestration-stale-verification-key` (3/6). On the new text: none. |
| What should change in the skill? | Nothing from this stack — the new text is 15/15 and both measured mistakes are closed by it. |
| What should change in the eval? | quiz-002 and quiz-004 are saturated in all three arms on gpt-5.5 and carry no signal here; quiz-003 additionally never loads the refined skill (its notes already say its numbers are not evidence about this skill — that open question stands). If a future stack also saturates them, they are candidates for retirement or reshaping. |
