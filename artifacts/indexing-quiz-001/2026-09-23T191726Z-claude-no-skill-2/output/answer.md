# Sanity check: "eth_getLogs from block 0 in the browser"

**Verdict: this plan does not work.** Not "works but gets slow at scale" — the
literal call described (`eth_getLogs`, `fromBlock: 0x0`, `toBlock: "latest"`)
is rejected by every mainstream provider on the very first page load, on day one,
with zero users. Once you patch around that rejection the only way forward is
client-side chunking, and that turns one page load into roughly **800–13,000 RPC
requests and 100–400 MB of JSON**, per user, every time they hit refresh.

The deeper issue is that the contractor's sentence "we don't need extra
infrastructure" is the actual bug. A "top holders" panel is a **fold over the
entire history of the contract**. Somebody has to do that fold and store the
result. The only question is whether that somebody is your server (once, in the
background) or every visitor's browser (repeatedly, over the public internet).
The plan picks the second. That choice is what everything below follows from.

---

## 1. Why the single call fails immediately

`eth_getLogs` has no pagination in the JSON-RPC spec. There is no cursor, no
`limit`, no `nextPageToken`. The method is all-or-nothing: the node matches your
filter against its log index and serializes the entire result set into one
response body.

Because that is unbounded, every provider bolts its own limits on top. The exact
values change — **check your provider's current docs before you size anything** —
but the shape is consistent:

| Guard | Typical value | Error you get |
|---|---|---|
| Block range span | 2,000–10,000 blocks | `-32602 query exceeds max block range` |
| Result count | 10,000 logs | `-32005 query returned more than 10000 results` |
| Response size | ~150 MB, often much less | `413` / truncated body |
| Request timeout | 5–30 s | `-32603` or a dropped socket |

Your query is 25,800,000 blocks wide and would return hundreds of thousands of
logs. It trips **all four**. The first render is an error toast, not a feed.

Note what these limits are *not*: they're not a pricing lever you can buy your
way out of. They exist because the node has to hold the whole result set in
memory while serializing it. An enterprise plan raises the ceiling; it does not
remove it.

## 2. What the request count actually becomes

The only fix available to a browser-only client is to split the range into chunks
and issue one request per chunk. That's a loop, and its trip count is set by two
independent forces.

**Force one: the block-range cap.** Pure division, `total_blocks / chunk_size`:

| Provider chunk cap | From block 0 (as written) | From the deploy block (~17.9M) |
|---|---|---|
| 10,000 | **2,580 requests** | **~790 requests** |
| 5,000 | 5,160 | ~1,580 |
| 2,000 | 12,900 | ~3,940 |
| 1,000 (public/free endpoints) | 25,800 | ~7,880 |

The deploy-block column assumes ~7,200 blocks/day (12 s post-Merge slots), so
three years ≈ 7.88M blocks, putting deployment around block 17.9M. Finding that
number is itself work — Etherscan, or a binary search on `eth_getCode` — and the
contractor's plan doesn't do it. Starting at 0 means **~70% of the requests scan
blocks that predate the contract and are guaranteed to return `[]`.** That is the
single cheapest fix available and it is pure subtraction, not architecture.

**Force two: the result-count cap, which the fixed chunk size cannot respect.**
NFT transfer activity is violently non-uniform. The mint is one or two blocks
containing thousands of Transfers; a floor-sweep during a hype cycle does the
same. Those chunks blow the 10,000-log limit *even at a legal block width*, so
the client has to catch the error, bisect the range, and retry — recursively.
Budget another 10–25% of requests, and note these are the slowest ones, since a
9,000-log response is also the biggest payload.

**Realistic headline: 1,000–3,000 requests per page load**, with a bad
provider/naive-start-block combination reaching ~13,000. Call it **~2,500** for
the plan exactly as written against a 10k-block cap.

Three secondary costs ride along with that number:

- **Wall-clock.** At ~300 ms per round trip, 2,500 sequential requests is
  ~12 minutes. Parallelism helps until it doesn't: push concurrency up and you
  hit the provider's per-second rate limit and start collecting `429`s, whose
  backoff gives the time back. Realistic best case is still minutes, and the feed
  cannot render until the *last* chunk lands, because holder balances are a fold
  that isn't correct until it's complete.
- **Bytes.** An ERC-721 Transfer log serializes to ~700–900 bytes of JSON
  (address, four 32-byte topics, block hash, tx hash, indices). A three-year
  collection plausibly has 150k–500k of them: **~120–400 MB down the wire**, then
  parsed into JS objects at several times that in heap. Mobile Safari kills a tab
  well before this. This is a hard stop on phones.
- **Provider quota.** `eth_getLogs` is one of the most expensive methods on
  usage-based pricing (on the order of ~75 compute units each). 2,500 × 75 ≈
  **190k CU for one page load.** A generous free tier is gone in a few thousand
  loads — i.e. one modest launch day — and you're paying per *refresh*, not per
  user. Your infrastructure bill becomes linear in engagement, which is exactly
  backwards.

## 3. What breaks first, in order

1. **Day one, first render: nothing loads.** The unchunked call is rejected. This
   is the failure that matters, because it means the plan was never tested
   against a real provider on a real contract.
2. **The public RPC key.** "Any provider key works" means the key ships inside
   your JS bundle, visible in devtools to anyone who opens the page. It will be
   scraped and used to run someone else's workload on your quota. You then rotate
   it and the same thing happens again, because a browser cannot keep a secret.
   Domain allowlisting is the mitigation, and it only works if the provider
   supports it and the attacker doesn't spoof `Origin`.
3. **Mobile.** OOM tab crashes from the log array, before desktop even notices.
4. **Rate limits and cost**, together, as soon as concurrent users appear. Your
   own users DoS your endpoint; per-user cost scales with refreshes.
5. **Silently wrong holder rankings** — the worst one, because it doesn't page
   anyone. Drop a single chunk to a `429` or a timeout and the fold is corrupt:
   every wallet downstream of that missing Transfer shows the wrong balance,
   nothing errors, and the panel looks fine. `eth_getLogs` gives you no
   completeness checksum, so the client cannot detect this. Related correctness
   traps the plan hasn't accounted for:
   - **ERC-721 vs ERC-1155.** `Transfer(address,address,uint256)` only covers
     721. If the collection is 1155 you need `TransferSingle` and `TransferBatch`,
     and balances are quantities, not a count of token IDs. Confirm the standard
     before anything else.
   - **Reorgs at the tip.** Logs from the newest blocks can be un-mined.
     `eth_getLogs` results carry `removed: true` on reorged entries in some
     configurations, but a fire-and-forget client ignores it.
   - **Custody contracts.** Marketplace escrow, staking, and vault contracts hold
     large balances and will dominate a naive leaderboard. "Top holders" almost
     certainly means *people*, so you need a labelled exclusion list. This is a
     product decision the plan never surfaces.

## 4. Build this instead

Separate the two panels, because they have genuinely different requirements.

**The feed is easy and the plan over-serves it.** Newest-first activity needs the
most recent ~50 events, not 25.8M blocks of history. `eth_getLogs` over the last
few thousand blocks is one or two cheap requests. The feed never justified the
full backfill — the holder panel did.

**The holder panel is what forces an index.** There is no RPC method that answers
"who holds the most tokens." `balanceOf` requires knowing the address in advance;
there's no enumeration of holders on chain. The answer only exists as a
derivative of full Transfer history, which means it has to be precomputed and
stored somewhere that supports `ORDER BY balance DESC LIMIT 20`. That's a
database, and a database is infrastructure.

### Option A — hosted NFT API (recommended for launch)

Alchemy NFT API, Reservoir, SimpleHash, Goldsky, or similar. They have already
done this backfill for every mainnet collection.

- Holder panel: one `getOwnersForContract`-style call, already aggregated.
- Feed: one `getTransfersForContract`-style call, already sorted and cursor-paginated.
- **Two HTTP requests, sub-second, no backfill, no database.**

Trade-offs, stated plainly: vendor lock-in, their pricing and rate limits, their
data model and freshness guarantees, and you inherit their outages. Keep the key
on a thin server route of yours rather than in the bundle — same reasoning as §3.2.

### Option B — your own indexer (own the data, more setup)

[Ponder](https://ponder.sh), Subsquid, or a subgraph on The Graph. A long-running
process backfills Transfer logs with correct chunking and retry, then follows the
chain head, writing into Postgres:

- `transfers` — the feed. Index on `(block_number DESC, log_index DESC)`,
  keyset-paginated.
- `holders` — `(address, balance)`, incremented/decremented per transfer, index on
  `balance DESC`. Maintained as an upsert, so ranking is a 20-row read, not a fold.

Both panels become single indexed queries: milliseconds, constant cost regardless
of history length or traffic.

**Infrastructure you do not currently have, if you pick B:**

- A long-running server process (the indexer). Not serverless — it holds chain-head state.
- A Postgres instance.
- A **paid** RPC endpoint with archive-grade log access for the one-time backfill.
  You still pay the ~800-request cost from §2 — but *once, server-side,* rather
  than per visitor. That's the whole point.
- An API layer (or Ponder's built-in GraphQL) so the browser never sees an RPC key.
- HTTP caching / CDN on the holders endpoint. It changes slowly; a 30–60 s TTL
  absorbs essentially all read traffic.
- Reorg handling at the tip (Ponder and subgraphs do this for you — writing it
  yourself is the part people underestimate).

Realistic cost is tens of dollars a month; realistic setup is a few days,
dominated by a backfill that runs for hours unattended.

### My recommendation

**Ship on Option A, migrate to B if and when you need data the vendor won't give
you.** A gets you a correct, fast page this week with no new infrastructure —
which is the outcome the contractor was promising and did not deliver. B is the
right long-term home if the collection's data becomes part of the product rather
than a display surface. Build the frontend against your own API route in both
cases, so swapping A for B later is a backend change and the client never notices.

Either way, put the RPC/vendor key behind your own server route, confirm whether
the collection is 721 or 1155 before writing any decode logic, and decide
explicitly what "top holder" means when a marketplace escrow contract is sitting
at the top of the list.
