# Sanity check: "eth_getLogs from block 0 to latest in the browser"

Short version: the plan does not work, and it does not fail gracefully. The specific
sentence "we call `eth_getLogs` from block 0 to latest and get the full history back"
describes a request that no public RPC provider will answer. There is no provider key
that makes it work — the limits are per-request caps, not entitlements. Once you bolt
pagination on to get around that, one page load becomes roughly **800–3,500 RPC
requests** and tens to hundreds of megabytes of JSON, per visitor, every time someone
refreshes.

Below: the request math, what breaks in what order, two things the plan can't do at
all (not just slowly), and what to build instead.

---

## 1. What the request count actually is, and what forces it

### The single call is rejected outright

Every major provider caps `eth_getLogs` on two independent axes:

| Cap | Typical limit | Error you get |
|---|---|---|
| Block range | ~10,000 blocks when the range is unbounded/wide | `query exceeds max block range 10000` |
| Result count | 10,000 logs | `query returned more than 10000 results` |
| Response size | ~150 MB / provider-specific | `Log response size exceeded` |

Infura, Alchemy, QuickNode, Ankr, and most self-hosted Geth/Erigon behind a gateway
all enforce some version of this. So `fromBlock: 0, toBlock: "latest"` returns an
error on the first call, in development, on day one. That is genuinely the *first*
thing that breaks — and it's the least damaging failure in this document, because you
find it before shipping.

Worth correcting one thing in the contractor's framing: this is **not** an archive-node
problem. Providers do serve historical logs from full nodes (logs live in receipts and
are indexed by bloom filters, not in contract storage). The wall you hit is range and
result caps plus cost — not "we need an archive node."

### The request count after you add pagination

You now have to walk the chain in windows. Concretely, for your collection:

- Chain head: **25,800,000**.
- Live "about three years" → at 12s slots, ~2,628,000 blocks/year → deploy block is
  somewhere around **17,900,000**. Call the span **7,900,000 blocks**.

| Scenario | Windows at 10k blocks each |
|---|---|
| As literally written, `fromBlock: 0` | 25,800,000 / 10,000 = **2,580 requests** |
| Fixed to start at the deploy block | 7,900,000 / 10,000 = **790 requests** |

That 2,580 vs 790 gap is the entire value of hardcoding a deploy block — and note that
**1,790 of those 2,580 requests scan blocks that predate your contract and return
empty arrays.** You'd pay full price for them.

Then add the multipliers that always show up in production:

- **Result-cap splits.** A 10k-supply collection averaging ~0.1 logs/block won't trip
  the 10k-result cap in normal windows, but your mint window will: 10,000 mints inside
  a few hundred blocks. Those windows fail and must be bisected. Same for any airdrop
  or big sweep. Add ~5–10%.
- **Retries.** 429s and gateway timeouts on wide windows are routine. Any honest
  client retries with backoff. Add 20–50%.

**Realistic total for one page load: ~1,000 requests best case, ~3,500 as written.**

### The request count nobody budgets for: timestamps

`eth_getLogs` returns `blockNumber`, but **not `blockTimestamp`** on most providers.
Your feed is "newest first" with human-readable times — so for every distinct block
containing a transfer you need an additional `eth_getBlockByNumber`.

If the collection has ~100,000 transfers spread over ~60,000 distinct blocks, that's
**60,000 more RPC calls.** Batched 100 per JSON-RPC batch, still ~600 round trips of
large block bodies. This line item is usually 10–50× the getLogs count and is the
single most commonly missed cost in plans like this one.

### Bandwidth and credits

- An `eth_getLogs` result entry is ~500–900 bytes of JSON (topics, data, tx hash,
  block hash, indices). At 700 B:
  - 100,000 transfers → **~70 MB**
  - 500,000 transfers (active 3-year collection) → **~350 MB**
- Decoded into JS objects this is several times larger in heap.
- Alchemy prices `eth_getLogs` at 75 compute units. 2,580 × 75 ≈ **193,500 CU per
  page load**. A ~30M CU/month free tier is exhausted in about **155 page loads** —
  roughly five visitors a day for a month. (Check current pricing; the order of
  magnitude is the point. Paid tiers move the number, not the shape.)

### Wall-clock

790 sequential requests at 400 ms = **~5 minutes**. 2,580 requests 10-wide at 600 ms =
**~2.5 minutes** — and you can't actually run 10-wide for long, because that's what
triggers the rate limiting. Then you still have to decode and aggregate. Call it
**several minutes to a blank screen**, on every load.

---

## 2. What breaks, in the order you'll see it

1. **Day one, in dev:** the single unbounded call errors. Cheap lesson.
2. **After pagination is added, in dev:** it "works" but takes minutes. Someone
   proposes wider windows to speed it up, which re-triggers the result caps.
3. **First real traffic:** HTTP 429 from the provider. Because the key is *in the
   browser*, every visitor spends from one shared quota, so the tenth concurrent
   visitor degrades the first nine. Load failures become correlated — the site is
   fine with one user and broken with twenty.
4. **Quota exhaustion, ~day one of launch:** free tier gone in ~150 loads. On a paid
   plan you get a surprise bill instead of an outage. Either way this is the point
   where the plan's "we don't need extra infrastructure" claim converts into a
   line item.
5. **Mobile:** 70–350 MB of JSON parsed on the main thread. iOS Safari kills tabs in
   the low hundreds of MB. The holder aggregation (a pass over every transfer,
   newest-wins per token) then freezes the main thread for seconds. Low-end Android
   is worse.
6. **The API key is public.** It's in a browser bundle. Anyone can read it out of
   devtools and spend your quota. This is not hypothetical; scraped keys get abused.
7. **Correctness, discovered later:** see below.

---

## 3. Two things the plan cannot do at all

These aren't performance issues — the architecture can't produce the feature as
specified.

### "Sale" is not in the `Transfer` event

ERC-721 `Transfer(from, to, tokenId)` carries **no price**. A wallet-to-wallet gift and
a 40 ETH Blur purchase emit byte-identical logs. You cannot label a feed row "sale" or
show a price from `Transfer` alone. To get sales you must additionally index the
marketplaces — Seaport `OrderFulfilled`, Blur, LooksRare, X2Y2 — or join against ETH/
WETH movement in the same transaction. Each has its own decoding rules and its own
edge cases (bundles, private sales, WETH vs ETH, royalty splits).

The spec says "every mint, sale, and transfer." `Transfer` logs give you mint
(`from == 0x0`) and transfer. **Sale is missing from the data source entirely.** This
is the biggest gap in the plan and it's independent of the RPC cost argument.

### Reorgs

A browser-side one-shot scan has no reconciliation path. If you fetch to `latest` and
the last two blocks reorg out, you're showing transfers that never happened, with no
mechanism to retract them. Always query to `latest - N` (N ≈ 5–12 on mainnet) for
anything you display as settled, and let a real indexer handle rollback.

Other correctness traps the plan will hit: burns to `0x0` and to `0x…dEaD` must be
excluded from holder counts (otherwise the burn address tops your leaderboard);
if the collection is ERC-1155 you need `TransferSingle`/`TransferBatch` instead;
retry boundaries can duplicate logs, so dedupe on `(txHash, logIndex)`.

---

## 4. What to build instead

Two tiers. Pick based on whether you need to ship this week or build something durable.

### Tier 1 — ships in days, genuinely zero new infrastructure

If the deadline is close, skip the indexer and use an existing one through a
provider API. Put a thin server route in front so the key isn't in the browser.

- **Top holders:** one call. Alchemy `getOwnersForContract(contract, {
  withTokenBalances: true })` returns every owner with counts, paginated. Sort,
  filter burn addresses, done. **~1–3 requests instead of ~800.**
- **Activity feed:** Reservoir's `/collections/activity` or OpenSea's events API
  returns mints, sales *with prices*, and transfers, pre-joined and cursor-paginated,
  newest first. This also solves the "sale" gap for free.
- **Live tail:** a viem `watchContractEvent` WebSocket subscription on `Transfer` to
  prepend new rows.

Cost: one serverless function (Vercel/Cloudflare) holding the keys, plus a 30–60s
cache. That's it. Tradeoff: you're dependent on a centralized API's schema, uptime,
and pricing, and you can only ask the questions it exposes.

### Tier 2 — the durable answer: your own subgraph

Index the events once, server-side, and serve both panels from pre-computed
entities. Critically: maintain the holder count **incrementally** in the mapping, so
"top holders" is an indexed sorted read rather than a replay of history.

```graphql
# schema.graphql
type Token @entity {
  id: ID!                 # tokenId
  owner: Account!
  mintedAt: BigInt!
  transfers: [Transfer!]! @derivedFrom(field: "token")
}

type Account @entity {
  id: ID!                 # address
  balance: Int!           # maintained incrementally -> sortable, no replay
  tokens: [Token!]! @derivedFrom(field: "owner")
}

type Transfer @entity {
  id: ID!                 # txHash-logIndex
  token: Token!
  from: Account!
  to: Account!
  kind: String!           # MINT | TRANSFER | SALE
  priceWei: BigInt        # set when a marketplace fill is matched
  blockNumber: BigInt!
  timestamp: BigInt!      # free here; costs 60k RPC calls in the browser plan
  txHash: Bytes!
}
```

```typescript
// mapping.ts
export function handleTransfer(event: TransferEvent): void {
  const id = event.params.tokenId.toString();

  let token = Token.load(id);
  if (token == null) {
    token = new Token(id);
    token.mintedAt = event.block.timestamp;
  } else {
    const prev = getAccount(event.params.from);
    prev.balance -= 1;          // incremental, so ranking is a cheap sorted query
    prev.save();
  }

  const next = getAccount(event.params.to);
  next.balance += 1;
  next.save();

  token.owner = next.id;
  token.save();

  const t = new Transfer(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );
  t.token = id;
  t.from = event.params.from.toHex();
  t.to = event.params.to.toHex();
  t.kind = event.params.from == Address.zero() ? 'MINT' : 'TRANSFER';
  t.blockNumber = event.block.number;
  t.timestamp = event.block.timestamp;   // <- the thing RPC won't give you
  t.txHash = event.transaction.hash;
  t.save();
}
```

Add a second data source for Seaport `OrderFulfilled` (and Blur/LooksRare) that looks
up the `Transfer` from the same transaction and upgrades it to `kind: SALE` with
`priceWei`. That is how you get the "sale" row the spec asks for.

Then the whole page is **two HTTP requests**:

```graphql
{
  transfers(orderBy: blockNumber, orderDirection: desc, first: 50) {
    kind priceWei timestamp txHash from { id } to { id } token { id }
  }
  accounts(orderBy: balance, orderDirection: desc, first: 25, where: { balance_gt: 0 }) {
    id balance
  }
}
```

Roughly **150–400 ms**, a few KB, no key in the browser, no reorg exposure, and the
feed paginates with a cursor (`blockNumber_lt`) instead of re-fetching everything.

**Ponder** is a reasonable alternative to The Graph if the team prefers TypeScript and
plain Postgres over GraphQL codegen and the decentralized network. Same architecture,
you own the database.

### Real-time

The subgraph lags the head by a few blocks. Layer a WebSocket `watchContractEvent`
subscription for `Transfer` and optimistically prepend new rows, reconciling when the
subgraph catches up. This is the *only* place direct RPC belongs in this design.

---

## 5. Infrastructure you don't have yet — stated plainly

The contractor's "we don't need extra infrastructure" is the claim that doesn't
survive. Tier 2 needs:

1. **A Graph Studio account and a published subgraph.** Free in Studio for dev;
   production on the decentralized network means GRT for query fees, or a hosted
   plan. Budget for query volume.
2. **An initial backfill.** Indexing 7.9M blocks of history takes hours to a day or
   two depending on collection volume. Do this *before* launch day, not on it.
3. **A WebSocket RPC endpoint** for the live tail (most providers include one).
4. **An RPC endpoint for the indexer** — server-side, keyed, never shipped to the
   browser. This replaces the browser key, it isn't in addition to it.
5. **A small server route + cache** if you go Tier 1, or to proxy/cache subgraph
   queries and keep the gateway key private.
6. **Ongoing ownership.** A subgraph is a deployed service: it can fall behind, and
   mapping changes require a redeploy and re-sync.

Compared to the plan's actual hidden cost — a per-visitor multi-minute load, ~200k
compute units per refresh, a public API key, and a "sale" column you can't populate —
this is the cheaper option by a wide margin.

---

## Summary table

| | Contractor's plan | Tier 1 (provider APIs) | Tier 2 (subgraph) |
|---|---|---|---|
| RPC/HTTP requests per load | ~1,000–3,500 + ~60k timestamp calls | ~2–4 | **2** |
| Data over the wire | 70–350 MB | tens of KB | few KB |
| Time to first paint | minutes (if it completes) | ~300 ms | ~200 ms |
| Can show sale prices | **no** | yes | yes (with marketplace mappings) |
| Reorg-safe | no | yes | yes |
| API key exposed | **yes, in the bundle** | no | no |
| Scales with users | no — shared quota | yes (cached) | yes |
| New infra | "none" (false) | 1 serverless route | subgraph + backfill + WS |

## The one-line rule

Direct RPC is for **current state and the live tail**. Anything historical, ranked,
aggregated, or paginated belongs in an indexer. A holder leaderboard and a
three-year activity feed are both of the second kind.
