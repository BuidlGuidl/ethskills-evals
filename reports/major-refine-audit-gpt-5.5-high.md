# major-refine: `audit` on GPT 5.5 high

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `codex` · `gpt-5.5` · effort `high` (codex-cli 0.155.1) |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | false on all 36 records |
| Runs | 3 per arm per task, 4 tasks × 3 arms = **36 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 dead runs, 0 retracted, 0 `--allow-skill-mention` — every grade blind |
| Trigger | not forced — numbers are trigger-inclusive; 18/18 skill quiz runs and 6/6 skill goal runs read `SKILL.md` |
| Checklist revision | new arm pins `evm-audit-skills@ffe4b670`; old arm points at `main` (unpinned) but fetched no checklist in any run |
| Sitting | 2026-09-24, 15:32–16:21 UTC; goal-001 as one sequential chain, the three quizzes as three parallel chains |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `audit` skill: master index on `main`, "spawn one opus sub-agent per skill", "file GitHub issues" |
| new | `with_skill` | `d9952522` | refined skill: pinned checklist revision, 5–8 checklists, no publishing without confirmation |

Both `skill_version` commits are ancestors of HEAD.

**Tasks** — all four live tasks whose `skill:` is `skills/audit`.

- `audit-goal-001` — template `audit-market-001` (no dependencies to install), an Arbitrum lending market with eleven planted vulnerabilities (expects 1–11) plus a severity check (expect 12). Read as findings-caught-out-of-11, per its notes.
- `audit-quiz-001` — post-mortem: sequencer outage, sequencer uptime feed + grace period.
- `audit-quiz-002` — `block.number` as a clock on Arbitrum vs Base.
- `audit-quiz-003` — `borrowWithSig` replay, nonce + deadline, cached domain separator.

## Headline — pass counts, new · old · none

| Task | new · old · none | Per run |
| --- | --- | --- |
| `audit-goal-001` | `1/3 · 2/3 · 2/3` | findings out of 11: new 10 · 10 · 11, old 11 · 11 · 9, none 11 · 11 · 10 → **31/33 · 31/33 · 32/33**; severity (e12) passed in all 9 |
| `audit-quiz-001` | `3/3 · 3/3 · 3/3` | 4/4 expects everywhere |
| `audit-quiz-002` | `3/3 · 3/3 · 3/3` | 4/4 expects everywhere |
| `audit-quiz-003` | `3/3 · 3/3 · 0/3` | none fails expect_3 (cached domain separator) in all three runs |
| **total** | **`10/12 · 11/12 · 8/12`** | |

The only line that separates the arms is `audit-quiz-003` expect_3: both skill arms name the constructor-cached `DOMAIN_SEPARATOR` and the OpenZeppelin rebuild-on-`chainid`-change fix 3/3; none uses `DOMAIN_SEPARATOR` in its fixed code 3/3 and never says it is stale after a fork. This reproduces the gpt-5.6-sol baseline miss (1/3 there, 3/3 here).

The goal task does not separate. Every arm catches 31–32 of 33 findings, and each miss is one run skipping one bug:

| Run | Missed | What the report says instead |
| --- | --- | --- |
| new-1 | e5 `block.number` clock | nothing on `accrueInterest`'s time source |
| new-2 | e11 wstETH priced from the stETH / USD feed | wstETH only as the launch asset / in a liquidation scenario |
| old-3 | e2 withdraw transfer-before-decrement, e5 | e2: flags withdraw's stale-debt health check, not the ordering; e5: nothing |
| none-3 | e11 | wstETH only as the launch asset |

Neither skill arm improves the goal on this stack; the new arm's one clean run versus the old arm's two is within one-miss noise at n=3.

## Blindness

Clean. Unlike Opus 5 at `d9952522` (4/4 goal reports named the checklists), no GPT 5.5 report names `evm-audit-skills` or the checklists, and every goal run left only `AUDIT-REPORT.md` in its diff. `verify` refused nothing; all 36 grades are blind.

**Cross-run reads** (the noir GPT row found codex reading sibling live workspaces): checked every transcript for paths under `~/.cache/ethskills-evals/<other run id>` — none. The goal runs, which share one template, never overlapped.

## What the skill arms did

| | old (`2f0adb01`) | new (`d9952522`) |
| --- | --- | --- |
| Goal: checklists fetched | 0 / 0 / 0 | 10 / 8 / 10 (pinned `ffe4b670`) |
| Goal: `spawn_agent` calls | 4 / 6 / 1 | 0 / 0 / 4 |
| Quiz: checklists fetched | 0 in all 9 | 1–4 in all 9 |
| Web search (quiz-002) | 7 / 10 / 7 | 3 / 9 / 10 |

The old arm follows its "spawn sub-agents" line on codex (3/3) but never opens its unpinned master index; the new arm loads the pinned checklists every time and fans out once in three. Neither changes the goal score. none also searches the web on quiz-002 (7 / 10 / 14 searches), so that quiz is live-lookup for every arm.

## Cost

From `yarn run-stats --tasks audit-goal-001,audit-quiz-001,audit-quiz-002,audit-quiz-003 --benchmark major-refine-d9952522`, split with `--variant no_skill`, `--skill-version 2f0adb01`, `--skill-version d9952522`. Medians; codex dollars are **list price** (`lib/prices.ts`), not billed cost. `turns` is not recorded on codex.

| Task | none | old | new |
| --- | --- | --- | --- |
| `audit-goal-001` | 226s · 282k · $0.62 ($0.56–$0.67) | 402s · 1232k · $1.46 ($1.08–$1.82) | 291s · 879k · $1.26 ($1.13–$1.28) |
| `audit-quiz-001` | 51s · 73k · $0.14 ($0.13–$0.16) | 78s · 97k · $0.21 ($0.17–$0.31) | 89s · 184k · $0.35 ($0.31–$0.35) |
| `audit-quiz-002` | 163s · 364k · $1.02 ($0.75–$1.10) | 171s · 501k · $0.94 ($0.83–$1.12) | 167s · 574k · $1.09 ($0.61–$1.16) |
| `audit-quiz-003` | 67s · 76k · $0.17 ($0.15–$0.25) | 77s · 136k · $0.28 ($0.28–$0.30) | 77s · 158k · $0.31 ($0.26–$0.31) |

On the goal, both skill arms cost 2–2.4× none for no extra findings; the old arm's sub-agent fan-out makes it the dearest (4.4× none's tokens). On the quizzes the new arm is the dearest on 3/4 tasks (checklist fetches), up to 2.5× none on quiz-001. Whether codex counts sub-agent tokens in the parent's usage was not checked; the old arm's goal token counts suggest it does.

## Mistake records

`mistakes/audit/` cards are taken at their `merge/major-refine-opus-gpt` (#184) versions, so they carry the Opus row's blocks, and each gets `codex/gpt-5.5-high@2f0adb01` / `@d9952522` blocks:

| Record | none | old | new |
| --- | --- | --- | --- |
| `audit-cached-domain-separator-missed` (quiz-003 e3) | 3/3 | 0/3 | 0/3 |
| `audit-block-number-clock-missed` (goal e5) | 0/3 | 1/3 | 1/3 |
| `audit-withdraw-reentrancy-ordering-missed` (goal e2) | 0/3 | 1/3 | 0/3 |
| **new** `audit-wsteth-priced-as-steth-missed` (goal e11) | 1/3 | 0/3 | 1/3 |
| `audit-sequencer-liveness-missed` (goal e3) | 0/3 | 0/3 | 0/3 |
| `audit-liquidate-all-unbounded-loop-missed` (goal e10) | 0/3 | 0/3 | 0/3 |
| `audit-checklist-provenance-in-report` | 0/3 | 0/3 | 0/3 |
| `audit-skill-not-invoked-on-prose-question` | n/a | 0/9 | 0/9 |
| `audit-subagent-fanout-not-executed` | n/a | 0/3 | 2/3 |

## Summary

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none `10/12 vs 8/12`, new vs old `10/12 vs 11/12`. All of the gain is quiz-003 (`3/3 · 3/3 · 0/3`); goal-001 `1/3 · 2/3 · 2/3`, i.e. 31/33 · 31/33 · 32/33 findings — no difference |
| Did it reduce time/tokens? | No. Goal medians new 291s / 879k / $1.26 · old 402s / 1232k / $1.46 · none 226s / 282k / $0.62; the new arm is the dearest on 3/4 quizzes |
| Did it create negative deltas? | Goal: both skill arms 2–2.4× none's cost for one fewer finding over 3 runs (within noise). new-2 fetched the oracles checklist and still missed the wstETH/stETH feed mismatch |
| What mistakes repeated without the skill? | `audit-cached-domain-separator-missed` 3/3; `audit-wsteth-priced-as-steth-missed` 1/3 |
| What mistakes remained with the skill? | `audit-block-number-clock-missed` (old 1/3, new 1/3), `audit-withdraw-reentrancy-ordering-missed` (old 1/3), `audit-wsteth-priced-as-steth-missed` (new 1/3), `audit-subagent-fanout-not-executed` (new 2/3) |
| What should change in the skill? | Nothing the scores demand for new vs old: both arms fix the one gap none has. The step-4 fan-out claim stays untested (new fans out 1/3, and it does not change the score); if kept, say it is optional on small codebases. For wrapped collateral, the oracle checklist route could name "priced from the underlying's feed without the exchange rate" explicitly — one miss is weak evidence |
| What should change in the eval? | goal-001 is near-saturated on GPT 5.5 too (31–32/33 in every arm); it needs a fixture too big for one context to test the fan-out. quiz-001 and quiz-002 saturate every arm on both stacks measured so far |
