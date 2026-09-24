# Ethereum State Growth Brief

Date: 2026-09-23

## Executive bottom line

For the next 18-24 months, do not budget as if Ethereum will make archive nodes materially smaller. The only state-growth relief that is credibly scheduled is Glamsterdam's state gas repricing, especially EIP-8037 and EIP-8038. That should slow *new* state growth by making state creation and state access more accurately priced, but it will not shrink existing archive datasets, remove the need for archive infrastructure, or eliminate the operational cost of historical-state service.

Plan capacity assuming continued growth through at least late 2027. Treat Glamsterdam as upside to reduce the growth-rate tail, not as a reason to defer hardware purchases. Treat Verkle/statelessness/state expiry as strategically important but not bankable inside this planning window.

## What is driving the problem

Ethereum execution state is the live database needed to validate and execute new blocks. At the protocol level it includes:

- Account data: nonce, ETH balance, storage root, code hash.
- Contract bytecode, addressed by code hash.
- Contract storage slots, organized under each account's storage trie.
- A cryptographic commitment to the whole state, the `stateRoot`, stored in each block header.

Ethereum currently commits to this data with a modified Merkle Patricia Trie (MPT). The state trie maps account addresses to account objects. Each contract account then has its own storage trie for storage slots. MPTs are cryptographically verifiable, but every lookup follows trie paths and every state update creates changed trie nodes. Execution clients store these trie nodes in an underlying key-value database. The protocol commitment is elegant; the operational reality is write amplification, random IO, compaction pressure, and a database that gets slower as the hot state grows.

The most important distinction for planning is current state versus historical state:

- A full node only needs the current state plus a recent window of prior state to validate the chain and survive reorgs. Older intermediate states can be pruned.
- An archive node stores enough historical state to answer questions like "what was this account/storage slot at block N?" without replaying from genesis or from a nearby snapshot.
- Archive nodes therefore pay for both live state growth and the accumulation of historical versions. The protocol does not require the network to keep archive nodes; data companies, explorers, auditors, indexers, and RPC providers keep them because their products require low-latency historical-state access.

Growth is mainly caused by permanent state creation:

- New storage slots from `SSTORE`.
- New accounts, including contract accounts and externally owned accounts first touched with value.
- New contract bytecode.
- Account/code/storage trie node overhead in the client database.

There are adjacent storage buckets that are operationally large but are not the same thing as execution state:

- Block bodies, transaction history, receipts, logs, and consensus-client data.
- Client-specific indexes and RPC acceleration tables.
- Your own derived indexes, traces, ETL outputs, and warehouse copies.

Finance should not expect one protocol change to reduce all of these buckets. State repricing affects future state creation incentives. History expiry affects old block/receipt availability. Client engineering affects database layout. Company indexing choices affect derived-data growth.

## Current protocol status

### Live today

There is no live mainnet feature that bounds Ethereum execution state or makes archive nodes stop growing.

Pectra is live as of 2025-05-07 and Fusaka is live as of 2025-12-03, per Forkcast, but they do not solve archive-node state growth. Fusaka's main scaling work is around data availability and related mechanics, not pruning historical execution state for archive operators.

### Scheduled for inclusion: Glamsterdam

Glamsterdam is the relevant upcoming fork. Forkcast currently marks Glamsterdam as "Upcoming" with a projected activation of 2026-12-02; ethereum.org describes it as expected on mainnet in Q4 2026 with the date not yet confirmed and Sepolia targeted for 2026-10-06. Use those dates as planning signals, not guarantees.

The state-relevant scheduled items are:

**EIP-8037: State Creation Gas Cost Increase**

Status: SFI for Glamsterdam. Forkcast shows EIP-8037 moved to Scheduled on 2026-05-07.

What it does: increases and harmonizes the gas charged for creating new permanent state, using a cost-per-state-byte model. The EIP sets `CPSB = 1530` and targets average state growth of 120 GiB/year at a 150M gas reference block limit.

Why it matters: underpriced state creation is the protocol-level reason state can grow faster than hardware comfort. The EIP's motivation gives useful sizing context: as of January 2026, a Geth node's state-dedicated database was about 390 GiB; after the gas limit increased from 30M to 60M, average new state creation rose from about 105 MiB/day to 326 MiB/day, or about 116 GiB/year. The EIP warns that naive proportional scaling to a 200M gas limit would imply about 387 GiB/year of state growth and could push nodes past a 650 GiB state-performance threshold in under a year.

Operational read: this is the single most concrete protocol mitigation for state growth inside the planning window. It should reduce the risk that higher L1 gas limits translate directly into runaway state growth. It does not reduce the size of existing archive data, and its real effect depends on user and application behavior after repricing.

**EIP-8038: State-access gas cost update**

Status: SFI for Glamsterdam. Forkcast shows EIP-8038 moved to Scheduled on 2026-08-04.

What it does: reprices state-access and state-write operations so gas better reflects modern state lookup/write costs. Examples from the spec include raising cold account access from 2,600 to 3,000 gas, introducing larger write surcharges, and raising storage-write-related costs.

Why it matters: as state grows, database reads and writes get more expensive for clients. Underpriced access creates DoS risk and weakens the economic signal for efficient contract design.

Operational read: useful for chain health and worst-case block processing. It does not directly lower archive disk usage.

**EIP-7928: Block-Level Access Lists**

Status: SFI/headliner for Glamsterdam.

What it does: blocks carry an enforced map of accounts/storage locations accessed and post-execution values. This enables parallel disk reads, faster validation paths, and "executionless" state updates in some client workflows.

Operational read: this is performance and sync-path help, not a disk-capacity fix. It may improve client architecture and sync latency over time, but it is not a reason to reduce archive storage budgets.

### Not scheduled: EIP-4444/history expiry

EIP-4444 proposes bounding old execution history served over the p2p network and allowing clients to locally prune old headers, bodies, and receipts. Forkcast currently shows no fork relationship for EIP-4444, and the EIP is Draft.

Even if adopted, EIP-4444 is mostly about historical block/receipt data, not execution state. It could reduce full-node disk and p2p burden, and it would change how nodes bootstrap from old history, but it does not make an archive node's historical state archive unnecessary. For a data company, it likely increases the importance of intentionally preserving and replicating historical data rather than assuming the p2p network will serve it forever.

### Not scheduled: Verkle/statelessness/state expiry

EIP-6800 proposes moving Ethereum state toward a unified Verkle tree. Forkcast currently shows EIP-6800 as Stagnant with no fork relationship. Verkle-style commitments are important because they can make witnesses much smaller and support stateless-client designs, but they are not scheduled for Glamsterdam.

State expiry is even less bankable. Ethereum.org's statelessness roadmap says state expiry is still in research, not ready to ship, and that weak statelessness, history expiry, and state expiry are expected several years from now with no guarantee that all proposals will be implemented.

Operational read: do not include Verkle, stateless validation, or state expiry as capacity relief in an 18-24 month finance plan. Track them as roadmap risk/opportunity only.

## What to bank on

Bank on:

- Archive datasets continuing to grow through 2027.
- Glamsterdam probably landing inside the 18-24 month window, but with timing risk until mainnet activation is announced and client releases are in production.
- EIP-8037/EIP-8038 reducing future state-growth pressure, especially under higher gas limits.
- No protocol-level reduction of existing archive state inside the window.
- Continued client-level differences in archive footprint. Ethereum.org currently estimates full archive disk at 12TB+ for Besu/Geth/Nethermind, 2.5TB+ for Erigon, and 2.2TB+ for Reth, with client docs changing over time.

Do not bank on:

- Verkle or state expiry reducing hardware needs before late 2027.
- EIP-4444 solving archive-node growth.
- A scheduled EIP's spec maturity alone meaning it will ship. Fork inclusion status is what matters.
- Current archive node sizes being interchangeable across clients. Client database design dominates the footprint.

## Recommended operating plan

### 1. Budget from measured fleet growth, not roadmap hope

Use your own per-client, per-role telemetry as the base forecast:

- `datadir` total bytes by node role.
- Execution-client state/database bytes, ancient/history bytes, receipts/log indexes where separable.
- Consensus-client bytes.
- Derived index/trace/warehouse bytes.
- Weekly growth rate, p50/p95, and growth per million gas.
- Compaction headroom and free-space floor.

Finance model:

- Base case: continue the last 90-180 days of measured growth until Glamsterdam activation, then taper only the state-creation component if observed.
- Stress case: keep current growth rate for the full 24 months and add headroom for higher gas limits and reindex/resync events.
- Do not book savings from Glamsterdam until at least 60-90 days of post-fork fleet telemetry confirms lower net growth.

### 2. Separate node roles aggressively

Do not make every node an archive node. Split the fleet into:

- Tip-following full nodes for ingestion, mempool, transaction submission, and high-availability RPC.
- Archive nodes for historical state queries only.
- Trace/indexing workers that can lag, rebuild, or run against cheaper replicas.
- Cold historical datasets for block/receipt/log preservation and backfills.

Archive capacity is expensive enough that RPC routing should send `eth_call`/`eth_getBalance`/`eth_getStorageAt` with old block tags only to archive pools. Current-head and recent-window traffic should stay on cheaper full-node pools.

### 3. Prefer archive-efficient clients, but keep client diversity

For archive-heavy workloads, evaluate Erigon and Reth as primary archive backends because their archive footprints are much smaller than traditional hash-based archives in Geth/Besu/Nethermind. Keep at least one alternative client path for correctness checks, incident fallback, and client-bug isolation.

For Geth specifically, distinguish path-based archive from older hash-based archive behavior. Modern Geth supports lower-disk path-based archive modes, but client mode, pruning settings, historical trie retention, and RPC requirements matter. Validate with your exact query mix before migrating production archive traffic.

### 4. Define archive service tiers

Not all historical state queries deserve the same storage tier.

Recommended tiers:

- Hot archive: recent 6-12 months of high-volume historical-state queries on fastest NVMe.
- Warm archive: full historical state on archive-efficient clients, optimized for correctness and steady latency.
- Cold replay/backfill: slower systems for rare forensic requests, ETL backfills, and recomputation.
- Immutable history lake: blocks, transactions, receipts, logs, traces if you need them, stored independently of p2p assumptions.

This gives finance a lever: preserve data without making every byte live on the most expensive disks.

### 5. Preserve history intentionally before EIP-4444 becomes real

Even though EIP-4444 has no fork relationship today, the direction of travel is clear: old block/receipt serving by ordinary p2p nodes is not something a data business should rely on indefinitely. Maintain your own verified historical block, receipt, and log datasets with checksums and restore drills. If EIP-4444 or client-level history pruning advances, you want to be a source of truth rather than a surprised consumer.

### 6. Run a Glamsterdam readiness track

Before Glamsterdam mainnet:

- Upgrade staging nodes across every supported execution client.
- Replay your top historical-state and trace workloads against testnet/devnet clients where possible.
- Watch EIP-8037/EIP-8038 effects on gas usage for contracts your customers query heavily.
- Validate RPC semantics around BAL-related changes and any client-specific archive modes.
- Update capacity dashboards to mark the fork boundary so post-fork growth changes are measurable.

After Glamsterdam:

- Compare state growth per day, per gas, and per transaction against the pre-fork baseline.
- Watch for traffic migration: higher state-creation costs may reduce some writes but increase other patterns.
- Keep stress-case purchasing active until observed growth confirms a durable trend.

## Finance guidance

For the next budget cycle, assume no negative step-change in archive storage. Glamsterdam may reduce forward state-growth slope, but the budget should still cover:

- 24 months of measured growth at the current fleet rate.
- Spare capacity for at least one full resync/rebuild per critical archive cluster.
- NVMe replacement and wear budget; archive sync and compaction are IO-heavy.
- Cross-client duplicate capacity for correctness and operational risk.
- Independent historical data retention in object storage or equivalent.

If finance needs a single planning rule: buy for the stress case, then treat any post-Glamsterdam growth reduction as deferred capex, not as committed savings.

## Source status checked

- Forkcast `/api/upgrades.json`: Pectra live 2025-05-07, Fusaka live 2025-12-03, Glamsterdam upcoming with projected activation 2026-12-02. https://forkcast.org/api/upgrades.json
- Forkcast EIP records: EIP-8037 Scheduled for Glamsterdam; EIP-8038 Scheduled for Glamsterdam; EIP-7928 Scheduled/headliner for Glamsterdam; EIP-4444 no fork relationship; EIP-6800 no fork relationship. https://forkcast.org/api/eips/8037.json, https://forkcast.org/api/eips/8038.json, https://forkcast.org/api/eips/7928.json, https://forkcast.org/api/eips/4444.json, https://forkcast.org/api/eips/6800.json
- Ethereum.org Glamsterdam page: Q4 2026 expected mainnet, date not confirmed; state creation/access repricing described as scheduled. https://ethereum.org/roadmap/glamsterdam/
- EIP-8037 spec: state growth measurements, CPSB model, and 120 GiB/year target. https://eips.ethereum.org/EIPS/eip-8037
- EIP-8038 spec: state-access gas repricing. https://eips.ethereum.org/EIPS/eip-8038
- EIP-4444 spec: bounds historical headers/bodies/receipts, not archive state. https://eips.ethereum.org/EIPS/eip-4444
- EIP-6800 spec: Verkle state proposal. https://eips.ethereum.org/EIPS/eip-6800
- Ethereum.org archive node docs: archive/full-node distinction and archive disk requirement ranges. https://ethereum.org/developers/docs/nodes-and-clients/archive-nodes/
- Ethereum.org run-a-node docs: client disk estimates. https://ethereum.org/developers/docs/nodes-and-clients/run-a-node/
- Geth archive-mode docs: hash-based versus path-based archive behavior and storage tradeoffs. https://geth.ethereum.org/docs/fundamentals/archive
- Erigon hardware requirements: current archive disk measurements and recommended hardware. https://docs.erigon.tech/get-started/hardware-requirements
- Ethereum.org Merkle Patricia Trie docs: current state data structure. https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/
- Ethereum.org statelessness roadmap: state expiry/statelessness research status. https://ethereum.org/roadmap/statelessness/
