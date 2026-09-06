# Ethereum State Growth: Technical & Capacity Planning Brief

**Date:** 2026-09-02
**Planning window:** Q4 2026 – Q3 2028 (24 months)
**Audience:** infrastructure engineering + finance
**Bottom line:** Budget for **no protocol-level relief to archive-node disk growth inside this window.** The one scheduled change that touches state growth (EIP-8037, Glamsterdam) is a *rate cap that unlocks a 3x gas-limit increase* — it holds growth roughly flat in exchange for throughput; it does not shrink anything. The structural fixes (binary state tree, statelessness) have **no fork relationship at all** and must not appear in a hardware budget. The large wins available to you are all client-side and available today.

---

## 1. What is actually driving this at the protocol level

### 1.1 Three different growth curves get conflated as "state growth"

Separating these is the single most important thing for capacity planning, because they have different drivers, different sizes, and different fixes.

| Curve | What it is | Driven by | Who pays | Fixed by |
|---|---|---|---|---|
| **A. Active state** | Current accounts + storage slots (the live Merkle Patricia Trie) | *Net new* accounts/slots created | Every full node | Gas repricing (EIP-8037); long-term: state expiry / partial nodes |
| **B. State history** | Per-block historical state (old tries, or reverse diffs) | *Total write volume* per block, not net growth | **Archive nodes only** | Nothing scheduled. Client storage engines only. |
| **C. Chain history** | Blocks, bodies, receipts, logs since genesis | Block/receipt volume | Full + archive nodes | History expiry (EIP-4444 family) — partially shipped |

**Your archive pain is overwhelmingly curve B, and curve B is the one with no protocol fix on the roadmap.** A contract that writes the same storage slot every block adds zero to curve A and adds forever to curve B. This is why archive nodes grow faster than the "Ethereum state grows ~100 GiB/year" figure you'll see quoted — that figure is curve A.

### 1.2 Why the data structure makes it worse

Ethereum stores state in a **hexary Merkle Patricia Trie** with keccak-hashed keys. Three consequences:

1. **Keys are hashed, so insertion order is random.** There is no locality: adjacent accounts in the trie are unrelated in the workload. Every state access is close to a random read on a ~1 TB dataset. This is why archive nodes are IOPS-bound, not throughput-bound, and why NVMe is non-negotiable.
2. **Every write rewrites the whole path to the root.** A single `SSTORE` dirties ~7–8 internal nodes. Write amplification is structural, not a client bug.
3. **Historically, node storage was keyed by node hash.** Under hash-based storage the old trie nodes are never overwritten, so an archive node accumulated *every version of every trie node since genesis*. This is the origin of the 18–20 TB Geth archive number.

Point 3 is the one that has already been solved client-side — see §3.1. Points 1 and 2 are inherent to the MPT and are only fixed by replacing the tree (EIP-7864), which is not scheduled.

### 1.3 State creation has been systematically underpriced

Creating state is charged **once**, but storage is borne **forever, by every node on the network**. Pre-Glamsterdam pricing is also internally inconsistent: contract deployment costs roughly **200 gas/byte** while a storage slot costs roughly **313 gas/byte**, for data with identical permanent cost. EIP-8037's rationale puts the current database growth rate at **~116 GiB/year**.

### 1.4 The gas limit is the multiplier — and it moves without a hard fork

This is the risk factor finance most needs to understand. The block gas limit is **validator-signaled, not fork-gated**. It went 30M → 60M on **2025-11-25**, days before Fusaka, once >50% of validators signaled. It can move again at any time with no upgrade and no notice period.

Scaling today's pricing naively to a 200M gas limit implies roughly **387 GiB/year** of state growth. That number is precisely why EIP-8037 exists: it is a precondition for raising the limit, not a relief measure.

The Ethereum Foundation's 2026 protocol priorities name "continuing to raise the gas limit toward and beyond 100M" as an explicit goal for the Scale track.

### 1.5 Sync time

Archive sync cost is a function of *cumulative* work: re-executing all historical transactions. As the gas limit rises, each new year of chain history costs proportionally more to replay. Sync time therefore degrades faster than disk does. This is the one dimension where Glamsterdam genuinely helps you (§2.3).

---

## 2. What is actually coming — verified status

Status labels below follow Ethereum core-dev convention: **Live** (on mainnet) / **SFI** (Scheduled for Inclusion in a named fork) / **CFI** (Considered) / **PFI** (Proposed) / **No fork relationship** (research or draft only). Note that an EIP's own header status — `Draft`, `Review`, `Final` — describes *specification maturity and says nothing about whether it will ship.* EIP-8037 is only in `Review` status yet is scheduled; EIP-7864 is `Draft` and is scheduled nowhere.

### 2.1 Already live — bank on it

| Change | Status | Effect on you |
|---|---|---|
| **Partial history expiry (EIP-4444 / EIP-7927)** | **Live** (2025, post-Pectra) | Clients may drop **pre-Merge** bodies and receipts: **−300–500 GB** on *full* nodes. Pre-Merge headers still served. **Does not help archive nodes** — an archive node keeps this by definition. |
| **Fusaka (PeerDAS, EIP-7594)** | **Live**, mainnet 2025-12-03 | Blob scaling. Blobs are ephemeral (~18 days) and are *not* state. Relevant only if you separately archive blob data — that is your own storage decision, not a protocol cost. |
| **Gas limit 60M** | **Live** since 2025-11-25 | Your current growth baseline. |

**Important:** rolling / post-Merge history expiry — dropping history on an ongoing basis — is **not scheduled in any fork.** EIP-7927 covers the one-shot pre-Merge drop and is marked **Stagnant**. No history-expiry EIP appears in the Glamsterdam meta-EIP scope. Do not model further history savings.

### 2.2 Glamsterdam — scheduled, but read what it actually does

**Fork status:** in public testnet phase. Sepolia fork targeted **2026-09-28** (still subject to a core-dev vote); mainnet **Q4 2026, date not confirmed**. It has already slipped once — from an original June 2026 goal, through a Q3 target, to Q4. Scope is locked via meta-EIP **EIP-7773** (18 EIPs SFI).

**The state-relevant items, all SFI:**

- **EIP-8037 — State Creation Gas Cost Increase** (spec status: `Review`). Introduces a single **cost-per-state-byte (CPSB) of 1,530 gas**, applied uniformly to bytes of permanent state created, replacing the inconsistent 200/313 gas-per-byte regime. Splits transaction gas into two pools: **execution gas** (capped at the EIP-7825 per-tx limit, ~16.7M) and a **state gas reservoir**; state charges draw from the reservoir first. CPSB was derived to target **120 GiB/year at a 150M reference gas limit.**
- **EIP-7928 — Block-Level Access Lists** (spec status: `Review`). Every block carries a verifiable record of all accounts/slots touched plus post-execution values (~72 KiB compressed average). Enables **parallel disk reads, parallel EVM execution, parallel post-state root computation**, and **state reconstruction without re-executing transactions.** Clients must retain BALs for ≥3,533 epochs (weak-subjectivity period); older ones may be replaced by their Merkle commitments.
- **Gas repricing cluster:** EIP-7778, EIP-7976, EIP-7981 — together with EIP-8037, these are what make a **200M gas-limit floor** safe.

**Read this carefully — the net effect on your disk bill is not a saving:**

Today: ~116 GiB/yr at a 60M limit. After Glamsterdam: ~120 GiB/yr *at a 150M reference limit*, with the ecosystem explicitly targeting a 200M floor. **EIP-8037 converts a runaway growth curve into a bounded one, and immediately spends that headroom on 3x throughput.** Your absolute state growth is roughly flat to modestly worse, not better.

And EIP-8037 governs **curve A only** — net new state. It does nothing for curve B, your archive cost. Higher gas limits mean more writes per block, so **Glamsterdam is directionally negative for archive disk growth.**

### 2.3 The one genuine Glamsterdam win: sync and execution

BALs are a real, scheduled improvement to your worst non-disk problem. Parallel IO + parallel EVM changes archive sync from a serial re-execution slog into a parallelizable one, and "state reconstruction without executing transactions" is directly applicable to rebuilding a node. Do not expect a specific speedup multiple until client teams publish benchmarks, but this is the item worth tracking for your sync-time pain specifically.

### 2.4 Hegotá (2027) — contains nothing for you

**Fork status:** scoping phase; development expected to begin January 2027, indicative target ~mid-2027. Scope tracked by meta-EIP **EIP-8081**. Roughly 66 proposals are competing for inclusion.

**Currently SFI: only two EIPs** — EIP-7805 (FOCIL, censorship resistance) and EIP-8141 (Frame Transaction, native account abstraction). **Neither addresses state or storage.**

**Nothing on state trees, statelessness, or state expiry is even CFI for Hegotá.** The state-adjacent items are all still at **PFI** (proposed, no commitment):

- **EIP-8368** — CPSB recalibration: re-derives EIP-8037's cost-per-state-byte for a higher reference gas limit, aimed at supporting a move toward **600M gas**. Note what this means: the next state-pricing EIP in the pipeline exists to enable *more* throughput while holding growth at target — again, not to reduce your footprint. Parameters are not final.
- EIP-8188 (Last-Written Block for Accounts and Slots) — infrastructure that a future expiry scheme would need; PFI only.
- EIP-7709 (BLOCKHASH from storage), EIP-8198 (Quick Slots), EIP-7807 (SSZ execution blocks) — PFI.

**Planning conclusion:** Hegotá very likely lands inside your window and very likely does nothing for your disk bill.

### 2.5 The structural fixes — do not budget for these

| Proposal | Real status | Why it isn't bankable |
|---|---|---|
| **EIP-7864 — unified binary state tree** | `Draft`, created 2025-01-20. **No fork relationship.** Not SFI or CFI for Glamsterdam or Hegotá. | This is the actual fix for §1.2 — binary tree, ~4x shorter Merkle branches, RLP eliminated, code chunked into the tree, related account data co-located. Design is live and credible. But it is not scheduled anywhere, and shipping it is a two-stage process: freeze the MPT and write only new state into the new tree, *then* a later fork migrates the old data. |
| **EIP-7748 — state conversion** | `Draft`. **No fork relationship.** | The migration half of the above. A months-long, network-wide state conversion that has to follow EIP-7864 by at least one fork. |
| **Verkle trees (EIP-6800)** | **Superseded in practice.** | Ethereum pivoted away from Verkle during 2026 in favour of the binary-tree line — Verkle needs a trusted setup and its elliptic-curve cryptography is not post-quantum secure. If you have older planning docs that assume Verkle, they are stale. Note that this pivot happened *after years of Verkle being treated as near-certain* — a useful calibration on roadmap confidence generally. |
| **EIP-7736 — leaf-level state expiry** | **Stagnant.** | Was Verkle-dependent. |
| **State expiry generally** | **Not on the roadmap as a consensus change.** | Vitalik Buterin has argued against consensus-level state expiry in favour of **partial state nodes** — nodes that voluntarily store only a subset of state, functionally similar but requiring no consensus-layer logic. Note this is an *architectural* answer, not a protocol deliverable: it means the relief mechanism is expected to be "run smaller nodes," which is a fleet-design decision on your side, not something a fork hands you. |

**Realistic earliest path for the structural fix:** EIP-7864 would need to reach CFI, then SFI, then devnets, then a fork; then EIP-7748 migration in a *subsequent* fork; then client maturity for archive workloads. At Ethereum's current cadence of roughly two forks a year, and with EIP-7864 not yet even CFI for the fork that is currently being scoped, the earliest plausible mainnet arrival is **2028+, and production-grade archive support later still.** That is at or beyond the far edge of your 24-month window. **Treat it as zero.**

### 2.6 Confidence summary for finance

| Item | Lands in window (Q4'26–Q3'28)? | Effect on archive disk |
|---|---|---|
| Partial history expiry | **Already live** | **None** (full nodes only) |
| Glamsterdam (EIP-8037, BALs, repricing) | **High confidence** — plan Q4 2026, tolerate Q1 2027 | **Neutral to negative** on disk; **positive** on sync/execution |
| Gas limit → 100M, then 200M | **High confidence** — and can move with no fork | **Negative** — the main disk risk in the window |
| Hegotá (FOCIL, Frame Transaction) | **Moderate–high**, ~mid-to-late 2027 | **None** |
| EIP-8368 (CPSB recalibration) | **Uncertain** — PFI only | Enables *higher* limits; neutral at best |
| Binary tree / statelessness / state expiry | **Do not plan on it** | N/A in window |

---

## 3. What to do in the meantime

The plan below is deliberately built so that **it remains correct whether or not any proposed change ships.** Every item is available today.

### 3.1 Highest-leverage action: eliminate hash-based archive nodes

This is the single biggest lever you have and it requires no protocol change.

| Configuration | Approx. mainnet footprint |
|---|---|
| Geth archive, legacy **hash-based** | **~18–20 TB** |
| Geth archive, **path-based** (v1.16+, stores history as reverse diffs) | **~2 TB** |
| Erigon 3 archive | **~1.8–2.2 TB** |

If any of your archive fleet is still on hash-based storage, that is a **~10x** reduction sitting on the table — larger than anything the protocol will hand you this decade.

**Known limitation to validate before you commit:** under Geth's path-based archive, `eth_getProof` only works for approximately the **last 128 blocks**. If any product surface depends on historical Merkle proofs, that workload needs a different home. Inventory your RPC methods against this constraint *before* migrating, not after.

### 3.2 Tier the fleet — stop running archive for workloads that don't need it

Most "we need an archive node" requirements decompose into things a full node plus your own index can serve. A full node with history expiry is roughly **0.9–1.3 TB** execution + **80–200 GB** consensus + **100–150 GB** blobs.

Sort every workload into:

- **Needs historical state** — `eth_call`/`eth_getBalance`/`eth_getStorageAt` at old blocks, `trace_*`, `debug_traceTransaction`. Genuinely needs archive. This is usually a small minority.
- **Needs historical *data*** — logs, receipts, transactions, balances-over-time. Does **not** need an archive node. Needs an index you own (§3.3).

Then run the **minimum number of true archive nodes** — typically 2–3 for redundancy — rather than scaling archive with load.

### 3.3 Own your extract layer

Export traces, receipts, logs and state diffs once into columnar storage (Parquet on object storage, ClickHouse, or similar) and serve product queries from there. This is the structural move that:

- decouples query capacity from archive-node count, so growth stops being linear in disk;
- makes you immune to whatever the protocol does or doesn't do;
- is far cheaper per query than an archive node;
- protects you from the `eth_getProof` limitation and from future client storage-engine changes.

Every month you defer this, the backfill costs more. Given that the roadmap will not rescue archive economics in the window, this should be treated as the strategic response, not a nice-to-have.

### 3.4 Cold history off the hot path

Use **era/era1 files** for historical chain data, kept on cheap object storage rather than NVMe, and rehydrated on demand. Track the Portal Network as a longer-term option for history serving — Geth's stated direction — but do not make it a dependency yet.

### 3.5 Capacity model to hand to finance

Do **not** hand finance a single growth number. Hand them a driver-based model:

```
archive_growth_per_year ≈ measured_current_growth_rate × (gas_limit / 60M) × workload_factor
```

Steps:

1. **Measure your own baseline.** Take the disk delta on one path-based archive node over 90 days and annualize. Published aggregate figures (~116 GiB/yr) describe curve A; your archive nodes track curve B and will be higher. Use your own number — this is the single most important input and nobody else's figure substitutes for it.
2. **Model three gas-limit scenarios** across the window, since the limit moves without a fork:
   - **Low:** stays 60M.
   - **Base:** 100M during 2027 (explicit EF priority), 200M after Glamsterdam ships and validators signal.
   - **High:** 200M reached during 2027; discussion moves toward 600M (EIP-8368 territory).
3. **Apply no protocol relief in any scenario.** EIP-8037 caps the *rate*, and that cap is spent on the gas-limit increase already in the model — do not double-count it as a saving.
4. **Add a step change, not a slope change, for the client migration** in §3.1 — a one-time ~10x drop if you still have hash-based nodes, then resume the curve.

### 3.6 Procurement guidance

- **Prefer scale-out over monolithic.** Replaceable NVMe with headroom beats a single oversized array, because the dominant uncertainty (gas limit) resolves in discrete jumps you cannot schedule.
- **Buy IOPS, not just capacity.** §1.2 explains why archive workloads are random-read-bound. Under-provisioning IOPS shows up as sync failures, not slow queries.
- **Assume a 2–3 year refresh** and do not pre-buy capacity for a 2028 state size — the client-side storage engine landscape has moved 10x in the last year and may move again.
- **Do not buy hardware sized for the pre-path-based world.** If a quote assumes 18–20 TB per archive node, it is costing a configuration you should be retiring.

### 3.7 Watch list — concrete triggers, not vibes

| Signal | Where | Why it matters |
|---|---|---|
| **Validator gas-limit signaling** | On-chain / gas limit trackers | Moves **without a fork or notice**. Your single largest in-window cost driver. Alert on it directly. |
| **Glamsterdam mainnet date confirmation** | forkcast.org, All Core Devs call summaries | Sepolia target 2026-09-28 is not yet voted; has slipped before. |
| **EIP-8037 devnet state-growth measurements** | ACD calls, client team reports | Tells you whether the 120 GiB/yr target holds in practice before it hits mainnet. |
| **EIP-7864 moving PFI → CFI** | EIP-8081 (Hegotá meta), or the meta-EIP for the following fork | **This is the trigger to revisit this entire brief.** Until then, structural relief stays out of the budget. |
| **EIP-8368 parameters** | forkcast.org/eips/8368 | Signals how aggressively the gas limit will be pushed past 200M. |

---

## 4. Summary for finance in five lines

1. Archive disk growth is driven by *state history* (every write, forever) — a cost the protocol roadmap does not currently address.
2. The next upgrade, **Glamsterdam (Q4 2026, not yet date-confirmed)**, caps state growth only in order to triple the gas limit; it is **neutral-to-negative for archive disk**, though it does improve sync and execution speed.
3. The upgrade after that, **Hegotá (~2027)**, contains **nothing** relevant — only two EIPs are scheduled and neither touches state.
4. The real fix — a **binary state tree** — is **not scheduled in any fork**, needs two forks plus a network-wide migration, and is realistically **2028+**. It must not appear in this budget. Ethereum abandoned the previous version of this same plan (Verkle) after years of it being treated as near-certain.
5. Therefore: **assume zero protocol relief.** The available wins are client-side (**~10x** from path-based/Erigon archive storage), architectural (tier the fleet, own the index), and procedural (model gas-limit scenarios, monitor validator signaling).

---

## Sources checked

Protocol status verified 2026-09-02 against:

- [Forkcast](https://forkcast.org) — upgrade tracker (Glamsterdam, Hegotá); [EIP-8368 page](https://forkcast.org/eips/8368/)
- [EIP-7773: Hardfork Meta — Glamsterdam](https://eips.ethereum.org/EIPS/eip-7773) — authoritative SFI scope
- [EIP-8081: Hardfork Meta — Hegotá](https://eips.ethereum.org/EIPS/eip-8081) — authoritative SFI/CFI/PFI scope
- [EIP-8037: State Creation Gas Cost Increase](https://eips.ethereum.org/EIPS/eip-8037)
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928)
- [EIP-7864: Ethereum state using a unified binary tree](https://eips.ethereum.org/EIPS/eip-7864)
- [EIP-7748: State conversion](https://eips.ethereum.org/EIPS/eip-7748)
- [EIP-7736: Leaf-level state expiry in verkle trees](https://eips.ethereum.org/EIPS/eip-7736) (Stagnant)
- [EIP-7927: History Expiry Meta](https://eips.ethereum.org/EIPS/eip-7927) (Stagnant)
- [Ethereum Foundation — Partial history expiry announcement](https://blog.ethereum.org/2025/07/08/partial-history-exp)
- [Ethereum Foundation — Fusaka mainnet announcement](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement)
- [Ethereum Foundation — Protocol Priorities Update for 2026](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026)
- [ethereum.org — Glamsterdam](https://ethereum.org/roadmap/glamsterdam/)
- [ethereum.org — Statelessness, state expiry and history expiry](https://ethereum.org/roadmap/statelessness/)
- [go-ethereum — Archive mode docs](https://geth.ethereum.org/docs/fundamentals/archive)
- [EIPsInsight — Network Upgrades](https://eipsinsight.com/upgrade)
- [The Block — Ethereum raises block gas limit to 60M](https://www.theblock.co/post/380687/ethereum-block-gas-limit-fusaka)
- [The Defiant — Glamsterdam enters final devnet phase with 200M gas-limit target](https://thedefiant.io/news/blockchains/ethereum-glamsterdam-final-devnet-200m-gas-limit-target)
- [crypto.news — Hegotá narrows 2027 upgrade proposals](https://crypto.news/ethereum-hegota-narrows-2027-upgrade-proposals/)
- [Chainstack — Erigon vs Geth in 2026](https://chainstack.com/ethereum-clients-geth-and-erigon/)

**Caveat on figures:** EIP-derived numbers (CPSB 1,530 gas; 116 GiB/yr current; 120 GiB/yr target at 150M; 387 GiB/yr naive at 200M) are quoted from EIP-8037 itself. Node footprint figures (2 TB path-based archive, 1.8–2.2 TB Erigon, 0.9–1.3 TB full) are community/vendor measurements and vary with client version, prune settings and workload — **validate against your own fleet before committing budget.** The gas-limit scenarios in §3.5 are planning constructs, not forecasts.
