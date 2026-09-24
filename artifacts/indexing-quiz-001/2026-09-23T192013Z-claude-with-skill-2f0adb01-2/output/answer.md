# Sanity check: "one `eth_getLogs` from block 0 to latest"

Short version: the plan does not work, and it does not fail gracefully. The single
call in the plan is not a call any mainnet provider will serve — it becomes
**roughly 2,600 sequential RPC requests on a good provider, and 4,000–13,000 on a
worse one**, per page load, per visitor. The first thing that breaks is the very
first request, on day one, in staging. Below is the reasoning, then what to build.

---

## 1. Why one request becomes thousands

The plan assumes `eth_getLogs` has no range limit. It does. Every commercial
provider caps `eth_getLogs` on two independent axes, and the client has to chunk
around both.

**Cap A — block range.** Alchemy, Infura, and QuickNode cap a single `eth_getLogs`
at about **10,000 blocks** when the query matches results. Many cheaper or public
endpoints cap at 2,000–5,000. A request spanning block 0 to latest is rejected
outright, not truncated — you get an error, not a partial answer.

**Cap B — result count.** Independently, providers cap the response at ~10,000 logs
(Infura returns `-32005 query returned more than 10000 results`). A busy window —
the mint, or a hype weekend — will blow this even inside a legal 10k-block range,
forcing the client to **bisect that window and retry**, turning one chunk into two,
four, or eight.

So the client must walk the chain in windows. The arithmetic:

| Provider block cap | Chunks for 0 → 25,800,000 | Chunks from the real deploy block (~17,916,000) |
|---|---|---|
| 10,000 (Alchemy / Infura / QuickNode) | **2,580** | **788** |
| 5,000 | 5,160 | 1,576 |
| 2,000 (public / budget RPC) | 12,900 | 3,942 |

Deploy block: post-merge Ethereum is a fixed 12s/block = 2,628,000 blocks/year, so
three years ≈ 7,884,000 blocks, putting deployment near block 17,916,000.

Two things to notice:

- **The plan's literal "from block 0" wastes ~70% of those requests** scanning
  17.9M blocks that predate the contract and cannot contain a single matching log.
  That is 1,792 of the 2,580 requests returning empty arrays.
- **Even the corrected version — deploy block to latest — is ~790 requests.** The
  bug is not the `0`. The bug is using `eth_getLogs` as a bulk-history API at all.

Add bisection retries on the busy windows and the realistic figure on a 10k-cap
provider is **~850–1,000 requests from the deploy block, ~2,600–3,000 from block 0**.

### What that costs in wall-clock and quota

- **Latency.** Alchemy's free tier is ~330 compute units/sec; `eth_getLogs` is 75 CU,
  so about **4 requests/second sustained**. 2,580 requests ÷ 4/s = **~11 minutes** of
  pure throttled fetching for one page load. Chunks must be issued in bounded
  parallelism or you just trade the 11 minutes for a wall of HTTP 429s.
- **Quota.** 2,580 × 75 CU = **~193,500 CU per page load**. A 300M CU/month free tier
  is **~1,550 page loads — total, for the entire month, across all users**. One
  Twitter post and the collection's frontend is dark until the 1st.
- **Payload.** A three-year-old collection plausibly has 100k–400k Transfer logs
  (mint + three years of secondary). At ~700 bytes of JSON per log (three 32-byte
  topics, data, block hash, tx hash, hex-encoded), that is **70–280 MB downloaded
  into a browser tab**, then parsed into JS objects at several times that in heap.

The contractor's "we don't need extra infrastructure" is true only in the sense that
you have shifted all of the infrastructure cost onto every visitor's phone.

---

## 2. What breaks first, in order

1. **The first request errors.** `fromBlock: 0, toBlock: 'latest'` returns a range-cap
   error from Alchemy/Infura immediately. This never reaches production — it fails the
   moment it is pointed at a real mainnet key. Anything that "worked in testing" was
   tested against a local chain or a near-empty contract.

2. **After chunking is bolted on: rate limiting.** HTTP 429s across the chunk fan-out.
   The naive fix (retry with backoff) makes the page slower, not more correct.

3. **Mobile Safari kills the tab.** 100k+ decoded logs plus the intermediate arrays
   exceeds the memory budget on a mid-range phone. Desktop survives with a multi-second
   main-thread freeze during the balance reduction.

4. **The monthly RPC quota is exhausted**, and the outage hits everyone at once.

5. **The holder panel goes quietly wrong — and this is the worst one.** The ranking is
   computed by folding *every* Transfer into a running balance. If one chunk out of
   2,580 fails and gets silently swallowed by a `catch`, the balances are wrong. There
   is no error, no empty state, no way for a user to tell. You ship a leaderboard that
   credits tokens to wallets that sold them. Failures in an O(n) scan are not
   fail-stop; they are fail-plausible.

### Two correctness gaps in the plan independent of scale

- **`Transfer` events do not contain sale prices.** The feed is specced to show "every
  mint, sale, and transfer," but a Transfer log tells you only `from`, `to`, `tokenId`.
  Distinguishing a 40 ETH sale from a wallet-to-wallet move requires correlating the
  Transfer against marketplace events in the same transaction (Seaport's
  `OrderFulfilled`, Blur, etc.). The plan has no path to the "sale" half of its own
  feature.
- **Token standard.** If the collection is ERC-1155, there is no `Transfer` event at
  all — it is `TransferSingle` and `TransferBatch`, with quantities, and the balance
  math is different. Worth confirming before anyone writes code.

The parts of the plan that *are* fine: mints are just Transfers from the zero address,
so the feed's mint rows come free, and events genuinely are the right data source.
The error is the transport, not the schema.

---

## 3. What to build instead

The rule this violates: **you cannot use RPC to answer historical questions.** RPC
answers "what is true right now." Anything over history — a feed, a ranking, an
aggregate — needs something that has already read every block once and kept the answer.
The work of scanning three years of logs has to happen exactly once, on a server, not
once per visitor.

### Recommended: a subgraph (The Graph)

Index the collection's Transfer events into entities, and — the key move — **maintain
the holder balance as a running counter in the mapping** rather than recomputing it
from history at query time.

```graphql
# schema.graphql
type Token @entity {
  id: ID!                  # tokenId
  owner: Holder!
  mintedAt: BigInt!
}

type Holder @entity {
  id: ID!                  # wallet address
  balance: Int!            # maintained incrementally — this is what the panel sorts on
  tokens: [Token!]! @derivedFrom(field: "owner")
}

type Transfer @entity {
  id: ID!                  # txHash-logIndex
  token: Token!
  from: Bytes!
  to: Bytes!
  priceWei: BigInt         # null unless a marketplace fill matched in the same tx
  blockNumber: BigInt!
  timestamp: BigInt!
}
```

```typescript
// mapping.ts — the whole scan happens once, at index time
export function handleTransfer(event: TransferEvent): void {
  let from = loadOrCreateHolder(event.params.from);
  let to   = loadOrCreateHolder(event.params.to);

  if (event.params.from != ZERO_ADDRESS) { from.balance -= 1; from.save(); }
  to.balance += 1; to.save();   // mints come through here with from == 0x0

  let token = loadOrCreateToken(event.params.tokenId, event.block.timestamp);
  token.owner = to.id;
  token.save();

  let t = new Transfer(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
  t.token = token.id; t.from = event.params.from; t.to = event.params.to;
  t.blockNumber = event.block.number; t.timestamp = event.block.timestamp;
  t.save();
}
```

Both panels then become one indexed query each:

```graphql
{
  transfers(orderBy: blockNumber, orderDirection: desc, first: 50) {
    from to priceWei timestamp
    token { id }
  }
  holders(orderBy: balance, orderDirection: desc, first: 25, where: { balance_gt: 0 }) {
    id balance
  }
}
```

**~2,600 requests and 11 minutes becomes one request and ~100ms.** Paginate the feed
with a `blockNumber_lt` cursor, not a numeric `skip` — new mints arriving at the head
will shift offsets and duplicate rows across pages.

For sale prices, add the Seaport contract as a second data source in the same subgraph
and stamp `priceWei` onto the Transfer entity when a fill lands in the same transaction.

**Real-time tail:** open a viem WebSocket subscription to `Transfer` and prepend new
rows to the feed. Never re-fetch history for live updates. Note the subgraph will lag
the chain head by a few blocks, so the WS tail also covers that gap.

### Faster path if you need to ship this week

Skip the subgraph and use a vendor NFT API — these are pre-indexed and answer both
panels directly:

- **Holder panel:** Alchemy `getOwnersForContract({ withTokenBalances: true })` — one
  call, returns every owner with counts, already ranked after a client-side sort.
- **Feed:** Alchemy `getAssetTransfers` with `category: ['erc721']` and a `pageKey`
  cursor, or **Reservoir**, which returns NFT activity with sale prices already
  joined — that solves the price problem with no marketplace-event work.

Tradeoff: vendor lock-in and no custom fields. But it is hours of work instead of days,
and it is correct. A reasonable sequencing is to ship on Reservoir/Alchemy now and move
to the subgraph when you want fields the vendor does not expose.

### Either way, put a cache in front

Do not let the browser talk to the indexer directly. Route through your own API with a
10–30s CDN/edge cache. Ten thousand concurrent visitors should produce **one** upstream
query, not ten thousand. This matters as much as the indexer choice — an uncached
subgraph under a traffic spike just moves the rate limit somewhere else.

---

## 4. Infrastructure you do not currently have — being explicit

The contractor's claim that this needs no extra infrastructure is the load-bearing
error, and correcting it has a real cost. Honestly stated:

| Thing | Needed for | Rough cost |
|---|---|---|
| Subgraph development + deploy | The Graph path | A few days' work; Subgraph Studio free in dev |
| Publishing to the decentralized network | Production reliability | GRT signal + per-query fees, or Studio's paid tier |
| Initial backfill time | Indexing 7.9M blocks from the deploy block | Hours to a day before the API is usable — **not instant, budget for it** |
| WebSocket RPC endpoint | The live tail | Usually included in your existing provider plan |
| A backend/edge route + cache | Not re-exposing keys, absorbing traffic | Small; a Vercel/Cloudflare route is enough |
| *(Ponder alternative)* Postgres + a host | Self-hosted TS indexer instead of The Graph | Simpler to write, but now you own a database |

The vendor-API path (Alchemy/Reservoir) needs **none** of the above beyond the cached
API route — that is its main argument. What it costs instead is per-call pricing and
dependence on someone else's schema.

**Bottom line:** the contractor's plan trades infrastructure you would pay for once for
a page load that is ~2,600 RPC calls, ~11 minutes, and a holder ranking that can be
silently wrong. Build the indexer, or rent one — but the history has to be scanned on a
server, once, not in every visitor's browser.
