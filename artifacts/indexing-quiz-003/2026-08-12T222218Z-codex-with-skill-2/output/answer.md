# Recommendation

Do not build a subgraph for this panel. A subgraph is useful when the product needs historical or derived data—transfer history, charts, P&L, rankings, or queries that would otherwise scan old logs. This panel needs only current state, which each token contract already exposes through `balanceOf(address)`.

On Base, have the frontend make one read-only `eth_call` to the deployed Multicall3 contract. Encode 40 calls, one to each supported token:

```solidity
token.balanceOf(connectedWallet)
```

Use Multicall3's `aggregate3` (or the client's equivalent multicall helper), decode the 40 returned `uint256` values, and format each using the token's known decimals. Since the supported-token list is fixed, token addresses, symbols, and decimals can be application configuration rather than fetched every time.

## Call count

- **1 onchain RPC call total** to fetch all 40 balances: one `eth_call` containing a Multicall3 invocation that batches 40 `balanceOf` calls.
- Logically, Multicall3 performs 40 contract reads inside that single call, but the browser makes one RPC request and no transaction is submitted.
- If Multicall3 were not used, the fallback is 40 `eth_call` requests (possibly sent as one JSON-RPC batch). That is still current-state reading, but it is not one onchain call and may not give as clean an atomic snapshot.

## Why it stays accurate

`balanceOf` reads each token contract's authoritative state at the RPC block used for the call. Multicall executes all 40 reads against the same block/state snapshot, so the displayed portfolio is internally consistent. When the user opens or reopens the panel, issue the multicall again; the new call reads the then-current state, so transfers, mints, burns, and other balance changes are reflected without maintaining an index.

For predictable failure handling, use `aggregate3` with per-call success results: a broken or nonstandard token read should not hide the other 39 balances. Pin the request to a single resolved block tag if the RPC/client does not already do so, and optionally show “as of block N.” Reading `latest` is freshest but can be affected by a short Base reorganization; use `safe` if the product prefers slightly older, more stable balances.

## Why event-derived balances are weaker here

A subgraph's running total is a reconstruction from `Transfer` events, not the source of truth. It can lag the chain while syncing, require reorg handling and operational monitoring, and assumes every supported token's events fully and correctly describe balance changes. Rebasing or otherwise unusual ERC-20 implementations can make event-derived accounting diverge from `balanceOf`. Even a perfectly implemented subgraph adds infrastructure without improving this current-state query.

Build an indexer later only if the panel grows historical or analytical requirements. For “what do you hold right now?”, one Multicall3 read is simpler and more authoritative.
