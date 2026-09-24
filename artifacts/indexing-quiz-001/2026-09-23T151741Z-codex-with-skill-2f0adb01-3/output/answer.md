# Sanity check

The contractor's plan will not behave like "one standard RPC call per page load".
In production it turns into thousands of RPC calls per visitor, still leaves gaps in
the data, and puts the slowest possible work on the user's browser.

## What actually happens

The proposed query is:

```text
eth_getLogs({
  address: collection,
  topics: [Transfer(address,address,uint256)],
  fromBlock: 0,
  toBlock: "latest"
})
```

Ethereum is roughly at block 25,800,000. A normal RPC provider will not let a
browser ask for logs from block 0 to latest in one request. `eth_getLogs` over a
large range is expensive for the node because it has to search block log blooms and
then load matching receipts. Providers therefore enforce block-range limits,
response-size limits, timeouts, and credit/rate limits.

A common safe production assumption is about 10,000 blocks per `eth_getLogs`
request. With 25,800,000 blocks, that means:

```text
ceil(25,800,000 / 10,000) = 2,580 eth_getLogs requests
```

That is just to scan the collection's `Transfer` logs once. If the provider's
limit is 5,000 blocks, it becomes about 5,160 requests. If it is 2,000 blocks, it
becomes about 12,900 requests. Some providers have even stricter practical limits
when the matching log count is high.

The browser also does not get everything the UI needs from those logs:

- `Transfer` logs identify mints and token movements, but not sales. A sale has to
  be inferred from marketplace events such as Seaport orders, payment logs, or an
  indexed NFT activity API. The collection's ERC-721 `Transfer` event alone cannot
  tell whether a transfer was a sale, a gift, a vault move, a sweep, or a marketplace
  fulfillment.
- Logs include `blockNumber`, `transactionHash`, `logIndex`, topics, and data, but
  not a nice timestamp. For feed timestamps, the app needs block metadata too. If
  fetched live, that means additional `eth_getBlockByNumber` calls for each distinct
  event block unless there is another cache.
- To compute top holders, the browser has to replay every mint, burn, and transfer
  from genesis of the collection, maintain token owner state, then aggregate owner
  counts. That work repeats for every visitor and every refresh.

So the real first-load shape is at least ~2,580 RPC calls per user under a generous
10,000-block chunking rule, plus extra calls for timestamps and sale enrichment.
It is also a large amount of JSON to download and parse before the page can show
the final holder ranking.

## What breaks first

The first thing to break is the RPC path, not React.

If the client sends one giant `eth_getLogs` request from block 0 to latest, many
providers will reject it immediately with a block range error, timeout, or response
too large error.

If the client chunks the query, production traffic becomes the problem. One user
costs thousands of RPC requests. Ten simultaneous cold page loads become tens of
thousands of requests. The provider will start returning 429s, timeouts, incomplete
responses, or paid-plan overage pain. Browser concurrency limits make the page
feel hung, and retries make the provider load worse.

Even if the RPC provider allowed it, the frontend would still be doing the wrong
job. The user waits while their device downloads years of logs, parses them, sorts
the activity feed, computes current owners, fetches timestamps, and tries to infer
sales. Mobile clients will be especially rough.

There is also a correctness issue: the activity feed says "mint, sale, and
transfer", but the proposed data source only gives "mint-ish and transfer". Sales
need marketplace-aware indexing.

## What to build instead

Build or buy an indexer. The frontend should query already-indexed, already-shaped
data, not scan Ethereum history on page load.

A good architecture is:

1. Backfill once from the collection's deployment block, not block 0.
2. Index the collection's `Transfer` events into durable storage.
3. Maintain current token ownership as events are processed.
4. Maintain holder balances and a top-holder ranking table/materialized view.
5. Index sales from marketplace sources, for example Seaport and other marketplace
   events, or use a provider's NFT activity API if that coverage is acceptable.
6. Keep the indexer synced at the chain head.
7. Serve the frontend through fast API queries:
   - `GET /activity?limit=50&cursor=...`
   - `GET /holders/top?limit=50`

For infrastructure, there are three practical options:

- The Graph: define entities for tokens, transfers, holders, and sales; deploy a
  subgraph; query it from the app or from a thin backend.
- Ponder or a similar TypeScript indexer: run your own indexer against RPC,
  write to Postgres, expose a small API. This is often a good fit when the app
  needs custom ranking and marketplace logic.
- A hosted NFT data provider: use APIs from an NFT/indexing provider for ownership,
  transfers, and sales. This is fastest to ship but creates provider dependency
  and may have marketplace coverage gaps.

The holder panel should not be computed by replaying history in the browser. It
should be a precomputed query over indexed current state, for example:

```text
holders(owner, token_count, updated_at)
tokens(token_id, owner, minted_at, burned_at)
activity(id, kind, token_id, from, to, tx_hash, log_index, block_number, timestamp, price, currency, marketplace)
```

Then the page load is small and predictable:

```text
1 request for the first page of activity
1 request for top holders
optional 1 request for collection summary metadata
```

So instead of thousands of RPC calls and years of chain history per visitor, the
frontend makes two or three normal API calls and receives only the rows it needs
for the initial screen.

## Recommendation

Do not ship the contractor's plan. It will fail on provider limits first, then on
cost and latency, and it still will not correctly identify sales.

If we do not already have indexing infrastructure, we need to add it. The minimum
production-ready version is an indexer that backfills the collection from its
deployment block, continuously processes new blocks, stores transfer/activity rows,
maintains current owners and holder counts, and exposes paginated API endpoints
for the feed and top holders.
