# Ethereum State Growth: Technical & Capacity Planning Brief

**Date:** 25 July 2026
**Planning window:** now through ~Q3 2028 (18–24 months)
**Audience:** infrastructure team + finance

---

## Executive summary (read this if you read nothing else)

1. **Ethereum's state growth problem is real and the protocol is finally acting on it — but the fixes that are landing inside our window are guardrails, not reductions.** Nothing scheduled will make our existing archive nodes smaller.

2. **Critically: almost every headline "state growth" item on the Ethereum roadmap — statelessness, binary trees, state expiry — relieves *validating full nodes*, not *archive nodes*.** An archive node's job is to retain exactly the data those proposals let other nodes discard. We are structurally excluded from most of the relief. Budget accordingly.

3. **The one in-window protocol change that matters to us is EIP-8037** (state-creation gas repricing), scheduled for inclusion in the Glamsterdam fork expected H2 2026. It caps state growth at ~120 GiB/year. That is *roughly today's rate* — so it prevents a 2–3x worsening; it does not improve our position.

4. **The bigger in-window story is a cost *increase*, not a decrease.** Glamsterdam is designed to enable raising the block gas limit from 60M toward 150–200M. More gas means more state, more history, more bandwidth, and longer syncs. EIP-8037 exists precisely to stop that from being catastrophic.

5. **Our largest available lever is client and fleet architecture, not the protocol.** The spread between a legacy Geth hash-mode archive node (~18–20 TB) and a modern Erigon 3 or path-based Geth archive node (~2 TB) is roughly an order of magnitude. That single decision dwarfs everything Ethereum will ship to us before 2028.

**Planning recommendation: model the next 24 months assuming zero protocol relief for archive storage, and assume a gas-limit-driven increase in per-year growth. Treat any relief as upside.**

---

## Part 1 — What actually drives this at the protocol level

### 1.1 The two things people conflate

Capacity conversations go wrong because "blockchain size" bundles two very different datasets with very different growth behaviour and very different roadmap treatment.

| | **State** | **History** |
|---|---|---|
| What it is | Current balances, nonces, contract code, contract storage slots — the data needed to execute the *next* block | All past blocks, transactions, receipts |
| Size (mainnet, approx) | ~250–350 GiB | ~500 GiB+ and growing linearly with usage |
| Who must keep it | Every full node | Full nodes (historically); being relaxed |
| Can it be discarded? | Not without a protocol change (state expiry) | Yes — this is EIP-4444, already partially shipped |
| Roadmap relief | Slow, mostly research | Real and partly delivered |

**Archive nodes carry a third category:** every *historical* state — not just the current value of each slot, but the value at every past block. This is what makes archive nodes expensive, and it is why archive growth is not the same number as state growth.

### 1.2 How Ethereum stores state, and why it hurts

State lives in a **Merkle Patricia Trie (MPT)** — a hexary (16-way branching) authenticated tree, keccak-hashed, RLP-encoded. Structurally it is a *tree of trees*: one account trie, plus a separate storage trie per contract, with contract bytecode stored outside the trie entirely.

Four properties of that design generate our operational pain:

**(a) Write amplification.** Changing one storage slot requires rewriting every node on the path to the root, in both the contract's storage trie and the account trie. A single-slot update touches on the order of a dozen database records. This is why archive nodes grow far faster than the logical state does — we persist that amplified churn at every block.

**(b) Random-access I/O.** Trie traversal is a pointer chase through keccak-distributed keys, which are deliberately uniform and therefore have no locality. Every state read is effectively a random read. This is why node performance is bound by disk IOPS, not sequential throughput, and why NVMe is non-negotiable while SATA SSDs fall over.

**(c) Poor proof efficiency.** Hexary branching means a Merkle proof must include 15 sibling hashes per level. Typical MPT proofs run ~2,880 bytes versus ~768 bytes for an equivalent binary tree. This is the direct motivation for the binary tree work (Part 2).

**(d) State is never freed.** There is no rent, no expiry, and no incentive to clean up. Storage slots written once in 2017 are still carried by every node today.

### 1.3 What the state is actually made of

Per Paradigm's analysis, state composition is roughly:

- **Contract storage: ~82%** — dominated by token balances
- Accounts: ~14%
- Contract bytecode: ~4%

Within storage, **ERC-20 balances (~27%) and ERC-721/NFT data (~22%)** are the single largest consumers. The reason is structural: every (token, holder) pair requires its own 32-byte storage slot. An airdrop to 500,000 addresses permanently adds 500,000 slots to the state that every node on Earth carries forever, for a one-time gas payment that — until EIP-8037 — was priced at 20,000 gas per slot.

**This is the core economic defect: state creation is a permanent, recurring cost to every node operator, historically charged as a trivial one-time fee.** We absorb that externality on our balance sheet.

### 1.4 Why growth accelerated recently — and why this matters for our forecast

State growth is roughly proportional to gas throughput. Mainnet's gas limit was raised from 30M to 60M over the course of 2025 (standardised at 60M by EIP-7935 in Fusaka).

The effect was immediate and is documented in EIP-8037's own rationale: after the increase, **average new state created per day more than tripled**, putting annual growth at approximately **116 GiB/year**.

For context, Paradigm's widely-cited analysis measured state at ~245 GiB growing at 31–72 GiB/year — but **that analysis predates the gas limit increase.** If your team or your vendors are still planning against those numbers, the forecast is low by roughly 2x.

**Forecasting rule of thumb: state growth scales with the gas limit.** Any gas limit increase is a direct, near-linear increase in our storage burn rate. This is the single most important variable in the model, and Part 2 explains why it is about to move again.

---

## Part 2 — What's coming, and what we can actually bank on

I have separated this into three confidence tiers. The distinction between tier 1 and tier 3 is the entire point of this section — the public discourse (and much of the SEO-grade "Ethereum 2026" content your team will encounter) collapses them.

### Tier 1 — Scheduled, in-window, bankable

#### Glamsterdam fork — expected H2 2026

**Status:** Final devnet stage reached mid-June 2026, with the EIP bundle locked. Public testnets (Holesky, Hoodi) fork before mainnet. No mainnet target slot has been announced.

**Realistic date:** Prior forks have taken 2–4 months of public testnet seasoning. On that cadence, **mainnet activation lands somewhere between September and December 2026**. Note that the EF's own February 2026 priorities post targeted "H1 2026" and it has already slipped; the April 2026 checkpoint described ePBS as "trickier than anticipated." **Assume Q4 2026, with meaningful probability of slipping into Q1 2027.**

**Confirmed scheduled for inclusion** (per EIP-7773, the fork meta EIP): EIP-7708, 7732, 7778, 7843, 7928, 7954, 7976, 7981, 8024, **8037**.

The two items that matter to us:

**EIP-8037 — State-creation gas cost increase. THE relevant change.**

Introduces a cost-per-state-byte unit (CPSB = 1,530 gas) and reprices state creation sharply upward:

| Operation | Current | EIP-8037 | Multiple |
|---|---|---|---|
| New account creation | 25,000 | 183,600 | ~7x |
| New storage slot | 20,000 | 97,920 | ~5x |
| Contract deployment (24 kB) | 4.95M | 37.78M | ~8x |

The design target is **120 GiB/year at a 150M gas limit**, scaling roughly linearly:

| Gas limit | Bounded worst-case growth |
|---|---|
| 100M | 80 GiB/yr |
| 150M | 120 GiB/yr |
| 300M | 240 GiB/yr |

**Read this carefully for planning purposes.** Current growth is ~116 GiB/year at a 60M gas limit. EIP-8037's target is ~120 GiB/year at 150M. **The net effect is to hold state growth approximately flat while gas throughput increases 2.5x.** It is a guardrail that prevents growth from tripling. It is *not* a reduction, and it does nothing about the ~350 GiB already accumulated.

*Secondary effect worth flagging to product:* a 5–8x repricing of state creation will materially change the economics of any customer or internal workload that deploys contracts or writes storage in bulk on L1.

**EIP-7928 — Block-Level Access Lists.** Declares each block's state dependencies up front, enabling parallel execution and parallel state prefetch. Modest positive for our execution latency and I/O scheduling. Its strategic significance is that it is the enabler for the gas limit increase below.

#### Gas limit increase toward 150–200M — the in-window *cost* driver

The explicit purpose of pairing ePBS with BALs is to make it safe to raise the block gas limit from 60M toward **roughly 200M**. EIP-8261 (a gas-limit schedule) is in scope. The EF's 2026 priorities commit to "continuing to raise the gas limit toward and beyond 100M."

**This is the most consequential in-window change for our budget, and it points the wrong way.** More gas per block means proportionally more history, more receipts, more state, more archive diffs, and longer initial syncs. EIP-8037 caps the *state* component. It does not cap history or archive growth, which scale with transaction volume.

**Plan for this as a cost increase, not a relief.**

#### History expiry — partially delivered, more coming

**Already shipped (July 2025):** All execution clients support partial history expiry — dropping pre-Merge block bodies and receipts. Worth **300–500 GB** on a full node. If any node in our fleet has not had this applied, that is free money sitting on the table today.

**Phase 2 — rolling history expiry (full EIP-4444):** Would let nodes drop history beyond a rolling window near chain head. **No date set.** The EF describes remaining obstacles as more community-management than technical, and lists history expiry as a 2026 short-term priority. **Confidence it lands in-window: moderate (~50%).**

Note the asymmetry: this is a large win for *full* nodes and, by definition, not something an archive node can take advantage of for the data it is contracted to serve. Its value to us is that it makes a **tiered fleet** cheaper — see Part 3.

### Tier 2 — Real work, credible, but almost certainly outside our window

#### Binary state tree (EIP-7864)

Replaces the hexary MPT with a unified binary tree: account headers, contract code, and storage merged into one tree with 32-byte keys, BLAKE3-hashed (possibly Poseidon2 later), no RLP, no extension nodes. Cuts proof size ~75% (~2,880 → ~768 bytes) and reduces branch count 3–4x.

**Status: Draft. No fork targeted.** Migration is a separate proposal (EIP-7748), also draft, which converts a fixed number of key-values per block from the frozen MPT into the new tree.

**Verdict: do not plan around this.** Not in Glamsterdam. Even optimistically it is a Hegotá-or-later item (2027+), and the migration is a multi-month online process after that.

**Important correction to circulating assumptions: Verkle trees are no longer the plan.** Verkle was the long-standing candidate but has been displaced by binary trees, largely over quantum-vulnerability concerns with its elliptic-curve commitments. If anyone on the team or in a vendor deck is planning against a Verkle timeline, that plan is obsolete.

⚠️ **Be aware that `ethereum.org/roadmap/statelessness` is currently out of date** — it still presents Verkle trees as a prerequisite for statelessness. Do not use that page as a planning source.

#### Statelessness

Lets validating nodes verify blocks without storing state, using witnesses. Requires the binary tree first. The EF classifies it as research (listed as "statelessness (VOPS)" under its Harden-the-L1 track); ethereum.org describes weak statelessness as "probably a few years away."

**Verdict: outside window.** And note — **statelessness is irrelevant to archive nodes by construction.** It removes the need to store state in order to validate; we store state in order to *serve historical queries*. Our product requirement is untouched.

### Tier 3 — Aspirational. Do not put these in a financial model.

- **State expiry** — the only proposal that would actually *shrink* state. Explicitly in the research phase, expected to arrive after statelessness, no concrete scheduled EIP. Realistically 2029+, if ever, and it is the most likely item on the roadmap to be quietly dropped — it has been "a few years away" for six years. **It also would not help archive nodes**, which would need to retain expired state to serve historical queries regardless.
- **"Lean Ethereum" / RISC-V / leanISA VM replacement** — Buterin's July 2026 Berlin strawmap, a 3–4 year arc through roughly 2029. He describes the VM shift as "still far away."
- **Any claim that node storage drops to "a few GB" or "runs on a laptop"** — this refers to a hypothetical future *stateless validating* node. It has no bearing on archive infrastructure and will not apply to us at any point in this decade.

### Summary table

| Change | Helps state? | Helps **our archive nodes**? | In window? | Confidence |
|---|---|---|---|---|
| Partial history expiry | No | Marginally (non-archive tier) | **Shipped** | Certain |
| EIP-8037 state repricing | Caps growth rate | Caps growth rate | Q4 2026–Q1 2027 | **High** |
| EIP-7928 BALs | Perf only | Minor perf/IO | Q4 2026–Q1 2027 | **High** |
| Gas limit → 150–200M | **Worsens** | **Worsens** | 2027 | High |
| Rolling history expiry | No | Non-archive tier only | Maybe | ~50% |
| Binary tree (EIP-7864) | Proofs, not size | **No** | No | Low |
| Statelessness | Full nodes only | **No** | No | Very low |
| State expiry | Yes | **No** | No | Negligible |

**The column that should drive the budget is the third one.**

---

## Part 3 — What we should do in the meantime

### 3.1 Plan on the assumption of zero protocol relief

For the 18–24 month window, model archive storage as growing at least as fast as it does today, with a step increase when the gas limit rises post-Glamsterdam.

**Planning figures.** Current reference points, with the caveat that published archive figures vary considerably by client version and are frequently stale:

| Configuration | Approx. disk | Notes |
|---|---|---|
| Erigon 3 archive | ~1.8–2.2 TB | Best-in-class. Some sources still quote 3–3.5 TB for Erigon 2 — verify against your own fleet |
| Geth archive, path-based mode | ~2 TB | New as of Jan 2026 |
| Geth archive, legacy hash mode | ~18–20 TB | **Migrate off this** |
| Full node (execution) | ~0.9–1.3 TB | Plus ~80–200 GB consensus, ~100–150 GB blobs |

⚠️ I could not source a reliable current figure for **Reth** archive size — measure it in-house before making it a fleet standard.

**Recommended budget model:**
- Baseline archive growth: use your own measured fleet number, not a published one. Published archive figures are noisy and often a year stale.
- Apply a **1.5–2.5x step increase** to the growth rate from the point the gas limit moves 60M → 150M+ (assume H1 2027).
- Provision **24 months of headroom, not 12.** Growing an archive node's storage is disruptive; resyncing is measured in days.
- Include a hardware refresh line for **NVMe endurance (DWPD)**, not just capacity. Archive nodes are write-heavy and the write amplification described in §1.2(a) means drives are consumed faster than raw data growth implies. Drive wear-out is a more likely failure mode than running out of space.

### 3.2 Fix client and storage configuration first — this is the biggest lever we control

The order-of-magnitude spread between legacy and modern archive implementations is larger than anything the protocol will deliver to us before 2028.

**Priority actions:**
1. **Audit for any legacy hash-mode Geth archive nodes.** Migrating to Erigon 3 or path-based Geth is potentially a ~10x storage reduction. This is the single highest-ROI action available and it is available today.
2. **Confirm partial history expiry is applied fleet-wide.** 300–500 GB per node, already shipped, no protocol risk.
3. **Benchmark Erigon 3 vs. Reth vs. path-based Geth on our own workload** before standardising. Do not take vendor or blog figures at face value — the published numbers disagree with each other by 2x.

### 3.3 Stop running archive nodes for workloads that don't need them

This is likely the largest structural saving available and it is entirely within our control.

Archive nodes should serve archive queries. In most data companies the actual distribution of query traffic against deep historical state is a small single-digit percentage. Recommended tiering:

- **Archive tier** — minimal count, sized for genuine `debug_traceTransaction` / historical `eth_call` demand.
- **Full tier** — recent state, serves the large majority of traffic, ~1.3 TB and benefits directly from rolling history expiry when it lands.
- **Derived-data tier** — for the highest-volume historical queries, extract once into columnar storage (Parquet/ClickHouse). Cheaper per query and per GB than any archive node, and immune to the entire protocol roadmap discussed above.

**Every query moved from tier 1 to tier 3 is permanently insulated from Ethereum's state growth.** Given that the protocol offers archive nodes no relief in this window, reducing archive dependence is the most durable answer available.

### 3.4 Treat sync time as a capacity risk, not an inconvenience

Sync times degrade superlinearly with state size and will worsen with the gas limit increase. Current references: ~3 days for an Erigon archive sync from scratch; ~3.5 days for a Reth full node.

- **Never rebuild from genesis in an incident.** Maintain warm standbys and snapshot-restore pipelines; make snapshot restore the standard recovery path with a tested RTO.
- Use **OtterSync** (Erigon) or equivalent snapshot-based sync where available.
- Keep a **maintained internal snapshot repository**. As sync times grow, the cost of not having one grows with them.
- Add sync-from-scratch duration to routine monitoring — it is a leading indicator of the state growth trend hitting us operationally, and it will show up before disk alarms do.

### 3.5 Track these specific signals

Concrete, checkable triggers to review the plan against:

| Signal | Where | Why it matters |
|---|---|---|
| Glamsterdam mainnet slot announcement | All Core Devs calls; forkcast.org | Confirms EIP-8037 activation date |
| EIP-8037 final parameters | EIP-7773 fork meta | CPSB value may change before freeze |
| Gas limit schedule after Glamsterdam | EIP-8261; client defaults | **Directly sets our growth rate** |
| Rolling history expiry (EIP-4444 ph. 2) | ACD; EF checkpoints | Would cut full-tier cost materially |
| EIP-7864 moving Draft → CFI on a fork | EIP-7773 / Hegotá meta | First real signal binary trees are within planning reach |

Re-forecast at the Glamsterdam activation announcement and again once the post-fork gas limit stabilises. Those are the two moments where the numbers in this brief will actually change.

---

## The one-paragraph version for finance

Ethereum's state growth is a structural consequence of how the protocol stores data — state is never deleted, and storage costs are paid once by whoever creates them while being borne forever by every node operator. The protocol is addressing this, but on a multi-year timeline, and the proposals that would genuinely shrink storage (state expiry, statelessness, binary trees) are research-stage, outside our planning window, **and would not reduce archive node requirements even once delivered.** The one change we can count on — EIP-8037, in the Glamsterdam fork expected around Q4 2026 — caps state growth at roughly its current absolute rate while the network's throughput increases 2.5x. It prevents our costs from tripling; it does not reduce them. Meanwhile the same fork enables a gas limit increase that pushes our costs *up*. **We should budget for continued growth at or above current rates for the full 24 months, and pursue savings through client migration, fleet tiering, and moving historical queries into derived data stores — all of which are within our control and none of which depend on Ethereum shipping anything.**

---

## Sources

- [Glamsterdam | ethereum.org](https://ethereum.org/roadmap/glamsterdam/)
- [EIP-7773: Hardfork Meta — Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773) — authoritative EIP inclusion list
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [Protocol Priorities Update for 2026 | Ethereum Foundation](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [Checkpoint #9: Apr 2026 | Ethereum Foundation](https://blog.ethereum.org/2026/04/10/checkpoint-9)
- [Partial history expiry announcement | Ethereum Foundation](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [How to Raise the Gas Limit, Part 1: State Growth | Paradigm](https://www.paradigm.xyz/writing/how-to-raise-the-gas-limit-1) — state composition; note pre-dates the 60M increase
- [Glamsterdam Repricings #1, Feb 2026 | Fellowship of Ethereum Magicians](https://ethereum-magicians.org/t/glamsterdam-repricings-1-feb-4-2026/27625)
- [Glamsterdam Hardfork Tracker | ethdaily.io](https://ethdaily.io/glamsterdam)
- [Glamsterdam enters final devnet phase, 200M gas target | The Defiant](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [Vitalik's two-part execution layer plan | The Block](https://www.theblock.co/post/391681/vitalik-buterin-lays-out-a-two-part-plan-to-overhaul-ethereums-execution-layer-from-the-ground-up)
- [Ethereum block gas limit raised to 60M | The Block](https://www.theblock.co/post/380687/ethereum-block-gas-limit-fusaka)
- [Erigon vs Geth 2026 | Chainstack](https://chainstack.com/ethereum-clients-geth-and-erigon/)
- [Erigon 3 Alpha 2: OtterSync | Erigon.tech](https://erigon.tech/erigon-3-alpha-2-introducing-blazingly-fast-sync-on-archive-nodes-with-ottersync-and-other-improvements/)
- ⚠️ [Statelessness | ethereum.org](https://ethereum.org/roadmap/statelessness/) — **currently out of date**; still presents Verkle trees as the plan

*Where figures conflict between sources (notably archive node sizes), the brief flags the range rather than picking one. Verify against our own fleet telemetry before committing budget.*
