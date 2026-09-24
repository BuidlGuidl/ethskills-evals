# Ethereum State Growth Brief

Date: 2026-09-23

## Executive Summary

For the next 18-24 months, plan as if Ethereum mainnet state continues to grow and archive-node storage does not receive meaningful protocol-level relief. There are real protocol upgrades in flight, but the bankable ones are mostly about blob scaling, block production, gas repricing, and sync mechanics. They do not delete historical state and they do not remove the need for archive infrastructure that serves historical `eth_call`, `eth_getBalance`, `eth_getStorageAt`, traces, proofs, or internal indexes.

The useful near-term relief is operational rather than protocol-level:

- Apply partial history expiry and pruning to full nodes that do not need pre-Merge block bodies/receipts. This is already supported across execution clients and can save roughly 300-500 GB per full node, but it does not reduce current state and is not a substitute for archive nodes.
- Re-evaluate archive client/storage mode by API requirement. Modern path-based archive modes can be far smaller and faster to sync than legacy hash-based archives, but there are tradeoffs around historical trie proofs and retention.
- Treat Glamsterdam as likely inside the planning window, but do not budget storage reductions from it. Its state-related EIPs mainly reprice state creation/access and make execution/sync more parallelizable; they slow or price state growth, not reverse it.
- Treat binary-tree/statelessness/state-expiry work as strategically important but not finance-bankable for this planning cycle unless it becomes Scheduled for Inclusion in a named fork.

Budget recommendation: maintain capacity for continued archive growth, keep headroom for gas-limit-driven state growth, and fund a client/mode migration project before buying the next large tranche of storage.

## What Is Driving State Growth

Ethereum is an account-based state machine. The execution layer maintains a global state containing account balances, nonces, contract code, and contract storage. That state is committed into each block by a `stateRoot`.

Today, Ethereum execution state is stored as Merkle Patricia tries:

- One global state trie maps `keccak256(address)` to an RLP-encoded account object.
- Each account object contains `[nonce, balance, storageRoot, codeHash]`.
- Contract storage lives in a separate storage trie per account.
- Contract code is stored by hash and referenced by `codeHash`.

This structure is cryptographically useful because the block header commits to a single root, but it is operationally expensive:

- Reads and writes traverse multiple trie nodes, causing random database I/O.
- Updating state creates new trie nodes along modified paths.
- The protocol has no general state expiry or rent. Once an account, contract, or nonzero storage slot exists, the live state burden remains until explicitly cleared, and many contracts never clear storage.
- A full node only needs the current/recent state to validate the chain, so it can prune old states.
- An archive node keeps historical state availability, either by retaining historical trie nodes, flat-state history, reverse diffs, indexes, or some client-specific combination. That is why archive nodes grow differently from full nodes.

Important distinction for finance: "state growth" is not the same thing as "chain history growth."

- State: current account/code/storage dataset plus historical state versions needed for archive queries.
- History: blocks, transactions, receipts/logs, headers, and blob sidecar retention.
- Indexes: traces, token balances, decoded events, custom product databases.

Protocol upgrades can reduce one category without helping the others. EIP-4444-style history expiry helps ordinary full nodes shed old block bodies/receipts. It does not remove the current state, and it does not remove your need to serve historical state if that is part of the product.

## Current Baseline Numbers Worth Using

Use these as order-of-magnitude planning anchors, not universal fleet measurements:

- Ethereum.org still describes many archive implementations as requiring 3-12 TB depending on client, with SSDs required for practical sync/update performance.
- Geth's legacy hash-based archive mode can exceed 20 TB and can take months to sync from genesis.
- Geth's newer path-based archive mode reports roughly 2 TB for full flat state history, or about 6.5 TB when full flat states are stored alongside historical trie data. Sync time is documented around two weeks.
- A Glamsterdam state-growth EIP cites January 2026 Geth state-database size around 390 GiB, post gas-limit-increase new state growth around 326 MiB/day, or roughly 116 GiB/year. It also warns that extrapolating to a 200M gas limit would imply roughly 387 GiB/year of state growth.

Those numbers are client-specific and workload-specific, but the direction is the key point: recent gas-limit increases already increased state creation, and future L1 scaling can increase state pressure unless repricing succeeds.

## Protocol Roadmap: Bankable vs Aspirational

### Already Shipped Or Operational

**Partial history expiry / pre-Merge history pruning**

Status: shipped at the client level in 2025.

All major execution clients support partial history expiry in accordance with EIP-4444 work. The Ethereum Foundation announcement says operators can reduce disk by roughly 300-500 GB by removing pre-Merge block data.

How much to bank: high confidence for full-node fleet savings where old block bodies/receipts are not needed. Low relevance for archive nodes that serve historical block, receipt, trace, or state queries.

Operational impact:

- Good for validator/full RPC nodes.
- Useful for reducing sync/storage of non-archive infrastructure.
- Does not shrink current state.
- Does not solve archive-state growth.
- May increase the value of your company as a history/archive provider because fewer ordinary nodes will keep old data.

**Fusaka**

Status: mainnet activation was December 3, 2025.

Fusaka included PeerDAS and Blob Parameter Only forks. This matters for blob data and L2 data availability, not archive state. It helps Ethereum scale rollup data without every full node downloading/storing every blob, and it allows blob capacity to increase between major forks.

How much to bank: high confidence that it reduces blob-scaling pressure on normal nodes. Do not count it as archive-state relief.

### Likely Inside The Planning Window

**Glamsterdam**

Status as of 2026-09-23: Scheduled EIPs are listed in EIP-7773, Sepolia activation is scheduled for 2026-10-06, but the mainnet activation row is not yet filled. Ethereum.org describes mainnet as expected in Q4 2026 with no confirmed date.

Relevant scheduled items:

- EIP-7732, enshrined proposer-builder separation: gives execution/data validation more time and changes block production. It is not a state-size reduction.
- EIP-7928, Block-Level Access Lists: records accounts/storage touched by a block and post-execution values. This enables parallel disk reads, parallel validation, state-root calculation, and executionless state updates. It can improve sync/update mechanics but does not delete archive state.
- EIP-8037, State Creation Gas Cost Increase: raises and separates pricing for state creation, explicitly targeting an average state growth of 120 GiB/year at a 150M gas reference point.
- EIP-8038, State-access gas cost update: reprices state access to reflect larger state and slower operations.

How much to bank: medium-high for some version of Glamsterdam landing in the planning window; low for it reducing disk requirements. Assume it may slow state growth per unit of activity, but also assume Ethereum will use the gained headroom to raise throughput over time.

Budget interpretation: do not reduce hardware forecasts because of Glamsterdam. Instead, treat it as a reason to model a wider range: lower state growth if repricing bites, higher state growth if higher gas limits and usage dominate.

### Not Bankable In The Planning Window

**Binary state tree / Verkle replacement / statelessness**

Status: active research and draft-EIP work, not scheduled in Glamsterdam.

The older roadmap centered on Verkle trees. Current primary EIPs also include a hash-based binary-tree direction, such as EIP-7864 and EIP-8297. These aim to replace the current hexary Patricia structure with a more proof-friendly state tree, improve witness/proof sizes, and support future statelessness.

Why this matters eventually:

- Smaller witnesses/proofs.
- Better path toward stateless or partially stateless validation.
- Better ZK/proving friendliness.
- Potential simplification of the "tree of trees" structure.

Why not to budget relief from it now:

- The relevant EIPs are Draft.
- They are not listed as Scheduled for Inclusion in Glamsterdam.
- Hash-function choices and transition details remain open.
- Even a successful tree migration does not automatically remove your obligation to serve historical state. It changes the commitment/data structure and may alter future archive formats.

Planning assumption: no production mainnet storage relief from statelessness/tree replacement before late 2028 unless fork status changes materially.

**State expiry / state tiering**

Status: research/draft proposals, not scheduled in Glamsterdam.

State expiry would move inactive state out of the hot active set and require proofs to revive it. Newer draft work such as EIP-8296 explores fixed-cutoff state tiering: inactive state stays in the trie but writes to long-unmutated state become more expensive, with an eye toward separating cold state into immutable, shareable files.

This is exactly the class of work that would help node operators most, but it is not ready to plan budget savings around.

Planning assumption: do not count on state expiry reducing archive storage in the next 18-24 months.

**Full rolling history expiry**

Status: ongoing but not a complete solution for your archive-state problem.

History expiry can reduce the requirement that every normal full node stores old block bodies and receipts. It does not remove state, and archive/history providers still need to retain and serve old data for applications, audits, L2 derivation, and analytics.

Planning assumption: helpful for non-archive nodes; neutral-to-positive for archive business demand; not a cost reducer for your archive product unless you intentionally narrow historical service coverage.

## Operational Recommendations

### 1. Classify Nodes By Product Obligation, Not By Habit

Create explicit service tiers:

- Full validation/RPC: current state, recent history, no historical state SLA.
- Historical flat-state archive: historical balances/storage/calls, but not necessarily historical Merkle proofs.
- Proof-capable archive: supports historical `eth_getProof` or other proof surfaces.
- Trace/index archive: supports debug/trace APIs and internal analytics indexes.
- History provider: old blocks/receipts/logs, including pre-Merge and L2-relevant data.

Then map each tier to a client mode. Do not run proof-capable, hash-based, full-history archives where flat-state history satisfies the product.

### 2. Benchmark Modern Archive Modes Before Buying Storage

Run a controlled bakeoff using your real query mix:

- Geth path-based archive with required `--history.state` and, if needed, `--history.trienode` settings.
- Erigon archive mode for space-efficient historical queries.
- Reth archive/history modes if they match your operational maturity requirements.
- Your current production client as the control.

Measure:

- Disk at sync completion.
- Daily growth rate.
- Time to sync/reindex from scratch.
- Compaction stalls and write amplification.
- p50/p95/p99 for your top archive RPC methods.
- Behavior under reorgs and backfills.
- Whether historical proofs, traces, and storage queries match your SLA.

Decision rule: buy storage only after separating "must retain historical trie proofs" from "must answer historical state values." The cost difference can be multiple TB per node.

### 3. Use History Expiry Aggressively On Non-Archive Nodes

For full nodes and load-balanced current-state RPC nodes:

- Enable client-supported partial history expiry where safe.
- Do not store pre-Merge bodies/receipts unless a workload explicitly needs them.
- Keep archive/history traffic off these nodes.

This gives real savings now and shortens recovery/sync paths, even though it does not solve archive state.

### 4. Separate Archive Storage From Query Indexes

For a data company, archive nodes should not be the only source of historical product answers.

Recommended pattern:

- Keep canonical archive nodes for correctness, replay, and gap filling.
- Maintain columnar/indexed stores for high-volume product queries.
- Make historical state queries idempotent and cacheable.
- Track which API families truly require live archive RPC versus internal indexes.

This reduces pressure to scale archive-node count linearly with customer query volume.

### 5. Plan Capacity With A No-Relief Base Case

For finance:

- Base case: no protocol state expiry before September 2028.
- Upside case: Glamsterdam repricing reduces state growth per unit of demand, but does not lower archive storage.
- Downside case: higher gas limits and L1 usage increase state creation despite repricing.

Recommended reserve:

- Keep at least 12 months of disk headroom per archive cluster after measured compaction overhead.
- Track daily growth as a rolling 30/90-day metric per client and per data class: state, history, indexes, ancient data, freezer data, traces.
- Avoid capex plans that depend on a fork date unless the EIP is Scheduled for Inclusion and mainnet activation has been set.

### 6. Add Roadmap Triggers To Procurement

Review procurement assumptions when one of these happens:

- A fork meta EIP lists a state-tree, state-expiry, or state-tiering EIP as Scheduled for Inclusion.
- Mainnet activation is assigned for that fork.
- At least two execution clients expose production-ready archive migration paths for the new format.
- Your required RPC/proof surfaces are supported in those modes.

Until then, protocol roadmap items should be treated as strategic monitoring, not storage budget reduction.

## Bottom Line

Ethereum is working on the state problem, but the pieces that would materially change archive-node economics are not yet scheduled for mainnet. Inside the 18-24 month planning window, the dependable savings come from client selection, archive-mode choice, history pruning on non-archive nodes, and reducing duplicated archive workloads with indexing.

For budget purposes: assume continued archive growth; do not assume state expiry, statelessness, Verkle, or binary-tree migration saves you money before the next hardware cycle. Put engineering time into measuring and migrating archive modes now, because that is the lever you actually control.

## Sources Checked

- Ethereum archive nodes: https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes
- Ethereum Merkle Patricia Trie docs: https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie
- Geth archive mode docs: https://geth.ethereum.org/docs/fundamentals/archive
- EF partial history expiry announcement, 2025-07-08: https://blog.ethereum.org/2025/07/08/partial-history-exp
- EIP-7607 Fusaka meta: https://eips.ethereum.org/EIPS/eip-7607
- EIP-7773 Glamsterdam meta: https://eips.ethereum.org/EIPS/eip-7773
- Ethereum.org Glamsterdam status page: https://ethereum.org/roadmap/glamsterdam/
- EIP-7928 Block-Level Access Lists: https://eips.ethereum.org/EIPS/eip-7928
- EIP-8037 State Creation Gas Cost Increase: https://eips.ethereum.org/EIPS/eip-8037
- EIP-8038 State-access gas cost update: https://eips.ethereum.org/EIPS/eip-8038
- EIP-7864 Unified binary state tree: https://eips.ethereum.org/EIPS/eip-7864
- EIP-8297 Partitioned Binary Tree: https://eips.ethereum.org/EIPS/eip-8297
- EIP-8296 Fixed-Cutoff State Tiering: https://eips.ethereum.org/EIPS/eip-8296
- EF "The Future of Ethereum's State", 2025-12-16: https://blog.ethereum.org/2025/12/16/future-of-state
