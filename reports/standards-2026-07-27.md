# Eval report — skill `standards` (claude stack)

**Skill:** `skills/standards` @ `9a129f1` (source: ethskills.com/standards/SKILL.md, vendored at `191dcc1`)
**Executor:** claude, `claude-opus-5` — fresh `claude -p` per run, pointed only at `TASK.md`.
**Judge:** claude, `claude-opus-5` — blind (`--judge-agent claude --judge-model claude-opus-5`), fresh process per run, sees only task input + evidence, never the variant/skill/transcript.
**Runs:** 3 per variant per task; 3 tasks × 2 variants × 3 = **18 executor runs**, all graded.
**Date:** 2026-07-27. Content-only variant (agent decides whether to use the skill); **no trigger line prepended**.

> **`self_judged: true` on all 18 runs.** The framework sets it when `judge.agent == executor.agent`; both are `claude` because AGENTS.md prescribes one stack (claude → opus), and codex is not installed on this machine. Grading was still independent: a fresh, blind `claude -p` per run with `--judge-agent`/`--judge-model` passed explicitly. Disclosed as required. The residual risk is correlated blind spots — same model writing and grading — and this benchmark produced a concrete instance of it, documented under "Judge inconsistency" below.

## Headline

| Task | Shape | no_skill | with_skill |
| --- | --- | --- | --- |
| standards-quiz-001 agent-commerce cluster (ERC-8004 + x402 + EIP-3009) | quiz | **3/3** | **3/3** |
| standards-quiz-002 EIP-7702 upgrading an existing EOA in place | quiz | **3/3** | **3/3** |
| standards-goal-001 build the service side, ten expect lines | goal | **2/3** | **3/3** |

**17/18 runs pass. 131/132 individual expect lines pass.** The one failure is `standards-goal-001` expect_10 in a `no_skill` run.

**The stale prior this eval was built to catch is not stale for `claude-opus-5`.** The task specs assume a model that misses ERC-8004/x402/EIP-3009 and treats EIP-7702 as unshipped, and predicted `0/3` on both goal variants as a plausible headline. Nothing of the kind happened. Every `no_skill` run reached for the right standards unprompted, produced the right registry addresses, the right `350000` encoding, the right Base USDC contract, and the correct EIP-7702 liveness and persistence semantics. Two of three `no_skill` goal runs did it with **zero web calls** — pure parametric knowledge.

What the skill still changes is **cost** and **one specific completeness gap**.

## The one discriminating check

`standards-goal-001` expect_10 asks for `.well-known/agent-registration.json` binding the domain to `agentId`, the registry, and the `owner` address — the skill's registration step 4.

| run | serves the file | fields | graded |
| --- | --- | --- | --- |
| with_skill-1 | yes | agentId, agentRegistry, owner | pass |
| with_skill-2 | yes | agentId, agentRegistry, owner | pass |
| with_skill-3 | yes | agentId, agentRegistry, owner | pass |
| no_skill-1 | **no** — `agent-card.json` with `registrations[]`, no owner | — | fail |
| no_skill-2 | yes | agentId, agentRegistry, owner | pass |
| no_skill-3 | **no** — `agent-card.json` with `registrations[]` + signature, no owner | — | pass (see below) |

The substitution is consistent and interesting: without the skill the model reaches for the **A2A agent card** and closes the loop with a `registrations[]` array pointing back at `{agentId, agentRegistry}`. That proves the document claims an identity; it does not prove the domain controls it, which is the point of the ERC-8004 file. Filed as `standards-missing-domain-binding`.

This is the only one of 22 distinct expect lines where the variants diverge.

## Judge inconsistency (affects the headline)

`no_skill-1` and `no_skill-3` omitted the domain-binding file in materially identical ways — both served only `.well-known/agent-card.json` with a `registrations[]` back-pointer and no `owner` address. The judge **failed** the first and **passed** the second. expect_10 says explicitly "Omitting this domain-binding file fails this check", so the pass on `no_skill-3` is an error, not a defensible reading.

Consequences, stated plainly:

- **As graded and recorded:** `standards-goal-001` no_skill = 2/3. The `result.yaml` files say what the judge said; runs are append-only and I did not re-grade, because I have read the skill and the expect lines and cannot grade blind.
- **On the evidence:** no_skill = 1/3 on expect_10. The mistake record carries the substantive frequency (2/3 omitted), not the scored one.

One false pass in 132 expect-line judgments is a ~0.8% error rate, and it landed on the single check that carried the entire signal — which is the argument for not resting a benchmark's conclusion on one line judged once.

## Judge blindness was broken on 4 runs

Both quiz inputs say "showing how you got each value". `with_skill` runs comply by citing their source — the skill — inside `answer.md`, which is exactly the evidence the judge reads:

- `quiz-002/with-skill-1`: prints the path `.claude/skills/standards/SKILL.md` and quotes it.
- `quiz-002/with-skill-2`: "the `standards` skill's EIP-7702 section states it directly — …".
- `quiz-001/with-skill-2` and `with-skill-3`: "Cross-check against the skill's reference values — $0.10 → `100000`…".

So 4 of 9 `with_skill` runs told the judge which variant they were. No `no_skill` run could do the reverse. This did not change any outcome here (those 4 runs are in the all-pass region, and `no_skill` matched them 3/3 on both quizzes), but the blindness guarantee AGENTS.md rests on is not actually holding, and it would matter on a benchmark that discriminates. Fix belongs in the task inputs, not the framework: ask for derivations without inviting source citation, or strip skill references from evidence before the judge sees it.

## Where the standards came from (transcript mining)

Required by all three task notes: distinguish a knowledge result from a retrieval result.

**standards-quiz-001.** All three `no_skill` runs named ERC-8004 **in their first search query** ("ERC-8004 Trustless Agents Identity Registry deployment address Base"), so recognition was parametric; the web was used to confirm addresses and encodings, not to discover the standard. They went further than the skill does: two ran `eth_call` against Base mainnet (`ownerOf(7311)`, `decimals()`, proxy-implementation storage slots) to verify the registry was really deployed at that address. None invented a bespoke registry, an API-key scheme, or a self-hosted directory. `with_skill` runs made **zero** web calls.

**standards-quiz-002.** All three `no_skill` runs identified EIP-7702 and Pectra unprompted. Run 3 used no web search at all: it scanned live mainnet blocks with `cast` for type-4 transactions and `0xef0100…` delegation designators, then read a revocation transaction to demonstrate that delegation persists until cleared. It spent $3.36 and 771s establishing what the skill states in one line.

**standards-goal-001.** All three `no_skill` runs reached ERC-8004 (both registries), x402, and EIP-3009 unprompted, and two of the three used **zero** web calls. The failure mode the task notes predicted — "an API key tier, an approve/transferFrom charge, a self-hosted reviews table" — did not appear in any run, either variant. The substitution that did appear is narrower and is the domain-binding one above.

**Skill trigger: 9/9.** The Skill tool fired in every `with_skill` run without a trigger line, on all three tasks.

## Cost

| variant | runs | avg $/run | avg wall-clock | avg turns | avg output tokens | web calls (total) |
| --- | --- | --- | --- | --- | --- | --- |
| no_skill | 9 | $1.85 | 421s | 28 | 27,185 | 40 |
| with_skill | 9 | $0.69 | 170s | 8 | 11,977 | 0 |

**The skill costs 63% less and runs 2.5× faster for the same answers.** The mechanism is visible in the transcripts: `no_skill` spends its budget re-deriving the skill's content from the live internet and the chain. The quizzes are the extreme case — `with_skill` averages $0.32/63s on quiz-001 against `no_skill`'s $1.49/292s, a 4.7× cost ratio, for identical 7/7 grades.

On the goal task the gap narrows ($1.33 vs $2.44) because most of the work is writing the server, not recalling standards.

This inverts the result from the `testing` skill eval on the same stack, where the skill cost ~11% *more* and bought nothing. The difference is that `standards` content is specific and verifiable (addresses, decimals, dates), so having it inline replaces expensive lookup; `testing` content is methodological, and the model already applied it.

## Run incidents

Two operational faults hit this benchmark. Neither changed a graded result; both are recorded because the artifacts show their traces.

**1. Four goal runs killed mid-stream by a harness timeout.** The first `standards-goal-001` batch ran under a background task capped at 10 minutes; goal runs need 6-14. Four runs were killed with `terminal_reason: aborted_streaming`. Partial work was **not graded** — the four run dirs were deleted and the runs relaunched from fresh workspaces with new run ids (`2026-07-27T1115*`). The two `with_skill` runs that had already exited cleanly (`110521Z`, `110528Z`) were kept and graded. No `result.yaml` was ever overwritten, so the append-only rule holds. Detached relaunch also needed two fixes worth recording for the next orchestrator: macOS has no `setsid`, and a `nohup` wrapper that `cd`s into the workspace must use **absolute** paths for its redirects or the transcript silently goes nowhere.

**2. A goal executor rewrote the eval repo's own `package.json` and `yarn.lock`.** `standards-goal-001` starts from a bare workspace with no `package.json`. At least one executor ran `npm install express viem @types/express` before creating one, so npm walked up the tree, found the eval repo's root manifest, and installed into it — adding `express` and `viem` to the framework's dependencies, bumping its devDeps, regenerating `yarn.lock`, and dropping a `package-lock.json` at the root. This broke `yarn setup` and `yarn verify` until both files were restored with `git checkout`. Nothing under `tasks/`, `skills/`, or any run's graded evidence was touched. This is a property of the fixture, not of this session: workspaces live *inside* the eval repo, so any bare-workspace task that invites `npm install` can do it again.

## Workspace isolation

Executors are not confined to their workspace. In 6 of 18 runs the agent ran `ls`, `git log`, or `cat package.json` in a way that surfaced the eval repo's own tree or commit history, learning it was running inside a skill-eval repo. All six were `no_skill` runs — with the skill in hand the agent goes straight to it and never orients by exploring. **No run read `tasks/*.yaml`, any expect line, or `skills/standards/`** — grepping all 18 transcripts for `tasks/standards`, `standards-*.yaml`, `expect:`, and `skills/standards` returns hits only in `with_skill` runs and only from the skill install the variant is supposed to have. The grading surface never leaked, but containment is conventional, not enforced.

Separately, every executor's system prompt carries this project's auto-memory path. Its one memory file concerns Scaffold-ETH vendoring and says nothing about these tasks or their expectations.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Marginally, on one task: `2/3 vs 3/3` on standards-goal-001 (`1/3 vs 3/3` correcting the judge's false pass). `3/3 vs 3/3` on both quizzes. Overall 8/9 vs 9/9. |
| Did it reduce time/tokens? | **Yes, substantially.** $1.85 → $0.69 per run (−63%), 421s → 170s (−60%), 27.2k → 12.0k output tokens (−56%), 40 web calls → 0. Largest on the quizzes (4.7× on quiz-001), smallest on the goal task. |
| Did it create negative deltas? | None. No `with_skill` run failed any check, and none was slower or costlier than its `no_skill` counterpart. |
| What mistakes repeated without the skill? | `standards-missing-domain-binding` (2/3 no_skill goal runs). Nothing else — the predicted API-key / approve-transferFrom / self-hosted-reviews substitutions never appeared. |
| What mistakes remained with the skill? | None. 66/66 expect lines pass across all 9 `with_skill` runs. |
| What should change in the skill? | Nothing this eval justifies on correctness grounds. One content gap is worth writing anyway, on first principles rather than on evidence: the EIP-7702 section (skill:372-378) never says the delegation designator points at an implementation address or that the EOA's own key signs the authorization — quiz-002 expect_3 grades exactly that, and the model passed 3/3 from its own knowledge, so the gap cost nothing here. Optionally add the testnet registry address (`0x8004A818BFB912233c491871b3d84c89A494BD9e`), which the skill omits. |
| What should change in the eval? | **The eval is closer to the wrong artifact than the skill is.** Concretely: (a) **quiz-001 and quiz-002 have no discriminating power on this model** and cost 12 runs to confirm — retire them or re-target them at content the model cannot verify in four web calls; (b) **the whole benchmark now rests on one expect line judged once**, and that judgment was wrong in one of three cases — either grade the discriminating property on several independent lines, or run the judge more than once per line and take the majority; (c) **fix judge blindness** — the quiz phrasing "showing how you got each value" invites `with_skill` runs to name the skill in the graded evidence, which 4 of 9 did; (d) **the goal task should ship a minimal `package.json`** (or the runner should isolate workspaces outside the repo), since a bare workspace lets `npm install` rewrite the eval framework's own manifest; (e) the ten-all-must-pass structure worked but hid the signal — nine of ten lines were passed by both variants, so the aggregate says "the skill barely helps" when the accurate statement is "the skill helps on exactly one thing, reliably". |
