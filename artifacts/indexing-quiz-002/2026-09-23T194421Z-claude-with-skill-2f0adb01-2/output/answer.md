# Shipping a subgraph to production: the real go-live path

**Date of research: 2026-09-23.** Every figure below has a source. The ones you must
re-check before signing off on a budget are marked **⚠️ RE-CHECK**.

---

## TL;DR for the runbook and the budget

| Line item | Cost | Confidence |
|---|---|---|
| Subgraph Studio account + dev endpoint | $0 | Stable |
| Publish transaction (Arbitrum One gas) | low single-digit USD, one-off | ⚠️ gas-dependent |
| Self-curation signal, 3,000 GRT recommended | ≈ **$76** one-off at GRT $0.0254 | ⚠️ **RE-CHECK — GRT is volatile** |
| Curation tax (1% of signal) | ≈ $0.76, non-refundable | Stable |
| Queries: first 100,000/month | $0 | Stable |
| Queries beyond that | **$2 per 100,000** | Stable-ish |
| **3M queries/month** | **$58/month** | see math below |
| Re-publishing a new version | gas + 0.5–1% migration tax | Stable |

**Stand-up: roughly $80–100 all-in.** **Run: ~$58/month at 3M queries.**
The big uncertainty is not the dollar amount — it's GRT's price and your real query volume.

---

## 1. What the draft runbook gets wrong

The draft step is:

> `graph deploy --hosted-service marketplace` … "The hosted service is free and gives us a
> public GraphQL endpoint our frontend can hit straight away — no tokens, no billing,
> nothing to set up."

There are five errors, and the first one is fatal.

### 1.1 The hosted service no longer exists

The Graph's hosted service was **sunset on June 12, 2024**. It is not deprecated-but-working;
it is off. All queries are now served by The Graph Network.
([The Graph blog: "The Road to Sunsetting the Hosted Service"](https://thegraph.com/blog/sunsetting-hosted-service/),
[The Graph blog: "The Sunrise of Decentralized Data"](https://thegraph.com/blog/transitioning-to-decentralized-graph-network/),
[Alchemy: "The Graph Hosted Service is Shutting Down"](https://www.alchemy.com/blog/sunsetting-the-graphs-hosted-service))

So `graph deploy --hosted-service marketplace` will not "push it to the hosted service." The
flag is gone from the CLI. This step doesn't produce a degraded endpoint — it produces an
error, and the sprint stalls on day one. **This is the single most important correction.**

### 1.2 "Free" is wrong — queries are metered

The Graph Network gives you **100,000 free queries per month**, then charges
**$2 per 100,000 queries**. There is no base fee and no minimum deposit.
([Subgraph Studio Pricing](https://thegraph.com/studio-pricing/))

At "a few million queries" you are a paying customer. See §4.

### 1.3 "No tokens" is wrong — twice

Going to production involves both ETH and GRT:

- **Publishing is an onchain transaction on Arbitrum One.** The `graph publish` command
  targets Arbitrum One by default, so you need a wallet with ETH on Arbitrum One to pay gas.
  ([Publishing a Subgraph docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/))
- **You should signal GRT on your own subgraph.** The docs recommend curating your own
  subgraph with **at least 3,000 GRT** "in order to attract additional indexers to index your
  Subgraph." (same source) Without signal, indexers may not pick it up promptly — which
  directly undermines "a production endpoint we can rely on."

So "no tokens" is the opposite of true. This also means go-live needs a funded wallet, which
is a procurement/custody task with a lead time — put it early in the runbook, not on ship day.

### 1.4 "Public endpoint the frontend can hit straight away" — you need an API key

Queries go through the gateway and **API keys are required**:

```
https://gateway.thegraph.com/api/<YOUR_API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```

or via an `Authorization: Bearer <YOUR_API_KEY>` header.
([Managing API keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/))

This matters for your budget, not just your code. The key is a **billing credential**. If you
ship it in frontend JavaScript unprotected, anyone can read it out of the bundle and spend
your money at $2/100K. Mitigations, all in that same doc:

- **Domain allowlisting** — restrict the key to your authorized domains.
- **Subgraph restrictions** — bind the key to only your subgraph.
- **Monthly spending limit in USD** — a hard cap per key.

My recommendation: use a browser-exposed key *with* allowlisting and a spend cap for
low-risk reads, and proxy anything high-volume through your own backend so the key never
leaves your infrastructure. Domain allowlisting is a referer check — it deters casual abuse,
it is not authentication.

### 1.5 Deploying to Studio is not shipping

Even the correct `graph deploy` only gets you to Subgraph Studio, which the docs describe as
"free to use, **rate-limited, not visible to the public**, and meant to be used for
development, staging, and testing purposes."
([Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/))

Rate limits are removed only once you publish to the network. A runbook that stops at
`graph deploy` ships a staging endpoint to production. That is the second-most-likely way
this sprint goes wrong, because unlike §1.1 it *appears* to work.

---

## 2. The correct go-live path

"Works locally" → "frontend hitting a production endpoint" is five stages, not one command.

### Stage 0 — Prerequisites (do these before ship day)

- A wallet you control, funded with **ETH on Arbitrum One** (gas) and **~3,000 GRT** (signal).
  Bridging/acquiring GRT has a lead time; it is the most common cause of a slipped go-live.
- Decide who owns that wallet. The publishing wallet controls future version upgrades — this
  is a key-management decision, not a developer convenience. Treat it like a deploy key.

### Stage 1 — Studio (staging)

```bash
npm install -g @graphprotocol/graph-cli
graph codegen && graph build
graph deploy marketplace          # modern form; no --hosted-service, no --studio needed
```

Source for command shapes: [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/).

Then let it sync fully against the real network and re-run your existing GraphQL queries
against the Studio endpoint. This is the step that catches the difference between your local
Graph Node and production: real reorgs, real contract history from the true start block,
real data volume. Your local tests do not cover this. Budget calendar time here — a subgraph
with an early start block on a busy chain can take hours to days to sync, and that is
wall-clock time in your sprint that costs nothing in dollars but can absolutely blow the date.

### Stage 2 — Publish to the network

```bash
graph publish
```

This opens a browser flow, connects your wallet, and submits the publish transaction to
**Arbitrum One**. Costs gas in ETH.
([Publishing docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/))

### Stage 3 — Signal curation so indexers actually serve you

Signal **≥3,000 GRT** on your own subgraph (docs' own recommendation, as of their May 2024
guidance). You pay a **1% curation tax** on the initial signal.
([Curating docs](https://thegraph.com/docs/en/resources/roles/curating/))

Then **wait and verify** that at least one indexer — ideally more than one — has synced and
is serving your subgraph before you cut traffic over. Do not treat "publish transaction
confirmed" as "endpoint is live." Add an explicit verification gate to the runbook here.

### Stage 4 — API key, then cut over

1. Create an API key in Studio.
2. Set **domain allowlisting**, **restrict it to your subgraph**, and set a **monthly USD
   spending limit**. The spend limit is your blast-radius control; set it even though the
   expected bill is small.
3. Point the frontend at `https://gateway.thegraph.com/api/<KEY>/subgraphs/id/<SUBGRAPH_ID>`,
   with the key from an environment variable or secrets manager — never hardcoded.
   ([API key docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/))

### Stage 5 — Ongoing operations (the part runbooks always omit)

- **New versions:** every contract or mapping change means `graph deploy` → `graph publish`
  a new version → gas again, plus a **0.5% curation tax on auto-migrated signal** (1% if you
  migrate manually). ([Curating docs](https://thegraph.com/docs/en/resources/roles/curating/))
  Budget this per-release, not once.
- **Re-sync on republish:** a new version indexes from scratch. Keep the old version serving
  until the new one has caught up, then switch. This needs to be a documented procedure,
  because doing it wrong means a gap in your frontend's data.
- **Monitoring:** alert on subgraph sync lag and on indexing errors. A subgraph that has
  silently failed is the classic production incident here — "a failed Subgraph does not
  accrue query fees" (Curating docs), and more to the point it stops serving fresh data
  while still returning HTTP 200 on stale data.
- **Query volume monitoring:** your bill is usage-based, so a frontend bug that polls in a
  loop is now a financial event, not just a performance one.

---

## 3. Stand-up cost

| Item | Amount | Basis |
|---|---|---|
| Studio account, dev endpoint | $0 | [Pricing](https://thegraph.com/studio-pricing/) |
| Arbitrum One publish gas | low single-digit USD | Arbitrum L2 fee norms — ⚠️ not a quoted figure |
| Self-curation signal | 3,000 GRT ≈ **$76.20** | 3,000 × $0.0254 ([CoinGecko](https://www.coingecko.com/en/coins/the-graph)) |
| Curation tax, 1% | 30 GRT ≈ **$0.76** | [Curating docs](https://thegraph.com/docs/en/resources/roles/curating/) |

**≈ $80–100 one-off.**

Two important framings for the budget line:

- **The 3,000 GRT signal is mostly a refundable deposit, not an expense.** You can withdraw
  signal later. Only the 1% tax is definitively spent. But do **not** budget it as fully
  recoverable: the docs warn that signal sits on a bonding curve, that withdrawals reduce the
  GRT valuation of remaining shares, and that in a mass-withdrawal scenario remaining curators
  may "withdraw a fraction of their initial GRT." Budget it as *at-risk capital*, with the
  1% as the only certain cost.
- **At GRT ≈ $0.025 this is currently cheap in dollar terms.** That is a statement about
  today's token price, not about the protocol. It is the single most volatile input you have.

---

## 4. Monthly cost at a few million queries

Pricing: 100,000 free queries/month, then **$2 per 100,000**.
([Subgraph Studio Pricing](https://thegraph.com/studio-pricing/); the page's own worked
example — 300,000 queries ≈ $4 — is consistent with that rate.)

Formula: `cost = max(0, (queries − 100,000) / 100,000) × $2`

| Monthly queries | Chargeable | Monthly cost |
|---|---|---|
| 100,000 | 0 | **$0** |
| 1,000,000 | 900,000 | **$18** |
| **3,000,000** | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |
| 10,000,000 | 9,900,000 | **$198** |

**For "a few million queries": budget ~$58/month at 3M, ~$98/month at 5M.**

Payment is by card or crypto, no minimum deposit ([Pricing](https://thegraph.com/studio-pricing/)).

### Read this before you commit the monthly number

The per-query price is the *reliable* part of this estimate. **Your query count is not.**
In my experience this is where indexing budgets go wrong by an order of magnitude, in both
directions:

- **A "query" is a GraphQL request, not a page view.** One page that fires six queries on
  load, at 5 polls/minute per active session, generates volume very differently than
  "monthly active users" intuition suggests.
- **Polling dominates.** If the frontend polls, your bill scales with *session-seconds*,
  not with users. Switching a 5-second poll to 30 seconds cuts that component 6×.
- **Client-side caching is a direct cost lever.** Apollo/urql cache configuration is now a
  line item.
- **⚠️ Measure, don't model.** You already have a working subgraph. Instrument the frontend
  against the Studio endpoint, count actual requests per session, and multiply by projected
  sessions. That measured number is worth more than any estimate in this document.

The good news: at these prices, even being wrong by 3× moves you from $58 to ~$180/month.
This is a rounding error next to one engineer-day. **Don't over-engineer the estimate — but
do set the API key spend limit**, because the failure mode that actually hurts is a runaway
client, not a mis-forecast.

---

## 5. Figures to re-check before committing

| # | Figure | Why it can move |
|---|---|---|
| 1 | **GRT at $0.0254** | Most volatile input. Sources disagreed noticeably during research — CoinGecko showed **$0.02542**, while forecast sites quoted ~$0.013–0.023 for this month. Price-prediction sites are not evidence; I used the CoinGecko spot figure and you should re-pull spot on the day you fund the wallet. At 3,000 GRT, a 2× price move is only ±$76, so this changes the *token* ask more than the *dollar* ask. |
| 2 | **3,000 GRT recommendation** | The docs attribute this to guidance "as of May 2024." It is a *recommendation to attract indexers*, not a protocol minimum — no minimum signal is specified anywhere in the curation docs. Re-read the publishing page at go-live; and treat the right amount as an empirical question: signal, then check whether indexers actually pick you up. |
| 3 | **$2 per 100,000 queries** | Published pricing can change. Re-pull [thegraph.com/studio-pricing](https://thegraph.com/studio-pricing/) on the day you finalise the budget. |
| 4 | **100,000 free queries/month** | Same source, same caveat. Also confirm whether it is per-account or per-subgraph if you plan several subgraphs — I did not find that stated explicitly, and it matters if you add chains. |
| 5 | **Arbitrum publish gas** | I could **not** find this quoted in The Graph's docs, and I am not quoting a number I don't have a source for. It is an ordinary L2 contract call — expect low single-digit dollars — but confirm by simulating the publish on **Arbitrum Sepolia** first, which the CLI supports. |
| 6 | **Your query volume** | See §4. The only figure here you can measure yourself, and the one most likely to be wrong. |

Two of these — #5 and #6 — are things you can *resolve* rather than estimate: publish to
Arbitrum Sepolia to see real gas, and instrument the frontend to see real query counts. I'd
do both during the sprint rather than carry them as budget risk.

---

## 6. One structural point about "an endpoint we can rely on"

Worth raising while you're writing the runbook, because it affects the reliability language
you commit to, not just the cost.

The hosted service was a single operator you could page. The Graph Network is a marketplace
of independent indexers. Your subgraph is served well when indexers find it worth serving —
which is exactly what the curation signal is for. The practical consequences:

- **Verify indexer coverage as a go-live gate,** and monitor it afterwards. "Published" is
  not "served," and coverage can change over time.
- **Prefer more than one indexer serving your subgraph** before you depend on it.
- **Decide your fallback now.** For a marketplace frontend, the honest question is what the
  UI does when the gateway is slow or your subgraph has stalled. Direct RPC reads can cover
  *current* state (listings, balances) as a degraded mode — but they cannot reconstruct
  historical feeds, which is precisely why you built the subgraph. So the fallback is
  "show current state, degrade the activity feed," not "fall back to RPC."

If a hard uptime SLA is a requirement rather than a preference, that's a different
conversation — managed subgraph hosts (Alchemy, Goldsky) and self-hosted Graph Node both
offer contractual SLAs at higher and less predictable cost. At your volume, The Graph Network
at ~$58/month is the right default; I'd only revisit it if a written SLA turns out to be a
procurement requirement.

---

## Corrected runbook step

Replace the draft's one line with:

> **Ship steps:**
> 1. **Pre-flight:** fund the publishing wallet with ETH on Arbitrum One and ~3,000 GRT.
>    Confirm wallet custody/ownership.
> 2. `graph codegen && graph build && graph deploy marketplace` → Studio (staging;
>    rate-limited, non-public). Let it fully sync; re-run the GraphQL query suite against it.
> 3. `graph publish` → publishes to Arbitrum One. Costs ETH gas.
> 4. Signal ≥3,000 GRT on our own subgraph (1% curation tax).
> 5. **Gate:** verify ≥1 (preferably >1) indexer has synced and is serving before cutting over.
> 6. Create an API key; enable domain allowlisting, restrict it to our subgraph, set a monthly
>    USD spend limit. Store it in the secrets manager.
> 7. Point the frontend at
>    `https://gateway.thegraph.com/api/<KEY>/subgraphs/id/<SUBGRAPH_ID>`.
> 8. Add alerting on sync lag, indexing errors, and monthly query volume.
>
> **Not free.** ~$80–100 one-off (mostly recoverable GRT signal), ~$58/month at 3M queries.

---

## Sources

- [The Road to Sunsetting the Hosted Service — The Graph](https://thegraph.com/blog/sunsetting-hosted-service/)
- [The Graph Network: The Sunrise of Decentralized Data — The Graph](https://thegraph.com/blog/transitioning-to-decentralized-graph-network/)
- [Sunsetting The Graph's Hosted Service — Alchemy](https://www.alchemy.com/blog/sunsetting-the-graphs-hosted-service)
- [Subgraph Studio Pricing — The Graph](https://thegraph.com/studio-pricing/)
- [Quick Start — The Graph Docs](https://thegraph.com/docs/en/subgraphs/quick-start/)
- [Publishing a Subgraph to the Decentralized Network — The Graph Docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/)
- [Curating — The Graph Docs](https://thegraph.com/docs/en/resources/roles/curating/)
- [Managing API Keys — The Graph Docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/)
- [The Graph (GRT) price — CoinGecko](https://www.coingecko.com/en/coins/the-graph)
