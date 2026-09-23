# Sanity check

The contractor's plan will not behave like "one standard RPC call."

If the frontend calls `eth_getLogs` for the ERC-721/1155 `Transfer` event from block `0` to `latest` when Ethereum is around block `25,800,000`, a production RPC provider will almost certainly reject the request or force the range to be split. A common practical limit for log queries is about `10,000` blocks per request, because the node/provider has to search historical log indexes across the requested block range and return a potentially large JSON response.

Using that window:

```text
25,800,000 blocks / 10,000 blocks per eth_getLogs request
= 2,580 eth_getLogs requests
```

So one page load becomes roughly:

```text
1 eth_blockNumber request to find latest
+ 2,580 eth_getLogs requests
= 2,581 RPC requests minimum
```

That is the optimistic number. It only covers fetching raw `Transfer` logs. It does not include retries, pagination caused by response-size limits, block timestamp lookups, sale classification, metadata, ENS, or token images.

There are two more hidden multipliers:

1. Logs do not include block timestamps. They include `blockNumber`, `transactionHash`, `logIndex`, etc. If the activity feed needs timestamps and the client has only raw logs, it needs `eth_getBlockByNumber` for each block that contains a relevant event. Depending on collection activity, that can add hundreds, thousands, or tens of thousands of extra RPC calls unless the app gets timestamps from an indexer.

2. `Transfer` events alone do not reliably tell you that a transfer was a sale. A mint can be inferred when `from` is the zero address. A burn can be inferred when `to` is the zero address. But a nonzero-to-nonzero transfer might be a sale, gift, vault movement, escrow movement, marketplace settlement, airdrop, or consolidation. To label sales, you need marketplace events, transaction context, receipts/logs from Seaport/Blur/etc., or a provider/indexer API that has already classified NFT sales.

# What breaks first

The first thing that breaks is the initial `eth_getLogs` call from block `0` to `latest`. Most hosted RPC providers will return a block-range error, timeout, gateway error, payload-size error, or rate-limit response. Even if one provider accepts the shape, it is not a dependable browser-page-load query.

If the contractor then chunks the request into 10,000-block windows, the app has a different production failure: every visitor starts a multi-thousand-request backfill from the browser. That will be slow, expensive, and fragile. Users will wait minutes or hit failures before seeing the page. Your provider key will burn through request quotas. Parallelizing the calls makes the UI faster only by making rate limits, 429s, retries, and provider bans more likely.

The holder panel is especially bad for this design. To rank current holders, the browser must replay every historical transfer in order, maintain `tokenId -> owner`, and then aggregate `owner -> count`. That means the "top holders" panel cannot be correct until the full historical scan finishes. Newest-first activity is also awkward because the client can fetch recent chunks first, but the holder ranking still needs the whole collection history.

Starting at block `0` makes it worse because the NFT contract did not exist for most of mainnet history. If the collection deployed around three years ago, the real start block is much later than `0`, so a deployment-block start would reduce the scan. But even a few million blocks is still hundreds of `eth_getLogs` calls per visitor, which is still the wrong shape for a frontend.

# What to build instead

Build or use an indexer. Yes, that means infrastructure you do not currently have under the contractor's plan.

The production shape should be:

1. An indexer starts from the collection deployment block, not block `0`.
2. It processes `Transfer` events once, off the critical user path.
3. It stores normalized activity records with transaction hash, log index, block number, timestamp, token ID, `from`, `to`, and activity type.
4. It maintains current ownership state: `tokenId -> owner`.
5. It maintains holder balances: `owner -> token count`.
6. It exposes fast paginated queries to the frontend.

For the activity feed, the frontend should ask something like:

```text
GET /api/activity?limit=50&cursor=...
```

or a GraphQL query ordered by `blockNumber desc, logIndex desc`.

For top holders, the frontend should ask:

```text
GET /api/top-holders?limit=25
```

That query should read a precomputed or indexed table sorted by balance, not replay the chain.

Reasonable implementation options:

- The Graph subgraph: good if you want a hosted/decentralized GraphQL index over NFT transfers and holder entities.
- Ponder, Envio, Subsquid, or a custom worker: good if you want a TypeScript-owned app indexer and your own database.
- Provider NFT APIs such as Alchemy/Reservoir/SimpleHash: good if you want to buy the indexed feed/ownership/sales data instead of building it, with the tradeoff of relying on their classification and API.

For sales specifically, either index marketplace events as well or use an NFT market data provider. A pure collection `Transfer` indexer can produce mints, burns, and transfers, but it cannot honestly label every sale by itself.

The frontend can still use RPC for small live updates, such as polling recent logs from the last few blocks or subscribing to new heads. But the historical feed and holder ranking should come from an index that has already done the expensive scan once.

In short: direct RPC is fine for recent tail data; it is the wrong tool for a three-year historical activity feed and current holder leaderboard. The shipped version of the contractor plan would turn one page load into about `2,581+` RPC requests at today's block height, fail or rate-limit in production, and still lack enough context to classify sales correctly.
