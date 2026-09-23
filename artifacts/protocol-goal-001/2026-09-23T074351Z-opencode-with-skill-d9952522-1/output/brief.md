# Ethereum State Growth: Technical Brief for Capacity Planning (18–24 months)

**Prepared:** 2026-09-23
**Audience:** Node/infrastructure engineering + finance
**Verification basis:** Forkcast upgrade/EIP tracker (fetched 2026-09-23), EIP texts, All Core Devs call records through ACDC #97 (2026-09-21), Geth/Erigon documentation, gaslimit.pics. Fork status terminology follows EIP-7723: **Live** (active on mainnet), **SFI** (Scheduled for Inclusion in a named fork — timing can still shift), **PFI** (Proposed, not committed), **DFI** (Declined for that fork), **No fork relationship** (research/proposal only, unscheduled).

---

## 1. Executive summary

1. **Nothing in our 18–24 month window will make archive nodes smaller.** No scheduled fork deletes, compacts, or restructures existing state. Ethereum still stores every account and storage slot it has ever created, forever, unless a tree migration lands — and that is unscheduled research today.
2. **Glamsterdam (SFI) is real and near:** Sepolia activates Oct 6, 2026; mainnet is expected ~Dec 2026 (Forkcast working estimate: Dec 2, 2026; the meta-EIP table is still TBD). It *mitigates the growth rate* of state (EIP-8037/8038 cap worst-case state growth at ~120 GB/yr even at 150M gas) but also *raises throughput 2.5–3x*, which makes history grow faster. It adds a new data class (Block Access Lists) we must plan for.
3. **History expiry (EIP-4444) is effectively landing now**, as coordinated client behavior rather than a fork: all EL teams aligned (Aug 27, 2026) on a 33,024-epoch (~5.4 month) retention window, with implementations already shipping in client releases. This is the single biggest disk relief for **full nodes** in our window — and it does nothing for archive nodes, which retain history by operator choice. It also means **the p2p network will stop serving pre-window history**, which is both an operational risk and a business opportunity for a data company.
4. **Do not budget on:** the Verkle transition (EIP-6800, now *Stagnant*), its successor the binary-tree/"PBT" migration (EIP-7864, Draft, no fork relationship), or any state-expiry/state-rent scheme (all Draft/Stagnant, no fork relationship). Earliest credible horizon for a tree migration is 2028+, and there is no fork commitment today.
5. **Planning posture:** assume archive disk grows **faster** than the last 24 months (gas limit 60M → 150M+), full-node disk stabilizes (~1–1.5 TB steady state once pruning defaults land), and our archive fleet + era-file cold storage becomes the canonical source of history for ourselves and possibly for customers.

---

## 2. What is actually driving disk usage

### 2.1 How Ethereum stores state

- **Data model:** one global Merkle Patricia Trie (MPT) of accounts, plus a separate MPT of storage slots per contract, plus contract code blobs — ~230 GB of live trie data today (Geth v1.16+ path-based accounting, Feb 2026 docs: 47 GiB account nodes + 180 GiB storage nodes + ~1 GiB lookups). Legacy hash-based encodings are materially larger on disk.
- **Append-mostly, no garbage collection:** since EIP-158/161 (2016) the protocol clears only *empty* accounts. Dead contracts, zeroed slots, and dust remain forever. Nothing at the protocol level ever deletes a touched account or slot. Growth is bounded only by gas economics.
- **Three EL disk buckets:**
  1. **Live state** (~230 GB) — grows with accounts/slots created and touched.
  2. **Chain history** (headers, bodies, receipts) — >400 GB and growing (EIP-4444 motivation text); grows roughly linearly with gas used per unit time.
  3. **Archive state history** — every intermediate state trie. This is the archive-node multiplier: legacy hash-based Geth archives are **12–20+ TB**; Geth's new path-based archive mode (v1.16+, Oct 2025) stores state history as reverse diffs and brings full-history archives down to **~2 TB** (with historical `eth_getProof` support restored in v1.17, Feb 2026). Erigon archive: ~2.03 TB (their June 2026 refresh).
- **CL side:** beacon blocks (~hundreds of GB retention-bounded), blob sidecars (bounded to ~18-day expiry, so a maintenance cost, not a growth driver), and from Glamsterdam, Block Access Lists (see §4.2).

### 2.2 Why it keeps getting worse

- **Throughput is the growth driver.** Gas limit went 36M → 45M → **60M** (default set by EIP-7935 with Fusaka, Dec 2025; confirmed 60M as of Sept 2026). Full nodes are at 1.5–1.8 TB on 2 TB disks — core devs explicitly warned (Aug 27, 2026): *"launching Glamsterdam without expiring history could exhaust storage"* for 2 TB operators.
- **Observed growth rates (2026 operator/community figures, approximate):** full-node history ~7–14 GB/week at today's 60M gas. At Glamsterdam's 150M target that scales to roughly **2–3x** (utilization-dependent). These are derived estimates, not protocol constants.
- **Archive growth** = history growth + state-history growth. History is the dominant term and scales with the gas limit; state-history (post-8037 design target) is bounded at ~120 GB/yr worst-case. A legacy hash-based archive additionally carries ~1–2 TB/yr of new intermediate trie nodes at current throughput — another reason to retire that mode where we can.

---

## 3. Protocol changes that are actually coming

### 3.1 Live today (relevant baseline)

| Item | What it does | Status |
|---|---|---|
| PeerDAS (EIP-7594, Fusaka, Dec 3 2025) | CL nodes sample/custody a subset of blob data instead of all blobs | **Live** |
| EIP-2935 (Pectra) | Block hashes served from state (pruning-safe) | **Live** |
| EIP-7642 eth/69 (Fusaka) | History-expiry-ready receipts/networking | **Live** |
| BPO2 (Jan 7 2026) | Blob throughput up (21-blob blocks observed) | **Live** |
| Geth path-based archive (v1.16/1.17) | Archive at ~2 TB instead of 20 TB; ~2-week sync | **Live** (client feature, not protocol) |
| EF era files + torrents | Out-of-band canonical history distribution | **Live** |

### 3.2 Glamsterdam — SFI, mainnet ~Q4 2026 (high confidence)

Confirmed scope per meta-EIP-7773. Sepolia: **Oct 6, 2026** (epoch 353024), client releases Sept 29; Hoodi tentatively Oct 27 (go/no-go Oct 8); mainnet date not yet in the meta-EIP — treat **Dec 2026** (Forkcast estimate Dec 2) as the planning assumption.

State/disk-relevant contents:

| EIP | Effect on our problem |
|---|---|
| **EIP-8037** State Creation Gas Cost Increase (SFI) | The headline state-growth mitigation. Raises cost of creating state ~7x (new account), 5x (new slot), 8x (contract deploy); introduces a separate state-gas dimension with an explicit total state gas limit. Design target: **≤120 GB/yr worst-case state growth at 150M gas** (Glamsterdam repricing calls, May–Aug 2026; numbers frozen Aug 2026 at a 75 Mgas/s anchor). |
| **EIP-8038** state-access gas repricing (SFI) | Aligns read costs with today's larger state; slows state bloat, no disk reduction. |
| EIP-7778 / 2780 / 7981 / 7976 (SFI) | Refund-abuse closure (kills gas-token-style state stuffing), intrinsic-gas and calldata repricing. |
| **EIP-7928** Block-Level Access Lists (SFI, headliner) | *Adds* a new per-block state-diff record: ~50% of block-body size at current gas; ~144 GB per 33K-epoch retention window. Retention policy across clients is still being debated (Sept 2026: Geth retains all, others prune ~3,500 epochs; archive nodes may drop BALs and reconstitute). Plan disk and decide our own retention. |
| EIP-7954 (SFI) | Contract size cap 24→64 KiB (initcode 48→128 KiB) — modest upward pressure on code storage. |
| EIP-8261 Gas Limit Schedule (Informational) | Lets the gas limit rise toward 150–200M without waiting for operator upgrades. A 200M-at-fork default was discussed Aug 2026, unresolved. **Assume gas-limit growth continues after the fork.** |
| eth/70–72, snap/2 (EIP-7975/8159/8070/8136/8189, Networking) | Pagination and BAL-based sync — sync-protocol changes our tooling must handle. |

**Net effect:** slower *state* growth, materially faster *history* growth, plus a new BAL data class. No reduction of anything already on disk.

### 3.3 History expiry (EIP-4444) — not a fork, landing anyway (high confidence)

- The EIP now specifies `HISTORY_PRUNE_EPOCHS = 33,024` (~5.4 months): clients stop serving older headers/bodies/receipts on p2p and may prune locally. It has **no fork relationship** — it is coordinated client behavior.
- Status as of ACDE #244 (Aug 27, 2026): **all EL clients aligned** on the 33,024-epoch window. Nimbus and Nethermind: implemented. Reth: next release. Ethrex: PR in test. Erigon: in progress. Geth: agreed, implementation pending.
- Consequences for us:
  - **Full/RPC nodes:** disk usage stops compounding; steady state ≈ state (~0.25–0.4 TB) + bounded history window. The 1.5–1.8 TB pain disappears *if we accept default pruning*.
  - **Archive nodes:** no change. We retain everything by choice.
  - **Product/ops:** `eth_getLogs`, `eth_getBlockBy*`, and full-sync-from-genesis over p2p degrade beyond the window on pruned nodes. Genesis sync requires out-of-band data (era files) or a time-sliced archive. **Our archive fleet becomes rarer and more valuable.**
- **Action:** treat default pruning in major client releases across late 2026–H1 2027 as the working assumption.

### 3.4 Hegotá — headliners SFI, ~mid/late 2027 (moderate confidence)

- Headliners **SFI'd**: EIP-7805 (FOCIL) and EIP-8141 (Frame Transactions). Forkcast working estimate: June 16, 2027 — a planning guess, not an announced date; Hegotá scope is not final (devnets just starting; combined devnet targeted before DevCon, Nov 2026). Recent history suggests multi-month slips are normal.
- State/disk-relevant candidates (**PFI — proposed, not committed**):
  - **EIP-8304** Trustless log and transaction index — would replace saturated bloom filters with a provable log/tx index committed on-chain. A working proof-of-concept REST API was demoed to core devs (Aug 2026). Highly relevant to a data company; do not hard-depend.
  - **EIP-7668** Remove bloom filters (DFI'd for Glamsterdam, re-proposed for Hegotá) — changes `eth_getLogs` semantics; breaks naive log filtering.
  - **EIP-8383** Reduce CL block retention window to 8192 epochs (~1.3 months) — contested (CL devs note CL blocks aren't the disk problem); may tighten the EL history window in future.
  - EIP-3298 (remove storage-clear refunds), EIP-8253, EIP-8372/8368 (state-gas recalibration for higher gas limits) — further growth-rate tuning.
  - EIP-8025 Optional execution proofs — opt-in stateless verification; relevant to *verification* product lines, not our disk footprint.

### 3.5 What is NOT coming in the window (do not put in the budget)

| Proposal | Status (verified) |
|---|---|
| EIP-6800 Verkle transition | **Stagnant**; no fork relationship. Effectively superseded. |
| EIP-7864 unified binary tree ("PBT") + EIP-8347 offline migration | **Draft; no fork relationship.** The long-term state-tree direction, but unscheduled; earliest credible horizon 2028+, and no commitment exists. |
| State expiry / rent (EIP-7736, 8295, 8296, 8387) | Draft/Stagnant; **no fork relationship.** Research only. |
| Anything that deletes existing state | Nothing scheduled, anywhere. |

---

## 4. Planning assumptions for finance

| Assumption | Confidence | Basis |
|---|---|---|
| Glamsterdam mainnet Q4 2026 (testnet dates locked: Sepolia Oct 6) | High | Meta-EIP-7773, ACDC #97 (Sept 21, 2026) |
| Default ~5-month history pruning across EL clients, late 2026–H1 2027 | High | ACDE #244 alignment + release status |
| State growth ≤ ~120 GB/yr worst-case (post-8037), vs unbounded today | High (it is SFI'd) | Glamsterdam repricing records |
| Gas limit 60M → 150M+ over H1 2027 | Medium-high | EIP-8261 + fork-default discussions |
| Hegotá mid/late 2027 (FOCIL + Frames) | Medium | SFI'd headliners; scope not final |
| Bloom removal / trustless log index (7668/8304) in Hegotá | Low-medium | PFI only |
| Tree migration / state expiry | Not in window | No fork relationship |

### Disk budgeting rules of thumb (estimates, clearly labeled)

- **Full/RPC nodes:** buy 2 TB NVMe per node today; post-pruning steady state ~1–1.5 TB with little compounding. Fleet-wide relief is real and near-term.
- **Archive nodes:** assume **history growth of roughly 2–3x the 2025–26 rate** post-Glamsterdam (i.e., plan ~2–4 TB/yr of new history per fully-retaining archive node at 150M+ gas, utilization-dependent), plus ~120 GB/yr state (bounded), plus BAL retention if we keep full BALs (~150 GB per retention window, decision pending). No protocol relief. **Provision accordingly; this is the line item that grows.**
- **Avoid legacy 20 TB hash-based archives** except where historical `eth_getProof` is a hard product requirement — and if so, shard/time-slice them rather than growing one monolith.

---

## 5. Engineering actions (near term)

1. **Fleet split:** separate "serving" full nodes (accept 4444-style pruning; cheap, stable) from archive nodes (retention by policy, expensive, growing). Stop running archive-mode nodes for workloads that don't need historical state.
2. **Migrate archives to path-based/modern formats** (Geth v1.16+ path archive or Erigon): ~2 TB vs 12–20 TB, ~2-week syncs vs months. Validate historical-proof support against our API SLAs (Geth v1.17+ supports it; test each version).
3. **Become era-file experts now.** Import/verify EF era torrents (blocks + receipts) into cold storage; treat this as business continuity once p2p stops serving old history — and as a potential product (history/blobs-as-a-service as default nodes prune).
4. **Track Glamsterdam releases (Sept 29 / Oct 6 Sepolia) in a staging fleet.** Test: BAL RPC surface, two-dimensional gas in tracing (EIP-8037 changes callTracer/estimateGas outputs — downstream tooling will break), eth/69–72 sync behavior, and our own retention/pruning flags.
5. **Decide our pruning policy explicitly and publish it internally:** we retain X months on serving nodes (recommend ≥ the 33,024-epoch network window), everything on archive nodes.
6. **Prep for BAL data:** ~150 GB per window if fully retained; monitor the pending ACD decision on BAL retention (Sept 2026: unresolved). Decide whether we serve `snap/2`-style healing to customers (needs BALs) or not.
7. **Watch list (re-verify quarterly on Forkcast/ACD):** EIP-8304 (pilot the demoed trustless log index — could replace expensive custom log indexing if it lands in Hegotá), EIP-7668, EIP-8383, EIP-8025, PBT/tree migration (2028+).

---

## 6. Source register (checked 2026-09-23)

- Forkcast `/api/upgrades.json`, `/api/eips.json`, `/api/eips/{4444,6800,8037,8038,8304,...}.json` — fork status and projections (`projectedActivation` values are Forkcast estimates, not announced dates)
- EIP-7773 (Glamsterdam meta-EIP, incl. Sepolia activation epoch 353024 / 2026-10-06), EIP-4444 (updated `HISTORY_PRUNE_EPOCHS = 33,024`)
- ACDE #243 (2026-08-13), #244 (2026-08-27): history-expiry client alignment, "2 TB nodes near capacity at 1.5–1.8 TB", 120 GB/yr target; ACDC #97 (2026-09-21): testnet schedule; Glamsterdam repricing call records (May–Aug 2026): 7x/5x/8x cost increases, 75 Mgas/s anchor
- Geth archive-mode documentation (Feb 2026, incl. per-table disk breakdown), Erigon hardware-requirements refresh (June 2026), gaslimit.pics (60M, Sept 2026), ethereum.org 2026 builder guide
- Operator-reported archive sizes (12–20 TB legacy; ~2 TB path-based) — approximate, cross-checked across the above

**Bottom line for finance:** spend on archive capacity and era-file cold storage with a 2–3x growth multiple post-Glamsterdam; bank relief only on the full-node fleet; and treat every "Ethereum will fix state growth" headline beyond Glamsterdam's gas repricing as unscheduled until it shows up in a meta-EIP with a mainnet date.
