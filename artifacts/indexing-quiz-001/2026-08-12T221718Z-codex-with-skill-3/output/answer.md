# Sanity check

The proposed design will not survive production. `eth_getLogs` is standard RPC, but providers do not promise that one request may scan all of Ethereum history or return an unbounded result.

## What one page load actually does

The browser initially sends **one** `eth_getLogs` request covering blocks 0 through about 25,500,000. In practice, a hosted RPC will usually reject or time out that request because its block range, work, response size, or all three exceed provider limits.

The usual client workaround is to split the range. With a representative **10,000-block maximum**, the minimum is:

`ceil(25,500,001 / 10,000) = 2,551` requests

(Depending on endpoint conventions, this is often described approximately as 2,550 chunks.) That number is forced by the provider's maximum query range, not by the number of collection transfers. A 2,000-block cap would mean about 12,751 requests; a provider with different limits gives a different number. Starting at the deployment block would reduce wasted scanning, but a three-year range is still millions of blocks and roughly a thousand 10,000-block requests.

Those are only log requests. If the UI needs timestamps, transaction details, receipts, marketplace/payment data, or token metadata not present in the log, it creates more RPC/API requests. Reloading or opening another browser repeats the scan unless a durable shared cache exists.

There is also a correctness problem: the ERC-721 `Transfer` event identifies mints (`from = 0x0`), burns (`to = 0x0`), and ownership transfers, but it does **not** say that a transfer was a sale or give its price. Gifts and marketplace settlements look like transfers too. Correct sale classification requires indexing relevant marketplace sale/payment events (and sometimes transaction traces) and correlating them with NFT transfers.

## What breaks first

Usually the first request fails with a range/response-limit error or times out. If the client chunks it, the next failures are provider rate limits or RPC-credit exhaustion: one visitor produces roughly 2,551 calls, and many browsers do that concurrently. Before the whole scan finishes, the page is slow or blank, downloads a large log history, consumes substantial memory, and burns CPU replaying it. Mobile clients fare worst.

Even a completed result has operational bugs: `latest` moves while chunks are fetched, retries can duplicate data, chain reorganizations can invalidate recent results, and an unbounded feed only gets larger. Browser-local computation also means every user repeats identical work.

## What to build instead

Use an offchain indexer and query the already-materialized results:

1. Start indexing at the collection's deployment block, backfill once, then continuously process new finalized blocks. Handle replay, idempotency, and reorgs.
2. Store each activity record with block number, transaction hash, log index, timestamp, token ID, from/to, and an activity type. Index marketplace events/payment data as well as `Transfer` if the feed must label sales and prices accurately.
3. Maintain current ownership while processing events: mint adds a token to the recipient, transfer moves it, and burn removes it. Maintain per-wallet balances or a materialized holder ranking. Do not recompute the ranking from three years of events on every read.
4. Expose cursor-paginated endpoints: for example, the newest 25 activities and top 20 holders. The frontend fetches only those rows. Subscribe to or poll recent indexed updates rather than rescanning history.

The straightforward options are:

- A collection-specific **The Graph subgraph**, with `Transfer`, ownership/balance, and marketplace entities, queried via GraphQL.
- A **Ponder/custom indexer plus PostgreSQL** and a small API, if sale correlation or ranking queries need more control.
- A provider's **indexed NFT/transfer API** for fastest launch, provided it supports collection-wide pagination, sale semantics, holder aggregation, and acceptable freshness/SLA. This creates vendor dependence and is not equivalent to ordinary RPC.

Yes, this needs infrastructure the plan does not include: either a hosted indexing service/subgraph, or an indexer process, database, and API that we operate. During backfill, the indexer may use RPC chunking once server-side; the important difference is that it persists and incrementally updates the result once, instead of making every page visitor replay the chain.

For launch, I would backfill and validate the index before exposing the UI, serve activity and holder queries from it, and use ordinary RPC only for narrow recent/current reads—not as the application's historical database.
