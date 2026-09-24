# Shipping a subgraph to production on The Graph — runbook + budget

Date of research: **2026-09-23**. Every figure below has a source and a
"re-check?" note. Prices move; the GRT-denominated ones move a lot.

---

## 1. What the draft runbook gets wrong

> "run `graph deploy --hosted-service marketplace` … The hosted service is free
>  and gives us a public GraphQL endpoint our frontend can hit straight away —
>  no tokens, no billing, nothing to set up."

Three separate problems, in order of severity:

**a) The hosted service does not exist.** It was shut down on **12 June 2024**.
Query endpoints were switched off and new deployments were disabled at that
point. The command in the draft will fail; there is nothing to deploy to.
Source: [The Graph — "The Road to Sunsetting the Hosted Service"](https://thegraph.com/blog/sunsetting-hosted-service/)
and [Post-Sunrise / Upgrading FAQ](https://thegraph.com/docs/en/archived/sunrise/).

**b) "No tokens" is wrong.** The production path (The Graph Network) is a
protocol on **Arbitrum One**. Publishing is an on-chain transaction: you need a
wallet, **ETH on Arbitrum One** for gas, and — if you want your subgraph picked
up by indexers promptly — **GRT** for curation signal. Billing for queries can
be paid by card, but publishing cannot.

**c) "No billing" is wrong past a small free tier, and "hit it straight away" is
wrong architecturally.** Queries go through a gateway and require an **API key**.
There is a free tier (100k queries/month), and beyond that it is usage-priced.
An API key is a secret-ish credential — you do not want it hardcoded in a public
frontend bundle without domain allowlisting (see §3, step 7).

There *is* one grain of truth worth keeping: you don't have to run your own
Graph Node in production. But "free, tokenless, zero-setup" is not the deal.

---

## 2. The three real options (pick one before writing the runbook)

| Option | What it is | Tokens needed? | Rough monthly at 3M queries |
|---|---|---|---|
| **A. The Graph Network** (Subgraph Studio → publish) | Decentralized indexers, canonical path | Yes — ETH for gas, GRT for signal (recommended) | ~$58 (see §4) |
| **B. Third-party hosted** (Goldsky, Alchemy Subgraphs, Chainstack, SubQuery) | Same subgraph code, centralized provider, no chain interaction | No | ~$37+/mo base per worker on Goldsky, plus entity fees |
| **C. Self-host Graph Node** | Your own graph-node + Postgres + archive RPC | No | Highest (infra + archive node + on-call), most control |

The rest of this assumes **Option A**, since that's what "ship to The Graph"
means, but §6 covers when B or C is the better budget line.

---

## 3. The actual go-live runbook (Option A)

1. **Create the subgraph in Subgraph Studio** (`thegraph.com/studio`) with the
   deploying wallet. This gives you a Studio deploy key and a *development*
   query URL. Studio queries are for testing only — rate-limited, not a
   production endpoint.
2. **`graph auth <deploy-key>`**, then **`graph codegen && graph build`**.
3. **`graph deploy <subgraph-slug>`** — this deploys to Studio, not to the
   network. Bump the version label; Studio keeps versions.
4. **Wait for it to sync in Studio and re-run your GraphQL test suite against
   the Studio endpoint.** This is the last cheap place to catch a bad mapping —
   after publishing, fixing means a new version + another on-chain tx.
5. **Publish to the network**: `graph publish` (graph-cli ≥ 0.73.0) or the
   Publish button in Studio. This opens a wallet connection and submits a
   transaction on **Arbitrum One** (Arbitrum Sepolia available for a dry run).
   You need ETH on Arbitrum One in that wallet *before* this step. Note the
   subgraph can index any supported chain regardless of publishing on Arbitrum.
   Source: [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/).
6. **Signal curation on your own subgraph.** The docs recommend curating your
   own subgraph with **at least 3,000 GRT** so indexers actually pick it up and
   it's queryable promptly. It is framed as a recommendation, not a hard
   protocol requirement — but treat it as required in practice if you care about
   "indexed and available *soon*." Source: same publishing doc.
7. **Create a production API key** in Studio, **restrict it** (domain
   allowlist + subgraph allowlist), and point the frontend at the gateway URL
   (`https://gateway.thegraph.com/api/subgraphs/id/<subgraph-id>`). Two keys:
   one for staging, one for prod, so you can rotate without downtime.
   ⚠️ Re-check the exact gateway URL shape in the docs at build time — The Graph
   has changed it (older `.../api/<api-key>/subgraphs/id/...` form put the key in
   the path). Best practice is to proxy the key through your own backend rather
   than shipping it in the browser bundle.
8. **Set up billing**: add a payment method (card via Stripe, or GRT on
   Arbitrum) in Studio before you cross the free tier, or queries start failing.
   Source: [Subgraph Studio billing docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/).
9. **Monitor**: alert on indexing lag (compare `_meta { block { number } }`
   against chain head), gateway error rate, and monthly query count vs. budget.
10. **Plan the upgrade path**: publishing a new version is another on-chain tx;
    curation signal auto-migrates to the new version. Budget gas per release,
    not just once.

---

## 4. The money

### Stand-up (one-time)

| Item | Amount | Source | Re-check? |
|---|---|---|---|
| Publish tx gas (Arbitrum One) | low single-digit USD, typically **< $5** | Arbitrum L2 gas norms — *not* a published Graph figure | **YES — this is my estimate, not a quoted number.** Check live Arbitrum gas before committing. |
| Curation signal | **3,000 GRT** recommended ≈ **$51–$84** at GRT $0.017–$0.028 | Amount: [publishing doc](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/); price range: CoinMarketCap $0.02558 / CoinGecko $0.02728 / Kraken $0.024 / Bitget $0.01771, [CoinGecko GRT](https://www.coingecko.com/en/coins/the-graph) | **YES, twice over.** (i) GRT price is volatile — re-price on the day. (ii) The "3,000 GRT" figure dates from ~May 2024, when GRT was worth far more in USD; verify The Graph hasn't revised the recommendation. |
| Curation tax on signalling | ~1% of signalled GRT, burned | Protocol curation tax — **from memory, unverified today** | **YES — verify in the curating docs.** Materially it's ~$1 here, so it won't move your budget, but don't quote it as fact. |

**Important nuance for the budget line:** curation signal is *not* a fee. It's a
deposit into a bonding curve — you can withdraw it later, minus the curation tax
and minus/plus whatever the curve and GRT price did in the meantime. So it
belongs on the balance sheet as a small, illiquid, price-volatile asset, not as
opex. Finance will ask; say it before they do. It also means someone has to
**acquire and custody GRT**, which may be the slowest part of the whole
sprint if your org has a token-procurement process.

**Realistic stand-up total: roughly $60–$100**, dominated by the GRT signal, plus
whatever internal time the wallet/treasury dance costs.

### Per month at ~3,000,000 queries

- Free tier: **100,000 queries/month, free.**
- Beyond that: **$2 per 100,000 queries**, usage-based (Growth plan).
- Sources: [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/)
  (states "100,000 free monthly queries", "$2 per 100,000 queries", and an
  example of ~$4/month at 300k queries) and the
  [billing docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/).

```
3,000,000 − 100,000 free = 2,900,000 billable
2,900,000 / 100,000 = 29 units × $2 = $58.00 / month
```

**≈ $58/month at 3M queries.** Even at 10M queries it's ~$198/month. This is a
rounding error next to an engineer-hour; the real cost of Option A is the token
handling, not the query bill.

⚠️ **Re-check the $2 figure.** I have it from The Graph's own pricing page today,
but: (a) it has changed historically — $4/100k was the widely-quoted number
earlier; (b) one search result quoted a **$1.50–$2 per 100k** range, reflecting
that the gateway routes to indexers whose prices vary, so your effective rate may
not be exactly $2. Budget at $2/100k and treat it as the ceiling for planning;
confirm on the pricing page the day you submit the budget.

⚠️ **Also re-check:** whether payment is drawn down from a prepaid GRT balance or
billed in arrears on a card, and whether there's a minimum top-up. If it's a
prepaid GRT balance, you have a second small treasury/ops burden (keeping it
funded) and a second FX exposure. The docs confirm both card (Stripe) and GRT on
Arbitrum are accepted but don't spell out the drawdown mechanics.

---

## 5. What to put in the runbook that the draft omits entirely

- **A wallet with ETH on Arbitrum One** must exist and be funded *before* ship
  day, and someone must be authorized to sign with it. This is usually the
  thing that slips the sprint.
- **GRT acquisition lead time** — exchange → Arbitrum One → wallet. Bridging and
  KYC are not same-day in most orgs.
- **API key handling** — restricted keys, staging vs. prod, rotation procedure,
  and a decision on browser-direct vs. backend-proxied queries.
- **Rollback plan** — you can't un-publish. Rollback = publish a corrected
  version and repoint. Keep the last-known-good Studio deployment alive.
- **A sync-lag SLO**, because "indexed" is not instant and indexers pick up your
  subgraph on their own schedule; signal influences how fast.
- **Who pays the bill** — a card on file or a funded GRT balance, owned by a
  team, not by whoever happened to run `graph publish`.

---

## 6. When to pick Option B or C instead

- **Option B (Goldsky / Alchemy Subgraphs / Chainstack / SubQuery):** choose
  this if your org can't or won't hold tokens, or you want a single
  credit-card line item and an SLA with a support contact. Goldsky's published
  model is **$0.05/hr per subgraph worker (~$36.50/mo) + $4 per 100k entities**,
  with a free tier; Alchemy also has a free plan.
  Sources: [Goldsky pricing](https://goldsky.com/pricing),
  [Chainstack's 2026 comparison](https://chainstack.com/top-5-hosted-subgraph-indexing-platforms-2026/).
  ⚠️ Re-check both — third-party pricing pages change more often than protocol
  parameters, and Goldsky's entity-based metering means your cost depends on
  *data volume*, not query count, so you'd need your own entity estimate to
  produce a comparable number. Don't port my $58 across.
  Note the trade-off you're buying: a single provider becomes a hard dependency
  and a censorship/outage single point — which is the thing The Graph Network
  exists to avoid.
- **Option C (self-host):** only if you need custom graph-node features, data
  residency, or you already run an archive node. Otherwise the archive-RPC plus
  Postgres plus on-call cost dwarfs $58/month by orders of magnitude.

---

## 7. Bottom line for the budget line

- **Stand-up: ~$60–$100** (≈3,000 GRT signal, refundable-ish, + a few dollars of
  Arbitrum gas). Plus non-trivial *people* time to set up a funded wallet and
  acquire GRT.
- **Run: ~$58/month at 3M queries** ($2 per 100k after 100k free).
- **Not free, and definitely not tokenless** — but cheap. The draft's error is
  not that it underestimated the cost; it's that it points at infrastructure
  that was switched off in June 2024 and assumes an org process (token custody)
  that doesn't exist yet.

**Re-check before committing:** the $2/100k rate, the live GRT price, whether
3,000 GRT is still the recommended signal, the curation-tax percentage, Arbitrum
gas on the day, and the gateway URL/API-key format. The two that could actually
move the number are the GRT price and the per-100k rate.

## Sources

- [The Road to Sunsetting the Hosted Service — The Graph](https://thegraph.com/blog/sunsetting-hosted-service/)
- [Post-Sunrise + Upgrading to The Graph Network FAQ — The Graph Docs](https://thegraph.com/docs/en/archived/sunrise/)
- [Publishing a Subgraph — The Graph Docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/)
- [Subgraph Studio Pricing — The Graph](https://thegraph.com/studio-pricing/)
- [Subgraph Studio / billing — The Graph Docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/)
- [Quick Start — The Graph Docs](https://thegraph.com/docs/en/subgraphs/quick-start/)
- [The Graph (GRT) price — CoinGecko](https://www.coingecko.com/en/coins/the-graph) · [CoinMarketCap](https://coinmarketcap.com/currencies/the-graph/)
- [Goldsky pricing](https://goldsky.com/pricing) · [Goldsky vs The Graph](https://goldsky.com/compare/the-graph)
- [Top 5 hosted Subgraph indexing platforms in 2026 — Chainstack](https://chainstack.com/top-5-hosted-subgraph-indexing-platforms-2026/)
- [The Graph's Hosted Service is Shutting Down — Alchemy](https://www.alchemy.com/blog/sunsetting-the-graphs-hosted-service)
