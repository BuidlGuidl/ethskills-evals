# Ethereum State Growth Brief

Date: 2026-09-23

## Executive Summary

State growth is a structural cost of Ethereum's current design, not an incident or a client bug. Ethereum keeps a globally committed world state: accounts, contract code, and contract storage. New accounts, new storage slots, and new bytecode create durable data that nodes must be able to access forever unless the protocol later defines expiry. Archive nodes add a second burden: they retain historical state views, indexes, and history needed to answer old-block queries. That is why archive capacity keeps growing even when a normal full node can prune.

For the next 18-24 months, do not budget on Ethereum mainnet shipping full state expiry or stateless validation in a way that makes archive-node storage cheap. Those items remain draft/research-level, and the current direction has shifted from the older "Verkle is next" story toward binary-tree/statelessness work whose final approach is still not locked. The realistic near-term relief is narrower:

- Partial history expiry has landed in clients, but it reduces full-node historical body/receipt burden, not your need to serve archive-state queries.
- Glamsterdam is in devnet testing, expected Q4 2026 with no final mainnet date, and includes state-related gas repricings. If it lands, it should slow state growth per unit of throughput and make future gas-limit increases less dangerous. It does not delete existing state or remove archive requirements.
- Binary-tree/statelessness/state expiry are strategically important, but should be treated as outside the hard planning window for production archive capacity.

Operational recommendation: plan capacity assuming archive storage continues to grow materially through 2028. Standardize around storage-efficient archive clients for most archive RPC workloads, keep a smaller number of legacy/proof-capable archives only where required, separate "head following" from "historical data service", and build a rolling resync/rebuild and growth-measurement program rather than waiting for protocol relief.

## What Is Driving Growth

Ethereum is account/state based. The current state is the set of all live accounts and contract data the EVM may need when executing the next block. This includes:

- Externally owned account records: nonce, ETH balance, code hash, and storage root.
- Contract accounts: bytecode plus storage.
- Contract storage slots: 32-byte key/value storage under a contract.

The committed data structure today is the modified Merkle-Patricia Trie (MPT). The block header commits to a state root. To verify a block, clients execute transactions against local state and check that the resulting root matches the block's claimed state root. Ethereum.org describes an account as `[nonce,balance,storageRoot,codeHash]`, and each contract's storage root points to another trie of storage contents.

The important operational consequences:

1. State writes are durable.
   A transfer to a fresh account, a contract deployment, or an `SSTORE` from zero to nonzero adds data future blocks may need. There is no protocol-level rent or automatic deletion for old-but-valid state.

2. Gas historically did not price all durable state equally.
   State growth EIPs note that contract code, new accounts, and storage slots have had inconsistent gas-per-byte costs. EIP-8037 says that, as of January 2026, Geth state data was about 390 GiB and that after the gas limit moved from 30M to 60M, new state added per day rose from about 105 MiB/day to about 326 MiB/day, or roughly 116 GiB/year. It also models 200M gas without repricing at about 387 GiB/year.

3. Archive nodes pay for history, not only the current tip.
   A pruned full node needs recent chain data and the latest state sufficient to validate new blocks. An archive node must answer questions like "what was this balance/storage slot at block N?" That requires retaining or reconstructing historical state. Different clients store this very differently, which is why "archive node size" varies from a few TB to well over 12 TB depending on client and mode.

4. State size hurts performance, not just capacity.
   Larger state means colder database reads, larger working sets, more compaction or page-cache pressure, longer sync/rebuild times, and slower worst-case block execution. The EF's 2025 state roadmap post says larger state makes syncing slower and more fragile, raises costs for full nodes and RPC providers, and can concentrate state-serving among specialist operators.

## Current Protocol/Client Situation

### Already Landed Or Usable

Partial history expiry is usable in clients. The Ethereum Foundation announced in July 2025 that all execution clients support partial history expiry aligned with EIP-4444-style goals. Geth, Nethermind, Besu, Erigon, and Reth each expose different flags or defaults. This can reclaim old block bodies and receipts or avoid downloading pre-Merge history for some configurations.

This is useful for validator/full-node operations, but it is not archive-state relief. EIP-4444 itself is still marked Draft and concerns historical headers/bodies/receipts on the p2p layer. It does not make old account/storage state disappear, and it explicitly leaves historical data preservation to external operators.

Client-side archive improvements are real and worth using:

- Geth path-based archive mode, introduced in v1.16.0, is much more compact than legacy hash-based archive mode. Geth docs say a mainnet archive with full flat state history is around 2 TB, or about 6.5 TB if also storing historical trie data for historical `eth_getProof`.
- Erigon documentation says an archive node fits on one 4 TB NVMe drive and recommends avoiding RAID0; use redundancy rather than striping when possible.
- Ethereum.org's node table lists full archive sizes around 2.2-2.5 TB+ for Reth/Erigon and 12 TB+ for Besu/Geth/Nethermind legacy-style archives. These figures depend heavily on mode, indexes, pruning flags, RPC expectations, and version.

### Scheduled/Testing: Glamsterdam

Glamsterdam is the next mainnet upgrade under active testing. Ethereum.org currently lists it as "Testing on devnets", expected Q4 2026 with no confirmed mainnet date, and a Sepolia fork milestone on 2026-10-06. Its state-relevant parts are gas repricings and block/state-access plumbing, not expiry.

The most relevant items for state growth are:

- EIP-8037, State Creation Gas Cost Increase: raises and harmonizes the cost of creating durable state. It introduces a cost-per-state-byte model targeting about 120 GiB/year at a 150M reference gas limit. Its table gives worst-case state-growth rates of 80 GiB/year at 100M gas, 120 GiB/year at 150M, 160 GiB/year at 200M, 200 GiB/year at 250M, and 240 GiB/year at 300M.
- EIP-8038, State-access Gas Cost Update: reprices state access operations to reflect the larger current state and measured client performance.
- EIP-2780 and related repricings: reduce some non-state-heavy transaction costs while adding surcharges for state-creating behavior.
- EIP-7928, block-level access lists: supports better execution scheduling/parallelization and is a Glamsterdam headliner.

Assessment: budget with "moderate confidence" that some form of Glamsterdam state repricing lands inside the planning window, but not as a storage-reduction event. It may slow the slope and make higher throughput less explosive for state growth. It will not reduce the archive estate you already have.

### Draft/Research: Binary Trees, Statelessness, State Expiry

Older public roadmap pages still describe Verkle trees as the stepping stone to stateless Ethereum, with much smaller witnesses. But the newer 2026 direction is less settled. Ethereum.org's security roadmap says work on statelessness is being redesigned around quantum-safe binary hash trees, with the final approach not yet confirmed. EIP-7864, "Ethereum state using a unified binary tree", is Draft and says the binary tree would start empty while the current MPT remains frozen, setting up a later hard fork to migrate old MPT data.

Weak statelessness would let most validators verify blocks using witnesses instead of storing the full state, while block builders/RPC providers/specialist operators still hold and serve state. Ethereum.org's statelessness page still says weak statelessness, history expiry, and state expiry are in research and expected several years out, with no guarantee all proposals ship.

State expiry is the item that would most directly cap long-lived state burden: old inactive state would become inactive and need proofs/resurrection to use again. It remains the least bankable item for this planning cycle. It changes application semantics and developer assumptions, so it is unlikely to appear suddenly as a low-risk late addition.

Assessment: do not put any 2027-2028 hardware savings in the finance model for state expiry/statelessness. Track it as strategic upside only.

## What To Bank On

| Item | Status as of 2026-09-23 | Impact on archive fleet | Planning confidence |
| --- | --- | --- | --- |
| Partial history expiry | Client support exists; EIP-4444 still Draft | Helps pruned/full nodes and bootstrap/history footprint; does not solve archive state | High for full-node savings, low for archive savings |
| Geth path-based archive / Erigon / Reth storage models | Available client-level improvements | Can materially reduce per-archive TB if compatible with required RPC semantics | High, test per workload |
| Glamsterdam repricing | Devnet testing; Q4 2026 expected, no confirmed mainnet date | Slows future state-growth pressure; no deletion of existing archive data | Medium |
| Binary tree transition | Draft EIP and active client/research work | Foundation for future statelessness/proofs; not an immediate archive reduction | Low inside 18-24 months |
| Weak statelessness | Research/roadmap item | Validators lighter; specialist state servers still needed | Low inside 18-24 months |
| State expiry | Research/roadmap item | Could cap long-term state; disruptive and unscheduled | Very low inside 18-24 months |

## Operational Plan For The Next 18-24 Months

### 1. Model Archive Growth From Your Own Fleet

Finance should not use a single public "archive node size" number. Client mode dominates. Build a monthly capacity report per client/mode:

- Datadir size by component, not just filesystem total.
- Daily and weekly growth rate.
- Free-space runway at 70%, 80%, and 90% disk utilization.
- Rebuild/resync time by client and hardware class.
- Query latency impact as DB grows.
- Whether the node serves traces, debug APIs, historical proofs, logs, or only `eth_call`/balance/storage at old blocks.

Use public numbers as sanity checks: Geth full nodes grow around 14 GB/week before pruning in current docs; legacy archive modes are still commonly documented at 12 TB+; Nethermind docs historically cite 14 TB+ and 60 GB/week for archive mode; Erigon/Reth/Geth path-based modes can be far smaller.

### 2. Segment Node Roles

Do not make every machine a maximum-retention archive node.

- Head/full-node tier: pruned full nodes with partial history expiry enabled where compatible. These should be cheap to rebuild and should not carry archive query load.
- Archive RPC tier: storage-efficient archive clients for balance/storage/code/`eth_call` at historical blocks.
- Proof/trie-compatibility tier: a smaller pool that retains historical trie data if customers require historical `eth_getProof` or MPT-specific behavior.
- Index/analytics tier: columnar/log/index databases for product queries. Do not force general archive nodes to behave like analytical databases.
- Cold historical tier: snapshots, object storage, and reproducible rebuild artifacts for disaster recovery and compliance.

### 3. Choose Client Modes By Required Semantics

Recommended default: evaluate Erigon and Reth for high-volume historical RPC because the storage profile is materially better. Keep Geth path-based archive in the mix where Geth behavior or client diversity matters.

Be careful with Geth path-based archive mode: the compact mode is attractive, but historical Merkle proofs require retaining historical trie nodes. Geth documentation says v1.16 path archive does not support historical `eth_getProof`; v1.17 supports it only when trie-node history retention is configured, with a larger footprint.

Avoid building new capacity around legacy hash-based archives unless a specific customer/API contract requires it.

### 4. Hardware Guidance

For new archive capacity, buy for I/O consistency and rebuild safety, not just raw TB.

- Prefer high-end TLC/enterprise NVMe. Avoid DRAM-less and QLC drives for hot execution/archive workloads.
- Keep at least 25-30% free space on hot archive volumes; many client databases degrade badly near full disks.
- Prefer single large NVMe or mirrored NVMe over RAID0. Erigon docs explicitly warn that RAID0 adds failure risk without being needed when a 4 TB drive fits the archive.
- For compact archive nodes, treat 4 TB as a minimum/current-fit class and 8 TB as the more finance-safe procurement class for 18-24 months, especially if you keep indexes, snapshots, logs, or multiple clients on the same host.
- For legacy/proof-heavy archive nodes, budget 16-24 TB usable per node class unless your own measurements prove lower. These should be fewer, explicitly justified machines.
- Keep rebuild capacity: spare disks/hosts and automation should assume a full archive rebuild can take days to weeks depending on client, mode, hardware, and peer availability.

### 5. Reduce Data Product Dependence On Raw Archive RPC

Archive nodes are a weak abstraction for analytics-heavy workloads. For predictable service and finance planning:

- Materialize high-demand historical series into your own indexed stores.
- Cache hot historical calls and contract storage reads.
- Precompute customer-facing datasets from receipts/logs/traces rather than repeatedly asking archive RPC.
- Use object storage for immutable artifacts: block bodies, receipts, snapshots, exported tables, and periodic database snapshots.
- Track which customer/API methods truly need archive state versus indexed historical events.

### 6. Track Protocol Milestones, But Do Not Wait For Them

Watch these checkpoints:

- Glamsterdam testnet/mainnet dates and final included repricing EIPs.
- Actual post-Glamsterdam gas-limit behavior; validators may raise limits gradually, and higher throughput can offset some repricing benefit.
- EIP-8037/8038 final constants and client gas-estimation behavior.
- EIP-7864/binary-tree progress, especially any fork assignment.
- Any credible state-expiry proposal moving from research to a named upgrade.
- Client release notes for archive mode, historical proof support, and pruning/history-expiry defaults.

Translate protocol progress into the budget only after mainnet activation and at least one month of measured fleet data. Before that, carry it as upside.

## Budget Baseline

For finance, use three scenarios:

1. Conservative baseline: no protocol-level archive relief through September 2028. Compact archive nodes grow materially; legacy/proof-heavy archive nodes continue to require large NVMe pools. This should be the approved budget.

2. Moderate upside: Glamsterdam lands in late 2026 or early 2027 and state repricing slows net-new state growth, but gas-limit increases consume part of the savings. Archive storage still grows, just less violently than an unrepriced high-throughput path.

3. Strategic upside: binary-tree/statelessness/state-expiry work advances faster than expected. Treat this as a capex deferral opportunity, not as the base case.

Procurement rule of thumb: use 8 TB NVMe-class machines as the standard compact-archive unit and reserve 16-24 TB usable configurations for proof-heavy or legacy archive service. Revisit quarterly using observed fleet growth.

## Sources

- Ethereum.org, "Merkle Patricia Trie": https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/
- Ethereum.org, "Ethereum accounts": https://ethereum.org/developers/docs/accounts/
- Ethereum Foundation, "The Future of Ethereum's State" (2025-12-16): https://blog.ethereum.org/2025/12/16/future-of-state
- Ethereum.org, "Statelessness, state expiry and history expiry" (updated 2026-06-30): https://ethereum.org/roadmap/statelessness/
- Ethereum.org, "Verkle trees" (updated 2026-06-24): https://ethereum.org/roadmap/verkle-trees
- Ethereum.org, "Glamsterdam": https://ethereum.org/roadmap/glamsterdam/
- Ethereum Foundation, "Glamsterdam Repricing Impact for Smart Contract Developers" (2026-08-24): https://blog.ethereum.org/2026/08/24/glamsterdam-repricing-testing
- EIP-4444, "Bound Historical Data in Execution Clients": https://eips.ethereum.org/EIPS/eip-4444
- Ethereum Foundation, "Partial history expiry announcement" (2025-07-08): https://blog.ethereum.org/2025/07/08/partial-history-exp
- EIP-8037, "State Creation Gas Cost Increase": https://eips.ethereum.org/EIPS/eip-8037
- EIP-8038, "State-access gas cost update": https://eips.ethereum.org/EIPS/eip-8038
- EIP-7864, "Ethereum state using a unified binary tree": https://eips.ethereum.org/EIPS/eip-7864
- Geth docs, "Archive mode": https://geth.ethereum.org/docs/fundamentals/archive
- Geth docs, "Database pruning": https://geth.ethereum.org/docs/fundamentals/dbpruning
- Erigon docs, "Hardware Requirements": https://docs.erigon.tech/get-started/hardware-requirements
- Ethereum.org, "Spin up your own Ethereum node": https://ethereum.org/developers/docs/nodes-and-clients/run-a-node
- Ethereum.org, "Ethereum Archive Node": https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes
