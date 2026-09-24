# Sanity check: "eth_getLogs from block 0 in the browser"

Short version: the plan doesn't work, and it doesn't fail gracefully — it fails as a
half-loaded feed that looks fine to the developer on a fast laptop and is wrong for
users. The sentence "it's all standard RPC, so we don't need extra infrastructure" is
where it goes wrong: historical onchain data comes from an indexer, never from a scan
at request time. Below is the arithmetic, the failure order, and what to build.

---

## 1. How many RPC requests that one page load actually becomes

The contractor's mental model is "one `eth_getLogs` call." No provider will serve that
call. Every hosted RPC caps `eth_getLogs` two independent ways, and **both** caps force
splitting:

- **A block-span cap.** You may only ask about N blocks per call.
- **A matched-log cap.** Even inside an allowed span, if the filter matches more than
  ~10,000 logs the call is rejected and you must split that span further.

So the request count is `total_blocks / window_size`, plus extra splits wherever the
collection was busy. With chain head at **block 25,800,000** and `fromBlock: 0`:

| Provider's block-span cap | Requests for one page load |
|---|---|
| 10,000 blocks (Infura-class, paid tiers) | **~2,580** |
| 2,000 blocks (common mid tier) | **~12,900** |
| 1,000 blocks (typical free/public endpoint) | **~25,800** |
| 5–10 blocks (some free tiers' getLogs cap) | 2.5M+ — not a real option |

**~2,600 requests is the best realistic case, ~26,000 the likely one.** Then add the
log-cap splits: a 10k-supply collection's mint window and any big airdrop or sweep will
blow past 10,000 Transfer logs inside a single 10k-block window, so those windows get
recursively halved. Call it a few hundred extra calls. A correct client also has to
*implement* that recursive halving — the contractor's plan has no such code, so today it
just throws.

Three more things make the number worse than it looks:

- **~1,790 of those calls are guaranteed empty.** The contract is ~3 years old. At ~12s
  blocks that's ~7.9M blocks, so it was deployed around **block 17,900,000**. Scanning
  from 0 spends ~69% of the requests on prehistory where the contract did not exist.
- **It grows forever.** ~2.63M new blocks per year = **+263 requests/year** at a 10k
  window, **+2,630/year** at 1k. This page load gets monotonically slower with no code
  change, which is exactly the shape of bug that ships fine and pages you in month five.
- **It's per user, per page load, per refresh.** Nothing is shared or cached. 100
  concurrent visitors = ~260,000 RPC calls.

**Wall-clock and bandwidth.** Browsers allow ~6 concurrent connections per host. At
~250ms per call and 2,580 calls: `2580 / 6 × 0.25s ≈ 108 seconds` — and that's assuming
you're never throttled, which you will be. Under a typical free-tier compute-unit budget
(`eth_getLogs` is one of the most expensive methods; ~4–5 such calls/sec sustained),
2,580 calls is **~9–11 minutes**; 25,800 calls is over an hour. Payload-wise, a 3-year
collection plausibly has 100k–200k Transfer logs; at ~700–900 bytes of JSON each that's
**~100–150 MB downloaded into a phone browser** to render 50 rows of feed.

---

## 2. What breaks first, in order

1. **HTTP 429 / compute-unit exhaustion, partway through.** This is the first failure and
   the nastiest, because the natural `catch` is "stop and render what we have." The feed
   renders, the holder panel renders, and **both are silently wrong** — a dropped window
   means missing transfers, which means permanently wrong balances downstream. Wrong-but-
   confident beats an error page in the worst way.
2. **A hard provider error on the first call**, before anything renders: `query returned
   more than 10000 results` or `block range too large`. The plan has no adaptive
   splitting, so on many providers the page is blank on day one.
3. **The provider key is public.** It ships in client JS. Anyone can read it, and this
   is a key doing 2,600+ expensive calls per visitor. You will burn the month's credits
   in days, and it will get scraped and reused.
4. **Browser memory.** 150k logs decoded into JS objects plus a balance map is hundreds
   of MB of heap. Mobile Safari kills the tab.
5. **A correctness gap that never breaks loudly:** *Transfer logs alone cannot give you
   the "sale" half of the feed.* `Transfer` tells you `from`, `to`, `tokenId`. It does not
   tell you whether ETH changed hands or how much. A sale on Seaport, Blur, or any
   marketplace emits a plain `Transfer` that is indistinguishable from a friend-to-friend
   move. To label a row "sold for 1.4 ETH" you must also index the marketplace's own
   events (Seaport `OrderFulfilled`, etc.) and join them by transaction hash. Mints are
   the only one you get for free: `from == 0x0`. Also confirm the standard — if this is
   ERC-1155 the events are `TransferSingle`/`TransferBatch` and there is no `Transfer`
   at all.

---

## 3. What to build instead

### The shape

**Backfill once into a persistent store, then tail the head.** One process, run by you,
reads the contract's history from its deploy block (~17.9M, *not* 0) into a database,
keeps a materialized `holders` table up to date as it goes, and then follows new blocks
as they arrive. The browser never scans anything; it makes **one** query and gets back
exactly the 50 rows it renders.

- **Feed:** `SELECT ... ORDER BY (block_number, log_index) DESC LIMIT 50`, keyset-paginated
  on that same cursor. One request, tens of milliseconds, constant cost forever.
- **Top holders:** keep a `holders(address, balance)` row updated on every transfer
  (`-1` from, `+1` to, skip the zero address). The panel is
  `SELECT address, balance FROM holders WHERE balance > 0 ORDER BY balance DESC LIMIT 100`.
  One request.

Note why the holder panel genuinely needs the index: there is no RPC that enumerates a
collection's holders. `ERC721Enumerable` is rarely deployed and too expensive to walk
anyway. The *set* of holders is only derivable from transfer history — so it belongs in
the index.

But the *balances themselves* are current state, and current state is a direct contract
call, not indexing work. Once you have the ~top 100 addresses from the index, you can
verify their live balances with a **single batched `balanceOf` call through Multicall3**
(`0xcA11bde05977b3631167028862bE2a173976CA11`, same address on most chains). That's a
good reorg/drift guard on the panel, and it's one RPC request, not a hundred. Don't
build an indexer for a number the chain will hand you on request — but do use the
indexer for the list of *which* numbers to ask for.

### Three concrete options

| Option | What you operate | Good when |
|---|---|---|
| **Provider NFT/transfers API** (Alchemy, QuickNode, Reservoir) | Nothing. An API key. | Fastest path to a working demo. Transfers and holder lists are pre-indexed. Ceiling: you get their schema, and custom sale-price joins are limited. |
| **Subgraph (The Graph)** | Subgraph source + a Studio API key | You want a hosted, declarative index and a GraphQL API with no servers. |
| **Ponder (self-hosted)** | A host, a Postgres, and process supervision | You want full control, a SQL store, and custom logic across marketplace events. |

**My recommendation:** start on a provider transfers API to unblock the frontend this
week, and build the subgraph or Ponder index in parallel — because the sale-price
enrichment (joining `Transfer` to Seaport `OrderFulfilled` by tx hash) is the part no
off-the-shelf API will shape the way your feed wants.

### The infrastructure you don't have yet — naming it

This is the decision that silently stays open and leaves you with a read side that only
ever ran on a laptop. So, explicitly:

- **If you go The Graph:** `graph deploy` puts the subgraph in **Subgraph Studio, which
  is testing only**. It is not a production endpoint. You must **publish** it from Studio
  to the network to get a production URL, then query it with a Studio API key. The old
  free hosted service **was sunset in June 2024** — there is no free public place to
  deploy to. Production queries are metered: roughly **100K queries/month free, then
  ~$2 per 100K** (that figure was checked 2026-08-18 — re-read the live pricing page
  before you put a number in a budget). Also budget signalled GRT to publish.
- **If you go Ponder or a self-hosted Graph Node:** you need a **host** (Railway/Fly/ECS),
  a **persistent Postgres** with backups, **process supervision + restart on crash**, and
  **monitoring on indexing lag**. None of these exist in the current plan. An indexer that
  falls behind and doesn't alert is a feed that quietly stops updating.
- **Either way:** an **archive-capable RPC endpoint** for the one-time backfill (a
  pruned node can't serve 3-year-old logs), and a **server-side secret** for that key —
  not the browser.

One design note for whatever the team ships next: **design contracts event-first.** Any
state change that doesn't emit an event is invisible to every indexer, frontend, and
explorer — it cannot be recovered later. Keep ranking, aggregation, and pagination
offchain; if a result must be committed onchain, store a hash of it.

---

## Summary

| | Contractor's plan | Proposed |
|---|---|---|
| RPC calls per page load | ~2,600 best case, ~26,000 typical, growing ~263–2,630/yr | 1 (+1 Multicall3) |
| Time to first render | 2 min best case, 10+ min realistic | < 200 ms |
| Bytes to the client | ~100–150 MB | ~50 KB |
| Cost scaling | per user, per refresh, forever | backfill once, tail cheaply |
| Failure mode | silent partial data → wrong balances | loud, on your monitoring |
| Sale prices in feed | impossible from `Transfer` alone | marketplace events joined by tx hash |
