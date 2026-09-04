# Sanity check: client-side `eth_getLogs` for the activity feed + holder panel

**Short verdict:** the plan does not work, and it doesn't fail gracefully. The very
first request errors out on every commercial provider, so the page renders empty.
When you fix that the obvious way — paginating the range — one page load becomes
somewhere between **~800 and ~50,000 RPC requests** depending on how much of the feed
you actually want to render, and the holder panel starts silently producing *wrong
numbers* rather than no numbers. The sentence "we don't need extra infrastructure" is
the load-bearing error: you do need it, and it's a Postgres instance plus one
long-running process, or a vendor that already runs both for you.

Details and the arithmetic below.

---

## 0. Assumptions I'm using, so you can check the numbers

I don't know your collection's size, so I'm modelling a typical 10k-supply PFP that
has been trading for three years:

| Quantity | Value | Source |
|---|---|---|
| Current head | 25,800,000 | given |
| Block time | ~12s | post-Merge, fixed slots |
| Blocks in 3 years | 3 × 31,557,600s ÷ 12 ≈ **7,890,000** | arithmetic |
| Contract deploy block | ≈ 25,800,000 − 7,890,000 ≈ **17,910,000** | derived |
| Total `Transfer` logs ever emitted | ~100,000 (10k mints + ~90k secondary) | assumption |
| Distinct blocks containing those logs | ~45,000 | assumption |

If your collection is 1k tokens and quiet, divide the log-driven numbers by ~10. If
it's a 20k collection that had a wash-trading phase, multiply by 3. The *shape* of
the answer doesn't change — only how far past the breaking point you are.

Provider caps and compute-unit prices below are the current published ones as I know
them; the exact values drift, so treat them as the right order of magnitude and
re-check against your provider's docs. The conclusion is not sensitive to a 2× error
in any of them.

---

## 1. What happens on request #1: it fails

`eth_getLogs` with `fromBlock: 0, toBlock: "latest"` is rejected before any data comes
back. Every major provider enforces two independent caps:

- **A result-count cap.** Infura and most others return
  `-32005: query returned more than 10000 results`. Alchemy returns up to 10,000 logs
  and then errors. Your collection has ~100,000 logs, so you trip this by 10×.
- **A block-range cap.** Many providers additionally refuse ranges wider than
  10,000 blocks (Alchemy's documented safe window is 2,000 blocks when you also want
  a large result set; QuickNode and most public endpoints sit between 1,000 and
  10,000). You're asking for 25,800,000.
- **A query timeout**, typically 5–10 seconds, which a full-chain log scan blows
  through regardless of the other two.

So the shipped behaviour is: page loads, one request goes out, one JSON-RPC error
comes back, feed and holder panel are both empty. There is no partial-render path —
the whole screen depends on that one call. This is not a scaling problem you discover
under load; it's a 100% failure rate on the first user.

Worth flagging separately: **"any provider key works" is not true here either.** A
log query reaching back to block 0 needs a node that retains the full historical log
index. Most paid providers do, but free public endpoints commonly prune, and you'd
get a *silently short* answer from some of them rather than an error.

---

## 2. The honest version of the plan, and its request count

The natural fix is to loop over the range in windows. That's where the request count
comes from, and it's forced by the caps above — not by anything you chose.

**Just the `eth_getLogs` backfill:**

| Strategy | Window | Requests |
|---|---|---|
| As written, from block 0, 10k windows | 10,000 | 25.8M ÷ 10k = **2,580** |
| From block 0, conservative 2k windows | 2,000 | **12,900** |
| From deploy block (17.91M), 10k windows | 10,000 | 7.89M ÷ 10k = **789** |
| From deploy block, 2k windows | 2,000 | **3,945** |

Note the first row versus the third: scanning "from block 0" wastes **~1,790 requests
scanning blocks that predate your contract's existence.** That's ~70% of the work
returning empty arrays. Hardcoding the deploy block is free and mandatory.

On top of that, hot ranges — mint day, a big listing sweep — will exceed the 10,000
log cap inside a single window, so a correct client has to catch the error and
bisect. Budget 2–3 extra calls per hot window; call it **+50–150 requests**.

So the floor, for a well-written client that knows the deploy block: **~800–900
requests.** As literally specified in the plan: **~2,600.** On a provider with a 2k
window: **~4,000–13,000.**

### 2a. The hidden multiplier: logs don't contain what the feed needs

This is the part the plan misses entirely, and it's larger than everything above.

**Timestamps.** A log carries `blockNumber`, not a timestamp. Your feed says "sold 4
minutes ago" — that requires `eth_getBlockByNumber` for every distinct block you
render. Across full history that's ~45,000 additional calls. JSON-RPC batching can
fold 100 into one HTTP request, so ~450 round trips, but the provider still bills
and rate-limits all 45,000.

**Sale vs. transfer.** `Transfer(from, to, tokenId)` cannot tell you a sale happened,
and carries no price. `from == 0x0` gives you mints, and that's all you get for free.
To label the other rows "sold for 2.4 ETH" you need, per transaction, either
`eth_getTransactionReceipt` and then decoding Seaport's `OrderFulfilled` (plus Blur,
plus whatever else) out of the sibling logs, or a second set of `eth_getLogs` scans
over the marketplace contracts. Consideration items in Seaport are split across
seller, creator royalty, and platform fee, so "the price" is itself a summation you
have to implement. Realistically **+10,000–40,000 requests**, or a second full
backfill of two or three more contracts.

**Per-row display data.** Token images (`tokenURI` → IPFS fetch, per token) and ENS
names/avatars for the holder panel (reverse resolution, per address) are more calls
again — these at least can be lazy-loaded for visible rows only.

**Realistic total for one page load, feed with prices:**

```
    789    eth_getLogs        (deploy block → head, 10k windows)
+   100    bisection retries  (hot ranges over the 10k-log cap)
+ 45,000   eth_getBlockByNumber  (timestamps)
+ ~20,000  eth_getTransactionReceipt (sale detection + price)
─────────
  ~66,000  RPC calls, per user, per page load
```

Even the stripped-down version — no prices, no timestamps, just "wallet A → wallet B"
— is ~800 calls and 70 MB of JSON.

### 2b. Why that's not merely slow

Providers meter in compute units, not requests, and the two limits that bite are
**CU/second** and **CU/month**.

Using Alchemy's published-style pricing as the model (`eth_getLogs` ≈ 75 CU,
`eth_getBlockByNumber` ≈ 16 CU, `eth_getTransactionReceipt` ≈ 15 CU):

```
    889 × 75  =    66,675 CU
 45,000 × 16  =   720,000 CU
 20,000 × 15  =   300,000 CU
              ─────────────
                ~1,090,000 CU   per page load
```

- At a free tier's ~330 CU/second throughput ceiling, one page load takes
  **1,090,000 ÷ 330 ≈ 3,300 seconds ≈ 55 minutes**, assuming perfect pipelining and
  exactly one user on the key.
- On a growth plan at ~3,000 CU/s, it's still **~6 minutes** for a single visitor.
- Against a 300M CU/month allowance, you get roughly **275 page loads per month**
  before the key is exhausted. Not 275 users — 275 *page loads*, and a refresh counts.

There is no plan tier where this becomes viable, because the cost is per-user and the
work is identical for every user. Ten concurrent visitors are each independently
re-downloading the same three years of history.

### 2c. The browser side

~100,000 logs at ~600–800 bytes of JSON each is **60–80 MB** on the wire (~15–20 MB
gzipped, which is still an unacceptable mobile payload). Parsed into JS objects with
hex-string fields, expect **400 MB–1 GB of heap**. Mobile Safari's per-tab limit is
well under that: the tab is killed. On desktop, the main thread blocks for seconds at
a time during parsing and the balance reduction, so the page is visibly frozen even
in the case where it eventually succeeds.

---

## 3. What breaks first, in order

1. **The first request errors.** Range/result cap. Blank screen, 100% of users, day
   one. (§1)
2. **After you paginate: rate-limit 429s partway through the backfill.** And here is
   the genuinely dangerous failure — **the top holders panel is a sum over the
   complete history.** Balances are computed by replaying every transfer; if page 340
   of 789 is dropped, some wallet's balance is wrong and *stays* wrong, with no error
   anywhere in the UI. You ship a leaderboard that is confidently incorrect. Wrong
   data is worse than missing data, especially on a panel people will screenshot.
3. **Mobile tabs OOM-crash** on the parse. (§2c)
4. **The API key is exfiltrated.** It ships in your client bundle; anyone can lift it
   from the network tab and spend your quota. Domain allowlisting is a speed bump,
   not a control.
5. **The monthly CU allowance is gone** in the first few hundred page loads, and every
   subsequent visitor gets a hard 402/429. (§2b)
6. **Reorgs corrupt the tip.** Logs from the last handful of blocks can be replaced.
   A client with no reorg handling shows phantom transfers and, again, permanently
   skewed balances for anyone who happened to load during one.

---

## 4. Correctness problems that exist independent of scale

Even if RPC were infinitely fast and free, this design has bugs worth knowing about:

- **`Transfer` is not sale data.** Covered in §2a — mints are detectable, sales are
  not, prices are absent. The feed as specced ("every mint, sale, and transfer")
  cannot be built from this one event.
- **ERC-20 topic collision.** `Transfer(address,address,uint256)` has the identical
  topic0 for ERC-20 and ERC-721. Filtering by contract address avoids it; filtering
  only by topic pulls in the entire chain's token activity. Worth confirming the
  contractor's filter includes `address`.
- **ERC-1155.** If any part of the collection is 1155, `Transfer` doesn't exist for it
  — you need `TransferSingle`/`TransferBatch`, with quantities, and the balance
  arithmetic stops being ±1.
- **Burns.** `to == 0x0` (and the common burn-address variants) must be excluded from
  the holder ranking, or the burn address tops your leaderboard.
- **You can't ask the contract instead.** There's no `getAllHolders()`. Even with
  `ERC721Enumerable` you'd be making one call per token. Replaying transfer history is
  genuinely the only way to derive holders — which is exactly why this belongs in an
  index, computed once, not in a browser, computed per visitor.

---

## 5. What to build instead

**The principle:** the browser should never touch an RPC node for this screen. It
should make **two HTTP requests** to your own API:

```
GET /api/activity?cursor=<opaque>&limit=50   →  50 feed rows
GET /api/holders?limit=100                   →  ranked leaderboard
```

Both served from a database table in single-digit milliseconds. The three years of
history get replayed **once, on a server**, not once per visitor. That ~800-call
backfill is completely fine when it runs once on a box with a real rate-limit budget
and takes four minutes.

### Option A — buy the index (recommended if you're shipping in the next month)

Use an NFT-aware API that has already done this indexing:

- **Reservoir** is the closest match to your exact screen: `/collections/activity/v6`
  returns mints, sales, and transfers interleaved and newest-first *with sale prices
  already decoded and denominated*, and `/owners/v2` returns the holder ranking
  pre-sorted. Both are cursor-paginated. This is your two panels, as two endpoints.
- **Alchemy NFT API** (`getOwnersForContract`, `getTransfersForContract`) or
  **OpenSea API** or **SimpleHash** are comparable alternatives.

Infrastructure you'd need: **an API key and a thin backend proxy** — one serverless
function or a small Next.js route handler — to keep the key server-side and add a
cache layer. That's it. No database, no worker.

Trade-offs, stated plainly: you take a vendor dependency for your main screen, you
pay per request, and you're bound to their schema and their definition of "sale." If
that vendor has an outage, your homepage has an outage. Mitigate with a short-TTL
cache so brief upstream failures serve slightly stale data instead of an error.

**Effort: days.**

### Option B — run your own index (recommended as the destination)

Use **Ponder** (TypeScript, purpose-built for exactly this; you define the schema and
an event handler, it does backfill, head-following, reorg handling, and serves a
Postgres-backed API). **Subsquid** or a **Graph Protocol subgraph** are the main
alternatives; a subgraph avoids running the process yourself but adds Graph network
costs and a slower iteration loop.

The data model is small:

```sql
-- append-only; one row per Transfer log
CREATE TABLE transfers (
  block_number  BIGINT      NOT NULL,
  log_index     INT         NOT NULL,
  block_time    TIMESTAMPTZ NOT NULL,   -- resolved once at index time
  tx_hash       BYTEA       NOT NULL,
  from_addr     BYTEA       NOT NULL,
  to_addr       BYTEA       NOT NULL,
  token_id      NUMERIC     NOT NULL,
  kind          TEXT        NOT NULL,   -- 'mint' | 'sale' | 'transfer' | 'burn'
  price_wei     NUMERIC,                -- non-null when kind='sale'
  PRIMARY KEY (block_number, log_index)
);
CREATE INDEX ON transfers (block_number DESC, log_index DESC);  -- the feed

-- maintained incrementally: -1 on `from`, +1 on `to`, skip zero address
CREATE TABLE holders (
  address  BYTEA  PRIMARY KEY,
  balance  INT    NOT NULL
);
CREATE INDEX ON holders (balance DESC) WHERE balance > 0;        -- the panel
```

The feed is a keyset-paginated index scan on `(block_number, log_index) DESC` — note
that this is *cursor* pagination, not `OFFSET`, so page 500 is as fast as page 1. The
holder panel is `SELECT ... ORDER BY balance DESC LIMIT 100`, straight off the partial
index. Both are sub-millisecond regardless of how much history accumulates.

Sale detection and prices mean also indexing **Seaport's `OrderFulfilled`** (and Blur,
if your collection trades there) and joining on transaction hash. Ponder handles
multiple contracts in one project. If you'd rather not own marketplace-decoding logic
— it changes when marketplaces ship new versions — that's the strongest argument for
Option A.

**Infrastructure you do not currently have, explicitly:**

1. **A Postgres database.** Managed is fine — Neon, Supabase, RDS. Your dataset here
   is small; the smallest tier is plenty.
2. **A long-running process** for the indexer. Railway, Fly, Render, or ECS. This is
   the thing that can't be serverless: it holds a connection to the chain head and
   must run continuously.
3. **An RPC key with real throughput** for the one-time backfill and head-following.
   Much cheaper than the client-side plan, because the cost is now per-chain-block
   rather than per-page-view.
4. **Monitoring for indexer lag.** The one new failure mode you're adopting: the
   indexer falls behind or crashes and the site serves stale data while looking
   perfectly healthy. Alert on `head_block - last_indexed_block > ~10`, and consider
   surfacing it in the UI.
5. **An API layer** in front of the DB (or Ponder's built-in server) with a CDN cache.

**Effort: 1–2 weeks** to something you'd trust in production, most of it in sale
decoding and reorg testing rather than the core index.

### Frontend details either option needs

- **Cursor pagination + infinite scroll** on the feed, 25–50 rows a page. Never a
  "load all" path.
- **Cache the holders panel** hard — 30–60s TTL at the edge. It barely moves between
  blocks and it's the same response for every visitor, so it should be one origin hit
  per minute globally.
- **Live updates** via SSE/WebSocket from *your* backend, or poll
  `/api/activity?since=<cursor>` every ~12s. Not `eth_subscribe` fanned out to every
  browser tab.
- **Reorg safety in the UI:** treat the last ~12 blocks as provisional (dim them, or
  hold them back) so a reorg never retracts a row a user already read as final.

### The pragmatic path

Ship **Option A behind your own two endpoints** now, and define that API contract
(`/api/activity`, `/api/holders`, cursor shape, row schema) as *yours*, not the
vendor's. Then swapping in Option B later is a backend change the frontend never
notices. This is a cheap decision to make correctly today and an expensive one to
retrofit.

---

## 6. What to take back to the contractor

The plan isn't wrong on a detail; it's built on an assumption that doesn't hold —
that historical chain data is queryable on demand from a browser. It isn't. RPC nodes
answer point questions about state ("what's the balance of X *now*") efficiently;
they are not analytical databases and they will not aggregate three years of events
for you. Every product with an activity feed and a holder leaderboard — OpenSea,
Blur, Zora — runs an indexer behind it. There is no version of this where you don't.

Three specific things to settle with them:

1. **Where does the deploy block come from?** If the answer is still "block 0," that
   alone is 70% wasted work and signals the range problem wasn't thought through.
2. **How are sales and prices derived?** If the answer is "from the Transfer event,"
   the feature as specced can't be built as designed — that needs marketplace event
   decoding or a vendor that provides it.
3. **What happens when the log backfill is incomplete?** If there's no answer, the
   holder panel will ship wrong and nobody will notice until someone checks a wallet
   by hand.
