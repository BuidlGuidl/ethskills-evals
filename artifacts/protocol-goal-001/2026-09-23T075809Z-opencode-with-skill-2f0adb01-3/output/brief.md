# Ethereum State Growth — Technical Brief for Capacity Planning

**Date:** 2026-09-23 · **Planning window:** through ~Q1–Q3 2028
**Audience:** infra engineering + finance
**Sources:** forkcast.org (EIP/fork status, ACD call summaries through Sep 17 2026), ethresear.ch, client docs (Erigon, Geth, Reth), ethereum.org. Statuses are as of today; this document should be re-validated quarterly.

---

## TL;DR

1. **Disk growth is driven by state, not history.** Ethereum's live state (accounts + contract storage in a Merkle-Patricia Trie) only ever grows — writes create ~55% of storage slots that are *never touched again*, and the protocol currently has no mechanism to retire dormant state. A Geth node's state-dedicated DB was ~340 GiB in May 2025 and research flags ~650 GiB as a performance cliff ("bloatnet" threshold).
2. **Nothing in our window shrinks state.** The Verkle tree migration is dead (Stagnant). Its successor (Partitioned Binary Tree, EIP-8297) is a Draft with **no fork assignment** — earliest plausible activation is 2028+, with actual state expiry coming *after* that. Treat any "stateless Ethereum" slide you see as aspirational.
3. **What we *can* bank on: growth-rate mitigation.** Glamsterdam (mainnet ~Dec 2026) ships a full state-gas repricing package (EIP-8037 et al.) that core devs explicitly designed to cap state growth as the gas limit scales 60M → 200M. Sepolia forks Oct 6, 2026 (confirmed); mainnet date lands within weeks after Hoodi (~late Oct). High confidence, ~3 months out.
4. **History-side relief is real and under-appreciated.** Clients are converging on ~5-month history retention defaults (EIP-4444 updated accordingly), motivated by exactly our problem: "2TB node operators hovering at 1.5–1.8 TB" (ACDE #243, Aug 2026). This bounds *full-node* disk, and lands ~Hegotá (mid/late 2027). It does nothing for the state trie — but it changes what "archive" means operationally (see §3).
5. **Budget posture:** plan for state-driven growth to continue through the entire window at a moderated-but-positive rate, with the main upward risk being the post-Glamsterdam gas-limit ramp. Archive *hardware* pressure is mostly a client-architecture choice: 2 TB-class archive nodes (Geth path-based, Erigon, Reth) vs 12–20 TB-class (Geth hash-based, Nethermind, Besu). The cheapest lever we own today is which archive architecture we run — not anything the protocol will do for us.

---

## 1. What is actually driving this at the protocol level

### 1.1 The three data categories on an EL node

| Category | What it is | Growth behavior |
|---|---|---|
| **State** | Live accounts + contract storage + contract code, committed in a Merkle-Patricia Trie (MPT) whose root sits in every block header | Monotonic-ish growth; nothing is ever retired |
| **History** | Block bodies, headers, receipts, and (for archive) every intermediate state trie | Grows with every block; now being bounded by history expiry |
| **Blobs** | L2 data-availability blobs (EIP-4844, PeerDAS since Fusaka) | Auto-expires in ~18 days; a CL-side concern, not our state problem |

Archive nodes additionally keep **every intermediate state trie** back to genesis — that's the multiplier that makes "archive" a different hardware class from "full."

### 1.2 How state is stored

- The MPT is a **hexary** (16-ary) **tree of tries**: a global account trie (keyed by `keccak256(address)`), and inside every account a separate storage trie (keyed by `keccak256(addr, slot)`), plus code stored by hash. Nodes are RLP-encoded and content-addressed by Keccak hash.
- Hash-addressing means each account's storage scatters randomly across the key space; updating one slot rewrites the path from leaf to root, dirtying ~8–10 trie nodes and forcing random disk reads/writes. This is why state *size* and state *access performance* degrade together, and why sync times worsen as the trie grows: bigger trie → less of it hot in memory → more random I/O per block.
- ~400M trie nodes at present; several thousand touched per block.

### 1.3 Why it only grows

Measured on mainnet (ethresear.ch, "The Anatomy of Ethereum's State Access," June 2026):

- **~55% of storage slots written are created once and never touched again.** Write traffic is dominated by *creation*, i.e., state growth is structural, not churn.
- Activity is extremely concentrated (top 1% of accounts absorb ~96–98% of reads), so the dormant tail compounds while the hot set stays small.
- Gas fees are the only throttle the protocol has today: at 36M gas limit, measured new state creation was ~205 MiB/day (it doubled from ~102 MiB/day when the limit went 30M → 36M). State creation demand is short-run **inelastic** (~0.6 elasticity) — price hikes slow growth but don't stop it.
- Bottom line for capacity planning: **live state is ~340 GiB (Geth, May 2025), grows on the order of hundreds of MiB/day, scales roughly linearly with the gas limit, and hits a known I/O cliff around ~650 GiB** where state-access times and sync costs degrade sharply (bloatnet findings).

### 1.4 What "archive" costs, by client architecture (mid-2026 measurements)

| Client / mode | Archive datadir | Notes |
|---|---|---|
| Geth, **hash-based** (legacy archive) | **12–20+ TB** | Only mode with historical `eth_getProof`; genesis sync takes weeks–months; compaction overhead is heavy |
| Geth, **path-based** (v1.16+, reverse-diff) | **~1.9–2.0 TB** | Keeps full history via reverse diffs; **no historical Merkle proofs yet** |
| Erigon 3 + Caplin, `--prune.mode=archive` | **2.03 TB** (Jul 19, 2026) | Flat deduplicated KV; recommended disk 4 TB |
| Reth, archive | **~2.2–3 TB** | Strong tracing; staged/pipelined sync |
| Nethermind / Besu, archive | **~12–18 TB** | Heaviest archive footprints |

Same chain, same data — a 10x spread in disk cost purely from how the client lays out historical state. The 2 TB-class clients reconstruct historical state from diffs/KV snapshots instead of storing every historical trie node verbatim.

### 1.5 The near-term accelerator we must plan around

ACDE has confirmed **200M gas as safe for Glamsterdam (>3x the current 60M)**, with EIP-8261 (gas-limit schedule via CL config) approved as an optional parameter — i.e., a deliberate ramp *after* the fork, not at it. Pre-repricing modeling (ethresear.ch, Nov 2025) had state reaching **686 GiB (conservative) to 1.08 TiB (aggressive) by mid-2027** under gas-limit schedules alone. The repricing package in §2.2 is the core devs' explicit countermeasure to exactly this curve — effective, per the modeling, but mitigation, not reversal.

---

## 2. What's coming from the protocol — and what to bank on

### 2.1 Fork timeline relevant to our window

| Fork | Status / date | Confidence |
|---|---|---|
| Fusaka | Live Dec 3, 2025 | — |
| **Glamsterdam** | Sepolia Oct 6, 2026 (confirmed); Hoodi ~Oct 27, 2026 (go/no-go Oct 8); **mainnet ~early Dec 2026** (Forkcast working estimate — *not an announced date*) | **High** — SFI'd, devnet series complete, on public testnets now |
| **Hegotá** | Planning; headliners SFI'd (FOCIL EIP-7805, Frame Transactions EIP-8141); Forkcast working estimate **~mid-2027** | **Medium** — scope still forming |
| Fork after Hegotá | Unnamed, ~2028+ | Speculative |

### 2.2 Glamsterdam — ships in our window, bank on it (high confidence)

All SFI'd (devnet-7/8 tested; spec bug-fix for EIP-8037 approved Sep 3, 2026; repricing numbers final Aug 13, 2026):

- **EIP-8037 — State Creation Gas Cost Increase.** The centerpiece: ~10x on state-creation costs, separate state-gas metering. Exists specifically to cap state growth under higher throughput.
- **EIP-8038** (state-access repricing), **EIP-2780** (resource-based intrinsic gas), **EIP-7976** (calldata floor), **EIP-7981** (access-list cost) — the rest of the repricing package.
- **EIP-7928 — Block-Level Access Lists.** Not state relief itself; it's the groundwork for stateless validation (clients get told exactly which state a block touches).
- **EIP-8246** (remove SELFDESTRUCT burn), plus networking: eth/70 partial receipts, eth/71 BAL exchange, snap/2 BAL-based state healing.
- Unlocks the **gas-limit ramp toward 200M** post-fork (with EIP-8368-style recalibration available for later, larger limits).

**What it means for us:** slower state growth per unit of activity starting ~Q1 2027. It does not delete a single byte. Plan for *moderated continued growth*, and expect the repricing to be tuned again at Hegotá (EIP-8368 "CPSB Recalibration" — Proposed, broad support, "likely CFI"; EIP-8372 normalized state gas limit — Proposed, kept alive alongside it).

### 2.3 Hegotá — probably lands late in our window (medium confidence)

Headliners are FOCIL and Frame Transactions — **not** state items. State-relevant candidates currently on the table (all still only *Proposed*, i.e., could all fall off):

- **EIP-8368 / EIP-8372** — state-gas recalibration/normalization as gas limit scales further (see above).
- **History-expiry package:** EIP-8383 (reduce CL block retention window), EIP-8304 (trustless log/tx index with proofs — an alternative to hoisting old history on archive nodes), EIP-4758 (deactivate SELFDESTRUCT), EIP-3298 (remove storage-clear refunds).

### 2.4 History expiry — real, converging, and it changes *our* job

This bounds history, not state, but it's the piece most likely to change archive-node operations inside the window:

- Clients are aligning on a **~33,000-epoch (~5 month) retention window** matching the CL block retention period (ACDE #244, Aug 27, 2026); EIP-4444 is being updated to document it. Client readiness: Nethermind, Nimbus, Reth ready; Geth, Erigon, ethrex in progress.
- Explicit motivation on ACDE #243 (Aug 13, 2026): full-node operators at 2 TB disks are at 1.5–1.8 TB and "history expiry is needed" once the gas limit scales.
- Expect: default-pruned history in all major EL clients around Hegotá, with full-history retention becoming an **explicit opt-in** (archive flags), and old-history serving moving toward specialized infrastructure (Portal Network, EIP-8304-style proof indexes). Archive flags will keep working — but serving pre-cutoff history will increasingly be a deliberate, supported-but-not-default posture.

### 2.5 State expiry / tree migration — aspirational only; NOT in our window

This is where most stale blog posts will mislead finance. Current, verified status:

| Proposal | What it is | Status (Sep 2026) |
|---|---|---|
| Verkle trees (EIP-6800 + family) | The 2019–2024 statelessness plan | **Stagnant** — effectively dead; deprioritized in 2024–25 for ZK- and post-quantum-compatibility reasons |
| Unified binary tree (EIP-7864) | Single binary tree replacing the MPT | **Draft, no fork relationship** |
| **Partitioned Binary Tree (EIP-8297)** | The current frontrunner: single binary tree, zones, co-located account data, designed so per-account/per-bucket expiry is a natural operation | **Draft, no fork relationship** (published Jun 2026); discussed as a bundle with the post-quantum deposit-contract migration; offline migration path (EIP-8347) also Draft |
| State tiering by periods (EIP-8295/8296) | Price dormant-state writes higher; groundwork EIP-8188 (last-written block) | Drafts, no fork relationship; EIP-8188 **Declined for Hegotá** |

Even in the best case where PBT is SFI'd for the fork after Hegotá, the realistic sequence is: fork (2028+) → multi-year migration window → *then* expiry mechanisms built on the new tree. **There is no scenario in which meaningful state is retired from our disks before ~2029.** The Glamsterdam/Hegotá repricings are the only state-side relief we will see, and they only bend the slope.

---

## 3. Recommendations

### 3.1 Planning assumptions for finance (through ~mid-2028)

- **Assume no state-size reduction, ever, within this budget cycle.** Model state growth as: current ~340–450 GiB live state, growth rate roughly linear in the gas limit, partially offset (perhaps 30–60%) by Glamsterdam repricing from Q1 2027. Treat the 650 GiB bloatnet threshold as the point where we expect to buy faster NVMe/RAM, not just more of it — state-access latency and sync time degrade before raw capacity runs out.
- **Upside risk to model:** gas-limit ramp to 200M+ faster than the repricing fully offsets (state-creation demand is inelastic; a 3.3x throughput regime grows state ~3x faster per unit of price relief).
- **Downside relief to model:** full-node (non-archive) history plateaus once default history expiry lands (~Hegotá). Full-node disk stops being proportional to chain age.
- **Archive disk budgets:** a 2 TB-class archive datadir today plus headroom → spec **4–6 TB NVMe per archive node** for the window; if we keep any hash-based/Merkle-proof archive (Geth legacy, Nethermind, Besu), budget **12–20 TB+ per node** and expect those code paths to be in maintenance mode. Do not expand that fleet.

### 3.2 Architecture moves for the team

1. **Standardize the archive fleet on reverse-diff/flat-KV clients** (Geth path-based v1.16+, Erigon 3 `--prune.mode=archive`, Reth). Same data, ~10x less disk, days-not-months resync. This is the single largest cost lever we control and it is available now.
2. **Keep exactly one small hash-based archive** (or a dedicated prover service) only if we have customers who need historical `eth_getProof`; path-based Geth does not support it. Otherwise drop it — this is where the tens-of-TB line items live.
3. **Decide our history-serving posture before Hegotá:** when EL clients flip to ~5-month default retention, our "archive" flags become the explicit opt-in. Inventory which products actually query pre-cutoff history; for the rest, plan around proof-based access (EIP-8304, Portal Network) rather than owning every byte ourselves.
4. **Split "archive" into two services in monitoring/capacity models:** (a) historical *state* reads (reverse diffs — grows with state, priced in §3.1) and (b) historical *history/logs* (grows with block volume, partly bounded by expiry decisions). They fail differently and the protocol treats them differently from here on.
5. **Prep for Glamsterdam now:** it activates on Sepolia Oct 6 and Hoodi ~Oct 27 — use those as rehearsals for client upgrades, EIP-8037/8038 gas-cost changes (breaks some contract tests and DApp expectations), BAL-related RPC surface changes, and the eventual gas-limit ramp.
6. **Test the 200M-gas regime early:** run a node on Glamsterdam testnets and measure our own per-block state delta and datadir growth under repriced costs; feed that back into the budget model instead of relying on published elasticity estimates.

### 3.3 Do **not** bank on

- Any state-tree migration (PBT/binary/Verkle) activating in the window.
- State expiry, tiered state, or any mechanism that deletes dormant slots before ~2029 at the earliest.
- Published fork dates beyond Sepolia/Hoodi as commitments — "early Dec 2026" for Glamsterdam mainnet and "mid-2027" for Hegotá are estimates; slips of one or two quarters are normal.
- "Roadmap diagrams" and pre-2025 blog posts about Verkle timing. They are wrong now.

### 3.4 Watch items with tripwires (re-check quarterly, ~30 min)

| Signal | Source | Tripwire → action |
|---|---|---|
| Glamsterdam mainnet date | forkcast.org schedule, eth-clients repo after Hoodi | Lock Q1 2027 budget assumptions; run repriced-growth measurement |
| Hegotá scope: EIP-8368/8372 (state gas), EIP-8383 (CL retention), EIP-8304 (proof index) | forkcast EIP fork-relationships (CFI/SFI) | Adjust growth model; start proof-index proof-of-concept if 8304 CFI'd |
| EIP-4444 update + client default-history pruning | client release notes, ACDE summaries | Execute §3.2 item 3 decision |
| PBT (EIP-8297) getting CFI/SFI for any named fork | forkcast | Only then extend planning beyond 2028 around migration |
| Gas-limit ramp pace post-Glamsterdam (EIP-8261) | any block explorer / our own nodes | If ramping faster than modeled, raise the state-growth line in the budget and revisit NVMe spec |
| Archive-mode support status of legacy (hash-based) paths | Geth/Nethermind/Besu release notes | Migrate remaining proof-serving workload before paths go maintenance-only |

---

## Appendix: primary sources

- Fork status, EIP inclusion stages, ACD call summaries: forkcast.org (EIP dataset generated 2026-09-23; ACDE #243 Aug 13 2026, ACDE #244 Aug 27 2026, ACDE #245 Sep 10 2026, ACDC #187 Sep 17 2026)
- State growth modeling: ethresear.ch/t/state-growth-scenarios-and-the-impact-of-repricings (Nov 2025); ethresear.ch/t/the-anatomy-of-ethereum-s-state-access (Jun 2026)
- Client disk measurements: docs.erigon.tech hardware requirements (measured 2026-07-19); geth.ethereum.org (path-based archive docs); reth.rs system requirements
- EIP specs: EIP-8037, EIP-8038, EIP-7928, EIP-8261, EIP-8368, EIP-8297, EIP-4444, EIP-8383 at eips.ethereum.org
- Note: Glamsterdam mainnet "2026-12-02" and Hegotá "2027-06-16" are Forkcast *projected activations* (planning estimates), not announced dates.
