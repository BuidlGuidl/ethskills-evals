# Sanity check: the "scan Transfer logs in the browser" plan

Short version: the plan does not work, and it does not fail gracefully — it fails on
the very first call, and every workaround for that failure makes it worse. Historical
onchain data comes from an indexer, not from a scan performed at request time. Below
is the concrete arithmetic, the failure order, and what to build instead.

---

## 1. The single call in the plan does not exist

> "the client calls `eth_getLogs` ... from block 0 to latest, gets the full history back"

No production RPC provider will answer that. Every one of them caps `eth_getLogs`
along **two independent axes**:

| Cap | Typical limit | What happens when you exceed it |
|---|---|---|
| **Block span** per call | 10,000 blocks (Infura, QuickNode, Ankr); 500–2,000 on many free/public endpoints | `"query returned more than X blocks"` / `-32602` |
| **Matched logs** per response | 10,000 logs, or a response-size ceiling (~150 MB on Alchemy) | `"query returned more than 10000 results"` — often with a suggested narrower range |
| **Wall-clock** | 10–30 s per request | timeout / 504 |

So `fromBlock: 0, toBlock: "latest"` returns an error, not history. The plan's premise
— one call, full history — is off by three to four orders of magnitude before anything
else is considered.

## 2. What it turns into once you paginate: ~2,600 to ~26,000 requests per page load

The only way to satisfy the block-span cap is to loop in windows. That converts one
conceptual call into `25,800,000 / window_size` calls:

| Provider window | Requests per page load |
|---|---|
| 10,000 blocks (paid Infura/QuickNode/Ankr) | **2,580** |
| 2,000 blocks (common for wide filters) | **12,900** |
| 1,000 blocks (many free tiers) | **25,800** |
| 500 blocks (public/community endpoints) | **51,600** |

Then add the **log-count cap on top of the span cap**. These two caps are not the same
constraint. A 10,000-block window is fine across quiet stretches of 2022, but around
the mint and around marketplace activity spikes a single 10k window can contain far
more than 10,000 Transfer logs. Each of those windows errors and has to be bisected —
recursively — so the real count is the table above **plus roughly 5–15% of retry/split
calls** concentrated exactly where your collection was busiest.

Two properties of that number matter more than its size:

- **It is per page load, per visitor.** Nothing is shared. Ten people opening the feed
  is ~26,000 requests. A crawler or an open tab that re-mounts is the same again.
- **It grows forever.** Ethereum produces ~2,628,000 blocks/year at 12 s. At a 10k
  window that is **+263 requests per page load per year**, permanently, with no
  corresponding product benefit. At a 1k window it is +2,628/year. The plan gets
  strictly worse every single day it is deployed, which is the signature of a scan-at-
  request-time design.

**Latency.** Even at a generous 10 concurrent requests/second, 2,580 calls is ~4.3
minutes. Done sequentially at 150–300 ms round trip it is 6–13 minutes. Users see a
spinner for the length of a coffee break — and that is the *happy path*, before any
retry backoff.

**Cost/credits.** Providers meter `eth_getLogs` heavily (Alchemy prices it in the
~75 compute-unit range). 2,580 × 75 ≈ **~194,000 CU for one page view**. A free tier in
the low hundreds of millions of CU/month is exhausted by roughly **1,500 page views —
total, for the month, across all users**. Treat these unit numbers as illustrative and
re-read the provider's live pricing page before you budget; the order of magnitude is
the point, not the decimal.

**Payload.** A three-year collection realistically has 100k–300k Transfer logs. At
~300–400 bytes of JSON each that is **40–100+ MB** streamed into the browser, parsed
into JS objects (several times that in heap), to render a list of 50 rows. Mobile
Safari will kill the tab.

**Key exposure.** "Any provider key works" means the key ships in client-side JS.
Anyone can read it and spend your quota. This is true of any browser-side RPC, but the
plan's request volume makes the quota worth stealing.

## 3. What breaks first, in order

1. **Immediately, on day one, in dev:** the `fromBlock: 0` call returns a range error.
   The contractor discovers the caps and adds a pagination loop. The plan as written
   never runs.
2. **First real page load:** HTTP **429 rate limiting**. Free and standard tiers allow
   on the order of 5–25 requests/second; a 2,580-call burst trips it in the first
   second. Naive retry-with-backoff turns a 4-minute load into a 15-minute one, and
   the loop is now firing retries at a provider that is actively throttling you.
3. **Within the first day or two:** **credit/quota exhaustion.** Per §2, ~1,500 page
   views drains a typical free monthly allowance. Then *every* user gets an empty feed,
   including you, and it stays broken until the next billing cycle or an upgrade.
4. **On any device that gets that far:** **browser OOM / main-thread freeze** parsing
   tens of MB of logs and reducing them into a holder map.
5. **Quietly, the whole time — and this is the one that survives all the "fixes":
   the data is wrong.**
   - **`Transfer` cannot tell you a sale happened, and carries no price.** ERC-721
     `Transfer(from, to, tokenId)` is emitted identically for a gift, a wallet
     migration, and a 40 ETH Seaport fill. The "sale" column in your feed cannot be
     built from this event at all. You need marketplace events (e.g. Seaport
     `OrderFulfilled`) correlated to the same transaction hash, or an NFT-sales API.
     This is a scope gap in the plan, not just a performance problem.
   - **Reorgs.** A browser-side scan has no state and no reversion path; it just shows
     whatever the node said, including logs from blocks that get reorged out.
   - If the collection is ERC-1155, `Transfer` is the wrong event entirely
     (`TransferSingle` / `TransferBatch`, with amounts).

## 4. What to build instead

### 4a. The activity feed → an indexer, backfilled once, then tailing

Do the historical scan **exactly once, server-side, ever** — into a persistent store
that then follows the chain head. The client asks for the page it is showing, and
nothing more.

The feed query becomes one request returning 50 rows, in tens of milliseconds, with
cursor pagination for scroll:

```graphql
{
  transfers(first: 50, orderBy: blockTimestamp, orderDirection: desc) {
    id from to tokenId blockTimestamp transactionHash
    sale { priceWei currency marketplace }   # joined from Seaport OrderFulfilled
  }
}
```

Two realistic implementations:

- **A subgraph (The Graph).** `Transfer` handler writes a `Transfer` entity; a second
  data source on Seaport, filtered to your collection, writes `Sale` entities that the
  transfer handler joins on transaction hash.
- **Ponder** (TypeScript, Postgres). Same event handlers, but you own the process and
  the database, and you get plain SQL for the ranking query.

Either one does the ~2,580-call backfill once, on a server, over a few minutes, and
then only processes new blocks. Note what changed: the loop still exists — it just runs
**once in your infrastructure** instead of once **per visitor, forever**.

### 4b. The top-holders panel → this is *current state*, and may need no indexer at all

Worth separating clearly, because it is the part most likely to be over-engineered.
"How many tokens does this wallet hold *right now*" is a value the chain returns on
request. You do not need three years of history to compute it, and you should not
build an indexer for a number the contract will just tell you.

- **If the collection is a bounded ERC-721 (say 10k tokens):** call `ownerOf(tokenId)`
  for every token and tally. Batch them through **Multicall3**
  (`0xcA11bde05977b3631167028862bE2a173976CA11`, same address on most chains) at ~500–
  1,000 calls per batch: **~10–20 RPC requests total**, exact, no infrastructure, no
  staleness. Cache the result server-side for a minute or two and the panel is
  effectively free.
- **If the collection is unbounded or very large**, keep a `Holder { address, balance }`
  entity in the indexer you already built in §4a, incremented/decremented on each
  Transfer (`from == 0x0` is a mint, `to == 0x0` is a burn — exclude the zero address
  and any burn address from the ranking). Then the panel is
  `holders(first: 100, orderBy: balance, orderDirection: desc)` — one query.

Either way, ranking and pagination stay offchain. Both approaches are cheap; pick based
on collection size, and use the Multicall3 tally as a periodic correctness check against
the indexed balances regardless.

### 4c. Resulting page load

| | Contractor's plan | Proposed |
|---|---|---|
| RPC/API requests per page load | ~2,580–26,000 (+263/yr) | **2** (feed + holders) |
| Time to first render | 4–13 min | < 500 ms |
| Data to browser | 40–100+ MB | ~30 KB |
| Sale prices | not obtainable | yes, via Seaport events |
| Cost scaling | per visitor, growing forever | per query, flat |

## 5. Infrastructure you do not have yet — naming it explicitly

This is the part that usually stays vague until launch week, so, concretely, **where
this runs in production**:

**Option A — The Graph (managed).** Least to operate.
- `graph init` → `codegen`/`build` → `graph auth <deploy-key>` → `graph deploy <slug>`.
  That puts it in **Subgraph Studio, which is for testing only**. The free hosted
  service was sunset in June 2024 — **there is no free public endpoint to deploy to.**
- **Deploying is not publishing.** You must *publish* the subgraph from Studio to the
  network to get the production endpoint, and query it with a Studio API key.
- Production queries are metered: roughly **100K free queries/month, then ~$2 per
  100K** (figure checked 2026-08-18 — re-read the live pricing page before committing
  to a budget). At 2 queries per page load, ~100K free ≈ **50,000 page views/month**.
- Publishing requires a wallet with some ETH/GRT for the on-network transaction and
  signal.

**Option B — Self-hosted Ponder (or your own Graph Node).** More control, more to own.
Then *you* name: a host for a long-running process (Railway / Fly.io / Render / ECS), a
**persistent Postgres** (Neon / RDS / Supabase), process supervision and restart-on-
crash, and alerting on **indexer lag** (indexed head vs. chain head — this is the metric
that tells you the feed has silently gone stale).

**Needed in both cases:**
- An **archive-capable RPC endpoint** for the one-time backfill (server-side only).
- A **thin server-side proxy** for the API key, so it is not in client JS — this also
  gives you a natural HTTP cache layer for the top-holders panel.
- If you go the Multicall3 route for holders (§4b), that proxy plus a short cache is
  the *entire* infrastructure for that panel.

**Option C — a provider NFT/data API** (Alchemy NFT API, Reservoir, and similar) as a
stopgap: transfers, sales and owner lists as ready-made endpoints, no infrastructure at
all. Fastest path to a working screen; the tradeoffs are vendor lock-in, per-call
pricing, and no control over the schema. Reasonable for launch, with §4a as the plan of
record if the product sticks.

**Recommendation:** Option A for the feed and sales, Multicall3-behind-a-cache for the
top-holders panel. That gets you a sub-second page, one managed dependency, and no
long-running process to babysit.

---

## 6. The general rule worth taking from this

The contractor's instinct — "it's all standard RPC, so we don't need extra
infrastructure" — is the specific mistake. Standard RPC is designed to answer
*"what is true right now"* (`ownerOf`, `balanceOf` — batch these with Multicall3) and
*"what happened in this recent block range"*. It is not a historical database, and
`eth_getLogs` with a wide range is not a query engine; it is a paginated cursor with
hard caps that you are expected to drive from a server, once.

Any read of the past — a feed, a leaderboard, a chart, a streak, a "since inception"
anything — comes out of an indexed store that was backfilled once and now tails the
head. Rebuilding past state from archive-node reads at request time is the same mistake
wearing a different hat. And the read side is not designed until its production home is
named — which is why §5 exists, and why it should be answered before anyone writes a
handler.

**One thing to confirm before building:** is the collection ERC-721 or ERC-1155? It
changes the events (`Transfer` vs `TransferSingle`/`TransferBatch`), and it decides
whether the Multicall3 shortcut in §4b is available for the holders panel.
