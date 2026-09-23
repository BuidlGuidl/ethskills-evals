# Ethereum State Growth: Technical Brief for Capacity Planning

**Prepared:** September 23, 2026
**Planning window:** 18–24 months (through ~Q3 2028)
**Audience:** Infrastructure engineering + Finance

---

## 1. Executive summary

1. **Two separate problems get conflated as "state growth," and they have different fixes.**
   *History* (old blocks and receipts) is already pruneable today and rolling expiry is being standardized now. *State* (accounts, contract storage, code — ~350M accounts, ~340 GiB+ of live data) never shrinks under the current protocol and is the real long-term cost driver.
2. **What you can bank on inside the window:**
   - **Glamsterdam (~Dec 2, 2026):** state-creation and state-access gas repricings (EIP-8037, EIP-8038) — the first protocol-level measures that actually *slow* state growth. Also Block Access Lists (EIP-7928) and ~5 months of default history retention across clients.
   - **Hegotá (~mid-2027):** follow-up state-cost recalibration if gas limits rise (EIP-8368/8372), further retention-window cuts (EIP-8383), and likely a trustless log index (EIP-8304) relevant to our query product.
3. **What you cannot bank on inside the window:** the binary state tree (EIP-8297 Partitioned Binary Tree + EIP-8347 migration) is targeted at the fork *after* Hegotá ("fork I*", realistically 2028+). State expiry — actually deleting cold state — is still research-stage with no fork assignment. Plan storage as if neither lands before Q3 2028.
4. **What's dead:** Verkle trees. Superseded by the binary tree design for ZK- and quantum-resistance reasons. Ignore any article still saying "Verkle is coming."
5. **The biggest near-term uncertainty is not technical — it's the gas limit.** Measured state growth roughly doubles when the gas limit goes up ~20% (102 → 205 MiB/day when 30M → 36M). Repricing mitigates this, but capacity plans should model state growth scaling with the gas limit, which the community is actively pushing upward.
6. **Bottom line for budgeting:** archive disk grows on the order of ~1.5–2 TB/yr on a Geth-class archive and a few hundred GB/yr on a compressed (Reth/Erigon) archive at current gas limits, with the gas-limit trajectory the dominant swing factor. Client choice (Reth/Erigon vs Geth) moves our archive cost by roughly 5x — that's a bigger lever inside the window than anything the protocol will ship.

---

## 2. What's driving this at the protocol level

### 2.1 Two growth vectors

| | History (blocks, receipts, headers) | State (accounts, storage slots, code) |
|---|---|---|
| Grows with | Every block, forever | Every new account/slot/contract ever touched |
| Ever shrinks? | Yes — prunable (EIP-4444) | No — append-mostly since Dencun (EIP-6780 neutered SELFDESTRUCT deletion) |
| Current status | Pre-merge pruning live since Jul 2025; rolling expiry aligning across clients now | No expiry mechanism in protocol; ~350M accounts, growing |
| Full-node cost | ~300–500 GB prunable immediately (pre-merge); post-merge grows ~few hundred GB/yr | ~340+ GiB live state, ~205 MiB/day new state at 36M gas (measured, 2025) |
| Archive-node cost | Dominates Geth archive (~20–22 TB total, ~5 GB/day) | Erigon/Reth store the same archive in ~3.5–4 TB via flat-state layout |

### 2.2 How Ethereum stores state today

- Execution state lives in a **hexary Merkle Patricia Trie (MPT)** — keccak-hashed, RLP-encoded nodes, with separate account and per-contract storage tries. To serve proofs, every trie node ever created must be kept on disk in archive mode; that's why Geth archives are ~5x a flat-state archive.
- Modern clients (Geth, Nethermind, Reth, Besu) keep a **flat key-value snapshot alongside the trie** for fast reads — so full nodes pay for state roughly twice (snapshot + trie), minus pruning.
- **Nothing in the protocol ever removes state.** Gas pricing makes creating state cheap-ish (SSTORE ~20k gas warm), and the storage-clear refund meant to encourage cleanup is gamed instead of used (EIP-3298, proposed for Hegotá, would remove it entirely).
- Archive mode additionally retains **every intermediate state trie at every block** — 20+ years of compounding writes with zero garbage collection.

### 2.3 Performance effects (why this isn't just a disk bill)

The EF's **BloatNet** stress network identified a practical danger zone at **~650 GiB of state**: ~40% slower state access, exponentially higher memory consumption, longer syncs. Unpriced growth scenarios put mainnet state at **686 GiB (conservative) to 1.08 TiB (aggressive) by mid-2027** *without* repricing. This is precisely why EIP-8037/8038 are shipping in Glamsterdam — the repricings were measured to materially slow growth across all demand-elasticity regimes. Growth doesn't stop; it gets taxed.

### 2.4 The gas-limit coupling — the number finance should track

- State creation scales roughly linearly with block gas limit. Measured: ~102 MiB/day at 30M gas, **~205 MiB/day at 36M gas** (the Fusaka-era limit).
- The community is actively pushing the limit up (45M signalled; EIP-8261 in Glamsterdam adds an epoch-based schedule so defaults rise without every operator upgrading). EIP-8037's pricing is literally derived against a **150M-gas reference block** — that's the regime the protocol designers are planning for.
- **Planning rule of thumb:** `new_state_per_day ≈ 205 MiB × (gas_limit / 36M)`, discounted further by EIP-8037's repricing elasticity (unknown until we observe post-Glamsterdam utilization). Do not budget against today's MiB/day.

### 2.5 Where the numbers sit today (Sep 2026)

| Metric | Value |
|---|---|
| Live accounts | ~350M |
| Full node disk (Reth, Jun 2025 baseline) | ~1.2 TB (fits 2 TB with history pruning) |
| Archive node — Geth | ~20–22 TB, +~5 GB/day |
| Archive node — Erigon/Reth | ~3.5–4 TB, sync 1–2 weeks |
| Archive sync — Geth | 3–6 weeks on top NVMe |
| New state created | ~205 MiB/day @ 36M gas, pre-repricing |
| BloatNet perf danger zone | ~650 GiB state |

---

## 3. What's coming — by confidence level

Status vocabulary (per EIP-7723 / forkcast): **SFI** = scheduled, devnet-tested, ships barring disaster. **CFI** = seriously considered, not confirmed. No fork assignment = proposal only. Roadmap diagrams and old blog posts are *not* commitments — several "planned" state features (Verkle, sharding-era ideas) have already been redesigned or dropped.

### 3.1 Bankable: Glamsterdam — projected mainnet ~Dec 2, 2026

Forkcast working estimate; Sepolia forked-target Sep 28, Hoodi Oct 26, ~30-day security window after. Status: devnet-9 (final stress test) was launching as of late Aug 2026.

| EIP | What it does | Why we care |
|---|---|---|
| **EIP-8037** (Scheduled) | State-creation gas cost increase; introduces a separate "state-gas" dimension priced per byte (CPSB, derived against a 150M-gas block) | First protocol mechanism that *bounds* state growth. Slows our state disk growth rate; changes app economics (token mints, SSTORE-heavy ops cost more) |
| **EIP-8038** (Scheduled) | State-access repricing (SLOAD etc.); fixes underpriced EXTCODESIZE/COPY | Reflects larger state in gas; mild throughput cost, no direct disk effect |
| **EIP-7928** Block Access Lists (Scheduled, headliner) | Every block carries a structured list of all accounts/slots/code it touches | **Free per-block state-diff feed.** This is a big deal for our indexing pipeline — BALs can replace much of our trace/replay-based state-diff derivation after the fork |
| **EIP-7732** ePBS (headliner), EIP-7708 (ETH transfer logs), EIP-2780, EIP-7688, EIP-7778, etc. (Scheduled) | ePBS, native transfer events, intrinsic-gas decomposition | 7708 simplifies transfer tracking; ePBS is builder-side, minimal impact on our ops |
| **History expiry alignment** (networking-level, shipping with these releases) | All clients aligning on ~33,000-epoch (~5 months) default history retention (ACDE #244, Aug 27 2026: Nethermind/Nimbus/Reth ready; Geth/Erigon/ethrex in progress); EIP-4444 updated to document the window | Full nodes stop keeping ~forever-history by default. **Our archive fleet must retain history deliberately** (see §5.2) — p2p availability of old history is weakening |
| **EIP-8189 snap/2** (Networking) | BAL-based state healing instead of trie-node healing | Materially faster full-node syncs and recovery |

### 3.2 Bankable-to-likely: Hegotá — projected ~mid-2027

Headliners SFI'd: **FOCIL (EIP-7805)** and **Frame Transactions (EIP-8141, SFI'd Aug 27, 2026 — spec still iterating)**. Scoping target: complete by Devcon, Nov 3, 2026. Relevant state/storage items under consideration (Proposed, not yet CFI — do not treat as confirmed):

- **EIP-8368 / EIP-8372** — CPSB recalibration / state-gas rebalance. Explicitly evidence-gated: core devs will pick one or neither ~3+ months after Glamsterdam, depending on observed state-gas utilization. Translation: the protocol is committed to *keeping* state growth taxed as the gas limit rises.
- **EIP-8383** — cut required CL block retention to 8,192 epochs (~36 days). Would further shrink default full-node disk; same archive-retention caveat as above.
- **EIP-8304 Trustless Log Index** — provable log/tx lookups via a committed index. Flagged "A-tier" by core devs (ACDE #244). Directly relevant to our log-query product; track closely.
- EIP-3298 (remove storage-clear refund), EIP-8360 (ephemeral contracts / TCREATE) — hygiene measures that marginally reduce state-growth incentives.

### 3.3 Likely but late: the binary state tree — "fork I*", realistically 2028+

- **EIP-8297 Partitioned Binary Tree (PBT)** — Draft (Jun 2026), no fork assignment. Current consensus: targeted at **fork I\*** — the fork *after* Hegotá (ethresear.ch, Sep 3, 2026; EthMagicians, Sep 10, 2026). Implementation work is real (Geth, Besu; the earlier EIP-7864 lineage), but there is no scheduled fork, no devnet matrix, and the hash function isn't even chosen yet.
- **EIP-8347** migration design is thoughtful for operators: state is converted *offline* at a finalized anchor block, distributed as a verifiable snapshot, caught up by **replaying BALs**, and the swap happens at a single fork with a recoverable dual-tree transition window. If it ships, our archive re-platforming cost is bounded — but that's a 2028+ conversation.
- What PBT eventually buys: much smaller proofs (arity-2, STARK-friendly), zones that make **per-account state expiry a natural follow-on**, content-addressed code dedup, and locality for faster reads. It does **not** by itself shrink state — it's the substrate for expiry and statelessness.
- **Planning verdict:** outside the window. Treat as upside, not baseline.

### 3.4 Not in the window at all: state expiry

- **No state-expiry EIP is scheduled for any fork.** Current direction (ethresear.ch, Oct–Nov 2025) is to prototype **out-of-protocol** first: nodes voluntarily move cold state to compressed cold stores, surfaced via dedicated state-serving networks, with enshrinement only "if truly needed."
- Empirical work: whole-account expiry reaches only ~20% of state; per-slot granularity reaches ~80% in theory but needs the new tree structure. Translation: **meaningful state shrinkage is 2028+ even in the optimistic case.** Capacity plans must assume state grows monotonically through Q3 2028, merely at a taxed (slower) rate.

### 3.5 Dead / superseded

- **Verkle trees** — the 2021–2024 statelessness plan. Abandoned in favor of binary trees (ZK-compatibility + post-quantum concerns). Any doc or vendor deck referencing Verkle as "upcoming" is stale.

### 3.6 Net effect on our archive footprint inside the window

| Change | Effect on archive disk | Effect on full-node disk |
|---|---|---|
| History expiry alignment (~5 mo window) | None — we keep history deliberately | −0.5–1 TB and slower growth |
| EIP-8037/8038 | Slows **rate** of state growth (magnitude unknown until post-fork utilization data) | Same |
| Gas limit ↑ (45M → …) | Dominant upward pressure; roughly linear in gas limit | Same |
| EIP-8383 (if Hegotá) | None for us; shrinks default nodes further | −hundreds of GB |
| PBT + state expiry | None before 2028 | None before 2028 |

---

## 4. Recommendations

### 4.1 Client architecture (act this quarter)

1. **Standardize the archive tier on Reth or Erigon.** ~3.5–4 TB vs Geth's ~20–22 TB, sync in 1–2 weeks instead of 3–6, same archive RPC guarantees. For a fleet our size this is the single largest cost line we control — worth more than every scheduled protocol change combined, inside the window.
2. Keep 1–2 Geth-class archives only if we serve `debug_*`/`trace-*` workflows that need Geth's exact primitives; budget them separately (~20 TB, +~5 GB/day, i.e., plan a 24–30 TB volume for 24 months).
3. Full nodes: enable pre-merge history pruning now (supported in all EL clients since Jul 2025; reclaims 300–500 GB each) and adopt the ~33,000-epoch rolling window as clients ship it with Glamsterdam releases.

### 4.2 Storage tiering and history retention (act before Glamsterdam)

1. **Treat history as our custody problem now.** As default retention shrinks (~5 months at Glamsterdam, possibly ~36 days if EIP-8383 lands), re-syncing an archive from the network becomes impossible. Snapshot our history into **era files** (post-merge) and keep pre-merge bodies/receipts in cold storage this year.
2. Three tiers: **hot** (full nodes, NVMe, pruned), **warm** (Reth/Erigon archives, NVMe), **cold** (era files + pre-merge exports in object storage — single-digit $/TB/month, erasure-coded). Test restores quarterly.
3. Consider the Portal Network as a supplementary trustless source for old history rather than expanding warm tier.

### 4.3 Glamsterdam readiness (Q4 2026)

- Test EIP-8037/8038 on **Hoodi (forking Oct 26)**, not just devnets: measure our own state-growth delta and any client-behavior changes in our pipelines.
- Prototype **BAL ingestion** (EIP-7928). BALs are a protocol-guaranteed state-diff per block; they can cut our trace-based indexing cost substantially. Also note EIP-7708: native ETH-transfer logs change event-based accounting flows.
- Plan for the ePBS block-structure changes in any block-parsing code.
- Watch EIP-8368/8372 decisions in early 2027: a CPSB bump on top of a gas-limit raise is the scenario that most changes our growth curve.

### 4.4 Monitoring and planning cadence

- Track **BloatNet-derived metrics** (cross-client execution metrics spec) on our own nodes; alert on state-size trend and state-access latency, not just disk %.
- Re-run growth projections quarterly against: (a) actual gas limit, (b) post-8037 measured MiB/day. Replace the 205 MiB/day baseline with our own measured number after Glamsterdam.
- Watch forkcast.org for: EIP-8304 (Hegotá CFI status — product-relevant), EIP-8383, EIP-8368/8372, and any fork assignment for EIP-8297/8347 (the 2028 planning trigger).

### 4.5 Budget guidance for the 24-month window

- **Warm/archive tier:** provision Reth/Erigon archives at **6–8 TB** (≈4 TB today + growth + headroom), ~$800–1,400 one-time per node in NVMe, or ~$320/mo reserved (AWS i4i.2xlarge-class). Do not buy for binary-tree migration; when it comes it's offline/verifiable, not a fleet-wide emergency.
- **Full nodes:** 2 TB each remains comfortable through 2028 even with rising gas limits, *with* pruning enabled.
- **Geth-class archive (if kept):** plan +2 TB/yr.
- Model two growth scenarios for finance: **base** (gas limit ~45–60M, EIP-8037 effective → state growth roughly flat-to-moderately-up vs today) and **high** (gas limit → 150M regime, repricing lags → state growth 2–4x today's). The protocol's repricing machinery makes the high case survivable for full nodes but is *not* a shrinkage mechanism for archives.

---

## 5. Sources and how to stay current

- **forkcast.org** — EIP status (Proposed/Considered/Scheduled/Declined per fork), call summaries, devnet matrices. The authority for "is it actually shipping." Glamsterdam meta-thread: EthMagicians EIP-7773 thread; Hegotá meta: EIP-8081.
- Key specs: [EIP-8037](https://eips.ethereum.org/EIPS/eip-8037), [EIP-8038](https://eips.ethereum.org/EIPS/eip-8038), [EIP-7928](https://eips.ethereum.org/EIPS/eip-7928), [EIP-8297](https://eips.ethereum.org/EIPS/eip-8297), [EIP-8347](https://eips.ethereum.org/EIPS/eip-8347), [EIP-4444](https://eips.ethereum.org/EIPS/eip-4444).
- EF partial history expiry announcement (Jul 8, 2025) — client-by-client pruning instructions.
- ethresear.ch: "State growth scenarios and the impact of repricings" (Nov 2025) — the growth model and 650 GiB threshold behind EIP-8037; "How Hegotá can influence the state roadmap" (Sep 2026) — confirms PBT targeted at fork I\*; "State expiry: in-protocol vs. out-of-protocol" (Oct 2025) — why expiry isn't enshrining yet.
- ACDE #244 (Aug 27, 2026) — history-retention alignment, Glamsterdam testnet dates, Hegotá scoping.
- stateless.ethereum.foundation — the EF team driving binary trees, repricing, and BloatNet.
- Node sizing: reth.rs system requirements (Jun 2025), Erigon/Reth/Geth archive figures (2026 operator reports — treat exact TB numbers as ±20%).

**Caveats:** All fork dates are estimates — Glamsterdam "early December 2026" is forkcast's projection, Hegotá "mid-2027" likewise; both can slip. Repricing effectiveness (EIP-8037 elasticity) is unmeasured on mainnet until ~Q1–Q2 2027. Nothing in this brief should be read as a promise that fork I\* ships in 2028.
