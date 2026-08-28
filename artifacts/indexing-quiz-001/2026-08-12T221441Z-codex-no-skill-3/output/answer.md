# Sanity check

The proposal is not a viable production read path. `eth_getLogs` is range-limited by RPC providers; it is not an unbounded, "one request returns all history" API.

## What this page load does

The proposed request asks for the ERC-721 `Transfer(address,address,uint256)` topic, scoped to the collection address, over blocks `0..25,500,000`.

That range is about 25.5 million blocks. A typical hosted RPC accepts at most roughly 10,000 blocks per `eth_getLogs` request (the exact limit varies by provider and plan). To make it work at that limit, the client has to split the range into:

```
ceil(25,500,001 / 10,000) = 2,551 eth_getLogs requests
```

per page load, before it has rendered anything. A 2,000-block limit makes that about 12,751 requests; a provider that rejects the original 25.5M-block query makes it fail immediately. Starting at the actual collection deployment block would reduce the backfill, but does not turn it into a page-load operation.

For every returned Transfer the browser must then decode the log and replay it: increment the recipient's balance, decrement the sender's balance, and handle the zero address for mints/burns. Only after the whole history is replayed can it know the current top holders. It also needs to sort or retain recent events for the feed. This is repeated independently by every visitor.

## First production failure

The literal single request will normally be rejected for exceeding the provider's `eth_getLogs` block-range/result-size limit. "Any provider key works" is false: limits, log-result caps, rate limits, historical availability, and billing differ.

If the client adds chunking, the next failures are predictable:

- Thousands of requests exceed client/provider rate limits, producing 429s, retries, and long or incomplete loads.
- A popular page multiplies that backfill by visitors, consuming quota and exposing the provider key in the browser.
- Large collections can hit response-size/log-count limits even inside a permitted block range.
- The feed is not actually a sale feed. ERC-721 `Transfer` says ownership moved; it does not say whether it was a sale, gift, mint, burn, marketplace fulfillment, or what price was paid. Sale classification needs marketplace/payment event indexing and often transaction-level interpretation.
- Recent blocks can reorganize, so a current-state ranking needs confirmation/reorg handling rather than a one-off replay.

## Build instead

Add an indexing backend; it is required infrastructure for fast, reliable current-state queries.

1. Backfill collection events once, from the collection's deployment block, with server-side chunked `eth_getLogs`. Persist normalized transfers and relevant marketplace/payment events in a database.
2. Continuously ingest new blocks (websocket subscription or polling), wait for a chosen confirmation depth, and rewind/replay on reorgs.
3. Maintain materialized read models: a paginated activity table ordered by block/log index, and per-wallet current token counts (plus token ownership if needed). Derive and store the top-holders ranking from those counts.
4. Serve the frontend small API responses such as `GET /activity?cursor=...` and `GET /top-holders?limit=...`, cacheable at the edge. The page should request one feed page and one ranking, not chain history.

This can be built with a managed NFT/indexing provider if its API supplies collection activity and holder balances, or with a custom indexer (for example Ponder, Subsquid, or a The Graph-style indexer) plus Postgres and a small API. A provider can reduce operations work, but it is still external infrastructure and its holder/sale semantics must be verified. For accurate sale labels and prices, budget for custom marketplace/payment-event indexing rather than assuming `Transfer` is enough.

The one-time historical backfill is acceptable on a worker; it is precisely the work that must not run in every browser session.
