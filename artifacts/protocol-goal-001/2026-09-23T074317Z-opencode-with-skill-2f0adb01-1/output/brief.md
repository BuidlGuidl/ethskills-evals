# Ethereum State Growth: Technical Brief for Capacity Planning (2026-2028)

**Prepared:** September 23, 2026
**Audience:** Infra engineering + Finance
**Planning window:** ~18-24 months (through Q3 2028)
**Bottom line:** Nothing on Ethereum's near-term roadmap *shrinks* your archive. The fork you can bank on (Glamsterdam, ~Dec 2026) is aimed at *rate control and sync speed*, not deletion. The single largest, most certain disk driver in your window is **blob history**, not classic state. Budget for growth; treat "stateless Ethereum" as post-window.

---

## 1. What is actually driving growth at the protocol level

An "archive node" is really four independent datasets with very different growth mechanics:

### 1.1 EL state (accounts, storage, code) — the slow, protocol-managed term

- Ethereum stores all account balances/nonces, contract storage, and code in a **hexary Merkle Patricia Trie (MPT)** hashed with keccak256, committed in every block header as the state root. Every new account, storage slot, or contract adds durable data that **never expires** — nothing in today's protocol deletes state.
- Current size: **~390 GiB** for the state portion of a Geth node (Jan 2026, per EIP-8037's motivation section). Clients keep a flat-state overlay plus trie nodes, so on-disk footprint exceeds raw payload.
- Growth rate: after the gas limit doubled from 30M to 60M during 2025, new state per day roughly **tripled, from ~105 MiB to ~326 MiB (~116 GiB/yr)**. Note the response was *super-linear* in the gas limit (2x gas → ~3x state), likely a one-off behavior shift, not a stable ratio.
- Geth's own analysis (cited in EIP-8037) puts the **performance-degradation threshold at ~650 GiB of state** — at the pre-Glamsterdam trajectory that is roughly 2 years of headroom, which is exactly why repricing is arriving now (§2.2).

### 1.2 EL history (headers, bodies, receipts) — linear in L1 activity

- ~11 years of chain data (through early 2026) totals **~924 GiB** in Geth's ancient store: bodies 658 GiB, receipts 255 GiB, headers ~11 GiB (Geth docs, Feb 2026).
- Since **mid-2025 all execution clients support partial history expiry (EIP-4444 direction)**: pre-Merge bodies/receipts can be pruned (~300-500 GB savings), and full nodes no longer need to serve them on the p2p layer. A Geth full node now holds **~650-700 GB** steady-state and is fine on a 2 TB disk. **Rolling 1-year expiry is still a work in progress** — full nodes today retain all post-Merge history, which grows continuously.
- Archive nodes keep all of it. This dataset grows with transaction/log volume, and will grow faster if the gas limit ramps (§2.3) — plus small additive effects like EIP-7708 (ETH transfers emit logs, Glamsterdam).

### 1.3 Blob history (data-availability sidecars) — the dominant archive term since Dencun

- Since Dencun (Mar 2024), rollups post data in blobs: **128 KiB each** (4,096 field elements x 32 bytes), ~7,200 blocks/day.
- Capacity has been raised repeatedly: 3/6 (Dencun) → 6/9 (Pectra, May 2025) → **10/15 (BPO1, Dec 9, 2025)** → **14/21 target/max (BPO2, Jan 7, 2026)** via EIP-7892's Blob Parameter Only forks.
- **Actual utilization** (Sep 2026): a record **~6.7 blobs/block daily average** — still only ~40-50% of the 14 target; the 21 max is rarely hit.
- Growth math at 128 KiB/blob:
  - at today's ~6.7 avg: **~6 GiB/day ≈ 2.2 TiB/yr**
  - at 14 target: **~4.6 TiB/yr**; at 21 max: **~6.9 TiB/yr**
  - ~3-4 TiB accumulated since Dencun (estimate)
- Critical operational point: **regular nodes deliberately forget blobs after ~18 days** (4096 epochs, per the DAS retention window). PeerDAS (Fusaka) makes this possible — validators sample instead of storing. **Only archive-style services retain all blob history**, so this term lands almost entirely on operators like us.

### 1.4 CL data (beacon blocks, attestations)

- Modest (~200 GB class) and prunable; EIP-8383 (proposed for Hegotá) would cut the required retention window to ~36 days. Not a budget line item.

### 1.5 Why archive nodes specifically hurt

| Dataset | Size today | Growth (next 12m, current params) | Notes |
|---|---|---|---|
| EL state | ~390 GiB (Geth) | ~116 GiB/yr, capped-ish by design (see 2.2) | Perf pain ≥ ~650 GiB |
| EL history (full) | ~924 GiB | scales with L1 activity; grows with gas-limit ramp | Prunable on full nodes, not archives |
| Blob history | ~3-4 TiB | **2.2-4.6+ TiB/yr** (utilization-dependent) | Normal nodes keep ~18 days only |
| CL data | ~0.2 TiB | small | 8383 may shrink further |

The legacy Geth **hash-based archive** (stores every historical trie node — this is what serves deep proofs/traces) is **12-20+ TB and impractical** (genesis sync takes months). The modern generation fixed this at the *client* level:

- **Geth path-based archive (PBSS, v1.16+)**: ~2.17 TiB total — one full state plus reverse-diff state history; genesis sync ~2 weeks; historical `eth_getProof` not yet supported. State-history indexes (~297 GiB) can sit on HDD.
- **Erigon 3 archive**: ~1.8-2.2 TiB (full ~920 GB); **Reth archive**: ~2.5-3 TiB.

So the "archive node" your product teams picture went from ~15-20 TB to ~2-4 TB of EL data — **plus blobs**, which sit in a separate (CL-side or custom) tier and are now the fastest-growing thing we own.

---

## 2. What is genuinely coming, and when

Confidence labels: **[Shipped]** live on mainnet · **[SFI]** scheduled for a named fork, devnet-tested, barring disasters · **[CFI/Proposed]** being considered, not confirmed · **[Research]** no fork assignment.

### 2.1 Shipped (bank on it)

- **Partial history expiry, all EL clients (Jul 2025)** — pre-Merge pruning; era/era1 files + torrents + institutional archives are the sanctioned distribution model. This is a preview of the endgame: *history leaves the default node and becomes a dedicated data problem* — our business.
- **Fusaka (Dec 3, 2025)** — PeerDAS (EIP-7594): regular nodes sample blobs instead of storing them; the blob burden moved decisively onto DAS "supernodes" and archives. Gas limit standardized at 60M (EIP-7935).
- **BPO1 / BPO2** — blob target/max now 14/21.
- **Client-side**: path-based/flat-state archives (above) — not protocol, but the single biggest archive-cost improvement of the last two years.

### 2.2 Glamsterdam — the fork that matters for us **[SFI]**

Forkcast status: devnet series complete, **public testnets underway**; Forkcast's projected mainnet activation is **2026-12-02** (their working estimate, not an announced date). High confidence it lands inside the window, most likely H2 2026 or early 2027.

Headliners: **block-level access lists (EIP-7928)** and **ePBS (EIP-7732)**. The state-relevant payload (all SFI as of May-Sep 2026):

- **EIP-8037 — State Creation Gas Cost Increase.** The first direct attack on state growth. Introduces a cost-per-state-byte (**CPSB = 1,530 gas/byte**) and separate **state-gas dimension**: new account 25,000 → 183,600 gas (~7x); new storage slot 20,000 → 97,920 (~5x); code deposit 200 → 1,530/byte. Explicitly targets **≤120 GiB/yr state growth at a 150M gas reference**, with worst-case table: 80/120/160/200/240 GiB/yr at 100/150/200/250/300M gas. Translation: *the protocol now manages state growth as a budgeted resource*.
- **EIP-8038 — state-access repricing** (cold account 2,600→3,000; explicit write charges, e.g. STORAGE_WRITE 2,800→10,000). Benchmarked in March 2026 against mainnet-size state, targeting 100 Mgas/s client performance — this is what makes higher gas limits safe.
- **EIP-2780** (intrinsic gas decomposition), **7976/7981** (calldata/access-list floors — hard bounds on block bytes), **7708** (ETH transfers emit logs), **7954** (contract size cap raised to 64 KB — but now priced per byte via 8037).
- **Networking package**: **EIP-8189 (snap/2 — BAL-based state healing)** — sync a node's missing state by downloading "what each block changed" instead of one-tuple-at-a-time healing; directly attacks our sync-time pain. Plus 8136 (cell-level DAS deltas), 8159 (BAL exchange), 8070 (sparse blobpool).
- **EIP-8261 (Informational)** — an epoch-based gas-limit *schedule* in CL config post-ePBS: the mechanism for raising 60M toward **~100-200M** in steps (ethereum.org's stated direction: BALs+ePBS make 60M → ~200M "safe"). Combined with 8037: **gas goes up, state growth gets priced to stay bounded**.

**What Glamsterdam does NOT do:** delete or restructure anything. State and history keep growing; 8037 bends the state *rate* curve (best case significantly — pricing changes behavior; worst case the table above). Archive disk usage still goes up. Sync gets better (8189).

### 2.3 Hegotá — the 2027 fork **[SFI headliners; scope still forming]**

Headliners locked: **FOCIL (EIP-7805)** + **Frame Transactions (EIP-8141)** (smart-account/AA transaction type with post-quantum signatures). Forkcast projects ~mid-2027 (estimate; a slip to H2 2027 is normal). State/storage-relevant candidates — mostly Proposed, **do not bank on these**:

- **EIP-8368 / 8372** — recalibrate CPSB and the state-gas limit for a higher gas limit (existence of these implies planners expect >150M gas by 2027-2028).
- **EIP-8383** — shrink CL block retention window (~36 days).
- **EIP-8371 (RowDAS)** — next-gen blob scaling; **EIP-8198 (Quick Slots)** — shorter slots (more throughput/sec).
- **EIP-8188 (last-written block metadata)** — the enabling bookkeeping for state expiry — was **Declined from Hegotá in Sept 2026**. That is the clearest signal yet that **state expiry is not on a mainnet path in our window**.
- **Blob params:** a fifth BPO (**21/32**) is under active discussion as of Sep 2026. A Jan 2026 ethresear.ch analysis recommended *no* further BPO until 16+ blob miss rates normalize and demand justifies it — but if it lands late in the window, blob growth could step toward 7-10 TiB/yr. Model it, don't assume it.

### 2.4 Not in our window — do not put these in a budget

- **The Verge / binary tree transition** (EIP-7864 + overlay migration EIP-7612/7748): replaces the MPT with a STARK-friendly binary tree, enabling stateless verification. **No EIP is scheduled for any fork; no devnets; the preimage-retention prerequisite (EIP-6873) was declined for Glamsterdam.** Even optimistic commentary places this 2027-2028+. When it *does* come, plan for **transitional overhead** (dual-tree support, background conversion I/O) — an overlay migration is not a storage discount on day one.
- **State expiry (EIP-7736 family)** — research-stage epoch-tree rotation; its metadata enabler just got declined (above). Post-2028 at the earliest.
- **Verkle trees (EIP-6800)** — deprioritized in 2024-25 in favor of binary trees for ZK- and quantum-resistance reasons. Anything you read pre-2025 saying "Verkle is coming" is stale.
- **Full rolling history expiry (1-year window)** — in progress; further shrinks *full nodes*, not archives.
- **Portal Network** as a production history backstop — still maturing; today the real channels are era/era1 files, torrents, and institutional archivists (i.e., us).
- **Optional execution proofs (EIP-8025)** — proposed for Hegotá; opt-in, changes no consensus rules, does not shrink archives.

### 2.5 Net effect on growth rates within the window

- **EL state:** ~116 GiB/yr today → designed worst case ~120-160 GiB/yr even as gas ramps (240 GiB/yr only at a 300M limit, which is beyond the window). From ~390 GiB, the 650 GiB pain threshold stays ~2 years out. Rate-managed, not shrinking.
- **EL history:** grows with utilization; if gas ramps 60M → 100-200M, expect this line to roughly double its annual growth by 2028.
- **Blobs:** the swing factor. 2.2 TiB/yr at current usage; 4.6+ if utilization reaches target; 7-10+ if BPO5 lands and fills. **This is where the budget risk concentrates.**

---

## 3. Planning scenarios (Sep 2026 → Sep 2028, "keep-everything" archive)

Incremental storage over 24 months, on top of today's ~6-8 TB total (EL archive ~2-4 TB + blobs ~3-4 TB + CL):

| Line item | Low | Base | High |
|---|---|---|---|
| EL state | +0.3 TB | +0.3 TB | +0.5 TB |
| EL history (all blocks/receipts) | +0.8 TB | +1.5 TB | +3 TB |
| Blob history | +4.5 TB (usage stays ~6-7) | +7 TB (usage → 10-12) | +11-14 TB (BPO5 21/32, usage 15-18) |
| **Total growth** | **~6 TB** | **~9 TB** | **~15-17 TB** |

Assumptions: Low = no BPO5, gas stays 60M, 8037 fully binds. Base = gas → 100-150M via 8261-style schedule, blob usage climbs to target. High = BPO5 lands, gas → 200M, blobs heavily used. Glamsterdam and Hegotá both shipping is common to all three — none of them *reduce* these numbers.

Hardware translation: per archive-class node, provision **8 TB NVMe minimum for the base case, 12-16 TB for high** (or push history/blobs to cheaper tiers per §4). NVMe is only truly required for state + recent data; history and blobs are sequential/write-once and suit HDD and object storage.

---

## 4. Recommendations

### Engineering

1. **Tier your storage by access pattern, not by node.**
   - Hot NVMe: state + last ~18-90 days of everything (this is what serves p99 RPC).
   - Warm: full EL history via era/era1 files and/or flat-state archive clients — these are sequential-scan workloads.
   - Cold: blob history and pre-Merge history → object storage. Blobs are write-once/read-rare; keeping them on NVMe is wasted money. Export sidecars on a schedule before your CL client's 18-day retention drops them — nothing re-fetches them for you.
2. **Pick archive clients deliberately.** Erigon 3 (~1.8-2.2 TB) or Reth (~2.5-3 TB) for analytics-grade archive serving; Geth PBSS (~2.17 TB, ~2-week genesis sync, HDD-friendly state-history tier) if Geth tooling matters — noting historical `eth_getProof` is not yet available on PBSS. Retain at most one legacy hash-based Geth archive (12-20+ TB) and only if deep historical proofs/traces are a hard product requirement; otherwise retire it — it is the most expensive node we own per query served.
3. **Stop doing genesis syncs.** Full-node sync is ~a day (snap sync); archive sync is 1-2 weeks (PBSS/Erigon/Reth), months on legacy Geth. Maintain internal snapshots and bootstrap from era files; keep a snapshot cadence sized to your recovery-time objective. Expect EIP-8189 (snap/2, Glamsterdam) to further cut state catch-up time next year.
4. **Track the leading indicators, not just disk:** blobs/block (this drives 60-80% of your growth), new-state bytes/day (Geth metrics; watch the step change after EIP-8037 activates ~Dec 2026), gas limit & utilization (gaslimit.pics), blob-basefee (demand signal), and disk at 80% as the prune/re-provision trigger.
5. **Set re-forecast triggers:** (a) Glamsterdam mainnet date + final scope; (b) any BPO5 epoch announcement; (c) Hegotá scope freeze (especially 8368/8372/8383/8371); (d) post-8037 state-growth measurements (compare 3 months before/after); (e) any binary-tree devnet — the earliest credible Verge signal. None of these should change spend direction, only sizing.

### Finance

6. **Fund the base case, hold contingency for the high case.** The certain spend is blob-driven and lands on cheap storage tiers (~$400-700/TB NVMe one-time; object storage materially less). The difference between base and high scenarios is roughly 6-8 TB of largely HDD/object-class storage per archive — cheap insurance relative to being wrong.
7. **Do not pre-save on protocol relief.** No shrink event — state expiry, tree migration, or anything else — is credibly scheduled inside 24 months. If the Verge ever ships, it initially *adds* storage and I/O (dual-tree overlay + conversion). The correct planning posture is: growth is certain, rate of growth is the only variable, and the protocol is actively managing the state-growth rate via pricing (8037) while scaling throughput.
8. **Calibrate on track record, not roadmaps:** Fusaka shipped Dec 3, 2025 as scheduled; BPOs are config-only and have been reliable; Glamsterdam is in public testnets (a slip of one quarter is normal and harmless to plan for). Anything labeled "planned" without a fork assignment and devnet matrix (Verge, state expiry, portal-everything) has historically taken years longer than blog posts imply.

---

## 5. Source ledger (primary sources, checked 2026-09-23)

- **Fork status, scopes, EIP stages:** forkcast.org (dataset generated 2026-09-23) — Glamsterdam (testnets, projected Dec 2026) and Hegotá (projected 2027) EIP lists, incl. EIP-8037/8038 SFI (ACDE #236, 2026-05-07), EIP-8188 declined (2026-09-10), EIP-8189 networking-stage.
- **EIP texts:** EIP-8037 (state size ~390 GiB Jan 2026; 105→326 MiB/day; 650 GiB threshold; CPSB derivation; 120-240 GiB/yr worst-case table), EIP-8038 (repricing table, Mar 2026 benchmarks), EIP-8261 (gas-limit schedule mechanism), EIP-4444 (Stagnant; 1-year window spec), EIP-7892/8134/8135 (BPO schedule).
- **Ethereum Foundation blog:** Fusaka mainnet announcement (Nov 2025; BPO dates/epochs), Partial history expiry announcement (Jul 2025; client commands, era distribution), Protocol Update 002 (blob scaling path, PeerDAS 8x, Glamsterdam DAS work).
- **Geth docs:** archive mode (path-based, Feb 2026: 2.17 TiB breakdown, 2-week sync, HDD support), history pruning; Geth v1.16.0 release.
- **Third-party data (used with attribution, verify before quoting externally):** gaslimit.pics (60M avg, Sep 2026); ethresear.ch blob analysis (Jan 2026: median 4-6 blobs, 16+ blob miss rates); Bankless/Cointribune (Sep 2026: 6.7 blobs/block record, BPO5 21/32 under discussion); Erigon/Reth docs and node-size roundups (2026 figures as cited in text).

*Figures for client disk footprints move with chain growth and client releases; re-baseline quarterly against client docs before procurement.*
