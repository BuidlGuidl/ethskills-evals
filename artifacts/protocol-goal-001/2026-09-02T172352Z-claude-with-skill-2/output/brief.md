# Ethereum State Growth: Technical & Capacity-Planning Brief

**Date:** 2026-09-02
**Audience:** infrastructure team + finance
**Planning window:** now through ~Q1 2028 (24 months)
**Status of sources:** every protocol claim below was verified against forkcast.org, the
Ethereum EIP repository, and All Core Devs call records from July–August 2026. Fork-status
labels use the standard EIP-7723 vocabulary (SFI / CFI / DFI / PFI). See
[Appendix A](#appendix-a--sources-and-verification) for what was checked and when.

---

## 1. Executive summary

Five things drive the recommendation:

1. **State growth is a real, measured protocol-level problem, and core devs agree.** A Geth
   node's state-only database was ~390 GiB in January 2026, growing ~116 GiB/year. Client
   teams treat ~650 GiB of state as the point where node performance visibly degrades.
2. **Relief for *state* is genuinely arriving, and sooner than most people expect — but it is
   gas repricing, not a new state tree.** Glamsterdam contains EIP-8037 (State Creation Gas
   Cost Increase) and EIP-8038 (State-access gas cost update), both **Scheduled for Inclusion**
   as of May and August 2026 respectively. These are the real deliverables.
3. **The thing that would actually shrink state — Verkle tries, state expiry, binary state
   tree — is not coming inside our window.** Verkle (EIP-6800) and leaf-level state expiry
   (EIP-7736) are both **Stagnant** with **no fork relationship at all**. The binary tree
   (EIP-7864) is Draft, unscheduled, and appears in core-dev discussion only as a hypothetical
   future event. **Budget as if none of these ship before 2028.**
4. **The gas limit is going up ~3.3x, and that is the dominant cost driver.** Core devs
   confirmed on 2026-08-13 that 200M gas is safe at Glamsterdam (today: 60M), with EIP-8261
   providing a mechanism to stage 60M → 200M without waiting on operator upgrades. One
   participant floated 300M shortly after. EIP-8037 is calibrated so that *state* growth stays
   bounded under this — but **archive-node growth, which tracks throughput rather than state
   size, is not bounded by anything in the protocol.**
5. **Archive nodes get no protocol relief whatsoever.** Every mitigation in flight targets
   state size or history retention for full nodes. Our archive fleet's cost curve is a
   *client-engineering* story (Geth path-based archive, Erigon 3, Reth), not a protocol story.

**Bottom line for finance:** plan for archive-node storage growth to accelerate roughly in
proportion to the gas limit starting in 2027 — call it 2.5–3x the current per-node annual
growth rate by end of 2027 — and treat any savings from Ethereum's state-tree roadmap as
zero within this budget cycle.

---

## 2. What actually drives state growth at the protocol level

### 2.1 The data structure

Ethereum's state — every account balance, nonce, contract bytecode, and storage slot — lives
in a Merkle-Patricia Trie (MPT). Two properties of the MPT create our pain:

- **Nothing is ever removed.** A storage slot set to zero, or an account emptied, still leaves
  its trie structure behind in practice. The protocol has no expiry mechanism, so state is
  monotonically non-decreasing.
- **Reads and writes are random-access, and get slower as the trie deepens.** State access is
  effectively random I/O against a large key-value store. As state grows, cache hit rates fall
  and each cold access costs more real time — while the *gas* charged for that access stayed
  fixed since Berlin (EIP-2929, March 2021).

That second point is the crux: **gas prices for state operations have not tracked the real
cost of those operations for five years.** Creating state has been systematically underpriced
relative to the permanent, unbounded burden it imposes on every node operator in the world,
forever.

The underpricing is also *inconsistent*, which EIP-8037 documents directly: deploying contract
code costs ~200 gas per new byte, while creating a new storage slot costs ~313 gas per new
byte — for state that is identical in cost to us. Deploying duplicated bytecode costs the same
as novel bytecode, even though clients deduplicate it on disk and store it once.

### 2.2 The measured numbers

From EIP-8037's motivation section (the canonical figures core devs are working from):

| Metric | Value | Notes |
|---|---|---|
| Geth state-only DB size | **~390 GiB** | as of January 2026 |
| Daily new state @ 30M gas | ~105 MiB/day | pre-Pectra baseline |
| Daily new state @ 60M gas | **~326 MiB/day** | current regime |
| Implied annual growth | **~116 GiB/year** | current trajectory |
| Performance-degradation threshold | **~650 GiB** | client-team consensus figure |
| Projected growth @ 200M gas, *unmitigated* | **~387 GiB/year** | would breach 650 GiB in under a year |

Two things worth flagging to the team:

- **The response to gas-limit increases is superlinear.** The 30M → 60M bump (2x) produced
  roughly a **3x** jump in daily new state. EIP-8037's authors read this as a one-off
  behavioral shift rather than a stable ratio, but it is a warning: naive linear extrapolation
  from gas limit to state growth has already underestimated reality once.
- **We are close to the wall.** ~390 GiB against a ~650 GiB degradation threshold, at
  ~116 GiB/year, is roughly 2.2 years of headroom *at today's gas limit* — and the gas limit
  is about to more than triple.

### 2.3 Why our three symptoms are actually three different problems

This distinction matters for where to spend money, and it is the single most useful thing in
this brief:

| Symptom | Root cause | Does the protocol roadmap help? |
|---|---|---|
| **Full-node disk growth** | State size + history retention | **Yes** — EIP-8037/8038 bound state; EIP-4444 history expiry bounds history |
| **Sync times** | Snap-sync healing phase is iterative and round-trip-bound | **Yes** — EIP-8189 (snap/2 BAL-based healing) |
| **Archive-node disk growth** | Historical state diffs / traces, which scale with *throughput* | **No.** Nothing in the roadmap addresses this. Rising gas limit makes it strictly worse. |

Our biggest stated pain — archive disk — is the one the protocol is **not** fixing.

---

## 3. What is actually coming: verified fork status

### 3.1 Current mainnet state

- **Fusaka is live** (activated 2025-12-03), which brought PeerDAS, the 60M default gas limit
  (EIP-7935), and eth/69 with history-expiry support (EIP-7642).
- **Verified live on mainnet at time of writing:** block 25,891,094, **gas limit 60.0M**,
  gas used 26.5M.

### 3.2 Glamsterdam — the next upgrade (SFI, no announced mainnet date)

Glamsterdam (Gloas CL + Amsterdam EL) is the relevant fork for our planning window. Its scope
is **locked** — the meta EIP (EIP-7773) lists 18 EIPs Scheduled for Inclusion — but **the
mainnet activation date is not announced**; the activation table in the meta EIP is still empty.

**Timeline as of the 2026-08-27 ACDE call:**

| Milestone | Date | Confidence |
|---|---|---|
| Devnet-9 (non-finality stress test, ~1,000 nodes) | early Sept 2026 | in progress |
| Sepolia fork | 2026-09-28 (proposed) | proposed, pending ACDC confirmation |
| Hoodi fork | 2026-10-26 (proposed) | contingent on stable devnets |
| ~30-day security audit window + ~30-day L2/DAO prep window | Oct–Nov 2026 | process, not a date |
| **Mainnet** | **"end of November / early December 2026"** | **working estimate only — not announced** |

Forkcast's internal planning assumption is 2026-12-02. Treat this as a planning assumption, not
a commitment.

**Known live risk to that date:** on the 2026-08-31 ACDT call, a spec bug in EIP-8037 (a
cross-frame state-gas refill that permits laundering regular gas into state gas across call
frames) was identified as potentially **consensus-breaking**. Fixing it may require a fresh
devnet cycle, which participants estimated could push Sepolia — and therefore mainnet — by
**~1 month**. The decision was deferred to ACDC. **Plan for Glamsterdam mainnet somewhere in
the December 2026 – February 2027 band, and do not schedule anything that breaks if it slips.**

#### The state-relevant EIPs in Glamsterdam (all SFI)

**EIP-8037 — State Creation Gas Cost Increase.** The centerpiece. Introduces `CPSB` ("cost per
state byte", set to 1,530 gas) and harmonizes all state-creation operations onto a single
per-byte price. It also introduces **multidimensional metering**: a separate `state-gas`
dimension alongside `execution-gas`, where a block is "full" when either dimension hits the
limit. Calibrated to target **120 GiB/year of state growth at a 150M reference gas limit**,
assuming 50% average state-gas utilization.

Worst-case growth under EIP-8037, from the EIP's own rationale:

| Block gas limit | Worst-case state growth |
|---|---|
| 100M | 80 GiB/year |
| 150M | 120 GiB/year |
| 200M | **160 GiB/year** |
| 250M | 200 GiB/year |
| 300M | 240 GiB/year |

Compare against **~387 GiB/year unmitigated at 200M**. So EIP-8037 does not *reduce* state
growth versus today (~116 GiB/yr); it prevents the ~3.3x throughput increase from producing a
proportional explosion. **Our state footprint will still grow faster in 2027 than in 2026 —
roughly 160 GiB/year worst case rather than 116 GiB/year — just not catastrophically faster.**

**EIP-8038 — State-access gas cost update.** Repricing to reflect the larger state. Concrete
changes: `COLD_ACCOUNT_ACCESS` 2,600 → 3,000 (+15%); new `ACCOUNT_WRITE` 6,700 → 9,000 (+34%);
new `STORAGE_WRITE` 2,800 → **10,000 (+257%)**; `CREATE_ACCESS` 7,000 → 12,000 (+71%). The
STORAGE_WRITE increase is large and will change the economics of storage-heavy contracts —
relevant if we index or bill on gas-weighted metrics.

**EIP-8189 — snap/2, BAL-Based State Healing** (networking). Directly targets our sync-time
pain. Replaces snap sync's iterative `GetTrieNodes` healing phase — which chases missing trie
nodes one round-trip at a time — with downloading block access lists and applying state diffs
sequentially. **The remaining work becomes known upfront rather than discovered iteratively.**
Besu and ethrex have implementations ready to test on an upcoming mainnet shadow fork. This is
the single most valuable item in Glamsterdam for our sync-time problem, and it is worth
tracking closely because it will change how we plan node bring-up.

**EIP-7928 — Block-Level Access Lists** (headliner). Enables parallel execution and is the
prerequisite for EIP-8189. Also directly useful to us as a data company: BALs give a
per-block, header-committed record of every state change, which is a cleaner state-diff feed
than anything we can currently reconstruct.

**Things that make state or storage *worse*, also SFI — plan for these:**
- **EIP-7954** raises max contract code size 24 KiB → 64 KiB and initcode 48 KiB → 128 KiB.
  Larger contracts, more code state. (EIP-8037's per-byte pricing does at least make callers
  pay for it.)
- **EIP-7708** makes all ETH transfers emit a log. Every value-bearing transaction, `CALL`,
  `CREATE`/`CREATE2`, and `SELFDESTRUCT` now emits a `Transfer`-shaped LOG3. **This is a
  material increase in log and receipt volume, and it lands squarely on us.** It is genuinely
  good for our product — ETH transfers from smart contract wallets become traceable through
  the same mechanism as ERC-20s, which removes a real class of indexing bug — but it will
  inflate receipt storage and log-index sizes. **Budget for it and re-estimate our log index.**

**Notably declined for Glamsterdam** (do not plan around these): EIP-8032 (Size-Based Storage
Gas Pricing, DFI 2026-01-15), EIP-2926 (Chunk-Based Code Merkleization), EIP-6873 (Preimage
retention — a state-tree-migration prerequisite), EIP-8058 (Bytecode Deduplication Discount),
EIP-7973 (Warm Account Write Metering).

### 3.3 The gas limit trajectory — the real budget driver

This deserves its own section because it dominates every hardware number.

On **2026-08-13**, core devs confirmed final gas-repricing benchmark results for EIP-2780,
EIP-8037, and EIP-8038, and concluded that **200M gas can be safely supported at Glamsterdam**
— versus 60M today. The stated safety anchor is ~75 Mgas/s, where all clients are clearly
safe. One participant (Toni Wahrstätter) noted 300M would still carry a safety buffer and
suggested pushing for it shortly after Glamsterdam.

**EIP-8261 (Gas Limit Schedule)** — Informational, in Glamsterdam — is the delivery mechanism.
It adds an optional `GAS_LIMIT_SCHEDULE` to consensus-layer config (mirroring `BLOB_SCHEDULE`),
so the network's gas limit can step up at predetermined epochs *without* waiting for every
operator to ship a new release or set a flag. Prysm, Lighthouse, Lodestar, and Teku have
implemented or approved it; Nimbus is neutral-but-unopposed.

**What this means for us:** the gas limit will very likely ratchet 60M → 200M in staged steps
across 2027, on a schedule the network can execute without operator coordination. **This is the
number to build the capacity model around.** Our throughput-proportional costs — archive
storage, trace generation, index size, RPC egress, CPU for re-execution — should be modeled
against a gas limit that reaches ~200M during 2027, with 300M a live possibility for 2028.

### 3.4 History expiry (EIP-4444) — happening now, and this is important

**Status: Draft. No fork relationship. This is not a hard-fork feature — it is coordinated
client behavior.** That distinction matters: it means it can land *without* a fork, on client
release timelines, and it means there is no consensus rule forcing it.

But it is actively converging right now. On the 2026-08-27 ACDE call all clients agreed to
align on a retention window of **33,024 epochs (~147 days, ~5 months)**, and EIP-4444 is being
updated to document that number. Client readiness as of late August 2026:

| Client | Status |
|---|---|
| Nimbus | implemented |
| Nethermind | implemented |
| Reth | next release |
| ethrex | PR up, testing |
| Erigon | will look into it (already prunes to ~262k blocks, ~5 months, per EIP-8252) |
| Besu | agreed to 33,024 epochs, implementation work needed |
| Geth | agreed, no implementation update given |

The motivating quote from that call, which is worth repeating to the team verbatim:
**"Currently 2TB nodes are near capacity at 1.5–1.8 TB; launching Glamsterdam without expiring
history could exhaust storage."**

**Action item:** history expiry is the largest near-term disk win available to us on
**full** nodes, it is landing on client-release timelines rather than fork timelines, and it
requires us to have made a decision first — see §5.

### 3.5 Hegotá — the fork after (planning stage, ~mid-2027 at the earliest)

Hegotá (Heze CL + Bogotá EL) is in **Planning**, with a working estimate of **2027-06-16** and
an official activation year of "2027". Only two EIPs are SFI: **EIP-7805 (FOCIL)** as headliner
and **EIP-8141 (Frame Transaction)**. Everything else — 60+ EIPs — is merely **Proposed for
Inclusion (PFI)**, which carries close to zero predictive weight. Client teams were asked to
submit first-pass S/A/B/D rankings by mid-September 2026, with rough consensus targeted before
Devcon.

State-relevant items in Hegotá, **all PFI, none committed**:

- **EIP-8188 (Last-Written Block for Accounts and Slots)** — the most strategically interesting.
  Adds a `last_written_block` field to account and storage-slot encodings, giving clients a
  consensus-verified signal for which state is actually "active." Explicitly scoped to metadata
  only, with **no gas changes** — the EIP states that in-protocol state tiering with
  differentiated gas costs would require a separate future proposal. **This is the closest
  thing to a state-expiry stepping stone that has any fork relationship at all, and it is one
  PFI plus at least one unwritten follow-up EIP away from doing anything.**
- **EIP-8372 (Normalized state gas limit)** — retunes EIP-8037's state-gas dimension so state-gas
  and execution-gas fill at similar rates.
- **EIP-8358 (Net Gas Metering for Account Changes)**, **EIP-7709 (Read BLOCKHASH from
  Storage)**, **EIP-7862 (Delayed State Root)** — all PFI.
- **EIP-8025 (Optional Execution Proofs)** — the statelessness path. Opt-in, altruistic
  proof-generating nodes broadcast execution proofs so CL nodes can verify payloads statelessly
  in constant time regardless of state size. Being targeted for CFI in Hegotá per the
  2026-08-12 L1-zkEVM breakout. **Explicitly opt-in and explicitly does not change consensus
  validity rules**; the EIP itself says a *future separate* EIP could make it mandatory once
  mature. Real, moving, and irrelevant to our disk usage for years.
- **EIP-8383 (Reduce CL Block Retention Window)** — would halve the CL retention constant.

**How much to bank on Hegotá: essentially nothing.** Two SFI EIPs, neither state-related, a
date that is a guess, and a scope that will not be settled until late 2026. If Hegotá lands
mid-2027 and contains something useful, treat it as upside.

### 3.6 The elephant: Verkle, state expiry, and the binary tree

This is the part most likely to be misremembered from older roadmap material, so it is worth
being blunt.

| Proposal | Spec status | Fork relationship | Verdict |
|---|---|---|---|
| **EIP-6800** — Unified Verkle tree | **Stagnant** | **None** | Dead in its current form. Do not plan around it. |
| **EIP-7736** — Leaf-level state expiry in Verkle tries | **Stagnant** | **None** | Dead alongside Verkle. |
| **EIP-4762** — Statelessness gas cost changes | Draft | **None** | Unscheduled. |
| **EIP-7864** — Unified **binary** state tree | Draft | **None** | The successor direction, but unscheduled. |
| **EIP-6873** — Preimage retention (migration prerequisite) | Stagnant | **Declined** for Glamsterdam | Prerequisite work is not moving. |
| **EIP-8075** — Adaptive state cost to cap growth | Draft | **None** | Not in any fork. |

Reinforcing evidence from the primary record: the word **"verkle" does not appear anywhere in
2026 All Core Devs call notes.** Neither does "state expiry." The binary tree appears exactly
twice, and in both cases as a *hypothetical future* — most tellingly on 2026-08-27, where a
core dev's argument was that modifying the deployed deposit contract via irregular state
transition would be acceptable *if bundled with a massive state reorganization like the binary
tree (PBT) migration*. That is the language of something being reasoned about in the abstract,
not something being built. (Related note from 2026-08-17: under PBT there would no longer be a
storage root at all — indicating the design is still in flux at a fundamental level.)

**Planning guidance:** a state-tree migration is a multi-year, ecosystem-wide event requiring a
preimage-retention prerequisite that was just declined, a spec that is Draft and unstable, and
an irregular state transition affecting every node on the network. **It will not happen inside
a 24-month window.** Any vendor, consultant, or internal projection that assumes Verkle-style
relief before 2028 should be corrected.

---

## 4. What this means for our capacity model

### 4.1 Full nodes

| Driver | Direction | Magnitude |
|---|---|---|
| State growth | Worse, but bounded | ~116 GiB/yr today → ~160 GiB/yr worst case at 200M under EIP-8037 |
| History retention | **Better** | 33,024-epoch (~5 month) window; the single largest near-term win |
| Sync time | **Better** | EIP-8189 BAL-based healing removes the iterative healing phase |

Full-node economics improve on net, but **only if we actually adopt history expiry.** A full
node that retains all history sees state growth accelerate with no offsetting saving.

### 4.2 Archive nodes — where our money goes

**No protocol change in Glamsterdam or PFI'd for Hegotá reduces archive-node storage.** Archive
growth is driven by historical state diffs and traces, which scale with *transaction
throughput*, not with state size. EIP-8037 bounds the *state* dimension; it does nothing about
the volume of historical diffs generated by 3.3x more gas per block.

Directionally, on a 60M → 200M gas-limit path over 2027:

- **Archive storage growth should be modeled as roughly proportional to the gas limit**, i.e.
  approaching ~3x current per-node annual growth by the time 200M is reached, phased in across
  the staged EIP-8261 increases rather than arriving as a step function.
- **EIP-7708 adds log/receipt volume on top of that**, independent of the gas-limit effect.
- The gas repricings (EIP-8038's +257% `STORAGE_WRITE`, EIP-8037's higher creation costs) will
  suppress *some* state-heavy activity, so proportionality is a conservative upper bound rather
  than a point estimate. I would model a central case around 2.5x and a pessimistic case at 3.5x
  — the latter because the 30M → 60M transition already produced a superlinear state response
  once, and because 300M is being openly discussed for 2028.

**Where archive relief actually comes from: client engineering, not the protocol.** Geth's
path-based archive mode reportedly brings archive footprint to roughly 2 TB versus the tens of
TB required by the legacy hash-based scheme, though it does not yet support historical Merkle
proofs (`eth_getProof` against historical blocks). Erigon and Reth sit in broadly similar
territory. **The single highest-leverage thing we can do for archive cost is a client/storage-
mode evaluation — that is a two-engineer-month project with a plausible order-of-magnitude
payoff, and it is entirely within our control.** Contrast with the protocol roadmap, which
offers us nothing here on any timeline.

One caveat worth verifying ourselves before acting: the specific archive-footprint figures
above come from secondary sources, not from primary client documentation. They are directionally
well-established but should be confirmed on our own hardware with our own workload before they
enter a budget — see §5, item 1.

### 4.3 Planning scenarios

| Scenario | Assumption | Probability | Implication |
|---|---|---|---|
| **Base** | Glamsterdam Dec 2026 – Feb 2027; gas limit staged to 200M through 2027; EIP-4444 adopted | ~65% | Full-node disk roughly flat-to-better; archive grows ~2.5–3x current rate through 2027 |
| **Slip** | EIP-8037 bug forces a devnet cycle; Glamsterdam slips to Q1–Q2 2027; gas increases push into 2028 | ~30% | More runway; same endpoint, later. Do not over-provision early. |
| **Aggressive** | Glamsterdam on time; 300M pushed during 2027 | ~5% | Archive growth ~5x current rate; forces the client/storage-mode migration regardless |
| **State-tree relief inside window** | Verkle or binary tree ships before 2028 | **~0%** | **Do not model.** |

These probabilities are my judgement calls from the primary record, not published figures —
they are there to make the shape of the risk explicit, not to be quoted as fact.

---

## 5. Recommendations

Ordered by leverage. Items 1–3 are independent of whether any protocol change ships on time,
which is the point.

**1. Run an archive client/storage-mode evaluation this quarter. Highest leverage, fully under
our control.** Benchmark Geth path-based archive, Erigon 3, and Reth on our actual query mix.
The published footprint differences are large enough that this plausibly dominates every
protocol change in this brief combined. **Critical gate:** confirm whether we need historical
Merkle proofs (`eth_getProof` against historical blocks) — Geth's path-based archive mode does
not support them, and if any customer contract depends on that, it eliminates the option
outright. Establish that requirement *before* the benchmark, not after.

**2. Decide our history-retention policy now, ahead of the client releases.** EIP-4444 with a
33,024-epoch (~5 month) window is landing on client-release timelines, not fork timelines,
which means it will arrive faster than most of our team expects. For each fleet role, decide:
retain full history, or expire to the ~5-month window and serve older data from a separate
tier? If any product surface depends on serving arbitrary historical blocks or receipts over
JSON-RPC from full nodes, that dependency needs an owner and a migration path **before** the
retention default flips. This is the "we didn't decide, so the client decided for us" risk.

**3. Build the capacity model against the gas limit, not against calendar time.** Parameterize
storage, CPU, and egress projections on the block gas limit and re-run them at 60M / 100M /
150M / 200M / 300M. The EIP-8261 schedule means the ratchet will be visible and dated in
consensus-layer config in advance, so **we can convert protocol schedule into budget with
weeks of lead time rather than reacting to it.** Wire the active `GAS_LIMIT_SCHEDULE` into
whatever we use for capacity forecasting.

**4. Provision for Glamsterdam in a December 2026 – February 2027 window, with no hard
dependency on the date.** The scope is locked (18 SFI EIPs, meta EIP EIP-7773), but the
activation table in the meta EIP is empty and an open consensus-breaking spec bug in EIP-8037
could cost ~1 month. Purchase decisions that assume a specific activation date should be
avoided; decisions robust across that whole band are fine.

**5. Size the EIP-7708 log-volume impact against our own indexer.** Every ETH transfer,
including internal ones, will emit a log. We can estimate this precisely from historical trace
data — count value-bearing `CALL`s, `CREATE`s, and `SELFDESTRUCT`s per block and price the
additional receipt and log-index storage. Worth doing before it lands, because it is both a
cost (index growth) and a product opportunity (native ETH-transfer tracking for smart contract
wallets, which is a real gap in every indexer today, ours included).

**6. Treat EIP-8189 (BAL-based snap sync) as a genuine sync-time improvement, and validate it
early.** It is the one item in Glamsterdam that directly attacks our sync-time complaint. Besu
and ethrex have implementations ready for the upcoming mainnet shadow fork. Getting a
measurement from that shadow fork on our own hardware would let us re-plan node bring-up
timelines with real numbers rather than waiting until after mainnet activation.

**7. Do not build any plan, budget line, or customer commitment on Verkle, state expiry, the
binary state tree, or enshrined statelessness.** They are unscheduled, and two of the four are
formally Stagnant. Re-evaluate at each fork-scoping cycle — the Hegotá S/A/B/D rankings due
mid-September 2026 and the pre-Devcon consensus are the next real signal — but assume zero
relief from this direction inside 24 months.

**8. Set a recurring quarterly protocol-status review.** Fork scope moves: EIP-7610 was
formally cancelled from Glamsterdam on 2026-08-20; EIP-8037's self-destruct refund was rejected
on 2026-08-27 and deferred to Hegotá. A standing 30-minute quarterly check against forkcast.org
and the meta EIPs keeps this brief from silently going stale — which, given how much of our
budget depends on it, is cheap insurance.

---

## Appendix A — Sources and verification

All fork-status claims were verified on **2026-09-02** against primary sources:

- **forkcast.org** — upgrade status, EIP fork relationships, and per-EIP status histories,
  read from the canonical dataset backing the site (`ethereum/forkcast`, commit `364cd8e`,
  synced 2026-09-02).
- **EIP-7773** — Glamsterdam meta EIP (SFI list; activation table confirmed empty).
- **EIP-8081** — Hegotá meta EIP thread.
- **EIP-8037, EIP-8038, EIP-8189, EIP-8261, EIP-4444, EIP-7708, EIP-7954, EIP-8188, EIP-8025**
  — read in full from the EIP repository for specification detail and quantitative figures.
- **All Core Devs call records:** ACDE #243 (2026-08-13), ACDE #244 (2026-08-27),
  ACDC #185 (2026-08-20), ACDT #94 (2026-08-31), L1-zkEVM breakout #07 (2026-08-12).
- **Mainnet live query** (2026-09-02 17:26 UTC): block 25,891,094, gas limit 60,000,000.

**Status vocabulary** (per EIP-7723): **SFI** = Scheduled for Inclusion (committed to a named
fork); **CFI** = Considered for Inclusion (under consideration, not committed); **PFI** =
Proposed for Inclusion (proposed only — weak signal); **DFI** = Declined for Inclusion.
An EIP's *specification status* (Draft / Review / Stagnant / Final) describes document maturity
and says **nothing** about whether it will ship.

**Secondary sources**, used only for the client archive-footprint figures in §4.2 and flagged
as such in the text — these should be confirmed on our own hardware before entering a budget:
[Chainstack: Erigon vs Geth 2026](https://chainstack.com/ethereum-clients-geth-and-erigon/),
[7BlockLabs archive node disk sizes 2026](https://www.7blocklabs.com/blog/ethereum-archive-node-disk-size-2026-vs-erigon-archive-node-disk-size-2026-vs-geth-full-node-disk-size-2026),
[Cherry Servers: Ethereum node hardware requirements](https://www.cherryservers.com/blog/ethereum-node-requirements).

**Dates given for unshipped forks are working estimates, not commitments.** Glamsterdam has no
announced mainnet activation date; Hegotá has neither a date nor a settled scope.
