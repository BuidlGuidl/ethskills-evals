# Technical Brief: Ethereum State Growth — Causes, Protocol Roadmap, and Planning Guidance

**Date:** 2026-09-23 · **Audience:** infrastructure team + finance · **Planning window:** ~18–24 months (through Q3 2028)

Sources: forkcast.org, ethereum/EIPs repo (EIP-7773, EIP-8081, EIP-4444, EIP-7864, EIP-8297, EIP-8252, EIP-6800, EIP-7607), Ethereum Foundation blog, Erigon/Geth/Reth docs, AllCoreDevs/EthMagicians notes. Web sources used where primary sources required supplementation.

---

## 1. Why state keeps growing (protocol-level mechanics)

Ethereum's execution state is the set of all accounts, balances, nonces, contract code, and storage slots. It is committed to as a **hexary Merkle Patricia Trie (MPT)** — roughly 400M+ accounts — and every new account, storage slot, or deployed contract adds permanent entries to that trie.

Three structural facts drive the disk problem:

1. **Storage slots dominate.** State isn't uniform; per the binary-tree design analysis (EIP-8297), contract storage is "the largest state category by a wide margin." Each `SSTORE` to a fresh slot creates ~100 bytes of consensus state forever.
2. **State creation was historically underpriced.** Creating state (2102 gas for cold SSTORE, 200 for slots after Glamsterdam repricing is rebalanced upward) has been cheap relative to the long-term cost nodes bear. L1 block gas limit increases over the past two years (on the order of 60M today, with 400–600M targets being discussed post-Glamsterdam) directly increase the *rate* at which state can grow.
3. **Archive = full state + all historical states.** A pruned full node keeps current state only (plus short reorg windows). An archive node additionally retains state history for every block — the delta between full and archive grows monotonically with chain history, independent of current state size.

Current footprints (mainnet, Sep 2026 — treat as ranges):

- **Full node (pruned):** ~650 GiB (Geth with pre-merge history pruned) to ~1.2–1.5 TB depending on client/config. Growth ≈ 7–14 GiB/week between prunes (Geth).
- **Archive:** Erigon ~2.0 TB (Erigon's own Jun 2026 measurements: 2.03 TB), Geth path-based archive ~2.2 TiB (Geth v1.16+ mode), Reth ~2.5–3 TB. **Legacy Geth hash-based archive: 12–20+ TB** and months to sync.
- **Pre-merge history (blocks+receipts):** ~400 GB, now optionally prunable.

The pre-merge-history pruning option (phase 1 of EIP-4444) has shipped in all major clients since mid-2025 and saves ~300–500 GB on full nodes. **Glamsterdam's next mainnet activation is currently the practical floor for the second figure here.**

## 2. What is coming at the protocol level — and how much to bank on it

Here is the complete pipeline, graded by EIP-7723 status. The headline: **nothing on the roadmap reduces archive disk; the protocol's levers reduce the *rate* of state growth and the footprint of *full* nodes.**

### 2a. High confidence (within planning window)

**Glamsterdam — scope frozen, all items SFI (meta EIP-7773), targeting Q4 2026.** Two of its scheduled EIPs are the protocol's first direct state-growth throttles:

- **EIP-8037 (State Creation Gas Cost Increase):** raises the cost of creating new accounts/storage/code, slowing net state growth and buying headroom for higher gas limits.
- **EIP-8038 (State-access gas cost update):** rebalances costs of touching state.
- **EIP-7928 (Block-Level Access Lists):** parallel execution/read enabler — improves sync/execution speed, does not shrink state.

These **flatten the growth curve**; they do not reduce the state or let you drop archive hardware. Bank on them landing (SFI means devnet-tested and effectively committed), but treat their effect as "slower accumulation," not relief.

**History expiry, phase 1 (EIP-4444, coordinated outside a fork):** shipped client-side since May–July 2025. All EL clients can drop pre-merge block bodies+receipts; ~300–500 GB savings for full/validator nodes. Bankable *for full nodes*. **Side effect for us as archive operators:** pre-merge history availability on the p2p network degrades over time, so bootstrap/backup of pre-merge data increasingly relies on out-of-band sources (ERA files, torrents, Portal Network; see https://eth-clients.github.io/history-endpoints/).

**Glamsterdam → mainnet target Q4 2026; Hegotá (the fork after, EIP-8081) currently targets late 2026–early 2027:**

### 2b. Medium confidence (candidates, not committed)

**Hegotá scope (draft; headliners SFI = FOCIL EIP-7805 + Frame Transactions EIP-8141; everything else open).** EF Protocol Architecture has proposed further **repricing/state-growth EIPs** as candidates (EIP-8131 unified data floor, EIP-8279 BAL byte floor, EIP-8368 state-creation cost recalibration). Not settled; direction plausible. Treat any Hegotá relief as a bonus, not a plan.

**Full rolling history expiry (EIP-4444 phase 2):** EIP itself is marked **Stagnant**; cadence discussion continues in client coordination channels. It targets blocking old *chain history* (headers/bodies/receipts) retention, **not state** — it helps full-node baseline disk, not our archive nodes that must keep history anyway.

### 2c. Low confidence / aspirational — explicitly do NOT bank on this inside 24 months

**State-tree redesign (the "big" statelessness enabler):**
- Verkle trees (EIP-6800) were deprioritized 2024–2026 over post-quantum cryptography concerns (Verkle depends on elliptic curves) and improving SNARK provers.
- Current direction: **EIP-7864 "unified binary tree" (status: Draft)**, ~hash-only, with an even newer variant proposal, **EIP-8297 (Partitioned Binary Tree, 2026)**. Hash function (BLAKE3/Poseidon2/Keccak) still TBD; Geth has *experimental* open bintrie PRs (draft). **Not scoped for any fork.** Erigon/geth-style draft implementations exist but devnet-ready implementation matrices do not.

**Statelessness & state expiry (EIP-7736 class):** the tree redesign is the gate for eventual per-epoch/per-region state expiry (EIP-8297's design explicitly notes expiry integration points, with mechanism left to a separate EIP). This is the only*thing that would structurally shrink state — and it is behind the tree transition queue-wise. **Not scheduled; assume >24-month horizon at best, and remember: even partial statelessness primarily frees *validators/builders* from holding state — archive-service operators still hold state by definition.**

**ZK/distributed-storage roadmap items (optional proofs EIP-8025, Portal state network, distributed archives):** research/experimental tracks; none forgive the need for archive data.

### Bottom line for capacity planning

- **Plan on the state growing, but a bit slower per unit of throughput** after Glamsterdam's repricing.
- **No protocol change within 18–24 months will shrink archive-node disk.** Any state-tree/state-expiry relief is, on current fork status, a 2+ years-out aspirational item (EIP status Draft; Grothendieck no devnet scope).
- **Our budget shouldn't bank on EIP-7864, EIP-7736, or EIP-8297 today.** Track forkcast.org, and re-run this assessment each fork scope freeze (~every ~9 months).

## 3. What to do in the meantime

1. **Right-size node types.** Default fleet to pruned full nodes (with pre-merge history expiry enabled) for validation and current-state RPC. Run archive only where historical state/traces are actually required.
2. **Migrate archive fleet to efficient clients:**
   - Geth hash-based archival → Geth **path-based archive** (~2 TB vs 12–20+ TB) — **caveat:** no historical `eth_getProof` beyond the recent window; audit whether your products need proofs-at-height before switching.
   - Or Erigon (~2 TB, best archive economics today) / Reth (~2.5–3 TB).
   - For the legacy hash-based nodes you keep for proofs, consider time-slicing/sharding instead of full-range archives.
3. **Turn on history expiry where appropriate:** `--history-expiry` / equivalent on full nodes saves ~300–500 GB. For archive nodes, source pre-merge data from ERA files/Portal/torrents before p2p availability thins further.
4. **Budget with growth, not static figures:** model ~7–14 GiB/week EL growth per full node plus client-specific headroom and compaction headroom (target ≤60–70% disk utilization; many vendors recommend ≥2x worst-case headroom). Archive headroom grows with chain history on top of state growth. Assume **Glamsterdam repricing flattens, not reverses**, the curve; re-baseline after its mainnet activation (~Q4 2026).
5. **Operational hygiene:** scheduled offline prune loops (Geth full nodes), explicit soft-delete testing, segregated CL/EL volumes, and flag the trend that *default pruning is getting more aggressive* — e.g., Erigon v3.5 full mode now retains only the last 262,144 blocks per EIP-8252 (an Informational reorg-retention window). Don't assume today's default preserves history you rely on.
6. **Watch and re-evaluate:** re-check EIP-7864/8297 and Hegotá/following-fork scopes on forkcast.org after each scope freeze; the moment a state-tree EIP goes CFI→SFI, revisit the archive-procurement ceiling for hardware procured beyond ~18 months.

## 4. Tracking sources

- forkcast.org — EIP status (CFI/SFI/DFI), devnet matrices, ACD call summaries.
- EIP-7773 (Glamsterdam meta), EIP-8081 (Hegotá meta).
- EIP-4444 (history expiry, Stagnant), EIP-7864 / EIP-8297 (binary tree, Draft), EIP-7736 (expiry design), EIP-8252 (retention floor, Informational).
- Client docs: Geth archive modes, Erigon pruning modes, Reth db stats.

— Prepared 2026-09-23. Reassess after Glamsterdam activation and Hegotá scope freeze.
