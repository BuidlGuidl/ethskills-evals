The contractor plan will not behave like "one standard RPC call per page load."

If the browser asks for:

```text
eth_getLogs({
  address: COLLECTION,
  topics: [Transfer(address,address,uint256)],
  fromBlock: 0,
  toBlock: "latest"
})
```

most production RPC providers will reject it or time it out. `eth_getLogs` is standard JSON-RPC, but providers put practical limits around it because historical log scans are expensive. Common limits are either a maximum block range, commonly 10,000 blocks, or a maximum result set, commonly 10,000 logs. Some providers are stricter unless you are on higher tiers. For example, QuickNode documents a 10,000-block `eth_getLogs` range on paid plans, and Alchemy documents two safe paths: any range capped at 10,000 logs, or a 2,000-block range with no log-count cap.

At about block 25,800,000, a provider with a 10,000-block range limit forces:

```text
ceil(25,800,000 / 10,000) = 2,580 eth_getLogs requests
```

That is the lower-bound version if the provider allows 10,000-block windows and the result count in each window stays under its response cap. If we use Alchemy's 2,000-block no-log-cap path, the same from-genesis scan is:

```text
ceil(25,800,000 / 2,000) = 12,900 eth_getLogs requests
```

The collection has only existed for about three years, so scanning from the deployment block would reduce the work, but it is still not browser-shaped. Ethereum produces roughly one block every 12 seconds, so three years is about:

```text
3 * 365 * 24 * 60 * 60 / 12 ~= 7,884,000 blocks
```

Even if we start at deployment instead of block 0, that is still about:

```text
ceil(7,884,000 / 10,000) = 789 eth_getLogs requests
```

or:

```text
ceil(7,884,000 / 2,000) = 3,942 eth_getLogs requests
```

per page load, before retries.

What breaks first in production:

1. The first naive wide-range request will usually fail with a provider error such as "block range too large," "query returned more than 10000 results," or a gateway timeout. This happens before the frontend gets to compute anything.

2. If the frontend works around that by chunking, the page becomes a distributed backfill job. One visitor can generate thousands of RPC calls. One hundred simultaneous visitors can turn into roughly 258,000 calls with 10,000-block windows, or over 1.2 million calls with 2,000-block windows. That will hit rate limits, burn provider quota, and make page loads take many seconds or minutes.

3. The browser then has to download and process the entire collection history. For a 10,000-token ERC-721 collection, mints alone are 10,000 logs, and every sale or transfer adds more. Popular collections can have tens or hundreds of thousands of `Transfer` logs. Sorting them, replaying ownership, and rendering the newest feed from scratch on every visit is wasted work.

4. The "sale" part is not actually available from the collection's `Transfer` event alone. A sale usually causes a token transfer, but the price, currency, marketplace, fees, buyer/seller semantics, and bundle/order context live in marketplace events such as Seaport order events, not in the ERC-721 `Transfer` log. A feed built only from collection `Transfer` logs can show mints/transfers and maybe infer that some transfers are likely sales, but it cannot produce a trustworthy sales feed.

5. Exposing this workload from the client also exposes the provider key and makes every user's page load dependent on provider-specific limits. "Any provider key works" is the wrong mental model; `eth_getLogs` limits vary materially by provider and plan.

What we should build instead:

Build or buy an indexer, then serve the frontend from a small API/database.

The indexer should do the expensive historical work once, off the request path:

1. Start from the collection deployment block, not block 0.
2. Backfill `Transfer` logs in provider-safe block ranges with retry/backoff and persisted checkpoints.
3. Decode each transfer into a normalized event table: block number, transaction hash, log index, token id, from, to, event type, and timestamp.
4. Maintain a current ownership table by replaying transfers: mint gives ownership to `to`, burn removes ownership, normal transfer moves the token from `from` to `to`.
5. Maintain holder counts in the database, updated incrementally as new transfers arrive.
6. Index sale data separately by parsing marketplace events or using a marketplace/NFT data provider that already normalizes sales. Do not pretend collection `Transfer` logs are enough for sale price history.
7. Continue syncing new blocks using either polling with small `eth_getLogs` ranges or subscriptions/webhooks, with a small confirmation delay and reorg handling.

Then the frontend should call application endpoints such as:

```text
GET /api/activity?limit=50&cursor=...
GET /api/top-holders?limit=25
```

Those endpoints should read from indexed tables with ordinary database indexes:

```text
activity:     ORDER BY block_number DESC, log_index DESC LIMIT 50
top_holders: ORDER BY token_count DESC LIMIT 25
```

That makes page load one or two application API requests, not thousands of Ethereum RPC calls. The API can cache the first page of activity and the top-holder panel for a few seconds or invalidate them as the indexer ingests new blocks.

This alternative does require infrastructure the contractor plan avoids: a background indexer, persistent storage, and an API layer. That can be our own service with Postgres, or a managed/indexing product such as Reservoir, SimpleHash, Alchemy NFT APIs, Moralis, Goldsky, Subsquid, The Graph, or a marketplace data API depending on how accurate and complete the sales feed needs to be. But some indexing layer is the product requirement here. The browser should display pre-indexed data; it should not rebuild three years of chain history for every visitor.

Provider-limit references checked:

- QuickNode `eth_getLogs` docs: https://www.quicknode.com/docs/ethereum/eth_getLogs
- Alchemy `eth_getLogs` deep dive: https://www.alchemy.com/docs/deep-dive-into-eth_getlogs
