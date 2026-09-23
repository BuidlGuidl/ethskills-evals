# Ethereum State Growth: Protocol Drivers, Upcoming Changes, and Infrastructure Plan

**Prepared:** 2026-09-23 · **Audience:** Engineering + Finance · **Planning window:** next 18–24 months (through ~Q3 2028)
**Status of sources:** Protocol status verified against forkcast.org (EIP stage history + ACD call summaries through ACDE #244, 2026-08-27), client documentation, and EF/ethresear.ch publications as of the date above. Protocol plans change; see the monitoring section at the end.

---

## TL;DR

- **Nothing shipping in your planning window will shrink Ethereum's state or your archive footprint.** What is coming (Glamsterdam, ~Dec 2026) *slows the rate of growth* via gas repricing. True structural relief (statelessness via a binary-tree state migration, state expiry) is **not scheduled for any fork** and is realistically a 2028+ story.
- **The biggest available win is not protocol — it's client software.** Migrating archive nodes from legacy hash-based archives (12–20+ TB) to Geth's path-based archive or Erigon 3 cuts per-node storage to roughly **2 TB today**. If you haven't done this migration, it dwarfs anything the protocol will do for you in 24 months.
- **History and state are different problems.** History expiry (EIP-4444, partially shipped in Fusaka Dec 2025) reduces *history* (blocks/receipts) on full nodes. It does nothing for *state*, and for archive operators it arguably increases your strategic importance: the p2p network is progressively dropping the old data you keep.
- **Budget guidance:** plan on continued state growth of roughly **100–150 GB/year of live state** (capped lower if EIP-8037 lands as specified), plus proportional archive history growth. Do not assume any protocol-driven reduction before late 2028 at the earliest.

---

## 1. What is actually driving this at the protocol level

### 1.1 How Ethereum stores state

Ethereum's entire "state" — every account balance, nonce, contract's code, and every contract storage slot — lives in a single **Merkle Patricia Trie (MPT)**. Each block header commits to the root hash of this trie. As of late 2025 measurements, mainnet state is roughly **~350M accounts and ~1.3B storage slots**; the live trie in Geth is on the order of **~250–300 GB** and growing.

Key protocol-level properties that make this a one-way ratchet:

1. **State is append-mostly and never materially shrinks.** New accounts, contracts, and storage slots are added every block. Deletion paths have been deliberately removed or weakened over time: the storage-clearing gas refund was removed (London), and `SELFDESTRUCT` was neutered in Dencun (EIP-6780) — contracts now almost never actually get deleted. There is currently no in-protocol mechanism that removes cold state. (EIP-3298, which would remove the remaining storage-clear refund, is only *proposed* for Hegotá — and it slows growth, it doesn't reverse it.)
2. **Full nodes must keep the live trie plus full history.** A pruned full node keeps the current state (~last 128 blocks of state overhead) plus all block bodies and receipts (approaching/over 1 TB pre-pruning). Snap-synced + pruned full nodes sit around **650 GB–1.8 TB** depending on client and retention defaults (this range was explicitly flagged on ACDE #243 in Aug 2026: "2TB node operators are hovering at 1.5–1.8 TB").
3. **Archive nodes pay the trie-duplication tax.** The network does not require archive nodes; they exist to answer "what was the state at block N?" queries. The legacy (hash-based) approach keeps historical trie nodes so any past state root is reachable — this is what produces the **12–20+ TB** archive monsters and months-long genesis syncs. It's a client storage-design artifact layered on top of the protocol's one-way state growth, not a protocol requirement.

### 1.2 What drives the *growth rate*

- **Demand for state creation:** new EOAs, contract deployments, and storage slots (DeFi positions, L2 state commitments/bridging, NFTs, etc.). Each new slot is a permanent ~dozens-of-bytes-plus-trie-overhead commitment across every node.
- **Gas limit increases raise the ceiling on growth rate.** The default gas limit went to 60M with Fusaka (EIP-7935, live Dec 2025; mainnet is at 60M as of today, block ~26.04M). Core devs are targeting ~150M over the next phase of scaling. Higher limits = more state writes possible per unit time, which is precisely why the state-creation repricing below was scheduled *before* further limit increases.
- **History growth** (bodies/receipts) scales with gas limit too, and was flagged in BAL breakout calls as a compounding pressure alongside state.

---

## 2. What is coming at the protocol level — and how much to bank on it

Fork status below uses the ACD pipeline stages: **SFI** (Scheduled for Inclusion — barring disasters, it ships with that fork), **CFI** (Considered — not confirmed), **Proposed**, **Declined**, plus EIP-repo status (`Stagnant` = effectively dormant).

### 2.1 Already shipped (helps history, not state)

| Change | Status | Impact for you |
|---|---|---|
| **Partial history expiry (EIP-4444 phase 1 / eth/69, EIP-7642)** | **Live** — eth/69 shipped in Fusaka (Dec 2025); all major EL clients support dropping pre-Merge history (300–500 GB savings on full nodes) | Full-node fleet only. Archive operators: **do not prune** — you are the preservation layer. Note history pruning is currently opt-in/new-syncs; automated pruning is being added in later client releases. |
| **Rolling/full history expiry (rest of EIP-4444)** | In progress, client-default-driven rather than a single hard-fork event. ACDE #243 (Aug 2026): clients converging on aggressive retention defaults (Nethermind → ~Dencun or ~6 months; others similar); expect ~1 month minimum retention norms | Full nodes get materially smaller over your window. **Strategic implication:** historical blocks/receipts leave the default p2p network; availability shifts to out-of-protocol channels (era files, Portal Network, commercial providers). This is a threat (you must source full history yourself) and an opportunity (it's literally your business). |

### 2.2 Glamsterdam — next fork, testing on public testnets now (forkcast estimate: Dec 2, 2026; treat as Q4 2026–Q1 2027)

Headliners: **ePBS (EIP-7732)** and **Block-Level Access Lists (EIP-7928)**. State-relevant items:

| EIP | Stage | What it does | What it means for your disks |
|---|---|---|---|
| **EIP-8037 — State Creation Gas Cost Increase** | **SFI** (Scheduled, ACDE #236, May 2026) | Harmonizes and raises the cost of *creating* state, with separate metering. Breakout numbers (May 2026): new account ~7×, new storage slot ~5×, contract deploy ~8×; explicit target of **≤ ~120 GB/year worst-case state growth** even at a 150M gas limit | **The single most bankable item in your window.** It doesn't shrink anything, but it caps the growth *rate* and makes future gas-limit raises cheaper for you. Price-sensitive caveat: repricings occasionally slip between devnet and mainnet — SFI is strong but not a signature. |
| **EIP-8038 — State-Access Gas Cost Update** | **SFI** (Scheduled, Aug 2026) | Raises gas cost of state *reads/writes* to match today's larger trie | Indirectly dampens state-churn-heavy usage. No size impact. |
| **EIP-7928 — Block-Level Access Lists (headliner)** | **SFI** | Every block carries an explicit list of state locations touched + post-state diffs | Enables parallel execution and (via eth/71 BAL exchange, snap/2 BAL-based state healing — both in networking scope) **faster syncs and healing**. Small per-block storage overhead; archive nodes may retain or reconstitute BALs. This is also the foundation layer for eventual statelessness — the protocol is building the ramp, not the destination. |

### 2.3 Hegotá — fork after Glamsterdam (early planning; forkcast estimate mid-2027)

Headliners are **FOCIL (EIP-7805)** and **Frame Transactions (EIP-8141)** — censorship resistance and account abstraction, **not state**. State-adjacent items are only *Proposed* (not scheduled): EIP-3298 (remove storage-clear refund), EIP-8372 (normalized state gas limit), EIP-7709 (blockhash via EIP-2935 storage). Also relevant to the long game: **VOPS (Validity-Only Partial Statelessness)** is being designed for mempool validation alongside FOCIL.

**Verdict: assume zero state relief from Hegotá.**

### 2.4 Not scheduled for any fork — the aspirational tier

| Proposal | Status (verified) | Realistic read for a 24-month budget |
|---|---|---|
| **Verkle trees** (EIP-6800, EIP-7612 overlay transition) | Both **`Stagnant`** in the EIP repo | **Dead as the vehicle.** Deprioritized in 2024–25 over ZK-proving cost and quantum-resistance concerns. Anyone citing "Verkle is coming" is working from stale sources. |
| **Binary-tree (PBT) state migration** — Verkle's successor | Research/track-level; mentioned on ACDE #244 (Aug 2026) as a future "massive irregular state transition"; **no fork relationship, no EIP scheduled** | The real long-term path to statelessness (ZK-friendly, quantum-plausible). A multi-year engineering program that hasn't formally started on mainnet scope. **Do not budget for any benefit before 2028+, and treat even that as speculative.** |
| **State expiry** (EIP-7736 leaf-level; compression-based variants) | EIP-7736 **`Stagnant`**; active research (ethresear.ch, Oct–Nov 2025) on both in-protocol and out-of-protocol expiry, with honest acknowledgements that immediate enshrinement is unlikely due to UX/resurrection/data-loss risks | Not in your window. If it ever ships it mostly helps *live state* on full nodes/builders; archive operators would still keep the expired data (you'd be the resurrection provider — again, potentially a business line, not a cost saving). |
| **Weak/strong statelessness** | Directional roadmap item; groundwork only (BALs in Glamsterdam, VOPS design, L1-zkEVM attester-client breakouts active through Sep 2026) | Changes *verifier* economics years from now. Archive/full-node storage economics for data providers like you are largely unchanged — someone still stores and serves everything. |

### 2.5 How much can you bank on, in one paragraph

Within 18–24 months, the protocol will deliver: (a) smaller **full nodes** via rolling history expiry — real, bankable, partly here; (b) a **capped state-growth rate** via EIP-8037/8038 in Glamsterdam — high confidence (SFI, on public testnets), assume landing Q4 2026–Q1 2027 with one fork's worth of slippage risk; (c) **faster sync/healing** via BALs — same confidence as (b). It will **not** deliver: smaller state, smaller archives, state expiry, or statelessness. Any roadmap diagram, blog post, or vendor telling you otherwise for this window is citing aspiration, not schedule.

---

## 3. What to do in the meantime

Ordered by ROI for an archive-heavy fleet.

### 3.1 Migrate archive infrastructure off hash-based archives (do this first, this quarter)

This is client-side, available today, and worth more than every protocol change in your window combined:

- **Geth path-based archive (v1.16+, matured through v1.17):** full historical state as flat-state history + reverse diffs in ~**2 TB** (vs 12–20+ TB hash-based). Full genesis sync ~2 weeks instead of months. Cold history can live on HDD via `--datadir.ancient`; retention is configurable (`--history.state=N`) so you can run "partial archive" nodes. **Caveat:** historical `eth_getProof` needs `--history.trienode=N` (v1.17+) at ~6.5 TB total — if you serve historical Merkle proofs (compliance/zK workflows), scope that requirement per-node rather than fleet-wide.
- **Erigon 3:** archive in ~**1.8–2.2 TB**, full ~920 GB. Battle-tested for archive workloads; worth benchmarking against Geth path-based for your query mix.
- **Action:** audit which nodes actually need (a) full-history state queries, (b) historical proofs, (c) only recent-window state. Right-size each class; stop paying hash-based prices for workloads that fit a 2 TB profile.

### 3.2 Exploit history expiry on the full-node fleet

- Enable pre-Merge history pruning on full nodes (per-client flags documented in the EF's July 2025 partial-history-expiry post; automated pruning is landing in newer releases).
- Track clients' rolling-retention defaults over the next two releases — the p2p network is converging on serving only recent history (likely ~1 month floor). Update your sync/backfill runbooks to source old history from your own archive tier / era files, not from peers.
- Keep full nodes comfortably on 2 TB NVMe; scheduled prunes before ~80% usage.

### 3.3 Position for the post-4444 world (strategic)

- You keep the data the network is dropping. Formalize it: maintain **era files** (consensus) + EL history exports, consider running **Portal Network** nodes, and treat "historical data availability" as a product/SLA rather than an internal convenience.
- When evaluating "should we keep N archive nodes," price in that the public fallback (asking peers) is going away by design.

### 3.4 Capacity plan with honest numbers

- **Live state:** model **+100–150 GB/year** (upper bound if 8037 slips; ~120 GB/yr worst-case is the *design target* at 150M gas; today we're at 60M).
- **Archive tier:** after the 3.1 migration, budget from a ~2 TB/node baseline growing with history; add your proof-retention premium only where needed (~6.5 TB class).
- **Sync/rebuild time:** expect continued improvement from BAL-based healing (snap/2) post-Glamsterdam, but plan DR rebuilds in the "days to ~2 weeks" range, not hours.
- **No line item** should assume state expiry, Verkle, binary trees, or statelessness before late 2028. Revisit this brief after Glamsterdam mainnet and after Hegotá headliner scoping concludes.

### 3.5 Watch items that would change this picture (triggers to re-plan)

- **EIP-8037/8038 DFI'd or materially delayed** → growth-rate cap slips; revert to unconstrained ~150M-gas-limit growth assumptions.
- **Binary-tree (PBT) transition gets a fork relationship (CFI for any fork)** → start a multi-year migration watch; eventually changes everything about node storage, but with a long runway.
- **Rolling history expiry defaults tighten faster than expected** → accelerates your need for self-hosted history sourcing.
- **State expiry revived from Stagnant** → today it's dormant; any movement would show up first on ethresear.ch and ACDT calls.

**Where to monitor:** forkcast.org (EIP stage changes + devnet matrices; the `/api/eips.json` and `/feed.xml` endpoints are scriptable — worth wiring into a monthly check), ACDE/ACDT call summaries, and the Eth R&D Discord archive (eth-rnd-archive).

---

## Appendix: Sources (all checked 2026-09-23)

- **forkcast.org** — upgrade status (Glamsterdam: Upcoming, testnets, est. Dec 2 2026; Hegotá: Planning, est. 2027, FOCIL + Frame Tx headliners), EIP stage histories (EIP-8037 SFI May 2026; EIP-8038 SFI Aug 2026; EIP-7928 SFI headliner; EIP-3298/8372 Proposed for Hegotá), ACDE/ACDT/breakout call summaries (ACDE #226/#227/#228 state-growth pricing decisions; price breakout #7 targets; ACDE #243 client retention defaults and ~120 GB/yr figure; ACDE #244 binary-tree migration reference; BAL #008 archive/4444 pressure).
- **EF Blog, "Partial history expiry" (2025-07-08)** — eth/69 support across clients, 300–500 GB savings, per-client pruning instructions.
- **EIP-4444 / EIP-7642** — history expiry spec; eth/69 shipped in Fusaka.
- **EIP repo statuses** — EIP-6800 & EIP-7612 (Verkle) Stagnant; EIP-7736 (state expiry) Stagnant.
- **Geth docs, "Archive mode"** — path-based archive (~2 TB full flat-state history; ~6.5 TB with trie-node history; v1.17 `eth_getProof` via `--history.trienode`; hash-based 20 TB+ class).
- **Erigon 3 / ethereum.org archive-node docs** — Erigon archive under ~3 TB (~1.8 TB measured); legacy clients 12 TB+.
- **ethresear.ch (Oct–Nov 2025)** — "State expiry: in-protocol vs out-of-protocol"; "Compression-based state expiry" (incl. ~350M accounts / ~1.3B slots measurements, ~80% of state cold at slot granularity, archive-size compression research to ~5–6 TB).
- **ethereum.org/roadmap/statelessness** — canonical framing of history expiry vs state expiry vs statelessness (note: page lags current fork scoping; forkcast is authoritative for "is it scheduled").
- Mainnet gas limit observed at 60M (block ~26,038,812, 2026-09-23) via public RPC.
