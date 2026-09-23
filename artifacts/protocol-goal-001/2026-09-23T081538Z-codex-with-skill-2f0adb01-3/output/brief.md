# Ethereum State Growth Brief

Date: 2026-09-23

## Executive summary

For an Ethereum data company, the uncomfortable answer is: do not budget on protocol-level state relief inside the next 18-24 months. Some helpful changes are real and close, but they mostly improve full-node viability, sync bandwidth, gas accounting, and execution performance. They do not remove the need for archive infrastructure to store and serve historical state.

What is bankable:

- Ethereum still stores execution state as authenticated key-value tries rooted in each block header. Full nodes can prune old state; archive nodes keep historical state so they can answer historical `eth_getBalance`, `eth_getStorageAt`, tracing, indexing, and sometimes historical proof queries.
- History pruning is real progress, but it is about historical blocks, receipts, and headers, not historical state. It helps ordinary full nodes much more than archive providers.
- Glamsterdam, currently tracked as the next upgrade with a Forkcast projected activation of 2026-12-02, has state-related work scheduled: block-level access lists and state gas repricing. These can slow unsafe growth and improve client performance, especially as gas limits rise. They are not a state-size reset.
- Binary-tree migration, state expiry, and stateless validation remain the meaningful long-term path, but current primary sources put major state migration work in later forks, beginning around the I* phase and continuing beyond it. That is not dependable relief for a 2026-2028 procurement plan.

Recommended planning posture:

- Model the next 24 months from your own measured archive growth, not from promised protocol relief.
- Treat Glamsterdam repricing as upside/risk control, not a disk reduction.
- Split archive service into tiers: recent high-performance state, historical state, historical blocks/receipts, traces/indexes, and proof-capable historical trie data. These have different storage engines and hardware needs.
- Aggressively evaluate modern path/flat-state archive modes and range-sharded archive fleets, but keep proof-capable/hash-trie archives only where product requirements justify them.

## What is actually growing

Ethereum execution state is "everything Ethereum knows right now": accounts, balances, nonces, contract bytecode, and contract storage. Protocol state is committed into the block header through `stateRoot`. Today that root is the root of a modified Merkle-Patricia Trie. The global state trie maps `keccak256(address)` to an RLP-encoded account object containing `nonce`, `balance`, `storageRoot`, and `codeHash`; each contract has its own storage trie keyed by hashed storage slot.

This design has two operational consequences:

1. New accounts, new nonzero storage slots, and new contract code add persistent state. Deleting or overwriting data usually does not undo the archive operator's burden, because historical states still need to be answerable.
2. Updating state mutates authenticated trie paths. In legacy archive layouts, preserving historical state means retaining many old trie nodes, not just keeping one row per account or storage slot.

Full nodes and archive nodes are therefore different products:

- A full node validates blocks and serves the current/recent state. It may store all blocks, but it prunes old state.
- An archive node stores enough historical state to answer state queries at old blocks.
- A proof-capable archive node may additionally need historical trie nodes for historical `eth_getProof`/Merkle proof semantics.

Client implementation matters a lot. Geth's 2026 archive docs distinguish legacy hash-based archive mode from path-based archive mode. The legacy hash-based archive can exceed 20 TB on mainnet and can take months to sync. Geth's path-based archive is much more storage-efficient, with docs giving roughly 2 TB for full flat state history and about 6.5 TB when also storing historical trie data, but historical Merkle proofs require explicit trie-node history retention. That is a client storage-layout improvement, not a protocol guarantee.

## Protocol drivers

The protocol does not charge rent for old state, and there is no expiry of ordinary account/storage state today. State growth is driven by:

- Account creation: EOAs and contracts that become non-empty.
- Storage creation: `SSTORE` from zero to nonzero creates a slot that remains part of the state until changed, and archive systems retain the historical version anyway.
- Code deployment: unique bytecode must be stored and made available.
- Gas limit increases: more execution capacity allows more state-creating operations per unit time unless repricing counteracts it.
- Application behavior: L2 settlement contracts, DeFi position/account factories, token/account abstractions, and high-throughput apps can produce many persistent slots even if the average transaction looks small.

EIP-8037 gives a useful current datapoint: as of January 2026, it estimated the state portion of a Geth node at about 390 GiB. After the gas limit rose from 30M to 60M, average new state created per day rose from about 105 MiB/day to 326 MiB/day, or about 116 GiB/year. The EIP warns that extrapolating to a 200M gas limit without better pricing would imply about 387 GiB/year of state growth and performance degradation in less than a year. These are not archive-database growth numbers; they are active-state-growth inputs.

## What is coming

### History expiry: useful, but not archive-state relief

EIP-4444 proposes bounding execution-client p2p serving of historical headers, bodies, and receipts older than 33,024 epochs. It explicitly allows local pruning of those objects and changes sync assumptions toward checkpoint sync.

Important caveat: this is history, not state. It does not let an archive provider stop serving historical account/storage state if that is your product. It also means archive/data companies become more important as independent preservers of old data.

Status:

- EIP-4444 itself is still Draft and has no Forkcast fork relationship.
- A related networking step, EIP-7642 (`eth/69 - history expiry and simpler receipts`), is Final and listed by Forkcast as Included in Pectra and Fusaka. Forkcast summarizes it as saving about 530 GB of bandwidth during sync.
- The Ethereum Foundation announced in July 2025 that all execution clients supported partial history expiry and that users could reduce node disk usage by roughly 300-500 GB by removing pre-Merge block data. That is real, but again it is not historical state expiry.

Planning value: bank modest storage/bandwidth relief for non-archive/full-node tiers; bank little to no relief for archive-state tiers.

### Glamsterdam: scheduled state-adjacent work

Forkcast currently marks Glamsterdam as Upcoming, with a projected activation of 2026-12-02. Treat that as a planning estimate, not an announced date.

State-relevant scheduled items:

- EIP-7928, Block-Level Access Lists: Scheduled for Glamsterdam and marked as a headliner. It adds block-level records of accessed accounts/storage and post-transaction state diffs. The goal is parallel disk reads, parallel transaction validation, parallel state-root computation, and executionless state updates. Operationally, this is performance and sync machinery; it does not shrink archive state.
- EIP-8037, State Creation Gas Cost Increase: Scheduled for Glamsterdam. It introduces a cost-per-state-byte model and a separate state-gas dimension, targeting average state growth of 120 GiB/year at a 150M reference gas limit.
- EIP-8038, State-Access Gas Cost Update: Scheduled for Glamsterdam. It reprices cold account access and introduces explicit account/storage write components to better match the larger state and actual client performance.

Planning value: reasonably bank on client upgrade work and changed gas economics in the window. Do not bank on lower archive disks. If higher gas limits follow, net state growth could still rise even with better pricing.

### Hegota and later forks

Forkcast currently marks Hegota as Planning with projected activation in 2027. The EF's September 2026 protocol-priorities post says Hegota's SFI headliners are FOCIL and Frame Transactions, not state expiry or a state-tree migration. The same post says the "state arc" includes a new trie, sustainable growth, and decentralized access to current/historical state, but that the largest design and migration work is expected to begin in I* and continue beyond it.

There is active discussion about history expiry windows because larger gas limits pressure 2 TB node operators. Forkcast's ACDE #243 summary records client teams discussing 5-12 month-ish history retention defaults and the need to converge. That is important for full-node operation, but it is not a committed archive-state solution.

Planning value: Hegota may bring more history-expiry operational convergence, but based on current sources it is not the fork to expect archive-state relief.

### Binary trees, Verkle, statelessness, and state expiry

The long-term target is to reduce the burden of state on validators and make state proving/serving more efficient. The details have shifted:

- Older Verkle-tree EIPs such as EIP-6800 and EIP-7612 are Stagnant in current EIP/Forkcast data.
- EIP-7864, "Ethereum state using a unified binary tree," is Draft and has no Forkcast fork relationship. Its motivation is to replace the current hexary Patricia tree with a unified binary tree that is friendlier to validity proofs and regular Merkle proofs.
- State expiry proposals exist, including leaf-level/state-tiering ideas, but current tracked EIPs are Draft or Stagnant and not scheduled for a fork.

Planning value: important strategically, but not finance-grade relief for the next 18-24 months.

## Risk register

| Risk | Likelihood in 18-24 months | Impact | Planning treatment |
| --- | --- | --- | --- |
| Continued archive growth | High | High | Baseline budget case |
| Glamsterdam slips or repricing changes | Medium | Medium | Do not rely on exact activation date or final constants |
| Gas limit increases raise absolute state creation | High | Medium/High | Model higher write volume even with repricing |
| History expiry reduces p2p availability of old block data | High | Medium | Maintain independent block/receipt history archives |
| State expiry/binary-tree migration lands early enough to reduce archive costs | Low | High upside | Treat as upside only |
| Client archive mode changes alter query semantics | High | Medium | Test `eth_getProof`, tracing, debug APIs, reorg handling, and historical range behavior before migration |

## Operational recommendations

1. Use your own measured growth as the budget baseline.

Track per-client and per-service daily deltas for:

- Active state database.
- Historical state/history tables.
- Historical trie/proof data.
- Blocks, receipts, logs, traces, and indexes.
- Compaction/write-amplification overhead.

For finance, model:

`required usable capacity = current size + max(90d annualized growth, 180d annualized growth, stress case) * 2 years + rebuild/reindex headroom`

Then divide by your target disk-full threshold. For archive databases, a 70-75% operating ceiling is usually more realistic than 90% because compaction, reorg buffers, snapshots, and resync operations need space.

2. Separate archive products by semantics.

Do not run every workload on the most expensive archive shape. Split into:

- Current/recent RPC nodes.
- Historical state lookup nodes.
- Historical proof-capable nodes.
- Trace/indexer backends.
- Cold block/receipt/history stores.

If most customers need historical balances/storage but not historical Merkle proofs, path/flat archive modes may be a major cost reduction. Keep legacy hash/proof-capable capacity for customers and internal jobs that truly need proofs.

3. Prefer range-sharded archive fleets over monoliths.

Geth's docs explicitly note that archive mode can be enabled from a point forward, allowing an archive cluster where different nodes retain different historical state segments. For a data company, that pattern is often better than trying to make every archive replica genesis-complete and proof-complete.

Practical pattern:

- Hot archive: recent months, SSD/NVMe, high query rate.
- Warm archive: older high-demand ranges, slower disks acceptable if indexed well.
- Cold archive: object storage/era files/backups for replay, audits, and rehydration.
- Proof tier: smaller fleet, explicit SLO and pricing because it is materially more expensive.

4. Treat history expiry as a call to own your history pipeline.

As clients prune old block history by default, your infrastructure should not depend on random p2p peers for old blocks/receipts. Maintain verified era files or equivalent immutable archives, with routine restore tests. This is both a cost-control measure and a product moat.

5. Run a Glamsterdam readiness branch.

Before the fork, test your stack against devnets/client releases for:

- EIP-7928 BAL RPC/API behavior and storage overhead.
- Gas-estimation changes from EIP-8037 and EIP-8038.
- Trace/debug differences caused by access-list and repricing changes.
- Sync behavior with snap/2 or BAL-assisted healing if your chosen clients support it.

6. Do not promise customers cheaper archive state because of statelessness.

Stateless validation may eventually reduce what validators must store, but it does not make historical state disappear. In fact, if validators store less state, specialized state providers, RPC companies, searchers, builders, and explorers become the entities expected to hold and serve it. That is closer to your business becoming more essential than to your storage bill going away.

## Budget stance for the next 18-24 months

Base case:

- Continue buying for archive-state growth using your measured trend.
- Add a stress case for higher gas limits and higher state-creating demand.
- Assume no protocol state expiry benefit before September 2028.
- Assume some full-node/history-tier savings from history expiry, but not archive-state savings.
- Budget engineering time for Glamsterdam client upgrades, gas-model changes, and BAL-related API/testing work.

Upside case:

- Modern path/flat archive storage reduces per-replica footprint if product semantics allow it.
- BAL/snap improvements reduce bootstrap and healing times for some tiers.
- Better gas pricing slows the worst forms of state creation.

Downside case:

- Gas limits rise faster than repricing suppresses state creation.
- Historical proof support remains expensive and customer-visible.
- Hegota/I* state work slips or changes shape.
- Client storage migrations require parallel old/new fleets during cutover.

The conservative procurement recommendation is to reserve hardware and cloud budget as though protocol state relief does not arrive in-window, while funding engineering work that lets you harvest client-level savings as soon as they are production-safe.

## Sources checked

- Forkcast upgrade tracker API: https://forkcast.org/api/upgrades.json
- Forkcast EIP tracker API: https://forkcast.org/api/eips.json
- EIP-4444, Bound Historical Data in Execution Clients: https://eips.ethereum.org/EIPS/eip-4444
- EIP-7642, eth/69 history expiry and simpler receipts: https://eips.ethereum.org/EIPS/eip-7642
- EIP-7928, Block-Level Access Lists: https://eips.ethereum.org/EIPS/eip-7928
- EIP-8037, State Creation Gas Cost Increase: https://eips.ethereum.org/EIPS/eip-8037
- EIP-8038, State-access gas cost update: https://eips.ethereum.org/EIPS/eip-8038
- EIP-7864, Ethereum state using a unified binary tree: https://eips.ethereum.org/EIPS/eip-7864
- Ethereum.org Merkle Patricia Trie docs: https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie
- Geth archive mode docs: https://geth.ethereum.org/docs/fundamentals/archive
- Ethereum Foundation, Partial history expiry announcement, 2025-07-08: https://blog.ethereum.org/2025/07/08/partial-history-exp
- Ethereum Foundation, The Future of Ethereum's State, 2025-12-16: https://blog.ethereum.org/2025/12/16/future-of-state
- Ethereum Foundation, Protocol Priorities Update for 2026, 2026-02-18: https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026
- Ethereum Foundation, EF Protocol: Current and Emerging Priorities, 2026-09-07: https://blog.ethereum.org/2026/09/07/protocol-priorities
- Forkcast ACDE #243 summary in `search-light.json`, 2026-08-13, history-expiry discussion: https://forkcast.org/search-light.json
