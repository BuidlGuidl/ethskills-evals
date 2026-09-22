# major-refine: `skills/security` on Opus 5 medium

| | |
| --- | --- |
| Benchmark id | `major-refine-d9952522` |
| Benchmark commit | `d99525222883df0b32decbfb81e1a13f9c27cfed` |
| Executor | claude · `claude-opus-5` · medium |
| Judge | claude · `claude-opus-5` · high |
| `self_judged` | **true** on all 72 runs — judge and executor are the same agent |
| Runs | 3 per arm per task, 72 runs, all graded |
| Arms | none (`no_skill`) · old (`--skill-ref 2f0adb01`) · new (`--skill-ref d9952522`) |
| Tasks | `security-goal-001`, `security-goal-002`, `security-quiz-001` … `security-quiz-006` (every live task with `skill: skills/security`) |

`self_judged: true` is expected on a single-stack benchmark and is a caveat on these numbers,
not a defect in them. The three other stacks (GPT 5.5 high, Kimi K3 high, GLM 5.3 high) are
unrun for this skill at the time of writing.

## Headline

Pass counts per arm, **new · old · none**:

| Task | new | old | none |
| --- | --- | --- | --- |
| `security-goal-001` | 3/3 | 3/3 | 3/3 |
| `security-goal-002` | 3/3 | 3/3 | 3/3 |
| `security-quiz-001` | 3/3 | 3/3 | 3/3 |
| `security-quiz-002` | 3/3 | 3/3 | 3/3 |
| `security-quiz-003` | 3/3 | 3/3 | 3/3 |
| `security-quiz-004` | 3/3 | 3/3 | 3/3 |
| `security-quiz-005` | 3/3 | 3/3 | 3/3 |
| `security-quiz-006` | 3/3 | 3/3 | 3/3 |
| **Total** | **24/24** | **24/24** | **24/24** |

**Not one failing expect line in the whole benchmark.** 72 runs × 2–6 expect lines each, three
arms, and every cell passed — including the unskilled baseline on every task.

On this stack the security benchmark measures nothing. It cannot distinguish the refined skill
from the old one, and it cannot distinguish either from no skill at all. Everything below is
therefore about *how* the arms differ, not *whether* they scored differently, plus what the eval
needs before it can carry a verdict again.

## What the refinement changed

`2f0adb01` → `d9952522` is a near-total rewrite: **487 lines to 56, 2713 words to 681** — a 9×
cut. The old text is a vulnerability tutorial: nine numbered "Critical Vulnerabilities (With
Defensive Code)", `### MEV & Sandwich Attacks`, `### UUPS Implementation`, a tools section and a
pre-deploy checklist, carried on dozens of Solidity blocks. The refined text keeps five sections
(Asset accounting, Prices and liquidations, Signatures and replay protection, Upgradeability and
authority, Before deployment) and states rules with almost no code.

Two known defects in the old text are fixed in the new one, and both are graded here:

- `safeApprove` → `forceApprove` ([[security-safeapprove-removed-in-oz-v5]]). The old text's
  SafeERC20 block prescribes `token.safeApprove(spender, amount)`, which OpenZeppelin removed in
  Contracts v5. `security-quiz-004` pins its repo to v5 and expect_2 fails any answer that
  prescribes `safeApprove`.
- A hardcoded hour → a per-feed maximum age ([[security-hardcoded-3600-staleness]]). The old
  Chainlink block hardcodes `require(block.timestamp - updatedAt < 3600, "Stale price")`.
  `security-quiz-002` expect_4 fails one global timeout asserted to fit every feed.

**Neither defect flipped a single run**, because the model overrides the text it was given.

## The model corrects its own skill

This is the sharpest finding in the benchmark, and it is not a pass-rate result.

On `security-quiz-004`, **all nine runs — every arm — prescribed `forceApprove`**, mentions per
answer:

| Arm | run 1 | run 2 | run 3 |
| --- | --- | --- | --- |
| new | 10 | 6 | 8 |
| old | 7 | 13 | 12 |
| none | 10 | 15 | 12 |

Every old-arm run had `safeApprove` in front of it in its own skill file and prescribed
`forceApprove` anyway. One went further and contradicted the skill in the deliverable:

> That single line is the whole fix. Do **not** reach for `safeApprove` — it was
> removed in OpenZeppelin Contracts v5 precisely because it reverted on the
> non-zero → non-zero case instead of handling it. `forceApprove` is its
> replacement.
>
> — `security-quiz-004` old-arm run 1

The same shape holds on the staleness bound. A **no-skill** run wrote:

> **Staleness check, per-feed.** `require(block.timestamp - updatedAt <= maxStaleness)`,
> where `maxStaleness` is derived from *that feed's* heartbeat plus a margin — e.g. 3600 +
> ~900s for ETH/USD. Do **not** use one global constant across feeds: USDC/USD is a
> 0.25% deviation / **24 hour** heartbeat feed, so the same constant is either far too
> tight for one or uselessly loose for the other.
>
> — `security-quiz-002` no-skill run 2

That is the refined skill's rule, produced with no skill installed and with the correct per-feed
heartbeats named from the model's own knowledge. Both `fixed_in: dcd9152a` records are confirmed
as still fixed on this stack, and both are confirmed as *never having been load-bearing* on a
frontier model — matching what the codex/gpt-5.4 measurements in those records already said.

## The one place the arms visibly diverge: `security-goal-001`

Pass rates are identical, but the code is not. Counted from each run's `src/*.sol`:

| Arm | run | inherits OZ `ERC4626` | OZ `ERC4626` import | virtual offset | balance-delta credit | SafeERC20 |
| --- | --- | --- | --- | --- | --- | --- |
| new | 1 | yes | yes | yes | yes | yes |
| new | 2 | yes | yes | yes | yes | yes |
| new | 3 | yes | yes | yes | yes | yes |
| old | 1 | yes | yes | yes | yes | yes |
| old | 2 | yes | yes | yes | yes | yes |
| old | 3 | yes | yes | yes | yes | yes |
| none | 1 | **no** | **no** | yes | yes | yes |
| none | 2 | **no** | **no** | yes | yes | yes |
| none | 3 | **no** | **no** | yes | yes | yes |

**Both skill arms inherit OpenZeppelin's `ERC4626` 3/3. All three no-skill runs hand-roll the
vault** and defend the empty state with their own virtual offset instead.

Every arm passes, because `security-goal-001` expect_1 accepts a hand-rolled virtual offset as
readily as the inherited base. So the skill did change behaviour — it routes the model to the
audited primitive, which is what the refined text's "start from OpenZeppelin `ERC4626`" asks for
— and the rubric is deliberately indifferent to that difference. Whether inheriting the audited
base is worth more than a correct hand-rolled offset is a real question this eval does not ask.

`security-goal-002` shows no such split: **all nine runs** chose a Chainlink push feed (no TWAP,
no `slot0` anywhere), SafeERC20, an `updatedAt` staleness check and explicit decimal
normalisation, and **all nine** chose the liquidator-supplies-USDC design, so expect_6 passes
through its no-swap branch in every run. The task notes ask which shape each run chose: it was
the same shape nine times out of nine.

## Cost

All figures from `yarn run-stats --tasks <ids> --benchmark major-refine-d9952522`, split per arm
with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`.
`cost_source: executor` throughout (claude's own reported price). Medians, with the cost range
and median `total_tokens`.

| Task | new | old | none |
| --- | --- | --- | --- |
| `goal-001` | 481s · $2.09 ($1.81–$2.42) · 1.28M | 434s · $1.88 ($1.82–$2.12) · 1.08M | **382s · $1.58** ($1.46–$1.74) · 876k |
| `goal-002` | **358s · $1.58** ($1.29–$1.91) · 738k | 399s · $1.72 ($1.70–$2.60) · 810k | 446s · $1.77 ($1.70–$1.95) · 842k |
| `quiz-001` | 100s · $0.38 ($0.30–$0.42) · 70.8k | 91s · $0.44 ($0.36–$0.49) · 113k | **82s · $0.29** ($0.29–$0.33) · 64.2k |
| `quiz-002` | 163s · $0.57 ($0.48–$0.64) · 120k | 186s · $0.68 ($0.61–$0.75) · 152k | **214s · $0.66** ($0.58–$0.67) · 121k |
| `quiz-003` | 89s · $0.34 ($0.27–$0.38) · 70.2k | 99s · $0.45 ($0.37–$0.47) · 87.1k | **86s · $0.33** ($0.31–$0.33) · 67.3k |
| `quiz-004` | **51s · $0.24** ($0.23–$0.25) · 63.5k | 59s · $0.34 ($0.33–$0.35) · 102k | 63s · $0.25 ($0.24–$0.28) · 78.7k |
| `quiz-005` | 61s · $0.28 ($0.27–$0.29) · 83.3k | 57s · $0.34 ($0.29–$0.35) · 77.7k | **64s · $0.26** ($0.25–$0.26) · 61.3k |
| `quiz-006` | 86s · $0.34 ($0.33–$0.41) · 69.2k | 77s · $0.39 ($0.34–$0.43) · 83.0k | **78s · $0.29** ($0.28–$0.34) · 63.7k |

**The refined text is cheaper than the old text on seven of eight tasks** — every task except
`goal-001` — and cheaper on tokens on six of eight. Against the old text it saves $0.10 per quiz
on average and $0.14 per run on `goal-002`. That is the 9× shorter prompt paying for itself:
the old text's 2713 words are billed through `cache_creation_input_tokens` and re-read every
turn through `cache_read_input_tokens`, and `quiz-004` shows it plainly — 102k tokens for the
old text against 63.5k for the new, for answers that scored identically.

**Against no skill, both skilled arms cost more on six of eight tasks.** On the two tasks where a
skill wins outright — `goal-002` (new is fastest and cheapest, 358s/$1.58 against 446s/$1.77) and
`quiz-002` (both skilled arms beat the baseline's 214s) — the skill saves the model the
deliberation the baseline spends working the oracle argument out from scratch. Everywhere else
the skill's own prompt is pure overhead on a task the model already passes.

`goal-001` is the one task where the refined text is the most expensive arm (481s/$2.09 against
the baseline's 382s/$1.58). The extra spend buys the OZ `ERC4626` inheritance documented above —
a real change in the artifact, worth nothing to the score.

## Run incidents

**One run was refused by `verify`'s judge-blindness guard** and is not in the tables above:

- `security-quiz-001` old-1 (`2026-09-22T143403Z-claude-with-skill-2f0adb01-1`) — `answer.md`
  wrote: *"The skill checklist's 'no floating point / division truncates' and 'vault inflation
  attack' items are the same defect seen from two angles."*

The executor exited 0; only grading was blocked. A judge reading that line learns a skill was
installed, so this is a genuine variant leak, not an incidental match. Per AGENTS.md the run dir
and its workspace were deleted and the run was set up and executed once more. **It was replaced
by exactly one fresh sample** — not re-rolled until clean, which would have biased the old arm
toward runs that ignore their skill. The replacement graded clean, 4/4. Neither
`--allow-skill-mention` nor `--grade-failed-run` was used anywhere in this benchmark.

**Six `security-goal-002` runs (rounds 2 and 3, all three arms) were killed by a Claude usage
limit** at 15:13Z and are not in the tables above. They exited 1 — round 2 partway through the
work (9 turns, 294s, $0.96), round 3 after a single turn at $0. `verify` refuses a non-zero exit,
which is what caught them; they were never graded. All six run dirs and workspaces were deleted
and the six runs were re-executed after the limit reset. The tables hold only the fresh runs.

**One harness incident, caused by this operator, damaged another session's run — not this
benchmark's.** `yarn clean-workspaces --delete`, run from this checkout to reclaim one orphaned
workspace, deleted the live workspace of a concurrent GPT 5.5 `security-quiz-001` run launched
from the `-test` clone. `clean-workspaces` treats a workspace as an orphan when *this* checkout
has no run dir for it, while `~/.cache/ethskills-evals/` is shared by every clone on the machine
— the failure mode AGENTS.md warns about ("run it after a benchmark, from the checkout that made
the runs, or live runs in another worktree look like orphans"). That run was deleted and re-run
by its own operator. Every run in this report was then made under a private
`EVAL_WORKSPACE_ROOT`, so no run here is affected.

Worth recording for future operators, from the damaged run: **a workspace deleted under a live
executor does not produce a non-zero exit.** That run exited 0 in 106s having spent ~128k tokens,
and its transcript reads as a model that produced a correct answer but could not write the file.
`executor.err` showed `Failed to write file <workspace>/answer.md`, which matches none of the
`SHELL_FAILURES` signatures in `lib/executor-health.ts`, so `verify` would have graded it as a
content failure. Filed as [[eval-deleted-workspace-grades-as-content-failure]].

## Evidence

Every run's deliverable is committed. The six quiz tasks leave a single `answer.md` (12–24K
each); the two goal tasks leave Foundry source trees (72–136K each, `lib/` and `out/` excluded by
the workspace's `.git/info/exclude`). `output/` is force-added for all 72 runs, ~3MB in total, so
every grade in this report can be re-checked — and regraded — by any reader of the PR.

One limit on the `forge build` check both goal tasks' notes ask for: several runs piped
`forge build` through `grep`, so the literal `Compiler run successful` banner does not appear in
their transcripts. What is checkable is that every one of the 18 goal runs invoked `forge build`,
none reported a compile error, and each committed a complete source tree; several state the
result in prose instead (`"forge build is clean and forge test passes 18/18"`). No run showed any
sign of a fabricated build. That is a slightly weaker claim than "the banner was observed in all
18", and it is stated as such.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **No, on either comparison.** new vs none: `24/24 vs 24/24`. new vs old: `24/24 vs 24/24`. Every arm passed every expect line of all eight tasks. The benchmark has no discriminating cell left on this stack. |
| Did it reduce time/tokens? | **Against the old text, yes, on 7 of 8 tasks** — e.g. `quiz-004` **51s / 63.5k / $0.24** vs **59s / 102k / $0.34**, `goal-002` **358s / 738k / $1.58** vs **399s / 810k / $1.72**. The 9× shorter text is the cheaper text almost everywhere. **Against no skill, no**: both skilled arms cost more on 6 of 8 tasks, the refined text worst on `goal-001` (481s/$2.09 vs 382s/$1.58). Only `goal-002` and `quiz-002` are cheaper with the skill than without. |
| Did it create negative deltas? | None on pass rate — no cell where new lost and old or none won. On cost, the refined text is the most expensive arm on `goal-001` (+99s, +$0.51, +400k tokens over baseline); it buys OZ `ERC4626` inheritance that the rubric does not reward. One old-arm run tripped the judge-blindness guard by quoting "the skill checklist" (see Run incidents) — a leak the refined text's phrasing did not produce in any run. |
| What mistakes repeated without the skill? | **None.** No no-skill run failed any expect line on any task. [[security-oracle-maxage-not-feed-derived]], the one record still `open` that this task set grades directly, did not reproduce: all three `quiz-002` no-skill runs derived `maxAge` from the named feed's published heartbeat, one of them citing the 24h USDC/USD heartbeat explicitly. |
| What mistakes remained with the skill? | **None**, in either skilled arm. Both stale-content records — [[security-safeapprove-removed-in-oz-v5]] and [[security-hardcoded-3600-staleness]] — are re-confirmed `fixed` in the refined text, and re-confirmed as never load-bearing: 3/3 old-arm `quiz-004` runs prescribed `forceApprove` against their own skill's `safeApprove`. |
| What should change in the skill? | **Nothing on this evidence, and this evidence cannot support a change either way.** The refined text passed 24/24 while being cheaper than the old text on 7 of 8 tasks, which is a reason to keep it; it is not evidence that any particular paragraph earns its place, because the unskilled baseline also passed 24/24. The one measured behavioural effect — routing to OZ `ERC4626` on `goal-001` rather than a hand-rolled vault — argues for keeping the "start from OpenZeppelin `ERC4626`" line specifically. Do not prune further on this stack's numbers; the three unmeasured stacks are where the remaining text may still be carrying weight. |
| What should change in the eval? | **This is the whole result.** (1) All eight tasks are saturated on Opus 5 medium — 72 runs, 0 failing cells, baseline included — so the task set needs rotating, not the rubrics loosening ([[security-eval-saturated-on-opus5-medium]]). (2) The two stale-content defects the rewrite fixed are ungradeable on a frontier model: it corrects them unprompted and says so in the deliverable, so `quiz-004` expect_2 and `quiz-002` expect_4 can only ever fail a model weak enough to copy a snippet. Their value is now on the open-model stacks. (3) `goal-001` grades an outcome (a defended empty state) that both a hand-rolled offset and OZ `ERC4626` satisfy, so the clearest skill effect in the benchmark is invisible to it — a task that graded *which primitive was reached for* would discriminate where this one cannot. (4) `goal-002` got nine identical designs out of nine, so its conditional expect_6 has never once been exercised on its swap branch. |
