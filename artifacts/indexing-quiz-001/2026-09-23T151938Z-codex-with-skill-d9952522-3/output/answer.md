# Sanity check: do not build this in the browser

The contractor's plan sounds like one RPC call, but that is not what will happen in production.

`eth_getLogs` over Ethereum mainnet history is treated by RPC providers as a large historical scan. Providers cap it by block range, matched log count, response size, timeout, or all of those. A request like:

```text
eth_getLogs({
  address: <collection>,
  topics: [Transfer(address,address,uint256)],
  fromBlock: 0,
  toBlock: "latest"
})
```

will usually be rejected outright before it returns anything useful. The likely error is some version of "block range too large", "query timeout", "response too large", or "too many results".

If the frontend or RPC SDK tries to work around that by paginating block ranges, the math gets ugly immediately. Ethereum is around block `25,800,000`. With a common `10,000` block `eth_getLogs` window, scanning from block `0` to latest requires:

```text
ceil(25,800,000 / 10,000) = 2,580 eth_getLogs requests
```

That is for one page load, for one user, before retries. If the provider's safe window is `5,000` blocks, it becomes `5,160` requests. At `2,000` blocks, it becomes `12,900` requests.

Even if we start from the collection's deployment block instead of block `0`, a three-year-old Ethereum contract is still roughly millions of blocks old. At about 12 seconds per block, three years is around:

```text
3 years * 365 days * 24 hours * 60 minutes * 5 blocks/minute
~= 7,884,000 blocks
```

At `10,000` blocks per request, that is still roughly `789` `eth_getLogs` calls per page load. Starting at deployment is necessary, but it does not make request-time historical scanning acceptable.

The block-window cap is only one constraint. NFT `Transfer` history can also hit matched-log limits. Every mint is a `Transfer` from the zero address. Every sale usually includes a `Transfer`. Every wallet-to-wallet movement also includes a `Transfer`. For an active collection, the total can easily be tens or hundreds of thousands of logs. If the provider caps responses by result count, the client has to split busy ranges even more finely.

## What breaks first

The first thing that breaks is the initial `eth_getLogs` call itself. It will not reliably return full collection history from block `0` to latest.

If the implementation adds pagination, the next thing that breaks is production traffic:

- The page becomes slow or unusable because every fresh visitor has to perform hundreds or thousands of RPC calls before the feed and holder ranking are complete.
- The provider key gets rate-limited or burns through credits because the same historical backfill is repeated for every browser session.
- Browser/network behavior becomes fragile: requests time out, retry storms happen, users close the page midway, and partial results create wrong holder rankings.
- The public frontend exposes the provider key, so anyone can reuse it and compete with real users for the same limits.
- Newest-first feed UX is poor because the browser cannot confidently show complete history-derived results until the scan catches up.
- The top holders panel is especially risky because it is derived state. Missing one old `Transfer` means the ranking can be wrong.

So the practical production failure is not just "it is slow." It is that the app turns every page load into a mainnet backfill job, and RPC providers are specifically designed to prevent that pattern.

## What to build instead

Build a read model backed by an indexer.

For the activity feed:

1. Run a one-time backfill from the collection's deployment block, not block `0`.
2. Index the collection's `Transfer` events into a persistent database.
3. Store normalized event rows with at least `block_number`, `block_timestamp`, `transaction_hash`, `log_index`, `from`, `to`, and `token_id`.
4. Enrich events into feed items:
   - `from == 0x000...000` means mint.
   - ordinary `from` / `to` movement means transfer.
   - sale detection needs marketplace data too, not just the ERC-721 `Transfer` event. Either integrate marketplace/order events, use a provider NFT sales API, or index marketplace protocols relevant to the collection.
5. Serve the feed from an API with normal pagination, ordered by `(block_number desc, log_index desc)`.
6. Keep the indexer tailing new blocks so the database stays current.

For top holders:

1. Maintain current ownership as indexed state: `token_id -> owner`.
2. On every indexed `Transfer`, update the previous owner's count down and the new owner's count up.
3. Store holder balances in a table keyed by wallet.
4. Serve `top holders` with a fast database query such as `ORDER BY balance DESC LIMIT 50`.

This makes the frontend cheap: one API request for the latest feed page and one API request for the top holders panel. The browser should not be reconstructing three years of collection state.

## Infrastructure needed

Yes, this alternative needs infrastructure the contractor's plan avoids naming.

Reasonable options:

- A hosted/custom indexer such as Ponder with Postgres.
- A subgraph on The Graph, published to a production endpoint.
- A provider NFT/data API that already indexes transfers, owners, and sales, if its latency, pricing, and marketplace coverage are acceptable.
- A small custom worker that backfills `Transfer` logs once, writes to Postgres, and then tails new blocks.

My default recommendation would be Ponder or a small custom indexer plus Postgres if we want control over feed semantics and top-holder ranking. Use provider APIs if speed of launch matters more than data ownership and exact sale classification.

The important architectural line is: historical logs are indexed once into durable storage, then incrementally updated. They are not scanned from mainnet by every visitor.
