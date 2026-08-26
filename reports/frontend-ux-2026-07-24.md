# Eval report: `skills/frontend-ux` (claude)

**Skill:** `skills/frontend-ux` @ `9a129f1` · **Date:** 2026-07-24

**Stack (one stack, start to finish):**
- **Executor:** `claude`, model `claude-opus-4-8` (fresh spawn per run; `--setting-sources project --dangerously-skip-permissions --strict-mcp-config`)
- **Judge:** `claude`, model `claude-opus-4-8` (fresh, blind process spawned by `verify`)
- **Runs:** 3 per variant per task. 6 tasks × 2 variants × 3 = **36 graded runs**.

> **`self_judged: true` on every run.** The framework sets `self_judged = (judge.agent === executor)`, and a single-claude-stack benchmark has both as `claude`, so the flag is true mechanically — not because an executor graded its own work. Each grade ran in a fresh, blind `claude -p` process that never saw the variant, the skill, or the transcript, exactly as "Running a pre-crafted task" prescribes. To guard against a same-model judge rubber-stamping, I spot-checked judge verdicts against the actual diffs/workspaces in both directions (a no_skill failure and a with_skill pass on the discriminating checks, plus one captured verbatim judge rationale); they held up. See "Judge reliability" below.

---

## Headline

| Task | no_skill | with_skill |
| --- | --- | --- |
| quiz-001 (tx-button lifecycle) | 3/3 | 3/3 |
| quiz-002 (USDC 6 decimals) | 3/3 | 3/3 |
| quiz-003 (four-state flow) | 3/3 | 3/3 |
| quiz-005 (ENS in address input) | 3/3 | 3/3 |
| **quizzes total** | **12/12** | **12/12** |
| goal-001 (USDC staking on SE-2) | **0/3** | **3/3** |
| goal-002 (USDC /pay, bare stack) | **0/3** | **3/3** |
| **goals total** | **0/6** | **6/6** |

The split is the whole story: **when the claim is asked directly (quizzes), Opus-4.8 already knows it — with or without the skill. When the same claim has to be applied unprompted while building (goals), the skill is the difference between 0/6 and 6/6.**

---

## Quizzes — knows-when-asked (no delta)

Every quiz passed 3/3 in **both** variants. The quizzes are designed so a stale-prior agent fails, but Opus-4.8 holds these priors:

- **quiz-001** (isPending drops at tx-hash, not confirmation; rejection skips a naive flag reset): no_skill derived the full hash→mined→refetch timeline and a `finally`/receipt-gated fix from scratch.
- **quiz-002** (USDC = 6 decimals, `parseEther` overshoots by 10¹²): recalled cold.
- **quiz-003** (four-state flow, approval status from onchain read): traced both planted bugs.
- **quiz-005** (ENS names have no hex form, need a resolving input): diagnosed.

**Transcript mining (the real quiz signal, since pass rate doesn't move):**
- **no_skill: 0 web searches / 0 web fetches across all 12 runs** — every answer came from parametric memory, not a lookup. The facts are searchable; the model didn't need to.
- **with_skill: the skill was opened in 10/12 runs** (Skill tool + distinctive SKILL.md text in-context). In quiz-002 runs 2 & 3 the model answered correctly *without* opening the available skill.
- Net: the skill changed the *process* (loaded reference text) but not the *outcome*. For this model, these particular priors are not stale when asked.

---

## Goals — applies-unprompted (full delta)

The prompts never name a rule; each is a decision on the way to a working product. Here the skill decides outcomes.

### Per-check breakdown (which rule, who passes)

goal-001 (SE-2 template) — 8 checks:

| # | Rule | no_skill | with_skill |
| --- | --- | --- | --- |
| 1 | R2 four-state flow | 3/3 | 3/3 |
| 2 | R1 per-button pending | 3/3 | 3/3 |
| 3 | R9 USDC 6 decimals | 3/3 | 3/3 |
| 4 | R4 USD context (ETH gas) | 2/3 | 3/3 |
| 5 | R7 error translation | 3/3 | 3/3 |
| 6 | **R8 metadata/branding** | **0/3** | **3/3** |
| 7 | R6 theme tokens | 3/3 | 3/3 |
| 8 | R5 Base retarget + polling | 2/3 | 3/3 |

goal-002 (bare) — 6 checks:

| # | Rule | no_skill | with_skill |
| --- | --- | --- | --- |
| 1 | **R3 ENS address input** | **0/3** | **3/3** |
| 2 | R9 USDC 6 decimals | 3/3 | 3/3 |
| 3 | **R4 USD context (ETH gas)** | **0/3** | **3/3** |
| 4 | R1 per-button pending | 3/3 | 3/3 |
| 5 | R7 error translation | 3/3 | 3/3 |
| 6 | **R8 metadata/identity** | **0/3** | **3/3** |

### What the skill actually fixes (and what the model already gets right)

**Rules the model already applies unprompted — the skill is redundant here:**
- **R9 decimals: 6/6 no_skill pass.** Contrary to the prior this eval set out to catch ("18-decimal reflex on USDC"), *every* no_skill build handled 6 decimals correctly — SE-2 mocks reported `decimals() = 6`, and the bare builds used `parseUnits(x, 6)` / on-chain `decimals()`. **Opus-4.8 has no stale 18-decimal prior.**
- **R1 per-button pending: 6/6 no_skill pass**, including the subtle isPending-window (`useWaitForTransactionReceipt` + `finally`/reset). **R7 error translation: 6/6 pass.** These survive with *no* scaffold (goal-002 bare), so it's the model carrying them, not the template.

**Rules the model skips unprompted — where the skill earns its keep:**
- **R8 metadata/branding — 6/6 no_skill fail, 0/6 with_skill fail.** The single strongest, most consistent gap. SE-2 no_skill runs shipped `'Scaffold-ETH 2 App'` / "Built with Scaffold-ETH 2"; bare no_skill runs set a title+description but no favicon and no OG/Twitter tags. with_skill rewrote them to the product ("USDC Staking on Base"). This is the one rule SE-2's own bundled guidance does **not** carry a no_skill run through.
- **R3 ENS address input — 3/3 no_skill fail (bare), 0/3 with_skill fail.** no_skill gated the recipient with `isAddress()` only; `vitalik.eth` is silently rejected. (goal-001 doesn't test this — SE-2 ships an Address component.)
- **R4 USD context — 4/6 no_skill fail.** Bare no_skill showed the ETH balance in raw ETH units, no price source (3/3 fail). On SE-2, 2/3 passed because the template's price-aware `<Balance>` carries USD for free; the fail came when a run swapped in a raw balance hook.
- **R5 Base retarget — 1/3 no_skill fail (SE-2).** One run never edited `scaffold.config.ts`, leaving `targetNetworks: [chains.hardhat]`. Weak evidence; the polling half of the check never discriminated (SE-2's 3000ms default is already healthy).

### Template vs model (goal-001 read against goal-002, per the task notes)

goal-001's notes warn that SE-2's bundled `.agents/`/`.claude/`/`AGENTS.md` can carry a no_skill run; goal-002 strips the scaffold to isolate that. Reading the shared rules (R1, R4, R7, R8, R9) across both:

- **Model-carried (pass in both, scaffold-independent):** R1 pending, R9 decimals, R7 errors. These pass 3/3 even bare — the model brings them.
- **Template-carried (goal-001 pass, goal-002 fail):** R4 USD context — SE-2's `<Balance>` supplies it; without a scaffold the model omits it 3/3.
- **Neither carries it (fail in both):** R8 metadata. Even SE-2 leaves defaults and nothing prompts the change.

So goal-001 no_skill's high per-check pass rate is **mostly the model, not the template** — the scaffold only rescues R4 (and provides the Address component that made R3 untestable there). The skill's real, scaffold-independent contribution is R8 (both goals) + R3 and R4 (bare).

### Stack choice, unprompted (goal-002 note-question #1)

With no scaffold given, **every goal-002 run — both variants — independently picked Next.js + wagmi + viem + RainbowKit + TanStack Query** and a sane `app/ + lib/ + components/` layout. Opus-4.8 reaches for the canonical SE-2-shaped stack on its own.

---

## Judge reliability (single-stack caveat, checked)

Because executor and judge are the same model, I validated verdicts against ground truth rather than trusting the aggregate:
- **Negative direction:** confirmed no_skill failures are real — e.g. captured the judge's verbatim rationale on goal-002 no_skill ("ETH balance displayed only as raw ETH units… no price source" → R4 fail; "no ENS resolution… `vitalik.eth` would fail `isAddress`" → R3 fail), each matching the code.
- **Positive direction:** confirmed with_skill passes are real — the metadata pass corresponds to an actual `layout.tsx`/`getMetadata.ts` rewrite; the R4 pass to SE-2's price-aware `<Balance>`.
- **One process note:** goal-002 was re-graded on git-diff evidence after I noticed `verify`'s snapshot excludes any dir named `lib/` (intended for Solidity forge libs), which drops app source in bare TS builds that use `lib/`. The re-grade was **byte-identical in outcome** to the snapshot grade — the judge had inferred decimals correctly from the visible component/README even without `lib/` — so the exclusion changed no result here. Flagged below as an eval robustness nit, not a result-affecting bug.

No run graded incorrectly on spot-check. No `self_judged` run is presented as independent beyond the mechanical-flag caveat above.

---

## Cost / time

- **Output tokens (cleaner signal than wall-clock):** with_skill ≈ or > no_skill — goal-001 75k→89k, goal-002 29k→41k, quizzes ~4.5k→4.5k. The skill does *more* work (reads reference text, adds the missing ENS/USD/metadata), so it does not reduce tokens.
- **Wall-clock/turns are not cleanly measured here** — no_skill goals ran under concurrency-2 contention (with API backoff) while some with_skill re-runs ran sequentially, so the apparent goal-001 time gap (18.5 vs 3.4 min) is a scheduling artifact, not a skill effect. Not claimed.

## Run integrity notes

- **5 infra recoveries, none affecting the reported numbers.** 4 executor runs died on transient "connection closed mid-response" API errors under concurrency-2 on the heavy goal builds (goal-001 with_skill ×1, goal-002 with_skill ×3) — discarded and **re-executed sequentially** to valid completion. 1 judge call hit the framework's 120s timeout under load (goal-001 no_skill/2) and was **re-graded** at low load (verify leaves a run ungraded on judge error, so this is a clean completion, not an overwrite). Final: 3 valid graded runs per variant per task.
- Grading and setup used the framework scripts throughout. goal-001 used git-diff evidence via a pristine-template baseline + `git reset --mixed` (the prompt says "committed code is the deliverable," so executors that `git commit` would otherwise yield an empty `git diff`); goal-002 was re-graded on git-diff evidence (see above).

---

## The required table

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **Goals yes, decisively: `6/6 vs 0/6`. Quizzes no: `12/12 vs 12/12`.** |
| Did it reduce time/tokens? | No. Output tokens ≈ or higher with_skill (it does more work). Wall-clock not cleanly measurable (concurrency-confounded). |
| Did it create negative deltas? | None observed. No with_skill run regressed a check that no_skill passed. |
| What mistakes repeated without the skill? | `metadata-left-as-template-default` (6/6), `address-input-no-ens-resolution` (3/3), `eth-balance-no-usd-context` (4/6), `target-network-not-retargeted` (1/3) |
| What mistakes remained with the skill? | None — all four dropped to 0 with_skill. |
| What should change in the skill? | See below — mostly it's well-targeted; trim/re-weight the rules the model already applies. |
| What should change in the eval? | See below — split expect_8; the `lib/` snapshot nit; consider a bare-scaffold quiz mirror for R8. |

### What should change in the skill

- **It works — the delta is real and clean.** The rules that move outcomes are R8 (metadata), R3 (address/ENS), R4 (USD context) — the product-completeness/polish rules the model skips unprompted. Keep these prominent.
- **Down-weight what the model already does.** R9 (decimals), R1 (pending, incl. the isPending window), R7 (errors) passed 6/6 no_skill unprompted. For Opus-4.8 these are settled knowledge; they add length without changing behavior. Consider compressing them to a one-line checklist and spending the space on R3/R4/R8 with concrete before/after snippets.
- **R8 is the headline win — make it the lead.** It's the only rule neither the model nor the SE-2 scaffold carries. A short "ship checklist" (tab title, favicon, OG/Twitter title+description+image) would be the highest-leverage addition.

### What should change in the eval

- **Split goal-001 expect_8.** It bundles Base-retarget (R5) with polling health; polling never discriminated (SE-2's 3000ms default is healthy), so the check only ever tests the retarget. Separate them so a pass/fail is unambiguous.
- **`verify` snapshot excludes `lib/`.** `GENERATED_DIRS` includes `lib` (for forge), which also drops app source in bare TS builds under `lib/` or `src/lib/`. It changed no result here (judge inferred from visible code), but it's a latent evidence gap for bare TS goals. Scope the exclusion to forge workspaces, or prefer git-diff evidence for bare builds.
- **R8 has no quiz mirror.** It's the strongest applied gap but is only measured by the goals (asked directly it's pure retrieval). That's the right call, but it means R8's signal rests entirely on 6 goal runs — worth keeping in mind if goal coverage shrinks.
- **The eval is the right artifact.** The quiz/goal split cleanly separated "knows" from "applies," which is exactly what surfaced that this skill's value for a strong model is unprompted product-polish, not correctness knowledge.
