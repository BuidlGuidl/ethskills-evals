# Ethereum State Growth: Technical Brief for Fleet & Capacity Planning

**Date:** 23 September 2026
**Planning window:** Q4 2026 – Q1 2028 (18–24 months)
**Audience:** Infra team + Finance
**Scope:** Ethereum mainnet (L1). L2/blob growth is covered where it touches our nodes, but L2 activity does **not** add L1 state — blobs are ephemeral (~18-day consensus-layer retention) and are not part of the execution state trie.

---

## 0. TL;DR — what Finance needs to know

1. **Nothing in our planning window shrinks the state.** No protocol change before ~2028 deletes or compresses accumulated execution state. State grows monotonically; the realistic upside is only a *slowdown in the growth rate*.
2. **That slowdown is likely real and near-term.** The Glamsterdam upgrade (Q4 2026, high confidence) includes gas repricings (EIP-8037/8038) explicitly designed to cap state growth at roughly **120–160 GiB/year even as the gas limit scales 3x toward 150–200M**. Current rate at 60M gas: ~116 GiB/yr of newly created state.
3. **The other big disk consumer — chain history (blocks/receipts) — is being solved for full nodes.** Pre-merge history expiry is already shipped (saves 300–500 GB today). Full *rolling* history expiry (~5-month default retention window, configurable) is implemented across clients in 2026 and becomes default behavior in 2026–2027. Full-node history becomes bounded.
4. **Archive nodes are explicitly exempt from pruning** — that's the catch, and it's us. The protocol is transferring long-term history custody from "every node" to "institutional providers." We should lean into that role deliberately (tiered hot/cold design, Era files in object storage) rather than fight it with 20 TB monolithic databases.
5. **The old 12–20 TB hash-based Geth archive is obsolete.** Path-based archive mode (Geth v1.16+, ~2.2 TiB) and Erigon/Reth archives (~2–3 TB, up to ~6 TB with full commitment history) give us ~5–10x reduction on the archive tier if we don't need arbitrary-height Merkle proofs — and even that requirement is now servable at ~6.5 TB.
6. **The much-discussed state-side fixes (binary tree swap, state expiry, statelessness) will not land meaningfully inside the window.** Verkle trees were formally dropped from the roadmap in Aug 2026; the successor (Partitioned Binary Tree, EIP-8297/8347) is in Draft with no fork assignment. Treat as upside optionality, not capacity plan.

**Bottom line for budgeting:** plan for continued archive growth at *roughly current to 1.5–2x* rates (driven by history, not state), standardize full nodes on **4 TB NVMe** and archive nodes on **8 TB** by 2028, and move cold history to object storage. Details and scenario numbers in §4.

---

## 1. What is actually driving disk usage at the protocol level

### 1.1 The three distinct things a node stores

These get conflated constantly. They have different growth drivers and different protocol futures:

| Component | What it is | Approx. size (mainnet, mid-2026) | Grows with |
|---|---|---|---|
| **Current state** | The world state: every account, contract, and storage slot reachable from the latest state root | **~360–390 GiB** (geth state DB, Jan 2026; measured 359 GB in a Jan 2026 state-pruning study) | State-*creating* txs only; ~326 MiB/day at 60M gas limit |
| **Chain history** | Block bodies, headers, receipts, tx index (execution layer) | ~300–500 GB pre-merge (prunable today) + ~800 GB–1 TB post-merge | Every block, roughly linearly with gas limit |
| **State history** (archive only) | Every intermediate state trie — the state as of *every past block* | The archive multiplier: this is what turns 400 GB of state into 12–20 TB (hash-based geth) | Every state-touching block |
| Consensus layer data | Beacon blocks/states; blob sidecars | ~80–200 GB + ~100–150 GB blobs (custody reduced ~8x by PeerDAS since Fusaka) | Blob count (BPO forks), bounded by sidecar retention |

### 1.2 How the state is stored (why it's heavy)

Ethereum's execution state lives in a **hexary Merkle Patricia Trie (MPT)**: a key-value store whose keys are 20-byte addresses (or keccak-hashed address+slot pairs for contract storage), hashed up through RLP-encoded trie nodes to a single 32-byte `stateRoot` committed in every block header.

Properties that matter to us:

- **Everything is content-addressed by hash.** Every trie node is stored keyed by its keccak hash. This is why the classic geth archive is enormous: to answer `eth_getProof` at any historical height, it must retain every version of every intermediate trie node ever created. That's the 12–20 TB figure, and it's why a genesis archive sync takes *months* (compaction of a petabyte-scale write history).
- **Two layers:** one global account trie, plus a separate storage trie per contract. Storage dominates — in the Jan 2026 measurement, storage snapshots + storage trie nodes were ~294 GB of the 359 GB total (~82%). Most of it is cold contract storage that no transaction has touched in over a year.
- **32-byte keys, 16-way branching, ~7 levels deep.** Random 4 KB reads on cold storage slots; average Merkle witness ~3 KB per account access. This is the structure the roadmap wants to replace (§2.4) — not because it stores "too much data" but because it's hostile to proving and to pruning.
- **Full nodes keep only ~128 recent states** (recent trie versions) plus history; **archive nodes keep all of it**. The fork in cost between the two tiers is entirely the state-history line in the table above.
- **State never shrinks.** Deleting a storage slot leaves a zero/empty marker; trie nodes persist unless a client prunes. `SELFDESTRUCT` clearing (EIP-6780 semantics) helps marginally; nothing at consensus level ever reclaims trie space.

### 1.3 Growth rates, current and projected

Measured baselines:

- **State:** ~105 MiB/day at 36M gas (2024–early 2025), ~205 MiB/day at 45M, **~326 MiB/day (~116 GiB/yr) at 60M gas** (post-Fusaka, Jan 2026 measurements cited in EIP-8037). State DB portion ~390 GiB as of Jan 2026.
- **Full node total (geth, default):** ~1,774 GB (Sep 2026), up from ~1,400 GB a year prior — **~370 GB/yr total**, dominated by history, not state. Weekly growth on a snap-synced node: ~7–14 GB between prunes.
- There is a recognized **~650 GiB performance threshold** for the state DB ("bloatnet" initiative) beyond which trie reads/compaction degrade. Reaching it at current growth: ~2 years; at 200M gas *without* repricing: **under 1 year**. This is precisely why EIP-8037/8038 are in Glamsterdam.

Modeled state-size scenarios (EF-affiliated analysis, Nov 2025), gas limit per schedule below, *no repricing*:

| Date | Gas limit (conservative / base / aggressive) | State size by mid-2027 |
|---|---|---|
| 2026-06 | 80 / 100 / 150 M | — |
| 2026-12 | 150 / 300 / 500 M | — |
| 2027-06 | 200 / 400 / 700 M | **686 GiB / 859 GiB / 1.08 TiB** |

With Glamsterdam repricing, EIP-8037's own target is **~120 GiB/yr average (worst case ~160 GiB/yr) even at a 150–200M gas limit** — i.e., state stays under the 650 GiB threshold through our window. The repricing raises state-creation costs steeply (new account: 25k → ~184k gas; new storage slot: 20k → ~98k gas; ~1,530 gas per byte of new state), and EIP-8038 raises state-*access* costs (SLOAD/SSTORE/cold access) to reflect measured performance on today's state size.

**Takeaway:** after Glamsterdam, the binding disk constraint for *full nodes* is history (bounded by rolling expiry) and for *archive nodes* is history + state-history (unbounded — it's our job now).

### 1.4 Why sync keeps getting worse — and what already got better

- Genesis full-sync over devp2p is **no longer guaranteed** since "drop day" (May 2025): peers may not serve pre-merge bodies/receipts. Sync is checkpoint/weak-subjectivity anchored (this has been the de facto security model for 5+ years). History backfill now requires Era files or a history provider.
- Hash-based archive genesis sync (months, 12–20+ TB) is the pathological case. **Geth path-based archive syncs in ~2 weeks** at ~2.2 TiB (reverse-diff state history instead of every trie node).
- Reth ships static-file snapshots (snapshots.reth.rs) — full node bootstrap in days, not weeks. Sync pain is now mostly an archive-tier problem, and the path-based/flat-DB clients fixed the worst of it.

---

## 2. What's coming from the protocol — with confidence ratings

### 2.1 Status table

| # | Change | What it does to disk | Status (Sep 2026) | Mainnet ETA | Confidence (in window) |
|---|---|---|---|---|---|
| 1 | **Pre-merge history expiry** (EIP-4444 phase 1 / EIP-7639, "drop day") | Full nodes may drop pre-merge blocks/receipts: **−300–500 GB** | **Shipped** — all EL clients since Jul 2025 | Live | Done |
| 2 | **Rolling history expiry** (EIP-4444 full; meta EIP-7927; window EIP-4440/8252) | Full nodes keep only a rolling window (aligning on ~33,000 epochs ≈ 5 months; geth offers configurable `--history.blocks`, Eth Docker "rolling" preset ≈ 1 yr) | Implemented in clients through 2026 (geth rolling mode merged Mar 2026; reth EIP-4444 RPC semantics Jan 2026; Erigon `--prune.mode=full` defaults to EIP-8252 ~36-day state-history window). Client alignment on the retention window was the active ACD topic Aug 2026 | Defaults harden 2026–2027 | **High** |
| 3 | **Glamsterdam** (ePBS EIP-7732; Block-Level Access Lists EIP-7928; **repricing EIP-8037/8038**; contract size 24→64 KiB EIP-7954; EIP-7976/7981; eth/70–72; SNAP/2) | Repricing caps state growth (~120–160 GiB/yr at 150–200M gas). BALs add ~50 KB/block of new history data (~130 GB/yr if retained forever; retention tied to weak-subjectivity window ~16 days otherwise). Bigger contracts (64 KiB) marginally increase state per deploy | Scope frozen; Sepolia fork **Oct 6, 2026** (tentative, dependent on Devnet-11 stability); Hoodi ~Oct 26; **mainnet Q4 2026, December aspirational — no epoch set** | Q4 2026 (slip to Q1 2027 possible; Devnet-9 had a non-finality failure) | **High** (activation in window: ~90%) |
| 4 | **Gas limit ramp** (EIP-7935 set 60M default Dec 2025; EIP-8261 gas-limit schedule + "GPO" forks post-Glamsterdam) | More throughput → faster *history* growth; state growth offset by repricing. Devnet-11 already tested 200M | EIP-8261 in Review — mechanism still contested (consensus-enforced vs. advisory schedule); EF leadership publicly expects 100M in H1 2027, 200–300M beyond | 100M: H1 2027; 150–200M: late 2027–2028 | **Medium-high** (100M), medium (200M in window) |
| 5 | **BPO blob forks** (EIP-7892, post-Fusaka) | CL-side only; per-node blob custody reduced ~8x by PeerDAS; bandwidth rises with each BPO | BPO1 (10/15) Dec 2025, BPO2 (14/21) Jan 2026; further steps toward 48 target, 72 discussed | Ongoing | **High** (continues) |
| 6 | **Binary tree transition** (EIP-7864 unified binary tree → **EIP-8297 Partitioned Binary Tree (PBT)** + EIP-8347 offline migration) | Replaces MPT. Smaller witnesses (proof ~3.8 KB → ~770 B), SNARK-friendly, post-quantum, *enables* per-account state expiry and partial statelessness. **Does not itself delete state**; archive data unaffected | EIP-7864 Draft since Jan 2025; PBT EIP created Jun 2026; migration spec Jul 2026. **Not scheduled in any fork**; depends on BAL replay infrastructure from Glamsterdam; offline conversion + shadow-commitment rehearsal designed but unrehearsed on mainnet state | Earliest realistic: late 2027–2028; plausibly later | **Low-medium** (in window) |
| 7 | **State expiry / "new state types"** | The actual fix for state *size* (prune untouched state, ~78% of current state is >1yr cold — measured). Would cut full-node state to tens of GB | **Dropped from near-term roadmap** (Aug 2026 roadmap update: "state expiry → new state types"); design space now PBT-stub-based per-account expiry, mechanism not yet an EIP | 2028+ | **Don't bank** |
| 8 | **Statelessness (weak/partial)** | Validators/others verify via witnesses; only proposers hold state | Research; requires PBT first | 2028+ | **Don't bank** |

### 2.2 What changed recently that people still get wrong

- **Verkle trees are dead.** The multi-year Verkle transition (EIP-6800 family, the 2023–2025 "stateless" headliner) was removed from the roadmap in the Aug 2026 update ("Verkle → unified BT → PBT"). Any plan, vendor slide, or hire that assumes "Verkle fixes state in 2026/2027" is wrong. The successor path is the binary tree (row 6), which is *earlier-stage than Verkle was*.
- **Fusaka (Dec 3, 2025)** mattered to us less than billed: PeerDAS/BPOs are CL-side (blobs, bandwidth); the 60M default gas limit (from 45M) is what nudged state creation from ~205 to ~326 MiB/day.
- **Glamsterdam repricing is the single most important thing in this brief for state growth.** It is the protocol-level brake we can actually plan around — and it's the *prerequisite* the devs have stated for raising the gas limit further (the new schedule "supports roughly a 3x increase in base throughput" per the EF's own testing framing).

### 2.3 History distribution after expiry — our new role

The EF's stated availability model for post-expiry history has exactly three channels: **institutional providers (us), torrents/Era files, and the Portal Network.** Pre-merge history is fully packaged in `era1` format (public mirrors: ethpandaops, Nimbus, etc.); post-merge is packaged in `era` files. Community provider list: eth-clients.github.io/history-endpoints. Rolling expiry makes our full-history archive nodes *more* valuable operationally and reputationally — and imposes zero new protocol requirements on them (pruning is always opt-out-able). The only protocol obligation that changes: correct `PrunedHistoryUnavailable` (JSON-RPC error 4444) semantics on pruned nodes, which clients now implement natively (reth merged this Jan 2026).

### 2.4 What does NOT help us, explicitly

- **Blobs/L2 scaling** — ephemeral data, not state. L2 success does not bloat our EL archive (blob sidecars expire off the CL in weeks).
- **The binary tree swap, even when it lands** — it changes commitments and witnesses, not how many bytes a data provider must keep. Archive cost only drops when *expiry* (row 7) lands, or via client storage engineering (already happening, §3).
- **Gas limit increases** — pure negative for archive/history tiers; roughly proportional history growth per unit of throughput.

---

## 3. Client-side reality (Sep 2026 measurements)

Disk figures are production-measured, mainnet, mid-2026. Apply 1.5–2x headroom for compaction/temp/safety on top of every number.

| Tier | Client/config | Size | Notes |
|---|---|---|---|
| Full node | geth (snap, default) | ~1.77 TB | ~1.2 TiB fresh sync; ~830 GiB with pre-merge prune; grows 7–14 GB/wk between prunes; prune at 80% disk |
| Full node | reth v1.5+ **Storage V2** | **1.02 TB** (−30% vs V1) | minimal mode: 224 GB |
| Full node | erigon `--prune.mode=full` | ~1.2 TB | Now defaults to EIP-8252 ~36-day state-history window |
| Archive | **geth path-based** (v1.16+, `--syncmode=full` archive) | **~2.2 TiB**; ~6.5 TB if also retaining historical trie nodes | Reverse-diff state history; sync ~2 weeks; **historical `eth_getProof` supported from v1.17 via `--history.trienode=N`**; state history can sit on HDD (ancient store) |
| Archive | geth hash-based (legacy) | **12–20+ TB** | Only tier serving arbitrary-height historical Merkle proofs with full fidelity; genesis sync takes months |
| Archive | erigon `--prune.mode=archive` | 2.03 TB (docs) to ~6 TB (production `du`, incl. commitment history) | Historical `eth_getProof` now stable via `--prune.include-commitment-history` |
| Archive | reth (default, no prune) | 2.3–2.9 TB (V2: 2.31 TB) | Fast snapshot bootstrap; strong RPC throughput |
| Archive | nethermind archive | ~2.8 TB | Hybrid pruning **must be disabled** on archive (`Pruning.Mode=None`) |

Operational notes for the archive tier:

- Decide explicitly whether the product requires **arbitrary historical `eth_getProof` / historical trie walks**. If not, migrate off hash-based geth — this is the single largest disk/cost reduction available to us in 2026 (20 TB → ~2–6 TB per node).
- If yes, keep exactly one hash-based node (or a time-sharded set of path-based/erigon nodes) and treat it as a scarce, frozen-asset tier: it no longer needs to be the serving workhorse.
- Geth path-archive's ancient store can be placed on cheap HDD/NVMe-secondary — worth exploiting in the next hardware round.

---

## 4. Capacity forecast (base case, through Q1 2028)

Base-case assumptions: Glamsterdam mainnet Dec 2026 (Q1 2027 slip risk noted); repricing live from then; gas limit 100M by mid-2027, ~150M by end-2027 (EIP-8261/GPO path, advisory variant); rolling history expiry defaults during 2027 with 1-year retention windows common; no binary-tree fork inside the window.

| Tier | Today (Sep 2026) | Q1 2028 (base) | Q1 2028 (high-growth: 200M gas, no slip) | Buy |
|---|---|---|---|---|
| Full node (reth V2) | 1.0–1.8 TB | 1.3–2.0 TB (rolling expiry keeps history bounded; state +120–160 GiB/yr) | 2.0–2.5 TB | **4 TB NVMe per node** |
| Archive (path-based / erigon / reth) | 2.2–6 TB | **4–5 TB** (state +~150 GiB/yr; history +0.5–0.8 TB/yr at 100–150M gas; BALs +~130 GB/yr) | 5–7 TB | **8 TB NVMe (+HDD ancient store)** |
| Archive (hash-based geth, if retained) | 12–20 TB | 20–30 TB | 25–35 TB | No new units; freeze/consolidate |
| CL node (incl. blobs) | 0.2–0.35 TB | ~similar (PeerDAS custody relief offsets BPO growth) | +bandwidth, not disk | 1 TB |
| Cold history (era/era1, object storage) | ~1–1.5 TB total chain | grows ~0.3–0.6 TB/yr | — | S3/GCS class, negligible cost |

State-DB health check: 390 GiB (Jan 2026) + 120–160 GiB/yr (repriced) → **~700–800 GiB by Q1 2028** — uncomfortably at/above the 650 GiB bloatnet threshold, which is a further argument that devs will keep repricing tight and that the binary-tree/expiry work continues post-window. Without repricing at 200M gas, state would blow through 1 TiB inside 2027 — this asymmetry is why we assess row 3/4 of §2.1 as high-confidence.

---

## 5. Recommendations

### 5.1 Immediate (this quarter)

1. **Enable pre-merge history pruning on every non-archive full node** (`geth prune-history`; reth `--prune.bodies.pre-merge --prune.receipts.before 15537394`; erigon `--history-expiry`; nethermind ≥1.32.2 default). Free 300–500 GB per node today.
2. **Audit the archive tier for hash-based geth nodes.** For each, confirm with product/eng whether historical `eth_getProof` at arbitrary heights is a real SLA. Migrate everything else to path-based geth / erigon / reth (~4–8x disk reduction per node).
3. **Snapshot the cold-history strategy:** mirror era1 + era files to object storage now (one-time ~1–1.5 TB), and register ourselves on the community history-provider list. This is cheap insurance and positions us for the institutional-provider role rolling expiry creates.
4. **Load-test Glamsterdam on Sepolia/Hoodi (Oct 6 / ~Oct 26)** with our RPC surface: new gas schedule breaks hardcoded gas-limit assumptions and `eth_estimateGas` paths; BALs change block shape; `eth_config` exists. The EF's repricing-impact dashboard (ethereum.github.io/repricing-impact) documents the (small) set of contracts that degrade under the new schedule — check our indexed/monitored contract set against it.
5. **Set disk alerting at 70/80%** and prune-triggers per client docs (geth: ≥40 GB free required to prune; nethermind: ≥250 GB free for full pruning — pruning on archive nodes is a config error, ensure `Pruning.Mode=None` there).

### 5.2 Planning-window (2027)

6. **Standardize full nodes on 4 TB TLC NVMe; archive nodes on 8 TB**, with the geth ancient store on secondary storage where applicable. Do not buy 2 TB drives for anything that will still be in service in mid-2027.
7. **Adopt rolling-history defaults when clients flip them** for the *serving* fleet — but pin the archive tier to full retention explicitly in config (flags will change semantics as defaults shift; re-verify after every major client release).
8. **Plan sync-time as a budget line, not an afterthought:** archive rebuilds via path-based mode cost ~2 weeks; reth snapshot bootstrap ~days. Keep at least one warm standby archive; genesis full-sync of history via p2p is no longer a supported path (use Era files for any historical backfill).
9. **Bandwidth line item:** each BPO fork and each gas-limit step raises CL gossip and EL block traffic. Post-Glamsterdam ePBS widens propagation windows (2s → ~9s), which is the protocol's way of accommodating larger blocks — our NICs and peering budgets should assume 2–3x 2025 traffic by end-2027.

### 5.3 What NOT to do

- **Do not budget for state-size reduction from the protocol.** No scheduled fork shrinks state. If a vendor or roadmap deck claims otherwise, it refers to rows 6–8 of §2.1 — unscheduled.
- **Do not build capacity plans on "The Purge arrives in 2027."** The Purge's realized components inside our window are *history* expiry (yes, landing) and *repricing* (yes, landing). Its state-side components are research-track.
- **Do not over-provision for the hash-based archive's growth curve** (20→35 TB): that tier should be frozen or time-sharded, not scaled.

### 5.4 Watch list (quarterly review)

| Signal | Where | Why |
|---|---|---|
| Glamsterdam mainnet epoch announced | EF blog / ACD calls | Triggers repricing + BAL + post-fork GPO schedule |
| EIP-8261 final form (advisory vs consensus-enforced) + first GPO epoch | ACD / eip.tools | Sets the actual 2027 gas-limit trajectory |
| History-expiry retention window finalization (EIP-4440/8252 updates) | ACDE notes (Kevaundray) | Determines full-node steady-state history size |
| PBT EIPs (8297/8347) moving to Review / first fork assignment | Fellowship of Ethereum Magicians | Earliest credible signal for post-window state work; also signals tooling migration costs for us |
| State DB size vs 650 GiB bloatnet threshold | Our own dashboards | Leading indicator of read-latency degradation on the serving fleet |
| Era/era1 mirror health + Portal Network history client maturity | eth-clients/history-endpoints | Our redundancy as a history provider |

---

## 6. Source notes (all accessed 23 Sep 2026)

- EF blog: partial history expiry announcement (Jul 8, 2025); Fusaka mainnet announcement (Nov 6, 2025); Protocol Update 002 — Scale Blobs (Aug 22, 2025); Glamsterdam repricing testing (Aug 24, 2026).
- EIPs: 4444 (Stagnant; superseded in practice by 7639/7642/7927), 7892 (BPO), 7935 (60M gas), 7773 (Glamsterdam meta), 7732, 7928, 8037/8038 (state repricing; state DB ~390 GiB Jan 2026, ~116 GiB/yr at 60M), 8261 (gas limit schedule), 7864/8297/8347 (binary tree / PBT / migration), 8252 (Erigon retention).
- ethereum.org roadmap pages: Fusaka (Dec 3, 2025 activation), Glamsterdam (Q4 2026; Sepolia Sep 28→Oct 6, 2026), statelessness/state expiry (research phase), Verkle (dropped per Aug 2026 roadmap update).
- Client docs/measurements: geth archive mode (path-based 2 TiB / 6.5 TB / 12–20+ TB; v1.17 historical proofs), reth Storage V2 (full 1.02 TB, archive 2.31 TB @ block 24.4M), erigon hardware requirements refresh (Jun 2026: full 1.2 TB, archive 2.03 TB), nethermind pruning docs.
- Research: ethresear.ch state-growth scenarios (Nov 2025; 686 GiB–1.08 TiB by mid-2027 without repricing; 650 GiB threshold), ethresear.ch one-year-active-state experiment (Jan 2026; 78% of state cold >1 yr), ACDE #244 notes (Aug 27, 2026; ~33,000-epoch retention alignment).
- Etherscan via YCharts: full-sync data size 1,773.94 GB (Sep 16, 2026), +26.7% YoY.
