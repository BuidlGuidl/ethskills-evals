# Shipping the marketplace subgraph to production

_Written 2026-09-23. Every number below has a source and a "re-check before you commit it" flag._

## 1. What the draft runbook gets wrong

> "run `graph deploy --hosted-service marketplace` … The hosted service is free and gives us a public GraphQL endpoint our frontend can hit straight away — no tokens, no billing, nothing to set up."

Three separate errors, any one of which is enough to make the sprint fail on the day:

**a) The hosted service no longer exists.** The Graph's hosted service was sunset — the `api.thegraph.com/subgraphs/name/...` endpoints were retired in June 2024 at the end of the "Sunrise" migration. The `--hosted-service` flag is gone from current `graph-cli`. This step will not run at all; it is not a "works but deprecated" path.

**b) Deploying is not publishing.** Even on the current stack, `graph deploy` only pushes your subgraph into **Subgraph Studio**, which is a *testing* environment with a rate-limited dev endpoint. It is explicitly not the endpoint you point a production frontend at. Getting a production endpoint is a second, separate, onchain action: **publish** the subgraph to The Graph Network (an Arbitrum One transaction). A runbook that has only a deploy step will leave you querying a dev endpoint in prod and wondering why it throttles.

**c) "No tokens, no billing" is wrong on both counts.** Production queries require a **Studio API key** (a token, which must be secured — see §4), and they are **metered and billed** past a free allowance. There is also a token (GRT) and gas involved in the publish step itself.

The draft also implies the frontend hits the endpoint "straight away." After publishing, indexers have to pick the subgraph up and sync it. Plan for a soak window, not an instant cutover.

## 2. The actual go-live path

Assume the subgraph already builds and its queries are verified against a local Graph Node (you have that).

1. **Pin the manifest.** Fix `startBlock` for every data source to the contract deployment block, and pin `specVersion`/`apiVersion`. Sync time and therefore your go-live window depend on this.
2. **Create the subgraph in Studio** (once, at https://thegraph.com/studio) with the wallet that will own it. That wallet becomes the subgraph owner — use a team-controlled wallet, not a personal one. Write the address into the runbook.
3. **Authenticate and deploy to Studio for staging:**
   ```bash
   graph auth <deploy-key>          # deploy key from Studio, NOT the query API key
   graph codegen && graph build
   graph deploy <studio-slug>
   ```
   Wait for it to reach 100% sync in Studio. Run your existing query suite against the Studio dev endpoint. This is the staging gate.
4. **Publish to the network.** From Studio's *Publish* button, or `graph publish` (graph-cli ≥ 0.73.0). This opens a wallet connection, you set metadata, and it lands as a transaction on **Arbitrum One** (Arbitrum Sepolia for a rehearsal). You need ETH on Arbitrum One in the owner wallet to pay gas.
5. **Signal curation on your own subgraph** (optional but recommended). The Graph's docs recommend self-curating **at least 3,000 GRT** to attract additional indexers; more signal → more indexers → lower latency and real redundancy. Without it you're relying on the network's upgrade indexer alone, which is a single point of service quality.
6. **Wait for indexers to sync the published version.** This is real wall-clock time proportional to your history and handler cost. Watch it in Graph Explorer. Do not schedule the frontend cutover for the same hour as the publish.
7. **Create a query API key** in Studio. Set a **spending limit**, and restrict it to **your domains** and to **this subgraph** (both are supported in Studio). Your production query URL is `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>` — or better, pass the key as a bearer token.
8. **Fund billing.** Add a credit card or a GRT balance on the Arbitrum billing contract. Queries past the free tier fail or stop being served if there's no funded payment method — this is the classic production outage on this stack.
9. **Cut the frontend over** behind an env var, with the old/local endpoint as a fallback for one release. Alert on gateway 4xx/5xx and on the subgraph falling behind chain head.

A note on versioning for the ongoing runbook: after go-live, a mappings change is `graph deploy` → verify in Studio → **publish a new version** → let indexers sync → the query URL by *Subgraph ID* points at the specific version, the *Deployment ID*/latest-version URL follows. Decide which one your frontend pins and write that down; pinning the wrong one turns every republish into an unannounced schema swap.

## 3. What it costs

### One-time, to stand up

| Item | Figure | Source | Re-check? |
|---|---|---|---|
| Arbitrum One gas to publish | a few dollars, order-of-magnitude | Arbitrum L2 gas, not documented by The Graph | **Yes** — read live Arbitrum gas at publish time; it's small but not zero, and the wallet must hold ETH on Arbitrum One |
| Self-curation signal | **3,000 GRT** recommended minimum | The Graph docs, "Publishing a Subgraph" / "Curating" | **Yes** — both the recommendation and the GRT/USD rate. This is the number most likely to move your budget line |
| Curation tax on signalling | ~1% of signalled GRT is burned | The Graph curation docs | **Yes** — confirm the current rate |
| Studio account / deploy | $0 | Studio pricing page | No |

Important framing for the budget: **the 3,000 GRT signal is mostly a recoverable deposit, not a spend.** You can un-signal later and get GRT back, minus the curation tax and minus/plus any price movement in GRT and any change in the curation bonding curve. Treat it as working capital with market risk, and put the *tax plus GRT price exposure* on the expense line, not the full principal.

### Per month, recurring

Studio's pricing is a single pay-as-you-grow plan:

- **100,000 queries/month free**
- **$2 per 100,000 queries** beyond that
- Payable by **credit/debit card** or **GRT**; all billing contracts live on **Arbitrum One**, so GRT payment also needs ETH on Arbitrum for gas
- No minimum deposit or subscription fee; balance is withdrawable

At "a few million queries," billed monthly:

| Monthly queries | Billable (minus 100K free) | Cost |
|---|---|---|
| 1,000,000 | 900,000 | **$18** |
| 3,000,000 | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |
| 10,000,000 | 9,900,000 | **$198** |

Source: https://thegraph.com/studio-pricing/ and The Graph's Subgraph Studio billing docs, both read 2026-09-23. The pricing page's own worked example (300,000 queries = $4/month) matches this arithmetic.

**So the honest budget line is: tens of dollars a month at a few million queries, plus a low-hundreds-of-dollars recoverable GRT deposit and a few dollars of gas to stand up.** The draft's "free" was wrong, but the correction is cheap — the risk here is an outage on go-live day, not the bill.

One sizing sanity check: The Graph's own docs suggest 1M–2M queries/month for a small-to-medium app, computed as daily visits × queries per page. Do that multiplication for your marketplace before you pick a row in the table above — query volume is driven by how chatty your frontend is (polling intervals, per-card queries, un-batched components), and an un-tuned frontend can 10x the bill without 10x the users. That's a code decision, not a vendor decision.

### Numbers to re-check before committing

1. **$2 / 100K and the 100K free tier** — read https://thegraph.com/studio-pricing/ on the day you write the budget. This is the number most likely to have changed since I checked (2026-09-23).
2. **3,000 GRT curation recommendation and the GRT/USD price** — the GRT figure is a docs recommendation and the USD value is market-dependent. Both need a same-day check.
3. **Curation tax percentage** (~1%).
4. **Arbitrum One gas** for the publish transaction.
5. **Your own query volume estimate** — the single biggest driver, and the only one you control.
6. **graph-cli version** — `graph publish` needs ≥ 0.73.0.

## 4. The token / secrets bit, concretely

There are **three** distinct credentials; the runbook should name them separately because confusing them is a common failure:

- **Deploy key** (Studio) — used by `graph auth`, in CI only. Never in the frontend.
- **Query API key** (Studio) — used by the frontend's gateway URL. Restrict by **domain** and by **subgraph**, and set a **spending limit** so a bug or a scraper can't run up the bill.
- **Owner wallet private key** — signs the publish and the curation transactions. Team-controlled, ideally a multisig or hardware wallet.

On the query key: The Graph's docs say to keep API keys in environment variables or a secrets manager and **not to expose them in client-side apps**. A browser frontend calling the gateway directly does expose it, by construction. Two viable positions:

- **Accept it,** and rely on domain restriction + subgraph restriction + a spending cap as the compensating controls. This is what most dApps do and it's defensible for a public read-only GraphQL endpoint.
- **Proxy it,** putting a thin server route between your frontend and the gateway so the key never ships to the browser. Costs you a small serverless function; gives you caching, rate limiting per user, and the ability to rotate the key without a frontend deploy.

Pick one deliberately and write it in the runbook. If you take option 1, the spending limit is not optional — it's the only thing standing between you and an unbounded bill.

## 5. Alternatives worth one line in the runbook

You are not obliged to use The Graph Network just because you wrote a subgraph:

- **Self-hosted Graph Node.** Free of query fees, but then the host, the Postgres instance, the archive RPC, backups and process supervision are all yours to name and pay for. Usually more than $58/month once you count the RPC and the ops time.
- **Third-party hosted subgraph providers** (e.g. Goldsky, Alchemy Subgraphs, Chainstack) run the same subgraph with their own pricing and SLAs — worth a quote if you want a support contract.
- **Ponder** — a different indexer, same principle, also needs a named production home.

Whichever you pick, the rule that matters is the one the draft runbook violated: **decide where the indexer runs in production, under which command or service, and write it down.** That's the decision that silently stays open and leaves you with a read side that only ever ran on a laptop.

---

### Sources

- [Subgraph Studio Pricing | The Graph](https://thegraph.com/studio-pricing/) — 100K free queries/month, $2 per 100K after, card or GRT, no minimum. Read 2026-09-23.
- [Subgraph Studio (billing) | Docs | The Graph](https://thegraph.com/docs/en/subgraphs/billing/) — Free vs Growth plan, billing contracts on Arbitrum One, ETH-on-Arbitrum for gas, 1M–2M queries/month sizing guidance. Read 2026-09-23.
- [Publishing a Subgraph to the Decentralized Network | Docs | The Graph](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/) — publish via Studio or `graph publish` (CLI ≥ 0.73.0), Arbitrum One / Arbitrum Sepolia, 3,000 GRT self-curation recommendation, upgrade indexer. Read 2026-09-23.
- [Curating | Docs | The Graph](https://thegraph.com/docs/en/resources/roles/curating/) — signal attracts indexers, curation tax.
- [Managing API Keys | Docs | The Graph](https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/) — spending limits, domain restrictions, subgraph restrictions, "do not expose in client-side apps", regeneration invalidates immediately. Read 2026-09-23.
- [Sunrise / hosted service sunset | The Graph](https://thegraph.com/docs/en/sunrise/) — Sunray/Sunbeam/Sunrise phases ending with hosted service endpoints retired. The June 2024 retirement date is from The Graph's migration announcements — **re-check if the exact date matters for a written runbook**; what matters operationally is that the endpoints are gone today.
- [How to Query a Subgraph | Docs | The Graph](https://thegraph.com/docs/en/subgraphs/querying/introduction/) — gateway query URL format.
