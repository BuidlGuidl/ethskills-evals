# Sanity check: "eth_getLogs from block 0 in the browser"

Short version: the plan doesn't work, and it doesn't fail gracefully. It is not
one RPC call — it is thousands, it gets slower every week, and the part it
*would* be fine for (the holder panel) doesn't need logs at all.

---

## 1. How many requests that one page load actually becomes

The contractor's mental model is that `eth_getLogs(fromBlock: 0, toBlock: "latest")`
is a single request. No provider will serve that. Every public/commercial RPC caps
`eth_getLogs` two independent ways, and **both** caps force pagination:

| Cap | Typical value | What it forces |
|---|---|---|
| Block span per call | 2,000–10,000 blocks (provider-dependent; some are 100 for unfiltered queries) | A fixed number of calls proportional to chain height |
| Matched logs per response | ~10,000 logs | Extra recursive splitting wherever activity is dense |
| Wall-clock per call | ~10–30s server-side timeout | Wide/dense ranges fail rather than return |

### The floor: block-span pagination

At chain height ~25,800,000, scanning from block 0:

- **10,000-block window** → 25,800,000 / 10,000 = **~2,580 requests**
- **2,000-block window** → **~12,900 requests**
- **500-block window** (what you drop to after the first few 429s) → **~51,600 requests**

That is the *floor*, assuming every call succeeds on the first try. Note what
drives it: **chain height, not your collection's activity.** Roughly 18 million of
those blocks predate your contract and return `[]` — you pay full latency for
~70% of the scan to learn nothing. And the number grows ~2.6M blocks/year (~260
extra calls/year at a 10k window) forever, with no code change on your side.

### The multiplier: log-count pagination

The 10,000-logs-per-response cap bites exactly where your data is. A 3-year-old
collection's mint is typically tens of thousands of `Transfer` events compressed
into a handful of blocks. A 10,000-block window spanning the mint blows the log
cap, the provider errors, and a correct client has to bisect that window — 2, 4,
8 sub-calls — until each piece fits. Same story for any listing-driven volume
spike. Realistically add **10–30%** on top of the floor.

### What it costs in wall time and bytes

- **Serial**, at ~250ms round-trip: 2,580 × 0.25s ≈ **11 minutes** of blank screen
  in the best case; ~54 minutes at a 2,000-block window.
- **Parallel** (say 20 in flight): you hit the provider's compute-units-per-second
  ceiling within seconds and start collecting `429`s. `eth_getLogs` is one of the
  most expensive methods in every provider's CU table — a wide-range call can be
  50–100× the cost of an `eth_call`. Parallelizing makes you fail *faster*, not
  finish faster.
- **Payload**: a 10k-supply collection with 3 years of mints, sales and transfers
  is on the order of 10^5–10^6 `Transfer` logs. At ~500–700 bytes of JSON-RPC log
  per event that is **hundreds of megabytes** pushed into a browser tab, then
  parsed, then reduced in JS. Mobile Safari kills the tab well before this.

### The credit bill

Every visitor re-runs the entire scan — no shared cache, no incremental state.
A few hundred page loads a day against a metered provider will exhaust a normal
monthly quota in hours. And since the key ships in the frontend bundle, it's
public: anyone can point a loop at it.

---

## 2. What specifically breaks first, in order

1. **Rate limiting (day one, every user).** Your CU/s ceiling trips a few seconds
   in. You get partial results and no error — the feed silently renders a
   *truncated, wrong* history, and the holder ranking computed from it is wrong in
   a way nobody notices until a holder complains their token is missing.
2. **Provider hard caps.** "query returned more than 10000 results" / "block range
   too large" on the mint window, unless you've written bisection logic the plan
   doesn't mention.
3. **Browser memory.** Tab OOM on mobile and low-RAM desktops.
4. **Credit exhaustion.** Quota gone mid-month; the site is down for everyone.
5. **Time decay.** Even if you tuned it into working today, request count rises
   with chain height. It degrades on its own schedule with no deploy.

The underlying mistake: **historical onchain data comes from an indexer, never
from a scan at request time.** A full-history scan at page load is a backfill —
a job that should run once, server-side, into a database — being re-executed by
every visitor on the critical path of the first paint.

Same trap in another shape: "just use an archive node and read past state." That's
the identical cost with a different method name.

---

## 3. What to build instead

The two panels have genuinely different needs. Splitting them is most of the win.

### Activity feed → indexer (backfill once, then tail)

One-time backfill of `Transfer` (plus marketplace `OrderFulfilled`-type events if
you want real sale prices rather than bare transfers) into a persistent store,
which then follows the chain head. The frontend queries *your* endpoint with
`orderBy: blockNumber desc, limit 50` and a cursor — one request, tens of
milliseconds, constant cost forever regardless of chain height.

Pick one:

- **Subgraph (The Graph).** Least infra to run. Important and often missed:
  **deploying is not publishing.** `graph deploy` puts you in Subgraph Studio,
  which is for testing only — the free hosted service was sunset in June 2024, so
  there is no free public endpoint. You must **publish from Studio to the network**
  to get a production endpoint, then query it with a Studio API key. Metered:
  ~100K queries/month free, then ~$2 per 100K (figures as of 2026-08; re-check the
  live pricing page before you budget). Backfilling ~7.7M blocks takes hours to a
  day — start it well before launch.
- **Ponder.** TypeScript indexer, Postgres store. More control, and you own the
  host and the database.
- **A provider NFT/transfers data API.** Fastest path to a working feed; you're
  renting someone else's index and their schema.

### Top holders → direct contract reads, not an index

This is the part worth correcting explicitly: **current state is not indexing
work.** "How many tokens does this wallet hold *right now*" is what
`balanceOf`/`ownerOf` return on request. Don't build or operate a subgraph to
track a number the chain will hand you.

For a bounded-supply ERC-721 (say 10,000 tokens), batch `ownerOf(tokenId)` for
every id through **Multicall3** (`0xcA11bde05977b3631167028862bE2a173976CA11`,
same address on most chains) at ~500–1,000 calls per batch: **~10–20 RPC
requests** for a complete, exact ownership snapshot. Tally in memory, sort, cache
for a minute or two. Done — no indexer involved.

Caveat: this is O(supply), so if the collection is ERC-1155 or has an unbounded /
very large supply, drop that route and maintain a running balance table in the
same indexer that powers the feed (it already sees every `Transfer`; incrementing
a counter is nearly free). Either way, the holder panel should not be derived
from a client-side log scan.

### Request count, after

| | Contractor's plan | Proposed |
|---|---|---|
| Feed (first page) | ~2,580–12,900+ RPC calls | 1 query to your endpoint |
| Holder panel | same scan, reduced in JS | ~10–20 Multicall3 calls (or 1 indexer query) |
| Page load time | 11+ min, usually fails | sub-second |
| Cost per visitor | full re-scan | ~1 cached query |
| Growth over time | +260 calls/year, forever | flat |

---

## 4. Infrastructure you don't have yet — saying so plainly

The contractor's "we don't need extra infrastructure" is the claim that doesn't
survive. You need, and should budget for:

1. **A production home for the indexer, named now.** The single decision that
   silently stays open and leaves you with a read side that only ever ran on a
   laptop. Write it down next to the architecture: either "published subgraph on
   The Graph network, queried with Studio API key `<x>`, owned by `<person>`", or
   "Ponder on `<Railway/Fly/ECS>`, Postgres at `<host>`, deployed by `<command>`,
   restarted by `<supervisor>`."
2. **A persistent store** (Postgres, or The Graph's, if you go that route).
3. **A backfill window before launch** — hours to a day for ~7.7M blocks. Not a
   launch-day task.
4. **A thin server-side layer** for the holder snapshot, so the RPC key stops
   shipping in the frontend bundle and the multicall result is cached across
   visitors rather than recomputed per tab.
5. **Reorg handling and head-lag monitoring.** Subgraphs and Ponder give you the
   first; you still need an alert for "indexer fell behind / stopped," because the
   failure mode is a feed that quietly goes stale rather than one that errors.

### One thing to check on the contract side

If any state change you want to display doesn't emit an event, it is invisible to
every indexer, frontend and explorer — there is no recovering it later. Standard
`Transfer` covers mints, sales and transfers, so a vanilla ERC-721 is fine here.
But if the collection has staking, burns-to-redeem, or metadata locks you plan to
surface, confirm each emits an event before you design the feed around it. And
keep the ranking, aggregation and pagination offchain; if a result ever has to be
committed onchain, store a hash of it, not the list.

---

## Recommendation

Approve the frontend work, reject the data plan. Build the feed on a published
subgraph (or Ponder, if you'd rather own the box), build the holder panel on a
cached Multicall3 `ownerOf` sweep, and name the indexer's production host before
anyone writes a line of it.
