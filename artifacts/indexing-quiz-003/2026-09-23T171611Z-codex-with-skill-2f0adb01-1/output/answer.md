# Portfolio panel data source

The proposed subgraph is overkill for this panel, and it is not the most accurate source for the product requirement.

The panel only needs current balances for one connected wallet across 40 known ERC-20 contracts on Base. That is current contract state, not historical data. A subgraph is useful when we need to ask historical or event-derived questions: transfer history, holder lists, volume, P&L, snapshots, charts, rankings, or "what happened over time." Here we only need "what does `balanceOf(wallet)` return right now?"

I would not build a Transfer-event balance indexer for this. It adds backfill time, indexing infrastructure, reorg handling, operational monitoring, schema/mapping maintenance, and lag behind the chain. It can also be less authoritative than the token contracts themselves for edge-case tokens whose balances change in ways that are not perfectly reconstructible from standard `Transfer` events, such as rebasing-style behavior. Even for normal tokens, the subgraph is eventually consistent; the contract's current storage is the source of truth.

## What to build instead

Keep the supported token list in the app or backend config:

- Base chain id
- token contract address
- symbol/name/decimals, preferably from our curated token metadata rather than fetching it every panel open

When the user opens the portfolio panel, make one read-only Multicall request on Base:

1. Build 40 calls, one per token:

   `token.balanceOf(connectedWallet)`

2. Send them through Base's Multicall3 contract using `aggregate3`/`tryAggregate`, or through a client helper such as `viem` `multicall` / `readContracts`.

3. Decode the 40 `uint256` balances, format each with the token's known decimals, and show nonzero balances or all supported tokens depending on the UI choice.

The onchain call count for one wallet is:

- **1 JSON-RPC `eth_call` to Multicall3**
- Inside that call, Multicall3 performs **40 read-only `balanceOf` calls**, one to each ERC-20 token contract

If we did not use Multicall, this would be 40 separate `eth_call`s. I would use Multicall so the panel gets a block-consistent snapshot and avoids 40 round trips.

## Why this stays accurate

Each time the panel opens, the app queries the latest Base state and calls the token contracts directly. If the user received, sent, minted, burned, bridged, or swapped tokens since the last time the panel was opened, the token contract's `balanceOf` result has already changed, so the next Multicall returns the new balances.

Because all 40 reads are bundled into one Multicall, they are evaluated against the same chain state for that `eth_call`, rather than being spread across multiple RPC requests that might land on slightly different blocks. That gives the UI a clean "as of this latest block" snapshot.

The only normal caveat is RPC freshness: the answer is as fresh as the Base RPC endpoint's latest block. That is still the right freshness model for a live balance panel, and it is usually fresher and more authoritative than a subgraph that must ingest blocks and update derived entities before the UI can query them.

So the sprint should build a direct balance-read path, not a subgraph. Use an indexer later only if the product grows into historical portfolio activity, analytics, holder search, or time-series views.
