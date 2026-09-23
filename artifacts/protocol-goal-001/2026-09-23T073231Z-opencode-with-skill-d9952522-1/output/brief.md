# Ethereum State Growth — Technical Brief for Infrastructure & Capacity Planning

**Prepared:** 2026-09-23
**Planning window covered:** ~18–24 months (through mid-2028)
**Status sources:** Forkcast (forkcast.org API, generated 2026-09-23), EIP specifications, All Core Devs call summaries, EF blog. All fork-inclusion claims below were checked against live sources on 2026-09-23 — not from memory.

---

## TL;DR (for finance)

- **Nothing on the Ethereum roadmap will shrink state or archive-node footprints within your planning window.** The only protocol change that is actually *scheduled* (EIP-8037/8038 in the Glamsterdam fork, projected ~Dec 2026) **slows the rate of growth**; it does not reduce existing size.
- **Structural fixes you may have heard about — Verkle trees, binary trees / statelessness, state expiry — are not in any fork.** Verkle is formally Stagnant. Do not put them in capacity models.
- **Plan for continued growth**: ~100 GiB/yr of state on full nodes pre-Glamsterdam, and roughly 2–5 GB/day on archive nodes depending on client. Buy for the downside case; treat any protocol relief as upside.

---

## 1. What is actually driving this (protocol level)

### State vs. history — two different problems

Ethereum disk usage splits into distinct buckets, and conflating them leads to bad purchasing decisions:

| Bucket | What it is | Consensus-critical? | Typical size (2026) |
|---|---|---|---|
| **State** | The Merkle Patricia Trie (MPT) of ~every account, balance, nonce, code hash, and contract storage slot. Plus the flat "snapshot" of current state. | Yes — every validator must hold it to execute blocks | ~340 GiB in Geth (May 2025 measurement, EF research), growing ~205 MiB/day at a 36M gas limit (~100 GiB/yr) |
| **History** | Bodies and receipts for all ~23M blocks | No (post-Merge) | ~900 GB total; ~300–500 GB is pre-Merge and now prunable |
| **Archive state history** | Every historical state root/intermediate node (or reverse-diffs, client-dependent) | No | Geth hash-based: **~20–22 TB**, ~5 GB/day growth. Erigon/Reth flat layout: **~1.8–4 TB** |

Key protocol facts:

- **State only grows.** Every new account (~120 bytes), new storage slot (~64 bytes), and deployed contract byte is stored *forever*. There is no deletion mechanism in the protocol today (EIP-161 only removed long-dead empty accounts; SELFDESTRUCT was neutered in Dencun/EIP-6780).
- **State size is a security parameter, not just an ops cost.** The EF's "bloatnet" work identified ~650 GiB of state as a threshold where state-access times rise ~40% and sync/memory degrade sharply. EF modeling (Nov 2025) projects **686 GiB – 1.08 TiB by mid-2027** under various gas-limit schedules *without* repricing. This is precisely why the protocol is acting (§2).
- **Gas-limit increases are the accelerant.** Measured new-state creation roughly doubled (102 → 205 MiB/day) when the gas limit went 30M → 36M. Glamsterdam targets a ~200M gas-limit floor, so without repricing, state growth would scale with throughput.
- **Archive nodes are your problem, not the network's.** The protocol does not need archive nodes; your storage cost is state × retention. Client architecture, not protocol, is the lever here (Erigon/Reth's flat layout vs Geth's legacy trie nodes is a ~6–10× difference).

### Where the pain comes from operationally

- **Disk**: state + (for archive) historical state diffs. Monotonic, no pruning possible at the protocol level.
- **Sync time**: snap sync must download and verify the full current state; it grows with state size. (Glamsterdam's networking-track EIP-8189, BAL-based state healing, targets this but is not a capacity change.)
- **I/O**: larger state → worse cache locality → slower SLOAD/SSTORE → this is why the protocol is repricing access, not just creation.

---

## 2. What's coming to Ethereum — verified current status

Status legend (per Forkcast): **Live** = on mainnet · **SFI** = Scheduled for a named fork (timing still uncertain) · **CFI/Proposed** = considered, not committed · **No fork relationship** = research/proposal only.

### Already live (you can use today)

| Item | Status | What it does for you |
|---|---|---|
| **Partial history expiry** (EIP-4444-aligned, delivered via EIP-7642 `eth/69`, included in Pectra + Fusaka) | **Live** since May–Jul 2025 | All EL clients support dropping pre-Merge block bodies/receipts (Geth `prune-history`, Besu `--history-expiry-prune`, Erigon flags, etc.). Saves **300–500 GB on full nodes**. **Does not touch state**, and does little for archive nodes beyond chain-data. Rolling expiry (pre-Cancun, pre-Prague) is arriving client-side (Geth `--history.chain`, Nethermind experimental rolling mode), no fork needed. |

### Scheduled — the one thing you can actually bank on

| Item | Status | Detail |
|---|---|---|
| **Glamsterdam fork** | **Upcoming.** Forkcast projected activation **2026-12-02** (Forkcast's working *estimate*, not an announced date). Full devnet series done; public testnet (Platåberget) live since Aug 2026; Sepolia/Hoodi next. | The fork that matters for your window. |
| **EIP-8037 — State Creation Gas Cost Increase** | **SFI for Glamsterdam** (Scheduled 2026-05-07, ACDE #236; EF blog 2026-08-24 confirms "scheduled for inclusion") | Reprices all state creation (new accounts, new storage slots, code deposit) to a fixed cost-per-state-byte (CPSB = 1,530 gas/byte), metered in a separate "state gas" dimension. **Explicit design target: cap state growth at ~120 GiB/yr at the reference block gas limit.** New account creation becomes ~5–8× more expensive in gas terms; storage slot creation 20k → ~98k gas-equivalent. |
| **EIP-8038 — State-access gas cost update** | **SFI for Glamsterdam** (Scheduled 2026-08-04) | Raises state-access opcode costs to reflect current state size/hardware. Unblocks further gas-limit increases. Neutral-to-slightly-negative for your nodes directly; it's what makes the 8037 cap compatible with higher throughput. |

**What this means quantitatively:** Glamsterdam converts "state growth scales with gas limit" into "state growth is capped by a priced state-byte budget." Best case, growth stays near the ~120 GiB/yr design target even as throughput rises. It is a *slope* change, not a level change — your existing terabytes stay.

### Considered / proposed — do not count on

| Item | Status | Note |
|---|---|---|
| **Hegotá fork** (next after Glamsterdam) | Planning; projected ~mid-2027 (estimate). Headliners already selected: **FOCIL (EIP-7805) and Frame Transactions (EIP-8141)** — nothing state-related. | The state-relevant items are only **Proposed** (pre-CFI): EIP-8372 (normalized state gas limit) and EIP-8368 (CPSB recalibration at higher gas limits). At best these *tune the cap*, they don't shrink anything. |

### Not in any fork — treat as aspirational

Verified against Forkcast `forkRelationships` (empty = not tracked for any upgrade) on 2026-09-23:

| Proposal | EIP status | Fork relationship | Reality check |
|---|---|---|---|
| **Verkle trees** (EIP-6800 + 7612/7748 transition) | **Stagnant** | None | The long-promised statelessness path has stalled; has been effectively superseded in current discussions. Zero probability inside your window. |
| **Binary tree / "PBT"** (EIP-7864, Partitioned Binary Tree EIP-8297, offline migration EIP-8347) | Draft | None | Active research and mentioned in recent ACDE discussion (#244, Aug 2026) only as future migration context — no decision, no devnet, no fork. |
| **State expiry** (EIP-7736 leaf-level expiry) | **Stagnant** | None | Depended on Verkle. |
| **State tiering** (EIP-8295/8296) | Draft | None | Early-stage proposals. |
| **Full rolling history expiry** (EIP-4444 proper, 1-year window) | Stagnant | None | Being delivered incrementally *client-side* instead (rolling prune modes), not as a consensus fork. Watch client releases, not forks. |
| **Adaptive state cost** (EIP-8075) | Draft | None | Alternative to 8037; not the shipped design. |

---

## 3. What to bank on in the 18–24 month window

**Base case (plan against this):**
- Glamsterdam ships with 8037/8038 roughly end of 2026 / H1 2027. Growth *rate* moderates toward the ~120 GiB/yr target from mid-2027, but **cumulative state keeps climbing** — expect state in the ~450–600 GiB range (Geth state DB terms) by end of window, archive footprints growing 2–5 GB/day throughout.
- Forks slip. Even the Dec 2026 Glamsterdam projection is an estimate; a 3–6 month slip is normal. Size hardware assuming the repricing arrives at the *late* end.

**Upside (do not budget for):** rolling history expiry client-side shaves chain-data on full nodes; Hegotá tunes state-gas further; some structural state work (binary tree) gets scheduled for a 2028 fork. Any of this is gravy.

**Downside (budget for this):** Glamsterdam slips or 8037/8038 parameters are weakened; gas limits rise anyway; growth continues at or above ~120 GiB/yr. Under the EF's aggressive pre-repricing scenarios, state could exceed the 650 GiB bloatnet threshold during your window, which also means **worse sync times and higher IOPS requirements**, not just more TB.

**Bottom line for the budget:** buy storage and IOPS for continued growth. No protocol change in-window reduces what you already store.

---

## 4. What to do in the meantime

1. **Right-size by client, not by protocol hope.** If archive fleet is on Geth hash-based (~20+ TB, ~5 GB/day), migrating to Erigon or Reth (~1.8–4 TB) is a ~5–10× disk reduction *today* — this dwarfs anything the protocol will do for you in-window. Geth's path-based archive (~2 TB, v1.16+) is an option if you need Geth, but note it cannot serve historical `eth_getProof`.
2. **Tier your fleet deliberately.** Head-serving full nodes (pruned, ~650 GB–1.2 TB) behind the RPC gateway; a small archive tier for historical queries. Apply pre-Merge/pre-Cancun history pruning on all full nodes now (300–500 GB each, one-off).
3. **Procure against the downside curve.** Per node: plan ~150–200 GB/yr growth on full nodes and ~2–5 GB/day on archive nodes, with 1.5–2× headroom and pruning-cycle slack. Prioritize IOPS/endurance (TLC NVMe), since state growth degrades access latency before it fills disks.
4. **Shorten sync exposure operationally.** Snapshot-based bootstrap, staggered resyncs, and testing restores — sync time worsens monotonically with state size, and Glamsterdam's repricing won't reverse that.
5. **Track the two decision points, not the roadmap hype.**
   - **Glamsterdam mainnet date + final CPSB parameters** (forkcast.org/upgrade/glamsterdam, ACDE calls): determines when the growth-rate cap actually binds. If it slips past Q1 2027, extend your growth budget accordingly.
   - **Hegotá scoping (starts now):** if a binary-tree/state-expiry EIP moves from Proposed → Scheduled there, that's the earliest credible signal of *structural* relief — realistically a 2028+ event even then.
6. **One upstream watch item:** if you operate gas-estimation/indexing tooling, EIP-8037/8038 breaks hardcoded gas assumptions (separate state-gas dimension; 21,000-gas transfers no longer universal). The EF has explicitly warned wallets/indexers to test on the Platåberget testnet — queue that work before Glamsterdam reaches Sepolia/Hoodi.

---

## Sources (all checked 2026-09-23)

- Forkcast API — EIP fork relationships & upgrade projections: forkcast.org/api/eips/8037.json, /8038.json, /6800.json, /4444.json, /api/upgrades.json, /api/eips.json
- Forkcast ACD call summaries (search-light.json): ACDE #236 (8037 scheduled), Aug 2026 ACD items (8038 scheduled, PBT context in #244), Hegotá headliner status
- EIP-8037 / EIP-8038 specs (status: Review — spec maturity, note this is distinct from fork scheduling)
- EF Blog: "Glamsterdam Repricing Impact for Smart Contract Developers" (2026-08-24); "Partial history expiry" (2025-07-08)
- ethereum.org: Glamsterdam roadmap page (Q4 2026 plan; EIP-8037/8038 "scheduled for inclusion")
- EF/ethresear.ch: "State growth scenarios and the impact of repricings" (Nov 2025 — 650 GiB bloatnet threshold, 686 GiB–1.08 TiB mid-2027 projections, ~205 MiB/day at 36M gas); "Demand Model … Glamsterdam Fee Market Analysis" (Aug 2026)
- Client docs: geth.ethereum.org (archive modes, history pruning), docs.erigon.tech (disk measurements)
- EIP-6800 (Stagnant), EIP-7736 (Stagnant), EIP-4444 (Stagnant), EIP-7927 (History Expiry Meta, Stagnant)
