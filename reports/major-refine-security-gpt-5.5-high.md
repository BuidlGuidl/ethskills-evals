# major-refine: security (GPT 5.5 high)

**Benchmark** `major-refine-d9952522` — the clean re-run from [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119).

| | |
| --- | --- |
| Executor | `codex`, model `gpt-5.5`, effort `high` |
| Judge | `claude`, model `claude-opus-5`, effort `high` |
| `self_judged` | `false` on all 72 runs — the judge stack differs from the executor stack |
| Runs | 3 per arm per task, 8 tasks, 3 arms = 72 |
| Arms | none (`no_skill`) · old (`--skill-ref 2f0adb01`) · new (`--skill-ref d9952522`) |
| Harness | benchmark commit `d9952522`, verified byte-identical for `tasks templates lib scripts package.json yarn.lock tsconfig.json AGENTS.md` |
| Date | 2026-09-22 |

Tasks (every live task whose `skill:` is `skills/security`): `security-goal-001`,
`security-goal-002`, `security-quiz-001` … `security-quiz-006`. None retired, none
templated — all eight run in a bare workspace.

All 72 runs graded cleanly: zero non-zero executor exits, zero `harness_failure`,
zero retractions, all carrying `benchmark: major-refine-d9952522`, and exactly 9 runs
per `expect_sha` (one rubric per task, unchanged across arms).

## Headline

**new 24/24 · old 23/24 · none 22/24.**

| task | new | old | none | the check that moved |
| --- | --- | --- | --- | --- |
| security-goal-001 | 3/3 | 3/3 | **2/3** | expect_1 — first-depositor inflation |
| security-goal-002 | 3/3 | 3/3 | 3/3 | — |
| security-quiz-001 | 3/3 | 3/3 | 3/3 | — |
| security-quiz-002 | 3/3 | 3/3 | **2/3** | expect_4 — feed-derived staleness bound |
| security-quiz-003 | 3/3 | 3/3 | 3/3 | — |
| security-quiz-004 | 3/3 | 3/3 | 3/3 | — |
| security-quiz-005 | 3/3 | **2/3** | 3/3 | expect_4 — EIP-712 fork domain cache |
| security-quiz-006 | 3/3 | 3/3 | 3/3 | — |

Three failing runs out of 72, each a single failed check. Read the aggregate with
care: a 2-point spread over 24 runs per arm is not a result anyone should defend as
significant. What the runs are actually worth is in the three individual failures and
in the artifacts behind the passes, below.

## The three failures

**security-goal-001 `none` r2 — expect_1** (`security-vault-first-depositor-unmitigated`).
Shipped `supply == 0 ? assets : (assets * supply) / totalAssets()` reading
`ASSET.balanceOf(address(this))` directly, guarded only by a `ZeroShares` revert. The
revert is the interesting part: it reverts the victim's deposit and reads like a
deliberate fix, while leaving the donation manipulation itself completely intact. The
expect line names exactly this shape as a fail. Both skilled arms mitigated in all six
runs.

**security-quiz-002 `none` r1 — expect_4** (`security-oracle-maxage-not-feed-derived`).
Produced a correct validation checklist — positive answer, complete round, non-zero
`updatedAt` — then bounded staleness against "the market's configured max staleness":
one global number, never derived from the chosen feed's published heartbeat. This
reproduces the 2026-09-04 codex/gpt-5.4 rate (1/3) exactly.

**security-quiz-005 `old` r2 — expect_4** (`security-eip712-fork-domain-cache`).
Correctly put `chainId` in the EIP-712 domain, then assigned `DOMAIN_SEPARATOR` once at
construction with no re-derivation when `block.chainid` changes. This is a **negative
delta for the old skill**, and the direction matters: `none` was 3/3 on this check, so
gpt-5.5 handles the fork case unprompted. The only arm that got it wrong is the one
carrying the old skill text. The old skill had no "Signatures and replay protection"
section, and its EIP-712 material steered a model that already knew better.

## What the pass counts hide

Both goal tasks ask for design shape to be reported, not graded.

**goal-001 — the route to a safe vault differs by arm, though all nine runs compile
(`forge build` exit 0):**

| arm | how the inflation attack was defeated |
| --- | --- |
| new | OpenZeppelin `ERC4626` in 3/3 (one also raising `_decimalsOffset`) |
| old | hand-rolled virtual assets/shares offset in 2/3, OZ `ERC4626` in 1/3 |
| none | hand-rolled virtual offset in 2/3, **unmitigated in 1/3** |

The refined skill says "start from OpenZeppelin `ERC4626`" and the new arm does exactly
that, every time. The old arm reaches the same security property by hand-rolling. Same
score, different engineering — and the hand-rolled route is the one with a failure mode,
since the single unmitigated run is a hand-rolled one.

**goal-002 — no arm differences worth reporting.** All nine runs priced collateral from
a Chainlink push feed via `latestRoundData` with staleness and positivity checks; none
read `slot0`, reserves or a quoter. All nine chose the liquidator-supplies-USDC shape
with no in-contract swap, so expect_6 passes on its no-swap branch in every run rather
than on a slippage bound. That check has not been exercised on this stack.

## Cost

Per-task medians from `yarn run-stats --benchmark major-refine-d9952522`, split per arm
with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`.
Codex dollars are `cost_source: list_price` — the run's token split priced at the
standard-tier list price in `lib/prices.ts`, not what the operator was billed, and the
>272K long-context surcharge is not included.

| task | new dur / tokens / cost | old dur / tokens / cost | none dur / tokens / cost |
| --- | --- | --- | --- |
| security-goal-001 | 307s / 718k / $1.04 | 335s / 545k / $0.90 | 290s / 355k / $0.78 |
| security-goal-002 | 395s / 853k / $1.30 | 326s / 627k / $0.95 | 341s / 428k / $0.92 |
| security-quiz-001 | 65s / 81k / $0.18 | 91s / 107k / $0.29 | 74s / 110k / $0.20 |
| security-quiz-002 | 135s / 130k / $0.33 | 157s / 179k / $0.40 | 154s / 107k / $0.34 |
| security-quiz-003 | 78s / 82k / $0.20 | 61s / 99k / $0.20 | 62s / 74k / $0.15 |
| security-quiz-004 | 40s / 75k / $0.12 | 63s / 133k / $0.22 | 52s / 73k / $0.15 |
| security-quiz-005 | 56s / 93k / $0.16 | 66s / 100k / $0.18 | 40s / 56k / $0.12 |
| security-quiz-006 | 53s / 62k / $0.16 | 82s / 154k / $0.28 | 46s / 72k / $0.12 |

Cost ranges at n=3 are wide enough to swallow most of these gaps — quiz-004's old arm
spans $0.15–$0.56, goal-001's new arm $1.03–$1.27 — so treat single-task deltas as
noise and read the pattern across tasks instead. Two patterns do hold:

- **On the six quizzes the new skill is cheaper than the old on every task** (tokens:
  81k vs 107k, 130k vs 179k, 82k vs 99k, 75k vs 133k, 93k vs 100k, 62k vs 154k). The
  refined SKILL.md is 56 lines against the old 487, and that shows up directly in
  `cache_creation_input_tokens` and then in every turn's re-read.
- **On the two goal tasks the new skill is the most expensive arm** (718k vs 545k vs
  355k; 853k vs 627k vs 428k). The shorter text costs less to carry but sends the model
  to OpenZeppelin `ERC4626`, so the run installs the dependency and builds against it.
  The saving on prompt size is smaller than the work the advice creates.

## Mistake records

No new records. All three failures reproduce existing ones; each was updated with a
`codex/gpt-5.5 @ <ref>` frequency key rather than folded into an average:

- `security-vault-first-depositor-unmitigated` — `none` 1/3, both skilled arms 0/3.
  no_skill fell from 3/3 (gpt-5.4) to 1/3, same failure mode when it slips.
- `security-oracle-maxage-not-feed-derived` — `none` 1/3, both skilled arms 0/3. The
  flat two-line `frequency` was converted to stack keys, with the pre-existing rate
  attributed to codex/gpt-5.4 per its own notes.
- `security-eip712-fork-domain-cache` — `old` 1/3, `new` 0/3, `none` 0/3. Status stays
  `fixed`; this measurement corroborates the fix on a newer model and adds the finding
  that the old text is now a net negative on this stack.

The Opus 5 medium column (PR #162) reports 24/24 in all three arms and files
`eval-deleted-workspace-grades-as-content-failure`, which this run hit too; that record
is theirs and is not duplicated here.

## Harness notes

Two problems interrupted this benchmark. Neither affected a recorded grade, and no run
in the table was graded over a refusal.

1. **codex's bwrap sandbox was broken for the first two attempts.** This machine
   rebooted into kernel `6.8.0-139`, which enables AppArmor's
   `kernel.apparmor_restrict_unprivileged_userns`; codex's filesystem sandbox helper
   could then create no namespace and every write failed. The runs still exited 0 and
   read as a model that produced nothing. Cleared by setting that sysctl to 0. Both
   affected runs were deleted, not graded. **This reverts on reboot and silently breaks
   every codex stack on #119** — worth persisting in `/etc/sysctl.d`.
2. **codex usage limit exhausted mid-sweep**, killing three runs with exit 1 at 15:09Z.
   `verify` refuses a non-zero exit, which is the correct behaviour; the three were
   deleted and re-run after the quota reset at 18:31Z rather than graded with
   `--grade-failed-run`.

One near-miss worth recording for other operators: a concurrent session's
`yarn clean-workspaces --delete`, run from a different checkout against the shared
default workspace root, deleted a live run's workspace. The executor kept running,
exited 0, and wrote a transcript in which it explains it could not write its answer —
which grades as a content failure, not a harness failure, because the only signature in
`executor.err` is `Failed to write file <path>` and that matches nothing in
`SHELL_FAILURES`. Both sessions moved to per-stack workspace roots
(`EVAL_WORKSPACE_ROOT`) for the rest of the benchmark.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Marginally, and only against `none`: **new 24/24 · old 23/24 · none 22/24**. Two of the eight tasks discriminate at all (goal-001, quiz-002), each by one run. New vs old is 24/24 vs 23/24 — a single run, which is not evidence of an improvement on its own. |
| Did it reduce time/tokens? | No. Against `none` both skilled arms cost more on every task. New vs old splits by task type: new is cheaper on all six quizzes (e.g. 62k vs 154k on quiz-006) and dearer on both goals (718k vs 545k; 853k vs 627k), because the shorter text sends the model to OpenZeppelin and the build work outweighs the prompt saving. |
| Did it create negative deltas? | One, in the old arm: `security-quiz-005` expect_4, old 2/3 where `none` is 3/3 — the old skill's EIP-712 material steered a model that already handled the fork case. The new arm has no negative delta on this stack. Cost is a negative delta for both skilled arms against `none`. |
| What mistakes repeated without the skill? | `security-vault-first-depositor-unmitigated` (1/3), `security-oracle-maxage-not-feed-derived` (1/3). |
| What mistakes remained with the skill? | None in the new arm. In the old arm, `security-eip712-fork-domain-cache` (1/3) — caused by the old text rather than left uncorrected by it. |
| What should change in the skill? | Nothing this run justifies. The new arm passed every check, so there is no measured gap to write against, and editing on the strength of a 24-vs-23 margin would be fitting to noise. The one substantive finding is a reason **not** to revert the refine: the old skill's EIP-712 section is now actively harmful on gpt-5.5. |
| What should change in the eval? | This task set is saturated on frontier models and mostly cannot measure this skill. Six of eight tasks are 9/9 across all arms here, and the Opus 5 medium column is 24/24/24 on all eight. Concretely: (1) **`security-quiz-004` cannot discriminate** — all 9 runs prescribed `forceApprove`, including old-arm runs whose own skill text says the removed `safeApprove`; two independent frontier stacks now agree, so rotate or retire it. (2) **`security-goal-002` expect_6 has never been exercised** — all 9 runs chose the no-swap design, so the slippage-bound branch is untested; the input should force a swapping liquidation path if that check is meant to measure anything. (3) The tasks that still bite (goal-001 expect_1, quiz-002 expect_4) do so at 1/3, so **n=3 is too small** to separate arms here — either raise `runs` on those two or accept that this benchmark now reports "saturated" rather than a delta. |
