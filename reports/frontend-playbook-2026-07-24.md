# Eval report: `skills/frontend-playbook` (claude)

**Skill:** `skills/frontend-playbook` @ `9a129f1` · **Date:** 2026-07-24
**Source:** vendored from `ethskills.com/frontend-playbook/SKILL.md` (byte-identical check recorded in task notes, 2026-07-16)

**Stack (one stack, start to finish):**
- **Executor:** `claude`, model `claude-opus-4-8` (fresh spawn per run; `--setting-sources project --dangerously-skip-permissions --strict-mcp-config`)
- **Judge:** `claude`, model `claude-opus-4-8` (fresh, blind process spawned by `verify`)
- **Node:** executors ran on **Node v25.9.0** on every run (recorded per run in `node-version.txt`) — required so goal-001 expect_10 and quiz-004 actually fire the localStorage prerender crash.
- **Runs:** 3 per variant per task. 8 tasks × 2 variants × 3 = **48 graded runs**.

> **`self_judged: true` on every run.** The framework sets `self_judged = (judge.agent === executor)`, and a single-claude-stack benchmark has both as `claude`, so the flag is true mechanically — not because an executor graded its own work. Each grade ran in a fresh, blind `claude -p` process that never saw the variant, the skill, or the transcript. I spot-checked the discriminating verdicts against the actual outputs in both directions (see "Judge reliability"); they held.

> **Infrastructure note (no effect on results).** The run hit the account's spend/rate limit partway through the goals. Runs that failed with a `429` never produced a grade; I deleted those run dirs (no partial data kept) and re-ran them fresh after the limit cleared — goal-002 serially, to keep the token burst under the cap. Every number below is from a clean, fully-graded run.

---

## Headline

| Task | Claim under test | no_skill | with_skill |
| --- | --- | --- | --- |
| quiz-001 | fork, not chain | 3/3 | 3/3 |
| quiz-002 | fork Base → target chains.foundry (31337) | 3/3 | 3/3 |
| quiz-003 | trailingSlash / IPFS routing | 3/3 | 3/3 |
| quiz-004 | Node 25 built-in localStorage prerender crash | 2/3 | 3/3 |
| quiz-005 | anvil per-tx mining freezes block.timestamp | **0/3** | **3/3** |
| quiz-006 | unchanged CID proves a stale build shipped | 3/3 | 3/3 |
| **quizzes total** | | **14/18** | **18/18** |
| goal-001 | tip jar on SE-2 template (10 checks) | **0/3** | **3/3** |
| goal-002 | scaffold decision from empty (create-eth) | **0/3** | **3/3** |
| **goals total** | | **0/6** | **6/6** |

The split is the whole story, and it repeats the pattern seen in the `frontend-ux` eval: **when a claim is asked directly (quizzes), Opus-4.8 mostly already knows it. When the same class of decision has to be applied unprompted while building (goals), the skill is the difference between 0/6 and 6/6.** The quizzes are the exception that proves it — two of them (005, and partly 004) name specifics the model's parametric memory stops just short of.

---

## Quizzes — mostly knows-when-asked

**Trigger:** the Skill tool fired in **24/24 with_skill runs** — perfect trigger rate, no forced-trigger line needed.
**Lookups:** across **24 no_skill runs, only 2 web-searched** — both on quiz-004 (Node 25). Every other no_skill answer came from parametric memory, not a lookup. The model itself treats Node-25 localStorage as the one item worth checking.

**Four claims the base model holds cold (3/3 both variants, no delta):**
- **quiz-001 (fork, not chain):** no_skill reasoned straight from the symptoms — empty `yarn chain` has no code at the USDC address, so the probe and every integration call revert; passing mock tests say nothing — and produced `yarn fork --network base` + whale impersonation for funding, unprompted.
- **quiz-002 (31337):** named both chain IDs (fork = local anvil 31337 where the vault lives; `chains.base` = 8453 where it doesn't), argued against the plausible-looking `chains.base` config, and gave `chains.foundry`. Cold.
- **quiz-003 (trailingSlash):** derived the gateway directory-resolution mechanism (bare `/debug` looks for `debug/` dir; `debug.html` is unreachable) and landed on `trailingSlash: true` + the `ls out/*/index.html` verification.
- **quiz-006 (stale build / CID):** refuted the gateway-cache theory from content-addressing (identical CID = byte-identical content = old build re-shipped) and prescribed the clean-rebuild discipline. Exactly as the task notes predicted ("expect no_skill to do relatively well here").

**Two claims where the skill moved the outcome:**
- **quiz-005 (frozen timestamp): 0/3 → 3/3.** Every no_skill run nailed the mining mechanism *and* the permanent fix (`--block-time 1`), but for the live-demo one-off reached for `evm_mine` / `evm_increaseTime` (manual per-block nudging) instead of `anvil_setIntervalMining 1`. expect_3 names interval mining specifically, so all three failed it. with_skill gave the exact pairing every time. → `frozen-timestamp-wrong-oneoff-fix`
- **quiz-004 (Node 25 localStorage): 2/3 → 3/3.** no_skill got the mechanism and refuted teammate B's `instrumentation.ts` fix from the build-worker process model in all three runs (expect_1 & 2 pass 3/3). One run then stopped at app-code guards + pinning CI to Node 24 rather than a process-level fix that reaches the workers, and failed expect_3. → `node25-localstorage-fix-wrong-layer`

---

## Goals — applies-unprompted (full delta)

### goal-001 (SE-2 foundry template) — 10 checks, per-check no_skill vs with_skill

| # | Decision | no_skill | with_skill | mirror |
| --- | --- | --- | --- | --- |
| 1 | fork of Base for local dev | 3/3 | 3/3 | quiz-001 |
| 2 | real Base USDC on the fork (not a mock) | 3/3 | 3/3 | quiz-001 |
| 3 | USDC via fork powers (whale impersonation) | 3/3 | 3/3 | quiz-001 |
| 4 | scaffold.config targets chains.foundry (31337) | 3/3 | 3/3 | quiz-002 |
| 5 | output export + trailingSlash + unoptimized | 3/3 | 3/3 | quiz-003 |
| 6 | **DEPLOY.md deletes .next/out before build** | **0/3** | **3/3** | quiz-006 |
| 7 | **changed CID as proof new content shipped** | **0/3** | **3/3** | quiz-006 |
| 8 | **verify a non-home route on the gateway** | **1/3** | **3/3** | quiz-003 |
| 9 | **OG/social metadata → prod URL, not localhost** | **0/3** | **3/3** | (none) |
| 10 | **Node 25 prerender handled (process-level)** | **1/3** | **3/3** | quiz-004 |

**The clean line: no_skill applies the fork-mode setup perfectly (checks 1–5, all 3/3) but drops the deploy/production discipline (6–9) and half-handles Node 25 (10).** The fork decisions that the quizzes show the model knows when asked, it also *applies* unprompted. The deploy discipline it knows when asked (quiz-006 3/3) but does **not** reach for while building — its own DEPLOY.md omits the clean rebuild and the CID-as-proof framing every time.

Mistakes filed from goal-001: `deploy-no-clean-rebuild-no-cid-proof` (checks 6–7), `deploy-verify-home-route-only` (check 8), `og-metadata-not-prod-url` (check 9), and `node25-localstorage-fix-wrong-layer` (check 10, shared with quiz-004).

### goal-002 (bare workspace) — the scaffold decision, 0/3 vs 3/3

The single cleanest separator in the benchmark. All 3 no_skill runs hand-rolled the stack with `forge init` + a manual Next.js app, producing a `/frontend` + `/contracts` split — **zero `create-eth` invocations**, no SE-2 monorepo, no generator-wired RainbowKit/wagmi/scaffold-eth tooling. All 3 with_skill runs invoked `npx create-eth@latest` (via the Skill tool) and produced the `packages/foundry` + `packages/nextjs` monorepo.

expect_2 (scaffolded wallet/contract tooling) is conditional on expect_1 (SE-2 monorepo) — a hand-rolled stack fails it mechanically — so each no_skill `0/2` is **one** failure (the scaffold miss), not two. This is the skill's headline "never set up the project manually" prior, and it is structurally the *only* place in the set it can fire: goal-001 ships a pre-scaffolded template and every quiz opens post-scaffold. → `scaffold-manual-not-create-eth`

---

## Mistake records filed (6)

| id | where | no_skill | with_skill |
| --- | --- | --- | --- |
| `scaffold-manual-not-create-eth` | goal-002 | 3/3 | 0/3 |
| `frozen-timestamp-wrong-oneoff-fix` | quiz-005 | 3/3 | 0/3 |
| `deploy-no-clean-rebuild-no-cid-proof` | goal-001 e6/e7 | 3/3 | 0/3 |
| `og-metadata-not-prod-url` | goal-001 e9 | 3/3 | 0/3 |
| `deploy-verify-home-route-only` | goal-001 e8 | 2/3 | 0/3 |
| `node25-localstorage-fix-wrong-layer` | quiz-004 e3 + goal-001 e10 | quiz 1/3 · goal 2/3 | 0/3 |

(Frequencies are how often the *mistake* occurs, i.e. inverse of pass rate.)

---

## Judge reliability

Same-model judge (claude/opus grading claude/opus), so I spot-checked the discriminating verdicts against the actual outputs, both directions:
- **goal-002 no_skill (graded fail):** output tree is `/frontend` + `/contracts` from `forge init`, no `packages/` monorepo — fail is correct.
- **goal-002 with_skill (graded pass):** transcript shows `create-eth` (19 refs) and a scaffolded project dir — pass is correct.
- **goal-001 no_skill (graded fail):** DEPLOY.md curls only `/` on the gateway, never deletes `.next`/`out`, frames the CID as "immutable version" not as proof, sets no production OG metadata — the four failed checks are all genuinely absent.
- **quiz-005 no_skill (graded fail on expect_3):** answer leads with `evm_mine`/`evm_increaseTime`, never `anvil_setIntervalMining` — fail is correct. with_skill answer gives `anvil_setIntervalMining 1` explicitly — pass is correct.

No rubber-stamping observed. The judge also correctly passed no_skill on the four claims the model genuinely holds (quizzes 001/002/003/006), rather than failing everything without the skill — evidence it graded on content, not variant.

---

## Node version (goal-001 expect_10, quiz-004)

All executors ran on **Node v25.9.0**. This is load-bearing: on older Node the built-in experimental localStorage is absent, prerender never crashes, and a correct build ships with no polyfill — which would false-*pass* no_skill on expect_10 and defuse quiz-004 entirely. On Node 25 the crash is real, which is why no_skill's app-code-guard / Node-24-pin fixes failed to cover it and the with_skill process-level polyfill passed.

---

## Summary table

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes. Overall **24/24 with_skill vs 14/24 no_skill**. Goals **6/6 vs 0/6**; quizzes **18/18 vs 14/18**. |
| Did it reduce time/tokens? | Not measured as a goal; with_skill goal runs were if anything longer (opened the skill, ran `create-eth`). No token savings claimed. |
| Did it create negative deltas? | None. No check regressed with the skill; no with_skill run failed any check. |
| What mistakes repeated without the skill? | `scaffold-manual-not-create-eth` (3/3), `frozen-timestamp-wrong-oneoff-fix` (3/3), `deploy-no-clean-rebuild-no-cid-proof` (3/3), `og-metadata-not-prod-url` (3/3), `deploy-verify-home-route-only` (2/3), `node25-localstorage-fix-wrong-layer` (quiz 1/3 · goal 2/3). |
| What mistakes remained with the skill? | None — all six are 0/3 with_skill. |
| What should change in the skill? | Nothing load-bearing is missing — every mistake maps to a section the skill already has, and with_skill fixed all of them. The skill's real value concentrates in the *unprompted-application* items (scaffold choice, deploy discipline, Node 25, interval mining); the four "known cold" claims (fork/31337/trailingSlash/CID) are ones Opus-4.8 no longer needs told when asked. If trimming for length, those four are the least load-bearing for this model — but they still pay off in goal-001 by being applied, so keep them. |
| What should change in the eval? | (1) quiz-005 expect_3 is strict: no_skill answers were mechanically sound (correct diagnosis + valid permanent `--block-time` fix + a working manual one-off) and failed only for not naming `anvil_setIntervalMining`. Real delta, but the expect could split "any working one-off" from "the interval-mining one-off" to show it. (2) Four quizzes (001/002/003/006) are 3/3 both variants on this model — they document non-staleness rather than skill value; keep for the record but expect no separation. (3) All runs `self_judged` on a single stack — a codex judge pass would harden the goal grades, which are the load-bearing ones. |
