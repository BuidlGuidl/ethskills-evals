# Technical Brief: Ethereum State Growth — Causes, Protocol Roadmap, and Operational Plan

**Date:** September 23, 2026
**Audience:** Infrastructure team, Finance
**Planning horizon covered:** through mid-2028 (18–24 months)

---

## Executive summary

- Ethereum state grows monotonically by protocol design: nothing in the current protocol deletes state, and every gas limit increase raises the growth rate. As of early 2026 the state was ~390 GiB and growing ~326 MiB/day (~116 GiB/year) after the gas limit went 30M → 60M.
- The **only near-certain protocol relief inside our planning window is pricing, not deletion**: the Glamsterdam fork (mainnet target Q4 2026, December is aspirational) includes EIP-8037, which raises state-creation gas costs ~5–8× and meters them separately, explicitly targeting state growth of ≤120 GiB/year even at a 150M gas limit. This slows growth; it does not shrink state.
- **Verkle trees and state expiry — the changes that would actually cap or shrink state — are not bankable within 24 months.** Verkle is not in Glamsterdam and is not confirmed in the Hegotá scope (2027) either; state expiry is a stagnant EIP that depends on Verkle. Treat both as post-2028 events for budgeting purposes.
- The real, immediate lever is **client software, not the protocol**: archive footprints now range from ~2 TB (Erigon/Reth, or Geth's new path-based archive) to 20+ TB (legacy Geth hash-based archive) for identical data guarantees. If we are still running legacy Geth archives, migrating is worth more than any protocol change on the roadmap.
- **Budget guidance:** plan for state to grow 100–160 GiB/year (base case) with a downside case of 250+ GiB/year if gas limits reach 200M+ and demand proves inelastic. Provision NVMe capacity and IOPS headroom accordingly; do not defer hardware purchases in expectation of protocol-level state relief.

---

## 1. Why state grows: the protocol-level mechanics

### 1.1 What "state" is

Ethereum's execution state is a key-value database structured as a Merkle Patricia Trie (MPT). It contains, for every account that has ever held a balance, code, or storage: the account's nonce, balance, code hash, and the root of its per-contract storage trie. As of January 2026 this database is ~390 GiB in a Geth full node and contains hundreds of millions of accounts and billions of storage slots.

Three properties of the design drive our costs:

1. **Monotonic growth.** Once written, state persists forever. There is no rent, no TTL, and no deletion. EIP-6780 (shipped in Dencun, March 2024) neutered `SELFDESTRUCT` so it no longer removes contracts except within the same transaction. Every new account, storage slot, and deployed contract is a permanent addition to the dataset every node must hold.
2. **Random-access read/write at block cadence.** Executing a block requires scattered reads and writes across this trie (average trie depth ~8–9 database lookups per state access). This is why state must live on fast NVMe, why IOPS — not raw capacity — is our real constraint, and why performance degrades as the state outgrows RAM caches. The community "bloatnet" benchmarking initiative identified ~650 GiB as the threshold where state access times degrade sharply (~40% slower), memory consumption rises non-linearly, and sync times stretch.
3. **Throughput increases compound the problem.** State growth scales roughly linearly with the gas limit. Measured: ~105 MiB/day of new state at a 30M gas limit; ~205 MiB/day at 36M; ~326 MiB/day (~116 GiB/year) at 60M. The gas limit is 60M today (raised from 45M in November 2025, standardized as the default in the Fusaka fork, December 2025), and core developers are actively testing 200M in Glamsterdam devnets, with "toward and beyond 100M" an explicit EF protocol priority for 2026. Ethereum Foundation modeling (Nov 2025) projects total state size by mid-2027 of:
   - **686 GiB** under a conservative gas-limit schedule (200M by mid-2027)
   - **859 GiB** under the base schedule (400M)
   - **1.08 TiB** under an aggressive schedule (700M)

   All three scenarios cross the 650 GiB bloatnet threshold. Note these models assume *no repricing*; see §2.2.

### 1.2 Full nodes vs. archive nodes

A pruned full node keeps only recent state (Geth default: the last 128 blocks' tries plus the head state) and is ~650–700 GB today, growing ~14 GB/week between offline prunes. An **archive node** additionally retains the state at *every historical block height* — this is what makes `eth_call` / `eth_getBalance` / `debug_trace` against arbitrary old blocks fast. That retention is what we sell, and it is where our disk growth concentrates. Archive size is almost entirely a function of client storage architecture, not the protocol:

| Client / mode | Mainnet archive size (2026) | Notes |
|---|---|---|
| Geth, legacy hash-based archive | 12–20+ TB, ~5 GB/day | Sync from genesis takes weeks–months. Historical `eth_getProof` supported. |
| Erigon 3 / Reth archive | ~1.8–2.2 TB | Sync 1–2 weeks. Same query surface. The cost-efficient default today. |
| Geth v1.16+ path-based archive | ~1.9–2.2 TB | New mode; reverse-diff state history. **Caveat: historical `eth_getProof` not yet supported.** |

### 1.3 History vs. state — a distinction that matters to us

"State" (current account/storage data) and "history" (old blocks, transactions, receipts) are separate datasets with separate roadmaps. History expiry (EIP-4444) is live in a partial form since May 2025: all major clients can drop pre-Merge block bodies/receipts, saving 300–500 GB on full nodes. Rolling full history expiry is still being worked on, with the Portal Network and community era-file mirrors as the intended retrieval layers. **This helps full-node operators, not us** — if anything it increases the scarcity value of the complete history and archive state we maintain. Our growth problem is state, and only the items in §2 address it.

---

## 2. What is coming at the protocol level, and how much to bank on it

Ordered by confidence within our 18–24 month window.

### 2.1 HIGH confidence — Glamsterdam repricing (EIP-8037 / EIP-8038), Q4 2026 – Q1 2027

Glamsterdam is the next fork. Sepolia testnet activation is scheduled for October 6, 2026 (tentative, after Devnet-11 stabilized on Sept 17); Hoodi ~Oct 27; mainnet officially "Q4 2026" with December aspirational and slippage into early 2027 entirely plausible.

Two scheduled EIPs directly address state:

- **EIP-8037 (State Creation Gas Cost Increase):** introduces a harmonized cost per new state byte (`CPSB = 1,530` gas), raising state-creation costs ~5–8× (new storage slot: 20,000 → 97,920 gas; new account: 25,000 → 183,600; contract deployment ~8×). State-creation gas is metered in a separate dimension so it doesn't crowd out execution throughput. The cost is explicitly calibrated to keep state growth at **~120 GiB/year even at a 150M reference gas limit**. This is already implemented in clients (e.g., reth) and live on devnets.
- **EIP-8038:** raises the cost of *accessing* state (SLOAD/SSTORE/cold account access) to match measured performance at current state sizes.

**What this means for us:** this is a growth-rate brake, not a shrink. If demand for state creation is price-elastic, growth could fall well below 120 GiB/year; if inelastic, it stays near target but fees rise. Either way the ~326 MiB/day era likely ends with Glamsterdam. Bank on this landing; do not bank on the exact growth outcome — elasticity of demand for state creation is genuinely unknown (the EF's own modeling sweeps elasticities across a 15× range).

### 2.2 MEDIUM confidence — history expiry completion, Portal Network maturity (2026–2028)

Rolling (not just pre-Merge) history expiry is "ongoing work" per the EF. The Portal Network is live but explicitly "not yet fully production-ready." Neither affects our archive-state storage, but both matter strategically: as ordinary nodes drop history, demand concentrates on archive providers (us), and Portal/era-files become a plausible retrieval layer for cold data we may eventually want to tier rather than keep hot.

### 2.3 LOW confidence within 24 months — Verkle trees (earliest realistic: 2028)

Verkle replaces the MPT with a vector-commitment tree, shrinking proofs ~23× and enabling **stateless validation** — nodes that verify blocks from a witness bundled with the block instead of a local state database. This is the actual long-term answer to state-as-a-burden.

Current status, September 2026:

- Verkle testnets have run for years, but the work was **de-scoped from Glamsterdam** and is **not confirmed in Hegotá's scope either** — Hegotá (2027) has FOCIL and frame transactions scheduled, with ~66 EIPs competing for the remaining slots. One EF-adjacent report earlier this year claimed Verkle was "bundled into Hegotá," but the official roadmap pages (updated September 2026) do not confirm this. Client teams submitted Hegotá preferences on September 10; scope will firm up over the coming weeks — **watch the Hegotá PFI list; it is the single most decision-relevant signal for our 2028 planning.**
- Even if Verkle lands in Hegotá (optimistic), mainnet would be late 2027 at the earliest, and Hegotá has already slipped once.
- There is a live contingency debate about replacing Verkle with binary Merkle trees + SNARKs (better quantum posture, aligned with the "lean Ethereum" direction). That path would reset parts of the timeline.
- **Crucially for us:** even when Verkle ships, it lowers the burden for *validators and full nodes*. Someone still has to store and serve the full state and its history — that is exactly our business. Verkle does not reduce archive-operator storage; if anything, stateless clients outsource more queries to providers like us.

### 2.4 ASPIRATIONAL — state expiry (do not budget for it)

State expiry (EIP-7736 and predecessors) would let nodes delete state untouched for ~2 epochs (~1 year), with a paid "resurrection" transaction to revive it. Status: the EIP is marked **Stagnant**, it depends on Verkle shipping first, and no fork has it on the schedule. It is a post-Verkle, multi-year item at best. For capacity planning, treat it as non-existent before 2029.

### 2.5 Not relevant to state: blob/PeerDAS scaling

Fusaka's PeerDAS (December 2025) scales L2 blob data. Blobs are pruned after ~18 days regardless, so this does not touch our state or archive footprint.

---

## 3. What we should do in the meantime

### 3.1 Immediate (this quarter)

1. **Migrate archive nodes off legacy hash-based storage.** Erigon 3 or Reth archive at ~2 TB vs. 12–20+ TB for legacy Geth archive is a ~5–10× reduction for the same RPC surface, with 1–2 week syncs instead of months. If we need historical `eth_getProof`/Merkle proofs (compliance, zk workflows), that is the one gap in both Erigon and Geth's new path-based archive — keep at most one legacy Geth archive (or a bounded-range proof node) for that workload, not a fleet of them.
2. **Standardize full nodes on 2 TB NVMe with scheduled pruning.** Snap-synced Geth sits ~650–700 GB and grows ~14 GB/week between prunes. Enable pre-Merge history expiry (Geth `--history.chain postmerge`, Erigon `--history-expiry`, etc.) to reclaim another 300–500 GB.
3. **Instrument growth.** Record per-node weekly disk usage and derive our own empirical GiB/week rates per client. The gap between client storage engines is now larger than the gap between protocol scenarios; our forecasts should be per-client, not per-chain.

### 3.2 Capacity plan for the 18–24 month window

Base case (assumes Glamsterdam repricing lands Q4 2026–Q1 2027 and works as calibrated):

| Dataset | Today (approx) | Mid-2028 projection |
|---|---|---|
| Head state (per full node) | ~400–450 GiB | ~650–800 GiB |
| Erigon/Reth archive | ~2 TB | ~2.8–3.5 TB |
| Geth path-based archive | ~2 TB | ~3–3.5 TB |
| Geth full node (pruned) | ~700 GB | ~1.0–1.3 TB |

Downside case (gas limit reaches 200–300M post-Glamsterdam and state demand is price-inelastic): add 150–250 GiB/year to every line. This is the scenario that breaches the 650 GiB bloatnet threshold and degrades I/O latency — the response is more RAM per node (cache), not just more disk.

Procurement guidance:

- **Buy for the downside case.** 4 TB enterprise NVMe per archive node is the safe unit for the whole window; 8 TB if we want to defer a mid-window refresh. Disk is cheap; emergency migrations are not.
- **Prioritize IOPS and RAM over capacity.** As state passes 650 GiB, access latency and cache hit rates become the binding constraint. Budget 128 GB RAM per archive node now; consider 192–256 GB for the 2027 refresh.
- **Do not postpone purchases waiting for Verkle/state expiry.** That relief is (a) outside the window and (b) aimed at full nodes, not archives.

### 3.3 Strategic positioning

- **Our data is becoming scarcer by design.** History expiry + eventual statelessness means fewer entities hold complete history and state. Our archive fleet is appreciating infrastructure, not just a cost center — this belongs in the finance narrative.
- **Track two decision signals:** (1) Glamsterdam mainnet date confirmation after the October 6 Sepolia fork; (2) the Hegotá scope/PFI list — if Verkle is formally included with client commitment, we revisit 2028 plans; if not, the "no protocol state relief before 2029" posture is confirmed.
- **Evaluate Portal Network / era files for cold tiering** during 2027. Not production-ready today, but it is the sanctioned direction for historical-data retrieval and could let us serve very cold ranges from cheaper storage by 2028.

---

## Appendix: key sources

- EIP-8037 (State Creation Gas Cost Increase), incl. Jan 2026 measurements: state ~390 GiB, +326 MiB/day at 60M gas limit — eips.ethereum.org/EIPS/eip-8037
- EIP-8038 / Glamsterdam repricing testing guidance — blog.ethereum.org, Aug 24, 2026
- EF state growth scenario modeling — ethresear.ch, Nov 2025 (686 GiB / 859 GiB / 1.08 TiB by mid-2027)
- Glamsterdam status (Sepolia Oct 6, 2026; Devnet-11 at 200M gas) — ACDC #186 outcomes, Sept 2026; ethereum.org/roadmap/glamsterdam
- Hegotá scope status (FOCIL + frame txs only; Verkle unconfirmed) — ethereum.org/roadmap/hegota, updated Sept 1, 2026
- Verkle EIPs: 6800 (unified tree), 7612 (overlay), 7748 (state conversion); EIP-7736 (leaf-level state expiry, status: Stagnant)
- EIP-4444 partial history expiry rollout — blog.ethereum.org, Jul 8, 2025
- Geth v1.16 path-based archive (~2 TB; no historical eth_getProof) — geth.ethereum.org/docs/fundamentals/archive
- Erigon 3 archive footprint (~1.8–2.2 TB) — docs.erigon.tech
- Bloatnet ~650 GiB performance threshold — bloatnet / EF research
