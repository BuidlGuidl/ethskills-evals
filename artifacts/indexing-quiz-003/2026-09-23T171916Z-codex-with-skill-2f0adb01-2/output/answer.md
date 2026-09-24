# Portfolio panel recommendation

The subgraph is overkill for this panel, and it is not the best source of truth for the product requirement.

The panel only needs current balances for one connected wallet across 40 known ERC-20 tokens on Base. That is a current-state read problem, not a historical indexing problem. A subgraph is the right tool when we need history, activity feeds, analytics, rankings, P&L over time, transfer search, or queries that would otherwise require scanning old logs. Here we do not need any of that; we just need `balanceOf(wallet)` for each supported token when the panel opens.

I would build this with direct onchain reads batched through Multicall3:

1. Keep the supported Base token list in app config, including token address, symbol, decimals, display name, and icon metadata.
2. When the connected wallet opens the portfolio panel, construct 40 ERC-20 `balanceOf(address)` calls, one per token.
3. Send them as a single Multicall3 `aggregate3` / `multicall` `eth_call` against Base.
4. Decode the 40 returned `uint256` balances and format using the known decimals.
5. Drop zero balances if the UI only wants held assets, or show all 40 if it wants the full supported list.

Call count: this is 1 JSON-RPC `eth_call` to Base for the whole panel, containing 40 read-only `balanceOf` calls inside the multicall. At the token-contract level, there are still 40 balance reads, but they are executed in one RPC round trip and against one block's state. If we choose not to use Multicall3, the fallback is 40 separate `eth_call`s, preferably sent concurrently or as an RPC batch, but I would use multicall for this.

The subgraph proposal has several downsides for this specific panel:

- It adds deployment, schema, mapping, hosting, monitoring, and reindexing work for a feature that does not need indexed history.
- It will usually be slightly behind the chain tip, so "always accurate" is not actually guaranteed at the exact moment the user opens the panel.
- It reconstructs balances from `Transfer` events even though every ERC-20 contract already exposes the canonical current answer through `balanceOf`.
- It creates edge-case risk for tokens with unusual behavior, contract upgrades, rebasing mechanics, missed starts, bad historical assumptions, or any mismatch between emitted events and current storage.

Direct `balanceOf` calls stay accurate because they read the token contracts' current state at the time of the request. If a user receives, sends, swaps, bridges, or otherwise changes a supported-token balance after the panel was last opened, the next panel open performs a fresh multicall and reads the updated balances from the contracts themselves. No event replay or local running-balance cache needs to be correct for this to work.

One implementation detail I would preserve: make the multicall tolerate per-token failure, for example using `allowFailure: true`, so one non-standard or temporarily problematic token does not blank the entire panel. We can display failed balances as unavailable, log them, and still show the rest.

So the sprint should not be spent building and operating a subgraph for this. Build a small current-balance read path: one multicall per wallet per panel open, 40 `balanceOf` reads, formatted from our supported-token metadata.
