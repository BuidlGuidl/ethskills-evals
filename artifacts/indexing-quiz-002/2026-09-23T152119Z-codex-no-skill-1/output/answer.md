# Production go-live path for a The Graph subgraph

## Short answer

The draft runbook is wrong for production today. The old hosted service path is not the go-live path anymore: The Graph says the hosted service has been inactive since June 12, 2024, and that queries are now powered by The Graph Network. The production path is:

1. Deploy the subgraph to Subgraph Studio for staging/testing.
2. Publish that deployment to The Graph's decentralized network, via Studio or `graph publish`.
3. Query the production gateway endpoint with an API key.
4. Set up billing for queries, either by credit card or by funding billing with GRT on Arbitrum.
5. Optionally add GRT curation signal to improve indexer incentives and quality of service.

Sources to re-check before budget approval:

- Hosted service sunset: https://thegraph.com/blog/sunsetting-hosted-service/
- Studio deploy and publish docs: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/
- Publishing docs, including curation signal: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/
- Querying from an app: https://thegraph.com/docs/en/subgraphs/querying/from-an-application/
- API keys: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/
- Billing and GRT/card setup: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/
- Pricing page: https://thegraph.com/studio-pricing/

## What the draft gets wrong

`graph deploy --hosted-service marketplace` is an old hosted-service-style step, not a production deployment path. The hosted service is no longer active, so treating it as a free production endpoint is a dead path. The current `graph deploy <SUBGRAPH_SLUG>` flow deploys to Subgraph Studio, and The Graph's docs explicitly say that this deploy action does not publish the subgraph to the decentralized network.

The Studio deployment endpoint is for testing, not production. The app docs show a Studio endpoint shaped like:

```text
https://api.studio.thegraph.com/query/<ID>/<SUBGRAPH_NAME>/<VERSION>
```

The same docs describe that as the testing endpoint, and the deploy docs say the development query URL is limited to 3,000 queries per day.

The production endpoint is a gateway endpoint shaped like:

```text
https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```

That endpoint requires an API key. The Graph docs say each query URL requires a valid API key, and the API key docs say keys are used for auth, rate limits, and usage tracking. So the draft is also wrong about "no tokens, no billing, nothing to set up."

## Correct runbook

1. Confirm the subgraph can be supported on The Graph Network.

   Check that the source chain is in The Graph's supported networks and that any features you use are supported. The deploy docs point teams to the supported-networks list and feature support matrix before publishing.

2. Create the subgraph in Subgraph Studio.

   Connect a wallet in Subgraph Studio. Studio will show a deploy key for the subgraph. Authenticate the CLI with:

   ```bash
   graph auth <DEPLOY_KEY>
   ```

3. Build and deploy to Studio.

   From the subgraph repo:

   ```bash
   graph codegen
   graph build
   graph deploy <SUBGRAPH_SLUG>
   ```

   Use a semver-style version label such as `1.0.0`. At this point the subgraph is only in Studio. It is useful for QA, logs, indexing status, and smoke queries, but it is not yet the production network deployment.

4. Test the Studio deployment.

   Use the Studio playground or the Studio deployment query URL. Verify indexing catches up, `_meta` looks healthy, expected marketplace entities resolve, and no indexing errors show in Studio logs. Do not wire the production frontend to the Studio URL; it is rate-limited and meant for testing.

5. Publish to the decentralized network.

   Publish from Subgraph Studio with the Publish button, or use CLI publishing:

   ```bash
   graph publish
   ```

   Publishing creates the Graph Explorer entry and lets curators and indexers begin working with the subgraph. The docs say published subgraphs are published on Arbitrum One at the protocol layer while indexing data from supported networks.

6. Decide whether to add GRT signal.

   The Graph docs say developers can add GRT signal to incentivize indexers. They currently recommend curating your own eligible subgraph with at least 3,000 GRT to attract additional indexers. The same page says the Sunrise Upgrade Indexer ensures all subgraphs are indexed, but curation signal can draw more indexers and improve quality of service. If the subgraph is not eligible for indexing rewards, the docs say adding signal will not attract additional indexers.

7. Create production API keys.

   In Subgraph Studio, create at least one API key for production. For a browser dApp, do not ship an unrestricted key. The API key docs say not to hardcode or expose keys in client-side apps; in practice, either use a backend/proxy, or if the dApp must be fully static, restrict the key by domain, assign it only to this subgraph, and set a monthly spending limit.

8. Set up billing.

   Studio has a Free Plan with 100,000 monthly queries. Production usage above that requires the Growth Plan and payment by credit/debit card or GRT. If paying with GRT, The Graph docs say billing uses GRT on Arbitrum and that users need ETH on Arbitrum for gas. Billing invoices are processed monthly, and the GRT billing balance is automatically used as long as it has enough funds.

9. Update the frontend to the gateway endpoint.

   Use:

   ```text
   https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
   ```

   Make requests with POST. Track query count, GRT spent, current cost, and spending limit in Studio's API key details. Alert on indexing lag, indexing errors, gateway errors, and billing-balance/spend-limit warnings.

## Costs and budget numbers

### One-time / go-live costs

Deploying to Studio and testing: $0. The pricing page says Studio starts with 100,000 free monthly queries, and the docs describe Studio deployment/testing before publishing. The testing endpoint is not a production budget substitute because it is capped at 3,000 queries/day.

Publishing onchain: gas on Arbitrum One. The docs say publishing is an onchain action and that published versions are on Arbitrum One. I would budget this as a small but variable Arbitrum gas line, not a fixed vendor fee. Re-check current Arbitrum gas when executing.

Curation signal, if you choose to do it: recommended 3,000 GRT for an eligible subgraph. This is not a monthly fee and not query billing. It is GRT signaled/curated on the subgraph. The important cost is the curation tax: The Graph's curation docs say a 1% curation tax is incurred when signaling. On 3,000 GRT, that means:

```text
3,000 GRT * 1% = 30 GRT burned as curation tax
```

The remaining signal is capital committed to the curation position, subject to curation mechanics and risk. Withdrawal is possible, but the docs note risk and tax details. Re-check the current GRT/USD price before translating this into dollars; that price is volatile.

Subgraph upgrades after launch: gas plus possible curation tax effects. The curation docs say auto-migrating curation shares to a new version incurs a 0.5% curation tax. The Studio deploy docs also warn that publishing a new version has costs: transaction fees plus funding part of the curation tax on auto-migrating signal.

### Monthly query cost

The current public pricing page says:

```text
First 100,000 queries/month: free
Additional queries: $2 per 100,000 queries
```

That is $20 per 1,000,000 queries after the free allowance. My budget math:

```text
monthly_cost = max(0, monthly_queries - 100,000) / 100,000 * $2
```

Examples:

| Monthly queries | Billable after free 100k | Estimated monthly cost |
| ---: | ---: | ---: |
| 1,000,000 | 900,000 | $18 |
| 2,000,000 | 1,900,000 | $38 |
| 3,000,000 | 2,900,000 | $58 |
| 5,000,000 | 4,900,000 | $98 |
| 10,000,000 | 9,900,000 | $198 |

These figures come from The Graph's Studio pricing page and query docs. Re-check the pricing page immediately before committing the budget because vendor pricing can change. Also verify whether your actual bill is rounded by exact query count or by 100k blocks; the page presents the rate as "$2 per 100,000 queries."

## Budget recommendation

For a first production month at "a few million queries," I would budget:

- Query usage: about $40 to $100/month for 2M to 5M monthly queries at today's public rate.
- One-time publish gas: small Arbitrum gas buffer, but re-check at launch.
- Optional curation: 3,000 GRT committed if eligible and if you want stronger indexer incentives, with 30 GRT burned as the 1% curation tax, plus gas.
- Operational buffer: set a Studio spending limit above expected usage, for example 2x the expected monthly query cost during launch week, then tighten once real traffic is known.

The part I would not put in the runbook is "free hosted service endpoint." The production runbook should say "publish to The Graph Network, configure API key and billing, and use the gateway endpoint."
