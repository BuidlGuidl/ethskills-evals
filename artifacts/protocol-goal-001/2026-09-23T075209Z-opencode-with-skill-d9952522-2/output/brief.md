# Ethereum State Growth: Technical Brief for Capacity Planning (H2 2026 – H1 2028)

**Audience:** infra team + finance
**Prepared:** 2026-09-23
**Planning window:** ~18–24 months (through roughly Q1–Q2 2028)
**Status vocabulary used below:** **Live** (active on mainnet today) · **SFI** (scheduled for a named fork; timing still uncertain) · **PFI/CFI** (proposed/considered for a fork, not committed) · **DFI** (declined for that fork) · **No fork relationship** (proposal or research only — no ship date, do not plan on it).

---

## TL;DR (for finance)

1. **No protocol change in our planning window shrinks Ethereum's state.** The structural fixes (state expiry, Verkle/binary-tree state) are not scheduled for any fork. Verkle (EIP-6800) is marked **Stagnant**; the closest state-expiry precursor (EIP-8188) was **DFI'd for the Hegotá fork on 2026-09-10**.
2. **What is coming is metering, not deletion.** The Glamsterdam fork (EL = Amsterdam; mainnet not yet announced, forkcast's planning estimate is **2026-12-02**; testnets Sepolia Oct 6 / Hoodi Oct 27) includes gas repricings (EIP-8037/8038, both SFI) that raise the cost of creating state. Client teams' own target: worst-case state growth of **~120 GB/year at a 150M gas limit** — with the gas limit confirmed safe up to 200M, growth continues roughly at or above that rate. State growth is being *bounded*, not reversed.
3. **History (blocks/receipts) is already being pruned by default in all major clients** (~5-month aligned retention window agreed Aug 2026). This does not shrink archive nodes, but it means running a true archive node becomes an explicit, config-managed discipline rather than a default.
4. **Budget on current trajectory.** Disk is cheap relative to the risk of betting on relief that is not scheduled. Numbers that matter: full-plus-history nodes are running at **1.5–1.8 TB on 2 TB-class disks today** (ACDE #243/#244, Aug 2026), state adds **~120 GB/yr worst case** at target gas limits, and nothing structural relieves this before ~2028 at the earliest.

---

## 1. What is actually driving growth at the protocol level

### 1.1 Live state — a Merkle Patricia Trie that never forgets

- Ethereum's world state (account nonces/balances, all contract storage, contract code) lives in a **Merkle Patricia Trie (MPT)**; every trie node is an RLP-encoded key–value entry in each client's database. State is *append-mostly*: there is **no protocol mechanism to expire or garbage-collect state**.
  - New accounts, new storage slots, and new contract code are added cheaply (historically under-priced gas), and deletion barely happens: **SELFDESTRUCT was defanged in Shanghai (EIP-6780, Live)** so it rarely clears storage, and refund cuts in London (EIP-3529, Live) reduced the incentive to clear slots. Once a slot exists, it is a permanent cost for every full/archive node operator, forever.
  - The consequence: state size is a direct function of cumulative throughput — accounts created, contracts deployed, unique slots touched. That is why gas-limit policy dominates our growth curve (see §2.2).
- **Archive nodes store every intermediate state trie** (state at every block height, not just the latest). That is the multiplier that makes archive disks and archive syncs grow monotonically: a full node keeps one current state plus a short reorg window; an archive node keeps ~20M+ historical state roots and their tries. Nothing in any scheduled fork changes this.

### 1.2 History — blocks, receipts, blobs

- Block headers/bodies/receipts grow with transaction count. Post-merge constant 12s slots plus rising gas limits (Fusaka raised the default to **60M**, EIP-7935, Live; Glamsterdam targets are 150M–200M, see §2.2) mean history grows faster each year.
- Blob data (Dencun onward, massively expanded by PeerDAS in Fusaka, Live Dec 3 2025) rotates: consensus clients retain blob sidecars only ~18 days (ACDE #234, Apr 2026). If we serve historical blobs, that retention burden is entirely ours.
- **Client-side history pruning has been default for ~a year** (Geth-style EIP-4444 pruning of pre-merge bodies/receipts; networking support shipped as **EIP-7642/eth-69, Live in Pectra May 2025**; EIP-4444 itself remains a Draft EIP with no fork relationship — it is a client policy, not a fork).
- In Aug 2026 all EL clients **aligned on a ~33,000-epoch (~5-month) default retention window**, and EIP-4444 is being updated to document that number (ACDE #244, 2026-08-27). EIP-8383 (further cut to ~8,192 epochs ≈ 1 month) is **PFI for the next fork, Hegotá** (ACDT #92, Aug 2026). Direction of travel: default nodes keep less history; archive nodes keep everything by explicit opt-out.

### 1.3 New Glamsterdam data: Block Access Lists

- EIP-7928 Block-Level Access Lists (**SFI for Glamsterdam**, a headliner) add per-block state-access data. Current retention design: **~3,533 epochs ≈ 15.7 days ≈ 10 GB** (BAL breakout #9, Dec 2025); the EIP-7928 PR now proposes aligning retention to the 33,024-epoch CL window, and EL-side estimates say shrinking the window saves ~**144 GB of BAL storage** (ACDT #97, 2026-09-21). Note: **Geth currently retains all BALs while other EL clients prune at ~3,500 epochs** — a real per-client disk divergence we must track through the fork.

### 1.4 The honest summary of drivers

| Driver | Trend | Protocol relief in window? |
|---|---|---|
| State (accounts/slots/code) | ~120 GB/yr worst case at 150M gas (client-team target, May 2026) | Metering only (EIP-8037/8038, Glamsterdam). No expiry, no re-structuring. |
| Archive intermediate tries | Grows with every block, monotonically | None scheduled |
| History (bodies/receipts) | Grows with throughput; defaults now pruned ~5 months | Retention windows shrinking by client policy (EIP-4444 update; EIP-8383 PFI Hegotá) |
| Blobs | CL rotates at ~18 days; historical blob serving is on us | None needed (bounded) |
| BAL (new, Glamsterdam) | ~10 GB per ~15.7-day window; retention semantics still being aligned | SFI for Glamsterdam; retention is a client-policy question |

---

## 2. What is genuinely on the way vs. aspirational

### 2.1 Firm schedule anchors (as of 2026-09-23, per forkcast.org)

- **Fusaka — Live on mainnet since 2025-12-03** (block 23,935,694): PeerDAS (EIP-7594), default gas limit 60M (EIP-7935), BPOs (blob-parameter-only forks) introduced.
- **Glamsterdam (Amsterdam/Gloas) — SFI, in public testnet phase.** Devnet series complete (devnets 1–9); **Sepolia confirmed for 2026-10-06** (epoch 353,024), Hoodi tentatively 2026-10-27, client releases due 2026-09-29 (ACDT #97, 2026-09-21). **Mainnet date is not yet announced;** forkcast's working estimate is **2026-12-02** — treat that as a planning assumption, not a commitment.
- **Hegotá (Bogotá/Heze) — early Planning; no date.** Headliner selection concluded: **FOCIL (EIP-7805) and Frame Transactions (EIP-8141) are SFI'd headliners**. Forkcast's rough estimate is **mid-2027** (planning assumption only). Non-headliner scoping is happening on the Sep/Oct 2026 ACDE calls.

### 2.2 Glamsterdam (late 2026, SFI): growth gets *metered*, not fixed

SFI'd Glamsterdam items that matter to us:

- **EIP-8037 (state creation gas cost increase) — SFI.** Adds a state-growth dimension to gas metering. Benchmarked targets: **new account ~7x, new storage slot ~5x, contract deployment ~8x** cost increases; design target **~120 GB/year worst-case state growth at a 150M gas limit** (Glamsterdam Repricings #7, 2026-05-13). A multidimensional block divides execution vs. state-growth budget.
- **EIP-8038 (state-access gas cost update) — SFI.** Reprices cold state access.
- **EIP-7928 (Block-Level Access Lists) — SFI, headliner** (see §1.3).
- **EIP-7732 (ePBS) — SFI, headliner**, plus EIP-7688 (forward-compatible SSZ), EIP-7708 (ETH transfers emit logs — materially reduces our reliance on tracing for ETH-movement analytics), EIP-7975 (partial block receipt lists, Networking stage), EIP-7976 (calldata floor), EIP-8246, EIP-8061.
- **Gas-limit trajectory:** 200M "confirmed safe" for Glamsterdam (ACDE #243, 2026-08-13); devnets already ran at 150–190M. Higher throughput partially offsets the 8037 repricing — plan for state growth **at or above** ~120 GB/yr, not below it.

**What Glamsterdam does *not* do:** shrink state, expire state, change the MPT, or ease archive sync. It slows the derivative at the margin via pricing.

### 2.3 Hegotá (mid-2027, Planning): state relief candidates exist — and keep getting declined

- **EIP-8188 (last-written block timestamps for accounts/slots)** — the storage-tiering/state-expiry precursor — was **Proposed in May 2026 and DFI'd for Hegotá on 2026-09-10** (ACDE #245). No state-expiry EIP of any kind remains under consideration for Hegotá.
- **EIP-8032 (size-based storage gas pricing) — DFI'd for Glamsterdam** (Jan 2026). **EIP-8372 (normalized state gas limit) — Proposed** (ACDE #243). **EIP-8383 (CL block retention window cut to ~1 month) — PFI**. **EIP-8304 (trustless log/transaction index with proofs) — Proposed**, demoed with strong results; would change how historical queries are served if included (ACDE #244).
- **EIP-8025 (optional execution proofs, "zkEVM") — Proposed for Hegotá.** Opt-in only, no consensus gating; Lighthouse and Prysm implementations exist; the EF's Hegotá tier list rates it "A-ish" (L1-zkEVM #8, 2026-09-09). This is the current vehicle for stateless/ZK verification (see §2.4) — promising, **not scheduled**.

### 2.4 Not coming in our window (do not put these in the budget)

- **Verkle trees (EIP-6800, plus EIP-4762 stateless gas): No fork relationship; spec status Stagnant.** Zero mentions across the last ~250 protocol-call summaries (through Sep 2026). The statelessness track has been re-aimed at **STARK/ZK execution proofs** (EIP-8025 + execution-witness standardization in the L1-zkEVM breakout), which is promising — a 72-hour unattended mainnet proving run on 16×RTX 5090s proved 99.4% of blocks inside the 12-second slot (L1-zkEVM #8) — but this is tooling/research today, **opt-in, and no fork relationship**. It could eventually let us serve/verify without full state; it does nothing for archive storage in this window.
- **State expiry: no EIP exists.** The last precursor (EIP-8188) was declined. Any re-structuring of state (Verkle, binary Merkle trees, expiry) is a 2028+ question *at the earliest*, and would itself require a long transition (note: EIP-6873 preimage retention, a Verge-transition enabler, was **DFI'd for Glamsterdam** in Oct 2025).
- **EIP-8237 (independent CL/EL sync) was DFI'd for Hegotá** (Sep 2026) — no sync-time relief there either.

---

## 3. Net effect on our numbers (the part finance should price)

- **Baseline disk trajectory:** our class of operator (full + history) is already at **1.5–1.8 TB on 2 TB disks** — client teams themselves called this "near capacity" and said launching Glamsterdam *without* history pruning would exhaust 2 TB nodes (ACDE #243/#244, Aug 2026).
- **State:** add ~**120 GB/yr worst case** at 150M gas; the Glamsterdam trajectory is 150–200M, so use 120–160 GB/yr as the planning band, and re-estimate after EIP-8037's multidimensional blocks settle in production.
- **History:** continues to grow for us regardless of network defaults, because we are the archive tier. Default-retention divergence across clients (Nethermind ~6 months, Erigon ~1 year, Geth fork-minus-100K blocks, Besu ~5 months, pre-alignment) is being standardized at ~5 months — EIP-8383 (PFI, Hegotá) may cut the *default* to ~1 month, which does not bind us but will shrink the pool of peers serving history, raising our sourcing costs for backfills.
- **New Glamsterdam objects:** BAL data (~10 GB per ~15.7-day window today; Geth currently retains *all* BALs pending alignment — watch the Sep/Oct 2026 ACDE decisions) and partial-receipt/BAL JSON-RPC surface changes that touch our API layer.
- **Sync times:** no scheduled relief. Archive sync remains execution-bound and grows with history; EIP-8025-style stateless verification might eventually help *serving*, but it is opt-in research for now.

**Scenario framing for the 18–24 month budget:**

| Scenario | Assumption | Disk impact vs. today |
|---|---|---|
| Base | Glamsterdam ~Dec 2026 at 150–200M gas; no Hegotá state relief (current expectation) | State +120–160 GB/yr; history growth continues; plan archive fleet for +2–4 TB/yr gross per full-history node |
| Optimistic | 8037 metering bites hard; app behavior shifts off L1 state creation | Modest reduction in state derivative; no structural change |
| Adverse | Gas limit toward 200M+ quickly; blob throughput keeps climbing via BPOs | State/history derivatives at top of band; BAL + blobs add |
| "Relief" (do not budget) | Verkle/state expiry/ZK serving lands in window | No fork relationship, DFI'd, or research-only — excluded |

---

## 4. What we should do in the meantime

1. **Budget for trajectory, not hope.** Buy and provision for the Base/Adverse band. Nothing structural is scheduled before ~2028 at the earliest; treating "Ethereum will fix state" as a line item is how we end up re-quoting hardware mid-year.
2. **Split the fleet into serving tier vs. archive tier, with explicit retention configs.**
   - Serving tier (RPC for recent data): default ~5-month retention, smaller disks, snap-sync, cheap to rebuild.
   - Archive tier: pin archive/history flags explicitly per client (e.g., Geth full-history/`--history.mode=archive`-class settings and equivalents in Nethermind/Besu/Reth/Erigon), and *test* that upgrades don't silently inherit new pruning defaults. Every client release notes from here on must be checked for retention changes — defaults are actively moving (EIP-4444 doc update to 33,000 epochs; EIP-8383 to 8,192 epochs is PFI).
3. **Pre-Glamsterdam upgrade work (Q4 2026):** client upgrades for the fork; new BAL storage and JSON-RPC surface (BAL getters, partial receipts EIP-7975); re-test `eth_estimateGas`/access-list behavior (RPC-interop work flagged as critical post-Glamsterdam, ACDT #93); indexer changes for EIP-7708 (ETH-transfer logs change our tracing-vs-logs strategy). Watch the Sepolia Oct 6 / Hoodi Oct 27 forks as dress rehearsals.
4. **Archive sync capacity:** archive syncs only get slower in this window. Maintain warm spares and snapshot-based provisioning rather than cold archive syncs; schedule any planned archive-node rebuilds *before* Glamsterdam's higher-throughput regime starts.
5. **Track, with named owners:**
   - Glamsterdam mainnet date (forkcast + ACD calls, expected Sep–Nov 2026).
   - BAL retention alignment decisions on ACDE (Oct 2026) — directly changes our disk math, especially on Geth.
   - Hegotá non-headliner scoping (ACDE calls Sep 10 – Oct 22, 2026): EIP-8304 (trustless log index — would change our product economics), EIP-8383, EIP-8372, EIP-8025.
   - Execution-witness standardization (`debug_executionWitness`, `engine_newPayloadWithWitness`) — early signal for stateless/ZK serving, which is the only credible long-term cost reducer for a data company.
6. **Public position:** where we serve historical data to customers, keep selling it — we are becoming *more* of a scarce resource as default retention shrinks network-wide. Price archive-grade data accordingly.

---

## 5. Sources checked (all current as of 2026-09-23)

- forkcast.org — upgrade statuses, EIP fork relationships, stage history, projected activations (explicitly *estimates*, not announcements): Glamsterdam, Hegotá, EIP records for 4444, 6800, 4762, 6873, 7642, 7732, 7928, 7935, 8025, 8032, 8037, 8038, 8141, 8188, 8372, 8383, 8304.
- ACDE #226–#245, ACDT #92/#93/#97, ACDC #178/#185/#187, BAL breakout #9, Glamsterdam Repricings #7, L1-zkEVM #8 (via forkcast call artifacts, Aug–Sep 2026).
- EIP texts: eips.ethereum.org (4444, 6800, 8037, 8038, 7928, 8188, 8025).
- Meta-EIPs: EIP-7773 (Glamsterdam), EIP-8081 (Hegotá).

**Bottom line:** plan on Ethereum not fixing state growth inside our window. Glamsterdam (late 2026) meters the growth rate and adds new data objects; Hegotá (mid-2027) currently contains no structural state relief; everything structural is 2028+ research. The winning move is explicit archive-tier engineering plus disk budgeted on the observed ~120 GB/yr+ trajectory.
