# skills/addresses — eval report

**Executor:** claude / `claude-opus-5`
**Judge:** claude / `claude-opus-5`, fresh blind process per run via `yarn verify`
**Runs:** 3 per variant per task, 6 tasks, **36 runs, all graded**
**Date:** 2026-08-12
**Skill version:** `326ad4b` (vendored at `skills/addresses`, upstream source @ `191dcc1`)

Every run records `judge.self_judged: true`. Executor and judge are the same agent and
model, which is what AGENTS.md's one-stack rule prescribes when only one harness is
available — `codex` is not installed on this machine. The judge still runs as a
separate, blind process that never sees the variant, the skill, or the transcript, and
grades only the evidence `verify` assembles. Read the flag as "same model family", not
"the executor graded itself".

Evidence note: all six tasks are bare-workspace, so `verify` snapshots deliverables to
`artifacts/<task>/<run>/output/`, which is gitignored by repo policy. The graded
artifacts are therefore quoted inline below, and each run's committed `transcript.md`
contains the file writes.

## Results

| task | no_skill | with_skill | failing checks |
| --- | --- | --- | --- |
| quiz-001 — Base swap venue + router address | **3/3** | **2/3** | expect_1 (Base-liquidity evidence) |
| quiz-002 — Uniswap v4 differs per chain | **3/3** | **3/3** | — |
| quiz-003 — vanity CREATE2 proves nothing cross-chain | **3/3** | **3/3** | — |
| quiz-004 — deprecated V1 VELO token | **3/3** | **3/3** | — |
| quiz-005 — per-chain Aave pools + native USDC | **3/3** | **2/3** | expect_4 (source attribution) |
| goal-001 — unprompted viem swap build | **2/3** | **3/3** | expect_6 (verify-before-funds) |
| **total** | **17/18** | **16/18** | |

Mean cost and effort per run:

| task | no_skill | with_skill |
| --- | --- | --- |
| quiz-001 | 501s / $1.43 | 280s / $0.78 |
| quiz-002 | 231s / $0.83 | 72s / $0.39 |
| quiz-003 | 269s / $1.00 | 226s / $1.07 |
| quiz-004 | 220s / $0.71 | 52s / $0.35 |
| quiz-005 | 126s / $0.57 | 62s / $0.40 |
| goal-001 | 481s / $1.88 | 803s / $2.66 |

Total notional token cost across 36 runs: $36.25.

## What actually happened

**The quiz half found no benefit and two regressions; the goal half found the benefit
the skill was written for.** Quizzes: `no_skill 15/15`, `with_skill 13/15`. goal-001:
`no_skill 2/3`, `with_skill 3/3`. Those point in opposite directions for a reason worth
stating carefully, because it is the whole result.

**`no_skill` did not guess — it measured.** Every unaided run reached for the chain:
`codesize` probes on candidate routers, `symbol()`/`name()` for token identity,
`defaultFactory()` and `voter()` to prove a router belongs to the protocol claimed,
quoter simulations pinned to one block, and official deployment lists
(`Uniswap/universal-router/deploy-addresses/base.json`, docs.uniswap.org,
velodrome-finance/contracts, docs.morpho.org) to confirm what it had already probed.
When a task asks a question, this model looks the answer up. The stale-prior model the
skill was written against does not appear to survive tool access.

**`with_skill` behaved identically across all five quizzes — consult, answer, stop — and
that one behaviour produced four different outcomes**, decided entirely by whether the
skill's claim was true:

- quiz-002 (v4 differs per chain — **true**): skill-only, 4 turns, 3/3, 3x faster.
- quiz-004 (V1 VELO deprecated — **true**): skill-only, 5 turns, 3/3, 4x faster.
- quiz-001 (Aerodrome leads Base by TVL ~$500-600M — **false**): skill-only, fail.
- quiz-005 (addresses right, attribution circular): skill-only, fail on sourcing.

A skill trusted this readily converts each of its own stale facts directly into a wrong
answer, and nothing in its presentation lets a reader tell the reliable rows from the
rotten ones.

**Verification tracked the prompt, not the skill.** quiz-003 asks for an address *and*
"say how you established it" — 6/6 runs verified, both variants. quiz-001 asked only for
a justified venue choice, which recall can fake, and that is where the skill-only run
failed.

### Where the skill earned its place: goal-001

goal-001 is the only task where nothing is asked and the discipline has to surface on
its own, and it is the only task with a positive delta. All three `with_skill` runs
carried an explicit verify-before-funds instruction to the developer; one `no_skill` run
did not, and failed expect_6.

Read the failure precisely, because it is narrower than "it skipped verification".
no_skill run 2 wrote a `verifyDeployments()` function that re-runs `factory()`,
`WETH9()`, `token0()/token1()` and `tickSpacing()` checks at runtime "before any funds
move". What it never did was tell the human to confirm the addresses against a block
explorer or the protocol's published deployment list — which is what expect_6 asks for,
and which catches a different class of error than runtime wiring checks (wrong protocol
entirely, or a deprecated-but-live deployment). The passing `with_skill` runs had a
dedicated "Before you run this with real funds" section with numbered steps.

So the delta is one run, on a defensible-but-strict reading of one expect. It is real
and it is in the direction the task predicted, and it should not be inflated beyond
that.

### Where the skill genuinely saved effort

quiz-004: all three `with_skill` runs diagnosed the deprecated-V1-VELO fault and
produced the current token in ~52s/$0.35 with zero lookups, against `no_skill` spending
~220s/$0.71 rediscovering it. Same answer, 4x faster, because L388 is accurate. Every
run in both variants correctly blamed the token address rather than the ABI, RPC,
decimals, or caching.

### The two quiz failures

**quiz-001 with_skill run 1** picked Aerodrome with the correct router address, then
justified it as *"dominant DEX on Base by TVL (~$500-600M)"* with no volume figure, pool
depth, quote, or route. Tool sequence: `ls` → `Skill` → `Write`. The magnitude was not
hallucinated — SKILL.md L357 reads "The largest DEX on Base by TVL (~$500-600M)". Pinned
ground truth: Aerodrome TVL ~$285M, **Uniswap ahead** at ~$305M; Aerodrome leads on 7d
routed volume (~$2.35B vs ~$1.59B), the metric that decides execution.

**quiz-005 with_skill run 3** produced all eight addresses correctly — including the Base
Aave pool `0xA238Dd80...` that breaks the one-protocol-one-address reflex — and
attributed every one to `"verified address reference"`, i.e. the skill it had just read.
Circular attribution fails expect_4. Good enough to get eight addresses right, confident
enough to wire them to a live `supply()` call without looking at a chain.

### The skill's own errors, caught by the runs

**Morpho on Arbitrum.** L462 says Morpho Blue is "NOT on Arbitrum as of February 2026".
It is, at `0x6c247b1F6182318877311737BaC0844bAa518F5e`. The predicted negative delta did
**not** appear: all three `with_skill` runs checked anyway and passed, and run 1 wrote
the correction into its answer — *"The internal address skill is stale on this exact
entry... last verified 2026-03-03, five months ago."* The table row is right; only the
prose generalizes "not at this address" into "not on this chain".

**Aerodrome Slipstream is absent from the file.** The Aerodrome section lists one
router, the v2-style vAMM `Router` `0xcF77a3Ba...`, and "Slipstream" appears nowhere in
25KB. goal-001 quoted every candidate at real clip size on live Base state:

| venue / pool | WETH out | slippage |
| --- | --- | --- |
| Aerodrome Slipstream, tickSpacing 100 | 263.91 | **-14 bps** |
| Uniswap v3, fee 3000 | 263.81 | -18 bps |
| **Aerodrome vAMM Router — the address the skill lists** | 234.23 | **-1,283 bps** |

Nothing about the address is wrong: `eth_getCode` passes, it is genuinely Aerodrome's,
the ✅ is honest. The entry answers "what is Aerodrome's address" when the question the
skill invites needs "which Aerodrome router, for this pair, at this size". Five of six
goal-001 runs routed via Slipstream regardless; they found it by quoting, not by reading.

### Unprompted observation from the executors

Two runs independently refused an instruction embedded in SKILL.md and said so without
being asked. The file ends by telling the agent to send feedback via
`https://ethskills.com/feedback/SKILL.md`; one declined on the grounds that fetching a
remote URL on a document's instruction rather than the user's is an exfiltration and
steering vector, and flagged it "so you know it's there". No expect covers this and no
run was graded on it. The authors should decide whether that line belongs in a document
agents are told to trust.

## Mistakes filed

| id | frequency (no_skill / with_skill) | what it is |
| --- | --- | --- |
| `addresses-base-dominance-metric` | 0/3 / 1/3 | L353+L357 assert Aerodrome leads Base by TVL; false, and the ~$500-600M figure was copied verbatim into a failing answer |
| `addresses-verified-stamp-substitutes-for-check` | 0/6 / 2/6 | L10's "Last Verified" stamp and per-row ✅ read as a completed check; runs shipped addresses to live-funds config with no lookup |
| `addresses-morpho-arbitrum-absent` | 0/3 / 0/3 | L462 says Morpho is not on Arbitrum; it is. Skill error, caught by every run |
| `addresses-aerodrome-slipstream-missing` | 0/3 / 0/3 | Slipstream absent from the file; the listed Aerodrome router costs -1,283 bps on the trade the skill is consulted for |

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Not overall: `with_skill 16/18 vs no_skill 17/18`. Split by task shape it inverts — quizzes `13/15 vs 15/15` (worse), goal-001 `3/3 vs 2/3` (better). The skill helps where the habit must surface unprompted and hurts where a lookup would have been done anyway. |
| Did it reduce time/tokens? | Yes where its facts hold: quiz-004 4x faster (52s vs 220s), quiz-002 3x (72s vs 231s), at ~half the cost. No saving on quiz-003 ($1.07 vs $1.00), where runs read it and verified anyway. On goal-001 it cost *more* (803s/$2.66 vs 481s/$1.88) because it produced more thorough deliverables. |
| Did it create negative deltas? | Two, same root cause — the skill read as sufficient. quiz-001 with_skill 2/3 (expect_1, asserted TVL dominance copied from L357). quiz-005 with_skill 2/3 (expect_4, addresses attributed to the skill itself). |
| What mistakes repeated without the skill? | One: goal-001 no_skill run 2 shipped a runnable swap with no verify-before-funds instruction to the developer. Otherwise `no_skill` was 17/18. |
| What mistakes remained with the skill? | `addresses-verified-stamp-substitutes-for-check` (2/6) and `addresses-base-dominance-metric` (1/3). |
| What should change in the skill? | (1) Fix L353/L357: name the metric — Aerodrome leads Base by routed volume, Uniswap by TVL — and drop the stale ~$500-600M. (2) Add Slipstream to the Aerodrome section, marking which router serves which pools. (3) Rewrite L462 to name Morpho's real Arbitrum deployment, keeping the table row. (4) Move "verify before sending funds" out of the frontmatter to sit beside the addresses, and date rows individually, so a five-month-old ✅ stops reading as a check just performed. (5) Decide whether the ethskills.com feedback instruction belongs in the file. |
| What should change in the eval? | (1) quiz-001 expects 1 and 2 overlap — an asserted dominance claim arguably fails both, and the blind judge split them. (2) No expect distinguishes "correct address" from "correct router for this trade", which is how the -1,283 bps Slipstream gap slipped past every rubric while runs found it unprompted. (3) The quiz set measures a prior opus-5 with tool access no longer holds — 15/15 unaided. The goal shape is the one that discriminates, and future tasks for this skill should follow goal-001, not the quizzes. (4) goal-001 expect_6 should say whether runtime on-chain checks satisfy it, or only a documented instruction to the human; no_skill run 2 failed on that ambiguity. |

## Run conditions

Runs 1-31 were executed 4-5 concurrently and exhausted a five-hour rate-limit window;
five goal-001 runs were terminated mid-flight, produced no output, and were discarded
(no run in this report comes from that batch — the affected run ids were deleted and
re-run from scratch). The final five were executed serially with a cheap canary probe
before each, and completed in 57 minutes with no limit pressure. Serial execution is the
recommended default for this benchmark: goal-001 runs carry 1.8M-4.8M cache-read tokens
each, and concurrency buys wall-clock at the cost of losing whole batches.
