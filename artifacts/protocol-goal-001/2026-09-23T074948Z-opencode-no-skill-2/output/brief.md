# Ethereum State Growth: Technical & Capacity Planning Brief

**Prepared for:** Infra + Finance, 18–24 month planning window (Q4 2026 – Q3 2028)
**Date:** September 23, 2026
**Bottom line for finance:** Our worst disk numbers come from a storage design (hash-based Geth archives) that is already obsolete on the software side. Migrating archives to path-based Geth or Erigon 3 is a ~10x disk reduction we can execute *today*, with no roadmap dependency. The one protocol change that materially bounds future state growth (EIP-8037 state pricing, targeting ~120 GiB/yr) is scheduled for Glamsterdam in Q4 2026 and is close to bankable. The deeper fixes (new state tree, statelessness, state expiry) are *not* bankable in this window — plan hardware as if none of them ship before 2028.

---

## 1. What is actually growing, and why

### 1.1 Two different data domains — they must be budgeted separately

| Domain | Contents | Grows with | Bounded by protocol? |
|---|---|---|---|
| **State** | Current account balances, nonces, contract code, storage slots — the live key-value set every node needs to execute the next block | New accounts, new contracts, new storage slots (mostly *not* overwrites) | Not bounded today; Glamsterdam repricing targets ~120 GiB/yr |
| **History** | Block headers, bodies, receipts (execution-chain), plus consensus payloads and blob sidecars | Every block, forever | Partially: pre-merge bodies/receipts are now prunable (shipped Jul 2025); rolling expiry still in progress |
| **Historical state** (archive nodes only) | The state *at every past block* — what makes us an archive | Every state-changing transaction ever | No protocol help exists or is scheduled; this is purely a client-storage problem |

Archive-node pain is dominated by the third row, amplified by how the data is stored.

### 1.2 How Ethereum stores state (the protocol-level driver)

- State is committed in a hexary **Merkle-Patricia Trie (MPT)** — a tree of trees: one account trie, plus a storage trie per contract. Each leaf change rewrites every trie node on the path to the root, and those intermediate hash nodes must all be stored.
- A **full node** keeps only recent state (Geth keeps ~128 blocks of trie history); older tries are garbage-collected. A **hash-based archive node** keeps every intermediate trie node ever written. Academic measurement (SlimArchive, USENIX ATC '24) found ~36% storage utilization for the trie itself and ~8.6 database ops per state access — the format, not the data, is most of the cost.
- The result: as of 2026, a legacy **hash-based Geth archive is ~20–22 TB and grows ~5 GB/day**, and a from-genesis sync takes months. Yet the same historical state served from a modern client design is ~2 TB. **Our disk problem is ~90% client storage format, ~10% protocol.**
- **State growth itself** (the live set every node must hold): measured at ~340 GiB in Geth as of May 2025, with ~205 MiB/day of new state creation at a 36M gas limit (EF Research, Nov 2025). At the current 60M gas limit this scales to roughly ~340 MiB/day of *gross* state creation. The same study identified a **650 GiB "bloatnet" threshold** where state-access times degrade ~40% and sync/memory costs rise nonlinearly — a real operational cliff we should plan not to cross on hot nodes.
- Under pre-Glamsterdam gas schedules, EF Research projected live state of **686 GiB (conservative) to 1.08 TiB (aggressive) by mid-2027** without repricing. EIP-8037 (below) is the designed countermeasure.

### 1.3 Why it got worse this year specifically

The gas limit went 30M → 36M → 45M → 60M between Feb and Nov 2025 (EIP-7935 made 60M the default at Fusaka, Dec 3 2025). State creation scales roughly linearly with gas throughput, and demand for state creation is price-inelastic in the short run (ε ≈ 0.6), with spam contracts (XEN-type) providing a floor: whenever storing state gets cheap relative to capacity, bots fill it. That is why the 2025 capacity increase immediately showed up on our disks.

### 1.4 Current node-size reference table (mainnet, September 2026)

| Configuration | Disk today | Growth rate | Sync time | Notes |
|---|---|---|---|---|
| Geth full (snap-synced, pruned) | ~650–700 GB | +14 GB/week between prunes (reset on prune) | days | Includes full history so far; shrinks 300–500 GB with pre-merge pruning |
| Geth archive, **hash-based** (legacy) | 20–22 TB | ~5 GB/day, accelerating with gas limit | months | Only config serving historical `eth_getProof`. Do not deploy new ones |
| Geth archive, **path-based** (v1.16+, Jan 2026) | ~2 TB (flat history) / ~6.5 TB (flat + full trie history) | state-history grows with activity; live state as above | ~2 weeks | Historical `eth_getProof` not yet supported. Configurable retention; history can sit on HDD |
| Erigon 3 archive (Caplin) | ~1.77 TB (budget 4 TB) | grows with activity | 1–2 weeks | No historical Merkle proofs either |
| Nethermind/Reth full | ~1–1.3 TB | as above | days–1 week | Reth archive a viable Geth alternative |
| Blob sidecars (any node storing them) | bounded | ~18-day retention window, ~100–250 GB at BPO2 blob counts | n/a | Not a growth driver since PeerDAS + time-bound retention |

*Treat these as snapshots (client docs, late 2025–2026); re-measure quarterly. Blob sidecars are bounded and excluded from planning.*

---

## 2. What's coming from the protocol — and how much to bank on it

Confidence ratings are for landing *and having disk effect* inside our window (through ~Q3 2028).

### 2.1 Already shipped (2025–early 2026) — bank these, they're done

| Change | Effect on us | Status |
|---|---|---|
| **Pre-merge history expiry** (EIP-4444 phase 1) | Full nodes may drop pre-merge bodies/receipts: −300–500 GB per node; nodes fit comfortably on 2 TB | Shipped in all major EL clients; announced by EF Jul 2025 |
| Gas limit 60M (EIP-7935) | Capacity up 2x in one year → state/history growth rate up correspondingly | Live |
| Fusaka (Dec 3 2025): PeerDAS, BPO forks, eth/69 | Blob bandwidth down for validators; smaller devp2p messages | Live |
| Geth 1.16 path-based archive | The 10x archive-disk fix; this is client software, not a fork — available now | Live since Jan 2026 |

### 2.2 Glamsterdam — mainnet expected **Q4 2026** (Sepolia fork Oct 6, 2026). Confidence: **HIGH**

This is the only scheduled fork in the window with direct state-growth relevance. Scope is frozen pending final meta-EIP; headliners are ePBS (EIP-7732) and Block-Level Access Lists (EIP-7928). Relevant items:

| EIP | What it does | Disk/sync effect |
|---|---|---|
| **EIP-8037** — state creation repricing (CPSB + reservoir) | Charges state creation per byte via a fixed Cost-Per-State-Byte; separate `state_gas_reservoir` removes code-size-vs-gas-limit coupling | **The headline for us:** designed to hold state growth at ~**120 GiB/yr even as the gas limit scales toward a 200M floor** (150M reference used for calibration). Turns state growth from "whatever demand wants" into a targeted budget |
| **EIP-8038** — state-access repricing | Raises `EXTCODESIZE`/`EXTCODECOPY` etc. to match real lookup cost on large state | Modest growth + DoS-resilience effect; restores margin against the 650 GiB cliff |
| **EIP-7928 BALs + eth/71 (EIP-8159)** | Block-level access lists: every block carries its full state-access map + post-execution values | **Sync-time relief:** enables *executionless sync* — new nodes copy post-execution values instead of replaying history. Biggest sync improvement since snap sync, and likely cuts our re-provisioning time dramatically |
| ePBS (EIP-7732) | 9s propagation window instead of 2s | Enables the big blocks/gas-limit ramp that makes 8037 necessary |
| EIP-7975 (eth/70 receipt pagination), EIP-2780 (cheaper intrinsic gas), EIP-7954 (64 KiB contracts), EIP-7708 (ETH-transfer logs) | Reliability + UX | EIP-7708 lets us drop custom transfer-tracing; EIP-8037 changes gas semantics (see §3.6) |

**Caveats to EIP-8037's 120 GiB/yr target:** it is a target calibrated at 150M gas, not a hard cap. Short-run state demand is only moderately inelastic, and repricing has never been tested at 200M gas with real spam pressure. Contingency recalibration EIPs (8368/8372) are already drafted for Hegotá. **Planning guidance: budget 120 GiB/yr as baseline, ~2x (240 GiB/yr) as stress case.**

### 2.3 Rolling history expiry (EIP-4444 phase 2). Confidence: **MEDIUM-HIGH** within the window

Next step after pre-merge expiry: a rolling ~1-year retention window for bodies/receipts so full-node history stops growing unboundedly. No date is formally set (agreed plan leaves the window size and post-merge recovery mechanisms open; Portal Network in implementation, EIP-7801 torrent distribution live for some data). We should assume default full nodes get bounded history by 2027–2028, but **archive operators are unaffected — we retain history by choice.**

### 2.4 Hegotá — next named upgrade after Glamsterdam, expected 2027. Confidence of landing: **MEDIUM**

Headliner is FOCIL (censorship resistance), not storage. For us it is plausibly a *disk-growth* event: if it raises the gas limit again, history and (less so, thanks to 8037) state grow faster. Includes the EIP-8037 recalibration contingencies. Not something to bank storage relief on.

### 2.5 The new state tree (Partitioned Binary Tree). Confidence within window: **LOW — do not budget for it**

- Verkle trees (EIP-6800 family), the multi-year "solution" we've all read about, have been **deprioritized** — elliptic-curve commitments aren't post-quantum secure, and proving-system progress made hash-based trees viable. The active line is now **EIP-8297 (Partitioned Binary Tree, June 2026)** with **EIP-8347 (offline state migration, July 2026)**: convert state at a finalized anchor block offline, distribute verifiable snapshots, swap the commitment at a single fork.
- Both EIPs are **Draft** status. Current research discussion (Sept 2026) places PBT migration in the fork *after* Hegotá — i.e., **2028 at the earliest**, outside or at the extreme edge of our window.
- **Critical nuance for capacity planning:** the PBT migration does **not shrink state**. It changes the commitment structure to enable small witnesses/proofs (statelessness). During the transition window nodes must maintain **both** trees — **archive disk goes up, not down**, temporarily. The actual storage relief (weak statelessness / state expiry / VOPS) is behind it, unscheduled.

### 2.6 Summary scorecard

| Item | Lands in window? | Effect on our disks | Bankable? |
|---|---|---|---|
| Pre-merge history pruning | Already shipped | −300–500 GB/full node | Yes — action item, not roadmap |
| Path-based archive / Erigon | Already shipped | ~10x archive reduction | Yes — procurement decision today |
| Glamsterdam (EIP-8037/8038/7928) | Q4 2026 | State growth bounded ~120 GiB/yr; sync gets much faster | Yes (with 2x stress case) |
| Rolling history expiry | 2027–2028? | Bounds default-node history; archives unaffected | Mostly — assume yes, verify |
| Hegotá | 2027 | Likely raises growth pressure (gas limit), repricing recalibration | Neutral |
| PBT migration (EIP-8297/8347) | 2028+ | None/negative during transition | No |
| Verkle | Deprioritized | — | No |
| Statelessness / state expiry | Unscheduled | The eventual real fix | No |

---

## 3. What we should do (the plan)

### 3.1 Migrate archives off hash-based Geth — this is the whole game (now → Q1 2027)

- A hash-based Geth archive is 20+ TB and syncing one takes months. The *same data* is ~2 TB in Geth 1.16 path-based mode or ~1.8–2.2 TB in Erigon 3, syncing in 1–2 weeks.
- **Decision rule:** keep exactly **one** hash-based archive only if a product genuinely needs historical `eth_getProof` (compliance proofs, some ZK workflows). Neither path-based Geth nor Erigon serves historical Merkle proofs today. Otherwise retire all hash archives. If proofs are needed for limited ranges, consider a segmented hash archive covering only audited ranges.
- Choose the archive client for tooling fit: Geth path-based (ecosystem familiarity, configurable retention, HDD-viable history tier) vs Erigon 3 (most compact, fast). Reth archive is a credible third option. Run at least two clients across the archive tier for bug isolation.
- Sequence: stand up new path-based/Erigon archives in parallel, cut RPC traffic over, then decommission hash archives. With ~2-week syncs this is a quarter-long project, not a year.

### 3.2 Tier the fleet explicitly

| Tier | Config | Disk budget (buy) | Serves |
|---|---|---|---|
| Hot | Full nodes, snap-synced, pruned, pre-merge history pruned | 2 TB NVMe (TLC) per node | Head-of-chain RPC, tracing, feeds |
| Warm | 1–2 path-based/Erigon archives | 4 TB NVMe now → 6 TB at next refresh | Historical state reads (balances/storage at past blocks) |
| Cold | Object storage / Portal Network / community torrents for ancient blocks | Cheap bulk | Rare pre-merge history requests; don't serve from NVMe |
| Legacy (optional) | One hash-based Geth archive | Maintain existing, do not expand | Historical `eth_getProof` only |

### 3.3 Turn on what's already shipped

- Pre-merge history pruning on every full node (−300–500 GB each; per-client offline/online procedures documented by the EF). Geth full nodes: schedule prunes before disks hit 80%, keep ≥40 GB free for the prune itself.
- Track Geth's ~14 GB/week interim growth between prunes in monitoring; alert at 75%.

### 3.4 Capacity planning numbers (per node, for finance)

- **Live state:** ~400 GB class today; **budget +120 GiB/yr from Glamsterdam activation (baseline), +240 GiB/yr stress case** until EIP-8037 has 2–3 quarters of mainnet evidence. Re-baseline after Q1 2027.
- **History:** grows with gas throughput; at 60M gas and current utilization figure on the order of ~1 TB/yr for bodies+receipts on nodes retaining everything (archives); scales roughly linearly if the gas limit ramps toward 150M+ post-Glamsterdam. Rolling expiry will bound this on default nodes when it lands — not for archives.
- **Historical state (path-based archive):** the ~2 TB figure covers state history as reverse diffs; add the §3.4 growth lines. The 6.5 TB config (adds full historical trie data) only if we have proof workload needs — we probably don't, given the proof caveats.
- **Headroom rule:** client teams recommend 1.5–2x over measured usage. Buy 4 TB drives for warm archives now; don't buy 20 TB anything.
- **The 650 GiB cliff:** keep hot nodes' *state* portion comfortably under it; our hot tier already qualifies (pruned). Watch state-access latency metrics as the state set grows.
- **RAM:** 64 GB min / 128 GB recommended per archive — state caching matters more as the live set grows.

### 3.5 Sync-time budgeting

- Today: full node in days (snap sync); path-based/Erigon archive in 1–2 weeks; hash archive in months (retire this path).
- Post-Glamsterdam: BAL-based **executionless sync** should cut node re-provisioning substantially (state catch-up without tx replay). High confidence since BALs are a shipped-scope headliner. Keep 1–2 warm spares per tier regardless; ~2-week rebuilds make spares cheap insurance.
- Snapshot seeding (Erigon snapshots today; verifiable PBT snapshots eventually) is the standard provisioning path — never genesis-sync a new archive.

### 3.6 Glamsterdam readiness checklist (engineering, before Q4 2026)

1. Upgrade all EL+CL to fork-ready releases; ePBS changes block-propagation flow (relays remain usable but optional).
2. **Indexer/analytics changes:** EIP-8037's `state_gas_reservoir` changes gas accounting (the `GAS` opcode returns `gas_left` only) — our gas-usage analytics and any fee-estimation models need updates. EIP-2780 lowers intrinsic costs; EIP-7708 emits logs for ETH transfers (delete custom tracing for this); EIP-7954 permits 64 KiB contracts.
3. BALs ship per-block state-access maps with post-execution values — valuable as a data product for us; consider exposing them.
4. Watch ePBS + BAL impact on block/size propagation for our feed infrastructure (eth/70, eth/71 required).

### 3.7 Watch items (assign owner, quarterly review)

| Trigger | Source | Action if it changes |
|---|---|---|
| Glamsterdam mainnet date slips past Q4 2026 | Forkcast / EF blog | Push EIP-8037 growth relief out of FY26 numbers |
| EIP-8037 live state growth >> 120 GiB/yr for 2+ quarters | our own nodes / ethresear.ch | Move to stress-case budget; expect Hegotá recalibration (EIP-8368/8372) |
| Rolling history expiry EIP gets a client consensus + window size | ACD notes / EIP repo | Update cold-tier design; may simplify our full-node fleet |
| PBT devnets / shadow-root period begins | EIP-8297/8347 | Long-lead client support planning only; **no disk relief** — resist budgeting it as relief |
| Gas limit signals (100M+, 150M+) | gaslimit.pics | Scale history-growth line accordingly |

---

## 4. One-paragraph summary for finance

The protocol does not yet shrink state, and nothing scheduled before 2028 will — but two things bound our costs anyway: (1) client software redesigns already available cut our archive footprint ~10x (20+ TB → ~2 TB per node) and sync from months to ~2 weeks, which is our single biggest 2026 procurement lever; and (2) Glamsterdam (Q4 2026, high confidence) reprices state creation to target ~120 GiB/yr growth — near an order of magnitude below the 2025 trajectory — and makes node sync much faster. Budget for modest growth (120–240 GiB/yr state, ~1 TB/yr history on archives, scaled by gas-limit moves), buy 4 TB class NVMe for archives and 2 TB for full nodes with 1.5–2x headroom, and hold a small contingency for a 2027 gas-limit-driven growth uptick at Hegotá. Do not budget against Verkle trees, the binary-tree migration, or state expiry: treat them as post-2028 events, and note the tree migration would temporarily *increase* archive disk during its transition window.

---

## Sources

- Geth docs — archive mode & path-based storage (geth.ethereum.org/docs/fundamentals/archive)
- EF Blog — Partial history expiry announcement (Jul 2025); Protocol Priorities Update 2026 (Feb 2026); Checkpoint #5 (Jul 2025)
- ethereum.org — Glamsterdam upgrade page (incl. EIP-8037/8038/7928/7732/7975/2780/7708), Fusaka page, Verkle trees page, archive-nodes page; "Building on Ethereum in 2026" (Sep 2026)
- EIPs: 4444 (history bounds), 7935 (60M default gas), 8037 (state creation repricing/CPSB), 8038 (state-access repricing), 7928 (BALs), 7732 (ePBS), 8297 (Partitioned Binary Tree), 8347 (offline state migration), 7864 (unified binary tree), 6800/7748/7612 (Verkle, superseded line)
- EF Research (ethresear.ch) — "State growth scenarios and the impact of repricings" (Nov 2025); "How Hegotá can influence the state roadmap" (Sep 2026)
- Client/operator data: Erigon docs, Nethermind system requirements, gaslimit.pics, 7BlockLabs node-size comparison (Jan 2026), SwiftNodes archive cost analysis (May 2026)
- SlimArchive (USENIX ATC '24) — MPT storage-efficiency measurements
