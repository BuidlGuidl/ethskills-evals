# Ethereum State Growth: Technical & Capacity Planning Brief

**Date:** 2026-07-25
**Planning window:** now through ~Q3 2028
**Audience:** infrastructure team + finance

---

## Bottom line up front

1. **No protocol change that shrinks your archive nodes will land inside the planning window.** Binary state trees (the successor to Verkle) are a `Draft` EIP that is not scheduled for the next fork *or even proposed for the one after it*. State expiry is dormant. Budget as if neither exists.

2. **What *is* landing is a cap on the growth *rate*, not a reduction.** EIP-8037 (State Creation Gas Cost Increase) is Scheduled for Inclusion in Glamsterdam and explicitly targets ~120 GiB/year of new state at a 150M gas limit. Read that carefully: it is designed so that state growth stays roughly flat *in absolute terms* while throughput rises 2.5x. It does not give back a single byte.

3. **The single biggest lever available to you in this window is client/storage-engine choice, not protocol.** Geth's path-based archive mode and Erigon 3 already put a mainnet archive node at ~2 TB versus the ~15-20 TB of legacy hash-based archive. If any node in your fleet is still on a legacy layout, that migration dwarfs anything the protocol will do for you before 2029.

4. **Glamsterdam has no mainnet date, and is not yet configured on any public testnet.** Plan for activation somewhere in Q4 2026–Q1 2027, with real risk of later. Do not build a budget that depends on it landing in 2026.

5. **Practical guidance for finance:** provision 4 TB NVMe per archive node, not 2 TB. Assume ~120 GiB/year of *current-state* growth as the post-Glamsterdam floor, and treat archive-node growth (historical state diffs) as a separate, larger line item that Glamsterdam only partially addresses.

---

## 1. What is actually driving this at the protocol level

### 1.1 The data structure

Ethereum's state is a Merkle Patricia Trie (MPT) — actually a trie of tries:

- One **account trie** mapping `keccak256(address)` → account record (nonce, balance, storageRoot, codeHash).
- One **storage trie per contract**, mapping `keccak256(slot)` → value.
- Contract **code** stored separately, keyed by code hash.

Three properties of this design drive your pain, and they compound:

**Keys are hashed.** Because trie keys are `keccak256` of the address or slot, logically-related data is scattered uniformly across the keyspace. There is no locality. A transaction touching one contract's ten storage slots produces ten effectively-random reads. This is why state access is I/O-bound and why the problem is not merely "how many bytes" but "how many random reads per block."

**The trie is 16-ary and deep.** Path length grows with `log16(N)` in the number of accounts. Every additional account deepens the average path for everyone. Reading one leaf means walking (and hashing) a chain of internal nodes. The internal nodes are the majority of the node count — recent measurements put the trie at ~1.9 billion nodes.

**State creation is a one-time payment for a permanent liability.** Writing a storage slot costs 20,000 gas *once*, and the network stores it forever, on every full node, for free thereafter. There is no rent, no expiry, no decay. This is the core economic defect, and every proposal in this space is an attempt to correct it — either by raising the up-front price (repricing), by making old state cheap to *not* store (expiry/statelessness), or by making the structure cheaper to prove (binary trees).

### 1.2 Three different things called "state growth" — keep them separate

Your archive-node problem is mostly the third one, and most public discussion is about the first. This distinction matters for budgeting.

| | What it is | Current size | Who pays |
|---|---|---|---|
| **Current state** | The live trie: all accounts, slots, code as of the head block | **~390 GiB** (Geth, Jan 2026) | Every full node |
| **History** | Historical blocks, bodies, receipts | ~500 GiB before expiry; now largely bounded | Full nodes (partly relieved) |
| **Historical state** | The state at *every past block* — stored as reverse diffs / changesets | The bulk of your ~2 TB archive | **Archive nodes only** |

**The key asymmetry: the protocol work in flight targets column 1, and your worst pain is column 3.**

Current state growth is driven by *net new* state (new accounts, new slots). Historical state growth — your archive burden — is driven by *total state mutation*: every write of an existing slot produces a diff you must retain, even though it adds nothing to the current state. A workload that repeatedly overwrites the same slots grows your archive nodes while barely moving current state at all.

### 1.3 The gas limit is the throttle, and it was just opened

This is the number that actually governs your capacity curve.

Mainnet gas limit is **60,000,000** as of today (verified against a mainnet node at block 25,612,903, 2026-07-25). It was 30M until the Fusaka-era increase (EIP-7935, `Final`, default raised to 60M).

The measured effect, per EIP-8037's own motivation section:

> "After the increase in gas limit from 30M to 60M gas units, the average size of new state created each day more than tripled, from ~105 MiB to ~326 MiB. This results in an annual growth of ~116 GiB."

Two things to note:

- The response was **super-linear**: a 2x gas limit bump produced a ~3x jump in daily new state. The EIP attributes this to a one-off shift in user behaviour rather than a stable ratio — but from a planning standpoint, the lesson is that gas limit increases do not translate into state growth in a predictable, linear way, and have historically been worse than proportional.
- There is **continuous upward pressure on the gas limit.** Validators can and do vote it up, and the roadmap direction is explicitly toward much higher limits. EIP-8037 models a 200M gas limit producing **~387 GiB/year**.

EIP-8037 also names the operational threshold the core devs are steering around:

> "Starting from 390 GiB, this rate would breach the 650 GiB threshold (at which point nodes begin experiencing performance degradation) in less than a year."

**650 GiB of current state is the number the protocol developers treat as the danger line for full nodes.** That is a useful anchor for your own alerting.

---

## 2. What's coming, and how much you can bank on it

I've graded everything by how much weight it should carry in a budget. Statuses verified against the EIP repository, the Glamsterdam and Hegotá meta-EIPs, `ethereum/pm` call agendas, and the R&D archive as of 2026-07-25.

### Tier 1 — Bankable: Scheduled for Inclusion in Glamsterdam

Per **EIP-7773 (Glamsterdam Hardfork Meta)**, ten EIPs are SFI. Four bear directly on state:

#### EIP-8037 — State Creation Gas Cost Increase ⭐ the important one

The central state-growth intervention of this era. Status: `Draft` as an EIP, but **SFI for Glamsterdam**, implemented in Geth as of v1.17.4 (2026-06-22), and its dedicated biweekly breakout call was wound down in May 2026 with discussions folded into the main testing call — all signs of a mature, converging change.

What it does:

- Introduces `CPSB` (cost per state byte) = **1,530 gas**, and harmonises all state-creation operations to charge by actual bytes created.
- Introduces **multidimensional metering**: a separate *state-gas* dimension alongside *execution-gas*. A block is full when *either* dimension hits the limit; the base fee tracks whichever is the bottleneck.
- Explicitly calibrated to **target ~120 GiB/year of state growth at a 150M gas reference limit.**

Repricings (current → new state-gas):

| Operation | Current | New | Multiple |
|---|---|---|---|
| New storage slot (`SSTORE`) | 20,000 | 64 × 1,530 = **97,920** | ~4.9x |
| New account (`CREATE`, `CALL`) | 25,000 / 32,000 | 120 × 1,530 = **183,600** | ~5.7–7.3x |
| Code deposit (per byte) | 200 | **1,530** | ~7.7x |

**How to read this for planning:** EIP-8037 is a *rate cap*, not a reduction. Its stated goal is to hold state growth at roughly today's absolute rate (~120 GiB/yr) while unblocking a 2.5x gas limit increase. If it ships and the gas limit rises as intended, your current-state growth stays about where it is now. If it ships and the gas limit *doesn't* rise, you get a genuine slowdown. Either way you never get bytes back.

**Caveat for archive nodes:** EIP-8037 prices state *creation*. Your historical-state burden is driven by state *mutation*, including overwrites of existing slots, which 8037 does not touch. The EIP that addresses that is 8038, which is only Tier 2.

#### EIP-7928 — Block-Level Access Lists

Blocks carry an enforced list of all state locations accessed plus post-transaction state diffs. Primarily a parallel-execution and stateless-validation enabler, not a disk-size change. But operationally relevant to you: it is the basis for **EIP-8189 (snap/2, BAL-based state healing)**, already implemented in Geth v1.17.4, which should improve sync robustness and speed. That's directly on your "sync times get worse every year" complaint.

#### EIP-7976 / EIP-7981 — Increase Calldata Floor Cost / Increase Access List Cost

Both reduce worst-case block size and reprice state access paths. Second-order for disk, helpful for bandwidth and worst-case block processing.

#### EIP-7954 — Increase Maximum Contract Size ⚠️ cuts the other way

Raises max contract code from 24 KiB to 64 KiB (initcode 48 KiB → 128 KiB). This *increases* per-contract state footprint. It's coherent alongside EIP-8037 — bigger contracts are permitted but now priced at 1,530 gas/byte instead of 200 — but if you model deployment-heavy workloads, note that the ceiling moved up 2.7x.

### Tier 2 — Likely but not committed: Considered for Inclusion in Glamsterdam

#### EIP-8038 — State-access gas cost update

The one that matters most for **archive** growth, because it prices *writes*, not just creation:

| Parameter | Current | New | Change |
|---|---|---|---|
| `STORAGE_WRITE` | 2,800 | 10,000 | **+257%** |
| `COLD_STORAGE_ACCESS` | 2,100 | 3,000 | +43% |
| `COLD_ACCOUNT_ACCESS` | 2,600 | 3,000 | +15% |
| `CREATE_ACCESS` | 7,000 | 11,000 | +57% |
| `ACCOUNT_WRITE` | 6,700 | 8,000 | +19% |

A +257% increase on storage writes would meaningfully slow the rate at which historical state diffs accumulate. **This is the change with the most upside for your specific problem — and it is CFI, not SFI.** It is a hard dependency of EIP-8037's spec (8037 `requires: 8038`, and several of 8037's constants reference values "not yet final" in 8038), which raises the odds it gets promoted. Treat as ~60/40 rather than a plan input. Worth tracking specifically.

Others CFI: EIP-2780 (resource-based intrinsic tx gas), EIP-7610, EIP-8246, EIP-7997, EIP-8282, EIP-8061, EIP-8045, EIP-7688. None material to disk.

### Tier 3 — Speculative: Hegotá (the fork after Glamsterdam)

Per **EIP-8081 (Hegotá Hardfork Meta)**, scope is barely formed:

- **Scheduled for Inclusion: exactly one EIP** — EIP-7805 (FOCIL), the consensus-layer headliner.
- **No execution-layer headliner was selected.** Account Abstraction was discussed and deferred — "strong support for 'AA generally' and controversy over the right specific implementation."
- Everything else (26 EIPs) is merely "Proposed for Inclusion," which per EIP-7723 is the weakest possible status.

Two proposed EIPs are relevant to you, both far from committed:

**EIP-8188 — Last-Written Block for Accounts and Slots** (`Draft`, *Proposed* for Hegotá). Records a consensus-visible timestamp of last mutation for every account and slot, enabling hot/cold storage separation — cold state (untouched 1+ year) moves out of the primary database into flat files. A prototype measured **-21.6% total disk footprint and ~-58% trie node count** (1,895M → 788M nodes).

That's a real number, but read the authors' own caveats: the experiment measures static footprint only, does not measure the cost of *modifying* cold state, and has not been validated against replayed mainnet blocks. The authors call it a proof of concept, not production-ready. This is the most promising near-ish-term structural idea, and it is still two steps away from being scheduled.

**EIP-7862 — Delayed State Root** (`Draft`, *Proposed*). Decouples state root computation from block validation. A latency/throughput change, not a disk change.

**Planning treatment: assume nothing from Hegotá.** Its execution-layer scope isn't set, and it is at minimum one full fork cycle beyond Glamsterdam — realistically late 2027 at the earliest, more likely 2028.

### Tier 4 — Do not plan around this

#### Binary state trees (EIP-7864) — the headline item, and it is not close

This is the one most likely to be mis-sold to you, so here is the evidence precisely:

- **Status: `Draft`.** Created 2025-01-20.
- **Not in Glamsterdam** — not SFI, not CFI, not DFI. It is simply absent from EIP-7773.
- **Not in Hegotá** — not even in the "Proposed for Inclusion" list of EIP-8081.
- The hash function **is not finalised** (BLAKE3 currently, with Keccak and Poseidon2 still candidates).
- Cross-client implementation is at the experimental-branch stage. As of May 2026 the R&D channel shows Besu on a `stateless/binary-trie` branch achieving consensus with Geth on *simple transfers*, with BAL compatibility not yet checked. Geth has landed groundwork ("refactored state database in preparation for binary trie integration," v1.17.2) and has explicitly replaced its Verkle implementation with binary-tree work — but that is preparation, not deployment.
- The Stateless Implementers Call runs roughly monthly (#52, June 2026) and has produced no target fork.

Note also what a migration would mean even after it's scheduled: converting mainnet state from hexary MPT to a binary tree is one of the most invasive changes ever attempted on Ethereum, and the migration itself will be a major operational event for node operators. It is not a change that quietly appears.

**Confidence it is live on mainnet before Q3 2028: low.** Realistically this is a 2029+ item. Any vendor or plan assuming otherwise is wrong.

*Context on why this keeps slipping:* Verkle trees (EIP-6800) were the statelessness vehicle for years and are now `Stagnant` — abandoned in 2024-25 over ZK-compatibility and post-quantum concerns. Binary trees are the replacement. This history is exactly why the roadmap should not be treated as a schedule.

#### State expiry — effectively dormant

- **EIP-7736** (leaf-level state expiry): `Stagnant`.
- The dedicated `state-expiry` R&D channel is essentially dead — after activity ending in 2024, a single message in May 2026.
- State expiry was always downstream of the tree change. With the tree change unscheduled, expiry is unscheduled squared.

**Do not model any state expiry benefit in this window.** The only live thread in this direction is EIP-8188 (Tier 3).

#### History expiry — already partly delivered, and irrelevant to your archive nodes

Worth being precise here because it's frequently conflated with state growth in vendor material and press:

- **EIP-4444** itself is `Stagnant`, as are the related meta-EIPs (EIP-7927, EIP-7639). But partial history expiry **did ship** by another route: EIP-7642 (`eth/69`) is `Final` and shipped in Fusaka, and clients began dropping pre-merge block bodies and receipts after Pectra.
- Practical effect already realised: roughly **300-500 GB off a full node**, which is why an Erigon full node today is ~419 GB. Geth supports `geth prune-history --history.chain postprague` (v1.17.2+) to go further.
- **For archive nodes this delivers nothing.** An archive node retains everything by definition. Any capacity plan that credits history expiry against archive-node disk is double-counting.

---

## 3. Timing: what "Glamsterdam" actually means on a calendar

Be skeptical of any specific date you see quoted. Here is the verifiable status as of 2026-07-25:

- `ethereum/pm/all-forks.json` (the canonical fork registry) lists Glamsterdam with `"status": "planned"` and **`activation.timestamp: null`**. No date has been set.
- **Glamsterdam is not configured on any public testnet.** Sepolia's and Hoodi's configs top out at `FULU_FORK_EPOCH`; there is no `GLOAS_FORK_EPOCH` on either. Public testnet activation normally precedes mainnet by one to two months, and testnets have to be configured before that.
- Devnets are running (bal-devnet-7 as of May 2026, plus a glamsterdam-devnet), and Geth has shipped implementations of the major EIPs — so the work is genuinely advanced.
- Scope is still moving: EIP-8038 remains CFI, and ACDE #241 (2026-07-16) was still taking new spec proposals.

**Planning assumption: Glamsterdam mainnet activation Q4 2026 – Q1 2027, with meaningful probability of Q2 2027.** For reference, the last three forks have run roughly 8-14 months apart (Pectra May 2025 → Fusaka Dec 2025 → Glamsterdam TBD).

**Derived: Hegotá is not plausibly before late 2027, and more likely 2028.** That is the outer edge of your planning window, and its execution-layer contents are undecided.

---

## 4. Capacity model

### 4.1 Where things stand today (verified figures)

| Metric | Value | Source / date |
|---|---|---|
| Mainnet gas limit | 60,000,000 | live mainnet query, 2026-07-25 |
| Current state (Geth) | ~390 GiB | EIP-8037, Jan 2026 |
| New state per day @ 60M | ~326 MiB | EIP-8037 |
| Current-state growth rate | ~116 GiB/yr | EIP-8037 |
| Degradation threshold | ~650 GiB | EIP-8037 |
| Erigon 3 archive, mainnet | **2.03 TB** | Erigon docs, measured 2026-07-19 |
| Erigon 3 full node | 419 GB | Erigon docs, 2026-07-19 |
| Geth path-based archive | ~2 TB | vs. ~15-20 TB legacy hash-based |

### 4.2 Current state (full nodes) — three scenarios

Starting from ~390 GiB in Jan 2026, so ~448 GiB as of now.

| Scenario | Assumption | Jul 2027 | Jul 2028 | Hits 650 GiB |
|---|---|---|---|---|
| **A — status quo** | Gas limit stays 60M, no Glamsterdam repricing | ~564 GiB | ~680 GiB | **~mid-2028** |
| **B — gas limit rises, no repricing** | 150M limit, no EIP-8037 | ~738 GiB | ~1,028 GiB | **~early 2027** |
| **C — Glamsterdam ships as designed** | 150M limit + EIP-8037 | ~568 GiB | ~688 GiB | ~mid-2028 |

*Scenario B extrapolates EIP-8037's own methodology (post-bump rate scaled proportionally to gas limit; the EIP models ~387 GiB/yr at 200M). Scenario C uses the EIP's stated 120 GiB/yr design target.*

**The planning insight:** Scenarios A and C are nearly identical. EIP-8037's purpose is to make higher throughput *not* cost you extra disk — the benefit accrues to network capacity, not to your budget. **Budget ~120 GiB/year of current-state growth as a floor through the window**, and treat Scenario B as the tail risk if the gas limit rises before Glamsterdam ships.

That tail risk is real and is the thing to watch: validators can raise the gas limit at any time without a hard fork. If a 100M+ limit arrives before Glamsterdam activates, Scenario B is your world for that interval.

### 4.3 Archive nodes

I want to be straight about the confidence level here: I could not find a reliable published time series for archive-node growth rate, and it depends heavily on client, storage scheme, and workload. **You should instrument this yourselves rather than trust any external figure — see §5.1.**

What can be said with confidence:

- Archive footprint = current state + accumulated historical state diffs + full history. The diff component is the one that compounds and it tracks **total state mutation**, which is roughly proportional to gas actually consumed, not to net state created.
- Therefore **EIP-8037 provides limited relief to archive nodes.** It caps creation, not overwrites. If the gas limit rises to 150M post-Glamsterdam, mutation volume rises with it and your archive diff accumulation likely *accelerates* even as current-state growth stays flat.
- **EIP-8038 is the change that would actually help you** (+257% on `STORAGE_WRITE`), and it is CFI, not SFI.
- Consequence: **archive-node growth is the part of your problem that the protocol is least likely to fix in this window.** Plan for it to continue at or above its current rate, and consider that a rising gas limit makes it worse.

Against a current 2.03 TB and Erigon's own 4 TB recommendation, a 4 TB provisioning standard buys you roughly two to three years of headroom at present rates. 2 TB disks are already inadequate.

---

## 5. Recommendations

### 5.1 Instrument before you extrapolate (do this first, this quarter)

You are making multi-year hardware decisions off external estimates. Replace them with your own data:

- Run Geth with `--state.size-tracking` and poll `debug_stateSize` to get precise current-state size, then record daily deltas. This exists precisely for this purpose (Geth v1.16.4+).
- Track per-node disk growth broken out into the three categories in §1.2. You cannot make good tiering decisions while "state growth" is one undifferentiated number.
- Correlate your archive growth against daily gas consumed. That gives you a coefficient you can apply to any future gas limit scenario — which is the single most valuable number for the next budget cycle.
- Alert on current state approaching 650 GiB.

### 5.2 Storage-engine and client decisions (largest available lever)

- **Audit for any legacy hash-based archive nodes and migrate them.** Path-based archive (Geth) and Erigon 3 are ~2 TB against ~15-20 TB legacy. If you have any of these left, this single action is worth more than everything the protocol will ship before 2029.
- **Tier your archive fleet by proof-serving capability.** Geth v1.17.0+ can serve historical `eth_getProof` from a path-based archive, and `--history.trienode` sets the block range for which trie-node history is retained *independently* of state history. Most consumers don't need historical Merkle proofs. Run a small number of deep-proof nodes and a larger tier with a short trienode window. Note the one-way door: trie-node history can only be regenerated by reprocessing blocks, so removing it is expensive to undo — but it can be re-enabled and backfilled later if you plan for it.
- **Prune history aggressively on full nodes.** `geth prune-history --history.chain postprague` (v1.17.2+). This is the ~300-500 GB win that has already shipped. Confirm you've taken it on every non-archive node.
- **Maintain client diversity in the fleet.** Beyond the network-health argument, Geth and Erigon have materially different storage architectures and their growth curves and migration risks are not correlated. When the binary-tree migration eventually arrives, having operational familiarity with two clients is a hedge against one of them having a rough transition.

### 5.3 Hardware procurement

- **Standardise on 4 TB NVMe per archive node, not 2 TB.** This matches Erigon's own recommendation against a measured 2.03 TB, and buys ~2-3 years.
- **Spec on IOPS and write endurance, not just capacity.** §1.1 explains why: hashed trie keys make the workload random-access, and the trie deepens as state grows, so read amplification worsens over time even at constant capacity. A node can become unusably slow well before the disk is full. Track p99 block processing time as a leading indicator, not just disk percentage.
- **Do not pre-buy capacity against a hoped-for protocol fix.** There is no scenario in this window where your archive disk requirement goes down.

### 5.4 Application-layer levers you control

If your company deploys contracts or influences how data is written on-chain, EIP-8037's repricing is a direct cost event: new storage slots ~4.9x, new accounts ~5.7-7.3x, code deposit ~7.7x. Any of your own on-chain deployment or data-anchoring patterns should be re-costed now, before Glamsterdam, not after.

### 5.5 What to watch, and what each signal means

| Signal | Where | Why it matters |
|---|---|---|
| **EIP-8038 promoted CFI → SFI** | EIP-7773 meta / ACDE calls | The best available archive-growth relief. Highest-value single signal for you. |
| **Glamsterdam epoch set on Sepolia/Hoodi** | `eth-clients/sepolia`, `eth-clients/hoodi` configs | The reliable timing tell — mainnet follows testnets by ~1-2 months. |
| **Mainnet gas limit rising above 60M** | Any block explorer / your own nodes | Needs no hard fork. Triggers Scenario B. Your highest-probability adverse surprise. |
| **EIP-7864 appearing as CFI in any meta-EIP** | EIP-8081 or its successor | Would be the first real evidence binary trees are on a schedule. Not present today. |
| **EIP-8188 promoted from Proposed → CFI** | EIP-8081 | Earliest plausible structural (-20%+) footprint win. |
| **Hegotá EL headliner selection** | `ethereum/pm` ACDE agendas | Currently unfilled. Determines whether the 2028 fork addresses state at all. |

**Review cadence:** re-verify this brief after each ACDE call cycle (biweekly) during Glamsterdam scope-freeze, then quarterly. Fork scope changes late — several EIPs moved in and out of Glamsterdam during 2026.

---

## Appendix: status of every EIP referenced

Verified 2026-07-25 against `ethereum/EIPs`, EIP-7773, EIP-8081, and `ethereum/pm/all-forks.json`.

| EIP | Title | EIP status | Fork status |
|---|---|---|---|
| 8037 | State Creation Gas Cost Increase | Draft | **SFI Glamsterdam** |
| 7928 | Block-Level Access Lists | Review | **SFI Glamsterdam** |
| 7976 | Increase Calldata Floor Cost | Review | **SFI Glamsterdam** |
| 7981 | Increase Access List Cost | Review | **SFI Glamsterdam** |
| 7954 | Increase Maximum Contract Size | Review | **SFI Glamsterdam** |
| 7732 | Enshrined Proposer-Builder Separation | — | **SFI Glamsterdam** |
| 8038 | State-access gas cost update | Draft | **CFI Glamsterdam** |
| 8189 | snap/2 — BAL-based state healing | — | Glamsterdam networking EIP |
| 7805 | FOCIL | — | **SFI Hegotá** |
| 8188 | Last-Written Block for Accounts and Slots | Draft | *Proposed* Hegotá only |
| 7862 | Delayed State Root | Draft | *Proposed* Hegotá only |
| **7864** | **Unified binary state tree** | **Draft** | **Not in any fork** |
| 6800 | Unified Verkle tree | **Stagnant** | Abandoned |
| 7736 | Leaf-level state expiry (Verkle) | **Stagnant** | Abandoned |
| 4444 | Bound Historical Data in Execution Clients | **Stagnant** | Superseded in practice by eth/69 |
| 7927 | History Expiry Meta | Stagnant | Partially delivered |
| 7639 | eth/70 — cease serving pre-PoS history | Stagnant | Superseded |
| 7642 | eth/69 — history expiry, simpler receipts | **Final** | **Shipped (Fusaka)** |
| 7935 | Set default gas limit to 60M | **Final** | **Shipped (Fusaka)** |
| 7825 | Transaction Gas Limit Cap (2²⁴) | **Final** | **Shipped (Fusaka)** |
| 7723 | EIP status definitions (CFI/SFI/DFI/PFI) | — | Process EIP |

**Status glossary:** `Draft`/`Review` = spec in progress. `Stagnant` = no activity 6+ months; treat as dead unless revived. `Final` = spec frozen (for core EIPs, still requires fork inclusion to be live). `PFI` (Proposed) = weakest — anyone can propose. `CFI` (Considered) = core devs actively evaluating for a named fork. `SFI` (Scheduled) = in the fork, barring disaster. `DFI` (Declined) = rejected from that fork, may return later.

### Sources

- [EIP-7773: Glamsterdam Hardfork Meta](https://eips.ethereum.org/EIPS/eip-7773)
- [EIP-8081: Hegotá Hardfork Meta](https://eips.ethereum.org/EIPS/eip-8081) · [discussion thread](https://ethereum-magicians.org/t/eip-8081-hegota-network-upgrade-meta-thread/26876)
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037) — source of the 390 GiB / 326 MiB-day / 116 GiB-yr / 650 GiB figures
- [EIP-8038: State-access gas cost update](https://eips.ethereum.org/EIPS/eip-8038)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-7927: History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927)
- [ethereum/pm — all-forks.json](https://github.com/ethereum/pm/blob/master/all-forks.json) (canonical fork registry)
- [ACDE #241, 2026-07-16](https://github.com/ethereum/pm/issues/2157) · [ACDE #242, 2026-07-30](https://github.com/ethereum/pm/issues/2166) · [Glamsterdam Repricings #8](https://github.com/ethereum/pm/issues/2082) · [Stateless Implementers Call #51](https://github.com/ethereum/pm/issues/2030)
- [eth-clients/sepolia](https://github.com/eth-clients/sepolia) and [eth-clients/hoodi](https://github.com/eth-clients/hoodi) testnet configs
- [go-ethereum releases](https://github.com/ethereum/go-ethereum/releases) — v1.16.4 through v1.17.4
- [Erigon hardware requirements](https://docs.erigon.tech/get-started/hardware-requirements) — measured 2026-07-19
- [Hot-cold storage separation in practice (ethresear.ch)](https://ethresear.ch/t/hot-cold-storage-separation-in-practice/25119) — EIP-8188 prototype
- [ethereum/eth-rnd-archive](https://github.com/ethereum/eth-rnd-archive) — `state-tree-migration`, `state-expiry`, `8037-state-creat-gas` channels
- Live mainnet query, block 25,612,903, 2026-07-25 — gas limit verification
