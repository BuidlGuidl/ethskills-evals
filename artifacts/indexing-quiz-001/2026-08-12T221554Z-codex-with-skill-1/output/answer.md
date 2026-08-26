# Sanity check

The contractor's plan will not survive production. `eth_getLogs` is standard RPC, but providers deliberately limit the block range, response size, execution time, and request rate. “One RPC method call” is not the same as “one viable request.”

## What one page load actually does

The proposed range is 25,500,001 blocks (`0` through roughly `25,500,000`, inclusive). A common safe maximum is about 10,000 blocks per log query. Chunking the range therefore requires:

`ceil(25,500,001 / 10,000) = 2,551 eth_getLogs requests`

That is the optimistic baseline for one page load, before retries and before calls needed to enrich logs with block timestamps, transactions, receipts, token metadata, or prices. The exact provider limit varies: a provider may reject the initial block-0-to-latest request, cap ranges below 10,000 blocks, time it out, or reject a chunk whose result set is too large. Adaptive splitting makes the count higher. If the client first attempts the full range and then retries in 10,000-block chunks, it is at least 2,552 attempts.

The collection is only three years old, so starting at its deployment block would reduce wasted scans. It does not fix the architecture: millions of blocks still mean hundreds or thousands of requests, repeated independently by every visitor.

## What breaks first

Usually the first full-range `eth_getLogs` call fails with a range/response-size error or timeout. If the library automatically chunks it, the next failures are provider rate limits or RPC-credit exhaustion. Browser concurrency limits and network latency then make initial rendering extremely slow; mobile clients fare worse. A public/provider key embedded in the frontend can also be copied and burn the project's quota.

If requests eventually finish, the browser must download, retain, sort, and replay every transfer on every visit. Work and bandwidth grow with total history rather than page size. A popular launch multiplies roughly 2,551 historical calls by every cold page load, creating a thundering herd. Different users may also compute against different chain tips, while shallow reorgs can leave inconsistent results unless explicitly handled.

There is also a data-model error: ERC-721 `Transfer` logs identify mints (`from == 0x0`), burns (`to == 0x0`), and ownership changes, but do **not** prove that a transfer was a sale or contain its price. Reliable sale activity requires indexing the relevant marketplace sale/order events and often transaction/receipt/payment context. Transfers caused by wrappers or marketplace custody also need explicit interpretation.

## What to build instead

Build or buy a persistent offchain indexer. Start it at the collection deployment block, ingest confirmed blocks once, and keep a reorg-safe cursor. For each transfer, store an immutable activity row keyed by transaction hash plus log index, update the token's current owner, and increment/decrement per-wallet balances. Index marketplace sale events separately and associate them with transfers when the matching rules are sound.

Expose a small backend/API with database indexes for the two screen queries:

- Activity: cursor-paginated rows ordered by `(block_number, log_index)` descending, fetching only the first page initially.
- Top holders: materialized/current balance rows ordered by balance descending, returning only the top N.

The client should never reconstruct either view from genesis. It requests bounded, already-computed pages. For freshness, the backend can poll or subscribe to new blocks/logs, apply changes after a chosen confirmation policy, and notify clients via polling, SSE, or WebSocket. Cache the first activity page and top-holder result at the API/CDN layer if traffic warrants it.

The most direct implementation choices are:

1. A subgraph on The Graph: define `Transfer`, `Token`, and `Account`/balance entities plus marketplace-specific sale entities, then query them through GraphQL.
2. A self-hosted indexer such as Ponder plus PostgreSQL and an API. This gives more control over sale classification, reorg behavior, and ranking queries.
3. A managed NFT/transfer API if it supports this collection, all required marketplaces, pagination, current ownership, and acceptable consistency/SLA. This is fastest to launch but creates vendor dependence.

Yes, this needs infrastructure the current plan omits: at minimum an indexing service and query endpoint. A self-hosted design additionally needs a database, a reliable RPC connection for backfill/live ingestion, deployment, monitoring, and reorg recovery. A hosted subgraph or managed NFT API outsources much of that, but still requires configuration, schema/mapping work, API credentials, and production billing.

Direct RPC remains useful for bounded recent-log synchronization and current contract reads. It is not a production database for a three-year activity feed or leaderboard.
