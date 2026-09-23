# Ethereum State Growth: Technical Brief for Infrastructure & Capacity Planning

**Date:** 2026-09-23
**Audience:** Engineering team + Finance
**Planning window:** ~18–24 months (through mid/late 2028)
**Sources:** forkcast.org (EIP/fork status, ACD call summaries), EIP specifications, ethresear.ch, client documentation. Statuses verified against primary sources on the date above.

---

## Executive summary (for finance)

- **Nothing shipping in the next 18–24 months reduces the amount of data your nodes must store.** No protocol change in any scheduled fork shrinks state or archive-node requirements. Plan for continued growth, not relief.
- **The next fork (Glamsterdam, targeting ~late 2026) slows the *rate* of state growth** by raising the gas cost of creating new state ~5–8×. This is a rate limiter, not a fix — and it ships *together with* a plan to raise the block gas limit from 60M toward ~200M, so absolute state size keeps climbing.
- **The ideas that would actually reverse the trend — state expiry, a new state tree (binary trees, formerly Verkle), statelessness — are all unscheduled.** The most concrete one (state expiry) just had its enabling proposal rejected from the 2027 fork. Treat them as 2028+ at the earliest, and budget as if they may slip further.
- **Your biggest lever is not the protocol, it's client software.** An archive node on Erigon is ~2 TB today; the same data on Geth is ~20+ TB and growing ~5 GB/day. If any of your fleet still runs Geth-class archive nodes, migrating clients is worth more than any upcoming fork.
- **Recommended budget posture:** size for ~120–160 GiB/year of live-state growth and proportionate archive growth through 2028, with headroom for the planned gas-limit increases. Do not book savings from state expiry, Verkle/binary trees, or statelessness inside this window.

---

## 1. What is actually driving this at the protocol level

### 1.1 Three different datasets, three different problems

"Disk usage" on an Ethereum node is three distinct things, and conflating them leads to bad capacity decisions:

| Dataset | What it is | Size today (approx.) | Growth driver |
|---|---|---|---|
| **Live state** | Account balances, nonces, contract code, and contract storage *as of the chain head* | ~390 GiB (Geth state DB, Jan 2026) | New accounts, new storage slots, new contract code |
| **History** | Block bodies, transactions, receipts back to genesis | ~1+ TB (post pre-Merge pruning: ~300–500 GB less) | Every block, forever |
| **Historical state (archive)** | Enough information to answer "what was the state at block N?" for every N | The dominant archive cost: ~2 TB (Erigon) to ~20+ TB (Geth) | Every state change in every block, forever |

A **full node** keeps live state + (prunable) history. An **archive node** additionally keeps historical state — that third dataset is what makes archive nodes expensive, and it is *unbounded by design*: the protocol never deletes anything.

### 1.2 Why live state grows monotonically

Ethereum's state is a key-value store (account balances/nonces/code + contract storage slots) committed to in a Merkle Patricia Trie. The protocol-level facts that drive growth:

- **Nothing ever expires.** Once an account or storage slot is created, every node carries it forever. There is no rent, no TTL, no garbage collection beyond the (largely ineffective) storage-clearing refund.
- **Most state is write-once, never-touch-again.** Recent empirical analysis of mainnet access patterns (ethresear.ch, June 2026) found ~55% of all written storage slots are created once and never touched again; the top 1% of accounts capture ~96–98% of all read activity. Your nodes carry a huge cold tail so a small hot set can be served.
- **Contract storage dominates.** ~82% of state by size is contract storage slots; accounts ~14%, bytecode ~4%.
- **State cost is underpriced relative to its lifetime cost.** A new storage slot costs 20,000 gas once, but every node stores it in perpetuity. This broken price signal is the root cause the current repricing work targets.

### 1.3 Why it's accelerating: the gas limit

State growth tracks block capacity. The L1 gas limit went 30M → 36M → 45M → 60M during 2025 (EIP-7935 made 60M the client default in Fusaka, Dec 2025), and it sits at 60M today. Measured effect (from the EIP-8037 specification, Jan 2026 data):

- New state created per day went from **~105 MiB/day (at 30M) to ~326 MiB/day (at 60M)** — a ~3× jump for a 2× gas-limit increase.
- That's **~116 GiB/year** of new live state at the current limit.
- Core devs' stated intent is to keep raising the limit toward **~200M after Glamsterdam**. Without repricing, that trajectory implies **~387 GiB/year**, which would push the ~390 GiB state past the ~650 GiB "performance degradation" threshold (bloatnet initiative) in under a year. *This is exactly why the repricing below exists.*

### 1.4 Why archive nodes hurt specifically

Archive nodes keep every historical state, not just history. Two consequences:

- **Growth compounds with activity**: every state write in every block is retained. Higher gas limits → more writes per block → faster archive growth.
- **Client implementation matters enormously.** Geth's archive stores every intermediate trie node (~20–22 TB, growing ~5 GB/day, weeks-long sync). Erigon and Reth restructured this (deduplicated, append-only history) and store the same guarantees in ~2–4 TB with much faster sync. The protocol mandates *what* is kept, not *how* — the 10× difference is pure client engineering.

---

## 2. What is coming at the protocol level — and how much to bank on it

Status terms: **SFI** = Scheduled for Inclusion (in devnets, ships barring disaster). **CFI** = Considered for Inclusion (not confirmed). **No fork relationship** = not scheduled for any fork.

### 2.1 Glamsterdam — targeting ~late 2026 (forkcast working estimate: Dec 2, 2026)

Devnet series is complete (devnet 8 live as of Sept 2026); public testnets are next. Slippage into early 2027 is possible but this is a real, scoped fork. State-relevant contents:

| EIP | Status | What it does | Effect on you |
|---|---|---|---|
| **EIP-8037** State Creation Gas Cost Increase | **SFI** (May 2026) | Reprices state creation via a "cost per state byte" (CPSB = 1,530 gas/byte) with separate metering. New account: 25k → ~184k gas (~7×); new slot: 20k → ~98k gas (~5×); contract deploys ~8×. Targets ≤120 GiB/yr state growth at a 150M reference gas limit | **Slows growth rate.** High confidence it ships — final numbers confirmed on ACDE #243 (Aug 2026) and it's on devnet 8. But it co-ships with gas-limit increases, so net state size still grows |
| **EIP-8038** State-access gas cost update | **SFI** | Raises gas costs of state *reads* to match today's larger state | Indirect; marginal demand-side effect |
| **EIP-2780** Resource-based intrinsic gas | **SFI** | Charges +25,000 intrinsic gas for transactions that create a new account | Modest additional growth dampener |
| **EIP-7928** Block-Level Access Lists (headliner) | **SFI** | Every block ships a list of exactly what state it touched, with post-tx diffs | **Operational upside:** enables parallel disk reads, and BAL-based sync healing (snap/2, EIP-8189) that should materially improve sync times. Also the plumbing a future state-tree migration would replay |
| **EIP-7732** ePBS (headliner) | **SFI** | Enshrined proposer-builder separation | Not state-related directly; a prerequisite for any future statelessness |

**Net assessment:** Glamsterdam changes the *slope*, not the direction. Worst-case growth under the new pricing is ~120 GiB/yr at 150M gas and ~160 GiB/yr at 200M (per the EIP-8037 model) — versus ~387 GiB/yr unmitigated at 200M. Bank on the repricing landing; do not bank on it reducing your absolute storage needs.

### 2.2 Hegotá — 2027 (forkcast working estimate: mid-2027)

Headliners are FOCIL (censorship resistance) and Frame Transactions (account abstraction). **Nothing in the current scope relieves state or storage.** Of note:

- **EIP-8188** (last-written-block metadata — the consensus-level foundation for state tiering/expiry) was proposed for Hegotá in May 2026 and **formally declined (DFI) on Sept 10, 2026**. This is the clearest signal that state expiry is *not* on the near-term track.
- **EIP-8368** (CPSB recalibration) is proposed — it merely re-tunes EIP-8037's constant for higher gas limits (discussion references limits toward 600M). More evidence the roadmap is "reprice and scale," not "shrink."
- **Rolling history expiry** is converging *outside* the fork process: as of ACDE #244 (Aug 27, 2026), all EL clients agreed to align on a ~33,000-epoch (~4.7 month) retention window, with EIP-4444 being updated to match. This is real and likely lands via client releases around this timeframe — **but it prunes history, not state. It helps 2 TB full-node operators, not archive nodes.**

### 2.3 Aspirational / not scheduled — do not budget for these inside 24 months

| Item | Reality as of Sept 2026 |
|---|---|
| **State expiry** (expire cold state, resurrect via proofs) | Research phase. Strong recent results (a Jan 2026 experiment showed keeping only 1 year of active state cuts the DB ~78% and speeds execution ~15%), and active debate on in-protocol vs out-of-protocol designs (ethresear.ch, Oct 2025). But its enabling metadata EIP (8188) was just DFI'd from Hegotá, and no expiry EIP has any fork relationship. **Aspirational; 2028+ at best.** |
| **Verkle trees** (EIP-6800) | **Effectively dead.** EIP is Stagnant; deprioritized in 2024–25 over ZK-proving and quantum-resistance concerns. Ignore any older roadmap material referencing Verkle. |
| **Binary trees / PBT** (EIP-8297 + migration EIP-8347) | The *current* chosen direction for replacing the state tree: hash-based (quantum-safe), ZK-friendly, designed to support expiry later. But both EIPs are **Drafts from June/July 2026 with no fork relationship**, the hash function is undecided, and the migration plan has open problems. Even proponents treat this as a multi-year effort. **Not in your window.** |
| **Statelessness** (validators verify blocks without storing state) | Depends on the tree migration + ePBS + witness gas accounting. ePBS lands in Glamsterdam; the rest is years out. **Not in your window.** |
| **Full EIP-4444 history expiry** | Partially shipped: since July 2025 all EL clients prune pre-Merge history (saves 300–500 GB on full nodes). Rolling expiry (~4.7-month window) is aligning now. Helps full nodes; **archive nodes are explicitly out of scope** — by definition they retain everything. |

---

## 3. What to do in the meantime

Given the above, the planning posture for the next 18–24 months: **mitigate operationally, don't wait for the protocol.**

### 3.1 Capacity planning numbers

- **Live state:** ~390 GiB (Jan 2026) growing ~116 GiB/yr today; assume **~120–160 GiB/yr** through 2028 under Glamsterdam repricing with rising gas limits. Live state roughly doubles within your window on the conservative end.
- **Full nodes:** a 2 TB drive remains workable through the window *if* you adopt clients' history-expiry defaults (pre-Merge pruning today, rolling ~4.7-month retention coming). Budget 4 TB for headroom on new purchases — it's cheap insurance against slippage in the pruning work.
- **Archive nodes (Erigon/Reth-class):** ~2 TB today → plan for **roughly 3–4 TB within 24 months**; buy 4–8 TB NVMe per node depending on where in the window you refresh. Add margin for the post-Glamsterdam gas-limit ramp — archive growth tracks state *writes*, which scale with the gas limit even after repricing.
- **If you run Geth-class archive nodes:** ~20–22 TB growing ~5 GB/day (~1.8 TB/yr) with 3–6 week genesis syncs. There is no capacity plan that makes this attractive; see 3.2.

### 3.2 Operational levers (ordered by ROI)

1. **Standardize on Erigon or Reth for archive workloads.** Same data and RPC surface, ~10% of Geth's disk, days-not-weeks syncs. This is the single largest cost reduction available and it exists *today*. Geth archive only makes sense for legacy instances you can't yet migrate.
2. **Question how much of the fleet truly needs to be archive.** Archive is only required for historical *state* queries (balances/storage at block N). Historical blocks/txs/receipts can be served by full nodes with retained history, and most analytical workloads are better served by your indexer/warehouse layer. Every node you demote from archive saves the largest and fastest-growing dataset.
3. **Adopt history-expiry client features as they ship** (pre-Merge pruning now; rolling retention when your client ships it). For any residual need for old history, the ecosystem's answer is the Portal Network and specialized providers — you don't need every node to be a museum.
4. **Separate storage tiers.** Live state needs high-end NVMe (it gates sync and head-following). Historical/archive data is append-mostly and read-infrequently — colder, cheaper storage tiers are viable there, especially on Erigon-class clients that already separate the two on disk.
5. **Exploit Glamsterdam's sync improvements.** EIP-7928 (BALs) plus snap/2 healing should cut sync times meaningfully; re-baseline your sync-time SLOs after the fork and after client releases that implement BAL-based healing.
6. **Track the growth rate, not just the total.** The variable that moves your budget is MiB/day of new state, and it steps up with each gas-limit increase. Put it on a dashboard (it's derivable from your own nodes) so the post-Glamsterdam repricing effect is measured, not assumed.

### 3.3 What to watch (triggers that would change this plan)

- **Glamsterdam mainnet date** (testnets now; estimate Dec 2026 — slip risk into Q1 2027) and the **final EIP-8037 numbers** as deployed.
- **Post-Glamsterdam gas-limit trajectory.** The stated direction is ~200M, with 600M discussed in ACD. Each step multiplies state-write throughput; the repricing only partially offsets it.
- **Hegotá scope finalization (2027).** If any state-tiering/expiry EIP gets CFI'd there, the long-term picture improves — but even then, mainnet would be late-2027+ with rollout risk.
- **PBT (EIP-8297/8347) progress.** If these move from Draft to CFI for a named fork, that's the first credible signal of a real state-tree migration — realistically a 2028+ event.
- **History-expiry retention decision** (~33k epochs is the current convergence point) and your clients' default flag changes.

---

## Appendix: key figures and sources

- Live state size ~390 GiB, growth ~105 → ~326 MiB/day after 30M → 60M gas limit, ~116 GiB/yr; ~387 GiB/yr projected at 200M unmitigated; 650 GiB degradation threshold — **EIP-8037 spec** (eips.ethereum.org/EIPS/eip-8037).
- EIP-8037/8038/2780/7928/7732 SFI for Glamsterdam; EIP-8188 DFI for Hegotá (2026-09-10); Hegotá headliners FOCIL + Frame Txs; projected activations — **forkcast.org** (`/api/eips.json`, `/api/upgrades.json`; projected dates are forkcast planning estimates, not announced dates).
- History-expiry client alignment on ~33k epochs — **ACDE #244 summary, 2026-08-27** (forkcast). Pre-Merge partial history expiry shipped July 2025 — **EF blog, "Partial history expiry"**.
- State access concentration (55% write-once slots, top-1% accounts = 96–98% of reads) — **ethresear.ch, "The Anatomy of Ethereum's State Access," June 2026**.
- 1-year-active-state experiment (78% DB reduction, ~15% faster execution) — **ethresear.ch, Jan 2026**.
- Archive node sizes: Erigon 2.03 TB (docs, measured mid-2026); Geth archive ~20–22 TB, ~5 GB/day — **Erigon hardware docs; operator reports, 2026**.
- Verkle deprioritization / binary tree direction — **EIP-6800 (Stagnant), EIP-7864, EIP-8297, EIP-8347**; stateless-consensus call notes.
- Gas limit 60M current; 200M post-Glamsterdam direction — **gaslimit.pics (Xatu data); ethereum.org, "Building on Ethereum in 2026" (Sept 2026)**.
