# Production go-live path for our subgraph on The Graph

As of 2026-09-23, the draft runbook is not the production path.

The old idea of `graph deploy --hosted-service marketplace` points at The Graph's legacy hosted service workflow. The Graph announced the move away from the hosted service, and the 2024 Sunbeam/Sunrise migration window told hosted-service users to upgrade hosted subgraphs to The Graph Network by June 12, 2024. The production path today is: deploy the subgraph to Subgraph Studio for staging, publish/register it on The Graph Network, make sure it is indexed by network Indexers, then query it through the gateway with an API key and billing set up.

## What the draft gets wrong

1. **Wrong deployment target.** `--hosted-service` is the old hosted-service mental model. The current docs say to deploy to Subgraph Studio with `graph deploy <SUBGRAPH_SLUG>` after `graph auth <DEPLOY KEY>`. That Studio deployment is private/staging and explicitly "won't publish your Subgraph to the decentralized network."

2. **"Free public production endpoint" is wrong.** Studio gives a testing endpoint, but the docs call it testing-only and rate-limited. The production endpoint is the gateway URL after publishing:

   ```text
   https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
   ```

3. **"No tokens, no billing" is wrong.** Production querying requires an API key. Each account gets 100,000 free monthly queries, then usage is billed. The current public pricing page says the first 100,000 monthly queries are free and additional usage is $2 per 100,000 queries. Billing can be paid by credit card or with GRT. If paying with GRT, The Graph's billing system uses GRT on Arbitrum, and the wallet needs ETH on Arbitrum for gas.

4. **Indexing/reliability is not created by a query URL alone.** Publishing makes the subgraph discoverable to Indexers. The docs say published subgraphs are unlikely to be picked up by Indexers without curation signal, although the Sunrise Upgrade Indexer provides fallback indexing. For production reliability and latency, we should budget/plan for curation signal or otherwise verify enough Indexers are serving the subgraph.

## Correct go-live runbook

1. **Confirm the target chain is supported.**
   Check The Graph supported-networks page and the feature support matrix for our chain and subgraph features. If the chain is not supported by The Graph Network, the production options become self-hosting Graph Node, choosing another indexing provider, or publishing via a path that Indexers will actually support.

2. **Create the subgraph in Subgraph Studio.**
   Open Subgraph Studio, connect the owning wallet or Safe, create the subgraph slug, and copy the deploy key.

3. **Authenticate and deploy the build to Studio.**

   ```bash
   graph auth <DEPLOY_KEY>
   graph codegen
   graph build
   graph deploy <SUBGRAPH_SLUG>
   ```

   Use a real version label, preferably semver. This creates a Studio deployment for review; it is not production publication yet.

4. **Validate the Studio deployment.**
   Use Studio logs, indexing status, and the Studio test endpoint. The Studio docs say the development query URL is limited to 3,000 queries per day, so do not point production frontend traffic at it.

5. **Publish to The Graph Network.**
   Publish from the Studio dashboard, or use the CLI path:

   ```bash
   graph codegen && graph build
   graph publish
   ```

   Publishing is an onchain action against The Graph Network contracts on Arbitrum One. We need a wallet that can sign on Arbitrum One and enough ETH on Arbitrum for transaction gas. Published subgraphs have a subgraph ID and ownership represented by an NFT.

6. **Add curation signal if we want production-quality indexing.**
   The publishing docs recommend self-curating with at least **3,000 GRT** for eligible subgraphs to attract additional Indexers. This is not a monthly query bill; it is locked GRT signal that can later be withdrawn, subject to protocol mechanics and taxes. Curating incurs a **1% curation tax** burned by the protocol. There is also Arbitrum transaction gas.

7. **Wait for indexing and verify serving quality.**
   Confirm the published version is indexed and sufficiently synced. Check Graph Explorer, `_meta { block { number } hasIndexingErrors }`, and any indexing-status tooling exposed by Studio/Explorer. For production, verify at least: the subgraph is synced near chain head, no deterministic indexing errors, queries return within frontend SLOs, and the gateway URL resolves the expected published subgraph ID.

8. **Create and lock down API keys.**
   In Subgraph Studio, create an API key, assign it only to this subgraph, set domain restrictions, set a monthly USD spending limit, and monitor query count/GRT spent. The docs say API keys are required and can be scoped to subgraphs/domains and rate/spend-limited.

   Important frontend note: The Graph docs also say not to hardcode or expose API keys in client-side apps. For a browser-only dApp, the practical choices are:

   - use a subgraph-scoped, domain-restricted API key with a hard spending cap and accept that a public frontend cannot fully hide it; or
   - proxy GraphQL calls through our backend/edge if we need the key to remain secret.

9. **Switch the frontend to the gateway endpoint.**
   Replace local Graph Node / Studio URLs with:

   ```text
   https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
   ```

   Use POST requests. Add error handling for indexing lag, gateway errors, and spending-limit/rate-limit failures.

10. **Operate it like a paid production dependency.**
    Track monthly queries, invoice amount, API key spend cap, indexing lag, indexing errors, and frontend query latency. For subgraph upgrades, deploy the new version to Studio, test, publish the new version, and understand that auto-migrating curation signal can incur migration tax and gas.

## Budget numbers and reasoning

### Query traffic

Current public Subgraph Studio pricing says:

- first **100,000 queries/month are free**;
- additional usage is **$2 per 100,000 queries**;
- payment can be by card or crypto/GRT.

So the direct query bill is:

```text
monthly cost = max(0, total_queries - 100,000) / 100,000 * $2
```

Examples:

| Monthly queries | Billable queries | Estimated monthly query bill |
| ---: | ---: | ---: |
| 1,000,000 | 900,000 | $18 |
| 3,000,000 | 2,900,000 | $58 |
| 5,000,000 | 4,900,000 | $98 |
| 10,000,000 | 9,900,000 | $198 |

The source to re-check before committing the budget is The Graph's pricing page, because this is product pricing and can change. I also found an official "The Graph vs. Self Hosting" docs page that says an average **$20 per million queries** / **$0.00002 per query**, but its own 3M-query example says **$120/month**, which does not match either $20/M or the current Studio pricing page. I would use the pricing page for budget math and flag the comparison page as stale or internally inconsistent.

### Stand-up cost

- **Subgraph Studio setup:** $0 setup fee according to The Graph's self-hosting comparison page, and Studio's pricing page advertises starting free.
- **Publishing transaction:** variable Arbitrum One gas, paid in ETH on Arbitrum. The docs do not give a fixed dollar value. For budgeting, I would list this as "variable Arbitrum gas, re-check in wallet at publish time," not as a material recurring cost.
- **Curation signal:** optional but recommended for reliability. The publishing docs recommend **at least 3,000 GRT** for eligible subgraphs. At the CoinMarketCap live price I saw on 2026-09-23, **1 GRT ~= $0.02751**, so **3,000 GRT ~= $82.53** of token exposure/working capital. The 1% curation tax would be about **30 GRT ~= $0.83** at that same price, plus Arbitrum gas. Re-check GRT spot price before budgeting because this is volatile.

### Token exposure

If we pay by card and skip curation signal, the frontend production query path does not require us to hold GRT for query billing. But if we use crypto billing or add curation signal, we need GRT:

- query billing with GRT requires GRT on Arbitrum and ETH on Arbitrum for gas;
- curation signal requires locking GRT and paying the 1% curation tax;
- if we use a Safe/multisig, make sure it can sign the Studio/publish/billing actions.

### Practical budget line

For "a few million queries/month," I would budget:

- **Query bill:** about **$60/month at 3M queries**, using the current $2 per 100k-after-free pricing. If planning for 5M, use about **$100/month**. Add headroom for spikes.
- **One-time go-live:** $0 platform setup + variable Arbitrum gas + optional **3,000 GRT signal**. At today's checked price, 3,000 GRT is only about **$83**, but I would write this as "3,000 GRT, USD value rechecked at purchase" rather than hard-coding the dollar amount.
- **Ongoing ops:** no fixed infrastructure fee from The Graph Network for this path, but API overage is usage-based and the API key should have a monthly spend cap.

## Source trail

- The Graph docs, "Deploying Using Subgraph Studio": `graph auth`, `graph deploy <SUBGRAPH_SLUG>`, Studio deployments are not published to the decentralized network, and the Studio development endpoint is rate-limited to 3,000 queries/day: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/
- The Graph docs, "Publishing a Subgraph to the Decentralized Network": publish after Studio, publish from Studio or CLI, Arbitrum One publishing, curation signal, and the 3,000 GRT recommendation: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/
- The Graph docs, "Subgraphs Overview": lifecycle, publishing is onchain, published subgraphs need signal, and first 100,000 queries/month are free: https://thegraph.com/docs/en/subgraphs/overview/
- The Graph docs, "Querying from an Application": Studio endpoint vs production gateway endpoint: https://thegraph.com/docs/en/subgraphs/querying/from-an-application/
- The Graph docs, "Managing API Keys": API keys are required, endpoint format, domain/subgraph restrictions, spending limits, and usage monitoring: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/
- The Graph docs, "Subgraph Studio": free/growth plans, credit card billing, GRT billing, and GRT on Arbitrum: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/
- The Graph pricing page: 100,000 free monthly queries and $2 per additional 100,000 queries: https://thegraph.com/studio-pricing/
- The Graph docs, "Pricing & Payments": query costs vs indexing costs, API-key metering, and card/GRT payment methods: https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/pricing-payments/
- The Graph docs, "Serving Queries": gateway routing, API-key auth, subgraph-ID endpoint, and x402 alternative: https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/serving-queries/
- The Graph docs, "Curating": curation signal attracts Indexers, 1% curation tax, and withdraw mechanics: https://thegraph.com/docs/en/resources/roles/curating/
- The Graph blog, "Sunbeam Has Begun": hosted-service users had to upgrade to The Graph Network by June 12, with 100,000 free queries/month and payments by card or GRT: https://thegraph.com/blog/sunbeam-upgrade-window/
- The Graph docs, "The Graph vs. Self Hosting": $0 setup fees, average $20 per million queries, optional curation signal, and the comparison table that should be re-checked because its 3M-query example appears inconsistent: https://thegraph.com/docs/en/resources/benefits/
- CoinMarketCap GRT page checked on 2026-09-23 for the live GRT/USD reference price used only to estimate the USD value of 3,000 GRT: https://coinmarketcap.com/currencies/the-graph/
