# major-refine: noir (Opus 5 medium)

| | |
| --- | --- |
| Benchmark id | `major-refine-d9952522` |
| Stack | executor `claude` / `claude-opus-5` / effort `medium` |
| Judge | `claude` / `claude-opus-5` / effort `high` |
| `self_judged` | **true** on every run — judge and executor are the same agent. A caveat on the numbers, not a defect in them. |
| Runs | 3 per arm per task, 3 arms, 4 tasks = 36 runs |
| Arms | **none** = `no_skill`; **old** = `with_skill` @ `2f0adb01` (first vendored noir, 644 lines); **new** = `with_skill` @ `d9952522` (50-line minimal rewrite) |
| Tasks | `noir-quiz-001`, `noir-quiz-002`, `noir-quiz-003`, `noir-goal-001` — every live task whose `skill:` is `skills/noir` |
| Trigger | not forced; these are content-only numbers |
| Harness | every run `executor_exit: 0`, no `harness_failure`, no retractions, no regrades |

**Toolchain** (`noir-goal-001` pre-flight, this machine, 2026-09-21):
`nargo 1.0.0-rc.2` · `bb 5.2.0` · `forge 1.5.1-stable` · `node v25.9.0`.
Verified end-to-end before the first counted run: `nargo compile` → `nargo execute` → `bb write_vk` → `bb prove` → `bb verify` → *Proof verified successfully*, plus `bb write_vk --verifier_target evm` → `bb write_solidity_verifier` producing a 103 KB `Verifier.sol` — under the 256 KB cap at which `verify.ts` drops a file from `output/`, so the notes' concern about the verifier vanishing from the judge's evidence does not apply here.

Two deviations from the task notes' pinned install, both forced and both recorded rather than worked around: nargo is `1.0.0-rc.2`, above the notes' `beta.4` floor and past the authored `beta.3`; and `bb` had to be pinned explicitly at `5.2.0` because bare `bbup` failed — see `noir-bbup-bare-invocation`.

**17 runs were re-run.** The first pass hit a session usage limit mid-benchmark; 17 executors returned exit 1, 0 tokens, `You've hit your session limit`, having done no work. Per AGENTS.md those are dead runs: their run dirs were deleted, their workspaces swept, and they were set up and executed again from scratch after the limit reset. No grade in this report comes from a limit-killed run, and nothing was graded over a refusal.

## Headline

Pass counts, **new · old · none**:

| Task | new | old | none |
| --- | --- | --- | --- |
| noir-quiz-001 (build.sh toolchain pipeline) | 3/3 | 3/3 | 3/3 |
| noir-quiz-002 (sealed-bid range circuit) | **3/3** | **3/3** | 0/3 |
| noir-quiz-003 (privacy review, msg.sender) | 3/3 | 3/3 | 3/3 |
| noir-goal-001 (anonymous DAO voting build) | 3/3 | 3/3 | 3/3 |
| **Total** | **12/12** | **12/12** | 9/12 |

**The two skill arms are indistinguishable on pass rate: 12/12 each, identical on every expect line of every run.** Cutting the skill from 644 lines to 50 cost nothing measurable on its own task set.

### The one place the arms separate, and what it is really measuring

All three `no_skill` failures are `noir-quiz-002` **expect_1 alone** — every other line of that task, including expect_2 (hash *family*), passes 3/3 in all arms. And the task's own notes name this case:

> Known edge: Poseidon2 / pedersen_hash fail expect_1 by skill-conformance, not correctness — the scenario is greenfield, with no existing tree, contract, or frontend to match. Report a run failing only there as that, not as a wrong answer.

That is exactly what happened. All three unaided runs pulled in the correct external `noir-lang/poseidon` dependency at the correct tag and hashed with an algebraic hash — they wrote `use poseidon::poseidon2::Poseidon2` where expect_1 requires `use poseidon::poseidon::bn254::...`. **So the 3/12 headline gap is skill-conformance on which algebraic hash, not a model getting the hash wrong**, and the honest reading of this benchmark is that no task in the set separates the skill from no skill on correctness.

The other three tasks are saturated at 9/9, `noir-goal-001` included — all seven of its expect lines pass unaided, three times over.

### Ungraded axes the task notes ask to record

- **In-circuit hash on `noir-goal-001` (report-only).** All nine runs, every arm, import `poseidon::poseidon::bn254::`. No keccak256, no hand-rolled SHA-256. That is a reversal of the 2026-08 reading, where unaided runs wrote a bit-oriented hash 2/3 with a confident rationale; both `noir-keccak-in-circuit-hash` and `noir-bit-oriented-hash-in-circuit` are re-measured at no_skill 0/3 here. Note the within-model split: on the build task the unaided runs reach for `poseidon::bn254`, on quiz-002 the same model reaches for `Poseidon2` — same day, same stack, different algebraic hash per task.
- **Did the circuits actually compile?** Mostly not attempted. Only 3 of 9 `noir-goal-001` runs ran `nargo compile` at all (no_skill-1 four times, no_skill-3 once with `nargo execute`, old-1 a single `nargo check`); the other six wrote circuits they never built. `forge build` was run and reported successful in all nine. The judge reads code and cannot execute, so this is context for the 9/9, not a challenge to it.
- **The poseidon pin, old arm.** On quiz-002 all three `2f0adb01` runs reach for the skill's `tag = "v0.2.6"`, and this time only run 1 self-corrected: **runs 2 and 3 shipped `v0.2.6` in `Nargo.toml`**, a pin that does not compile on current nargo, having never compiled the circuit. All three `d9952522` runs ship `v0.3.0` and never mention `v0.2.6`. Invisible in the pass counts, because expect_1 says "exact tag may vary".
- **`[u1;` in transcripts on goal-001**: old arm 2/3, new arm 0/3, none n/a.
- **MCP turns.** No run in any arm spent turns on `claude mcp add noir-mcp` or `/reload-plugins`.

## Cost

All figures from `yarn run-stats --tasks … --benchmark major-refine-d9952522`, split per arm. Medians with ranges; `cost_source: executor` throughout.

| Task | arm | turns | duration | cost (median) | cost range | total_tokens |
| --- | --- | --- | --- | --- | --- | --- |
| noir-quiz-001 | new | 5 | 43s | **$0.26** | $0.25–$0.27 | 82,490 |
| | old | 5 | 42s | $0.36 | $0.34–$0.37 | 110,958 |
| | none | 5 | 65s | $0.33 | $0.28–$0.36 | 102,748 |
| noir-quiz-002 | new | 11 | 67s | **$0.40** | $0.40–$0.42 | 202,859 |
| | old | 9 | 74s | $0.58 | $0.53–$0.59 | 224,130 |
| | none | 12 | 80s | $0.46 | $0.42–$0.55 | 253,292 |
| noir-quiz-003 | new | 6 | 61s | **$0.31** | $0.31–$0.32 | 82,977 |
| | old | 6 | 68s | $0.44 | $0.28–$0.49 | 113,905 |
| | none | 4 | 64s | $0.29 | $0.28–$0.29 | 76,691 |
| noir-goal-001 | new | 31 | **466s** | **$2.22** | $2.19–$2.55 | 1,272,562 |
| | old | 53 | 1071s | $4.28 | $3.78–$4.79 | 3,619,065 |
| | none | 39 | 667s | $3.12 | $2.69–$3.39 | 2,070,329 |

**This is where the rewrite shows up.** On `noir-goal-001` the new arm runs in **44% of the old arm's wall clock** (466s vs 1071s), for **52% of the cost** ($2.22 vs $4.28) on **35% of the tokens** (1.27M vs 3.62M) — and the cost ranges do not overlap ($2.19–$2.55 against $3.78–$4.79), so at n=3 this is outside the noise. It also beats `no_skill` on all three ($2.22 vs $3.12, 466s vs 667s, 1.27M vs 2.07M): the 50-line skill pays for its own context and then some, on a task where the 644-line one cost more than working unaided.

The same ordering holds on three of four quizzes, at smaller absolute stakes. The one exception is `noir-quiz-003`, where `no_skill` is marginally cheapest ($0.29 vs $0.31) — a two-cent gap on a task all three arms pass 3/3, and the old arm's $0.28–$0.49 range straddles both.

## Mistakes

No new mistake records. The unaided Poseidon2 choice is deliberately **not** filed as one: the task notes classify it as skill-conformance rather than a wrong answer, and filing it would record a model failure that did not happen.

Re-measured and **closed** by the rewrite, all three stale facts of the 644-line text:

| id | old | new | closed by |
| --- | --- | --- | --- |
| `noir-poseidon-tag-v026-uncompilable` | 3/3 (2/3 shipped broken) | 0/3 | the rewrite pins `v0.3.0` |
| `noir-u1-merkle-indices-stale` | 2/3 | 0/3 | "Merkle path indices are `[bool; DEPTH]`" |
| `noir-bbup-bare-invocation` | n/a (ungraded) | n/a | "bare `bbup` … lags nargo and 404s" — reconfirmed first-hand in this pre-flight |

Re-measured and left **open**: `noir-keccak-in-circuit-hash` and `noir-bit-oriented-hash-in-circuit`, both now no_skill 0/3 on goal-001. The prior they were opened against has moved on this task; one stack is thin evidence for that, and quiz-002 shows the unaided choice is still unstable, so neither is closed.

Not exercised by any run in this benchmark: `noir-merkle-path-no-event-replay`, `noir-tree-mirror-from-view-call`, `noir-proving-via-bb-cli-not-noirjs` (expects 4 and 7 of goal-001 pass 9/9, so no run made these mistakes in any arm).

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **new vs none: 12/12 vs 9/12** — but every one of those three failures is quiz-002 expect_1, which the task's own notes classify as skill-conformance (Poseidon2 vs Poseidon) rather than a wrong answer. On correctness, no task in this set separates the arms. **new vs old: 12/12 vs 12/12**, identical on every expect line of every run. |
| Did it reduce time/tokens? | **Yes, decisively, new vs old.** `noir-goal-001`: `466s / 1.27M tokens / $2.22` (new) against `1071s / 3.62M / $4.28` (old) and `667s / 2.07M / $3.12` (none) — non-overlapping cost ranges. New is cheapest on three of four quizzes too. The 594 lines the rewrite cut were pure cost. |
| Did it create negative deltas? | Not for the new text — it is ≥ both arms on every expect line and cheaper almost everywhere. The **old** text did: on quiz-002 it drove all three runs to its stale `v0.2.6` poseidon pin and **2/3 shipped it**, a `Nargo.toml` that does not compile, while no unaided run ever wrote it. It also cost more than `no_skill` on goal-001 ($4.28 vs $3.12) for the same 3/3. |
| What mistakes repeated without the skill? | None that a task graded. On the ungraded axes, unaided runs are now clean: 0/3 on both in-circuit-hash records, where 2026-08 read 2/3. |
| What mistakes remained with the skill? | With the **new** skill: none. With the **old**: `noir-poseidon-tag-v026-uncompilable` (3/3, 2/3 shipped) and `noir-u1-merkle-indices-stale` (2/3). |
| What should change in the skill? | Nothing this benchmark can justify. The rewrite matches the old text's pass rate at half its cost and closes all three of its stale facts. One line is worth a look for a *later* pass, not a change now: the skill hard-codes `use poseidon::poseidon::bn254::hash_2` while the model unaided reaches for `Poseidon2` on greenfield work — if a future eval finds Poseidon2 is the better greenfield default, the skill's line becomes the thing to revisit, not the runs. |
| What should change in the eval? | Four things, in order of how much they cost a reader. **(1) `noir-quiz-002` expect_1 is the benchmark's only separating line, and it separates on conformance rather than correctness.** As written it grades one import path, so an unaided run that picks the right library, the right tag and the right hash family still fails it. Either split it (an algebraic-hash-from-the-external-dep line that Poseidon2 passes, plus a cross-layer-consistency line) or state in the expect that Poseidon2 is a fail *by convention*, so no reader mistakes the 3/12 gap for a model error. **(2) Three of four tasks are saturated at 9/9 on this stack** — goal-001 passes all seven lines unaided, three times — so they measure nothing here and should be hardened or retired before the next model. **(3) Nothing grades the poseidon pin's validity.** Two old-arm runs shipped a `Nargo.toml` that does not compile and passed expect_1 anyway, because it says "exact tag may vary"; the clearest defect the old skill caused is invisible to every pass count. A line requiring the circuit to compile, or the pin to be one that does, would catch it. **(4) `result.yaml` stores no judge rationale**, so every boundary call here had to be reconstructed by reading deliverables against expect lines. |
