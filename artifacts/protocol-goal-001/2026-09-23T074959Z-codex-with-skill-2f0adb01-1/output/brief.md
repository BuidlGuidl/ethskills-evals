# Ethereum state growth brief for archive-node planning

As of 2026-09-23.

## Executive takeaways

Do not plan the next 18-24 months around protocol-level state shrinkage. The only near-term Ethereum change that materially addresses state growth is **Glamsterdam's state-creation repricing**, especially EIP-8037. That is meaningful, but it slows the creation of new permanent state; it does not delete old state or make archive nodes smaller.

For finance: treat protocol relief as a downside-risk reducer, not as a reason to delay storage spend. Budget archive capacity from your own observed per-client growth curves, with headroom for compaction, reindexing, snapshots, and resyncs. Revisit assumptions 60, 90, and 180 days after Glamsterdam mainnet activation.

What is genuinely on the way:

| Item | Current status | Expected effect for your fleet | Can we bank on it inside 18-24 months? |
| --- | --- | --- | --- |
| Glamsterdam EIP-8037, state creation gas cost increase | Scheduled for Glamsterdam; Glamsterdam is testing, expected Q4 2026, mainnet date not confirmed | Slows future state growth by making new accounts, storage slots, contract code, and EIP-7702 delegation state more expensive | Medium-high that some form ships; medium that exact economics remain unchanged |
| Glamsterdam EIP-7928, block-level access lists | Scheduled for Glamsterdam | Better parallel reads, validation, and state update mechanics; may improve sync/execution performance, not archive disk size | Medium-high for performance benefits, low for storage relief |
| History expiry / EIP-4444 family | Partial pre-Merge history expiry is supported by execution clients; full rolling history expiry still ongoing | Can cut hundreds of GB from ordinary full nodes and reduce sync burden; does not remove historical state from archive products | High for partial history savings; low for archive-state relief |
| Hegota | In planning; expected Q2 2027 but date not confirmed; FOCIL and Frame Transactions are scheduled so far | No scheduled state expiry/statelessness relief | Low |
| Binary tree / statelessness / state expiry | Draft and research-stage direction; EIP-7864 is Draft | Long-term path to smaller proofs and eventually stateless validation; not a near-term disk capacity solution | Very low inside 18-24 months |

## What is driving state growth

Ethereum's execution state is the current set of account data and contract storage committed by the block header's `stateRoot`. Ethereum currently commits this data using a modified Merkle-Patricia Trie (MPT). The execution layer has three trie roots in a block header: `stateRoot`, `transactionsRoot`, and `receiptsRoot`; all execution-layer tries use the MPT structure. See ethereum.org's [Merkle Patricia Trie documentation](https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/).

At the account level, each account record contains a nonce, balance, `storageRoot`, and `codeHash`. Contract storage is not one flat database. Each account has its own storage trie, keyed by hashed storage slots, and contract bytecode is addressed through `codeHash`. See ethereum.org on [Ethereum accounts](https://ethereum.org/developers/docs/accounts/).

The operational problem is that the protocol makes newly created state effectively permanent from the perspective of all full nodes:

- New funded accounts, contract accounts, contract code, new storage slots, and EIP-7702 delegation indicators add to the state that nodes must carry forward.
- Most state reads and writes are to hashed keys, which is bad for locality. Client databases add their own indexes, caches, snapshots, trie nodes, history tables, and compaction overhead on top of the raw protocol objects.
- Ordinary full nodes can prune old intermediate states because consensus only needs the current/recent state. Archive nodes intentionally keep historical state access, so they retain versions or indexes that let users query balances, storage, code, traces, and proofs at old blocks.
- Archive-node disk growth is therefore not simply "new state bytes per year." It is raw state growth plus historical versions, indexes, receipts/log indexes, trace support, database write amplification, and each client's storage design.

The distinction between full and archive nodes matters. Ethereum.org describes a full execution client as following the latest state while keeping only recent past states for reorg handling; historical states can be pruned. Archive nodes store historical states so old-state queries can be served immediately instead of replaying transactions. See [Ethereum Archive Node](https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes/).

The protocol-level pressure has intensified because L1 gas limits rose and are expected to rise further. EIP-8037's motivation section gives the useful quantitative anchor: after the mainnet gas limit increased from 30M to 60M, average new state added per day rose from about 105 MiB to about 326 MiB, or about 116 GiB/year of new state, and an extrapolated 200M gas limit without repricing would imply about 387 GiB/year of new state. See [EIP-8037](https://eips.ethereum.org/EIPS/eip-8037).

Those numbers are raw state-growth figures, not archive-node disk growth. For capacity planning, multiply them by your observed client-specific overhead rather than assuming archive disk grows at the raw state rate.

## Near-term protocol changes

### Glamsterdam: real mitigation, not shrinkage

Glamsterdam is the next major upgrade. Ethereum.org lists it as "testing on devnets," expected on mainnet in Q4 2026 with no confirmed date, and the next public milestone as Sepolia on 2026-10-06. It also notes that scope is frozen but can still change before mainnet. See [Glamsterdam](https://ethereum.org/roadmap/glamsterdam/).

The state-relevant pieces are:

**EIP-8037: State Creation Gas Cost Increase.** This is the main concrete mitigation. It raises and harmonizes gas costs for state creation, introduces a cost-per-state-byte parameter (`CPSB = 1530` in the current spec), and separates state-gas accounting from execution gas. The stated target is 120 GiB/year at a 150M reference block gas limit. The EIP's own table gives worst-case target growth rates of 80 GiB/year at 100M, 120 GiB/year at 150M, 160 GiB/year at 200M, 200 GiB/year at 250M, and 240 GiB/year at 300M. See [EIP-8037](https://eips.ethereum.org/EIPS/eip-8037).

Practical meaning: if Glamsterdam lands close to current scope, Ethereum should have a better brake on new state creation as L1 capacity rises. It should not reduce your existing archive footprint. It also does not make old state disappear. It changes future user/app economics and therefore future write patterns.

**EIP-7928: Block-Level Access Lists.** BALs add an enforced block-level list of all accounts and storage locations accessed during execution, along with post-execution values. The EIP says this enables parallel disk reads, parallel transaction validation, parallel state-root computation, and executionless state updates. See [EIP-7928](https://eips.ethereum.org/EIPS/eip-7928).

Practical meaning: BALs are important for throughput and node performance, especially as gas limits rise. They may reduce some sync and execution pain, but they add metadata and do not cap archive storage growth.

**EIP-8038 and related repricing.** Glamsterdam also carries broader state-access/gas repricing work. Treat this as performance and safety work around higher gas limits, not as storage reclamation.

Bankability: high enough to plan for a Glamsterdam repricing scenario in 2027, but not high enough to cancel storage expansion. Mainnet is not activated as of 2026-09-23, public testnet milestones still need to pass, and exact parameters can still move.

### History expiry: helpful, but mostly the wrong bucket

History expiry is often confused with state expiry. It is not the same thing.

Execution history is block bodies, receipts, and related chain history. State is account balances, code, storage, and the state trie. Your archive pain is mostly state and state-derived indexes, even though historical blocks/receipts matter for data products too.

The Ethereum Foundation's July 2025 announcement says all execution clients support **partial history expiry** in accordance with EIP-4444 and that removing pre-Merge block data can reduce disk requirements by about 300-500 GB. It also says full rolling history expiry is still ongoing. See the EF post [Partial history expiry announcement](https://blog.ethereum.org/2025/07/08/partial-history-exp).

EIP-7642 is already Final and supports history expiry at the networking layer by letting peers advertise the historical block range they serve; it also removes receipt bloom filters from receipt transfer, reducing sync bandwidth. See [EIP-7642](https://eips.ethereum.org/EIPS/eip-7642). EIP-4444 itself remains Draft and explicitly discusses that applications depending on historical blocks, transactions, accounts, or logs need out-of-band preservation paths. See [EIP-4444](https://eips.ethereum.org/EIPS/eip-4444).

Practical meaning: enable partial history expiry on non-archive full nodes where compatible with your products. For archive infrastructure, assume you must preserve your own historical block/receipt/log corpus and not rely on the public p2p network retaining old history.

### Hegota: not a storage-relief fork today

Hegota is expected to follow Glamsterdam. Ethereum.org lists it as "in planning," expected on mainnet in Q2 2027 with no confirmed date. The scheduled items today are FOCIL and Frame Transactions; the rest of scope is undecided. See [Hegota](https://ethereum.org/roadmap/hegota/).

The EF Protocol Hegota tier list includes some items adjacent to history, repricing, block access lists, and trie migration setup, but it does not make state expiry or statelessness a scheduled deliverable. It explicitly leaves some CPSB recalibration work waiting for Glamsterdam mainnet data. See [EF Protocol: The Hegota EIP Opinion Post and Tier List](https://blog.ethereum.org/2026/09/07/protocol-hegota-eips).

Practical meaning: Hegota should not be used as a finance assumption for archive disk relief.

## Long-term state roadmap

Ethereum's current state-scaling direction is no longer "Verkle will arrive next and fix node storage." The current public research direction is short-term repricing/history expiry, and long-term binary trees plus statelessness.

Ethereum.org's active research page says state growth and statelessness work focuses short-term on repricing state creation and expiring history; longer-term, the plan is to replace the hexary MPT with a binary tree and move toward statelessness. It also says earlier work assumed Verkle trees, while the current proposal is a unified binary tree. See [Active areas of Ethereum research](https://ethereum.org/community/research/).

EIP-7864, "Ethereum state using a unified binary tree," is Draft. It proposes replacing the current hexary MPT/tree-of-trees design with a unified binary tree in which account headers, code, and storage live in one logical tree. The motivation is proof friendliness and future statelessness, not immediate archive shrinkage. It also says the MPT would continue to exist but be frozen initially, with a later migration hard fork required. See [EIP-7864](https://eips.ethereum.org/EIPS/eip-7864).

The EF's 2026 priorities describe "state scaling involving repricing and history expiry in the short term, and a move to binary trees and statelessness in the long term." See [Protocol Priorities Update for 2026](https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026).

Practical meaning: binary trees/statelessness matter strategically, but they are not dependable within the 18-24 month hardware planning window. Even if a binary tree transition enters a fork within that window, the first effect is likely compatibility/migration complexity and proof infrastructure, not a simple reduction in archive storage.

## Client and infrastructure reality

Client implementation choice already matters more for archive disk than the base protocol roadmap.

Current public docs show wide variation:

- Ethereum.org still warns that many archive implementations require more than 12 TB, while Erigon-style approaches can store archive data in much less space. See [Ethereum Archive Node](https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes/).
- Erigon's current hardware page lists Ethereum mainnet archive usage at about 2.03 TB as of 2026-07-19, recommends a 4 TB disk, and says usage grows over time. It recommends high-end NVMe and avoiding HDD for staying at tip. See [Erigon hardware requirements](https://docs.erigon.tech/get-started/hardware-requirements).
- Geth now documents path-based archive mode as the recommended archive approach, with around 2 TB for an archive node with full flat state history, or about 6.5 TB if storing full flat states alongside historical trie data. Geth notes historical `eth_getProof` support depends on retaining historical trie nodes. See [Geth archive mode](https://geth.ethereum.org/docs/fundamentals/archive/).
- Reth supports archive, full, minimal, and custom-pruned modes. Its Storage V2 docs show measured archive storage of 2.31 TB at block 24,396,823, versus 2.99 TB on legacy storage. See [Reth Storage V2](https://reth.rs/run/storage/).

Do not compare these figures as apples-to-apples product guarantees. Archive feature surfaces differ: historical state queries, traces, receipts, tx lookup, proofs, debug methods, pruning horizons, and snapshot/restoration semantics vary. Your workload matters.

## Planning recommendation

### Finance posture

Use three scenarios:

**Base case:** Glamsterdam ships in late 2026 or early 2027 with EIP-8037-like repricing. Future raw state creation slows toward the 120-160 GiB/year band for a 150M-200M gas-limit environment, but archive disk still grows at your observed client/workload multiplier.

**Conservative case:** Glamsterdam slips several months or state repricing parameters are weakened. Continue extrapolating from your last 90-180 days of actual archive fleet growth. If L1 gas limits rise before effective repricing, use EIP-8037's own warning scenario as a stress input: roughly 387 GiB/year raw state at 200M gas before client overhead.

**Upside case:** Glamsterdam lands cleanly, BALs reduce execution/sync bottlenecks, and client storage formats continue improving. This improves resync time and growth slope, but does not eliminate archive expansion.

For procurement, size each archive class as:

`current_used + 24_month_observed_growth + compaction/reindex_headroom + snapshot_or_resync_headroom + operational_free_space`

Recommended starting assumptions if you do not already have stronger internal measurements:

- Keep at least 25-30% free space on hot NVMe volumes to avoid SSD and LSM compaction cliffs.
- Maintain one spare/staging archive capacity unit per client family you operate, because protocol/client upgrades can require reindexing or resyncing.
- Do not buy just to the advertised archive size. Buy to the feature set you actually expose: trace/debug/proof support and long historical retention cost extra.

### Fleet actions for the next two quarters

1. Build a per-client growth dashboard.
   Track execution DB, consensus DB, receipts/log indexes, trace indexes, snapshots, freezer/static files, compaction debt, and free-space floor separately. Report GiB/day and GiB/month by role, not just host-level disk.

2. Segment archive products by required historical surface.
   Separate "old balance/storage at block N," "logs/receipts," "traces," "debug/proof," and "bulk analytics" workloads. Some can run on pruned or partially archived nodes plus warehouse data; some require true archive state.

3. Benchmark at least two archive client strategies under your real query mix.
   Candidates worth testing in 2026 are Erigon archive, Geth path-based archive, and Reth archive/storage V2. The winner depends on your read patterns, proof requirements, trace surface, snapshot strategy, and recovery SLOs.

4. Treat history expiry as an internal data-availability project.
   Enable partial history expiry where it does not break products, but mirror and verify pre-Merge and eventually expired history yourself. EIP-4444 explicitly pushes old history availability out of the default p2p assumption.

5. Keep full nodes cheap and disposable.
   Use checkpoint/snap/snapshot workflows, partial history expiry, and client-native pruning for non-archive serving. Full-node fleet capacity should benefit from history expiry and modern pruning sooner than archive capacity does.

6. Preserve client diversity deliberately.
   Do not collapse the whole archive fleet onto one client solely because today's disk number is best. Keep at least one secondary archive implementation capable of serving critical historical APIs, even if at smaller scale, to reduce client-specific corruption, migration, and fork-risk exposure.

7. Re-baseline after Glamsterdam.
   The key measurement window is not the fork date; it is the post-fork behavior of state-creating transactions. Recompute growth slopes at 30, 90, and 180 days after mainnet activation, and separately track contract deployments, new account creation, new storage-slot creation, and EIP-7702 delegation usage.

## What not to assume

- Do not assume "stateless Ethereum" means nobody stores state. Weak statelessness shifts full-state requirements toward block builders/provers and archival providers; data companies may become more important, not less.
- Do not assume history expiry solves archive-node state growth. It removes old block/receipt serving expectations from ordinary nodes; archive data products still need retained history.
- Do not assume Verkle timelines from 2023-2024 are current. The current published research direction is unified binary trees, and it is long-term.
- Do not assume protocol state repricing lowers your existing disk bill. It changes future incentives; it does not compact your current archive.

## Bottom line

For the next 18-24 months, Ethereum protocol work should reduce the risk of unbounded state growth, especially if Glamsterdam's EIP-8037 ships close to current form. It should not be budgeted as archive-node storage relief. Your actionable levers are client selection, pruning/history-expiry policy, workload segmentation, hot/cold storage architecture, and disciplined growth measurement.

Finance-safe assumption: fund enough archive storage and operational headroom to survive continued growth through late 2028 without relying on state expiry or statelessness. Treat Glamsterdam as a potential improvement to the slope, not as a capacity reset.
