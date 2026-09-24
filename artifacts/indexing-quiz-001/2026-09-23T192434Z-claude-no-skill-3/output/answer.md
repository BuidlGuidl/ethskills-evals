# Sanity check: "one `eth_getLogs` from block 0 to latest, compute in the browser"

Short version: the plan does not degrade in production — it fails on the first
request, on every provider, on day one. The sentence that makes it unworkable is
"from block 0 to latest." No public JSON-RPC provider will answer that query, and
the patch every team reaches for next (chunk the range) turns one page load into
roughly **5,000–15,000 RPC requests and 100+ MB of JSON, per visitor**. The
"no extra infrastructure" claim is the part to push back on: you do need an
indexer, and the only real choice is whether you rent one or run one.

Below is the reasoning, then what to build.

---

## 1. Why the single request can't work

`eth_getLogs` is not a database query. Providers cap it in two independent ways,
and you hit both:

| Provider | Block-range cap | Result cap |
|---|---|---|
| Alchemy | ~2,000 blocks (unbounded result size) *or* any range with ≤10,000 logs | 10,000 logs |
| Infura | ~10,000 blocks | 10,000 results (`-32005`) |
| QuickNode | ~10,000 blocks | 10,000 logs / 5s query timeout |
| Self-hosted Geth/Reth | configurable, but unbounded queries OOM the node | — |

`fromBlock: 0, toBlock: latest` is 25.8M blocks and (for a traded collection)
hundreds of thousands of logs. It violates every row of that table
simultaneously. What the browser actually receives is an error like
`-32005 query returned more than 10000 results` or `-32602 block range too
large`, in a few hundred milliseconds. The feed renders empty. There is no
provider key that unlocks this — it isn't a plan tier, it's a structural limit
that exists because the node has to scan bloom filters block by block.

**Requests for the plan as literally written: 1, and it returns an error.**

## 2. What the obvious patch costs

The contractor's next move will be to loop over fixed windows. Now the arithmetic:

**Block-range chunking.** At Alchemy's 2,000-block window:

```
25,800,000 / 2,000 = 12,900 requests
```

At Infura/QuickNode's 10,000-block window: **2,580 requests**. If you're on a
provider or plan with a 500-block cap (several are), it's **51,600**.

**Most of that scan is over empty space.** Ethereum produces ~7,200 blocks/day
(12s slots), so three years ≈ **7.9M blocks**. The contract was deployed around
block **17,900,000**. Blocks 0–17.9M contain zero logs for this address — that's
**69% of the scan, ~8,950 wasted requests at 2k windows**, each one making a node
walk bloom filters to return `[]`. Starting at the deploy block instead of 0
brings it to:

```
7,900,000 / 2,000 ≈ 3,950 requests
```

That is the *floor*, and it's still ~4,000 requests for one page load.

**The result cap pushes it back up.** The 10,000-log ceiling is per response, not
per range. Mint week, a listing spike, an airdrop sweep — any 2,000-block window
denser than 10k logs errors out and has to be bisected and retried. Budget
another 15–25% in split-and-retry traffic. Call it **~5,000 requests** on a good
provider from the deploy block, and **~13,000** if nobody fixes the `fromBlock: 0`.

**Then the hidden multiplier: timestamps.** Log objects contain
`blockNumber`, `topics`, `data`, `transactionHash` — **no timestamp**. Your feed
says "3 minutes ago" on every row, so you need one. That means
`eth_getBlockByNumber` for every distinct block you have an event in. For ~250k
transfers spread over ~150k distinct blocks, that's **150,000 more calls**, or
~1,500 if you batch 100 per HTTP request (and JSON-RPC batching is rate-limited
or disabled on several providers' free tiers).

**And the feed needs sale prices.** A `Transfer` event tells you `from`, `to`,
`tokenId`. It does not tell you whether that was a mint, a gift, or a 12 ETH
sale. Distinguishing them means also pulling Seaport `OrderFulfilled` / Blur
fill events in the same transactions and joining on `transactionHash` — another
full log sweep over the same 7.9M blocks, roughly doubling the getLogs count.

### The bill

| Line item | Requests |
|---|---|
| Transfer logs, deploy block → latest, 2k windows | ~3,950 |
| Split/retry on dense windows | ~800 |
| Marketplace fill logs (sale vs transfer) | ~3,950 |
| Block timestamps (batched 100×) | ~1,500 |
| `tokenURI` + metadata for visible rows | ~100 |
| **Total, per page load, per visitor** | **~10,000** |

Payload: ~250,000 Transfer logs × ~700 bytes of JSON ≈ **175 MB**, before the
marketplace logs. (Swap in your real transfer count — the shape holds: a 10k PFP
collection with active secondary does 100k–400k transfers in three years.)

Provider cost: Alchemy prices `eth_getLogs` at 75 compute units. 8,000 log calls
× 75 ≈ **600,000 CU for one page view**. Against a free-tier throughput limit in
the low hundreds of CU/second, a *single* user's page load takes on the order of
**20–30 minutes of wall clock** even if it never errors — and your monthly quota
is gone in a few hundred visits.

## 3. What breaks first, in order

1. **Day one, request one:** provider returns `-32005` / `-32602`. Blank screen.
   Nothing else on this list is ever reached until someone chunks the loop.
2. **After chunking — HTTP 429s.** Thousands of requests fired from a browser
   trip per-second rate limits immediately. Partial data, so the holder panel
   shows *wrong counts* rather than no counts — the dangerous failure mode,
   because it looks like it works.
3. **Quota exhaustion.** Your key dies after a few hundred page views. Note the
   key is in browser JS, so it's also public — anyone can drain it, and you'll
   be paying for a scraper's backfills.
4. **Browser memory.** 175 MB of JSON parsed into ~250k JS objects is
   ~1–1.5 GB of heap. Mobile Safari kills the tab. Desktop survives with a
   multi-second main-thread freeze during the reduce over the array.
5. **Time-to-first-byte measured in minutes,** and it's paid in full on *every*
   page load and every refresh, because there's no cache.
6. **Correctness, permanently.** Even at 100% success you'd ship: no
   mint/sale/transfer distinction, no prices, no timestamps, burns to
   `0x…dEaD` counted as a holder (usually your #1 "holder"), no ERC-1155
   `TransferSingle`/`TransferBatch` handling if the collection is 1155, and no
   reorg handling — a 1–2 block reorg silently corrupts the top of the feed.

## 4. What to build instead

The fix is the standard one: **do the scan once, on a server, into a database;
serve the frontend from indexed queries.** The ~4,000 getLogs calls don't
disappear — they become a one-time backfill instead of a per-visitor cost. After
that you stay at the chain tip with **1 getLogs call per new block (~7,200/day)**,
or a WebSocket `logs` subscription.

**Data model** — two tables is genuinely enough:

```sql
-- append-only event log
transfers(
  block_number bigint, log_index int, tx_hash bytea,
  from_addr bytea, to_addr bytea, token_id numeric,
  block_ts timestamptz, kind text,        -- 'mint' | 'sale' | 'transfer' | 'burn'
  price_wei numeric,                      -- from the joined marketplace event
  PRIMARY KEY (block_number, log_index)
)
CREATE INDEX ON transfers (block_number DESC, log_index DESC);

-- current state, updated on each ingested transfer
token_owners(token_id numeric PRIMARY KEY, owner bytea)
CREATE INDEX ON token_owners (owner);
```

- **Feed:** `ORDER BY block_number DESC, log_index DESC LIMIT 50`, keyset
  pagination on `(block_number, log_index)`. Single indexed query, ~1 ms. Fifty
  rows, not 250,000.
- **Top holders:** maintain a `holders(address, balance)` counter incremented and
  decremented as you ingest, indexed on `balance DESC`. Top 100 is one indexed
  read. Exclude the zero address and `0x…dEaD` explicitly. Cache the result for
  30–60s; it barely moves.
- **Timestamps and prices** get resolved *once at ingest time*, not per request.
- **Reorgs:** treat the last ~64 blocks as provisional; on a parent-hash
  mismatch, `DELETE FROM transfers WHERE block_number > N` and re-ingest. This is
  the bit hand-rolled indexers always skip and always regret.
- **Live updates:** the frontend keeps a WebSocket to *your* API and appends new
  rows at the top. It never talks to an RPC node.

### Two ways to get there

**Option A — rent it (recommended for launch).** A hosted transfers/NFT API
gives you the feed and ownership with no backfill and no database:

- Alchemy `alchemy_getAssetTransfers` / NFT API (`getOwnersForCollection`)
- Reservoir or OpenSea API — these already do the mint/sale/transfer
  classification and carry sale prices, which is the piece that's most annoying
  to derive yourself
- Dune / Covalent for the holder leaderboard

Time to working: days. You still need **one thin server-side proxy** so the API
key isn't in browser JS, plus a response cache — that's a single serverless
function, which I'd argue you need regardless.

**Option B — run it.** [Ponder](https://ponder.sh) (TypeScript, handles backfill,
reorgs, and serves a GraphQL/REST API — closest fit to what you're describing),
a Subsquid squid, or a subgraph on The Graph. Time to working: 1–2 weeks
including the marketplace-event decoding for sale prices. Worth it when you want
collection-specific logic or the hosted per-request costs stop making sense.

I'd ship Option A now and keep Option B as the migration path — the API surface
your frontend consumes (`GET /feed?cursor=`, `GET /holders`) is identical either
way, so swapping the backend later doesn't touch the UI.

### Infrastructure you don't currently have

Being explicit, since the plan claims none is needed:

- **Minimum (Option A):** one server-side endpoint to hold the API key + a cache
  (Vercel/Cloudflare function + Redis or even just CDN cache headers). Non-negotiable
   — an in-browser provider key is a leaked key.
- **Option B adds:** a long-running indexer process (not serverless — it needs to
  hold WebSocket state), a Postgres instance, an RPC plan with archive access and
  a decent getLogs allowance for the one-time backfill, and basic monitoring on
  indexer lag (alert if `head_block - indexed_block > 20`).

The contractor's instinct — "it's all standard RPC, any key works" — is right
about the *protocol* and wrong about the *access pattern*. JSON-RPC is an
interface for reading individual blocks and calling contracts at a known block.
It is not a query engine, and "every event this contract ever emitted, sorted,
joined, and aggregated" is a query. Something has to hold that index; the only
open question is whose server it runs on.
