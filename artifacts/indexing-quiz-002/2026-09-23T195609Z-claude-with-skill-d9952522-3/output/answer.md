# Shipping the marketplace subgraph to production

_Prepared 2026-09-23. Every dollar figure below is tagged with its source and a
re-check flag; see "Numbers to re-check before you commit the budget" at the end._

---

## 1. What the draft runbook gets wrong

> "Ship step: run `graph deploy --hosted-service marketplace` ... The hosted service
> is free and gives us a public GraphQL endpoint our frontend can hit straight away
> — no tokens, no billing, nothing to set up."

Three separate errors, and the first one is fatal to the whole plan:

**a) The hosted service no longer exists.** The Graph's hosted service was sunset in
June 2024. `--hosted-service` is not a live deploy target — that command will not
produce a working endpoint, and there is no free public endpoint to deploy to. Any
runbook step, budget line, or frontend config that assumes it is planning against
infrastructure that was switched off over two years ago.

**b) "Deploying" is not "publishing."** This is the conceptual trap that survives
even after you fix (a). On The Graph today there are two distinct actions:

- `graph deploy` pushes your build to **Subgraph Studio**. Studio is a *development
  and testing* environment. It gives you a dev query URL that is rate-limited and
  explicitly not meant to back a production frontend.
- **Publishing** is a separate, onchain action that puts the subgraph on The Graph
  Network, makes it visible in Graph Explorer, and gives you the production query
  endpoint that indexers actually serve.

A runbook whose ship step ends at `graph deploy` ships a dev endpoint to production.
That is the most likely way this sprint quietly goes wrong even after the team
notices the hosted service is gone.

**c) "No tokens, no billing" is wrong on both counts.** Production queries are
metered and billed, and publishing is an onchain transaction on Arbitrum One — so
there are at minimum two token touchpoints (gas, and query payment if you pay in
GRT rather than by card). Details in §3.

There is also a fourth, quieter problem: the draft never names *where the read side
lives in production*. "Works locally against a local Graph Node" is not a production
home. The go-live path below exists precisely to close that gap.

---

## 2. The actual go-live path

### Step 0 — Decide the production home (do this first, in writing)

Two viable options. Pick one now; the rest of the runbook differs.

| | The Graph Network (hosted, decentralized) | Self-host (Graph Node or Ponder) |
|---|---|---|
| Ops burden | None — indexers run it | Host, Postgres, RPC, process supervision, monitoring, backups are all yours |
| Cost shape | Per-query, metered | Fixed infra bill regardless of traffic |
| Stand-up | Hours | Days, plus ongoing on-call |

For a marketplace dApp frontend with a few million queries a month and no existing
infra team appetite, **The Graph Network is the default recommendation** — the
per-query cost at your volume (§3) is far below what a babysat Postgres + Graph Node
+ archive RPC would cost in either dollars or engineer-hours. The rest of this
runbook assumes that choice; §4 covers the self-host alternative.

### Step 1 — Create the subgraph in Subgraph Studio

In Studio you create the subgraph entry and get a **deploy key**. Authenticate the
CLI with it:

```bash
graph auth <deploy-key>
```

Treat the deploy key as a secret: CI secret store, not the repo.

### Step 2 — Build and deploy to Studio (this is testing, not shipping)

```bash
graph codegen
graph build
graph deploy <subgraph-slug>
```

Wait for it to sync to chainhead in Studio, then run your existing GraphQL test
queries against the **Studio dev URL**. This is the last checkpoint where fixing a
mapping bug is free — after Step 3 each corrected version costs another onchain
transaction.

Verify explicitly before moving on: sync status reaches the current block, no
indexing errors, and your marketplace queries return the same shape and data they
did against the local Graph Node.

### Step 3 — Publish to The Graph Network (the real ship step)

Publish from the Studio UI (or CLI). This is an **onchain transaction on Arbitrum
One**, so the publishing wallet needs ETH on Arbitrum for gas.

Runbook notes:
- Use a wallet the team controls long-term, not a personal dev wallet — it owns the
  subgraph and is needed for every future version publish.
- After publishing, the subgraph appears in Graph Explorer and gets its **production
  query URL**. This URL — not the Studio one — is what the frontend uses.

### Step 4 — Signal curation (optional, recommended)

The docs recommend curating your own subgraph with **at least 3,000 GRT** to attract
indexers to serve it. This is not required to publish. It is a real consideration:
if no indexer picks up your subgraph, queries route poorly or not at all. The GRT is
signalled, not spent — it sits in a curation bonding curve and can largely be
withdrawn later, minus a curation tax and minus whatever the bonding-curve price
moved against you. **Budget it as at-risk capital, not as an expense, and not as
fully recoverable.**

### Step 5 — Create an API key and wire up the frontend

Production queries require a **Studio API key**. In Studio:
- create the API key,
- **restrict it by domain** to your frontend's origin, and restrict it to this
  subgraph specifically.

Then point the frontend at the production query URL with that key.

**Security note the runbook must call out:** a browser-side dApp ships this key to
every visitor. It is not secret. Domain restriction is your only real control, and
it is bypassable by anyone willing to forge an Origin header. Two mitigations worth
deciding on now:
- proxy queries through your own backend so the key never reaches the browser
  (recommended if you have any backend at all), or
- accept the exposure, keep domain restrictions on, and **set a spend cap / monitor
  usage** so a scraper can't run up your bill. Do not skip the spend cap.

### Step 6 — Add billing

Add a payment method in Studio before you exceed the free tier, or queries stop.
You can pay by **credit/debit card** (monthly invoice) or in **GRT on Arbitrum**
(requires a GRT balance in your billing account, plus ETH on Arbitrum for the gas of
topping it up). Card is simpler for a finance department; GRT is the token path.

### Step 7 — Operational steps the draft omits entirely

- **Monitoring:** alert on subgraph sync lag (indexing falling behind chainhead is
  silent from the frontend's perspective — it just serves stale data) and on query
  error rate.
- **Version upgrades:** publishing a new version is another onchain transaction.
  Have a documented procedure, including that curation signal must be migrated to
  the new version.
- **Fallback:** decide what the frontend does when the endpoint is degraded or the
  subgraph is behind. Marketplace listings showing stale state is a product
  decision, not an infra one.

---

## 3. What this costs

### One-time, to stand up

| Item | Cost | Source / confidence |
|---|---|---|
| Subgraph Studio account, deploy, testing | **$0** | Studio free tier; [studio pricing](https://thegraph.com/studio-pricing/) |
| Publishing transaction (Arbitrum One gas) | **Low single-digit USD**, typically well under $5 | Arbitrum gas is cheap; **not documented by The Graph — estimate, re-check at publish time** |
| Curation signal (optional, recommended) | **3,000 GRT ≈ $75** at ~$0.025/GRT | 3,000 GRT figure from [publishing docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/); GRT price ~$0.023–$0.027 across CoinMarketCap/CoinGecko/Coinbase/Kraken, checked 2026-09-23 |
| ETH on Arbitrum for gas float | Fund with ~$20–50 to cover publish + future version publishes | Estimate |

**Realistic stand-up total: roughly $100–150**, of which the ~$75 curation is
at-risk capital rather than a sunk expense. This is a rounding error against
engineer time — the real stand-up cost of this sprint is the days, not the dollars.

### Recurring, at ~3M queries/month

Pricing: **100,000 free queries/month, then $2 per 100,000 queries.**
Source: [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/), checked
2026-09-23. The same page shows a worked example — 300,000 queries = $4/month —
which confirms the "first 100K free, then $2/100K" reading.

```
3,000,000 queries
  − 100,000 free
= 2,900,000 billable
  ÷ 100,000 = 29 units × $2 = $58.00 / month
```

**≈ $58/month at 3M queries.** For sensitivity:

| Monthly queries | Monthly cost |
|---|---|
| 100K | $0 |
| 1M | $18 |
| 3M | $58 |
| 10M | $198 |
| 30M | $598 |

Budget-line recommendation: **$60/month baseline, with $200/month headroom** — query
volume from a browser dApp is driven by page views *and* by how chatty your frontend
is, and a single badly-placed `useQuery` in a polling component can multiply your
bill without any traffic growth. Audit polling intervals and enable client-side
caching before go-live; that is the highest-leverage cost control you have.

There is **no fixed monthly platform fee** — no seat cost, no minimum commit on the
pay-as-you-go plan. At your volume the entire recurring bill is query metering.

---

## 4. If you self-host instead

Legitimate alternative, and the honest cost comparison is not favourable at 3M
queries/month:

- **Graph Node self-hosted:** a Graph Node process + Postgres (which grows
  continuously and needs backups) + an archive-capable RPC endpoint. Call it
  $50–200/month in cloud infra for something production-credible, plus the RPC bill,
  plus ongoing on-call. The dominant cost is engineering attention, not hosting.
- **Ponder:** lighter to operate than Graph Node, still needs a host, a persistent
  Postgres, and process supervision.

Either way, you own the host, the persistent store, and the process supervision —
and you must name all three in the runbook. Self-hosting only wins at much higher
query volumes, or if you need indexing features the network doesn't serve.

---

## 5. Corrected ship step for the runbook

Replace the draft's single line with:

```bash
# 1. Authenticate (deploy key from Subgraph Studio, stored as a CI secret)
graph auth <deploy-key>

# 2. Build and deploy to Studio — TESTING ONLY, this is not the ship step
graph codegen && graph build
graph deploy <subgraph-slug>

# 3. Verify in Studio: synced to chainhead, no indexing errors,
#    marketplace queries return expected results

# 4. PUBLISH from Studio to The Graph Network
#    -> onchain tx on Arbitrum One, needs ETH for gas
#    -> this is the actual ship step

# 5. Optionally signal >= 3,000 GRT curation on the subgraph

# 6. Create a domain-restricted API key in Studio; set a spend cap

# 7. Point the frontend at the PRODUCTION query URL (not the Studio dev URL)

# 8. Add a payment method (card or GRT on Arbitrum) before exceeding 100K queries/mo
```

---

## 6. Numbers to re-check before you commit the budget

Flagging these explicitly because they move or because I'm inferring rather than
quoting:

1. **$2 per 100K queries and the 100K free tier** — from
   https://thegraph.com/studio-pricing/, checked 2026-09-23. High confidence, but
   The Graph has repriced before. **Re-read the live pricing page the week you
   submit the budget.** One search result also cited "$1.50–2 per 100K", so treat $2
   as the conservative ceiling.
2. **GRT price (~$0.025)** — checked 2026-09-23 across CoinMarketCap ($0.02558),
   CoinGecko ($0.02728), Coinbase ($0.02349), Kraken ($0.024). **Highly volatile.**
   The 3,000 GRT curation figure is fixed in GRT, so its USD cost moves with the
   token. Re-price on the day you publish.
3. **Arbitrum publishing gas (~$5)** — my estimate, **not a documented figure**. The
   Graph's publishing docs do not state gas costs. Check a gas tracker at publish
   time. Low absolute risk either way.
4. **The 3,000 GRT curation recommendation** — quoted from the publishing docs, and
   it is a *recommendation*, not a requirement. Whether you actually need it depends
   on whether indexers pick up your subgraph without it. Consider publishing first,
   watching indexer allocation for a few days, and signalling only if coverage is
   thin.
5. **Your actual query volume** — "a few million" is the assumption driving the
   whole recurring line. Before committing, instrument the frontend against the
   Studio endpoint to get a real per-session query count, then multiply by expected
   sessions. This is the number most likely to be wrong by an order of magnitude,
   and it is the only one that scales the bill.
6. **Self-host infra estimates ($50–200/month)** — my rough figures, not vendor
   quotes. Only matters if you revisit the §4 decision.

---

## Sources

- [Subgraph Studio Pricing | The Graph](https://thegraph.com/studio-pricing/) — free tier and $2/100K
- [Subgraph Studio | Docs | The Graph](https://thegraph.com/docs/en/subgraphs/billing/) — card vs GRT billing, GRT on Arbitrum
- [Publishing a Subgraph | Docs | The Graph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/) — Arbitrum One, 3,000 GRT curation recommendation
- [How to Query a Subgraph | Docs | The Graph](https://thegraph.com/docs/en/subgraphs/querying/introduction/) — API key querying
- GRT spot price: [CoinMarketCap](https://coinmarketcap.com/currencies/the-graph/), [CoinGecko](https://www.coingecko.com/en/coins/the-graph), [Coinbase](https://www.coinbase.com/price/the-graph), [Kraken](https://www.kraken.com/prices/the-graph)
