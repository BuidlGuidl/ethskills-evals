# Sanity check: "one `eth_getLogs` from block 0, compute everything in the browser"

**Short version:** the plan doesn't degrade at scale — it fails on the first request,
on day one, at any collection size. Every major provider rejects `fromBlock: 0,
toBlock: latest`. The moment you work around that rejection the "one request" becomes
**roughly 2,600 requests per page load**, and that number is forced by provider limits,
not by anything you control. The claim "we don't need extra infrastructure" is the part
that's actually wrong: you need an indexer. Below is the arithmetic, the failure order,
and what to build.

---

## 1. Why the one call becomes ~2,600 calls

`eth_getLogs` is not an unbounded query API. Every hosted provider caps it two ways, and
you hit whichever binds first:

| Cap | Typical value | Effect |
|---|---|---|
| Block range per call | 10,000 blocks (Infura, Alchemy when over the result limit; public/free endpoints are often 1,000–5,000) | Forces you to chunk the scan |
| Logs returned per response | 10,000 logs | Forces you to *re-split* dense chunks |
| Throughput | e.g. Alchemy free tier ~330 CU/s, `eth_getLogs` ~75 CU → **~4 requests/sec** | Sets the wall-clock floor |

So the request count is simply:

```
25,800,000 blocks ÷ 10,000 blocks per call = 2,580 requests
```

That is the *best* case, on a generous provider. The same scan is:

- **12,900 requests** on a provider with a 2,000-block cap
- **25,800 requests** on a public endpoint with a 1,000-block cap

**~69% of those requests return nothing.** The collection is three years old. At ~12s
blocks that's ~7.9M blocks, so the contract was deployed around block **17,910,000**.
Scanning from block 0 means ~17.9M blocks of guaranteed-empty history — about **1,790
wasted round trips** before the first real log. Starting at the deployment block cuts the
scan to **~790 requests**. Still far too many for a page load, but it shows the "block 0"
detail is pure waste, not a safety margin.

Then add the re-splitting. Chunks are uniform in blocks, not in activity. A 10,000-block
window is ~33 hours. Mint day for a 10k-supply collection puts 10,000+ Transfer logs into
a few hours — that chunk trips the 10,000-log response cap, errors out, and your client
has to binary-split and retry it (1 failed call → 2–8 more). Any drop day, migration, or
airdrop does the same. So call it **~2,600 requests plus a long tail of retries.**

### The second multiplier nobody counts: timestamps

`eth_getLogs` returns `blockNumber`, not a timestamp. An activity feed showing "2 hours
ago" needs block times. That's an `eth_getBlockByNumber` **per distinct block that has
activity**. For a collection with ~120,000 lifetime transfers spread over maybe ~40,000
distinct blocks, that's **another ~40,000 requests** unless you batch them (JSON-RPC
batching helps, but providers cap batch size, typically 100–1,000 — so still 40–400 calls
*minimum*, and many providers bill each element separately).

### And the payload

~120,000 Transfer logs × ~500–700 bytes of JSON each ≈ **60–80 MB** over the wire, per
page load, parsed on the browser's main thread.

---

## 2. What breaks first, in order

**1. The very first request, immediately.** `fromBlock: 0, toBlock: latest` returns an
error, not data:
- Infura: `query returned more than 10000 results`
- Alchemy: `Log response size exceeded... this block range should work: [0x0, 0x...]`

This is not a load-testing discovery. It happens the first time anyone opens the page,
including on the contractor's laptop. If the plan was ever demoed working, it was demoed
against a testnet, a fresh contract, or an archive node with the limits off.

**2. Rate limiting, once they chunk to make it work.** At ~4 `eth_getLogs`/sec on a free
tier, 2,580 sequential requests is **~10 minutes** of wall clock. Raise concurrency and
you trade the queue for HTTP 429s and a retry storm, which is slower and looks like a
random failure to the user. Network latency alone gives the same answer independently:
2,580 × ~250ms ≈ 11 minutes.

**3. Your provider bill / quota, within a day.** This cost is paid **per page load, per
user** — there is no shared cache, because the work happens in each visitor's browser.
At ~75 CU per call: one page load ≈ 195,000 CU. A thousand daily visitors ≈ **195M CU/day**.
A typical free tier is ~100M CU/*month*; a $50/mo plan is a few hundred million CU/month.
You exhaust a paid plan in **hours**, then every user sees a broken page. A single bot
scraper or someone leaving the tab on auto-refresh drains it faster.

**4. The browser, on mobile.** 60–80 MB of JSON parsed into ~120k JS objects lands at
roughly 300–500 MB of heap once you build the holder map. Mobile Safari kills tabs in the
200–400 MB range. Desktop survives but the main thread blocks during parse — the page is
frozen, not slow.

**5. Correctness, quietly, forever.** Even if all the above worked:
- **Reorgs.** A client-side scan has no reorg handling. Logs from the last few blocks can
  be reverted; your holder counts silently drift wrong and never self-correct.
- **No pagination.** The feed is "newest first", but the design forces downloading three
  years of history before rendering row #1. The UI cannot show anything until 100% of the
  scan completes.
- **ERC-1155.** If the collection is 1155, `Transfer` doesn't exist — it's `TransferSingle`
  and `TransferBatch`, with quantities. Holder counts computed from a `Transfer` topic
  would be empty.

---

## 3. The requirement the plan can't satisfy at all

The screen is specified as "every **mint, sale, and transfer**". Transfer events can only
tell you two of those three:

- **mint** = `from == 0x0000...0000` ✅
- **burn** = `to == 0x0000...0000` ✅
- **sale vs. plain transfer** ❌ — indistinguishable. A Transfer log carries no price, no
  currency, no marketplace.

To label a sale and show its price you must additionally decode the marketplace event in
the same transaction (Seaport `OrderFulfilled`, Blur, etc., each with its own ABI and its
own fee/consideration math), or pull sales from a marketplace API. That's a whole
workstream the plan doesn't mention, and it's not something you can bolt onto a
client-side log scan — it needs the transaction's other logs, which means more requests.

---

## 4. What to build instead

The fix is the standard one: **stop reading the chain at request time.** Read it once,
into your own database, and serve the page from that. The page load should be **two
requests to your own API**, both answered in single-digit milliseconds from indexed
tables.

### Architecture

```
                 backfill (once, ~800 chunked getLogs, server-side, minutes)
Ethereum RPC ──▶ Indexer ──▶ Postgres ──▶ your API ──▶ browser
                 tail (follow head, poll/subscribe every block)
```

**Tables**

- `transfers(block_number, log_index, tx_hash, from, to, token_id, block_time, kind, price)`
  — primary key `(block_number, log_index)`, plus a `DESC` index on it.
- `balances(address, token_count)` — updated incrementally on every transfer
  (`from` −1, `to` +1), indexed on `token_count DESC`.

**The two endpoints**

- `GET /feed?cursor=<block_number,log_index>&limit=50` — keyset pagination on the DESC
  index. Constant time regardless of history depth. Infinite scroll works naturally; the
  first 50 rows render immediately.
- `GET /holders?limit=100` — `SELECT address, token_count FROM balances WHERE token_count > 0
  ORDER BY token_count DESC LIMIT 100`. Materialize it or cache it 30–60s; it barely
  changes between blocks.

**Backfill vs. tail.** The expensive scan (~790 chunked calls from the deployment block)
runs **once, ever**, server-side, and takes a few minutes. After that the indexer only
processes new blocks — one small `eth_getLogs` every ~12s, forever. Total steady-state RPC
usage drops from *2,600 per visitor* to roughly *7,200 per day, total*, independent of
traffic.

**Reorg handling.** Track blocks as finalized vs. unfinalized. On a reorg, delete rows
above the fork point and re-apply. Off-the-shelf indexers do this for you — that's a
significant part of why you use one.

### Tooling options, cheapest-effort first

1. **Hosted NFT data APIs — zero infra, ships in days.** Alchemy's
   `alchemy_getAssetTransfers` (paginated, includes block timestamps and decoded metadata)
   covers the feed; `getOwnersForContract?withTokenBalances=true` covers holders. Reservoir
   or the OpenSea API give you sales *with prices and marketplace attribution*, which
   solves §3 outright. Trade-off: vendor lock-in, per-call pricing, and you're limited to
   the shapes they expose. **This is what I'd ship first.**
2. **Self-hosted indexer — full control.** [Ponder](https://ponder.sh) is the right fit for
   a TypeScript/Next.js team: point it at the contract ABI, write handlers for
   `Transfer`/`TransferSingle`, it manages backfill, tail, reorgs, and gives you Postgres +
   a generated API. Alternatives: Envio HyperIndex (fastest backfill), Subsquid, or a
   Graph Protocol subgraph (be aware subgraphs are awkward for `ORDER BY` on a derived
   aggregate like holder rank, and hosted-service query costs apply).
3. **Roll your own worker.** Only if you need something the above can't do. You will
   re-implement reorg handling and get it wrong the first time.

### One useful shortcut for the holders panel

If this is an ERC-721 with sequential token IDs and a bounded supply (say 10,000), you can
get **exact** current owners without any indexer: batch `ownerOf(tokenId)` through
Multicall3's `tryAggregate` (~500 IDs per call) → **~20 `eth_call` requests** for the whole
collection. Run it **server-side on a 60s cron**, cache the ranking, serve it statically.

That's ~20 requests every 60s total, versus 2,580 per visitor. Caveats: it needs a known
token-ID range, it doesn't work for ERC-1155, and burned/unminted IDs revert (hence
`tryAggregate`, not `aggregate`). But it means the **top-holders panel can be correct and
fast this week**, before the indexer exists.

The activity feed has no equivalent shortcut — it genuinely needs stored history, because
"newest first with pagination" requires an ordered index you can't derive from a live
contract call.

---

## 5. Infrastructure you don't have yet — stating it plainly

The contractor's line "we don't need extra infrastructure" is the load-bearing error. Any
correct version of this needs, at minimum:

- **A server-side process.** Something that runs continuously, not on page load. Today the
  project is presumably a static frontend; this is a new deployment target (Railway, Fly,
  Render, ECS — modest, ~$10–25/mo).
- **A Postgres database.** Neon/Supabase/RDS. Small — three years of one collection is
  well under a GB.
- **An RPC plan with deep log access.** The backfill reaches back to 2023, so you need a
  provider that serves historical logs at that depth (archive-tier on some plans). One-time
  cost during backfill, negligible after.
- **A backfill runbook.** It takes minutes and must complete before launch, and be
  re-runnable if you change the schema.
- **Monitoring on indexer lag.** If the tail process dies, the feed silently freezes at a
  stale block and looks fine. Alert on `head_block - last_indexed_block > N`.
- **A price/sale data source** if "sale" must show a price — either marketplace event
  decoding in your indexer, or Reservoir/OpenSea.

Option 1 above (hosted API) removes the first four bullets and replaces them with a vendor
bill. That's a legitimate trade and probably the right call for launch.

---

## 6. Recommendation

- **Now:** don't build on this plan. Reject the client-side full-history scan outright — it
  isn't a performance concern to optimize later, it returns an error on the first call.
- **Launch:** hosted NFT API (Alchemy/Reservoir) behind your own thin API routes, so the
  provider key never reaches the browser and you control caching. Plus the Multicall3 cron
  for holders if you want exactness. Ships in days.
- **Next:** stand up Ponder + Postgres when you need custom logic, want off the per-call
  meter, or need sale attribution the vendor doesn't expose. The API contract from launch
  stays the same, so it's a backend swap, not a rewrite.
- **Non-negotiable regardless of path:** the RPC key must live server-side, the browser
  must never scan logs, and the feed must be cursor-paginated from the first commit.
