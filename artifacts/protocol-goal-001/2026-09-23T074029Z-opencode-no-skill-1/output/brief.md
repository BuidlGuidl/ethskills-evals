# Ethereum State Growth: Technical Brief for Capacity Planning

**Prepared:** September 23, 2026
**Planning window:** Q4 2026 – mid-2028 (18–24 months)
**Audience:** Infrastructure engineering + finance
**Scope:** Ethereum mainnet full and archive node fleet; protocol-level state growth, what relief is realistically coming, and what we should do meanwhile.

---

## 0. Executive summary

1. **Our archive disk pain is mostly a client-architecture problem, not a protocol problem — and it is already solved at the client level.** Legacy hash-based Geth archives run 12–22 TB and grow ~5 GB/day. Every major client has shipped (Geth v1.16, Jan 2026; Reth 2.0, Aug 2026; Nethermind 2.0, Sept 2026) or long-had (Erigon) a flat/path-based archive layout that holds the **same data in ~2.0–3.0 TB**. Migrating the archive fleet is the single biggest lever available and requires no protocol change.

2. **The live state is ~390–450 GiB (Jan 2026 measurement: ~390 GiB) and currently grows ~116 GiB/year** at the post-Fusaka 60M gas limit. Left alone at the planned 200M gas limit, modeled growth is ~387 GiB/year, which would breach the community-identified ~650 GiB performance-degradation threshold within a year. **Glamsterdam (targeted Dec 2026, unconfirmed) fixes this by design**: EIP-8037/8038 reprice state creation and access to target a bounded ~120 GiB/year even as the gas limit ramps toward 200M. Bank on the reprice landing inside the window; do not bank on the exact December date.

3. **Nothing in the next fork (Hegotá) or the two after it relieves state growth.** The roadmap from 2027 through ~2029 is dominated by post-quantum readiness. The state-architecture work (new binary trie, state expiry, ZK statelessness — Verkle was dropped as the path in 2025–26) begins design at the earliest in the fork after next (~2028 under current cadences), with migration after that. **No protocol-level state-size relief should be budgeted inside this window.**

4. **History (blocks/receipts), not state, will dominate our archive growth in the window.** The Glamsterdam gas ramp multiplies transaction/receipt throughput ~3–5x, and EIP-7708 makes every ETH transfer emit a log. Expect archive history growth to accelerate from roughly ~0.3–0.5 TB/yr today to **~1–1.5 TB/yr after Glamsterdam**, while state growth stays bounded.

5. **Rolling history expiry (full EIP-4444) is in progress with no committed date.** It changes *retrieval economics* (fewer peers serve old blocks), not our retention duty — and it makes a professionally operated history archive *more* valuable, not less.

**Budget bottom line:** plan archive nodes at **6–8 TB NVMe each** for the window (new-gen clients, ~2.3 TB today, ~4–5 TB projected by end-2028); full nodes stay comfortable on **2 TB** (4 TB for RPC-serving nodes); add a **~1–2 TB cold (HDD/object) era/era1 mirror**. Decommission legacy hash-based archives — they are a stranded 12–22 TB-per-node cost with a 3–6 week resync penalty.

---

## 1. What is actually driving growth at the protocol level

### 1.1 Three distinct data classes — know which one is biting

A node's disk holds three categories with completely different growth mechanics. Conflating them is the most common planning error.

| Class | What it is | Grows with | Full node keeps | Archive keeps |
|---|---|---|---|---|
| **Live state** | Accounts, contract storage slots, contract code (the Merkle Patricia Trie) | Net new accounts/slots/code written; never expires at protocol level | Yes (last ~128 blocks of history) | Yes |
| **Chain history** | Headers, block bodies (transactions), receipts, blob sidecars (CL side) | Throughput × time | All of it today (rolling expiry pending) | All of it |
| **Historical state** | The trie *at every block* (every intermediate state ever) | Every state-touching block | No (discarded, recomputable) | Yes — this is what makes an archive an archive |

The 10× gap between full and archive nodes is almost entirely Class 3. Class 1 is the one the protocol community worries about for decentralization; Classes 2 and 3 are the ones that dominate our archive bill.

### 1.2 Why each class grows

**Live state.** Every new account, storage slot, and deployed contract is a permanent write; nothing in the current protocol ever expires it. Growth is a function of state-creating operations, which scale with gas throughput. Measured on Geth: at 30M gas, ~105 MiB of new state per day; at 60M (post-Fusaka default), ~326 MiB/day (~116 GiB/yr). Note the 2x gas bump produced a ~3x state bump — a one-off behavioral shift, not a stable ratio. Composition: ~82% contract storage, ~14% accounts, ~4% code. Size trajectory: ~245 GiB (early 2024) → ~340 GiB (May 2025) → ~390 GiB (Jan 2026). The **bloatnet** initiative identified **~650 GiB** as a critical threshold: beyond it, state-access times degrade ~40%, memory pressure and sync times rise nonlinearly. At current rates we cross it around 2028; at 200M gas *without* repricing, within a year of the ramp.

**Chain history.** Blocks, transactions, and receipts accumulate monotonically with usage. Blob data (for rollups) lives on the consensus side; it is the fastest-growing segment (blob target went 3/6 at Dencun → 6/9 at Pectra → 10/15 BPO1 (Dec 2025) → 14/21 BPO2 (Jan 2026), with BPO3 configured at 21/32) but is bounded per node by the ~18-day blob retention window, so it plateaus rather than accumulates — roughly ~0.4–0.6 TB steady-state at BPO3 parameters by our estimate, plus ordinary beacon data.

**Historical state.** A hash-based archive stores every trie node at every block — massive duplication. This is the legacy design that produced 12–22 TB nodes. The new flat/path-based designs store one current state plus key-value diffs per block, collapsing the same information to ~2 TB. This is a client data-model change, already shipped — it is not waiting on any fork.

### 1.3 Where we are today (Sept 2026, mainnet)

| Metric | Value |
|---|---|
| Block gas limit | 60M (EIP-7935, standardized at Fusaka) |
| Live state (Geth-measured) | ~390 GiB (Jan 2026); ~116 GiB/yr growth at 60M |
| Full node, new-gen client (EL) | ~0.65–1.1 TB (Geth post-prune ~650–700 GB; Reth V2 ~1.02 TB) |
| Archive node, new-gen client | ~2.0–3.0 TB (see §3) |
| Archive node, legacy Geth hash | ~12–22 TB, ~5 GB/day, 3–6 week sync |
| CL data | ~0.6–1 TB incl. blob sidecars at BPO2–BPO3 params |
| Latest fork | Fusaka (Dec 3, 2025): PeerDAS, BPOs, 60M gas default |

---

## 2. What's coming, ranked by what we can bank on

### Tier 1 — Shipped. Bank it now.

- **Partial history expiry (live since July 8, 2025).** All execution clients can prune pre-Merge block bodies and receipts per EIP-4444 phase 1: **300–500 GB reclaimed per full node**, one-shot or online depending on client. Pre-Merge history is rehydratable from `era1` files if ever needed.
- **New-generation archive clients.** Geth v1.16 path-based archive (~1.9–2.2 TB, ~2-week sync, configurable retention, state history can sit on HDD); Nethermind 2.0 flat archive (full ~2.1 TB DB / 2.3 TB total at block 25.88M, plus windowed and per-address retention modes); Reth 2.0 with static files (archive 2.31 TB V2; can flip a node between full and archive by mounting static files); Erigon (~1.8 TB per docs; note one production measurement in May 2026 showed ~6 TB on an operator's node — size is version/config-sensitive, so measure before buying).
- **Fusaka (Dec 3, 2025).** PeerDAS + BPO forks: relieves *blob* distribution pressure and enables staged blob growth. Net effect on us: CL blob storage grows with the blob schedule but stays plateau-shaped (retention window), not cumulative.

### Tier 2 — Near-certain inside the window: **Glamsterdam**

**Status as of Sept 23, 2026:** Sepolia activation confirmed for **Oct 6, 2026**; Hoodi tentatively Oct 27; **mainnet December 2026 is a target, not a committed date** — no mainnet epoch/timestamp is published, client implementations are not yet considered mainnet-ready, and Devnet-9 hit finality problems before the pivot to Devnet-11. Prudent planning assumption: **mainnet Q4 2026–Q1 2027**. Treat a slip to Q1 2027 as routine, not exceptional.

This fork matters more to our storage forecast than anything else on the horizon:

- **EIP-8037 (state creation repricing) + EIP-8038 (state access repricing).** Raises the cost of creating accounts, contracts, and storage (cost-per-state-byte `CPSB = 1,530` gas, metered in a separate state-gas dimension; e.g. new storage slot 20,000 → 97,920 state gas; new account 25,000 → 183,600). Explicit target: **~120 GiB/yr state growth at a 150M reference gas limit**; worst-case at 200M is ~160 GiB/yr — versus ~387 GiB/yr unpriced. This is the protocol-level answer to state growth in our window, and it is designed to *hold while throughput scales*, not to shrink anything.
- **EIP-8261 (gas limit schedule)** ramps the block gas limit toward the agreed **200M floor** (community discussion extends toward 300M over time), unlocked by:
- **EIP-7732 (ePBS)** — extends payload propagation from ~2s to ~9s, making bigger blocks viable; **EIP-7928 (Block-Level Access Lists)** — makes big blocks parallelizable.
- Items that nudge storage the other way, worth tracking: **EIP-7708** (ETH transfers emit a log → receipt/log growth accelerates even beyond the throughput multiple), **EIP-7954** (larger max contract size) and **EIP-8246** (SELFDESTRUCT burn removal) — both priced by 8037 but mildly state-growth-positive; **EIP-7976/7981** (calldata floor 10/40 → 64/64, access-list byte charges) — bound block size growth, i.e., they *help* Class 2.

**Effect on our forecast:** state growth bounded (~120–160 GiB/yr worst case); history growth multiplied ~3–5x. The disk story in the window is a *history* story.

### Tier 3 — In progress, no committed date: rolling history expiry (full EIP-4444)

Clients are agreed on the end state (rolling ~1-year window for serving/pruning bodies and receipts; pre-Merge headers eventually droppable), but as of Sept 2026 **no activation date exists**. Expect client-by-client rollouts during 2026–2027 rather than a single event. Retrieval moves to era/era1 files, torrents, EIP-7801 devp2p, and the Portal Network.

**What it means for us:** nothing changes about what we must retain (we serve historical data as a product), but P2P availability of old blocks will thin out. Our archive fleet becomes scarcer infrastructure — the EF explicitly tells the ecosystem to rely on dedicated history providers. Also: full-sync-from-genesis via devp2p is already no longer guaranteed (since 2025); archive bootstrap now runs through snapshots/era files. Our resync runbooks should assume era-based bootstrap.

### Tier 4 — Outside the window. Aspirational. Do not budget against it.

- **Hegotá (next fork after Glamsterdam).** Implementation begins late Q4 2026; realistic mainnet 2027. Headliners are **FOCIL (EIP-7805) + Frame transactions (EIP-8141)**. **It contains no state-growth relief.** (Some secondary press has claimed Verkle/state-expiry content in Hegotá; the EF's own Sept 7, 2026 priorities post does not include it. Plan on the primary source.)
- **The state arc (new trie → state expiry → statelessness).** The current path is a **binary tree proven with STARKs**, not Verkle — Verkle was effectively dropped in 2025, and in Aug 2026 the EF dropped Poseidon in favor of standard hashes (SHA-2/BLAKE family) inside the proving layer. Real engineering exists (a full mainnet hexary→Partitioned-Binary-Tree conversion spec, EIP-8347, has been benchmarked end-to-end: ~4.5 days on a single 8-core/128 GB machine, with the caveat that binary commitment data ran ~1.5x the hexary commitment size). But per the EF's Sept 2026 roadmap, **design and migration work is expected to begin in the fork *after next* ("I*")** — at the published 7.2–12-month fork cadences, that is **2028 at the earliest**, with migration stretching beyond. State expiry, when it eventually comes, is modeled to cut live state dramatically (a Jan 2026 experiment keeping only 1 year of touched state cut state 77.5% and sped execution ~15%) — and it would make *our* archive services more necessary, since protocol nodes stop serving old state.
- **Post-quantum occupies the roadmap through Dec 2029** (MV-PQ milestone), which is why state work keeps sliding. Vitalik's July 2026 "Lean Ethereum" framing — total capacity >100 TB by 2030 via new state types — is a long-horizon direction, not capacity we will store per-node in this window.

**Bankability verdict:** inside 18–24 months, the only protocol changes that materially move our disk numbers are (a) Glamsterdam's repricing bounding state growth, and (b) the Glamsterdam gas ramp *increasing* history growth. Everything else is either already shipped (client-side) or post-window.

---

## 3. Capacity planning numbers

Assumptions: Glamsterdam mainnet by Q1 2027 (worst case in-window); gas ramp to 200M over 2027 per EIP-8261; new-gen clients everywhere; no protocol state expiry in window.

### 3.1 Per-node projections

| Node class | Today (Sept 2026) | Growth driver | Rate now → post-Glamsterdam | ~End-2028 | Provision for window |
|---|---|---|---|---|---|
| Full node (EL+CL) | ~1.0–1.5 TB total | state ~0.1 TB/yr; history ~0.2–0.4 TB/yr | history ×3–5 → ~1–1.5 TB/yr | ~2–3 TB | **2 TB NVMe min; 4 TB for RPC-serving nodes** |
| Archive node (new-gen) | ~2.0–3.0 TB | history-dominated | ~0.3–0.5 TB/yr → **~1–1.5 TB/yr** | **~4–5 TB** | **6–8 TB NVMe per node** |
| Archive node (legacy Geth hash) | 12–22 TB | ~5 GB/day | unchanged | 14–24 TB | **do not provision — migrate** |
| CL blob sidecars | ~0.5–1 TB | blob schedule (BPO3: 21/32) | plateau moves to ~0.6–1.2 TB | bounded | inside CL node budget above |
| Cold era/era1 mirror | ~1–2 TB (HDD/object) | post-Merge era growth | ~0.3–1 TB/yr | ~2–4 TB | cheap cold tier, not NVMe |

### 3.2 State-size scenarios (live state, drives full-node pressure)

| Scenario | State growth | Live state, mid-2028 |
|---|---|---|
| No Glamsterdam reprice, gas → 200M | ~387 GiB/yr (modeled) | **>650 GiB threshold breached ~2027** — degraded state access, longer syncs |
| Reprice ships (EIP-8037), gas → 200M | ~120–160 GiB/yr (target/worst-case) | ~650–700 GiB — near but managed |
| Reprice + further BPO-style repricings | ~80–120 GiB/yr | ~600 GiB |

The reprice is what keeps full-node (and our execution-tier) hardware boring through the window. If Glamsterdam slips materially or the reprice is descoped, revisit this table — the 650 GiB threshold is the trigger to watch in our own telemetry (state access latency, block-insert P99).

### 3.3 What we should stop paying for

- **Legacy hash-based archives**: 12–22 TB, weeks-long resyncs, and no client-team investment going forward. Each node migrated recovers ~10–19 TB of NVMe or converts to ~2–3 TB.
- **Unpruned pre-Merge bodies/receipts on full nodes**: reclaim 300–500 GB per node now.
- **Duplicate archive copies held "just in case"**: the cold era tier plus one new-gen archive replaces most of this at ~1/10th the cost.

---

## 4. Recommendations (in order)

1. **Migrate the archive fleet to new-gen clients this quarter.** This is the 6–10x disk reduction and a ~2-week (vs 3–6-week) resync. Candidate paths: Reth 2.0 static-file archive, Nethermind 2.0 flat archive (its windowed mode — ~2 months of state at ~0.9 TB — or per-address mode may cover most of our actual query load at half the cost), Geth v1.16 path archive, Erigon. **Caveat before cutover:** audit our products for deep-history `eth_getProof` usage — Geth's path archive does not serve historical proofs yet, Nethermind's is opt-in and only near-tip by default. If we need deep historical proofs, keep exactly one legacy or purpose-built proof node, or use per-address retention, rather than keeping the whole fleet legacy.

2. **Enable partial history expiry on all full nodes now**, and schedule quarterly prune windows (Geth offline prune needs headroom — start before ~80% disk full). Write the era1 rehydration runbook before we need it.

3. **Build the era/era1 cold mirror.** Full-history era files on HDD or object storage (~1–2 TB today, incremental after). This is our insurance policy as rolling 4444 thins P2P history availability — and positions us to *serve* history (an increasingly scarce, and therefore billable, service) as the EF's own guidance pushes the ecosystem toward dedicated history providers.

4. **Treat Glamsterdam as an operations project, not a calendar item.** Sepolia Oct 6 and Hoodi ~Oct 27 are our rehearsal windows. Upgrade plans for all EL+CL pairs; test that our gas-estimation and simulation tooling behaves under the 8037/8038 repricing (state-gas is a separate dimension — downstream tooling that assumes a single gas pool can misestimate); watch the EIP-8261 ramp after activation. Plan capacity for the *post-ramp* history growth rate, not today's.

5. **Set explicit re-planning triggers:** (a) Glamsterdam mainnet date confirmed or slipped past Q1 2027; (b) any 4444 rolling-window activation announcement; (c) Hegotá scope additions touching state (would contradict current EF guidance — verify against primary sources); (d) our own state-access P99 degrading (the practical bloatnet signal); (e) state-arc EIPs (PBT migration, state expiry) entering the fork-after-next scope — earliest ~2028.

6. **For finance:** the 18–24-month CAPEX story is *consolidation*, not expansion — archive fleet NVMe drops ~6–10x per node after migration even as the chain grows ~2x in history. The growth line item to defend is **archive history storage (~1–1.5 TB/yr per archive node post-Glamsterdam)** and the **cold mirror tier**. No protocol relief beyond the Glamsterdam reprice should appear in any budget line before ~2028.

---

## 5. Sources (primary unless noted)

- EF Protocol cluster, "Current and Emerging Priorities" (Sept 7, 2026) — fork cadences, Hegotá scope, state-arc timing: https://blog.ethereum.org/2026/09/07/protocol-priorities
- Glamsterdam roadmap page (Q4 2026 target, EIP-8037/8038/8261 details): https://ethereum.org/roadmap/glamsterdam/ · Meta-EIP: https://eips.ethereum.org/EIPS/eip-7773
- EIP-8037 (state creation costs, CPSB, 390 GiB / 116 GiB-yr measurements, worst-case table): https://eips.ethereum.org/EIPS/eip-8037 · EIP-8007 repricing directory: https://eips.ethereum.org/EIPS/eip-8007
- Fusaka mainnet announcement (Dec 3, 2025; BPO schedule): https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement
- Partial history expiry announcement (July 8, 2025): https://blog.ethereum.org/2025/07/08/partial-history-expiry · EIP-4444: https://eips.ethereum.org/EIPS/eip-4444 · EIP-7927 meta: https://eips.ethereum.org/EIPS/eip-7927
- Geth archive-mode docs (path-based archive sizes/sync/index): https://geth.ethereum.org/docs/fundamentals/archive
- Nethermind 2.0.0 release notes (flat archive measurements at block 25.88M, Sept 2026): https://github.com/NethermindEth/nethermind/releases
- Reth 2.0 / Storage V2 measurements: https://reth.rs/run/storage/ · https://www.paradigm.xyz/writing/releasing-reth-2-0
- State growth analysis: "State growth scenarios and the impact of repricings," ethresear.ch (Nov 19, 2025): https://ethresear.ch/t/state-growth-scenarios-and-the-impact-of-repricings/23476 · "What if we only kept 1 year of active state?" (Jan 30, 2026): https://ethresear.ch/t/what-if-we-only-kept-1-year-of-active-state/23980
- PBT migration benchmark (EIP-8347 discussion, July 2026): https://ethereum-magicians.org/t/eip-8347-offline-state-migration-to-the-pbt/29089
- Glamsterdam Sepolia scheduling and mainnet-status reporting (Sept 2026): CoinDesk, ForkLog, Unlock Blockchain coverage of ACD calls
- Poseidon/lean-Ethereum pivot: postquantum.com analysis (Aug 2026) and Justin Drake's announcement; Vitalik "Lean Ethereum" update (CoinDesk, July 6, 2026)
- Gas limit telemetry: https://gaslimit.pics (avg 60M, Sept 2026)