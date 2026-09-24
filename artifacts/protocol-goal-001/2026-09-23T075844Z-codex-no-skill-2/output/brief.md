# Ethereum State Growth Brief

Date: 2026-09-23

Audience: infrastructure engineering, data platform, finance

## Executive Position

For the next 18-24 months, plan as if Ethereum state growth remains an operational burden. There is meaningful work in flight, but the only items I would treat as bankable inside the planning window are client-level storage improvements, partial history-expiry support where it fits our workloads, and the Glamsterdam gas repricing work if it lands on mainnet as currently targeted. Broader rolling history expiry is plausible, but should be adopted only where our product does not require the pruned data locally.

Do not budget on state expiry, weak statelessness, or a full state-tree migration reducing our archive-node footprint before late 2028. Those remain either research, draft, or post-Glamsterdam work. They matter strategically, but they should be modeled as upside.

Recommended finance posture:

- Full/tip nodes: standardize new purchases on 4 TB NVMe SSDs, 32-64 GB RAM, and unmetered bandwidth. 2 TB is now a transitional size, not a 24-month default.
- Efficient archive nodes without historical Merkle-proof requirements: standardize production boxes on 8 TB NVMe, even though current efficient-client archives fit in about 2-3 TB and some docs recommend 4 TB. The extra space buys compaction/snapshot headroom, client migration room, incident recovery, and a real 24-month runway.
- Archive nodes that must support historical trie proofs, legacy hash-based archive semantics, or broad debug/trace workloads: budget 12-16 TB+ per node, or deliberately shard the archive responsibility by block ranges/client roles.
- Treat Glamsterdam repricing as growth-rate mitigation, not a storage reduction. It may slow new state growth after activation, but it will not shrink our existing archives.

## What Is Actually Growing

Ethereum is an account-based state machine. The execution layer maintains a current global state containing account balances, nonces, contract code, and contract storage. The state is committed into each block through the `stateRoot`. To validate a block, a node executes the transactions, applies state changes, and checks that its computed root matches the block header.

Today that state commitment is a modified Merkle-Patricia Trie (MPT). Ethereum.org describes the state as "the totality of all accounts, balances, and smart contracts" encoded into a modified MPT, where an account is represented as `[nonce, balance, storageRoot, codeHash]`. Contract storage is not just a flat field inside the account; the `storageRoot` points to storage data for that contract. Source: https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/

Operationally, there are several different "growth" buckets that get conflated:

1. Live state: the current account trie, contract code, and contract storage needed to validate the chain tip.
2. State history: old versions or diffs that allow `eth_call`, balance, storage, and trace queries at historical blocks without replaying from genesis.
3. Block history: headers, bodies, transactions, receipts, logs, and, post-Deneb, blob-related sidecar retention handled by consensus/client policy.
4. Client indexes and accelerators: flat-state tables, snapshots, bloom/log indexes, receipts caches, transaction lookup indexes, history indexes, and tracing/debug indexes.

Full nodes and archive nodes differ mainly in bucket 2. A full execution node follows and verifies the head state and keeps recent state needed for reorg handling. Ethereum.org describes this as typically retaining recent states, such as around the last 128 blocks, while pruning old states because they are not needed for normal network operation. Archive nodes store historical state so old-block queries are served from disk instead of recomputed by replay. Source: https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes/

The drivers are:

- New accounts. Any non-empty address adds an account leaf.
- New contract bytecode. Code is content-addressed by `codeHash`, but new unique code still expands the state/database.
- New non-zero storage slots. This is the main state bloat vector for many applications. Updating an existing slot changes state, but creating a new non-zero slot expands live state.
- Higher gas limits and cheaper state operations. More gas per block allows more state-creating work per unit time unless state creation is repriced.
- Archive semantics. A full node can prune old state; an archive service keeps historical state/diffs/indexes and therefore grows with both chain activity and query requirements.
- Reduced cleanup paths. Since EIP-6780, `SELFDESTRUCT` no longer deletes account code/storage except when used in the same transaction as contract creation, so it is not a broad state cleanup mechanism. Source: https://eips.ethereum.org/EIPS/eip-6780

The trie itself also has performance consequences. Ethereum Foundation's "Ethereum State Problems" post explains that as the MPT grows, account lookups traverse multiple intermediate nodes, each mapping to database lookups with effectively random keys. Larger state therefore hurts not only disk capacity, but IO latency, compaction, sync time, and worst-case block-processing headroom. Source: https://blog.ethereum.org/2021/05/18/eth-state-problems

## Current Sizing Signals

Useful public numbers as of 2026:

- Ethereum.org's node guide lists 2 TB NVMe as a minimum for full nodes but explicitly notes it is likely exceeded by 2027; its recommended full-node spec is 4 TB NVMe. It estimates full archive sizes by client at roughly: Besu 12 TB+, Erigon 2.5 TB+, Geth 12 TB+, Nethermind 12 TB+, Reth 2.2 TB+. Source: https://ethereum.org/developers/docs/nodes-and-clients/run-a-node
- Erigon's September 2026 hardware docs show Ethereum mainnet archive usage at 2.03 TB as measured on 2026-07-19, with 4 TB recommended, and full/default at 419 GB with 2 TB recommended. Source: https://docs.erigon.tech/get-started/hardware-requirements
- Geth's February 2026 archive-mode docs say path-based archive with full flat state history needs around 2 TB; storing full flat states plus historical trie data is about 6.5 TB. Legacy hash-based archive remains much heavier. Source: https://geth.ethereum.org/docs/fundamentals/archive
- Ethereum.org's archive-node page still warns that most clients' archive modes require more than 12 TB, while Erigon-class implementations can store the same data under about 3 TB. Source: https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes/

Takeaway: "archive node" is no longer one sizing class. Archive-with-fast-historical-state, archive-with-historical-proofs, archive-with-traces, and archive-plus-product-indexes have different disk shapes.

## Protocol Roadmap: What Helps and What Does Not

### Already Useful: Partial History Expiry

Partial history expiry is real. In July 2025 the Ethereum Foundation announced that all execution clients supported partial history expiry aligned with EIP-4444, allowing operators to remove pre-Merge block data and reduce node disk use by roughly 300-500 GB. Source: https://blog.ethereum.org/2025/07/08/partial-history-exp

What it helps:

- Full-node disk pressure.
- Bootstrap burden for nodes that do not need pre-Merge bodies/receipts locally.
- P2P serving load for ancient history.

What it does not solve:

- Current live state growth.
- Archive historical state queries.
- Data-company obligations to serve arbitrary old receipts/logs/traces if our product depends on them.

EIP-4444 itself is still listed as Draft and says clients should stop serving old headers/bodies/receipts over p2p and may prune them locally. It moves old history availability out of the default node responsibility and into explicit archival/distribution systems. Source: https://eips.ethereum.org/EIPS/eip-4444

Planning confidence: high for partial history expiry that exists today; medium for broader rolling history expiry becoming common client default during the window; low as a substitute for our own historical data commitments.

### Likely Near-Term: Glamsterdam Repricing

Glamsterdam is currently listed by ethereum.org as "Testing on devnets", expected on mainnet in Q4 2026 with no confirmed date, and with a Sepolia fork milestone on 2026-10-06. The same page says the scope is frozen but can still change before mainnet. Source: https://ethereum.org/roadmap/glamsterdam/

The state-relevant pieces are EIP-8037 and EIP-8038:

- EIP-8037 increases and harmonizes state creation costs. The EIP says it targets average state growth of 120 GiB/year at a 150M reference block gas limit. It reports that after the gas limit rose from 30M to 60M, new state created per day rose from about 105 MiB to about 326 MiB, implying about 116 GiB/year; extrapolated to a 200M gas limit without adjustment, it estimates about 387 GiB/year. Source: https://eips.ethereum.org/EIPS/eip-8037
- EIP-8038 raises state-access costs to reflect the larger state and the slowdown of state-touching operations since the Berlin repricing in 2021. Source: https://eips.ethereum.org/EIPS/eip-8038

What this helps:

- Slows state growth from new accounts, new storage slots, and new code by pricing state creation more explicitly.
- Protects block-processing performance as gas limits rise.
- Gives more credible bounds for future L1 capacity increases.

What it does not solve:

- It does not shrink existing live state.
- It does not shrink existing archive state/history.
- It may increase throughput after activation; higher throughput can still increase total data volume even if state creation is better priced.

Planning confidence: medium-high that some form lands if Glamsterdam lands in the planning window; medium on exact timing and parameters; low that it reduces our 2026-2027 archive capex.

### Useful But Not a Storage Relief: Block-Level Access Lists

Glamsterdam also includes Block-Level Access Lists (EIP-7928) and the eth/71 exchange mechanism. Ethereum.org describes BALs as providing an upfront map of state dependencies, enabling parallel disk reads and making executionless state updates possible. Source: https://ethereum.org/roadmap/glamsterdam/

This is important for sync and validation performance, and it may reduce rebuild time in some modes. It should not be modeled as a direct archive-storage reduction.

Planning confidence: medium if Glamsterdam ships as scoped; treat as performance upside, not disk relief.

### Strategic But Not Bankable: Verkle/Binary Trees and Statelessness

The long-term solution is to change how state is proven and accessed so validators do not all need local full state. Ethereum.org's Verkle page says Verkle trees are a critical step toward stateless clients, because MPT witnesses are too large; it gives an illustrative reduction from about 3.5 MB MPT witnesses to about 150 kB Verkle witnesses for 1,000 leaves. It also says Verkle testnets exist, but substantial client updates remain. Source: https://ethereum.org/roadmap/verkle-trees/

There is also active work on alternate/new trie designs. EIP-7864, "Ethereum state using a unified binary tree", is Draft and proposes a new binary tree starting empty, with the current MPT frozen. Source: https://eips.ethereum.org/EIPS/eip-7864

The September 2026 EF protocol priorities post frames the state arc as keeping state growth and access from becoming Ethereum's binding constraint, with the largest design and migration work expected to begin in I* and continue beyond it. Source: https://blog.ethereum.org/2026/09/07/protocol-priorities

Planning confidence: low for direct mainnet relief inside 18-24 months. Watch closely, but do not defer hardware purchases on this basis.

### Not Bankable: State Expiry

State expiry would make inactive state no longer mandatory for ordinary nodes to keep active, with resurrection mechanisms for old state. Ethereum.org says weak statelessness, history expiry, and state expiry are still research-phase work, expected several years out, and not guaranteed to all be implemented. Source: https://ethereum.org/roadmap/statelessness/

For our purposes, even if state expiry eventually lands, it likely creates more specialized historical-state-provider demand. A data company may become exactly the kind of operator users depend on for old state.

Planning confidence: very low for 18-24 month capex relief.

## Planning Scenarios Through September 2028

Use three scenarios, with purchasing based on the conservative case and refresh decisions after Glamsterdam has been live long enough to measure.

### Base Case

Assumptions:

- Glamsterdam lands in late 2026 or slips into 2027.
- State creation/access repricing lands substantially intact.
- Gas limits continue upward, but repricing keeps new state growth closer to the EIP-8037 target range than to the unpriced 200M-gas extrapolation.
- No state expiry or stateless-validator relief affects our archive fleet.

Implication:

- Full nodes on 4 TB NVMe are fine for the window if history expiry and pruning are configured.
- Efficient archive nodes fit on 4 TB today, but production nodes should be bought at 8 TB for operational headroom.
- Legacy/proof-capable archive nodes remain a separate expensive class.

### Upside Case

Assumptions:

- Glamsterdam lands near the Q4 2026 target.
- Client implementations of BAL/executionless updates, path-based archives, pruning, and snapshots mature quickly.
- Our workload can move most historical-state calls onto efficient flat-history/archive clients and product indexes.

Implication:

- We can slow archive hardware expansion and convert some older 12 TB+ archive boxes into specialized proof/trace/index roles.
- Sync/rebuild time improves more than raw disk footprint.

Do not pre-spend this benefit. Capture it after measured production data.

### Downside Case

Assumptions:

- Glamsterdam slips or repricing parameters change.
- Gas limits rise before state growth is fully repriced.
- Query demand grows for historical state, traces, and receipts.
- Client database migrations require temporary duplicate storage during rebuilds.

Implication:

- Efficient archives still grow, and rebuild/compaction windows become the real operational risk.
- 4 TB archive boxes become tight earlier than expected.
- Finance should expect emergency purchases if archive primaries are not already on 8 TB or larger devices.

## Operational Recommendations

1. Separate node roles explicitly.

Do not run "one archive node" that tries to satisfy every product need. Maintain separate pools for:

- Tip/full RPC and validator-adjacent workloads.
- Historical state reads (`eth_call`, `eth_getBalance`, `eth_getStorageAt` at old blocks).
- Historical proof reads (`eth_getProof` at old blocks), if actually required.
- Logs/receipts/transaction history.
- Traces/debug workloads.
- Internal indexed datasets.

This lets us use efficient archive modes for most traffic and reserve expensive historical-trie or trace-heavy setups for the narrower workloads that need them.

2. Standardize hardware classes.

Suggested procurement defaults:

| Role | 2026 observed public sizing | Our planning default |
| --- | ---: | ---: |
| Full/tip node | 500 GB-2 TB depending on client and history expiry | 4 TB NVMe, 32-64 GB RAM |
| Efficient archive, no historical proofs | ~2.0-2.5 TB for Erigon/Reth/Geth path modes | 8 TB NVMe, 64 GB RAM |
| Archive plus historical trie proofs | Geth path docs cite ~6.5 TB for flat state plus trie history | 8-12 TB NVMe, limit retention if possible |
| Legacy archive / broad trace box | Ethereum.org still lists 12 TB+ for several clients | 16 TB NVMe or sharded archive ranges |
| Product indexes | workload-specific | separate volumes; do not co-locate with EL datadir |

Use high-end NVMe, not network block storage, for active execution datadirs. Erigon's docs explicitly warn that HDDs can lag and that cloud/network block storage is slow for block execution. Source: https://docs.erigon.tech/get-started/hardware-requirements

3. Enable history expiry where product-safe.

For full nodes that do not serve ancient bodies/receipts, enable client-supported partial history expiry now. If rolling expiry becomes stable for our chosen clients, adopt it first in non-archive pools.

For archive/data products, keep our own historical source of truth. EIP-4444 intentionally reduces the assumption that random p2p peers will serve old history forever.

4. Prefer efficient archive clients for ordinary historical-state RPC.

Evaluate Erigon, Reth, and Geth path-based archive for our exact RPC mix. Important caveat: some efficient modes serve flat historical state but not historical Merkle proofs unless configured with trie-node retention. Geth documents this distinction directly. Source: https://geth.ethereum.org/docs/fundamentals/archive

Decision rule:

- If customers need old balances/storage/calls quickly, efficient flat-history archive is usually the right primitive.
- If customers need old `eth_getProof`, keep a dedicated proof-capable pool or bounded proof-retention windows.
- If customers need traces, benchmark trace coverage and latency separately; do not infer trace suitability from archive-state size.

5. Build capacity from observed deltas, not static docs.

Add a daily job per node/client/version that records:

- Total datadir size and filesystem free percentage.
- Size by major subdirectory: active DB, snapshots, ancient/block segments, receipts/log indexes, history, consensus data.
- Daily and weekly growth rate.
- Compaction/write amplification indicators where the client exposes them.
- RPC mix by method and old-block depth.
- Reorg/rebuild/snapshot sync time.

Finance should receive a monthly "runway at p50/p90 growth" report. Trigger procurement when any production pool has less than 9 months runway at p90 growth or less than 30% filesystem free after accounting for compaction and snapshot rebuilds.

6. Keep client diversity, but not at the cost of unclear semantics.

Client diversity is valuable, but archive behavior differs materially. For each supported client, document:

- Which historical RPC methods are guaranteed.
- Whether historical proofs are supported.
- Whether old bodies/receipts may be pruned.
- What data can be regenerated from peers versus what must be backed up.
- Expected resync time from scratch and from internal snapshots.

7. Treat existing archive data as a product asset.

The roadmap shifts more old-data responsibility away from default nodes. That is not bad for us; it may increase the value of operating reliable historical datasets. Keep raw chain history, receipts/logs, traces, and derived indexes in reproducible storage separate from the live EL client. Archive nodes should be rebuildable consumers of our data platform, not the only place old data exists.

## Decision Summary

Bank on:

- Partial history expiry for full-node savings.
- Client database improvements and efficient archive modes.
- Glamsterdam repricing as likely growth-rate mitigation if it lands, not as a capacity replacement.

Do not bank on:

- State expiry reducing our hardware needs before September 2028.
- Weak statelessness reducing archive-node needs before September 2028.
- Verkle/binary-tree migration landing soon enough to change this budget cycle.
- EIP-4444 eliminating our need to store history if our products depend on old history.

Budget recommendation:

- Buy 4 TB NVMe as the new baseline for full nodes.
- Buy 8 TB NVMe as the default for production efficient archive nodes.
- Reserve 12-16 TB+ or segmented archive architecture for proof-capable, legacy, and trace-heavy workloads.
- Revisit the forecast 90 days after Glamsterdam mainnet activation, using our measured growth deltas rather than roadmap promises.

## Sources

- Ethereum.org, Merkle Patricia Trie: https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/
- Ethereum.org, Archive nodes: https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes/
- Ethereum.org, Run a node: https://ethereum.org/developers/docs/nodes-and-clients/run-a-node
- Ethereum Foundation, "Dodging a bullet: Ethereum State Problems": https://blog.ethereum.org/2021/05/18/eth-state-problems
- Ethereum Foundation, "Partial history expiry announcement": https://blog.ethereum.org/2025/07/08/partial-history-exp
- EIP-4444, Bound Historical Data in Execution Clients: https://eips.ethereum.org/EIPS/eip-4444
- Ethereum.org, Glamsterdam roadmap page: https://ethereum.org/roadmap/glamsterdam/
- EIP-8037, State Creation Gas Cost Increase: https://eips.ethereum.org/EIPS/eip-8037
- EIP-8038, State-access gas cost update: https://eips.ethereum.org/EIPS/eip-8038
- Ethereum.org, Verkle trees: https://ethereum.org/roadmap/verkle-trees/
- Ethereum.org, Statelessness, state expiry and history expiry: https://ethereum.org/roadmap/statelessness/
- EF Protocol, "Current and Emerging Priorities": https://blog.ethereum.org/2026/09/07/protocol-priorities
- EIP-7864, Ethereum state using a unified binary tree: https://eips.ethereum.org/EIPS/eip-7864
- Geth docs, Archive mode: https://geth.ethereum.org/docs/fundamentals/archive
- Erigon docs, Hardware requirements: https://docs.erigon.tech/get-started/hardware-requirements
- EIP-6780, SELFDESTRUCT only in same transaction: https://eips.ethereum.org/EIPS/eip-6780
