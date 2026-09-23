The subgraph is overkill for this panel, and it is not the best source of truth for
"what does this wallet hold right now?"

For this feature I would not build an indexer. I would read the 40 token contracts
directly when the user opens the portfolio panel.

## Why a subgraph is the wrong tool here

A subgraph is useful when the UI needs indexed history, filtering, aggregation,
leaderboards, time series, cross-account queries, or some derived data that would be
expensive to compute from live RPC calls.

This panel only needs one thing:

> for one connected wallet, what is `balanceOf(wallet)` for each supported token
> right now?

That is exactly what ERC-20 contracts already expose as live state. Indexing every
`Transfer` event for 40 tokens, maintaining derived balances, hosting/operating the
subgraph, and handling indexing lag is a lot of machinery for data that can be read
directly from the contracts.

It also does not make the balances "always accurate." A subgraph is a derived,
eventually consistent view:

- it can lag behind the chain;
- it has to survive reorgs and indexing failures;
- it must be backfilled correctly from each token's deployment block;
- it can be wrong for unusual tokens whose balances change without ordinary
  `Transfer` accounting, such as rebasing or otherwise non-standard balance logic;
- it adds another production dependency between the wallet and the number shown in
  the UI.

For a current-balance panel, the contract is the source of truth. The indexer is a
cache of reconstructed truth.

## What I would build instead

Use a multicall read against Base when the panel opens.

For each supported token, encode:

```solidity
balanceOf(address user) returns (uint256)
```

Then submit those 40 calls through a multicall contract, such as Multicall3, using
`aggregate3` or an equivalent read-only multicall helper from the app's web3 stack.

That gives this call shape:

- 1 JSON-RPC `eth_call` from the frontend/backend to the Base RPC endpoint;
- inside that multicall, 40 read-only calls, one to each ERC-20 token's
  `balanceOf(user)`;
- 0 transactions;
- 0 gas paid by the user;
- 40 returned balances from the same block.

So the practical answer is: fetching all 40 balances for one wallet should take one
RPC request if we use multicall. Conceptually it still performs 40 token
`balanceOf` reads, but they are bundled into one read-only onchain call.

If the stack cannot use multicall for some reason, the fallback is a JSON-RPC batch
containing 40 separate `eth_call` requests. That is still much simpler than running
a subgraph, but multicall is preferable because it gives a consistent same-block
snapshot.

## How it stays accurate

The panel should fetch balances when it opens, optionally with a fresh block number
or using the block returned by the multicall result. Each value comes directly from
the token contract's current `balanceOf` implementation at that block.

When balances change because the user transfers, receives, swaps, bridges, or earns
tokens, the token contract state changes. The next time the panel opens, the same
multicall asks the contracts again and gets the latest state as of that block. We do
not have to observe or replay the intervening events ourselves.

This is also more robust for token-specific behavior. If a token computes balances
with internal accounting that is not perfectly reconstructible from `Transfer`
events, `balanceOf` still returns the value the token itself considers canonical.

## Recommended implementation shape

Keep a static registry of the 40 supported Base token addresses and metadata:

- token address;
- symbol/name for display;
- decimals, either stored in the registry or fetched once and cached;
- optional display ordering and icon metadata.

On panel open:

1. Get the connected wallet address.
2. Build 40 `balanceOf(wallet)` calls.
3. Execute one multicall `eth_call` on Base.
4. Decode each `uint256`.
5. Format using each token's decimals.
6. Render nonzero balances, or all supported tokens if the product wants an explicit
   zero-balance list.

That is the smallest architecture that matches the product requirement. A subgraph
would be worth reconsidering only if the product later needs historical balances,
portfolio history, activity timelines, holders across all wallets, aggregate token
analytics, or complex server-side queries that cannot be answered efficiently with
direct contract reads.
