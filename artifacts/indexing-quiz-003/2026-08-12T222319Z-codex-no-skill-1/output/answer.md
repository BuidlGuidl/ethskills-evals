# Recommendation

A subgraph is overkill for this panel, and “always accurate” is not a good reason to build one. The required value already exists in each token contract: `balanceOf(wallet)`. Reconstructing that value from `Transfer` events creates another stateful system that must catch up, handle chain reorganizations, and correctly accommodate every supported token. A subgraph is valuable for history, filtering, aggregation, or discovering an open-ended token set; none is required here because the 40 token addresses are already known and the product only needs a current snapshot.

I would read the contracts through Base's deployed Multicall3 contract. On panel open, construct 40 calls, one per supported token, each encoding:

```solidity
IERC20(token).balanceOf(connectedWallet)
```

Submit those calls together to Multicall3 using `aggregate3` (or the equivalent multicall helper in the app's Ethereum library), then decode each result with that token's configured decimals for display.

## Exact call count

From the application/RPC perspective, fetching all 40 balances takes **one onchain read request: one `eth_call` to Multicall3**. During that single simulated call, Multicall3 performs **40 internal calls**, one `balanceOf` call to each ERC-20 contract. It sends no transaction, consumes no user gas, and requires no deployment by us. If the chosen RPC limits multicall payloads, the fallback is a few batches, but 40 simple `balanceOf` calls would ordinarily fit in one batch.

All 40 reads in that multicall execute against the same Base block/state, so the response is a coherent snapshot rather than 40 values obtained across possibly different blocks.

## Why it stays accurate

The token contracts' storage is the source of truth. Every transfer, mint, burn, or other token-specific balance change updates what `balanceOf` returns. The panel does not need to observe or replay those changes. Each time it opens, it issues a new multicall against a fresh block and therefore gets the balances as of that block. If “latest” must mean a particular finality level, the RPC block tag can be chosen accordingly; for the freshest UI, use `latest` and accept normal short-lived reorg semantics.

While the panel remains open, accuracy depends on the stated refresh policy: reopening triggers a fresh snapshot. We could optionally refetch on a new block, after a transaction confirmation, or via a manual refresh, but no indexer is needed. A subgraph can lag the chain and its event-derived state can be temporarily stale; direct `balanceOf` reads avoid that additional synchronization boundary.

Implementation details worth retaining are the fixed allowlist of token addresses, each token's decimals/symbol metadata, per-call failure handling (`allowFailure: true` if one broken token should not blank the panel), and a block number alongside the returned snapshot. These are small client/backend concerns compared with deploying and operating an indexer.
