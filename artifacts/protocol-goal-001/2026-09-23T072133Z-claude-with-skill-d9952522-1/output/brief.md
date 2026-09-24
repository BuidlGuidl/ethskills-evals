# Ethereum State Growth: Technical & Capacity Planning Brief

**Prepared:** 23 September 2026
**Planning window:** Q4 2026 – Q3 2028 (24 months)
**Audience:** infrastructure engineering + finance

---

## 0. Executive summary

1. **State growth is a protocol-design problem, and for the first time the protocol is doing
   something concrete about it.** Ethereum's next hard fork, **Glamsterdam**, contains two
   scheduled EIPs (**EIP-8037** and **EIP-8038**) that raise the cost of *creating* state by
   roughly **5–8x** and meter it in a separate gas dimension with an explicit budget of
   **~120 GiB of new state per year**. This is the single most important protocol fact for our
   capacity plan.

2. **That relief is real but it is aimed at full nodes, not at us.** EIP-8037 bounds the growth
   rate of the *live* state. An archive node's disk is dominated by the *history of state
   changes*, which no scheduled protocol change shrinks. **Nothing on the confirmed roadmap
   reduces archive node disk usage.**

3. **Glamsterdam also unblocks a gas limit increase from 60M toward 150–200M.** The whole point
   of the repricing is to make higher throughput safe. Higher throughput means more state
   *transitions* per year, which is exactly what our archive disks accumulate. **Our archive
   growth rate is more likely to go up than down during the planning window**, even as full-node
   state growth is brought under control.

4. **The structural fix — replacing the hexary Merkle Patricia Trie with a binary tree — is
   real, actively specified, and outside our window.** EIP-8297 (Partitioned Binary Tree) and
   EIP-8347 (its migration spec) have **no fork relationship at all**. The Ethereum Foundation's
   own September 2026 plan places the state work at fork **I\***, which is two forks after
   Glamsterdam, and says the migration *"continues beyond it."* Realistic earliest mainnet:
   **late 2028 at best, more likely 2029.** **Budget zero relief from this inside 24 months.**

5. **Recommended posture:** buy hardware on the assumption that nothing about archive economics
   improves at the protocol level before Q4 2028, and capture the available savings from the
   *client* layer instead (Geth path-based archive / Erigon 3 / Reth), which is where the last
   two years of real archive savings actually came from.

**Bottom line for finance:** plan and fund as if the protocol gives us nothing. Treat every
protocol improvement below as upside, not as a line item.

---

## 1. What is actually driving this at the protocol level

### 1.1 The data structure

Ethereum's world state is a **hexary Merkle Patricia Trie (MPT)**, keccak-hashed, with a
*separate storage trie per contract account* anchored under each account leaf. Three properties
of this design drive our costs:

- **Fan-out of 16.** Every trie node holds up to 16 children. A proof or an update touches
  `log16(N)` levels, but each level is a 16-wide node that must be hashed in full. The result is
  high **write amplification**: one storage-slot write dirties a path of nodes in the storage
  trie *and* a path in the account trie, and every one of those nodes is re-hashed and
  re-persisted.
- **Keccak-ordered keys.** Trie keys are hashes, so logically adjacent data (one contract's
  slots, one user's balances) lands at random positions in the key space. This destroys locality
  and turns state access into effectively random I/O against the database — which is why
  archive nodes are NVMe-bound rather than throughput-bound.
- **No expiry.** A storage slot written once in 2017 is retained, in full, forever, by every
  node. There is no mechanism today for state to age out.

### 1.2 What is in the state, and how big it is

Public measurements as of 2026:

| Component | Share of state |
|---|---|
| Contract storage slots | ~82% |
| Accounts | ~14% |
| Contract bytecode | ~4% |

Within contract storage, **ERC-20 (~27%) and ERC-721 (~22%)** balances dominate, because every
`(token, holder)` pair is its own 32-byte slot with its own trie path. Roughly **half of
Ethereum's entire state is token balance mappings.**

Rough scale figures (verify against our own fleet before using in a model):

- Live state, flat representation: **~245 GiB**
- Live state growth: **~100 GB/year** at the current 60M gas limit
- Full node (execution client, post history-expiry): **~0.9–1.3 TB**
- Archive node: **~1.8–2.2 TB** (Erigon 3), **~2.8 TB** (Reth), **~1.9–2.0 TB** (Geth
  path-based archive), **~18–20 TB** (legacy Geth hash-based archive)

### 1.3 Why our archive nodes grow faster than "state growth"

This distinction matters for the budget and is easy to get wrong:

- **Live state size** = the current value of every account and slot. Grows only when *new* state
  is created. This is what EIP-8037 caps.
- **Archive state** = every *intermediate* value of every account and slot, for every block.
  Grows with **the rate of state modification**, not state creation. Overwriting the same
  storage slot a million times adds nothing to live state and a million entries to our archive.

Consequences:
- The headline "~100 GB/year state growth" figure **understates our archive growth** and should
  never be used directly in our model.
- A gas limit increase from 60M to 150M raises the ceiling on state *modifications* per block
  roughly proportionally. **Archive growth scales with the gas limit almost linearly**, and the
  protocol has no mechanism that bounds it.
- The Glamsterdam repricing helps us only second-order: making state operations more expensive
  reduces how many of them fit in a block at a given gas limit.

### 1.4 Why sync times get worse

Sync time is a function of **random-read latency against a trie that no longer fits in page
cache**, plus trie healing at the end of snap sync. Both degrade superlinearly with state size.
Glamsterdam does contain networking-layer work targeting exactly this (see §2.3), which is the
most under-discussed win in the fork for an operator like us.

---

## 2. What is coming to the protocol, and how much to bank on it

Status vocabulary (Ethereum core-dev process):

- **Live** — active on mainnet.
- **SFI** (Scheduled for Inclusion) — committed to a named fork; timing can still move.
- **CFI** (Considered for Inclusion) — under evaluation for a named fork, not committed.
- **PFI** (Proposed for Inclusion) — proposed to a fork, no commitment.
- **DFI** (Declined for Inclusion) — rejected for that fork.
- **No fork relationship** — research/proposal only. No date exists.

Note: an EIP's own header status (`Draft`, `Review`, `Final`) describes *specification maturity*
and says **nothing** about whether it will ship. Several EIPs below are `Draft` and scheduled;
others are `Final` and going nowhere.

### 2.1 Already live — the relief we have already banked

| Change | Status | Effect on us |
|---|---|---|
| **Partial history expiry (EIP-4444 phase 1)** | **Live** since May 2025, all EL clients | Allows dropping pre-Merge block bodies and receipts: **~300–500 GB saved per node**. If any node in our fleet is not running with pre-Merge history pruned, that is free money on the table today. |
| **Fusaka** (EIP-7594 PeerDAS + 12 others) | **Live**, 3 December 2025 | Blob data availability moved to sampling; gas limit default standardised at 60M (EIP-7935). Blob storage cost per node fell, but this is L2 data, not state. |

### 2.2 Glamsterdam — SFI, projected **2 December 2026**

Current status: devnet series complete, now on public testnets.
**Sepolia: 6 October 2026. Hoodi: ~27 October 2026. Mainnet: projected 2 December 2026.**
No mainnet epoch has been published yet.

**Confidence: high on scope, medium on date.** Two headliners (ePBS and BALs) are the largest
change since the Merge, and a slip to Q1 2027 would surprise nobody. **Plan for scope; do not
plan for the date.** Assume Q1 2027 in the model and treat December 2026 as upside.

State-relevant scheduled (SFI) contents:

| EIP | What it does | Impact on us |
|---|---|---|
| **EIP-8037 — State Creation Gas Cost Increase** | Introduces **two-dimensional gas metering**: a separate `state_gas` reservoir alongside execution gas, at **1,530 gas per new state byte** (CPSB). New account: 25,000 → **183,600 gas (~7x)**. New storage slot: 20,000 → **97,920 gas (~5x)**. 24 kB contract deploy: 4.9M → **37.8M gas (~8x)**. Explicitly targets **120 GiB/year** of new state at a 150M reference gas limit. | **The single most consequential item in this brief.** Caps live-state growth as the gas limit rises. Indirect, partial benefit to archive growth. |
| **EIP-8038 — State-access gas cost update** | Raises the cost of `SSTORE`, `SLOAD`, cold account access, `EXTCODESIZE`/`EXTCODECOPY` to match measured performance at today's state size. First state repricing since **Berlin (2021)**. | Reduces state I/O per unit of gas. Directly reduces archive diff volume per block. |
| **EIP-7928 — Block-Level Access Lists** (headliner) | Publishes all state accessed by a block up front, enabling parallel execution and parallel state prefetch. | Enables faster block processing; prerequisite for the gas limit increase. Also enables EIP-8189 below. |
| **EIP-7732 — Enshrined PBS** (headliner) | Consensus-layer block production split. | Neutral for disk. Relevant if we run validators. |
| **EIP-7976 / EIP-7981 / EIP-2780 / EIP-7778** | Calldata floor cost increase; access-list repricing; resource-based intrinsic tx gas; block gas accounting without refunds. | Collectively bound worst-case block size and close gas-limit circumvention paths. |
| **EIP-7954 — Increase Maximum Contract Size** | 24 KiB → **64 KiB** code, 48 KiB → 128 KiB initcode. | **Mildly negative** for state size, deliberately offset by EIP-8037's per-byte deploy cost. |
| **EIP-7708 — ETH transfers emit a log** | Every ETH transfer, including internal ones, emits a log. | **Directly relevant to a data company.** Large increase in log/receipt volume. Removes the need for `debug_traceTransaction` to find ETH movements — a **significant simplification and cost reduction for our indexing pipeline**, at the price of larger receipt/log indexes. Worth a dedicated design review before December. |

**Declined for Glamsterdam** (i.e. do not count on these): **EIP-8032** (size-based storage gas
pricing), **EIP-7907** (metered contract code size), **EIP-7745** (trustless log and transaction
index), **EIP-7668** (remove bloom filters).

### 2.3 Glamsterdam networking changes — the sync-time win

These are networking-layer (not consensus) and therefore ship alongside the fork with less
schedule risk:

- **EIP-8189 — `snap/2`: BAL-Based State Healing.** Replaces trie-node healing in snap sync with
  block-access-list-driven state catch-up. Trie healing is the long, unpredictable tail of a
  snap sync today. **This is the most likely source of a measurable sync-time improvement in our
  window.**
- **EIP-7975 — `eth/70`: partial block receipt lists.** Paginated receipt fetching in the p2p
  protocol; reduces sync bandwidth and memory spikes.

**Action:** these should be explicitly benchmarked on our own hardware during the Hoodi testnet
window in late October, not after mainnet.

### 2.4 Hegotá — the fork after Glamsterdam

Headliners are **SFI**: **EIP-7805 (FOCIL)** and **EIP-8141 (Frame Transactions)** — censorship
resistance and native account abstraction. **Neither addresses state growth.**

Timing: the EF states client teams can begin implementation in **late Q4 2026**, and models
fork cadences of **7.2 to 12 months**. Realistic range: **Q3 2027 – Q1 2028**. Explicitly *not*
confirmed.

State-relevant items, all **PFI only** (proposed, uncommitted), with EF Protocol tier grades
from its 7 September 2026 tier list of 62 proposals:

| EIP | What it does | Tier / status | Read |
|---|---|---|---|
| **EIP-8368 — CPSB Recalibration** | Re-derives EIP-8037's cost-per-state-byte for a new reference gas limit | **TBD** — deliberately unranked | Explicitly waiting on post-Glamsterdam mainnet data. Signals the state budget **will be retuned** once Glamsterdam produces evidence — direction unknown. |
| **EIP-8372 — Normalized state gas limit** | Rebalances state-gas vs execution-gas utilization | **TBD** | Same. Decided jointly with 8368. |
| **EIP-7709 — BLOCKHASH from storage** | Prerequisite for further history expiry | **B-tier**, "real value for the history-expiry direction" | On the bubble. Could reach A-tier if devnets run clean. |
| **EIP-8253 — Bump nonce of zero-nonce storage accounts** | Simplifies the future trie migration | **B-tier**, under review for A | **A leading indicator.** If this ships in Hegotá, trie migration prep is genuinely moving. |
| **EIP-8383 — Reduce CL block retention window** | Beacon block retention → 8192 epochs | **A-tier** | Consensus-client disk reduction. Modest, real. |
| **EIP-8188 — Last-written block for accounts and slots** | State-repricing / expiry primitive | **DFI** — *"waits for the I\* trie-migration design"* | **The clearest statement available that state expiry is not happening in this window.** |
| **EIP-7668 / EIP-8116 / EIP-8304** | Bloom filter removal, receipt format change, trustless log index | **C-tier / DFI** | All deferred to "the broader history and logs work," which has no fork. |

### 2.5 The structural fixes — **no fork relationship**

This is the section to read before approving any hardware deferral.

| Proposal | Status | Assessment |
|---|---|---|
| **EIP-8297 — Partitioned Binary Tree** | `Draft`, created 11 June 2026, **no fork relationship** | The current front-runner. Binary tree, RLP removed, **content-addressed code deduplication** (identical contracts share one leaf), zone-partitioned key space. Authored by Buterin plus 11 contributors. Under differential devnet testing (Geth, Erigon tracking issues open). |
| **EIP-8347 — Offline State Migration to the PBT** | `Draft`, **no fork relationship** | The migration plan: convert state off the consensus-critical path at a finalized anchor, distribute a verifiable snapshot, catch up by replaying BALs, swap the commitment at one fork. Mature thinking, unscheduled. |
| **EIP-7864 — Unified binary tree** | `Draft` since January 2025, **no fork relationship** | The earlier design; largely superseded by 8297. Still cited in press coverage as imminent. **It is not.** |
| **State expiry** | No EIP, no fork | EIP-8297 notes state expiry is a "natural operation" enabled by its zone topology, with specifics **deferred to separate proposals that do not exist yet**. |
| **Full/rolling history expiry (EIP-4444 phase 2)** | `Draft`, **no fork relationship**; meta-EIP 7927 is **Stagnant** | Phase 1 (pre-Merge) is live. Rolling-window expiry needs an agreed window size (~1M blocks discussed) and tested post-Merge data recovery. **No timeline set.** Would not help archive nodes anyway — retaining history is the product. |

**The authoritative timing statement**, from the Ethereum Foundation Protocol cluster,
7 September 2026:

> "The state arc keeps state growth and access from becoming Ethereum's binding constraint. Its
> work includes migrating to a new trie, sustainable state growth, and decentralized access to
> current and historical state. **The largest design and migration work is expected to begin in
> I\* and continues beyond it.**"

**Decoding `I*`:** the EF labels unnamed future forks by letter. `I*` is **two forks after
Glamsterdam** (Glamsterdam → Hegotá → I\*). At the EF's own stated cadences of 7.2–12 months per
fork, and starting from a December 2026 Glamsterdam:

- 7.2-month cadence (described by the EF itself as *"quite aggressive"* and leaving *"little room
  for error"*): I\* ≈ **Q1 2029**
- 12-month cadence: I\* ≈ **Q4 2028**

Either way the migration *begins* after our window closes, and "continues beyond it."

**Additional schedule pressure to be aware of:** the EF has a self-imposed commitment to make
Ethereum L1 quantum-resistant by **December 2029**, with post-quantum milestones occupying
I\* through L\*. Post-quantum work and the state migration are **competing for the same client
engineering capacity** in the same forks. If anything slips, the state arc is the more likely
casualty — PQ has a hard external deadline and state growth does not.

### 2.6 The gas limit — the risk running the other way

The explicit purpose of the Glamsterdam repricing is to make a gas limit increase safe.
Discussion targets **150M as a reference point and 200M as the destination**, up from 60M today.

- Published analysis: at a **200M gas limit without EIP-8037**, annual state growth would be
  **~387 GiB**, breaching the ~650 GiB threshold at which node performance degrades. EIP-8037
  exists to hold growth near **120 GiB/year at a 150M reference limit**.
- **EIP-8261 (Gas Limit Schedule)** is **Informational and non-binding** — it changes no
  consensus rules and a block with a different gas limit remains valid. Its illustrative ramp is
  60M → 75M → 90M across epochs. The gas limit is a **validator-set social parameter**, not a
  protocol constant, and can move at any time without a fork.

**This is the largest single uncertainty in our model.** The gas limit can rise between forks,
with no hard fork and limited notice. Our archive growth rate is roughly proportional to it.

---

## 3. Planning assumptions

### 3.1 What to write into the model

| Assumption | Value | Confidence |
|---|---|---|
| Glamsterdam mainnet | **Q1 2027** (projected 2 Dec 2026; assume one quarter of slip) | Medium-high |
| Live-state growth capped near 120 GiB/yr at 150M gas | From Q1 2027, **if** EIP-8037 performs as specified | Medium |
| Gas limit trajectory | 60M today → **90–150M during 2027**, 200M possible by 2028 | Medium; **no fork required, can move any time** |
| **Archive disk growth rate** | **Flat to +50% vs today**, scaling with the gas limit; repricing provides partial offset | **Low — model a range, not a point** |
| Binary tree / state expiry relief | **None before Q4 2028**. Model **zero**. | High |
| Rolling history expiry | **No date**. Model zero. Irrelevant to archive regardless. | High |
| Sync-time improvement from `snap/2` + `eth/70` | Real but unquantified; **benchmark, don't assume** | Medium |

**Recommended sizing rule:** procure archive capacity for **24 months at 1.5x our current
measured growth rate**, not at the current rate and not at a protocol-improved rate. The gas
limit is the dominant term and it can move without warning.

### 3.2 The honest framing for finance

> Ethereum is, for the first time, shipping a direct fix for state growth — in the fork landing
> around the end of this year. But that fix protects *full* nodes, and it is being spent
> immediately on a 2.5–3x throughput increase. The structural fix that would help *archive*
> nodes is two forks and roughly two to three years away, competing for engineering capacity
> against a hard post-quantum deadline. **We should assume our archive cost curve does not
> improve before 2029, and that it may steepen.**

---

## 4. Recommendations

### 4.1 Immediate (next 30 days)

1. **Audit history expiry across the fleet.** Every execution client has supported pre-Merge
   history pruning since May 2025 — **300–500 GB per node**. Confirm it is enabled everywhere it
   is safe. On full nodes this is free; on archive nodes evaluate whether we actually need
   pre-Merge bodies and receipts or can serve them from a single designated node or cold
   storage.

2. **Segment the fleet by what each node is actually for.** Almost no workload needs a true
   archive node. Split into:
   - **Full nodes** (recent state + execution) — the large majority; cheapest to run and the
     only tier the protocol roadmap actually helps.
   - **Archive nodes with flat historical state** — serves historical `eth_call` /
     `eth_getBalance` at a block. **~2 TB.**
   - **Archive nodes with historical trie data** — needed only for historical
     `eth_getProof`/Merkle proofs. **~6.5 TB.** Run the minimum count that meets demand,
     ideally one or two, not a fleet default.

   **This segmentation is the largest available cost reduction and requires no protocol change.**
   Quantify how many requests actually need historical Merkle proofs before sizing this tier.

3. **Measure our own growth curve.** Instrument per-client, per-tier daily disk delta and hold
   12 months of history. Every public number in §1.2 is indicative; **our workload determines
   our curve**, and finance needs a measured trend line, not a blog figure.

### 4.2 Client strategy (next quarter)

4. **Move archive nodes off legacy hash-based Geth archive.** The gap is **~18–20 TB vs
   ~2 TB** — an order of magnitude, available today, with no protocol dependency.
   - **Geth path-based archive** (shipped January 2026): ~1.9–2.0 TB, stores historical state as
     reverse diffs. **Caveat: does not yet support historical Merkle proofs (`eth_getProof`).**
     Verify against our RPC traffic before committing.
   - **Erigon 3:** ~1.8–2.2 TB; separate RPC daemon that holds up under load. The pragmatic
     default for archive.
   - **Reth:** ~2.8 TB; worth running for client diversity and for its extensibility if we build
     custom indexing.

   **Recommendation: standardise archive on Erigon 3, with Reth as the diversity client, and
   evaluate Geth path-based archive only where `eth_getProof` is not required.**

5. **Stop treating "archive node" as the answer to historical data questions.** For a data
   company, purpose-built indexes derived from archive output are dramatically cheaper per query
   than general-purpose archive RPC. Every workload moved off archive RPC onto our own index is
   permanent, protocol-independent savings.

### 4.3 Glamsterdam readiness (Oct–Dec 2026)

6. **Run Hoodi from the late-October fork.** Benchmark on our own hardware, before mainnet:
   - sync time with `snap/2` BAL-based healing vs today's trie healing;
   - archive disk delta per block under BALs;
   - receipt/log index growth under **EIP-7708** (ETH transfers emit a log).

7. **Plan the EIP-7708 pipeline change now.** This is a genuine win for us: ETH transfer
   detection stops requiring transaction tracing. It also inflates log volume. Both effects hit
   on day one of the fork. **Owner and design review needed before December.**

8. **Budget for the gas limit, not the fork.** Post-Glamsterdam, watch the *validator-set gas
   limit*, not the fork schedule. Set an alert on the realised block gas limit and treat each
   step up as a capacity trigger. This is the parameter that will actually consume our headroom,
   and it moves without a fork.

### 4.4 Watch items (leading indicators, review quarterly)

Re-check these each quarter; all are observable on forkcast.org:

- **EIP-8253** moving from B-tier to A-tier / SFI in Hegotá → trie migration prep is real.
- **EIP-8297 / EIP-8347** acquiring *any* fork relationship → the first credible date for
  structural relief. Until then there is no date.
- **EIP-8368 / EIP-8372** resolving from TBD after Glamsterdam mainnet data → tells us whether
  the state budget tightens or loosens.
- **Hegotá's actual cadence.** If Hegotá lands inside 7–9 months of Glamsterdam, the EF's
  aggressive schedule is holding and I\* in early 2029 is credible. If it takes 12+ months,
  push structural relief to 2030 in the model.
- **A rolling-window size agreement for EIP-4444 phase 2** → matters for our full-node tier, not
  archive.

---

## 5. Caveats on this brief

- **Disk-size figures are indicative**, drawn from vendor and community measurements in 2026.
  They vary by client version, database backend, and workload. Recommendation 3 exists precisely
  because our own measurements should replace them in the financial model.
- **Fork dates are projections, not commitments.** Glamsterdam's 2 December 2026 date is a
  projection; no mainnet epoch has been published. Hegotá and I\* have no dates at all, only
  cadence models the EF itself flags as aggressive.
- **Press coverage of Ethereum roadmap items is unreliable.** During research for this brief,
  multiple outlets described EIP-7904 as a "78.6% fee reduction via gas repricing." EIP-7904 is
  in fact **Informational and specifies no gas schedule changes at all** — its original
  repricing motivation was dropped after client-side optimisations from EIP-7928. Several
  outlets also place the binary tree in Glamsterdam or Hegotá; it is in neither. **Verify
  against forkcast.org and the EIP text before acting on any roadmap claim, including this one.**
- **The plan above holds if none of the future proposals ship.** Every recommendation in §4 is
  either already available or client-side. No line item depends on a protocol change.

---

## 6. Sources consulted (23 September 2026)

**Fork status and scope**
- [Forkcast — Glamsterdam](https://forkcast.org/upgrade/glamsterdam) and
  [Hegotá](https://forkcast.org/upgrade/hegota) (per-EIP fork relationships and statuses;
  Glamsterdam projected activation 2026-12-02)
- [EF Protocol: The Hegotá EIP Opinion Post and Tier List](https://blog.ethereum.org/en/2026/09/07/protocol-hegota-eips) — 7 Sep 2026, 62 EIPs tiered
- [EF Protocol: Current and Emerging Priorities](https://blog.ethereum.org/2026/09/07/protocol-priorities) — 7 Sep 2026, the "state arc" and I\*/J\*/K\*/L\* cadence
- [Glamsterdam Repricing Impact for Smart Contract Developers](https://blog.ethereum.org/2026/08/24/glamsterdam-repricing-testing) — 24 Aug 2026, EIP-8037/8038
- [Fusaka Mainnet Announcement](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement) — activated 3 Dec 2025
- [Ethereum targets 6 October for Glamsterdam Sepolia fork](https://cryptopotato.com/ethereum-targets-october-6-for-glamsterdam-sepolia-fork/) — from ACDC, 17 Sep 2026

**EIP specifications**
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-8261: Gas Limit Schedule](https://eips.ethereum.org/EIPS/eip-8261) (Informational)
- [EIP-7904: Compute Gas Cost Analysis](https://eips.ethereum.org/EIPS/eip-7904) (Informational; no gas changes)
- [EIP-8297: Partitioned Binary Tree](https://eips.ethereum.org/EIPS/eip-8297) (Draft, unscheduled)
- [EIP-7864: Unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) (Draft, unscheduled)
- [EIP-4444: Bound Historical Data in Execution Clients](https://eips.ethereum.org/EIPS/eip-4444) (Draft, unscheduled)
- [EIP-7927: History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927) (Stagnant)

**History expiry and state composition**
- [Partial history expiry announcement](https://blog.ethereum.org/2025/07/08/partial-history-exp) — EF, phase 1 live
- [How to Raise the Gas Limit, Part 1: State Growth](https://www.paradigm.xyz/writing/how-to-raise-the-gas-limit-1) — Paradigm, state composition

**Node sizing**
- [Archive mode — go-ethereum docs](https://geth.ethereum.org/docs/fundamentals/archive) (~2 TB flat state; ~6.5 TB with historical trie data)
- [Erigon vs Geth in 2026](https://chainstack.com/ethereum-clients-geth-and-erigon/) — Chainstack
- [Ethereum Archive Node Disk Size 2026](https://www.7blocklabs.com/blog/ethereum-archive-node-disk-size-2026-vs-erigon-archive-node-disk-size-2026-vs-geth-full-node-disk-size-2026) — 7BlockLabs
