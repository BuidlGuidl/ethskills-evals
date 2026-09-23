# Ethereum state growth: operational brief for archive-node planning

Date: 2026-09-23

## Executive summary

State growth is not a temporary client bug. It follows from Ethereum's account/state model: every account, contract bytecode reference, and contract storage slot that still exists is part of the current state, and protocol validation requires clients to maintain a cryptographic commitment to that state. Full nodes can prune older intermediate state; archive nodes deliberately do not, because their product is historical state access.

For the next 18-24 months, we should not budget on a protocol change that shrinks archive-node requirements. The only near-term protocol work that is genuinely scheduled is mostly about slowing future growth and improving sync/execution mechanics, not reducing the historical-state surface we serve.

The practical planning stance:

- Bank on no in-protocol archive-state relief through at least September 2028.
- Treat Glamsterdam as a likely but not guaranteed improvement to state-growth rate and sync mechanics, not as a capacity reduction event.
- Treat state expiry, statelessness, Verkle/binary-tree migration, and deep archive offloading as research or post-Glamsterdam work until an EIP is scheduled for a named fork.
- Spend in the meantime on client mix, archive topology, retention tiers, reproducible rebuilds, and better growth telemetry.

## Why state grows

Ethereum is account-based. The live state is the set of information needed to execute the next block:

- Account records: nonce, balance, code hash, and storage root.
- Contract bytecode, addressed by code hash in clients' databases.
- Contract storage: key/value slots written by contracts.

Today, execution clients commit to this state with a Merkle Patricia Trie (MPT). Conceptually there is one account trie. Each contract account points to a storage trie. The block header contains a `stateRoot`, so after executing a block, every validating node must arrive at the same new root.

This design has two consequences that matter for operations:

1. **Current state is durable by default.** Once a contract writes a new storage slot or a new account is created, the network carries that state until protocol rules or later transactions remove or overwrite it. There is no general rent or expiry mechanism live today.
2. **Archive service multiplies the burden.** A normal full node keeps the current state and recent/reconstructable data, then prunes old trie nodes. An archive node keeps enough historical state to answer queries at old block heights. Depending on the client and mode, that means retaining historical trie nodes, flat historical state, change sets, indexes, or some combination.

The chain history problem and the state problem are related but not the same:

- **History** means old block bodies, receipts, and headers used for syncing, logs, proofs of old transactions, and chain replay.
- **State** means balances, nonce, code, and storage at a given block.
- **Archive-state access** requires more than just old blocks. A historical balance or storage lookup generally requires an archive node or specialized indexes.

This distinction is important because recent history-expiry work helps full-node sync and p2p serving, but it does not eliminate our need to store and serve historical state.

## Current operational baseline

Client choice dominates disk footprint. Public guidance is broad because "archive node" is not a single implementation strategy.

- ethereum.org currently lists full archive estimates of `12TB+` for Besu, Geth, and Nethermind, `2.5TB+` for Erigon, and `2.2TB+` for Reth. It also recommends `4TB NVMe` for ordinary full nodes and warns that disk is the main bottleneck.
- Geth's legacy hash-based archive mode stores historical state in MPT form and can exceed `20TB` on mainnet. Geth's newer path-based archive mode is much smaller: around `2TB` for full flat state history, or around `6.5TB` when full flat states are stored alongside historical trie data. It also changes proof-support tradeoffs by version and retention configuration.
- Geth full-node pruning documentation still gives a useful growth signal for non-archive operators: a snap-synced database has grown at roughly `14GB/week` under default cache assumptions. Archive fleets should measure their own slope because indexes, traces, tx lookup retention, client version, and workload can dominate.

For finance: do not compare archive nodes by raw chain size alone. The real bill includes historical-state serving mode, extra indexes, trace/debug APIs, compaction headroom, rebuild capacity, snapshots, consensus-client data, and spare space for client migrations.

## Protocol changes we can actually bank on

Status terms below follow Forkcast/AllCoreDevs inclusion status:

- **Live:** active on mainnet.
- **SFI:** scheduled for inclusion in a named fork, with timing/scope risk until activation.
- **Networking:** tracked as a p2p/networking companion, not necessarily a consensus change.
- **DFI:** declined for that fork.
- **No fork relationship:** proposal or research only.

| Item | Current status as of 2026-09-23 | What it does | Planning value |
| --- | --- | --- | --- |
| EIP-7642, `eth/69` history expiry and simpler receipts | **Live.** Forkcast shows Included in Pectra and Fusaka. | Lets peers advertise served history range and removes receipt bloom transfer from p2p receipts. The spec says bloom removal saves roughly `530GiB` uncompressed bandwidth per sync. EF also says pre-Merge data removal saved full nodes hundreds of GB. | Useful for sync bandwidth and full-node footprint. Do not count it as archive-state relief. |
| EIP-4444, bounded historical data | **No fork relationship** on Forkcast, but partly advanced in practice by EIP-7642/client history-expiry work. | Would stop clients serving very old headers, bodies, and receipts over p2p and allow local pruning. | Treat as live only where your chosen clients have implemented policy. It increases the importance of independent history providers and archive operators. |
| Glamsterdam upgrade | **Upcoming.** Forkcast status Upcoming, projected activation `2026-12-02`; ethereum.org says Q4 2026, date not confirmed. | Scaling fork with Block-Level Access Lists, ePBS, repricings, and networking companions. | Reasonable to plan for in late 2026/early 2027, but do not schedule hardware retirement around it. |
| EIP-8037, State Creation Gas Cost Increase | **SFI in Glamsterdam.** | Reprices state creation and introduces a state-gas accounting model. ethereum.org describes a target safe/predictable growth rate of `120 GiB/year` for state creation under the model. | Most relevant near-term state-growth control. It should slow underpriced new state, but it will not shrink existing state or archive history. |
| EIP-8038, State-access gas cost update | **SFI in Glamsterdam.** | Raises costs for state-access operations to reflect larger state and real client performance. | Helps align gas with node costs. Expect workload mix changes, not disk relief. |
| EIP-7928, Block-Level Access Lists | **SFI in Glamsterdam**, headliner. | Adds per-block records of touched accounts/storage and post-state diffs, enabling parallel disk reads, parallel validation, state-root work, and executionless state updates. | Important for future sync and execution architecture. It may also create new data artifacts that archive/data providers may choose or need to retain. |
| EIP-8159, `eth/71` Block Access List Exchange | **Networking** in Glamsterdam on Forkcast; ethereum.org presents it as the p2p companion to BALs. | Lets peers exchange BALs; supports faster syncing and executionless state updates. Forkcast notes archive nodes may need to store BALs indefinitely for full historical serving. | Operationally useful, but budget for possible added historical artifact retention. |
| EIP-8189, `snap/2` BAL-Based State Healing | **Networking** in Glamsterdam. | Replaces iterative trie-node healing with BAL-based catch-up for post-Glamsterdam blocks in the BAL retention window. | Good for sync reliability and catch-up. Not a reduction in archive data. |
| Hegota | **Planning.** Forkcast projected activation `2027-06-16`; headliners are not state-growth relief. | Follow-on fork currently scoped around other priorities. Some state/sync-related EIPs are only Proposed or have been Declined. | Do not count Hegota as an archive-capacity relief fork unless new SFI decisions happen. |

## What is still aspirational

These items are important, but they should not drive an 18-24 month capacity reduction plan yet.

| Item | Current status | Why it matters | Planning stance |
| --- | --- | --- | --- |
| Verkle tree migration, EIP-6800 / EIP-7612 | **No fork relationship; Stagnant** on Forkcast. | Would replace or overlay the current MPT with a tree that supports smaller witnesses and stateless validation. | Do not bank on it. The roadmap appears to have shifted attention toward binary/partitioned tree work. |
| Binary tree / Partitioned Binary Tree, EIP-7864 / EIP-8297 | **No fork relationship; Draft.** | Would change Ethereum's state commitment structure and improve proof/witness properties. | Research/spec work. Not scheduled for Glamsterdam or Hegota. |
| Offline migration to PBT, EIP-8347 | **No fork relationship; Draft.** | Proposes a way to convert state off the consensus-critical path, distribute a verifiable snapshot, and switch roots at a fork. | Promising migration plumbing, but not bankable until it has a named fork relationship. |
| State expiry, EIP-7736 | **No fork relationship; Stagnant.** Requires Verkle in its current form. | Would expire cold leaf-level state and require resurrection proofs/transactions. | Not in the planning window. |
| Stateless witnesses, EIP-4942 / EIP-4762 | **No fork relationship; Draft.** | Would let validators verify without locally storing all state, using witnesses. | Long-term. It changes validator/full-node requirements before it changes archive-provider obligations. |
| Adaptive/tiered state pricing, EIP-8075 / EIP-8295 / EIP-8296 | **No fork relationship; Draft.** | More dynamic ways to price or tier state growth. | Monitor only. |
| Last-written metadata, EIP-8188 | **DFI for Hegota.** | Would add consensus metadata for accounts/slots to support tiering and recent working-set handling. | Explicitly not in Hegota as of the latest Forkcast state. |

The Ethereum Foundation's September 2026 priorities post is also consistent with this: it says the "state arc" includes a new trie, sustainable state growth, and decentralized access to current and historical state, with the largest design and migration work expected to begin in I* and continue beyond it. That is beyond the currently named/scheduled fork scope.

## Implications for our 18-24 month plan

### What we should assume

Base case:

- Glamsterdam activates around late 2026 or slips modestly.
- EIP-8037/EIP-8038 slow the marginal rate of state growth, especially under higher gas limits.
- BALs and snap/2 improve sync/catch-up paths for post-Glamsterdam blocks.
- Existing archive data remains our responsibility.
- Demand for historical state, traces, logs, and proof-adjacent APIs continues to grow.

Downside case:

- Glamsterdam slips, or repricing parameters change.
- Gas limit increases offset part of the savings from repricing.
- BAL retention adds data-provider storage obligations.
- More nodes prune history, making commercial/archive providers more important.

Upside case:

- Path-based/archive-client improvements continue to reduce footprint and rebuild time.
- BAL-based sync improves fleet recovery time for recent ranges.
- Out-of-protocol archive/state-serving experiments mature enough to offload some cold workloads, but without consensus guarantees.

### What we should do now

1. **Separate archive products by requirement.**

   Classify customers and internal systems by what they actually require:

   - Recent full node data.
   - Historical blocks/receipts/logs.
   - Historical account/storage state.
   - Traces/re-execution.
   - Historical Merkle proofs via `eth_getProof`.
   - Custom indexes.

   Do not run the most expensive archive mode for every workload if only a subset needs historical proofs or arbitrary historical storage.

2. **Keep a mixed-client archive fleet.**

   Erigon/Reth-style archive storage is materially smaller for many archive workloads. Geth path-based archive is now operationally relevant, but its proof support depends on version and `history.trienode` retention. Maintain at least two client families for correctness checks and migration leverage.

3. **Build block-range and capability segmentation.**

   Use segmented archives where possible:

   - Hot recent range on fast NVMe.
   - Cold historical state/indexes on denser storage where latency allows.
   - Dedicated proof-capable nodes for customers needing historical `eth_getProof`.
   - Separate trace/re-execution clusters from generic JSON-RPC archive clusters.

   Geth explicitly supports switching into archive mode from a point in time and building archive clusters responsible for different historical segments. That pattern is worth generalizing across clients.

4. **Plan storage from measured slopes, not public averages.**

   For each archive class, track:

   - GB/day total database growth.
   - GB/day per namespace/table if the client exposes it.
   - Compaction amplification and temporary free-space needs.
   - Rebuild time from snapshot and from genesis/import.
   - Query latency versus disk fullness.
   - Index growth separate from client database growth.

   Finance model should use our p95 observed growth plus at least 30-50% operational headroom. Running archive databases near full is not a savings strategy; it converts routine compaction into incident risk.

5. **Budget for retention of new artifacts.**

   If BALs become part of customer-visible correctness, debugging, or sync recovery, archive nodes may retain them beyond the weak-subjectivity window. Treat post-Glamsterdam BAL retention as a new line item until client defaults and customer expectations settle.

6. **Own history availability deliberately.**

   History expiry makes old block/receipt availability more explicitly out-of-protocol. We should maintain verified cold copies of historical blocks/receipts and import pipelines, even if not all serving nodes keep all history locally. This protects rebuilds, audits, L2 validation support, and customer backfills.

7. **Do not defer hardware purchases waiting for state expiry.**

   State expiry and trie migration are not scheduled for a named fork. For procurement, assume no protocol-level shrink event before late 2028. Revisit quarterly when Forkcast shows SFI/CFI changes for named forks.

## Finance guidance

For the 18-24 month budget, use three buckets:

1. **Committed operations:** capacity for today's archive modes, our measured growth, normal compaction headroom, replicas, and rebuild buffers.
2. **Near-term protocol adjustment:** modest reduction in future marginal state-growth pressure after Glamsterdam, but no reduction in existing archive data. Do not book this as a hard savings line until the fork activates and we measure the post-fork slope.
3. **Strategic optionality:** test capacity for newer archive modes, path-based Geth, Reth/Erigon improvements, BAL retention experiments, and cold-history/object-storage pipelines.

Budget message: Glamsterdam may improve the slope; it does not erase the mountain.

## Watchlist and review cadence

Review monthly until Glamsterdam activation, then quarterly:

- Forkcast status changes for EIP-8037, EIP-8038, EIP-7928, EIP-8159, EIP-8189.
- Glamsterdam testnet/mainnet dates and client release notes.
- Hegota scope changes, especially any state/sync EIPs moving from Proposed/Considered to Scheduled.
- Any named-fork relationship for EIP-7864, EIP-8297, EIP-8347, or replacement state-tree migration proposals.
- Client-specific archive mode changes, especially historical proof support, state-retention flags, and snapshot import/export support.
- Our own post-Glamsterdam measured growth slope.

## Sources checked

- Forkcast Ethereum Upgrade Tracker APIs: https://forkcast.org/llms.txt, https://forkcast.org/api/upgrades.json, https://forkcast.org/api/eips.json
- Forkcast EIP records checked directly: EIP-2780, EIP-4444, EIP-7642, EIP-7736, EIP-7864, EIP-7928, EIP-8037, EIP-8038, EIP-8159, EIP-8189, EIP-8297, EIP-8347.
- Ethereum.org Glamsterdam roadmap: https://ethereum.org/roadmap/glamsterdam/
- Ethereum.org statelessness/state expiry/history expiry roadmap: https://ethereum.org/roadmap/statelessness/
- Ethereum.org node hardware/client guidance: https://ethereum.org/developers/docs/nodes-and-clients/run-a-node
- Ethereum.org archive-node guidance: https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes
- Geth archive mode documentation: https://geth.ethereum.org/docs/fundamentals/archive
- Geth pruning documentation: https://geth.ethereum.org/docs/fundamentals/dbpruning
- EF Protocol priorities update, 2026-02-18: https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026
- EF Protocol current and emerging priorities, 2026-09-07: https://blog.ethereum.org/2026/09/07/protocol-priorities
- EF "The Future of Ethereum's State", 2025-12-16: https://blog.ethereum.org/2025/12/16/future-of-state
- EF partial history expiry announcement, 2025-07-08: https://blog.ethereum.org/2025/07/08/partial-history-exp
- EIP specs: https://eips.ethereum.org/EIPS/eip-4444, https://eips.ethereum.org/EIPS/eip-7642, https://eips.ethereum.org/EIPS/eip-7928, https://eips.ethereum.org/EIPS/eip-8037, https://eips.ethereum.org/EIPS/eip-8038, https://eips.ethereum.org/EIPS/eip-8159, https://eips.ethereum.org/EIPS/eip-8189, https://eips.ethereum.org/EIPS/eip-8297, https://eips.ethereum.org/EIPS/eip-8347, https://eips.ethereum.org/EIPS/eip-7736
