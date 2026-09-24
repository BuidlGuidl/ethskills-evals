# Ethereum State Growth: Technical & Capacity Planning Brief

**Prepared:** 2026-09-23
**Planning window:** Q4 2026 – Q3 2028 (~24 months)
**Audience:** infrastructure team + finance
**Verification basis:** every protocol claim below was checked against the EIP text in `ethereum/EIPs` and the hardfork meta EIPs on 2026-09-23. Current mainnet gas limit confirmed live at 60,000,000 (block 26,038,838). Sources listed at the end.

---

## 0. Executive summary (for finance)

1. **State growth is a protocol-level design consequence, not a client bug.** No client-side tuning removes it.
2. **The only state-growth relief with a committed fork slot is gas repricing** (EIP-8037 / EIP-8038 in Glamsterdam). It is a *rate limiter*, not a reduction — it does not shrink anything you already store.
3. **That relief arrives bundled with the thing that makes your costs worse**: Glamsterdam's real purpose is to unlock a gas-limit increase from 60M toward 150–200M. Execution throughput roughly triples. Your *archive and index* volume scales with throughput even if state growth is held near its current absolute rate.
4. **The structural fixes — binary state tree, statelessness, state expiry, full rolling history expiry — have no fork relationship at all.** Not scheduled, not even formally proposed for the next fork. **Budget as if none of them land inside the window.** They are not a cost-avoidance line item.
5. **Recommendation:** stop treating "a fleet of monolithic archive nodes" as the product. Move the serving layer to your own columnar index, keep a minimal canonical archive tier for backfill, buy hardware on 18–24 month cycles with IOPS/endurance headroom, and re-run the capacity model at four named trigger events (§5.3).

---

## 1. What actually drives state growth at the protocol level

### 1.1 Three different things get called "state"

Conflating them is the single most common source of bad capacity models. They grow for different reasons and are relieved by different mechanisms.

| Layer | What it is | Who needs it | Growth driver |
|---|---|---|---|
| **State** (current) | Balances, nonces, code, storage slots as of the chain tip | Every full node | Net *new* accounts and storage slots |
| **History** | Headers, block bodies, receipts | Only nodes serving old data / p2p sync | Every block, forever, proportional to throughput |
| **Archive** (historical state) | State at *every* past block, or the diffs to reconstruct it | Only you and other data providers | Per-block state *diff* volume × number of blocks |

Your pain is concentrated in the third row, and the third row is driven by **write churn**, not by the size of current state. A block that repeatedly overwrites the same 10,000 slots adds ~nothing to current state and adds a full diff to the archive, every block, forever.

### 1.2 The storage structure itself

Ethereum's state is a **Merkle-Patricia Trie (MPT)** — in practice, a *tree of trees*: one account trie, plus a separate storage trie per contract. Three properties of that design create the operational cost:

- **Keccak-hashed keys.** Trie position is `keccak256(address)` / `keccak256(slot)`. Adjacent-in-application data lands at random positions in the trie, so a logically local write is a random-order disk write. There is no locality to exploit.
- **Node amplification.** Adding one leaf rewrites every intermediate node on the path to the root. A single new storage slot is not 64 bytes on disk — it is 64 bytes plus a chain of rewritten branch nodes, and in a naive layout *every one of those rewritten nodes is a new historical version*.
- **RLP encoding + Keccak.** Cheap to verify, hostile to proving, and the reason the whole structure is slated for eventual replacement (§3.3).

Client layouts differ in how they absorb this. Diff-based / flat-storage designs (Erigon, Reth) store a flat current state plus change-sets, which is dramatically better for archive than storing full trie versions. That choice is yours, not the protocol's, and it is the biggest lever you control today.

### 1.3 The measured numbers

From the EIP-8037 motivation section (authored by EF protocol researchers, and the analysis the repricing parameters are derived from):

- Geth state DB: **~390 GiB as of January 2026**.
- Gas limit 30M → 60M caused daily new state to go from **~105 MiB/day to ~326 MiB/day** — a **3× jump from a 2× gas increase**. The response was superlinear because it reflected a one-off behavioural shift, not a fixed ratio.
- That rate is **~116 GiB/year** of new current state.
- Extrapolated proportionally to a **200M gas limit: ~387 GiB/year**.
- EIP-8037 names **650 GiB as the threshold at which nodes begin experiencing performance degradation**. At 200M gas with no repricing, that threshold is breached **in under a year** from the 390 GiB starting point.

That 650 GiB figure is the number to put in front of finance. It is the EF's own stated degradation point for full nodes, and it is the trigger condition for the repricing work.

### 1.4 Why sync times get worse faster than disk does

Two compounding effects:

- **State sync is random-read bound against a structure that is growing.** Time to sync scales worse than linearly with state size because the working set stops fitting in page cache.
- **Archive rebuild scales with history length × per-block diff size**, and both terms are growing. Every gas-limit increase raises the second term permanently.

This is why "just buy a bigger disk" fails: capacity is the cheap part. Random IOPS, page-cache pressure, and NVMe write endurance are what actually bind.

---

## 2. What is coming to the protocol — status-classified

Terminology, per EIP-7723: **SFI** = Scheduled for Inclusion (committed to a named fork). **CFI** = Considered (not committed). **PFI** = Proposed (no commitment whatsoever). **DFI** = Declined. Note that an EIP's *status field* (Draft / Review / Final) describes specification maturity and says **nothing** about whether it will ship.

### 2.1 Live on mainnet today

| Change | Status | Effect on you |
|---|---|---|
| **Partial history expiry (pre-merge)** | **Live** since the May 2025 "drop day" rollout; supported by Geth, Nethermind, Besu, Erigon | **~300–500 GB freed per node.** If your fleet is not running this, it is free money on the table. |
| **Fusaka** (mainnet 2025-12-03, epoch 411392) | **Live** | PeerDAS (EIP-7594) + blob capacity ramps. Relieves **blob/bandwidth**, not state or disk. Do not credit it against state growth. |
| Gas limit 60M | **Live** (verified at block 26,038,838) | Already the source of the 3× daily-state jump described above. |

**Important caveat on history expiry:** EIP-7927 (the History Expiry Meta EIP) is marked **Stagnant**. The pre-merge drop happened; the process EIP around it stopped being maintained. Pre-merge data lives in e2store archives published via the `eth-clients` historical endpoints list. **Keep your own pinned copy.** Do not assume the p2p network or a third party will serve it to you on demand.

### 2.2 Glamsterdam — committed, but not yet dated on mainnet

Per **EIP-7773 (Hardfork Meta – Glamsterdam)**:

- **Sepolia activation: epoch 353024, 2026-10-06 13:53:36 UTC.**
- **Hoodi: tentatively discussed for 2026-10-27** on the 2026-09-17 ACD consensus call.
- **Mainnet: blank in the meta EIP.** No epoch, no timestamp. Client teams are working to a **Q4 2026 window**, but Glamsterdam has **already slipped twice** — Sepolia was originally targeted for 2026-08-03, and the original mainnet aim was May 2026.

**Plan for mainnet Glamsterdam between December 2026 and Q2 2027.** Treat Q4 2026 as optimistic. Do not build a hardware refresh that is only viable if Glamsterdam lands on time.

SFI items that matter to you:

| EIP | What it does | Why you care |
|---|---|---|
| **EIP-8037 — State Creation Gas Cost Increase** | Introduces `CPSB` (cost per state byte) = 1530, harmonizes state-creation pricing across contract deployment / new slots / new accounts, and meters state creation as a **separate gas dimension**. Parameters are derived to target **~120 GiB/year average state growth at a reference 150M gas limit**. | **This is the only committed state-growth brake in existence.** It caps the *rate*, at a level roughly equal to today's absolute rate — while throughput goes up ~2.5×. |
| **EIP-8038 — State-access gas cost update** | `COLD_ACCOUNT_ACCESS` 2600 → 3000 (+15%); introduces explicit `ACCOUNT_WRITE` / `STORAGE_WRITE` surcharges; charges `EXTCODESIZE`/`EXTCODECOPY` for their second DB read. | Prices reads closer to real cost. Mildly suppresses state-heavy workloads. **Changes gas costs for your own deployments and any gas estimation in your products — needs regression testing.** |
| **EIP-7928 — Block-Level Access Lists** | Enforced per-block access lists with post-execution values, hashed into the header. Enables parallel disk reads, parallel execution, parallel state-root computation, and **state reconstruction without executing transactions**. | The prerequisite that unlocks the higher gas limit. Also genuinely useful to you: BALs are a machine-readable state-diff feed straight out of the protocol. Evaluate them as an ingestion source. |
| **EIP-8189 — snap/2 BAL-based state healing**, **EIP-8159 — BAL exchange**, **EIP-7975 — eth/70 partial block receipt lists** | Networking changes built on BALs | **Sync paths change materially.** Client sync performance will re-rank after Glamsterdam. Re-benchmark; do not assume today's client choice stays optimal. |
| **EIP-7708 — ETH transfers emit a log** | Every value-transferring tx / `CALL` / `SELFDESTRUCT` / `CREATE` emits an ERC-20-shaped `Transfer` log from `SYSTEM_ADDRESS` | **Direct cost reduction for you.** ETH flows become indexable via normal log subscription instead of `debug_trace*`. Tracing is the most expensive thing an archive node does. Applies to post-activation blocks only — historical ETH flows stay trace-derived. |
| **EIP-7732 — ePBS**, **EIP-8261 — Gas Limit Schedule** (Informational) | ePBS restructures block production; EIP-8261 adds an epoch-keyed `GAS_LIMIT_SCHEDULE` in the CL config, mirroring `BLOB_SCHEDULE` | **This is the mechanism by which the gas limit will be raised in coordinated steps.** Once live, the schedule file is your single best early-warning signal for capacity planning. Watch it. |
| EIP-7954 (larger max contract size), EIP-7976 (calldata floor cost), EIP-7981 (access list cost), EIP-2780 (resource-based intrinsic gas) | Supporting repricings | Second-order; folded into the model via the gas-limit assumption. |

### 2.3 Hegotá — the fork after Glamsterdam

Per **EIP-8081 (Hardfork Meta – Hegotá)**, status Draft, **no activation epochs set for any network**:

- **Scheduled for Inclusion — exactly two items:** EIP-7805 (FOCIL, consensus-layer headliner) and EIP-8141 (Frame Transaction, execution-layer headliner — native account abstraction / post-quantum signature path).
- **Neither headliner addresses state growth.** Of ~66 candidates in the August 2026 scoping round, only those two are SFI; roughly 50 sit at PFI.
- **Considered for Inclusion:** EIP-8015 only.

State-relevant items at **PFI — meaning no commitment, do not plan on them**:

- **EIP-8368 — CPSB Recalibration for New Gas Limit.** Explicitly a **placeholder EIP**: the new reference gas limit and re-derived `CPSB` are *"still to be determined."* Exists because EIP-8037's parameters are pinned to a 150M reference and will need re-deriving if the limit goes higher.
- **EIP-8372 — Normalized state gas limit.** Fixes a real failure mode in EIP-8037: if state demand is *higher* than assumed, state gas becomes the block bottleneck and suppresses execution gas; if *lower*, less state is created than the target allows. A one-time recalibration at the fork boundary.
- EIP-3298 (removal of refunds), EIP-7709 (read `BLOCKHASH` from storage), EIP-7668 (**remove bloom filters**), EIP-8304 (trustless log and transaction index).

**EIP-7668 deserves a flag:** removing bloom filters would break any pipeline relying on header bloom filters for log pre-filtering. It is only PFI, but it is a reason to own your own log index rather than depend on `eth_getLogs` bloom scanning.

**Declined for Hegotá**, and this is the most informative signal in the whole document:

- **EIP-7862 (Delayed State Root) — DFI.** Proving-preparation work, deferred.
- **EIP-8188 (Last-Written Block for Accounts and Slots) — DFI**, explicitly *awaiting the trie-migration design*.

EIP-8188 is the kind of per-object write-timestamp accounting that any state-expiry scheme needs. It was declined because the trie migration it depends on **does not yet have a settled design**.

### 2.4 The structural fixes — no fork relationship

| Proposal | Actual status | Verdict |
|---|---|---|
| **EIP-7864 — unified binary state tree** | **Draft. Not in EIP-7773 (Glamsterdam). Not even in the Proposed list of EIP-8081 (Hegotá).** The spec text still states **the hash function is not final** — BLAKE3 is a placeholder to reduce client friction; Keccak and Poseidon2 remain candidates, with Poseidon2 pending an ongoing EF cryptography security assessment. | **Zero fork relationship.** An EIP whose hash function is undecided is years from a migration. |
| **Statelessness / witness gas schedule** | Research. Carried over from the Verkle line of work. | No fork relationship. |
| **State expiry** | Research only. No EIP with a fork relationship. Its accounting prerequisite (EIP-8188) was just declined pending trie design. | No fork relationship. |
| **EIP-4444 full rolling history expiry** (`HISTORY_PRUNE_EPOCHS`, rolling window) | **Draft**, category Networking. The *pre-merge* slice shipped (§2.1); the rolling window did not. Its process meta EIP (7927) is **Stagnant**. | No fork relationship. The intermediate step shipped; the full mechanism did not. |
| **EIP-7999 — unified multidimensional fee market** | Draft. Described in EIP-8372 as "the longer-term direction." | No fork relationship. |

**Note on Verkle:** the Verkle line is superseded. The elliptic-curve commitments Verkle depends on are quantum-vulnerable, and the roadmap moved to binary trees with a proving-friendly hash. Any vendor, deck, or article dated before 2025 that tells you Verkle is coming is stale — ignore it.

---

## 3. How much can you bank on, and when

### 3.1 The asymmetry that should drive the budget

The mental model to reject is *"relief is coming, so costs flatten."* The accurate model is:

> **The relief and the cost increase are the same event.** EIP-8037/8038 exist *specifically* to make a gas-limit increase safe. They ship together. You get the repricing *and* ~2.5–3× the throughput.

Concretely, for state:

- Today: ~116 GiB/year at 60M gas.
- EIP-8037's design target: **~120 GiB/year at a 150M reference gas limit.**

Current-state growth is therefore engineered to stay **roughly flat in absolute GiB/year** across a 2.5× throughput increase. That is a genuine engineering achievement and it is **not a cost reduction for you**. Two further caveats:

- The target is an *average*, enforced by pricing, not a hard cap. Demand elasticity is the uncertain term — which is exactly why EIP-8372 exists and is only PFI.
- If the limit goes to 200M rather than 150M, `CPSB` is under-calibrated until EIP-8368 lands — and EIP-8368 is a placeholder with TBD parameters at PFI. **There is a live gap here**, and it falls inside your planning window.

For archive and history, there is no equivalent brake at all:

> **Receipts, logs, traces, and per-block state diffs scale with execution throughput. Nothing in Glamsterdam or Hegotá limits them. A 2.5–3× gas limit increase means ~2.5–3× archive growth rate.**

This is the finance headline. State is being held roughly flat. **Your archive tier is the line item that accelerates.**

### 3.2 Bankability table

| Item | Bank on it? | Reasoning |
|---|---|---|
| Pre-merge history expiry (~300–500 GB/node) | **Yes — available today** | Live, all clients |
| Glamsterdam repricing (EIP-8037/8038) landing in-window | **Yes, with date risk** | SFI in EIP-7773; Sepolia dated; mainnet blank; two prior slips. Assume Dec 2026 – Q2 2027 |
| Gas limit rising to 150–200M in-window | **Yes — plan for the cost, not the relief** | The stated purpose of the Glamsterdam work; EIP-8261 provides the coordination mechanism |
| EIP-7708 reducing your trace workload | **Yes, post-activation blocks only** | SFI in EIP-7773 |
| CPSB recalibration (EIP-8368) / normalized state limit (EIP-8372) | **No** | PFI for Hegotá; EIP-8368 is an explicit placeholder with TBD values |
| Hegotá landing in-window at all | **Partially** | No activation epochs set on any network; ~1 fork/year cadence puts it late 2027 at the earliest |
| Binary state tree (EIP-7864) | **No** | No fork relationship; hash function undecided |
| Statelessness | **No** | Research |
| State expiry | **No** | Research; its prerequisite was just declined |
| Full rolling EIP-4444 | **No** | Draft, no fork relationship, process EIP stagnant |

### 3.3 Why the structural fixes cannot land in 24 months

Even under the most optimistic assumption — a trie-migration design settles and gets a headliner slot in the fork *after* Hegotá — the sequence is: design freeze → spec → multi-client implementation → devnets → testnets → mainnet fork → **then** a state migration requiring an overlay strategy (old trie frozen, new writes accruing to the binary tree) and preimage handling to rebuild keys. At the current cadence of roughly one fork per year, mainnet activation is **2028 at the absolute earliest**, and archive-node relief comes *after* migration completes, not at fork activation.

**Any financial model that books savings from statelessness, state expiry, or the binary tree inside this window is wrong.** Remove those lines.

---

## 4. What to do in the meantime

### 4.1 Immediate (this quarter, no protocol dependency)

1. **Enable pre-merge history expiry fleet-wide.** ~300–500 GB per node, available now. Simultaneously, **pull and pin your own copy of the pre-merge e2store archives** to object storage. The data is available via the `eth-clients` historical data endpoints; EIP-7927 is stagnant and nothing obliges anyone to keep serving it.
2. **Instrument growth per tier.** You cannot model what you don't measure. Track, separately and daily: current-state bytes, per-block diff bytes, receipt/log bytes, and trace-derived index bytes. The protocol targets are expressed in these units; your invoices currently are not.
3. **Audit what actually requires an archive node.** In most data companies the honest answer is "a minority of queries, all of which could be served from an index." Everything served from your own index is insulated from every protocol decision discussed in this brief.

### 4.2 Architecture (the real lever)

4. **Stop scaling monolithic archive nodes. Split into three tiers:**
   - **Canonical archive tier** — a *small* number of nodes, for backfill and re-derivation only. Not on the serving path.
   - **Tip-following full nodes** — history expiry on, sized to current state, horizontally scalable, serving live RPC.
   - **Columnar index** (ClickHouse / Parquet on object storage) — the actual serving layer for historical queries.

   This is the only structural move that decouples your cost curve from the protocol's. Backfill becomes a **one-time cost** rather than a per-node recurring one, and node count then scales with *query load*, not with *history length*.

5. **Use a diff-based archive client** (Erigon / Reth) rather than any full-trie-per-block layout. **Re-benchmark Reth vs Erigon against your workload now, and again after Glamsterdam hits Sepolia** — EIP-8189 (BAL-based state healing), EIP-8159, and EIP-7975 change the sync and healing paths, and relative client performance will re-rank.

6. **Evaluate BALs (EIP-7928) as an ingestion source.** Post-Glamsterdam they give you an enforced, header-committed, post-execution state diff per block, and support state reconstruction without re-execution. That is close to exactly what your indexing pipeline currently derives expensively via tracing.

7. **Plan the EIP-7708 migration.** Post-activation, ETH transfers are ERC-20-shaped logs from `SYSTEM_ADDRESS`. Design the pipeline to switch to log-based ETH flow at the activation block and fall back to traces below it. Retiring trace-based ETH-flow extraction for new blocks is one of the few genuine unit-cost reductions in this brief — take it.

8. **Own your log index; don't depend on header blooms.** EIP-7668 (remove bloom filters) is only PFI, but the direction of travel is clear and the mitigation is something you want anyway.

### 4.3 Hardware and procurement

9. **Buy for random IOPS and write endurance, not capacity.** Capacity is the cheapest term. DWPD and sustained random-read latency are what bind. Size the state working set at **2× current** and check that it stays within page cache on your chosen SKU.
10. **Scale out, not up.** More smaller nodes sharded by block range / workload, so a gas-limit increase is absorbed by *adding nodes* rather than forklifting big boxes. A 3× throughput event should be a purchase order, not a re-architecture.
11. **18–24 month lease terms, not 36–48.** The protocol's storage model has a plausible structural change beyond this window (binary tree) whose hardware implications — a proving-friendly hash, code in the state tree, different access patterns — are genuinely unknown today. Do not lock in past the uncertainty.
12. **Take no capacity commitment or vendor discount that is only economic if protocol relief arrives.** Per §2.4, none of it is scheduled.

### 4.4 Re-forecast triggers

Re-run the capacity model when any of these fire:

- **Glamsterdam mainnet epoch published** in EIP-7773's activation table (currently blank).
- **`GAS_LIMIT_SCHEDULE` entries appear** in the CL `config.yaml` per EIP-8261 — this is your earliest hard signal of where the limit is actually going and when.
- **EIP-8368 gets real parameters** (currently TBD) or moves from PFI to CFI/SFI — tells you whether the state brake is being recalibrated for the higher limit.
- **A trie-migration design gets a headliner slot** for the post-Hegotá fork. Only *then* does structural relief enter the forecast — and even then, not for 2+ years.

---

## 5. Scenario model for finance

State growth per year, using EIP-8037's own figures. Archive/index growth is the separate, faster-moving term.

| Scenario | Gas limit | New current state /yr | Archive & index growth rate |
|---|---|---|---|
| **A — Status quo holds** (Glamsterdam slips past window) | 60M | ~116 GiB | ~1× today |
| **B — Glamsterdam lands, limit → 150M** (central case) | 150M | **~120 GiB** (EIP-8037 design target) | **~2.5× today** |
| **C — Limit → 200M, CPSB recalibration lands** | 200M | ~120–160 GiB | ~3.3× today |
| **D — Limit → 200M, recalibration does *not* land** (EIP-8368 is a TBD placeholder at PFI) | 200M | **~387 GiB** (unbraked extrapolation) | ~3.3× today |

**Plan to B. Ensure you survive D.** Scenario D is not a tail risk invented for this document — it is the exact failure mode EIP-8368 and EIP-8372 were written to prevent, and both are uncommitted placeholders. Under D, a full node starting at ~390 GiB crosses the **650 GiB degradation threshold in under a year**.

Note that the archive column moves in every scenario where Glamsterdam ships, **including the ones where state growth is successfully held flat**. That is the core finding of this brief.

---

## 6. Sources

All checked 2026-09-23.

- [EIP-7773: Hardfork Meta – Glamsterdam](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7773.md) — SFI list; Sepolia epoch 353024 / 2026-10-06; mainnet row blank
- [EIP-8081: Hardfork Meta – Hegotá](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8081.md) — SFI/CFI/PFI/DFI lists; no activation epochs
- [EIP-8037: State Creation Gas Cost Increase](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8037.md) — CPSB=1530; 390 GiB state; 105→326 MiB/day; 650 GiB threshold; 387 GiB/yr at 200M
- [EIP-8038: State-access gas cost update](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8038.md)
- [EIP-7928: Block-Level Access Lists](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7928.md)
- [EIP-7708: ETH transfers emit a log](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7708.md)
- [EIP-8261: Gas Limit Schedule](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8261.md)
- [EIP-8368: CPSB Recalibration](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8368.md) — explicit placeholder, TBD parameters
- [EIP-8372: Normalized state gas limit](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8372.md) — EIP-8037 failure modes
- [EIP-7864: Unified binary tree](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7864.md) — Draft; hash function not final
- [EIP-4444: Bound Historical Data](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-4444.md) — Draft
- [EIP-7927: History Expiry Meta](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7927.md) — **Stagnant**
- [EIP-7999: Unified multidimensional fee market](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7999.md) — Draft
- [EF Blog: Partial history expiry announcement](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [EF Blog: Fusaka mainnet announcement](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement) — epoch 411392, 2025-12-03
- [EF Blog: The Hegotá EIP Opinion Post and Tier List](https://blog.ethereum.org/2026/09/07/protocol-hegota-eips) — headliners; EIP-8188 declined pending trie-migration design
- [EF Blog: Glamsterdam Repricing Impact for Smart Contract Developers](https://blog.ethereum.org/2026/08/24/glamsterdam-repricing-testing) — repricing regression testing
- [forkcast.org](https://forkcast.org) — upgrade tracker
- ACD consensus call 2026-09-17 (Sepolia 2026-10-06, Hoodi tentatively 2026-10-27), as reported by [CryptoPotato](https://cryptopotato.com/ethereum-targets-october-6-for-glamsterdam-sepolia-fork/) and [ForkLog](https://forklog.com/en/ethereum-developers-set-tentative-date-for-glamsterdam-activation-on-sepolia-testnet/)
- Live mainnet gas limit 60,000,000 verified at block 26,038,838 via public JSON-RPC, 2026-09-23
