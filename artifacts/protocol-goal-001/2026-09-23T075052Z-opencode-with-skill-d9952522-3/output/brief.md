# Technical Brief: Ethereum State Growth — Drivers, Protocol Roadmap, and Capacity Planning

**Prepared:** September 23, 2026
**Audience:** Infrastructure team + Finance
**Planning window covered:** ~18–24 months (through late 2028)

---

## TL;DR for budget decisions

1. **Nothing on the Ethereum roadmap shrinks state within your planning window.** The only state-related protocol change that is actually *scheduled* is **EIP-8037** (higher state-creation costs) in the **Glamsterdam** fork (mainnet projected ~Dec 2026). It *slows the rate of growth*; it does not reduce existing state, and it does not help archive nodes retroactively.
2. **The big architectural fixes (tree conversion → statelessness → state expiry) have no fork commitment.** Verkle is effectively abandoned in favor of binary trees; the binary-tree EIP is a draft with a prototype, not a scheduled fork item. State expiry is stagnant. **Do not put protocol relief into the 18–24 month budget.**
3. **The largest lever available today is client software, not the protocol.** Archive-node footprints differ by ~6–10× between clients/storage schemes (~2 TB vs 12–20+ TB). Migrating archive infrastructure to Erigon/Reth or Geth's path-based archive mode is worth more than anything the protocol will deliver in this window.
4. **Plan capacity assuming state keeps growing ~120–160 GiB/year** (EIP-8037's worst-case design band once it ships), with upside risk toward ~240+ GiB/year if gas limits keep rising and/or EIP-8037 slips. Archive disk grows by roughly the same annual increment plus history growth.

---

## 1. What is actually driving the pain at the protocol level

### How Ethereum stores state

- Ethereum's "state" is the set of all accounts: balances, nonces, contract bytecode, and contract storage slots. It is committed in each block header via the **hexary Merkle Patricia Trie (MPT)** state root.
- **Every state write is permanent.** There is no protocol-level deletion of dormant accounts or slots (post-EIP-6780 `SELFDESTRUCT` no longer removes storage either). State only grows.
- A **full node** stores the current state (~390 GiB in Geth terms as of Jan 2026, per EIP-8037's motivation data) plus enough recent history to handle reorgs, plus block/receipt history (~1+ TB).
- An **archive node** additionally retains the ability to answer state queries at *every historical block height*. This is where the multi-terabyte footprints come from — and it's a client-implementation cost, not a protocol requirement (see §4).

### Why growth is accelerating

State growth tracks block space supply. Measured figures from the EIP-8037 authors:

- After the Dec 2025 gas-limit increase 30M → 60M, average new state per day roughly **tripled: ~105 MiB/day → ~326 MiB/day (~116 GiB/year)**.
- Glamsterdam targets raising the limit toward **200M gas**. Extrapolated proportionally, that implies **~387 GiB/year** of new state without countermeasures.
- Client teams treat **~650 GiB** of state as the level where node performance starts degrading (sync time, IOPS, memory pressure). Starting from ~390 GiB, the unmitigated trajectory crosses that in under a year.

Archive nodes compound this: they keep every historical state, so their disk grows by the state growth rate **plus** the raw history growth rate, indefinitely.

---

## 2. What is coming from the protocol — verified status

Statuses below are fork relationships checked on **forkcast.org** (dataset generated 2026-09-23) and recent All Core Devs call summaries (ACDE #242–#245, ACDC #186–#187, Jul–Sep 2026). *SFI = scheduled for inclusion; CFI = considered, not committed; DFI = declined for that fork.*

| Change | Status | Fork | Realistic timing | What it does for you |
|---|---|---|---|---|
| **EIP-8037 — State Creation Gas Cost Increase** | **SFI (Scheduled)** | Glamsterdam | Sepolia fork Oct 6, 2026; mainnet **projected Dec 2, 2026** (forkcast estimate, not an announced date) | Reprices new accounts/slots/code to a harmonized ~1,530 gas/byte. Targets worst-case ~160 GiB/yr average growth under rising gas limits vs ~387 GiB/yr unmitigated. **Slows growth ~2–3×; shrinks nothing.** |
| **History expiry (EIP-4444 lineage)** | **Phase 1 Live** (pre-merge history droppable since May 1, 2025, all major EL clients); rolling-window Phase 2: clients aligning on a 33,024-epoch (~5 month) retention window for the Glamsterdam era | Client releases, not a consensus fork | Phase 1 available today; rolling window landing with/around Glamsterdam client releases | Saves 300–500 GB (pre-merge) now; rolling window caps *history* growth. **Helps full nodes; does nothing for archive state.** Note: the EF explicitly directs users who need old history to external providers — i.e., companies like yours. |
| **Verkle trees (EIP-6800)** | **No fork relationship; EIP status Stagnant** | — | Not scheduled anywhere | Was the old statelessness plan. Effectively superseded; do not plan around it. |
| **Binary trees (EIP-7864 → EIP-8297 "Partitioned Binary Tree", migration via EIP-8347)** | **No fork relationship; Draft** (EIP-8297 created Jun 2026; Geth discussion prototype exists) | — | Optimistically 2028+, and only if championed into the fork after Hegotá | The current frontrunner for statelessness (post-quantum-safe, proving-friendly). Even when it ships, it shrinks *proofs* and enables stateless validation — **it does not shrink the state itself, and archive operators still need full state/history.** |
| **State expiry (EIP-7736)** | **No fork relationship; Stagnant** | — | Not bankable in any window | The only proposal that would actually *reduce* live state. Dormant and gated behind a tree conversion that isn't scheduled. |
| **Hegotá fork scope** | Headliners decided: **FOCIL + Frame Transactions (EIP-8141)** | Hegotá | Projected ~mid-2027 (forkcast estimate Jun 16, 2027) | Contains nothing that relieves state growth. (EIP-7862 "delayed state root" was **DFI'd for Hegotá** on ACDE #245.) |

### What this means in plain terms

- **Bankable inside 18–24 months:** EIP-8037's slower growth rate, and client-side history pruning. That's it.
- **Not bankable:** any reduction in state size, stateless validation, or state expiry. Verkle was famously dangled for years and then dropped in favor of binary trees — treat the binary-tree effort the same way until you see an SFI on forkcast.
- Even the long-term fixes are aimed at *validators/light clients*, not archive operators. **The protocol roadmap will not rescue archive-node economics; it may worsen your niche, since history expiry shifts archival burden to third-party providers.**

---

## 3. What to do in the meantime (given that uncertainty)

### A. Exploit the client-implementation gap (biggest lever, available now)

Archive footprint is dominated by storage scheme, not the protocol:

| Client / mode | Mainnet archive size (2026 measurements) |
|---|---|
| Erigon 3 (`--prune.mode=archive`) | **~2.0 TB** (docs measured Jul 2026) |
| Geth v1.16+ path-based archive | **~2.2 TB** (full flat-state history; ~6.5 TB with historical trie data; no historical `eth_getProof`) |
| Reth archive | ~2–3 TB class |
| Geth legacy hash-based archive | **12–20+ TB**, months-long genesis sync |

**Action:** If any fleet nodes still run legacy hash-based archive, migrating to Erigon/Reth or path-based Geth cuts archive disk ~6–10× and sync from months to ~1–2 weeks. Verify your workload doesn't need historical `eth_getProof` before adopting path-based Geth.

### B. Right-size the archive tier; stop running archive semantics everywhere

- Audit which queries actually need *arbitrary historical state*. Most traffic (recent window, logs, receipts) is servable by full nodes or Erigon's intermediate modes (`blocks` mode: full block history, state only within the ~36-day EIP-8252 reorg window).
- Concentrate true archive capability in a small, right-sized tier behind your RPC gateway; scale read replicas of cheaper node types for the rest.

### C. Take the history-expiry savings on full nodes

- All major clients support dropping pre-merge bodies/receipts (300–500 GB each). Rolling-window history expiry (~5 months) is arriving in client releases around Glamsterdam — design fleet automation to adopt it, and plan to source deep history from your own archive tier (or era files/Portal) rather than expecting the p2p network to serve it.

### D. Capacity plan on the protocol's own worst case

- Base case (EIP-8037 ships ~Dec 2026): **~120–160 GiB/yr state growth** while gas limits ramp toward 200–300M. Size new disks for ≥2× the projected increment plus headroom; state DBs degrade and compaction gets painful well before 100% full.
- Downside case (Glamsterdam slips, or CPSB gets re-derived upward late): up to ~240 GiB/yr. This is a schedule slip of one fork, which has happened repeatedly — keep procurement buffer for it.
- Do **not** book savings from binary trees/statelessness/state expiry. Re-evaluate only when an EIP shows **SFI** status on forkcast for a named fork.

### E. Watch-items for the next planning cycle

1. Glamsterdam mainnet date confirmation (currently a projection; Sepolia forks Oct 6, 2026) and EIP-8037's actual post-fork effect on daily state growth — recalibrate your growth model ~1 quarter after it ships.
2. Whether the fork **after** Hegotá (sometimes referred to as "I-star") picks up the partitioned binary tree (EIP-8297/8347). An SFI there would put a tree conversion plausibly in 2028 — the first event that changes the long-term picture.
3. History-expiry default behavior in client releases, and the external history-provider ecosystem (torrents, era files, Portal) — relevant to your own archival product obligations.

---

## Sources checked (2026-09-23)

- **forkcast.org** — `/api/upgrades.json` (Glamsterdam status "Upcoming", projected 2026-12-02; Hegotá "Planning", projected 2027-06-16, headliners FOCIL + Frame Tx), `/api/eips/6800.json` (Stagnant, no fork relationship), `/api/eips/7736.json` (Stagnant, no fork relationship), `/api/eips/8037.json` (SFI Glamsterdam via ACDE #236, 2026-05-07), `/api/eips/7862.json` (DFI Hegotá, ACDE #245).
- **All Core Devs calls** — ACDE #242–#245, ACDC #186–#187 (Jul–Sep 2026): Glamsterdam testnet dates (Sepolia Oct 6), 200M gas-limit trajectory, client history-expiry alignment on ~33,000-epoch retention, Hegotá scoping (Frame Tx SFI'd as headliner).
- **EIP-8037 spec** (eips.ethereum.org) — state ~390 GiB Jan 2026; ~326 MiB/day post-60M; ~387 GiB/yr unmitigated at 200M; 650 GiB degradation threshold; CPSB=1530 targeting 120 GiB/yr worst case at 150M reference limit.
- **EIP-4444 / EF blog "Partial history expiry"** (Jul 2025) — pre-merge expiry live across clients; 300–500 GB savings.
- **EIP-8297 / EIP-7864** (eips.ethereum.org) — partitioned/unified binary tree drafts; stateless-consensus call notes confirming binary trees now favored over Verkle; go-ethereum PR #35436 prototype.
- **Erigon docs & Geth docs** (2026) — measured disk figures for archive/full modes; Geth path-based archive (~2.17 TiB) vs legacy hash-based (>12–20 TB).
