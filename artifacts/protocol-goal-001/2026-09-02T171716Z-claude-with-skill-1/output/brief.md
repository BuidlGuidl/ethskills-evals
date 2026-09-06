# Ethereum State Growth: Technical & Capacity Planning Brief

**Date:** 2026-09-02
**Planning window:** Sept 2026 → Sept 2028 (24 months)
**Audience:** infrastructure team + finance
**Bottom line:** Do not budget for any protocol-level relief to *archive node* disk usage inside this window. One real change lands (Glamsterdam, mainnet 2026-11-04) and it slows the *rate* of state growth per unit of gas — but it ships bundled with gas-limit increases that consume most of that saving. Everything that would actually shrink a node (state expiry, statelessness, binary trees) has **no fork assignment at all** today. The savings you can actually book in this window are operational, not protocol.

---

## 1. What is actually driving this at the protocol level

### 1.1 Two separate growth axes — don't conflate them

| Axis | What it is | Who carries it | Protocol roadmap attention |
|---|---|---|---|
| **State** | Current accounts, balances, nonces, contract code, storage slots | Every full node and validator | High — this is what the roadmap targets |
| **History** | Historical blocks, bodies, receipts | Full nodes (partially relieved) | Medium — partially shipped |
| **Historical state** | State *at every past block* (what makes an archive node an archive node) | Archive nodes only | **Essentially none** |

This distinction is the single most important thing in this brief. Nearly every roadmap item you have read about — state expiry, statelessness, Verkle/binary trees — reduces what a **validating node** must hold. An archive node's job is precisely to retain what those proposals discard. **Relief for the network is not relief for your fleet.**

### 1.2 Why state grows the way it does

Ethereum stores state in a **hexary Merkle Patricia Trie (MPT)** — actually a "tree of trees": one global account trie, plus a separate storage trie per contract. Consequences:

- **Write amplification.** Changing one storage slot rewrites every node on the path to the root in both the storage trie and the account trie. At current state size that is roughly 8–10 internal node updates per logical write.
- **Random I/O.** In the classic (hash-based) layout, trie nodes are keyed by their own hash, so logically adjacent data is physically scattered. Reads degrade as the trie grows — access latency is a function of total state size, which is why state growth hurts *performance*, not just capacity.
- **Historically underpriced permanence.** Until Glamsterdam, a new storage slot costs 20,000 gas and a new account 25,000 gas — a one-time payment that obligates every node on the network to store those bytes forever. This mispricing, not the tree structure, is the actual economic driver of growth. The tree structure determines how *expensive* each stored byte is to serve.

### 1.3 Current measured numbers

- **Mainnet gas limit: 60M** (raised from 30M during 2025, between Pectra and Fusaka — the first significant increase since 2021).
- **State growth: ~116 GiB/year.** Daily state growth rose from ~105 MiB/day pre-increase to **~326 MiB/day** after the 30M→60M raise (figures cited in EIP-8037, Jan 2026 data). State growth scales close to linearly with the gas limit.
- **State composition:** contract storage ~81.7%, accounts ~14.1%, bytecode ~4.3%. Average ~133.6 bytes/account, ~191.3 bytes/storage slot.
- **~80% of state has not been touched in over a year** (Ethereum Foundation, "The Future of Ethereum's State", Dec 2025) — yet every node stores all of it, hot.

### 1.4 Where node footprints sit today (2026)

| Configuration | Disk |
|---|---|
| Erigon 3.x archive | **1.8–2.2 TB** |
| Geth path-based archive | ~2 TB |
| Reth archive | ~2.8 TB |
| Geth legacy hash-based archive | **12 TB+** |
| Erigon 3.3 with full historical proofs | ~4.1 TB (vs 20+ TB for naive trie-order archive layouts) |
| Full node (non-archive) | ~0.9–1.3 TB EL + 80–200 GB CL + 100–150 GB blobs |
| Path-based archive sync time | ~2 weeks |

---

## 2. What is coming to Ethereum, and how much you can bank on it

Status vocabulary used below: **Live** = active on mainnet · **SFI** = Scheduled for Inclusion in a named fork · **CFI** = Considered, not committed · **Proposed** = listed in a fork's meta EIP but with no commitment whatsoever · **No fork relationship** = research/proposal only. An EIP being "Draft", "Review" or "Final" describes *specification maturity* and says nothing about whether it will ship.

### 2.1 LIVE — already banked

**Partial history expiry (EIP-4444 partial / EIP-7639)** — shipped 2025-07-08 across all execution clients. Clients may drop all pre-merge block bodies and receipts; pre-merge *headers* are still served over devp2p. Saving: **300–500 GB, one-time**.
→ *Action item:* verify every node in your fleet has actually taken this. If any have not, it is free disk available today.

**EIP-8252 — Execution-Layer Reorg State Retention Window.** Informational, **non-forking**. Defines `REORG_RETENTION_WINDOW = 262,144` blocks (~36.4 days) as the default retention for full/blocks prune modes. Erigon's `--prune.mode=full` follows it as of v3.5. This is the standard that makes "full node" mean ~36 days of state history rather than everything — relevant to fleet tiering (§3.2).

### 2.2 SFI — Glamsterdam, mainnet **2026-11-04**

This is the one thing in the window you can plan around. Scope is governed by **EIP-7773 (Glamsterdam meta)**, which lists 18 EIPs Scheduled for Inclusion.

**Timeline confidence: high.** The mainnet date is ACD-confirmed; the fork is in its final devnet phase. Testnet path: Sepolia ~Sep 21–28 2026 (the exact date has been moved between calls and is provisional), Hoodi ~Oct 5 2026. Residual risk is slippage of weeks to a quarter, not cancellation. **Plan for Nov 2026; do not build anything that breaks if it lands in Q1 2027.**

**The state-relevant EIPs:**

**EIP-8037 — State Creation Gas Cost Increase** (the important one). Introduces a second gas dimension: *state gas*, metered at runtime, priced at a **cost-per-state-byte (CPSB) of 1,530 gas**, drawn from a dedicated `state_gas_reservoir` separate from execution gas.

| Operation | Today | After Glamsterdam |
|---|---|---|
| New account | 25,000 | **183,600** (~7.3x) |
| New storage slot | 20,000 | **97,920** (~4.9x) |
| EIP-7702 delegation indicator | — | 35,190 |
| 24 kB contract deployment | ~4.9M | **~37.8M** (~7.7x) |

Its stated purpose is to give client teams a **sustainability ceiling** — a worst-case bound on annual state growth as a function of the gas limit:

| Gas limit | Worst-case state growth bound |
|---|---|
| 100M | 80 GiB/yr |
| 150M | 120 GiB/yr |
| 200M | 160 GiB/yr |
| 300M | 240 GiB/yr |

**EIP-8038 — State-access gas cost increase.** Reprices reads/writes against benchmarked hardware: cold account access 2,600→3,000; storage write 2,800→10,000; account write 6,700→9,000; storage-clear refund 4,800→11,616. Cold `SLOAD` unchanged at 2,100. This targets **execution performance**, not growth — it is the protocol acknowledging that random state access on a large MPT has become the bottleneck.

**EIP-7928 Block-Level Access Lists** + **EIP-8159** (BAL exchange, eth/71). Lets clients know a block's full access set up front, enabling prefetch and parallel state access. This is the precondition for raising the gas limit.

Also SFI: EIP-7732 (ePBS), 2780, 7688, 7708, 7778, 7843, 7954, 7976, 7981, 7997, 8024, 8045, 8061, 8246, 8282.

#### The catch — read this part twice

EIP-8037 is **not a reduction, it is a rate limit**, and it was explicitly finalized *in order to make a gas-limit increase safe*. The Ethereum Foundation's 2026 priorities target 100M and "beyond", with the Glamsterdam repricing bundle sized to support **~200M** (≈3.3x today's 60M).

Do the arithmetic: you grow ~116 GiB/yr today at 60M. At 200M the worst-case bound is 160 GiB/yr. **The absolute growth rate is permitted to go up, not down.** What improves is growth *per unit of economic activity* — good for the network's long-run sustainability, neutral-to-negative for your disk bill.

### 2.3 SFI — Hegotá: nothing for you

Scope is governed by **EIP-8081** (Draft meta, created 2025-11-11). Scheduled for Inclusion: **exactly two EIPs** — EIP-7805 (FOCIL, censorship resistance) and EIP-8141 (Frame Transaction). **Considered for Inclusion: none. Declined: none.** Hegotá is a censorship-resistance and account-abstraction fork, not a state fork.

Timeline: eipsinsight projects mainnet 2027-05-19, but that projection is explicitly labelled *hypothetical, not a commitment* — in contrast to Glamsterdam's ACD-confirmed date. Assume H1–H2 2027 with wide error bars.

There are ~50 EIPs in Hegotá's "Proposed for Inclusion" list, which is a wish list, not a plan. The state-relevant ones:

- **EIP-8188 — Last-Written Block for Accounts and Slots.** Records, as consensus state, the block at which each account/slot was last written. Explicitly *no gas change, no state removal, no tree migration, no resurrection mechanism*. It is pure metadata — the **prerequisite** for any future expiry or hot/cold tiering scheme. Watch this: promotion from Proposed → CFI/SFI is your earliest leading indicator that state expiry is real. Even then, expiry itself would be ≥2 further forks out.
- **EIP-8372 — Normalized state gas limit** (Draft, created 2026-08-06). Refines EIP-8037's calibration with a one-time adjustment at a fork boundary based on target annual state-growth rates. Also **EIP-8368** (CPSB recalibration for a new gas limit) — note what these imply: the CPSB constant *will be retuned as the gas limit rises*, so treat the growth bound as a policy dial, not a physical law.
- **EIP-7862** (Delayed State Root), **EIP-7807** (SSZ execution blocks), **EIP-8025** (Optional Execution Proofs) — stateless-adjacent plumbing, all Proposed only.

### 2.4 NO FORK RELATIONSHIP — the things you have heard about

These are the items most likely to appear in a vendor deck or a roadmap diagram. None of them has a fork assignment. **Assign them zero weight in a 24-month budget.**

- **EIP-7864 — Unified binary tree.** Draft since 2025-01-20. Replaces the hexary MPT with a single binary tree over a faster hash (BLAKE3 / Keccak / Poseidon2 — *the hash function is still undecided*), unifying account headers, code and storage into one tree. Claims ~4x shorter Merkle branches and large proving-efficiency gains. **Not in Glamsterdam's scope. Not in Hegotá's SFI, CFI, or even its Proposed list.** It also requires a whole-state migration (EIP-7748) touching every account and contract on the network.
- **Verkle trees.** Effectively superseded by the binary-tree approach — Verkle's elliptic-curve cryptography is not post-quantum secure, and hash-only binary trees are. Any material still presenting Verkle as the plan is out of date. Note this is itself the cautionary tale: Verkle was the consensus answer for years and was then dropped. Treat the current answer the same way.
- **EIP-7736 — Leaf-level state expiry.** **Stagnant.** It is also specified *against Verkle trees*, i.e. against an abandoned design. There is currently no live, fork-assigned state expiry proposal of any kind.
- **EIP-8295 (state tiering), EIP-8297 (partitioned binary tree)** — research.
- **Rolling-window history expiry** (dropping *post*-merge history). Discussed, not assigned to a fork. The one-time pre-merge drop is all that has shipped.
- **Weak statelessness.** ethereum.org still describes it as dependent on the tree change plus PBS and "probably a few years away." Strong statelessness is explicitly not on the roadmap.

> Note: ethereum.org's `/roadmap/statelessness` page is stale — it still says EIP-4444 has not shipped, which partial history expiry contradicts. Prefer the fork meta EIPs (EIP-7773, EIP-8081) as the authoritative scope documents.

### 2.5 Summary table for finance

| Change | Status | Realistic mainnet date | Effect on our archive fleet |
|---|---|---|---|
| Partial history expiry | **Live** (Jul 2025) | shipped | −300–500 GB, one-time. Verify it is taken. |
| EIP-8252 retention window | **Live**, non-forking | shipped | Enables tiering of non-archive nodes |
| EIP-8037 state creation repricing | **SFI Glamsterdam** | **2026-11-04**, high confidence | Slows growth per unit gas; offset by gas-limit rise |
| EIP-8038 / 7928 / 7732 | **SFI Glamsterdam** | 2026-11-04 | Enables higher gas limit → **more** growth |
| Gas limit 60M → 100M → 200M | Policy, post-Glamsterdam | rolling, 2027+ | **Increases** absolute growth rate |
| EIP-8188 last-written-block | **Proposed only** (Hegotá) | not committed | None directly; precursor to expiry |
| State expiry (any form) | **No fork relationship** | not in window | Would not help archive nodes anyway |
| Binary tree (EIP-7864) | **No fork relationship** | not in window | Would not help archive nodes anyway |
| Statelessness | **No fork relationship** | "a few years" | Would not help archive nodes anyway |

---

## 3. What to do in the meantime

Every recommendation below holds regardless of whether any unscheduled proposal ships.

### 3.1 Plan capacity off the gas-limit trajectory, not the roadmap

Rebuild the capacity model as a function of the gas limit, with two scenarios:

- **Scenario A (conservative):** gas limit reaches ~100M by end-2027. State growth bound 80 GiB/yr, realistic growth in the 90–120 GiB/yr range.
- **Scenario B (aggressive):** gas limit reaches 200M by end-2027, as the Glamsterdam bundle is sized for. State growth bound 160 GiB/yr; **archive-relevant** growth (historical state diffs, receipts, traces) scales with transaction throughput, so model roughly **3x current archive accumulation rate**.

Budget Scenario B and treat Scenario A as upside. The gas limit is set by validator voting, not by a fork, so it can move at any time without a scheduled event to plan against — this is the largest single uncertainty in your model and it is *not* on any fork calendar.

**Measure your own archive delta.** Public archive-size figures are total footprints, not growth rates, and they are not comparable across clients or pruning configs. Take the last 90 days of per-node disk deltas from your own fleet, annualize, and scale by the gas-limit scenario. That number is far more trustworthy than anything published.

### 3.2 Tier the fleet — stop running uniform archive

This is the largest available saving and it needs no protocol change. Most query volume hits recent state; you are paying archive prices to serve it.

- **Tier 1 — hot RPC:** full nodes at the EIP-8252 retention window (~36 days). Covers the overwhelming majority of real query traffic at ~1.0–1.3 TB instead of ~2 TB+, and syncs in a fraction of the time.
- **Tier 2 — deep history:** a deliberately small number of true archive nodes, sized for the tail of historical queries. Rate-limit and queue against them rather than scaling them horizontally.
- **Tier 3 — analytics:** columnar extracts (Parquet on object storage) for workloads that need historical *data* but not an EVM. Most "we need an archive node" requirements are actually this, and this tier is an order of magnitude cheaper per TB.

This is precisely the hot/cold separation the protocol may eventually adopt, implemented out of protocol. The EF's own Dec 2025 position is that out-of-protocol archive solutions and RPC improvements are "immediately useful and forward-compatible" — i.e. this work is not wasted if the protocol later catches up. Supporting evidence: an EPF prototype moved ~58% of trie nodes cold at a 2-year inactivity threshold for ~21.6% total storage reduction (compressed).

### 3.3 Fix the client mix — immediate, large, zero protocol dependency

If any archive node is still on **legacy hash-based Geth (12 TB+)**, migrating it is the single biggest win available to you today: several terabytes per node, no fork required. Target **Erigon 3.x (1.8–2.2 TB)** as the archive default; it is the most space-efficient archive implementation currently available. Be aware of the tradeoff before standardizing: Reth's archive functionality is materially more limited for deep historical serving, and Erigon's full historical-proofs data model (v3.3) is a separate ~4.1 TB commitment you should only take on nodes that actually need to serve proofs.

### 3.4 Buy for IOPS and endurance, not just capacity

EIP-8038 exists because state *access* latency, not capacity, is what degrades as state grows. Specify NVMe on random-read IOPS and write endurance (DWPD — LSM compaction on a 2 TB+ database is brutal on consumer drives), not on £/TB. Size disks with **18 months of headroom** in Scenario B, and prefer configurations where storage can be grown or swapped without a resync.

### 3.5 Treat sync/restore time as an SLO

Sync time is the pain no protocol change in this window fixes — a path-based archive sync is ~2 weeks, and nothing scheduled improves that. Mitigation is entirely operational:
- Maintain a snapshot/restore pipeline with warm snapshots in object storage.
- Define and track "time to restore an archive node" as an explicit SLO.
- **Test restore quarterly.** An untested snapshot pipeline is the difference between a 4-hour incident and a 2-week one.
- Never let a capacity upgrade require a resync — that converts a hardware cost into an availability incident.

### 3.6 Audit for Glamsterdam gas repricing breakage — deadline 2026-11-04

This is a real, dated engineering task, not a capacity issue, and core devs have publicly warned it will break wallets and gas tooling. Before November:
- Find every hardcoded **21,000** intrinsic-gas assumption (EIP-2780 changes it).
- Find every hardcoded deployment gas estimate — a 24 kB deploy goes from ~4.9M to ~37.8M gas.
- Any internal simulator, indexer, or replay tool with a fixed gas schedule needs **per-fork gas schedules**, since replaying historical blocks and simulating current ones will require different tables.
- Anything modelling gas as one-dimensional needs to understand `state_gas_reservoir` — EIP-8037 makes gas two-dimensional.

### 3.7 Watch list — specific, dated triggers

Review at each ACD call; escalate to a planning change only on these:

1. **Glamsterdam mainnet, 2026-11-04**, and the Sepolia/Hoodi forks preceding it. Slippage past Q1 2027 would be the first real signal of trouble.
2. **Gas-limit votes after Glamsterdam.** This drives your budget more than any EIP. A move toward 200M is the trigger to re-run Scenario B.
3. **EIP-8188 promotion** from Proposed → CFI/SFI in Hegotá's meta (EIP-8081). Earliest credible signal that state expiry is becoming real — and still ≥2 forks from any actual expiry.
4. **Any binary-tree EIP receiving a fork assignment at all.** Until that happens, statelessness timelines are not forecastable. When it does, note the migration itself (EIP-7748) is a months-long, every-account operation.
5. **Rolling-window (post-merge) history expiry** getting a fork assignment — the one remaining item that would deliver a genuine step-down in full-node disk.

### 3.8 The line for finance

> Assume **no protocol-level relief for archive nodes** within the 18–24 month planning window. Assume per-node archive footprint continues to grow, at a rate that **increases** if the gas limit rises as planned. The savings bookable in this window are operational: client migration off legacy Geth, fleet tiering, and moving analytics workloads off archive nodes. Budget hardware refresh on the current trajectory, scaled to the gas-limit scenario, with 18 months of headroom.

---

## Appendix: sources checked and confidence notes

**Authoritative fork scope** (checked 2026-09-02):
- [EIP-7773 — Hardfork Meta: Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773) — 18 EIPs SFI
- [EIP-8081 — Hardfork Meta: Hegotá](https://eips.ethereum.org/EIPS/eip-8081) — Draft, created 2025-11-11; only EIP-7805 and EIP-8141 SFI
- [EIP-8037 — State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-8038 — State-access gas cost increase](https://eips.ethereum.org/EIPS/eip-8038)
- [EIP-8372 — Normalized state gas limit](https://eips.ethereum.org/EIPS/eip-8372) — Draft, created 2026-08-06
- [EIP-8188 — Last-Written Block for Accounts and Slots](https://eips.ethereum.org/EIPS/eip-8188)
- [EIP-7864 — Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) — Draft, no fork relationship
- [EIP-7736 — Leaf-level state expiry in verkle trees](https://eips.ethereum.org/EIPS/eip-7736) — Stagnant
- [EIP-7927 — History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927) — Stagnant, predates Pectra

**Status, timeline and measurement:**
- [ethereum.org — Glamsterdam](https://ethereum.org/roadmap/glamsterdam/) · [ethereum.org — Statelessness/state expiry/history expiry](https://ethereum.org/roadmap/statelessness/) (stale on EIP-4444)
- [eipsinsight — Upgrade Schedule](https://eipsinsight.com/upgrade/schedule) — Glamsterdam mainnet 2026-11-04 ACD-confirmed; Hegotá 2027-05-19 projected only
- [EF Blog — The Future of Ethereum's State (Dec 2025)](https://blog.ethereum.org/2025/12/16/future-of-state)
- [EF Blog — Partial history expiry announcement (Jul 2025)](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [EF Blog — Protocol Priorities Update for 2026](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [EF Blog — Glamsterdam Repricing Impact for Smart Contract Developers (Aug 2026)](https://blog.ethereum.org/2026/08/24/glamsterdam-repricing-testing)
- [EF Blog — Checkpoint #9, Apr 2026](https://blog.ethereum.org/2026/04/10/checkpoint-9)
- [ethresear.ch — Hot-Cold Storage Separation in Practice (Jun 2026)](https://ethresear.ch/t/hot-cold-storage-separation-in-practice/25119)
- [Paradigm — How to Raise the Gas Limit, Part 1: State Growth](https://www.paradigm.xyz/2024/03/how-to-raise-the-gas-limit-1) (state composition figures, 2024)
- [Erigon docs — Pruning Modes](https://docs.erigon.tech/fundamentals/pruning-modes) · [Erigon v3.3 Historical Proofs Data Model](https://erigon.tech/erigon-v3-3-introducing-the-historical-proofs-data-model/)
- [The Defiant — Glamsterdam final devnet phase, 200M gas target](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [The Block — EF researchers on state bloat](https://www.theblock.co/post/383156/ethereum-foundation-researchers-warn-of-storage-burden-from-state-bloat)

**Confidence caveats:**
- forkcast.org is client-side rendered and could not be read programmatically. Fork scope was verified directly against the authoritative fork meta EIPs (EIP-7773, EIP-8081) on eips.ethereum.org instead, which is the same data at its source.
- The Glamsterdam **Sepolia** date has moved between calls (Sep 21 vs Sep 28, 2026) and remains provisional. The **mainnet** date of 2026-11-04 is ACD-confirmed.
- Hegotá's timeline is a projection published for planning purposes and explicitly not a commitment. Its scope is a Draft meta and will change.
- Node footprint figures are vendor/community-reported totals, not growth rates, and vary with pruning config. Use them for client comparison only; derive growth rates from your own fleet telemetry (§3.1).
- State composition percentages date from 2024 and are directionally, not precisely, current.
