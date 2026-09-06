# Ethereum State Growth: Technical & Capacity Planning Brief

**Prepared:** 3 September 2026
**Planning window:** Sept 2026 → Sept 2028 (24 months)
**Audience:** infrastructure team + finance

---

## 0. Bottom line up front

**For finance (read this page only):**

1. **No protocol change landing in our planning window shrinks archive-node disk.** The
   changes that would (state expiry, binary trees, statelessness) are not scheduled for
   any fork we can plan around. Treat them as zero for budgeting purposes.

2. **The dominant driver of our next 24 months is not state growth — it is the block gas
   limit going from 60M today toward 150–200M.** Ethereum's next upgrade (Glamsterdam,
   targeted Q4 2026) is explicitly designed to make that ~2.5–3.3× throughput increase
   safe. Archive footprint scales roughly linearly with throughput. Our disk bill scales
   with it.

3. **The protocol's own state-growth fix is a *cap*, not a *cut*.** The gas repricing in
   Glamsterdam (EIP-8037/8038) targets holding state growth at ~120 GiB/year even as
   throughput triples. That is a genuine win — but it holds the line at roughly today's
   *state* growth rate while *history, receipts and traces* (the bulk of an archive node)
   grow with throughput.

4. **Budget implication:** plan for per-archive-node storage of roughly **2–2.5× current**
   by Sept 2028, with the possibility of ~3× in an aggressive-ramp scenario. Do **not**
   sign 36-month capex on fixed-capacity chassis. Buy expandable, lease where possible,
   and keep free drive bays.

5. **There is real, bankable relief — but it is on the *access* side, not the *storage*
   side.** Two Glamsterdam EIPs (Block-Level Access Lists, and ETH transfers emitting
   logs) let us retire a large class of expensive archive tracing from our data pipeline.
   That is a cost reduction we can plan and engineer for. It is the single highest-ROI
   piece of work available to us in this window.

**Confidence summary:**

| Claim | Confidence |
|---|---|
| Gas limit rises materially above 60M within window | **High** |
| Glamsterdam ships within window (Q4 2026–H1 2027) | **High** |
| State growth capped near ~120 GiB/yr post-Glamsterdam | **Medium-high** |
| BALs + transfer logs let us cut tracing load | **High** (contingent on Glamsterdam) |
| State expiry / binary trees / statelessness deliver relief in window | **Very low — plan as zero** |

---

## 1. What actually drives this at the protocol level

### 1.1 Three different things get conflated as "state"

Most capacity confusion in this space comes from treating one word as three. Precision here
directly changes what we buy.

| Layer | What it is | Can it ever shrink? | Roughly how big today |
|---|---|---|---|
| **Active state** | Current balances, nonces, code, storage slots — everything needed to execute the *next* block | Only via state expiry (not scheduled) | ~390 GiB (Jan 2026 measurement) |
| **History** | Blocks, transactions, receipts since genesis | Yes — history expiry, partly shipped | Hundreds of GiB, grows with throughput |
| **State history / archive index** | Every intermediate state at every past block; what makes an "archive node" | Only by changing representation | The bulk of our archive footprint |

Our full nodes are dominated by (1) and (2). Our archive nodes are dominated by (3). These
have completely different growth drivers and completely different roadmap relief. Any
capacity model that uses one number for "the chain" will be wrong.

### 1.2 Why the active state grows and never shrinks

Ethereum stores its state in a **Merkle Patricia Trie (MPT)** — a hexary (16-way) radix
trie, keyed by `keccak256` of the account address, with each account's storage held in its
own second-level trie keyed by `keccak256` of the slot.

Four properties of that design generate our pain:

**(a) There is no deletion primitive with refund parity.** Clearing a storage slot refunds
some gas, but nothing in the protocol requires or economically forces anyone to release
state. A slot written once by a contract nobody has used since 2021 is still in the trie
that every node must be able to prove against. EF researchers put the figure at roughly
**80% of state untouched for more than a year** — and every node still stores all of it.

**(b) Hashed keys destroy locality.** Because the trie is keyed on `keccak256(address)`,
two accounts touched by the same transaction sit in unrelated parts of the tree. Every
state read is effectively a random-access walk down ~7–8 levels of trie nodes, each a
separate database lookup. This is why state size translates so directly into *IOPS* and
*sync time*, not just gigabytes — and why our sync times degrade superlinearly rather than
linearly with disk.

**(c) Write amplification is brutal.** Changing one storage slot rewrites every trie node
on the path to the root — a handful of 32-byte-hash-laden nodes per change, plus the
account trie path above it. Under the legacy hash-based storage scheme, *each version* of
each of those nodes is retained. This is the mechanism that produced 18–20 TB Geth archive
nodes: not because Ethereum's state is 20 TB, but because storing every historical version
of every trie node on every write path is enormously redundant.

**(d) The gas schedule undercharges for permanence.** This is the economic root cause. The
costs of state-creating operations were last set in the **Berlin fork, 2021**. `SSTORE`
into a new slot costs 20,000 gas. That slot imposes ~64 bytes of permanent state on every
node on Earth, forever — an effective price of roughly **310 gas/byte**. Analysis behind
the repricing work concludes the sustainable price is closer to **1,530 gas/byte**. We have
been running a ~5× subsidy on permanent state for five years, and the volume of that
subsidy is now capped only by the block gas limit.

### 1.3 Why archive nodes are the specific problem

An archive node must answer "what was the state at block N" for any N. Two representations
exist:

- **Hash-based (legacy Geth `--gcmode=archive`)**: retain every version of every trie node.
  Correct, supports historical Merkle proofs natively, and costs **>20 TB** with sync times
  measured in *months*. This is effectively obsolete for new deployments.
- **Flat state + reverse diffs (Erigon 3, Reth, Geth ≥ v1.16 path-based)**: keep one full
  current state plus reverse key-value diffs, and reconstruct historical values by walking
  diffs. Costs roughly **2–3.5 TB** and syncs in ~2 weeks.

The industry already made this transition, and it bought roughly an order of magnitude.
**That one-time win is spent.** From here, flat-state archive footprint grows at
approximately the rate that new state and new diffs are produced — which is to say, at
roughly the rate the chain does work.

### 1.4 The numbers as of today

| Metric | Value | Source / date |
|---|---|---|
| Block gas limit | **60M** (raised from 30M on 25 Nov 2025) | validator signalling |
| Active state size | ~390 GiB | EIP-8037 analysis, Jan 2026 |
| New state/day at 30M gas | ~105 MiB | pre-Nov-2025 |
| New state/day at 60M gas | ~326–349 MiB | 2026 measurements |
| Annualised state growth at 60M | **~116–124 GiB/yr** | derived, consistent across sources |
| Erigon archive footprint | ~3–3.5 TB | Chainstack, Mar 2026 |
| Geth path-based archive (flat state history) | ~2 TB | Geth docs |
| Geth path-based archive (+ historical trie nodes) | ~6.5 TB | Geth docs |
| Geth hash-based archive | >20 TB | Geth docs |

⚠️ **Source-quality warning for the team:** archive size figures vary widely across
published sources (one SEO-farm site claims Erigon archive at 1.8–2.2 TB, against
Chainstack's 3–3.5 TB in the same period). Also note that **`ethereum.org/roadmap/statelessness`
is badly out of date** — it still cites February 2023 figures (12 TB archive, 14 GB/week).
Do not use it or downstream content that quotes it. **Our own fleet telemetry is the only
number we should plan against**; see §4.1.

---

## 2. What is coming — and what we can bank on

I've sorted this by how much weight it can bear in a budget, not by how exciting it is.

### 2.1 Already shipped (bank on it — it's in our current numbers)

- **Partial history expiry (EIP-4444 family).** All execution clients support dropping
  pre-Merge block bodies and receipts; clients were permitted to drop pre-Merge history
  from 1 May 2025. Worth **300–500 GB** per node. Note: pre-Merge *headers* must still be
  served. Full *rolling* history expiry (dropping arbitrarily old history on a moving
  window) is still work in progress, not shipped.
- **`eth/69` (EIP-7642).** Nodes advertise the historical block range they serve, and
  receipt bloom filters were removed from the wire protocol — worth roughly **530 GB of
  transfer per sync**. Mandatory as of Fusaka (3 Dec 2025).
- **Flat-state archive across all major clients** (Erigon 3+ snapshots, Reth, Geth ≥1.16
  path-based). The ~10× archive reduction described in §1.3.

### 2.2 Glamsterdam — scheduled, high confidence, mixed impact

**Status:** headliners locked (Jan 2026), EIP set frozen (Mar 2026), public testnet
(*Platåberget*, glam-devnet-8) running since ~Aug 2026, Sepolia fork ~21–28 Sept 2026
(sources disagree by a week), Hoodi ~5 Oct 2026. **Mainnet targeted Q4 2026 — projected
4 Nov 2026 but explicitly not confirmed by All Core Devs.**

**Confidence it lands within our window: high.** It already slipped once (originally H1
2026 → Q4 2026), driven mainly by ePBS implementation proving harder than expected. Another
one-quarter slip is entirely plausible. A slip past mid-2027 is not.

**What's in it that matters to us:**

| EIP | What it does | Impact on us |
|---|---|---|
| **EIP-8037** State-creation gas repricing | Sets a cost per state byte (CPSB ≈ 1,530 gas/byte) and a separate "state gas" dimension with its own reservoir. Targets **120 GiB/yr** state growth at a 150M reference gas limit; ~160 GiB/yr worst case at 200M | **Caps** state growth. Does not reduce it |
| **EIP-8038** State-access gas repricing | Aligns read costs with real I/O cost | Indirect; discourages state-heavy patterns |
| **EIP-7928** Block-Level Access Lists | Every block carries an enforced list of all accounts/slots touched **with post-execution values** — full state diffs, in the block. ~35 KiB/block overhead at 36M gas | **Major opportunity — see §3.3** |
| **EIP-7732** ePBS | Enshrined proposer-builder separation | Little direct storage impact; it's the long pole on timing |
| **EIP-7708** ETH transfers emit logs | Plain ETH transfers become retrievable via `eth_getLogs` instead of tracing | **Major opportunity — see §3.3** |
| **EIP-8159** `eth/71` | Block access list exchange on the wire | Enables BAL-based sync paths |
| **EIP-2780** | Reduces intrinsic tx gas cost | Minor |

**The critical caveat on EIP-8037's numbers:** the EIP is still formally in peer review and
its parameters are being finalised on devnets. **EIP-8372** ("Normalized state gas limit")
is a live draft that would *modify* EIP-8037's limits with a scaled/normalised state-gas
limit calibrated once at the fork boundary. Treat 120 GiB/yr as the design intent and the
exact parameters as provisional.

**The repricing is also a breaking change we must test.** Per the EF's 24 Aug 2026 post,
these are the first state-cost changes since Berlin 2021 and they are large:

- New storage slot (`SSTORE` 0→x): 20,000 → **~97,920 gas** (~5×)
- New account creation: 25,000 → **183,600 gas** (~7×)
- 24 KB contract deployment: ~4.95M → **~37.78M gas** (~8×)
- The "a transfer costs 21,000 gas" assumption **breaks**, and the `GAS` opcode's return
  semantics change (returns `gas_left` only, excluding the state reservoir)

Anything we ship that estimates gas, simulates transactions, or models fees will produce
wrong answers on day one unless it is updated. This is a hard engineering deadline tied to
the fork, not an optional item.

### 2.3 The gas limit — the thing that actually determines our budget

This is the part most easily missed, and it is the reason a "state growth is being fixed"
headline should **not** reduce our hardware budget.

Glamsterdam's headline features (BALs enabling parallel execution, ePBS) exist to make a
**60M → ~200M** gas limit safe. The EF's own 2026 priorities commit to pushing "toward and
beyond 100M"; the stated Glamsterdam objective is a **200M gas limit floor**. Ecosystem
figures have talked about 180M as a baseline for the year.

The gas limit is not set by the fork. It is set by **validator signalling**, and can move
at any time after the client capability exists. That means:

- The relief (repricing) and the load (throughput) arrive **together**, by design.
- State growth per year is roughly *flat* across that transition — that is the win, and it
  is real: ~120 GiB/yr at 150M gas versus ~116–124 GiB/yr at 60M today.
- But **history, receipts, logs, traces and state diffs are not repriced by state-gas.**
  They scale with gas actually consumed. If real throughput goes up 2.5–3×, the
  non-state portion of our archive nodes — which is most of it — grows 2.5–3× faster per
  unit time.

**This is the single most important sentence in this brief:** the protocol is fixing the
metric that is *cheapest* for us (active state, ~390 GiB) while tripling the driver of the
metric that is *most expensive* for us (archive history, multiple TB).

### 2.4 Hegotá — outside effective planning range

- Headliner **proposal** deadline: **4 Oct 2026**. Headliner **selection**: **3 Nov 2026**.
- EIP selection deadline: 10 Dec 2026. Testnets ~Apr 2027. **Mainnet projected 19 May 2027
  — 1 of 12 milestones complete.**
- 66 proposals were on the table as of Aug 2026, being cut to a shippable set.
- **The consensus-layer headliner is FOCIL (EIP-7805)** — fork-choice enforced inclusion
  lists, deferred from Glamsterdam. That is censorship resistance, not state relief.
- Also under discussion: another repricing bundle for data and state growth; EIP-7668
  (bloom filter removal) and other Glamsterdam rejects; privacy-oriented proposals.

**Given Glamsterdam has already slipped one quarter and every fork in recent memory has
slipped, a May 2027 Hegotá should be modelled as H2 2027 at the earliest, with meaningful
probability of 2028.** Anything Hegotá delivers reaches production in our fleet at the very
tail of our window, if at all. **Do not budget against it.**

One item worth watching for a *secondary* reason: **EIP-7745 / EIP-7668** (replacing the
2048-bit log bloom filters with a proper trustless log index). If that lands, `eth_getLogs`
becomes vastly cheaper and trustlessly provable — directly relevant to our product surface.
It is a proposal, not a commitment.

### 2.5 The real fixes — aspirational, outside the window

These are what would actually shrink an archive node. All of them are research-stage.

| Change | What it would do | Honest status |
|---|---|---|
| **Binary tree state (EIP-7864)** | Replace the 16-way MPT with a unified binary tree over a single 32-byte key space; ~4× shorter proofs; prerequisite for statelessness | **Draft since Jan 2025.** Replaced Verkle trees as the plan (Verkle's elliptic-curve crypto isn't post-quantum). EF says the statelessness design is "being redesigned around quantum-safe binary hash trees, with the final approach yet to be confirmed." **Not a Glamsterdam item; not the Hegotá headliner.** |
| **State expiry** | Drop untouched state from nodes; users revive it with proofs. Would directly address the ~80% cold state | **Research.** Requires address-space extension. EF characterises full state expiry as deliberately *deferred* in favour of repricing + history expiry first. Years out. |
| **Statelessness (weak)** | Validators verify blocks with witnesses instead of storing state | **Research.** Depends on the tree transition landing first. |
| **State archive / partial statelessness** | Split hot state from cold historical state; nodes hold only part of state | EF flagged as a direction in Dec 2025; framed as "immediately useful and forward-compatible" groundwork, no dates. |

**The honest read:** the sequencing is explicit and public — *repricing and history expiry
now; binary trees and statelessness later.* "Later" has no date, is dependent on a tree
transition whose final design is not settled, and is being pursued alongside a
post-quantum redesign that adds risk rather than removing it. Verkle trees were the plan
for years and were dropped. **Assign zero relief from this category inside 24 months.** If
someone tells finance that "Ethereum is about to fix state growth," this table is the
rebuttal.

---

## 3. What we should do in the meantime

### 3.1 Stop buying one product called "archive node"

Our archive fleet is almost certainly serving several distinct workloads on identical,
uniformly expensive hardware. Split it:

1. **Recent-state RPC** — the overwhelming majority of query volume touches recent blocks.
   Serve from full nodes with a bounded history window. Cheapest tier, horizontally
   scalable, fast to rebuild.
2. **Deep historical state queries** (`eth_call`/`getBalance` at old blocks) — genuinely
   needs flat-state archive. Size this tier to actual measured demand, not to peak fear.
3. **Historical Merkle proofs** (`eth_getProof` at old blocks) — this is the expensive
   special case; see §3.2. Almost certainly needs only 1–2 nodes.
4. **Analytical / bulk history** — should not live in a node at all. Extract to columnar
   storage (ClickHouse or equivalent) on commodity disk, fed from era files and, post-
   Glamsterdam, from BALs. This tier's marginal cost per TB is an order of magnitude below
   NVMe-backed node storage.

Most of what we currently pay archive-node prices for belongs in tier 4.

### 3.2 Client-mix decisions, with the traps

- **Erigon** remains the archive footprint leader (~3–3.5 TB class). Default choice for
  tiers 2 and 4.
- **Geth path-based archive (v1.16+)** is ~2 TB and syncs in ~2 weeks instead of months —
  but **it cannot serve `eth_getProof` for historical blocks in v1.16.x.** In v1.17.x it
  can, *only* if you run `--history.trienode=N` to retain historical trie nodes, which
  pushes the footprint to **~6.5 TB**. If any customer-facing product depends on historical
  proofs, this is a hard architectural constraint, not a tuning flag. Isolate it to tier 3.
- **Reth** is in the same efficiency class and is worth running as a second implementation
  for correctness cross-checking on data we sell. Client diversity is cheap insurance for a
  data business; a single-client bug that corrupts published data is an existential-class
  incident.
- **Retire any remaining hash-based Geth archive.** At >20 TB and months-long sync it is
  pure liability.

### 3.3 Build for BALs and transfer-logs now — highest ROI item available

This is the concrete, bankable win in our window, and it is on the access side.

**EIP-7928 (BALs)** puts, in every block, the complete list of accounts and storage slots
touched *with their post-execution values*. That is a canonical, consensus-enforced state
diff, delivered in the block, for free. Today we reconstruct state diffs by running
`debug_traceBlock`-class calls against archive nodes — one of the most expensive things we
do, and a primary reason our archive fleet is sized the way it is.

**EIP-7708 (ETH transfers emit logs)** means plain ETH transfers — including those inside
contract calls — become visible via `eth_getLogs`. Today, tracking these requires tracing.
This eliminates an entire category of archive workload.

**Actions:**
- Prototype a BAL-driven state-diff indexer against the Platåberget testnet **now**, while
  we have months of lead time. Target: cut tier-2/tier-4 archive dependency substantially.
- Audit our pipeline for every use of `trace_block` / `debug_trace*` and classify each as
  (a) replaceable by BALs, (b) replaceable by 7708 logs, (c) genuinely needs tracing.
- Feed the result back into the fleet sizing in §4. If a large share is (a)+(b), the
  Glamsterdam capacity increase is materially offset by an *architecture* change rather
  than a hardware purchase. This is where our engineering time is best spent this quarter.

Caveat: both are contingent on Glamsterdam shipping. Build the new path alongside the old
one; do not decommission tracing capacity until the fork is live and validated.

### 3.4 Treat sync time as the primary operational risk, not disk

Disk is a purchase order. **Sync time is an outage.** A two-week archive resync that lands
on the critical path during an incident is far more damaging than the storage cost.

- Maintain **golden snapshots** in object storage, refreshed on a schedule, for every node
  class. Restore-from-snapshot must be a routine, tested, documented procedure — not
  something we improvise during an incident.
- Measure and track *time-to-restore* per node class as a first-class SLO. It will
  degrade as the chain grows; make that degradation visible before it bites.
- Prefer **scale-out over scale-up**. More medium nodes with tested rebuild paths beats
  fewer enormous nodes we cannot afford to lose.

### 3.5 Do the repricing compatibility work on a deadline

Per §2.2, EIP-8037/8038 break long-standing gas assumptions. Owner and due date needed for:

- Gas estimation / simulation endpoints we expose
- Any hardcoded `21000`, or assumptions about `SSTORE`/deployment costs
- Anything parsing or reasoning about the `GAS` opcode's return value
- Historical gas analytics that compare across the fork boundary — these will show a
  discontinuity that will look like a bug to customers unless we document it

Test against Platåberget / glam-devnet-8 and the public testnets from the Sepolia fork
(~21–28 Sept 2026) onward. **This work is due before the fork, and the fork date is not
under our control.**

### 3.6 Procurement posture under this uncertainty

- **Do not sign 36-month capex on fixed-capacity chassis.** The variance between our
  scenarios (§4.2) is roughly 2× on storage; committing to the low scenario risks a
  forced mid-term rebuild, and to the high scenario risks paying for idle NVMe.
- Prefer **expandable chassis with free drive bays**, or leases/colo with explicit
  expansion clauses, over dense fixed configurations.
- Amortise on **12–18 months**, not 36. Storage-per-dollar improves and the roadmap may
  change materially within a 36-month horizon.
- Push bulk historical data to **cheap object/columnar storage**, where cost per TB is an
  order of magnitude lower and capacity is elastic. This converts a capex guess into an
  opex dial.

---

## 4. Capacity model

### 4.1 First: measure our own fleet (this is a prerequisite, not a nicety)

Published archive figures disagree by nearly 2× (§1.4). Before finalising any number below,
we need, per node class:

- Total footprint, **broken down by** current state / history / state-diff or domain files
- Measured growth in TB per month over the last 12 months
- Time-to-full-sync and time-to-restore-from-snapshot
- Query mix by block-age bucket — how much traffic genuinely touches deep history?

That last one determines how much of the fleet can be moved down a tier, and it is the
cheapest lever we have.

### 4.2 Scenarios

**Assumptions (state these to finance explicitly):**
- Starting point: **3.25 TB** per Erigon-class archive node, Sept 2026 *(replace with our
  measured figure)*
- Current growth: **~1.4 TB/node/year** at 60M gas *(derived from published archive sizes
  across 2025–2026; must be validated against our telemetry)*
- Archive growth scales approximately linearly with gas actually consumed, **not** with the
  gas limit — validators can raise the limit faster than demand fills it
- Post-Glamsterdam state growth is capped near 120 GiB/yr, so most incremental growth is
  history/receipts/diffs

| Scenario | Assumption | Per node, Sept 2027 | Per node, Sept 2028 |
|---|---|---|---|
| **A — Aggressive** | Glamsterdam Q4 2026; gas limit to 150M+ by mid-2027; demand fills it | ~5.0 TB | **~8.5 TB (≈2.6×)** |
| **B — Central (plan to this)** | Glamsterdam Q1 2027; gas ramps to ~100–120M through 2027; demand lags the limit | ~4.7 TB | **~7.0 TB (≈2.2×)** |
| **C — Slow** | Glamsterdam slips to mid-2027; gas limit ramp conservative | ~4.6 TB | **~5.9 TB (≈1.8×)** |

**Plan capacity to B. Ensure the fleet can absorb A without a forklift upgrade** — that is
precisely what "expandable chassis, free bays, 12–18 month amortisation" buys us.

Note how narrow the range is at 12 months and how it widens at 24. That shape is the whole
argument for short amortisation: the decision-relevant uncertainty is all in year two, and
we will know far more about it by the dates in §5.

**Sensitivity:** the §3.3 BAL/7708 work can reduce the *number* of archive nodes we need
rather than the size of each. If a large fraction of our tracing workload is replaceable,
that is likely a bigger line-item saving than any per-node storage optimisation. Model it
as a headcount-of-nodes reduction in tiers 2 and 4.

**What is deliberately excluded:** any relief from state expiry, binary trees, or
statelessness. If Hegotá's November headliner selection surprises us (§5), we revisit —
but we do not budget for it now.

---

## 5. Watch list — dates that should trigger a re-plan

| Date | Event | Why it matters to us |
|---|---|---|
| **21–28 Sept 2026** | Glamsterdam Sepolia fork *(sources disagree on exact date)* | First public-testnet signal on schedule; start repricing compatibility testing |
| **4 Oct 2026** | Hegotá headliner **proposal** deadline | Watch whether binary trees / state expiry are even proposed |
| **5 Oct 2026** | Glamsterdam Hoodi fork | Second schedule checkpoint |
| **3 Nov 2026** | **Hegotá headliner selection** | ⭐ **The key signal.** If a tree transition or state expiry is selected, relief may enter a 2028 horizon. If (as expected) it is FOCIL + repricing, our zero-relief assumption is confirmed for the full window |
| **Q4 2026 (projected 4 Nov, unconfirmed)** | Glamsterdam mainnet | Starts the clock on both the throughput ramp and our BAL/7708 migration |
| **Post-Glamsterdam, continuous** | **Validator gas-limit signalling** | ⭐ **The real driver.** Track the actual limit and actual gas consumed weekly. This selects between scenarios A/B/C better than any roadmap announcement |
| **10 Dec 2026** | Hegotá EIP selection deadline | Confirms 2027 scope; watch EIP-7745/7668 (log index) for product impact |

**Standing recommendation:** revisit this brief after 3 Nov 2026 and again ~6 weeks after
Glamsterdam mainnet, when we have real gas-limit and real growth-rate data rather than
projections.

---

## 6. Sources

Protocol specs and official:
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-8372: Normalized state gas limit](https://eips.ethereum.org/EIPS/eip-8372)
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-7642: eth/69 — history expiry and simpler receipts](https://eips.ethereum.org/EIPS/eip-7642)
- [EIP-7745: Trustless log and transaction index](https://eips.ethereum.org/EIPS/eip-7745)
- [EIP-7927: History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927)
- [EIP-7773: Hardfork Meta — Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773)

Ethereum Foundation:
- [Glamsterdam Repricing Impact for Smart Contract Developers (24 Aug 2026)](https://blog.ethereum.org/2026/08/24/glamsterdam-repricing-testing)
- [Protocol Priorities Update for 2026 (18 Feb 2026)](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [Checkpoint #9: Apr 2026](https://blog.ethereum.org/2026/04/10/checkpoint-9)
- [Checkpoint #8: Jan 2026](https://blog.ethereum.org/2026/01/20/checkpoint-8)
- [Hegotá Upgrade EIP Proposal Timelines](https://blog.ethereum.org/2025/12/22/hegota-timeline)
- [Partial history expiry announcement](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [Fusaka Mainnet Announcement](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement)
- [ethereum.org — Glamsterdam roadmap](https://ethereum.org/roadmap/glamsterdam/)
- [ethereum.org — Statelessness roadmap](https://ethereum.org/roadmap/statelessness/) ⚠️ *stale, cites 2023 figures*

Clients and operations:
- [Geth: Archive mode documentation](https://geth.ethereum.org/docs/fundamentals/archive)
- [Chainstack: Erigon vs Geth in 2026 (updated 11 Mar 2026)](https://chainstack.com/ethereum-clients-geth-and-erigon/)
- [Paradigm: How to Raise the Gas Limit, Part 1 — State Growth](https://www.paradigm.xyz/writing/how-to-raise-the-gas-limit-1)

Schedule tracking and reporting:
- [EIPs Insight: Upgrade Schedule](https://eipsinsight.com/upgrade/schedule) *(only ACD-checkmarked dates are confirmed; rest are projections)*
- [ethdaily.io: Glamsterdam Hardfork Tracker](https://ethdaily.io/glamsterdam)
- [The Block: EF researchers warn of state bloat (18 Dec 2025)](https://www.theblock.co/post/383156/ethereum-foundation-researchers-warn-of-storage-burden-from-state-bloat)
- [The Block: Ethereum raises block gas limit to 60M](https://www.theblock.co/post/380687/ethereum-block-gas-limit-fusaka)
- [The Block: Developers name post-Glamsterdam upgrade 'Hegota'](https://www.theblock.co/post/383275/ethereum-developers-name-post-glamsterdam-upgrade-hegota-as-2026-roadmap-takes-shape)
- [CryptoSlate: Glamsterdam slips to late 2026 (17 Aug 2026)](https://cryptoslate.com/ethereums-next-major-upgrade-just-slipped-to-late-2026-forcing-a-two-week-scramble-to-save-its-2027-roadmap/)
- [CoinDesk: Ethereum's next upgrade breaks the '21,000 gas' rule (18 Aug 2026)](https://www.coindesk.com/tech/2026/08/18/ethereum-s-next-upgrade-breaks-the-21-000-gas-rule-wallets-rely-on)
