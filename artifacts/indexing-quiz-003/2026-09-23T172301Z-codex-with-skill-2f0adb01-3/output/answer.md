# Portfolio Panel Data Source

The proposed subgraph is overkill for this panel, and it is not the best source of truth for "what does this wallet hold right now?"

A subgraph is the right tool when the product needs historical or derived data: activity feeds, transfer history, holder lists, charts, P&L, rankings, or queries that would otherwise require scanning old logs. This panel does not need any of that. It only needs the current `balanceOf(wallet)` for each of 40 known ERC-20 contracts on Base.

For this use case, the panel should read the token contracts directly at the latest block.

## What I would build

Keep the supported token list in app config:

- token contract address
- symbol/name for display
- decimals for formatting
- optional logo metadata

When the user opens the portfolio panel, issue one batched multicall on Base:

- 40 calls to `balanceOf(address)` bundled through Multicall3
- executed as a single `eth_call`
- decoded client-side and formatted using the configured decimals

So the fetch is:

```text
1 onchain read / RPC call total
  containing 40 balanceOf calls
```

If we did not use multicall, it would be 40 separate `eth_call`s. I would use multicall because these are independent reads against known contracts, and batching them gives us one consistent, cheap snapshot for the UI.

## Why this stays accurate

For an ERC-20 token, `balanceOf(wallet)` is the contract's authoritative current state. When a user transfers, swaps, bridges, receives, mints, burns, or otherwise changes their balance, the token contract's storage changes. The next time the panel opens, the multicall reads `balanceOf` again at the latest Base block, so it reflects the live state at that point.

This is also more accurate than deriving balances from `Transfer` events. Event-derived balances can lag behind the chain, need reorg handling, and depend on every supported token behaving exactly as expected. Some tokens have nonstandard mechanics, rebases, fees, wrappers, upgrade quirks, or accounting changes where reconstructing balances from transfers is easier to get subtly wrong. `balanceOf` is the state the token itself exposes for that wallet right now.

## Why not the subgraph

The scoped subgraph would require us to:

- index historical `Transfer` events for all 40 token contracts
- maintain balance entities for every holder touched by those tokens
- handle initial sync, ongoing sync, reorgs, mapping bugs, schema changes, and operations
- wait for indexing latency before the UI catches up
- still risk disagreeing with `balanceOf` for nonstandard token behavior

That work pays off if we later need history, holder analytics, historical snapshots, or portfolio performance over time. For a reopen-to-refresh panel showing only current balances, it adds infrastructure without adding product value.

## Recommendation

Do not build a subgraph for this panel. Use direct latest-state reads via Base Multicall3: one `eth_call` containing 40 ERC-20 `balanceOf` calls for the connected wallet. Refresh by running the same multicall whenever the panel opens, and optionally after our app submits a transaction that could affect one of those balances.
