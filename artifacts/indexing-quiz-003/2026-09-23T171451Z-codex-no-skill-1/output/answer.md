# Recommendation

The proposed subgraph is overkill for this panel, and it is not the most accurate source for the product requirement.

For a panel that only answers "what does this connected wallet hold right now?" across a fixed list of 40 ERC-20s on Base, I would read the balances directly from the token contracts with `balanceOf(address)`.

Subgraphs are useful when we need indexed history, filtering, aggregation, leaderboard-style queries, time series, or cross-user scans. This panel needs none of that. It needs 40 current values for one known wallet.

# What I Would Build Instead

Keep the supported token list in the app or backend config:

- token contract address
- symbol
- decimals
- display metadata

When the user opens the portfolio panel, call `balanceOf(userAddress)` for each of the 40 token contracts.

I would do this with a multicall on Base:

```ts
const balances = await publicClient.multicall({
  contracts: supportedTokens.map((token) => ({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [userAddress],
  })),
  allowFailure: true,
});
```

That is:

- 1 JSON-RPC `eth_call` to the Base multicall contract
- 40 internal `balanceOf` static calls inside that multicall
- 0 transactions
- 0 gas paid by the user

If we did not use multicall, it would be 40 separate `eth_call`s. But for this product I would use multicall, so the panel fetches all 40 balances for one wallet with one network round trip.

Assuming decimals are already in our supported-token config, there are no extra token metadata calls at panel-open time. If decimals are not already known, fetch them once when building or validating the token list, not every time the user opens the panel.

# Why This Stays Accurate

`balanceOf(address)` reads the token contract's current state at the block used by the RPC call. With multicall, all 40 balances are evaluated against the same block, so the panel shows a consistent snapshot.

When balances change because the user receives tokens, sends tokens, swaps, bridges, or interacts with another contract, the token contract's state changes. The next time the panel opens, we run the same multicall again against the latest Base state and get the new balances.

If we want the open panel to stay fresh while visible, we can also refetch on a new block, on window focus, or after our own app submits a transaction. But the requirement says "refreshed when they reopen the panel," so fetching on panel open is enough.

# Why The Subgraph Is The Wrong Tool Here

A subgraph would introduce a service we have to build, deploy, monitor, backfill, and keep synced. It would also be an eventually consistent derived view of chain state, not the source of truth.

The scoped design says the subgraph would be "always accurate" because it indexes `Transfer` events and tracks balances. That is not quite right:

- Indexers can lag the chain, so the latest transfer may not be reflected yet.
- Reorg handling and backfills become our operational problem.
- Some ERC-20-like tokens have mechanics where `balanceOf` can change in ways that are not cleanly represented by ordinary holder-to-holder `Transfer` accounting, such as rebasing or other custom accounting.
- Any bug in our mapping logic becomes a balance bug.

Direct `balanceOf` calls avoid those problems. The token contract is already the balance database.

# Decision

Do not build a subgraph for this panel.

Use one Base multicall per wallet per panel open, containing 40 ERC-20 `balanceOf` calls. This is simpler, cheaper to operate, lower latency from implementation to launch, and more authoritative for current balances than indexing `Transfer` events ourselves.
