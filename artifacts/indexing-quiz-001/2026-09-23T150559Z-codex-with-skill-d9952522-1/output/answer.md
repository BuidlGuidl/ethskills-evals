# Sanity check: do not build this as a browser-side `eth_getLogs` scan

The contractor's plan sounds simple because `eth_getLogs` is a standard JSON-RPC method, but it is not a cursorable "give me all history" API. In production this turns one page load into a backfill job.

## What the page load becomes

If the client literally asks for the collection's `Transfer` logs from block `0` to `latest` at about block `25,800,000`, most providers will not serve that as one request. Public RPC providers cap large log queries by block range, matched-log count, response size, timeout, or some combination of those.

A common paid-plan block window is `10,000` blocks. With that limit, the request becomes at least:

```text
ceil(25,800,000 / 10,000) = 2,580 eth_getLogs requests
```

That is a floor, not a worst case. Some providers force smaller safe windows for uncapped results. For example, Alchemy documents a mode where `eth_getLogs` can cover any block range only when the response is capped at `10,000` logs, or a `2,000` block range with no log-count cap. If we use `2,000` block chunks to avoid losing/failing on dense result sets:

```text
ceil(25,800,000 / 2,000) = 12,900 eth_getLogs requests
```

If we were more sensible and started at the contract deployment block instead of block `0`, the collection is about three years old. At roughly one Ethereum block every 12 seconds, three years is about:

```text
3 * 365 * 24 * 60 * 60 / 12 = 7,884,000 blocks
```

That is still about `789` requests at `10,000` blocks per request, or about `3,942` requests at `2,000` blocks per request, before retries.

What forces those numbers is not the NFT contract. It is the shape of historical log access: `eth_getLogs` filters over block ranges, while providers protect their nodes with block-span, result-count, response-size, timeout, rate-limit, and credit limits. JSON-RPC does not give you a stable "page 1, page 2, page 3" cursor over all logs.

There is another correctness problem: a collection `Transfer` event can tell us mints (`from == 0x0`) and token movement. It does not, by itself, prove that a transfer was a sale or tell us the sale price, marketplace, currency, fees, or buyer/seller intent. For sales we need marketplace events, payment logs, traces, or a marketplace/NFT data API.

## What breaks first

The first version, a single `eth_getLogs` from block `0` to `latest`, will usually fail at the RPC provider before the app can render: block range too wide, too many results, response too large, or timeout.

If the contractor patches that by chunking in the browser, the next failure is operational:

- Every visitor repeats a multi-thousand-request historical backfill.
- The exposed browser provider key burns rate limits and paid credits quickly.
- Some chunks fail or time out, so the feed and holder ranking are intermittently incomplete.
- The UI cannot produce an accurate top holders panel until the entire history has been scanned and replayed.
- Large JSON responses and client-side replay will be slow and memory-heavy on normal devices.
- The activity feed still will not have reliable sale data from `Transfer` logs alone.

So the first visible production symptom is likely "the page never loads / RPC error." The next symptom, after a naive chunking fix, is "it works for one developer, then collapses under real traffic or provider limits."

## What to build instead

Build a read-side index, then make the frontend query that index.

The indexing job should:

1. Backfill once from the collection deployment block, not from block `0`.
2. Read `Transfer` logs in provider-safe chunks server-side.
3. Store normalized activity rows keyed by `(block_number, transaction_hash, log_index)`.
4. Maintain `token_id -> current_owner`.
5. Maintain `holder_address -> token_count`.
6. Tail new blocks continuously after the backfill.
7. Handle confirmations and reorgs by storing block hashes and undoing/replaying orphaned logs.
8. Index marketplace sale data separately if the feed truly needs sales with prices.

Then expose small application queries:

```text
GET /activity?limit=50&cursor=...
GET /holders/top?limit=50
```

The frontend should load the newest activity page from a database/API in one request and load the top holders panel from a precomputed holder-count table or materialized view. This makes page-load cost proportional to the visible UI, not proportional to three years of Ethereum history.

Good implementation options:

- Ponder or a small custom indexer with Postgres, plus an API route for the frontend.
- A subgraph, if its schema/query model fits the product and you are prepared to run/publish it properly.
- A managed NFT/indexing API such as Reservoir, SimpleHash, Alchemy NFT APIs, or another provider, if buying this read model is preferable to operating it.

Yes, this alternative needs infrastructure the current plan does not include. At minimum we need an indexer process, a persistent database, a production host/scheduler for the indexer, a server-side RPC key, and API endpoints for the frontend. If we use a managed NFT data provider instead, we need that vendor integration and budget instead of our own backfill/indexer stack.

## Bottom line

The contractor's plan turns the home page into a full historical chain scan. At current mainnet height that is roughly `2,580` RPC calls per page load under a common `10,000` block cap, and potentially `12,900` calls under a safer `2,000` block window, before retries and before sale enrichment. It will fail first at provider limits, then at rate limits/cost/latency if moved into a client-side loop.

Use RPC for the backfill worker and live tailing, not for every browser page load. The product should serve the feed and top holders from an indexed store that is already current when the user arrives.

Sources checked:

- QuickNode `eth_getLogs` docs: https://www.quicknode.com/docs/ethereum/eth_getLogs
- Alchemy `eth_getLogs` limits discussion: https://www.alchemy.com/docs/deep-dive-into-eth_getlogs
