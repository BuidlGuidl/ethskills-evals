# Ethereum State Growth: Technical and Capacity Brief

As of: 2026-09-23

Audience: infrastructure, data platform, finance

## Executive takeaways

State growth is not a temporary client bug. It is a structural result of Ethereum's account model, persistent contract storage, and the current Merkle Patricia Trie state commitment. Every full node must track the current state; archive nodes additionally need enough historical state data or change history to answer old-block queries. That archive requirement is where disk and sync time become painful.

For the next 18-24 months, do not budget on state expiry, stateless Ethereum, Verkle/PBT migration, or any protocol change that shrinks archive-node storage. The only near-term protocol work that is plausibly bankable is state-creation repricing in Glamsterdam. It can reduce the rate of new state growth if it ships and if demand responds as expected, but it will not reduce your existing archive footprint.

Operationally, treat protocol relief as upside. The baseline plan should be: move archive capacity to storage-efficient clients and modes, split archive responsibilities by query type, keep legacy/full-trie-proof support isolated, retain large free-space margins, and instrument growth by client and data category weekly.

Budget shorthand:

| Item | Planning stance |
| --- | --- |
| Partial history expiry / EIP-4444-style pruning | Useful for full/pruned nodes; not a solution for archive state queries. |
| Glamsterdam state gas / EIP-8037 | Likely near-term curve-bender; do not assume disk reduction. |
| Block-level access lists | Helpful for execution, prefetch, and future migration; not storage relief by itself. |
| Binary tree / PBT / Verkle successor work | Important, but still draft/migration work; do not count as archive-storage relief inside the current budget cycle. |
| State expiry / weak statelessness | Several-years horizon; zero budget credit for 2026-2028 capacity. |

## What is actually growing

Ethereum has three related but distinct data burdens:

1. Chain history: block headers, block bodies, transactions, and receipts/logs.
2. Current state: the latest account and contract-storage database required to validate and execute new blocks.
3. Historical state: enough information to answer "what was this account/storage/code at block N?" for old blocks.

Full nodes primarily need current state plus enough recent chain data for sync and serving normal RPC. Archive nodes need historical state access from genesis or from whatever range they promise. That is why an archive node is not merely a "bigger full node"; it is a different service commitment.

### Ethereum's state layout

Ethereum uses an account-based state model. The execution-layer block header commits to a `stateRoot`, `transactionsRoot`, and `receiptsRoot`. The state root is the root of a global modified Merkle Patricia Trie. Each account leaf contains:

```text
[nonce, balance, storageRoot, codeHash]
```

The `storageRoot` points to a separate storage trie for that account. Contract bytecode is stored by hash. In practice, state growth comes from:

- new externally owned accounts or contract accounts,
- contract bytecode deployments,
- new non-zero storage slots, especially mappings in ERC-20s, NFTs, DeFi protocols, bridges, rollup inbox/outbox contracts, or application-specific registries,
- long-lived "dust" and abandoned state that remains economically cheap to create relative to the long-term operator cost,
- trie/index overhead in clients, not only the raw bytes of account or slot values.

The current MPT is also operationally expensive. Account and storage keys are hashed, so reads and writes are scattered across the database. A single logical account or storage update requires touching trie nodes along the path and then updating commitments up to the root. This is bad for disk locality and explains why Ethereum nodes are latency-sensitive even on fast SSDs.

### Why archive nodes hurt more than full nodes

A pruned full node can discard old state trie nodes or state-change history after it has advanced past them. An archive node cannot, unless it deliberately limits its archive range. Depending on client design, an archive node either:

- stores historical trie nodes so old state roots can be traversed directly,
- stores flat state plus historical change sets and indices so old state can be reconstructed,
- or stores a hybrid of flat state, trie nodes, receipts, logs, transaction lookup, and other indices.

That is why archive-node sizes differ dramatically by client. Ethereum.org currently lists full archive estimates of `12TB+` for Besu/Geth/Nethermind, `2.5TB+` for Erigon, and `2.2TB+` for Reth. Erigon's July 2026 docs report a measured Ethereum mainnet archive footprint of about `2.03 TB` with a `4 TB` recommended disk. Geth's newer path-based archive mode reports about `2 TB` for full flat state history, or roughly `6.5 TB` if storing historical trie data alongside flat states for historical proof support.

The important capacity lesson: "archive node" is not one hardware number. It depends on whether you need historical balances/storage only, historical traces, historical receipts/logs, historical `eth_getProof`, custom indices, and what latency/RTO you promise.

## What protocol changes are coming

### 1. History expiry: real, useful, but mostly not your archive-state problem

EIP-4444 proposes bounding historical headers, bodies, and receipts served by execution clients. The EIP is still marked Draft, but the ecosystem has already moved in stages: the Ethereum Foundation announced in July 2025 that all execution clients supported partial history expiry, letting users remove pre-Merge block data and reduce node disk by about `300-500 GB`.

This helps ordinary full-node operators and some validators. It does not remove current state. It also does not preserve your ability to answer arbitrary historical state queries. In fact, the EF announcement explicitly notes that past balance/state queries require archive nodes or specialized indexes.

Planning implication:

- Use history expiry aggressively for non-archive validation/RPC nodes where your product does not need old block bodies/receipts locally.
- Do not count it as a material archive-state relief mechanism.
- If you serve historical logs, traces, receipts, or rollup data reconstruction, you still need a deliberate history-retention and indexing plan.

### 2. Glamsterdam: likely near-term help for future state growth, not disk shrinkage

Glamsterdam is the next major upgrade currently shown by ethereum.org as "testing on devnets" with mainnet expected in Q4 2026, date not confirmed. Scope can still change before mainnet.

The state-relevant parts are:

- EIP-8037, State Creation Gas Cost Increase: introduces a separate state-gas dimension and a cost per state byte (`CPSB`) to price permanent state creation more directly.
- EIP-8038 and related gas repricing: updates state-access costs.
- EIP-7928, Block-Level Access Lists: records the accounts, storage slots, code, balance, and nonce changes touched by a block, enabling prefetch, parallel disk reads, and future migration machinery.

EIP-8037's motivation gives the clearest current public numbers: as of January 2026, Geth's state database dedicated to state was about `390 GiB`; after the gas limit moved from `30M` to `60M`, average new state created per day rose from about `105 MiB` to `326 MiB`, or about `116 GiB/year`. The EIP extrapolates that at a `200M` gas limit, state could grow around `387 GiB/year` without repricing.

Planning implication:

- If Glamsterdam ships with EIP-8037 substantially intact, it should make high-throughput L1 safer by pricing permanent state creation closer to operator cost.
- It will not shrink existing state or historical archive databases.
- The actual effect depends on user/application behavior after repricing and future gas-limit policy.
- Treat it as reducing downside growth risk, not as a replacement for hardware capacity.

Confidence inside 18-24 months: medium for some form of state repricing shipping, low-to-medium for finance-grade savings estimates. Do not book savings until the fork is on mainnet and you have measured post-fork growth for several weeks.

### 3. Binary tree / PBT / Verkle-successor work: important, but not budget relief yet

Ethereum's state commitment is expected to change eventually because the current MPT is bad for witnesses, validity proofs, and stateless verification. Older roadmap discussion focused on Verkle trees. Current draft work includes binary-tree proposals, including EIP-7864 and EIP-8297's Partitioned Binary Tree (PBT), plus EIP-8347 for offline migration from the current MPT to PBT.

This work is strategically important because it can make proofs smaller, proving faster, and future statelessness more realistic. But the current status is still draft/proposal-level. A September 2026 Ethereum Research post describes the PBT migration as expected later than Hegotá, in a later fork referred to as `I*`.

There is also a transition risk: EIP-8347's offline migration path says nodes may hold both the old MPT and new PBT during a transition window, "roughly doubling state storage" for that period.

Planning implication:

- Do not assume PBT/Verkle/binary-tree migration reduces archive fleet costs in the next budget cycle.
- Expect client churn and temporary extra disk requirements when migration rehearsals and activation approach.
- Track it because it will affect proof APIs, historical proof expectations, migration tooling, and possibly database formats.

Confidence inside 18-24 months: possible meaningful testnets/devnets; low confidence for production archive-storage relief. Budget as zero relief and possible temporary migration overhead.

### 4. State expiry and weak statelessness: not a near-term capacity answer

State expiry would let old inactive state become inactive unless resurrected. Weak statelessness would let most validators verify blocks without holding full state, while specialized block builders/proposers maintain state and provide witnesses.

Ethereum.org's statelessness roadmap still describes weak statelessness, history expiry, and state expiry as research-phase items expected several years from now, with dependencies such as new state trees and proposer-builder separation. It also says strong statelessness is not currently expected to be part of the roadmap.

Planning implication:

- For a data company operating archive nodes, state expiry/statelessness is not relief you can bank on before 2028.
- Even after weak statelessness, someone must store full state; data providers are likely to be among the entities still doing so.

Confidence inside 18-24 months: very low for direct operational relief.

## Capacity planning guidance

### Baseline assumption for finance

Use a no-protocol-relief baseline for archive storage through at least September 2028. Treat Glamsterdam state repricing as upside to future growth rate, not as committed savings.

For each archive fleet class, model:

```text
required capacity =
  current used bytes
  + (observed weekly growth * 104 weeks)
  + client migration / resync / compaction headroom
  + 25-35% free-space operating margin
```

Do not use public "archive node size" numbers directly as your budget model. Use them to choose client candidates, then build the budget from your own measured growth and query workload.

If you need a procurement default before a full benchmark:

- Efficient archive tier: plan on `8 TB` enterprise TLC/PLP NVMe per archive replica for 24-month headroom unless your benchmark proves `4 TB` is safe for that exact client/mode/workload.
- Legacy hash/full-trie archive tier: plan `16-24 TB+` per replica, or migrate the workload off that mode.
- Full/pruned head nodes: `2-4 TB` NVMe is still the practical class, depending on client, consensus data, pruning mode, and local history settings.
- Keep consensus-client storage separate in the model; ethereum.org suggests counting roughly another `200 GB+` for beacon data, but real usage varies by client and enabled features.

### Client and mode strategy

Run archive capacity as a product matrix, not a monolith:

| Workload | Recommended posture |
| --- | --- |
| Head RPC / normal validation | Pruned full nodes, history expiry enabled where compatible. |
| Historical `eth_getBalance`, `eth_getStorageAt`, `eth_getCode` | Storage-efficient archive clients such as Erigon, Reth, or Geth path-based archive; benchmark against your query mix. |
| Historical `eth_getProof` | Dedicated tier. Geth path-based archive needs historical trie-node retention for this; storage can be much higher. |
| Tracing / replay / custom indexes | Separate replay/indexing pipeline; avoid coupling all customer queries to canonical archive nodes. |
| Logs/receipts/history APIs | Treat as chain-history/index service; EIP-4444 makes this more explicitly your responsibility if you offer it. |

Near-term client candidates to benchmark:

- Erigon 3 archive: very storage-efficient; current docs show about `2.03 TB` measured archive usage on mainnet in July 2026 and recommend `4 TB`. Pay attention to operational characteristics, RPC compatibility, and your latency under read load.
- Reth with Storage V2: strong Rust client trajectory; ethereum.org lists `2.2TB+` for full archive, while Reth's own system-requirement page has more conservative archive hardware numbers. Benchmark on your workload rather than relying on either headline.
- Geth path-based archive: strategically useful because Geth is widely used and its path-based archive can be much smaller than legacy hash archives. Be explicit about whether you need historical trie proofs; that changes disk requirements materially.
- Besu/Nethermind legacy full archive: keep for diversity or specific compatibility only if the disk cost is justified.

### Storage operations

Recommended operating standards:

- Prefer local NVMe for hot state. Avoid network/block storage for execution-client hot databases unless you have benchmarked tail latency under block execution and RPC load.
- Use ext4 or XFS with `noatime` unless the client specifically recommends otherwise.
- Avoid filling disks. Alert at 70%, page/escalate at 80%, and consider 85% an incident threshold for archive nodes.
- Keep enough free space for compaction, pruning, snapshots, and resync staging. Some client modes fail or slow badly when the filesystem is nearly full.
- Prefer mirrors or fast restore workflows over RAID 0 for single-node archive reliability. If one modern NVMe is large enough, striping may increase failure probability without solving the main bottleneck.
- Separate hot mutable DB, immutable snapshots/history, and custom indexes where the client supports it. This can lower backup cost and improve recovery.
- Back up only what is expensive to recreate. For clients with content-addressed snapshots, full datadir backup may be wasteful; but keep enough warm replicas or snapshots to satisfy RTO.

### Measurement plan

Start a weekly state-growth report for every node class:

- execution client, version, flags, pruning/archive mode,
- consensus client, version, relevant retention flags,
- block height and date,
- total datadir bytes,
- bytes by major subdirectory or table where available,
- free space and filesystem,
- RPC/query volume and p95/p99 latency,
- weekly delta,
- resync time from empty disk and restore time from backup/snapshot.

For finance, report three scenarios quarterly:

1. Baseline: current weekly growth continues, no protocol relief.
2. Upside: Glamsterdam ships and measured post-fork state growth slows.
3. Downside: gas limit rises, usage responds, or migration requires temporary dual-state storage.

Only move budget from baseline to upside after mainnet data supports it.

## Recommended action plan

Next 30 days:

- Inventory every archive promise you make: block range, RPC methods, trace APIs, logs/receipts, proof support, latency SLO, and RTO.
- Label nodes by workload instead of "archive" versus "full".
- Start weekly disk-growth measurement across execution, consensus, and custom indexes.
- Choose 2-3 benchmark candidates: Erigon archive, Reth archive/Storage V2, and Geth path-based archive.

Next 60-90 days:

- Run parallel sync/restore tests from empty disk and from snapshot.
- Replay representative customer queries, especially historical storage, traces, `eth_getLogs`, and `eth_getProof` if offered.
- Build a compatibility matrix of API behavior by client/mode.
- Move generic historical reads to the most storage-efficient tier that passes the matrix.
- Isolate expensive proof/trie-history workloads into a smaller premium tier.

Next two quarters:

- Enable partial history expiry on non-archive nodes where product requirements allow.
- Reduce legacy `12TB+` archive exposure unless needed for client diversity or proof compatibility.
- Standardize procurement around 8TB NVMe archive hosts unless a measured workload justifies 4TB or requires 16TB+.
- Track Glamsterdam fork status, especially EIP-8037 and EIP-7928. After mainnet activation, measure 4-8 weeks of actual growth before changing capacity forecasts.

## Bottom line

For the next planning window, Ethereum protocol work is likely to help limit future state growth but is unlikely to make archive nodes cheap or smaller. The prudent plan is to buy and operate as if archive state keeps growing, while using client architecture to reduce the multiplier.

Finance should not underwrite savings from state expiry or statelessness before 2028. Infrastructure should spend its effort on client/mode selection, workload segmentation, measured growth rates, and restore automation. If Glamsterdam's state-gas changes land and work well, that is upside to the forecast, not the foundation of it.

## Sources checked

- ethereum.org, "Merkle Patricia Trie": https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/
- ethereum.org, "Spin up your own Ethereum node": https://ethereum.org/developers/docs/nodes-and-clients/run-a-node/
- ethereum.org, "Ethereum Archive Node": https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes/
- ethereum.org, "Statelessness, state expiry and history expiry" (updated 2026-06-30): https://ethereum.org/roadmap/statelessness/
- ethereum.org, "Glamsterdam" (updated 2026-08-06): https://ethereum.org/roadmap/glamsterdam/
- Ethereum Foundation Blog, "Partial history expiry announcement" (2025-07-08): https://blog.ethereum.org/2025/07/08/partial-history-exp
- Ethereum Foundation Blog, "EF Protocol: Current and Emerging Priorities" (2026-09-07): https://blog.ethereum.org/2026/09/07/protocol-priorities
- Ethereum Foundation Blog, "Checkpoint #9: Apr 2026": https://blog.ethereum.org/2026/04/10/checkpoint-9
- EIP-4444, "Bound Historical Data in Execution Clients": https://eips.ethereum.org/EIPS/eip-4444
- EIP-8037, "State Creation Gas Cost Increase": https://eips.ethereum.org/EIPS/eip-8037
- EIP-7928, "Block-Level Access Lists": https://eips.ethereum.org/EIPS/eip-7928
- EIP-7864, "Ethereum state using a unified binary tree": https://eips.ethereum.org/EIPS/eip-7864
- EIP-8297, "Partitioned Binary Tree": https://eips.ethereum.org/EIPS/eip-8297
- EIP-8347, "Offline State Migration to the PBT": https://eips.ethereum.org/EIPS/eip-8347
- EIP-6780, "SELFDESTRUCT only in same transaction": https://eips.ethereum.org/EIPS/eip-6780
- Geth docs, "Archive mode" (edited 2026-02-24): https://geth.ethereum.org/docs/fundamentals/archive
- Erigon docs, "Hardware Requirements": https://docs.erigon.tech/get-started/hardware-requirements
- Erigon docs, "Database": https://docs.erigon.tech/fundamentals/database
- Reth docs, "System Requirements": https://reth.rs/run/system-requirements/
- Ethereum Research, "How Hegota can influence the state roadmap" (2026-09-03): https://ethresear.ch/t/how-hegota-can-influence-the-state-roadmap/25895
