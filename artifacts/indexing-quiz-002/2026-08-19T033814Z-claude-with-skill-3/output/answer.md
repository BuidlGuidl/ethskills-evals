# Shipping the marketplace subgraph to production

Checked live on **2026-08-19**. Every figure below has a source URL; the ones I'd
re-check before they go in a budget are marked **⚠ RE-CHECK**.

---

## 1. What the draft runbook gets wrong

> "run `graph deploy --hosted-service marketplace` ... The hosted service is free and
> gives us a public GraphQL endpoint ... no tokens, no billing, nothing to set up."

Four things are wrong, and they compound:

**a) The hosted service does not exist.** It was decommissioned on **12 June 2024**.
The command will not fail with a nice "deprecated" message pointing you somewhere —
there is no endpoint behind it. Any runbook step that starts `graph deploy --hosted-service`
is dead on arrival.
Source: [The Graph — The Road to Sunsetting the Hosted Service](https://thegraph.com/blog/sunsetting-hosted-service/)

**b) "Deploy" is not "publish".** This is the part that bites teams even after they
find Subgraph Studio. `graph deploy` pushes to **Subgraph Studio**, which is a
*testing* environment: rate-limited, not the endpoint you point production at. Going
live is a second, separate action — **publish** the subgraph to the decentralized
network — done from the Studio dashboard's Publish button or via `graph publish`. If
your runbook stops at `graph deploy`, you ship a subgraph that appears to work and
then throttles your users.
Source: [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/), [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/)

**c) There is no "no tokens" path.** Two distinct token/key things are unavoidable:

- a **deploy key** (from Studio) to authenticate `graph auth`/`graph deploy`; and
- an **API key** (from Studio) that every production query must carry. The gateway
  will not serve an anonymous request.

And publishing itself is an **onchain transaction on Arbitrum One** — so a wallet
holding ETH on Arbitrum for gas is a hard prerequisite, plus GRT if you signal (see §3).
Source: [Managing API keys](https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/), [Subgraph Studio / billing](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/)

**d) "Free" is only true up to 100K queries/month.** Beyond that it's metered. At the
"few million queries" you're sizing for, this is a real (if small) monthly line item,
and it needs a funded payment method or the endpoint stops serving. See §4.
Source: [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/)

The net effect of the draft: a step that can't run, no billing set up, no API key
provisioned, and a frontend wired to a URL that doesn't exist.

---

## 2. The actual go-live path

Ordered as runbook steps. Steps 1–3 you've effectively done already ("works locally").

1. **Create the subgraph in Subgraph Studio.** Connect the deployer wallet at
   Subgraph Studio; this is also where the deploy key and API keys live.
2. **Build.** `graph codegen && graph build`
3. **Authenticate and deploy to Studio (testing).**
   ```bash
   graph auth <DEPLOY_KEY>
   graph deploy <SUBGRAPH_SLUG>
   ```
   Wait for it to sync in the Studio dashboard, then re-run your existing GraphQL
   queries against the Studio endpoint. This replaces "works against local Graph Node"
   with "works against The Graph's infrastructure" — a genuinely different check,
   because Studio pins you to real chain data and real handler timing.
4. **Publish to the network (this is go-live).** Publish button in Studio, or
   `graph publish`. This is an Arbitrum One transaction: **you need a wallet with ETH
   on Arbitrum One**. The subgraph is published on Arbitrum One regardless of which
   chain it indexes — publishing on Arbitrum rather than Ethereum mainnet is the
   cheap path and the current default.
5. **Signal on your own subgraph (optional but recommended).** The docs recommend
   self-curating **at least 3,000 GRT** so indexers pick it up promptly. Without any
   signal, indexing/serving is not guaranteed on a useful timeline. See §3 for cost.
6. **Set up billing.** Add a credit card, or deposit GRT into the billing contract on
   **Arbitrum One** (ETH on Arbitrum needed for that gas too). Card invoices are
   processed at month end. Do this *before* traffic ramps — the free tier is 100K/month
   and a launch spike will blow through it.
7. **Create a production API key and lock it down.** In the key's Security section,
   set **authorized domains** and **restrict the key to this subgraph**. Do both — the
   gateway URL carries the API key in the path:
   ```
   https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
   ```
   which means a browser-side fetch **publishes your key to anyone with devtools**.
   Domain restriction is the mitigation if you query from the client; a thin
   server-side proxy (Next.js route handler or similar) is the stronger option and
   keeps the key in an env var. Pick one deliberately and write it in the runbook —
   this is the most commonly skipped production step here.
8. **Repoint the frontend** from the local Graph Node URL to the gateway URL, and
   verify. Keep the URL and key in environment config, not in source.
9. **Write down the update path.** A schema or mapping change means
   `graph codegen && graph build` → `graph deploy` (test in Studio) → publish a new
   version (another Arbitrum transaction). Metadata-only edits don't create a new
   version. Curators on auto-migrate pay 0.5% to follow you. Budget one Arbitrum tx
   per production subgraph release.

Sources: [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/), [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/), [Billing / Studio](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/), [Managing API keys](https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/), [Querying from an application](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/), [Curating](https://thegraph.com/docs/en/resources/roles/curating/)

---

## 3. Stand-up cost (one-time)

| Item | Cost | Source / note |
|---|---|---|
| Studio account, deploy key, API key | $0 | [Studio pricing](https://thegraph.com/studio-pricing/) |
| Publish transaction (Arbitrum One) | gas only — typically cents to low single-digit dollars | **⚠ RE-CHECK.** No published figure; depends on Arbitrum gas at the time. Budget ~$5 and move on. |
| Self-curation signal | **3,000 GRT** recommended | [Publishing docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/) — note the docs phrase this as "as of May 2024", so the number is aging. **⚠ RE-CHECK.** |
| → 3,000 GRT in USD | ≈ **$40–$50** at GRT ≈ $0.013–$0.017 | **⚠ RE-CHECK — this is the most volatile number on the page.** Sources disagreed *on the same day*: [CoinDesk](https://www.coindesk.com/price/the-graph) showed ~$0.014 (6 Aug 2026), [CoinMarketCap](https://coinmarketcap.com/currencies/the-graph/) ~$0.0133, another ~$0.0164. Price it the day you buy. |
| Curation tax on that signal | **1%** of signalled amount, non-refundable | [Curating](https://thegraph.com/docs/en/resources/roles/curating/) — so ~$0.50 of a ~$45 signal is a true cost |

**Important framing for the budget:** the 3,000 GRT is **not an expense — it's a
deposit.** Signal is withdrawable at any time with no cooldown; you get it back minus
the 1% tax, plus or minus GRT price movement and bonding-curve effects. Book it as a
treasury position with ~$0.50 of real cost, not as ~$45 of spend. It does mean someone
has to actually acquire GRT on Arbitrum One before go-live — that's a procurement
lead-time item, not a technical one, and it's the step most likely to delay your sprint.

**Realistic all-in stand-up: under $100**, and most of that is recoverable.

---

## 4. Running cost (per month)

Pricing: **first 100,000 queries/month free, then $2 per 100,000 queries**
(= $0.00002/query). The pricing page's own worked example — 300,000 queries → $4 —
is consistent with this.
Source: [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/)

| Monthly queries | Billable (minus 100K free) | Cost |
|---|---|---|
| 1,000,000 | 900,000 | **$18** |
| 3,000,000 | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |
| 10,000,000 | 9,900,000 | **$198** |

**At "a few million queries", budget roughly $60–$100/month.** There is no base fee,
no seat cost, and no minimum commitment — you're charged for what you use and can
withdraw a GRT balance at any time.

**⚠ RE-CHECK on the $2 figure.** Two reasons. First, this rate has moved before —
it was $4/100K after the hosted-service sunset and is $2/100K now, so it is
demonstrably not a fixed constant. Second, a third-party summary I hit quoted a
"$1.50–$2 per 100K" range, hinting at volume tiers below the headline rate; the
official pricing page shows only the flat $2. If you're committing a 12-month number,
load the pricing page yourself and check for a volume tier at your expected level.

**Also size your query count honestly before you trust the table.** "A few million
queries" is an input, not a fact — a marketplace frontend that fires 4–6 GraphQL
requests per page view multiplies faster than people expect. Get the real number from
your local testing and page-view projections, because at $0.00002/query the cost is
linear with no ceiling, and a 5× traffic surprise is a 5× bill. It's still small in
absolute terms — this is a rounding error next to an RPC bill — but the budget line
should say what traffic it assumes.

**Non-obvious operational cost:** if you pay by credit card, the card must stay valid;
if you pay in GRT, the billing contract balance must stay funded. **Either one running
dry takes your production endpoint down.** Put a balance/expiry check in the runbook
with an owner and a threshold alert. This is the thing that pages you at 2am six
months from now.

---

## 5. Alternatives, briefly

You don't have to use The Graph's network, but every alternative moves cost from
"metered queries" to "infrastructure you own and supervise."

- **Self-hosted Graph Node.** Your subgraph runs as-is. You now own: a host, a
  **Postgres with a real persistence/backup story**, IPFS, an archive-capable RPC
  endpoint, and process supervision. The archive RPC is usually the dominant line, and
  the Postgres is usually the thing that quietly breaks. **⚠ RE-CHECK** any dollar
  figure here against your specific host/RPC vendor's pricing page — I'm not quoting
  one, because it varies too much to be worth putting in a budget secondhand. Sensible
  only if you already run infrastructure; for a "few million queries/month" workload
  this is very likely more expensive in engineer-hours than $60–$100/month.
- **Goldsky** — hosted, deploys existing subgraphs. Free Starter tier; Scale is
  usage-based at roughly **$0.05/worker-hour** (≈$36/mo per continuously-running
  worker) plus about **$4 per 100K entities**. **⚠ RE-CHECK** — this is a
  worker-hours-plus-data model, not per-query, so it does not compare apples-to-apples
  with the table in §4, and the rates were reported as of ~June 2026.
  Source: [Goldsky pricing](https://goldsky.com/pricing)
- **Alchemy Subgraphs / SubQuery** — both marketed as drop-in hosted-service
  replacements. I did not find current per-month pricing; check their pages directly
  if you want a quote.
- **Ponder** — a different indexing framework (TypeScript, not subgraph manifests).
  Rewriting is not justified here: your subgraph is written and tested. Ignore unless
  you hit a wall The Graph can't clear.

**Recommendation:** publish to The Graph Network. Your subgraph already exists and is
tested, the migration is the two commands in §2, and $60–$100/month is cheaper than
one afternoon of anyone maintaining a Postgres.

---

## 6. The runbook step, corrected

Replace the teammate's single line with:

```bash
# 1. build
graph codegen && graph build

# 2. deploy to Studio (TESTING ONLY — not the production endpoint)
graph auth <DEPLOY_KEY>
graph deploy marketplace
#    -> verify sync + run the query suite against the Studio endpoint

# 3. publish to the network (GO-LIVE — Arbitrum One tx, needs ETH on Arbitrum)
graph publish
#    -> or the Publish button in the Studio dashboard

# 4. signal ~3,000 GRT on your own subgraph (recommended; withdrawable, 1% tax)
# 5. add billing (card, or GRT deposited to the billing contract on Arbitrum One)
# 6. create a production API key; set authorized domains + restrict to this subgraph
# 7. point the frontend at:
#    https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
#    (key in env var / server-side proxy — the key is in the URL path)
```

**Prerequisites to line up before the sprint starts** (these are the schedule risk,
not the code): a deployer wallet, ETH on Arbitrum One, ~3,000 GRT on Arbitrum One,
and a payment method. Acquiring GRT is the long pole.

---

## Summary of numbers to re-check before committing

| Figure | Value used | Why re-check |
|---|---|---|
| Query price | $2 / 100K after 100K free | Has changed before ($4 → $2); a third-party source hinted at $1.50–$2 volume tiers |
| Monthly cost @ 3M queries | ~$58 | Derived from the above; also depends on your real query volume, which you should measure |
| Recommended signal | 3,000 GRT | Docs phrase it "as of May 2024" |
| GRT/USD | ~$0.013–$0.017 | Sources disagreed on the same day; volatile |
| Publish gas | ~$5 budget | No published figure; Arbitrum gas varies |
| Goldsky rates | $0.05/worker-hr + $4/100K entities | Secondhand, ~June 2026, different billing model |

Everything in §2 (the *sequence* of steps) is from The Graph's current docs and is the
part I'd trust most — it's the costs, not the procedure, that need a second look.
