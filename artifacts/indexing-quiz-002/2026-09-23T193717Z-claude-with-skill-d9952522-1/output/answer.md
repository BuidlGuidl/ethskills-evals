# Shipping the marketplace subgraph to production

_Written 2026-09-23. Every figure below has a source and a "re-check?" flag. Prices in
this ecosystem move; the GRT-denominated ones move a lot._

---

## 1. What the draft runbook gets wrong

> "run `graph deploy --hosted-service marketplace` … The hosted service is free and gives
> us a public GraphQL endpoint our frontend can hit straight away — no tokens, no billing,
> nothing to set up."

Four separate problems, and the first one is fatal:

1. **The hosted service does not exist.** It was shut down on **12 June 2024** as the final
   ("Sunrise") phase of The Graph's migration to the decentralized network. That command
   has no endpoint to talk to; the `--hosted-service` / `--product hosted-service` flag is
   gone from modern `graph-cli`. The runbook step cannot succeed — it isn't a
   "works-but-deprecated" path, it's a dead one.
2. **"Deploying" is not "publishing."** The surviving `graph deploy` target is **Subgraph
   Studio**, which is a *testing* environment. It gives you a development query URL that is
   rate-limited and explicitly not for production traffic. To get a production endpoint you
   must take a second, separate action: **publish** the subgraph to the network (an onchain
   transaction on Arbitrum One). A runbook that stops at `graph deploy` ships nothing.
3. **"No tokens" is wrong twice over.** Publishing is an Arbitrum One transaction, so you
   need **ETH on Arbitrum** for gas. And to get indexers to actually pick up and serve your
   subgraph promptly, the docs recommend self-curating with **GRT** (optional in the
   protocol sense, practically necessary in the "we want it served reliably" sense).
4. **"No billing" is wrong.** Production queries are metered: 100K/month free, paid after
   that. And **there is no such thing as a public unauthenticated endpoint** — every
   gateway query needs an API key, which has a real consequence for a browser frontend
   (see step 6).

The one thing the draft gets right: you do not need to stand up servers. The managed path
is real, it's just Studio + publish, not the hosted service.

---

## 2. The actual go-live path

Assume the subgraph is already building and its queries verified against local Graph Node
(that's where you are).

**Step 1 — Create the subgraph in Subgraph Studio.**
Connect a wallet at Subgraph Studio, create the subgraph, note the slug and the **deploy
key**. Decide *now* whose wallet this is — it is the owner of the onchain subgraph NFT and
the only account that can publish upgrades. Use a team/multisig-controlled wallet, not a
personal dev wallet. (This is the single most common go-live regret: subgraph ownership
sitting in an ex-teammate's MetaMask.)

**Step 2 — Build and deploy to Studio.**
```bash
graph auth <DEPLOY_KEY>
graph codegen && graph build
graph deploy <SUBGRAPH_SLUG>      # -> Studio. Testing only.
```
Pin the start block in `subgraph.yaml` to the marketplace contract's deployment block, not
block 0 — this is the difference between a sync measured in hours and one measured in days.

**Step 3 — Let it sync in Studio and verify.**
Watch sync progress and the indexing-error state in Studio. Run your existing query suite
against the Studio development URL. Treat "synced to chainhead with zero non-deterministic
errors" as the gate for step 4, because publishing a subgraph that fatals mid-history means
republishing a new version.

**Step 4 — Publish to the network (this is the real "ship" step).**
From the Studio UI ("Publish") or CLI:
```bash
graph codegen && graph build
graph publish          # defaults to arbitrum-one
```
This is an **Arbitrum One transaction** — needs ETH on Arbitrum in the owner wallet.
Choose the *indexed* chain here (your marketplace's chain) independently of the fact that
the protocol bookkeeping lives on Arbitrum.

**Step 5 — Signal GRT on your own subgraph so indexers serve it.**
Publishing makes the subgraph *available*; curation signal is what makes indexers *choose*
to index it. The docs recommend curating your own subgraph with **at least 3,000 GRT** to
attract indexers and have it available for querying promptly. Without signal you may sit
with zero or one indexer, which means no redundancy and bad tail latency — not a
production posture. You can withdraw signal later (minus the curation tax and subject to
GRT price movement), so treat it as a refundable-ish deposit rather than a fee.

**Step 6 — Create an API key, lock it down, and wire the frontend.**
Production endpoint format (from the docs):
```
https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```
Two things your runbook must say explicitly:
- **An API key shipped to a browser is public.** Anyone can read it out of your bundle and
  spend your query budget. Mitigate with Studio's per-key **domain allowlist + rate
  limits**, and/or proxy queries through your own backend route. For a marketplace frontend
  I'd do both: allowlist the domain *and* route through a thin backend proxy so you can cap
  spend and cache hot queries.
- **Use the Subgraph ID, not the Deployment ID**, in the URL if you want the endpoint to
  follow your future version upgrades instead of pinning to one build.

**Step 7 — Wait for indexers, then verify the network endpoint.**
The network endpoint only answers once at least one indexer has synced your subgraph and
allocated to it. Don't cut the frontend over on publish; verify against the gateway URL
first. Check in Graph Explorer how many indexers are serving it — **one indexer is a single
point of failure**, and that's what more signal buys you.

**Step 8 — Set up monitoring and an upgrade procedure.**
- Alert on indexing lag (compare subgraph `_meta.block.number` to chainhead) and on query
  error rate from the gateway.
- Alert on billing balance / card status — running out means queries stop.
- Document the upgrade path: deploy new version to Studio → sync → publish new version →
  the Subgraph-ID endpoint follows it. Budget Arbitrum gas per upgrade.
- Cache at the frontend/edge. Query billing is per query; a CDN or client cache in front of
  hot marketplace listing queries is the cheapest cost lever you have.

---

## 3. What it costs

### One-time, to stand it up

| Item | Cost | Source | Re-check before budgeting? |
|---|---|---|---|
| Studio account, unlimited subgraph creation, Studio deploys/testing | $0 | Studio pricing page | No |
| Publish transaction (Arbitrum One gas, ETH) | Low — cents to a few dollars | Docs confirm publishing is on Arbitrum One and requires ETH gas; **the docs give no dollar figure**, this is my estimate from typical Arbitrum L2 tx costs | **Yes** — my inference, not a published number. Budget $25 of ETH on Arbitrum to cover publish + several upgrades and stop thinking about it. |
| Self-curation signal, 3,000 GRT (recommended minimum) | **≈ $77** at GRT ≈ $0.0256 | 3,000 GRT figure: The Graph docs (publishing / curating). GRT price: CoinMarketCap live quote seen 2026-09-23, $0.025582 | **Yes, hard.** See the warning below. |
| **One-time total** | **≈ $100, call it $150 with headroom** | | |

> ⚠️ **The GRT price number is the shakiest figure in this document.** In a single search
> pass I got $0.025582 (CoinMarketCap live), $0.016 (quoted as "as of Sep 1, 2026"), and
> $0.0138 — plus price-*prediction* pages that must be ignored entirely. Across that range
> 3,000 GRT is **$41–$77**. Pull the spot price yourself on the day you publish. The good
> news: at any of those prices this is a rounding error on a sprint budget, so don't spend
> sprint time optimizing it — and consider signalling *more* than 3,000 GRT, since indexer
> redundancy is worth more than $50.

### Recurring, per month

Query pricing: **100,000 free queries/month**, then **$2 per 100,000 queries**, usage-based,
no monthly minimum. Paid by credit card or by GRT on Arbitrum One. (Source: Subgraph Studio
pricing page, which shows the worked example "300,000 queries = $4/month".)

| Monthly queries | Billable (above 100K) | Cost/month | 
|---|---|---|
| 100,000 | 0 | **$0** |
| 1,000,000 | 900,000 | **$18** |
| 2,000,000 | 1,900,000 | **$38** |
| **3,000,000** ("a few million") | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |
| 10,000,000 | 9,900,000 | **$198** |

**Budget line I'd write: ~$60/month at 3M queries; ask for $120/month so a 2× traffic
surprise doesn't need a new approval.** Plus $0 infrastructure — no servers, no Postgres,
no on-call for the indexer. That is the real argument for this path.

Not in the above, but put it in the runbook: **Arbitrum gas per subgraph upgrade** (small,
but non-zero and recurring if you iterate on the schema).

### Numbers to re-check before you commit the budget

1. **GRT spot price** — volatile, and my sources disagreed by ~2×. Check on publish day.
2. **$2 per 100K queries** — this rate has changed before (I've seen $4/100K quoted in
   older material, and one search result today claimed a $1.50–$2 range). Read
   `thegraph.com/studio-pricing` yourself on the day you write the budget line. My table is
   linear-scaled from the published rate + their own 300K example; confirm there's no volume
   tier or enterprise floor that kicks in above a few million.
3. **Your actual query volume** — the biggest error bar here is not the price, it's the
   count. "A few million" is a guess until you instrument it. One un-cached poll loop in the
   frontend can multiply this by 10×. Measure query count in staging with realistic traffic
   before you trust any row in that table.
4. **Arbitrum gas for publish/upgrade** — my estimate, not a documented figure.
5. **Studio API-key domain allowlisting / per-key rate limits** — I'm confident these exist
   in Studio, but confirm the exact controls in the UI before you rely on them as your only
   key-abuse defense (that's why I also recommend the backend proxy).

---

## 4. The alternative, stated fairly

You can self-host Graph Node (or run Ponder) instead: no query metering, no GRT, no
publishing transaction. The cost moves from a metered bill to **a host, a persistent
Postgres you must back up, an archive-node RPC subscription, and process supervision plus
someone on-call for sync failures**. At 3M queries/month, that's trading a ~$60 bill for
real infra cost and engineer time — a bad trade at your volume. Revisit it if query volume
gets large enough that metering dominates, or if you need indexing features the network
doesn't serve.

The point that matters for your runbook either way: **name the production home and the exact
command that puts it there.** Your teammate's draft named a home that no longer exists,
which is the failure mode this decision always has — a read side that only ever ran on a
laptop.

---

## 5. Corrected runbook step (drop-in replacement)

```
Ship steps (owner wallet: <TEAM MULTISIG ADDRESS>, needs ETH on Arbitrum One):
  1. graph auth <DEPLOY_KEY>
  2. graph codegen && graph build
  3. graph deploy <SLUG>            # Studio only — NOT production
  4. Wait for Studio sync to chainhead; run query suite; zero indexing errors
  5. graph publish                  # Arbitrum One tx, costs ETH gas  <-- the real ship
  6. Signal >= 3,000 GRT on our own subgraph (Explorer/Studio)
  7. Confirm in Graph Explorer that >= 2 indexers are serving it
  8. Create API key; set domain allowlist + rate limit; add card/GRT to billing
  9. Point frontend at
     https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
     (Subgraph ID, via backend proxy) and verify
 10. Enable alerts: indexing lag, gateway error rate, billing balance
```

---

## Sources

- [The Road to Sunsetting the Hosted Service](https://thegraph.com/blog/sunsetting-hosted-service/) — hosted service no longer active as of 12 June 2024
- [The Graph Network: The Sunrise of Decentralized Data](https://thegraph.com/blog/transitioning-to-decentralized-graph-network/) — Sunrise phase retired hosted-service endpoints
- [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/) — "100,000 free monthly queries", "$2 per 100,000 queries", 300K = $4/month example, card or crypto
- [Subgraph Studio / billing docs](https://thegraph.com/docs/en/subgraphs/billing/) — Free vs Growth plan, payment by credit card or GRT on Arbitrum One, ETH on Arbitrum for gas
- [Publishing a Subgraph to the Decentralized Network](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/) — publish to Arbitrum One, `graph publish`, signal optional, "at least 3,000 GRT … to attract additional indexers"
- [Curating](https://thegraph.com/docs/en/resources/roles/curating/) — 3,000 GRT self-curation recommendation, Arbitrum flattened bonding curve
- [Querying from an application](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/) — `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`
- [Querying introduction](https://thegraph.com/docs/en/subgraphs/querying/introduction/) — "Each query URL requires a valid API key"
- [The Graph (GRT) price, CoinMarketCap](https://coinmarketcap.com/currencies/the-graph/) — $0.025582 as seen 2026-09-23 (conflicting lower figures also encountered; re-check)
- [The Graph's New Era of Scalability: Arbitrum and L2 Transfer Tools](https://thegraph.com/blog/the-graph-L2-scaling-with-arbitrum/) — publishing/upgrading costs ETH gas, lower on Arbitrum
