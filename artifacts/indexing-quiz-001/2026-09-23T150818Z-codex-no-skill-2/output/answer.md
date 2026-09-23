# Sanity check: client-side full-history `eth_getLogs`

The contractor's plan will not survive production traffic. It treats `eth_getLogs` like a paginated database query, but Ethereum JSON-RPC does not give you a cursor over logs. You ask for a block range and either get the whole matching array back or the provider rejects/times out the request. Providers add their own limits because wide log scans are expensive.

At block `25,800,000`, the request `fromBlock: 0, toBlock: latest` spans `25,800,001` blocks. On a provider with a common `10,000` block `eth_getLogs` range cap, that means:

```text
ceil((25,800,000 - 0 + 1) / 10,000) = 2,581 eth_getLogs calls
```

That is the optimistic paid-provider version. The number is forced by provider block-range caps, not by the NFT contract. QuickNode documents `10,000` blocks for paid plans and `5` blocks for free trial accounts. Alchemy's current docs say free Ethereum `eth_getLogs` is limited to `10` blocks, while paid tiers allow larger ranges but still cap large responses, including a `10,000` log response cap or a smaller block window option. So "any provider key works" is false: depending on the key, the same page load could mean about `2,581` calls, `12,901` calls if you choose `2,000` block chunks to avoid result caps, `2,580,001` calls on a `10` block free limit, or `5,160,001` calls on a `5` block free-trial limit.

Those counts are before retries and before UI enrichment. Standard log objects do not reliably give you all product fields you probably want, such as sale price, marketplace, normalized timestamp, token metadata, ENS names, or USD values. If the feed needs timestamps from standard RPC, you also need block lookups for event blocks unless your provider adds a nonstandard `blockTimestamp`. If it needs actual sale rows, the collection's ERC-721 `Transfer` event is insufficient by itself: mints and transfers are visible from `from == 0x0` and ordinary ownership changes, but sale price and venue come from marketplace/order/payment data or an indexer.

## What breaks first

The very first implementation, if it literally sends one `eth_getLogs` from block `0` to `latest`, will usually fail immediately. You will see errors like "range too large", "limited to 10,000 blocks", "query returned more than 10000 results", HTTP `429`, gateway timeouts, or provider-specific JSON-RPC errors.

If the frontend is changed to chunk the scan, the next failure is quota and latency. One user opening the page causes thousands of RPC calls. Ten simultaneous visitors can become tens of thousands of historical log scans. A normal public frontend will either burn the provider quota, get rate-limited, or make users wait a very long time while their browser downloads and decodes years of logs.

The browser is also the wrong place to compute the holder table. To rank holders "right now", the client must process every historical mint, transfer, and burn in order, maintain balances for all wallets, then sort them. That is duplicated work for every visitor, expensive on mobile, and fragile around reorgs, missed chunks, retries, and provider inconsistencies at the chain head.

Finally, this architecture cannot give a clean "newest first" activity feed quickly. The newest activity is at the end of the scan, so a first-time visitor cannot render correct historical context until the backfill finishes. You can reverse-scan recent chunks for the feed, but that still does not solve the top-holder computation, which requires the full current ownership state.

## What to build instead

Build or buy an indexer, and make the frontend read from your own API.

Minimum self-hosted shape:

1. Create a backend worker for the collection contract, starting from the contract deployment block, not block `0`.
2. Backfill `Transfer` logs in bounded ranges with retry/backoff and provider-aware chunk sizes.
3. Store normalized events in a database keyed by `(block_number, transaction_index, log_index)` so replays are idempotent.
4. Maintain a current ownership/balance table as the worker processes logs.
5. Maintain precomputed holder rankings, or query them from indexed balance columns.
6. Poll or subscribe for new blocks/logs, wait a small confirmation depth, and handle reorgs by rolling back/replaying affected blocks.
7. Expose API endpoints like `GET /activity?cursor=...` and `GET /holders/top?limit=50`.

For the activity feed, store one row per displayable event and index it by descending `(block_number, log_index)`. The page should fetch the first 25 or 50 rows from your API, not scan Ethereum. For holders, store `owner -> token_count` plus token ownership rows if you need wallet detail pages. The top holders panel should be a single indexed database query or a cached materialized view.

If you need sales, add marketplace data explicitly. Options include integrating Reservoir, SimpleHash, Alchemy NFT APIs, Moralis, OpenSea/Seaport event indexing, or indexing marketplace contracts/payment logs yourself. A raw collection `Transfer` log can be part of sale detection, but it is not enough to reliably label sales or show prices.

This does require infrastructure you do not have in the contractor's plan: a backend worker, persistent database, and an API/cache layer. If you do not want to operate that, use a hosted NFT/indexing provider and cache its results behind your own backend. Either way, the production frontend should load pre-indexed data. The browser should never perform a three-year Ethereum log backfill on page load.

Sources checked: Ethereum Execution API `eth_getLogs` reference; QuickNode `eth_getLogs` docs and range-limit support article; Alchemy `eth_getLogs` docs and log-limit guide; MetaMask/Infura guidance on fetching block ranges.
