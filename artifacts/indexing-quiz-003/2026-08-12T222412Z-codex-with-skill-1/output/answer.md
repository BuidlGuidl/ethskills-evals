# Recommendation

Do not build a subgraph for this panel. The requirement is current state, not historical or derived data. Each ERC-20 contract already exposes the authoritative current value through `balanceOf(wallet)`, so reconstructing that value from every past `Transfer` event adds development, hosting, synchronization, reorg, and data-correctness risk without serving a query the chain cannot already answer directly.

The proposed claim that event-derived balances are “always accurate” is too strong. A subgraph can lag the chain, start from the wrong block, miss configuration or handler errors, and briefly disagree during reorg handling. More fundamentally, `Transfer` events are not guaranteed to be a complete accounting model for every token: rebasing or otherwise nonstandard tokens may change `balanceOf` without ordinary holder-to-holder transfers that a generic running-balance mapping understands. The token contract's `balanceOf` is the source of truth for what it reports now.

# Implementation

When the user opens the panel on Base, issue 40 `balanceOf(user)` reads through Base's deployed Multicall3 contract (`0xcA11bde05977b3631167028862bE2a173976CA11`). For example, build a `viem` `publicClient.multicall` request containing one contract descriptor per supported token, all calling the ERC-20 ABI's `balanceOf` with the connected address. Use failure-tolerant results so one broken/nonstandard token does not blank the whole panel.

This is:

- **40 contract function calls** executed by Multicall3, one per token;
- **1 onchain read/RPC request (`eth_call`)** from the panel to fetch all 40 results;
- **0 user transactions and 0 gas paid**, because `eth_call` only simulates the Multicall3 call.

All component reads in that multicall execute against one Base block/state snapshot, avoiding balances being mixed across different blocks. Pin an explicit recent block number if the client/library's multicall path does not already give the desired single-snapshot semantics, and return that block number with the UI data.

# Staying accurate

Refetch the multicall whenever the panel is opened (and after account or chain changes). That meets the stated refresh requirement: each opening asks the contracts for their current balances rather than relying on a cached, eventually consistent reconstruction. If a new block or transfer lands after the read, the displayed result is naturally a snapshot as of the block used; the next opening performs a fresh read and reflects the changed `balanceOf` values. Optional cache invalidation after an in-app transaction can improve immediacy, but subscriptions or indexing are unnecessary for the requested behavior.

Token decimals and symbols can live in the supported-token configuration, since the set is curated; use `decimals` only to format each returned integer and never for balance accounting. Validate that the wallet is on Base and label the snapshot/loading/error state clearly.

A subgraph becomes justified later if the product adds transfer history, balances at past blocks, charts, P&L inputs, holder rankings, or other queries over historical events. None of those exist in this scope.
