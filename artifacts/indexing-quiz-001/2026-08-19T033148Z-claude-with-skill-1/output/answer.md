# Sanity check: "eth_getLogs from block 0 on page load"

**Short version: this does not ship.** The plan's first RPC call returns an error, not
data. Once you patch around that with pagination, one page load becomes thousands of
RPC calls and a few hundred megabytes of JSON in the browser, and that number grows
every day the chain does. Historical onchain data has to come from an indexer that
backfilled once and now tails the tip. The good news: for a standard ERC-721 this is a
few days of work, and one of the options needs no infrastructure from you at all.

---

## 1. What the number actually is, and what forces it

### The literal plan fails on request #1

`eth_getLogs({address, topics:[Transfer], fromBlock: 0, toBlock: "latest"})` is rejected
by every production provider. You get back one of:

- `-32602: query returned more than 10000 results`
- `-32602: eth_getLogs block range too large`
- `-32603: query timeout exceeded`

There is no provider tier where this call succeeds. The contractor's sentence "it's all
standard RPC, so any provider key works" is the error: `eth_getLogs` is standard, but
every provider caps it, because otherwise one client could ask a node to scan the entire
chain synchronously. So the plan doesn't degrade gracefully under load — it returns zero
data on a quiet Tuesday with one user.

### What you get after you add pagination

Two independent caps force the fan-out, and you hit both:

| Cap | Typical values | What it forces |
|---|---|---|
| **Block-range span** per call | 10,000 (Alchemy default, QuickNode paid) · 2,000 (Alchemy's unlimited-response mode) · 3,000 (dRPC, Ankr) · 500–1,000 (free/public endpoints) | A fixed sliding window over the chain |
| **Matched-log count** per response | 10,000 logs (Alchemy, Infura, most others) | Adaptive re-splitting of hot ranges |

Your inputs:

- Chain height ≈ **25,800,000**.
- Collection is ~3 years old → deployed around block **17,900,000**
  (3 yr × 365 × 24 × 3600 ÷ 12 s ≈ 7.9M blocks). **Blocks 0 → 17.9M contain zero logs
  for this contract**, and the plan scans all of them anyway. That's ~70% of the work
  spent proving an empty set is empty.
- Transfer count: call it **T**. A 10k-item PFP three years in is usually **50K–500K**
  Transfer events (mint + secondary). I'll use **T ≈ 250,000** below; substitute yours.

**Naive fixed-window scan (what a contractor actually writes when the first call fails):**

```
calls ≈ 25,800,000 / window
  window = 10,000  →  2,580 calls
  window =  2,000  → 12,900 calls
  window =    500  → 51,600 calls
```

plus re-splits wherever a window matched >10,000 logs — the mint block, big listing
sweeps, wash-trading bursts — each of which costs an extra failed call *and* its
replacements.

**Best case, if someone writes a smart adaptive bisector on a paid Alchemy key**
(exploit "any block range as long as ≤10K logs in the response"): the floor is
`T / 10,000 ≈ 25` calls plus bisection overhead and the empty-prefix probes — call it
**50–100 calls**. This is the number a strong engineer gets to. Note two things: it is
Alchemy-specific behaviour that Infura and self-hosted Geth do not share, and it is
*still not shippable*, for the reason in the next section.

**So the honest answer to "roughly how many requests":**

> **~2,600 to ~13,000 RPC calls per page load** for the code that will actually get
> written, floor of ~50–100 with provider-specific adaptive bisection, ~50,000 on a
> free or public endpoint. **Per page load. Per user. Every refresh, because there is
> no cache.**

**And it grows.** Ethereum adds ~2.6M blocks/year, so the fixed-window version gains
**+260 to +1,300 calls per year, forever**, and the bisecting version grows with `T`.
The architecture gets strictly worse every day after launch and there is no tuning knob
that reverses that — this is the part that makes it a dead end rather than a slow start.

### The payload, which is the real killer

250,000 ERC-721 Transfer logs, each ~600–900 bytes of JSON-RPC (address, 4 topics ×
66 chars, blockHash, blockNumber, txHash, txIndex, logIndex, removed):

```
250,000 × ~800 B ≈ 200 MB
```

That is 200 MB over the wire, then `JSON.parse`d, then held in a JS array while you
`reduce` it into balances. On a desktop that's a multi-minute freeze; on an iPhone the
tab is killed by the OS before it finishes. The 50-call adaptive version transfers
exactly the same 200 MB — which is why the low call count doesn't save the plan.

### Wall clock

2,580 sequential calls × ~250 ms ≈ **11 minutes**. 12,900 × 250 ms ≈ **54 minutes**.
Parallelise 10-wide and you trip rate limits (below), so you land in the *several
minutes* range either way, against a target of "feed visible in about a second."

### Money

Alchemy prices `eth_getLogs` at **75 compute units**. At 12,900 calls that's
**~967,000 CU per page load**. The free tier is 30M CU/month:

```
30,000,000 / 967,000 ≈ 31 page loads per month
```

**Your entire monthly free quota is ~31 visitors.** On a paid growth plan you're paying
real money per pageview to recompute the same immutable history you already computed for
the previous visitor. That is the economic shape of the bug: zero reuse across users.

---

## 2. What breaks first, in order

1. **Immediately, before any traffic: the unbounded call errors out.** Feed renders
   empty. This is caught in the first hour of QA, and the "fix" is pagination, which is
   what produces everything below.
2. **Rate limiting (HTTP 429 / CUPS exceeded) mid-scan.** Somewhere around call 300 of
   2,580 the provider throttles you. Now the loop has to back off and retry, extending
   the multi-minute load, and **if any window is dropped, you don't notice**.
3. **Silently wrong holder rankings — the worst failure, because it looks fine.** A feed
   with a hole is a feed missing some rows. A *balance table* with a hole is
   **permanently wrong going forward**: miss the Transfer where wallet A sold to wallet
   B, and your panel shows A holding that token forever. You will ship a "top holders"
   leaderboard that names the wrong wallets, and nothing in the UI indicates a problem.
   Someone on Discord finds it before your monitoring does.
4. **Browser OOM.** ~200 MB of parsed logs plus the intermediate `Map` of balances. Mobile
   Safari kills the tab. This is where the bug reports start.
5. **Credit exhaustion / key lockout.** ~31 free-tier visitors, or a five-figure bill.
   And because it's one shared frontend key, the 32nd visitor breaks the site *for
   everyone*, including the ones already on it.
6. **Reorgs and duplicates at the tip.** The last few blocks reorg; a naive scan double-
   counts or drops those transfers, so the newest — most visible — rows in the feed are
   the least reliable ones.
7. **Key leakage.** Calling the provider from the client puts the RPC key in the bundle,
   so anyone can spend your CU budget. This is true of the current design regardless of
   the scanning issue, and the fix (a server-side route) is a prerequisite for the real
   architecture anyway.

Also worth saying plainly: **the plan has no cache.** Ten thousand visitors recompute the
same three years of immutable history ten thousand times. Blocks below the tip never
change. That work should be done **once, ever** — which is the definition of an indexer.

---

## 3. What to build instead

**Rule: historical onchain data comes from an indexer that backfilled once and now tails
new blocks. It never comes from a scan performed at request time.** The frontend queries
a database with an index on `(blockNumber, logIndex)` and on `balance` — page 1 of the
feed is 50 rows, the holder panel is a `ORDER BY balance DESC LIMIT 100`. Both return in
50–200 ms and **neither gets slower as the chain grows**, which is the property the
current plan can never have.

Concretely, two entities derived from the same `Transfer` handler:

- **`Transfer`** — one row per event: `from`, `to`, `tokenId`, `blockNumber`, `logIndex`,
  `txHash`, `timestamp`. Feed = `ORDER BY blockNumber DESC, logIndex DESC LIMIT 50`,
  cursor-paginated on `(blockNumber, logIndex)`. Mint = `from == 0x0`, burn =
  `to == 0x0`, sale vs. plain transfer needs the marketplace fill — see the note below.
- **`Account`** — `id = address`, `balance` (integer). The handler does
  `from.balance -= 1; to.balance += 1` per event. This is an incremental counter, not a
  recomputation, so it's O(1) per event. Holder panel =
  `WHERE balance > 0 ORDER BY balance DESC LIMIT 100`.

That second entity is the whole reason the holders panel needs an indexer at all, and
it's worth being precise about why, because there's a related case where the answer is
the opposite:

> **Current state for known addresses is *not* indexing work.** "Does the connected
> wallet own a token?", "how many does *this* address hold?" — those are direct
> `balanceOf` / `ownerOf` calls, batched into a single request with **Multicall3**
> (`0xcA11bde05977b3631167028862bE2a173976CA11`, same address on ~every chain). Don't
> route those through the indexer.
>
> Your holders panel is different: ranking *all* wallets requires knowing the set of
> holders, and the chain will not enumerate that for you — `balanceOf` needs an address
> you already have. The holder set only exists as a *derivative of transfer history*.
> That's genuine indexing work.
>
> Nice combination once you have both: let the indexer produce the candidate top ~200
> addresses, then confirm the displayed top 100 with **one** Multicall3 `balanceOf`
> batch. You get live-accurate numbers on exactly the rows you render, and it doubles as
> a drift check on the indexer.

### The three options

| | Infra you operate | Time to ship | Cost | When to pick it |
|---|---|---|---|---|
| **A. NFT data API** (Alchemy NFT API, Reservoir) | **None** | ~1 day | Per-request, in your existing provider plan | Standard ERC-721, standard feed — your case |
| **B. Subgraph** (The Graph) | None to run, but publishing + billing to set up | ~3–5 days | ~100K queries/mo free, then ~$2/100K | You want a schema you control |
| **C. Ponder** (TypeScript + Postgres) | Host, Postgres, supervision — all yours | ~1 week | Hosting only | Custom logic, joins with offchain data |

**My recommendation: start with A, and only move to B if you hit its limits.** For a
plain ERC-721 activity feed plus holder ranking, `getAssetTransfers` (contract-filtered,
cursor-paginated, newest-first) and `getOwnersForContract` (`withTokenBalances: true`)
already return exactly the two things your two panels need. You have a provider key
already, so there is no new infrastructure, no backfill wait, no process to keep alive —
you can have both panels working this week. The trade-off is real and you should book it:
you don't control the schema, and you're locked to that provider's shape. That is a
better problem to have at launch than an unfinished Postgres deployment.

**Go to B (subgraph) when** you want your own schema — e.g. "sales only, with price,
joined to the marketplace fill" — or you want to avoid provider lock-in. It's the right
long-term home and the migration is not painful, because the frontend is already talking
to *a* query API rather than to RPC.

**Go to C (Ponder) when** the read model needs logic a subgraph can't express, or joins
against your own offchain tables.

### Named production home — decide this before writing code

This is the decision that quietly stays open until you've got a read side that only ever
ran on someone's laptop. Fill these in and put them next to the architecture doc:

- **Option A:** production home is your existing provider account, called from **your own
  server route** (`/api/feed`, `/api/holders`) — never from the browser, so the key stays
  server-side and you get one shared cache (30 s on the feed, 60 s on holders) instead of
  one fetch per visitor.
- **Option B:** `graph deploy` puts it in **Subgraph Studio, which is testing only** — a
  rate-limited dev endpoint, not something to launch on. The free hosted service is gone
  (sunset June 2024), so there is no free public endpoint to deploy to. You must
  **publish from Studio to the network** to get the production URL, and query it with a
  Studio API key. Getting from zero to a production endpoint is: Studio account → deploy
  key → `graph deploy` → **publish (an onchain transaction on Arbitrum One, so you need a
  wallet funded with ETH there, plus GRT if you want to signal for indexer pickup)** →
  API key → billing. Pricing was ~100K free queries/month then ~$2 per 100K as of
  2026-08-18; re-read the live pricing page before you put a number in a budget.
- **Option C:** name the host (Railway / Fly / ECS), the **Postgres instance with a
  persistent volume and backups**, the process supervisor, and who gets paged when
  indexing lag alarms. "It runs in Docker" is not a production home.

### Infrastructure you don't have yet — the honest list

- **A server-side API route.** Required in all three options, and it's how the RPC key
  leaves the browser bundle. If you have a Next.js app you already have this.
- **A caching layer** in front of that route. Redis is nice; an in-process TTL cache is
  fine to start. Without it, one indexer query per visitor per panel.
- **For B or C only:** a Graph Studio account + deploy key + API key + a funded Arbitrum
  wallet for publishing (B), or a host + managed Postgres + supervision + lag monitoring
  (C).
- **For B or C only: backfill time in the launch schedule.** Indexing 7.9M blocks of one
  contract's Transfers is **hours, not minutes**. It's a one-time cost, but it has to
  happen *before* launch day, not on it. Option A has no backfill because the provider
  already did it — that's most of why it ships faster.
- **An archive-capable RPC endpoint** for the backfill in option C (Graph's network
  indexers supply their own; Ponder uses yours).
- **Indexing-lag monitoring.** The one failure mode all three share: the indexer falls
  behind the tip and the feed silently goes stale. Expose `latestIndexedBlock` and alert
  when `chainHead - latestIndexedBlock > ~25` blocks (~5 min).

### One caveat on the feed's content

"Every mint, sale, and transfer" — `Transfer` alone gives you mints (`from == 0x0`),
burns, and transfers, but **it does not tell you a sale happened or what it sold for**.
A sale is a Transfer plus a marketplace fill (Seaport `OrderFulfilled`, Blur, etc.)
in the same transaction. If the feed needs to say "sold for 1.2 ETH," you must index the
marketplace events too and join on `txHash`. Options A/Reservoir hand you this
pre-normalised across marketplaces, which is the strongest argument for A; a subgraph
means adding those contracts as extra data sources and writing the join yourself. Worth
settling now — it's the requirement most likely to change which option you pick.

### If you're writing the contract side of anything new

Design event-first: **every state change emits an event carrying what the read side
needs.** A state change with no event is invisible to every indexer, frontend and
explorer, permanently — you cannot backfill it later. Keep aggregation, ranking and
pagination offchain; if a result must be committed onchain, store a hash of it.

---

## Summary for the contractor

The plan isn't "unoptimised," it's inverted: it does per-request what should be done
once. As written the first call errors; paginated, it's **~2,600–13,000 RPC calls and
~200 MB per page load, growing +260 to +1,300 calls every year**, exhausting an Alchemy
free tier in **~31 visitors** — and the first thing users notice isn't the slowness, it's
a **holder leaderboard that's quietly wrong** because one dropped window corrupts every
balance downstream of it. Replace it with a backfilled, tailing index queried by a cached
server route. Given a standard ERC-721, take the NFT data API path first — it needs no
new infrastructure and gets both panels live this week — and keep the subgraph as the
planned second step once you want a schema of your own.
