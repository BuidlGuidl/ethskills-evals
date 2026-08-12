# Sanity check

The proposed page is an on-demand indexer running inside every visitor's browser. It will not be one `eth_getLogs` request in production.

## Request count

`eth_getLogs` is a range query, but RPC providers cap the block span and/or the number of logs returned. The JSON-RPC method itself supplies no pagination. A client that wants the complete history must split the range and retry with smaller chunks when a provider rejects a range or a response has too many results.

Using a common 10,000-block maximum as the concrete case:

```
latest block                         25,500,000
blocks per permitted log query           10,000
required queries          ceil(25,500,001 / 10,000) = 2,551
```

So one fresh page load becomes about **2,550 sequential/rate-limited `eth_getLogs` calls** for the collection `Transfer(address,address,uint256)` topic, not one. The exact count is provider- and plan-dependent: a 2,000-block cap is about 12,751 calls; a provider may also force smaller chunks for busy ranges because of a result-count cap. “Standard RPC” does not make those provider operating limits standard or removable. Each visitor repeats this work, and polling for new activity adds more requests.

Sales are also not universally represented by an ERC-721 `Transfer`. To label a transfer as a sale requires marketplace-specific events and/or transaction/receipt interpretation, adding indexed sources and often more RPC calls.

## What breaks first

The first visible production failure is normally the RPC boundary: `eth_getLogs` returns a “too many blocks/results” error, hits request/concurrency/rate limits, or times out. A generic/free key is especially unlikely to sustain thousands of historical log scans per page view.

Even if a provider accepts the traffic, the UX still fails: the browser waits through thousands of round trips, downloads and parses years of logs, sorts them, and reconstructs balances. That is slow and memory/CPU-heavy on ordinary devices. It also cannot show a usable newest-first feed until the historical scan is far enough along (unless special-case logic is added). Repeating it for every user creates avoidable provider cost and throttling.

## Build instead

Run a persistent, server-side indexer (or use an indexing service) once, then serve query-ready data:

1. Backfill the collection's `Transfer` logs in bounded ranges, checkpoint the last processed block, and deduplicate by `(chainId, transactionHash, logIndex)`.
2. Continue from the checkpoint using block polling/subscriptions. Handle reorgs by storing block hashes and rolling back/reprocessing a small confirmation window.
3. Maintain two derived views in a database:
   - `activity`: timestamp/block/log ordering, event type, token, from/to, transaction; query newest-first with cursor pagination.
   - `holder_balances`: increment sender and decrement recipient for every transfer, then query `ORDER BY balance DESC` for top holders. Treat the zero address as mint/burn, not a holder.
4. Enrich sale events with the marketplaces/events required by the product; do not infer “sale” from every transfer.
5. Put an API/cache in front of those views. The page should make roughly two small requests—first activity page and top-holders list—rather than historical chain scans. It can poll or subscribe only for newly indexed items.

This needs infrastructure the plan currently excludes: an always-running worker (or managed indexer), durable database, and API/cache. A hosted indexer can replace much of the worker/RPC plumbing, but it is still extra infrastructure and should be evaluated for mainnet historical coverage, reorg behavior, rate limits, and cost. For a three-year live collection, backfill once offline; never make users perform it.
