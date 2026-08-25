# Shipping the marketplace subgraph to production

Short version: the draft ship step cannot run. The hosted service it targets was shut
off on **12 June 2024**, and the `--hosted-service` flag it uses no longer exists in the
CLI. The real path has an extra step the draft is missing entirely — *deploying* a
subgraph and *publishing* it are two different things, and only the second one produces
an endpoint your frontend can rely on. It costs roughly **$40–50 one-time** and
**~$58/month at 3M queries**, and it does involve tokens.

---

## 1. What the draft runbook gets wrong

Four separate errors, in increasing order of how much they'd hurt:

**"`graph deploy --hosted-service marketplace`"** — The hosted service was retired in
June 2024 as the third phase ("Sunrise") of The Graph's move to the decentralized
network. There is no endpoint behind that flag and no account to authenticate against.
The command fails; there is no fallback.

**"The hosted service is free"** — It was, which is exactly why this belief persists in
draft runbooks and old blog posts. It no longer exists, and nothing free replaced it.
Production queries on The Graph Network are metered and billed.

**"no tokens, no billing, nothing to set up"** — All three are wrong now. Publishing is
an onchain transaction on **Arbitrum One**, so you need a wallet with ETH on Arbitrum for
gas. Queries are billed, payable by card *or* GRT. And you'll almost certainly want to
signal GRT on your own subgraph so indexers actually pick it up.

**The one that would bite you silently: deploy ≠ publish.** This is the error I'd most
want fixed in the runbook, because unlike the others it doesn't fail loudly. `graph
deploy` pushes to **Subgraph Studio**, which is a *testing* environment. It gives you a
working GraphQL endpoint that is rate-limited and explicitly not for production. It's
entirely possible to run `graph deploy`, get a URL back, wire the frontend to it, see
green tests, and ship — and then have it degrade under real traffic. Studio is where you
verify; the network is where you serve. Only `graph publish` crosses that line.

---

## 2. The actual go-live path

You've already done everything up to and including step 0.

**0. Local (done).** Subgraph written, mappings tested, queries verified against a local
Graph Node.

**1. Authenticate to Studio.** Create the subgraph in Subgraph Studio, grab the deploy
key, and:

```bash
graph auth <deploy-key>
```

**2. Build and deploy to Studio — testing only.**

```bash
graph codegen && graph build
graph deploy marketplace
```

Watch it sync against the real chain. This is the step where you find out that your
mappings, which were fine against local test fixtures, hit something unexpected in
production history — a self-destructed contract, a reorg, an event from before your
`startBlock`. **Budget real sprint time here**, not just a command's worth. This is the
most commonly underestimated part of the whole move, and it's the reason to do it early
in the sprint rather than on ship day.

**3. Publish to the network — this is the actual ship step.**

```bash
graph publish
```

This opens a browser window to connect a wallet, attach metadata, and submit the publish
transaction to **Arbitrum One**. *This* is the step your teammate's runbook is missing,
and it's the one with the wallet/gas prerequisite.

**4. Signal curation on your own subgraph.** The docs recommend curating your own
subgraph with **at least 3,000 GRT** to attract indexers to index it. This is not a
formality — without indexers serving your subgraph, your production endpoint has nobody
to answer from. Note that this is a **deposit into a bonding curve, not a fee**: it's
recoverable, minus a **1% curation tax** on the way in (and 0.5% on migration).

**5. Create a query API key and point the frontend at the network endpoint.** Each
published subgraph gets a unique query URL from Graph Explorer, and **each query URL
requires a valid API key** issued from Studio's API Keys section.

**6. Treat the API key as a secret and rate-limit it.** The key is billable — every query
against it draws down your allowance and then your balance. Do **not** ship it in
frontend JS where anyone can extract it and spend your budget. Proxy queries through your
own backend, or at minimum use Studio's per-key domain restrictions and query limits.
This is the operational item most likely to be missing from the runbook after the
technical steps are fixed.

---

## 3. What it costs

### One-time, to stand up

| Item | Cost | Notes |
|---|---|---|
| Publish tx gas (Arbitrum One) | a few dollars | Arbitrum gas is cheap but variable |
| Curation signal | **3,000 GRT ≈ $40** | at ~$0.0133/GRT; recoverable deposit |
| Curation tax (1%) | ~30 GRT ≈ **$0.40** | this part is genuinely spent, not recoverable |
| Studio account | $0 | |

**Realistic standup line: ~$50**, of which only a few dollars is truly consumed — the
bulk is a recoverable GRT position. If your finance process can't carry a recoverable
crypto deposit as an asset, book the full ~$45 as an expense; it's small either way.

### Monthly, at a few million queries

- First **100,000 queries/month are free**.
- Beyond that: **$2 per 100,000 queries**, pay-as-you-grow, no monthly base fee.

At **3M queries/month**: (3,000,000 − 100,000) ÷ 100,000 × $2 = **$58/month**.

For reference across the range you might land in:

| Queries/month | Monthly cost |
|---|---|
| 1M | $18 |
| 3M | $58 |
| 5M | $98 |
| 10M | $198 |

The docs' own worked example — 300K queries = $4/month — matches this arithmetic, which
is a good sign the rate is being applied the way I've assumed.

**This is a small line item.** At a few million queries you are looking at well under
$100/month. If the budget conversation is about whether The Graph is affordable, it
isn't a real concern at your volume; the standup effort in step 2 is the actual cost.

### Payment mechanics

Payable by **credit card** or by **GRT** deposited into a billing balance on Arbitrum
(with ETH on Arbitrum for the deposit gas). **If you want to avoid touching tokens
operationally, use the card** — it's processed monthly for queries over the free quota,
and it keeps recurring spend out of crypto entirely. You'd still need the wallet once, at
publish time; there's no way around that.

---

## 4. Numbers to re-check before you commit them

Everything below is time-sensitive. I checked all of it on **2026-08-19**.

- 🔴 **GRT price — check this first.** I used **~$0.0133/GRT**, but sources spanned
  **$0.0132–$0.0148** *on the same day* (CoinMarketCap $0.01327, CoinDesk $0.014,
  CoinLore $0.0148, Kraken $0.015). That's a ~12% spread, so the 3,000 GRT signal is
  somewhere in **$40–45**. Immaterial at this size, but don't present $40 as precise.
- 🟡 **$2 per 100K queries** — from the live pricing page today. Pull it up yourself
  before the budget is final; it's the number the whole monthly line rests on.
- 🟡 **100K free queries/month** — consistent across the pricing page and the docs, but
  re-confirm alongside the rate.
- 🟡 **3,000 GRT curation recommendation** — a *recommendation* in the docs, not an
  enforced minimum. Worth asking in The Graph's Discord what's actually sufficient for a
  marketplace subgraph today; you may not need the full amount.
- 🟢 **Arbitrum gas for the publish tx** — I did not find a documented figure; the docs
  don't state one. It's small (single-digit dollars), but it's my estimate rather than a
  sourced number. Treat it as such.
- 🟢 **Hosted service sunset (12 June 2024)** — historical fact, won't change.

---

## 5. If you'd rather not use the decentralized network

Both of these are legitimate, and worth a sentence in the runbook so the choice is
recorded rather than defaulted into:

- **Managed subgraph hosts** — Alchemy Subgraphs and SubQuery's Managed Service both
  offer drop-in subgraph hosting, and both positioned themselves as hosted-service
  replacements after the sunset. Different billing model; check their current pricing
  directly, I haven't priced them here.
- **Self-host** — run your own Graph Node, or switch to Ponder. This is a real option and
  can be cheaper at high volume, but you then own the host, the Postgres instance, the
  process supervision, and the on-call. At $58/month for 3M queries, self-hosting is very
  unlikely to be worth it purely on cost.

---

## 6. Suggested replacement text for the runbook

> **Ship step.** Prereqs: a wallet with ETH on Arbitrum One, and ~3,000 GRT for curation
> signal.
>
> 1. `graph auth <deploy-key>`
> 2. `graph codegen && graph build`
> 3. `graph deploy marketplace` — deploys to **Subgraph Studio (testing only)**. Wait for
>    a full sync against mainnet history and re-verify queries. Allow real time here.
> 4. `graph publish` — publishes to **Arbitrum One**. This is the production ship step.
> 5. Signal ~3,000 GRT on the subgraph so indexers serve it.
> 6. Create a query API key in Studio; point the frontend at the Graph Explorer query
>    URL. **Proxy the key through our backend — do not ship it in client JS.**
>
> Cost: ~$50 one-time (mostly a recoverable GRT deposit), ~$58/month at 3M queries
> (100K free, then $2/100K).

---

## Sources

- [The Road to Sunsetting the Hosted Service — The Graph Blog](https://thegraph.com/blog/sunsetting-hosted-service/) — hosted service retirement
- [The Graph Network: The Sunrise of Decentralized Data](https://thegraph.com/blog/transitioning-to-decentralized-graph-network/) — Sunrise completed June 2024
- [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/) — "Your first 100K monthly queries are always free", "$2 per 100,000 queries", 300K = $4 example
- [Subgraph Studio — Docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/) — Free vs Growth plan, GRT-on-Arbitrum vs credit card billing
- [Publishing a Subgraph to the Decentralized Network — Docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/) — Arbitrum One, `graph publish`, wallet flow, 3,000 GRT recommendation
- [Curating — Docs](https://thegraph.com/docs/en/resources/roles/curating/) — 1% curation tax, 0.5% on migration
- [Querying a Subgraph — Docs](https://thegraph.com/docs/en/subgraphs/querying/introduction/) — "Each query URL requires a valid API key"
- [CoinMarketCap GRT](https://coinmarketcap.com/currencies/the-graph/) / [CoinDesk](https://www.coindesk.com/price/the-graph) / [CoinGecko](https://www.coingecko.com/en/coins/the-graph) — GRT spot price, 2026-08-19
- [Alchemy — Sunsetting The Graph's Hosted Service](https://www.alchemy.com/blog/sunsetting-the-graphs-hosted-service) and [SubQuery Managed Service](https://subquery.network/blog/graphs-hosted-service-is-sunset-deploy-your-subgraph-to-subquerys-managed-service-today) — alternative hosts

*All figures checked 2026-08-19.*
