# Ethereum State Growth: Technical Brief for Infrastructure & Capacity Planning

**Date:** 2026-09-23
**Audience:** Infrastructure team, finance
**Scope:** Mainnet full + archive node fleet, 18–24 month planning window (through ~Q3 2028)

---

## 1. Executive summary

- **State growth is a protocol-level property, not a bug.** Ethereum's state (accounts, contract code, storage slots) is committed in a Merkle Patricia Trie and persists forever by design. As of January 2026 the state alone is ~390 GiB (Geth path-based) and is growing at ~326 MiB/day (~116 GiB/year) after the block gas limit rose from 30M to 60M in late 2025. Growth accelerates every time the gas limit rises.
- **The single biggest cost lever is already available and is client-side, not protocol-side.** Modern execution clients (Erigon 3, Reth, Geth v1.16+ path-based archive) store full archive history in **~2 TB**, versus **15–22 TB** for legacy Geth hash-based archive nodes. If we still run any hash-based archive nodes, migrating them is worth more than anything the protocol will deliver in the next 24 months.
- **One credible protocol change lands inside our window: state-creation repricing (EIP-8037/8038) in the Glamsterdam fork, targeting Q4 2026.** It raises the gas cost of creating new state ~5–8× and is explicitly designed to cap state growth at ~120 GiB/year even as the gas limit scales toward 200M. It slows growth; it does not shrink or stop it.
- **Do not budget for statelessness, Verkle/binary-tree migration, or state expiry inside this window.** Verkle has effectively been superseded by a binary-tree design (EIP-8297, June 2026) that is in early client implementation with no fork scheduled. State expiry has no scheduled EIP at all. Treat these as 2028+ upside, not plan.
- **Planning posture:** size for **120–160 GiB/year state growth** as the base case, with a **~390 GiB/year downside case** if repricing slips but gas limits rise anyway. Both cases cross the ~650 GiB "bloatnet" performance-degradation threshold inside our window — that threshold, not raw disk capacity, is what should drive our hardware refresh and sync-time budget.

---

## 2. What is actually driving this at the protocol level

### 2.1 State vs. history vs. archive — three different datasets

| Dataset | What it is | Size today (mainnet) | Who needs it |
|---|---|---|---|
| **State** | Current accounts, balances, contract code, storage slots | ~390 GiB (Jan 2026, Geth) | Every validating/executing node |
| **History** | Blocks, transactions, receipts from genesis | ~1+ TB (pre-merge alone is 300–500 GB) | Full nodes (partially prunable since 2025) |
| **Archive state** | The complete state *at every historical block* | ~2 TB (Erigon/Reth/Geth path-based) to 15–22 TB (Geth legacy hash-based) | Archive nodes only — i.e., us |

Key facts that follow from the protocol design:

1. **State is monotonic.** Every new account, contract, or storage slot is added to the state trie and never removed. There is no deletion mechanism in the protocol today (EIP-6780 neutered `SELFDESTRUCT` in 2024). State only shrinks its *growth rate* via pricing; the total never goes down.
2. **State lives on the consensus-critical path.** Every block's header commits to a state root of the hexary Merkle Patricia Trie (MPT). Validators must read and update this trie to verify blocks, so state size directly determines validator I/O, memory, and sync requirements — which is why the core devs care, and why repricing is happening.
3. **State growth is superlinear in the gas limit.** Measured data: at a 30M gas limit, ~105 MiB of new state per day; after the rise to 60M (Dec 2025), ~326 MiB/day — a 2× limit increase produced a ~3× growth increase. Left unpriced, a 200M gas limit implies ~387 GiB/year of new state.
4. **Archive nodes amplify the problem by choice of representation.** The historical-state dataset is inherently large, but *how* large depends entirely on the client's storage engine:
   - **Legacy Geth hash-based archive** stores every historical trie node per block: 15–22 TB, growing ~5 GB/day, months-long genesis sync.
   - **Erigon 3 / Reth** use flat-state + deduplicated/segmented history: ~1.8–2.2 TB, 1–2 week sync.
   - **Geth v1.16+ path-based archive** (released mid-2025) stores one persisted state plus per-block reverse diffs: ~2 TB, ~2 week sync, and historical state can sit on HDD. Caveat: **no historical `eth_getProof`** in this mode.
5. **Full nodes prune; archive nodes are the safety net.** Full nodes keep only ~128 recent blocks of state. The network assumes specialized operators (us) retain deep history — which is also why the protocol is comfortable letting regular nodes prune history (see §3).

### 2.2 Why it's getting worse on our exact planning horizon

- Core devs have agreed on a **200M gas-limit floor after Glamsterdam** (from 60M today), enabled by ePBS (EIP-7732) and Block-Level Access Lists (EIP-7928). More block space = more state creation unless it is priced.
- The **bloatnet initiative** measured a critical threshold at **~650 GiB state size**: beyond it, state-access operations get ~40% slower, memory consumption rises sharply, and sync times lengthen. Jan 2026 state is ~390 GiB. At current ~116 GiB/year we cross 650 GiB around **mid-2028** even in the best case; in the unpriced 200M case we cross it **during 2027**.
- Consequence for us: even when disk *capacity* is cheap, **state size drives sync time, IOPS requirements, and RAM/cache sizing** for every node we run, and it sets the floor under every archive node's database.

---

## 3. What is coming to Ethereum itself — and how much to bank on it

Confidence ratings reflect what is reasonable to put in a budget, not what is technically possible.

### 3.1 Already shipped — bank on these (they're free)

| Change | Status | Effect on us |
|---|---|---|
| **Client storage re-architecture** (Erigon 3 "Caplin", Reth, Geth v1.16 path-based state + path-based archive) | **Shipped 2025** | Archive node: 15–22 TB → **~2 TB**. Full node: ~650 GB steady state. The dominant TCO reduction available, with zero protocol risk. |
| **EIP-4444 partial history expiry** ("drop day" May 2025; all major clients by July 2025) | **Shipped** | Full nodes can drop pre-merge blocks/receipts: **300–500 GB saved per full node**. One-way door for that data; historical blocks remain available via torrents/Era1 files/institutional mirrors. Does not touch state. |

### 3.2 Likely inside the window — plan around it, but don't pre-spend the savings

| Change | Status (Sept 2026) | Expected timing | Effect on us | Confidence |
|---|---|---|---|---|
| **Glamsterdam hard fork**, incl. **EIP-8037** (state-creation gas cost increase) and **EIP-8038** (state-access cost update) | Final devnet stage reached June 2026; scope frozen; EF published developer testing guidance Aug 2026 | **Target Q4 2026** (mainnet Sept–Dec 2026 on typical testnet cadence); slippage to H1 2027 plausible | Caps state growth at a **target of ~120 GiB/year** (worst case ~160 GiB/yr at a 200M limit) by pricing state creation at CPSB = 1,530 gas/byte: new account 25k→183.6k gas (~7×), new storage slot 20k→97.9k gas (~5×), contract deployment ~8×. **Slows our growth curve; does not reduce existing state.** | **High** that it ships within ~9 months; **medium** on exact parameters (CPSB has already been revised once, 1174→1530) |
| **Full rolling history expiry** (EIP-4444 proper) | Partial version shipped; rolling version "ongoing", discussed for a 2026 hard fork | 2026–2027 | Bounds *history* (not state) on full nodes to a ~1-year rolling window. Marginal for us — we're the ones expected to *keep* history. | Medium |
| Post-Glamsterdam **gas-limit ramp toward 200M** | Agreed direction; validator-signaled, not fork-enforced | 2027 | The reason repricing exists. Net effect with EIP-8037: growth stays near the 120–160 GiB/yr corridor instead of ~390 GiB/yr. | High (direction), medium (pace) |

### 3.3 Aspirational within 24 months — do NOT budget against these

| Change | Status (Sept 2026) | Honest timing | Why not to bank on it |
|---|---|---|---|
| **Verkle trees (EIP-6800)** | **Effectively abandoned.** The stateless-consensus track has converged on binary trees instead: Verkle's elliptic-curve commitments are not quantum-safe and SNARK proving over binary Merkle trees has improved enough to make a direct jump attractive. Never scheduled into any fork. | n/a | Superseded; any literature promising "Verkle in the next fork" is stale. |
| **Binary state tree migration (EIP-8297 "Partitioned Binary Tree", migration via EIP-8347)** | EIP published June 2026 (authors include Buterin, Dankrad, Ballet); implementation underway in Geth and Besu; hash function (BLAKE3 vs Poseidon2) still undecided | **2028+ at best**; candidate headliner for the fork after Glamsterdam ("Hegotá"), which has no date | No devnet, no scheduled fork, open cryptography decisions, and the state-migration procedure itself is the hardest part. When it lands it enables **stateless validation** — but note: statelessness reduces *validator* storage requirements; it does not delete state, and archive operators still store everything. |
| **State expiry** (moving inactive state out of the active set) | Design sketches only (per-epoch trees, zone-based expiry in EIP-8297's rationale). No scheduled EIP. Explicitly dependent on the tree migration. | **2029+**, if ever in current form | Would be the only change that actually *shrinks* active state. Years from consensus, let alone mainnet. |
| **Portal Network** (decentralized serving of expired history/state) | History network live but "not yet fully production-ready"; state network further out | Ongoing | Relevant long-term for how *we* serve historical data, not a near-term cost reducer. |

**Bottom line for §3:** inside 18–24 months, the protocol gives us exactly one material relief — **slower growth via Glamsterdam repricing**. Everything that would fundamentally change the storage model (tree migration, statelessness, expiry) is outside the window.

---

## 4. Planning scenarios for the next 18–24 months

State-size trajectory (Geth-equivalent state DB; starting point ~390 GiB Jan 2026, ~430–450 GiB expected end of 2026):

| Scenario | Assumption | State growth | State size mid-2028 | Crosses 650 GiB threshold |
|---|---|---|---|---|
| **Base** | Glamsterdam ships Q4 2026–H1 2027 with EIP-8037 at ~CPSB 1530; gas limit ramps toward 200M | ~120–160 GiB/yr | ~640–700 GiB | Right at the edge of the window |
| **Downside** | Repricing slips a fork or is watered down; gas limit rises anyway | ~250–390 GiB/yr | ~800 GiB–1 TiB+ | **During 2027** |
| **Upside** | Repricing ships on time *and* proves more suppressive than target (elasticity is uncertain — empirical estimates of state-creation elasticity are only ε≈0.3–0.6) | ~80–120 GiB/yr | ~570–620 GiB | Just outside window |

Translate into fleet-level numbers (per node, mainnet):

| Node type | Today | Budget for 24 months out | Notes |
|---|---|---|---|
| Full node (any modern client, post-EIP-4444 prune) | ~650 GB–1.2 TB | **2 TB NVMe** comfortable | Prune schedule if on 1 TB disks |
| Archive node — Erigon 3 / Reth / Geth path-based | ~1.8–2.2 TB | **4 TB NVMe minimum; 8 TB class if we want a maintenance-free 24-month lifecycle** | Growth is state history + chain history; expect roughly +0.5–1 TB/yr |
| Archive node — legacy Geth hash-based | 15–22 TB, +~1.8 TB/yr | **Decommission** (see §5) | Sync-from-scratch alone is 3–6 weeks and months if genesis-validating |

---

## 5. What we should do in the meantime

### Now (Q4 2026)

1. **Migrate all archive nodes to Erigon 3, Reth, or Geth path-based archive.** This is the single highest-value action in this brief: ~10× disk reduction, sync in 1–2 weeks instead of months, no dependence on any future fork. Standardize on one primary client plus one fallback for client-diversity/resilience.
2. **Audit whether anything we serve needs historical `eth_getProof`.** Geth path-based archive and Erigon-style layouts do not serve historical Merkle proofs the way hash-based archive does. If a compliance or ZK workflow needs them, retain *one* hash-based archive (or a hash-based segment over the audited range) and decommission the rest.
3. **Enable pre-merge history pruning (EIP-4444) on all full nodes** — 300–500 GB each, effectively free. Archive nodes keep full history by definition.
4. **Re-baseline capacity planning on the numbers in §4**, replacing any plan that extrapolates legacy hash-based archive growth.

### Before Glamsterdam activates (target Q4 2026)

5. **Schedule the client upgrades** for Glamsterdam across the fleet (both EL and CL — ePBS changes block building/attestation). Treat as a high-priority release.
6. **Update gas-estimation tooling for EIP-8037/8038.** `eth_estimateGas` semantics change (separate state-gas dimension, reservoir model); cached gas constants will underestimate and cause failed transactions. The EF has explicitly warned infra operators about this. If we serve RPC or gas estimates to customers, test against the public testnets before mainnet.
7. **Expect a one-time step-up in state-creation costs for our own on-chain operations** (~5–8× on contract deployments, new accounts, new slots).

### Ongoing / hedges

8. **Track the 650 GiB state threshold as an operational trigger**, not just disk capacity: as state approaches it, budget for higher IOPS NVMe, more RAM (cache hit rate dominates latency), and longer sync windows. In the downside scenario this arrives in 2027.
9. **Keep 24-month procurement on the downside scenario** (8 TB-class archive disks). Disk is cheap; emergency re-provisioning during a gas-limit ramp is not.
10. **Do not defer hardware purchases in anticipation of statelessness or state expiry.** If the binary-tree migration lands in 2028+, it improves sync and validator economics; it does not reduce what an archive node must store. Our archive role is durable — arguably it becomes *more* entrenched as regular nodes prune and expire data.

### What to monitor (assign an owner)

- **Forkcast / ACD calls** — Glamsterdam mainnet date and any EIP-8037 parameter changes (CPSB).
- **Hegotá scoping** — whether the binary-tree migration (EIP-8297/8347) gets scheduled; that is the first event that changes our long-term model.
- **ethresear.ch state-growth/elasticity reports** — post-Glamsterdam empirical growth rate vs. the 120 GiB/yr target; recalibrate our base case ~3 months after the fork.
- **bloatnet measurements** — updated thresholds for state-access degradation as state grows.

---

## 6. Key sources

- EIP-8037 (State Creation Gas Cost Increase) — eips.ethereum.org/EIPS/eip-8037 (parameters, 120 GiB/yr target, Jan 2026 baseline: ~390 GiB state, ~326 MiB/day)
- EIP-8007 / EIP-7773 (Glamsterdam repricing meta / fork meta) — eips.ethereum.org
- ethereum.org/roadmap/glamsterdam — Q4 2026 target, ePBS headliner, 200M gas-limit path
- "State growth scenarios and the impact of repricings" — ethresear.ch/t/23476 (Nov 2025; 650 GiB bloatnet threshold, gas-limit scenarios)
- "Partial history expiry" — blog.ethereum.org/2025/07/08/partial-history-exp (EIP-4444 rollout, 300–500 GB savings)
- Geth path-based archive — geth.ethereum.org/docs/fundamentals/archive (~2 TB archive, v1.16+)
- EIP-8297 (Partitioned Binary Tree) + Stateless Consensus project page — stateless.ethereum.foundation/projects (binary tree superseding Verkle; implementation in Geth/Besu)
- "Glamsterdam Repricing Impact for Smart Contract Developers" — blog.ethereum.org/2026/08/24/glamsterdam-repricing-testing (gas-estimation breaking changes)
- The Defiant, "Glamsterdam Enters Final Devnet" (June 2026) — devnet status, mainnet timing cadence
