# Production go-live path for our subgraph on The Graph

As of 2026-09-23, the draft runbook step is not the production path:

> `graph deploy --hosted-service marketplace`

That is the old hosted-service mental model. The production path today is:

1. deploy the subgraph to Subgraph Studio for testing,
2. publish it to The Graph's decentralized network,
3. create a billed API key,
4. point the app at the gateway URL for the published subgraph,
5. monitor query usage, sync/indexer health, and billing.

## What the draft gets wrong

The hosted service is not the thing to plan around for a new production dApp. The Graph's own sunsetting post says new hosted-service deployments stopped during the migration path and that production traffic moves to the decentralized network, with developers using Studio to pay per query. Source: The Graph, "The Road to Sunsetting the Hosted Service" (lines 35-50 in the page I checked): https://thegraph.com/blog/sunsetting-hosted-service/

`graph deploy` is not the same as publishing to production. The current docs say `graph deploy <SUBGRAPH_SLUG>` deploys to Subgraph Studio, where we can test and update metadata, and "won't publish your Subgraph to the decentralized network." The Studio development query URL is also capped at 3,000 queries/day. Source: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/

Production querying is not "no tokens, no billing." The production endpoint requires an API key, and Studio has query billing. The Graph's query docs say each published subgraph has a gateway query URL, each query URL requires a valid API key, the free plan includes 100,000 queries/month, and additional queries are on the Growth Plan. Source: https://thegraph.com/docs/en/subgraphs/querying/introduction/

The public production URL is not the old hosted-service URL. The app should use:

```text
https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```

Source: The Graph's "Querying from an Application" docs: https://thegraph.com/docs/en/subgraphs/querying/from-an-application/

## Correct go-live steps

1. Confirm the indexed chain and subgraph features are supported on The Graph Network.

   The supported-networks docs list the networks available for subgraphs and note that if a preferred network is not supported on the decentralized network, the alternative is running our own Graph Node. Source: https://thegraph.com/docs/en/supported-networks/

2. Create the subgraph in Subgraph Studio and authenticate the CLI.

   In Studio, connect the deployer wallet, create/find the subgraph, copy the deploy key, then run:

   ```bash
   graph auth <DEPLOY_KEY>
   graph codegen
   graph build
   graph deploy <SUBGRAPH_SLUG>
   ```

   The deploy key is used for publishing/API-key/billing management. Source: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/

3. Test the Studio deployment.

   Use the Studio/dev query URL only for pre-production validation. Check logs, indexing status, schema, and our real frontend queries. Do not ship the frontend against this URL; The Graph documents it as rate-limited/testing-only, with a 3,000 query/day limit. Source: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/

4. Publish to The Graph Network.

   Publish from Studio or use current `graph-cli`:

   ```bash
   graph codegen && graph build
   graph publish
   ```

   Publishing is an on-chain action on The Graph Network. The docs say published versions are published to Arbitrum One, while the subgraph can index data on any supported network. Source: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/

5. Decide whether to add curation signal.

   This is not a monthly hosting bill, but it can be important for production reliability. The Graph docs say developers can add GRT signal to incentivize Indexers, and if the subgraph is eligible for indexing rewards, they recommend curating our own subgraph with at least 3,000 GRT to attract additional indexers. They also say signal on a non-rewards-eligible subgraph will not attract additional Indexers. Source: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/

6. Create a production API key and billing setup.

   In Subgraph Studio, create an API key, set a monthly spending limit, and restrict domains if the app will call the gateway from the browser. The docs show key usage in the URL or as a bearer token, and the API-key page shows spending limits, usage, GRT spent, and domain restrictions. Source: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/

   Note: if the key is shipped in a client-side frontend bundle, it is exposed. The same API-key docs say not to hardcode it or expose it in client-side apps. For a production budget we should either proxy queries through our backend, or accept that a browser-exposed key is public-ish and rely on domain restrictions plus a strict spend limit.

7. Switch frontend config to the gateway URL for the published subgraph.

   Use the published `SUBGRAPH_ID`, not the Studio deployment URL. Keep separate API keys for production/staging and set alerts/spend caps per key.

8. Add production monitoring.

   At minimum: Graph gateway errors/latency, API-key usage and cost, subgraph sync health in Explorer/Studio, indexer availability, and frontend error rates. Keep the old local Graph Node only as a dev/test tool, not as the production endpoint unless we intentionally choose self-hosting.

## Budget

### One-time or launch-time costs

Deploying to Studio for testing: $0 from The Graph, based on the Studio pricing page saying subgraph creation/testing is included and the deployment docs saying Studio is the test path. Sources: https://thegraph.com/studio-pricing/ and https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/

Publishing to the network: Arbitrum One gas for the publish transaction. The exact dollar amount depends on Arbitrum gas at publish time, so I would budget a small operational ETH-on-Arbitrum line and re-check at execution. Source for publishing-on-Arbitrum behavior: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/

Curation signal, if we choose to self-signal: recommended at 3,000 GRT for eligible subgraphs, plus a 1% curation tax when signaling. At 3,000 GRT, the tax is 30 GRT burned. The remaining signal is not a normal expense, but it is capital locked/at risk in the curation pool and exposed to GRT price and curation mechanics. Sources: 3,000 GRT recommendation from https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/ and 1% curation tax from https://thegraph.com/docs/en/resources/roles/curating/

Query billing setup: no separate setup fee found in the official pricing docs, but if paying with GRT we need GRT on Arbitrum and ETH on Arbitrum for gas. The billing docs say GRT is accepted on Arbitrum, all protocol/billing activity is now on Arbitrum One, and ETH on Arbitrum is needed for gas. Source: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/

### Monthly query costs

The current public Studio price I found is:

- first 100,000 queries/month free,
- then $2 per additional 100,000 queries.

Source: The Graph Studio pricing page: https://thegraph.com/studio-pricing/

Math:

```text
monthly_cost_usd = max(0, monthly_queries - 100,000) / 100,000 * 2
```

Examples:

| Monthly queries | Billable queries | Estimated monthly cost |
| ---: | ---: | ---: |
| 1,000,000 | 900,000 | $18 |
| 3,000,000 | 2,900,000 | $58 |
| 5,000,000 | 4,900,000 | $98 |
| 10,000,000 | 9,900,000 | $198 |

If we pay by credit card, this is the budget number in USD before any taxes/payment-processing/account-specific terms. If we pay with GRT, the invoice is still driven by query fees, but we need enough GRT balance; the amount of GRT needed moves with the GRT/USD rate. The billing docs say invoices are processed at month end and require either an active card for over-free-plan queries or sufficient GRT balance beyond the 100,000 free monthly queries. Source: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/

## Numbers to re-check before committing the budget

Re-check the $2 per 100,000 overage price and 100,000 free monthly queries on the pricing page immediately before finalizing the sprint budget: https://thegraph.com/studio-pricing/

Re-check whether our subgraph is indexing-rewards eligible before allocating 3,000 GRT to signal. The docs explicitly say adding signal to a non-eligible subgraph will not attract additional Indexers. Source: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/

Re-check the live GRT/USD price if paying with GRT or budgeting curation signal in dollars. The source for the required token mechanics is The Graph's billing/curation docs, but the market price is external and changes constantly.

Re-check Arbitrum gas at publish/signaling time. It should be much smaller than Ethereum mainnet gas, but it is still real ETH on Arbitrum and not knowable from the runbook.

Re-check API-key exposure posture. Direct browser queries are supported by the docs, but the API-key docs warn not to expose keys in client-side apps. If we cannot tolerate abuse risk, ship a backend proxy/cache and keep the The Graph API key server-side.

## Budget line I would put in the runbook

For a few million monthly queries, assume The Graph Studio query spend in the tens of dollars per month: about $58/month at 3M queries, about $98/month at 5M queries, using the current $2 per 100K overage price after the first 100K free queries.

Separately budget launch funds for Arbitrum gas and, if we want stronger indexer incentives, a treasury allocation of at least 3,000 GRT as curation signal plus a 30 GRT curation-tax burn at that level. Treat that signal as token capital at risk, not as the same category as a monthly API bill.
