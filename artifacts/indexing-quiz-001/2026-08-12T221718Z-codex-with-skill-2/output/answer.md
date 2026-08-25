# Sanity check

The proposed design will not work reliably in production.

## What one page load actually does

The literal implementation makes **one** `eth_getLogs` request covering blocks 0 through about 25,500,000. It does not magically become many requests at the JSON-RPC layer. Instead, a normal hosted RPC provider will usually reject or time out that one enormous query because providers cap block range, result count, response size, execution time, or credits.

If the client library or application retries by splitting the scan into a commonly tolerated **10,000-block range**, the arithmetic is:

```text
ceil(25,500,001 blocks / 10,000 blocks per request) = 2,551 requests
```

(It is 2,550 if “25,500,000” is used as the block count rather than the inclusive latest block. Either way, the useful estimate is **about 2,550 RPC requests per page load**.)

That request count is forced by the provider's maximum log-query range, not by the number of collection events. Providers with a 2,000-block cap require about 12,750 calls; result-size limits can force still smaller adaptive ranges around busy blocks. Retrieving block timestamps, transactions, receipts, or marketplace events to decorate/classify results adds more calls unless batched or separately indexed.

The downloaded result is also the collection's entire three-year transfer history, repeatedly sent to every visitor. Browser code must retain, decode, sort, and replay it before rendering. Ten thousand visitors repeat the same historical scan ten thousand times.

## What breaks first

1. **The initial `eth_getLogs` call fails first**: timeout, “block range too wide,” “too many results,” payload limit, or paid-plan credit/rate-limit rejection. “Any provider key” is false because limits and archive/log retention policies differ.
2. If range splitting is added, the browser hits rate/concurrency/credit limits, takes a long time, transfers a large payload, and may be throttled or killed for memory/CPU. The UI remains empty or incomplete while thousands of calls finish. Exposing a provider key in a public client also lets others consume its quota unless the provider supports effective origin/domain restrictions.
3. The data model is wrong for the promised feed. ERC-721 `Transfer` identifies mints (`from == 0x0`), burns (`to == 0x0`), and ownership movements, but **does not say that a transfer was a sale or give its price**. A sale needs indexed marketplace/protocol events and often transaction/receipt or trace/payment interpretation. One purchase can also contain several transfers.
4. Holder ranking is unavailable until the complete history has been replayed. It must handle transfers, burns, duplicate/self transfers as appropriate, and chain reorganizations. A missed or partially failed range silently produces wrong balances.

## What to build instead

Build or buy an **offchain indexer**. This is infrastructure the current plan does not include.

The indexer should backfill once from the collection's deployment block—not block 0—then follow new finalized blocks. For every canonical event it should store a stable identity such as `(chainId, transactionHash, logIndex)`, block number/hash and timestamp, maintain token ownership and per-wallet current counts, and undo/replay data on reorgs. Index relevant marketplace events as well as collection transfers if the feed must label sales and show prices.

Expose a backend API with two precomputed/queryable views:

- **Activity:** a database table ordered by `(blockNumber, transactionIndex, logIndex)` descending, served with cursor pagination. The page asks only for, say, the newest 25–50 rows; websocket/SSE or a short poll supplies new rows.
- **Top holders:** update wallet balances incrementally for each transfer (`from - 1`, `to + 1`, with zero-address mint/burn handling), index the balance column, and return the top N. Optionally cache this small result.

Viable implementations are a collection subgraph on **The Graph**, a self-hosted **Ponder** indexer plus Postgres/API, or a managed NFT/transfer indexing API from a provider. The Graph/Ponder mappings can maintain `Token`, `Transfer`, and `Holder` entities; marketplace-specific sale attribution still needs explicit handlers. A managed API is quickest but introduces vendor limits and may not provide accurate cross-market sale semantics.

Direct RPC remains useful behind the indexer for backfill and live ingestion, and in the frontend for small recent/current reads. It should not be the per-visitor historical database. Before launch, complete and verify the one-time backfill, compare ownership totals against current contract state or an independent index, then serve paginated indexed results immediately.
