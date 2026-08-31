# Sanity check: "one `eth_getLogs` from block 0 to latest, compute in the browser"

**Short version:** the plan doesn't work, and it doesn't fail gracefully — it fails at the
very first call. The sentence "we don't need extra infrastructure" is the load-bearing
error. There is no configuration of RPC providers that makes a full-history scan a
page-load operation. You need an indexer. Below is the arithmetic, the failure ordering,
and what to build.

---

## 1. What that "one call" actually turns into

### 1.1 The single call as written returns an error, not data

No production RPC provider will serve `fromBlock: 0, toBlock: "latest"` for a contract
with real history. Every commercial provider enforces one or both of these on
`eth_getLogs`:

- **A result cap** — typically **10,000 logs per response**. Exceed it and you get back
  something like `query returned more than 10000 results` or
  `Log response size exceeded`.
- **A block-range cap** — commonly **10,000 blocks**, sometimes 2,000, sometimes 5,000,
  depending on provider and tier. Exceed it and you get `block range is too wide` /
  `exceeds max block range`.

There's also an unadvertised third cap: a **server-side query timeout**. Even a nominally
legal range can time out on an archive node if the address+topic scan touches too much
data, and you get a 500 or a `query timeout exceeded` with no clean way to distinguish it
from a transient failure.

So the plan's request count is not 1. It's however many requests it takes to walk the
chain in legal-sized windows. That's what forces the number — the provider's caps, not
your code.

### 1.2 Pagination arithmetic

Chain height ≈ **25,800,000**.

| Window size | Requests to cover block 0 → latest |
|---|---|
| 10,000 blocks (generous cap) | **2,580** |
| 5,000 blocks | 5,160 |
| 2,000 blocks (common free-tier practical limit) | **12,900** |

**Blocks 0 → ~17,900,000 are guaranteed empty.** The collection is ~3 years old.
Mainnet runs ~12s blocks → ~7,200 blocks/day → ~7.9M blocks in 3 years. So the contract
was deployed around block **17,900,000**. Roughly **69% of those requests scan blocks
that existed before the contract did** and return `[]`. Passing the real deploy block
is the single cheapest fix available and it only gets you:

| Window size | Requests from block 17,900,000 → latest (7.9M blocks) |
|---|---|
| 10,000 blocks | **~790** |
| 2,000 blocks | **~3,950** |

790 requests is still not a page load.

### 1.3 The result cap forces *extra* splits on exactly your busiest blocks

Windowing by block count assumes logs are spread evenly. They aren't. The mint is the
worst case: a 10k-supply drop emits 10,000 `Transfer` logs, often inside a handful of
blocks — sometimes a single block. Any window containing the mint blows the 10,000-result
cap no matter how small you make it, so the standard client pattern is *recursive
bisection*: catch the error, split the range in half, retry both halves, repeat.

That means:
- Every failed attempt is a **wasted round trip you still paid for**.
- Around the mint and around any airdrop/reveal/marketplace-frenzy window, you bisect down
  to single blocks — and a single block that emits >10,000 logs is **unrecoverable** by
  bisection. You'd need a provider whose cap is higher, or `eth_getTransactionReceipt`
  per tx in that block.

Budget **+50 to +500 requests** for bisection retries on a real collection.

### 1.4 The hidden multiplier: logs have no timestamps

This is the one that usually surprises people, and it's fatal to the "newest first,
with times" requirement.

An `eth_getLogs` result contains `blockNumber`, `blockHash`, `transactionHash`,
`logIndex`, `topics`, `data`. It does **not** contain a block timestamp. Your feed says
"3 minutes ago" / "Mar 14, 2024" — so for every distinct block you display, you need a
separate `eth_getBlockByNumber`.

Say the collection has ~100,000 `Transfer` events spread over ~60,000 distinct blocks
(typical for a mid-size 10k PFP with three years of trading):

| Approach | Extra requests |
|---|---|
| Naive: one `eth_getBlockByNumber` per unique block | **~60,000** |
| JSON-RPC batching, 100 per HTTP request | ~600 (but most providers bill/rate-limit each *call*, not each batch, and many cap batch size) |
| Only fetch timestamps for the ~50 rows actually rendered | 50 |

If your contractor writes this the obvious way, the timestamp fetch alone dwarfs the log
fetch by an order of magnitude.

### 1.5 The realistic total

| Component | Requests |
|---|---|
| Log pagination (deploy block → latest, 10k windows) | ~790 |
| Log pagination (block 0 → latest, as literally specified) | ~2,580 |
| Bisection retries on mint / high-activity ranges | +50 – 500 |
| Block timestamps, batched aggressively | +600 |
| Block timestamps, naive | +60,000 |

**Call it 1,500 – 4,000 RPC requests for a well-written version of this plan, and
60,000+ for the version that actually gets written first.** Per page load. Per visitor.
Per refresh. A hundred concurrent users on launch day is **150,000 – 400,000 requests**,
and nothing is shared between them because it's all happening in separate browser tabs.

### 1.6 Time and bytes

- **Latency.** At ~300–800ms per `eth_getLogs` against an archive node, 790 sequential
  requests is **4–10 minutes**. Parallelism helps until the provider's rate limiter
  doesn't. HTTP/2 multiplexes so the old 6-connections-per-host browser limit isn't the
  binding constraint — the provider's per-second budget is.
- **Provider budget.** On a compute-unit pricing model where `eth_getLogs` costs ~75 CU,
  790 requests ≈ **~60,000 CU** and the literal 0→latest version ≈ **~195,000 CU** — for
  one page load. Free tiers meter throughput in the low hundreds of CU/second, so a
  *single* visitor consumes several minutes of your entire account's throughput budget.
  (Exact CU values and tier limits change; check your provider's current docs. The order
  of magnitude is the point.)
- **Payload.** A JSON log entry is ~600–900 bytes on the wire. 100,000 transfers ≈
  **~75 MB** of JSON; a busier collection at 500,000 transfers ≈ **~375 MB**. Parsed into
  JS objects that's 3–10× in heap. A mobile Safari tab gets killed well before that.

---

## 2. What breaks first, in order

1. **Day one, in dev-against-mainnet: the request is rejected.** `block range too wide` or
   `more than 10000 results`. This never works even once as written. If it appeared to
   work in testing, it was against a local Anvil chain or a fresh testnet deploy, where
   the history is tiny — which is exactly the trap.

2. **After someone adds pagination: rate limiting.** 429s, then the provider's automatic
   backoff, then a feed that takes minutes and shows a spinner the whole time. The
   holder panel can't render at all until the *last* request returns, because a holder
   ranking is a fold over the complete history — one missing window and the balances are
   wrong, not just incomplete.

3. **Browser memory.** Desktop Chrome survives; mid-range Android and older iPhones drop
   the tab. Your bounce rate on mobile is effectively 100%.

4. **Your provider key gets stolen.** A key that works from the browser is, by
   construction, public: it's in the Network tab. Anyone can lift it and burn your quota.
   And you'll notice this *after* the bill, because your own legitimate traffic already
   looks like abuse.

5. **Correctness under reorgs.** You fetched `latest`. A 1–2 block reorg means you have
   logs for blocks that no longer exist. Balances silently drift. Nobody notices until a
   holder complains their count is wrong.

6. **The feature spec doesn't survive contact with the data anyway** — see §3.

---

## 3. Two spec problems worth fixing before you build anything

**a) "Sale" is not a `Transfer` event.** ERC-721 `Transfer(from, to, tokenId)` tells you
a token moved. It does not tell you it was sold, or for how much. A sale is a `Transfer`
that happens in the same transaction as a marketplace fill — Seaport's `OrderFulfilled`,
Blur, LooksRare, X2Y2, each with their own event shape and price encoding. To label a row
"Sale — 1.4 ETH" you must either correlate the `Transfer` with marketplace logs from the
same `transactionHash`, or get price data from a marketplace API. Your contractor's plan
has no path to this at all. What `Transfer` alone gives you is:
- `from == 0x0` → **mint**
- `to == 0x0` (or a known burn address) → **burn**
- otherwise → **transfer** (which *may* have been a sale)

**b) Confirm the token standard.** If this is ERC-1155, there is no `Transfer` event —
it's `TransferSingle` and `TransferBatch`, and balances are quantities per `(owner, id)`,
not a simple count. The whole plan is written against the wrong event. Check the contract
before anything else.

---

## 4. What to build instead

The principle: **do the history scan once, on a server, and store the result.** Reads at
page-load time should touch a database, not the chain. The chain is an append-only log;
your frontend needs indexed, queryable, sorted state. Those are different data structures
and no amount of RPC tuning bridges the gap.

### 4.1 Recommended: an indexer + Postgres + a small read API

**Ponder** (TypeScript, purpose-built for this, indexes into Postgres, serves HTTP/GraphQL)
is the best fit if your team is already TypeScript/viem. Alternatives with the same shape:
**Subsquid**, **Envio HyperIndex**, or a **subgraph** on The Graph. Or hand-roll it — the
indexing loop is ~200 lines; the hard parts are reorgs and backfill throughput, which the
frameworks handle for you.

**Schema:**

```sql
-- one row per Transfer log
CREATE TABLE transfers (
  block_number  BIGINT      NOT NULL,
  log_index     INT         NOT NULL,
  tx_hash       BYTEA       NOT NULL,
  block_time    TIMESTAMPTZ NOT NULL,   -- captured at index time, never re-fetched
  token_id      NUMERIC     NOT NULL,
  from_addr     BYTEA       NOT NULL,
  to_addr       BYTEA       NOT NULL,
  kind          TEXT        NOT NULL,   -- 'mint' | 'burn' | 'transfer' | 'sale'
  price_wei     NUMERIC,                -- non-null when correlated to a marketplace fill
  PRIMARY KEY (block_number, log_index)
);
CREATE INDEX ON transfers (block_number DESC, log_index DESC);

-- maintained incrementally: -1 for from_addr, +1 for to_addr, skip 0x0
CREATE TABLE balances (
  owner  BYTEA PRIMARY KEY,
  count  INT NOT NULL
);
CREATE INDEX ON balances (count DESC);
```

**Read path — this is the whole point:**

```sql
-- activity feed page 1, newest first: single index scan, sub-millisecond
SELECT * FROM transfers ORDER BY block_number DESC, log_index DESC LIMIT 50;

-- keyset pagination for "load more" — no OFFSET, stays fast at page 500
SELECT * FROM transfers
WHERE (block_number, log_index) < ($1, $2)
ORDER BY block_number DESC, log_index DESC LIMIT 50;

-- top holders: single index scan
SELECT owner, count FROM balances WHERE owner <> '\x00...00' ORDER BY count DESC LIMIT 100;
```

**Page load becomes 2 HTTP requests, ~50–200ms, tens of KB.** From ~2,000 requests and
several minutes to 2 requests and a fifth of a second. That's the actual delta, and it's
not a tuning difference — it's a different architecture.

**Cost profile:** the 790-request backfill still happens, but **once**, on your server, at
deploy time — not per visitor. After that the indexer follows the chain head: one
`eth_getLogs` every few seconds over a ~10 block window. That's a rounding error on any
paid plan. Use a log-optimized backfill source (Envio HyperSync, or a provider with
generous `eth_getLogs` limits) and the initial sync is minutes, not hours.

**Reorgs:** store `block_hash` alongside `block_number` and roll back rows when the hash
at a height changes, or simply index with a finality lag. Ponder/Subsquid/The Graph do
this for you — this is a real reason to use a framework rather than hand-rolling.

### 4.2 Infrastructure you don't have yet — being explicit

This is the part the contractor's plan claimed you could skip. You can't. You need:

1. **A Postgres database.** Neon, Supabase, RDS — any of them. Small; this dataset is
   maybe a few hundred MB.
2. **A long-running process** for the indexer. Railway, Render, Fly, ECS. **This cannot be
   a serverless function** — it must run continuously to follow the chain head. This is
   the single biggest change to your deployment story if you're currently all-static +
   Vercel.
3. **A server-side RPC endpoint** with archive access, key held in server env vars, never
   shipped to the browser. Budget for the one-time backfill.
4. **A read API** — a few endpoints in front of Postgres. Can be Vercel serverless
   functions; that part *is* stateless. Cache at the edge with a short TTL (10–30s);
   the feed tolerates it and it collapses launch-day traffic to near zero DB load.
5. **Monitoring on indexer lag** — alert when `head_block - indexed_block` exceeds a
   threshold. This is the thing that will silently break at 3am and make the feed look
   frozen.

Rough ongoing cost: **$20–50/month** for the whole stack.

### 4.3 If you need to ship next week and can't stand up an indexer

Use a **hosted NFT API** — Reservoir, Alchemy's NFT API, OpenSea's API, SimpleHash,
Moralis. They have already indexed your collection. You get owners-with-counts and an
activity feed (**including sale prices**, which solves §3a for free) in one call each.

- **Infra needed:** just a thin server-side proxy to keep the API key off the client. That
  you can do with a serverless function today.
- **Trade-offs:** vendor lock-in, their rate limits and pricing, and you're limited to the
  data they chose to expose — if your contract has custom events, they won't be there.
- **Recommendation:** ship on this, and move to §4.1 when you need data they don't have.
  These aren't mutually exclusive; the frontend talks to your API either way, so swapping
  the backing implementation later is contained.

### 4.4 The genuinely-no-infra fallback, and its honest limits

Worth knowing what *is* possible client-side, because the two panels differ:

- **The feed tail is salvageable.** You don't need full history to show recent activity.
  Query backwards from the head — `[latest-10000, latest]`, then the next window back —
  until you've collected 50 rows. On a collection with steady activity that's typically
  **1–5 requests**. Fetch timestamps only for the rows you render (~50 blocks, batched).
  You lose deep pagination and you lose sale prices, but "recent activity" works.
- **Top holders is not salvageable this way** — a current-balance ranking is a fold over
  *all* history; there is no cursor and no partial answer.
  - **Unless** token IDs are sequential `0..N-1` or the contract is `ERC721Enumerable`.
    Then skip logs entirely and read current state directly: `ownerOf(tokenId)` for every
    token, aggregated through **Multicall3**
    (`0xcA11bde05977b3631167028862bE2a173976CA11`) at ~500 calls per batch. A 10,000-token
    collection is **~20 RPC requests**, not 2,580, and it gives you the exact current
    ranking with no history at all.
  - Do this **on the server on a cron every few minutes** and cache the result as JSON.
    Then the holder panel is a static file fetch. This is a legitimate interim answer that
    needs no database — just a scheduled job and somewhere to put a JSON blob.

A third middle path: generate a **build-time snapshot** — run the full backfill in CI,
commit the result as a static JSON/Parquet file served from your CDN, and have the client
query only the last few thousand blocks live and merge. Zero runtime infra, at the cost of
staleness bounded by your deploy cadence.

---

## 5. What to tell the contractor

The plan has one correct sentence in it: `eth_getLogs` is standard RPC and any provider
key works. Everything downstream of that is wrong, because the constraint isn't which RPC
method you call — it's that **RPC is an interface for reading blockchain state, not a
query engine over history**. It has no sorting, no aggregation, no cursor, no filtering
beyond address+topic, and hard caps on how much it will return per call. A "newest first,
paginated feed" and a "top N ranked by current balance" are both database queries. So
build a database.

Concretely, before writing frontend code:

1. Confirm ERC-721 vs ERC-1155, and get the exact **deploy block**.
2. Decide: hosted API (fast, §4.2/4.3) or own indexer (flexible, §4.1). Given a launch
   deadline, start hosted.
3. Define the frontend against *your* API from day one — `/api/activity?cursor=` and
   `/api/holders` — so the backing implementation is swappable.
4. Move every provider key server-side. Nothing with a key in it ships to the browser.
