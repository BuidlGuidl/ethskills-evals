# concepts — major-refine, Kimi K3 high

Benchmark id: `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)).
Benchmark commit `d9952522`.

| | |
| --- | --- |
| Executor | opencode, `openrouter/moonshotai/kimi-k3`, effort `high` (models catalog `9eb2ba682cd6` on every run) |
| Judge | claude, `claude-opus-5`, effort `high` |
| Runs | 3 per arm per task, 27 graded runs |
| Arms | none (`no_skill`) · old (`with_skill`, skill_version `2f0adb01`) · new (`with_skill`, skill_version `d9952522`) |
| `self_judged` | **false** on every run — the judge is claude, the executor opencode. |

Tasks: `concepts-quiz-001`, `concepts-quiz-002`, `concepts-goal-001` (every live task whose `skill:` is `skills/concepts`).
`concepts-goal-001` carries `runs: 5` in its spec; the benchmark pins 3, so it ran 3 per arm.
No trigger was forced; these are unprompted-trigger numbers. Every one of the 18 with_skill runs
called opencode's `skill` tool for `concepts` as its first or second action.

OpenRouter routes `kimi-k3` per request across providers, and the harness does not pin one, so
"same model" across these 27 runs means the same name, not provably the same weights (AGENTS.md,
"The three roles"). The arms were interleaved per round, so routing drift lands on all three arms.

## Headline — pass counts, new · old · none

| Task | new `d9952522` | old `2f0adb01` | none |
| --- | --- | --- | --- |
| concepts-quiz-001 | 3/3 | 2/3 | 2/3 |
| concepts-quiz-002 | 1/3 | 0/3 | 1/3 |
| concepts-goal-001 | **3/3** | 1/3 | **0/3** |
| **all** | **7/9** | **3/9** | **3/9** |

The separation is on the goal task. It is concentrated on the two CROPS lines that no_skill never writes
unprompted: expect_6 (what the chain publishes) and expect_7 (which half of the stack survives the
operator). On expect_7 the new text does what the old one does not. The two quizzes are within one
run of each other on every arm. quiz-002 fails on the same line on every arm: the caller's gas is
priced with no gas price or ETH price behind it.

### Per check

`expect_sha` and `input_sha` are uniform across the nine runs of each task (quiz-001 `0cdb45b70207`
/ `451f5f2abd7e`, quiz-002 `03476b407c87` / `15764d01cb78`, goal-001 `58b7c1070e2f` / `1c605c33d4b9`).
Each task's arms were graded against one rubric on one prompt. No expect line was touched.

| Task | expect | new | old | none |
| --- | --- | --- | --- | --- |
| quiz-001 | e1 source | 3/3 | 3/3 | 3/3 |
| quiz-001 | e2 lookback + commitment binding | 3/3 | 2/3 | 2/3 |
| quiz-001 | e3–e6 | 3/3 each | 3/3 each | 3/3 each |
| quiz-002 | e1 fee vs gas, as figures | 1/3 | 0/3 | 1/3 |
| quiz-002 | e2–e4 | 3/3 each | 3/3 each | 3/3 each |
| goal-001 | e1–e4 | 3/3 each | 3/3 each | 3/3 each |
| goal-001 | e5 operator powers named | 3/3 | 3/3 | 2/3 |
| goal-001 | e6 what is public | 3/3 | 3/3 | **0/3** |
| goal-001 | e7 what survives the operator | 3/3 | 1/3 | **0/3** |

| Task | run | arm | expects | pass |
| --- | --- | --- | --- | --- |
| quiz-001 | 135956Z-1 | old | ✔ ✘ ✔ ✔ ✔ ✔ | fail |
| quiz-001 | 141617Z-3 | none | ✔ ✘ ✔ ✔ ✔ ✔ | fail |
| quiz-002 | 143249Z-1 | none | ✘ ✔ ✔ ✔ | fail |
| quiz-002 | 143735Z-2 | none | ✘ ✔ ✔ ✔ | fail |
| quiz-002 | 143440Z-1 | old | ✘ ✔ ✔ ✔ | fail |
| quiz-002 | 143940Z-2 | old | ✘ ✔ ✔ ✔ | fail |
| quiz-002 | 144505Z-3 | old | ✘ ✔ ✔ ✔ | fail |
| quiz-002 | 143612Z-1 | new | ✘ ✔ ✔ ✔ | fail |
| quiz-002 | 144700Z-3 | new | ✘ ✔ ✔ ✔ | fail |
| goal-001 | 144857Z-1 | none | ✔ ✔ ✔ ✔ ✘ ✘ ✘ | fail |
| goal-001 | 151915Z-2 | none | ✔ ✔ ✔ ✔ ✔ ✘ ✘ | fail |
| goal-001 | 171608Z-3 | none | ✔ ✔ ✔ ✔ ✔ ✘ ✘ | fail |
| goal-001 | 145235Z-1 | old | ✔ ✔ ✔ ✔ ✔ ✔ ✘ | fail |
| goal-001 | 172258Z-3 | old | ✔ ✔ ✔ ✔ ✔ ✔ ✘ | fail |

Every other run passed every line.

**goal-001 expect_6 and expect_7, none 0/3.** No no_skill NOTES.md says anything about public
visibility. Grepping them for public, privacy, competitor or visible finds only `PRIVATE_KEY` and `publicClient`. None says what survives
the operator; the only "verify" in them is the `--verify` flag on the deploy command. This is
[`concepts-subscriber-privacy-unstated-kimi-k3-high`](../mistakes/concepts/concepts-subscriber-privacy-unstated-kimi-k3-high.yaml)
and [`concepts-forkability-stops-at-verified-contracts-kimi-k3-high`](../mistakes/concepts/concepts-forkability-stops-at-verified-contracts-kimi-k3-high.yaml).
Both skill texts fix expect_6. Only the new one fixes expect_7. All three new-text runs wrote a "What this design gives up"
section: "What does not survive you is the weather API itself: the data, the endpoints, and the backend
check are yours alone" (new-3); "the money layer survives you, the service layer doesn't" (new-2). The
old text's closest miss is old-1: "this is a *service* with an operator (you), not an unstoppable
protocol", with no split between the contracts and the API.

**quiz-002 expect_1, 7/9 fail across all arms.** All nine runs reach the right verdict: the 1% fee is far below
gas, so harvest rarely or never gets called. Seven price the caller's side as a bare dollar band ("~$5–$40", "~$1–$10
depending on gas price and ETH price") with no gas price or ETH price, and three of those give no per-call gas
figure either. Eight of the nine priced gas from memory; the bands imply 5–60 gwei on a day mainnet was at
0.067 gwei. The only arm-independent pass (none-3) states a stale "~5 gwei, ~$3,500 ETH". The one run that
searched (new-2) found 0.067 gwei and $2,475.84 on Etherscan and wrote "~0.5 gwei, ETH ~$2,500". The new
text's third question asks for exactly these inputs ("at the gas price and ETH price the target chain shows today")
and did not get them 2 times in 3. Filed as
[`concepts-harvest-incentive-unpriced-kimi-k3-high`](../mistakes/concepts/concepts-harvest-incentive-unpriced-kimi-k3-high.yaml).

**quiz-001 expect_2, one fail each on none and old.** none-3 reads `blockhash(drawBlock)`, the opcode,
but sizes its window against "8191 blocks ≈ 27 h"
([`concepts-blockhash-lookback-misstated-kimi-k3-high`](../mistakes/concepts/concepts-blockhash-lookback-misstated-kimi-k3-high.yaml)).
old-1 commits the bare secret, "`enter(keccak256(secret))`", with no salt and no address
([`concepts-bare-secret-commitment-kimi-k3-high`](../mistakes/concepts/concepts-bare-secret-commitment-kimi-k3-high.yaml)).

**goal-001 expect_5, none 2/3.** none-1 ships an owner who can reprice and retire plans for existing
subscribers. NOTES.md states the effect but not what becomes of customers if the key is lost or the operator walks away
([`concepts-operator-powers-unnamed-kimi-k3-high`](../mistakes/concepts/concepts-operator-powers-unnamed-kimi-k3-high.yaml)).
It is the first time this line has been exercised the way its notes say it was written for (see the grading questions below).

## Grades a reader should know about (rubric questions for #119)

No expect line was edited and no run was regraded. The pass counts above are the judge's grades as
written. These four look inconsistent or lenient on re-reading the evidence:

1. **quiz-001 expect_2, old-3 passed with the same bare commitment old-1 failed on.** old-3: "submits
   `keccak256(secret)` as their commitment". The rubric supports the fail ("the commitment binding a salt or
   the sender's address rather than the bare secret"). A strict reading puts old at 1/3 on quiz-001 and 2/9
   overall. The clause sits inside the lookback line. A line of its own would grade it more reliably.
2. **goal-001 expect_5, none-3 passed while none-1 failed.** none-3's `setPlan(planId, price, period, active)`
   applies to existing subscribers. Its NOTES.md ("A price change applies to existing subscribers at their next
   charge. There is no grandfathering… Owner key = the money key") says no more about key loss than none-1's.
   old-3 is lenient in the same way. Its price is read live in `_owed` and `settleMany` is permissionless, so an owner
   can reprice and settle everyone in one block. Its NOTES.md says "they can always cancel and get refunded".
   None of these three changes a pass count: none-3 fails e6 and e7 anyway, and old-3 fails e7.
3. **goal-001 expect_7, old-2 passed on thin text.** "the plans, prices, and fee withdrawal are yours, and
   your API backend is obviously still yours… anyone can verify the same state with any node, so your backend
   is replaceable". It never says what a customer could still do, or what stops, if the provider walked
   away. A strict reading puts old at 0/3 on goal-001.
4. **goal-001 expect_2 does not catch a design that needs its cron.** none-3's NOTES.md says `isSubscribed` "is
   **accurate even if the keeper never runs**". But `isSubscribed` is `paidThrough >= block.timestamp` and
   `paidThrough` advances only in the permissionless `processPayment`. The run's own test
   `test_isSubscribed_accurateWithoutKeeper` asserts `false` for a funded subscriber one period in. none-1
   lets an unpoked, funded customer stay active uncharged, and NOTES.md calls that revenue "unrealized" when
   it is lost. Both pass expect_2 on "a call any address can make". Neither changes an aggregate (both fail e6/e7).

Read strictly on all four, the headline is new 7/9 · old 1/9 · none 3/9 overall and new 3/3 · old 0/3 · none 0/3 on the goal task.
That widens the new-vs-old gap and does not narrow any other.

## Cost — medians per arm, with ranges

From `yarn run-stats --tasks concepts-quiz-001,concepts-quiz-002,concepts-goal-001 --benchmark major-refine-d9952522`,
split by `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`.
`cost_source: executor` throughout: opencode's own arithmetic on models.dev list price, not
OpenRouter's bill, which is at the routed provider's rate.

| Task | arm | turns | duration | cost | cost range | total tokens |
| --- | --- | --- | --- | --- | --- | --- |
| concepts-quiz-001 | none | 4 | 138s | $0.10 | $0.10–$0.14 | 41,102 |
| concepts-quiz-001 | old | 3 | 125s | $0.15 | $0.14–$0.24 | 39,115 |
| concepts-quiz-001 | new | 4 | 89s | $0.11 | $0.10–$0.21 | 40,906 |
| concepts-quiz-002 | none | 4 | 84s | $0.09 | $0.08–$0.10 | 34,308 |
| concepts-quiz-002 | old | 3 | 85s | $0.09 | $0.08–$0.10 | 32,323 |
| concepts-quiz-002 | new | 4 | 95s | $0.09 | $0.06–$0.09 | 41,386 |
| concepts-goal-001 | none | 30 | 338s | $0.59 | $0.51–$0.93 | 622,361 |
| concepts-goal-001 | old | 26 | 417s | $0.56 | $0.43–$0.58 | 598,562 |
| concepts-goal-001 | new | 26 | 260s | $0.52 | $0.45–$0.68 | 487,996 |

No cost difference here is large enough to carry a headline, and the ranges overlap on every task. The skill adds no measurable cost.
On the goal task the new text is the cheapest arm by median tokens (488k against 599k old and 622k none) and gets 3/3 against 1/3 and 0/3.

## Observations the task notes ask for

**concepts-goal-001.** All nine runs used Foundry and targeted Base. The monthly charge:

- Read-time accrual in seven runs, with a permissionless settle or poke: none-2, and all six with_skill runs.
- A permissionless per-period poke in none-3 (`processPayment`).
- Lazy per-period renewal in none-1, with a permissionless `chargeBatch` whose revenue is lost when nobody pokes (see question 4).

No run shipped Pausable, a proxy or a blacklist. Four runs carry an owner price setter:

- none-1 and none-3 reprice existing subscribers.
- old-3 reads the price live.
- old-1's price is snapshotted per subscriber.

new-1 and new-2 ship constant prices and revenue withdrawal only, and new-3 can add or deactivate plans for new subscribers only. So expect_5 was
again mostly passed the trivial way on the skill arms. Evidence is complete in all nine: each was graded from
`output/`, no run wrote source under `lib/`, `dist/`, `build/` or `out/`, and no run made its own git repo. Spelling: "onchain"
throughout. none-1 is the only run with an "on-chain".

**concepts-quiz-001.** Every run chose commit-reveal. No run reached for VRF or prevrandao, so the treasury
constraint held on every arm. Where a blockhash was read, it was the opcode:

- Every with_skill run stated 256 blocks (~51 min) correctly.
- new-2 also stated EIP-2935's 8191 correctly.
- none-3 applied 8191 to the opcode.

A stake sat behind the reveal in 3/3 none, 1/3 old and 2/3 new. new-3 excludes non-revealers with no bond. It passes expect_5, although the new text says "Put a stake at
risk". "onchain" in every run.

**concepts-quiz-002.** The incentive was framed before any arithmetic in 7/9 runs (all six with_skill runs, and none-2).
Per-call gas was estimated in six runs, at 150k–600k, and absent in three. The gas price and ETH price came from memory in 8/9 runs;
new-2 searched. A break-even interval or threshold was derived in most runs, including several whose inputs were
unstated. Two runs (none-3, new-1) say no cadence is ever profitable, which their own numbers do not support. Few
answers use either spelling; one "onchain" in new-2.

**Feedback calls.** Neither skill text in this benchmark contains a feedback URL, and 0/18 with_skill
transcripts contact ethskills.com. Only one run in eighteen with_skill made a web request at all (quiz-002 new-2).

## Run incidents

**No run was discarded, retracted or graded over a refusal.** All 27 executors exited 0.
`--grade-failed-run` was never used and no `harness_failure` is recorded. Two orchestration interruptions
touched no record:

- **The driver loop died with its parent shell at ~14:52Z**, at the same moment two sibling orchestrators on this box
  lost theirs. The executor it had just launched (goal-001 old-1, `145235Z`) finished cleanly, exit 0, and
  was graded by hand with the same `yarn verify` command. The loop was then restarted detached (`setsid`),
  skipping graded runs.
- **The judge hit the claude usage limit at ~15:38Z** on goal-001 none-2 (`151915Z`): `verify: judge failed:
  judge exited non-zero`, verify exit 1, and no grade was written. The executor had finished cleanly and
  its workspace was intact. Once the limit reset at ~17:01Z the run was graded with the same command,
  never re-executed. As a result goal-001 round 2 ran its none arm about 1h40m before its old and new arms;
  every other round ran back to back.

## What should change

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none **7/9 vs 3/9**, all of it on goal-001 (3/3 vs 0/3); the quizzes are within one run. new vs old **7/9 vs 3/9**: goal-001 3/3 vs 1/3 on expect_7, quiz-001 3/3 vs 2/3, quiz-002 1/3 vs 0/3. |
| Did it reduce time/tokens? | Not measurably. goal-001 medians: new 260s / 488k tokens / $0.52, old 417s / 599k / $0.56, none 338s / 622k / $0.59, with overlapping ranges. Quizzes are $0.09–$0.15 on every arm. |
| Did it create negative deltas? | None on pass counts. On quiz-001 the new text has one run with no stake behind the reveal (new-3) where all three no_skill runs had one; it still passes. |
| What mistakes repeated without the skill? | `concepts-subscriber-privacy-unstated-kimi-k3-high` 3/3, `concepts-forkability-stops-at-verified-contracts-kimi-k3-high` 3/3, `concepts-harvest-incentive-unpriced-kimi-k3-high` 2/3, `concepts-operator-powers-unnamed-kimi-k3-high` 1/3 (2/3 by construction), `concepts-blockhash-lookback-misstated-kimi-k3-high` 1/3 |
| What mistakes remained with the skill? | New: `concepts-harvest-incentive-unpriced-kimi-k3-high` 2/3. Old: the same 3/3, `concepts-forkability-stops-at-verified-contracts-kimi-k3-high` 2/3, `concepts-bare-secret-commitment-kimi-k3-high` 2/3 by construction (1/3 graded) |
| What should change in the skill? | Only the "Is that enough?" line has a remaining gap on this stack. Kimi-k3 loads it and still writes a dollar band. Test a more imperative form: "read the gas price and ETH price before quoting dollars, and write both numbers down beside the gas figure". The CROPS section needs no change here, since e6 and e7 are 3/3 on the new text. |
| What should change in the eval? | quiz-001 expect_2 bundles the commitment-binding clause with the lookback limit, and the judge graded identical commitments both ways. Split it out. goal-001 expect_5 and expect_7 were graded unevenly on the first runs that actually exercised them (questions 2–3 above). quiz-002 expect_1 accepts any stated price, including a stale one from memory (none-3), so it grades whether a price is stated, not whether it was checked. goal-001 expect_2 passes a design whose NOTES.md misdescribes what happens with no keeper (question 4). Raise all four on #119. |
