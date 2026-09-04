# This will not be one RPC call

`eth_getLogs` is an RPC *range scan*. Filtering by the collection address and the
`Transfer(address,address,uint256)` topic reduces the logs returned, but it does
not remove the node/provider limit on the block interval it must search.

At roughly block 25,500,000, a provider that permits at most 10,000 blocks per
`eth_getLogs` request requires:

```
ceil(25,500,001 / 10,000) = 2,551 getLogs requests
```

That is only the historical scan, assuming no retrying and a fixed 10,000-block
chunker. A 5,000-block policy makes it 5,101 requests; providers can impose lower
limits, a maximum number of returned logs, or both. If the client also calls
`eth_blockNumber` to select `latest`, add one request. Resolving timestamps for
each event with `eth_getBlockByNumber` would add one request per distinct block
unless batched/cached.

The contractor's literal `fromBlock: 0, toBlock: latest` request breaks first:
production RPC services normally reject an interval this large (commonly with a
"too many results" / range-limit error) or time it out. It is not portable
standard-RPC behavior that a hosted provider will execute a 25.5-million-block
log scan. Switching to browser chunking only moves the failure: thousands of
requests on every cold page load hit rate/concurrency quotas, incur seconds to
minutes of latency, waste paid RPC capacity, and are unreliable on mobile. A
large collection can also produce a large download and substantial browser work.

There is a second correctness issue: the ranking is state derived from every
transfer ever made. The browser cannot show current holders until it has obtained
and processed the full history; it cannot use just the newest page of feed
events. Repeating that full replay for every visitor is the wrong serving path.

# Build an indexed read model

Run a server-side indexer (or use a managed indexing/subgraph service) that:

1. Backfills the collection's `Transfer` logs in provider-safe block chunks,
   persists each event with block number, transaction/log index, timestamp, and
   token id, and checkpoints its last finalized block.
2. Consumes new blocks/logs incrementally. Handle removals/reorgs, or only
   publish events after a chosen confirmation depth.
3. Updates a token-owner table and holder balance table for every transfer.
   This makes "top holders now" a simple indexed query rather than a replay.
4. Exposes application APIs such as `GET /activity?cursor=...&limit=50` (ordered
   by block/transaction/log index descending) and `GET /holders?limit=...`.
   Cache these responses/CDN them where appropriate.

The frontend then makes about two small application requests on initial load: one
for the newest feed page and one for the top-holders panel (or one combined
endpoint). It can poll or subscribe only for new activity thereafter.

This alternative does require infrastructure not in the proposed plan: durable
storage, an indexing worker/service, and an API (plus a reliable RPC/archive-log
provider). A managed NFT/indexing API or hosted subgraph can supply much of this
initially, but it is still extra infrastructure and must be evaluated for
mainnet coverage, backfill limits, freshness, reorg behavior, and cost. The
client may read live chain data for a small freshness check, but it should not be
the historical indexer.
