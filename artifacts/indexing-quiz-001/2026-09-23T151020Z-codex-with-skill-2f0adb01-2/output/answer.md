# Sanity check: client-side `eth_getLogs` is not a production plan

The contractor's plan sounds like one standard RPC call, but it will not behave that way in production.

If the browser sends this:

```json
{
  "method": "eth_getLogs",
  "params": [{
    "fromBlock": "0x0",
    "toBlock": "latest",
    "address": "0xCollection",
    "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
  }]
}
```

the first thing that happens is usually not "the full history comes back." Most hosted RPC providers reject or time out large log scans. This is exactly the kind of request their `eth_getLogs` limits are designed to prevent.

Ethereum is about 25,800,000 blocks in the prompt. A common paid-provider block range limit for `eth_getLogs` is 10,000 blocks. That means a full-chain scan must be split into roughly:

```text
25,800,000 blocks / 10,000 blocks per request = 2,580 eth_getLogs requests
```

That is the optimistic number. It assumes every 10,000-block chunk succeeds, no chunk has too many logs, no response exceeds the provider's byte cap, and the provider allows 10,000-block ranges on the selected plan. Some providers and plans are stricter. For example, Alchemy documents small free-tier ranges and separate response caps, and QuickNode documents a 10,000-block paid-plan range limit with much smaller free-trial limits. If you use 2,000-block chunks to avoid response-size and log-count failures, the same load becomes:

```text
25,800,000 / 2,000 = 12,900 eth_getLogs requests
```

Even if you fix the obvious waste and start from the collection's deployment block instead of block 0, three years of Ethereum history is still about 7.9 million blocks at 12-second blocks:

```text
7,900,000 / 10,000 = about 790 eth_getLogs requests
7,900,000 / 2,000 = about 3,950 eth_getLogs requests
```

So the real shape is:

```text
1 eth_blockNumber-ish call to decide "latest"
+ 2,580 to 12,900+ eth_getLogs calls for the historical scan
+ retries/backoff for failed chunks
+ browser CPU/memory to decode and sort all events
```

And this is per page load, per user, unless aggressively cached somewhere outside the browser.

## What breaks first

The literal one-call implementation breaks first: the RPC returns an error, times out, or returns a capped result instead of the entire collection history.

If the frontend is changed to chunk the range, the next failure is provider rate limiting and latency. Thousands of RPC calls from a browser tab will hit per-second limits, daily credit limits, request concurrency limits, or CORS/API-key exposure concerns. Even when some chunks succeed, the page will sit blank or half-loaded while it crawls historical chain data that never changes.

Then the user experience breaks: newest-first activity cannot render quickly because the app is waiting for old blocks before it can compute complete ownership. The "top holders" panel is even worse because it requires replaying every mint and transfer from contract deployment to now before the ranking is correct.

There is also a product-data issue: the ERC-721/1155 `Transfer` event is enough to identify mints, burns, and token movements. It is not enough to reliably label sales or show sale prices. A sale is usually inferred from marketplace protocol events, order fulfillment events, transaction traces, payment transfers, or a specialized NFT activity API. A plain collection `Transfer` can be a sale, an airdrop, a vault move, a gift, a marketplace escrow movement, or a wallet consolidation.

## What to build instead

Build or use an indexer. The browser should query a small, already-indexed API, not scan Ethereum history.

For this product I would maintain these indexed entities:

- `TransferEvent`: token id, from, to, tx hash, log index, block number, timestamp.
- `Token`: token id, current owner, mint block/time, burn status if applicable.
- `HolderBalance`: wallet, current token count.
- `SaleEvent`: token id(s), seller, buyer, price, currency, marketplace, tx hash, timestamp, derived from marketplace events or an NFT activity provider.

Then the frontend calls endpoints like:

```text
GET /activity?collection=...&limit=50&cursor=...
GET /holders/top?collection=...&limit=25
```

Those should be single-digit database/API requests, with indexed ordering by block number/log index for the feed and a precomputed or indexed balance table for holders.

Good implementation options:

- The Graph subgraph: good if the collection activity can be modeled from contract and marketplace events you index.
- Ponder, Envio, Subsquid, or a custom worker: good if you want TypeScript control and your own database.
- Reservoir, SimpleHash, Alchemy NFT APIs, or another NFT data provider: good if you want marketplace-enriched activity, sale attribution, and less infrastructure.

Yes, this alternative needs infrastructure you do not have in the contractor's plan. At minimum you need an indexing service plus persistent storage, or a paid third-party NFT data/indexing API. The payoff is that historical backfill happens once on the server side, new blocks are processed continuously, and every user page load asks for the latest 50 rows instead of replaying three years of Ethereum logs.

## Practical launch plan

Start indexing from the collection's deployment block, not block 0. Backfill all collection `Transfer` logs once, compute current owners and holder balances, then keep the indexer synced block by block. Store a cursor/checkpoint so restarts continue from the last indexed block.

For the feed, serve the newest indexed activity first from a database. For mints and transfers, use the collection's `Transfer` events. For sales, either integrate marketplace-specific events/traces or use a provider that already normalizes NFT sales. Do not pretend every `Transfer` is a sale.

For the top holders panel, update balances incrementally on each transfer:

```text
from != zero address: decrement from balance
to != zero address: increment to balance
```

Then query the top balances with a normal database index. That makes the holder panel fast and correct without asking the browser to replay the chain.

References checked:

- Alchemy `eth_getLogs` docs: https://www.alchemy.com/docs/chains/ethereum/ethereum-api-endpoints/eth-get-logs
- Alchemy deep dive on `eth_getLogs` limits: https://www.alchemy.com/docs/deep-dive-into-eth_getlogs
- QuickNode `eth_getLogs` docs: https://www.quicknode.com/docs/ethereum/eth_getLogs
- QuickNode block-range limit explainer: https://support.quicknode.com/articles/3261121056-understanding-the-10-000-block-range-limit-for-querying-logs-and-events
- Ethereum execution API `eth_getLogs` definition: https://ethereum.github.io/execution-apis/api/methods/eth_getLogs/
