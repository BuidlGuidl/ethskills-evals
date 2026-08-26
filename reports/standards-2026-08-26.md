# Eval report — minimal skill `standards` (claude stack)

**Skill:** `skills/standards` @ `f3ba42f` — the 51-line minimal rewrite of the 393-line vendored skill benchmarked in #35.
**Executor:** claude, `claude-opus-5` — fresh `claude -p` per run, pointed only at `TASK.md`.
**Judge:** claude, `claude-opus-5` — blind, fresh process per run (`--judge-agent claude --judge-model claude-opus-5`), sees only task input + evidence.
**Runs:** 3 per variant per task; 3 tasks × 2 variants × 3 = **18 executor runs**, all graded.
**Date:** 2026-08-26. Content-only variant, no trigger line prepended. Skill triggered 9/9.

> **`self_judged: true` on all 18 runs**, same as #35: one stack per AGENTS.md, codex is not installed here. Grading was still independent and blind — and this time no `with_skill` run leaked the variant into the evidence (see "Judge blindness", below).

## Headline

| Task | no_skill | with_skill | #35 (old skill) |
| --- | --- | --- | --- |
| standards-quiz-001 agent-commerce cluster, now 8 lines incl. the testnet address | **3/3** | **3/3** | 3/3 vs 3/3 |
| standards-quiz-002 EIP-7702 in-place EOA upgrade | **3/3** | **3/3** | 3/3 vs 3/3 |
| standards-goal-001 build the service side, now 11 lines | **2/3** | **3/3** | 2/3 vs 3/3 |

**17/18 runs pass, 137/138 expect-line judgments pass.** One `no_skill` goal run failed, on two lines, and not the ones anybody expected.

## The check that carried #35 no longer separates the variants

`goal-001`'s domain binding — the single line of 22 that discriminated in #35 — was rewritten here against the spec instead of the old skill's invented shape, and split in two (expect_10 the document, expect_11 the reasoning). **All six goal runs passed both lines**, `no_skill` included.

So the #35 headline rested substantially on an artifact of the expect line. The old line demanded an `owner` field that ERC-8004 does not define, and rejected the same-domain agentURI route the spec explicitly accepts. Graded against the standard, `no_skill` binds the domain fine. `standards-missing-domain-binding` did not reproduce (0/3) and stays open pending one more benchmark before closing.

The split did its job in the other direction too: no run passed one half and failed the other, so the two lines never disagreed — but a false pass on either can no longer carry a run, which was the point.

## The one failure

`goal-001` `no_skill-3` failed **expect_1** and **expect_4**: it named ERC-8004 correctly, designed the whole flow on the Identity and Reputation registries, and then **never produced their addresses** — `register.ts` reads `process.env.IDENTITY_REGISTRY`, `server.ts` defaults to a `0x…02` placeholder, and design.md says "take the address from the ERC-8004 canonical deployment list for chain 8453; deployed deterministically, **do not hardcode a guess**".

That is honest engineering and a knowledge gap at the same time: the service as delivered cannot be registered until a human supplies the value the skill carries in a table. Filed as `standards-registry-address-deferred-to-config`, with the eval-side ambiguity recorded — expect_1's negative list names wrong registries, not a parameterized address, so a judge reading it strictly could have passed this run.

## Cost — the finding that matters, and it is a regression

| variant | runs | avg $/run | avg wall-clock | avg turns | web calls (total) |
| --- | --- | --- | --- | --- | --- |
| no_skill | 9 | **$1.29** | 315s | 16 | 43 |
| with_skill | 9 | **$2.52** | 390s | 32 | 0 |

**The minimal skill costs 95% more per run than no skill at all**, and the whole of it comes from one task:

| task | no_skill | with_skill | #35 with_skill (old skill) |
| --- | --- | --- | --- |
| goal-001 | $2.56 / 650s / 26 turns | **$7.04 / 1061s / 89 turns** | $1.33 |
| quiz-001 | $1.00 / 205s / 26 web calls | **$0.26 / 57s / 0 web calls** | — |
| quiz-002 | $0.30 / 89s | **$0.25 / 51s** | — |

The task input for `goal-001` is byte-identical to #35's, so this is a controlled comparison: `no_skill` held steady ($2.44 → $2.56) while `with_skill` went **$1.33 → $7.04**. The cause is a line I added — "Do not write the integration from a remembered snippet … Read the installed types". All three `with_skill` runs obeyed it: `npm i @x402/core @x402/evm @x402/express @coinbase/x402`, then 33–82 shell commands inspecting the installed exports.

The quizzes kept the old saving: quiz-001 is **−74% cost, −72% time, 26 web calls → 0** for the identical 8/8 grade.

## What that spending bought (ungraded)

| | x402 integration in server.ts |
| --- | --- |
| no_skill 1–3 | hand-rolled 402/verify/settle on `node:http` + viem. Zero x402 packages. |
| with_skill 1–3 | real 2.x SDK: `paymentMiddleware` with `x402ResourceServer`, `registerExactEvmScheme`, `decodePaymentSignatureHeader`, one run wiring `facilitator` from `@coinbase/x402`. |

None of those symbols is in the skill — the runs got them by installing and reading, which is what the skill now tells them to do instead of copying a snippet. In #35, by contrast, all three `with_skill` runs read the skill's `@x402/express` example and **discarded it**, hand-rolling the flow; two said so in a header comment. The dead-snippet defect is fixed (`standards-skill-x402-example-api-nonexistent`), and the fix is what costs $4.50 a run.

expect_7 accepts either implementation, so none of this is graded. It is the ungraded read this benchmark exists to surface.

## Judge blindness held

Zero mentions of the skill, `.claude/skills`, or `SKILL.md` across all nine `with_skill` runs' graded evidence, against **4 of 9 in #35**. The rewritten quiz preambles ("show the derivation … do not quote or name the files, pages, or documents you consulted") fixed it without changing what the lines grade.

## The new testnet line did not discriminate

`quiz-001` expect_8 (Base Sepolia registers against `0x8004A818…`, not the mainnet address) was added precisely because the skill's old "same address everywhere" claim is false. All three `no_skill` runs got it — each fetched `github.com/erc-8004/erc-8004-contracts`, the same source the line was verified against. One more confirmation that this cluster is four web calls deep, not absent.

## Run incidents

**None.** #35's two operational faults were pre-empted: a barrier `package.json` in each run dir kept `npm install` from walking up into the eval repo's manifest (root `package.json`/`yarn.lock` md5-checked after every batch, unchanged), and executors ran with no harness cap, so no repeat of the four timeout kills. Six runs executed concurrently per batch with no interference. Total spend for the benchmark: **$34.24**.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Marginally, on one task: `2/3 vs 3/3` on goal-001, and for a different reason than in #35 — the registry addresses, not the domain binding. `3/3 vs 3/3` on both quizzes. |
| Did it reduce time/tokens? | **On the quizzes yes (−74% cost on quiz-001, 26 web calls → 0). On the goal task no — a 2.75× cost regression**, $2.56 → $7.04, 26 → 89 turns, caused by the new "read the installed types" instruction. Net across 18 runs the skill is 95% more expensive than no skill. |
| Did it create negative deltas? | Yes, the goal-task cost above. No graded regression: no `with_skill` run failed any line. |
| What mistakes repeated without the skill? | `standards-registry-address-deferred-to-config` (1/3). `standards-missing-domain-binding` did NOT reproduce (0/3) once graded against the spec. |
| What mistakes remained with the skill? | None. 33/33 expect lines pass across all nine `with_skill` runs. |
| What should change in the skill? | Scope the "read the installed types" instruction so it costs a confirmation, not an exploration — it fired on every build run and tripled the bill. Options: name the 2.x call shapes inline and ask for a one-command check (`npm view` / a single types read) instead of an open-ended inspection, or move the whole x402-package paragraph to the `tools` skill, which already owns it, and leave `standards` the constants and the domain binding. Test either as a v2 against this same goal task; the input is stable across two benchmarks now. |
| What should change in the eval? | (a) `goal-001` no longer has a discriminating line — the binding is at ceiling on both variants and the only failure was an address omission the expect lines grade ambiguously; tighten expect_1/expect_4 to say whether a parameterized address with a named canonical source passes, then decide whether this task still earns 6 runs. (b) Both quizzes are now at ceiling on both variants twice over (24 runs); retire them and keep the cost measurement, or re-target at something not reachable in four web calls. (c) Cost is doing the discriminating here — it belongs in the result schema rather than being mined out of transcripts by hand. |
