# Sanity check: "one `eth_getLogs` from block 0" for the activity feed + holder panel

Short version: the plan does not work, and it does not fail gracefully. The single
call it describes is rejected by every mainstream provider, and the chunked version
that a developer will inevitably write instead turns one page load into roughly
**2,600 RPC requests minimum** — realistically 3,000–5,000 once result-size limits
force extra splitting — taking minutes, burning a month of provider quota in a few
hundred visits, and shipping tens of megabytes of JSON into a mobile browser. It
also cannot produce the feed the screen is specified to show, because `Transfer`
logs do not contain sale prices or timestamps.

Below: the request math, the failure ordering, and what to build.

---

## 1. The request math

### The single call never happens

`eth_getLogs` with `fromBlock: 0, toBlock: "latest"` is rejected on the first try.
Providers cap this method because serving it means walking the bloom filter of every
block in the range and pulling matching receipts off disk; an uncapped query lets one
browser tab pin a node. The caps you will hit, in the error messages you will see:

- **Block-range cap.** Typically **10,000 blocks** per request (Alchemy, Infura and
  most others sit at or near this; some tiers and some providers are stricter —
  2,000 or even 500). Error: *"query returned more than 10000 results"* /
  *"block range is too wide"* / `-32602`.
- **Result-count cap.** Typically **10,000 logs** per response, independent of the
  block range. A 10,000-block window is fine on a quiet stretch and rejected outright
  across a busy one.
- **Response-time / payload cap.** Requests that survive the first two still time out
  around 10–30s on large windows.

These are provider policy, not a quirk of one key, so "any provider key works" is the
part of the plan that is wrong at the root. Switching providers changes the number,
not the existence of the cap.

### So the code becomes a chunked loop — and here is the count

Ethereum is at ~25,800,000 and produces ~2,628,000 blocks/year (12s blocks). Chunking
at the common 10,000-block limit:

| Scenario | Requests per page load |
|---|---|
| Block 0 → latest, 10k chunks (**the plan as written**) | **2,580** |
| Block 0 → latest, 10k chunks, with bisection on dense ranges | **~3,000–5,000** |
| Block 0 → latest, 2,000-block provider cap | **12,900** |
| Deploy block → latest, 10k chunks (the *best case* after one obvious fix) | **~790** |

Three things force that number upward from the floor of 2,580:

1. **Starting at block 0 is ~69% pure waste.** A three-year-old collection deployed
   around block **17,900,000**. Blocks 0–17.9M contain zero logs for this contract,
   but you still pay 1,790 requests and 1,790 round trips to learn that. Nobody is
   saved by an empty response — the node still scans the range.
2. **Result-count caps force recursive bisection.** Mint day is the problem: a 10k
   collection minting out in a few hundred blocks emits >10,000 `Transfer` logs inside
   one chunk. That chunk is rejected, you split to 5k, still rejected, split to 2.5k…
   Each dense region costs 3–6 requests where you budgeted one. Same during any later
   volume spike.
3. **Retries.** Rate-limited chunks (HTTP 429) and timeouts come back through
   exponential backoff, each retry a fresh request against the same budget.

### The requests the plan forgot entirely

**Timestamps.** Log objects carry `blockNumber` but **no timestamp**. An activity feed
that says "3 minutes ago" needs `eth_getBlockByNumber` for every distinct block in the
feed. A collection with ~150,000 transfers spread over tens of thousands of distinct
blocks means *tens of thousands of additional requests* if you resolve them all — and
you cannot batch them the way you batch logs.

**Sale prices.** This is the structural gap. The screen is specified as "every mint,
sale, and transfer," but a `Transfer` event tells you a token moved and nothing else.
There is no price field, and there is no flag distinguishing a sale from a gift, a
wallet consolidation, or a staking deposit. To label a row "sold for 2.4 ETH" you must
additionally index marketplace events — Seaport `OrderFulfilled`, plus Blur, LooksRare
and X2Y2 for historical coverage — and join them to the `Transfer` by transaction hash,
then decode the consideration array to net out royalties and fees. That is a second
full log-indexing problem layered on the first, and no amount of `Transfer`-only
scanning produces it.

**Token standard.** If the contract is ERC-1155 rather than ERC-721, `Transfer` is the
wrong event entirely — it's `TransferSingle` and `TransferBatch`, with quantities, and
the holder math becomes balance arithmetic instead of ownership assignment. Worth
confirming which one you have before anyone writes a decoder.

### What that costs

Priced in Alchemy-style compute units, `eth_getLogs` runs ~75 CU. One page load at
2,580 calls ≈ **195,000 CU**. Mid-tier monthly allowances are in the tens to low
hundreds of millions of CU, so **a single month's quota is consumed by somewhere in
the low hundreds to low thousands of page loads** — one modest traffic day, or one
person with the tab on auto-refresh. (Verify current CU costs and plan limits against
your provider's pricing page; the ratio is the point, not the exact digits.)

Latency: at ~300ms per round trip, 2,580 serial requests is **~13 minutes**. You can
parallelize, but the provider's rate limit is the same budget you are already
exhausting — pushing concurrency to 10 buys you ~80 seconds of wall clock and a wall
of 429s instead. There is no configuration of this design that loads in under a minute.

---

## 2. What breaks first, in the order you will actually see it

1. **Day one, in development:** the literal call in the plan returns an error. The
   contractor adds a chunking loop. This is the only failure that is cheap, because it
   happens before launch.
2. **First real page load on mainnet:** minutes of blank screen behind a spinner.
   Most users leave before it finishes. This is the failure that kills the launch.
3. **Rate limiting, within the first hour of traffic:** 429s across concurrent
   visitors. Note the shape of this — the requests are *identical for every visitor*.
   Ten people on the site means the same 2,580 queries run ten times. It gets worse
   linearly with traffic, and worse over time as the chain grows.
4. **Quota exhaustion, within days:** the key is spent, and the site goes fully dark —
   not degraded, dark, because the feed has no cached fallback.
5. **Browser memory:** ~150,000 logs at ~600 bytes of JSON each is **~90MB** over the
   wire, more once parsed into JS objects. Desktop Chrome survives it; mobile Safari
   OOMs and reloads the tab, which restarts the 2,580 requests. That's an infinite
   loop on the most common device class.
6. **The key itself is public.** Shipping the RPC key to the browser means anyone can
   read it out of devtools and spend your quota. Independent of everything above, this
   needs a backend proxy.
7. **Silent wrong answers — the worst one.** The holder ranking is a replay of the
   entire transfer history; *one* dropped chunk, one retry that quietly gave up, and
   the balances are wrong with no error anywhere. The panel renders confidently
   incorrect numbers. Add reorgs at the chain head (a transfer you counted gets
   un-mined) and burns to `0x0` (a holder who must be excluded, not ranked), and there
   is no mechanism in this design that would ever tell you the panel is lying.

Point 7 is why "just make the chunking more robust" isn't a fix. The architecture
recomputes three years of state, per visitor, per page load, with no checkpoint and no
way to verify the result.

---

## 3. What to build instead

The governing insight: **the feed and the holder panel are identical for every visitor
and change only at the chain head.** Computing them per-client is the error. Compute
them once, server-side, incrementally, and serve them from a database. Page load should
be **1–2 HTTP requests to your own API, under 100ms.**

Pick based on how much you want to own.

### Option A — Hosted NFT data API (fastest path, ship this week)

Use a provider that has already indexed mainnet NFT activity:

- **Reservoir** is the closest fit — it has a collection activity endpoint (mints,
  sales, transfers, *with prices already resolved from marketplace events*) and an
  owners endpoint that returns wallets ranked by token count, both paginated.
- **Alchemy NFT API** (`getNFTsForContract`, `getOwnersForContract`,
  `getTransfersForContract`) and **SimpleHash** cover the same ground.

Page load becomes: one call for page 1 of the feed, one for the top 50 holders. Both
sub-second. Critically, this is also the only option that solves the sale-price problem
without you writing marketplace decoders.

**Infrastructure you need that you don't have:** a thin backend proxy (one serverless
function) so the API key isn't in the browser, plus a short-TTL edge cache (30–60s)
in front of it so your traffic doesn't multiply into their rate limit. That's it.

**Tradeoff:** you depend on their uptime, their pricing, and their definition of a
"sale." For a launch, that is a good trade.

### Option B — Your own indexer (own the data, ~1–2 weeks)

Use an indexing framework rather than writing the chunking loop yourself — they handle
backfill, reorgs, and checkpointing, which is most of the hard part:

- **Ponder** (TypeScript, Postgres, serves GraphQL/SQL) — best fit if your team is JS.
- **Envio HyperIndex** — fastest backfill.
- **Subsquid**, or a **subgraph** on The Graph / Goldsky.

Shape of the schema:

```
transfers(block_number, log_index, tx_hash, from_addr, to_addr, token_id, block_time, kind)
  index on (block_number DESC, log_index DESC)   -- the feed, keyset-paginated

tokens(token_id PRIMARY KEY, current_owner)      -- ERC-721: one row per token

holders(address PRIMARY KEY, token_count)
  index on (token_count DESC)                    -- the top-holders panel
```

Key decisions:
- **Maintain `holders` incrementally** — on each transfer, decrement `from`, increment
  `to`, skip/exclude `0x0`. Never recompute by aggregating the full transfer table.
  The panel becomes `ORDER BY token_count DESC LIMIT 50` on an index — sub-millisecond.
- **Keyset pagination for the feed** (`WHERE (block_number, log_index) < (...)`), not
  `OFFSET` — `OFFSET` degrades badly deep into a three-year history.
- **Index Seaport/Blur/LooksRare/X2Y2 events alongside `Transfer`** and join on
  `tx_hash` to classify rows as mint / sale / plain transfer and attach prices. Budget
  real time for this; it's the fiddliest part. If you'd rather not, take prices from
  Reservoir (Option A) and index only ownership yourself — a reasonable hybrid.
- Backfill of ~7.9M blocks from the deploy block runs once, in tens of minutes to a few
  hours, then the indexer tails the head continuously.
- Serve the feed's first page and the holders panel from a cache (Redis or HTTP cache,
  ~15–30s TTL). They're the same bytes for everyone.
- Live updates via SSE/WebSocket push from the indexer, so the feed doesn't poll.

**Infrastructure you need that you don't have:**
- **Postgres** (managed is fine — Neon, RDS, Supabase).
- **A long-running worker process.** This is the one that surprises people: an indexer
  cannot run on Vercel/Lambda-style serverless functions. It needs a persistent
  container — Railway, Fly, Render, ECS, or the framework's hosted offering
  (Ponder Cloud, Goldsky).
- **An RPC endpoint on a paid plan** for backfill throughput. One-time heavy load, then
  light steady-state.
- **A cache layer** and **monitoring on indexer lag** (alert if head-minus-indexed
  exceeds ~20 blocks), because a stalled indexer looks exactly like a quiet market.

### Stopgap if you need the holder panel correct tomorrow

If the contract is a standard ERC-721 with a known supply, you can get a fully accurate
holder ranking without any history at all: call `ownerOf(tokenId)` for every token,
batched through **Multicall3** at ~500 per call. A 10,000-token collection is **~20
`eth_call`s**, a couple of seconds. Run it server-side on a cron every minute or two
and cache the result. That is 20 requests against 2,580, it's exact rather than
replayed, and it sidesteps the drift problem entirely.

It does *not* help the activity feed — that genuinely needs history — but it de-risks
half the screen immediately while Option A or B lands.

---

## 4. Recommendation

1. **Now:** Option A (Reservoir or Alchemy NFT API) behind a serverless proxy with a
   30s cache. This gets you a working feed *with sale prices* and a holder panel in
   days, and the key out of the browser. Optionally add the Multicall3 holder job if
   you want that panel on your own data from day one.
2. **Then, if you want to own the data:** Option B, built behind the same API surface
   your frontend already calls — so swapping the backing store is invisible to the
   client.

The one thing not to do is patch the contractor's plan. Chunking, retries and a
progress bar make it fail more slowly; they don't change that it recomputes three years
of chain state in a phone browser on every page load, and they don't get you sale
prices or timestamps at all.

**On "we don't need extra infrastructure":** that's the claim to reject. There is no
architecture here that serves this screen quickly with zero infrastructure. The real
choice is whether you rent someone else's index (Option A — cheapest, needs a proxy and
a cache) or run your own (Option B — needs Postgres, a persistent worker, a paid RPC
plan, and monitoring). "No infrastructure" isn't on the menu; it just relocates the
cost onto every visitor's device and your provider bill.

---

### Numbers used, so you can check them

- Blocks/year at 12s: `365×24×3600÷12 ≈ 2,628,000`
- Three-year-old contract → deploy block ≈ `25,800,000 − 7,884,000 ≈ 17,900,000`
- Chunks from 0 at 10k: `25,800,000 ÷ 10,000 = 2,580`
- Chunks from deploy at 10k: `7,884,000 ÷ 10,000 ≈ 790`
- CU at 75/call: `2,580 × 75 ≈ 193,500` per page load
- Serial latency at 300ms: `2,580 × 0.3s ≈ 13 minutes`
- Payload: transfer count (~150k) is an estimate for a traded 10k collection over three
  years; substitute your real number, but the order of magnitude drives the conclusion.
