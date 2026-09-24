# Sanity check: "eth_getLogs from block 0 to latest, compute in the browser"

**Short version:** the plan is not a plan that runs slowly — it is a plan that
returns an error on the very first request and never recovers. The single call it
describes does not exist as a thing providers will serve. Once you work around
that, one page load becomes **roughly 2,600 `eth_getLogs` calls plus on the order
of 100,000+ `eth_getBlockByNumber` calls**, downloads well over 100 MB into the
browser, and does it again for every visitor and every refresh. Details below,
then what to build instead.

---

## 1. Why "block 0 to latest" is not one request

There is no provider on Ethereum mainnet that will serve an unbounded
`eth_getLogs`. Every one of them caps the query on two independent axes:

- **Block range cap.** Infura/QuickNode-class providers cap at ~10,000 blocks per
  query; Alchemy is more generous but still bounded; many public and cheaper
  endpoints cap at 2,000 or even 500.
- **Result count cap.** Typically 10,000 logs returned per query, regardless of
  how narrow the block range is. Exceed it and you get
  `query returned more than 10000 results` — the node throws the whole response
  away rather than truncating it.

So `fromBlock: 0, toBlock: "latest"` comes back as an HTTP 400 / JSON-RPC error,
immediately, on page load. Not slow — broken. Any working version of this client
must chunk the range itself.

## 2. So how many requests is it actually?

### The log scan

The collection has been live ~3 years. At 12s blocks that's ~7,884,000 blocks,
which puts deployment somewhere around block **17,900,000**. But the plan says
*from block 0*, so the client scans all 25.8M blocks — **~70% of the work is
scanning blocks that predate the contract and can contain nothing.**

| Provider block-range cap | Requests scanning from 0 | Requests scanning from deploy block |
|---|---|---|
| 10,000 blocks | **2,580** | 788 |
| 2,000 blocks | 12,900 | 3,942 |
| 500 blocks | 51,600 | 15,768 |

That's the floor, and only if nothing goes wrong. Two things force it higher:

- **Result-cap bisection.** A fixed 10k-block window is fine during quiet
  stretches and blows past the 10,000-log cap during the mint and during hot
  trading weeks. The standard client-side fix is to catch the error and split the
  range in half and retry — so every dense window costs you 3, 7, 15 extra
  round-trips instead of 1. You cannot know the right window size in advance,
  because you don't know where the activity is until you've fetched it.
- **Retries on 429/timeouts**, which is not an edge case here — see below.

Call it **~3,000–5,000 `eth_getLogs` requests** realistically for the 10k-cap
case, and tens of thousands on a tighter provider. Per page load.

### The hidden second query: timestamps

This is the part that usually gets missed in these plans, and it's bigger than
the log scan.

**Log objects do not contain a timestamp.** A log gives you `blockNumber`,
`transactionHash`, `logIndex`, `topics`, `data` — and nothing else. An activity
feed that says "3 minutes ago" / "Mar 14, 2024" needs `eth_getBlockByNumber` for
**every distinct block that contains a Transfer.**

For a three-year-old collection with real trading, a working figure is ~250,000
Transfer events spread over ~150,000 distinct blocks. That is **~150,000
additional RPC calls** — and unlike the log scan, this one does not batch down.
(You can JSON-RPC batch them ~100 at a time if your provider allows it, which
gets you to ~1,500 batched requests moving a lot of block headers.)

So the honest total for one page load is on the order of **150,000 RPC calls**,
or ~5,000 if you batch aggressively and accept much larger responses.

### What that costs

On Alchemy's compute-unit pricing (`eth_getLogs` = 75 CU,
`eth_getBlockByNumber` = 16 CU):

- log scan: 2,600 × 75 ≈ **195,000 CU**
- timestamps: 150,000 × 16 ≈ **2,400,000 CU**
- **≈ 2.6M CU for a single page load by a single user.**

A 300M CU/month free tier is exhausted after **~115 page loads**. Not 115 users —
115 loads, and a refresh is another one. Your own team will burn through it during
QA before a customer ever sees the site.

And note where that key lives in this design: **in the browser**. A public key
fanning out 150k calls per visit gets scraped and drained the same week.

### And the data volume

A JSON-RPC log object serializes to ~600–700 bytes. 250,000 of them is
**~150–175 MB** pushed over the wire to a browser tab, which then has to parse it
into ~250,000 JS objects (several hundred MB of heap after parsing), sort them,
and reduce them. On a mid-range phone this is an out-of-memory tab crash, not a
spinner.

## 3. What breaks first, in order

1. **Request #1**, with a provider error on the unbounded range. The plan as
   written never gets past this line.
2. **Rate limiting.** Once chunked, the client fires thousands of requests as
   fast as it can. Every provider throttles per-second request rate; you start
   eating `429 Too Many Requests` within the first couple hundred calls. Now
   you're adding backoff, and the load time is governed by the throttle, not the
   network. Sequentially at ~300ms/call, 2,600 calls is **~13 minutes** before
   the timestamp queries even start.
3. **Quota exhaustion**, within roughly a hundred loads.
4. **Browser memory**, on mobile, for anyone who gets that far.
5. **Correctness drift you can't see.** Two page loads seconds apart land on
   different `latest` blocks; a reorg near the head silently gives one user a
   feed containing a transfer that no longer happened. Nothing in this design
   reconciles that.

## 4. The structural problem, stated plainly

The feed and the holder panel have very different data needs, and the plan
ignores the difference:

- **The feed** only ever displays ~50 rows. It needs the *newest* events. Fetching
  all 250,000 to show 50 is ~99.98% waste, and it's waste that's trivially
  avoidable — you could scan backwards from head and stop.
- **The holder panel cannot be shortcut.** "How many tokens does each wallet hold
  right now" is the net result of replaying *every* Transfer from deployment
  forward (`+1` to `to`, `-1` to `from`, mints come from `0x0`, burns go to
  `0x0`). Miss one transfer and a rank is wrong. This is genuinely a
  full-history computation — which is exactly why it must be computed **once,
  server-side, incrementally**, and not by 10,000 browsers each independently
  redoing three years of history.

That is the whole argument for an indexer in one sentence: *the work is real, but
it should be done once and kept up to date, not repeated per visitor.*

Also worth confirming with the contractor: if the collection is ERC-1155 rather
than ERC-721, there is no `Transfer` event at all — it's `TransferSingle` and
`TransferBatch`, with quantities. The plan doesn't mention them.

---

## 5. What to build instead

### Recommended: a subgraph (The Graph)

Define three entities and let the indexer maintain them as it walks the chain:

```graphql
type Transfer @entity {          # powers the activity feed
  id: ID!                        # txHash-logIndex
  tokenId: BigInt!
  from: Bytes!
  to: Bytes!
  kind: String!                  # "MINT" | "TRANSFER" | "BURN"
  blockNumber: BigInt!
  timestamp: BigInt!             # free here — see below
  txHash: Bytes!
}

type Token @entity {
  id: ID!                        # tokenId
  owner: Holder!
  mintedAt: BigInt!
}

type Holder @entity {            # powers the top-holders panel
  id: ID!                        # wallet address
  balance: Int!                  # maintained incrementally
  tokens: [Token!]! @derivedFrom(field: "owner")
}
```

The mapping is the interesting part:

```typescript
export function handleTransfer(event: TransferEvent): void {
  // Feed row
  let t = new Transfer(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
  t.tokenId     = event.params.tokenId;
  t.from        = event.params.from;
  t.to          = event.params.to;
  t.kind        = event.params.from == ZERO ? 'MINT'
                : event.params.to   == ZERO ? 'BURN' : 'TRANSFER';
  t.blockNumber = event.block.number;
  t.timestamp   = event.block.timestamp;   // <-- no second RPC call, ever
  t.txHash      = event.transaction.hash;
  t.save();

  // Holder balances, maintained incrementally
  if (event.params.from != ZERO) {
    let from = Holder.load(event.params.from.toHex())!;
    from.balance -= 1;
    from.save();
  }
  let to = Holder.load(event.params.to.toHex()) ?? newHolder(event.params.to);
  to.balance += 1;
  to.save();
}
```

Two things to call out, because they're the ones people get wrong:

- **`event.block.timestamp` is available inside the mapping for free.** That
  single fact deletes the 150,000-call problem outright.
- **`balance` must be a stored, incrementally-updated integer, not something
  derived at query time.** The Graph can only `orderBy` a stored field — you
  cannot sort by `count(tokens)`. If you skip this you get a holder panel you
  can't rank, and you'll end up fetching every holder to the client to sort them,
  which is the original bug wearing a new hat.

Then the entire page load is **two GraphQL requests, ~100–200 ms**:

```graphql
{
  transfers(first: 50, orderBy: blockNumber, orderDirection: desc) {
    tokenId from to kind timestamp txHash
  }
  holders(first: 100, where: { balance_gt: 0 },
          orderBy: balance, orderDirection: desc) {
    id balance
  }
}
```

Down from ~150,000 requests and 150 MB to 2 requests and a few kilobytes. The
feed paginates with `skip`/`blockNumber_lt` instead of re-fetching anything.

### Real-time tail

Subgraphs trail the chain head by a few blocks. If you want the feed to feel
live, add a viem WebSocket `watchContractEvent` on the Transfer event and
optimistically prepend new rows client-side, deduping against the subgraph by
`txHash-logIndex` when the indexer catches up. This is the *one* place direct RPC
is the right tool — a bounded subscription at the head, not a historical scan.

### Infrastructure you don't have yet — being explicit

You asked, so: **yes, this needs things you don't currently have.**

- A **Subgraph Studio account and a subgraph repo** (schema + mappings +
  `subgraph.yaml`), plus a CI step to deploy it. Budget a couple of days of dev
  work for the first one.
- A **query API key**. Free on Studio for development; publishing to the
  decentralized network means paying **query fees in GRT**, billed per query —
  small, but a real line item you should model against expected traffic.
- **Initial sync time.** Indexing three years of a busy NFT contract takes hours
  (not minutes). It happens **once**, before launch, not per user — but it must be
  on your launch timeline, and re-syncs after a schema change cost you that time
  again.
- Optional but cheap and high-leverage: a **30–60s edge/CDN cache** in front of
  the top-holders query. That response is byte-identical for every visitor, so
  caching it takes essentially all holder-panel traffic off the indexer.

### Two alternatives, depending on your constraints

- **Ponder** — TypeScript-first indexer, same event-handler model, writes to your
  own Postgres and serves a GraphQL/REST API. Better if you'd rather own the
  database and skip GRT query fees. Costs you a Postgres instance and a hosted
  Node process instead.
- **Alchemy NFT API** — genuinely **zero new infrastructure**:
  `getOwnersForContract(address, { withTokenBalances: true })` returns the holder
  panel in one or two calls, and `getAssetTransfers` gives you a paginated
  transfer feed. If the goal is to ship this week, this is the pragmatic choice.
  Tradeoffs: you're locked to one vendor's data model, feed filtering and
  ordering are limited to what their API exposes, and it gets expensive at scale.
  It's a good way to launch, and a fine thing to migrate off onto a subgraph
  later once the product shape settles. **Route it through a thin backend
  endpoint so the API key isn't in the browser** — which is a note that applies
  to the current plan too, and doesn't today.

---

## 6. What to tell the contractor

The instinct — "Transfer events are the source of truth for this screen" — is
exactly right, and the schema above is basically their plan. The error is
*where* the computation happens. Replaying three years of history is a
run-it-once-and-keep-it-warm job, not a page-load job; "no extra
infrastructure" isn't a saving here, it's the cost relocated onto every visitor's
browser and your RPC bill. Move that same reduction into a mapping that runs once
per event as the chain advances, and the page load drops from 150,000 requests to
two.
