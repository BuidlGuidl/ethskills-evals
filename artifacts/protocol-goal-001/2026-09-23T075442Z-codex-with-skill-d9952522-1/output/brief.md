# Ethereum state growth: protocol status and 18-24 month operating plan

Date: 2026-09-23

## Executive summary

For capacity planning, assume **no protocol-level reduction in archive-node state footprint inside the next 18-24 months**. The relief that is either live or scheduled mostly helps full nodes, sync mechanics, or future growth pressure; it does not make historical state archives materially smaller by itself.

What we can bank on:

- **Client-side storage improvements are real and usable today.** Erigon archive mode and Geth path-based archive mode are the practical levers for disk footprint, sync time, and recovery architecture.
- **Partial history expiry is live in execution clients**, and can save hundreds of GB for ordinary full nodes by removing old block bodies/receipts. It does **not** remove current state, and it does **not** solve archive-state growth for companies whose product depends on historical state queries.
- **Glamsterdam is the near fork to watch.** Forkcast lists Glamsterdam as upcoming with a working projected activation of 2026-12-02, and recent ACD notes set Sepolia for 2026-10-06 and Hoodi tentatively for 2026-10-27. Several state-related EIPs are scheduled there, especially gas repricing for state creation/access and block-level access lists. Treat this as likely but still subject to final testnet/client outcomes.

What not to budget against:

- **Verkle trees, binary-tree transition, state expiry, and true statelessness are not scheduled for a named fork as of today.** They remain important roadmap work, but they are not dependable capacity relief inside the planning window.
- **EIP-4444/full rolling history expiry is not a state solution.** It is about old chain history, not archive state. Forkcast shows no fork relationship for EIP-4444; the EF says full rolling history expiry work is ongoing.

Recommended finance stance: fund the next 24 months as if archive state keeps growing at your observed post-2025 fleet rate, with no protocol credit applied. Treat any savings from client upgrades, pruning policy, or Glamsterdam repricing as upside, not as a budget assumption.

## What is driving this at the protocol level

Ethereum's execution layer stores state in Merkle Patricia tries. The block header commits to a `stateRoot`, and ethereum.org documents one global state trie keyed by `keccak256(address)`, whose account value is `[nonce, balance, storageRoot, codeHash]`; each contract account then has its own storage trie for contract storage. The execution layer also uses tries for transactions and receipts. Source: ethereum.org, "Merkle Patricia Trie" (<https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie>).

Operationally, that means:

- The current state grows when new accounts, contract code, and non-zero storage slots are created.
- A normal full node only needs the latest state plus a short reorg window. ethereum.org describes full nodes as keeping recent states, while older states can be re-derived by replaying history.
- An archive node keeps historical states so it can answer queries like past balances/storage without replaying large ranges. That is the core disk tradeoff: fast historical query service in exchange for retaining far more state/history data.
- The trie structure itself creates storage and IO overhead beyond raw account/slot values. Updating or proving a small logical value may involve multiple trie nodes and database reads. This is why state growth hurts disk, sync, compaction, and random-read latency at the same time.

Archive-node size is now strongly implementation-dependent. Geth documents legacy hash-based archive nodes as retaining every account/storage slot plus trie nodes at every block; mainnet can exceed 20 TB and sync from genesis can take months. Geth's newer path-based archive mode stores reverse state diffs and indexes, and its docs show roughly 2.17 TiB in a mainnet database inspection, or around 2 TB for full flat state history without historical trie proofs. Erigon's current docs show Ethereum mainnet archive usage of 2.03 TB as of 2026-07-19, with a 4 TB recommended disk, and emphasize NVMe/SSD latency over raw throughput. Sources: Geth archive docs (<https://geth.ethereum.org/docs/fundamentals/archive>), Erigon hardware docs (<https://docs.erigon.tech/get-started/hardware-requirements>), Erigon database docs (<https://docs.erigon.tech/fundamentals/database>).

The practical implication is that "archive node" is no longer one storage product. You need to distinguish:

- historical flat state queries,
- historical Merkle proof support via `eth_getProof`,
- transaction/receipt/log indexes,
- traces/debug APIs,
- consensus-layer history,
- raw block/blob history,
- application-specific derived indexes.

Those features have very different storage curves and should be budgeted separately.

## Protocol changes and how much to bank on them

### Live

**Pectra and Fusaka are live.** Forkcast lists Pectra as live on 2025-05-07 and Fusaka as live on 2025-12-03. Fusaka's meta-EIP is EIP-7607. These upgrades did not remove archive-state obligations. Sources: Forkcast upgrades API (<https://forkcast.org/api/upgrades.json>), EIP-7607 (<https://eips.ethereum.org/EIPS/eip-7607>).

**Partial history expiry is live at the client level.** The EF announced on 2025-07-08 that all Ethereum execution clients support partial history expiry in accordance with EIP-4444, saving roughly 300-500 GB by removing pre-Merge block data. This helps ordinary full nodes fit on smaller disks. It does not change current state handling, and the EF explicitly notes that historical state queries still require archive-node style data. Source: EF partial history expiry announcement (<https://blog.ethereum.org/2025/07/08/partial-history-exp>).

Planning value: **bank modest savings for non-archive full nodes; do not bank archive-state savings.**

### Scheduled for inclusion: Glamsterdam

Forkcast lists Glamsterdam as "Upcoming" with projected activation 2026-12-02. Recent ACDC notes from 2026-09-17 say Glamsterdam devnet-11 activated cleanly, Sepolia is set for 2026-10-06, Hoodi is tentatively 2026-10-27, and client releases were targeted by 2026-09-29. This is close enough to track operationally, but still not mainnet-final until clients and testnets pass. Sources: Forkcast upgrades API, ACDC #187 artifacts (<https://forkcast.org/artifacts/acdc/2026-09-17_187/tldr.json>).

Relevant scheduled items:

- **SFI: EIP-7928, Block-Level Access Lists.** Forkcast marks it scheduled for Glamsterdam and as the headliner. The EIP records all accounts/storage locations accessed during block execution plus post-execution values, enabling parallel disk reads, parallel validation/state-root work, and state reconstruction without re-executing transactions. This is operationally important for sync and execution performance, but it is not an archive shrink by itself. Source: Forkcast EIP 7928 (<https://forkcast.org/api/eips/7928.json>), EIP-7928 spec (<https://forkcast.org/eips/7928.md>).
- **SFI: EIP-8037, State Creation Gas Cost Increase.** Forkcast marks it scheduled for Glamsterdam. The spec targets average state growth of 120 GiB/year at a 150M gas reference limit and reprices state creation. Its motivation notes that after the gas limit rose from 30M to 60M, observed daily new state rose from about 105 MiB to 326 MiB, about 116 GiB/year. This is the clearest near-term protocol attempt to slow future state growth. It does not delete existing state. Source: Forkcast EIP 8037 (<https://forkcast.org/api/eips/8037.json>), EIP-8037 spec (<https://forkcast.org/eips/8037.md>).
- **SFI: EIP-8038, State-access gas cost update.** Forkcast marks it scheduled for Glamsterdam. It raises some state-access/write costs to better match larger-state performance and updates SSTORE/account-write pricing. This should align gas pricing with resource usage, but it is not a storage-reduction mechanism. Source: Forkcast EIP 8038 (<https://forkcast.org/api/eips/8038.json>), EIP-8038 spec (<https://forkcast.org/eips/8038.md>).
- **Networking: EIP-8189, snap/2 BAL-based state healing.** Forkcast marks this as "Networking" under Glamsterdam rather than core SFI. It replaces trie-node healing with block-access-list-based catch-up for post-Glamsterdam blocks. This could improve sync reliability and reduce round trips, but it depends on BAL availability and applies to post-Glamsterdam blocks within the BAL retention period. Source: Forkcast EIP 8189 (<https://forkcast.org/api/eips/8189.json>), EIP-8189 spec (<https://forkcast.org/eips/8189.md>).

Planning value: **bank no disk reduction; cautiously bank some sync/performance improvements after client maturity; model EIP-8037/8038 as growth-rate dampeners only after mainnet activation and after observed fee/user behavior stabilizes.**

### Considered/proposed for Hegota, but not capacity relief

Forkcast lists Hegota as planning, with projected activation 2027-06-16. Recent ACD notes show Hegota scoping is still moving: EIP-8141 is the headliner, EIP-8015 is CFI, and many proposals were DFI'd. Several state-adjacent proposals, including EIP-7862 delayed state root and EIP-8188 last-written block metadata, were declined for Hegota on ACDE #245. Sources: Forkcast upgrades API, ACDE #245 artifacts (<https://forkcast.org/artifacts/acde/2026-09-10_245/tldr.json>), ACDC #187 artifacts.

Planning value: **do not budget for Hegota as state-storage relief.** It may bring useful execution/client changes, but as scoped today it is not a committed archive-footprint fix.

### No fork relationship: important roadmap work, not a planning dependency

**EIP-4444 full rolling history expiry.** EIP-4444 is Draft and Forkcast shows no fork relationship. It prunes old block/receipt history from execution clients after a retention window, not state. It also affects data availability for applications that serve historical blocks, receipts, logs, and L2 calldata history. Source: EIP-4444 (<https://eips.ethereum.org/EIPS/eip-4444>), Forkcast EIP 4444 (<https://forkcast.org/api/eips/4444.json>).

**Verkle/state-tree transition.** EIP-6800, unified Verkle state, is Stagnant in Forkcast and has no fork relationship. The ethereum.org roadmap describes Verkle/statelessness as a path toward smaller witnesses and easier stateless clients, but not as a scheduled mainnet event. Source: EIP-6800 (<https://eips.ethereum.org/EIPS/eip-6800>), Forkcast EIP 6800 (<https://forkcast.org/api/eips/6800.json>), ethereum.org statelessness roadmap (<https://ethereum.org/roadmap/statelessness/>).

**Binary tree / state expiry variants.** EIPs such as EIP-7864, EIP-8295, EIP-8296, and EIP-7736 are draft/stagnant/proposal-stage items with no named-fork commitment in Forkcast. They are worth tracking because they point to the likely direction of state architecture, but they are not capacity-planning inputs yet.

Planning value: **track quarterly; assign 0% probability-adjusted disk relief inside the 18-24 month hardware budget unless they move to SFI for a named fork.**

## Operating plan for the next 18-24 months

### 1. Separate products by data guarantee

Inventory every internal and customer-facing query path and classify it:

- needs historical account/storage value only,
- needs historical `eth_getProof`,
- needs traces/debug replay,
- needs logs/receipts/transactions,
- needs full block/blob history,
- needs consensus-layer history,
- can tolerate a bounded historical window,
- can use an offline/batch archive rather than low-latency RPC.

Then map each class to storage. Do not run one maximal archive profile for all traffic. Historical Merkle proofs, traces, and wide log indexes are the expensive cases; flat historical state is now much cheaper in modern clients.

### 2. Standardize on efficient archive profiles

For new archive capacity, prefer:

- **Erigon archive** when your workload is high-volume historical query/indexing and you can operate its snapshot/MDBX model.
- **Geth path-based archive** when client diversity or Geth compatibility matters; explicitly decide whether you need historical trie-node retention for `eth_getProof`.
- Avoid legacy Geth hash-based archive for general capacity unless a product explicitly requires full historical trie proofs and you have priced the 20 TB-plus class of storage.

Use at least 4 TB NVMe as the current floor for Erigon archive class machines, but buy with expansion paths. For dense enterprise deployments, capacity-plan by measured GiB/day and IO latency, not headline TB alone. Erigon's docs emphasize that archive fits on one 4 TB drive today, but usage grows over time; Geth path archive examples already show about 2.17 TiB in one mainnet inspection.

### 3. Measure your own state-growth curve

Create a monthly report per client/profile:

- datadir total,
- hot DB size,
- immutable snapshots/history,
- tx/receipt/log indexes,
- consensus data,
- app-derived indexes,
- GiB/day and GiB/week growth,
- compaction/snapshot/rebuild overhead,
- p95/p99 RPC latency for representative historical queries,
- time-to-rebuild from scratch or from snapshot.

Finance should see a low/base/high case based on observed fleet growth, not public averages. Public docs are useful sanity checks; your product's index choices and query mix will dominate.

### 4. Keep headroom and recovery capacity boring

Use these as default planning rules unless your own data says otherwise:

- Alert at 70% disk, plan migration at 80%, treat 85% as urgent for NVMe-backed execution clients.
- Keep at least one spare archive host or spare disk set per failure domain that can absorb a rebuild without taking customer traffic.
- Avoid cloud network block storage for hot execution data unless benchmarked under load; latency matters more than sequential throughput.
- Prefer mirrored redundancy over RAID 0 for archive service nodes. Erigon's docs specifically call out that RAID 0 adds failure risk without needed capacity for current archive profiles.
- Keep immutable/re-downloadable data and unique local data in separate backup policies. For Erigon, much of `snapshots/` is re-downloadable; `chaindata/` and app indexes may not be.

### 5. Use history expiry where it is safe

For non-archive full nodes, enable supported history-expiry/pruning modes and validate RPC behavior. Expect hundreds of GB of savings on full nodes, especially if pre-Merge history is still present.

For archive products, do not enable pruning blindly. EIP-4444-style history expiry can break customers who expect old blocks, receipts, logs, or L2 calldata availability from your RPC endpoint. If you adopt it, provide an explicit product contract: "recent node," "full history blocks/receipts," "historical state archive," etc.

### 6. Track protocol milestones with hard gates

Do not change procurement assumptions until a feature passes these gates:

- **SFI in Forkcast for a named fork**: start technical impact assessment.
- **Testnet fork scheduled**: prepare canary nodes and benchmark.
- **Mainnet client releases cut**: test upgrade and rollback plans.
- **Mainnet activation plus 4-8 weeks**: update capacity model using observed data.

For the current roadmap, the watchlist is:

- Glamsterdam mainnet activation and client maturity.
- EIP-8037/8038 effects on new-state growth after activation.
- EIP-7928/8189 effects on sync/healing after enough post-Glamsterdam blocks exist.
- Any Verkle/binary-tree/state-expiry proposal moving from no fork relationship to CFI/SFI.
- EIP-4444 full rolling history-expiry defaults in major clients.

## Budget guidance

For the next 24 months:

- Budget archive fleet expansion as if no protocol relief lands.
- Apply no Verkle/state-expiry savings.
- Apply no EIP-4444 savings to archive-state storage.
- Apply partial-history-expiry savings only to full-node and non-history-serving fleets.
- Treat Glamsterdam state repricing as possible growth-rate mitigation, not as a capacity reduction.
- Fund engineering time for client-profile testing; this is likely to save more money than waiting for protocol changes.

The safest financial model is:

1. Baseline: current measured GiB/day per node class continues.
2. High case: growth accelerates with higher gas limits or more state-heavy usage.
3. Upside case: Glamsterdam repricing reduces new-state growth after activation, and sync improvements reduce rebuild time.

Use the baseline/high case for committed procurement. Use the upside case only for timing optional expansion, not for avoiding it.

## Source index

- Forkcast upgrade tracker APIs: <https://forkcast.org/api/upgrades.json>, <https://forkcast.org/api/eips.json>
- Forkcast ACD artifacts: <https://forkcast.org/artifacts/acde/2026-09-10_245/tldr.json>, <https://forkcast.org/artifacts/acdc/2026-09-17_187/tldr.json>
- Ethereum.org Merkle Patricia Trie: <https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie>
- Ethereum.org archive nodes: <https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes>
- Ethereum.org statelessness/state expiry/history expiry roadmap: <https://ethereum.org/roadmap/statelessness/>
- EF partial history expiry announcement: <https://blog.ethereum.org/2025/07/08/partial-history-exp>
- Geth archive mode: <https://geth.ethereum.org/docs/fundamentals/archive>
- Erigon hardware/database docs: <https://docs.erigon.tech/get-started/hardware-requirements>, <https://docs.erigon.tech/fundamentals/database>
- EIPs: <https://eips.ethereum.org/EIPS/eip-4444>, <https://eips.ethereum.org/EIPS/eip-6800>, <https://eips.ethereum.org/EIPS/eip-7607>
