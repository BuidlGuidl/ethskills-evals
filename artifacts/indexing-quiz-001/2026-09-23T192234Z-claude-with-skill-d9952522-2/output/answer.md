# Sanity check: "eth_getLogs from block 0 to latest, compute in the browser"

Short version: the plan doesn't work, and it doesn't fail gracefully. The sentence
"it's all standard RPC, so any provider key works" is the load-bearing error — it's
true that `eth_getLogs` is standard, and false that a standard method implies a
standard *answer size*. Every provider caps that call, and the caps are what turn one
conceptual request into thousands of real ones. Below: the arithmetic, the failure
order, and what to build instead.

---

## 1. What "one call" actually becomes

The contractor is describing a single request:

```js
eth_getLogs({ address: COLLECTION, topics: [TRANSFER], fromBlock: 0, toBlock: "latest" })
```

No public or commercial RPC will serve that. It gets rejected, not answered. Two
independent caps force pagination, and you have to satisfy **both at once**:

**Cap A — block span per call.** Providers limit how wide a range one `eth_getLogs`
may cover. Typical ceilings are ~10,000 blocks; some free tiers are far tighter
(~2,000, and a few restrict unbounded-result queries to ~500). Chain height is
25,800,000, so scanning from genesis:

| Span allowed per call | Calls for 0 → 25.8M |
|---|---|
| 10,000 blocks | **~2,580** |
| 2,000 blocks | **~12,900** |
| 500 blocks | **~51,600** |

Even if you're smart and start at the deploy block instead of 0 — the collection is
~3 years old, so roughly block 17,900,000, about 7,900,000 blocks of history — you've
only cut it to **~790 / ~3,950 / ~15,800** calls. The order of magnitude doesn't move.
Note that the contractor's plan says block 0, which spends ~70% of its requests
scanning years of chain that predate the contract and contain zero matching logs.

**Cap B — matched logs per response.** Independently, responses are capped at ~10,000
logs. This one bites hardest exactly where your data is densest. A 10k-token
collection mints 10,000+ Transfer events in a window of minutes; a hot listing day
does thousands more. Those ranges blow the log cap *inside* an already-legal block
span, so your pager has to catch the error, bisect the range, and retry — often
recursing down to a handful of blocks, sometimes to a single block. Mint day alone
can cost dozens to hundreds of extra calls. This is why you can't just precompute a
fixed call count: the client discovers the splits at runtime, by failing.

**Realistic total for one page load: 3,000–15,000 RPC requests**, depending on your
provider's tier and how lumpy the collection's history is. Plus retries on the 429s
you'll be generating (see below), which in practice inflate it another 20–50%.

Three more things about that number that matter more than the number:

- **It's per page load, per visitor.** Nothing is shared. 100 people opening the
  site concurrently is 300,000–1,500,000 RPC requests against one key. A single
  bot crawl or a Discord link drop ends the key.
- **It grows forever.** Ethereum adds ~2,628,000 blocks/year (12s slots). At a
  10k-block span that's **~263 more calls every year, automatically**, before the
  collection trades a single additional token. The plan gets monotonically worse
  and there is no version of it that stops getting worse.
- **The payload is enormous.** Three years of a mid-size collection is plausibly
  200,000–500,000 Transfer logs. At ~500–700 bytes of JSON per log that's
  **roughly 120–350 MB** pushed into a browser tab on every page load, to render
  the 20 rows that are above the fold.

## 2. What breaks first, in order

1. **Immediately, in dev: the literal plan errors out.** The `fromBlock: 0` call
   returns `query returned more than 10000 results` or `block range too large`. So
   this never ships as written — someone retrofits a pagination loop under deadline
   pressure, and *that* is the thing that actually reaches production. Everything
   below is about the retrofit.
2. **Rate limiting, within seconds.** Thousands of calls fired from one tab hits the
   provider's per-second compute-unit ceiling essentially instantly. You get 429s.
   The loop retries, which generates more 429s. The feed either stalls or renders
   with silent holes where a page of history was dropped — the second is worse,
   because it looks like it works.
3. **Monthly credits / the bill.** Whatever quota the key has, a few hundred visitors
   exhausts it. The site goes dark for everyone, including the parts that had nothing
   to do with the feed.
4. **The browser.** Several hundred MB of JSON parsed and held as objects, then
   reduced into a balance map, on a mid-range phone: tab crash or a multi-minute
   frozen main thread. Time-to-first-row is measured in minutes even on the happy path.
5. **Your provider key is in the bundle.** Client-side RPC means the key ships to
   every visitor and to anyone who opens devtools. It will be scraped and used.

There's also a correctness tier that no amount of RPC fixes:

- **Reorgs.** A client scan has no concept of rolling back. Logs from a block that
  gets reorged out stay in whatever the user's tab computed. Your holder counts
  silently drift from truth near the head.
- **`Transfer` alone cannot produce the feed you specified.** You asked for *mints,
  sales, and transfers*. `Transfer` gives you mints cleanly (`from == 0x0`) and
  transfers, but it carries **no price and no marketplace**. A sale and a gift look
  byte-identical. To label "sold for 2.1 ETH on Seaport" you need to join against
  marketplace events (e.g. Seaport `OrderFulfilled`) in the same transaction — a
  join across two contracts' logs, which is exactly the kind of work a browser loop
  can't do and an indexer does naturally.
- **If the collection is ERC-1155**, there is no `Transfer` event at all — it's
  `TransferSingle` / `TransferBatch`, and a batch carries an array of ids and
  amounts. Worth confirming which standard you're on before anyone writes a decoder.

## 3. What to build instead

Two different problems wearing one costume. Separate them.

### The activity feed → an indexer, backfilled once, tailing the head

Historical onchain data comes from an indexer, never from a scan at request time.
The expensive scan still happens — it's unavoidable, that's how the data gets out of
the chain — but it happens **once, server-side, at deploy time**, into a persistent
store. After that the process tails new blocks and appends. Page load becomes one
query against your own database:

```
GET /activity?before=<cursor>&limit=50   →  ~1 indexed query, ~50 rows, tens of ms
```

The feed is newest-first and paginated, so serve it with a cursor on
`(block_number, log_index)` descending — never `OFFSET`, which degrades as history
grows. The indexer is also where you do the Seaport join to label sales with prices,
because it sees the whole transaction's logs.

Two credible options:

- **Ponder** — TypeScript, writes to Postgres, serves HTTP/GraphQL. Good fit if the
  team is already TS and you want the sale-labeling logic as ordinary code.
- **A subgraph on The Graph** — AssemblyScript mappings, GraphQL endpoint. Note the
  hosted service was sunset in June 2024, so **there is no free public endpoint to
  deploy to**. `graph deploy` puts you in Subgraph Studio, which is for testing only;
  you must then *publish* to the network to get a production endpoint, queried with a
  Studio API key. Production queries are metered — roughly 100K free per month, then
  about $2 per 100K (figure checked 2026-08-18; re-read the live pricing page before
  you budget against it).

**Decide where this runs in production, and write it down now.** This is the decision
that quietly stays open until launch week and leaves you with a read side that only
ever ran on someone's laptop. Concretely, name: the host and the command
(e.g. Ponder on Railway/Fly/ECS via `ponder start`), the Postgres instance and who
backs it up, what restarts the process when it dies, and what alerts you when it
falls behind the chain head. If you pick the subgraph route, the equivalent decision
is "published to the network under this API key," not "deployed to Studio."

### The top-holders panel → mostly the same store, plus Multicall3 for freshness

"How many tokens does this wallet hold *right now*" is current state, not history —
and current state is a direct contract call, not indexing work. But your panel needs
a *ranking across all holders*, which means you need the holder set, and the only way
to know who ever touched the collection is the transfer history. So:

- Maintain a `holders(address, balance)` table in the indexer, incremented and
  decremented as transfers are processed. The panel is
  `SELECT … ORDER BY balance DESC LIMIT 20` — one indexed query, instant.
- Use **Multicall3** (`0xcA11bde05977b3631167028862bE2a173976CA11`, same address on
  most chains) to batch `balanceOf` for the top N addresses into a *single* RPC call
  when you want a live-verified number, or as a periodic reconciliation job to catch
  any drift between your derived balances and the chain. What you should *not* do is
  stand up indexing infrastructure to track a number the chain will return on
  request — for a single wallet's balance on a profile page, just call `balanceOf`.

### And put the RPC key behind a server

Once you have a backend for the indexer, route any remaining client-side reads
through it. The key stops being public, and you get a caching layer and a rate limit
you control.

## 4. Infrastructure you don't have yet — stated plainly

The contractor's pitch is appealing because it claims zero new infrastructure. The
honest version of my alternative is that it needs **four things you currently don't
have**, and you should price them before agreeing to the architecture:

1. **A persistent database** (Postgres) with backups. The index is derived data, so
   losing it isn't fatal — but rebuilding means re-running the full backfill, which
   is hours of RPC, so treat it as real state.
2. **A long-running process with supervision** — not a serverless function. An
   indexer must stay alive to tail the chain. It needs a host, a restart policy, and
   lag alerting. (The subgraph route outsources this; that's its main advantage.)
3. **An RPC plan sized for the one-time backfill**, including archive access if you
   backfill via traces rather than logs. This is the same thousands-of-calls scan the
   contractor proposed — the difference is you pay for it once instead of once per
   visitor, and you pay for it somewhere you can retry it.
4. **A thin API layer** in front of the store (or the metered Studio endpoint) so the
   browser talks to you, not to your provider.

Rough shape: a small Postgres and one always-on container, plus RPC. That's real but
modest, and it's bounded — it does not grow by 263 requests a year per visitor, which
is the thing the "no extra infrastructure" plan is actually hiding.

## 5. One thing to settle before anyone writes code

Confirm whether the collection is **ERC-721 or ERC-1155**, and get the **deploy block
number**. The first determines which events you're decoding (`Transfer` vs
`TransferSingle`/`TransferBatch`, the latter needing per-id unpacking); the second is
a free ~70% cut to backfill cost, since the contractor's `fromBlock: 0` spends most
of its budget scanning chain history that predates the contract.

If you want, I can sketch the Ponder schema and the two handlers — transfer
accounting plus the Seaport join for sale prices — against the actual contract
address.
