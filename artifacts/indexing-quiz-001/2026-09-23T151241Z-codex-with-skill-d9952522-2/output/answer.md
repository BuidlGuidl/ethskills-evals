# Sanity check: do not build this as a browser `eth_getLogs` scan

The contractor's plan turns every page load into a fresh historical index build.
That is the wrong shape for this product.

The call they describe is not really one RPC request in production:

```text
eth_getLogs({
  fromBlock: 0,
  toBlock: "latest",
  address: COLLECTION,
  topics: [Transfer(address,address,uint256)]
})
```

Ethereum is around block `25,800,000`. RPC providers do not generally allow one
unbounded `eth_getLogs` query across the whole chain history. They cap either the
block range, the number of returned logs, response size, execution time, or all of
those. Since JSON-RPC has no cursor for `eth_getLogs`, the only way to paginate is
to split the query by block ranges.

Using an optimistic `10,000`-block window:

```text
ceil(25,800,000 / 10,000) = 2,580 eth_getLogs requests
```

That is the rough best-case order of magnitude for one page load if the browser
tries to reconstruct the whole collection from genesis. If the provider requires
`2,000`-block windows for uncapped log responses, it becomes:

```text
ceil(25,800,000 / 2,000) = 12,900 eth_getLogs requests
```

Some free-tier/provider configurations are stricter than that, so the practical
range is "thousands of RPC calls per visitor" before retries. The exact number is
forced by the provider's maximum block span and matched-log/response-size limits,
not by our code preference. A busy collection can force even smaller windows
because the response can exceed the log-count or payload cap even if the block
range itself is allowed.

## What breaks first

The first production failure is likely the very first full-history call. The RPC
provider will reject it with something like "block range too wide", "too many
results", a timeout, or a payload-size error.

If the contractor then "fixes" that by paginating in the browser, the next failure
is rate limiting and latency:

- One visitor can trigger roughly `2,580` to `12,900+` RPC calls.
- Ten simultaneous visitors can become tens of thousands of calls.
- Every visitor repeats the same historical work from scratch.
- The frontend exposes the provider key, so quota abuse becomes easy.
- The browser has to download, parse, sort, and aggregate years of logs before the
  page becomes useful.
- Mobile clients will be especially bad: long load, high memory use, frozen UI,
  and partial state if any chunk fails.

There is also a product correctness issue: the collection's ERC-721 `Transfer`
event gives mints, burns, and transfers. It does not, by itself, reliably give
"sales". A secondary sale usually has a token transfer plus marketplace-specific
order/payment events from Seaport, Blur, LooksRare, X2Y2, etc. To show sales with
price, currency, buyer, seller, and marketplace, we need marketplace fill data or
an NFT sales data provider, not only the collection `Transfer` log.

The top-holders panel has the same indexing problem. To rank holders, we need the
current balance of every wallet. A wallet ranking is an aggregate over the full
history of mints, transfers, and burns. The chain can answer specific reads like
`ownerOf(tokenId)` or `balanceOf(wallet)`, but it does not give "top holders for
this collection" as a cheap direct RPC call. That ranking needs to be maintained
offchain.

## What to build instead

Build a read model once, keep it updated, and let the frontend query that.

Recommended shape:

1. Run a server-side indexer starting at the collection deployment block, not
   block `0`.
2. Backfill the collection's `Transfer` events once.
3. Decode each event into durable tables:
   - `activity`: contract, token id, from, to, tx hash, block number, log index,
     timestamp, activity type.
   - `token_owner`: token id -> current owner.
   - `holder_balance`: wallet -> current token count.
4. Add sale data separately:
   - Either index marketplace fill events and correlate them with token transfers.
   - Or use a provider/API that already normalizes NFT sales.
5. Tail new blocks continuously by polling or subscribing to logs.
6. Handle reorgs by storing block hash/log identity and only finalizing after a
   confirmation depth, or by reverting/replaying affected blocks.
7. Expose small frontend queries:
   - `GET /activity?limit=50&cursor=...`, ordered by `(block_number, log_index)`
     descending.
   - `GET /holders?limit=50`, ordered by `holder_balance.count` descending.

Then page load is no longer thousands of RPC calls. It is one or two fast indexed
queries against our API, database, subgraph, or managed NFT data provider.

This does require infrastructure we do not have in the contractor's plan. Viable
options:

- A Ponder/Subsquid/custom indexer plus Postgres.
- A The Graph subgraph, published for production use.
- A managed NFT data API such as Reservoir/SimpleHash/Alchemy NFT APIs, especially
  if we want normalized marketplace sales quickly.

For this product, I would use an indexer plus Postgres if we need control over
ranking, filtering, and display logic. If speed matters more than owning the data
pipeline, I would evaluate a managed NFT API for the feed/sales data and still keep
a small backend cache for the top-holders query.

## Bottom line

The browser should not call `eth_getLogs` across three years of mainnet history.
At today's chain height, that becomes thousands of RPC calls per page load under
normal provider limits, or it fails immediately if sent as one giant request. The
right architecture is a persistent offchain index that performs the historical
backfill once, tails new activity, maintains current holder balances, and serves
paginated feed/ranking queries to the frontend.

Sources checked:

- Ethereum JSON-RPC `eth_getLogs` method:
  https://ethereum.github.io/execution-apis/api/methods/eth_getLogs/
- Alchemy `eth_getLogs` notes on block/log/response safety limits:
  https://www.alchemy.com/docs/deep-dive-into-eth_getlogs
- Alchemy Ethereum `eth_getLogs` reference:
  https://www.alchemy.com/docs/chains/ethereum/ethereum-api-endpoints/eth-get-logs
