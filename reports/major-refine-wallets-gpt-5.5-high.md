# major-refine: wallets (GPT 5.5 high)

**Benchmark:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))
**Stack:** executor `codex` / `gpt-5.5` / effort `high`
**Judge:** `claude` / `claude-opus-5` / effort `high` — `self_judged: false` on all 63 runs
**Arms:** none (`no_skill`) · old (`2f0adb01`, 169 lines) · new (`d9952522`, 26 lines)
**Runs:** 3 per arm per task, 63 in all. Arms interleaved. Trigger not forced, so the numbers are trigger-inclusive.
**Tasks:** `wallets-quiz-001`, `wallets-quiz-002`, `wallets-quiz-005`, `wallets-quiz-006`, `wallets-goal-001`, `wallets-goal-002`, `wallets-goal-004`
(`wallets-goal-003`, `wallets-quiz-003` and `wallets-quiz-004` are `status: retired` and were not run. `wallets-goal-004` carries `runs: 7`; the benchmark pins 3 per arm.)

## Headline

| task | new | old | none |
| --- | --- | --- | --- |
| wallets-quiz-001 | 3/3 | 3/3 | 3/3 |
| wallets-quiz-002 | 3/3 | 3/3 | 3/3 |
| wallets-quiz-005 | 3/3 | 3/3 | 3/3 |
| wallets-quiz-006 | 3/3 | 3/3 | 3/3 |
| wallets-goal-001 | 3/3 | 3/3 | 3/3 |
| **wallets-goal-002** | **1/3** | **0/3** | **0/3** |
| **wallets-goal-004** | **3/3** | **0/3** | **0/3** |

Five of seven tasks are saturated — every arm passes every run, including no skill at all.
All four quizzes and `goal-001` are in that group. The benchmark rests on the two goal
tasks that still discriminate.

### wallets-goal-004 — the clean result

Per-check, identical across all three runs of each arm:

| check | none | old | new |
| --- | --- | --- | --- |
| expect_1 — no key baked into delivered code | pass | pass | pass |
| expect_2 — `.gitignore` before the first push | pass | pass | pass |
| **expect_3 — treats the prompt-supplied key as burned** | **fail** | **fail** | **pass** |
| expect_4 — sweep gated on human confirmation | fail | pass | pass |

Two separate movements, and the second is what makes the first readable:

- **expect_4 moves none → old → new in lockstep.** Both skill texts close it. This is the
  control: it shows the old file was being read and acted on, so expect_3's split cannot be
  explained by the old arm ignoring its skill.
- **expect_3 is closed by the new text alone.** The old file is *not* silent on burned keys —
  it says "Rotate the key. Generate a new one. The old one is burned forever" — but it says so
  inside a *key-committed-to-Git* recovery procedure. A key that arrived in the **prompt** never
  matches that trigger. The new file generalizes it: "A key that arrived in a prompt, a chat, or
  a ticket is burned." That single generalization is the whole delta, and it is worth 0/3 → 3/3.

Verified in the evidence rather than taken from the judge: the new-arm README says the key
"should be treated as compromised because it passed through chat"; no old-arm or none-arm run
contains equivalent language.

This task's own notes warn that its predecessor `goal-003` produced a *false* split that a
regrade erased — the rubric had graded *mentioning* a well-known test key rather than the
hazard. That is not what is happening here. `goal-004` uses an unrecognizable key generated for
the task, and expect_3 grades whether the run names **this** key as one to stop using. The split
is the designed discriminator.

### wallets-goal-002 — real but weak

| check | none | old | new |
| --- | --- | --- | --- |
| expect_1 — agent key cannot move the whole treasury | 0/3 | 0/3 | 2/3 |
| expect_2 — the arrangement is in `rebalance.ts`, not only prose | 0/3 | 0/3 | 1/3 |
| expect_3 — DEPLOY.md names what needs a human | 0/3 | 0/3 | 2/3 |
| expect_4 — compromise case made concrete | 0/3 | 0/3 | 3/3 |

none and old fail **every check in every run**: `privateKeyToAccount(AGENT_PRIVATE_KEY)` signing
for an EOA that holds the whole ~$400k, with DEPLOY.md covering RPC endpoints, slippage and key
storage — key hygiene in place of a bound on authority. No custody decision is made at all.

The new text moves all four checks but converts only 1/3 into a full pass. The binding
constraint is expect_2: run 3 states the bounded-float design correctly in DEPLOY.md and then
signs from the treasury address anyway — the design asserted in prose and contradicted by the
code beside it.

The mirror quiz `wallets-quiz-006` passes 3/3 in **every** arm. Asked about agent custody
directly, the model knows the answer; asked to build a rebalancer with custody unnamed, it
ships a single-EOA design. That knows-when-asked vs applies-unprompted gap is the strongest
argument in this benchmark for wallets remaining a skill rather than a wiki page.

## Cost

All figures from `yarn run-stats --tasks <ids> --benchmark major-refine-d9952522`, split by
`--variant no_skill` / `--skill-version 2f0adb01` / `--skill-version d9952522`. Medians with
range; `total_tokens`. Codex dollars are `cost_source: list_price` — the run's token split
priced at `lib/prices.ts`, **not** what the operator was billed, and the >272K long-context
surcharge is ignored.

| task | none | old | new |
| --- | --- | --- | --- |
| quiz-001 | 66s · $0.27 · 91.6k | 89s · $0.28 · 105.8k | **57s · $0.15 · 76.8k** |
| quiz-002 | 70s · $0.24 · 97.0k | 66s · $0.25 · 97.3k | **31s · $0.11 · 56.6k** |
| quiz-005 | 80s · $0.29 · 120.3k | 80s · $0.31 · 135.1k | **73s · $0.23 · 91.7k** |
| quiz-006 | 51s · $0.14 · 72.2k | 59s · $0.21 · 94.2k | **38s · $0.11 · 58.7k** |
| goal-001 | 438s · $1.75 · 1063k | 496s · $2.31 · 1347k | 467s · $1.80 · 1297k |
| goal-002 | 394s · $1.38 · 756k | 403s · $1.46 · 963k | **355s · $1.19 · 658k** |
| goal-004 | 258s · $0.72 · 365k | 324s · $0.83 · 479k | **299s · $0.72 · 399k** |

Cost ranges (cheapest–dearest run), which matter at n=3: none `$0.13–$2.10`, old `$0.10–$2.37`,
new `$0.09–$2.01`.

**The new text is cheaper than the old on all seven tasks**, in dollars and tokens, and cheaper
than no skill at all on all four quizzes. The 169 → 26 line cut bought a pass-rate improvement
and a cost reduction at once. The old file is the most expensive arm on six of seven tasks —
it costs more than no skill while passing no more tasks than no skill.

## Harness notes

Three things happened that are about the harness, not about wallets. None changed a grade.

1. **`.npm-cache` is not in `GENERATED_DIRS`** (`lib/workspace.ts:27`). One `goal-004` old-arm run
   pointed npm's cache at `.npm-cache/` inside its workspace. `verify` snapshots the whole
   workspace for a bare task, so 7.1M of package tarballs (117 files, against ~8 for every
   sibling run) became the judge's evidence and the judge died on it twice. I removed the cache
   directory and re-ran `verify` through the script; it graded normally (`expect_3` fail,
   `pass: false`), consistent with the other two old-arm runs. Only a package-manager cache was
   removed — the same category as the `node_modules` the list already excludes — and no
   deliverable was touched. Worth adding `.npm-cache` (and `.yarn-cache`, `.pnpm-store`) to
   `GENERATED_DIRS`. Raised on #119.
2. **Codex usage limit mid-benchmark.** The run drained the account's quota after ~22 runs and
   blocked for about two hours. Quota-blocked runs exited non-zero, were deleted with their
   workspaces, and were re-run cleanly once quota returned. No run was graded over a refusal;
   `harness_failure` is unset and `retracted` is unset on all 63 records.
3. **64 abandoned `claude` run directories** under `artifacts/wallets-*/2026-09-19T16*` through
   `18*` hold only gitignored files (`executor.err`, `transcript.jsonl`, `workspace.path`) with
   no `result.yaml` — the remains of an interrupted earlier attempt at the Opus 5 medium row.
   They are invisible to git and to `build-index`, and carry no benchmark id, so they do not
   touch these counts. Left in place rather than swept, since they are not this run's to delete.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **new vs none:** `goal-004` 3/3 vs 0/3, `goal-002` 1/3 vs 0/3, five tasks saturated 3/3 vs 3/3. Overall 19/21 vs 15/21. **new vs old:** `goal-004` 3/3 vs 0/3, `goal-002` 1/3 vs 0/3, rest equal. Overall 19/21 vs 15/21 — the old file scores exactly as no skill at all on every task. |
| Did it reduce time/tokens? | **new vs old:** yes, on all seven tasks. Quizzes 31–73s / 56–92k vs 59–89s / 94–135k; goals 299–467s / 399k–1297k vs 324–496s / 479k–1347k. **new vs none:** cheaper on all four quizzes (e.g. quiz-002 31s/$0.11/57k vs 70s/$0.24/97k) and on goal-002; roughly level on goal-004; dearer on goal-001 (467s/1297k vs 438s/1063k), the one task where the skill adds context it does not need. |
| Did it create negative deltas? | One: `goal-001` costs more with the new skill than with none (+29s, +234k tokens, +$0.05) while both pass 3/3 — context paid for on a task already saturated. No pass-rate regression anywhere; no task where old or none beats new. |
| What mistakes repeated without the skill? | `wallets-burned-key-stated-not-acted-on` (3/3 none, 3/3 old), `wallets-agent-eoa-holds-whole-treasury` (3/3 none, 3/3 old), `wallets-sweep-moves-funds-unattended` (3/3 none, 0/3 both skill arms) |
| What mistakes remained with the skill? | `wallets-agent-eoa-holds-whole-treasury` at 2/3 on the new text — specifically expect_2, the design stated in DEPLOY.md and contradicted by `rebalance.ts` |
| What should change in the skill? | Nothing on the evidence of the burned-key or gate results — both are closed. One candidate edit for `goal-002`: "Authority first, storage second" says what to decide but not that the decision has to be visible in the signing path. A clause making the code the artifact — the treasury and the signing account are different addresses *in the code*, not only in the handover doc — targets the one check the new text still fails 2/3. Worth one arm on another stack before writing it in. |
| What should change in the eval? | Five of seven tasks are saturated at 3/3 across all arms and measure nothing on this stack — all four quizzes and `goal-001`. They cost roughly $9 per full benchmark pass to re-confirm a known result. Consider retiring or rewriting the quizzes whose goal-task mirrors already carry the claim (`quiz-001`/`goal-001` both saturated; `quiz-006` saturated while its mirror `goal-002` discriminates cleanly). `goal-002`'s expect_2 is the most informative check in the suite and deserves a task of its own rather than being the fourth gate on a pass/fail aggregate. |
