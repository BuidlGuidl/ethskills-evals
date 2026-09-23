The subgraph is the wrong tool for this panel.

The panel only needs current state: "what is this wallet's balance for these 40 ERC-20 contracts right now?" That is exactly what each token contract's `balanceOf(address)` returns. A subgraph is useful when we need historical data, ordering, pagination, aggregation across many users, charts, leaderboards, feeds, or a searchable derived dataset. None of that is in scope here.

I would build this as a direct batched read from Base:

1. Keep the supported-token list in app config: token address, symbol, decimals, display metadata.
2. When the user opens the portfolio panel, call `balanceOf(userAddress)` for each of the 40 token contracts.
3. Batch those reads through Multicall3 on Base.
4. Decode the returned `uint256` balances and format them using the known token decimals.

Call count for one wallet:

- 1 JSON-RPC `eth_call` to Multicall3.
- Inside that call, Multicall3 performs 40 `staticcall`s, one to each token's `balanceOf(address)`.

If we did not use multicall, it would be 40 separate `eth_call`s. I would use multicall so the panel opens with one batched read, lower latency, fewer RPC round trips, and a single block-consistent snapshot.

This stays accurate because the token contract is the source of truth. Every time the panel is opened, the app asks the contracts for their latest `balanceOf` values at the current block. If the user receives, sends, bridges, swaps, or otherwise changes one of those token balances after the panel was last opened, the next panel open performs a fresh multicall and gets the new values directly from chain state.

The proposed subgraph is not only overkill, it can be less accurate for this use case:

- It can lag the chain by one or more blocks.
- It needs backfill, hosting, monitoring, reorg handling, schema/mapping maintenance, and production query infrastructure.
- It assumes balances can be reconstructed perfectly from `Transfer` events. That is usually true for ordinary ERC-20 transfers, but `balanceOf` is still the canonical answer, and unusual token mechanics or nonstandard behavior are exactly where event-derived balances can drift.
- It adds an operational dependency for a read that the chain can answer directly.

So the sprint should not be "build and operate a subgraph." It should be "add a portfolio panel that performs one Multicall3 `eth_call` containing 40 ERC-20 `balanceOf` reads whenever the connected user opens the panel."
