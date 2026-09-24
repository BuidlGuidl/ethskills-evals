# major-refine: `concepts` on Opus 5 medium

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `claude` · `claude-opus-5` · effort `medium` |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | **true** on all 27 runs: the judge and the executor are the same agent |
| Runs | 3 per arm per task, 3 tasks × 3 arms = **27 graded runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 `retracted`. **1 dead run discarded and re-run**, see below |
| Trigger | not forced. Every one of the 18 with-skill runs called `Skill concepts`; on goal-001 it was the 1st or 2nd tool call |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `concepts` skill, 230 lines |
| new | `with_skill` | `d9952522` | refined minimal skill, 42 lines |

Both `skill_version` commits are ancestors of HEAD. The `expect_sha` values are uniform within each task across all nine runs: quiz-001 `0cdb45b70207`, quiz-002 `58b7c1070e2f`, goal-001 `03476b407c87`.

**Tasks.** These are all three live tasks whose `skill:` is `skills/concepts`: `concepts-quiz-001` (raffle randomness), `concepts-quiz-002` (harvest fee vs caller gas) and `concepts-goal-001` (onchain subscription billing build). All three run in bare workspaces with no template. goal-001's own `runs: 5` is overridden to 3 by the benchmark.

### Discarded run

`concepts-goal-001/2026-09-23T151809Z-claude-no-skill-1` hit the Claude subscription session limit after 986s ($4.88): "You've hit your session limit · resets 5pm (UTC)". It exited 1, having just written NOTES.md. This is a harness failure, not a result. Per AGENTS.md, the run dir and its workspace were deleted, and it was set up again after the reset as `2026-09-23T170233Z-claude-no-skill-1`. No other run failed.

## Headline: pass counts, new · old · none

| Task | new · old · none | What separates the arms |
| --- | --- | --- |
| `concepts-quiz-001` | `3/3 · 3/3 · 3/3` | saturated |
| `concepts-quiz-002` | `3/3 · 3/3 · 3/3` | saturated |
| `concepts-goal-001` | `3/3 · 1/3 · 0/3` | expect_7 (forkability split) and expect_6 (what the chain publishes) |
| **total** | **`9/9 · 7/9 · 6/9`** | |

**The refine earns its place on goal-001, the one task that separates anything.** The new text is the only arm to clear goal-001, at 3/3. The old text fixes the privacy line but not the forkability line. Both quizzes are at ceiling in every arm, so they measure nothing this benchmark can use.

### `concepts-goal-001`: per expect

| Expect | grades | new | old | none |
| --- | --- | --- | --- | --- |
| 1 | stack wired | 3/3 | 3/3 | 3/3 |
| 2 | nothing operator-only | 3/3 | 3/3 | 3/3 |
| 3 | who pays the recurring tx | 3/3 | 3/3 | 3/3 |
| 4 | exit without the operator | 3/3 | 3/3 | 3/3 |
| 5 | operator powers named | 3/3 | 3/3 | 3/3 |
| 6 | what the chain publishes | 3/3 | 3/3 | **1/3** |
| 7 | forkability: contracts vs the API | 3/3 | **1/3** | **0/3** |

- **expect_7 is the result.** It separates new 3/3, old 1/3 and none 0/3.
  - All three new runs write a "Could someone else run it?" passage. Each one splits the stack and names the weather API, the RPC and the sign-in/gate as the half only the provider runs. new-1: "Half of it… makes the code readable, not the service reproducible. What only you run: the weather API itself, the RPC connection, the API-key store, and the sign-in flow."
  - The two failing old runs stop at contract verification and fund recovery. old-2 writes "Verify the contract on Basescan…" and "every customer can still cancel and withdraw". old-3 writes "Every customer can call `cancelAndWithdrawAll()`". That is the #78 failure, reproduced on the text #78 ran.
  - None of the no-skill runs mentions the service side at all.
- **expect_6.** no-skill-1 and no-skill-3 never say that the subscriber ledger is public, in NOTES.md or README. Both skill arms close this at 3/3, so on this line the old text was already enough.
- **expects 1–5 pass 9/9.** This is the same as #78: every run chose Foundry and per-second read-time accrual with a permissionless `settle`/`collect`. The skill's "nothing runs itself" prior did not reproduce without the skill on Opus 5.
- **Operator powers differ by arm, though no expect line grades the difference.**
  - All three no-skill runs shipped a pause switch that blocks deposits and sign-ups but not exits: OZ `Pausable`, a custom `paused` flag, or `signupsPaused`. All three name it in NOTES.md.
  - None of the six skill runs shipped a pause, proxy or blacklist, and each one's NOTES.md says so.
  - This is the first time expect_5 has been exercised non-trivially. Its task notes say the line had only ever passed "the trivial way".
- **Judge sanity.** Every fail was checked against NOTES.md and README by searching for public, privacy, competitor, visible, fork, weather, walk away and verify. All seven fails hold up.
  - One pass looks lenient. On no-skill-1 and no-skill-3, expect_5 asks what becomes of customers "if that key is lost or the operator walks away". Neither NOTES.md addresses key loss directly; they say only that the owner cannot block exits. It did not change a verdict, because both runs fail on 6 and 7 anyway. Raised for #119 rather than touched.
- **Evidence completeness.** No run wrote source under `lib/`, `dist/`, `build/` or `out/`. The snapshot holds every file the transcripts show being written.

### `concepts-quiz-001`: saturated, with visible differences in the answers

- **Mechanism.** Eight of nine runs chose commit-reveal plus the blockhash of a pinned future block, read through the 256-block opcode. none-2 chose `block.prevrandao` of a contract-pinned future block, rejected commit-reveal as grindable, and stated the proposer caveat. It was the dearest run of the task ($0.89, 303s).
- **EIP-2935.** Only the new arm mentions the 8191-block history contract (new-2 and new-3), which comes from the new text. Both still build on the 256-block opcode.
- **Stake behind the reveal.**
  - new: 3/3, 0.01 ETH per entrant. new-2 still keeps non-revealers eligible.
  - old: 2/3.
  - none: 1/3, and that one bonds three "sealers" rather than the entrants. none-2 and none-3 argue that a stake is unnecessary.
- **All pass expect_5 regardless.**

### `concepts-quiz-002`: saturated. All nine runs priced gas from memory.

- Every run raised the caller's incentive before any arithmetic, put fee against gas in dollars, and recommended an L2 first. new-2 and new-3 frame the analysis as the new text's three questions.
- **No run in any arm checked a live price.** Every run assumed 1–60 gwei and ETH at $3,000–4,000.
  - At 19:36 UTC the same day, mainnet `eth_gasPrice` read **0.123 gwei** and ETH **$2,673**. At those prices a 250k-gas harvest costs ~$0.08 against a ~$0.0088/day fee, so break-even is **~9 days**.
  - The runs derived 13 months to 13 years. none-1 and new-1 wrote that a mainnet harvest never pays, which is wrong at the day's prices.
  - The verdict survives, which is why expect_2 passes: it grades the break-even at the prices the run itself states.
  - The new text says to use "the gas price and ETH price the target chain shows today". new-3 wrote "I couldn't check live gas or ETH price" without trying.
  - This is `concepts-gas-price-from-memory`: new 3/3, old 3/3, none 3/3.
- The task notes say that if this version "also comes back at ceiling on both variants, retire the task rather than rewrite it a third time". It has, on all three arms. Raised for #119.

## Cost

These figures come from `yarn run-stats --tasks concepts-quiz-001,concepts-quiz-002,concepts-goal-001 --benchmark major-refine-d9952522`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. Values are medians, with the cost range beside them; `cost_source: executor`. The discarded session-limit run is not included.

| Task | Arm | n | turns | duration | cost | cost range | tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `concepts-quiz-001` | new | 3 | 5 | 163s | $0.53 | $0.42–$0.54 | 94526 |
| | old | 3 | 4 | 177s | $0.57 | $0.40–$0.58 | 85637 |
| | none | 3 | 4 | 145s | $0.46 | $0.46–$0.89 | 98345 |
| `concepts-quiz-002` | new | 3 | 6 | 125s | $0.45 | $0.42–$0.48 | 111526 |
| | old | 3 | 6 | 144s | $0.48 | $0.47–$0.54 | 105679 |
| | none | 3 | 4 | 147s | $0.47 | $0.37–$0.58 | 94311 |
| `concepts-goal-001` | new | 3 | 35 | 957s | $2.98 | $2.91–$3.08 | 1884887 |
| | old | 3 | 23 | 629s | $2.36 | $1.99–$3.65 | 1104412 |
| | none | 3 | 47 | 1283s | $4.52 | $3.78–$5.30 | 3280200 |

- **On goal-001, both skill arms are much cheaper than none.** new costs about two-thirds of none ($2.98 vs $4.52, 1.88M vs 3.28M tokens). The ranges do not overlap: new's dearest run ($3.08) is below none's cheapest ($3.78). The no-skill runs take 41–55 tool calls against 21–36 for the skill runs.
- **new costs more than old on goal-001** ($2.98 vs $2.36, 957s vs 629s). That buys the "what the design gives up" section, which is where expect_7 is won.
- **On the quizzes the three arms are within cents of each other**, and the ranges overlap.

## Records

- **Re-measured, still fixed: `concepts-forkability-stops-at-verified-contracts`** (goal-001 expect_7). It fails none 3/3, old 2/3 and new 0/3. The old arm is the control for the fix.
- **Re-measured, left open: `concepts-subscriber-privacy-unstated`** (expect_6). It fails none 2/3, old 0/3 and new 0/3.
  - Pooled no_skill on this input is now 3/6, against 0/14 for with_skill on opus-5 across #78, #88 and this benchmark.
  - Both skill texts close it, so the refine is not what fixes this one.
  - It stays open only because every measurement is on one model; close it if the other #119 stacks agree.
- **Re-measured, open: `concepts-gas-price-from-memory`.** It reproduces 9/9 across all arms on quiz-002, and no goal-001 run looked up a price either. The refined wording did not move it.
- **Not filed:** the no-skill pause switches on goal-001. No expect line fails them, and every run named them.

All 27 `output/` snapshots are force-added (quiz answers 16–24K; goal-001 trees 148–240K, no dependencies), so every run stays regradeable.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none: `9/9 vs 6/9`, all of it on goal-001 (`3/3 vs 0/3`). new vs old: `9/9 vs 7/9` (goal-001 `3/3 vs 1/3`, entirely expect_7). old vs none: `7/9 vs 6/9`. Both quizzes are 3/3 in every arm. |
| Did it reduce time/tokens? | On goal-001, yes against none: new $2.98 / 957s / 1.88M tokens vs none $4.52 / 1283s / 3.28M. Against old, no: new costs more than old ($2.36 / 629s / 1.10M), spent on the end-of-build CROPS section. On the quizzes, flat within cents. |
| Did it create negative deltas? | No negative pass delta in any arm. new costs more than old on goal-001. |
| What mistakes repeated without the skill? | `concepts-forkability-stops-at-verified-contracts` (3/3), `concepts-subscriber-privacy-unstated` (2/3), `concepts-gas-price-from-memory` (3/3) |
| What mistakes remained with the skill? | old: `concepts-forkability-stops-at-verified-contracts` 2/3 and `concepts-gas-price-from-memory` 3/3. new: `concepts-gas-price-from-memory` 3/3, which no expect line grades. |
| What should change in the skill? | Only the live-price instruction, and only if it is meant to be followed. "At the gas price and ETH price the target chain shows today" is in the text and is followed 0/3. Something like "read them with one RPC call and one price lookup before writing any dollar figure" is the obvious try. Nothing graded requires it, so this is optional on this evidence. |
| What should change in the eval? | (1) Retire quiz-002: it is at ceiling in all three arms, which its own notes set as the retire condition. (2) quiz-001 is also at ceiling in all arms; EIP-2935 and the entrant stake show up only in its answers, not its grades. (3) quiz-002 expect_2 grades the break-even at the prices the run states, so a run that is off by ~50× on gas passes. If live pricing matters, expect_1 needs a clause for it. (4) goal-001 expect_5 passed two no-skill runs that never say what happens if the owner key is lost, which the line asks for. |
