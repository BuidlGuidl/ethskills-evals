# Sanity check: the "eth_getLogs from block 0" plan

Short version: the plan does not ship. Not "is slow and we optimize later" — the
first RPC call it makes is rejected by every mainstream provider, and the
workaround the contractor will reach for turns one page load into thousands of
requests that get slower every single day. Historical onchain data comes from an
indexer, never from a scan at request time.

Below: the concrete request count and what forces it, the failure order in
production, and what to build instead.

---

## 1. What that one page load actually becomes

### The plan's own numbers

Assume the collection deployed ~3 years ago. At 12s blocks that is
`3 × 365 × 24 × 3600 / 12 ≈ 7,884,000` blocks, so the contract went live around
block **17,900,000**. The plan scans from block 0 to 25,800,000 — **25.8M
blocks**, of which the first ~17.9M are before the contract existed. That waste
is real but it is not the problem; fixing it changes the numbers by ~30% and
changes nothing else.

### Force #1: the block-span cap

No provider will serve `fromBlock: 0, toBlock: latest`. The request comes back as
`query returned more than 10000 results` or `block range is too large` before any
data is transferred. Providers cap the span per `eth_getLogs` call, and the cap
varies by provider and tier — commonly 10,000 blocks, often 2,000 or 5,000 on
shared/free tiers, and some public endpoints are stricter still.

So the contractor paginates. That is where the request count comes from:

| Per-call span cap | Calls for 25.8M blocks (block 0) | Calls from deploy block (7.9M) |
|---|---|---|
| 10,000 blocks | **2,580** | 789 |
| 5,000 blocks | **5,160** | 1,578 |
| 2,000 blocks | **12,900** | 3,942 |

**One page load = roughly 2,600 requests on a generous tier, ~13,000 on a common
one.** Per visitor. Every refresh.

### Force #2: the matched-log cap, which subdivides further

The span cap is not the only ceiling. Providers also cap the number of logs in a
single response (10,000 is the typical limit). Transfer traffic is not spread
evenly — it is spiky. The mint window, a listing on a major marketplace, an
airdrop claim: those windows blow past the log cap inside a single legal block
span, and the only fix is to split that window and retry, recursively, until each
slice fits. Every split is an extra round trip on top of the table above, and
they cluster exactly where the interesting history is.

For a 10k-piece collection with three years of secondary trading you are looking
at roughly 50,000–150,000 Transfer events total. The dense stretches are what
force the subdivision.

### Force #3: it grows, permanently

Mainnet adds ~7,200 blocks/day. At a 10k-block cap that is **+263 calls per
year**, forever; at a 2k cap, **+1,300 per year**. This is an architecture whose
page-load cost is a function of chain age. It is worse tomorrow than today and
there is no version of it that stops getting worse.

### Force #4: multiply by traffic

At 1,000 visitors/day and 2,600 calls each, that is **2.6M RPC calls per day**
from a page that renders one screen.

Cost, concretely: Alchemy prices `eth_getLogs` at 75 compute units. 2,580 calls ≈
**193,500 CU for a single page load**. Against a free tier in the 300M CU/month
range, that is roughly **1,500 page loads a month** before the key is exhausted —
one moderately good launch day. (Provider pricing and caps change; re-read the
live pricing page before you commit these figures to a budget.)

### And the payload

50k–150k log objects at ~600 bytes of JSON each is **30–90 MB shipped to the
browser** on every page load, then sorted and aggregated on the main thread.
On mobile that is the end of the session.

So: **"any provider key works and we don't need extra infrastructure" is
false in both halves.** No key makes this work, and the absence of
infrastructure is the reason the browser is being asked to do an indexer's job.

---

## 2. What breaks first, in order

1. **Immediately, in development — the unpaginated call is rejected.** The plan
   as literally written never returns data once. This is good news: it fails
   loudly on day one rather than silently in production.
2. **Rate limiting (HTTP 429).** Once paginated, 2,600 calls hit the per-second
   request cap. Serialized at ~10 rps that is 4+ minutes of loading spinner;
   parallelized, it is an instant 429 storm and a partial, silently-wrong
   history. This is the first *production* failure and the one that will
   actually page you.
3. **Timeouts and partial results.** Dense ranges time out server-side. Without
   careful retry-and-split, gaps appear in the feed — and a missing Transfer
   doesn't just drop a row, it corrupts every holder balance downstream of it,
   permanently and invisibly.
4. **The browser.** Memory pressure and main-thread jank from tens of MB of JSON;
   mobile Safari kills the tab.
5. **Credits/billing.** The key is exhausted or the invoice arrives.
6. **Correctness under reorgs.** Recent logs can be reorged out. A client-side
   replay has no mechanism to un-apply them, so the holder ranking drifts from
   truth with no way to notice.

### A spec gap the plan doesn't address at all

The feed is specified as "every mint, sale, and transfer." **The `Transfer` event
cannot tell you a sale happened, and carries no price.** `Transfer` gives you
`from`, `to`, `tokenId` — that's it. Mints (`from == 0x0`) and burns
(`to == 0x0`) are distinguishable; a sale looks exactly like a gift.

Labelling sales and showing prices requires correlating each transfer with
marketplace fills in the same transaction (Seaport `OrderFulfilled`, Blur, etc.)
or with the ETH/WETH value moved. That is unambiguously indexer work — it means
reading a second contract's events and joining on transaction hash, which is
precisely the thing a browser-side log scan cannot do. Whatever we build has to
account for it, and the current plan has no room for it.

---

## 3. What to build instead

The shape is fixed and it is not controversial: **one backfill into a persistent
indexed store, which then tails new blocks. The frontend reads that store.**

The backfill pays the multi-thousand-request cost **once, server-side, ever** —
not once per visitor. After that the indexer follows the chain head and stays
seconds behind. The frontend makes **two queries** on page load and gets both
panels in ~100ms:

- **Feed:** `transfers(first: 50, orderBy: blockNumber, orderDirection: desc)`,
  with cursor pagination for infinite scroll. Never load history you aren't
  showing.
- **Top holders:** `holders(first: 100, orderBy: balance, orderDirection: desc)`.

The critical part is that the ranking and the pagination happen **in the
indexer's store, against an index** — not in JavaScript over an array of 100,000
objects. Aggregation, ranking and pagination belong offchain and precomputed.

### Data model

- `Token` — tokenId, current owner, mint block.
- `Activity` — one row per Transfer: from, to, tokenId, block, timestamp, txHash,
  logIndex, plus a `kind` (`MINT` / `SALE` / `TRANSFER` / `BURN`) and an optional
  price, filled in by the marketplace-event correlation above. Sort key
  `(blockNumber, logIndex)` descending — that's the feed, already ordered.
- `Holder` — address, `balance` (incremented/decremented on each Transfer),
  first/last activity. **Maintain `balance` as a stored, indexed column.** The
  entire top-holders panel is then one indexed `ORDER BY balance DESC LIMIT 100`.

Handle ERC-1155 too if the collection is 1155 rather than 721 — that means
`TransferSingle` and `TransferBatch` with quantities, not just `Transfer`.

### Three viable options

| Option | Infra you own | Ship time | Notes |
|---|---|---|---|
| **Provider NFT/data API** (Alchemy NFT API, Reservoir) | none | ~a day | Fastest path. Sales and prices often already labelled. Vendor lock-in; less control over the exact feed shape. Good way to launch, and a fine permanent answer if the shape fits. |
| **Subgraph on The Graph** | none to host | ~a week | Standard for this. Custom schema, exactly the two queries above. |
| **Ponder (self-hosted)** | Postgres + a host | ~a week | TypeScript, most control, easiest place to do the marketplace-fill correlation. You own the operations. |

**My recommendation:** start on the provider data API to unblock the frontend
this week — it gets the feed and holders rendering against real data with zero
infrastructure — and build the subgraph or Ponder service in parallel if the
sale-labelling or the exact feed shape turns out not to fit. The frontend should
talk to a small internal data module either way, so swapping the source later is
a one-file change rather than a rewrite.

### One genuinely useful direct-contract read

Holder *balances* are current state, and current state is a contract call, not
indexing work. You don't need the indexer to tell you what an address holds
*right now* — `balanceOf` does. What you do need the indexer for is the **set of
addresses to ask about**, since there is no way to enumerate holders from the
contract.

So if you want the top-holders panel exact to the current block, take the top
~200 candidate addresses from the index and batch their `balanceOf` calls through
**Multicall3** (`0xcA11bde05977b3631167028862bE2a173976CA11`, same address on
most chains) — that is **one RPC request**, not 200. Belt-and-braces against
indexer lag, and cheap.

Related: for a 10k collection you could get the holder panel *alone* with ~20
Multicall3 batches of `ownerOf(tokenId)` and no indexer at all. That is a real
stopgap if the feed slips. It does nothing for the activity feed, which is
history by definition.

---

## 4. Infrastructure we don't have yet — being explicit

You asked, so: **yes, all three options need something we don't currently have.**
The read side is not designed until its production home is named, and this is the
decision that quietly stays open until you discover the indexer only ever ran on
the contractor's laptop. Name it in the architecture doc, now.

**If we go with a subgraph:**
- `graph deploy` puts it in **Subgraph Studio, which is testing only** — it is
  not a production endpoint. You must then **publish** the subgraph to the
  network to get one. Deploying is not publishing, and these are routinely
  confused.
- The **free hosted service is gone** (sunset June 2024). There is no free public
  endpoint to deploy to. Anyone assuming otherwise is working from stale docs.
- Production queries are **metered**: roughly 100K free per month, then about $2
  per 100K (checked 2026-08-18 — re-read the live pricing page before quoting a
  budget). At 2 queries per page load, 100K covers ~50K page loads/month. Cheap,
  but it is a line item and it needs an owner.
- Needs a **Studio API key**. Don't ship it raw in the frontend bundle —
  domain-restrict it, or front it with a thin proxy route.
- Publishing requires signing a transaction and some GRT. Someone needs a funded
  wallet for it.

**If we go with Ponder (or self-hosted Graph Node):**
- A **host** for the process (Railway, Fly, ECS — pick one and write it down).
- A **managed Postgres** instance with backups.
- **Process supervision** — restart on crash, and alerting when it dies.
- **Indexing-lag monitoring**: alert when head-block freshness exceeds ~1 minute.
  A silently-stalled indexer serves a plausible-looking stale feed, which is
  worse than an error page.
- An **archive-capable RPC key** for the backfill (the backfill still does the
  thousands of paginated calls — once).

**If we go with a provider data API:**
- Just an API key and a proxy route to keep it off the client. This is the "no
  new infrastructure" option, which is why it's my pick for launch.

**In all cases:**
- A **redeploy/reindex runbook**. Changing the schema means re-running the
  backfill; know how long that takes (hours) before you need it at 2am.

---

## 5. One forward-looking note

If we control the collection's contract or ship companion contracts later:
design them **event-first**. Every state change must emit an event carrying what
the read side needs. A state change with no event is invisible to every indexer,
frontend and explorer — permanently, and un-fixably without a migration. The
sale-price gap in section 2 is exactly this problem inherited from a contract
written without the read side in mind.

---

## Summary

| | Contractor's plan | What to build |
|---|---|---|
| RPC calls per page load | ~2,600–13,000 | **2** |
| Data to browser | 30–90 MB | ~50 KB |
| Load time | minutes, or never | ~100ms |
| Cost per 1k visitors | key exhausted | fractions of a cent |
| Trend over time | worse every day | flat |
| Sale prices | impossible | supported |

The one thing the contractor got right is that this is standard RPC. That's the
problem: the standard RPC surface is not a query interface over history, and
`eth_getLogs` pagination limits exist specifically to stop people using it as
one.
