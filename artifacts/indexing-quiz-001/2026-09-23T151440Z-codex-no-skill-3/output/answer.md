# Sanity check: do not do this in the browser

The contractor's plan is not viable for production. `eth_getLogs` is the right primitive for building an indexer, but it is the wrong thing to run from every user's browser on every page load.

## What actually happens on page load

The frontend cannot reliably make one `eth_getLogs` call from block `0` to `latest` and get the complete collection history back.

At a current height of about `25,800,000`, a provider with a `10,000` block `eth_getLogs` window forces this into:

```text
ceil((25,800,000 - 0 + 1) / 10,000) = 2,581 eth_getLogs requests
```

So the "one page load" is roughly `2,580` RPC requests before the app can finish reconstructing history. That number is forced by provider safety limits around `eth_getLogs`, not by our frontend framework. The Ethereum JSON-RPC method accepts a block range and topics, but providers put practical limits around it because large log scans are expensive and can return huge payloads.

It can be worse:

- If we use a safer `2,000` block window to avoid response-count caps, the same scan becomes `ceil(25,800,001 / 2,000) = 12,901` requests.
- Some free/provider trial tiers are much smaller. Alchemy's Ethereum free tier documents a `10` block range, which would be about `2,580,001` requests. QuickNode documents `5` blocks on free trial and `10,000` blocks on paid plans, which would be about `5,160,001` requests on the free trial or `2,581` on paid.
- If we start at the contract deployment block instead of block `0`, the number is smaller but still bad. A collection deployed about three years ago is roughly 7.9 million Ethereum blocks old, which is still about `790` requests at `10,000` blocks per request or about `3,950` requests at `2,000` blocks per request.

Those are only the log-scan calls. They do not include extra calls needed to enrich records with block timestamps, transaction details, marketplace order data, or receipt-level correlation.

## What breaks first

The first failure is provider rejection or timeout.

If the client sends one huge `eth_getLogs` request, many providers reject it immediately with a range-limit error, a result-limit error, or a timeout. If the contractor adds chunking to work around that, the next failure is rate limiting and quota burn: every visitor now launches thousands of RPC calls against our public frontend key.

After that, the user experience breaks:

- The activity feed cannot show quickly because the browser is waiting for a historical backfill that may take minutes or fail partway through.
- The holder ranking cannot be trusted until the entire transfer history has been replayed, because one missed log changes current ownership.
- Mobile browsers will struggle with the network volume, JSON parsing, sorting, and in-memory ownership map.
- Any transient RPC error creates partial state unless the client has complex retry, checkpoint, and verification logic.
- Multiple users repeat the exact same historical scan independently, which is pure waste and looks like abusive traffic to the provider.

There is also a product correctness problem: the ERC-721 `Transfer(address,address,uint256)` event alone does not tell us that a transfer was a sale, what marketplace it happened on, or what price/currency was paid. Mints can be detected from `from == 0x000...000`, and transfers can be shown, but "sale" requires marketplace events, transaction/receipt correlation, traces, or a third-party NFT sales index.

## What to build instead

Build or buy an index, then make the frontend read small, paginated API responses.

The production shape should look like this:

1. Backfill once, server-side.
   Run a backend job that scans the collection's `Transfer` logs from the contract deployment block to the current finalized/head block. Store normalized activity rows in a database. Use chunked `eth_getLogs`, retry logic, and checkpoints. This is where `eth_getLogs` belongs.

2. Maintain current ownership as materialized state.
   While ingesting transfers, keep a table like:

   ```text
   token_id -> current_owner
   wallet -> balance
   ```

   For top holders, query the database, not Ethereum, for something like:

   ```sql
   select owner, count(*) as token_count
   from current_token_owners
   group by owner
   order by token_count desc
   limit 50;
   ```

   For faster reads, materialize this ranking and update it as new transfers arrive.

3. Serve the activity feed from the database.
   The frontend should request `/api/activity?limit=50&cursor=...`, and the backend should return pre-indexed rows ordered by `(block_number desc, log_index desc)`. First paint should need one normal HTTP request, not thousands of RPC calls.

4. Tail new blocks continuously.
   After the backfill, a worker polls or subscribes for new logs, writes new activity rows, and updates ownership/balances. Handle reorgs by waiting for confirmations/finality or by marking recent rows as provisional and rolling them back if removed logs appear.

5. Add sales enrichment deliberately.
   If the feed must distinguish mints, sales, and plain transfers, add a sales index. The quickest route is integrating a provider that already indexes NFT sales and ownership, such as Reservoir, SimpleHash, Alchemy NFT APIs, Moralis, NFTScan, or another marketplace/NFT data provider. The heavier route is building our own sales indexer for Seaport, Blur, LooksRare, X2Y2, etc., correlating marketplace events and NFT transfers by transaction hash/log order.

## Infrastructure this requires

Yes, the alternative needs infrastructure we do not have if we only planned to ship static frontend code:

- A backend/indexer worker.
- A database, for example Postgres.
- A provider key used server-side, not as the sole public browser data source.
- A small API for activity pagination and holder rankings.
- Monitoring/checkpointing so we know the indexer is caught up.

If we do not want to operate that ourselves, use a hosted indexer or NFT API. That is still "extra infrastructure", just outsourced. The important point is that someone has to maintain the historical index. Pushing that work into every visitor's browser is the part that will fail.

## Recommendation

Do not ship the contractor's plan.

Use `eth_getLogs` for a one-time and ongoing backend indexing pipeline, or buy the indexed data from a specialized provider. The frontend should load the newest activity and top holders from our indexed API in tens of milliseconds to a few hundred milliseconds, with small paginated payloads. The page should never need to replay three years of Ethereum history before rendering.

## Sources checked

- Ethereum Execution API: `eth_getLogs` returns logs matching a filter by block range/address/topics: https://ethereum.github.io/execution-apis/api/methods/eth_getLogs/
- QuickNode documents `eth_getLogs` block-range limits of `5` blocks on free trial and `10,000` blocks on paid plans: https://www.quicknode.com/docs/ethereum/eth_getLogs
- QuickNode explains the `10,000` block range limit and the need to split large scans: https://support.quicknode.com/articles/3261121056-understanding-the-10-000-block-range-limit-for-querying-logs-and-events
- Alchemy documents Ethereum `eth_getLogs` plan-dependent block ranges and a `150MB` response cap: https://www.alchemy.com/docs/chains/ethereum/ethereum-api-endpoints/eth-get-logs
- Alchemy's `eth_getLogs` deep dive notes large-range/result safety limits and recommends WebSockets for frequent new-log delivery: https://www.alchemy.com/docs/deep-dive-into-eth_getlogs
- MetaMask/Infura notes client differences around `eth_getLogs` at the chain head and the need to verify/retry around recent blocks: https://support.metamask.io/ja/develop/building-with-infura/general-knowledge/fetching-block-ranges/
