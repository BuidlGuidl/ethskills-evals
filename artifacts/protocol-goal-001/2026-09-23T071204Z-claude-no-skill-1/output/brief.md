# Ethereum State Growth: Technical & Capacity Brief

**Date:** 23 September 2026
**Audience:** Infrastructure team + Finance
**Planning window:** Q4 2026 – Q4 2028 (24 months)

---

## 0. Bottom line up front

1. **No protocol change that structurally fixes state growth will land inside our planning
   window.** The tree-replacement and statelessness work (binary state tree, EIP-7864) is
   real and progressing, but it is not scheduled for either of the next two forks. The fork
   after next — Hegotá — published its EIP tier list on 7 September 2026 and it contains
   **no state-growth headliner at all**; the headliners are censorship resistance (FOCIL)
   and native account abstraction. Realistic earliest mainnet for a tree swap is 2028+,
   i.e. at or past the far edge of our window, and we should budget as if it is not coming.

2. **The one protocol change that *does* help is a gas repricing, and it is a brake, not a
   reversal.** Glamsterdam includes EIP-8037 (state *creation* repricing) and EIP-8038
   (state *access* repricing), both scheduled for inclusion. EIP-8037 explicitly targets
   **~120 GiB/year of new state** as a design goal. That is *roughly today's rate*. It is
   designed to hold the line while throughput triples — not to shrink anything.

3. **The same fork that brakes state growth also steps on the accelerator.** Glamsterdam's
   real purpose is to make a gas limit of 150M–200M safe (up from 60M today). Without
   EIP-8037, a 200M limit projects to **~387 GiB/year** of state growth. With it, we land
   in the 80–240 GiB/year band depending on where validators actually set the limit. **Our
   downside case is therefore worse than our current run-rate, not better.**

4. **The biggest lever available to us in this window is not protocol, it is client
   configuration.** Geth's path-based archive mode (v1.16+) takes a mainnet archive node
   from **>20 TB to ~2 TB** of flat state history, and sync from months to ~2 weeks. If any
   of our archive fleet is still on hash-based `--gcmode=archive`, that migration is the
   single highest-ROI action on this list and it is available today. Caveat: historical
   `eth_getProof` requires Geth v1.17.x **and** `--history.trienode=N`, which pushes the
   footprint back toward ~6.5 TB. That turns "do we sell historical proofs?" into a real
   budget line item.

5. **Recommended planning posture:** budget for **~150–250 GiB/year of new state per node**,
   assume **no relief from the protocol**, assume **Glamsterdam slips**, and spend the
   savings from the pathdb archive migration on tiering our historical-proof capability
   rather than on uniformly bigger disks.

---

## 1. What is actually driving this at the protocol level

### 1.1 The state is a permanent, unpruneable, write-amplifying data structure

Ethereum's world state is a **hexary Merkle Patricia Trie (MPT)** keyed by `keccak256` of
the account address, with each contract account pointing at its own storage MPT keyed by
`keccak256` of the slot. Three properties of that design generate our costs:

- **Keys are hashes, so writes are uniformly random.** Two storage slots written by the same
  contract in the same transaction land in unrelated parts of the trie. Every state write
  therefore dirties a path of trie nodes from leaf to root, and the disk access pattern is
  effectively random I/O across the whole keyspace. This is why archive nodes are IOPS-bound
  and why they degrade non-linearly as state grows — it is a working-set problem, not a
  capacity problem.

- **Hexary branching is space-inefficient.** Each branch node carries 16 child slots. The
  trie node overhead is a large multiple of the underlying account/slot payload. This is
  precisely what the binary-tree proposal (§2.3) attacks; a binary layout yields Merkle
  branches roughly **4x shorter**.

- **Nothing ever expires.** A storage slot written once in 2017 by a dead contract is still
  in the state root today and must be carried by every full node forever. There is no
  eviction, no TTL, no rent. State is monotonic by construction.

### 1.2 Gas has been systematically underpricing permanent storage since 2021

State operation costs were last repriced in **Berlin (2021)**. Since then the state has grown
several-fold, meaning the real marginal cost of adding a state entry has risen substantially
while the gas price of doing so has been flat. Concretely, under today's schedule:

| Operation | Today | Real cost basis |
|---|---:|---|
| Create a new account | 25,000 gas | ~120 bytes of permanent state |
| Create a new storage slot (`SSTORE` 0→nonzero) | 20,000 gas | ~64 bytes of permanent state |
| Deploy bytecode | 200 gas/byte | 1 byte of permanent state |

As the EIP-8037 rationale puts it, permanent storage is the resource Ethereum nodes can
least afford to give away — and it is currently the most heavily discounted one. **This is
the root cause.** The trie shape determines how expensive each entry is to carry; the gas
schedule determines how many entries get created.

### 1.3 Gas limit increases translate almost linearly into state growth

This is the part most relevant to forecasting. When the mainnet gas limit went from 30M to
60M, **daily new state rose roughly 3x** — i.e. *super*-linearly, because the marginal gas
freed up by a limit increase is disproportionately consumed by state-creating activity
(airdrops, NFT mints, token distribution, spam) rather than by pure compute. Any forecast
that models state growth as flat while throughput rises is wrong.

### 1.4 Why *archive* nodes specifically hurt

An archive node is carrying three distinguishable things, and clients now let us pay for them
separately. Understanding the split is what makes the cost tiering in §4 possible:

| Component | What it is | Needed for |
|---|---|---|
| **Current state** | The live trie at head | Everything |
| **Historical flat state** | Account/slot *values* at every past block | `eth_call`, `eth_getBalance`, `debug_trace*` at historical blocks |
| **Historical trie nodes** | The *proof structure* at every past block | `eth_getProof` at historical blocks — and essentially nothing else |
| **Historical blocks/receipts** | Block bodies and receipts | `eth_getBlockByNumber`, log queries, `eth_getTransactionReceipt` |

The legacy hash-based archive mode stored historical trie nodes for every block, which is
where the >20 TB figure and multi-month sync times came from. **The overwhelming majority of
archive workloads never touch historical trie nodes.** We were, in effect, paying a ~3x disk
premium for a feature most consumers of our API do not use.

---

## 2. What is coming from the protocol, and how much to bank on it

Graded by whether we should put it in a budget.

### 2.1 Already shipped — bank on it, and make sure we have actually collected it

**Partial history expiry (EIP-4444 phase 1 / EIP-7642), live since 1 May 2025.**
All execution clients can drop pre-merge block bodies and receipts. Worth **300–500 GB per
node**. Clients are no longer required to serve pre-merge bodies/receipts over devp2p or
JSON-RPC and may return errors. Pre-merge *headers* are still served.

> **Action item / commercial risk:** this is a one-time saving we may or may not have taken.
> It also means **our upstream peers may already be refusing to serve pre-merge data**. If
> any of our product surface promises pre-merge receipts or logs, we now own that data
> ourselves — via Era1 files or the Portal Network — because the p2p layer no longer
> guarantees it. Verify this before it becomes a customer-facing incident.

**Fusaka, activated 3 December 2025.** Raised the default gas limit to ~60M (EIP-7935) and
shipped PeerDAS, followed by two blob-parameter-only forks (BPO1 on 9 Dec 2025 → target 10 /
max 15 blobs; BPO2 on 7 Jan 2026 → target 14 / max 21). **Note for disk planning:** blobs are
not state and expire after ~18 days, but they are a real, growing steady-state footprint of
roughly 100–150 GB on the consensus side. Budget it separately; it does not compound.

**Geth path-based archive mode (v1.16+).** See §4.1. This is client-side, not a fork, so
there is no governance risk — it is available today.

### 2.2 Scheduled but slipping — plan for it, do not depend on the date

**Glamsterdam** (Gloas CL + Amsterdam EL). Headliners: **EIP-7732** (enshrined proposer-builder
separation) and **EIP-7928** (Block-Level Access Lists). Ships alongside the repricing cluster
under the EIP-8007 umbrella.

**Timing is the live risk.** As of late September 2026 this fork has slipped repeatedly:
roughly nine sequential devnets failed to finalize under the full rule set, and Devnet-11
(~84,000 validators) is the current gate. Public reporting puts **mainnet at December 2026 at
the earliest**, contingent on Devnet-11 achieving stable finality. Earlier guidance of "H1 2026"
and "end of August 2026" has already been missed twice. Note that some secondary sources you
may encounter still quote those stale dates — treat anything claiming H1/Q3 2026 as out of date.

**Assume Q1–Q2 2027 for planning.** Treat December 2026 as an optimistic case.

What it does for and against us:

| EIP | Status | Effect on our disk |
|---|---|---|
| **EIP-8037** — state creation repricing | Scheduled for inclusion | **Helps.** Two-dimensional gas accounting splitting execution-gas from state-gas, at 1,530 gas per byte of state created. New account: 25,000 → **183,600** state gas. New storage slot: 20,000 → **97,920** state gas. Bytecode deposit charged per byte. Design target: **120 GiB/yr at a 150M gas limit.** Notably, state gas is consumed **even if the frame reverts** — this closes a real spam vector. |
| **EIP-8038** — state access repricing | Scheduled for inclusion | **Helps indirectly.** `SSTORE` writes 2,800 → 10,000; cold account access → 3,000; `SLOAD`, `EXTCODESIZE`/`EXTCODECOPY` up. Prices access to reflect measured performance at current state size, which reduces the I/O amplification we feel most. |
| **EIP-7976** — calldata repricing | Included | Neutral-to-helpful (10/40 → 64/64 gas per byte). |
| **EIP-7981** — access list surcharge | Included | Neutral (64 gas/byte). |
| **EIP-7778** — refunds excluded from block accounting | Included | Helpful; removes a gas-accounting distortion. |
| **EIP-7928** — Block-Level Access Lists | Headliner | **Mixed.** Adds a per-block data structure we must store, but enables parallel disk reads and "executionless sync" — a syncing node can apply post-execution state values without replaying every transaction. Net positive for **sync time**, mildly negative for bytes. |
| **Gas limit → 150M–200M** | Validator-signalled, *not* in the fork itself | **Hurts, and it is the dominant term.** |

> **The single most important sentence in this brief:** Glamsterdam does not lower the gas
> limit-driven state growth curve; it makes a *3.3x throughput increase* survivable by
> repricing state so that growth stays near today's absolute rate. Our disk spend per node
> does not go down. It stops accelerating — *if* the repricing calibration holds in practice.

### 2.3 Real, funded, and not arriving in time — do not budget relief from these

**EIP-7864 — unified binary state tree.** Replaces the hexary Keccak MPT with a binary tree
over a uniform 32-byte key/value layout, merging accounts, storage, and code. Roughly **4x
shorter Merkle branches**, and swapping the hash to Blake3 or a Poseidon variant offers a
further 3x–100x proving improvement. This is the genuine structural fix and it is where the
research has consolidated.

Two things to understand about its status:

- The roadmap **pivoted away from Verkle trees to binary trees** during 2026. Verkle's
  elliptic-curve commitments are not post-quantum secure; the binary design depends only on
  hashes. This was the right call technically, but it **reset implementation and testing
  timelines**. Any vendor deck still promising "Verkle, ~90% storage reduction, 2026" is
  quoting a superseded plan — this specific claim still circulates and you should expect to
  see it. Discount it.
- EIP-7864 is **in Review, not scheduled for a fork**, and is **absent from the Hegotá
  tier list** published 7 September 2026. Of 62 EIPs evaluated for Hegotá across 397 expert
  grades, the state-related entries are minor repricing/cleanup items (EIP-8279, EIP-8131).
  No tree swap, no state expiry, no statelessness.

**Practical read:** a state tree migration requires a state conversion process on live
mainnet, which is among the most delicate operations ever attempted on the network. Earliest
plausible fork inclusion is the fork *after* Hegotá. Earliest plausible mainnet is **2028**,
and that assumes no further slippage in a program that has already slipped by years and
changed cryptographic direction once. **Budget zero relief from this before Q4 2028.**

**State expiry.** Discussed for the better part of a decade, no active implementation track,
not in any fork's scope. Treat as aspirational.

**Full rolling history expiry (EIP-4444 / EIP-7927 meta).** Would prune post-merge history on
a rolling window, unlocking a further large saving on *full* nodes. Work is ongoing and
depends on the Portal Network being a credible retrieval layer. Not scheduled. Possible
within our window; **do not budget it, but architect so we can take it opportunistically** —
specifically, by not assuming our nodes are the only copy of history we control.

### 2.4 Confidence summary

| Change | Relief to us | Confidence it lands by Q4 2028 |
|---|---|---|
| Partial history expiry | 300–500 GB, one-time | **Shipped** |
| Geth pathdb archive | >20 TB → ~2 TB per archive node | **Available now** (client config, no fork) |
| EIP-8037 / 8038 repricing | Caps growth near ~120 GiB/yr at 150M gas | **High** (~85%) — scope is settled; date is not |
| Gas limit 150M–200M | *Negative* — the main risk driver | **High** (~80%) that it rises materially |
| Full rolling history expiry | Large, on full nodes | **Low-moderate** (~30%) |
| Binary state tree (EIP-7864) | Structural, large | **Low** (~15%) |
| State expiry | Structural, very large | **Very low** (<5%) |

---

## 3. The planning model

### 3.1 Anchor numbers

- Geth state-only DB: **~390 GiB** (January 2026, per the EIP-8037 rationale).
- Current state growth at the 60M limit: **~116 GiB/year**.
- Projected at a 200M limit *without* EIP-8037: **~387 GiB/year**.
- Projected *with* EIP-8037: **80–240 GiB/year**, across a 100M–300M limit range; **~120 GiB/yr**
  at the 150M reference.
- A **~650 GiB** state size is cited as a performance threshold — the point at which node
  performance degrades materially. At 200M gas with no repricing, that is breached within a
  year.
- Archive footprints today: **Geth pathdb ~2.0 TB** flat-state-only / **~6.5 TB** with
  historical trie nodes; **Erigon ~1.8–2.2 TB**; **Reth ~2.8 TB**; **legacy Geth hash-based
  >20 TB**.
- Full node: ~0.9–1.3 TB execution + ~80–200 GB consensus + ~100–150 GB blobs, growing
  ~7–8 GiB/week.

> **A note on figures you will see quoted elsewhere:** published state-size numbers range from
> 30 GB/yr to 100 GB/yr to 770 GB total. The spread is definitional — flat state vs. state
> plus trie nodes vs. whole-datadir — not genuine disagreement. The EIP-8037 numbers above are
> the ones the protocol designers are actually calibrating against, so we should standardise
> on them. **Before finalising the budget, measure our own fleet against these definitions;**
> a real datapoint from our own nodes beats any published figure.

### 3.2 Three scenarios, 24 months (Q4 2026 → Q4 2028)

Modelling **state growth only** — the compounding term. Blobs and history are separate,
bounded lines.

| | Gas limit path | Repricing | New state over 24mo | State DB at end |
|---|---|---|---|---|
| **Low** | Stays near 60M | 8037 lands early 2027 | ~200 GiB | ~700 GiB |
| **Base** | Rises to ~150M through 2027 | 8037 lands, calibration roughly holds | ~280 GiB | ~780 GiB |
| **High** | Rises to 200M+ | Glamsterdam slips to late 2027; limit rises *first* | ~550 GiB | ~1.05 TiB |

**Recommend budgeting the High case.** The asymmetry matters: the accelerant (gas limit) is a
validator-signalled parameter that can move *any time, without a fork*, while the brake
(EIP-8037) requires a fork that has already missed two dates. **The two are not coupled.**
There is a genuine, non-trivial window in which the limit rises before the repricing lands.
That is our tail risk and it is the scenario worth spending money to be robust against.

Add to the state figure, per archive node: historical flat state (the ~2 TB baseline, growing
with throughput), plus ~6.5 TB if we retain historical trie nodes.

---

## 4. What to do in the meantime

Ordered by return on effort.

### 4.1 Migrate the archive fleet to path-based archive mode — highest ROI, do first

If any archive node still runs legacy hash-based `--gcmode=archive`, this is a **>10x disk
reduction** (>20 TB → ~2 TB) and takes sync from months to ~2 weeks. Available today in Geth
v1.16+; no fork dependency, no governance risk.

Mechanics:
- `--history.state=N` controls historical state retention (`0` = keep everything).
- `--history.trienode=N` controls historical trie nodes; the default `-1` **disables**
  retention. This is the flag that separates a ~2 TB node from a ~6.5 TB one.
- Enable `--gcmode archive` *after* initial full sync completes — applying it from the start
  slows sync.
- Historical state histories tolerate spinning disk, which is a real cost lever: we do not
  need NVMe for the cold tier.

**The one hard decision this forces:** with `--history.trienode` unset, historical
`eth_getProof` does not work — only the last ~128 blocks. Historical proofs require **Geth
v1.17.x and `--history.trienode=N`**. So:

> **Audit which of our customers actually call `eth_getProof` at historical blocks.** In our
> experience of typical archive workloads this is a small minority, but it is a minority that
> tends to be high-value (bridges, light-client infrastructure, proof services). Do not
> guess — pull it from the RPC logs.

### 4.2 Tier the fleet instead of running one uniform node type

This follows directly from §4.1 and is where most of the money is:

- **Tier A — historical proofs.** Geth v1.17.x, `--history.trienode` set, ~6.5 TB, NVMe.
  Size this to demand, not to fleet size. Possibly 1–2 nodes plus a standby.
- **Tier B — general archive.** pathdb, trie nodes off, ~2 TB, historical state on cheaper
  storage. This should be the bulk of the fleet and serves nearly all archive traffic.
- **Tier C — full nodes.** ~1.2 TB, pre-merge history expired.

If we are currently running everything at Tier A's capability, this reclassification alone is
likely the largest single line item in this brief.

### 4.3 Run a client mix, deliberately

Footprints differ enough to matter (Erigon ~1.8–2.2 TB, Geth pathdb ~2.0 TB, Reth ~2.8 TB)
and, more importantly, the clients diverge on *which* archive features they make cheap. A mix
also hedges the real operational risk that a Glamsterdam-era client release regresses on disk
or sync for one implementation. Run at least two archive implementations in production.

### 4.4 Decouple history from nodes

Ship an Era1/Era archive of historical blocks and receipts to object storage now, independent
of any node's datadir. Rationale:

- Pre-merge data is **already** not guaranteed over p2p; we cannot re-fetch it on demand.
- If full rolling history expiry lands (§2.3), we can adopt it the week it ships and take the
  saving immediately, rather than being blocked because our nodes are our only copy.
- It converts an expensive, IOPS-bound, replicated-per-node cost into a cheap,
  deduplicated, cold-storage cost.

### 4.5 Buy storage in a way that assumes we were wrong

Given the High scenario and Glamsterdam's slip history:

- Provision **capacity headroom, not just capacity** — target ~40% free on archive volumes,
  not 15%. The failure mode we are guarding against is a gas limit increase landing *before*
  the repricing, which gives us weeks of warning, not months.
- Prefer **expandable volumes** (LVM/cloud block storage that grows in place) over fixed
  provisioning. Re-syncing an archive node to resize is a 2-week outage per node even in the
  good case.
- Separate **hot (current state, NVMe)** from **cold (historical state, HDD/cheap SSD)** at
  the mount level, so we can scale the two independently. Geth's pathdb explicitly supports
  this and it is where the cost curve bends.
- Where we buy hardware outright, prefer **24-month refresh horizons** over 36-month. The
  binary tree migration, if it lands in 2028, will change the optimal hardware profile
  substantially (more CPU for hashing/proving, less IOPS).

### 4.6 Instrument now so the next forecast is ours, not a blog's

We are currently forecasting off published figures with a 3x spread. Before the next budget
cycle, stand up per-node metrics for: state DB size, historical-state size, trie-node size,
daily new-state bytes, and sync time. **Daily new-state bytes plotted against the mainnet gas
limit** is the single series that converts this brief from estimate to measurement — and it
will tell us within weeks, not quarters, whether EIP-8037's calibration is holding once it
activates.

### 4.7 Watch list — the four signals that change the budget

1. **Devnet-11 finality.** This is the gate on Glamsterdam's December 2026 target. If it
   fails, move to the High scenario immediately.
2. **Validator gas limit signalling.** Watch the signalled limit independently of the fork
   schedule. A rise toward 150M+ *before* Glamsterdam activates is our worst case and the
   trigger for emergency capacity.
3. **Post-Glamsterdam state growth telemetry.** The 120 GiB/yr target is a model. Measure the
   realised rate in the first 60 days; the Hegotá process is itself explicitly waiting on
   post-Glamsterdam mainnet data before ranking further state EIPs.
4. **Any ACD call that schedules EIP-7864 for a fork.** That is the signal to re-plan hardware
   for 2028+. Until it appears on a fork's scheduled list, it does not exist for budget
   purposes.

---

## 5. Summary for finance

- **There is no rescue coming inside the window.** The structural fix (binary state tree) is
  real, funded, and roughly 2028+ at the earliest. Every budget should assume we carry the
  current architecture through Q4 2028.
- **Expect flat-to-worse per-node state growth**, ~150–250 GiB/year, with a credible tail to
  ~275 GiB/year if the gas limit rises before the repricing lands.
- **The offsetting saving is large and available immediately** and is a configuration change,
  not a purchase: path-based archive mode plus fleet tiering can cut archive storage by a
  factor of several. This is likely to more than fund the organic growth above for the next
  24 months.
- **The correct posture is optionality, not capacity.** Expandable volumes, hot/cold
  separation, shorter refresh cycles, and history held outside node datadirs. The protocol
  roadmap's *direction* is good and will eventually help us a great deal; its *dates* have
  been unreliable for years and should not appear anywhere in a budget.

---

## Sources

- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-8038: State-access gas cost update](https://eips.ethereum.org/EIPS/eip-8038)
- [EIP-8007: Glamsterdam Gas Repricings (meta)](https://eips.ethereum.org/EIPS/eip-8007)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-7927: History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927)
- [EF Blog: The Hegotá EIP Opinion Post and Tier List (7 Sep 2026)](https://blog.ethereum.org/2026/09/07/protocol-hegota-eips)
- [EF Blog: Glamsterdam Repricing Impact for Smart Contract Developers (24 Aug 2026)](https://blog.ethereum.org/2026/08/24/glamsterdam-repricing-testing)
- [EF Blog: Partial history expiry announcement](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [EF Blog: Fusaka Mainnet Announcement](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement)
- [go-ethereum docs: Archive mode](https://geth.ethereum.org/docs/fundamentals/archive)
- [Chainstack: Ethereum Glamsterdam — What Changes for Infrastructure](https://chainstack.com/ethereum-glamsterdam-upgrade/)
- [The Defiant: Glamsterdam Enters Final Devnet Phase With 200M Gas-Limit Target](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [The Block: Vitalik Buterin lays out a two-part plan to overhaul Ethereum's execution layer](https://www.theblock.co/news/ecosystems/2026-03-01-vitalik-buterin-lays-out-a-two-part-plan-to-overhaul-ethereums-execution-layer-from-the-ground-up-391681)
- [Ethereum stateless book: Binary Tree](https://stateless.fyi/trees/binary-tree.html)
- [ethereum.org: Fulu-Osaka (Fusaka)](https://ethereum.org/roadmap/fusaka/)
- [EIP-4444 Implementation Plan: History Expiry in Ethereum](https://hackmd.io/@hBXHLw_9Qq2va4pRtI4bIA/ryzBaf7fJx)
