# Ethereum State Growth: Technical & Capacity-Planning Brief

**Date:** 2026-09-23
**Planning window:** through ~Q3 2028 (24 months)
**Audience:** infrastructure team + finance

---

## TL;DR for finance

1. **No protocol change that meaningfully shrinks archive-node disk will land inside the 18–24 month window.** The one real candidate (binary state tree migration) is still a Draft EIP with no fork assignment, and the Ethereum Foundation's own September 2026 priorities post places the state work as a multi-year research arc whose major design and migration work *begins* in the fork after next-after-next (tentatively late 2027) and continues beyond it. Budget as if relief arrives in 2029, not 2027.

2. **The thing that *is* landing — Glamsterdam, targeting Q4 2026 — makes your problem worse before it makes it better.** Its explicit purpose is to make it safe to raise the block gas limit from 60M today toward ~200M. State-growth repricing ships alongside it, but that repricing sets a *ceiling* (~120 GiB/yr of new state at a 150M reference gas limit) that is **higher than today's actual growth rate**. It is a guardrail against catastrophe, not a reduction.

3. **The largest single cost lever available to you is a client/storage-layout decision you can make this quarter, not a protocol change.** Modern archive layouts (Geth's path-based archive mode, Erigon, Reth) put archive nodes in the ~2–3 TB range versus ~18–20 TB for legacy Geth hash-based archive. If any of your fleet is still on a legacy layout, that is a near-order-of-magnitude saving available now.

4. **Plan capacity against gas-limit trajectory, not against calendar.** Archive growth scales roughly linearly with state *churn* per block, which scales with the gas limit. A 60M → 200M gas limit is a ~3.3× multiplier on your archive growth rate. Model that as the dominant variable.

---

## 1. What is actually driving this at the protocol level

### 1.1 Two different things people call "state growth"

These have different causes and different fixes. Conflating them is the most common planning error.

| | **State size** | **Archive growth** |
|---|---|---|
| What it is | The current world state: all accounts, balances, contract code, storage slots | Every *historical* version of that state, so you can answer `eth_call` at block N |
| Grows with | Net new accounts and storage slots | Total state *writes* per block × blocks |
| Hurts | Full nodes, sync time, RAM/SSD working set | Archive nodes — your biggest line item |
| Relieved by | State expiry, repricing state creation | Better historical-state encoding; nothing at the protocol layer |

A slot that is written every block forever adds ~0 to state size but adds a diff to every archive node, every block. **Your archive bill is driven by write volume, which is driven by the gas limit.** This is why Glamsterdam's gas-limit unlock is the central fact in your planning window.

### 1.2 How Ethereum stores state, and why it's expensive

Ethereum's world state is a **hexary Merkle Patricia Trie (MPT)**, keccak-hashed, with separate sub-tries per contract for storage. Three properties make it costly:

- **Hexary branching.** Each node has 16 children, so a node is large and proof paths are wide. Merkle branches are roughly 4× longer than a binary tree would produce.
- **Hash-keyed, so effectively random-access.** Keys are keccak hashes, so logically adjacent data lands in random disk locations. This is why state access is IOPS-bound rather than bandwidth-bound, and why access costs degrade as state grows.
- **Every write rewrites a path to the root.** A single `SSTORE` dirties every trie node from the leaf to the state root. In a naive (hash-keyed) database, all of those node versions are retained forever — which is exactly why legacy Geth archive nodes reached ~18–20 TB while the actual state is a small fraction of that.

The modern clients attack the third point at the storage layer rather than the protocol layer: **path-based storage with reverse diffs** stores current state once and reconstructs history by applying inverse diffs backwards. That's a client implementation choice, available today, and it's the single biggest lever you control.

### 1.3 What's actually in the state

Composition matters for forecasting, because it tells you what repricing will and won't slow down:

- Contract **storage slots dominate**: roughly 82% of state, versus ~14% accounts and ~4% contract bytecode.
- The biggest single contributors are **ERC-20 (~27%) and ERC-721 (~22%)** balance mappings — one 32-byte slot per (token, holder) pair, retained forever even at zero balance.
- Per-entry on-disk overhead is far above the logical payload: measured averages around **~134 bytes per account and ~191 bytes per storage slot** once trie and encoding overhead is counted.

Implication: state creation is cheap relative to its permanent cost, and it is overwhelmingly driven by token-contract storage writes. This is precisely what the Glamsterdam repricing bundle targets.

> **Figures caveat:** state-composition and per-entry byte figures come from published analyses (Paradigm's gas-limit series and related research) rather than from a measurement of your own fleet. Treat them as directionally right, and validate against your own node metrics before they drive a purchase.

---

## 2. What is coming to Ethereum, and how much you can bank on it

Statuses below use the core-dev process vocabulary (EIP-7723): **SFI** = Scheduled For Inclusion (in, barring disasters); **CFI** = Considered For Inclusion (not committed); **Draft** = written down, means little; **DFI** = declined for that fork.

### 2.1 Already shipped — bank on it, it's done

| Change | Status | Effect on you |
|---|---|---|
| **EIP-4444 partial history expiry** | Live. All ELs support it; mainnet drop began shortly after Pectra (May 2025) | **300–500 GB** off any node, by dropping pre-Merge block bodies and receipts. One-time, not recurring. |
| **Path-based archive storage** (Geth, Jan 2026) | Shipped, client-level, no fork needed | Archive from ~18–20 TB → **~1.9–2.0 TB** |
| **Fusaka** (Dec 3, 2025): PeerDAS (EIP-7594), blob-parameter-only forks (EIP-7892) | Live | Blob scaling, not state. Adds blob-storage cost but blobs are pruned (~100–150 GB steady-state), not permanent. |

**Important:** history expiry today is *partial* — pre-Merge only. Rolling post-Merge history expiry remains a design space; the coordinating meta-EIP (EIP-7927) is **Stagnant**. Do not model a recurring annual history reclaim.

### 2.2 Glamsterdam — the next fork. Real, but read it carefully.

**Status: in final testing. Sepolia fork targeted 2026-10-06 13:53 UTC (agreed at ACDC #186, Sept 3). Mainnet target Q4 2026, not yet confirmed. The schedule has already slipped repeatedly, and Devnet-9 (launched Sept 1, 1,000 validators) was reported as not finalizing.** Treat Q4 2026 as optimistic and Q1–Q2 2027 as realistic.

State-relevant SFI contents:

| EIP | What it does | Net effect on your disk |
|---|---|---|
| **EIP-8037 — State Creation Gas Cost Increase** | Introduces a **second gas dimension** metering state growth: fixed `COST_PER_STATE_BYTE` = 1,530, funded from a per-frame reservoir separate from execution gas. New account = 120 state bytes, new storage slot = 64, EIP-7702 auth = 23. New account creation ~25k → ~183.6k gas (~7×); new storage slot ~20k → ~97.9k (~5×); 24 kB deploy ~8×. | **Caps** state growth at a targeted **~120 GiB/yr at a 150M reference gas limit** (~160 GiB/yr at 200M). A ceiling, not a cut. |
| **EIP-8038 — State-Access Gas Cost Update** | First state-access repricing since 2021. `STORAGE_WRITE` 2,800 → 10,000 (+257%), `ACCOUNT_WRITE` 6,700 → 9,000, `COLD_ACCOUNT_ACCESS` 2,600 → 3,000, `CREATE_ACCESS` 7,000 → 12,000. | Suppresses write-heavy workloads → **directly slows archive diff volume**. The most useful single item in the fork for you. |
| **EIP-7928 — Block-Level Access Lists** | Block header declares all state accessed, enabling parallel execution and state pre-fetch. ~70 KiB average per block. Reported **68–74% reduction in random disk IOPS** during execution. | Slight permanent storage *increase* (~70 KiB/block ≈ **~180 GB/yr** if retained indefinitely — client retention policy is still being decided, with proposals to tie it to the history-expiry window). Large IOPS win. |
| **EIP-7732 — ePBS** | Enshrined proposer-builder separation (consensus headliner) | No direct state effect; part of what makes higher gas limits safe. |
| **EIP-7976 / EIP-7981 / EIP-2780 / EIP-7954** | Higher calldata fees, access-list cost increase, transaction cost reform, larger contract size limit | Mixed; mostly throughput-shaping. EIP-7954 raises the contract size cap, marginally increasing bytecode state. |

**The strategic read on Glamsterdam:** the repricing bundle exists *to permit the gas limit to rise*. The gas limit went 30M → 60M during 2025. The stated trajectory is toward 100M and then ~200M, with 200M cited as the design target Glamsterdam unblocks. EIP-8037's own bound of ~160 GiB/yr at 200M is the honest number to plan against — and it is a worst-case guardrail, with actual growth likely below it but *above* today's.

**Also note:** EIP-8037 drew substantive core-dev pushback on complexity-versus-benefit, and a follow-on proposal (**EIP-8372, Normalized State Gas Limit**, Draft, no fork assignment) already exists to recalibrate it because the single shared block limit creates a miscalibration risk in both directions. The state-gas mechanism is likely to be tuned after it ships. Don't hard-code its parameters into a model.

### 2.3 Hegotá — the fork after. Nothing for you.

Target mainnet **2027-05-19** (will slip). 62 EIPs proposed; scoping is live.

- **EIP-7805 (FOCIL)** — SFI, consensus headliner. Censorship resistance. No state effect.
- **EIP-8141 (Frame Transactions)** — stablecoin gas payment. Promoted CFI → SFI on the Aug 27, 2026 ACDE call, then **moved back to CFI**. Unsettled.

**There is currently no state-growth-relief EIP scheduled for Hegotá.** If you are planning to May 2027 + slip, assume zero additional protocol relief beyond Glamsterdam.

### 2.4 Binary state tree — the real fix, and why you cannot bank on it

**EIP-7864, "Ethereum state using a unified binary tree." Status: Draft. Created Jan 20, 2025. No fork assignment.**

What it does: replaces the hexary keccak MPT with a binary tree over a uniform 32-byte key/value layout, merging accounts, storage and code into one structure. Merkle branches ~4× shorter; swapping the hash to BLAKE3 or Poseidon2 offers a further 3×–100× proving improvement.

Why it is not bankable in your window:

- **The hash function is not chosen.** The draft uses BLAKE3 to reduce implementation friction; Keccak and Poseidon2 remain candidates, and Poseidon2 is subject to an ongoing EF cryptography security assessment. A hash change late in the process is a spec-wide change.
- **Migration is a separate, unwritten fork.** EIP-7864 starts an *empty* binary tree; the MPT is frozen and only new writes go to the new tree. Actually migrating existing state is deferred to **EIP-7748**, a future hard fork. So even the first shipment of 7864 gives you *two* tries on disk, not one — a transient storage *increase*.
- **The EF's own roadmap places it beyond your window.** The September 7, 2026 EF protocol-priorities post frames state as a research arc — "migrating to a new trie, sustainable state growth, and decentralized access to current and historical state" — with the largest design and migration work **beginning in the "I\*" fork (the one after Hegotá, tentatively late 2027) and continuing beyond it**. The only hard commitment in that post is post-quantum readiness by December 2029.
- **Historical precedent.** Verkle trees were the consensus statelessness answer for roughly four years and were then dropped in 2024–25 over ZK-compatibility and post-quantum concerns. EIP-7864 is the replacement for a plan that itself looked certain. Treat the current answer as revisable.

**And note what it is and isn't.** The binary tree is primarily a *proving and verification* win (statelessness, light clients, ZK-EVM). Its direct effect on archive disk is secondary, and the migration period is an operational cost event — running two tries, rebuilding key preimages, an overlay transition — not a saving.

**Planning verdict: assume zero binary-tree benefit before 2029. Budget engineering time for a migration event, not a disk reduction, if it lands earlier.**

### 2.5 State expiry — aspirational

Genuine state expiry (state that becomes inaccessible without a witness, capping state size permanently) has **no EIP scheduled for any fork**. It remains an active research topic with live proposals in the pricing space (e.g. EIP-8032 size-based storage gas pricing, EIP-7999 dynamic multidimensional pricing) but nothing committed. Out of window entirely. If a deck or vendor claims state expiry is coming, ask for the fork and the SFI status.

### 2.6 Summary: bankability table

| Change | Status | Confidence in window | Disk effect |
|---|---|---|---|
| Partial history expiry (EIP-4444) | Shipped | **Done** | −300–500 GB, one-time |
| Path-based archive layout | Shipped (client) | **Done** | −80–90% on legacy Geth archive |
| EIP-8038 state-access repricing | **SFI Glamsterdam** | High (~85%) by mid-2027 | Slows archive diff growth |
| EIP-8037 state-creation gas | **SFI Glamsterdam** | Med-high (~75%); params likely retuned | Caps growth at ~120–160 GiB/yr |
| EIP-7928 BALs | **SFI Glamsterdam** | High (~85%) | −68–74% IOPS; +~70 KiB/block |
| Gas limit 60M → 100M → ~200M | Follows Glamsterdam, validator-signalled | High that it *rises*; pace uncertain | **Up to 3.3× growth multiplier** |
| Rolling post-Merge history expiry | Meta-EIP Stagnant | Low (<20%) | Would be large if it lands |
| Binary tree (EIP-7864) | **Draft**, no fork | **Very low (<10%)** | Neutral-to-negative during migration |
| State expiry | Research | **~0%** | n/a |

---

## 3. What to do in the meantime

### 3.1 Do now (this quarter)

**A. Audit and migrate storage layouts. Highest ROI action available.**
Confirm no archive node is on legacy hash-based Geth. Current archive footprints: Geth path-based ~1.9–2.0 TB, Erigon ~1.8–2.2 TB, Reth archive ~2.8 TB (Reth full ~1.2 TB). If any node is at 15 TB+, that is a ~10× reclaim with no protocol dependency.

**B. Apply history expiry everywhere.** Every execution client supports it. 300–500 GB per node, free.

**C. Right-size the archive fleet.** Most "we need archive" requirements are actually "we need traces for the last N months" or "we need one specific contract's history." Segment: a small true-archive core plus a larger pool of pruned/full nodes, with historical queries served from an indexed store (your own extracted datasets, or a third-party archive provider for the deep tail). Archive nodes are the expensive tier — minimise their count, not their size.

**D. Instrument state-write volume per block, not just disk used.** Build the forecast off bytes-of-state-diff per block. That is the quantity that scales with the gas limit and lets you convert "gas limit went to 100M" into a dollar number the same week it happens.

### 3.2 Plan for (next 2–4 quarters)

**E. Budget against gas limit, with these three scenarios.** The gas limit is set by validator signalling, not by a fork, so it can move between forks. This is your dominant variable.

| Scenario | Gas limit path | Archive growth multiplier vs. today | Plan as |
|---|---|---|---|
| **Conservative** | Stays 60M through 2027; 100M in 2028 | 1.0× → 1.7× | Best case. Don't budget here. |
| **Central** | 100M mid-2027 after Glamsterdam beds in; 150M by mid-2028 | 1.7× → 2.5× | **Recommended planning basis** |
| **Aggressive** | 100M Q1 2027, 200M by end-2027 | up to 3.3× | Stress case; verify you can absorb it |

Applied to a ~2 TB archive node growing at roughly today's rate, the central scenario roughly doubles your annual incremental TB by late 2027. Model procurement on the central case with headroom to absorb the aggressive case for two quarters without emergency spend.

**F. Provision for Glamsterdam as an event, not just a state.** It changes block structure (BALs, ePBS). Expect a client-upgrade cycle across the whole fleet, possible resync requirements, and a period of elevated instability. Reserve engineering capacity in the fork window and do not schedule a hardware migration across it. Given the repeated slips and a non-finalizing Devnet-9 as of early September 2026, hold the date loosely — track it rather than commit to it.

**G. Decide your BAL retention policy early.** BALs add ~70 KiB/block (~180 GB/yr) if retained indefinitely. Client teams are actively discussing tying BAL retention to the history-expiry window. Track that decision — it's a real line item, and defaults may not match what you want.

**H. Buy flexibly.** Given the genuine uncertainty about both gas-limit pace and any binary-tree migration timing, favour capacity you can add incrementally over a single large 3-year provisioning. The migration scenario in particular would transiently require *more* disk (two tries), so leave ~30–40% headroom rather than running lean.

### 3.3 Do not do

- **Do not budget on the binary tree, statelessness, or state expiry.** Nothing in that cluster is scheduled for a fork. If it lands in your window, it costs you engineering time and transient disk before it saves anything.
- **Do not assume Glamsterdam reduces your disk usage.** It is a throughput unlock with a state-growth guardrail attached. Net-net it most likely increases your growth rate.
- **Do not model recurring annual reclaims from history expiry.** The pre-Merge drop was one-time; rolling expiry is unscheduled and its meta-EIP is Stagnant.
- **Do not hard-code EIP-8037's parameters.** They are contested and a recalibration EIP (8372) already exists.

---

## 4. How to keep this brief current

Re-check quarterly, or immediately on any gas-limit signalling move:

1. **[forkcast.org](https://forkcast.org)** — authoritative CFI/SFI/DFI status per fork, devnet client matrices, ACD call summaries. Updated after every core-dev call. Check Glamsterdam status and Hegotá scoping.
2. **[ethereum/pm](https://github.com/ethereum/pm)** — ACDE/ACDC agendas and the original discussion threads.
3. **[eth-rnd-archive](https://github.com/ethereum/eth-rnd-archive)** — searchable Eth R&D Discord; where client teams actually discuss blockers and timelines.
4. **[EIPs repo](https://github.com/ethereum/EIPs)** — status field on 7864, 7748, 8037, 8038, 8372, 7927.
5. **Current gas limit** — query your own nodes or a block explorer. It's dynamic; never hard-code it.

**The rule for anything a vendor or a deck tells you:** ask for the EIP number and its fork status on forkcast. "On the roadmap" is not a status. Roadmap diagrams are direction, not commitment — Verkle trees were on every roadmap diagram for four years and shipped nowhere.

---

## Sources

Protocol status verified against primary sources where possible; some quantitative figures come from secondary aggregators and are flagged in-line.

- [EF Protocol: Current and Emerging Priorities (Sept 7, 2026)](https://blog.ethereum.org/en/2026/09/07/protocol-priorities)
- [Protocol Priorities Update for 2026 (Feb 18, 2026)](https://blog.ethereum.org/en/2026/02/18/protocol-priorities-update-2026)
- [Partial history expiry announcement](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864) · [EthMagicians thread](https://ethereum-magicians.org/t/eip-7864-ethereum-state-using-a-unified-binary-tree/22611)
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037) · [EthMagicians thread](https://ethereum-magicians.org/t/eip-8037-state-creation-gas-cost-increase/25694)
- [EIP-8038: State-access gas cost update](https://eips.ethereum.org/EIPS/eip-8038)
- [EIP-8372: Normalized state gas limit](https://eips.ethereum.org/EIPS/eip-8372)
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928)
- [EIP-7927: History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927)
- [BAL retention discussion — Nethermind #13553](https://github.com/NethermindEth/nethermind/issues/13553)
- [EIPsInsight: Glamsterdam upgrade tracking](https://eipsinsight.com/upgrade/glamsterdam) · [Upgrade schedule](https://eipsinsight.com/upgrade/schedule)
- [Paradigm: How to Raise the Gas Limit, Part 1: State Growth](https://www.paradigm.xyz/writing/how-to-raise-the-gas-limit-1)
- [Vitalik Buterin: A Theory of Ethereum State Size Management](https://hackmd.io/@vbuterin/state_size_management)
- [Glamsterdam final devnet phase, 200M gas-limit target — The Defiant](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [Sepolia Glamsterdam fork targeted Oct 6, 2026 — CryptoPotato](https://cryptopotato.com/ethereum-targets-october-6-for-glamsterdam-sepolia-fork/)
- [Glamsterdam schedule slip / Devnet-9 finalization issues — 24/7 Wall St.](https://247wallst.com/investing/cryptocurrency/2026/09/11/ethereums-glamsterdam-upgrade-slipped-again-sepolia-now-targets-october-6/)
- [Hegotá scoping, FOCIL + EIP-8141 status — Christine D. Kim, ACDE #229](https://christinedkim.substack.com/p/acde-229) · [ACDE #239](https://christinedkim.substack.com/p/acde-239)
- [Archive node disk size comparison 2026 — 7BlockLabs](https://www.7blocklabs.com/blog/ethereum-archive-node-disk-size-2026-vs-erigon-archive-node-disk-size-2026-vs-geth-full-node-disk-size-2026)
- [Erigon vs Geth 2026 — Chainstack](https://chainstack.com/ethereum-clients-geth-and-erigon/)
