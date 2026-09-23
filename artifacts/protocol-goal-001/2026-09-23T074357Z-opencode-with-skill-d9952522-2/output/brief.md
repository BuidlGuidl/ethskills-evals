# Ethereum State Growth: Protocol Status & Capacity Planning Brief

**Audience:** engineering + finance. **Prepared:** 2026-09-23.
**Protocol status verified against forkcast.org (dataset generated 2026-09-23), eips.ethereum.org, and AllCoreDevs call records. Fork "projected activation" dates quoted below are forkcast's planning estimates, not announced dates.**

---

## 1. Executive summary

- **Nothing scheduled in Ethereum's next two forks will reduce the state burden.** The two named upcoming upgrades — **Glamsterdam** (headlined by Block-level Access Lists and enshrined PBS) and **Hegotá** (headlined by FOCIL and Frame Transactions) — contain no state-tree replacement, no state expiry, and nothing that shrinks the archive dataset.
- **The one genuine protocol-level mitigation inside your window is gas repricing:** EIP-8037 (raise state-creation gas costs) and EIP-8038 (raise state-access gas costs) are **Scheduled (SFI) for Glamsterdam**. These *slow the rate of new state creation*; they do not reverse existing growth. Treat them as a modest flattening of the curve, not a fix.
- **The tree replacement is not coming inside 18–24 months.** The Verkle proposal (EIP-6800) is **Stagnant** and has been effectively superseded for post-quantum reasons by a hash-based **binary tree** direction (EIP-7864 discussion → **EIP-8297 "Partitioned Binary Tree," Draft, June 2026**). None of these have a fork relationship (SFI/CFI) with any named fork, and the two-next-fork scopes exclude them. Even if a binary tree were committed at the next scope-setting cycle, mainnet migration would realistically fall **at or beyond the end of your 24-month window** — and when it lands, its primary benefit is *stateless validation for ordinary nodes*, not a smaller archive for archive operators.
- **The big lever you control today is client software, not the protocol.** Archive-node footprints differ by an order of magnitude across clients/modes (Geth legacy hash-based archive ≈ 12–20+ TB; Erigon/Reth ≈ ~2 TB; Geth v1.16 path-based archive ≈ ~1.9 TB). Migrating the archive fleet to storage-efficient clients/modes is the single highest-impact action available in your planning window, independent of any fork.
- **Budget recommendation:** plan for continued ~90–110 GB/year of head-state growth per full node (per Vitalik Buterin's Feb 2026 research note, state grows ≈ 100 GB/yr today), assume **no protocol relief within 24 months**, and capture the client-side savings now.

---

## 2. Why state grows: how Ethereum actually stores it

**The MPT structure.** Execution-layer state lives in hexary (16-ary) **Merkle Patricia Tries (MPTs)**: one account trie keyed by address hash, plus a separate storage trie per contract and one global code store. Every block header commits to a `stateRoot`. The tree exists so any node can produce Merkle proofs of state against an untrusted peer — that authentication property is baked into consensus.

**Why that is expensive:**

1. **Internal-node overhead.** Only leaves hold state; the internal (branch/extension) nodes exist purely as proof scaffolding. Academic measurement at block 18M found ~218M leaves but ~294M internal nodes: **~1.7 bytes of tree overhead per byte of state**, i.e. storage utilization of the classic MPT representation is roughly 37%.
2. **Depth and I/O amplification.** Average leaf depth was ~8.6 at block 18M and increases with state size, so each state read/write is amplified into ~9 database operations; this worsens every year the state grows.
3. **Monotonic growth by construction.** New accounts, new contracts, and new storage slots are permanent entries. Deletions (selfdestruct-became-noop'd, zero-balance accounts) are rare and mostly historical. Blocks' gas throughput converts directly into state creation; as the gas limit rose through 2025 (45M default in Geth 1.16; EIP-8297's analysis uses a 60M regime), so does state throughput per second of chain time.
4. **Archive nodes multiply the problem.** A full node keeps the current state plus ~128 recent blocks of state; an archive node additionally retains **every historical state** (or, in modern implementations, diffs sufficient to reconstruct every historical state). The growth you feel operationally is the archive retention of a dataset whose logical size climbs ~100 GB/year *and* whose classic representation multiplies that by trie overhead.

**Do not confuse history and state.** Block bodies/receipts ("history," ~300–500 GB of pre-merge data) are now prunable by all major clients under EIP-4444's partial history expiry (shipped client-side since July 2025, no hard fork needed). This helps full nodes fit on 2 TB disks. It does **nothing** for the state trie, and archive operators are, by definition, the parties that retain this data for the ecosystem.

---

## 3. What's coming to the protocol — verified status

Status legend: **Live** = on mainnet; **SFI** = scheduled for a named fork (timing risk remains); **CFI** = considered, not committed; **No fork relationship** = proposal/research only. All statuses checked on forkcast.org, 2026-09-23.

### 3.1 Forks in view

| Fork | Status | Headliners | State-growth relevance |
|---|---|---|---|
| Fusaka | **Live** (activated 2025-12-03) | PeerDAS (EIP-7594), gas-limit increase, BPO forks | None direct; higher gas limits raise theoretical state-growth throughput |
| Glamsterdam | **Upcoming — SFI** (forkcast estimate: 2026-12-02) | **EIP-7928 Block-level Access Lists (BAL)**, **EIP-7732 ePBS** | **Indirect**: EIP-8037/8038 (below) are SFI here; BAL enables client-side parallel execution/prefetch and is the basis for faster snap healing (EIP-8189, snap/2, networking-layer) |
| Hegotá | **Planning** (forkcast estimate: 2027-06-16) | **EIP-7805 FOCIL**, **EIP-8141 Frame Transactions** | Nothing state-shrinking is SFI. State-expiry-adjacent items (e.g., EIP-8253 dead-account cleanup, EIP-8372 normalized state gas limit) are only "Proposed" |

### 3.2 The items that matter to you

| Item | Effect on your pain | Verified status (2026-09-23) |
|---|---|---|
| **EIP-8037 — State Creation Gas Cost Increase** | Raises/unifies the gas price of creating new state → throttles the growth rate at the margin | **SFI for Glamsterdam** (Considered 2026-01-19, Scheduled 2026-05-07 per ACD records) |
| **EIP-8038 — State-Access Gas Cost Update** | Raises gas price of state reads → second-order damping, mostly fairness | **SFI for Glamsterdam** (Scheduled 2026-08-04) |
| **EIP-7928 — Block-Level Access Lists** | No state size effect; enables parallel tx execution/validation and better sync heuristics in clients | **SFI for Glamsterdam (headliner)** |
| **EIP-8189 — snap/2: BAL-based state healing** | Faster snap-sync once BALs exist (networking protocol, not consensus) | Networking-track with Glamsterdam; depends on EIP-7928 |
| **History expiry — EIP-4444** | Bounds *history*, not state. Partial (pre-merge) expiry already shipped across all EL clients (saves ~300–500 GB/full node); rolling expiry still in progress | EIP itself still **Draft, no fork relationship**; implemented client-side outside forks |
| **Verkle tree — EIP-6800 (+ EIP-7612 overlay, EIP-7748 conversion, EIP-4762 gas remodel)** | Would have replaced MPT with Verkle; enables stateless clients; the overlay design would also let freezing nodes delete MPT internal nodes (real but unquantified disk relief for *current-state* nodes) | EIP-6800 **Stagnant**; 7612 **Stagnant**; 7748/4762 **Draft**. **No fork relationship for any.** The elliptic-curve commitment scheme is a post-quantum liability; per EIP-8297 the community direction has moved to hash-based trees |
| **Binary tree — EIP-8297 "Partitioned Binary Tree" (+ EIP-7864 discussion, EIP-8347 migration)** | Replaces MPT with a single hash-based binary tree: small SNARK-friendly witnesses, PQ-secure, zones designed as the substrate for later **state expiry** and partial statefulness | **Draft, created 2026-06-11, no fork relationship, no target fork.** Includes tree-change breaking change: in-EVM MPT proof verification breaks; your proof-related tooling would need rework |
| **State expiry (any flavor)** | Would bound active state by expiring cold entries | **Research phase; no EIP with fork relationship.** ethereum.org roadmap (updated June 2026) still describes state expiry, weak statelessness, and history expiry as "several years away," sequenced *after* a tree change |

### 3.3 Reading that table honestly

- **Inside 24 months, the protocol gives you: a slower growth rate (maybe), faster sync (probably), and nothing that makes stored state smaller.** EIP-8037 is the only scheduled item aimed directly at state growth, and it is a throttle on the derivative, not the stock.
- **The tree swap is the real fix, and it is genuinely not scheduled.** Both next forks have selected headliners not involving the tree; ACD scope for Glamsterdam is set. The earliest a binary-tree fork could even enter a scope is post-Hegotá, and the EIP is a June-2026 Draft with an open hash-function choice and an unspec'd migration (EIP-8347 TBDs). Do not budget against it landing before late 2028.
- **Even when it lands, its first-order beneficiary is validators/full nodes** (stateless verification, tiny witnesses, cheap sync), not archive operators. The archive product — historical states and historical proofs — remains someone's responsibility, and during/after migration that responsibility may get *more* operationally complex (two tree formats during conversion; eth_getProof semantics changing; EIP-7612-style freeze-and-delete options that clients MAY take).

---

## 4. What you can bank on vs. what's aspirational (18–24 month view)

**Bank on:**
1. Continued linear-ish head-state growth around **~100 GB/year per node** in absolute terms, with scheduled gas repricing at best bending that curve moderately from Glamsterdam onward. Size growth in *bytes on disk* additionally depends on your client's storage engine.
2. **Glamsterdam shipping roughly early in the window** with BAL + ePBS + gas repricing; a required client upgrade across your fleet; some block-structure/tooling changes (BAL field) to absorb in your ingestion pipeline.
3. **Client-side archive efficiency continuing to improve** regardless of forks: Erigon/Reth flat layouts today ≈ ~1.8–2.2 TB for full archive; Geth v1.16+ path-based archive ≈ ~1.9 TB full history (caveat: no historical `eth_getProof`, proofs only for the recent ~128 blocks) vs legacy hash-based ≥ 12–20+ TB.
4. **No consensus obligation to run archives.** The protocol never required them; EIP-4444 formalizes that the *network* is fine without everyone retaining history. Your capacity problem is a business-model choice, not a protocol constraint — which also means the protocol roadmap won't solve it for you.

**Don't bank on (inside the window):**
1. Verkle or the binary tree shipping — not SFI/CFI anywhere; EIP-6800 is dormant.
2. State expiry shipping — research-stage, explicitly sequenced behind a tree change.
3. Rolling (post-merge) history expiry — client-side work in progress, no agreement on serving guarantees; irrelevant to archive economics anyway.
4. Any retreat in the gas limit lowering growth — trajectory has been upward (45M→60M regime discussion), and repricing only partially offsets that.

**Budget framing for finance:** treat node capacity as a **linear Opex problem with a step-function mitigation already available** (client migration). The protocol roadmap contributes no reduction within the planning window; it changes the growth *slope* at most. Do not capitalize "Verkle/tree migration savings" into FY 2026–2028 plans.

---

## 5. What to do meanwhile

1. **Migrate the archive fleet to storage-efficient clients/modes now.** Erigon or Reth archive ≈ ~2 TB per node; if Geth ecosystem compatibility is required, path-based archive (v1.16+) ≈ ~1.9 TB. Against a legacy hash-based Geth archive this is roughly a **6–10x per-node disk reduction**, and it converts sync-from-genesis from months (hash-based) to ~1–2 weeks. Gate decision on whether your product serves historical `eth_getProof`: if yes, keep one hash-based node (or a hash-based segment covering audited ranges) while the reader fleet moves to the cheap mode.
2. **Standardize full nodes at ~2 TB-class disks** with scheduled offline pruning (Geth: prune-history / gcmode defaults; all clients support EIP-4444 pre-merge pruning today). Snap-synced Geth full nodes grow ~14 GB/week between prunes — automate the prune cadence instead of buying headroom.
3. **Retire-watch the MPT-specific tooling.** Any tree fork (binary or otherwise) breaks in-EVM historical proof verification and changes proof formats. Track EIP-8297/8347 + ACD calls quarterly (forkcast call summaries are the efficient feed) so a proof-format migration isn't an emergency.
4. **Plan capacity on the linear model:** ~100 GB/yr head-state growth per node + your retention overhead + client-specific trie overhead, with ACD risk of higher gas limits adding upside slope. Re-baseline after each fork.
5. **Exploit BAL once Glamsterdam lands.** Parallel execution/prefetch and snap/2 healing (EIP-8189) should cut sync wall-clock time — i.e., cheaper fleet rebuilds and faster DR. Test in testnets before relying on it.
6. **Optionally, engage upstream.** Operators of archive/proof infrastructure are exactly the constituency the tree-migration designers (EIP-8297/8347) need to hear from on migration cadence, proof-format stability, and `eth_getProof`-historical semantics. Contributions/reviews there buy optionality; participation is cheap relative to fleet cost.

---

## 6. Sources checked (all accessed 2026-09-23)

- **forkcast.org** — `/api/upgrades.json`, `/api/eips/{4444,4762,6800,7612,7748,7864,7928,8037,8038,8189,8297,8347}.json`, EIP fork-relationship records for Glamsterdam/Hegotá. ("Generated at 2026-09-23T06:47Z.")
- **eips.ethereum.org** — EIP-6800 (Stagnant), EIP-7612, EIP-7748, EIP-8297, EIP-8037, EIP-8038, EIP-4444, EIP-7928.
- **Ethereum Magicians** — EIP-7864 (binary tree discussion), EIP-8297 discussion thread.
- **ethereum.org/roadmap/statelessness + /roadmap/verkle-trees** (updated June 2026) — confirms research-phase status of state expiry/statelessness and the archive ~12 TB (Feb 2023) reference point.
- **ethresear.ch — "Hyper-scaling state…" (V. Buterin, 2026-02-05)** — current ≈100 GB/yr state growth figure.
- **blog.ethereum.org — "Partial history expiry" (2025-07-08)** — all EL clients support pre-merge pruning; 300–500 GB saving.
- **Geth v1.16.0 release notes & geth docs (archive mode; history pruning)** — path-based archive ≈1.9 TB, hash-based >20 TB, ~2 weeks vs months sync.
- **SlimArchive (USENIX ATC'24)** — MPT internal-node overhead (~1.7x) and depth amplification measurements.
- Client footprint figures (Erigon ≈1.8–2.2 TB; Reth comparable): Erigon docs / community comparisons, 2026.

*Caveat on numbers: client-reported sizes drift with chain growth and releases; re-verify against the client docs at procurement time. Fork dates are estimates until testnet→mainnet upgrade announcements exist.*
