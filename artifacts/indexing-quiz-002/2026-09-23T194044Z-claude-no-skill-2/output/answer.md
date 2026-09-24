# Shipping the marketplace subgraph to production

_Written 2026-09-23. Every figure below has a source link and a "re-check" flag where
it moves. Prices in this space change; treat this as a costed plan, not a quote._

---

## 1. What the draft runbook gets wrong

> "run `graph deploy --hosted-service marketplace` … The hosted service is free and gives
> us a public GraphQL endpoint … no tokens, no billing, nothing to set up."

Four things, and they compound:

**1. The hosted service does not exist.** It was sunset on **12 June 2024**. Hosted-service
query endpoints (`api.thegraph.com/subgraphs/name/...`) were switched off and new deploys
were disabled at that point. Source: [The Road to Sunsetting the Hosted Service](https://thegraph.com/blog/sunsetting-hosted-service/)
and the [Post-Sunrise FAQ](https://thegraph.com/docs/en/archived/sunrise/) — note the docs
page now lives under `/archived/`, which is itself the tell.

**2. The command is not a command.** There is no `--hosted-service` flag on a current
`graph-cli`. The flow today is `graph auth` → `graph deploy <slug>` (to Subgraph Studio)
→ `graph publish` (to the network). Source: [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/).
If that flag "works" on someone's machine, they're on a years-old pinned CLI and the deploy
will fail at the endpoint, not at the flag.

**3. "No tokens" is wrong twice.** Publishing is an **on-chain transaction on Arbitrum One**
(so you need ETH on Arbitrum for gas), and the recommended step right after publishing is to
**signal GRT on your own subgraph** (~3,000 GRT recommended) to attract indexers. Sources:
[Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/),
[Curating](https://thegraph.com/docs/en/resources/roles/curating/). Signalling is *optional*
now (see §3) but the token exposure is real and it needs a treasury decision, not a dev decision.

**4. "Nothing to set up" hides the actual production dependency: an API key.** The public
endpoint is gateway-fronted and keyed. A key means billing, means a spend limit, means a
decision about whether that key is allowed to sit in your frontend bundle. Source:
[Managing API Keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/).

The one thing the draft gets right: there **is** a free tier, and at your volume the query
bill is small. It's just not zero, and it's not the free thing they think it is.

---

## 2. The actual go-live path

### Step 0 — Pin your tooling
Publishing from the CLI needs `graph-cli` **≥ 0.73.0**
([source](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/)).
Pin it in `package.json` so the runbook is reproducible. Do this first — it's the step that
makes the teammate's stale-flag problem impossible to repeat.

### Step 1 — Create the subgraph in Subgraph Studio
Connect a wallet at Subgraph Studio, create the subgraph, copy the **deploy key**.
The wallet that creates it is the owner — **use a team-controlled wallet, not a personal
hot wallet**. Transferring subgraph ownership later is friction you don't want.

### Step 2 — Deploy to Studio (this is *not* production)
```bash
graph auth <DEPLOY_KEY>
graph codegen && graph build
graph deploy <SUBGRAPH_SLUG>
```
This gives you `https://api.studio.thegraph.com/query/<ID>/<NAME>/<VERSION>`. The docs are
explicit that this endpoint is "free to use, **rate-limited, not visible to the public**"
— it is a staging endpoint. Do **not** ship the frontend against it.
Sources: [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/),
[Querying from an Application](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/).

**Gate here:** wait for indexing to reach chainhead in Studio and re-run your GraphQL test
suite against the Studio URL. Local Graph Node and hosted indexing differ on reorg handling
and timing; this is where you find that out, not in prod.

### Step 3 — Publish to the network (Arbitrum One)
Either the **Publish** button in Studio, or:
```bash
graph publish
```
which opens a wallet window. This is an on-chain tx on **Arbitrum One**; the subgraph becomes
visible in Graph Explorer and gets a **Subgraph ID**.
Source: [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/).

### Step 4 — Decide on curation signal
Docs: "if your Subgraph is eligible for rewards, it is recommended that you curate your own
Subgraph with **at least 3,000 GRT** in order to attract additional Indexers."
([source](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/))

It is not strictly required — the **Edge & Node Upgrade Indexer** exists precisely to guarantee
every published subgraph gets indexed ([source](https://thegraph.com/docs/en/subgraphs/upgrade-indexer/)).
My recommendation for a production marketplace: **signal anyway**. One indexer is one point of
failure and one latency profile. Signal buys you redundancy and better query latency, and the
GRT is a position you hold, not a fee you burn (minus the tax, below).

### Step 5 — Create an API key and lock it down
In Studio → API Keys. Set:
- a **monthly spending limit in USD** (do this before the key is live, not after an incident),
- **domain allowlisting**, and
- **subgraph restrictions** so the key can only hit this subgraph.

Source: [Managing API Keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/).

**The key-in-the-browser question — decide this explicitly.** Production URL is:
```
https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```
The key sits in the path, so if the frontend calls it directly, the key is public. The docs
say plainly: *"Always keep your API key in environment variables or a secure secrets manager.
Do not hardcode it in your codebase or expose it in client-side apps."* There is also a
**Bearer-token** form for the auth header. Two viable postures:

- **(a) Thin server-side proxy** — frontend hits your API, your API holds the key (Bearer form).
  Correct, and what I'd budget for. Cost: a small serverless function, and you own its uptime.
- **(b) Key in the frontend + domain allowlist + hard spend cap** — common in practice, and the
  allowlist is a real control, but it's origin-header-based, so it deters casual abuse rather
  than preventing it. Acceptable only with the spend cap set low enough that the worst case is
  an annoyance.

Put whichever you choose in the runbook as a named decision, not an accident of implementation.

### Step 6 — Cut the frontend over and monitor
Point at the gateway URL. Then:
- Watch query volume and spend in Studio (that's your early warning on both abuse and a
  runaway client-side retry loop).
- Subscribe to [status.thegraph.com](https://status.thegraph.com/).
- Alert on **subgraph freshness** (compare the subgraph's `_meta.block.number` against
  chainhead from your own RPC). A subgraph that silently stops advancing looks like a healthy
  200-response API to everything else you monitor.

### Step 7 — Write down the upgrade path *now*
Publishing a new version is another on-chain tx, plus a **0.5% curation tax on auto-migrated
signal** ([source](https://thegraph.com/docs/en/resources/roles/curating/)). Metadata-only
edits don't create a new version. Budget a small recurring line for this — schema changes on
a live marketplace are not a one-time event.

---

## 3. Costs

### Stand-up (one-time)

| Item | Cost | Source / confidence |
|---|---|---|
| Studio account, deploy, Studio endpoint | **$0** | [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/) |
| Publish tx gas (Arbitrum One) | **low single-digit USD**, call it **$5** with headroom | Docs confirm Arbitrum One but give no gas figure — **estimate, re-check** |
| Self-curation signal (recommended) | **3,000 GRT ≈ $69** at $0.023/GRT | 3,000 GRT from [publishing docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/); price from [CoinGecko](https://www.coingecko.com/en/coins/the-graph) — **re-check on the day** |
| 1% curation tax on that signal | **~30 GRT ≈ $0.70** | [Curating](https://thegraph.com/docs/en/resources/roles/curating/) |
| ETH on Arbitrum for gas buffer | **~$50** float | Operational judgement, not a quoted figure |

**Stand-up total: roughly $125**, of which **~$69 is a GRT position you still hold**, not spend.
The genuinely-sunk portion is under $10. This is a rounding error on a sprint — the real cost
of this step is the treasury/compliance process to acquire and custody GRT and ETH on Arbitrum,
which is measured in days of someone's time, not dollars. **Budget the process, not the token.**

### Running cost at 3M queries/month

Published pricing: **100,000 free queries/month**, then **$2 per 100,000 queries**
(= $0.00002/query), payable by **credit/debit card or GRT**.
Source: [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/), corroborated by
[Subgraph Studio docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/).

```
3,000,000 queries
  − 100,000 free
= 2,900,000 billable  ×  $2 / 100,000  =  $58.00 / month
```

| Volume/month | Monthly cost |
|---|---|
| 100k | $0 |
| 1M | $18 |
| 3M | **$58** |
| 10M | $198 |

**Budget line I'd write: $75/month** — $58 plus headroom for traffic growth and for the
possibility that the price is $4 rather than $2 (see the flag below). Plus whatever your
proxy function costs, which for this volume is likely inside an existing hosting plan.

### The token/billing mechanics, concretely
- The GRT billing balance lives **on Arbitrum One** — "all activity, including the billing
  contracts, is now on Arbitrum One." You need ETH on Arbitrum for those txs too.
- **Card payments go through Stripe**, invoiced monthly at month's end. If you pay by card you
  can run this entire production path **without ever touching GRT for queries** — the only
  unavoidable token exposure is the publish gas, and the optional curation signal.
  Source: [Subgraph Studio docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/).

That last point is the one worth telling your teammate: the correct path costs about what they
thought it did. What they got wrong is that it's *keyed, metered, and on-chain to set up* — the
budget impact is small, the runbook impact is not.

---

## 4. Numbers to re-check before you commit the budget

1. **$2 per 100,000 queries.** This is the headline on the pricing page today, but this figure
   was **$4 per 100k** for a long stretch and I'd want it confirmed on the day you sign off.
   Highest-leverage item on the page: it's the whole recurring line.
   → [thegraph.com/studio-pricing](https://thegraph.com/studio-pricing/)
2. **Whether the 100k free tier is per account or per subgraph**, and whether the Growth plan
   carries any minimum monthly charge. The pricing page states no minimum; I could not find it
   contradicted, but "no stated minimum" is weaker evidence than "stated no minimum."
3. **GRT price.** I used **$0.023** (CoinGecko/Kraken, ~21–22 Sep 2026; sources in that window
   ranged $0.0228–$0.0240). This moves daily — recompute the 3,000 GRT line at execution time.
4. **The 3,000 GRT recommendation.** It's a docs recommendation tied to reward eligibility, not
   a protocol minimum. Confirm your target chain is reward-eligible; if it isn't, the number is
   moot and signalling is a pure redundancy purchase.
5. **Arbitrum publish gas.** My $5 is an estimate with headroom, not a sourced figure. Check
   Arbiscan for a recent `publishNewSubgraph` tx, or just accept it as noise.
6. **Graph Horizon.** Secondary sources describe a contract-stack migration deployed to
   mainnet around December 2025 affecting indexer stake and query routing. I could not confirm
   its scope from first-party docs in this pass, and it **may affect the gateway URL format**.
   **Verify the exact query URL in Subgraph Studio itself** rather than copying the format from
   this document into your runbook. Treat this as the one open technical question here.

## 5. Alternatives, if you want a second quote for the budget

- **Goldsky** — managed subgraph hosting, priced on worker-hours plus entities
  (~$0.05/hr per subgraph worker ≈ $36.50/mo, plus entity-based charges; free tier exists).
  Different cost *shape*: you pay for indexing capacity whether or not anyone queries.
  At 3M queries The Graph is cheaper; at very high query volume with a small dataset,
  Goldsky's shape can win. → [goldsky.com/pricing](https://goldsky.com/pricing) — **re-check,
  third-party summary**
- **Alchemy Subgraphs — do not plan around this.** Sunset **8 December 2025**; Alchemy points
  migrants at Goldsky. Worth knowing so nobody reaches for it as the "easy hosted option,"
  which is exactly the mistake in the draft runbook, one vendor over.
  → [Alchemy deprecation notice](https://www.alchemy.com/docs/alchemy-subgraphs/deprecation-notice)
- **Self-host Graph Node.** You already run one locally. Full control, no per-query fee, and
  you own uptime, archive-node RPC costs, and on-call. For a production marketplace this is
  almost certainly more expensive than $58/month once you price the human.

**Recommendation: The Graph decentralized network, pay by card, self-curate 3,000 GRT, proxy
the API key server-side.** ~$125 to stand up (~$69 of it recoverable), ~$58–75/month to run.
