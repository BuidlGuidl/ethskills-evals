# Shipping a subgraph to production (The Graph, September 2026)

## TL;DR

The draft runbook's ship step **cannot work**. The hosted service was shut down on
**June 12, 2024** — the endpoint, the deploy target, and the CLI flag are all gone.
There is no "free public endpoint, no tokens, nothing to set up" path anymore.

The real path is: **Subgraph Studio → publish on-chain to The Graph Network
(Arbitrum One) → query via the gateway with an API key**. It costs a small amount of
ETH gas to stand up, optionally ~3,000 GRT of self-curation (recoverable), and
**$2 per 100,000 queries after the first 100,000 free each month**.

At 3M queries/month that's **~$58/month** in query fees.

---

## 1. What the draft step gets wrong

| Claim in draft | Reality |
|---|---|
| `graph deploy --hosted-service marketplace` | Not a real flag. The hosted service target was `--product hosted-service --node https://api.thegraph.com/deploy/`, and that node no longer accepts deploys. The current CLI publish command is `graph publish`. |
| "push it to The Graph's hosted service" | The hosted service sunset **June 12, 2024**. New subgraph deploys stopped before that; queries stopped on that date. `api.thegraph.com/subgraphs/name/...` URLs are dead. |
| "free" | Free only for the first **100,000 queries/month**. Past that it is usage-billed. |
| "public GraphQL endpoint our frontend can hit straight away" | Production endpoints are **gateway endpoints that require an API key**. There is no unauthenticated public URL. An API key shipped in frontend JS is public, so you must use Studio's domain allowlist + subgraph restriction, or proxy server-side. |
| "no tokens" | Publishing is an **on-chain transaction on Arbitrum One** — you need a wallet with **ETH on Arbitrum** for gas. Billing can be paid by **credit card OR GRT on Arbitrum**, so GRT is optional for billing but ETH-on-Arbitrum is not optional for publishing. |
| "nothing to set up" | You need: a Studio account, a deploy key, a wallet, an on-chain publish tx, an API key with security settings, a funded billing balance, and a version-update process. |

Two caveats worth knowing so nobody "corrects" you with a half-truth:

- The Graph docs note the hosted service lingered for **chains not supported on the
  decentralized network**. If your marketplace is on a mainstream EVM chain, this does
  not apply to you — you go to the network. Confirm your chain is in the supported list
  before you plan around it.
- "Free tier" still exists, but it is a *query allowance on the network*, not a separate
  free hosting product. The Studio dev endpoint is rate-limited and explicitly for
  testing — do not point production at it.

---

## 2. The actual go-live path

### Stage A — Studio (no chain, no money)
1. Create the subgraph in **Subgraph Studio** (thegraph.com/studio), get a **deploy key**.
2. `graph auth <DEPLOY_KEY>`
3. `graph codegen && graph build`
4. `graph deploy <SUBGRAPH_SLUG>` — deploys to Studio.
5. Studio syncs it and gives you a **development query URL**. Use it to re-run the
   GraphQL queries you already validated locally, against real chain data.
   **This URL is rate-limited and for testing only. Never ship it.**

Exit criterion: Studio shows 100% synced, no indexing errors, and your frontend's
query set returns correct results against it.

### Stage B — Publish on-chain (costs ETH gas)
6. `graph publish` (graph-cli ≥ 0.73.0) — opens a wallet flow for metadata + network
   selection. Or hit **Publish** in the Studio UI. Either way it is a transaction on
   **Arbitrum One** (Arbitrum Sepolia available for a rehearsal).
7. You need a wallet holding **ETH on Arbitrum One** to pay gas.
8. This mints the subgraph on-chain and lists it in **Graph Explorer**, where Indexers
   can pick it up and Curators can signal.

Note: the **Sunrise Upgrade Indexer** indexes all published subgraphs, so your subgraph
will be servable without curation. Curation buys you *more* indexers → redundancy,
lower latency, better availability. For a production dApp you want that.

### Stage C — Curation (optional, ~3,000 GRT, mostly recoverable)
9. The Graph docs recommend you **"curate your own Subgraph with at least 3,000 GRT in
   order to attract additional indexers."**
10. This is signal, not a fee — it sits in a bonding curve and can be withdrawn later.
    You do lose the ~1% curation tax and are exposed to bonding-curve price impact and
    GRT price movement. Budget it as **working capital at risk**, not as an expense.
11. Caveat from the docs: subgraphs **not eligible for indexing rewards** won't attract
    additional indexers from signal alone. Check your subgraph's reward eligibility
    (chain support / feature support) before spending the 3,000 GRT.

### Stage D — Production querying
12. In Studio → **API Keys** → Create API Key.
13. Query endpoint: `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`
    or, better, `https://gateway.thegraph.com/api/subgraphs/id/<SUBGRAPH_ID>` with
    header `Authorization: Bearer <API_KEY>`.
14. Under the key's **Security** settings, set the **authorized domain names** and
    **restrict which subgraphs** the key can query. Do this before go-live — a key in
    a public frontend bundle is readable by anyone.
15. Query by **Subgraph ID** (the on-chain NFT id, stable across versions) rather than
    Deployment ID (the IPFS hash of one specific build) so a version bump doesn't
    require a frontend redeploy.

### Stage E — Billing
16. Fund the **billing balance** on **Arbitrum One** — deposit GRT, or put a credit card
    on file. Invoices process monthly; you're charged only for what you use and can
    withdraw unused GRT. Studio emails you before the balance runs dry.
17. **Set up a low-balance alert owner.** A depleted balance means your frontend's
    queries start failing. This is the single most likely production incident on this
    path.

### Stage F — Operations
18. Every schema/mapping change = `graph deploy` to Studio, verify, then **publish a new
    version = another on-chain Arbitrum tx** (more gas). Budget gas per release, not once.
19. Metadata-only edits do **not** create a new version.
20. Keep the local Graph Node harness — it stays your pre-Studio test loop.

---

## 3. Costs

### One-time / stand-up

| Item | Cost | Confidence |
|---|---|---|
| Subgraph Studio account, deploy, testing | $0 | High — Studio pricing page lists unlimited subgraph creation + unlimited testing |
| Publish tx gas (Arbitrum One) | Low single-digit USD in ETH, typical | **LOW — re-check.** I did not verify a current Arbitrum gas figure. Estimate it from a live Arbitrum gas tracker on the day, or rehearse on Arbitrum Sepolia. |
| Self-curation signal, 3,000 GRT | ≈ **$75** at ~$0.025/GRT | GRT amount: High (docs). USD: **LOW — re-check**, GRT quotes spanned $0.024–$0.03 across exchanges today and this is a volatile token. Recoverable minus ~1% tax and curve slippage. |

**Realistic stand-up line: ~$80–$150**, dominated by the curation signal, most of which
is recoverable.

### Recurring — query fees

Official pricing: **100,000 free queries/month**, then **$2 per 100,000 queries**
(= $0.00002/query). The pricing page's own worked example: 300,000 queries = $4/month.

| Volume/month | Billable (minus 100k free) | Cost |
|---|---|---|
| 1,000,000 | 900,000 | **$18** |
| 3,000,000 | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |
| 10,000,000 | 9,900,000 | **$198** |

**At "a few million queries," you are looking at roughly $60–$100/month.** This is a
rounding error next to almost any other line in your infra budget — the budget risk here
is not price, it's the operational risk of an unfunded billing balance.

### Recurring — other

| Item | Cost |
|---|---|
| Version republish gas | A few dollars of ETH per release, on Arbitrum |
| Curation signal | $0 ongoing (capital parked, not spent) |
| Local Graph Node for dev | Your existing infra cost, unchanged |

### Sizing note
The Graph's own docs suggest **"1M–2M queries per month"** as a rule of thumb for a
small-to-medium app, or `daily visits × queries per page load` for larger ones. Your
"a few million" figure is a reasonable planning number. **Instrument actual query counts
in staging before committing** — a chatty frontend that fires 10 queries per page load
will blow past your estimate, and the fix (caching, batching, fewer round trips) is a
frontend change, not a budget change.

---

## 4. Numbers to re-check before committing to the budget

Flagged in descending order of how likely they are to bite you:

1. **Arbitrum publish gas** — I never verified a figure. Get it live.
2. **GRT/USD for the 3,000 GRT** — volatile; today's quotes ranged $0.024–$0.03.
3. **$2 per 100,000 queries** — verified today on the Studio pricing page, but The Graph
   has changed this before (it was $4/100k for a long stretch). Re-confirm on the day
   you commit the budget.
4. **100,000 free queries/month** — verified today; same caveat.
5. **The 3,000 GRT curation recommendation** — docs describe it as "as of May 2024."
   It has been stable, but confirm it's still the current guidance.
6. **Your chain's support status and indexing-reward eligibility** — determines whether
   curation actually buys you anything.
7. **Enterprise/volume terms** — the pricing page has a "Get in touch" but publishes no
   enterprise tier. If you expect to cross tens of millions of queries, ask them.

---

## 5. Sources

Everything above traces to one of these, all fetched **2026-09-23**:

- [Subgraph Studio Pricing | The Graph](https://thegraph.com/studio-pricing/) — "$2 per 100,000 queries"; "100,000 free monthly queries"; 300k = $4 example; "Pay with the swipe of a card, or with crypto"; unlimited subgraph creation/testing.
- [Subgraph Studio (billing) | Docs | The Graph](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/) — billing balance on **Arbitrum One**; GRT or credit card; bridge GRT and hold ETH for gas; withdraw unused funds; email warnings; "1M-2M queries per month" sizing guidance. *(Note: the old `/subgraphs/billing/` URL now 301s here.)*
- [Publishing a Subgraph to the Decentralized Network | Docs | The Graph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/) — publish is on-chain to Arbitrum One (Arbitrum Sepolia testnet); `graph publish` in CLI ≥ 0.73.0; **"it is recommended that you curate your own Subgraph with at least 3,000 GRT in order to attract additional indexers"**; **"Sunrise Upgrade Indexer ensures the indexing of all Subgraphs"**; reward-ineligible subgraphs won't attract indexers via signal; metadata edits don't create versions.
- [Quick Start | Docs | The Graph](https://thegraph.com/docs/en/subgraphs/quick-start/) — `graph init`, `graph auth <DEPLOY_KEY>`, `graph codegen && graph build`, `graph deploy <SUBGRAPH_SLUG>`, `graph publish`; "You get access to 100,000 free queries/month with your Subgraph on The Graph Network."
- [How to Manage API keys | Docs | The Graph](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/) and [Querying from an Application](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/) — gateway URL format; `Authorization: Bearer <API_KEY>`; domain allowlist and per-subgraph restriction under Security settings.
- [The Road to Sunsetting the Hosted Service | Blog | The Graph](https://thegraph.com/blog/sunsetting-hosted-service/) and [The Graph Network: The Sunrise of Decentralized Data](https://thegraph.com/blog/transitioning-to-decentralized-graph-network/) — hosted service shut down **June 12, 2024**; remained only for chains unsupported on the decentralized network.
- GRT spot price ~$0.025 (range $0.024–$0.03 across [CoinGecko](https://www.coingecko.com/en/coins/the-graph), [CoinMarketCap](https://coinmarketcap.com/currencies/the-graph/), [Coinbase](https://www.coinbase.com/price/the-graph), [Kraken](https://www.kraken.com/prices/the-graph)) on 2026-09-23.

**Not sourced, stated as estimate only:** Arbitrum publish-transaction gas cost. Treat
the "low single-digit USD" figure as my prior, not a verified number.
