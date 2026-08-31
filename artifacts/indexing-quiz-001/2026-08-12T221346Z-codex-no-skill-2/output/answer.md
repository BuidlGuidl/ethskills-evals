# Sanity check

The proposed single `eth_getLogs` request will not return the collection history in production. `eth_getLogs` is standard; the allowed query span and returned-log limits are provider policy, not part of the Ethereum RPC guarantee.

## Request count

The requested range is blocks `0..25,500,000`: about 25.5 million blocks. RPC providers cap log queries to protect their nodes. A common maximum span is 10,000 blocks (and some plans/providers impose 2,000 or 1,000). The client must split the range after the oversized request is rejected:

```
ceil(25,500,001 blocks / 10,000 blocks per request) = 2,551 eth_getLogs requests
```

So the optimistic answer is roughly **2,550 log requests per page view**, before requests to discover `latest`, retries, pagination caused by a provider's result-size cap, or the app's own API calls. With a 2,000-block cap it is about **12,750** requests; at 1,000 it is about **25,500**. "Any provider key" therefore cannot be true: the provider's enforced range/result/rate limits determine the count.

Starting at the collection deployment block, rather than block 0, reduces the backfill but does not make this a browser-time query. The plan explicitly starts at 0, which forces the counts above.

## What fails first

1. The initial `fromBlock: 0, toBlock: latest` call is rejected for excessive block range and/or too many matching results (often an RPC limit error). It does not silently become a complete historical query.
2. If the client implements chunking, thousands of requests from every visitor quickly hit rate limits, credits, timeouts, and retries. A long sequential scan is unusable for first paint; a highly parallel scan makes throttling worse.
3. Downloading and replaying all transfers in a phone/browser is expensive in bandwidth, memory, CPU, and time. The feed cannot be "newest first" until historical processing finishes, and a holder ranking requires applying every prior transfer correctly.
4. `Transfer` alone does not reliably identify a *sale*. It identifies mint (`from == 0x0`) and token movement, but a sale needs marketplace/order/payment events or an indexed/normalized sales source. Ordinary wallet transfers and sales can have the same NFT `Transfer` event.

There are also correctness details: handle ERC-721 vs ERC-1155 semantics, removed/reorged logs, duplicate delivery, and incremental chain updates. A browser reload is a poor place to own that state.

## Build instead

Build or buy an index, then serve small read models to the frontend.

- Run a backend indexer once: begin at the collection deployment block, ingest `Transfer` logs in provider-safe chunks, store an append-only activity table, and update per-wallet balances/current ownership as each event is committed.
- Continue from a durable block cursor by polling or subscriptions. Process only sufficiently confirmed blocks, reconcile reorgs, and make ingestion idempotent.
- Expose an API such as `GET /activity?cursor=...` (newest-first, 25--50 rows) and `GET /holders?limit=...` (database `ORDER BY balance DESC`). The page now makes roughly **two small API requests**, not thousands of RPC calls.
- Index relevant marketplace/payment events too, or use a normalized NFT sales API, to label sales accurately. Keep mint/transfer classification from NFT events.

This requires infrastructure the plan says does not exist: a persistent database, an ingestion worker/scheduler, a reliable RPC/indexing provider, and a small API service. The lower-ops alternative is a managed NFT/indexing provider that supplies historical transfers, current owners, and sales; it still requires a provider account/key and the frontend should call a backend proxy/cache rather than perform a chain-wide scan.

For launch, backfill before exposing the page, verify balances against the collection, then let the frontend read only the precomputed activity and top-holder views.
